/**
 * Season Detection Utilities (Task 4.3)
 * 
 * Purpose: Determine current season for seasonal audience filtering
 * 
 * Background: The audience_framework.seasonalVariation field contains summer/winter
 * audience definitions, but was never used in content generation. This utility
 * enables seasonal audience filtering to match actual customer demographics.
 * 
 * @see CONTENT-SYSTEMS-IMPROVEMENT-PLAN.md Task 4.3
 * @see SEASONAL-AUDIENCE-FLOW-ANALYSIS.md for detailed implementation analysis
 */

/**
 * Supported seasons (matches seasonalVariation schema)
 */
export type Season = 'summer' | 'winter';

/**
 * Determine season from month number (0-11)
 * 
 * Danish Seasons:
 * - Summer (April-September): Outdoor season, months 3-8
 *   NOTE: Tourist peak is ONLY July-August. Early June is pre-summer, locals only.
 * - Winter (October-March): Off-season, local focus, months 9-11, 0-2
 * 
 * This binary mapping aligns with the existing seasonalVariation structure
 * which only has "summer" and "winter" keys (no spring/autumn).
 * 
 * Tourist Timing (for content generation):
 * - April-early June: Local customers, NO tourist assumptions
 * - July-August: Peak tourist season (international visitors)
 * - September: Transition back to locals
 * 
 * @param month - JavaScript month (0=January, 11=December)
 * @returns 'summer' or 'winter'
 * 
 * @example
 * getSeasonFromMonth(0)  // 'winter' (January)
 * getSeasonFromMonth(6)  // 'summer' (July - PEAK TOURIST SEASON)
 * getSeasonFromMonth(3)  // 'summer' (April - outdoor season, LOCALS ONLY)
 * getSeasonFromMonth(5)  // 'summer' (June - pre-summer, LOCALS ONLY)
 * getSeasonFromMonth(8)  // 'summer' (September - still outdoor, transitioning to locals)
 * getSeasonFromMonth(9)  // 'winter' (October - off-season begins)
 */
export function getSeasonFromMonth(month: number): Season {
  // Validate input
  if (month < 0 || month > 11) {
    console.warn(`Invalid month: ${month}. Defaulting to winter.`);
    return 'winter';
  }
  
  // April (3) through September (8) = summer
  // October (9) through March (0-2, 9-11) = winter
  return (month >= 3 && month <= 8) ? 'summer' : 'winter';
}

/**
 * Get current season based on Danish timezone
 * 
 * Uses Europe/Copenhagen timezone to ensure accurate season detection
 * regardless of server location.
 * 
 * @returns Current season ('summer' or 'winter')
 * 
 * @example
 * getCurrentSeason()  // 'summer' (if called in July)
 */
export function getCurrentSeason(): Season {
  const now = new Date();
  
  // Get current month in Danish timezone
  const danishDateParts = new Intl.DateTimeFormat('da', {
    timeZone: 'Europe/Copenhagen',
    month: 'numeric'
  }).formatToParts(now);
  
  const monthString = danishDateParts.find(p => p.type === 'month')?.value ?? '1';
  const month = parseInt(monthString, 10) - 1; // Convert to 0-based (JS months)
  
  return getSeasonFromMonth(month);
}

/**
 * Get Danish season name for display
 * 
 * @param season - Season identifier
 * @returns Danish season name
 * 
 * @example
 * getSeasonNameDanish('summer')  // 'sommer'
 * getSeasonNameDanish('winter')  // 'vinter'
 */
export function getSeasonNameDanish(season: Season): string {
  return season === 'summer' ? 'sommer' : 'vinter';
}

/**
 * Check if a given month falls within summer season
 * 
 * @param month - JavaScript month (0-11)
 * @returns True if month is in summer season
 * 
 * @example
 * isSummerMonth(6)   // true (July)
 * isSummerMonth(11)  // false (December)
 */
export function isSummerMonth(month: number): boolean {
  return getSeasonFromMonth(month) === 'summer';
}

/**
 * Check if a given month falls within winter season
 * 
 * @param month - JavaScript month (0-11)
 * @returns True if month is in winter season
 * 
 * @example
 * isWinterMonth(1)   // true (February)
 * isWinterMonth(7)   // false (August)
 */
export function isWinterMonth(month: number): boolean {
  return getSeasonFromMonth(month) === 'winter';
}

/**
 * Get month range for a season
 * 
 * @param season - Season identifier
 * @returns Array of month numbers (0-11) in that season
 * 
 * @example
 * getMonthsForSeason('summer')  // [3, 4, 5, 6, 7, 8]
 * getMonthsForSeason('winter')  // [9, 10, 11, 0, 1, 2]
 */
export function getMonthsForSeason(season: Season): number[] {
  if (season === 'summer') {
    return [3, 4, 5, 6, 7, 8]; // April-September
  } else {
    return [9, 10, 11, 0, 1, 2]; // October-March
  }
}
