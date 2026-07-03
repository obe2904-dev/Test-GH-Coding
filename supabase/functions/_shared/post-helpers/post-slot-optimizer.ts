/**
 * LAYER 6: POST SLOT OPTIMIZER
 * 
 * Takes Layer 5's weekly plan and applies sophisticated day-of-week
 * and time-of-day optimization based on:
 * - Content type patterns (menu vs atmosphere vs behind-scenes)
 * - Danish dining culture
 * - Business hours constraints
 * - Historical performance data
 * - Platform best practices
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface WeeklyPlan {
  businessId: string
  weekStartDate: Date
  slots: PostSlot[]
}

export interface PostSlot {
  contentType: string
  opportunity: any
  score: number
  platform: string
  dayOfWeek: number
  hour: number
  layer0Day?: number  // If set, optimizer preserves this day (PATH A / Layer 0 strategic date)
  layer0Hour?: number // If set, optimizer uses this hour directly (from strategy AI's suggested_time)
  ctaIntent?: string  // If set and layer0Hour is absent, applies CTA-based timing override
}

export interface OptimizedPostSlot extends PostSlot {
  scheduledDate: Date
  optimizationReason: string
}

export interface OptimizedWeeklyPlan {
  businessId: string
  weekStartDate: Date
  slots: OptimizedPostSlot[]
}

interface BusinessHours {
  open_breakfast: boolean
  open_lunch: boolean
  open_dinner: boolean
  opening_hour?: number
  closing_hour?: number
}

interface PerformanceData {
  optimal_posting_times?: Record<string, number>
}

// ============================================================================
// DAY SELECTION RULES
// ============================================================================

/**
 * Optimal days for each content type
 * Based on Danish dining patterns and engagement data
 */
const DAY_PATTERNS: Record<string, number[]> = {
  // Menu content - decision days (Mon/Wed/Fri rhythm)
  menu_highlight: [1, 3, 5],
  breakfast_menu: [1, 3, 5],
  lunch_menu: [1, 2, 3, 4, 5], // Any weekday
  dinner_menu: [1, 3, 5],
  
  // Location & atmosphere - weekend momentum builders
  location_story: [4, 5], // Thu/Fri
  atmosphere: [4, 5, 6], // Thu/Fri/Sat
  
  // Behind-scenes - weekend engagement
  behind_scenes: [0, 6], // Sat/Sun
  
  // Events & promotions
  event_promotion: [1, 4, 5], // Mon (week-long), Thu/Fri (weekend)
  
  // Engagement - mid-week
  engagement: [2, 4], // Tue/Thu
  
  // MFV specific
  location_announcement: [0], // Same day or next day

  // PATH A content type aliases (get-weekly-strategy vocabulary)
  behind_the_scenes: [0, 6],      // Weekend engagement
  atmosphere_experience: [4, 5, 6], // Thu/Fri/Sat FOMO builders
  menu_item: [1, 3, 5],           // Mon/Wed/Fri decision days
  promotional: [1, 4, 5],         // Mon + Thu/Fri
}

/**
 * Select optimal day for content type
 */
function selectOptimalDay(
  contentType: string,
  businessType: string,
  fallbackDay: number
): number {
  const pattern = DAY_PATTERNS[contentType]
  
  if (!pattern || pattern.length === 0) {
    return fallbackDay
  }
  
  // For MFV location announcements, respect same-day posting
  if (contentType === 'location_announcement' && businessType === 'MFV') {
    return fallbackDay // Keep Layer 5's assignment
  }
  
  // Find closest match to fallback day
  let closestDay = pattern[0]
  let minDistance = Math.abs(pattern[0] - fallbackDay)
  
  for (const day of pattern) {
    const distance = Math.abs(day - fallbackDay)
    if (distance < minDistance) {
      minDistance = distance
      closestDay = day
    }
  }
  
  return closestDay
}

// ============================================================================
// TIME OPTIMIZATION RULES
// ============================================================================

/**
 * Optimal hours for each content type
 */
const TIME_RULES: Record<string, number[]> = {
  // Breakfast - morning awareness
  breakfast_menu: [7, 8, 9],
  
  // Lunch - immediate decision window
  lunch_menu: [11, 12],
  
  // Dinner - planning window (afternoon)
  dinner_menu: [14, 15, 16, 17],
  menu_highlight: [16, 17], // Default menu posts (dinner focus)
  
  // Atmosphere & FOMO - evening engagement
  atmosphere: [17, 18, 19],
  location_story: [18, 19],
  
  // Behind-scenes - flexible, morning for weekends
  behind_scenes: [9, 10, 11],
  
  // Engagement - lunch or evening
  engagement: [12, 18],
  
  // Events - depends on event timing
  event_promotion: [18, 19],
  
  // MFV - real-time or morning announcement
  location_announcement: [8, 9, 10],

  // PATH A content type aliases (get-weekly-strategy vocabulary)
  behind_the_scenes: [9, 10, 11],
  atmosphere_experience: [17, 18, 19],
  menu_item: [16, 17],
  promotional: [12, 13, 18, 19],
}

/**
 * Platform-specific time adjustments
 */
const PLATFORM_PEAK_HOURS: Record<string, number[]> = {
  instagram: [11, 12, 13, 18, 19, 20],
  facebook: [12, 13, 19, 20],
}

/**
 * Select optimal hour for content type and platform
 */
function selectOptimalHour(
  contentType: string,
  platform: string
): number {
  const contentHours = TIME_RULES[contentType]
  const platformHours = PLATFORM_PEAK_HOURS[platform] || []
  
  if (!contentHours || contentHours.length === 0) {
    // Fallback to platform peak
    return platformHours[0] || 18
  }
  
  // Find overlap between content timing and platform peaks
  const overlap = contentHours.filter(h => platformHours.includes(h))
  
  if (overlap.length > 0) {
    // Prefer overlapping hours
    return overlap[Math.floor(overlap.length / 2)]
  }
  
  // No overlap - use content timing priority
  return contentHours[Math.floor(contentHours.length / 2)]
}

// ============================================================================
// BUSINESS HOURS CONSTRAINTS
// ============================================================================

/**
 * Respect business opening hours
 */
function respectOpeningHours(
  proposedHour: number,
  contentType: string,
  businessHours: BusinessHours
): number {
  // Don't post breakfast content if not serving breakfast
  if (contentType === 'breakfast_menu' && !businessHours.open_breakfast) {
    return 11 // Move to lunch time
  }
  
  // Don't post lunch content if closed during lunch
  if (contentType === 'lunch_menu' && !businessHours.open_lunch) {
    return 16 // Move to dinner planning
  }
  
  // Don't post dinner menu after closing
  if (contentType === 'dinner_menu' && businessHours.closing_hour) {
    if (businessHours.closing_hour < 19 && proposedHour >= 17) {
      return 14 // Earlier dinner planning
    }
  }
  
  // Don't post before opening (for location announcements)
  if (businessHours.opening_hour && proposedHour < businessHours.opening_hour) {
    return businessHours.opening_hour
  }
  
  return proposedHour
}

// ============================================================================
// HISTORICAL PERFORMANCE OPTIMIZATION
// ============================================================================

/**
 * Apply historical performance data if available
 */
function applyPerformanceOptimization(
  contentType: string,
  defaultHour: number,
  performanceData: PerformanceData | null
): number {
  if (!performanceData || !performanceData.optimal_posting_times) {
    return defaultHour
  }
  
  const bestHour = performanceData.optimal_posting_times[contentType]
  
  if (bestHour !== undefined) {
    // Only shift by max 3 hours from default (stay within reasonable window)
    const hourDiff = Math.abs(bestHour - defaultHour)
    if (hourDiff <= 3) {
      return bestHour
    }
  }
  
  return defaultHour
}

// ============================================================================
// OPTIMIZATION REASON GENERATION
// ============================================================================

/**
 * Generate human-readable explanation of why this time was chosen
 */
function generateOptimizationReason(
  contentType: string,
  day: number,
  hour: number,
  wasAdjusted: boolean
): string {
  const days = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
  const dayName = days[day]
  
  // Time period description (user-friendly labels)
  let timePeriod = 'optimalt tidspunkt'
  if (hour >= 7 && hour <= 9) timePeriod = 'morgentid'
  else if (hour >= 11 && hour <= 12) timePeriod = 'frokosttid'
  else if (hour >= 14 && hour <= 17) timePeriod = 'eftermiddag'
  else if (hour >= 17 && hour <= 19) timePeriod = 'aftentid'
  else if (hour >= 19 && hour <= 21) timePeriod = 'sen aften'
  
  // Content type specific reasons
  const reasons: Record<string, string> = {
    menu_highlight: `Menupost ${dayName} ${timePeriod}`,
    menu_item: `Menuret planlagt ${dayName} ${timePeriod}`,
    product_menu: `Menuprodukt ${dayName} ${timePeriod}`,
    craving_visual: `Sensorisk post ${dayName} ${timePeriod}`,
    dinner_menu: `Aftenmenu ${dayName} til måltidsplanlægning`,
    lunch_menu: `Frokosttilbud ${dayName} i beslutningsvindue`,
    breakfast_menu: `Morgenmad ${dayName} ved morgen-scroll`,
    atmosphere: `Stemningspost ${dayName} ${timePeriod}`,
    location_story: `Lokationshistorie ${dayName} ved peak-engagement`,
    behind_scenes: `Storytelling ${dayName} ved weekendengagement`,
    engagement: `Interaktivt indhold ${dayName} ved engagement-peak`,
    event_promotion: `Eventpromovering ${dayName} med optimal synlighed`,
  }
  
  // User-friendly fallback for unmapped content types
  const fallbackReason = `Post planlagt ${dayName} ${timePeriod}`
  let reason = reasons[contentType] || fallbackReason
  
  if (wasAdjusted) {
    reason += ' (justeret for åbningstider/performance)'
  }
  
  return reason
}

// ============================================================================
// MAIN OPTIMIZATION FUNCTION
// ============================================================================

/**
 * Optimize weekly schedule with day and time refinements
 */
export async function optimizeWeeklySchedule(
  weeklyPlan: WeeklyPlan,
  supabaseClient: any
): Promise<OptimizedWeeklyPlan> {
  
  // Fetch business context
  const { data: business } = await supabaseClient
    .from('businesses')
    .select('id')
    .eq('id', weeklyPlan.businessId)
    .single()
  
  const { data: businessProfile } = await supabaseClient
    .from('business_profile')
    .select('business_type')
    .eq('business_id', weeklyPlan.businessId)
    .single()
  
  const businessType = businessProfile?.business_type || 'FSE'
  
  const { data: operations } = await supabaseClient
    .from('business_operations')
    .select('open_breakfast, open_lunch, open_dinner, opening_hour, closing_hour')
    .eq('business_id', weeklyPlan.businessId)
    .single()
  
  const businessHours: BusinessHours = operations || {
    open_breakfast: false,
    open_lunch: true,
    open_dinner: true,
  }
  
  // Fetch performance data if available (Layer 4)
  const { data: baselines } = await supabaseClient
    .from('content_type_baselines')
    .select('optimal_posting_times')
    .eq('business_id', weeklyPlan.businessId)
    .single()
  
  const performanceData: PerformanceData | null = baselines || null
  
  // ============================================================================
  // PRIORITY SORTING: Booking/footfall posts claim days first
  // ============================================================================
  const getPriority = (slot: any): number => {
    if (slot.ctaIntent === 'booking') return 1        // Highest priority
    if (slot.ctaIntent === 'traffic') return 2        // Second priority (footfall)
    if (slot.ctaIntent === 'event_promo') return 3    // Third priority
    return 4                                          // Lowest priority (engagement, awareness, etc.)
  }
  
  // Sort slots by priority (lower number = higher priority) BEFORE optimization
  // This ensures booking posts claim their preferred days before other posts
  const sortedSlots = [...weeklyPlan.slots].sort((a, b) => {
    const priorityDiff = getPriority(a) - getPriority(b)
    if (priorityDiff !== 0) return priorityDiff
    // If same priority, preserve original order
    return 0
  })
  
  // Track original index for each slot to maintain mapping after re-sorting
  const slotToOriginalIndex = new Map<any, number>()
  weeklyPlan.slots.forEach((slot, idx) => {
    slotToOriginalIndex.set(slot, idx)
  })
  
  // Track used DAYS to prevent collisions (one post per day maximum)
  const usedDays = new Set<number>()
  
  // Optimize each slot with collision detection
  const optimizedSlots: OptimizedPostSlot[] = []
  
  for (const slot of sortedSlots) {
    // Phase 1: Refine day selection
    const originalDay = slot.dayOfWeek
    // If Layer 0 assigned a strategic date, preserve it (skip generic pattern override)
    let optimalDay = slot.layer0Day !== undefined
      ? slot.layer0Day
      : selectOptimalDay(slot.contentType, businessType, originalDay)
    
    // Phase 2: Optimize time
    const originalHour = slot.hour
    let optimalHour: number

    // Step 1: Honor strategy AI's explicitly suggested time (highest priority)
    if (slot.layer0Hour !== undefined) {
      optimalHour = slot.layer0Hour
    } else if (slot.ctaIntent) {
      // Step 3: CTA-intent based timing override
      const openHour = businessHours.opening_hour ?? 11
      if (slot.ctaIntent === 'booking') {
        // Booking CTA: planning phase — weekday morning
        optimalHour = 9
        if (optimalDay > 3) optimalDay = 2 // Push to Mon-Wed if currently late week
      } else if (slot.ctaIntent === 'event_promo') {
        // Event promo: lead-up evening
        optimalHour = 18
      } else if (slot.ctaIntent === 'engagement') {
        // Pure engagement: peak scroll window
        optimalHour = slot.platform === 'instagram' ? 19 : 12
      } else if (slot.ctaIntent === 'traffic') {
        // Drive-traffic: hunger window, 2h before service start
        optimalHour = Math.max(openHour - 2, 9)
      } else if (slot.ctaIntent === 'awareness') {
        // Awareness: broadest reach, Thu/Fri evening
        optimalHour = 18
        if (optimalDay < 4) optimalDay = 4 // Thu or later
      } else {
        optimalHour = selectOptimalHour(slot.contentType, slot.platform)
      }
    } else {
      optimalHour = selectOptimalHour(slot.contentType, slot.platform)
    }
    
    // Apply business hours constraints
    optimalHour = respectOpeningHours(
      optimalHour,
      slot.contentType,
      businessHours
    )
    
    // Apply historical performance optimization
    optimalHour = applyPerformanceOptimization(
      slot.contentType,
      optimalHour,
      performanceData
    )
    
    // Phase 3: COLLISION DETECTION AND RESOLUTION (one post per day maximum)
    let collisionAttempts = 0
    const maxAttempts = 7 // Max 7 days in a week
    
    // Check if this day is already taken
    while (usedDays.has(optimalDay) && collisionAttempts < maxAttempts) {
      collisionAttempts++
      
      // Move to next day (preserve time)
      optimalDay = (optimalDay + 1) % 7
      
      // CRITICAL: Preserve layer0Hour (strategy AI's explicit time) even when moving days
      // Only recalculate hour if no layer0Hour was provided
      if (slot.layer0Hour === undefined) {
        optimalHour = selectOptimalHour(slot.contentType, slot.platform)
        optimalHour = respectOpeningHours(optimalHour, slot.contentType, businessHours)
        optimalHour = applyPerformanceOptimization(slot.contentType, optimalHour, performanceData)
      }
      // Otherwise keep the layer0Hour value (e.g. lunch at 12:00 stays 12:00 on new day)
    }
    
    // Mark this day as used
    usedDays.add(optimalDay)
    
    const wasAdjusted = (optimalDay !== originalDay) || (optimalHour !== originalHour)
    const hadCollision = collisionAttempts > 0
    
    // Calculate exact scheduled date
    const scheduledDate = new Date(weeklyPlan.weekStartDate)
    scheduledDate.setDate(scheduledDate.getDate() + optimalDay)
    scheduledDate.setHours(optimalHour, 0, 0, 0)
    
    let optimizationReason = generateOptimizationReason(
      slot.contentType,
      optimalDay,
      optimalHour,
      wasAdjusted
    )
    
    // Add collision note if rescheduled
    if (hadCollision) {
      optimizationReason += ` (rescheduled to avoid collision after ${collisionAttempts} attempts)`
    }
    
    optimizedSlots.push({
      ...slot,
      dayOfWeek: optimalDay,
      hour: optimalHour,
      scheduledDate,
      optimizationReason
    })
  }
  
  // CRITICAL: Restore original input order to maintain 1:1 mapping with enrichedSlots array
  // We sorted by priority for optimization, now restore original order for mapping
  optimizedSlots.forEach((slot) => {
    const originalIndex = slotToOriginalIndex.get(
      weeklyPlan.slots.find(s => 
        s.contentType === slot.contentType && 
        s.ctaIntent === slot.ctaIntent &&
        s.platform === slot.platform
      )
    )
    ;(slot as any).originalIndex = originalIndex ?? 0
  })
  
  // Sort back to original order for 1:1 mapping
  optimizedSlots.sort((a, b) => 
    ((a as any).originalIndex ?? 0) - ((b as any).originalIndex ?? 0)
  )
  
  return {
    businessId: weeklyPlan.businessId,
    weekStartDate: weeklyPlan.weekStartDate,
    slots: optimizedSlots
  }
}

// ============================================================================
// EXPORT FOR TESTING
// ============================================================================

export const testHelpers = {
  selectOptimalDay,
  selectOptimalHour,
  respectOpeningHours,
  applyPerformanceOptimization,
  generateOptimizationReason,
  DAY_PATTERNS,
  TIME_RULES,
}
