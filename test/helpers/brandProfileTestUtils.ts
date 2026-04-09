/**
 * Shared test utilities for brand profile offline regression tests.
 */

/**
 * Collects all user-facing text fields from a brand profile output into a
 * single lowercase string — suitable for forbidden-phrase scanning.
 *
 * Works with both:
 *   - BrandProfile objects (edge function output, before DB write): { brand_essence: { value: "..." } }
 *   - DB rows (after saveBrandProfile): { brand_essence: "..." }
 */
export function collectText(out: any): string {
  const parts: string[] = []

  // BrandVariable format (edge function output)
  if (out?.brand_essence?.value)         parts.push(out.brand_essence.value)
  if (out?.tone_of_voice?.value)         parts.push(out.tone_of_voice.value)
  if (out?.target_audience?.value)       parts.push(out.target_audience.value)
  if (out?.core_offerings?.value)        parts.push(out.core_offerings.value)
  if (out?.content_focus?.value)         parts.push(out.content_focus.value)
  if (out?.cta_style?.value)             parts.push(out.cta_style.value)
  if (out?.communication_goal?.value)    parts.push(out.communication_goal.value)
  if (out?.image_preferences?.signature_shot) parts.push(out.image_preferences.signature_shot)

  // Flat DB-row format (snapshot files from business_brand_profile)
  if (typeof out?.brand_essence === 'string')      parts.push(out.brand_essence)
  if (typeof out?.tone_of_voice === 'string')      parts.push(out.tone_of_voice)
  if (typeof out?.target_audience === 'string')    parts.push(out.target_audience)
  if (typeof out?.core_offerings === 'string')     parts.push(out.core_offerings)
  if (typeof out?.content_focus === 'string')      parts.push(out.content_focus)
  if (typeof out?.cta_style === 'string')          parts.push(out.cta_style)
  if (typeof out?.communication_goal === 'string') parts.push(out.communication_goal)

  return parts.join('\n').toLowerCase()
}

/**
 * Counts words in a string.
 */
export function wordCount(s: string): number {
  return (s || '').trim().split(/\s+/).filter(Boolean).length
}

/**
 * Demographic persona words that must never appear in target_audience.value.
 * These describe WHO people are, not WHEN/HOW they behave.
 */
export const PERSONA_BANNED_WORDS = [
  'familier',
  'børnefamilier',
  'par',
  'venner',
  'turister',
  'studerende',
  'lokale',
  'unge',
  'voksne',
  'seniorer',
]

/**
 * Throws if a demographic persona word appears in target_audience text.
 */
export function assertNoPersonas(targetAudienceValue: string): void {
  const v = (targetAudienceValue || '').toLowerCase()
  for (const w of PERSONA_BANNED_WORDS) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(v)) {
      throw new Error(`Persona word found in target_audience.value: "${w}"`)
    }
  }
}

/**
 * Universal forbidden phrases — must never appear regardless of business context.
 * Mirrors UNIVERSAL_FORBIDDEN in brand-profile-generator/index.ts.
 */
export const UNIVERSAL_FORBIDDEN_PATTERNS: RegExp[] = [
  /\bi hjertet af\b/i,
  /\bnoget for enhver smag\b/i,
  /\blokalt forankret\b/i,
  /\bkvalitetsbevidst\b/i,
  /\brammerne for\b/i,
  /\bvi skaber\b/i,
  /\bvi tilbyder\b/i,
  /\bfokus på\b/i,
]

/**
 * Conditional forbidden words — blocked unless the business uses them 2+ times
 * on their own website (mirrors CONDITIONAL_FORBIDDEN in index.ts).
 */
export const CONDITIONAL_FORBIDDEN_WORDS = ['oplevelse', 'oplevelser', 'unik', 'unikke', 'lækker', 'lækkert', 'lækre']

/**
 * Asserts no universal forbidden phrases appear in the collected text.
 * Does NOT check conditional words (those require allowedSet context).
 */
export function assertNoUniversalForbidden(text: string, label = 'output'): void {
  for (const re of UNIVERSAL_FORBIDDEN_PATTERNS) {
    if (re.test(text)) {
      throw new Error(`Universal forbidden phrase in ${label} (matched: ${re}): snippet = "${text.slice(0, 120)}…"`)
    }
  }
}
