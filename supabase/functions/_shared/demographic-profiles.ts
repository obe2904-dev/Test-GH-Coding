/**
 * Demographic Profiles
 * 
 * Defines behavioral patterns for demographic populations that may be nearby.
 * These are NOT location types - they represent WHO is in the area, not WHERE the business is.
 * 
 * Used as INPUT to programme segment generation, not displayed as location positioning.
 */

export interface DemographicProfile {
  demographicId: string;
  displayName: string;
  
  // Behavioral patterns of this demographic
  behavioral_patterns: {
    price_sensitivity: 'high' | 'medium' | 'low';
    decision_timing: 'spontaneous' | 'planned' | 'mixed';
    typical_motivations: Array<{
      motivation: string;
      prevalence: 'very_high' | 'high' | 'medium' | 'low';
    }>;
    usage_occasions: string[];
    pace_preference: 'very_fast' | 'fast' | 'medium' | 'slow' | 'mixed';
  };
  
  // How to detect this demographic in location data
  detection_signals: {
    poi_keywords: string[];        // Google Maps POI types that indicate this demographic
    minimum_threshold: number;     // Minimum POI count to trigger detection
  };
  
  // Seasonality patterns for this demographic
  seasonality: {
    pattern: 'stable' | 'summer_peak' | 'winter_peak' | 'academic_year';
    seasonal_weights: {
      winter: number;
      spring: number;
      summer: number;
      autumn: number;
    };
  };
}

export const DEMOGRAPHIC_PROFILES: Record<string, DemographicProfile> = {
  
  // UNIVERSITY / STUDENT POPULATION
  university_area: {
    demographicId: "university_area",
    displayName: "University / Student Population",
    
    behavioral_patterns: {
      price_sensitivity: 'high',
      decision_timing: 'spontaneous',
      typical_motivations: [
        { motivation: "work/productivity", prevalence: "very_high" },
        { motivation: "social meet-up", prevalence: "high" },
        { motivation: "routine habit", prevalence: "high" },
        { motivation: "energy boost/caffeine need", prevalence: "high" },
        { motivation: "work break", prevalence: "medium" }
      ],
      usage_occasions: [
        "Study breaks",
        "Group study sessions",
        "Casual meals",
        "Coffee between classes",
        "Social gatherings",
        "Late night hangouts"
      ],
      pace_preference: 'slow'  // Long stays for studying
    },
    
    detection_signals: {
      poi_keywords: [
        'university',
        'college',
        'school',
        'educational_institution',
        'student_union',
        'campus',
        'dormitory',
        'student_housing'
      ],
      minimum_threshold: 1  // At least 1 educational institution nearby
    },
    
    seasonality: {
      pattern: 'academic_year',
      seasonal_weights: {
        winter: 1.0,    // Full semester
        spring: 1.0,    // Full semester
        summer: 0.5,    // 50% drop (summer break)
        autumn: 1.0     // Full semester
      }
    }
  },
  
  // TOURIST POPULATION
  tourist_area: {
    demographicId: "tourist_area",
    displayName: "Tourist / Visitor Population",
    
    behavioral_patterns: {
      price_sensitivity: 'low',
      decision_timing: 'mixed',  // Some plan, some spontaneous
      typical_motivations: [
        { motivation: "destination visit", prevalence: "very_high" },
        { motivation: "discovery/trying new", prevalence: "very_high" },
        { motivation: "treat/reward", prevalence: "high" },
        { motivation: "family outing", prevalence: "high" },
        { motivation: "social meet-up", prevalence: "medium" }
      ],
      usage_occasions: [
        "Sightseeing breaks",
        "Trying local cuisine",
        "Photo opportunities",
        "Family outings",
        "Special experiences",
        "Rest stops during tours"
      ],
      pace_preference: 'medium'
    },
    
    detection_signals: {
      poi_keywords: [
        'tourist_attraction',
        'museum',
        'monument',
        'point_of_interest',
        'landmark',
        'historical_site',
        'art_gallery',
        'viewpoint',
        'scenic_spot',
        'visitor_center'
      ],
      minimum_threshold: 2  // At least 2 tourist attractions nearby
    },
    
    seasonality: {
      pattern: 'summer_peak',
      seasonal_weights: {
        winter: 0.4,    // 40% of summer traffic
        spring: 0.7,
        summer: 1.0,    // Peak season
        autumn: 0.6
      }
    }
  }
};

// Helper function to get demographic profile by ID
export function getDemographicProfile(demographicId: string): DemographicProfile | null {
  return DEMOGRAPHIC_PROFILES[demographicId] || null;
}

// Get all demographic IDs
export function getAllDemographicIds(): string[] {
  return Object.keys(DEMOGRAPHIC_PROFILES);
}

// Check if a location type ID is actually a demographic
export function isDemographic(typeId: string): boolean {
  return typeId === 'student' || typeId === 'tourist' || typeId in DEMOGRAPHIC_PROFILES;
}

// Map legacy location type ID to demographic ID
export function legacyToDemographicId(legacyId: string): string | null {
  const mapping: Record<string, string> = {
    'student': 'university_area',
    'tourist': 'tourist_area'
  };
  return mapping[legacyId] || null;
}
