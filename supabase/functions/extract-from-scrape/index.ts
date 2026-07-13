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
const GEMINI_MODEL = 'gemini-2.0-flash-exp';
const EXTRACTION_PROMPT_VERSION = 'v1';

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

function buildExtractionPrompt(payload: any): string {
  const isRich = payload.content_quality === 'rich';
  
  return `Analyze this restaurant/venue website data and extract structured information.

SCRAPED DATA:
${JSON.stringify({
  meta: payload.meta,
  about_text: payload.about_text,
  full_text: isRich ? payload.full_text : payload.full_text?.substring(0, 2000),
  menu_text: payload.menu_text?.substring(0, 500),
  links: payload.links,
}, null, 2)}

Extract and return JSON with:
{
  "about": "2-3 sentence brand story/concept (Danish if website is Danish, else English)",
  "description": "1 sentence venue description for metadata",
  "venue_hooks": ["hook1", "hook2", "hook3"] // 3-5 compelling reasons to visit,
  "keywords": ["keyword1", "keyword2"] // 5-8 SEO keywords,
  "tone_of_voice": "warm_inviting|sophisticated_refined|casual_fun|authentic_local",
  "confidence_score": 0.0-1.0 // how confident you are in this extraction
}

${isRich ? 'RICH CONTENT: Extract detailed information.' : 'THIN CONTENT: Be conservative, extract only what is clearly present.'}`;
}
