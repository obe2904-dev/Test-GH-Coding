/**
 * Browser/Node-compatible forbidden phrase gate.
 *
 * Mirrors the UNIVERSAL_FORBIDDEN + CONDITIONAL_FORBIDDEN logic in
 * supabase/functions/brand-profile-generator/index.ts — kept in sync manually.
 *
 * Used by:
 *   - test/brand-profile.regression.test.ts  (Vitest, offline snapshots)
 *   - Can be imported by any Node tooling or CI scripts
 *
 * NOT used by the edge function itself (Deno has its own copy to avoid
 * cross-runtime import complexity).
 */

/** Phrases that are NEVER acceptable regardless of business tone. */
const UNIVERSAL_FORBIDDEN: RegExp[] = [
  /\bi hjertet af\b/i,
  /\bnoget for enhver smag\b/i,
  /\blokalt forankret\b/i,
  /\bkvalitetsbevidst\b/i,
  /\brammerne for\b/i,
  /\bvi skaber\b/i,
  /\bvi tilbyder\b/i,
  /\bfokus på\b/i,
]

/** Words blocked unless the business uses them 2+ times on their own website. */
const CONDITIONAL_FORBIDDEN: { re: RegExp; key: string }[] = [
  { re: /\boplevelse(r)?\b/i, key: 'oplevelser' },
  { re: /\bunik(ke)?\b/i,     key: 'unik' },
  { re: /\blækker(t|e)?\b/i,  key: 'lækker' },
]

/**
 * Checks a single text field.
 * Throws a descriptive Error if a forbidden phrase is found.
 *
 * @param text       The field value to check.
 * @param field      Field name for error messages.
 * @param allowedSet Words the business is allowed to use (from their own website).
 */
export function checkField(
  text: string,
  field: string,
  allowedSet: Set<string> = new Set()
): void {
  for (const re of UNIVERSAL_FORBIDDEN) {
    if (re.test(text)) {
      throw new Error(
        `Forbidden phrase in ${field} (matched: ${re}): "${text.slice(0, 100)}…"`
      )
    }
  }

  for (const { re, key } of CONDITIONAL_FORBIDDEN) {
    if (!re.test(text)) continue
    const baseForms = [key, key.replace(/r$/, ''), key.replace(/e$/, '')]
    if (baseForms.some(f => allowedSet.has(f))) continue
    throw new Error(
      `Forbidden conditional word in ${field} ("${key}" not found 2+ times on website): "${text.slice(0, 100)}…"`
    )
  }
}

/**
 * Runs the full forbidden-phrase gate against all user-facing fields in a
 * brand profile output object.
 *
 * Accepts both BrandVariable format { brand_essence: { value: "..." } }
 * and flat DB-row format { brand_essence: "..." }.
 *
 * @param out        Brand profile output (edge function BrandProfile or DB row).
 * @param allowedSet Words the business is allowed to use (optional, empty = strict mode).
 */
export function runForbiddenGate(out: any, allowedSet: Set<string> = new Set()): void {
  const pick = (field: string): string => {
    const v = out?.[field]
    if (typeof v === 'string') return v
    if (v && typeof v === 'object' && typeof v.value === 'string') return v.value
    return ''
  }

  const fields: string[] = [
    'brand_essence',
    'tone_of_voice',
    'target_audience',
    'core_offerings',
    'content_focus',
    'cta_style',
    'communication_goal',
  ]

  for (const field of fields) {
    const text = pick(field)
    if (text) checkField(text, field, allowedSet)
  }

  // signature_shot lives nested in image_preferences
  const shot = out?.image_preferences?.signature_shot
  if (typeof shot === 'string' && shot) {
    checkField(shot, 'image_preferences.signature_shot', allowedSet)
  }
}
