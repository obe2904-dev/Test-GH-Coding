/**
 * Menu Rules Policy
 * Deterministic rules for menu item validation and daypart matching
 */

import { MenuItem } from '../types.ts'
import { getLocaleConfig, type LocaleConfig } from './locale-config.ts'

export type Daypart = 'breakfast' | 'lunch' | 'dinner' | 'lateNight'

export interface MenuCategoryMapping {
  category: string
  allowedDayparts: Daypart[]
  keywords: string[] // Words that indicate this category
}

export interface DaypartContext {
  daypart: Daypart
  timeRange: string // e.g., "11:00-15:00"
  localTerms: string[] // e.g., ["frokost", "middag"] for Danish lunch
}

/**
 * Universal menu category mappings (works across locales)
 */
export const MENU_CATEGORY_MAPPINGS: MenuCategoryMapping[] = [
  {
    category: 'BREAKFAST',
    allowedDayparts: ['breakfast'],
    keywords: ['morgenmad', 'breakfast', 'brunch', 'frukost', 'frühstück']
  },
  {
    category: 'BRUNCH',
    allowedDayparts: ['breakfast', 'lunch'],
    keywords: ['brunch']
  },
  {
    category: 'FROKOST',
    allowedDayparts: ['lunch'],
    keywords: ['frokost', 'lunch', 'middag']
  },
  {
    category: 'LUNCH',
    allowedDayparts: ['lunch'],
    keywords: ['lunch', 'frokost', 'mittagessen']
  },
  {
    category: 'AFTEN',
    allowedDayparts: ['dinner'],
    keywords: ['aften', 'aftensmad', 'dinner', 'abendessen', 'kvällsmat']
  },
  {
    category: 'MIDDAG',
    allowedDayparts: ['dinner'],
    keywords: ['middag', 'dinner', 'abendessen']
  },
  {
    category: 'DINNER',
    allowedDayparts: ['dinner'],
    keywords: ['dinner', 'aften']
  },
  {
    category: 'COCKTAILS',
    allowedDayparts: ['lateNight', 'dinner'],
    keywords: ['cocktail', 'drink', 'bar']
  },
  {
    category: 'DRINKS',
    allowedDayparts: ['lateNight', 'dinner'],
    keywords: ['drinks', 'bar', 'cocktails']
  },
  {
    category: 'DESSERT',
    allowedDayparts: ['lunch', 'dinner'],
    keywords: ['dessert', 'kage', 'is', 'söt']
  }
]

/**
 * Extract category from menu item
 */
export function extractMenuCategory(menuItem: MenuItem): string | null {
  // Try explicit category field first
  if (menuItem.category) {
    return menuItem.category.toUpperCase()
  }
  
  // Try extracting from raw_line: "DISH (CATEGORY)"
  const match = /\(([^)]+)\)\s*$/.exec(menuItem.raw_line)
  if (match) {
    return match[1].trim().toUpperCase()
  }
  
  return null
}

/**
 * Get allowed dayparts for a menu category
 */
export function getAllowedDayparts(category: string): Daypart[] {
  const categoryUpper = category.toUpperCase()
  const mapping = MENU_CATEGORY_MAPPINGS.find(m => m.category === categoryUpper)
  
  if (mapping) {
    return mapping.allowedDayparts
  }
  
  // Fallback: check if any keywords match
  const keywordMatch = MENU_CATEGORY_MAPPINGS.find(m =>
    m.keywords.some(kw => categoryUpper.includes(kw.toUpperCase()))
  )
  
  if (keywordMatch) {
    return keywordMatch.allowedDayparts
  }
  
  // Default: allow all dayparts for unknown categories
  return ['breakfast', 'lunch', 'dinner', 'lateNight']
}

/**
 * Infer daypart from time string
 */
export function inferDaypartFromTime(timeString: string, locale: LocaleConfig): Daypart | null {
  const timeMatch = timeString.match(/(\d{1,2}):?(\d{2})/)
  if (!timeMatch) return null
  
  const hours = parseInt(timeMatch[1])
  const minutes = parseInt(timeMatch[2] || '0')
  const timeMinutes = hours * 60 + minutes
  
  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number)
    return h * 60 + m
  }
  
  const breakfast = locale.mealTimes.breakfast
  const lunch = locale.mealTimes.lunch
  const dinner = locale.mealTimes.dinner
  const lateNight = locale.mealTimes.lateNight
  
  if (timeMinutes >= parseTime(breakfast.start) && timeMinutes < parseTime(breakfast.end)) {
    return 'breakfast'
  }
  if (timeMinutes >= parseTime(lunch.start) && timeMinutes < parseTime(lunch.end)) {
    return 'lunch'
  }
  if (timeMinutes >= parseTime(dinner.start) && timeMinutes < parseTime(dinner.end)) {
    return 'dinner'
  }
  if (timeMinutes >= parseTime(lateNight.start) || timeMinutes < parseTime('07:00')) {
    return 'lateNight'
  }
  
  return null
}

/**
 * Infer daypart from text content
 */
export function inferDaypartFromText(text: string, locale: LocaleConfig): Daypart | null {
  const textLower = text.toLowerCase()
  
  // Check for meal-specific terms
  if (locale.mealTerms.breakfast.some(term => textLower.includes(term))) {
    return 'breakfast'
  }
  if (locale.mealTerms.lunch.some(term => textLower.includes(term))) {
    return 'lunch'
  }
  if (locale.mealTerms.dinner.some(term => textLower.includes(term))) {
    return 'dinner'
  }
  if (locale.mealTerms.lateNight.some(term => textLower.includes(term))) {
    return 'lateNight'
  }
  
  return null
}

/**
 * Check if menu item matches daypart context
 */
export function isMenuItemValidForDaypart(
  menuItem: MenuItem,
  daypart: Daypart
): boolean {
  const category = extractMenuCategory(menuItem)
  if (!category) return true // No category = no restriction
  
  const allowedDayparts = getAllowedDayparts(category)
  return allowedDayparts.includes(daypart)
}

/**
 * Validate menu item against time and text context
 */
export interface MenuValidationResult {
  valid: boolean
  reason?: string
  suggestedFix?: string
}

export function validateMenuItemInContext(
  menuItem: MenuItem,
  timeContext: string,
  textContext: string,
  language: string = 'da',
  country: string = 'DK'
): MenuValidationResult {
  const locale = getLocaleConfig(language, country)
  const category = extractMenuCategory(menuItem)
  
  if (!category) {
    return { valid: true } // No category = no validation
  }
  
  // Infer intended daypart from context
  const daypartFromTime = inferDaypartFromTime(timeContext, locale)
  const daypartFromText = inferDaypartFromText(textContext, locale)
  
  const intendedDaypart = daypartFromTime || daypartFromText
  
  if (!intendedDaypart) {
    return { valid: true } // Can't determine intent = allow
  }
  
  // Check if menu item category matches intended daypart
  const allowedDayparts = getAllowedDayparts(category)
  
  if (!allowedDayparts.includes(intendedDaypart)) {
    const daypartName = locale.mealTerms[intendedDaypart]?.[0] || intendedDaypart
    return {
      valid: false,
      reason: `Menu item "${menuItem.name}" from ${category} category cannot be used for ${daypartName} context`,
      suggestedFix: `Use a menu item from categories: ${allowedDayparts.map(d => locale.mealTerms[d]?.[0]).join(', ')}`
    }
  }
  
  return { valid: true }
}

/**
 * Get daypart context for prompt generation
 */
export function getDaypartContext(
  language: string = 'da',
  country: string = 'DK'
): DaypartContext[] {
  const locale = getLocaleConfig(language, country)
  
  return [
    {
      daypart: 'breakfast',
      timeRange: `${locale.mealTimes.breakfast.start}-${locale.mealTimes.breakfast.end}`,
      localTerms: locale.mealTerms.breakfast
    },
    {
      daypart: 'lunch',
      timeRange: `${locale.mealTimes.lunch.start}-${locale.mealTimes.lunch.end}`,
      localTerms: locale.mealTerms.lunch
    },
    {
      daypart: 'dinner',
      timeRange: `${locale.mealTimes.dinner.start}-${locale.mealTimes.dinner.end}`,
      localTerms: locale.mealTerms.dinner
    },
    {
      daypart: 'lateNight',
      timeRange: `${locale.mealTimes.lateNight.start}-${locale.mealTimes.lateNight.end}`,
      localTerms: locale.mealTerms.lateNight
    }
  ]
}

/**
 * Get menu category guidance for prompt (replaces logic in prompt-builder)
 */
export function getMenuCategoryGuidance(
  menuItems: MenuItem[],
  language: string = 'da',
  country: string = 'DK'
): string {
  const locale = getLocaleConfig(language, country)
  
  // Analyze available categories
  const categories = menuItems
    .map(item => extractMenuCategory(item))
    .filter(Boolean) as string[]
  
  const uniqueCategories = [...new Set(categories)]
  
  if (uniqueCategories.length === 0) {
    return '' // No categories to guide
  }
  
  // Determine available dayparts
  const availableDayparts = new Set<Daypart>()
  uniqueCategories.forEach(cat => {
    getAllowedDayparts(cat).forEach(dp => availableDayparts.add(dp))
  })
  
  const daypartNames = Array.from(availableDayparts).map(dp => 
    locale.mealTerms[dp]?.[0] || dp
  )
  
  let guidance = `\n\nMENU CATEGORIES AVAILABLE: ${daypartNames.join(', ')}`
  
  // Special cases
  if (availableDayparts.has('lunch') && !availableDayparts.has('dinner')) {
    const lunchTerm = locale.mealTerms.lunch[0]
    guidance += `\nIMPORTANT: Menu is LUNCH-ONLY. Use ${lunchTerm} language and timing (${locale.mealTimes.lunch.start}-${locale.mealTimes.lunch.end}). NEVER mention evening/dinner/night.`
  }
  
  if (availableDayparts.has('dinner') && !availableDayparts.has('lunch')) {
    const dinnerTerm = locale.mealTerms.dinner[0]
    guidance += `\nIMPORTANT: Menu is DINNER-ONLY. Use ${dinnerTerm} language and timing (${locale.mealTimes.dinner.start}-${locale.mealTimes.dinner.end}). NEVER mention lunch/midday.`
  }
  
  if (availableDayparts.has('breakfast') && !availableDayparts.has('lunch') && !availableDayparts.has('dinner')) {
    const breakfastTerm = locale.mealTerms.breakfast[0]
    guidance += `\nIMPORTANT: Menu is BREAKFAST/BRUNCH-ONLY. Use ${breakfastTerm} language and morning timing.`
  }
  
  return guidance
}

/**
 * Enhanced timezone and opening-hours aware daypart detection
 * 
 * This addresses the limitation where daypart was purely time-based.
 * Now considers:
 * - Business timezone (not server timezone)
 * - Actual opening hours (breakfast might start at 10 on weekends)
 * - Business type (café vs restaurant vs bar)
 * - Whether business is currently open/closed
 * 
 * @param timezone - IANA timezone string (e.g., "Europe/Copenhagen")
 * @param openingHours - Weekly opening hours structure
 * @param businessOfferings - Used to infer business type (café, restaurant, bar)
 * @param currentTime - Optional override for testing (ISO string)
 * @returns Enhanced daypart with business context
 */
export interface EnhancedDaypartResult {
  daypart: Daypart | null
  isOpen: boolean
  opensAt?: string  // "10:00" if closed now but opens later today
  closesAt?: string  // "22:00" if open now
  nextOpenDay?: string  // "monday" if closed all day today
  businessType: 'cafe' | 'restaurant' | 'bar' | 'mixed'
  confidence: 'high' | 'medium' | 'low'  // How confident we are in this daypart
}

export function inferDaypartWithContext(
  locale: LocaleConfig,
  timezone?: string,
  openingHours?: import('../types.ts').WeekHours,
  businessOfferings?: string,
  currentTimeOverride?: string
): EnhancedDaypartResult {
  
  // Step 1: Determine business type from offerings
  const businessType = inferBusinessType(businessOfferings || '')
  
  // Step 2: Get current time in business timezone
  const now = currentTimeOverride ? new Date(currentTimeOverride) : new Date()
  const businessTime = timezone 
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        weekday: 'long'
      }).formatToParts(now)
    : null
  
  const currentHour = businessTime 
    ? parseInt(businessTime.find(p => p.type === 'hour')?.value || '12')
    : now.getHours()
  const currentMinute = businessTime
    ? parseInt(businessTime.find(p => p.type === 'minute')?.value || '0')
    : now.getMinutes()
  const dayOfWeek = businessTime
    ? (businessTime.find(p => p.type === 'weekday')?.value || 'monday').toLowerCase()
    : ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()]
  
  const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`
  const currentMinutes = currentHour * 60 + currentMinute
  
  // Step 3: Check if business has opening hours data
  if (!openingHours) {
    // Fallback to simple time-based inference
    const simpleDaypart = inferDaypartFromTime(timeString, locale)
    return {
      daypart: simpleDaypart,
      isOpen: true,  // Assume open if no hours data
      businessType,
      confidence: 'low'  // Low confidence without hours data
    }
  }
  
  // Step 4: Check today's hours
  const todayHours = openingHours[dayOfWeek as keyof typeof openingHours]
  
  if (!todayHours || todayHours.closed) {
    // Business is closed today - look for next open day
    const nextOpen = findNextOpenDay(dayOfWeek, openingHours)
    return {
      daypart: null,
      isOpen: false,
      nextOpenDay: nextOpen.day,
      opensAt: nextOpen.time,
      businessType,
      confidence: 'high'
    }
  }
  
  // Step 5: Parse opening hours
  const openTime = todayHours.open || '00:00'
  const closeTime = todayHours.close || '23:59'
  const openMinutes = parseTimeToMinutes(openTime)
  const closeMinutes = parseTimeToMinutes(closeTime)
  
  // Step 6: Check if currently open
  const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes
  
  if (!isOpen) {
    // Closed now - check if opens later today
    if (currentMinutes < openMinutes) {
      return {
        daypart: null,
        isOpen: false,
        opensAt: openTime,
        businessType,
        confidence: 'high'
      }
    } else {
      // Closed for the day
      const nextOpen = findNextOpenDay(dayOfWeek, openingHours)
      return {
        daypart: null,
        isOpen: false,
        nextOpenDay: nextOpen.day,
        opensAt: nextOpen.time,
        businessType,
        confidence: 'high'
      }
    }
  }
  
  // Step 7: Business is open - infer daypart based on operating hours and time
  const daypart = inferDaypartFromOperatingHours(
    currentMinutes,
    openMinutes,
    closeMinutes,
    businessType,
    locale
  )
  
  return {
    daypart,
    isOpen: true,
    closesAt: closeTime,
    businessType,
    confidence: 'high'
  }
}

/**
 * Infer business type from offerings text
 */
function inferBusinessType(offerings: string): 'cafe' | 'restaurant' | 'bar' | 'mixed' {
  const lower = offerings.toLowerCase()
  
  const isCafe = /caf[eé]|coffee|kaffe/.test(lower)
  const isRestaurant = /restaurant|mad|food|middag|lunch|frokost/.test(lower)
  const isBar = /bar|cocktail|drink|øl|beer|wine|vin/.test(lower)
  
  const types = [isCafe, isRestaurant, isBar].filter(Boolean).length
  
  if (types >= 2) return 'mixed'
  if (isCafe) return 'cafe'
  if (isRestaurant) return 'restaurant'
  if (isBar) return 'bar'
  
  return 'mixed'  // Default
}

/**
 * Parse time string to minutes since midnight
 */
function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Find next day business opens
 */
function findNextOpenDay(
  currentDay: string,
  hours: import('../types.ts').WeekHours
): { day: string, time: string } {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const currentIndex = days.indexOf(currentDay)
  
  // Check next 7 days
  for (let i = 1; i <= 7; i++) {
    const nextIndex = (currentIndex + i) % 7
    const nextDay = days[nextIndex]
    const dayHours = hours[nextDay as keyof typeof hours]
    
    if (dayHours && !dayHours.closed && dayHours.open) {
      return { day: nextDay, time: dayHours.open }
    }
  }
  
  return { day: 'unknown', time: '09:00' }  // Fallback
}

/**
 * Infer daypart based on position within operating hours and business type
 * 
 * Examples:
 * - Café open 08:00-16:00: 08:00-11:00 = breakfast, 11:00-16:00 = lunch, no dinner
 * - Restaurant open 11:00-22:00: 11:00-15:00 = lunch, 15:00-22:00 = dinner
 * - Bar open 17:00-02:00: 17:00-21:00 = dinner, 21:00-02:00 = lateNight
 */
function inferDaypartFromOperatingHours(
  currentMinutes: number,
  openMinutes: number,
  closeMinutes: number,
  businessType: 'cafe' | 'restaurant' | 'bar' | 'mixed',
  locale: LocaleConfig
): Daypart {
  const operatingDuration = closeMinutes - openMinutes
  const elapsedMinutes = currentMinutes - openMinutes
  const progressRatio = elapsedMinutes / operatingDuration
  
  // Bar-specific logic (likely no breakfast/lunch)
  if (businessType === 'bar') {
    if (openMinutes >= 15 * 60) {  // Opens 15:00 or later
      return progressRatio < 0.4 ? 'dinner' : 'lateNight'
    }
  }
  
  // Café-specific logic (likely no lateNight)
  if (businessType === 'cafe') {
    if (closeMinutes <= 18 * 60) {  // Closes by 18:00
      if (openMinutes < 11 * 60) {  // Opens before 11:00
        return progressRatio < 0.5 ? 'breakfast' : 'lunch'
      }
      return 'lunch'  // Lunch-only café
    }
  }
  
  // Restaurant or mixed - use standard time-based logic but respect boundaries
  const standardDaypart = inferDaypartFromTime(
    `${Math.floor(currentMinutes / 60)}:${currentMinutes % 60}`,
    locale
  )
  
  // Validate daypart makes sense for operating hours
  if (standardDaypart === 'breakfast' && openMinutes >= 12 * 60) {
    return 'lunch'  // Can't be breakfast if opens at noon
  }
  if (standardDaypart === 'lateNight' && closeMinutes <= 21 * 60) {
    return 'dinner'  // Can't be lateNight if closes by 21:00
  }
  if (standardDaypart === 'dinner' && closeMinutes <= 16 * 60) {
    return 'lunch'  // Can't be dinner if closes by 16:00
  }
  
  return standardDaypart || 'lunch'  // Fallback to lunch
}
