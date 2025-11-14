/**
 * User Preferences Management
 * Handles user-specific settings like date format, language, etc.
 */

export type DateFormat = 'en-US' | 'en-GB' | 'da-DK'

export interface UserPreferences {
  dateFormat: DateFormat
  language: 'en' | 'da'
}

const PREFERENCES_KEY = 'userPreferences'

const DEFAULT_PREFERENCES: UserPreferences = {
  dateFormat: 'en-GB', // Default to European format (DD/MM/YYYY)
  language: 'en'
}

/**
 * Get user preferences from localStorage
 */
export function getUserPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...DEFAULT_PREFERENCES, ...parsed }
    }
  } catch (error) {
    console.error('Error loading user preferences:', error)
  }
  return DEFAULT_PREFERENCES
}

/**
 * Save user preferences to localStorage
 */
export function saveUserPreferences(preferences: Partial<UserPreferences>): void {
  try {
    const current = getUserPreferences()
    const updated = { ...current, ...preferences }
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Error saving user preferences:', error)
  }
}

/**
 * Get the date format locale string based on user preference
 */
export function getDateFormatLocale(): DateFormat {
  const prefs = getUserPreferences()
  return prefs.dateFormat
}

/**
 * Set the date format preference
 */
export function setDateFormat(format: DateFormat): void {
  saveUserPreferences({ dateFormat: format })
}

/**
 * Get formatted date display name for UI
 */
export function getDateFormatDisplayName(format: DateFormat): string {
  switch (format) {
    case 'en-US':
      return 'US (MM/DD/YYYY)'
    case 'en-GB':
      return 'EU (DD/MM/YYYY)'
    case 'da-DK':
      return 'Danish (DD/MM/YYYY)'
    default:
      return format
  }
}
