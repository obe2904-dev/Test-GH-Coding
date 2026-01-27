/**
 * Brand Profile Signal Extractor
 * 
 * Extracts structured signals from website analysis data.
 * Includes fallback logic to ensure must-use phrases are never empty.
 */

import type { DataSources } from './types.ts'

// Helper: Convert value to array of strings
const toStringArray = (v: unknown): string[] => 
  Array.isArray(v) ? v.filter(Boolean).map((x: unknown) => String(x).trim()).filter(Boolean) : []

// Helper: Deduplicate array while preserving original case
const uniqueArray = (arr: string[]): string[] => 
  Array.from(new Set(arr.map(s => s.toLowerCase()))).map(k => arr.find(s => s.toLowerCase() === k)!).filter(Boolean)

const parseJsonIfString = (value: any): any | null => {
  if (value == null) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

/**
 * Structured data extracted from website analysis.
 */
export interface StructuredWebsiteData {
  headers: string[]
  heroTexts: string[]
  navItems: string[]
  ctaTexts: string[]
  metaTitles: string[]
  metaDescriptions: string[]
  aboutSnippets: string[]
  imageAltSignals: string[]
  imageCaptions: string[]
  uniqueNounCues: string[]
  valuePhrases: string[]
  menuCategoriesMentioned: string[]
  aboutTone: string
  rawExcerpt: string
}

/**
 * Extracts structured website data from website analysis.
 * 
 * Looks for:
 * - Headers (H1/H2/H3)
 * - CTA texts (buttons, links)
 * - Value phrases (slogans, taglines)
 * - Menu categories mentioned
 * - Tone indicators
 * 
 * @param websiteAnalysis - Website analysis record from DB
 * @param business - Business record (fallback source)
 * @returns Structured website data
 */
export function extractStructuredWebsiteData(
  websiteAnalysis: any, 
  business?: any
): StructuredWebsiteData {
  if (!websiteAnalysis && !business?.website_analysis) {
    return {
      headers: [],
      heroTexts: [],
      navItems: [],
      ctaTexts: [],
      metaTitles: [],
      metaDescriptions: [],
      aboutSnippets: [],
      imageAltSignals: [],
      imageCaptions: [],
      uniqueNounCues: [],
      valuePhrases: [],
      menuCategoriesMentioned: [],
      aboutTone: 'N/A',
      rawExcerpt: ''
    }
  }

  const headers: string[] = []
  const heroTexts: string[] = []
  const navItems: string[] = []
  const ctaTexts: string[] = []
  const metaTitles: string[] = []
  const metaDescriptions: string[] = []
  const aboutSnippets: string[] = []
  const imageAltSignals: string[] = []
  const imageCaptions: string[] = []
  const valuePhrases: string[] = []
  const menuCategoriesMentioned: string[] = []

  // Prefer new DB columns (true extracted structure)
  const columnHeaders = websiteAnalysis ? toStringArray(websiteAnalysis.headers) : []
  const columnCtas = websiteAnalysis ? toStringArray(websiteAnalysis.cta_texts) : []
  const columnNav = websiteAnalysis ? toStringArray(websiteAnalysis.nav_items) : []
  const columnHero = websiteAnalysis ? toStringArray(websiteAnalysis.hero_texts) : []

  // Fallback: extracted structure embedded in raw_result (from worker)
  const rawResultAny = (websiteAnalysis && websiteAnalysis.raw_result) || business?.website_analysis || null
  const rawResult = parseJsonIfString(rawResultAny)
  const rawExtracted = rawResult?.extracted || rawResult?.analysis?.extracted || null
  const extractedHeaders = toStringArray(rawExtracted?.headers)
  const extractedCtas = toStringArray(rawExtracted?.cta_texts)
  const extractedNav = toStringArray(rawExtracted?.nav_items)
  const extractedHero = toStringArray(rawExtracted?.hero_texts)

  const extractedMetaTitles = toStringArray(
    rawExtracted?.meta_titles ||
    rawExtracted?.page_titles ||
    rawExtracted?.og_titles
  )
  const extractedMetaDescriptions = toStringArray(
    rawExtracted?.meta_descriptions ||
    rawExtracted?.descriptions ||
    rawExtracted?.og_descriptions
  )

  const extractedImageSignals = toStringArray(
    rawExtracted?.image_signals ||
    rawExtracted?.image_alts ||
    rawExtracted?.alt_texts ||
    rawExtracted?.image_alt_texts
  )

  const extractedCaptions = toStringArray(
    rawExtracted?.image_captions ||
    rawExtracted?.captions ||
    rawExtracted?.figcaptions
  )

  headers.push(...columnHeaders, ...extractedHeaders)
  heroTexts.push(...columnHero, ...extractedHero)
  navItems.push(...columnNav, ...extractedNav)
  ctaTexts.push(...columnCtas, ...extractedCtas)
  metaTitles.push(...extractedMetaTitles)
  metaDescriptions.push(...extractedMetaDescriptions)
  imageAltSignals.push(...extractedImageSignals)
  imageCaptions.push(...extractedCaptions)

  // (Legacy fallbacks) Some pipelines used to store homepage/about content inside raw_result
  const homepageContent = rawResult?.analysis?.homepage_content || rawResult?.homepage_content || ''
  const aboutContent = rawResult?.analysis?.about_content || rawResult?.about_content || ''
  const metadataTitle =
    rawResult?.metadata?.title ||
    rawResult?.analysis?.metadata?.title ||
    rawResult?.analysis?.pageMetadata?.title ||
    rawResult?.analysis?.page_title ||
    rawResult?.analysis?.og_title ||
    ''
  const metadataDescription =
    rawResult?.metadata?.description ||
    rawResult?.analysis?.metadata?.description ||
    rawResult?.analysis?.pageMetadata?.description ||
    rawResult?.analysis?.meta_description ||
    rawResult?.analysis?.og_description ||
    ''

  if (metadataTitle) metaTitles.push(String(metadataTitle))
  if (metadataDescription) metaDescriptions.push(String(metadataDescription))

  const legacyImageSignals = toStringArray(
    rawResult?.analysis?.imageSignals ||
    rawResult?.analysis?.image_signals ||
    rawResult?.image_signals
  )
  if (legacyImageSignals.length) imageAltSignals.push(...legacyImageSignals)
  
  // If we have no extracted headers/ctas, do a last-resort heuristic scan on cleaned text
  const allText = (homepageContent + ' ' + aboutContent).trim()
  
  if (headers.length === 0 && allText) {
    const headerPatterns = [
      /(?:^|\n)#{1,3}\s+(.+?)(?:\n|$)/g,
      /\bH1:\s*(.+?)\s*###/g,
      /\bH2:\s*(.+?)\s*##/g,
    ]
    headerPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(allText)) !== null) {
        const headerText = String(match[1] || '').trim()
        if (headerText && headerText.length > 2 && headerText.length < 120) {
          headers.push(headerText)
        }
      }
    })
  }
  
  // Extract value phrases (short slogans, often in quotes or as taglines)
  // Look for phrases 3-8 words long that might be slogans
  const sentences = allText.split(/[.!?]\s+/)
  sentences.forEach(sentence => {
    const wordCount = sentence.trim().split(/\s+/).length
    if (wordCount >= 3 && wordCount <= 8) {
      const cleaned = sentence.trim()
      if (cleaned.length > 10 && cleaned.length < 80) {
        // Check if it looks like a value proposition (contains certain keywords)
        if (/(?:vi|vores|hos|velkommen|oplevelse|kvalitet|frisk|lokalt|håndlavet|authentic|experience|quality|fresh|local|handmade)/i.test(cleaned)) {
          valuePhrases.push(cleaned)
        }
      }
    }
  })
  
  // Extract menu categories mentioned (brunch, frokost, middag, cocktails, etc.)
  const menuKeywords = [
    'brunch', 'morgenmad', 'breakfast',
    'frokost', 'lunch',
    'middag', 'dinner', 'aftensmad',
    'dessert', 'eftermiddag',
    'cocktails', 'drinks', 'drikkevarer',
    'kaffe', 'coffee',
    'te', 'tea',
    'vin', 'wine',
    'øl', 'beer',
    'snacks', 'tapas',
    'menu', 'menukort',
    'à la carte',
    'take away', 'takeaway'
  ]
  
  menuKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
    if (regex.test(allText)) {
      if (!menuCategoriesMentioned.includes(keyword.toLowerCase())) {
        menuCategoriesMentioned.push(keyword)
      }
    }
  })
  
  // Extract about tone summary
  const aboutTone = websiteAnalysis?.tone || rawResult?.analysis?.tone || rawResult?.analysis?.brand_voice?.tone || 'N/A'

  // About snippets (explicit “about” sections are high-signal for hooks)
  if (aboutContent) {
    const compact = String(aboutContent).replace(/\s+/g, ' ').trim()
    if (compact) aboutSnippets.push(compact.slice(0, 280))
  }
  const shortDesc = rawResult?.analysis?.shortDescription || rawResult?.analysis?.short_description || ''
  if (shortDesc) {
    const compact = String(shortDesc).replace(/\s+/g, ' ').trim()
    if (compact) aboutSnippets.push(compact.slice(0, 180))
  }

  // Lightweight “unique nouns” cues (Gemini-style): look for distinctive physical nouns.
  // We don’t try to do real POS tagging—just surface phrases containing high-signal nouns.
  const NOUN_KEYWORDS = [
    'statue', 'statuer', 'skulptur', 'skulpturer',
    'mural', 'murmaleri',
    'terrace', 'terrasse', 'tagterrasse',
    'courtyard', 'gårdhave',
    'open kitchen', 'åbent køkken',
    'bar', 'vinbar', 'cocktail', 'cocktails',
    'neon', 'neonskilt',
    'pejs', 'fireplace',
    'river', 'åen', 'vand', 'waterfront', 'havnen',
    'rooftop',
  ]

  const candidateText = [
    ...headers,
    ...heroTexts,
    ...aboutSnippets,
    ...metaTitles,
    ...imageAltSignals,
  ].join(' \n ')

  const cueLines = candidateText
    .split(/\n|\r|\|/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter(s => s.length >= 6 && s.length <= 140)

  const uniqueNounCues: string[] = []
  for (const line of cueLines) {
    const lower = line.toLowerCase()
    if (!NOUN_KEYWORDS.some(k => lower.includes(k))) continue
    uniqueNounCues.push(line)
    if (uniqueNounCues.length >= 12) break
  }
  
  // Keep a short raw excerpt as fallback
  const rawExcerpt = [
    columnHero.length || extractedHero.length ? `Hero: ${(columnHero.length ? columnHero : extractedHero).slice(0, 5).join(' | ')}` : '',
    allText ? allText.substring(0, 300) : ''
  ].filter(Boolean).join('\n') + (aboutContent ? '\n\nAbout: ' + aboutContent.substring(0, 200) : '')
  
  return {
    headers: uniqueArray(headers).slice(0, 12),
    heroTexts: uniqueArray(heroTexts).slice(0, 12),
    navItems: uniqueArray(navItems).slice(0, 18),
    ctaTexts: uniqueArray(ctaTexts).slice(0, 12),
    metaTitles: uniqueArray(metaTitles).slice(0, 5),
    metaDescriptions: uniqueArray(metaDescriptions).slice(0, 5),
    aboutSnippets: uniqueArray(aboutSnippets).slice(0, 3),
    imageAltSignals: uniqueArray(imageAltSignals).slice(0, 20),
    imageCaptions: uniqueArray(imageCaptions).slice(0, 10),
    uniqueNounCues: uniqueArray(uniqueNounCues).slice(0, 12),
    valuePhrases: valuePhrases.slice(0, 5),
    menuCategoriesMentioned: menuCategoriesMentioned.slice(0, 10),
    aboutTone,
    rawExcerpt
  }
}

/**
 * Ensures must_use_phrases are never empty by filling with first-party fallback anchors.
 * This prevents Prompt B from generating generic/meta output when no direct quotes exist.
 * 
 * Fallback priority:
 * 1. Business name (always available)
 * 2. Location anchor ("ved åen", city name)
 * 3. Menu categories (Brunch, Frokost, Aften, etc.)
 * 4. CTA from nav/menu ("Book bord", "Se menukort")
 * 
 * @param analysis - Prompt A analysis result
 * @param dataSources - All gathered data sources
 * @returns Analysis with filled must_use_phrases
 */
export function ensureMustUsePhrasesFallback(
  analysis: any,
  dataSources: DataSources
): any {
  const { business, profile, menu, websiteAnalysis } = dataSources
  const signals = analysis.signals || {}

  const isUseful = (s: unknown): s is string =>
    typeof s === 'string' &&
    s.trim().length > 1 &&
    !s.toLowerCase().includes('exact phrase') &&
    !s.toLowerCase().includes('placeholder') &&
    !s.toLowerCase().includes('n/a')

  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

  const GENERIC_ANCHOR_PATTERNS: RegExp[] = [
    /^book\b/i,
    /^reserv(?:e|ér)\b/i,
    /^bestil\b/i,
    /^kontakt\b/i,
    /^læs\b/i,
    /^se\s+(?:menu|menukort)\b/i,
    /^se\s+mere\b/i,
    /^læs\s+mere\b/i,
    /^klik\b/i,
    /^velkommen\b/i,
  ]

  const isGenericAnchor = (phrase: string): boolean => {
    const p = normalize(phrase)
    if (!p) return true
    if (p === 'menu' || p === 'menukort') return true
    if (p.includes('cookie') || p.includes('privatliv') || p.includes('privacy')) return true
    return GENERIC_ANCHOR_PATTERNS.some(r => r.test(phrase.trim()))
  }

  const pushUnique = (arr: string[], value: unknown) => {
    if (!isUseful(value)) return
    const v = String(value).trim()
    if (!arr.some(x => normalize(x) === normalize(v))) arr.push(v)
  }
  
  // Build fallback anchor pool from first-party data
  const properNounAnchors: string[] = []
  const physicalFeatureAnchors: string[] = []
  const operationalAnchors: string[] = []
  const ctaAnchors: string[] = []
  const headerAnchors: string[] = []
  
  // 1) Proper nouns & addresses (highest priority)
  const businessName = business?.business_name || business?.name
  if (businessName && businessName.length > 1 && businessName.toLowerCase() !== 'unknown') {
    pushUnique(properNounAnchors, businessName)
  }
  
  const address = business?.address
  if (address) {
    // Prefer street part if available
    const street = String(address).split(',')[0]?.trim()
    pushUnique(properNounAnchors, street || address)
  }

  // City / local area
  const city = business?.city || profile?.city
  if (city) {
    pushUnique(properNounAnchors, city)
  }
  
  const structuredWebsite = extractStructuredWebsiteData(websiteAnalysis, business)
  const allWebsiteText = [
    ...structuredWebsite.metaTitles,
    ...structuredWebsite.headers,
    ...structuredWebsite.heroTexts,
    ...structuredWebsite.aboutSnippets,
    ...structuredWebsite.imageAltSignals,
    ...structuredWebsite.uniqueNounCues,
    ...structuredWebsite.ctaTexts,
    structuredWebsite.rawExcerpt
  ].join(' ')
  const allWebsiteTextLower = allWebsiteText.toLowerCase()

  // Unique item names (menu item names) can act as proper-noun anchors
  const menuNameCandidates = (menu || [])
    .map((m: any) => String(m?.name || '').trim())
    .filter(Boolean)
    .filter(name => name.length >= 6)
    .filter(name => {
      const n = normalize(name)
      // Avoid very generic category-ish names
      return !['brunch', 'morgenmad', 'frokost', 'lunch', 'middag', 'dessert', 'kaffe', 'cocktails', 'drikkevarer'].includes(n)
    })
  menuNameCandidates.slice(0, 5).forEach(n => pushUnique(properNounAnchors, n))

  // 2) Concrete physical features
  const physicalPhrases = [
    'ved åen',
    'ved vandet',
    'river view',
    'by the river',
    'waterfront',
    'ved havnen',
    'gårdhave',
    'courtyard',
    'terrasse',
    'terrace',
    'open kitchen',
    'åbent køkken',
    'murmaleri',
    'mural',
    'statue',
    'statuer',
    'pejs',
    'bar'
  ]
  physicalPhrases.forEach(phrase => {
    if (allWebsiteTextLower.includes(phrase.toLowerCase())) {
      pushUnique(physicalFeatureAnchors, phrase)
    }
  })

  // 3) Operational concrete details (hours/time ranges) from website excerpt
  const operationalText = structuredWebsite.rawExcerpt || ''
  const timeRangeRegexes = [
    /\b\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}\b/g,
    /\b\d{1,2}\s*[-–]\s*\d{1,2}\b/g,
    /\b(?:åbent|open)\s+(?:til|until)\s+\d{1,2}[:.]\d{2}\b/gi,
  ]
  timeRangeRegexes.forEach(r => {
    const matches = operationalText.match(r) || []
    matches.slice(0, 4).forEach(m => pushUnique(operationalAnchors, m))
  })
  const latePatterns = [
    /\b(?:open\s+late|åbent\s+sent)\b/gi,
    /\b(?:torsdag|fredag|lørdag|thu|fri|sat)\b[^.]{0,40}(?:åbent|open|til|until)\b/gi,
    /\bbrunch\b[^.]{0,30}\b(?:til|until)\b/gi,
  ]
  latePatterns.forEach(r => {
    const matches = operationalText.match(r) || []
    matches.slice(0, 3).forEach(m => pushUnique(operationalAnchors, m))
  })
  
  // 4) Headers and CTAs (generic last)
  structuredWebsite.headers
    .filter(h => isUseful(h) && h.length > 5 && h.length < 60)
    .slice(0, 4)
    .forEach(h => pushUnique(headerAnchors, h))

  structuredWebsite.ctaTexts
    .filter(cta => isUseful(cta) && cta.length > 3 && cta.length < 40)
    .filter(cta => !cta.toLowerCase().includes('link to'))
    .slice(0, 6)
    .forEach(cta => pushUnique(ctaAnchors, cta))

  const menuCategories = structuredWebsite.menuCategoriesMentioned.slice(0, 3)
  
  // Also extract categories from menu items
  const menuCategorySet = new Set<string>()
  menu.slice(0, 20).forEach(item => {
    if (item.category) {
      menuCategorySet.add(item.category)
    }
  })
  Array.from(menuCategorySet).slice(0, 3).forEach(cat => {
    pushUnique(headerAnchors, cat)
  })

  // Build ordered fallback lists (most concrete → most generic)
  const orderedConcrete = [
    ...properNounAnchors,
    ...physicalFeatureAnchors,
    ...operationalAnchors,
    ...headerAnchors,
  ].filter(Boolean)

  const orderedCtas = ctaAnchors.filter(Boolean)

  console.log(`🔧 Fallback anchors available (concrete): ${orderedConcrete.length}`, orderedConcrete.slice(0, 8))
  console.log(`🔧 Fallback anchors available (ctas): ${orderedCtas.length}`, orderedCtas.slice(0, 6))
  
  // Now ensure each signal section has must_use_phrases
  const signalKeys = Object.keys(signals)
  let fillCount = 0
  
  signalKeys.forEach(key => {
    const signal = signals[key]
    if (!signal) return
    
    // Check if must_use_phrases is empty or missing
    const currentPhrases = signal.must_use_phrases || []
    const realPhrases = currentPhrases.filter((p: string) => 
      p && 
      p.trim().length > 2 && 
      !p.toLowerCase().includes('exact phrase') &&
      !p.toLowerCase().includes('placeholder') &&
      !p.toLowerCase().includes('n/a')
    )
    
    if (realPhrases.length === 0) {
      // Fill with fallbacks based on section type
      const sectionFallbacks: string[] = []

      const addConcrete = (n: number) => orderedConcrete.slice(0, n).forEach(a => pushUnique(sectionFallbacks, a))
      const addPhysical = (n: number) => physicalFeatureAnchors.slice(0, n).forEach(a => pushUnique(sectionFallbacks, a))
      const addOperational = (n: number) => operationalAnchors.slice(0, n).forEach(a => pushUnique(sectionFallbacks, a))
      const addCtas = (n: number) => orderedCtas.slice(0, n).forEach(a => pushUnique(sectionFallbacks, a))
      const ensureNotOnlyGeneric = () => {
        const nonGeneric = sectionFallbacks.filter(p => !isGenericAnchor(p))
        if (nonGeneric.length === 0) {
          // Ensure we always carry at least one proper noun / location anchor
          if (businessName) pushUnique(sectionFallbacks, businessName)
          if (city) pushUnique(sectionFallbacks, city)
        }
      }
      
      switch (key) {
        case 'brand_essence':
          addConcrete(3)
          addPhysical(2)
          break
          
        case 'tone_of_voice':
          // Prefer real copy patterns: non-generic CTAs and short headers
          addConcrete(2)
          addCtas(2)
          ensureNotOnlyGeneric()
          break
          
        case 'target_audience':
          menuCategories.slice(0, 2).forEach(c => pushUnique(sectionFallbacks, c))
          addOperational(2)
          addConcrete(2)
          break
          
        case 'core_offerings':
          // Menu categories are OK here, but keep it concrete
          menuCategories.slice(0, 3).forEach(c => pushUnique(sectionFallbacks, c))
          addConcrete(2)
          break
          
        case 'content_focus':
          addPhysical(2)
          headerAnchors.slice(0, 2).forEach(h => pushUnique(sectionFallbacks, h))
          menuCategories.slice(0, 1).forEach(c => pushUnique(sectionFallbacks, c))
          break
          
        case 'cta_style':
          // Generic CTAs are allowed here, but never as the only anchors
          addCtas(4)
          if (orderedCtas.length < 2) {
            const commonCtas = ['Book bord', 'Se menu', 'Kontakt os', 'Læs mere']
            commonCtas.slice(0, 2 - orderedCtas.length).forEach(c => pushUnique(sectionFallbacks, c))
          }
          ensureNotOnlyGeneric()
          break
          
        case 'communication_goal':
          addConcrete(2)
          addOperational(1)
          const category = business?.business_category || business?.vertical
          if (category) pushUnique(sectionFallbacks, category)
          break
          
        default:
          addConcrete(3)
          ensureNotOnlyGeneric()
      }
      
      // Deduplicate and limit
      const uniqueSectionFallbacks = Array.from(new Set(sectionFallbacks.filter(Boolean))).slice(0, 4)
      
      if (uniqueSectionFallbacks.length > 0) {
        signal.must_use_phrases = uniqueSectionFallbacks
        signal._fallback_applied = true
        fillCount++
        console.log(`  ↳ Filled ${key}.must_use_phrases with fallbacks:`, uniqueSectionFallbacks)
      }
    }
  })
  
  console.log(`✅ Fallback fill complete: ${fillCount} sections enriched`)

  // Guard: if all must_use_phrases across signals are generic, mark risk
  const allPhrases = Object.values(signals)
    .flatMap((s: any) => Array.isArray(s?.must_use_phrases) ? s.must_use_phrases : [])
    .filter(isUseful)
  const nonGenericCount = allPhrases.filter(p => !isGenericAnchor(p)).length
  const genericAnchorRisk = allPhrases.length > 0 && nonGenericCount === 0

  if (genericAnchorRisk) {
    console.log('⚠️ generic_anchor_risk=true (fallback anchors are generic)')
  }
  
  return {
    ...analysis,
    signals,
    evidence: {
      ...(analysis.evidence || {}),
      generic_anchor_risk: genericAnchorRisk
    }
  }
}
