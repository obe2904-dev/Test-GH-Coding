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

interface PopulateLocationRequest {
  business_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { business_id } = await req.json() as PopulateLocationRequest;

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
      console.log(`[1/6] Fetched address from business_locations: ${address}, ${city || 'Denmark'}`);
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
      console.log(`[1/6] Fetched address from businesses table: ${address}, ${city || 'Denmark'}`);
    }

    // ─────────────────────────────────────────────────────────
    // CACHE CHECK: skip all Google API calls if data is fresh
    // (same address, updated within last 30 days)
    // ─────────────────────────────────────────────────────────
    const CACHE_TTL_DAYS = 30;
    const { data: cachedIntel } = await supabase
      .from('business_location_intelligence')
      .select('last_updated_by_ai, neighborhood')
      .eq('business_id', business_id)
      .maybeSingle();

    if (cachedIntel?.last_updated_by_ai) {
      const cacheAgeDays =
        (Date.now() - new Date(cachedIntel.last_updated_by_ai).getTime()) /
        (1000 * 60 * 60 * 24);

      if (cacheAgeDays < CACHE_TTL_DAYS) {
        console.log(
          `✅ Cache hit: location data is ${Math.round(cacheAgeDays)} days old (< ${CACHE_TTL_DAYS} days). ` +
          `Returning cached result without calling Google Maps APIs.`
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
      } else {
        console.log(`⏰ Cache expired: ${Math.round(cacheAgeDays)} days old. Re-running full analysis.`);
      }
    }

    // Get business category and website URL if not already fetched
    let websiteUrl: string | null = null;
    if (!businessCategory || businessCategory === 'restaurant') {
      const { data: bizData } = await supabase
        .from('businesses')
        .select('category, website_url')
        .eq('id', business_id)
        .single();
      
      if (bizData?.category) {
        businessCategory = bizData.category;
      }
      if (bizData?.website_url) {
        websiteUrl = bizData.website_url;
      }
    }
    console.log(`[2/6] Geocoding address...`);
    const googleMaps = new GoogleMapsService(googleMapsApiKey);
    
    // Build full address
    const fullAddress = city ? `${address}, ${city}, Denmark` : `${address}, Denmark`;
    const geocodeResult = await googleMaps.geocodeAddress(fullAddress);

    console.log(`[3/6] Finding nearby places...`);
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

    // Fetch Google reviews for the business if we have a place_id
    let googleReviews: Array<{ text: string; rating: number; author: string }> = [];
    if (geocodeResult.place_id) {
      console.log(`[3.5/6] Fetching Google reviews...`);
      try {
        googleReviews = await googleMaps.getPlaceReviews(geocodeResult.place_id);
        console.log(`✅ Fetched ${googleReviews.length} Google reviews`);
      } catch (reviewError) {
        console.warn('⚠️ Could not fetch Google reviews:', reviewError);
        // Continue without reviews - not critical
      }
    }

    // Fetch competitive venues for market context
    console.log(`[3.6/6] Finding competitive venues...`);
    let competitiveContext: any[] = [];
    try {
      const comparableVenues = await googleMaps.findComparableVenues(
        geocodeResult.latitude,
        geocodeResult.longitude,
        businessCategory,
        500 // 500m radius for real competitors
      );

      console.log(`🏪 Found ${comparableVenues.length} comparable venues`);

      // Fetch details for top 4 comps only (Basic + Contact tier — no Atmosphere fields)
      const detailsPromises = comparableVenues.slice(0, 4).map(venue =>
        googleMaps.getPlaceDetails(venue.place_id, venue.distance_meters, {
          rating: venue.rating,
          user_ratings_total: venue.user_ratings_total,
          price_level: venue.price_level,
        })
      );

      const detailsResults = await Promise.all(detailsPromises);
      competitiveContext = detailsResults.filter(d => d !== null);

      console.log(`✅ Fetched details for ${competitiveContext.length} competitive venues (Basic+Contact tier only)`);
    } catch (compError) {
      console.warn('⚠️ Could not fetch competitive venues:', compError);
      // Continue without competitive data - not critical
    }

    console.log(`[4/6] Analyzing location data...`);
    const analyzer = new LocationAnalyzer();
    const analyzedLocation = analyzer.analyze(geocodeResult, nearbyPlaces);

    // Enhance with OpenAI if API key is available
    if (openaiApiKey) {
      console.log('[5/6] Enhancing with GPT-4o...');
      
      try {
        const aiAnalyzer = new AIAnalyzer(openaiApiKey);
        
        // Fetch profile data for context
        const { data: profileData } = await supabase
          .from('business_profile')
          .select('long_description')
          .eq('business_id', business_id)
          .maybeSingle();
        
        // Fetch opening hours to understand day vs night character
        const { data: operationsData } = await supabase
          .from('business_operations')
          .select('*')
          .eq('business_id', business_id)
          .maybeSingle();
        
        // Fetch comprehensive menu data for WHO/WHEN/WHY analysis
        let menuData: any = null;
        try {
          const { data: menuExtraction } = await supabase
            .from('menu_extractions')
            .select('extracted_data')
            .eq('business_id', business_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (menuExtraction?.extracted_data) {
            const data = menuExtraction.extracted_data;
            menuData = {
              categories: data.categories || [],
              menuTitle: data.menuTitle,
              availabilityTime: data.availabilityTime
            };
            
            const totalItems = menuData.categories.reduce(
              (sum: number, cat: any) => sum + (cat.items?.length || 0),
              0
            );
            console.log(`📋 Extracted menu: ${menuData.categories.length} categories, ${totalItems} items`);
            console.log(`   Categories: ${menuData.categories.map((c: any) => c.name).join(', ')}`);
          }
        } catch (menuError) {
          console.warn('⚠️ Could not fetch menu data:', menuError);
          // Continue without menu data - not critical
        }
        
        const claudeInput = {
          formatted_address: fullAddress,
          neighborhood: analyzedLocation.neighborhood,
          landmarks: analyzedLocation.landmarks_nearby,
          business_category: businessCategory,
          website_about: profileData?.long_description || undefined,
          area_type: analyzedLocation.area_type,
          opening_hours: operationsData?.opening_hours || undefined,
          late_night_hours: operationsData?.closing_time ? 
            (operationsData.closing_time > '22:00' ? true : false) : undefined,
        };
        
        const claudeAnalysis = await aiAnalyzer.analyzeLocationContext(claudeInput);
        
        // Replace neighborhood_character with GPT-4o's richer version
        analyzedLocation.neighborhood_character = claudeAnalysis.rich_neighborhood_character;
        
        // Log additional insights
        console.log('📍 Local terminology:', claudeAnalysis.local_terminology);
        console.log('🏛️ Unique landmarks:', claudeAnalysis.unique_visual_landmarks);
        console.log('🎯 Positioning angles:', claudeAnalysis.positioning_angles);
        console.log('⚡ Content triggers:', claudeAnalysis.content_triggers);
        
        // WHO/WHEN/WHY Analysis
        console.log('🔍 Analyzing WHO/WHEN/WHY...');
        
        // Construct structured input with comprehensive menu data
        const whoWhenWhyInput = {
          business: {
            name: businessCategory,
            type: businessCategory,
            about: profileData?.long_description,
            website_url: websiteUrl,
            menu_data: menuData,
            opening_hours: operationsData?.opening_hours,
            price_positioning: operationsData?.price_level,
            review_snippets: googleReviews.length > 0 ? googleReviews.map(r => ({
              text: r.text,
              rating: r.rating,
              source: 'Google'
            })) : undefined
          },
          location: {
            area_name: analyzedLocation.neighborhood || city || 'Denmark',
            vibe_description: analyzedLocation.neighborhood_character || analyzedLocation.area_type || 'Unknown area',
            anchors: analyzedLocation.landmarks_nearby.slice(0, 5).map(l => l.name),
            area_type: analyzedLocation.area_type
          },
          competitive_context: competitiveContext.length > 0 ? competitiveContext : undefined
        };
        
        const whoWhenWhyAnalysis = await aiAnalyzer.analyzeWhoWhenWhy(whoWhenWhyInput);
        
        // Add WHO/WHEN/WHY to analyzed location
        // Public versions (for user display - no competitor names)
        analyzedLocation.who_analysis = whoWhenWhyAnalysis.who;
        analyzedLocation.when_analysis = whoWhenWhyAnalysis.when;
        analyzedLocation.why_analysis = whoWhenWhyAnalysis.why;
        
        // Internal versions (for AI use - with competitor names)
        if (whoWhenWhyAnalysis.who_internal) {
          analyzedLocation.who_analysis_internal = whoWhenWhyAnalysis.who_internal;
          analyzedLocation.when_analysis_internal = whoWhenWhyAnalysis.when_internal;
          analyzedLocation.why_analysis_internal = whoWhenWhyAnalysis.why_internal;
        }
        
        console.log('✅ GPT-4o enhancement completed');
      } catch (error) {
        console.error('⚠️ GPT-4o enhancement failed, using basic analysis:', error);
        // Continue with basic analysis from LocationAnalyzer
      }
    } else {
      console.log('[5/6] Skipping GPT-4o enhancement (no API key)');
    }

    console.log(`[6/6] Saving to database...`);
    const saver = new DatabaseSaver(supabase);
    await saver.saveLocationIntelligence(business_id, analyzedLocation);

    console.log('✅ Location intelligence populated successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        location_intelligence: analyzedLocation,
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
