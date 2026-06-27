/**
 * SEGMENT TIMING MATCHER
 * 
 * Purpose: Determine if a given day/time falls within strategic audience segments
 * or represents gap-time capacity that should use format appeal instead.
 * 
 * Core Concept:
 * - Strategic Segments: 2-4 focused time/audience combinations (e.g., "Weekend-familier på middag")
 * - Gap Times: All other operating hours (e.g., Monday lunch, late weekend)
 * 
 * Usage:
 * - Weekly Plan Generator: Assign segment mode to each post slot
 * - Daily Suggestions: Match current time to appropriate content mode
 * - Generate Text IDE: Show timing hints in UI
 */

import type { AudienceSegment } from '../brand-profile/audience-profile.ts'

// ============================================================================
// TYPES
// ============================================================================

export interface SegmentTimingMatch {
  mode: 'strategic_segment' | 'gap_capacity'
  matchedSegment?: {
    people_type: string           // e.g., "Familier", "Par", "Vennegrupper"
    timing: string                // e.g., "Lør-Søn 17:00-20:00"
    situation?: string            // e.g., "Familier med børn der spiser middag i weekenden"
    content_angles: string[]      // Key messaging angles for this segment
  }
  gapRationale?: string           // Why this is gap capacity (only for gap_capacity mode)
}

export interface StrategicCoverage {
  covered_slots: Array<{
    day: string                   // "Monday", "Tuesday", etc.
    time_range: string            // "18:00-21:00"
    segment_name: string          // "Date Night par"
    people_type: string           // "Par"
  }>
  gap_strategy: string            // Default message for gap times
}

// ============================================================================
// DAY NAME MAPPING
// ============================================================================

const DANISH_TO_ENGLISH_DAYS: Record<string, string[]> = {
  'Monday': ['man', 'mandag'],
  'Tuesday': ['tir', 'tirsdag'],
  'Wednesday': ['ons', 'onsdag'],
  'Thursday': ['tor', 'torsdag'],
  'Friday': ['fre', 'fredag'],
  'Saturday': ['lør', 'lørdag'],
  'Sunday': ['søn', 'søndag'],
}

const DANISH_DAY_ABBREVIATIONS: Record<string, string> = {
  'man': 'Monday',
  'tir': 'Tuesday',
  'ons': 'Wednesday',
  'tor': 'Thursday',
  'fre': 'Friday',
  'lør': 'Saturday',
  'søn': 'Sunday',
}

// ============================================================================
// TIME PARSING
// ============================================================================

/**
 * Parse timing window string like "Lør-Søn 17:00-20:00" or "Tir-Tor 18:00-21:00"
 * Returns array of { day, startHour, endHour } objects
 */
function parseTimingWindow(window: string): Array<{ day: string; startHour: number; endHour: number }> {
  const result: Array<{ day: string; startHour: number; endHour: number }> = []
  
  // Example: "Lør-Søn 17:00-20:00" or "Fre 18:00-22:00"
  const match = window.match(/^([a-zæøåA-ZÆØÅ]+)(?:-([a-zæøåA-ZÆØÅ]+))?\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})$/)
  
  if (!match) {
    console.warn(`[segment-timing-matcher] Could not parse timing window: ${window}`)
    return result
  }
  
  const [, startDayAbbrev, endDayAbbrev, startHourStr, , endHourStr] = match
  const startHour = parseInt(startHourStr, 10)
  const endHour = parseInt(endHourStr, 10)
  
  // Map Danish abbreviation to English day name
  const startDay = DANISH_DAY_ABBREVIATIONS[startDayAbbrev.toLowerCase()]
  if (!startDay) {
    console.warn(`[segment-timing-matcher] Unknown day abbreviation: ${startDayAbbrev}`)
    return result
  }
  
  if (endDayAbbrev) {
    // Range: "Lør-Søn" or "Tir-Tor"
    const endDay = DANISH_DAY_ABBREVIATIONS[endDayAbbrev.toLowerCase()]
    if (!endDay) {
      console.warn(`[segment-timing-matcher] Unknown day abbreviation: ${endDayAbbrev}`)
      return result
    }
    
    // Add all days in range
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const startIdx = days.indexOf(startDay)
    const endIdx = days.indexOf(endDay)
    
    if (startIdx === -1 || endIdx === -1) {
      console.warn(`[segment-timing-matcher] Invalid day range: ${startDay}-${endDay}`)
      return result
    }
    
    // Handle wrap-around (e.g., Sat-Sun)
    if (startIdx <= endIdx) {
      for (let i = startIdx; i <= endIdx; i++) {
        result.push({ day: days[i], startHour, endHour })
      }
    } else {
      // Wrap around week (unlikely but handle it)
      for (let i = startIdx; i < days.length; i++) {
        result.push({ day: days[i], startHour, endHour })
      }
      for (let i = 0; i <= endIdx; i++) {
        result.push({ day: days[i], startHour, endHour })
      }
    }
  } else {
    // Single day: "Fre 18:00-22:00"
    result.push({ day: startDay, startHour, endHour })
  }
  
  return result
}

/**
 * Check if a given time falls within a time range
 * @param time - "14:00" or "19:30"
 * @param startHour - 12
 * @param endHour - 17
 */
function isTimeInRange(time: string, startHour: number, endHour: number): boolean {
  const [hourStr, minuteStr] = time.split(':')
  const hour = parseInt(hourStr, 10)
  const minute = parseInt(minuteStr, 10)
  
  // Check if hour is within range
  // Note: endHour is exclusive (12:00-17:00 means up to 16:59)
  if (hour < startHour || hour >= endHour) {
    return false
  }
  
  return true
}

// ============================================================================
// SEGMENT MATCHING
// ============================================================================

/**
 * Match a specific day/time to strategic audience segments
 * 
 * @param day - English day name ("Monday", "Saturday", etc.)
 * @param time - Time string ("14:00", "19:30")
 * @param segments - Array of audience segments from brand profile V5
 * @returns SegmentTimingMatch object indicating mode and details
 */
export function matchTimingToSegment(
  day: string,
  time: string,
  segments: AudienceSegment[]
): SegmentTimingMatch {
  // Try to match against each segment's timing windows
  for (const segment of segments) {
    for (const window of segment.timing_windows) {
      const parsedWindows = parseTimingWindow(window)
      
      for (const parsed of parsedWindows) {
        if (parsed.day === day && isTimeInRange(time, parsed.startHour, parsed.endHour)) {
          // MATCH! This time falls within a strategic segment
          return {
            mode: 'strategic_segment',
            matchedSegment: {
              people_type: segment.people_type,
              timing: window,
              situation: segment.situation,
              content_angles: segment.content_angles
            }
          }
        }
      }
    }
  }
  
  // NO MATCH: This is gap-time capacity
  return {
    mode: 'gap_capacity',
    gapRationale: determineGapRationale(day, time)
  }
}

/**
 * Generate a human-readable rationale for why this time is gap capacity
 */
function determineGapRationale(day: string, time: string): string {
  const [hourStr] = time.split(':')
  const hour = parseInt(hourStr, 10)
  
  // Lunch hours (12:00-17:00)
  if (hour >= 12 && hour < 17) {
    if (day === 'Saturday' || day === 'Sunday') {
      return 'Weekend lunch capacity — AYCE variety, central location, spontaneous visits'
    } else {
      return 'Weekday lunch capacity — AYCE format appeal, city center convenience, work break dining'
    }
  }
  
  // Monday evening
  if (day === 'Monday' && hour >= 17 && hour < 23) {
    return 'Monday evening capacity — casual dining without forcing date-night or group framing'
  }
  
  // Late weekend evenings (after 20:00)
  if ((day === 'Saturday' || day === 'Sunday') && hour >= 20) {
    return 'Late weekend capacity — spontaneous groups without Friday-specific framing'
  }
  
  // Generic gap time
  return 'Passive capacity — format-driven content (AYCE, location, variety) without segment forcing'
}

// ============================================================================
// COVERAGE ANALYSIS
// ============================================================================

/**
 * Generate strategic coverage map from audience segments
 * This shows which day/time slots are covered by strategic segments
 * and provides the default gap strategy for uncovered times.
 */
export function buildStrategicCoverage(segments: AudienceSegment[]): StrategicCoverage {
  const covered_slots: StrategicCoverage['covered_slots'] = []
  
  for (const segment of segments) {
    for (const window of segment.timing_windows) {
      const parsedWindows = parseTimingWindow(window)
      
      for (const parsed of parsedWindows) {
        covered_slots.push({
          day: parsed.day,
          time_range: `${String(parsed.startHour).padStart(2, '0')}:00-${String(parsed.endHour).padStart(2, '0')}:00`,
          segment_name: segment.situation || segment.people_type,
          people_type: segment.people_type
        })
      }
    }
  }
  
  return {
    covered_slots,
    gap_strategy: 'Format appeal (AYCE, location, variety) without segment forcing'
  }
}

/**
 * Get current day/time for real-time matching (used in Daily Suggestions)
 */
export function getCurrentDayTime(): { day: string; time: string } {
  const now = new Date()
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const day = days[now.getDay()]
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const time = `${hour}:${minute}`
  
  return { day, time }
}
