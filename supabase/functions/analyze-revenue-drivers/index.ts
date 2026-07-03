import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.1.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  business_id: string;
  force_refresh?: boolean;  // Re-analyze even if revenue_drivers already exists
}

interface RevenueDrivers {
  analyzed_at: string;
  analyzed_from: string;
  confidence_score: number;
  primary_revenue_moments: RevenueMoment[];  // Changed to array for temporal analysis
  secondary_revenue_moments: RevenueMoment[];  // Content angles that overlap with primaries
  normal_week_strategy: {
    minimum_coverage: {
      weekend_driver_posts: number;
      weekday_presence_posts: number;
      brand_builder_posts: number;
    };
    preferred_days: string[];
    rationale: string;
  };
  preferred_day_pattern?: string[];  // Synthesized from all primary moments
}

interface RevenueMoment {
  moment_id: string;
  label: string;
  importance: 'primary' | 'secondary' | 'tertiary';
  service_type: string;
  days: string[];
  time_range: string;
  decision_pattern: 'advance_booking' | 'same_day_morning' | 'same_day_afternoon' | 'spontaneous';
  decision_windows: Array<{
    description: string;
    days: string[];
    hours: string;
    conversion_strength: 'high' | 'medium' | 'low';
  }>;
  typical_lead_time: string;
  post_timing_rules: Array<{
    timing: string;
    purpose: string;
    priority: 'required' | 'recommended' | 'optional';
  }>;
  content_focus: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()
    const { business_id, force_refresh = false } = body

    if (!business_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing business_id' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Use service role for all operations (no user auth required)
    // This function can be called internally or with service role key
    const dataClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch business profile (including brand_profile_v5 for programme data)
    const { data: profile, error: profileError } = await dataClient
      .from('business_brand_profile')
      .select('business_id, business_character, revenue_drivers, brand_profile_v5')
      .eq('business_id', business_id)
      .single()

    if (profileError || !profile) {
      console.error('[analyze-revenue-drivers] Profile fetch error:', profileError)
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Business profile not found',
        debug: {
          profileError: profileError?.message,
          hasProfile: !!profile,
          business_id
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // Check if revenue_drivers already exists and force_refresh is false
    if (profile.revenue_drivers && !force_refresh) {
      console.log('[analyze-revenue-drivers] Revenue drivers already exist, skipping analysis')
      return new Response(JSON.stringify({
        success: true,
        revenue_drivers: profile.revenue_drivers,
        cached: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Try to extract revenue drivers from structured programme data first
    let revenueDrivers: RevenueDrivers | null = null
    let analysisMethod = 'unknown'

    // Check if brand_profile_v5.layer_1_programmes exists
    const programmes = profile.brand_profile_v5?.layer_1_programmes
    if (programmes && Array.isArray(programmes) && programmes.length > 0) {
      console.log('[analyze-revenue-drivers] Using structured programme data from brand_profile_v5')
      revenueDrivers = extractRevenueDriversFromProgrammes(programmes)
      analysisMethod = 'structured_programmes'
    } else {
      // Fallback to AI text analysis
      console.log('[analyze-revenue-drivers] No programme data found, using AI text analysis')
      
      // Validate business_character exists
      if (!profile.business_character || profile.business_character.trim().length < 50) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'No programme data and business description too short (minimum 50 characters required)',
          suggestion: 'Please update "Om os" section in business profile or generate brand profile with programmes'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      revenueDrivers = await analyzeRevenueDrivers(
        profile.business_character,
        [] // service_periods not in schema yet
      )
      analysisMethod = 'ai_text_inference'
    }

    // Store in database
    const { error: updateError } = await dataClient
      .from('business_brand_profile')
      .update({ revenue_drivers: revenueDrivers })
      .eq('business_id', business_id)

    if (updateError) {
      console.error('[analyze-revenue-drivers] Failed to store revenue_drivers:', updateError)
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to save revenue drivers',
        details: updateError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    console.log(`[analyze-revenue-drivers] Success! Method: ${analysisMethod}, Confidence: ${revenueDrivers.confidence_score}`)

    return new Response(JSON.stringify({
      success: true,
      revenue_drivers: revenueDrivers,
      analysis_method: analysisMethod,
      cached: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[analyze-revenue-drivers] Error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// ============================================================
// STRUCTURED PROGRAMME DATA EXTRACTOR
// ============================================================

function extractRevenueDriversFromProgrammes(programmes: any[]): RevenueDrivers {
  console.log('[extractRevenueDriversFromProgrammes] Processing', programmes.length, 'programmes')
  
  // Map programme types to revenue moment IDs
  const programmeTypeMap: Record<string, string> = {
    'dinner': 'dinner',
    'lunch': 'lunch',
    'morning': 'brunch',
    'breakfast': 'breakfast',
    'coffee': 'coffee',
    'cocktails': 'cocktails',
  }

  // Map decision_timing to decision_pattern
  const decisionPatternMap: Record<string, string> = {
    'planned': 'advance_booking',
    'mixed': 'same_day_afternoon',
    'spontaneous': 'spontaneous',
  }

  // Convert programmes to revenue moments
  const moments = programmes.map(prog => {
    const momentId = `${prog.type}_${prog.name.toLowerCase().replace(/\s+/g, '_')}`
    const timeRange = `${prog.timeWindow.start}-${prog.timeWindow.end}`
    
    // Map daysOfWeek to title case
    const days = prog.daysOfWeek.map((d: string) => 
      d.charAt(0).toUpperCase() + d.slice(1)
    )

    // Determine decision pattern from commercialOrientation
    const decisionTiming = prog.commercialOrientation?.decision_timing || 'mixed'
    const decisionPattern = decisionPatternMap[decisionTiming] || 'same_day_afternoon'

    // Build decision windows based on programme type and timing
    const decisionWindows = buildDecisionWindows(prog.type, days, decisionTiming)

    // Build post timing rules
    const postTimingRules = buildPostTimingRules(prog.type, days, prog.timeWindow)

    // Content focus based on programme type and goals
    const contentFocus = buildContentFocus(prog.type, prog.commercialOrientation)

    const moment: RevenueMoment = {
      moment_id: momentId,
      label: prog.name,
      importance: 'secondary', // Will be set after ranking
      service_type: prog.type,
      days: days,
      time_range: timeRange,
      decision_pattern: decisionPattern as any,
      decision_windows: decisionWindows,
      typical_lead_time: getTypicalLeadTime(decisionPattern),
      post_timing_rules: postTimingRules,
      content_focus: contentFocus,
    }

    return {
      moment,
      driveFootfall: prog.commercialOrientation?.baseline_goal_split?.drive_footfall || 50,
    }
  })

  // TEMPORAL OVERLAP ANALYSIS: Classify moments based on time slot competition
  // Primary = Serves unique time slot (no temporal conflict)
  // Secondary = Overlaps with primary (same time/days → content angle, not separate driver)
  
  const primaryMoments: RevenueMoment[] = []
  const secondaryMoments: RevenueMoment[] = []
  
  for (const { moment } of moments) {
    // Check if this moment overlaps with any existing primary
    const hasOverlap = primaryMoments.some(primary => 
      hasTemporalOverlap(moment, primary)
    )
    
    if (!hasOverlap) {
      // No overlap → this is a new primary revenue moment
      moment.importance = 'primary'
      primaryMoments.push(moment)
      console.log(`[temporal-analysis] PRIMARY: ${moment.label} - unique time slot (${moment.days.join('/')}, ${moment.time_range})`)
    } else {
      // Overlaps with existing primary → treat as content angle/secondary
      moment.importance = 'secondary'
      secondaryMoments.push(moment)
      console.log(`[temporal-analysis] SECONDARY: ${moment.label} - overlaps with existing primary`)
    }
  }
  
  console.log(`[temporal-analysis] Result: ${primaryMoments.length} primary moments, ${secondaryMoments.length} secondary`)

  // Build normal week strategy from ALL primary moments
  const normalWeekStrategy = buildNormalWeekStrategyMulti(primaryMoments, secondaryMoments)
  
  // Synthesize preferred day pattern from all primaries
  const preferredDayPattern = synthesizePreferredDays(primaryMoments)

  const revenueDrivers: RevenueDrivers = {
    analyzed_at: new Date().toISOString(),
    analyzed_from: 'brand_profile_v5.layer_1_programmes',
    confidence_score: 95, // High confidence from structured menu data
    primary_revenue_moments: primaryMoments,
    secondary_revenue_moments: secondaryMoments,
    normal_week_strategy: normalWeekStrategy,
    preferred_day_pattern: preferredDayPattern,
  }

  return revenueDrivers
}

function buildDecisionWindows(
  programmeType: string,
  days: string[],
  decisionTiming: string
): Array<{ description: string; days: string[]; hours: string; conversion_strength: 'high' | 'medium' | 'low' }> {
  const windows = []

  if (programmeType === 'dinner') {
    // Weekend dinner: Thu-Fri afternoon decision window
    const weekendDays = days.filter(d => d === 'Friday' || d === 'Saturday')
    if (weekendDays.length > 0) {
      windows.push({
        description: 'Thursday-Friday afternoon planning for weekend dining',
        days: ['Thursday', 'Friday'],
        hours: '14:00-18:00',
        conversion_strength: 'high' as const,
      })
    }
    
    // Weekday dinner: same-day afternoon
    const weekdayDays = days.filter(d => !['Saturday', 'Sunday'].includes(d))
    if (weekdayDays.length > 0) {
      windows.push({
        description: 'Same-day afternoon decision for weekday dining',
        days: weekdayDays,
        hours: '14:00-18:00',
        conversion_strength: 'medium' as const,
      })
    }
  } else if (programmeType === 'lunch') {
    windows.push({
      description: 'Morning decision for lunch plans',
      days: days,
      hours: '08:00-11:00',
      conversion_strength: 'medium' as const,
    })
  } else if (programmeType === 'morning' || programmeType === 'breakfast') {
    windows.push({
      description: 'Same morning decision for brunch',
      days: days,
      hours: '08:00-10:30',
      conversion_strength: 'medium' as const,
    })
  } else {
    // Default: same-day afternoon
    windows.push({
      description: `Same-day decision for ${programmeType}`,
      days: days,
      hours: '14:00-18:00',
      conversion_strength: 'medium' as const,
    })
  }

  return windows
}

function buildPostTimingRules(
  programmeType: string,
  days: string[],
  timeWindow: { start: string; end: string }
): Array<{ timing: string; purpose: string; priority: 'required' | 'recommended' | 'optional' }> {
  const rules = []

  if (programmeType === 'dinner') {
    // Weekend dinner gets Thursday driver post
    if (days.includes('Friday') || days.includes('Saturday')) {
      rules.push({
        timing: 'Thursday 14:00',
        purpose: 'Prime weekend dinner intent for Fri-Sat',
        priority: 'required' as const,
      })
      rules.push({
        timing: 'Friday 14:00',
        purpose: 'Drive Saturday bookings + Friday same-day',
        priority: 'required' as const,
      })
    }
  } else if (programmeType === 'lunch') {
    rules.push({
      timing: 'same_day 08:00-10:00',
      purpose: 'Drive same-day lunch traffic',
      priority: 'recommended' as const,
    })
  } else if (programmeType === 'morning') {
    rules.push({
      timing: 'same_day 08:00-09:30',
      purpose: 'Capture morning brunch decision',
      priority: 'recommended' as const,
    })
  }

  return rules
}

function buildContentFocus(
  programmeType: string,
  commercialOrientation: any
): string[] {
  const focus = []

  if (programmeType === 'dinner') {
    focus.push('menu_items', 'atmosphere', 'reservation_cta')
  } else if (programmeType === 'lunch') {
    focus.push('lunch_menu', 'quick_service', 'convenience')
  } else if (programmeType === 'morning' || programmeType === 'breakfast') {
    focus.push('brunch_menu', 'morning_atmosphere', 'weekend_vibes')
  }

  // Add based on goals
  if (commercialOrientation?.baseline_goal_split?.strengthen_brand > 25) {
    focus.push('brand_storytelling')
  }
  if (commercialOrientation?.baseline_goal_split?.retain_regulars > 20) {
    focus.push('loyalty_engagement')
  }

  return focus
}

function getTypicalLeadTime(decisionPattern: string): string {
  const leadTimeMap: Record<string, string> = {
    'advance_booking': '2-7 days ahead',
    'same_day_morning': 'same day',
    'same_day_afternoon': 'same day to 24 hours',
    'spontaneous': 'within 1-2 hours',
  }
  return leadTimeMap[decisionPattern] || 'same day'
}

function buildNormalWeekStrategy(
  primaryMoment: RevenueMoment,
  secondaryMoments: RevenueMoment[]
): RevenueDrivers['normal_week_strategy'] {
  const preferredDays = new Set<string>()

  // Always add Monday for brand awareness
  preferredDays.add('Monday')

  // Add Wednesday for mid-week presence
  preferredDays.add('Wednesday')

  // Add days based on primary moment
  if (primaryMoment.service_type === 'dinner') {
    // Dinner programs need Thursday driver + Saturday reminder
    if (primaryMoment.days.includes('Friday') || primaryMoment.days.includes('Saturday')) {
      preferredDays.add('Thursday')
      preferredDays.add('Saturday')
    }
  } else if (primaryMoment.service_type === 'lunch') {
    // Lunch programs benefit from Wednesday mid-week
    preferredDays.add('Wednesday')
  }

  // Check secondary moments for dinner (if primary is not dinner)
  const hasDinnerMoment = secondaryMoments.some(m => m.service_type === 'dinner')
  if (hasDinnerMoment && primaryMoment.service_type !== 'dinner') {
    preferredDays.add('Thursday')
  }

  return {
    minimum_coverage: {
      weekend_driver_posts: primaryMoment.service_type === 'dinner' ? 2 : 1,
      weekday_presence_posts: 1,
      brand_builder_posts: 1,
    },
    preferred_days: Array.from(preferredDays).sort(),
    rationale: `Based on ${primaryMoment.label} as primary revenue driver (${primaryMoment.service_type}) and ${secondaryMoments.length} secondary moments. Strategy ensures coverage of key decision windows while maintaining brand presence.`,
  }
}

// ============================================================================
// TEMPORAL OVERLAP ANALYSIS (Option A Enhancement)
// ============================================================================

/**
 * Checks if two revenue moments have temporal overlap (compete for same time slots)
 * Used to determine if moments should be separate primaries or merged
 */
function hasTemporalOverlap(moment1: RevenueMoment, moment2: RevenueMoment): boolean {
  // Check day overlap
  const days1Set = new Set(moment1.days)
  const days2Set = new Set(moment2.days)
  const dayOverlap = moment1.days.some(d => days2Set.has(d))
  
  if (!dayOverlap) {
    // Different days = no overlap (e.g., weekday lunch vs weekend brunch)
    return false
  }
  
  // Days overlap, check time ranges
  const time1 = parseTimeRange(moment1.time_range)
  const time2 = parseTimeRange(moment2.time_range)
  
  if (!time1 || !time2) {
    // Can't parse times, conservatively assume overlap
    return true
  }
  
  // Check if times overlap
  const timeOverlap = (
    (time1.start < time2.end && time1.end > time2.start) ||
    (time2.start < time1.end && time2.end > time1.start)
  )
  
  return timeOverlap
}

/**
 * Parse time range string "HH:MM-HH:MM" to minutes since midnight
 */
function parseTimeRange(timeRange: string): { start: number; end: number } | null {
  const match = timeRange.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/)
  if (!match) return null
  
  const [_, startHour, startMin, endHour, endMin] = match
  const start = parseInt(startHour) * 60 + parseInt(startMin)
  let end = parseInt(endHour) * 60 + parseInt(endMin)
  
  // Handle times that cross midnight (e.g., 17:30-02:00)
  if (end < start) {
    end += 24 * 60
  }
  
  return { start, end }
}

/**
 * Build normal week strategy from MULTIPLE primary moments
 */
function buildNormalWeekStrategyMulti(
  primaryMoments: RevenueMoment[],
  secondaryMoments: RevenueMoment[]
): RevenueDrivers['normal_week_strategy'] {
  const preferredDays = new Set<string>()
  let weekendDriverPosts = 0
  
  // Add Monday for brand awareness (universal)
  preferredDays.add('Monday')
  
  // Analyze each primary moment and add its optimal days
  for (const moment of primaryMoments) {
    const momentDays = getMomentOptimalDays(moment)
    momentDays.forEach(d => preferredDays.add(d))
    
    // Count weekend drivers
    if (moment.service_type === 'dinner' || moment.service_type === 'evening_dining') {
      const hasWeekendService = moment.days.some(d => d === 'Friday' || d === 'Saturday' || d === 'Sunday')
      if (hasWeekendService) {
        weekendDriverPosts += 2 // Thu + Fri/Sat
      }
    }
    
    if (moment.service_type === 'morning' || moment.service_type === 'brunch') {
      const hasWeekendService = moment.days.some(d => d === 'Saturday' || d === 'Sunday')
      if (hasWeekendService) {
        weekendDriverPosts += 1 // Fri preview
      }
    }
  }
  
  // Build rationale
  const momentLabels = primaryMoments.map(m => m.label).join(', ')
  const daysList = Array.from(preferredDays).sort((a, b) => {
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return dayOrder.indexOf(a) - dayOrder.indexOf(b)
  }).join(', ')
  
  return {
    minimum_coverage: {
      weekend_driver_posts: Math.max(weekendDriverPosts, 1),
      weekday_presence_posts: 1,
      brand_builder_posts: 1,
    },
    preferred_days: Array.from(preferredDays),
    rationale: `${primaryMoments.length} primary revenue moments (${momentLabels}) require non-competing posting windows. Preferred days: ${daysList}.`,
  }
}

/**
 * Get optimal posting days for a specific revenue moment
 */
function getMomentOptimalDays(moment: RevenueMoment): string[] {
  const days = new Set<string>()
  
  // Analyze decision pattern and days of operation
  if (moment.service_type === 'dinner' || moment.service_type === 'evening_dining') {
    const hasWeekendService = moment.days.some(d => d === 'Friday' || d === 'Saturday' || d === 'Sunday')
    if (hasWeekendService) {
      days.add('Thursday') // Booking surge
      days.add('Friday')   // Last-minute + Saturday driver
    }
    const hasWeekdayService = moment.days.some(d => !['Saturday', 'Sunday'].includes(d))
    if (hasWeekdayService) {
      days.add('Wednesday') // Mid-week presence
    }
  } else if (moment.service_type === 'lunch') {
    days.add('Monday')    // Start week visibility
    days.add('Wednesday') // Maintain presence
  } else if (moment.service_type === 'morning' || moment.service_type === 'brunch') {
    const hasWeekendService = moment.days.some(d => d === 'Saturday' || d === 'Sunday')
    if (hasWeekendService) {
      days.add('Friday')   // Weekend preview
      days.add('Saturday') // Day-of reminder
    }
  }
  
  return Array.from(days)
}

/**
 * Synthesize preferred day pattern from all primary moments
 * This is the final output that BusinessRulesEngine will use
 */
function synthesizePreferredDays(primaryMoments: RevenueMoment[]): string[] {
  const allDays = new Set<string>()
  
  // Collect all optimal days from all primaries
  for (const moment of primaryMoments) {
    const momentDays = getMomentOptimalDays(moment)
    momentDays.forEach(d => allDays.add(d))
  }
  
  // Always include Monday for brand presence
  allDays.add('Monday')
  
  // Sort by day of week
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  return Array.from(allDays).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
}

// ============================================================
// AI REVENUE DRIVER ANALYZER (FALLBACK)
// ============================================================

async function analyzeRevenueDrivers(
  businessAbout: string,
  servicePeriods: string[]
): Promise<RevenueDrivers> {
  const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') || '')
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
    }
  })

  const prompt = buildAnalysisPrompt(businessAbout, servicePeriods)
  
  const result = await model.generateContent(prompt)
  const response = result.response
  let text = response.text()
  
  // Remove markdown code blocks if present
  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  
  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch (parseError) {
    console.error('[analyze-revenue-drivers] Failed to parse AI response:', text.substring(0, 500))
    throw new Error('AI returned invalid JSON')
  }

  // Validate and enrich response
  const revenueDrivers: RevenueDrivers = {
    analyzed_at: new Date().toISOString(),
    analyzed_from: 'business_about',
    confidence_score: parsed.confidence_score || 70,
    primary_revenue_moments: Array.isArray(parsed.primary_revenue_moments) 
      ? parsed.primary_revenue_moments 
      : [parsed.primary_revenue_moment],  // Backward compat
    secondary_revenue_moments: parsed.secondary_revenue_moments || [],
    normal_week_strategy: parsed.normal_week_strategy || {
      minimum_coverage: {
        weekend_driver_posts: 1,
        weekday_presence_posts: 1,
        brand_builder_posts: 1,
      },
      preferred_days: ['Monday', 'Wednesday', 'Thursday', 'Saturday'],
      rationale: 'Balanced week coverage',
    },
    preferred_day_pattern: parsed.preferred_day_pattern || synthesizePreferredDays(
      Array.isArray(parsed.primary_revenue_moments) 
        ? parsed.primary_revenue_moments 
        : [parsed.primary_revenue_moment]
    ),
  }

  return revenueDrivers
}

function buildAnalysisPrompt(businessAbout: string, servicePeriods: string[]): string {
  return `Analyze this business description and extract revenue moments using TEMPORAL OVERLAP ANALYSIS.

BUSINESS DESCRIPTION:
${businessAbout}

SERVICE PERIODS (from profile):
${servicePeriods.length > 0 ? servicePeriods.join(', ') : 'Not specified'}

CRITICAL: Use TEMPORAL ANALYSIS, not revenue ranking!

Your task:
1. Identify ALL distinct time slots this business serves (e.g., "weekend brunch 10:00-14:00", "weekday lunch 11:30-14:00", "evening dining 17:30-21:30")
2. For EACH time slot, check for temporal overlap:
   - PRIMARY = Serves unique time/day combination (NO overlap with other slots)
   - SECONDARY = Overlaps with primary slot (same days + overlapping times → content angle, not separate driver)

TEMPORAL OVERLAP RULES:
✅ PRIMARY (separate moments):
  - "Weekday lunch Mon-Fri 11:30-14:00" + "Weekend brunch Sat-Sun 10:00-14:00" → BOTH PRIMARY (different days)
  - "Weekend brunch Sat-Sun 10:00-14:00" + "Evening dining Fri-Sat 17:30-21:30" → BOTH PRIMARY (different times)
  - "Weekday lunch Mon-Fri 11:30-14:00" + "Evening dining Mon-Sun 17:30-21:30" → BOTH PRIMARY (different times)

❌ SECONDARY (overlapping moments):
  - "Evening dining Fri-Sat 17:30-21:30" + "Cocktails Fri-Sat 17:00-23:00" → Dinner PRIMARY, Cocktails SECONDARY (same days, overlapping times)
  - "Morning coffee Mon-Fri 08:00-11:00" + "Breakfast Mon-Fri 08:00-11:00" → ONE PRIMARY combining both

EXAMPLES:

Example 1: Cafe with Brunch + Frokost + Aften
Services:
- Brunch: Sat-Sun 10:00-14:00
- Frokost: Mon-Fri 11:30-14:00  
- Aften: Mon-Sun 17:30-21:30

Analysis:
✅ Brunch PRIMARY (weekend mornings, no overlap)
✅ Frokost PRIMARY (weekday midday, no overlap with brunch due to different days)
✅ Aften PRIMARY (evenings, different time from both)

Result: 3 PRIMARY moments

Example 2: Wine bar with dinner + cocktails
Services:
- Dinner: Thu-Sat 17:30-22:00
- Cocktails: Thu-Sat 17:00-01:00

Analysis:
✅ Dinner PRIMARY (main revenue driver, evening service)
❌ Cocktails SECONDARY (full temporal overlap → content angle within dinner posts, not separate)

Result: 1 PRIMARY, 1 SECONDARY

For EACH primary moment, determine:
- What service type? (brunch/lunch/dinner/coffee/etc.)
- Which days? (specific days or weekday/weekend pattern)
- What time range?
- When do customers DECIDE to visit? (advance, same-day morning, same-day afternoon, spontaneous)
- What's the typical lead time? (days ahead, same day, hours ahead)
- Optimal posting days based on decision windows

DECISION PATTERN GUIDANCE:
- advance_booking: Customer books 2-7 days ahead (fine dining, special occasions)
- same_day_morning: Customer decides same day 08:00-11:00 (weekday lunch, weekend brunch)
- same_day_afternoon: Customer decides same day 14:00-18:00 (evening dining, after-work drinks)
- spontaneous: Customer decides within 1-2 hours (coffee, late-night bar)

DANISH CONTEXT (consider local dining customs):
- Frokost = 11:30-14:00 workday tradition (same-day morning decision)
- Aften = 17:30-21:30 dinner culture (Thu-Fri decision for weekend, same-day for weekdays)
- Brunch = 10:00-14:00 weekend social ritual (Fri-Sat morning preview decision)
- Cocktails typically Fri-Sat evening social activity (often part of aften visit)

OUTPUT JSON STRUCTURE:
{
  "confidence_score": 85,
  "primary_revenue_moments": [
    {
      "moment_id": "weekend_brunch",
      "label": "Weekend brunch",
      "importance": "primary",
      "service_type": "morning",
      "days": ["Saturday", "Sunday"],
      "time_range": "10:00-14:00",
      "decision_pattern": "same_day_morning",
      "decision_windows": [
        {
          "description": "Friday-Saturday morning decision for weekend brunch",
          "days": ["Friday", "Saturday"],
          "hours": "08:00-10:30",
          "conversion_strength": "medium"
        }
      ],
      "typical_lead_time": "same day",
      "post_timing_rules": [
        {
          "timing": "Friday 09:00",
          "purpose": "Weekend preview + inspiration",
          "priority": "recommended"
        },
        {
          "timing": "Saturday 09:00",
          "purpose": "Day-of reminder for spontaneous visits",
          "priority": "optional"
        }
      ],
      "content_focus": ["brunch_menu", "weekend_atmosphere", "social_gathering"]
    },
    {
      "moment_id": "weekday_lunch",
      "label": "Frokost i hverdagene",
      "importance": "primary",
      "service_type": "lunch",
      "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "time_range": "11:30-14:00",
      "decision_pattern": "same_day_morning",
      "decision_windows": [
        {
          "description": "Morning decision for lunch plans",
          "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          "hours": "08:00-11:00",
          "conversion_strength": "medium"
        }
      ],
      "typical_lead_time": "same day",
      "post_timing_rules": [
        {
          "timing": "Monday 09:00",
          "purpose": "Start week lunch visibility",
          "priority": "recommended"
        },
        {
          "timing": "Wednesday 09:00",
          "purpose": "Maintain mid-week presence",
          "priority": "optional"
        }
      ],
      "content_focus": ["lunch_menu", "quick_service", "convenience"]
    },
    {
      "moment_id": "evening_dining",
      "label": "Aftensmad",
      "importance": "primary",
      "service_type": "dinner",
      "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      "time_range": "17:30-21:30",
      "decision_pattern": "same_day_afternoon",
      "decision_windows": [
        {
          "description": "Thursday-Friday afternoon planning for weekend dining",
          "days": ["Thursday", "Friday"],
          "hours": "14:00-18:00",
          "conversion_strength": "high"
        },
        {
          "description": "Same-day afternoon decision for weekday dining",
          "days": ["Monday", "Tuesday", "Wednesday", "Thursday"],
          "hours": "14:00-18:00",
          "conversion_strength": "medium"
        }
      ],
      "typical_lead_time": "same day to 24 hours",
      "post_timing_rules": [
        {
          "timing": "Thursday 14:00",
          "purpose": "Prime weekend dinner intent for Fri-Sat",
          "priority": "required"
        },
        {
          "timing": "Friday 14:00",
          "purpose": "Drive Saturday bookings + Friday same-day",
          "priority": "required"
        }
      ],
      "content_focus": ["dinner_menu", "atmosphere", "reservation_cta"]
    }
  ],
  "secondary_revenue_moments": [],
  "preferred_day_pattern": ["Monday", "Wednesday", "Thursday", "Friday", "Saturday"],
  "normal_week_strategy": {
    "minimum_coverage": {
      "weekend_driver_posts": 2,
      "weekday_presence_posts": 1,
      "brand_builder_posts": 1
    },
    "preferred_days": ["Monday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "rationale": "3 primary revenue moments (Brunch, Frokost, Aften) require non-competing posting windows. Monday starts week with lunch visibility, Wednesday maintains weekday presence, Thursday captures weekend dinner bookings, Friday bridges weekend brunch + dinner, Saturday reinforces weekend presence."
  }
}

CONFIDENCE SCORE GUIDANCE:
- 90-100: Clear time slots mentioned, hybrid clearly stated
- 70-89: Can infer most patterns from description
- 50-69: Sparse description, mainly inferred
- <50: Insufficient data

Be specific and practical. Output ONLY valid JSON, no markdown formatting.`
}
