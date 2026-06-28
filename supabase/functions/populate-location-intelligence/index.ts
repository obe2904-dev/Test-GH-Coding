/**
 * Populate Location Intelligence
 * Auto-populates location data from Google Maps APIs
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { GoogleMapsService } from './services/google-maps.ts';
import { LocationAnalyzer } from './services/location-analyzer.ts';
import { DatabaseSaver } from './services/database-saver.ts';
import { AIAnalyzer } from './services/claude-analyzer.ts';

/**
 * Major Danish cities that Google sometimes returns as "neighborhood" for nearby smaller towns.
 * When a business is in Silkeborg but Google returns neighborhood="Aarhus", we null it out.
 */
const MAJOR_DANISH_CITIES = [
  'København', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg', 
  'Randers', 'Kolding', 'Horsens', 'Vejle', 'Roskilde',
  'Herning', 'Silkeborg', 'Næstved', 'Fredericia', 'Viborg'
];

// Schema v2: category_scores (geographic location types) + demographic_proximity (who passes by)
const LOCATION_SCHEMA_VERSION = 2;

/**
 * Synthesize a location phrase from city and area_type when Google doesn't provide neighborhood data.
 * Common for rural areas, small towns, and regions without formal neighborhood boundaries.
 */
function synthesizeNeighborhoodFromAreaType(city: string, areaType: string): string {
  const areaTypeMappings: Record<string, string> = {
    'city_centre': `${city} centrum`,
    'residential': `${city} boligområde`,
    'office': `${city} erhvervsområde`,
    'transport_hub': `${city} transportknudepunkt`,
    'waterfront': `${city} havn`,
    'shopping_district': `${city} shoppingområde`,
    'mixed_use': city, // Just city name for mixed-use
    'destination': `${city} attraktion`,
    'nature_park': `${city} naturområde`,
  };

  return areaTypeMappings[areaType] || city;
}

/**
 * Helper: Derive pedestrian flow from hospitality density + area type
 * Uses hospitality venue count within 300m as proxy for foot traffic
 * City centre gets a baseline boost (equivalent to ~4 extra venues)
 */
function derivePedestrianFlow(
  hospitalityPlaces: any[],
  areaType: string
): 'very_high' | 'high' | 'medium' | 'low' {
  const count = hospitalityPlaces.length;

  // City centre baseline boost — equivalent to ~4 extra venues
  const boost = areaType === 'city_centre' ? 4 : 0;
  const effective = count + boost;

  if (effective >= 15) return 'very_high';
  if (effective >= 8)  return 'high';
  if (effective >= 4)  return 'medium';
  return 'low';
}

/**
 * POI-based fallback scoring when AI analysis fails
 * Not AI-validated, but provides functional scores from POI heuristics
 */
function applyPOIFallbackScores(
  analyzedLocation: any,
  nearbyPlaces: any[],
  hospitalityPlaces: any[]
): void {
  // Simple heuristics from POI counts — not AI-validated, but functional
  const total = nearbyPlaces.length || 1;
  
  const count = (types: string[]) =>
    nearbyPlaces.filter(p => types.includes(p.type)).length;

  // Blend absolute + relative to avoid false highs in low-data areas
  const ratio = (types: string[]) => {
    const absolute = count(types);
    const relative = (absolute / total) * 100;
    
    if (total < 20) {
      // Favor absolute counts in sparse areas
      return Math.min(100, Math.round(absolute * 15 + relative * 0.3));
    }
    // Favor relative proportion in data-rich areas
    return Math.min(100, Math.round(relative * 2));
  };

  analyzedLocation.category_scores = {
    city_centre: ratio(['shopping_mall', 'department_store', 'bank', 'restaurant', 'cafe', 'bar']),
    waterfront: count(['marina', 'beach', 'pier']) > 0 ? 70 : 5,
    residential: ratio(['grocery_or_supermarket', 'laundry', 'pharmacy', 'dentist']),
    office: ratio(['lawyer', 'accounting', 'bank', 'insurance_agency']),
    transport_hub: nearbyPlaces.some(p => ['train_station', 'subway_station'].includes(p.type) && p.distance_meters < 300) ? 80 : 15,
    shopping_district: ratio(['shopping_mall', 'clothing_store', 'shoe_store', 'jewelry_store']),
    tourist_destination: ratio(['tourist_attraction', 'museum', 'hotel', 'art_gallery']),
    nature_park: ratio(['park', 'campground', 'beach']),
  };

  analyzedLocation.demographic_proximity = {
    local_resident: 50,  // safe neutral default
    tourist: analyzedLocation.category_scores.tourist_destination > 40 ? 45 : 20,
    student: 15,         // conservative default — avoid false high scores
    business_professional: analyzedLocation.category_scores.office > 30 ? 40 : 15,
    family: ratio(['primary_school', 'park', 'playground', 'child_care']) > 20 ? 35 : 15,
  };

  analyzedLocation.area_type = Object.entries(analyzedLocation.category_scores)
    .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || 'mixed_use';

  analyzedLocation.neighborhood_character = null;  // AI only — no fallback text

  // Add reliability warning
  analyzedLocation._fallback_warning = {
    reason: 'AI analysis unavailable',
    poi_count: total,
    reliability: total >= 20 ? 'moderate' : 'low',
    note: 'Scores derived from POI heuristics, not AI-validated'
  };

  console.log('📍 Fallback scores applied (POI-based, not AI-validated)');
  console.log(`   Reliability: ${analyzedLocation._fallback_warning.reliability} (${total} POIs)`);
  console.log('   category_scores:', analyzedLocation.category_scores);
  console.log('   demographic_proximity:', analyzedLocation.demographic_proximity);
}

/**
 * Helper: Generate physical context facts from location data
 * Note: pedestrian_flow is set separately after AI determines area_type
 */
function generatePhysicalContext(nearbyPlaces: any[], geocodeResult: any): any {
  // Find nearest transit stop
  const transitTypes = ['transit_station', 'subway_station', 'bus_station', 'train_station'];
  const transitPlaces = nearbyPlaces.filter(p => transitTypes.includes(p.type));
  const nearestTransit = transitPlaces.length > 0
    ? transitPlaces.reduce((nearest, current) =>
        current.distance_meters < nearest.distance_meters ? current : nearest
      )
    : null;

  return {
    pedestrian_flow: null, // Set after AI call determines area_type
    transit_within_150m: transitPlaces.some(p => p.distance_meters < 150),
    nearest_transit: nearestTransit
      ? { name: nearestTransit.name, distance_meters: nearestTransit.distance_meters }
      : null,
    parking_within_300m: nearbyPlaces.some(p => p.type === 'parking' && p.distance_meters < 300),
    street_level: null, // Google doesn't provide floor info - can be set manually later
  };
}

interface PopulateLocationRequest {
  business_id: string;
  force_refresh?: boolean;  // Task 4.5: Bypass cache and re-analyze
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { business_id, force_refresh = false } = await req.json() as PopulateLocationRequest;

    if (!business_id) {
      return new Response(
        JSON.stringify({ error: 'business_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');

    if (!googleMapsApiKey) {
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.warn('⚠️ OPENAI_API_KEY not configured - using basic location analysis only');
    }

    // Create Supabase client early to fetch business address
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch address from business_locations table (primary location)
    const { data: locationData, error: locationError } = await supabase
      .from('business_locations')
      .select('address_line1, address_line2, city, postal_code, country')
      .eq('business_id', business_id)
      .eq('is_primary', true)
      .maybeSingle();

    // Fallback: Try businesses table if no location found
    let address: string;
    let city: string | null = null;
    let businessCategory = 'restaurant';

    if (locationData?.address_line1) {
      address = locationData.address_line1;
      city = locationData.city;
      console.log(`[1/5] Fetched address from business_locations: ${address}, ${city || 'Denmark'}`);
    } else {
      // Fallback to businesses table
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('address, city, category')
        .eq('id', business_id)
        .single();

      if (businessError || !businessData?.address) {
        return new Response(
          JSON.stringify({ 
            error: 'Business address not found in database. Please add an address in Business Profile → Location.' 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      address = businessData.address;
      city = businessData.city;
      businessCategory = businessData.category || 'restaurant';
      console.log(`[1/5] Fetched address from businesses table: ${address}, ${city || 'Denmark'}`);
    }

    // ─────────────────────────────────────────────────────────
    // CACHE CHECK: skip all Google API calls if data is fresh
    // (same address, updated within last 90 days)
    // Task 4.5: Extended from 30 to 90 days for cost optimization
    // Schema versioning: Invalidate cache when schema changes
    // ─────────────────────────────────────────────────────────
    const CACHE_TTL_DAYS = 90;  // Task 4.5: Increased from 30 days
    const cacheKey = `location:${business_id}:v${LOCATION_SCHEMA_VERSION}`;
    
    const { data: cachedIntel } = await supabase
      .from('business_location_intelligence')
      .select('last_updated_by_ai, neighborhood, schema_version')
      .eq('business_id', business_id)
      .maybeSingle();

    if (cachedIntel?.last_updated_by_ai && !force_refresh) {  // Task 4.5: Respect force_refresh flag
      const cacheAgeDays =
        (Date.now() - new Date(cachedIntel.last_updated_by_ai).getTime()) /
        (1000 * 60 * 60 * 24);

      // Check schema version match
      const cachedSchemaVersion = (cachedIntel as any).schema_version || 1;
      const schemaMatches = cachedSchemaVersion === LOCATION_SCHEMA_VERSION;

      if (cacheAgeDays < CACHE_TTL_DAYS && schemaMatches) {
        console.log(
          `✅ Cache hit: location data is ${Math.round(cacheAgeDays)} days old (< ${CACHE_TTL_DAYS} days), ` +
          `schema v${cachedSchemaVersion} matches current v${LOCATION_SCHEMA_VERSION}. ` +
          `Returning cached result without calling Google Maps APIs. ` +
          `Use force_refresh=true to bypass cache.`
        );

        // Fetch and return the full cached row
        const { data: fullCached } = await supabase
          .from('business_location_intelligence')
          .select('*')
          .eq('business_id', business_id)
          .single();

        return new Response(
          JSON.stringify({ success: true, location_intelligence: fullCached, cached: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (!schemaMatches) {
        console.log(`⚠️ Schema mismatch: cached v${cachedSchemaVersion}, current v${LOCATION_SCHEMA_VERSION}. Re-running analysis.`);
      } else {
        console.log(`⏰ Cache expired: ${Math.round(cacheAgeDays)} days old. Re-running full analysis.`);
      }
    }

    // Get business category if not already fetched
    if (!businessCategory || businessCategory === 'restaurant') {
      const { data: bizData } = await supabase
        .from('businesses')
        .select('category')
        .eq('id', business_id)
        .single();
      
      if (bizData?.category) {
        businessCategory = bizData.category;
      }
    }
    console.log(`[2/5] Geocoding address...`);
    const googleMaps = new GoogleMapsService(googleMapsApiKey);
    
    // Build full address
    const fullAddress = city ? `${address}, ${city}, Denmark` : `${address}, Denmark`;
    const geocodeResult = await googleMaps.geocodeAddress(fullAddress);

    console.log(`[3/5] Finding nearby places and hospitality venues...`);
    let nearbyPlaces: any[] = [];
    try {
      nearbyPlaces = await googleMaps.findNearbyPlaces(
        geocodeResult.latitude,
        geocodeResult.longitude,
        1500 // 1.5km radius for cultural venues
      );
      console.log(`✅ Found ${nearbyPlaces.length} nearby places`);
    } catch (placesError) {
      console.error('❌ Error finding nearby places:', placesError);
      // Continue with empty array - analysis will work with limited data
      nearbyPlaces = [];
    }

    // Fetch competitive venues for market context
    console.log(`[3.1/5] Finding competitive venues...`);
    let rawCompetitiveVenues: any[] = [];
    try {
      const comparableVenues = await googleMaps.findComparableVenues(
        geocodeResult.latitude,
        geocodeResult.longitude,
        businessCategory,
        500 // 500m radius for real competitors
      );

      console.log(`🏪 Found ${comparableVenues.length} comparable venues`);

      // Store raw competitive data without expensive getPlaceDetails calls
      rawCompetitiveVenues = comparableVenues.slice(0, 8).map(venue => ({
        name: venue.name,
        distance_meters: venue.distance_meters,
        rating: venue.rating,
        user_ratings_total: venue.user_ratings_total,
        price_level: venue.price_level,
        place_id: venue.place_id,
        types: venue.types || [],
      }));
      console.log(`✅ Stored ${rawCompetitiveVenues.length} raw competitive venues`);
    } catch (compError) {
      console.warn('⚠️ Could not fetch competitive venues:', compError);
      // Continue without competitive data - not critical
    }

    // Fetch hospitality venues via a dedicated 300m call so restaurant/cafe/bar
    // slots aren't crowded out by the general 1500m multi-type search.
    let hospitalityPlaces: any[] = [];
    try {
      hospitalityPlaces = await googleMaps.findHospitalityVenues(
        geocodeResult.latitude,
        geocodeResult.longitude,
        300
      );
      console.log(`✅ Found ${hospitalityPlaces.length} hospitality venues within 300m`);
    } catch (hospError) {
      console.warn('⚠️ Could not fetch hospitality venues:', hospError);
    }

    console.log(`[4/5] Analyzing location data...`);
    const analyzer = new LocationAnalyzer();
    const analyzedLocation = analyzer.analyze(geocodeResult, nearbyPlaces, hospitalityPlaces);

    // Validate Google's neighborhood against Google's city to catch mismatches
    // Example: Business in Silkeborg gets neighborhood="Aarhus" from Google → wrong!
    const googleCity = geocodeResult.city; // What Google returned as locality
    const googleNeighborhood = analyzedLocation.neighborhood;
    
    if (googleNeighborhood && googleCity) {
      // Check if neighborhood is actually a different major city
      const neighborhoodIsWrongCity = MAJOR_DANISH_CITIES.some(majorCity => 
        googleNeighborhood.toLowerCase() === majorCity.toLowerCase() &&
        googleCity.toLowerCase() !== majorCity.toLowerCase()
      );
      
      if (neighborhoodIsWrongCity) {
        console.warn(
          `⚠️ City mismatch detected: Google returned neighborhood="${googleNeighborhood}" ` +
          `for business in city="${googleCity}". Nulling out neighborhood to force synthesis.`
        );
        analyzedLocation.neighborhood = null;
      }
    }

    // Synthesize neighborhood from city + area_type if Google didn't provide one
    // OR if neighborhood is too generic (same as city name)
    if ((!analyzedLocation.neighborhood || analyzedLocation.neighborhood === city) && 
        city && 
        analyzedLocation.area_type) {
      analyzedLocation.neighborhood = synthesizeNeighborhoodFromAreaType(city, analyzedLocation.area_type);
      console.log(`🔧 Synthesized neighborhood: "${analyzedLocation.neighborhood}" from city="${city}" + area_type="${analyzedLocation.area_type}"`);
    } else if (!analyzedLocation.neighborhood && city) {
      // Minimal fallback: just use city name
      analyzedLocation.neighborhood = city;
      console.log(`🔧 Fallback neighborhood set to city: "${city}"`);
    }

    // Detect category modifiers (e.g., city_centre + shopping)
    const categoryModifiers: Record<string, string[]> = {};
    
    // Shopping detection: major department stores or high retail density
    if (nearbyPlaces && nearbyPlaces.length > 0) {
      const shoppingSignals = {
        majorStores: nearbyPlaces.filter(p => 
          p && 
          (p.type === 'department_store' || p.type === 'shopping_mall') &&
          p.distance_meters < 300 &&
          (p.user_ratings_total || 0) > 5000
        ),
        retailDensity: nearbyPlaces.filter(p => 
          p &&
          (p.type === 'shopping_mall' || p.type === 'department_store') &&
          p.distance_meters < 500
        ).length
      };
      
      const hasShoppingContext = shoppingSignals.majorStores.length >= 1 || shoppingSignals.retailDensity >= 3;
      const cityCentreScore = analyzedLocation.category_scores?.city_centre || 0;
      
      if (hasShoppingContext && cityCentreScore >= 60) {
        categoryModifiers.city_centre = categoryModifiers.city_centre || [];
        categoryModifiers.city_centre.push('shopping');
        
        console.log('🛍️ Shopping context detected:', {
          majorStores: shoppingSignals.majorStores.map(s => `${s.name} (${s.user_ratings_total} reviews, ${s.distance_meters}m)`),
          retailDensity: shoppingSignals.retailDensity,
          cityCentreScore: cityCentreScore
        });
      } else if (hasShoppingContext && cityCentreScore < 60) {
        console.log('ℹ️ Shopping context found but city_centre score too low:', {
          cityCentreScore: cityCentreScore,
          threshold: 60
        });
      }
    }
    
    // Add modifiers to analyzed location
    analyzedLocation.category_modifiers = categoryModifiers;

    // Add physical context - objective environment facts
    console.log('[4.1/5] Generating physical context...');
    analyzedLocation.physical_context = generatePhysicalContext(nearbyPlaces, geocodeResult);
    console.log(`✅ Physical context: pedestrian_flow=${analyzedLocation.physical_context.pedestrian_flow}, transit_within_150m=${analyzedLocation.physical_context.transit_within_150m}`);

    // Add raw competitive venues - uninterpreted competitor data
    if (rawCompetitiveVenues.length > 0) {
      analyzedLocation.raw_competitive_venues = rawCompetitiveVenues;
      console.log(`✅ Stored ${rawCompetitiveVenues.length} raw competitive venues`);
    }

    // Split category_scores into geographic and demographic proximity
    // Migration 20260522000002 created demographic_proximity as a separate column
    // LocationAnalyzer already returns them separately, so we just use what it provides
    console.log('[4.2/5] Location scores already split by analyzer...');
    console.log(`✅ Geographic scores: ${JSON.stringify(analyzedLocation.category_scores)}`);
    console.log(`✅ Demographic proximity: ${JSON.stringify(analyzedLocation.demographic_proximity)}`);

    // Generate neighborhood character with AI if API key available
    // AI now also generates ALL scores (geographic + demographic)
    if (openaiApiKey) {
      console.log('[4.3/5] AI location analysis (scores + neighborhood character)...');
      
      try {
        const aiAnalyzer = new AIAnalyzer(openaiApiKey);
        
        // Fetch profile data for context
        const { data: profileData } = await supabase
          .from('business_profile')
          .select('long_description')
          .eq('business_id', business_id)
          .maybeSingle();
        
        const claudeInput = {
          formatted_address: fullAddress,
          neighborhood: analyzedLocation.neighborhood,
          landmarks: analyzedLocation.landmarks_nearby,
          business_category: businessCategory,
          website_about: profileData?.long_description || undefined,
          area_type: null,  // AI determines this
          hospitality_count: hospitalityPlaces.length,
        };
        
        const aiResult = await aiAnalyzer.analyzeLocationContext(claudeInput);
        
        // FIX 1a: Add logging to confirm what AI returns
        console.log('🔍 AI location result:', {
          area_type: aiResult.area_type,
          neighborhood_character_length: aiResult.rich_neighborhood_character?.length || 0,
          neighborhood_character_preview: aiResult.rich_neighborhood_character?.substring(0, 80) || 'NULL',
          category_scores_keys: Object.keys(aiResult.category_scores || {}),
          demographic_keys: Object.keys(aiResult.demographic_proximity || {}),
        });
        
        // Validate AI returned usable scores
        const hasScores = Object.keys(aiResult.category_scores || {}).length > 0;
        const hasDemographics = Object.keys(aiResult.demographic_proximity || {}).length > 0;

        if (hasScores && hasDemographics) {
          // Replace analyzer's rule-based scores with AI's context-aware scores
          analyzedLocation.category_scores = aiResult.category_scores;
          analyzedLocation.demographic_proximity = aiResult.demographic_proximity;
          analyzedLocation.area_type = aiResult.area_type;
          analyzedLocation.neighborhood_character = aiResult.rich_neighborhood_character;
          
          // FIX 1d: Add fallback synthesis when AI returns null neighborhood_character
          if (!analyzedLocation.neighborhood_character && city) {
            // Minimal factual fallback — city name + area type in plain Danish
            // This is intentionally conservative: factual but not marketing language
            const areaTypeLabels: Record<string, string> = {
              city_centre:        'centrum',
              waterfront:         'ved havnen',
              residential:        'i et boligkvarter',
              office:             'i erhvervsområdet',
              shopping_district:  'i shoppingområdet',
              transport_hub:      'ved stationen',
              destination:        'som destinationssted',
              nature_park:        'ved naturområdet',
            };
            const areaLabel = areaTypeLabels[analyzedLocation.area_type] || 'i byen';
            analyzedLocation.neighborhood_character = `${city} ${areaLabel}.`;
            console.log(`🔧 Synthesized neighborhood_character fallback: "${analyzedLocation.neighborhood_character}"`);
          }
          
          console.log(`✅ AI scores: ${JSON.stringify(aiResult.category_scores)}`);
          console.log(`✅ Demographics: ${JSON.stringify(aiResult.demographic_proximity)}`);
          console.log(`✅ Area type: ${aiResult.area_type}`);
          console.log(`✅ Neighborhood character: ${aiResult.rich_neighborhood_character?.substring(0, 80)}...`);
        } else {
          console.warn('⚠️ AI returned empty scores — using POI fallback');
          applyPOIFallbackScores(analyzedLocation, nearbyPlaces, hospitalityPlaces);
        }
      } catch (error) {
        console.error('⚠️ AI location analysis failed — using POI fallback:', error);
        applyPOIFallbackScores(analyzedLocation, nearbyPlaces, hospitalityPlaces);
      }
    } else {
      console.log('[4.3/5] Skipping AI analysis (no OpenAI key) — using POI fallback');
      applyPOIFallbackScores(analyzedLocation, nearbyPlaces, hospitalityPlaces);
    }

    // Set pedestrian_flow now that we have area_type (from AI or fallback)
    analyzedLocation.physical_context.pedestrian_flow = derivePedestrianFlow(
      hospitalityPlaces,
      analyzedLocation.area_type || 'mixed_use'
    );
    console.log(`✅ Pedestrian flow: ${analyzedLocation.physical_context.pedestrian_flow} (${hospitalityPlaces.length} hospitality venues, area_type: ${analyzedLocation.area_type})`);

    console.log(`[5/5] Saving to database...`);
    
    // FIX 1c: Verify the save path - log what we're about to save
    console.log('💾 Saving neighborhood_character:', {
      value: analyzedLocation.neighborhood_character?.substring(0, 80) || 'NULL — will save null',
      is_null: analyzedLocation.neighborhood_character === null,
    });
    
    const saver = new DatabaseSaver(supabase);
    await saver.saveLocationIntelligence(business_id, analyzedLocation, LOCATION_SCHEMA_VERSION);

    console.log('✅ Location intelligence populated successfully!');
    console.log('ℹ️ Architecture: V2 - AI+web search scoring, graceful fallback, schema versioning');

    return new Response(
      JSON.stringify({
        success: true,
        location_intelligence: analyzedLocation,
        architecture_note: 'Scores generated by AI+web search. Strategy fields moved to Brand Profile.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error populating location intelligence:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
