/**
 * BUSINESS RULES ENGINE
 * 
 * Maps revenue_drivers from business_brand_profile → DayAllocationPlan
 * Replaces hardcoded BASE_SLOTS template with data-driven slot allocation
 * 
 * Supports TWO schema formats:
 * 1. Complex RevenueMoment schema (from analyze-revenue-drivers)
 * 2. Simplified RevenueDriver schema (manual brand profile setup)
 * 
 * Input:  revenue_drivers (from business_brand_profile.revenue_drivers JSONB)
 * Output: SlotTemplate[] with intelligent day/time allocation
 * 
 * Used by: Phase 1 (assignSlotMetadata) and Phase 2a (day allocation)
 */

// Local type definitions to avoid circular dependencies
type GoalMode = 'drive_footfall' | 'build_brand';
type ContentCategory = 'product_menu' | 'craving_visual' | 'behind_scenes' | 'team_people';

// ============================================================================
// SIMPLIFIED SCHEMA (for manual brand profile setup)
// ============================================================================

export interface SimpleRevenueDriver {
  moment: string;
  description: string;
  days: string[];
  service_periods: string[];
  decision_window: {
    type: 'advance_booking' | 'same_day' | 'impulse';
    starts: string;
    ends: string;
    peak_hours?: string[];
    reasoning?: string;
  };
  post_timing: {
    recommended_posts: Array<{
      day: string;
      time: string;
      angle: string;
      reasoning?: string;
    }>;
    minimum_posts: number;
    maximum_posts: number;
  };
  commercial_weight: number;
  revenue_share?: string;
}

export interface SimpleRevenueDrivers {
  primary?: SimpleRevenueDriver;
  secondary?: SimpleRevenueDriver;
  tertiary?: SimpleRevenueDriver;
  normal_week_strategy?: {
    minimum_coverage: {
      weekend_driver: number;
      weekday_presence: number;
      brand_builder: number;
    };
    preferred_day_pattern: string[];
    reasoning?: {
      monday?: string;
      thursday?: string;
      friday?: string;
      saturday?: string;
    };
    avoid_patterns?: {
      consecutive_days: number;
      weekend_gap: boolean;
      front_loaded_week?: boolean;
    };
    expected_distribution_4_posts?: {
      example: string[];
      coverage: string;
    };
  };
  event_week_adjustments?: any;
}

// ============================================================================
// COMPLEX SCHEMA (from analyze-revenue-drivers AI function)
// ============================================================================

/**
 * AI-generated posting strategy — stored in business_brand_profile.posting_strategy.
 * Generated once during brand profile setup; read every week by slot assignment.
 */
export interface PostingStrategy {
  booking_model_type: 'booking_only' | 'walk_in' | 'hybrid';
  slot_windows?: {
    footfall_primary?: string;    // e.g. "Thu-Fri 16:00"
    footfall_secondary?: string;  // e.g. "Fri-Sat 14:00"
    brand_builder?: string;       // e.g. "Mon 09:00"
    brand_builder_secondary?: string;  // e.g. "Wed-Thu 12:00"
  };
  cta_emphasis?: 'walk_in' | 'booking' | 'hybrid';
  rationale?: string;
}

/**
 * Booking model — derived from business_operations.
 */
export interface BookingModel {
  reservation_required?: boolean;
  accepts_walk_ins?: boolean;
  has_booking_link?: boolean;
}

/**
 * Derive posting strategy from booking model when posting_strategy is not yet in DB.
 * Based on hospitality best practice: booking-only → front-load; walk-in → back-load; hybrid → midweek+Thu-Fri.
 */
export function deriveSlotWindowsFromBookingModel(bookingModel: BookingModel | null | undefined): {
  footfall_primary: string;
  footfall_secondary: string;
  brand_builder: string;
  brand_builder_secondary: string;
} {
  const reservationOnly = bookingModel?.reservation_required === true && bookingModel?.accepts_walk_ins !== true;
  const walkInOnly = bookingModel?.accepts_walk_ins === true && bookingModel?.reservation_required !== true && !bookingModel?.has_booking_link;

  if (reservationOnly) {
    // Booking-only: capture planners early in the week (Sun–Tue), not impulsive Fri/Sat scrollers
    return {
      footfall_primary:   'Sun-Mon 19:00',
      footfall_secondary: 'Mon-Tue 12:00',
      brand_builder:      'Sat 10:00',
      brand_builder_secondary: 'Wed 11:00',
    };
  }

  if (walkInOnly) {
    // Walk-in only: back-load to Thu–Sat impulse window; Mon brand recovery
    return {
      footfall_primary:   'Fri-Sat 17:00',
      footfall_secondary: 'Thu-Fri 15:00',
      brand_builder:      'Mon 09:00',
      brand_builder_secondary: 'Wed-Thu 12:00',
    };
  }

  // Hybrid (default): mid-week feed secures reservations; Thu-Fri captures impulse
  return {
    footfall_primary:   'Thu-Fri 16:00',
    footfall_secondary: 'Wed-Thu 12:00',
    brand_builder:      'Mon 09:00',
    brand_builder_secondary: 'Tue-Wed 11:00',
  };
}

interface SlotTemplate {
  slot_id: 'A' | 'B' | 'C' | 'D';
  goal_mode: GoalMode;
  content_category: ContentCategory;
  timing_window: string;
}

export interface RevenueDrivers {
  analyzed_at: string;
  analyzed_from: string;
  confidence_score: number;
  primary_revenue_moments: RevenueMoment[];  // Changed to array for temporal analysis
  primary_revenue_moment?: RevenueMoment;     // Backward compatibility
  secondary_revenue_moments: RevenueMoment[];
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

export interface RevenueMoment {
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

/**
 * Select the best primary moment for Slot A (main weekend driver)
 * Prefers: evening/dinner services on weekends
 */
function selectSlotAPrimary(primaryMoments: RevenueMoment[]): RevenueMoment {
  if (primaryMoments.length === 1) {
    return primaryMoments[0]
  }
  
  // Score each moment for "weekend driver" potential
  const scored = primaryMoments.map(moment => {
    let score = 0
    
    // Prefer dinner/evening services (+3)
    if (moment.service_type === 'dinner' || moment.service_type === 'evening_dining') {
      score += 3
    }
    
    // Prefer weekend operation (+2)
    const hasWeekend = moment.days.some(d => d === 'Friday' || d === 'Saturday' || d === 'Sunday')
    if (hasWeekend) {
      score += 2
    }
    
    // Prefer advance/afternoon decision patterns (+1)
    if (moment.decision_pattern === 'same_day_afternoon' || moment.decision_pattern === 'advance_booking') {
      score += 1
    }
    
    return { moment, score }
  })
  
  // Sort by score, return highest
  scored.sort((a, b) => b.score - a.score)
  
  console.log('[selectSlotAPrimary] Scored moments:', scored.map(s => `${s.moment.label}: ${s.score}`).join(', '))
  console.log(`[selectSlotAPrimary] Selected: ${scored[0].moment.label}`)
  
  return scored[0].moment
}

/**
 * Generate intelligent slot allocation from revenue drivers
 * 
 * Strategy:
 * 1. Primary revenue moment(s) → Slot A (highest priority footfall driver)
 * 2. Secondary revenue moment (if exists) → Slot B (supporting footfall)
 * 3. Brand builder → Slot C (Monday start-of-week awareness)
 * 4. Flexible/loyalty → Slot D (contextual)
 * 
 * Timing windows derived from post_timing_rules (not hardcoded)
 */
export function generateSlotsFromRevenueDrivers(
  revenueDrivers: RevenueDrivers | null | undefined,
  postingStrategy?: PostingStrategy | null,
  bookingModel?: BookingModel | null
): SlotTemplate[] {
  if (!revenueDrivers) {
    console.log('[Business Rules Engine] No revenue_drivers found, falling back to BASE_SLOTS')
    return getBaseSlotsFallback()
  }

  console.log('[Business Rules Engine] Generating slots from revenue drivers')
  
  // Handle both old (primary_revenue_moment) and new (primary_revenue_moments) schema
  const primaryMoments = revenueDrivers.primary_revenue_moments 
    || (revenueDrivers.primary_revenue_moment ? [revenueDrivers.primary_revenue_moment] : [])
  
  if (primaryMoments.length === 0) {
    console.log('[Business Rules Engine] No primary moments found, falling back to BASE_SLOTS')
    return getBaseSlotsFallback()
  }
  
  console.log(`  Primary moments: ${primaryMoments.map(m => m.moment_id).join(', ')}`)
  console.log(`  Secondary count: ${revenueDrivers.secondary_revenue_moments.length}`)
  console.log(`  Confidence: ${revenueDrivers.confidence_score}%`)
  console.log(`  Source: ${revenueDrivers.analyzed_from}`)

  const secondaryMoments = revenueDrivers.secondary_revenue_moments
  const strategy = revenueDrivers.normal_week_strategy

  // Determine slot windows: posting_strategy (AI-assessed) > booking model (derived) > revenue drivers
  const psWindows = postingStrategy?.slot_windows
  const bmWindows = !psWindows ? deriveSlotWindowsFromBookingModel(bookingModel) : null

  const slots: SlotTemplate[] = []

  // ────────────────────────────────────────────────────────────────────
  // SLOT A: Primary Revenue Moment(s) → Weekend/Main Driver
  // Multi-primary support: Pick the most weekend-oriented for Slot A
  // ────────────────────────────────────────────────────────────────────
  
  // Pick primary moment for Slot A (prefer weekend evening services)
  const primaryMoment = selectSlotAPrimary(primaryMoments)
  const primaryTiming = extractBestPostTiming(primaryMoment)
  
  slots.push({
    slot_id: 'A',
    goal_mode: 'drive_footfall',
    content_category: mapServiceTypeToContentCategory(primaryMoment.service_type, 'primary'),
    timing_window: psWindows?.footfall_primary ?? bmWindows?.footfall_primary ?? primaryTiming.timing_window,
    revenue_moment_id: primaryMoment.moment_id,
    revenue_moment_label: primaryMoment.label,
    post_timing_rationale: psWindows?.footfall_primary ? 'From AI posting strategy' : bmWindows?.footfall_primary ? 'Derived from booking model' : primaryTiming.rationale,
  })

  // ────────────────────────────────────────────────────────────────────
  // SLOT B: Secondary Revenue Moment OR Primary Support
  // ────────────────────────────────────────────────────────────────────
  
  let slotBMoment: RevenueMoment | undefined
  let slotBTiming: { timing_window: string; rationale: string }

  if (secondaryMoments.length > 0) {
    // Use first secondary moment for Slot B
    slotBMoment = secondaryMoments[0]
    slotBTiming = extractBestPostTiming(slotBMoment)
  } else {
    // No secondary moments → use primary moment with different timing window
    slotBMoment = primaryMoment
    slotBTiming = extractAlternativePostTiming(primaryMoment, primaryTiming.timing_window)
  }

  slots.push({
    slot_id: 'B',
    goal_mode: 'drive_footfall',
    content_category: mapServiceTypeToContentCategory(slotBMoment.service_type, 'secondary'),
    timing_window: psWindows?.footfall_secondary ?? bmWindows?.footfall_secondary ?? slotBTiming.timing_window,
    revenue_moment_id: slotBMoment.moment_id,
    revenue_moment_label: slotBMoment.label,
    post_timing_rationale: psWindows?.footfall_secondary ? 'From AI posting strategy' : bmWindows?.footfall_secondary ? 'Derived from booking model' : slotBTiming.rationale,
  })

  // ────────────────────────────────────────────────────────────────────
  // SLOT C: Brand Builder (Monday start-of-week)
  // ────────────────────────────────────────────────────────────────────
  
  const brandBuilderTiming = psWindows?.brand_builder ?? bmWindows?.brand_builder ?? getBrandBuilderTiming(strategy.preferred_days)
  
  slots.push({
    slot_id: 'C',
    goal_mode: 'build_brand',
    content_category: 'behind_scenes',
    timing_window: brandBuilderTiming,
    revenue_moment_id: 'brand_awareness',
    revenue_moment_label: 'Brand awareness',
    post_timing_rationale: 'Brand builder',
  })

  // ────────────────────────────────────────────────────────────────────
  // SLOT D: Brand Builder Secondary
  // ────────────────────────────────────────────────────────────────────
  
  // Use mid-week day from preferred_days if available
  const flexibleTiming = psWindows?.brand_builder_secondary ?? bmWindows?.brand_builder_secondary ?? getFlexibleTiming(strategy.preferred_days, [
    primaryTiming.timing_window,
    slotBTiming.timing_window,
    brandBuilderTiming,
  ])

  slots.push({
    slot_id: 'D',
    goal_mode: 'build_brand',
    content_category: 'craving_visual',
    timing_window: flexibleTiming,
    revenue_moment_id: secondaryMoments[1]?.moment_id || primaryMoment.moment_id,
    revenue_moment_label: secondaryMoments[1]?.label || primaryMoment.label,
    post_timing_rationale: 'Mid-week brand depth',
  })

  console.log('[Business Rules Engine] Generated slots:', slots.map(s => 
    `${s.slot_id}(${s.goal_mode}/${s.content_category}): ${s.timing_window}`
  ).join(', '))

  return slots
}

// ────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ────────────────────────────────────────────────────────────────────

/**
 * Extract the best post timing from a revenue moment's post_timing_rules
 * Priority: required > recommended > decision_windows
 */
function extractBestPostTiming(moment: RevenueMoment): {
  timing_window: string;
  rationale: string;
} {
  // Check required timing rules first
  const requiredRule = moment.post_timing_rules.find(r => r.priority === 'required')
  if (requiredRule) {
    return {
      timing_window: requiredRule.timing,
      rationale: requiredRule.purpose,
    }
  }

  // Fall back to recommended rules
  const recommendedRule = moment.post_timing_rules.find(r => r.priority === 'recommended')
  if (recommendedRule) {
    return {
      timing_window: recommendedRule.timing,
      rationale: recommendedRule.purpose,
    }
  }

  // Fall back to highest conversion decision window
  const highConversionWindow = moment.decision_windows
    .filter(w => w.conversion_strength === 'high')
    .sort((a, b) => a.days.length - b.days.length)[0]  // Prefer narrower windows (more specific)

  if (highConversionWindow) {
    const dayStr = highConversionWindow.days.slice(0, 2).join('-')  // "Thu-Fri"
    const timeStr = highConversionWindow.hours.split('-')[0]  // "14:00-18:00" → "14:00"
    return {
      timing_window: `${dayStr} ${timeStr}`,
      rationale: highConversionWindow.description,
    }
  }

  // Last resort: use service days and morning default
  const dayStr = moment.days.slice(0, 2).map(d => d.slice(0, 3)).join('-')  // "Friday-Saturday" → "Fri-Sat"
  return {
    timing_window: `${dayStr} 14:00`,
    rationale: `${moment.label} default timing`,
  }
}

/**
 * Get alternative posting timing for same revenue moment (avoid duplication)
 */
function extractAlternativePostTiming(
  moment: RevenueMoment,
  usedTiming: string
): {
  timing_window: string;
  rationale: string;
} {
  // Find a different timing rule that's not already used
  const alternativeRule = moment.post_timing_rules.find(
    r => r.timing !== usedTiming
  )

  if (alternativeRule) {
    return {
      timing_window: alternativeRule.timing,
      rationale: alternativeRule.purpose,
    }
  }

  // Use medium conversion decision window
  const mediumWindow = moment.decision_windows.find(w => w.conversion_strength === 'medium')
  if (mediumWindow) {
    const dayStr = mediumWindow.days.slice(0, 2).join('-')
    const timeStr = mediumWindow.hours.split('-')[0]
    return {
      timing_window: `${dayStr} ${timeStr}`,
      rationale: mediumWindow.description,
    }
  }

  // Fallback: Wednesday mid-week
  return {
    timing_window: 'Wed 11:00',
    rationale: 'Mid-week visibility',
  }
}

/**
 * Map service_type to content_category
 */
function mapServiceTypeToContentCategory(
  serviceType: string,
  importance: 'primary' | 'secondary'
): ContentCategory {
  // Primary importance → product_menu (strongest conversion)
  if (importance === 'primary') {
    return 'product_menu'
  }

  // Secondary importance → varies by service type
  const mapping: Record<string, ContentCategory> = {
    'dinner': 'product_menu',
    'lunch': 'product_menu',
    'brunch': 'product_menu',
    'breakfast': 'product_menu',
    'morning': 'craving_visual',
    'coffee': 'craving_visual',
    'cocktails': 'craving_visual',
  }

  return mapping[serviceType] || 'product_menu'
}

/**
 * Get brand builder timing (Monday morning preferred)
 */
function getBrandBuilderTiming(preferredDays: string[]): string {
  // Always use Monday for brand awareness (start of week)
  if (preferredDays.includes('Monday')) {
    return 'Mon 09:00'
  }

  // Fallback to first preferred day
  if (preferredDays.length > 0) {
    const day = preferredDays[0].slice(0, 3)  // "Monday" → "Mon"
    return `${day} 09:00`
  }

  return 'Mon 09:00'  // Hard fallback
}

/**
 * Get flexible timing (avoid days already used)
 */
function getFlexibleTiming(
  preferredDays: string[],
  usedTimings: string[]
): string {
  // Extract days already used
  const usedDays = new Set(
    usedTimings
      .map(t => t.split(' ')[0])  // "Thu-Fri 14:00" → "Thu-Fri"
      .flatMap(d => d.split('-'))  // "Thu-Fri" → ["Thu", "Fri"]
      .map(d => d.toLowerCase())
  )

  // Find a preferred day not yet used
  const availableDay = preferredDays.find(day => 
    !usedDays.has(day.slice(0, 3).toLowerCase())
  )

  if (availableDay) {
    const dayAbbr = availableDay.slice(0, 3)  // "Wednesday" → "Wed"
    return `${dayAbbr} 11:00`
  }

  // Fallback: Tuesday or any day
  return 'Tue 11:00'
}

/**
 * Fallback BASE_SLOTS (when revenue_drivers unavailable)
 */
function getBaseSlotsFallback(): SlotTemplate[] {
  console.warn('[Business Rules Engine] Using hardcoded BASE_SLOTS fallback')
  return [
    {
      slot_id: 'A',
      goal_mode: 'drive_footfall',
      content_category: 'product_menu',
      timing_window: 'Fri-Sat 14:00',
      post_timing_rationale: 'Weekend driver (fallback)',
    },
    {
      slot_id: 'B',
      goal_mode: 'drive_footfall',
      content_category: 'product_menu',
      timing_window: 'Wed-Thu 11:00',
      post_timing_rationale: 'Mid-week support (fallback)',
    },
    {
      slot_id: 'C',
      goal_mode: 'build_brand',
      content_category: 'behind_scenes',
      timing_window: 'Mon 09:00',
      post_timing_rationale: 'Brand builder (fallback)',
    },
    {
      slot_id: 'D',
      goal_mode: 'build_brand',
      content_category: 'craving_visual',
      timing_window: 'any',
      post_timing_rationale: 'Flexible (fallback)',
    },
  ]
}

/**
 * Diagnostic report for debugging
 */
export function generateSlotAllocationReport(
  revenueDrivers: RevenueDrivers | null | undefined
): string {
  if (!revenueDrivers) {
    return '[Business Rules Engine] No revenue_drivers available — using BASE_SLOTS fallback'
  }

  const slots = generateSlotsFromRevenueDrivers(revenueDrivers)
  
  // Handle both old and new schema
  const primaryMoments = revenueDrivers.primary_revenue_moments 
    || (revenueDrivers.primary_revenue_moment ? [revenueDrivers.primary_revenue_moment] : [])
  const primaryLabels = primaryMoments.map(m => m.label).join(', ')
  
  const lines = [
    `[Business Rules Engine] Slot Allocation Report`,
    `  Source: ${revenueDrivers.analyzed_from}`,
    `  Confidence: ${revenueDrivers.confidence_score}%`,
    `  Primary Moments: ${primaryLabels}`,
    `  Secondary Moments: ${revenueDrivers.secondary_revenue_moments.map(m => m.label).join(', ')}`,
    `  Preferred Days: ${revenueDrivers.preferred_day_pattern?.join(', ') || revenueDrivers.normal_week_strategy.preferred_days.join(', ')}`,
    ``,
    `  Generated Slots:`,
  ]

  for (const slot of slots) {
    lines.push(
      `    ${slot.slot_id} (${slot.goal_mode}): ${slot.timing_window} — ${slot.revenue_moment_label} (${slot.post_timing_rationale})`
    )
  }

  return lines.join('\n')
}

// ============================================================================
// SCHEMA ADAPTER: Convert Simplified → Complex format
// ============================================================================

/**
 * Convert simplified revenue driver format to complex RevenueMoment format
 * Allows manual brand profile setup while maintaining AI schema compatibility
 */
export function adaptSimplifiedRevenueDrivers(
  simple: SimpleRevenueDrivers
): RevenueDrivers | null {
  if (!simple.primary) {
    console.warn('[Schema Adapter] No primary revenue driver in simplified schema')
    return null
  }

  // Convert primary driver
  const primary_revenue_moment: RevenueMoment = {
    moment_id: simple.primary.moment,
    label: simple.primary.description,
    importance: 'primary',
    service_type: simple.primary.service_periods[0] || 'unknown',
    days: simple.primary.days,
    time_range: `${simple.primary.decision_window.starts} to ${simple.primary.decision_window.ends}`,
    decision_pattern: simple.primary.decision_window.type === 'advance_booking' 
      ? 'advance_booking'
      : simple.primary.decision_window.type === 'same_day'
      ? 'same_day_morning'
      : 'spontaneous',
    decision_windows: [{
      description: simple.primary.decision_window.reasoning || simple.primary.description,
      days: simple.primary.days,
      hours: simple.primary.decision_window.starts,
      conversion_strength: 'high' as const
    }],
    typical_lead_time: simple.primary.decision_window.type === 'advance_booking' 
      ? '3-7 days'
      : 'same day',
    post_timing_rules: simple.primary.post_timing.recommended_posts.map(post => ({
      timing: `${post.day} ${post.time}`,
      purpose: post.reasoning || post.angle,
      priority: 'required' as const
    })),
    content_focus: [simple.primary.service_periods[0]]
  }

  // Convert secondary and tertiary drivers
  const secondary_revenue_moments: RevenueMoment[] = []
  
  if (simple.secondary) {
    secondary_revenue_moments.push({
      moment_id: simple.secondary.moment,
      label: simple.secondary.description,
      importance: 'secondary',
      service_type: simple.secondary.service_periods[0] || 'unknown',
      days: simple.secondary.days,
      time_range: `${simple.secondary.decision_window.starts} to ${simple.secondary.decision_window.ends}`,
      decision_pattern: simple.secondary.decision_window.type === 'advance_booking'
        ? 'advance_booking'
        : simple.secondary.decision_window.type === 'same_day'
        ? 'same_day_morning'
        : 'spontaneous',
      decision_windows: [{
        description: simple.secondary.decision_window.reasoning || simple.secondary.description,
        days: simple.secondary.days,
        hours: simple.secondary.decision_window.starts,
        conversion_strength: 'high' as const
      }],
      typical_lead_time: simple.secondary.decision_window.type === 'advance_booking'
        ? '3-7 days'
        : 'same day',
      post_timing_rules: simple.secondary.post_timing.recommended_posts.map(post => ({
        timing: `${post.day} ${post.time}`,
        purpose: post.reasoning || post.angle,
        priority: 'recommended' as const
      })),
      content_focus: [simple.secondary.service_periods[0]]
    })
  }

  if (simple.tertiary) {
    secondary_revenue_moments.push({
      moment_id: simple.tertiary.moment,
      label: simple.tertiary.description,
      importance: 'tertiary',
      service_type: simple.tertiary.service_periods[0] || 'unknown',
      days: simple.tertiary.days,
      time_range: `${simple.tertiary.decision_window.starts} to ${simple.tertiary.decision_window.ends}`,
      decision_pattern: simple.tertiary.decision_window.type === 'advance_booking'
        ? 'advance_booking'
        : simple.tertiary.decision_window.type === 'same_day'
        ? 'same_day_morning'
        : 'spontaneous',
      decision_windows: [{
        description: simple.tertiary.decision_window.reasoning || simple.tertiary.description,
        days: simple.tertiary.days,
        hours: simple.tertiary.decision_window.starts,
        conversion_strength: 'medium' as const
      }],
      typical_lead_time: simple.tertiary.decision_window.type === 'advance_booking'
        ? '3-7 days'
        : 'same day',
      post_timing_rules: simple.tertiary.post_timing.recommended_posts.map(post => ({
        timing: `${post.day} ${post.time}`,
        purpose: post.reasoning || post.angle,
        priority: 'optional' as const
      })),
      content_focus: [simple.tertiary.service_periods[0]]
    })
  }

  // Convert normal week strategy
  const normal_week_strategy = {
    minimum_coverage: {
      weekend_driver_posts: simple.normal_week_strategy?.minimum_coverage?.weekend_driver || 1,
      weekday_presence_posts: simple.normal_week_strategy?.minimum_coverage?.weekday_presence || 1,
      brand_builder_posts: simple.normal_week_strategy?.minimum_coverage?.brand_builder || 1
    },
    preferred_days: simple.normal_week_strategy?.preferred_day_pattern || ['Monday', 'Thursday', 'Friday', 'Saturday'],
    rationale: simple.normal_week_strategy?.reasoning?.monday || 'Data-driven revenue moments'
  }

  return {
    analyzed_at: new Date().toISOString(),
    analyzed_from: 'manual_brand_profile',
    confidence_score: 95,  // High confidence for manual setup
    primary_revenue_moment,
    secondary_revenue_moments,
    normal_week_strategy
  }
}

/**
 * Unified entry point: accepts both simplified and complex schemas
 */
export function generateSlotsFromRevenueDriversUnified(
  revenueDrivers: RevenueDrivers | SimpleRevenueDrivers | null | undefined,
  postingStrategy?: PostingStrategy | null,
  bookingModel?: BookingModel | null
): SlotTemplate[] {
  if (!revenueDrivers) {
    return generateSlotsFromRevenueDrivers(null, postingStrategy, bookingModel)
  }

  // Detect schema type
  const isSimplified = 'primary' in revenueDrivers && typeof (revenueDrivers as any).primary === 'object'
  
  if (isSimplified) {
    console.log('[Business Rules Engine] Detected simplified schema, adapting to complex format')
    const adapted = adaptSimplifiedRevenueDrivers(revenueDrivers as SimpleRevenueDrivers)
    return generateSlotsFromRevenueDrivers(adapted, postingStrategy, bookingModel)
  }

  // Already complex schema
  return generateSlotsFromRevenueDrivers(revenueDrivers as RevenueDrivers, postingStrategy, bookingModel)
}

// ============================================================================
// PHASE 2A INTEGRATION: Day Allocation Rules
// ============================================================================

export interface DayAllocationRule {
  rule_id: string;
  business_moment: string;
  visit_days: string[];
  post_days: string[];
  post_times: string[];
  priority: number;
  reasoning: string;
  content_angle?: string;
}

export interface WeekContext {
  week_start_date: string;
  week_end_date: string;
  week_type: 'normal' | 'event' | 'special';
  events: Array<{
    name: string;
    date: string;
    category?: string;
  }>;
  post_count: number;
}

/**
 * Business Rules Engine for Phase 2a day allocation
 * Generates prioritized posting rules from revenue drivers and events
 */
export class BusinessRulesEngine {
  private revenueDrivers: SimpleRevenueDrivers;
  
  constructor(revenueDrivers: SimpleRevenueDrivers | RevenueDrivers) {
    // Accept both schema formats, convert complex to simplified internally
    const isSimplified = 'primary' in revenueDrivers && typeof (revenueDrivers as any).primary === 'object'
    
    console.log('[BusinessRulesEngine] Constructor received:', {
      isSimplified,
      hasPreferredDayPattern: 'preferred_day_pattern' in revenueDrivers,
      topLevelKeys: Object.keys(revenueDrivers)
    })
    
    if (!isSimplified) {
      // Convert complex to simplified (reverse adapter)
      const complex = revenueDrivers as RevenueDrivers
      
      console.log('[BusinessRulesEngine] Complex schema:', {
        hasPrimaryMoments: !!complex.primary_revenue_moments,
        primaryCount: complex.primary_revenue_moments?.length || 0,
        hasTopLevelPattern: !!complex.preferred_day_pattern,
        topLevelPattern: complex.preferred_day_pattern,
        hasNormalWeekPreferred: !!complex.normal_week_strategy?.preferred_days,
        normalWeekPreferred: complex.normal_week_strategy?.preferred_days
      })
      
      // Handle both primary_revenue_moments (new) and primary_revenue_moment (old)
      const primaryMoments = complex.primary_revenue_moments 
        || (complex.primary_revenue_moment ? [complex.primary_revenue_moment] : [])
      
      if (primaryMoments.length === 0) {
        throw new Error('[BusinessRulesEngine] No primary revenue moments found')
      }
      
      // Use selectSlotAPrimary to pick the best primary for simplified schema
      const primaryMoment = selectSlotAPrimary(primaryMoments)
      
      this.revenueDrivers = {
        primary: this.convertMomentToDriver(primaryMoment),
        secondary: complex.secondary_revenue_moments[0] 
          ? this.convertMomentToDriver(complex.secondary_revenue_moments[0])
          : undefined,
        tertiary: complex.secondary_revenue_moments[1]
          ? this.convertMomentToDriver(complex.secondary_revenue_moments[1])
          : undefined,
        normal_week_strategy: {
          minimum_coverage: complex.normal_week_strategy.minimum_coverage,
          preferred_day_pattern: complex.preferred_day_pattern || complex.normal_week_strategy.preferred_days
        }
      }
      
      console.log('[BusinessRulesEngine] Converted to simplified schema:', {
        hasPreferredDayPattern: !!this.revenueDrivers.normal_week_strategy?.preferred_day_pattern,
        preferredDayPattern: this.revenueDrivers.normal_week_strategy?.preferred_day_pattern
      })
    } else {
      this.revenueDrivers = revenueDrivers as SimpleRevenueDrivers
    }
  }

  private convertMomentToDriver(moment: RevenueMoment): SimpleRevenueDriver {
    const primaryTiming = moment.post_timing_rules.find(r => r.priority === 'required') 
      || moment.post_timing_rules[0]
    
    const [day, time] = primaryTiming?.timing.split(' ') || ['Monday', '09:00']
    
    return {
      moment: moment.moment_id,
      description: moment.label,
      days: moment.days,
      service_periods: [moment.service_type],
      decision_window: {
        type: moment.decision_pattern === 'advance_booking' ? 'advance_booking' : 'same_day',
        starts: moment.decision_windows[0]?.hours || 'Same day 08:00',
        ends: moment.time_range.split(' to ')[1] || 'Same day 12:00',
        reasoning: moment.decision_windows[0]?.description
      },
      post_timing: {
        recommended_posts: moment.post_timing_rules.map(rule => {
          const [d, t] = rule.timing.split(' ')
          return {
            day: d,
            time: t,
            angle: 'revenue_driver',
            reasoning: rule.purpose
          }
        }),
        minimum_posts: 1,
        maximum_posts: 2
      },
      commercial_weight: moment.importance === 'primary' ? 0.45 : 0.30
    }
  }

  /**
   * Generate day allocation rules for a week
   */
  generateWeeklyAllocationRules(weekContext: WeekContext): DayAllocationRule[] {
    const rules: DayAllocationRule[] = []
    
    console.log('[BusinessRulesEngine] Generating allocation rules:', {
      week_start: weekContext.week_start_date,
      week_type: weekContext.week_type,
      event_count: weekContext.events.length,
      post_count: weekContext.post_count,
      has_preferred_day_pattern: !!this.revenueDrivers.normal_week_strategy?.preferred_day_pattern
    })
    
    // ========================================================================
    // MULTI-PRIMARY SUPPORT: Use preferred_day_pattern if available
    // ========================================================================
    if (this.revenueDrivers.normal_week_strategy?.preferred_day_pattern?.length > 0) {
      const preferredDays = this.revenueDrivers.normal_week_strategy.preferred_day_pattern
      console.log(`[BusinessRulesEngine] Using preferred_day_pattern: ${preferredDays.join(', ')}`)
      
      // Create high-priority rules for each preferred day
      preferredDays.forEach((day, index) => {
        rules.push({
          rule_id: `preferred_day_${day.toLowerCase()}`,
          business_moment: 'multi_primary_revenue_moments',
          visit_days: [day],
          post_days: [day],
          post_times: ['14:00'], // Default to afternoon
          priority: index + 1, // Mon=1, Wed=2, Thu=3, etc.
          reasoning: `Strategic posting day from temporal analysis of multiple revenue moments`,
          content_angle: 'revenue_driver'
        })
      })
      
      console.log(`[BusinessRulesEngine] Generated ${rules.length} preferred day rules`)
      return rules
    }
    
    // ========================================================================
    // LEGACY: Single-primary logic (fallback)
    // ========================================================================
    
    // Priority 1: Primary revenue driver
    if (this.revenueDrivers.primary) {
      rules.push({
        rule_id: `revenue_${this.revenueDrivers.primary.moment}`,
        business_moment: this.revenueDrivers.primary.moment,
        visit_days: this.revenueDrivers.primary.days,
        post_days: this.revenueDrivers.primary.post_timing.recommended_posts.map(p => p.day),
        post_times: this.revenueDrivers.primary.post_timing.recommended_posts.map(p => p.time),
        priority: 1,
        reasoning: this.revenueDrivers.primary.decision_window.reasoning || this.revenueDrivers.primary.description,
        content_angle: this.revenueDrivers.primary.post_timing.recommended_posts[0]?.angle
      })
    }
    
    // Priority 2: Secondary revenue driver
    if (this.revenueDrivers.secondary && weekContext.post_count >= 2) {
      rules.push({
        rule_id: `revenue_${this.revenueDrivers.secondary.moment}`,
        business_moment: this.revenueDrivers.secondary.moment,
        visit_days: this.revenueDrivers.secondary.days,
        post_days: this.revenueDrivers.secondary.post_timing.recommended_posts.map(p => p.day),
        post_times: this.revenueDrivers.secondary.post_timing.recommended_posts.map(p => p.time),
        priority: 2,
        reasoning: this.revenueDrivers.secondary.decision_window.reasoning || this.revenueDrivers.secondary.description,
        content_angle: this.revenueDrivers.secondary.post_timing.recommended_posts[0]?.angle
      })
    }
    
    // Priority 3: Flexible/brand builder
    const remainingSlots = weekContext.post_count - rules.length
    if (remainingSlots > 0) {
      const preferredDays = this.revenueDrivers.normal_week_strategy?.preferred_day_pattern || ['Monday']
      rules.push({
        rule_id: 'flexible_brand_builder',
        business_moment: 'brand_presence',
        visit_days: [],
        post_days: preferredDays,
        post_times: ['09:00'],
        priority: 10,
        reasoning: 'Flexible brand building slot',
        content_angle: 'brand_builder'
      })
    }
    
    return rules.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Get all recommended posting days
   */
  getAllRecommendedDays(weekContext: WeekContext): string[] {
    const rules = this.generateWeeklyAllocationRules(weekContext)
    const allDays = rules.flatMap(rule => rule.post_days)
    return [...new Set(allDays)]
  }
}
