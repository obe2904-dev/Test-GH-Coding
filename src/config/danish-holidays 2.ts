/**
 * 🇩🇰 DANISH HOLIDAYS CALENDAR
 * 
 * Static calendar for seasonal content suggestions.
 * Used by AI Ideas to generate timely, culturally relevant posts.
 */

export interface Holiday {
  name: string
  nameEn: string
  date: string // MM-DD format (fixed) or 'easter+N' for Easter-relative
  type: 'fixed' | 'easter-relative' | 'variable'
  daysFromEaster?: number // For Easter-relative holidays
  category: 'national' | 'cultural' | 'seasonal' | 'commercial'
  contentIdeas: string[] // Suggestions for post themes
}

/**
 * Major Danish holidays and cultural events
 */
export const DANISH_HOLIDAYS: Holiday[] = [
  // FIXED DATE HOLIDAYS
  {
    name: 'Nytårsdag',
    nameEn: "New Year's Day",
    date: '01-01',
    type: 'fixed',
    category: 'national',
    contentIdeas: ['Godt nytår ønsker', 'Nytårsforsætter', 'Årets første tilbud']
  },
  {
    name: 'Valentinsdag',
    nameEn: "Valentine's Day",
    date: '02-14',
    type: 'fixed',
    category: 'commercial',
    contentIdeas: ['Romantisk menu', 'Valentinstilbud', 'Del kærligheden']
  },
  {
    name: 'Fastelavn',
    nameEn: 'Fastelavn (Shrovetide)',
    date: '02-23', // Approximate - varies (7 weeks before Easter)
    type: 'variable',
    category: 'cultural',
    contentIdeas: ['Fastelavnsboller', 'Børneaktiviteter', 'Udklædning og fest']
  },
  {
    name: 'Kvindernes internationale kampdag',
    nameEn: "International Women's Day",
    date: '03-08',
    type: 'fixed',
    category: 'cultural',
    contentIdeas: ['Fejring af kvinder', 'Kvinder i vores team', 'Særlige tilbud']
  },
  {
    name: 'Påskedag',
    nameEn: 'Easter Sunday',
    date: 'easter+0',
    type: 'easter-relative',
    daysFromEaster: 0,
    category: 'national',
    contentIdeas: ['Påskefrokost', 'Påskeæg', 'Familiehygge', 'Påskemenu']
  },
  {
    name: 'Skærtorsdag',
    nameEn: 'Maundy Thursday',
    date: 'easter-3',
    type: 'easter-relative',
    daysFromEaster: -3,
    category: 'national',
    contentIdeas: ['Langfredag lukket?', 'Påskeforberedelser']
  },
  {
    name: 'Langfredag',
    nameEn: 'Good Friday',
    date: 'easter-2',
    type: 'easter-relative',
    daysFromEaster: -2,
    category: 'national',
    contentIdeas: ['Stille dag', 'Åbningstider i påsken']
  },
  {
    name: '2. Påskedag',
    nameEn: 'Easter Monday',
    date: 'easter+1',
    type: 'easter-relative',
    daysFromEaster: 1,
    category: 'national',
    contentIdeas: ['Påskebrunch', 'Fortsæt påskehyggen']
  },
  {
    name: 'Store Bededag',
    nameEn: 'Great Prayer Day',
    date: 'easter+26',
    type: 'easter-relative',
    daysFromEaster: 26,
    category: 'national',
    contentIdeas: ['Varme hveder', 'Helligdag', 'Traditionel dansk']
  },
  {
    name: 'Kristi Himmelfartsdag',
    nameEn: 'Ascension Day',
    date: 'easter+39',
    type: 'easter-relative',
    daysFromEaster: 39,
    category: 'national',
    contentIdeas: ['Lang weekend', 'Udflugt', 'Forårsmenu']
  },
  {
    name: 'Pinsedag',
    nameEn: 'Whit Sunday (Pentecost)',
    date: 'easter+49',
    type: 'easter-relative',
    daysFromEaster: 49,
    category: 'national',
    contentIdeas: ['Pinsefrokost', 'Sommer starter', 'Udendørsservering']
  },
  {
    name: '2. Pinsedag',
    nameEn: 'Whit Monday',
    date: 'easter+50',
    type: 'easter-relative',
    daysFromEaster: 50,
    category: 'national',
    contentIdeas: ['Pinseweekend', 'Familiearrangement']
  },
  {
    name: 'Grundlovsdag',
    nameEn: 'Constitution Day',
    date: '06-05',
    type: 'fixed',
    category: 'national',
    contentIdeas: ['Dansk nationaldag', 'Fejring af Danmark', 'Særlige åbningstider']
  },
  {
    name: 'Sankt Hans Aften',
    nameEn: "Midsummer's Eve",
    date: '06-23',
    type: 'fixed',
    category: 'cultural',
    contentIdeas: ['Bålarrangement', 'Sommerfest', 'Lyse nætter', 'Udendørs event']
  },
  {
    name: 'Mortensaften',
    nameEn: "St. Martin's Eve",
    date: '11-10',
    type: 'fixed',
    category: 'cultural',
    contentIdeas: ['Mortensand', 'Gastronomisk tradition', 'Efterårsaften']
  },
  {
    name: 'Juleaften',
    nameEn: 'Christmas Eve',
    date: '12-24',
    type: 'fixed',
    category: 'national',
    contentIdeas: ['Julehilsen', 'Julefrokost', 'Særlige åbningstider', 'God jul']
  },
  {
    name: '1. Juledag',
    nameEn: 'Christmas Day',
    date: '12-25',
    type: 'fixed',
    category: 'national',
    contentIdeas: ['Julebrunch', 'Familiedag']
  },
  {
    name: '2. Juledag',
    nameEn: 'Second Day of Christmas',
    date: '12-26',
    type: 'fixed',
    category: 'national',
    contentIdeas: ['Rester-menu', 'Julehygge fortsætter', 'Between-days tilbud']
  },
  {
    name: 'Nytårsaften',
    nameEn: "New Year's Eve",
    date: '12-31',
    type: 'fixed',
    category: 'national',
    contentIdeas: ['Nytårsmenu', 'Champagne', 'Årets sidste åbningsdag', 'Festlige retter']
  },

  // SEASONAL PERIODS (approximate dates)
  {
    name: 'Sommerferie starter',
    nameEn: 'Summer Holiday Begins',
    date: '06-28',
    type: 'variable',
    category: 'seasonal',
    contentIdeas: ['Sommermenu', 'Ferietilbud', 'Udendørsservering', 'Afkøling']
  },
  {
    name: 'Efterårsferie',
    nameEn: 'Autumn Holiday Week',
    date: '10-14',
    type: 'variable',
    category: 'seasonal',
    contentIdeas: ['Børnevenlige aktiviteter', 'Hyggemenu', 'Efterårsretter', 'Familietilbud']
  },
  {
    name: 'Black Friday',
    nameEn: 'Black Friday',
    date: '11-29',
    type: 'variable',
    category: 'commercial',
    contentIdeas: ['Black Friday tilbud', 'Særlige deals', 'Gavekort rabat']
  },
  {
    name: 'Første søndag i advent',
    nameEn: 'First Sunday of Advent',
    date: '12-01',
    type: 'variable',
    category: 'cultural',
    contentIdeas: ['Julestemning', 'Adventshygge', 'Julekort', 'Julekalender starter']
  }
]

/**
 * Calculate Easter Sunday for a given year (Computus algorithm)
 */
export function getEasterDate(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1 // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1
  
  return new Date(year, month, day)
}

/**
 * Get holidays near a specific date (within N days before/after)
 */
export function getUpcomingHolidays(
  referenceDate: Date = new Date(),
  daysAhead: number = 14,
  daysBefore: number = 3
): Holiday[] {
  const year = referenceDate.getFullYear()
  const easter = getEasterDate(year)
  
  const upcoming: Holiday[] = []
  
  for (const holiday of DANISH_HOLIDAYS) {
    let holidayDate: Date
    
    if (holiday.type === 'easter-relative' && holiday.daysFromEaster !== undefined) {
      holidayDate = new Date(easter)
      holidayDate.setDate(easter.getDate() + holiday.daysFromEaster)
    } else {
      // Fixed or variable date (MM-DD format)
      const [month, day] = holiday.date.split('-').map(Number)
      holidayDate = new Date(year, month - 1, day)
      
      // If holiday has passed, check next year
      if (holidayDate < referenceDate) {
        holidayDate = new Date(year + 1, month - 1, day)
      }
    }
    
    const diffDays = Math.floor((holidayDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays >= -daysBefore && diffDays <= daysAhead) {
      upcoming.push(holiday)
    }
  }
  
  return upcoming
}

/**
 * Get current season in Danish
 */
export function getCurrentSeason(date: Date = new Date()): { name: string; nameEn: string } {
  const month = date.getMonth() + 1
  
  if (month >= 3 && month <= 5) {
    return { name: 'Forår', nameEn: 'Spring' }
  } else if (month >= 6 && month <= 8) {
    return { name: 'Sommer', nameEn: 'Summer' }
  } else if (month >= 9 && month <= 11) {
    return { name: 'Efterår', nameEn: 'Autumn' }
  } else {
    return { name: 'Vinter', nameEn: 'Winter' }
  }
}

/**
 * Format holidays for AI prompt context
 */
export function formatHolidaysForPrompt(holidays: Holiday[], language: 'da' | 'en' = 'da'): string {
  if (holidays.length === 0) {
    return ''
  }
  
  const lines = holidays.map(h => {
    const name = language === 'da' ? h.name : h.nameEn
    const ideas = h.contentIdeas.slice(0, 2).join(', ')
    return `- ${name}: ${ideas}`
  })
  
  return `UPCOMING HOLIDAYS/EVENTS:\n${lines.join('\n')}`
}
