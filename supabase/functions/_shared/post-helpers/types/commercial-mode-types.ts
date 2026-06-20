// ============================================================
// COMMERCIAL MODE SYSTEM - TYPE DEFINITIONS
// ============================================================
// Priority Issue 1: Commercial Objective Governance
// Generated: 5. maj 2026
// ============================================================

/**
 * Commercial mode classification for weekly strategy.
 * Determines minimum commercial idea quotas and prompt emphasis.
 */
export type CommercialMode = 
  | 'booking_push'   // Reservation-focused week (Valentine's, Mother's Day, etc.)
  | 'footfall_push'  // Visit-driving focus (weather opportunities, first weekend, etc.)
  | 'balanced';      // Normal week with mixed commercial objectives

/**
 * Intent classification for individual post ideas.
 * Drives CTA type, timing urgency, and conversion hook requirements.
 */
export type CommercialIntent =
  | 'booking'     // Drive table reservations / appointments
  | 'footfall'    // Drive walk-in visits / immediate action
  | 'brand'       // Build brand awareness / identity
  | 'loyalty';    // Retain / reward existing customers

/**
 * Specific call-to-action type for post ideas.
 * More granular than CommercialIntent - defines the exact action requested.
 */
export type CTAType =
  | 'reserve_table'     // Make a reservation
  | 'book_appointment'  // Book a service (hair, spa, etc.)
  | 'visit_today'       // Come in today
  | 'visit_this_week'   // Visit within the week
  | 'check_menu'        // View menu/offerings
  | 'try_new_item'      // Sample specific menu item
  | 'limited_time'      // Time-limited offer
  | 'join_event'        // Attend an event
  | 'join_community'    // Follow/engage on social
  | 'share_experience'  // User-generated content request
  | 'leave_review'      // Review request
  | 'browse_offerings'; // General awareness (weakest CTA)

/**
 * Timing urgency for conversion actions.
 * Defines when the customer should act.
 */
export type TimingWindow =
  | 'today'         // Immediate action (hours)
  | 'this_week'     // Within current week
  | 'this_weekend'  // Upcoming weekend
  | 'next_week'     // Following week
  | 'this_month'    // Within month
  | 'ongoing';      // No specific urgency (weakest)

/**
 * Expected business outcome from the post idea.
 * Used to validate that idea serves business objectives.
 */
export type ExpectedOutcome =
  | 'table_reservation'    // Confirmed booking
  | 'appointment_booking'  // Service booking
  | 'walk_in_visit'        // In-person visit
  | 'product_purchase'     // Sale
  | 'menu_inquiry'         // Menu engagement
  | 'event_attendance'     // Event participation
  | 'brand_awareness'      // Reach/visibility
  | 'customer_retention'   // Loyalty/repeat
  | 'social_engagement'    // Likes/shares/comments
  | 'user_content';        // UGC generation

/**
 * Commercial metadata for individual post ideas.
 * Extends PostIdea interface with commercial enforcement fields.
 */
export interface PostIdeaCommercial {
  commercial_intent: CommercialIntent;
  cta_type: CTAType;
  timing_window: TimingWindow;
  conversion_hook: string;  // One-sentence reason to act now
  expected_outcome: ExpectedOutcome;
  commercial_clarity_score: number; // 1-5 scale (set by validation)
}

/**
 * Commercial mode determination output.
 * Result of classifier analyzing week context + business triggers.
 */
export interface CommercialModeDirective {
  commercial_mode: CommercialMode;
  trigger_reason: string;  // Human-readable explanation
  triggered_by: string[];  // Trigger IDs that fired (e.g., ['VD_WEEK', 'LOCAL_EVENT'])
  min_booking_ideas: number;
  min_footfall_ideas: number;
  required_cta_types: CTAType[]; // Suggested/required CTAs for this mode
  timing_urgency: 'immediate' | 'this_week' | 'flexible';
  booking_window_days?: number; // How far in advance to start booking push (e.g., 21 for Valentine's)
}

/**
 * Individual trigger configuration for a business.
 * Stored in business_brand_profile.trigger_configuration JSONB.
 */
export interface TriggerConfig {
  enabled: boolean;
  mode?: CommercialMode | 'context_dependent'; // Mode to activate when triggered
  min_booking_ideas?: number;  // Override global defaults
  min_footfall_ideas?: number; // Override global defaults
  reasoning?: string;          // Why this trigger matters for this business
  booking_window_days?: number; // How many days before event to activate
  priority?: number;           // Override system priority (higher = more important)
  custom_rules?: Record<string, any>; // Business-specific logic
}

/**
 * Business trigger configuration.
 * Complete trigger policy for a single business.
 * Stored in business_brand_profile.trigger_configuration.
 */
export type BusinessTriggerConfiguration = Record<string, TriggerConfig>;

/**
 * Trigger catalog entry.
 * Master definition of available triggers.
 */
export interface TriggerCatalogEntry {
  trigger_id: string;
  trigger_name: string;
  category: 'event' | 'temporal' | 'seasonal' | 'contextual';
  description: string;
  default_applicability: string[]; // Business types/categories this applies to
  default_mode: CommercialMode | 'context_dependent';
  default_min_booking: number;
  default_min_footfall: number;
  is_active: boolean;
  system_priority: number; // Higher = more important
  created_at: string;
  updated_at: string;
}

/**
 * Commercial validation result for individual idea.
 */
export interface IdeaValidationResult {
  idea_id: number;
  commercial_intent: CommercialIntent;
  commercial_clarity_score: number; // 1-5
  has_cta: boolean;
  has_timing: boolean;
  has_conversion_hook: boolean;
  passes_threshold: boolean; // Score >= 3
  issues: string[]; // Specific problems
}

/**
 * Commercial validation result for entire strategy.
 */
export interface CommercialValidationResult {
  passed: boolean;
  score: number; // Average commercial clarity (0-5)
  idea_scores: IdeaValidationResult[];
  booking_ideas_count: number;
  footfall_ideas_count: number;
  brand_ideas_count: number;
  loyalty_ideas_count: number;
  quota_met: boolean;
  quota_requirements: {
    min_booking_ideas: number;
    min_footfall_ideas: number;
    actual_booking_ideas: number;
    actual_footfall_ideas: number;
  };
  issues: string[]; // Overall problems
  warnings: string[]; // Non-blocking concerns
}

/**
 * Extended PostIdea with commercial fields.
 * This extends the existing PostIdea interface from strategy-types.ts
 */
export interface PostIdeaWithCommercial extends PostIdeaCommercial {
  id: number;
  title: string;
  rationale: string;
  content_type: string;
  suggested_day: string;
  suggested_time: string;
  // ... all other PostIdea fields
}

/**
 * Commercial mode context for prompt generation.
 * Injected into Phase 1/2 prompts to enforce commercial objectives.
 */
export interface CommercialPromptContext {
  mode: CommercialMode;
  mode_explanation: string;
  min_booking_ideas: number;
  min_footfall_ideas: number;
  required_fields: Array<{
    field: string;
    requirement: string;
  }>;
  priority_hierarchy: string[]; // Ordered list of priorities
  example_ctas: CTAType[]; // Suggested CTAs for this mode
}

/**
 * Classifier input context.
 * Everything the classifier needs to determine commercial mode.
 */
export interface ClassifierContext {
  business_id: string;
  week_start: Date;
  week_end: Date;
  business_type: string;
  has_reservation_system: boolean;
  commercial_baseline_mode: CommercialMode;
  trigger_configuration: BusinessTriggerConfiguration | null;
  contextual_calendar: Array<{
    date: Date;
    event: string;
    commercial_weight: number;
    booking_relevance?: number;
  }>;
  weather_forecast?: Array<{
    date: Date;
    temp_high: number;
    conditions: string;
  }>;
  week_number: number;
  month: number;
  first_weekend_of_month: boolean;
  is_payday_period: boolean;
}

/**
 * Database row types for new/extended tables
 */
export interface WeeklyStrategyRow {
  id: string;
  business_id: string;
  week_number: number;
  week_start: string;
  week_end: string;
  narrative: any;
  strategic_priorities: any;
  post_ideas: any;
  selected_idea_ids: number[] | null;
  week_context_snapshot: any;
  business_type: string;
  country: string;
  status: 'generated' | 'ideas_selected' | 'posts_created';
  
  // Commercial mode fields (new)
  commercial_mode: CommercialMode | null;
  commercial_mode_reason: string | null;
  triggered_by: string[] | null;
  min_booking_ideas: number;
  min_footfall_ideas: number;
  commercial_validation_score: number | null;
  commercial_validation_details: CommercialValidationResult | null;
  commercial_validation_passed: boolean | null;
  commercial_override_reason: string | null;
  
  generated_at: string;
}

export interface BusinessBrandProfileRow {
  business_id: string;
  // ... existing fields
  
  // Commercial mode fields (new)
  trigger_configuration: BusinessTriggerConfiguration | null;
  commercial_baseline_mode: CommercialMode;
  trigger_last_updated: string | null;
  trigger_updated_by: string | null;
}
