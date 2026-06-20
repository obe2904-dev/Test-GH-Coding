/**
 * Cultural Concepts Framework
 * 
 * Manages culturally-specific concepts that should NEVER be genericized or translated.
 * These concepts are deeply embedded in local culture and lose meaning when translated.
 * 
 * Examples:
 * - Danish "hygge" ≠ "cozy" (it's a cultural mindset)
 * - Swedish "fika" ≠ "coffee break" (it's a social ritual)
 * - Norwegian "kos" ≠ "hygge" (similar but distinct)
 * - German "Gemütlichkeit" ≠ "cozy" (different cultural context)
 * - Dutch "gezelligheid" ≠ "cozy" (unique social warmth)
 * 
 * Usage:
 * - detectCulturalConcepts(text, language): Find cultural concepts in business descriptions
 * - validateCulturalUsage(concept, context): Ensure concept is used authentically
 * - getBannedGenericTerms(language): Get terms that should be avoided/replaced
 * 
 * Content Generation Rules:
 * 1. NEVER translate cultural concepts to English intermediary
 * 2. NEVER use generic equivalents (hygge → cozy is forbidden)
 * 3. PRESERVE exact phrasing from business descriptions
 * 4. FLAG overused concepts (e.g., every Danish business claiming "hygge")
 */

export interface CulturalConcept {
  /**
   * Name of the cultural concept (lowercase, native language)
   */
  name: string
  
  /**
   * Countries/markets where this concept is culturally relevant
   * ISO 3166-1 alpha-2 codes (DK, SE, NO, DE, NL, etc.)
   */
  countries: string[]
  
  /**
   * Related programme types where concept commonly appears
   * E.g., "hygge" → often associated with dinner/bar programmes
   */
  programme_affinity?: string[]
  
  /**
   * Time context when concept is most relevant
   * E.g., "hygge" → autumn/winter, evening
   */
  seasonal_context?: {
    seasons?: ('spring' | 'summer' | 'autumn' | 'winter')[]
    time_of_day?: ('morning' | 'afternoon' | 'evening' | 'night')[]
  }
  
  /**
   * Keywords that signal this concept (native language)
   * Used for detection in business descriptions/menu items
   */
  keywords: Record<string, string[]>
  
  /**
   * Generic terms that should NEVER replace this concept
   * These are banned translations/equivalents
   */
  generic_banned_words: Record<string, string[]>
  
  /**
   * Authentic usage examples from real businesses
   * Use these as validation patterns
   */
  authentic_examples?: Record<string, string[]>
  
  /**
   * Overuse threshold - flag if >X% of businesses in area claim this concept
   * Prevents dilution of meaning (e.g., not every bar is "hyggeligt")
   */
  overuse_threshold?: number
}

/**
 * Registry of cultural concepts across all supported markets
 */
export const CULTURAL_CONCEPTS: CulturalConcept[] = [
  // ===== DANISH CULTURAL CONCEPTS =====
  {
    name: 'hygge',
    countries: ['DK'],
    programme_affinity: ['dinner', 'bar', 'afternoon_tea'],
    seasonal_context: {
      seasons: ['autumn', 'winter'],
      time_of_day: ['evening', 'night']
    },
    keywords: {
      da: [
        'hygge', 'hyggelig', 'hyggeligt', 'hyggelige',
        'hygge-atmosfære', 'hyggestund', 'hyggestemning',
        'lys', 'levende lys', 'stearinlys', 'kærtegn',
        'varmt', 'intimt', 'hjemligt'
      ]
    },
    generic_banned_words: {
      da: ['koselig', 'behageligt', 'rart', 'fint'],  // Don't replace hygge with generic Danish
      en: ['cozy', 'comfortable', 'nice', 'pleasant'],  // NEVER translate to English
      sv: ['mysigt', 'trevligt'],  // Not Swedish equivalent
      de: ['gemütlich', 'komfortabel'],  // Not German equivalent
      nl: ['gezellig', 'comfortabel']  // Not Dutch equivalent
    },
    authentic_examples: {
      da: [
        'hyggeligt samvær ved levende lys',
        'intim hygge-atmosfære med kerte lys',
        'varmt og hyggeligt lokale',
        'hyggelig stemning til middag'
      ]
    },
    overuse_threshold: 0.30  // Flag if >30% of businesses in area claim "hygge"
  },
  
  {
    name: 'smørrebrød',
    countries: ['DK'],
    programme_affinity: ['lunch'],
    keywords: {
      da: [
        'smørrebrød', 'åbne sandwich', 'klassisk dansk',
        'rugbrød', 'frikadeller', 'leverpostej', 'hønsesalat',
        'røget laks', 'sild', 'ål', 'rejer'
      ]
    },
    generic_banned_words: {
      da: ['sandwich', 'madpakke'],
      en: ['open sandwich', 'open-faced sandwich', 'toast'],
      sv: ['smörgås'],
      de: ['belegtes brot', 'sandwich'],
      nl: ['boterham', 'broodje']
    },
    authentic_examples: {
      da: [
        'traditionelt smørrebrød med hjemmelavede garniture',
        'klassisk dansk smørrebrød på rugbrød',
        '12 forskellige smørrebrød at vælge imellem'
      ]
    }
  },
  
  // ===== SWEDISH CULTURAL CONCEPTS =====
  {
    name: 'fika',
    countries: ['SE'],
    programme_affinity: ['fika'],  // Has its own programme type
    seasonal_context: {
      time_of_day: ['morning', 'afternoon']
    },
    keywords: {
      sv: [
        'fika', 'fikabröd', 'fikastund', 'fikarast',
        'kanelbulle', 'kardemummabulle', 'prinsesstårta',
        'chokladboll', 'semla', 'kaffe och bulle',
        'eftermiddagsfika', 'morgonfika'
      ]
    },
    generic_banned_words: {
      sv: ['kaffepaus', 'mellanmål', 'fördricks'],  // Generic Swedish
      en: ['coffee break', 'snack time', 'coffee and cake'],
      da: ['kaffepause', 'kaffe og kage'],
      de: ['Kaffeepause', 'Kaffee und Kuchen'],
      nl: ['koffiepauze', 'koffie en gebak']
    },
    authentic_examples: {
      sv: [
        'välkommen på fika med färska kanelbullar',
        'traditionell svensk fika med hemba kade bakverk',
        'fikastund på eftermiddagen med kaffe och bulle'
      ]
    },
    overuse_threshold: 0.40  // Fika is very common in Sweden, higher threshold
  },
  
  {
    name: 'lagom',
    countries: ['SE'],
    keywords: {
      sv: [
        'lagom', 'lagom mycket', 'lagom stor',
        'balans', 'måttfull', 'precis rätt',
        'varken för mycket eller för lite'
      ]
    },
    generic_banned_words: {
      sv: ['måttlig', 'balanserad', 'okej'],
      en: ['moderate', 'balanced', 'just right', 'perfect'],
      da: ['passende', 'tilpas'],
      de: ['mäßig', 'ausgewogen'],
      nl: ['gematigd', 'evenwichtig']
    },
    authentic_examples: {
      sv: [
        'lagom stora portioner',
        'en meny med lagom mycket av allt',
        'lagom avslappnad atmosfär'
      ]
    }
  },
  
  // ===== NORWEGIAN CULTURAL CONCEPTS =====
  {
    name: 'kos',
    countries: ['NO'],
    programme_affinity: ['dinner', 'bar'],
    seasonal_context: {
      seasons: ['autumn', 'winter'],
      time_of_day: ['evening', 'night']
    },
    keywords: {
      no: [
        'kos', 'koselig', 'koseligere', 'koseligste',
        'kos seg', 'kosemat', 'kosestund',
        'varmt', 'intimt', 'hjemmekoselig'
      ]
    },
    generic_banned_words: {
      no: ['hyggelig', 'trivelig', 'behagelig'],
      en: ['cozy', 'comfortable', 'nice'],
      da: ['hyggeligt', 'rart'],
      sv: ['mysigt', 'trevligt'],
      de: ['gemütlich', 'komfortabel'],
      nl: ['gezellig', 'comfortabel']
    },
    authentic_examples: {
      no: [
        'koselig atmosfære med levende lys',
        'kos deg med god mat og drikke',
        'perfekt for en koselig kveld'
      ]
    },
    overuse_threshold: 0.35
  },
  
  // ===== GERMAN CULTURAL CONCEPTS =====
  {
    name: 'gemütlichkeit',
    countries: ['DE'],
    programme_affinity: ['dinner', 'bar'],
    seasonal_context: {
      seasons: ['autumn', 'winter'],
      time_of_day: ['evening', 'night']
    },
    keywords: {
      de: [
        'Gemütlichkeit', 'gemütlich', 'gemütlicher',
        'heimelig', 'behaglich', 'Behaglichkeit',
        'warm', 'einladend', 'familiär'
      ]
    },
    generic_banned_words: {
      de: ['komfortabel', 'angenehm', 'nett'],
      en: ['cozy', 'comfortable', 'homey'],
      da: ['hyggeligt', 'behageligt'],
      sv: ['mysigt', 'bekvämt'],
      nl: ['gezellig', 'comfortabel']
    },
    authentic_examples: {
      de: [
        'gemütliche Atmosphäre mit Kerzenlicht',
        'Gemütlichkeit im Herzen der Altstadt',
        'ein gemütlicher Abend bei gutem Essen'
      ]
    },
    overuse_threshold: 0.30
  },
  
  {
    name: 'frühschoppen',
    countries: ['DE'],
    programme_affinity: ['morning', 'lunch'],
    seasonal_context: {
      time_of_day: ['morning']
    },
    keywords: {
      de: [
        'Frühschoppen', 'Sonntagsfrühschoppen',
        'Weißwurst', 'Weißwurst-Frühstück',
        'Brezn', 'Weißbier am Vormittag'
      ]
    },
    generic_banned_words: {
      de: ['Morgengetränk', 'Frühstücksbier'],
      en: ['morning drinks', 'brunch drinks'],
      da: ['morgen drikkevarer'],
      sv: ['morgondryck'],
      nl: ['ochtenddrankje']
    },
    authentic_examples: {
      de: [
        'traditioneller Frühschoppen mit Weißwurst',
        'Sonntagsfrühschoppen ab 10 Uhr',
        'Frühschoppen mit Weißbier und Brezn'
      ]
    }
  },
  
  // ===== DUTCH CULTURAL CONCEPTS =====
  {
    name: 'gezelligheid',
    countries: ['NL'],
    programme_affinity: ['dinner', 'bar'],
    seasonal_context: {
      time_of_day: ['evening', 'night']
    },
    keywords: {
      nl: [
        'gezelligheid', 'gezellig', 'gezelliger', 'gezelligste',
        'gezellige sfeer', 'gezellig samen',
        'warm', 'intiem', 'huiselijk'
      ]
    },
    generic_banned_words: {
      nl: ['knus', 'aangenaam', 'prettig'],
      en: ['cozy', 'comfortable', 'nice', 'sociable'],
      da: ['hyggeligt', 'behageligt'],
      sv: ['mysigt', 'trevligt'],
      de: ['gemütlich', 'komfortabel']
    },
    authentic_examples: {
      nl: [
        'gezellige atmosfeer met kaarslicht',
        'samen genieten in een gezellige sfeer',
        'een gezellige avond vol smaak'
      ]
    },
    overuse_threshold: 0.35
  },
  
  {
    name: 'borrel',
    countries: ['NL'],
    programme_affinity: ['bar'],
    seasonal_context: {
      time_of_day: ['afternoon', 'evening']
    },
    keywords: {
      nl: [
        'borrel', 'borrelplank', 'borrelhapjes',
        'borrel en bites', 'vrijmibo', 'vrijdagmiddagborrel',
        'bittergarnituur', 'bitterballen'
      ]
    },
    generic_banned_words: {
      nl: ['drankjes', 'hapjes', 'snacks'],
      en: ['drinks', 'appetizers', 'happy hour'],
      da: ['drinks og snacks'],
      sv: ['drinkar och snacks'],
      de: ['Getränke und Snacks']
    },
    authentic_examples: {
      nl: [
        'uitgebreide borrelkaart met bitterballen',
        'vrijdagmiddagborrel met collega\'s',
        'borrel en bites in gezellige sfeer'
      ]
    }
  }
]

/**
 * Detect cultural concepts in text
 * Returns array of detected concepts with confidence scores
 */
export function detectCulturalConcepts(
  text: string,
  language: string = 'da'
): Array<{ concept: CulturalConcept; confidence: number; matches: string[] }> {
  if (!text) return []
  
  const textLower = text.toLowerCase()
  const results: Array<{ concept: CulturalConcept; confidence: number; matches: string[] }> = []
  
  for (const concept of CULTURAL_CONCEPTS) {
    const keywords = concept.keywords[language]
    if (!keywords) continue
    
    const matches = keywords.filter(keyword =>
      textLower.includes(keyword.toLowerCase())
    )
    
    if (matches.length > 0) {
      // Higher confidence for exact concept name match
      const hasExactMatch = matches.includes(concept.name)
      const confidence = hasExactMatch 
        ? Math.min(0.8 + (matches.length * 0.05), 1.0)
        : Math.min(0.5 + (matches.length * 0.1), 0.9)
      
      results.push({
        concept,
        confidence,
        matches
      })
    }
  }
  
  return results.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Check if text uses banned generic terms that should be replaced with cultural concepts
 * Returns array of violations with suggested replacements
 */
export function detectBannedGenericTerms(
  text: string,
  language: string = 'da'
): Array<{ 
  bannedTerm: string; 
  suggestedConcept: CulturalConcept; 
  context: string 
}> {
  if (!text) return []
  
  const textLower = text.toLowerCase()
  const violations: Array<{ 
    bannedTerm: string; 
    suggestedConcept: CulturalConcept; 
    context: string 
  }> = []
  
  for (const concept of CULTURAL_CONCEPTS) {
    const bannedTerms = concept.generic_banned_words[language]
    if (!bannedTerms) continue
    
    for (const bannedTerm of bannedTerms) {
      if (textLower.includes(bannedTerm.toLowerCase())) {
        violations.push({
          bannedTerm,
          suggestedConcept: concept,
          context: `Consider using "${concept.name}" instead of generic "${bannedTerm}"`
        })
      }
    }
  }
  
  return violations
}

/**
 * Get cultural concepts relevant to specific country
 */
export function getConceptsByCountry(countryCode: string): CulturalConcept[] {
  return CULTURAL_CONCEPTS.filter(concept =>
    concept.countries.includes(countryCode.toUpperCase())
  )
}

/**
 * Get cultural concepts relevant to specific programme type
 */
export function getConceptsByProgramme(programmeType: string): CulturalConcept[] {
  return CULTURAL_CONCEPTS.filter(concept =>
    concept.programme_affinity?.includes(programmeType)
  )
}

/**
 * Validate if cultural concept usage is authentic
 * Returns true if concept is used appropriately (not overused/misused)
 */
export function validateCulturalUsage(
  conceptName: string,
  businessContext: {
    category?: string
    programme_types?: string[]
    neighborhood?: string
    area_businesses_using_concept?: number
    area_total_businesses?: number
  }
): {
  isValid: boolean
  warnings: string[]
} {
  const concept = CULTURAL_CONCEPTS.find(c => c.name === conceptName)
  if (!concept) {
    return {
      isValid: false,
      warnings: [`Unknown cultural concept: ${conceptName}`]
    }
  }
  
  const warnings: string[] = []
  
  // Check overuse in area
  if (
    concept.overuse_threshold &&
    businessContext.area_businesses_using_concept !== undefined &&
    businessContext.area_total_businesses !== undefined &&
    businessContext.area_total_businesses > 0
  ) {
    const usageRate = businessContext.area_businesses_using_concept / businessContext.area_total_businesses
    if (usageRate > concept.overuse_threshold) {
      warnings.push(
        `Concept "${conceptName}" is overused in area (${(usageRate * 100).toFixed(1)}% vs ${(concept.overuse_threshold * 100)}% threshold). ` +
        `Consider using more specific/unique language.`
      )
    }
  }
  
  // Check programme affinity
  if (
    concept.programme_affinity && 
    businessContext.programme_types &&
    businessContext.programme_types.length > 0
  ) {
    const hasRelevantProgramme = businessContext.programme_types.some(pt =>
      concept.programme_affinity!.includes(pt)
    )
    
    if (!hasRelevantProgramme) {
      warnings.push(
        `Concept "${conceptName}" is typically associated with ${concept.programme_affinity.join(', ')} programmes, ` +
        `but business has ${businessContext.programme_types.join(', ')}`
      )
    }
  }
  
  return {
    isValid: warnings.length === 0,
    warnings
  }
}
