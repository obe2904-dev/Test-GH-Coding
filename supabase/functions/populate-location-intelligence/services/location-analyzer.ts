/**
 * Location Analyzer Service
 * Analyzes location data and structures it for database storage
 */

interface MarketingHook {
  text: string;
  category: 'proximity' | 'area_character' | 'emotional' | 'audience' | 'time_based' | 'vibe' | 'positioning';
  show_on_location_page: boolean;
}

interface AnalyzedLocation {
  neighborhood: string | null;
  neighborhood_character: string | null;
  area_type: string | null;
  category_scores?: Record<string, number>; // NEW: All location category scores
  latitude: number;
  longitude: number;
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
   */
  analyze(geocodeResult: any, nearbyPlaces: any[]): AnalyzedLocation {
    // Extract landmarks and categorize them
    const landmarks = this.categorizeLandmarks(nearbyPlaces);

    // Count POIs by category
    const poiCounts = this.countPOIsByCategory(nearbyPlaces);

    // Determine area type with weighted scoring (NEW: returns both primary + all scores)
    const { primaryAreaType, allScores } = this.improvedDetermineAreaType(nearbyPlaces);

    // Generate rich neighborhood character
    const neighborhoodCharacter = this.generateNeighborhoodCharacter(
      geocodeResult,
      landmarks,
      primaryAreaType
    );

    // Assess street visibility
    const streetVisibility = this.assessStreetVisibility(landmarks);

    // Generate categorized marketing hooks
    const marketingHooks = this.generateCategorizedMarketingHooks(
      geocodeResult,
      landmarks,
      primaryAreaType,
      streetVisibility
    );

    // Extract public transport
    const publicTransport = this.extractPublicTransport(nearbyPlaces);

    return {
      neighborhood: geocodeResult.neighborhood || null,
      neighborhood_character: neighborhoodCharacter,
      area_type: primaryAreaType,
      category_scores: allScores, // NEW: Save all location category scores
      latitude: geocodeResult.latitude,
      longitude: geocodeResult.longitude,
      landmarks_nearby: landmarks,
      poi_counts: poiCounts,
      public_transport: publicTransport,
      location_marketing_hooks: marketingHooks,
      street_visibility: streetVisibility,
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
  private improvedDetermineAreaType(places: any[]): { primaryAreaType: string; allScores: Record<string, number> } {
    const typeScores: Record<string, number> = {
      city_centre: 0,
      residential: 0,
      tourist: 0,
      office: 0,
      transport_hub: 0,
      student: 0,
      waterfront: 0,
      shopping_district: 0,
      mixed_use: 0,
      destination: 0, // NEW: Destination / Drive-To Area
    };

    // Score based on place types (matching client-side categories)
    places.forEach(place => {
      const placeType = (place.type || '').toLowerCase();
      
      // Tourist indicators
      if (placeType.includes('tourist') || placeType.includes('museum') || 
          placeType.includes('art_gallery') || placeType.includes('attraction')) {
        typeScores.tourist += 3;
        typeScores.city_centre += 1;
      }
      
      // Shopping indicators
      if (placeType.includes('shopping') || placeType.includes('store') ||
          placeType.includes('clothing') || placeType.includes('mall')) {
        typeScores.shopping_district += 3;
        typeScores.city_centre += 1;
      }
      
      // Waterfront indicators
      if (placeType.includes('harbor') || placeType.includes('marina') ||
          placeType.includes('waterfront') || place.name.toLowerCase().includes('harbor') ||
          place.name.toLowerCase().includes('havn')) {
        typeScores.waterfront += 3;
      }
      
      // Office/business indicators
      if (placeType.includes('office') || placeType.includes('bank') ||
          placeType.includes('finance')) {
        typeScores.office += 2;
        typeScores.city_centre += 1;
      }
      
      // Transport hub indicators
      if (placeType.includes('train') || placeType.includes('subway') ||
          placeType.includes('bus_station') || placeType.includes('transit')) {
        typeScores.transport_hub += 3;
      }
      
      // Student area indicators
      if (placeType.includes('university') || placeType.includes('school') ||
          placeType.includes('library') || placeType.includes('college')) {
        typeScores.student += 3;
      }
      
      // Residential indicators
      if (placeType.includes('residential') || placeType.includes('neighborhood') ||
          placeType.includes('park') || placeType.includes('playground')) {
        typeScores.residential += 2;
      }
      
      // City centre indicators (high density of services)
      if (placeType.includes('restaurant') || placeType.includes('cafe') ||
          placeType.includes('bar')) {
        typeScores.city_centre += 1;
        typeScores.mixed_use += 1;
      }
    });

    // Destination / Drive-To scoring: LOW POI density suggests non-central location
    const totalPOIs = places.length;
    if (totalPOIs < 10) {
      typeScores.destination += 4; // Strong signal of low walkability
    } else if (totalPOIs < 20) {
      typeScores.destination += 2;
    } else if (totalPOIs < 30) {
      typeScores.destination += 1;
    }
    
    // Check if transit-poor (suggests car-dependent)
    const hasTransit = places.some(p => 
      (p.type || '').toLowerCase().includes('train') ||
      (p.type || '').toLowerCase().includes('subway') ||
      (p.type || '').toLowerCase().includes('bus')
    );
    if (!hasTransit) {
      typeScores.destination += 2;
    }

    // Normalize scores to 0-100 scale
    const maxScore = Math.max(...Object.values(typeScores), 1);
    const normalizedScores: Record<string, number> = {};
    for (const [type, score] of Object.entries(typeScores)) {
      normalizedScores[type] = Math.round((score / maxScore) * 100);
    }

    // Find primary category (highest score)
    let maxNormalizedScore = 0;
    let primaryAreaType = 'mixed_use';
    
    for (const [type, score] of Object.entries(normalizedScores)) {
      if (score > maxNormalizedScore) {
        maxNormalizedScore = score;
        primaryAreaType = type;
      }
    }

    // Filter out categories with score < 40 (not significant enough)
    const significantScores: Record<string, number> = {};
    for (const [type, score] of Object.entries(normalizedScores)) {
      if (score >= 40) {
        significantScores[type] = score;
      }
    }

    // If no significant scores, default to mixed_use with 100 score
    if (Object.keys(significantScores).length === 0) {
      significantScores.mixed_use = 100;
      primaryAreaType = 'mixed_use';
    }

    console.log('📊 Location category scores:', significantScores);
    console.log('🎯 Primary category:', primaryAreaType);

    return { primaryAreaType, allScores: significantScores };
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
