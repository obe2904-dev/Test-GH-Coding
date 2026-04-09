/**
 * Location Scoring Algorithm
 * Analyzes POI (Point of Interest) data to categorize business locations
 */

import { LocationCategoryId, CategoryMatch, AnalysisSignal } from '../../types/location';

interface POIData {
  restaurants: number;
  cafes: number;
  hotels: number;
  attractions: number;
  offices: number;
  schools_universities: number;
  residential_buildings: number;
  transit_stations: number;
  shopping_centers: number;
  parks: number;
  water_distance: number; // meters
  landmarks: { name: string; type: string; distance: number }[];
}

interface ScoringWeights {
  [key: string]: {
    [poiType: string]: number;
  };
}

const SCORING_WEIGHTS: ScoringWeights = {
  city_centre: {
    restaurants: 2,
    cafes: 2,
    nightlife: 3,
    retail_density: 3,
    pedestrian_streets: 3
  },
  residential: {
    residential_buildings: 4,
    low_commercial: 3,
    parks: 2,
    quiet_streets: 2
  },
  tourist: {
    attractions: 5,
    hotels: 3,
    landmarks: 4,
    cruise_terminal: 5
  },
  office: {
    offices: 5,
    business_parks: 4,
    low_evening_activity: 3
  },
  transport_hub: {
    transit_stations: 5,
    high_foot_traffic: 4,
    proximity_to_station: 5
  },
  student: {
    universities: 5,
    student_housing: 4,
    budget_restaurants: 3
  },
  waterfront: {
    water_proximity: 5,
    marina: 3,
    promenade: 4,
    parks: 2
  },
  shopping_district: {
    retail_density: 5,
    shopping_centers: 4,
    pedestrian_zones: 3
  },
  mixed_use: {
    new_development: 4,
    mixed_zoning: 5,
    balanced_poi: 3
  }
};

export function scoreLocation(poiData: POIData, _address: string): CategoryMatch[] {
  const matches: CategoryMatch[] = [];
  
  // Score each category
  Object.keys(SCORING_WEIGHTS).forEach((categoryId) => {
    const score = calculateCategoryScore(categoryId as LocationCategoryId, poiData);
    const confidence = score > 70 ? 'high' : score > 50 ? 'medium' : 'low';
    const reasoning = generateReasoning(categoryId as LocationCategoryId, poiData);
    const signals = extractSignals(categoryId as LocationCategoryId, poiData);
    
    matches.push({
      categoryId: categoryId as LocationCategoryId,
      score,
      confidence,
      reasoning,
      signals
    });
  });
  
  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}

function calculateCategoryScore(
  categoryId: LocationCategoryId,
  poiData: POIData
): number {
  let score = 0;
  
  switch (categoryId) {
    case 'city_centre':
      score += poiData.restaurants > 20 ? 25 : poiData.restaurants * 1.25;
      score += poiData.cafes > 15 ? 20 : poiData.cafes * 1.3;
      score += poiData.shopping_centers > 0 ? 15 : 0;
      // High density indicator
      if (poiData.restaurants + poiData.cafes > 30) score += 20;
      break;
      
    case 'residential':
      score += poiData.residential_buildings > 50 ? 40 : poiData.residential_buildings * 0.8;
      // Negative signals (less commercial = more residential)
      if (poiData.restaurants < 5) score += 20;
      if (poiData.offices < 3) score += 15;
      score += poiData.parks > 0 ? 10 : 0;
      break;
      
    case 'tourist':
      score += poiData.attractions > 3 ? 35 : poiData.attractions * 10;
      score += poiData.hotels > 5 ? 25 : poiData.hotels * 4;
      score += poiData.landmarks.length > 2 ? 25 : poiData.landmarks.length * 10;
      break;
      
    case 'office':
      score += poiData.offices > 15 ? 50 : poiData.offices * 3;
      // High office, low residential
      if (poiData.offices > 10 && poiData.residential_buildings < 10) score += 20;
      break;
      
    case 'transport_hub':
      score += poiData.transit_stations > 0 ? 60 : 0;
      // Proximity matters - this should come from actual distance data
      break;
      
    case 'student':
      score += poiData.schools_universities > 0 ? 70 : 0;
      // Student housing indicator would go here
      break;
      
    case 'waterfront':
      if (poiData.water_distance < 200) score += 60;
      else if (poiData.water_distance < 500) score += 30;
      score += poiData.parks > 0 ? 15 : 0;
      break;
      
    case 'shopping_district':
      score += poiData.shopping_centers > 2 ? 40 : poiData.shopping_centers * 15;
      // High retail density
      if (poiData.cafes + poiData.restaurants > 15) score += 20;
      break;
      
    case 'mixed_use':
      // Balanced POI distribution
      const hasOffices = poiData.offices > 5;
      const hasResidential = poiData.residential_buildings > 20;
      const hasRetail = poiData.restaurants + poiData.cafes > 10;
      const balanceCount = [hasOffices, hasResidential, hasRetail].filter(Boolean).length;
      score += balanceCount * 25;
      break;
      
    case 'destination':
      // Low density of walkable POIs = destination/drive-to
      const totalNearbyPOIs = poiData.restaurants + poiData.cafes + poiData.shopping_centers + poiData.offices;
      
      // Negative scoring: LOW POI density suggests destination
      if (totalNearbyPOIs < 5) score += 40;
      else if (totalNearbyPOIs < 10) score += 25;
      else if (totalNearbyPOIs < 15) score += 15;
      
      // Low residential also suggests non-central location
      if (poiData.residential_buildings < 10) score += 20;
      
      // Parking-oriented layout (would need POI type data)
      // Placeholder: assume if very few transit stations, it's car-dependent
      if (poiData.transit_stations === 0) score += 20;
      
      // Not waterfront or tourist area (those have their own categories)
      if (poiData.water_distance > 500 && poiData.attractions < 2) score += 10;
      
      break;
  }
  
  return Math.min(100, Math.max(0, score));
}

function generateReasoning(
  categoryId: LocationCategoryId,
  poiData: POIData
): string[] {
  const reasoning: string[] = [];
  
  switch (categoryId) {
    case 'city_centre':
      if (poiData.restaurants > 20) reasoning.push(`High restaurant density (${poiData.restaurants} nearby)`);
      if (poiData.cafes > 15) reasoning.push(`Strong cafe culture (${poiData.cafes} cafes)`);
      if (poiData.shopping_centers > 0) reasoning.push('Shopping centers nearby');
      break;
      
    case 'residential':
      if (poiData.residential_buildings > 30) reasoning.push(`Residential area (${poiData.residential_buildings} buildings)`);
      if (poiData.restaurants < 5) reasoning.push('Limited commercial activity');
      if (poiData.parks > 0) reasoning.push(`${poiData.parks} parks nearby`);
      break;
      
    case 'tourist':
      if (poiData.attractions > 0) reasoning.push(`${poiData.attractions} tourist attractions within 500m`);
      if (poiData.hotels > 3) reasoning.push(`${poiData.hotels} hotels in the area`);
      poiData.landmarks.slice(0, 2).forEach(landmark => {
        reasoning.push(`${Math.round(landmark.distance)}m from ${landmark.name}`);
      });
      break;
      
    case 'office':
      if (poiData.offices > 10) reasoning.push(`${poiData.offices} office buildings nearby`);
      if (poiData.offices > 10 && poiData.residential_buildings < 10) {
        reasoning.push('Business district with limited residential');
      }
      break;
      
    case 'transport_hub':
      if (poiData.transit_stations > 0) reasoning.push(`${poiData.transit_stations} transit stations nearby`);
      break;
      
    case 'student':
      if (poiData.schools_universities > 0) reasoning.push(`${poiData.schools_universities} educational institutions nearby`);
      break;
      
    case 'waterfront':
      if (poiData.water_distance < 200) reasoning.push(`${Math.round(poiData.water_distance)}m from waterfront`);
      else if (poiData.water_distance < 500) reasoning.push(`${Math.round(poiData.water_distance)}m from water`);
      if (poiData.parks > 0) reasoning.push('Parks and promenades nearby');
      break;
      
    case 'shopping_district':
      if (poiData.shopping_centers > 0) reasoning.push(`${poiData.shopping_centers} shopping centers`);
      if (poiData.cafes + poiData.restaurants > 15) {
        reasoning.push(`High retail density (${poiData.cafes + poiData.restaurants} venues)`);
      }
      break;
      
    case 'mixed_use':
      const hasOffices = poiData.offices > 5;
      const hasResidential = poiData.residential_buildings > 20;
      const hasRetail = poiData.restaurants + poiData.cafes > 10;
      if (hasOffices) reasoning.push('Office presence');
      if (hasResidential) reasoning.push('Residential buildings');
      if (hasRetail) reasoning.push('Retail activity');
      break;
      
    case 'destination':
      const totalPOIs = poiData.restaurants + poiData.cafes + poiData.shopping_centers + poiData.offices;
      if (totalPOIs < 10) reasoning.push(`Low density of walkable retail/POIs within 400m (${totalPOIs} found)`);
      if (poiData.transit_stations === 0) reasoning.push('No nearby public transport - car-oriented access');
      if (poiData.residential_buildings < 10) reasoning.push('Location appears outside dense central streets');
      reasoning.push('Customers likely travel here intentionally rather than passing by');
      break;
  }
  
  return reasoning;
}

function extractSignals(
  categoryId: LocationCategoryId,
  poiData: POIData
): AnalysisSignal[] {
  // Convert POI data into structured signals
  // This is used for transparency/debugging
  const signals: AnalysisSignal[] = [];
  
  // Extract landmarks for tourist category
  if (categoryId === 'tourist' && poiData.landmarks.length > 0) {
    poiData.landmarks.forEach(landmark => {
      signals.push({
        type: 'landmark',
        name: landmark.name,
        distance: landmark.distance,
        weight: landmark.distance < 200 ? 5 : 3
      });
    });
  }
  
  // Extract office signals
  if (categoryId === 'office' && poiData.offices > 0) {
    signals.push({
      type: 'office_building',
      name: `${poiData.offices} offices`,
      distance: 0,
      weight: 5
    });
  }
  
  // Extract transit signals
  if (categoryId === 'transport_hub' && poiData.transit_stations > 0) {
    signals.push({
      type: 'transit_station',
      name: `${poiData.transit_stations} stations`,
      distance: 0,
      weight: 5
    });
  }
  
  // Extract waterfront signals
  if (categoryId === 'waterfront' && poiData.water_distance < 500) {
    signals.push({
      type: 'water',
      name: 'Waterfront',
      distance: poiData.water_distance,
      weight: poiData.water_distance < 200 ? 5 : 3
    });
  }
  
  // Extract restaurant/cafe density signals for city centre
  if (categoryId === 'city_centre') {
    if (poiData.restaurants > 10) {
      signals.push({
        type: 'restaurant',
        name: `${poiData.restaurants} restaurants`,
        distance: 0,
        weight: 3
      });
    }
    if (poiData.cafes > 10) {
      signals.push({
        type: 'cafe',
        name: `${poiData.cafes} cafes`,
        distance: 0,
        weight: 3
      });
    }
  }
  
  // Extract educational signals for student areas
  if (categoryId === 'student' && poiData.schools_universities > 0) {
    signals.push({
      type: 'university',
      name: `${poiData.schools_universities} educational institutions`,
      distance: 0,
      weight: 5
    });
  }
  
  // Extract residential signals
  if (categoryId === 'residential' && poiData.residential_buildings > 20) {
    signals.push({
      type: 'residential',
      name: `${poiData.residential_buildings} residential buildings`,
      distance: 0,
      weight: 4
    });
  }
  
  // Extract shopping signals
  if (categoryId === 'shopping_district' && poiData.shopping_centers > 0) {
    signals.push({
      type: 'shopping_center',
      name: `${poiData.shopping_centers} shopping centers`,
      distance: 0,
      weight: 4
    });
  }
  
  return signals;
}

export type { POIData };
