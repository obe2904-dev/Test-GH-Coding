// Shared types for get-quick-suggestions function
// Extracted June 24, 2026

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Request & Response Types ──────────────────────────────────────────────────

export interface QuickSuggestionsRequest {
  businessId: string
  count?: number
  tier?: 'free' | 'starter' | 'pro'
  regenerate?: boolean
  localTime?: string
  clientTime?: string
  localDate?: string
  userContext?: string
  debug?: boolean
}

export interface QuickSuggestionsResponse {
  suggestions: Suggestion[]
  cached?: boolean
  weatherForecast?: WeatherForecast | null
  plannerRationale?: string
  weeklyPlanIdeas?: WeeklyPlanIdea[]
  debug?: DebugInfo
}

export interface Suggestion {
  id: string
  why_explanation: string
  occasion_context?: string | null
  photo_idea: string
  media_suggestion?: string | null
  content_type: string
  suggested_time: string
  suggestion_date: string
  slot: string
  menu_item_name: string
  menu_item_description: string
  cta_intent: string
}

export interface WeatherForecast {
  city: string
  temperature: string
  conditions: string
  tier?: string
  score?: number
  recommendation?: string
}

export interface WeeklyPlanIdea {
  title: string
  rationale: string
  content_type: string
}

export interface DebugInfo {
  tier: string
  regenerate: boolean
  count: number
  effectiveSlotCount?: number
  slotCount?: number
  isSocialDeadZone?: boolean
  generatedSuggestionCount?: number
  activeSlotTypes?: string[]
  slotExpectedContentTypes?: Record<string, string>
  cachedSuggestionCount?: number
}

// ── Database Row Types ────────────────────────────────────────────────────────

export interface BusinessRow {
  name: string
  vertical: string  // Extracted from business_type_hybrid.primary
  business_type_hybrid?: { primary: string; secondary?: string[]; hybridLabel?: string; cuisineType?: string; conceptTags?: string[] }
  website_url?: string
  country: string
  local_location_reference?: string
}

export interface OperationsRow {
  has_outdoor_seating: boolean
  has_kids_menu: boolean
  has_takeaway: boolean
  price_level?: number
}

export interface OpeningHoursRow {
  monday_open?: string | null
  monday_close?: string | null
  tuesday_open?: string | null
  tuesday_close?: string | null
  wednesday_open?: string | null
  wednesday_close?: string | null
  thursday_open?: string | null
  thursday_close?: string | null
  friday_open?: string | null
  friday_close?: string | null
  saturday_open?: string | null
  saturday_close?: string | null
  sunday_open?: string | null
  sunday_close?: string | null
  kitchen_open_time?: string | null
  kitchen_close_time?: string | null
}

export interface LocationRow {
  address?: string
  city?: string
  postal_code?: string
  country?: string
  latitude?: number
  longitude?: number
}

export interface MenuItem {
  id: string
  name: string
  description?: string
  menu_category?: string
  price?: number
  currency?: string
  availability_days?: string | null
  service_period?: string | null
  dietary_info?: string[]
  allergens?: string[]
  key_ingredients?: string[]
}

export interface MenuProgram {
  id: string
  programme_name: string
  time_window_start: string
  time_window_end: string
  operating_days?: string[]
  menu_items?: string[]
}

export interface BrandProfileRow {
  id: string
  voice_archetype?: any
  tone_of_voice?: any
  tone_model?: any
  business_character?: any
  tone_keywords?: string[]
  personality_traits?: string[]
  things_to_avoid?: any
  content_strategy_confirmed?: boolean
  v5_business_identity?: any
  v5_brand_voice?: any
}

export interface RecentSuggestion {
  id: string
  title: string
  content_type: string
  created_at: string
  menu_item_name?: string
  menu_item_id?: string
  photo_idea?: string
  status: string
}

export interface CachedSuggestion extends RecentSuggestion {
  why_explanation: string
  occasion_context?: string | null
  photo_idea: string
  media_suggestion?: string | null
  suggested_time: string
  position: number
  menu_item_description?: string
  cta_intent?: string
  weather_forecast?: any
  planner_rationale?: string
}

// ── Business Context Types ────────────────────────────────────────────────────

export interface BusinessContext {
  business: BusinessRow
  operations: OperationsRow | null
  openingHours: OpeningHoursRow | null
  location: LocationRow | null
  menuItems: MenuItem[]
  programs: MenuProgram[]
  brandProfile: BrandProfileRow | null
  recentSuggestions: RecentSuggestion[]
  language: string
}

// ── Day Behavior Types ────────────────────────────────────────────────────────

export interface DayBehavior {
  mode: string
  danishMode: string
  emphasis: string
  avoidPushFootfall: boolean
  offeringTone: string
  slotBDefault: string
  slotCDefault: string
}

// ── Cache Management Types ────────────────────────────────────────────────────

export interface CacheCheckResult {
  shouldUseCache: boolean
  cachedSuggestions?: CachedSuggestion[]
  skipReason?: 'regenerate_requested' | 'stale' | 'corrupt' | 'not_found' | 'error'
}

export interface CacheValidationOptions {
  businessId: string
  today: string
  count: number
  clientNow: Date
  regenerate: boolean
  supabase: SupabaseClient
  debug?: boolean
}

// ── Helper Function Types ─────────────────────────────────────────────────────

export interface ProgramRef {
  name: string
  start: string
  end: string
}

export interface TimeCalculationContext {
  contentType: string
  title: string
  todayOpenTime?: string | null
  todayCloseTime?: string | null
  kitchenCloseTime?: string | null
  programs?: ProgramRef[]
  nowOverrideMins?: number
}
