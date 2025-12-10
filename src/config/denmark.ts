/**
 * 🇩🇰 DENMARK-SPECIFIC CONFIGURATION
 * 
 * Localization and business configurations specific to the Danish market.
 * As the primary launch market, Denmark gets first-class support.
 */

export interface LocaleConfig {
  country: string
  countryCode: string
  language: string
  languageCode: string
  currency: string
  currencySymbol: string
  dateFormat: string
  timeFormat: '12h' | '24h'
  firstDayOfWeek: 0 | 1 // 0 = Sunday, 1 = Monday
  phonePrefix: string
  vatRate: number
}

export interface Holiday {
  date: string // YYYY-MM-DD format
  name: string
  type: 'public' | 'religious' | 'cultural'
}

export interface BusinessHoursDefault {
  weekday: { open: string; close: string; closed?: boolean }
  saturday: { open: string; close: string; closed?: boolean }
  sunday: { closed: boolean; open?: string; close?: string }
}

/**
 * Denmark locale configuration
 */
export const DENMARK_CONFIG: LocaleConfig = {
  country: 'Danmark',
  countryCode: 'DK',
  language: 'Dansk',
  languageCode: 'da',
  currency: 'DKK',
  currencySymbol: 'kr.',
  dateFormat: 'DD-MM-YYYY', // Danish date format
  timeFormat: '24h', // 24-hour clock
  firstDayOfWeek: 1, // Monday
  phonePrefix: '+45',
  vatRate: 0.25, // 25% moms
}

/**
 * Danish public holidays 2025-2026
 */
export const DANISH_HOLIDAYS: Holiday[] = [
  // 2025
  { date: '2025-01-01', name: 'Nytårsdag', type: 'public' },
  { date: '2025-04-17', name: 'Skærtorsdag', type: 'religious' },
  { date: '2025-04-18', name: 'Langfredag', type: 'religious' },
  { date: '2025-04-20', name: 'Påskedag', type: 'religious' },
  { date: '2025-04-21', name: '2. påskedag', type: 'religious' },
  { date: '2025-05-16', name: 'Store bededag', type: 'religious' },
  { date: '2025-05-29', name: 'Kristi himmelfartsdag', type: 'religious' },
  { date: '2025-06-08', name: 'Pinsedag', type: 'religious' },
  { date: '2025-06-09', name: '2. pinsedag', type: 'religious' },
  { date: '2025-12-24', name: 'Juleaftensdag', type: 'religious' },
  { date: '2025-12-25', name: 'Juledag', type: 'religious' },
  { date: '2025-12-26', name: '2. juledag', type: 'religious' },
  
  // 2026
  { date: '2026-01-01', name: 'Nytårsdag', type: 'public' },
  { date: '2026-04-02', name: 'Skærtorsdag', type: 'religious' },
  { date: '2026-04-03', name: 'Langfredag', type: 'religious' },
  { date: '2026-04-05', name: 'Påskedag', type: 'religious' },
  { date: '2026-04-06', name: '2. påskedag', type: 'religious' },
  { date: '2026-05-01', name: 'Store bededag', type: 'religious' },
  { date: '2026-05-14', name: 'Kristi himmelfartsdag', type: 'religious' },
  { date: '2026-05-24', name: 'Pinsedag', type: 'religious' },
  { date: '2026-05-25', name: '2. pinsedag', type: 'religious' },
  { date: '2026-12-24', name: 'Juleaftensdag', type: 'religious' },
  { date: '2026-12-25', name: 'Juledag', type: 'religious' },
  { date: '2026-12-26', name: '2. juledag', type: 'religious' },
]

/**
 * Default business hours for Danish businesses
 */
export const DANISH_BUSINESS_HOURS: Record<string, BusinessHoursDefault> = {
  cafe: {
    weekday: { open: '09:00', close: '18:00' },
    saturday: { open: '09:00', close: '16:00' },
    sunday: { open: '09:00', close: '15:00', closed: false },
  },
  restaurant: {
    weekday: { open: '11:00', close: '22:00' },
    saturday: { open: '11:00', close: '23:00' },
    sunday: { open: '11:00', close: '21:00', closed: false },
  },
  retail: {
    weekday: { open: '10:00', close: '18:00' },
    saturday: { open: '10:00', close: '15:00' },
    sunday: { closed: true },
  },
  salon: {
    weekday: { open: '09:00', close: '18:00' },
    saturday: { open: '09:00', close: '15:00' },
    sunday: { closed: true },
  },
  gym: {
    weekday: { open: '06:00', close: '22:00' },
    saturday: { open: '08:00', close: '18:00' },
    sunday: { open: '09:00', close: '18:00', closed: false },
  },
}

/**
 * Check if a date is a Danish public holiday
 */
export function isDanishHoliday(date: string): Holiday | null {
  return DANISH_HOLIDAYS.find(h => h.date === date) || null
}

/**
 * Get upcoming Danish holidays (next 30 days)
 */
export function getUpcomingHolidays(daysAhead: number = 30): Holiday[] {
  const today = new Date()
  const futureDate = new Date()
  futureDate.setDate(today.getDate() + daysAhead)
  
  return DANISH_HOLIDAYS.filter(holiday => {
    const holidayDate = new Date(holiday.date)
    return holidayDate >= today && holidayDate <= futureDate
  })
}

/**
 * Format Danish currency
 */
export function formatDanishCurrency(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} kr.`
}

/**
 * Format Danish date
 */
export function formatDanishDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

/**
 * Parse Danish date string (DD-MM-YYYY) to Date object
 */
export function parseDanishDate(dateString: string): Date {
  const [day, month, year] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}
