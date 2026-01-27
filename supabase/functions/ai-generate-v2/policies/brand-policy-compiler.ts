// Brand Policy Compiler - Transform BusinessProfile into machine-usable constraints
import { BusinessProfile, MenuCatalog, BrandPolicy, VerifiedAnchor, VerifiedAnchors } from '../types.ts'
import { getLanguageConfig } from '../config/language-configs.ts'

/**
 * Compile BusinessProfile into BrandPolicy with explicit allowlists and constraints
 * 
 * This is the deterministic layer that prevents AI from:
 * - Inventing offerings ("cocktails" when not offered)
 * - Using unverified location claims ("ved åen" without evidence)
 * - Mixing daypart/category incorrectly
 */
export function compileBrandPolicy(
  profile: BusinessProfile,
  menuCatalog: MenuCatalog
): BrandPolicy {
  const threeTierOfferings = compileThreeTierOfferings(profile, menuCatalog)
  
  return {
    voice_rules: compileVoiceRules(profile),
    forbidden_terms: profile.forbidden_terms || [],
    offerings_allowlist: threeTierOfferings.exact.concat(threeTierOfferings.generic),  // Legacy support
    offerings: threeTierOfferings,  // New three-tier structure
    verified_anchors: extractVerifiedAnchors(profile),
    language: profile.primary_language,
    country: profile.country || 'Denmark'
  }
}

/**
 * Compile voice rules from brand_voice
 */
function compileVoiceRules(profile: BusinessProfile): BrandPolicy['voice_rules'] {
  return {
    tone: profile.brand_voice?.tone || [],
    essence: profile.brand_voice?.essence,
    style_notes: profile.brand_voice?.style_notes
  }
}

/**
 * Per-language forbidden term dictionaries
 * These are terms that commonly hallucinate when a generic category is allowed
 */
const FORBIDDEN_DICTIONARIES: Record<string, Record<string, string[]>> = {
  da: {
    // If 'drikkevarer' is allowed (generic), prevent these hallucinations (specific)
    drikkevarer: ['cocktails', 'vin', 'øl', 'champagne', 'drinks bar'],
    mad: ['sushi', 'pizza', 'pasta', 'burger', 'steak'],
    musik: ['livemusik', 'live musik', 'koncert', 'dj'],
    udsigt: ['rooftop', 'tag', 'taghave', 'panorama'],
    atmosfære: ['romantisk', 'intim', 'elegant', 'luksuriøs']
  },
  sv: {
    drycker: ['cocktails', 'vin', 'öl', 'champagne', 'drinks bar'],
    mat: ['sushi', 'pizza', 'pasta', 'burger', 'biff'],
    musik: ['livemusik', 'live musik', 'konsert', 'dj'],
    utsikt: ['rooftop', 'tak', 'takterrass', 'panorama'],
    atmosfär: ['romantisk', 'intim', 'elegant', 'lyxig']
  },
  de: {
    getränke: ['cocktails', 'wein', 'bier', 'champagner', 'drinks bar'],
    essen: ['sushi', 'pizza', 'pasta', 'burger', 'steak'],
    musik: ['livemusik', 'live musik', 'konzert', 'dj'],
    aussicht: ['rooftop', 'dach', 'dachgarten', 'panorama'],
    atmosphäre: ['romantisch', 'intim', 'elegant', 'luxuriös']
  }
}

/**
 * Compile three-tier offerings structure
 * 
 * Three tiers prevent hallucination scope creep:
 * - exact: Verified specific offerings (from menu items, business_offerings nouns)
 * - generic: Safe category terms that don't enable specific hallucinations
 * - forbidden: Common hallucinations to block (based on language + generic terms)
 * 
 * Example:
 * - exact: ["kaffe", "pariserbøf", "brunch"] (proven in menu)
 * - generic: ["mad", "drikkevarer"] (safe categories)
 * - forbidden: ["cocktails", "vin", "rooftop"] (hallucinations to block)
 * 
 * This prevents: adding "drikkevarer" (generic) shouldn't enable "cocktails" (forbidden)
 */
function compileThreeTierOfferings(
  profile: BusinessProfile,
  menuCatalog: MenuCatalog
): { exact: string[], generic: string[], forbidden: string[] } {
  const exact = new Set<string>()
  const generic = new Set<string>()
  const forbidden = new Set<string>()
  
  // Extract exact offerings from menu items
  for (const item of menuCatalog.items) {
    const itemName = item.name.toLowerCase().trim()
    if (itemName.length > 2) {  // Skip very short names
      exact.add(itemName)
    }
  }
  
  // Extract exact offerings from business_offerings (nouns only)
  if (profile.business_offerings) {
    const offerings = profile.business_offerings.toLowerCase()
    
    // Exact specific offerings (nouns with high confidence)
    const specificKeywords = [
      'kaffe', 'coffee', 'te', 'tea', 'espresso', 'cappuccino', 'latte',
      'brunch', 'frokost', 'lunch',
      'pariserbøf', 'smørrebrød', 'tartelet', 'flæskesteg',
      'kage', 'kager', 'croissant', 'bagel', 'sandwich',
      'salat', 'suppe', 'pasta', 'pizza', 'burger',
      'øl', 'beer', 'vin', 'wine', 'cocktail', 'cocktails'
    ]
    
    for (const keyword of specificKeywords) {
      if (offerings.includes(keyword)) {
        exact.add(keyword)
      }
    }
  }
  
  // Infer generic categories from menu structure
  const categories = new Set(menuCatalog.items.map(i => i.category.toLowerCase()))
  
  for (const category of categories) {
    if (category.includes('brunch')) generic.add('brunch')
    if (category.includes('frokost') || category.includes('lunch')) generic.add('frokost')
    if (category.includes('aften') || category.includes('dinner')) generic.add('aften')
    if (category.includes('drikke') || category.includes('drinks')) {
      generic.add('drikkevarer')
      generic.add('drinks')
    }
    if (category.includes('dessert')) generic.add('dessert')
  }
  
  // Always add safe generic terms
  generic.add('mad')
  generic.add('food')
  generic.add('menu')
  generic.add('ret')
  generic.add('retter')
  
  // Build forbidden list based on language + enabled generic terms
  const language = profile.primary_language || 'da'
  const langDict = FORBIDDEN_DICTIONARIES[language] || FORBIDDEN_DICTIONARIES['da']
  
  // For each generic category, add its hallucination risks to forbidden list
  // BUT: exclude items that are in the exact list (proven to exist)
  for (const genericTerm of generic) {
    const hallucinations = langDict[genericTerm] || []
    for (const hallucination of hallucinations) {
      // Only forbid if NOT in exact list
      if (!exact.has(hallucination)) {
        forbidden.add(hallucination)
      }
    }
  }
  
  // Always forbid common universal hallucinations (unless proven)
  const universalHallucinations = [
    'rooftop', 'livemusik', 'live musik', 'dj', 'koncert',
    'michelin', 'Michelin stjerne', 'award-winning',
    'berømt', 'famous', 'legendary', 'world-class',
    'taghave', 'tag terrasse', 'panorama udsigt'
  ]
  
  for (const term of universalHallucinations) {
    if (!exact.has(term.toLowerCase())) {
      forbidden.add(term.toLowerCase())
    }
  }
  
  return {
    exact: Array.from(exact),
    generic: Array.from(generic),
    forbidden: Array.from(forbidden)
  }
}

/**
 * @deprecated Use compileThreeTierOfferings instead
 * Kept for backwards compatibility
 */
function compileOfferingsAllowlist(
  profile: BusinessProfile,
  menuCatalog: MenuCatalog
): string[] {
  const allowlist = new Set<string>()
  
  // Extract from business_offerings
  if (profile.business_offerings) {
    const offerings = profile.business_offerings.toLowerCase()
    
    // Common food/drink keywords
    const keywords = [
      'kaffe', 'coffee', 'te', 'tea',
      'brunch', 'frokost', 'lunch', 'middag', 'dinner', 'aften',
      'morgenmad', 'breakfast',
      'kage', 'kager', 'cake', 'cakes', 'bagværk', 'pastries',
      'sandwich', 'sandwiches', 'salat', 'salad', 'suppe', 'soup',
      'pasta', 'pizza', 'burger', 'burgere',
      'vin', 'wine', 'øl', 'beer', 'cocktail', 'cocktails', 'drinks', 'drikkevarer',
      'dessert', 'desserts',
      'vegetar', 'vegetarian', 'vegan', 'vegansk',
      'økologisk', 'organic', 'lokal', 'local', 'sæson', 'seasonal'
    ]
    
    for (const keyword of keywords) {
      if (offerings.includes(keyword)) {
        allowlist.add(keyword)
      }
    }
  }
  
  // Extract from menu categories (map to generic terms)
  const categories = new Set(menuCatalog.items.map(i => i.category.toLowerCase()))
  
  for (const category of categories) {
    if (category.includes('brunch')) allowlist.add('brunch')
    if (category.includes('frokost') || category.includes('lunch')) allowlist.add('frokost')
    if (category.includes('aften') || category.includes('dinner')) allowlist.add('aften')
    if (category.includes('drikke') || category.includes('drinks')) {
      allowlist.add('drikkevarer')
      allowlist.add('drinks')
    }
    if (category.includes('vin') || category.includes('wine')) allowlist.add('vin')
    if (category.includes('øl') || category.includes('beer')) allowlist.add('øl')
    if (category.includes('cocktail')) allowlist.add('cocktails')
    if (category.includes('dessert')) allowlist.add('dessert')
    if (category.includes('kage') || category.includes('cake')) allowlist.add('kager')
  }
  
  // Always allow generic terms
  allowlist.add('mad')
  allowlist.add('food')
  allowlist.add('menu')
  allowlist.add('ret')
  allowlist.add('retter')
  allowlist.add('dish')
  allowlist.add('dishes')
  
  return Array.from(allowlist)
}

/**
 * Extract verified anchors with provenance tracking
 * 
 * NEW SYSTEM: Rejects generic phrases like "hyggelig atmosfære"
 * Only includes anchors with:
 * - Specific location references ("ved åen i Aarhus")
 * - Concrete interior details ("plads til 40 gæster", "rooftop terrasse")
 * - Verified experiences from reviews/photos
 * 
 * Generic phrases marked with source='generic' and should NOT be used
 * 
 * Example:
 * business_offerings: "Café ved åen i Aarhus med hyggelig atmosfære"
 * → location: [{ text: "ved åen i Aarhus", source: "user_input", confidence: "high" }]
 * → interior: [{ text: "hyggelig atmosfære", source: "generic", confidence: "low" }]  // DON'T USE
 */
function extractVerifiedAnchors(profile: BusinessProfile): VerifiedAnchors {
  const anchors: VerifiedAnchors = {
    location: [],
    interior: [],
    experience: []
  }
  
  const timestamp = new Date().toISOString()
  
  // Extract from location_enrichment (HIGHEST confidence)
  if (profile.location_enrichment) {
    // @ts-ignore - location_enrichment not in type yet
    if (profile.location_enrichment.description) {
      // @ts-ignore
      const description = profile.location_enrichment.description
      anchors.location.push({
        text: description,
        source: 'location_enrichment',
        confidence: 'high',
        category: 'location',
        metadata: {
          extracted_from: 'google_places',
          verified_at: timestamp,
          verified_by: 'enrichment'
        }
      })
    }
  }
  
  if (!profile.business_offerings) {
    return anchors
  }
  
  const text = profile.business_offerings.toLowerCase()
  const language = profile.primary_language || 'da'
  const languageConfig = getLanguageConfig(language)
  
  // LOCATION ANCHORS: Use language-specific patterns from configuration
  for (const patternConfig of languageConfig.anchorPatterns.location) {
    const matches = text.matchAll(patternConfig.pattern)
    for (const match of matches) {
      anchors.location.push({
        text: match[0],
        source: 'user_input',
        confidence: patternConfig.confidence,
        category: 'location',
        metadata: {
          extracted_from: 'business_offerings',
          verified_at: timestamp,
          verified_by: 'user',
          description: patternConfig.description
        }
      })
    }
  }
  
  // INTERIOR ANCHORS: Must be specific/measurable (NOT generic adjectives)
  // Interior patterns should be added to language configs if language-specific patterns are needed
  // Currently using generic patterns that work across all languages
  const specificInteriorPatterns: Array<{
    pattern: RegExp
    confidence: 'high' | 'medium'
    extract: (match: RegExpMatchArray) => string
  }> = [
    {
      pattern: /plads til \d+ gæster/gi,  // "plads til 40 gæster"
      confidence: 'high',
      extract: (m) => m[0]
    },
    {
      pattern: /\d+\s+(etage|etager|floors|gulve)/gi,  // "2 etager"
      confidence: 'high',
      extract: (m) => m[0]
    },
    {
      pattern: /(moderne|rustik|industriel|skandinavisk|nordisk)\s+(indretning|design|stil)/gi,
      confidence: 'medium',
      extract: (m) => m[0]
    },
    {
      pattern: /(rooftop|tag)\s+(terrasse|have|bar)/gi,  // "rooftop terrasse"
      confidence: 'high',
      extract: (m) => m[0]
    },
    {
      pattern: /(åben|open)\s+(køkken|kitchen)/gi,  // "åbent køkken"
      confidence: 'high',
      extract: (m) => m[0]
    }
  ]
  
  for (const { pattern, confidence, extract } of specificInteriorPatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      anchors.interior.push({
        text: extract(match),
        source: 'user_input',
        confidence,
        category: 'interior',
        metadata: {
          extracted_from: 'business_offerings',
          verified_at: timestamp,
          verified_by: 'user'
        }
      })
    }
  }
  
  // Generic interior adjectives: Mark as GENERIC (don't use)
  // Check against language-specific generic keywords
  for (const keyword of languageConfig.anchorPatterns.interior) {
    if (text.includes(keyword.toLowerCase())) {
      anchors.interior.push({
        text: keyword,
        source: 'generic',  // ⚠️ MARKED AS GENERIC - DON'T USE
        confidence: 'low',
        category: 'interior',
        metadata: {
          extracted_from: 'business_offerings',
          verified_at: timestamp,
          verified_by: 'system'
        }
      })
    }
  }
  
  // EXPERIENCE ANCHORS: Use language-specific patterns from configuration
  for (const patternConfig of languageConfig.anchorPatterns.experience) {
    const matches = text.matchAll(patternConfig.pattern)
    for (const match of matches) {
      anchors.experience.push({
        text: match[0],
        source: 'user_input',
        confidence: patternConfig.confidence,
        category: 'experience',
        metadata: {
          extracted_from: 'business_offerings',
          verified_at: timestamp,
          verified_by: 'user'
        }
      })
    }
  }
  
  return anchors
}

/**
 * Validate if a term is in the offerings allowlist
 * Now uses three-tier structure: exact + generic allowed, forbidden blocked
 */
export function isAllowedOffering(term: string, policy: BrandPolicy): boolean {
  const lowerTerm = term.toLowerCase()
  
  // Check if using new three-tier structure
  if (policy.offerings) {
    // First check if explicitly forbidden
    const isForbidden = policy.offerings.forbidden.some(forbidden =>
      lowerTerm.includes(forbidden) || forbidden.includes(lowerTerm)
    )
    
    if (isForbidden) return false
    
    // Then check if in exact or generic
    const isAllowed = 
      policy.offerings.exact.some(exact => 
        lowerTerm.includes(exact) || exact.includes(lowerTerm)
      ) ||
      policy.offerings.generic.some(generic =>
        lowerTerm.includes(generic) || generic.includes(lowerTerm)
      )
    
    return isAllowed
  }
  
  // Fallback to legacy allowlist
  return policy.offerings_allowlist.some(allowed => 
    lowerTerm.includes(allowed) || allowed.includes(lowerTerm)
  )
}

/**
 * Validate if an anchor is verified
 * NEW: Checks provenance - only high-confidence, non-generic anchors allowed
 */
export function isVerifiedAnchor(
  anchor: string,
  type: 'location' | 'interior' | 'experience',
  policy: BrandPolicy
): boolean {
  const anchors = policy.verified_anchors[type] || []
  const lowerAnchor = anchor.toLowerCase()
  
  // Check if any HIGH-CONFIDENCE, NON-GENERIC anchor matches
  return anchors.some(verified => {
    // Skip generic anchors
    if (verified.source === 'generic') return false
    
    // Skip low-confidence anchors
    if (verified.confidence === 'low') return false
    
    // Check if anchor text matches
    const lowerVerified = verified.text.toLowerCase()
    return lowerAnchor.includes(lowerVerified) || lowerVerified.includes(lowerAnchor)
  })
}

/**
 * Get usable anchors (filters out generic/low-confidence)
 * Helper for prompt building and validation
 */
export function getUsableAnchors(
  policy: BrandPolicy,
  type: 'location' | 'interior' | 'experience'
): string[] {
  const anchors = policy.verified_anchors[type] || []
  
  return anchors
    .filter(a => a.source !== 'generic' && a.confidence !== 'low')
    .map(a => a.text)
}

/**
 * Format BrandPolicy for prompt (human-readable constraints)
 * Now includes three-tier offerings structure and provenance-filtered anchors
 */
export function formatPolicyForPrompt(policy: BrandPolicy): string {
  const sections: string[] = []
  
  sections.push('=== BRAND POLICY (HARD CONSTRAINTS) ===')
  
  // Voice rules
  if (policy.voice_rules.tone.length > 0) {
    sections.push(`Tone: ${policy.voice_rules.tone.join(', ')}`)
  }
  if (policy.voice_rules.essence) {
    sections.push(`Essence: ${policy.voice_rules.essence}`)
  }
  
  // Forbidden terms
  if (policy.forbidden_terms.length > 0) {
    sections.push(`\nFORBIDDEN TERMS: ${policy.forbidden_terms.join(', ')}`)
  }
  
  // Three-tier offerings structure (if available)
  if (policy.offerings) {
    sections.push(`\n=== OFFERINGS STRUCTURE (3-TIER) ===`)
    
    sections.push(`\nEXACT OFFERINGS (verified - use freely):`)
    sections.push(`${policy.offerings.exact.slice(0, 20).join(', ')}${policy.offerings.exact.length > 20 ? '...' : ''}`)
    
    sections.push(`\nGENERIC CATEGORIES (safe general terms):`)
    sections.push(`${policy.offerings.generic.join(', ')}`)
    
    sections.push(`\nFORBIDDEN OFFERINGS (NEVER mention these):`)
    sections.push(`${policy.offerings.forbidden.join(', ')}`)
    
    sections.push(`\nRULE: Generic categories (e.g., "drikkevarer") do NOT enable forbidden specifics (e.g., "cocktails").`)
    sections.push(`Only mention offerings in EXACT list or use GENERIC terms. Never use FORBIDDEN terms.`)
  } else {
    // Legacy format
    sections.push(`\nALLOWED OFFERINGS (for non-menu posts):`)
    sections.push(`You may ONLY reference: ${policy.offerings_allowlist.join(', ')}`)
    sections.push(`Any other offering claims REQUIRE a specific menu item.`)
  }
  
  // Verified anchors (filter to usable only - no generics)
  const usableLocation = getUsableAnchors(policy, 'location')
  const usableInterior = getUsableAnchors(policy, 'interior')
  const usableExperience = getUsableAnchors(policy, 'experience')
  
  if (usableLocation.length > 0) {
    sections.push(`\nVERIFIED LOCATION (use ONLY these): ${usableLocation.join(', ')}`)
  }
  if (usableInterior.length > 0) {
    sections.push(`VERIFIED INTERIOR (use ONLY these): ${usableInterior.join(', ')}`)
  }
  if (usableExperience.length > 0) {
    sections.push(`VERIFIED EXPERIENCE (use ONLY these): ${usableExperience.join(', ')}`)
  }
  
  sections.push(`\nCRITICAL: Do NOT invent location/interior/experience claims not listed above.`)
  sections.push(`Do NOT use generic phrases like "hyggelig atmosfære" - use ONLY specific verified anchors.`)
  
  return sections.join('\n')
}