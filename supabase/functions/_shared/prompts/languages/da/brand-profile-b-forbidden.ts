/**
 * Danish Forbidden Words and Patterns for Brand Profile Generation (Prompt B)
 * 
 * This file contains words and patterns that should NEVER appear in brand profile outputs.
 * These are marketing clichés, consultant-speak, and overused phrases that reduce authenticity.
 * 
 * MIGRATION: Extracted from hardcoded prompt-b.ts to enable language-specific configuration.
 * Date: 2026-05-12
 * Part of: Brand Profile Prompt Refactoring Phase 1
 */

export interface ForbiddenContent {
  // Words that must never appear in ANY output field
  absolutelyBannedWords: string[]
  
  // Phrase patterns to detect and reject (used for validation)
  bannedPhrasePatterns: string[]
  
  // Meta-commentary patterns (reasoning process leaking into output)
  metaCommentaryPatterns: {
    pattern: string
    fix: string
  }[]
  
  // Poetic/romantic language patterns (too flowery for direct business voice)
  poeticPatterns: {
    pattern: string
    reason: string
    alternative: string
  }[]
}

export const DANISH_FORBIDDEN: ForbiddenContent = {
  /**
   * ABSOLUTTE FORBUD
   * These words must NEVER appear in brand_essence, caption examples, target_audience, or any output field.
   * If the AI uses one of these, it should stop and rewrite.
   */
  absolutelyBannedWords: [
    'uforglemmelig',
    'uforglemmelige',
    'magisk',
    'magiske',
    'gastronomisk',
    'gastronomiske',
    'udsøgt',
    'udsøgte',
    'forkæle',
    'forkæler',
    'forkælet',
    'gode stunder',
    'dele stunder',
    'nyd en',
    'byde dig velkommen',
    'alsidig spiseoplevelse',
  ],

  /**
   * Banned phrase patterns for additional validation
   * These are multi-word patterns that indicate marketing-speak
   */
  bannedPhrasePatterns: [
    'based on',
    'given that',
    'considering',
    'drawing from',
    'as indicated by',
    'the field reflects',
  ],

  /**
   * META-COMMENTARY PATTERNS
   * Patterns where the AI explains its reasoning instead of writing content
   */
  metaCommentaryPatterns: [
    {
      pattern: 'Based on [signal]...',
      fix: 'Just write the content that signal produces',
    },
    {
      pattern: 'Given that [fact]...',
      fix: 'Incorporate the fact, don\'t announce it',
    },
    {
      pattern: 'The [field] reflects...',
      fix: 'Write the field value, not meta-explanation',
    },
    {
      pattern: 'Drawing from [source]...',
      fix: 'Use the source, don\'t cite it in output',
    },
    {
      pattern: 'Considering [context]...',
      fix: 'Let context shape output silently',
    },
    {
      pattern: 'As indicated by...',
      fix: 'Show the indication, don\'t explain it',
    },
  ],

  /**
   * POETIC/ROMANTIC LANGUAGE PATTERNS
   * Patterns that are too flowery or metaphorical for direct business voice
   * Note: These may be acceptable for fine-dining or luxury concepts
   */
  poeticPatterns: [
    {
      pattern: '[sensory noun] + fortsætter/ledsager/følger + [emotional noun]',
      reason: 'Personifies abstract concepts romantically',
      alternative: 'State operational fact: "Vi har vin til" or "Vi er åbne til..."',
    },
    {
      pattern: '[quality] + byder velkommen/kalder/inviterer',
      reason: 'Abstract quality as active agent',
      alternative: 'State what business does: "Vi er klar når du kommer forbi"',
    },
    {
      pattern: '[experience] + folder sig ud/transformer/glider',
      reason: 'Poetic transformation language',
      alternative: 'State programme transition: "Køkkenet lukker kl. 22, baren holder åbent"',
    },
  ],
}

/**
 * Helper function to generate the ABSOLUTTE FORBUD section text
 */
export function buildForbiddenWordsSection(forbidden: ForbiddenContent): string {
  const wordList = forbidden.absolutelyBannedWords.join(', ')
  
  return `🚫 ABSOLUTTE FORBUD — gælder ALLE output-felter uden undtagelse:
Disse ord må ALDRIG forekomme — ikke i brand_essence, ikke i caption-eksempler, ikke i target_audience, ingen steder:
${wordList}
Hvis du opdager at du er ved at bruge et af disse ord — stop og omskriv. Ingen undtagelser.`
}

/**
 * Helper function to generate META-COMMENTARY detection section
 */
export function buildMetaCommentarySection(): string {
  return `🚫 META-COMMENTARY DETECTION (applies to ALL output fields):
NEVER write about your reasoning process. Write the actual content.
❌ FORBIDDEN patterns in output fields:
  "Based on [signal]..." → just write the content that signal produces
  "Given that [fact]..." → incorporate the fact, don't announce it
  "The [field] reflects..." → write the field value, not meta-explanation
  "Drawing from [source]..." → use the source, don't cite it in output
  "Considering [context]..." → let context shape output silently
  "As indicated by..." → show the indication, don't explain it

✅ CORRECT approach:
  Proof bullets = where you explain your evidence trail
  Output field values = the actual content, no explanation

Example — brand_essence field:
❌ WRONG (meta-commentary): "Based on the waterfront location and all-day service, this café serves as..."
✅ RIGHT (direct content): "Café ved åen der er åbent fra brunch til cocktails"
   (opening label 'brunch' because opens 09:30; 'cocktails' because that is the confirmed evening drink programme)

Example — target_audience field:
❌ WRONG: "Given the tourist score and kids menu, guests include those who..."
✅ RIGHT: "Når gæster tager turen til åen som destination, når børn kan spise med..."

RULE: If a sentence starts with "Based on", "Given", "Considering", "Drawing from" → delete it and rewrite.
EXCEPTION: Proof bullets ONLY — these should cite evidence. But even proofs should be concise citations, not essays.`
}
