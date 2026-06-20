// ============================================================
// LAYER 0: STRATEGIC ANALYSIS - TYPE DEFINITIONS
// ============================================================

// Platform types
export type Platform = 'facebook' | 'instagram';

/**
 * Output of the Strategy Modulator — injected into WeekContext.brand_voice.content_strategy
 * before Phase 1 runs. Drives slot counts via assignSlotMetadata().
 */
export interface WeeklyModulation {
  week_goal_blend: {
    drive_footfall: number;
    build_brand: number;
    retain_loyalty: number;
  };
  week_content_category_weights: {
    product_menu: number;
    craving_visual: number;
    behind_scenes: number;
    team_people: number;
  };
  /** 1–2 sentences in Danish — shown to the business owner in the weekly plan UI */
  week_strategic_rationale: string;
  /** Which signals drove the adjustment (for logging / debugging) */
  modulation_factors: string[];
}

// Subscription tier types
export type SubscriptionTier = 'smart' | 'pro';

// What the user wants to achieve with the post's call-to-action
export type CTAIntent = 
  | 'booking'        // Drive reservations/bookings
  | 'engagement'     // Likes, comments, shares
  | 'awareness'      // Brand visibility, reach
  | 'event_promo'    // Event attendance
  | 'traffic';       // Drive to website/menu

// Media type that Layer 0 suggests per idea
// 'photo_reel' = system-generated Reel from 1-3 photos via FFmpeg (no extra user effort)
export type SuggestedMediaType = 'photo' | 'photo_reel' | 'carousel';

export interface SuggestedMedia {
  type: SuggestedMediaType;
  direction: string;   // Creative direction, e.g. "Nærbillede af retten med naturligt lys"
  why: string;         // Why this media type, e.g. "Reels får 2x mere rækkevidde end statiske billeder"
  photo_count?: number; // For photo_reel: how many photos needed (1-4). For carousel: number of slides.
}

// Business Type Definitions (adapted to match existing system)
export type BusinessTypeCode =
  | 'FSE'           // Fine Service Establishment (fine dining)
  | 'SBO'           // Specialized Beverage Outlet (wine/coffee/cocktail bars)
  | 'SBO_wine'      // Wine bar / wine shop
  | 'SBO_coffee'    // Coffee shop / café
  | 'SBO_cocktail'  // Cocktail bar / bar
  | 'MFV'           // Multiple Format Venue
  | 'MFD'           // Multiple per Day
  | 'QSR'           // Quick Service Restaurant
  | 'FOOD_TRUCK'    // Food truck
  | 'HYBRID';       // Multiple types (blended strategy)

export interface HybridWeighting {
  types: BusinessTypeCode[];
  weights: Record<BusinessTypeCode, number>; // e.g. { SBO_coffee: 0.6, SBO_wine: 0.4 }
  derivedFrom: 'service_periods'; // Always automatic, never manual
}

/**
 * Derived structural archetype — deterministically assigned from service_periods,
 * late_night_closing, and menu_programmes. More granular than BusinessTypeCode.
 * Used for archetype-aware slot timing guidance in Phase 1.
 */
export type BusinessArchetype =
  | 'fine_dining'
  | 'casual_dining'
  | 'cafe_bistro'
  | 'cafe_bar'           // Hybrid: cafe by day, bar by night
  | 'restaurant_bar'     // Full-service restaurant + late-night bar
  | 'wine_bar'
  | 'coffee_shop'
  | 'quick_service'
  | 'bakery'
  | 'morning_cafe'       // Opens early, no lunch/dinner kitchen
  | 'brunch_cafe'        // Brunch-only, typically closes early afternoon
  | 'all_day_cafe'       // Brunch + lunch, no dinner kitchen
  | 'lunch_restaurant'   // Lunch-only restaurant
  | 'dinner_restaurant'  // Dinner-only restaurant
  | 'full_service_restaurant' // Brunch/lunch + dinner full service
  | 'evening_bar'        // Opens for drinks in the evening, no full kitchen
  | 'late_night_bar'     // Open after midnight — nightlife / bar archetype
  | 'nightlife_bar'      // Nightlife-focused bar
  | 'brunch_specialist'  // Brunch-focused
  | 'fast_casual';       // QSR / food truck / counter service

/**
 * Validate and normalize business archetype string
 */
export function validateBusinessArchetype(value: unknown): BusinessArchetype | null {
  if (typeof value !== 'string') return null;
  
  const normalized = value.toLowerCase().trim().replace(/\s+/g, '_');
  
  const validArchetypes: BusinessArchetype[] = [
    'fine_dining', 'casual_dining', 'cafe_bistro', 'cafe_bar', 'restaurant_bar', 'wine_bar',
    'coffee_shop', 'quick_service', 'bakery', 'morning_cafe', 'brunch_cafe',
    'all_day_cafe', 'lunch_restaurant', 'dinner_restaurant', 'full_service_restaurant',
    'evening_bar', 'late_night_bar', 'nightlife_bar', 'brunch_specialist', 'fast_casual'
  ];
  
  if (validArchetypes.includes(normalized as BusinessArchetype)) {
    return normalized as BusinessArchetype;
  }
  
  return null;
}

/**
 * Compact operating-model classification used by the interpretation layer.
 * More operationally specific than BusinessArchetype — considers takeaway model,
 * daypart span, and service format. Primary input for deriving visit_mode,
 * weather relevance, and daypart priority.
 */
export type LocationBehaviorMode =
  | 'waterfront_outing'    // waterfront → scenic pause, outing energy
  | 'city_office_lunch'    // city_center + lunch daypart → commuter & office traffic
  | 'city_shopping_flow'   // city_center + all-day → passing trade, shopping stops
  | 'tourist_discovery'    // tourist_area → signature dish, social proof, viral
  | 'residential_habitual' // residential → regulars, habit, family
  | 'suburban_destination' // suburban → deliberate trip
  | 'generic';             // fallback

export type BusinessMode =
  | 'morning_cafe'          // Table-service morning-only café
  | 'coffee_bar_takeaway'   // Primarily grab-and-go, minimal seated service
  | 'brunch_lunch_cafe'     // Brunch + lunch, no dinner (closes mid-afternoon)
  | 'all_day_cafe'          // Full day: morning through afternoon, no dinner kitchen
  | 'lunch_restaurant'      // Lunch-only, closes mid-afternoon
  | 'dinner_restaurant'     // Dinner-only, advance-booking model
  | 'evening_bar'           // Drinks-led evening venue (wine bar / cocktail bar / late night)
  | 'hybrid_day_to_evening'; // Spans lunch through evening (full-service restaurant)

/**
 * A named visit occasion derived from matched_motivations + service_periods + archetype.
 * Primary occasions define "this is what we are" — secondary are additional audience segments.
 */
export interface GuestOccasion {
  occasion: string;                           // e.g. 'Weekend brunch', 'Hverdagsfrokost'
  primary: boolean;                           // True = defining occasion for this business
  day_pattern: 'weekday' | 'weekend' | 'any'; // When this occasion typically occurs
}

/**
 * Pre-computed week signal summary.
 * Aggregates economic, event, and weather signals into a single scored object
 * so Phase 0 and Phase 1 receive a one-line week characterisation rather than
 * having to infer it themselves from raw inputs.
 */
export interface WeekModifiers {
  economic_signal: 'push' | 'neutral' | 'none';             // push = payday, none = budget_conscious
  event_weight: 'high' | 'medium' | 'low' | 'none';         // Closest upcoming event distance
  weather_opportunity: 'strong' | 'normal' | 'constrained'; // From weather_interpretation bias
  /**
   * 'quiet_normal' = no events, no payday, weather not newsworthy — AI should not invent narrative drama.
   * 'low' = mild signals exist but below normal threshold.
   */
  overall_priority: 'high' | 'normal' | 'low' | 'quiet_normal';  // Derived from sub-signals
}

// ============================================================
// WEEK CONTEXT (INPUT TO LAYER 0)
// ============================================================

export type WeatherReliability = 'specific' | 'cautious' | 'seasonal';

export interface DayWeather {
  date: string; // ISO date
  temp_min: number;
  temp_max: number;
  feels_like?: number; // Perceived temperature (more accurate for guest behavior)
  condition: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'snow' | 'fog';
  precipitation_chance?: number; // 0-100, probability of rain/snow
  wind_speed?: number; // m/s, affects outdoor seating comfort
  humidity?: number; // 0-100, affects comfort
  reliability: WeatherReliability;
}

export interface WeekWeather {
  days: DayWeather[];
  pattern: 'cold_week' | 'hot_week' | 'mild_week' | 'mixed_week' | 'rainy_week';
  avg_temp: number;
  has_outdoor_seating: boolean; // If true, weather-dependent flags apply D5-7
}

export type SeasonName = 'winter' | 'spring' | 'summer' | 'autumn';

export interface SeasonContext {
  current: SeasonName;
  ingredients_in_season: string[];
  out_of_season: string[];
  /** Abstract season behavioural descriptors — NO ingredient names. Safe for atmosphere framing. */
  seasonal_mood_signals?: string[];
  /** Filtered subset confirmed to appear on this business's menu — permission to name ingredients */
  menu_supported_seasonal_signals?: string[];
}

export type EconomicPattern =
  | 'salary_week'        // Week 1: Just been paid
  | 'normal_spend'       // Week 2-3: Regular
  | 'budget_conscious'   // Week 4: End of month
  | 'december_high'      // December: High spend all month
  | 'july_vacation';     // July: Vacation period

export interface EconomicContext {
  week_of_month: number; // 1-5
  pattern: EconomicPattern;
  december_phase?: 'buildup' | 'peak' | 'jul_nytaar'; // Dec 1-10, 11-23, 24-31
  is_july: boolean;
  payday_this_week: boolean;   // True when the last working day of the month falls in this week
  payday_day_name?: string;    // e.g. 'fredag' — only set when payday_this_week is true
}

export interface UpcomingEvent {
  name: string;
  name_dk: string;
  date: string; // ISO date — start date
  date_end?: string | null; // ISO date — end date for multi-day events (school vacations etc.)
  days_away: number;
  type: 'holiday' | 'occasion' | 'season_change' | 'local' | 'school_vacation' | 'cultural';
  strategic_angle: string; // e.g. "Romantisk aften for to"
  recommended_lead_days: number; // How many days before to start posting
  marketing_hook?: string; // e.g. "Promote: Traditional Danish Easter lunch"
  commercial_weight?: number | null; // 1–5, higher = more commercially important
}

export interface LocationContext {
  type: 'tourist_area' | 'residential' | 'city_center' | 'waterfront' | 'suburban';
  neighborhood?: string | null;
  area_type?: string | null;
  has_outdoor_seating: boolean;
  has_takeaway?: boolean; // Activates takeaway CTA angles
  has_table_service?: boolean; // False = no "book a table" CTAs
  is_july_tourist_boost: boolean; // July + tourist_area = lean into tourist content
  recommended_post_reduction?: number; // e.g. -1 for residential in July
  // Derived from category_scores via buildLocationIntelligence()
  matched_motivations?: string[] | null; // e.g. ['familieudflug', 'hygge_lokal', 'turist_oplevelse']
  marketing_focus?: string | null;       // e.g. 'Fremhæv vandkanten og friluftsstemning'
  tourist_context?: boolean;             // True when area is tourist/waterfront/destination
  location_categories?: Array<{type: string; score: number}> | null; // Top categories scoring ≥60%, up to 4
}

export interface PreviousWeekPerformance {
  top_post?: {
    content_summary: string;
    likes: number;
    engagement_rate: number;
    performance_vs_avg: number; // 1.0 = average, 1.5 = 50% above
    content_type: string;
  };
  posted_menu_items: string[]; // To avoid repeating same dishes
  posted_content_types: string[]; // To ensure variety
  data_available: boolean; // False until FB/IG API integrated
  /**
   * Derived from past weekly_strategies.selected_idea_ids.
   * Which goal_modes the user has consistently chosen to schedule.
   * Acts as a proxy engagement signal until FB/IG API is integrated.
   */
  selection_patterns?: {
    weeks_analyzed: number;
    goal_mode_rates: Record<string, number>; // e.g. {drive_footfall: 0.5, build_brand: 0.3, retain_loyalty: 0.2}
    preferred_goal_mode: string | null;     // The most-selected goal_mode
    preferred_category: string | null;       // The most-selected content_category
  };
  past_week_summaries?: Array<{
    week_number: number;
    week_summary: string;
    overview: string;
  }>;
  /**
   * Phase 1 angle focus labels from the last 2 weeks.
   * Used by Phase 1 to softly prevent direct theme repetition across weeks.
   */
  previous_angle_focuses?: string[];
  /**
   * Day-of-week numbers (0=Sun…6=Sat) used by Slot D (any-window) posts
   * in the last 2 weeks. Used by Phase 2a to prefer fresh days for flexible slots.
   */
  previous_flexible_dows?: number[];
}

export interface MenuSummary {
  title: string;      // e.g. "BRUNCH"
  source_url: string; // e.g. "https://cafefaust.dk/brunch"
  summary: string;    // 5-bullet text from AI
}

/**
 * A menu item with full details — replaces bare string[] for signature_items.
 * Enables dish descriptions to flow all the way to the caption generator.
 */
export interface SignatureMenuItem {
  id?: string;               // UUID from menu_items_normalized (preferred for deduplication)
  name: string;              // Dish name as it appears on the menu
  description?: string;      // Full preparation detail, e.g. "Sauce bearnaise, fritter og salat ad libitum"
  category?: string;         // Menu category, e.g. "FROKOST", "AFTENSMAD"
  price?: string;            // Optional price if available
  isSignature?: boolean;     // Whether explicitly flagged is_signature in the DB
  service_periods?: string[]; // Service periods from parent menu row: 'brunch' | 'lunch' | 'dinner'
}

export interface WeekContext {
  // Business identity
  business_id: string; // Business entity identifier (required for fetching intelligence data)
  
  // Timing
  week_number: number;
  week_start: string; // ISO date (Monday)
  week_end: string;   // ISO date (Sunday)
  is_current_week: boolean;
  owner_note?: string; // Optional free-text from owner: "anything special this week?"
  available_days: string[]; // ISO dates of days available for posting
  /**
   * Human-readable opening hours summary built from opening_hours rows + kitchen_close_time.
   * Example: "Man-Tir 09:30–23:00, Ons 09:30–00:00, Tor 09:30–01:00, Fre-Lør 09:30–02:00, Søn 09:00–23:00, køkken lukker 21:30"
   * Injected into Phase 1 BUSINESS PROFILE so the AI never hallucinates opening times.
   */
  opening_hours_summary?: string;

  /**
   * Opening time for each day in the week (ISO date → "HH:MM" | null).
   * null = no open_time on record for that day.
   * Used by Phase 2b to ensure suggested_time is never before the business opens.
   */
  daily_open_time?: Record<string, string | null>;
  /**
   * Closing time for each day in the week (ISO date → "HH:MM" | null).
   * null = no close_time on record for that day.
   * Used by Phase 2b to ensure suggested_time is at least 1h before closing.
   */
  daily_close_time?: Record<string, string | null>;
  /**
   * Business booking URL (e.g. from a reservation system).
   * Used by Phase 2b for platform-aware CTAs in drive_footfall posts:
   *   Facebook  → URL can be included directly in the caption.
   *   Instagram → no clickable links; Phase 2b says "link i bio" instead.
   */
  booking_link?: string | null;

  // Environment
  weather: WeekWeather;
  season: SeasonContext;
  events: UpcomingEvent[];
  economic: EconomicContext;
  location: LocationContext;

  // Business
  business_name: string;
  business_type: BusinessTypeCode; // Legacy routing key — prefer business_character for AI-driven phases
  hybrid?: HybridWeighting;        // Legacy hybrid routing — superseded by business_character
  /**
   * AI-generated free-form description of what this business actually is.
   * Replaces business_type as the primary context fed to Phase 1 & 2 prompts.
   * Example: "Café og naturvinbar der åbner som kaffebar om morgenen og skifter til vinbar om aftenen.
   *           Uformelt, lokalt forankret, nørdet vinudvalg, ingen reservationer."
   * Generated by brand-profile-generator and stored in business_brand_profile.business_character.
   */
  business_character?: string;
  /**
   * Derived structural archetype — deterministically assigned from service_periods,
   * late_night_closing, and menu_programmes. Enables archetype-aware slot timing in Phase 1.
   */
  business_archetype?: BusinessArchetype;
  /**
   * WP4: Operational programme signals from menu_signal.programmes.
   * Each entry is a confirmed service period with role, time context and representative items.
   * Used by Phase 1 to assign slots to specific programmes (brunch, aftensmenu, drinks etc.).
   */
  menu_programmes?: Array<{ role: string; timeContext: string | null; items: string[] }> | null;
  /**
   * WP5: True when at least one opening_hours row has close_time in the 00:00–05:59 range.
   * Signals that the venue operates as a late-night bar/venue, enabling night-life content angles.
   */
  late_night_closing?: boolean;
  service_periods: string[]; // e.g. ['brunch', 'lunch', 'dinner']
  signature_items: SignatureMenuItem[]; // Top menu items with descriptions
  /**
   * Drink items extracted from menu categories matching drink/cocktail/wine/beer patterns.
   * Kept separate from signature_items so Phase 2b can offer optional drink pairing
   * without polluting the main dish selection pool.
   */
  drink_items?: SignatureMenuItem[];
  menu_summaries?: MenuSummary[]; // Per-menu AI helicopter summaries for Phase 0 routing
  country: string; // ISO 3166-1 alpha-2, default 'DK'
  city: string;

  // Platform & subscription context (NEW)
  platforms: Platform[]; // Active platforms (e.g., ['facebook', 'instagram'])
  subscription_tier: SubscriptionTier; // 'smart' or 'pro'
  preferred_posts_per_week: number; // Desired post count (1-10)

  // Brand voice (optional, from business_brand_profile)
  brand_voice?: {
    tone_of_voice?: any;          // string (new rules-text) or object (legacy: {primary_tone, attributes, formality_level})
    tone_keywords?: string[];     // e.g. ["lokal", "autentisk", "kvalitet"]
    voice_style?: string;         // brand_essence — identity anchor sentence
    do_not_say?: any;             // JSONB: things_to_avoid
    content_pillars?: any;        // JSONB: content_focus (content hooks / Do's)
    // V5 enrichment fields
    target_audience?: any;        // JSONB: {primary, characteristics[]} — who the brand speaks to
    core_offerings?: any;         // JSONB or string: what the business serves
    signature_phrases?: string[]; // Phrases to use naturally in posts
    never_say?: string[];         // Hard word-level blocklist
    typical_openings?: string[];  // Opening line style examples
    typical_closings?: string[];  // CTA/closing line style examples
    humor_level?: string;         // e.g. 'low', 'moderate', 'high'
    formality?: string;           // e.g. 'informal', 'semi-formal'
    storytelling_style?: string;  // e.g. 'anecdotal', 'direct'
    emoji_style?: string;         // e.g. 'minimal', 'moderate', 'expressive'
    // V2 fields (Brand Profile V2, March 2026)
    brand_essence?: string;               // One-sentence identity anchor
    brand_essence_elaboration?: string;   // 2-3 sentence elaboration
    identity_keywords?: string[];         // Core identity words
    voice_constraints?: string;           // Writing principle (why this style)
    tone_model?: any;                     // Structured writing rules object/array
    // Content strategy — drives Phase 1 slot assignment (goal_mode + content_category per post)
    content_strategy?: {
      primary_goal: 'drive_footfall' | 'build_brand' | 'retain_loyalty';
      goal_blend: {
        drive_footfall: number;
        build_brand: number;
        retain_loyalty: number;
      };
      footfall_signals: string[];
      brand_anchors: string[];
      loyalty_hooks: string[];
      content_category_weights: {
        product_menu: number;
        craving_visual: number;
        behind_scenes: number;
        team_people: number;
      };
      // Weekly modulation fields — injected by strategy-modulator.ts before Phase 1
      week_goal_blend?: {
        drive_footfall: number;
        build_brand: number;
        retain_loyalty: number;
      };
      week_content_category_weights?: {
        product_menu: number;
        craving_visual: number;
        behind_scenes: number;
        team_people: number;
      };
      week_strategic_rationale?: string;
    };
    venue_scene?: string;         // v5: sensory/perceptual atmosphere from photo analysis (light, material contrast, spatial density)
    visual_character?: string;    // v5: concept label for tone register (e.g. "Casual moderne café")
  };
  
  /**
   * V5 Phase 1: Layer 3 Identity Profile
   * Generated by brand-profile-generator-v5, stored in business_brand_profile.
   * Used when V5_ENABLED && V5_LAYER3_ENABLED feature flags are true.
   * Provides enhanced brand consistency through verified identity fields.
   */
  v5_identity?: {
    brand_essence: string;
    positioning: string;
    core_values: string[];  // Array of "Title - Description" strings
    what_makes_us_different: string;
    identity_confidence: number;
    identity_reasoning?: string;
    local_location_reference?: string;  // e.g., "ved åen" (factual location phrase)
  };

  // Derived business drivers (Step 3 — built in get-weekly-strategy/index.ts)
  business_drivers?: Array<{
    driver: string;           // e.g. 'Udendørs sommerstemning' or 'Familiefestmenu'
    always_relevant: boolean; // True = present every week regardless of context
    amplified_by?: string[];  // Context signals that amplify this driver, e.g. ['weekend', 'sunny']
  }>;

  /**
   * Revenue drivers from business_brand_profile.revenue_drivers
   * Analyzed by analyze-revenue-drivers Edge Function
   * Used by Business Rules Engine to generate intelligent slot allocation
   * Confidence score 90-100 when from structured programme data
   */
  revenue_drivers?: {
    analyzed_at: string;
    analyzed_from: string;
    confidence_score: number;
    primary_revenue_moment: any;
    secondary_revenue_moments: any[];
    normal_week_strategy: any;
  };

  // Interpreted weather (Step 4 — built by weather-interpreter.ts)
  weather_interpretation?: {
    indoor_outdoor_bias: 'strongly_indoor' | 'lean_indoor' | 'neutral' | 'lean_outdoor' | 'strongly_outdoor';
    strongest_opportunity_day?: string;  // Weekday name, e.g. 'lørdag'
    strongest_constraint_day?: string;   // Weekday name, e.g. 'mandag'
    weekend_usability: 'good' | 'mixed' | 'poor';
    forecast_confidence: 'high' | 'medium' | 'low'; // Based on how far out the forecast reaches
    operational_note: string; // One-sentence practical implication, e.g. 'Lørdag bliver den bedste udedag'
    precipitation_days: string[];   // Danish weekday names where condition is rain/snow OR precipitation_chance >= 60
    week_character: string;         // Temperature range + cloud/sun character without precipitation attribution
    /** True when this week deviates meaningfully from the monthly climate normal — gates weather narrative. */
    weather_is_newsworthy: boolean;
    /** Whether outdoor dining is expected this month based on climate baseline (not this week's forecast). */
    baseline_outdoor_viable: boolean;
  };

  // Named visit occasions derived from matched_motivations + service_periods + archetype (Item A)
  core_guest_occasions?: GuestOccasion[];

  // Pre-computed week signal summary — aggregates economic, event, weather signals (Item A)
  week_modifiers?: WeekModifiers;

  // 3–5 candidate strategic angles pre-computed from business drivers + occasions + modifiers (Item A)
  strategic_priority_candidates?: string[];

  /**
   * Hard language blocklist compiled from never_say[], voice_constraints, and weather-based rules.
   * Passed to Phase 1 as a GUARDRAILS block so the AI never produces off-brand phrasing.
   */
  narrative_guardrails?: string[];

  /**
   * True when weather materially affects footfall or outdoor experience for this business.
   * False for purely indoor archetypes (morning_cafe, wine_bar, late_night_bar) without outdoor seating.
   * When false, Phase 1 suppresses weather from headline framing.
   */
  weather_is_differentiator?: boolean;

  /**
   * How relevant payday timing is to this specific business type.
   * high  = evening/premium venues where payday unlocks spending (wine_bar, dinner_restaurant)
   * medium = lunch/fast-casual where payday has some impact
   * low   = morning_cafe where coffee is bought regardless of pay cycle
   * Gates the economic block in Phase 0 and Phase 1 prompts.
   */
  economic_relevance_for_business?: 'high' | 'medium' | 'low';

  /** Compact operating-model classification — more precise than business_archetype */
  business_mode?: BusinessMode;

  /** How much weather materially affects footfall/behaviour for this specific business type */
  weather_relevance_for_business?: 'low' | 'medium' | 'high';

  /** Which service period is most affected by this week's weather */
  weather_effect_on_daypart?: 'morning' | 'lunch' | 'evening' | 'all_day' | 'minimal';

  /** How weather shapes the guest's visit decision this week */
  weather_effect_on_visit_behavior?: 'indoor_refuge' | 'terrace_pull' | 'takeaway_pull' | 'minimal';

  /** Whether this is primarily a destination, convenience, or mixed-use venue */
  visit_mode?: 'destination' | 'convenience' | 'mixed';

  /** The dominant reason guests choose to visit this type of place */
  primary_visit_motivation?: 'social' | 'pause' | 'meal' | 'treat' | 'discovery';

  /** Additional visit motivations beyond the primary */
  secondary_visit_motivations?: string[];

  /** Which service period is commercially most important this specific week */
  primary_daypart_this_week?: string;

  /** Second most important service period this week */
  secondary_daypart_this_week?: string;

  /** One-sentence Danish explanation of why this daypart is primary (template-generated, no AI) */
  daypart_reasoning?: string;

  /** Structured strategic angle candidates, pre-scored in TypeScript — replaces flat strategic_priority_candidates */
  strategic_priority_candidates_v2?: StrategicPriorityCandidate[];

  /** Behavioral classification of location type — drives modulation scoring and weekly mode */
  location_behavior_mode?: LocationBehaviorMode;

  /**
   * Pre-ranked driver hierarchy — deterministically computed from business identity,
   * location, occasions, daypart, and then contextual signals.
   * Consumed by Phase 0 prompt to prevent flat signal weighting.
   */
  business_driver_ranking?: {
    primary_driver: string;
    secondary_driver: string;
    supporting_drivers: string[];
    deprioritized_drivers: string[];
  };

  /**
   * Synthesized human-readable framing of how this place is used this week.
   * Combines location_behavior_mode + visit motivation + daypart into narrative strings.
   * Stronger signal than raw weather — consumed by Phase 0 and Phase 1.
   */
  weekly_framing?: {
    location_framing: string;
    motivation_framing: string;
    daypart_framing: string;
  };

  /** Semantic label for the kind of week this is — set by strategy modulator, consumed by Phase 1 */
  week_mode?: string;

  /** Topic labels Phase 1 must NOT allocate capacity to this week — set by strategy modulator */
  deprioritize?: string[];

  /**
   * Posting occasions stored in the brand profile (PostingOccasion[] from occasion-library.ts).
   * Written once by brand-profile-generator; read into WeekContext by get-weekly-strategy.
   * Phase 0 resolves these into active_occasions_this_week.
   */
  posting_occasions?: import('../occasions/occasion-library.ts').PostingOccasion[];

  /**
   * Week-specific activated occasions — resolved by Phase 0 resolveActiveOccasions().
   * Each entry maps to one post slot and carries resolved timing + CTA.
   * Phase 1 reads this to assign concrete timing_window per angle instead of inventing one.
   */
  active_occasions_this_week?: import('../occasions/occasion-library.ts').ActiveOccasion[];

  /**
   * Service behavior signals derived from business_operations flags (NEW).
   * Transforms service capabilities into posting behavior implications.
   * Used by Phase 0 to understand posting timing constraints.
   */
  service_behavior_signals?: {
    booking_pattern: 'advance_planning' | 'mixed' | 'impulse_friendly';
    booking_lead_time_days: number;
    family_orientation: 'high' | 'medium' | 'low';
    work_from_venue_suitable: boolean;
    destination_signals: string[];
    convenience_signals: string[];
    posting_modifiers: {
      needs_advance_posts: boolean;
      supports_impulse_posts: boolean;
      weekend_planning_critical: boolean;
    };
  };

  /**
   * Posting windows mapped by audience segment (NEW).
   * Transforms brand profile segments into concrete posting timing strategy.
   * Maps consumption windows to decision windows.
   */
  posting_windows_by_segment?: {
    primary_segments: Array<{
      segment: string;
      consumption_window: {
        days: string[];
        time_range: string;
      };
      posting_window: {
        optimal_day: string;
        optimal_time_range: string;
        lead_time_hours: number;
        reasoning: string;
      };
      behavior_type: 'planned' | 'impulse' | 'mixed';
      behavior_split?: { planned_pct: number; impulse_pct: number };
    }>;
    seasonal_adjustments: Array<{
      segment: string;
      season: string;
      weight_modifier: number;
      reasoning: string;
    }>;
  };

  /**
   * Historical content analysis (last 3 weeks).
   * Tracks programme-specific content patterns to prevent repetition and ensure variety.
   * Generated in get-weekly-strategy before Phase 1, consumed by Phase 2a.
   * Adapts to any business type: 1-4+ programmes, specialized or hybrid.
   */
  historical_context?: {
    weeks_analyzed: number;
    total_posts_analyzed: number;
    programme_patterns: Record<string, {
      programme_name: string;
      programme_type: string;
      content_categories: Record<string, number>;
      goal_modes: Record<string, number>;
      menu_items: string[];
      total_posts: number;
    }>;
    overuse_warnings: string[];
    underuse_opportunities: string[];
    recent_dishes: string[];
  };

  // History
  previous_week: PreviousWeekPerformance;
}

// ============================================================
// STRATEGY OUTPUT (FROM LAYER 0)
// ============================================================

export type StrategicFocus =
  | 'warm_dishes'
  | 'cold_drinks'
  | 'outdoor_seating'
  | 'comfort_food'
  | 'seasonal_menu'
  | 'valentines'
  | 'christmas'
  | 'summer_vibes'
  | 'wine_pairing'
  | 'coffee_ritual'
  | 'cocktail_craft'
  | 'quick_service'
  | 'location_event'
  | 'behind_scenes'
  | 'atmosphere'
  | 'premium_experience'
  | 'value_offer'
  | 'tourist_friendly'
  | 'weekend_buildup';

export interface StrategicPriority {
  focus: StrategicFocus;
  weight: number;       // 0.0 - 1.0, all weights sum to 1.0
  rationale: string;    // Short DK explanation
}

/**
 * A pre-scored strategic angle candidate computed entirely in TypeScript before Phase 0.
 * Replaces the flat string[] strategic_priority_candidates with structured, reasoned candidates.
 * Phase 0 and Phase 1 receive these as "already reasoned" inputs — the model ranks and phrases,
 * not invents.
 */
export interface StrategicPriorityCandidate {
  label: string;                                    // Short human-readable angle label (Danish)
  customer_behavior_reason: string;                 // Why guests behave differently this week
  business_reason: string;                          // Why this venue is well-positioned for this angle
  daypart_relevance: string[];                      // Which dayparts this angle covers
  menu_relevance: string[];                         // Menu categories that support this angle
  weather_relevance: 'low' | 'medium' | 'high';    // How much weather drives this angle
  location_relevance: 'low' | 'medium' | 'high';   // How much location drives this angle
  confidence: number;                               // 0–1 composite score
}

// ============================================================
// PHASE 0: CONTEXTUAL ANALYSIS (BEHAVIORAL INSIGHTS)
// ============================================================

/**
 * Phase 0: Pure contextual analysis - "WHAT is happening this week?"
 * Analyzes raw context (weather, events, economic, location, season) and generates
 * behavioral implications + content opportunities WITHOUT strategic decisions.
 * This grounds all later phases in factual analysis, reducing hallucination risk.
 */

export type ContextFactorType = 
  | 'special_day'
  | 'school_holiday'
  | 'weather'
  | 'economic'
  | 'location'
  | 'season'
  | 'business_identity'        // Stable brand/offering characteristics relevant to creative framing
  | 'location_visit_motivation'; // Derived visit-motivation that must be honored in content

export type ContextFactorUrgency = 'high' | 'medium' | 'low';
export type ContextFactorWeight = 'høj' | 'medium' | 'lav';
export type ContextSynergy = 'positive' | 'neutral' | 'conflicting_audiences' | 'negative';

export interface ContextFactor {
  type: ContextFactorType;
  name: string;                          // e.g. "Valentinsdag", "Konstant kulde", "Lønnings-uge"
  date?: string;                         // ISO date (for events)
  day_of_week?: string;                  // e.g. "fredag" (user-friendly)
  dates_range?: string;                  // e.g. "2026-02-07 til 2026-02-15" (for multi-day)
  days_until?: number;                   // For special days/events
  days_remaining?: number;               // For ongoing periods (school holidays)
  urgency: ContextFactorUrgency;         // How time-sensitive is this factor?
  
  // Behavioral insights (objective analysis)
  behavioral_impact: string;             // What does this mean for guest behavior? (2-3 sentences)
  target_audience: string;               // Who is most affected? e.g. "Par (25-55 år)"
  
  // Content opportunities (bridges analysis → creativity)
  content_opportunities: string[];       // Specific content ideas this factor enables
  
  // Timing guidance
  timing_recommendation: string;         // When to post about this (if time-sensitive)
  
  // Structured posting timing (NEW - optional, Phase 0 AI can populate if confident)
  posting_window?: {
    day: string;                         // 'Monday', 'Friday', 'same_day', etc
    time_range: string;                  // '15:00-18:00'
    lead_time_hours: number;             // Hours before consumption
  };
  consumption_window?: {
    days: string[];                      // ['Saturday', 'Sunday']
    time_range: string;                  // '10:00-14:00'
  };
  
  // Weight for strategic planning
  strategic_weight: ContextFactorWeight; // How important is this factor?
  
  // User presentation (natural Danish for UI)
  impact_user_friendly?: string;         // Short impact statement for users
  icon?: string;                         // Emoji for UI (e.g. "❤️", "🌡️", "🎒")
}

export interface FactorInteraction {
  factors: string[];                     // Factor IDs, e.g. ["special_day:Valentinsdag", "economic:normal_spend"]
  synergy: ContextSynergy;               // How do these factors interact?
  insight: string;                       // What's the combined insight? (2-3 sentences)
  strategic_implication?: string;        // What should strategy consider?
  resolution?: string;                   // If conflicting, how to resolve?
}

export interface StrategicPrioritySuggestion {
  priority: number;                      // 1, 2, 3...
  theme: string;                         // e.g. "valentine_romantic", "winter_comfort"
  reasoning: string;                     // Why this priority? (reference factors)
  recommended_weight: string;            // e.g. "35-40%"
}

export interface ContextualAnalysis {
  week_start: string;                    // ISO date
  week_number: number;
  generated_at: string;                  // ISO datetime
  
  // Core analysis
  key_factors: ContextFactor[];          // 3-6 most important contextual factors
  factor_interactions: FactorInteraction[]; // How factors combine/conflict
  
  // Strategic suggestions (for Phase 1)
  strategic_priorities_suggestion: StrategicPrioritySuggestion[];
  
  // User-facing summary (for Phase 2c → UI)
  context_summary_user?: {
    headline: string;                    // e.g. "3 vigtige faktorer denne uge:"
    key_factors_display: Array<{
      icon: string;                      // Emoji
      title: string;                     // Short title
      subtitle?: string;                 // Additional context (e.g. "Om 3 dage")
      impact: string;                    // User-friendly impact statement
      color?: string;                    // For UI theming
    }>;
  };
}

// ============================================================
// PHASE 1: STRATEGIC BRIEF (CONTEXTUAL ANALYSIS)
// ============================================================

/**
 * Phase 1 output: Pure strategic synthesis WITHOUT specific menu items.
 * Connects business profile + menu capabilities + week context into actionable angles.
 * NOW ENHANCED: References Phase 0 analysis for grounded decision-making.
 */

export interface MenuCapabilities {
  category: string;           // e.g. "Traditional Danish classics", "Fusion dishes", "Quick lunch options"
  count: number;              // How many items in this category
  strategic_value: string;    // Why this matters for content
}

export interface StrategicAngle {
  focus: string;              // Custom strategic angle (not just predefined categories)
  weight: number;             // 0.0-1.0, all weights sum to 1.0
  reasoning: string;          // Deep contextual reasoning (2-3 sentences)
  menu_alignment: string;     // Which menu capabilities support this angle
  content_direction: string;  // How posts should execute this angle
  phase0_factors_used?: string[]; // Phase 0 factor IDs this angle addresses (e.g. ["special_day:Valentinsdag"])
  // NEW: Slot-based content strategy fields
  slot_id?: 'A' | 'B' | 'C' | 'D';               // Which weekly slot this angle belongs to
  goal_mode?: 'drive_footfall' | 'build_brand' | 'retain_loyalty';  // Business goal for this post
  content_category?: 'product_menu' | 'craving_visual' | 'behind_scenes' | 'team_people'; // Content type
  timing_window?: string;     // Recommended timing context e.g. "Thu-Fri 14:00"
  // CTA mode — Phase 1 decision on how to drive action for drive_footfall posts.
  // Replaces day-of-week heuristics in Phase 2b with a strategy-level decision.
  //   walk_in   → "kom forbi i dag" — no booking push, low-threshold invitation
  //   booking   → "book dit bord" — hard booking link CTA
  //   hybrid    → "kom forbi eller book via link" — both options
  cta_mode?: 'walk_in' | 'booking' | 'hybrid';
  suggested_content_category?: 'product_menu' | 'craving_visual' | 'behind_scenes' | 'team_people'; // AI hint from Phase 1 prompt for semantic slot matching
}

export interface StrategicBrief {
  // Contextual analysis (reasoning visibility — REQUIRED validates 6-step process)
  contextual_analysis: {
    unique_factors_this_week: Array<{
      factor: string;
      customer_behavior_enabled: string;
      time_windows_activated: string[];
      audience_segments: string[];
    }>;
    opportunity_synthesis: string;
  };
  
  // Week synthesis
  week_summary: string;       // 2-3 sentences: what makes THIS week unique for THIS business
  
  // Business positioning for this week
  competitive_advantage: string; // What sets this business apart given week context (NOT menu listing)
  
  // Strategic angles (2-3 angles with deep reasoning)
  angles: StrategicAngle[];
  
  // Metadata
  generated_at: string;
  week_number: number;
}

export interface PostIdea {
  id: number;           // 1-N (based on preferred_posts_per_week)
  title: string;        // Short DK title e.g. "Faust Gryde i vintervejr"
  rationale: string;    // Why this idea fits the strategy
  content_type: 'menu_item' | 'atmosphere' | 'event' | 'behind_scenes' | 'promotional' | 'seasonal';
  suggested_day: string; // ISO date
  suggested_time: string; // e.g. "11:00"
  weather_dependent: boolean; // True only if outdoor seating + D5-7 weather
  weather_flag?: string; // e.g. "⚠️ Tjek vejrudsigt torsdag"
  estimated_performance: 'high' | 'medium' | 'low';
  strategic_fit: number; // 0.0 - 1.0

  // Goal-mode system (NEW — from Phase 1 slot assignment)
  goal_mode?: 'drive_footfall' | 'build_brand' | 'retain_loyalty';
  content_category?: 'product_menu' | 'craving_visual' | 'behind_scenes' | 'team_people';
  service_period?: string;  // e.g. "FROKOST", "AFTEN", "Brunch" (from business intelligence)

  // Platform targeting (NEW)
  platforms: Platform[];     // Which platforms this idea targets (derived from active platforms)
  cta_intent: CTAIntent;     // What the CTA should achieve

  // Media suggestion (NEW)
  suggested_media: SuggestedMedia;
  
  // Phase 0 connection (NEW)
  addresses_factors?: Array<{    // Which contextual factors this post addresses
    factor_id: string;           // e.g. "special_day:Valentinsdag", "weather:cold_indoor"
    icon?: string;               // Emoji for UI
    label: string;               // Short label (e.g. "Varmt i kulden")
    explanation: string;         // Why this post addresses this factor
  }>;

  // Strategic intent — carries the Phase 1 narrative purpose of this post through to
  // the plan generator and caption prompt so the cross-day booking/occasion logic is
  // never lost in translation between phases.
  // e.g. "Drive family brunch bookings for Saturday — early-week teaser with booking CTA"
  strategic_intent?: string;

  // Booking nudge judgment metadata (v2)
  // Written by Phase 1 when booking_nudge_capable is true.
  // Carried through PostSpecification to generate-text-from-idea via suggestion object.
  // nudge_rationale is stored in strategy_rationale on weekly_strategies for audit.
  booking_nudge_warranted?: boolean;       // Did AI decide to use nudge this week?
  booking_nudge_reasoning?: string;        // One sentence: why warranted or why skipped
  peak_day?: string;                       // ISO date (YYYY-MM-DD) of targeted visit day
  nudge_post_date?: string;                // ISO date: peak_day minus lead_days_used
  lead_days_used?: number;                 // 1–5: actual lead time chosen by AI
  nudge_rationale?: string;                // Human-readable audit string, stored in DB
}

export interface StrategyNarrative {
  headline: string;          // e.g. "Uge 7: Vinter + Valentines"
  overview: string;          // 2-3 sentences, always visible
  continuation_note?: string; // 1-2 sentences: what changed vs last week (only when past week data exists)
  
  // User-facing context summary (from Phase 0)
  context_summary?: {
    headline: string;                    // e.g. "3 vigtige faktorer denne uge:"
    key_factors: Array<{
      icon: string;                      // Emoji
      title: string;                     // Short title
      subtitle?: string;                 // Additional context (e.g. "Om 3 dage")
      impact: string;                    // User-friendly impact statement
      color?: string;                    // For UI theming
    }>;
  };
  
  // Strategic reasoning (WHY these posts)
  strategy_reasoning?: {
    primary_angle: string;               // Main strategic focus
    why_it_works: Array<{                // Causal connections
      reasoning: string;                 // e.g. "Fredag er Valentine's + normal forbrugsvilje"
      addresses_factors: string[];       // Factor IDs
    }>;
    post_distribution_reasoning?: Array<{ // Why these post types at these times
      content_type: string;
      count: number;
      which_days?: string;
      reasoning: string;
      addresses_factor: string;
    }>;
  };
  
  detailed_sections: {
    weather_season: string;  // Weather & season analysis
    events?: string;         // Only if events this week
    business_advantage: string; // Location, menu, atmosphere
    performance_insight?: string; // Only if data_available = true
    post_plan: string;       // What we're posting and why
  };
}

export interface WeeklyStrategy {
  // Phase 0: Contextual analysis (NEW)
  contextual_analysis?: ContextualAnalysis; // Behavioral insights from raw context
  contextual_analysis_raw?: string;         // Raw Gemini Phase 0 output for debugging
  
  // Phase 1: Strategic brief (contextual synthesis)
  strategic_brief: StrategicBrief;
  strategic_brief_raw?: string; // Raw Gemini Phase 1 output for debugging
  
  // Narrative for user display
  narrative: StrategyNarrative;

  // Machine-readable priorities (feed into Layer 5)
  strategic_priorities: StrategicPriority[];

  // Post ideas for user selection
  post_ideas: PostIdea[];

  // Metadata
  generated_at: string; // ISO datetime
  week_number: number;
  business_type: BusinessTypeCode;
  platforms: Platform[];           // (NEW) Which platforms are active
  subscription_tier: SubscriptionTier; // (NEW) Smart or Pro
  target_post_count: number;       // (NEW) How many ideas were requested
  validation_passed: boolean;
  validation_warnings: string[];
}
