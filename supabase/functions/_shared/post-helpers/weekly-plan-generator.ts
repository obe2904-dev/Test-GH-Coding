/**
 * LAYER 9: WEEKLY CONTENT PLAN GENERATOR
 * Assembles complete weekly plans from Layers 5-8
 * 
 * TWO MODES:
 * A) With Layer 0 strategy (preferred): Strategy ideas → Layer 6 timing → Layer 7* format → Layer 8 caption
 *    *Layer 7 is guided by Layer 0's suggested_media and platforms, not independent
 * B) Without strategy (legacy): Layer 5 scoring → Layer 6 timing → Layer 7 format → Layer 8 caption
 */

import { optimizeWeeklySchedule } from './post-slot-optimizer.ts'
import { assembleContentBrief } from './content-brief-assembler.ts'
import { filterAudienceLabels } from '../utils/audience-filter.ts'
import { detectServicePeriod } from '../content-planning/service-period-detector.ts'
import { matchTimingToSegment } from '../utils/segment-timing-matcher.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import type { 
  WeeklyStrategy, 
  PostIdea, 
  StrategicPriority, 
  StrategyNarrative,
  Platform, 
  SubscriptionTier,
  SuggestedMediaType,
  CTAIntent 
} from './types/strategy-types.ts'

// ============================================================================
// TYPES
// ============================================================================

export interface PostSpecification {
  // Selection Rationale - Why this post was chosen
  selectionRationale?: string
  
  // Timing
  timing: {
    day: string
    date: string
    time: string
    rationale: string
    timingRationale?: string  // AI timing reasoning from Phase 2b
  }
  
  // Platform & Format
  platformFormat: {
    platform: string
    format: string
    platformRationale: string
    formatRationale: string
  }
  
  // Post Type
  postType: {
    type: string
    category: string
    goal_mode?: 'drive_footfall' | 'build_brand' | 'retain_loyalty'
    priority: 'High' | 'Medium' | 'Low'
    priorityReasons: string[]
  }
  
  // Content Subject
  contentSubject: {
    dish: string
    whyThisDish: string[]
    menuItemId?: string           // UUID for direct lookup in menu_items_normalized
    menuItemName?: string          // exact DB item name (when menu post)
    menuItemDescription?: string  // DB item description (when menu post)
  }
  
  // Opportunity (scoring data for analytics)
  opportunity?: {
    finalScore: number
    scoreBreakdown: {
      baseScore: number
      seasonalBonus: number
      weatherBonus: number
      locationBonus: number
      performanceBonus: number
      recencyPenalty: number
    }
    selectionReason: string
    timingReason?: string  // AI timing reasoning from Phase 2b
  }
  
  // Caption
  caption: {
    text: string
    characterCount: number
    tone: string
    emojiCount: number
    ctaType: string
    firstLine: string
    hashtags?: string[]
    isAIGenerated?: boolean
    aiMetadata?: {
      model: string
      generationTime?: number
      tone?: string
      qualityScore?: number
    }
  }
  
  // Visual Direction
  visualDirection: {
    subject: string
    angle: string
    setting: string
    lighting: string
    styling: string
    context: string
    technicalSpecs: {
      dimensions: string
      aspectRatio: string
      fileFormat: string
      duration?: string
      videoCodec?: string
      frameRate?: string
    }
    altText: string
    sceneBreakdown?: {
      scene: number
      duration: string
      action: string
    }[]
  }
  
  // Production Notes
  productionNotes: {
    estimatedTime: string
    logistics: string[]
    timing?: string
  }
  
  // Alternatives
  alternatives: {
    priority: number
    description: string
  }[]
  
  // Media Management
  media: {
    status: 'pending' | 'uploaded' | 'approved' | 'rejected'
    uploadedFiles: {
      url: string
      uploadedAt: string
      uploadedBy: string
    }[]
    selectedFile?: string
    photographerBrief?: string
  }
  
  // Approval Status
  approval: {
    status: 'draft' | 'approved' | 'scheduled' | 'posted'
    approvedAt?: string
    approvedBy?: string
    scheduledFor?: string
    postedAt?: string
    editHistory: {
      field: string
      oldValue: string
      newValue: string
      editedAt: string
      editedBy: string
    }[]
  }

  // Layer 0 strategic context (NEW - present when strategy-driven)
  strategicContext?: {
    cta_intent: CTAIntent
    suggested_media: PostIdea['suggested_media']
    strategic_fit: number
    weather_dependent: boolean
    weather_flag?: string
    estimated_performance: 'high' | 'medium' | 'low'
    // Goal-mode system
    goal_mode?: 'drive_footfall' | 'build_brand' | 'retain_loyalty'
    content_category?: 'product_menu' | 'craving_visual' | 'behind_scenes' | 'team_people'
    slot_id?: string
    rationale?: string  // raw Phase 2b rationale — used as captionBase in generate-text-from-idea
    owner_note_applied?: boolean
    drink_pairing?: string | null
    strategy_brief?: string | null  // Phase 2b compact directive for caption AI: what to achieve + weather/timing/role context
    media_direction?: string | null
    scene_spec?: string | null
    // Strategic intent — carries the Phase 1 narrative purpose of this post through to
    // the plan generator and caption prompt so the cross-day booking/occasion logic is
    // never lost in translation between phases.
    strategic_intent?: string | null
    // Booking nudge display metadata (optional — only present on booking nudge posts)
    // Surfaced in Weekly Plan UI to show why nudge exists and what day it targets
    nudge_rationale?: string | null
    peak_day?: string | null                    // ISO date of targeted visit day
    lead_days_used?: number | null              // 1-5: actual lead time chosen by AI
    booking_nudge_warranted?: boolean | null    // AI decision this week
  }

  // Segment coverage context (NEW - June 27, 2026)
  // Indicates whether this post targets a strategic audience segment or gap-time capacity
  segmentCoverage?: {
    mode: 'strategic_segment' | 'gap_capacity'  // Strategic segment match or gap-time capacity
    matchedSegment?: {
      people_type: string                        // e.g., "Familier", "Par", "Vennegrupper"
      timing: string                             // e.g., "Lør-Søn 17:00-20:00"
      situation?: string                         // e.g., "Familier med børn der spiser middag i weekenden"
    }
    gapRationale?: string                        // Only for gap_capacity: why format appeal is used instead
  }

  // Frontend compatibility fields (flattened for easier access)
  idea_id?: number
  title?: string
  cta_text?: string
  visual_direction?: string
  suggested_day?: string
  suggested_post_time?: string

  // Holiday context (present when post falls on a public holiday)
  holiday_context?: {
    name: string
    strategic_angle: string
    marketing_hook?: string
  }
}

export interface WeeklyContentPlan {
  id: string
  userId: string
  businessId: string
  
  // Week metadata
  weekNumber: number
  weekStart: string
  weekEnd: string
  generatedAt: string
  
  // Strategy reference (NEW - present when strategy-driven)
  strategyId?: string
  strategyNarrative?: StrategyNarrative
  strategicPriorities?: StrategicPriority[]
  
  // Posts
  posts: PostSpecification[]
  
  // Summary
  summary: {
    totalPosts: number
    totalProductionTime: string
    postsByPlatform: Record<string, number>
    postsByFormat: Record<string, number>
  }
  
  // Learning data
  learningData?: {
    userEdits: number
    captionEditsCount: number
    timingChangesCount: number
    platformSwapsCount: number
  }
}

interface GenerationInput {
  userId: string
  businessId: string
  weekStart: Date
  businessType: string
  
  // ✨ Layer 1 data
  brandProfile?: any
  businessProfile?: any
  businessOps?: any
  locationIntel?: any
  menuItems?: any[]
  platforms?: string[]
  previousPlans?: any[]

  // ✨ Layer 0 strategy (NEW)
  // When present, Layer 5 is skipped. Strategy ideas drive the entire plan.
  strategy?: WeeklyStrategy
  strategyId?: string           // UUID from weekly_strategies table
  selectedIdeaIds?: number[]    // Which ideas the user selected. If omitted, all ideas are used.

  // ✨ Tier / post count (passed from edge function)
  subscriptionTier?: 'smart' | 'pro'
  targetPostCount?: number      // Pro: user-selected; Smart: always capped at 4

  // ✨ Holiday events from week_context_snapshot (for holiday-aware PostSpecification annotations)
  contextEvents?: Array<{type: string; date: string; date_end?: string; name: string; name_dk: string; strategic_angle: string; marketing_hook?: string}>
}

// ============================================================================
// WEEK CALCULATION
// ============================================================================

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const daysSinceStart = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  return Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7)
}

function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  return end
}

function formatDate(date: Date): string {
  const months = [
    'januar', 'februar', 'marts', 'april', 'maj', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'december'
  ]
  return `${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

// ============================================================================
// PRIORITY CALCULATION
// ============================================================================

function convertTimeToCategory(time: string): 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'evening' {
  const hour = parseInt(time.split(':')[0])
  
  if (hour >= 6 && hour < 10) return 'morning'
  if (hour >= 10 && hour < 14) return 'lunch'
  if (hour >= 14 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 20) return 'dinner'
  return 'evening'
}

/**
 * Convert Danish day name to English (for segment timing matcher)
 */
function convertDanishDayToEnglish(danishDay: string): string {
  const dayMap: Record<string, string> = {
    'Mandag': 'Monday',
    'Tirsdag': 'Tuesday',
    'Onsdag': 'Wednesday',
    'Torsdag': 'Thursday',
    'Fredag': 'Friday',
    'Lørdag': 'Saturday',
    'Søndag': 'Sunday',
  }
  return dayMap[danishDay] || danishDay
}

/**
 * Calculate priority from Layer 0 PostIdea (strategic context)
 * Uses estimated_performance and strategic_fit instead of raw scores
 */
function calculatePriorityFromIdea(idea: PostIdea): {
  priority: 'High' | 'Medium' | 'Low'
  reasons: string[]
} {
  const reasons: string[] = []
  
  // Performance estimate from Layer 0
  if (idea.estimated_performance === 'high') {
    reasons.push('høj forventet performance')
  }
  
  // Strategic fit
  if (idea.strategic_fit >= 0.8) {
    reasons.push('stærk strategisk fit')
  }
  
  // Weather awareness
  if (idea.weather_dependent) {
    reasons.push('vejrafhængig (tjek vejrudsigt)')
  }
  
  // CTA-driven
  if (idea.cta_intent === 'booking') {
    reasons.push('booking-drivende')
  } else if (idea.cta_intent === 'event_promo') {
    reasons.push('event-promotion')
  }
  
  // Map to priority
  if (idea.estimated_performance === 'high' && idea.strategic_fit >= 0.8) {
    return { priority: 'High', reasons }
  }
  if (idea.estimated_performance === 'high' || idea.strategic_fit >= 0.6) {
    return { priority: 'Medium', reasons }
  }
  return { priority: 'Low', reasons }
}

// ============================================================================
// ALTERNATIVES GENERATOR
// ============================================================================

/**
 * Generate alternatives from Layer 0 ideas (the non-selected ones)
 */
function generateAlternativesFromIdeas(
  currentIdea: PostIdea, 
  allIdeas: PostIdea[]
): { priority: number; description: string }[] {
  return allIdeas
    .filter(idea => idea.id !== currentIdea.id)
    .filter(idea => idea.content_type === currentIdea.content_type)
    .slice(0, 3)
    .map((idea, index) => ({
      priority: index + 1,
      description: `Alternative: ${idea.title} — ${idea.rationale}`,
    }))
}

// ============================================================================
// PRODUCTION LOGISTICS GENERATOR
// ============================================================================

function generateLogistics(contentType: string, format: string, subject: string): string[] {
  const logistics: string[] = []
  
  const normalizedType = contentType.replace('_item', '_highlight').replace('_experience', '')
  
  if (normalizedType === 'menu_highlight' || contentType === 'menu_item') {
    logistics.push('Plate dish fresh during service')
    logistics.push('Ensure good natural light')
    if (format === 'photo') {
      logistics.push('Have backup props ready (wine glass, water carafe)')
    }
  }
  
  if (normalizedType === 'behind_scenes') {
    logistics.push('Coordinate with kitchen during prep time')
    logistics.push('Get chef permission for filming')
    if (format === 'carousel' || format === 'reel') {
      logistics.push('Allow 15-20 minutes for multiple shots')
    }
  }
  
  if (normalizedType === 'atmosphere' || contentType === 'atmosphere_experience') {
    logistics.push('Shoot during actual service (guests present)')
    logistics.push('Request customer consent if visible')
    logistics.push('Time for golden hour if outdoor')
  }
  
  if (format === 'reel') {
    logistics.push('Stabilize camera or use tripod')
    logistics.push('Capture natural ambient sound')
  }
  
  return logistics
}

/**
 * Enhanced logistics that incorporate Layer 0's media direction
 */
function generateLogisticsFromIdea(idea: PostIdea): string[] {
  const base = generateLogistics(
    idea.content_type, 
    mapMediaTypeToFormat(idea.suggested_media.type),
    idea.title
  )
  
  // Add Layer 0's creative direction as a logistics note
  if (idea.suggested_media.direction) {
    base.unshift(`📸 ${idea.suggested_media.direction}`)
  }
  
  // Add photo count guidance
  if (idea.suggested_media.type === 'photo_reel' && idea.suggested_media.photo_count) {
    base.push(`Tag ${idea.suggested_media.photo_count} fotos — systemet laver reel automatisk`)
  }
  if (idea.suggested_media.type === 'carousel' && idea.suggested_media.photo_count) {
    base.push(`Tag ${idea.suggested_media.photo_count} fotos til carousel`)
  }
  
  return base
}

// ============================================================================
// LAYER 0 → LAYER 6-8 MAPPING
// ============================================================================

/**
 * Map Layer 0 SuggestedMediaType to Layer 7 format string
 * photo_reel → reel (FFmpeg handles the conversion)
 */
function mapMediaTypeToFormat(mediaType: SuggestedMediaType): string {
  switch (mediaType) {
    case 'photo_reel': return 'reel'
    case 'photo': return 'photo'
    case 'carousel': return 'carousel'
    default: return 'photo'
  }
}

/**
 * Infer goal_mode and content_category from legacy content_type.
 * Used in Path B (no Layer 0 strategy) so phase2b CTA + signals still fire.
 */
function inferGoalModeFromContentType(contentType: string): {
  goal_mode: 'drive_footfall' | 'build_brand' | 'retain_loyalty';
  content_category: 'product_menu' | 'craving_visual' | 'behind_scenes' | 'team_people';
} {
  switch (contentType) {
    case 'menu_item':
    case 'promotional':
      return { goal_mode: 'drive_footfall', content_category: 'product_menu' }
    case 'seasonal':
    case 'event':
    case 'atmosphere':
      return { goal_mode: 'drive_footfall', content_category: 'craving_visual' }
    case 'behind_scenes':
      return { goal_mode: 'build_brand', content_category: 'behind_scenes' }
    default:
      return { goal_mode: 'drive_footfall', content_category: 'product_menu' }
  }
}

/**
 * Derive a legacy-compatible { tone, emoji_frequency } struct from the actual brand profile.
 * The content-brief-assembler uses this for visual direction labels (photo shoot style).
 * `brand_voice` column does not exist in DB — we derive tone from tone_model instead.
 */
function deriveBrandVoiceCompat(brandProfile: any): {
  tone: 'casual' | 'refined' | 'playful' | 'professional'
  emoji_frequency: 'none' | 'minimal' | 'moderate' | 'frequent'
} {
  const tm = brandProfile?.tone_model as any
  const tov = brandProfile?.tone_of_voice as any

  // Derive tone from tone_model.formality (v5) or legacy brand_voice
  let tone: 'casual' | 'refined' | 'playful' | 'professional' = 'casual'
  const formality = String(tm?.formality || '').toLowerCase()
  if (formality.includes('formal') || formality.includes('refined') || formality.includes('højtidelig')) {
    tone = 'refined'
  } else if (formality.includes('playful') || formality.includes('fun') || formality.includes('legende')) {
    tone = 'playful'
  } else if (formality.includes('professional') || formality.includes('business')) {
    tone = 'professional'
  }

  // Derive emoji_frequency from tone_model.emoji_level or legacy tov.emoji_frequency
  let emoji_frequency: 'none' | 'minimal' | 'moderate' | 'frequent' = 'moderate'
  const emojiLevel = String(tm?.emoji_level || tov?.emoji_frequency || 'moderate').toLowerCase()
  if (emojiLevel === 'none') emoji_frequency = 'none'
  else if (emojiLevel === 'minimal' || emojiLevel === 'low') emoji_frequency = 'minimal'
  else if (emojiLevel === 'frequent' || emojiLevel === 'high') emoji_frequency = 'frequent'

  return { tone, emoji_frequency }
}

/**
 * Map CTA intent to a descriptive CTA type for the caption
 */
function mapCTAIntentToType(ctaIntent: CTAIntent, platforms: Platform[]): string {
  const isInstagramOnly = platforms.length === 1 && platforms[0] === 'instagram'
  
  switch (ctaIntent) {
    case 'booking':
      return isInstagramOnly ? 'booking (link i bio)' : 'booking (direkte link)'
    case 'engagement':
      return 'engagement (spørgsmål/kommentar)'
    case 'awareness':
      return 'awareness (del/gem)'
    case 'event_promo':
      return 'event promotion'
    case 'traffic':
      return isInstagramOnly ? 'traffic (link i bio)' : 'traffic (direkte link)'
    default:
      return 'soft CTA'
  }
}

/**
 * Map a Layer 0 PostIdea into the enrichedSlot format that Layers 6-8 expect.
 * This is the critical bridge between strategic planning and content execution.
 * 
 * ✨ CRITICAL: Fetches menu item descriptions for accurate caption generation
 */
async function mapIdeaToEnrichedSlot(
  idea: PostIdea,
  weekStart: Date,
  brandProfile: any,
  locationIntel: any,
  businessId: string,
  supabaseClient: SupabaseClient,
  maxMenuPrice: number | null = null,
  strategy?: any
) {
  // Parse as local date to avoid UTC-midnight shift (e.g. "2026-03-02" → UTC midnight = Mar 1 23:00 in UTC+1)
  const [_yr, _mo, _dy] = idea.suggested_day.split('-').map(Number)
  const suggestedDate = new Date(_yr, _mo - 1, _dy)
  const dayOfWeek = (suggestedDate.getDay() + 6) % 7 // Mon=0 … Sun=6 (matches optimizer offset convention)
  
  // ✨ TIMING INTELLIGENCE: Use context-driven timing if available
  const timingIntelligence = (idea as any).timing_intelligence
  let hour: number
  let timingRationale: string | undefined
  
  if (timingIntelligence?.suggested_post_time) {
    hour = parseInt(timingIntelligence.suggested_post_time.split(':')[0])
    timingRationale = timingIntelligence.timing_rationale
    console.log(`[WeeklyPlan] ⏰ Using timing intelligence for "${idea.title}": ${timingIntelligence.suggested_post_time} (${timingRationale})`)
  } else {
    hour = parseInt(idea.suggested_time.split(':')[0])
    console.log(`[WeeklyPlan] ⏰ Using default timing for "${idea.title}": ${idea.suggested_time}`)
  }
  
  // Build location context from available data
  // Note: DB columns are area_type (not location_type) and location_marketing_hooks (not location_amplifiers)
  const rawAreaType = (locationIntel?.area_type as string | undefined) || 'city_center'
  const normalisedAreaType = rawAreaType === 'city_centre' ? 'city_center' : rawAreaType
  // Derive permitted audience types via shared filter (price-gated, same logic as Brand Profile)
  const _categoryScores = (locationIntel?.category_scores as Record<string, number>) ?? {}
  const { permittedKeys: _permittedKeys } = filterAudienceLabels(_categoryScores, maxMenuPrice)
  const _secondaryTypes = _permittedKeys.map(k => k === 'city_centre' ? 'city_center' : k)
  const locationContextData = {
    type: normalisedAreaType as 'waterfront' | 'city_center' | 'historic' | 'residential' | 'suburban',
    amplifiers: (locationIntel?.location_marketing_hooks as string[] | undefined) || [],
    secondary_types: _secondaryTypes,
  }
  
  // Build seasonal context from the week start month
  const month = weekStart.getMonth() + 1
  const seasonMap: Record<number, 'spring' | 'summer' | 'fall' | 'winter'> = {
    12: 'winter', 1: 'winter', 2: 'winter',
    3: 'spring', 4: 'spring', 5: 'spring',
    6: 'summer', 7: 'summer', 8: 'summer',
    9: 'fall', 10: 'fall', 11: 'fall',
  }
  
  // ✨ Extract weather from strategy snapshot (Open-Meteo) instead of separate OpenWeatherMap fetch
  // The strategy's week_context_snapshot.weather.days contains detailed forecast for the week
  const strategyWeatherDays = (strategy as any)?.week_context_snapshot?.weather?.days || []
  const dayForecast = strategyWeatherDays.find((d: any) => d.date === idea.suggested_day)
  
  const seasonalContextData = {
    season: seasonMap[month] || 'spring',
    weather: dayForecast?.condition || undefined,
    temperature: dayForecast ? `${dayForecast.temp_max}°C` : undefined,
  }

  // ✨ NEW: Fetch menu item description for menu_item / product_menu content type
  // Also handles behind_scenes posts when phase2b has identified a specific dish being prepared
  // This prevents AI hallucination by providing actual dish details
  let menuItemData: any = undefined
  const behindScenesMenuItemUsed: string = (idea as any).menu_item_used || ''
  if (idea.content_type === 'menu_item' || idea.content_type === 'product_menu' || idea.content_type === 'craving_visual' || behindScenesMenuItemUsed) {
    // Extract dish name: prefer menu_item_used (original DB name), fall back to title.
    // menu_item_used is the canonical name from Phase 2b — title may be enriched with category suffix.
    const rawDishName = behindScenesMenuItemUsed || (idea as any).menu_item_used || idea.title
    const dishName = rawDishName
      .split(/[:\-–]/)[0]
      .split(/,\s+(?=[a-zæøå])/)[0]
      .trim()
    
    // ── Derive service period from suggested_time for UUID disambiguation ──────────
    // When multiple menu items share the same name (e.g., lunch vs dinner FAUSTBURGER),
    // we need service_period filtering to match the correct variant
    let derivedServicePeriod: string | null = null
    try {
      const servicePeriodResult = await detectServicePeriod(supabaseClient, businessId, idea.suggested_time)
      derivedServicePeriod = servicePeriodResult.currentPeriod
      console.log(`[WeeklyPlan] 🍽️ Derived service period for "${dishName}" at ${idea.suggested_time}: ${derivedServicePeriod || 'unknown'}`)
    } catch (err) {
      console.warn(`[WeeklyPlan] ⚠️ Failed to detect service period for ${idea.suggested_time}:`, err)
    }
    
    // Priority cascade: exact (case-insensitive) → starts-with → contains (confidence-gated)
    // Avoids broad substring matches that return wrong dish descriptions (e.g., "Bøf" matching 4 dishes)
    // NOW WITH SERVICE PERIOD FILTERING to ensure correct UUID when duplicates exist
    const menuSelect = 'id, item_name, item_description, item_price, category_name, service_periods'
    
    // Helper: add service period filter to query if available
    const addServicePeriodFilter = (query: any) => {
      if (derivedServicePeriod) {
        return query.contains('service_periods', [derivedServicePeriod])
      }
      return query
    }
    
    let queryBuilder = supabaseClient
      .from('menu_items_normalized')
      .select(menuSelect)
      .eq('business_id', businessId)
      .ilike('item_name', dishName)
    queryBuilder = addServicePeriodFilter(queryBuilder)
    const { data: exactMatch } = await queryBuilder
      .limit(1)
      .maybeSingle()
    if (exactMatch) {
      menuItemData = exactMatch
      console.log(`[WeeklyPlan] ✅ Exact match with service_period filter: "${dishName}" → "${exactMatch.item_name}" (${derivedServicePeriod || 'no filter'})`)
    } else {
      // Fallback: starts-with match (with service period filter if available)
      let startsQueryBuilder = supabaseClient
        .from('menu_items_normalized')
        .select(menuSelect)
        .eq('business_id', businessId)
        .ilike('item_name', `${dishName}%`)
      startsQueryBuilder = addServicePeriodFilter(startsQueryBuilder)
      const { data: startsWithMatch } = await startsQueryBuilder
        .limit(1)
        .maybeSingle()
      if (startsWithMatch) {
        menuItemData = startsWithMatch
        console.log(`[WeeklyPlan] ✅ Starts-with match: "${dishName}" → "${startsWithMatch.item_name}" (${derivedServicePeriod || 'no filter'})`)
      } else {
        // Fallback: contains match (with service period filter if available)
        let containsQueryBuilder = supabaseClient
          .from('menu_items_normalized')
          .select(menuSelect)
          .eq('business_id', businessId)
          .ilike('item_name', `%${dishName}%`)
        containsQueryBuilder = addServicePeriodFilter(containsQueryBuilder)
        const { data: containsMatch } = await containsQueryBuilder
          .limit(1)
          .maybeSingle()
        if (containsMatch) {
          const matchRatio = dishName.length / containsMatch.item_name.length
          if (matchRatio >= 0.4) {
            menuItemData = containsMatch
          } else {
            console.warn(`[WeeklyPlan] ⚠️ Low-confidence match "${dishName}" → "${containsMatch.item_name}" (ratio ${matchRatio.toFixed(2)}) — ignored`)
          }
        }
        
        // Fallback: word-boundary search — dishName as complete word in item_name
        // Handles "Klassisk Pariserbøf med..." when searching for "Pariserbøf"
        if (!menuItemData) {
          let wordQueryBuilder = supabaseClient
            .from('menu_items_normalized')
            .select(menuSelect)
            .eq('business_id', businessId)
            .or(`item_name.ilike.% ${dishName} %,item_name.ilike.% ${dishName},item_name.ilike.${dishName} %`)
          wordQueryBuilder = addServicePeriodFilter(wordQueryBuilder)
          const { data: wordMatch } = await wordQueryBuilder
            .limit(1)
            .maybeSingle()
          if (wordMatch) {
            menuItemData = wordMatch
            console.log(`[WeeklyPlan] ✅ Word-boundary match: "${dishName}" → "${wordMatch.item_name}" (${derivedServicePeriod || 'no filter'})`)
          }
        }
        
        // Fallback: search in description if name matching fails entirely
        // Handles cases where phase2b used a descriptive title not matching item_name
        if (!menuItemData) {
          let descQueryBuilder = supabaseClient
            .from('menu_items_normalized')
            .select(menuSelect)
            .eq('business_id', businessId)
            .ilike('item_description', `%${dishName}%`)
          descQueryBuilder = addServicePeriodFilter(descQueryBuilder)
          const { data: descMatch } = await descQueryBuilder
            .limit(1)
            .maybeSingle()
          if (descMatch) {
            menuItemData = descMatch
            console.log(`[WeeklyPlan] ✅ Description match: "${dishName}" found in "${descMatch.item_name}" (${derivedServicePeriod || 'no filter'})`)
          }
        }
      }
    }
    // Log outcome (phase2b fallback data will be used if DB lookup fails — see rawData below)
    if (menuItemData) {
      console.log(`[WeeklyPlan] ✅ Fetched menu description for "${menuItemData.item_name}": ${menuItemData.item_description?.substring(0, 80)}...`)
    } else if ((idea as any).menu_item_description) {
      console.log(`[WeeklyPlan] ℹ️ Using phase2b description for "${dishName}" (no DB match, fallback available)`)
    } else {
      console.warn(`[WeeklyPlan] ⚠️ No menu item found for dish name: "${dishName}"`)
    }
  }
  
  return {
    slotId: `layer0-idea-${idea.id}`,
    contentType: idea.content_type,
    platform: idea.platforms[0] || 'instagram', // Primary platform
    dayOfWeek,
    hour,
    
    // The opportunity object that Layers 6-8 consume
    opportunity: {
      subject: idea.title,
      contentType: idea.content_type,
      score: Math.round(idea.strategic_fit * 100), // 0.0-1.0 → 0-100
      reason: idea.rationale,
      brandVoice: deriveBrandVoiceCompat(brandProfile),
      seasonalContext: seasonalContextData,
      locationContext: locationContextData,
      rawData: {
        // Preserve Layer 0 metadata for downstream use
        layer0_idea: idea,
        scoreBreakdown: {
          baseScore: Math.round(idea.strategic_fit * 100),
          seasonalBonus: 0,  // Already factored into strategic_fit
          weatherBonus: 0,
          locationBonus: 0,
          performanceBonus: 0,
          recencyPenalty: 0,
        },
        selectionReason: idea.rationale,
        
        // ✨ NEW: Add menu item details for AI caption generation
        // DB lookup is the primary source; idea.menu_item_description (from phase2b AI) is the fallback
        ...(menuItemData ? {
          itemId: menuItemData.id,  // UUID for ID-based lookup (eliminates name-matching fragility)
          itemName: menuItemData.item_name,
          description: menuItemData.item_description || (idea as any).menu_item_description || '',
          price: menuItemData.item_price || '',
          category: menuItemData.category_name || '',
        } : (behindScenesMenuItemUsed ? {
          // behind_scenes with menu_item_used but no DB match — use phase2b data directly
          itemName: behindScenesMenuItemUsed,
          description: (idea as any).menu_item_description || '',
        } : ((idea as any).menu_item_description ? {
          itemName: (idea as any).menu_item_used || (idea as any).title || '',
          description: (idea as any).menu_item_description,
        } : {}))),
      },
    },
    
    // Layer 0 extras (not in legacy format, used for enhanced processing)
    layer0: {
      id: idea.id,  // ✨ CRITICAL: Preserve idea ID for tracking executed ideas
      cta_intent: idea.cta_intent,
      suggested_media: idea.suggested_media,
      platforms: idea.platforms,
      weather_dependent: idea.weather_dependent,
      weather_flag: idea.weather_flag,
      estimated_performance: idea.estimated_performance,
      strategic_fit: idea.strategic_fit,
      // ✨ Goal-mode system — drives CTA routing in prompt-builder
      goal_mode: (idea as any).goal_mode,
      content_category: (idea as any).content_category,
      slot_id: (idea as any).slot_id,
      owner_note_applied: (idea as any).owner_note_applied ?? false,
      drink_pairing: (idea as any).drink_pairing ?? null,
      // Strategic intent — carries Phase 1 narrative to caption prompt (booking, occasion, etc.)
      strategic_intent: (idea as any).strategic_intent ?? null,
      // Booking nudge display metadata — carried from Phase 1 judgment block
      nudge_rationale: (idea as any).nudge_rationale ?? null,
      peak_day: (idea as any).peak_day ?? null,
      lead_days_used: (idea as any).lead_days_used ?? null,
      booking_nudge_warranted: (idea as any).booking_nudge_warranted ?? null,
      // ✨ TIMING INTELLIGENCE: Context-driven timing rationale
      timing_rationale: timingRationale ?? null,
    }
  }
}

// ============================================================================
// MAIN WEEKLY PLAN GENERATOR
// ============================================================================

export async function generateWeeklyPlan(
  input: GenerationInput,
  supabaseClient: SupabaseClient
): Promise<WeeklyContentPlan> {
  const { 
    userId, 
    businessId, 
    weekStart, 
    businessType, 
    brandProfile, 
    businessProfile,
    businessOps,
    locationIntel,
    platforms,
    menuItems,
    strategy,
    strategyId,
    selectedIdeaIds,
  } = input

  const contextEvents = input.contextEvents ?? []

  // Build a set of recently featured dish keywords from previous plans (variation tracking).
  // A dish keyword featured in the last 3 weeks gets a warning flag in selectionRationale.
  const recentlyFeaturedDishes = new Set<string>()
  for (const plan of (input.previousPlans || [])) {
    for (const item of (plan.featuredDishes || [])) {
      if (item.dish) recentlyFeaturedDishes.add(item.dish.toLowerCase().split(/[\s:]/)[0])
    }
  }
  if (recentlyFeaturedDishes.size > 0) {
    console.log('[WeeklyPlan] Recently featured dish keywords:', [...recentlyFeaturedDishes])
  }

  if (!strategy || !strategy.post_ideas?.length) {
    throw new Error('[WeeklyPlan] strategy with post_ideas is required — legacy Path B has been removed')
  }

  console.log('[WeeklyPlan] 🎯 Using Layer 0 strategy path')
  console.log('[WeeklyPlan] Strategy:', {
    week_number: strategy.week_number,
    total_ideas: strategy.post_ideas.length,
    selected_ids: selectedIdeaIds || 'all',
    platforms: strategy.platforms,
    tier: strategy.subscription_tier,
  })
  
  // Calculate week metadata
  const weekNumber = getWeekNumber(weekStart)
  const weekEnd = getWeekEnd(weekStart)
  
  // ========================================================================
  // PATH A: Layer 0 Strategy → Layer 6 → Layer 7* → Layer 8
  // ========================================================================
  
  let enrichedSlots: any[]
  let allIdeas: PostIdea[] = []
  
  // Filter to selected ideas (or use all if no selection)
  allIdeas = selectedIdeaIds 
    ? strategy.post_ideas.filter(idea => selectedIdeaIds.includes(idea.id))
    : strategy.post_ideas
  
  // Validate that selected IDs actually matched strategy ideas
  if (selectedIdeaIds && allIdeas.length === 0) {
    const availableIds = strategy.post_ideas.map(i => i.id).join(', ')
    throw new Error(
      `None of the selected idea IDs matched strategy ideas. ` +
      `Selected: [${selectedIdeaIds.join(', ')}]. Available: [${availableIds}]`
    )
  }
  
  // Safety check: strategy should never be empty at this point
  if (allIdeas.length === 0) {
    throw new Error('[WeeklyPlan] Strategy has no post_ideas to execute')
  }
  
  console.log('[WeeklyPlan] Processing', allIdeas.length, 'selected ideas:', 
    allIdeas.map(i => `#${i.id}: ${i.title}`))
  
  // Map Layer 0 ideas to enriched slot format (async to fetch menu descriptions)
  const _maxMenuPrice = menuItems && menuItems.length > 0
    ? (menuItems.map((m: any) => parseFloat(m.price || '')).filter((p: number) => !isNaN(p) && p > 0).sort((a: number, b: number) => b - a)[0] ?? null)
    : null
  enrichedSlots = await Promise.all(
    allIdeas.map(idea =>
      mapIdeaToEnrichedSlot(idea, weekStart, brandProfile, locationIntel, businessId, supabaseClient, _maxMenuPrice, strategy)
    )
  )
  

    // ========================================================================
  // LAYER 6: Optimize timing (both paths)
  // ========================================================================
  
  const layer6Input = {
    businessId,
    weekStartDate: weekStart,
    slots: enrichedSlots.map(slot => ({
      contentType: slot.contentType,
      opportunity: slot.opportunity,
      score: slot.opportunity.score,
      platform: slot.platform,
      dayOfWeek: slot.dayOfWeek,
      hour: slot.hour,
      // Pass Layer 0's strategic day through so optimizer doesn't override it
      layer0Day: slot.dayOfWeek,
      // Pass Layer 0's suggested time so optimizer uses it directly (Step 1)
      layer0Hour: slot.hour,
      // Pass CTA intent so optimizer can apply timing rules when no explicit hour (Step 3)
      ctaIntent: slot.layer0?.cta_intent ?? undefined,
    }))
  }
  
  const weeklySchedule = await optimizeWeeklySchedule(layer6Input, supabaseClient)
  
  // ========================================================================
  // LAYERS 7-8: Format selection + Caption generation (per post)
  // ========================================================================
  
  const posts: PostSpecification[] = []
  const usedOpenersThisPlan: string[] = [] // Anti-repetition: track first-line openers across the plan
  
  // CRITICAL FIX: Match enrichedSlots to optimizedSlots using originalIndex (preserved before sort)
  // This prevents day-swapping bug when optimizer sorts slots chronologically
  for (let i = 0; i < enrichedSlots.length; i++) {
    const enrichedSlot = enrichedSlots[i]
    const opportunity = enrichedSlot.opportunity
    const optimizedSlot = weeklySchedule.slots.find((s: any) => s.originalIndex === i)
    if (!optimizedSlot) {
      console.error(`[WeeklyPlan] ❌ No optimized slot found for enrichedSlot index ${i}`)
      continue
    }
    const layer0 = enrichedSlot.layer0
    
    const scheduleSlot = {
      day: ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'][optimizedSlot.dayOfWeek],
      date: optimizedSlot.scheduledDate.toISOString(),
      time: `${optimizedSlot.hour}:00`,
      timeRationale: optimizedSlot.optimizationReason,
      // NEW: Include AI timing rationale from Phase 2b if available
      timingRationale: (layer0 as any).timing_rationale || null,
    }
    
    // ------------------------------------------------------------------
    // LAYER 7: Format & Platform — from Layer 0 strategy
    // ------------------------------------------------------------------
    
    // Use the first platform as the canonical key (PLATFORM_LIMITS only accepts single platform names)
    const primaryPlatform = (layer0.platforms?.[0] || 'instagram') as string;
    const allPlatformsLabel = layer0.platforms?.join(' + ') || 'instagram';
    const formatSelection = {
      platform: primaryPlatform,
      format: mapMediaTypeToFormat(layer0.suggested_media.type),
      platformReason: `Valgt via Layer 0 strategi (${allPlatformsLabel})`,
      formatReason: `${layer0.suggested_media.why} (${layer0.suggested_media.type})`,
    }
    console.log(`[WeeklyPlan] L7 override: ${layer0.suggested_media.type} → ${formatSelection.format} on ${allPlatformsLabel}`)
    
    // ------------------------------------------------------------------
    // Visual direction via assembleContentBrief
    // Caption is generated on-demand by generate-text-from-idea when user
    // clicks "Create Post" — same flow as AI Ideer.
    // ------------------------------------------------------------------
    
    const brief = await assembleContentBrief({
      contentSubject: opportunity.subject,
      contentType: opportunity.contentType,
      brandVoice: opportunity.brandVoice || { tone: 'casual', emoji_frequency: 'moderate' },
      businessType: businessType as 'FSE' | 'SBO' | 'MFV' | 'MFD' | 'QSR',
      seasonalContext: opportunity.seasonalContext,
      locationContext: opportunity.locationContext,
      schedulingInfo: {
        day: scheduleSlot.day,
        time: scheduleSlot.time,
        timeRationale: scheduleSlot.timeRationale,
      },
      format: formatSelection.format as 'photo' | 'carousel' | 'reel' | 'video',
      platform: formatSelection.platform as 'facebook' | 'instagram' | 'linkedin' | 'tiktok',
      formatReason: formatSelection.formatReason,
      platformReason: formatSelection.platformReason,
    })
    
    // ------------------------------------------------------------------
    // Assemble PostSpecification
    // ------------------------------------------------------------------
    
    const { priority, reasons } = calculatePriorityFromIdea(allIdeas.find(i => i.id === (opportunity.rawData?.layer0_idea?.id))!)
    
    const alternatives = generateAlternativesFromIdeas(opportunity.rawData?.layer0_idea, allIdeas)
    
    const logistics = generateLogisticsFromIdea(opportunity.rawData?.layer0_idea)
    
    const ctaType = mapCTAIntentToType(layer0.cta_intent, layer0.platforms)
    
    // Selection rationale — append repetition warning if this dish keyword was featured in a recent plan
    const _dishKeyword = opportunity.subject.toLowerCase().split(/[\s:]/)[0]
    const isDishRepeated = recentlyFeaturedDishes.size > 0 && recentlyFeaturedDishes.has(_dishKeyword)
    // Strip internal dish_index reference from user-facing text
    const cleanReason = opportunity.reason.replace(/\s*\(dish_index\s+\d+\)/gi, '')
    const cleanSelectionReason = opportunity.rawData?.selectionReason
      ? opportunity.rawData.selectionReason.replace(/\s*\(dish_index\s+\d+\)/gi, '')
      : cleanReason || 'Strategisk valgt'
    const selectionRationale = `Strategisk valgt: ${cleanReason}${isDishRepeated ? ' ⚠️ Lignende emne var i nylig plan' : ''}`
    
    const slotDate = new Date(scheduleSlot.date)

    // Detect holiday on the post's scheduled date (Layer 0 path: use idea.suggested_day for exact match)
    // postISODate: prefer Layer 0 idea's exact date; fall back to scheduled slot date for Path B
    const postISODate = (opportunity.rawData as any)?.layer0_idea?.suggested_day
      ?? slotDate.toISOString().split('T')[0]
    // Range-aware calendar event matching: supports single-day, multi-day, and school_vacation ranges
    const matchesEvent = (e: any) => e.date === postISODate
      || (e.date_end && e.date <= postISODate && postISODate <= e.date_end)
    let postHoliday: any = null
    if (contextEvents.length > 0) {
      postHoliday = contextEvents.find(e => e.type === 'holiday' && matchesEvent(e))
        || contextEvents.find(e => e.type === 'school_vacation' && matchesEvent(e))
        || null
    }
    if (postHoliday) {
      console.log(`[WeeklyPlan] 🗓️ Post on ${postISODate} falls on: ${postHoliday.name_dk ?? postHoliday.name} (${postHoliday.type})`)
    }
    
    const post: PostSpecification = {
      selectionRationale,
      
      timing: {
        day: scheduleSlot.day,
        date: formatDateISO(slotDate),
        time: scheduleSlot.time,
        rationale: scheduleSlot.timeRationale,
        timingRationale: scheduleSlot.timingRationale || undefined, // AI timing reasoning from Phase 2b
      },
      
      platformFormat: {
        platform: formatSelection.platform,
        format: formatSelection.format,
        platformRationale: formatSelection.platformReason,
        formatRationale: formatSelection.formatReason,
      },
      
      postType: {
        type: opportunity.contentType,
        category: (layer0 as any)?.content_category || inferGoalModeFromContentType(opportunity.contentType).content_category || opportunity.category || 'General',
        goal_mode: (layer0 as any)?.goal_mode || inferGoalModeFromContentType(opportunity.contentType).goal_mode,
        priority,
        priorityReasons: reasons,
      },
      
      contentSubject: {
        dish: opportunity.subject,
        whyThisDish: [cleanReason],
        menuItemId: (opportunity.rawData as any)?.itemId || undefined,  // UUID for direct lookup
        menuItemName: (opportunity.rawData as any)?.itemName || undefined,
        menuItemDescription: (opportunity.rawData as any)?.description || undefined,
      },
      
      opportunity: {
        finalScore: opportunity.score || 0,
        scoreBreakdown: opportunity.rawData?.scoreBreakdown || {
          baseScore: 0,
          seasonalBonus: 0,
          weatherBonus: 0,
          locationBonus: 0,
          performanceBonus: 0,
          recencyPenalty: 0,
        },
        selectionReason: cleanSelectionReason,
        timingReason: scheduleSlot.timingRationale || undefined, // AI timing reasoning
      },
      
      caption: {
        // Placeholder — generate-text-from-idea fills real text when user clicks "Create Post"
        text: opportunity.subject,
        characterCount: opportunity.subject.length,
        tone: `${opportunity.brandVoice?.tone || 'casual'} tone`,
        emojiCount: 0,
        ctaType,
        firstLine: opportunity.subject,
        hashtags: [],
        isAIGenerated: false,
      },
      
      visualDirection: {
        subject: layer0.suggested_media.direction,
        angle: (brief.visualDirection.directions as any).angle || 'Afbalanceret komposition',
        setting: (brief.visualDirection.directions as any).setting || 'Restaurantmiljø',
        lighting: (brief.visualDirection.directions as any).lighting || 'Naturligt lys',
        styling: (brief.visualDirection.directions as any).styling || 'Appetitvækkende præsentation',
        context: (brief.visualDirection.directions as any).optionalElements?.join(', ') || 'Optional props',
        technicalSpecs: brief.technicalSpecs,
        altText: brief.altText,
        sceneBreakdown: brief.visualDirection.sceneBreakdown,
      },
      
      productionNotes: {
        estimatedTime: brief.creationEstimate,
        logistics,
        timing: scheduleSlot.time,
      },
      
      alternatives,
      
      media: {
        status: 'pending',
        uploadedFiles: [],
      },
      
      approval: {
        status: 'draft',
        editHistory: [],
      },
      
      // Segment coverage matching (NEW - June 27, 2026)
      // Determines if this post targets a strategic segment or gap-time capacity
      ...((() => {
        try {
          // Extract strategic segments from brand profile
          const segments = brandProfile?.strategic_audience_segments 
            || brandProfile?.brand_profile_v5?.layer_1_programmes?.[0]?.audienceProfile?.audience_segments
            || []
          
          if (segments.length === 0) {
            console.log('[WeeklyPlan] No strategic segments found - skipping segment coverage matching')
            return {}
          }
          
          // Convert Danish day to English for matcher
          const englishDay = convertDanishDayToEnglish(scheduleSlot.day)
          
          // Match timing to segment
          const segmentMatch = matchTimingToSegment(englishDay, scheduleSlot.time, segments)
          
          console.log(`[WeeklyPlan] Segment match for ${scheduleSlot.day} ${scheduleSlot.time}: ${segmentMatch.mode}`,
            segmentMatch.matchedSegment ? `(${segmentMatch.matchedSegment.people_type})` : `(${segmentMatch.gapRationale})`)
          
          return {
            segmentCoverage: {
              mode: segmentMatch.mode,
              ...(segmentMatch.matchedSegment ? {
                matchedSegment: {
                  people_type: segmentMatch.matchedSegment.people_type,
                  timing: segmentMatch.matchedSegment.timing,
                  situation: segmentMatch.matchedSegment.situation
                }
              } : {}),
              ...(segmentMatch.gapRationale ? {
                gapRationale: segmentMatch.gapRationale
              } : {})
            }
          }
        } catch (err) {
          console.error('[WeeklyPlan] Segment coverage matching failed:', err)
          return {}
        }
      })()),
      
      // Layer 0 strategic context
      idea_id: layer0.id,
      strategicContext: {
        cta_intent: layer0.cta_intent,
        suggested_media: layer0.suggested_media,
        strategic_fit: layer0.strategic_fit,
        weather_dependent: layer0.weather_dependent,
        weather_flag: layer0.weather_flag,
        estimated_performance: layer0.estimated_performance,
        // Goal-mode system — for UI display and DB persistence
        goal_mode: (layer0 as any).goal_mode,
        content_category: (layer0 as any).content_category,
        slot_id: (layer0 as any).slot_id,
        rationale: cleanReason,  // Cleaned Phase 2b rationale for generate-text-from-idea
        owner_note_applied: (layer0 as any).owner_note_applied ?? false,
        drink_pairing: (layer0 as any).drink_pairing ?? null,
        strategy_brief: (layer0 as any).strategy_brief ?? null,
        media_direction: layer0.suggested_media?.direction ?? null,
        scene_spec: (layer0 as any).scene_who
          ? `${(layer0 as any).scene_who} ${(layer0 as any).scene_action} — ${(layer0 as any).scene_setting}`
          : null,
        // Strategic intent — Phase 1 narrative purpose for this post (booking driver, occasion, etc.)
        strategic_intent: (layer0 as any).strategic_intent ?? null,
        // Slot reasoning — the "because" from Phase 1 strategic slot
        slot_reasoning: (layer0 as any).slot_reasoning ?? null,
        // Booking nudge display metadata — surfaced in UI for transparency
        nudge_rationale: (layer0 as any).nudge_rationale ?? null,
        peak_day: (layer0 as any).peak_day ?? null,
        lead_days_used: (layer0 as any).lead_days_used ?? null,
        booking_nudge_warranted: (layer0 as any).booking_nudge_warranted ?? null,
      },
      
      // Flattened fields for frontend compatibility (non-conflicting names)
      title: opportunity.subject || 'Untitled Post',
      cta_text: ctaType,
      visual_direction: layer0?.suggested_media?.description || brief.visualDirection.subject,
      suggested_day: formatDate(slotDate),
      suggested_post_time: scheduleSlot.time,

      // Holiday context – present when the scheduled day falls on a public holiday
      ...(postHoliday ? {
        holiday_context: {
          name: postHoliday.name_dk ?? postHoliday.name,
          strategic_angle: postHoliday.strategic_angle ?? '',
          marketing_hook: postHoliday.marketing_hook ?? undefined,
        }
      } : {}),
    }
    
    posts.push(post)
  }
  
  // ========================================================================
  // SUMMARY
  // ========================================================================
  
  const platformCounts: Record<string, number> = {}
  const formatCounts: Record<string, number> = {}
  let totalMinutes = 0
  
  posts.forEach(post => {
    platformCounts[post.platformFormat.platform] = (platformCounts[post.platformFormat.platform] || 0) + 1
    formatCounts[post.platformFormat.format] = (formatCounts[post.platformFormat.format] || 0) + 1
    
    const timeMatch = post.productionNotes.estimatedTime.match(/(\d+)-(\d+)/)
    if (timeMatch) {
      totalMinutes += (parseInt(timeMatch[1]) + parseInt(timeMatch[2])) / 2
    }
  })
  
  return {
    id: crypto.randomUUID(),
    userId,
    businessId,
    weekNumber,
    weekStart: formatDateISO(weekStart),
    weekEnd: formatDateISO(weekEnd),
    generatedAt: new Date().toISOString(),
    
    strategyId,
    strategyNarrative: strategy!.narrative,
    strategicPriorities: strategy!.strategic_priorities,
    
    posts,
    summary: {
      totalPosts: posts.length,
      totalProductionTime: `${Math.round(totalMinutes)} minutter`,
      postsByPlatform: platformCounts,
      postsByFormat: formatCounts,
    },
    learningData: {
      userEdits: 0,
      captionEditsCount: 0,
      timingChangesCount: 0,
      platformSwapsCount: 0,
    },
  }
}

// ============================================================================
// SAVE TO DATABASE
// ============================================================================

// ============================================================================
// HASHTAG FALLBACK (when AI caption generator returns empty hashtags)
// ============================================================================

/**
 * Generates deterministic fallback hashtags when AI returns empty array.
 * Mirrors the strategy used in generate-text-from-idea: city + content-type + niche.
 * Facebook: 1-2 tags (city + broad category)
 * Instagram: 3-5 tags (city variants + niche + vibe)
 */
function generateFallbackHashtags(
  city: string,
  contentType: string,
  platform: string
): string[] {
  const cityTag = city ? city.replace(/[\s\-&\/]+/g, '') : ''

  const contentTags: Record<string, { niche: string; vibe: string }> = {
    menu_item:      { niche: 'DanskMad',    vibe: 'Gastronomi' },
    menu_highlight: { niche: 'DanskMad',    vibe: 'Gastronomi' },
    atmosphere:     { niche: 'Hyggested',   vibe: 'CoffeeVibes' },
    behind_scenes:  { niche: 'BagKulisserne', vibe: 'Håndværk' },
    team_people:    { niche: 'Teamwork',    vibe: 'Hverdagen' },
    seasonal:       { niche: 'Sæsonens',    vibe: 'NyPåMenuen' },
    event:          { niche: 'Event',       vibe: 'Lokalt' },
  }

  const { niche, vibe } = contentTags[contentType] || { niche: 'DanskMad', vibe: 'Lokalt' }

  if (platform === 'facebook') {
    // Facebook: max 2 targeted hashtags (city + broad niche)
    return [cityTag, niche].filter(Boolean).map(t => `#${t}`)
  } else {
    // Instagram: 3-5 hashtags (city, city+eats, niche, vibe)
    const tags = [cityTag, cityTag ? `${cityTag}Mad` : '', niche, vibe].filter(Boolean)
    return [...new Set(tags)].slice(0, 4).map(t => `#${t}`)
  }
}

export async function saveWeeklyPlan(
  plan: WeeklyContentPlan,
  supabaseClient: SupabaseClient,
  originalIdeas?: any[] // Optional: original strategy.post_ideas for daily_suggestions
): Promise<{ success: boolean; planId?: string; error?: string }> {
  try {
    // ========================================================================
    // STEP 1: Save complete plan to weekly_content_plans (legacy JSON blob)
    // Guard against duplicate rows for same business/week by updating latest row.
    // ========================================================================
    const { data: existingPlans, error: existingPlanError } = await supabaseClient
      .from('weekly_content_plans')
      .select('id')
      .eq('business_id', plan.businessId)
      .eq('week_start', plan.weekStart)
      .order('generated_at', { ascending: false })
      .limit(1)

    if (existingPlanError) {
      return { success: false, error: existingPlanError.message }
    }

    const existingPlanId = existingPlans?.[0]?.id
    const payload = {
      user_id: plan.userId,
      business_id: plan.businessId,
      week_number: plan.weekNumber,
      week_start: plan.weekStart,
      week_end: plan.weekEnd,
      generated_at: plan.generatedAt,
      strategy_id: plan.strategyId || null,
      posts: plan.posts,
      summary: plan.summary,
      learning_data: plan.learningData,
    }

    let savedPlanId: string | undefined

    if (existingPlanId) {
      const { data: updated, error: updateError } = await supabaseClient
        .from('weekly_content_plans')
        .update(payload)
        .eq('id', existingPlanId)
        .select('id')
        .single()

      if (updateError) {
        return { success: false, error: updateError.message }
      }
      savedPlanId = updated.id
    } else {
      const { data: inserted, error: insertError } = await supabaseClient
        .from('weekly_content_plans')
        .insert(payload)
        .select('id')
        .single()

      if (insertError) {
        return { success: false, error: insertError.message }
      }
      savedPlanId = inserted.id
    }
    
    // ========================================================================
    // STEP 2: Insert individual posts into daily_suggestions
    // ========================================================================
    if (originalIdeas && originalIdeas.length > 0) {
      // Use original strategy.post_ideas which have validation_result and inferred_content_type
      const perDayPosition = new Map<string, number>()
      let skippedDueToPositionCap = 0

      const dailySuggestions = originalIdeas
        .map((idea) => {
          const date = idea.suggested_day || null
          if (!date) return null

          const nextPos = (perDayPosition.get(date) || 0) + 1
          perDayPosition.set(date, nextPos)

          // Live DB constraint still enforces position <= 3.
          if (nextPos > 3) {
            skippedDueToPositionCap += 1
            return null
          }

          return {
            business_id: plan.businessId,
            title: idea.title || 'Untitled Post',
            rationale: idea.rationale || '',
            content_type: idea.content_type || 'atmosphere',
            suggested_time: idea.suggested_time || null,
            date,
            position: nextPos,
            source: 'weekly_plan',
            status: 'available',
            menu_item_id: idea.contentSubject?.menuItemId || idea.menuItemId || null,
            menu_item_name: idea.contentSubject?.menuItemName || idea.menuItemName || null,
            menu_item_description: idea.contentSubject?.menuItemDescription || idea.menuItemDescription || null,
            validation_result: idea.validation_result || null,
            inferred_content_type: idea.inferred_content_type || null,
          }
        })
        .filter(Boolean) as Array<Record<string, unknown>>

      if (skippedDueToPositionCap > 0) {
        console.warn(`[saveWeeklyPlan] ⚠️ Skipped ${skippedDueToPositionCap} daily_suggestions rows due to live position<=3 constraint`)
      }
      
      if (dailySuggestions.length > 0) {
        const { error: insertError, count } = await supabaseClient
          .from('daily_suggestions')
          .upsert(dailySuggestions, { onConflict: 'business_id,date,position,source,status' })
        
        if (insertError) {
          console.error('[saveWeeklyPlan] Failed to insert daily_suggestions:', insertError)
          // Don't fail the entire save if daily_suggestions write fails
        } else {
          console.log(`[saveWeeklyPlan] ✅ Upserted ${dailySuggestions.length} posts into daily_suggestions (rows affected: ${count})`)
        }
      } else {
        console.warn('[saveWeeklyPlan] ⚠️  No original ideas with valid dates to insert into daily_suggestions')
      }
    } else {
      console.warn('[saveWeeklyPlan] ⚠️  No originalIdeas provided, skipping daily_suggestions insert')
    }
    
    return { success: true, planId: savedPlanId }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ============================================================================
// LOAD FROM DATABASE
// ============================================================================

export async function loadWeeklyPlan(
  userId: string,
  weekStart: string,
  supabaseClient: SupabaseClient
): Promise<WeeklyContentPlan | null> {
  const { data, error } = await supabaseClient
    .from('weekly_content_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .order('generated_at', { ascending: false })
    .limit(1)
  
  if (error || !data || data.length === 0) return null
  const row = data[0]
  
  return {
    id: row.id,
    userId: row.user_id,
    businessId: row.business_id,
    weekNumber: row.week_number,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    generatedAt: row.generated_at,
    strategyId: row.strategy_id,  // NEW
    posts: row.posts,
    summary: row.summary,
    learningData: row.learning_data,
  }
}

// Export for testing
export const testHelpers = {
  getWeekNumber,
  getWeekEnd,
  formatDate,
  calculatePriorityFromIdea,
  generateAlternativesFromIdeas,
  generateLogistics,
  generateLogisticsFromIdea,
  mapMediaTypeToFormat,
  mapCTAIntentToType,
  mapIdeaToEnrichedSlot,
}
