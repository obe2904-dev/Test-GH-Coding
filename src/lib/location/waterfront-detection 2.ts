/**
 * Waterfront Detection System
 * Detects waterfront locations using multiple methods:
 * 1. Known waterfront streets database
 * 2. Keyword detection in address/business/website
 * 3. POI distance analysis
 */

export interface WaterfrontStreet {
  street: string;
  score: number;
  description: string;
}

export interface WaterfrontLocation {
  [city: string]: WaterfrontStreet[];
}

export interface WaterfrontResult {
  score: number;
  confidence: 'low' | 'medium' | 'high';
  details: string[];
  method: 'known_street' | 'keywords' | 'poi_distance' | 'combined';
}

/**
 * Known waterfront streets in Danish cities
 * Score indicates confidence (0-100)
 */
export const KNOWN_WATERFRONT_LOCATIONS: Record<string, WaterfrontLocation> = {
  'DK': {
    'Aarhus': [
      { street: 'Åboulevarden', score: 85, description: 'Langs Aarhus Å' },
      { street: 'Mejlgade', score: 70, description: 'Nær Aarhus Å' },
      { street: 'Mindet', score: 80, description: 'Ved Aarhus Havn' },
      { street: 'Pier 2', score: 90, description: 'Havnefront' },
      { street: 'Nordhavnsgade', score: 85, description: 'Nordhavnen' },
      { street: 'Østhavnsvej', score: 85, description: 'Østhavnen' },
    ],
    'København': [
      { street: 'Nyhavn', score: 95, description: 'Historisk havnefront' },
      { street: 'Havnegade', score: 85, description: 'Københavns Havn' },
      { street: 'Christians Brygge', score: 80, description: 'Langs havnekanalen' },
      { street: 'Kalvebod Brygge', score: 75, description: 'Havnefront' },
      { street: 'Langelinie', score: 90, description: 'Ved vandet' },
      { street: 'Strandgade', score: 85, description: 'Christianshavn kanal' },
      { street: 'Torvegade', score: 70, description: 'Nær Christianshavn kanal' },
      { street: 'Papirøen', score: 95, description: 'Papirøen/Paper Island havnefront' },
      { street: 'Refshalevej', score: 85, description: 'Refshaleøen ved vandet' },
    ],
    'Odense': [
      { street: 'Havnegade', score: 85, description: 'Ved Odense Havn' },
      { street: 'Munkemose', score: 75, description: 'Ved Odense Å' },
    ],
    'Aalborg': [
      { street: 'Havnegade', score: 85, description: 'Aalborg Havn' },
      { street: 'Strandvejen', score: 80, description: 'Ved Limfjorden' },
      { street: 'Vestfjordvej', score: 75, description: 'Limfjorden' },
    ],
  }
};

/**
 * Waterfront keywords in Danish and English
 * Danish keywords get higher weight as they're more specific
 */
export const WATERFRONT_KEYWORDS = {
  danish: [
    { keyword: 'ved åen', weight: 25 },
    { keyword: 'åen', weight: 20 },
    { keyword: 'ved havnen', weight: 25 },
    { keyword: 'havnen', weight: 20 },
    { keyword: 'kajen', weight: 25 },
    { keyword: 'brygge', weight: 20 },
    { keyword: 'strand', weight: 15 },
    { keyword: 'ved vandet', weight: 25 },
    { keyword: 'havnefront', weight: 25 },
    { keyword: 'kanalen', weight: 20 },
  ],
  english: [
    { keyword: 'waterfront', weight: 15 },
    { keyword: 'harbor', weight: 15 },
    { keyword: 'harbour', weight: 15 },
    { keyword: 'riverside', weight: 15 },
    { keyword: 'canal', weight: 15 },
    { keyword: 'marina', weight: 15 },
    { keyword: 'pier', weight: 15 },
    { keyword: 'by the water', weight: 15 },
    { keyword: 'waterside', weight: 15 },
  ]
};

/**
 * Check if address contains a known waterfront street
 */
export function checkKnownWaterfrontStreet(
  address: string,
  city: string | null,
  country: string = 'DK'
): WaterfrontResult {
  const normalizedAddress = address.toLowerCase().trim();
  const normalizedCity = city?.toLowerCase().trim() || '';

  // Get waterfront locations for country
  const countryLocations = KNOWN_WATERFRONT_LOCATIONS[country];
  if (!countryLocations) {
    return { score: 0, confidence: 'low', details: [], method: 'known_street' };
  }

  // Try exact city match first
  for (const [cityName, streets] of Object.entries(countryLocations)) {
    if (normalizedCity.includes(cityName.toLowerCase()) || cityName.toLowerCase().includes(normalizedCity)) {
      for (const streetData of streets) {
        if (normalizedAddress.includes(streetData.street.toLowerCase())) {
          return {
            score: streetData.score,
            confidence: streetData.score > 80 ? 'high' : 'medium',
            details: [
              `Placeret på ${streetData.street}`,
              streetData.description
            ],
            method: 'known_street'
          };
        }
      }
    }
  }

  // If no city match, check all streets (for cases where city might be misspelled)
  for (const streets of Object.values(countryLocations)) {
    for (const streetData of streets) {
      if (normalizedAddress.includes(streetData.street.toLowerCase())) {
        return {
          score: streetData.score * 0.9, // Slightly lower score if city doesn't match
          confidence: streetData.score > 80 ? 'medium' : 'low',
          details: [
            `Placeret på ${streetData.street}`,
            streetData.description
          ],
          method: 'known_street'
        };
      }
    }
  }

  return { score: 0, confidence: 'low', details: [], method: 'known_street' };
}

/**
 * Detect waterfront from context keywords
 */
export function detectWaterfrontFromContext(
  address: string,
  businessName: string = '',
  websiteContent: string = ''
): WaterfrontResult {
  const combinedText = `${address} ${businessName} ${websiteContent}`.toLowerCase();
  let totalScore = 0;
  const foundKeywords: string[] = [];

  // Check Danish keywords (higher weight)
  for (const { keyword, weight } of WATERFRONT_KEYWORDS.danish) {
    if (combinedText.includes(keyword)) {
      totalScore += weight;
      foundKeywords.push(`"${keyword}"`);
    }
  }

  // Check English keywords
  for (const { keyword, weight } of WATERFRONT_KEYWORDS.english) {
    if (combinedText.includes(keyword)) {
      totalScore += weight;
      foundKeywords.push(`"${keyword}"`);
    }
  }

  // Cap at 80 (keyword detection alone isn't 100% certain)
  const score = Math.min(totalScore, 80);

  if (score === 0) {
    return { score: 0, confidence: 'low', details: [], method: 'keywords' };
  }

  const details: string[] = [];
  if (foundKeywords.length > 0) {
    details.push(`Vandrelaterede nøgleord fundet: ${foundKeywords.join(', ')}`);
  }

  return {
    score,
    confidence: score > 60 ? 'high' : (score > 30 ? 'medium' : 'low'),
    details,
    method: 'keywords'
  };
}

/**
 * Combined waterfront detection using all methods
 */
export function detectWaterfront(
  address: string,
  city: string | null,
  country: string = 'DK',
  _coordinates?: { lat: number; lng: number },
  businessData?: {
    name?: string;
    websiteContent?: string;
  },
  poiData?: {
    waterDistance?: number;
    waterfrontPOIs?: number;
  }
): WaterfrontResult {
  const results: WaterfrontResult[] = [];

  // Method 1: Known streets (highest confidence)
  const knownStreetResult = checkKnownWaterfrontStreet(address, city, country);
  if (knownStreetResult.score > 0) {
    results.push(knownStreetResult);
  }

  // Method 2: Keyword detection
  const keywordResult = detectWaterfrontFromContext(
    address,
    businessData?.name,
    businessData?.websiteContent
  );
  if (keywordResult.score > 0) {
    results.push(keywordResult);
  }

  // Method 3: POI distance (if available)
  if (poiData?.waterDistance !== undefined && poiData.waterDistance < 500) {
    const distanceScore = Math.max(0, 75 - (poiData.waterDistance / 10));
    results.push({
      score: distanceScore,
      confidence: distanceScore > 60 ? 'high' : 'medium',
      details: [`${Math.round(poiData.waterDistance)}m fra vandet`],
      method: 'poi_distance'
    });
  }

  // If no results, return zero score
  if (results.length === 0) {
    return { score: 0, confidence: 'low', details: [], method: 'combined' };
  }

  // Take the highest score
  const bestResult = results.reduce((best, current) => 
    current.score > best.score ? current : best
  );

  // Combine details from all successful methods
  const allDetails = results.flatMap(r => r.details);
  
  // Boost confidence if multiple methods agree
  let confidence = bestResult.confidence;
  if (results.length >= 2 && bestResult.score > 50) {
    confidence = 'high';
  }

  return {
    score: bestResult.score,
    confidence,
    details: allDetails,
    method: 'combined'
  };
}
