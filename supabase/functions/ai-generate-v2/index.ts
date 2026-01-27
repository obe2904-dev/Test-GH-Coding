// Main orchestrator for AI Generate V2
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { GenerationRequest, GenerationResponse, IdeaWithMetadata } from './types.ts'
import {
  fetchBusinessProfile,
  fetchMenuCatalog,
  fetchWeatherData,
  fetchPreviousPosts
} from './data-sources/index.ts'
import { generateSuggestions } from './generators/smart-generator.ts'
import { formatIdeasForPlatforms } from './generators/response-formatter.ts'
import { validateSuggestionsWithMetadata } from './validators/content-validator.ts'
import { enhanceIdeaWithComputedImpact } from './validators/impact-scorer.ts'
import { createIdeaPlan } from './generators/strategy-engine.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 AI Generate V2 - Request received')

    // Get authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError)
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Authenticated user:', user.id)

    // Parse request
    const requestBody: GenerationRequest = await req.json()
    const { business_id, count = 3, userTier } = requestBody

    // Use authenticated user ID (ignore user_id from request body for security)
    const userId = user.id

    // Tier check - V2 is for Smart/Pro only
    // TODO: Fetch tier from database if not provided
    const normalizedTier = (userTier || 'smart').toLowerCase() // Default to smart for testing
    if (!['smart', 'standardplus', 'premium'].includes(normalizedTier)) {
      console.warn(`⚠️ User tier "${userTier}" not eligible for V2`)
      return new Response(
        JSON.stringify({ 
          error: 'AI Generate V2 is available for Smart tier and above',
          requiredTier: 'smart',
          currentTier: userTier
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ User tier: ${normalizedTier} (eligible for V2)`)

    // Fetch all data sources in parallel
    console.log('📦 Fetching data sources...')
    const [businessProfile, menuCatalog, previousPosts] = await Promise.all([
      fetchBusinessProfile(userId, business_id),
      fetchMenuCatalog(userId),
      fetchPreviousPosts(userId, 10)
    ])

    if (!businessProfile) {
      return new Response(
        JSON.stringify({ error: 'Business profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch weather if location available
    let weather = null
    if (businessProfile.city) {
      weather = await fetchWeatherData(businessProfile.city, businessProfile.country)
    }

    // Build generation context
    const context: GenerationContext = {
      businessProfile,
      menuCatalog,
      weather: weather || undefined,
      previousPosts: previousPosts.length > 0 ? previousPosts : undefined,
      userTier: normalizedTier as 'smart' | 'standardplus' | 'premium',
      language: businessProfile.primary_language || 'da'
    }

    console.log('📊 Generation context assembled')

    // Generate ideas (platform-neutral)
    const startTime = Date.now()
    const ideas = await generateSuggestions(context, count)
    const generationTime = Date.now() - startTime

    console.log(`⏱️ Idea generation completed in ${generationTime}ms`)

    // Create ideaPlan for validation with graceful degradation
    const ideaPlan = createIdeaPlan(context)

    // Validate ideas with graceful degradation (never fails - uses fallback templates)
    console.log('🔍 Validating ideas with graceful degradation...')
    const validatedIdeas: IdeaWithMetadata[] = validateSuggestionsWithMetadata(
      ideas,
      businessProfile,
      menuCatalog,
      ideaPlan,
      previousPosts  // Pass previous posts for novelty checking
    )

    // Compute impact scores (replace AI guesses with heuristic scores)
    console.log('📊 Computing impact scores...')
    const ideasWithComputedImpact = validatedIdeas.map(idea => 
      enhanceIdeaWithComputedImpact(idea)
    )

    // Count sources for transparency
    const aiIdeas = ideasWithComputedImpact.filter(i => i.metadata.source === 'ai').length
    const fallbackIdeas = ideasWithComputedImpact.filter(i => i.metadata.source === 'fallback_template').length
    const autoFixedIdeas = ideasWithComputedImpact.filter(i => i.metadata.source === 'auto_fixed').length
    const totalWarnings = ideasWithComputedImpact.reduce((sum, i) => sum + (i.metadata.warnings?.length || 0), 0)

    console.log(`✅ Validation complete: ${aiIdeas} AI, ${fallbackIdeas} fallback, ${autoFixedIdeas} auto-fixed`)
    
    // Extract just the ideas for formatting
    const finalIdeas = ideasWithComputedImpact.map(v => v.idea)

    // Determine generation quality
    let generationQuality: 'full' | 'partial' | 'degraded' = 'full'
    if (fallbackIdeas > 0) {
      generationQuality = fallbackIdeas >= Math.ceil(count / 2) ? 'degraded' : 'partial'
    }

    // Format ideas for platforms
    console.log('🎨 Formatting ideas for platforms...')
    const formatted = formatIdeasForPlatforms(finalIdeas, businessProfile)

    // Build response
    const contextUsed: string[] = ['business_profile', 'menu']
    if (weather) contextUsed.push('weather')
    if (previousPosts.length > 0) contextUsed.push('previous_posts')

    const response: GenerationResponse = {
      ideas: finalIdeas,  // Legacy field for backwards compatibility
      ideasWithMetadata: ideasWithComputedImpact,  // New field with metadata + computed impact
      formatted,
      metadata: {
        model: 'gpt-4o',
        language: context.language,
        context_used: contextUsed,
        generated_at: new Date().toISOString()
      },
      summary: {
        generation_quality: generationQuality,
        ai_ideas: aiIdeas,
        fallback_ideas: fallbackIdeas,
        auto_fixed_ideas: autoFixedIdeas,
        warnings: totalWarnings,
        total_cost: `$${(generationTime / 1000 * 0.005).toFixed(4)}`,  // Rough estimate
        cost_saved: fallbackIdeas > 0 ? `$${(fallbackIdeas * 0.005).toFixed(4)}` : '$0.0000',
        impact_note: 'Impact scores are heuristically computed estimates (not AI guesses)'
      }
    }

    console.log(`✅ Response ready: ${finalIdeas.length} ideas (quality: ${generationQuality})`)

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Fatal error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
