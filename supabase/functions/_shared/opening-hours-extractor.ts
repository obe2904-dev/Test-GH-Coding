/**
 * Opening hours extraction utilities
 * Supports both structured data (schema.org) and HTML pattern matching
 */

import { htmlToCleanText } from './html-parser.ts'
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

export interface OpeningHoursExtractionResult {
  openingHours: WeekHours | null
  reviewRequired: boolean
  reviewReasons: string[]
}

const DAY_ALIASES: Array<{ day: keyof WeekHours; labels: string[] }> = [
  { day: 'monday', labels: ['mandag', 'man', 'man.', 'monday', 'mon', 'mon.'] },
  { day: 'tuesday', labels: ['tirsdag', 'tir', 'tir.', 'tuesday', 'tue', 'tue.'] },
  { day: 'wednesday', labels: ['onsdag', 'ons', 'ons.', 'wednesday', 'wed', 'wed.'] },
  { day: 'thursday', labels: ['torsdag', 'tor', 'tor.', 'thursday', 'thu', 'thu.'] },
  { day: 'friday', labels: ['fredag', 'fre', 'fre.', 'friday', 'fri', 'fri.'] },
  { day: 'saturday', labels: ['lørdag', 'lør', 'lør.', 'sat', 'sat.', 'saturday'] },
  { day: 'sunday', labels: ['søndag', 'søn', 'søn.', 'sun', 'sun.', 'sunday'] },
]

const DAY_LOOKUP = new Map<string, keyof WeekHours>()
for (const entry of DAY_ALIASES) {
  for (const label of entry.labels) {
    DAY_LOOKUP.set(label, entry.day)
  }
}

const DAY_ORDER: Array<keyof WeekHours> = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/**
 * Normalize time strings: convert "24:00" to "00:00" (HTML time inputs only accept 00-23)
 */
function normalizeTime(time: string): string {
  if (time === '24:00') {
    return '00:00'
  }
  return time
}

function normalizeTimePair(hour: string, minute?: string): string {
  return normalizeTime(`${hour.padStart(2, '0')}:${minute || '00'}`)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hoursSignature(hours: WeekHours): string {
  return DAY_ORDER
    .map((day) => {
      const entry = hours[day]
      if (!entry) return `${day}:`
      if (entry.closed) return `${day}:closed`
      return `${day}:${entry.open || ''}-${entry.close || ''}`
    })
    .join('|')
}

function normalizeHeadingText(value: string): string {
  // Decode HTML entities first
  const decoded = value
    .replace(/&aring;/gi, 'å')
    .replace(/&Aring;/g, 'Å')
    .replace(/&aelig;/gi, 'æ')
    .replace(/&AElig;/g, 'Æ')
    .replace(/&oslash;/gi, 'ø')
    .replace(/&Oslash;/g, 'Ø')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.slice(2, -1))
      return String.fromCharCode(code)
    })
    .replace(/&#x[\da-f]+;/gi, (match) => {
      const code = parseInt(match.slice(3, -1), 16)
      return String.fromCharCode(code)
    })
  
  return decoded.toLowerCase().replace(/\s+/g, ' ').trim()
}

function isHeadingMarker(line: string): boolean {
  return /^#{1,3}\s*h\d:/i.test(line)
}

function stripHeadingMarker(line: string): string {
  return line
    .replace(/^#{1,3}\s*h\d:\s*/i, '')
    .replace(/\s*#{1,3}\s*$/i, '')
    .trim()
}

function extractVisibleTextAroundHeadings(html: string, headings: string[]): string[] {
  const cleanText = htmlToCleanText(html, true)
  const lines = cleanText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  console.log(`  📄 Clean text has ${lines.length} lines, first 10:`)
  lines.slice(0, 10).forEach((line, i) => {
    const marker = isHeadingMarker(line) ? '[H]' : '   '
    console.log(`    ${marker} ${i}: ${line.slice(0, 60)}`)
  })

  if (lines.length === 0) return []

  const normalizedHeadings = headings.map((heading) => normalizeHeadingText(heading))
  console.log(`  🔍 Looking for normalized headings:`, normalizedHeadings)
  
  const candidates: string[] = []
  let headingCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!isHeadingMarker(line)) continue
    
    headingCount++
    const headingText = stripHeadingMarker(line)
    const normalizedHeading = normalizeHeadingText(headingText)
    
    console.log(`  📍 Found heading ${headingCount}: "${headingText}" (normalized: "${normalizedHeading}")`)
    
    const matchesHeading = normalizedHeadings.some((needle) => normalizedHeading.includes(needle))
    if (!matchesHeading) {
      console.log(`    ❌ Does not match target headings`)
      continue
    }
    console.log(`    ✅ Matches target heading!`)

    const block: string[] = [headingText]
    let added = 0

    for (let j = i + 1; j < lines.length && added < 8; j++) {
      const next = lines[j]
      if (isHeadingMarker(next)) break

      block.push(next)
      added++
    }

    const candidate = block.join('\n').trim()
    if (candidate && !candidates.includes(candidate)) {
      candidates.push(candidate)
    }
  }

  console.log(`  📊 Total headings found: ${headingCount}, matching candidates: ${candidates.length}`)
  return candidates
}

export function extractKitchenCloseTime(html: string): string | null {
  const text = html
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    // Decode HTML entities (Danish characters + common entities)
    .replace(/&aring;/gi, 'å')
    .replace(/&Aring;/g, 'Å')
    .replace(/&aelig;/gi, 'æ')
    .replace(/&AElig;/g, 'Æ')
    .replace(/&oslash;/gi, 'ø')
    .replace(/&Oslash;/g, 'Ø')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (match, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([\da-f]+);/gi, (match, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\s+/g, ' ')

  // Try to find kitchen close time with flexible spacing
  const match = text.match(/køkken(?:et)?(?:\s+er)?\s+åbent(?:\s+frem)?\s+til\s+(?:kl\.?)?\s*(\d{1,2})(?:[:\.](\d{2}))?/i)
    || text.match(/køkken(?:et)?\s+lukker\s+(?:\w+\s+)*(?:kl\.?)?\s*(\d{1,2})(?:[:\.](\d{2}))?/i)
    || text.match(/kitchen(?:\s+is)?\s+open(?:\s+until|\s+to)\s+(?:at)?\s*(\d{1,2})(?:[:\.](\d{2}))?/i)
    || text.match(/kitchen\s*closes?\s+(?:\w+\s+)*(?:at)?\s*(\d{1,2})(?:[:\.](\d{2}))?/i)

  if (!match) {
    // Diagnostic: log a snippet to help debug
    const snippet = text.match(/køkken.{0,80}/i)?.[0] || text.match(/kitchen.{0,80}/i)?.[0]
    if (snippet) {
      console.log('⚠️ Kitchen close time pattern did not match. Found text:', snippet)
    }
    return null
  }
  
  const result = normalizeTime(`${match[1].padStart(2, '0')}:${match[2] || '00'}`)
  console.log(`✅ Extracted kitchen close time: ${result} from pattern match`)
  return result
}

/**
 * Extract opening hours from structured data or HTML patterns
 *
 * @param html - Raw HTML content
 * @param structuredData - Pre-extracted structured data blocks
 * @returns Opening hours object or null if not found
 */
export function extractOpeningHours(html: string, structuredData: StructuredData[]): OpeningHoursExtractionResult {
  const hours: WeekHours = {}
  const extractedKitchenCloseTime = extractKitchenCloseTime(html)

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
        return {
          openingHours: hours,
          reviewRequired: false,
          reviewReasons: [],
        }
      }
    }
  }

  // 2. Try parsing HTML patterns
  console.log('🕐 Structured data did not contain hours, trying HTML patterns...')

  const hoursKeywords = ['åbningstider', 'opening hours', 'åbent', 'öppettider', 'openingstijden']
  const candidateTexts: string[] = []

  const pushCandidate = (candidate: string) => {
    const trimmed = candidate.trim()
    if (!trimmed) return
    if (!candidateTexts.includes(trimmed)) candidateTexts.push(trimmed)
  }

  for (const keyword of hoursKeywords) {
    const keywordRegex = new RegExp(escapeRegex(keyword), 'gi')
    for (const match of html.matchAll(keywordRegex)) {
      const start = match.index ?? -1
      if (start >= 0) pushCandidate(html.slice(start, start + 4000))
    }

    const semanticRegex = new RegExp(
      `<(?:h[1-6]|strong|b)[^>]*>[^<]*${keyword}[^<]*<\/(?:h[1-6]|strong|b)>[\\s\\S]{0,3500}`,
      'gi'
    )
    for (const match of html.matchAll(semanticRegex)) {
      pushCandidate(match[0])
    }
  }

  const headingCandidates = extractVisibleTextAroundHeadings(html, [
    'åbningstider',
    'opening hours',
    'åbent',
    'kontakt',
  ])
  console.log(`🔍 Found ${headingCandidates.length} candidates from heading extraction`)
  for (const candidate of headingCandidates) {
    console.log(`  → Candidate (${candidate.length} chars): ${candidate.slice(0, 100)}...`)
    pushCandidate(candidate)
  }

  const tableMatch = html.match(/<table[^>]*>[\s\S]*?(?:mandag|monday|man|mon)[\s\S]*?<\/table>/i)
  if (tableMatch) {
    pushCandidate(tableMatch[0])
    console.log('🕐 Found potential hours table')
  }

  if (candidateTexts.length === 0) {
    console.log('⚠️ No opening hours section found in HTML')
    return {
      openingHours: null,
      reviewRequired: false,
      reviewReasons: [],
    }
  }

  const parseHoursText = (hoursText: string): { hours: WeekHours | null; complex: boolean } => {
    const candidateHours: WeekHours = {}
    let candidateKitchenCloseTime = extractedKitchenCloseTime
    const observedWindows = new Set<string>()

    const cleanText = hoursText
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/\s*(?:p|div|li|tr|td|th|section|article|ul|ol|h[1-6]|strong|b|span)\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      // Decode HTML entities (Danish characters + common entities)
      .replace(/&aring;/gi, 'å')
      .replace(/&Aring;/g, 'Å')
      .replace(/&aelig;/gi, 'æ')
      .replace(/&AElig;/g, 'Æ')
      .replace(/&oslash;/gi, 'ø')
      .replace(/&Oslash;/g, 'Ø')
      .replace(/&ndash;/gi, '–')
      .replace(/&mdash;/gi, '—')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#(\d+);/g, (match, code) => String.fromCharCode(parseInt(code)))
      .replace(/&#x([\da-f]+);/gi, (match, code) => String.fromCharCode(parseInt(code, 16)))
    const normalizedText = cleanText
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)

    const parseTimeRange = (line: string): { open: string; close: string } | null => {
      const match = line.match(/(\d{1,2})(?:[:\.](\d{2}))?\s*(?:[–\-]|til|to)\s*(\d{1,2})(?:[:\.](\d{2}))?/i)
      if (!match) return null
      const openMinute = match[2] || '00'
      const closeMinute = match[4] || '00'
      return {
        open: normalizeTime(`${match[1].padStart(2, '0')}:${openMinute}`),
        close: normalizeTime(`${match[3].padStart(2, '0')}:${closeMinute}`),
      }
    }

    let pendingDays: Array<keyof WeekHours> = []
    let pendingService: 'lunch' | 'evening' | 'all-day' | null = null

    const assignHours = (days: Array<keyof WeekHours>, open: string | null, close: string | null, closed = false) => {
      for (const day of days) {
        candidateHours[day] = closed ? { closed: true } : { open: open || undefined, close: close || undefined, closed: false }
      }
    }

    const detectDaysInLine = (line: string): Array<keyof WeekHours> => {
      const lower = line.toLowerCase()
      
      // Find days and their positions in the text
      const foundWithPositions: Array<{ day: keyof WeekHours; position: number }> = []
      for (const entry of DAY_ALIASES) {
        for (const label of entry.labels) {
          const regex = new RegExp(`\\b${escapeRegex(label)}\\b`, 'i')
          const match = lower.match(regex)
          if (match && match.index !== undefined) {
            foundWithPositions.push({ day: entry.day, position: match.index })
            break // Only record first matching label for this day
          }
        }
      }

      if (foundWithPositions.length === 0) return []
      
      // Sort by position in text to preserve original order
      foundWithPositions.sort((a, b) => a.position - b.position)
      
      // Remove duplicates while preserving order
      const found: Array<keyof WeekHours> = []
      const seen = new Set<keyof WeekHours>()
      for (const item of foundWithPositions) {
        if (!seen.has(item.day)) {
          found.push(item.day)
          seen.add(item.day)
        }
      }

      if (found.length < 2) return found

      // Check if we have a range separator
      const hasRangeSeparator = /(?:\btil\b|\bto\b|[-–—])/.test(lower)
      
      if (!hasRangeSeparator) {
        // No separator, return individual days
        return found
      }

      // For ranges, use first and last day in text order
      const firstDay = found[0]
      const lastDay = found[found.length - 1]
      const firstIndex = DAY_ORDER.indexOf(firstDay)
      const lastIndex = DAY_ORDER.indexOf(lastDay)

      if (firstIndex === -1 || lastIndex === -1) return found

      // Check if this is a wrap-around range (e.g., Sunday to Thursday)
      if (firstIndex > lastIndex) {
        // Wrap around: from firstDay to end of week, then from start to lastDay
        const result: Array<keyof WeekHours> = []
        // From firstDay to Sunday
        for (let i = firstIndex; i < DAY_ORDER.length; i++) {
          result.push(DAY_ORDER[i])
        }
        // From Monday to lastDay
        for (let i = 0; i <= lastIndex; i++) {
          result.push(DAY_ORDER[i])
        }
        return result
      } else {
        // Normal forward range
        return DAY_ORDER.slice(firstIndex, lastIndex + 1)
      }
    }

    const kitchenCloseFromLine = (line: string): string | null => {
      const match = line.match(/køkken(?:et)?(?:\s+er)?\s+åbent(?:\s+frem\s+til|\s+til)?(?:\s*kl\.?|\s*at)?\s*(\d{1,2})[:\.](\d{2})/i)
        || line.match(/køkken(?:et)?\s+lukker\s+(?:\w+\s+)*(?:kl\.?)?\s*(\d{1,2})[:\.](\d{2})/i)
        || line.match(/kitchen(?:\s+is)?\s+open(?:\s+until|\s+to)?(?:\s*at)?\s*(\d{1,2})[:\.](\d{2})/i)
        || line.match(/kitchen\s*closes?\s+(?:\w+\s+)*(?:at)?\s*(\d{1,2})[:\.](\d{2})/i)
        || line.match(/kitchen\s*close(?:s|d)?\s*at\s*(\d{1,2})[:\.](\d{2})/i)

      if (!match) return null
      return normalizeTimePair(match[1], match[2])
    }

    const extractServiceWindow = (line: string): { service: 'lunch' | 'evening' | 'all-day' | null; open: string | null; close: string | null } => {
      const lower = line.toLowerCase()
      const range = parseTimeRange(line)

      if (/\bfrokost\b|\blunch\b/.test(lower) && range) {
        return { service: 'lunch', open: range.open, close: range.close }
      }

      if (/\baften\b|\bevening\b|\bdinner\b/.test(lower) && range) {
        return { service: 'evening', open: range.open, close: range.close }
      }

      if (range) {
        return { service: 'all-day', open: range.open, close: range.close }
      }

      const openOnly = lower.match(/(?:frokost|lunch|aften|evening|dinner)?[^0-9]*(\d{1,2})(?:[:\.](\d{2}))?\s*(?:til|[-–—])\s*sent/i)
      if (openOnly) {
        return {
          service: /\bfrokost\b|\blunch\b/.test(lower) ? 'lunch' : /\baften\b|\bevening\b|\bdinner\b/.test(lower) ? 'evening' : 'all-day',
          open: normalizeTimePair(openOnly[1], openOnly[2]),
          close: candidateKitchenCloseTime,
        }
      }

      return { service: null, open: null, close: null }
    }

    const parseDayLine = (line: string): boolean => {
      const lower = line.toLowerCase()
      const kitchenClose = kitchenCloseFromLine(line)
      if (kitchenClose) {
        candidateKitchenCloseTime = kitchenClose
      }

      const hasServiceLabel = /\b(?:frokost|lunch|aften|evening|dinner)\b/i.test(lower)
      const hasTimeInformation = /\d/.test(lower)
      const isServiceLabelOnly = hasServiceLabel && !hasTimeInformation

      const detectedDays = detectDaysInLine(line)
      if (detectedDays.length > 0) {
        if (/\b(?:lukket|closed)\b/i.test(lower)) {
          assignHours(detectedDays, null, null, true)
          pendingDays = []
          pendingService = null
          return true
        }

        const serviceWindow = extractServiceWindow(line)
        if (serviceWindow.service && serviceWindow.open) {
          const close = serviceWindow.close || candidateKitchenCloseTime || null
          observedWindows.add(`${serviceWindow.service || 'all-day'}:${serviceWindow.open}-${close || 'sent'}`)
          assignHours(detectedDays, serviceWindow.open, close)
          pendingDays = []
          pendingService = null
          return true
        }

        pendingDays = detectedDays
        pendingService = /\bfrokost\b|\blunch\b/.test(lower)
          ? 'lunch'
          : /\baften\b|\bevening\b|\bdinner\b/.test(lower)
            ? 'evening'
            : null
        return true
      }

      if (pendingDays.length > 0) {
        if (/\b(?:lukket|closed)\b/i.test(lower)) {
          assignHours(pendingDays, null, null, true)
          pendingDays = []
          pendingService = null
          return true
        }

        const serviceWindow = extractServiceWindow(line)
        if (serviceWindow.open) {
          const close = serviceWindow.close || candidateKitchenCloseTime || null
          observedWindows.add(`${serviceWindow.service || 'all-day'}:${serviceWindow.open}-${close || 'sent'}`)
          assignHours(pendingDays, serviceWindow.open, close)
          pendingDays = []
          pendingService = null
          return true
        }

        const singleTime = line.match(/(\d{1,2})(?:[:\.](\d{2}))?/i)
        if (singleTime) {
          const open = normalizeTimePair(singleTime[1], singleTime[2])
          const close = candidateKitchenCloseTime || open
          observedWindows.add(`single:${open}-${close}`)
          assignHours(pendingDays, open, close)
          pendingDays = []
          pendingService = null
          return true
        }

        if (isServiceLabelOnly) {
          pendingService = /\bfrokost\b|\blunch\b/.test(lower)
            ? 'lunch'
            : /\baften\b|\bevening\b|\bdinner\b/.test(lower)
              ? 'evening'
              : pendingService
          return true
        }

        if (!/^[–\-]+$/.test(lower)) {
          pendingDays = []
          pendingService = null
        }
        return true
      }

      return false
    }

    for (const line of normalizedText) {
      const parsed = parseDayLine(line)
      if (parsed) {
        console.log(`    📝 Parsed line: "${line.slice(0, 60)}" → days: ${Object.keys(candidateHours).length}`)
      }
    }

    if (Object.keys(candidateHours).length > 0) {
      return { hours: candidateHours, complex: observedWindows.size > 1 }
    }

    const compactText = normalizedText.join(' ')

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
      const match = compactText.match(pattern.regex)
      if (match) {
        const openHour = match[1]
        const openMin = match[2]
        const closeHour = match[3]
        const closeMin = match[4]

        const openTime = normalizeTime(`${openHour.padStart(2, '0')}:${openMin}`)
        const closeTime = normalizeTime(`${closeHour.padStart(2, '0')}:${closeMin}`)

        for (const day of pattern.days) {
          candidateHours[day as keyof WeekHours] = {
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
      if (pattern.regex.test(compactText)) {
        candidateHours[pattern.day] = { closed: true }
        console.log(`  ✅ Parsed ${pattern.day}: closed`)
      }
    }

    return { hours: Object.keys(candidateHours).length > 0 ? candidateHours : null, complex: observedWindows.size > 1 }
  }

  const parsedCandidates: Array<{ hours: WeekHours; score: number; signature: string; complex: boolean }> = []

  console.log(`🔍 Parsing ${candidateTexts.length} candidates...`)
  for (const candidateText of candidateTexts) {
    console.log(`  → Parsing candidate (${candidateText.length} chars): ${candidateText.slice(0, 80)}...`)
    const parsedHoursResult = parseHoursText(candidateText)
    if (!parsedHoursResult.hours) {
      console.log(`    ❌ No hours extracted from this candidate`)
      continue
    }
    const score = Object.keys(parsedHoursResult.hours).length
    console.log(`    ✅ Extracted ${score} days:`, Object.keys(parsedHoursResult.hours))
    parsedCandidates.push({
      hours: parsedHoursResult.hours,
      score,
      signature: hoursSignature(parsedHoursResult.hours),
      complex: parsedHoursResult.complex,
    })
  }

  if (parsedCandidates.length > 0) {
    parsedCandidates.sort((a, b) => b.score - a.score)
    const bestHours = parsedCandidates[0].hours
    const uniqueSignatures = new Set(parsedCandidates.map((candidate) => candidate.signature))
    const reviewReasons: string[] = []

    if (parsedCandidates.some((candidate) => candidate.complex)) {
      reviewReasons.push('Detected multiple distinct opening windows within the extracted hours block')
    }

    if (parsedCandidates.length > 1 && uniqueSignatures.size > 1) {
      reviewReasons.push(`Found ${parsedCandidates.length} competing opening-hours blocks with different schedules`)
    }

    console.log('✅ Extracted opening hours from HTML patterns:', Object.keys(bestHours).length, 'days')
    return {
      openingHours: bestHours,
      reviewRequired: reviewReasons.length > 0,
      reviewReasons,
    }
  }

  console.log('⚠️ Could not parse opening hours from HTML')
  return {
    openingHours: null,
    reviewRequired: false,
    reviewReasons: [],
  }
}
