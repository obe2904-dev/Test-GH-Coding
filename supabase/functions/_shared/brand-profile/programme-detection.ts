/**
 * Programme Detection - Deterministic Layer 1
 * 
 * Detects business programmes (time-based service windows) from opening hours and menu data.
 * This is DETERMINISTIC logic - no AI, 100% pattern matching.
 * 
 * Programmes are defined as distinct time windows with different:
 * - Service offerings (breakfast vs dinner menu)
 * - Customer behavior (spontaneous vs planned)
 * - Decision timing (same-day vs advance booking)
 * 
 * Example:
 * - Café Faust: [brunch, frokost, dinner, bar] - 4 programmes
 * - Italian Restaurant: [dinner] - 1 programme
 * 
 * @version 1.0.0
 * @date May 6, 2026
 */

// Programme time window definitions (based on Danish dining culture)
export const PROGRAMME_TIME_WINDOWS = {
  morning: {
    label: 'Morgenmad/Brunch',
    start: '07:00',
    end: '11:00',
    keywords: ['brunch', 'morgenmad', 'breakfast', 'morgen']
  },
  lunch: {
    label: 'Frokost',
    start: '11:00',
    end: '15:00',
    keywords: ['frokost', 'lunch', 'middag']
  },
  dinner: {
    label: 'Aftensmad',
    start: '17:00',
    end: '22:00',
    keywords: ['aftensmad', 'dinner', 'aften', 'middag']
  },
  bar: {
    label: 'Bar/Drinks',
    start: '22:00',
    end: '02:00',
    keywords: ['bar', 'drinks', 'cocktails', 'natteliv']
  }
} as const

export type ProgrammeType = keyof typeof PROGRAMME_TIME_WINDOWS

export interface Programme {
  type: ProgrammeType
  label: string
  timeWindow: {
    start: string  // HH:MM format
    end: string    // HH:MM format
  }
  daysOfWeek: string[]  // Which days this programme runs
  menuEvidence: string[]  // Menu titles/periods that support this programme
  confidence: 'high' | 'medium' | 'low'  // Detection confidence
  metadata?: {  // Optional metadata (added for V2 compatibility)
    source?: 'extraction' | 'url' | 'legacy'
    menuResultId?: string
    menuTitle?: string
    url?: string
    itemCount?: number
    categoryCount?: number
    languageVariants?: string[]
  }
}

export interface ProgrammeDetectionResult {
  programmes: Programme[]
  totalProgrammes: number
  detectionMethod: string
  rawData: {
    openingHours: OpeningHoursRow[]
    menuServicePeriods: string[]
    menuTitles: string[]
  }
}

// Database row types
interface OpeningHoursRow {
  weekday: string
  open_time: string | null
  close_time: string | null
  closed: boolean
  kind: string
}

interface MenuItemRow {
  service_periods: string[]
  service_period_name: string | null
  menu_title: string | null
}

/**
 * Main entry point: Detect programmes from database data
 */
export function detectProgrammes(
  openingHours: OpeningHoursRow[],
  menuItems: MenuItemRow[]
): ProgrammeDetectionResult {
  
  // Step 1: Extract unique service periods from menu
  const menuServicePeriods = extractServicePeriodsFromMenu(menuItems)
  const menuTitles = extractMenuTitles(menuItems)
  
  // Step 2: Analyze opening hours for time patterns
  const timePatterns = analyzeOpeningHoursPatterns(openingHours)
  
  // Step 3: Match menu evidence to time windows
  const programmes = matchProgrammesToTimeWindows(
    timePatterns,
    menuServicePeriods,
    menuTitles,
    openingHours
  )
  
  return {
    programmes,
    totalProgrammes: programmes.length,
    detectionMethod: programmes.length > 0 
      ? 'opening_hours + menu_evidence'
      : 'no_programmes_detected',
    rawData: {
      openingHours,
      menuServicePeriods,
      menuTitles
    }
  }
}

/**
 * Extract unique service periods from menu items
 */
function extractServicePeriodsFromMenu(menuItems: MenuItemRow[]): string[] {
  const periods = new Set<string>()
  
  menuItems.forEach(item => {
    // Add from service_periods array
    if (item.service_periods && Array.isArray(item.service_periods)) {
      item.service_periods.forEach(p => {
        if (p && typeof p === 'string') {
          periods.add(p.toLowerCase().trim())
        }
      })
    }
    
    // Add from service_period_name
    if (item.service_period_name) {
      periods.add(item.service_period_name.toLowerCase().trim())
    }
  })
  
  return Array.from(periods)
}

/**
 * Extract unique menu titles (e.g., "FROKOST", "AFTEN")
 */
function extractMenuTitles(menuItems: MenuItemRow[]): string[] {
  const titles = new Set<string>()
  
  menuItems.forEach(item => {
    if (item.menu_title) {
      titles.add(item.menu_title.toLowerCase().trim())
    }
  })
  
  return Array.from(titles)
}

/**
 * Analyze opening hours to find distinct time patterns
 */
interface TimePattern {
  start: string
  end: string
  days: string[]
}

function analyzeOpeningHoursPatterns(hours: OpeningHoursRow[]): TimePattern[] {
  const patterns: TimePattern[] = []
  const timeSlots = new Map<string, string[]>() // "start-end" -> days[]
  
  hours.forEach(row => {
    if (row.closed || !row.open_time || !row.close_time) {
      return
    }
    
    const key = `${row.open_time}-${row.close_time}`
    const existing = timeSlots.get(key) || []
    existing.push(row.weekday)
    timeSlots.set(key, existing)
  })
  
  // Convert to TimePattern objects
  timeSlots.forEach((days, timeKey) => {
    const [start, end] = timeKey.split('-')
    patterns.push({ start, end, days })
  })
  
  return patterns
}

/**
 * Match detected patterns to programme definitions
 */
function matchProgrammesToTimeWindows(
  timePatterns: TimePattern[],
  menuServicePeriods: string[],
  menuTitles: string[],
  openingHours: OpeningHoursRow[]
): Programme[] {
  
  const detectedProgrammes: Programme[] = []
  const programmesWithMenuEvidence: Array<{ type: ProgrammeType, definition: any, menuEvidence: string[] }> = []
  
  // First pass: find all programmes with menu evidence
  Object.entries(PROGRAMME_TIME_WINDOWS).forEach(([type, definition]) => {
    const programmeType = type as ProgrammeType
    
    // Check for menu evidence
    const menuEvidence: string[] = []
    const hasMenuEvidence = definition.keywords.some(keyword => {
      // Check service periods
      const foundInPeriods = menuServicePeriods.some(period => 
        period.includes(keyword)
      )
      if (foundInPeriods) {
        menuEvidence.push(`service_period: ${keyword}`)
      }
      
      // Check menu titles
      const foundInTitles = menuTitles.some(title => 
        title.includes(keyword)
      )
      if (foundInTitles) {
        menuEvidence.push(`menu_title: ${keyword}`)
      }
      
      return foundInPeriods || foundInTitles
    })
    
    if (hasMenuEvidence) {
      programmesWithMenuEvidence.push({ type: programmeType, definition, menuEvidence })
    }
  })
  
  // Determine strategy: single programme or multi-programme
  const isSingleProgramme = programmesWithMenuEvidence.length === 1
  
  // Second pass: assign time windows
  programmesWithMenuEvidence.forEach(({ type, definition, menuEvidence }) => {
    if (isSingleProgramme) {
      // Single programme: try to match opening hours exactly
      const matchingPattern = findMatchingTimePattern(
        timePatterns,
        definition.start,
        definition.end
      )
      
      if (matchingPattern) {
        detectedProgrammes.push({
          type,
          label: definition.label,
          timeWindow: {
            start: matchingPattern.start,
            end: matchingPattern.end
          },
          daysOfWeek: matchingPattern.days,
          menuEvidence,
          confidence: 'high'
        })
      } else {
        // Use default window adjusted to opening hours
        const adjustedTimeWindow = adjustTimeWindowToOpeningHours(
          definition.start,
          definition.end,
          openingHours
        )
        
        detectedProgrammes.push({
          type,
          label: definition.label,
          timeWindow: adjustedTimeWindow,
          daysOfWeek: getAllOperatingDays(openingHours),
          menuEvidence,
          confidence: 'medium'
        })
      }
    } else {
      // Multiple programmes: use standard time windows (don't try to match opening hours)
      // This prevents all programmes from showing the same "all-day" window
      detectedProgrammes.push({
        type,
        label: definition.label,
        timeWindow: {
          start: definition.start,
          end: definition.end
        },
        daysOfWeek: getAllOperatingDays(openingHours),
        menuEvidence,
        confidence: 'high'
      })
    }
  })
  
  // If no programmes detected but restaurant is open, infer from hours
  if (detectedProgrammes.length === 0 && openingHours.length > 0) {
    const inferredProgramme = inferProgrammeFromHours(openingHours)
    if (inferredProgramme) {
      detectedProgrammes.push(inferredProgramme)
    }
  }
  
  return detectedProgrammes
}

/**
 * Find time pattern that overlaps with programme window
 * Returns null if the only pattern is "all day" (suggests multiple programmes share same hours)
 */
function findMatchingTimePattern(
  patterns: TimePattern[],
  targetStart: string,
  targetEnd: string
): TimePattern | null {
  
  // If there's only one pattern and it spans most of the day (10+ hours),
  // it's likely covering multiple programmes - don't use it
  if (patterns.length === 1) {
    const pattern = patterns[0]
    const durationMinutes = timeToMinutes(pattern.end) - timeToMinutes(pattern.start)
    if (durationMinutes >= 600) { // 10+ hours = all-day operation
      return null
    }
  }
  
  // Convert to minutes for comparison
  const targetStartMin = timeToMinutes(targetStart)
  const targetEndMin = timeToMinutes(targetEnd)
  
  for (const pattern of patterns) {
    const patternStartMin = timeToMinutes(pattern.start)
    const patternEndMin = timeToMinutes(pattern.end)
    
    // Check for overlap (pattern overlaps with at least 50% of target window)
    const overlapStart = Math.max(patternStartMin, targetStartMin)
    const overlapEnd = Math.min(patternEndMin, targetEndMin)
    const overlap = overlapEnd - overlapStart
    
    const targetDuration = targetEndMin - targetStartMin
    
    if (overlap > 0 && overlap >= targetDuration * 0.5) {
      return pattern
    }
  }
  
  return null
}

/**
 * Adjust time window to fit within actual opening hours
 * For multi-programme businesses, keep programme-specific windows unless they conflict with hours
 */
function adjustTimeWindowToOpeningHours(
  defaultStart: string,
  defaultEnd: string,
  openingHours: OpeningHoursRow[]
): { start: string, end: string } {
  
  // Find earliest open and latest close
  let earliestOpen = '23:59'
  let latestClose = '00:00'
  
  openingHours.forEach(row => {
    if (!row.closed && row.open_time && row.close_time) {
      if (row.open_time < earliestOpen) earliestOpen = row.open_time
      if (row.close_time > latestClose) latestClose = row.close_time
    }
  })
  
  // Keep the programme window as defined, unless it's outside opening hours
  let start = defaultStart
  let end = defaultEnd
  
  // If programme starts before business opens, adjust start time
  if (timeToMinutes(defaultStart) < timeToMinutes(earliestOpen)) {
    start = earliestOpen
  }
  
  // If programme ends after business closes (and it's not a bar/late-night programme)
  // adjust the end time. But keep bar programmes at their late hours.
  const endMinutes = timeToMinutes(defaultEnd)
  const closeMinutes = timeToMinutes(latestClose)
  
  // Special case: bar programmes can extend past midnight
  if (defaultEnd >= '22:00' && defaultEnd <= '02:00') {
    // This is a late-night programme - keep the default end time
    end = defaultEnd
  } else if (endMinutes > closeMinutes) {
    // Regular programme extends past closing - constrain it
    end = latestClose
  }
  
  return { start, end }
}

/**
 * Infer programme from opening hours when no menu evidence
 */
function inferProgrammeFromHours(hours: OpeningHoursRow[]): Programme | null {
  // Find earliest opening time
  let earliestOpen = '23:59'
  let latestClose = '00:00'
  const operatingDays: string[] = []
  
  hours.forEach(row => {
    if (!row.closed && row.open_time && row.close_time) {
      if (row.open_time < earliestOpen) earliestOpen = row.open_time
      if (row.close_time > latestClose) latestClose = row.close_time
      operatingDays.push(row.weekday)
    }
  })
  
  // Determine programme type based on hours
  const openMinutes = timeToMinutes(earliestOpen)
  const closeMinutes = timeToMinutes(latestClose)
  
  // Morning start (before 11:00) -> likely has breakfast/brunch
  if (openMinutes < timeToMinutes('11:00')) {
    return {
      type: 'morning',
      label: 'Morgenmad/Brunch',
      timeWindow: { start: earliestOpen, end: '11:00' },
      daysOfWeek: operatingDays,
      menuEvidence: ['inferred_from_opening_hours'],
      confidence: 'low'
    }
  }
  
  // Lunch hours (11:00-15:00)
  if (openMinutes < timeToMinutes('15:00')) {
    return {
      type: 'lunch',
      label: 'Frokost',
      timeWindow: { start: earliestOpen, end: '15:00' },
      daysOfWeek: operatingDays,
      menuEvidence: ['inferred_from_opening_hours'],
      confidence: 'low'
    }
  }
  
  // Dinner hours (after 15:00)
  if (openMinutes >= timeToMinutes('15:00')) {
    return {
      type: 'dinner',
      label: 'Aftensmad',
      timeWindow: { start: earliestOpen, end: latestClose },
      daysOfWeek: operatingDays,
      menuEvidence: ['inferred_from_opening_hours'],
      confidence: 'low'
    }
  }
  
  return null
}

/**
 * Get all days where business operates
 */
function getAllOperatingDays(hours: OpeningHoursRow[]): string[] {
  const days = new Set<string>()
  hours.forEach(row => {
    if (!row.closed && row.open_time) {
      days.add(row.weekday)
    }
  })
  return Array.from(days)
}

/**
 * Convert HH:MM time to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Format programmes for human-readable display
 */
export function formatProgrammesSummary(result: ProgrammeDetectionResult): string {
  if (result.programmes.length === 0) {
    return 'No programmes detected'
  }
  
  const lines: string[] = [
    `Detected ${result.totalProgrammes} programme(s):`,
    ''
  ]
  
  result.programmes.forEach((prog, i) => {
    lines.push(`${i + 1}. ${prog.label}`)
    lines.push(`   Time: ${prog.timeWindow.start}-${prog.timeWindow.end}`)
    lines.push(`   Days: ${prog.daysOfWeek.join(', ')}`)
    lines.push(`   Evidence: ${prog.menuEvidence.join(', ')}`)
    lines.push(`   Confidence: ${prog.confidence}`)
    lines.push('')
  })
  
  return lines.join('\n')
}
