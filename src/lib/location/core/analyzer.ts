/**
 * Language-Aware Location Analyzer
 * Main orchestrator for locale-aware location intelligence
 */

import { geocodeAddress, analyzePOIs } from '../detectors/poi-analyzer';
import { detectWaterfront, WaterfrontDetectionResult } from '../detectors/waterfront';
import { scrapeWebsiteForLocationContext } from '../detectors/website-scraper';
import { scoreLocation } from './scoring-engine';
import { getLocaleConfigByCountry } from '../locales';
import { LocationAnalysis, CountryCode, LocationCategoryId } from './types';

interface AnalyzeOptions {
  businessWebsite?: string;
  useSupabaseFunction?: boolean;
  businessId?: string;
  supabaseUrl?: string;
  accessToken?: string;
  forceRefresh?: boolean;  // Task 4.5: Bypass 90-day cache
}

/**
 * Main location analysis function - language aware
 * Uses Supabase Edge Function for real Google Maps data when available
 */
export async function analyzeLocation(
  address: string,
  options: AnalyzeOptions = {}
): Promise<LocationAnalysis> {
  
  // Try using Supabase Edge Function first (real Google Maps data, no CORS)
  if (options.useSupabaseFunction && options.businessId && options.supabaseUrl && options.accessToken) {
    try {
      return await analyzeViaSupabase(address, options);
    } catch (error) {
      // Silently fall back to client-side analysis (this is expected if Edge Function not deployed)
      console.log('ℹ️ Using client-side location analysis (Edge Function not available)');
    }
  }
  
  // Fallback: Client-side analysis with mock data
  return await analyzeClientSide(address, options.businessWebsite);
}

/**
 * Analyze via Supabase Edge Function (real Google Maps data)
 */
async function analyzeViaSupabase(
  address: string,
  options: AnalyzeOptions
): Promise<LocationAnalysis> {
  const response = await fetch(`${options.supabaseUrl}/functions/v1/populate-location-intelligence`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.accessToken}`
    },
    body: JSON.stringify({ 
      business_id: options.businessId,
      address_override: address,
      force_refresh: options.forceRefresh ?? false  // Task 4.5: Support cache bypass
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Supabase Function Error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    });
    throw new Error(`Supabase function request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  console.log('🔍 Supabase Function Response:', {
    fullResponse: data,
    hasLocationIntel: !!data.location_intelligence,
    allIntelFields: data.location_intelligence ? Object.keys(data.location_intelligence) : [],
    address: data.location_intelligence?.address,
    formattedAddress: data.location_intelligence?.formatted_address,
    city: data.location_intelligence?.city,
    neighborhood: data.location_intelligence?.neighborhood,
    country: data.location_intelligence?.country,
    countryCode: data.location_intelligence?.country_code,
    coordinates: {
      lat: data.location_intelligence?.latitude,
      lng: data.location_intelligence?.longitude
    },
    poiCounts: {
      restaurants: data.location_intelligence?.restaurants_nearby,
      cafes: data.location_intelligence?.cafes_nearby,
      hotels: data.location_intelligence?.hotels_nearby,
      attractions: data.location_intelligence?.tourist_attractions_nearby
    },
    waterDistance: data.location_intelligence?.water_distance_meters,
    landmarkCount: data.location_intelligence?.landmarks_nearby?.length
  });
  
  if (!data.location_intelligence) {
    throw new Error('No location data returned');
  }

  // Transform Supabase result to locale-aware format
  return transformSupabaseResult(data.location_intelligence, address);
}

/**
 * Transform Supabase Edge Function result with locale awareness
 */
function transformSupabaseResult(intel: any, address: string): LocationAnalysis {
  const country = (intel.country_code || 'DK') as CountryCode;
  const localeConfig = getLocaleConfigByCountry(country);
  
  console.log('🌍 Transformation Input:', {
    originalAddress: address,
    intelAddress: intel.address,
    intelFormattedAddress: intel.formatted_address,
    intelCity: intel.city,
    intelNeighborhood: intel.neighborhood,
    intelCountry: intel.country,
    intelCountryCode: intel.country_code,
    areaType: intel.area_type,
    neighborhoodCharacter: intel.neighborhood_character,
    landmarksCount: intel.landmarks_nearby?.length,
    hasPOICounts: !!intel.poi_counts,
    locale: localeConfig.locale
  });
  
  // Use POI counts from Supabase if available, otherwise extract from landmarks
  let poiData: any;
  
  if (intel.poi_counts) {
    console.log('📊 Using POI counts from Supabase:', intel.poi_counts);
    
    poiData = {
      restaurants: intel.poi_counts.restaurants || 0,
      cafes: intel.poi_counts.cafes || 0,
      hotels: intel.poi_counts.hotels || 0,
      attractions: intel.poi_counts.attractions || 0,
      offices: intel.poi_counts.offices || 0,
      schools_universities: intel.poi_counts.education || 0,
      residential_buildings: 0,
      transit_stations: intel.poi_counts.transit || 0,
      shopping_centers: intel.poi_counts.shopping || 0,
      parks: intel.poi_counts.parks || 0,
      entertainment_venues: intel.poi_counts.entertainment + intel.poi_counts.bars,
      water_distance: 9999,
      landmarks: (intel.landmarks_nearby || []).map((l: any) => ({
        name: l.name,
        type: l.type || 'landmark',
        distance: l.walking_distance_meters || 0
      }))
    };
  } else {
    // Fallback: Extract POI data from landmarks
    const landmarks = intel.landmarks_nearby || [];
    const landmarkTypes = landmarks.map((l: any) => (l.type || '').toLowerCase());
    
    console.log('🏗️ Extracting POI data from landmarks:', {
      totalLandmarks: landmarks.length,
      landmarkTypes: landmarkTypes,
      areaType: intel.area_type,
      neighborhoodCharacter: intel.neighborhood_character
    });
    
    // Map Supabase landmark types to POI categories
    const diningCount = landmarkTypes.filter((t: string) => t.includes('dining') || t.includes('restaurant') || t.includes('food')).length;
    const entertainmentCount = landmarkTypes.filter((t: string) => t.includes('entertainment')).length;
    const commercialCount = landmarkTypes.filter((t: string) => t.includes('commercial') || t.includes('shopping') || t.includes('store')).length;
    
    poiData = {
      restaurants: diningCount,
      cafes: diningCount > 0 ? Math.ceil(diningCount / 2) : 0,
      hotels: landmarkTypes.filter((t: string) => t.includes('hotel') || t.includes('lodging')).length,
      attractions: landmarkTypes.filter((t: string) => t.includes('tourist') || t.includes('attraction') || t.includes('point_of_interest')).length,
      offices: landmarkTypes.filter((t: string) => t.includes('office')).length,
      schools_universities: landmarkTypes.filter((t: string) => t.includes('school') || t.includes('university') || t.includes('college') || t.includes('education')).length,
      residential_buildings: landmarkTypes.filter((t: string) => t.includes('residential')).length,
      transit_stations: landmarkTypes.filter((t: string) => t.includes('station') || t.includes('transit')).length,
      shopping_centers: commercialCount,
      parks: landmarkTypes.filter((t: string) => t.includes('park')).length,
      entertainment_venues: entertainmentCount,
      water_distance: 9999,
      landmarks: landmarks.map((l: any) => ({
        name: l.name,
        type: l.type || 'landmark',
        distance: l.walking_distance_meters || 0
      }))
    };
  }
  
  // Boost category scores based on area_type
  const areaTypeBoosts: Record<string, Partial<Record<LocationCategoryId, number>>> = {
    'cultural_quarter': { tourist: 20, city_centre: 15, waterfront: 10 },
    'residential': { residential: 25 },
    'commercial': { shopping_district: 20, city_centre: 10 },
    'entertainment_district': { city_centre: 20, tourist: 10 },
    'waterfront': { waterfront: 25, tourist: 10, city_centre: 30 }
  };
  
  console.log('📊 Extracted POI counts:', { 
    ...poiData,
    areaType: intel.area_type,
    suggestedBoosts: areaTypeBoosts[intel.area_type || ''] || {}
  });
  
  // Enhanced waterfront detection
  const waterfrontResult: WaterfrontDetectionResult = {
    score: 0,
    confidence: 'low',
    details: [],
    signals: []
  };
  
  // Check known locations - try multiple city name variations
  const rawCity = intel.neighborhood || intel.city || '';
  const addressLower = address.toLowerCase();
  
  // Smart city matching - check if any known city is contained in the detected city name
  // e.g., "Aarhus Centrum" contains "Aarhus"
  let cityLocations: any[] = [];
  let matchedCity = '';
  
  for (const knownCity of Object.keys(localeConfig.knownLocations)) {
    if (rawCity.includes(knownCity) || knownCity.includes(rawCity)) {
      cityLocations = localeConfig.knownLocations[knownCity];
      matchedCity = knownCity;
      break;
    }
  }
  
  console.log('🏙️ City Detection:', {
    rawCityFromSupabase: rawCity,
    matchedKnownCity: matchedCity,
    availableCities: Object.keys(localeConfig.knownLocations),
    cityLocationsCount: cityLocations.length,
    cityLocations: cityLocations.map(l => l.identifier),
    addressSearching: address,
    addressLower: addressLower
  });
  
  for (const location of cityLocations) {
    if (addressLower.includes(location.identifier.toLowerCase())) {
      console.log('✅ Known Location Match!', {
        matchedLocation: location.identifier,
        score: location.score,
        description: location.description
      });
      
      waterfrontResult.score = location.score;
      waterfrontResult.confidence = 'high';
      waterfrontResult.details.push(`Lokaliseret på ${location.identifier}`, location.description);
      waterfrontResult.signals.push({
        type: 'known_waterfront_street',
        name: location.identifier,
        weight: 5,
        metadata: { culturalSignificance: location.culturalContext?.significance }
      });
      break;
    }
  }
  
  console.log('🌊 Waterfront Detection Result:', {
    score: waterfrontResult.score,
    confidence: waterfrontResult.confidence,
    detailsCount: waterfrontResult.details.length,
    signalsCount: waterfrontResult.signals.length
  });
  
  // Check water distance
  if (poiData.water_distance < 500 && waterfrontResult.score === 0) {
    const distance = Math.round(poiData.water_distance);
    waterfrontResult.score = distance < 100 ? 85 : distance < 250 ? 65 : 40;
    waterfrontResult.confidence = distance < 100 ? 'high' : 'medium';
    waterfrontResult.details.push(`${distance}m fra vandet`);
    waterfrontResult.signals.push({
      type: 'water_proximity',
      name: `${distance}m fra vandkant`,
      distance: distance,
      weight: distance < 100 ? 5 : 3
    });
  }
  
  // Score all categories
  const matches = scoreLocation(
    poiData,
    address,
    localeConfig,
    {
      waterfrontScore: waterfrontResult.score,
      waterfrontDetails: waterfrontResult.details,
      waterfrontSignals: waterfrontResult.signals,
      city: matchedCity || rawCity
    }
  );
  
  // Apply area_type boosts from Supabase intelligence
  const areaType = intel.area_type;
  if (areaType && areaTypeBoosts[areaType]) {
    const boosts = areaTypeBoosts[areaType];
    // Boost existing matches
    matches.forEach(match => {
      if (boosts[match.categoryId]) {
        const boost = boosts[match.categoryId]!;
        match.score = Math.min(100, match.score + boost);
        match.signals.push({
          type: 'area_classification',
          name: `Klassificeret som ${areaType}`,
          weight: 3,
          metadata: { areaType, boost }
        });
      }
    });
    // Also create entries for categories not yet in matches (when boost is significant)
    for (const [categoryId, boost] of Object.entries(boosts)) {
      if (!(boost as number)) continue;
      const exists = matches.some(m => m.categoryId === categoryId);
      if (!exists && (boost as number) >= 20) {
        matches.push({
          categoryId: categoryId as LocationCategoryId,
          score: boost as number,
          confidence: 'low',
          reasoning: [`Klassificeret som ${areaType} område`],
          signals: [{
            type: 'area_classification',
            name: `Klassificeret som ${areaType}`,
            weight: 3,
            metadata: { areaType, boost }
          }]
        });
      }
    }
  }
  
  // Apply keyword-based boosts from neighborhood_character
  const neighborhoodText = (intel.neighborhood_character || '').toLowerCase();
  const neighborhoodName = (intel.neighborhood || '').toLowerCase();
  
  // Check if location name indicates city centre
  if (neighborhoodName.includes('centrum') || neighborhoodName.includes('center') || neighborhoodName.includes('downtown')) {
    const cityCentreMatch = matches.find(m => m.categoryId === 'city_centre');
    if (cityCentreMatch) {
      const oldScore = cityCentreMatch.score;
      cityCentreMatch.score = Math.min(100, cityCentreMatch.score + 30);
      console.log('🏛️ City Centre Boost Applied:', {
        oldScore,
        newScore: cityCentreMatch.score,
        neighborhoodName: intel.neighborhood
      });
      cityCentreMatch.signals.push({
        type: 'location_name',
        name: `Beliggende i ${intel.neighborhood}`,
        weight: 4,
        metadata: { neighborhoodName: intel.neighborhood }
      });
    } else {
      console.warn('⚠️ City Centre category not found in matches for boost');
    }
  }
  
  const characterBoosts: Array<{ keywords: string[], categoryId: LocationCategoryId, boost: number, signalName: string }> = [
    { keywords: ['shopping', 'stormagasin', 'butik', 'indkøb'], categoryId: 'shopping_district', boost: 15, signalName: 'Shoppingområde nævnt i beskrivelse' },
    { keywords: ['kulturel', 'museum', 'teater', 'kunst'], categoryId: 'tourist', boost: 12, signalName: 'Kulturelle attraktioner nævnt' },
    { keywords: ['bolig', 'residential', 'kvarter'], categoryId: 'residential', boost: 15, signalName: 'Boligområde nævnt' },
    { keywords: ['station', 'metro', 'transport'], categoryId: 'transport_hub', boost: 15, signalName: 'Transportknudepunkt nævnt' },
    { keywords: ['universitet', 'studerende'], categoryId: 'student', boost: 15, signalName: 'Uddannelsesinstitution nævnt' },
    { keywords: ['kontor', 'erhverv', 'forretning'], categoryId: 'office', boost: 12, signalName: 'Erhvervsområde nævnt' },
    { keywords: ['caféliv', 'restauranter', 'café', 'aftenliv', 'natliv', 'cocktail'], categoryId: 'city_centre', boost: 35, signalName: 'Café- og restaurantmiljø nævnt' },
    { keywords: ['ikonisk', 'turistspot', 'seværdighed', 'turist'], categoryId: 'tourist', boost: 35, signalName: 'Ikonisk turistdestination nævnt' }
  ];
  
  characterBoosts.forEach(({ keywords, categoryId, boost, signalName }) => {
    if (keywords.some(kw => neighborhoodText.includes(kw))) {
      let match = matches.find(m => m.categoryId === categoryId);
      if (!match) {
        match = { categoryId, score: 0, confidence: 'low', reasoning: [], signals: [] };
        matches.push(match);
      }
      match.score = Math.min(100, match.score + boost);
      match.signals.push({
        type: 'neighborhood_description',
        name: signalName,
        weight: 2,
        metadata: { keywords: keywords.filter(kw => neighborhoodText.includes(kw)) }
      });
    }
  });
  
  // Re-sort after applying all boosts
  matches.sort((a, b) => b.score - a.score);
  
  console.log('📊 Final sorted categories:', matches.map(m => ({
    category: m.categoryId,
    score: m.score,
    confidence: m.confidence
  })));
  
  // Get cultural context
  const locationKey = `${matchedCity}:${extractStreetName(address)}`;
  const culturalContext = localeConfig.culturalKnowledge[locationKey];
  
  return {
    address,
    coordinates: {
      lat: intel.latitude || 0,
      lng: intel.longitude || 0
    },
    country,
    city: matchedCity || rawCity,
    locale: localeConfig.locale,
    matches,
    primaryCategory: matches[0].categoryId,
    analyzedAt: new Date().toISOString(),
    dataSource: 'google_maps',
    culturalContext
  };
}

/**
 * Client-side analysis (fallback with mock data)
 */
async function analyzeClientSide(
  address: string,
  businessWebsite?: string
): Promise<LocationAnalysis> {
  // Step 1: Geocode to get country
  const geocoding = await geocodeAddress(address);
  const country = geocoding.countryCode as CountryCode;
  
  // Step 2: Load locale configuration
  const localeConfig = getLocaleConfigByCountry(country);
  
  // Step 3: Scrape website with locale awareness (optional)
  let websiteContext = null;
  if (businessWebsite) {
    websiteContext = await scrapeWebsiteForLocationContext(
      businessWebsite,
      localeConfig
    );
  }
  
  // Step 4: Analyze POIs
  const poiData = await analyzePOIs(geocoding.coordinates);
  
  // Step 5: Enhanced waterfront detection (locale-aware)
  const waterfrontResult: WaterfrontDetectionResult = await detectWaterfront(
    geocoding.formattedAddress,
    geocoding.city,
    geocoding.country,
    geocoding.coordinates,
    localeConfig,
    websiteContext,
    poiData
  );
  
  // Step 6: Score against all categories (locale-aware)
  const matches = scoreLocation(
    poiData,
    geocoding.formattedAddress,
    localeConfig,
    {
      waterfrontScore: waterfrontResult.score,
      waterfrontDetails: waterfrontResult.details,
      waterfrontSignals: waterfrontResult.signals,
      websiteContext,
      city: geocoding.city
    }
  );
  
  // Step 7: Determine primary category
  const primaryCategory = matches[0].categoryId;
  
  // Step 8: Get cultural context if location is known
  const locationKey = `${geocoding.city}:${extractStreetName(geocoding.formattedAddress)}`;
  const culturalContext = localeConfig.culturalKnowledge[locationKey];
  
  return {
    address: geocoding.formattedAddress,
    coordinates: geocoding.coordinates,
    country: geocoding.countryCode as CountryCode,
    city: geocoding.city,
    locale: localeConfig.locale,
    matches,
    primaryCategory,
    analyzedAt: new Date().toISOString(),
    dataSource: 'google_maps',
    culturalContext
  };
}

/**
 * Extract street name from full address
 * e.g., "Åboulevarden 38, 8000 Aarhus C" → "Åboulevarden"
 */
function extractStreetName(address: string): string {
  return address.split(',')[0].split(' ')[0];
}
