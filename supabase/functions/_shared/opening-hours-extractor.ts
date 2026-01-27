/**
 * Opening hours extraction utilities
 * Supports both structured data (schema.org) and HTML pattern matching
 */

import type { StructuredData } from './structured-data-extractor.ts'

export interface DayHours {
  open?: string
  close?: string
  closed?: boolean
}

export interface WeekHours {
  monday?: DayHours
  tuesday?: DayHours
  wednesday?: DayHours
  thursday?: DayHours
  friday?: DayHours
  saturday?: DayHours
  sunday?: DayHours
}

/**
 * Normalize time strings: convert "24:00" to "00:00" (HTML time inputs only accept 00-23)
 */
function normalizeTime(time: string): string {
  if (time === '24:00') {
    return '00:00'
  }
  return time
}

/**
 * Extract opening hours from structured data or HTML patterns
 * 
 * @param html - Raw HTML content
 * @param structuredData - Pre-extracted structured data blocks
 * @returns Opening hours object or null if not found
 */
export function extractOpeningHours(html: string, structuredData: StructuredData[]): WeekHours | null {
  const hours: WeekHours = {}
  
  // 1. Try structured data first (most reliable)
  for (const data of structuredData) {
    const specs = data.openingHoursSpecification || data.openingHours
    
    if (specs) {
      const specArray = Array.isArray(specs) ? specs : [specs]
      
      for (const spec of specArray) {
        const dayMap: Record<string, keyof WeekHours> = {
          'Monday': 'monday', 'Tuesday': 'tuesday', 'Wednesday': 'wednesday',
          'Thursday': 'thursday', 'Friday': 'friday', 'Saturday': 'saturday', 'Sunday': 'sunday',
          'Mandag': 'monday', 'Tirsdag': 'tuesday', 'Onsdag': 'wednesday',
          'Torsdag': 'thursday', 'Fredag': 'friday', 'Lørdag': 'saturday', 'Søndag': 'sunday',
          'Mon': 'monday', 'Tue': 'tuesday', 'Wed': 'wednesday',
          'Thu': 'thursday', 'Fri': 'friday', 'Sat': 'saturday', 'Sun': 'sunday'
        }
        
        const dayOfWeek = spec.dayOfWeek || spec.day
        const day = dayMap[dayOfWeek] || dayOfWeek?.toLowerCase()
        
        if (day && spec.opens && spec.closes) {
          hours[day as keyof WeekHours] = {
            open: normalizeTime(spec.opens),
            close: normalizeTime(spec.closes),
            closed: false
          }
        } else if (day && (spec.closed || spec.opens === null)) {
          hours[day as keyof WeekHours] = { closed: true }
        }
      }
      
      if (Object.keys(hours).length > 0) {
        console.log('✅ Extracted opening hours from structured data:', Object.keys(hours).length, 'days')
        return hours
      }
    }
  }
  
  // 2. Try parsing HTML patterns
  console.log('🕐 Structured data did not contain hours, trying HTML patterns...')
  
  // Find sections with opening hours keywords
  const hoursKeywords = ['åbningstider', 'opening hours', 'åbent', 'öppettider', 'openingstijden']
  let hoursText = ''
  
  for (const keyword of hoursKeywords) {
    // Look for the keyword in a heading or strong tag, then capture following content
    const regex = new RegExp(
      `<(?:h[1-6]|strong|b)[^>]*>[^<]*${keyword}[^<]*<\/(?:h[1-6]|strong|b)>[\\s\\S]{0,1500}`,
      'i'
    )
    const match = html.match(regex)
    if (match) {
      hoursText = match[0]
      console.log('🕐 Found opening hours section with keyword:', keyword)
      break
    }
  }
  
  // If no keyword section found, try table-based hours (common pattern)
  if (!hoursText) {
    const tableMatch = html.match(/<table[^>]*>[\\s\\S]*?(?:mandag|monday|man|mon)[\\s\\S]*?<\/table>/i)
    if (tableMatch) {
      hoursText = tableMatch[0]
      console.log('🕐 Found potential hours table')
    }
  }
  
  if (!hoursText) {
    console.log('⚠️ No opening hours section found in HTML')
    return null
  }
  
  // Extract and clean text from HTML
  const cleanText = hoursText
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
  
  // Parse Danish/English day patterns with times
  // Support both regular hyphen (-) and en-dash (–), and both : and . as time separators
  // Support "kl." prefix before time (Danish: "kl. 09.30")
  const dayPatterns = [
    { regex: /Mandag(?:[\s–-]+Fredag)?(?:\s+kl\.)?[:\s]+(\d{1,2})[:\.](\d{2})(?:\s*[–-]\s*)(\d{1,2})[:\.](\d{2})/i, days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] },
    { regex: /Mandag(?:[\s–-]+Torsdag)?(?:\s+kl\.)?[:\s]+(\d{1,2})[:\.](\d{2})(?:\s*[–-]\s*)(\d{1,2})[:\.](\d{2})/i, days: ['monday', 'tuesday', 'wednesday', 'thursday'] },
    { regex: /Fredag(?:[\s–-]+Lørdag)?(?:\s+kl\.)?[:\s]+(\d{1,2})[:\.](\d{2})(?:\s*[–-]\s*)(\d{1,2})[:\.](\d{2})/i, days: ['friday', 'saturday'] },
    { regex: /Lørdag(?:[\s–-]+Søndag)?(?:\s+kl\.)?[:\s]+(\d{1,2})[:\.](\d{2})(?:\s*[–-]\s*)(\d{1,2})[:\.](\d{2})/i, days: ['saturday', 'sunday'] },
    { regex: /Mandag(?:\s+kl\.)?[:\s]+(\d{1,2})[:\.](\d{2})(?:\s*[–-]\s*)(\d{1,2})[:\.](\d{2})/i, days: ['monday'] },
    { regex: /Tirsdag(?:\s+kl\.)?[:\s]+(\d{1,2})[:\.](\d{2})(?:\s*[–-]\s*)(\d{1,2})[:\.](\d{2})/i, days: ['tuesday'] },
    { regex: /Onsdag(?:\s+kl\.)?[:\s]+(\d{1,2})[:\.](\d{2})(?:\s*[–-]\s*)(\d{1,2})[:\.](\d{2})/i, days: ['wednesday'] },
    { regex: /Torsdag(?:\s+kl\.)?[:\s]+(\d{1,2})[:\.](\d{2})(?:\s*[–-]\s*)(\d{1,2})[:\.](\d{2})/i, days: ['thursday'] },
    { regex: /Fredag(?:\s+kl\.)?[:\s]+(\d{1,2})[:\.](\d{2})(?:\s*[–-]\s*)(\d{1,2})[:\.](\d{2})/i, days: ['friday'] },
    { regex: /Lørdag(?:\s+kl\.)?[:\s]+(\d{1,2})[:\.](\d{2})(?:\s*[–-]\s*)(\d{1,2})[:\.](\d{2})/i, days: ['saturday'] },
    { regex: /Søndag(?:\s+kl\.)?[:\s]+(\d{1,2})[:\.](\d{2})(?:\s*[–-]\s*)(\d{1,2})[:\.](\d{2})/i, days: ['sunday'] },
    // English patterns
    { regex: /Monday(?:-Friday)?[:\s]+(\d{1,2})[:\.]?(\d{2})?(?:\s*(?:am|pm))?\s*-\s*(\d{1,2})[:\.]?(\d{2})?(?:\s*(?:am|pm))?/i, days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] },
    { regex: /Saturday(?:-Sunday)?[:\s]+(\d{1,2})[:\.]?(\d{2})?(?:\s*(?:am|pm))?\s*-\s*(\d{1,2})[:\.]?(\d{2})?(?:\s*(?:am|pm))?/i, days: ['saturday', 'sunday'] },
  ]
  
  for (const pattern of dayPatterns) {
    const match = cleanText.match(pattern.regex)
    if (match) {
      const openHour = match[1]
      const openMin = match[2]
      const closeHour = match[3]
      const closeMin = match[4]
      
      const openTime = normalizeTime(`${openHour.padStart(2, '0')}:${openMin}`)
      const closeTime = normalizeTime(`${closeHour.padStart(2, '0')}:${closeMin}`)
      
      for (const day of pattern.days) {
        hours[day as keyof WeekHours] = {
          open: openTime,
          close: closeTime,
          closed: false
        }
      }
      
      console.log(`  ✅ Parsed hours for ${pattern.days.join(', ')}:`, openTime, '-', closeTime)
    }
  }
  
  // Check for "closed" or "lukket" days
  const closedPatterns = [
    { regex: /Mandag[:\s]+(?:lukket|closed)/i, day: 'monday' as keyof WeekHours },
    { regex: /Tirsdag[:\s]+(?:lukket|closed)/i, day: 'tuesday' as keyof WeekHours },
    { regex: /Onsdag[:\s]+(?:lukket|closed)/i, day: 'wednesday' as keyof WeekHours },
    { regex: /Torsdag[:\s]+(?:lukket|closed)/i, day: 'thursday' as keyof WeekHours },
    { regex: /Fredag[:\s]+(?:lukket|closed)/i, day: 'friday' as keyof WeekHours },
    { regex: /Lørdag[:\s]+(?:lukket|closed)/i, day: 'saturday' as keyof WeekHours },
    { regex: /Søndag[:\s]+(?:lukket|closed)/i, day: 'sunday' as keyof WeekHours },
  ]
  
  for (const pattern of closedPatterns) {
    if (pattern.regex.test(cleanText)) {
      hours[pattern.day] = { closed: true }
      console.log(`  ✅ Parsed ${pattern.day}: closed`)
    }
  }
  
  if (Object.keys(hours).length > 0) {
    console.log('✅ Extracted opening hours from HTML patterns:', Object.keys(hours).length, 'days')
    return hours
  }
  
  console.log('⚠️ Could not parse opening hours from HTML')
  return null
}
