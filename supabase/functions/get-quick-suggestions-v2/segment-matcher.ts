// segment-matcher.ts
// Core logic for matching audience segments to current time/context
// Handles: active service, pre-opening, near-closing, hybrid overlap

import type {
  SegmentMatchContext,
  WeatherData,
  CalendarEvent
} from './types.ts'
import { TIMING } from './constants.ts'

// Real segment format from database
interface RealAudienceSegment {
  label: string
  segment_size: 'primary' | 'secondary' | 'niche'
  timing_windows: string[]  // e.g. ["Mandag-Fredag 12:00-14:00"]
  motivation: string
  decision_timing: string
  content_angles: string[]
  goal_contribution?: string
  evidence?: string[]
}

// Parsed timing from timing_windows string
interface ParsedTiming {
  days: number[]  // 0=Sunday, 6=Saturday
  startHour: number
  endHour: number
}

/**
 * Parses Danish day names to day numbers
 */
const DAY_MAP: Record<string, number> = {
  'Mandag': 1, 'Man': 1,
  'Tirsdag': 2, 'Tir': 2,
  'Onsdag': 3, 'Ons': 3,
  'Torsdag': 4, 'Tor': 4,
  'Fredag': 5, 'Fre': 5,
  'Lørdag': 6, 'Lør': 6,
  'Søndag': 0, 'Søn': 0
}

/**
 * Parses timing window string like "Mandag-Fredag 12:00-14:00"
 */
function parseTimingWindow(window: string): ParsedTiming | null {
  // Match pattern: "Day1-Day2 HH:MM-HH:MM" or "Day HH:MM-HH:MM"
  const match = window.match(/([A-Za-zæøå-]+)\s*(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/)
  
  if (!match) return null
  
  const [, dayPart, startH, startM, endH, endM] = match
  
  // Parse days
  let days: number[] = []
  
  if (dayPart.includes('-')) {
    // Range like "Mandag-Fredag"
    const [start, end] = dayPart.split('-').map(d => d.trim())
    const startDay = DAY_MAP[start]
    const endDay = DAY_MAP[end]
    
    if (startDay !== undefined && endDay !== undefined) {
      if (startDay <= endDay) {
        for (let i = startDay; i <= endDay; i++) {
          days.push(i)
        }
      } else {
        // Wraps around (e.g., Fri-Sun)
        for (let i = startDay; i <= 6; i++) days.push(i)
        for (let i = 0; i <= endDay; i++) days.push(i)
      }
    }
  } else {
    // Single day or comma-separated
    const dayNames = dayPart.split(',').map(d => d.trim())
    days = dayNames.map(d => DAY_MAP[d]).filter(d => d !== undefined)
  }
  
  return {
    days,
    startHour: parseInt(startH),
    endHour: parseInt(endH)
  }
}

/**
 * Checks if a segment's timing includes the given date/hour
 */
function segmentMatchesTime(segment: RealAudienceSegment, date: Date): boolean {
  const dayOfWeek = date.getDay()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const currentMinutes = hour * 60 + minute
  
  // Parse all timing windows
  for (const window of segment.timing_windows) {
    const parsed = parseTimingWindow(window)
    if (!parsed) continue
    
    // Check day of week
    if (!parsed.days.includes(dayOfWeek)) continue
    
    // Check time
    const startMins = parsed.startHour * 60
    const endMins = parsed.endHour * 60
    
    if (currentMinutes >= startMins && currentMinutes < endMins) {
      return true
    }
  }
  
  return false
}

/**
 * Resolves conflicts when multiple segments match
 */
function resolveSegmentConflict(
  candidates: RealAudienceSegment[],
  now: Date
): RealAudienceSegment {
  // Priority order: primary > secondary > niche
  const primary = candidates.find(s => s.segment_size === 'primary')
  if (primary) return primary
  
  const secondary = candidates.find(s => s.segment_size === 'secondary')
  if (secondary) return secondary
  
  return candidates[0]
}

/**
 * Finds next segment that starts after current time
 */
function getNextSegment(
  segments: RealAudienceSegment[],
  now: Date
): RealAudienceSegment | null {
  const dayOfWeek = now.getDay()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  
  let nextSegment: RealAudienceSegment | null = null
  let minMinutesUntil = Infinity
  
  for (const segment of segments) {
    for (const window of segment.timing_windows) {
      const parsed = parseTimingWindow(window)
      if (!parsed) continue
      
      // Check today
      if (parsed.days.includes(dayOfWeek)) {
        const startMins = parsed.startHour * 60
        if (startMins > nowMinutes) {
          const minutesUntil = startMins - nowMinutes
          if (minutesUntil < minMinutesUntil) {
            minMinutesUntil = minutesUntil
            nextSegment = segment
          }
        }
      }
      
      // Check tomorrow (simplified - just check next day)
      const tomorrow = (dayOfWeek + 1) % 7
      if (parsed.days.includes(tomorrow)) {
        const startMins = parsed.startHour * 60
        const minutesUntil = (24 * 60 - nowMinutes) + startMins
        if (minutesUntil < minMinutesUntil) {
          minMinutesUntil = minutesUntil
          nextSegment = segment
        }
      }
    }
  }
  
  return nextSegment
}

/**
 * Selects the best segment for current time
 */
export function selectActiveSegment(
  segments: RealAudienceSegment[],
  now: Date,
  kitchenCloseTime?: string
): RealAudienceSegment | null {
  if (segments.length === 0) {
    return null
  }
  
  // Find all segments that match current time
  const matches = segments.filter(s => segmentMatchesTime(s, now))
  
  // If no current match (pre-opening or closed)
  if (matches.length === 0) {
    console.log('📅 No active segment - looking for next service')
    return getNextSegment(segments, now)
  }
  
  // If multiple viable segments, resolve by priority
  if (matches.length > 1) {
    console.log(`🔀 Multiple segments active (${matches.length}) - resolving by priority`)
    return resolveSegmentConflict(matches, now)
  }
  
  return matches[0]
}

/**
 * Builds complete context for segment matching
 */
export function getSegmentContext(
  segments: RealAudienceSegment[],
  now: Date,
  kitchenCloseTime?: string,
  weather?: WeatherData,
  events?: CalendarEvent[]
): SegmentMatchContext | null {
  const segment = selectActiveSegment(segments, now, kitchenCloseTime)
  
  if (!segment) {
    console.warn('❌ No segment found for current time or upcoming')
    return null
  }
  
  // Parse first timing window for context
  const firstWindow = segment.timing_windows[0]
  const parsed = firstWindow ? parseTimingWindow(firstWindow) : null
  
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const isActive = segmentMatchesTime(segment, now)
  
  const context: SegmentMatchContext = {
    segment: {
      name: segment.label,
      program: 'main', // TODO: map from programme_name
      timing: parsed || { days: [], startHour: 0, endHour: 24 },
      priority: segment.segment_size as any,
      motivation: segment.motivation,
      decision: segment.decision_timing,
      goal: segment.goal_contribution || 'drive_footfall',
      contentAngles: segment.content_angles
    },
    isPreOpening: !isActive,
    isNearClosing: false, // TODO: implement
    minutesUntilStart: !isActive && parsed ? (parsed.startHour * 60 - nowMinutes) : 0,
    minutesUntilEnd: isActive && parsed ? (parsed.endHour * 60 - nowMinutes) : 0,
    weatherContext: weather,
    specialEvents: events
  }
  
  // Logging
  console.log(`✅ Matched segment: "${segment.label}" (${segment.segment_size})`)
  console.log(`   Timing: ${segment.timing_windows.join(', ')}`)
  if (context.isPreOpening) {
    console.log(`   ⏰ Pre-opening: Service starts in ${context.minutesUntilStart} mins`)
  }
  
  return context
}
