/**
 * WEEKLY CONTENT OPPORTUNITY SELECTOR (Layer 5 Component C)
 * 
 * Combines menu scoring + compound opportunities to generate optimal weekly content plan.
 * 
 * Algorithm (6 steps):
 * 1. Generate all opportunities (menu items + non-menu patterns)
 * 2. Allocate slots by type (get Layer 2 distribution)
 * 3. Fill slots with highest-scoring opportunities matching slot type
 * 4. Apply sequencing rules (variety, spacing, platform balance)
 * 5. Assign optimal timing (day + hour)
 * 6. Handle edge cases (insufficient content, weather changes, overrides)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import type { MenuItemScore } from './menu-scorer.ts'
import { scoreMenuItems, getCurrentSeason } from './menu-scorer.ts'
import type { CompoundOpportunity } from './compound-opportunities.ts'
import { detectCompoundOpportunities } from './compound-opportunities.ts'
import type { WeatherForecast } from './weather.ts'

// =====================================================
// TYPES
// =====================================================

export interface PostSlot {
  slotId: string
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 // Sunday = 0
  hour: number // 0-23
  date: Date
  
  // Slot assignment
  contentType: string // 'menu_item', 'atmosphere_experience', etc.
  platform: 'instagram' | 'facebook' | 'both'
  
  // Selected opportunity
  selectedOpportunity: MenuItemScore | CompoundOpportunity | null
  alternativeOpportunities: (MenuItemScore | CompoundOpportunity)[]
  
  // Reasoning
  selectionReason: string
  expectedPerformance: 'low' | 'medium' | 'high' | 'critical'
  confidenceScore: number // 0-100
}

export interface WeeklyContentPlan {
  businessId: string
  weekStartDate: Date
  weekEndDate: Date
  
  slots: PostSlot[]
  
  // Summary statistics
  summary: {
    totalSlots: number
    filledSlots: number
    menuItemSlots: number
    nonMenuSlots: number
    criticalOpportunities: number
    platformDistribution: {
      instagram: number
      facebook: number
      both: number
    }
  }
  
  // Warnings and suggestions
  warnings: string[]
  suggestions: string[]
}

export interface SlotAllocation {
  totalSlots: number
  distribution: Record<string, number> // content_type -> count
}

// =====================================================
// MAIN WEEKLY PLANNING FUNCTION
// =====================================================

/**
 * Generate optimal weekly content plan
 */
export async function selectWeeklyOpportunities(
  businessId: string,
  weekStartDate: Date,
  options?: {
    userOverrides?: Partial<PostSlot>[]
    minimumScore?: number
    // ✨ Layer 1 data passed from edge function
    businessProfile?: any
    businessOps?: any
    locationIntel?: any
    platforms?: string[]
    menuItems?: any[]
    brandProfile?: any
  }
): Promise<WeeklyContentPlan> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('[OpportunitySelector] Missing Supabase credentials')
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  console.log(`[OpportunitySelector] Starting weekly plan for ${businessId}`)
  
  // =====================================================
  // STEP 1: Generate all opportunities
  // =====================================================
  const { menuScores, compoundOpportunities, context } = await generateAllOpportunities(
    businessId,
    weekStartDate,
    supabase
  )
  
  console.log(`  Menu items: ${menuScores.length}, Compound opportunities: ${compoundOpportunities.length}`)
  
  // =====================================================
  // STEP 2: Allocate slots by type
  // =====================================================
  const allocation = await allocateSlotsByType(businessId, supabase)
  
  console.log(`  Total slots allocated: ${allocation.totalSlots}`)
  
  // =====================================================
  // STEP 2.5: Use platforms from options or determine strategy
  // =====================================================
  const platforms = options?.platforms || ['instagram']
  const hasBothPlatforms = platforms.includes('instagram') && platforms.includes('facebook')
  const platformStrategy = hasBothPlatforms ? 'dual_version' : 
                          platforms.includes('instagram') ? 'instagram_only' : 'facebook_only'
  
  console.log(`  Platforms from Layer 1:`, platforms)
  console.log(`  Platform strategy: ${platformStrategy}`)
  
  // =====================================================
  // STEP 2.6: Get recently posted items (14-day recency filter)
  // =====================================================
  const recentlyPosted = await getRecentlyPostedItems(businessId, 14, supabase)
  
  console.log(`  Recently posted items (last 14 days): ${recentlyPosted.size}`)
  
  // =====================================================
  // STEP 3: Fill slots with highest-scoring opportunities
  // =====================================================
  const initialSlots = fillSlotsWithOpportunities(
    allocation,
    menuScores,
    compoundOpportunities,
    weekStartDate,
    options?.minimumScore || 50,
    platformStrategy,
    recentlyPosted,
    context,
    platforms  // ✨ NEW: Pass platforms array
  )
  
  // =====================================================
  // STEP 4: Apply sequencing rules
  // =====================================================
  const sequencedSlots = applySequencingRules(initialSlots)
  
  // =====================================================
  // STEP 5: Assign optimal timing
  // =====================================================
  const timedSlots = await assignOptimalTiming(
    sequencedSlots, 
    context, 
    businessId, 
    supabase,
    options?.businessProfile  // ✨ NEW: Pass service_periods, opening_hours
  )
  
  // =====================================================
  // STEP 6: Handle edge cases and user overrides
  // =====================================================
  const finalSlots = await handleEdgeCases(
    timedSlots,
    menuScores,
    compoundOpportunities,
    businessId,
    supabase,
    options?.userOverrides
  )
  
  // =====================================================
  // Generate plan summary
  // =====================================================
  const plan = generateWeeklyPlan(businessId, weekStartDate, finalSlots)
  
  console.log(`[OpportunitySelector] Plan complete: ${plan.summary.filledSlots}/${plan.summary.totalSlots} slots filled`)
  
  return plan
}

// =====================================================
// STEP 1: GENERATE ALL OPPORTUNITIES
// =====================================================

async function generateAllOpportunities(
  businessId: string,
  weekStartDate: Date,
  supabase: any
) {
  // Fetch business context
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single()
  
  if (businessError || !business) {
    throw new Error(`Failed to fetch business: ${businessError?.message}`)
  }
  
  // Get weather forecast
  const weatherModule = await import('./weather.ts')
  const weatherForecast = await weatherModule.getWeatherForecast(
    business.location?.city || 'Copenhagen',
    7
  )
  
  // Determine season
  const currentMonth = weekStartDate.getMonth() + 1
  const season = getCurrentSeason(currentMonth)
  
  // Calculate location scores from category_scores
  const categoryScores = business.category_scores || {}
  const locationScores: Record<string, number> = {}
  
  if (business.location?.waterfront) locationScores.waterfront = 85
  if (business.location?.tourist_area) locationScores.tourist_area = 70
  
  // Build menu scoring context
  const menuContext = {
    businessId,
    season,
    currentMonth,
    weatherForecast: {
      avgTemp: weatherForecast.slice(0, 3).reduce((sum, day) => sum + day.temp.day, 0) / 3,
      condition: weatherForecast[0]?.condition || 'unknown'
    },
    locationScores,
    businessAvgEngagement: business.avg_engagement_rate || 0.05,
    countryCode: business.country_code || 'DK'
  }
  
  // Build location context for compound opportunities
  const locationContext = {
    categoryScores,
    outdoorSeating: business.outdoor_seating || false,
    areaType: business.area_type,
    servicePeriods: business.service_periods,
    primaryServicePeriod: business.primary_service_period
  }
  
  // Score menu items
  const menuScores = await scoreMenuItems(menuContext)
  
  // Detect compound opportunities
  const compoundOpportunities = await detectCompoundOpportunities(
    locationContext,
    weatherForecast,
    season,
    businessId,
    supabase,
    new Date().getHours(),
    business.country || 'DK' // Pass country code for calendar events
  )
  
  return {
    menuScores,
    compoundOpportunities,
    context: {
      business,
      weather: weatherForecast,
      season,
      locationScores
    }
  }
}

// =====================================================
// STEP 2: ALLOCATE SLOTS BY TYPE
// =====================================================

async function allocateSlotsByType(
  businessId: string,
  supabase: any
): Promise<SlotAllocation> {
  // Try to get Layer 2 distribution (performance-adjusted if available)
  try {
    const { data: distributionData, error } = await supabase
      .rpc('get_performance_adjusted_distribution', {
        p_business_id: businessId,
        p_total_posts: 7 // Standard weekly plan
      })
    
    if (!error && distributionData && distributionData.length > 0) {
      // Use performance-adjusted distribution
      const distribution: Record<string, number> = {}
      let total = 0
      
      for (const row of distributionData) {
        distribution[row.content_type] = row.suggested_count
        total += row.suggested_count
      }
      
      console.log('  Using performance-adjusted distribution')
      return { totalSlots: total, distribution }
    }
  } catch (error) {
    console.warn('  RPC function not available, using default distribution:', error)
  }
  
  // Fallback to Layer 2 defaults
  console.log('  Using Layer 2 default distribution')
  return {
    totalSlots: 7,
    distribution: {
      menu_item: 3,
      atmosphere_experience: 2,
      behind_the_scenes: 1,
      promotional: 1
    }
  }
}

// =====================================================
// PLATFORM STRATEGY DETERMINATION
// =====================================================

async function determinePlatformStrategy(
  businessId: string,
  supabase: any
): Promise<'instagram_only' | 'facebook_only' | 'dual_version'> {
  const { data: business } = await supabase
    .from('businesses')
    .select('connected_platforms')
    .eq('id', businessId)
    .single()
  
  const platforms = business?.connected_platforms || []
  
  if (platforms.includes('instagram') && platforms.includes('facebook')) {
    return 'dual_version' // Generate both versions
  } else if (platforms.includes('instagram')) {
    return 'instagram_only'
  } else if (platforms.includes('facebook')) {
    return 'facebook_only'
  }
  
  return 'instagram_only' // Default fallback
}

// =====================================================
// RECENCY FILTER (Layer 4 Integration)
// =====================================================

async function getRecentlyPostedItems(
  businessId: string,
  daysBack: number,
  supabase: any
): Promise<Set<string>> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysBack)
  
  const { data: recentPosts } = await supabase
    .from('published_posts')
    .select('menu_item_id, menu_item_name')
    .eq('business_id', businessId)
    .gte('published_at', cutoffDate.toISOString())
  
  const recentItemNames = new Set<string>()
  recentPosts?.forEach(post => {
    if (post.menu_item_name) recentItemNames.add(post.menu_item_name)
  })
  
  return recentItemNames
}

// =====================================================
// STEP 3: FILL SLOTS WITH OPPORTUNITIES
// =====================================================

// Calculate confidence score based on opportunity quality and context
function calculateConfidenceScore(
  opportunity: MenuItemScore | CompoundOpportunity,
  alternativesCount: number,
  slotFilled: boolean
): number {
  let confidence = 0
  
  // Base confidence from opportunity score
  const score = 'finalScore' in opportunity ? opportunity.finalScore : opportunity.score
  
  // Map score ranges to confidence levels
  if (score >= 180) confidence = 90       // Excellent opportunity
  else if (score >= 140) confidence = 75  // Good opportunity
  else if (score >= 100) confidence = 60  // Decent opportunity
  else if (score >= 70) confidence = 45   // Marginal opportunity
  else confidence = 30                     // Weak opportunity
  
  // Adjust for alternatives available
  if (alternativesCount >= 3) confidence += 10  // Good selection pool
  else if (alternativesCount === 0) confidence -= 15 // Limited options
  
  // Adjust for opportunity type
  if ('postWorthiness' in opportunity && opportunity.postWorthiness === 'critical') {
    confidence += 10 // Critical opportunities are high confidence
  }
  
  // Penalize if slot wasn't filled optimally
  if (!slotFilled) confidence -= 20
  
  return Math.max(0, Math.min(100, confidence))
}

// Build detailed selection reasoning
function buildDetailedReason(
  opportunity: MenuItemScore | CompoundOpportunity,
  contentType: string,
  context: any
): string {
  const reasons: string[] = []
  
  if ('finalScore' in opportunity) {
    // Menu item
    reasons.push(`Score: ${opportunity.finalScore.toFixed(0)}`)
    
    if (opportunity.bonuses?.seasonal > 0) {
      reasons.push(`Seasonal (${context.season})`)
    }
    if (opportunity.bonuses?.weather > 0) {
      const weatherCondition = context.weather?.[0]?.condition || 'favorable'
      reasons.push(`Weather match (${weatherCondition})`)
    }
    if (opportunity.bonuses?.newness > 0) {
      reasons.push('New menu item')
    }
    if (opportunity.bonuses?.performance > 0) {
      reasons.push('Strong past performance')
    }
    if (opportunity.postWorthiness === 'critical') {
      reasons.push('⚠️ TIME-SENSITIVE')
    }
  } else {
    // Compound opportunity
    reasons.push(opportunity.contentAngle)
    if (opportunity.priority === 'critical') {
      reasons.push('⚠️ TIME-SENSITIVE')
    }
    if (opportunity.score >= 140) {
      reasons.push(`High score (${opportunity.score})`)
    }
  }
  
  return reasons.join(' • ')
}

// DETERMINISTIC selection based on scoring
function selectBestOpportunity(
  available: MenuItemScore[],
  slotIndex: number,
  date: Date
): MenuItemScore {
  // Sort by score (primary) and secondary factors (deterministic)
  const sorted = available.sort((a, b) => {
    // Primary: Higher score wins
    if (b.finalScore !== a.finalScore) {
      return b.finalScore - a.finalScore
    }
    
    // Secondary: Prefer critical > high > medium
    const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0, blocked: -1 }
    const aPriority = priorityOrder[a.postWorthiness] || 0
    const bPriority = priorityOrder[b.postWorthiness] || 0
    if (bPriority !== aPriority) {
      return bPriority - aPriority
    }
    
    // Tertiary: Prefer newer items (if added_date available)
    if (a.menuItem?.item_added_date && b.menuItem?.item_added_date) {
      return new Date(b.menuItem.item_added_date).getTime() - 
             new Date(a.menuItem.item_added_date).getTime()
    }
    
    // Quaternary: Alphabetical (ensures determinism)
    return a.itemName.localeCompare(b.itemName)
  })
  
  // Add variety: Use slot index to offset selection
  // Slot 0 → pick #1, Slot 1 → pick #2, etc. (with wraparound)
  // This gives variety WITHOUT randomness
  const varietyOffset = slotIndex % Math.min(sorted.length, 3)
  return sorted[varietyOffset]
}

function selectBestCompoundOpportunity(
  available: CompoundOpportunity[],
  slotIndex: number,
  date: Date
): CompoundOpportunity {
  // Sort by score (primary) and secondary factors (deterministic)
  const sorted = available.sort((a, b) => {
    // Primary: Higher score wins
    if (b.score !== a.score) {
      return b.score - a.score
    }
    
    // Secondary: Prefer critical > high > medium
    const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 }
    const aPriority = priorityOrder[a.priority] || 0
    const bPriority = priorityOrder[b.priority] || 0
    if (bPriority !== aPriority) {
      return bPriority - aPriority
    }
    
    // Tertiary: Alphabetical by subject (ensures determinism)
    return a.subject.localeCompare(b.subject)
  })
  
  // Add variety: Use slot index to offset selection
  const varietyOffset = slotIndex % Math.min(sorted.length, 3)
  return sorted[varietyOffset]
}

function fillSlotsWithOpportunities(
  allocation: SlotAllocation,
  menuScores: MenuItemScore[],
  compoundOpportunities: CompoundOpportunity[],
  weekStartDate: Date,
  minimumScore: number,
  platformStrategy: 'instagram_only' | 'facebook_only' | 'dual_version',
  recentlyPosted: Set<string>,
  context: any,
  platforms: string[] = ['instagram']
): PostSlot[] {
  const slots: PostSlot[] = []
  let slotIndex = 0
  
  console.log('[SlotFilling] Starting with platforms:', platforms)
  
  // =====================================================
  // ✨ NEW: DETERMINE SERVICE PERIOD TARGETING
  // =====================================================
  const businessProfile = context?.businessProfile || {}
  const servicePeriods = businessProfile?.service_periods || {}
  const hasServicePeriods = Object.keys(servicePeriods).length > 0
  
  // Map content types to preferred service periods
  const contentTypeToServicePeriod: Record<string, string[]> = {}
  
  if (hasServicePeriods) {
    console.log('[SlotFilling] Service periods available:', Object.keys(servicePeriods))
    
    // Brunch-focused menu items
    if (servicePeriods.brunch) {
      contentTypeToServicePeriod['menu_item'] = ['brunch']
      console.log('[SlotFilling] Brunch available - menu_item slots will prioritize brunch items')
    }
    // Lunch-focused menu items (fallback if no brunch)
    else if (servicePeriods.lunch) {
      contentTypeToServicePeriod['menu_item'] = ['lunch']
      console.log('[SlotFilling] Lunch available (no brunch) - menu_item slots will use lunch items')
    }
    // Dinner items
    if (servicePeriods.dinner) {
      contentTypeToServicePeriod['product_beauty'] = ['dinner']
      console.log('[SlotFilling] Dinner available - product_beauty slots will use dinner items')
    }
    // All-day fallback
    else if (servicePeriods.lunch) {
      contentTypeToServicePeriod['product_beauty'] = ['lunch']
    }
  } else {
    console.log('[SlotFilling] No service periods defined, menu items will not be filtered by period')
  }
  
  console.log('[SlotFilling] Content type → Service period mapping:', contentTypeToServicePeriod)
  
  // =====================================================
  // STEP 1: Determine platform distribution strategy
  // =====================================================
  const hasBothPlatforms = platforms.includes('instagram') && platforms.includes('facebook')
  const hasOnlyInstagram = platforms.includes('instagram') && !platforms.includes('facebook')
  const hasOnlyFacebook = platforms.includes('facebook') && !platforms.includes('instagram')
  
  // ✨ STEP 2: Create platform rotation array
  let platformRotation: ('instagram' | 'facebook')[]
  
  if (hasBothPlatforms) {
    // 60% Instagram, 40% Facebook (for 7 posts: 4 IG, 3 FB)
    platformRotation = [
      'instagram',  // 1
      'instagram',  // 2
      'facebook',   // 3
      'instagram',  // 4
      'instagram',  // 5
      'facebook',   // 6
      'facebook'    // 7
    ]
    console.log('[SlotFilling] Using mixed platform strategy: 4 Instagram, 3 Facebook')
  } else if (hasOnlyInstagram) {
    platformRotation = [
      'instagram', 'instagram', 'instagram', 
      'instagram', 'instagram', 'instagram', 
      'instagram'
    ]
    console.log('[SlotFilling] Instagram-only strategy')
  } else if (hasOnlyFacebook) {
    platformRotation = [
      'facebook', 'facebook', 'facebook', 
      'facebook', 'facebook', 'facebook', 
      'facebook'
    ]
    console.log('[SlotFilling] Facebook-only strategy')
  } else {
    // Fallback (shouldn't happen, but safe default)
    platformRotation = [
      'instagram', 'instagram', 'instagram', 
      'instagram', 'instagram', 'instagram', 
      'instagram'
    ]
    console.warn('[SlotFilling] No platforms specified, defaulting to Instagram')
  }
  
  // ✨ STEP 3: Map content types to opportunity sources
  const contentTypeMapping: Record<string, 'menu' | 'compound'> = {
    menu_item: 'menu',
    product_beauty: 'menu',
    atmosphere_experience: 'compound',
    behind_the_scenes: 'compound',
    promotional: 'compound',
    event_announcement: 'compound',
    location_announcement: 'compound'
  }
  
  // ✨ STEP 4: Filter opportunities by minimum score
  const eligibleMenuItems = menuScores.filter(m => 
    m.postWorthiness !== 'blocked' && m.finalScore >= minimumScore
  )
  const eligibleCompoundOpps = compoundOpportunities.filter(c => c.score >= minimumScore)
  
  console.log('[SlotFilling] Eligible opportunities:', {
    menuItems: eligibleMenuItems.length,
    compoundOpps: eligibleCompoundOpps.length,
    total: eligibleMenuItems.length + eligibleCompoundOpps.length
  })
  
  // ✨ STEP 5: Fill each slot type
  for (const [contentType, count] of Object.entries(allocation.distribution)) {
    const source = contentTypeMapping[contentType] || 'compound'
    
    console.log('[SlotFilling] Filling', count, contentType, 'slots from', source, 'source')
    
    for (let i = 0; i < count; i++) {
      const slot: PostSlot = {
        slotId: `slot-${slotIndex}`,
        dayOfWeek: 0, // Will be assigned in timing step
        hour: 12, // Default, will be adjusted in timing step
        date: new Date(weekStartDate),
        contentType,
        platform: platformRotation[slotIndex] || platforms[0], // ✨ Use rotation
        selectedOpportunity: null,
        alternativeOpportunities: [],
        selectionReason: '',
        expectedPerformance: 'medium',
        confidenceScore: 50
      }
      
      console.log('[SlotFilling] Slot', slotIndex, '- Platform:', slot.platform)
      
      slotIndex++
      
      // ✨ STEP 6: Select best opportunity for this slot
      if (source === 'menu') {
        // ✨ Filter by service period if mapping exists for this content type
        const targetServicePeriods = contentTypeToServicePeriod[contentType]
        
        // Find highest-scoring menu item not yet selected
        let available = eligibleMenuItems.filter(m => 
          !slots.some(s => (s.selectedOpportunity as MenuItemScore)?.itemName === m.itemName) &&
          !recentlyPosted.has(m.itemName)
        )
        
        // ✨ Apply service period filtering if target periods are defined
        if (targetServicePeriods && targetServicePeriods.length > 0) {
          const beforeFiltering = available.length
          const hasServicePeriodData = available.some(m => m.service_periods && m.service_periods.length > 0)
          
          if (hasServicePeriodData) {
            const servicePeriodFiltered = available.filter(m => 
              m.service_periods && targetServicePeriods.some(period => m.service_periods.includes(period))
            )
            
            // Only apply filter if we get results (fallback to all items if no matches)
            if (servicePeriodFiltered.length > 0) {
              available = servicePeriodFiltered
              console.log(`[SlotFilling] ✅ Filtered ${contentType} by service periods ${targetServicePeriods.join('/')}: ${beforeFiltering} → ${available.length} items`)
            } else {
              console.warn(`[SlotFilling] ⚠️ No items found for service periods [${targetServicePeriods.join(', ')}], using all ${beforeFiltering} items`)
            }
          } else {
            console.log(`[SlotFilling] ⚠️ Menu items missing service_periods data, skipping period filtering`)
          }
        }
        
        if (available.length > 0) {
          // ✨ Deterministic sorting (no randomness!)
          const sorted = available.sort((a, b) => {
            // Primary: Higher score wins
            if (b.finalScore !== a.finalScore) {
              return b.finalScore - a.finalScore
            }
            
            // Secondary: Priority level
            const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 }
            const aPriority = priorityOrder[a.postWorthiness] || 0
            const bPriority = priorityOrder[b.postWorthiness] || 0
            if (bPriority !== aPriority) {
              return bPriority - aPriority
            }
            
            // Tertiary: Alphabetical (ensures determinism)
            return a.itemName.localeCompare(b.itemName)
          })
          
          const selected = sorted[0]
          
          slot.selectedOpportunity = selected
          slot.alternativeOpportunities = sorted.slice(1, 4) // Top 3 alternatives
          slot.selectionReason = `Top scoring: ${selected.reason}`
          slot.expectedPerformance = selected.postWorthiness === 'critical' ? 'critical' : 
                                    selected.postWorthiness === 'high' ? 'high' : 'medium'
          slot.confidenceScore = Math.min(selected.finalScore / 2, 100)
          
          console.log('[SlotFilling] Selected menu item:', selected.itemName, '- Score:', selected.finalScore)
        } else {
          console.warn('[SlotFilling] No available menu items for slot', slotIndex - 1)
        }
      } else {
        // Find highest-scoring compound opportunity matching content type
        const available = eligibleCompoundOpps.filter(c => 
          c.contentTypes.includes(contentType) &&
          !slots.some(s => (s.selectedOpportunity as CompoundOpportunity)?.id === c.id)
        )
        
        if (available.length > 0) {
          // ✨ Deterministic sorting
          const sorted = available.sort((a, b) => {
            // Primary: Higher score wins
            if (b.score !== a.score) {
              return b.score - a.score
            }
            
            // Secondary: Priority level
            const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 }
            const aPriority = priorityOrder[a.priority] || 0
            const bPriority = priorityOrder[b.priority] || 0
            if (bPriority !== aPriority) {
              return bPriority - aPriority
            }
            
            // Tertiary: ID (ensures determinism)
            return a.id.localeCompare(b.id)
          })
          
          const selected = sorted[0]
          
          slot.selectedOpportunity = selected
          slot.alternativeOpportunities = sorted.slice(1, 4)
          slot.selectionReason = selected.contentAngle
          slot.expectedPerformance = selected.priority === 'critical' ? 'critical' : 
                                    selected.priority === 'high' ? 'high' : 'medium'
          slot.confidenceScore = Math.min(selected.score / 2, 100)
          
          // Override platform if compound opportunity has preference
          if (selected.platformPriority && selected.platformPriority !== 'both') {
            slot.platform = selected.platformPriority
          }
          
          console.log('[SlotFilling] Selected compound opp:', selected.contentAngle, '- Score:', selected.score)
        } else {
          console.warn('[SlotFilling] No available compound opportunities for', contentType)
        }
      }
      
      slots.push(slot)
    }
  }
  
  // ✨ Summary log
  const filled = slots.filter(s => s.selectedOpportunity !== null).length
  const instagramCount = slots.filter(s => s.platform === 'instagram').length
  const facebookCount = slots.filter(s => s.platform === 'facebook').length
  
  console.log('[SlotFilling] Summary:', {
    totalSlots: slots.length,
    filled,
    unfilled: slots.length - filled,
    platforms: {
      instagram: instagramCount,
      facebook: facebookCount
    }
  })
  
  return slots
}

// =====================================================
// STEP 4: APPLY SEQUENCING RULES
// =====================================================

function extractSubject(opportunity: any): string {
  if ('itemName' in opportunity) {
    return opportunity.itemName
  } else if ('subject' in opportunity) {
    return opportunity.subject
  }
  return ''
}

function detectSemanticDuplicates(
  slots: PostSlot[]
): { slotId: string; duplicateOf: string }[] {
  const duplicates: { slotId: string; duplicateOf: string }[] = []
  
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const slotA = slots[i]
      const slotB = slots[j]
      
      if (!slotA.selectedOpportunity || !slotB.selectedOpportunity) continue
      
      const subjectA = extractSubject(slotA.selectedOpportunity)
      const subjectB = extractSubject(slotB.selectedOpportunity)
      
      // Check for keyword overlap
      const wordsA = new Set(subjectA.toLowerCase().split(/\s+/).filter(w => w.length > 3))
      const wordsB = new Set(subjectB.toLowerCase().split(/\s+/).filter(w => w.length > 3))
      
      const overlap = [...wordsA].filter(word => wordsB.has(word)).length
      const minSize = Math.min(wordsA.size, wordsB.size)
      
      // If >50% word overlap, likely duplicate
      if (minSize > 0 && overlap / minSize > 0.5) {
        duplicates.push({
          slotId: slotB.slotId,
          duplicateOf: slotA.slotId
        })
      }
    }
  }
  
  return duplicates
}

function applySequencingRules(slots: PostSlot[]): PostSlot[] {
  // Rule 1: No consecutive identical content types
  const reordered = [...slots]
  
  for (let i = 1; i < reordered.length; i++) {
    if (reordered[i].contentType === reordered[i - 1].contentType) {
      // Find next different content type and swap
      for (let j = i + 1; j < reordered.length; j++) {
        if (reordered[j].contentType !== reordered[i - 1].contentType) {
          [reordered[i], reordered[j]] = [reordered[j], reordered[i]]
          break
        }
      }
    }
  }
  
  // Rule 2: Critical opportunities should be early in week
  const critical = reordered.filter(s => s.expectedPerformance === 'critical')
  const nonCritical = reordered.filter(s => s.expectedPerformance !== 'critical')
  
  const prioritized = [...critical, ...nonCritical]
  
  // Rule 3: Semantic duplicate detection
  const duplicates = detectSemanticDuplicates(prioritized)
  
  for (const dup of duplicates) {
    // Remove or swap duplicate slot
    const dupSlot = prioritized.find(s => s.slotId === dup.slotId)
    if (dupSlot && dupSlot.alternativeOpportunities.length > 0) {
      // Swap to first non-duplicate alternative
      dupSlot.selectedOpportunity = dupSlot.alternativeOpportunities[0]
      dupSlot.selectionReason = `Swapped to avoid duplicate content (was similar to ${dup.duplicateOf})`
      dupSlot.alternativeOpportunities = dupSlot.alternativeOpportunities.slice(1)
    }
  }
  
  return prioritized
}

// =====================================================
// STEP 5: ASSIGN OPTIMAL TIMING
// =====================================================

async function assignOptimalTiming(
  slots: PostSlot[], 
  context: any,
  businessId: string,
  supabase: any,
  businessProfile?: any
): Promise<PostSlot[]> {
  const timedSlots = [...slots]
  
  // ✨ Extract service periods from business profile
  const servicePeriods = businessProfile?.service_periods || {}
  const hasServicePeriods = Object.keys(servicePeriods).length > 0
  
  console.log('[Timing] Service periods available:', Object.keys(servicePeriods))
  if (hasServicePeriods) {
    console.log('[Timing] Brunch:', servicePeriods.brunch?.hours)
    console.log('[Timing] Lunch:', servicePeriods.lunch?.hours)
    console.log('[Timing] Dinner:', servicePeriods.dinner?.hours)
    console.log('[Timing] DEBUG - Full brunch object:', JSON.stringify(servicePeriods.brunch))
    console.log('[Timing] DEBUG - brunch.start value:', servicePeriods.brunch?.start)
  }
  
  // ✨ STEP 1: Set default optimal hours per content type
  const optimalHours: Record<string, number> = {
    menu_item: 11,              // Late morning for lunch inspiration
    atmosphere_experience: 17,   // Early evening for FOMO
    behind_the_scenes: 9,        // Morning engagement
    promotional: 14,             // Afternoon decision window
    event_announcement: 10       // Mid-morning awareness
  }
  
  // ✨ STEP 2: Override defaults based on service periods
  if (hasServicePeriods) {
    console.log('[Timing] Customizing hours based on service periods')
    
    // Brunch posts should be early morning (before brunch ends)
    if (servicePeriods.brunch && servicePeriods.brunch.start) {
      const brunchStartHour = parseInt(servicePeriods.brunch.start.split(':')[0])
      // Post brunch content at brunch start time
      optimalHours.menu_item = Math.min(optimalHours.menu_item, brunchStartHour)
      console.log('[Timing] Adjusted menu_item hour to', optimalHours.menu_item, '(brunch start)')
    }
    
    // Lunch posts in late morning
    if (servicePeriods.lunch && servicePeriods.lunch.start) {
      const lunchStartHour = parseInt(servicePeriods.lunch.start.split(':')[0])
      // Use lunch start if it's different from brunch
      if (!servicePeriods.brunch || lunchStartHour !== parseInt(servicePeriods.brunch.start.split(':')[0])) {
        optimalHours.menu_item = lunchStartHour
        console.log('[Timing] Adjusted menu_item hour to', optimalHours.menu_item, '(lunch start)')
      }
    }
    
    // Dinner atmosphere posts in late afternoon (2 hours before dinner)
    if (servicePeriods.dinner && servicePeriods.dinner.start) {
      const dinnerStartHour = parseInt(servicePeriods.dinner.start.split(':')[0])
      const dinnerPostHour = Math.max(14, dinnerStartHour - 2)
      optimalHours.atmosphere_experience = dinnerPostHour
      console.log('[Timing] Adjusted atmosphere_experience hour to', optimalHours.atmosphere_experience, '(2h before dinner)')
    }
  }
  
  console.log('[Timing] Final optimal hours:', optimalHours)
  
  // ✨ STEP 3: Track which days are already used (prevent collisions)
  const usedDays = new Set<number>()
  
  // ✨ STEP 4: Define optimal days by content type (in priority order)
  const optimalDays: Record<string, number[]> = {
    menu_item: [1, 3, 5, 2, 4],           // Mon, Wed, Fri, Tue, Thu
    atmosphere_experience: [4, 5, 6, 0],  // Thu, Fri, Sat, Sun
    behind_the_scenes: [1, 3, 6],         // Mon, Wed, Sat
    promotional: [2, 4, 5],               // Tue, Thu, Fri
    event_announcement: [1, 2]            // Mon, Tue
  }
  
  // ✨ STEP 5: Assign day and hour to each slot
  for (const slot of timedSlots) {
    // Assign hour based on content type
    slot.hour = optimalHours[slot.contentType] || 12
    
    // Get preferred days for this content type
    const preferredDays = optimalDays[slot.contentType] || [1, 2, 3, 4, 5]
    
    let assignedDay: number | null = null
    let dayFound = false
    
    // Find first unused preferred day
    for (const day of preferredDays) {
      if (!usedDays.has(day)) {
        assignedDay = day
        usedDays.add(day)
        dayFound = true
        break
      }
    }
    
    // If all preferred days are taken, find ANY available day (1-6, skip Sunday)
    if (!dayFound) {
      for (let day = 1; day <= 6; day++) {
        if (!usedDays.has(day)) {
          assignedDay = day
          usedDays.add(day)
          dayFound = true
          console.log('[Timing] All preferred days taken, using fallback day', day)
          break
        }
      }
      
      // If even 1-6 are all taken (7+ posts), allow Sunday
      if (!dayFound && !usedDays.has(0)) {
        assignedDay = 0
        usedDays.add(0)
        dayFound = true
        console.log('[Timing] Using Sunday as last resort')
      }
      
      // Absolute fallback (shouldn't happen)
      if (!dayFound) {
        assignedDay = preferredDays[0]
        console.warn('[Timing] Could not find unused day, using', assignedDay, 'anyway')
      }
    }
    
    slot.dayOfWeek = assignedDay as PostSlot['dayOfWeek']
    
    // ✨ STEP 6: Calculate actual date
    const weekStart = slot.date
    slot.date = new Date(weekStart)
    slot.date.setDate(weekStart.getDate() + slot.dayOfWeek)
    slot.date.setHours(slot.hour, 0, 0, 0)
    
    console.log('[Timing] Slot assigned:', {
      contentType: slot.contentType,
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slot.dayOfWeek],
      hour: slot.hour
    })
  }
  
  // ✨ STEP 7: Sort by date (chronological order)
  const sorted = timedSlots.sort((a, b) => a.date.getTime() - b.date.getTime())
  
  console.log('[Timing] Final schedule:')
  sorted.forEach(slot => {
    console.log('  ', ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slot.dayOfWeek], 
                slot.hour + ':00', '-', slot.contentType)
  })
  
  return sorted
}

// =====================================================
// STEP 6: HANDLE EDGE CASES
// =====================================================

async function generateContextualFallback(
  contentType: string,
  businessId: string,
  supabase: any
): Promise<CompoundOpportunity> {
  // Get business context
  const { data: business } = await supabase
    .from('businesses')
    .select('name, business_category, location, brand_voice')
    .eq('id', businessId)
    .single()
  
  // Generate contextual subject based on business type
  let subject = ''
  
  if (contentType === 'behind_the_scenes') {
    if (business?.business_category === 'cafe') {
      subject = '☕ Morgenrutine → Hvordan vi brygger kaffe, morgenforberedelser'
    } else if (business?.business_category === 'food_truck') {
      subject = '🚚 Bag scenen → Dagens forberedelser, hvor vi parkerer'
    } else {
      subject = '👨‍🍳 Køkkenet → Dagens forberedelser, teamet i aktion'
    }
  } else if (contentType === 'atmosphere_experience') {
    if (business?.location?.waterfront) {
      subject = '🌊 Udsigten → Vores placering ved vandet, terrassen'
    } else if (business?.location?.city_center) {
      subject = '🏙️ Beliggenhed → Midt i byen, vores hyggelige hjørne'
    } else {
      subject = '✨ Stemning → Atmosfæren hos os, hvad gør os unikke'
    }
  } else if (contentType === 'promotional') {
    subject = '🎉 Dagens tilbud → Special af dagen, happy hour'
  } else if (contentType === 'event_announcement') {
    subject = '📅 Kommende events → Særlige arrangementer, temadage'
  } else if (contentType === 'team_culture') {
    subject = '👥 Mød teamet → Personlige historier fra køkkenet'
  } else {
    subject = `${contentType} content opportunity`
  }
  
  return {
    id: `fallback-${contentType}-${Date.now()}`,
    type: 'generic',
    subject,
    contentTypes: [contentType],
    contentAngle: `${contentType} fallback content`,
    platformPriority: 'instagram',
    score: 50,
    priority: 'medium',
    triggers: ['insufficient_opportunities'],
    timing: { dayOfWeek: [1, 2, 3, 4, 5], hourOfDay: [10, 12, 14] },
    reasoning: 'Generated contextual fallback based on business type'
  }
}

async function handleEdgeCases(
  slots: PostSlot[],
  menuScores: MenuItemScore[],
  compoundOpportunities: CompoundOpportunity[],
  businessId: string,
  supabase: any,
  userOverrides?: Partial<PostSlot>[]
): PostSlot[] {
  const finalSlots = [...slots]
  
  // Edge case 1: Unfilled slots (insufficient opportunities)
  for (const slot of finalSlots) {
    if (!slot.selectedOpportunity) {
      // Try to fill with any available opportunity from the same content type first
      const allOpportunities = [...menuScores, ...compoundOpportunities]
      
      // First: Try unused opportunities of the same content type
      let unused = allOpportunities.filter(opp => {
        const oppTypes = (opp as any).contentTypes || [slot.contentType]
        return oppTypes.includes(slot.contentType) &&
          !finalSlots.some(s => 
            (s.selectedOpportunity as any)?.itemName === (opp as any)?.itemName ||
            (s.selectedOpportunity as any)?.id === (opp as any)?.id
          )
      })
      
      // Second: If no match, try ANY unused opportunity
      if (unused.length === 0) {
        unused = allOpportunities.filter(opp => 
          !finalSlots.some(s => 
            (s.selectedOpportunity as any)?.itemName === (opp as any)?.itemName ||
            (s.selectedOpportunity as any)?.id === (opp as any)?.id
          )
        )
      }
      
      // Third: If still nothing, create a contextual fallback opportunity
      if (unused.length === 0) {
        const syntheticOpportunity = await generateContextualFallback(
          slot.contentType,
          businessId,
          supabase
        )
        slot.selectedOpportunity = syntheticOpportunity
        slot.selectionReason = 'AI-generated contextual fallback'
        slot.confidenceScore = calculateConfidenceScore(syntheticOpportunity, 0, false)
      } else {
        slot.selectedOpportunity = unused[0]
        slot.selectionReason = 'Fallback: Best available opportunity'
        slot.confidenceScore = calculateConfidenceScore(unused[0], 0, false)
      }
    }
  }
  
  // Edge case 2: User overrides
  if (userOverrides && userOverrides.length > 0) {
    for (const override of userOverrides) {
      const slot = finalSlots.find(s => s.slotId === override.slotId)
      if (slot) {
        Object.assign(slot, override)
        slot.selectionReason = `User override: ${override.selectionReason || 'Manual selection'}`
      }
    }
  }
  
  return finalSlots
}

// =====================================================
// GENERATE FINAL PLAN
// =====================================================

function isBalanced(dist: { instagram: number; facebook: number; both: number }): boolean {
  const total = dist.instagram + dist.facebook + dist.both
  if (total === 0) return true
  return Math.abs(dist.instagram - dist.facebook) <= total * 0.3 // Within 30%
}

function calculateTemporalSpread(slots: PostSlot[]): number {
  // Calculate how well-spaced posts are across the week
  const days = slots.map(s => s.dayOfWeek)
  const uniqueDays = new Set(days).size
  return (uniqueDays / 7) * 100 // Percentage of week covered
}

function generateWeeklyPlan(
  businessId: string,
  weekStartDate: Date,
  slots: PostSlot[]
): WeeklyContentPlan {
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekStartDate.getDate() + 7)
  
  // Calculate summary statistics
  const filledSlots = slots.filter(s => s.selectedOpportunity !== null).length
  const menuItemSlots = slots.filter(s => s.contentType === 'menu_item').length
  const nonMenuSlots = slots.length - menuItemSlots
  const criticalOpportunities = slots.filter(s => s.expectedPerformance === 'critical').length
  
  const platformDist = {
    instagram: slots.filter(s => s.platform === 'instagram').length,
    facebook: slots.filter(s => s.platform === 'facebook').length,
    both: slots.filter(s => s.platform === 'both').length
  }
  
  // Generate warnings
  const warnings: string[] = []
  if (filledSlots < slots.length) {
    warnings.push(`⚠️ ${slots.length - filledSlots} slots unfilled - insufficient opportunities`)
  }
  if (criticalOpportunities === 0) {
    warnings.push('ℹ️ No critical opportunities detected - standard week')
  }
  
  // Generate suggestions
  const suggestions: string[] = []
  if (menuItemSlots < 3) {
    suggestions.push('Consider adding more menu item metadata to enable menu scoring')
  }
  if (criticalOpportunities > 0) {
    suggestions.push(`📍 ${criticalOpportunities} time-sensitive opportunities - prioritize these`)
  }
  
  return {
    businessId,
    weekStartDate,
    weekEndDate,
    slots,
    summary: {
      totalSlots: slots.length,
      filledSlots,
      menuItemSlots,
      nonMenuSlots,
      criticalOpportunities,
      platformDistribution: platformDist,
      qualityMetrics: {
        averageConfidence: slots.length > 0 
          ? Math.round(slots.reduce((sum, s) => sum + s.confidenceScore, 0) / slots.length)
          : 0,
        highConfidenceSlots: slots.filter(s => s.confidenceScore >= 70).length,
        criticalOpportunitiesSeized: criticalOpportunities,
        contentVariety: new Set(slots.map(s => s.contentType)).size,
        platformBalance: isBalanced(platformDist),
        temporalSpread: Math.round(calculateTemporalSpread(slots))
      }
    },
    warnings,
    suggestions
  }
}

// =====================================================
// EXPORT
// =====================================================

export default {
  selectWeeklyOpportunities
}
