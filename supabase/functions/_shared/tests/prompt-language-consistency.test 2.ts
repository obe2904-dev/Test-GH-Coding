/**
 * Prompt Language Consistency Tests
 * 
 * Validates that prompt components (system, user, output) use consistent language:
 * - System prompt language matches expected output language
 * - No language mixing within prompt components
 * - Language configuration is properly applied
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

// ============================================================================
// LANGUAGE CONSISTENCY PATTERNS
// ============================================================================

/**
 * Language indicators for different languages
 */
const LANGUAGE_INDICATORS = {
  da: {
    systemKeywords: ['du er', 'skriv', 'besvar', 'vurdér', 'dansk', 'danske'],
    forbiddenKeywords: ['you are', 'write', 'answer', 'english', 'extract', 'analyze'],
    requiredClosers: ['svar kun på dansk', 'svar udelukkende på dansk'],
  },
  en: {
    systemKeywords: ['you are', 'write', 'answer', 'respond', 'english'],
    forbiddenKeywords: ['du er', 'skriv', 'dansk', 'danske'],
    requiredClosers: ['respond only in english', 'answer in english'],
  },
  sv: {
    systemKeywords: ['du är', 'skriv', 'svara', 'svensk', 'svenska'],
    forbiddenKeywords: ['you are', 'du er', 'engelsk', 'dansk'],
    requiredClosers: ['svara bara på svenska', 'svara endast på svenska'],
  }
}

/**
 * Prompt component types
 */
type PromptComponent = 'system' | 'user' | 'output'

/**
 * Prompt structure for testing
 */
interface PromptStructure {
  system: string
  user: string
  expectedLanguage: 'da' | 'en' | 'sv'
  promptName: string
}

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

/**
 * Detects the dominant language in a text
 */
function detectLanguage(text: string): 'da' | 'en' | 'sv' | 'mixed' | 'unknown' {
  const lowerText = text.toLowerCase()
  
  const scores = {
    da: 0,
    en: 0,
    sv: 0,
  }
  
  // Check Danish indicators
  if (/\b(du er|skriv|dansk|danske|vurdér|besvar)\b/.test(lowerText)) scores.da += 2
  if (/[æøå]/.test(lowerText)) scores.da += 1
  if (/\b(og|det|en|der|på|til|med|ikke|er)\b/.test(lowerText)) scores.da += 0.5
  
  // Check English indicators
  if (/\b(you are|write|english|extract|analyze|respond)\b/.test(lowerText)) scores.en += 2
  if (/\b(the|and|of|to|in|for|is|that|with)\b/.test(lowerText)) scores.en += 0.5
  
  // Check Swedish indicators
  if (/\b(du är|svensk|svenska|svara)\b/.test(lowerText)) scores.sv += 2
  if (/\b(och|det|en|är|för|med|till)\b/.test(lowerText)) scores.sv += 0.5
  
  const maxScore = Math.max(scores.da, scores.en, scores.sv)
  
  if (maxScore === 0) return 'unknown'
  
  // Count how many languages have significant scores (>= 1)
  const significantLanguages = Object.values(scores).filter(score => score >= 1).length
  
  // If multiple languages have significant presence, it's mixed
  if (significantLanguages > 1) return 'mixed'
  
  const topLanguages = Object.entries(scores)
    .filter(([_, score]) => score === maxScore)
    .map(([lang]) => lang)
  
  if (topLanguages.length > 1) return 'mixed'
  
  return topLanguages[0] as 'da' | 'en' | 'sv'
}

/**
 * Checks if prompt has language mixing issues
 */
function checkLanguageMixing(
  systemPrompt: string, 
  userPrompt: string,
  expectedLanguage: 'da' | 'en' | 'sv'
): { 
  consistent: boolean
  systemLanguage: string
  userLanguage: string
  issues: string[]
} {
  const systemLang = detectLanguage(systemPrompt)
  const userLang = detectLanguage(userPrompt)
  const issues: string[] = []
  
  // Check system prompt language
  if (systemLang !== expectedLanguage && systemLang !== 'unknown') {
    issues.push(`System prompt is in ${systemLang}, expected ${expectedLanguage}`)
  }
  
  // Check user prompt language
  if (userLang !== expectedLanguage && userLang !== 'unknown') {
    issues.push(`User prompt is in ${userLang}, expected ${expectedLanguage}`)
  }
  
  // Check for mixed language
  if (systemLang === 'mixed') {
    issues.push('System prompt has mixed languages')
  }
  
  if (userLang === 'mixed') {
    issues.push('User prompt has mixed languages')
  }
  
  // Check for forbidden keywords based on expected language
  const indicators = LANGUAGE_INDICATORS[expectedLanguage]
  
  for (const forbidden of indicators.forbiddenKeywords) {
    const pattern = new RegExp(`\\b${forbidden}\\b`, 'i')
    if (pattern.test(systemPrompt)) {
      issues.push(`System prompt contains forbidden ${expectedLanguage} keyword: "${forbidden}"`)
    }
    if (pattern.test(userPrompt)) {
      issues.push(`User prompt contains forbidden ${expectedLanguage} keyword: "${forbidden}"`)
    }
  }
  
  return {
    consistent: issues.length === 0,
    systemLanguage: systemLang,
    userLanguage: userLang,
    issues
  }
}

/**
 * Checks if prompt has explicit language instruction
 */
function hasExplicitLanguageInstruction(
  systemPrompt: string,
  userPrompt: string,
  expectedLanguage: 'da' | 'en' | 'sv'
): boolean {
  const indicators = LANGUAGE_INDICATORS[expectedLanguage]
  const combinedText = (systemPrompt + ' ' + userPrompt).toLowerCase()
  
  // Check for any of the required closers
  return indicators.requiredClosers.some(closer => 
    combinedText.includes(closer.toLowerCase())
  )
}

// ============================================================================
// UNIT TESTS
// ============================================================================

Deno.test('Language Detection - Correctly identifies Danish', () => {
  const danishTexts = [
    'Du er en professionel social media writer. Skriv på dansk.',
    'Vurdér fotoet og besvar på dansk.',
    'Dette er en dansk tekst med æ, ø og å.',
  ]
  
  for (const text of danishTexts) {
    const lang = detectLanguage(text)
    assertEquals(lang, 'da', `Failed to detect Danish in: "${text}"`)
  }
})

Deno.test('Language Detection - Correctly identifies English', () => {
  const englishTexts = [
    'You are a professional social media writer. Write in English.',
    'Extract the following information from the text.',
    'Analyze the business and respond in English.',
  ]
  
  for (const text of englishTexts) {
    const lang = detectLanguage(text)
    assertEquals(lang, 'en', `Failed to detect English in: "${text}"`)
  }
})

Deno.test('Language Detection - Detects mixed language', () => {
  const mixedTexts = [
    'You are en professionel writer. Skriv på dansk.',
    'Du er a professional writer. Write in English.',
  ]
  
  for (const text of mixedTexts) {
    const lang = detectLanguage(text)
    assertEquals(lang, 'mixed', `Failed to detect mixed language in: "${text}"`)
  }
})

// ============================================================================
// PROMPT CONSISTENCY TESTS
// ============================================================================

Deno.test('Prompt Consistency - Danish prompts pass consistency check', () => {
  const goodDanishPrompt: PromptStructure = {
    system: 'Du er en professionel social media content writer. Skriv kun på dansk.',
    user: 'Generer et post-forslag baseret på følgende menu. Besvar kun på dansk.',
    expectedLanguage: 'da',
    promptName: 'test-danish-prompt'
  }
  
  const result = checkLanguageMixing(
    goodDanishPrompt.system,
    goodDanishPrompt.user,
    goodDanishPrompt.expectedLanguage
  )
  
  assertEquals(result.consistent, true, `Issues: ${result.issues.join(', ')}`)
  assertEquals(result.systemLanguage, 'da')
  assertEquals(result.userLanguage, 'da')
})

Deno.test('Prompt Consistency - Detects English in Danish prompt', () => {
  const badDanishPrompt: PromptStructure = {
    system: 'You are a professional social media writer. Write in Danish.',
    user: 'Generer et post-forslag baseret på følgende menu.',
    expectedLanguage: 'da',
    promptName: 'test-bad-danish-prompt'
  }
  
  const result = checkLanguageMixing(
    badDanishPrompt.system,
    badDanishPrompt.user,
    badDanishPrompt.expectedLanguage
  )
  
  assertEquals(result.consistent, false, 'Should detect language inconsistency')
  assertEquals(result.issues.length > 0, true, 'Should report issues')
})

Deno.test('Prompt Consistency - Detects mixed language in prompt', () => {
  const mixedPrompt: PromptStructure = {
    system: 'Du er a professional writer who skal write in Danish.',
    user: 'Extract følgende information and respond på dansk.',
    expectedLanguage: 'da',
    promptName: 'test-mixed-prompt'
  }
  
  const result = checkLanguageMixing(
    mixedPrompt.system,
    mixedPrompt.user,
    mixedPrompt.expectedLanguage
  )
  
  assertEquals(result.consistent, false, 'Should detect mixed language')
  assertEquals(result.systemLanguage, 'mixed', 'Should detect mixed in system')
})

Deno.test('Explicit Language Instruction - Detects Danish closer', () => {
  const promptWithCloser = {
    system: 'Du er en content writer.',
    user: 'Skriv et forslag. Svar kun på dansk.'
  }
  
  const hasCloser = hasExplicitLanguageInstruction(
    promptWithCloser.system,
    promptWithCloser.user,
    'da'
  )
  
  assertEquals(hasCloser, true, 'Should detect explicit Danish instruction')
})

Deno.test('Explicit Language Instruction - Detects missing closer', () => {
  const promptWithoutCloser = {
    system: 'Du er en content writer.',
    user: 'Skriv et forslag baseret på menuen.'
  }
  
  const hasCloser = hasExplicitLanguageInstruction(
    promptWithoutCloser.system,
    promptWithoutCloser.user,
    'da'
  )
  
  assertEquals(hasCloser, false, 'Should detect missing explicit Danish instruction')
})

// ============================================================================
// REAL PROMPT VALIDATION (SAMPLES)
// ============================================================================

Deno.test('Real Prompt Validation - generate-text system message', () => {
  const systemMessage = 'Du er en professionel social media content writer for en dansk restaurations- eller serveringsvirksomhed. Skriv kun teksten som bedt om, ingen ekstra forklaringer.'
  
  const lang = detectLanguage(systemMessage)
  assertEquals(lang, 'da', 'System message should be in Danish')
})

Deno.test('Real Prompt Validation - spelling system message', () => {
  const systemMessage = 'You are a professional spelling and grammar assistant. Correct the user\'s text for spelling, grammar and punctuation while preserving meaning, intent and formatting.'
  
  const lang = detectLanguage(systemMessage)
  assertEquals(lang, 'en', 'Spelling system message is currently in English (should be localized)')
})

// ============================================================================
// COMPREHENSIVE PROMPT AUDIT
// ============================================================================

/**
 * Audit result for a single prompt
 */
interface PromptAuditResult {
  promptName: string
  expectedLanguage: 'da' | 'en' | 'sv'
  systemLanguage: string
  userLanguage: string
  hasExplicitInstruction: boolean
  isConsistent: boolean
  issues: string[]
  recommendations: string[]
}

/**
 * Audits a prompt for language consistency
 */
function auditPrompt(prompt: PromptStructure): PromptAuditResult {
  const mixingCheck = checkLanguageMixing(
    prompt.system,
    prompt.user,
    prompt.expectedLanguage
  )
  
  const hasExplicit = hasExplicitLanguageInstruction(
    prompt.system,
    prompt.user,
    prompt.expectedLanguage
  )
  
  const recommendations: string[] = []
  
  if (!hasExplicit) {
    const langName = prompt.expectedLanguage === 'da' ? 'dansk' : 
                     prompt.expectedLanguage === 'sv' ? 'svenska' : 'English'
    recommendations.push(`Add explicit language instruction: "Svar kun på ${langName}"`)
  }
  
  if (!mixingCheck.consistent) {
    recommendations.push('Convert all prompt components to consistent language')
  }
  
  if (mixingCheck.systemLanguage !== prompt.expectedLanguage) {
    recommendations.push(`Convert system prompt to ${prompt.expectedLanguage}`)
  }
  
  return {
    promptName: prompt.promptName,
    expectedLanguage: prompt.expectedLanguage,
    systemLanguage: mixingCheck.systemLanguage,
    userLanguage: mixingCheck.userLanguage,
    hasExplicitInstruction: hasExplicit,
    isConsistent: mixingCheck.consistent,
    issues: mixingCheck.issues,
    recommendations
  }
}

Deno.test('Prompt Audit - Generates comprehensive audit report', () => {
  const testPrompts: PromptStructure[] = [
    {
      system: 'Du er en content writer. Skriv på dansk.',
      user: 'Generer et forslag. Svar kun på dansk.',
      expectedLanguage: 'da',
      promptName: 'good-danish-prompt'
    },
    {
      system: 'You are a content writer. Write in Danish.',
      user: 'Generate a suggestion.',
      expectedLanguage: 'da',
      promptName: 'bad-danish-prompt'
    }
  ]
  
  const auditResults = testPrompts.map(p => auditPrompt(p))
  
  // First prompt should pass
  assertEquals(auditResults[0].isConsistent, true)
  assertEquals(auditResults[0].hasExplicitInstruction, true)
  assertEquals(auditResults[0].recommendations.length, 0)
  
  // Second prompt should fail
  assertEquals(auditResults[1].isConsistent, false)
  assertEquals(auditResults[1].recommendations.length > 0, true)
})

// ============================================================================
// EXPORT FOR USE IN OTHER TESTS
// ============================================================================

export {
  detectLanguage,
  checkLanguageMixing,
  hasExplicitLanguageInstruction,
  auditPrompt,
  type PromptStructure,
  type PromptAuditResult,
}
