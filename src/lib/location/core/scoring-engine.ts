/**
 * Location Scoring Engine
 * Scores location against all 9 categories using locale-aware rules
 */

import { 
  LocationCategoryId, 
  CategoryMatch, 
  LocaleConfig,
  AnalysisSignal 
} from './types';
import { POIAnalysisResult } from '../detectors/poi-analyzer';

interface ScoringContext {
  waterfrontScore?: number;
  waterfrontDetails?: string[];
  waterfrontSignals?: AnalysisSignal[];
  websiteContext?: any;
  city?: string;
}

/**
 * Score location against all categories
 */
export function scoreLocation(
  poiData: POIAnalysisResult,
  _address: string,
  localeConfig: LocaleConfig,
  context: ScoringContext = {}
): CategoryMatch[] {
  
  // Extract locale-specific settings
  const isDanish = localeConfig.locale.startsWith('da');
  const localeContext = {
    isDanish,
    // Danish cities are generally smaller - use lower thresholds
    cityScaleFactor: isDanish ? 0.7 : 1.0,
    // Waterfront/leisure is culturally more relevant in Denmark
    waterfrontBoost: isDanish ? 1.15 : 1.0,
    // Student areas are very distinct in Danish cities
    studentBoost: isDanish ? 1.1 : 1.0
  };
  
  const categoryScores: Record<LocationCategoryId, { 
    score: number; 
    reasoning: string[]; 
    signals: AnalysisSignal[] 
  }> = {
    city_centre: { score: 0, reasoning: [], signals: [] },
    residential: { score: 0, reasoning: [], signals: [] },
    tourist: { score: 0, reasoning: [], signals: [] },
    office: { score: 0, reasoning: [], signals: [] },
    transport_hub: { score: 0, reasoning: [], signals: [] },
    student: { score: 0, reasoning: [], signals: [] },
    waterfront: { score: 0, reasoning: [], signals: [] },
    shopping_district: { score: 0, reasoning: [], signals: [] },
    mixed_use: { score: 0, reasoning: [], signals: [] },
    nature_park: { score: 0, reasoning: [], signals: [] },
    destination: { score: 0, reasoning: [], signals: [] }
  };
  
  // Score City Centre (locale-adjusted)
  const cityScore = scoreCityCentre(poiData, context, localeContext);
  categoryScores.city_centre = cityScore;
  
  // Score Waterfront (enhanced with locale detection)
  if (context.waterfrontScore && context.waterfrontScore > 0) {
    // Apply locale-specific waterfront boost
    const adjustedWaterfrontScore = Math.min(95, Math.round(context.waterfrontScore * localeContext.waterfrontBoost));
    categoryScores.waterfront.score = adjustedWaterfrontScore;
    categoryScores.waterfront.reasoning = context.waterfrontDetails || [];
    categoryScores.waterfront.signals = context.waterfrontSignals || [];
  } else {
    // Fallback: score waterfront from POI data if detector didn't run
    const waterfrontScore = scoreWaterfront(poiData);
    if (waterfrontScore.score > 0) {
      categoryScores.waterfront = waterfrontScore;
    }
  }
  
  // Score Tourist
  const touristScore = scoreTourist(poiData);
  categoryScores.tourist = touristScore;
  
  // Score Shopping District
  const shoppingScore = scoreShopping(poiData);
  categoryScores.shopping_district = shoppingScore;
  
  // Score Office
  const officeScore = scoreOffice(poiData);
  categoryScores.office = officeScore;
  
  // Score Residential
  const residentialScore = scoreResidential(poiData);
  categoryScores.residential = residentialScore;
  
  // Score Student (locale-adjusted)
  const studentScore = scoreStudent(poiData, localeContext);
  categoryScores.student = studentScore;
  
  // Score Transport Hub
  const transportScore = scoreTransport(poiData);
  categoryScores.transport_hub = transportScore;
  
  // Convert to CategoryMatch array, sorted by score
  const matches: CategoryMatch[] = Object.entries(categoryScores)
    .filter(([_, data]) => data.score > 0)
    .map(([categoryId, data]) => {
      const confidence: 'high' | 'medium' | 'low' = 
        data.score > 80 ? 'high' : (data.score > 60 ? 'medium' : 'low');
      
      return {
        categoryId: categoryId as LocationCategoryId,
        score: data.score,
        confidence,
        reasoning: data.reasoning.length > 0 ? data.reasoning : [`${data.score}% match`],
        signals: data.signals
      };
    })
    .sort((a, b) => b.score - a.score);
  
  // Ensure at least one category (fallback to mixed_use)
  if (matches.length === 0) {
    matches.push({
      categoryId: 'mixed_use',
      score: 50,
      confidence: 'medium',
      reasoning: ['Standard blandet område'],
      signals: []
    });
  }
  
  return matches;
}

function scoreCityCentre(poiData: POIAnalysisResult, _context: ScoringContext, localeContext: any) {
  let score = 0;
  const reasoning: string[] = [];
  const signals: AnalysisSignal[] = [];
  
  // Calculate total POIs for density-based scoring
  const totalPOIs = poiData.restaurants + poiData.cafes + ((poiData as any).bars || 0) + 
                    poiData.hotels + poiData.shopping_centers + poiData.attractions +
                    poiData.offices + poiData.transit_stations;
  
  const foodPlaces = poiData.restaurants + poiData.cafes;
  
  // Apply locale-specific scale factor to thresholds
  const scaleFactor = localeContext.cityScaleFactor;
  
  // Use ratio-based scoring if we have enough data
  if (totalPOIs >= 5) {
    const foodDensity = foodPlaces / totalPOIs;
    
    // High food density indicates city centre (>40% is very high)
    if (foodDensity > 0.4) {
      score += 35;
      reasoning.push(`Høj densitet af restauranter/caféer (${Math.round(foodDensity * 100)}%)`);
    } else if (foodDensity > 0.25) {
      score += 20;
      reasoning.push(`God densitet af serveringssteder`);
    }
  }
  
  // Absolute counts (locale-adjusted thresholds)
  const restaurantThresholdHigh = Math.round(5 * scaleFactor);
  const restaurantThresholdMed = Math.round(2 * scaleFactor);
  const cafeThresholdHigh = Math.round(3 * scaleFactor);
  
  if (poiData.restaurants > restaurantThresholdHigh) {
    score += 25;
    reasoning.push(`${poiData.restaurants} restauranter i området`);
  } else if (poiData.restaurants > restaurantThresholdMed) {
    score += 15;
    reasoning.push(`${poiData.restaurants} restauranter`);
  } else if (poiData.restaurants > 0) {
    score += 5;
  }
  
  if (poiData.cafes > cafeThresholdHigh) {
    score += 20;
    reasoning.push(`${poiData.cafes} caféer i området`);
  } else if (poiData.cafes > 1) {
    score += 10;
    reasoning.push(`${poiData.cafes} caféer`);
  }
  
  // Shopping + hotels indicate city centre
  if (poiData.shopping_centers > 2) {
    score += 15;
    reasoning.push(`${poiData.shopping_centers} shoppingcentre`);
  } else if (poiData.shopping_centers > 0) {
    score += 8;
  }
  
  if (poiData.hotels > 3) {
    score += 15;
    reasoning.push('Hoteller i området');
  } else if (poiData.hotels > 1) {
    score += 8;
  }
  
  // Attractions add to city centre vibe
  if (poiData.attractions > 2) {
    score += 10;
    reasoning.push('Turistattraktioner');
  } else if (poiData.attractions > 0) {
    score += 5;
  }
  
  return { score: Math.min(score, 95), reasoning, signals };
}

function scoreTourist(poiData: POIAnalysisResult) {
  let score = 0;
  const reasoning: string[] = [];
  const signals: AnalysisSignal[] = [];
  
  // Tourist attractions are the strongest signal
  if (poiData.attractions > 3) {
    score += 50;
    reasoning.push(`${poiData.attractions} turistattraktioner nærved`);
  } else if (poiData.attractions > 0) {
    score += 30;
  }
  
  // Hotels indicate tourist area
  if (poiData.hotels > 5) {
    score += 25;
    reasoning.push('Mange hoteller i området');
  }
  
  // Landmarks
  if (poiData.landmarks.length > 0) {
    score += 15;
    signals.push({
      type: 'landmark',
      name: poiData.landmarks[0].name,
      distance: poiData.landmarks[0].distance,
      weight: 2
    });
  }
  
  return { score: Math.min(score, 95), reasoning, signals };
}

function scoreShopping(poiData: POIAnalysisResult) {
  let score = 0;
  const reasoning: string[] = [];
  
  if (poiData.shopping_centers > 3) {
    score += 60;
    reasoning.push('Shoppingområde med mange butikker');
  } else if (poiData.shopping_centers > 1) {
    score += 40;
  }
  
  // Cafes indicate shopping breaks
  if (poiData.cafes > 8 && poiData.shopping_centers > 0) {
    score += 20;
  }
  
  return { score: Math.min(score, 95), reasoning, signals: [] };
}

function scoreOffice(poiData: POIAnalysisResult) {
  let score = 0;
  const reasoning: string[] = [];
  
  if (poiData.offices > 10) {
    score += 70;
    reasoning.push('Høj koncentration af kontorer');
  } else if (poiData.offices > 5) {
    score += 50;
  }
  
  // Low residential/tourist, high office = office district
  if (poiData.offices > 5 && poiData.residential_buildings < 3 && poiData.attractions < 2) {
    score += 20;
  }
  
  return { score: Math.min(score, 95), reasoning, signals: [] };
}

function scoreResidential(poiData: POIAnalysisResult) {
  let score = 0;
  const reasoning: string[] = [];
  
  // Base quiet area score (reduced from 50 to 20)
  if (poiData.restaurants < 10 && poiData.cafes < 5 && poiData.offices < 5) {
    score += 20;
    reasoning.push('Roligt område med lav erhvervsaktivitet');
  }
  
  // Positive evidence: residential buildings
  if (poiData.residential_buildings > 5) {
    score += 30;
    reasoning.push('Mange boligbyggerier');
  } else if (poiData.residential_buildings > 2) {
    score += 20;
    reasoning.push('Boligområde');
  }
  
  // Parks indicate residential
  if (poiData.parks > 2) {
    score += 20;
    reasoning.push('Grønne områder og parker');
  }
  
  // Penalty if this is clearly a commercial/tourist area
  if (poiData.attractions > 3 || poiData.shopping_centers > 3 || poiData.transit_stations > 2) {
    score = Math.max(0, score - 25);
    reasoning.push('Erhvervsmæssig/turistmæssig aktivitet reducerer boligkarakter');
  }
  
  return { score: Math.min(score, 95), reasoning, signals: [] };
}

function scoreStudent(poiData: POIAnalysisResult, localeContext: any = {}) {
  let score = 0;
  const reasoning: string[] = [];
  
  if (poiData.schools_universities > 0) {
    const baseScore = 80;
    // Danish student areas are culturally very distinct - boost slightly
    const adjustedScore = Math.round(baseScore * (localeContext.studentBoost || 1.0));
    score += adjustedScore;
    reasoning.push('Nær uddannelsesinstitutioner');
  }
  
  // Cheap cafes near universities
  if (poiData.schools_universities > 0 && poiData.cafes > 5) {
    score += 10;
  }
  
  return { score: Math.min(score, 95), reasoning, signals: [] };
}

function scoreTransport(poiData: POIAnalysisResult) {
  let score = 0;
  const reasoning: string[] = [];
  
  if (poiData.transit_stations > 2) {
    score += 80;
    reasoning.push('Trafikknudepunkt med flere stationer');
  } else if (poiData.transit_stations > 0) {
    score += 60;
  }
  
  return { score: Math.min(score, 95), reasoning, signals: [] };
}

function scoreWaterfront(poiData: POIAnalysisResult) {
  let score = 0;
  const reasoning: string[] = [];
  const signals: AnalysisSignal[] = [];
  
  // Parks can indicate waterfront areas (promenades, coastal parks)
  if (poiData.parks > 3) {
    score += 25;
    reasoning.push('Mange grønne områder/parker');
  } else if (poiData.parks > 1) {
    score += 15;
  }
  
  // Entertainment + restaurants can indicate waterfront leisure areas
  if (((poiData as any).entertainment || 0) > 2 && poiData.restaurants > 3) {
    score += 20;
    reasoning.push('Fritids- og restaurantaktivitet');
  }
  
  // Bars + restaurants (nightlife by the water)
  if (((poiData as any).bars || 0) > 2 && poiData.restaurants > 5) {
    score += 20;
    reasoning.push('Aktivt udeliv og serveringssteder');
  }
  
  // Hotels + attractions (tourist waterfront)
  if (poiData.hotels > 3 && poiData.attractions > 2) {
    score += 15;
    reasoning.push('Turistområde med hoteller og attraktioner');
  }
  
  // Note: This is a weak signal - prefer dedicated waterfront detector
  if (score > 0) {
    reasoning.push('(POI-baseret estimat - kan være upræcist)');
  }
  
  return { score: Math.min(score, 70), reasoning, signals }; // Cap at 70 - less confident than detector
}
