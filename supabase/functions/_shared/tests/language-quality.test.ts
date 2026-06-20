/**
 * Language Quality Tests
 * 
 * Validates that AI-generated content maintains language purity and quality:
 * - No English leakage in Danish output
 * - No meta-commentary patterns
 * - Consistent language across prompt components
 * - No forbidden consultant-speak
 */

import { assertEquals, assertStringIncludes, assertMatch, assertNotMatch } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

// ============================================================================
// LANGUAGE DETECTION PATTERNS
// ============================================================================

/**
 * English patterns that should NEVER appear in Danish output
 */
const ENGLISH_LEAKAGE_PATTERNS = [
  // Meta-commentary openers
  /\b(based on|given that|considering|drawing from|as indicated by)\b/i,
  
  // Consultant-speak
  /\b(unique|amazing|unforgettable|magical|gastronomic)\b/i,
  /\b(journey|destination|experience the)\b/i,
  /\b(indulge|pamper yourself|treat yourself)\b/i,
  
  // Generic marketing buzzwords
  /\b(culinary adventure|food lover|good times|share moments)\b/i,
  /\b(welcome you|versatile dining experience)\b/i,
  
  // English sentence starters in Danish text
  /^(The|This|Our|We|You|Based|Given|Considering)/,
  
  // Common English verbs that shouldn't appear
  /\b(extract|analyze|detect|generate|produce|create)\s+(the|a|an)\b/i,
]

/**
 * Meta-commentary patterns (AI explaining its reasoning instead of producing content)
 */
const META_COMMENTARY_PATTERNS = [
  /^Based on\s+/i,
  /^Given\s+(that|the)\s+/i,
  /^Considering\s+/i,
  /^Drawing from\s+/i,
  /reflects the\s+/i,
  /as indicated by\s+/i,
  /The\s+\w+\s+reflects\s+/i,
  /This\s+\w+\s+demonstrates\s+/i,
  /^In\s+light\s+of\s+/i,
  /^Taking\s+into\s+account\s+/i,
]

/**
 * Forbidden Danish phrases (from business rules)
 */
const FORBIDDEN_DANISH_PHRASES = [
  /\b(uforglemmelig|uforglemmelige)\b/i,
  /\b(magisk|magiske)\b/i,
  /\b(gastronomisk|gastronomiske)\b/i,
  /\b(udsøgt|udsøgte)\b/i,
  /\b(forkæle|forkæler|forkælet)\b/i,
  /\bgode stunder\b/i,
  /\bdele stunder\b/i,
  /\bnyd en\b/i,
  /\bbyde dig velkommen\b/i,
  /\balsidig spiseoplevelse\b/i,
]

/**
 * Passive voice patterns (forbidden in Danish hospitality content)
 */
const PASSIVE_VOICE_PATTERNS = [
  /\b(serveres|tilbydes|forberedes|præsenteres)\b/,
]

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Simulates content generation for testing
 * In production, this would call actual Edge Functions
 */
async function generateTestContent(
  contentType: string,
  language: string = 'da'
): Promise<string> {
  // This is a mock - in real tests, you'd call the actual Edge Function
  // For now, return sample outputs that should pass/fail
  
  const samples: Record<string, string> = {
    'good-danish': 'Stegt flæsk med persillesovs klar fra kl. 12. Sprødt bacon og cremet hjemmelavet sovs. Frokosten passer til kontorfolk på pause.',
    'english-leakage': 'Based on the menu, this dish is amazing and unforgettable.',
    'meta-commentary': 'Given that the business is located by the water, this post reflects the waterfront identity.',
    'forbidden-words': 'Nyd en uforglemmelig og magisk gastronomisk oplevelse hos os.',
    'passive-voice': 'Retten serveres med friske grøntsager og tilbydes hele dagen.',
  }
  
  return samples[contentType] || samples['good-danish']
}

/**
 * Checks if text contains any English leakage
 */
function detectEnglishLeakage(text: string): { hasLeakage: boolean; matches: string[] } {
  const matches: string[] = []
  
  for (const pattern of ENGLISH_LEAKAGE_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      matches.push(match[0])
    }
  }
  
  return {
    hasLeakage: matches.length > 0,
    matches
  }
}

/**
 * Checks if text contains meta-commentary
 */
function detectMetaCommentary(text: string): { hasMetaCommentary: boolean; matches: string[] } {
  const matches: string[] = []
  
  for (const pattern of META_COMMENTARY_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      matches.push(match[0])
    }
  }
  
  return {
    hasMetaCommentary: matches.length > 0,
    matches
  }
}

/**
 * Checks if text contains forbidden phrases
 */
function detectForbiddenPhrases(text: string): { hasForbidden: boolean; matches: string[] } {
  const matches: string[] = []
  
  for (const pattern of FORBIDDEN_DANISH_PHRASES) {
    const match = text.match(pattern)
    if (match) {
      matches.push(match[0])
    }
  }
  
  return {
    hasForbidden: matches.length > 0,
    matches
  }
}

/**
 * Checks if text contains passive voice
 */
function detectPassiveVoice(text: string): { hasPassive: boolean; matches: string[] } {
  const matches: string[] = []
  
  for (const pattern of PASSIVE_VOICE_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      matches.push(match[0])
    }
  }
  
  return {
    hasPassive: matches.length > 0,
    matches
  }
}

// ============================================================================
// UNIT TESTS - PATTERN DETECTION
// ============================================================================

Deno.test('Language Detection - Identifies English leakage', () => {
  const testCases = [
    { text: 'Based on the menu, this is great', shouldDetect: true },
    { text: 'Given that the location is waterfront', shouldDetect: true },
    { text: 'This amazing culinary journey', shouldDetect: true },
    { text: 'Stegt flæsk med persillesovs', shouldDetect: false },
    { text: 'Frokosten er klar fra kl. 12', shouldDetect: false },
  ]
  
  for (const { text, shouldDetect } of testCases) {
    const result = detectEnglishLeakage(text)
    assertEquals(
      result.hasLeakage, 
      shouldDetect, 
      `Text: "${text}" - Expected leakage: ${shouldDetect}, Got: ${result.hasLeakage}. Matches: ${result.matches.join(', ')}`
    )
  }
})

Deno.test('Meta-commentary Detection - Identifies AI reasoning patterns', () => {
  const testCases = [
    { text: 'Based on the waterfront location...', shouldDetect: true },
    { text: 'The post reflects the brand identity', shouldDetect: true },
    { text: 'Considering the seasonal menu...', shouldDetect: true },
    { text: 'Frokosten afspejler årstidens råvarer', shouldDetect: false },
    { text: 'Retten er inspireret af sæsonen', shouldDetect: false },
  ]
  
  for (const { text, shouldDetect } of testCases) {
    const result = detectMetaCommentary(text)
    assertEquals(
      result.hasMetaCommentary, 
      shouldDetect, 
      `Text: "${text}" - Expected meta: ${shouldDetect}, Got: ${result.hasMetaCommentary}. Matches: ${result.matches.join(', ')}`
    )
  }
})

Deno.test('Forbidden Phrases Detection - Identifies banned marketing speak', () => {
  const testCases = [
    { text: 'Nyd en uforglemmelig oplevelse', shouldDetect: true },
    { text: 'En magisk aften ved åen', shouldDetect: true },
    { text: 'Gastronomisk perle i byen', shouldDetect: true },
    { text: 'Frokost ved åen fra kl. 12', shouldDetect: false },
    { text: 'Stegt flæsk og hygge', shouldDetect: false },
  ]
  
  for (const { text, shouldDetect } of testCases) {
    const result = detectForbiddenPhrases(text)
    assertEquals(
      result.hasForbidden, 
      shouldDetect, 
      `Text: "${text}" - Expected forbidden: ${shouldDetect}, Got: ${result.hasForbidden}. Matches: ${result.matches.join(', ')}`
    )
  }
})

Deno.test('Passive Voice Detection - Identifies passive constructions', () => {
  const testCases = [
    { text: 'Retten serveres med grøntsager', shouldDetect: true },
    { text: 'Menuen tilbydes hele dagen', shouldDetect: true },
    { text: 'Maden forberedes frisk hver dag', shouldDetect: true },
    { text: 'Vi serverer retten med grøntsager', shouldDetect: false },
    { text: 'Køkkenet laver frisk mad', shouldDetect: false },
  ]
  
  for (const { text, shouldDetect } of testCases) {
    const result = detectPassiveVoice(text)
    assertEquals(
      result.hasPassive, 
      shouldDetect, 
      `Text: "${text}" - Expected passive: ${shouldDetect}, Got: ${result.hasPassive}. Matches: ${result.matches.join(', ')}`
    )
  }
})

// ============================================================================
// INTEGRATION TESTS - CONTENT GENERATION QUALITY
// ============================================================================

Deno.test('Content Generation - Good Danish output passes all checks', async () => {
  const output = await generateTestContent('good-danish')
  
  const englishCheck = detectEnglishLeakage(output)
  const metaCheck = detectMetaCommentary(output)
  const forbiddenCheck = detectForbiddenPhrases(output)
  const passiveCheck = detectPassiveVoice(output)
  
  assertEquals(englishCheck.hasLeakage, false, `English leakage detected: ${englishCheck.matches.join(', ')}`)
  assertEquals(metaCheck.hasMetaCommentary, false, `Meta-commentary detected: ${metaCheck.matches.join(', ')}`)
  assertEquals(forbiddenCheck.hasForbidden, false, `Forbidden phrases detected: ${forbiddenCheck.matches.join(', ')}`)
  assertEquals(passiveCheck.hasPassive, false, `Passive voice detected: ${passiveCheck.matches.join(', ')}`)
})

Deno.test('Content Generation - English leakage is detected', async () => {
  const output = await generateTestContent('english-leakage')
  
  const englishCheck = detectEnglishLeakage(output)
  
  assertEquals(englishCheck.hasLeakage, true, 'Failed to detect English leakage')
  assertEquals(englishCheck.matches.length > 0, true, 'No matches found for English leakage')
})

Deno.test('Content Generation - Meta-commentary is detected', async () => {
  const output = await generateTestContent('meta-commentary')
  
  const metaCheck = detectMetaCommentary(output)
  
  assertEquals(metaCheck.hasMetaCommentary, true, 'Failed to detect meta-commentary')
  assertEquals(metaCheck.matches.length > 0, true, 'No matches found for meta-commentary')
})

Deno.test('Content Generation - Forbidden words are detected', async () => {
  const output = await generateTestContent('forbidden-words')
  
  const forbiddenCheck = detectForbiddenPhrases(output)
  
  assertEquals(forbiddenCheck.hasForbidden, true, 'Failed to detect forbidden phrases')
  assertEquals(forbiddenCheck.matches.length > 0, true, 'No matches found for forbidden phrases')
})

Deno.test('Content Generation - Passive voice is detected', async () => {
  const output = await generateTestContent('passive-voice')
  
  const passiveCheck = detectPassiveVoice(output)
  
  assertEquals(passiveCheck.hasPassive, true, 'Failed to detect passive voice')
  assertEquals(passiveCheck.matches.length > 0, true, 'No matches found for passive voice')
})

// ============================================================================
// BATCH QUALITY TESTS
// ============================================================================

/**
 * Quality score for a batch of content
 */
interface QualityScore {
  totalTests: number
  passed: number
  failed: number
  score: number // 0-100
  issues: {
    englishLeakage: number
    metaCommentary: number
    forbiddenPhrases: number
    passiveVoice: number
  }
}

/**
 * Runs comprehensive quality check on a batch of content
 */
function assessContentQuality(contents: string[]): QualityScore {
  const score: QualityScore = {
    totalTests: contents.length,
    passed: 0,
    failed: 0,
    score: 0,
    issues: {
      englishLeakage: 0,
      metaCommentary: 0,
      forbiddenPhrases: 0,
      passiveVoice: 0,
    }
  }
  
  for (const content of contents) {
    let contentPassed = true
    
    const englishCheck = detectEnglishLeakage(content)
    if (englishCheck.hasLeakage) {
      score.issues.englishLeakage++
      contentPassed = false
    }
    
    const metaCheck = detectMetaCommentary(content)
    if (metaCheck.hasMetaCommentary) {
      score.issues.metaCommentary++
      contentPassed = false
    }
    
    const forbiddenCheck = detectForbiddenPhrases(content)
    if (forbiddenCheck.hasForbidden) {
      score.issues.forbiddenPhrases++
      contentPassed = false
    }
    
    const passiveCheck = detectPassiveVoice(content)
    if (passiveCheck.hasPassive) {
      score.issues.passiveVoice++
      contentPassed = false
    }
    
    if (contentPassed) {
      score.passed++
    } else {
      score.failed++
    }
  }
  
  score.score = (score.passed / score.totalTests) * 100
  
  return score
}

Deno.test('Batch Quality Assessment - Calculates quality score correctly', () => {
  const testBatch = [
    'Stegt flæsk med persillesovs klar fra kl. 12',  // Good
    'Based on the menu, this is great',              // Bad (English)
    'Frokosten er klar nu',                          // Good
    'Nyd en uforglemmelig oplevelse',                // Bad (Forbidden)
    'Brunch ved åen hver weekend',                   // Good
  ]
  
  const score = assessContentQuality(testBatch)
  
  assertEquals(score.totalTests, 5)
  assertEquals(score.passed, 3)
  assertEquals(score.failed, 2)
  assertEquals(score.score, 60)
  assertEquals(score.issues.englishLeakage, 1)
  assertEquals(score.issues.forbiddenPhrases, 1)
})

// ============================================================================
// EXPORT FOR USE IN OTHER TESTS
// ============================================================================

export {
  detectEnglishLeakage,
  detectMetaCommentary,
  detectForbiddenPhrases,
  detectPassiveVoice,
  assessContentQuality,
  type QualityScore,
}
