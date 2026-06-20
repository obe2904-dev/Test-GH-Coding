/**
 * Robust Fallback Pipeline
 * 
 * Multi-tier fallback system ensuring output always succeeds
 */

import type { DataSources } from './types.ts'
import type { LocaleConfig } from './locales.ts'
import { ErrorCollector, ErrorCategory, ErrorSeverity } from './errors.ts'

export interface FallbackContext {
  dataSources: DataSources
  analysis?: any
  locale: LocaleConfig
  errors: ErrorCollector
}

export enum FallbackTier {
  AI_PRIMARY = 'AI_PRIMARY',           // AI generated with all data
  AI_SIMPLIFIED = 'AI_SIMPLIFIED',     // AI with reduced prompt
  TEMPLATE_RICH = 'TEMPLATE_RICH',     // Template with rich data
  TEMPLATE_BASIC = 'TEMPLATE_BASIC',   // Template with minimal data
  HARDCODED = 'HARDCODED'             // Last resort hardcoded
}

export interface FallbackResult<T> {
  value: T
  tier: FallbackTier
  confidence: number  // 0-1
  usedFallback: boolean
  reason?: string
}

/**
 * Fallback builder for brand_essence
 */
export function buildBrandEssenceFallback(ctx: FallbackContext): FallbackResult<string> {
  const { dataSources, locale, errors } = ctx
  const business = dataSources?.business
  const location = dataSources?.location
  
  // Extract components with fallbacks
  const venueType = locale.venueTypes[business?.vertical || 'restaurant'] || 'Restaurant'
  
  // Location with city-specific phrasing
  const locationPhrase = location?.enrichment?.micro?.area_type === 'waterfront' 
    ? (locale.preferredPhrasing['location_waterfront'] || 'by the water')
    : location?.enrichment?.micro?.area_type === 'transit_hub'
    ? (locale.preferredPhrasing['location_transit'] || 'by the station')
    : ''
  
  const city = location?.enrichment?.macro?.city || business?.city || 'byen'
  
  // Build location cue - if we have locale-specific phrase with city (e.g., 'i Aarhus'), use that
  // Otherwise, construct from locationPhrase + city
  const locationCueFromLocale = locale.preferredPhrasing['location_city'] // e.g., 'i Aarhus'
  const locationCue = locationCueFromLocale && locationCueFromLocale.toLowerCase().includes(city?.toLowerCase() || '')
    ? (locationPhrase ? `${locationPhrase} ${locationCueFromLocale}` : locationCueFromLocale)
    : locationPhrase
    ? `${locationPhrase} ${locale.language === 'da' ? 'i' : locale.language === 'de' ? 'in' : 'in'} ${city}`
    : city
  
  // Offering from menu or business description
  const offering = extractOffering(dataSources, locale) || getDefaultOffering(locale)
  
  // Behavioral hook
  const behavioralHook = locale.language === 'da' 
    ? 'kan nydes i roligt tempo'
    : locale.language === 'de'
    ? 'in Ruhe genießen kann'
    : 'can be enjoyed at a relaxed pace'
  
  // Build with locale-appropriate structure
  const value = locale.language === 'da'
    ? `${venueType} ${locationCue} hvor ${offering} ${behavioralHook}.`
    : locale.language === 'de'
    ? `${venueType} ${locationCue}, wo man ${offering} ${behavioralHook}.`
    : `${venueType} at ${locationCue} where ${offering} ${behavioralHook}.`
  
  errors.add(
    ErrorCategory.AI_INSTRUCTION_FAILURE,
    ErrorSeverity.MEDIUM,
    'Used template fallback for brand_essence',
    'generation',
    { tier: FallbackTier.TEMPLATE_RICH, value }
  )
  
  return {
    value,
    tier: FallbackTier.TEMPLATE_RICH,
    confidence: 0.7,
    usedFallback: true,
    reason: 'AI did not include required location/venue elements'
  }
}

/**
 * Fallback builder for signature_shot
 */
export function buildSignatureShotFallback(ctx: FallbackContext): FallbackResult<string> {
  const { dataSources, locale, errors } = ctx
  const business = dataSources?.business
  const location = dataSources?.location
  
  // Location elements
  const locationPhrase = location?.enrichment?.micro?.area_type === 'waterfront'
    ? (locale.preferredPhrasing['location_waterfront'] || 'by the water')
    : location?.enrichment?.micro?.area_type === 'transit_hub'
    ? (locale.preferredPhrasing['location_transit'] || 'by the station')
    : ''
  
  const city = location?.enrichment?.macro?.city || business?.city || 'byen'

  const cityCue = locale.preferredPhrasing['location_city']
    || (locale.language === 'da'
      ? `i ${city}`
      : locale.language === 'de'
      ? `in ${city}`
      : `in ${city}`)

  // Location cue should already include the correct preposition (e.g., "ved åen i Aarhus" or "i Aarhus")
  const locationCue = locationPhrase ? `${locationPhrase} ${cityCue}` : cityCue
  
  // Action phrase (locale-specific)
  const actionPhrase = locale.language === 'da'
    ? 'hvor man bliver siddende længe'
    : locale.language === 'de'
    ? 'wo man lange sitzen bleibt'
    : 'where people linger'
  
  // Atmospheric element
  const atmosphere = locale.language === 'da'
    ? 'i gyldent aftenlys'
    : locale.language === 'de'
    ? 'im goldenen Abendlicht'
    : 'in golden evening light'
  
  // Offering
  const offering = extractOffering(dataSources, locale) || getDefaultOffering(locale)
  
  // Build with locale structure - locationPhrase already has preposition (e.g., "ved åen")
  // so we don't add another "ved" before it
  const value = locale.language === 'da'
    ? locationPhrase
      ? `Et bord ${locationCue} ${atmosphere}, ${actionPhrase} med ${offering} og glas på bordet.`
      : `Et bord i ${cityCue} ${atmosphere}, ${actionPhrase} med ${offering} og glas på bordet.`
    : locale.language === 'de'
    ? `Ein Tisch ${locationCue} ${atmosphere}, ${actionPhrase} mit ${offering} und Gläsern auf dem Tisch.`
    : `A table ${locationCue} ${atmosphere}, ${actionPhrase} with ${offering} and glasses on the table.`
  
  errors.add(
    ErrorCategory.AI_INSTRUCTION_FAILURE,
    ErrorSeverity.MEDIUM,
    'Used template fallback for signature_shot',
    'generation',
    { tier: FallbackTier.TEMPLATE_RICH, value }
  )
  
  return {
    value,
    tier: FallbackTier.TEMPLATE_RICH,
    confidence: 0.7,
    usedFallback: true,
    reason: 'AI did not include required location/action/hook elements'
  }
}

/**
 * Fallback builder for target_audience
 */
export function buildTargetAudienceFallback(ctx: FallbackContext): FallbackResult<string> {
  const { dataSources, locale, errors } = ctx
  const business = dataSources?.business
  
  // Detect audience from business data
  const venueType = business?.vertical || 'restaurant'
  
  let audience: string
  if (locale.language === 'da') {
    audience = venueType === 'hospitality' || venueType === 'cafe'
      ? 'Folk der sætter pris på kvalitetstid over en kop kaffe eller brunch'
      : venueType === 'bar'
      ? 'Folk der ønsker en afslappet aften med drinks og sociale oplevelser'
      : 'Folk der søger en autentisk madoplevelse i rolige omgivelser'
  } else if (locale.language === 'de') {
    audience = venueType === 'hospitality' || venueType === 'cafe'
      ? 'Menschen, die Qualitätszeit bei Kaffee oder Brunch schätzen'
      : venueType === 'bar'
      ? 'Menschen, die einen entspannten Abend mit Drinks und sozialen Erlebnissen suchen'
      : 'Menschen, die ein authentisches kulinarisches Erlebnis in ruhiger Atmosphäre suchen'
  } else {
    audience = venueType === 'hospitality' || venueType === 'cafe'
      ? 'People who appreciate quality time over coffee or brunch'
      : venueType === 'bar'
      ? 'People seeking a relaxed evening with drinks and social experiences'
      : 'People looking for an authentic dining experience in a calm atmosphere'
  }
  
  errors.add(
    ErrorCategory.AI_INSTRUCTION_FAILURE,
    ErrorSeverity.HIGH,
    'Used template fallback for target_audience',
    'generation',
    { tier: FallbackTier.TEMPLATE_BASIC, value: audience }
  )
  
  return {
    value: audience,
    tier: FallbackTier.TEMPLATE_BASIC,
    confidence: 0.5,
    usedFallback: true,
    reason: 'Target audience was generic or contained banned words'
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractOffering(dataSources: DataSources, locale: LocaleConfig): string | null {
  const menu = dataSources?.menu || []
  
  // Look for signature dishes
  const signatureDishes = menu
    .filter(item => item.name && item.name.length > 3)
    .slice(0, 3)
    .map(item => item.name)
  
  if (signatureDishes.length > 0) {
    if (locale.language === 'da') {
      return signatureDishes[0].toLowerCase()
    } else if (locale.language === 'de') {
      return signatureDishes[0]
    } else {
      return signatureDishes[0].toLowerCase()
    }
  }
  
  return null
}

function getDefaultOffering(locale: LocaleConfig): string {
  if (locale.language === 'da') {
    return 'brunch'
  } else if (locale.language === 'de') {
    return 'Brunch'
  } else {
    return 'brunch'
  }
}

/**
 * Fallback builder for tone_of_voice with proper structure
 */
export function buildToneOfVoiceFallback(ctx: FallbackContext): FallbackResult<string> {
  const { dataSources, locale, errors } = ctx
  const business = dataSources?.business
  const location = dataSources?.location
  
  const ctaPhrase = locale.preferredPhrasing['cta_book'] || 'BOOK DIT BORD'
  const city = location?.enrichment?.macro?.city || business?.city || 'byen'

  const locationPhrase = location?.enrichment?.micro?.area_type === 'waterfront'
    ? (locale.preferredPhrasing['location_waterfront'] || 'ved åen')
    : location?.enrichment?.micro?.area_type === 'transit_hub'
    ? (locale.preferredPhrasing['location_transit'] || 'ved stationen')
    : ''

  const cityCue = locale.preferredPhrasing['location_city']
    || (locale.language === 'da'
      ? `i ${city}`
      : locale.language === 'de'
      ? `in ${city}`
      : `in ${city}`)

  // Match validator expectation for distinctive hook presence (e.g., "ved åen i Aarhus")
  const canonicalHook = locationPhrase ? `${locationPhrase} ${cityCue}` : cityCue
  
  let value: string
  if (locale.language === 'da') {
    // NOTE: Removed "indbydende" and "generic" to avoid banned words
    value = `Skriv i en rolig tone der matcher det afslappede tempo.\n\n- Undgå tomt markedsførings-sprog\n- Fokusér på konkrete detaljer (retter, stemning, tid på dagen)\n- Brug "${ctaPhrase}" når bordbestilling nævnes\n- Brug beliggenheden (${canonicalHook}) som et konkret anker, når det passer\n- Hold sproget naturligt og jordnært\n\nEksempel: "Nyd brunch ${canonicalHook} i dit eget tempo"\nEksempel: "Perfekt når du har god tid til at blive siddende"\nEksempel: "Start med brunch, bliv til aften"`
  } else if (locale.language === 'de') {
    value = `Schreiben Sie in einem ruhigen, einladenden Ton, der zum entspannten Tempo passt.\n\n- Vermeiden Sie leere Marketing-Sprache\n- Fokussieren Sie auf konkrete Details (Gerichte, Atmosphäre, Tageszeit)\n- Verwenden Sie "${ctaPhrase}" bei Tischreservierungen\n- Nutzen Sie den Ort (${canonicalHook}) als konkreten Anker, wenn es passt\n- Halten Sie die Sprache natürlich und bodenständig\n\nBeispiel: "Genießen Sie Brunch ${canonicalHook} in Ihrem eigenen Tempo"\nBeispiel: "Perfekt, wenn Sie Zeit haben, länger zu bleiben"\nBeispiel: "Beginnen Sie mit Brunch, bleiben Sie bis zum Abend"`
  } else {
    value = `Write in a calm, inviting tone that matches the relaxed pace.\n\n- Avoid empty marketing language\n- Focus on concrete details (dishes, atmosphere, time of day)\n- Use "${ctaPhrase}" for table reservations\n- Use the location (${canonicalHook}) as a concrete anchor when it fits\n- Keep language natural and down-to-earth\n\nExample: "Enjoy brunch ${canonicalHook} at your own pace"\nExample: "Perfect when you have time to linger"\nExample: "Start with brunch, stay through evening"`
  }

  
  // Sanitize against any remaining banned words (defensive programming)
  // Note: removeBannedWords is available in this file but requires banned list
  // For now, manual removal of "indbydende" above is sufficient
  
  errors.add(
    ErrorCategory.AI_INSTRUCTION_FAILURE,
    ErrorSeverity.MEDIUM,
    'Used template fallback for tone_of_voice',
    'generation',
    { tier: FallbackTier.TEMPLATE_RICH, value }
  )
  
  return {
    value,
    tier: FallbackTier.TEMPLATE_RICH,
    confidence: 0.7,
    usedFallback: true,
    reason: 'AI did not include proper structure (bullets + examples)'
  }
}

/**
 * Fallback builder for content_focus with 3 required areas
 */
export function buildContentFocusFallback(ctx: FallbackContext): FallbackResult<string> {
  const { dataSources, locale, errors } = ctx
  const business = dataSources?.business
  const location = dataSources?.location
  
  const menu = dataSources?.menu || []
  const hasFood = menu.length > 0
  const locationName = location?.enrichment?.macro?.city || business?.city || 'stedet'
  
  let value: string
  if (locale.language === 'da') {
    const foodArea = hasFood 
      ? '- MAD & SERVICE: Klassiske retter serveret i roligt tempo, hvor man kan nyde måltidet uden stress'
      : '- MAD & SERVICE: Kvalitetsmad serveret i afslappede omgivelser'
      value = `${foodArea}\n- STEMNING & OPLEVELSE: Afslappet stemning og oplevelse i ${locationName}, perfekt når man har god tid\n- FOLK & ØJEBLIKKE: Lange måltider hvor man bliver siddende, overgange fra brunch til frokost til aften`
  } else if (locale.language === 'de') {
    const foodArea = hasFood
      ? '- ESSEN & SERVICE: Klassische Gerichte in entspanntem Tempo serviert, wo man die Mahlzeit ohne Stress genießen kann'
      : '- ESSEN & SERVICE: Qualitätsessen in entspannter Umgebung serviert'
    value = `${foodArea}\n- ATMOSPHÄRE & INTERIEUR: Entspannte Atmosphäre in ${locationName}, perfekt wenn man Zeit hat\n- MENSCHEN & MOMENTE: Lange Mahlzeiten wo man sitzen bleibt, Übergänge von Brunch zu Mittag zu Abend`
  } else {
    const foodArea = hasFood
      ? '- FOOD & SERVICE: Classic dishes served at a relaxed pace, where you can enjoy the meal without stress'
      : '- FOOD & SERVICE: Quality food served in relaxed surroundings'
    value = `${foodArea}\n- ATMOSPHERE & INTERIOR: Relaxed atmosphere at ${locationName}, perfect when you have time\n- PEOPLE & MOMENTS: Long meals where people linger, transitions from brunch to lunch to evening`
  }
  
  errors.add(
    ErrorCategory.AI_INSTRUCTION_FAILURE,
    ErrorSeverity.MEDIUM,
    'Used template fallback for content_focus',
    'generation',
    { tier: FallbackTier.TEMPLATE_RICH, value }
  )
  
  return {
    value,
    tier: FallbackTier.TEMPLATE_RICH,
    confidence: 0.7,
    usedFallback: true,
    reason: 'AI did not include 3 required focus areas'
  }
}

/**
 * Fallback builder for content_strategy (goal_blend + content_category_weights)
 * 
 * Deterministic generation based on objective business signals:
 * - Maturity (review count, founding date, social history)
 * - Archetype (cafe_bar, fine_dining, bakery, etc.)
 * - Service complexity (multi-programme vs single-focus)
 * - Location type (waterfront, downtown, residential)
 * 
 * This ensures every business gets a content_strategy regardless of AI generation.
 */
export function buildContentStrategyFallback(ctx: FallbackContext): FallbackResult<any> {
  const { dataSources, locale, errors } = ctx
  const business = dataSources?.business
  const operations = dataSources?.operations
  const location = dataSources?.location
  const locationIntel = dataSources?.locationIntelligenceRow
  const profile = dataSources?.profile
  
  // ===== MATURITY CLASSIFICATION =====
  // emerging (0-18mo), growing (18mo-5yr), established (5yr+)
  const reviewCount = business?.review_count || 0
  const foundingYear = business?.founding_date ? new Date(business.founding_date).getFullYear() : null
  const currentYear = new Date().getFullYear()
  const yearsOperating = foundingYear ? currentYear - foundingYear : null
  
  let maturity: 'emerging' | 'growing' | 'established' = 'growing'  // Default when evidence is sparse
  if (yearsOperating !== null) {
    if (yearsOperating < 1.5) maturity = 'emerging'
    else if (yearsOperating >= 5) maturity = 'established'
    else maturity = 'growing'
  } else if (reviewCount > 0) {
    // Fallback to review count when founding date unavailable
    if (reviewCount < 50) maturity = 'emerging'
    else if (reviewCount >= 200) maturity = 'established'
    else maturity = 'growing'
  }
  
  // ===== SERVICE COMPLEXITY =====
  // Multi-programme businesses (brunch+lunch+dinner+bar) are always footfall-led
  const menuSummaries = dataSources?.menuSummaries || []
  const programmeTitles = menuSummaries.map((m: any) => m.title?.toLowerCase() || '')
  const hasBrunch = programmeTitles.some((t: string) => /brunch/i.test(t))
  const hasLunch = programmeTitles.some((t: string) => /frokost|lunch/i.test(t)) || operations?.service_breakfast_lunch
  const hasDinner = programmeTitles.some((t: string) => /aftensmad|middag|dinner/i.test(t)) || operations?.service_dinner
  const hasBar = programmeTitles.some((t: string) => /bar|drinks|cocktails/i.test(t))
  const programmeCount = [hasBrunch, hasLunch, hasDinner, hasBar].filter(Boolean).length
  const isMultiProgramme = programmeCount >= 3
  
  // ===== LOCATION TYPE =====
  const areaType = location?.enrichment?.micro?.area_type || locationIntel?.area_type
  const isWaterfront = areaType === 'waterfront' || /waterfront|water/i.test(String(locationIntel?.neighborhood || ''))
  const isDestination = isWaterfront || areaType === 'tourist' || (locationIntel?.category_scores?.tourist || 0) >= 70
  
  // ===== ARCHETYPE =====
  const businessType = operations?.establishment_type || business?.business_type || profile?.business_category || 'cafe'
  const archetype = businessType.toLowerCase()
  
  // ===== CONCEPT DISTINCTIVENESS =====
  // commodity (standard café/pizza/burger), distinctive_concept (strong narrative), destination_experience (location IS product)
  let conceptType: 'commodity' | 'distinctive_concept' | 'destination_experience' = 'commodity'
  if (isDestination || isMultiProgramme) {
    conceptType = 'destination_experience'
  } else if (archetype.includes('fine_dining') || archetype.includes('michelin') || (profile?.price_level >= 3)) {
    conceptType = 'distinctive_concept'
  }
  
  // ===== GOAL BLEND CALCULATION =====
  let drive_footfall = 50
  let build_brand = 30
  let retain_loyalty = 20
  
  if (maturity === 'emerging') {
    // Emerging: focus on awareness + brand building, minimal loyalty (no audience yet)
    drive_footfall = 40
    build_brand = 45
    retain_loyalty = 15
  } else if (maturity === 'growing') {
    if (conceptType === 'destination_experience' || isMultiProgramme) {
      // Growing + destination/multi-programme: footfall-led
      drive_footfall = 55
      build_brand = 25
      retain_loyalty = 20
    } else if (conceptType === 'distinctive_concept') {
      // Growing + distinctive: brand-led
      drive_footfall = 35
      build_brand = 45
      retain_loyalty = 20
    } else {
      // Growing + commodity: balanced
      drive_footfall = 45
      build_brand = 30
      retain_loyalty = 25
    }
  } else {
    // Established
    if (conceptType === 'destination_experience' || isMultiProgramme) {
      // Established + destination/multi: still footfall-led (different audiences per programme)
      drive_footfall = 40
      build_brand = 20
      retain_loyalty = 40
    } else if (archetype.includes('neighborhood') || archetype.includes('local')) {
      // Established + neighborhood: loyalty-led
      drive_footfall = 30
      build_brand = 20
      retain_loyalty = 50
    } else {
      // Established + other: balanced with loyalty emphasis
      drive_footfall = 35
      build_brand = 20
      retain_loyalty = 45
    }
  }
  
  // Ensure sum to 100
  const sum = drive_footfall + build_brand + retain_loyalty
  if (sum !== 100) {
    const diff = 100 - sum
    drive_footfall += diff  // Adjust primary goal
  }
  
  const primary_goal = drive_footfall >= build_brand && drive_footfall >= retain_loyalty
    ? 'drive_footfall'
    : build_brand >= retain_loyalty
    ? 'build_brand'
    : 'retain_loyalty'
  
  // ===== CONTENT CATEGORY WEIGHTS =====
  // product_menu, craving_visual, behind_scenes, team_people
  let product_menu = 35
  let craving_visual = 30
  let behind_scenes = 20
  let team_people = 15
  
  if (conceptType === 'destination_experience') {
    // Destination: atmosphere is the product
    craving_visual += 10
    product_menu -= 5
    behind_scenes -= 5
  } else if (conceptType === 'distinctive_concept') {
    // Distinctive: narrative is differentiator
    behind_scenes += 10
    product_menu -= 5
    craving_visual -= 5
  }
  
  if (maturity === 'established') {
    // Established: people are the loyalty anchor
    team_people += 5
    product_menu -= 5
  }
  
  // Simple café/bakery adjustment: ONLY for single-focus commodity venues
  // Exclude hybrids (café-bar, multi-programme) which are already handled by conceptType
  if ((archetype.includes('bakery') || archetype.includes('cafe')) && conceptType === 'commodity' && !isMultiProgramme) {
    // Pure bakery/café: product visuals matter more
    product_menu += 5
    craving_visual += 5
    behind_scenes -= 5
    team_people -= 5
  }
  
  // Normalize to 100
  const ccwSum = product_menu + craving_visual + behind_scenes + team_people
  if (ccwSum !== 100) {
    const factor = 100 / ccwSum
    product_menu = Math.round(product_menu * factor)
    craving_visual = Math.round(craving_visual * factor)
    behind_scenes = Math.round(behind_scenes * factor)
    team_people = Math.round(team_people * factor)
    // Fix rounding error
    const diff = 100 - (product_menu + craving_visual + behind_scenes + team_people)
    product_menu += diff
  }
  
  // ===== SIGNALS, ANCHORS, HOOKS =====
  const cityName = location?.enrichment?.macro?.city || business?.city || 'byen'
  const waterType = locale.preferredPhrasing?.['location_waterfront'] || 'ved vandet'
  
  const footfall_signals = []
  if (hasBrunch) footfall_signals.push('weekend brunch service')
  if (hasLunch) footfall_signals.push('weekday lunch crowd')
  if (hasDinner) footfall_signals.push('evening dining service')
  if (operations?.has_outdoor_seating) footfall_signals.push('outdoor seating')
  if (isWaterfront) footfall_signals.push(waterType)
  
  const brand_anchors = []
  if (isWaterfront) brand_anchors.push(`${waterType} i ${cityName}`)
  if (operations?.has_takeaway) brand_anchors.push('takeaway service')
  if (profile?.price_level >= 3) brand_anchors.push('premium offering')
  if (conceptType === 'distinctive_concept') brand_anchors.push('distinctive concept')
  
  const loyalty_hooks = []
  if (maturity === 'established') {
    loyalty_hooks.push('stamgæster')
    loyalty_hooks.push('kendt personale')
    if (hasBrunch) loyalty_hooks.push('brunch-ritualet')
  } else if (maturity === 'growing') {
    loyalty_hooks.push('gentagende gæster')
    if (operations?.weekly_programme) loyalty_hooks.push('recurring events')
  } else {
    // Emerging: forward-looking
    loyalty_hooks.push('brunch-ritualet vi bygger')
    loyalty_hooks.push('de første stamgæster')
  }
  
  const value = {
    primary_goal,
    goal_blend: {
      drive_footfall,
      build_brand,
      retain_loyalty
    },
    footfall_signals: footfall_signals.length > 0 ? footfall_signals : ['general service'],
    brand_anchors: brand_anchors.length > 0 ? brand_anchors : ['quality offerings'],
    loyalty_hooks: loyalty_hooks.length > 0 ? loyalty_hooks : ['repeat visits'],
    content_category_weights: {
      product_menu,
      craving_visual,
      behind_scenes,
      team_people
    }
  }
  
  errors.add(
    ErrorCategory.AI_INSTRUCTION_FAILURE,
    ErrorSeverity.MEDIUM,
    'Used deterministic fallback for content_strategy',
    'generation',
    { tier: FallbackTier.TEMPLATE_RICH, maturity, conceptType, archetype, value }
  )
  
  return {
    value,
    tier: FallbackTier.TEMPLATE_RICH,
    confidence: 0.8,
    usedFallback: true,
    reason: 'AI did not generate content_strategy field'
  }
}

/**
 * Remove banned words from text (locale-aware)
 */
export function removeBannedWords(text: string, locale: LocaleConfig): string {
  if (typeof text !== 'string') return text  // Guard: non-string values pass through unchanged
  let cleaned = text
  
  locale.bannedWords.forEach(word => {
    const re = new RegExp(`\\b${word}\\b`, 'gi')
    cleaned = cleaned.replace(re, '')
  })
  
  // Collapse horizontal whitespace only — preserve newlines so structured fields
  // (e.g. tone_of_voice bullet lists) are not linearized into one line
  cleaned = cleaned.replace(/[^\S\n]+/g, ' ')
  
  // Strip orphaned conjunctions left when a word was the only item after/before one
  // e.g. "uformel og venlig" where "venlig" is banned → "uformel og" → "uformel"
  cleaned = cleaned.split('\n').map(line =>
    line
      .replace(/\s+(og|men|eller)\s*$/i, '')  // dangling conjunction at end of line
      .replace(/^\s*(og|men|eller)\s+/i, '')  // dangling conjunction at start of line
      .trim()
  ).join('\n').trim()
  
  return cleaned
}
/**
 * Sanitize sections by removing words listed in things_to_avoid.language_constraints
 * 
 * v4.8.8 Task 1: Last resort sanitization when AI repair fails
 * This silently removes banned words that appear in other fields
 * 
 * @param sections - Brand profile sections
 * @returns Sanitized sections
 */
// Shared constant — used by both sanitizeString() and sanitizeBannedWords()
const ALWAYS_BANNED_WORDS = [
  // HARD list — hyperbolic/generic, never allowed
  'uforglemmelig', 'uforglemmelige',
  'magisk', 'magiske',
  'gastronomisk', 'gastronomiske',
  'udsøgt', 'udsøgte',
  'forkæle', 'forkæler', 'forkælet',
  'gode stunder',
  // SOFT list — generic marketing words
  'hyggelig', 'hyggeligt', 'lækker', 'lækkert', 'lækre',
  'indbydende', 'afslappet', 'afslappede', 'afslappende',
  'autentisk', 'autentiske', 'unik', 'unikke',
  'fantastisk', 'fantastiske', 'vidunderlig', 'vidunderlige', 'charmerende'
]

/**
 * Sanitizes a single string by removing always-banned words.
 * Use for fields not covered by sanitizeBannedWords() sections loop (e.g., B3/B4 outputs).
 */
export function sanitizeString(text: string): string {
  if (!text || typeof text !== 'string') return text
  let cleaned = text
  ALWAYS_BANNED_WORDS.forEach(word => {
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi')
    cleaned = cleaned.replace(regex, '')
  })
  cleaned = cleaned.replace(/[^\S\n]+/g, ' ')
  cleaned = cleaned.split('\n').map(line =>
    line.replace(/\s+(og|men|eller)\s*$/i, '').replace(/^\s*(og|men|eller)\s+/i, '').trim()
  ).join('\n').trim()
  return cleaned
}

export function sanitizeBannedWords(sections: any): any {
  // Always-banned words (hard-coded — these must never appear regardless of AI output)
  // Keep in sync with HARD_BANNED_WORDS_DA in brand-word-lists.ts
  const DEFAULT_ALWAYS_BANNED = ALWAYS_BANNED_WORDS

  // Also use AI-generated language_constraints if available
  const thingsToAvoid = sections?.things_to_avoid
  const languageConstraints = thingsToAvoid?.value?.language_constraints || thingsToAvoid?.language_constraints || []
  const aiBannedWords = Array.isArray(languageConstraints)
    ? languageConstraints.filter(Boolean).map((w: any) => String(w).trim()).filter((w: string) => w.length > 0)
    : []

  const bannedWords = [...new Set([...DEFAULT_ALWAYS_BANNED, ...aiBannedWords])]

  if (bannedWords.length === 0) {
    return sections
  }
  
  // Helper to sanitize a text field
  const sanitizeText = (text: string | undefined | null): string | undefined => {
    if (!text || typeof text !== 'string') return text || undefined
    
    let cleaned = text
    bannedWords.forEach(word => {
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi')
      cleaned = cleaned.replace(regex, '')
    })
    
    // Collapse horizontal whitespace only — preserve newlines so structured fields retain their format
    cleaned = cleaned.replace(/[^\S\n]+/g, ' ')
    
    // Strip orphaned conjunctions left by word removal
    // e.g. "uformel og venlig" where "venlig" is stripped → "uformel og" → "uformel"
    cleaned = cleaned.split('\n').map(line =>
      line
        .replace(/\s+(og|men|eller)\s*$/i, '')  // dangling at end
        .replace(/^\s*(og|men|eller)\s+/i, '')  // dangling at start
        .trim()
    ).join('\n').trim()
    
    return cleaned
  }
  
  // Create a deep copy and sanitize all text fields
  const sanitized = { ...sections }
  
  // Handle fields that can be either strings or objects with value property
  const fieldNames = [
    'brand_essence',
    'brand_essence_elaboration',
    'core_offerings',
    'target_audience',
    'tone_of_voice',
    'content_focus',
    'communication_goal',
    'cta_style'
  ]
  
  fieldNames.forEach(fieldName => {
    const field = sanitized[fieldName]
    if (!field) return
    
    if (typeof field === 'string') {
      sanitized[fieldName] = sanitizeText(field)
    } else if (typeof field === 'object' && field.value) {
      sanitized[fieldName] = {
        ...field,
        value: sanitizeText(field.value)
      }
    }
  })
  
  // Handle signature_shot (nested in image_preferences)
  if (sanitized.image_preferences?.signature_shot) {
    sanitized.image_preferences = {
      ...sanitized.image_preferences,
      signature_shot: sanitizeText(sanitized.image_preferences.signature_shot)
    }
  }

  // Handle voice_examples.do_say — display-only phrases shown to the business owner.
  // Banned words must not appear as "suggested phrases". dont_say is intentionally wrong-register
  // so we do NOT sanitize it: stripping banned words from "phrases to avoid" would be misleading.
  if (sanitized.voice_examples?.do_say && Array.isArray(sanitized.voice_examples.do_say)) {
    const cleanedDoSay = sanitized.voice_examples.do_say
      .map((phrase: any) => (typeof phrase === 'string' ? sanitizeText(phrase) : phrase))
      .filter((phrase: any) => typeof phrase === 'string' && phrase.trim().length > 5)
    if (cleanedDoSay.length !== sanitized.voice_examples.do_say.length) {
      console.log(`🧹 voice_examples.do_say: removed ${sanitized.voice_examples.do_say.length - cleanedDoSay.length} phrase(s) containing banned words`)
    }
    sanitized.voice_examples = {
      ...sanitized.voice_examples,
      do_say: cleanedDoSay
    }
  }

  // Handle tone_model.good_examples — these feed the caption AI directly as style examples.
  // Banned words here will propagate into every generated caption.
  if (sanitized.tone_model?.good_examples && Array.isArray(sanitized.tone_model.good_examples)) {
    const cleanedExamples = sanitized.tone_model.good_examples
      .map((ex: any) => (typeof ex === 'string' ? sanitizeText(ex) : ex))
      .filter((ex: any) => typeof ex === 'string' && ex.trim().length > 5)
    if (cleanedExamples.length !== sanitized.tone_model.good_examples.length) {
      console.log(`🧹 tone_model.good_examples: removed ${sanitized.tone_model.good_examples.length - cleanedExamples.length} example(s) containing banned words`)
    }
    sanitized.tone_model = {
      ...sanitized.tone_model,
      good_examples: cleanedExamples
    }
  }

  console.log(`🧹 Sanitized ${bannedWords.length} banned words from output as last resort`)
  
  return sanitized
}