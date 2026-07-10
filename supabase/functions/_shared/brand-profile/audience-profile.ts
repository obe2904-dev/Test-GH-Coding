// @ts-nocheck - This is a Deno edge function, not a Node/browser TypeScript file
/**
 * Layer 4: Audience Segmentation
 * 
 * Purpose: Programme-specific audience segmentation
 * - WHO visits each programme
 * - WHEN they visit (timing_windows)
 * - WHAT resonates with them (content_angles)
 * 
 * Scope: Programme-level (different segments per programme)
 * Model: gpt-4o-mini (temperature 0.3, max_tokens 1500, ~15s per programme)
 * 
 * Strategic Principles (User-Approved):
 * 1. AI decides 2-4 segments per programme (complexity detector)
 * 2. Overlapping across programmes, exclusive within programme
 * 3. Replace Stage B5 (programme-level is source of truth)
 * 4. Must align with Layer 2 (primary segment matches decision_timing + goal_split)
 * 5. Include evidence field (menu items, hours, location facts)
 */

import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts";
import { getV5Prompt } from './v5-prompts.ts';

// ===== SEGMENT DECOMPOSITION ENUMS (Phase 1) =====

/**
 * Customer Segment Taxonomy
 * Canonical WHO classification - stable keys for cross-programme deduplication.
 * Based on bilingual Food & Beverage Segmentation Structure.
 */
export type CustomerSegmentKey =
  | "solo_guests"
  | "couples"
  | "friends_small_groups"
  | "families_with_children"
  | "students"
  | "professionals"
  | "neighbourhood_locals"
  | "city_residents"
  | "domestic_visitors"
  | "tourists"
  | "large_groups";

/**
 * Occasion Segment Taxonomy
 * Canonical WHEN/WHY classification - distinct from time slots.
 * Occasions are visit purposes, not just dayparts.
 */
export type OccasionSegmentKey =
  | "breakfast"
  | "lunch_break"
  | "coffee_break"
  | "after_work"
  | "dinner"
  | "weekend_visit"
  | "date_night"
  | "celebration"
  | "business_meeting"
  | "takeaway_at_home"
  | "pre_post_event"
  | "spontaneous_stop";

/**
 * Need Segment Taxonomy
 * Canonical WHAT-DRIVES-CHOICE classification - guest motivations.
 */
export type NeedSegmentKey =
  | "quick_and_easy"
  | "affordable"
  | "treat_indulgence"
  | "healthy_light"
  | "social_experience"
  | "comfort_food"
  | "premium_quality"
  | "dietary_fit"
  | "local_authentic"
  | "atmosphere_experience";

/**
 * Product Segment Taxonomy
 * Canonical WHAT-PRODUCT classification - menu item categorization.
 * Used for menu extraction and content targeting.
 */
export type ProductSegmentKey =
  | "drinks"
  | "snacks"
  | "main_meals"
  | "sharing_food"
  | "desserts"
  | "specials"
  | "takeaway_items"
  | "gifting_and_addons";

/**
 * Channel Segment Taxonomy
 * Canonical HOW-TO-ACCESS classification - distribution channels.
 * Derived from business_operations flags, not stored directly.
 */
export type ChannelSegmentKey =
  | "walk_in"
  | "booking"
  | "takeaway"
  | "delivery";

// ===== UNIVERSAL PEOPLE TAXONOMY =====

/**
 * Seven canonical people types used across all businesses.
 * This ensures consistent segment IDs for reporting, A/B testing, and content recommendation.
 */
export const PEOPLE_TYPES = {
  familier: {
    label: 'Familier',
    label_en: 'Families',
    social_unit: 'Parents with children or multi-generational groups',
    decision_style: 'Plan ahead, friction-sensitive, need facilities',
    strong_format_fit: ['ayce', 'brunch_buffet', 'casual_sitdown'],
    poor_format_fit: ['late_night_bar', 'tasting_menu', 'ayce_all_you_can_drink'],
    strong_dayparts: ['brunch', 'frokost', 'aftensmad_early'],
    poor_dayparts: ['natbar'],
  },
  par: {
    label: 'Par',
    label_en: 'Couples',
    social_unit: 'Two people — date, anniversary, regular outing',
    decision_style: 'Moderate planning, quality and atmosphere sensitive',
    strong_format_fit: ['a_la_carte', 'casual_sitdown', 'tasting_menu', 'wine_bar'],
    poor_format_fit: ['fast_casual', 'standing_bar'],
    strong_dayparts: ['brunch', 'aftensmad', 'eftermiddag'],
    poor_dayparts: ['morning_utility'],
  },
  vennegrupper: {
    label: 'Vennegrupper',
    label_en: 'Groups of Friends',
    social_unit: '3–8 peers — celebration, social ritual, spontaneous evening',
    decision_style: 'Social coordination, energy-driven, bill-splitting matters',
    strong_format_fit: ['ayce', 'ayce_all_you_can_drink', 'sharing_plates', 'cocktail_bar'],
    poor_format_fit: ['tasting_menu', 'quiet_cafe'],
    strong_dayparts: ['aftensmad', 'natbar'],
    poor_dayparts: ['morning_utility', 'eftermiddag_work'],
  },
  erhverv: {
    label: 'Erhverv / Forretningsgæster',
    label_en: 'Business / Professional Guests',
    social_unit: 'External business meals — client lunches, partner meetings, ' +
                 'professional networking. NOT internal colleague lunches ' +
                 '(Danish workplace culture: colleagues rarely eat out together ' +
                 'unless it is a social event or company-arranged celebration).',
    decision_style: 'Booked in advance, expense account, host-guest dynamic, ' +
                    'needs quiet atmosphere and attentive service. ' +
                    'Requires: either a formal setting, private area, or ' +
                    'clearly professional atmosphere visible from menu/concept.',
    strong_format_fit: ['a_la_carte', 'set_menu', 'private_dining'],
    poor_format_fit: ['ayce', 'ayce_all_you_can_drink', 'loud_bar',
                      'fast_casual', 'table_grill', 'buffet'],
    strong_dayparts: ['frokost'],
    poor_dayparts: ['natbar', 'brunch_weekend'],
    // CRITICAL: Evidence required before surfacing this segment.
    // DO NOT use as default weekday filler. Only surface if business data
    // contains at least ONE of: private dining area, set menus for groups,
    // formal service style, business district location, or explicit
    // business/meeting references in the concept description.
    requires_business_evidence: true,
  },
  solo: {
    label: 'Solo / Enkeltgæster',
    label_en: 'Solo / Singles',
    social_unit: 'Individual — work lunch, self-care, third-place seeker',
    decision_style: 'Spontaneous, efficient, comfort or laptop-friendly',
    strong_format_fit: ['cafe', 'quick_lunch', 'bar_seating'],
    poor_format_fit: ['ayce_group', 'sharing_plates_only'],
    strong_dayparts: ['morning', 'frokost', 'eftermiddag'],
    poor_dayparts: ['natbar'],
  },
  turister: {
    label: 'Turister',
    label_en: 'Tourists / Out-of-towners',
    social_unit: 'Leisure travelers seeking local experience or familiar comfort',
    decision_style: 'Discovery-driven, rely on reviews and visibility',
    strong_format_fit: ['local_cuisine', 'scenic_location', 'visible_from_street'],
    poor_format_fit: ['hidden_gem_only', 'booking_weeks_ahead'],
    strong_dayparts: ['frokost', 'aftensmad', 'eftermiddag'],
    poor_dayparts: ['natbar'],
    // CRITICAL: Only surface if concept independently supports tourist appeal.
    // High city_centre score alone is NOT a tourist signal.
    location_prerequisite: 'demographic_proximity.tourist >= 65',
  },
  lokale: {
    label: 'Lokale / Stamgæster',
    label_en: 'Locals / Regulars',
    social_unit: 'Neighborhood residents or nearby workers — repeat habitual visits',
    decision_style: 'Habit-driven, loyal, value familiarity',
    strong_format_fit: ['neighbourhood_cafe', 'lunch_spot', 'after_work'],
    poor_format_fit: ['destination_only', 'high_booking_friction'],
    strong_dayparts: ['morning', 'frokost', 'eftermiddag'],
    poor_dayparts: [],
  },
} as const;

export type PeopleTypeId = keyof typeof PEOPLE_TYPES;

// Array of valid people type labels for validation
export const VALID_PEOPLE_TYPE_LABELS = Object.values(PEOPLE_TYPES).map(t => t.label);

// ===== TYPES =====

export interface AudienceSegment {
  // === NEW: Enum-Constrained Identity Fields (Phase 1) ===
  customer_segment: CustomerSegmentKey;       // Stable key for deduplication (e.g., "families_with_children")
  people_type_label: string;                   // Free-text display label (e.g., "Familier med børn")
  occasion_segment: OccasionSegmentKey[];      // WHEN/WHY they visit (e.g., ["brunch", "weekend_visit"])
  need_segment: NeedSegmentKey[];              // WHAT drives their choice (e.g., ["social_experience", "comfort_food"])
  
  // === LEGACY: Preserved for Backward Compatibility ===
  people_type: string;           // DEPRECATED - use customer_segment for matching, people_type_label for display
  people_type_id?: PeopleTypeId; // DEPRECATED - kept for old code compatibility
  
  // === SHARED: Core Segment Fields ===
  segment_size: string;          // "primary" | "secondary" | "niche"
  motivation: string;            // Free-text rationale (not used for matching)
  decision_timing: string;       // "spontaneous" | "planned" | "mixed"
  content_angles: string[];      // 2-3 framing hints for content generation
  
  // === DEPRECATED: To be replaced by occasion_segment ===
  location_occasions: string[];  // DEPRECATED - use occasion_segment instead
                                 // AI-derived context (e.g., ["shopping pause", "destination visit"])
  
  concept_fit_reason: string;    // Why this segment fits this business (REQUIRED, min 20 chars)
  evidence: string[];            // Grounded in actual business data (menu items, hours, etc.)
}

export interface ProgrammeAudienceProfile {
  programme_type: string;
  programme_name: string;
  audience_segments: AudienceSegment[];
  segment_confidence: number;       // 0-1
  segment_reasoning: string;        // Why these segments chosen
}

interface BusinessData {
  business_name: string;
  business_category: string;
  city: string;
  establishment_type?: string;
  business_archetype?: string;  // NEW Phase 0: Business type/concept for audience segmentation context
}

interface MenuData {
  items: Array<{
    name: string;
    description?: string;
    category?: string;
    price?: number;
  }>;
}

interface ProgrammeData {
  programme_type: string;
  programme_name: string;
  time_windows: string[];
  operating_days: string[];
  menu_evidence: string[];
  confidence: number;
  languageVariants?: string[];  // e.g., ['da', 'en'] - signals international audience
  meal_periods?: string[];      // e.g., ['frokost', 'aftensmad'] - derived from time window overlap
  day_pattern?: string;         // e.g., 'weekend_heavy', 'all_week' - derived from operating days
}

interface CommercialOrientationData {
  baseline_goal_split: {
    drive_footfall: number;
    strengthen_brand: number;
    retain_regulars: number;
  };
  decision_timing: string;          // "spontaneous" | "planned" | "mixed"
  content_type_affinity: {
    product: number;
    place: number;
    process: number;
    urgency: number;
    proof: number;
    retention: number;
  };
}

interface IdentityData {
  brand_essence: string;
  positioning: string;
  core_values: string[];
  what_makes_us_different: string;
}

interface LocationData {
  neighborhood?: string;
  area_type?: string;              // "urban_center" | "suburban" | "tourist_area"
  local_location_reference?: string;  // How locals refer to location (e.g., "ved åen")
  tourist_context?: string;
  landmarks?: string[];
  // Phase 3: Renamed from reachable_demographics for semantic clarity
  // Location contexts from location strategy (brand-profile-generator-v5)
  reachable_location_contexts?: Array<{
    demographic: string;              // Legacy field name: "local_resident" | "tourist" | "student" | "business_professional"
    proximity_score: number;          // 0-100 (from location intelligence)
    is_reachable: boolean;            // Can business actually serve this location context?
    filter_reason?: string;           // Why filtered if not reachable (e.g., "price too high for students")
  }>;
  // Phase 3: Renamed from demographic_proximity_signals for semantic clarity
  // Proximity signals for AI reasoning (replacing constraints)
  location_context_proximity_signals?: Array<{
    demographic: string;
    proximity_score: number;
    signal_source: string;
    caveat?: string;
  }>;
  physical_context?: {
    pedestrian_flow?: string;         // "very_high" | "high" | "medium" | "low"
    transit_within_150m?: boolean;
    nearest_transit?: { name: string; distance_meters: number };
    parking_within_300m?: boolean;
  };
}

interface OperationsData {
  accepts_walk_ins: boolean;        // TRUE = footfall possible
  reservation_required: boolean;    // TRUE = booking required (walk-ins false)
  has_table_service: boolean;       // Affects service style
  has_takeaway: boolean;            // Enables takeaway goal
  booking_url: string | null;       // If set, booking goal available
}

// ===== FORMAT-OCCASION MAPPING =====

/**
 * Format-to-occasion mappings to help AI reason about social situations
 * without relying solely on training data
 */
const FORMAT_OCCASION_SIGNALS: Record<string, string[]> = {
  ayce: [
    'Friend groups — AYCE removes the awkwardness of splitting the bill',
    'Families — value-for-money, children can eat without a fixed price',
    'Couples on novelty date — interactive format (grill at table) is a draw',
  ],
  a_la_carte: [
    'Couples — controlled spend, intimate pacing',
    'Business lunch — individual choices, professional setting',
    'Solo diners — full menu access without over-ordering',
  ],
  brunch_buffet: [
    'Families with children — relaxed timing, variety for picky eaters',
    'Friend groups — weekend social ritual',
    'Couples — weekend leisure occasion',
  ],
  tasting_menu: [
    'Couples — special occasion, celebration',
    'Food enthusiasts — the format IS the draw',
  ],
  fast_casual: [
    'Solo weekday lunch — speed and value',
    'Small work groups — quick, no booking needed',
    'Shoppers pausing — proximity to retail is the trigger',
  ],
  table_grill: [
    'Friend groups — interactive social experience, shared cooking',
    'Families — kids enjoy the interactive element',
    'Couples seeking novelty — active participation creates engagement',
  ],
  buffet: [
    'Families with children — variety accommodates picky eaters, fixed price',
    'Large groups — easy coordination, no menu decisions needed',
    'Value seekers — unlimited food appeals to cost-conscious diners',
  ],
};

/**
 * Detect programme format from menu data and programme type
 */
function detectProgrammeFormat(
  menu: MenuData,
  programmeType: string,
  programmeName: string
): string | null {
  const nameLower = programmeName.toLowerCase();
  const typeLower = programmeType.toLowerCase();

  // Check for explicit format indicators
  if (nameLower.includes('ayce') || nameLower.includes('all you can eat') || nameLower.includes('ad libitum')) {
    return 'ayce';
  }
  
  if (nameLower.includes('brunch') && (nameLower.includes('buffet') || nameLower.includes('buffé'))) {
    return 'brunch_buffet';
  }
  
  if (nameLower.includes('buffet') || nameLower.includes('buffé')) {
    return 'buffet';
  }
  
  if (nameLower.includes('tasting') || nameLower.includes('smagsmenu')) {
    return 'tasting_menu';
  }
  
  if (nameLower.includes('bordgrill') || nameLower.includes('table grill') || nameLower.includes('grill ved bordet')) {
    return 'table_grill';
  }

  // Check menu items for format clues
  const hasFixedPrice = menu.items.every(item => item.price !== null && item.price !== undefined);
  const allItemsIndividual = menu.items.length > 5 && hasFixedPrice;
  
  if (allItemsIndividual && !nameLower.includes('buffet')) {
    return 'a_la_carte';
  }

  // Default: no clear format detected
  return null;
}

// ===== DEMOGRAPHIC PROXIMITY SIGNALS (NEW ARCHITECTURE) =====

/**
 * Build demographic proximity signals section for AI prompt
 * IMPORTANT: These are SIGNALS, not CONSTRAINTS. The AI must reason about them
 * in combination with the business concept and occasion logic.
 */
function buildDemographicProximitySignalsSection(
  location: LocationData,
  language: string = 'da'
): string {
  // Prefer new signal-based architecture if available
  if (location.demographic_proximity_signals && location.demographic_proximity_signals.length > 0) {
    const signals = location.demographic_proximity_signals;

    if (language === 'da') {
      const lines = [
        '\nDEMOGRAFISKE NÆRHEDSSIGNALER (geografisk rækkevidde, IKKE målgruppe):',
        'Disse tal viser hvem der er FYSISK TILGÆNGELIG i området — ikke hvem forretningen primært er rettet mod.',
        ''
      ];

      signals.forEach(signal => {
        const caveatText = signal.caveat ? ` ⚠️ Bemærk: ${signal.caveat}` : '';
        lines.push(`• ${signal.demographic}: ${signal.proximity_score}/100 (kilde: ${signal.signal_source})${caveatText}`);
      });

      lines.push('');
      lines.push('⚠️ KRITISK: Brug FORRETNINGSKONCEPTET (sektion A) som primært filter.');
      lines.push('Disse demografiske nærhedssignaler er ÉN input blandt tre — ikke en begrænsning.');

      return lines.join('\n');
    }

    // English version
    const lines = [
      '\nDEMOGRAPHIC PROXIMITY SIGNALS (geographic reach, NOT target audience):',
      'These numbers show who is PHYSICALLY REACHABLE in the area — not who the business primarily targets.',
      ''
    ];

    signals.forEach(signal => {
      const caveatText = signal.caveat ? ` ⚠️ Note: ${signal.caveat}` : '';
      lines.push(`• ${signal.demographic}: ${signal.proximity_score}/100 (source: ${signal.signal_source})${caveatText}`);
    });

    lines.push('');
    lines.push('⚠️ CRITICAL: Use BUSINESS CONCEPT (Section A) as the primary filter.');
    lines.push('These demographic proximity signals are ONE input among three — not a constraint.');

    return lines.join('\n');
  }

  // Legacy fallback: if only reachable_location_contexts exists (or old reachable_demographics)
  const locationContexts = location.reachable_location_contexts || location.reachable_demographics;
  if (locationContexts && locationContexts.length > 0) {
    const signals = locationContexts;

    if (language === 'da') {
      const lines = [
        '\nDEMOGRAFISKE NÆRHEDSSIGNALER:',
        ''
      ];

      signals.forEach(demo => {
        lines.push(`• ${demo.demographic}: ${demo.proximity_score}/100${demo.is_reachable ? ' (reachable)' : ` (filtered: ${demo.filter_reason})`}`);
      });

      lines.push('');
      lines.push('⚠️ Brug forretningskonceptet som primært filter, ikke kun disse signaler.');

      return lines.join('\n');
    }

    // English fallback
    const lines = [
      '\nDEMOGRAPHIC PROXIMITY SIGNALS:',
      ''
    ];

    signals.forEach(demo => {
      lines.push(`• ${demo.demographic}: ${demo.proximity_score}/100${demo.is_reachable ? ' (reachable)' : ` (filtered: ${demo.filter_reason})`}`);
    });

    lines.push('');
    lines.push('⚠️ Use business concept as primary filter, not just these signals.');

    return lines.join('\n');
  }

  return '';
}

interface LocationData {
  neighborhood?: string;
  area_type?: string;              // "urban_center" | "suburban" | "tourist_area"
  local_location_reference?: string;  // How locals refer to location (e.g., "ved åen")
  tourist_context?: string;
  landmarks?: string[];
  // Phase 2C: Reachable demographics from location strategy (brand-profile-generator-v5)
  reachable_demographics?: Array<{
    demographic: string;              // "local_resident" | "tourist" | "student" | "business_professional"
    proximity_score: number;          // 0-100 (from location intelligence)
    is_reachable: boolean;            // Can business actually serve this demographic?
    filter_reason?: string;           // Why filtered if not reachable (e.g., "price too high for students")
  }>;
  // NEW: Proximity signals for AI reasoning (replacing constraints)
  demographic_proximity_signals?: Array<{
    demographic: string;
    proximity_score: number;
    signal_source: string;
    caveat?: string;
  }>;
  physical_context?: {
    pedestrian_flow?: string;         // "very_high" | "high" | "medium" | "low"
    transit_within_150m?: boolean;
    nearest_transit?: { name: string; distance_meters: number };
    parking_within_300m?: boolean;
  };
}

// ===== SEGMENTATION BREADTH CALCULATOR =====

/**
 * Market data for percentile-based breadth calculation
 */
interface MarketBenchmarks {
  prices: number[];
  itemCounts: number[];
  sampleSize: number;
}

/**
 * Calculate percentile rank (0-100) of a value within a dataset
 */
function calculatePercentile(value: number, dataset: number[]): number {
  if (dataset.length === 0) return 50; // Default to median if no data
  
  const sorted = [...dataset].sort((a, b) => a - b);
  const countBelow = sorted.filter(v => v < value).length;
  
  return Math.round((countBelow / sorted.length) * 100);
}

/**
 * Fetch market benchmarks for similar businesses
 * Uses business_category, country, and city to find comparable businesses
 */
async function fetchMarketBenchmarks(
  supabaseClient: any,
  businessCategory: string,
  country: string,
  city: string | null,
  currentBusinessId: string
): Promise<MarketBenchmarks | null> {
  try {
    // Strategy: Start narrow (city + category), expand if insufficient data
    const minSampleSize = 10;
    
    // Try 1: Same city + same category
    // Note: Fetch business IDs first, then menu data separately to avoid join issues
    let businessQuery = supabaseClient
      .from('businesses')
      .select('id, business_category, city')
      .eq('country', country)
      .eq('business_category', businessCategory)
      .neq('id', currentBusinessId);  // Exclude current business
    
    if (city) {
      businessQuery = businessQuery.eq('city', city);
    }
    
    const { data: cityBusinesses, error: cityError } = await businessQuery.limit(100);
    
    if (cityError) {
      console.error('⚠️  Error fetching city businesses:', cityError);
      return null;
    }
    
    // If we have enough businesses, fetch their menus
    if (cityBusinesses && cityBusinesses.length >= minSampleSize) {
      const businessIds = cityBusinesses.map((b: any) => b.id);
      const { data: menuData, error: menuError } = await supabaseClient
        .from('menu_results_v2')
        .select('business_id, menu_items, structured_data')
        .in('business_id', businessIds)
        .eq('status', 'done')
        .limit(200);
      
      if (!menuError && menuData && menuData.length > 0) {
        const benchmarks = extractBenchmarks(menuData);
        if (benchmarks.sampleSize >= minSampleSize) {
          console.log(`   ✅ Market data from city: ${benchmarks.sampleSize} businesses`);
          return benchmarks;
        }
      }
    }
    
    // Try 2: Same country + same category (broader)
    const { data: countryBusinesses, error: countryError } = await supabaseClient
      .from('businesses')
      .select('id')
      .eq('country', country)
      .eq('business_category', businessCategory)
      .neq('id', currentBusinessId)
      .limit(100);
    
    if (!countryError && countryBusinesses && countryBusinesses.length >= minSampleSize) {
      const businessIds = countryBusinesses.map((b: any) => b.id);
      const { data: menuData, error: menuError } = await supabaseClient
        .from('menu_results_v2')
        .select('business_id, menu_items, structured_data')
        .in('business_id', businessIds)
        .eq('status', 'done')
        .limit(200);
      
      if (!menuError && menuData && menuData.length > 0) {
        const benchmarks = extractBenchmarks(menuData);
        if (benchmarks.sampleSize >= minSampleSize) {
          console.log(`   ✅ Market data from country: ${benchmarks.sampleSize} businesses`);
          return benchmarks;
        }
      }
    }
    
    // Try 3: Same country, all categories (fallback)
    const { data: allBusinesses, error: allError } = await supabaseClient
      .from('businesses')
      .select('id')
      .eq('country', country)
      .neq('id', currentBusinessId)
      .limit(100);
    
    if (!allError && allBusinesses && allBusinesses.length >= minSampleSize) {
      const businessIds = allBusinesses.map((b: any) => b.id);
      const { data: menuData, error: menuError } = await supabaseClient
        .from('menu_results_v2')
        .select('business_id, menu_items, structured_data')
        .in('business_id', businessIds)
        .eq('status', 'done')
        .limit(200);
      
      if (!menuError && menuData && menuData.length > 0) {
        const benchmarks = extractBenchmarks(menuData);
        if (benchmarks.sampleSize >= minSampleSize) {
          console.log(`   ✅ Market data from all country categories: ${benchmarks.sampleSize} businesses`);
          return benchmarks;
        }
      }
    }
    
    // Insufficient data - return null to trigger fallback
    console.log('   ⚠️  Insufficient market data (<10 businesses) - using fallback thresholds');
    return null;
    
  } catch (error) {
    console.error('⚠️  Failed to fetch market benchmarks:', error);
    // CRITICAL: Return null to trigger fallback, don't let error propagate
    return null;
  }
}

/**
 * Extract price and item count benchmarks from menu data
 * @param menuData Array of menu_results_v2 records
 */
function extractBenchmarks(menuData: any[]): MarketBenchmarks {
  const prices: number[] = [];
  const itemCounts: number[] = [];
  const businessIds = new Set<string>();
  
  menuData.forEach(menu => {
    // Track unique businesses
    if (menu.business_id) {
      businessIds.add(menu.business_id);
    }
    
    // Extract item count from menu_items
    if (menu.menu_items && Array.isArray(menu.menu_items)) {
      itemCounts.push(menu.menu_items.length);
    }
    
    // Extract prices from structured_data or menu_items
    const items = menu.structured_data?.items || menu.menu_items || [];
    if (Array.isArray(items)) {
      items.forEach((item: any) => {
        const price = item.price || item.priceAmount;
        if (price && typeof price === 'number' && price > 0) {
          prices.push(price);
        }
      });
    }
  });
  
  return {
    prices,
    itemCounts,
    sampleSize: businessIds.size,  // Use unique business count
  };
}

/**
 * Calculate how broad or narrow a business's appeal is
 * Returns: { score: 0-100, tier: 'narrow' | 'moderate' | 'broad' }
 * 
 * NARROW (0-33): Fine dining, tasting menus, highly curated experiences
 * MODERATE (34-66): Standard restaurants with clear positioning
 * BROAD (67-100): Casual, AYCE, cafés - fill-the-seats operations
 * 
 * NEW: Uses percentile-based scoring relative to market when possible
 */
async function calculateSegmentationBreadth(
  programme: ProgrammeData,
  menu: MenuData,
  operations: OperationsData,
  detectedFormat: string | null,
  marketBenchmarks: MarketBenchmarks | null
): Promise<{ score: number; tier: 'narrow' | 'moderate' | 'broad' }> {
  let score = 50; // Start at moderate baseline

  // FORMAT SIGNALS (±20 points)
  const broadFormats = ['ayce', 'buffet', 'brunch_buffet', 'fast_casual', 'table_grill'];
  const narrowFormats = ['tasting_menu'];
  
  if (detectedFormat && broadFormats.includes(detectedFormat)) {
    score += 20;
  } else if (detectedFormat && narrowFormats.includes(detectedFormat)) {
    score -= 20;
  }

  // PRICE POSITIONING (±15 points)
  // NEW: Use percentile-based scoring when market data available
  const prices = menu.items
    .map(item => item.price)
    .filter((p): p is number => p !== null && p !== undefined);
  
  if (prices.length > 0) {
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    
    if (marketBenchmarks && marketBenchmarks.prices.length >= 10) {
      // PERCENTILE-BASED SCORING (adaptive to market)
      const pricePercentile = calculatePercentile(avgPrice, marketBenchmarks.prices);
      
      if (pricePercentile < 25) score += 15;        // Bottom quartile = budget-friendly
      else if (pricePercentile < 40) score += 5;    // Below average = affordable
      else if (pricePercentile > 75) score -= 15;   // Top quartile = premium/exclusive
      else if (pricePercentile > 60) score -= 5;    // Above average = moderately premium
      // 40-60 percentile = neutral (no adjustment)
      
      console.log(`   💰 Price percentile: ${pricePercentile}% (${avgPrice.toFixed(0)} vs market median ${marketBenchmarks.prices.sort((a,b) => a-b)[Math.floor(marketBenchmarks.prices.length/2)].toFixed(0)})`);
    } else {
      // FALLBACK: Hardcoded thresholds (for new markets or sparse data)
      if (avgPrice < 100) score += 15;        // Budget-friendly
      else if (avgPrice < 200) score += 5;    // Affordable
      else if (avgPrice > 400) score -= 15;   // High-end
      else if (avgPrice > 250) score -= 5;    // Premium
      
      console.log(`   💰 Price: ${avgPrice.toFixed(0)} DKK (using hardcoded thresholds - insufficient market data)`);
    }
  }

  // MENU VARIETY (±10 points)
  // NEW: Use percentile-based scoring when market data available
  const itemCount = menu.items.length;
  
  if (marketBenchmarks && marketBenchmarks.itemCounts.length >= 10) {
    // PERCENTILE-BASED SCORING (adaptive to market)
    const varietyPercentile = calculatePercentile(itemCount, marketBenchmarks.itemCounts);
    
    if (varietyPercentile > 75) score += 10;        // Top quartile = extensive variety
    else if (varietyPercentile > 60) score += 5;    // Above average = good variety
    else if (varietyPercentile < 25) score -= 10;   // Bottom quartile = highly curated
    else if (varietyPercentile < 40) score -= 5;    // Below average = limited
    // 40-60 percentile = neutral (no adjustment)
    
    console.log(`   📋 Variety percentile: ${varietyPercentile}% (${itemCount} items vs market median ${marketBenchmarks.itemCounts.sort((a,b) => a-b)[Math.floor(marketBenchmarks.itemCounts.length/2)]})`);
  } else {
    // FALLBACK: Hardcoded thresholds
    if (itemCount >= 30) score += 10;        // Extensive variety
    else if (itemCount >= 15) score += 5;    // Good variety
    else if (itemCount < 8) score -= 10;     // Highly curated
    
    console.log(`   📋 Variety: ${itemCount} items (using hardcoded thresholds - insufficient market data)`);
  }

  // OPERATIONS MODEL (±10 points)
  if (operations.accepts_walk_ins && !operations.reservation_required) {
    score += 5; // Easy access
  }
  if (operations.has_takeaway) {
    score += 5; // Broader reach
  }
  if (operations.reservation_required && !operations.accepts_walk_ins) {
    score -= 10; // Exclusive
  }

  // PROGRAMME TYPE (±10 points)
  const casualProgrammes = ['all_day', 'cafe', 'bar', 'lunch'];
  const exclusiveProgrammes = ['dinner', 'wine_bar'];
  
  if (casualProgrammes.includes(programme.programme_type)) {
    score += 5;
  } else if (exclusiveProgrammes.includes(programme.programme_type)) {
    score -= 5;
  }

  // HOURS SPAN (±5 points)
  const hoursSpan = calculateHoursSpan(programme.time_windows);
  if (hoursSpan >= 10) score += 5;  // All-day operation
  else if (hoursSpan <= 3) score -= 5;  // Limited service window

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Map to tiers
  let tier: 'narrow' | 'moderate' | 'broad';
  if (score <= 33) tier = 'narrow';
  else if (score >= 67) tier = 'broad';
  else tier = 'moderate';

  return { score, tier };
}

// ===== AI COMPLEXITY DETECTOR =====

function determineSegmentCount(
  programme: ProgrammeData,
  menu: MenuData,
  location: LocationData,
  breadth: 'narrow' | 'moderate' | 'broad'
): number {
  let score = 0;

  // Menu variety (0-2 points)
  const menuItemCount = menu.items.length;
  if (menuItemCount >= 20) score += 2;
  else if (menuItemCount >= 10) score += 1;

  // Hours span (0-2 points) — UPDATED: Longer hours need more segments for daypart coverage
  const hoursSpan = calculateHoursSpan(programme.time_windows);
  if (hoursSpan >= 8) score += 2;  // 8+ hours = likely lunch + dinner → need coverage
  else if (hoursSpan >= 5) score += 1;

  // Multi-day operation (0-2 points) — UPDATED: 7-day operation needs weekday + weekend coverage
  const operatingDays = programme.operating_days?.length || 0;
  if (operatingDays >= 6) score += 2;  // 6-7 days = need weekday + weekend segments
  else if (operatingDays >= 3) score += 1;

  // Location complexity (0-1 point)
  if (location.area_type === "tourist_area") score += 1;
  else if (location.area_type === "urban_center") score += 1;

  // Programme type signals (0-1 point)
  const complexProgrammes = ["brunch", "lunch", "all_day"];
  const simpleProgrammes = ["bar", "late_night"];
  if (complexProgrammes.includes(programme.programme_type)) score += 1;
  if (simpleProgrammes.includes(programme.programme_type)) score -= 1;

  // BREADTH CALIBRATION: Adjust max segments based on business appeal breadth
  let maxSegments: number;
  if (breadth === 'narrow') {
    maxSegments = 2;  // Focused brand - quality over coverage
  } else if (breadth === 'broad') {
    maxSegments = 4;  // Fill-the-seats - opportunistic segments allowed
  } else {
    maxSegments = 3;  // Moderate - current behavior
  }

  // Map score to segment count (2-maxSegments)
  // UPDATED scoring: Prioritize time/day coverage over menu variety
  if (score >= 6) return Math.min(maxSegments, 4);  // Complex: long hours + multi-day + variety
  if (score >= 4) return Math.min(maxSegments, 3);  // Moderate: some coverage needs
  return 2;                                          // Simple: limited hours or days
}

function calculateHoursSpan(timeWindows: string[]): number {
  if (!timeWindows.length) return 0;

  const times = timeWindows.flatMap(window => {
    const match = window.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
    if (!match) return [];
    return [
      parseInt(match[1]) * 60 + parseInt(match[2]),  // start minutes
      parseInt(match[3]) * 60 + parseInt(match[4])   // end minutes
    ];
  });

  if (times.length < 2) return 0;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  return (maxTime - minTime) / 60; // hours
}

// System prompt loaded from v5-prompts.ts at runtime via getV5Prompt('audience', language)

// ===== PROMPT BUILDER =====

function buildAudiencePrompt(
  business: BusinessData,
  menu: MenuData,
  programme: ProgrammeData,
  commercialOrientation: CommercialOrientationData,
  identity: IdentityData | undefined,
  location: LocationData,
  operations: OperationsData,
  targetSegmentCount: number,
  breadthTier: 'narrow' | 'moderate' | 'broad',
  language: string = 'da'
): string {
  const menuItems = menu.items.slice(0, 15).map(item => 
    `- ${item.name}${item.description ? `: ${item.description}` : ''}${item.price ? ` (${item.price} kr)` : ''}`
  ).join('\n');

  const primaryGoal = Object.entries(commercialOrientation.baseline_goal_split)
    .sort(([, a], [, b]) => b - a)[0][0];

  // Map Layer 2 decision_timing values to Layer 4 values for AI prompt
  const layer2ToLayer4TimingMap: Record<string, string> = {
    'last_minute': 'spontaneous',
    'planned': 'planned',
    'hybrid': 'mixed'
  };
  
  const layer4DecisionTiming = layer2ToLayer4TimingMap[commercialOrientation.decision_timing] || commercialOrientation.decision_timing;
  
  // For mixed programmes, guide AI to be SPECIFIC per segment
  const isMixedProgramme = commercialOrientation.decision_timing === 'mixed';

  // Calculate hours span for daypart coverage requirements
  const hoursSpan = calculateHoursSpan(programme.time_windows);

  // Build demographic proximity signals section (NEW ARCHITECTURE)
  const demographicProximitySection = buildDemographicProximitySignalsSection(location, language);

  // Detect programme format
  const detectedFormat = detectProgrammeFormat(menu, programme.programme_type, programme.programme_name);
  
  // Get format occasion signals
  const formatSignals = detectedFormat && FORMAT_OCCASION_SIGNALS[detectedFormat]
    ? FORMAT_OCCASION_SIGNALS[detectedFormat]
    : [];

  // Check if this is a brunch programme
  const isBrunchProgramme = programme.programme_name.toLowerCase().includes('brunch') || 
                            programme.programme_name.toLowerCase().includes('morgenmad');

  // CRITICAL: Local place name enforcement
  const localPlaceInstruction = location.local_location_reference ? `

🎯 LOKALT STEDNAVN (KRITISK):
Dette sted er beliggende "${location.local_location_reference}"
Du SKAL bruge dette præcise udtryk i alle content_angles der refererer til location.
ALDRIG opfind alternative navne eller tilføj bynavne til denne reference.
Korrekt: "ved åen" | Forkert: "ved Aarhus Å", "ved åen i Aarhus"` : '';

  const brunchWarning = isBrunchProgramme ? `

⚠️  KRITISK: Dette er et BRUNCH programme (IKKE morgenmad/breakfast)
FAKTA: Der serveres KUN brunch - ingen morgenmad/breakfast service.
FORBUDT: Content angles med "før arbejde", "quick", "hurtig", "convenience på hverdage før 10:00"
KRÆVET: Alle segments skal have social_gathering eller experience_seeking motivation
KRÆVET: Timing skal reflektere brunch hours (primært 10:00-14:00, især weekends)
KRÆVET: Content angles skal være social/leisurely: "Social brunch", "Weekend hygge", "Variation i menu"
` : '';

  // Danish prompt (fully localized with THREE-SECTION ARCHITECTURE)
  if (language === 'da') {
    return `
═══════════════════════════════════════════════════════════════════════
SEKTION A — FORRETNINGSKONCEPT
═══════════════════════════════════════════════════════════════════════

Hvad tilbyder forretningen, til hvilken pris, og i hvilket format?

Forretning: ${business.business_name}
Type: ${business.establishment_type || business.business_category}
${business.business_archetype ? `Koncepttype: ${business.business_archetype} (forretningsarketype)\n` : ''}Beliggenhed: ${location.local_location_reference || location.neighborhood || business.city}
${location.local_location_reference ? `
🎯 LOKALT STEDNAVN (KRITISK):
Brug præcis dette udtryk i content_angles og location_occasions der refererer
til stedet: "${location.local_location_reference}"
` : ''}
PROGRAM:
Program: ${programme.programme_name} (${programme.programme_type})
Åbningstider: ${programme.time_windows.join(', ')}
Åbningsdage: ${programme.operating_days.join(', ')}
${programme.languageVariants && programme.languageVariants.length > 1 ? `Menusprog: ${programme.languageVariants.join(', ')} → internationalt publikum\n` : ''}
OPERATIONS MODEL:
Walk-ins: ${operations.accepts_walk_ins ? 'JA' : 'NEJ'}
Bordbooking: ${operations.booking_url ? 'JA (booking link findes)' : operations.reservation_required ? 'PÅKRÆVET' : 'NEJ'}
Takeaway: ${operations.has_takeaway ? 'JA' : 'NEJ'}

MENU FORMAT${detectedFormat ? ` (${detectedFormat})` : ''}:
${menuItems}

${detectedFormat && formatSignals.length > 0 ? `FORMAT-SIGNALER (${detectedFormat}):
${formatSignals.map(s => `• ${s}`).join('\n')}
` : ''}${isBrunchProgramme ? `
⚠️ BRUNCH PROGRAMME: KUN social/leisure motivation — ingen "hurtig" eller "convenience" segmenter.
` : ''}
═══════════════════════════════════════════════════════════════════════
SEKTION B — STEDSFAKTA
═══════════════════════════════════════════════════════════════════════

Hvem er fysisk tilgængelig nær dette sted?

OMRÅDE:
Områdetype: ${location.area_type || 'ukendt'}
Nabolag: ${location.neighborhood || 'ikke specificeret'}
${location.physical_context ? `Fodgængerflow: ${location.physical_context.pedestrian_flow || 'ukendt'}` : ''}
${demographicProximitySection}

⚠️ Demografiske signaler viser hvem der er GEOGRAFISK TILGÆNGELIG — ikke hvem
forretningen primært er for. Forretningskonceptet i Sektion A er det afgørende filter.

═══════════════════════════════════════════════════════════════════════
SEKTION C — SEGMENTVALG
═══════════════════════════════════════════════════════════════════════

OPGAVE: Generer præcis ${targetSegmentCount} segmenter for ${programme.programme_name}.

🎯 RÆKKEFØLGE FOR VALG:

TRIN 1 — HVAD ER FORMATET OG PRISPUNKTET? (Sektion A)
Lad dette styre alt andet.
Eksempel: AYCE + bordgrill + moderat pris = social, interaktiv, overkommelig
→ Tiltrækker: familier, vennegrupper, par på budgetdate
→ Tiltrækker IKKE: solo business-frokoster, fine dining erhvervsgæster

TRIN 2 — HVEM PASSER NATURLIGT TIL DETTE FORMAT?
Vælg kun segmenter der passer til formatet uden at strække det.
${targetSegmentCount === 2 ? 'Med 2 segmenter: vælg de 2 stærkeste, ignorer resten.' : `Med ${targetSegmentCount} segmenter: bedre med ${targetSegmentCount} stærke end et ekstra tvivlsomt.`}

TRIN 3 — HVAD BRINGER DEM HERTIL, OG HVAD GIVER BELIGGENHEDEN AF MULIGHEDER?
Tænk i ANLEDNINGER, ikke i tidspunkter.
location_occasions beskriver hvad beliggenheden konkret muliggør for segmentet.
Eksempler:
• Bycentrum + shopping i nærheden → "shopping pause fra gågaden"
• Havn/vand → "destination visit med udsigt"
• Boligkvarter → "hyggelig nabolagsmiddag"
• Kontorkvarter → "kundefrokost tæt på kontoret"

VÆLG FRA DISSE 7 TYPER (brug det præcise danske navn):
• Familier — forældre med børn eller multi-generationelle grupper
• Par — to personer på date, jubilæum, eller regelmæssig udflugt
• Vennegrupper — 3–8 jævnaldrende til fejring, socialt ritual, spontan aften
• Erhverv / Forretningsgæster — eksterne forretningsmåltider: kundefrokoster,
  partnermøder, professionelt netværk. IKKE interne kollegafrokoster.
• Solo / Enkeltgæster — enkeltperson til arbejdsfrokost, self-care, tredje-sted
• Turister — rejsende der søger lokal oplevelse eller velkendt komfort
• Lokale / Stamgæster — nabokvarter-beboere eller nærliggende med gentagende besøg

⚠️ DANSK KULTUREL KONTEKST — ERHVERVSSEGMENTET:
I Danmark spiser kollegaer SJÆLDENT frokost ude sammen.
Erhverv / Forretningsgæster må KUN bruges hvis mindst ét af disse er sandt:
✓ Menuen har sæt-menuer, private dining, eller gruppebestillings-muligheder
✓ Beliggenhed er i eller tæt på et erhvervsdistrikt (kontorhuse, CBD)
✓ Forretningens koncept signalerer formel eller professionel atmosfære

═══════════════════════════════════════════════════════════════════════
NYE ENUM-FELTER (KRITISK — SKAL UDFYLDES FOR HVERT SEGMENT)
═══════════════════════════════════════════════════════════════════════

For hvert segment SKAL du nu udfylde disse tre enum-felter med præcise værdier:

🔹 customer_segment (PÅKRÆVET)
Vælg PRÆCIS ÉN værdi fra denne liste:
solo_guests, couples, friends_small_groups, families_with_children, students,
professionals, neighbourhood_locals, city_residents, domestic_visitors,
tourists, large_groups

⚠️ Forskellen mellem lokale kategorier:
• neighbourhood_locals = bor/arbejder tæt på stedet (f.eks. samme kvarter)
• city_residents = fra samme by men ikke nabolaget (f.eks. københavner fra anden bydel)
• domestic_visitors = fra andre danske byer (f.eks. Aarhusianer i København)
• tourists = udenlandske gæster eller rejsende med sightseeing-kontekst

Kollaps IKKE disse til "lokale" eller "turister" — brug den præcise kategori.

🔹 occasion_segment (PÅKRÆVET — array med 1-3 værdier)
Vælg 1-3 værdier fra denne liste (de vigtigste anledninger for dette segment):
breakfast, lunch_break, coffee_break, after_work, dinner, weekend_visit,
date_night, celebration, business_meeting, takeaway_at_home, pre_post_event,
spontaneous_stop

Eksempel for Par ved en casual restaurant:
["dinner", "date_night", "weekend_visit"]

🔹 need_segment (PÅKRÆVET — array med 1-3 værdier)  
Vælg 1-3 værdier fra denne liste (hvad der driver deres valg):
quick_and_easy, affordable, treat_indulgence, healthy_light, social_experience,
comfort_food, premium_quality, dietary_fit, local_authentic, atmosphere_experience

Eksempel for Familier ved AYCE restaurant:
["affordable", "social_experience", "comfort_food"]

🔹 people_type_label (PÅKRÆVET — fri tekst)
En naturlig dansk label til visning (f.eks. "Familier med børn", "Par på date", "Lokale stamgæster").
Dette felt bruges KUN til visning — IKKE til matching.

⚠️ Opfind IKKE nye kategori-værdier. Brug kun værdierne fra listerne ovenfor.

═══════════════════════════════════════════════════════════════════════
FELTKRAV (alle felter SKAL udfyldes)
═══════════════════════════════════════════════════════════════════════

SEGMENT_SIZE KALIBRERING (relativ rangering — IKKE absolut vurdering):
Tildel segment_size baseret på RANGERING inden for dette sæt segmenter:
• "primary": Det segment der oftest besøger denne type forretning i dette format
• "secondary": Det næst-hyppigste segment — stadig et klart og realistisk gæstepublikum
• "niche": Kun hvis segmentet er genuint sjældent for dette format og prisniveau

Præcis ÉT segment må have "primary". Resten fordeles mellem "secondary" og "niche"
ud fra relativ hyppighed — IKKE ud fra om de er "vigtige nok" i absolut forstand.

Eksempel for AYCE restaurant med moderat pris (3 segmenter):
✓ Vennegrupper → primary (grupper er kernemålgruppen for AYCE-format)
✓ Familier → secondary (familier besøger regelmæssigt, ikke sjældent)
✓ Par → secondary (par er et klart publikum ved moderat pris — IKKE niche)
✗ Par → niche (forkert — par er ikke sjældne gæster ved AYCE til 150-200 kr)

DECISION_TIMING KALIBRERING (lad operationsmodel og pris styre):
Brug IKKE "planned" som default for sociale segmenter. Spørg i stedet:
• Kræver forretningen reservation? → JA = "planned", NEJ = fortsæt
• Er prisen høj (premium/upscale)? → JA = "planned", NEJ = fortsæt
• Er formatet spontant tilgængeligt (AYCE, café, casual)? → JA = overvej "spontaneous" eller "mixed"

Tommelfingerregel:
• Walk-ins accepteret + moderat pris + casual format → "spontaneous" eller "mixed"
• Reservation påkrævet ELLER premium pris → "planned"
• Familier og vennegrupper koordinerer ofte lidt på forhånd → "mixed" er oftest korrekt
• Par ved casual AAYE → "spontaneous" eller "mixed" (ikke "planned" — de booker ikke bord til sushi)

• people_type: Præcis én af de 7 typer ovenfor (eksakt dansk stavning)
• segment_size: "primary", "secondary", eller "niche"
• motivation: "social_gathering", "convenience", "experience_seeking", eller "routine"
• decision_timing: "spontaneous", "planned", eller "mixed"
• content_angles: 2-3 framing-hints til content generation (på dansk)
• location_occasions: 1-2 konkrete anledninger beliggenheden muliggør (på dansk)
• concept_fit_reason: Én linje der refererer til BÅDE format (Sektion A) OG
  stedssignal (Sektion B). Minimum 20 tegn.
  Eksempel: "AYCE + bordgrill er socialt gruppeformat — passer til venner der
  vil hygge sig en aften ${location.local_location_reference ? `ved ${location.local_location_reference}` : 'i centrum'}"
• evidence: 1-2 konkrete facts fra Sektion A (menupunkter, åbningstider, programtype)

Generer nu præcis ${targetSegmentCount} segmenter.`;
  }
  
  
  // English fallback (for other markets) with THREE-SECTION ARCHITECTURE
  return `
═══════════════════════════════════════════════════════════════════════
SECTION A — BUSINESS CONCEPT
═══════════════════════════════════════════════════════════════════════

What does the business offer, at what price, and in what format?

Business: ${business.business_name}
Type: ${business.establishment_type || business.business_category}
Location: ${location.local_location_reference || location.neighborhood || business.city}

PROGRAMME:
Programme: ${programme.programme_name} (${programme.programme_type})
Operating Hours: ${programme.time_windows.join(', ')}
Operating Days: ${programme.operating_days.join(', ')}
${programme.languageVariants && programme.languageVariants.length > 1 ? `Menu Languages: ${programme.languageVariants.join(', ')} → international audience\n` : ''}
OPERATIONS MODEL:
Walk-ins: ${operations.accepts_walk_ins ? 'YES' : 'NO'}
Table booking: ${operations.booking_url ? 'YES (booking link exists)' : operations.reservation_required ? 'REQUIRED' : 'NO'}
Takeaway: ${operations.has_takeaway ? 'YES' : 'NO'}

MENU FORMAT${detectedFormat ? ` (${detectedFormat})` : ''}:
${menuItems}

${detectedFormat && formatSignals.length > 0 ? `FORMAT SIGNALS (${detectedFormat}):
${formatSignals.map(s => `• ${s}`).join('\n')}
` : ''}
═══════════════════════════════════════════════════════════════════════
SECTION B — LOCATION FACTS
═══════════════════════════════════════════════════════════════════════

Who is physically reachable near this location?

AREA:
Area Type: ${location.area_type || 'unknown'}
Neighborhood: ${location.neighborhood || 'not specified'}
${location.physical_context ? `Pedestrian Flow: ${location.physical_context.pedestrian_flow || 'unknown'}` : ''}
${demographicProximitySection}

⚠️ Demographic signals show who is GEOGRAPHICALLY REACHABLE — not who the
business primarily targets. Business concept in Section A is the primary filter.

═══════════════════════════════════════════════════════════════════════
SECTION C — SEGMENT SELECTION
═══════════════════════════════════════════════════════════════════════

TASK: Generate exactly ${targetSegmentCount} segments for ${programme.programme_name}.

🎯 SELECTION ORDER:

STEP 1 — WHAT IS THE FORMAT AND PRICE POINT? (Section A)
Let this drive everything else.
Example: AYCE + table grill + moderate price = social, interactive, accessible
→ Attracts: families, friend groups, couples on a budget date
→ Does NOT attract: solo business lunches, fine dining corporate guests

STEP 2 — WHO NATURALLY FITS THIS FORMAT?
Choose only segments that fit the format without stretching it.
${targetSegmentCount === 2 ? 'With 2 segments: choose the 2 strongest, ignore the rest.' : `With ${targetSegmentCount} segments: better to have ${targetSegmentCount} strong ones than one extra doubtful segment.`}

STEP 3 — WHAT BRINGS THEM HERE, AND WHAT DOES THE LOCATION MAKE POSSIBLE?
Think in OCCASIONS, not time slots.
location_occasions describes what the location concretely enables for this segment.
Examples:
• City centre + nearby shopping → "shopping break from the high street"
• Harbour/waterfront → "destination visit with a view"
• Residential area → "neighbourhood dinner close to home"
• Office district → "client lunch near the office"

CHOOSE FROM THESE 7 TYPES:
• Familier — parents with children or multi-generational groups
• Par — two people on a date, anniversary, or regular outing
• Vennegrupper — 3–8 peers for celebration, social ritual, spontaneous evening
• Erhverv / Forretningsgæster — external business meals: client lunches, partner
  meetings, professional networking. NOT internal colleague lunches.
• Solo / Enkeltgæster — solo diner for work lunch, self-care, third place
• Turister — travelers seeking local experience or familiar comfort
• Lokale / Stamgæster — neighborhood residents or nearby workers with repeat visits

═══════════════════════════════════════════════════════════════════════
NEW ENUM FIELDS (CRITICAL — MUST BE FILLED FOR EACH SEGMENT)
═══════════════════════════════════════════════════════════════════════

For each segment you MUST now fill these three enum fields with precise values:

🔹 customer_segment (REQUIRED)
Select EXACTLY ONE value from this list:
solo_guests, couples, friends_small_groups, families_with_children, students,
professionals, neighbourhood_locals, city_residents, domestic_visitors,
tourists, large_groups

⚠️ The distinction between local categories:
• neighbourhood_locals = live/work close to the venue (e.g., same neighborhood)
• city_residents = from same city but not the immediate neighborhood (e.g., Copenhagener from another district)
• domestic_visitors = from other Danish cities (e.g., Aarhusian visiting Copenhagen)
• tourists = foreign guests or travelers with sightseeing as context

Do NOT collapse these into "locals" or "tourists" — use the precise category.

🔹 occasion_segment (REQUIRED — array with 1-3 values)
Select 1-3 values from this list (the main occasions for this segment):
breakfast, lunch_break, coffee_break, after_work, dinner, weekend_visit,
date_night, celebration, business_meeting, takeaway_at_home, pre_post_event,
spontaneous_stop

Example for Couples at a casual restaurant:
["dinner", "date_night", "weekend_visit"]

🔹 need_segment (REQUIRED — array with 1-3 values)
Select 1-3 values from this list (what drives their choice):
quick_and_easy, affordable, treat_indulgence, healthy_light, social_experience,
comfort_food, premium_quality, dietary_fit, local_authentic, atmosphere_experience

Example for Families at AYCE restaurant:
["affordable", "social_experience", "comfort_food"]

🔹 people_type_label (REQUIRED — free text)
A natural display label (e.g., "Families with children", "Couples on dates", "Local regulars").
This field is used ONLY for display — NOT for matching.

⚠️ Do NOT invent new category values. Use only the values from the lists above.

═══════════════════════════════════════════════════════════════════════
FIELD REQUIREMENTS (all fields MUST be populated)
═══════════════════════════════════════════════════════════════════════

SEGMENT_SIZE CALIBRATION (relative ranking — NOT absolute judgment):
Assign segment_size based on RANKING within this segment set:
• "primary": The segment that most frequently visits this type of business in this format
• "secondary": The next most frequent — still a clear and realistic guest audience
• "niche": Only if the segment is genuinely rare for this format and price point

Exactly ONE segment may be "primary". Distribute the rest between "secondary" and
"niche" based on relative frequency — NOT based on whether they feel "important enough".

Example for AYCE restaurant at moderate price (3 segments):
✓ Vennegrupper → primary (groups are the core audience for AYCE format)
✓ Familier → secondary (families visit regularly, not rarely)
✓ Par → secondary (couples are a clear audience at moderate prices — NOT niche)
✗ Par → niche (wrong — couples are not rare guests at AYCE for 150-200 DKK)

DECISION_TIMING CALIBRATION (let operations model and price drive this):
Do NOT default to "planned" for social segments. Instead ask:
• Does the business require reservation? → YES = "planned", NO = continue
• Is the price high (premium/upscale)? → YES = "planned", NO = continue
• Is the format spontaneously accessible (AYCE, café, casual)? → YES = consider "spontaneous" or "mixed"

Rule of thumb:
• Walk-ins accepted + moderate price + casual format → "spontaneous" or "mixed"
• Reservation required OR premium price → "planned"
• Families and friend groups often coordinate a little in advance → "mixed" is usually correct
• Couples at casual AYCE → "spontaneous" or "mixed" (not "planned" — they don't book tables for sushi)

• people_type: Exactly one of the 7 types above (exact spelling)
• segment_size: "primary", "secondary", or "niche"
• motivation: "social_gathering", "convenience", "experience_seeking", or "routine"
• decision_timing: "spontaneous", "planned", or "mixed"
• content_angles: 2-3 framing hints for content generation
• location_occasions: 1-2 concrete occasions the location enables (minimum 1)
• concept_fit_reason: One line referencing BOTH format (Section A) AND
  location signal (Section B). Minimum 20 characters.
• evidence: 1-2 concrete facts from Section A (menu items, hours, programme type)

Generate exactly ${targetSegmentCount} segments.`;
}

// ===== VALIDATION =====

// ===== SEGMENT NORMALIZATION =====

/**
 * Normalize segments by adding people_type_id from label lookup.
 * Sets validation_failed flag if people_type is invalid.
 */
function normalizeSegments(segments: AudienceSegment[]): AudienceSegment[] {
  // Create label to ID mapping
  const labelToId: Record<string, PeopleTypeId> = {};
  Object.entries(PEOPLE_TYPES).forEach(([id, def]) => {
    labelToId[def.label] = id as PeopleTypeId;
  });

  return segments.map(segment => {
    const normalized = { ...segment };

    // Add people_type_id if people_type is valid
    if (segment.people_type && labelToId[segment.people_type]) {
      normalized.people_type_id = labelToId[segment.people_type];
    } else if (segment.people_type) {
      // Warn if people_type is invalid (not in canonical list)
      console.warn(`⚠️  Segment "${segment.people_type}" has invalid people_type (not in canonical list)`);
    }

    return normalized;
  });
}

// ===== PEOPLE_TYPE COERCION =====

// Map common AI people_type variants → canonical labels. The model sometimes
// returns a near-synonym (e.g. "Professionelle" instead of "Erhverv /
// Forretningsgæster"); coercing here means one mislabelled segment never
// hard-fails the entire brand profile. Unknown values fall back to a safe
// default with a warning — we never throw over a label.
const PEOPLE_TYPE_SYNONYMS: Record<string, string> = {
  'professionelle': 'Erhverv / Forretningsgæster',
  'professionel': 'Erhverv / Forretningsgæster',
  'professional': 'Erhverv / Forretningsgæster',
  'professionals': 'Erhverv / Forretningsgæster',
  'erhverv': 'Erhverv / Forretningsgæster',
  'forretningsgæster': 'Erhverv / Forretningsgæster',
  'forretning': 'Erhverv / Forretningsgæster',
  'business': 'Erhverv / Forretningsgæster',
  'business professionals': 'Erhverv / Forretningsgæster',
  'familier': 'Familier',
  'familie': 'Familier',
  'family': 'Familier',
  'families': 'Familier',
  'børnefamilier': 'Familier',
  'par': 'Par',
  'couple': 'Par',
  'couples': 'Par',
  'dates': 'Par',
  'vennegrupper': 'Vennegrupper',
  'venner': 'Vennegrupper',
  'friends': 'Vennegrupper',
  'friend groups': 'Vennegrupper',
  'grupper': 'Vennegrupper',
  'solo': 'Solo / Enkeltgæster',
  'solo / enkeltgæster': 'Solo / Enkeltgæster',
  'enkeltgæster': 'Solo / Enkeltgæster',
  'single': 'Solo / Enkeltgæster',
  'turister': 'Turister',
  'tourist': 'Turister',
  'tourists': 'Turister',
  'lokale': 'Lokale / Stamgæster',
  'lokale / stamgæster': 'Lokale / Stamgæster',
  'stamgæster': 'Lokale / Stamgæster',
  'locals': 'Lokale / Stamgæster',
  'regulars': 'Lokale / Stamgæster',
}

function coercePeopleTypeLabel(raw: string | undefined): string {
  if (!raw) return 'Lokale / Stamgæster'
  const trimmed = raw.trim()
  if (VALID_PEOPLE_TYPE_LABELS.includes(trimmed as any)) return trimmed
  const key = trimmed.toLowerCase()
  if (PEOPLE_TYPE_SYNONYMS[key]) {
    console.warn(`[Audience] Coerced people_type "${trimmed}" → "${PEOPLE_TYPE_SYNONYMS[key]}"`)
    return PEOPLE_TYPE_SYNONYMS[key]
  }
  for (const [syn, canonical] of Object.entries(PEOPLE_TYPE_SYNONYMS)) {
    if (key.includes(syn)) {
      console.warn(`[Audience] Coerced people_type "${trimmed}" → "${canonical}" (partial match)`)
      return canonical
    }
  }
  console.warn(`[Audience] Unknown people_type "${trimmed}" → default "Lokale / Stamgæster"`)
  return 'Lokale / Stamgæster'
}

// ===== VALIDATION =====

function validateAudienceProfile(
  profile: ProgrammeAudienceProfile,
  commercialOrientation: CommercialOrientationData,
  programme: ProgrammeData,
  targetSegmentCount: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check segment count
  if (profile.audience_segments.length < 2 || profile.audience_segments.length > 4) {
    errors.push(`Segment count must be 2-4, got ${profile.audience_segments.length}`);
  }

  if (profile.audience_segments.length !== targetSegmentCount) {
    errors.push(`Expected ${targetSegmentCount} segments, got ${profile.audience_segments.length}`);
  }

  // Check primary segment exists
  const primarySegment = profile.audience_segments.find(s => s.segment_size === "primary");
  if (!primarySegment) {
    errors.push("No primary segment found");
  }

  // Validate each segment
  profile.audience_segments.forEach((segment, index) => {
    // === NEW: Enum Validation (Phase 1) ===
    
    // Validate customer_segment (required enum)
    const validCustomerSegments = new Set<CustomerSegmentKey>([
      "solo_guests", "couples", "friends_small_groups", "families_with_children",
      "students", "professionals", "neighbourhood_locals", "city_residents",
      "domestic_visitors", "tourists", "large_groups",
    ]);
    
    if (segment.customer_segment && !validCustomerSegments.has(segment.customer_segment as CustomerSegmentKey)) {
      errors.push(`Segment ${index + 1}: invalid customer_segment "${segment.customer_segment}"`);
    }
    
    // Validate occasion_segment (required array of enums)
    const validOccasionSegments = new Set<OccasionSegmentKey>([
      "breakfast", "lunch_break", "coffee_break", "after_work", "dinner",
      "weekend_visit", "date_night", "celebration", "business_meeting",
      "takeaway_at_home", "pre_post_event", "spontaneous_stop",
    ]);
    
    if (segment.occasion_segment) {
      if (!Array.isArray(segment.occasion_segment)) {
        errors.push(`Segment ${index + 1}: occasion_segment must be an array`);
      } else if (!segment.occasion_segment.every(o => validOccasionSegments.has(o as OccasionSegmentKey))) {
        const invalidOccasions = segment.occasion_segment.filter(o => !validOccasionSegments.has(o as OccasionSegmentKey));
        errors.push(`Segment ${index + 1}: invalid occasion_segment value(s): ${invalidOccasions.join(', ')}`);
      }
    }
    
    // Validate need_segment (required array of enums)
    const validNeedSegments = new Set<NeedSegmentKey>([
      "quick_and_easy", "affordable", "treat_indulgence", "healthy_light",
      "social_experience", "comfort_food", "premium_quality", "dietary_fit",
      "local_authentic", "atmosphere_experience",
    ]);
    
    if (segment.need_segment) {
      if (!Array.isArray(segment.need_segment)) {
        errors.push(`Segment ${index + 1}: need_segment must be an array`);
      } else if (!segment.need_segment.every(n => validNeedSegments.has(n as NeedSegmentKey))) {
        const invalidNeeds = segment.need_segment.filter(n => !validNeedSegments.has(n as NeedSegmentKey));
        errors.push(`Segment ${index + 1}: invalid need_segment value(s): ${invalidNeeds.join(', ')}`);
      }
    }
    
    // Detect duplicate customer_segment within same programme (data error)
    const customerSegmentCounts = new Map<string, number>();
    profile.audience_segments.forEach(seg => {
      if (seg.customer_segment) {
        const count = customerSegmentCounts.get(seg.customer_segment) || 0;
        customerSegmentCounts.set(seg.customer_segment, count + 1);
      }
    });
    customerSegmentCounts.forEach((count, key) => {
      if (count > 1) {
        errors.push(`Duplicate customer_segment within programme: "${key}" appears ${count} times`);
      }
    });
    
    // === LEGACY: Erhverv gate ===
    
    // Erhverv gate: business segment requires explicit evidence
    if (
      segment.people_type === 'Erhverv / Forretningsgæster' &&
      (!segment.evidence || segment.evidence.length === 0 ||
        !segment.concept_fit_reason || segment.concept_fit_reason.length < 30)
    ) {
      errors.push(
        `Segment ${index + 1}: "Erhverv / Forretningsgæster" requires explicit ` +
        `concept_fit_reason (min 30 chars) and evidence referencing business ` +
        `concept signals (formal atmosphere, set menus, business district, ` +
        `or group booking features).`
      );
    }

    if (!segment.people_type) {
      errors.push(`Segment ${index + 1}: people_type missing`);
    } else if (!VALID_PEOPLE_TYPE_LABELS.includes(segment.people_type as any)) {
      errors.push(`Segment ${index + 1}: invalid people_type "${segment.people_type}" ` +
        `(must be one of: ${VALID_PEOPLE_TYPE_LABELS.join(', ')})`);
    }

    if (!segment.content_angles || segment.content_angles.length < 2) {
      errors.push(`Segment ${index + 1}: need at least 2 content_angles`);
    }

    // NOTE: location_occasions temporarily optional during AI training period (June 28, 2026)
    // Will be made required once OpenAI consistently generates it
    if (segment.location_occasions && segment.location_occasions.length === 0) {
      errors.push(`Segment ${index + 1}: location_occasions cannot be empty array (omit field or provide min 1 entry)`);
    }

    if (!segment.evidence || segment.evidence.length < 1) {
      errors.push(`Segment ${index + 1}: need at least 1 evidence item`);
    }

    if (!segment.concept_fit_reason || segment.concept_fit_reason.length < 20) {
      errors.push(`Segment ${index + 1}: concept_fit_reason missing or too short ` +
        `(must reference both business format AND location signal)`);
    }

    if (!["primary", "secondary", "niche"].includes(segment.segment_size)) {
      errors.push(`Segment ${index + 1}: invalid segment_size "${segment.segment_size}"`);
    }

    if (!["social_gathering", "convenience", "experience_seeking", "routine"].includes(segment.motivation)) {
      errors.push(`Segment ${index + 1}: invalid motivation "${segment.motivation}"`);
    }

    if (!["spontaneous", "planned", "mixed"].includes(segment.decision_timing)) {
      errors.push(`Segment ${index + 1}: invalid decision_timing "${segment.decision_timing}"`);
    }
  });

  // Check confidence
  if (profile.segment_confidence < 0 || profile.segment_confidence > 1) {
    errors.push(`segment_confidence must be 0-1, got ${profile.segment_confidence}`);
  }

  // Check reasoning
  if (!profile.segment_reasoning || profile.segment_reasoning.length < 20) {
    errors.push("segment_reasoning too short or missing");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ===== DEMOGRAPHIC FILTER VALIDATION =====

/**
 * Validate segments respect location context constraints
 * Catches AI hallucinations where it ignores the guard
 * Phase 3: Updated to use reachable_location_contexts (with backward compatibility)
 */
function validateDemographicFiltering(
  profile: ProgrammeAudienceProfile,
  location: LocationData
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Phase 3: Check new field first, fall back to old field for backward compatibility
  const locationContexts = location.reachable_location_contexts || location.reachable_demographics;
  if (!locationContexts || locationContexts.length === 0) {
    return { valid: true, warnings }; // No guard data - skip validation
  }

  const filteredDemographics = locationContexts
    .filter(d => !d.is_reachable)
    .map(d => d.demographic.toLowerCase());

  if (filteredDemographics.length === 0) {
    return { valid: true, warnings }; // All demographics reachable - no filtering needed
  }

  // Check each segment label and content for filtered demographic references
  profile.audience_segments.forEach((segment, index) => {
    const labelLower = segment.people_type.toLowerCase();
    const contentAnglesLower = segment.content_angles.join(' ').toLowerCase();

    filteredDemographics.forEach(demo => {
      // Common patterns for each demographic
      const patterns: Record<string, string[]> = {
        'tourist': ['turist', 'tourist', 'visitor', 'besøgende', 'traveler', 'rejsende'],
        'student': ['student', 'studerende', 'university', 'universitet', 'college'],
        'business_professional': ['business', 'forretning', 'corporate', 'kontor', 'office'],
        'local_resident': ['local', 'lokal', 'resident', 'beboer', 'neighbor']
      };

      const demoPatterns = patterns[demo] || [demo];
      
      demoPatterns.forEach(pattern => {
        if (labelLower.includes(pattern)) {
          warnings.push(
            `⚠️  Segment ${index + 1} "${segment.people_type}" references filtered demographic "${demo}" (reason: ${locationContexts?.find(d => d.demographic === demo)?.filter_reason})`
          );
        }

        if (contentAnglesLower.includes(pattern)) {
          warnings.push(
            `⚠️  Segment ${index + 1} content_angles reference filtered demographic "${demo}" (reason: ${locationContexts?.find(d => d.demographic === demo)?.filter_reason})`
          );
        }
      });
    });
  });

  return {
    valid: warnings.length === 0,
    warnings
  };
}

// ===== MAIN GENERATION FUNCTION =====

export async function generateAudienceSegments(
  business: BusinessData,
  menu: MenuData,
  programme: ProgrammeData,
  commercialOrientation: CommercialOrientationData,
  identity: IdentityData | undefined,
  location: LocationData,
  operations: OperationsData,
  apiKey: string,
  supabaseClient?: any,  // NEW: Optional Supabase client for market benchmarks
  businessId?: string,   // NEW: Business ID for excluding self from benchmarks
  language: string = 'da'  // Multi-language support (default Danish)
): Promise<ProgrammeAudienceProfile> {
  // Log demographic guard status (Phase 3: use new field with backward compatibility)
  const locationContextsForLog = location.reachable_location_contexts || location.reachable_demographics;
  if (locationContextsForLog && locationContextsForLog.length > 0) {
    const reachable = locationContextsForLog.filter(d => d.is_reachable);
    const filtered = locationContextsForLog.filter(d => !d.is_reachable);
    console.log(`🛡️  Location context guard active: ${reachable.length} reachable, ${filtered.length} filtered`);
    if (reachable.length > 0) {
      console.log(`   ✓ Reachable: ${reachable.map(d => `${d.demographic} (${d.proximity_score})`).join(', ')}`);
    }
    if (filtered.length > 0) {
      console.log(`   ✗ Filtered: ${filtered.map(d => `${d.demographic} (${d.filter_reason})`).join(', ')}`);
    }
  }

  // Fetch market benchmarks for percentile-based breadth calculation (if client provided)
  let marketBenchmarks: MarketBenchmarks | null = null;
  
  try {
    if (supabaseClient && businessId && business.business_category && business.city) {
      console.log(`📊 Fetching market benchmarks (category: ${business.business_category}, city: ${business.city})...`);
      marketBenchmarks = await fetchMarketBenchmarks(
        supabaseClient,
        business.business_category,
        'Denmark',  // TODO: Get from business.country when available
        business.city,
        businessId
      );
      
      if (marketBenchmarks) {
        console.log(`   ✅ Market data: ${marketBenchmarks.sampleSize} similar businesses, ${marketBenchmarks.prices.length} prices, ${marketBenchmarks.itemCounts.length} menus`);
      } else {
        console.log(`   ⚠️  Insufficient market data - using hardcoded thresholds`);
      }
    }
  } catch (error) {
    console.error('⚠️  Error fetching market benchmarks, falling back to hardcoded thresholds:', error);
    marketBenchmarks = null;  // Ensure we use fallback
  }

  // Detect programme format (needed for breadth calculation)
  const detectedFormat = detectProgrammeFormat(menu, programme.programme_type, programme.programme_name);

  // Calculate segmentation breadth (now async with market benchmarks)
  // Wrap in try-catch to ensure graceful degradation if calculation fails
  let breadthResult: { score: number; tier: 'narrow' | 'moderate' | 'broad' };
  try {
    breadthResult = await calculateSegmentationBreadth(programme, menu, operations, detectedFormat, marketBenchmarks);
  } catch (error) {
    console.error('⚠️  Error calculating breadth, using default MODERATE tier:', error);
    // Fallback to moderate tier if calculation fails
    breadthResult = { score: 50, tier: 'moderate' };
  }
  
  console.log(`📊 Segmentation Breadth: ${breadthResult.tier.toUpperCase()} (score: ${breadthResult.score}/100)`);
  console.log(`   Format: ${detectedFormat || 'none detected'}, Avg price: ${menu.items.filter(i => i.price).length > 0 ? Math.round(menu.items.filter(i => i.price).map(i => i.price!).reduce((a,b) => a+b, 0) / menu.items.filter(i => i.price).length) : 'N/A'} DKK, Items: ${menu.items.length}`);

  // Determine optimal segment count (breadth-calibrated)
  const targetSegmentCount = determineSegmentCount(programme, menu, location, breadthResult.tier);

  console.log(`🎯 AI Complexity Detector: ${targetSegmentCount} segments recommended for ${programme.programme_name}`);
  console.log(`   Menu items: ${menu.items.length}, Hours span: ${calculateHoursSpan(programme.time_windows).toFixed(1)}h, Area: ${location.area_type}`);

  // Build prompt (language-aware, breadth-calibrated)
  const userPrompt = buildAudiencePrompt(
    business,
    menu,
    programme,
    commercialOrientation,
    identity,
    location,
    operations,
    targetSegmentCount,
    breadthResult.tier,  // Pass breadth tier for calibration
    language             // Pass language to prompt builder
  );

  // Call OpenAI
  const client = new OpenAI({ apiKey });

  console.log(`🤖 Calling OpenAI (gpt-4o-mini, temperature 0.3, max_tokens 1500)...`);

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: getV5Prompt('audience', language) },  // Multi-language system prompt
      { role: "user", content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: "json_object" }
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const result = JSON.parse(content);

  const profile: ProgrammeAudienceProfile = {
    programme_type: programme.programme_type,
    programme_name: programme.programme_name,
    // Coerce AI people_type variants (e.g. "Professionelle") to canonical labels
    // BEFORE validation so one mislabelled segment never hard-fails the profile.
    audience_segments: (result.audience_segments || []).map((s: AudienceSegment) => ({
      ...s,
      people_type: coercePeopleTypeLabel(s.people_type),
    })),
    segment_confidence: result.segment_confidence || 0,
    segment_reasoning: result.segment_reasoning || ""
  };

  // Validate
  const validation = validateAudienceProfile(
    profile,
    commercialOrientation,
    programme,
    targetSegmentCount
  );

  if (!validation.valid) {
    console.error("❌ Validation failed:", validation.errors);
    throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
  }

  // Validate demographic filtering (guard compliance)
  const filterValidation = validateDemographicFiltering(profile, location);
  if (!filterValidation.valid) {
    console.warn("⚠️  Demographic filter warnings:");
    filterValidation.warnings.forEach(warning => console.warn(`   ${warning}`));
    // Log warnings but don't fail - AI sometimes uses creative segment names
  }

  // Normalize segments: add people_type_id from label lookup
  profile.audience_segments = normalizeSegments(profile.audience_segments);

  console.log(`✅ Generated ${profile.audience_segments.length} segments (confidence: ${profile.segment_confidence.toFixed(2)})`);

  return profile;
}
