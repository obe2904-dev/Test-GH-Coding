/**
 * Location Type Matcher
 * 
 * Pure location analysis - determines which of the 10 location types match a physical location.
 * This is INDEPENDENT of the business concept (menu, hours, etc.)
 * 
 * Evaluation based on:
 * - Address keywords (street names, landmarks)
 * - Nearby POIs (restaurants, hotels, offices, universities)
 * - Geographic context (waterfront, city center)
 * - Area characteristics from location intelligence
 * 
 * Multi-country support: Uses country-specific patterns for keywords and language
 */

import { getCountryPatterns, CountryPatterns } from './countryPatterns';

export interface LocationTypeMatch {
  match_score: number; // 0-100
  match_level: 'strong' | 'moderate' | 'weak';
  confidence: number; // 0.0-1.0
  reason: string; // Why this location type matches
}

export interface LocationTypeMatches {
  [key: string]: LocationTypeMatch; // key = LocationCategoryId
}

export interface LocationContext {
  address?: string;
  neighborhood?: string;
  city?: string;
  nearbyPOIs?: {
    restaurants?: number;
    cafes?: number;
    hotels?: number;
    tourist_attractions?: number;
    universities?: number;
    offices?: number;
    transit_stations?: number;
    parks?: number;
  };
  waterDistance?: number; // meters
  landmarks?: Array<{
    name: string;
    type: string;
  }>;
  areaType?: string;
  countryCode?: string; // ISO 3166-1 alpha-2 code (DK, SE, DE, UK, etc.)
}

/**
 * Main function: Analyze which location types match this physical location
 * 
 * @param context Location context with address, POIs, etc.
 * @param countryCode Optional country code (defaults to DK). Use business.country if available.
 */
export function analyzeLocationTypes(
  context: LocationContext,
  countryCode?: string
): LocationTypeMatches {
  const patterns = getCountryPatterns(countryCode || context.countryCode);
  const matches: LocationTypeMatches = {};

  // Evaluate each location type with country-specific patterns
  matches.city_centre = evaluateCityCentre(context, patterns);
  matches.residential = evaluateResidential(context, patterns);
  matches.tourist = evaluateTourist(context, patterns);
  matches.office = evaluateOffice(context, patterns);
  matches.transport_hub = evaluateTransportHub(context, patterns);
  matches.student = evaluateStudent(context, patterns);
  matches.waterfront = evaluateWaterfront(context, patterns);
  matches.nature_park = evaluateNaturePark(context, patterns);
  matches.shopping_district = evaluateShoppingDistrict(context, patterns);
  matches.mixed_use = evaluateMixedUse(context, patterns);
  matches.destination = evaluateDestination(context, patterns);

  return matches;
}

/**
 * City Centre: Central streets with dense retail, nightlife, high pedestrian flow
 */
function evaluateCityCentre(context: LocationContext, patterns: CountryPatterns): LocationTypeMatch {
  let score = 0;
  const reasons: string[] = [];
  let confidence = 0.7;

  const address = (context.address || '').toLowerCase();
  const neighborhood = (context.neighborhood || '').toLowerCase();

  // SIGNAL 1: Neighborhood indicates city center (strongest signal)
  const hasCenterNeighborhood = patterns.city_centre.neighborhoodKeywords.some(n => 
    neighborhood.includes(n.toLowerCase())
  );
  
  // Check for " C" suffix (common Danish notation like "Odense C", "Aarhus C")
  const hasCitySuffix = neighborhood.match(/\s+c$/);
  
  if (hasCenterNeighborhood || hasCitySuffix) {
    score += 45; // Strong signal for city center
    reasons.push(patterns.city_centre.streetTypes[0]?.reason || 'City centre location');
    confidence = 0.9;
  }

  // SIGNAL 2: Street type patterns (pedestrian streets, squares)
  const streetTypePatterns = patterns.city_centre.streetTypes;

  for (const { pattern, reason, boost } of streetTypePatterns) {
    if (address.includes(pattern.toLowerCase())) {
      score += boost;
      reasons.push(reason);
      confidence = Math.max(confidence, 0.8);
      break; // Only count one street type
    }
  }

  // SIGNAL 3: Iconic landmarks (city-specific, high confidence)
  if (patterns.city_centre.iconicLandmarks) {
    const hasIconicLandmark = patterns.city_centre.iconicLandmarks.some(landmark => 
      address.includes(landmark.toLowerCase())
    );
    if (hasIconicLandmark) {
      score += 35;
      reasons.push('Iconic city centre address');
      confidence = 0.95;
    }
  }

  // SIGNAL 4: POI density (primary quantitative signal)
  // Adjusted thresholds to work for both large and small cities
  const pois = context.nearbyPOIs;
  if (pois) {
    const retailDensity = (pois.restaurants || 0) + (pois.cafes || 0);
    const hotelDensity = pois.hotels || 0;
    
    if (retailDensity > 35) {
      score += 30;
      reasons.push(patterns.city_centre.veryHighRetailDensity);
      confidence = Math.max(confidence, 0.85);
    } else if (retailDensity > 20) {
      score += 25;
      reasons.push(patterns.city_centre.highRetailDensity);
      confidence = Math.max(confidence, 0.8);
    } else if (retailDensity > 12) {
      score += 20;
      reasons.push(patterns.city_centre.moderateRetailDensity);
    } else if (retailDensity > 5) {
      score += 10;
      reasons.push(patterns.city_centre.lowRetailDensity);
    }
    
    // Hotels suggest commercial/tourist center
    if (hotelDensity > 5) {
      score += 10;
    } else if (hotelDensity > 2) {
      score += 5;
    }
  }

  // SIGNAL 5: Tourist attractions suggest city center
  if (pois?.tourist_attractions && pois.tourist_attractions > 3) {
    score += 10;
    if (!reasons.some(r => r.includes('turist') || r.includes('tourist') || r.includes('Touris'))) {
      reasons.push(patterns.city_centre.touristAttractionsNearby);
    }
  }

  score = Math.min(score, 100);
  const level = score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

  return {
    match_score: score,
    match_level: level,
    confidence,
    reason: reasons.length > 0 ? reasons.join('. ') : 'Not city centre area'
  };
}

/**
 * Residential: Surrounded by housing, limited retail/nightlife
 */
function evaluateResidential(context: LocationContext, patterns: CountryPatterns): LocationTypeMatch {
  let score = 20; // Low baseline - requires evidence
  const reasons: string[] = [];
  let confidence = 0.6;

  const neighborhood = (context.neighborhood || '').toLowerCase();
  const pois = context.nearbyPOIs;

  // Residential neighborhood keywords
  const hasResidentialKeyword = patterns.residential.neighborhoodKeywords.some(keyword => 
    neighborhood.includes(keyword.toLowerCase())
  );
  
  if (hasResidentialKeyword) {
    score += 40;
    reasons.push('Residential area');
    confidence = 0.8;
  }

  // Low commercial density suggests residential
  if (pois) {
    const commercialDensity = (pois.restaurants || 0) + (pois.cafes || 0) + (pois.offices || 0);
    if (commercialDensity < 5) {
      score += 30;
      reasons.push(patterns.residential.lowDensityReason);
    } else if (commercialDensity < 10) {
      score += 15;
      reasons.push('Moderate commercial activity');
    } else if (commercialDensity > 20) {
      score -= 20; // Penalty for high commercial density
      reasons.push(patterns.residential.highCommercialReason);
    } else if (commercialDensity > 15) {
      score -= 10;
    }
  }

  // High hotel/tourist density reduces residential score
  if (pois?.hotels && pois.hotels > 5) {
    score -= 20;
  } else if (pois?.hotels && pois.hotels > 3) {
    score -= 10;
  }
  
  if (pois?.tourist_attractions && pois.tourist_attractions > 3) {
    score -= 15;
  } else if (pois?.tourist_attractions && pois.tourist_attractions > 1) {
    score -= 10;
  }

  score = Math.max(0, Math.min(score, 100));
  const level = score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

  return {
    match_score: score,
    match_level: level,
    confidence,
    reason: reasons.length > 0 ? reasons.join('. ') : patterns.residential.defaultReason
  };
}

/**
 * Tourist: Near landmarks, attractions, cruise terminals
 */
function evaluateTourist(context: LocationContext, patterns: CountryPatterns): LocationTypeMatch {
  let score = 0;
  const reasons: string[] = [];
  let confidence = 0.7;

  const address = (context.address || '').toLowerCase();
  const pois = context.nearbyPOIs;

  // Iconic tourist locations
  if (patterns.tourist.iconicLandmarks) {
    const hasIconicLandmark = patterns.tourist.iconicLandmarks.some(landmark => 
      address.includes(landmark.toLowerCase())
    );
    if (hasIconicLandmark) {
      score += 50;
      reasons.push('Major tourist landmark');
      confidence = 0.95;
    }
  }

  // High concentration of tourist attractions
  if (pois?.tourist_attractions) {
    if (pois.tourist_attractions > 10) {
      score += 40;
      reasons.push(patterns.tourist.highAttractionReason);
    } else if (pois.tourist_attractions > 5) {
      score += 25;
      reasons.push(patterns.tourist.moderateAttractionReason);
    } else if (pois.tourist_attractions > 2) {
      score += 15;
    }
  }

  // Hotels nearby
  if (pois?.hotels) {
    if (pois.hotels > 10) {
      score += 20;
      reasons.push('Many hotels nearby');
    } else if (pois.hotels > 5) {
      score += 10;
    }
  }

  score = Math.min(score, 100);
  const level = score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

  return {
    match_score: score,
    match_level: level,
    confidence,
    reason: reasons.length > 0 ? reasons.join('. ') : 'Low tourist activity'
  };
}

/**
 * Office: Business district with office buildings
 */
function evaluateOffice(context: LocationContext, patterns: CountryPatterns): LocationTypeMatch {
  let score = 0;
  const reasons: string[] = [];
  let confidence = 0.6;

  const neighborhood = (context.neighborhood || '').toLowerCase();
  const pois = context.nearbyPOIs;

  // Office district keywords
  const hasOfficeKeyword = patterns.office.officeKeywords.some(keyword => 
    neighborhood.includes(keyword.toLowerCase())
  );
  if (hasOfficeKeyword) {
    score += 30;
    reasons.push('Business district');
    confidence = 0.8;
  }

  // Office POI density
  if (pois?.offices) {
    if (pois.offices > 20) {
      score += 40;
      reasons.push(patterns.office.highDensityReason);
    } else if (pois.offices > 10) {
      score += 25;
      reasons.push('Multiple offices nearby');
    } else if (pois.offices > 5) {
      score += 15;
    }
  }

  // Low residential/tourist signals boost office score
  if (pois?.hotels && pois.hotels < 3 && pois?.tourist_attractions && pois.tourist_attractions < 2) {
    score += 10;
  }

  score = Math.min(score, 100);
  const level = score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

  return {
    match_score: score,
    match_level: level,
    confidence,
    reason: reasons.length > 0 ? reasons.join('. ') : 'Low office presence'
  };
}

/**
 * Transport Hub: Train/metro/bus stations
 */
function evaluateTransportHub(context: LocationContext, patterns: CountryPatterns): LocationTypeMatch {
  let score = 0;
  const reasons: string[] = [];
  let confidence = 0.8;

  const address = (context.address || '').toLowerCase();
  const pois = context.nearbyPOIs;

  // Station keywords in address
  const hasStationKeyword = patterns.transport.stationKeywords.some(keyword => 
    address.includes(keyword.toLowerCase())
  );
  if (hasStationKeyword) {
    score += 60;
    reasons.push(patterns.transport.highDensityReason);
    confidence = 0.95;
  }

  // Transit stations nearby
  if (pois?.transit_stations) {
    if (pois.transit_stations > 3) {
      score += 30;
      reasons.push('Multiple stations nearby');
    } else if (pois.transit_stations > 1) {
      score += 20;
      reasons.push('Station nearby');
    }
  }

  score = Math.min(score, 100);
  const level = score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

  return {
    match_score: score,
    match_level: level,
    confidence,
    reason: reasons.length > 0 ? reasons.join('. ') : 'Not near transport hub'
  };
}

/**
 * Student: Near universities or colleges
 */
function evaluateStudent(context: LocationContext, patterns: CountryPatterns): LocationTypeMatch {
  let score = 0;
  const reasons: string[] = [];
  let confidence = 0.75;

  const address = (context.address || '').toLowerCase();
  const neighborhood = (context.neighborhood || '').toLowerCase();
  const pois = context.nearbyPOIs;

  // University keywords in address
  const hasUniversityInAddress = patterns.student.universityKeywords.some(keyword => 
    address.includes(keyword.toLowerCase())
  );
  if (hasUniversityInAddress) {
    score += 60;
    reasons.push(patterns.student.campusReason);
    confidence = 0.9;
  }

  // University keywords in neighborhood
  const hasUniversityInNeighborhood = patterns.student.universityKeywords.some(keyword => 
    neighborhood.includes(keyword.toLowerCase())
  );
  if (hasUniversityInNeighborhood && !hasUniversityInAddress) {
    score += 40;
    reasons.push(patterns.student.campusReason);
    confidence = 0.85;
  }

  // University POIs
  if (pois?.universities) {
    if (pois.universities > 2) {
      score += 40;
      reasons.push('Multiple universities nearby');
    } else if (pois.universities > 0) {
      score += 30;
      reasons.push('University nearby');
    }
  }

  score = Math.min(score, 100);
  const level = score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

  return {
    match_score: score,
    match_level: level,
    confidence,
    reason: reasons.length > 0 ? reasons.join('. ') : 'Not student area'
  };
}

/**
 * Waterfront: Close to water (sea, harbour, lake or river)
 */
function evaluateWaterfront(context: LocationContext, patterns: CountryPatterns): LocationTypeMatch {
  let score = 0;
  const reasons: string[] = [];
  let confidence = 0.85;

  const address = (context.address || '').toLowerCase();

  // Waterfront keywords
  const hasWaterKeyword = patterns.waterfront.waterKeywords.some(keyword => 
    address.includes(keyword.toLowerCase())
  );
  if (hasWaterKeyword) {
    score += 50;
    reasons.push('Waterfront location');
    confidence = 0.95;
  }

  // Water distance
  if (context.waterDistance !== undefined) {
    if (context.waterDistance < 100) {
      score += 50;
      reasons.push(patterns.waterfront.closeProximityReason);
      confidence = 0.95;
    } else if (context.waterDistance < 300) {
      score += 35;
      reasons.push(patterns.waterfront.moderateProximityReason);
    } else if (context.waterDistance < 500) {
      score += 20;
      reasons.push('Near water');
    }
  }

  score = Math.min(score, 100);
  const level = score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

  return {
    match_score: score,
    match_level: level,
    confidence,
    reason: reasons.length > 0 ? reasons.join('. ') : 'Not waterfront'
  };
}

/**
 * Nature Park: Near parks, forests or green spaces — walkers, dog owners, families
 */
function evaluateNaturePark(context: LocationContext, patterns: CountryPatterns): LocationTypeMatch {
  let score = 0;
  const reasons: string[] = [];
  let confidence = 0.7;

  const address = (context.address || '').toLowerCase();
  const neighborhood = (context.neighborhood || '').toLowerCase();
  const combinedText = address + ' ' + neighborhood;

  // Park keywords in address or neighborhood
  const hasParkKeyword = patterns.nature_park.parkKeywords.some(keyword =>
    combinedText.includes(keyword.toLowerCase())
  );
  if (hasParkKeyword) {
    score += 55;
    reasons.push(patterns.nature_park.nearParkReason);
    confidence = 0.85;
  }

  // Parks POI count (Google Maps parks data if available)
  if (context.nearbyPOIs?.parks) {
    if (context.nearbyPOIs.parks > 2) {
      score += 30;
      reasons.push('Multiple parks nearby');
      confidence = 0.9;
    } else if (context.nearbyPOIs.parks > 0) {
      score += 20;
      reasons.push('Park nearby');
    }
  }

  // Far from water (300m+) and has park keywords → confirms nature_park not waterfront
  if (hasParkKeyword && context.waterDistance !== undefined && context.waterDistance > 300) {
    score += 15;
  }

  score = Math.min(score, 100);
  const level = score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

  return {
    match_score: score,
    match_level: level,
    confidence,
    reason: reasons.length > 0 ? reasons.join('. ') : 'Not nature park area'
  };
}

/**
 * Shopping District: Retail-heavy area
 */
function evaluateShoppingDistrict(context: LocationContext, patterns: CountryPatterns): LocationTypeMatch {
  let score = 0;
  const reasons: string[] = [];
  let confidence = 0.7;

  const address = (context.address || '').toLowerCase();
  const pois = context.nearbyPOIs;

  // Shopping street keywords
  const hasShoppingKeyword = patterns.shopping.shoppingKeywords.some(keyword => 
    address.includes(keyword.toLowerCase())
  );
  if (hasShoppingKeyword) {
    score += 40;
    reasons.push('Shopping street');
    confidence = 0.9;
  }

  // High retail density (cafes + restaurants as proxy)
  if (pois) {
    const retailDensity = (pois.restaurants || 0) + (pois.cafes || 0);
    if (retailDensity > 40) {
      score += 35;
      reasons.push(patterns.shopping.highDensityReason);
    } else if (retailDensity > 20) {
      score += 25;
      reasons.push(patterns.shopping.moderateDensityReason);
    }
  }

  score = Math.min(score, 100);
  const level = score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

  return {
    match_score: score,
    match_level: level,
    confidence,
    reason: reasons.length > 0 ? reasons.join('. ') : 'Not shopping district'
  };
}

/**
 * Mixed Use: Modern development with residential, office, and retail
 */
function evaluateMixedUse(context: LocationContext, patterns: CountryPatterns): LocationTypeMatch {
  let score = 10; // Lower default
  const reasons: string[] = [];
  let confidence = 0.6;

  const neighborhood = (context.neighborhood || '').toLowerCase();
  const pois = context.nearbyPOIs;

  // Modern development keywords
  const hasModernDevelopmentKeyword = patterns.mixed_use.modernDevelopmentKeywords.some(keyword => 
    neighborhood.includes(keyword.toLowerCase())
  );
  if (hasModernDevelopmentKeyword) {
    score += 50;
    reasons.push(patterns.mixed_use.diversityReason);
    confidence = 0.8;
  }

  // Balanced POI mix suggests mixed-use
  if (pois) {
    const hasOffices = (pois.offices || 0) > 5;
    const hasRetail = ((pois.restaurants || 0) + (pois.cafes || 0)) > 10;
    const hasHotels = (pois.hotels || 0) > 2;

    const diversityCount = [hasOffices, hasRetail, hasHotels].filter(Boolean).length;
    
    // Only give mixed-use score if truly diverse (all 3 or at least strong office presence)
    if (diversityCount === 3) {
      score += 30;
      reasons.push(patterns.mixed_use.diversityReason);
    } else if (hasOffices && diversityCount >= 2) {
      score += 20;
      reasons.push('Mixed area with offices');
    }
  }

  score = Math.min(score, 100);
  const level = score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

  return {
    match_score: score,
    match_level: level,
    confidence,
    reason: reasons.length > 0 ? reasons.join('. ') : 'Mixed-use area'
  };
}

/**
 * Destination: Outside central areas, low walk-in flow
 */
function evaluateDestination(context: LocationContext, patterns: CountryPatterns): LocationTypeMatch {
  let score = 30; // Default low-moderate
  const reasons: string[] = [];
  let confidence = 0.65;

  const neighborhood = (context.neighborhood || '').toLowerCase();
  const pois = context.nearbyPOIs;

  // Low POI density suggests destination area
  if (pois) {
    const totalDensity = (pois.restaurants || 0) + (pois.cafes || 0) + 
                         (pois.offices || 0) + (pois.hotels || 0);
    
    if (totalDensity < 5) {
      score += 40;
      reasons.push(patterns.destination.lowTrafficReason);
      confidence = 0.8;
    } else if (totalDensity < 15) {
      score += 25;
      reasons.push(patterns.destination.lowTrafficReason);
    }
  }

  // Outlying areas (use residential keywords as proxy)
  const isOutlyingArea = patterns.residential.neighborhoodKeywords.some(keyword => 
    neighborhood.includes(keyword.toLowerCase())
  );
  if (isOutlyingArea) {
    score += 20;
    reasons.push('Outlying area');
  }

  score = Math.min(score, 100);
  const level = score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

  return {
    match_score: score,
    match_level: level,
    confidence,
    reason: reasons.length > 0 ? reasons.join('. ') : 'Not destination area'
  };
}
