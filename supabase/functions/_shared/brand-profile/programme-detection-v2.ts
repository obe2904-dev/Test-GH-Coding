/**
 * Programme Detection V2 - Structure Reading (Extraction-Based)
 * 
 * V2 reads menu_results_v2.structured_data directly instead of trying to 
 * reconstruct programmes from flattened menu_items_normalized.
 * 
 * Key improvements:
 * - Each menu_result IS a programme (not detected, just read)
 * - Uses extracted availabilityTime (not hardcoded windows)
 * - Uses menuTitle and source_url (not keyword matching)
 * - Falls back to V1 only when no menu extractions exist
 * 
 * @version 2.0.0
 * @date May 7, 2026
 */

import { PROGRAMME_TIME_WINDOWS, type ProgrammeType } from './programme-detection.ts'

// ===== TYPES =====

export type MealPeriod = 'morgenmad' | 'brunch' | 'frokost' | 'eftermiddag' | 'aftensmad' | 'natbar'

export type DayPattern = 
  | 'all_week'       // Mon–Sun, no strong skew
  | 'weekday'        // Mon–Fri only or dominant
  | 'weekend'        // Sat–Sun only
  | 'weekend_heavy'  // Mon–Sun but weekend drives volume (brunch signal)

export interface MenuResult {
  id: string
  business_id: string
  source_url: string
  status: string
  structured_data: {
    menuTitle?: string
    menuSubtitle?: string
    startTime?: string           // e.g., "09:00" - DIRECT extraction from menu
    endTime?: string             // e.g., "14:00" - DIRECT extraction from menu
    availabilityTime?: string    // e.g., "17.30-21.30" or "til kl. 14.00" - descriptive text
    availabilityDays?: string    // e.g., "dagligt", "mandag-fredag"
    categories: Array<{
      name: string
      categoryDescription?: string
      timeRange?: string
      availabilityDays?: string
      items: Array<{
        name: string
        description?: string
        price?: string
        currency?: string
      }>
    }>
  }
  completed_at: string
  language_code?: string
}

export interface Programme {
  type: ProgrammeType
  label: string
  timeWindow: {
    start: string  // HH:MM format
    end: string    // HH:MM format
  }
  daysOfWeek: string[]
  menuEvidence: string[]
  confidence: 'high' | 'medium' | 'low'
  meal_periods: MealPeriod[]  // Derived from time window overlap (e.g., ['frokost', 'aftensmad'])
  day_pattern: DayPattern     // Derived from operating days (e.g., 'weekend_heavy')
  metadata?: {
    source: 'extraction' | 'url' | 'legacy'
    menuResultId?: string
    menuTitle?: string
    url?: string
    itemCount?: number
    categoryCount?: number
    languageVariants?: string[]  // e.g., ['da', 'en'] - indicates multi-language menu (tourist signal)
  }
}

export interface ProgrammeDetectionResult {
  programmes: Programme[]
  totalProgrammes: number
  detectionMethod: 'extraction' | 'legacy_fallback'
  rawData: {
    menuResults?: MenuResult[]
    openingHours?: any[]
  }
}

interface OpeningHoursRow {
  weekday: string
  open_time: string | null
  close_time: string | null
  closed: boolean
  kind: string
}

interface URLEvidence {
  url: string
  programmeType: ProgrammeType | null
  confidence: 'high' | 'medium' | 'low'
  keywords: string[]
}

// ===== MAIN DETECTION FUNCTION =====

export function detectProgrammesV2(
  menuResults: MenuResult[],
  openingHours: OpeningHoursRow[],
  business?: any
): ProgrammeDetectionResult {
  
  // Filter completed menu extractions only
  const completedMenus = menuResults.filter(r => r.status === 'done')
  
  if (completedMenus.length > 0) {
    // PRIMARY PATH: Read structured extractions
    console.log(`✅ V2 Detection: Using extraction-based (${completedMenus.length} menus)`)
    
    const programmes = completedMenus.map(menuResult => 
      menuResultToProgramme(menuResult, openingHours)
    )
    
    // Sort by time window start (morning first, then lunch, dinner, bar)
    programmes.sort((a, b) => {
      return timeToMinutes(a.timeWindow.start) - timeToMinutes(b.timeWindow.start)
    })
    
    return {
      programmes,
      totalProgrammes: programmes.length,
      detectionMethod: 'extraction',
      rawData: {
        menuResults: completedMenus,
        openingHours
      }
    }
  } else {
    // FALLBACK PATH: No menu extractions found
    console.log(`⚠️ V2 Detection: No menu extractions found, would fallback to V1`)
    
    // Return empty result - V1 fallback will be handled at call site
    return {
      programmes: [],
      totalProgrammes: 0,
      detectionMethod: 'legacy_fallback',
      rawData: {
        openingHours
      }
    }
  }
}

// ===== CORE CONVERSION FUNCTION =====

function menuResultToProgramme(
  menuResult: MenuResult,
  openingHours: OpeningHoursRow[]
): Programme {
  
  const data = menuResult.structured_data
  
  // Step 1: Determine programme name
  const programmeName = data.menuTitle || 
                       extractTitleFromURL(menuResult.source_url) ||
                       'Menu'
  
  // Step 2: Classify programme type (morning/lunch/dinner/bar)
  const programmeType = 
    classifyProgrammeFromTitle(data.menuTitle) ||
    classifyProgrammeFromURL(menuResult.source_url).programmeType ||
    'dinner' // default fallback
  
  // Step 3: Parse time window from extracted data
  // PRIORITY 1: Use direct startTime/endTime fields (most reliable)
  // PRIORITY 1B: Hybrid - endTime from menu + startTime from opening hours
  // PRIORITY 2: Parse availabilityTime text field
  // PRIORITY 3: Infer from opening hours or use hardcoded defaults
  let timeWindow: { start: string, end: string } | null = null
  let timeWindowSource = 'extracted'
  
  // Filter out meaningless default values (00:00-23:59 = "all day" fallback from parser)
  const hasValidStartTime = data.startTime && data.startTime !== '00:00'
  const hasValidEndTime = data.endTime && data.endTime !== '23:59'
  const isDefaultAllDay = data.startTime === '00:00' && data.endTime === '23:59'
  
  if (hasValidStartTime && hasValidEndTime && !isDefaultAllDay) {
    // PRIORITY 1A: Both valid fields from extraction (e.g., "09:00", "14:00")
    timeWindow = {
      start: normalizeTimeFormat(data.startTime),
      end: normalizeTimeFormat(data.endTime)
    }
    console.log(`✅ Using extracted startTime/endTime for ${programmeName}: ${data.startTime}-${data.endTime}`)
    timeWindowSource = 'extracted_direct'
  } else if (hasValidEndTime && !hasValidStartTime) {
    // PRIORITY 1B: Only endTime from menu (e.g., "til kl. 14.00")
    // Infer startTime from opening hours (earliest opening time)
    const earliestOpenTime = getEarliestOpeningTime(openingHours)
    if (earliestOpenTime) {
      timeWindow = {
        start: earliestOpenTime,
        end: normalizeTimeFormat(data.endTime)
      }
      console.log(`✅ Using hybrid timing for ${programmeName}: opening ${earliestOpenTime} → menu end ${data.endTime}`)
      timeWindowSource = 'hybrid_opening_and_menu'
    } else {
      // Fallback if no opening hours
      timeWindow = {
        start: '09:00', // Reasonable default for morning programmes
        end: normalizeTimeFormat(data.endTime)
      }
      console.log(`⚠️ Using default start + menu end for ${programmeName}: 09:00-${data.endTime}`)
      timeWindowSource = 'hybrid_default_and_menu'
    }
  } else if (data.availabilityTime && !isDefaultAllDay) {
    // PRIORITY 2: Parse descriptive text (e.g., "17.30-21.30", "kl. 12-16")
    // Skip if we already know it's the default "00:00-23:59"
    timeWindow = parseTimeWindow(data.availabilityTime)
    if (timeWindow) {
      console.log(`✅ Using parsed availabilityTime for ${programmeName}: ${data.availabilityTime}`)
      timeWindowSource = 'extracted_parsed'
    }
  }
  
  if (!timeWindow) {
    // PRIORITY 3: Fallback to type-specific defaults, adjusted to opening hours
    if (isDefaultAllDay) {
      console.log(`⚠️ Ignoring default 00:00-23:59 for ${programmeName}, using type-based inference`)
    } else {
      console.log(`⚠️ No time data found for ${programmeName}, inferring from opening hours`)
    }
    const defaults = PROGRAMME_TIME_WINDOWS[programmeType]
    
    // Special handling for bar/cocktail programmes - infer from closing time
    if (programmeType === 'bar') {
      timeWindow = inferBarTimeFromOpeningHours(openingHours, defaults)
      timeWindowSource = 'inferred_from_closing_hours'
    } else {
      timeWindow = adjustTimeWindowToOpeningHours(
        defaults.start,
        defaults.end,
        openingHours
      )
      timeWindowSource = 'hardcoded_adjusted'
    }
  }
  
  // Step 4: Parse operating days
  const daysOfWeek = parseDays(data.availabilityDays) ||
                     getAllOperatingDays(openingHours)
  
  // Step 5: Count items across all categories
  const itemCount = data.categories.reduce(
    (sum, cat) => sum + cat.items.length,
    0
  )
  
  // Step 6: Build evidence array
  const menuEvidence: string[] = [
    `Extracted from ${menuResult.source_url}`,
    `${itemCount} items across ${data.categories.length} categories`
  ]
  
  // Add time evidence based on source
  if (timeWindowSource === 'extracted_direct') {
    menuEvidence.push(`Time: ${timeWindow.start}-${timeWindow.end} (from startTime/endTime fields)`)
  } else if (timeWindowSource === 'hybrid_opening_and_menu') {
    menuEvidence.push(`Time: ${timeWindow.start} (opening hours) - ${timeWindow.end} (menu endTime)`)
  } else if (timeWindowSource === 'hybrid_default_and_menu') {
    menuEvidence.push(`Time: ${timeWindow.start} (default) - ${timeWindow.end} (menu endTime)`)
  } else if (timeWindowSource === 'extracted_parsed') {
    menuEvidence.push(`Time: ${data.availabilityTime} → ${timeWindow.start}-${timeWindow.end} (parsed from availabilityTime)`)
  } else if (timeWindowSource === 'inferred_from_closing_hours') {
    menuEvidence.push(`Time: ${timeWindow.start}-${timeWindow.end} (inferred from closing hours)`)
  } else {
    menuEvidence.push(`Time: ${timeWindow.start}-${timeWindow.end} (hardcoded fallback)`)
  }
  
  if (data.menuTitle) {
    menuEvidence.push(`Title: ${data.menuTitle}`)
  }
  
  // Step 7: Calculate confidence score
  const confidence = calculateConfidence(data, menuResult)
  
  // Step 8: Derive meal periods and day pattern
  const mealPeriods = deriveMealPeriods(timeWindow.start, timeWindow.end)
  const dayPattern = deriveDayPattern(daysOfWeek, mealPeriods)
  
  // Step 9: Build programme object
  return {
    type: programmeType,
    label: programmeName,  // Use extracted menu title, not hardcoded fallback
    timeWindow,
    daysOfWeek,
    menuEvidence,
    confidence,
    meal_periods: mealPeriods,
    day_pattern: dayPattern,
    metadata: {
      source: 'extraction',
      menuResultId: menuResult.id,
      menuTitle: data.menuTitle,
      url: menuResult.source_url,
      itemCount,
      categoryCount: data.categories.length,
      languageVariants: menuResult.language_code ? [menuResult.language_code] : undefined
    }
  }
}

// ===== TIME WINDOW PARSING =====

/**
 * Normalize time format to HH:MM
 * Handles formats like "09:00", "9:00", "14.00", "14:00:00"
 */
function normalizeTimeFormat(time: string): string {
  if (!time) return '00:00'
  
  // Remove any trailing seconds (e.g., "09:00:00" → "09:00")
  const withoutSeconds = time.split(':').slice(0, 2).join(':')
  
  // Handle dot separator (e.g., "14.00" → "14:00")
  const normalized = withoutSeconds.replace('.', ':')
  
  // Ensure HH:MM format with leading zeros
  const [hour, minute] = normalized.split(':')
  const paddedHour = (hour || '0').padStart(2, '0')
  const paddedMinute = (minute || '00').padStart(2, '0')
  
  return `${paddedHour}:${paddedMinute}`
}

function parseTimeWindow(
  availabilityTime: string | undefined
): { start: string, end: string } | null {
  
  if (!availabilityTime) return null
  
  // Pattern 1: "17.30-21.30" or "11:00-15:00" (handles hyphen, en dash, em dash)
  const pattern1 = /(\d{1,2})[:.:](\d{2})\s*[-–—]\s*(\d{1,2})[:.:](\d{2})/
  const match1 = availabilityTime.match(pattern1)
  if (match1) {
    const [, startHour, startMin, endHour, endMin] = match1
    return {
      start: `${startHour.padStart(2, '0')}:${startMin}`,
      end: `${endHour.padStart(2, '0')}:${endMin}`
    }
  }
  
  // Pattern 2: "12-16" (just hours, no minutes)
  const pattern2 = /(\d{1,2})\s*[-–—]\s*(\d{1,2})(?!\d)/
  const match2 = availabilityTime.match(pattern2)
  if (match2) {
    const [, startHour, endHour] = match2
    return {
      start: `${startHour.padStart(2, '0')}:00`,
      end: `${endHour.padStart(2, '0')}:00`
    }
  }
  
  // Pattern 3: "kl. 12-16" or "Serveres kl. 11-15"
  const pattern3 = /kl\.?\s*(\d{1,2})\s*[-–—]\s*(\d{1,2})/i
  const match3 = availabilityTime.match(pattern3)
  if (match3) {
    const [, startHour, endHour] = match3
    return {
      start: `${startHour.padStart(2, '0')}:00`,
      end: `${endHour.padStart(2, '0')}:00`
    }
  }
  
  return null
}

// ===== URL CLASSIFICATION =====

function classifyProgrammeFromURL(url: string): URLEvidence {
  const urlLower = url.toLowerCase()
  
  // Extract path segments for analysis
  const pathSegments = urlLower.split('/').filter(s => s.length > 0)
  
  // Morning/Brunch keywords
  const morningKeywords = ['morgenmad', 'brunch', 'breakfast', 'morgen']
  if (pathSegments.some(s => morningKeywords.some(kw => s.includes(kw)))) {
    return {
      url,
      programmeType: 'morning',
      confidence: 'high',
      keywords: pathSegments.filter(s => morningKeywords.some(kw => s.includes(kw)))
    }
  }
  
  // Lunch keywords
  const lunchKeywords = ['frokost', 'lunch']
  if (pathSegments.some(s => lunchKeywords.some(kw => s.includes(kw)))) {
    return {
      url,
      programmeType: 'lunch',
      confidence: 'high',
      keywords: pathSegments.filter(s => lunchKeywords.some(kw => s.includes(kw)))
    }
  }
  
  // Dinner keywords (check 'aften' before 'aftensmad' to catch both)
  const dinnerKeywords = ['aften', 'aftensmad', 'dinner', 'evening']
  if (pathSegments.some(s => dinnerKeywords.some(kw => s.includes(kw)))) {
    return {
      url,
      programmeType: 'dinner',
      confidence: 'high',
      keywords: pathSegments.filter(s => dinnerKeywords.some(kw => s.includes(kw)))
    }
  }
  
  // Bar keywords
  const barKeywords = ['bar', 'drinks', 'cocktail', 'natteliv']
  if (pathSegments.some(s => barKeywords.some(kw => s.includes(kw)))) {
    return {
      url,
      programmeType: 'bar',
      confidence: 'high',
      keywords: pathSegments.filter(s => barKeywords.some(kw => s.includes(kw)))
    }
  }
  
  return {
    url,
    programmeType: null,
    confidence: 'low',
    keywords: []
  }
}

// ===== TITLE CLASSIFICATION =====

function classifyProgrammeFromTitle(
  title: string | undefined
): ProgrammeType | null {
  
  if (!title) return null
  
  const titleLower = title.toLowerCase()
  
  // Morning/Brunch
  if (titleLower.includes('brunch') || 
      titleLower.includes('morgenmad') || 
      titleLower.includes('breakfast') ||
      titleLower.includes('morgen')) {
    return 'morning'
  }
  
  // Lunch
  if (titleLower.includes('frokost') || 
      titleLower.includes('lunch')) {
    return 'lunch'
  }
  
  // Dinner (check 'aften' before 'aftensmad')
  if (titleLower.includes('aften') || 
      titleLower.includes('aftensmad') || 
      titleLower.includes('dinner') ||
      titleLower.includes('evening')) {
    return 'dinner'
  }
  
  // Bar
  if (titleLower.includes('bar') || 
      titleLower.includes('drinks') || 
      titleLower.includes('cocktail')) {
    return 'bar'
  }
  
  return null
}

// ===== DAY PARSING =====

function parseDays(
  availabilityDays: string | undefined
): string[] | null {
  
  if (!availabilityDays) return null
  
  const daysLower = availabilityDays.toLowerCase()
  
  // Pattern: "dagligt" / "daily" / "alle dage"
  if (daysLower.includes('dagligt') || 
      daysLower.includes('daily') || 
      daysLower.includes('alle dage') ||
      daysLower.includes('every day')) {
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }
  
  // Pattern: "weekender" / "kun weekend" / "lørdag og søndag"
  if (daysLower.includes('weekend') || 
      (daysLower.includes('lørdag') && daysLower.includes('søndag'))) {
    return ['saturday', 'sunday']
  }
  
  // Pattern: "hverdage" / "weekdays" / "mandag-fredag"
  if (daysLower.includes('hverdag') || 
      daysLower.includes('weekday') || 
      (daysLower.includes('mandag') && daysLower.includes('fredag'))) {
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  }
  
  // Pattern: "day1-day2" range (e.g., "onsdag-lørdag")
  const dayMap: Record<string, string> = {
    'mandag': 'monday', 'monday': 'monday',
    'tirsdag': 'tuesday', 'tuesday': 'tuesday',
    'onsdag': 'wednesday', 'wednesday': 'wednesday',
    'torsdag': 'thursday', 'thursday': 'thursday',
    'fredag': 'friday', 'friday': 'friday',
    'lørdag': 'saturday', 'saturday': 'saturday',
    'søndag': 'sunday', 'sunday': 'sunday'
  }
  
  const rangeMatch = daysLower.match(/(\w+)\s*-\s*(\w+)/)
  if (rangeMatch) {
    const [, startDay, endDay] = rangeMatch
    const startMapped = dayMap[startDay]
    const endMapped = dayMap[endDay]
    
    if (startMapped && endMapped) {
      const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      const startIdx = allDays.indexOf(startMapped)
      const endIdx = allDays.indexOf(endMapped)
      
      if (startIdx >= 0 && endIdx >= 0 && endIdx >= startIdx) {
        return allDays.slice(startIdx, endIdx + 1)
      }
    }
  }
  
  return null
}

// ===== CONFIDENCE CALCULATION =====

function calculateConfidence(
  data: MenuResult['structured_data'],
  menuResult: MenuResult
): 'high' | 'medium' | 'low' {
  
  // High confidence: Has menuTitle + availabilityTime + items
  if (data.menuTitle && data.availabilityTime && data.categories.length > 0) {
    return 'high'
  }
  
  // Medium confidence: Has menuTitle OR time, plus items
  if ((data.menuTitle || data.availabilityTime) && data.categories.length > 0) {
    return 'medium'
  }
  
  // Medium confidence: URL contains clear keywords + items
  const urlEvidence = classifyProgrammeFromURL(menuResult.source_url)
  if (urlEvidence.confidence === 'high' && data.categories.length > 0) {
    return 'medium'
  }
  
  // Low confidence: Only items, no clear metadata
  return 'low'
}

// ===== UTILITY FUNCTIONS =====

function extractTitleFromURL(url: string): string | null {
  const segments = url.split('/').filter(s => s.length > 0)
  
  // Look for recognizable menu-related segments
  for (const segment of segments) {
    const lower = segment.toLowerCase()
    if (lower.includes('morgenmad')) return 'Morgenmad'
    if (lower.includes('brunch')) return 'Brunch'
    if (lower.includes('frokost')) return 'Frokost'
    if (lower.includes('lunch')) return 'Lunch'
    if (lower.includes('aften')) return 'Aften'
    if (lower.includes('dinner')) return 'Dinner'
    if (lower.includes('bar')) return 'Bar'
    if (lower.includes('cocktail')) return 'Cocktails'
  }
  
  return null
}

function getAllOperatingDays(hours: OpeningHoursRow[]): string[] {
  const days = new Set<string>()
  
  hours.forEach(row => {
    if (!row.closed && row.open_time && row.close_time) {
      days.add(row.weekday.toLowerCase())
    }
  })
  
  return Array.from(days)
}

/**
 * Get the most representative opening time
 * Prefers weekday opening times over weekend times (most common guest experience)
 * Used when menu only specifies end time (e.g., "til kl. 14.00")
 */
function getEarliestOpeningTime(hours: OpeningHoursRow[]): string | null {
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  const weekendDays = ['saturday', 'sunday']
  
  // Collect opening times by type
  const weekdayTimes: string[] = []
  const weekendTimes: string[] = []
  
  hours.forEach(row => {
    if (!row.closed && row.open_time) {
      const normalized = normalizeTimeFormat(row.open_time)
      
      if (weekdays.includes(row.weekday.toLowerCase())) {
        weekdayTimes.push(normalized)
      } else if (weekendDays.includes(row.weekday.toLowerCase())) {
        weekendTimes.push(normalized)
      }
    }
  })
  
  // Prefer weekday opening time (most common experience - 5 days/week)
  if (weekdayTimes.length > 0) {
    // Get the most common weekday opening time
    const timeCounts = new Map<string, number>()
    weekdayTimes.forEach(time => {
      timeCounts.set(time, (timeCounts.get(time) || 0) + 1)
    })
    
    // Return the most frequent weekday opening time
    let mostCommonTime = weekdayTimes[0]
    let maxCount = 0
    timeCounts.forEach((count, time) => {
      if (count > maxCount) {
        maxCount = count
        mostCommonTime = time
      }
    })
    
    return mostCommonTime
  }
  
  // Fallback to weekend if no weekday hours
  if (weekendTimes.length > 0) {
    return weekendTimes[0]
  }
  
  return null
}

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
 * Infer bar/cocktail service hours from actual opening hours
 * 
 * Danish standard: Cocktails/bar service typically starts from 16:00 (afternoon drinks)
 * and continues until closing time.
 * 
 * Logic:
 * - Start: 16:00 OR opening time (whichever is LATER)
 * - End: Closing time
 */
function inferBarTimeFromOpeningHours(
  openingHours: OpeningHoursRow[],
  defaults: { start: string, end: string }
): { start: string, end: string } {
  
  // Find latest close time across all days
  let latestClose = '22:00'  // fallback
  
  openingHours.forEach(row => {
    if (!row.closed && row.close_time) {
      const normalized = normalizeTimeFormat(row.close_time)
      // Handle times after midnight (e.g., 02:00 > 23:00 when considering late-night hours)
      if (normalized <= '04:00' || normalized > latestClose) {
        latestClose = normalized
      }
    }
  })
  
  // Find typical opening time (weekday preference)
  const openingTime = getEarliestOpeningTime(openingHours) || '09:00'
  
  // BAR START TIME: Later of 16:00 or opening time
  // (Can't serve cocktails before you open!)
  const danishBarStart = '16:00'
  const startTime = timeToMinutes(openingTime) > timeToMinutes(danishBarStart)
    ? openingTime
    : danishBarStart
  
  console.log(`🍸 Inferring bar hours: ${startTime} (later of opening/${danishBarStart}) - ${latestClose} (closing)`)
  
  return {
    start: startTime,
    end: latestClose
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

/**
 * Derive which meal periods a programme covers based on time window overlap.
 * A period is included if the programme overlaps it by >= 60 minutes.
 * 
 * Examples:
 * - K-BBQ 12:00–22:00 → ['frokost', 'eftermiddag', 'aftensmad']
 * - Café Faust brunch 09:30–14:00 → ['brunch', 'frokost']
 * - Café Faust cocktails 20:00–02:00 → ['aftensmad', 'natbar']
 */
function deriveMealPeriods(start: string, end: string): MealPeriod[] {
  const startMin = timeToMinutes(start)
  let endMin = timeToMinutes(end)
  
  // Handle midnight crossover (e.g., 20:00–02:00)
  if (endMin < startMin) {
    endMin += 1440 // Add 24 hours
  }
  
  /**
   * Check if programme overlaps a time zone by at least 60 minutes
   */
  function overlapsBy60(zoneStart: number, zoneEnd: number): boolean {
    const overlapStart = Math.max(startMin, zoneStart)
    const overlapEnd = Math.min(endMin, zoneEnd)
    return overlapEnd - overlapStart >= 60
  }
  
  const periods: MealPeriod[] = []
  
  // Meal period definitions (start and end in minutes from midnight)
  if (overlapsBy60(360, 660))   periods.push('morgenmad')    // 06:00–11:00
  if (overlapsBy60(540, 840))   periods.push('brunch')       // 09:00–14:00
  if (overlapsBy60(690, 960))   periods.push('frokost')      // 11:30–16:00
  if (overlapsBy60(840, 1020))  periods.push('eftermiddag')  // 14:00–17:00
  if (overlapsBy60(1020, 1290)) periods.push('aftensmad')    // 17:00–21:30
  if (overlapsBy60(1320, 1560)) periods.push('natbar')       // 22:00–02:00 (26:00 = 1560)
  
  return periods
}

/**
 * Derive the day pattern from operating days and meal periods.
 * 
 * Examples:
 * - Mon–Fri only → 'weekday'
 * - Sat–Sun only → 'weekend'
 * - Mon–Sun with brunch → 'weekend_heavy' (brunch drives weekend volume)
 * - Mon–Sun without brunch → 'all_week'
 */
function deriveDayPattern(operatingDays: string[], mealPeriods: MealPeriod[]): DayPattern {
  const daysLower = operatingDays.map(d => d.toLowerCase())
  
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'mon', 'tue', 'wed', 'thu', 'fri']
  const weekendDays = ['saturday', 'sunday', 'sat', 'sun']
  
  const hasWeekday = daysLower.some(d => weekdays.includes(d))
  const hasWeekend = daysLower.some(d => weekendDays.includes(d))
  
  // Pure weekday or weekend
  if (hasWeekday && !hasWeekend) return 'weekday'
  if (!hasWeekday && hasWeekend) return 'weekend'
  
  // Both weekday and weekend: check if weekend-heavy
  // Brunch is a strong weekend volume driver
  if (mealPeriods.includes('brunch')) return 'weekend_heavy'
  
  return 'all_week'
}
