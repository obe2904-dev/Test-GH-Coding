// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno import
import { createClient } from 'npm:@supabase/supabase-js@2.39.0'

// @ts-ignore - Deno global
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * ANALYZE WEBSITE V2 - Cost-Optimized AI Extraction
 * 
 * Architecture:
 * 1. Call Cloud Run /scrape-v2 to get preprocessed structured data (~5KB vs ~1.5MB)
 * 2. Use content quality gates to decide AI strategy:
 *    - 'shell' sites: Skip AI, return deterministic data only
 *    - 'thin' sites: Use minimal AI prompts
 *    - 'rich' sites: Full AI extraction on clean content
 * 3. Pass only relevant text to Gemini 2.5 Flash (~700 tokens vs ~110K)
 * 4. Cache results to avoid redundant scraping
 * 
 * Cost reduction: 55x cheaper per site (700 tokens vs 110K tokens)
 * Enables: AI for all requests (even free tier)
 */

interface ScrapedPayload {
  content_quality: 'rich' | 'thin' | 'shell'
  menu_source: 'inline' | 'link' | 'pdf' | 'none'
  
  meta?: {
    title?: string
    description?: string
    locale?: string
  }
  
  contact?: {
    email?: string
    phone?: string
    address?: string
  }
  
  links?: {
    booking?: string
    menu_url?: string
    takeaway?: string
    social?: string[]
    pdf_menus?: string[]
    raw?: Array<{ url: string; text: string }>
  }
  
  opening_hours?: {
    structured?: any[]
    text?: string
  }
  
  menu_text?: string
  about_text?: string
  full_text?: string

  opening_hours_raw?: string | null
  kitchen_close_time?: string | null
  weekly_programme?: string | null
}

function deriveServiceSignals(payload: ScrapedPayload) {
  const combinedText = [
    payload.meta?.title,
    payload.meta?.description,
    payload.about_text,
    payload.menu_text,
    payload.full_text,
    payload.opening_hours_raw,
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase()

  const rawBookingUrl = payload.links?.booking || null
  const takeawayUrl = payload.links?.takeaway || null

  const bookingUrl = rawBookingUrl && !/facebook\.com\/privacy|facebook\.com\/policies|\/privacy\/explanation/i.test(rawBookingUrl)
    ? rawBookingUrl
    : null

  const hasOutdoorSeating = /ude\s*servering|udeservering|outdoor seating|terrasse|terrace|gårdhave|ga?rdhave|patio|udenfor|al fresco/i.test(combinedText)
  const hasTableService = Boolean(bookingUrl) || /bordservice|bordbetjening|table service|servering|reserver|booking/i.test(combinedText)
  const hasTakeaway = Boolean(takeawayUrl) || /takeaway|take-away|take away|afhentning|levering|delivery|wolt|just eat|foodora/i.test(combinedText)

  return {
    booking_url: bookingUrl,
    bordservice: hasTableService,
    reservation_required: Boolean(bookingUrl),
    accepts_walk_ins: !Boolean(bookingUrl),
    takeaway: hasTakeaway,
    outdoor_seating: hasOutdoorSeating,
    service_tags: [
      bookingUrl ? 'booking' : null,
      hasTableService ? 'bordservice' : null,
      hasTakeaway ? 'takeaway' : null,
      hasOutdoorSeating ? 'outdoor_seating' : null,
    ].filter((tag): tag is string => Boolean(tag)),
  }
}

/**
 * Call Cloud Run v2 scraper to get preprocessed structured data
 */
async function getPreprocessedData(url: string): Promise<{
  success: boolean
  payload?: ScrapedPayload
  error?: string
  timing: number
}> {
  const startTime = Date.now()
  const cloudRunUrl = Deno.env.get('CLOUD_RUN_SCRAPER_URL')
  const cloudRunApiKey = Deno.env.get('CLOUD_RUN_API_KEY')
  
  if (!cloudRunUrl || !cloudRunApiKey) {
    return {
      success: false,
      error: 'Cloud Run not configured',
      timing: Date.now() - startTime
    }
  }
  
  const scrapeEndpoint = `${cloudRunUrl}/scrape-v2`
  
  console.log('🚀 [V2] Calling Cloud Run preprocessor:', url)
  
  try {
    const response = await fetch(scrapeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cloudRunApiKey
      },
      body: JSON.stringify({ url })
    })
    
    const timing = Date.now() - startTime
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Cloud Run HTTP error:', response.status, errorText)
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        timing
      }
    }
    
    const data = await response.json()
    
    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Scraper failed',
        timing
      }
    }
    
    // Remove scraper_metadata from payload to get clean data structure
    const { scraper_metadata, success, ...payload } = data
    
    console.log(`✅ [V2] Preprocessed data received - quality: ${payload.content_quality}, menu: ${payload.menu_source}`)
    console.log(`   Timing: ${timing}ms, Size: ${JSON.stringify(payload).length} bytes`)
    
    return {
      success: true,
      payload: payload as ScrapedPayload,
      timing
    }
    
  } catch (error: any) {
    return {
      success: false,
      error: `Cloud Run error: ${error.message}`,
      timing: Date.now() - startTime
    }
  }
}

/**
 * Extract business information using AI on preprocessed content
 * Uses decision gates based on content quality
 * Uses Gemini 2.5 Flash for cost efficiency
 */
async function extractWithAI(
  payload: ScrapedPayload,
  businessName?: string
): Promise<{
  about?: string
  description?: string
  venue_hooks?: string[]
  keywords?: string[]
  tone_of_voice?: string
  confidence_score: number
}> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
  
  if (!geminiApiKey) {
    console.error('❌ GEMINI_API_KEY not configured')
    return {
      about: payload.meta?.description || '',
      description: payload.meta?.description || '',
      venue_hooks: [],
      keywords: [],
      confidence_score: 0.5
    }
  }
  
  // Decision gate: Skip AI for shell sites (minimal content)
  if (payload.content_quality === 'shell') {
    console.log('⚠️ Shell site detected - skipping AI extraction')
    return {
      about: payload.meta?.description || '',
      description: payload.meta?.description || '',
      venue_hooks: [],
      keywords: [],
      confidence_score: 0.3
    }
  }
  
  // Prepare content for AI based on what's available
  const contentForAI = payload.about_text || payload.full_text?.substring(0, 3000) || ''
  
  if (contentForAI.length < 100) {
    console.log('⚠️ Insufficient content for AI extraction')
    return {
      about: payload.meta?.description || '',
      description: payload.meta?.description || '',
      venue_hooks: [],
      keywords: [],
      confidence_score: 0.4
    }
  }
  
  console.log(`🤖 [V2] Running Gemini 2.5 Flash extraction on ${contentForAI.length} chars (quality: ${payload.content_quality})`)
  
  const prompt = `You are analyzing a restaurant/venue website. Extract key information from this content.

Website: ${businessName || 'Unknown'}
Meta Title: ${payload.meta?.title || 'N/A'}
Meta Description: ${payload.meta?.description || 'N/A'}

Content:
${contentForAI}

Extract the following in JSON format:
{
  "about": "A concise 2-3 sentence description of the venue's identity and unique character",
  "description": "A longer 4-5 sentence description covering concept, atmosphere, offerings",
  "venue_hooks": ["3-5 compelling unique selling points or memorable features"],
  "keywords": ["5-8 key themes, cuisine types, or descriptors"],
  "tone_of_voice": "Brief description of the brand voice (e.g., 'casual and welcoming', 'refined and elegant')"
}

Be specific and factual. Use information from the actual content.`
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        }
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Gemini API error:', response.status, errorText)
      throw new Error(`Gemini API error: ${response.status}`)
    }
    
    const data = await response.json()
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!textContent) {
      console.error('❌ No content in Gemini response')
      throw new Error('No content in Gemini response')
    }
    
    const result = JSON.parse(textContent)
    
    const tokenCount = data.usageMetadata?.totalTokenCount || 0
    console.log(`✅ [V2] Gemini extraction complete - ${tokenCount} tokens used`)
    
    return {
      ...result,
      confidence_score: payload.content_quality === 'rich' ? 0.9 : 0.7
    }
    
  } catch (error: any) {
    console.error('❌ AI extraction failed:', error.message)
    return {
      about: payload.meta?.description || '',
      description: payload.meta?.description || '',
      venue_hooks: [],
      keywords: [],
      confidence_score: 0.5
    }
  }
}

/**
 * Extract menu information from preprocessed data
 */
function extractMenuInfo(payload: ScrapedPayload): {
  menu_signal?: string
  has_menu: boolean
  menu_url?: string
} {
  const result: any = {
    has_menu: false
  }
  
  // Check menu source
  if (payload.menu_source === 'inline' && payload.menu_text) {
    result.has_menu = true
    result.menu_signal = payload.menu_text.substring(0, 1000) // First 1000 chars as signal
  } else if (payload.menu_source === 'link' && payload.links?.menu_url) {
    result.has_menu = true
    result.menu_url = payload.links.menu_url
  } else if (payload.menu_source === 'pdf' && payload.links?.pdf_menus?.[0]) {
    result.has_menu = true
    result.menu_url = payload.links.pdf_menus[0]
  }
  
  return result
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { url, businessName, businessId, forceRefresh } = body

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing required field: url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🌐 [V2] Analyzing website:', url)
    console.log('   Business:', businessName || 'Unknown')
    console.log('   Force refresh:', !!forceRefresh)

    // STEP 1: Get preprocessed data from Cloud Run v2
    const scrapeResult = await getPreprocessedData(url)
    
    if (!scrapeResult.success || !scrapeResult.payload) {
      return new Response(
        JSON.stringify({
          success: false,
          error: scrapeResult.error || 'Scraping failed',
          timing: scrapeResult.timing
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const payload = scrapeResult.payload
    
    // STEP 2: Extract menu information (deterministic, no AI needed)
    const menuInfo = extractMenuInfo(payload)

    // STEP 2b: Derive service signals from the deterministic scraper payload
    const serviceSignals = deriveServiceSignals(payload)
    
    // STEP 3: Extract business information with AI (using content quality gates)
    const aiExtraction = await extractWithAI(payload, businessName)
    
    // STEP 4: Compile results
    const result = {
      success: true,
      version: 'v2',
      
      // Core metadata (deterministic)
      url,
      title: payload.meta?.title || '',
      meta_description: payload.meta?.description || '',
      
      // Contact info (deterministic)
      email: payload.contact?.email || null,
      phone: payload.contact?.phone || null,
      address: payload.contact?.address || null,
      
      // Links (deterministic)
      booking_url: serviceSignals.booking_url,
      menu_url: menuInfo.menu_url || null,
      takeaway_url: payload.links?.takeaway || null,
      social_links: payload.links?.social || [],
      
      // Opening hours (deterministic)
      opening_hours_text: payload.opening_hours?.text || payload.opening_hours_raw || null,
      opening_hours_structured: payload.opening_hours?.structured || null,
      kitchen_close_time: payload.kitchen_close_time || null,
      weekly_programme: payload.weekly_programme || null,
      
      // Menu (deterministic + AI)
      has_menu: menuInfo.has_menu,
      menu_signal: menuInfo.menu_signal || null,

      // Service signals (deterministic)
      services: serviceSignals,
      reservationRequired: serviceSignals.reservation_required,
      acceptsWalkIns: serviceSignals.accepts_walk_ins,
      
      // AI-extracted content
      about: aiExtraction.about || null,
      description: aiExtraction.description || null,
      venue_hooks: aiExtraction.venue_hooks || [],
      keywords: aiExtraction.keywords || [],
      tone_of_voice: aiExtraction.tone_of_voice || null,
      
      // Quality metrics
      content_quality: payload.content_quality,
      menu_source: payload.menu_source,
      confidence_score: aiExtraction.confidence_score,
      
      // Performance metrics
      timing: {
        total_ms: scrapeResult.timing,
        scraping_ms: scrapeResult.timing
      }
    }
    
    console.log('✅ [V2] Analysis complete')
    console.log(`   Quality: ${result.content_quality}, Menu: ${result.menu_source}`)
    console.log(`   Confidence: ${result.confidence_score}, Timing: ${result.timing.total_ms}ms`)
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ [V2] Error in analyze-website-v2:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
        version: 'v2'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
