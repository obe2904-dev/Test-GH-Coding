import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateWeeklyStrategy } from '../_shared/post-helpers/weekly-strategy-generator.ts'
import { generateWeeklyModulation } from '../_shared/post-helpers/strategy/strategy-modulator.ts'
import { interpretWeather } from '../_shared/post-helpers/strategy/weather-interpreter.ts'
import { buildMotivationBlock } from '../_shared/post-helpers/strategy/motivation-lookup.ts'
import type { WeeklyStrategy, WeekWeather, DayWeather, Platform, SubscriptionTier, WeekContext, BusinessArchetype, GuestOccasion, WeekModifiers } from '../_shared/post-helpers/types/strategy-types.ts'
import { buildLocationIntelligence } from '../_shared/brand-profile/index.ts'
import { filterAudienceLabels } from '../_shared/utils/audience-filter.ts'
import { calculateEconomicTiming, deriveWeeklyInterpretation, getRealSeasonContext } from './context-interpreters.ts'
import { fetchWeatherFromCoordinates, createSeasonalFallbackWeather } from './weather-fetcher.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  business_id: string;
  week_start?: string;    // ISO date (Monday). If omitted, calculate next Monday
  include_current_week?: boolean; // True if user wants current week (Mon-Thu/Fri)
  regenerate?: boolean;   // Force fresh generation, ignore cache
  target_post_count?: number; // Pro: user-selected count (1–7). Smart: always capped at 4.
  owner_note?: string;    // Optional free-text from owner: "anything special this week?"
}

/**
 * Calculate next Monday from a given date
 */
function getNextMonday(from: Date = new Date()): Date {
  const date = new Date(from);
  const day = date.getDay();
  const daysUntilMonday = day === 0 ? 1 : (8 - day) % 7;
  date.setDate(date.getDate() + daysUntilMonday);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Calculate ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )
    
    // Development mode: Skip auth if SKIP_AUTH=true
    const skipAuth = Deno.env.get('SKIP_AUTH') === 'true';
    
    // Authenticate user (unless in dev mode)
    let user: any = null;
    if (!skipAuth) {
      const {
        data: { user: authUser },
        error: userError,
      } = await supabaseClient.auth.getUser()

      if (userError || !authUser) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Unauthorized' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        })
      }
      user = authUser;
    }
    
    // ALWAYS use service role client for data operations
    // This function needs full access to business data for AI generation
    // User authentication is verified above, but RLS would block necessary queries
    const dataClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const body: RequestBody = await req.json()
    
    if (!body.business_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'business_id is required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    console.log('[get-weekly-strategy] Querying business:', {
      business_id: body.business_id,
      skip_auth: skipAuth,
    });

    // Verify business exists and user has access (RLS enforced unless skipAuth)
    const { data: business, error: businessError } = await dataClient
      .from('businesses')
      .select('id, owner_id')
      .eq('id', body.business_id)
      .single();

    console.log('[get-weekly-strategy] Business query result:', {
      found: !!business,
      error: businessError?.message,
      business_id: business?.id
    });

    if (businessError || !business) {
      console.error('[get-weekly-strategy] Business lookup error:', businessError)
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Business not found or access denied'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // Verify ownership (unless in dev mode)
    if (!skipAuth && business.owner_id !== user.id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Access denied to this business' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // Get business basic info for type detection
    const { data: businessData, error: businessDataError } = await dataClient
      .from('businesses')
      .select('name, category, ai_generations_today')
      .eq('id', body.business_id)
      .single();
    
    if (businessDataError) {
      console.error('[get-weekly-strategy] Error fetching business:', businessDataError);
    }
    
    // Derive business type from category (used for framework selection)
    const businessType = businessData?.category || 'restaurant';

    // Helper: format a Date as local YYYY-MM-DD without UTC shift
    const toLocalISO = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // Calculate week dates (parse YYYY-MM-DD as LOCAL date to avoid UTC-midnight shift)
    let weekStartDate: Date;
    if (body.week_start) {
      const [_y, _m, _d] = body.week_start.split('-').map(Number);
      weekStartDate = new Date(_y, _m - 1, _d); // local midnight — no UTC offset
    } else {
      weekStartDate = getNextMonday();
    }

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6); // Sunday

    const weekNumber = getWeekNumber(weekStartDate);

    // Generate all potential days (Mon-Sun) using local ISO to avoid UTC shift
    const allWeekDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStartDate);
      day.setDate(day.getDate() + i);
      allWeekDays.push(toLocalISO(day));
    }

    console.log('[get-weekly-strategy] Generating strategy:', {
      business_id: body.business_id,
      business_type: businessType,
      week_number: weekNumber,
      week_start: toLocalISO(weekStartDate),
      week_end: toLocalISO(weekEndDate),
      regenerate: body.regenerate || false,
    })

    // STEP 1: FETCH REAL BUSINESS DATA
    console.log('[get-weekly-strategy] Fetching real business data...');
    
    console.log('[get-weekly-strategy] Business context:', {
      businessData,
      hasName: !!businessData?.name,
      name: businessData?.name,
      category: businessData?.category,
      businessType,
    });
    
    // Fetch all independent business data in parallel (STEP 1)
    const [
      { data: locationData },
      { data: locationIntel },
      { data: operations },
      { data: openingHours },
      { data: brandProfile, error: brandProfileError },
      { data: businessProfileSignal },
      { data: menuItems },
      { data: profileData },
      { data: businessTier },
    ] = await Promise.all([
      dataClient
        .from('business_locations')
        .select('city, country')
        .eq('business_id', body.business_id)
        .eq('is_primary', true)
        .single(),
      dataClient
        .from('business_location_intelligence')
        .select('neighborhood, area_type, category_scores, location_marketing_hooks, latitude, longitude')
        .eq('business_id', body.business_id)
        .single(),
      dataClient
        .from('business_operations')
        .select('has_outdoor_seating, establishment_type, preferred_posts_per_week')
        .eq('business_id', body.business_id)
        .single(),
      dataClient
        .from('opening_hours')
        .select('weekday, closed, open_time, close_time')
        .eq('business_id', body.business_id)
        .eq('kind', 'normal'),
      dataClient
        .from('business_brand_profile')
        .select(`
          brand_essence,
          brand_essence_elaboration,
          core_offerings,
          tone_of_voice,
          content_focus,
          things_to_avoid,
          target_audience,
          communication_goal,
          signature_phrases,
          never_say,
          typical_openings,
          typical_closings,
          sample_posts,
          humor_level,
          booking_link,
          business_character,
          content_strategy,
          tone_model,
          voice_constraints,
          identity_keywords,
          voice_rationale,
          recognizable_interior_identity
        `)
        .eq('business_id', body.business_id)
        .single(),
      dataClient
        .from('business_profile')
        .select('menu_signal')
        .eq('business_id', body.business_id)
        .maybeSingle(),
      dataClient
        .from('menu_results_v2')
        .select('structured_data, service_periods, is_signature, ai_summary, source_url')
        .eq('business_id', body.business_id)
        .eq('status', 'done')
        .limit(20),
      dataClient
        .from('profiles')
        .select('selected_platforms')
        .eq('id', skipAuth ? business.owner_id : user.id)
        .single(),
      dataClient
        .from('businesses')
        .select('subscription_tier')
        .eq('id', body.business_id)
        .single(),
    ]);

    // Derive structured location intelligence from category_scores
    // Uses the same buildLocationIntelligence() as brand-profile-generator
    const derivedLocationIntel = buildLocationIntelligence(locationIntel);
    console.log('[get-weekly-strategy] Location intelligence:', derivedLocationIntel
      ? { primary_type: derivedLocationIntel.primary_type, motivations: derivedLocationIntel.matched_motivations, tourist: derivedLocationIntel.tourist_context }
      : 'none (no category_scores)');

    if (brandProfileError && brandProfileError.code !== 'PGRST116') {
      console.warn('[get-weekly-strategy] Brand profile fetch error:', brandProfileError);
    }
    
    console.log('[get-weekly-strategy] Brand profile:', {
      found: !!brandProfile,
      has_tone: !!brandProfile?.tone_of_voice,
      has_essence: !!brandProfile?.brand_essence
    });

    // Derive active platforms with fallback
    const activePlatforms: Platform[] = (() => {
      const raw = profileData?.selected_platforms;
      if (Array.isArray(raw) && raw.length > 0) {
        return raw.filter((p: string) => p === 'facebook' || p === 'instagram') as Platform[];
      }
      // Fallback: both platforms
      return ['facebook', 'instagram'] as Platform[];
    })();

    // Derive subscription tier with fallback
    const subscriptionTier: SubscriptionTier = 
      (businessTier?.subscription_tier === 'pro' ? 'pro' : 'smart') as SubscriptionTier;

    // Derive preferred post count with fallback
    const preferredPostsPerWeek = operations?.preferred_posts_per_week || 5;

    // Resolve actual post count based on tier:
    // Smart: always 4, Pro: use requested count (1–7), default 4
    const resolvedPostCount = subscriptionTier === 'smart'
      ? 4
      : Math.min(Math.max(body.target_post_count || 4, 1), 7);

    console.log('[get-weekly-strategy] Platform & tier context:', {
      platforms: activePlatforms,
      tier: subscriptionTier,
      preferred_posts: preferredPostsPerWeek,
    });
    
    // Generate fallback business name if not set (should rarely happen)
    const businessName = businessData?.name || 
      `${businessData?.category || 'Restaurant'} i ${locationData?.city || 'København'}`;
    
    console.log('[get-weekly-strategy] Data fetched:', {
      business_name: businessData?.name,
      businessName: businessName,
      city: locationData?.city,
      menu_items: menuItems?.length || 0,
      has_outdoor: operations?.has_outdoor_seating
    });
    
    // Filter available days by opening hours (critical: don't suggest posts on closed days)
    const weekdayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const openDays = new Set<string>();
    
    if (openingHours && openingHours.length > 0) {
      openingHours.forEach(h => {
        if (!h.closed) {
          openDays.add(h.weekday.toLowerCase());
        }
      });
    } else {
      // If no opening hours configured, assume all days open (fallback)
      weekdayMap.forEach(day => openDays.add(day));
    }
    
    // Filter availableDays: only include days when business is open
    const availableDays = allWeekDays.filter(dateStr => {
      const date = new Date(dateStr);
      const weekday = weekdayMap[date.getDay()];
      return openDays.has(weekday);
    });
    
    console.log('[get-weekly-strategy] Opening hours filter applied:', {
      all_days: allWeekDays.length,
      open_days: Array.from(openDays),
      valid_post_days: availableDays.length,
      filtered_out: allWeekDays.length - availableDays.length
    });

    // Build ISO date → open_time map for the week.
    // Phase 2b uses this to ensure suggested_time is never before the business opens.
    const openTimeByWeekday: Record<string, string | null> = {};
    if (openingHours && openingHours.length > 0) {
      openingHours.forEach((h: { weekday: string; open_time?: string | null }) => {
        openTimeByWeekday[h.weekday.toLowerCase()] = h.open_time ?? null;
      });
    }
    const dailyOpenTime: Record<string, string | null> = {};
    allWeekDays.forEach(dateStr => {
      const date = new Date(dateStr);
      const weekday = weekdayMap[date.getDay()];
      dailyOpenTime[dateStr] = openTimeByWeekday[weekday] ?? null;
    });

    // Build ISO date → close_time map for the week.
    // Phase 2b uses this to avoid scheduling posts after the business has closed.
    const closeTimeByWeekday: Record<string, string | null> = {};
    if (openingHours && openingHours.length > 0) {
      openingHours.forEach((h: { weekday: string; close_time?: string | null }) => {
        closeTimeByWeekday[h.weekday.toLowerCase()] = h.close_time ?? null;
      });
    }
    const dailyCloseTime: Record<string, string | null> = {};
    allWeekDays.forEach(dateStr => {
      const date = new Date(dateStr);
      const weekday = weekdayMap[date.getDay()];
      dailyCloseTime[dateStr] = closeTimeByWeekday[weekday] ?? null;
    });

    console.log('[get-weekly-strategy] Daily open times:', dailyOpenTime);
    
    // Extract menu context — ai_summary is the primary signal; structured_data parsing is secondary.
    // Both are collected in a single pass so ai_summary is never siloed.
    const signatureItems: Array<{name: string; description?: string; category?: string; price?: string; isSignature?: boolean}> = [];
    const allMenuItems: Array<{name: string; description?: string; category?: string; price?: string; isSignature?: boolean}> = [];
    const aiSummaryItems: string[] = []; // fallback lines derived from ai_summary text
    const allIngredients: Set<string> = new Set();
    const detectedServicePeriods: Set<string> = new Set();
    const menuSummaries: Array<{title: string; source_url: string; summary: string}> = [];

    if (menuItems) {
      for (const item of menuItems) {
        // Collect service periods
        if (item.service_periods) {
          item.service_periods.forEach((period: string) => detectedServicePeriods.add(period));
        }

        // PRIMARY: ai_summary — build Phase 0 helicopter entries AND extract fallback names
        if (item.ai_summary) {
          const urlSegments = (item.source_url || '').split('/').filter(Boolean);
          const urlTitle = urlSegments[urlSegments.length - 1]
            ?.replace(/-/g, ' ')
            ?.replace(/\.(html|htm|php|aspx)$/i, '')
            ?.toUpperCase() || 'MENU';
          const title = (item as any).service_period_name?.toUpperCase() || urlTitle;
          menuSummaries.push({
            title,
            source_url: item.source_url || '',
            summary: item.ai_summary,
          });

          // Extract readable lines from summary as fallback dish names
          // (strip leading bullet/dash chars, keep non-empty lines)
          const lines = item.ai_summary
            .split('\n')
            .map((l: string) => l.replace(/^[\s•\-–*]+/, '').trim())
            .filter((l: string) => l.length > 3);
          aiSummaryItems.push(...lines);
        }

        // SECONDARY: structured_data — explicit signature items + ingredients
        const categories = item.structured_data?.menuStructure || item.structured_data?.categories;
        if (categories) {
          // Category-level blocklist: entire categories that are never suitable for social posts
          const BLOCKED_CATEGORY_PATTERNS = [
            /børnemenu/i,   // kids menu
            /børn/i,        // children section
            /kids/i,
            /drikkevarer/i, // drinks/beverages
            /drinks/i,
            /tilvalg/i,     // add-ons / extras
            /ekstra/i,      // extras section
            /snacks/i,      // nachos/snacks section (supplements)
          ];
          // Dish-level blocklist: individual items that are supplements, surcharges, or price bundles
          const BLOCKED_DISH_PATTERNS = [
            /^ekstra\s/i,            // "Ekstra fritter", "Ekstra hakkebøf"
            /^hertil\s/i,            // "Hertil tilvalg af..."
            /^kan\s/i,               // "Kan serveres med glutenfri..."
            /ad\s+lib[ui]t/i,        // "AD LIBITUM DRIKKEVARER"
            /drikkevarer/i,
            /vinmenu/i,              // wine pairing package
            /^glutenfri\s+pasta$/i,  // surcharge line
            /^bacon$/i,              // lone "Bacon" add-on line
          ];
          for (const category of categories) {
            const categoryName = category.name || category.title || '';
            // Skip blocked categories entirely
            if (BLOCKED_CATEGORY_PATTERNS.some(rx => rx.test(categoryName))) continue;
            const dishes = category.items || category.dishes || [];
            for (const dish of dishes) {
              const dishName = dish.name || dish.title;
              if (dishName) {
                // Skip blocked dish name patterns (add-ons, surcharges, admin lines)
                if (BLOCKED_DISH_PATTERNS.some(rx => rx.test(dishName.trim()))) continue;
                // Skip pure price-supplement entries: no description AND price < 50 DKK
                const dishPrice = parseFloat(dish.price || '9999');
                if (!dish.description && dishPrice < 50) continue;
                const menuEntry = {
                  name: dishName,
                  description: dish.description || dish.short_desc || undefined,
                  category: categoryName || undefined,
                  price: dish.price || undefined,
                  isSignature: !!(item.is_signature || dish.isSignature),
                  // Carry the parent menu row's service_periods so Phase 2b can filter by slot time
                  service_periods: Array.isArray(item.service_periods) ? item.service_periods : [],
                };
                allMenuItems.push(menuEntry);
                if (item.is_signature || dish.isSignature) {
                  signatureItems.push(menuEntry);
                }
              }
              const ingredients = dish.ingredients || dish.description?.match(/\b(kylling|laks|bøf|tomat|citron|broccoli|pasta|ris)\b/gi) || [];
              if (ingredients) {
                ingredients.forEach((ing: string) => allIngredients.add(ing.toLowerCase()));
              }
            }
          }
        }
      }
    }

    // Priority: explicit signature → all parsed items → ai_summary lines (as name-only entries)
    // No longer capping at 5 — all dishes flow through so Phase 2b and the caption generator
    // have the full menu to rotate across (deduplication happens per-week in Phase 2b).
    const aiSummaryFallback = aiSummaryItems.slice(0, 8).map(line => ({ name: line }));
    const finalSignatureItems =
      allMenuItems.length > 0 ? allMenuItems :   // Use all parsed items (signature ones have isSignature:true)
      aiSummaryFallback.length > 0 ? aiSummaryFallback :
      [];

    console.log('[get-weekly-strategy] Menu extraction:', {
      structured_items: allMenuItems.length,
      explicit_signature: signatureItems.length,
      items_with_descriptions: allMenuItems.filter(i => !!i.description).length,
      ai_summary_lines: aiSummaryItems.length,
      summaries_available: menuSummaries.length,
      final_source: allMenuItems.length > 0 ? 'structured_data' : aiSummaryItems.length > 0 ? 'ai_summary' : 'none',
      final_items_count: finalSignatureItems.length,
    });
    console.log('[get-weekly-strategy] Menu summaries available:', menuSummaries.length);
    
    let locationType = 'city_center'; // default
    let locationCategories: Array<{type: string; score: number}> | null = null;
    // Max menu price for student audience price-gate (same logic as Brand Profile)
    const _maxMenuPrice: number | null = allMenuItems.length > 0
      ? (allMenuItems.map(m => parseFloat((m as any).price || '')).filter(p => !isNaN(p) && p > 0).sort((a, b) => b - a)[0] ?? null)
      : null;
    if (locationIntel?.category_scores) {
      const scores = locationIntel.category_scores as Record<string, number>;
      const sorted = Object.entries(scores).sort(([,a], [,b]) => b - a);
      // Primary type: top category if score > 50 (backward compat)
      if (sorted[0] && sorted[0][1] > 50) {
        locationType = sorted[0][0];
      }
      // Permitted audience types via shared filter (price-gated, same logic as Brand Profile)
      const { permittedKeys: _permittedKeys } = filterAudienceLabels(scores, _maxMenuPrice);
      if (_permittedKeys.length > 0) {
        locationCategories = _permittedKeys
          .slice(0, 4)
          .map(type => ({ type, score: scores[type] ?? 0 }));
      }
    }
    
    // STEP 2: CALCULATE ECONOMIC TIMING (pure date logic)
    const economicTiming = calculateEconomicTiming(weekStartDate);
    console.log('[get-weekly-strategy] Economic timing:', economicTiming);
    
    // STEP 3: FETCH REAL EVENTS FROM CONTEXTUAL CALENDAR
    console.log('[get-weekly-strategy] Fetching contextual events...');
    // Normalize country name → ISO-2 code (business_locations stores full names)
    const COUNTRY_NAME_TO_CODE: Record<string, string> = {
      'danmark': 'DK', 'denmark': 'DK',
      'norge': 'NO', 'norway': 'NO',
      'sverige': 'SE', 'sweden': 'SE',
      'finland': 'FI',
      'island': 'IS', 'iceland': 'IS',
    };
    const rawCountry = locationData?.country || 'DK';
    const country = COUNTRY_NAME_TO_CODE[rawCountry.toLowerCase()] ?? rawCountry;
    const weekStartISO = toLocalISO(weekStartDate);
    
    // Fetch 2 weeks ahead to catch lead-up events (e.g., Valentine's needing 3-5 day prep)
    const twoWeeksAhead = new Date(weekStartDate);
    twoWeeksAhead.setDate(twoWeeksAhead.getDate() + 14);
    const twoWeeksISO = twoWeeksAhead.toISOString().split('T')[0];
    
    console.log('[get-weekly-strategy] Events query params:', { country, weekStartISO, twoWeeksISO });
    const { data: eventsData, error: eventsError } = await dataClient
      .from('contextual_calendar')
      .select('event_type, event_name, date_start, date_end, relevance_tags, content_angle, marketing_hook, commercial_weight, lead_days')
      .eq('country', country)
      .gte('date_start', weekStartISO)
      .lte('date_start', twoWeeksISO)
      .order('commercial_weight', { ascending: false })
      .order('date_start', { ascending: true });
    
    if (eventsError) {
      console.error('[get-weekly-strategy] Events fetch error:', JSON.stringify(eventsError));
    }
    
    // Map to UpcomingEvent[] format
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekEndISO = toLocalISO(weekEndDate);
    const upcomingEvents = (eventsData || [])
      .map((e: any) => {
        const eventDate = new Date(e.date_start);
        eventDate.setHours(0, 0, 0, 0);
        const daysAway = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          name: e.event_name,
          name_dk: e.event_name, // No separate Danish name in DB
          date: e.date_start,
          date_end: e.date_end ?? null,
          days_away: daysAway,
          // True when the event falls within this week's date range (Mon–Sun).
          // False = lookahead context only — must not be treated as "this week".
          in_week: e.date_start >= weekStartISO && e.date_start <= weekEndISO,
          type: e.event_type as 'holiday' | 'occasion' | 'season_change' | 'local' | 'school_vacation' | 'cultural',
          strategic_angle: e.content_angle || '',
          recommended_lead_days: 3, // Default, could be inferred from event_type later
          marketing_hook: e.marketing_hook ?? undefined,
          commercial_weight: (e as any).commercial_weight ?? null,
        };
      })
      .filter((e: any) => e.days_away >= 0); // Exclude past events
    
    console.log('[get-weekly-strategy] Events fetched:', {
      total: eventsData?.length || 0,
      upcoming: upcomingEvents.length,
      events: upcomingEvents.map((e: any) => `${e.name} (${e.days_away}d away)`)
    });
    
    // STEP 4: FETCH REAL WEATHER FROM OPENWEATHERMAP (with fallback)
    console.log('[get-weekly-strategy] Fetching weather forecast...');
    
    let weekWeather: WeekWeather;
    
    // Check if we have coordinates
    if (locationIntel?.latitude && locationIntel?.longitude) {
      const lat = Number(locationIntel.latitude);
      const lon = Number(locationIntel.longitude);
      
      try {
        weekWeather = await fetchWeatherFromCoordinates(lat, lon, availableDays, operations?.has_outdoor_seating || false, Deno.env.get('OPENWEATHER_API_KEY'));
        console.log('[get-weekly-strategy] Weather fetched from API:', {
          location: `${lat},${lon}`,
          days: weekWeather.days.length,
          pattern: weekWeather.pattern,
          avg_temp: weekWeather.avg_temp,
        });
      } catch (error) {
        console.error('[get-weekly-strategy] Weather API failed, using seasonal fallback:', error);
        weekWeather = createSeasonalFallbackWeather(availableDays, operations?.has_outdoor_seating || false);
      }
    } else {
      console.warn('[get-weekly-strategy] No coordinates available, using seasonal fallback');
      weekWeather = createSeasonalFallbackWeather(availableDays, operations?.has_outdoor_seating || false);
    }
    
    // STEP 5: GET REAL SEASON CONTEXT (month-based Danish seasons)
    console.log('[get-weekly-strategy] Determining season...');
    const seasonContext = getRealSeasonContext(toLocalISO(weekStartDate), country);
    console.log('[get-weekly-strategy] Season:', seasonContext.current);
    
    // STEP 6 + 6b: FETCH HISTORY IN PARALLEL
    // recent content plans (no-repeat check) + past strategy selections (engagement proxy)
    console.log('[get-weekly-strategy] Fetching previous week data...');
    // Dish ban window: only block dishes from plans generated within the last 14 days.
    // Without this, dishes from months-old plans stay blocked indefinitely.
    const fourteenDaysAgo = new Date(weekStartDate);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const fourteenDaysAgoISO = toLocalISO(fourteenDaysAgo);
    // Strategy window: cap at 6 weeks back so returning users after a long break
    // are treated as fresh rather than carrying stale preference data.
    const sixWeeksAgo = new Date(weekStartDate);
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
    const sixWeeksAgoISO = toLocalISO(sixWeeksAgo);
    const [{ data: recentPlans }, pastStrategiesResult] = await Promise.all([
      supabaseClient
        .from('weekly_content_plans')
        .select('posts, generated_at')  // 'posts' is the actual save column (was incorrectly 'post_ideas')
        .eq('business_id', body.business_id)
        .gte('generated_at', fourteenDaysAgoISO) // Only plans from last 14 days
        .order('generated_at', { ascending: false })
        .limit(2),
      supabaseClient
        .from('weekly_strategies')
        .select('post_ideas, selected_idea_ids, strategy_rationale, narrative, strategic_brief, week_start, week_number')
        .eq('business_id', body.business_id)
        .lt('week_start', toLocalISO(weekStartDate))
        .gte('week_start', sixWeeksAgoISO) // Only strategies from last 6 weeks
        .order('week_start', { ascending: false })
        .limit(4),
    ]);

    // Aggregate posts from all recent plans (up to 2 weeks)
    const allRecentIdeas: any[] = (recentPlans ?? []).flatMap(
      (plan: any) => (plan.posts as any[]) || []
    );
    
    // Extract menu item names from weekly_content_plans.posts (PostSpecification shape)
    const menuItemsFromPlans = allRecentIdeas
      .map((p: any) =>
        // PostSpecification shape: contentSubject.menuItemName (exact DB name) or contentSubject.dish
        p.contentSubject?.menuItemName || p.contentSubject?.dish || p.menu_item_name
      )
      .filter(Boolean);

    // Also extract menu items from weekly_strategies.post_ideas (Phase 2b output shape).
    // This provides dedup coverage even when weekly_content_plans hasn't been populated yet
    // (e.g. both weeks generated in the same session before generate-weekly-plan runs).
    // pastStrategiesResult is filtered lt(week_start) so it only covers previous weeks.
    const { data: pastStrategiesForMenuDedup } = pastStrategiesResult;
    const menuItemsFromStrategies = (pastStrategiesForMenuDedup ?? [])
      .slice(0, 2) // Only the 2 most recent past weeks
      .flatMap((s: any) => (s.post_ideas as any[]) || [])
      .map((idea: any) => idea.menu_item_used)
      .filter(Boolean);

    const previousWeek = {
      data_available: false, // Stays false until FB/IG API integration
      posted_menu_items: [...new Set([...menuItemsFromPlans, ...menuItemsFromStrategies])],
      posted_content_types: allRecentIdeas
        .map((p: any) => p.postType?.type || p.postType?.category || p.content_type)
        .filter(Boolean),
      top_post: undefined, // Populated when FB/IG API arrives
      selection_patterns: undefined as any,
    };

    // STEP 6b: SELECTION PATTERNS — process result from parallel fetch above
    try {
      const { data: pastStrategies } = pastStrategiesResult;

      if (pastStrategies && pastStrategies.length > 0) {
        const goalModeTally: Record<string, number> = {};
        const categoryTally: Record<string, number> = {};
        let totalSelected = 0;

        for (const plan of pastStrategies) {
          const ideas: any[] = plan.post_ideas || [];
          const selectedIds = new Set<number>((plan.selected_idea_ids as number[]) || []);
          if (selectedIds.size === 0) continue;

          for (const idea of ideas) {
            if (!selectedIds.has(idea.id)) continue;
            totalSelected++;
            if (idea.goal_mode) {
              goalModeTally[idea.goal_mode] = (goalModeTally[idea.goal_mode] || 0) + 1;
            }
            if (idea.content_category) {
              categoryTally[idea.content_category] = (categoryTally[idea.content_category] || 0) + 1;
            }
          }
        }

        if (totalSelected >= 3) { // Need at least 3 selections to be meaningful
          const goalModeRates: Record<string, number> = {};
          for (const [mode, count] of Object.entries(goalModeTally)) {
            goalModeRates[mode] = Math.round((count / totalSelected) * 100) / 100;
          }
          const preferredGoalMode = Object.entries(goalModeTally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
          const preferredCategory = Object.entries(categoryTally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

          previousWeek.selection_patterns = {
            weeks_analyzed: pastStrategies.length,
            goal_mode_rates: goalModeRates,
            preferred_goal_mode: preferredGoalMode,
            preferred_category: preferredCategory,
          };
          console.log('[get-weekly-strategy] Selection patterns:', previousWeek.selection_patterns);
        }

        // STEP 6b-ii: PREVIOUS ANGLE FOCUSES — extract Phase 1 focus labels from last 2 weeks
        // so Phase 1 can softly avoid repeating the same strategic theme.
        const previousAngleFocuses: string[] = [];
        for (const s of pastStrategies.slice(0, 2)) {
          const brief = (s as any).strategic_brief;
          if (brief && Array.isArray(brief.angles)) {
            for (const a of brief.angles) {
              if (a.focus && !previousAngleFocuses.includes(a.focus)) {
                previousAngleFocuses.push(a.focus);
              }
            }
          }
        }
        if (previousAngleFocuses.length > 0) {
          (previousWeek as any).previous_angle_focuses = previousAngleFocuses;
          console.log('[get-weekly-strategy] Previous angle focuses:', previousAngleFocuses);
        }

        // STEP 6b-iii: FLEXIBLE SLOT DOWS — extract DOW of Slot D posts from last 2 weeks
        // so Phase 2a can prefer fresh days for the flexible slot.
        const previousFlexibleDows: number[] = [];
        for (const s of pastStrategies.slice(0, 2)) {
          const ideas: any[] = (s as any).post_ideas || [];
          for (const idea of ideas) {
            if (idea.slot_id === 'D' && idea.suggested_day) {
              const dow = new Date(idea.suggested_day + 'T00:00:00').getDay();
              if (!previousFlexibleDows.includes(dow)) previousFlexibleDows.push(dow);
            }
          }
        }
        if (previousFlexibleDows.length > 0) {
          (previousWeek as any).previous_flexible_dows = previousFlexibleDows;
          console.log('[get-weekly-strategy] Previous flexible DOWs:', previousFlexibleDows);
        }

        // STEP 6b-iv: PREVIOUS SLOT CONTENT TYPES — extract slot_id → content_category from
        // the most recent past week so Phase 1 can rotate build_brand / retain_loyalty
        // assignments and avoid an identical structural sequence two weeks in a row.
        const mostRecentStrategy = pastStrategies[0];
        if (mostRecentStrategy) {
          const ideas: any[] = (mostRecentStrategy as any).post_ideas || [];
          const prevSlotContentTypes: Array<{ slot_id: string; content_category: string }> = ideas
            .filter((idea: any) => idea.slot_id && idea.content_category)
            .map((idea: any) => ({ slot_id: String(idea.slot_id), content_category: String(idea.content_category) }));
          if (prevSlotContentTypes.length > 0) {
            (previousWeek as any).previous_slot_content_types = prevSlotContentTypes;
            console.log('[get-weekly-strategy] Previous slot content types:', prevSlotContentTypes);
          }
        }
      }
    } catch (e) {
      console.warn('[get-weekly-strategy] Could not compute selection_patterns:', (e as Error).message);
    }

    // STEP 6c: PAST WEEK SUMMARIES — injects last 1–2 week_summary + overview + content_types into previousWeek
    // so Phase 1 and Phase 2c can self-check phrasing AND structural patterns against prior weeks.
    try {
      const { data: pastStratData } = pastStrategiesResult;
      if (pastStratData && pastStratData.length > 0) {
        const summaries: Array<{ week_number: number; week_summary: string; overview: string; selected_content_types: string[] }> = [];
        for (const s of pastStratData.slice(0, 2)) {
          const wkSummary = ((s as any).strategy_rationale as string | null) ?? '';
          const narrativeRaw = (s as any).narrative;
          let overview = '';
          if (narrativeRaw && typeof narrativeRaw === 'object') {
            overview = String((narrativeRaw as any).overview ?? '');
          } else if (typeof narrativeRaw === 'string') {
            try { overview = JSON.parse(narrativeRaw)?.overview ?? ''; } catch { /* noop */ }
          }
          // Extract content_category of selected ideas so Phase 1 knows last week's structural shape
          const ideas: any[] = (s as any).post_ideas || [];
          const selectedIds = new Set<number>(((s as any).selected_idea_ids as number[]) || []);
          const selectedContentTypes = ideas
            .filter((idea: any) => selectedIds.has(idea.id))
            .map((idea: any) => idea.content_category || idea.category || '')
            .filter(Boolean);
          if (wkSummary || overview) {
            summaries.push({
              week_number: ((s as any).week_number as number) ?? 0,
              week_summary: wkSummary,
              overview: overview.replace(/^•\s*/gm, '').trim(),
              selected_content_types: selectedContentTypes,
            });
          }
        }
        if (summaries.length > 0) {
          (previousWeek as any).past_week_summaries = summaries;
        }
      }
    } catch (e) {
      console.warn('[get-weekly-strategy] Could not extract past_week_summaries:', (e as Error).message);
    }

    console.log('[get-weekly-strategy] Previous week:', {
      has_data: (recentPlans ?? []).length > 0,
      plans_found: (recentPlans ?? []).length,
      posted_items_count: previousWeek.posted_menu_items.length,
      posted_types: previousWeek.posted_content_types,
    });
    
    // Build complete WeekContext with real data
    const weekContext = {
      week_number: weekNumber,
      week_start: toLocalISO(weekStartDate),
      week_end: toLocalISO(weekEndDate),
      available_days: availableDays,
      daily_open_time: dailyOpenTime,
      daily_close_time: dailyCloseTime,
      booking_link: (brandProfile as any)?.booking_link ?? null,
      is_current_week: body.include_current_week || false,
      
      // REAL: Business data (Step 1)
      business_name: businessName,
      business_type: businessType as any,
      // AI-generated plain-text description of what this business is.
      // Replaces the deprecated framework/alias system in Phase 1 & 2 strategy prompts.
      business_character: brandProfile?.business_character ?? undefined,
      // WP4: Operational programme signals from menu_signal extraction
      menu_programmes: (businessProfileSignal?.menu_signal?.programmes as Array<{ role: string; timeContext: string | null; items: string[] }> | null) ?? null,
      // WP5: Late-night signal derived from opening_hours
      late_night_closing: (() => {
        if (!openingHours || openingHours.length === 0) return false
        return openingHours.some((row: any) => {
          const h = parseInt((row.close_time || '00:00').split(':')[0], 10)
          return !row.closed && h >= 0 && h < 6
        })
      })(),
      city: locationData?.city || 'Copenhagen',
      country: locationData?.country || 'DK',
      
      service_periods: Array.from(detectedServicePeriods) as any[],
      // Balance across service periods so no single menu dominates (brunch/lunch/dinner get equal representation).
      // Brunch URL is iterated first in DB order → without balancing, the first-20 slice was all brunch
      // and dinner dishes never made it into the pool, causing the Phase 2b service-period filter to fall back.
      // No per-period cap — all dishes are included. Phase 2b filters to only the relevant period per slot,
      // so passing the full menu is correct and poses no prompt-size risk (each period sees its own subset).
      signature_items: (() => {
        const byPeriod = new Map<string, typeof finalSignatureItems>();
        for (const item of finalSignatureItems) {
          const sp = ((item as any).service_periods as string[] | undefined);
          const key = (sp && sp.length > 0) ? sp[0] : 'other';
          if (!byPeriod.has(key)) byPeriod.set(key, []);
          byPeriod.get(key)!.push(item);
        }
        // Interleave across periods so the list isn't front-loaded with one period
        const balanced: typeof finalSignatureItems = [];
        for (const items of byPeriod.values()) balanced.push(...items);
        return balanced;
      })(),
      menu_summaries: menuSummaries.length > 0 ? menuSummaries : undefined, // AI helicopter summaries
      seasonal_ingredients: Array.from(allIngredients).slice(0, 15), // Top 15
      
      location: {
        type: locationType as 'city_center' | 'tourist_area' | 'residential' | 'waterfront' | 'suburban',
        neighborhood: locationIntel?.neighborhood,
        area_type: locationIntel?.area_type,
        has_outdoor_seating: operations?.has_outdoor_seating || false,
        has_takeaway: operations?.has_takeaway || false,
        has_table_service: operations?.has_table_service || false,
        is_july_tourist_boost: economicTiming.is_july && locationType === 'tourist_area',
        // Enriched from category_scores: visit motivations, marketing angle, tourist flag
        matched_motivations: derivedLocationIntel?.matched_motivations ?? null,
        marketing_focus: derivedLocationIntel?.marketing_focus ?? null,
        tourist_context: derivedLocationIntel?.tourist_context ?? false,
        location_categories: locationCategories,
      },
      
      // REAL: Brand voice (Step 1) - V5 schema
      brand_voice: brandProfile ? {
        // Parse tone_of_voice JSON field
        tone_of_voice: (() => {
          const tone = brandProfile.tone_of_voice;
          if (typeof tone === 'string') {
            try { return JSON.parse(tone); } catch { return tone; }
          }
          return tone;
        })(),
        // Extract tone attributes as keywords
        tone_keywords: (() => {
          const tone = brandProfile.tone_of_voice;
          if (typeof tone === 'object' && tone?.attributes) {
            return tone.attributes;
          }
          if (typeof tone === 'string') {
            try { 
              const parsed = JSON.parse(tone);
              return parsed.attributes || [];
            } catch { return []; }
          }
          return [];
        })(),
        // Map brand essence to voice style
        voice_style: brandProfile.brand_essence || '',
        // Parse things_to_avoid as do_not_say
        do_not_say: (() => {
          const avoid = brandProfile.things_to_avoid;
          if (typeof avoid === 'string') {
            try { return JSON.parse(avoid); } catch { return {}; }
          }
          return avoid || {};
        })(),
        // Parse content_focus as content_pillars
        content_pillars: (() => {
          const focus = brandProfile.content_focus;
          if (typeof focus === 'string') {
            try { return JSON.parse(focus); } catch { return {}; }
          }
          return focus || {};
        })(),
        // V5 specific enrichment fields
        signature_phrases: brandProfile.signature_phrases || [],
        never_say: brandProfile.never_say || [],
        typical_openings: brandProfile.typical_openings || [],
        typical_closings: brandProfile.typical_closings || [],
        communication_goal: brandProfile.communication_goal || null,
        humor_level: brandProfile.humor_level || 'moderate',
        // Previously fetched but never wired into the prompt — now connected
        target_audience: (() => {
          const ta = brandProfile.target_audience;
          if (typeof ta === 'string') { try { return JSON.parse(ta); } catch { return ta; } }
          return ta || null;
        })(),
        core_offerings: (() => {
          const co = brandProfile.core_offerings;
          if (typeof co === 'string') { try { return JSON.parse(co); } catch { return co; } }
          return co || null;
        })(),
        // V2 fields — Brand Profile V2 (March 2026)
        brand_essence: brandProfile.brand_essence || '',
        brand_essence_elaboration: brandProfile.brand_essence_elaboration || null,
        identity_keywords: brandProfile.identity_keywords || null,
        voice_constraints: brandProfile.voice_constraints || null,
        tone_model: (() => {
          const tm = brandProfile.tone_model;
          if (typeof tm === 'string') { try { return JSON.parse(tm); } catch { return null; } }
          return tm || null;
        })(),
        // Content strategy — drives Phase 1 slot assignment (goal_mode + content_category per post)
        content_strategy: (() => {
          const cs = brandProfile.content_strategy;
          if (typeof cs === 'string') { try { return JSON.parse(cs); } catch { return null; } }
          return cs || null;
        })(),
        // v5: voice_rationale — "Hvorfor denne anbefaling?" — explains which register to AVOID and why.
        // Critical negative constraint for atmosphere/behind_scenes/team_people posts.
        voice_rationale: typeof (brandProfile as any).voice_rationale === 'string'
          ? (brandProfile as any).voice_rationale
          : null,
        // v5: recognizable_interior_identity — verified factual venue description from photo analysis.
        // Factual anchor for atmosphere posts; prevents training-data interpolation about the space.
        recognizable_interior_identity: (() => {
          const rii = (brandProfile as any).recognizable_interior_identity;
          if (typeof rii === 'string') return rii;
          if (rii && typeof rii === 'object' && typeof rii.value === 'string') return rii.value;
          return null;
        })(),
      } : undefined,
      
      // Platform & subscription context (NEW)
      platforms: activePlatforms,
      subscription_tier: subscriptionTier,
      preferred_posts_per_week: resolvedPostCount,
      owner_note: body.owner_note?.trim() || undefined,
      
      // REAL: Economic timing (Step 2)
      economic: economicTiming,
      
      // REAL: Events from contextual calendar (Step 3)
      events: upcomingEvents,
      
      // REAL: Weather from OpenWeatherMap (Step 4)
      weather: weekWeather,
      
      // REAL: Season from month-based detection (Step 5)
      season: seasonContext,
      
      // REAL: Previous week from weekly_content_plans (Step 6)
      previous_week: previousWeek,
    };
    
    console.log('[get-weekly-strategy] Context built:', {
      business_type: weekContext.business_type,
      service_periods: weekContext.service_periods,
      signature_items_count: weekContext.signature_items.length,
      location_type: weekContext.location.type,
      economic: weekContext.economic,
    });

    // ── STRATEGY MODULATOR: contextual weekly adjustment of goal_blend + CCW ──────
    // Runs before Phase 1. Injects week_goal_blend / week_content_category_weights
    // directly into weekContext so assignSlotMetadata() picks them up automatically.
    // Returns baseline unchanged if no notable signals this week (zero AI cost).
    const modulation = await generateWeeklyModulation(weekContext);
    if (weekContext.brand_voice?.content_strategy) {
      weekContext.brand_voice.content_strategy.week_goal_blend              = modulation.week_goal_blend;
      weekContext.brand_voice.content_strategy.week_content_category_weights = modulation.week_content_category_weights;
      weekContext.brand_voice.content_strategy.week_strategic_rationale     = modulation.week_strategic_rationale;
    }
    weekContext.week_mode   = modulation.week_mode;
    weekContext.deprioritize = modulation.deprioritize;
    console.log('[get-weekly-strategy] Modulation:', {
      factors: modulation.modulation_factors,
      rationale: modulation.week_strategic_rationale,
    });

    // Check for existing strategy (prevent duplicate generation)
    const weekStartStr = toLocalISO(weekStartDate);
    const { data: existing } = await dataClient
      .from('weekly_strategies')
      .select('id, status, narrative, strategic_priorities, post_ideas, selected_idea_ids, strategic_brief, strategic_brief_raw, strategy_version, generated_at')
      .eq('business_id', body.business_id)
      .eq('week_start', weekStartStr)
      .single();

    // If already generating (pending), return immediately — frontend will poll for completion.
    // Exception: if the pending row is stale (> 5 min old), restart generation automatically.
    if (existing?.status === 'pending' && !body.regenerate) {
      const STALE_THRESHOLD_MS = 5 * 60 * 1000;
      const pendingSince = existing.generated_at ? new Date(existing.generated_at).getTime() : 0;
      const isStale = Date.now() - pendingSince > STALE_THRESHOLD_MS;
      if (!isStale) {
        console.log('[get-weekly-strategy] Generation already in progress:', existing.id);
        return new Response(JSON.stringify({
          success: true,
          strategy_id: existing.id,
          status: 'pending',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 202,
        });
      }
      console.log('[get-weekly-strategy] Stale pending row detected — restarting generation:', existing.id);
    }

    // Skip cache if regenerate flag is set
    if (existing && existing.status !== 'generated' && existing.status !== 'error' && !body.regenerate) {
      // User already selected ideas or posts created - return existing
      console.log('[get-weekly-strategy] Returning existing strategy:', {
        strategy_id: existing.id,
        status: existing.status,
        selected_ideas: existing.selected_idea_ids
      });
      
      return new Response(JSON.stringify({
        success: true,
        strategy_id: existing.id,
        strategy: {
          strategic_brief: existing.strategic_brief,
          strategic_brief_raw: existing.strategic_brief_raw,
          narrative: existing.narrative,
          strategic_priorities: existing.strategic_priorities,
          post_ideas: existing.post_ideas,
          strategy_version: existing.strategy_version,
          generated_at: new Date().toISOString(),
          week_number: weekNumber,
          business_type: weekContext.business_type,
          platforms: activePlatforms,
          subscription_tier: subscriptionTier,
          target_post_count: (existing.post_ideas as any[])?.length || 0,
          validation_passed: true,
          validation_warnings: []
        },
        selected_idea_ids: existing.selected_idea_ids,
        from_cache: true,
        week_context: {
          week_number: weekNumber,
          week_start: weekStartStr,
          week_end: toLocalISO(weekEndDate),
          available_days: availableDays,
          platforms: activePlatforms,
          subscription_tier: subscriptionTier,
          target_post_count: (existing.post_ideas as any[])?.length || 0,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Return hot cache when strategy is already generated and regeneration not requested.
    // Previously this fell through to re-generation; now that generation is async we always
    // respect the cache to avoid an unnecessary 130 s polling wait.
    if (existing?.status === 'generated' && !body.regenerate) {
      console.log('[get-weekly-strategy] Returning cached generated strategy:', existing.id);
      return new Response(JSON.stringify({
        success: true,
        strategy_id: existing.id,
        strategy: {
          strategic_brief: existing.strategic_brief,
          strategic_brief_raw: existing.strategic_brief_raw,
          narrative: existing.narrative,
          strategic_priorities: existing.strategic_priorities,
          post_ideas: existing.post_ideas,
          strategy_version: existing.strategy_version,
          generated_at: new Date().toISOString(),
          week_number: weekNumber,
          business_type: weekContext.business_type,
          platforms: activePlatforms,
          subscription_tier: subscriptionTier,
          target_post_count: (existing.post_ideas as any[])?.length || 0,
          validation_passed: true,
          validation_warnings: [],
        },
        selected_idea_ids: existing.selected_idea_ids,
        from_cache: true,
        week_context: {
          week_number: weekNumber,
          week_start: weekStartStr,
          week_end: toLocalISO(weekEndDate),
          available_days: availableDays,
          platforms: activePlatforms,
          subscription_tier: subscriptionTier,
          target_post_count: (existing.post_ideas as any[])?.length || 0,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Log if regenerating despite cache
    if (existing && body.regenerate) {
      console.log('[get-weekly-strategy] Regenerating despite existing strategy:', {
        existing_id: existing.id,
        existing_status: existing.status,
        regenerate_flag: true
      });
    }

    // ── ASYNC FIRE-AND-RESPOND: beat the 150 s HTTP proxy timeout ────────────────
    // 1. Immediately upsert a 'pending' stub row so we have a strategy_id to return.
    // 2. Run the full Gemini pipeline inside EdgeRuntime.waitUntil() — this
    //    continues executing after the HTTP response is sent, so the client
    //    never sees a 504 regardless of how long generation takes.
    // 3. Return HTTP 202 with strategy_id + status:'pending' immediately (<2 s).
    // 4. Frontend polls weekly_strategies by ID until status === 'generated'.
    // ─────────────────────────────────────────────────────────────────────────────

    // Step 1: create/reset pending stub
    // IMPORTANT: `narrative`, `strategic_priorities`, `post_ideas` are NOT NULL in the DB.
    // PostgreSQL evaluates NOT NULL constraints BEFORE ON CONFLICT resolution, so a plain
    // upsert without those fields would fail on the INSERT attempt even when an existing
    // row is present. Fix: UPDATE existing rows directly; INSERT new rows with placeholders.
    let pendingRow: { id: string } | null = null;
    let pendingError: any = null;

    if (existing) {
      // Existing row — update only the mutable columns, leaving narrative/strategic_priorities/post_ideas intact
      const { data, error } = await dataClient
        .from('weekly_strategies')
        .update({
          status: 'pending',
          generated_at: new Date().toISOString(),
          is_current_week: body.include_current_week || false,
          business_type: weekContext.business_type,
          country: weekContext.country,
          platforms: activePlatforms,
          subscription_tier: subscriptionTier,
          strategy_version: 'v2.2.0_brand_v5',
          selected_idea_ids: null, // clear previous selections so the new run starts fresh
        })
        .eq('id', existing.id)
        .select('id')
        .single();
      pendingRow = data;
      pendingError = error;
    } else {
      // No existing row — INSERT with empty placeholders for NOT NULL columns
      const { data, error } = await dataClient
        .from('weekly_strategies')
        .insert({
          business_id: body.business_id,
          week_number: weekNumber,
          week_start: weekStartStr,
          week_end: toLocalISO(weekEndDate),
          is_current_week: body.include_current_week || false,
          business_type: weekContext.business_type,
          country: weekContext.country,
          platforms: activePlatforms,
          subscription_tier: subscriptionTier,
          strategy_version: 'v2.2.0_brand_v5',
          generated_at: new Date().toISOString(),
          status: 'pending',
          narrative: '',          // placeholder — overwritten by background pipeline
          strategic_priorities: [],
          post_ideas: [],
        })
        .select('id')
        .single();
      pendingRow = data;
      pendingError = error;
    }

    if (pendingError || !pendingRow) {
      console.error('[get-weekly-strategy] Failed to create pending stub:', pendingError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to initialise generation job' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const strategyRowId = pendingRow.id;
    console.log('[get-weekly-strategy] Pending stub created, ID:', strategyRowId, '— returning 202 immediately');

    // Step 2: full pipeline runs in background after HTTP response is sent
    const backgroundGeneration = (async () => {
      try {
        console.log('[get-weekly-strategy] Background task started for strategy:', strategyRowId);
        // Derive interpretation layer (pure TS, no AI cost) before any AI calls
        const weatherInterpretation = interpretWeather(
          weekContext.weather,
          weekContext.location.has_outdoor_seating,
          weekContext.location.type,
          weekContext.service_periods
        );
        weekContext.weather_interpretation = weatherInterpretation;

        const weeklyInterp = deriveWeeklyInterpretation(weekContext);
        weekContext.business_archetype = weeklyInterp.business_archetype;
        weekContext.business_mode = weeklyInterp.business_mode;
        weekContext.business_drivers = weeklyInterp.core_business_drivers;
        weekContext.core_guest_occasions = weeklyInterp.primary_guest_occasions;
        weekContext.week_modifiers = weeklyInterp.week_modifiers;
        weekContext.strategic_priority_candidates = weeklyInterp.top_weekly_priorities;
        weekContext.strategic_priority_candidates_v2 = weeklyInterp.strategic_priority_candidates_v2;
        weekContext.narrative_guardrails = weeklyInterp.narrative_guardrails;
        weekContext.weather_is_differentiator = weeklyInterp.weather_is_differentiator;
        weekContext.weather_relevance_for_business = weeklyInterp.weather_relevance_for_business;
        weekContext.weather_effect_on_daypart = weeklyInterp.weather_effect_on_daypart;
        weekContext.weather_effect_on_visit_behavior = weeklyInterp.weather_effect_on_visit_behavior;
        weekContext.economic_relevance_for_business = weeklyInterp.economic_relevance_for_business;
        weekContext.visit_mode = weeklyInterp.visit_mode;
        weekContext.primary_visit_motivation = weeklyInterp.primary_visit_motivation;
        weekContext.secondary_visit_motivations = weeklyInterp.secondary_visit_motivations;
        weekContext.primary_daypart_this_week = weeklyInterp.primary_daypart_this_week;
        weekContext.secondary_daypart_this_week = weeklyInterp.secondary_daypart_this_week;
        weekContext.daypart_reasoning = weeklyInterp.daypart_reasoning;
        weekContext.season.seasonal_mood_signals = weeklyInterp.seasonal_mood_signals;
        weekContext.season.menu_supported_seasonal_signals = weeklyInterp.menu_supported_seasonal_signals;
        weekContext.location_behavior_mode = weeklyInterp.location_behavior_mode;
        weekContext.business_driver_ranking = weeklyInterp.business_driver_ranking;
        weekContext.weekly_framing = weeklyInterp.weekly_framing;

        const strategy = await generateWeeklyStrategy(weekContext, { regenerate: body.regenerate });

        console.log('[get-weekly-strategy] Background: strategy generated:', {
          strategy_row_id: strategyRowId,
          post_ideas_count: strategy.post_ideas.length,
          strategic_priorities: strategy.strategic_priorities.map(p => p.focus),
        });

        const { error: saveError } = await dataClient
          .from('weekly_strategies')
          .upsert({
            business_id: body.business_id,
            week_number: weekNumber,
            week_start: weekStartStr,
            week_end: toLocalISO(weekEndDate),
            is_current_week: body.include_current_week || false,
            strategic_brief: strategy.strategic_brief,
            strategic_brief_raw: strategy.strategic_brief_raw,
            narrative: strategy.narrative,
            strategic_priorities: strategy.strategic_priorities,
            post_ideas: strategy.post_ideas,
            week_context_snapshot: weekContext,
            business_type: weekContext.business_type,
            country: weekContext.country,
            platforms: activePlatforms,
            subscription_tier: subscriptionTier,
            target_post_count: strategy.post_ideas.length,
            strategy_version: 'v2.2.0_brand_v5',
            strategy_rationale: (strategy.strategic_brief as any)?.week_summary || modulation.week_strategic_rationale || null,
            status: 'generated',
          }, {
            onConflict: 'business_id,week_start',
          });

        if (saveError) {
          console.error('[get-weekly-strategy] Background: failed to save strategy:', saveError);
          await dataClient.from('weekly_strategies').update({ status: 'error' }).eq('id', strategyRowId);
        } else {
          console.log('[get-weekly-strategy] Background: strategy saved, status=generated, ID:', strategyRowId);
        }
      } catch (bgError) {
        const errMsg = bgError instanceof Error ? bgError.message : String(bgError);
        console.error('[get-weekly-strategy] Background: generation failed:', errMsg);
        try {
          await dataClient.from('weekly_strategies').update({
            status: 'error',
            strategy_rationale: `Error: ${errMsg.slice(0, 500)}`,
          }).eq('id', strategyRowId);
        } catch (_) { /* best-effort */ }
      }
    })();

    // Step 3: register with EdgeRuntime.waitUntil so the task outlives the HTTP response.
    // Falls back to await (blocking) in local dev where EdgeRuntime may not be present.
    try {
      (globalThis as any).EdgeRuntime.waitUntil(backgroundGeneration);
    } catch (_) {
      // Local dev fallback: await directly (blocking, but no 504 in local dev)
      await backgroundGeneration;
    }

    // Step 4: return 202 immediately — frontend polls weekly_strategies row for status change
    return new Response(JSON.stringify({
      success: true,
      strategy_id: strategyRowId,
      status: 'pending',
      week_context: {
        week_number: weekNumber,
        week_start: weekStartStr,
        week_end: toLocalISO(weekEndDate),
        available_days: availableDays,
        platforms: activePlatforms,
        subscription_tier: subscriptionTier,
        target_post_count: 0, // Will be known after generation completes
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 202,
    })

  } catch (error) {
    console.error('[get-weekly-strategy] Error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
