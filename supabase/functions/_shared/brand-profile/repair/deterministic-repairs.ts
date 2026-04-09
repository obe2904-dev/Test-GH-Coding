/**
 * Deterministic Repairs
 * 
 * Post-processing repairs that fix structural issues before validation.
 * v4.10.0 Phase 1: Uses auto-repair formatters instead of template replacement.
 */

import type { DataSources } from '../types.ts'
import type { LocaleConfig } from '../locales.ts'
import { buildBrandEssenceFallback, buildSignatureShotFallback, buildToneOfVoiceFallback, buildContentFocusFallback, removeBannedWords } from '../fallbacks.ts'
import { extractBrandEssenceConstraints, validateBrandEssence, buildConstrainedBrandEssence } from '../constraints/brand-essence-constraints.ts'
import { formatAndRepairProfile, type FormatContext } from './auto-repair-formatters.ts'

export function applyDeterministicRepairs(sections: any, dataSources: any, analysis: any, language: string, locale: LocaleConfig): any {
  // Create fallback context for robust fallbacks
  const fallbackCtx = {
    dataSources,
    analysis,
    locale,
    errors: (globalThis as any).requestErrors  // Global error collector
  }
  
  // Extract canonical location and venue type
  const location = dataSources?.location || {}
  const locationPhrase = location?.enrichment?.micro?.area_type === 'waterfront' ? (locale.preferredPhrasing['location_waterfront'] || 'ved åen')
    : location?.enrichment?.micro?.area_type === 'transit_hub' ? (locale.preferredPhrasing['location_transit'] || 'ved stationen')
    : location?.enrichment?.micro?.area_type === 'shopping_street' ? (locale.preferredPhrasing['location_shopping'] || 'på gågaden')
    : ''
  const city = location?.enrichment?.macro?.city || dataSources?.business?.city || 'byen'
  const canonicalLocationHook = locationPhrase ? `${locationPhrase} i ${city}` : city
  
  const business = dataSources?.business || {}
  const rawVenueType = business?.vertical || business?.business_category || 'restaurant'
  const venueType = locale.venueTypes[rawVenueType.toLowerCase()] || rawVenueType

  // Build context for auto-repair formatters
  const formatCtx: FormatContext = {
    locationHook: canonicalLocationHook,
    offeringTokens: extractOfferingTokens(dataSources),
    actionVerbs: ['skåler', 'spiser', 'hælder op', 'serverer', 'deler', 'skærer', 'nyder'],
    menuItems: extractMenuItems(dataSources),
    ctaTokens: extractCtaTokens(dataSources),
    brandNameTokens: extractBrandNameTokens(dataSources)
  }

  // 1. Remove banned words from ALL text fields (locale-aware)
  const removeWords = (text: string) => removeBannedWords(text, locale)
  
  if (sections?.tone_of_voice?.value) {
    sections.tone_of_voice.value = removeWords(sections.tone_of_voice.value)
  }
  if (sections?.target_audience?.value) {
    sections.target_audience.value = removeWords(sections.target_audience.value)
  }
  if (sections?.brand_essence?.value) {
    sections.brand_essence.value = removeWords(sections.brand_essence.value)
  }
  if (sections?.core_offerings?.value) {
    sections.core_offerings.value = removeWords(sections.core_offerings.value)
  }
  if (sections?.content_focus?.value) {
    sections.content_focus.value = removeWords(sections.content_focus.value)
  }
  
  if (sections?.cta_style?.value) {
    sections.cta_style.value = removeWords(sections.cta_style.value)
  }

  // 2. Apply auto-repair formatters (v4.10.0 Phase 1: NEW - inject missing components)
  console.log(`🔧 Applying auto-repair formatters...`)
  const repairResult = formatAndRepairProfile(sections, formatCtx)
  sections = repairResult.profile
  
  if (repairResult.repairs.length > 0) {
    console.log(`✅ Auto-repairs applied:`)
    repairResult.repairs.forEach(r => console.log(`   - ${r}`))
  }
  
  if (repairResult.warnings.length > 0) {
    console.log(`⚠️  Auto-repair warnings:`)
    repairResult.warnings.forEach(w => console.log(`   - ${w}`))
  }

  // 3. Force content_focus to cover 3 areas (food/service, atmosphere/interior, moments/transitions)
  if (sections?.content_focus?.value && typeof sections.content_focus.value === 'string') {
    const cf = sections.content_focus.value.toLowerCase()
    const hasFoodService = /mad|service|food|retter|menu|essen/i.test(cf)
    const hasAtmosphere = /stemning|atmosf[æä]re|interiør|interior|atmosphere/i.test(cf)
    const hasMoments = /folk|øjeblikke|moments|overgange|transitions|menschen|momente|gæster|liv\b|hverdags|sociale|sæson|tilholdssted/i.test(cf)
    
    if (!hasFoodService || !hasAtmosphere || !hasMoments) {
      console.log(`⚠️ content_focus missing 3 required areas, applying robust fallback`)
      const fallbackResult = buildContentFocusFallback(fallbackCtx)
      sections.content_focus = { ...(sections.content_focus && typeof sections.content_focus === 'object' ? sections.content_focus : {}), value: fallbackResult.value }
    }
  }

  // 4. Fallback for brand_essence if auto-repair didn't work (last resort)
  if (sections?.brand_essence?.value) {
    const constraints = extractBrandEssenceConstraints(dataSources)
    const validationResult = validateBrandEssence(sections.brand_essence.value, constraints)
    
    if (!validationResult.valid) {
      console.log(`⚠️ brand_essence still invalid after auto-repair: ${validationResult.errors.join(', ')}`)
      console.log(`🔧 Applying constraint-first template fallback`)
      sections.brand_essence = { ...(sections.brand_essence && typeof sections.brand_essence === 'object' ? sections.brand_essence : {}), value: buildConstrainedBrandEssence(constraints) }
    }
  } else {
    // No brand_essence generated at all - use constraint-first fallback
    console.log(`⚠️ brand_essence missing entirely, applying constraint-first fallback`)
    const constraints = extractBrandEssenceConstraints(dataSources)
    sections.brand_essence = { value: buildConstrainedBrandEssence(constraints) }
  }

  // 5. Fallback for signature_shot if auto-repair didn't work (removed old check)
  // Auto-repair handles this in formatAndRepairProfile above

  // 6. Auto-fill missing content_pillars notes (Fix #4 — ensure non-empty)
  if (Array.isArray(sections?.content_pillars)) {
    sections.content_pillars = sections.content_pillars.map((p: any) => {
      if (!p || typeof p !== 'object') return p
      if (p.encouraged !== true) return p
      
      const notes = typeof p.notes === 'string' ? p.notes.trim() : ''
      
      // Ensure notes is always non-empty string
      if (!notes) {
        const nextNotes = `Bygger på ${canonicalLocationHook} (#1)`
        return { ...p, notes: nextNotes }
      }
      
      // Ensure it has hook number OR location ref
      const hasHookNumber = /#\d+/.test(notes)
      const hasLocationRef = canonicalLocationHook && notes.toLowerCase().includes(canonicalLocationHook.toLowerCase())
      
      if (!hasHookNumber && !hasLocationRef) {
        const nextNotes = `${notes} (#1, ${canonicalLocationHook})`
        return { ...p, notes: nextNotes }
      }
      return p
    })
  }

  // STEP 6b: Fix core_offerings if AI listed specific menu item names instead of meal categories.
  // Detected by checking if bullet items match menu item names from the data.
  if (sections?.core_offerings?.value && typeof sections.core_offerings.value === 'string') {
    const menuItemNames = new Set(
      (dataSources?.menu || [])
        .filter((item: any) => item.name && item.name.length > 2)
        .map((item: any) => item.name.toLowerCase().trim())
    )

    const bullets = sections.core_offerings.value
      .split('\n')
      .map((line: string) => line.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)

    // If ≥2 bullets directly match a menu item name → AI used specific items, not categories.
    // Also catches ALL-CAPS item-style text (e.g. "DEN NYE", "FAVORITTEN") that lacks any meal-category keyword,
    // and article-starting Danish items (e.g. "DEN LUKSURIØSE BRUNCH", "DEN LILLE BRUNCH").
    const MEAL_CAT_SIGNAL = /\b(brunch|frokost|middag|morgenmad|aftensmad|lunch|kaffe|kage|drinks|cocktails?|terrasse|take.?away|private|bar)\b/i
    const specificItemCount = bullets.filter((b: string) => {
      const lower = b.toLowerCase()
      // 1. Direct exact, prefix, or substring match against known menu item names
      const directMatch = lower.length > 2 && [...menuItemNames].some(name =>
        name.length > 2 && (lower === name || lower.startsWith(name.slice(0, Math.min(8, name.length))) || lower.includes(name))
      )
      // 2. ALL-CAPS branded item text without any meal-category keyword (catches inflected names like "FAVORITTEN", "DEN NYE")
      //    "No lowercase letters AND has at least one letter AND not a meal category" signals a raw item name
      const isAllCapsNonCategory = /^[^a-zæøå]+$/.test(b.trim()) && b.trim().length >= 3 && /[A-ZÆØÅa-zæøå]/.test(b.trim()) && !MEAL_CAT_SIGNAL.test(b)
      // 3. Danish article-starting item: "DEN LUKSURIØSE BRUNCH", "DET STORE BORD" → always specific items, never category descriptions
      const isArticleItem = /^(DEN|DET|DE|EN|ET)\s+/i.test(b.trim())
      return directMatch || isAllCapsNonCategory || isArticleItem
    }).length

    if (specificItemCount >= 2) {
      console.log(`⚠️ core_offerings has ${specificItemCount} specific menu items — rebuilding as meal categories`)
      const catValue = buildDeterministicCoreOfferings(dataSources, analysis, canonicalLocationHook)
      sections.core_offerings = {
        ...(typeof sections.core_offerings === 'object' ? sections.core_offerings : {}),
        value: catValue
      }
      console.log(`✅ core_offerings rebuilt:\n${catValue}`)
    }
  }

  // STEP 7: Strip temporal/programme narration from brand_essence_elaboration.
  // AI invariably produces programme-description framing for hybrid venues (what they do/offer)
  // instead of competitive differentiation (why THIS place vs the next one).
  // Approach: for HYBRID venues, always rebuild deterministically.
  // For non-hybrid, rebuild only if temporal narration tokens are detected.
  {
    const TEMPORAL_RX = /\bOm dagen\b|\bOm aftenen\b|\bforvandles\b|\bskifter til\b|\bdag og aften\b|\bdag til aften\b|\bbåde dag og\b|\bdag ved\b/i
    // Detect programme-description framing ("kombinere", "tilbyder", "spænder fra ... til")
    const PROGRAMME_RX = /\bkombinerer\b|\bkombination af\b|\bspænder fra\b|\btilbyder [a-zæøå]+ og [a-zæøå]+/i

    const elab = sections?.brand_essence_elaboration
    const elaborationText: string = typeof elab === 'object' && elab !== null
      ? (elab.value || '')
      : (typeof elab === 'string' ? elab : '')

    // Determine if venue is hybrid (re-check here — isHybridVenue not in scope; use dataSources signals)
    const waAnal: any = dataSources?.websiteAnalysis?.raw_result?.analysis || {}
    const waKw: string[] = Array.isArray(waAnal?.keywords) ? waAnal.keywords : []
    const waHooks: any[] = waAnal?.venueHooks?.uniqueHooks || []
    const waText = `${waKw.join(' ')} ${waHooks.map((h: any) => `${h.hook || ''} ${h.text || ''}`).join(' ')}`.toLowerCase()
    const hasBarSignal7 = /cocktail|bar\b|drink|aftensmad|3[-.]?rett|dinner|middag/i.test(waText)
    const hasDaySignal7 = /brunch|frokost|morgen|morgenmad|lunch/i.test(waText)
    const isHybrid7 = hasDaySignal7 && hasBarSignal7

    const needsRebuild = elaborationText && (
      (isHybrid7 && PROGRAMME_RX.test(elaborationText)) ||
      TEMPORAL_RX.test(elaborationText)
    )

    if (needsRebuild) {
      console.log(`⚠️ brand_essence_elaboration contains programme framing — rebuilding with competitive framing (isHybrid=${isHybrid7})`)
      const rebuilt = buildElaborationFallback(canonicalLocationHook, venueType, dataSources, analysis)
      if (!sections.brand_essence_elaboration || typeof sections.brand_essence_elaboration !== 'object') {
        sections.brand_essence_elaboration = {}
      }
      sections.brand_essence_elaboration.value = rebuilt
      console.log(`✅ brand_essence_elaboration rebuilt: "${rebuilt.slice(0, 100)}..."`)
    }
  }

  // FINAL STEP: Deterministic brand_essence.value + proof overwrite.
  // AI consistently inflects brand names and adds spurious adjectives. This step runs LAST
  // so that no downstream fallback (validateBrandEssence / buildConstrainedBrandEssence) can undo it.
  {
    const deterministicValue = buildDeterministicBrandEssence(venueType, canonicalLocationHook, dataSources, analysis)
    if (!sections.brand_essence || typeof sections.brand_essence !== 'object') {
      sections.brand_essence = {}
    }
    sections.brand_essence.value = deterministicValue

    // Build deterministic proof bullets from signals actually used
    const proofBullets: string[] = []
    if (canonicalLocationHook) proofBullets.push(`Lokationshook "${canonicalLocationHook}" fra lokationsdata`)
    const offeringPhrase = extractMealCategoryPhrase(dataSources, analysis) ?? extractOfferingPhraseFromDescription(dataSources)
    if (offeringPhrase) proofBullets.push(`Tilbudsformulering "${offeringPhrase}" fra data`)
    const hook = extractBehavioralHook(analysis)
    if (hook) proofBullets.push(`Adfærdshook "${hook}" fra rituals_and_moments`)
    if (proofBullets.length > 0) {
      sections.brand_essence.proof = proofBullets.slice(0, 3)
    }

    console.log(`🎯 brand_essence.value set deterministically: "${deterministicValue}"`)
  }

  return sections
}

// Meal category keywords (same list as prompt-b.ts)
const MEAL_CATEGORY_KEYWORDS_REPAIR = ['BRUNCH', 'FROKOST', 'MIDDAG', 'MORGENMAD', 'AFTENSMAD', 'LUNCH', 'SUPPE', 'SALAT']

/**
 * Builds a deterministic core_offerings value using meal CATEGORIES + experience anchors.
 * Called when the AI has output specific menu item names (e.g. "FAVORITTEN") instead of
 * broad meal-time categories (e.g. "Brunch og morgenmad").
 */
function buildDeterministicCoreOfferings(dataSources: any, analysis: any, canonicalLocationHook: string): string {
  const shortDesc: string = (dataSources?.profile as any)?.short_description || ''
  const longDesc: string = (dataSources?.profile as any)?.long_description || ''
  const combinedDesc = (shortDesc + ' ' + longDesc).toLowerCase()

  // Derive meal category bullets from description text
  const mealBullets: string[] = []

  if (/brunch/i.test(combinedDesc)) mealBullets.push('- Brunch og morgenmad')
  if (/frokost|lunch|smørrebrød|salat/i.test(combinedDesc)) mealBullets.push('- Frokost og lette retter')
  if (/middag|3-retters|tre.retters|aftensmad/i.test(combinedDesc)) mealBullets.push('- Middagsmenuer og 3-retters')
  if (/cocktail|drinks|bar|vin|øl/i.test(combinedDesc)) mealBullets.push('- Drinks og cocktails')
  if (/kaffe|kage|dessert|pastry/i.test(combinedDesc)) mealBullets.push('- Kaffe, kage og desserter')

  // Fallback if we found fewer than 3 meal categories
  if (mealBullets.length < 3) {
    if (!mealBullets.some(b => /frokost/i.test(b))) mealBullets.push('- Frokost og lette retter')
    if (mealBullets.length < 3) mealBullets.push('- Kaffe og kage')
  }

  // Experience / service anchors
  const expBullets: string[] = []
  const hasTerrasse = /terrasse|udend.rs|outdoor/i.test(combinedDesc)
  const locationRef = canonicalLocationHook ? ` ${canonicalLocationHook}` : ''
  expBullets.push(hasTerrasse ? `- Udendørs terrasse${locationRef}` : `- Afslappede siddepladser${locationRef}`)

  if (/event|privat|selskab|reception/i.test(combinedDesc)) {
    expBullets.push('- Private events og selskaber')
  } else {
    expBullets.push('- Oplevelser med god tid og slappe af')
  }

  const allBullets = [...mealBullets.slice(0, 3), ...expBullets.slice(0, 2)]
  return allBullets.join('\n')
}

/**
 * These must appear VERBATIM in brand_essence — never inflected/paraphrased.
 * E.g. "THE FAVORIT", "THE NEW ONE", "EXTRA : PANCAKES"
 */
function extractBrandNameTokens(dataSources: any): string[] {
  const menu = dataSources?.menu || []
  return menu
    .filter((item: any) => {
      if (!item.name || item.name.length < 3) return false
      const nameUp = item.name.toUpperCase().trim()
      // Exclude pure meal-category items
      const isMealCategory = MEAL_CATEGORY_KEYWORDS_REPAIR.some(cat =>
        nameUp === cat || nameUp.startsWith(cat + ' ') || nameUp.endsWith(' ' + cat) || nameUp.includes(' ' + cat + ' ')
      )
      // Include only items whose original name is ALL-CAPS (brand names like "THE FAVORIT")
      const isAllCaps = /^[A-Z\s:]+$/.test(item.name.trim())
      return isAllCaps && !isMealCategory
    })
    .slice(0, 6)
    .map((item: any) => item.name.trim())
}

/**
 * Helper: Extract offering tokens from data sources
 */
function extractOfferingTokens(dataSources: any): string[] {
  const menu = dataSources?.menu || []
  const topItems = menu
    .filter((item: any) => item.name && item.name.length > 3)
    .slice(0, 5)
    .map((item: any) => item.name.toUpperCase())
  
  // Prefer BRUNCH > MIDDAG > COCKTAILS if present
  const priority = ['BRUNCH', 'MIDDAG', 'COCKTAILS', 'FROKOST', 'AFTEN']
  const sorted = [...topItems].sort((a, b) => {
    const aIdx = priority.findIndex(p => a.includes(p))
    const bIdx = priority.findIndex(p => b.includes(p))
    if (aIdx === -1 && bIdx === -1) return 0
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  })
  
  return sorted.length > 0 ? sorted : ['MAD']
}

/**
 * Helper: Extract menu items (lowercase, natural form)
 */
function extractMenuItems(dataSources: any): string[] {
  const menu = dataSources?.menu || []
  return menu
    .filter((item: any) => item.name && item.name.length > 3)
    .slice(0, 8)
    .map((item: any) => item.name.toLowerCase())
}

/**
 * Helper: Extract CTA tokens from website analysis
 */
function extractCtaTokens(dataSources: any): string[] {
  const websiteAnalysis = dataSources?.websiteAnalysis
  return websiteAnalysis?.cta_texts || []
}

/**
 * Extracts offering phrase from the business's own description/hero text.
 * Priority: hero_texts → short_description → long_description
 * Looks for "noun og noun" pattern after stripping the business name and filler words.
 * E.g. "lækker mad og unikke oplevelser" → "mad og oplevelser"
 */
function extractOfferingPhraseFromDescription(dataSources: any): string | null {
  const profile = (dataSources?.profile as any) || {}
  const website = (dataSources?.websiteAnalysis as any) || {}

  // Candidate texts — short_description first (most curated)
  const candidates: string[] = []
  if (profile.short_description) candidates.push(profile.short_description)

  // hero_texts from DB column OR raw_result.extracted fallback
  if (website.hero_texts) {
    const heroTexts = Array.isArray(website.hero_texts) ? website.hero_texts : [website.hero_texts]
    candidates.push(...heroTexts.filter(Boolean))
  } else {
    try {
      const raw = typeof website.raw_result === 'string' ? JSON.parse(website.raw_result) : website.raw_result
      const extracted = raw?.extracted || raw?.analysis?.extracted || null
      if (extracted?.hero_texts) {
        const heroList = Array.isArray(extracted.hero_texts) ? extracted.hero_texts : [extracted.hero_texts]
        candidates.push(...heroList.filter(Boolean))
      }
    } catch { /* ignore parse errors */ }
  }

  if (profile.long_description) candidates.push(profile.long_description)
  if (website.homepage_content) candidates.push(website.homepage_content)

  const STRIP_WORDS = [
    'lækker', 'lækkert', 'lækre', 'hyggelig', 'hyggeligt', 'unikke', 'unik',
    'autentisk', 'autentiske', 'fantastisk', 'fantastiske', 'indbydende', 'afslappet',
    'afslappede', 'charmerende', 'vidunderlig', 'vidunderlige', 'delikate', 'friske', 'frisk',
    'spændende', 'spændende', 'skønne', 'skønt', 'skøn'
  ]
  const LOCATION_STOP = /\b(ved åen|ved stationen|på gågaden|i Aarhus|i København|i Odense|i Aalborg|i Esbjerg|i centrum|i kvarteret|\bi \w+borg\b)/i
  const SKIP = new Set(['den', 'det', 'de', 'en', 'et', 'på', 'ved', 'til', 'fra', 'med', 'af', 'og', 'i', 'alt', 'der', 'som', 'kan', 'du', 'vi', 'du', 'man', 'for', 'her', 'hos'])
  // Nouns too vague to serve as the offering phrase anchor (e.g. "mad og oplevelser" = generic)
  const VAGUE_NOUNS = new Set(['oplevelser', 'muligheder', 'tilbud', 'aktiviteter', 'ting', 'mad'])
  // At least one word in the pair should be a recognisable food/service/experience noun
  const FOOD_NOUNS = /\b(mad|oplevelser|brunch|frokost|middag|kaffe|menu|retter|f\u00f8devarer|drikke|cocktail|vin|\u00f8l|service|ophold|oplevelse|stemning|smag)\b/i

  const stripBannedWords = (t: string): string => {
    let s = t
    for (const bw of STRIP_WORDS) {
      s = s.replace(new RegExp(`\\b${bw}\\b\\s*`, 'gi'), '')
    }
    return s.replace(/\s{2,}/g, ' ').trim()
  }

  const tryExtract = (segment: string): string | null => {
    const clean = stripBannedWords(segment.trim())
    if (clean.length < 8) return null
    const stopIdx = clean.search(LOCATION_STOP)
    const searchText = stopIdx > 0 ? clean.slice(0, stopIdx) : clean

    const m = searchText.match(/\b([a-zæøåA-ZÆØÅ]+(?:\s+[a-zæøåA-ZÆØÅ]+)?)\s+og\s+([a-zæøåA-ZÆØÅ]+(?:\s+[a-zæøåA-ZÆØÅ]+)?)\b/)
    if (!m) return null
    const w1 = m[1].toLowerCase().trim()
    const w2 = m[2].toLowerCase().trim()
    // Check each component word — "på mad" passes SKIP.has("på mad") but SKIP.has("på") should block it
    const w1Words = w1.split(/\s+/)
    const w2Words = w2.split(/\s+/)
    if (w1Words.some(w => SKIP.has(w)) || w2Words.some(w => SKIP.has(w))) return null
    if (!FOOD_NOUNS.test(w1) && !FOOD_NOUNS.test(w2)) return null
    // Skip pairs where both words are too generic (e.g. "mad og oplevelser")
    if (VAGUE_NOUNS.has(w1) && VAGUE_NOUNS.has(w2)) return null
    return `${w1} og ${w2}`
  }

  for (const text of candidates) {
    if (!text || typeof text !== 'string') continue

    // Method 1: Find text after a known intro verb ("byder på", "tilbyder", etc.)
    // "Café Faust byder på lækker mad og unikke oplevelser ved åen" → extract "lækker mad og unikke oplevelser ved åen"
    const introMatch = text.match(/\b(?:byder p\u00e5|tilbyder|serverer|finder du|byd p\u00e5)\s+(.{5,200})/i)
    if (introMatch) {
      const result = tryExtract(introMatch[1])
      if (result) return result
    }

    // Method 2: Try the whole text (works for hero texts like "lækker mad og oplevelser ved åen")
    const result2 = tryExtract(text)
    if (result2) return result2
  }

  return null
}

/**
 * Fallback offering phrase: extract best meal category names from menu / signals.
 */
function extractMealCategoryPhrase(dataSources: any, analysis: any): string | null {
  const menuItems: string[] = (dataSources?.menu || [])
    .map((item: any) => (item.name || '').toUpperCase())
  const MEAL_CATS = ['BRUNCH', 'FROKOST', 'MIDDAG', 'MORGENMAD', 'AFTENSMAD', 'LUNCH']
  const foundMenu = MEAL_CATS.filter(cat =>
    menuItems.some(name => name === cat || name.startsWith(cat + ' ') || name.endsWith(' ' + cat))
  )
  if (foundMenu.length >= 2) return `${foundMenu[0].toLowerCase()} og ${foundMenu[1].toLowerCase()}`

  // Also scan short + long description + AI menu summaries for meal category keywords
  // aiSummaryItems are bullet lines from menu_results_v2.ai_summary — these describe offering
  // categories in natural language and are far more reliable than raw item names for hybrid venues
  const shortDesc: string = (dataSources?.profile as any)?.short_description || ''
  const longDesc: string = (dataSources?.profile as any)?.long_description || ''
  const aiSummaryText: string = ((dataSources as any)?.aiSummaryItems || []).join(' ')
  const combinedDesc = (shortDesc + ' ' + longDesc + ' ' + aiSummaryText).toLowerCase()
  const foundDesc = MEAL_CATS.filter(cat => new RegExp(`\\b${cat.toLowerCase()}\\b`).test(combinedDesc))

  // Merge (menu findings take priority; dedupe)
  const merged = [...new Set([...foundMenu, ...foundDesc])]
  if (merged.length >= 2) return `${merged[0].toLowerCase()} og ${merged[1].toLowerCase()}`
  // Single category is not enough — return null so the next priority in the chain runs
  // (extractOfferingPhraseFromDescription, then hard fallback 'brunch og frokost')

  // Try must_use_phrases from analysis signals
  const signals = analysis?.signals || {}
  for (const sig of Object.values(signals) as any[]) {
    for (const phrase of (sig?.must_use_phrases || [])) {
      const pu = String(phrase).toUpperCase()
      for (const cat of MEAL_CATS) {
        if (pu.includes(cat)) return cat.toLowerCase()
      }
    }
  }
  return null
}

/**
 * Extracts a behavioral hook (flow/duration/transition phrase) from Prompt A analysis.
 * Hook describes HOW the guest experiences the venue — not WHAT they eat or WHERE it is.
 */
function extractBehavioralHook(analysis: any): string {
  // Primary: rituals_and_moments[0].moment
  const moment = analysis?.rituals_and_moments?.[0]?.moment
  if (moment && typeof moment === 'string') {
    const m = moment.trim().replace(/\.$/, '').toLowerCase()
    // Use only short flow/duration phrases; skip full descriptive sentences
    if (m.length > 3 && m.length < 60 && !/^(café|restaurant|bar)/i.test(m)) {
      if (/tempo|tid|aften|dag|overgang|glider|ophold|morgen|solen/i.test(m)) {
        return m
      }
    }
  }

  // Secondary: scan usage_occasions for recognized flow phrases
  const occasions = analysis?.usage_occasions || []
  const FLOW = /\b(i roligt tempo|i eget tempo|med god tid|fra dag til aften|glider naturligt|lange ophold|i afslappet tempo|over lang tid)\b/i
  for (const occ of occasions.slice(0, 4)) {
    for (const field of [occ.behavior, occ.when, occ.situation]) {
      if (!field) continue
      const found = String(field).match(FLOW)
      if (found) return found[1].toLowerCase()
    }
  }

  return 'i roligt tempo'
}

/**
 * MAIN: Builds brand_essence.value deterministically from 4 fixed slots.
 * Completely bypasses AI generation — AI consistently inflects brand names
 * and adds spurious adjectives regardless of prompting.
 *
 * Pattern: "[venue] [location] hvor [offering] kan nydes [hook]."
 * Example: "Café ved åen i Aarhus hvor mad og oplevelser kan nydes i roligt tempo."
 */
export function buildDeterministicBrandEssence(
  venueType: string,
  canonicalLocationHook: string,
  dataSources: any,
  analysis: any
): string {
  // -- Hybrid venue detection: check both structured tables AND website_analyses.raw_result.analysis --

  // Source 1: business_profile.menu_signal + opening_hours table
  const menuSignalProgrammes: any[] | null = dataSources?.menuSignalProgrammes ?? null
  const openingHoursRows: any[] = dataSources?.openingHoursRows ?? []
  const tableLateNight = openingHoursRows.some((r: any) => {
    const h = parseInt((r.close_time || '99:00').split(':')[0], 10); return h >= 0 && h < 6
  })

  // Source 2: website_analyses.raw_result.analysis
  const waAnalysis: any = dataSources?.websiteAnalysis?.raw_result?.analysis || {}
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

  // Combined hybrid determination
  const hasMultipleProgrammes =
    (menuSignalProgrammes != null && menuSignalProgrammes.length >= 2) ||
    (waHasDaySignal && waHasBarSignal)
  const hasBarOrEveningSignal =
    tableLateNight || waHasBarSignal || waHasLateNight ||
    (menuSignalProgrammes?.some((p: any) => /bar|cocktail|drink|aften|3[-.\s]rett|dinner|middag/i.test(p.role)))
  const isHybridVenue = hasMultipleProgrammes && hasBarOrEveningSignal

  if (isHybridVenue) {
    // Build composite venue label from programmes or website signals
    const programmes: any[] = menuSignalProgrammes && menuSignalProgrammes.length >= 2
      ? menuSignalProgrammes
      : [{ role: 'brunch og frokost' }, { role: 'aftensmad og bar' }]

    const roles = programmes.map((p: any) => (p.role || '').toLowerCase())
    const hasBrunch = roles.some(r => /brunch/i.test(r)) || waHasDaySignal
    const hasFrokost = roles.some(r => /frokost|lunch/i.test(r)) || waHasDaySignal
    const hasEvening = roles.some(r => /aften|3[-.\s]rett|dinner|middag/i.test(r)) || waHasBarSignal
    const hasBar = tableLateNight || waHasLateNight || roles.some(r => /bar|cocktail|drink|øl|vin/i.test(r)) || waHasBarSignal

    const roleLabels: string[] = []
    if (hasBrunch || hasFrokost) roleLabels.push('café')
    if (hasEvening) roleLabels.push('restaurant')
    if (hasBar) roleLabels.push('bar')
    const compositeLabel = roleLabels.length >= 2
      ? roleLabels.slice(0, -1).join(', ') + ' og ' + roleLabels[roleLabels.length - 1]
      : roleLabels[0] || venueType.toLowerCase()
    const hybridVenueType = compositeLabel.charAt(0).toUpperCase() + compositeLabel.slice(1)

    const dayParts: string[] = []
    if (hasBrunch) dayParts.push('brunch')
    if (hasFrokost && !hasBrunch) dayParts.push('frokost')
    else if (hasFrokost) dayParts.push('frokost')
    const eveningParts: string[] = []
    if (hasEvening) eveningParts.push('aftensmad')
    if (hasBar) eveningParts.push('drinks')

    if (dayParts.length > 0 && eveningParts.length > 0) {
      const dayText = dayParts.slice(0, 2).join(' og ')
      const eveningText = eveningParts.join(' og ')
      const result = `${hybridVenueType} ${canonicalLocationHook}, der serverer ${dayText} om dagen og skifter til ${eveningText} om aftenen.`
      console.log(`🎯 Deterministic brand_essence (HYBRID arc): "${result}"`)
      return result
    }
  }

  // Simple venue fallback — original pattern
  const offeringPhrase =
    extractMealCategoryPhrase(dataSources, analysis) ??
    extractOfferingPhraseFromDescription(dataSources) ??
    'brunch og frokost'

  const behavioralHook = extractBehavioralHook(analysis)

  const result = `${venueType} ${canonicalLocationHook} hvor ${offeringPhrase} kan nydes ${behavioralHook}.`
  console.log(`🎯 Deterministic brand_essence: offering="${offeringPhrase}", hook="${behavioralHook}"`)
  return result
}

/**
 * Builds brand_essence_elaboration deterministically using competitive differentiation framing.
 * Called when AI output contains temporal narration ("Om dagen/aftenen/forvandles/skifter til").
 */
function buildElaborationFallback(
  canonicalLocationHook: string,
  venueType: string,
  dataSources: any,
  analysis: any
): string {
  const location = dataSources?.location || {}
  const isWaterfront = location?.enrichment?.micro?.area_type === 'waterfront'
  const profile = (dataSources?.profile as any) || {}
  const businessName: string = profile.business_name || profile.name || dataSources?.business?.business_name || dataSources?.business?.name || dataSources?.business?.display_name || (dataSources?.profile as any)?.business_name || (dataSources?.profile as any)?.name || ''
  const city = canonicalLocationHook.split(' i ')[1] || 'byen'
  const priceLevel: string = dataSources?.business?.price_level || dataSources?.business?.priceRange || ''
  const pricePart = priceLevel === 'budget' ? 'et lavprisformat'
    : priceLevel === 'premium' ? 'et højere prisleje'
    : 'et midtklasse prisleje'

  const locationDiff = isWaterfront
    ? `beliggenheden ${canonicalLocationHook} — en placering de fleste ${venueType.toLowerCase()}er i ${city} ikke kan matche`
    : `beliggenheden ${canonicalLocationHook}`

  const offeringPhrase = extractMealCategoryPhrase(dataSources, analysis)
    ?? extractOfferingPhraseFromDescription(dataSources)
    ?? 'brunch og frokost'

  const nameOrType = businessName || venueType
  const s1 = `${nameOrType} er et oplagt valg til ${offeringPhrase} fordi ${locationDiff} giver et naturligt tilholdssted fremfor blot endnu en café i gadebilledet.`
  const s2 = `Tilbuddet i ${pricePart} placerer stedet i en konkret niche — et alternativ for gæster der søger mere end standardformatet.`

  return `${s1} ${s2}`
}

/**
 * Builds all 6 content pillars deterministically using venue signals.
 * Called when AI returns 0 items for content_pillars.
 * Sets encouraged=true for pillars that match confirmed venue signals.
 */
export function buildContentPillarsFallback(dataSources: any, analysis: any, locationHook?: string): any[] {
  const location = dataSources?.location || {}
  const isWaterfront = location?.enrichment?.micro?.area_type === 'waterfront'
  const hasDistinctiveLocation = !!location?.enrichment?.micro?.area_type
  const businessName: string = (dataSources?.profile as any)?.business_name
    || (dataSources?.profile as any)?.name
    || dataSources?.business?.business_name
    || dataSources?.business?.name
    || 'Stedet'
  const city: string = location?.enrichment?.macro?.city || dataSources?.business?.city || 'byen'
  const locationLabel = isWaterfront ? `${locationHook || 'ved vandet'} i ${city}` : hasDistinctiveLocation ? `den centrale placering i ${city}` : `beliggenheden i ${city}`

  // Determine if the venue is food-led, craft-led, or event-led
  const hasFoodMenu = !!(dataSources?.menu?.length || dataSources?.menuSummaries?.length
    || analysis?.offerings?.meals?.length)
  const hasTerraceOrOutdoor = /terrasse|udendørs|udeservering|outdoor/i.test(
    JSON.stringify(dataSources?.business || dataSources?.operations || {})
  )
  const hasEvents = /event|arrangement|koncert|markedsdag|sæson/i.test(
    JSON.stringify(dataSources?.websiteAnalysis || dataSources?.operations || {})
  )
  const craftSignals = /hjemmelavet|specialkaffe|single origin|håndværk|craft|bryg|syrnet|fermenteret/i.test(
    JSON.stringify(dataSources?.menu || dataSources?.websiteAnalysis || {})
  )

  const vibeEncouraged = isWaterfront || hasTerraceOrOutdoor || hasDistinctiveLocation
  const vibeNotes = isWaterfront
    ? `${businessName} ligger direkte ${locationHook || 'ved vandet'} — atmosfærebilleder af lyset og livet ved terrassen er oplagt primært indhold.`
    : hasTerraceOrOutdoor
    ? `Udendørsarealerne giver naturlige vibe-billeder i godt vejr — indhold der sælger oplevelsen af at sidde udenfor.`
    : `Fysiske rammer og belysning kan understøtte stemningsbilleder — brug konkrete detaljer fra interiøret som signal.`

  return [
    {
      pillar: 'Crave-worthy',
      allowed: true,
      encouraged: hasFoodMenu,
      notes: hasFoodMenu
        ? `Mad og drikkevarer er kernen i ${businessName}s tilbud — visuelle retter giver direkte lyst til at bestille og besøge.`
        : `Produktvisuals kan bruges punktvist men er ikke den primære driver — fokus er identitet frem for begær.`
    },
    {
      pillar: 'BTS',
      allowed: true,
      encouraged: craftSignals,
      notes: craftSignals
        ? `Produktionsprocesser og håndværk på køkkenet er relevante: vis forberedelserne frem for kun det færdige resultat.`
        : `Behind-the-scenes kan bruges lejlighedsvis til at humanisere stedet — staff, opsætning, hverdagsmomentetter.`
    },
    {
      pillar: 'Social proof',
      allowed: true,
      encouraged: hasDistinctiveLocation,
      notes: hasDistinctiveLocation
        ? `${locationLabel} er et destinationsvalg — gæstebilleder og taggede besøg forstærker at stedet er værd at tage turen til.`
        : `Sociale beviser fungerer som supplement — reshare eller citer konkrete gæstereaktioner frem for generiske anmeldelser.`
    },
    {
      pillar: 'Vibe',
      allowed: true,
      encouraged: vibeEncouraged,
      notes: vibeNotes
    },
    {
      pillar: 'Engagement',
      allowed: true,
      encouraged: false,
      notes: `Interaktivt indhold (spørgsmål, afstemninger) bruges punktvist til at tage temperaturen på gæsternes præferencer — ikke som primær kanal.`
    },
    {
      pillar: 'Offers',
      allowed: true,
      encouraged: hasEvents,
      notes: hasEvents
        ? `Events og sæsonspecifikke arrangementer giver naturlige anledninger til tilbudsindhold — brug disse til at drive trafik.`
        : `Tilbud og kampagner bruges sparsomt for at bevare brandintegritet — kun ved konkrete anledninger eller sæsonfokus.`
    }
  ]
}

