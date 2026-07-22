// =====================================================
// Scrape Completed Webhook
// =====================================================
// Purpose: Receive callback from Cloud Run when scraping finishes
// Timeout: 150s (runs extraction)
// Auth: API key from Cloud Run
// Related: _PLAN_ASYNC_SCRAPING_ARCHITECTURE.md

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  job_id: string;
  scrape_result_id: string;
  status: 'success' | 'partial' | 'failed';
  pages_crawled: number;
  duration_ms: number;
  quality_rating?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    console.log('📨 Webhook received:', payload);

    // ==========================================
    // VALIDATE API KEY
    // ==========================================
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('CLOUD_RUN_API_KEY');

    if (!apiKey || apiKey !== expectedKey) {
      console.error('❌ Invalid API key');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { job_id, scrape_result_id, status, pages_crawled, duration_ms, error: scrapeError } = payload;

    if (!job_id || !scrape_result_id) {
      throw new Error('job_id and scrape_result_id are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ==========================================
    // GET JOB DETAILS
    // ==========================================
    const { data: job, error: jobError } = await supabase
      .from('scrape_jobs')
      .select('id, business_id, url, status')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      console.error('❌ Job not found:', job_id);
      return new Response(
        JSON.stringify({ error: 'Job not found', job_id }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Found job:', job.id, 'Status:', job.status);

    // ==========================================
    // UPDATE JOB TO EXTRACTING STATUS
    // ==========================================
    await supabase
      .from('scrape_jobs')
      .update({
        status: 'extracting',
        progress_percent: 85,
        current_step: 'Processing data with AI...',
        started_at: job.status === 'pending' ? new Date().toISOString() : undefined,
        pages_crawled,
        scrape_result_id,
      })
      .eq('id', job_id);

    console.log('🔄 Updated job to extracting');

    // ==========================================
    // HANDLE FAILED SCRAPE
    // ==========================================
    if (status === 'failed') {
      await supabase
        .from('scrape_jobs')
        .update({
          status: 'failed',
          progress_percent: 0,
          error_message: scrapeError || 'Scraper failed',
          error_details: { scraper_error: scrapeError },
          completed_at: new Date().toISOString(),
          duration_ms,
        })
        .eq('id', job_id);

      console.log('❌ Marked job as failed');

      return new Response(
        JSON.stringify({
          acknowledged: true,
          extraction_started: false,
          status: 'failed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // RUN EXTRACTION (3-tier architecture)
    // ==========================================
    console.log('🤖 Starting extraction for business:', job.business_id);

    let extractionResult: any = {};
    let extractionError: string | null = null;

    try {
      const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-from-scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ business_id: job.business_id }),
      });

      if (!extractResponse.ok) {
        const errorText = await extractResponse.text();
        throw new Error(`Extraction failed: ${extractResponse.status} ${errorText}`);
      }

      extractionResult = await extractResponse.json();
      console.log('✅ Extraction complete:', extractionResult.summary);

    } catch (error) {
      extractionError = error instanceof Error ? error.message : 'Unknown extraction error';
      console.error('❌ Extraction error:', extractionError);
    }

    // ==========================================
    // UPDATE JOB TO COMPLETED
    // ==========================================
    const finalStatus = extractionError ? 'failed' : 'completed';
    const progressPercent = extractionError ? 90 : 100;

    await supabase
      .from('scrape_jobs')
      .update({
        status: finalStatus,
        progress_percent: progressPercent,
        current_step: extractionError ? 'Extraction failed' : 'Complete',
        completed_at: new Date().toISOString(),
        duration_ms,
        error_message: extractionError,
        error_details: extractionError ? { extraction_error: extractionError } : null,
      })
      .eq('id', job_id);

    console.log(`✅ Job ${finalStatus}:`, job_id);

    // ==========================================
    // UPDATE WEBSITE URL
    // ==========================================
    await supabase
      .from('businesses')
      .update({ website_url: job.url })
      .eq('id', job.business_id);

    // ==========================================
    // TRIGGER FRONTEND CALLBACK (if provided)
    // ==========================================
    const { data: jobWithCallback } = await supabase
      .from('scrape_jobs')
      .select('callback_url')
      .eq('id', job_id)
      .single();

    if (jobWithCallback?.callback_url) {
      console.log('📞 Triggering frontend callback:', jobWithCallback.callback_url);
      
      fetch(jobWithCallback.callback_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id,
          status: finalStatus,
          scrape_result_id,
        }),
      }).catch(err => console.error('⚠️ Frontend callback failed:', err));
    }

    // ==========================================
    // RETURN SUCCESS
    // ==========================================
    return new Response(
      JSON.stringify({
        acknowledged: true,
        extraction_started: true,
        status: finalStatus,
        extraction_summary: extractionResult.summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
