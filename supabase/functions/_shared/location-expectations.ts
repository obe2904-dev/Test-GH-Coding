/**
 * Location Type Expectations (BACKWARD COMPATIBILITY LAYER)
 * 
 * This file now re-exports from the new split architecture:
 * - geographic-location-types.ts (WHERE: city_centre, waterfront, etc.)
 * - demographic-profiles.ts (WHO: student -> university_area, tourist -> tourist_area)
 * 
 * This maintains backward compatibility while the system migrates to the new architecture.
 */

import { 
  GEOGRAPHIC_LOCATION_TYPES, 
  LocationExpectations,
  getGeographicLocationExpectations,
  getAllGeographicLocationIds,
  isGeographicLocationType 
} from './geographic-location-types.ts';

import { 
  DEMOGRAPHIC_PROFILES,
  DemographicProfile,
  getDemographicProfile,
  getAllDemographicIds,
  isDemographic
} from './demographic-profiles.ts';

// Re-export types for backward compatibility
export type { LocationExpectations, DemographicProfile };

// Export geographic types
export { 
  GEOGRAPHIC_LOCATION_TYPES,
  getGeographicLocationExpectations,
  getAllGeographicLocationIds,
  isGeographicLocationType
};

// Export demographic types
export { 
  DEMOGRAPHIC_PROFILES,
  getDemographicProfile,
  getAllDemographicIds,
  isDemographic
};

// LEGACY: Maintain backward compatibility by merging geographic types with legacy student/tourist
// New code should use GEOGRAPHIC_LOCATION_TYPES or DEMOGRAPHIC_PROFILES directly
export const LOCATION_EXPECTATIONS: Record<string, LocationExpectations> = {
  // Copy all geographic types
  ...GEOGRAPHIC_LOCATION_TYPES,
  
  // Legacy compatibility: Keep student and tourist for old code
  // These map to 'university_area' and 'tourist_area' in demographic_proximity
  student: {
    locationTypeId: "student",
    displayName: "Student / Educational Area",
    
    typical_customers: [
      "students",
      "young professionals",
      "remote workers",
      "study groups"
    ],
    
    typical_motivations: [
      { motivation: "work/productivity", prevalence: "very_high" },
      { motivation: "social meet-up", prevalence: "high" },
      { motivation: "routine habit", prevalence: "high" },
      { motivation: "energy boost/caffeine need", prevalence: "high" },
      { motivation: "work break", prevalence: "medium" }
    ],
    
    pace: "slow",  // Long stays
    price_sensitivity: "high",
    
    winning_angles: [
      "Student discounts",
      "WiFi + power outlets",
      "Long-stay friendly",
      "Affordable pricing",
      "Study-friendly atmosphere",
      "Late hours"
    ],
    
    weather_sensitivity: "low",
    
    seasonality: {
      pattern: "stable",
      seasonal_weights: {
        winter: 1.0,
        spring: 1.0,
        summer: 0.5,   // 50% drop (summer break)
        autumn: 1.0
      }
    }
  },
  
  tourist: {
    locationTypeId: "tourist",
    displayName: "Tourist Area",
    
    typical_customers: [
      "tourists",
      "day visitors",
      "families on outings",
      "couples",
      "event visitors",
      "couple groups / double dates"
    ],
    
    typical_motivations: [
      { motivation: "destination visit", prevalence: "very_high" },
      { motivation: "discovery/trying new", prevalence: "very_high" },
      { motivation: "treat/reward", prevalence: "high" },
      { motivation: "family outing", prevalence: "high" },
      { motivation: "social meet-up", prevalence: "medium" }
    ],
    
    pace: "medium",
    price_sensitivity: "low",
    
    winning_angles: [
      "Instagram-worthy presentation",
      "Local/authentic vibe",
      "Tourist-friendly (English menu)",
      "Unique experience",
      "Photo opportunities"
    ],
    
    weather_sensitivity: "high",
    
    seasonality: {
      pattern: "summer_peak",
      seasonal_weights: {
        winter: 0.4,   // 40% of summer traffic
        spring: 0.7,
        summer: 1.0,   // Peak
        autumn: 0.6
      }
    }
  }
};

// Helper function to get expectations by location type (backward compatibility)
// Checks both geographic types and legacy student/tourist
export function getLocationExpectations(locationTypeId: string): LocationExpectations | null {
  return LOCATION_EXPECTATIONS[locationTypeId] || null;
}
