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

    // Get scraper response
    const scraperData = await scraperResponse.json();
    
    console.log('Raw scraper response keys:', Object.keys(scraperData));
    
    // Transform v3 response to v2 format for backward compatibility
    // v3 has: extraction{}, pages_crawled[{url, quality}], menu_discovery[]
    // v2 expects: pages_crawled[{url, page_data{html, visible_text, blocks}}]
    
    const transformedData: any = {
      success: scraperData.success,
      url: scraperData.extraction?.meta?.final_url || url,
      business_id: business_id,
      scraper_metadata: scraperData.scraper_metadata || {},
      pages_crawled: []
    };

    // Build page_data from extraction object
    if (scraperData.extraction) {
      const extraction = scraperData.extraction;
      
      // Create fake HTML from extracted content for v2 compatibility
      const fakeHtml = `
        <html>
          <head><title>${extraction.meta?.title || ''}</title></head>
          <body>
            ${extraction.business?.description?.value || ''}
            ${extraction.content_sections?.map((s: any) => `<section><h2>${s.heading || ''}</h2><p>${s.text || ''}</p></section>`).join('') || ''}
          </body>
        </html>
      `;
      
      // Extract visible text
      const visibleText = [
        extraction.business?.name?.value,
        extraction.business?.description?.value,
        ...extraction.content_sections?.map((s: any) => `${s.heading}\n${s.text}`) || []
      ].filter(Boolean).join('\n\n');
      
      transformedData.pages_crawled.push({
        url: extraction.meta?.final_url || url,
        page_data: {
          html: fakeHtml,
          visible_text: visibleText,
          blocks: extraction.content_sections || [],
          raw_extraction: extraction  // Keep original for reference
        }
      });
    }

    // Add menu discovery data
    if (scraperData.menu_discovery && scraperData.menu_discovery.length > 0) {
      transformedData.menu_discovery = scraperData.menu_discovery;
      transformedData.scraper_metadata.structure_type = scraperData.menu_discovery[0].structure;
    }

    console.log('Transformed v3 → v2:', {
      has_pages: transformedData.pages_crawled.length,
      has_page_data: !!transformedData.pages_crawled[0]?.page_data,
      structure: transformedData.scraper_metadata?.structure_type
    });
    
    return new Response(
      JSON.stringify(transformedData),
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
