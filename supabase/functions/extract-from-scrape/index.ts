// =====================================================
// Step 2: AI Extraction from stored scrape data
// =====================================================
// Purpose: Extract structured data using AI without re-scraping
// Can be re-run multiple times with different prompts/models

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.5-flash';
const EXTRACTION_PROMPT_VERSION = 'v2';

interface ExtractionRequest {
  scrape_id: string;
  force_reextract?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { scrape_id, force_reextract = false }: ExtractionRequest = await req.json();

    if (!scrape_id) {
      throw new Error('scrape_id is required');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Fetch scrape result
    const { data: scrapeResult, error: fetchError } = await supabaseClient
      .from('website_scrape_results')
      .select('*')
      .eq('id', scrape_id)
      .single();

    if (fetchError || !scrapeResult) {
      throw new Error('Scrape result not found');
    }

    // Check if already extracted (unless force_reextract)
    if (!force_reextract && scrapeResult.extracted_at) {
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          scrape_id,
          extracted_data: scrapeResult.extracted_data,
          extracted_at: scrapeResult.extracted_at,
          extraction_model: scrapeResult.extraction_model,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = scrapeResult.payload;
    const extractionStart = Date.now();

    // Determine extraction strategy based on content quality
    let extractedData = null;

    if (payload.content_quality === 'shell') {
      console.log('Shell content - skipping AI extraction');
      extractedData = {
        about: null,
        description: null,
        venue_hooks: [],
        keywords: [],
        tone_of_voice: null,
        confidence_score: 0,
        skip_reason: 'insufficient_content',
      };
    } else {
      // Build prompt based on content quality
      const prompt = buildExtractionPrompt(payload);
      
      console.log('Calling Gemini API...', {
        model: GEMINI_MODEL,
        content_quality: payload.content_quality,
        prompt_length: prompt.length,
      });

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!geminiResponse.ok) {
        throw new Error(`Gemini API error: ${geminiResponse.status}`);
      }

      const geminiData = await geminiResponse.json();
      const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        throw new Error('No response from Gemini');
      }

      extractedData = JSON.parse(responseText);
    }

    const extractionDuration = Date.now() - extractionStart;

    console.log('Extraction complete:', {
      duration_ms: extractionDuration,
      confidence: extractedData?.confidence_score,
    });

    // Update database with extraction results
    const { error: updateError } = await supabaseClient
      .from('website_scrape_results')
      .update({
        extracted_at: new Date().toISOString(),
        extracted_data: extractedData,
        extraction_model: GEMINI_MODEL,
        extraction_prompt_version: EXTRACTION_PROMPT_VERSION,
        extraction_attempts: scrapeResult.extraction_attempts + 1,
      })
      .eq('id', scrape_id);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw updateError;
    }

    // Write extracted data to business tables (if not shell content)
    if (payload.content_quality !== 'shell') {
      try {
        await writeExtractedDataToBusinessTables(
          supabaseClient,
          scrapeResult.business_id,
          payload,
          extractedData
        );
      } catch (writeError) {
        console.error('Failed to write to business tables:', writeError);
        // Don't fail the entire request - extraction still succeeded
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        scrape_id,
        extracted_data: extractedData,
        extraction_ms: extractionDuration,
        extraction_model: GEMINI_MODEL,
        extraction_prompt_version: EXTRACTION_PROMPT_VERSION,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-from-scrape:', error);
    
    // Log error to database if we have a scrape_id
    try {
      const { scrape_id } = await req.json();
      if (scrape_id) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );
        
        await supabaseClient
          .from('website_scrape_results')
          .update({
            last_extraction_error: error.message,
            extraction_attempts: supabaseClient.from('website_scrape_results').select('extraction_attempts').eq('id', scrape_id).single().then(d => (d.data?.extraction_attempts || 0) + 1),
          })
          .eq('id', scrape_id);
      }
    } catch (logError) {
      console.error('Failed to log error to database:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// =====================================================
// Database Write Functions
// =====================================================

/**
 * Write extracted data to business_profile and business_operations tables
 * Only writes if field is currently NULL/empty (user data always wins)
 */
async function writeExtractedDataToBusinessTables(
  supabase: any,
  businessId: string,
  payload: any,
  extractedData: any
) {
  console.log('Writing extracted data to business tables...', { businessId });

  // Update businesses.last_scraped_at
  await supabase
    .from('businesses')
    .update({ last_scraped_at: new Date().toISOString() })
    .eq('id', businessId);

  // ===== business_profile updates =====
  const profileUpdates: any = {};

  // Scraped fields (deterministic) - v3 payload structure
  const extraction = payload.extraction || payload; // Support both v2 and v3
  const meta = extraction.meta || payload.meta;
  const services = extraction.services || {};
  const business = extraction.business || {};

  if (meta?.title && !await fieldHasValue(supabase, 'business_profile', 'meta_tags', businessId)) {
    profileUpdates.meta_tags = {
      title: meta.title,
      description: meta.description,
      og_title: meta.og_title,
      og_description: meta.og_description,
      og_image: meta.og_image,
      keywords: meta.keywords,
      locale: meta.locale,
    };
  }

  if (services.takeaway?.url && !await fieldHasValue(supabase, 'business_profile', 'takeaway_url', businessId)) {
    profileUpdates.takeaway_url = services.takeaway.url;
  }

  // AI-extracted fields
  if (extractedData.about && !await fieldHasValue(supabase, 'business_profile', 'about_text', businessId)) {
    profileUpdates.about_text = extractedData.about;
  }

  if (extractedData.description && !await fieldHasValue(supabase, 'business_profile', 'description', businessId)) {
    profileUpdates.description = extractedData.description;
  }

  if (Object.keys(profileUpdates).length > 0) {
    console.log('Updating business_profile:', profileUpdates);
    await supabase
      .from('business_profile')
      .update(profileUpdates)
      .eq('business_id', businessId);
  }

  // ===== business_operations updates =====
  const operationsUpdates: any = {};

  // Scraped fields - v3 structure
  if (services.food_inspection?.url && !await fieldHasValue(supabase, 'business_operations', 'smiley_url', businessId)) {
    operationsUpdates.smiley_url = services.food_inspection.url;
  }

  if (services.booking?.url && !await fieldHasValue(supabase, 'business_operations', 'booking_url', businessId)) {
    operationsUpdates.booking_url = services.booking.url;
  }

  if (services.menu?.url && !await fieldHasValue(supabase, 'business_operations', 'menu_url', businessId)) {
    operationsUpdates.menu_url = services.menu.url;
  }

  // AI-extracted services (only if services object exists)
  if (extractedData.services) {
    const serviceMapping = {
      has_table_service: 'has_table_service',
      has_takeaway: 'has_takeaway',
      has_delivery: 'has_delivery',
      has_outdoor_seating: 'has_outdoor_seating',
      has_wifi: 'has_wifi',
      has_power_outlets: 'has_power_outlets',
      has_parking: 'has_parking',
      reservation_required: 'reservation_required',
      has_kids_menu: 'has_kids_menu',
    };

    for (const [aiKey, dbKey] of Object.entries(serviceMapping)) {
      if (extractedData.services[aiKey] === true && !await fieldHasValue(supabase, 'business_operations', dbKey, businessId)) {
        operationsUpdates[dbKey] = true;
      }
    }
  }

  if (Object.keys(operationsUpdates).length > 0) {
    console.log('Updating business_operations:', operationsUpdates);
    await supabase
      .from('business_operations')
      .update(operationsUpdates)
      .eq('business_id', businessId);
  }

  // ===== business_locations updates =====
  const locationUpdates: any = {};

  if (payload.contact?.address && extractedData.verified_fields?.address_verified) {
    if (!await fieldHasValue(supabase, 'business_locations', 'address_line1', businessId)) {
      locationUpdates.address_line1 = payload.contact.address;
    }
  }

  if (payload.contact?.phone && !await fieldHasValue(supabase, 'business_locations', 'phone', businessId)) {
    locationUpdates.phone = payload.contact.phone;
  }

  if (payload.contact?.email && !await fieldHasValue(supabase, 'business_locations', 'email', businessId)) {
    locationUpdates.email = payload.contact.email;
  }

  if (payload.google_maps_url && !await fieldHasValue(supabase, 'business_locations', 'google_maps_url', businessId)) {
    locationUpdates.google_maps_url = payload.google_maps_url;
  }

  if (Object.keys(locationUpdates).length > 0) {
    console.log('Updating business_locations:', locationUpdates);
    await supabase
      .from('business_locations')
      .update(locationUpdates)
      .eq('business_id', businessId);
  }

  console.log('Database writes complete');
}

/**
 * Check if a field already has a non-null/non-empty value
 */
async function fieldHasValue(supabase: any, table: string, field: string, businessId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(table)
    .select(field)
    .eq('business_id', businessId)
    .single();

  if (error || !data) return false;
  
  const value = data[field];
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (typeof value === 'object' && Object.keys(value).length === 0) return false;
  
  return true;
}

function buildExtractionPrompt(payload: any): string {
  const isRich = payload.content_quality === 'rich';
  
  return `Analyze this restaurant/venue website data and extract structured information.

SCRAPED DATA:
${JSON.stringify({
  meta: payload.meta,
  contact: payload.contact,
  opening_hours_raw: payload.opening_hours_raw,
  kitchen_close_time: payload.kitchen_close_time,
  weekly_programme: payload.weekly_programme,
  google_maps_url: payload.google_maps_url,
  smiley_url: payload.smiley_url,
  about_text: payload.about_text,
  full_text: isRich ? payload.full_text : payload.full_text?.substring(0, 2000),
  menu_text: payload.menu_text?.substring(0, 500),
  links: payload.links,
}, null, 2)}

IMPORTANT DANISH SERVICE TYPES (detect from text):
- Bordservice (table service)
- Takeaway (afhentning)
- Levering (delivery)
- Udeservering (outdoor seating)
- Wi-Fi
- Stikkontakter (power outlets)
- Parkering (parking)
- Reservation påkrævet (reservation required)
- Børnemenu (kids menu)

Extract and return JSON with:
{
  "about": "2-3 sentence brand story/concept (Danish if website is Danish, else English)",
  "description": "1 sentence venue description for metadata",
  "venue_hooks": ["hook1", "hook2", "hook3"], // 3-5 compelling reasons to visit
  "keywords": ["keyword1", "keyword2"], // 5-8 SEO keywords
  "tone_of_voice": "warm_inviting|sophisticated_refined|casual_fun|authentic_local",
  "services": {
    "has_table_service": boolean,
    "has_takeaway": boolean,
    "has_delivery": boolean,
    "has_outdoor_seating": boolean,
    "has_wifi": boolean,
    "has_power_outlets": boolean,
    "has_parking": boolean,
    "reservation_required": boolean,
    "has_kids_menu": boolean
  },
  "verified_fields": {
    "address_verified": boolean,  // true if scraped address looks valid
    "hours_verified": boolean,    // true if opening hours clearly present
    "kitchen_close_verified": boolean  // true if kitchen close time is accurate
  },
  "confidence_score": 0.0-1.0 // how confident you are in this extraction
}

${isRich ? 'RICH CONTENT: Extract detailed information.' : 'THIN CONTENT: Be conservative, extract only what is clearly present.'}

For services: only set true if you find clear evidence in the text. Default to false if uncertain.
For verified_fields: validate the scraped data - mark true only if it looks correct and complete.`;
}
