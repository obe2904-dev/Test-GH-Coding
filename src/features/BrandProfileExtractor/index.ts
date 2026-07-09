// src/features/BrandProfileExtractor/index.ts
// Extracts brand signals from business profile data for WHO/WHEN/WHY inference

import type { BusinessOfferingsProfile } from '../../types/businessOfferings'
import type { BusinessSector } from '../../types/businessSector'
import type { WeekSchedule } from '../../types/businessProfile'

// WHO audience types matching your framework
export type TargetAudience =
  | 'Locals'
  | 'Tourists'
  | 'Families'
  | 'Young adults'
  | 'Professionals'
  | 'Students'
  | 'Seniors'
  | 'Foodies'
  | 'Event guests'

export type DominantUsageMode =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'evening'
  | 'night'
  | 'allday'

export interface BrandSignals {
  // From offerings
  has_alcohol: boolean
  dietary_options: string[]
  signature_items: string[]

  // From opening hours
  dominant_usage_mode: DominantUsageMode | null
  opens_early: boolean // before 8am
  closes_late: boolean // after 10pm
  weekend_focused: boolean

  // Inferred WHO (permissive approach)
  target_audiences: TargetAudience[]
}

interface ExtractionInput {
  businessOfferings: BusinessOfferingsProfile
  openingHours: WeekSchedule
  businessSector: BusinessSector | null
  city?: string
  keywords?: string[]
}

/**
 * Main extraction function - analyzes profile data and extracts brand signals
 */
export function extractBrandSignals(input: ExtractionInput): BrandSignals {
  const hasAlcohol = detectAlcohol(input.businessOfferings)
  const dietaryOptions = extractDietaryTags(input.businessOfferings)
  const signatureItems = extractSignatureItems(input.businessOfferings)

  const opensEarly = hasOpeningBefore(input.openingHours, '08:00')
  const closesLate = hasClosingAfter(input.openingHours, '22:00')
  const weekendFocused = isWeekendFocused(input.openingHours)
  const dominantUsageMode = analyzeDominantUsageMode(input.openingHours)

  const targetAudiences = inferTargetAudiences({
    businessSector: input.businessSector,
    hasAlcohol,
    opensEarly,
    closesLate,
    weekendFocused,
    dominantUsageMode,
    city: input.city,
    keywords: input.keywords,
  })

  return {
    has_alcohol: hasAlcohol,
    dietary_options: dietaryOptions,
    signature_items: signatureItems,
    dominant_usage_mode: dominantUsageMode,
    opens_early: opensEarly,
    closes_late: closesLate,
    weekend_focused: weekendFocused,
    target_audiences: targetAudiences,
  }
}

/**
 * Detect alcohol presence from offerings
 * Checks category names and item names for alcohol keywords
 */
function detectAlcohol(offerings: BusinessOfferingsProfile): boolean {
  const alcoholKeywords = [
    'vin',
    'øl',
    'beer',
    'wine',
    'cocktail',
    'spiritus',
    'drink',
    'bar',
    'alkohol',
    'champagne',
    'prosecco',
    'gin',
    'vodka',
    'whisky',
    'rom',
    'drinks',
  ]

  return offerings.categories.some((cat) => {
    const catLower = cat.name.toLowerCase()
    const hasAlcoholCategory = alcoholKeywords.some((kw) => catLower.includes(kw))

    const hasAlcoholItems = cat.items.some((item) =>
      alcoholKeywords.some((kw) => item.name.toLowerCase().includes(kw))
    )

    return hasAlcoholCategory || hasAlcoholItems
  })
}

/**
 * Extract dietary tags from offerings
 * Looks for vegan, vegetarian, gluten-free, etc.
 */
function extractDietaryTags(offerings: BusinessOfferingsProfile): string[] {
  const dietaryKeywords = [
    'vegan',
    'vegetar',
    'glutenfri',
    'gluten-free',
    'lactose',
    'laktose',
    'organic',
    'økologisk',
    'sukkerfri',
    'sugar-free',
  ]

  const foundTags = new Set<string>()

  offerings.categories.forEach((cat) => {
    const catLower = cat.name.toLowerCase()

    cat.items.forEach((item) => {
      const itemLower = item.name.toLowerCase()
      const combined = `${catLower} ${itemLower}`

      dietaryKeywords.forEach((keyword) => {
        if (combined.includes(keyword)) {
          foundTags.add(keyword)
        }
      })
    })
  })

  return Array.from(foundTags)
}

/**
 * Extract signature items - top 5 items from first category
 * Assumes user puts most important items first
 */
function extractSignatureItems(offerings: BusinessOfferingsProfile): string[] {
  if (offerings.categories.length === 0) {
    return []
  }

  const firstCategory = offerings.categories[0]
  return firstCategory.items.slice(0, 5).map((item) => item.name)
}

/**
 * Check if business opens before a given time on any day
 */
function hasOpeningBefore(schedule: WeekSchedule, timeString: string): boolean {
  const targetMinutes = timeToMinutes(timeString)

  const days: Array<keyof WeekSchedule> = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn']

  return days.some((day) => {
    const openTime = schedule[day]?.open
    if (!openTime) return false

    const openMinutes = timeToMinutes(openTime)
    return openMinutes < targetMinutes
  })
}

/**
 * Check if business closes after a given time on any day
 */
function hasClosingAfter(schedule: WeekSchedule, timeString: string): boolean {
  const targetMinutes = timeToMinutes(timeString)

  const days: Array<keyof WeekSchedule> = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn']

  return days.some((day) => {
    const closeTime = schedule[day]?.close
    if (!closeTime) return false

    const closeMinutes = timeToMinutes(closeTime)
    return closeMinutes > targetMinutes
  })
}

/**
 * Check if business is primarily weekend-focused
 * Returns true if weekend hours are significantly longer than weekday hours
 */
function isWeekendFocused(schedule: WeekSchedule): boolean {
  const weekdayHours = ['man', 'tir', 'ons', 'tor', 'fre'] as const
  const weekendHours = ['lør', 'søn'] as const

  const weekdayTotal = weekdayHours.reduce(
    (sum, day) => sum + calculateDayDuration(schedule[day]),
    0
  )
  const weekendTotal = weekendHours.reduce(
    (sum, day) => sum + calculateDayDuration(schedule[day]),
    0
  )

  const avgWeekday = weekdayTotal / weekdayHours.length
  const avgWeekend = weekendTotal / weekendHours.length

  // Weekend-focused if weekend average is 20% more than weekday average
  return avgWeekend > avgWeekday * 1.2
}

/**
 * Analyze dominant usage mode based on opening hours
 */
function analyzeDominantUsageMode(schedule: WeekSchedule): DominantUsageMode | null {
  const days: Array<keyof WeekSchedule> = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn']

  let breakfastCount = 0
  let lunchCount = 0
  let dinnerCount = 0
  let eveningCount = 0
  let nightCount = 0
  let allDayCount = 0

  days.forEach((day) => {
    const openTime = schedule[day]?.open
    const closeTime = schedule[day]?.close

    if (!openTime || !closeTime) return

    const openMinutes = timeToMinutes(openTime)
    const closeMinutes = timeToMinutes(closeTime)

    // Breakfast: opens before 9am
    if (openMinutes < timeToMinutes('09:00')) breakfastCount++

    // Lunch: open during 11am-2pm
    if (
      openMinutes <= timeToMinutes('11:00') &&
      closeMinutes >= timeToMinutes('14:00')
    ) {
      lunchCount++
    }

    // Dinner: open during 6pm-9pm
    if (
      openMinutes <= timeToMinutes('18:00') &&
      closeMinutes >= timeToMinutes('21:00')
    ) {
      dinnerCount++
    }

    // Evening: closes after 9pm but before midnight
    if (
      closeMinutes > timeToMinutes('21:00') &&
      closeMinutes <= timeToMinutes('00:00')
    ) {
      eveningCount++
    }

    // Night: closes after midnight
    if (closeMinutes > timeToMinutes('00:00') || closeMinutes < timeToMinutes('05:00')) {
      nightCount++
    }

    // All day: open 10+ hours
    const duration = calculateDayDuration(schedule[day])
    if (duration >= 600) allDayCount++ // 10 hours
  })

  // Determine dominant mode (prioritize more specific modes)
  if (nightCount >= 2) return 'night'
  if (eveningCount >= 3) return 'evening'
  if (dinnerCount >= 5) return 'dinner'
  if (lunchCount >= 5) return 'lunch'
  if (breakfastCount >= 3) return 'breakfast'
  if (allDayCount >= 4) return 'allday'

  return null
}

/**
 * Infer target audiences (WHO) - PERMISSIVE approach
 * Include audience if ANY signal suggests it
 */
function inferTargetAudiences(signals: {
  businessSector: BusinessSector | null
  hasAlcohol: boolean
  opensEarly: boolean
  closesLate: boolean
  weekendFocused: boolean
  dominantUsageMode: DominantUsageMode | null
  city?: string
  keywords?: string[]
}): TargetAudience[] {
  const audiences = new Set<TargetAudience>()

  // Base audiences from sector
  if (signals.businessSector === 'hospitality') {
    audiences.add('Locals')
    audiences.add('Foodies')
  }

  if (signals.businessSector === 'beauty') {
    audiences.add('Locals')
  }

  if (signals.businessSector === 'wellness') {
    audiences.add('Locals')
  }

  if (signals.businessSector === 'retail') {
    audiences.add('Locals')
  }

  // From opening hours patterns
  if (signals.opensEarly) {
    audiences.add('Professionals') // Morning coffee crowd
  }

  if (signals.closesLate || signals.hasAlcohol) {
    audiences.add('Young adults') // Evening/nightlife
  }

  if (signals.dominantUsageMode === 'breakfast') {
    audiences.add('Professionals')
  }

  if (signals.dominantUsageMode === 'lunch') {
    audiences.add('Professionals')
    audiences.add('Locals')
  }

  if (signals.dominantUsageMode === 'dinner' || signals.dominantUsageMode === 'evening') {
    audiences.add('Families')
    audiences.add('Foodies')
  }

  if (signals.dominantUsageMode === 'night') {
    audiences.add('Young adults')
  }

  if (signals.weekendFocused) {
    audiences.add('Families')
    audiences.add('Event guests')
  }

  // From location
  const city = signals.city?.toLowerCase() || ''
  const largeCities = ['københavn', 'copenhagen', 'aarhus', 'odense', 'aalborg']

  if (largeCities.some((large) => city.includes(large))) {
    audiences.add('Tourists')
    audiences.add('Students')
  }

  // From keywords
  const keywords = (signals.keywords || []).map((k) => k.toLowerCase()).join(' ')

  if (keywords.includes('student') || keywords.includes('ung')) {
    audiences.add('Students')
  }

  if (keywords.includes('familie') || keywords.includes('børn')) {
    audiences.add('Families')
  }

  if (keywords.includes('brunch') || keywords.includes('weekend')) {
    audiences.add('Families')
  }

  if (keywords.includes('gourmet') || keywords.includes('fine dining')) {
    audiences.add('Foodies')
  }

  // Always include Locals as fallback if no other audiences detected
  if (audiences.size === 0) {
    audiences.add('Locals')
  }

  return Array.from(audiences)
}

/**
 * Helper: Convert HH:mm time string to minutes since midnight
 */
function timeToMinutes(timeString: string): number {
  if (!timeString || !timeString.includes(':')) return 0

  const [hours, minutes] = timeString.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Helper: Calculate duration of a day in minutes
 */
function calculateDayDuration(daySchedule: { open: string; close: string }): number {
  if (!daySchedule?.open || !daySchedule?.close) return 0

  const openMinutes = timeToMinutes(daySchedule.open)
  const closeMinutes = timeToMinutes(daySchedule.close)

  // Handle overnight (close time is next day)
  if (closeMinutes < openMinutes) {
    return 24 * 60 - openMinutes + closeMinutes
  }

  return closeMinutes - openMinutes
}
