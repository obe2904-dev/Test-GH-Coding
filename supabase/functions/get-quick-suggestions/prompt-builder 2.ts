// Prompt building utilities for get-quick-suggestions
// System instructions and day framing generators
// Extracted June 24, 2026

import dagensSystemPromptDa from '../_shared/prompts/languages/da/dagens-forslag-system.ts'
import type { OperationalTimeline } from './operational-timeline.ts'

/**
 * Builds Gemini system instruction using multilingual prompt system
 * 
 * Currently only Danish is supported. Falls back to Danish for other languages.
 * Uses static import to ensure bundler includes the prompt.
 * 
 * @param language - Language code ('da', 'en', 'sv')
 * @returns Complete system instruction text for Gemini API
 */
export async function buildDagensSystemInstruction(language: string = 'da'): Promise<string> {
  // Currently only Danish is supported - static import ensures bundler includes it
  if (language !== 'da') {
    console.warn(`Language ${language} not yet supported, falling back to Danish`)
  }
  
  // Use static import - guaranteed to be in bundle
  return dagensSystemPromptDa.system + ' ' + dagensSystemPromptDa.closer
}

/**
 * Weather information for day framing
 */
export interface WeatherInfo {
  city: string
  temperature: string
  conditions: string
  tier?: string
  score?: number
  recommendation?: string
}

/**
 * Generates contextual framing for the day based on:
 * - Day of week (with special handling for weekends)
 * - Danish public holidays
 * - Weather conditions (when favorable)
 * - Special programs/events
 * 
 * Returns a Danish-language sentence describing what makes today relevant,
 * used to provide context in the UI and AI prompts.
 * 
 * @param clientNow - Current date/time from client
 * @param businessName - Name of the business (reserved for future use)
 * @param timeline - Operational timeline with service windows
 * @param weather - Weather forecast information (nullable)
 * @param hasSpecialPrograms - Whether business has special events today
 * @returns Danish-language day framing text
 */
export function generateDayFraming(
  clientNow: Date,
  businessName: string,
  timeline: OperationalTimeline,
  weather: WeatherInfo | null,
  hasSpecialPrograms: boolean
): string {
  const dayOfWeek = clientNow.getDay()
  const month = clientNow.getMonth() + 1
  const day = clientNow.getDate()
  
  const dayNames = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
  const dayName = dayNames[dayOfWeek]
  
  // Check for Danish public holidays
  const danishHolidays: Record<string, string> = {
    '1-1': 'Nytårsdag',
    '6-5': 'Grundlovsdag',
    '12-24': 'juleaften',
    '12-25': 'juledag',
    '12-26': '2. juledag',
    '12-31': 'nytårsaften',
    // Easter is moveable - simplified for now
  }
  
  const dateKey = `${month}-${day}`
  const holiday = danishHolidays[dateKey]
  
  const parts: string[] = []
  
  // Start with day of week or holiday
  if (holiday) {
    parts.push(`I dag er det ${holiday}`)
    // Add context about operational impact if relevant
    if (holiday === 'Grundlovsdag' || holiday === 'juleaften' || holiday === 'nytårsaften') {
      if (timeline.isLateNight || timeline.isSocialDeadZone) {
        parts.push('– mange steder holder lukket eller har kortere åbningstider')
      } else {
        parts.push('– en festdag hvor mange danskere har fri')
      }
    }
  } else {
    // Regular day
    if (dayOfWeek === 5) { // Friday
      parts.push('I dag er det fredag – weekend-stemningen er i gang')
    } else if (dayOfWeek === 6) { // Saturday
      parts.push('I dag er det lørdag')
    } else if (dayOfWeek === 0) { // Sunday
      parts.push('I dag er det søndag')
    } else {
      parts.push(`I dag er det ${dayName}`)
    }
  }
  
  // Add weather context if good and relevant
  if (weather && timeline.slots.length > 0) {
    const temp = parseInt(weather.temperature)
    const conditions = weather.conditions.toLowerCase()
    const weatherTier = weather.tier || ''
    const shouldMentionWeather = weatherTier
      ? weatherTier === 'premium' || weatherTier === 'viable'
      : temp >= 18 && !conditions.includes('regn') && !conditions.includes('rain')

    if (shouldMentionWeather) {
      parts.push(`og vejret er godt (${weather.temperature}, ${weather.conditions})`)
    } else if (weatherTier === 'unviable' && weather.recommendation) {
      parts.push(`og vejret kalder på indehygge (${weather.temperature}, ${weather.conditions})`)
    }
  }
  
  // Add program context if special events today
  if (hasSpecialPrograms) {
    parts.push('. Der er særlige programmer i dag')
  }
  
  return parts.join(' ')
}
