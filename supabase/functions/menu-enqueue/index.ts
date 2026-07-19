// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno ESM import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// @ts-ignore - Deno global
declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const { businessId, sourceId, sourceUrl, languageCode } = await req.json()

    if (!businessId || !sourceUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: businessId, sourceUrl',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Verify business exists
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .maybeSingle()

    if (businessError) {
      console.error('[menu-enqueue] Business query failed:', businessError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to verify business',
          errorCode: 'business_query_failed',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!business) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Business not found',
          errorCode: 'business_not_found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check for existing queued/processing job for this source
    if (sourceId) {
      const { data: existingJobs } = await supabase
        .from('menu_results_v2')
        .select('id, status')
        .eq('source_id', sourceId)
        .in('status', ['queued', 'processing'])
        .limit(1)

      if (existingJobs && existingJobs.length > 0) {
        console.log(`[menu-enqueue] Reusing existing job: ${existingJobs[0].id}`)
        return new Response(
          JSON.stringify({
            success: true,
            resultId: existingJobs[0].id,
            status: existingJobs[0].status,
            reused: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Insert queued job
    const { data: resultRow, error: insertError } = await supabase
      .from('menu_results_v2')
      .insert({
        business_id: businessId,
        source_id: sourceId || null,
        source_kind: 'url',
        source_url: sourceUrl,
        status: 'queued',
        language_code: languageCode || 'da',
        attempts: 0,
      })
      .select('id, status')
      .single()

    if (insertError) {
      console.error('[menu-enqueue] Insert failed:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
      })

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create menu extraction job',
          errorCode: 'job_insert_failed',
          details: insertError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!resultRow?.id || resultRow.status !== 'queued') {
      console.error('[menu-enqueue] Insert returned invalid result:', resultRow)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Menu job insert returned an invalid result',
          errorCode: 'invalid_insert_result',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`[menu-enqueue] Created job ${resultRow.id} for business ${businessId}`)

    return new Response(
      JSON.stringify({
        success: true,
        resultId: resultRow.id,
        status: resultRow.status,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[menu-enqueue] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        errorCode: 'internal_error',
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
