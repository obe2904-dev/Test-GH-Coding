// constants.ts
// Configuration constants for Quick Suggestions v2

import type { TierConfig } from './types.ts'

/**
 * Tier-based daily regeneration limits
 * TESTING MODE: All set to 100 for testing
 * Production values in comments
 */
export const TIER_LIMITS: Record<string, TierConfig> = {
  free: {
    dailyLimit: 100,  // TESTING (Production: 3)
    features: {
      segmentation: true
    }
  },
  standardplus: {
    dailyLimit: 100,  // TESTING (Production: 3)
    features: {
      segmentation: true
    }
  },
  premium: {
    dailyLimit: 100,  // TESTING (Production: 5)
    features: {
      segmentation: true
    }
  }
}

/**
 * Timing constants
 */
export const TIMING = {
  // Cache staleness threshold (hours)
  CACHE_STALE_HOURS: 1.5,
  
  // Recency tracking
  RECENT_POSTS_LOOKBACK_DAYS: 14,
  
  // Segment timing buffers
  DEFAULT_MIN_LEAD_TIME: 30,      // mins before service start
  DEFAULT_MAX_ACTIVE_TIME: 60,    // mins before service end to stop suggesting
  
  // Kitchen close buffer for food items
  KITCHEN_CLOSE_BUFFER_MINS: 60,
  
  // Minimum future buffer for posting time
  MIN_FUTURE_BUFFER_MINS: 15,
}

/**
 * Day names for logging and display
 */
export const DAY_NAMES = {
  da: ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
}

/**
 * Country to language code mapping
 */
export const COUNTRY_TO_LANG: Record<string, string> = {
  'Denmark': 'da',
  'Danmark': 'da',
  'Norway': 'no',
  'Norge': 'no',
  'Sweden': 'sv',
  'Sverige': 'sv',
  'Germany': 'de',
  'Finland': 'fi',
}

/**
 * Default language fallback
 */
export const DEFAULT_LANGUAGE = 'da'

/**
 * AI configuration
 */
export const AI_CONFIG = {
  MODEL: 'gemini-2.5-flash',  // Same as v1
  TEMPERATURE: 0.85,
  MAX_OUTPUT_TOKENS: 8192,
  RESPONSE_MIME_TYPE: 'application/json'
}

/**
 * CORS headers
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
