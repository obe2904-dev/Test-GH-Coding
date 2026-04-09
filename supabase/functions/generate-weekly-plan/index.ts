import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateWeeklyPlan, saveWeeklyPlan } from '../_shared/post-helpers/weekly-plan-generator.ts'
import { validateStrategyFeasibility, buildCapabilitiesFromProfile, formatValidationReport } from '../_shared/post-helpers/strategy-feasibility-validator.ts'
import { getWeatherForecast } from '../_shared/post-helpers/weather.ts'

// v1.7 - Enhanced with opening_hours table and menu service periods extraction
// v1.8 - V17 Robustness: GPT-4o + positive framing + validation (hotfix2: model tracking)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

function buildOpeningHours(openingHoursRaw: any[] | null): Record<string, any> {
  const result: Record<string, any> = {}
  if (!openingHoursRaw) return result
  for (const day of openingHoursRaw) {
    if (!day.closed && day.open_time && day.close_time) {
      result[day.weekday] = {
        open: day.open_time.slice(0, 5), // "HH:MM:SS" → "HH:MM"
        close: day.close_time.slice(0, 5),
        kind: day.kind,
      }
    }
  }
  return result
}

const MENU_TO_SERVICE_PERIOD: Record<string, string> = {
  Brunch: 'brunch', BRUNCH: 'brunch',
  FROKOST: 'lunch', Frokost: 'lunch', LUNCH: 'lunch',
  AFTEN: 'dinner', Aften: 'dinner', DINNER: 'dinner', AFTENSMAD: 'dinner',
}

function deriveServicePeriods(menuItems: any[]): { servicePeriods: Record<string, any>; primaryServicePeriod: string } {
  const servicePeriods: Record<string, any> = {}
  const menuServicePeriods = new Map<string, { start: string; end: string; items: string[] }>()

  for (const menuRecord of menuItems) {
    const structuredData = menuRecord.structured_data
    if (!structuredData?.menuPeriods) continue
    const menuTitle = structuredData.menuTitle || menuRecord.menu
    const periods = structuredData.menuPeriods
    if (!periods?.length) continue
    const startTime = periods[0].startTime || '09:00'
    const endTime = periods[0].endTime || '17:00'
    const allItems: string[] = []
    for (const period of periods) {
      if (Array.isArray(period.items)) allItems.push(...period.items)
    }
    menuServicePeriods.set(menuTitle, { start: startTime, end: endTime, items: allItems })
  }

  for (const [menuTitle, data] of menuServicePeriods) {
    const periodType = MENU_TO_SERVICE_PERIOD[menuTitle] || 'other'
    if (periodType === 'other') continue
    const existing = servicePeriods[periodType]
    if (existing) {
      if (data.items.length > existing.itemCount) {
        console.log(`[Layer 1] Service period conflict for '${periodType}': replacing '${existing.menuTitle}' (${existing.itemCount} items) with '${menuTitle}' (${data.items.length} items)`)
        servicePeriods[periodType] = { enabled: true, hours: `${data.start}-${data.end}`, start: data.start, end: data.end, itemCount: data.items.length, menuTitle }
      } else {
        console.log(`[Layer 1] Service period conflict for '${periodType}': keeping '${existing.menuTitle}' (${existing.itemCount} items) over '${menuTitle}' (${data.items.length} items)`)
      }
    } else {
      servicePeriods[periodType] = { enabled: true, hours: `${data.start}-${data.end}`, start: data.start, end: data.end, itemCount: data.items.length, menuTitle }
    }
  }

  let primaryServicePeriod = 'lunch'
  const periodCount = Object.keys(servicePeriods).length
  if (periodCount >= 3 || (servicePeriods.brunch && servicePeriods.lunch && servicePeriods.dinner)) {
    primaryServicePeriod = 'all_day'
  } else if (servicePeriods.brunch && servicePeriods.lunch) {
    primaryServicePeriod = 'brunch_lunch'
  } else if (servicePeriods.dinner && !servicePeriods.lunch) {
    primaryServicePeriod = 'dinner_only'
  } else if (servicePeriods.brunch && !servicePeriods.lunch) {
    primaryServicePeriod = 'brunch_only'
  }

  return { servicePeriods, primaryServicePeriod }
}

function buildWeeklyPlanInput(opts: {
  business: any
  brandProfile: any
  businessProfile: any
  businessOps: any
  locationIntel: any
  menuItems: any[]
  openingHours: Record<string, any>
  servicePeriods: Record<string, any>
  primaryServicePeriod: string
  selectedPlatforms: string[]
  resolvedTier: 'smart' | 'pro'
  strategy: any
  strategyId: string | undefined
  selectedIdeaIds: string[] | undefined
  weekStart: string
  contextEvents?: any[]
  previousPlans?: any[]
  weatherForecast?: any[]
}) {
  return {
    businessId: opts.business.id,
    userId: opts.business.owner_id,
    weekStart: new Date(opts.weekStart),
    businessType: opts.business.category || 'FSE',
    brandProfile: opts.brandProfile || {},
    businessProfile: {
      ...(opts.businessProfile || {}),
      opening_hours: opts.openingHours,
      service_periods: opts.servicePeriods,
      primary_service_period: opts.primaryServicePeriod,
    },
    businessOps: opts.businessOps || {},
    locationIntel: opts.locationIntel || {},
    menuItems: opts.menuItems,
    platforms: opts.selectedPlatforms,
    previousPlans: opts.previousPlans || [],
    strategy: opts.strategy,
    strategyId: opts.strategyId,
    selectedIdeaIds: opts.selectedIdeaIds,
    subscriptionTier: opts.resolvedTier,
    targetPostCount: opts.resolvedTier === 'smart' ? 4 : (opts.strategy?.target_post_count ?? 4),
    contextEvents: opts.contextEvents ?? [],
    weatherForecast: opts.weatherForecast || [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body first so we can decide which client to create
    const { weekStart, regenerate = false, strategy_id, selected_idea_ids, business_id, skip_validation = false } = await req.json()

    // Two distinct auth paths:
    //   1. User auth: anon key + forwarded JWT → RLS enforces ownership
    //   2. Internal/service path: service role key + explicit business_id → bypasses RLS, ownership checked in code
    const incomingAuth = req.headers.get('Authorization')
    const supabaseClient = (business_id && !incomingAuth)
      ? createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
      : createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: incomingAuth! } } }
        )

    // Service role client for background DB writes — bypasses RLS so status
    // updates on weekly_strategies always succeed regardless of ownership policy.
    // User auth is verified above before this client is used.
    const bgClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Try to get authenticated user (null for service-role internal calls)
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    // Require either user auth OR explicit business_id (internal/service call)
    if (!user && !business_id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: user authentication or business_id required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    if (!weekStart) {
      return new Response(JSON.stringify({ error: 'weekStart is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Validate weekStart is a real date and not unreasonably far in the future
    const parsedWeekStart = new Date(weekStart)
    if (isNaN(parsedWeekStart.getTime())) {
      return new Response(JSON.stringify({ error: 'weekStart must be a valid ISO date string' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    if (parsedWeekStart.getTime() > Date.now() + 4 * 7 * 24 * 60 * 60 * 1000) {
      return new Response(JSON.stringify({ error: 'weekStart cannot be more than 4 weeks in the future' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    if (parsedWeekStart.getDay() !== 1) {
      console.warn(`[generate-weekly-plan] weekStart ${weekStart} is not a Monday (day=${parsedWeekStart.getDay()}) — week boundaries may be misaligned`)
    }

    // Fetch business - internal path uses business_id (no ownership RLS, code-enforced below); user path uses owner_id
    let businessQuery = supabaseClient.from('businesses').select('*')
    
    if (business_id) {
      businessQuery = businessQuery.eq('id', business_id)
    } else if (user) {
      businessQuery = businessQuery.eq('owner_id', user.id)
    } else {
      return new Response(JSON.stringify({ error: 'business_id required for service_role calls' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    
    const { data: business, error: businessError } = await businessQuery.single()

    if (businessError || !business) {
      console.error('Business lookup error:', businessError)
      return new Response(JSON.stringify({ error: 'Business profile not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    console.log('[generate-weekly-plan] Business found:', { id: business.id, name: business.name })

    // ✨ LAYER 0 INTEGRATION: Fetch strategy if strategy_id provided
    let strategy = undefined
    let strategyId = undefined
    let contextEvents: any[] = []

    console.log('[generate-weekly-plan] Request body strategy_id:', strategy_id)

    if (strategy_id) {
      console.log('[generate-weekly-plan] Querying for strategy:', { strategy_id, business_id: business.id })
      
      const { data: strategyData, error: strategyError } = await supabaseClient
        .from('weekly_strategies')
        .select('id, narrative, strategic_priorities, strategic_brief, post_ideas, generated_at, week_number, business_type, platforms, subscription_tier, target_post_count, week_context_snapshot')
        .eq('id', strategy_id)
        .eq('business_id', business.id) // Security: ensure ownership
        .single()
      
      console.log('[generate-weekly-plan] Strategy query result:', { 
        found: !!strategyData, 
        error: strategyError?.message,
        has_platforms: strategyData?.platforms !== undefined,
        has_post_ideas: strategyData?.post_ideas !== undefined,
        post_ideas_length: Array.isArray(strategyData?.post_ideas) ? strategyData.post_ideas.length : 'not an array',
        post_ideas_type: typeof strategyData?.post_ideas,
      })
      
      if (strategyError || !strategyData) {
        console.error('[generate-weekly-plan] ❌ Strategy not found or error:', strategy_id, strategyError)
        // Fall through to legacy path (strategy remains undefined)
      } else {
        strategyId = strategyData.id
        
        // Extract events from stored context snapshot for holiday-aware post annotations
        contextEvents = (strategyData?.week_context_snapshot as any)?.events ?? [];
        if (contextEvents.length > 0) {
          console.log('[generate-weekly-plan] Found', contextEvents.length, 'context events from week_context_snapshot:', contextEvents.map((e: any) => `${e.name_dk ?? e.name} (${e.date})`))
        }
        
        // Reconstruct the WeeklyStrategy object from DB columns
        strategy = {
          narrative: strategyData.narrative,
          strategic_priorities: strategyData.strategic_priorities,
          strategic_brief: strategyData.strategic_brief || {},
          post_ideas: strategyData.post_ideas,
          generated_at: strategyData.generated_at,
          week_number: strategyData.week_number,
          business_type: strategyData.business_type,
          platforms: strategyData.platforms || ['facebook', 'instagram'],
          subscription_tier: strategyData.subscription_tier || 'smart',
          target_post_count: strategyData.target_post_count || 5,
          validation_passed: true,
          validation_warnings: [],
          week_context_snapshot: strategyData.week_context_snapshot ?? null,
        }
                // 🔍 DIAGNOSTIC: Check post_ideas structure
        console.log('[generate-weekly-plan] 🔍 Strategy post_ideas diagnostic:', {
          exists: !!strategy?.post_ideas,
          type: typeof strategy?.post_ideas,
          isArray: Array.isArray(strategy?.post_ideas),
          length: strategy?.post_ideas?.length,
          first_idea_id: strategy?.post_ideas?.[0]?.id,
          first_idea_title: strategy?.post_ideas?.[0]?.title,
          raw_post_ideas: strategy?.post_ideas
        })
                console.log('[generate-weekly-plan] ✅ Reconstructed strategy:', {
          id: strategyId,
          has_narrative: !!strategy.narrative,
          has_priorities: !!strategy.strategic_priorities,
          post_ideas_count: Array.isArray(strategy.post_ideas) ? strategy.post_ideas.length : 0,
          will_use_strategy_path: !!strategy && Array.isArray(strategy.post_ideas) && strategy.post_ideas.length > 0,
          selected: selected_idea_ids || 'all',
        })
      }
    }

    // ── PATH A OPTIMISATION ────────────────────────────────────────────────
    // When a strategy with a saved week_context_snapshot is available (the
    // normal production path), we can reconstruct brandProfile, locationIntel,
    // businessOps, and openingHoursRaw from the already-stored snapshot instead
    // of re-querying 6 separate tables.  Only recentPlansRaw (variation tracking)
    // still needs a live query, because it covers plans AFTER the strategy was created.
    // ─────────────────────────────────────────────────────────────────────────
    const snap: any = (strategy as any)?.week_context_snapshot ?? null
    const hasSnap = !!snap && !!strategy?.post_ideas?.length

    let brandProfile: any
    let businessProfile: any
    let locationIntel: any
    let menuItemsRaw: any[] | null
    let businessOps: any
    let openingHoursRaw: any[] | null
    let recentPlansRaw: any[] | null

    if (hasSnap) {
      // Reconstruct brandProfile-compatible object from the snapshot's brand_voice block
      const bv = snap.brand_voice ?? {}
      brandProfile = {
        tone_model: bv.tone_model ?? null,
        tone_of_voice: bv.tone_of_voice ?? null,
        brand_essence: bv.brand_essence ?? '',
        brand_essence_elaboration: bv.brand_essence_elaboration ?? null,
        target_audience: bv.target_audience ?? null,
        business_character: snap.business_character ?? null,
        booking_link: snap.booking_link ?? null,
        content_strategy: bv.content_strategy ?? null,
        signature_phrases: bv.signature_phrases ?? [],
        never_say: bv.never_say ?? [],
        typical_openings: bv.typical_openings ?? [],
        typical_closings: bv.typical_closings ?? [],
        humor_level: bv.humor_level ?? 'moderate',
        voice_constraints: bv.voice_constraints ?? null,
        identity_keywords: bv.identity_keywords ?? null,
      }

      // Reconstruct businessProfile-compatible minimal object (only menu_signal used in Layer 1)
      businessProfile = { menu_signal: { programmes: snap.menu_programmes ?? null } }

      // Reconstruct locationIntel-compatible object from snapshot location block
      const loc = snap.location ?? {}
      locationIntel = {
        area_type: loc.area_type ?? loc.type ?? 'city_center',
        neighborhood: loc.neighborhood ?? snap.city ?? null,
        city: snap.city ?? null,
        country: snap.country ?? 'DK',
        category_scores: Object.fromEntries(
          (loc.location_categories ?? []).map((c: any) => [c.type, c.score])
        ),
        location_marketing_hooks: loc.marketing_focus ? [loc.marketing_focus] : [],
        has_outdoor_seating: loc.has_outdoor_seating ?? false,
        has_takeaway: loc.has_takeaway ?? false,
        has_table_service: loc.has_table_service ?? false,
      }

      // Reconstruct businessOps from snapshot location block
      businessOps = {
        has_outdoor_seating: loc.has_outdoor_seating ?? false,
        has_takeaway: loc.has_takeaway ?? false,
        has_table_service: loc.has_table_service ?? false,
      }

      // Reconstruct menu items from snapshot signature_items (name + description enough for Layer 1)
      // Full per-dish DB lookups happen later in mapIdeaToEnrichedSlot via menu_items_normalized.
      menuItemsRaw = (snap.signature_items ?? []).map((item: any) => ({
        name: item.name ?? item.item_name ?? '',
        description: item.description ?? item.item_description ?? '',
        price: item.price ?? '',
        is_signature: true,
        service_periods: item.service_period ? [item.service_period] : (item.service_periods ?? []),
        structured_data: null, // Not needed for Path A
      }))

      // Reconstruct opening hours raw rows from daily_open_time / daily_close_time maps
      const openTimes: Record<string, string | null> = snap.daily_open_time ?? {}
      const closeTimes: Record<string, string | null> = snap.daily_close_time ?? {}
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      openingHoursRaw = dayNames.map((day, idx) => ({
        weekday: day,
        weekday_index: idx,
        open_time: openTimes[day] ?? null,
        close_time: closeTimes[day] ?? null,
        closed: !openTimes[day],
        kind: 'regular',
      })).filter(r => r.open_time)

      // recentPlansRaw still fetched live (needed for week-to-week dish variation tracking)
      const { data: _recentPlans } = await supabaseClient
        .from('weekly_content_plans')
        .select('posts, week_start, generated_at')
        .eq('business_id', business.id)
        .neq('week_start', weekStart)
        .order('generated_at', { ascending: false })
        .limit(3)
      recentPlansRaw = _recentPlans
      console.log('[generate-weekly-plan] ⚡ Snapshot shortcut: skipped 6 DB queries (using week_context_snapshot)')
    } else {
      // No snapshot available — fetch everything from DB (legacy Path B or first-ever plan)
      const [
        { data: _brandProfile },
        { data: _businessProfile },
        { data: _locationIntel },
        { data: _menuItemsRaw },
        { data: _businessOps },
        { data: _openingHoursRaw },
        { data: _recentPlansRaw },
      ] = await Promise.all([
        supabaseClient.from('business_brand_profile').select('*').eq('business_id', business.id).single(),
        supabaseClient.from('business_profile').select('*').eq('business_id', business.id).single(),
        supabaseClient.from('business_location_intelligence').select('*').eq('business_id', business.id).single(),
        supabaseClient.from('menu_results_v2').select('*').eq('business_id', business.id),
        supabaseClient.from('business_operations').select('*').eq('business_id', business.id).single(),
        supabaseClient.from('opening_hours').select('*').eq('business_id', business.id).order('weekday'),
        supabaseClient.from('weekly_content_plans').select('posts, week_start, generated_at').eq('business_id', business.id).neq('week_start', weekStart).order('generated_at', { ascending: false }).limit(3),
      ])
      brandProfile = _brandProfile
      businessProfile = _businessProfile
      locationIntel = _locationIntel
      menuItemsRaw = _menuItemsRaw
      businessOps = _businessOps
      openingHoursRaw = _openingHoursRaw
      recentPlansRaw = _recentPlansRaw
    }

    // Resolve tier: PATH A uses strategy tier, PATH B uses the already-fetched business record
    const resolvedTier: 'smart' | 'pro' = strategy?.subscription_tier
      ? (strategy.subscription_tier as 'smart' | 'pro')
      : (business.subscription_tier === 'pro' ? 'pro' : 'smart')

    // Filter out price-modifier add-ons (e.g. "GLUTENFRI PASTA +20,-", "EKSTRA SOVS +10")
    // These are option additions scraped alongside real dishes and pollute content ideas.
    // Modifier pattern: item name contains "+<digits>" anywhere (price add-on suffix).
    const menuItems = (menuItemsRaw || []).filter((item: any) => {
      const name = (item.name || '').trim()
      return !/\+\d/.test(name)
    })

    if ((menuItemsRaw?.length || 0) > menuItems.length) {
      console.log('[Layer 1] Filtered out menu modifier items:', {
        before: menuItemsRaw?.length,
        after: menuItems.length,
        removed: (menuItemsRaw?.length || 0) - menuItems.length,
      })
    }

    // Service periods are now stored in the database (service_periods, service_period_name, is_signature)
    // No need to tag them here - they're tagged during menu extraction
    console.log('[Layer 1] Menu items with service periods from database:', {
      total: menuItems?.length || 0,
      withServicePeriods: menuItems?.filter(m => m.service_periods && m.service_periods.length > 0).length || 0,
      signature: menuItems?.filter(m => m.is_signature).length || 0
    })

    const openingHours = buildOpeningHours(openingHoursRaw)
    const { servicePeriods, primaryServicePeriod } = deriveServicePeriods(menuItems)

    // Build compact previous plans summary for variation tracking
    // Extracts {dish, contentType} pairs so the generator can detect repetition
    const previousPlans = (recentPlansRaw || []).map((plan: any) => ({
      weekStart: plan.week_start,
      featuredDishes: Array.isArray(plan.posts)
        ? (plan.posts as any[]).map(p => ({
            dish: p.contentSubject?.dish || '',
            contentType: p.postType?.type || '',
          })).filter((d: any) => d.dish)
        : [],
    }))
    if (previousPlans.length > 0) {
      const allDishes = previousPlans.flatMap((p: any) => p.featuredDishes.map((d: any) => d.dish))
      console.log('[Layer 1] Previous plans found:', previousPlans.length, '— recently featured:', allDishes.join(', '))
    }

    // Fetch 7-day weather forecast (non-blocking — falls back to [] if API key missing)
    const city = (locationIntel as any)?.neighborhood || (locationIntel as any)?.city || ''
    let weatherForecast: any[] = []
    if (city) {
      try {
        weatherForecast = await getWeatherForecast(city, 7)
        console.log('[Layer 1] Weather forecast fetched:', weatherForecast.length, 'days for', city)
      } catch (weatherErr) {
        console.warn('[Layer 1] Weather fetch failed (non-fatal):', (weatherErr as Error).message)
      }
    }

    const selectedPlatforms = business.selected_platforms || ['instagram', 'facebook']

    // Check for existing plan
    if (!regenerate) {
      const { data: existingPlan } = await supabaseClient
        .from('weekly_content_plans')
        .select('*')
        .eq('business_id', business.id)
        .eq('week_start', weekStart)
        .single()

      if (existingPlan) {
        // Transform database snake_case to camelCase for frontend
        const transformedPlan = {
          id: existingPlan.id,
          userId: existingPlan.user_id,
          businessId: existingPlan.business_id,
          weekNumber: existingPlan.week_number,
          weekStart: existingPlan.week_start,
          weekEnd: existingPlan.week_end,
          generatedAt: existingPlan.generated_at,
          posts: existingPlan.posts,
          summary: existingPlan.summary,
          learningData: existingPlan.learning_data,
        }
        return new Response(JSON.stringify({ success: true, plan: transformedPlan, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
    }

    const input = buildWeeklyPlanInput({
      business,
      brandProfile,
      businessProfile,
      businessOps,
      locationIntel,
      menuItems,
      openingHours,
      servicePeriods,
      primaryServicePeriod,
      selectedPlatforms,
      resolvedTier,
      strategy,
      strategyId,
      selectedIdeaIds: selected_idea_ids || (Array.isArray(strategy?.post_ideas) ? strategy.post_ideas.map((i: any) => i.id) : undefined),
      weekStart,
      contextEvents,
      previousPlans,
      weatherForecast,
    })

    // Enhanced logging for debugging
    console.log('[Layer 1 Assembly] Data quality report:', {
      businessId: business.id,
      businessName: business.name,
      businessType: input.businessType,
      city: locationIntel?.neighborhood || 'unknown',
      areaType: locationIntel?.area_type,
      
      // Opening hours
      openingHoursDays: Object.keys(openingHours).length,
      
      // Service periods
      servicePeriods: Object.keys(servicePeriods),
      primaryServicePeriod,
      brunchAvailable: !!servicePeriods.brunch,
      lunchAvailable: !!servicePeriods.lunch,
      dinnerAvailable: !!servicePeriods.dinner,
      
      // Menu data - from database
      menuItemsTotal: menuItems?.length || 0,
      menuRecordsWithStructuredData: menuItems?.filter(m => m.structured_data).length || 0,
      menuByServicePeriod: {  // ✨ From database columns
        brunch: menuItems?.filter(m => m.service_periods?.includes('brunch')).length || 0,
        lunch: menuItems?.filter(m => m.service_periods?.includes('lunch')).length || 0,
        dinner: menuItems?.filter(m => m.service_periods?.includes('dinner')).length || 0,
      },
      signatureDishes: menuItems?.filter(m => m.is_signature).length || 0,  // ✨ From database
      
      // Location
      hasLocationIntel: !!locationIntel,
      waterfrontScore: locationIntel?.category_scores?.waterfront,
      outdoorSeating: businessOps?.has_outdoor_seating,
      
      // Platforms
      platforms: selectedPlatforms,
      
      // Brand
      hasBrandProfile: !!brandProfile,
      brandTone: brandProfile?.tone_keywords
    })

    // ========================================================================
    // ✨ FEASIBILITY VALIDATION (Layer 0 → Layer 6 checkpoint)
    // ========================================================================
    
    if (!skip_validation && strategy && strategy.post_ideas && strategy.post_ideas.length > 0) {
      console.log('[FeasibilityCheck] Running validation for PATH A (strategy-driven)')
      
      // Fetch connected platforms
      const { data: connectedPlatforms } = await supabaseClient
        .from('business_social_accounts')
        .select('platform_name, is_active')
        .eq('business_id', business.id)
      
      // Fetch subscription data
      const { data: subscriptionData } = await supabaseClient
        .from('subscriptions')
        .select('tier, status')
        .eq('business_id', business.id)
        .eq('status', 'active')
        .single()
      
      // Build capabilities object
      const capabilities = buildCapabilitiesFromProfile(
        businessProfile,
        connectedPlatforms || [],
        subscriptionData
      )
      
      console.log('[FeasibilityCheck] Capabilities:', {
        platforms: capabilities.connectedPlatforms,
        tier: capabilities.subscriptionTier,
        maxPosts: capabilities.maxPostsPerWeek,
        formats: {
          photo: capabilities.canProducePhotos,
          carousel: capabilities.canProduceCarousels,
          reel: capabilities.canProduceReels,
          video: capabilities.canProduceVideos,
        }
      })
      
      // Filter to selected ideas
      const selectedIdeas = selected_idea_ids
        ? strategy.post_ideas.filter((idea: any) => selected_idea_ids.includes(idea.id))
        : strategy.post_ideas
      
      // Run validation
      const validation = validateStrategyFeasibility(selectedIdeas, capabilities)
      
      // Log results
      console.log('[FeasibilityCheck] Validation complete:', {
        feasible: validation.feasible,
        criticalErrors: validation.criticalErrors.length,
        warnings: validation.warnings.length,
      })
      
      // If not feasible, return error response
      if (!validation.feasible) {
        console.error('[FeasibilityCheck] ❌ Strategy not feasible')
        console.error(formatValidationReport(validation))
        
        return new Response(JSON.stringify({
          error: 'Strategy not feasible for this business',
          validation: {
            feasible: false,
            errors: validation.criticalErrors,
            warnings: validation.warnings,
            suggestions: validation.suggestions,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      
      // If warnings exist, log them but continue
      if (validation.warnings.length > 0) {
        console.warn('[FeasibilityCheck] ⚠️  Warnings detected:')
        validation.warnings.forEach(w => {
          console.warn(`  - [${w.impact.toUpperCase()}] ${w.message}`)
        })
      }
      
      console.log('[FeasibilityCheck] ✅ Validation passed, proceeding to Layer 6')
    } else {
      console.log('[FeasibilityCheck] Skipping validation:', skip_validation ? 'skip_validation=true' : 'PATH B - legacy flow')
    }

    // ========================================================================
    // GENERATE WEEKLY PLAN (Layers 6-9)
    // ========================================================================

    // ========================================================================
    // ASYNC GENERATION — runs in background to avoid 504 timeout
    // Same waitUntil pattern as get-weekly-strategy.
    // ========================================================================

    const backgroundGeneration = (async () => {
      try {
        // Use bgClient (service role) for all DB operations in the background task.
        // This ensures RLS never silently blocks status updates or inserts.
        const plan = await generateWeeklyPlan(input, bgClient)

        console.log('[Edge Function] Plan generated:', {
          weekNumber: plan.weekNumber,
          postsCount: plan.posts.length,
          summary: plan.summary,
        })

        const saveResult = await saveWeeklyPlan(plan, bgClient)

        if (!saveResult.success) {
          console.error('Failed to save plan:', saveResult.error)
        }

        // ✨ LAYER 0 INTEGRATION: Update strategy status to 'posts_created'
        if (strategyId && saveResult.success && strategy) {
          const { error: updateError, count } = await bgClient
            .from('weekly_strategies')
            .update({
              status: 'posts_created',
              selected_idea_ids: selected_idea_ids || (Array.isArray(strategy.post_ideas) ? strategy.post_ideas.map((i: any) => i.id) : []),
            })
            .eq('id', strategyId)

          if (updateError) {
            console.error('[generate-weekly-plan] Failed to update strategy status:', updateError)
          } else {
            console.log('[generate-weekly-plan] ✅ Strategy marked as posts_created:', strategyId, '(rows affected:', count, ')')
          }
        }
      } catch (bgError) {
        console.error('[generate-weekly-plan] Background generation error:', bgError)
        // Mark strategy as error so the frontend stops polling
        if (strategyId) {
          try {
            await bgClient
              .from('weekly_strategies')
              .update({ status: 'error' })
              .eq('id', strategyId)
          } catch (_) { /* best-effort */ }
        }
      }
    })()

    // Register with EdgeRuntime.waitUntil so the task outlives the HTTP response.
    // Falls back to await (blocking) in local dev where EdgeRuntime may not be present.
    try {
      (globalThis as any).EdgeRuntime.waitUntil(backgroundGeneration)
    } catch (_) {
      await backgroundGeneration
    }

    // Return 202 immediately — client uses 'poll' to know which table to watch:
    //   strategy flow  → poll weekly_strategies for status = 'posts_created'
    //   legacy flow    → poll weekly_content_plans for business_id + week_start
    return new Response(JSON.stringify({
      status: 'generating',
      strategy_id: strategyId ?? null,
      poll: strategyId ? 'weekly_strategies' : 'weekly_content_plans',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 202,
    })
  } catch (error) {
    console.error('Error generating weekly plan:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
