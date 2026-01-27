import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    console.log('📥 Extract menu PDF request received')

    const body = await req.json()
    const { businessId, pdfUrl, languageCode } = body

    if (!businessId || !pdfUrl) {
      throw new Error('Missing businessId or pdfUrl')
    }

    // Verify JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Initialize service role client for queue operations
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`🔄 Creating menu extraction job for business: ${businessId}`)

    // 1. Create menu_results record - the table IS the queue
    // Records with status='queued' are jobs waiting to be processed
    const { data: resultData, error: resultError } = await supabaseService
      .from('menu_results')
      .insert({
        business_id: businessId,
        pdf_url: pdfUrl,
        status: 'queued',  // This marks it as a job for the worker to pick up
        source_type: 'url',
        language_code: typeof languageCode === 'string' && languageCode.trim() ? languageCode.trim() : 'da',
      })
      .select('id')
      .single()

    if (resultError) {
      console.error('Error creating menu_results:', resultError)
      throw new Error('Failed to create result record')
    }

    const resultId = resultData.id
    console.log(`✅ Job queued with resultId: ${resultId}`)

    // The menu_results table IS our job queue - no need for pgmq
    // Cloud Run worker polls: SELECT * FROM menu_results WHERE status = 'queued' LIMIT 1
    // Then updates: UPDATE menu_results SET status = 'processing', ...
    // Then publishes results via Realtime when done

    // 2. Return result ID to frontend (client can subscribe to this via Realtime)
    return new Response(
      JSON.stringify({
        success: true,
        resultId: resultId,
        message: 'Menu extraction queued - processing will start shortly',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('❌ Extract menu PDF error:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to queue menu extraction',
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
