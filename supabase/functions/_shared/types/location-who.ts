/**
 * Physical Anchor Taxonomy v3: WHO Types
 * 
 * WHO is physically in this area (business-blind facts).
 * Replaces demographic_proximity with semantic structure.
 */

// Valid WHO types (11 distinct personas)
export type WhoType = 
  | 'local_resident'      // Lives within 1km, routine daily presence
  | 'office_worker'       // Works in nearby offices, weekday presence
  | 'student'             // University/college students (requires 400-600m campus proximity)
  | 'shopper'             // Active shoppers in retail district
  | 'tourist'             // International/domestic leisure visitors
  | 'commuter'            // In transit through transport hub
  | 'leisure_walker'      // Walking for pleasure (waterfront, park)
  | 'family'              // Parents with children
  | 'medical_staff'       // Hospital/clinic staff (requires 300-500m hospital proximity)
  | 'hospital_visitor'    // Visiting patients (requires 300-500m hospital proximity)
  | 'event_visitor';      // Attending nearby event venue

/**
 * WHO field structure
 */
export interface LocationWho {
  /**
   * Primary WHO types (dominant presence, 70%+ of foot traffic)
   * Must have at least one primary type.
   */
  primary: WhoType[];
  
  /**
   * Secondary WHO types (significant but not dominant, 30-70% of traffic)
   * Can be empty if location has single dominant audience.
   */
  secondary: WhoType[];
  
  /**
   * Optional clarifying notes (e.g., "University campus 450m north, students flood area 08:00–18:00 during semester")
   * Use for proximity gate evidence, temporal patterns, or special conditions.
   */
  notes?: string;
}

/**
 * Traffic rhythm: WHEN does this location generate foot traffic
 */
export interface TrafficRhythm {
  /**
   * Peak traffic days
   * - 'weekday': Monday-Friday dominance
   * - 'weekend': Saturday-Sunday dominance
   * - 'both': Relatively even distribution
   */
  peak_days: 'weekday' | 'weekend' | 'both';
  
  /**
   * Peak traffic hours (Danish format with en-dash)
   * Examples: "08:00–09:30 og 11:30–13:30", "10:00–22:00", "07:00–09:00 og 16:00–18:00"
   */
  peak_hours: string;
  
  /**
   * Dead periods (when is it empty?)
   * Examples: "efter 17:00 og weekender", "søndag efter 17:00", "mandag–tirsdag"
   */
  dead_periods: string;
  
  /**
   * Seasonal traffic pattern
   * - 'stable': Year-round consistency (±10%)
   * - 'summer_peak': 50-100% summer boost
   * - 'semester_only': University areas (70% drop in summer)
   * - 'retail_calendar': Shopping areas (Christmas boost, January slump)
   */
  seasonal_pattern: 'stable' | 'summer_peak' | 'semester_only' | 'retail_calendar';
  
  /**
   * Optional seasonal notes
   * Examples: "Sommerferie: -40%", "Vinter: 50% af sommertrafik", "Jul: +50%, januar: -30%"
   */
  seasonal_note?: string;
}

/**
 * Proximity gate validation for specialized WHO types
 */
export interface ProximityGate {
  type: 'university_campus' | 'hospital_campus' | 'event_venue' | 'waterfront' | 'shopping' | 'transport_hub';
  min_distance_m: number;
  max_distance_m: number;
  poi_name: string;  // Name of qualifying landmark
  actual_distance_m: number;
}

/**
 * Type guard: check if WHO type requires proximity gate
 */
export function requiresProximityGate(whoType: WhoType): boolean {
  return [
    'student',           // Requires university_campus within 400-600m
    'medical_staff',     // Requires hospital_campus within 300-500m
    'hospital_visitor',  // Requires hospital_campus within 300-500m
    'event_visitor'      // Requires event venue within 200-250m (secondary only)
  ].includes(whoType);
}

/**
 * Get proximity gate requirements for WHO type
 */
export function getProximityGateRequirements(whoType: WhoType): { min: number; max: number } | null {
  switch (whoType) {
    case 'student':
      return { min: 400, max: 600 };
    case 'medical_staff':
    case 'hospital_visitor':
      return { min: 300, max: 500 };
    case 'event_visitor':
      return { min: 200, max: 250 };
    default:
      return null;
  }
}
