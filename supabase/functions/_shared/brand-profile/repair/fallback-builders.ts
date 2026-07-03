/**
 * Fallback Builders
 * 
 * Functions that generate deterministic fallback values when AI fails to produce valid output.
 * Locale-aware and based on structured data from business profile, menu, location, etc.
 */

import type { DataSources, LanguageConfig, FeatureScore } from '../types.ts'
import { getPhrasesForLocale } from '../../i18n/index.ts'
import { canonicalizeProgrammes } from '../../canonical-programmes.ts'  // Task 3.2 - Fixed path
import { resolveLocationPhrase } from '../location-phrase-resolver.ts'
import { resolveLocale } from '../locales.ts'

// Helper to extract structured website data
function extractStructuredWebsiteData(websiteAnalysis: any, business: any) {
  // Simplified - real implementation would be more complex
  return {
    metaTitles: websiteAnalysis?.meta_titles || [],
    metaDescriptions: websiteAnalysis?.meta_descriptions || [],
    headers: websiteAnalysis?.headers || [],
    heroTexts: websiteAnalysis?.hero_texts || [],
    aboutSnippets: websiteAnalysis?.about_snippets || [],
    imageAltSignals: websiteAnalysis?.image_alt_texts || [],
    imageCaptions: websiteAnalysis?.image_captions || [],
    uniqueNounCues: websiteAnalysis?.unique_nouns || [],
    ctaTexts: websiteAnalysis?.cta_texts || [],
    valuePhrases: websiteAnalysis?.value_phrases || [],
    menuCategoriesMentioned: websiteAnalysis?.menu_categories || [],
    aboutTone: websiteAnalysis?.about_tone || '',
    rawExcerpt: websiteAnalysis?.raw_excerpt || ''
  }
}

// ============================================================================
// BUSINESS TYPE DETECTION
// ============================================================================

type BusinessType = 
  | 'WINE_BAR' 
  | 'SPECIALTY_COFFEE' 
  | 'HYBRID_MULTI_PROGRAMME' 
  | 'RESTAURANT' 
  | 'CAFE'
  | 'SIMPLE_BAR'

function detectBusinessType(dataSources: DataSources): BusinessType {
  const programmes = (dataSources as any)?.menuSignalProgrammes || []
  const ops = (dataSources as any)?.operations || {}
  const hours = (dataSources as any)?.openingHoursRows || []
  const business = (dataSources as any)?.business || {}
  
  const parseHour = (timeStr: string): number => {
    if (!timeStr) return 12
    const h = parseInt(timeStr.split(':')[0], 10)
    return isNaN(h) ? 12 : h
  }
  
  // Wine bar signals
  const hasWineProgramme = programmes.some((p: any) => /vin|wine/i.test(p.role))
  const noMealProgrammes = !programmes.some((p: any) => /brunch|frokost|aftensmad|middag|lunch|dinner/i.test(p.role))
  const eveningOnly = hours.length > 0 && hours.every((h: any) => parseHour(h.open_time) >= 14)
  if (hasWineProgramme && (noMealProgrammes || eveningOnly)) {
    return 'WINE_BAR'
  }
  
  // Coffee shop signals
  const hasCoffeeProgramme = programmes.some((p: any) => /kaffe|coffee/i.test(p.role))
  const earlyClose = hours.some((h: any) => parseHour(h.close_time) <= 18)
  const singleOrTwoProgrammes = programmes.length <= 2
  if (singleOrTwoProgrammes && hasCoffeeProgramme && earlyClose && !noMealProgrammes) {
    return 'SPECIALTY_COFFEE'
  }
  
  // Hybrid multi-programme (3+ programmes OR early morning + late night)
  const hasEarlyMorning = hours.some((h: any) => parseHour(h.open_time) <= 9)
  const hasLateNight = hours.some((h: any) => {
    const closeHour = parseHour(h.close_time)
    return closeHour >= 23 || (closeHour >= 0 && closeHour <= 6)
  })
  if (programmes.length >= 3 || (hasEarlyMorning && hasLateNight && programmes.length >= 2)) {
    return 'HYBRID_MULTI_PROGRAMME'
  }
  
  // Restaurant signals
  const hasDinner = programmes.some((p: any) => /aften|middag|dinner/i.test(p.role))
  const hasTableService = ops.has_table_service
  if (hasDinner && hasTableService) {
    return 'RESTAURANT'
  }
  
  // Simple bar (no food programmes, just drinks)
  const hasDrinksProgramme = programmes.some((p: any) => /cocktail|drink|bar|øl|beer/i.test(p.role))
  if (hasDrinksProgramme && noMealProgrammes && !hasWineProgramme) {
    return 'SIMPLE_BAR'
  }
  
  // Default: café
  return 'CAFE'
}

// ============================================================================
// DETERMINISTIC BUSINESS CHARACTER BUILDER (v5.0 - Replaces AI generation)
// ============================================================================

/**
 * Build business_character deterministically from structured data.
 * Routes to appropriate template based on business type detection.
 * 
 * This is the PRIMARY generator - AI output is deprecated and will be overwritten.
 * v5.0: Moved from fallback to primary generation path.
 */
export function buildBusinessCharacterDeterministic(dataSources: DataSources, analysis: any, language: LanguageConfig): string {
  const businessType = detectBusinessType(dataSources)
  
  switch (businessType) {
    case 'WINE_BAR':
      return buildWineBarNarrative(dataSources, language)
    
    case 'SPECIALTY_COFFEE':
      return buildCoffeeShopDescription(dataSources, language)
    
    case 'HYBRID_MULTI_PROGRAMME':
      return buildHybridNarrative(dataSources, language)
    
    case 'RESTAURANT':
      return buildRestaurantDescription(dataSources, language)
    
    case 'SIMPLE_BAR':
      return buildBarDescription(dataSources, language)
    
    case 'CAFE':
    default:
      return buildCafeDescription(dataSources, language)
  }
}

/**
 * Legacy fallback (deprecated - use buildBusinessCharacterDeterministic instead)
 * Kept for backwards compatibility during migration.
 */
export function buildBusinessCharacterFallback(dataSources: DataSources, analysis: any, language: LanguageConfig): string {
  return buildBusinessCharacterDeterministic(dataSources, analysis, language)
}

// ============================================================================
// TEMPLATE BUILDERS (Type-Specific)
// ============================================================================

// Helper functions
function parseHour(timeStr: string): number {
  if (!timeStr) return 12
  const h = parseInt(timeStr.split(':')[0], 10)
  return isNaN(h) ? 12 : h
}

/**
 * Get location phrase with proper priority hierarchy.
 * Uses centralized resolver to ensure businesses.local_location_reference is respected.
 */
function getLocationPhrase(dataSources: DataSources, language?: LanguageConfig): string {
  const business = (dataSources as any)?.business || {}
  const location = (dataSources as any)?.location || {}
  
  // Resolve locale for fallback logic
  const country = location?.country || business?.country
  const city = location?.city || business?.city
  const langCode = language?.code || language?.language || 'da'
  const locale = resolveLocale(country, city, langCode)
  
  // Use centralized resolver
  const result = resolveLocationPhrase(dataSources, locale, { includePreposition: true })
  
  return result.phrase
}

function deriveVenueRoles(programmes: any[]): string {
  const roles: string[] = []
  const hasBreakfast = programmes.some(p => /brunch|morgen|breakfast/i.test(p.role))
  const hasLunch = programmes.some(p => /frokost|lunch/i.test(p.role))
  const hasDinner = programmes.some(p => /aften|middag|dinner/i.test(p.role))
  const hasCocktails = programmes.some(p => /cocktail|drink|bar/i.test(p.role))
  const hasWine = programmes.some(p => /vin|wine/i.test(p.role))
  
  if (hasBreakfast || hasLunch) roles.push('café')
  if (hasDinner || programmes.length >= 3) roles.push('restaurant')
  if (hasCocktails || hasWine) roles.push('bar')
  
  if (roles.length === 0) {
    return 'café' // Default fallback
  }
  
  return roles.length > 1 
    ? roles.slice(0, -1).join(', ') + ' og ' + roles[roles.length - 1]
    : roles[0]
}

function getSpecificDishes(dataSources: DataSources, programme?: string, count: number = 2): string[] {
  const menu = (dataSources as any)?.menu || []
  let dishes = menu
    .filter((item: any) => item.name && item.name.length > 2)
    .map((item: any) => item.name)
  
  if (programme) {
    const programmeItems = menu.filter((item: any) => 
      item.programme && new RegExp(programme, 'i').test(item.programme)
    )
    if (programmeItems.length > 0) {
      dishes = programmeItems.map((item: any) => item.name)
    }
  }
  
  return dishes.slice(0, count)
}

/**
 * HYBRID MULTI-PROGRAMME NARRATIVE (3-4 sentences)
 * For complex venues with multiple programmes and/or day-to-night transitions
 */
function buildHybridNarrative(dataSources: DataSources, language: LanguageConfig): string {
  const programmes = (dataSources as any)?.menuSignalProgrammes || []
  const hours = (dataSources as any)?.openingHoursRows || []
  const ops = (dataSources as any)?.operations || {}
  const location = getLocationPhrase(dataSources, language)
  const roles = deriveVenueRoles(programmes)
  
  const sentences: string[] = []
  
  // S1: Identity + Core Programmes (lowercase, natural language)
  const progNames = programmes
    .map((p: any) => {
      const role = String(p.role || '').toLowerCase()
      // Map common programme abbreviations to full terms
      return role === 'aften' ? 'aftensmad' : role
    })
    .join(', ')
  const locationPart = location ? ` ${location}` : ''
  sentences.push(`${roles.charAt(0).toUpperCase() + roles.slice(1)}${locationPart}, der tilbyder ${progNames}.`)
  
  // S2: Programme Detail (pick most data-rich)
  const frokostProg = programmes.find((p: any) => /frokost|lunch/i.test(p.role))
  const detailProg = frokostProg || programmes.find((p: any) => (p.items?.length || 0) > 0) || programmes[0]
  
  if (detailProg && detailProg.items && detailProg.items.length >= 2) {
    const dishes = detailProg.items.slice(0, 2).map((d: string) => d.toLowerCase()).join(' og ')
    const progName = String(detailProg.role || '').toLowerCase()
    const progLabel = progName === 'aften' ? 'aftensmad' : progName
    sentences.push(`${progLabel.charAt(0).toUpperCase() + progLabel.slice(1)} inkluderer retter som ${dishes}.`)
  }
  
  // S3: Secondary Features (avoid duplication with S1 programme names)
  const features: string[] = []
  const alreadyMentionedBornemenu = programmes.some((p: any) => /børnemenu/i.test(p.role))
  const alreadyMentionedCocktails = programmes.some((p: any) => /cocktail/i.test(p.role))
  
  if (ops.has_kids_menu && !alreadyMentionedBornemenu) features.push('børnemenu')
  // Only add cocktailmenu if there's evidence of cocktails but it's not already a programme name
  const hasCocktailEvidence = programmes.some((p: any) => /drink|bar/i.test(p.role)) || ops.has_bar_service
  if (hasCocktailEvidence && !alreadyMentionedCocktails) features.push('cocktailmenu')
  
  // S4: Operational Facts (hours, outdoor, takeaway)
  const ops_facts: string[] = []
  const weekendRow = hours.find((h: any) => /friday|saturday|lørdag|fredag/i.test(h.weekday))
  if (weekendRow) {
    const closeHour = parseHour(weekendRow.close_time)
    // Late night: either closes after 23:00 OR closes in early morning (00:00-06:00)
    const isLateNight = closeHour >= 23 || closeHour <= 6
    if (isLateNight) {
      ops_facts.push(`åbent til kl. ${weekendRow.close_time.substring(0, 5)} i weekenden`)
    }
  }
  if (ops.has_outdoor_seating) ops_facts.push('med udendørs siddepladser')
  if (ops.has_takeaway) ops_facts.push('mulighed for takeaway')
  
  // Combine S3 (features) + S4 (ops_facts) into one sentence if both exist
  // Features use 'og' as last connector, ops_facts use only commas
  if (features.length > 0 || ops_facts.length > 0) {
    const parts: string[] = []
    
    // Add features with proper 'og' connector
    if (features.length > 0) {
      const featureText = features.length === 1
        ? features[0]
        : features.slice(0, -1).join(', ') + ' og ' + features[features.length - 1]
      parts.push(featureText)
    }
    
    // Add ops_facts with comma separators only
    if (ops_facts.length > 0) {
      parts.push(...ops_facts)
    }
    
    // Join all parts with commas
    const text = parts.join(', ')
    sentences.push(`Stedet har også ${text}.`)
  }
  
  return sentences.join(' ')
}

/**
 * SIMPLE CAFÉ DESCRIPTION (1-2 sentences)
 * For straightforward day-time cafés with 1-2 programmes
 */
function buildCafeDescription(dataSources: DataSources, language: LanguageConfig): string {
  const programmes = (dataSources as any)?.menuSignalProgrammes || []
  const ops = (dataSources as any)?.operations || {}
  const hours = (dataSources as any)?.openingHoursRows || []
  const location = getLocationPhrase(dataSources, language)
  
  const progNames = programmes.length > 0 
    ? programmes.map((p: any) => p.role).join(' og ')
    : 'kaffe og mad'
  
  const locationPart = location ? ` ${location}` : ''
  const features: string[] = []
  
  if (ops.has_outdoor_seating) features.push('udendørs siddepladser')
  if (ops.has_takeaway) features.push('takeaway')
  
  const earlyHour = hours.length > 0 
    ? Math.min(...hours.map(h => parseHour(h.open_time)))
    : null
  
  if (earlyHour && earlyHour <= 8) {
    features.push(`åbent fra kl. ${String(earlyHour).padStart(2, '0')}.00`)
  }
  
  const featurePart = features.length > 0 ? `, ${features.join(' og ')}` : ''
  
  return `Café${locationPart} med ${progNames}${featurePart}.`
}

/**
 * RESTAURANT DESCRIPTION
 * Adapts between simple and narrative based on data richness
 */
function buildRestaurantDescription(dataSources: DataSources, language: LanguageConfig): string {
  const programmes = (dataSources as any)?.menuSignalProgrammes || []
  const menu = (dataSources as any)?.menu || []
  const ops = (dataSources as any)?.operations || {}
  const location = getLocationPhrase(dataSources, language)
  
  // If rich menu data, use narrative
  if (menu.length >= 5) {
    const sentences: string[] = []
    const locationPart = location ? ` ${location}` : ''
    const progNames = programmes.map((p: any) => p.role).join(' og ')
    
    sentences.push(`Restaurant${locationPart}, der serverer ${progNames}.`)
    
    const dishes = getSpecificDishes(dataSources, undefined, 3)
    if (dishes.length >= 2) {
      sentences.push(`Menuen omfatter retter som ${dishes.join(', ')}.`)
    }
    
    if (ops.has_table_service) {
      const features: string[] = ['bordbetjening']
      if (ops.has_outdoor_seating) features.push('udendørs siddepladser')
      sentences.push(`Stedet har ${features.join(' og ')}.`)
    }
    
    return sentences.join(' ')
  }
  
  // Simple format for sparse data
  const locationPart = location ? ` ${location}` : ''
  const progNames = programmes.length > 0 
    ? programmes.map((p: any) => p.role).join(' og ')
    : 'aftensmad'
  
  return `Restaurant${locationPart} med ${progNames}.`
}

/**
 * WINE BAR NARRATIVE
 * Multi-sentence explaining concept (not just generic "bar")
 */
function buildWineBarNarrative(dataSources: DataSources, language: LanguageConfig): string {
  const programmes = (dataSources as any)?.menuSignalProgrammes || []
  const hours = (dataSources as any)?.openingHoursRows || []
  const location = getLocationPhrase(dataSources, language)
  
  const sentences: string[] = []
  const locationPart = location ? ` ${location}` : ''
  
  // S1: Identity
  const hasCocktails = programmes.some((p: any) => /cocktail/i.test(p.role))
  const focus = hasCocktails ? 'naturvin og cocktails' : 'naturvin'
  sentences.push(`Vinbar${locationPart} med fokus på ${focus}.`)
  
  // S2: Wine detail (if available) or service style
  sentences.push('Vin serveres både på flaske og glas.')
  
  // S3: Food (if present)
  const hasFood = programmes.some((p: any) => /små retter|snacks|tapas|charcuterie|ost/i.test(p.role))
  if (hasFood) {
    sentences.push('Små retter serveres til vinen.')
  }
  
  // S4: Hours (critical for wine bars - establishes evening positioning)
  if (hours.length > 0) {
    const earliestOpen = Math.min(...hours.map(h => parseHour(h.open_time)))
    if (earliestOpen >= 15) {
      sentences.push(`Åbent fra kl. ${String(earliestOpen).padStart(2, '0')}.00.`)
    }
  }
  
  return sentences.join(' ')
}

/**
 * COFFEE SHOP DESCRIPTION (Simple format + takeaway emphasis)
 */
function buildCoffeeShopDescription(dataSources: DataSources, language: LanguageConfig): string {
  const programmes = (dataSources as any)?.menuSignalProgrammes || []
  const hours = (dataSources as any)?.openingHoursRows || []
  const ops = (dataSources as any)?.operations || {}
  const menu = (dataSources as any)?.menu || []
  const location = getLocationPhrase(dataSources, language)
  
  const locationPart = location ? ` ${location}` : ''
  
  // Check for specialty terminology
  const hasSpecialty = menu.some((item: any) => 
    /V60|AeroPress|pour.?over|single.?origin|specialty/i.test(item.name || '')
  )
  
  const coffeeType = hasSpecialty ? 'specialty-kaffe' : 'kaffe'
  const hasFood = programmes.some((p: any) => /bagværk|pastry|brunch/i.test(p.role))
  const foodPart = hasFood ? ' og friskbagt bagværk' : ''
  
  const earlyHour = hours.length > 0 
    ? Math.min(...hours.map(h => parseHour(h.open_time)))
    : null
  
  const features: string[] = []
  if (earlyHour && earlyHour <= 8) {
    features.push(`åbent fra kl. ${String(earlyHour).padStart(2, '0')}.00`)
  }
  if (ops.has_takeaway) {
    features.push('takeaway-venlig')
  }
  
  const featurePart = features.length > 0 ? `. ${features.join(', ').charAt(0).toUpperCase() + features.join(', ').slice(1)}` : ''
  
  return `Kaffebar${locationPart} med ${coffeeType}${foodPart}${featurePart}.`
}

/**
 * SIMPLE BAR DESCRIPTION
 * For bars without substantial food programmes
 */
function buildBarDescription(dataSources: DataSources, language: LanguageConfig): string {
  const programmes = (dataSources as any)?.menuSignalProgrammes || []
  const hours = (dataSources as any)?.openingHoursRows || []
  const location = getLocationPhrase(dataSources, language)
  
  const locationPart = location ? ` ${location}` : ''
  const progNames = programmes.length > 0 
    ? programmes.map((p: any) => p.role).join(' og ')
    : 'drinks'
  
  const latestClose = hours.length > 0 
    ? Math.max(...hours.map(h => parseHour(h.close_time)))
    : null
  
  const hoursPart = latestClose && latestClose >= 23 
    ? ` Åbent til kl. ${String(latestClose).padStart(2, '0')}.00.`
    : ''
  
  return `Bar${locationPart} med ${progNames}.${hoursPart}`
}

/**
 * Build deterministic fallback for voice_rationale when AI fails to provide it.
 * Returns 2-3 sentences explaining data sources and reasoning methodology.
 */
export function buildVoiceRationaleFallback(dataSources: DataSources, analysis: any, language: LanguageConfig): string {
  const programmes: Array<{ role: string; timeContext: string | null }> = (dataSources as any)?.menuSignalProgrammes || []
  const openingHoursRows: Array<{ weekday: string; open_time: string; close_time: string }> = (dataSources as any)?.openingHoursRows || []
  const business = (dataSources as any)?.business || {}
  const location = (dataSources as any)?.location || {}
  const hasWebsite = Boolean((dataSources as any)?.websiteAnalysis)
  const hasMenu = programmes.length > 0
  
  // Part 1: Data sources
  const sources: string[] = []
  if (hasMenu) sources.push(`${programmes.length} menu-programmer`)
  if (openingHoursRows.length > 0) sources.push('åbningstider')
  if (business.address || location.city) sources.push('lokationsdata')
  if (hasWebsite) sources.push('hjemmeside-analyse')
  
  const dataSourcesPhrase = sources.length > 0 
    ? `Datagrundlaget består af ${sources.join(', ')}.`
    : 'Datagrundlaget er begrænset til grundlæggende forretningsoplysninger.'
  
  // Part 2: Quality assessment
  const qualityPhrase = hasWebsite && hasMenu
    ? 'Tekstkvaliteten er høj, da der foreligger struktureret kommunikation fra stedet selv.'
    : 'Tekstkvaliteten er moderat, da data primært er strukturel information uden frivillig branding-kommunikation.'
  
  // Part 3: Conclusion
  const conclusionPhrase = hasWebsite
    ? 'Anbefalingerne er baseret på observeret kommunikation fra stedets egen tone.'
    : 'Anbefalingerne er vurderet ud fra stedets koncept og operationelle signaler.'
  
  return `${dataSourcesPhrase} ${qualityPhrase} ${conclusionPhrase}`
}

export function buildFallbackTargetAudience(dataSources: DataSources, analysis: any, language: LanguageConfig): { value: string; proof: string[] } {
  const business = (dataSources as any)?.business || {}
  const location = (dataSources as any)?.location || {}
  const city = typeof location.city === 'string' ? location.city.trim() : ''
  const address = typeof business.address === 'string' ? business.address.trim() : ''

  const isDanish = String(language?.code || '').toLowerCase().startsWith('da') || String(language?.name || '').toLowerCase().includes('danish')

  const locationCandidates: string[] = []
  const push = (v: unknown) => {
    if (typeof v !== 'string') return
    const t = v.trim()
    if (t.length < 2) return
    locationCandidates.push(t)
  }
  ;(analysis?.local_identity_cues || []).forEach((x: any) => push(x?.cue))
  ;(analysis?.physical_space_cues || []).forEach((x: any) => push(x?.cue))

  const locationRef =
    locationCandidates.find(c => /\båen\b/i.test(c) || /\bved\b/i.test(c)) ||
    locationCandidates.find(c => c.length <= 40) ||
    city ||
    (address ? address.split(',')[0].trim() : '') ||
    ''

  const locationTail = (() => {
    const t = String(locationRef || '').trim()
    if (!t) return ''
    const n = t.toLowerCase()
    if (n.startsWith('ved ') || n.startsWith('i ') || n.startsWith('på ')) return t
    if (/\båen\b/i.test(t)) return isDanish ? `ved ${t}` : `by ${t}`
    return isDanish ? `i ${t}` : `in ${t}`
  })()

  const offeringCandidates: string[] = []
  const pushOffering = (v: unknown) => {
    if (typeof v !== 'string') return
    const t = v.trim()
    if (t.length < 2) return
    offeringCandidates.push(t)
  }
  ;(analysis?.signals?.core_offerings?.concrete_anchors || []).forEach(pushOffering)
  ;(analysis?.signals?.core_offerings?.must_use_phrases || []).forEach(pushOffering)

  const has = (needle: string) => offeringCandidates.some(o => o.toLowerCase().includes(needle))
  const mealBits: string[] = []
  if (has('brunch')) mealBits.push(isDanish ? 'brunch' : 'brunch')
  if (has('frokost') || has('lunch')) mealBits.push(isDanish ? 'frokost' : 'lunch')
  if (has('middag') || has('dinner')) mealBits.push(isDanish ? 'middag' : 'dinner')
  if (mealBits.length === 0) {
    mealBits.push(isDanish ? 'brunch' : 'brunch')
    mealBits.push(isDanish ? 'frokost' : 'lunch')
    mealBits.push(isDanish ? 'middag' : 'dinner')
  }
  const uniqueMeals = Array.from(new Set(mealBits)).slice(0, 3)
  const mealPhrase = uniqueMeals.length === 1
    ? uniqueMeals[0]
    : uniqueMeals.length === 2
      ? (isDanish ? `${uniqueMeals[0]} eller ${uniqueMeals[1]}` : `${uniqueMeals[0]} or ${uniqueMeals[1]}`)
      : (isDanish ? `${uniqueMeals[0]}, ${uniqueMeals[1]} eller ${uniqueMeals[2]}` : `${uniqueMeals[0]}, ${uniqueMeals[1]} or ${uniqueMeals[2]}`)

  const offeringRef =
    offeringCandidates.find(o => /brunch|frokost|middag|lunch|dinner/i.test(o) && o.length <= 60) ||
    offeringCandidates.find(o => o.length <= 60) ||
    ''

  const value = isDanish
    ? `Når gæster samles om ${mealPhrase}${locationTail ? ` ${locationTail}` : ''}, når der er tid til at blive siddende, og når stemningen indbyder til mere end blot et måltid.`
    : `When guests gather for ${mealPhrase}${locationTail ? ` ${locationTail}` : ''}, when there's time to linger, and when the atmosphere invites more than just a meal.`

  const proof: string[] = []
  if (offeringRef) proof.push(isDanish ? `Menu/anker: ${offeringRef}` : `Menu anchor: ${offeringRef}`)
  if (locationRef) proof.push(isDanish ? `Lokationssignal: ${locationRef}` : `Location signal: ${locationRef}`)
  if (proof.length === 0) proof.push(isDanish ? 'Inferred from business type + available inputs' : 'Inferred from business type + available inputs')

  return { value, proof: proof.slice(0, 3) }
}

export function buildFallbackCoreOfferings(dataSources: DataSources, analysis: any, language: LanguageConfig): { value: string; proof: string[] } {
  const isDanish = String(language?.code || '').toLowerCase().startsWith('da') || String(language?.name || '').toLowerCase().includes('danish')

  const candidates: string[] = []
  const push = (v: unknown) => {
    if (typeof v !== 'string') return
    const t = v.trim()
    if (t.length < 2) return
    candidates.push(t)
  }

  ;(analysis?.signals?.core_offerings?.concrete_anchors || []).forEach(push)
  ;(analysis?.signals?.core_offerings?.must_use_phrases || []).forEach(push)
  ;(analysis?.signals?.core_offerings?.unknowns || []).forEach(push)

  const structuredWebsite = extractStructuredWebsiteData((dataSources as any)?.websiteAnalysis, (dataSources as any)?.business)
  ;(structuredWebsite?.menuCategoriesMentioned || []).forEach(push)

  // Only add menu .category (e.g. "Brunch") — NOT .name/.title/.item_name which are specific branded item names
  if (Array.isArray((dataSources as any)?.menu)) {
    for (const item of (dataSources as any).menu.slice(0, 80)) {
      push((item as any)?.category)
    }
  }

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const GENERIC_FRAGMENTS = ['mad og drikke', 'lækker mad', 'lækre oplevelser', 'hyggelig stemning', 'good vibes', 'culinary experiences']
  // ALL-CAPS items without any meal-category keyword are raw branded item names — skip them
  const MEAL_CAT_CHECK = /\b(brunch|frokost|middag|morgenmad|aftensmad|lunch|kaffe|kage|drinks|cocktails?|terrasse|take.?away|private|bar)\b/i

  const uniq: string[] = []
  for (const c of candidates) {
    const t = c.trim()
    if (!t) continue
    const n = norm(t)
    if (n.length < 3) continue
    if (GENERIC_FRAGMENTS.some(g => n.includes(norm(g)))) continue
    // Skip ALL-CAPS raw item names that have no meal-category keyword
    if (!/[a-zæøå]/.test(t) && !MEAL_CAT_CHECK.test(t)) continue
    // Skip article-starting items: "DEN LUKSURIØSE BRUNCH", "DEN LILLE BRUNCH" are specific items, not categories
    if (/^(DEN|DET|DE|EN|ET)\s+/i.test(t)) continue
    if (uniq.some(u => norm(u) === n)) continue
    uniq.push(t)
    if (uniq.length >= 6) break
  }

  // If not enough good category signals, derive from description text (most reliable)
  let offerings: string[]
  if (uniq.length >= 3) {
    offerings = uniq
  } else {
    const shortDesc: string = ((dataSources as any)?.profile as any)?.short_description || ''
    const longDesc: string = ((dataSources as any)?.profile as any)?.long_description || ''
    const combinedDesc = (shortDesc + ' ' + longDesc).toLowerCase()
    const mealBullets: string[] = []
    if (/brunch/i.test(combinedDesc)) mealBullets.push(isDanish ? 'Brunch og morgenmad' : 'Brunch')
    if (/frokost|lunch|smørrebrød|salat/i.test(combinedDesc)) mealBullets.push(isDanish ? 'Frokost og lette retter' : 'Lunch')
    if (/middag|3-retters|aftensmad/i.test(combinedDesc)) mealBullets.push(isDanish ? 'Middagsmenuer' : 'Dinner menus')
    if (/cocktail|drinks|bar|vin|øl/i.test(combinedDesc)) mealBullets.push(isDanish ? 'Drinks og cocktails' : 'Drinks & cocktails')
    if (/kaffe|kage|dessert/i.test(combinedDesc)) mealBullets.push(isDanish ? 'Kaffe og kage' : 'Coffee & cake')
    // Pad to 3 if needed
    if (mealBullets.length < 3) {
      if (!mealBullets.some(b => /frokost/i.test(b))) mealBullets.push(isDanish ? 'Frokost og lette retter' : 'Lunch')
      if (mealBullets.length < 3) mealBullets.push(isDanish ? 'Kaffe og kage' : 'Coffee & cake')
    }
    // Add experience/service anchors
    const expBullets: string[] = []
    const hasOutdoorSeating = /udend.rs|outdoor/i.test(combinedDesc)
    const explicitTerrasse = /\bterrasse\b/i.test(combinedDesc)
    if (hasOutdoorSeating) {
      // Only use "terrasse" if explicitly mentioned, otherwise use generic term
      expBullets.push(isDanish 
        ? (explicitTerrasse ? 'Udendørs terrasse' : 'Udendørs servering')
        : (explicitTerrasse ? 'Outdoor terrace' : 'Outdoor seating'))
    }
    if (/event|privat|selskab|reception/i.test(combinedDesc)) expBullets.push(isDanish ? 'Private events og selskaber' : 'Private events')
    else if (/take.?away|bestil\s+online|takeaway/i.test(combinedDesc)) expBullets.push(isDanish ? 'Take away' : 'Take away')
    else expBullets.push(isDanish ? 'Oplevelser med god tid' : 'Leisurely dining')

    const allFallbackBullets = [...mealBullets.slice(0, 3), ...expBullets.slice(0, 2)]
    offerings = [...uniq, ...allFallbackBullets.slice(0, Math.max(3, 5 - uniq.length))].slice(0, 5)
    if (offerings.length === 0) offerings = isDanish ? ['Brunch og morgenmad', 'Frokost og lette retter', 'Kaffe og kage'] : ['Brunch', 'Lunch', 'Coffee & cake']
  }
  const value = offerings.map(o => `- ${o}`).join('\n')

  const proof: string[] = []
  if (offerings[0]) proof.push(isDanish ? `Menu/anker: ${offerings[0]}` : `Menu anchor: ${offerings[0]}`)
  if (offerings[1]) proof.push(isDanish ? `Menu/anker: ${offerings[1]}` : `Menu anchor: ${offerings[1]}`)
  if (proof.length === 0) proof.push(isDanish ? 'Inferred from menu + website signals' : 'Inferred from menu + website signals')

  return { value, proof: proof.slice(0, 3) }
}

export function buildFallbackContentFocus(dataSources: DataSources, analysis: any, language: LanguageConfig): { value: string; proof: string[] } {
  const isDanish = String(language?.code || '').toLowerCase().startsWith('da') || String(language?.name || '').toLowerCase().includes('danish')

  const structuredWebsite = extractStructuredWebsiteData((dataSources as any)?.websiteAnalysis, (dataSources as any)?.business)
  const menuCats = Array.isArray(structuredWebsite?.menuCategoriesMentioned) ? structuredWebsite.menuCategoriesMentioned.filter(Boolean).map(String) : []
  const menuAnchor =
    (analysis?.signals?.core_offerings?.concrete_anchors || []).find((x: any) => typeof x === 'string' && x.trim().length > 2) ||
    (analysis?.signals?.core_offerings?.must_use_phrases || []).find((x: any) => typeof x === 'string' && x.trim().length > 2) ||
    menuCats.find(c => c.length > 2) ||
    (isDanish ? 'brunch/frokost/middag' : 'brunch/lunch/dinner')

  const spaceCue =
    (analysis?.physical_space_cues || []).map((x: any) => x?.cue).find((c: any) => typeof c === 'string' && c.trim().length > 3) ||
    (analysis?.local_identity_cues || []).map((x: any) => x?.cue).find((c: any) => typeof c === 'string' && c.trim().length > 3) ||
    (isDanish ? 'stemning og oplevelse' : 'atmosphere + experience')

  const momentCue =
    (analysis?.rituals_and_moments || []).map((x: any) => x?.moment).find((m: any) => typeof m === 'string' && m.trim().length > 3) ||
    (isDanish ? 'mennesker og øjeblikke i hverdagen' : 'people + everyday moments')

  const lines = isDanish
    ? [
        `- Mad & servering (konkret: ${menuAnchor})`,
        `- Stemning & oplevelse (sted/rum/atmosfære: ${spaceCue})`,

        `- Mennesker, øjeblikke & tempo (scener: ${momentCue})`,
        `- Overgange (dag → aften) og små fortællinger (BTS/processer når muligt)`
      ]
    : [
        `- Food & service (concrete: ${menuAnchor})`,
        `- Atmosphere & experience (interior/light/space: ${spaceCue})`,
        `- People, moments & pace (scenes: ${momentCue})`,
        `- Transitions (day → night) and small stories (BTS/process when possible)`
      ]

  const value = lines.slice(0, 4).join('\n')

  const proof: string[] = []
  if (menuAnchor) proof.push(isDanish ? `Menu/anker: ${menuAnchor}` : `Menu anchor: ${menuAnchor}`)
  if (spaceCue) proof.push(isDanish ? `Rumsignal: ${spaceCue}` : `Space cue: ${spaceCue}`)
  if (momentCue) proof.push(isDanish ? `Moment-signal: ${momentCue}` : `Moment cue: ${momentCue}`)
  return { value, proof: proof.slice(0, 3) }
}

export function buildFallbackCtaStyle(dataSources: DataSources, analysis: any, language: LanguageConfig): { value: string; proof: string[] } {
  const isDanish = String(language?.code || '').toLowerCase().startsWith('da') || String(language?.name || '').toLowerCase().includes('danish')

  const mustUse = Array.isArray(analysis?.signals?.cta_style?.must_use_phrases)
    ? analysis.signals.cta_style.must_use_phrases.filter((x: any) => typeof x === 'string' && x.trim().length > 1).map((x: any) => String(x).trim())
    : []

  const primary = mustUse.find((p: string) => /book|bordreserv|reserv|reservation/i.test(p)) || (isDanish ? 'Book dit bord' : 'Book a table')

  const secondaryDefaults = isDanish
    ? ['Se menuen', 'Kig forbi', 'Del oplevelsen']
    : ['See the menu', 'Drop by', 'Share the experience']

  // Try to reuse any non-booking CTAs from the website if present
  const secondaryFromMustUse = mustUse
    .filter((p: string) => !/book|bordreserv|reserv|reservation/i.test(p))
    .slice(0, 3)
  const secondary = (secondaryFromMustUse.length >= 2 ? secondaryFromMustUse : secondaryDefaults).slice(0, 3)

  const value = [
    `- Primær (booking): ${primary}`,
    ...secondary.slice(0, 3).map((s: string) => `- Sekundær (soft): ${s}`)
  ].join('\n')

  const proof: string[] = []
  if (mustUse.length > 0) proof.push(isDanish ? `CTA-tekst fra website: ${mustUse[0]}` : `Website CTA text: ${mustUse[0]}`)
  if (mustUse.length > 1) proof.push(isDanish ? `CTA-tekst fra website: ${mustUse[1]}` : `Website CTA text: ${mustUse[1]}`)
  if (proof.length === 0) proof.push(isDanish ? 'Inferred from business type + common CTAs' : 'Inferred from business type + common CTAs')
  return { value, proof: proof.slice(0, 3) }
}

export function buildFallbackSignatureShot(dataSources: DataSources, analysis: any, language: LanguageConfig): string {
  const business = (dataSources as any)?.business || {}
  const location = (dataSources as any)?.location || {}

  // Use centralized location phrase resolver with proper priority hierarchy
  const country = location?.country || business?.country
  const city = location?.city || business?.city
  const langCode = language?.code || language?.language || 'da'
  const locale = resolveLocale(country, city, langCode)
  
  const locationResult = resolveLocationPhrase(dataSources, locale, { includePreposition: true })
  const locationCue = locationResult.phrase || city || 'byen'

  const hook = (Array.isArray(analysis?.distinctive_hooks) && analysis.distinctive_hooks[0] && typeof analysis.distinctive_hooks[0].hook === 'string')
    ? analysis.distinctive_hooks[0].hook.trim()
    : ''

  const offeringCandidates: string[] = []
  const push = (v: unknown) => {
    if (typeof v !== 'string') return
    const t = v.trim()
    if (t.length < 2) return
    offeringCandidates.push(t)
  }
  ;(analysis?.signals?.core_offerings?.concrete_anchors || []).forEach(push)
  ;(analysis?.signals?.core_offerings?.must_use_phrases || []).forEach(push)
  // Try to pull a menu item name if available
  if (Array.isArray((dataSources as any)?.menu)) {
    for (const item of (dataSources as any).menu.slice(0, 20)) {
      push((item as any)?.name)
      push((item as any)?.title)
      push((item as any)?.item_name)
    }
  }
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const GENERIC_OFFERING_FRAGMENTS = [
    'menu categories',
    'mad og drikke',
    'lækker mad',
    'lækre oplevelser',
    'hyggelig stemning',
    'god stemning',
    'kulinariske oplevelser',
    'culinary experiences'
  ]
  const offering =
    offeringCandidates.find(o => o.length <= 40 && !GENERIC_OFFERING_FRAGMENTS.some(g => norm(o).includes(norm(g)))) ||
    offeringCandidates.find(o => !GENERIC_OFFERING_FRAGMENTS.some(g => norm(o).includes(norm(g)))) ||
    ''

  const isDanish = String(language?.code || '').toLowerCase().startsWith('da') || String(language?.name || '').toLowerCase().includes('danish')
  const lighting = isDanish ? 'gyldent aftenlys' : 'golden hour light'
  const action = isDanish ? 'bliver siddende længe' : 'linger'

  // Defensive: locationCue already contains the full phrase with preposition (e.g., "ved åen i Aarhus")
  // Don't add another "ved" prefix
  const hasPreposition = /^(ved|i|på|til|fra)\s+/i.test(String(locationCue))

  // Deterministic fallback format
  return isDanish
    ? hasPreposition
      ? `Et bord ${locationCue} i ${lighting}, hvor man ${action} med ${offering || 'brunch'} og glas på bordet.`
      : `Et bord ved ${locationCue} i ${lighting}, hvor man ${action} med ${offering || 'brunch'} og glas på bordet.`
    : `A table at ${locationCue} in ${lighting}, where people ${action} with ${offering || 'brunch'} and glasses on the table.`
}

export function buildFallbackBrandEssence(dataSources: DataSources, analysis: any, language: LanguageConfig): string {
  const business = (dataSources as any)?.business || {}
  const location = (dataSources as any)?.location || {}
  const profile = (dataSources as any)?.profile || {}
  const operations = (dataSources as any)?.operations || {}

  // Use centralized location phrase resolver with proper priority hierarchy
  const country = location?.country || business?.country
  const city = location?.city || business?.city
  const langCode = language?.code || language?.language || 'da'
  const locale = resolveLocale(country, city, langCode)
  
  const locationResult = resolveLocationPhrase(dataSources, locale, { includePreposition: true })
  const locationCue = locationResult.phrase || (city ? `i ${city}` : 'i byen')
  
  const isDanish = String(language?.code || '').toLowerCase().startsWith('da') || 
                   String(language?.name || '').toLowerCase().includes('danish')

  // Gather programme signals
  const programmes: Array<{ role: string; timeContext: string | null; items: string[] }> | null | undefined =
    (dataSources as any).menuSignalProgrammes
  const openingHoursRows: Array<{ weekday: string; open_time: string; close_time: string }> | undefined =
    (dataSources as any).openingHoursRows

  // Analyze opening patterns
  const hasLateNight = openingHoursRows?.some(r => {
    const h = parseInt((r.close_time || '00:00').split(':')[0], 10)
    return h >= 0 && h < 6
  }) ?? false

  const earliestOpen = openingHoursRows?.reduce((earliest, r) => {
    if (!r.open_time) return earliest
    const h = parseInt(r.open_time.split(':')[0], 10)
    return h < earliest ? h : earliest
  }, 24) ?? 24

  const latestClose = openingHoursRows?.reduce((latest, r) => {
    if (!r.close_time) return latest
    const h = parseInt(r.close_time.split(':')[0], 10)
    return h > latest || (h >= 0 && h < 6 && latest < 12) ? h : latest
  }, 0) ?? 0

  // Check website signals as backup
  const waAnalysis: any = (dataSources as any)?.websiteAnalysis?.raw_result?.analysis || {}
  const waKeywords: string[] = Array.isArray(waAnalysis?.keywords) ? waAnalysis.keywords : []
  const waUniqueHooks: any[] = waAnalysis?.venueHooks?.uniqueHooks || []
  const waAllText = `${waKeywords.join(' ')} ${waUniqueHooks.map((h: any) => `${h.hook || ''} ${h.text || ''}`).join(' ')}`.toLowerCase()
  
  const hasBarSignals = /cocktail|bar\b|drink|aftensmad|aftensmenu|3[-.\s]rett|dinner|middag/i.test(waAllText)
  const hasDaySignals = /brunch|frokost|morgen|morgenmad|lunch/i.test(waAllText)
  
  // Synthesize programmes if needed
  let effectiveProgrammes = programmes && programmes.length >= 2 ? programmes : null
  if (!effectiveProgrammes && hasDaySignals && (hasBarSignals || hasLateNight)) {
    const synth: Array<{ role: string; timeContext: string | null; items: string[] }> = []
    if (hasDaySignals) synth.push({ role: 'brunch og frokost', timeContext: null, items: [] })
    if (hasBarSignals || hasLateNight) synth.push({ role: 'bar', timeContext: null, items: [] })
    if (synth.length >= 2) effectiveProgrammes = synth
  }

  // ── Time-of-day label derivation (i18n — country-specific rules) ─────────
  // Opening and closing labels are derived from actual data, never assumed.
  const phrases = getPhrasesForLocale(language.code || 'da-DK')
  const openingLabelRules: Array<{ maxHour: number; term: string }> =
    phrases.timeOfDay?.openingLabels || []
  const closingDrinkTerms: Record<string, string> =
    phrases.timeOfDay?.closingDrinkTerms || {}
  const closingDrinkFallback: string =
    phrases.timeOfDay?.closingDrinkFallback || 'drinks'

  // Opening label: first rule where earliestOpen < maxHour (cultural norm, not round-number assumption)
  const openingLabel: string | null = earliestOpen < 24
    ? (openingLabelRules.find(r => earliestOpen < r.maxHour)?.term ?? null)
    : null

  // Closing drink label: check programme roles first, then menu categories, then website signals
  const menuSearchTexts: string[] = [
    ...(effectiveProgrammes?.map(p => p.role.toLowerCase()) || []),
    ...(Array.isArray((dataSources as any)?.menu)
      ? (dataSources as any).menu.slice(0, 30).map((item: any) => String(item?.category || '').toLowerCase())
      : [])
  ].filter(Boolean)

  let closingLabel: string | null = null
  for (const [keyword, term] of Object.entries(closingDrinkTerms)) {
    if (menuSearchTexts.some(text => text.includes(keyword))) {
      closingLabel = term
      break
    }
  }
  // Fallback to website signals when structured menu data has no drink category
  if (!closingLabel && hasBarSignals) {
    for (const [keyword, term] of Object.entries(closingDrinkTerms)) {
      if (waAllText.includes(keyword)) {
        closingLabel = term
        break
      }
    }
    if (!closingLabel) closingLabel = closingDrinkFallback
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Analyze what the data MEANS for guest experience
  const roles = effectiveProgrammes?.map(p => p.role.toLowerCase()) || []
  const hasBrunch = roles.some(r => /brunch/i.test(r))
  const hasFrokost = roles.some(r => /frokost|lunch/i.test(r))
  const hasEvening = roles.some(r => /aften|3[-.\s]rett|dinner|middag|aftenret/i.test(r))
  const hasBar = hasLateNight || roles.some(r => /bar|cocktail|drink|øl|vin/i.test(r))
  const hasKidsMenu = operations?.has_kids_menu === true
  const hasOutdoor = operations?.has_outdoor_seating === true

  // ANALYTICAL INTERPRETATION: What does this combination create?
  
  // Multi-mode all-day destination
  if ((hasBrunch || hasFrokost) && (hasEvening || hasBar)) {
    // Determine temporal span: data-grounded labels — never assumed from opening hour alone
    let temporalSpan = ''

    if (hasLateNight && openingLabel && closingLabel) {
      // Best case: both labels derived from data
      temporalSpan = isDanish
        ? `åbent fra ${openingLabel} til ${closingLabel}`
        : `open from ${openingLabel} to ${closingLabel}`
    } else if (hasLateNight && closingLabel) {
      // Late night confirmed, drink known, opening label not available
      temporalSpan = isDanish
        ? `åbent til sent med ${closingLabel}`
        : `open late with ${closingLabel}`
    } else if (openingLabel && (hasEvening || hasBar) && latestClose >= 21) {
      // Day + evening/bar confirmed, opening label known, no late night
      temporalSpan = isDanish
        ? `åbent fra ${openingLabel} til aftenen`
        : `open from ${openingLabel} to evening`
    } else if (earliestOpen < 24 && latestClose >= 21) {
      // Hours span covers full day but labels unavailable
      temporalSpan = isDanish ? 'åbent hele dagen' : 'open all day'
    } else {
      // Multi-programme, limited hour data
      temporalSpan = isDanish ? 'åbent fra dag til aften' : 'open from daytime to evening'
    }

    // Add emotional positioning hook (quality validators require "why" language)
    let emotionalHook = ''
    if (hasOutdoor && locationPhrase && (hasLateNight || latestClose >= 22)) {
      // Outdoor all-day venue → emotional destination framing
      emotionalHook = isDanish ? 'Det velfortjente stop' : 'The well-deserved break'
    } else if (hasKidsMenu && (hasEvening || hasBar)) {
      // Family-friendly with evening mode → adaptability framing
      emotionalHook = isDanish ? 'Stedet' : 'The place'
    } else {
      // Default emotional framing
      emotionalHook = isDanish ? 'Stedet' : 'The place'
    }

    // Combine emotional hook + location + temporal span
    return isDanish
      ? `${emotionalHook} ${locationCue} — ${temporalSpan}.`
      : `${emotionalHook} at ${locationCue} — ${temporalSpan}.`
  }

  // All-day single-mode (e.g., café open morning to evening)
  if ((hasBrunch || hasFrokost) && !hasBar && !hasEvening && earliestOpen <= 10 && latestClose >= 17) {
    const modeType = hasBrunch ? 'brunch' : 'frokost'
    return isDanish
      ? `Det velfortjente stop ${locationCue} — til ${modeType} i roligt tempo.`
      : `The well-deserved break at ${locationCue} — for ${modeType} at a relaxed pace.`
  }

  // Evening/bar focused venue
  if (!hasBrunch && !hasFrokost && (hasEvening || hasBar)) {
    const eveningFocus = hasLateNight 
      ? (isDanish ? 'til aftens og drinks når du skal have det godt' : 'for evening dining and drinks when you want to enjoy yourself')
      : (isDanish ? 'når du skal have aftens og drinks' : 'when you want evening dining and drinks')
    
    return isDanish
      ? `${locationCue.charAt(0).toUpperCase() + locationCue.slice(1)} — ${eveningFocus}.`
      : `At ${locationCue} — ${eveningFocus}.`
  }

  // Sparse data fallback: use location + one verified offering if available
  const offeringCandidates: string[] = []
  const push = (v: unknown) => {
    if (typeof v !== 'string') return
    const t = v.trim()
    if (t.length >= 2) offeringCandidates.push(t)
  }
  
  ;(analysis?.signals?.core_offerings?.concrete_anchors || []).forEach(push)
  ;(analysis?.signals?.core_offerings?.must_use_phrases || []).forEach(push)
  
  if (Array.isArray((dataSources as any)?.menu)) {
    for (const item of (dataSources as any).menu.slice(0, 15)) {
      push((item as any)?.name)
      push((item as any)?.category)
    }
  }

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const GENERIC_FRAGMENTS = ['mad og drikke', 'lækker mad', 'kulinariske oplevelser', 'culinary experiences']
  const offering = offeringCandidates.find(o => 
    o.length <= 40 && !GENERIC_FRAGMENTS.some(g => norm(o).includes(norm(g)))
  ) || offeringCandidates.find(o => 
    !GENERIC_FRAGMENTS.some(g => norm(o).includes(norm(g)))
  ) || null  // null when no verified offering — never assume 'brunch'

  // Sparse data: no verified offering available — safe generic phrase with no temporal or offering claims
  const baseVenueType = profile?.business_category || business?.business_type_hybrid?.primary || 'café'
  if (!offering) {
    return isDanish
      ? `Det velfortjente stop ${locationCue}.`
      : `${baseVenueType} at ${locationCue}.`
  }

  // Sparse data with one verified offering — include it for factual grounding
  return isDanish
    ? `Det velfortjente stop ${locationCue} — til ${offering}.`
    : `${baseVenueType} at ${locationCue} — for ${offering}.`
}

// ============================================================================
// AUDIENCE FRAMEWORK (Multi-Context, Time-Based, Seasonal)
// ============================================================================

interface LocationContext {
  type: string
  score: number
  audiences: string[]
  seasonal?: boolean
}

interface TimeSlot {
  programmes: string[]
  audiences: string[]
  contexts: string[]
}

interface AudienceFramework {
  primaryAudiences: string[]
  locationContexts: LocationContext[]
  timeSlots: TimeSlot[]
  seasonalVariation: {
    summer: { audiences: string[]; emphasis: string }
    winter: { audiences: string[]; emphasis: string }
  } | null
  complexity: 'simple' | 'moderate' | 'complex'
}

/**
 * Detect ALL active location contexts from category_scores.
 * Prevents compression - captures full context diversity.
 */
function detectLocationContexts(dataSources: DataSources): LocationContext[] {
  // FIX: category_scores lives in locationIntelligenceRow, not location
  const locationIntel = (dataSources as any)?.locationIntelligenceRow || {}
  const categoryScores = locationIntel?.category_scores || {}
  const ops = (dataSources as any)?.operations || {}
  
  const contexts: LocationContext[] = []
  const SCORE_THRESHOLD = 30 // LOWERED from 50: Many real venues score 30-49 on context axes
  
  // DEBUG: Log actual scores
  console.log('🔍 Location context detection:', {
    hasLocationIntel: !!(dataSources as any)?.locationIntelligenceRow,
    hasCategoryScores: !!categoryScores && Object.keys(categoryScores).length > 0,
    scores: {
      waterfront: categoryScores.waterfront,
      tourist: categoryScores.tourist,
      city_centre: categoryScores.city_centre,
      residential: categoryScores.residential,
      nightlife: categoryScores.nightlife
    },
    threshold: SCORE_THRESHOLD
  })
  
  // Waterfront/Tourist context
  // FIXED: Use actual database field names (waterfront, tourist) not (waterfront_dining, tourist_attraction)
  if (categoryScores.waterfront >= SCORE_THRESHOLD || categoryScores.tourist >= SCORE_THRESHOLD) {
    contexts.push({
      type: 'waterfront_tourist',
      score: Math.max(categoryScores.waterfront || 0, categoryScores.tourist || 0),
      audiences: ['destinationsbesøgende', 'turister', 'par', 'familier'],
      seasonal: ops.has_outdoor_seating // Only seasonal if outdoor seating exists
    })
  }
  
  // Downtown/Business context
  // FIXED: Use actual database field names (city_centre) not (business_district, shopping_street)
  if (categoryScores.city_centre >= SCORE_THRESHOLD || categoryScores.shopping >= SCORE_THRESHOLD) {
    contexts.push({
      type: 'downtown_business',
      score: Math.max(categoryScores.city_centre || 0, categoryScores.shopping || 0),
      audiences: ['kontoransatte', 'shopping-pause', 'forretningsfolk'],
      seasonal: false
    })
  }
  
  // Residential/Neighborhood context
  if (categoryScores.residential >= SCORE_THRESHOLD || categoryScores.local >= SCORE_THRESHOLD) {
    contexts.push({
      type: 'residential_local',
      score: Math.max(categoryScores.residential || 0, categoryScores.local || 0),
      audiences: ['lokale', 'naboer', 'stamgæster'],
      seasonal: false
    })
  }
  
  // Cultural/Arts context
  if (categoryScores.cultural >= SCORE_THRESHOLD || categoryScores.arts >= SCORE_THRESHOLD) {
    contexts.push({
      type: 'cultural_arts',
      score: Math.max(categoryScores.cultural || 0, categoryScores.arts || 0),
      audiences: ['kulturinteresserede', 'par', 'vennegrupper'],
      seasonal: false
    })
  }
  
  // Nightlife context
  if (categoryScores.nightlife >= SCORE_THRESHOLD) {
    contexts.push({
      type: 'nightlife',
      score: categoryScores.nightlife,
      audiences: ['natteliv-gæster', 'vennegrupper', 'par'],
      seasonal: false
    })
  }
  
  // Sort by score (highest first) to determine primary context
  contexts.sort((a, b) => b.score - a.score)
  
  // Fallback: if no contexts detected but we have area_type, create a basic context
  if (contexts.length === 0 && locationIntel?.area_type) {
    console.warn('⚠️ No contexts from category_scores (all below threshold?), falling back to area_type:', locationIntel.area_type)
    if (locationIntel.area_type === 'waterfront') {
      contexts.push({
        type: 'waterfront_tourist',
        score: 50, // Moderate confidence fallback
        audiences: ['destinationsbesøgende', 'par', 'familier'],
        seasonal: ops.has_outdoor_seating
      })
    } else if (locationIntel.area_type === 'city_centre' || locationIntel.area_type === 'downtown') {
      contexts.push({
        type: 'downtown_business',
        score: 50,
        audiences: ['frokostgæster', 'erhvervsfolk', 'lokale'],
        seasonal: false
      })
    }
  }
  
  console.log(`✅ detectLocationContexts complete: ${contexts.length} contexts`, contexts.map(c => `${c.type}(score=${c.score})`))
  
  return contexts
}

/**
 * Map programmes to time slots and derive context-appropriate audiences.
 * Returns programme-based audience variation (no time labels - programmes drive content).
 */
function mapAudiencesByTimeSlot(dataSources: DataSources, locationContexts: LocationContext[]): TimeSlot[] {
  const programmes = (dataSources as any)?.menuSignalProgrammes || []
  const hours = (dataSources as any)?.openingHoursRows || []
  const ops = (dataSources as any)?.operations || {}
  
  // Determine active time slots from opening hours
  // Use earliest open time to determine first period
  const earliestOpen = Math.min(...hours.map((h: any) => parseHour(h.open_time)).filter((h: number) => h > 0))
  const latestClose = Math.max(...hours.map((h: any) => parseHour(h.close_time)))
  
  const hasEarlyMorgen = earliestOpen < 9  // Opens before 09:00 = true morning
  const hasFormiddag = earliestOpen <= 11  // Opens by 11:00 = includes formiddag/brunch
  const hasMiddag = hours.some((h: any) => parseHour(h.open_time) <= 12 && parseHour(h.close_time) >= 14)
  const hasEftermiddag = hours.some((h: any) => parseHour(h.close_time) >= 16)
  const hasAften = hours.some((h: any) => parseHour(h.close_time) >= 18)
  const hasNat = hours.some((h: any) => {
    const closeHour = parseHour(h.close_time)
    return closeHour >= 23 || closeHour <= 6
  })
  
  const slots: TimeSlot[] = []
  
  // Morgen (07:00-09:00): Early breakfast - only for venues opening before 09:00
  if (hasEarlyMorgen && earliestOpen < 9) {
    const morgenProgrammes = canonicalizeProgrammes(
      programmes
        .filter((p: any) => /morgenmad|breakfast|morgenkaffe/i.test(p.role))
        .map((p: any) => p.role)
    )
    
    const morgenAudiences: string[] = []
    const morgenContexts: string[] = []
    
    // Context-specific early morning audiences
    if (locationContexts.some(c => c.type === 'downtown_business')) {
      morgenAudiences.push('erhvervsfolk', 'kontoransatte')
      morgenContexts.push('kaffe på vej til arbejde', 'morgenmøde')
    }
    if (ops.has_takeaway) {
      morgenAudiences.push('takeaway-gæster')
    }
    
    // Default morning audiences if no context
    if (morgenAudiences.length === 0) {
      morgenAudiences.push('tidlige gæster', 'lokale')
    }
    
    slots.push({
      programmes: morgenProgrammes,
      audiences: [...new Set(morgenAudiences)],
      contexts: morgenContexts
    })
  }
  
  // Formiddag (09:00-11:00): Brunch time - for venues opening 09:00-11:00
  if (hasFormiddag) {
    const formiddagProgrammes = canonicalizeProgrammes(
      programmes
        .filter((p: any) => /brunch|kaffe|coffee/i.test(p.role))
        .map((p: any) => p.role)
    )
    
    const formiddagAudiences: string[] = []
    const formiddagContexts: string[] = []
    
    // Context-specific brunch audiences
    if (locationContexts.some(c => c.type === 'waterfront_tourist')) {
      formiddagAudiences.push('weekendgæster', 'par', 'familier')
      formiddagContexts.push('weekend-brunch', 'afslappet formiddag')
    }
    if (locationContexts.some(c => c.type === 'downtown_business')) {
      formiddagAudiences.push('kontoransatte', 'forretningsfolk')
      formiddagContexts.push('møde over brunch')
    }
    if (locationContexts.some(c => c.type === 'residential_local')) {
      formiddagAudiences.push('lokale', 'stamgæster')
      formiddagContexts.push('fredagsbrunch', 'pause i hverdagen')
    }
    
    // Default brunch audiences if no context
    if (formiddagAudiences.length === 0) {
      formiddagAudiences.push('brunch-gæster', 'par', 'vennegrupper')
    }
    
    slots.push({
      programmes: formiddagProgrammes,
      audiences: [...new Set(formiddagAudiences)],
      contexts: formiddagContexts
    })
  }
  
  // Middag (11:00-15:00): Lunch, Frokost
  if (hasMiddag) {
    const middayProgrammes = canonicalizeProgrammes(
      programmes
        .filter((p: any) => /frokost|lunch/i.test(p.role))
        .map((p: any) => p.role)
    )
    
    const middayAudiences: string[] = []
    const middayContexts: string[] = []
    
    // Context-specific midday audiences
    if (locationContexts.some(c => c.type === 'downtown_business')) {
      middayAudiences.push('kontoransatte', 'forretnings-frokost', 'kollegaer')
      middayContexts.push('frokostpause', 'business lunch')
    }
    if (locationContexts.some(c => c.type === 'waterfront_tourist')) {
      middayAudiences.push('turister', 'destinationsbesøgende', 'familier')
      middayContexts.push('sightseeing-pause')
    }
    if (locationContexts.some(c => c.type === 'downtown_business')) {
      middayAudiences.push('shopping-pause')
    }
    
    // Default if no context
    if (middayAudiences.length === 0) {
      middayAudiences.push('frokostgæster', 'lokale')
    }
    
    slots.push({
      programmes: middayProgrammes,
      audiences: [...new Set(middayAudiences)],
      contexts: middayContexts
    })
  }
  
  // Eftermiddag (15:00-17:00): Afternoon, coffee/cake time
  if (hasEftermiddag) {
    const eftermiddagProgrammes = canonicalizeProgrammes(
      programmes
        .filter((p: any) => /kaffe|kage|cake|afternoon|eftermiddag/i.test(p.role))
        .map((p: any) => p.role)
    )
    
    const eftermiddagAudiences: string[] = []
    const eftermiddagContexts: string[] = []
    
    // Context-specific afternoon audiences
    if (locationContexts.some(c => c.type === 'waterfront_tourist')) {
      eftermiddagAudiences.push('turister', 'par', 'familier')
      eftermiddagContexts.push('eftermiddagspause', 'kaffe og kage')
    }
    if (locationContexts.some(c => c.type === 'residential_local')) {
      eftermiddagAudiences.push('lokale', 'pensionister', 'mødre med børn')
      eftermiddagContexts.push('fredags-hygge', 'pause fra indkøb')
    }
    if (locationContexts.some(c => c.type === 'downtown_business')) {
      eftermiddagAudiences.push('kontoransatte', 'freelancere')
      eftermiddagContexts.push('arbejdspause', 'uformel møde')
    }
    
    // Default if no context
    if (eftermiddagAudiences.length === 0) {
      eftermiddagAudiences.push('eftermiddagsgæster', 'lokale')
    }
    
    slots.push({
      programmes: eftermiddagProgrammes,
      audiences: [...new Set(eftermiddagAudiences)],
      contexts: eftermiddagContexts
    })
  }
  
  // Evening/Dinner programmes
  if (hasAften) {
    const eveningProgrammes = canonicalizeProgrammes(
      programmes
        .filter((p: any) => /aften|middag|dinner/i.test(p.role))
        .map((p: any) => p.role)
    )
    
    if (eveningProgrammes.length > 0) {
      const eveningAudiences: string[] = ['par', 'vennegrupper']
      const eveningContexts: string[] = []
      
      // Context-specific evening audiences
      if (ops.has_kids_menu) {
        eveningAudiences.push('familier')
        eveningContexts.push('familiemiddag')
      }
      if (locationContexts.some(c => c.type === 'waterfront_tourist')) {
        eveningAudiences.push('datenight-gæster')
        eveningContexts.push('romantisk aftensmad')
      }
      if (locationContexts.some(c => c.type === 'cultural_arts')) {
        eveningAudiences.push('kulturinteresserede')
        eveningContexts.push('før/efter kulturarrangement')
      }
      
      slots.push({
        programmes: eveningProgrammes,
        audiences: [...new Set(eveningAudiences)],
        contexts: eveningContexts
      })
    }
  }
  
  // Late night programmes (cocktails, bar)
  if (hasNat) {
    const nightProgrammes = canonicalizeProgrammes(
      programmes
        .filter((p: any) => /cocktail|bar|drink|natmad/i.test(p.role))
        .map((p: any) => p.role)
    )
    
    if (nightProgrammes.length > 0) {
      const nightAudiences: string[] = ['natteliv-gæster', 'vennegrupper', 'par']
      const nightContexts: string[] = ['efter-middag drinks', 'weekend-udgang']
      
      slots.push({
        programmes: nightProgrammes,
        audiences: nightAudiences,
        contexts: nightContexts
      })
    }
  }
  
  return slots
}

/**
 * Build seasonal audience profiles.
 * Only relevant for outdoor venues or tourist areas.
 */
function buildSeasonalProfiles(dataSources: DataSources, locationContexts: LocationContext[]): AudienceFramework['seasonalVariation'] {
  const ops = (dataSources as any)?.operations || {}
  
  // Only create seasonal variation if there's a seasonal context
  const hasSeasonalContext = locationContexts.some(c => c.seasonal)
  
  if (!hasSeasonalContext && !ops.has_outdoor_seating) {
    return null
  }
  
  return {
    summer: {
      audiences: ['turister', 'destinationsbesøgende', 'familier', 'par'],
      emphasis: 'udendørs oplevelse, vandfront-atmosphære'
    },
    winter: {
      audiences: ['lokale', 'stamgæster', 'hverdagsgæster'],
      emphasis: 'hyggelig indendørs stemning'
    }
  }
}

/**
 * Build complete audience framework deterministically.
 * Complexity scales with business type - simple venues get simple output.
 */
export function buildAudienceFrameworkDeterministic(dataSources: DataSources, language: LanguageConfig): AudienceFramework {
  const businessType = detectBusinessType(dataSources)
  const locationContexts = detectLocationContexts(dataSources)
  const timeSlots = mapAudiencesByTimeSlot(dataSources, locationContexts)
  const seasonalVariation = buildSeasonalProfiles(dataSources, locationContexts)
  
  // Determine complexity based on business type
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple'
  if (businessType === 'HYBRID_MULTI_PROGRAMME' || timeSlots.length >= 3) {
    complexity = 'complex'
  } else if (timeSlots.length === 2 || locationContexts.length >= 2) {
    complexity = 'moderate'
  }
  
  // Aggregate primary audiences (deduplicated across all time slots)
  const allAudiences = new Set<string>()
  timeSlots.forEach(slot => slot.audiences.forEach(a => allAudiences.add(a)))
  
  // For simple businesses, limit to top 3 audiences
  let primaryAudiences = Array.from(allAudiences)
  if (complexity === 'simple' && primaryAudiences.length > 3) {
    primaryAudiences = primaryAudiences.slice(0, 3)
  }
  
  return {
    primaryAudiences,
    locationContexts,
    timeSlots,
    seasonalVariation,
    complexity
  }
}

// ============================================================================
// VOICE SYSTEM (Programme-Aware, Time-Sensitive, Context-Adaptive)
// ============================================================================

type VoiceArchetype = 
  | 'HYBRID_ADAPTIVE'      // Multi-programme: adapts based on context
  | 'WARM_INCLUSIVE'       // Family-friendly, daytime cafés
  | 'EFFICIENT_HELPFUL'    // Business lunch, quick service
  | 'SOPHISTICATED_INVITING' // Wine bars, fine dining
  | 'SOCIAL_ENERGETIC'     // Bars, nightlife
  | 'CRAFT_FOCUSED'        // Specialty coffee, artisan venues

interface VoiceVariation {
  archetype: string
  tone: string[]
  imperatives: 'yes' | 'no' | 'limited'
  pronouns: 'du' | 'I' | 'man' | 'vi'
  sentenceStyle: string
  examplePhrases: string[]
}

interface VoiceSystem {
  primaryArchetype: VoiceArchetype
  programmeSpecific: Record<string, VoiceVariation>
  complexity: 'single' | 'dual' | 'multi'
}

/**
 * Detect appropriate voice archetype based on business type and programmes.
 */
function detectVoiceArchetype(dataSources: DataSources, businessType: BusinessType): VoiceArchetype {
  const programmes = (dataSources as any)?.menuSignalProgrammes || []
  const ops = (dataSources as any)?.operations || {}
  
  // Hybrid venues need adaptive voice system
  if (businessType === 'HYBRID_MULTI_PROGRAMME') {
    return 'HYBRID_ADAPTIVE'
  }
  
  // Family-friendly venues need warm, inclusive voice
  if (ops.has_kids_menu || programmes.some((p: any) => /børnemenu|brunch/i.test(p.role))) {
    return 'WARM_INCLUSIVE'
  }
  
  // Business/lunch context needs efficient voice
  const location = (dataSources as any)?.location || {}
  const categoryScores = location?.category_scores || {}
  if (categoryScores.business_district >= 50 && programmes.some((p: any) => /frokost|lunch/i.test(p.role))) {
    return 'EFFICIENT_HELPFUL'
  }
  
  // Wine bars and fine dining need sophisticated voice
  if (businessType === 'WINE_BAR' || businessType === 'RESTAURANT') {
    return 'SOPHISTICATED_INVITING'
  }
  
  // Bars and nightlife need social, energetic voice
  if (businessType === 'SIMPLE_BAR' || programmes.some((p: any) => /cocktail|bar|natteliv/i.test(p.role))) {
    return 'SOCIAL_ENERGETIC'
  }
  
  // Specialty venues need craft-focused voice
  if (businessType === 'SPECIALTY_COFFEE') {
    return 'CRAFT_FOCUSED'
  }
  
  // Default: warm and inclusive
  return 'WARM_INCLUSIVE'
}

/**
 * Build voice variation for a specific programme or time context.
 */
function buildVoiceVariation(
  archetype: VoiceArchetype, 
  context: string,
  hasKidsMenu: boolean = false
): VoiceVariation {
  
  // HYBRID_ADAPTIVE: Context determines voice
  if (archetype === 'HYBRID_ADAPTIVE') {
    // Morning/Brunch: Warm, NO imperatives (families)
    if (/morgen|brunch|børnemenu/i.test(context)) {
      return {
        archetype: 'warm_inclusive',
        tone: ['varm', 'inkluderende', 'venlig'],
        imperatives: hasKidsMenu ? 'no' : 'limited',
        pronouns: 'vi',
        sentenceStyle: 'Inviterende spørgsmål, beskrivende sætninger',
        examplePhrases: [
          'Vi byder på brunch med plads til hele familien',
          'Børnemenuen har favoritter som pandekager og nuggets',
          'Der er masser af plads til barnevogne'
        ]
      }
    }
    
    // Midday/Lunch: Efficient, helpful
    if (/frokost|lunch|middag/i.test(context)) {
      return {
        archetype: 'efficient_helpful',
        tone: ['hjælpsom', 'effektiv', 'klar'],
        imperatives: 'limited',
        pronouns: 'du',
        sentenceStyle: 'Korte, klare sætninger med service-verber',
        examplePhrases: [
          'Book bord til frokost',
          'Dagens ret serveres 11-15',
          'Tag med takeaway hvis du har travlt'
        ]
      }
    }
    
    // Evening/Cocktails: Social, inviting (imperatives OK)
    if (/aften|cocktail|bar|drink/i.test(context)) {
      return {
        archetype: 'social_energetic',
        tone: ['social', 'indbydende', 'livlig'],
        imperatives: 'yes',
        pronouns: 'du',
        sentenceStyle: 'Aktive verber, direkte opfordringer',
        examplePhrases: [
          'Prøv vores signatur-cocktail',
          'Mød dine venner til drinks',
          'Book bord til aftensmaden'
        ]
      }
    }
  }
  
  // Single-archetype voices (non-hybrid businesses)
  switch (archetype) {
    case 'WARM_INCLUSIVE':
      return {
        archetype: 'warm_inclusive',
        tone: ['varm', 'inkluderende', 'venlig'],
        imperatives: hasKidsMenu ? 'no' : 'limited',
        pronouns: 'vi',
        sentenceStyle: 'Inviterende beskrivelser, ingen kommandoer',
        examplePhrases: [
          'Vi elsker at byde velkommen',
          'Der er plads til alle',
          'Kom som du er'
        ]
      }
    
    case 'EFFICIENT_HELPFUL':
      return {
        archetype: 'efficient_helpful',
        tone: ['hjælpsom', 'professionel', 'klar'],
        imperatives: 'limited',
        pronouns: 'du',
        sentenceStyle: 'Service-orienteret, klare facts',
        examplePhrases: [
          'Book nemt online',
          'Servering 11-15 på hverdage',
          'Takeaway klar på 15 minutter'
        ]
      }
    
    case 'SOPHISTICATED_INVITING':
      return {
        archetype: 'sophisticated_inviting',
        tone: ['sofistikeret', 'indbydende', 'reflekteret'],
        imperatives: 'limited',
        pronouns: 'man',
        sentenceStyle: 'Beskrivende, fokus på oplevelse',
        examplePhrases: [
          'Oplev naturvin fra små producenter',
          'En menu der skifter med sæsonen',
          'Smag og opdagelse står i centrum'
        ]
      }
    
    case 'SOCIAL_ENERGETIC':
      return {
        archetype: 'social_energetic',
        tone: ['social', 'energisk', 'direkte'],
        imperatives: 'yes',
        pronouns: 'du',
        sentenceStyle: 'Korte sætninger, aktive opfordringer',
        examplePhrases: [
          'Se dig om efter en ledig plads ved baren',
          'Prøv ugens special',
          'Skål og velkommen'
        ]
      }
    
    case 'CRAFT_FOCUSED':
      return {
        archetype: 'craft_focused',
        tone: ['passioneret', 'kyndig', 'inviterende'],
        imperatives: 'limited',
        pronouns: 'vi',
        sentenceStyle: 'Fokus på håndværk og kvalitet',
        examplePhrases: [
          'Vi brygger hver kop med omhu',
          'Bønnerne kommer fra etiske kilder',
          'Vores barista kan anbefale den perfekte bryg'
        ]
      }
    
    default:
      return {
        archetype: 'warm_inclusive',
        tone: ['venlig', 'afslappet'],
        imperatives: 'no',
        pronouns: 'vi',
        sentenceStyle: 'Naturlig, inviterende',
        examplePhrases: ['Velkommen', 'Vi glæder os til at se dig']
      }
  }
}

/**
 * Build complete voice system deterministically.
 * Simple venues get single voice; hybrids get context-adaptive variations.
 */
export function buildVoiceSystemDeterministic(dataSources: DataSources, language: LanguageConfig): VoiceSystem {
  const businessType = detectBusinessType(dataSources)
  const programmes = (dataSources as any)?.menuSignalProgrammes || []
  const ops = (dataSources as any)?.operations || {}
  const primaryArchetype = detectVoiceArchetype(dataSources, businessType)
  
  const voiceSystem: VoiceSystem = {
    primaryArchetype,
    programmeSpecific: {},
    complexity: 'single'
  }
  
  // Simple businesses: single voice stored under generic 'default' key
  if (businessType === 'CAFE' || businessType === 'SIMPLE_BAR' || businessType === 'SPECIALTY_COFFEE') {
    const singleVariation = buildVoiceVariation(primaryArchetype, '', ops.has_kids_menu)
    voiceSystem.programmeSpecific['default'] = singleVariation
    voiceSystem.complexity = 'single'
    return voiceSystem
  }
  
  // Moderate complexity: dual voice (day/evening)
  if (businessType === 'WINE_BAR' || businessType === 'RESTAURANT') {
    const dayVoice = buildVoiceVariation(primaryArchetype, 'middag', ops.has_kids_menu)
    const nightVoice = buildVoiceVariation(primaryArchetype, 'cocktail', false)
    voiceSystem.programmeSpecific['day'] = dayVoice
    voiceSystem.programmeSpecific['evening'] = nightVoice
    voiceSystem.complexity = 'dual'
    return voiceSystem
  }
  
  // High complexity: HYBRID_ADAPTIVE with programme-specific variations
  if (businessType === 'HYBRID_MULTI_PROGRAMME') {
    voiceSystem.complexity = 'multi'
    
    // Build variation for each programme (this is what drives content)
    programmes.forEach((p: any) => {
      const programmeName = String(p.role || '').toLowerCase()
      voiceSystem.programmeSpecific[programmeName] = buildVoiceVariation(
        primaryArchetype,
        programmeName,
        ops.has_kids_menu
      )
    })
  }
  
  return voiceSystem
}
