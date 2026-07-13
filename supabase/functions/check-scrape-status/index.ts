// =====================================================
// Check Scrape Job Status
// =====================================================
// Purpose: Poll this endpoint to check if scraping is complete

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const job_id = url.searchParams.get('job_id');

    if (!job_id) {
      throw new Error('job_id parameter is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: job, error } = await supabase
      .from('website_scrape_results')
      .select('id, scraped_at, scraper_payload, content_quality, menu_source, scraper_version, scraper_metadata')
      .eq('id', job_id)
      .single();

    if (error || !job) {
      console.error('Job not found:', job_id, error);
      return new Response(
        JSON.stringify({
          success: false,
          status: 'not_found',
          error: 'Job not found',
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if still processing
    const payload = job.scraper_payload as any;
    if (payload?.status === 'processing') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'processing',
          job_id: job.id,
          started_at: payload.started_at,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if failed
    if (payload?.status === 'failed') {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'failed',
          job_id: job.id,
          error: payload.error || 'Scraping failed',
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Completed successfully
    return new Response(
      JSON.stringify({
        success: true,
        status: 'completed',
        job_id: job.id,
        scraped_at: job.scraped_at,
        content_quality: job.content_quality,
        menu_source: job.menu_source,
        scraper_version: job.scraper_version,
        scraper_metadata: job.scraper_metadata,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-scrape-status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        status: 'error',
        error: error.message,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
