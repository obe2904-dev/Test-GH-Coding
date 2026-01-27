/**
 * Language Configuration System
 * 
 * Centralizes all language-specific data for the AI generation system:
 * - Forbidden tokens/phrases for language validation
 * - Fallback templates for graceful degradation
 * - Anchor extraction patterns for provenance tracking
 * - Language guidance for GPT-4o prompts
 * - Cultural norms (formality, emoji usage, etc.)
 * 
 * To add a new language:
 * 1. Create a LanguageConfig object with all required fields
 * 2. Add it to LANGUAGE_CONFIGS registry
 * 3. Test with native speaker review
 */

export interface LanguageConfig {
  // Basic info
  code: string  // ISO 639-1 code (da, sv, de, fr, es, etc.)
  name: string  // Display name (Danish, Swedish, German, etc.)
  
  // Language validator config
  forbiddenTokens: string[]  // English words that shouldn't appear
  forbiddenPhrases: Array<{
    en: string       // English phrase to detect
    local: string    // Correct local translation
  }>
  
  // Fallback template config
  templates: {
    menu_spotlight: {
      caption: (item: string, anchor: string, reasoning?: string) => string
      hookSuffix: string  // Additional text after menu item name in hook
    }
    vibe_reminder: {
      caption: (anchor: string, businessName: string) => string
      defaultAnchor: string  // Fallback if no verified anchors
    }
    occasion_prompt: {
      caption: (occasion: string, cta: string, businessName: string) => string
      hookPhrases: Record<string, string>  // breakfast, lunch, dinner, lateNight, default
      ctaPhrases: Record<string, string>   // book, visit, menu, engage
    }
  }
  
  // Anchor extraction patterns
  anchorPatterns: {
    location: Array<{
      pattern: RegExp
      confidence: 'high' | 'medium'
      description?: string  // For documentation
    }>
    interior: string[]  // Generic keywords to mark as generic/low-confidence
    experience: Array<{
      pattern: RegExp
      confidence: 'high' | 'medium'
      description?: string
    }>
  }
  
  // Prompt guidance for GPT-4o
  languageGuidance: string  // Multi-line instruction block
  commonMistakes: Array<{
    wrong: string    // Incorrect phrase
    correct: string  // Correct translation
  }>
  
  // Cultural norms
  formality: 'formal' | 'informal' | 'mixed'
  emojiUsage: 'minimal' | 'moderate' | 'frequent'
  exclamationLimit: number
  culturalConcept?: string  // e.g., "hygge", "lagom", "Gemütlichkeit"
}

/**
 * Danish Language Configuration
 */
const DANISH_CONFIG: LanguageConfig = {
  code: 'da',
  name: 'Danish',
  
  forbiddenTokens: [
    // Articles & prepositions
    'the', 'by', 'at', 'in', 'on', 'with', 'for', 'to', 'and', 'or',
    
    // Verbs
    'come', 'try', 'visit', 'enjoy', 'perfect', 'amazing', 'best',
    'join', 'discover', 'explore', 'taste', 'savor', 'experience',
    'reserve', 'book', 'order', 'get', 'make', 'have', 'take',
    
    // Pronouns & possessives
    'our', 'your', 'we', 'us', 'you', 'my', 'their',
    
    // Food & restaurant terms
    'food', 'drink', 'menu', 'restaurant', 'cafe', 'coffee',
    'dish', 'meal', 'lunch', 'dinner', 'breakfast', 'brunch',
    'fresh', 'delicious', 'tasty', 'yummy',
    
    // Common adjectives
    'good', 'great', 'nice', 'cozy', 'warm', 'beautiful',
    'lovely', 'perfect', 'wonderful', 'excellent',
    
    // Location terms
    'near', 'next', 'close', 'location', 'place', 'spot',
    
    // Action words
    'see', 'look', 'check', 'find', 'stop',
    
    // Time words
    'today', 'tonight', 'now', 'soon', 'later'
  ],
  
  forbiddenPhrases: [
    { en: 'by the water', local: 'ved vandet' },
    { en: 'by the river', local: 'ved åen' },
    { en: 'in the heart of', local: 'i hjertet af' },
    { en: 'come in', local: 'kom ind' },
    { en: 'try our', local: 'prøv vores' },
    { en: 'perfect for', local: 'perfekt til' },
    { en: 'join us', local: 'kom til os' },
    { en: 'visit us', local: 'besøg os' },
    { en: 'see you', local: 'vi ses' },
    { en: 'book now', local: 'book nu' },
    { en: 'reserve your table', local: 'reservér dit bord' }
  ],
  
  templates: {
    menu_spotlight: {
      caption: (item: string, anchor: string, reasoning?: string) => {
        let text = `Prøv vores ${item}.`
        if (anchor) text += ` ${anchor}.`
        if (reasoning) text += ` ${reasoning}`
        return text
      },
      hookSuffix: ''
    },
    vibe_reminder: {
      caption: (anchor: string, businessName: string) => 
        `${anchor}. Kom ind og oplev ${businessName}.`,
      defaultAnchor: 'Kom ind og oplev os'
    },
    occasion_prompt: {
      caption: (occasion: string, cta: string, businessName: string) =>
        `${occasion}. ${cta} hos ${businessName}.`,
      hookPhrases: {
        breakfast: 'Start dagen rigtigt',
        lunch: 'Tid til frokost?',
        dinner: 'Aftensmad i aften?',
        lateNight: 'Sen aften?',
        default: 'Tid til en pause?'
      },
      ctaPhrases: {
        book: 'Book dit bord',
        visit: 'Kom forbi',
        menu: 'Se hvad vi har',
        engage: 'Fortæl os hvad du synes'
      }
    }
  },
  
  anchorPatterns: {
    location: [
      { 
        pattern: /ved (åen|vandet|havet|søen)\s+i\s+(\w+)/gi, 
        confidence: 'high',
        description: 'Water feature with city (e.g., "ved åen i Aarhus")'
      },
      { 
        pattern: /(i hjertet af|midt i)\s+(\w+)/gi, 
        confidence: 'high',
        description: 'City center location (e.g., "i hjertet af København")'
      },
      { 
        pattern: /ved (åen|vandet|havet|søen)/gi, 
        confidence: 'medium',
        description: 'Water feature without city (e.g., "ved åen")'
      },
      { 
        pattern: /tæt på (\w+)/gi, 
        confidence: 'medium',
        description: 'Near landmark (e.g., "tæt på centrum")'
      }
    ],
    interior: [
      'hyggelig', 'cozy', 'nice', 'atmosfære', 'atmosphere',
      'god', 'dejlig', 'varm', 'warm'  // Too generic adjectives
    ],
    experience: [
      { 
        pattern: /(perfekt|ideel) til (brunch|frokost|middag)/gi, 
        confidence: 'high',
        description: 'Perfect for meal occasion'
      },
      { 
        pattern: /familievenlig/gi, 
        confidence: 'high',
        description: 'Family-friendly'
      },
      { 
        pattern: /(romantisk|intimate)\s+(middag|aften)/gi, 
        confidence: 'medium',
        description: 'Romantic setting'
      }
    ]
  },
  
  languageGuidance: `⚠️ ABSOLUTE REQUIREMENT: ALL OUTPUT MUST BE 100% DANISH
- NO English words except proper nouns (business names, brands)
- NO English phrases like "by the water", "come in", "try our"
- USE ONLY Danish: "ved vandet", "kom ind", "prøv vores"
- IF UNCERTAIN: Use simpler Danish rather than English
- THIS IS NON-NEGOTIABLE - English output is INVALID

Common mistakes to avoid:
❌ "by the water" → ✅ "ved vandet" or "ved åen"
❌ "in the heart of" → ✅ "i hjertet af"
❌ "come in" → ✅ "kom ind"
❌ "try our" → ✅ "prøv vores"
❌ "perfect for" → ✅ "perfekt til"
❌ "join us" → ✅ "kom til os"`,
  
  commonMistakes: [
    { wrong: 'by the water', correct: 'ved vandet' },
    { wrong: 'come in', correct: 'kom ind' },
    { wrong: 'try our', correct: 'prøv vores' },
    { wrong: 'perfect for', correct: 'perfekt til' },
    { wrong: 'in the heart of', correct: 'i hjertet af' }
  ],
  
  formality: 'informal',
  emojiUsage: 'moderate',
  exclamationLimit: 1,
  culturalConcept: 'hygge'
}

/**
 * Swedish Language Configuration
 */
const SWEDISH_CONFIG: LanguageConfig = {
  code: 'sv',
  name: 'Swedish',
  
  forbiddenTokens: [
    // Same English words as Danish (Swedish also should avoid English)
    'the', 'by', 'at', 'in', 'on', 'with', 'for', 'to', 'and', 'or',
    'come', 'try', 'visit', 'enjoy', 'perfect', 'amazing', 'best',
    'join', 'discover', 'explore', 'taste', 'savor', 'experience',
    'reserve', 'book', 'order', 'get', 'make', 'have', 'take',
    'our', 'your', 'we', 'us', 'you', 'my', 'their',
    'food', 'drink', 'menu', 'restaurant', 'cafe', 'coffee',
    'dish', 'meal', 'lunch', 'dinner', 'breakfast', 'brunch',
    'fresh', 'delicious', 'tasty', 'yummy',
    'good', 'great', 'nice', 'cozy', 'warm', 'beautiful',
    'lovely', 'perfect', 'wonderful', 'excellent',
    'near', 'next', 'close', 'location', 'place', 'spot',
    'see', 'look', 'check', 'find', 'stop',
    'today', 'tonight', 'now', 'soon', 'later'
  ],
  
  forbiddenPhrases: [
    { en: 'by the water', local: 'vid vattnet' },
    { en: 'by the river', local: 'vid ån' },
    { en: 'in the heart of', local: 'i hjärtat av' },
    { en: 'come in', local: 'kom in' },
    { en: 'try our', local: 'prova vår' },
    { en: 'perfect for', local: 'perfekt för' },
    { en: 'join us', local: 'kom till oss' },
    { en: 'visit us', local: 'besök oss' },
    { en: 'see you', local: 'vi ses' },
    { en: 'book now', local: 'boka nu' },
    { en: 'reserve your table', local: 'boka ditt bord' }
  ],
  
  templates: {
    menu_spotlight: {
      caption: (item: string, anchor: string, reasoning?: string) => {
        let text = `Prova vår ${item}.`
        if (anchor) text += ` ${anchor}.`
        if (reasoning) text += ` ${reasoning}`
        return text
      },
      hookSuffix: ''
    },
    vibe_reminder: {
      caption: (anchor: string, businessName: string) => 
        `${anchor}. Kom in och upplev ${businessName}.`,
      defaultAnchor: 'Kom in och upplev oss'
    },
    occasion_prompt: {
      caption: (occasion: string, cta: string, businessName: string) =>
        `${occasion}. ${cta} hos ${businessName}.`,
      hookPhrases: {
        breakfast: 'Börja dagen rätt',
        lunch: 'Dags för lunch?',
        dinner: 'Middag ikväll?',
        lateNight: 'Sen kväll?',
        default: 'Dags för en paus?'
      },
      ctaPhrases: {
        book: 'Boka ditt bord',
        visit: 'Kom in',
        menu: 'Se vad vi har',
        engage: 'Berätta vad du tycker'
      }
    }
  },
  
  anchorPatterns: {
    location: [
      { 
        pattern: /vid (ån|vattnet|havet|sjön)\s+i\s+(\w+)/gi, 
        confidence: 'high',
        description: 'Water feature with city (e.g., "vid ån i Stockholm")'
      },
      { 
        pattern: /(i hjärtat av|mitt i)\s+(\w+)/gi, 
        confidence: 'high',
        description: 'City center location'
      },
      { 
        pattern: /vid (ån|vattnet|havet|sjön)/gi, 
        confidence: 'medium',
        description: 'Water feature without city'
      }
    ],
    interior: [
      'mysig', 'trevlig', 'cozy', 'nice', 'atmosfär', 'atmosphere',
      'bra', 'varm', 'warm'  // Too generic
    ],
    experience: [
      { 
        pattern: /(perfekt|idealiskt) för (brunch|lunch|middag)/gi, 
        confidence: 'high',
        description: 'Perfect for meal'
      },
      { 
        pattern: /barnvänlig/gi, 
        confidence: 'high',
        description: 'Family-friendly'
      }
    ]
  },
  
  languageGuidance: `⚠️ ABSOLUT KRAV: ALL OUTPUT MÅSTE VARA 100% SVENSKA
- INGA engelska ord förutom egennamn (företagsnamn, varumärken)
- INGA engelska fraser som "by the water", "come in", "try our"
- ANVÄND ENDAST svenska: "vid vattnet", "kom in", "prova vår"
- OM OSÄKER: Använd enklare svenska istället för engelska
- DETTA ÄR INTE FÖRHANDLINGSBART - Engelsk output är OGILTIG

Vanliga misstag att undvika:
❌ "by the water" → ✅ "vid vattnet" eller "vid ån"
❌ "in the heart of" → ✅ "i hjärtat av"
❌ "come in" → ✅ "kom in"
❌ "try our" → ✅ "prova vår"`,
  
  commonMistakes: [
    { wrong: 'by the water', correct: 'vid vattnet' },
    { wrong: 'come in', correct: 'kom in' },
    { wrong: 'try our', correct: 'prova vår' },
    { wrong: 'perfect for', correct: 'perfekt för' }
  ],
  
  formality: 'informal',
  emojiUsage: 'minimal',
  exclamationLimit: 1,
  culturalConcept: 'lagom'
}

/**
 * German Language Configuration
 */
const GERMAN_CONFIG: LanguageConfig = {
  code: 'de',
  name: 'German',
  
  forbiddenTokens: [
    'the', 'by', 'at', 'in', 'on', 'with', 'for', 'to', 'and', 'or',
    'come', 'try', 'visit', 'enjoy', 'perfect', 'amazing', 'best',
    'join', 'discover', 'explore', 'taste', 'savor', 'experience',
    'reserve', 'book', 'order', 'get', 'make', 'have', 'take',
    'our', 'your', 'we', 'us', 'you', 'my', 'their',
    'food', 'drink', 'menu', 'restaurant', 'cafe', 'coffee',
    'dish', 'meal', 'lunch', 'dinner', 'breakfast', 'brunch',
    'fresh', 'delicious', 'tasty', 'yummy',
    'good', 'great', 'nice', 'cozy', 'warm', 'beautiful',
    'lovely', 'perfect', 'wonderful', 'excellent',
    'near', 'next', 'close', 'location', 'place', 'spot',
    'see', 'look', 'check', 'find', 'stop',
    'today', 'tonight', 'now', 'soon', 'later'
  ],
  
  forbiddenPhrases: [
    { en: 'by the water', local: 'am Wasser' },
    { en: 'by the river', local: 'am Fluss' },
    { en: 'in the heart of', local: 'im Herzen von' },
    { en: 'come in', local: 'kommen Sie herein' },
    { en: 'try our', local: 'probieren Sie unsere' },
    { en: 'perfect for', local: 'perfekt für' },
    { en: 'join us', local: 'besuchen Sie uns' },
    { en: 'visit us', local: 'besuchen Sie uns' },
    { en: 'see you', local: 'bis bald' },
    { en: 'book now', local: 'jetzt buchen' },
    { en: 'reserve your table', local: 'reservieren Sie Ihren Tisch' }
  ],
  
  templates: {
    menu_spotlight: {
      caption: (item: string, anchor: string, reasoning?: string) => {
        let text = `Probieren Sie unsere ${item}.`
        if (anchor) text += ` ${anchor}.`
        if (reasoning) text += ` ${reasoning}`
        return text
      },
      hookSuffix: ''
    },
    vibe_reminder: {
      caption: (anchor: string, businessName: string) => 
        `${anchor}. Besuchen Sie ${businessName}.`,
      defaultAnchor: 'Besuchen Sie uns'
    },
    occasion_prompt: {
      caption: (occasion: string, cta: string, businessName: string) =>
        `${occasion}. ${cta} bei ${businessName}.`,
      hookPhrases: {
        breakfast: 'Starten Sie den Tag richtig',
        lunch: 'Zeit für Mittagessen?',
        dinner: 'Abendessen heute Abend?',
        lateNight: 'Später Abend?',
        default: 'Zeit für eine Pause?'
      },
      ctaPhrases: {
        book: 'Jetzt buchen',
        visit: 'Besuchen Sie uns',
        menu: 'Sehen Sie unsere Speisekarte',
        engage: 'Sagen Sie uns Ihre Meinung'
      }
    }
  },
  
  anchorPatterns: {
    location: [
      { 
        pattern: /am (Wasser|Fluss|See|Meer)\s+in\s+(\w+)/gi, 
        confidence: 'high',
        description: 'Water feature with city'
      },
      { 
        pattern: /(im Herzen von|mitten in)\s+(\w+)/gi, 
        confidence: 'high',
        description: 'City center location'
      },
      { 
        pattern: /am (Wasser|Fluss|See|Meer)/gi, 
        confidence: 'medium',
        description: 'Water feature without city'
      }
    ],
    interior: [
      'gemütlich', 'schön', 'cozy', 'nice', 'Atmosphäre', 'atmosphere',
      'gut', 'warm'  // Too generic
    ],
    experience: [
      { 
        pattern: /(perfekt|ideal) für (Frühstück|Mittagessen|Abendessen)/gi, 
        confidence: 'high',
        description: 'Perfect for meal'
      },
      { 
        pattern: /familienfreundlich/gi, 
        confidence: 'high',
        description: 'Family-friendly'
      }
    ]
  },
  
  languageGuidance: `⚠️ ABSOLUTE ANFORDERUNG: ALLE AUSGABEN MÜSSEN 100% DEUTSCH SEIN
- KEINE englischen Wörter außer Eigennamen (Firmennamen, Marken)
- KEINE englischen Phrasen wie "by the water", "come in", "try our"
- VERWENDEN SIE NUR Deutsch: "am Wasser", "kommen Sie herein", "probieren Sie unsere"
- BEI UNSICHERHEIT: Verwenden Sie einfacheres Deutsch statt Englisch
- DIES IST NICHT VERHANDELBAR - Englische Ausgabe ist UNGÜLTIG

Häufige Fehler zu vermeiden:
❌ "by the water" → ✅ "am Wasser"
❌ "in the heart of" → ✅ "im Herzen von"
❌ "come in" → ✅ "kommen Sie herein"
❌ "try our" → ✅ "probieren Sie unsere"`,
  
  commonMistakes: [
    { wrong: 'by the water', correct: 'am Wasser' },
    { wrong: 'come in', correct: 'kommen Sie herein' },
    { wrong: 'try our', correct: 'probieren Sie unsere' },
    { wrong: 'perfect for', correct: 'perfekt für' }
  ],
  
  formality: 'mixed',
  emojiUsage: 'minimal',
  exclamationLimit: 1,
  culturalConcept: 'Gemütlichkeit'
}

/**
 * Language Configuration Registry
 * Add new languages here as they are implemented
 */
export const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  da: DANISH_CONFIG,
  sv: SWEDISH_CONFIG,
  de: GERMAN_CONFIG,
  // Future languages:
  // fr: FRENCH_CONFIG,
  // es: SPANISH_CONFIG,
  // no: NORWEGIAN_CONFIG,
  // it: ITALIAN_CONFIG,
}

/**
 * Get language configuration with fallback to Danish
 * 
 * @param code - ISO 639-1 language code (da, sv, de, etc.)
 * @returns Language configuration object
 */
export function getLanguageConfig(code: string): LanguageConfig {
  const config = LANGUAGE_CONFIGS[code]
  
  if (!config) {
    console.warn(`⚠️ Language config not found for '${code}', falling back to Danish`)
    return LANGUAGE_CONFIGS['da']
  }
  
  return config
}

/**
 * Check if a language is supported
 * 
 * @param code - ISO 639-1 language code
 * @returns True if language has a configuration
 */
export function isLanguageSupported(code: string): boolean {
  return code in LANGUAGE_CONFIGS
}

/**
 * Get list of all supported language codes
 * 
 * @returns Array of supported language codes
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_CONFIGS)
}

/**
 * Get list of all supported language names
 * 
 * @returns Array of supported language display names
 */
export function getSupportedLanguageNames(): string[] {
  return Object.values(LANGUAGE_CONFIGS).map(config => config.name)
}
