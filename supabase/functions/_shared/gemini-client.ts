/**
 * Gemini API Client
 * Handles all Gemini 2.5 Flash API calls
 */

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.0-flash-exp';

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
  };
}

export async function callGemini(
  prompt: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  } = {}
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const request: GeminiRequest = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.3, // Low temp for structured analysis
      maxOutputTokens: options.maxTokens ?? 2048,
      ...(options.jsonMode && { responseMimeType: 'application/json' }),
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
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
  
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    console.error('[Gemini] Unexpected response structure:', JSON.stringify(data));
    throw new Error('Invalid Gemini response structure');
  }

  return data.candidates[0].content.parts[0].text;
}

export async function callGeminiJSON<T>(
  prompt: string,
  options: {
    temperature?: number;
    maxTokens?: number;
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
    console.error('[Gemini] JSON parse error. Raw response:', responseText);
    throw new Error(`Failed to parse Gemini JSON response: ${error.message}`);
  }
}
