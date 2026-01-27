/**
 * Location Enrichment Module
 * 
 * Deterministic computation of LocationEnrichment from business location data.
 * No external API dependencies - works with address/city/country only.
 * 
 * @module location-enrichment
 */

import type { LocationEnrichment } from '../types/location-enrichment.ts'

/**
 * Input data for location enrichment
 */
export interface LocationInput {
  address_line1?: string | null
  address_line2?: string | null
  city: string
  postal_code?: string | null
  country?: string | null
  // Optional coordinates (if available from onboarding or geocoding)
  latitude?: number | null
  longitude?: number | null
}

/**
 * City tier classification for supported countries
 */
const CITY_TIERS = {
  // Denmark
  DK: {
    capital: ['København', 'Copenhagen'],
    major_city: ['Aarhus', 'Odense', 'Aalborg'],
    mid_city: [
      'Esbjerg', 'Randers', 'Kolding', 'Horsens', 'Vejle',
      'Roskilde', 'Herning', 'Silkeborg', 'Næstved', 'Fredericia'
    ]
  },
  // Germany
  DE: {
    capital: ['Berlin'],
    major_city: ['Hamburg', 'München', 'Munich', 'Köln', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen'],
    mid_city: [
      'Leipzig', 'Bremen', 'Dresden', 'Hannover', 'Nürnberg', 'Nuremberg',
      'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster', 'Karlsruhe'
    ]
  },
  // Sweden
  SE: {
    capital: ['Stockholm'],
    major_city: ['Göteborg', 'Gothenburg', 'Malmö', 'Malmo', 'Uppsala'],
    mid_city: [
      'Västerås', 'Örebro', 'Linköping', 'Helsingborg', 'Jönköping',
      'Norrköping', 'Lund', 'Umeå', 'Gävle', 'Borås'
    ]
  }
} as const

/**
 * Waterfront indicators (lakes, rivers, harbors, coasts)
 */
const WATERFRONT_KEYWORDS = {
  DK: ['å', 'åen', 'havn', 'havnen', 'kanal', 'kanalen', 'fjord', 'strand', 'sø', 'søen'],
  DE: ['fluss', 'hafen', 'kanal', 'see', 'ufer', 'strand', 'bucht'],
  SE: ['å', 'ån', 'hamn', 'hamnen', 'kanal', 'kanalen', 'fjord', 'strand', 'sjö', 'sjön'],
  EN: ['river', 'harbor', 'harbour', 'canal', 'waterfront', 'bay', 'marina', 'wharf', 'pier', 'dock']
}

/**
 * Transit hub indicators (train stations, bus terminals)
 */
const TRANSIT_KEYWORDS = {
  DK: ['Station', 'station', 'Banegård', 'banegård', 'Hovedbanen', 'Buspladsen'],
  DE: ['Bahnhof', 'Hauptbahnhof', 'Hbf', 'Station', 'Busbahnhof'],
  SE: ['Station', 'station', 'Centralstation', 'Järnvägsstation', 'Busstation'],
  EN: ['Station', 'station', 'Terminal', 'terminal', 'Depot', 'depot']
}

/**
 * Shopping district indicators
 */
const SHOPPING_KEYWORDS = {
  DK: ['Torv', 'torv', 'Strøget', 'strøget', 'Gågade', 'gågade', 'Center', 'center', 'Shopping', 'Mall'],
  DE: ['Platz', 'Markt', 'Zentrum', 'Einkaufszentrum', 'Mall', 'Shopping'],
  SE: ['Torg', 'torg', 'Köpcentrum', 'Galleria', 'galleria', 'Centrum'],
  EN: ['Square', 'square', 'Plaza', 'Mall', 'Shopping', 'Center', 'Centre', 'Market']
}

/**
 * Tourist area indicators
 */
const TOURIST_KEYWORDS = {
  DK: ['Nyhavn', 'nyhavn', 'Rådhus', 'Rådhuspladsen', 'Tivoli'],
  DE: ['Altstadt', 'Marienplatz', 'Alexanderplatz', 'Brandenburger Tor'],
  SE: ['Gamla Stan', 'Stortorget', 'Kungliga', 'Slottet'],
  EN: ['Old Town', 'Historic', 'Cathedral', 'Museum', 'Palace']
}

/**
 * Campus/university indicators
 */
const CAMPUS_KEYWORDS = {
  DK: ['Universitet', 'universitet', 'Campus', 'campus', 'Uni', 'uni', 'Højskole'],
  DE: ['Universität', 'Uni', 'Campus', 'Hochschule'],
  SE: ['Universitet', 'universitet', 'Campus', 'campus', 'Uni', 'Högskola'],
  EN: ['University', 'university', 'Campus', 'campus', 'College', 'college']
}

/**
 * Business district indicators
 */
const BUSINESS_KEYWORDS = {
  DK: ['Vesterbro', 'Østerbro', 'Business', 'Erhverv', 'Kontor'],
  DE: ['Geschäftsviertel', 'Business', 'Büro', 'Finanz'],
  SE: ['Affärsområde', 'Business', 'Kontor', 'Centrum'],
  EN: ['Business', 'business', 'Financial', 'Corporate', 'Office', 'Downtown']
}

/**
 * Classify city tier based on city name and country
 */
export function classifyCityTier(
  city: string,
  country: string = 'Denmark'
): LocationEnrichment['macro']['city_tier'] {
  // Normalize country code
  const countryCode = normalizeCountryCode(country)
  const normalizedCity = city.trim()
  
  const tiers = CITY_TIERS[countryCode as keyof typeof CITY_TIERS]
  if (!tiers) {
    // Unknown country - assume mid_city as safe default
    return 'mid_city'
  }

  // Check capital
  if (tiers.capital.some(c => normalizedCity.toLowerCase() === c.toLowerCase())) {
    return 'capital'
  }

  // Check major cities
  if (tiers.major_city.some(c => normalizedCity.toLowerCase() === c.toLowerCase())) {
    return 'major_city'
  }

  // Check mid-tier cities
  if (tiers.mid_city.some(c => normalizedCity.toLowerCase() === c.toLowerCase())) {
    return 'mid_city'
  }

  // Default: small_town (conservative guess for unlisted cities)
  return 'small_town'
}

/**
 * Normalize country name to ISO-2 code
 */
function normalizeCountryCode(country: string): string {
  const normalized = country.toLowerCase().trim()
  
  // Danish variants
  if (normalized === 'denmark' || normalized === 'danmark' || normalized === 'dk') {
    return 'DK'
  }
  
  // German variants
  if (normalized === 'germany' || normalized === 'deutschland' || normalized === 'de') {
    return 'DE'
  }
  
  // Swedish variants
  if (normalized === 'sweden' || normalized === 'sverige' || normalized === 'se') {
    return 'SE'
  }

  // Default fallback
  return 'DK'
}

/**
 * Detect area type from address and city context
 * Uses word boundaries to avoid false matches
 */
function detectAreaType(
  address: string,
  city: string,
  country: string
): { type: LocationEnrichment['micro']['area_type']; signals: string[] } {
  const countryCode = normalizeCountryCode(country)
  const fullText = `${address} ${city}`.toLowerCase()
  const signals: string[] = []

  // Helper to match keywords with word boundaries
  const matchesKeyword = (text: string, keyword: string): boolean => {
    const lowerKeyword = keyword.toLowerCase()
    
    // Special handling for very short keywords like "å" - they need to be at word start
    // e.g., "Åboulevarden" matches, but "Banegård" (contains "å" in middle) doesn't
    if (lowerKeyword.length <= 2) {
      // Match at word boundary or start of text
      const regexStart = new RegExp(`(^|\\s)${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
      return regexStart.test(text)
    }
    
    // For longer keywords, use word boundary matching
    const regex = new RegExp(`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
    return regex.test(text)
  }

  // Priority order: Transit > Tourist > Shopping > Waterfront > Campus > Business
  // This ensures specific landmarks/features override general waterfront detection

  // Check transit hub (high priority - specific station names)
  const transitKeywords = [
    ...TRANSIT_KEYWORDS[countryCode as keyof typeof TRANSIT_KEYWORDS] || [],
    ...TRANSIT_KEYWORDS.EN
  ]
  const transitMatch = transitKeywords.find(kw => matchesKeyword(fullText, kw))
  if (transitMatch) {
    signals.push(`near transit (${transitMatch})`)
    return { type: 'transit_hub', signals }
  }

  // Check tourist zone (specific landmarks)
  const touristKeywords = [
    ...TOURIST_KEYWORDS[countryCode as keyof typeof TOURIST_KEYWORDS] || [],
    ...TOURIST_KEYWORDS.EN
  ]
  const touristMatch = touristKeywords.find(kw => matchesKeyword(fullText, kw))
  if (touristMatch) {
    signals.push(`tourist area (${touristMatch})`)
    return { type: 'tourist_zone', signals }
  }

  // Check shopping district
  const shoppingKeywords = [
    ...SHOPPING_KEYWORDS[countryCode as keyof typeof SHOPPING_KEYWORDS] || [],
    ...SHOPPING_KEYWORDS.EN
  ]
  const shoppingMatch = shoppingKeywords.find(kw => matchesKeyword(fullText, kw))
  if (shoppingMatch) {
    signals.push(`shopping area (${shoppingMatch})`)
    return { type: 'shopping_street', signals }
  }

  // Check waterfront (can be broader, but after specific matches)
  const waterfrontKeywords = [
    ...WATERFRONT_KEYWORDS[countryCode as keyof typeof WATERFRONT_KEYWORDS] || [],
    ...WATERFRONT_KEYWORDS.EN
  ]
  const waterfrontMatch = waterfrontKeywords.find(kw => matchesKeyword(fullText, kw))
  if (waterfrontMatch) {
    signals.push(`waterfront (${waterfrontMatch})`)
    return { type: 'waterfront', signals }
  }

  // Check campus
  const campusKeywords = [
    ...CAMPUS_KEYWORDS[countryCode as keyof typeof CAMPUS_KEYWORDS] || [],
    ...CAMPUS_KEYWORDS.EN
  ]
  const campusMatch = campusKeywords.find(kw => matchesKeyword(fullText, kw))
  if (campusMatch) {
    signals.push(`campus area (${campusMatch})`)
    return { type: 'campus', signals }
  }

  // Check business district
  const businessKeywords = [
    ...BUSINESS_KEYWORDS[countryCode as keyof typeof BUSINESS_KEYWORDS] || [],
    ...BUSINESS_KEYWORDS.EN
  ]
  const businessMatch = businessKeywords.find(kw => matchesKeyword(fullText, kw))
  if (businessMatch) {
    signals.push(`business district (${businessMatch})`)
    return { type: 'business_district', signals }
  }

  // Default: unknown (no clear signals)
  signals.push('no distinctive area markers')
  return { type: 'unknown', signals }
}

/**
 * Extract nearby signals from location context
 */
function extractNearbySignals(
  address: string,
  city: string,
  country: string,
  areaType: LocationEnrichment['micro']['area_type']
): string[] {
  const signals: string[] = []
  const countryCode = normalizeCountryCode(country)
  const fullText = `${address} ${city}`.toLowerCase()

  // Add area-specific behavioral signals
  switch (areaType) {
    case 'waterfront':
      signals.push('scenic views likely', 'evening foot traffic', 'tourist appeal')
      break
    case 'tourist_zone':
      signals.push('high foot traffic', 'international visitors', 'weekend busy')
      break
    case 'transit_hub':
      signals.push('commuter traffic', 'quick stops', 'morning/evening rush')
      break
    case 'shopping_street':
      signals.push('retail traffic', 'weekend shoppers', 'lunch crowd')
      break
    case 'business_district':
      signals.push('weekday lunch crowd', 'after-work traffic', 'quiet weekends')
      break
    case 'campus':
      signals.push('student traffic', 'term-time busy', 'study-friendly')
      break
    case 'residential':
      signals.push('local regulars', 'family-friendly', 'evening/weekend traffic')
      break
    default:
      break
  }

  // Limit to 6 signals max
  return signals.slice(0, 6)
}

/**
 * Compute confidence level based on available signals
 */
function computeConfidence(
  hasGeo: boolean,
  areaType: LocationEnrichment['micro']['area_type'],
  signalCount: number
): LocationEnrichment['micro']['confidence'] {
  // High confidence: geo coordinates + specific area type + multiple signals
  if (hasGeo && areaType !== 'unknown' && signalCount >= 2) {
    return 'high'
  }

  // Medium confidence: specific area type OR geo coordinates
  if (areaType !== 'unknown' || hasGeo) {
    return 'medium'
  }

  // Low confidence: no geo, unknown area, few signals
  return 'low'
}

/**
 * Main function: Compute LocationEnrichment from location input
 * 
 * @param input - Location data from database
 * @returns LocationEnrichment object
 */
export function computeLocationEnrichment(input: LocationInput): LocationEnrichment {
  const country = input.country || 'Denmark'
  const city = input.city || 'Unknown'
  const address = [input.address_line1, input.address_line2]
    .filter(Boolean)
    .join(', ') || ''

  // Classify city tier
  const city_tier = classifyCityTier(city, country)

  // Detect area type and get initial signals
  const { type: area_type, signals: initialSignals } = detectAreaType(address, city, country)

  // Extract behavioral signals
  const behavioralSignals = extractNearbySignals(address, city, country, area_type)
  
  // Combine signals (limit to 6 total)
  const nearby_signals = [...initialSignals, ...behavioralSignals].slice(0, 6)

  // Compute confidence
  const hasGeo = Boolean(input.latitude && input.longitude)
  const confidence = computeConfidence(hasGeo, area_type, nearby_signals.length)

  // Build enrichment object
  const enrichment: LocationEnrichment = {
    version: '1.0',
    macro: {
      country,
      city,
      city_tier
    },
    micro: {
      area_type,
      nearby_signals,
      confidence
    }
  }

  // Add geo if available
  if (hasGeo && input.latitude && input.longitude) {
    enrichment.geo = {
      lat: input.latitude,
      lng: input.longitude,
      accuracy: 'high' // Assume high if coordinates provided
    }
  }

  return enrichment
}

/**
 * Create default LocationEnrichment (fallback for missing data)
 */
export function createDefaultLocationEnrichment(
  city: string,
  country: string = 'Denmark'
): LocationEnrichment {
  return {
    version: '1.0',
    macro: {
      country,
      city,
      city_tier: classifyCityTier(city, country)
    },
    micro: {
      area_type: 'unknown',
      nearby_signals: [],
      confidence: 'low'
    }
  }
}
