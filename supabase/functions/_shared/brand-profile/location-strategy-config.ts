/**
 * Location Strategy Configuration
 * Centralized thresholds with data-driven defaults
 * 
 * SCHEMA V3 (Physical Anchor Taxonomy):
 * - Supports WHO field structure {primary, secondary, notes}
 * - Enforces proximity gates for university_campus and hospital_campus
 * - Backward compatible with v2 demographic_proximity scores
 * 
 * Rationale: Hardcoded values provide stability, but can be overridden
 * per-business if needed. Track performance data to tune over time.
 */

// V3: WHO type proximity gate requirements
export const PROXIMITY_GATES = {
  university_campus: { min: 400, max: 600 },  // meters
  hospital_campus: { min: 300, max: 500 },    // meters
  event_venue: { min: 200, max: 250 },        // meters (secondary only)
  waterfront: { min: 0, max: 150 },           // meters
  shopping: { min: 0, max: 200 },             // meters
  transport_hub: { min: 0, max: 300 },        // meters
} as const;

export interface LocationStrategyConfig {
  // Budget thresholds (DKK)
  demographic_filters: {
    tourist: {
      max_price: number;
      requires_walkin: boolean;
    };
    student: {
      max_price: number;
    };
    office_worker: {
      min_price: number;
    };
    business_professional: {  // DEPRECATED: Use office_worker instead (kept for backwards compatibility)
      min_price: number;
    };
  };
  
  // Proximity score thresholds (0-100)
  proximity_thresholds: {
    minimum_relevance: number; // Ignore scores below this
    high_proximity: number; // "Strong" positioning angles above this
  };
  
  // Physical context thresholds
  pedestrian_flow: {
    very_high: { min_within_100m: number; min_within_300m: number };
    high: { min_within_100m: number; min_within_300m: number };
    medium: { min_within_100m: number; min_within_300m: number };
  };
}

/**
 * Default configuration based on Danish market research
 * 
 * Sources:
 * - Tourist budget: Visitdenmark.dk average tourist spending data
 * - Student budget: SU (student grants) + typical dining behavior
 * - Business professional: LinkedIn salary data + lunch allowances
 * 
 * Version: 1.1.0
 * Last updated: 2026-06-26
 * 
 * CHANGES v1.1.0:
 * - Increased minimum_relevance from 30 → 40 (more conservative demographic filtering)
 * - Increased high_proximity from 50 → 60 (stronger signal required for "strong" positioning)
 * - Rationale: Tourist at 40 proximity shouldn't create secondary segments for non-tourist cities
 */
export const DEFAULT_LOCATION_STRATEGY_CONFIG: LocationStrategyConfig = {
  demographic_filters: {
    tourist: {
      max_price: 350, // DKK - based on tourist meal budget data
      requires_walkin: true
    },
    student: {
      max_price: 200 // DKK - based on SU budget constraints
    },
    office_worker: {
      min_price: 80 // DKK - below this skews too casual for business dining
    },
    business_professional: {  // DEPRECATED: Use office_worker (kept for backwards compatibility)
      min_price: 80
    }
  },
  
  proximity_thresholds: {
    minimum_relevance: 40, // Ignore demographics below 40% proximity (increased from 30)
    high_proximity: 60 // "Strong" positioning angles above 60% (increased from 50)
  },
  
  pedestrian_flow: {
    very_high: { min_within_100m: 10, min_within_300m: 25 },
    high: { min_within_100m: 5, min_within_300m: 15 },
    medium: { min_within_100m: 2, min_within_300m: 8 }
  }
};

/**
 * Get location strategy config for a specific business
 * Future: Can be overridden from database if needed
 */
export function getLocationStrategyConfig(
  businessId?: string
): LocationStrategyConfig {
  // Future: Fetch business-specific overrides from database
  // const overrides = await fetchConfigOverrides(businessId);
  // return { ...DEFAULT_LOCATION_STRATEGY_CONFIG, ...overrides };
  
  return DEFAULT_LOCATION_STRATEGY_CONFIG;
}

/**
 * Helper: Check if demographic is reachable given business constraints
 */
export function isDemographicReachable(
  demographic: string,
  proximityScore: number,
  business: {
    avg_price?: number | null;
    booking_required?: boolean;
    accepts_walkins?: boolean;
  },
  config: LocationStrategyConfig
): { is_reachable: boolean; filter_reason?: string } {
  // Ignore very low proximity scores
  if (proximityScore < config.proximity_thresholds.minimum_relevance) {
    return {
      is_reachable: false,
      filter_reason: `proximity score ${proximityScore} below minimum relevance threshold`
    };
  }

  // Student-specific proximity threshold (higher because needs actual university nearby)
  if (demographic === 'student' && proximityScore < 70) {
    return {
      is_reachable: false,
      filter_reason: `university proximity ${proximityScore} too low (need 70+ for student segment)`
    };
  }

  // Tourist filters
  if (demographic === 'tourist') {
    // Block if booking required (even if walk-ins "accepted", they'd likely be turned away)
    if (business.booking_required) {
      return {
        is_reachable: false,
        filter_reason: 'booking required excludes spontaneous tourist visits'
      };
    }
    if (business.avg_price && business.avg_price > config.demographic_filters.tourist.max_price) {
      return {
        is_reachable: false,
        filter_reason: `avg_price ${business.avg_price} DKK exceeds tourist budget threshold ${config.demographic_filters.tourist.max_price} DKK`
      };
    }
  }

  // Student filters
  if (demographic === 'student') {
    if (business.avg_price && business.avg_price > config.demographic_filters.student.max_price) {
      return {
        is_reachable: false,
        filter_reason: `avg_price ${business.avg_price} DKK exceeds student budget threshold ${config.demographic_filters.student.max_price} DKK`
      };
    }
  }

  // Business professional / office worker filters (both keys supported during transition)
  if (demographic === 'office_worker' || demographic === 'business_professional') {
    const filterConfig = config.demographic_filters.office_worker
      ?? config.demographic_filters.business_professional;
    if (business.avg_price && business.avg_price < filterConfig.min_price) {
      return {
        is_reachable: false,
        filter_reason: `price ${business.avg_price} DKK below office worker minimum threshold ${filterConfig.min_price} DKK`
      };
    }
  }

  return { is_reachable: true };
}

/**
 * V3: Validate WHO type against proximity gate requirements
 * Certain WHO types require strict distance verification to qualifying landmarks
 */
export function validateWhoProximityGate(
  whoType: string,
  landmarks: Array<{ name: string; type: string; distance_meters?: number }>
): { is_valid: boolean; reason?: string; landmark?: string } {
  const requiresGate = ['student', 'medical_staff', 'hospital_visitor'];
  if (!requiresGate.includes(whoType)) {
    return { is_valid: true }; // No gate required
  }
  
  // Student requires university within 400-600m
  if (whoType === 'student') {
    const university = landmarks.find(l => 
      l.type === 'university' && 
      l.distance_meters &&
      l.distance_meters >= PROXIMITY_GATES.university_campus.min &&
      l.distance_meters <= PROXIMITY_GATES.university_campus.max
    );
    
    if (!university) {
      return {
        is_valid: false,
        reason: `No university found within ${PROXIMITY_GATES.university_campus.min}-${PROXIMITY_GATES.university_campus.max}m range`
      };
    }
    
    return { is_valid: true, landmark: university.name };
  }
  
  // Medical staff and hospital visitors require hospital within 300-500m
  if (whoType === 'medical_staff' || whoType === 'hospital_visitor') {
    const hospital = landmarks.find(l => 
      l.type === 'hospital' && 
      l.distance_meters &&
      l.distance_meters >= PROXIMITY_GATES.hospital_campus.min &&
      l.distance_meters <= PROXIMITY_GATES.hospital_campus.max
    );
    
    if (!hospital) {
      return {
        is_valid: false,
        reason: `No hospital found within ${PROXIMITY_GATES.hospital_campus.min}-${PROXIMITY_GATES.hospital_campus.max}m range`
      };
    }
    
    return { is_valid: true, landmark: hospital.name };
  }
  
  return { is_valid: true };
}
