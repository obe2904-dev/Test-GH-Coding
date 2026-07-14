// =====================================================
// Scrape Webhook - Receives Results from Cloud Run
// =====================================================
// Purpose: Cloud Run calls this when scraping completes

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
    const { job_id, status, payload, error } = await req.json();

    if (!job_id || !status) {
      throw new Error('job_id and status are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Map Cloud Run quality ratings to database values
    const mapQualityRating = (rating: string | null): string | null => {
      if (!rating) return null;
      switch (rating) {
        case 'excellent':
        case 'good':
          return 'rich';
        case 'partial':
          return 'thin';
        case 'poor':
        case 'failed':
          return 'shell';
        default:
          return 'thin'; // fallback
      }
    };

    if (status === 'completed' && payload) {
      // Update with successful scrape results
      const rawRating = payload.extraction?.quality?.rating || null;
      const mappedQuality = mapQualityRating(rawRating);
      
      const { error: updateError } = await supabase
        .from('website_scrape_results')
        .update({
          payload: payload,
          content_quality: mappedQuality,
          menu_source: payload.extraction?.services?.menu?.url ? 'scraped' : 'none',
          scraper_metadata: payload.scraper_metadata,
          scraped_at: new Date().toISOString()
        })
        .eq('id', job_id);

      if (updateError) {
        console.error('Failed to update completed job:', updateError);
        throw updateError;
      }

      console.log('Webhook: Updated completed job:', job_id);

      return new Response(
        JSON.stringify({ success: true, job_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (status === 'failed') {
      // Update with failure
      const { error: updateError } = await supabase
        .from('website_scrape_results')
        .update({
          payload: {
            status: 'failed',
            error: error || 'Unknown error',
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', job_id);

      if (updateError) {
        console.error('Failed to update failed job:', updateError);
        throw updateError;
      }

      console.log('Webhook: Updated failed job:', job_id);

      return new Response(
        JSON.stringify({ success: true, job_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      throw new Error(`Invalid status: ${status}`);
    }

  } catch (error) {
    console.error('Error in scrape-webhook:', error);
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
