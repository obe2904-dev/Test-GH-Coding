// =====================================================
// Scrape Menu - CORS Proxy for Cloud Run Scraper
// =====================================================
// Purpose: Proxy browser menu extraction requests to Cloud Run scraper
// Handles CORS, authentication, and error handling

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeMenuRequest {
  url: string;
  business_id: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, business_id }: ScrapeMenuRequest = await req.json();

    if (!url || !business_id) {
      return new Response(
        JSON.stringify({ error: 'url and business_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Cloud Run credentials
    const cloudRunUrl = Deno.env.get('CLOUD_RUN_SCRAPER_URL');
    const apiKey = Deno.env.get('CLOUD_RUN_API_KEY');

    if (!cloudRunUrl || !apiKey) {
      console.error('Cloud Run credentials missing');
      return new Response(
        JSON.stringify({ error: 'Scraper service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Proxying scrape request:', { url, business_id });

    // Call Cloud Run scraper
    const scraperResponse = await fetch(`${cloudRunUrl}/scrape-v3`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        url,
        business_id,
        extract_menu: true,
        extract_opening_hours: false,
      }),
    });

    if (!scraperResponse.ok) {
      const errorText = await scraperResponse.text();
      console.error('Cloud Run scraper failed:', scraperResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Scraper failed', 
          status: scraperResponse.status,
          details: errorText 
        }),
        { status: scraperResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return scraper response with CORS headers
    const scraperData = await scraperResponse.json();
    
    return new Response(
      JSON.stringify(scraperData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in scrape-menu proxy:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
