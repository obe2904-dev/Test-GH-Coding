/**
 * Geographic Location Types
 * 
 * Defines the 7 factors for each GEOGRAPHIC location type.
 * These describe WHERE a business is physically located (geographic positioning).
 * 
 * EXCLUDES demographic types (student, tourist) which are now in demographic-profiles.ts
 */

export interface LocationExpectations {
  locationTypeId: string;
  displayName: string;
  
  // Factor 1: WHO (typical customers)
  typical_customers: string[];
  
  // Factor 2: WHY (visit motivations) - with prevalence
  typical_motivations: Array<{
    motivation: string;
    prevalence: 'very_high' | 'high' | 'medium' | 'low';
  }>;
  
  // Factor 3: FLOW (pace)
  pace: 'very_fast' | 'fast' | 'medium' | 'slow' | 'mixed';
  
  // Factor 4: BUDGET (price sensitivity)
  price_sensitivity: 'low' | 'medium' | 'high';
  
  // Factor 5: WHAT WINS (winning angles)
  winning_angles: string[];
  
  // Factor 6: WEATHER IMPACT (weather sensitivity)
  weather_sensitivity: 'low' | 'medium' | 'high';
  
  // Factor 7: SEASON IMPACT (seasonality)
  seasonality: {
    pattern: 'stable' | 'summer_peak' | 'winter_peak' | 'holiday_spikes';
    seasonal_weights: {
      winter: number;  // 0.0 to 1.0 (1.0 = full strength)
      spring: number;
      summer: number;
      autumn: number;
    };
  };
}

export const GEOGRAPHIC_LOCATION_TYPES: Record<string, LocationExpectations> = {
  
  // 1. CITY CENTRE
  city_centre: {
    locationTypeId: "city_centre",
    displayName: "City Centre",
    
    typical_customers: [
      "shoppers on break",
      "tourists",
      "office workers",
      "nightlife guests",
      "event visitors",
      "couples",
      "families with kids",
      "friends / social groups",
      "couple groups / double dates"
    ],
    
    typical_motivations: [
      { motivation: "convenience", prevalence: "very_high" },
      { motivation: "social meet-up", prevalence: "high" },
      { motivation: "discovery/trying new", prevalence: "high" },
      { motivation: "lunch necessity", prevalence: "high" },
      { motivation: "pre-event/post-event", prevalence: "medium" },
      { motivation: "date/couple time", prevalence: "medium" }
    ],
    
    pace: "fast",
    price_sensitivity: "medium",
    
    winning_angles: [
      "Central location",
      "Quick service",
      "Diverse menu options",
      "Extended hours",
      "Tourist-friendly"
    ],
    
    weather_sensitivity: "medium",
    
    seasonality: {
      pattern: "stable",
      seasonal_weights: {
        winter: 0.95,
        spring: 1.0,
        summer: 1.0,
        autumn: 1.0
      }
    }
  },
  
  // 2. RESIDENTIAL AREA
  residential: {
    locationTypeId: "residential",
    displayName: "Residential Area",
    
    typical_customers: [
      "local regulars",
      "families with kids",
      "parents with babies/strollers",
      "retirees/pensioners",
      "remote workers",
      "cyclists"
    ],
    
    typical_motivations: [
      { motivation: "routine habit", prevalence: "very_high" },
      { motivation: "social meet-up", prevalence: "high" },
      { motivation: "family outing", prevalence: "high" },
      { motivation: "work/productivity", prevalence: "medium" },
      { motivation: "support local/ethical choice", prevalence: "medium" },
      { motivation: "celebration/milestone", prevalence: "medium" }
    ],
    
    pace: "medium",
    price_sensitivity: "medium",
    
    winning_angles: [
      "Community hub",
      "Neighborhood favorite",
      "Family-friendly",
      "Local ownership",
      "Regular spot",
      "Kid-friendly"
    ],
    
    weather_sensitivity: "medium",
    
    seasonality: {
      pattern: "stable",
      seasonal_weights: {
        winter: 0.95,
        spring: 1.0,
        summer: 1.05,  // Slightly higher (outdoor activities)
        autumn: 1.0
      }
    }
  },
  
  // 3. OFFICE / BUSINESS DISTRICT
  office: {
    locationTypeId: "office",
    displayName: "Office / Business District",
    
    typical_customers: [
      "office workers",
      "commuters",
      "business meetings",
      "remote workers"
    ],
    
    typical_motivations: [
      { motivation: "work break", prevalence: "very_high" },
      { motivation: "lunch necessity", prevalence: "very_high" },
      { motivation: "business meeting", prevalence: "high" },
      { motivation: "routine habit", prevalence: "high" },
      { motivation: "convenience", prevalence: "medium" },
      { motivation: "work/productivity", prevalence: "medium" }
    ],
    
    pace: "fast",
    price_sensitivity: "medium",
    
    winning_angles: [
      "Quick service",
      "Convenient location",
      "Value lunch combos",
      "Professional atmosphere",
      "WiFi available",
      "Takeaway options"
    ],
    
    weather_sensitivity: "low",
    
    seasonality: {
      pattern: "stable",
      seasonal_weights: {
        winter: 1.0,
        spring: 1.0,
        summer: 0.85,  // Lower (summer holidays)
        autumn: 1.0
      }
    }
  },
  
  // 4. TRANSPORT HUB
  transport_hub: {
    locationTypeId: "transport_hub",
    displayName: "Transport Hub",
    
    typical_customers: [
      "commuters",
      "travelers",
      "tourists in transit"
    ],
    
    typical_motivations: [
      { motivation: "waiting time filler", prevalence: "very_high" },
      { motivation: "convenience", prevalence: "very_high" },
      { motivation: "energy boost/caffeine need", prevalence: "high" },
      { motivation: "routine habit", prevalence: "medium" }
    ],
    
    pace: "very_fast",
    price_sensitivity: "medium",
    
    winning_angles: [
      "Grab-and-go speed",
      "Takeaway focus",
      "Easy mobile ordering",
      "Quick turnaround",
      "24/7 or extended hours"
    ],
    
    weather_sensitivity: "low",
    
    seasonality: {
      pattern: "stable",
      seasonal_weights: {
        winter: 1.0,
        spring: 1.0,
        summer: 0.95,
        autumn: 1.0
      }
    }
  },
  
  // 5. WATERFRONT / LEISURE
  waterfront: {
    locationTypeId: "waterfront",
    displayName: "Waterfront / Leisure",
    
    typical_customers: [
      "walkers/runners/dog owners",
      "families on outings",
      "cyclists",
      "couples",
      "tourists",
      "friends / social groups",
      "couple groups / double dates"
    ],
    
    typical_motivations: [
      { motivation: "destination visit", prevalence: "high" },
      { motivation: "family outing", prevalence: "high" },
      { motivation: "social meet-up", prevalence: "high" },
      { motivation: "treat/reward", prevalence: "medium" },
      { motivation: "warm-up/shelter", prevalence: "medium" }
    ],
    
    pace: "medium",
    price_sensitivity: "low",
    
    winning_angles: [
      "Scenic location",
      "Outdoor seating",
      "Relaxed atmosphere",
      "Perfect for walks",
      "Weather-dependent specials"
    ],
    
    weather_sensitivity: "high",
    
    seasonality: {
      pattern: "summer_peak",
      seasonal_weights: {
        winter: 0.5,   // 50% of summer
        spring: 0.8,
        summer: 1.0,
        autumn: 0.7
      }
    }
  },
  
  // 6. SHOPPING DISTRICT
  shopping_district: {
    locationTypeId: "shopping_district",
    displayName: "Shopping District",
    
    typical_customers: [
      "shoppers on break",
      "retail workers",
      "families shopping",
      "couples",
      "friends / social groups"
    ],
    
    typical_motivations: [
      { motivation: "waiting time filler", prevalence: "very_high" },
      { motivation: "convenience", prevalence: "high" },
      { motivation: "work break", prevalence: "high" },
      { motivation: "social meet-up", prevalence: "medium" },
      { motivation: "treat/reward", prevalence: "medium" }
    ],
    
    pace: "fast",
    price_sensitivity: "medium",
    
    winning_angles: [
      "Quick service",
      "Convenient location",
      "Takeaway options",
      "Shopping break friendly",
      "Value combos"
    ],
    
    weather_sensitivity: "medium",
    
    seasonality: {
      pattern: "holiday_spikes",
      seasonal_weights: {
        winter: 1.1,   // Christmas shopping boost
        spring: 0.95,
        summer: 0.9,
        autumn: 0.95
      }
    }
  },
  
  // 7. UNIVERSITY CAMPUS
  university_campus: {
    locationTypeId: "university_campus",
    displayName: "University Campus",
    
    typical_customers: [
      "students",
      "academic staff",
      "researchers",
      "administrative staff"
    ],
    
    typical_motivations: [
      { motivation: "work/productivity", prevalence: "very_high" },
      { motivation: "social meet-up", prevalence: "high" },
      { motivation: "routine habit", prevalence: "high" },
      { motivation: "work break", prevalence: "medium" },
      { motivation: "convenience", prevalence: "medium" }
    ],
    
    pace: "medium",
    price_sensitivity: "high",
    
    winning_angles: [
      "Student-friendly pricing",
      "Study-friendly atmosphere",
      "Quick service",
      "Group seating",
      "WiFi available",
      "Extended hours during exams"
    ],
    
    weather_sensitivity: "low",
    
    seasonality: {
      pattern: "semester_only",
      seasonal_weights: {
        winter: 1.0,   // Full semester
        spring: 1.0,   // Full semester
        summer: 0.3,   // 70% drop during summer break
        autumn: 1.0    // Full semester
      }
    }
  },
  
  // 8. HOSPITAL CAMPUS
  hospital_campus: {
    locationTypeId: "hospital_campus",
    displayName: "Hospital Campus",
    
    typical_customers: [
      "medical and nursing staff",
      "patients (outpatient)",
      "visitors",
      "administrative staff"
    ],
    
    typical_motivations: [
      { motivation: "work break", prevalence: "very_high" },
      { motivation: "convenience", prevalence: "very_high" },
      { motivation: "waiting time filler", prevalence: "high" },
      { motivation: "energy boost/caffeine need", prevalence: "high" },
      { motivation: "emotional support/comfort", prevalence: "medium" }
    ],
    
    pace: "fast",
    price_sensitivity: "medium",
    
    winning_angles: [
      "24/7 availability",
      "Quick service",
      "Healthy options",
      "Takeaway focus",
      "Comfort food",
      "Early morning service"
    ],
    
    weather_sensitivity: "low",
    
    seasonality: {
      pattern: "stable",
      seasonal_weights: {
        winter: 1.0,   // Completely consistent year-round
        spring: 1.0,
        summer: 1.0,
        autumn: 1.0
      }
    }
  },
  
  // 9. TOURIST DESTINATION AREA
  tourist_destination: {
    locationTypeId: "tourist_destination",
    displayName: "Tourist Destination Area",
    
    typical_customers: [
      "tourists and international visitors",
      "leisure seekers",
      "day trippers",
      "some locals"
    ],
    
    typical_motivations: [
      { motivation: "destination visit", prevalence: "very_high" },
      { motivation: "discovery/trying new", prevalence: "very_high" },
      { motivation: "social meet-up", prevalence: "high" },
      { motivation: "treat/reward", prevalence: "high" },
      { motivation: "photo opportunity", prevalence: "medium" }
    ],
    
    pace: "medium",
    price_sensitivity: "low",
    
    winning_angles: [
      "Local experience",
      "Tourist-friendly service",
      "English menu available",
      "Photo-worthy presentation",
      "Central location",
      "Memorable experience"
    ],
    
    weather_sensitivity: "medium",
    
    seasonality: {
      pattern: "summer_peak",
      seasonal_weights: {
        winter: 0.5,   // 50% drop except Christmas markets
        spring: 0.8,
        summer: 1.0,   // Peak tourist season
        autumn: 0.7
      }
    }
  },

  // 10. PARK / NATURE AREA
  nature_park: {
    locationTypeId: "nature_park",
    displayName: "Park / Nature Area",

    typical_customers: [
      "walkers/runners/dog owners",
      "families with kids",
      "cyclists",
      "parents with babies/strollers",
      "local regulars"
    ],

    typical_motivations: [
      { motivation: "warm-up/shelter", prevalence: "high" },
      { motivation: "family outing", prevalence: "high" },
      { motivation: "routine habit", prevalence: "medium" },
      { motivation: "treat/reward", prevalence: "medium" }
    ],

    pace: "medium",
    price_sensitivity: "medium",

    winning_angles: [
      "Outdoor seating",
      "Dog-friendly",
      "Takeaway coffee",
      "Family-friendly",
      "Park views",
      "Healthy options"
    ],

    weather_sensitivity: "high",

    seasonality: {
      pattern: "summer_peak",
      seasonal_weights: {
        winter: 0.55,
        spring: 0.85,
        summer: 1.0,
        autumn: 0.75
      }
    }
  }
};

// Helper function to get expectations by location type
export function getGeographicLocationExpectations(locationTypeId: string): LocationExpectations | null {
  return GEOGRAPHIC_LOCATION_TYPES[locationTypeId] || null;
}

// Get all geographic location type IDs
export function getAllGeographicLocationIds(): string[] {
  return Object.keys(GEOGRAPHIC_LOCATION_TYPES);
}

// Check if a type ID is a geographic location (not a demographic)
export function isGeographicLocationType(typeId: string): boolean {
  return typeId in GEOGRAPHIC_LOCATION_TYPES;
}
