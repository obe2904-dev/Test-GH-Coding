// utils.ts
// Helper functions for Quick Suggestions v2

import type { MenuItem } from './types.ts'
import { COUNTRY_TO_LANG, DEFAULT_LANGUAGE } from './constants.ts'

/**
 * Converts country name to language code
 */
export function countryToLangCode(country: string | null | undefined): string {
  if (!country) return DEFAULT_LANGUAGE
  
  const normalized = country.trim()
  return COUNTRY_TO_LANG[normalized] || DEFAULT_LANGUAGE
}

/**
 * Filters menu items by program
 */
export function filterMenuByProgram(
  menu: MenuItem[],
  program: string
): MenuItem[] {
  return menu.filter(item => 
    item.program === program || !item.program
  )
}

/**
 * Fuzzy matches menu item name (for validation)
 */
export function fuzzyFindMenuItem(
  items: MenuItem[],
  name: string
): MenuItem | null {
  const normalized = name.toLowerCase().trim()
  
  // Exact match first
  const exact = items.find(item => 
    item.name.toLowerCase().trim() === normalized
  )
  if (exact) return exact
  
  // Partial match
  const partial = items.find(item =>
    item.name.toLowerCase().includes(normalized) ||
    normalized.includes(item.name.toLowerCase())
  )
  
  return partial || null
}

/**
 * Validates time format (HH:MM)
 */
export function isValidTimeFormat(time: string): boolean {
  const pattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  return pattern.test(time)
}

/**
 * Gets default suggested time (current time + buffer)
 */
export function getDefaultTime(bufferMins: number = 30): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() + bufferMins)
  
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  
  return `${hours}:${minutes}`
}

/**
 * Calculates days ago from ISO date string
 */
export function daysAgo(isoDate: string, fromDate: Date = new Date()): number {
  const posted = new Date(isoDate)
  const diffMs = fromDate.getTime() - posted.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Checks if cache is stale
 */
export function isCacheStale(
  createdAt: string,
  now: Date,
  maxAgeHours: number
): boolean {
  const created = new Date(createdAt)
  const ageHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
  return ageHours > maxAgeHours
}

/**
 * Formats date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
