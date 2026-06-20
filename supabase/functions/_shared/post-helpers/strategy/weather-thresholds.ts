/**
 * Unified Weather Thresholds Configuration
 * -----------------------------------------
 * Single source of truth for all weather decision thresholds.
 * Replaces scattered hardcoded values across multiple files.
 * 
 * All thresholds use the weighted comfort tier system from weather-comfort-tiers.ts
 * for outdoor seating assessment. These thresholds are for strategic behavioral signals.
 */

export const WEATHER_THRESHOLDS = {
  /**
   * Terrace Pull: When weather drives outdoor dining behavior.
   * Used in context-interpreters.ts deriveWeatherRelevance().
   * 
   * Criteria:
   * - Average feels-like temp ≥16°C (Viable tier minimum)
   * - Average rain probability <30% (avoid active rain days)
   * - Average wind speed <7 m/s (Moderate breeze max)
   */
  TERRACE_PULL: {
    feelsLikeTempMin: 16,
    rainProbMax: 30,
    windSpeedMax: 7.0,
  },

  /**
   * Indoor Refuge: When weather drives people indoors for comfort.
   * Used in context-interpreters.ts deriveWeatherRelevance().
   * 
   * Criteria:
   * - Average feels-like temp ≤12°C (below Marginal tier)
   * - OR average rain probability ≥50% (likely rain most days)
   */
  INDOOR_REFUGE: {
    feelsLikeTempMax: 12,
    rainProbMin: 50,
  },

  /**
   * Takeaway Pull: When weather increases takeaway/grab-and-go behavior.
   * Cold or rainy weather increases coffee/hot beverage takeaway.
   * 
   * Criteria:
   * - Average temp <10°C (cold weather comfort drinks)
   * - OR average rain probability >50% (people avoid sitting)
   */
  TAKEAWAY_PULL: {
    tempMax: 10,
    rainProbMin: 50,
  },

  /**
   * Weather Newsworthy: When weather deviates meaningfully from seasonal baseline.
   * Used in weather-interpreter.ts to determine if weather should be a content angle.
   * 
   * Criteria:
   * - Forecast avg max temp ≥ baseline + 3°C (notably warmer than normal)
   * - OR forecast avg max temp ≤ baseline min - 3°C (notably colder than normal)
   * - OR baseline says outdoor not viable but forecast ≥15°C (unexpected outdoor opportunity)
   */
  NEWSWORTHY: {
    tempDeltaC: 3, // Degrees above/below baseline to trigger newsworthy
    unexpectedOutdoorTempMin: 15, // Minimum temp for outdoor when baseline says not viable
  },

  /**
   * Forecast Reliability: Day count thresholds for confidence levels.
   * Open-Meteo provides 16-day forecast with decreasing accuracy.
   * 
   * Days 0-3: specific (high confidence)
   * Days 4-6: cautious (medium confidence)
   * Days 7+: seasonal (low confidence)
   */
  FORECAST_CONFIDENCE: {
    highConfidenceDays: 5, // ≥5 'specific' days = high confidence
    mediumConfidenceDays: 3, // ≥3 'specific' days = medium confidence
  },

  /**
   * Precipitation Detection: When a day counts as a "rain day".
   * Used in weather-interpreter.ts for precipitation_days array.
   * 
   * Criteria:
   * - Condition is 'rain' or 'snow' (WMO code indicates active precipitation)
   * - OR precipitation probability ≥60% (likely rain even if condition not yet rain)
   */
  PRECIPITATION_DAY: {
    precipProbMin: 60,
  },

  /**
   * Weekend Definition: Days considered "weekend" for weekend usability scoring.
   */
  WEEKEND_DAYS: ['lørdag', 'søndag'] as const,

  /**
   * Weather Snapshot TTL: How long strategy weather snapshots remain fresh.
   * Used in UI to determine when to trigger refresh.
   * 
   * Fresh: <6 hours (no refresh needed)
   * Stale: 6-24 hours (suggest refresh, auto-refresh on Thu-Sun)
   * Expired: >24 hours (force refresh)
   */
  SNAPSHOT_TTL_MS: {
    FRESH: 6 * 60 * 60 * 1000,      // 6 hours
    STALE: 12 * 60 * 60 * 1000,     // 12 hours - trigger auto-refresh on Thu-Sun
    EXPIRED: 24 * 60 * 60 * 1000,   // 24 hours - force refresh
  },

  /**
   * Auto-Refresh Days: Days of week when stale weather triggers auto-refresh.
   * Thursday (4) through Sunday (0) when planning next week.
   * 
   * Rationale: By Thursday, next week's forecast is more accurate and users
   * are planning weekend content, so weather needs to be current.
   */
  AUTO_REFRESH_DAYS: [0, 4, 5, 6] as const, // Sunday, Thursday, Friday, Saturday
} as const;

/**
 * Danish Seasonal Weather Baselines (fallback when API fails).
 * Month → [min_temp, max_temp, rain_chance, wind_speed, humidity]
 * 
 * Used in weather-fetcher.ts createFallbackDay().
 */
export const DANISH_SEASONAL_BASELINES = {
  1:  [-2,  3, 40, 6, 85],  // January
  2:  [-1,  4, 35, 6, 80],  // February
  3:  [ 2,  8, 30, 5, 75],  // March
  4:  [ 6, 13, 25, 5, 70],  // April
  5:  [10, 18, 20, 4, 65],  // May
  6:  [14, 22, 15, 4, 65],  // June
  7:  [16, 24, 15, 3, 70],  // July
  8:  [16, 23, 20, 3, 70],  // August
  9:  [12, 18, 25, 4, 75],  // September
  10: [ 8, 12, 35, 5, 80],  // October
  11: [ 4,  7, 40, 6, 85],  // November
  12: [ 0,  4, 40, 6, 85],  // December
} as const;

/**
 * Weather Pattern Temperature Thresholds (Danish climate).
 * Used in weather-fetcher.ts deriveWeatherPattern().
 */
export const PATTERN_THRESHOLDS = {
  COLD_WEEK_MAX_TEMP: 5,   // Average temp below this = cold_week
  MILD_WEEK_MIN_TEMP: 14,  // Average temp above this = mild_week
  HOT_WEEK_MIN_TEMP: 20,   // Average temp above this = hot_week
  RAINY_WEEK_MIN_DAYS: 3,  // Days with rain condition to classify as rainy_week
} as const;
