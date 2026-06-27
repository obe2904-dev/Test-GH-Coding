// ============================================================================
// GEOGRAPHIC CONTEXT INTELLIGENCE
// ============================================================================
// Enriches business data with city profiles and location type inference
// Provides geographic context for professional persona and voice selection
// ============================================================================

export type CitySize = 'capital' | 'medium_city' | 'small_town';
export type CompetitionLevel = 'very_high' | 'high' | 'medium' | 'low';

export interface CityProfile {
  city: string;
  country: string;
  size_category: CitySize;
  population: number;
  characteristics: string[];
  tone_guidance: string;
  competition_level: CompetitionLevel;
  cultural_context: string;
}

export type LocationType = 
  | 'river_waterfront'        // ved åen, langs åen, ved bækken — calm river/stream setting
  | 'open_water_waterfront'   // ved havnen, ved vandet, ved stranden, ved søen — open water
  | 'waterfront_leisure'      // legacy / generic waterfront (backward compat)
  | 'downtown_commercial'     // i centrum, på hovedgaden
  | 'tourist_destination'     // i Nyhavn, på Strøget
  | 'urban_neighborhood'      // på Nørrebro, i Vesterbro
  | 'suburban_local'          // i [suburb]
  | 'nature_gateway'          // ved skoven, ved stranden
  | 'transport_hub'           // ved stationen
  | 'unknown';

export interface LocationContext {
  type: LocationType;
  signature?: string;          // e.g., "ved åen", "Nyhavn"
  advantages: string[];
  target_audience_hints: string[];
  tone_implications: string;
}

export interface GeographicContext {
  city_profile: CityProfile;
  location_context: LocationContext;
  narrative: string;  // Danish narrative for AI prompts
}

// ============================================================================
// DANISH POSTAL CODE TO CITY MAPPING
// ============================================================================

export function getCityFromPostalCode(postalCode: string | null): string | null {
  if (!postalCode) return null;
  
  const code = parseInt(postalCode);
  if (isNaN(code)) return null;
  
  // København (Capital Region): 1000-2999
  if (code >= 1000 && code <= 2999) {
    return 'København';
  }
  
  // Aarhus: 8000-8270
  if (code >= 8000 && code <= 8270) {
    return 'Aarhus';
  }
  
  // Odense: 5000-5999
  if (code >= 5000 && code <= 5999) {
    return 'Odense';
  }
  
  // Aalborg: 9000-9999
  if (code >= 9000 && code <= 9999) {
    return 'Aalborg';
  }
  
  // Varde: 6800
  if (code === 6800) {
    return 'Varde';
  }
  
  return null;
}

// ============================================================================
// DANISH CITY PROFILES
// ============================================================================

export const DANISH_CITY_PROFILES: Record<string, CityProfile> = {
  'København': {
    city: 'København',
    country: 'Danmark',
    size_category: 'capital',
    population: 800000,
    characteristics: [
      'capital_city',
      'international',
      'high_competition',
      'trendsetter',
      'tourist_heavy'
    ],
    tone_guidance: 'Sofistikeret men tilgængelig. International audience betyder bredere appeal. Høj konkurrence kræver differentiation og Instagram-optimeret content.',
    competition_level: 'very_high',
    cultural_context: 'Danmarks hovedstad, internationalt beat, høj restaurantdensitet, trendsættende foodscene'
  },
  
  'Aarhus': {
    city: 'Aarhus',
    country: 'Danmark',
    size_category: 'medium_city',
    population: 350000,
    characteristics: [
      'university_town',
      'second_city',
      'growing_foodscene',
      'younger_demographic',
      'cultural_hub'
    ],
    tone_guidance: 'Casual og tilgængelig. Universitetsby med yngre demografy. Balance mellem urban cool og approachable. Community-fokus fungerer godt.',
    competition_level: 'high',
    cultural_context: 'Danmarks næststørste by, stor studiepopulation, voksende kulturscene og restaurantmiljø'
  },
  
  'Odense': {
    city: 'Odense',
    country: 'Danmark',
    size_category: 'medium_city',
    population: 180000,
    characteristics: [
      'university_town',
      'family_oriented',
      'growing_city',
      'cultural_heritage'
    ],
    tone_guidance: 'Venlig og tilgængelig. Mix af studerende og familier. Balance casual og imødekommende.',
    competition_level: 'medium',
    cultural_context: 'Danmarks tredjestørste by, familie-venlig, H.C. Andersen arv'
  },
  
  'Aalborg': {
    city: 'Aalborg',
    country: 'Danmark',
    size_category: 'medium_city',
    population: 120000,
    characteristics: [
      'university_town',
      'northern_denmark',
      'nightlife_culture',
      'younger_demographic'
    ],
    tone_guidance: 'Energisk og casual. Stærk studerende-tilstedeværelse og natteliv. Uformel tone fungerer godt.',
    competition_level: 'medium',
    cultural_context: 'Nordjyllands centrum, universitetsby med aktivt natteliv'
  },
  
  'Varde': {
    city: 'Varde',
    country: 'Danmark',
    size_category: 'small_town',
    population: 8000,
    characteristics: [
      'small_town',
      'local_community',
      'low_competition',
      'personal_connection'
    ],
    tone_guidance: 'Personlig og varm. Lille by = personlige relationer vigtige. Community-feeling og lokal stolthed skal skinne igennem. Authenticity over polish.',
    competition_level: 'low',
    cultural_context: 'Mindre dansk provinsby, tæt community, personligt præg'
  }
};

// ============================================================================
// LOCATION TYPE INFERENCE
// ============================================================================

export function inferLocationType(reference: string | null): LocationContext {
  if (!reference) {
    return {
      type: 'unknown',
      advantages: [],
      target_audience_hints: [],
      tone_implications: ''
    };
  }
  
  const ref = reference.toLowerCase();
  
  // River waterfront — calm stream/river setting; NO marine/wave imagery
  if (ref.match(/ved åen|langs åen|ved bækken/)) {
    return {
      type: 'river_waterfront',
      signature: reference,
      advantages: ['scenic river location', 'outdoor seating', 'nature destination'],
      target_audience_hints: ['weekend visitors', 'walkers', 'families', 'nature lovers'],
      tone_implications: 'Fremhæv rolig å-stemning og natur. Konkrete å-referencer (åen, strømmen, grønne bredder). Undgå marine referencer (bølger, hav, maritim, havnelugt). Casual leisure tone med naturforankring. Sæson/vejr relevant (foraar, sol over åen).'
    };
  }

  // Open water waterfront — harbour, sea, lake or beach; marine imagery is appropriate
  if (ref.match(/ved havnen|ved vandet|ved stranden|ved søen/)) {
    return {
      type: 'open_water_waterfront',
      signature: reference,
      advantages: ['open water views', 'outdoor seating', 'walking destination'],
      target_audience_hints: ['weekend visitors', 'walkers', 'families', 'tourists'],
      tone_implications: 'Fremhæv åben vandflade og udsigt. Maritime eller sø-referencer er naturlige (bølger, udsigt, vinden fra vandet). Casual leisure tone. Sæson/vejr relevant.'
    };
  }
  
  // Tourist destinations
  if (ref.match(/nyhavn|strøget|tivoli|christiania|kongens nytorv/i)) {
    return {
      type: 'tourist_destination',
      signature: reference,
      advantages: ['high visibility', 'tourist traffic', 'iconic location'],
      target_audience_hints: ['tourists', 'international visitors', 'Instagram users'],
      tone_implications: 'Multi-sprog overvejelse. Ikonisk location = premium positioning. Visuelt/æstetisk fokus.'
    };
  }
  
  // Urban neighborhoods
  if (ref.match(/vesterbro|nørrebro|østerbro|frederiksberg|amager|valby/i)) {
    return {
      type: 'urban_neighborhood',
      signature: reference,
      advantages: ['neighborhood identity', 'local community', 'urban culture'],
      target_audience_hints: ['locals', 'young professionals', 'neighborhood regulars'],
      tone_implications: 'Neighborhood-stolthed. Casual urban tone. Community/stamkunde-fokus.'
    };
  }
  
  // Downtown/centrum
  if (ref.match(/centrum|i midten|hovedgaden|downtown|city|indre by/i)) {
    return {
      type: 'downtown_commercial',
      signature: reference,
      advantages: ['central location', 'high foot traffic', 'accessibility'],
      target_audience_hints: ['office workers', 'shoppers', 'lunch crowd'],
      tone_implications: 'Convenience-messaging. Quick service fremhævelse. Frokost/takeaway fokus.'
    };
  }
  
  // Nature gateway — forest, park, or nature proximity (stranden already handled above)
  if (ref.match(/ved skoven|ved parken|naturnært/i)) {
    return {
      type: 'nature_gateway',
      signature: reference,
      advantages: ['nature connection', 'outdoor activities', 'scenic surroundings'],
      target_audience_hints: ['nature lovers', 'outdoor enthusiasts', 'families'],
      tone_implications: 'Fremhæv natur og outdoor muligheder. Sæsonbetonet content. Leisure og afslappet tone.'
    };
  }
  
  // Transport hub
  if (ref.match(/ved stationen|ved banegården|ved metroen/i)) {
    return {
      type: 'transport_hub',
      signature: reference,
      advantages: ['high foot traffic', 'convenience', 'accessibility'],
      target_audience_hints: ['commuters', 'travelers', 'quick visits'],
      tone_implications: 'Convenience og quick service fremhævelse. Takeaway/to-go fokus.'
    };
  }
  
  return {
    type: 'unknown',
    advantages: [],
    target_audience_hints: [],
    tone_implications: ''
  };
}

/**
 * Determine waterfront subtype to prevent semantic errors.
 * 
 * Distinguishes between:
 * - 'river': å, bæk, kanal (calm river/stream) - NEVER use "vandet"
 * - 'open_water': havn, strand, sø, hav (open water) - "vandet" acceptable
 * - 'unknown': unclear or no waterfront reference
 * 
 * Used by location-phrase-resolver to select appropriate Danish terms.
 */
export function getWaterfrontSubtype(
  reference: string | null,
  city?: string
): 'river' | 'open_water' | 'unknown' {
  if (!reference) return 'unknown'
  
  const ref = reference.toLowerCase()
  
  // River/stream patterns - "vandet" is WRONG for these
  if (ref.match(/\båen\b|åen|bækken|kanalen|strømmen|floden/)) {
    return 'river'
  }
  
  // Open water patterns - "vandet" is acceptable
  if (ref.match(/havnen|stranden|søen|vandet|havet|fjorden|bugten|kysten/)) {
    return 'open_water'
  }
  
  // City-specific context clues (Aarhus has "åen", Copenhagen has harbor)
  if (city) {
    const cityLower = city.toLowerCase()
    
    // Aarhus waterfront almost always means "åen"
    if (cityLower === 'aarhus' && ref.match(/ved|langs|nær|vand|water/)) {
      return 'river'
    }
    
    // Copenhagen waterfront usually means harbor/canal (open water)
    if (cityLower.match(/copenhagen|københavn/) && ref.match(/ved|langs|nær|vand|water/)) {
      return 'open_water'
    }
  }
  
  return 'unknown'
}

// ============================================================================
// CITY PROFILE LOOKUP
// ============================================================================

export function getCityProfile(city: string | null): CityProfile | null {
  if (!city) return null;
  
  // Exact match
  if (DANISH_CITY_PROFILES[city]) {
    return DANISH_CITY_PROFILES[city];
  }
  
  // Case-insensitive match
  const cityLower = city.toLowerCase();
  for (const [key, profile] of Object.entries(DANISH_CITY_PROFILES)) {
    if (key.toLowerCase() === cityLower) {
      return profile;
    }
  }
  
  return null;
}

// ============================================================================
// CONTEXT NARRATIVE GENERATION (DANISH)
// ============================================================================

export function generateContextNarrative(
  city_profile: CityProfile | null,
  location_context: LocationContext
): string {
  let narrative = `GEOGRAFISK CONTEXT:\n\n`;
  
  if (city_profile) {
    narrative += `By: ${city_profile.city} (${city_profile.size_category}, ${city_profile.population.toLocaleString()} indbyggere)\n`;
    narrative += `Karakteristika: ${city_profile.characteristics.join(', ')}\n`;
    narrative += `Konkurrenceniveau: ${city_profile.competition_level}\n`;
    narrative += `Kulturel context: ${city_profile.cultural_context}\n`;
    narrative += `Tone-guidance: ${city_profile.tone_guidance}\n\n`;
  }
  
  if (location_context.type !== 'unknown' && location_context.signature) {
    narrative += `Specifik location: ${location_context.signature} (${location_context.type})\n`;
    narrative += `Location-fordele: ${location_context.advantages.join(', ')}\n`;
    narrative += `Målgruppe-hints: ${location_context.target_audience_hints.join(', ')}\n`;
    narrative += `Tone-implikationer: ${location_context.tone_implications}\n`;
  }
  
  return narrative;
}

// ============================================================================
// MAIN ENRICHMENT FUNCTION
// ============================================================================

// ============================================================================
// MAIN ENRICHMENT FUNCTION
// ============================================================================

export function enrichGeographicContext(
  postalCode: string | null,
  city: string | null,
  local_location_reference: string | null
): GeographicContext {
  // Priority 1: Use postal code to determine city (most reliable)
  let determinedCity = getCityFromPostalCode(postalCode);
  
  // Priority 2: Use provided city name
  if (!determinedCity && city) {
    determinedCity = city;
  }
  
  const city_profile = getCityProfile(determinedCity);
  const location_context = inferLocationType(local_location_reference);
  const narrative = generateContextNarrative(city_profile, location_context);
  
  return {
    city_profile: city_profile || {
      city: determinedCity || 'Unknown',
      country: 'Danmark',
      size_category: 'medium_city',
      population: 0,
      characteristics: [],
      tone_guidance: 'Standard professional tone',
      competition_level: 'medium',
      cultural_context: 'No specific city context available'
    },
    location_context,
    narrative
  };
}
