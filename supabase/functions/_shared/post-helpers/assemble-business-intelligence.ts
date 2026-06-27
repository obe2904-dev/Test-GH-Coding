/**
 * BUSINESS INTELLIGENCE ASSEMBLY LAYER
 * 
 * Consolidates all business-specific data into AI-ready format for strategy generation.
 * This ensures Phase 2b AI receives complete context about:
 * - Service period commercial strategies
 * - Location positioning and marketing angles
 * - Brand voice and themes
 * - Menu intelligence (signature dishes, categories)
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface ServicePeriodStrategy {
  programmeName: string
  programmeType: string
  hours: string
  commercialGoals: {
    drive_footfall: number
    strengthen_brand: number
    retain_regulars: number
  }
  decisionTimingMode: string
  audienceSegments: AudienceSegment[]
  contentAngles: string[]
  aiReasoning: string
}

export interface AudienceSegment {
  segment_name: string
  segment_type: string
  goal: string
  decision_type: string
  content_angles: string[]
  evidence: string[]
}

export interface LocationPositioning {
  primaryContext: string
  scores: {
    waterfront?: number
    city_center?: number
    historic?: number
    tourist?: number
    student?: number
  }
  marketingHooks: string[]
  areaType: string
  competitionLevel: {
    count: number
    radius: number
  }
  matched_motivations?: string[]
  primary_type?: string
  marketing_focus?: string
  tourist_context?: boolean
  tourist_factor?: string
}

export interface BrandVoice {
  personality?: string[]
  formality?: string
  humor?: string
  emojiFrequency?: string
  signatureThemes?: string[]
  voiceRules?: string[]
  gastronomicProfile?: string
}

export interface MenuIntelligence {
  signatureDishes: string[]
  categories: string[]
  servicePeriodsWithMenu: string[]
  menuTiming: MenuTiming[]
}

export interface MenuTiming {
  menuTitle: string
  availabilityTime: string
  startTime: string
  endTime: string
  servicePeriodName: string
}

export interface BusinessIntelligence {
  businessId: string
  businessName: string
  servicePeriodStrategies: ServicePeriodStrategy[]
  locationPositioning: LocationPositioning | null
  brandVoice: BrandVoice | null
  menuIntelligence: MenuIntelligence | null
  dataCompleteness: {
    hasServicePeriods: boolean
    hasLocation: boolean
    hasBrand: boolean
    hasMenu: boolean
    overallScore: number
  }
}

/**
 * Fetch service period strategies from business_programme_profiles
 */
async function fetchServicePeriodStrategies(
  supabase: SupabaseClient,
  businessId: string
): Promise<ServicePeriodStrategy[]> {
  const { data, error } = await supabase
    .from('business_programme_profiles')
    .select('*')
    .eq('business_id', businessId)
    .order('programme_name')

  if (error) {
    console.error('[assemble-business-intelligence] Error fetching programme profiles:', error)
    return []
  }

  if (!data || data.length === 0) {
    console.warn('[assemble-business-intelligence] No programme profiles found for business:', businessId)
    return []
  }

  return data.map(prog => {
    const segments = prog.audience_segments || []
    
    // Extract all unique content angles from all audience segments
    const allAngles = segments
      .flatMap((seg: any) => seg.content_angles || [])
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) // unique

    return {
      programmeName: prog.programme_name,
      programmeType: prog.programme_type,
      hours: `${prog.start_time || 'flexible'}-${prog.end_time || 'flexible'}`,
      commercialGoals: prog.baseline_goal_split || {
        drive_footfall: 0,
        strengthen_brand: 0,
        retain_regulars: 0
      },
      decisionTimingMode: prog.decision_timing_mode || 'unknown',
      audienceSegments: segments.map((seg: any) => ({
        segment_name: seg.segment_name,
        segment_type: seg.segment_type,
        goal: seg.goal,
        decision_type: seg.decision_type,
        content_angles: seg.content_angles || [],
        evidence: seg.evidence || []
      })),
      contentAngles: allAngles,
      aiReasoning: prog.commercial_reasoning || ''
    }
  })
}

/**
 * Fetch location positioning from business_location_intelligence
 */
async function fetchLocationPositioning(
  supabase: SupabaseClient,
  businessId: string
): Promise<LocationPositioning | null> {
  const { data, error } = await supabase
    .from('business_location_intelligence')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle()

  if (error) {
    console.error('[assemble-business-intelligence] Error fetching location intelligence:', error)
    return null
  }

  if (!data) {
    console.warn('[assemble-business-intelligence] No location intelligence found for business:', businessId)
    return null
  }

  // Determine primary context from category scores
  const categoryScores = data.category_scores || {}
  const sortedCategories = Object.entries(categoryScores)
    .sort(([, a], [, b]) => (b as number) - (a as number))
  
  const primaryContext = sortedCategories.length > 0 
    ? sortedCategories[0][0] 
    : data.area_type || 'urban'

  return {
    primaryContext,
    scores: {
      waterfront: categoryScores.waterfront,
      city_center: categoryScores.city_centre || categoryScores.city_center,
      historic: categoryScores.historic,
      tourist: categoryScores.tourist,
      student: categoryScores.student
    },
    marketingHooks: data.location_marketing_hooks || [],
    areaType: data.area_type || 'urban',
    competitionLevel: {
      count: data.competition_count || 0,
      radius: 300 // meters - standard analysis radius
    },
    matched_motivations: data.matched_motivations,
    primary_type: data.primary_type,
    marketing_focus: data.marketing_focus,
    tourist_context: data.tourist_context,
    tourist_factor: data.tourist_factor
  }
}

/**
 * Fetch brand voice from business_brand_profile
 */
async function fetchBrandVoice(
  supabase: SupabaseClient,
  businessId: string
): Promise<BrandVoice | null> {
  const { data, error } = await supabase
    .from('business_brand_profile')
    .select('brand_profile_v5')
    .eq('business_id', businessId)
    .maybeSingle()

  if (error) {
    console.error('[assemble-business-intelligence] Error fetching brand profile:', error)
    return null
  }

  if (!data || !data.brand_profile_v5) {
    console.warn('[assemble-business-intelligence] No brand profile V5 found for business:', businessId)
    return null
  }

  const v5 = data.brand_profile_v5
  const voice = v5.voice || {}
  const layer0 = v5.layer_0_intelligence || {}
  const menuOverview = layer0.menu_overview || {}

  return {
    personality: voice.personality_traits || voice.personality || [],
    formality: voice.formality_level || voice.formality,
    humor: voice.humor_style || voice.humor,
    emojiFrequency: voice.emoji_level || voice.emoji_frequency,
    signatureThemes: menuOverview.signature_themes || [],
    voiceRules: voice.tone_rules || voice.voice_rules || [],
    gastronomicProfile: menuOverview.gastronomic_profile || v5.gastronomic_profile
  }
}

/**
 * Fetch menu timing from menu_results_v2
 */
async function fetchMenuTiming(
  supabase: SupabaseClient,
  businessId: string
): Promise<MenuTiming[]> {
  const { data, error } = await supabase
    .from('menu_results_v2')
    .select('structured_data, service_period_name')
    .eq('business_id', businessId)
    .not('structured_data', 'is', null)

  if (error) {
    console.error('[assemble-business-intelligence] Error fetching menu timing:', error)
    return []
  }

  if (!data || data.length === 0) {
    return []
  }

  const timings: MenuTiming[] = []
  
  for (const menu of data) {
    const structured = menu.structured_data
    if (!structured) continue

    const menuTitle = structured.menuTitle || 'Untitled'
    const availabilityTime = structured.availabilityTime || 'Not specified'
    const servicePeriodName = menu.service_period_name || menuTitle

    // Extract start/end time from menuPeriods (use first period's timing)
    let startTime = '00:00'
    let endTime = '23:59'
    
    if (structured.menuPeriods && structured.menuPeriods.length > 0) {
      const firstPeriod = structured.menuPeriods[0]
      if (firstPeriod.startTime && firstPeriod.endTime) {
        startTime = firstPeriod.startTime
        endTime = firstPeriod.endTime
      }
    }

    timings.push({
      menuTitle,
      availabilityTime,
      startTime,
      endTime,
      servicePeriodName
    })
  }

  return timings
}

/**
 * Fetch menu intelligence from menu_items_normalized
 */
async function fetchMenuIntelligence(
  supabase: SupabaseClient,
  businessId: string
): Promise<MenuIntelligence | null> {
  // Get signature dishes
  const { data: signatures, error: sigError } = await supabase
    .from('menu_items_normalized')
    .select('item_name, service_period_name')
    .eq('business_id', businessId)
    .eq('is_signature', true)
    .limit(20)

  if (sigError) {
    console.error('[assemble-business-intelligence] Error fetching signature dishes:', sigError)
  }

  // Get unique categories and service periods
  const { data: overview, error: overviewError } = await supabase
    .from('menu_items_normalized')
    .select('category_name, service_period_name')
    .eq('business_id', businessId)

  if (overviewError) {
    console.error('[assemble-business-intelligence] Error fetching menu overview:', overviewError)
  }

  // Get menu timing from menu_results_v2
  const menuTiming = await fetchMenuTiming(supabase, businessId)

  if (!signatures && !overview && menuTiming.length === 0) {
    return null
  }

  const signatureDishes = signatures?.map(s => s.item_name) || []
  const categories = [...new Set(overview?.map(o => o.category_name) || [])]
  const servicePeriodsWithMenu = [...new Set(overview?.map(o => o.service_period_name) || [])]

  return {
    signatureDishes,
    categories,
    servicePeriodsWithMenu,
    menuTiming
  }
}

/**
 * Main function: Assemble complete business intelligence
 */
export async function assembleBusinessIntelligence(
  supabase: SupabaseClient,
  businessId: string
): Promise<BusinessIntelligence> {
  console.log('[assemble-business-intelligence] Fetching business intelligence for:', businessId)

  // Fetch business name
  const { data: businessData } = await supabase
    .from('businesses')
    .select('business_name')
    .eq('id', businessId)
    .maybeSingle()

  const businessName = businessData?.business_name || 'Unknown Business'

  // Fetch all intelligence in parallel
  const [servicePeriods, location, brand, menu] = await Promise.all([
    fetchServicePeriodStrategies(supabase, businessId),
    fetchLocationPositioning(supabase, businessId),
    fetchBrandVoice(supabase, businessId),
    fetchMenuIntelligence(supabase, businessId)
  ])

  // Calculate data completeness
  const hasServicePeriods = servicePeriods.length > 0
  const hasLocation = location !== null
  const hasBrand = brand !== null
  const hasMenu = menu !== null

  const completenessScore = [hasServicePeriods, hasLocation, hasBrand, hasMenu]
    .filter(Boolean).length

  const overallScore = Math.round((completenessScore / 4) * 100)

  const intelligence: BusinessIntelligence = {
    businessId,
    businessName,
    servicePeriodStrategies: servicePeriods,
    locationPositioning: location,
    brandVoice: brand,
    menuIntelligence: menu,
    dataCompleteness: {
      hasServicePeriods,
      hasLocation,
      hasBrand,
      hasMenu,
      overallScore
    }
  }

  console.log('[assemble-business-intelligence] Data completeness:', {
    servicePeriods: servicePeriods.length,
    hasLocation,
    hasBrand,
    hasMenu,
    overallScore: `${overallScore}%`
  })

  return intelligence
}

/**
 * Format business intelligence for AI prompt inclusion
 */
export function formatBusinessIntelligenceForPrompt(intelligence: BusinessIntelligence): string {
  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('📊 BUSINESS INTELLIGENCE CONTEXT')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('')
  lines.push(`Business: ${intelligence.businessName}`)
  lines.push(`Data Completeness: ${intelligence.dataCompleteness.overallScore}%`)
  lines.push('')

  // Location Positioning
  if (intelligence.locationPositioning) {
    const loc = intelligence.locationPositioning
    lines.push('📍 LOCATION POSITIONING')
    lines.push(`Primary Context: ${loc.primaryContext} (${loc.areaType})`)
    
    const topScores = Object.entries(loc.scores)
      .filter(([, score]) => score && score > 70)
      .sort(([, a], [, b]) => (b || 0) - (a || 0))
      .slice(0, 3)
    
    if (topScores.length > 0) {
      lines.push('Location Strengths:')
      topScores.forEach(([key, score]) => {
        lines.push(`  • ${key}: ${score}/100`)
      })
    }

    if (loc.marketingHooks.length > 0) {
      lines.push('Marketing Hooks: ' + loc.marketingHooks.join(', '))
    }

    lines.push(`Competition: ${loc.competitionLevel.count} venues within ${loc.competitionLevel.radius}m`)
    lines.push('')
  }

  // Service Period Strategies
  if (intelligence.servicePeriodStrategies.length > 0) {
    lines.push('🎯 SERVICE PERIOD COMMERCIAL STRATEGIES')
    lines.push('')

    intelligence.servicePeriodStrategies.forEach(period => {
      lines.push(`${period.programmeName.toUpperCase()} (${period.programmeType})`)
      lines.push(`  Hours: ${period.hours}`)
      lines.push(`  Commercial Goals:`)
      lines.push(`    - Drive Footfall: ${period.commercialGoals.drive_footfall}%`)
      lines.push(`    - Strengthen Brand: ${period.commercialGoals.strengthen_brand}%`)
      lines.push(`    - Retain Loyalty: ${period.commercialGoals.retain_regulars}%`)
      lines.push(`  Decision Timing: ${period.decisionTimingMode}`)
      
      if (period.contentAngles.length > 0) {
        lines.push(`  Content Angles (${period.contentAngles.length}):`)
        period.contentAngles.slice(0, 5).forEach(angle => {
          lines.push(`    • ${angle}`)
        })
        if (period.contentAngles.length > 5) {
          lines.push(`    ... and ${period.contentAngles.length - 5} more`)
        }
      }

      if (period.aiReasoning) {
        const reasoning = period.aiReasoning.substring(0, 200)
        lines.push(`  AI Reasoning: ${reasoning}${period.aiReasoning.length > 200 ? '...' : ''}`)
      }

      lines.push('')
    })
  }

  // Brand Voice
  if (intelligence.brandVoice) {
    const voice = intelligence.brandVoice
    lines.push('🎨 BRAND VOICE & THEMES')
    
    if (voice.personality && voice.personality.length > 0) {
      lines.push(`Personality: ${voice.personality.join(', ')}`)
    }
    if (voice.formality) lines.push(`Tone: ${voice.formality}`)
    if (voice.humor) lines.push(`Humor: ${voice.humor}`)
    
    if (voice.signatureThemes && voice.signatureThemes.length > 0) {
      lines.push(`Signature Themes: ${voice.signatureThemes.join(', ')}`)
    }

    if (voice.voiceRules && voice.voiceRules.length > 0) {
      lines.push(`Voice Rules: ${voice.voiceRules.length} rules defined`)
    }

    if (voice.gastronomicProfile) {
      const profile = voice.gastronomicProfile.substring(0, 150)
      lines.push(`Gastronomic Profile: ${profile}...`)
    }

    lines.push('')
  }

  // Menu Intelligence
  if (intelligence.menuIntelligence) {
    const menu = intelligence.menuIntelligence
    lines.push('🍽️  MENU INTELLIGENCE')
    
    if (menu.signatureDishes.length > 0) {
      lines.push(`Signature Dishes (${menu.signatureDishes.length}):`)
      menu.signatureDishes.slice(0, 8).forEach(dish => {
        lines.push(`  • ${dish}`)
      })
      if (menu.signatureDishes.length > 8) {
        lines.push(`  ... and ${menu.signatureDishes.length - 8} more`)
      }
    }

    if (menu.categories.length > 0) {
      lines.push(`Categories: ${menu.categories.slice(0, 6).join(', ')}${menu.categories.length > 6 ? '...' : ''}`)
    }

    lines.push('')
  }

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('⚠️  CONTENT STRATEGY IMPERATIVES')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('')
  lines.push('MANDATORY REQUIREMENTS:')
  lines.push('1. Generate posts covering ALL active service periods')
  lines.push('2. Align post types with commercial goals (footfall = product, brand = atmosphere)')
  lines.push('3. Leverage high-scoring location attributes (waterfront, city_center, etc.)')
  lines.push('4. Use content angles from audience segments')
  lines.push('5. Ensure variety: avoid 3+ consecutive menu item posts')
  lines.push('')
  lines.push('VALIDATION CHECKS:')
  intelligence.servicePeriodStrategies.forEach(period => {
    lines.push(`• ${period.programmeName}: Minimum 1 post per week`)
  })
  if (intelligence.locationPositioning) {
    const topScore = Object.entries(intelligence.locationPositioning.scores)
      .filter(([, score]) => score && score > 80)
      .sort(([, a], [, b]) => (b || 0) - (a || 0))[0]
    
    if (topScore) {
      lines.push(`• ${topScore[0]} positioning: Minimum 1 location/atmosphere post`)
    }
  }
  lines.push('')

  return lines.join('\n')
}
