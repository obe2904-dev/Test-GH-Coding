/**
 * Tone-safe naturalness pass using gpt-4o-mini.
 *
 * Approach: holistic native-reader evaluation, NOT a rule checklist.
 * The model reads the text as a native speaker would and identifies anything
 * that feels unnatural (collocation, compound nouns, typos). If everything
 * sounds natural it responds with the single token PASS — no fix attempted.
 * This scales to any language without maintaining per-language example lists.
 *
 * Only fixes things a native speaker would immediately notice as wrong.
 * Never changes tone, style, register, sentence structure, CTA, or emojis.
 * Returns original text unchanged on any error (never throws).
 */
export async function silentCorrect(
  text: string,
  language: string,
  brandTone: string,
  apiKey: string
): Promise<string> {
  const langNames: Record<string, string> = {
    da: 'Danish', sv: 'Swedish', de: 'German', en: 'English',
    nb: 'Norwegian', nl: 'Dutch', fi: 'Finnish', fr: 'French', es: 'Spanish'
  }
  const langName = langNames[language] ?? 'Danish'

  const toneGuard = brandTone
    ? `\n\nBrand tone (READ-ONLY — you may NOT change the writing style): ${brandTone.substring(0, 150)}`
    : ''

  const systemPrompt = `You are a native ${langName} speaker doing a final read of a social media post before it goes live.

Step 1 — Read the entire text naturally, as a native ${langName} speaker would read it.
Ask yourself: "Does every phrase, word combination, and adjective feel completely natural in ${langName}? Would a native speaker ever write this?"

Step 2 — Decision:
- If everything sounds completely natural and correct: respond with exactly the word PASS and nothing else.
- If something sounds unnatural or wrong (e.g. a word combination no native speaker would use, a split compound noun that should be one word, an obvious AI-generated typo): fix ONLY that specific issue and return the corrected text.

When in doubt about whether something is wrong — respond PASS. Only fix what is clearly wrong to any native speaker.

You may NEVER:
- Change tone, style, or writing register
- Rephrase or restructure sentences  
- Change word choices unless they are clearly unnatural to a native speaker
- Alter CTA text, emojis, or hashtags
- Add or remove sentences

One additional fix you MUST make if present:
- " - " or " – " used as a stylistic connector between sentence parts (e.g. "great food – great vibe – book now") is an AI writing tell. Replace it with natural sentence structure. This is the only restructuring you are allowed to perform.${toneGuard}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0,
        max_tokens: 400
      })
    })
    if (!res.ok) return text
    const data = await res.json()
    const result = data.choices?.[0]?.message?.content?.trim()

    // PASS = model found nothing wrong → return original unchanged
    if (!result || result === 'PASS') return text

    // Accept corrected text only if it's plausibly a version of the original
    // (non-empty, not drastically longer than original)
    if (result.length > 10 && result.length < text.length * 1.3) {
      return result
    }
    return text
  } catch {
    return text
  }
}
