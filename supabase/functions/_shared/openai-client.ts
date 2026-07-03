/**
 * OpenAI API Client
 * Handles GPT-4o API calls with same interface as gemini-client.ts
 */

// Declare Deno global for edge runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export async function callOpenAI(
  prompt: string,
  options: {
    temperature?: number;
    maxOutputTokens?: number;
    jsonMode?: boolean;
    model?: string;
  } = {}
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const model = options.model || 'gpt-4o';
  const maxOutputTokens = options.maxOutputTokens ?? 4096;
  
  console.log(`[OpenAI Client] Calling model: ${model}`);
  console.log(`[OpenAI Client] Options:`, { 
    temperature: options.temperature ?? 0.3,
    maxOutputTokens,
    jsonMode: options.jsonMode,
    promptLength: prompt.length 
  });

  const request: OpenAIRequest = {
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: maxOutputTokens,
    ...(options.jsonMode && { response_format: { type: 'json_object' } }),
  };

  try {
    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[OpenAI] API Error:', error);
      throw new Error(`OpenAI API failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      console.error('[OpenAI] Unexpected response structure:', JSON.stringify(data));
      throw new Error('Invalid OpenAI response structure');
    }

    // Log token usage
    if (data.usage) {
      console.log(`[OpenAI Client] Token usage:`, {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
        total: data.usage.total_tokens,
      });
    }

    console.log(`[OpenAI Client] Successfully received response (${data.choices[0].message.content.length} chars)`);
    return data.choices[0].message.content;
  } catch (error) {
    console.error('[OpenAI Client] Request failed:', error);
    throw error;
  }
}
