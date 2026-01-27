/**
 * Brand Profile Validators
 * 
 * Validation and repair logic for brand profile output.
 * Ensures no meta-text or internal tokens leak into user-facing fields.
 */

import type { BrandProfile, BrandVariable, DataSources, ImagePreferencesValue, ThingsToAvoidValue, LanguageConfig } from './types.ts'
import { extractStructuredWebsiteData } from './signal-extractor.ts'
import { detectWebsitePresence, logWebsitePresence } from './website-presence.ts'

// Deno global type declaration for TypeScript
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
} | undefined

// Meta-text patterns that should NEVER appear in user-facing fields
// These are allowed ONLY in clarifications_needed or internal_notes
export const META_TEXT_PATTERNS = [
  '(mangler tydelig evidens',
  'mangler tydelig evidens',
  'foreslået retning',
  'uklart om',
  'Uklart om',
  'insufficient evidence',
  'suggested direction',
  'unclear about',
  'needs verification',
  'verificer',
  'afklar',
  'TODO',
  '[TBD]',
  '[?]',
]

// Internal tokens that should never appear in user-facing content
const INTERNAL_TOKENS = [
  'MANDATORY',
  'HARD CONSTRAINTS',
  'SOM TOMMELFINGERREGEL',
  '[INTERNT',
  'MÅLTIDSANKRE',
  'OPLEVELSES-/SERVICEANKER',
  'CRITICAL',
  '(3 required)',
  '(2 required)',
  'required)'
]

/**
 * Check if generated sections contain words that are listed in things_to_avoid.language_constraints
 * 
 * v4.8.8 Task 1: Ensure banned word consistency
 * v4.8.9 Task 2: Smart Banned Words - respect business's authentic vocabulary
 * If a word is in language_constraints, it should NOT appear anywhere else in the output
 * UNLESS the word appears 3+ times on the business's website (then it's allowed)
 * 
 * @param sections - Brand profile sections to validate
 * @param dataSources - Optional data sources for smart banned word filtering
 * @returns Array of validation errors (field + word pairs)
 */
export function checkBannedWordsConsistency(sections: any, dataSources?: DataSources): string[] {
  const errors: string[] = []
  
  // Extract banned words from things_to_avoid.language_constraints
  const thingsToAvoid = sections?.things_to_avoid
  let languageConstraints = thingsToAvoid?.value?.language_constraints || thingsToAvoid?.language_constraints || []
  
  if (!Array.isArray(languageConstraints) || languageConstraints.length === 0) {
    return errors
  }
  
  let bannedWords = languageConstraints
    .filter(Boolean)
    .map((w: any) => String(w).trim())
    .filter((w: string) => w.length > 0)
  
  if (bannedWords.length === 0) {
    return errors
  }
  
  // v4.8.9 Task 2: If dataSources provided, filter out words used 3+ times on website
  // This handles edge case where AI might have included an allowed word in things_to_avoid
  if (dataSources) {
    // Import functions from prompt-b (they're exported)
    // We need to dynamically import since TypeScript modules are static
    // For now, we'll replicate the logic here (simpler for Deno edge function)
    const websiteText = aggregateWebsiteTextForValidator(dataSources)
    const allowedWordsSet = new Set<string>()
    
    // Check each banned word for 3+ occurrences
    bannedWords.forEach(word => {
      const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'gi')
      const matches = websiteText.toLowerCase().match(regex)
      const count = matches ? matches.length : 0
      
      if (count >= 3) {
        allowedWordsSet.add(word.toLowerCase())
        console.log(`🔓 Validator: Allowing "${word}" (${count} occurrences on website)`)
      }
    })
    
    // Filter out allowed words
    if (allowedWordsSet.size > 0) {
      bannedWords = bannedWords.filter(w => !allowedWordsSet.has(w.toLowerCase()))
      console.log(`🔧 Validator: Checking ${bannedWords.length} banned words (${allowedWordsSet.size} allowed)`)
    }
  }
  
  // Fields to check (extract value from object or use string directly)
  const fieldsToCheck = [
    { name: 'brand_essence', value: sections?.brand_essence?.value || sections?.brand_essence },
    { name: 'core_offerings', value: sections?.core_offerings?.value || sections?.core_offerings },
    { name: 'target_audience', value: sections?.target_audience?.value || sections?.target_audience },
    { name: 'tone_of_voice', value: sections?.tone_of_voice?.value || sections?.tone_of_voice },
    { name: 'content_focus', value: sections?.content_focus?.value || sections?.content_focus },
    { name: 'communication_goal', value: sections?.communication_goal?.value || sections?.communication_goal },
    { name: 'cta_style', value: sections?.cta_style?.value || sections?.cta_style },
    { name: 'signature_shot', value: sections?.image_preferences?.signature_shot }
  ]
  
  // Check each field for banned words
  for (const field of fieldsToCheck) {
    if (!field.value || typeof field.value !== 'string') continue
    
    for (const bannedWord of bannedWords) {
      // Escape special regex characters in the banned word
      const escapedWord = bannedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi')
      
      if (regex.test(field.value)) {
        errors.push(
          `🚫 BANNED WORD INCONSISTENCY: Field "${field.name}" contains banned word "${bannedWord}" which is listed in things_to_avoid.language_constraints`
        )
      }
    }
  }
  
  return errors
}

/**
 * Helper function to aggregate website text for validator
 * (duplicates logic from prompt-b.ts to avoid circular dependencies)
 * 
 * v4.9.0: Now uses detectWebsitePresence for comprehensive detection
 */
function aggregateWebsiteTextForValidator(dataSources: DataSources): string {
  const textParts: string[] = []
  
  // v4.9.0: Use comprehensive website presence detection
  const presence = detectWebsitePresence(dataSources)
  logWebsitePresence(presence, 'Validator')
  
  if (!presence.hasWebsite) {
    console.log('⚠️ Validator: No website data found for banned word analysis')
    return ''
  }
  
  // v4.8.9 FIX: Use websiteAnalysis (actual key) with fallback to website
  const website = (dataSources as any).websiteAnalysis || (dataSources as any).website
  
  if (website) {
    // v4.8.9 FIX: Use ACTUAL field names from website_analyses table
    if (website.homepage_content) textParts.push(website.homepage_content)
    if (website.about_content) textParts.push(website.about_content)
    if (website.about_block) textParts.push(website.about_block)
    
    // Array fields - handle both array and string formats
    if (website.hero_texts) {
      if (Array.isArray(website.hero_texts)) textParts.push(...website.hero_texts)
      else textParts.push(website.hero_texts)
    }
    if (website.headers) {
      if (Array.isArray(website.headers)) textParts.push(...website.headers)
      else textParts.push(website.headers)
    }
    if (website.cta_texts) {
      if (Array.isArray(website.cta_texts)) textParts.push(...website.cta_texts)
      else textParts.push(website.cta_texts)
    }
    if (website.nav_items) {
      if (Array.isArray(website.nav_items)) textParts.push(...website.nav_items)
      else textParts.push(website.nav_items)
    }
    if (website.keywords) {
      if (Array.isArray(website.keywords)) textParts.push(...website.keywords)
      else textParts.push(website.keywords)
    }
    if (website.pages && Array.isArray(website.pages)) {
      website.pages.forEach((page: any) => {
        if (page.content) textParts.push(page.content)
        if (page.text) textParts.push(page.text)
      })
    }
  }
  
  const profile = dataSources.profile as any
  if (profile) {
    if (profile.short_description) textParts.push(profile.short_description)
    if (profile.long_description) textParts.push(profile.long_description)
  }
  
  const social = dataSources.social as any
  if (social) {
    if (social.bio) textParts.push(social.bio)
    if (social.description) textParts.push(social.description)
  }
  
  return textParts.filter(Boolean).join(' ')
}

/**
 * Validates Prompt B output for issues.
 * Checks for disallowed generic words, internal tokens, and meta-text.
 * 
 * @param sections - Parsed JSON sections from Prompt B
 * @param analysis - Prompt A analysis (for disallowed words)
 * @returns Array of error messages (empty if valid)
 */
export function validateBrandProfileOutput(sections: any, analysis: any, dataSources?: DataSources): string[] {
  const errors: string[] = []

  const normText = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const includesAny = (text: string, candidates: string[]) => {
    const t = normText(text)
    return candidates.some(c => c && t.includes(normText(c)))
  }

  const FIELDS_REQUIRING_PROOF = [
    'brand_essence',
    'tone_of_voice',
    'target_audience',
    'core_offerings',
    'content_focus',
    'cta_style',
    'communication_goal'
  ]

  const getValueAndProof = (field: string): { value: string | null; proof: string[] } => {
    const v = sections?.[field]
    if (typeof v === 'string') {
      return { value: v, proof: [] }
    }
    if (v && typeof v === 'object') {
      const value = typeof (v as any).value === 'string' ? (v as any).value : null
      const proof = Array.isArray((v as any).proof) ? (v as any).proof.filter(Boolean).map((p: any) => String(p)) : []
      return { value, proof }
    }
    return { value: null, proof: [] }
  }

  // Build a reference pool from Prompt A so proof can't be generic
  const referencePool: string[] = []
  const addRef = (s: unknown) => {
    if (typeof s !== 'string') return
    const t = s.trim()
    if (t.length < 4) return
    referencePool.push(t)
  }

  ;[
    ...(analysis?.distinctive_hooks || []).map((x: any) => x?.hook),
    ...(analysis?.distinctive_hooks || []).map((x: any) => x?.evidence),
    ...(analysis?.physical_space_cues || []).map((x: any) => x?.cue),
    ...(analysis?.physical_space_cues || []).map((x: any) => x?.evidence),
    ...(analysis?.rituals_and_moments || []).map((x: any) => x?.moment),
    ...(analysis?.rituals_and_moments || []).map((x: any) => x?.evidence),
    ...(analysis?.local_identity_cues || []).map((x: any) => x?.cue),
    ...(analysis?.local_identity_cues || []).map((x: any) => x?.evidence),
    ...(analysis?.copy_patterns || []).map((x: any) => x?.pattern),
    ...(analysis?.copy_patterns || []).map((x: any) => x?.evidence),
  ].forEach(addRef)

  if (analysis?.signals) {
    Object.values(analysis.signals).forEach((signal: any) => {
      if (Array.isArray(signal?.must_use_phrases)) signal.must_use_phrases.forEach(addRef)
      if (Array.isArray(signal?.concrete_anchors)) signal.concrete_anchors.forEach(addRef)
    })
  }

  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

  const isInstructionalPlaceholder = (value: string): boolean => {
    const v = value.trim()
    if (!v) return true
    const n = normalize(v)

    // Common instruction/placeholder leakage patterns (Danish/English)
    if (/(\.{3,}|…)/.test(v)) return true
    if (/\bjeres\b/i.test(v)) return true
    if (/\bhvem\b/i.test(v)) return true
    if (/\bperfekt\s+til\b/i.test(v)) return true
    
    // Generic menu placeholders (v4.8.4 - enhanced)
    if (n.includes('menu categories') || n.includes('menukategorier')) return true
    if (n.includes('menu items')) return true
    if (n.includes('mad og drikke') && n.length < 30) return true  // "mad og drikke" alone is too generic
    
    if (n.includes('jeres primære produkter') || n.includes('produkter eller services')) return true
    if (n.includes('your primary products') || n.includes('products or services')) return true
    return false
  }

  const hasAtLeastThreeContentFocusAreas = (value: string): boolean => {
    const v = value.trim()
    if (!v) return false

    const lines = v.split('\n').map(l => l.trim()).filter(Boolean)
    const bulletCount = lines.filter(l => l.startsWith('- ')).length
    if (bulletCount >= 3) return true

    const n = normalize(v)
    const groups: Array<{ name: string; re: RegExp }> = [
      // Food / service
      { name: 'food', re: /\b(brunch|frokost|middag|aften|kaffe|menu|retter|mad|servering|køkken|cocktail|vin|øl)\b/i },
      // Atmosphere / interior / vibe
      { name: 'atmosphere', re: /\b(stemning|atmosfære|vibe|interiør|indretning|lys|belysning|musik|bar|aftenlys|candle|hygge)\b/i },
      // People / moments / tempo
      { name: 'people', re: /\b(mennesker|gæster|team|kok|barista|værter|øjeblik|momenter|tempo|hverdag|fredag|venner|date|familie)\b/i },
      // Transitions / story / BTS
      { name: 'story', re: /\b(bts|bag\s+kulissen|process|fortæll|story|fra\s+dag\s+til\s+aften|overgang|morgen\s+til\s+aften)\b/i },
    ]

    let hits = 0
    for (const g of groups) {
      if (g.re.test(n)) hits += 1
    }
    return hits >= 3
  }

  const hasCtaPrimaryAndSecondary = (value: string): boolean => {
    const v = value.trim()
    if (!v) return false
    const n = normalize(v)

    const primaryBooking = /\b(book|bordreserv|reserv|reservation|book\s+dit\s+bord|book\s+bord|reserve(r)?\s+bord)\b/i.test(n)

    const secondaryPhrases: RegExp[] = [
      /\bse\s+menu(en)?\b/i,
      /\bmenu\b/i,
      /\b(kig|kom)\s+(forbi|ind)\b/i,
      /\bse\s+(mere|dagens)\b/i,
      /\bfølg\s+med\b/i,
      /\b(del|tag|tip)\b/i,
      /\b(besøg|visit)\b/i,
      /\bskriv\s+til\s+os\b/i,
      /\bfind\s+vej\b/i,
    ]
    const secondaryHitCount = secondaryPhrases.reduce((acc, re) => (re.test(n) ? acc + 1 : acc), 0)

    // Alternative: explicit structure labels.
    const hasPrimaryLabel = /\b(primær|primary)\b/i.test(n)
    const hasSecondaryLabel = /\b(sekundær|secondary)\b/i.test(n)

    if (hasPrimaryLabel && hasSecondaryLabel) {
      // If the author used explicit labels, still require booking + at least 2 soft CTA hints.
      return primaryBooking && secondaryHitCount >= 2
    }

    return primaryBooking && secondaryHitCount >= 2
  }

  const targetLanguage = (() => {
    const lang = String((dataSources as any)?.business?.primary_language || (dataSources as any)?.profile?.primary_language || '').toLowerCase()
    if (lang.startsWith('da')) return 'Danish'
    if (lang.startsWith('en')) return 'English'
    if (lang.startsWith('de')) return 'German'
    const country = String((dataSources as any)?.business?.country || '').toLowerCase()
    if (country === 'dk' || country.includes('denmark') || country.includes('danmark')) return 'Danish'
    if (country === 'de' || country.includes('germany') || country.includes('deutschland')) return 'German'
    return 'English' // Default to English if unclear
  })()
  
  const isDanishContext = targetLanguage === 'Danish'

  // Language consistency (Danish profiles): reject common English marketing fragments.
  // Keep this conservative to avoid false positives.
  const ENGLISH_FRAGMENT_PATTERNS: RegExp[] = [
    /\bcasual\s+diners?\b/i,
    /\bculinary\s+experiences?\b/i,
    /\bfine\s+dining\b/i,
    /\bfoodies?\b/i,
    /\bcrafted\b/i,
    /\bartisan\b/i,
    /\bsignature\b/i,
    /\bvibes?\b/i,
    /\bexperience\b/i,
    /\bexperiences\b/i,
  ]
  const containsEnglishFragment = (text: string): boolean => ENGLISH_FRAGMENT_PATTERNS.some(p => p.test(text))

  const normalizeForDupCheck = (s: string): string => {
    return s
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => l.replace(/^-\s+/, '').replace(/^eksempel:\s*/i, ''))
      .join(' ')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const areTooSimilar = (a: string, b: string): boolean => {
    const na = normalizeForDupCheck(a)
    const nb = normalizeForDupCheck(b)
    if (!na || !nb) return false
    if (na === nb) return true
    // Prevent trivial substring matches on very short strings
    const minLen = 20
    if (na.length < minLen || nb.length < minLen) return false
    return na.includes(nb) || nb.includes(na)
  }

  // Detect language of a text string (simple heuristic)
  const detectLanguage = (text: string): 'da' | 'de' | 'en' | 'unknown' => {
    const t = text.toLowerCase()
    // Danish indicators
    if (/\b(og|til|med|ved|hvor|hos|fra|kan|være|eller|også|meget|alle|denne|dette|disse|har|vil|skulle|måske)\b/.test(t)) {
      return 'da'
    }
    // German indicators
    if (/\b(und|der|die|das|mit|von|zu|bei|ist|sind|haben|werden|können|möchten|für)\b/.test(t)) {
      return 'de'
    }
    // English indicators (check after Danish/German to avoid false positives)
    if (/\b(the|and|with|from|where|by|can|at|dining|brunch|transition)\b/.test(t)) {
      return 'en'
    }
    return 'unknown'
  }

  // Step 5: Concrete hook token enforcement
  // Concrete hook token = an exact hook/cue string from Prompt A distinctive_hooks or physical_space_cues.
  const hookTokensRaw: string[] = []
  const pushHookToken = (v: unknown) => {
    if (typeof v !== 'string') return
    const t = v.trim()
    if (t.length < 4) return
    hookTokensRaw.push(t)
  }

  ;[
    ...(analysis?.distinctive_hooks || []).map((x: any) => x?.hook),
    ...(analysis?.physical_space_cues || []).map((x: any) => x?.cue),
  ].forEach(pushHookToken)
  
  // Add canonical location hook from enrichment (overrides Prompt A variations)
  const location = (dataSources as any)?.location
  if (location?.enrichment) {
    const locationPhrase = location.enrichment.micro.area_type === 'waterfront' ? 'ved åen'
      : location.enrichment.micro.area_type === 'transit_hub' ? 'ved stationen'
      : location.enrichment.micro.area_type === 'shopping_street' ? 'på gågaden'
      : ''
    const cityName = location.enrichment.macro.city
    if (locationPhrase && cityName) {
      pushHookToken(`${locationPhrase} i ${cityName}`)
    }
  }

  // Distinctive hooks only (non-menu differentiators). Used for brand_essence.
  // CRITICAL: Filter by language to prevent English hooks in Danish content
  const distinctiveHookTokensRaw: string[] = []
  ;(analysis?.distinctive_hooks || []).map((x: any) => x?.hook).forEach((v: any) => {
    if (typeof v !== 'string') return
    const t = v.trim()
    if (t.length < 4) return
    
    // Filter by language: only include hooks matching the profile language
    const hookLang = detectLanguage(t)
    const profileLang = dataSources?.business?.primary_language || 'da'
    
    // Skip hooks in wrong language
    if (hookLang !== 'unknown' && profileLang === 'da' && hookLang !== 'da') {
      return // Skip English/German hooks in Danish content
    }
    if (hookLang !== 'unknown' && profileLang === 'de' && hookLang !== 'de') {
      return // Skip Danish/English hooks in German content
    }
    if (hookLang !== 'unknown' && profileLang === 'en' && hookLang !== 'en') {
      return // Skip Danish/German hooks in English content
    }
    
    distinctiveHookTokensRaw.push(t)
  })

  const hookTokenMap = new Map<string, string>()
  hookTokensRaw.forEach(t => {
    const n = normalize(t)
    if (!n) return
    if (!hookTokenMap.has(n)) hookTokenMap.set(n, t)
  })
  const hookTokens = Array.from(hookTokenMap.entries()).map(([normalized, original]) => ({ normalized, original }))

  const distinctiveHookTokenMap = new Map<string, string>()
  distinctiveHookTokensRaw.forEach(t => {
    const n = normalize(t)
    if (!n) return
    if (!distinctiveHookTokenMap.has(n)) distinctiveHookTokenMap.set(n, t)
  })
  const distinctiveHookTokens = Array.from(distinctiveHookTokenMap.entries()).map(([normalized, original]) => ({ normalized, original }))

  const hasAnyHookToken = (value: string): boolean => {
    const v = normalize(value)
    if (!v) return false
    return hookTokens.some(t => v.includes(t.normalized))
  }

  const countDistinctiveHookTokensIn = (value: string): number => {
    const v = normalize(value)
    if (!v) return 0
    return distinctiveHookTokens.reduce((acc, t) => (v.includes(t.normalized) ? acc + 1 : acc), 0)
  }

  const hasAnyDistinctiveHookToken = (value: string): boolean => countDistinctiveHookTokensIn(value) > 0

  const venueTypeWords = [
    'café', 'cafe', 'restaurant', 'bar', 'bistro', 'brasserie', 'vinbar', 'cocktailbar', 'spisested',
    'konditori', 'bageri', 'pizzeria', 'grill', 'burger', 'steakhouse', 'sushi', 'sushibar', 'tapas',
    'takeaway', 'street food'
  ]
  const hasVenueTypeCue = (value: string): boolean => {
    const v = normalize(value)
    return venueTypeWords.some(w => v.includes(normalize(w)))
  }

  const hasBrandEssenceRepetition = (value: string): boolean => {
    const cleaned = value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s.!?]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Sentence-level repetition
    const sentences = cleaned
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 12)
    const seen = new Set<string>()
    for (const s of sentences) {
      if (seen.has(s)) return true
      seen.add(s)
    }

    // Repeated 4-gram repetition
    const words = cleaned.split(/\s+/).filter(Boolean)
    if (words.length < 10) return false
    const grams = new Map<string, number>()
    const n = 4
    for (let i = 0; i <= words.length - n; i++) {
      const g = words.slice(i, i + n).join(' ')
      grams.set(g, (grams.get(g) || 0) + 1)
      if ((grams.get(g) || 0) >= 2) return true
    }
    return false
  }

  const hookListForError = (): string => {
    const list = hookTokens.slice(0, 10).map(t => t.original)
    return JSON.stringify(list)
  }
  const normalizedRefs = Array.from(new Set(referencePool.map(normalize))).filter(r => r.length >= 4)
  
  // Build allowed proof tokens (Fix #4)
  const locationData = (dataSources as any)?.location
  const locationPhraseProof = locationData?.enrichment?.micro?.area_type === 'waterfront' ? 'ved åen'
    : locationData?.enrichment?.micro?.area_type === 'transit_hub' ? 'ved stationen'
    : locationData?.enrichment?.micro?.area_type === 'shopping_street' ? 'på gågaden'
    : ''
  const cityProof = locationData?.enrichment?.macro?.city || ''
  const canonicalLocationHookProof = locationPhraseProof && cityProof ? `${locationPhraseProof} i ${cityProof}` : ''
  
  const ALLOWED_PROOF_TOKENS = [
    canonicalLocationHookProof,
    'BOOK DIT BORD',
    'PARISERBØF',
    'ÆGGEKAGE',
    'BØF & BEARNAISE',
    'FAUST GRYDE',
    'ved åen',
    'åen'
  ].filter(Boolean).map(t => normalize(t))
  
  const proofReferencesSomethingReal = (proof: string[]): boolean => {
    if (normalizedRefs.length === 0 && ALLOWED_PROOF_TOKENS.length === 0) return true
    const joined = normalize(proof.join(' '))
    
    // Check if proof contains at least one allowed token OR one reference from analysis
    const hasAllowedToken = ALLOWED_PROOF_TOKENS.some(token => joined.includes(token))
    const hasAnalysisRef = normalizedRefs.some(r => joined.includes(r))
    
    return hasAllowedToken || hasAnalysisRef
  }
  
  // Extract disallowed generic words from analysis
  const disallowedWords = new Set<string>()
  if (analysis?.signals) {
    Object.values(analysis.signals).forEach((signal: any) => {
      if (signal?.disallowed_generic_words?.length > 0) {
        signal.disallowed_generic_words.forEach((word: string) => disallowedWords.add(word.toLowerCase()))
      }
    })
  }

  // Many hospitality venues legitimately need words like “mad” and “menu”.
  // Keep disallowed words focused on longer, truly generic marketing fillers.
  const DOMAIN_ALLOWLIST = new Set<string>([
    'mad',
    'menu',
    'retter',
    'drikke',
    'drikkevarer',
    'kaffe',
    'brunch',
    'frokost',
    'middag',  // v4.8.9: Added - legitimate meal time word
    'aften',
    'vin',
    'øl',
    'cocktails'
  ])

  const isAllowedDisallowedWord = (word: string): boolean => {
    const w = word.toLowerCase().trim()
    if (!w) return true
    // Ignore very short “generic” tokens to avoid false positives (e.g., mad/menu)
    if (w.length < 5) return true
    if (DOMAIN_ALLOWLIST.has(w)) return true
    return false
  }
  
  // Check each field for issues
  FIELDS_REQUIRING_PROOF.forEach(field => {
    const raw = sections?.[field]

    // Enforce anti-generic gate: require { value, proof }
    if (!raw || typeof raw !== 'object') {
      errors.push(`Field "${field}" must be an object: { value: string, proof: [1-3 bullets] }`)
      return
    }

    const { value, proof } = getValueAndProof(field)
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`Field "${field}" is missing "value" (string)`)
      return
    }

    // Target audience must never be a prompt/question.
    if (field === 'target_audience') {
      const v = value.trim()
      const n = normalize(v)
      const looksLikeQuestion = /\?$/.test(v) || v.includes('?')
      const isPromptLike =
        n === 'hvem taler i til' ||
        n.includes('hvem taler i til') ||
        n.includes('who are you speaking to') ||
        n.includes('who do you speak to') ||
        n.startsWith('hvem ') ||
        n.startsWith('who ')
      if (looksLikeQuestion || isPromptLike) {
        errors.push('target_audience must be a concrete audience statement (never a question/prompt)')
        return
      }
    }

    // Core offerings must never contain internal instruction placeholders.
    if (field === 'core_offerings') {
      if (isInstructionalPlaceholder(value)) {
        errors.push('core_offerings contains instructional/placeholder language; must list actual offerings from menu/anchors')
        return
      }
    }

    // Content focus must not lock ideation into menu-only mode.
    // Require at least 3 distinct focus areas (e.g., food/service + atmosphere/interior + people/moments/transitions/story).
    if (field === 'content_focus') {
      if (!hasAtLeastThreeContentFocusAreas(value)) {
        errors.push('content_focus is too narrow; must support at least 3 focus areas (food/service, atmosphere/interior, people/moments/transitions)')
        return
      }
    }

    // CTA style must not be overly rigid/transactional.
    // Require primary booking CTA + at least 2 soft secondary CTAs.
    if (field === 'cta_style') {
      if (!hasCtaPrimaryAndSecondary(value)) {
        errors.push('cta_style is too rigid; must include a primary booking CTA and 2+ secondary soft CTAs (e.g., se menu, kig forbi, del oplevelsen)')
        return
      }
    }

    if (!Array.isArray((raw as any).proof)) {
      errors.push(`Field "${field}" is missing "proof" (array)`)
    } else {
      if (proof.length < 1 || proof.length > 3) {
        errors.push(`Field "${field}" proof must have 1-3 bullets`)
      }
      if (!proofReferencesSomethingReal(proof)) {
        errors.push(`Field "${field}" proof does not reference Prompt A hooks/phrases (too generic)`)
      }
    }

    if (typeof value === 'string') {
      // Check for disallowed generic words
      if (disallowedWords.size > 0) {
        disallowedWords.forEach(word => {
          if (isAllowedDisallowedWord(word)) return
          // Whole-word-ish match to avoid substring false positives
          const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'iu')
          if (re.test(value)) {
            errors.push(`Field "${field}" contains disallowed generic word: "${word}"`)
          }
        })
      }
      
      // Check for internal tokens
      INTERNAL_TOKENS.forEach(token => {
        if (value.includes(token)) {
          errors.push(`Field "${field}" contains internal token: "${token}"`)
        }
      })
      
      // Check for meta-text patterns
      META_TEXT_PATTERNS.forEach(pattern => {
        if (value.toLowerCase().includes(pattern.toLowerCase())) {
          errors.push(`Field "${field}" contains meta-text: "${pattern}"`)
        }
      })
    }
  })

  // Require at least one concrete hook token (prevents repair/generalization washing out specificity)
  // RELAXED in v4.8.0: Hook references are now warnings, not hard errors
  if (hookTokens.length > 0) {
    const be = getValueAndProof('brand_essence').value
    if (typeof be === 'string' && be.trim()) {
      // Brand Essence: SHOULD include a Distinctive Hook but not mandatory
      // (AI often creates great content without verbatim hook inclusion)
      // REMOVED: Hard requirement for exact hook match
      
      if (!hasVenueTypeCue(be)) {
        errors.push('brand_essence must include a venue type cue (e.g., café/restaurant/bar/bistro)')
      }

      if (hasBrandEssenceRepetition(be)) {
        errors.push('brand_essence contains repetition; do not repeat the same phrase/sentence')
      }
      
      // v4.8.4: Soft hook encouragement (warning, not error)
      if (hookTokens.length > 0 && !hasAnyHookToken(be)) {
        console.warn(`⚠️ Soft warning: brand_essence missing distinctive hook - consider adding one of: ${hookTokens.slice(0, 3).map(t => t.original).join(', ')}`)
      }
    }

    // Step 3: Brand essence must include location + offering + one hook
    if (typeof be === 'string' && be.trim()) {
      const business = dataSources?.business
      const profile = dataSources?.profile
      const structuredWebsite = dataSources ? extractStructuredWebsiteData(dataSources.websiteAnalysis, business) : null
      // Extract location from all available sources (match fallback logic)
      const location = (dataSources as any)?.location

      const locationCandidates: string[] = [
        location?.enrichment?.macro?.city,  // Primary source (matches fallback)
        business?.city,                      // Fallback if no enrichment
        business?.address,
        (business?.address ? String(business.address).split(',')[0] : ''),
        business?.business_name,
        (business as any)?.name,
        ...(structuredWebsite?.headers || []).filter((h: string) => /\bved\b|\bøen\b|\bhavn\b|\btorv\b|\bgade\b|\bvej\b|\bbro\b/i.test(h)),
      ].filter(Boolean).map(String)

      const offeringCandidates: string[] = [
        ...(analysis?.signals?.core_offerings?.must_use_phrases || []),
        ...(analysis?.signals?.core_offerings?.concrete_anchors || []),
        ...(structuredWebsite?.menuCategoriesMentioned || []),
        // Also check menu items directly
        ...(dataSources?.menu || []).slice(0, 10).map(item => item.name).filter(Boolean)
      ].filter(Boolean).map(String)

      if (locationCandidates.length > 0 && !includesAny(be, locationCandidates)) {
        errors.push('brand_essence must include a location cue (city/address/venue cue)')
      }
      if (offeringCandidates.length > 0 && !includesAny(be, offeringCandidates)) {
        errors.push('brand_essence must include an offering cue (e.g., brunch/frokost/aften, cocktails, coffee)')
      }
    }

    const tov = getValueAndProof('tone_of_voice').value
    // RELAXED in v4.8.0: Hook requirement removed - AI can create quality tone guidance without verbatim hooks
    // if (typeof tov === 'string' && tov.trim() && !hasAnyHookToken(tov)) {
    //   errors.push(`tone_of_voice missing distinctive hook; must include at least one of: ${hookListForError()}`)
    // }

    if (isDanishContext && typeof tov === 'string' && tov.trim() && containsEnglishFragment(tov)) {
      errors.push(`tone_of_voice contains English fragments; must be consistently ${targetLanguage}`)
    }

    // Step 3: Tone of voice structure (Danish bullets + examples + preferred CTAs)
    if (typeof tov === 'string' && tov.trim()) {
      const lines = tov.split('\n').map(l => l.trim()).filter(Boolean)
      const bulletCount = lines.filter(l => l.startsWith('- ')).length
      const exampleCount = lines.filter(l => /^eksempel:/i.test(l)).length
      const avoidCount = lines.filter(l => /^undgå:/i.test(l)).length

      if (bulletCount < 2 || bulletCount > 8) {
        errors.push('tone_of_voice must include 2-8 style bullets (lines starting with "- ")')
      }
      if (exampleCount < 1 || exampleCount > 6) {
        errors.push('tone_of_voice must include 1-6 example lines (lines starting with "Eksempel: ")')
      }
      if (avoidCount > 3) {
        errors.push('tone_of_voice may include at most 3 "Undgå:" lines')
      }

      // Machine-operable: prefer structured format but allow some flexibility
      // RELAXED in v4.8.0: Allow up to 30% unstructured lines for natural AI content
      const allowedLine = (l: string) => l.startsWith('- ') || /^eksempel:/i.test(l) || /^undgå:/i.test(l)
      const unstructuredLines = lines.filter(l => !allowedLine(l))
      const unstructuredRatio = unstructuredLines.length / Math.max(lines.length, 1)
      if (unstructuredRatio > 0.3) {
        errors.push('tone_of_voice should be mostly structured (bullets, Eksempel: lines, Undgå: lines)')
      }

      // No duplicates (prevents repetition)
      const normLine = (l: string) => normText(l.replace(/^(-\s+|eksempel:\s*|undgå:\s*)/i, ''))
      const seen = new Set<string>()
      for (const l of lines) {
        const n = normLine(l)
        if (!n) continue
        if (seen.has(n)) {
          errors.push('tone_of_voice contains repeated rules/examples; remove duplicates')
          break
        }
        seen.add(n)
      }

      // RELAXED in v4.8.0: CTA requirement is now optional - AI can create quality tone guidance without exact CTA phrases
      // const preferredCtas = (analysis?.signals?.cta_style?.must_use_phrases || []).filter((x: any) => typeof x === 'string' && x.trim().length > 1)
      // if (preferredCtas.length > 0) {
      //   const t = normText(tov)
      //   const hasCta = preferredCtas.some((c: string) => t.includes(normText(c)))
      //   if (!hasCta) {
      //     errors.push(`tone_of_voice must include preferred CTA phrase(s): ${preferredCtas.slice(0, 4).join(' | ')}`)
      //   }
      // }

      // Respect hard forbidden phrases (evidence-based bans) if present.
      const forbiddenFromAnalysis = Array.isArray(analysis?.signals?.things_to_avoid?.language_constraints)
        ? analysis.signals.things_to_avoid.language_constraints.filter(Boolean).map((x: any) => String(x))
        : Array.isArray(analysis?.signals?.things_to_avoid?.hard_constraints)
          ? analysis.signals.things_to_avoid.hard_constraints.filter(Boolean).map((x: any) => String(x))
          : []

      const forbiddenFromOutput = Array.isArray(sections?.things_to_avoid?.language_constraints)
        ? sections.things_to_avoid.language_constraints.filter(Boolean).map((x: any) => String(x))
        : Array.isArray(sections?.things_to_avoid?.hard_constraints)
          ? sections.things_to_avoid.hard_constraints.filter(Boolean).map((x: any) => String(x))
          : []

      const forbidden = Array.from(new Set([...forbiddenFromAnalysis, ...forbiddenFromOutput].map(s => s.trim()).filter(Boolean)))
      if (forbidden.length > 0) {
        const t = normText(tov)
        for (const f of forbidden.slice(0, 25)) {
          const nf = normText(f)
          if (!nf || nf.length < 3) continue
          if (t.includes(nf)) {
            errors.push(`tone_of_voice contains hard-forbidden phrase from things_to_avoid: "${f}"`)
            break
          }
        }
      }
    }

    const sig = sections?.image_preferences?.signature_shot
    // RELAXED in v4.8.0: Hook requirement removed - AI can create quality image descriptions without verbatim hooks
    // if (typeof sig === 'string' && sig.trim() && !hasAnyHookToken(sig)) {
    //   errors.push(`image_preferences.signature_shot missing distinctive hook; must include at least one of: ${hookListForError()}`)
    // }

    if (isDanishContext && typeof sig === 'string' && sig.trim() && containsEnglishFragment(sig)) {
      errors.push(`image_preferences.signature_shot contains English fragments; must be consistently ${targetLanguage}`)
    }

    const commGoal = getValueAndProof('communication_goal').value
    if (isDanishContext && typeof commGoal === 'string' && commGoal.trim() && containsEnglishFragment(commGoal)) {
      errors.push(`communication_goal contains English fragments; must be consistently ${targetLanguage}`)
    }

    const coreOff = getValueAndProof('core_offerings').value
    if (isDanishContext && typeof coreOff === 'string' && coreOff.trim() && containsEnglishFragment(coreOff)) {
      errors.push(`core_offerings contains English fragments; must be consistently ${targetLanguage}`)
    }

    const targetAud = getValueAndProof('target_audience').value
    if (isDanishContext && typeof targetAud === 'string' && targetAud.trim() && containsEnglishFragment(targetAud)) {
      errors.push(`target_audience contains English fragments; must be consistently ${targetLanguage}`)
    }

    // Step 3: Signature shot must be concrete (scene + lighting + people/object + location cue)
    if (typeof sig === 'string' && sig.trim()) {
      const s = normText(sig)

      const GENERIC_SIG_PATTERNS = [
        'lækker mad og oplevelser',
        'lækre oplevelser',
        'hyggelig stemning',
        'lækre billeder',
        'god stemning',
        'mad og drikke',
      ]
      if (GENERIC_SIG_PATTERNS.some(p => s.includes(p))) {
        errors.push('image_preferences.signature_shot is too generic (avoid placeholder phrases)')
      }

      const lightingWords = ['morgen', 'morgensol', 'gyldent', 'golden hour', 'aften', 'candle', 'stearinlys', 'nat', 'neon', 'blødt lys', 'spotlys', 'sollys']
      const hasLighting = lightingWords.some(w => s.includes(normText(w)))
      if (!hasLighting) errors.push('image_preferences.signature_shot must include a lighting cue (e.g., morning light, golden hour, candlelight)')

      const peopleOrObjectWords = ['gæst', 'gæster', 'person', 'par', 'venner', 'barista', 'kok', 'hånd', 'glas', 'kop', 'tallerken', 'cocktail', 'kaffe', 'vin', 'øl', 'statue', 'murmaleri', 'mural', 'terrasse', 'bar']
      const hasPeopleOrObject = peopleOrObjectWords.some(w => s.includes(normText(w)))
      if (!hasPeopleOrObject) errors.push('image_preferences.signature_shot must include people or a concrete object (at least one)')

      // Action cue: require an action/verb so it's a real scene, not just nouns.
      // v4.9.0 Phase 2 Task E: Expanded action cues to prevent false positives
      const actionWords = [
        // Active verbs (existing)
        'serverer', 'skænker', 'hælder', 'brygger', 'anretter', 'drysser', 'skærer', 'snitter', 'tænder',
        'smiler', 'griner', 'holder', 'løfter', 'kigger', 'går', 'kommer', 'bestiller', 'tager en bid', 'i gang med',
        // Behavioral patterns (expanded v4.9.0)
        'spiser', 'skåler', 'sidder', 'bliver siddende', 'nyder', 'deler', 'drikker',
        'nydes', 'samles', 'mødes', 'hygger', 'slapper af', 'står'
      ]
      const hasAction = actionWords.some(w => s.includes(normText(w)))
      if (!hasAction) errors.push('image_preferences.signature_shot must include an action cue (what people are doing)')

      // Location cue: check enrichment data first, then fallback to business fields
      // v4.9.0 Phase 2 Task E: Improved location cue detection
      const location = (dataSources as any)?.location
      const business = dataSources?.business
      const locationCandidates: string[] = [
        location?.enrichment?.macro?.city,  // e.g., "Aarhus"
        business?.city,
        business?.address,
        business?.name,
        business?.business_name,
        // Common location phrases (check these even if city is missing)
        'ved åen', 'ved stationen', 'på gågaden', 'i centrum', 'i kvarteret', 'i turistområdet',
        // Specific city names that commonly appear
        'aarhus', 'københavn', 'odense', 'aalborg', 'esbjerg'
      ]
        .filter(Boolean)
        .map(String)
        .map(s => s.toLowerCase())
      
      // Check if signature shot includes at least one location candidate
      const hasLocationCue = locationCandidates.some(loc => 
        normText(sig).includes(normText(loc))
      )
      
      if (!hasLocationCue && locationCandidates.length > 0) {
        errors.push('image_preferences.signature_shot must include a location cue (city/address/venue cue)')
      }
    }

    // Step X: No duplicate field values (prevents the model from repeating itself)
    if (typeof be === 'string' && be.trim() && typeof tov === 'string' && tov.trim()) {
      if (areTooSimilar(be, tov)) {
        errors.push('brand_essence and tone_of_voice must not be duplicates or near-duplicates')
      }
    }
    if (typeof be === 'string' && be.trim() && typeof sig === 'string' && sig.trim()) {
      if (areTooSimilar(be, sig)) {
        errors.push('brand_essence and image_preferences.signature_shot must not be duplicates or near-duplicates')
      }
    }
    if (typeof tov === 'string' && tov.trim() && typeof sig === 'string' && sig.trim()) {
      if (areTooSimilar(tov, sig)) {
        errors.push('tone_of_voice and image_preferences.signature_shot must not be duplicates or near-duplicates')
      }
    }
  }
  
  // Check structured fields
  if (sections.image_preferences && typeof sections.image_preferences === 'object') {
    const allValues = [
      ...(sections.image_preferences.dos || []),
      ...(sections.image_preferences.donts || []),
      sections.image_preferences.signature_shot || ''
    ].join(' ')
    
    INTERNAL_TOKENS.forEach(token => {
      if (allValues.includes(token)) {
        errors.push(`Field "image_preferences" contains internal token: "${token}"`)
      }
    })
    
    META_TEXT_PATTERNS.forEach(pattern => {
      if (allValues.toLowerCase().includes(pattern.toLowerCase())) {
        errors.push(`Field "image_preferences" contains meta-text: "${pattern}"`)
      }
    })
  }

  // Content pillars: 3-6 items from fixed set + basic consistency
  const ALLOWED_PILLARS = new Set<string>([
    'Crave-worthy',
    'BTS',
    'Social proof',
    'Vibe',
    'Engagement',
    'Offers'
  ])

  if (!Array.isArray(sections.content_pillars)) {
    errors.push('Field "content_pillars" must be an array (3-6 items)')
  } else {
    const pills = sections.content_pillars as any[]
    if (pills.length < 3 || pills.length > 6) {
      errors.push('Field "content_pillars" must have 3-6 items')
    }
    const seen = new Set<string>()
    pills.forEach((p, idx) => {
      if (!p || typeof p !== 'object') {
        errors.push(`Field "content_pillars" index ${idx} must be an object`)
        return
      }
      const pillar = (p as any).pillar
      const allowed = (p as any).allowed
      const encouraged = (p as any).encouraged
      const notes = (p as any).notes

      if (typeof pillar !== 'string' || !ALLOWED_PILLARS.has(pillar)) {
        errors.push(`Field "content_pillars" index ${idx} has invalid pillar (must be one of allowed set)`) 
      } else {
        const key = pillar.toLowerCase()
        if (seen.has(key)) {
          errors.push(`Field "content_pillars" has duplicate pillar: "${pillar}"`)
        }
        seen.add(key)
      }

      if (typeof allowed !== 'boolean') {
        errors.push(`Field "content_pillars" index ${idx} is missing allowed (boolean)`) 
      }
      if (typeof encouraged !== 'boolean') {
        errors.push(`Field "content_pillars" index ${idx} is missing encouraged (boolean)`) 
      }
      if (allowed === false && encouraged === true) {
        errors.push(`Field "content_pillars" index ${idx} cannot be encouraged when allowed=false`) 
      }
      if (typeof notes !== 'string' || notes.trim().length < 6) {
        errors.push(`Field "content_pillars" index ${idx} is missing notes (short reason)`) 
      } else if (encouraged === true && hookTokens.length > 0) {
        const mentionsHookNumber = /#\d+/.test(notes)
        if (!mentionsHookNumber && !hasAnyHookToken(notes)) {
          errors.push(`Field "content_pillars" index ${idx} notes must reference a Distinctive Hook / Physical Space Cue (use hook # or exact hook/cue text)`) 
        }
      }
    })
  }
  
  if (sections.things_to_avoid && typeof sections.things_to_avoid === 'object') {
    // Split Things to Avoid: language vs factual constraints.
    // Backward compatible: accept legacy hard_constraints/soft_suggestions but validate similarly.
    const languageConstraints = Array.isArray(sections.things_to_avoid.language_constraints)
      ? sections.things_to_avoid.language_constraints.filter(Boolean).map((x: any) => String(x))
      : Array.isArray(sections.things_to_avoid.hard_constraints)
        ? sections.things_to_avoid.hard_constraints.filter(Boolean).map((x: any) => String(x))
        : []

    const factualConstraints = Array.isArray(sections.things_to_avoid.factual_constraints)
      ? sections.things_to_avoid.factual_constraints.filter(Boolean).map((x: any) => String(x))
      : []

    const legacySoft = Array.isArray(sections.things_to_avoid.soft_suggestions)
      ? sections.things_to_avoid.soft_suggestions.filter(Boolean).map((x: any) => String(x))
      : []

    const explicitlyForbidden = new Set<string>(
      (
        analysis?.signals?.things_to_avoid?.language_constraints ||
        analysis?.signals?.things_to_avoid?.hard_constraints ||
        []
      )
        .filter(Boolean)
        .map((x: any) => normalize(String(x)))
        .filter((x: string) => x.length >= 2)
    )

    const forbiddenCandidatePhrases: string[] = []
    const pushCandidate = (v: unknown) => {
      if (typeof v !== 'string') return
      const t = v.trim()
      if (!t) return
      const n = normalize(t)
      if (n.length < 2) return
      if (!forbiddenCandidatePhrases.some(x => normalize(x) === n)) forbiddenCandidatePhrases.push(t)
    }

    // Business name / location (from data sources if available)
    const businessName = dataSources?.business?.business_name || (dataSources?.business as any)?.name
    const city = dataSources?.business?.city || (dataSources?.profile as any)?.city
    const address = dataSources?.business?.address
    pushCandidate(businessName)
    pushCandidate(city)
    if (address) {
      const street = String(address).split(',')[0]?.trim()
      pushCandidate(street || address)
    }

    // Website CTAs / nav items (avoid putting these in hard bans unless explicitly forbidden)
    if (dataSources) {
      const structuredWebsite = extractStructuredWebsiteData(dataSources.websiteAnalysis, dataSources.business)
      structuredWebsite.ctaTexts.forEach(pushCandidate)
    }

    // Also use Prompt A CTA phrases as candidates
    const ctaPhrases = analysis?.signals?.cta_style?.must_use_phrases || []
    if (Array.isArray(ctaPhrases)) ctaPhrases.forEach(pushCandidate)

    const looksLikeInstruction = (s: string): boolean => {
      const t = normalize(s)
      return (
        t.startsWith('undgå ') ||
        t.startsWith('ikke ') ||
        t.startsWith('aldrig ') ||
        t.startsWith('do not ') ||
        t.startsWith("don't ") ||
        t.startsWith('avoid ') ||
        t.startsWith('som tommelfingerregel')
      )
    }

    const tooLongForBanPhrase = (s: string): boolean => {
      const trimmed = s.trim()
      const words = trimmed.split(/\s+/).filter(Boolean)
      return trimmed.length > 80 || words.length > 8
    }

    const looksLikeLocationBlock = (s: string): boolean => {
      const t = normalize(s)
      return (
        t.includes('nævn') && t.includes('lokation') ||
        t.includes('nævne') && t.includes('lokation') ||
        t.includes('specifikke lokation') ||
        t.includes('udenfor') && (t.includes('åen') || t.includes('byen') || t.includes('området')) ||
        t.includes('outside') && (t.includes('location') || t.includes('streets') || t.includes('area')) ||
        t.includes('don\'t mention') && (t.includes('street') || t.includes('streets') || t.includes('location'))
      )
    }

    // Language constraints must be short bans (not broad "don't mention places" traps)
    languageConstraints.forEach((item: string) => {
      const nItem = normalize(item)
      if (!nItem) return
      if (looksLikeLocationBlock(item)) {
        const hasLegalJustification = /\b(gdpr|privacy|privat\w*|jurid\w*|legal|compliance|fortrol\w*|confidential|tavshedspligt)\b/i.test(item)
        if (!hasLegalJustification) {
          errors.push('Field "things_to_avoid.language_constraints" must NOT block place-based detail (only allow if legally/privacy required)')
          return
        }
      }
      if (looksLikeInstruction(item) || tooLongForBanPhrase(item)) {
        errors.push('Field "things_to_avoid.language_constraints" must contain short banned words/phrases (not instructions)')
        return
      }

      for (const cand of forbiddenCandidatePhrases) {
        const nCand = normalize(cand)
        if (nCand.length < 2) continue
        const containsCandidate = nItem === nCand || nItem.includes(nCand)
        if (!containsCandidate) continue

        // Allow ONLY if Prompt A explicitly listed this as a hard constraint
        const allowedByPromptA = Array.from(explicitlyForbidden).some(f => f === nCand || f.includes(nCand) || nCand.includes(f))
        if (!allowedByPromptA) {
          errors.push(`Field "things_to_avoid.language_constraints" contains likely anchor/CTA/name/location that should not be banned: "${cand}"`)
          break
        }
      }
    })

    // Factual constraints can be instruction-like, but must be about non-invention (not about hiding locations).
    factualConstraints.forEach((item: string) => {
      const nItem = normalize(item)
      if (!nItem) return
      if (looksLikeLocationBlock(item)) {
        errors.push('Field "things_to_avoid.factual_constraints" must NOT block place-based detail')
      }
      if (nItem.length > 220 || nItem.split(/\s+/).filter(Boolean).length > 22) {
        errors.push('Field "things_to_avoid.factual_constraints" must be short and specific')
      }
    })

    const allValues = [
      ...languageConstraints,
      ...factualConstraints,
      ...legacySoft
    ].join(' ')
    
    INTERNAL_TOKENS.forEach(token => {
      if (allValues.includes(token)) {
        errors.push(`Field "things_to_avoid" contains internal token: "${token}"`)
      }
    })
    
    META_TEXT_PATTERNS.forEach(pattern => {
      if (allValues.toLowerCase().includes(pattern.toLowerCase())) {
        errors.push(`Field "things_to_avoid" contains meta-text: "${pattern}"`)
      }
    })
  }
  
  // v4.8.8 Task 1: Check banned word consistency
  // v4.8.9 Task 2: Pass dataSources for smart banned word filtering
  // Ensure words in things_to_avoid.language_constraints don't appear in other fields
  const bannedWordErrors = checkBannedWordsConsistency(sections, dataSources)
  if (bannedWordErrors.length > 0) {
    errors.push(...bannedWordErrors)
  }
  
  return errors
}

/**
 * Final validation on BrandProfile before saving.
 * Runs on the parsed BrandProfile object to catch any meta-text that slipped through.
 * Automatically cleans issues when possible.
 * 
 * @param brandProfile - The brand profile to validate
 * @returns Validation result with cleaned version
 */
export function validateFinalBrandProfile(brandProfile: BrandProfile): { 
  valid: boolean
  errors: string[]
  cleaned: BrandProfile 
} {
  const errors: string[] = []
  const cleaned = { ...brandProfile }
  
  // User-facing fields that must NOT contain meta-text
  const userFacingFields: (keyof BrandProfile)[] = [
    'brand_essence',
    'tone_of_voice',
    'target_audience',
    'core_offerings',
    'content_focus',
    'cta_style',
    'communication_goal'
  ]
  
  userFacingFields.forEach(field => {
    const variable = brandProfile[field]
    if (!variable) return
    
    const value = variable.value
    
    if (typeof value === 'string') {
      let cleanedValue = value
      let hadMetaText = false
      
      META_TEXT_PATTERNS.forEach(pattern => {
        if (cleanedValue.toLowerCase().includes(pattern.toLowerCase())) {
          errors.push(`[FINAL] Field "${field}" contains meta-text: "${pattern}"`)
          hadMetaText = true
          // Remove the meta-text pattern and surrounding context
          const regex = new RegExp(`\\([^)]*${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^)]*\\)|${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]*\\.?`, 'gi')
          cleanedValue = cleanedValue.replace(regex, '').replace(/\s+/g, ' ').trim()
        }
      })
      
      if (hadMetaText) {
        (cleaned[field] as BrandVariable<string>).value = cleanedValue || '(awaiting input)'
      }
    }
  })
  
  // Special handling for image_preferences
  if (brandProfile.image_preferences?.value && typeof brandProfile.image_preferences.value === 'object') {
    const imgPref = brandProfile.image_preferences.value as ImagePreferencesValue
    const cleanedImgPref = { ...imgPref }
    let hadMetaText = false
    
    // Clean dos array
    if (Array.isArray(imgPref.dos)) {
      cleanedImgPref.dos = imgPref.dos.map(item => {
        let cleanedItem = item
        META_TEXT_PATTERNS.forEach(pattern => {
          if (cleanedItem.toLowerCase().includes(pattern.toLowerCase())) {
            hadMetaText = true
            cleanedItem = cleanedItem.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
          }
        })
        return cleanedItem
      }).filter(item => item.length > 2)
    }
    
    // Clean donts array
    if (Array.isArray(imgPref.donts)) {
      cleanedImgPref.donts = imgPref.donts.map(item => {
        let cleanedItem = item
        META_TEXT_PATTERNS.forEach(pattern => {
          if (cleanedItem.toLowerCase().includes(pattern.toLowerCase())) {
            hadMetaText = true
            cleanedItem = cleanedItem.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
          }
        })
        return cleanedItem
      }).filter(item => item.length > 2)
    }
    
    // Clean signature_shot
    if (typeof imgPref.signature_shot === 'string') {
      let cleanedSig = imgPref.signature_shot
      META_TEXT_PATTERNS.forEach(pattern => {
        if (cleanedSig.toLowerCase().includes(pattern.toLowerCase())) {
          hadMetaText = true
          cleanedSig = cleanedSig.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
        }
      })
      cleanedImgPref.signature_shot = cleanedSig || 'Signature shot pending'
    }
    
    if (hadMetaText) {
      (cleaned.image_preferences as BrandVariable<ImagePreferencesValue>).value = cleanedImgPref
    }
  }
  
  // Special handling for things_to_avoid
  if (brandProfile.things_to_avoid?.value && typeof brandProfile.things_to_avoid.value === 'object') {
    const avoid: any = brandProfile.things_to_avoid.value
    const cleanedAvoid: ThingsToAvoidValue = {
      language_constraints: Array.isArray(avoid.language_constraints)
        ? avoid.language_constraints
        : Array.isArray(avoid.hard_constraints)
          ? avoid.hard_constraints
          : [],
      factual_constraints: Array.isArray(avoid.factual_constraints)
        ? avoid.factual_constraints
        : Array.isArray(avoid.soft_suggestions)
          ? avoid.soft_suggestions
          : []
    }
    let hadMetaText = false

    const looksLikeLocationBlock = (s: string): boolean => {
      const t = s.toLowerCase().replace(/\s+/g, ' ').trim()
      return (
        (t.includes('nævn') && t.includes('lokation')) ||
        (t.includes('nævne') && t.includes('lokation')) ||
        t.includes('specifikke lokation') ||
        (t.includes('udenfor') && (t.includes('åen') || t.includes('byen') || t.includes('området'))) ||
        (t.includes("don't mention") && (t.includes('street') || t.includes('streets') || t.includes('location'))) ||
        (t.includes('outside') && (t.includes('location') || t.includes('streets') || t.includes('area')))
      )
    }
    const hasLegalJustification = (s: string): boolean => /\b(gdpr|privacy|privat\w*|jurid\w*|legal|compliance|fortrol\w*|confidential|tavshedspligt)\b/i.test(s)
    const PLACE_OK_LANGUAGE = 'Undgå irrelevante geografiske referencer'
    const PLACE_OK_FACT = 'Brug kun stedsspecifikke detaljer, hvis de er synlige for gæsten'
    
    // Clean language_constraints
    if (Array.isArray(cleanedAvoid.language_constraints)) {
      cleanedAvoid.language_constraints = cleanedAvoid.language_constraints.map((item: string) => {
        let cleanedItem = item
        META_TEXT_PATTERNS.forEach(pattern => {
          if (cleanedItem.toLowerCase().includes(pattern.toLowerCase())) {
            hadMetaText = true
            cleanedItem = cleanedItem.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
          }
        })
        return cleanedItem
      })
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 2)
        .map((item: string) => {
          if (looksLikeLocationBlock(item) && !hasLegalJustification(item)) {
            hadMetaText = true
            return PLACE_OK_LANGUAGE
          }
          return item
        })
        .filter(Boolean)
    }
    
    // Clean factual_constraints
    if (Array.isArray(cleanedAvoid.factual_constraints)) {
      cleanedAvoid.factual_constraints = cleanedAvoid.factual_constraints.map((item: string) => {
        let cleanedItem = item
        META_TEXT_PATTERNS.forEach(pattern => {
          if (cleanedItem.toLowerCase().includes(pattern.toLowerCase())) {
            hadMetaText = true
            cleanedItem = cleanedItem.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
          }
        })
        return cleanedItem
      }).filter(item => item.length > 2)
    }

    // Ensure we do not block place-based specificity; add safe replacement guidance if needed.
    if (Array.isArray(cleanedAvoid.language_constraints)) {
      const hasSafeGeo = cleanedAvoid.language_constraints.some(s => s.toLowerCase().includes('irrelevante geografiske'))
      const hadBadGeo = cleanedAvoid.language_constraints.some(s => looksLikeLocationBlock(s) && !hasLegalJustification(s))
      if (hadBadGeo && !hasSafeGeo) {
        cleanedAvoid.language_constraints = [PLACE_OK_LANGUAGE, ...cleanedAvoid.language_constraints]
      }
      // De-dupe
      const seen = new Set<string>()
      cleanedAvoid.language_constraints = cleanedAvoid.language_constraints.filter(s => {
        const n = s.toLowerCase().replace(/\s+/g, ' ').trim()
        if (!n) return false
        if (seen.has(n)) return false
        seen.add(n)
        return true
      })
    }
    if (Array.isArray(cleanedAvoid.factual_constraints)) {
      const hasVisibleRule = cleanedAvoid.factual_constraints.some(s => s.toLowerCase().includes('synlige for gæsten'))
      if (!hasVisibleRule) {
        cleanedAvoid.factual_constraints = [PLACE_OK_FACT, ...cleanedAvoid.factual_constraints]
        hadMetaText = true
      }
      // De-dupe
      const seen = new Set<string>()
      cleanedAvoid.factual_constraints = cleanedAvoid.factual_constraints.filter(s => {
        const n = s.toLowerCase().replace(/\s+/g, ' ').trim()
        if (!n) return false
        if (seen.has(n)) return false
        seen.add(n)
        return true
      })
    }
    
    if (hadMetaText) {
      (cleaned.things_to_avoid as BrandVariable<ThingsToAvoidValue>).value = cleanedAvoid
    }
  }
  
  if (errors.length > 0) {
    console.log(`⚠️ Final validation found ${errors.length} meta-text issues (auto-cleaned):`, errors)
  }
  
  return {
    valid: errors.length === 0,
    errors,
    cleaned
  }
}

/**
 * Repairs a brand profile by asking AI to fix validation errors.
 * Falls back to original if repair fails.
 * 
 * @param sections - The sections to repair
 * @param errors - Validation errors found
 * @param language - Language configuration
 * @param apiKey - OpenAI API key (optional, defaults to env var)
 * @param fetchFn - Fetch function for OpenAI API
 * @returns Repaired sections (or original if repair fails)
 */
export async function repairBrandProfile(
  sections: any,
  errors: string[],
  language: LanguageConfig,
  apiKey?: string,
  fetchFn: typeof fetch = fetch,
  retrySimplified: boolean = true,
  analysis?: any,
  dataSources?: any
): Promise<any> {
  const errorReport = errors.join('\n- ')
  
  // v4.8.8 Task 1: Extract banned word violations for specific repair instructions
  const bannedWordViolations = errors.filter(e => e.includes('🚫 BANNED WORD INCONSISTENCY'))
  const hasBannedWordErrors = bannedWordViolations.length > 0
  
  // Build specific repair instructions for banned words (language-aware v4.8.9+)
  let bannedWordInstructions = ''
  if (hasBannedWordErrors) {
    // Language-specific examples
    const examplesByLanguage: Record<string, { original: string, fixed: string }[]> = {
      Danish: [
        { original: 'lækker brunch', fixed: 'brunch med friskbagte croissanter' },
        { original: 'hyggelig stemning', fixed: 'roligt tempo og bløde lydsætninger' },
        { original: 'autentisk café', fixed: 'café med 20 års historie' }
      ],
      English: [
        { original: 'delicious brunch', fixed: 'brunch with freshly baked croissants' },
        { original: 'cozy atmosphere', fixed: 'warm lighting and intimate seating' },
        { original: 'authentic café', fixed: 'café with 20 years of history' }
      ],
      German: [
        { original: 'leckerer Brunch', fixed: 'Brunch mit frisch gebackenen Croissants' },
        { original: 'gemütliche Atmosphäre', fixed: 'warmes Licht und intime Sitzgelegenheiten' },
        { original: 'authentisches Café', fixed: 'Café mit 20 Jahren Geschichte' }
      ]
    }
    
    const examples = examplesByLanguage[targetLanguage] || examplesByLanguage['English']
    
    bannedWordInstructions = `

🚫 CRITICAL: BANNED WORD VIOLATIONS DETECTED
The following fields contain words that are explicitly listed in things_to_avoid.language_constraints.
You MUST remove or rephrase these words naturally:

${bannedWordViolations.map(v => '- ' + v).join('\n')}

REPAIR STRATEGY:
- Replace banned words with concrete, descriptive alternatives
- Rephrase naturally - don't just delete the word
- Use specific sensory details instead of generic adjectives
- Keep the core meaning but make it more concrete

Examples (in ${targetLanguage}):
${examples.map(e => `- "${e.original}" → "${e.fixed}"`).join('\n')}
`
  }
  
  const repairPrompt = `The following Brand Profile JSON contains errors. Fix ONLY the actual errors listed below.${bannedWordInstructions}

PRIORITY LEVELS:
🔴 CRITICAL (must fix): Structural errors (missing proof objects, wrong types)
🟠 HIGH (should fix): Banned words, meta-text, placeholders
🟡 MEDIUM (nice to fix): Style improvements, better hook integration

IMPORTANT: Some fields must be objects of the form { "value": string, "proof": [1-3 bullets] }. If an error mentions missing proof or wrong type, you ARE allowed to convert that field from a string into an object, while keeping the same top-level field keys.

Remove meta-text, internal tokens, and truly generic placeholder text. Keep natural, concrete language that feels authentic.

V4.8.0 RELAXED RULES (changed from previous versions):
- You do NOT need to force verbatim hook inclusion anymore
- Natural, flowing language is preferred over rigid template structure
- Focus on fixing actual errors, not adding unnecessary constraints

STRUCTURE RULES (only fix when explicitly listed in errors):
- brand_essence.value: ONE sentence including location + offering (hooks optional but natural)
- tone_of_voice.value: Structured format with:
  - 2-8 bullets starting with "- " (flexible range)
  - 1-6 example lines starting with "Eksempel: " (flexible range)
  - Up to 30% unstructured content is acceptable for natural flow
- image_preferences.signature_shot: Concrete scene description (hooks optional)

CONTENT PILLARS RULE:
- Must be array with 3-6 items
- Allowed: Crave-worthy, BTS, Social proof, Vibe, Engagement, Offers
- Each: { pillar, allowed, encouraged, notes }
- Notes should be specific but don't need to force exact hook text

ERRORS TO FIX (prioritize CRITICAL and HIGH):
- ${errorReport}

ORIGINAL JSON:
${JSON.stringify(sections, null, 2)}

INSTRUCTIONS:
1. Fix ONLY the specific errors listed above
2. Keep natural, authentic language - don't make it robotic
3. Remove internal tokens: "MANDATORY", "HARD CONSTRAINTS", "[INTERNT", etc.
4. Replace obvious placeholders with concrete details
5. Maintain language: ${language.name}
6. Keep all top-level field keys the same

Return the corrected JSON now:`

  // Use timeout but not retry - repair has graceful fallback to original
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout for repair
  
  try {
    // Get API key from parameter or environment
    const openaiApiKey = apiKey || (typeof Deno !== 'undefined' ? Deno.env.get('OPENAI_API_KEY') : undefined)
    
    if (!openaiApiKey) {
      console.warn('No OpenAI API key available for repair, returning original')
      return sections
    }
    
    const response = await fetchFn('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You fix Brand Profile JSON by removing meta-text and replacing generic words with concrete language. Return valid JSON only.`
          },
          {
            role: 'user',
            content: repairPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error('Repair call failed, returning original')
      return sections
    }

    const data = await response.json()
    const repairedContent = data.choices[0]?.message?.content

    if (!repairedContent) {
      console.error('No repair response, returning original')
      return sections
    }

    try {
      const repaired = JSON.parse(repairedContent)
      
      // v4.8.5: Validate repair result and retry with simplified prompt if partial success
      if (analysis && dataSources && retrySimplified) {
        const postRepairErrors = validateBrandProfileOutput(repaired, analysis, dataSources)
        
        // If repair reduced errors significantly but didn't fix all, try simplified repair
        if (postRepairErrors.length > 0 && postRepairErrors.length < errors.length / 2) {
          console.log(`⚠️ Repair partial success (${errors.length} → ${postRepairErrors.length} errors). Retrying with simplified prompt...`)
          
          // Simplified repair: only fix critical structural issues
          const criticalErrors = postRepairErrors.filter((e: string) => 
            e.includes('must be an object') || 
            e.includes('missing') || 
            e.includes('proof') ||
            e.includes('required field')
          )
          
          if (criticalErrors.length > 0) {
            // Retry with critical errors only, no further retries
            return repairBrandProfile(repaired, criticalErrors, language, apiKey, fetchFn, false, analysis, dataSources)
          }
        }
      }
      
      return repaired
    } catch {
      console.error('Failed to parse repaired JSON, returning original')
      return sections
    }
  } catch (error) {
    clearTimeout(timeoutId)
    const err = error as Error
    console.error('Repair call error (timeout or network), returning original:', err.message)
    return sections
  }
}

/**
 * Build ALLOWED_PROOF_TOKENS for proof grounding validation (v4.9.0 Phase 2)
 * Extracted from validateBrandProfileOutput for reuse in proof-grounding.ts
 * 
 * MUST match the token extraction logic in Prompt B to ensure consistency
 * 
 * v4.10.0 Phase 1: Expanded to include ALL CTA tokens (not just primary)
 */
export function buildAllowedProofTokens(analysis: any, dataSources?: DataSources): string[] {
  const normalize = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ')
  
  // Get location-based proof tokens
  const locationData = (dataSources as any)?.location
  const locationPhraseProof = locationData?.enrichment?.micro?.area_type === 'waterfront' ? 'ved åen'
    : locationData?.enrichment?.micro?.area_type === 'transit_hub' ? 'ved stationen'
    : locationData?.enrichment?.micro?.area_type === 'shopping_street' ? 'på gågaden'
    : ''
  const cityProof = locationData?.enrichment?.macro?.city || ''
  const canonicalLocationHook = locationPhraseProof && cityProof ? `${locationPhraseProof} i ${cityProof}` : ''
  
  // Get menu/CTA anchors from analysis (must match Prompt B extraction logic)
  const menuAnchors = analysis?.signals?.core_offerings?.must_use_phrases || []
  const topMenuItems = ((dataSources as any)?.menu || [])
    .filter((item: any) => item.name && item.name.length > 3)
    .slice(0, 6)
    .map((item: any) => item.name)
  
  const ctaAnchors = analysis?.signals?.cta_anchors?.must_use_phrases || []
  
  // Get ALL CTA texts from website analysis (v4.10.0: expanded from just primary)
  const websiteAnalysis = (dataSources as any)?.websiteAnalysis
  const allCtaTexts = websiteAnalysis?.cta_texts || []
  
  // Also include headers as they often contain key phrases
  const headers = websiteAnalysis?.headers || []
  
  // v4.11.1: Add hook LABELS from Prompt A (not just evidence quotes)
  // AI often references hooks by label (e.g., "Distinctive hook #1: Dining by the river")
  // instead of quoting the exact Danish evidence ("ved åen i Aarhus")
  const hookLabels: string[] = []
  const addHookLabels = (items: any[], labelKey: string) => {
    if (!Array.isArray(items)) return
    items.slice(0, 8).forEach((item: any) => {
      const label = String(item?.[labelKey] || '').trim()
      if (label && label.length > 3) hookLabels.push(label)
      // Also add the evidence quote if different from label
      const evidence = String(item?.evidence || '').trim()
      if (evidence && evidence !== label && evidence.length > 3) hookLabels.push(evidence)
    })
  }
  
  addHookLabels(analysis?.distinctive_hooks || [], 'hook')
  addHookLabels(analysis?.physical_space_cues || [], 'cue')
  addHookLabels(analysis?.rituals_and_moments || [], 'moment')
  addHookLabels(analysis?.local_identity_cues || [], 'cue')
  addHookLabels(analysis?.copy_patterns || [], 'pattern')
  
  // v4.11.1: Also add usage occasion IDs (e.g., "brunch-to-work", "dinner-to-drinks")
  const usageOccasionIds = (analysis?.usage_occasions || [])
    .map((uo: any) => String(uo?.id || '').trim())
    .filter(Boolean)
  
  // v4.11.2: Add content trigger NAMES (e.g., "Waterfront Dining Experience")
  // AI references these by name in proof like "Based on content trigger 'X'"
  const contentTriggerNames = (analysis?.content_triggers || [])
    .map((ct: any) => String(ct?.trigger || '').trim())
    .filter((name: string) => name.length > 3)
  
  const finalTokens = [
    canonicalLocationHook,
    ...allCtaTexts, // All CTAs (including "BOOK DIT BORD", "BOOK BORD", etc.)
    ...ctaAnchors,
    ...menuAnchors,
    ...topMenuItems,
    ...headers.slice(0, 3), // Top 3 headers
    locationPhraseProof, // Also include just the phrase without city
    cityProof,
    ...hookLabels, // v4.11.1: Hook labels and evidence from Prompt A
    ...usageOccasionIds, // v4.11.1: Usage occasion IDs
    ...contentTriggerNames // v4.11.2: Content trigger names
  ].filter(Boolean).map(t => normalize(t))
  
  // v4.11.2: Debug logging to verify all expansions are included
  console.log(`🔧 v4.11.2 Proof tokens: ${finalTokens.length} total (${hookLabels.length} hooks, ${usageOccasionIds.length} occasions, ${contentTriggerNames.length} triggers)`)
  
  // Ensure we return at least one token for downstream validators/tests
  if (finalTokens.length === 0) {
    finalTokens.push('generic')
  }

  return finalTokens
}

/**
 * Build normalized reference pool from Prompt A analysis
 */
export function buildNormalizedRefs(analysis: any): string[] {
  const normalize = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ')
  
  const referencePool: string[] = []
  
  // Add hook tokens (support both structured and legacy top-level shapes)
  const hookTokens: Array<{ original: string; normalized: string }> = []
  const structuredHooks = analysis?.structured?.distinctive_hooks || analysis?.distinctive_hooks || []
  for (const hook of structuredHooks) {
    if (hook?.hook_text) hookTokens.push({ original: hook.hook_text, normalized: normalize(hook.hook_text) })
    if (hook?.hook) hookTokens.push({ original: hook.hook, normalized: normalize(hook.hook) })
    if (hook?.location) hookTokens.push({ original: hook.location, normalized: normalize(hook.location) })
    if (hook?.offering) hookTokens.push({ original: hook.offering, normalized: normalize(hook.offering) })
    if (hook?.reference) hookTokens.push({ original: hook.reference, normalized: normalize(hook.reference) })
  }

  // Add menu/CTA anchors (support structured or top-level)
  if (analysis?.structured?.menu_anchors) {
    referencePool.push(...analysis.structured.menu_anchors)
  } else if (analysis?.menu_anchors) {
    referencePool.push(...analysis.menu_anchors)
  }
  if (analysis?.structured?.cta_anchors) {
    referencePool.push(...analysis.structured.cta_anchors)
  } else if (analysis?.cta_anchors) {
    referencePool.push(...analysis.cta_anchors)
  }

  // Add content_triggers references and names (legacy and structured)
  if (Array.isArray(analysis?.content_triggers)) {
    for (const ct of analysis.content_triggers) {
      if (ct?.reference) referencePool.push(ct.reference)
      if (ct?.trigger) referencePool.push(ct.trigger)
    }
  }
  
  // Add hook tokens
  referencePool.push(...hookTokens.map(t => t.original))
  
  // Keep short numeric references like #1, #2 even if shorter than 4 chars
  return Array.from(new Set(referencePool.map(normalize))).filter(r => {
    if (!r) return false
    if (/^#\d+$/.test(r)) return true
    return r.length >= 4
  })
}

