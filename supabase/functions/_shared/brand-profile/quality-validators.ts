/**
 * Quality Validators - Voice Quality Enhancement
 * 
 * Advanced validation layer that checks for:
 * - Emotional positioning (not just operational lists)
 * - Forbidden operational patterns
 * - Sensory grounding (concrete details)
 * - Factual accuracy (no invented claims)
 * 
 * Created: April 29, 2026
 * Purpose: Ensure AI output follows emotional positioning guidelines
 */

import type { DataSources } from './types.ts'

// ============================================================================
// FORBIDDEN PATTERNS - Operational Language Detection
// ============================================================================

/**
 * Patterns that indicate operational listing instead of emotional positioning.
 * These should NOT appear in brand_essence (they belong in business_character).
 */
const FORBIDDEN_OPERATIONAL_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // Temporal arc patterns (day-to-evening transitions) - ONLY if using business transformation language
  // "om dagen...om aftenen" is forbidden if it describes what VENUE does (operational)
  // "om morgenen når du..." or "om aftenen når du..." is OK if it describes GUEST experience (emotional)
  { pattern: /\b(serverer|tilbyder|byder på|laver|åbner)\b.*\bom dagen\b.*\bom aftenen\b/i, reason: 'temporal arc "om dagen...om aftenen" with operational verb is business-centric (use guest-centric language)' },
  { pattern: /\bom dagen\b.*\b(skifter til|går over til|transformerer til)\b/i, reason: 'temporal transition with transformation verb describes business operations, not guest experience' },
  { pattern: /\bfrå\s+\w+\s+til\s+\w+\b/i, reason: 'temporal range "fra X til Y" is operational (focus on emotional need instead)' },
  
  // Programme enumeration patterns
  { pattern: /\bbrunch\b.*\bog\s+frokost\b.*\btil\b.*\baftensmad\b/i, reason: 'programme enumeration (brunch...frokost...aftensmad) is operational listing' },
  { pattern: /\b(serverer|byder på|tilbyder)\s+\w+\s+og\s+\w+\s+og\s+\w+/i, reason: 'triple offering list is operational (choose primary emotional hook)' },
  
  // Transformation/transition verbs (business-centric, not guest-centric)
  { pattern: /\bskifter til\b/i, reason: '"skifter til" describes business operations, not guest experience' },
  { pattern: /\bgår over til\b/i, reason: '"går over til" is operational transition language' },
  { pattern: /\btransformerer til\b/i, reason: '"transformerer til" is operational, not emotional' },
  
  // Generic operational structures
  { pattern: /\b(café|restaurant|bar),\s+(restaurant|café|bar)\s+og\s+(bar|café|restaurant)\b/i, reason: 'venue type enumeration is structural, not emotional' },
]

/**
 * Check if text contains forbidden operational patterns.
 * Returns array of violations with specific reasons.
 */
export function detectForbiddenPatterns(text: string): Array<{ pattern: string; reason: string }> {
  const violations: Array<{ pattern: string; reason: string }> = []
  
  for (const { pattern, reason } of FORBIDDEN_OPERATIONAL_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      violations.push({
        pattern: match[0],
        reason
      })
    }
  }
  
  return violations
}

// ============================================================================
// EMOTIONAL POSITIONING - Detect "Why" vs "What" Language
// ============================================================================

/**
 * Emotional positioning signals - language that answers "why guest chooses this venue"
 * Examples: "det velfortjente stop", "hvor tiden står stille", "til den sene snak"
 */
const EMOTIONAL_POSITIONING_SIGNALS: RegExp[] = [
  // Emotional need statements
  /\b(det|den|de)\s+(velfortjente|fortjente|eftertragtede|eftersøgte)\s+\w+/i,
  /\btil\s+(den|det|de)\s+\w+\s+(snak|stund|pause|øjeblik|moment)/i,
  /\bhvor\s+(tiden|stemningen|atmosfæren)\s+(står stille|folder sig ud|sætter tonen)/i,
  /\bnår\s+(du|man)\s+(skal have|fortjener|trænger til|ønsker)/i,
  
  // Temporal emotional framing (not operational time ranges)
  /\bi\s+roligt\s+tempo/i,
  /\buden\s+stress/i,
  /\bmens\s+(solen|lyset|dagen|aftenen|stemningen)/i,
  
  // Sensory emotional hooks
  /\bmed\s+\w+\s+i\s+baggrunden/i, // "med musik i baggrunden", "med åen i baggrunden"
  /\bunder\s+(åben\s+himmel|træernes\s+skygge)/i,
]

/**
 * Operational language signals - language that describes what venue IS/OFFERS
 * Examples: "serverer brunch", "åbent til kl. 23", "med 3 menuer"
 */
const OPERATIONAL_LANGUAGE_SIGNALS: RegExp[] = [
  /\b(serverer|tilbyder|byder på|laver)\s+\w+/i,
  /\b(åbent?|åbner)\s+(til|fra|kl\.)/i,
  /\bmed\s+\d+\s+(menu|menuer|retter)/i,
  /\b(består af|indeholder|omfatter)\s+\w+/i,
]

/**
 * Check if text has emotional positioning (answers "why" not "what").
 * Returns score 0-10 where higher = more emotional positioning.
 */
export function detectEmotionalPositioning(text: string): {
  score: number
  hasEmotionalHook: boolean
  emotionalSignals: string[]
  operationalSignals: string[]
} {
  const emotionalSignals: string[] = []
  const operationalSignals: string[] = []
  
  // Count emotional signals
  for (const pattern of EMOTIONAL_POSITIONING_SIGNALS) {
    const match = text.match(pattern)
    if (match) {
      emotionalSignals.push(match[0])
    }
  }
  
  // Count operational signals
  for (const pattern of OPERATIONAL_LANGUAGE_SIGNALS) {
    const match = text.match(pattern)
    if (match) {
      operationalSignals.push(match[0])
    }
  }
  
  // Calculate score (0-10)
  // - Each emotional signal adds +3 points
  // - Each operational signal subtracts -2 points
  // - Minimum 0, maximum 10
  const rawScore = (emotionalSignals.length * 3) - (operationalSignals.length * 2)
  const score = Math.max(0, Math.min(10, rawScore))
  
  const hasEmotionalHook = emotionalSignals.length > 0
  
  return {
    score,
    hasEmotionalHook,
    emotionalSignals,
    operationalSignals
  }
}

// ============================================================================
// SENSORY GROUNDING - Concrete Details Detection
// ============================================================================

/**
 * Sensory detail patterns organized by hierarchy (safe → dangerous)
 * Visual and temporal are safest (always observable)
 * Sound and smell are dangerous (require physical reality checks)
 */
const SENSORY_PATTERNS = {
  visual: [
    /\b(udsigt|view|blik)\s+(over|til|mod)\s+\w+/i,
    /\b(lys|lyset|sollys|aftenlys|belysning)\b/i,
    /\bfarve(r|n|rne)?\b/i,
    /\b(grøn|grønne|træer|træerne|planter|blomster)\b/i,
    /\b(arkitektur|interiør|indretning|design)\b/i,
  ],
  temporal: [
    /\bi\s+roligt\s+tempo/i,
    /\b(mens|når)\s+(solen|lyset|dagen|aftenen|morgenen)\b/i,
    /\b(tidlig|sen)\s+(morgen|formiddag|eftermiddag|aften)\b/i,
    /\bhvor\s+tiden\s+(står stille|går sin gang|flyver af sted)/i,
    // Temporal moments (emotional, not operational)
    /\b(om\s+morgenen|om\s+aftenen|om\s+natten)\s+(når|mens)/i,
  ],
  spatial: [
    // Waterfront locations (matches waterfront injection terms)
    /\bved\s+(åen|havet|søen|vandet|kysten|havnen|broen|stationen)/i,
    /\bi\s+(byen|city|centrum)\b/i,
    /\bpå\s+(gågaden|torvet|pladsen|hjørnet)/i,
    /\bi\s+(hjertet af|centrum af|midten af)\b/i,
    /\bi\s+[A-ZÆØÅ]\w+/,  // "i Aarhus", "i København" etc.
    /\btæt på\s+\w+/i,
  ],
  movement: [
    /\b(strømmer|flyder|driver)\s+(forbi|af sted)/i,
    /\b(cykler|går|vandrer)\s+(forbi|gennem)/i,
  ],
  sound: [
    /\b(lyden af|lyde fra|musik fra)\s+\w+/i,
    /\b(bølger|vand|å|flod)\b.*\b(lyd|lyder|larm|støj)/i,
  ],
  smell: [
    /\b(duften af|dufte|aroma)\s+\w+/i,
  ],
}

/**
 * Physical reality rules for waterfront venues.
 * Prevents unrealistic sensory claims like "lyden af åen" for calm rivers.
 */
const WATERFRONT_SOUND_RULES = {
  // Sea/ocean/coast - audible waves OK
  allowSound: ['hav', 'ocean', 'kyst', 'strand', 'sea', 'ocean', 'coast', 'beach'],
  // Rivers/lakes/canals - NO audible water sounds (too calm)
  noSound: ['å', 'flod', 'kanal', 'sø', 'river', 'canal', 'lake'],
}

/**
 * Check if text contains sensory grounding (concrete observable details).
 * Also validates physical reality rules (e.g., no water sounds for calm rivers).
 */
export function detectSensoryGrounding(text: string, location?: any): {
  totalCount: number
  byCategory: Record<string, string[]>
  physicalRealityViolations: Array<{ detail: string; violation: string }>
  hasSufficientGrounding: boolean
} {
  const byCategory: Record<string, string[]> = {
    visual: [],
    temporal: [],
    spatial: [],
    movement: [],
    sound: [],
    smell: [],
  }
  
  const physicalRealityViolations: Array<{ detail: string; violation: string }> = []
  
  // Detect sensory details by category
  for (const [category, patterns] of Object.entries(SENSORY_PATTERNS)) {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        byCategory[category].push(match[0])
      }
    }
  }
  
  // Validate physical reality for waterfront venues
  if (location?.enrichment?.micro?.area_type === 'waterfront') {
    const waterfrontTerm = location?.enrichment?.micro?.waterfront_term || ''
    const isCalm = WATERFRONT_SOUND_RULES.noSound.some(term => 
      waterfrontTerm.toLowerCase().includes(term)
    )
    
    if (isCalm && byCategory.sound.length > 0) {
      // Check if sound references water (forbidden for calm water)
      for (const soundDetail of byCategory.sound) {
        if (/\b(å|flod|kanal|sø|vand|bølge|river|canal|lake|water|wave)/i.test(soundDetail)) {
          physicalRealityViolations.push({
            detail: soundDetail,
            violation: `Rivers/lakes/canals are too calm for audible water sounds. Use visual or temporal details instead.`
          })
        }
      }
    }
  }
  
  const totalCount = Object.values(byCategory).reduce((sum, details) => sum + details.length, 0)
  
  // Requirement: At least 1 sensory detail from safe categories (visual, temporal, or spatial)
  // Sound and smell require physical reality validation
  const safeCategories = byCategory.visual.length + byCategory.temporal.length + byCategory.spatial.length
  const hasSufficientGrounding = safeCategories >= 1
  
  return {
    totalCount,
    byCategory,
    physicalRealityViolations,
    hasSufficientGrounding
  }
}

// ============================================================================
// FACTUAL ACCURACY - Detect Unverified Claims
// ============================================================================

/**
 * Patterns that indicate potentially invented claims (not verifiable from data).
 * Examples: "40 år gammel opskrift", "min mormor", "hemmeligt trick"
 */
const UNVERIFIABLE_CLAIM_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  // Family heritage claims
  { pattern: /\b(mormor|morfar|farmor|farfar|bedstemor|bedsteforældre|familie)\b.*\b(opskrift|recept|hemmelighed|tradition)/i, type: 'family_heritage' },
  { pattern: /\b(opskrift|recept|tradition)\b.*\b(mormor|morfar|farmor|farfar|familie)/i, type: 'family_heritage' },
  
  // Historical age claims
  { pattern: /\b\d+\s+(år|years)\s+(gammel|old|siden|ago)\b/i, type: 'historical_age' },
  { pattern: /\b(etableret|grundlagt|startet|åbnet|founded|established|started)\s+(i\s+)?\d{4}\b/i, type: 'founding_date' },
  { pattern: /\bsiden\s+\d{4}\b/i, type: 'founding_date' },
  
  // Sourcing/provenance claims
  { pattern: /\b(hemmeligt?|secret)\s+(recept|opskrift|ingrediens|trick|metode)/i, type: 'secret_recipe' },
  { pattern: /\b(lokalt?|locally)\s+(produceret|dyrket|fanget|sourced|grown)/i, type: 'sourcing' },
  { pattern: /\b(importeret fra|imported from)\s+\w+/i, type: 'sourcing' },
  
  // Award/recognition claims
  { pattern: /\b(vundet|won|modtaget|received)\s+(pris|award|anerkendelse|recognition)/i, type: 'awards' },
  { pattern: /\b(prisbelønnet|award.?winning)\b/i, type: 'awards' },
  
  // Superlative claims (often unverifiable)
  { pattern: /\b(bedste|best)\s+\w+\s+(i|in)\s+(byen|city|området|area|danmark|denmark)/i, type: 'superlative' },
  { pattern: /\b(eneste|only|første|first)\s+\w+\s+(i|in)\s+(byen|city|danmark|denmark)/i, type: 'superlative' },
]

/**
 * Data sources that can verify specific claim types.
 * If claim type is not in this list OR data source is empty, claim is unverifiable.
 */
const VERIFIABLE_FROM_DATA: Record<string, string[]> = {
  founding_date: ['business.founded_year', 'websiteAnalysis.about_text', 'websiteAnalysis.meta_description'],
  sourcing: ['menu.description', 'websiteAnalysis.about_text', 'websiteAnalysis.value_phrases'],
  awards: ['websiteAnalysis.about_text', 'websiteAnalysis.value_phrases'],
}

/**
 * Check if text contains potentially unverified claims.
 * Returns warnings for claims that should be backed by data evidence.
 */
export function detectUnverifiedClaims(text: string, dataSources?: DataSources): {
  potentialViolations: Array<{ claim: string; type: string; reason: string }>
  hasFactualAccuracy: boolean
} {
  const potentialViolations: Array<{ claim: string; type: string; reason: string }> = []
  
  for (const { pattern, type } of UNVERIFIABLE_CLAIM_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      const claim = match[0]
      
      // Check if this claim type can be verified from available data
      const verifiableSources = VERIFIABLE_FROM_DATA[type] || []
      
      if (verifiableSources.length === 0) {
        // No data source can verify this type of claim - always flag it
        potentialViolations.push({
          claim,
          type,
          reason: `${type} claims (like "${claim}") cannot be verified from data - should not be invented`
        })
      } else {
        // This type CAN be verified - check if we have the data
        const hasVerificationData = verifiableSources.some(source => {
          const [object, field] = source.split('.')
          return dataSources?.[object as keyof DataSources]?.[field]
        })
        
        if (!hasVerificationData) {
          potentialViolations.push({
            claim,
            type,
            reason: `${type} claim "${claim}" requires verification from ${verifiableSources.join(' or ')} but no such data available`
          })
        }
      }
    }
  }
  
  const hasFactualAccuracy = potentialViolations.length === 0
  
  return {
    potentialViolations,
    hasFactualAccuracy
  }
}

// ============================================================================
// INTEGRATED QUALITY VALIDATION
// ============================================================================

export interface QualityValidationResult {
  passed: boolean
  errors: string[]
  warnings: string[]
  details: {
    emotionalPositioning: ReturnType<typeof detectEmotionalPositioning>
    forbiddenPatterns: ReturnType<typeof detectForbiddenPatterns>
    sensoryGrounding: ReturnType<typeof detectSensoryGrounding>
    factualAccuracy: ReturnType<typeof detectUnverifiedClaims>
  }
}

/**
 * Comprehensive quality validation for brand_essence.
 * Checks all 4 quality dimensions with sanity checks.
 */
export function validateBrandEssenceQuality(
  brandEssence: string,
  dataSources?: DataSources
): QualityValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Sanity check: brand_essence must exist and be non-empty
  if (!brandEssence || typeof brandEssence !== 'string') {
    errors.push('brand_essence is missing or not a string')
    return {
      passed: false,
      errors,
      warnings,
      details: {
        emotionalPositioning: { score: 0, hasEmotionalHook: false, emotionalSignals: [], operationalSignals: [] },
        forbiddenPatterns: [],
        sensoryGrounding: { totalCount: 0, byCategory: {}, physicalRealityViolations: [], hasSufficientGrounding: false },
        factualAccuracy: { potentialViolations: [], hasFactualAccuracy: true }
      }
    }
  }
  
  // Sanity check: brand_essence must be at least 20 characters
  if (brandEssence.trim().length < 20) {
    errors.push('brand_essence is too short (minimum 20 characters)')
  }
  
  // 1. Check for forbidden operational patterns
  const forbiddenPatterns = detectForbiddenPatterns(brandEssence)
  if (forbiddenPatterns.length > 0) {
    for (const { pattern, reason } of forbiddenPatterns) {
      errors.push(`Forbidden pattern detected: "${pattern}" - ${reason}`)
    }
  }
  
  // 2. Check for emotional positioning
  const emotionalPositioning = detectEmotionalPositioning(brandEssence)
  if (!emotionalPositioning.hasEmotionalHook) {
    errors.push('brand_essence lacks emotional positioning (no "why" hook - only describes what venue offers)')
    errors.push(`  → Add emotional need language like: "det velfortjente stop", "til den sene snak", "hvor tiden står stille"`)
  }
  if (emotionalPositioning.operationalSignals.length > emotionalPositioning.emotionalSignals.length) {
    warnings.push(`brand_essence is more operational than emotional (${emotionalPositioning.operationalSignals.length} operational signals vs ${emotionalPositioning.emotionalSignals.length} emotional)`)
  }
  
  // 3. Check for sensory grounding
  const sensoryGrounding = detectSensoryGrounding(
    brandEssence,
    (dataSources as any)?.location
  )
  
  if (!sensoryGrounding.hasSufficientGrounding) {
    errors.push('brand_essence lacks sensory grounding (need at least 1 visual or temporal detail)')
    errors.push(`  → Add observable details like: "med udsigt til åen", "i roligt tempo", "mens solen går ned"`)
  }
  
  if (sensoryGrounding.physicalRealityViolations.length > 0) {
    for (const { detail, violation } of sensoryGrounding.physicalRealityViolations) {
      errors.push(`Physical reality violation: "${detail}" - ${violation}`)
    }
  }
  
  // 4. Check for factual accuracy
  const factualAccuracy = detectUnverifiedClaims(brandEssence, dataSources)
  if (!factualAccuracy.hasFactualAccuracy) {
    for (const { claim, reason } of factualAccuracy.potentialViolations) {
      errors.push(`Unverified claim: "${claim}" - ${reason}`)
    }
  }
  
  const passed = errors.length === 0
  
  return {
    passed,
    errors,
    warnings,
    details: {
      emotionalPositioning,
      forbiddenPatterns,
      sensoryGrounding,
      factualAccuracy
    }
  }
}

/**
 * Sanity check: Validate that validation itself is working correctly.
 * Returns test results for known good/bad examples.
 */
export function runValidationSanityChecks(): {
  passed: boolean
  results: Array<{ test: string; expected: boolean; actual: boolean; details?: any }>
} {
  const results: Array<{ test: string; expected: boolean; actual: boolean; details?: any }> = []
  
  // Test 1: Good example (should pass)
  const goodExample = "Det velfortjente stop ved åen i Aarhus — til den sene snak over kaffe om morgenen eller drinks når du skal have det godt."
  const goodResult = validateBrandEssenceQuality(goodExample)
  results.push({
    test: 'Good example with emotional positioning + sensory grounding',
    expected: true,
    actual: goodResult.passed,
    details: goodResult.errors
  })
  
  // Test 2: Bad example - operational list (should fail)
  const badOperational = "Café, restaurant og bar ved åen i Aarhus — brunch og frokost om dagen og skifter til aftensmad og drinks om aftenen."
  const badResult = validateBrandEssenceQuality(badOperational)
  results.push({
    test: 'Bad example with operational pattern "om dagen...om aftenen"',
    expected: false,
    actual: badResult.passed,
    details: badResult.errors
  })
  
  // Test 3: Missing emotional hook (should fail)
  const noEmotion = "Café ved åen i Aarhus hvor brunch kan nydes."
  const noEmotionResult = validateBrandEssenceQuality(noEmotion)
  results.push({
    test: 'Missing emotional positioning',
    expected: false,
    actual: noEmotionResult.passed,
    details: noEmotionResult.errors
  })
  
  // Test 4: Unverified family claim (should fail)
  const invented = "Café ved åen — opskriften er 40 år gammel og fra min mormor."
  const inventedResult = validateBrandEssenceQuality(invented)
  results.push({
    test: 'Unverified family heritage claim',
    expected: false,
    actual: inventedResult.passed,
    details: inventedResult.errors
  })
  
  // Test 5: Empty string (should fail)
  const empty = ""
  const emptyResult = validateBrandEssenceQuality(empty)
  results.push({
    test: 'Empty string sanity check',
    expected: false,
    actual: emptyResult.passed,
    details: emptyResult.errors
  })
  
  const allCorrect = results.every(r => r.expected === r.actual)
  
  return {
    passed: allCorrect,
    results
  }
}
