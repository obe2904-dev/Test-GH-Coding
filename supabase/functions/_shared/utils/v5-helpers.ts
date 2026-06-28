// V5 Helper Utilities
// Timing window parsing, segment matching, content validation

import type { 
  ParsedTimingWindow, 
  AudienceSegment, 
  ProgrammeProfile, 
  ActiveSegmentMatch 
} from '../../../../src/types/brand-profile-v5.ts'
import { logV5 } from '../config/v5-flags.ts'

/**
 * Danish day name to number mapping
 * 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
const DAY_MAP: Record<string, number> = {
  'søn': 0, 'søndag': 0, 'sun': 0, 'sunday': 0,
  'man': 1, 'mandag': 1, 'mon': 1, 'monday': 1,
  'tir': 2, 'tirsdag': 2, 'tue': 2, 'tuesday': 2,
  'ons': 3, 'onsdag': 3, 'wed': 3, 'wednesday': 3,
  'tor': 4, 'torsdag': 4, 'thu': 4, 'thursday': 4,
  'fre': 5, 'fredag': 5, 'fri': 5, 'friday': 5,
  'lør': 6, 'lørdag': 6, 'sat': 6, 'saturday': 6
}

/**
 * Parse timing window string into structured data
 * 
 * Supported formats:
 * - "Lør-Søn 10:00-14:00" (weekend range)
 * - "Man-Fre 11:00-15:00" (weekday range)
 * - "Fredag-Lørdag 22:00-02:00" (crosses midnight)
 * - "Mandag 08:00-10:00" (single day)
 * - "Alle dage 08:00-22:00" (all days)
 * 
 * @param window - Timing window string
 * @returns Parsed timing window or null if invalid
 */
export function parseTimingWindow(window: string): ParsedTimingWindow | null {
  try {
    const trimmed = window.trim()
    
    // Split into days and hours
    // Expected format: "Day-Day HH:MM-HH:MM" or "Day HH:MM-HH:MM" or "Alle dage HH:MM-HH:MM"
    let daysPart: string
    let hoursPart: string
    
    // Special handling for "Alle dage" (two words)
    if (trimmed.toLowerCase().startsWith('alle dage') || trimmed.toLowerCase().startsWith('all days')) {
      daysPart = trimmed.split(' ').slice(0, 2).join(' ')  // "Alle dage"
      hoursPart = trimmed.split(' ').slice(2).join(' ')     // Everything after
    } else {
      const parts = trimmed.split(' ')
      if (parts.length < 2) {
        logV5('timing-parse-error', { window, error: 'Missing space separator' })
        return null
      }
      daysPart = parts[0]
      hoursPart = parts.slice(1).join(' ')  // Handle "22:00 - 02:00" with extra spaces
    }
    
    // Parse days
    let daysOfWeek: number[] = []
    const daysLower = daysPart.toLowerCase()
    
    if (daysLower.includes('alle') || daysLower.includes('all')) {
      // All days
      daysOfWeek = [0, 1, 2, 3, 4, 5, 6]
    } else if (daysPart.includes('-')) {
      // Day range (e.g., "Lør-Søn" or "Man-Fre")
      const [startStr, endStr] = daysPart.split('-')
      const startDay = DAY_MAP[startStr.toLowerCase().trim()]
      const endDay = DAY_MAP[endStr.toLowerCase().trim()]
      
      if (startDay === undefined || endDay === undefined) {
        logV5('timing-parse-error', { 
          window, 
          error: 'Unknown day name',
          startStr,
          endStr
        })
        return null
      }
      
      // Generate range (handle wrap-around like Fri-Sun)
      if (startDay <= endDay) {
        for (let i = startDay; i <= endDay; i++) {
          daysOfWeek.push(i)
        }
      } else {
        // Wrap around (e.g., Fri=5 to Sun=0)
        for (let i = startDay; i <= 6; i++) daysOfWeek.push(i)
        for (let i = 0; i <= endDay; i++) daysOfWeek.push(i)
      }
    } else {
      // Single day
      const day = DAY_MAP[daysLower.trim()]
      if (day === undefined) {
        logV5('timing-parse-error', { 
          window, 
          error: 'Unknown day name',
          daysPart
        })
        return null
      }
      daysOfWeek = [day]
    }
    
    // Parse hours
    // Handle formats: "10:00-14:00" or "10:00 - 14:00"
    const hoursClean = hoursPart.replace(/\s/g, '')  // Remove all spaces
    const [startTime, endTime] = hoursClean.split('-')
    
    if (!startTime || !endTime) {
      logV5('timing-parse-error', { 
        window, 
        error: 'Invalid hours format',
        hoursPart
      })
      return null
    }
    
    const startHour = parseInt(startTime.split(':')[0])
    const endHour = parseInt(endTime.split(':')[0])
    
    if (isNaN(startHour) || isNaN(endHour)) {
      logV5('timing-parse-error', { 
        window, 
        error: 'Hours not numeric',
        startTime,
        endTime
      })
      return null
    }
    
    return {
      startDay: daysOfWeek[0],
      endDay: daysOfWeek[daysOfWeek.length - 1],
      startHour,
      endHour,
      daysOfWeek,
      rawString: window
    }
  } catch (error) {
    logV5('timing-parse-error', { 
      window, 
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

/**
 * Check if current time matches a timing window
 * 
 * @param window - Parsed timing window
 * @param currentDay - Current day of week (0-6)
 * @param currentHour - Current hour (0-23)
 * @returns true if current time falls within window
 */
export function matchesCurrentTime(
  window: ParsedTimingWindow,
  currentDay: number,
  currentHour: number
): boolean {
  // Check if current day is in range
  if (!window.daysOfWeek.includes(currentDay)) {
    return false
  }
  
  // Check if current hour is in range
  // Handle midnight crossing (e.g., 22:00-02:00)
  if (window.startHour <= window.endHour) {
    // Normal range (e.g., 10:00-14:00)
    return currentHour >= window.startHour && currentHour < window.endHour
  } else {
    // Crosses midnight (e.g., 22:00-02:00)
    return currentHour >= window.startHour || currentHour < window.endHour
  }
}

/**
 * Find active segment for current time
 * 
 * @param programmes - List of programme profiles with segments
 * @param currentDay - Current day of week (0-6)
 * @param currentHour - Current hour (0-23)
 * @param preferredProgramme - Optional programme type to prefer
 * @returns Best matching segment or null
 */
export function getActiveSegment(
  programmes: ProgrammeProfile[],
  currentDay: number,
  currentHour: number,
  preferredProgramme?: string
): ActiveSegmentMatch | null {
  const matches: ActiveSegmentMatch[] = []
  
  for (const programme of programmes) {
    if (!programme.audience_segments || programme.audience_segments.length === 0) {
      continue
    }
    
    for (const segment of programme.audience_segments) {
      // Skip segments without timing_windows (occasion-based segments added June 28, 2026)
      if (!segment.timing_windows || segment.timing_windows.length === 0) {
        continue;
      }
      
      for (const windowStr of segment.timing_windows) {
        const window = parseTimingWindow(windowStr)
        if (!window) continue
        
        if (matchesCurrentTime(window, currentDay, currentHour)) {
          // Calculate match confidence
          let confidence = 0.8  // Base confidence
          
          // Boost if preferred programme
          if (preferredProgramme && programme.programme_type === preferredProgramme) {
            confidence += 0.15
          }
          
          // Boost for primary segments
          if (segment.segment_size === 'primary') {
            confidence += 0.05
          }
          
          matches.push({
            programme,
            segment,
            matchConfidence: Math.min(1.0, confidence),
            matchReason: `Matches timing window: ${windowStr}`
          })
        }
      }
    }
  }
  
  // Return highest confidence match
  if (matches.length === 0) {
    logV5('segment-match', { 
      currentDay, 
      currentHour, 
      programmesChecked: programmes.length,
      matchesFound: 0
    })
    return null
  }
  
  // Sort by confidence descending
  matches.sort((a, b) => b.matchConfidence - a.matchConfidence)
  
  logV5('segment-match', {
    currentDay,
    currentHour,
    matchesFound: matches.length,
    bestMatch: {
      programme: matches[0].programme.programme_name,
      segment: matches[0].segment.people_type,
      confidence: matches[0].matchConfidence
    }
  })
  
  return matches[0]
}

/**
 * Check if programme is brunch (not breakfast)
 * 
 * In Denmark, brunch ≠ breakfast:
 * - Breakfast (morgenmad): Quick, 07:00-09:00, before work, convenience
 * - Brunch: Leisurely, 10:00-14:00, weekends, social gathering
 * 
 * @param programmeName - Programme name to check
 * @returns true if programme is brunch
 */
export function isBrunchProgramme(programmeName: string): boolean {
  const lower = programmeName.toLowerCase()
  return lower.includes('brunch') || 
         (lower.includes('morgenmad') && lower.includes('brunch'))
}

/**
 * Enforce brunch terminology (remove breakfast references)
 * 
 * @param text - Text to clean
 * @param isBrunch - Whether this is a brunch programme
 * @returns Cleaned text
 */
export function enforceBrunchTerminology(text: string, isBrunch: boolean): string {
  if (!isBrunch) return text
  
  // Replace breakfast terminology with brunch
  return text
    .replace(/\bmorgenmad\b/gi, 'brunch')
    .replace(/\bbreakfast\b/gi, 'brunch')
    .replace(/\bfør arbejde\b/gi, 'i weekenden')
    .replace(/\bbefore work\b/gi, 'on weekends')
}

/**
 * Extract content angles by priority (avoid repeats)
 * 
 * @param segment - Segment to extract angles from
 * @param usedAngles - Previously used angles to avoid
 * @returns Available content angles
 */
export function getContentAnglesByPriority(
  segment: AudienceSegment,
  usedAngles: string[] = []
): string[] {
  return segment.content_angles.filter((angle: string) => 
    !usedAngles.some((used: string) => 
      // Check if angle is substantially similar (first 10 chars match)
      used.toLowerCase().includes(angle.toLowerCase().slice(0, 10))
    )
  )
}

/**
 * Validate location naming consistency
 * 
 * @param text - Text to check
 * @param requiredReference - Required location reference (e.g., "ved åen")
 * @returns true if text uses correct reference or doesn't mention location
 */
export function validateLocationConsistency(
  text: string,
  requiredReference: string | null
): boolean {
  if (!requiredReference) return true
  
  // If text doesn't mention location, it's fine
  const textLower = text.toLowerCase()
  const hasLocationMention = 
    textLower.includes('ved') || 
    textLower.includes('location') ||
    textLower.includes('beliggenhed')
  
  if (!hasLocationMention) return true
  
  // If it mentions location, it must use the correct reference
  return textLower.includes(requiredReference.toLowerCase())
}

/**
 * Count how many segment motivations match a goal mode
 * Used for validation: Does angle goal align with segment motivation?
 * 
 * @param segments - Segments to check
 * @param goalMode - Goal mode to match
 * @returns Count of matching segments
 */
export function countSegmentsByGoal(
  segments: AudienceSegment[],
  goalMode: 'drive_footfall' | 'strengthen_brand' | 'retain_regulars'
): number {
  const goalToContribution: Record<string, string> = {
    'drive_footfall': 'drive_footfall',
    'strengthen_brand': 'strengthen_brand',
    'retain_regulars': 'retain_regulars'
  }
  
  const targetContribution = goalToContribution[goalMode]
  
  return segments.filter(s => s.goal_contribution === targetContribution).length
}
