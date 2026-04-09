/**
 * Post2Grow Brand Strategy Model
 * 
 * CRITICAL: This is the locked four-layer strategy model.
 * Do NOT modify without understanding the entire deduction chain.
 * 
 * DEDUCTION ORDER (MUST FOLLOW):
 * 1. Core Offerings (WHAT defines business) ← menu + hours + signals
 * 2. Target Audience (WHO) ← offerings + location categories + seasonality
 * 3. Communication Goal (WHY) ← audience + business constraints
 * 4. Occasion Profiles (WHEN/WHY NOW) ← runtime context per post (NOT stored here)
 */

// ============================================================================
// LAYER 1: CORE OFFERINGS (WHAT)
// ============================================================================

/**
 * Core Offerings represent the top 3 identity patterns that define what the business IS.
 * 
 * RULES:
 * - Maximum 3 offerings (identity, not inventory)
 * - Weighted deterministically from menu + hours + signals
 * - AI can ONLY refine labels, NOT invent new offerings
 * - Never exclude offerings; use weighting instead
 */
export interface CoreOfferings {
  offerings: string[]; // Max 3, e.g., ["specialty_coffee", "weekend_brunch", "natural_wine"]
  weights: Record<string, number>; // Combined scores (0-100) by offering id
  reasoning: string[]; // Danish, explainable summary
  confidence: 'high' | 'medium' | 'low';
  generated_at: string;

  // Two-axis analysis output (new; not always present for legacy stored data)
  coreOfferingsTop3?: string[]; // Alias of offerings; explicit name for clarity
  offeringsFull?: CoreOfferingCandidate[];
  selectedWhyDa?: Record<string, string[]>; // 2-4 bullets per selected offering
  debugEvidence?: Record<string, unknown>; // Internal troubleshooting (safe, non-PII)
}

export type CoreOfferingIdentitySource =
  | 'menu_heading'
  | 'food_philosophy'
  | 'marketing_hooks'
  | 'hours_intent'
  | 'metadata_signal';

export interface CoreOfferingEvidenceCue {
  source: CoreOfferingIdentitySource;
  text: string;
  strength: 'weak' | 'strong';
}

export interface CoreOfferingEvidence {
  totalItems: number;
  matchedItems: number;
  menuShare: number; // 0..1
  matchedCategories: Array<{ category: string; count: number }>;
  availabilitySignals: string[];
  identityCues: CoreOfferingEvidenceCue[];
  identitySources: CoreOfferingIdentitySource[];
}

export interface CoreOfferingCandidate {
  id: string;
  availabilityScore: number; // 0..100
  identityScore: number; // 0..100
  combinedScore: number; // 0..100
  eligible: boolean;
  evidence: CoreOfferingEvidence;
  whyDa: string[]; // 2-4 Danish bullets (non-technical)
}

// ============================================================================
// LAYER 2: TARGET AUDIENCE (WHO)
// ============================================================================

/**
 * Target Audience pool is FIXED. Max 2 primary audiences.
 * No personas. No demographics. Never "everyone".
 * 
 * POOL (locked): locals, families, office_workers, students, social_groups, tourists
 * 
 * Seasonal audiences are ADDITIVE ONLY (never replace identity audiences).
 */
export type TargetAudienceType = 
  | 'locals'           // Nearby residents who frequent the area
  | 'families'         // Parents with children (inferred from menu/hours)
  | 'office_workers'   // Weekday lunch/coffee crowd
  | 'students'         // University-area casual crowd
  | 'social_groups'    // Friend groups for evening/weekend social occasions
  | 'tourists';        // Visitors exploring the area

export interface TargetAudience {
  primary: TargetAudienceType[]; // Max 2, identity-stable
  seasonal: SeasonalAudienceModifier[]; // Additive modifiers per season
  reasoning: string[]; // Why these audiences were selected
  confidence: 'high' | 'medium' | 'low';
}

export type SeasonId = "winter" | "shoulder" | "summer";

export interface SeasonalAudienceModifier {
  season: SeasonId;
  additional_audiences: TargetAudienceType[]; // ADDITIVE ONLY
  reasoning: string; // Why this audience is boosted in this season
}

// ============================================================================
// LAYER 3: COMMUNICATION GOAL (WHY)
// ============================================================================

/**
 * Communication Goal is FIXED POOL. Exactly ONE goal per business.
 * This is strategic, not tactical. Stable over time.
 * 
 * POOL (locked): drive_visits, increase_bookings, build_local_awareness, fill_off_peak
 */
export type CommunicationGoalType =
  | 'drive_visits'              // Increase foot traffic (walk-ins)
  | 'increase_bookings'         // Drive reservations/advance bookings
  | 'build_local_awareness'     // New/rebranding, need visibility
  | 'fill_off_peak';            // Optimize capacity during slow periods

export interface CommunicationGoal {
  goal: CommunicationGoalType;
  reasoning: string[]; // Why this goal fits the business
  confidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// LAYER 4: OCCASION PROFILES (WHEN/WHY NOW)
// ============================================================================

/**
 * Occasion Profiles are DYNAMIC and RUNTIME ONLY.
 * 
 * CRITICAL: Do NOT store occasion profiles in brand profile.
 * They are selected PER POST based on:
 * - Current date/time
 * - Weather
 * - Local events
 * - Business context (e.g., quiet Monday vs busy Friday)
 * 
 * ONE occasion per post suggestion.
 */
export type OccasionProfileId = string; // e.g., "weekday_morning_coffee", "friday_after_work", "rainy_weekend_brunch"

// ============================================================================
// COMPLETE BRAND STRATEGY
// ============================================================================

/**
 * Complete brand strategy stored in business_brand_profile table.
 * 
 * NOTE: This does NOT include occasion profiles (those are per-post runtime).
 */
export interface BrandStrategy {
  business_id: string;
  
  // Layer 1: WHAT
  core_offerings: CoreOfferings;
  
  // Layer 2: WHO
  target_audience: TargetAudience;
  
  // Layer 3: WHY
  communication_goal: CommunicationGoal;
  
  // Metadata
  locale: string; // e.g., 'da-DK', 'en-US' (for content generation)
  version: string; // Strategy model version
  generated_at: string;
  approved_by_user: boolean; // User can review/approve
}

// ============================================================================
// DEDUCTION INPUTS (FROM DATABASE)
// ============================================================================

/**
 * Input data collected from various tables for strategy deduction.
 */
export interface StrategyDeductionInputs {
  // From menu_items + business_menu_metadata
  menu: {
    categories: Record<string, number>; // category → count
    avgPrice: number;
    hasAlcohol: boolean;
    hasTakeaway: boolean;
    foodPhilosophy?: string;
    dietaryOptions: string[];
    hasSpecialtyCoffee: boolean;
    hasWineList: boolean;
  };
  
  // From opening_hours
  hours: {
    opensWeekdays: boolean;
    opensWeekends: boolean;
    hasBreakfast: boolean; // Opens before 10am
    hasLunch: boolean; // Open 11am-3pm
    hasDinner: boolean; // Open after 6pm
    hasLateNight: boolean; // Open after 10pm
  };
  
  // From business_location_intelligence
  location: {
    areaType: string; // waterfront, city_centre, student, tourist, etc.
    categoryScores: Record<string, number>; // All 9 location categories with scores
    neighborhood: string;
    marketingHooks: string[];
    scoreSource: "areaTypeOnly" | "fullScores"; // Track whether we have full scores or fallback
  };
  
  // Runtime context
  context: {
    season: SeasonId;
    generatedAt: string; // ISO timestamp for traceability
  };
  
  // From businesses
  // UPDATED: Supports both legacy string and new hybrid structure
  businessType: string | { primary: string; secondary?: string[]; hybridLabel?: string; cuisineType?: string; conceptTags?: string[] };
  locale: string; // da-DK, en-US, etc.
}
