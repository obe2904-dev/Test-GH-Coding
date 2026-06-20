/**
 * V5 Programme Window Formatter for Phase 0
 * 
 * Formats V5 programme operating windows for Phase 0 contextual analysis.
 * Provides temporal precision for cross-referencing contextual factors with
 * actual business capability windows.
 * 
 * Designed with comprehensive null safety and graceful degradation.
 */

import type { V5BrandProfile, V5Programme } from '../../brand-profile/types-v5.ts'

/**
 * Format V5 programme operating windows for Phase 0 prompt
 * 
 * Returns formatted text block ready for prompt injection, or null if no valid data.
 * Handles all edge cases gracefully - never throws errors.
 */
export function formatProgrammeWindowsForPhase0(v5Profile: V5BrandProfile | null | undefined): string | null {
  try {
    // Null safety: Check V5 profile exists
    if (!v5Profile) {
      return null
    }

    // Null safety: Check programmes array exists and is non-empty
    if (!v5Profile.programmes || !Array.isArray(v5Profile.programmes) || v5Profile.programmes.length === 0) {
      return null
    }

    const formatted: string[] = []

    // Process each programme
    for (const programme of v5Profile.programmes) {
      const programmeText = formatSingleProgramme(programme)
      if (programmeText) {
        formatted.push(programmeText)
      }
    }

    // If no valid programmes formatted, return null
    if (formatted.length === 0) {
      return null
    }

    // Return formatted block
    return formatted.join('\n')

  } catch (error) {
    // Graceful degradation: Log error but don't break Phase 0
    console.warn('[Phase 0] V5 programme formatter error:', error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Format a single programme with null safety
 */
function formatSingleProgramme(programme: V5Programme): string | null {
  try {
    // Get programme name/type
    const name = programme.name || programme.type || 'Unnamed Programme'
    
    // Get time window if it exists
    const timeWindow = programme.timeWindow
    
    // Get confidence if it exists
    const confidence = programme.confidence != null ? programme.confidence : null

    // Build time window description
    let windowDesc = ''
    
    if (timeWindow) {
      const days = formatDays(timeWindow.days)
      const hours = formatHours(timeWindow.startTime, timeWindow.endTime)
      
      if (days && hours) {
        windowDesc = `${days}, ${hours}`
      } else if (days) {
        windowDesc = days
      } else if (hours) {
        windowDesc = hours
      }
    }

    // Build confidence display
    const confidenceDisplay = confidence != null ? ` (confidence: ${Math.round(confidence * 100) / 100})` : ''

    // Assemble programme line
    if (windowDesc) {
      return `  • ${name}: ${windowDesc}${confidenceDisplay}`
    } else {
      // Programme exists but no specific window defined
      return `  • ${name}: Active programme${confidenceDisplay}`
    }

  } catch (error) {
    console.warn('[Phase 0] Error formatting programme:', error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Format days array into readable text
 */
function formatDays(days: string[] | null | undefined): string | null {
  if (!days || !Array.isArray(days) || days.length === 0) {
    return null
  }

  // Handle common patterns
  const allWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  const weekend = ['saturday', 'sunday']

  const normalizedDays = days.map(d => d.toLowerCase())

  // Check for full week
  if (allWeek.every(d => normalizedDays.includes(d))) {
    return 'Alle ugens dage'
  }

  // Check for weekdays
  if (weekdays.every(d => normalizedDays.includes(d)) && !normalizedDays.includes('saturday') && !normalizedDays.includes('sunday')) {
    return 'Mandag-Fredag'
  }

  // Check for weekend
  if (weekend.every(d => normalizedDays.includes(d)) && !weekdays.some(d => normalizedDays.includes(d))) {
    return 'Lørdag-Søndag'
  }

  // Custom pattern - capitalize and join
  const dayMap: Record<string, string> = {
    'monday': 'Mandag',
    'tuesday': 'Tirsdag',
    'wednesday': 'Onsdag',
    'thursday': 'Torsdag',
    'friday': 'Fredag',
    'saturday': 'Lørdag',
    'sunday': 'Søndag'
  }

  const formattedDays = normalizedDays
    .map(d => dayMap[d] || d)
    .filter(Boolean)

  if (formattedDays.length === 0) {
    return null
  }

  return formattedDays.join(', ')
}

/**
 * Format start and end time into readable text
 */
function formatHours(startTime: string | null | undefined, endTime: string | null | undefined): string | null {
  // If neither time is defined, return null
  if (!startTime && !endTime) {
    return null
  }

  // Format individual times
  const start = startTime ? formatTime(startTime) : null
  const end = endTime ? formatTime(endTime) : null

  // Build time range
  if (start && end) {
    return `${start}-${end}`
  } else if (start) {
    return `fra ${start}`
  } else if (end) {
    return `indtil ${end}`
  }

  return null
}

/**
 * Format a single time string (handles HH:mm format)
 */
function formatTime(time: string): string | null {
  try {
    // Validate time format (basic check)
    if (typeof time !== 'string') {
      return null
    }

    // Remove whitespace
    const cleaned = time.trim()

    // If already in HH:mm format, return as-is
    if (/^\d{1,2}:\d{2}$/.test(cleaned)) {
      return cleaned
    }

    // Try to parse and reformat
    const match = cleaned.match(/^(\d{1,2}):?(\d{2})?/)
    if (match) {
      const hours = match[1].padStart(2, '0')
      const minutes = match[2] || '00'
      return `${hours}:${minutes}`
    }

    // Return as-is if we can't parse it
    return cleaned

  } catch (error) {
    return null
  }
}

/**
 * Get programme count (utility for logging)
 */
export function getProgrammeCount(v5Profile: V5BrandProfile | null | undefined): number {
  if (!v5Profile || !v5Profile.programmes || !Array.isArray(v5Profile.programmes)) {
    return 0
  }
  return v5Profile.programmes.length
}
