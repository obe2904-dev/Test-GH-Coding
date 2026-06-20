/**
 * Gemini API Client
 * Handles all Gemini Flash API calls
 */

// Declare Deno global for edge runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.5-flash';  // Working model from available list

interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    thinkingConfig?: { thinkingBudget: number };  // NEW: Thinking mode support
  };
}

export async function callGemini(
  prompt: string,
  options: {
    temperature?: number;
    maxOutputTokens?: number;  // Explicit token limit for structured output
    jsonMode?: boolean;
    model?: string;  // NEW: Allow model override
    thinkingConfig?: { thinkingBudget: number };  // NEW: Thinking mode support
  } = {}
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const model = options.model || GEMINI_MODEL;
  const maxOutputTokens = options.maxOutputTokens ?? 4096;  // Never rely on defaults
  
  console.log(`[Gemini Client] Calling model: ${model}`);
  console.log(`[Gemini Client] Options:`, { 
    temperature: options.temperature ?? 0.3,
    maxOutputTokens,
    jsonMode: options.jsonMode,
    thinkingBudget: options.thinkingConfig?.thinkingBudget,
    promptLength: prompt.length 
  });

  const request: GeminiRequest = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      maxOutputTokens,  // Explicit token limit
      ...(options.jsonMode && { responseMimeType: 'application/json' }),
      thinkingConfig: options.thinkingConfig ?? { thinkingBudget: 0 },  // Default: disable thinking to avoid billing surprise
    },
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Gemini] API Error:', error);
      throw new Error(`Gemini API failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Handle both old-style and thinking mode responses
    const parts = data.candidates?.[0]?.content?.parts;
    
    if (!parts || parts.length === 0) {
      console.error('[Gemini] No content parts in response:', JSON.stringify(data));
      throw new Error('No content parts in Gemini response');
    }

    // Extract text - handle both thinking mode and regular responses
    let responseText = '';
    
    // Filter out thinking parts if present (have thought: true)
    const textParts = parts.filter((p: any) => !p.thought && p.text);
    
    if (textParts.length > 0) {
      // Thinking mode or mixed response
      responseText = textParts.map((p: any) => p.text).join('');
      if (parts.length > textParts.length) {
        console.log(`[Gemini Client] Filtered ${parts.length - textParts.length} thinking parts`);
      }
    } else if (parts[0]?.text) {
      // Regular response (no thinking mode)
      responseText = parts[0].text;
    } else {
      console.error('[Gemini] No text content in parts:', JSON.stringify(parts));
      throw new Error('No text content in Gemini response');
    }

    if (!responseText || responseText.trim().length === 0) {
      console.error('[Gemini] Empty text content');
      throw new Error('Empty text content in Gemini response');
    }

    console.log(`[Gemini Client] Successfully received response (${responseText.length} chars)`);
    return responseText;
  } catch (error) {
    console.error('[Gemini Client] Request failed:', error);
    throw error;
  }
}

export async function callGeminiJSON<T>(
  prompt: string,
  options: {
    temperature?: number;
    maxOutputTokens?: number;  // Explicit token limit for structured output
    model?: string;  // NEW: Allow model override
    thinkingConfig?: { thinkingBudget: number };  // NEW: Thinking mode support
  } = {}
): Promise<T> {
  const responseText = await callGemini(prompt, {
    ...options,
    jsonMode: true,
  });

  try {
    // Gemini sometimes wraps JSON in markdown code blocks
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    return JSON.parse(cleanedText);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Gemini] JSON parse error. Raw response:', responseText);
    throw new Error(`Failed to parse Gemini JSON response: ${errorMessage}\n\nRaw response: ${responseText.substring(0, 500)}`);
  }
}
