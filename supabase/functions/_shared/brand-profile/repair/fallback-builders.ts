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
    const hasTerrasse = /terrasse|udend.rs|outdoor/i.test(combinedDesc)
    if (hasTerrasse) expBullets.push(isDanish ? 'Udendørs terrasse' : 'Outdoor terrace')
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
  
  // Get base venue type with mapping
  const rawVenueType = profile?.business_category || business?.vertical || 'Café'
  const venueTypeMap: Record<string, string> = {
    'hospitality': 'Café',
    'food_service': 'Restaurant',
    'cafe': 'Café',
    'restaurant': 'Restaurant',
    'bar': 'Bar',
    'bistro': 'Bistro'
  }
  const baseVenueType = venueTypeMap[rawVenueType.toLowerCase()] || rawVenueType

  const isDanish = String(language?.code || '').toLowerCase().startsWith('da') || String(language?.name || '').toLowerCase().includes('danish')

  // WP1: Programme-aware arc sentence for hybrid/bar venues
  const programmes: Array<{ role: string; timeContext: string | null; items: string[] }> | null | undefined =
    (dataSources as any).menuSignalProgrammes
  const openingHoursRows: Array<{ weekday: string; open_time: string; close_time: string }> | undefined =
    (dataSources as any).openingHoursRows

  const lateNight = openingHoursRows?.some(r => {
    const h = parseInt((r.close_time || '00:00').split(':')[0], 10)
    return h >= 0 && h < 6
  }) ?? false

  // Also check website_analyses.raw_result.analysis when structured data tables are empty
  const waAnalysis: any = (dataSources as any)?.websiteAnalysis?.raw_result?.analysis || {}
  const waKeywords: string[] = Array.isArray(waAnalysis?.keywords) ? waAnalysis.keywords : []
  const waUniqueHooks: any[] = waAnalysis?.venueHooks?.uniqueHooks || []
  const waAllText = `${waKeywords.join(' ')} ${waUniqueHooks.map((h: any) => `${h.hook || ''} ${h.text || ''}`).join(' ')}`.toLowerCase()
  const waHasBarSignal = /cocktail|bar\b|drink|aftensmad|aftensmenu|3[-.\s]rett|dinner|middag/i.test(waAllText)
  const waHasDaySignal = /brunch|frokost|morgen|morgenmad|lunch/i.test(waAllText)
  const waOpeningHours: Record<string, any> = waAnalysis?.openingHours || {}
  const waHasLateNight = Object.values(waOpeningHours).some((day: any) => {
    if (!day || day.closed) return false
    const h = parseInt((day.close || '').split(':')[0], 10)
    return !isNaN(h) && h >= 0 && h < 6
  })

  // Synthesize hybrid programmes from website signals when business_profile.menu_signal is empty
  let effectiveProgrammes = programmes && programmes.length >= 2 ? programmes : null
  if (!effectiveProgrammes && waHasDaySignal && (waHasBarSignal || waHasLateNight)) {
    // Build synthetic programmes from website signals
    const synth: Array<{ role: string; timeContext: string | null; items: string[] }> = []
    if (waHasDaySignal) synth.push({ role: 'brunch og frokost', timeContext: null, items: [] })
    if (waHasBarSignal) synth.push({ role: 'aftensmad og bar', timeContext: null, items: [] })
    else if (waHasLateNight) synth.push({ role: 'bar', timeContext: null, items: [] })
    if (synth.length >= 2) effectiveProgrammes = synth
  }
  const effectiveLateNight = lateNight || waHasLateNight

  if (effectiveProgrammes && effectiveProgrammes.length >= 2) {
    const roles = effectiveProgrammes.map(p => p.role.toLowerCase())
    const hasBrunch = roles.some(r => /brunch/i.test(r))
    const hasFrokost = roles.some(r => /frokost|lunch/i.test(r))
    const hasEvening = roles.some(r => /aften|3[-.\s]rett|dinner|middag|aftenret/i.test(r))
    const hasBar = effectiveLateNight || roles.some(r => /bar|cocktail|drink|øl|vin/i.test(r))

    // Build composite venue type label (e.g. "Café, restaurant og bar")
    const roleLabels: string[] = []
    if (hasBrunch || hasFrokost) roleLabels.push('café')
    if (hasEvening) roleLabels.push('restaurant')
    if (hasBar) roleLabels.push('bar')
    const compositeLabel = roleLabels.length >= 2
      ? roleLabels.slice(0, -1).join(', ') + ' og ' + roleLabels[roleLabels.length - 1]
      : roleLabels[0] || baseVenueType.toLowerCase()
    const hybridLabel = compositeLabel.charAt(0).toUpperCase() + compositeLabel.slice(1)

    // Build time arc if there are distinct day + evening phases
    const dayParts: string[] = []
    if (hasBrunch) dayParts.push('brunch')
    if (hasFrokost) dayParts.push('frokost')
    const eveningParts: string[] = []
    if (hasEvening) eveningParts.push('aftensmad')
    if (hasBar) eveningParts.push('drinks')

    if (dayParts.length > 0 && eveningParts.length > 0) {
      const dayText = dayParts.join(' og ')
      const eveningText = eveningParts.join(' og ')
      return isDanish
        ? `${hybridLabel} ${locationCue}, der serverer ${dayText} om dagen og skifter til ${eveningText} om aftenen.`
        : `${hybridLabel} at ${locationCue} serving ${dayText} by day and switching to ${eveningText} in the evening.`
    }

    // Multi-programme but no clear day/evening split — use composite label with best offering
    const offering = dayParts[0] || eveningParts[0] || effectiveProgrammes[0].role.toLowerCase()
    return isDanish
      ? `${hybridLabel} ${locationCue} hvor ${offering} og mere kan nydes hen over dagen.`
      : `${hybridLabel} at ${locationCue} where ${offering} and more can be enjoyed throughout the day.`
  }

  // Single-programme fallback — original simple sentence
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

  return isDanish
    ? `${baseVenueType} ${locationCue} hvor ${offering} kan nydes i roligt tempo.`
    : `${baseVenueType} at ${locationCue} where ${offering} can be enjoyed at a relaxed pace.`
}
