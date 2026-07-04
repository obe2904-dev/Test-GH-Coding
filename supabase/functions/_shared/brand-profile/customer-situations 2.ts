/**
 * Customer Situations Deriver - Layer 4 Enhancement
 * 
 * Derives customer situation contexts from timing + motivation + programme type
 * to provide Stage 2 with concrete scenarios for content creation.
 * 
 * TRANSFORMS:
 * - timing_preference: "Mandag-Fredag 12:00-14:00"
 * - motivation: "convenience"
 * - programme: "lunch"
 * 
 * INTO:
 * - situations: ["lunch break", "business meeting", "quick bite"]
 * 
 * PURPOSE:
 * Stage 2 can create posts about "perfect for lunch break" instead of just
 * knowing timing is "12:00-14:00 weekdays".
 * 
 * @version 1.0.0
 * @date June 21, 2026
 */

export type ProgrammeType = 'brunch' | 'lunch' | 'dinner' | 'bar' | 'breakfast' | 'afternoon'
export type Motivation = 'social_gathering' | 'convenience' | 'experience_seeking' | 'routine'
export type DecisionTiming = 'spontaneous' | 'planned' | 'mixed'

// ============================================================================
// MULTI-LANGUAGE SITUATION TRANSLATIONS
// ============================================================================

const SITUATION_TRANSLATIONS: Record<string, Record<string, string>> = {
  // Lunch situations
  lunch_break: { da: 'frokostpause', sv: 'lunchrast', no: 'lunsj pause', de: 'Mittagspause', en: 'lunch break' },
  quick_bite: { da: 'hurtig frokost', sv: 'snabb lunch', no: 'rask lunsj', de: 'schnelles Essen', en: 'quick bite' },
  working_lunch: { da: 'arbejdsfrokost', sv: 'arbetslunch', no: 'arbeidslunch', de: 'Arbeitsessen', en: 'working lunch' },
  business_meeting: { da: 'forretningsmøde', sv: 'affärsmöte', no: 'forretningsmøte', de: 'Geschäftstreffen', en: 'business meeting' },
  lunch_with_colleagues: { da: 'frokost med kolleger', sv: 'lunch med kollegor', no: 'lunsj med kolleger', de: 'Mittagessen mit Kollegen', en: 'lunch with colleagues' },
  catch_up_lunch: { da: 'hygge-frokost', sv: 'uppdateringslunch', no: 'hyggelig lunsj', de: 'Treffen zum Mittagessen', en: 'catch-up lunch' },
  daily_lunch_spot: { da: 'fast frokoststed', sv: 'daglig lunchställe', no: 'fast lunsjsted', de: 'täglicher Mittagsort', en: 'daily lunch spot' },
  regular_lunch: { da: 'daglig frokost', sv: 'regelbunden lunch', no: 'vanlig lunsj', de: 'regelmäßiges Mittagessen', en: 'regular lunch' },
  weekend_lunch: { da: 'weekendfrokost', sv: 'helglunch', no: 'helgelunsj', de: 'Wochenendbrunch', en: 'weekend lunch' },
  leisurely_lunch: { da: 'afslappet frokost', sv: 'lugn lunch', no: 'avslappet lunsj', de: 'gemütliches Mittagessen', en: 'leisurely lunch' },
  family_lunch: { da: 'familiefrokost', sv: 'familjelunch', no: 'familielunsj', de: 'Familienessen', en: 'family lunch' },
  
  // Brunch situations
  weekend_brunch: { da: 'weekend brunch', sv: 'helgbrunch', no: 'helgebrunch', de: 'Wochenendbrunch', en: 'weekend brunch' },
  family_brunch: { da: 'familiebrunch', sv: 'familjebrunch', no: 'familiebrunch', de: 'Familienbrunch', en: 'family brunch' },
  friend_catchup: { da: 'hygge med venner', sv: 'träffa vänner', no: 'møte venner', de: 'Treffen mit Freunden', en: 'friend catch-up' },
  brunch_experience: { da: 'brunch-oplevelse', sv: 'brunchupplevelse', no: 'brunchopplevelse', de: 'Brunch-Erlebnis', en: 'brunch experience' },
  instagram_brunch: { da: 'Instagram-brunch', sv: 'Instagram-brunch', no: 'Instagram-brunch', de: 'Instagram-Brunch', en: 'Instagram brunch' },
  trying_new_brunch: { da: 'prøve ny brunch', sv: 'prova ny brunch', no: 'prøve ny brunch', de: 'neuen Brunch probieren', en: 'trying new brunch' },
  weekday_brunch: { da: 'hverdag brunch', sv: 'vardagsbrunch', no: 'hverdagsbrunch', de: 'Wochentagsbrunch', en: 'weekday brunch' },
  brunch_meeting: { da: 'brunch-møde', sv: 'brunchmöte', no: 'brunchmøte', de: 'Brunch-Treffen', en: 'brunch meeting' },
  
  // Dinner situations
  special_occasion: { da: 'særlig anledning', sv: 'speciellt tillfälle', no: 'spesiell anledning', de: 'besonderer Anlass', en: 'special occasion' },
  dinner_reservation: { da: 'aftensbordbestilling', sv: 'middagsbokning', no: 'middagsreservasjon', de: 'Tischreservierung', en: 'dinner reservation' },
  planned_evening: { da: 'planlagt aften ud', sv: 'planerad kväll ute', no: 'planlagt kveld ute', de: 'geplanter Abend', en: 'planned evening out' },
  date_night: { da: 'date night', sv: 'dejt kväll', no: 'date kveld', de: 'Date Night', en: 'date night' },
  celebration_dinner: { da: 'festmiddag', sv: 'firande middag', no: 'feiremiddag', de: 'Festessen', en: 'celebration dinner' },
  dinner_with_friends: { da: 'middag med venner', sv: 'middag med vänner', no: 'middag med venner', de: 'Abendessen mit Freunden', en: 'dinner with friends' },
  spontaneous_dinner: { da: 'spontan middag', sv: 'spontan middag', no: 'spontan middag', de: 'spontanes Abendessen', en: 'spontaneous dinner' },
  walk_in_dinner: { da: 'walk-in middag', sv: 'drop-in middag', no: 'walk-in middag', de: 'spontaner Besuch', en: 'walk-in dinner' },
  last_minute_plans: { da: 'last-minute planer', sv: 'sista minuten planer', no: 'siste minutt planer', de: 'Last-Minute-Pläne', en: 'last-minute plans' },
  weekend_dinner: { da: 'weekendmiddag', sv: 'helgmiddag', no: 'helgemiddag', de: 'Wochenendessen', en: 'weekend dinner' },
  weekday_dinner: { da: 'hverdagsmiddag', sv: 'vardagsmiddag', no: 'hverdagsmiddag', de: 'Abendessen unter der Woche', en: 'weekday dinner' },
  
  // Bar situations
  after_work_drinks: { da: 'after work drinks', sv: 'after work drinkar', no: 'after work drinks', de: 'Feierabend-Drinks', en: 'after-work drinks' },
  happy_hour: { da: 'happy hour', sv: 'happy hour', no: 'happy hour', de: 'Happy Hour', en: 'happy hour' },
  evening_drinks: { da: 'aftendrinks', sv: 'kvällsdrinkar', no: 'kveldsdrinks', de: 'Abend-Drinks', en: 'evening drinks' },
  weekend_night_out: { da: 'weekend aften ud', sv: 'helgkväll ute', no: 'helgkveld ute', de: 'Wochenend-Ausgang', en: 'weekend night out' },
  late_night_drinks: { da: 'sen-nat drinks', sv: 'sena drinkar', no: 'sen kveld drinks', de: 'Spätabend-Drinks', en: 'late-night drinks' },
  night_drinks: { da: 'aftendrinks', sv: 'kvällsdrinkar', no: 'kveldsdrinks', de: 'Abend-Drinks', en: 'night drinks' },
  drinks_with_friends: { da: 'drinks med venner', sv: 'drinkar med vänner', no: 'drinks med venner', de: 'Drinks mit Freunden', en: 'drinks with friends' },
  social_drinks: { da: 'sociale drinks', sv: 'sociala drinkar', no: 'sosiale drinks', de: 'soziale Drinks', en: 'social drinks' },
  
  // Breakfast situations
  before_work: { da: 'før arbejde', sv: 'före arbetet', no: 'før arbeid', de: 'vor der Arbeit', en: 'before work' },
  morning_coffee: { da: 'morgenkaffe', sv: 'morgonkaffe', no: 'morgenkaffe', de: 'Morgenkaffee', en: 'morning coffee' },
  quick_breakfast: { da: 'hurtig morgenmad', sv: 'snabb frukost', no: 'rask frokost', de: 'schnelles Frühstück', en: 'quick breakfast' },
  morning_routine: { da: 'morgenrutine', sv: 'morgonrutin', no: 'morgenrutine', de: 'Morgenroutine', en: 'morning routine' },
  daily_coffee_spot: { da: 'fast kaffested', sv: 'dagligt kaffeställe', no: 'fast kaffested', de: 'täglicher Kaffeeort', en: 'daily coffee spot' },
  
  // Afternoon situations
  afternoon_break: { da: 'eftermiddagspause', sv: 'eftermiddagspaus', no: 'ettermiddagspause', de: 'Nachmittagspause', en: 'afternoon break' },
  coffee_break: { da: 'kaffepause', sv: 'fika', no: 'kaffepause', de: 'Kaffeepause', en: 'coffee break' },
  afternoon_snack: { da: 'eftermiddagssnack', sv: 'eftermiddagsmellis', no: 'ettermiddagssnack', de: 'Nachmittagssnack', en: 'afternoon snack' },
  afternoon_catchup: { da: 'eftermiddagshygge', sv: 'eftermiddagshäng', no: 'ettermiddagshygge', de: 'Nachmittagstreffen', en: 'afternoon catch-up' },
  coffee_date: { da: 'kaffehygge', sv: 'fika-dejt', no: 'kaffehygge', de: 'Kaffee-Date', en: 'coffee date' },
  
  // Generic situations
  quick_visit: { da: 'hurtigt besøg', sv: 'snabbt besök', no: 'raskt besøk', de: 'kurzer Besuch', en: 'quick visit' },
  convenient_stop: { da: 'bekvemt stop', sv: 'bekvämt stopp', no: 'praktisk stopp', de: 'bequemer Zwischenstopp', en: 'convenient stop' },
  social_visit: { da: 'socialt besøg', sv: 'socialt besök', no: 'sosialt besøk', de: 'geselliger Besuch', en: 'social visit' },
  meeting_spot: { da: 'mødested', sv: 'mötesplats', no: 'møtested', de: 'Treffpunkt', en: 'meeting spot' },
  trying_new_place: { da: 'prøve nyt sted', sv: 'prova nytt ställe', no: 'prøve nytt sted', de: 'neuen Ort probieren', en: 'trying somewhere new' },
  food_experience: { da: 'madoplevelse', sv: 'matupplevelse', no: 'matopplevelse', de: 'kulinarisches Erlebnis', en: 'food experience' },
  regular_visit: { da: 'fast besøg', sv: 'regelbundet besök', no: 'fast besøk', de: 'regelmäßiger Besuch', en: 'regular visit' },
  daily_spot: { da: 'dagligt sted', sv: 'daglig plats', no: 'daglig sted', de: 'täglicher Ort', en: 'daily spot' }
}

/**
 * Get translated situation string
 */
function getSituation(key: string, lang: string = 'da'): string {
  return SITUATION_TRANSLATIONS[key]?.[lang] || SITUATION_TRANSLATIONS[key]?.['en'] || key
}

export interface SituationDerivationInput {
  timingPreference: string  // e.g., "Mandag-Fredag 12:00-14:00"
  motivation: Motivation
  programmeType: ProgrammeType
  decisionTiming: DecisionTiming
  segmentLabel: string  // For context (e.g., "Kontorfolk på frokost")
  language?: string  // ISO 639-1 code (da, sv, no, de, en) - defaults to 'da'
}

/**
 * Derive customer situations from segment characteristics
 * 
 * LOGIC:
 * - Combines time pattern (weekday lunch, weekend evening, etc.)
 * - Motivation (why they visit)
 * - Decision timing (spontaneous vs planned)
 * - Programme type (meal occasion)
 * 
 * To infer likely customer scenarios/needs.
 * 
 * MULTI-LANGUAGE SUPPORT:
 * Returns situations in the business's language (Danish, Swedish, Norwegian, German, English)
 */
export function deriveCustomerSituations(input: SituationDerivationInput): string[] {
  const situations: string[] = []
  const lang = input.language || 'da'  // Default to Danish
  
  // Parse timing to extract day pattern and time window
  const dayPattern = extractDayPattern(input.timingPreference)
  const timeWindow = extractTimeWindow(input.timingPreference)
  
  // === LUNCH PROGRAMME ===
  if (input.programmeType === 'lunch') {
    if (dayPattern === 'weekday' && timeWindow.start >= 11 && timeWindow.end <= 15) {
      // Weekday lunch patterns
      if (input.motivation === 'convenience') {
        situations.push(getSituation('lunch_break', lang), getSituation('quick_bite', lang), getSituation('working_lunch', lang))
      } else if (input.motivation === 'social_gathering') {
        situations.push(getSituation('business_meeting', lang), getSituation('lunch_with_colleagues', lang), getSituation('catch_up_lunch', lang))
      } else if (input.motivation === 'routine') {
        situations.push(getSituation('daily_lunch_spot', lang), getSituation('regular_lunch', lang))
      }
    } else if (dayPattern === 'weekend') {
      situations.push(getSituation('weekend_lunch', lang), getSituation('leisurely_lunch', lang), getSituation('family_lunch', lang))
    }
  }
  
  // === BRUNCH PROGRAMME ===
  else if (input.programmeType === 'brunch') {
    if (dayPattern === 'weekend') {
      if (input.motivation === 'social_gathering') {
        situations.push(getSituation('weekend_brunch', lang), getSituation('family_brunch', lang), getSituation('friend_catchup', lang))
      } else if (input.motivation === 'experience_seeking') {
        situations.push(getSituation('brunch_experience', lang), getSituation('instagram_brunch', lang), getSituation('trying_new_brunch', lang))
      }
    } else {
      // Weekday brunch (less common)
      situations.push(getSituation('weekday_brunch', lang), getSituation('brunch_meeting', lang))
    }
  }
  
  // === DINNER PROGRAMME ===
  else if (input.programmeType === 'dinner') {
    if (input.decisionTiming === 'planned') {
      situations.push(getSituation('special_occasion', lang), getSituation('dinner_reservation', lang), getSituation('planned_evening', lang))
      
      if (input.motivation === 'social_gathering') {
        situations.push(getSituation('date_night', lang), getSituation('celebration_dinner', lang), getSituation('dinner_with_friends', lang))
      }
    } else if (input.decisionTiming === 'spontaneous') {
      situations.push(getSituation('spontaneous_dinner', lang), getSituation('walk_in_dinner', lang), getSituation('last_minute_plans', lang))
    }
    
    if (dayPattern === 'weekend') {
      situations.push(getSituation('weekend_dinner', lang))
    } else if (dayPattern === 'weekday') {
      situations.push(getSituation('weekday_dinner', lang))
    }
  }
  
  // === BAR PROGRAMME ===
  else if (input.programmeType === 'bar') {
    if (timeWindow.start >= 17 && timeWindow.end <= 20) {
      // After-work hours
      situations.push(getSituation('after_work_drinks', lang), getSituation('happy_hour', lang), getSituation('evening_drinks', lang))
    } else if (timeWindow.start >= 20) {
      // Late evening/night
      if (dayPattern === 'weekend') {
        situations.push(getSituation('weekend_night_out', lang), getSituation('late_night_drinks', lang), getSituation('night_drinks', lang))
      } else {
        situations.push(getSituation('evening_drinks', lang), getSituation('night_drinks', lang))
      }
    }
    
    if (input.motivation === 'social_gathering') {
      situations.push(getSituation('drinks_with_friends', lang), getSituation('social_drinks', lang))
    }
  }
  
  // === BREAKFAST PROGRAMME ===
  else if (input.programmeType === 'breakfast') {
    if (timeWindow.start <= 9 && input.motivation === 'convenience') {
      situations.push(getSituation('before_work', lang), getSituation('morning_coffee', lang), getSituation('quick_breakfast', lang))
    } else if (input.motivation === 'routine') {
      situations.push(getSituation('morning_routine', lang), getSituation('daily_coffee_spot', lang))
    }
  }
  
  // === AFTERNOON PROGRAMME (coffee, snacks) ===
  else if (input.programmeType === 'afternoon') {
    if (timeWindow.start >= 14 && timeWindow.end <= 17) {
      situations.push(getSituation('afternoon_break', lang), getSituation('coffee_break', lang), getSituation('afternoon_snack', lang))
      
      if (input.motivation === 'social_gathering') {
        situations.push(getSituation('afternoon_catchup', lang), getSituation('coffee_date', lang))
      }
    }
  }
  
  // === GENERIC FALLBACKS ===
  
  // If no situations found, derive from motivation alone
  if (situations.length === 0) {
    if (input.motivation === 'convenience') {
      situations.push(getSituation('quick_visit', lang), getSituation('convenient_stop', lang))
    } else if (input.motivation === 'social_gathering') {
      situations.push(getSituation('social_visit', lang), getSituation('meeting_spot', lang))
    } else if (input.motivation === 'experience_seeking') {
      situations.push(getSituation('trying_new_place', lang), getSituation('food_experience', lang))
    } else if (input.motivation === 'routine') {
      situations.push(getSituation('regular_visit', lang), getSituation('daily_spot', lang))
    }
  }
  
  // Deduplicate and limit to top 4 most relevant
  const uniqueSituations = Array.from(new Set(situations))
  return uniqueSituations.slice(0, 4)
}

/**
 * Extract day pattern from timing preference string
 */
function extractDayPattern(timingPref: string): 'weekday' | 'weekend' | 'all' {
  const lower = timingPref.toLowerCase()
  
  if (lower.includes('lør') || lower.includes('søn') || lower.includes('weekend')) {
    if (lower.includes('man') || lower.includes('tir') || lower.includes('ons') || lower.includes('tor') || lower.includes('fre')) {
      return 'all'  // Both weekday and weekend
    }
    return 'weekend'
  } else if (lower.includes('man') || lower.includes('tir') || lower.includes('ons') || lower.includes('tor') || lower.includes('fre') || lower.includes('hverdag')) {
    return 'weekday'
  }
  
  return 'all'
}

/**
 * Extract time window from timing preference string
 */
function extractTimeWindow(timingPref: string): { start: number; end: number } {
  // Match patterns like "12:00-14:00" or "kl. 12-14"
  const timePattern = /(\d{1,2}):?(\d{2})?\s*-\s*(\d{1,2}):?(\d{2})?/
  const match = timingPref.match(timePattern)
  
  if (match) {
    const startHour = parseInt(match[1], 10)
    const endHour = parseInt(match[3], 10)
    
    return { start: startHour, end: endHour }
  }
  
  // Default fallback based on common patterns in string
  if (timingPref.toLowerCase().includes('morgen')) {
    return { start: 7, end: 11 }
  } else if (timingPref.toLowerCase().includes('frokost') || timingPref.toLowerCase().includes('lunch')) {
    return { start: 11, end: 15 }
  } else if (timingPref.toLowerCase().includes('aften') || timingPref.toLowerCase().includes('dinner')) {
    return { start: 17, end: 22 }
  } else if (timingPref.toLowerCase().includes('bar') || timingPref.toLowerCase().includes('nat')) {
    return { start: 20, end: 24 }
  }
  
  // Generic fallback
  return { start: 10, end: 22 }
}

/**
 * Format situations as marketing content angles
 * 
 * Converts customer situations into actionable content angle suggestions
 * for marketing manager brief.
 */
export function formatSituationsAsContentAngles(situations: string[]): string[] {
  const angleMap: Record<string, string> = {
    'frokostpause': 'Perfekt til frokostpausen',
    'hurtig frokost': 'Hurtig frokost',
    'forretningsmøde': 'Forretningsmøder',
    'arbejdsfrokost': 'Arbejdsfrokost',
    'weekend brunch': 'Weekend brunch',
    'familiebrunch': 'Familiebrunch',
    'date night': 'Date night destination',
    'after work drinks': 'After work drinks',
    'weekend aften ud': 'Weekend aften ud',
    'før arbejde': 'Før arbejde',
    'morgenkaffe': 'Morgenkaffe',
    'eftermiddagspause': 'Eftermiddagspause'
  }
  
  return situations
    .map(situation => angleMap[situation] || situation)
    .slice(0, 3)  // Top 3 most relevant
}
