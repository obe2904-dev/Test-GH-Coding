/**
 * Voice Validation Module
 * 
 * Validates generated text against brand voice guardrails.
 * Used to enforce never_say rules, brochure language patterns, sentence length limits, etc.
 * 
 * @version 1.0
 * @date May 13, 2026
 */

import type { V5BrandProfile } from '../brand-profile/types-v5.ts'

export interface VoiceViolation {
  type: 'banned_word' | 'banned_phrase' | 'length_violation' | 'pattern_match'
  severity: 'critical' | 'warning'
  text: string              // The offending text
  context?: string          // Surrounding context
  suggestion?: string       // Replacement if available
  rule?: string             // Which rule was violated
}

export interface VoiceValidation {
  valid: boolean
  violations: VoiceViolation[]
  score: number  // 0-1, how well it matches voice (1 = perfect)
}

/**
 * Validate generated text against V5 brand profile voice guardrails
 */
export function validateAgainstVoice(
  generatedText: string,
  brandProfile: V5BrandProfile
): VoiceValidation {
  
  const violations: VoiceViolation[] = []
  const guardrails = brandProfile.guardrails
  const voice = brandProfile.voice
  
  // =========================================================================
  // 1. BANNED WORDS (Critical)
  // =========================================================================
  if (guardrails?.never_say && Array.isArray(guardrails.never_say)) {
    for (const rule of guardrails.never_say) {
      // Extract word before → and replacement after
      const parts = rule.split('→').map(p => p.trim())
      if (parts.length !== 2) continue
      
      const bannedWord = parts[0].toLowerCase()
      const replacement = parts[1]
      
      // Check if banned word exists (case-insensitive, word boundaries)
      const regex = new RegExp(`\\b${escapeRegex(bannedWord)}\\b`, 'gi')
      const matches = generatedText.match(regex)
      
      if (matches) {
        for (const match of matches) {
          violations.push({
            type: 'banned_word',
            severity: 'critical',
            text: match,
            suggestion: replacement,
            rule: `Never say: "${bannedWord}" → use "${replacement}"`
          })
        }
      }
    }
  }
  
  // =========================================================================
  // 2. FORBIDDEN PHRASES (Critical) - Phase 2 Week 1
  // =========================================================================
  if (guardrails?.forbidden_phrases && Array.isArray(guardrails.forbidden_phrases)) {
    for (const phrase of guardrails.forbidden_phrases) {
      const lowerText = generatedText.toLowerCase()
      const lowerPhrase = phrase.toLowerCase()
      
      if (lowerText.includes(lowerPhrase)) {
        let index = lowerText.indexOf(lowerPhrase)
        while (index !== -1) {
          violations.push({
            type: 'banned_phrase',
            severity: 'critical',
            text: generatedText.substring(index, index + phrase.length),
            context: getContext(generatedText, index, phrase.length),
            rule: `Forbidden phrase: NEVER use "${phrase}"`
          })
          index = lowerText.indexOf(lowerPhrase, index + 1)
        }
      }
    }
  }

  // =========================================================================
  // 3. TECHNICAL DATABASE TERMS (Critical) - Phase 2 Week 1
  // =========================================================================
  if (guardrails?.technical_terms && Array.isArray(guardrails.technical_terms)) {
    for (const term of guardrails.technical_terms) {
      const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi')
      const matches = generatedText.match(regex)
      
      if (matches) {
        for (const match of matches) {
          violations.push({
            type: 'banned_word',
            severity: 'critical',
            text: match,
            rule: `Technical term: Never use "${term}" (use owner-friendly language instead)`
          })
        }
      }
    }
  }

  // =========================================================================
  // 4. WEATHER CLICHÉS (Critical) - Phase 2 Week 1
  // =========================================================================
  if (guardrails?.weather_cliches && Array.isArray(guardrails.weather_cliches)) {
    for (const cliche of guardrails.weather_cliches) {
      const lowerText = generatedText.toLowerCase()
      const lowerCliche = cliche.toLowerCase()
      
      if (lowerText.includes(lowerCliche)) {
        violations.push({
          type: 'banned_phrase',
          severity: 'critical',
          text: cliche,
          rule: `Weather cliché: Avoid "${cliche}" (use commercial mechanism instead)`
        })
      }
    }
  }

  // =========================================================================
  // 5. BANNED PHRASES - Brochure Language (Critical)
  // =========================================================================
  // v5.1.3: Read from strip_from_output sub-object (fallback to old structure for compatibility)
  const stripPatterns = (guardrails?.avoid_patterns as any)?.strip_from_output || guardrails?.avoid_patterns
  
  if (stripPatterns?.brochure_language) {
    for (const phrase of stripPatterns.brochure_language) {
      // Case-insensitive substring match
      const lowerText = generatedText.toLowerCase()
      const lowerPhrase = phrase.toLowerCase()
      
      if (lowerText.includes(lowerPhrase)) {
        // Find all occurrences
        let index = lowerText.indexOf(lowerPhrase)
        while (index !== -1) {
          violations.push({
            type: 'banned_phrase',
            severity: 'critical',
            text: generatedText.substring(index, index + phrase.length),
            context: getContext(generatedText, index, phrase.length),
            rule: `Brochure language: Never use "${phrase}"`
          })
          index = lowerText.indexOf(lowerPhrase, index + 1)
        }
      }
    }
  }
  
  // =========================================================================
  // 6. SUPERLATIVES (Warning - less critical)
  // =========================================================================
  if (stripPatterns?.superlatives) {
    for (const superlative of stripPatterns.superlatives) {
      const regex = new RegExp(`\\b${escapeRegex(superlative)}\\b`, 'gi')
      const matches = generatedText.match(regex)
      
      if (matches) {
        for (const match of matches) {
          violations.push({
            type: 'banned_word',
            severity: 'warning',
            text: match,
            rule: `Superlative: Avoid "${superlative}"`
          })
        }
      }
    }
  }
  
  // =========================================================================
  // 7. SENTENCE LENGTH (Warning if limits set)
  // =========================================================================
  if (voice?.sentence_length_max) {
    const sentences = splitIntoSentences(generatedText)
    
    for (const sentence of sentences) {
      const wordCount = countWords(sentence)
      
      if (wordCount > voice.sentence_length_max) {
        violations.push({
          type: 'length_violation',
          severity: 'warning',
          text: sentence.substring(0, 100) + (sentence.length > 100 ? '...' : ''),
          rule: `Sentence too long: ${wordCount} words (max: ${voice.sentence_length_max})`
        })
      }
    }
  }
  
  // =========================================================================
  // 7b. RHETORICAL QUESTIONS WITH ABSTRACT OBJECTS (Critical)
  // =========================================================================
  // Pattern: "Kan du se/mærke/føle/fornemme <abstract noun>?" — ungrounded filler
  // the model reaches for when it has no concrete fact to anchor a sentence to
  // (e.g. "Kan du se omsorgen?"). Same failure class as banned words/phrases —
  // enforce it the same way instead of leaving it as a prompt-only instruction.
  const RHETORICAL_ABSTRACT_PATTERN =
    /\b(kan|kunne)\s+(du|i)\s+(se|mærke|føle|fornemme|opleve)\b[^?]{0,40}\b(omsorg\w*|stemning\w*|nærvær\w*|\bro\w*|følelse\w*|glæde\w*|energi\w*|magi\w*|kærlighed\w*|passion\w*|hygge\w*|varme\w*|sjæl\w*)\b[^?]*\?/gi

  const rhetoricalMatches = generatedText.match(RHETORICAL_ABSTRACT_PATTERN)
  if (rhetoricalMatches) {
    for (const match of rhetoricalMatches) {
      violations.push({
        type: 'pattern_match',
        severity: 'critical',
        text: match,
        rule: 'Rhetorical question with abstract-noun object — ungrounded filler, not a real question. Replace with a concrete detail or remove.'
      })
    }
  }
  
  // =========================================================================
  // 8. GENERIC MARKETING PHRASES (Warning)
  // =========================================================================
  if (stripPatterns?.generic_marketing) {
    for (const phrase of stripPatterns.generic_marketing) {
      const lowerText = generatedText.toLowerCase()
      const lowerPhrase = phrase.toLowerCase()
      
      if (lowerText.includes(lowerPhrase)) {
        violations.push({
          type: 'banned_phrase',
          severity: 'warning',
          text: phrase,
          rule: `Generic marketing: Avoid "${phrase}"`
        })
      }
    }
  }
  
  // =========================================================================
  // Calculate validation result
  // =========================================================================
  
  const criticalViolations = violations.filter(v => v.severity === 'critical')
  const warningViolations = violations.filter(v => v.severity === 'warning')
  
  // Score calculation: start at 1.0, deduct for violations
  let score = 1.0
  score -= criticalViolations.length * 0.25  // -25% per critical violation
  score -= warningViolations.length * 0.10   // -10% per warning
  score = Math.max(0, score)
  
  return {
    valid: criticalViolations.length === 0,  // Only fail on critical violations
    violations,
    score
  }
}

/**
 * Helper: Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Helper: Get surrounding context for a match
 */
function getContext(text: string, index: number, length: number, contextLength: number = 50): string {
  const start = Math.max(0, index - contextLength)
  const end = Math.min(text.length, index + length + contextLength)
  
  let context = text.substring(start, end)
  if (start > 0) context = '...' + context
  if (end < text.length) context = context + '...'
  
  return context
}

/**
 * Helper: Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  // Split on . ! ? followed by space or end
  return text
    .split(/[.!?]+\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/**
 * Helper: Count words in a string
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).length
}
