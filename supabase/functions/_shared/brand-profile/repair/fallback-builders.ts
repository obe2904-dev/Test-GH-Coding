/**
 * Fallback Builders
 * 
 * Functions that generate deterministic fallback values when AI fails to produce valid output.
 * Locale-aware and based on structured data from business profile, menu, location, etc.
 */

import type { DataSources, LanguageConfig } from '../types.ts'

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

export function buildFallbackTargetAudience(dataSources: DataSources, analysis: any, language: LanguageConfig): { value: string; proof: string[] } {
  const business = (dataSources as any)?.business || {}
  const city = typeof business.city === 'string' ? business.city.trim() : ''
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
    ? `Lokale gæster og besøgende, der søger ${mealPhrase}${locationTail ? ` ${locationTail}` : ''}.`
    : `Locals and visitors looking for ${mealPhrase}${locationTail ? ` ${locationTail}` : ''}.`

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

  if (Array.isArray((dataSources as any)?.menu)) {
    for (const item of (dataSources as any).menu.slice(0, 80)) {
      push((item as any)?.name)
      push((item as any)?.title)
      push((item as any)?.item_name)
      push((item as any)?.category)
    }
  }

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const GENERIC_FRAGMENTS = ['mad og drikke', 'lækker mad', 'lækre oplevelser', 'hyggelig stemning', 'good vibes', 'culinary experiences']

  const uniq: string[] = []
  for (const c of candidates) {
    const t = c.trim()
    if (!t) continue
    const n = norm(t)
    if (n.length < 3) continue
    if (GENERIC_FRAGMENTS.some(g => n.includes(norm(g)))) continue
    if (uniq.some(u => norm(u) === n)) continue
    uniq.push(t)
    if (uniq.length >= 6) break
  }

  const offerings = uniq.length > 0 ? uniq : (isDanish ? ['brunch', 'frokost', 'middag'] : ['brunch', 'lunch', 'dinner'])
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
    (isDanish ? 'interiør og lys' : 'interior + light')

  const momentCue =
    (analysis?.rituals_and_moments || []).map((x: any) => x?.moment).find((m: any) => typeof m === 'string' && m.trim().length > 3) ||
    (isDanish ? 'mennesker og øjeblikke i hverdagen' : 'people + everyday moments')

  const lines = isDanish
    ? [
        `- Mad & servering (konkret: ${menuAnchor})`,
        `- Stemning & oplevelse (interiør/lys/rum: ${spaceCue})`,
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

  // Use enriched location if available
  const locationPhrase = location?.enrichment?.micro?.area_type === 'waterfront' ? 'åen'
    : location?.enrichment?.micro?.area_type === 'transit_hub' ? 'stationen'
    : location?.enrichment?.micro?.area_type === 'shopping_street' ? 'gågaden'
    : ''
  
  const city = location?.enrichment?.macro?.city || business.city || 'byen'
  const locationCue = locationPhrase ? `${locationPhrase} i ${city}` : city

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

  // Use enriched location if available
  const locationPhrase = location?.enrichment?.micro?.area_type === 'waterfront' ? 'ved åen'
    : location?.enrichment?.micro?.area_type === 'transit_hub' ? 'ved stationen'
    : location?.enrichment?.micro?.area_type === 'shopping_street' ? 'på gågaden'
    : ''
  
  const city = location?.enrichment?.macro?.city || business.city || 'byen'
  const locationCue = locationPhrase ? `${locationPhrase} i ${city}` : `i ${city}`
  
  // Get venue type with mapping
  const rawVenueType = profile?.business_category || business?.vertical || 'Café'
  const venueTypeMap: Record<string, string> = {
    'hospitality': 'Café',
    'food_service': 'Restaurant',
    'cafe': 'Café',
    'restaurant': 'Restaurant',
    'bar': 'Bar',
    'bistro': 'Bistro'
  }
  const venueType = venueTypeMap[rawVenueType.toLowerCase()] || rawVenueType

  const offeringCandidates: string[] = []
  const push = (v: unknown) => {
    if (typeof v !== 'string') return
    const t = v.trim()
    if (t.length < 2) return
    offeringCandidates.push(t)
  }
  ;(analysis?.signals?.core_offerings?.concrete_anchors || []).forEach(push)
  ;(analysis?.signals?.core_offerings?.must_use_phrases || []).forEach(push)
  if (Array.isArray((dataSources as any)?.menu)) {
    for (const item of (dataSources as any).menu.slice(0, 20)) {
      push((item as any)?.name)
      push((item as any)?.title)
      push((item as any)?.item_name)
      push((item as any)?.category)
    }
  }

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const GENERIC_OFFERING_FRAGMENTS = ['mad og drikke', 'lækker mad', 'kulinariske oplevelser', 'culinary experiences']
  const offering =
    offeringCandidates.find(o => o.length <= 40 && !GENERIC_OFFERING_FRAGMENTS.some(g => norm(o).includes(norm(g)))) ||
    offeringCandidates.find(o => !GENERIC_OFFERING_FRAGMENTS.some(g => norm(o).includes(norm(g)))) ||
    'brunch'

  const isDanish = String(language?.code || '').toLowerCase().startsWith('da') || String(language?.name || '').toLowerCase().includes('danish')
  
  // Deterministic format: venue_type + location_cue + offering_cue + behavioral_hook
  return isDanish
    ? `${venueType} ${locationCue} hvor ${offering} kan nydes i roligt tempo.`
    : `${venueType} at ${locationCue} where ${offering} can be enjoyed at a relaxed pace.`
}
