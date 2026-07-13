// =====================================================
// Start Async Scrape Job
// =====================================================
// Purpose: Immediately return job_id, trigger Cloud Run async
// Frontend will poll check-scrape-status for completion

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  business_id?: string;
  url: string;
  force_refresh?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let { business_id, url, force_refresh = false }: ScrapeRequest = await req.json();

    if (!url) {
      throw new Error('url is required');
    }

    // Normalize URL
    url = url.trim().toLowerCase();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for recent cache if not forcing refresh
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from('website_scrape_results')
        .select('id, scraped_at, scraper_payload, content_quality, menu_source')
        .eq('url', url)
        .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single();

      if (cached) {
        console.log('Returning cached result:', cached.id);
        return new Response(
          JSON.stringify({
            success: true,
            cached: true,
            job_id: cached.id,
            status: 'completed',
            scraped_at: cached.scraped_at,
            content_quality: cached.content_quality,
            menu_source: cached.menu_source,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create initial job record with status='processing'
    const { data: job, error: insertError } = await supabase
      .from('website_scrape_results')
      .insert({
        business_id: business_id || null,
        url,
        scraper_payload: { status: 'processing', started_at: new Date().toISOString() },
        scraper_version: 'cloud-run-v3',
        content_quality: null,
        menu_source: 'none',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to create job record:', insertError);
      throw insertError;
    }

    console.log('Created job:', job.id, 'for URL:', url);

    // Trigger Cloud Run async (fire and forget)
    const cloudRunUrl = Deno.env.get('CLOUD_RUN_SCRAPER_URL');
    const apiKey = Deno.env.get('CLOUD_RUN_API_KEY');

    if (!cloudRunUrl || !apiKey) {
      throw new Error('Cloud Run credentials not configured');
    }

    // Construct webhook URL
    const webhookUrl = `${supabaseUrl}/functions/v1/scrape-webhook`;

    // Fire async request - don't await, don't catch errors
    fetch(`${cloudRunUrl}/scrape-v3`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Job-ID': job.id,
        'X-Webhook-URL': webhookUrl,
      },
      body: JSON.stringify({ url }),
    }).catch(err => {
      // Log but don't block response
      console.error('Cloud Run trigger failed:', err);
    });

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        status: 'processing',
        message: 'Scraping started. Poll /check-scrape-status for completion.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in start-scrape-job:', error);
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
