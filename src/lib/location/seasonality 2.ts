/**
 * Seasonality System for Danish Location Types
 * 
 * Determines how relevant each location type is during different seasons.
 * Used to calculate Strategy Driver (matchScore × seasonalWeight).
 */

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export type SeasonalRelevance = 'high' | 'medium' | 'low';

/**
 * Get current season from month (1-12)
 */
export function getSeasonFromMonth(month: number): Season {
  if (month >= 12 || month <= 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  return 'autumn'; // 9-11
}

/**
 * Get current month (1-12)
 */
export function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

/**
 * Denmark-specific seasonal weights per location type
 */
const SEASONAL_WEIGHTS: Record<string, Record<Season, number>> = {
  // Waterfront highly seasonal - dead in winter
  waterfront: {
    summer: 1.0,
    spring: 0.8,
    autumn: 0.8,
    winter: 0.5
  },
  
  // Tourist areas moderately seasonal
  tourist: {
    summer: 1.0,
    spring: 0.8,
    autumn: 0.8,
    winter: 0.6
  },
  
  // City centre stable year-round
  city_centre: {
    summer: 0.9,
    spring: 0.9,
    autumn: 0.9,
    winter: 0.9
  },
  
  // Student areas slightly lower in summer (vacation)
  student: {
    summer: 0.75,
    spring: 0.9,
    autumn: 0.9,
    winter: 0.85
  },
  
  // Office/Business weekday-focused, stable seasons
  office: {
    summer: 0.8, // Lower due to summer holidays
    spring: 0.85,
    autumn: 0.85,
    winter: 0.85
  },
  
  // Transport hub stable year-round
  transport_hub: {
    summer: 0.85,
    spring: 0.85,
    autumn: 0.85,
    winter: 0.85
  },
  
  // Shopping district stable
  shopping_district: {
    summer: 0.85,
    spring: 0.85,
    autumn: 0.85,
    winter: 0.85
  },
  
  // Residential stable
  residential: {
    summer: 0.8,
    spring: 0.8,
    autumn: 0.8,
    winter: 0.8
  },
  
  // Mixed-use stable
  mixed_use: {
    summer: 0.85,
    spring: 0.85,
    autumn: 0.85,
    winter: 0.85
  },
  
  // Destination stable (people plan trips regardless)
  destination: {
    summer: 0.85,
    spring: 0.8,
    autumn: 0.8,
    winter: 0.75
  }
};

/**
 * Get seasonal weight for a location type
 */
export function getSeasonalWeight(categoryId: string, season?: Season): number {
  const currentSeason = season || getSeasonFromMonth(getCurrentMonth());
  const weights = SEASONAL_WEIGHTS[categoryId];
  
  if (!weights) {
    return 0.8; // Default neutral weight
  }
  
  return weights[currentSeason];
}

/**
 * Calculate strategy score (matchScore × seasonalWeight)
 */
export function calculateStrategyScore(matchScore: number, categoryId: string, season?: Season): number {
  const weight = getSeasonalWeight(categoryId, season);
  return matchScore * weight;
}

/**
 * Get seasonal relevance badge (High/Medium/Low)
 */
export function getSeasonalRelevance(categoryId: string, season?: Season): SeasonalRelevance {
  const weight = getSeasonalWeight(categoryId, season);
  
  if (weight >= 0.85) return 'high';
  if (weight >= 0.70) return 'medium';
  return 'low';
}

/**
 * Get Danish label for seasonal relevance
 */
export function getSeasonalRelevanceLabel(relevance: SeasonalRelevance): string {
  switch (relevance) {
    case 'high': return 'Høj sæsonrelevans';
    case 'medium': return 'Mellem sæsonrelevans';
    case 'low': return 'Lav sæsonrelevans';
  }
}

/**
 * Select strategy driver from location matches
 * Returns the location type with highest strategyScore (matchScore × seasonalWeight)
 */
export interface LocationMatch {
  categoryId: string;
  matchScore: number;
  displayName: string;
}

export interface StrategyDriver extends LocationMatch {
  strategyScore: number;
  seasonalWeight: number;
  seasonalRelevance: SeasonalRelevance;
}

export function selectStrategyDriver(
  matches: LocationMatch[],
  season?: Season
): StrategyDriver | null {
  if (matches.length === 0) return null;
  
  let bestDriver: StrategyDriver | null = null;
  let highestScore = 0;
  
  for (const match of matches) {
    const weight = getSeasonalWeight(match.categoryId, season);
    const strategyScore = match.matchScore * weight;
    
    if (strategyScore > highestScore) {
      highestScore = strategyScore;
      bestDriver = {
        ...match,
        strategyScore,
        seasonalWeight: weight,
        seasonalRelevance: getSeasonalRelevance(match.categoryId, season)
      };
    }
  }
  
  return bestDriver;
}
