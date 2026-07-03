/**
 * Weather Comfort Tier System
 * ----------------------------
 * Weighted scoring system for outdoor dining viability.
 * Replaces independent criteria with cumulative comfort assessment.
 * 
 * Uses feels-like temperature (apparent_temperature_mean from Open-Meteo)
 * which accounts for wind chill naturally.
 */

export type ComfortTier = 'premium' | 'viable' | 'marginal' | 'unviable';

export interface OutdoorComfortAssessment {
  tier: ComfortTier;
  score: number;
  feelsLike: number;
  emoji: string;
  label: string;
  blockers: string[];
  recommendation: string;
  breakdown: {
    tempScore: number;
    cloudScore: number;
    windScore: number;
    rainScore: number;
  };
}

export interface DayWeatherInput {
  temp_max: number;
  feels_like?: number;
  condition: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'snow' | 'fog';
  precipitation_chance?: number;
  wind_speed?: number;
}

/**
 * Map WMO condition to estimated cloud cover percentage.
 * Used for scoring when precise cloud % is unavailable.
 */
export function estimateCloudCover(condition: string): number {
  switch (condition) {
    case 'sunny':
      return 5; // Clear sky: 0-10% clouds
    case 'partly_cloudy':
      return 25; // Few to scattered: 10-40% clouds
    case 'cloudy':
      return 75; // Overcast: 60-100% clouds
    case 'fog':
      return 100; // Complete obscuration
    case 'rain':
    case 'snow':
      return 85; // Heavy cloud cover required for precipitation
    default:
      return 50; // Unknown: assume moderate
  }
}

/**
 * Determine if conditions represent active rain requiring indoor-only.
 * Combines WMO condition type with precipitation probability.
 */
export function isActiveRain(day: DayWeatherInput): boolean {
  const precipProb = day.precipitation_chance ?? 0;
  
  // Snow always counts as active precipitation
  if (day.condition === 'snow') return true;
  
  // Rain condition with high probability = active rain
  if (day.condition === 'rain' && precipProb > 70) return true;
  
  // Very high precipitation probability even without rain condition
  if (precipProb > 80) return true;
  
  return false;
}

/**
 * Assess outdoor dining comfort using weighted scoring system.
 * 
 * Scoring breakdown (total 100 points):
 * - Feels-like temperature: 50 points (most important)
 * - Cloud cover: 20 points
 * - Wind speed: 20 points
 * - Rain probability: 10 points
 * 
 * Hard blockers (instant Unviable):
 * - Feels-like temp <13°C
 * - Active rain (WMO rain/snow + precip prob >70%)
 * - Wind >9.8 m/s
 * 
 * @param day Weather data for a single day
 * @returns Complete comfort assessment with tier, score, and recommendations
 */
export function assessOutdoorComfort(day: DayWeatherInput): OutdoorComfortAssessment {
  const feelsLike = day.feels_like ?? day.temp_max;
  const cloudCover = estimateCloudCover(day.condition);
  const wind = day.wind_speed ?? 0;
  const precipProb = day.precipitation_chance ?? 0;
  
  // Initialize score breakdown
  const breakdown = {
    tempScore: 0,
    cloudScore: 0,
    windScore: 0,
    rainScore: 0,
  };
  
  // Check hard blockers first
  const blockers: string[] = [];
  if (feelsLike < 13) blockers.push('feels_too_cold');
  if (isActiveRain(day)) blockers.push('active_rain');
  if (wind > 9.8) blockers.push('strong_wind');
  
  if (blockers.length > 0) {
    return {
      tier: 'unviable',
      score: 0,
      feelsLike,
      emoji: '❌',
      label: 'Indoor Only',
      blockers,
      recommendation: 'Promote indoor comfort and atmosphere. Do not mention outdoor seating.',
      breakdown,
    };
  }
  
  // Calculate weighted score
  
  // 1. Feels-like temperature (50 points max)
  if (feelsLike >= 25 && feelsLike <= 28) {
    breakdown.tempScore = 50; // Perfect range
  } else if (feelsLike >= 21 && feelsLike < 25) {
    breakdown.tempScore = 45; // Excellent
  } else if (feelsLike >= 18 && feelsLike < 21) {
    breakdown.tempScore = 35; // Good
  } else if (feelsLike >= 16 && feelsLike < 18) {
    breakdown.tempScore = 20; // Acceptable with adjustments
  } else if (feelsLike >= 14 && feelsLike < 16) {
    breakdown.tempScore = 10; // Marginal
  } else if (feelsLike > 28 && feelsLike <= 32) {
    breakdown.tempScore = 40; // Hot but viable with shade
  } else if (feelsLike > 32) {
    breakdown.tempScore = 15; // Too hot, requires misters/shade
  }
  
  // 2. Cloud cover (20 points max)
  if (cloudCover <= 20) {
    breakdown.cloudScore = 20; // Clear sky
  } else if (cloudCover <= 40) {
    breakdown.cloudScore = 15; // Scattered clouds (ideal for preventing too hot)
  } else if (cloudCover <= 60) {
    breakdown.cloudScore = 8; // Moderate clouds
  } else if (cloudCover <= 80) {
    breakdown.cloudScore = 3; // Heavy overcast
  }
  // >80% = 0 points
  
  // 3. Wind speed (20 points max)
  if (wind <= 3) {
    breakdown.windScore = 20; // Calm to light air
  } else if (wind <= 5) {
    breakdown.windScore = 15; // Light breeze
  } else if (wind <= 7) {
    breakdown.windScore = 8; // Moderate breeze
  } else if (wind <= 9) {
    breakdown.windScore = 3; // Fresh breeze (napkins fly)
  }
  // >9 m/s = 0 points (or blocker if >9.8)
  
  // 4. Rain probability (10 points max)
  if (precipProb <= 10) {
    breakdown.rainScore = 10; // Negligible chance
  } else if (precipProb <= 20) {
    breakdown.rainScore = 8; // Slight chance
  } else if (precipProb <= 40) {
    breakdown.rainScore = 5; // Moderate chance
  } else if (precipProb <= 60) {
    breakdown.rainScore = 2; // Likely rain
  }
  // >60% = 0 points
  
  const totalScore = breakdown.tempScore + breakdown.cloudScore + breakdown.windScore + breakdown.rainScore;
  
  // Assign tier based on total score
  if (totalScore >= 85) {
    return {
      tier: 'premium',
      score: totalScore,
      feelsLike,
      emoji: '🥇',
      label: 'Peak Patio Weather',
      blockers: [],
      recommendation: 'Lead with outdoor dining - terrace beauty shots, "perfect weather", outdoor menu highlights.',
      breakdown,
    };
  } else if (totalScore >= 65) {
    return {
      tier: 'viable',
      score: totalScore,
      feelsLike,
      emoji: '🥈',
      label: 'Good Outdoor Conditions',
      blockers: [],
      recommendation: 'Mention outdoor seating available - show heated areas if cooler, "cozy terrace".',
      breakdown,
    };
  } else if (totalScore >= 45) {
    return {
      tier: 'marginal',
      score: totalScore,
      feelsLike,
      emoji: '🥉',
      label: 'Outdoor with Adjustments',
      blockers: [],
      recommendation: 'Focus on indoor experience - only mention outdoor if heated/covered, "all-weather comfort".',
      breakdown,
    };
  } else {
    return {
      tier: 'unviable',
      score: totalScore,
      feelsLike,
      emoji: '❌',
      label: 'Indoor Focus',
      blockers: ['low_comfort_score'],
      recommendation: 'Promote indoor comfort and atmosphere. Do not mention outdoor seating.',
      breakdown,
    };
  }
}

/**
 * Assess a full week's outdoor viability and return strategic summary.
 * Used by weather-interpreter to replace the old outdoorScore() function.
 */
export function assessWeekOutdoorViability(days: DayWeatherInput[]): {
  avgScore: number;
  bestDay: { weekday: string; assessment: OutdoorComfortAssessment } | null;
  worstDay: { weekday: string; assessment: OutdoorComfortAssessment } | null;
  premiumDays: number;
  viableDays: number;
  marginalDays: number;
  unviableDays: number;
  weekendUsability: 'good' | 'mixed' | 'poor';
} {
  const WEEKDAY_DK = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
  
  const assessments = days.map((day, idx) => ({
    weekday: WEEKDAY_DK[idx % 7],
    assessment: assessOutdoorComfort(day),
  }));
  
  // Count by tier
  const premiumDays = assessments.filter(a => a.assessment.tier === 'premium').length;
  const viableDays = assessments.filter(a => a.assessment.tier === 'viable').length;
  const marginalDays = assessments.filter(a => a.assessment.tier === 'marginal').length;
  const unviableDays = assessments.filter(a => a.assessment.tier === 'unviable').length;
  
  // Average score
  const avgScore = assessments.reduce((sum, a) => sum + a.assessment.score, 0) / Math.max(assessments.length, 1);
  
  // Best and worst days
  const sorted = [...assessments].sort((a, b) => b.assessment.score - a.assessment.score);
  const bestDay = sorted[0] ?? null;
  const worstDay = sorted[sorted.length - 1] ?? null;
  
  // Weekend usability (Saturday + Sunday)
  const weekendDays = assessments.filter(a => a.weekday === 'lørdag' || a.weekday === 'søndag');
  const weekendAvgScore = weekendDays.length > 0
    ? weekendDays.reduce((sum, a) => sum + a.assessment.score, 0) / weekendDays.length
    : avgScore;
  
  const weekendUsability: 'good' | 'mixed' | 'poor' =
    weekendAvgScore >= 65 ? 'good' : weekendAvgScore >= 45 ? 'mixed' : 'poor';
  
  return {
    avgScore,
    bestDay,
    worstDay,
    premiumDays,
    viableDays,
    marginalDays,
    unviableDays,
    weekendUsability,
  };
}
