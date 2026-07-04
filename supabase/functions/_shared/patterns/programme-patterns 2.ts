/**
 * Multi-language programme pattern library
 * 
 * Enables culturally-aware programme detection across languages.
 * Handles cultural concepts unique to each market (e.g., Swedish "fika", Danish "morgenmad").
 * 
 * Usage:
 * - detectProgrammeType(text, language): Identify programme type from menu/business descriptions
 * - getProgrammeKeywords(type, language): Get culturally-relevant keywords for programme type
 * 
 * Cultural sensitivity:
 * - Swedish "fika" is NOT equivalent to "coffee break" - it's a cultural ritual
 * - Danish "brunch" differs from international brunch culture
 * - German "Frühstück" timing differs from Danish "morgenmad"
 */

/**
 * Programme type keywords by language
 * 
 * Structure: language → programme_type → keyword array
 * 
 * Programme types:
 * - morning: Breakfast/brunch programmes (culture-specific timing)
 * - lunch: Midday meal programmes
 * - dinner: Evening meal programmes
 * - bar: Drinks/cocktails/nightlife programmes
 * - fika: Swedish coffee culture (SE only)
 * - afternoon_tea: British/international tea service (multi-market)
 * - late_night: After-dinner/night programmes
 */
export const PROGRAMME_KEYWORDS: Record<string, Record<string, string[]>> = {
  // Danish programme keywords
  da: {
    morning: [
      'brunch', 'morgenmad', 'breakfast', 'morgenkaffe', 'morgenbrød',
      'croissant', 'rundstykker', 'æggekage', 'yoghurt', 'havregrød',
      'smoothie bowl', 'avocado toast', 'eggs benedict', 'pandekager'
    ],
    lunch: [
      'frokost', 'lunch', 'smørrebrød', 'middagsmenu', 'frokostretter',
      'salat', 'sandwich', 'suppe', 'dagens ret', 'frokosttilbud',
      'let frokost', 'hurtig frokost', 'take away'
    ],
    dinner: [
      'aftensmad', 'dinner', 'middag', 'aftenmenu', 'a la carte',
      ' 3-retters', '4-retters', '5-retters', 'degustationsmenu',
      'hovedret', 'forretter', 'dessert', 'vin menu', 'sharing menu'
    ],
    bar: [
      'bar', 'drinks', 'cocktails', 'natteliv', 'happy hour',
      'vin', 'øl', 'spiritus', 'drinkskort', 'cocktailbar',
      'vinbar', 'ølbar', 'cocktail menu', 'barkort', 'aperitif'
    ],
    late_night: [
      'sen mad', 'natmad', 'efter midnat', 'late night',
      'småtspisning', 'bar menu', 'natmenu'
    ],
    afternoon_tea: [
      'afternoon tea', 'eftermiddagste', 'kage og kaffe',
      'te og kage', 'high tea'
    ]
  },
  
  // Swedish programme keywords
  sv: {
    morning: [
      'frukost', 'brunch', 'morgonmål', 'frukostbuffé',
      'croissant', 'ägg', 'yoghurt', 'gröt', 'smoothie bowl',
      'avokado toast', 'pannkakor', 'våfflo'
    ],
    fika: [
      // Swedish cultural institution - NOT just "coffee break"
      'fika', 'fikabröd', 'kanelbulle', 'kardemummabulle',
      'prinsesstårta', 'chokladboll', 'semla', 'kaffe och kaka',
      'fikastund', 'eftermiddagsfika', 'fikarast'
    ],
    lunch: [
      'lunch', 'middag', 'lunchmeny', 'dagens lunch', 'lunchrätter',
      'sallad', 'smörgås', 'soppa', 'dagens rätt', 'luncherbjudande',
      'snabb lunch', 'lunch to go'
    ],
    dinner: [
      'middag', 'kvällsmat', 'kvällsmeny', 'à la carte',
      '3-rätters', '4-rätters', '5-rätters', 'degustationsmeny',
      'huvudrätt', 'förrätter', 'efterrätt', 'vinmeny', 'sharing menu'
    ],
    bar: [
      'bar', 'drinkar', 'cocktails', 'nattliv', 'happy hour',
      'vin', 'öl', 'sprit', 'drinkmeny', 'cocktailbar',
      'vinbar', 'ölbar', 'cocktailmeny', 'barmeny', 'aperitif'
    ],
    late_night: [
      'sen mat', 'nattmat', 'efter midnatt', 'late night',
      'småätande', 'barmeny', 'nattmeny'
    ],
    afternoon_tea: [
      'afternoon tea', 'eftermiddagste', 'tebak',
      'te och kaka', 'high tea'
    ]
  },
  
  // German programme keywords
  de: {
    morning: [
      'Frühstück', 'Brunch', 'Frühstücksbuffet', 'Morgenessen',
      'Croissant', 'Brötchen', 'Müsli', 'Joghurt', 'Rührei',
      'Smoothie Bowl', 'Avocado Toast', 'Pfannkuchen', 'Waffeln'
    ],
    lunch: [
      'Mittagessen', 'Lunch', 'Mittagsmenü', 'Tagesgericht',
      'Salat', 'Sandwich', 'Suppe', 'Tagesangebot',
      'Business Lunch', 'Schnelles Mittagessen', 'Mittagstisch'
    ],
    dinner: [
      'Abendessen', 'Dinner', 'Abendmenü', 'à la carte',
      '3-Gang-Menü', '4-Gang-Menü', '5-Gang-Menü', 'Degustationsmenü',
      'Hauptgericht', 'Vorspeisen', 'Dessert', 'Weinmenü', 'Sharing Menu'
    ],
    bar: [
      'Bar', 'Drinks', 'Cocktails', 'Nachtleben', 'Happy Hour',
      'Wein', 'Bier', 'Spirituosen', 'Getränkekarte', 'Cocktailbar',
      'Weinbar', 'Bierbar', 'Cocktailkarte', 'Barkarte', 'Aperitif'
    ],
    late_night: [
      'Spätessen', 'Nachtessen', 'nach Mitternacht', 'Late Night',
      'Kleine Gerichte', 'Barkarte', 'Nachtmenü'
    ],
    afternoon_tea: [
      'Afternoon Tea', 'Nachmittagstee', 'Kaffee und Kuchen',
      'Tee und Kuchen', 'High Tea'
    ]
  },
  
  // Norwegian programme keywords
  no: {
    morning: [
      'frokost', 'brunch', 'morgenmåltid', 'frokostbuffet',
      'croissant', 'rundstykker', 'egg', 'yoghurt', 'havregrøt',
      'smoothie bowl', 'avokado toast', 'pannekaker', 'vafler'
    ],
    lunch: [
      'lunsj', 'middag', 'lunsjmeny', 'dagens lunsj', 'lunsj retter',
      'salat', 'smørbrød', 'suppe', 'dagens rett', 'lunsjitilbud',
      'rask lunsj', 'lunsj to go'
    ],
    dinner: [
      'middag', 'kveldsmat', 'kveldsmeny', 'à la carte',
      '3-retters', '4-retters', '5-retters', 'smaksmeny',
      'hovedrett', 'forretter', 'dessert', 'vinmeny', 'deling smeny'
    ],
    bar: [
      'bar', 'drinker', 'cocktails', 'nattliv', 'happy hour',
      'vin', 'øl', 'brennevin', 'drinkmeny', 'cocktailbar',
      'vinbar', 'ølbar', 'cocktailmeny', 'barmeny', 'aperitiff'
    ],
    late_night: [
      'sen mat', 'nattmat', 'etter midnatt', 'late night',
      'småretteer', 'barmeny', 'nattmeny'
    ],
    afternoon_tea: [
      'afternoon tea', 'ettermiddagste', 'kaffe og kake',
      'te og kake', 'high tea'
    ]
  },
  
  // Dutch programme keywords
  nl: {
    morning: [
      'ontbijt', 'brunch', 'ochtendmaal', 'ontbijtbuffet',
      'croissant', 'broodjes', 'ei', 'yoghurt', 'havermout',
      'smoothie bowl', 'avocado toast', 'pannenkoeken', 'wafels'
    ],
    lunch: [
      'lunch', 'middagmaal', 'lunchmenu', 'dagschotel',
      'salade', 'broodje', 'soep', 'dagaanbieding',
      'zakenlunch', 'snelle lunch', 'lunch to go'
    ],
    dinner: [
      'diner', 'avondmaal', 'avondmenu', 'à la carte',
      '3-gangen menu', '4-gangen menu', '5-gangen menu', 'proeverijmenu',
      'hoofdgerecht', 'voorgerechten', 'dessert', 'wijnmenu', 'sharing menu'
    ],
    bar: [
      'bar', 'drankjes', 'cocktails', 'nachtleven', 'happy hour',
      'wijn', 'bier', 'gedistilleerd', 'drankmenu', 'cocktailbar',
      'wijnbar', 'bierbar', 'cocktailmenu', 'barmenu', 'aperitief'
    ],
    late_night: [
      'laat eten', 'nachtvoeding', 'na middernacht', 'late night',
      'kleine gerechten', 'barmenu', 'nachtmenu'
    ],
    afternoon_tea: [
      'afternoon tea', 'middagthee', 'koffie en gebak',
      'thee en gebak', 'high tea'
    ]
  }
}

/**
 * Programme time windows by culture
 * 
 * Different cultures have different meal timing norms:
 * - Danish dinner: 18:00-21:00
 * - Spanish dinner: 21:00-23:00
 * - German Frühstück: 07:00-11:00
 * - Swedish fika: 10:00-11:00 & 14:00-15:00
 */
export const PROGRAMME_TIME_WINDOWS: Record<string, Record<string, { start: string; end: string }[]>> = {
  da: {
    morning: [{ start: '07:00', end: '12:00' }],
    lunch: [{ start: '11:00', end: '15:00' }],
    dinner: [{ start: '17:00', end: '22:00' }],
    bar: [{ start: '16:00', end: '02:00' }],
    late_night: [{ start: '22:00', end: '04:00' }],
    afternoon_tea: [{ start: '14:00', end: '17:00' }]
  },
  
  sv: {
    morning: [{ start: '07:00', end: '12:00' }],
    fika: [
      { start: '10:00', end: '11:00' },  // Morning fika
      { start: '14:00', end: '15:30' }   // Afternoon fika
    ],
    lunch: [{ start: '11:00', end: '15:00' }],
    dinner: [{ start: '17:00', end: '22:00' }],
    bar: [{ start: '16:00', end: '02:00' }],
    late_night: [{ start: '22:00', end: '04:00' }],
    afternoon_tea: [{ start: '14:00', end: '17:00' }]
  },
  
  de: {
    morning: [{ start: '06:30', end: '11:00' }],  // German breakfast starts earlier
    lunch: [{ start: '11:30', end: '14:30' }],
    dinner: [{ start: '18:00', end: '22:00' }],
    bar: [{ start: '17:00', end: '02:00' }],
    late_night: [{ start: '22:00', end: '04:00' }],
    afternoon_tea: [{ start: '14:00', end: '17:00' }]
  },
  
  no: {
    morning: [{ start: '07:00', end: '12:00' }],
    lunch: [{ start: '11:00', end: '15:00' }],
    dinner: [{ start: '16:00', end: '21:00' }],  // Norwegian dinner slightly earlier
    bar: [{ start: '16:00', end: '02:00' }],
    late_night: [{ start: '22:00', end: '04:00' }],
    afternoon_tea: [{ start: '14:00', end: '17:00' }]
  },
  
  nl: {
    morning: [{ start: '07:00', end: '11:30' }],
    lunch: [{ start: '12:00', end: '14:30' }],
    dinner: [{ start: '17:30', end: '21:30' }],
    bar: [{ start: '16:00', end: '02:00' }],
    late_night: [{ start: '22:00', end: '04:00' }],
    afternoon_tea: [{ start: '14:00', end: '17:00' }]
  }
}

/**
 * Detect programme type from text based on keywords
 * Returns array of detected programme types with confidence scores
 */
export function detectProgrammeTypes(
  text: string, 
  language: string = 'da'
): Array<{ type: string; confidence: number; matches: string[] }> {
  if (!text) return []
  
  const keywords = PROGRAMME_KEYWORDS[language]
  if (!keywords) return []
  
  const textLower = text.toLowerCase()
  const results: Array<{ type: string; confidence: number; matches: string[] }> = []
  
  for (const [programmeType, typeKeywords] of Object.entries(keywords)) {
    const matches = typeKeywords.filter(keyword => 
      textLower.includes(keyword.toLowerCase())
    )
    
    if (matches.length > 0) {
      // Confidence based on number of matches and keyword specificity
      const confidence = Math.min(
        0.5 + (matches.length * 0.1),  // Base 0.5, +0.1 per match
        1.0
      )
      
      results.push({
        type: programmeType,
        confidence,
        matches
      })
    }
  }
  
  // Sort by confidence descending
  return results.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Get programme keywords for a specific type and language
 * Useful for validating menu items or generating content
 */
export function getProgrammeKeywords(
  programmeType: string, 
  language: string = 'da'
): string[] {
  const keywords = PROGRAMME_KEYWORDS[language]
  if (!keywords) return []
  
  return keywords[programmeType] || []
}

/**
 * Get culturally-appropriate time window for programme type
 * Returns null if programme type doesn't exist in language
 */
export function getProgrammeTimeWindows(
  programmeType: string,
  language: string = 'da'
): Array<{ start: string; end: string }> | null {
  const timeWindows = PROGRAMME_TIME_WINDOWS[language]
  if (!timeWindows) return null
  
  return timeWindows[programmeType] || null
}

/**
 * Check if a programme type is culturally relevant for a language/market
 * E.g., "fika" only exists in Swedish culture
 */
export function isProgrammeCulturallyRelevant(
  programmeType: string,
  language: string = 'da'
): boolean {
  const keywords = PROGRAMME_KEYWORDS[language]
  if (!keywords) return false
  
  return programmeType in keywords
}

/**
 * Get all available programme types for a language
 */
export function getAvailableProgrammeTypes(language: string = 'da'): string[] {
  const keywords = PROGRAMME_KEYWORDS[language]
  if (!keywords) return []
  
  return Object.keys(keywords)
}
