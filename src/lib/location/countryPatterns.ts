/**
 * Country-specific patterns for location type detection
 * 
 * Each country has locale-specific keywords for:
 * - City centre indicators (street types, neighborhood names)
 * - Residential areas
 * - Waterfront features
 * - Language for reasons/explanations
 */

export interface CountryPatterns {
  city_centre: {
    neighborhoodKeywords: string[];
    streetTypes: Array<{ pattern: string; reason: string; boost: number }>;
    iconicLandmarks?: string[]; // Optional city-specific landmarks
    veryHighRetailDensity: string;
    highRetailDensity: string;
    moderateRetailDensity: string;
    lowRetailDensity: string;
    touristAttractionsNearby: string;
  };
  residential: {
    neighborhoodKeywords: string[];
    lowDensityReason: string;
    highCommercialReason: string;
    defaultReason: string;
  };
  tourist: {
    iconicLandmarks?: string[];
    highAttractionReason: string;
    moderateAttractionReason: string;
  };
  waterfront: {
    waterKeywords: string[];
    closeProximityReason: string;
    moderateProximityReason: string;
  };
  shopping: {
    shoppingKeywords: string[];
    highDensityReason: string;
    moderateDensityReason: string;
  };
  office: {
    officeKeywords: string[];
    highDensityReason: string;
  };
  transport: {
    stationKeywords: string[];
    highDensityReason: string;
  };
  student: {
    universityKeywords: string[];
    campusReason: string;
  };
  mixed_use: {
    modernDevelopmentKeywords: string[];
    diversityReason: string;
  };
  destination: {
    lowTrafficReason: string;
  };
  language: string; // ISO 639-1 code
}

export const COUNTRY_PATTERNS: Record<string, CountryPatterns> = {
  DK: {
    city_centre: {
      neighborhoodKeywords: ['indre by', 'centrum', 'city', 'midtby', 'midtbyen'],
      streetTypes: [
        { pattern: 'gågade', reason: 'Gågade', boost: 25 },
        { pattern: 'torv', reason: 'Ved torvet', boost: 20 },
        { pattern: 'plads', reason: 'Ved pladsen', boost: 15 },
        { pattern: 'boulevard', reason: 'Hovedgade', boost: 15 },
      ],
      iconicLandmarks: ['strøget', 'nyhavn', 'rådhuspladsen', 'kongens nytorv'],
      veryHighRetailDensity: 'Meget høj tæthed af restauranter og cafeer',
      highRetailDensity: 'Høj tæthed af restauranter og cafeer',
      moderateRetailDensity: 'Moderat tæthed af forretninger',
      lowRetailDensity: 'Lav tæthed af forretninger',
      touristAttractionsNearby: 'Turistattraktioner i nærheden',
    },
    residential: {
      neighborhoodKeywords: [
        'østerbro', 'nørrebro', 'vesterbro', 'frederiksberg',
        'amager', 'valby', 'vanløse', 'brønshøj',
      ],
      lowDensityReason: 'Lav tæthed af forretninger',
      highCommercialReason: 'Høj kommerciel tæthed (ikke primært bolig)',
      defaultReason: 'Ikke primært boligområde',
    },
    tourist: {
      iconicLandmarks: ['tivoli', 'nyhavn', 'den lille havfrue', 'amalienborg', 'christiansborg'],
      highAttractionReason: 'Høj tæthed af turistattraktioner',
      moderateAttractionReason: 'Moderat antal turistattraktioner',
    },
    waterfront: {
      waterKeywords: ['havn', 'kaj', 'strand', 'bro', 'åen', 'åboulevard', 'limfjorden', 'søen', 'ved vandet'],
      closeProximityReason: 'Meget tæt på vand',
      moderateProximityReason: 'Tæt på vand',
    },
    shopping: {
      shoppingKeywords: ['strøget', 'gågade', 'shopping', 'stormagasin', 'butikscenter'],
      highDensityReason: 'Meget høj butikstæthed',
      moderateDensityReason: 'Høj butikstæthed',
    },
    office: {
      officeKeywords: ['kontor', 'erhverv', 'business', 'center'],
      highDensityReason: 'Høj koncentration af kontorer',
    },
    transport: {
      stationKeywords: ['station', 'banegård', 'metro', 'terminal', 'lufthavn'],
      highDensityReason: 'Tæt på transportknudepunkt',
    },
    student: {
      universityKeywords: ['universitet', 'campus', 'kollegium', 'studentby'],
      campusReason: 'Universitetsområde',
    },
    mixed_use: {
      modernDevelopmentKeywords: ['ørestad', 'nordhavn', 'sydhavn', 'carlsberg byen', 'ø'],
      diversityReason: 'Blandet bolig- og erhvervsområde',
    },
    destination: {
      lowTrafficReason: 'Begrænset gennemgangstrafik',
    },
    language: 'da',
  },

  SE: {
    city_centre: {
      neighborhoodKeywords: ['centrum', 'city', 'stan', 'innerstan'],
      streetTypes: [
        { pattern: 'gågata', reason: 'Gågata', boost: 25 },
        { pattern: 'torg', reason: 'Vid torget', boost: 20 },
        { pattern: 'gatan', reason: 'Huvudgata', boost: 10 },
        { pattern: 'allé', reason: 'Allé', boost: 15 },
      ],
      iconicLandmarks: ['gamla stan', 'drottninggatan', 'kungsgatan', 'stortorget'],
      veryHighRetailDensity: 'Mycket hög täthet av restauranger och kaféer',
      highRetailDensity: 'Hög täthet av restauranger och kaféer',
      moderateRetailDensity: 'Måttlig täthet av butiker',
      lowRetailDensity: 'Låg täthet av butiker',
      touristAttractionsNearby: 'Turistattraktioner i närheten',
    },
    residential: {
      neighborhoodKeywords: [
        'vasastan', 'södermalm', 'östermalm', 'kungsholmen',
        'hässelby', 'vällingby', 'farsta',
      ],
      lowDensityReason: 'Låg täthet av affärer',
      highCommercialReason: 'Hög kommersiell täthet (inte primärt bostadsområde)',
      defaultReason: 'Inte primärt bostadsområde',
    },
    tourist: {
      iconicLandmarks: ['kungliga slottet', 'vasamuseet', 'skansen', 'stadshuset', 'globen'],
      highAttractionReason: 'Hög täthet av turistattraktioner',
      moderateAttractionReason: 'Måttligt antal turistattraktioner',
    },
    waterfront: {
      waterKeywords: ['hamn', 'kaj', 'strand', 'bro', 'sjö', 'å', 'viken'],
      closeProximityReason: 'Mycket nära vatten',
      moderateProximityReason: 'Nära vatten',
    },
    shopping: {
      shoppingKeywords: ['drottninggatan', 'gågata', 'shopping', 'köpcentrum', 'galleria'],
      highDensityReason: 'Mycket hög butikstäthet',
      moderateDensityReason: 'Hög butikstäthet',
    },
    office: {
      officeKeywords: ['kontor', 'affärsområde', 'business park'],
      highDensityReason: 'Hög koncentration av kontor',
    },
    transport: {
      stationKeywords: ['station', 'central', 'terminal', 'tunnelbana', 'flygplats'],
      highDensityReason: 'Nära transportknutpunkt',
    },
    student: {
      universityKeywords: ['universitet', 'campus', 'studentområde', 'högskola'],
      campusReason: 'Universitetsområde',
    },
    mixed_use: {
      modernDevelopmentKeywords: ['hammarby sjöstad', 'kista', 'solna'],
      diversityReason: 'Blandat bostads- och affärsområde',
    },
    destination: {
      lowTrafficReason: 'Begränsad genomfartstrafik',
    },
    language: 'sv',
  },

  DE: {
    city_centre: {
      neighborhoodKeywords: ['zentrum', 'altstadt', 'innenstadt', 'city', 'mitte'],
      streetTypes: [
        { pattern: 'fußgängerzone', reason: 'Fußgängerzone', boost: 25 },
        { pattern: 'platz', reason: 'Am Platz', boost: 20 },
        { pattern: 'markt', reason: 'Am Markt', boost: 20 },
        { pattern: 'allee', reason: 'Hauptstraße', boost: 15 },
      ],
      iconicLandmarks: ['rathaus', 'dom', 'hauptmarkt', 'marienplatz'],
      veryHighRetailDensity: 'Sehr hohe Dichte an Restaurants und Cafés',
      highRetailDensity: 'Hohe Dichte an Restaurants und Cafés',
      moderateRetailDensity: 'Mittlere Dichte an Geschäften',
      lowRetailDensity: 'Geringe Dichte an Geschäften',
      touristAttractionsNearby: 'Touristenattraktionen in der Nähe',
    },
    residential: {
      neighborhoodKeywords: [
        'siedlung', 'vorstadt', 'wohngebiet', 'kiez',
        'prenzlauer berg', 'kreuzberg', 'charlottenburg',
      ],
      lowDensityReason: 'Geringe Dichte an Geschäften',
      highCommercialReason: 'Hohe kommerzielle Dichte (kein primäres Wohngebiet)',
      defaultReason: 'Kein primäres Wohngebiet',
    },
    tourist: {
      iconicLandmarks: ['brandenburger tor', 'reichstag', 'schloss', 'altstadt', 'münster'],
      highAttractionReason: 'Hohe Dichte an Touristenattraktionen',
      moderateAttractionReason: 'Moderate Anzahl von Touristenattraktionen',
    },
    waterfront: {
      waterKeywords: ['hafen', 'kai', 'strand', 'brücke', 'ufer', 'see', 'fluss'],
      closeProximityReason: 'Sehr nah am Wasser',
      moderateProximityReason: 'Nah am Wasser',
    },
    shopping: {
      shoppingKeywords: ['fußgängerzone', 'einkaufsstraße', 'shopping', 'kaufhaus', 'zentrum'],
      highDensityReason: 'Sehr hohe Geschäftsdichte',
      moderateDensityReason: 'Hohe Geschäftsdichte',
    },
    office: {
      officeKeywords: ['büro', 'gewerbegebiet', 'business park', 'tower'],
      highDensityReason: 'Hohe Konzentration von Büros',
    },
    transport: {
      stationKeywords: ['bahnhof', 'hauptbahnhof', 'u-bahn', 'terminal', 'flughafen'],
      highDensityReason: 'Nahe Verkehrsknotenpunkt',
    },
    student: {
      universityKeywords: ['universität', 'campus', 'studentenviertel', 'hochschule'],
      campusReason: 'Universitätsgebiet',
    },
    mixed_use: {
      modernDevelopmentKeywords: ['hafencity', 'MediaPark', 'neue mitte'],
      diversityReason: 'Gemischtes Wohn- und Geschäftsgebiet',
    },
    destination: {
      lowTrafficReason: 'Begrenzter Durchgangsverkehr',
    },
    language: 'de',
  },

  UK: {
    city_centre: {
      neighborhoodKeywords: ['city centre', 'town centre', 'downtown', 'central'],
      streetTypes: [
        { pattern: 'high street', reason: 'High Street', boost: 25 },
        { pattern: 'square', reason: 'At the square', boost: 20 },
        { pattern: 'market', reason: 'At the market', boost: 20 },
        { pattern: 'broadway', reason: 'Main street', boost: 15 },
      ],
      iconicLandmarks: ['trafalgar square', 'piccadilly circus', 'covent garden', 'oxford street'],
      veryHighRetailDensity: 'Very high density of restaurants and cafés',
      highRetailDensity: 'High density of restaurants and cafés',
      moderateRetailDensity: 'Moderate density of shops',
      lowRetailDensity: 'Low density of shops',
      touristAttractionsNearby: 'Tourist attractions nearby',
    },
    residential: {
      neighborhoodKeywords: [
        'residential', 'suburb', 'estate', 'gardens',
        'kensington', 'chelsea', 'islington', 'hackney',
      ],
      lowDensityReason: 'Low density of shops',
      highCommercialReason: 'High commercial density (not primarily residential)',
      defaultReason: 'Not primarily residential',
    },
    tourist: {
      iconicLandmarks: ['tower of london', 'big ben', 'buckingham palace', 'westminster abbey'],
      highAttractionReason: 'High density of tourist attractions',
      moderateAttractionReason: 'Moderate number of tourist attractions',
    },
    waterfront: {
      waterKeywords: ['harbour', 'quay', 'wharf', 'pier', 'waterfront', 'riverside', 'marina'],
      closeProximityReason: 'Very close to water',
      moderateProximityReason: 'Close to water',
    },
    shopping: {
      shoppingKeywords: ['high street', 'shopping centre', 'shopping', 'arcade', 'mall'],
      highDensityReason: 'Very high retail density',
      moderateDensityReason: 'High retail density',
    },
    office: {
      officeKeywords: ['business district', 'office park', 'business park', 'city'],
      highDensityReason: 'High concentration of offices',
    },
    transport: {
      stationKeywords: ['station', 'railway', 'underground', 'tube', 'terminal', 'airport'],
      highDensityReason: 'Close to transport hub',
    },
    student: {
      universityKeywords: ['university', 'campus', 'student quarter', 'college'],
      campusReason: 'University area',
    },
    mixed_use: {
      modernDevelopmentKeywords: ['canary wharf', 'kings cross', 'stratford', 'docklands'],
      diversityReason: 'Mixed residential and commercial area',
    },
    destination: {
      lowTrafficReason: 'Limited through-traffic',
    },
    language: 'en',
  },
};

/**
 * Get patterns for a specific country, fallback to Denmark
 */
export function getCountryPatterns(countryCode?: string): CountryPatterns {
  if (!countryCode) return COUNTRY_PATTERNS.DK;
  
  const normalized = countryCode.toUpperCase();
  return COUNTRY_PATTERNS[normalized] || COUNTRY_PATTERNS.DK;
}
