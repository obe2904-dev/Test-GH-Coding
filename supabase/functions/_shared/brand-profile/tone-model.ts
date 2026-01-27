/**
 * Tone Model v2 Sanitizer
 * 
 * Ensures tone_model objects are DB-safe before insertion.
 * Either returns a fully normalized object matching DB constraints,
 * or returns null if the input cannot be safely normalized.
 * 
 * DB Constraint: business_brand_profile.tone_model_valid_structure_v2
 */

export interface ToneModelV2 {
  primary_keywords: string[]    // 2-6 items
  writing_rules: string[]       // 3-8 items
  good_examples: string[]       // 2-6 items
  avoid_examples: string[]      // 2-6 items
  formality: 'formal' | 'informal' | 'mixed'
  emoji_level: 'none' | 'minimal' | 'moderate' | 'frequent'
  version: '2.0'
  language: string              // ISO 639-1 code
  generated_at: string          // ISO 8601 timestamp
  source: 'website' | 'manual' | 'hybrid'
  confidence: 'high' | 'medium' | 'low'
  notes?: string                // Optional, max 500 chars
}

/**
 * Sanitizes and normalizes a tone_model object for DB insertion.
 * 
 * @param input - Raw tone_model from AI or fallback
 * @param languageCode - Fallback language code (e.g., 'da', 'en')
 * @returns Normalized ToneModelV2 object or null if invalid
 */
export function sanitizeToneModelForDb(
  input: any,
  languageCode: string
): ToneModelV2 | null {
  // If input is null, undefined, or not an object, return null
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }

  try {
    // Helper: Ensure array of strings with min/max length
    const normalizeStringArray = (
      arr: any,
      minLength: number,
      maxLength: number
    ): string[] | null => {
      if (!Array.isArray(arr)) return null
      
      const filtered = arr
        .filter(item => typeof item === 'string' && item.trim().length > 0)
        .map(item => item.trim())
        .slice(0, maxLength) // Cap at max
      
      return filtered.length >= minLength ? filtered : null
    }

    // Normalize arrays
    const primary_keywords = normalizeStringArray(input.primary_keywords, 2, 6)
    const writing_rules = normalizeStringArray(input.writing_rules, 3, 8)
    const good_examples = normalizeStringArray(input.good_examples, 2, 6)
    const avoid_examples = normalizeStringArray(input.avoid_examples, 2, 6)

    // If any required array is invalid, return null
    if (!primary_keywords || !writing_rules || !good_examples || !avoid_examples) {
      return null
    }

    // Normalize formality
    const validFormality = ['formal', 'informal', 'mixed']
    const formality = validFormality.includes(input.formality)
      ? input.formality
      : 'informal'

    // Normalize emoji_level
    const validEmojiLevel = ['none', 'minimal', 'moderate', 'frequent']
    const emoji_level = validEmojiLevel.includes(input.emoji_level)
      ? input.emoji_level
      : 'minimal'

    // Normalize source
    const validSource = ['website', 'manual', 'hybrid']
    const source = validSource.includes(input.source)
      ? input.source
      : 'website'

    // Normalize confidence
    const validConfidence = ['high', 'medium', 'low']
    const confidence = validConfidence.includes(input.confidence)
      ? input.confidence
      : 'low'

    // Normalize language (ensure short code)
    let language = typeof input.language === 'string' 
      ? input.language.trim().toLowerCase().slice(0, 10)
      : languageCode.toLowerCase().slice(0, 2)
    
    if (!language || language.length < 2) {
      language = languageCode.toLowerCase().slice(0, 2) || 'da'
    }

    // Normalize generated_at (always use current timestamp to avoid AI hallucination)
    const generated_at = new Date().toISOString()

    // Normalize notes (optional, max 500 chars)
    let notes: string | undefined = undefined
    if (typeof input.notes === 'string' && input.notes.trim().length > 0) {
      notes = input.notes.trim().slice(0, 500)
    }

    // Construct normalized object
    const normalized: ToneModelV2 = {
      primary_keywords,
      writing_rules,
      good_examples,
      avoid_examples,
      formality: formality as ToneModelV2['formality'],
      emoji_level: emoji_level as ToneModelV2['emoji_level'],
      version: '2.0', // Always hardcode
      language,
      generated_at,
      source: source as ToneModelV2['source'],
      confidence: confidence as ToneModelV2['confidence'],
    }

    // Add notes only if present
    if (notes) {
      normalized.notes = notes
    }

    return normalized
  } catch (error) {
    // If any error occurs during normalization, return null
    console.error('[sanitizeToneModelForDb] Normalization failed:', error)
    return null
  }
}

/**
 * Runtime tests for sanitizeToneModelForDb
 * Run these on function startup to verify correctness
 */
export function runToneModelSanitizerTests(): void {
  const tests: Array<{ name: string; input: any; expectNull: boolean }> = [
    {
      name: 'null input',
      input: null,
      expectNull: true,
    },
    {
      name: 'undefined input',
      input: undefined,
      expectNull: true,
    },
    {
      name: 'empty object',
      input: {},
      expectNull: true,
    },
    {
      name: 'array with wrong types',
      input: {
        primary_keywords: [1, 2, 3],
        writing_rules: ['rule1', 'rule2', 'rule3'],
        good_examples: ['ex1', 'ex2'],
        avoid_examples: ['bad1', 'bad2'],
      },
      expectNull: true,
    },
    {
      name: 'missing required fields',
      input: {
        primary_keywords: ['key1', 'key2'],
        writing_rules: ['rule1', 'rule2', 'rule3'],
        // missing good_examples and avoid_examples
      },
      expectNull: true,
    },
    {
      name: 'arrays too short',
      input: {
        primary_keywords: ['key1'], // needs 2+
        writing_rules: ['rule1', 'rule2', 'rule3'],
        good_examples: ['ex1', 'ex2'],
        avoid_examples: ['bad1', 'bad2'],
      },
      expectNull: true,
    },
    {
      name: 'correct object',
      input: {
        primary_keywords: ['rolig', 'jordnær'],
        writing_rules: ['Brug korte sætninger', 'Undgå hype', 'Inkluder detaljer'],
        good_examples: ['Nyd brunch i eget tempo', 'Kom forbi til kaffe'],
        avoid_examples: ['Fantastisk lækker!', 'Du vil ikke tro det'],
        formality: 'informal',
        emoji_level: 'minimal',
        language: 'da',
        source: 'website',
        confidence: 'high',
        notes: 'Generated from website content',
      },
      expectNull: false,
    },
    {
      name: 'correct object with invalid enums (should normalize)',
      input: {
        primary_keywords: ['key1', 'key2'],
        writing_rules: ['rule1', 'rule2', 'rule3'],
        good_examples: ['ex1', 'ex2'],
        avoid_examples: ['bad1', 'bad2'],
        formality: 'INVALID',
        emoji_level: 'INVALID',
        language: 'da',
        source: 'INVALID',
        confidence: 'INVALID',
      },
      expectNull: false, // Should normalize to defaults
    },
  ]

  let passed = 0
  let failed = 0

  for (const test of tests) {
    const result = sanitizeToneModelForDb(test.input, 'da')
    const isNull = result === null
    
    if (isNull === test.expectNull) {
      passed++
      console.log(`✅ Test passed: ${test.name}`)
    } else {
      failed++
      console.error(`❌ Test failed: ${test.name}`)
      console.error(`   Expected null: ${test.expectNull}, got null: ${isNull}`)
      if (result) {
        console.error(`   Result:`, JSON.stringify(result, null, 2))
      }
    }
  }

  console.log(`\n📊 Tone Model Sanitizer Tests: ${passed} passed, ${failed} failed`)
  
  if (failed > 0) {
    throw new Error(`Tone model sanitizer tests failed: ${failed} failures`)
  }
}
