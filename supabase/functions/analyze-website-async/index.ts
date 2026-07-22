// =====================================================
// Async Website Analysis - Initiate Scraping Job
// =====================================================
// Purpose: Start async scraping job, return immediately
// Timeout: 30s (only sets up job, doesn't wait for scraping)
// Related: _PLAN_ASYNC_SCRAPING_ARCHITECTURE.md

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeRequest {
  url: string;
  force_refresh?: boolean;
  callback_url?: string; // Optional webhook for frontend
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, force_refresh = false, callback_url }: AnalyzeRequest = await req.json();

    if (!url) {
      throw new Error('url is required');
    }

    const startTime = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ==========================================
    // AUTHENTICATION & BUSINESS RESOLUTION
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

    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, website_url')
      .eq('owner_id', user.id)
      .limit(1);

    if (businessError || !businesses || businesses.length === 0) {
      throw new Error('No business found for this user');
    }

    const business = businesses[0];
    const business_id = business.id;
    console.log('🏢 Business:', business_id, 'User:', user.id, 'URL:', url);

    // ==========================================
    // CHECK FOR DUPLICATE IN-PROGRESS JOBS (Idempotency)
    // ==========================================
    const { data: existingJob } = await supabase
      .from('scrape_jobs')
      .select('id, status, created_at, progress_percent')
      .eq('business_id', business_id)
      .eq('url', url)
      .in('status', ['pending', 'scraping', 'extracting'])
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingJob) {
      console.log('⚠️ Job already in progress:', existingJob.id);
      return new Response(
        JSON.stringify({
          job_id: existingJob.id,
          status: existingJob.status,
          progress_percent: existingJob.progress_percent,
          duplicate: true,
          message: 'Analysis already in progress',
          progress_url: `${supabaseUrl}/functions/v1/scrape-status/${existingJob.id}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // CHECK CACHE (24h) UNLESS FORCE REFRESH
    // ==========================================
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from('website_scrape_results')
        .select('id, scraped_at, payload, content_quality, extracted_data')
        .eq('url', url)
        .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('scraped_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Check if cache has extraction errors
      if (cached) {
        const extractedData = cached.extracted_data;
        const hasError = extractedData && typeof extractedData === 'string' && extractedData.includes('"error"');
        
        if (hasError) {
          console.log('⚠️ Cached scrape has extraction error - ignoring cache');
        } else {
          console.log('✅ Using cached scrape:', cached.id);
          
          // Trigger extraction on cached data
          const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-from-scrape`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ business_id }),
          });

          let extractionResult: any = {};
          if (extractResponse.ok) {
            extractionResult = await extractResponse.json();
          }

          // Update website_url
          await supabase
            .from('businesses')
            .update({ website_url: url })
            .eq('id', business_id);

          return new Response(
            JSON.stringify({
              cached: true,
              scrape_id: cached.id,
              quality: cached.content_quality,
              extraction_summary: extractionResult.summary,
              duration_ms: Date.now() - startTime,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // ==========================================
    // RATE LIMITING (Max 5 concurrent jobs per user)
    // ==========================================
    const { data: activeJobs } = await supabase
      .from('scrape_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business_id)
      .in('status', ['pending', 'scraping', 'extracting'])
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (activeJobs && activeJobs.length >= 5) {
      return new Response(
        JSON.stringify({
          error: 'Too many active jobs',
          message: 'You have 5 scraping jobs in progress. Please wait for one to complete.',
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ==========================================
    // CREATE SCRAPE JOB
    // ==========================================
    const estimatedDuration = 60000; // Base estimate: 60s
    const { data: job, error: jobError } = await supabase
      .from('scrape_jobs')
      .insert({
        business_id,
        url,
        status: 'pending',
        progress_percent: 0,
        current_step: 'Preparing scraper...',
        force_refresh,
        callback_url,
        initiated_by: user.id,
        estimated_completion_at: new Date(Date.now() + estimatedDuration).toISOString(),
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error(`Failed to create job: ${jobError?.message}`);
    }

    console.log('✅ Created job:', job.id);

    // ==========================================
    // TRIGGER CLOUD RUN SCRAPER (Async)
    // ==========================================
    const cloudRunUrl = Deno.env.get('CLOUD_RUN_SCRAPER_URL') || 
                       'https://scraper-831683741713.europe-west1.run.app';
    const apiKey = Deno.env.get('CLOUD_RUN_API_KEY');
    const webhookUrl = `${supabaseUrl}/functions/v1/scrape-completed`;

    // Trigger scraper (don't wait for response)
    fetch(`${cloudRunUrl}/scrape-v3-async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey || '',
      },
      body: JSON.stringify({ 
        url,
        job_id: job.id,
        business_id,
        webhook_url: webhookUrl,
        webhook_api_key: apiKey,
      }),
    }).catch(error => {
      console.error('❌ Failed to trigger scraper:', error);
      // Update job to failed
      supabase
        .from('scrape_jobs')
        .update({
          status: 'failed',
          error_message: 'Failed to start scraper',
          error_details: { error: error.message },
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .then(() => console.log('Updated job to failed'));
    });

    console.log('🚀 Triggered Cloud Run scraper for job:', job.id);

    // ==========================================
    // RETURN JOB IMMEDIATELY
    // ==========================================
    return new Response(
      JSON.stringify({
        job_id: job.id,
        status: 'pending',
        progress_percent: 0,
        estimated_duration_ms: estimatedDuration,
        progress_url: `${supabaseUrl}/functions/v1/scrape-status/${job.id}`,
        created_at: job.created_at,
      }),
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
