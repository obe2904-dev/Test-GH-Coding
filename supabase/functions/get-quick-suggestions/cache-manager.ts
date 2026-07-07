// Cache management for get-quick-suggestions
// Extracted June 24, 2026

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type {
  CacheCheckResult,
  CacheValidationOptions,
  CachedSuggestion,
  QuickSuggestionsResponse,
} from './types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Check for cached suggestions and determine if they should be used
 * 
 * @param options - Cache validation options
 * @returns Cache check result with decision and cached data if applicable
 */
export async function checkCache(
  options: CacheValidationOptions
): Promise<CacheCheckResult> {
  const { businessId, today, count, clientNow, regenerate, supabase, debug } = options

  console.log('🔍 Cache check:', { businessId, date: today, regenerate, count })

  // Skip cache if explicit regeneration requested
  if (regenerate) {
    console.log('🔄 Regeneration requested - generating fresh suggestions and upserting by (business_id,date,position)')
    return {
      shouldUseCache: false,
      skipReason: 'regenerate_requested',
    }
  }

  try {
    const { data: existingSuggestions, error: dbError } = await supabase
      .from('daily_suggestions')
      .select('id, title, rationale, why_explanation, occasion_context, photo_idea, media_suggestion, content_type, suggested_time, position, menu_item_name, menu_item_description, caption_base, cta_intent, weather_forecast, planner_rationale, created_at, status, generated_text')
      .eq('business_id', businessId)
      .eq('date', today)
      .in('status', ['available', 'selected'])
      .order('position', { ascending: true })
      .limit(count)

    console.log('📊 Cache lookup result:', {
      found: existingSuggestions?.length || 0,
      hasError: !!dbError,
      errorCode: dbError?.code,
      errorMessage: dbError?.message,
    })

    if (dbError) {
      console.log('⚠️ Cache lookup error:', dbError)
      return {
        shouldUseCache: false,
        skipReason: 'error',
      }
    }

    if (!existingSuggestions || existingSuggestions.length === 0) {
      console.log('💡 No cached suggestions found, will generate fresh')
      return {
        shouldUseCache: false,
        skipReason: 'not_found',
      }
    }

    // Check staleness: suggestions older than 45 min should regenerate
    const createdAt = new Date(existingSuggestions[0].created_at)
    const hoursOld = (clientNow.getTime() - createdAt.getTime()) / (1000 * 60 * 60)

    if (hoursOld > 0.75) {
      console.log(`⏰ Suggestions are ${hoursOld.toFixed(1)} hours old (>45min) - auto-regenerating for current time context`)
      return {
        shouldUseCache: false,
        skipReason: 'stale',
      }
    }

    // Guard: if any cached why_explanation looks like a caption/promotional copy,
    // force regeneration — bad Gemini output may have slipped into the cache
    const IMPERATIVE_CAPTION_RE = /^(forkæl|kom ind|nyd |prøv |bestil|book |ring |spar |tilbyd|giv dig selv|få en |lad os|se vores|\✅|💡|🥗|🍽️)/i
    const hasCorruptExplanation = existingSuggestions.some(
      (s: any) => s.why_explanation && IMPERATIVE_CAPTION_RE.test(s.why_explanation.trim())
    )

    if (hasCorruptExplanation) {
      console.log('⚠️ Cached why_explanation looks like promotional copy — forcing regeneration')
      return {
        shouldUseCache: false,
        skipReason: 'corrupt',
      }
    }

    // Cache is valid - return cached suggestions
    console.log(`✅ RETURNING CACHED SUGGESTIONS (${hoursOld.toFixed(1)} hours old, <45min)`)
    console.log(`📋 Cached suggestion IDs: ${existingSuggestions.map(s => s.id).join(', ')}`)
    console.log(`📋 Cached suggestion titles: ${existingSuggestions.map(s => s.title).join(' | ')}`)

    return {
      shouldUseCache: true,
      cachedSuggestions: existingSuggestions as CachedSuggestion[],
    }
  } catch (e) {
    console.log('❌ Error checking cache:', e)
    return {
      shouldUseCache: false,
      skipReason: 'error',
    }
  }
}

/**
 * Build response from cached suggestions
 * 
 * @param cachedSuggestions - Cached suggestion rows from database
 * @param options - Additional response options
 * @returns Formatted response for cached suggestions
 */
export async function buildCachedResponse(
  cachedSuggestions: CachedSuggestion[],
  options: {
    businessId: string
    today: string
    supabase: SupabaseClient
    tier: string
    regenerate: boolean
    count: number
    debug?: boolean
  }
): Promise<Response> {
  const { businessId, today, supabase, tier, regenerate, count, debug } = options

  const suggestions = cachedSuggestions.map(s => ({
    id: s.id,
    title: s.title,
    rationale: s.rationale,
    why_explanation: s.why_explanation,
    occasion_context: s.occasion_context || null,
    photo_idea: s.photo_idea,
    media_suggestion: s.media_suggestion || null,
    content_type: s.content_type,
    suggested_time: s.suggested_time,
    suggestion_date: today,
    slot: (s as any).slot || (s.position === 1 ? 'offering' : s.position === 2 ? 'guest_moment' : 'brand_behind'),
    menu_item_name: s.menu_item_name || '',
    menu_item_description: s.menu_item_description || '',
    caption_base: s.caption_base || '',
    cta_intent: s.cta_intent || 'visit',
    generated_text: (s as any).generated_text || null,
  }))

  // Return stored weather forecast and planner rationale from when ideas were generated
  const weatherForecast = cachedSuggestions[0].weather_forecast || null
  const cachedPlannerRationale = (cachedSuggestions[0] as any).planner_rationale || ''

  // Query Weekly Plan ideas for today (cross-system awareness)
  const { data: weeklyPlanIdeas } = await supabase
    .from('daily_suggestions')
    .select('why_explanation, content_type')
    .eq('business_id', businessId)
    .eq('source', 'weekly_plan')
    .eq('date', today)
    .limit(3)

  const responseData: QuickSuggestionsResponse = {
    suggestions,
    cached: true,
    weatherForecast,
    plannerRationale: cachedPlannerRationale,
    weeklyPlanIdeas: weeklyPlanIdeas || [],
    debug: debug ? {
      tier,
      regenerate,
      count,
      cachedSuggestionCount: suggestions.length,
    } : undefined,
  }

  return new Response(JSON.stringify(responseData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
