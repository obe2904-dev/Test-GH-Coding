// Context fetcher for get-quick-suggestions
// Consolidates all database queries
// Extracted June 24, 2026

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type {
  BusinessRow,
  OperationsRow,
  OpeningHoursRow,
  LocationRow,
  MenuItem,
  MenuProgram,
  BrandProfileRow,
  RecentSuggestion,
  BusinessContext,
} from './types.ts'
import { countryToLangCode } from '../_shared/utils/hospitality-register.ts'
import { countryToLanguageCode } from '../_shared/helpers/country-to-language.ts'
import { detectServicePeriod, getMenuRotationQueue, type RotationQueueItem } from '../_shared/content-planning/index.ts'

/**
 * Fetch business basic information
 */
export async function fetchBusiness(
  supabase: SupabaseClient,
  businessId: string
): Promise<BusinessRow | null> {
  const { data: business, error } = await supabase
    .from('businesses')
    .select('name, business_type_hybrid, website_url, country')
    .eq('id', businessId)
    .single()

  if (error) {
    console.error('❌ Business query error:', {
      businessId,
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    })
    return null
  }

  if (!business) {
    console.error('❌ Business not found:', businessId)
    return null
  }

  // Extract vertical from business_type_hybrid for backward compatibility
  const businessTypeHybrid = (business as any).business_type_hybrid || null
  const vertical = businessTypeHybrid?.primary || 'restaurant'

  console.log('✅ Business loaded:', business.name, '- Type:', vertical)
  
  return {
    ...business,
    vertical,
    business_type_hybrid: businessTypeHybrid
  } as BusinessRow
}

/**
 * Fetch business operations data
 */
export async function fetchOperations(
  supabase: SupabaseClient,
  businessId: string
): Promise<{
  operations: OperationsRow | null
  hasOutdoorSeating: boolean
  hasKidsMenu: boolean
  hasTakeaway: boolean
  hasTableService: boolean
  kitchenCloseTime: string | null
  weeklyProgramme: string | null
}> {
  const { data: operations } = await supabase
    .from('business_operations')
    .select('has_outdoor_seating, has_kids_menu, has_takeaway, has_table_service, kitchen_close_time, weekly_programme, price_level')
    .eq('business_id', businessId)
    .single()

  console.log('🔍 Business operations data:', {
    found: !!operations,
    kitchen_close_time_raw: operations?.kitchen_close_time,
    has_outdoor_seating: operations?.has_outdoor_seating,
  })

  const hasOutdoorSeating = operations?.has_outdoor_seating || false
  const hasKidsMenu = operations?.has_kids_menu || false
  const hasTakeaway = operations?.has_takeaway || false
  const hasTableService = operations?.has_table_service !== false // default true if null
  const kitchenCloseTime: string | null = operations?.kitchen_close_time
    ? operations.kitchen_close_time.replace(/:\d{2}$/, '') // strip seconds (DB stores HH:MM:SS)
    : null
  const weeklyProgramme: string | null = operations?.weekly_programme?.trim() || null

  console.log(`   kitchen_close_time processed: "${kitchenCloseTime}" (${typeof kitchenCloseTime})`)

  return {
    operations: operations as OperationsRow | null,
    hasOutdoorSeating,
    hasKidsMenu,
    hasTakeaway,
    hasTableService,
    kitchenCloseTime,
    weeklyProgramme,
  }
}

/**
 * Fetch today's opening hours
 */
export async function fetchTodayOpeningHours(
  supabase: SupabaseClient,
  businessId: string,
  clientNow: Date
): Promise<{
  todayOpenTime: string | null
  todayCloseTime: string | null
  isClosedToday: boolean
}> {
  const dowNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayDow = dowNames[clientNow.getDay()]

  let todayOpenTime: string | null = null
  let todayCloseTime: string | null = null
  let isClosedToday = false

  try {
    const { data: hoursRows } = await supabase
      .from('opening_hours')
      .select('open_time, close_time')
      .eq('business_id', businessId)
      .eq('kind', 'normal')
      .eq('weekday', todayDow)
      .limit(1)

    const todayHours = hoursRows?.[0]
    if (todayHours) {
      // PostgreSQL `time` type serialises as HH:MM:SS — strip the trailing :SS
      const stripSecs = (t: string | null) => (t ? t.replace(/:\d{2}$/, '') : t)
      todayOpenTime = stripSecs(todayHours.open_time ?? null)
      todayCloseTime = stripSecs(todayHours.close_time ?? null)
      console.log(`⏰ Today's hours: ${todayOpenTime}–${todayCloseTime}`)
    } else {
      // No row = business is closed today
      isClosedToday = true
      console.log(`🚫 Business is closed today (${todayDow}) — programs will be suppressed`)
    }
  } catch (e) {
    console.warn('⚠️ Failed to fetch opening hours:', e)
  }

  return { todayOpenTime, todayCloseTime, isClosedToday }
}

/**
 * Fetch business location and coordinates
 */
export async function fetchLocation(
  supabase: SupabaseClient,
  businessId: string
): Promise<{
  location: LocationRow | null
  latitude: number | null
  longitude: number | null
  expectedLanguage: string
}> {
  const { data: location } = await supabase
    .from('business_locations')
    .select('postal_code, city, country')
    .eq('business_id', businessId)
    .eq('is_primary', true)
    .single()

  const { data: locationIntelCoords } = await supabase
    .from('business_location_intelligence')
    .select('latitude, longitude')
    .eq('business_id', businessId)
    .maybeSingle()

  const expectedLanguage = countryToLanguageCode(location?.country)
  console.log('🌐 Language filter:', { country: location?.country, expectedLanguage })

  return {
    location: location as LocationRow | null,
    latitude: locationIntelCoords?.latitude ?? null,
    longitude: locationIntelCoords?.longitude ?? null,
    expectedLanguage,
  }
}

/**
 * Fetch rotation queue and service period detection
 */
export async function fetchRotationQueue(
  supabase: SupabaseClient,
  businessId: string,
  clientNow: Date,
  expectedLanguage: string,
  regenerate: boolean = false
): Promise<{
  currentServicePeriod: string | null
  currentServicePeriods: string[]
  rotationQueue: RotationQueueItem[]
  menuDescriptionMap: Map<string, string>
  menuCategoryMap: Map<string, string>
}> {
  const currentTimeHHMM = `${clientNow.getHours().toString().padStart(2, '0')}:${clientNow.getMinutes().toString().padStart(2, '0')}`
  let currentServicePeriod: string | null = null
  let currentServicePeriods: string[] = []
  let rotationQueue: RotationQueueItem[] = []
  const menuDescriptionMap = new Map<string, string>()
  const menuCategoryMap = new Map<string, string>()

  try {
    const servicePeriodResult = await detectServicePeriod(supabase, businessId, currentTimeHHMM)
    currentServicePeriod = servicePeriodResult.currentPeriod
    currentServicePeriods = servicePeriodResult.currentPeriods
    console.log(`🍽️ Current service period(s): ${currentServicePeriods.length > 0 ? currentServicePeriods.join(', ') : 'unknown (business may be closed)'}`)

    // Fetch ALL configured service periods (not just current)
    const { data: allProgrammes } = await supabase
      .from('business_programme_profiles')
      .select('programme_type')
      .eq('business_id', businessId)

    const allConfiguredPeriods = allProgrammes
      ? Array.from(new Set(allProgrammes.map(p => p.programme_type).filter(Boolean)))
      : currentServicePeriods

    if (allConfiguredPeriods.length > currentServicePeriods.length) {
      console.log(`📅 Fetching rotation queue for ALL configured periods: ${allConfiguredPeriods.join(', ')}`)
    }

    // Get rotation queue
    rotationQueue = await getMenuRotationQueue(supabase, {
      businessId,
      servicePeriods: allConfiguredPeriods.length > 0 ? allConfiguredPeriods : null,
      menuLanguage: expectedLanguage,
      lookbackDays: 90,
      limit: 100,
    })

    console.log(`🔄 Rotation queue: ${rotationQueue.length} dishes available`)
    if (rotationQueue.length > 0) {
      console.log(`   Top priority: "${rotationQueue[0].menu_item_name}" (last posted: ${rotationQueue[0].days_since_posted || 'never'} days ago)`)
    }

    // Shuffle queue if regenerating (for variety)
    if (regenerate && rotationQueue.length > 3) {
      const shuffleArray = <T,>(array: T[]): T[] => {
        const shuffled = [...array]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
      }

      const topN = Math.min(20, rotationQueue.length)
      const topDishes = rotationQueue.slice(0, topN)
      const remainingDishes = rotationQueue.slice(topN)
      rotationQueue = [...shuffleArray(topDishes), ...remainingDishes]
      console.log(`🔀 Regenerate mode: shuffled top ${topN} dishes`)
    }

    // Build description and category maps
    for (const item of rotationQueue) {
      if (item.item_description?.trim()) {
        menuDescriptionMap.set(item.menu_item_name, item.item_description.trim())
      }
      if (item.category_name?.trim()) {
        menuCategoryMap.set(item.menu_item_name, item.category_name.trim())
      }
    }

    console.log(`📋 Loaded ${menuDescriptionMap.size} menu descriptions and ${menuCategoryMap.size} categories`)
  } catch (err) {
    console.warn('⚠️ Failed to get rotation queue:', err)
    rotationQueue = []
  }

  return {
    currentServicePeriod,
    currentServicePeriods,
    rotationQueue,
    menuDescriptionMap,
    menuCategoryMap,
  }
}

/**
 * Fetch brand profile
 */
export async function fetchBrandProfile(
  supabase: SupabaseClient,
  businessId: string
): Promise<BrandProfileRow | null> {
  const { data: brandProfile } = await supabase
    .from('business_brand_profile')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle()

  if (!brandProfile) {
    console.log('⚠️ No brand profile found')
    return null
  }

  console.log('✅ Brand profile loaded')
  return brandProfile as BrandProfileRow
}

/**
 * Fetch recent suggestions (for pattern tracking)
 */
export async function fetchRecentSuggestions(
  supabase: SupabaseClient,
  businessId: string,
  today: string
): Promise<RecentSuggestion[]> {
  const { data: recentSuggestions } = await supabase
    .from('daily_suggestions')
    .select('id, title, content_type, created_at, menu_item_name, status')
    .eq('business_id', businessId)
    .gte('date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .neq('date', today)
    .order('created_at', { ascending: false })
    .limit(50)

  console.log(`📊 Recent suggestions: ${recentSuggestions?.length || 0} from last 14 days`)
  return (recentSuggestions as RecentSuggestion[]) || []
}

/**
 * Fetch all business context in parallel
 */
export async function fetchAllBusinessContext(
  supabase: SupabaseClient,
  businessId: string,
  clientNow: Date,
  today: string,
  regenerate: boolean = false
): Promise<{
  business: BusinessRow
  language: string
  operations: ReturnType<typeof fetchOperations> extends Promise<infer T> ? T : never
  hours: ReturnType<typeof fetchTodayOpeningHours> extends Promise<infer T> ? T : never
  location: ReturnType<typeof fetchLocation> extends Promise<infer T> ? T : never
  rotation: ReturnType<typeof fetchRotationQueue> extends Promise<infer T> ? T : never
  brandProfile: BrandProfileRow | null
  recentSuggestions: RecentSuggestion[]
}> {
  // Fetch business first (needed for language)
  const business = await fetchBusiness(supabase, businessId)
  if (!business) {
    throw new Error('Business not found')
  }

  const language = countryToLangCode(business.country)

  // Fetch location first (needed for language in rotation queue)
  const location = await fetchLocation(supabase, businessId)

  // Fetch everything else in parallel
  const [operations, hours, rotation, brandProfile, recentSuggestions] = await Promise.all([
    fetchOperations(supabase, businessId),
    fetchTodayOpeningHours(supabase, businessId, clientNow),
    fetchRotationQueue(supabase, businessId, clientNow, location.expectedLanguage, regenerate),
    fetchBrandProfile(supabase, businessId),
    fetchRecentSuggestions(supabase, businessId, today),
  ])

  return {
    business,
    language,
    operations,
    hours,
    location,
    rotation,
    brandProfile,
    recentSuggestions,
  }
}
