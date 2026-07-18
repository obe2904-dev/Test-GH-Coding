import { supabase } from '../../../../lib/supabase'
import type { WeekSchedule } from '../../../../types/businessProfile'
import type { BusinessSector } from '../../../../types/businessSector'
import type { BusinessOfferingsProfile } from '../../../../types/businessOfferings'
import { normalizeMenuUrl, isPdfUrl, normalizePdfUrl } from '../../../../lib/urlNormalization'

const DEFAULT_COUNTRY = 'Danmark'

const dayMap: Record<string, string> = {
  'man': 'monday',
  'tir': 'tuesday',
  'ons': 'wednesday',
  'tor': 'thursday',
  'fre': 'friday',
  'lør': 'saturday',
  'søn': 'sunday'
}

type MenuType = 'standard' | 'special'

/**
 * Detect menu type from URL path - patterns ordered specific to generic
 */
function detectMenuTypeFromUrl(url: string): { type: MenuType; label: string } {
  const urlLower = url.toLowerCase()
  const pathMatch = urlLower.match(/\/([^\/]+)\/?$/)
  const path = pathMatch?.[1] || ''
  
  // Ordered: specific patterns first
  const patterns: Array<[string, string]> = [
    ['julefrokost', 'Julefrokost'], ['aftensmad', 'Aftenmenu'], ['take-away', 'Takeaway'],
    ['a-la-carte', 'À la carte'], ['menukort', 'Menukort'], ['vinmenu', 'Vinkort'],
    ['morgenmad', 'Morgenmad'], ['brunch', 'Brunch'], ['frokost', 'Frokost'], ['lunch', 'Frokost'],
    ['middag', 'Middag'], ['dinner', 'Middag'], ['aften', 'Aftenmenu'], ['evening', 'Aftenmenu'],
    ['cocktails', 'Cocktails'], ['cocktail', 'Cocktails'], ['drikkevarer', 'Drikkevarer'],
    ['drinks', 'Drinks'], ['vine', 'Vinkort'], ['wine', 'Vinkort'], ['vin', 'Vinkort'],
    ['beer', 'Ølkort'], ['bar', 'Barmenu'], ['ol', 'Ølkort'],
    ['desserter', 'Desserter'], ['dessert', 'Desserter'], ['forretter', 'Forretter'],
    ['hovedretter', 'Hovedretter'], ['burgers', 'Burgere'], ['burger', 'Burgere'],
    ['sandwich', 'Sandwich'], ['pizza', 'Pizza'], ['sushi', 'Sushi'], ['tapas', 'Tapas'],
    ['takeaway', 'Takeaway'], ['catering', 'Catering'], ['christmas', 'Julemenu'], ['jul', 'Julemenu'],
    ['menu', 'Menukort'], ['kort', 'Menukort']
  ]
  
  for (const [pattern, label] of patterns) {
    if (path.includes(pattern) || urlLower.includes(`/${pattern}/`)) {
      return { type: 'standard', label }
    }
  }
  
  return { type: 'standard', label: 'Menukort' }
}

export interface ProfileData {
  businessName: string
  businessSector: BusinessSector | null
  businessCategory: string
  aboutText: string
  brandVoice: string
  targetAudience: string
  bookingLink: string
  ctaPreference: string
  menuDescription: string
  phone: string
  email: string
  address: string
  postalCode: string
  city: string
  country: string
  openingHours: WeekSchedule
  businessOfferings: BusinessOfferingsProfile
  aboutUsUrl: string
  openingHoursUrl: string
  detectedMenuUrls: string[]
  websiteUrl: string
}

export async function saveBusinessProfile(data: ProfileData): Promise<void> {
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user

  if (!user) {
    throw new Error('Du skal være logget ind')
  }

  // Get business_id for this user
  const { data: businessData, error: businessFetchError } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (businessFetchError || !businessData) {
    throw new Error('Kunne ikke finde din forretning. Prøv igen.')
  }

  const businessId = (businessData as any).id

  // Update businesses table
  const { error: businessError } = await ((supabase
    .from('businesses') as any)
    .update({
      name: data.businessName.trim() || 'Min Virksomhed',
      business_type_hybrid: data.businessSector ? { primary: data.businessSector, secondary: [], hybridLabel: data.businessSector } : null,
      category: data.businessCategory.trim() || null,
      website_url: data.websiteUrl.trim() || null,
      updated_at: new Date().toISOString()
    }) as any)
    .eq('id', businessId)

  if (businessError) {
    throw new Error('Kunne ikke gemme profilen. Prøv igen.')
  }

  // Upsert business_locations table (handles both insert and update)
  const locationData = {
    business_id: businessId,
    is_primary: true,
    address_line1: data.address.trim() || null,
    postal_code: data.postalCode.trim() || null,
    city: data.city.trim() || null,
    country: data.country || DEFAULT_COUNTRY,
    phone: data.phone.trim() || null,
    email: data.email.trim() || null
  }
  
  // First try to check if a primary location exists
  const { data: existingLocation } = await (supabase
    .from('business_locations') as any)
    .select('id')
    .eq('business_id', businessId)
    .eq('is_primary', true)
    .maybeSingle()
  
  let locationError
  if (existingLocation) {
    // Update existing
    const result = await ((supabase
      .from('business_locations') as any)
      .update({
        address_line1: data.address.trim() || null,
        postal_code: data.postalCode.trim() || null,
        city: data.city.trim() || null,
        country: data.country || DEFAULT_COUNTRY,
        phone: data.phone.trim() || null,
        email: data.email.trim() || null
      }) as any)
      .eq('business_id', businessId)
      .eq('is_primary', true)
    locationError = result.error
  } else {
    // Insert new
    const result = await ((supabase
      .from('business_locations') as any)
      .insert(locationData) as any)
    locationError = result.error
  }

  if (locationError) {
    console.error('Location save error:', locationError)
    throw new Error('Kunne ikke gemme lokation. Prøv igen.')
  }

  // Upsert business_profile
  await (supabase
    .from('business_profile') as any)
    .upsert({
      business_id: businessId,
      long_description: data.aboutText?.trim() || null,
      target_audience: data.targetAudience?.trim() || null,
      menu_description: data.menuDescription?.trim() || null,
      menu_structure: data.businessOfferings?.categories?.length > 0 ? JSON.stringify(data.businessOfferings) : null,
      about_us_url: data.aboutUsUrl?.trim() || null,
      opening_hours_url: data.openingHoursUrl?.trim() || null,
      detected_menu_urls: data.detectedMenuUrls?.length > 0 ? data.detectedMenuUrls : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'business_id' })

  // Sync detected menu URLs to menu_sources table
  // Uses UPSERT with normalized_url to maintain stable source IDs
  if (data.detectedMenuUrls?.length > 0) {
    const menuSourcesToUpsert = data.detectedMenuUrls.map(url => {
      // Detect menu type from URL
      const detected = detectMenuTypeFromUrl(url)
      
      // Normalize URL for stable identity
      const normalizedUrl = isPdfUrl(url) ? normalizePdfUrl(url) : normalizeMenuUrl(url)
      
      return {
        business_id: businessId,
        source_url: url,
        normalized_url: normalizedUrl,
        source_type: 'url' as const,
        source_origin: 'ai_detected' as const,
        status: 'pending' as const,
        menu_type: detected.type,
        label: detected.label,
        created_by: user?.id,
        created_at: new Date().toISOString()
      }
    })
    
    // Upsert: if normalized_url exists for this business, update; otherwise insert
    const { error: upsertError } = await (supabase
      .from('menu_sources') as any)
      .upsert(menuSourcesToUpsert, {
        onConflict: 'business_id,normalized_url',
        ignoreDuplicates: false
      })
    
    if (upsertError) {
      console.error('Error upserting menu sources:', upsertError)
    }
  }

  // Upsert business_brand_profile
  await (supabase
    .from('business_brand_profile') as any)
    .upsert({
      business_id: businessId,
      booking_link: data.bookingLink?.trim() || null,
      cta_preference: data.ctaPreference?.trim() || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'business_id' })

  // Save opening hours
  await (supabase.from('opening_hours') as any)
    .delete()
    .eq('business_id', businessId)

  const hoursToInsert = Object.entries(data.openingHours)
    .filter(([_, hours]) => hours.open || hours.close)
    .map(([day, hours]) => ({
      business_id: businessId,
      weekday: dayMap[day],
      open_time: hours.open || null,
      close_time: hours.close || null,
      closed: !hours.open && !hours.close,
      kind: 'normal'
    }))
    .filter(item => item.weekday)

  if (hoursToInsert.length > 0) {
    await (supabase.from('opening_hours') as any).insert(hoursToInsert)
  }
}
