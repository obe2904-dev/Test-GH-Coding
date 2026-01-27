/**
 * Danish Season Detection Helper
 * 
 * Simple heuristic for MVP - good enough for Denmark's climate patterns.
 * Used by brand strategy system to determine seasonal audience modifiers.
 */

import type { SeasonId } from './types';

/**
 * DK season heuristic (simple + good enough for MVP):
 * - summer: May–Sep (peak Jun–Aug)
 * - shoulder: Apr + Oct
 * - winter: Nov–Mar
 * 
 * @param date - Date to check (defaults to now)
 * @returns SeasonId for Danish marketing purposes
 * 
 * @example
 * inferSeasonForDK(new Date('2026-06-15')) // 'summer'
 * inferSeasonForDK(new Date('2026-04-01')) // 'shoulder'
 * inferSeasonForDK(new Date('2026-01-15')) // 'winter'
 */
export function inferSeasonForDK(date: Date = new Date()): SeasonId {
  const m = date.getMonth() + 1; // 1..12
  
  // Summer: May (5) through September (9)
  // Peak tourist season Jun-Aug, but extend to capture full warm weather
  if (m >= 5 && m <= 9) return "summer";
  
  // Shoulder: April (4) and October (10)
  // Transitional seasons with moderate weather and tourism
  if (m === 4 || m === 10) return "shoulder";
  
  // Winter: November (11) through March (3)
  // Cold months, indoor focus, local crowd
  return "winter";
}
