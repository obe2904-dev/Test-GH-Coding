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
const GEMINI_MODEL = 'gemini-2.5-flash'; // Ready for field-by-field extraction

interface ExtractionRequest {
  business_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { business_id }: ExtractionRequest = await req.json();

    if (!business_id) {
      throw new Error('business_id is required');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Fetch latest scrape result for this business
    const { data: scrapeResult, error: fetchError } = await supabaseClient
      .from('website_scrape_results')
      .select('*')
      .eq('business_id', business_id)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !scrapeResult) {
      throw new Error('No scrape result found for this business');
    }

    const payload = scrapeResult.payload;

    // Validate payload is not empty
    if (!payload || Object.keys(payload).length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payload is empty - cannot extract data',
          scrape_id: scrapeResult.id,
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Valid payload found:', {
      scrape_id: scrapeResult.id,
      business_id,
      scraped_at: scrapeResult.scraped_at,
      content_quality: payload.content_quality,
    });

    console.log('🔍 DEBUG: Payload structure:', Object.keys(payload));
    console.log('🔍 DEBUG: Full payload:', JSON.stringify(payload, null, 2));

    console.log('🔍 Starting field-by-field extraction...');
    console.log('📧 Checking for email in payload.extraction.contact.emails...');

    // Field-by-field extraction
    const extractionResults = {
      found: [] as string[],
      not_found: [] as string[],
      saved: [] as string[],
      errors: [] as string[],
    };

    // FIELD 1: Email
    let email = null;
    console.log('📧 Payload extraction.contact.emails:', payload.extraction?.contact?.emails);
    
    if (payload.extraction?.contact?.emails && 
        Array.isArray(payload.extraction.contact.emails) && 
        payload.extraction.contact.emails.length > 0) {
      email = payload.extraction.contact.emails[0].value;
      console.log('📧 Found email:', email);
      
      if (email) {
        extractionResults.found.push('email');
        
        // Save to business_locations
        try {
          console.log('💾 Attempting to save email to business_locations...');
          const { error: emailError } = await supabaseClient
            .from('business_locations')
            .update({ email })
            .eq('business_id', business_id);

          if (emailError) {
            throw emailError;
          }
          
          extractionResults.saved.push('email');
          console.log('✅ Saved email:', email);
        } catch (saveError) {
          extractionResults.errors.push(`email: ${saveError.message}`);
          console.error('❌ Failed to save email:', saveError);
        }
      }
    } else {
      console.log('❌ No email found in payload');
      extractionResults.not_found.push('email');
    }

    console.log('📊 Extraction complete:', extractionResults);

    return new Response(
      JSON.stringify({
        success: true,
        scrape_id: scrapeResult.id,
        business_id,
        scraped_at: scrapeResult.scraped_at,
        payload_valid: true,
        extraction: extractionResults,
        data: {
          email,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-from-scrape:', error);

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
