// =====================================================
// Get Scrape Job Status
// =====================================================
// Purpose: Return current status of async scraping job
// Timeout: 10s (read-only query)
// Related: _PLAN_ASYNC_SCRAPING_ARCHITECTURE.md

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
    // Extract job_id from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const job_id = pathParts[pathParts.length - 1];

    if (!job_id || job_id === 'scrape-status') {
      throw new Error('job_id is required in URL path');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ==========================================
    // AUTHENTICATION
    // ==========================================
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    // ==========================================
    // GET JOB STATUS
    // ==========================================
    const { data: job, error: jobError } = await supabase
      .from('scrape_jobs')
      .select(`
        id,
        business_id,
        url,
        status,
        progress_percent,
        current_step,
        pages_crawled,
        created_at,
        started_at,
        completed_at,
        estimated_completion_at,
        duration_ms,
        error_message,
        error_details,
        scrape_type,
        scrape_result_id
      `)
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({
          error: 'Job not found',
          job_id,
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ==========================================
    // VERIFY USER OWNS THIS JOB
    // ==========================================
    const { data: business } = await supabase
      .from('businesses')
      .select('id, owner_id')
      .eq('id', job.business_id)
      .single();

    if (!business || business.owner_id !== user.id) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'You do not have access to this job',
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ==========================================
    // CALCULATE TIMING METRICS
    // ==========================================
    const now = Date.now();
    const createdAt = new Date(job.created_at).getTime();
    const elapsedMs = now - createdAt;
    
    let estimatedTimeRemainingMs: number | undefined;
    if (job.status === 'scraping' || job.status === 'extracting') {
      const estimatedTotal = job.estimated_completion_at 
        ? new Date(job.estimated_completion_at).getTime() - createdAt
        : 60000; // Default 60s
      estimatedTimeRemainingMs = Math.max(0, estimatedTotal - elapsedMs);
    }

    // ==========================================
    // BUILD RESPONSE BASED ON STATUS
    // ==========================================
    const baseResponse = {
      job_id: job.id,
      status: job.status,
      progress_percent: job.progress_percent,
      current_step: job.current_step,
      pages_crawled: job.pages_crawled,
      created_at: job.created_at,
      started_at: job.started_at,
      elapsed_ms: elapsedMs,
    };

    // If completed, include results
    if (job.status === 'completed' && job.scrape_result_id) {
      const { data: scrapeResult } = await supabase
        .from('website_scrape_results')
        .select('id, content_quality, menu_source, extracted_data')
        .eq('id', job.scrape_result_id)
        .single();

      if (scrapeResult) {
        const extractionSummary = scrapeResult.extracted_data?.summary || {};
        
        return new Response(
          JSON.stringify({
            ...baseResponse,
            completed_at: job.completed_at,
            duration_ms: job.duration_ms,
            result: {
              scrape_id: scrapeResult.id,
              quality: scrapeResult.content_quality,
              menu_source: scrapeResult.menu_source,
              extraction_summary: extractionSummary,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // If failed, include error details
    if (job.status === 'failed') {
      return new Response(
        JSON.stringify({
          ...baseResponse,
          completed_at: job.completed_at,
          error: job.error_message,
          error_details: job.error_details,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If in progress, include time estimates
    if (job.status === 'scraping' || job.status === 'extracting' || job.status === 'pending') {
      return new Response(
        JSON.stringify({
          ...baseResponse,
          estimated_completion_at: job.estimated_completion_at,
          estimated_time_remaining_ms: estimatedTimeRemainingMs,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default response
    return new Response(
      JSON.stringify(baseResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
