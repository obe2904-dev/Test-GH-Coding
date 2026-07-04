/**
 * Multi-language location pattern library
 * 
 * Maintains authentic location terminology across languages without translation loops.
 * Prevents genericization like "ved vandet" → "ved åen" or "river" → "floden".
 * 
 * Usage:
 * - detectWaterProximity(text, language): Find water-specific terms in business descriptions
 * - detectLandmarks(text, language): Identify well-known location references
 * 
 * Priority order for detection:
 * 1. Business short_description
 * 2. Business long_description
 * 3. Menu item descriptions (first 30)
 * 4. Location intelligence data (fallback)
 */

/**
 * Water proximity patterns by language
 * 
 * Danish examples: "ved åen" (Cafe Faust), "ved havnen" (Nyhavn), "ved stranden"
 * Swedish examples: "vid ån", "vid havet", "vid sjön"
 * German examples: "am Fluss", "am Meer", "am See"
 * Norwegian examples: "ved elva", "ved fjorden", "ved sjøen"
 * Dutch examples: "aan het water", "bij de gracht", "bij de haven"
 */
export const WATER_PATTERNS: Record<string, RegExp> = {
  // Danish water terms - SPECIFIC terms only (no generic "vandet")
  da: /\bved\s+(åen|bugten|havet|søen|fjorden|kanalen|havnen|stranden|kysten|vigen|broen|kajen)\b/i,
  
  // Swedish water terms
  sv: /\bvid\s+(ån|havet|sjön|viken|stranden|kanalen|hamnen|kusten|fjorden|bron|kajen)\b/i,
  
  // German water terms
  de: /\bam\s+(Fluss|Meer|See|Kanal|Hafen|Strand|Bach|Fjord|Ufer|Brücke)\b/i,
  
  // Norwegian water terms
  no: /\bved\s+(elva|fjorden|sjøen|havet|stranden|kanalen|havna|kysten|vika|brua|kaia)\b/i,
  
  // Dutch water terms
  nl: /\b(aan het water|bij de gracht|bij de haven|aan de rivier|aan het meer|bij het kanaal|aan de kust|bij het strand)\b/i
}

/**
 * Extract water proximity term from text
 * Returns the actual term used (e.g., "åen", "havnen") or null
 */
export function detectWaterProximity(text: string, language: string = 'da'): string | null {
  if (!text) return null
  
  const pattern = WATER_PATTERNS[language]
  if (!pattern) return null
  
  const match = text.match(pattern)
  if (!match) return null
  
  // For Danish, Swedish, Norwegian, German - capture group 1 is the water term
  if (language === 'da' || language === 'sv' || language === 'de' || language === 'no') {
    return match[1] || null
  }
  
  // For Dutch - return the full phrase
  if (language === 'nl') {
    return match[0] || null
  }
  
  return null
}

/**
 * Well-known landmarks and neighborhoods by city/country
 * 
 * Used for detecting location-specific references that should be preserved.
 * These terms should NEVER be translated or genericized.
 * 
 * Structure: language → [landmark/neighborhood names]
 */
export const LANDMARK_PATTERNS: Record<string, string[]> = {
  // Danish landmarks (Copenhagen-focused for launch)
  da: [
    // Copenhagen neighborhoods
    'Nyhavn', 'Indre By', 'Vesterbro', 'Nørrebro', 'Frederiksberg', 
    'Christianshavn', 'Østerbro', 'Amager', 'Sydhavnen', 'Nordhavnen',
    'Islands Brygge', 'Kødbyen', 'Vestergade', 'Strøget',
    
    // Copenhagen landmarks
    'Tivoli', 'Rådhuspladsen', 'Kongens Nytorv', 'Amalienborg',
    'Christiansborg', 'Rundetårn', 'Den Lille Havfrue', 'Kastellet',
    
    // Aarhus
    'Latinerkvarteret', 'Frederiksbjerg', 'Trøjborg', 'Åboulevarden',
    
    // Odense
    'Vintapperstræde', 'Brandts Passage',
    
    // Aalborg
    'Jomfru Ane Gade'
  ],
  
  // Swedish landmarks (Stockholm-focused for future expansion)
  sv: [
    // Stockholm neighborhoods
    'Gamla Stan', 'Södermalm', 'Norrmalm', 'Vasastan', 'Östermalm',
    'Kungsholmen', 'Djurgården', 'Hammarby Sjöstad',
    
    // Stockholm landmarks
    'Stortorget', 'Kungliga Slottet', 'Stadshuset', 'Skansen',
    'Fotografiska', 'Gröna Lund',
    
    // Gothenburg
    'Haga', 'Linné', 'Majorna', 'Avenyn'
  ],
  
  // German landmarks (Berlin-focused for future expansion)
  de: [
    // Berlin neighborhoods
    'Mitte', 'Prenzlauer Berg', 'Kreuzberg', 'Friedrichshain',
    'Charlottenburg', 'Neukölln', 'Schöneberg',
    
    // Berlin landmarks
    'Brandenburger Tor', 'Alexanderplatz', 'Potsdamer Platz',
    'Reichstag', 'Hackescher Markt', 'Unter den Linden',
    
    // Munich
    'Schwabing', 'Maxvorstadt', 'Glockenbachviertel', 'Marienplatz'
  ],
  
  // Norwegian landmarks (Oslo-focused for future expansion)
  no: [
    // Oslo neighborhoods
    'Grünerløkka', 'Sentrum', 'Frogner', 'Majorstuen', 'Grønland',
    'Aker Brygge', 'Tjuvholmen',
    
    // Oslo landmarks
    'Karl Johans gate', 'Operaen', 'Vigelandsparken', 'Akershus festning',
    
    // Bergen
    'Bryggen', 'Nordnes', 'Sandviken'
  ],
  
  // Dutch landmarks (Amsterdam-focused for future expansion)
  nl: [
    // Amsterdam neighborhoods
    'De Pijp', 'Jordaan', 'De Wallen', 'Centrum', 'Oud-West',
    'Oud-Zuid', 'Plantage', 'Oost',
    
    // Amsterdam landmarks
    'Dam', 'Leidseplein', 'Museumplein', 'Vondelpark',
    'Anne Frank Huis', 'Rijksmuseum',
    
    // Rotterdam
    'Katendrecht', 'Kralingen', 'Blaak'
  ]
}

/**
 * Detect landmark references in text
 * Returns array of detected landmarks (case-insensitive match)
 */
export function detectLandmarks(text: string, language: string = 'da'): string[] {
  if (!text) return []
  
  const landmarks = LANDMARK_PATTERNS[language]
  if (!landmarks) return []
  
  const textLower = text.toLowerCase()
  return landmarks.filter(landmark => 
    textLower.includes(landmark.toLowerCase())
  )
}

/**
 * Area type classification patterns
 * Used to detect neighborhood character from business descriptions
 */
export const AREA_TYPE_KEYWORDS: Record<string, Record<string, string[]>> = {
  da: {
    historic: ['historisk', 'gamle', 'middelalder', 'renæssance', 'fredede', 'brostensbelagt', 'brosten'],
    waterfront: ['ved åen', 'ved havnen', 'ved stranden', 'ved vandet', 'ved søen', 'ved kanalen', 'kanalfront', 'havnefront'],
    commercial: ['handelsgade', 'forretningskvarter', 'shoppingområde', 'indkøbsstrøg', 'forretningsdistrikt'],
    cultural: ['kulturkvarter', 'kunstnerkvarter', 'boheme', 'kreativ', 'gallerier', 'museer', 'teatre'],
    residential: ['beboelseskvarter', 'villakvarter', 'lejlighedsområde', 'roligt område', 'familieven ligt'],
    nightlife: ['natteliv', 'barer', 'restauranter', 'cafeer', 'udeliv', 'festgade'],
    tourist: ['turistområde', 'seværdigheder', 'attraktioner', 'turistmål', 'populært']
  },
  
  sv: {
    historic: ['historisk', 'gamla', 'medeltida', 'renässans', 'skyddad', 'kullerstensbelagd'],
    waterfront: ['vid ån', 'vid hamnen', 'vid stranden', 'vid vattnet', 'vid sjön', 'vid kanalen'],
    commercial: ['handelsgata', 'affärskvarter', 'shoppingområde', 'köpcentrum'],
    cultural: ['kulturkvarter', 'konstnärskvarter', 'bohemisk', 'kreativ', 'gallerier', 'museer'],
    residential: ['bostadsområde', 'villaområde', 'lugnt område', 'familjevänligt'],
    nightlife: ['nattliv', 'barer', 'restauranger', 'caféer', 'uteliv'],
    tourist: ['turistområde', 'sevärdheter', 'attraktioner', 'populärt']
  },
  
  de: {
    historic: ['historisch', 'altstadt', 'mittelalter', 'renaissance', 'denkmalgeschützt', 'kopfsteinpflaster'],
    waterfront: ['am Fluss', 'am Hafen', 'am Strand', 'am Wasser', 'am See', 'am Kanal'],
    commercial: ['einkaufsstraße', 'geschäftsviertel', 'einkaufsviertel', 'shoppingmeile'],
    cultural: ['kulturviertel', 'künstlerviertel', 'boheme', 'kreativ', 'galerien', 'museen'],
    residential: ['wohngebiet', 'villenviertel', 'ruhige Gegend', 'familienfreundlich'],
    nightlife: ['nachtleben', 'bars', 'restaurants', 'cafés', 'ausgehleben'],
    tourist: ['touristengebiet', 'sehenswürdigkeiten', 'attraktionen', 'beliebt']
  },
  
  no: {
    historic: ['historisk', 'gamlebyen', 'middelalder', 'renessanse', 'fredede', 'brosteinsbelagt'],
    waterfront: ['ved elva', 'ved havna', 'ved stranden', 'ved vannet', 'ved sjøen', 'ved kanalen'],
    commercial: ['handlegate', 'forretningskvarter', 'handleområde', 'kjøpesenter'],
    cultural: ['kulturkvarter', 'kunstnerkvarter', 'bohemsk', 'kreativ', 'gallerier', 'museer'],
    residential: ['boligområde', 'villaområde', 'rolig område', 'familievennlig'],
    nightlife: ['nattliv', 'barer', 'restauranter', 'kaféer', 'uteliv'],
    tourist: ['turistområde', 'severdig heter', 'attraksjoner', 'populært']
  },
  
  nl: {
    historic: ['historisch', 'oude stad', 'middeleeuws', 'renaissance', 'beschermd', 'met kasseien'],
    waterfront: ['aan het water', 'bij de haven', 'bij het strand', 'aan de gracht', 'aan het meer'],
    commercial: ['winkelstraat', 'zakendistrict', 'winkelgebied', 'winkelcentrum'],
    cultural: ['culturele wijk', 'kunstenaarswijk', 'bohemien', 'creatief', 'galerieën', 'musea'],
    residential: ['woonwijk', 'villabuurt', 'rustige buurt', 'gezinsvriendelijk'],
    nightlife: ['nachtleven', 'bars', 'restaurants', 'cafés', 'uitgaansleven'],
    tourist: ['toeristengebied', 'bezienswaardigheden', 'attracties', 'populair']
  }
}

/**
 * Detect area type from text based on keywords
 * Returns primary area type or 'mixed' if multiple types detected
 */
export function detectAreaType(text: string, language: string = 'da'): string | null {
  if (!text) return null
  
  const keywords = AREA_TYPE_KEYWORDS[language]
  if (!keywords) return null
  
  const textLower = text.toLowerCase()
  const detectedTypes: string[] = []
  
  for (const [areaType, typeKeywords] of Object.entries(keywords)) {
    const hasKeyword = typeKeywords.some(keyword => 
      textLower.includes(keyword.toLowerCase())
    )
    if (hasKeyword) {
      detectedTypes.push(areaType)
    }
  }
  
  if (detectedTypes.length === 0) return null
  if (detectedTypes.length === 1) return detectedTypes[0]
  return 'mixed'
}
