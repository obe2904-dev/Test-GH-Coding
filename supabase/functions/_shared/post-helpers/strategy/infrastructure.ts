/**
 * INFRASTRUCTURE: Retry helpers and spelling correction.
 * Used by Phase 0, 1, 2a, 2b, 2c.
 */

import { callGemini } from '../../gemini-client.ts';

// @ts-ignore - Deno global
declare const Deno: any;

// ============================================================
// RETRY CONFIGURATION
// ============================================================

export const MAX_JSON_RETRIES = 3;
export const MIN_VALID_JSON_LENGTH = 50;

// ============================================================
// SILENT SPELLING CORRECTION
// ============================================================

/**
 * Silent spelling correction using existing OpenAI-powered spelling function.
 * Auto-corrects Danish spelling/grammar errors and Swedish/Norwegian contamination.
 */
export async function silentSpellingCorrection(text: string, language: string = 'da'): Promise<string> {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return text;
  }

  if (text.trim().length < 3) {
    return text;
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      console.warn('[Spelling] No OPENAI_API_KEY - skipping correction');
      return text;
    }

    const systemPrompt = `You are a native Danish speaker doing a final read of a marketing text before it goes live.

Step 1 — Read the text naturally. Ask yourself: "Is there an obvious typo, a split compound noun that should be one word, or a Swedish/Norwegian word that crept in?"

Step 2 — Decision:
- If everything looks correct to a native Danish speaker: respond with exactly the word PASS and nothing else.
- If you find ONLY one of these specific errors — a split compound noun, an obvious typo, or a non-Danish word — fix ONLY that issue and return the corrected text.

When in doubt — respond PASS. Only fix what is clearly wrong to any native Danish speaker.

You may NEVER:
- Change grammar, sentence structure, or word order
- Rephrase or restructure sentences
- Change tone, style, register, or word choices
- Add or remove words, sentences, or punctuation
- "Improve" text that is already acceptable

Non-Danish words to replace if present:
- "fika", "hverdagsfika", "fredagsfika" → "kaffepause"
- "koselig" → "hyggelig"
- "kos" (as Norwegian hygge substitute) → "hygge"
- "lagom" → "passende"
- "gott" → "godt"
- "gokk" → "lækkert"

Return ONLY the corrected text. No commentary or analysis.`;

    const userPrompt = text;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0,
        max_completion_tokens: 600
      })
    });

    if (!response.ok) {
      console.error(`[Spelling] OpenAI API error: ${response.status}`);
      return text;
    }

    const data = await response.json();
    const corrected = data?.choices?.[0]?.message?.content?.trim();

    // PASS = model found nothing wrong → return original unchanged
    if (!corrected || corrected === 'PASS') return text;

    // Accept corrected text only if it's plausibly a minimal fix of the original
    if (corrected.length > 5 && corrected.length < text.length * 1.2) {
      if (corrected !== text.trim()) {
        console.log(`[Spelling] Corrected: "${text.substring(0, 50)}..." → "${corrected.substring(0, 50)}..."`);
      }
      return corrected;
    }

    return text;
  } catch (error) {
    console.error('[Spelling] Error during correction:', error);
    return text;
  }
}

// ============================================================
// GEMINI RETRY WRAPPER
// ============================================================

/**
 * Retry a Gemini API call with JSON parsing if it fails.
 *
 * RETRY TRIGGERS:
 * - JSON parse error (SyntaxError)
 * - Empty/truncated output (< 50 chars)
 * - Invalid object structure
 *
 * NO RETRY FOR:
 * - Valid JSON with schema errors (handled by validation)
 */
export async function callGeminiWithRetry(
  prompt: string,
  options: any,
  phase: 'Phase 0' | 'Phase 1' | 'Phase 2' | 'Phase 2a' | 'Phase 2b' | 'Phase 2c' | 'Weekly Modulator',
  maxRetries = MAX_JSON_RETRIES
): Promise<{ rawText: string; parsed: any }> {
  let lastError: Error | null = null;
  let retryReason: string | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[${phase}] Attempt ${attempt}/${maxRetries}`);

      const adjustedOptions = attempt === 1 ? options : {
        ...options,
        temperature: 0,
        maxOutputTokens: Math.floor(options.maxOutputTokens * 1.5),
      };

      const rawText = await callGemini(prompt, adjustedOptions);

      if (!rawText || rawText.trim().length < MIN_VALID_JSON_LENGTH) {
        retryReason = rawText?.length === 0 ? 'empty_output' : 'output_too_short';
        throw new Error(`Output too short (${rawText?.length || 0} chars) - likely truncated`);
      }

      const cleaned = rawText.replace(/```json|```/g, '').trim();
      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseError) {
        retryReason = 'json_parse_error';
        console.error(`[${phase}] JSON parse error on attempt ${attempt}:`, parseError);
        console.error(`[${phase}] Raw text length: ${rawText.length}`);
        console.error(`[${phase}] First 600 chars: ${rawText.substring(0, 600)}`);
        if (rawText.length > 600) {
          console.error(`[${phase}] Around position 435: ...${rawText.substring(400, 480)}...`);
        }
        throw parseError;
      }

      if (!parsed || typeof parsed !== 'object') {
        retryReason = 'invalid_json_structure';
        throw new Error('Parsed JSON is not valid');
      }

      console.log(`[${phase}] Successful parse on attempt ${attempt}`);
      if (attempt > 1) {
        console.log(`[${phase}] ✅ RETRY SUCCESS - Recovered from ${retryReason} on attempt 1`);
      }
      return { rawText, parsed };

    } catch (error) {
      lastError = error as Error;
      console.error(`[${phase}] Attempt ${attempt}/${maxRetries} failed:`, {
        reason: retryReason || 'unknown_error',
        error: lastError.message
      });

      if (attempt < maxRetries) {
        const baseDelay = 400;
        const jitter = Math.floor(Math.random() * 400);
        const delayMs = baseDelay + jitter;
        console.log(`[${phase}] Retrying with temp=0 and +50% tokens in ${delayMs}ms... (reason: ${retryReason})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  console.error(`[${phase}] ❌ All ${maxRetries} attempts failed (reason: ${retryReason})`);
  throw new Error(`${phase} JSON parse failed after ${maxRetries} attempts: ${lastError?.message}`);
}
