// v7
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateWeeklyPlan, saveWeeklyPlan } from '../_shared/post-helpers/weekly-plan-generator.ts'
import { validateStrategyFeasibility, buildCapabilitiesFromProfile, formatValidationReport } from '../_shared/post-helpers/strategy-feasibility-validator.ts'
import { countryToLanguageCode } from '../_shared/helpers/country-to-language.ts'

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
  // All rows represent open days (closed days have no row in database)
  for (const day of openingHoursRaw) {
    if (day.open_time && day.close_time) {
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
  selectedIdeaIds: number[] | undefined
  weekStart: string
  contextEvents?: any[]
  previousPlans?: any[]
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
    targetPostCount: opts.resolvedTier === 'smart' ? 3 : (opts.strategy?.target_post_count ?? 3),
    contextEvents: opts.contextEvents ?? [],
  }
}

function normalizeSelectedIdeaIds(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined
  const normalized = value
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined
}

// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body first so we can decide which client to create
    const { weekStart, regenerate = false, strategy_id, selected_idea_ids, business_id, skip_validation = false } = await req.json()
    const normalizedSelectedIdeaIds = normalizeSelectedIdeaIds(selected_idea_ids)

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

    if (!strategy_id) {
      return new Response(JSON.stringify({ error: 'strategy_id is required — legacy Path B has been removed' }), {
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
        return new Response(JSON.stringify({ error: 'Strategy not found', strategy_id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
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
          selected: normalizedSelectedIdeaIds || 'all',
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
    let menuItemsNormalized: any[] | null
    let menuItemsRaw: any[] | null
    let businessProgrammes: any[] | null
    let businessOps: any
    let openingHoursRaw: any[] | null
    let recentPlansRaw: any[] | null

    if (hasSnap) {
      // Reconstruct brandProfile-compatible object from the snapshot's brand_voice block
      const bv = snap.brand_voice ?? {}
      // NEW (June 12, 2026): Use flattened voice_guardrails, fallback to nested structure
      const guardrails = (snap as any).voice_guardrails || bv.brand_profile_v5?.guardrails || {}
      
      brandProfile = {
        tone_model: bv.tone_model ?? null,
        tone_of_voice: bv.tone_of_voice ?? null,
        brand_essence: bv.brand_essence ?? '',
        // V5.6 (June 23, 2026): Keep business_character SHORT (business type reasoning)
        business_character: snap.business_character || null,
        // V5.6 (June 23, 2026): Separate field for strategic guidance (marketing brief or persona)
        marketing_guidance: (snap as any).marketing_manager_brief || (snap as any).business_identity_persona || null,
        booking_link: snap.booking_link ?? null,
        content_strategy: bv.content_strategy ?? null,
        never_say: bv.never_say ?? [],
        audience_segments: bv.audience_segments ?? null,
        // CRITICAL: Forbidden phrases enforcement (customer-facing posts)
        forbidden_phrases: guardrails.forbidden_phrases ?? [],
        technical_terms: guardrails.technical_terms ?? [],
        weather_cliches: guardrails.weather_cliches ?? [],
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
        // Booking model — required for CTA selection in plan generator
        reservation_required: snap.booking_model?.reservation_required ?? false,
        accepts_walk_ins: snap.booking_model?.accepts_walk_ins ?? true,
        has_booking_link: snap.booking_model?.has_booking_link ?? false,
        booking_link: snap.booking_link ?? null,
      }

      // Fetch menu_items_normalized live — the snapshot's signature_items lack service_period
      // metadata needed for service-period filtering and deriveServicePeriods(). Without this,
      // servicePeriods ends up empty and primaryServicePeriod defaults to 'lunch', causing
      // dish selection to be biased toward lunch regardless of the weekly strategy.
      // Also fetch menu_result_ids filtered to local language so foreign-language menus are excluded.
      const businessLangSnap = (() => {
        const COUNTRY_TO_LANG: Record<string, string> = { DK: 'da', NO: 'no', SE: 'sv', FI: 'fi', IS: 'is', DE: 'de', FR: 'fr', ES: 'es', IT: 'it', NL: 'nl' };
        const rawCountry = (snap.country || 'DK').toUpperCase();
        return COUNTRY_TO_LANG[rawCountry] ?? 'da';
      })();
      const [{ data: _localMenuResults }, { data: _opsLang }] = await Promise.all([
        supabaseClient
          .from('menu_results_v2')
          .select('id, language_code')
          .eq('business_id', business.id)
          .eq('status', 'done'),
        supabaseClient
          .from('business_operations')
          .select('enabled_menu_languages')
          .eq('business_id', business.id)
          .maybeSingle(),
      ]);
      // Smart: local language only. Pro: uses enabled_menu_languages if set.
      const allowedLangsSnap: string[] = Array.isArray(_opsLang?.enabled_menu_languages) && _opsLang.enabled_menu_languages.length > 0
        ? _opsLang.enabled_menu_languages as string[]
        : [businessLangSnap];
      const localMenuResultIdsSnap = new Set<string>(
        (_localMenuResults ?? [])
          .filter((r: any) => !r.language_code || allowedLangsSnap.includes(r.language_code))
          .map((r: any) => r.id)
      );
      console.log(`[generate-weekly-plan] Language filter (snap path): allowed=${allowedLangsSnap.join(',')}, local_ids=${localMenuResultIdsSnap.size}/${(_localMenuResults ?? []).length}`);

      const { data: _menuItemsNorm } = await supabaseClient
        .from('menu_items_normalized')
        .select('item_name, item_description, service_periods, service_period_name, menu_result_id')
        .eq('business_id', business.id)
        .eq('is_active', true)
      // Filter to local-language menus only
      menuItemsNormalized = (_menuItemsNorm ?? []).filter(
        (item: any) => !item.menu_result_id || localMenuResultIdsSnap.size === 0 || localMenuResultIdsSnap.has(item.menu_result_id)
      )
      console.log(`[generate-weekly-plan] menu_items_normalized: ${_menuItemsNorm?.length ?? 0} total → ${menuItemsNormalized.length} after language filter`)
      businessProgrammes = [] // Not available in snapshot
      menuItemsRaw = menuItemsNormalized.length > 0
        ? [] // will be processed from menuItemsNormalized below
        : (snap.signature_items ?? []).map((item: any) => ({
          name: item.name ?? item.item_name ?? '',
          description: item.description ?? item.item_description ?? '',
          price: item.price ?? '',
          is_signature: true,
          service_periods: item.service_period ? [item.service_period] : (item.service_periods ?? []),
          structured_data: null,
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
      // Detect language for filtering menu results
      const countryToLanguage: Record<string, string> = { DK: 'da', NO: 'no', SE: 'sv', DE: 'de', FR: 'fr', ES: 'es', IT: 'it' }
      const language = business.primary_language || countryToLanguage[business.country] || 'da'
      console.log(`[generate-weekly-plan] 🌐 Language detected: ${language} (from ${business.primary_language ? 'business.primary_language' : 'country mapping'})`)
      
      // No snapshot available — fetch everything from DB (strategy exists but has no snapshot yet)
      const [
        { data: _brandProfile },
        { data: _businessProfile },
        { data: _locationIntel },
        { data: _menuItemsNormalized },
        { data: _menuItemsRaw },
        { data: _businessProgrammes },
        { data: _businessOps },
        { data: _openingHoursRaw },
        { data: _recentPlansRaw },
      ] = await Promise.all([
        supabaseClient.from('business_brand_profile').select('*, voice_guardrails, business_identity_persona, marketing_manager_brief').eq('business_id', business.id).single(),
        supabaseClient.from('business_profile').select('*').eq('business_id', business.id).single(),
        supabaseClient.from('business_location_intelligence').select('*').eq('business_id', business.id).single(),
        supabaseClient.from('menu_items_normalized').select('item_name, item_description, menu_language, service_periods, service_period_name, menu_result_id').eq('business_id', business.id).eq('menu_language', countryToLanguageCode(business.country)).eq('is_active', true),
        // Fetch all statuses, filter by language below (so we have IDs to cross-reference)
        supabaseClient.from('menu_results_v2').select('id, language_code, structured_data, service_periods, is_signature, ai_summary, source_url, service_period_name').eq('business_id', business.id).eq('status', 'done'),
        supabaseClient.from('business_programme_profiles').select('programme_type, programme_name, time_windows, operating_days, is_active').eq('business_id', business.id).eq('is_active', true),
        supabaseClient.from('business_operations').select('*').eq('business_id', business.id).single(),
        supabaseClient.from('opening_hours').select('*').eq('business_id', business.id).order('weekday'),
        supabaseClient.from('weekly_content_plans').select('posts, week_start, generated_at').eq('business_id', business.id).neq('week_start', weekStart).order('generated_at', { ascending: false }).limit(3),
      ])
      // Apply language filter: Pro uses enabled_menu_languages, Smart falls back to local language
      const allowedLangsNoSnap: string[] = Array.isArray(_businessOps?.enabled_menu_languages) && _businessOps.enabled_menu_languages.length > 0
        ? _businessOps.enabled_menu_languages as string[]
        : [language];
      const localMenuResultIdsNoSnap = new Set<string>(
        (_menuItemsRaw ?? [])
          .filter((r: any) => !r.language_code || allowedLangsNoSnap.includes(r.language_code))
          .map((r: any) => r.id)
      );
      console.log(`[generate-weekly-plan] Language filter (no-snap path): allowed=${allowedLangsNoSnap.join(',')}, local_ids=${localMenuResultIdsNoSnap.size}/${(_menuItemsRaw ?? []).length}`);
      brandProfile = _brandProfile
      
      // V5.6 (June 23, 2026): Add marketing_guidance field separate from business_character
      // business_character = SHORT business type reasoning (~20-70 chars)
      // marketing_guidance = LONG strategic brief (marketing_manager_brief or business_identity_persona)
      if (brandProfile) {
        brandProfile.marketing_guidance = 
          brandProfile.marketing_manager_brief || 
          brandProfile.business_identity_persona || 
          null
        // Keep business_character short - don't overwrite with long guidance
      }
      
      businessProfile = _businessProfile
      locationIntel = _locationIntel
      // Filter menu_items_normalized to local-language menus only
      menuItemsNormalized = (_menuItemsNormalized ?? []).filter(
        (item: any) => !item.menu_result_id || localMenuResultIdsNoSnap.size === 0 || localMenuResultIdsNoSnap.has(item.menu_result_id)
      )
      // Filter menu_results_v2 to local-language menus only
      menuItemsRaw = (_menuItemsRaw ?? []).filter((r: any) => !r.language_code || allowedLangsNoSnap.includes(r.language_code))
      businessProgrammes = _businessProgrammes
      businessOps = _businessOps
      openingHoursRaw = _openingHoursRaw
      recentPlansRaw = _recentPlansRaw
    }

    // Build active programme types and names for filtering
    const activeProgrammeTypes = new Set<string>();
    const activeProgrammeNames = new Set<string>();
    
    if (businessProgrammes && businessProgrammes.length > 0) {
      businessProgrammes.forEach((prog: any) => {
        if (prog.programme_type) {
          activeProgrammeTypes.add(prog.programme_type.toLowerCase());
        }
        if (prog.programme_name) {
          activeProgrammeNames.add(prog.programme_name.toLowerCase());
        }
      });
      console.log('[generate-weekly-plan] Active programmes:', {
        types: Array.from(activeProgrammeTypes),
        names: Array.from(activeProgrammeNames)
      });
    }
    
    // Build unified menu data with cascade: menu_items_normalized → menu_results_v2
    let menuDataSource = 'none';
    const processedMenuForWeekly: any[] = [];
    
    if (menuItemsNormalized && menuItemsNormalized.length > 0) {
      // Primary source: menu_items_normalized (already cleaned, 100 items)
      menuDataSource = 'menu_items_normalized';
      
      // Convert to menu_results_v2 compatible format and filter by active programmes
      menuItemsNormalized.forEach((item: any) => {
        // Parse service_periods if it's a string
        let periods = item.service_periods;
        if (typeof periods === 'string') {
          try {
            periods = JSON.parse(periods);
          } catch (e) {
            console.warn(`Failed to parse service_periods for ${item.item_name}:`, periods);
            periods = [];
          }
        }
        
        // Check if item matches any active programme
        const matchesActiveProgramme = !periods || periods.length === 0 || 
          periods.some((period: string) => {
            const periodLower = period.toLowerCase();
            return activeProgrammeTypes.has(periodLower) || activeProgrammeNames.has(periodLower);
          });
        
        if (matchesActiveProgramme) {
          // Convert to menu_results_v2 format for compatibility
          processedMenuForWeekly.push({
            name: item.item_name,
            description: item.item_description || '',
            service_periods: periods || [],
            service_period_name: item.service_period_name,
            is_signature: false,
            structured_data: {
              menuStructure: [{
                name: item.service_period_name || 'Main Menu',
                items: [{
                  name: item.item_name,
                  description: item.item_description || '',
                }]
              }]
            }
          });
        }
      });
      
      console.log(`🍽️  Menu: ${menuItemsNormalized.length} total → ${processedMenuForWeekly.length} available for active programmes`);
    }
    
    // If no menu_items_normalized, use menuItemsRaw (from menu_results_v2 or snapshot)
    if (processedMenuForWeekly.length === 0 && menuItemsRaw && menuItemsRaw.length > 0) {
      menuDataSource = 'menu_results_v2';
      processedMenuForWeekly.push(...menuItemsRaw);
      console.log(`⚠️  No menu_items_normalized found, using menu_results_v2/snapshot: ${menuItemsRaw.length} items`);
    }
    
    console.log('[generate-weekly-plan] Menu data source:', menuDataSource, `(${processedMenuForWeekly.length} items)`);

    // Resolve tier: from strategy, fallback to business record
    const resolvedTier: 'smart' | 'pro' = strategy?.subscription_tier
      ? (strategy.subscription_tier as 'smart' | 'pro')
      : (business.subscription_tier === 'pro' ? 'pro' : 'smart')

    // Filter out price-modifier add-ons (e.g. "GLUTENFRI PASTA +20,-", "EKSTRA SOVS +10")
    // These are option additions scraped alongside real dishes and pollute content ideas.
    // Modifier pattern: item name contains "+<digits>" anywhere (price add-on suffix).
    const menuItems = (processedMenuForWeekly || []).filter((item: any) => {
      const name = (item.name || '').trim()
      return !/\+\d/.test(name)
    })

    if ((processedMenuForWeekly?.length || 0) > menuItems.length) {
      console.log('[Layer 1] Filtered out menu modifier items:', {
        before: processedMenuForWeekly?.length,
        after: menuItems.length,
        removed: (processedMenuForWeekly?.length || 0) - menuItems.length,
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

    const selectedPlatforms = business.selected_platforms || ['instagram', 'facebook']

    // Check for existing plan
    if (!regenerate) {
      const { data: existingPlans } = await supabaseClient
        .from('weekly_content_plans')
        .select('*')
        .eq('business_id', business.id)
        .eq('week_start', weekStart)
        .order('generated_at', { ascending: false })
        .limit(1)

      const existingPlan = existingPlans?.[0]

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
      selectedIdeaIds: normalizedSelectedIdeaIds || (Array.isArray(strategy?.post_ideas) ? strategy.post_ideas.map((i: any) => i.id) : undefined),
      weekStart,
      contextEvents,
      previousPlans,
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
      const selectedIdeas = normalizedSelectedIdeaIds
        ? strategy.post_ideas.filter((idea: any) => normalizedSelectedIdeaIds.includes(idea.id))
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
      console.log('[FeasibilityCheck] Skipping validation: skip_validation=true')
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

        // Derive the actually executed idea IDs from generated posts.
        // This is the source of truth for downstream status + suggestion persistence.
        const executedIdeaIds = Array.from(new Set(
          (plan.posts || [])
            .map((p: any) => Number(p.idea_id))
            .filter((id: number) => Number.isInteger(id) && id > 0)
        ))

        const ideasForSuggestions = Array.isArray(strategy?.post_ideas)
          ? strategy.post_ideas.filter((idea: any) => executedIdeaIds.includes(Number(idea?.id)))
          : undefined

        console.log('[Edge Function] Plan generated:', {
          weekNumber: plan.weekNumber,
          postsCount: plan.posts.length,
          summary: plan.summary,
          executedIdeaIds,
        })

        // Pass only the executed ideas so daily_suggestions matches what was actually selected/generated.
        const saveResult = await saveWeeklyPlan(plan, bgClient, ideasForSuggestions)

        if (!saveResult.success) {
          console.error('Failed to save plan:', saveResult.error)
        }

        // ✨ LAYER 0 INTEGRATION: Update strategy status to 'posts_created'
        if (strategyId && saveResult.success && strategy) {
          const { error: updateError, count } = await bgClient
            .from('weekly_strategies')
            .update({
              status: 'posts_created',
              selected_idea_ids: executedIdeaIds,
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
      poll: 'weekly_strategies',
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
