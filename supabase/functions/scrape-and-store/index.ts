// =====================================================
// Step 1: Scrape website and store in database
// =====================================================
// Purpose: Separate scraping (expensive) from AI extraction (cheap)
// This function ONLY scrapes and stores - no AI calls

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  business_id: string;
  url: string;
  force_refresh?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { business_id, url, force_refresh = false }: ScrapeRequest = await req.json();

    if (!business_id || !url) {
      throw new Error('business_id and url are required');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Check if we have a recent scrape (unless force_refresh)
    if (!force_refresh) {
      const { data: existing } = await supabaseClient
        .from('website_scrape_results')
        .select('*')
        .eq('business_id', business_id)
        .eq('url_normalized', url.toLowerCase().replace(/\/$/, ''))
        .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 24h cache
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({
            success: true,
            cached: true,
            scrape_id: existing.id,
            scraped_at: existing.scraped_at,
            content_quality: existing.content_quality,
            menu_source: existing.menu_source,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Call Cloud Run scraper
    const cloudRunUrl = Deno.env.get('CLOUD_RUN_SCRAPER_URL');
    const apiKey = Deno.env.get('CLOUD_RUN_API_KEY');

    if (!cloudRunUrl || !apiKey) {
      throw new Error('Cloud Run configuration missing');
    }

    console.log('Calling Cloud Run scraper:', url);
    const scrapeStart = Date.now();

    const response = await fetch(`${cloudRunUrl}/scrape-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`Cloud Run error: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const scrapeDuration = Date.now() - scrapeStart;

    console.log('Scrape complete:', {
      content_quality: payload.content_quality,
      menu_source: payload.menu_source,
      duration_ms: scrapeDuration,
    });

    // Store in database
    const { data: scrapeResult, error: insertError } = await supabaseClient
      .from('website_scrape_results')
      .insert({
        business_id,
        url,
        scraped_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        scraper_version: 'cloud-run-v2',
        scraper_metadata: {
          duration_ms: scrapeDuration,
          revision: 'scraper-00013-7ss',
        },
        content_quality: payload.content_quality,
        menu_source: payload.menu_source,
        content_char_count: payload.full_text?.length || 0,
        raw_size_bytes: JSON.stringify(payload).length,
        payload,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        scrape_id: scrapeResult.id,
        scraped_at: scrapeResult.scraped_at,
        content_quality: scrapeResult.content_quality,
        menu_source: scrapeResult.menu_source,
        scraping_ms: scrapeDuration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scrape-and-store:', error);
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
