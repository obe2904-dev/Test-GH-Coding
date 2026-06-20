/**
 * Locale System with Regional & City-Level Variations
 * 
 * Supports multi-language with specific regional and city customizations
 */

export interface LocaleConfig {
  code: string                    // e.g., 'da-DK-aarhus', 'de-DE-munich'
  language: string                // ISO 639-1 code: 'da', 'de', 'en'
  country: string                 // ISO 3166-1 alpha-2: 'DK', 'DE', 'US'
  region?: string                 // Optional region: 'bavaria', 'jutland'
  city?: string                   // Optional city: 'munich', 'hamburg', 'aarhus'
  name: string                    // Display name
  nativeName: string              // Native language name
  fallbackLocale?: string         // Fallback if translation missing
  
  // Formatting
  currency: string
  dateFormat: string
  numberFormat: {
    decimal: string
    thousands: string
  }
  
  // Content customization
  venueTypes: Record<string, string>  // Map database vertical to locale name
  bannedWords: string[]               // Generic words to avoid
  preferredPhrasing: Record<string, string> // Locale-specific phrasing
  
  // Cultural context
  formalityLevel: 'formal' | 'informal' | 'mixed'
  ctaStyle: 'imperative' | 'polite' | 'casual'
  
  // Regional specifics
  regionalContext?: {
    landmarks?: string[]            // Famous landmarks for context
    culturalNotes?: string[]        // Cultural considerations
    dialects?: string[]             // Dialect variations
  }
}

export const LOCALES: Record<string, LocaleConfig> = {
  // ============================================================================
  // DANISH
  // ============================================================================
  'da-DK': {
    code: 'da-DK',
    language: 'da',
    country: 'DK',
    name: 'Danish (Denmark)',
    nativeName: 'Dansk',
    currency: 'DKK',
    dateFormat: 'DD-MM-YYYY',
    numberFormat: { decimal: ',', thousands: '.' },
    venueTypes: {
      hospitality: 'Café',
      food_service: 'Restaurant',
      cafe: 'Café',
      restaurant: 'Restaurant',
      bar: 'Bar',
      bistro: 'Bistro'
    },
    bannedWords: ['bedste', 'lokale', 'gæster', 'unik', 'fantastisk', 'dejlig', 'hyggelig'],
    preferredPhrasing: {
      cta_book: 'BOOK DIT BORD',
      cta_order: 'BESTIL NU',
      cta_menu: 'SE MENU',
      location_waterfront: 'ved åen',  // Specific Danish waterfront - "vandet" only for open sea
      location_transit: 'ved stationen'
    },
    formalityLevel: 'informal',
    ctaStyle: 'imperative'
  },
  
  'da-DK-aarhus': {
    code: 'da-DK-aarhus',
    language: 'da',
    country: 'DK',
    city: 'aarhus',
    name: 'Danish (Aarhus)',
    nativeName: 'Dansk (Aarhus)',
    fallbackLocale: 'da-DK',
    currency: 'DKK',
    dateFormat: 'DD-MM-YYYY',
    numberFormat: { decimal: ',', thousands: '.' },
    venueTypes: {
      hospitality: 'Café',
      food_service: 'Restaurant',
      cafe: 'Café',
      restaurant: 'Restaurant',
      bar: 'Bar',
      bistro: 'Bistro'
    },
    bannedWords: ['bedste', 'lokale', 'gæster', 'unik', 'fantastisk', 'dejlig'],
    preferredPhrasing: {
      cta_book: 'BOOK DIT BORD',
      location_waterfront: 'ved åen',
      location_city: 'i Aarhus'
    },
    formalityLevel: 'informal',
    ctaStyle: 'imperative',
    regionalContext: {
      landmarks: ['Åen', 'Den Gamle By', 'ARoS', 'Musikhuset', 'Latinerkvarteret'],
      culturalNotes: ['Student city', 'Design capital', 'Food culture']
    }
  },
  
  'da-DK-copenhagen': {
    code: 'da-DK-copenhagen',
    language: 'da',
    country: 'DK',
    city: 'copenhagen',
    name: 'Danish (Copenhagen)',
    nativeName: 'Dansk (København)',
    fallbackLocale: 'da-DK',
    currency: 'DKK',
    dateFormat: 'DD-MM-YYYY',
    numberFormat: { decimal: ',', thousands: '.' },
    venueTypes: {
      hospitality: 'Café',
      food_service: 'Restaurant',
      cafe: 'Café',
      restaurant: 'Restaurant',
      bar: 'Bar',
      bistro: 'Bistro'
    },
    bannedWords: ['bedste', 'lokale', 'gæster', 'unik', 'fantastisk', 'dejlig'],
    preferredPhrasing: {
      cta_book: 'BOOK BORD',
      location_waterfront: 'ved havnen',
      location_city: 'i København'
    },
    formalityLevel: 'mixed',
    ctaStyle: 'imperative',
    regionalContext: {
      landmarks: ['Nyhavn', 'Tivoli', 'Strøget', 'Christiansborg', 'Vesterbro'],
      culturalNotes: ['Capital city', 'International audience', 'New Nordic cuisine']
    }
  },
  
  // ============================================================================
  // GERMAN
  // ============================================================================
  'de-DE': {
    code: 'de-DE',
    language: 'de',
    country: 'DE',
    name: 'German (Germany)',
    nativeName: 'Deutsch',
    currency: 'EUR',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: { decimal: ',', thousands: '.' },
    venueTypes: {
      hospitality: 'Café',
      food_service: 'Restaurant',
      cafe: 'Café',
      restaurant: 'Restaurant',
      bar: 'Bar',
      bistro: 'Bistro'
    },
    bannedWords: ['beste', 'einzigartig', 'perfekt', 'traumhaft'],
    preferredPhrasing: {
      cta_book: 'TISCH RESERVIEREN',
      cta_order: 'JETZT BESTELLEN'
    },
    formalityLevel: 'formal',
    ctaStyle: 'polite'
  },
  
  'de-DE-munich': {
    code: 'de-DE-munich',
    language: 'de',
    country: 'DE',
    region: 'bavaria',
    city: 'munich',
    name: 'German (Munich)',
    nativeName: 'Deutsch (München)',
    fallbackLocale: 'de-DE',
    currency: 'EUR',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: { decimal: ',', thousands: '.' },
    venueTypes: {
      hospitality: 'Café',
      food_service: 'Restaurant',
      cafe: 'Café',
      restaurant: 'Restaurant',
      bar: 'Bar',
      bistro: 'Wirtshaus'  // Regional variant
    },
    bannedWords: ['beste', 'einzigartig', 'perfekt'],
    preferredPhrasing: {
      cta_book: 'TISCH RESERVIEREN',
      location_city: 'in München',
      regional_greeting: 'Grüß Gott'
    },
    formalityLevel: 'formal',
    ctaStyle: 'polite',
    regionalContext: {
      landmarks: ['Marienplatz', 'Englischer Garten', 'Viktualienmarkt', 'Isar'],
      culturalNotes: ['Beer garden culture', 'Traditional Bavarian cuisine', 'Oktoberfest'],
      dialects: ['Bavarian']
    }
  },
  
  'de-DE-hamburg': {
    code: 'de-DE-hamburg',
    language: 'de',
    country: 'DE',
    city: 'hamburg',
    name: 'German (Hamburg)',
    nativeName: 'Deutsch (Hamburg)',
    fallbackLocale: 'de-DE',
    currency: 'EUR',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: { decimal: ',', thousands: '.' },
    venueTypes: {
      hospitality: 'Café',
      food_service: 'Restaurant',
      cafe: 'Café',
      restaurant: 'Restaurant',
      bar: 'Bar',
      bistro: 'Bistro'
    },
    bannedWords: ['beste', 'einzigartig', 'perfekt'],
    preferredPhrasing: {
      cta_book: 'TISCH RESERVIEREN',
      location_waterfront: 'an der Elbe',
      location_city: 'in Hamburg',
      regional_greeting: 'Moin'
    },
    formalityLevel: 'informal',
    ctaStyle: 'casual',
    regionalContext: {
      landmarks: ['Hafen', 'Speicherstadt', 'Reeperbahn', 'Alster', 'Elbphilharmonie'],
      culturalNotes: ['Port city culture', 'Fish market', 'International maritime influence'],
      dialects: ['Low German']
    }
  },
  
  'de-DE-berlin': {
    code: 'de-DE-berlin',
    language: 'de',
    country: 'DE',
    city: 'berlin',
    name: 'German (Berlin)',
    nativeName: 'Deutsch (Berlin)',
    fallbackLocale: 'de-DE',
    currency: 'EUR',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: { decimal: ',', thousands: '.' },
    venueTypes: {
      hospitality: 'Café',
      food_service: 'Restaurant',
      cafe: 'Café',
      restaurant: 'Restaurant',
      bar: 'Bar',
      bistro: 'Bistro'
    },
    bannedWords: ['beste', 'einzigartig', 'perfekt'],
    preferredPhrasing: {
      cta_book: 'TISCH RESERVIEREN',
      location_city: 'in Berlin'
    },
    formalityLevel: 'informal',
    ctaStyle: 'casual',
    regionalContext: {
      landmarks: ['Brandenburger Tor', 'Alexanderplatz', 'Kreuzberg', 'Prenzlauer Berg'],
      culturalNotes: ['Multicultural', 'Street food scene', 'Club culture', 'Späti culture'],
      dialects: ['Berlin dialect']
    }
  },
  
  // ============================================================================
  // ENGLISH
  // ============================================================================
  'en-US': {
    code: 'en-US',
    language: 'en',
    country: 'US',
    name: 'English (United States)',
    nativeName: 'English',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    numberFormat: { decimal: '.', thousands: ',' },
    venueTypes: {
      hospitality: 'Café',
      food_service: 'Restaurant',
      cafe: 'Café',
      restaurant: 'Restaurant',
      bar: 'Bar',
      bistro: 'Bistro'
    },
    bannedWords: ['best', 'unique', 'perfect', 'amazing', 'incredible'],
    preferredPhrasing: {
      cta_book: 'RESERVE TABLE',
      cta_order: 'ORDER NOW'
    },
    formalityLevel: 'informal',
    ctaStyle: 'casual'
  },
  
  'en-GB': {
    code: 'en-GB',
    language: 'en',
    country: 'GB',
    name: 'English (United Kingdom)',
    nativeName: 'English',
    currency: 'GBP',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: '.', thousands: ',' },
    venueTypes: {
      hospitality: 'Café',
      food_service: 'Restaurant',
      cafe: 'Café',
      restaurant: 'Restaurant',
      bar: 'Pub',
      bistro: 'Bistro'
    },
    bannedWords: ['best', 'unique', 'perfect', 'amazing'],
    preferredPhrasing: {
      cta_book: 'BOOK TABLE',
      cta_order: 'ORDER NOW'
    },
    formalityLevel: 'mixed',
    ctaStyle: 'polite'
  }
}

/**
 * Maps country names to ISO 3166-1 alpha-2 codes
 */
function normalizeCountryCode(country?: string): string | undefined {
  if (!country) return undefined
  
  const upperCountry = country.toUpperCase()
  
  // Already ISO code
  if (upperCountry.length === 2) return upperCountry
  
  // Map common country names to ISO codes
  const countryMap: Record<string, string> = {
    'DANMARK': 'DK',
    'DENMARK': 'DK',
    'GERMANY': 'DE',
    'DEUTSCHLAND': 'DE',
    'UNITED STATES': 'US',
    'USA': 'US',
    'UNITED KINGDOM': 'GB',
    'UK': 'GB'
  }
  
  return countryMap[upperCountry] || upperCountry
}

/**
 * Resolves the best matching locale based on business data
 */
export function resolveLocale(
  country?: string,
  city?: string,
  language?: string
): LocaleConfig {
  // Normalize inputs
  const countryCode = normalizeCountryCode(country)
  const cityNorm = city?.toLowerCase().replace(/\s+/g, '-')
  const langCode = language?.toLowerCase()
  
  // Try city-level match first
  if (countryCode && cityNorm) {
    const cityLocaleCode = `${langCode || 'en'}-${countryCode}-${cityNorm}`
    if (LOCALES[cityLocaleCode]) {
      return LOCALES[cityLocaleCode]
    }
  }
  
  // Try country-level match
  if (langCode && countryCode) {
    const countryLocaleCode = `${langCode}-${countryCode}`
    if (LOCALES[countryLocaleCode]) {
      return LOCALES[countryLocaleCode]
    }
  }
  
  // Try language-only match
  if (langCode) {
    const match = Object.values(LOCALES).find(l => l.language === langCode && !l.city)
    if (match) return match
  }
  
  // Fallback to Danish
  return LOCALES['da-DK']
}

/**
 * Get translation with fallback chain
 */
export function getTranslation(
  locale: LocaleConfig,
  key: string,
  fallback: string
): string {
  // Try locale-specific
  if (locale.preferredPhrasing[key]) {
    return locale.preferredPhrasing[key]
  }
  
  // Try fallback locale
  if (locale.fallbackLocale) {
    const fallbackLocale = LOCALES[locale.fallbackLocale]
    if (fallbackLocale?.preferredPhrasing[key]) {
      return fallbackLocale.preferredPhrasing[key]
    }
  }
  
  // Return default
  return fallback
}
