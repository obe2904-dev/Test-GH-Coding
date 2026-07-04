/**
 * Brand Profile Generator - OpenAI Client
 * 
 * Robust OpenAI API client with timeout, retry logic, and exponential backoff.
 * Handles rate limits, transient errors, and provides structured logging.
 */

import type { OpenAIConfig } from './types.ts'

// ============================================================================
// CUSTOM ERROR TYPES
// ============================================================================

/**
 * Custom error class for OpenAI HTTP errors
 * Carries status code and retry timing information
 */
export class OpenAIHttpError extends Error {
  status: number
  retryAfterMs?: number

  constructor(status: number, message: string, retryAfterMs?: number) {
    super(message)
    this.name = 'OpenAIHttpError'
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export const DEFAULT_OPENAI_CONFIG: OpenAIConfig = {
  timeout: 60000,        // 60 seconds (increased from 45s to reduce Prompt A timeouts)
  maxRetries: 3,         // Retry up to 3 times
  retryDelayMs: 1000,    // Base delay for exponential backoff
  retryStatusCodes: [429, 500, 502, 503, 504]  // Rate limit + server errors
}

// Alias for backwards compatibility
export const OPENAI_CONFIG = DEFAULT_OPENAI_CONFIG

export const AI_MODELS = {
  analysis: 'gpt-4o-mini', // Prompt A - internal analysis (fast, sufficient quality)
  generation: 'gpt-4o'     // Prompt B - user-facing generation
} as const

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate unique request ID for traceability
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `bp-${timestamp}-${random}`
}

/**
 * Sleep helper for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// OPENAI FETCH WITH RETRY
// ============================================================================

export interface OpenAIRequestOptions {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  max_tokens?: number
  response_format?: { type: 'json_object' | 'text' }
}

export interface OpenAIResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Fetch from OpenAI with timeout and retry logic
 */
export async function fetchOpenAIWithRetry(
  apiKey: string,
  options: OpenAIRequestOptions,
  requestId: string,
  context: string,
  config: OpenAIConfig = DEFAULT_OPENAI_CONFIG
): Promise<OpenAIResponse> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeout)
    
    try {
      const startTime = Date.now()
      console.log(`[${requestId}] 🔄 ${context} attempt ${attempt}/${config.maxRetries}`)
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      const duration = Date.now() - startTime
      
      // Check for retryable status codes
      if (config.retryStatusCodes.includes(response.status)) {
        let delay: number
        let retryAfterMs: number | undefined
        
        if (response.status === 429) {
          // Read Retry-After header (in seconds)
          const retryAfterHeader = response.headers.get('retry-after')
          
          if (retryAfterHeader) {
            // Use header value with random jitter (0-500ms)
            const retryAfterSeconds = parseInt(retryAfterHeader, 10)
            const jitter = Math.floor(Math.random() * 500)
            delay = (retryAfterSeconds * 1000) + jitter
            retryAfterMs = delay
          } else {
            // Exponential backoff with jitter, capped at 15000ms
            const baseDelay = config.retryDelayMs * Math.pow(2, attempt - 1)
            const jitter = Math.floor(Math.random() * 500)
            delay = Math.min(baseDelay + jitter, 15000)
            retryAfterMs = delay
          }
          
          console.warn(`[${requestId}] ⚠️ ${context} rate limited (429), retrying in ${delay}ms...`)
          
          // Store as OpenAIHttpError for final throw if all retries fail
          lastError = new OpenAIHttpError(429, `OpenAI returned 429: Rate limit exceeded`, retryAfterMs)
        } else {
          // Other retryable errors: use exponential backoff
          const jitter = Math.floor(Math.random() * 500)
          delay = (config.retryDelayMs * Math.pow(2, attempt - 1)) + jitter
          console.warn(`[${requestId}] ⚠️ ${context} got ${response.status}, retrying in ${delay}ms...`)
          lastError = new Error(`OpenAI returned ${response.status}`)
        }
        
        await sleep(delay)
        continue
      }
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI API error ${response.status}: ${errorText}`)
      }
      
      const data = await response.json() as OpenAIResponse
      console.log(`[${requestId}] ✅ ${context} completed in ${duration}ms (status: ${response.status})`)
      
      return data
      
    } catch (error) {
      clearTimeout(timeoutId)
      const err = error as Error
      
      if (err.name === 'AbortError') {
        console.error(`[${requestId}] ⏱️ ${context} timeout after ${config.timeout}ms`)
        lastError = new Error(`OpenAI request timed out after ${config.timeout}ms`)
      } else {
        console.error(`[${requestId}] ❌ ${context} error:`, err.message)
        lastError = err
      }
      
      if (attempt < config.maxRetries) {
        const delay = config.retryDelayMs * Math.pow(2, attempt - 1)
        console.log(`[${requestId}] 🔄 Retrying in ${delay}ms...`)
        await sleep(delay)
      }
    }
  }
  
  throw lastError || new Error(`${context} failed after ${config.maxRetries} attempts`)
}

/**
 * High-level function to call OpenAI chat completion
 */
export async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  options: {
    model?: string
    temperature?: number
    maxTokens?: number
    jsonMode?: boolean
    requestId?: string
    context?: string
  } = {}
): Promise<string> {
  const {
    model = AI_MODELS.generation,
    temperature = 0.3,
    maxTokens = 4000,
    jsonMode = true,
    requestId = generateRequestId(),
    context = 'OpenAI call'
  } = options
  
  const response = await fetchOpenAIWithRetry(
    apiKey,
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode && { response_format: { type: 'json_object' } })
    },
    requestId,
    context
  )
  
  return response.choices[0]?.message?.content || ''
}

/**
 * Parse JSON response from OpenAI, handling common issues
 */
export function parseOpenAIJson<T>(content: string): T {
  // Clean up common formatting issues
  let cleaned = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  
  // Handle potential leading/trailing text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    cleaned = jsonMatch[0]
  }
  
  try {
    return JSON.parse(cleaned) as T
  } catch (error) {
    console.error('Failed to parse OpenAI JSON response:', content.substring(0, 200))
    throw new Error(`Invalid JSON response from OpenAI: ${(error as Error).message}`)
  }
}
