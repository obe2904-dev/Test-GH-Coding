/**
 * Tone-safe naturalness pass using gpt-4o-mini.
 * 
 * VERSION: v5.1.6 (2026-06-14)
 * 
 * v5.1.6 CRITICAL FIX: Added explicit guard for subordinate clauses
 *   - Prevents truncation of grammatically correct compound sentences
 *   - Example bug: "Vi har åbent, og du er velkommen, når du er klar" → "Vi har åbent, og."
 *   - Root cause: Rule #5 was treating "når" clauses as incomplete sentences
 *   - Fix: Added CRITICAL note after Rule #5 to preserve sentences with når/da/mens/selvom/fordi/eftersom
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
- Rephrase or restructure sentences unless required by one of the explicit fixes below
- Change word choices unless they are clearly unnatural to a native speaker
- Alter CTA text, emojis, or hashtags
- Add or remove sentences unless required by one of the explicit fixes below

Additional fixes you MUST make if present (these are the ONLY exceptions to the rules above):
1. " - ", " – ", or " — " (hyphen, en-dash, or em-dash) used as a stylistic connector between sentence parts (e.g. "great food — great vibe — book now", "Vi har åbent — og du er velkommen") is an AI writing tell. Replace with proper sentence structure (use period + capital letter).
2. A period appearing mid-sentence where the following word is lowercase (e.g. "Smagen er. fantastisk" → "Smagen er fantastisk"). Remove the misplaced period.
3. A sentence that ends abruptly with an open conjunction or preposition (with or without emoji), leaving it grammatically incomplete (e.g. "Kom og", "Tag med til", "Vi har åbent. Og 🥑."). Remove the incomplete fragment entirely — do not try to complete it. Examples:
   - "Vi har åbent. Og 🥑." → "Vi har åbent."
   - "Kom forbi. Men" → "Kom forbi."
   - "Tag med til" → "Tag med."
4. Danish compound words split with hyphen where they should be joined (e.g. "menu-kort" → "menukort", "brunch-tilbud" → "brunchtilbud", "morgen-mad" → "morgenmad"). Join them unless it's a proper noun or a compound that requires hyphen by Danish orthography rules (e.g. "e-mail", "non-stop" are correct with hyphen).
5. Run-on sentence: two independent clauses joined without proper punctuation (e.g. "Køkkenet lukker tidligt baren holder" should be "Køkkenet lukker tidligt — baren holder åben" or split into two sentences). Insert appropriate punctuation (em dash, period, or semicolon) and complete any incomplete clause.

CRITICAL: Sentences containing subordinate clauses introduced by "når", "mens", "da", "selvom", "fordi", "eftersom" are NOT incomplete or run-on sentences — these are grammatically correct compound sentences. Do NOT truncate them. Example: "Vi har åbent, og du er velkommen, når du er klar" is a complete, correct sentence. DO NOT change it.${toneGuard}`

  try {
    const scController = new AbortController()
    const scTimeoutId = setTimeout(() => scController.abort(), 8000)
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      signal: scController.signal,
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
    clearTimeout(scTimeoutId)
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
