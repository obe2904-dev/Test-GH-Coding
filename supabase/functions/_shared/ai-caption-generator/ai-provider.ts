/**
 * AI Provider Abstraction Layer
 * Allows easy switching between Gemini and OpenAI (GPT-4o-mini)
 */

// Declare Deno global for edge runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

import { callGeminiJSON } from '../gemini-client.ts'

// ============================================================================
// CONFIGURATION
// ============================================================================

// Per-Feature AI Provider Configuration
// Allows using different models for different tasks (cost vs quality optimization)
export type AIFeature = 
  | 'brand-profile'      // Strategic brand generation (needs depth)
  | 'caption'            // Social media captions (fast, cheap)
  | 'photo-idea'         // Photo content ideas
  | 'menu-extract'       // Menu extraction from images
  | 'location-analysis'  // Location intelligence
  | 'concept-fit'        // Concept-location fit analysis
  | 'post-ideas'         // Weekly post idea generation
  | 'default'            // Fallback for other features

export const FEATURE_AI_CONFIG: Record<AIFeature, { provider: 'gemini' | 'openai', model: string }> = {
  'brand-profile': {
    provider: 'openai',
    model: 'gpt-4o'  // Generation (Prompt B): gpt-4o. Analysis (Prompt A) + JSON fixers: gpt-4o-mini
  },
  'caption': {
    provider: 'openai',
    model: 'gpt-4o'  // Better instruction-following for quality captions (v17 upgrade)
  },
  'photo-idea': {
    provider: 'gemini',
    model: 'gemini-2.5-flash'  // Stable model for creative photo ideas (production-ready)
  },
  'menu-extract': {
    provider: 'openai',
    model: 'gpt-4o-mini'  // Good at structured extraction
  },
  'location-analysis': {
    provider: 'openai',
    model: 'gpt-4o'  // Actual: claude-analyzer.ts + populate-location-intelligence use OpenAI directly
  },
  'concept-fit': {
    provider: 'openai',
    model: 'gpt-4o'  // Actual: analyze-concept-fit edge function uses OpenAI directly
  },
  'post-ideas': {
    provider: 'gemini',
    model: 'gemini-2.5-flash'  // Cost-effective for bulk ideas
  },
  'default': {
    provider: 'openai',
    model: 'gpt-4o-mini'  // Safe default
  }
}

// Legacy support - defaults to 'default' feature config
export const AI_PROVIDER: 'gemini' | 'openai' = FEATURE_AI_CONFIG.default.provider
export const AI_MODELS = {
  gemini: 'gemini-2.0-flash-exp',
  openai: 'gpt-4o-mini'
} as const

// Available models for configuration:
// Gemini: gemini-2.0-flash-exp, gemini-2.5-flash, gemini-exp-1206
// OpenAI: gpt-4o-mini, gpt-4o, gpt-4-turbo

// ============================================================================
// OPENAI CLIENT
// ============================================================================

async function callOpenAI<T>(
  prompt: string,
  options: {
    temperature?: number
    maxTokens?: number
    model?: string  // Allow custom model override
  } = {}
): Promise<T> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const model = options.model || AI_MODELS.openai
  console.log(`[OpenAI] Calling ${model} (temp=${options.temperature ?? 0.7}, maxTokens=${options.maxTokens ?? 4096})`)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[OpenAI] API Error:', error)
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  
  // Log token usage
  if (data.usage) {
    console.log(`[OpenAI] Tokens used:`, {
      prompt: data.usage.prompt_tokens,
      completion: data.usage.completion_tokens,
      total: data.usage.total_tokens,
      cost: estimateOpenAICost(data.usage.prompt_tokens, data.usage.completion_tokens)
    })
  }

  const content = data.choices[0]?.message?.content
  if (!content) {
    throw new Error('No content in OpenAI response')
  }

  try {
    return JSON.parse(content) as T
  } catch (e) {
    console.error('[OpenAI] Failed to parse JSON response:', content)
    const errorMessage = e instanceof Error ? e.message : String(e)
    throw new Error(`Invalid JSON from OpenAI: ${errorMessage}`)
  }
}

function estimateOpenAICost(promptTokens: number, completionTokens: number): string {
  // GPT-4o-mini pricing: $0.150 / 1M input tokens, $0.600 / 1M output tokens
  const inputCost = (promptTokens / 1_000_000) * 0.150
  const outputCost = (completionTokens / 1_000_000) * 0.600
  const total = inputCost + outputCost
  return `$${total.toFixed(6)}`
}

// ============================================================================
// UNIFIED INTERFACE
// ============================================================================

export async function callAI<T>(
  prompt: string,
  options: {
    temperature?: number
    maxTokens?: number
    feature?: AIFeature  // NEW: Specify which feature is calling
    model?: string       // NEW: Override model completely
  } = {}
): Promise<T> {
  // Determine which provider and model to use
  let provider: 'gemini' | 'openai'
  let model: string

  if (options.model) {
    // Explicit model override - detect provider from model name
    model = options.model
    provider = model.startsWith('gpt') || model.startsWith('o1') ? 'openai' : 'gemini'
    console.log(`[AI] Using explicit model override: ${model}`)
  } else if (options.feature) {
    // Use feature-specific configuration
    const config = FEATURE_AI_CONFIG[options.feature]
    provider = config.provider
    model = config.model
    console.log(`[AI] Feature '${options.feature}' using: ${provider} ${model}`)
  } else {
    // Fallback to default configuration
    const config = FEATURE_AI_CONFIG.default
    provider = config.provider
    model = config.model
    console.log(`[AI] Using default: ${provider} ${model}`)
  }

  // Call appropriate provider
  if (provider === 'openai') {
    return callOpenAI<T>(prompt, { ...options, model })
  } else {
    return callGeminiJSON<T>(prompt, { ...options, model, maxOutputTokens: options.maxTokens })
  }
}

export function getActiveProvider(feature?: AIFeature): string {
  if (feature) {
    const config = FEATURE_AI_CONFIG[feature]
    return `${config.provider} ${config.model}`
  }
  return AI_PROVIDER === 'openai' 
    ? `OpenAI ${AI_MODELS.openai}` 
    : `Gemini ${AI_MODELS.gemini}`
}
