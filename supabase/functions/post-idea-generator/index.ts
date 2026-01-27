/**
 * Post Idea Generator - Edge Function
 * 
 * Generates AI-powered post ideas using stable Brand Profile + dynamic context.
 * 
 * Architecture:
 * - Brand Profile: Loaded once, cached in memory (stable, rarely updated)
 * - Dynamic Context: Weather, time, events (fetched per request)
 * - Output: Post ideas with captions, photo suggestions, timing
 * 
 * v1.0 - Initial implementation with Brand Profile + dynamic context
 */

// @ts-ignore - Deno imports work at runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno imports work at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Weather service
import { 
  getWeatherForecast, 
  formatWeatherForPrompt, 
  analyzeWeatherOpportunities,
  type WeatherForecast 
} from '../_shared/post-helpers/weather.ts'

// Deno global type declaration
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In-memory cache for Brand Profiles (1 hour TTL)
const brandProfileCache = new Map<string, {
  profile: any
  locale: any
  loadedAt: number
}>()

const CACHE_TTL = 3600000 // 1 hour in milliseconds

// ============================================================================
// BRAND PROFILE LOADER
// ============================================================================

/**
 * Load Brand Profile from database with caching
 */
async function loadBrandProfile(supabase: any, businessId: string): Promise<{
  profile: any
  locale: { code: string, language: string, city?: string }
}> {
  const now = Date.now()
  
  // Check cache first
  const cached = brandProfileCache.get(businessId)
  if (cached && (now - cached.loadedAt) < CACHE_TTL) {
    console.log(`📦 Brand Profile loaded from cache (age: ${Math.round((now - cached.loadedAt) / 1000)}s)`)
    return { profile: cached.profile, locale: cached.locale }
  }
  
  // Load from database
  console.log('🔍 Loading Brand Profile from database...')
  const { data, error } = await supabase
    .from('business_brand_profile')
    .select(`
      *,
      businesses!inner(
        name,
        primary_language,
        country
      )
    `)
    .eq('business_id', businessId)
    .single()
  
  if (error || !data) {
    throw new Error(`Brand Profile not found for business ${businessId}`)
  }
  
  // Parse locale information
  const locale = {
    code: data.locale_code || 'da-DK',
    language: data.businesses.primary_language || 'da',
    city: data.locale_code?.split('-')[2] // Extract city from locale code (e.g., "da-DK-aarhus" → "aarhus")
  }
  
  // Structure profile data
  const profile = {
    brandEssence: data.brand_essence,
    toneOfVoice: data.tone_of_voice,
    contentFocus: data.content_focus,
    targetAudience: data.target_audience,
    contentPillars: data.content_pillars_jsonb || JSON.parse(data.content_pillars || '[]'),
    socialStyle: data.social_style_jsonb || JSON.parse(data.social_style || '{}'),
    thingsToAvoid: data.things_to_avoid_jsonb || JSON.parse(data.things_to_avoid || '[]'),
    voiceExamples: data.voice_examples_jsonb || JSON.parse(data.voice_examples || '[]'),
    voiceContext: data.voice_context_jsonb || JSON.parse(data.voice_context || '{}'),
    imagePreferences: data.image_preferences_jsonb || JSON.parse(data.image_preferences || '{}'),
    qualityStatus: data.quality_status || 'green',
    versionHash: data.version_hash
  }
  
  // Cache for future requests
  brandProfileCache.set(businessId, {
    profile,
    locale,
    loadedAt: now
  })
  
  console.log(`✅ Brand Profile loaded and cached (version: ${data.version_hash?.substring(0, 8)}...)`)
  return { profile, locale }
}

// ============================================================================
// DYNAMIC CONTEXT GATHERER
// ============================================================================

interface DynamicContext {
  time: {
    hour: number
    dayOfWeek: string
    isWeekend: boolean
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
    season: 'spring' | 'summer' | 'autumn' | 'winter'
  }
  weather?: {
    forecast: WeatherForecast[]
    formatted: string
    opportunities: string[]
  }
  suggestions: {
    timingAdvice: string
    contextualAngles: string[]
  }
}

/**
 * Gather dynamic context for post generation
 */
async function gatherDynamicContext(
  locale: { code: string, language: string, city?: string }
): Promise<DynamicContext> {
  
  const now = new Date()
  const hour = now.getHours()
  const dayOfWeek = now.toLocaleDateString(locale.code, { weekday: 'long' })
  const isWeekend = now.getDay() === 0 || now.getDay() === 6
  
  // Determine time of day
  let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
  if (hour >= 6 && hour < 12) timeOfDay = 'morning'
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon'
  else if (hour >= 17 && hour < 22) timeOfDay = 'evening'
  else timeOfDay = 'night'
  
  // Determine season (Northern Hemisphere)
  const month = now.getMonth() + 1
  let season: 'spring' | 'summer' | 'autumn' | 'winter'
  if (month >= 3 && month <= 5) season = 'spring'
  else if (month >= 6 && month <= 8) season = 'summer'
  else if (month >= 9 && month <= 11) season = 'autumn'
  else season = 'winter'
  
  // Fetch weather forecast (7 days)
  let weather: { forecast: WeatherForecast[], formatted: string, opportunities: string[] } | undefined
  if (locale.city) {
    try {
      console.log(`🌤️ Fetching weather for ${locale.city}...`)
      const forecast = await getWeatherForecast(locale.city, 7)
      if (forecast.length > 0) {
        weather = {
          forecast,
          formatted: formatWeatherForPrompt(forecast),
          opportunities: analyzeWeatherOpportunities(forecast)
        }
        console.log(`✅ Weather loaded: ${forecast.length} days, ${weather.opportunities.length} opportunities`)
      }
    } catch (error) {
      const err = error as Error
      console.warn(`⚠️ Weather fetch failed:`, err.message)
      // Continue without weather (graceful degradation)
    }
  }
  
  // Generate contextual suggestions
  const contextualAngles: string[] = []
  
  if (timeOfDay === 'morning') {
    contextualAngles.push('brunch/morgenmad angle')
    contextualAngles.push('fresh start/ny dag stemning')
  } else if (timeOfDay === 'afternoon') {
    contextualAngles.push('frokost/pausemoment angle')
    contextualAngles.push('workplace lunch/meeting spot')
  } else if (timeOfDay === 'evening') {
    contextualAngles.push('aftenmad/dining angle')
    contextualAngles.push('after-work drinks/social gathering')
  }
  
  if (isWeekend) {
    contextualAngles.push('weekend/leisure angle')
    contextualAngles.push('langsom tempo/tid til at nyde')
  } else {
    contextualAngles.push('weekday routine/hurtig service')
  }
  
  if (season === 'summer') {
    contextualAngles.push('outdoor seating/udeservering')
    contextualAngles.push('seasonal menu/fresh ingredients')
  } else if (season === 'winter') {
    contextualAngles.push('cozy interior/hygge stemning')
    contextualAngles.push('comfort food/varme retter')
  }
  
  // Add weather-specific angles
  if (weather?.opportunities) {
    contextualAngles.push(...weather.opportunities)
  }
  
  const timingAdvice = generateTimingAdvice(timeOfDay, dayOfWeek, isWeekend)
  
  return {
    time: {
      hour,
      dayOfWeek,
      isWeekend,
      timeOfDay,
      season
    },
    weather,
    suggestions: {
      timingAdvice,
      contextualAngles
    }
  }
}

function generateTimingAdvice(
  timeOfDay: string,
  dayOfWeek: string,
  isWeekend: boolean
): string {
  if (isWeekend && timeOfDay === 'morning') {
    return 'Best time: Weekend mornings (10-11 AM) for brunch content'
  } else if (!isWeekend && timeOfDay === 'afternoon') {
    return 'Best time: Weekday afternoons (2-4 PM) for lunch/break content'
  } else if (timeOfDay === 'evening') {
    return 'Best time: Evenings (5-7 PM) for dinner/after-work content'
  }
  return 'Post now for immediate engagement'
}

// ============================================================================
// POST GENERATION PROMPT
// ============================================================================

function buildPostGenerationPrompt(
  profile: any,
  context: DynamicContext,
  locale: { code: string, language: string, city?: string },
  userInput?: {
    draft?: string
    goal?: string
    platform?: string
  }
): string {
  
  const language = locale.language === 'da' ? 'Danish' : locale.language === 'de' ? 'German' : 'English'
  
  return `You are a social media expert helping a ${profile.targetAudience} business create engaging content.

# BRAND PROFILE (Stable DNA)

**Brand Essence:** ${profile.brandEssence}

**Tone of Voice:**
${profile.toneOfVoice}

**Content Focus:**
${profile.contentFocus}

**Content Pillars:**
${profile.contentPillars.map((p: any) => `- ${p.title}: ${p.description}`).join('\n')}

**Things to AVOID:**
${profile.thingsToAvoid.map((t: string) => `- ${t}`).join('\n')}

**Voice Examples:**
${profile.voiceExamples.slice(0, 3).map((ex: any) => `"${ex.text}"`).join('\n')}

# DYNAMIC CONTEXT (Today/Now)

**Time:** ${context.time.dayOfWeek}, ${context.time.timeOfDay} (${context.time.hour}:00)
**Season:** ${context.time.season}
**Weekend:** ${context.time.isWeekend ? 'Yes' : 'No'}

${context.weather ? context.weather.formatted : 'Weather: Data not available'}

**Contextual Angles (use these as inspiration):**
${context.suggestions.contextualAngles.map(a => `- ${a}`).join('\n')}

${userInput?.draft ? `\n# USER DRAFT TEXT\n\n"${userInput.draft}"\n` : ''}
${userInput?.goal ? `\n# USER GOAL\n\n${userInput.goal}\n` : ''}
${userInput?.platform ? `\n# PLATFORM\n\n${userInput.platform}\n` : ''}

# YOUR TASK

Generate 3 post ideas that:
1. Match the brand's tone of voice and content focus
2. Use the dynamic context (time of day, season, weekend/weekday)
3. Include at least ONE distinctive element from the Brand Essence
4. Avoid all words/phrases from "Things to AVOID" list

For each idea, provide:
- **Angle:** What makes this post timely and relevant NOW
- **Caption:** 2-3 sentences in ${language} following the tone of voice
- **Photo Suggestion:** What to shoot (specific scene, subject, lighting)
- **Best Time:** When to post this (specific time recommendation)

${userInput?.draft ? '\nIf a draft was provided, also include a "refined_caption" that improves the draft while keeping its core message.' : ''}

OUTPUT FORMAT (JSON):

{
  "ideas": [
    {
      "angle": "string",
      "caption": "string",
      "photoSuggestion": {
        "scene": "string",
        "subject": "string",
        "lighting": "string",
        "composition": "string"
      },
      "bestTime": "string",
      "pillarUsed": "string"
    }
  ]
  ${userInput?.draft ? ',\n  "refinedCaption": "string"' : ''}
}
`
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestId = `post-${Date.now().toString(36)}`
    const requestStartTime = Date.now()
    
    console.log(`[${requestId}] 📬 Incoming post idea generation request`)
    
    // Parse request
    const { businessId, draft, goal, platform } = await req.json()
    
    if (!businessId) {
      return new Response(
        JSON.stringify({ error: 'businessId is required' }),
        { status: 400, headers: corsHeaders }
      )
    }
    
    // Initialize Supabase client
    const authHeader = req.headers.get('Authorization')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = authHeader?.replace('Bearer ', '') || Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseClient = createClient(supabaseUrl, supabaseKey)
    
    // Step 1: Load Brand Profile (cached)
    console.log(`[${requestId}] 📚 Loading Brand Profile...`)
    const { profile, locale } = await loadBrandProfile(supabaseClient, businessId)
    
    // Step 2: Gather dynamic context
    console.log(`[${requestId}] 🌤️ Gathering dynamic context...`)
    const context = await gatherDynamicContext(locale)
    
    console.log(`[${requestId}] 📊 Context:`, {
      timeOfDay: context.time.timeOfDay,
      dayOfWeek: context.time.dayOfWeek,
      season: context.time.season,
      anglesCount: context.suggestions.contextualAngles.length
    })
    
    // Step 3: Build prompt
    const prompt = buildPostGenerationPrompt(profile, context, locale, {
      draft,
      goal,
      platform
    })
    
    // Step 4: Call OpenAI
    console.log(`[${requestId}] 🤖 Generating post ideas...`)
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-2024-11-20',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    const content = data.choices[0]?.message?.content
    
    if (!content) {
      throw new Error('No response from AI')
    }
    
    const result = JSON.parse(content)
    
    const totalDuration = Date.now() - requestStartTime
    console.log(`[${requestId}] ✅ Generated ${result.ideas?.length || 0} ideas in ${totalDuration}ms`)
    
    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        durationMs: totalDuration,
        brandProfile: {
          qualityStatus: profile.qualityStatus,
          versionHash: profile.versionHash?.substring(0, 8)
        },
        context: {
          timeOfDay: context.time.timeOfDay,
          dayOfWeek: context.time.dayOfWeek,
          season: context.time.season,
          timingAdvice: context.suggestions.timingAdvice
        },
        ideas: result.ideas,
        refinedCaption: result.refinedCaption
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    const err = error as Error
    console.error('Error generating post ideas:', err)
    return new Response(
      JSON.stringify({
        error: err.message || 'Internal server error',
        details: err.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
