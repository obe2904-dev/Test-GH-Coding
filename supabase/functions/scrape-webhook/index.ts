// =====================================================
// Scrape Webhook (v2) - completion signal from Cloud Run
// =====================================================
// Receives ONLY metadata: { job_id, status, quality, menu_source, error }.
// The payload was already written to website_scrape_results by Cloud Run.
// Responsibilities: authenticate caller, flip status, chain extraction,
// queue menu enrichment.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ---- Authenticate the caller (Cloud Run) ----
    const secret = Deno.env.get('SCRAPE_WEBHOOK_SECRET');
    if (secret && req.headers.get('x-webhook-secret') !== secret) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { job_id, status, quality, menu_source, menu_pages_queued, error } = await req.json();
    if (!job_id || !status) throw new Error('job_id and status are required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Map Cloud Run quality ratings to database enum
    const mapQuality = (r: string | null): string | null => {
      if (!r) return null;
      if (r === 'excellent' || r === 'good') return 'rich';
      if (r === 'partial') return 'thin';
      if (r === 'poor' || r === 'failed') return 'shell';
      return 'thin';
    };

    if (status === 'failed') {
      const { error: updateError } = await supabase
        .from('website_scrape_results')
        .update({
          status: 'failed',
          error: error || 'Unknown scraper error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job_id);
      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, job_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (status !== 'completed') throw new Error(`Invalid status: ${status}`);

    // ---- Defensive check: verify Cloud Run actually wrote the payload ----
    // Guards against a future refactor calling the webhook before the DB PATCH.
    // Selects only a derived boolean, never the payload itself.
    const { data: check, error: checkError } = await supabase
      .from('website_scrape_results')
      .select('business_id, payload->status')
      .eq('id', job_id)
      .single();
    if (checkError) throw checkError;

    const payloadStatus = (check as any)?.status ?? (check as any)?.['payload->status'];
    if (payloadStatus === 'processing') {
      // Payload is still the placeholder — Cloud Run called the webhook too early.
      await supabase
        .from('website_scrape_results')
        .update({
          status: 'failed',
          extraction_status: 'failed',
          error: 'Webhook called before payload write (Cloud Run ordering bug)',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job_id);
      throw new Error('Payload not written before webhook call');
    }

    // ---- Flip scrape status (payload already in the row, written by Cloud Run) ----
    const { data: row, error: updateError } = await supabase
      .from('website_scrape_results')
      .update({
        status: 'completed',
        content_quality: mapQuality(quality || null),
        menu_source: menu_source || 'none',
        completed_at: new Date().toISOString(),
        extraction_status: 'running',
      })
      .eq('id', job_id)
      .select('business_id')
      .single();
    if (updateError) throw updateError;

    const business_id = row.business_id;

    // ---- Queue menu enrichment jobs (metadata list, small) ----
    if (Array.isArray(menu_pages_queued) && menu_pages_queued.length > 0) {
      const jobInserts = menu_pages_queued.map((p: { url: string }) => ({
        url: p.url,
        business_id,
        job_type: 'menu_enrichment',
        status: 'pending',
        created_at: new Date().toISOString(),
      }));
      const { error: queueError } = await supabase.from('scrape_jobs').insert(jobInserts);
      if (queueError) console.warn('⚠ Failed to queue menu jobs:', queueError.message);
    }

    // ---- Chain extraction (server-side; reads payload from DB itself) ----
    const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-from-scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ business_id, scrape_id: job_id }),
    });

    if (!extractResponse.ok) {
      const errText = await extractResponse.text();
      await supabase
        .from('website_scrape_results')
        .update({ extraction_status: 'failed', error: `extraction: ${errText.slice(0, 500)}` })
        .eq('id', job_id);
    } else {
      const extractionResult = await extractResponse.json();
      await supabase
        .from('website_scrape_results')
        .update({
          extraction_status: 'completed',
          extraction_summary: extractionResult.summary ?? extractionResult.extraction ?? null,
        })
        .eq('id', job_id);
    }

    return new Response(JSON.stringify({ success: true, job_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in scrape-webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
