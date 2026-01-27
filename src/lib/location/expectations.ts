/**
 * Location Type Expectations
 * 
 * Defines expected behavior patterns for each location type.
 * Used by Concept Fit analyzer to evaluate business-location match.
 */

export interface LocationExpectations {
  categoryId: string;
  
  // Demand timing patterns
  peakTimes: {
    weekday: string[]; // e.g., ['breakfast', 'lunch', 'afternoon']
    weekend: string[]; // e.g., ['brunch', 'afternoon', 'evening']
  };
  
  // Audience behavior
  audienceBehavior: {
    visitStyle: 'planned' | 'impulse' | 'mixed';
    dwellTime: 'short' | 'medium' | 'long';
    groupSize: 'solo' | 'pairs' | 'groups' | 'mixed';
    pricesensitivity: 'high' | 'medium' | 'low';
  };
  
  // Service expectations
  serviceExpectations: {
    speed: 'fast' | 'moderate' | 'relaxed';
    atmosphere: 'grab-and-go' | 'casual' | 'destination';
    booking: 'rare' | 'optional' | 'recommended' | 'required';
  };
  
  // Marketing angles that work
  winningAngles: string[];
  
  // Common CTAs that perform
  effectiveCTAs: string[];
}

export const LOCATION_EXPECTATIONS: Record<string, LocationExpectations> = {
  city_centre: {
    categoryId: 'city_centre',
    peakTimes: {
      weekday: ['lunch', 'after-work', 'evening'],
      weekend: ['brunch', 'afternoon', 'evening']
    },
    audienceBehavior: {
      visitStyle: 'mixed',
      dwellTime: 'medium',
      groupSize: 'mixed',
      pricesensitivity: 'low'
    },
    serviceExpectations: {
      speed: 'moderate',
      atmosphere: 'casual',
      booking: 'optional'
    },
    winningAngles: ['convenience', 'quality', 'atmosphere', 'variety'],
    effectiveCTAs: ['book_now', 'walk_in_welcome', 'last_tables', 'visit_today']
  },
  
  residential: {
    categoryId: 'residential',
    peakTimes: {
      weekday: ['morning', 'afternoon'],
      weekend: ['brunch', 'afternoon', 'early-evening']
    },
    audienceBehavior: {
      visitStyle: 'planned',
      dwellTime: 'long',
      groupSize: 'groups',
      priceFamily: 'medium'
    },
    serviceExpectations: {
      speed: 'relaxed',
      atmosphere: 'destination',
      booking: 'optional'
    },
    winningAngles: ['community', 'family-friendly', 'consistency', 'value'],
    effectiveCTAs: ['your_local', 'bring_family', 'neighborhood_favorite', 'regular_spot']
  },
  
  tourist: {
    categoryId: 'tourist',
    peakTimes: {
      weekday: ['lunch', 'afternoon'],
      weekend: ['lunch', 'afternoon', 'early-evening']
    },
    audienceBehavior: {
      visitStyle: 'impulse',
      dwellTime: 'medium',
      groupSize: 'mixed',
      priceFamily: 'medium'
    },
    serviceExpectations: {
      speed: 'moderate',
      atmosphere: 'casual',
      booking: 'rare'
    },
    winningAngles: ['proximity', 'authentic', 'photo-worthy', 'convenient'],
    effectiveCTAs: ['walk_in', 'near_landmark', 'perfect_stop', 'tourist_friendly']
  },
  
  office: {
    categoryId: 'office',
    peakTimes: {
      weekday: ['breakfast', 'lunch'],
      weekend: []
    },
    audienceBehavior: {
      visitStyle: 'planned',
      dwellTime: 'short',
      groupSize: 'solo',
      priceFamily: 'medium'
    },
    serviceExpectations: {
      speed: 'fast',
      atmosphere: 'grab-and-go',
      booking: 'optional'
    },
    winningAngles: ['speed', 'pre-order', 'value', 'variety'],
    effectiveCTAs: ['quick_lunch', 'pre_order', 'ready_fast', 'takeaway']
  },
  
  transport_hub: {
    categoryId: 'transport_hub',
    peakTimes: {
      weekday: ['morning-rush', 'evening-rush'],
      weekend: ['daytime']
    },
    audienceBehavior: {
      visitStyle: 'impulse',
      dwellTime: 'short',
      groupSize: 'solo',
      priceFamily: 'medium'
    },
    serviceExpectations: {
      speed: 'fast',
      atmosphere: 'grab-and-go',
      booking: 'rare'
    },
    winningAngles: ['speed', 'convenience', 'portable', 'quality'],
    effectiveCTAs: ['grab_go', 'quick_stop', 'on_way', 'fast_service']
  },
  
  student: {
    categoryId: 'student',
    peakTimes: {
      weekday: ['afternoon', 'evening'],
      weekend: ['afternoon', 'evening', 'late-night']
    },
    audienceBehavior: {
      visitStyle: 'mixed',
      dwellTime: 'long',
      groupSize: 'groups',
      priceFamily: 'high'
    },
    serviceExpectations: {
      speed: 'relaxed',
      atmosphere: 'casual',
      booking: 'rare'
    },
    winningAngles: ['value', 'social', 'study-friendly', 'events'],
    effectiveCTAs: ['student_discount', 'group_deals', 'share_with_friends', 'cheap_eats']
  },
  
  waterfront: {
    categoryId: 'waterfront',
    peakTimes: {
      weekday: ['afternoon', 'early-evening'],
      weekend: ['brunch', 'afternoon', 'evening']
    },
    audienceBehavior: {
      visitStyle: 'impulse',
      dwellTime: 'long',
      groupSize: 'mixed',
      priceFamily: 'medium'
    },
    serviceExpectations: {
      speed: 'relaxed',
      atmosphere: 'destination',
      booking: 'optional'
    },
    winningAngles: ['view', 'outdoor', 'leisure', 'photo-worthy'],
    effectiveCTAs: ['enjoy_view', 'outdoor_seating', 'perfect_weather', 'walk_in']
  },
  
  shopping_district: {
    categoryId: 'shopping_district',
    peakTimes: {
      weekday: ['lunch', 'afternoon'],
      weekend: ['brunch', 'lunch', 'afternoon']
    },
    audienceBehavior: {
      visitStyle: 'impulse',
      dwellTime: 'medium',
      groupSize: 'pairs',
      priceFamily: 'medium'
    },
    serviceExpectations: {
      speed: 'moderate',
      atmosphere: 'casual',
      booking: 'rare'
    },
    winningAngles: ['break', 'refresh', 'convenient', 'quality'],
    effectiveCTAs: ['take_break', 'relax', 'shopping_pause', 'recharge']
  },
  
  mixed_use: {
    categoryId: 'mixed_use',
    peakTimes: {
      weekday: ['morning', 'lunch', 'evening'],
      weekend: ['brunch', 'afternoon', 'evening']
    },
    audienceBehavior: {
      visitStyle: 'mixed',
      dwellTime: 'medium',
      groupSize: 'mixed',
      priceFamily: 'medium'
    },
    serviceExpectations: {
      speed: 'moderate',
      atmosphere: 'casual',
      booking: 'optional'
    },
    winningAngles: ['flexibility', 'variety', 'all-day', 'community'],
    effectiveCTAs: ['flexible_menu', 'morning_to_evening', 'for_everyone', 'local_spot']
  },
  
  destination: {
    categoryId: 'destination',
    peakTimes: {
      weekday: ['evening'],
      weekend: ['lunch', 'evening']
    },
    audienceBehavior: {
      visitStyle: 'planned',
      dwellTime: 'long',
      groupSize: 'groups',
      priceFamily: 'low'
    },
    serviceExpectations: {
      speed: 'relaxed',
      atmosphere: 'destination',
      booking: 'recommended'
    },
    winningAngles: ['worth_the_trip', 'experience', 'special', 'booking'],
    effectiveCTAs: ['book_table', 'reserve_now', 'worth_drive', 'plan_visit']
  }
};

/**
 * Get expectations for a location type
 */
export function getLocationExpectations(categoryId: string): LocationExpectations | null {
  return LOCATION_EXPECTATIONS[categoryId] || null;
}
