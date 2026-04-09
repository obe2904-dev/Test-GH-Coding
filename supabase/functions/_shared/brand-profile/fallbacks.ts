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
      value = `${foodArea}\n- STEMNING & INTERIØR: Afslappet atmosfære i ${locationName}, perfekt når man har god tid\n- FOLK & ØJEBLIKKE: Lange måltider hvor man bliver siddende, overgange fra brunch til frokost til aften`
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
export function sanitizeBannedWords(sections: any): any {
  // Always-banned words (hard-coded — these must never appear regardless of AI output)
  const DEFAULT_ALWAYS_BANNED = [
    'hyggelig', 'hyggeligt', 'lækker', 'lækkert', 'lækre',
    'indbydende', 'afslappet', 'afslappede', 'afslappende',
    'autentisk', 'autentiske', 'unik', 'unikke',
    'fantastisk', 'fantastiske', 'vidunderlig', 'vidunderlige', 'charmerende'
  ]

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

  console.log(`🧹 Sanitized ${bannedWords.length} banned words from output as last resort`)
  
  return sanitized
}