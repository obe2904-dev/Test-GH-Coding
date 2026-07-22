// =====================================================
// Unified Website Analysis - ASYNC DISPATCHER (v4)
// =====================================================
// Returns 202 + job_id immediately. Cloud Run writes the
// payload directly to website_scrape_results and calls
// scrape-webhook, which chains extract-from-scrape.
// The payload NEVER enters this worker.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeRequest {
  url: string;
  force_refresh?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, force_refresh = false }: AnalyzeRequest = await req.json();
    if (!url) throw new Error('url is required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ---- Auth & business resolution ----
    const authHeader = req.headers.get('authorization');
    if (!authHeader) throw new Error('Missing authorization header');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid or expired token');

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .single();
    if (businessError || !business) throw new Error('No business found for this user');
    const business_id = business.id;

    // ---- Cache check: METADATA ONLY, never select payload ----
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from('website_scrape_results')
        .select('id, scraped_at, content_quality, status, extraction_status')
        .eq('url', url)
        .eq('business_id', business_id)
        .eq('status', 'completed')
        .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('scraped_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached && cached.extraction_status !== 'failed') {
        // Re-run extraction on the cached scrape via the webhook path so the
        // client experience is identical (poll the same row).
        await supabase
          .from('website_scrape_results')
          .update({ extraction_status: 'pending' })
          .eq('id', cached.id);

        // Fire extraction chain without awaiting completion of heavy work:
        // the webhook handles chaining; here we invoke extract directly since
        // scraping is already done.
        fetch(`${supabaseUrl}/functions/v1/extract-from-scrape`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ business_id, scrape_id: cached.id }),
        }).catch((e) => console.error('cache-path extract dispatch failed:', e));

        await supabase.from('businesses').update({ website_url: url }).eq('id', business_id);

        return new Response(
          JSON.stringify({
            success: true,
            accepted: true,
            cached: true,
            job_id: cached.id,
            scrape_id: cached.id,
            quality: cached.content_quality,
          }),
          { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ---- Dedup guard: reuse an in-flight job for same business+url ----
    // Prevents double-click / double-dispatch creating two Cloud Run jobs.
    const { data: inFlight } = await supabase
      .from('website_scrape_results')
      .select('id')
      .eq('business_id', business_id)
      .eq('url', url)
      .eq('status', 'processing')
      .gte('scraped_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order('scraped_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inFlight) {
      return new Response(
        JSON.stringify({
          success: true,
          accepted: true,
          cached: false,
          deduplicated: true,
          job_id: inFlight.id,
          scrape_id: inFlight.id,
        }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Create processing row (the job anchor) ----
    const { data: jobRow, error: insertError } = await supabase
      .from('website_scrape_results')
      .insert({
        business_id,
        url,
        status: 'processing',
        extraction_status: 'pending',
        scraped_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        scraper_version: 'cloud-run-v4-async',
        payload: { status: 'processing' },
      })
      .select('id')
      .single();
    if (insertError) throw new Error(`Failed to create job: ${insertError.message}`);

    const job_id = jobRow.id;

    // ---- Dispatch Cloud Run (fire, short-await handshake only) ----
    const cloudRunUrl = Deno.env.get('CLOUD_RUN_SCRAPER_URL') ||
      'https://scraper-831683741713.europe-west1.run.app';
    const apiKey = Deno.env.get('CLOUD_RUN_API_KEY');
    const callback_url = `${supabaseUrl}/functions/v1/scrape-webhook`;

    // Short timeout: we only need Cloud Run to ACCEPT the job, not finish it.
    const dispatch = await fetch(`${cloudRunUrl}/scrape-v3`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey || '',
      },
      body: JSON.stringify({ url, job_id, callback_url, async: true }),
      signal: AbortSignal.timeout(10000),
    }).catch((e: Error) => {
      throw new Error(`Scraper dispatch failed: ${e.message}`);
    });

    if (!dispatch.ok && dispatch.status !== 202) {
      const errText = await dispatch.text();
      await supabase
        .from('website_scrape_results')
        .update({ status: 'failed', error: `dispatch: ${dispatch.status} ${errText}` })
        .eq('id', job_id);
      throw new Error(`Scraper rejected job: ${dispatch.status}`);
    }

    // Persist intended URL immediately so UI state is consistent even mid-job.
    await supabase.from('businesses').update({ website_url: url }).eq('id', business_id);

    return new Response(
      JSON.stringify({ success: true, accepted: true, cached: false, job_id, scrape_id: job_id }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
