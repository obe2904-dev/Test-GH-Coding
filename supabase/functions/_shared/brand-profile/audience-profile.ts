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
    label: 'Erhverv / Kollegaer',
    label_en: 'Business / Corporate Groups',
    social_unit: 'Colleagues, client dinners, team lunches',
    decision_style: 'Booked in advance, expense account, needs quiet and service',
    strong_format_fit: ['a_la_carte', 'set_menu', 'lunch_casual'],
    poor_format_fit: ['ayce_all_you_can_drink', 'loud_bar', 'fast_casual'],
    strong_dayparts: ['frokost'],
    poor_dayparts: ['natbar', 'brunch_weekend'],
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
  people_type: string;              // Must match VALID_PEOPLE_TYPE_LABELS (e.g., "Familier", "Par")
  people_type_id?: PeopleTypeId;    // Derived in parser from label lookup (e.g., "familier", "par")
  label: string;                    // DEPRECATED: Use people_type instead. Kept for backward compatibility.
  timing_windows: string[];         // ["Lør-Søn 10:00-13:00"]
  content_angles: string[];         // ["Børnevenlig menu", "Hyggelige weekender"]
  segment_size: string;             // "primary" | "secondary" | "niche"
  motivation: string;               // "social_gathering" | "convenience" | "experience_seeking"
  decision_timing: string;          // "spontaneous" | "planned" | "mixed"
  goal_contribution: string;        // "drive_footfall" | "drive_booking" | "strengthen_brand" | "retain_regulars"
  evidence: string[];               // ["Menu has børneportioner", "Weekend hours 09:00-13:00"]
  concept_fit_reason: string;       // Why this segment fits the business concept + location (REQUIRED)
  situation?: string;               // Concrete occasion description (e.g., "Familier med børn der ønsker...")
  validation_failed?: boolean;      // Set by parser if validation fails (does NOT block generation)
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

  // Legacy fallback: if only reachable_demographics exists (old architecture)
  if (location.reachable_demographics && location.reachable_demographics.length > 0) {
    const signals = location.reachable_demographics;

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
    let query = supabaseClient
      .from('businesses')
      .select(`
        id,
        business_category,
        city,
        menu_results_v2!inner(menu_items, structured_data)
      `)
      .eq('country', country)
      .eq('business_category', businessCategory)
      .neq('id', currentBusinessId);  // Exclude current business
    
    if (city) {
      query = query.eq('city', city);
    }
    
    const { data: cityData } = await query.limit(100);
    
    // If we have enough data from city, use it
    if (cityData && cityData.length >= minSampleSize) {
      return extractBenchmarks(cityData);
    }
    
    // Try 2: Same country + same category (broader)
    const { data: countryData } = await supabaseClient
      .from('businesses')
      .select(`
        id,
        business_category,
        menu_results_v2!inner(menu_items, structured_data)
      `)
      .eq('country', country)
      .eq('business_category', businessCategory)
      .neq('id', currentBusinessId)
      .limit(100);
    
    if (countryData && countryData.length >= minSampleSize) {
      return extractBenchmarks(countryData);
    }
    
    // Try 3: Same country, all categories (fallback)
    const { data: allData } = await supabaseClient
      .from('businesses')
      .select(`
        id,
        menu_results_v2!inner(menu_items, structured_data)
      `)
      .eq('country', country)
      .neq('id', currentBusinessId)
      .limit(100);
    
    if (allData && allData.length >= minSampleSize) {
      return extractBenchmarks(allData);
    }
    
    // Insufficient data - return null to trigger fallback
    return null;
    
  } catch (error) {
    console.error('⚠️  Failed to fetch market benchmarks:', error);
    return null;
  }
}

/**
 * Extract price and item count benchmarks from business data
 */
function extractBenchmarks(businessData: any[]): MarketBenchmarks {
  const prices: number[] = [];
  const itemCounts: number[] = [];
  
  businessData.forEach(business => {
    const menuResults = business.menu_results_v2;
    if (!menuResults || menuResults.length === 0) return;
    
    menuResults.forEach((menu: any) => {
      // Extract item count
      if (menu.menu_items && Array.isArray(menu.menu_items)) {
        itemCounts.push(menu.menu_items.length);
      }
      
      // Extract prices from structured_data or menu_items
      const items = menu.structured_data?.items || menu.menu_items || [];
      items.forEach((item: any) => {
        const price = item.price || item.priceAmount;
        if (price && typeof price === 'number' && price > 0) {
          prices.push(price);
        }
      });
    });
  });
  
  return {
    prices,
    itemCounts,
    sampleSize: businessData.length
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

Beskrivelse af hvad forretningen faktisk tilbyder, hvordan, og til hvilken pris.

Forretning: ${business.business_name}
Type: ${business.establishment_type || business.business_category}
Beliggenhed: ${location.local_location_reference || location.neighborhood || business.city}
${localPlaceInstruction}

PROGRAM OG TIDSVINDUER:
Program: ${programme.programme_name} (${programme.programme_type})
Åbningstider: ${programme.time_windows.join(', ')}
Åbningsdage: ${programme.operating_days.join(', ')}
${programme.meal_periods && programme.meal_periods.length > 0 ? `Måltidsperioder dækket: ${programme.meal_periods.join(', ')} (afledt fra tidsvindue)\n` : ''}${programme.day_pattern ? `Dagsmønster: ${programme.day_pattern}\n` : ''}${programme.languageVariants && programme.languageVariants.length > 1 ? `Menusprog: ${programme.languageVariants.join(', ')} (→ internationalt publikum)\n` : ''}
OPERATIONS MODEL:
Walk-ins: ${operations.accepts_walk_ins ? 'JA (footfall mål tilgængeligt)' : 'NEJ'}
Bordbooking: ${operations.booking_url ? `JA - booking_url findes (booking mål tilgængeligt)` : operations.reservation_required ? 'PÅKRÆVET (booking mål SKAL bruges)' : 'NEJ'}
Bordservice: ${operations.has_table_service ? 'JA' : 'NEJ'}
Takeaway: ${operations.has_takeaway ? 'JA' : 'NEJ'}
${operations.booking_url ? `→ Dette sted har BÅDE walk-in OG booking → segmenter kan vælge FORSKELLIGE mål afhængigt af timing/kontekst\n` : operations.accepts_walk_ins ? `→ KUN walk-in → brug primært "drive_footfall" mål\n` : operations.reservation_required ? `→ Booking PÅKRÆVET → brug "drive_booking" mål\n` : ''}
MENU FORMAT${detectedFormat ? ` (${detectedFormat})` : ''}:
${menuItems}

${detectedFormat && formatSignals.length > 0 ? `FORMAT-ANLEDNING SIGNALER (${detectedFormat}):
${formatSignals.map(s => `• ${s}`).join('\n')}
` : ''}
PRISPOSITIONERING: ${business.business_name ? 'Se menupunkter ovenfor' : 'Ikke specificeret'}
${brunchWarning}
${identity ? `
BRAND IDENTITET:
Brand essence: ${identity.brand_essence}
Positionering: ${identity.positioning}
Kerneværdier: ${identity.core_values.join(', ')}
USP: ${identity.what_makes_us_different}
` : ''}
═══════════════════════════════════════════════════════════════════════
SEKTION B — STEDSFAKTA
═══════════════════════════════════════════════════════════════════════

Rå signaler om hvem der er fysisk tilstede nær dette sted og hvornår.

OMRÅDE & KARAKTER:
Områdetype: ${location.area_type || 'ukendt'}
Nabolag: ${location.neighborhood || 'ikke specificeret'}
${location.physical_context ? `
FYSISK KONTEKST:
Fodgængerflow: ${location.physical_context.pedestrian_flow || 'ukendt'}
${location.physical_context.transit_within_150m ? `Transit inden for 150m: ${location.physical_context.nearest_transit?.name || 'ja'}` : ''}
${location.physical_context.parking_within_300m ? 'Parkering inden for 300m: ja' : ''}
` : ''}${demographicProximitySection}

⚠️ KRITISK BEMÆRK: Disse er GEOGRAFISKE NÆRHEDSSIGNALER. De indikerer hvem der
KUNNE VÆRE tilgængelig, IKKE hvem forretningen primært er for. FORRETNINGSKONCEPTET
i Sektion A er den primære determinant for målgruppen.

═══════════════════════════════════════════════════════════════════════
SEKTION C — ANLEDNINGSLOGIK
═══════════════════════════════════════════════════════════════════════

OPGAVE: Generer præcis ${targetSegmentCount} målgruppesegmenter for ${programme.programme_name}.

🎯 SEGMENTERINGS-BREDDE: ${breadthTier.toUpperCase()}
${breadthTier === 'narrow' ? `Dette er en FOKUSERET brand (fine dining, tasting menu, eksklusiv oplevelse):
• KUN segmenter med STÆRK concept_fit (format + location + occasion passer perfekt)
• Prioritér brand-purity over at fylde alle tidsvinduer
• Acceptér at nogle slots kan være tomme — det er bedre end at udvande brandopfattelsen
` : breadthTier === 'broad' ? `Dette er en BRED-APPEL forretning (AYCE, café, casual dining, street food):
• Acceptable at strække segmenter for at fylde kapacitet
• Tomme seats = tabt revenue — opportunistiske segmenter er OK hvis concept_fit er rimelig (ikke perfekt)
• Weekday/off-peak slots SKAL dækkes — hjælp forretningen drive business på stille dage
` : `Dette er en MODERAT brand (standard restaurant med klar positionering):
• Balancér brand-fit med kommerciel realitet
• Primære segmenter skal have stærk concept_fit
• Sekundære segmenter kan være mere opportunistiske hvis de fylder vigtige gaps
`}
⏰ KRITISK: DÆKNINGSKRAV FOR TIDSVINDUER
Dette programme opererer ${programme.time_windows.join(', ')} på ${programme.operating_days.join(', ')}.
${hoursSpan >= 6 ? `
Med ${hoursSpan.toFixed(0)} timers åbningstid SKAL dine segmenter dække FORSKELLIGE DAYPARTS:
• Hvis åbent til frokost (11:00-15:00) → mindst ét segment skal dække dette vindue
• Hvis åbent til aftensmad (17:00-22:00) → mindst ét segment skal dække dette vindue
• Hvis åbent alle 7 dage → segmenter skal dække BÅDE hverdage OG weekend (ikke kun weekend)

FORBUDT: Alle segmenter med samme timing (fx alle "Fredag 18:00-22:00")
PÅKRÆVET: Segmenter skal hjælpe drive business på FORSKELLIGE tidspunkter og dage
` : ''}
${programme.operating_days.length >= 6 ? `
📅 KRITISK: DAG-DÆKNINGSKRAV
Dette sted er åbent ${programme.operating_days.length} dage om ugen (inkl. hverdage).
• Mindst ét segment SKAL dække hverdage (Man-Tors) — hjælp fyld hverdagsslots
• Mindst ét segment SKAL dække weekend (Fre-Søn) — dæk peak demand
• Forskellige segments kan dække FORSKELLIGE dage baseret på deres motivation og context

Eksempel korrekt fordeling for 7-dages operation:
✓ Familier på weekendmiddag (Lør-Søn 12:00-16:00) — weekend lunch
✓ Erhverv på hverdagsfrokost (Man-Fre 12:00-14:00) — weekday lunch  
✓ Par på hverdagsaften (Tir-Tor 18:00-21:00) — mid-week dinner
✓ Vennegrupper på fredagsaften (Fre 18:00-22:00) — peak weekend start

Eksempel FORKERT (kun peak times):
✗ Alle segmenter er Fredag eller Weekend — ignorerer Man-Tors helt
` : ''}
VÆLG FRA DISSE KANONISKE TYPER:
Du SKAL vælge fra præcis én af disse 7 universelle typer for hver segment:
• Familier — forældre med børn eller multi-generationelle grupper
• Par — to personer på date, jubilæum, eller regelmæssig udflugt
• Vennegrupper — 3–8 jævnaldrende til fejring, socialt ritual, spontan aften
• Erhverv / Kollegaer — kolleger, kundemiddage, team-frokoster
• Solo / Enkeltgæster — enkeltperson til arbejdsfrokost, self-care, tredje-sted
• Turister — rejsende der søger lokal oplevelse eller velkendt komfort
• Lokale / Stamgæster — nabokvarter-beboere eller nærliggende arbejdende med gentagende besøg

For hvert potentielt segment skal du gennemtænke følgende:

1. PASSER FORRETNINGSFORMATET til denne type person?
   (AYCE passer til grupper, ikke solo-spisende. Smagsmenu passer til par, ikke familier med små børn.)

2. GØR STEDETS BELIGGENHED denne person tilgængelig i det relevante tidsvinduer?

3. Hvilken specifik ANLEDNING bringer denne person hertil — hvad fejrer de,
   undslipper fra, eller prøver at opnå?

Kun overflade et segment hvis det består alle tre checks.

KRITISKE ALIGNMENT REGLER:
• Primært segment goal_contribution SKAL være: ${primaryGoal}
${isMixedProgramme ? `• Programmet har MIXED timing — vælg den mest passende timing per segment:
  - "planned" hvis segmentet primært booker/planlægger
  - "spontaneous" hvis segmentet primært beslutter samme dag
  - "mixed" KUN hvis segmentet har BEGGE mønstre ægte` : `• Primært segment decision_timing SKAL være: ${layer4DecisionTiming}`}

SEGMENTERINGS-STRATEGI (KRITISK):
Prioriter ANLEDNINGS-baserede segmenter:

PRIMÆR AKSE (social kontekst + anledning):
• Familier (aftensmåltid, weekendmiddage, børnefødselsdag)
• Venner (casual dining, grin og hygge, fredagsaften)
• Par (date night, stille middag for to, fejre jubilæum)
• Grupper (fællesspisning, firmafester, vennegrupper der deler retter)
• Enkeltpersoner (quick lunch, arbejdsaftensmad, stamkunder)

BEVIS & CONCEPT FIT KRAV (NYT KRAV):
Hvert segment SKAL inkludere:
• "people_type": Præcis én af de 7 kanoniske typer ovenfor (f.eks. "Familier", "Par", "Vennegrupper")
• "concept_fit_reason": En-linje begrundelse der refererer til BÅDE forretningsformat 
  (fra Sektion A) OG stedssignal (fra Sektion B)
  Eksempel: "AYCE + bordgrill er et socialt gruppeformat — passer til venner der vil 
  hygge sig en aften i ${location.local_location_reference || 'centrum'}"
• "evidence": Konkrete facts fra Sektion A (menupunkter, åbningstider, programtype)

SPROG KRAV:
- TEXT-felter SKAL være på DANSK: people_type, label, content_angles, evidence, segment_reasoning, concept_fit_reason
- ENUM-felter SKAL være på ENGELSK: motivation, decision_timing, goal_contribution, segment_size

Generer nu ${targetSegmentCount} segmenter med komplet people_type, concept_fit_reason og evidenskæde.`;
  }
  
  
  // English fallback (for other markets) with THREE-SECTION ARCHITECTURE
  return `
═══════════════════════════════════════════════════════════════════════
SECTION A — BUSINESS CONCEPT
═══════════════════════════════════════════════════════════════════════

Description of what the business actually offers, how, and at what price point.

Business: ${business.business_name}
Type: ${business.establishment_type || business.business_category}
Location: ${location.local_location_reference || location.neighborhood || business.city}

PROGRAMME & TIME WINDOWS:
Programme: ${programme.programme_name} (${programme.programme_type})
Operating Hours: ${programme.time_windows.join(', ')}
Operating Days: ${programme.operating_days.join(', ')}
${programme.languageVariants && programme.languageVariants.length > 1 ? `Menu Languages: ${programme.languageVariants.join(', ')} (→ international audience)\n` : ''}

MENU FORMAT${detectedFormat ? ` (${detectedFormat})` : ''}:
${menuItems}

${detectedFormat && formatSignals.length > 0 ? `FORMAT-OCCASION SIGNALS (${detectedFormat}):
${formatSignals.map(s => `• ${s}`).join('\n')}
` : ''}
PRICE POSITIONING: See menu items above
${brunchWarning}
${identity ? `
BRAND IDENTITY:
Brand Essence: ${identity.brand_essence}
Positioning: ${identity.positioning}
Core Values: ${identity.core_values.join(', ')}
USP: ${identity.what_makes_us_different}
` : ''}
═══════════════════════════════════════════════════════════════════════
SECTION B — LOCATION FACTS
═══════════════════════════════════════════════════════════════════════

Raw signals about who is physically present near this location and when.

AREA & CHARACTER:
Area Type: ${location.area_type || 'unknown'}
Neighborhood: ${location.neighborhood || 'not specified'}
${location.physical_context ? `
PHYSICAL CONTEXT:
Pedestrian Flow: ${location.physical_context.pedestrian_flow || 'unknown'}
${location.physical_context.transit_within_150m ? `Transit within 150m: ${location.physical_context.nearest_transit?.name || 'yes'}` : ''}
${location.physical_context.parking_within_300m ? 'Parking within 300m: yes' : ''}
` : ''}${demographicProximitySection}

⚠️ CRITICAL NOTE: These are GEOGRAPHIC PROXIMITY SIGNALS. They indicate who
COULD BE reachable, NOT who the business is primarily for. BUSINESS CONCEPT
in Section A is the primary determinant of the target audience.

═══════════════════════════════════════════════════════════════════════
SECTION C — OCCASION LOGIC
═══════════════════════════════════════════════════════════════════════

TASK: Generate exactly ${targetSegmentCount} audience segments for ${programme.programme_name}.

🎯 SEGMENTATION BREADTH: ${breadthTier.toUpperCase()}
${breadthTier === 'narrow' ? `This is a FOCUSED brand (fine dining, tasting menu, exclusive experience):
• ONLY segments with STRONG concept_fit (format + location + occasion align perfectly)
• Prioritize brand purity over filling all time slots
• Accept that some slots may be empty — better than diluting brand perception
` : breadthTier === 'broad' ? `This is a BROAD-APPEAL business (AYCE, café, casual dining, street food):
• Acceptable to stretch segments to fill capacity
• Empty seats = lost revenue — opportunistic segments OK if concept_fit is reasonable (not perfect)
• Weekday/off-peak slots MUST be covered — help business drive revenue on quiet days
` : `This is a MODERATE brand (standard restaurant with clear positioning):
• Balance brand fit with commercial reality
• Primary segments should have strong concept_fit
• Secondary segments can be more opportunistic if they fill important gaps
`}
For each potential segment, reason through the following:

1. Does the business FORMAT suit this type of person?
   (AYCE suits groups, not solo diners. Tasting menu suits couples, not families with toddlers.)

2. Does the LOCATION make this person reachable at the relevant time windows?

3. What specific OCCASION brings this person here — what are they celebrating,
   escaping from, or trying to accomplish?

Only surface a segment if it passes all three checks.

CRITICAL ALIGNMENT RULES:
• Primary segment goal_contribution MUST be: ${primaryGoal}
${isMixedProgramme ? `• Programme has MIXED timing — choose most appropriate timing per segment:
  - "planned" if segment primarily books/plans ahead
  - "spontaneous" if segment primarily decides same-day
  - "mixed" ONLY if segment has BOTH patterns genuinely` : `• Primary segment decision_timing MUST be: ${layer4DecisionTiming}`}

SEGMENTATION STRATEGY (CRITICAL):
Prioritize OCCASION-based segments:

PRIMARY AXIS (social context + occasion):
• Families (dinner out, weekend meals, children's birthdays)
• Friends (casual dining, laughs and hangout, Friday nights)
• Couples (date night, quiet dinner for two, celebrating anniversary)
• Groups (shared dining, corporate parties, friend groups sharing dishes)
• Individuals (quick lunch, work dinner, regulars)

EVIDENCE & CONCEPT FIT REQUIREMENTS (NEW REQUIREMENT):
Each segment MUST include:
• "concept_fit_reason": One-line justification referencing BOTH business format 
  (from Section A) AND location signal (from Section B)
  Example: "AYCE + table grill is a social group format — fits friends looking for 
  a fun evening in ${location.local_location_reference || 'city center'}"
• "evidence": Concrete facts from Section A (menu items, hours, programme type)

LANGUAGE REQUIREMENTS:
- TEXT fields in ${language === 'da' ? 'DANISH' : 'ENGLISH'}: label, content_angles, evidence, segment_reasoning, concept_fit_reason
- ENUM fields in ENGLISH: motivation, decision_timing, goal_contribution, segment_size

Generate ${targetSegmentCount} segments with complete concept_fit_reason and evidence chain.`;
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
      normalized.validation_failed = false;
    } else {
      // Set validation_failed if people_type is missing or invalid
      console.warn(`⚠️  Segment "${segment.label || 'unknown'}" has invalid people_type: "${segment.people_type}"`);
      normalized.validation_failed = true;
    }

    // Backward compatibility: if label not set but people_type is, copy it
    if (!normalized.label && normalized.people_type) {
      normalized.label = normalized.people_type;
    }

    return normalized;
  });
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
  } else {
    // For non-mixed programmes, validate primary segment matches programme timing
    // For mixed programmes, allow AI to choose specific timing per segment
    if (commercialOrientation.decision_timing !== 'hybrid') {
      const layer2TimingMap: Record<string, string> = {
        'last_minute': 'spontaneous',
        'planned': 'planned'
      };
      
      const expectedTiming = layer2TimingMap[commercialOrientation.decision_timing] || commercialOrientation.decision_timing;
      
      if (primarySegment.decision_timing !== expectedTiming) {
        errors.push(
          `Primary segment decision_timing (${primarySegment.decision_timing}) must match Layer 2 (${expectedTiming}, from ${commercialOrientation.decision_timing})`
        );
      }
    }
    // For mixed programmes: No validation - trust AI to choose appropriate timing per segment

    const primaryGoal = Object.entries(commercialOrientation.baseline_goal_split)
      .sort(([, a], [, b]) => b - a)[0][0];
    
    if (primarySegment.goal_contribution !== primaryGoal) {
      errors.push(
        `Primary segment goal_contribution (${primarySegment.goal_contribution}) must match Layer 2 primary goal (${primaryGoal})`
      );
    }
  }

  // Validate each segment
  profile.audience_segments.forEach((segment, index) => {
    if (!segment.label || segment.label.length < 3) {
      errors.push(`Segment ${index + 1}: label too short or missing`);
    }

    // Check for generic/forbidden terms (expanded list)
    const genericPattern = /\b(customers|locals|people|guests|tourists|families|couples|visitors|patrons)\b/i;
    if (genericPattern.test(segment.label)) {
      errors.push(`Segment ${index + 1}: label too generic ("${segment.label}") - use role + context instead`);
    }

    if (!segment.timing_windows || segment.timing_windows.length === 0) {
      errors.push(`Segment ${index + 1}: timing_windows missing`);
    }

    if (!segment.content_angles || segment.content_angles.length < 2) {
      errors.push(`Segment ${index + 1}: need at least 2 content_angles`);
    }

    if (!segment.evidence || segment.evidence.length < 2) {
      errors.push(`Segment ${index + 1}: need at least 2 evidence items`);
    }

    // NEW: Validate concept_fit_reason (CRITICAL for new architecture)
    if (!segment.concept_fit_reason || segment.concept_fit_reason.length < 20) {
      errors.push(`Segment ${index + 1}: concept_fit_reason missing or too short (must reference both business format AND location/timing)`);
    }

    // NEW: Validate people_type (CRITICAL for canonical taxonomy)
    if (!segment.people_type) {
      errors.push(`Segment ${index + 1}: people_type missing (must be one of the 7 canonical types)`);
    } else if (!VALID_PEOPLE_TYPE_LABELS.includes(segment.people_type as any)) {
      errors.push(`Segment ${index + 1}: invalid people_type "${segment.people_type}" (must be one of: ${VALID_PEOPLE_TYPE_LABELS.join(', ')})`);
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

    if (!["drive_footfall", "drive_booking", "strengthen_brand", "retain_regulars"].includes(segment.goal_contribution)) {
      errors.push(`Segment ${index + 1}: invalid goal_contribution "${segment.goal_contribution}"`);
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
 * Validate segments respect reachable_demographics constraints
 * Catches AI hallucinations where it ignores the guard
 */
function validateDemographicFiltering(
  profile: ProgrammeAudienceProfile,
  location: LocationData
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!location.reachable_demographics || location.reachable_demographics.length === 0) {
    return { valid: true, warnings }; // No guard data - skip validation
  }

  const filteredDemographics = location.reachable_demographics
    .filter(d => !d.is_reachable)
    .map(d => d.demographic.toLowerCase());

  if (filteredDemographics.length === 0) {
    return { valid: true, warnings }; // All demographics reachable - no filtering needed
  }

  // Check each segment label and content for filtered demographic references
  profile.audience_segments.forEach((segment, index) => {
    const labelLower = segment.label.toLowerCase();
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
            `⚠️  Segment ${index + 1} "${segment.label}" references filtered demographic "${demo}" (reason: ${location.reachable_demographics?.find(d => d.demographic === demo)?.filter_reason})`
          );
        }

        if (contentAnglesLower.includes(pattern)) {
          warnings.push(
            `⚠️  Segment ${index + 1} content_angles reference filtered demographic "${demo}" (reason: ${location.reachable_demographics?.find(d => d.demographic === demo)?.filter_reason})`
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
  // Log demographic guard status
  if (location.reachable_demographics && location.reachable_demographics.length > 0) {
    const reachable = location.reachable_demographics.filter(d => d.is_reachable);
    const filtered = location.reachable_demographics.filter(d => !d.is_reachable);
    console.log(`🛡️  Demographic guard active: ${reachable.length} reachable, ${filtered.length} filtered`);
    if (reachable.length > 0) {
      console.log(`   ✓ Reachable: ${reachable.map(d => `${d.demographic} (${d.proximity_score})`).join(', ')}`);
    }
    if (filtered.length > 0) {
      console.log(`   ✗ Filtered: ${filtered.map(d => `${d.demographic} (${d.filter_reason})`).join(', ')}`);
    }
  }

  // Fetch market benchmarks for percentile-based breadth calculation (if client provided)
  let marketBenchmarks: MarketBenchmarks | null = null;
  
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

  // Detect programme format (needed for breadth calculation)
  const detectedFormat = detectProgrammeFormat(menu, programme.programme_type, programme.programme_name);

  // Calculate segmentation breadth (now async with market benchmarks)
  const breadthResult = await calculateSegmentationBreadth(programme, menu, operations, detectedFormat, marketBenchmarks);
  
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
    audience_segments: result.audience_segments || [],
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
