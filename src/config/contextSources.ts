/**
 * Context Sources Configuration
 * 
 * Defines all available context data sources, categories, and functionality profiles.
 * This enables intelligent context assembly based on tier and use case.
 */

import type { UserTier } from './features'

/**
 * Categories of context data
 */
export type ContextCategory = 
  | 'business'           // User's business data (menu, hours, location, etc.)
  | 'external-static'    // Time-invariant external data (holidays, seasons, etc.)
  | 'external-dynamic'   // Real-time external data (weather, transit, trends)
  | 'user-preferences'   // User settings (language, tone, target audience)
  | 'platform-specific'  // Platform requirements (Instagram vs Facebook)

/**
 * Cost categories for context sources
 */
export type ContextCost = 'free' | 'low' | 'medium' | 'high'

/**
 * Context source definition
 */
export interface ContextSource {
  id: string
  category: ContextCategory
  priority: number        // 1-10, determines inclusion order (higher = more important)
  cost: ContextCost       // Token/API cost estimation
  cacheable: boolean      // Can this data be cached?
  ttl?: number           // Cache duration in seconds (if cacheable)
  requiredTier?: UserTier // Minimum tier required (undefined = all tiers)
}

/**
 * Business context fields available
 */
export type BusinessContextField = 
  | 'name'
  | 'type'
  | 'vertical'
  | 'location'
  | 'address'
  | 'city'
  | 'country'
  | 'hours'
  | 'basic-hours'
  | 'menu'
  | 'menu-highlights'
  | 'menu-full'
  | 'website'
  | 'description'
  | 'long-description'
  | 'short-description'
  | 'target-audience'
  | 'vibe'
  | 'tone'
  | 'unique-selling-points'
  | 'key-offerings'

/**
 * External static data sources
 */
export type ExternalStaticSource = 
  | 'major-holidays'      // Major holidays only
  | 'holidays'            // All holidays including local
  | 'seasons'             // Current season
  | 'local-events'        // Local events calendar
  | 'trends'              // Industry trends
  | 'day-time'            // Current day/time context

/**
 * External dynamic data sources (require API calls)
 */
export type ExternalDynamicSource = 
  | 'weather-basic'       // Current conditions only
  | 'weather-forecast'    // 7-day forecast
  | 'nearby-transit'      // Nearby public transit (triggered by address)
  | 'nearby-attractions'  // Tourist attractions nearby
  | 'competitor-analysis' // Local competitor data
  | 'real-time-events'    // Real-time events happening now

/**
 * Context access configuration per tier
 */
export interface ContextAccess {
  business: BusinessContextField[] | 'all'
  externalStatic: ExternalStaticSource[]
  externalDynamic: ExternalDynamicSource[]
  maxTokens: number
  apiLimits?: Record<string, number> // API call limits per day (-1 = unlimited)
}

/**
 * Functionality-specific context profiles
 * Defines what context is required/optional for each feature
 */
export interface ContextProfile {
  required: string[]      // Must have these fields
  optional: string[]      // Include if available and tier allows
  triggers: string[]      // Trigger patterns (e.g., "address->nearby-transit")
  excludeStatic?: ExternalStaticSource[]  // Exclude these even if tier allows
  excludeDynamic?: ExternalDynamicSource[] // Exclude these even if tier allows
}

/**
 * Context profiles for each functionality
 */
export const CONTEXT_PROFILES: Record<string, ContextProfile> = {
  'post-generation': {
    required: ['business.name', 'business.type'],
    optional: [
      'business.menu',
      'business.vibe',
      'business.location',
      'external-static.holidays',
      'external-static.seasons',
      'external-static.day-time',
      'external-dynamic.weather-basic',
      'external-dynamic.nearby-transit'
    ],
    triggers: [
      'address->nearby-transit',
      'location->weather-basic',
      'season->seasonal-items'
    ]
  },
  
  'menu-parsing': {
    required: ['business.type', 'business.location'],
    optional: ['business.existing-menu'],
    triggers: [], // No external triggers for menu parsing
    excludeStatic: ['trends', 'local-events'],
    excludeDynamic: ['weather-basic', 'weather-forecast', 'competitor-analysis']
  },
  
  'website-analysis': {
    required: ['business.website'],
    optional: ['business.type', 'business.location'],
    triggers: [],
    excludeDynamic: ['weather-basic', 'weather-forecast', 'nearby-transit']
  },
  
  'content-optimization': {
    required: ['business.name', 'business.type', 'business.target-audience'],
    optional: [
      'business.menu',
      'business.tone',
      'external-static.trends',
      'external-dynamic.competitor-analysis'
    ],
    triggers: ['location->competitor-analysis']
  }
}

/**
 * Available context sources catalog
 */
export const CONTEXT_SOURCES: Record<string, ContextSource> = {
  // Business sources
  'business.name': {
    id: 'business.name',
    category: 'business',
    priority: 10,
    cost: 'free',
    cacheable: true,
    ttl: 3600
  },
  'business.type': {
    id: 'business.type',
    category: 'business',
    priority: 10,
    cost: 'free',
    cacheable: true,
    ttl: 3600
  },
  'business.menu': {
    id: 'business.menu',
    category: 'business',
    priority: 8,
    cost: 'low',
    cacheable: true,
    ttl: 1800
  },
  'business.location': {
    id: 'business.location',
    category: 'business',
    priority: 7,
    cost: 'free',
    cacheable: true,
    ttl: 3600
  },
  
  // External static sources
  'external-static.holidays': {
    id: 'external-static.holidays',
    category: 'external-static',
    priority: 6,
    cost: 'free',
    cacheable: true,
    ttl: 86400 // 24 hours
  },
  'external-static.seasons': {
    id: 'external-static.seasons',
    category: 'external-static',
    priority: 5,
    cost: 'free',
    cacheable: true,
    ttl: 86400 // 24 hours
  },
  'external-static.day-time': {
    id: 'external-static.day-time',
    category: 'external-static',
    priority: 7,
    cost: 'free',
    cacheable: false // Always real-time
  },
  
  // External dynamic sources
  'external-dynamic.weather-basic': {
    id: 'external-dynamic.weather-basic',
    category: 'external-dynamic',
    priority: 8,
    cost: 'medium',
    cacheable: true,
    ttl: 3600, // 1 hour
    requiredTier: 'premium'
  },
  'external-dynamic.nearby-transit': {
    id: 'external-dynamic.nearby-transit',
    category: 'external-dynamic',
    priority: 6,
    cost: 'medium',
    cacheable: true,
    ttl: 86400, // 24 hours
    requiredTier: 'standardplus'
  },
  'external-dynamic.competitor-analysis': {
    id: 'external-dynamic.competitor-analysis',
    category: 'external-dynamic',
    priority: 4,
    cost: 'high',
    cacheable: true,
    ttl: 604800, // 7 days
    requiredTier: 'premium'
  }
}
