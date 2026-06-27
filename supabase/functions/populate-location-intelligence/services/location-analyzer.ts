/**
 * Location Analyzer Service
 * Analyzes location data and structures it for database storage
 */

interface MarketingHook {
  text: string;
  category: 'proximity' | 'area_character' | 'emotional' | 'audience' | 'time_based' | 'vibe' | 'positioning';
  show_on_location_page: boolean;
}

interface NearbyHospitality {
  radius_meters: number;
  total_count: number;
  breakdown: { restaurant: number; cafe: number; bar: number };
  density_label: 'low' | 'medium' | 'high';
  fetched_at: string;
}

interface PhysicalContext {
  pedestrian_flow: 'very_high' | 'high' | 'medium' | 'low';
  transit_within_150m: boolean;
  nearest_transit: { name: string; distance_meters: number } | null;
  parking_within_300m: boolean;
  street_level: boolean | null; // Google doesn't provide floor info - can be set manually
}

interface RawCompetitiveVenue {
  name: string;
  distance_meters: number;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number; // 1-4 Google scale
  place_id: string;
  types: string[];
}

interface AnalyzedLocation {
  neighborhood: string | null;
  neighborhood_character: string | null;
  area_type: string | null;
  category_scores?: Record<string, number>; // Geographic location types only (WHERE business is)
  demographic_proximity?: Record<string, number>; // NEW: Demographic proximity data (WHO is nearby)
  category_modifiers?: Record<string, string[]>; // Category qualifiers (e.g., {city_centre: ["shopping"]})
  latitude: number;
  longitude: number;
  nearby_hospitality: NearbyHospitality;
  physical_context?: PhysicalContext; // NEW: Objective physical environment facts
  raw_competitive_venues?: RawCompetitiveVenue[]; // NEW: Raw competitor data (no AI interpretation)
  landmarks_nearby: Array<{
    name: string;
    type: string;
    walking_distance_minutes: number;
    walking_distance_meters: number;
    marketing_angle?: string;
  }>;
  poi_counts: {
    restaurants: number;
    cafes: number;
    bars: number;
    hotels: number;
    shopping: number;
    attractions: number;
    entertainment: number;
    offices: number;
    transit: number;
    parks: number;
    education: number;
  };
  public_transport: {
    metro_stations?: Array<{
      station_name: string;
      walking_minutes: number;
    }>;
    bus_stops?: Array<{
      stop_name: string;
      walking_minutes: number;
    }>;
  };
  location_marketing_hooks: MarketingHook[];
  street_visibility: string | null;
}

export class LocationAnalyzer {
  private readonly MINIMUM_LANDMARK_SCORE = 40; // Only show landmarks scoring 40+ points

  /**
   * Analyze and structure location data
   * NOTE: Score computation moved to AI+web search (with POI fallback in index.ts)
   * This method only extracts factual data that Google Places provides reliably
   */
  analyze(geocodeResult: any, nearbyPlaces: any[], hospitalityPlaces?: any[]): AnalyzedLocation {
    // Extract landmarks — factual, not scored
    const landmarks = nearbyPlaces
      .filter(p => ['tourist_attraction', 'museum', 'park', 'church',
                    'stadium', 'university', 'train_station'].includes(p.type))
      .sort((a, b) => a.distance_meters - b.distance_meters)
      .slice(0, 8)
      .map(p => ({
        name: p.name,
        type: this.mapPlaceType(p.type),
        walking_distance_minutes: p.walking_minutes || Math.round(p.distance_meters / 80),
        walking_distance_meters: p.distance_meters,
        marketing_angle: this.getMarketingAngle(p),
      }));

    // Hospitality density — factual count, reliable from Google
    const hospitalityCount = (hospitalityPlaces ?? nearbyPlaces.filter(p => 
      ['restaurant', 'cafe', 'bar'].includes(p.type)
    )).length;

    // Count POIs by category (for logging/analysis only)
    const poiCounts = this.countPOIsByCategory(nearbyPlaces);

    // Extract public transport
    const publicTransport = this.extractPublicTransport(nearbyPlaces);

    // Compute hospitality density within 300m for competitive context
    const nearbyHospitality = this.computeHospitalityDensity(hospitalityPlaces ?? nearbyPlaces, !hospitalityPlaces);

    // All scoring is now done by AI in index.ts — not here
    return {
      neighborhood: geocodeResult.neighborhood || null,
      neighborhood_character: null, // AI-generated
      area_type: null, // AI-determined
      category_scores: {}, // Populated by AI call in index.ts
      demographic_proximity: {}, // Populated by AI call in index.ts
      latitude: geocodeResult.latitude,
      longitude: geocodeResult.longitude,
      nearby_hospitality: nearbyHospitality,
      landmarks_nearby: landmarks,
      poi_counts: poiCounts,
      public_transport: publicTransport,
      location_marketing_hooks: [], // Populated after scores available
      street_visibility: null,
    };
  }

  /**
   * Compute hospitality venue density for competitive context.
   * When `filterByRadius` is true, filters the input to ≤300m first (fallback path).
   * When `filterByRadius` is false, all supplied places are assumed to be within 300m
   * (they came from a dedicated 300m hospitality-only Places API call).
   */
  private computeHospitalityDensity(places: any[], filterByRadius = false): NearbyHospitality {
    const RADIUS = 300;
    const nearby = filterByRadius ? places.filter(p => (p.distance_meters ?? Infinity) <= RADIUS) : places;

    const breakdown = { restaurant: 0, cafe: 0, bar: 0 };
    for (const place of nearby) {
      const type = (place.type || '').toLowerCase();
      if (type.includes('restaurant') || type === 'meal_takeaway' || type === 'food') {
        breakdown.restaurant++;
      } else if (type.includes('cafe') || type.includes('coffee')) {
        breakdown.cafe++;
      } else if (type.includes('bar') || type.includes('night_club')) {
        breakdown.bar++;
      }
    }

    const total = breakdown.restaurant + breakdown.cafe + breakdown.bar;
    // density_label thresholds: ≤3 = low, ≤10 = medium, 11+ = high
    const density_label: 'low' | 'medium' | 'high' =
      total <= 3 ? 'low' : total <= 10 ? 'medium' : 'high';

    return {
      radius_meters: RADIUS,
      total_count: total,
      breakdown,
      density_label,
      fetched_at: new Date().toISOString(),
    };
  }

  /**
   * Count POIs by category from all nearby places
   */
  private countPOIsByCategory(places: any[]): {
    restaurants: number;
    cafes: number;
    bars: number;
    hotels: number;
    shopping: number;
    attractions: number;
    entertainment: number;
    offices: number;
    transit: number;
    parks: number;
    education: number;
  } {
    const counts = {
      restaurants: 0,
      cafes: 0,
      bars: 0,
      hotels: 0,
      shopping: 0,
      attractions: 0,
      entertainment: 0,
      offices: 0,
      transit: 0,
      parks: 0,
      education: 0
    };

    for (const place of places) {
      const type = (place.type || '').toLowerCase();
      
      // Restaurants & Food
      if (type.includes('restaurant') || type === 'meal_takeaway' || type === 'food') {
        counts.restaurants++;
      }
      // Cafes & Coffee
      else if (type.includes('cafe') || type.includes('coffee')) {
        counts.cafes++;
      }
      // Bars & Nightlife
      else if (type.includes('bar') || type.includes('night_club')) {
        counts.bars++;
      }
      // Hotels & Lodging
      else if (type.includes('hotel') || type.includes('lodging')) {
        counts.hotels++;
      }
      // Shopping & Retail
      else if (type.includes('store') || type.includes('shopping') || type.includes('department_store') || type.includes('book_store')) {
        counts.shopping++;
      }
      // Tourist Attractions
      else if (type.includes('tourist_attraction') || type.includes('museum') || type.includes('art_gallery')) {
        counts.attractions++;
      }
      // Entertainment
      else if (type.includes('theater') || type.includes('cinema') || type.includes('movie_theater') || type.includes('performing_arts')) {
        counts.entertainment++;
      }
      // Offices & Business
      else if (type.includes('office')) {
        counts.offices++;
      }
      // Transit
      else if (type.includes('station') || type.includes('transit') || type.includes('subway') || type.includes('train')) {
        counts.transit++;
      }
      // Parks & Recreation
      else if (type.includes('park')) {
        counts.parks++;
      }
      // Education
      else if (type.includes('university') || type.includes('school') || type.includes('library')) {
        counts.education++;
      }
    }

    return counts;
  }

  /**
   * Generate rich 3-4 sentence neighborhood character description
   * Includes specific landmarks, street names, vibe, demographics, and atmosphere
   */
  private generateNeighborhoodCharacter(
    geocodeResult: any,
    landmarks: any[],
    areaType: string
  ): string {
    const neighborhood = geocodeResult.neighborhood || geocodeResult.city || 'området';
    const formattedAddress = geocodeResult.formatted_address || '';
    
    // Extract street name from formatted address
    let streetName = '';
    const streetMatch = formattedAddress.match(/^([^,]+)/);
    if (streetMatch) {
      streetName = streetMatch[1].trim();
    }
    
    // Get top 2-3 most significant landmarks (already sorted by prominence)
    const majorLandmarks = landmarks.slice(0, 3).filter(l => 
      l.type === 'tourist_attraction' || l.type === 'cultural'
    );
    
    // Count landmark types for character inference
    const cultural = landmarks.filter(l => 
      l.type === 'cultural' || l.type === 'tourist_attraction'
    ).length;
    const parks = landmarks.filter(l => l.type === 'park').length;
    const commercial = landmarks.filter(l => l.type === 'commercial').length;
    
    // Determine activity level
    const nearbyCount = landmarks.filter(l => l.walking_distance_minutes <= 5).length;
    const veryClose = landmarks.filter(l => l.walking_distance_minutes <= 2).length;
    
    let description = '';
    
    // SENTENCE 1: Specific location with major landmarks
    if (majorLandmarks.length >= 2 && streetName) {
      const landmark1 = majorLandmarks[0].name;
      const landmark2 = majorLandmarks[1].name;
      
      if (areaType === 'cultural_quarter') {
        description += `I hjertet af ${neighborhood} på ${streetName}, få skridt fra ${landmark1} og ${landmark2}. `;
      } else if (areaType === 'tourist_district') {
        description += `Centralt placeret i ${neighborhood} ved ${streetName}, lige ved ${landmark1} og ${landmark2}. `;
      } else if (areaType === 'park_area') {
        description += `Rolig beliggenhed i ${neighborhood} nær ${landmark1} og ${landmark2}. `;
      } else {
        description += `På ${streetName} i ${neighborhood}, tæt på ${landmark1} og ${landmark2}. `;
      }
    } else if (majorLandmarks.length >= 1 && streetName) {
      const landmark1 = majorLandmarks[0].name;
      description += `På ${streetName} i ${neighborhood}, tæt på ${landmark1}. `;
    } else if (streetName) {
      description += `Placeret på ${streetName} i ${neighborhood}. `;
    } else {
      description += `Beliggende i ${neighborhood}. `;
    }
    
    // SENTENCE 2: Vibe, atmosphere, and demographics
    if (areaType === 'cultural_quarter' && cultural >= 3) {
      if (veryClose >= 3) {
        description += `Området summer af cafégæster, kulturgående og turister i en blanding af historisk charme og moderne byliv. `;
      } else {
        description += `Populært kulturkvarter blandt kunstentusiaster, studerende og kultursøgende besøgende. `;
      }
    } else if (areaType === 'tourist_district') {
      description += `Travlt turistområde med høj aktivitet og international stemning året rundt. `;
    } else if (areaType === 'park_area' && parks >= 2) {
      description += `Afslappet område populært blandt lokale familier der søger grønne pauser fra byens puls. `;
    } else if (commercial >= 3) {
      description += `Pulserende handelsområde med kontorfolk, forretningsrejsende og shoppende i hverdagen. `;
    } else if (cultural >= 2) {
      description += `Autentisk bydel hvor lokale og besøgende mødes omkring kunst, kultur og gastronomi. `;
    } else {
      description += `Blandet område med både lokale beboere og tilrejsende i hverdagen. `;
    }
    
    // SENTENCE 3: Activity patterns and foot traffic
    if (nearbyCount >= 7 && veryClose >= 3) {
      description += `Konstant aktivitet fra morgenstunden til sen aften, med særlig høj trafik i dagtimerne og weekender. `;
    } else if (nearbyCount >= 5) {
      if (areaType === 'cultural_quarter') {
        description += `Jævn strøm af besøgende gennem dagen, især intenst når museerne er åbne. `;
      } else {
        description += `Moderat fodgænger-trafik med stigende aktivitet i myldretiden og weekender. `;
      }
    } else if (nearbyCount >= 3) {
      description += `Rolig atmosfære med lokal trafik, mest livligt omkring frokost og eftermiddag. `;
    } else {
      description += `Stille område med primært lokale besøgende i hverdagen. `;
    }
    
    // SENTENCE 4 (optional): Special characteristics
    if (parks >= 2 && cultural >= 2) {
      description += `Unik balance mellem grønne åndehul og kulturel aktivitet.`;
    } else if (areaType === 'cultural_quarter' && veryClose >= 4) {
      description += `Hjertet af byens kulturelle liv med ikoniske vartegn indenfor gåafstand.`;
    }
    
    return description.trim();
  }

  /**
   * Generate categorized marketing hooks for different use cases
   */
  private generateCategorizedMarketingHooks(
    geocodeResult: any,
    landmarks: any[],
    areaType: string,
    streetVisibility: string | null
  ): MarketingHook[] {
    const hooks: MarketingHook[] = [];
    const neighborhood = geocodeResult.neighborhood || geocodeResult.city;

    // PROXIMITY HOOKS (show on location page)
    landmarks.slice(0, 3).forEach(landmark => {
      if (landmark.walking_distance_minutes <= 5) {
        hooks.push({
          text: `${landmark.walking_distance_minutes} min fra ${landmark.name}`,
          category: 'proximity',
          show_on_location_page: true,
        });
      }
    });

    // AREA CHARACTER HOOKS (show on location page)
    if (neighborhood) {
      hooks.push({
        text: `I hjertet af ${neighborhood}`,
        category: 'area_character',
        show_on_location_page: true,
      });
    }
    
    if (streetVisibility === 'high_traffic') {
      hooks.push({
        text: `På ${neighborhood}s travleste gade`,
        category: 'area_character',
        show_on_location_page: true,
      });
    }

    // EMOTIONAL HOOKS (only for Brand Profile AI)
    if (areaType === 'cultural_quarter') {
      hooks.push({
        text: 'Hvor historie møder moderne dansk cafékultur',
        category: 'emotional',
        show_on_location_page: false,
      });
      hooks.push({
        text: 'I hjertet af byens kulturelle pulsåre',
        category: 'emotional',
        show_on_location_page: false,
      });
    } else if (areaType === 'tourist_district') {
      hooks.push({
        text: 'Dit pausested mellem byens højdepunkter',
        category: 'emotional',
        show_on_location_page: false,
      });
    } else if (areaType === 'park_area') {
      hooks.push({
        text: 'Hvor naturens ro møder bymiljøets puls',
        category: 'emotional',
        show_on_location_page: false,
      });
    }

    // AUDIENCE HOOKS (only for Brand Profile AI)
    const cultural = landmarks.filter(l => 
      l.type === 'cultural' || l.type === 'tourist_attraction'
    ).length;
    
    if (cultural >= 3) {
      hooks.push({
        text: 'Perfekt for kultursøgende turister og lokale kunstentusiaster 25-50 år',
        category: 'audience',
        show_on_location_page: false,
      });
      hooks.push({
        text: 'Tiltrækker museumsbesøgende der søger autentiske oplevelser',
        category: 'audience',
        show_on_location_page: false,
      });
    }

    // TIME-BASED HOOKS (only for Brand Profile AI)
    if (landmarks.some(l => l.type === 'tourist_attraction')) {
      hooks.push({
        text: 'Travlt frokoststed for nærliggende kontorfolk',
        category: 'time_based',
        show_on_location_page: false,
      });
      hooks.push({
        text: 'Weekend brunch-destination for turister',
        category: 'time_based',
        show_on_location_page: false,
      });
    }

    // SHOPPING POSITIONING HOOKS (only for Brand Profile AI)
    const commercial = landmarks.filter(l => l.type === 'commercial').length;
    if (commercial >= 2) {
      hooks.push({
        text: 'Perfekt pause under shopping-turen',
        category: 'positioning',
        show_on_location_page: false,
      });
      hooks.push({
        text: 'Strategisk placeret mellem byens shopping-destinationer',
        category: 'positioning',
        show_on_location_page: false,
      });
    }

    // VIBE HOOKS (only for Brand Profile AI)
    const nearbyCount = landmarks.filter(l => l.walking_distance_minutes <= 5).length;
    if (nearbyCount > 7) {
      hooks.push({
        text: 'Livligt bymiljø med konstant aktivitet',
        category: 'vibe',
        show_on_location_page: false,
      });
    } else if (nearbyCount > 4) {
      hooks.push({
        text: 'Balanceret atmosfære mellem puls og ro',
        category: 'vibe',
        show_on_location_page: false,
      });
    } else {
      hooks.push({
        text: 'Rolig oase væk fra byens travlhed',
        category: 'vibe',
        show_on_location_page: false,
      });
    }

    return hooks;
  }

  /**
   * Assess street visibility based on landmark proximity and density
   */
  private assessStreetVisibility(landmarks: any[]): string {
    // Count landmarks within 200m (very close)
    const veryClose = landmarks.filter(l => l.walking_distance_meters <= 200).length;
    
    // Count landmarks within 500m (close)
    const close = landmarks.filter(l => l.walking_distance_meters <= 500).length;
    
    // Closest landmark distance
    const closestDistance = landmarks.length > 0 ? landmarks[0].walking_distance_meters : 1000;
    
    // High traffic: many landmarks very close OR on a major route
    if (veryClose >= 5 || closestDistance < 50) {
      return 'high_traffic';
    }
    
    // Medium traffic: moderate landmark density
    if (close >= 3 || closestDistance < 150) {
      return 'medium_traffic';
    }
    
    // Low traffic: sparse landmarks
    return 'low_traffic';
  }

  /**
   * Improved area type determination with weighted scoring
   * Returns both primary category and all category scores
   */
  private improvedDetermineAreaType(places: any[]): { 
    primaryAreaType: string; 
    allScores: Record<string, number>;
    demographicProximity: Record<string, number>;
  } {
    // GEOGRAPHIC LOCATION TYPES (WHERE the business is)
    const geographicScores: Record<string, number> = {
      city_centre: 0,
      residential: 0,
      office: 0,
      transport_hub: 0,
      waterfront: 0,
      shopping_district: 0,
      mixed_use: 0,
      destination: 0,
      nature_park: 0,
    };

    // DEMOGRAPHIC PROXIMITY (WHO is nearby)
    const demographicScores: Record<string, number> = {
      university_proximity: 0,
      tourist_flow: 0,
      office_worker_density: 0,
      residential_density: 0,
    };

    // Score based on place types
    places.forEach(place => {
      const placeType = (place.type || '').toLowerCase();
      
      // Tourist flow indicators (DEMOGRAPHIC: WHO is nearby)
      if (placeType.includes('tourist') || placeType.includes('museum') || 
          placeType.includes('art_gallery') || placeType.includes('attraction')) {
        demographicScores.tourist_flow += 3;
        geographicScores.city_centre += 1; // Also indicates central location
      }
      
      // Shopping indicators (GEOGRAPHIC: WHERE)
      if (placeType.includes('shopping') || placeType.includes('store') ||
          placeType.includes('clothing') || placeType.includes('mall')) {
        geographicScores.shopping_district += 3;
        geographicScores.city_centre += 1;
      }
      
      // Waterfront indicators (GEOGRAPHIC: WHERE)
      if (placeType.includes('harbor') || placeType.includes('marina') ||
          placeType.includes('waterfront') || place.name.toLowerCase().includes('harbor') ||
          place.name.toLowerCase().includes('havn')) {
        geographicScores.waterfront += 3;
      }
      
      // Office/business indicators (both DEMOGRAPHIC density and GEOGRAPHIC type)
      if (placeType.includes('office') || placeType.includes('bank') ||
          placeType.includes('finance')) {
        demographicScores.office_worker_density += 2;
        geographicScores.office += 2;
        geographicScores.city_centre += 1;
      }
      
      // Transport hub indicators (GEOGRAPHIC: WHERE)
      // Only major transit infrastructure counts (not regular bus stops)
      if (placeType.includes('train_station') || placeType.includes('subway_station') ||
          placeType.includes('transit_station')) {
        geographicScores.transport_hub += 5;  // Higher score for major stations
      }
      // Bus terminals (major hubs only, not individual stops)
      if (placeType === 'bus_station' || place.name.toLowerCase().includes('rutebilstation')) {
        geographicScores.transport_hub += 3;
      }
      
      // University proximity indicators (DEMOGRAPHIC: WHO is nearby)
      if (placeType.includes('university') || placeType.includes('school') ||
          placeType.includes('library') || placeType.includes('college')) {
        demographicScores.university_proximity += 3;
      }
      
      // Residential indicators (both DEMOGRAPHIC density and GEOGRAPHIC type)
      if (placeType.includes('residential') || placeType.includes('neighborhood')) {
        demographicScores.residential_density += 2;
        geographicScores.residential += 2;
      }
      
      // Park indicators (GEOGRAPHIC: WHERE)
      if (placeType.includes('park') || placeType.includes('playground')) {
        geographicScores.nature_park += 2;
        geographicScores.residential += 1; // Parks often in residential areas
        demographicScores.residential_density += 1;
      }
      
      // City centre indicators (high density of services)
      if (placeType.includes('restaurant') || placeType.includes('cafe') ||
          placeType.includes('bar')) {
        geographicScores.city_centre += 1;
        geographicScores.mixed_use += 1;
      }
    });

    // Destination / Drive-To scoring: LOW POI density suggests non-central location
    const totalPOIs = places.length;
    if (totalPOIs < 10) {
      geographicScores.destination += 4;
    } else if (totalPOIs < 20) {
      geographicScores.destination += 2;
    } else if (totalPOIs < 30) {
      geographicScores.destination += 1;
    }
    
    // Check if transit-poor (suggests car-dependent)
    const hasTransit = places.some(p => 
      (p.type || '').toLowerCase().includes('train') ||
      (p.type || '').toLowerCase().includes('subway') ||
      (p.type || '').toLowerCase().includes('bus')
    );
    if (!hasTransit) {
      geographicScores.destination += 2;
    }

    // Normalize GEOGRAPHIC scores to 0-100 scale
    const maxGeoScore = Math.max(...Object.values(geographicScores), 1);
    const normalizedGeoScores: Record<string, number> = {};
    for (const [type, score] of Object.entries(geographicScores)) {
      normalizedGeoScores[type] = Math.round((score / maxGeoScore) * 100);
    }

    // Normalize DEMOGRAPHIC scores to 0-100 scale
    const maxDemoScore = Math.max(...Object.values(demographicScores), 1);
    const normalizedDemoScores: Record<string, number> = {};
    for (const [type, score] of Object.entries(demographicScores)) {
      normalizedDemoScores[type] = Math.round((score / maxDemoScore) * 100);
    }

    // Find primary category (highest geographic score)
    let maxNormalizedScore = 0;
    let primaryAreaType = 'mixed_use';
    
    for (const [type, score] of Object.entries(normalizedGeoScores)) {
      if (score > maxNormalizedScore) {
        maxNormalizedScore = score;
        primaryAreaType = type;
      }
    }

    // Filter out geographic categories with score < 40
    const significantGeoScores: Record<string, number> = {};
    for (const [type, score] of Object.entries(normalizedGeoScores)) {
      if (score >= 40) {
        significantGeoScores[type] = score;
      }
    }

    // If no significant scores, default to mixed_use
    if (Object.keys(significantGeoScores).length === 0) {
      significantGeoScores.mixed_use = 100;
      primaryAreaType = 'mixed_use';
    }

    // Filter out demographic scores < 20 (not significant proximity)
    const significantDemoScores: Record<string, number> = {};
    for (const [type, score] of Object.entries(normalizedDemoScores)) {
      if (score >= 20) {
        significantDemoScores[type] = score;
      }
    }

    console.log('📊 Geographic location scores:', significantGeoScores);
    console.log('👥 Demographic proximity scores:', significantDemoScores);
    console.log('🎯 Primary geographic category:', primaryAreaType);

    return { 
      primaryAreaType, 
      allScores: significantGeoScores,
      demographicProximity: significantDemoScores
    };
  }

  /**
   * Categorize landmarks, score them, and return only top significant ones
   */
  private categorizeLandmarks(places: any[]) {
    // Filter out transport, individual fashion stores, and low-quality dining
    const fashionStorePatterns = ['Wolford', 'COS', 'Ganni', 'Mads Nørgaard', 'Wood Wood', 'Samsøe'];
    const nonTransportPlaces = places.filter(place => {
      // Remove transport
      if (['subway_station', 'train_station', 'bus_station'].includes(place.type)) {
        return false;
      }
      // Remove individual fashion stores
      if (fashionStorePatterns.some(pattern => place.name.includes(pattern))) {
        return false;
      }
      // For dining (restaurants/cafés): Only include well-rated places with good review count
      // This ensures we only show notable/iconic dining spots, not random cafés
      if (['restaurant', 'cafe'].includes(place.type)) {
        if (!place.rating || place.rating < 4.2 || !place.user_ratings_total || place.user_ratings_total < 250) {
          return false; // Skip low-rated or obscure dining places
        }
      }
      return true;
    });

    // Score each landmark
    const scoredLandmarks = nonTransportPlaces.map(place => {
      const score = this.calculateLandmarkScore(place);
      const marketingAngle = this.getMarketingAngle(place);
      
      return {
        name: place.name,
        type: this.mapPlaceType(place.type),
        walking_distance_minutes: place.walking_minutes,
        walking_distance_meters: place.distance_meters,
        marketing_angle: marketingAngle,
        prominence_score: score, // For debugging/logging
      };
    });

    // Sort by score (highest first)
    const sortedByScore = scoredLandmarks.sort((a, b) => b.prominence_score - a.prominence_score);

    // Filter by minimum threshold and take top 7
    const topLandmarks = sortedByScore
      .filter(landmark => landmark.prominence_score >= this.MINIMUM_LANDMARK_SCORE)
      .slice(0, 7);

    // COMPREHENSIVE DIAGNOSTIC LOGGING
    console.log('═══════════════════════════════════════════════');
    console.log('🔍 RAW PLACES from Google Maps (before scoring):');
    nonTransportPlaces.forEach(p => {
      console.log(`  - ${p.name}: type="${p.type}", distance=${p.distance_meters}m, rating=${p.rating || 'N/A'}, reviews=${p.user_ratings_total || 0}`);
    });

    console.log('\n📊 ALL LANDMARKS SCORED:');
    scoredLandmarks.forEach(l => {
      console.log(`  - ${l.name}: ${l.prominence_score} points (${l.walking_distance_meters}m, type=${l.type})`);
    });

    console.log('\n🏆 TOP LANDMARKS SELECTED (score >= 40):');
    topLandmarks.forEach(l => {
      console.log(`  ✅ ${l.name}: ${l.prominence_score} points`);
    });

    console.log('\n❌ FILTERED OUT (score < 40):');
    const filtered = sortedByScore.filter(l => l.prominence_score < this.MINIMUM_LANDMARK_SCORE);
    filtered.forEach(l => {
      console.log(`  ⛔ ${l.name}: ${l.prominence_score} points - REJECTED`);
    });

    // Special check for ARoS
    const aros = scoredLandmarks.find(l => l.name.toLowerCase().includes('aros'));
    if (aros) {
      console.log('\n🎨 ARoS FOUND:', {
        name: aros.name,
        score: aros.prominence_score,
        included: topLandmarks.some(l => l.name === aros.name) ? 'YES ✅' : 'NO ❌'
      });
    } else {
      console.log('\n⚠️ ARoS NOT FOUND in Google Maps results!');
    }

    // Special check for Wolford
    const wolford = scoredLandmarks.find(l => l.name.toLowerCase().includes('wolford'));
    if (wolford) {
      console.log('\n👗 WOLFORD FOUND:', {
        name: wolford.name,
        score: wolford.prominence_score,
        type: wolford.type,
        included: topLandmarks.some(l => l.name === wolford.name) ? 'YES ✅' : 'NO ❌'
      });
    }
    console.log('═══════════════════════════════════════════════\n');

    // Remove prominence_score from final output
    return topLandmarks.map(({ prominence_score, ...landmark }) => landmark);
  }

  /**
   * Extract public transport stations
   */
  private extractPublicTransport(places: any[]) {
    const metroStations = places
      .filter(p => p.type === 'subway_station')
      .slice(0, 3)
      .map(p => ({
        station_name: p.name,
        walking_minutes: p.walking_minutes,
      }));

    const busStops = places
      .filter(p => p.type === 'bus_station' || p.type === 'transit_station')
      .slice(0, 3)
      .map(p => ({
        stop_name: p.name,
        walking_minutes: p.walking_minutes,
      }));

    return {
      metro_stations: metroStations.length > 0 ? metroStations : undefined,
      bus_stops: busStops.length > 0 ? busStops : undefined,
    };
  }

  /**
   * Map Google Places types to our marketing types
   */
  private mapPlaceType(googleType: string): string {
    const typeMap: Record<string, string> = {
      'tourist_attraction': 'tourist_attraction',
      'museum': 'cultural',
      'park': 'park',
      'shopping_mall': 'commercial',
      'art_gallery': 'cultural',
      'department_store': 'commercial',
      // Entertainment & Culture
      'performing_arts_theater': 'entertainment',
      'night_club': 'entertainment',
      'movie_theater': 'entertainment',
      // Education & Cultural Hubs
      'university': 'education',
      'library': 'cultural',
      // Shopping (NEW)
      'book_store': 'shopping',
      // Dining (NEW)
      'restaurant': 'dining',
      'cafe': 'dining',
    };

    return typeMap[googleType] || 'other';
  }

  /**
   * Calculate landmark prominence score
   * Higher score = more significant/recognizable landmark
   * Max possible: 50 (type) + 40 (iconic reviews) + 20 (distance) = 110 points
   */
  private calculateLandmarkScore(place: any): number {
    let score = 0;

    // TYPE PRIORITY SCORING (0-50 points)
    const typeScores: Record<string, number> = {
      'tourist_attraction': 50,  // Major attractions (ARoS, Cathedral)
      'entertainment': 45,       // Theaters, concert halls - CRITICAL for hospitality positioning
      'museum': 40,              // Cultural institutions
      'commercial': 30,          // Department stores (Salling, Magasin)
      'dining': 28,              // Restaurants, cafés (selective - only highly rated)
      'shopping': 26,            // Bookstores, design shops
      'park': 25,                // Public spaces
      'art_gallery': 20,         // Smaller cultural venues
      'education': 15,           // Universities
      'other': 10                // Unknown types
    };
    
    const mappedType = this.mapPlaceType(place.type);
    score += typeScores[mappedType] || typeScores['other'];

    // PROMINENCE SCORING from Google ratings (0-40 points, increased max)
    if (place.rating && place.user_ratings_total) {
      // ICONIC landmarks with massive review counts (ARoS, etc.)
      if (place.user_ratings_total >= 5000) {
        score += 40; // Iconic landmark (ARoS, major museums)
      }
      // High rating (4.0+) with many reviews (500+) = prominent place
      else if (place.rating >= 4.5 && place.user_ratings_total >= 1000) {
        score += 30; // Very well-known
      } else if (place.rating >= 4.0 && place.user_ratings_total >= 500) {
        score += 20; // Well-known
      } else if (place.rating >= 3.5 && place.user_ratings_total >= 200) {
        score += 10; // Moderately known
      }
      // Few reviews or low rating = not prominent, no bonus
    }

    // DISTANCE BONUS (0-15 points, reduced from 20)
    // Proximity matters but not more than significance
    if (place.distance_meters <= 200) {
      score += 15; // Very close
    } else if (place.distance_meters <= 400) {
      score += 10; // Close
    } else if (place.distance_meters <= 800) {
      score += 5; // Walkable
    }
    // Even distant landmarks (up to 1.5km) can score high on prominence

    return score;
  }

  /**
   * Get marketing angle for a landmark
   */
  private getMarketingAngle(place: any): string | undefined {
    if (place.walking_minutes <= 2) {
      return `Perfekt før/efter besøg på ${place.name}`;
    }
    if (place.walking_minutes <= 5) {
      return `Nemt at kombinere med ${place.name}`;
    }
    return undefined;
  }
}
