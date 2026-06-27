// index.ts
// Quick Suggestions V2 - Segmentation-Driven Menu Ideas
// Simplified: Ideas only (no brand voice, no text generation)
// Brand voice → separate text generation function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import type {
  QuickSuggestionsRequest,
  QuickSuggestionsResponse,
  BusinessSegments,
  AudienceSegment,
  MenuItem,
  RecentPost,
  MenuSuggestion,
  Business,
  WeatherData,
  CalendarEvent,
  PromptContext
} from './types.ts'

import { getSegmentContext } from './segment-matcher.ts'
import {
  countryToLangCode,
  filterMenuByProgram,
  fuzzyFindMenuItem,
  isValidTimeFormat,
  getDefaultTime,
  daysAgo,
  isCacheStale,
  formatDate
} from './utils.ts'
import { CORS_HEADERS, TIER_LIMITS, TIMING, AI_CONFIG } from './constants.ts'

// ── Helper: Build AI Prompt ─────────────────────────────────────────────────
function buildPrompt(context: PromptContext): string {
  const {
    segment,
    menu,
    recentPosts,
    weather,
    events,
    isPreOpening,
    isNearClosing,
    count
  } = context
  
  const serviceStatus = isPreOpening
    ? `PLANNING AHEAD: It's before opening. You're planning posts for ${segment.name} service starting at ${segment.timing.startHour.toFixed(1).replace('.5', ':30').replace('.0', ':00')}.`
    : `CURRENT SERVICE: ${segment.name} is active now.`
  
  const weatherBlock = weather
    ? `\nWEATHER: ${weather.temp}°C, ${weather.conditions}${weather.suitable_for_outdoor ? ' (good for outdoor)' : ''}`
    : ''
  
  const eventsBlock = events && events.length > 0
    ? `\nSPECIAL TODAY: ${events.map(e => e.marketing_hook || e.name).join(', ')}`
    : ''
  
  const closingWarning = isNearClosing
    ? '\n⚠️ Service ending soon - prefer items that are quick to prepare and serve'
    : ''
  
  // If many items in recentPosts (Tier 3 scenario), make directive more explicit
  const isTier3 = recentPosts.length > menu.length * 0.8
  const recentBlock = recentPosts.length > 0
    ? isTier3
      ? `\n\nALL DISHES USED RECENTLY - Pick the LEAST recently used:\n${recentPosts.slice(0, 15).map(p => `- ${p.name} (${p.daysAgo === 0 ? 'today' : p.daysAgo === 1 ? 'yesterday' : `${p.daysAgo} days ago`})`).join('\n')}\n\nChoose from the TOP of this list (oldest = best).`
      : `\n\nAVOID (posted recently):\n${recentPosts.slice(0, 10).map(p => `- ${p.name} (${p.daysAgo === 0 ? 'today' : p.daysAgo === 1 ? 'yesterday' : `${p.daysAgo} days ago`})`).join('\n')}`
    : ''
  
  return `You are helping a restaurant choose which menu items to post on Instagram.

${serviceStatus}

TARGET AUDIENCE:
- ${segment.name}
- Motivation: ${segment.motivation}
- Decision type: ${segment.decision}
- Goal: ${segment.goal}

CONTENT ANGLES (use these as inspiration for posting_angle):
${segment.contentAngles.map(a => `- ${a}`).join('\n')}${weatherBlock}${eventsBlock}${closingWarning}

MENU (choose from "${segment.program}" program):
${menu.map(i => `- ${i.name}: ${i.description || ''}`).join('\n')}${recentBlock}

TASK:
Pick ${count} different menu items that best match this audience and moment.

For each item, explain:
1. why_now: Why this specific item fits this audience's motivation and timing
2. posting_angle: Which of the content angles above this uses (or similar)
3. suggested_time: When to post it (HH:MM format, must be in the future)

RULES:
- All ${count} items must be different
- Prefer items we haven't posted recently
- Match items to the audience's motivation and decision type
- Use the content angles as guidance for posting_angle

Return JSON with this exact structure:
{
  "suggestions": [
    {
      "menu_item_name": "exact name from menu above",
      "why_now": "explanation of why this item + this audience + this timing makes sense",
      "posting_angle": "which content angle or hook to use",
      "suggested_time": "HH:MM"
    }
  ]
}`
}

// ── Helper: Call Gemini AI ──────────────────────────────────────────────────
async function generateSuggestions(
  prompt: string,
  count: number
): Promise<Partial<MenuSuggestion>[]> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured')
  }
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: AI_CONFIG.TEMPERATURE,
            maxOutputTokens: AI_CONFIG.MAX_OUTPUT_TOKENS,
            responseMimeType: AI_CONFIG.RESPONSE_MIME_TYPE,
          }
        })
      }
    )
    
    if (!response.ok) {
      const error = await response.text()
      console.error('❌ Gemini API error:', error)
      throw new Error(`Gemini API failed: ${response.status}`)
    }
    
    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!text) {
      throw new Error('Empty response from Gemini')
    }
    
    // Parse JSON response
    const cleaned = text.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
    
    const parsed = JSON.parse(cleaned)
    
    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      throw new Error('Invalid response format from Gemini')
    }
    
    console.log(`✅ Gemini generated ${parsed.suggestions.length} suggestions`)
    
    // Validate that AI didn't invent dishes (should be impossible since menu is pre-filtered)
    const menuSet = new Set(menu.map(i => i.name.toLowerCase().trim()))
    const invented = parsed.suggestions.filter(s => !menuSet.has(s.menu_item_name?.toLowerCase().trim()))
    if (invented.length > 0) {
      console.warn(`⚠️ AI invented ${invented.length} dishes not on menu:`, invented.map(s => s.menu_item_name))
    }
    
    return parsed.suggestions
    
  } catch (error) {
    console.error('❌ AI generation failed:', error)
    throw error
  }
}

// ── Helper: Validate Suggestions ────────────────────────────────────────────
function validateSuggestions(
  suggestions: Partial<MenuSuggestion>[],
  menu: MenuItem[]
): Partial<MenuSuggestion>[] {
  return suggestions.map((s, idx) => {
    // Validate menu item exists
    if (!s.menu_item_name) {
      console.warn(`⚠️ Suggestion ${idx + 1}: No menu_item_name`)
      return null
    }
    
    const menuItem = fuzzyFindMenuItem(menu, s.menu_item_name)
    if (!menuItem) {
      console.warn(`⚠️ Suggestion ${idx + 1}: Item "${s.menu_item_name}" not in menu`)
      return null
    }
    
    // Update to exact menu name if fuzzy matched
    if (menuItem.name !== s.menu_item_name) {
      console.log(`📝 Fuzzy match: "${s.menu_item_name}" → "${menuItem.name}"`)
      s.menu_item_name = menuItem.name
    }
    
    // Validate time format
    if (!s.suggested_time || !isValidTimeFormat(s.suggested_time)) {
      console.warn(`⚠️ Suggestion ${idx + 1}: Invalid time "${s.suggested_time}", using default`)
      s.suggested_time = getDefaultTime()
    }
    
    // Ensure required fields exist
    s.why_now = s.why_now?.trim() || 'Relevant for current service'
    s.posting_angle = s.posting_angle?.trim() || 'Featured item'
    
    return s
  }).filter(Boolean) as Partial<MenuSuggestion>[]
}

// ── Main Handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  
  try {
    // Parse request
    const reqData: QuickSuggestionsRequest = await req.json()
    const {
      businessId,
      count = 3,
      tier = 'free',
      regenerate = false,
      clientTime
    } = reqData
    
    console.log('🎯 Quick Suggestions V2:', { businessId, count, tier, regenerate })
    
    if (!businessId) {
      return new Response(JSON.stringify({ error: 'businessId required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    
    // Client time (eliminates timezone issues)
    const clientNow = clientTime ? new Date(clientTime) : new Date()
    const today = formatDate(clientNow)
    
    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // TODO: Add authentication (from v1 security-audit.ts)
    // For now, skip auth in development
    
    // Check cache (unless regenerating)
    if (!regenerate) {
      const { data: cached } = await supabase
        .from('daily_suggestions')
        .select('*')
        .eq('business_id', businessId)
        .eq('date', today)
        .eq('is_active', true)
        .order('position')
        .limit(count)
      
      if (cached && cached.length > 0) {
        const firstCreated = cached[0].created_at
        if (!isCacheStale(firstCreated, clientNow, TIMING.CACHE_STALE_HOURS)) {
          console.log(`✅ Returning cached suggestions (${cached.length})`)
          return new Response(JSON.stringify({
            suggestions: cached,
            cached: true,
            segment_used: 'cached'
          } as QuickSuggestionsResponse), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          })
        }
      }
    }
    
    // Check quota
    if (regenerate) {
      const { data: business } = await supabase
        .from('businesses')
        .select('quick_suggestions_today')
        .eq('id', businessId)
        .single()
      
      const currentCount = business?.quick_suggestions_today || 0
      const limit = TIER_LIMITS[tier]?.dailyLimit || 3
      
      if (currentCount >= limit) {
        return new Response(JSON.stringify({
          error: 'DAILY_LIMIT_EXCEEDED',
          message: `Daily limit of ${limit} regenerations reached`,
          current: currentCount,
          limit
        }), {
          status: 429,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
      }
    }
    
    // Fetch all context in parallel
    console.log('📥 Fetching context...')
    const [
      businessData,
      programmesData,
      businessProfileData,
      recentPostsData,
      recentSuggestionsData
    ] = await Promise.all([
      // Business info
      supabase.from('businesses')
        .select('id, name, vertical, country')
        .eq('id', businessId)
        .single(),
      
      // Programme profiles with audience segments
      supabase.from('business_programme_profiles')
        .select('audience_segments')
        .eq('business_id', businessId),
      
      // Business profile with menu
      supabase.from('business_profile')
        .select('menu_signal')
        .eq('business_id', businessId)
        .single(),
      
      // Recent posts (actually published)
      supabase.from('posts')
        .select('menu_item_name, posted_at')
        .eq('business_id', businessId)
        .not('menu_item_name', 'is', null)
        .gte('posted_at', new Date(Date.now() - TIMING.RECENT_POSTS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString())
        .order('posted_at', { ascending: false }),
      
      // Recent suggestions (proposed but may not be posted)
      supabase.from('daily_suggestions')
        .select('menu_item_name, created_at')
        .eq('business_id', businessId)
        .eq('content_type', 'menu_item')
        .not('menu_item_name', 'is', null)
        .gte('created_at', new Date(Date.now() - TIMING.RECENT_POSTS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(42)
    ])
    
    const business = businessData.data as Business | null
    // Flatten audience_segments from all programmes
    const allProgrammes = programmesData.data || []
    const segments = allProgrammes.flatMap(p => p.audience_segments || [])
    const menuSignal = businessProfileData.data?.menu_signal
    const recentPostsRaw = recentPostsData.data || []
    const recentSuggestionsRaw = recentSuggestionsData.data || []
    
    if (!business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }
    
    if (segments.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No audience segments configured',
        message: 'Please complete audience segmentation setup first'
      }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }
    
    // Build recency map: dish name → days since last use
    // "Use" = posted (posts) OR suggested (daily_suggestions)
    const recencyMap = new Map<string, number>()
    
    for (const post of recentPostsRaw) {
      if (!post.menu_item_name) continue
      const key = post.menu_item_name.toLowerCase().trim()
      const days = daysAgo(post.posted_at, clientNow)
      if (!recencyMap.has(key) || days < recencyMap.get(key)!) {
        recencyMap.set(key, days)
      }
    }
    
    for (const suggestion of recentSuggestionsRaw) {
      if (!suggestion.menu_item_name) continue
      const key = suggestion.menu_item_name.toLowerCase().trim()
      const days = daysAgo(suggestion.created_at, clientNow)
      if (!recencyMap.has(key) || days < recencyMap.get(key)!) {
        recencyMap.set(key, days)
      }
    }
    
    console.log(`📊 Recency map: ${recencyMap.size} dishes tracked from ${recentPostsRaw.length} posts + ${recentSuggestionsRaw.length} suggestions`)
    
    // Parse menu (from menu_signal - signature items only)
    // TODO: Add support for menu_results_v2 with language filtering for paid tier
    let allMenuItems: MenuItem[] = menuSignal?.signatureItems?.map((name: string) => ({
      name,
      description: '',
      program: 'main'
    })) || []
    
    if (allMenuItems.length === 0) {
      return new Response(JSON.stringify({ error: 'No menu items found' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }
    
    const totalMenuItems = allMenuItems.length
    console.log(`📋 Total menu items: ${totalMenuItems}`)
    
    // ── TIERED MENU PRE-FILTER ──
    // Simplified version for testing
    const menu: MenuItem[] = allMenuItems
    const recentPosts: RecentPost[] = []
    console.log('🎯 Using all menu items, count:', allMenuItems.length)
    console.log('🔍 DEBUG: menu exists:', !!menu, 'length:', menu.length)
    
    // Get segment context (handles all edge cases)
    console.log('🔍 DEBUG: About to call getSegmentContext')
    const segmentContext = getSegmentContext(
      segments as AudienceSegment[],
      clientNow,
      undefined, // TODO: get kitchen_close_time from business_operations
      undefined, // TODO: fetch weather
      undefined  // TODO: fetch calendar events
    )
    
    if (!segmentContext) {
      return new Response(JSON.stringify({
        error: 'No active or upcoming segment found',
        message: 'Could not determine appropriate audience for current time'
      }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }
    
    // Filter menu by segment's program
    console.log('🔍 DEBUG: About to filter menu, menu exists:', !!menu, 'length:', menu.length)
    const programMenu = filterMenuByProgram(menu, segmentContext.segment.program)
    console.log('🔍 DEBUG: programMenu filtered, length:', programMenu.length)
    
    // Build prompt
    const promptContext: PromptContext = {
      segment: segmentContext.segment,
      menu: programMenu.length > 0 ? programMenu : menu, // Fallback to all menu
      recentPosts,
      weather: segmentContext.weatherContext,
      events: segmentContext.specialEvents,
      isPreOpening: segmentContext.isPreOpening,
      isNearClosing: segmentContext.isNearClosing,
      count
    }
    
    const prompt = buildPrompt(promptContext)
    
    // Generate suggestions (single AI call)
    console.log('🤖 Generating suggestions via Gemini...')
    const aiSuggestions = await generateSuggestions(prompt, count)
    
    // Validate
    const validated = validateSuggestions(aiSuggestions, menu)
    
    if (validated.length === 0) {
      throw new Error('No valid suggestions generated')
    }
    
    // Enhance with segment context
    const enriched: MenuSuggestion[] = validated.map(s => ({
      menu_item_name: s.menu_item_name!,
      why_now: s.why_now!,
      posting_angle: s.posting_angle!,
      segment_matched: segmentContext.segment.name,
      program: segmentContext.segment.program,
      suggested_time: s.suggested_time!,
      context: {
        motivation: segmentContext.segment.motivation,
        decision_type: segmentContext.segment.decision,
        goal: segmentContext.segment.goal
      }
    }))
    
    // Save to database
    const suggestionRows = enriched.map((s, idx) => ({
      business_id: businessId,
      title: '', // No title - that's text generation's job
      rationale: s.why_now,
      why_explanation: s.why_now,
      photo_idea: s.posting_angle,
      content_type: 'menu_item',
      suggested_time: s.suggested_time,
      date: today,
      position: idx + 1,
      is_active: true,
      menu_item_name: s.menu_item_name,
      caption_base: s.posting_angle,
    }))
    
    const { data: saved, error: saveError } = await supabase
      .from('daily_suggestions')
      .upsert(suggestionRows, { onConflict: 'business_id,date,position' })
      .select()
    
    if (saveError) {
      console.error('❌ Save error:', saveError)
      throw new Error('Failed to save suggestions')
    }
    
    // Increment quota counter
    if (regenerate) {
      await supabase
        .from('businesses')
        .update({ 
          quick_suggestions_today: supabase.raw('quick_suggestions_today + 1')
        })
        .eq('id', businessId)
    }
    
    console.log(`✅ Saved ${enriched.length} suggestions`)
    
    // Return response
    const response: QuickSuggestionsResponse = {
      suggestions: enriched,
      cached: false,
      segment_used: segmentContext.segment.name,
      generation_context: `${segmentContext.segment.name} (${segmentContext.segment.program})${segmentContext.isPreOpening ? ' - pre-opening' : ''}${segmentContext.isNearClosing ? ' - near closing' : ''}`
    }
    
    return new Response(JSON.stringify(response), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }
})
