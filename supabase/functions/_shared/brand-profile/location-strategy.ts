/**
 * Location Strategy Module
 * 
 * Generates positioning angles and content triggers by crossing:
 * - Location geography (category_scores — WHERE the business is)
 * - Location demographics (demographic_proximity — WHO passes by)
 * - Business facts (pricing, booking, programmes — WHO the business serves)
 * 
 * This crossing is the critical step that was missing when these were
 * computed in populate-location-intelligence (which had no business facts).
 */

import { 
  getLocationStrategyConfig, 
  isDemographicReachable,
  type LocationStrategyConfig 
} from './location-strategy-config.ts';

import { 
  analyzeCompetitiveGap,
  type CompetitiveGapOutput 
} from './competitive-gap-analyzer.ts';

export interface LocationStrategyInput {
  // WHERE (from category_scores)
  location_scores: Record<string, number>;
  
  // WHO PASSES BY (from demographic_proximity)
  demographic_proximity: Record<string, number>;
  
  // Physical environment
  physical_context: {
    pedestrian_flow?: string;
    transit_within_150m?: boolean;
    parking_within_300m?: boolean;
    nearest_transit?: { name: string; distance_meters: number } | null;
  } | null;
  
  // Business facts (the filter layer)
  business: {
    name: string;
    category: string;
    avg_price?: number | null;
    booking_required?: boolean;
    accepts_walkins?: boolean;
    has_outdoor_seating?: boolean;
    about?: string;
    programmes: Array<{ 
      type: string; 
      label: string; 
      time_windows: string[] 
    }>;
  };
  
  // Area facts
  neighborhood: string | null;
  neighborhood_character: string | null;
  local_location_reference: string | null;
  
  // Raw competitors
  raw_competitive_venues?: Array<{
    name: string;
    distance_meters: number;
    rating?: number;
    price_level?: number;
    user_ratings_total?: number;
  }> | null;
  
  language?: string;
  
  // Optional: OpenAI client for competitive gap analysis
  openai_client?: any;
}

export interface DemographicProximitySignal {
  demographic: string;
  proximity_score: number;
  signal_source: string;
  caveat?: string;
}

export interface ReachableDemographic {
  demographic: string;
  proximity_score: number;
  is_reachable: boolean;
  filter_reason?: string;
}

export interface LocationStrategyOutput {
  // Proximity signals for AI reasoning (replacing pre-filtered reachable_demographics)
  demographic_proximity_signals: DemographicProximitySignal[];
  
  // Legacy field for backward compatibility (still computed and stored)
  reachable_demographics: ReachableDemographic[];
  
  // Positioning angles — how to frame the business in content
  positioning_angles: string[];
  
  // Content triggers — specific hooks for social posts
  content_triggers: string[];
  
  // Physical opportunity signals
  physical_opportunities: string[];
  
  // Competitive positioning (without naming competitors)
  competitive_gap: CompetitiveGapOutput | null;
}

/**
 * Generate demographic proximity signals for AI reasoning
 * Returns all demographics as signals with context, not as pre-filtered decisions
 */
function generateDemographicProximitySignals(
  demographicProximity: Record<string, number>,
  locationScores: Record<string, number>
): DemographicProximitySignal[] {
  const signals: DemographicProximitySignal[] = [];
  const cityCentreScore = locationScores['city_centre'] || 0;

  for (const [demographic, score] of Object.entries(demographicProximity)) {
    const signal: DemographicProximitySignal = {
      demographic,
      proximity_score: score,
      signal_source: `demographic_proximity.${demographic} from location intelligence`
    };

    // Add caveat for tourist_flow when high city_centre score
    if (demographic === 'tourist' && cityCentreScore >= 80 && score >= 50) {
      signal.caveat = 'High score reflects central geographic positioning and pedestrian visibility, NOT that tourists are the primary intended audience. Only surface tourists as a segment if the business concept (menu, format, price, language) independently supports tourist appeal.';
    }

    // Add caveat for city_centre mapping to tourist
    if (demographic === 'tourist_flow' && cityCentreScore >= 80) {
      signal.signal_source = 'city_centre score maps to tourist visibility, NOT tourist intent';
      signal.caveat = 'High city_centre score reflects central location, not that tourists are the target segment';
    }

    signals.push(signal);
  }

  return signals.sort((a, b) => b.proximity_score - a.proximity_score);
}

/**
 * Map database demographic names to filter logic names
 */
function mapDemographicName(dbDemographic: string): string {
  const mapping: Record<string, string> = {
    'tourist_flow': 'tourist',
    'university_proximity': 'student',
    // Add more mappings as needed
  };
  return mapping[dbDemographic] || dbDemographic;
}

/**
 * Derive which demographics are actually reachable given business format.
 * This is the core crossing logic.
 */
function deriveReachableDemographics(
  demographicProximity: Record<string, number>,
  business: LocationStrategyInput['business'],
  config: LocationStrategyConfig
): ReachableDemographic[] {
  const results: ReachableDemographic[] = [];

  for (const [dbDemographic, score] of Object.entries(demographicProximity)) {
    // Map database name to filter logic name
    const filterDemographic = mapDemographicName(dbDemographic);
    
    const { is_reachable, filter_reason } = isDemographicReachable(
      filterDemographic,
      score,
      {
        avg_price: business.avg_price,
        booking_required: business.booking_required,
        accepts_walkins: business.accepts_walkins
      },
      config
    );

    results.push({
      demographic: dbDemographic, // Keep original database name for output
      proximity_score: score,
      is_reachable,
      filter_reason
    });
  }

  return results.sort((a, b) => {
    // Reachable first, then by proximity score
    if (a.is_reachable !== b.is_reachable) return a.is_reachable ? -1 : 1;
    return b.proximity_score - a.proximity_score;
  });
}

/**
 * Generate positioning angles from geography and demographics
 */
function generatePositioningAngles(
  locationScores: Record<string, number>,
  reachableDemographics: ReachableDemographic[],
  locationRef: string,
  config: LocationStrategyConfig
): string[] {
  const angles: string[] = [];
  const reachable = reachableDemographics.filter(d => d.is_reachable);

  // --- Positioning angles from geography ---
  const cityCentreScore = locationScores['city_centre'] || 0;
  const waterfrontScore = locationScores['waterfront'] || 0;
  const residentialScore = locationScores['residential'] || 0;
  const officeScore = locationScores['office'] || 0;

  if (cityCentreScore >= 70) {
    angles.push(`Central location in ${locationRef} — convenience positioning`);
  }
  if (waterfrontScore >= 60) {
    angles.push(`Waterfront proximity — atmosphere and seasonal content opportunity`);
  }
  if (residentialScore >= 60) {
    angles.push(`Neighbourhood dining — local loyalty and repeat visit positioning`);
  }
  if (officeScore >= 60) {
    angles.push(`Business district location — weekday lunch and networking positioning`);
  }

  // --- Positioning angles from reachable demographics ---
  for (const demo of reachable) {
    if (demo.proximity_score < config.proximity_thresholds.high_proximity) continue;

    if (demo.demographic === 'local_resident') {
      angles.push(`Strong local residential base — "your local" positioning`);
    }
    if (demo.demographic === 'office_worker' || demo.demographic === 'business_professional') {
      angles.push(`Business district proximity — lunch and after-work positioning`);
    }
    if (demo.demographic === 'tourist') {
      angles.push(`Tourist-accessible location — discovery and first-visit content`);
    }
    if (demo.demographic === 'student') {
      angles.push(`Student area proximity — value and social dining positioning`);
    }
  }

  return angles;
}

/**
 * Generate content triggers from physical context and programmes
 */
function generateContentTriggers(
  physicalContext: LocationStrategyInput['physical_context'],
  programmes: LocationStrategyInput['business']['programmes'],
  reachableDemographics: ReachableDemographic[],
  waterfrontScore: number,
  hasOutdoorSeating: boolean
): string[] {
  const triggers: string[] = [];
  const reachable = reachableDemographics.filter(d => d.is_reachable);

  // --- Content triggers from physical context ---
  if (physicalContext?.pedestrian_flow === 'very_high' || 
      physicalContext?.pedestrian_flow === 'high') {
    triggers.push('High foot traffic — "walk-in welcome" and visibility content');
  }
  
  if (physicalContext?.transit_within_150m) {
    triggers.push('Transit-adjacent — commuter timing content (morning, evening rush)');
  }
  
  if (physicalContext?.parking_within_300m) {
    triggers.push('Parking nearby — "easy to get to by car" for suburban audience');
  }
  
  if (hasOutdoorSeating && waterfrontScore >= 40) {
    triggers.push('Outdoor seating near water — weather-triggered content ("terrasse er åben")');
  }

  // --- Content triggers from programme timing ---
  for (const programme of programmes) {
    if (programme.type === 'lunch' && 
        (reachable.some(d => d.demographic === 'office_worker' || d.demographic === 'business_professional') ||
         reachable.some(d => d.demographic === 'local_resident'))) {
      const timeWindow = programme.time_windows[0] || 'lunch hours';
      triggers.push(`Lunch programme (${timeWindow}) — workday decision content`);
    }
    
    if (programme.type === 'dinner' && 
        reachable.some(d => d.demographic === 'tourist')) {
      triggers.push(`Dinner programme — evening discovery content for visitors`);
    }
    
    if (programme.type === 'brunch' &&
        reachable.some(d => d.demographic === 'local_resident')) {
      triggers.push(`Brunch programme — weekend leisure content for locals`);
    }
  }

  return triggers;
}

/**
 * Generate physical opportunity signals
 */
function generatePhysicalOpportunities(
  physicalContext: LocationStrategyInput['physical_context']
): string[] {
  const opportunities: string[] = [];

  if (physicalContext?.pedestrian_flow === 'very_high' || 
      physicalContext?.pedestrian_flow === 'high') {
    opportunities.push('Spontaneous visit capture — window signage / sidewalk presence');
  }
  
  if (physicalContext?.transit_within_150m) {
    opportunities.push('Commuter audience — early open or late kitchen as content angle');
  }
  
  if (physicalContext?.parking_within_300m) {
    opportunities.push('Car accessibility — "easy to reach" messaging for suburban guests');
  }

  return opportunities;
}

/**
 * Main function: Generate location strategy from crossed signals
 * Rule-based — fast, no AI (except competitive gap), deterministic
 */
export async function generateLocationStrategy(
  input: LocationStrategyInput
): Promise<LocationStrategyOutput> {
  // Validate input (category can be empty string - fallback to 'restaurant')
  if (!input.business?.name) {
    console.warn('Invalid business input - missing name');
    return {
      demographic_proximity_signals: [],
      reachable_demographics: [],
      positioning_angles: [],
      content_triggers: [],
      physical_opportunities: [],
      competitive_gap: null
    };
  }

  // Get configuration
  const config = getLocationStrategyConfig();

  // Generate demographic proximity signals (for AI reasoning)
  const demographicProximitySignals = Object.keys(input.demographic_proximity || {}).length > 0
    ? generateDemographicProximitySignals(
        input.demographic_proximity,
        input.location_scores
      )
    : [];

  // Derive reachable demographics (legacy - for backward compatibility and storage)
  const reachableDemographics = Object.keys(input.demographic_proximity || {}).length > 0
    ? deriveReachableDemographics(
        input.demographic_proximity,
        input.business,
        config
      )
    : [];

  // Generate positioning angles
  const locationRef = input.local_location_reference || input.neighborhood || 'området';
  const positioningAngles = generatePositioningAngles(
    input.location_scores,
    reachableDemographics,
    locationRef,
    config
  );

  // Generate content triggers
  const waterfrontScore = input.location_scores['waterfront'] || 0;
  const contentTriggers = generateContentTriggers(
    input.physical_context,
    input.business.programmes || [],
    reachableDemographics,
    waterfrontScore,
    input.business.has_outdoor_seating || false
  );

  // Generate physical opportunities
  const physicalOpportunities = generatePhysicalOpportunities(
    input.physical_context
  );

  // Analyze competitive gap (AI-driven if client provided)
  let competitiveGap: CompetitiveGapOutput | null = null;
  if (input.raw_competitive_venues && input.raw_competitive_venues.length > 0) {
    try {
      competitiveGap = await analyzeCompetitiveGap(
        {
          business: {
            name: input.business.name,
            category: input.business.category,
            avg_price: input.business.avg_price,
            about: input.business.about
          },
          competitors: input.raw_competitive_venues,
          neighborhood: input.neighborhood
        },
        input.openai_client
      );
    } catch (error) {
      console.warn('Competitive gap analysis failed:', error);
      // Continue without competitive gap - not critical
    }
  }

  return {
    demographic_proximity_signals: demographicProximitySignals,
    reachable_demographics: reachableDemographics,
    positioning_angles: positioningAngles,
    content_triggers: contentTriggers,
    physical_opportunities: physicalOpportunities,
    competitive_gap: competitiveGap
  };
}
