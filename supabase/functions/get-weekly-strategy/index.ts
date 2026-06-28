import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateWeeklyStrategy } from '../_shared/post-helpers/weekly-strategy-generator.ts';
import { generateWeeklyModulation } from '../_shared/post-helpers/strategy/strategy-modulator.ts';
import { interpretWeather } from '../_shared/post-helpers/strategy/weather-interpreter.ts';
import { buildLocationIntelligence } from '../_shared/brand-profile/index.ts';
import { filterAudienceLabels } from '../_shared/utils/audience-filter.ts';
import { calculateEconomicTiming, deriveWeeklyInterpretation, getRealSeasonContext } from './context-interpreters.ts';
import { fetchWeatherFromCoordinates, createSeasonalFallbackWeather } from './weather-fetcher.ts';
import { getTypeAnalytics } from '../_shared/contentTypeTracking.ts';
import { DEFAULT_TYPE_MIX, allocateContentTypes, getDominantGoalMode } from '../_shared/contentTypeSystem.ts';
import { countryToLanguageCode } from '../_shared/helpers/country-to-language.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
/**
 * Calculate next Monday from a given date
 */ function getNextMonday(from = new Date()) {
  const date = new Date(from);
  const day = date.getDay();
  const daysUntilMonday = day === 0 ? 1 : (8 - day) % 7;
  date.setDate(date.getDate() + daysUntilMonday);
  date.setHours(0, 0, 0, 0);
  return date;
}
/**
 * Calculate ISO week number
 */ function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Check if weather has changed significantly since strategy was generated
 * Returns true if regeneration is recommended due to weather changes
 */
/**
 * Assess outdoor comfort tier using weighted scoring (matches frontend logic)
 * Returns { tier: 'premium' | 'viable' | 'marginal' | 'unviable', score: 0-100 }
 */
function assessComfortTier(day: any): { tier: string; score: number } {
  const feelsLike = day.feels_like ?? day.temp_max ?? 15;
  const precipProb = day.precipitation_chance ?? 0;
  const windSpeed = day.wind_speed ?? 0;
  const condition = day.condition ?? 'cloudy';
  
  // Hard blockers (instant Unviable)
  if (feelsLike < 13) return { tier: 'unviable', score: 0 };
  if (windSpeed > 9.8) return { tier: 'unviable', score: 0 };
  
  // Active rain check
  const isRainSnow = condition === 'rain' || condition === 'snow';
  if (condition === 'snow') return { tier: 'unviable', score: 0 };
  if (isRainSnow && precipProb > 70) return { tier: 'unviable', score: 0 };
  if (precipProb > 80) return { tier: 'unviable', score: 0 };
  
  // Cloud cover estimation from condition
  const cloudCover = condition === 'sunny' ? 5 
    : condition === 'partly_cloudy' ? 25 
    : condition === 'cloudy' ? 75 
    : condition === 'fog' ? 100 
    : 50;
  
  // Weighted scoring (0-100 scale)
  let score = 0;
  
  // Temperature (50 points) - feels-like temp
  if (feelsLike >= 24) score += 50;
  else if (feelsLike >= 20) score += 40;
  else if (feelsLike >= 16) score += 30;
  else if (feelsLike >= 13) score += 20;
  else score += 10;
  
  // Cloud cover (20 points)
  const cloudScore = Math.round(20 * (1 - cloudCover / 100));
  score += cloudScore;
  
  // Wind speed (20 points)
  if (windSpeed <= 2.5) score += 20;
  else if (windSpeed <= 5.0) score += 15;
  else if (windSpeed <= 7.0) score += 10;
  else if (windSpeed <= 9.8) score += 5;
  
  // Rain probability (10 points)
  if (precipProb <= 10) score += 10;
  else if (precipProb <= 30) score += 7;
  else if (precipProb <= 50) score += 4;
  else if (precipProb <= 70) score += 2;
  
  // Assign tier based on score
  let tier: string;
  if (score >= 85) tier = 'premium';
  else if (score >= 65) tier = 'viable';
  else if (score >= 45) tier = 'marginal';
  else tier = 'unviable';
  
  return { tier, score };
}

/**
 * Check if weather has changed substantially using tier-based assessment.
 * Matches frontend logic: substantial = any day experiences tier category shift.
 */
function hasSignificantWeatherChange(
  newWeather: any,
  oldWeatherSnapshot: any
): boolean {
  if (!oldWeatherSnapshot?.days || !newWeather?.days) return false;
  
  // Compare comfort tiers for each day
  const tierShifts: Array<{ date: string; oldTier: string; newTier: string; oldScore: number; newScore: number }> = [];
  
  for (const newDay of newWeather.days) {
    const oldDay = oldWeatherSnapshot.days.find((d: any) => d.date === newDay.date);
    if (!oldDay) continue;
    
    const oldAssessment = assessComfortTier(oldDay);
    const newAssessment = assessComfortTier(newDay);
    
    // Substantial change = tier category shift
    if (oldAssessment.tier !== newAssessment.tier) {
      tierShifts.push({
        date: newDay.date,
        oldTier: oldAssessment.tier,
        newTier: newAssessment.tier,
        oldScore: oldAssessment.score,
        newScore: newAssessment.score,
      });
    }
  }
  
  if (tierShifts.length > 0) {
    console.log('[Weather Change] Comfort tier shifts detected:', tierShifts);
    return true;
  }
  
  console.log('[Weather Change] No tier shifts - weather changes not substantial');
  return false;
}

/**
 * Check if brand profile has been updated since strategy was generated
 * Returns { isStale: boolean, reason?: string, brand_profile_updated?: string, strategy_generated?: string }
 */
function checkStrategyFreshness(
  brandProfileUpdatedAt: string | null,
  strategyGeneratedAt: string | null
): { isStale: boolean; reason?: string; brand_profile_updated?: string; strategy_generated?: string } {
  if (!brandProfileUpdatedAt || !strategyGeneratedAt) {
    return { isStale: false };
  }
  
  const profileTime = new Date(brandProfileUpdatedAt).getTime();
  const strategyTime = new Date(strategyGeneratedAt).getTime();
  
  // Strategy is stale if brand profile updated after strategy generation
  if (profileTime > strategyTime) {
    const minutesStale = Math.floor((profileTime - strategyTime) / 1000 / 60);
    return {
      isStale: true,
      reason: `Brand profile updated ${minutesStale} minutes after strategy generation`,
      brand_profile_updated: brandProfileUpdatedAt,
      strategy_generated: strategyGeneratedAt,
    };
  }
  
  return { isStale: false };
}

/**
 * Map cta_mode from strategic brief to cta_intent for post_ideas
 */
function ctaModeToIntent(
  ctaMode: string,
  goalMode: string
): 'booking' | 'traffic' | 'engagement' | 'awareness' {
  if (ctaMode === 'booking') return 'booking';
  if (ctaMode === 'walk_in') return 'traffic';
  if (ctaMode === 'engagement') return 'engagement';
  if (goalMode === 'retain_loyalty') return 'awareness';
  return 'traffic'; // safe default
}

/**
 * Rebuild week summary sentence from actual slot counts
 */
function rebuildWeekSummarySentence(angles: any[]): string {
  const counts = { booking: 0, walk_in: 0, build_brand: 0, retain_loyalty: 0 };
  for (const a of angles) {
    if (a.cta_mode === 'booking') counts.booking++;
    else if (a.goal_mode === 'drive_footfall') counts.walk_in++;
    else if (a.goal_mode === 'build_brand') counts.build_brand++;
    else if (a.goal_mode === 'retain_loyalty') counts.retain_loyalty++;
  }
  const parts: string[] = [];
  if (counts.booking > 0)
    parts.push(`${counts.booking} opslag driver bookinger`);
  if (counts.walk_in > 0)
    parts.push(`${counts.walk_in} opslag driver besøg`);
  if (counts.build_brand > 0)
    parts.push(`${counts.build_brand} opslag styrker brand`);
  if (counts.retain_loyalty > 0)
    parts.push(`${counts.retain_loyalty} opslag plejer stamgæster`);
  return parts.length > 0 ? `Denne uge: ${parts.join(', ')}.` : '';
}

const DAY_NAME_TO_DOW: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4,
  Friday: 5, Saturday: 6, Sunday: 0,
};

/**
 * Returns the first available_day that matches the target DOW(s).
 * For booking CTAs, shifts back by bookingNudgeLeadDays so the post
 * appears before the intended visit day.
 * Falls back to the first available day if no match found.
 */
function resolvePostDate(
  targetDays: string[],         // e.g. ["Friday", "Saturday"]
  availableDays: string[],      // ISO dates for the week (open-hours filtered)
  ctaMode: string,
  bookingNudgeLeadDays: number, // weekContext.cta_rules?.booking_nudge_lead_days ?? 2
): string {
  const targetDows = targetDays
    .map(d => DAY_NAME_TO_DOW[d])
    .filter(d => d !== undefined);

  const effectiveDows =
    ctaMode === 'booking' && bookingNudgeLeadDays > 0
      ? targetDows.map(dow => ((dow - bookingNudgeLeadDays) + 7) % 7)
      : targetDows;

  const match = availableDays.find(dateStr => {
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    return effectiveDows.includes(dow);
  });

  return match ?? availableDays[0];
}

serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')
        }
      }
    });
    // Development mode: Skip auth if SKIP_AUTH=true
    const skipAuth = Deno.env.get('SKIP_AUTH') === 'true';
    // Authenticate user (unless in dev mode)
    let user = null;
    if (!skipAuth) {
      const { data: { user: authUser }, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !authUser) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 401
        });
      }
      user = authUser;
    }
    // ALWAYS use service role client for data operations
    // This function needs full access to business data for AI generation
    // User authentication is verified above, but RLS would block necessary queries
    const dataClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Parse request body
    const body = await req.json();
    if (!body.business_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'business_id is required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    console.log('[get-weekly-strategy] Querying business:', {
      business_id: body.business_id,
      skip_auth: skipAuth
    });
    // Verify business exists and user has access (RLS enforced unless skipAuth)
    const { data: business, error: businessError } = await dataClient.from('businesses').select('id, owner_id').eq('id', body.business_id).single();
    console.log('[get-weekly-strategy] Business query result:', {
      found: !!business,
      error: businessError?.message,
      business_id: business?.id
    });
    if (businessError || !business) {
      console.error('[get-weekly-strategy] Business lookup error:', businessError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Business not found or access denied'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 404
      });
    }
    // Verify ownership (unless in dev mode)
    if (!skipAuth && business.owner_id !== user.id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Access denied to this business'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 403
      });
    }
    // Get business basic info for type detection
    const { data: businessData, error: businessDataError } = await dataClient.from('businesses').select('name, category, ai_generations_today').eq('id', body.business_id).single();
    if (businessDataError) {
      console.error('[get-weekly-strategy] Error fetching business:', businessDataError);
    }
    // Derive business type from category (used for framework selection)
    const businessType = businessData?.category || 'restaurant';
    // Helper: format a Date as local YYYY-MM-DD without UTC shift
    const toLocalISO = (d)=>{
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    // Calculate week dates (parse YYYY-MM-DD as LOCAL date to avoid UTC-midnight shift)
    let weekStartDate;
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
    const allWeekDays = [];
    for(let i = 0; i < 7; i++){
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
      regenerate: body.regenerate || false
    });
    // STEP 1: FETCH REAL BUSINESS DATA
    console.log('[get-weekly-strategy] Fetching real business data...');
    console.log('[get-weekly-strategy] Business context:', {
      businessData,
      hasName: !!businessData?.name,
      name: businessData?.name,
      category: businessData?.category,
      businessType
    });
    
    // Fetch location first to determine language filter
    const { data: locationData } = await dataClient
      .from('business_locations')
      .select('city, country')
      .eq('business_id', body.business_id)
      .eq('is_primary', true)
      .single();
    
    const expectedLanguage = countryToLanguageCode(locationData?.country);
    console.log('[get-weekly-strategy] Language filter:', { country: locationData?.country, expectedLanguage });
    
    // Fetch all other business data in parallel (STEP 1)
    const [{ data: locationIntel }, { data: operations, error: operationsError }, { data: openingHours }, { data: brandProfile, error: brandProfileError }, { data: businessProfileSignal }, { data: menuItemsNormalized }, { data: menuItems }, { data: businessProgrammes }, { data: profileData }, { data: businessTier, error: businessTierError }] = await Promise.all([
      dataClient.from('business_location_intelligence').select('neighborhood, area_type, category_scores, demographic_proximity, location_marketing_hooks, latitude, longitude, local_location_reference').eq('business_id', body.business_id).single(),
      dataClient.from('business_operations').select('has_outdoor_seating, establishment_type, reservation_required, accepts_walk_ins, enabled_menu_languages, kitchen_close_time, has_takeaway, has_table_service').eq('business_id', body.business_id).maybeSingle(),
      dataClient.from('opening_hours').select('weekday, open_time, close_time').eq('business_id', body.business_id).eq('kind', 'normal'),
      dataClient.from('business_brand_profile').select(`
          business_character,
          business_archetype,
          revenue_drivers,
          target_type_mix,
          brand_profile_v5,
          brand_essence,
          gastronomic_profile,
          posting_strategy,
          busy_pattern,
          voice_guardrails,
          business_identity_persona,
          marketing_manager_brief,
          content_strategy,
          recognizable_interior_identity,
          things_to_avoid,
          content_focus,
          core_offerings,
          tone_model,
          tone_of_voice,
          enhanced_social_examples,
          enhanced_avoid_examples,
          updated_at
        `).eq('business_id', body.business_id).maybeSingle(),
      dataClient.from('business_profile').select('menu_signal, booking_url').eq('business_id', body.business_id).maybeSingle(),
      dataClient.from('menu_items_normalized').select('id, item_name, item_description, category_name, menu_language, service_periods, service_period_name, menu_result_id').eq('business_id', body.business_id).eq('menu_language', expectedLanguage),
      dataClient.from('menu_results_v2').select('id, language_code, structured_data, service_periods, is_signature, ai_summary, source_url, service_period_name').eq('business_id', body.business_id).eq('status', 'done').limit(20),
      dataClient.from('business_programme_profiles').select('programme_type, programme_name, time_windows, operating_days, is_active, decision_timing, accepts_reservations, baseline_goal_split, audience_segments').eq('business_id', body.business_id).eq('is_active', true),
      dataClient.from('profiles').select('selected_platforms').eq('id', skipAuth ? business.owner_id : user.id).single(),
      Promise.resolve({
        data: null,
        error: null
      })
    ]);
    // Derive structured location intelligence from category_scores
    // Uses the same buildLocationIntelligence() as brand-profile-generator
    const derivedLocationIntel = buildLocationIntelligence(locationIntel);
    
    console.log('[get-weekly-strategy] Location intelligence:', derivedLocationIntel ? {
      primary_type: derivedLocationIntel.primary_type,
      motivations: derivedLocationIntel.matched_motivations,
      tourist: derivedLocationIntel.tourist_context
    } : 'none (no category_scores)');
    if (brandProfileError && brandProfileError.code !== 'PGRST116') {

      console.warn('[get-weekly-strategy] Brand profile fetch error:', brandProfileError);
    }
    
    // Debug: Check booking data retrieval
    console.log('[get-weekly-strategy] Booking data:', {
      has_business_profile: !!businessProfileSignal,
      booking_url: businessProfileSignal?.booking_url,
      has_operations: !!operations,
      accepts_walk_ins: operations?.accepts_walk_ins,
      reservation_required: operations?.reservation_required
    });
    
    console.log('[get-weekly-strategy] Brand profile:', {
      found: !!brandProfile,
      has_v5: !!brandProfile?.brand_profile_v5,
      has_tone_dna: !!brandProfile?.brand_profile_v5?.voice?.tone_dna,
      has_essence: !!brandProfile?.brand_essence,
      has_revenue_drivers: !!brandProfile?.revenue_drivers
    });
    if (brandProfile?.revenue_drivers) {
      console.log('[Business Rules Engine] Revenue drivers found:', {
        confidence: brandProfile.revenue_drivers.confidence_score,
        analyzed_from: brandProfile.revenue_drivers.analyzed_from,
        primary_service: brandProfile.revenue_drivers.primary_revenue_moment?.service_type
      });
    } else {
      console.log('[Business Rules Engine] No revenue drivers - will use BASE_SLOTS_FALLBACK');
    }
    // Derive active platforms with fallback
    const activePlatforms = (()=>{
      const raw = profileData?.selected_platforms;
      if (Array.isArray(raw) && raw.length > 0) {
        return raw.filter((p)=>p === 'facebook' || p === 'instagram');
      }
      // Fallback: both platforms
      return [
        'facebook',
        'instagram'
      ];
    })();
    // Derive subscription tier with fallback
    const subscriptionTier = businessTier?.subscription_tier === 'pro' ? 'pro' : 'smart';
    // Derive preferred post count with fallback
    const preferredPostsPerWeek = 5; // Default value - preferred_posts_per_week column doesn't exist
    // Resolve actual post count based on tier:
    // Smart: always 4, Pro: use requested count (1–7), default 4
    const resolvedPostCount = subscriptionTier === 'smart' ? 4 : Math.min(Math.max(body.target_post_count || 4, 1), 7);
    console.log('[get-weekly-strategy] Platform & tier context:', {
      platforms: activePlatforms,
      tier: subscriptionTier,
      preferred_posts: preferredPostsPerWeek
    });
    // Generate fallback business name if not set (should rarely happen)
    const businessName = businessData?.name || `${businessData?.category || 'Restaurant'} i ${locationData?.city || 'København'}`;
    console.log('[get-weekly-strategy] Data fetched:', {
      business_name: businessData?.name,
      businessName: businessName,
      city: locationData?.city,
      menu_items_normalized: menuItemsNormalized?.length || 0,
      menu_results_v2: menuItems?.length || 0,
      business_programmes: businessProgrammes?.length || 0,
      has_outdoor: operations?.has_outdoor_seating
    });
    // Build active programme types and names for filtering
    const activeProgrammeTypes = new Set();
    const activeProgrammeNames = new Set();
    if (businessProgrammes && businessProgrammes.length > 0) {
      businessProgrammes.forEach((prog)=>{
        if (prog.programme_type) {
          activeProgrammeTypes.add(prog.programme_type.toLowerCase());
        }
        if (prog.programme_name) {
          activeProgrammeNames.add(prog.programme_name.toLowerCase());
        }
      });
      console.log('[get-weekly-strategy] Active programmes:', {
        types: Array.from(activeProgrammeTypes),
        names: Array.from(activeProgrammeNames)
      });
    }
    // Derive business language from country code (same mapping as generate-weekly-plan)
    // Smart: only local-language menus. Pro: all languages (future: user-configurable).
    const COUNTRY_TO_LANG: Record<string, string> = {
      DK: 'da', NO: 'no', SE: 'sv', FI: 'fi', IS: 'is',
      DE: 'de', FR: 'fr', ES: 'es', IT: 'it', NL: 'nl',
    };
    const businessCountryCode = (() => {
      const COUNTRY_NAME_TO_CODE2: Record<string, string> = {
        'danmark': 'DK', 'denmark': 'DK',
        'norge': 'NO', 'norway': 'NO',
        'sverige': 'SE', 'sweden': 'SE',
        'finland': 'FI', 'island': 'IS', 'iceland': 'IS',
      };
      const raw = locationData?.country || 'DK';
      return COUNTRY_NAME_TO_CODE2[raw.toLowerCase()] ?? raw;
    })();
    const businessLang = COUNTRY_TO_LANG[businessCountryCode] ?? 'da';

    // Build set of menu_result_ids that are in the allowed languages.
    // Smart: local language only. Pro: uses enabled_menu_languages from business_operations.
    // menu_results_v2 rows without a language_code are treated as local (legacy data).
    const allowedLangs: string[] = Array.isArray(operations?.enabled_menu_languages) && operations.enabled_menu_languages.length > 0
      ? operations.enabled_menu_languages as string[]
      : [businessLang];
    const localMenuResultIds = new Set<string>(
      (menuItems ?? [])
        .filter((r: any) => !r.language_code || allowedLangs.includes(r.language_code))
        .map((r: any) => r.id)
        .filter(Boolean)
    );
    console.log(`[get-weekly-strategy] Language filter: allowed=${allowedLangs.join(',')}, local menu_result_ids=${localMenuResultIds.size}/${(menuItems ?? []).length}`);

    // Build unified menu data with cascade: menu_items_normalized → menu_results_v2 → menu_signal
    let menuDataSource = 'none';
    const rawMenuForProcessing = [];
    if (menuItemsNormalized && menuItemsNormalized.length > 0) {
      // Primary source: menu_items_normalized (already cleaned, 100 items)
      // Filter to local-language menus only (Smart tier default; Pro future: all languages)
      menuDataSource = 'menu_items_normalized';
      // Convert to menu_results_v2 compatible format and filter by active programmes
      menuItemsNormalized.forEach((item)=>{
        // Language filter: skip items from foreign-language menus
        // menu_result_id is null for legacy rows → treat as local
        if (item.menu_result_id && localMenuResultIds.size > 0 && !localMenuResultIds.has(item.menu_result_id)) {
          return; // skip English/foreign menu items
        }
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
        const matchesActiveProgramme = !periods || periods.length === 0 || periods.some((period)=>{
          const periodLower = period.toLowerCase();
          return activeProgrammeTypes.has(periodLower) || activeProgrammeNames.has(periodLower);
        });
        if (matchesActiveProgramme) {
          // Convert to menu_results_v2 format for compatibility with existing code
          rawMenuForProcessing.push({
            structured_data: {
              menuStructure: [
                {
                  name: item.service_period_name || 'Main Menu',
                  items: [
                    {
                      id: item.id,  // Preserve UUID for deduplication
                      name: item.item_name,
                      description: item.item_description || '',
                      category: item.category_name || ''
                    }
                  ]
                }
              ]
            },
            service_periods: periods || [],
            service_period_name: item.service_period_name,
            is_signature: false,
            ai_summary: null,
            source_url: null
          });
        }
      });
      console.log(`🍽️  Menu: ${menuItemsNormalized.length} total → ${rawMenuForProcessing.length} available for active programmes (langs: ${allowedLangs.join(',')})`);
    }
    if (rawMenuForProcessing.length === 0 && menuItems && menuItems.length > 0) {
      // Fallback: menu_results_v2 — filter to local language
      const localMenuItems = menuItems.filter((r: any) => !r.language_code || allowedLangs.includes(r.language_code));
      menuDataSource = 'menu_results_v2';
      rawMenuForProcessing.push(...localMenuItems);
      console.log(`⚠️  No menu_items_normalized found, using menu_results_v2 (langs: ${allowedLangs.join(',')}): ${localMenuItems.length}/${menuItems.length} items`);
    }
    console.log('[get-weekly-strategy] Menu data source:', menuDataSource, `(${rawMenuForProcessing.length} items)`);
    // ===== PHASE B: TYPE ANALYTICS (LOGGING + DATA COLLECTION) =====
    // Calculate content type staleness and drift for variety optimization
    // Store analytics for Phase C allocation
    let typeAnalyticsData = null;
    let targetTypeMix = {
      ...DEFAULT_TYPE_MIX
    };
    console.log('[PHASE B] Starting content type analytics...');
    try {
      console.log('[PHASE B] Checking brand profile for target_type_mix:', {
        has_brand_profile: !!brandProfile,
        has_target_type_mix: !!brandProfile?.target_type_mix,
        target_type_mix: brandProfile?.target_type_mix
      });
      // Get target type mix from brand profile, or use defaults
      targetTypeMix = brandProfile?.target_type_mix ? {
        product: brandProfile.target_type_mix.product ?? DEFAULT_TYPE_MIX.product,
        experience: brandProfile.target_type_mix.experience ?? DEFAULT_TYPE_MIX.experience,
        occasion: brandProfile.target_type_mix.occasion ?? DEFAULT_TYPE_MIX.occasion,
        retention: brandProfile.target_type_mix.retention ?? DEFAULT_TYPE_MIX.retention
      } : {
        ...DEFAULT_TYPE_MIX
      };
      console.log('[PHASE B] Using target type mix:', targetTypeMix);
      console.log('[PHASE B] Calling getTypeAnalytics...');
      typeAnalyticsData = await getTypeAnalytics(dataClient, body.business_id, targetTypeMix);
      console.log('[PHASE B] Analytics received:', {
        staleness_count: typeAnalyticsData.staleness.length,
        drift_count: typeAnalyticsData.drift.length
      });
      console.log('\n📊 [PHASE B] CONTENT TYPE ANALYTICS:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Staleness (what types haven\'t been used recently):');
      typeAnalyticsData.staleness.forEach((s)=>{
        console.log(`  ${s.type}: ${s.days_since === null ? 'NEVER USED' : s.days_since + ' days ago'} (priority: ${s.staleness_priority})`);
      });
      console.log('\nDrift (actual vs target distribution):');
      typeAnalyticsData.drift.forEach((d)=>{
        console.log(`  ${d.type}: ${d.actual_pct} actual vs ${d.target_pct} target (drift: ${d.drift_pct}, correction: ${d.correction_multiplier}x)`);
      });
      console.log('\nRecommendations:');
      console.log(`  → Most stale type: ${typeAnalyticsData.summary.most_stale}`);
      console.log(`  → Most underrepresented: ${typeAnalyticsData.summary.most_underrepresented}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('[PHASE B] Analytics complete. Data stored for Phase C allocation.');
    } catch (typeError) {
      console.error('[PHASE B] Type analytics FAILED:', {
        error: typeError,
        message: typeError?.message,
        stack: typeError?.stack
      });
    // Continue without type analytics (Phase C will handle missing data)
    }
    // ===== END PHASE B =====
    // Build programme goal split map for Phase C weighted allocation
    const programmeGoalSplits: Record<string, any> = {};
    if (businessProgrammes && businessProgrammes.length > 0) {
      businessProgrammes.forEach((prog)=>{
        if (prog.programme_type && prog.baseline_goal_split) {
          // Store FULL goal_split object (not just dominant mode)
          programmeGoalSplits[prog.programme_type] = prog.baseline_goal_split;
          // Also map programme name if it exists
          if (prog.programme_name) {
            programmeGoalSplits[prog.programme_name.toLowerCase()] = prog.baseline_goal_split;
          }
        }
      });
      // Build an 'all_day' fallback: weighted average across all active programmes.
      // Posts not mapped to a specific meal period (atmosphere, team, loyalty, events)
      // still receive full goal-split weighting instead of collapsing to a single mode.
      const splitsWithData = businessProgrammes.filter((p) => p.baseline_goal_split);
      if (splitsWithData.length > 0) {
        const count = splitsWithData.length;
        programmeGoalSplits['all_day'] = {
          drive_footfall: Math.round(splitsWithData.reduce((sum, p) => sum + (p.baseline_goal_split.drive_footfall || 0), 0) / count),
          strengthen_brand: Math.round(splitsWithData.reduce((sum, p) => sum + (p.baseline_goal_split.strengthen_brand || 0), 0) / count),
          retain_regulars: Math.round(splitsWithData.reduce((sum, p) => sum + (p.baseline_goal_split.retain_regulars || 0), 0) / count),
        };
        console.log('[Phase C Setup] all_day fallback split:', JSON.stringify(programmeGoalSplits['all_day']));
      }
      console.log('[Phase C Setup] Programme goal splits loaded:', Object.keys(programmeGoalSplits).join(', '));
    }
    // DYNAMIC: Map generic service_period names to business's actual programme types
    // This ensures "lunch" maps to "FROKOST" if that's the actual programme name
    const servicePeriodMap: Record<string, string> = {};
    
    if (businessProgrammes && businessProgrammes.length > 0) {
      businessProgrammes.forEach((prog) => {
        const progType = prog.programme_type;
        const timeWindows = prog.time_windows || [];
        
        // Parse time windows to determine which generic periods this programme covers
        timeWindows.forEach((window: string) => {
          const [start, end] = window.split('-');
          if (!start || !end) return;
          
          const [startH, startM] = start.split(':').map(Number);
          const [endH, endM] = end.split(':').map(Number);
          const startMin = startH * 60 + (startM || 0);
          const endMin = endH * 60 + (endM || 0);
          
          // Map based on time overlap:
          // Breakfast/Brunch: 07:00-11:00 (420-660 min)
          // Lunch: 11:00-16:00 (660-960 min)
          // Dinner: 17:00-23:00 (1020-1380 min)
          
          if (startMin <= 660 && endMin >= 420) {
            // Overlaps breakfast/brunch hours
            servicePeriodMap['breakfast'] = progType;
            servicePeriodMap['brunch'] = progType;
          }
          
          if (startMin <= 960 && endMin >= 660) {
            // Overlaps lunch hours
            servicePeriodMap['lunch'] = progType;
          }
          
          if (startMin <= 1380 && endMin >= 1020) {
            // Overlaps dinner hours
            servicePeriodMap['dinner'] = progType;
          }
        });
      });
    }
    
    // Fallback: if no mappings were created, use generic names
    if (Object.keys(servicePeriodMap).length === 0) {
      servicePeriodMap['brunch'] = 'brunch';
      servicePeriodMap['lunch'] = 'lunch';
      servicePeriodMap['dinner'] = 'dinner';
      servicePeriodMap['breakfast'] = 'brunch';
    }
    
    console.log('[get-weekly-strategy] Service period mapping:', servicePeriodMap);
    // Filter available days by opening hours (critical: don't suggest posts on closed days)
    const weekdayMap = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday'
    ];
    const openDays = new Set();
    if (openingHours && openingHours.length > 0) {
      // All rows in opening_hours represent open days (closed days have no row)
      openingHours.forEach((h)=>{
        openDays.add(h.weekday.toLowerCase());
      });
    } else {
      // If no opening hours configured, assume all days open (fallback)
      weekdayMap.forEach((day)=>openDays.add(day));
    }
    // Filter availableDays: only include days when business is open
    const availableDays = allWeekDays.filter((dateStr)=>{
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
    const openTimeByWeekday = {};
    if (openingHours && openingHours.length > 0) {
      openingHours.forEach((h)=>{
        openTimeByWeekday[h.weekday.toLowerCase()] = h.open_time ?? null;
      });
    }
    const dailyOpenTime = {};
    allWeekDays.forEach((dateStr)=>{
      const date = new Date(dateStr);
      const weekday = weekdayMap[date.getDay()];
      dailyOpenTime[dateStr] = openTimeByWeekday[weekday] ?? null;
    });
    // Build ISO date → close_time map for the week.
    // Phase 2b uses this to avoid scheduling posts after the business has closed.
    const closeTimeByWeekday = {};
    if (openingHours && openingHours.length > 0) {
      openingHours.forEach((h)=>{
        closeTimeByWeekday[h.weekday.toLowerCase()] = h.close_time ?? null;
      });
    }
    const dailyCloseTime = {};
    allWeekDays.forEach((dateStr)=>{
      const date = new Date(dateStr);
      const weekday = weekdayMap[date.getDay()];
      dailyCloseTime[dateStr] = closeTimeByWeekday[weekday] ?? null;
    });
    console.log('[get-weekly-strategy] Daily open times:', dailyOpenTime);

    // Build a human-readable opening hours summary for Phase 1 prompt injection.
    // Groups consecutive weekdays with the same open+close into "Man-Ons HH:MM–HH:MM".
    const openingHoursSummary: string = (() => {
      if (!openingHours || openingHours.length === 0) return '';
      const dayOrder = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      const dayAbbr: Record<string, string> = {
        monday:'Man', tuesday:'Tir', wednesday:'Ons',
        thursday:'Tor', friday:'Fre', saturday:'Lør', sunday:'Søn'
      };
      const fmt = (t: string) => t ? t.replace(/:\d\d$/, '') : ''; // strip seconds
      // Sort rows by weekday order (all rows are open days - closed days have no row)
      const sorted = [...(openingHours as any[])]
        .sort((a, b) => dayOrder.indexOf(a.weekday) - dayOrder.indexOf(b.weekday));
      if (sorted.length === 0) return '';
      // Group consecutive days with identical open+close
      const groups: { days: string[]; open: string; close: string }[] = [];
      for (const h of sorted) {
        const o = fmt(h.open_time || '');
        const c = fmt(h.close_time || '');
        const last = groups[groups.length - 1];
        if (last && last.open === o && last.close === c) {
          last.days.push(h.weekday);
        } else {
          groups.push({ days: [h.weekday], open: o, close: c });
        }
      }
      const parts = groups.map(g => {
        const abbrs = g.days.map(d => dayAbbr[d]);
        const label = abbrs.length === 1 ? abbrs[0] : `${abbrs[0]}-${abbrs[abbrs.length - 1]}`;
        return `${label} ${g.open}–${g.close}`;
      });
      const kitchenClose = (operations as any)?.kitchen_close_time;
      if (kitchenClose) parts.push(`køkken lukker ${fmt(kitchenClose)}`);
      return parts.join(', ');
    })();
    // Both are collected in a single pass so ai_summary is never siloed.
    const signatureItems = [];
    const allMenuItems = [];
    const aiSummaryItems = []; // fallback lines derived from ai_summary text
    const allIngredients = new Set();
    const detectedServicePeriods = new Set();
    const menuSummaries = [];
    if (rawMenuForProcessing && rawMenuForProcessing.length > 0) {
      for (const item of rawMenuForProcessing){
        // Collect service periods
        if (item.service_periods) {
          item.service_periods.forEach((period)=>detectedServicePeriods.add(period));
        }
        // PRIMARY: ai_summary — build Phase 0 helicopter entries AND extract fallback names
        if (item.ai_summary) {
          const urlSegments = (item.source_url || '').split('/').filter(Boolean);
          const urlTitle = urlSegments[urlSegments.length - 1]?.replace(/-/g, ' ')?.replace(/\.(html|htm|php|aspx)$/i, '')?.toUpperCase() || 'MENU';
          const title = item.service_period_name?.toUpperCase() || urlTitle;
          menuSummaries.push({
            title,
            source_url: item.source_url || '',
            summary: item.ai_summary
          });
          // Extract readable lines from summary as fallback dish names
          // (strip leading bullet/dash chars, keep non-empty lines)
          const lines = item.ai_summary.split('\n').map((l)=>l.replace(/^[\s•\-–*]+/, '').trim()).filter((l)=>l.length > 3);
          aiSummaryItems.push(...lines);
        }
        // SECONDARY: structured_data — explicit signature items + ingredients
        const categories = item.structured_data?.menuStructure || item.structured_data?.categories;
        if (categories) {
          // Category-level blocklist: entire categories that are never suitable for social posts
          const BLOCKED_CATEGORY_PATTERNS = [
            /børnemenu/i,
            /børn/i,
            /kids/i,
            /drikkevarer/i,
            /drinks/i,
            /tilvalg/i,
            /ekstra/i,
            /snacks/i
          ];
          // Dish-level blocklist: individual items that are supplements, surcharges, or price bundles
          const BLOCKED_DISH_PATTERNS = [
            /^ekstra\s/i,
            /^hertil\s/i,
            /^kan\s/i,
            /ad\s+lib[ui]t/i,
            /drikkevarer/i,
            /vinmenu/i,
            /^glutenfri\s+pasta$/i,
            /^bacon$/i
          ];
          for (const category of categories){
            const categoryName = category.name || category.title || '';
            // Skip blocked categories entirely
            if (BLOCKED_CATEGORY_PATTERNS.some((rx)=>rx.test(categoryName))) continue;
            const dishes = category.items || category.dishes || [];
            for (const dish of dishes){
              const dishName = dish.name || dish.title;
              if (dishName) {
                // Skip blocked dish name patterns (add-ons, surcharges, admin lines)
                if (BLOCKED_DISH_PATTERNS.some((rx)=>rx.test(dishName.trim()))) continue;
                // Skip pure price-supplement entries: no description AND price < 50 DKK
                const dishPrice = parseFloat(dish.price || '9999');
                if (!dish.description && dishPrice < 50) continue;
                const menuEntry = {
                  id: dish.id || undefined,  // UUID from menu_items_normalized
                  name: dishName,
                  description: dish.description || dish.short_desc || undefined,
                  category: categoryName || undefined,
                  price: dish.price || undefined,
                  isSignature: !!(item.is_signature || dish.isSignature),
                  // Carry the parent menu row's service_periods so Phase 2b can filter by slot time
                  service_periods: Array.isArray(item.service_periods) ? item.service_periods : []
                };
                allMenuItems.push(menuEntry);
                if (item.is_signature || dish.isSignature) {
                  signatureItems.push(menuEntry);
                }
              }
              const ingredients = dish.ingredients || dish.description?.match(/\b(kylling|laks|bøf|tomat|citron|broccoli|pasta|ris)\b/gi) || [];
              if (ingredients) {
                ingredients.forEach((ing)=>allIngredients.add(ing.toLowerCase()));
              }
            }
          }
        }
      }
    }
    // Priority: explicit signature → all parsed items → ai_summary lines (as name-only entries)
    // No longer capping at 5 — all dishes flow through so Phase 2b and the caption generator
    // have the full menu to rotate across (deduplication happens per-week in Phase 2b).
    const aiSummaryFallback = aiSummaryItems.slice(0, 8).map((line)=>({
        name: line
      }));
    const finalSignatureItems = allMenuItems.length > 0 ? allMenuItems : aiSummaryFallback.length > 0 ? aiSummaryFallback : [];
    console.log('[get-weekly-strategy] Menu extraction:', {
      structured_items: allMenuItems.length,
      explicit_signature: signatureItems.length,
      items_with_descriptions: allMenuItems.filter((i)=>!!i.description).length,
      ai_summary_lines: aiSummaryItems.length,
      summaries_available: menuSummaries.length,
      final_source: allMenuItems.length > 0 ? 'structured_data' : aiSummaryItems.length > 0 ? 'ai_summary' : 'none',
      final_items_count: finalSignatureItems.length
    });
    console.log('[get-weekly-strategy] Menu summaries available:', menuSummaries.length);
    let locationType = 'city_center'; // default
    let locationCategories = null;
    // Max menu price for student audience price-gate (same logic as Brand Profile)
    const _maxMenuPrice = allMenuItems.length > 0 ? allMenuItems.map((m)=>parseFloat(m.price || '')).filter((p)=>!isNaN(p) && p > 0).sort((a, b)=>b - a)[0] ?? null : null;
    if (locationIntel?.category_scores || locationIntel?.demographic_proximity) {
      // SCHEMA V2: demographic_proximity = WHO, category_scores = WHERE
      const categoryScores = locationIntel.category_scores ?? {};
      const demographicProximity = locationIntel.demographic_proximity ?? {};
      const sorted = Object.entries(categoryScores).sort(([, a], [, b])=>b - a);
      // Primary type: top category if score > 50 (backward compat)
      if (sorted[0] && sorted[0][1] > 50) {
        locationType = sorted[0][0];
      }
      // Permitted audience types via shared filter (price-gated, same logic as Brand Profile)
      const { permittedKeys: _permittedKeys } = filterAudienceLabels(demographicProximity, _maxMenuPrice, categoryScores);
      if (_permittedKeys.length > 0) {
        locationCategories = _permittedKeys.slice(0, 4).map((type)=>({
            type,
            score: (categoryScores[type] ?? demographicProximity[type]) ?? 0
          }));
      }
    }
    // STEP 2: CALCULATE ECONOMIC TIMING (pure date logic)
    const economicTiming = calculateEconomicTiming(weekStartDate);
    console.log('[get-weekly-strategy] Economic timing:', economicTiming);
    // STEP 3: FETCH REAL EVENTS FROM CONTEXTUAL CALENDAR
    console.log('[get-weekly-strategy] Fetching contextual events...');
    // Normalize country name → ISO-2 code (business_locations stores full names)
    const COUNTRY_NAME_TO_CODE = {
      'danmark': 'DK',
      'denmark': 'DK',
      'norge': 'NO',
      'norway': 'NO',
      'sverige': 'SE',
      'sweden': 'SE',
      'finland': 'FI',
      'island': 'IS',
      'iceland': 'IS'
    };
    const rawCountry = locationData?.country || 'DK';
    const country = COUNTRY_NAME_TO_CODE[rawCountry.toLowerCase()] ?? rawCountry;
    const weekStartISO = toLocalISO(weekStartDate);
    // Fetch 2 weeks ahead to catch lead-up events (e.g., Valentine's needing 3-5 day prep)
    const twoWeeksAhead = new Date(weekStartDate);
    twoWeeksAhead.setDate(twoWeeksAhead.getDate() + 14);
    const twoWeeksISO = twoWeeksAhead.toISOString().split('T')[0];
    console.log('[get-weekly-strategy] Events query params:', {
      country,
      weekStartISO,
      twoWeeksISO
    });
    const { data: eventsData, error: eventsError } = await dataClient.from('contextual_calendar').select('event_type, event_name, date_start, date_end, relevance_tags, content_angle, marketing_hook, commercial_weight, lead_days').eq('country', country).gte('date_start', weekStartISO).lte('date_start', twoWeeksISO).order('commercial_weight', {
      ascending: false
    }).order('date_start', {
      ascending: true
    });
    if (eventsError) {
      console.error('[get-weekly-strategy] Events fetch error:', JSON.stringify(eventsError));
    }
    // Map to UpcomingEvent[] format
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEndISO = toLocalISO(weekEndDate);
    const upcomingEvents = (eventsData || []).map((e)=>{
      const eventDate = new Date(e.date_start);
      eventDate.setHours(0, 0, 0, 0);
      const daysAway = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        name: e.event_name,
        name_dk: e.event_name,
        date: e.date_start,
        date_end: e.date_end ?? null,
        days_away: daysAway,
        // True when the event falls within this week's date range (Mon–Sun).
        // False = lookahead context only — must not be treated as "this week".
        in_week: e.date_start >= weekStartISO && e.date_start <= weekEndISO,
        type: e.event_type,
        strategic_angle: e.content_angle || '',
        recommended_lead_days: 3,
        marketing_hook: e.marketing_hook ?? undefined,
        commercial_weight: e.commercial_weight ?? null
      };
    }).filter((e)=>e.days_away >= 0); // Exclude past events
    console.log('[get-weekly-strategy] Events fetched:', {
      total: eventsData?.length || 0,
      upcoming: upcomingEvents.length,
      events: upcomingEvents.map((e)=>`${e.name} (${e.days_away}d away)`)
    });
    // STEP 4: FETCH REAL WEATHER FROM OPENWEATHERMAP (with fallback)
    console.log('[get-weekly-strategy] Fetching weather forecast...');
    let weekWeather;
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
          avg_temp: weekWeather.avg_temp
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
    // Calculate week end for scheduled posts query
    const queryWeekEnd = new Date(weekStartDate);
    queryWeekEnd.setDate(queryWeekEnd.getDate() + 6);
    const queryWeekEndISO = toLocalISO(queryWeekEnd);
    const [{ data: recentPlans }, pastStrategiesResult, { data: publishedPosts }, { data: scheduledPosts }] = await Promise.all([
      supabaseClient.from('weekly_content_plans').select('posts, generated_at') // 'posts' is the actual save column (was incorrectly 'post_ideas')
      .eq('business_id', body.business_id).gte('generated_at', fourteenDaysAgoISO) // Only plans from last 14 days
      .order('generated_at', {
        ascending: false
      }).limit(2),
      supabaseClient.from('weekly_strategies').select('post_ideas, selected_idea_ids, strategy_rationale, narrative, strategic_brief, week_start, week_number').eq('business_id', body.business_id).lt('week_start', toLocalISO(weekStartDate)).gte('week_start', sixWeeksAgoISO) // Only strategies from last 6 weeks
      .order('week_start', {
        ascending: false
      }).limit(4),
      // Query published posts for menu item deduplication (14 days)
      supabaseClient.from('posts').select('menu_item_name, content_type, posted_at').eq('business_id', body.business_id).gte('posted_at', fourteenDaysAgoISO).order('posted_at', {
        ascending: false
      }),
      // Query scheduled posts for upcoming week (to pass to AI context)
      // NEW: Include menu_item_id for UUID-first matching (replaces fragile caption text extraction)
      supabaseClient.from('posts').select('menu_item_id, menu_item_name, caption, content_type, scheduled_for').eq('business_id', body.business_id).eq('status', 'scheduled').gte('scheduled_for', toLocalISO(weekStartDate)).lte('scheduled_for', queryWeekEndISO).order('scheduled_for', {
        ascending: true
      })
    ]);
    // Aggregate posts from all recent plans (up to 2 weeks)
    const allRecentIdeas = (recentPlans ?? []).flatMap((plan)=>plan.posts || []);
    // Extract menu item names from weekly_content_plans.posts (PostSpecification shape)
    const menuItemsFromPlans = allRecentIdeas.map((p)=>// PostSpecification shape: contentSubject.menuItemName (exact DB name) or contentSubject.dish
      p.contentSubject?.menuItemName || p.contentSubject?.dish || p.menu_item_name).filter(Boolean);
    // Also extract menu items from weekly_strategies.post_ideas (Phase 2b output shape).
    // This provides dedup coverage even when weekly_content_plans hasn't been populated yet
    // (e.g. both weeks generated in the same session before generate-weekly-plan runs).
    // pastStrategiesResult is filtered lt(week_start) so it only covers previous weeks.
    const { data: pastStrategiesForMenuDedup } = pastStrategiesResult;
    const menuItemsFromStrategies = (pastStrategiesForMenuDedup ?? []).slice(0, 2) // Only the 2 most recent past weeks
    .flatMap((s)=>s.post_ideas || []).map((idea)=>idea.menu_item_used).filter(Boolean);
    // Extract menu items from posts (what's actually been posted via Quick Suggestions or manual)
    // NEW: Use menu_item_id when available for more reliable tracking
    const menuItemsFromPublished = (publishedPosts ?? [])
      .map((p)=> p.menu_item_id || p.menu_item_name)
      .filter(Boolean);
    
    // Extract menu items from scheduled posts (what's queued to post)
    // NEW: UUID-first approach - use menu_item_id when available, fall back to menu_item_name or caption extraction
    const menuItemsFromScheduled = (scheduledPosts ?? [])
      .map((p)=> {
        // Prefer UUID (most reliable)
        if (p.menu_item_id) return p.menu_item_id;
        // Fall back to menu_item_name field
        if (p.menu_item_name) return p.menu_item_name;
        // Last resort: caption text extraction for legacy posts
        if (!p.caption) return null;
        const match = p.caption.match(/^(?:Vores |Prøv vores |Smag |)([A-ZÆØÅ][^\n.!?]{3,50})/);
        return match ? match[1].trim() : null;
      })
      .filter(Boolean);
    const previousWeek = {
      data_available: false,
      posted_menu_items: [
        ...new Set([
          ...menuItemsFromPlans,
          ...menuItemsFromStrategies,
          ...menuItemsFromPublished,
          ...menuItemsFromScheduled
        ])
      ],
      posted_content_types: allRecentIdeas.map((p)=>p.postType?.type || p.postType?.category || p.content_type).filter(Boolean),
      top_post: undefined,
      selection_patterns: undefined,
      scheduled_posts_this_week: (scheduledPosts ?? []).map((p)=> {
          // UUID-first menu item extraction
          let menuItem = null;
          if (p.menu_item_id) menuItem = p.menu_item_id;
          else if (p.menu_item_name) menuItem = p.menu_item_name;
          else if (p.caption) {
            const match = p.caption.match(/^(?:Vores |Prøv vores |Smag |)([A-ZÆØÅ][^\n.!?]{3,50})/);
            menuItem = match ? match[1].trim() : null;
          }
          return {
            date: p.suggested_post_time || p.scheduled_for,
            menu_item: menuItem,
            content_type: p.content_type
          };
        })
    };
    // STEP 6b: SELECTION PATTERNS — process result from parallel fetch above
    try {
      const { data: pastStrategies } = pastStrategiesResult;
      if (pastStrategies && pastStrategies.length > 0) {
        const goalModeTally = {};
        const categoryTally = {};
        let totalSelected = 0;
        for (const plan of pastStrategies){
          const ideas = plan.post_ideas || [];
          const selectedIds = new Set(plan.selected_idea_ids || []);
          if (selectedIds.size === 0) continue;
          for (const idea of ideas){
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
        if (totalSelected >= 3) {
          const goalModeRates = {};
          for (const [mode, count] of Object.entries(goalModeTally)){
            goalModeRates[mode] = Math.round(count / totalSelected * 100) / 100;
          }
          const preferredGoalMode = Object.entries(goalModeTally).sort((a, b)=>b[1] - a[1])[0]?.[0] ?? null;
          const preferredCategory = Object.entries(categoryTally).sort((a, b)=>b[1] - a[1])[0]?.[0] ?? null;
          previousWeek.selection_patterns = {
            weeks_analyzed: pastStrategies.length,
            goal_mode_rates: goalModeRates,
            preferred_goal_mode: preferredGoalMode,
            preferred_category: preferredCategory
          };
          console.log('[get-weekly-strategy] Selection patterns:', previousWeek.selection_patterns);
        }
        // STEP 6b-ii: PREVIOUS ANGLE FOCUSES — extract Phase 1 focus labels from last 2 weeks
        // so Phase 1 can softly avoid repeating the same strategic theme.
        const previousAngleFocuses = [];
        for (const s of pastStrategies.slice(0, 2)){
          const brief = s.strategic_brief;
          if (brief && Array.isArray(brief.angles)) {
            for (const a of brief.angles){
              if (a.focus && !previousAngleFocuses.includes(a.focus)) {
                previousAngleFocuses.push(a.focus);
              }
            }
          }
        }
        if (previousAngleFocuses.length > 0) {
          previousWeek.previous_angle_focuses = previousAngleFocuses;
          console.log('[get-weekly-strategy] Previous angle focuses:', previousAngleFocuses);
        }
        // STEP 6b-iii: FLEXIBLE SLOT DOWS — extract DOW of Slot D posts from last 2 weeks
        // so Phase 2a can prefer fresh days for the flexible slot.
        const previousFlexibleDows = [];
        for (const s of pastStrategies.slice(0, 2)){
          const ideas = s.post_ideas || [];
          for (const idea of ideas){
            if (idea.slot_id === 'D' && idea.suggested_day) {
              const dow = new Date(idea.suggested_day + 'T00:00:00').getDay();
              if (!previousFlexibleDows.includes(dow)) previousFlexibleDows.push(dow);
            }
          }
        }
        if (previousFlexibleDows.length > 0) {
          previousWeek.previous_flexible_dows = previousFlexibleDows;
          console.log('[get-weekly-strategy] Previous flexible DOWs:', previousFlexibleDows);
        }
        // STEP 6b-iv: PREVIOUS SLOT CONTENT TYPES — extract slot_id → content_category from
        // the most recent past week so Phase 1 can rotate build_brand / retain_loyalty
        // assignments and avoid an identical structural sequence two weeks in a row.
        const mostRecentStrategy = pastStrategies[0];
        if (mostRecentStrategy) {
          const ideas = mostRecentStrategy.post_ideas || [];
          const prevSlotContentTypes = ideas.filter((idea)=>idea.slot_id && idea.content_category).map((idea)=>({
              slot_id: String(idea.slot_id),
              content_category: String(idea.content_category)
            }));
          if (prevSlotContentTypes.length > 0) {
            previousWeek.previous_slot_content_types = prevSlotContentTypes;
            console.log('[get-weekly-strategy] Previous slot content types:', prevSlotContentTypes);
          }
        }
      }
    } catch (e) {
      console.warn('[get-weekly-strategy] Could not compute selection_patterns:', e.message);
    }
    // STEP 6c: PAST WEEK SUMMARIES — injects last 1–2 week_summary + overview + content_types into previousWeek
    // so Phase 1 and Phase 2c can self-check phrasing AND structural patterns against prior weeks.
    try {
      const { data: pastStratData } = pastStrategiesResult;
      if (pastStratData && pastStratData.length > 0) {
        const summaries = [];
        for (const s of pastStratData.slice(0, 2)){
          const wkSummary = s.strategy_rationale ?? '';
          const narrativeRaw = s.narrative;
          let overview = '';
          if (narrativeRaw && typeof narrativeRaw === 'object') {
            overview = String(narrativeRaw.overview ?? '');
          } else if (typeof narrativeRaw === 'string') {
            try {
              overview = JSON.parse(narrativeRaw)?.overview ?? '';
            } catch  {}
          }
          // Extract content_category of selected ideas so Phase 1 knows last week's structural shape
          const ideas = s.post_ideas || [];
          const selectedIds = new Set(s.selected_idea_ids || []);
          const selectedContentTypes = ideas.filter((idea)=>selectedIds.has(idea.id)).map((idea)=>idea.content_category || idea.category || '').filter(Boolean);
          if (wkSummary || overview) {
            summaries.push({
              week_number: s.week_number ?? 0,
              week_summary: wkSummary,
              overview: overview.replace(/^•\s*/gm, '').trim(),
              selected_content_types: selectedContentTypes
            });
          }
        }
        if (summaries.length > 0) {
          previousWeek.past_week_summaries = summaries;
        }
      }
    } catch (e) {
      console.warn('[get-weekly-strategy] Could not extract past_week_summaries:', e.message);
    }
    console.log('[get-weekly-strategy] Previous week:', {
      has_data: (recentPlans ?? []).length > 0,
      plans_found: (recentPlans ?? []).length,
      posted_items_count: previousWeek.posted_menu_items.length,
      posted_types: previousWeek.posted_content_types
    });
    // Build complete WeekContext with real data
    const weekContext = {
      business_id: body.business_id,
      week_number: weekNumber,
      week_start: toLocalISO(weekStartDate),
      week_end: toLocalISO(weekEndDate),
      available_days: availableDays,
      daily_open_time: dailyOpenTime,
      daily_close_time: dailyCloseTime,
      opening_hours_summary: openingHoursSummary || undefined,
      booking_link: businessProfileSignal?.booking_url ?? null,
      // Booking model — drives CTA type selection in Phase 1 and Phase 2b
      booking_model: {
        reservation_required: operations?.reservation_required ?? false,
        accepts_walk_ins: operations?.accepts_walk_ins ?? true,
        has_booking_link: !!businessProfileSignal?.booking_url,
      },
      // Derived CTA rules — consumed by Phase 1 strategy prompt and Phase 2b slot logic.
      // These translate the raw booking model into explicit AI instructions so the prompt
      // does not have to reason about the three-field matrix itself.
      cta_rules: (()=>{
        const hasLink = !!businessProfileSignal?.booking_url;
        const walkIn = operations?.accepts_walk_ins ?? true;
        const required = operations?.reservation_required ?? false;

        if (required && hasLink) {
          return {
            mode: 'reservation_only',
            instruction:
              'Every post MUST include a booking CTA using brand-specific phrases from the CTA library. ' +
              'Walk-in language ("kom forbi", "kig ind") is NOT permitted as a primary CTA.',
            booking_nudge_capable: true,
            booking_nudge_lead_days: 2,
          };
        }

        if (walkIn && hasLink) {
          return {
            mode: 'mixed',
            instruction:
              'Use walk-in CTA ("kom forbi") for same-day or next-day posts. ' +
              'Use booking CTA (brand-specific phrases from CTA library) for posts targeting a visit 2+ days ahead, ' +
              'especially Thursday/Friday/Saturday evening slots. ' +
              'Never combine both CTAs in a single post.',
            booking_nudge_capable: true,
            booking_nudge_lead_days: 2,
          };
        }

        if (walkIn && !hasLink) {
          return {
            mode: 'walk_in_only',
            instruction:
              'Use walk-in language only ("kom forbi", "kig ind", "tag forbi"). ' +
              'Do NOT reference online booking — no booking link exists.',
            booking_nudge_capable: false,
          };
        }

        // reservation_required but no booking link — edge case, flag it
        return {
          mode: 'reservation_required_no_link',
          instruction:
            'Reservation is required but no booking link is available. ' +
            'Do not promise online booking. Avoid CTA entirely or use "ring og reservér".',
          booking_nudge_capable: false,
        };
      })(),
      is_current_week: body.include_current_week || false,
      // REAL: Business data (Step 1)
      business_name: businessName,
      business_type: businessType,
      // V5.6 (June 23, 2026): SHORT business type reasoning (~20-70 chars)
      business_character: brandProfile?.business_character || undefined,
      // V5.6 (June 23, 2026): LONG strategic marketing guidance (separate from business_character)
      // Replaces the deprecated framework/alias system in Phase 1 & 2 strategy prompts.
      marketing_guidance: (brandProfile as any)?.marketing_manager_brief || (brandProfile as any)?.business_identity_persona || undefined,
      // WP4: Operational programme signals from menu_signal extraction
      menu_programmes: businessProfileSignal?.menu_signal?.programmes ?? null,
      // WP5: Late-night signal derived from opening_hours
      late_night_closing: (()=>{
        if (!openingHours || openingHours.length === 0) return false;
        return openingHours.some((row)=>{
          const h = parseInt((row.close_time || '00:00').split(':')[0], 10);
          return !row.closed && h >= 0 && h < 6;
        });
      })(),
      // Programme profiles with baseline_goal_split for Phase C type allocation
      business_programmes: businessProgrammes || [],
      city: locationData?.city || 'Copenhagen',
      country: locationData?.country || 'DK',
      service_periods: Array.from(detectedServicePeriods),
      // Balance across service periods so no single menu dominates (brunch/lunch/dinner get equal representation).
      // Brunch URL is iterated first in DB order → without balancing, the first-20 slice was all brunch
      // and dinner dishes never made it into the pool, causing the Phase 2b service-period filter to fall back.
      // No per-period cap — all dishes are included. Phase 2b filters to only the relevant period per slot,
      // so passing the full menu is correct and poses no prompt-size risk (each period sees its own subset).
      signature_items: (()=>{
        const byPeriod = new Map();
        for (const item of finalSignatureItems){
          const sp = item.service_periods;
          const key = sp && sp.length > 0 ? sp[0] : 'other';
          if (!byPeriod.has(key)) byPeriod.set(key, []);
          byPeriod.get(key).push(item);
        }
        // Interleave across periods so the list isn't front-loaded with one period
        const balanced = [];
        for (const items of byPeriod.values())balanced.push(...items);
        return balanced;
      })(),
      menu_summaries: menuSummaries.length > 0 ? menuSummaries : undefined,
      seasonal_ingredients: Array.from(allIngredients).slice(0, 15),
      location: {
        type: locationType,
        neighborhood: locationIntel?.neighborhood,
        area_type: locationIntel?.area_type,
        has_outdoor_seating: operations?.has_outdoor_seating || false,
        has_takeaway: operations?.has_takeaway || false,
        has_table_service: operations?.has_table_service || false,
        is_july_tourist_boost: economicTiming.is_july && locationType === 'tourist_area',
        // Enriched from location intelligence: visit motivations, marketing angle, tourist flag
        matched_motivations: derivedLocationIntel?.matched_motivations ?? null,
        marketing_focus: derivedLocationIntel?.marketing_focus ?? null,
        tourist_context: derivedLocationIntel?.tourist_context ?? false,
        location_categories: locationCategories,
        local_location_reference: locationIntel?.local_location_reference ?? null
      },
      // REAL: Brand voice (Step 1) - V5 schema with Tone DNA
      brand_voice: brandProfile ? {
        // Include full v5 structure for guardrails access in phase2c.ts
        brand_profile_v5: brandProfile.brand_profile_v5 || null,
        // V5-first: Extract from brand_profile_v5.voice.tone_dna if available
        tone_dna: brandProfile.brand_profile_v5?.voice?.tone_dna || null,
        tone_rules: brandProfile.brand_profile_v5?.voice?.tone_rules || [],
        // Extract tone positioning from Tone DNA
        tone_positioning: brandProfile.brand_profile_v5?.voice?.tone_dna?.recommended_tone?.tone_positioning || '',
        // FIXED: Use V5 formality level instead of incorrectly mapping brand_essence (V5-ONLY cleanup June 23, 2026)
        voice_style: brandProfile.brand_profile_v5?.voice?.formality_level || 
                     brandProfile.formality_level || 
                     '',
        // Parse things_to_avoid as do_not_say
        do_not_say: (()=>{
          const avoid = brandProfile.things_to_avoid;
          if (typeof avoid === 'string') {
            try {
              return JSON.parse(avoid);
            } catch  {
              return {};
            }
          }
          return avoid || {};
        })(),
        // Parse content_focus as content_pillars
        content_pillars: (()=>{
          const focus = brandProfile.content_focus;
          if (typeof focus === 'string') {
            try {
              return JSON.parse(focus);
            } catch  {
              return {};
            }
          }
          return focus || {};
        })(),
        // V5 specific enrichment fields
        never_say: brandProfile.voice_guardrails?.never_say || brandProfile.never_say || [],
        core_offerings: (()=>{
          const co = brandProfile.core_offerings;
          if (typeof co === 'string') {
            try {
              return JSON.parse(co);
            } catch  {
              return co;
            }
          }
          return co || null;
        })(),
        // V2 fields — Brand Profile V2 (March 2026)
        brand_essence: brandProfile.brand_essence || '',
        tone_of_voice: brandProfile.tone_of_voice || null,
        // Voice guardrails — structured never_say + avoid patterns for text generation
        voice_guardrails: (()=>{
          const vg = brandProfile.voice_guardrails;
          if (typeof vg === 'string') {
            try {
              return JSON.parse(vg);
            } catch {
              return null;
            }
          }
          return vg || null;
        })(),
        // Enhanced social examples — flattened from brand_profile_v5.voice.enhanced_social_examples
        enhanced_social_examples: (()=>{
          const ex = brandProfile.enhanced_social_examples;
          if (typeof ex === 'string') {
            try {
              return JSON.parse(ex);
            } catch {
              return [];
            }
          }
          return ex || [];
        })(),
        // Enhanced avoid examples — flattened from brand_profile_v5.voice.enhanced_avoid_examples
        enhanced_avoid_examples: (()=>{
          const ex = brandProfile.enhanced_avoid_examples;
          if (typeof ex === 'string') {
            try {
              return JSON.parse(ex);
            } catch {
              return [];
            }
          }
          return ex || [];
        })(),
        // V5.6 CTA Library — brand-specific CTAs for different intents (visit, booking, engagement, social_media)
        cta_library: brandProfile.brand_profile_v5?.voice?.writing_examples?.cta_library || null,
        cta_preferences: brandProfile.brand_profile_v5?.voice?.writing_examples?.cta_preferences || null,
        // Identity fields for Phase 1 strategy grounding
        gastronomic_profile: (brandProfile as any).gastronomic_profile || null,
        tone_model: (()=>{
          const tm = brandProfile.tone_model;
          if (typeof tm === 'string') {
            try {
              return JSON.parse(tm);
            } catch  {
              return null;
            }
          }
          return tm || null;
        })(),
        // Content strategy — drives Phase 1 slot assignment (goal_mode + content_category per post)
        content_strategy: (()=>{
          const cs = brandProfile.content_strategy;
          if (typeof cs === 'string') {
            try {
              return JSON.parse(cs);
            } catch  {
              return null;
            }
          }
          return cs || null;
        })(),
        // v5: recognizable_interior_identity — verified factual venue description from photo analysis.
        // Factual anchor for atmosphere posts; prevents training-data interpolation about the space.
        recognizable_interior_identity: (()=>{
          const rii = brandProfile.recognizable_interior_identity;
          if (typeof rii === 'string') return rii;
          if (rii && typeof rii === 'object' && typeof rii.value === 'string') return rii.value;
          return null;
        })()
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
      // Revenue drivers from business_brand_profile (for Business Rules Engine)
      revenue_drivers: brandProfile?.revenue_drivers || null,
      // Posting strategy — AI-assessed optimal slot windows per business (drives business-rules-engine)
      posting_strategy: (brandProfile as any)?.posting_strategy || null,
      // Busy pattern — AI-assessed typical busy/quiet periods (used in Phase 0 context + UI)
      busy_pattern: (brandProfile as any)?.busy_pattern || null,
      // Target type mix — drives content type allocation (product/experience/occasion/retention)
      target_type_mix: (()=>{
        const ttm = brandProfile?.target_type_mix;
        if (typeof ttm === 'string') {
          try {
            return JSON.parse(ttm);
          } catch {
            return null;
          }
        }
        return ttm || null;
      })(),
    };
    console.log('[get-weekly-strategy] Context built:', {
      business_type: weekContext.business_type,
      service_periods: weekContext.service_periods,
      signature_items_count: weekContext.signature_items.length,
      location_type: weekContext.location.type,
      economic: weekContext.economic
    });
    // ── DERIVE goal_blend FROM PROGRAMME SPLITS (if not already set in brand profile) ──
    // business_brand_profile.content_strategy.goal_blend may not be set for older businesses.
    // In that case, compute it as the average of all active programme baseline_goal_splits.
    // This ensures assignSlotMetadata() always has a goal_blend to enforce the right
    // footfall/brand/loyalty post count distribution (e.g. 2+1+1 for 4-post weeks).
    console.log('[get-weekly-strategy] Checking content_strategy:', {
      has_brand_voice: !!weekContext.brand_voice,
      has_content_strategy: !!weekContext.brand_voice?.content_strategy,
      content_strategy_value: weekContext.brand_voice?.content_strategy,
      has_goal_blend: !!weekContext.brand_voice?.content_strategy?.goal_blend,
      goal_blend_value: weekContext.brand_voice?.content_strategy?.goal_blend,
    });
    if (weekContext.brand_voice && !weekContext.brand_voice.content_strategy?.goal_blend) {
      const progs = businessProgrammes ?? [];
      const splitsWithData = progs.filter((p: any) => p.baseline_goal_split);
      if (splitsWithData.length > 0) {
        const n = splitsWithData.length;
        const avgFootfall  = splitsWithData.reduce((s: number, p: any) => s + (p.baseline_goal_split.drive_footfall   || 0), 0) / n / 100;
        const avgBrand     = splitsWithData.reduce((s: number, p: any) => s + (p.baseline_goal_split.strengthen_brand || 0), 0) / n / 100;
        const avgLoyalty   = splitsWithData.reduce((s: number, p: any) => s + (p.baseline_goal_split.retain_regulars  || 0), 0) / n / 100;
        const derivedBlend = {
          drive_footfall: Math.round(avgFootfall * 100) / 100,
          build_brand:    Math.round(avgBrand    * 100) / 100,
          retain_loyalty: Math.round(avgLoyalty  * 100) / 100,
        };
        if (!weekContext.brand_voice.content_strategy) {
          weekContext.brand_voice.content_strategy = { goal_blend: derivedBlend } as any;
        } else {
          weekContext.brand_voice.content_strategy.goal_blend = derivedBlend;
        }
        console.log('[get-weekly-strategy] Derived goal_blend from programme splits:', derivedBlend);
      }
    }

    // ── STRATEGY MODULATOR: contextual weekly adjustment of goal_blend + CCW ──────
    // Runs before Phase 1. Injects week_goal_blend / week_content_category_weights
    // directly into weekContext so assignSlotMetadata() picks them up automatically.
    // Returns baseline unchanged if no notable signals this week (zero AI cost).
    const modulation = await generateWeeklyModulation(weekContext);
    if (weekContext.brand_voice) {
      if (!weekContext.brand_voice.content_strategy) {
        weekContext.brand_voice.content_strategy = {} as any;
      }
      weekContext.brand_voice.content_strategy.week_goal_blend = modulation.week_goal_blend;
      weekContext.brand_voice.content_strategy.week_content_category_weights = modulation.week_content_category_weights;
      weekContext.brand_voice.content_strategy.week_strategic_rationale = modulation.week_strategic_rationale;
    }
    weekContext.week_mode = modulation.week_mode;
    weekContext.deprioritize = modulation.deprioritize;
    console.log('[get-weekly-strategy] Modulation:', {
      factors: modulation.modulation_factors,
      rationale: modulation.week_strategic_rationale
    });
    // Check for existing strategy (prevent duplicate generation)
    const weekStartStr = toLocalISO(weekStartDate);
    const { data: existing } = await dataClient.from('weekly_strategies').select('id, status, narrative, strategic_priorities, post_ideas, selected_idea_ids, strategic_brief, strategic_brief_raw, strategy_version, generated_at, week_context_snapshot').eq('business_id', body.business_id).eq('week_start', weekStartStr).single();
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
          status: 'pending'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 202
        });
      }
      console.log('[get-weekly-strategy] Stale pending row detected — restarting generation:', existing.id);
    }
    
    // ── WEATHER & STALENESS CHECK: Auto-regenerate if conditions changed significantly ──
    // Check if cached strategy should be auto-regenerated due to:
    // 1. Significant weather changes (rain pattern, temperature, outdoor viability)
    // 2. Brand profile updated after strategy generation (content_strategy, programmes, etc.)
    //
    // CRITICAL CHANGE: Also check weather when body.regenerate is true
    // → Block manual regeneration unless weather changed OR owner_note provided
    // → This prevents quality loss from unnecessary "regenerate from scratch"
    let shouldAutoRegenerate = false;
    let autoRegenerateReason: string | undefined;
    let weatherHasChanged = false;
    let brandProfileStale = false;
    
    if (existing) {
      // Check weather changes (for both auto and manual regeneration)
      if (existing.status === 'generated') {
        const oldWeatherSnapshot = (existing.week_context_snapshot as any)?.weather;
        if (oldWeatherSnapshot && weekWeather) {
          weatherHasChanged = hasSignificantWeatherChange(weekWeather, oldWeatherSnapshot);
          if (weatherHasChanged) {
            shouldAutoRegenerate = true;
            autoRegenerateReason = 'weather_changed';
            console.log('[get-weekly-strategy] Weather changed significantly since strategy generation — auto-regenerating');
          }
        }
        
        // Check brand profile staleness
        const brandProfileUpdatedAt = (brandProfile as any)?.updated_at;
        const freshnessCheck = checkStrategyFreshness(brandProfileUpdatedAt, existing.generated_at);
        if (freshnessCheck.isStale) {
          brandProfileStale = true;
          shouldAutoRegenerate = true;
          autoRegenerateReason = autoRegenerateReason ? `${autoRegenerateReason}+brand_profile_updated` : 'brand_profile_updated';
          console.log('[get-weekly-strategy] Brand profile updated since strategy generation:', freshnessCheck.reason);
        }
      }
    }
    
    // ── BLOCK MANUAL REGENERATION UNLESS WEATHER CHANGED ──
    // If user clicked "Generer ny plan" but weather hasn't changed AND no owner_note provided,
    // reject the regeneration request and return cached strategy.
    // Exception: owner_note provided = user-triggered regeneration with explicit reason
    if (existing?.status === 'generated' && body.regenerate && !weatherHasChanged && !brandProfileStale && !body.owner_note) {
      console.log('[get-weekly-strategy] BLOCKED manual regeneration - weather unchanged, returning cache');
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
          target_post_count: existing.post_ideas?.length || 0,
          validation_passed: true,
          validation_warnings: []
        },
        selected_idea_ids: existing.selected_idea_ids,
        from_cache: true,
        regeneration_blocked: true,
        block_reason: 'weather_unchanged',
        week_context: {
          week_number: weekNumber,
          week_start: weekStartStr,
          week_end: toLocalISO(weekEndDate),
          available_days: availableDays,
          platforms: activePlatforms,
          subscription_tier: subscriptionTier,
          target_post_count: existing.post_ideas?.length || 0
        }
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    
    // Skip cache if regenerate flag is set OR auto-regeneration triggered
    if (existing && existing.status !== 'generated' && existing.status !== 'error' && !body.regenerate && !shouldAutoRegenerate) {
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
          target_post_count: existing.post_ideas?.length || 0,
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
          target_post_count: existing.post_ideas?.length || 0
        }
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    
    // Return hot cache when strategy is already generated and regeneration not requested.
    // Previously this fell through to re-generation; now that generation is async we always
    // respect the cache to avoid an unnecessary 130 s polling wait.
    // EXCEPTION: Auto-regenerate if weather changed significantly or brand profile updated
    if (existing?.status === 'generated' && !body.regenerate && !shouldAutoRegenerate) {
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
          target_post_count: existing.post_ideas?.length || 0,
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
          target_post_count: existing.post_ideas?.length || 0
        }
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    // Log if regenerating despite cache
    if (existing && (body.regenerate || shouldAutoRegenerate)) {
      console.log('[get-weekly-strategy] Regenerating despite existing strategy:', {
        existing_id: existing.id,
        existing_status: existing.status,
        regenerate_flag: body.regenerate,
        auto_regenerate: shouldAutoRegenerate,
        auto_regenerate_reason: autoRegenerateReason
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
    let pendingRow = null;
    let pendingError = null;
    if (existing) {
      // Existing row — update only the mutable columns, leaving narrative/strategic_priorities/post_ideas intact
      const { data, error } = await dataClient.from('weekly_strategies').update({
        status: 'pending',
        generated_at: new Date().toISOString(),
        is_current_week: body.include_current_week || false,
        business_type: weekContext.business_type,
        country: weekContext.country,
        platforms: activePlatforms,
        subscription_tier: subscriptionTier,
        strategy_version: 'v2.2.0_brand_v5',
        selected_idea_ids: null
      }).eq('id', existing.id).select('id').single();
      pendingRow = data;
      pendingError = error;
    } else {
      // No existing row — INSERT with empty placeholders for NOT NULL columns
      const { data, error } = await dataClient.from('weekly_strategies').insert({
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
        narrative: '',
        strategic_priorities: [],
        post_ideas: []
      }).select('id').single();
      pendingRow = data;
      pendingError = error;
    }
    if (pendingError || !pendingRow) {
      console.error('[get-weekly-strategy] Failed to create pending stub:', pendingError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to initialise generation job'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    const strategyRowId = pendingRow.id;
    console.log('[get-weekly-strategy] Pending stub created, ID:', strategyRowId, '— returning 202 immediately');
    // Step 2: full pipeline runs in background after HTTP response is sent
    const backgroundGeneration = (async ()=>{
      try {
        console.log('[get-weekly-strategy] Background task started for strategy:', strategyRowId);
        // Derive interpretation layer (pure TS, no AI cost) before any AI calls
        const weatherInterpretation = interpretWeather(weekContext.weather, weekContext.location.has_outdoor_seating, weekContext.location.type, weekContext.service_periods);
        weekContext.weather_interpretation = weatherInterpretation;
        const weeklyInterp = deriveWeeklyInterpretation(weekContext);
        
        // Use validated business_archetype from database if available; fallback to derived value
        if (brandProfile?.business_archetype) {
          weekContext.business_archetype = brandProfile.business_archetype as any;
          console.log('[get-weekly-strategy] Using database business_archetype:', brandProfile.business_archetype);
        } else {
          weekContext.business_archetype = weeklyInterp.business_archetype;
          console.log('[get-weekly-strategy] Using derived business_archetype (DB value missing):', weeklyInterp.business_archetype);
        }
        
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
        const strategy = await generateWeeklyStrategy(weekContext, {
          regenerate: body.regenerate
        });
        console.log('[get-weekly-strategy] Background: strategy generated:', {
          strategy_row_id: strategyRowId,
          post_ideas_count: strategy.post_ideas.length,
          strategic_priorities: strategy.strategic_priorities.map((p)=>p.focus)
        });
        // ===== PHASE C: TYPE ALLOCATION =====
        // Assign content_type to each post idea based on programme goals and analytics
        console.log('\n🎯 [PHASE C] Starting content type allocation...');
        try {
          if (typeAnalyticsData) {
            // Parse staleness and drift from analytics data
            const stalenessData = typeAnalyticsData.staleness.map((s)=>({
                type: s.type,
                lastUsed: s.last_used,
                daysSince: s.days_since,
                priority: parseFloat(s.staleness_priority)
              }));
            const driftData = typeAnalyticsData.drift.map((d)=>({
                type: d.type,
                target: parseFloat(d.target_pct) / 100,
                actual: parseFloat(d.actual_pct) / 100,
                drift: parseFloat(d.drift_pct) / 100,
                correction: parseFloat(d.correction_multiplier)
              }));
            // Map service_period to programme_type before allocation
            const postsWithProgrammeType = strategy.post_ideas.map((post: any) => ({
              ...post,
              programme_type: servicePeriodMap[post.service_period?.toLowerCase()] || post.service_period || 'all_day'
            }));
            // Apply type allocation to post ideas with full goal splits
            const typedPosts = allocateContentTypes(postsWithProgrammeType, programmeGoalSplits, targetTypeMix, stalenessData, driftData);
            strategy.post_ideas = typedPosts;
            console.log('[PHASE C] Type allocation complete. Post ideas now have content_type and type_rationale.');
          } else {
            console.warn('[PHASE C] No type analytics available, skipping allocation.');
          }
        } catch (allocError) {
          console.error('[PHASE C] Type allocation FAILED:', {
            error: allocError,
            message: allocError?.message,
            stack: allocError?.stack
          });
        // Continue without type allocation - posts will not have content_type field
        }
        // ===== END PHASE C =====
        
        // ===== POST-PROCESS: Fix booking signal flow =====
        console.log('[get-weekly-strategy] POST-PROCESS: Mapping cta_mode → cta_intent and resolving post dates...');
        const angles = strategy.strategic_brief?.angles ?? [];
        
        for (const idea of strategy.post_ideas) {
          const angle = angles.find((a: any) => String(a.slot_id) === String(idea.slot_id));
          if (!angle) continue;
          
          // FIX 2a: deterministic cta_intent (NEVER trust AI value)
          idea.cta_intent = ctaModeToIntent(angle.cta_mode, idea.goal_mode);
          
          // FIX 2b: deterministic post date from target_days + lead_days offset
          const leadDays = weekContext.cta_rules?.booking_nudge_lead_days ?? 2;
          const resolvedDate = resolvePostDate(
            angle.target_days ?? [],
            weekContext.available_days,
            angle.cta_mode,
            leadDays,
          );
          idea.suggested_day = resolvedDate;
          if (idea.timing_intelligence) {
            idea.timing_intelligence.suggested_post_date = resolvedDate;
          }
        }
        
        // FIX 1: rebuild week summary sentence from actual slot counts
        const correctSummaryLine = rebuildWeekSummarySentence(angles);
        if (strategy.strategic_brief?.week_summary && correctSummaryLine) {
          strategy.strategic_brief.week_summary = strategy.strategic_brief.week_summary
            .replace(/Denne uge:[^.]+\./u, correctSummaryLine)
            .trim();
        }
        
        console.log('[get-weekly-strategy] POST-PROCESS complete:', {
          post_ideas_mapped: strategy.post_ideas.map((p: any) => ({
            slot: p.slot_id,
            cta_intent: p.cta_intent,
            suggested_day: p.suggested_day,
          })),
          week_summary: strategy.strategic_brief?.week_summary?.substring(0, 80),
        });
        // ===== END POST-PROCESS =====
        
        // DEBUG: Verify weekContext has booking data before saving
        console.log('[get-weekly-strategy] About to save weekContext:', {
          has_weekContext: !!weekContext,
          booking_link: weekContext?.booking_link,
          booking_model: weekContext?.booking_model,
          cta_rules_mode: weekContext?.cta_rules?.mode
        });
        
        const { error: saveError } = await dataClient.from('weekly_strategies').upsert({
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
          strategy_rationale: (() => {
            const parts = []
            if (strategy.strategic_brief?.week_summary) parts.push(strategy.strategic_brief.week_summary)
            if (modulation.week_strategic_rationale) parts.push(modulation.week_strategic_rationale)
            // Append booking nudge rationale if AI produced one
            const nudgeIdea = strategy.post_ideas?.find((p: any) => p.nudge_rationale)
            if (nudgeIdea?.nudge_rationale) parts.push(`[Booking nudge: ${nudgeIdea.nudge_rationale}]`)
            return parts.join(' | ') || null
          })(),
          status: 'generated'
        }, {
          onConflict: 'business_id,week_start'
        });
        if (saveError) {
          console.error('[get-weekly-strategy] Background: failed to save strategy:', {
            error: saveError,
            message: saveError.message,
            code: saveError.code,
            details: saveError.details
          });
          await dataClient.from('weekly_strategies').update({
            status: 'error'
          }).eq('id', strategyRowId);
        } else {
          console.log('[get-weekly-strategy] Background: strategy saved successfully, ID:', strategyRowId);
        }
      } catch (bgError) {
        const errMsg = bgError instanceof Error ? bgError.message : String(bgError);
        console.error('[get-weekly-strategy] Background: generation failed:', errMsg);
        try {
          await dataClient.from('weekly_strategies').update({
            status: 'error',
            strategy_rationale: `Error: ${errMsg.slice(0, 500)}`
          }).eq('id', strategyRowId);
        } catch (_) {}
      }
    })();
    // Step 3: register with EdgeRuntime.waitUntil so the task outlives the HTTP response.
    // Falls back to await (blocking) in local dev where EdgeRuntime may not be present.
    try {
      globalThis.EdgeRuntime.waitUntil(backgroundGeneration);
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
        target_post_count: 0,
        revenue_drivers: brandProfile?.revenue_drivers || null
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 202
    });
  } catch (error) {
    console.error('[get-weekly-strategy] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
