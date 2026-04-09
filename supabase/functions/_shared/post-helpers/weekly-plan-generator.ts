/**
 * LAYER 9: WEEKLY CONTENT PLAN GENERATOR
 * Assembles complete weekly plans from Layers 5-8
 * 
 * TWO MODES:
 * A) With Layer 0 strategy (preferred): Strategy ideas → Layer 6 timing → Layer 7* format → Layer 8 caption
 *    *Layer 7 is guided by Layer 0's suggested_media and platforms, not independent
 * B) Without strategy (legacy): Layer 5 scoring → Layer 6 timing → Layer 7 format → Layer 8 caption
 */

import { selectWeeklyOpportunities } from './opportunity-selector.ts'
import { optimizeWeeklySchedule } from './post-slot-optimizer.ts'
import { selectMediaFormatAndPlatform } from './media-format-selector.ts'
import { assembleContentBrief } from './content-brief-assembler.ts'
import { getCurrentSeason } from './menu-scorer.ts'
import { filterAudienceLabels } from '../utils/audience-filter.ts'
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
// STRATEGY BRIEF HELPERS
// ============================================================================

function buildStrategyBriefText(strategy: any): string {
  if (!strategy) return ''
  const parts: string[] = []
  if (strategy.narrative?.headline) parts.push(strategy.narrative.headline)
  if (strategy.strategic_brief?.week_summary) parts.push(strategy.strategic_brief.week_summary)
  if (strategy.strategic_brief?.angles?.[0]?.primary_angle)
    parts.push(`Fokus: ${strategy.strategic_brief.angles[0].primary_angle}`)
  return parts.join(' ')
}

function buildTargetAudienceText(brandProfile: any): string {
  const ta = brandProfile?.target_audience
  if (!ta) return ''
  if (typeof ta === 'string') return ta
  return ta.primary || JSON.stringify(ta)
}

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
  // ✨ Weather forecast for the week (from OpenWeatherMap via Layer 1)
  weatherForecast?: Array<{date: string; condition: string; temp: {day: number; min: number; max: number}; description: string}>
}

// ============================================================================
// POST COUNT BY BUSINESS TYPE (legacy fallback when no Layer 0)
// ============================================================================

const POST_COUNT_BY_TYPE = {
  FSE: 4,  // Fine Dining - focused quality
  SBO: 4,  // Small Business - manageable volume
  MFV: 5,  // Multiple Locations - moderate presence
  MFD: 6,  // Multiple per Day - higher frequency
  QSR: 7,  // Quick Service - high volume
} as const

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

function calculatePriority(opportunity: any): {
  priority: 'High' | 'Medium' | 'Low'
  reasons: string[]
} {
  const reasons: string[] = []
  let score = 0
  
  if (opportunity.seasonalScore > 80) {
    reasons.push('seasonal ingredients')
    score += 3
  }
  
  if (opportunity.locationScore > 80) {
    reasons.push('location match')
    score += 2
  }
  
  if (opportunity.weatherScore > 75) {
    reasons.push('weather boost')
    score += 2
  }
  
  if (opportunity.performanceScore > 85) {
    reasons.push('proven performance')
    score += 2
  }
  
  if (opportunity.recencyScore > 90) {
    reasons.push('fresh content')
    score += 1
  }
  
  if (score >= 7) return { priority: 'High', reasons }
  if (score >= 4) return { priority: 'Medium', reasons }
  return { priority: 'Low', reasons }
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

function generateAlternatives(opportunity: any, allOpportunities: any[]): {
  priority: number
  description: string
}[] {
  const alternatives: { priority: number; description: string }[] = []
  
  const sameCategory = allOpportunities.find(opp => 
    opp.contentType === opportunity.contentType &&
    opp.subject !== opportunity.subject
  )
  if (sameCategory) {
    alternatives.push({
      priority: 1,
      description: `Alternative: ${sameCategory.subject}`,
    })
  }
  
  if (opportunity.contentType === 'menu_highlight') {
    alternatives.push({
      priority: 2,
      description: `Ingredient story: Focus on key ingredient sourcing`,
    })
  }
  
  if (opportunity.contentType === 'behind_scenes') {
    alternatives.push({
      priority: 3,
      description: `Behind-scenes: Show preparation process`,
    })
  }
  
  return alternatives.slice(0, 3)
}

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
  weatherForecast?: Array<{date: string; condition: string; temp: {day: number}; description: string}>
) {
  // Parse as local date to avoid UTC-midnight shift (e.g. "2026-03-02" → UTC midnight = Mar 1 23:00 in UTC+1)
  const [_yr, _mo, _dy] = idea.suggested_day.split('-').map(Number)
  const suggestedDate = new Date(_yr, _mo - 1, _dy)
  const dayOfWeek = (suggestedDate.getDay() + 6) % 7 // Mon=0 … Sun=6 (matches optimizer offset convention)
  const hour = parseInt(idea.suggested_time.split(':')[0])
  
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
  const dayForecast = (weatherForecast || []).find(f => f.date === idea.suggested_day)
  const seasonalContextData = {
    season: seasonMap[month] || 'spring',
    weather: dayForecast?.condition || undefined,
    temperature: dayForecast ? `${dayForecast.temp?.day}°C` : undefined,
  }

  // ✨ NEW: Fetch menu item description for menu_item / product_menu content type
  // Also handles behind_scenes posts when phase2b has identified a specific dish being prepared
  // This prevents AI hallucination by providing actual dish details
  let menuItemData: any = undefined
  const behindScenesMenuItemUsed: string = (idea as any).menu_item_used || ''
  if (idea.content_type === 'menu_item' || idea.content_type === 'product_menu' || behindScenesMenuItemUsed) {
    // Extract dish name: for menu types use title, for behind_scenes use menu_item_used
    // Phase 2b titles often follow "Dish Name, med beskrivelse" format — split on comma-description
    // (comma followed by lowercase) to isolate the actual item name for DB lookup.
    const rawDishName = behindScenesMenuItemUsed || idea.title
    const dishName = rawDishName
      .split(/[:\-–]/)[0]
      .split(/,\s+(?=[a-zæøå])/)[0]
      .trim()
    
    // Priority cascade: exact (case-insensitive) → starts-with → contains (confidence-gated)
    // Avoids broad substring matches that return wrong dish descriptions (e.g., "Bøf" matching 4 dishes)
    const menuSelect = 'item_name, item_description, item_price, category_name'
    const { data: exactMatch } = await supabaseClient
      .from('menu_items_normalized')
      .select(menuSelect)
      .eq('business_id', businessId)
      .ilike('item_name', dishName)
      .limit(1)
      .maybeSingle()
    if (exactMatch) {
      menuItemData = exactMatch
    } else {
      const { data: startsWithMatch } = await supabaseClient
        .from('menu_items_normalized')
        .select(menuSelect)
        .eq('business_id', businessId)
        .ilike('item_name', `${dishName}%`)
        .limit(1)
        .maybeSingle()
      if (startsWithMatch) {
        menuItemData = startsWithMatch
      } else {
        const { data: containsMatch } = await supabaseClient
          .from('menu_items_normalized')
          .select(menuSelect)
          .eq('business_id', businessId)
          .ilike('item_name', `%${dishName}%`)
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
      }
    }
    if (menuItemData) {
      console.log(`[WeeklyPlan] ✅ Fetched menu description for "${menuItemData.item_name}": ${menuItemData.item_description?.substring(0, 80)}...`)
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

  // Determine if we're using Layer 0 strategy or legacy Layer 5
  const useStrategyPath = !!strategy && strategy.post_ideas.length > 0
  
  if (useStrategyPath) {
    console.log('[WeeklyPlan] 🎯 Using Layer 0 strategy path (Layer 5 skipped)')
    console.log('[WeeklyPlan] Strategy:', {
      week_number: strategy.week_number,
      total_ideas: strategy.post_ideas.length,
      selected_ids: selectedIdeaIds || 'all',
      platforms: strategy.platforms,
      tier: strategy.subscription_tier,
    })
  } else {
    console.log('[WeeklyPlan] ⚡ Using legacy path (Layer 5 scoring)')
  }
  
  // Calculate week metadata
  const weekNumber = getWeekNumber(weekStart)
  const weekEnd = getWeekEnd(weekStart)
  
  // ========================================================================
  // PATH A: Layer 0 Strategy → Layer 6 → Layer 7* → Layer 8
  // ========================================================================
  
  let enrichedSlots: any[]
  let allIdeas: PostIdea[] = []
  
  if (useStrategyPath) {
    // Filter to selected ideas (or use all if no selection)
    allIdeas = selectedIdeaIds 
      ? strategy.post_ideas.filter(idea => selectedIdeaIds.includes(idea.id))
      : strategy.post_ideas
    
    if (allIdeas.length === 0) {
      console.warn('[WeeklyPlan] No ideas selected, falling back to all strategy ideas')
      allIdeas = strategy.post_ideas
    }
    
    console.log('[WeeklyPlan] Processing', allIdeas.length, 'selected ideas:', 
      allIdeas.map(i => `#${i.id}: ${i.title}`))
    
    // Map Layer 0 ideas to enriched slot format (async to fetch menu descriptions)
    const _maxMenuPrice = menuItems && menuItems.length > 0
      ? (menuItems.map((m: any) => parseFloat(m.price || '')).filter((p: number) => !isNaN(p) && p > 0).sort((a: number, b: number) => b - a)[0] ?? null)
      : null
    enrichedSlots = await Promise.all(
      allIdeas.map(idea =>
        mapIdeaToEnrichedSlot(idea, weekStart, brandProfile, locationIntel, businessId, supabaseClient, _maxMenuPrice, input.weatherForecast)
      )
    )
    
  // ========================================================================
  // PATH B: Legacy Layer 5 scoring (no strategy provided)
  // ========================================================================
  
  } else {
    // Determine post count cap for legacy path
    const tierPostCap = input.subscriptionTier === 'smart'
      ? 4
      : input.targetPostCount ?? (POST_COUNT_BY_TYPE[businessType as keyof typeof POST_COUNT_BY_TYPE] || 4)

    console.log('[WeeklyPlan] Calling selectWeeklyOpportunities for business:', businessId,
      '| tier:', input.subscriptionTier || 'unknown', '| cap:', tierPostCap)
    
    let weeklyPlan
    try {
      weeklyPlan = await selectWeeklyOpportunities(
        businessId,
        weekStart,
        {
          minimumScore: 60,
          businessProfile,
          businessOps,
          locationIntel,
          platforms: platforms || ['instagram'],
          menuItems,
          brandProfile,
        }
      )
      console.log('[WeeklyPlan] Got', weeklyPlan.slots.length, 'opportunity slots')
    } catch (error) {
      console.error('[WeeklyPlan] Error in selectWeeklyOpportunities:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to select opportunities: ${errorMessage}`)
    }
    
    // Extract and enrich opportunities from slots (original logic)
    // Cap by tier before AI caption generation to avoid wasted calls
    enrichedSlots = weeklyPlan.slots
      .filter(slot => slot.selectedOpportunity !== null)
      .slice(0, tierPostCap)
      .map(slot => {
        const opp = slot.selectedOpportunity!
        const isMenuItem = 'itemName' in opp
        
        // Note: DB columns are area_type (not location_type) and location_marketing_hooks (not location_amplifiers)
        const rawAreaType2 = (locationIntel?.area_type as string | undefined) || 'city_center'
        // Derive permitted audience types via shared filter (price-gated, same logic as Brand Profile)
        const _categoryScores2 = (locationIntel?.category_scores as Record<string, number>) ?? {}
        const _maxMenuPrice2 = menuItems && menuItems.length > 0
          ? (menuItems.map((m: any) => parseFloat(m.price || '')).filter((p: number) => !isNaN(p) && p > 0).sort((a: number, b: number) => b - a)[0] ?? null)
          : null
        const { permittedKeys: _permittedKeys2 } = filterAudienceLabels(_categoryScores2, _maxMenuPrice2)
        const _secondaryTypes2 = _permittedKeys2.map(k => k === 'city_centre' ? 'city_center' : k)
        const locationContextData = {
          type: (rawAreaType2 === 'city_centre' ? 'city_center' : rawAreaType2) as 'waterfront' | 'city_center' | 'historic' | 'residential' | 'suburban',
          amplifiers: (locationIntel?.location_marketing_hooks as string[] | undefined) || [],
          secondary_types: _secondaryTypes2,
        }
        
        const currentSeason = getCurrentSeason(weekStart.getMonth() + 1)
        const seasonalContextData = {
          season: (currentSeason === 'autumn' ? 'fall' : currentSeason) as 'spring' | 'summer' | 'fall' | 'winter',
          weather: undefined,
          temperature: undefined
        }
        
        return {
          slotId: slot.slotId,
          contentType: slot.contentType,
          platform: slot.platform,
          dayOfWeek: slot.dayOfWeek,
          hour: slot.hour,
          opportunity: {
            subject: isMenuItem ? opp.itemName : ((opp as any).subject || (opp as any).contentAngle),
            contentType: slot.contentType,
            score: isMenuItem ? opp.finalScore : (opp as any).score,
            reason: isMenuItem ? opp.selectionReason : ((opp as any).subject || (opp as any).contentAngle),
            brandVoice: deriveBrandVoiceCompat(brandProfile),
            seasonalContext: seasonalContextData,
            locationContext: locationContextData,
            rawData: opp,
          },
          // No layer0 extras in legacy path
          layer0: null,
        }
      })
  }
  
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
      layer0Day: slot.layer0 !== null ? slot.dayOfWeek : undefined,
      // Pass Layer 0's suggested time so optimizer uses it directly (Step 1)
      layer0Hour: slot.layer0 !== null ? slot.hour : undefined,
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
  
  for (let i = 0; i < enrichedSlots.length; i++) {
    const enrichedSlot = enrichedSlots[i]
    const opportunity = enrichedSlot.opportunity
    const optimizedSlot = weeklySchedule.slots[i]
    const layer0 = enrichedSlot.layer0 // null in legacy path
    
    const scheduleSlot = {
      day: ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'][optimizedSlot.dayOfWeek],
      date: optimizedSlot.scheduledDate.toISOString(),
      time: `${optimizedSlot.hour}:00`,
      timeRationale: optimizedSlot.optimizationReason,
    }
    
    // ------------------------------------------------------------------
    // LAYER 7: Format & Platform selection
    // Strategy path: Use Layer 0's suggested_media + platforms directly
    // Legacy path: Use Layer 7's independent selection
    // ------------------------------------------------------------------
    
    let formatSelection: {
      platform: string
      format: string
      platformReason: string
      formatReason: string
    }
    
    if (layer0) {
      // Strategy-driven: Layer 0 already decided format and platform
      // Use the first platform as the canonical key (PLATFORM_LIMITS only accepts single platform names)
      const primaryPlatform = (layer0.platforms?.[0] || 'instagram') as string;
      const allPlatformsLabel = layer0.platforms?.join(' + ') || 'instagram';
      formatSelection = {
        platform: primaryPlatform,
        format: mapMediaTypeToFormat(layer0.suggested_media.type),
        platformReason: `Valgt via Layer 0 strategi (${allPlatformsLabel})`,
        formatReason: `${layer0.suggested_media.why} (${layer0.suggested_media.type})`,
      }
      console.log(`[WeeklyPlan] L7 override: ${layer0.suggested_media.type} → ${formatSelection.format} on ${allPlatformsLabel}`)
    } else {
      // Legacy: Layer 7 decides independently
      formatSelection = await selectMediaFormatAndPlatform(
        optimizedSlot,
        businessId,
        userId,
        supabaseClient
      )
    }
    
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
    
    // Priority: strategy-driven vs. legacy scoring
    const { priority, reasons } = layer0 
      ? calculatePriorityFromIdea(allIdeas.find(i => i.id === (opportunity.rawData?.layer0_idea?.id))!)
      : calculatePriority(opportunity)
    
    // Alternatives: from other strategy ideas vs. other opportunities
    const alternatives = layer0
      ? generateAlternativesFromIdeas(
          opportunity.rawData?.layer0_idea,
          allIdeas
        )
      : generateAlternatives(opportunity, enrichedSlots.map(s => s.opportunity))
    
    // Logistics: enhanced with media direction vs. basic
    const logistics = layer0
      ? generateLogisticsFromIdea(opportunity.rawData?.layer0_idea)
      : generateLogistics(opportunity.contentType, formatSelection.format, opportunity.subject)
    
    // CTA type: from Layer 0 intent vs. AI metadata
    const ctaType = layer0
      ? mapCTAIntentToType(layer0.cta_intent, layer0.platforms)
      : 'soft CTA'
    
    // Selection rationale — append repetition warning if this dish keyword was featured in a recent plan
    const _dishKeyword = opportunity.subject.toLowerCase().split(/[\s:]/)[0]
    const isDishRepeated = recentlyFeaturedDishes.size > 0 && recentlyFeaturedDishes.has(_dishKeyword)
    const selectionRationale = layer0
      ? `Strategisk valgt: ${opportunity.reason}${isDishRepeated ? ' ⚠️ Lignende emne var i nylig plan' : ''}`
      : buildLegacyRationale(opportunity, priority) + (isDishRepeated ? ' ⚠️ Lignende emne var i nylig plan' : '')
    
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
        date: formatDate(slotDate),
        time: scheduleSlot.time,
        rationale: scheduleSlot.timeRationale,
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
        whyThisDish: layer0 
          ? [opportunity.reason]
          : (opportunity.reasons || []),
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
        selectionReason: opportunity.rawData?.selectionReason || opportunity.reason || 'Strategisk valgt',
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
        subject: layer0 
          ? layer0.suggested_media.direction 
          : brief.visualDirection.subject,
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
      
      // Layer 0 strategic context (only present in strategy path)
      ...(layer0 ? {
        idea_id: layer0.id,  // Add idea ID for frontend compatibility
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
          rationale: opportunity.reason,  // raw Phase 2b rationale for generate-text-from-idea
        }
      } : {}),
      
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
    
    // Strategy reference (only in strategy path)
    ...(useStrategyPath ? {
      strategyId,
      strategyNarrative: strategy.narrative,
      strategicPriorities: strategy.strategic_priorities,
    } : {}),
    
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
// HELPER: Legacy rationale builder (extracted from original)
// ============================================================================

function buildLegacyRationale(opportunity: any, priority: string): string {
  const rationaleComponents: string[] = []
  if (opportunity.rawData?.scoreBreakdown) {
    const breakdown = opportunity.rawData.scoreBreakdown
    if (breakdown.seasonalBonus > 0) rationaleComponents.push(`Sæson +${breakdown.seasonalBonus}`)
    if (breakdown.weatherBonus > 0) rationaleComponents.push(`Vejr +${breakdown.weatherBonus}`)
    if (breakdown.locationBonus > 0) rationaleComponents.push(`Lokation +${breakdown.locationBonus}`)
  }
  if (priority === 'High') rationaleComponents.push('Høj prioritet')
  if (opportunity.contentType === 'menu_highlight') rationaleComponents.push('Menu')
  if (opportunity.contentType === 'weather_opportunity') rationaleComponents.push('Vejr')
  
  return rationaleComponents.length > 0
    ? rationaleComponents.join(' • ')
    : 'AI-valgt baseret på menu og situation'
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
  supabaseClient: SupabaseClient
): Promise<{ success: boolean; planId?: string; error?: string }> {
  try {
    const { data, error } = await supabaseClient
      .from('weekly_content_plans')
      .insert({
        user_id: plan.userId,
        business_id: plan.businessId,
        week_number: plan.weekNumber,
        week_start: plan.weekStart,
        week_end: plan.weekEnd,
        generated_at: plan.generatedAt,
        strategy_id: plan.strategyId || null,  // NEW: Link to Layer 0 strategy
        posts: plan.posts,
        summary: plan.summary,
        learning_data: plan.learningData,
      })
      .select('id')
      .single()
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { success: true, planId: data.id }
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
    .single()
  
  if (error || !data) return null
  
  return {
    id: data.id,
    userId: data.user_id,
    businessId: data.business_id,
    weekNumber: data.week_number,
    weekStart: data.week_start,
    weekEnd: data.week_end,
    generatedAt: data.generated_at,
    strategyId: data.strategy_id,  // NEW
    posts: data.posts,
    summary: data.summary,
    learningData: data.learning_data,
  }
}

// Export for testing
export const testHelpers = {
  getWeekNumber,
  getWeekEnd,
  formatDate,
  calculatePriority,
  calculatePriorityFromIdea,
  generateAlternatives,
  generateAlternativesFromIdeas,
  generateLogistics,
  generateLogisticsFromIdea,
  mapMediaTypeToFormat,
  mapCTAIntentToType,
  mapIdeaToEnrichedSlot,
  POST_COUNT_BY_TYPE,
}
