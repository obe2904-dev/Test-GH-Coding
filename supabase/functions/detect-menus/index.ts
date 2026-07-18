// =====================================================
// Menu Detection Function
// =====================================================
// Purpose: Lightweight wrapper to detect menu URLs via Cloud Run scraper
// Used by: /dashboard/menu page (Step 1: "Find menusider")
// Flow: Frontend → detect-menus → Cloud Run → returns menu_all array

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DetectMenusRequest {
  url: string
  businessId?: string  // Optional, for logging only
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const startTime = Date.now()
    const { url, businessId }: DetectMenusRequest = await req.json()

    if (!url) {
      throw new Error('url is required')
    }

    console.log('🔍 Detecting menus for:', url, businessId ? `(business: ${businessId})` : '')

    // ==========================================
    // AUTHENTICATION
    // ==========================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid or expired token')
    }

    console.log('✅ User authenticated:', user.id)

    // ==========================================
    // TIER CHECK - Menu detection is paid-only
    // ==========================================
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('tier')
      .eq('user_id', user.id)
      .single()

    const tier = subscription?.tier || 'free'
    const isPaid = ['standardplus', 'premium'].includes(tier)

    if (!isPaid) {
      return new Response(
        JSON.stringify({
          error: 'Menu detection requires a paid subscription (Standard Plus or Premium)',
          tier,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('✅ Tier check passed:', tier)

    // ==========================================
    // CALL CLOUD RUN SCRAPER
    // ==========================================
    const cloudRunUrl = Deno.env.get('CLOUD_RUN_SCRAPER_URL') || 
                       'https://scraper-831683741713.europe-west1.run.app'
    const apiKey = Deno.env.get('CLOUD_RUN_API_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    console.log('📡 Calling Cloud Run scraper...')

    const scrapeResponse = await fetch(`${cloudRunUrl}/scrape-v3`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey || '',
      },
      body: JSON.stringify({ 
        url,
        business_id: businessId,
        openai_api_key: openaiApiKey,  // For AI Tier 2 classification
      }),
      signal: AbortSignal.timeout(65000),  // 65s timeout
    })

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text()
      console.error('❌ Scraper failed:', scrapeResponse.status, errorText)
      throw new Error(`Scraper failed: ${scrapeResponse.status} ${errorText}`)
    }

    const payload = await scrapeResponse.json()
    console.log('✅ Scrape complete')

    // ==========================================
    // EXTRACT MENU URLs
    // ==========================================
    const menuAll = payload.extraction?.services?.menu_all || []
    const detectedMenuUrls = menuAll.map((item: any) => item.url)

    console.log(`📋 Detected ${detectedMenuUrls.length} menu URL(s)`)
    
    // Count detection methods
    const detectionMethods = {
      keyword: 0,
      ai_verified: 0,
      iframe_platform: 0,
    }
    
    menuAll.forEach((item: any) => {
      const method = item.detection_method || 'keyword'
      if (method in detectionMethods) {
        detectionMethods[method as keyof typeof detectionMethods]++
      }
    })

    // ==========================================
    // RESPONSE
    // ==========================================
    const duration = Date.now() - startTime
    
    return new Response(
      JSON.stringify({
        success: true,
        detectedMenuUrls,
        metadata: {
          totalFound: detectedMenuUrls.length,
          detectionMethods,
          duration_ms: duration,
          scraper_version: 'cloud-run-v3',
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Menu detection failed',
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
