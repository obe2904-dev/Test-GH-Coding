// Suggestion persistence for get-quick-suggestions
// Saves validated suggestions to database and manages quota
// Extracted June 24, 2026

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { RotationQueueItem } from '../_shared/content-planning/index.ts'
import type { SlotTiming } from './operational-timeline.ts'

/**
 * Helper: Normalize content_type to match daily_suggestions constraint
 * Constraint allows: 'product', 'atmosphere', 'bts', 'event', 'offer'
 */
function normalizeContentType(type: string): string {
  const typeMap: Record<string, string> = {
    'menu_item': 'product',
    'product_menu': 'product',
    'craving_visual': 'product',
    'behind_scenes': 'bts',
    'brand_behind': 'bts',
    'atmosphere': 'atmosphere',
    'guest_moment': 'atmosphere',
    'event': 'event',
    'offer': 'offer',
    'product': 'product',
    'bts': 'bts',
  }
  return typeMap[type] || 'product' // Default to 'product' if unknown
}

/**
 * Get slot type from position
 */
function slotForPosition(pos: number): string {
  return pos === 1 ? 'offering' : pos === 2 ? 'guest_moment' : 'brand_behind'
}

/**
 * Determine content angle based on weather and dish characteristics
 */
export function determineContentAngle(
  weatherDesc: string,
  dishName: string,
  servicePeriod: string | null
): string {
  const weather = weatherDesc.toLowerCase()
  const dish = dishName.toLowerCase()

  // Weather-based angles
  if (weather.includes('regn') || weather.includes('rain') || weather.includes('torden')) {
    return 'Rainy-day comfort classic'
  }
  if (weather.includes('sol') || weather.includes('sun') || weather.includes('clear')) {
    return 'Perfect summer dish'
  }
  if (weather.includes('sne') || weather.includes('snow') || weather.includes('frost')) {
    return 'Winter warming favorite'
  }

  // Service period angles
  if (servicePeriod === 'brunch') {
    return 'Weekend brunch highlight'
  }
  if (servicePeriod === 'lunch') {
    return 'Midday energy boost'
  }
  if (servicePeriod === 'dinner') {
    return 'Evening dining experience'
  }

  return 'Signature menu highlight'
}

/**
 * Saves validated suggestions to daily_suggestions, then assembles the final
 * response array with all grounding fields re-attached. Also increments the
 * business's daily quota counter.
 * 
 * @returns Final suggestions array (with DB-assigned ids if insert succeeded)
 */
export async function persistAndAssemble(
  suggestions: any[],
  count: number,
  supabase: SupabaseClient,
  businessId: string,
  today: string,
  weatherForecast: string | null,
  menuDescriptionMap: Map<string, string>,
  slotExpectedContentTypes: string[],
  todayOpenTime: string | null | undefined,
  todayCloseTime: string | null | undefined,
  kitchenCloseTime: string | null | undefined,
  regenerate: boolean,
  plannerRationale: string,
  programsFromMenu?: Array<{ name: string; start: string; end: string }>,
  clientNow?: Date,
  confirmedSlotTimings?: SlotTiming[],
  rotationQueue?: RotationQueueItem[],
  currentServicePeriod?: string | null,
  weatherDesc?: string,
  getContentAwareTime?: (
    contentType: string,
    title: string,
    todayOpenTime?: string | null,
    todayCloseTime?: string | null,
    kitchenCloseTime?: string | null,
    programs?: Array<{ name: string; start: string; end: string }>,
    nowOverrideMins?: number
  ) => string
): Promise<any[]> {
  // Preserve Gemini-provided dish fields before the insert row-builder overwrites them
  const menuItemNames: Record<number, string> = {}
  const menuItemDescriptions: Record<number, string> = {}
  const dishTextBriefs: Record<number, string> = {}

  // Generate a new batch ID for this regeneration
  const generationBatchId = crypto.randomUUID()
  console.log(`🔄 Generation batch ID: ${generationBatchId}`)

  // If regenerating, deactivate old suggestions before inserting new ones
  if (regenerate) {
    try {
      await supabase.rpc('deactivate_old_suggestions', {
        p_business_id: businessId,
        p_date: today,
      })
      console.log('✅ Deactivated old suggestions for new batch')
    } catch (deactivateError) {
      console.warn('⚠️ Failed to deactivate old suggestions:', deactivateError)
      // Continue anyway - upsert will handle it
    }
  }

  suggestions.slice(0, count).forEach((s: any, idx: number) => {
    if (s.menu_item_name) {
      menuItemNames[idx] = s.menu_item_name
      const trustedDesc = menuDescriptionMap.get(s.menu_item_name)
      menuItemDescriptions[idx] = trustedDesc || ''
      dishTextBriefs[idx] = trustedDesc || s.dish_text_brief || ''
    } else if (s.dish_text_brief) {
      dishTextBriefs[idx] = s.dish_text_brief
    }
  })

  const suggestionRows = suggestions.slice(0, count).map((s: any, idx: number) => {
    const expectedType = slotExpectedContentTypes[idx] ?? s.content_type
    const normalizedType = normalizeContentType(expectedType)

    if (expectedType !== s.content_type) {
      console.log(`⚠️ Slot ${idx + 1}: Gemini returned content_type="${s.content_type}", clamped to "${expectedType}"`)
    }
    if (expectedType !== normalizedType) {
      console.log(`🔄 Content type normalized: "${expectedType}" → "${normalizedType}"`)
    }
    console.log(`🕐 Getting suggested_time for "${s.title}" with ${programsFromMenu?.length || 0} programs`)

    // Determine metadata from rotation queue
    const dishName = menuItemNames[idx] || s.menu_item_name || ''
    let menuItemId: string | null = null
    let contentAngle: string | null = null
    let dishServicePeriod: string | null = null

    const slotAllowsFood = confirmedSlotTimings?.[idx]?.isFoodEligible ?? true
    const slotTargetPeriodHint =
      confirmedSlotTimings?.[idx]?.serviceWindow?.name.toLowerCase() ||
      confirmedSlotTimings?.[idx]?.eligiblePeriods?.[0] ||
      null

    if (dishName && rotationQueue && Array.isArray(rotationQueue)) {
      const queueItem = rotationQueue.find((item) => item.menu_item_name === dishName && slotAllowsFood)

      if (queueItem) {
        menuItemId = queueItem.menu_item_id || null
        dishServicePeriod = queueItem.service_period || null

        // Validation: warn if dish's period doesn't match slot's target
        if (slotTargetPeriodHint && dishServicePeriod && slotTargetPeriodHint !== 'all_day') {
          if (dishServicePeriod !== slotTargetPeriodHint) {
            console.warn(
              `⚠️ Period mismatch for "${dishName}": dish="${dishServicePeriod}", slot hint="${slotTargetPeriodHint}"`
            )
          } else {
            console.log(`✅ Period match: "${dishName}" [${dishServicePeriod}] → ${menuItemId || 'no UUID'}`)
          }
        } else {
          console.log(`✅ Matched: "${dishName}" [${dishServicePeriod || 'no period'}] → ${menuItemId || 'no UUID'}`)
        }
      } else if (dishName) {
        if (!slotAllowsFood) {
          console.warn(`❌ No match for "${dishName}" — slot ${idx + 1} is after kitchen close (not food-eligible)`)
        } else {
          console.warn(`❌ Dish "${dishName}" not found in rotation queue (${rotationQueue.length} items)`)
        }
      }

      // Determine content angle based on weather + dish's actual service period
      if (weatherDesc && normalizedType === 'product' && dishServicePeriod) {
        try {
          contentAngle = determineContentAngle(weatherDesc, dishName, dishServicePeriod)
        } catch (angleErr) {
          console.warn(`⚠️ Failed to determine content angle for "${dishName}":`, angleErr)
          contentAngle = 'Signature menu highlight'
        }
      }
    }

    return {
      business_id: businessId,
      title: s.title,
      rationale: s.rationale || s.why_explanation || '',
      why_explanation: s.why_explanation || '',
      occasion_context: s.occasion_context || '',
      photo_idea: s.media_suggestion?.primary?.instruction || s.photo_idea || '',
      content_type: normalizedType,
      planner_rationale: idx === 0 ? plannerRationale : null,
      suggested_time:
        confirmedSlotTimings && confirmedSlotTimings[idx]
          ? confirmedSlotTimings[idx].postAt
          : getContentAwareTime
          ? getContentAwareTime(
              expectedType,
              s.title || '',
              todayOpenTime,
              todayCloseTime,
              kitchenCloseTime,
              programsFromMenu,
              clientNow ? clientNow.getHours() * 60 + clientNow.getMinutes() : undefined
            )
          : '12:00',
      date: today,
      position: idx + 1,
      source: 'quick_suggestions',
      status: 'available',
      generation_batch_id: generationBatchId,
      weather_forecast: weatherForecast ? JSON.parse(weatherForecast) : null,
      menu_item_id: menuItemId,
      menu_item_name: dishName,
      service_period: dishServicePeriod,
      content_angle: contentAngle,
      menu_item_description: dishTextBriefs[idx] || menuItemDescriptions[idx] || '',
      caption_base:
        normalizedType === 'product'
          ? dishTextBriefs[idx] || menuItemDescriptions[idx] || ''
          : s.concrete_anchor || '',
      cta_intent:
        s.slot === 'guest_moment' ? 'social' : s.slot === 'brand_behind' ? 'engagement' : 'visit',
      media_suggestion: s.media_suggestion || null,
      // Clear cached generation when regenerating - forces fresh text generation
      generated_text: null,
      generated_hashtags: null,
      generated_platform_content: null,
      generated_at: null,
      platforms_generated: null,
      text_generation_version: null,
    }
  })

  console.log('💾 Attempting to save suggestions:', { count: suggestionRows.length, businessId, date: today })

  // Time slot collision guard
  const seenTimes = new Set<string>()
  for (let i = 0; i < suggestionRows.length; i++) {
    const row = suggestionRows[i]
    const venueCap = kitchenCloseTime
      ? (() => {
          const [h, m = 0] = kitchenCloseTime.split(':').map(Number)
          return h * 60 + m - 30
        })()
      : 23 * 60 + 30

    let t = row.suggested_time
    while (seenTimes.has(t)) {
      const [h, m] = t.split(':').map(Number)
      const nudgedMins = h * 60 + (m || 0) + 60
      if (nudgedMins > venueCap) {
        const firstSeen = Array.from(seenTimes)[0]
        const [fh, fm] = firstSeen.split(':').map(Number)
        const earlierMins = fh * 60 + (fm || 0) - 45
        t =
          earlierMins > 0
            ? `${Math.floor(earlierMins / 60)
                .toString()
                .padStart(2, '0')}:${(earlierMins % 60).toString().padStart(2, '0')}`
            : t
        break
      }
      const wrapped = nudgedMins % (24 * 60)
      t = `${Math.floor(wrapped / 60)
        .toString()
        .padStart(2, '0')}:${(wrapped % 60).toString().padStart(2, '0')}`
      console.log(`⏩ Collision nudge: ${row.suggested_time} → ${t} for "${row.title}"`)
    }
    seenTimes.add(t)
    row.suggested_time = t
  }

  const { data: savedSuggestions, error: saveError } = await supabase
    .from('daily_suggestions')
    .upsert(suggestionRows, { onConflict: 'business_id,date,position,source' })
    .select(
      'id, title, rationale, why_explanation, occasion_context, photo_idea, media_suggestion, content_type, suggested_time, menu_item_id, menu_item_name, menu_item_description, service_period, content_angle, cta_intent, position, generated_text'
    )

  if (saveError) {
    console.error('❌ Failed to save suggestions:', {
      code: saveError.code,
      message: saveError.message,
      details: saveError.details,
      hint: saveError.hint,
    })
    throw new Error(`Failed to persist suggestions: ${saveError.message}`)
  } else {
    console.log(`✅ Successfully saved ${savedSuggestions?.length || 0} suggestions to cache`)
    if (savedSuggestions && savedSuggestions.length > 0) {
      suggestions = [...savedSuggestions].sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
    } else {
      throw new Error('Failed to persist suggestions: no rows returned from upsert')
    }
  }

  // Re-attach grounding fields
  const finalSuggestions = suggestions.map((s: any, idx: number) => ({
    ...s,
    slot: s.slot || slotForPosition(s.position || idx + 1),
    menu_item_name: s.menu_item_name || menuItemNames[idx] || '',
    menu_item_description: s.menu_item_description || dishTextBriefs[idx] || menuItemDescriptions[idx] || '',
    cta_intent: s.cta_intent || (s.slot === 'guest_moment' ? 'social' : s.slot === 'brand_behind' ? 'engagement' : 'visit'),
    media_suggestion: s.media_suggestion || null,
    suggestion_date: today,
  }))

  // Increment daily quota counter (only on regenerate)
  if (regenerate) {
    try {
      const { data: currentBiz } = await supabase
        .from('businesses')
        .select('quick_suggestions_today')
        .eq('id', businessId)
        .single()
      const newCount = (currentBiz?.quick_suggestions_today || 0) + 1
      const { error: incrementError } = await supabase
        .from('businesses')
        .update({ quick_suggestions_today: newCount })
        .eq('id', businessId)
      if (!incrementError) {
        console.log(`📊 Incremented quick_suggestions_today counter to ${newCount}`)
      } else {
        console.warn('⚠️ Failed to increment counter:', incrementError)
      }
    } catch (e) {
      console.warn('⚠️ Error incrementing counter:', e)
    }
  }

  return finalSuggestions
}
