// =====================================================
// Start Scrape Job (Synchronous)
// =====================================================
// Purpose: Call Cloud Run, wait for completion, return results immediately

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  url: string;
  force_refresh?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let { url, force_refresh = false }: ScrapeRequest = await req.json();

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

    // Extract user from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    // Resolve business_id from authenticated user
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .single();

    if (businessError || !business) {
      throw new Error('No business found for this user');
    }

    const business_id = business.id;
    console.log('Resolved business_id:', business_id, 'for user:', user.id);

    // Check for recent cache if not forcing refresh
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from('website_scrape_results')
        .select('id, scraped_at, payload, content_quality, menu_source')
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
        business_id: business_id,
        url,
        payload: { status: 'processing', started_at: new Date().toISOString() },
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

    // Get Cloud Run credentials
    const cloudRunUrl = Deno.env.get('CLOUD_RUN_SCRAPER_URL');
    const apiKey = Deno.env.get('CLOUD_RUN_API_KEY');

    if (!cloudRunUrl || !apiKey) {
      console.error('Cloud Run credentials missing:', { cloudRunUrl: !!cloudRunUrl, apiKey: !!apiKey });
      throw new Error('Cloud Run credentials not configured');
    }

    // Construct webhook URL
    const webhookUrl = `${supabaseUrl}/functions/v1/scrape-webhook`;
    
    console.log('Triggering Cloud Run:', {
      url: cloudRunUrl,
      endpoint: '/scrape-v3',
      job_id: job.id,
      webhook_url: webhookUrl
    });

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
          return 'thin';
      }
    };

    // Trigger Cloud Run and await response
    try {
      const cloudRunResponse = await fetch(`${cloudRunUrl}/scrape-v3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'X-Job-ID': job.id,
          'X-Webhook-URL': webhookUrl,
        },
        body: JSON.stringify({ url }),
      });
      
      console.log('Cloud Run responded:', cloudRunResponse.status, cloudRunResponse.statusText);
      
      if (!cloudRunResponse.ok) {
        throw new Error(`Cloud Run returned ${cloudRunResponse.status}`);
      }

      const payload = await cloudRunResponse.json();
      console.log('Cloud Run payload received, updating database...');

      // Update database with results
      const rawRating = payload.extraction?.quality?.rating || null;
      const mappedQuality = mapQualityRating(rawRating);
      const hasMenuUrl = payload.extraction?.services?.menu?.url;
      
      const { error: updateError } = await supabase
        .from('website_scrape_results')
        .update({
          payload: payload,
          content_quality: mappedQuality,
          menu_source: hasMenuUrl ? 'link' : 'none',
          scraper_metadata: payload.scraper_metadata,
          scraped_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (updateError) {
        console.error('Failed to update job with results:', updateError);
        throw updateError;
      }

      console.log('Successfully updated job:', job.id);

      // Return completed result immediately
      return new Response(
        JSON.stringify({
          success: true,
          job_id: job.id,
          status: 'completed',
          content_quality: mappedQuality,
          menu_source: hasMenuUrl ? 'link' : 'none',
          scraped_at: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (err) {
      console.error('Cloud Run scraping failed:', err);
      
      // Update job as failed
      await supabase
        .from('website_scrape_results')
        .update({
          payload: {
            status: 'failed',
            error: err.message,
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', job.id);

      throw err;
    }

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
