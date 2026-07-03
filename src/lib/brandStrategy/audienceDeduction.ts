/**
 * Target Audience Deduction
 * 
 * DEDUCTION ORDER:
 * 1. Start with offerings + prices + hours → initial hypothesis
 * 2. Validate/refine with location categories (9 fixed)
 * 3. Apply seasonal modifiers (additive only)
 * 
 * CONSTRAINTS:
 * - Max 2 primary audiences
 * - Pool is fixed: locals, families, office_workers, students, social_groups, tourists
 * - Seasonal audiences are additive, never replace identity audiences
 */

import { 
  StrategyDeductionInputs, 
  TargetAudience, 
  TargetAudienceType,
  SeasonalAudienceModifier,
  CoreOfferings 
} from './types';

/**
 * Audience scoring rules based on business signals.
 */
interface AudienceScoreRules {
  offerings: string[]; // Offering patterns that boost this audience
  priceRange: [number, number]; // [min, max] average price that fits
  hours: string[]; // Opening hour patterns that indicate this audience
  locationCategories: string[]; // Location types that boost this audience
  locationBoost: number; // How much location category adds to score
}

const AUDIENCE_RULES: Record<TargetAudienceType, AudienceScoreRules> = {
  'locals': {
    offerings: ['specialty_coffee', 'weekend_brunch', 'weekday_lunch', 'casual_dinner', 'quick_takeaway', 'healthy_casual', 'comfort_food'],
    priceRange: [30, 150],
    hours: ['opensWeekdays', 'hasBreakfast', 'hasLunch'],
    locationCategories: ['residential', 'mixed_use'],
    locationBoost: 25
  },
  
  'families': {
    offerings: ['weekend_brunch', 'casual_dinner', 'comfort_food'],
    priceRange: [50, 200],
    hours: ['opensWeekends', 'hasBreakfast', 'hasLunch'],
    locationCategories: ['residential', 'city_centre', 'waterfront'],
    locationBoost: 20
  },
  
  'office_workers': {
    offerings: ['weekday_lunch', 'specialty_coffee', 'quick_takeaway'],
    priceRange: [40, 150],
    hours: ['opensWeekdays', 'hasBreakfast', 'hasLunch'],
    locationCategories: ['office', 'city_centre', 'mixed_use'],
    locationBoost: 30
  },
  
  'students': {
    offerings: ['specialty_coffee', 'weekday_lunch', 'weekend_brunch', 'cocktails_social', 'quick_takeaway'],
    priceRange: [30, 120],
    hours: ['hasBreakfast', 'hasLateNight'],
    locationCategories: ['student', 'city_centre'],
    locationBoost: 35
  },
  
  'social_groups': {
    offerings: ['casual_dinner', 'cocktails_social', 'natural_wine_focus', 'craft_beer_bar', 'late_night_bar'],
    priceRange: [80, 300],
    hours: ['hasDinner', 'hasLateNight', 'opensWeekends'],
    locationCategories: ['city_centre', 'waterfront', 'mixed_use'],
    locationBoost: 25
  },
  
  'tourists': {
    offerings: ['weekend_brunch', 'casual_dinner', 'natural_wine_focus', 'cocktails_social'],
    priceRange: [100, 400],
    hours: ['opensWeekends', 'hasLunch', 'hasDinner'],
    locationCategories: ['tourist', 'waterfront', 'city_centre'],
    locationBoost: 30
  }
};

/**
 * Calculate audience scores based on business signals.
 */
export function calculateAudienceScores(
  coreOfferings: CoreOfferings,
  inputs: StrategyDeductionInputs
): Record<TargetAudienceType, number> {
  const scores: Record<string, number> = {};
  
  for (const [audience, rules] of Object.entries(AUDIENCE_RULES)) {
    let score = 0;
    const reasons: string[] = [];
    
    // 1. Offerings match (most important: +20 per match)
    for (const offering of coreOfferings.offerings) {
      if (rules.offerings.includes(offering)) {
        score += 20;
        reasons.push(`offering: ${offering}`);
      }
    }
    
    // 2. Price range fit (+15 if within range)
    const [minPrice, maxPrice] = rules.priceRange;
    if (inputs.menu.avgPrice >= minPrice && inputs.menu.avgPrice <= maxPrice) {
      score += 15;
      reasons.push(`price fit (${inputs.menu.avgPrice}kr)`);
    }
    
    // 3. Hours pattern match (+10 per matching pattern)
    for (const hourPattern of rules.hours) {
      if (inputs.hours[hourPattern as keyof typeof inputs.hours]) {
        score += 10;
        reasons.push(`hours: ${hourPattern}`);
      }
    }
    
    // 4. Location category validation (boost strength depends on score quality)
    // If scoreSource is "areaTypeOnly", use lighter boost to avoid false confidence
    const scoreMultiplier = inputs.location.scoreSource === "fullScores" ? 1.0 : 0.5;
    
    for (const locationType of rules.locationCategories) {
      const locationScore = inputs.location.categoryScores[locationType] ?? 0;
      if (locationScore > 50) { // High confidence in this location type
        const boost = Math.round(rules.locationBoost * scoreMultiplier);
        score += boost;
        reasons.push(`location: ${locationType} (${locationScore}%, boost: ${boost})`);
      }
    }
    
    scores[audience] = score;
  }
  
  return scores as Record<TargetAudienceType, number>;
}

/**
 * Select primary audiences (max 2) from scores.
 */
export function selectPrimaryAudiences(
  scores: Record<TargetAudienceType, number>
): { audiences: TargetAudienceType[], reasoning: string[] } {
  const sortedAudiences = Object.entries(scores)
    .filter(([_, score]) => score > 0)
    .sort(([_, a], [__, b]) => b - a)
    .slice(0, 2); // Max 2 primary audiences
  
  const audiences = sortedAudiences.map(([aud]) => aud as TargetAudienceType);
  const reasoning = sortedAudiences.map(([aud, score]) => 
    `${aud}: score ${score}`
  );
  
  return { audiences, reasoning };
}

/**
 * Generate seasonal audience modifiers (additive only).
 * 
 * Seasonal logic:
 * - Summer: Tourists get boosted for waterfront/tourist locations
 * - Winter: Locals get boosted for cozy indoor spaces
 * - These are ADDITIVE to primary audiences, never replacements
 * 
 * IMPORTANT: Only generates modifiers for CURRENT season based on inputs.context.season
 */
export function generateSeasonalModifiers(
  inputs: StrategyDeductionInputs
): SeasonalAudienceModifier[] {
  const modifiers: SeasonalAudienceModifier[] = [];
  const currentSeason = inputs.context.season;
  
  // Summer boost for tourists in tourist/waterfront areas
  // Only applies if scoreSource indicates reliable location data
  if (currentSeason === 'summer') {
    const waterfrontScore = inputs.location.categoryScores['waterfront'] ?? 0;
    const touristScore = inputs.location.categoryScores['tourist'] ?? 0;
    
    // Only add if we have good location data (not just areaTypeOnly fallback)
    // OR if the scores are very high even with fallback
    const hasReliableLocationData = inputs.location.scoreSource === 'fullScores' || 
                                   waterfrontScore > 80 || 
                                   touristScore > 80;
    
    if (hasReliableLocationData && (waterfrontScore > 60 || touristScore > 60)) {
      modifiers.push({
        season: 'summer',
        additional_audiences: ['tourists'],
        reasoning: 'Vandfront/turistområde tiltrækker flere turister om sommeren'
      });
    }
  }
  
  // Winter boost for locals in residential areas
  if (currentSeason === 'winter') {
    const residentialScore = inputs.location.categoryScores['residential'] ?? 0;
    
    if (residentialScore > 60) {
      modifiers.push({
        season: 'winter',
        additional_audiences: ['locals'],
        reasoning: 'Boligområde med flere lokale i vintermånederne'
      });
    }
  }
  
  return modifiers;
}

/**
 * Deduce complete target audience structure.
 * 
 * This is the main entry point for audience deduction.
 */
export function deduceTargetAudience(
  coreOfferings: CoreOfferings,
  inputs: StrategyDeductionInputs
): TargetAudience {
  const scores = calculateAudienceScores(coreOfferings, inputs);
  const { audiences, reasoning } = selectPrimaryAudiences(scores);
  const seasonal = generateSeasonalModifiers(inputs);
  
  // Determine confidence based on top score
  const topScore = Math.max(...Object.values(scores));
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  if (topScore >= 50) {
    confidence = 'high';
  } else if (topScore >= 30) {
    confidence = 'medium';
  }
  
  return {
    primary: audiences,
    seasonal,
    reasoning,
    confidence
  };
}
