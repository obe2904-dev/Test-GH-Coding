// AI client for get-quick-suggestions
// Handles Gemini API communication with structured JSON responses
// Extracted June 24, 2026

/**
 * Options for calling the Gemini API
 */
export interface GeminiCallOptions {
  /** The API key for Gemini API authentication */
  apiKey: string
  /** System instruction to guide the model's behavior */
  systemInstruction: string
  /** The user prompt for this specific request */
  userPrompt: string
  /** Label for logging (e.g., "SlotA", "SlotB") */
  slotLabel: string
  /** Fallback object to return if the call fails */
  fallback: any
  /** Maximum output tokens (default: 4096) */
  maxTokens?: number
  /** Temperature for generation (default: 0.85) */
  temperature?: number
}

/**
 * Calls Gemini API with structured JSON response handling
 * 
 * Makes a single request to Gemini 2.5 Flash, parses the JSON response,
 * and returns a suggestion object. If the call fails or response is invalid,
 * returns the provided fallback object.
 * 
 * @param options - Configuration for the Gemini API call
 * @returns Parsed suggestion object or fallback on error
 */
export async function callGemini(options: GeminiCallOptions): Promise<any> {
  const {
    apiKey,
    systemInstruction,
    userPrompt,
    slotLabel,
    fallback,
    maxTokens = 4096,
    temperature = 0.85,
  } = options

  // Debug logging if enabled
  if (Deno.env.get('DEBUG_PROMPT_LOGGING') === 'true') {
    console.log(`═══ PROMPT [${slotLabel}] ═══\n`, userPrompt)
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text()
      console.error(`❌ Gemini API Error [${slotLabel}]:`, errorText)
      return fallback
    }

    const gData = await geminiRes.json()
    const rText: string | undefined = gData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!rText) {
      console.error(`❌ Empty Gemini response [${slotLabel}]`)
      return fallback
    }

    // Clean up markdown code blocks and extract JSON
    const clean = rText
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')

    const s = clean.indexOf('{')
    const e = clean.lastIndexOf('}')

    if (s < 0 || e < 0) {
      console.error(`❌ Unparseable [${slotLabel}]:`, rText.substring(0, 300))
      return fallback
    }

    const parsed = JSON.parse(clean.slice(s, e + 1))
    console.log(`✅ [${slotLabel}] OK: "${parsed.title}"`)

    return parsed
  } catch (err) {
    console.error(`❌ [${slotLabel}] exception:`, err)
    return fallback
  }
}

/**
 * Validates that the Gemini API key is configured
 * 
 * @throws Error if GEMINI_API_KEY environment variable is not set
 * @returns The validated API key
 */
export function getGeminiApiKey(): string {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured')
  }
  return apiKey
}

/**
 * Calls Gemini API expecting a JSON array response (for unified prompts)
 * 
 * Similar to callGemini but parses an array of suggestions instead of a single object.
 * Used for unified Slot B+C calls that return multiple suggestions at once.
 * 
 * @param options - Configuration for the Gemini API call
 * @returns Array of parsed suggestion objects, or array of fallbacks on error
 */
export async function callGeminiArray(options: GeminiCallOptions & { fallbacks: any[] }): Promise<any[]> {
  const {
    apiKey,
    systemInstruction,
    userPrompt,
    slotLabel,
    fallback, // Legacy single fallback (unused)
    fallbacks,
    maxTokens = 6144, // Higher token limit for multiple suggestions
    temperature = 0.85,
  } = options

  // Debug logging if enabled
  if (Deno.env.get('DEBUG_PROMPT_LOGGING') === 'true') {
    console.log(`═══ PROMPT [${slotLabel}] ═══\n`, userPrompt)
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text()
      console.error(`❌ Gemini API Error [${slotLabel}]:`, errorText)
      return fallbacks
    }

    const gData = await geminiRes.json()
    const rText: string | undefined = gData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!rText) {
      console.error(`❌ Empty Gemini response [${slotLabel}]`)
      return fallbacks
    }

    // Clean up markdown code blocks and extract JSON array
    const clean = rText
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')

    const s = clean.indexOf('[')
    const e = clean.lastIndexOf(']')

    if (s < 0 || e < 0) {
      console.error(`❌ Unparseable array [${slotLabel}]:`, rText.substring(0, 300))
      return fallbacks
    }

    const parsed = JSON.parse(clean.slice(s, e + 1))
    
    if (!Array.isArray(parsed)) {
      console.error(`❌ Response is not an array [${slotLabel}]`)
      return fallbacks
    }

    console.log(`✅ [${slotLabel}] OK: ${parsed.length} suggestions`)
    parsed.forEach((s, i) => {
      console.log(`   ${i + 1}. "${s.title || 'untitled'}"`)
    })

    return parsed
  } catch (err) {
    console.error(`❌ [${slotLabel}] exception:`, err)
    return fallbacks
  }
}
