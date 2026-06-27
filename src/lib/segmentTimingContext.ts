/**
 * SEGMENT TIMING MATCHER - CLIENT UTILITY
 * 
 * Purpose: Get current timing context for manual post creation
 * Used by: Generate Text IDE to show timing hints to users
 * 
 * Philosophy: All times are good times. Some get laser-focused content,
 * others get broad appeal. The UI should feel reassuring, never hierarchical.
 * 
 * NOTE: This is a client-side helper. The actual segment matching logic
 * for prompt generation happens server-side in segment-timing-matcher.ts
 */

import type { AudienceSegment } from '../../supabase/functions/_shared/brand-profile/audience-profile'

export interface TimingContext {
  mode: 'strategic_segment' | 'gap_capacity'
  displayText: string          // User-friendly label (e.g., "For vennegrupper")
  hint: string                 // Soft guidance (e.g., "Fokuser på gruppe-oplevelser")
  timeLabel: string            // Time context (e.g., "Fredag aften")
  reassurance: string          // Comfort message (e.g., "Passer godt til vennegrupper")
}

/**
 * Get timing context for current time or specified time
 * Returns soft, reassuring language for UI display
 */
export function getCurrentTimingContext(
  segments?: AudienceSegment[],
  overrideTime?: { day: string; time: string }
): TimingContext {
  if (!segments || segments.length === 0) {
    return {
      mode: 'gap_capacity',
      displayText: 'Åbent for alle',
      hint: 'Fokuser på AYCE værdi og central beliggenhed',
      timeLabel: 'Nu',
      reassurance: 'Bred appel virker godt her'
    }
  }

  // Get current day/time or use override
  const now = new Date()
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const danishDays = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
  
  const dayIndex = overrideTime ? days.indexOf(overrideTime.day) : now.getDay()
  const danishDay = danishDays[dayIndex]
  const hour = overrideTime 
    ? parseInt(overrideTime.time.split(':')[0], 10)
    : now.getHours()
  const time = overrideTime?.time || `${String(hour).padStart(2, '0')}:00`

  // Determine time of day label
  let timeOfDayLabel = ''
  if (hour >= 6 && hour < 11) {
    timeOfDayLabel = 'morgen'
  } else if (hour >= 11 && hour < 14) {
    timeOfDayLabel = 'frokost'
  } else if (hour >= 14 && hour < 17) {
    timeOfDayLabel = 'eftermiddag'
  } else if (hour >= 17 && hour < 21) {
    timeOfDayLabel = 'aften'
  } else {
    timeOfDayLabel = 'sen aften'
  }

  const timeLabel = `${danishDay} ${timeOfDayLabel}`

  // Try to match against segments
  for (const segment of segments) {
    for (const window of segment.timing_windows) {
      // Simple pattern: "Lør-Søn 17:00-20:00" or "Fre 18:00-22:00"
      const match = window.match(/^([a-zæøåA-ZÆØÅ]+)(?:-([a-zæøåA-ZÆØÅ]+))?\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})$/)
      if (!match) continue

      const [, startDayAbbrev, endDayAbbrev, startHourStr, , endHourStr] = match
      const startHour = parseInt(startHourStr, 10)
      const endHour = parseInt(endHourStr, 10)

      // Check if current day/time matches this window
      if (hour >= startHour && hour < endHour) {
        const dayMap: Record<string, string> = {
          'man': 'Mandag', 'tir': 'Tirsdag', 'ons': 'Onsdag',
          'tor': 'Torsdag', 'fre': 'Fredag', 'lør': 'Lørdag', 'søn': 'Søndag'
        }
        const windowDay = dayMap[startDayAbbrev.toLowerCase()]
        
        if (windowDay === danishDay || (endDayAbbrev && checkDayRange(danishDay, startDayAbbrev, endDayAbbrev, dayMap))) {
          // MATCH! Return soft strategic language
          return {
            mode: 'strategic_segment',
            displayText: `For ${segment.people_type.toLowerCase()}`,
            hint: getSegmentHint(segment.people_type),
            timeLabel,
            reassurance: `Passer godt til ${segment.people_type.toLowerCase()}`
          }
        }
      }
    }
  }

  // No match - gap capacity with reassuring language
  const gapContext = getGapContext(danishDay, hour)
  
  return {
    mode: 'gap_capacity',
    displayText: 'Åbent for alle',
    hint: gapContext.hint,
    timeLabel,
    reassurance: gapContext.reassurance
  }
}

/**
 * Check if current day falls within a day range (e.g., Lør-Søn)
 */
function checkDayRange(
  currentDay: string,
  startAbbrev: string,
  endAbbrev: string,
  dayMap: Record<string, string>
): boolean {
  const days = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
  const startDay = dayMap[startAbbrev.toLowerCase()]
  const endDay = dayMap[endAbbrev.toLowerCase()]
  
  if (!startDay || !endDay) return false
  
  const currentIdx = days.indexOf(currentDay)
  const startIdx = days.indexOf(startDay)
  const endIdx = days.indexOf(endDay)
  
  if (currentIdx === -1 || startIdx === -1 || endIdx === -1) return false
  
  // Handle wrap-around (unlikely but possible)
  if (startIdx <= endIdx) {
    return currentIdx >= startIdx && currentIdx <= endIdx
  } else {
    return currentIdx >= startIdx || currentIdx <= endIdx
  }
}

/**
 * Get soft hint text for strategic segments
 */
function getSegmentHint(peopleType: string): string {
  const hints: Record<string, string> = {
    'Familier': 'Fokuser på familievenlige oplevelser og variation',
    'Par': 'Fokuser på par-oplevelser og intimitet',
    'Vennegrupper': 'Fokuser på gruppe-oplevelser og deling',
    'Studerende': 'Fokuser på værdi og afslappet stemning',
    'Turister': 'Fokuser på autenticitet og lokal oplevelse',
    'Erhvervsfolk': 'Fokuser på effektivitet og kvalitet',
    'Seniorer': 'Fokuser på tradition og komfort',
  }
  
  return hints[peopleType] || 'Fokuser på deres specifikke behov'
}

/**
 * Get reassuring gap-time context
 */
function getGapContext(day: string, hour: number): { hint: string; reassurance: string } {
  // Lunch hours (11:00-17:00)
  if (hour >= 11 && hour < 17) {
    if (day === 'Lørdag' || day === 'Søndag') {
      return {
        hint: 'Fokuser på AYCE variation og weekend-stemning',
        reassurance: 'Bred appel fylder weekend frokost godt'
      }
    } else {
      return {
        hint: 'Fokuser på AYCE værdi og central beliggenhed',
        reassurance: 'Frokost trækker bredt — det er en styrke'
      }
    }
  }
  
  // Monday evening
  if (day === 'Mandag' && hour >= 17 && hour < 23) {
    return {
      hint: 'Fokuser på afslappet stemning og variation',
      reassurance: 'Mandag aften er godt til bred appel'
    }
  }
  
  // Late weekend evenings (after 20:00)
  if ((day === 'Lørdag' || day === 'Søndag') && hour >= 20) {
    return {
      hint: 'Fokuser på spontan interesse og tilgængelighed',
      reassurance: 'Sen weekend fylder vi med bred appel'
    }
  }
  
  // Early hours
  if (hour >= 6 && hour < 11) {
    return {
      hint: 'Fokuser på frisk start og morgenstemning',
      reassurance: 'Morgen passer til bred, indbydende indhold'
    }
  }
  
  // Generic gap time
  return {
    hint: 'Fokuser på AYCE værdi, beliggenhed og variation',
    reassurance: 'Bred appel virker godt her'
  }
}

/**
 * Get user-friendly timing hint for display in banners/tooltips
 */
export function getTimingHintText(context: TimingContext): string {
  if (context.mode === 'strategic_segment') {
    return `💡 ${context.timeLabel} passer godt til ${context.displayText.replace('For ', '').toLowerCase()}`
  } else {
    return `⚡ ${context.timeLabel} — ${context.displayText.toLowerCase()}`
  }
}

/**
 * Get detailed hint with focus guidance
 */
export function getDetailedHint(context: TimingContext): string {
  return `${getTimingHintText(context)}\n${context.hint}`
}

/**
 * Get reassurance message for display
 */
export function getReassuranceText(context: TimingContext): string {
  return context.reassurance
}

/**
 * Get icon for timing mode
 */
export function getTimingIcon(mode: 'strategic_segment' | 'gap_capacity'): string {
  return mode === 'strategic_segment' ? '🎯' : '⚡'
}

/**
 * Get badge label for post cards in weekly plan
 */
export function getBadgeLabel(context: TimingContext): string {
  return context.displayText
}

/**
 * Get tooltip text for hover states
 */
export function getTooltipText(context: TimingContext): string {
  if (context.mode === 'strategic_segment') {
    const target = context.displayText.replace('For ', '')
    return `${target}\nVi ved, de kommer — så vi taler direkte til dem`
  } else {
    return `${context.displayText}\nVi fokuserer på det der trækker bredt:\nværdi, beliggenhed og variation`
  }
}

/**
 * Format context for UI banner display
 */
export function formatContextBanner(context: TimingContext): {
  icon: string
  title: string
  subtitle: string
} {
  if (context.mode === 'strategic_segment') {
    const target = context.displayText.replace('For ', '')
    return {
      icon: '💡',
      title: `${context.timeLabel} passer godt til ${target.toLowerCase()}`,
      subtitle: context.hint
    }
  } else {
    return {
      icon: '⚡',
      title: `${context.timeLabel} er for alle — bred appel virker her`,
      subtitle: context.hint
    }
  }
}
