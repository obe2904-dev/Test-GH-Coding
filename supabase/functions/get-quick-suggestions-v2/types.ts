// types.ts
// TypeScript interfaces for segmentation-driven Quick Suggestions v2

/**
 * Audience segment definition
 * Describes who visits, when, why, and with what content angles
 */
export interface AudienceSegment {
  name: string
  program: string  // "BRUNCH", "FROKOST", "AFTEN", "MENUKORT"
  timing: {
    days: number[]      // [0-6] where 0=Sunday, 1=Monday, etc.
    startHour: number   // 17.5 = 17:30
    endHour: number     // 21.5 = 21:30
  }
  priority: 'primary' | 'secondary' | 'niche'
  motivation: string              // e.g., "social_gathering", "convenience"
  decision: 'spontaneous' | 'planned' | 'mixed'
  goal: 'drive_footfall' | 'strengthen_brand'
  contentAngles: string[]
  
  // Metadata for edge case handling
  requiresKitchen?: boolean   // true = food service, false = drinks/atmosphere
  minLeadTime?: number        // minutes needed before service starts (default 30)
  maxActiveTime?: number      // stop suggesting X mins before end (default 60)
}

/**
 * Segments data from business_audience_segments table
 */
export interface BusinessSegments {
  segments: AudienceSegment[]
  audience_breadth?: string
  business_model_type?: string
  primary_copy_hook?: string
}

/**
 * Menu item from menu_results_v2 or menu_signal
 */
export interface MenuItem {
  name: string
  description: string
  category?: string
  language?: string  // ISO 639-1 language code (da, en, sv, etc.)
  program?: string  // Which program this belongs to
}

/**
 * Menu data organized by program
 */
export interface MenuData {
  items: MenuItem[]
  programs: string[]  // e.g., ["BRUNCH", "FROKOST", "AFTEN"]
}

/**
 * Recently posted item for recency tracking
 */
export interface RecentPost {
  name: string
  posted_at: string
  daysAgo: number
}

/**
 * Weather context
 */
export interface WeatherData {
  temp: number
  conditions: string
  suitable_for_outdoor: boolean
}

/**
 * Calendar event
 */
export interface CalendarEvent {
  name: string
  date: string
  marketing_hook?: string
}

/**
 * Context for segment matching
 */
export interface SegmentMatchContext {
  segment: AudienceSegment
  isPreOpening: boolean          // Planning ahead for next service
  isNearClosing: boolean         // Service ending soon
  minutesUntilStart: number
  minutesUntilEnd: number
  weatherContext?: WeatherData
  specialEvents?: CalendarEvent[]
}

/**
 * Menu suggestion output (simplified - no brand voice)
 */
export interface MenuSuggestion {
  menu_item_name: string
  why_now: string                 // Why this item fits current context
  posting_angle: string           // Which content angle/hook to use
  suggested_time: string          // HH:MM format
  context_reasoning?: string      // Contextual explanation with day/time/weather (paid tier feature)
  alternative_timings?: Array<{   // Alternative posting times (paid tier feature)
    time: string                  // HH:MM format
    reasoning: string             // Why this time works
  }>
}

/**
 * API Request
 */
export interface QuickSuggestionsRequest {
  businessId: string
  count?: number        // 1-3 suggestions
  tier?: string         // 'free' | 'standardplus' | 'premium'
  regenerate?: boolean
  clientTime?: string   // ISO string of client local time
  userContext?: string  // Optional user-provided context
}

/**
 * API Response
 */
export interface QuickSuggestionsResponse {
  suggestions: MenuSuggestion[]
  cached: boolean
  segment_used: string
  generation_context?: string   // For debugging
  weatherForecast?: any
}

/**
 * Business data
 */
export interface Business {
  id: string
  name: string
  vertical: string
  country?: string
  kitchenCloseTime?: string
}

/**
 * Context for building AI prompt
 */
export interface PromptContext {
  segment: AudienceSegment
  menu: MenuItem[]
  recentPosts: RecentPost[]
  weather?: WeatherData
  events?: CalendarEvent[]
  isPreOpening: boolean
  isNearClosing: boolean
  count: number
}

/**
 * Tier configuration
 */
export interface TierConfig {
  dailyLimit: number
  features: {
    segmentation: boolean
  }
}
