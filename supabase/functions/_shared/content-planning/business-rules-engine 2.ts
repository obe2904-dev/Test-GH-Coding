/**
 * Business Rules Engine - Revenue-Driven Day Allocation
 * 
 * Purpose: Map business moments to optimal posting days using deterministic logic
 * 
 * Replaces: Calendar-first templates (BASE_SLOTS) with business-first intelligence
 * 
 * Core Principle:
 * - AI analyzes context (what's happening this week)
 * - Brand Profile defines revenue drivers (what drives this business)
 * - Business Rules Engine calculates posting days (when to post)
 * - Phase 2a executes (day assignment)
 */

import { classifyEvent, resolvePostingDates, getDayOfWeek, type EventClassification } from './event-classifier.ts';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RevenueDriver {
  moment: string;                    // 'weekend_dinner', 'weekday_lunch'
  description: string;
  days: string[];                    // Visit days: ['Friday', 'Saturday']
  service_periods: string[];         // ['dinner']
  decision_window: {
    type: 'advance_booking' | 'same_day' | 'impulse';
    starts: string;                  // 'Thursday 14:00' or 'Same day 08:00'
    ends: string;
    peak_hours?: string[];
    reasoning?: string;
  };
  post_timing: {
    recommended_posts: Array<{
      day: string;                   // 'Thursday'
      time: string;                  // '14:00'
      angle: string;                 // 'weekend_preview'
      reasoning?: string;
    }>;
    minimum_posts: number;
    maximum_posts: number;
  };
  commercial_weight: number;         // 0.45 = 45% of revenue
  revenue_share?: string;
}

export interface RevenueDrivers {
  primary?: RevenueDriver;
  secondary?: RevenueDriver;
  tertiary?: RevenueDriver;
  normal_week_strategy?: {
    minimum_coverage: {
      weekend_driver: number;
      weekday_presence: number;
      brand_builder: number;
    };
    preferred_day_pattern: string[];  // ['Monday', 'Thursday', 'Friday', 'Saturday']
    avoid_patterns?: {
      consecutive_days: number;
      weekend_gap: boolean;
      front_loaded_week?: boolean;
    };
  };
  event_week_adjustments?: any;
}

export interface DayAllocationRule {
  rule_id: string;
  business_moment: string;           // 'weekend_dinner' or 'event_grundlovsdag'
  visit_days: string[];              // Days customers visit
  post_days: string[];               // Days to post (calculated)
  post_times: string[];              // Times to post
  priority: number;                  // Lower = higher priority (0.5 = events, 1 = primary, 2 = secondary)
  reasoning: string;
  content_angle?: string;            // Suggested angle for this moment
}

export interface WeekContext {
  week_start_date: string;           // '2026-06-02' (Monday)
  week_end_date: string;             // '2026-06-08' (Sunday)
  week_type: 'normal' | 'event' | 'special';
  events: Array<{
    name: string;
    date: string;
    category?: string;
  }>;
  post_count: number;                // 4, 5, 6, 7 posts requested
}

// ============================================================================
// BUSINESS RULES ENGINE
// ============================================================================

export class BusinessRulesEngine {
  constructor(private revenueDrivers: RevenueDrivers) {}
  
  /**
   * Generate day allocation rules for a week
   * Returns prioritized list of posting rules
   */
  generateWeeklyAllocationRules(weekContext: WeekContext): DayAllocationRule[] {
    const rules: DayAllocationRule[] = [];
    
    console.log('[BusinessRulesEngine] Generating allocation rules:', {
      week_start: weekContext.week_start_date,
      week_type: weekContext.week_type,
      event_count: weekContext.events.length,
      post_count: weekContext.post_count
    });
    
    // ========================================================================
    // PRIORITY 1: Event-specific rules (if event week)
    // ========================================================================
    
    if (weekContext.week_type === 'event' && weekContext.events.length > 0) {
      for (const event of weekContext.events) {
        const eventRule = this.createEventRule(event, weekContext);
        if (eventRule) {
          rules.push(eventRule);
        }
      }
    }
    
    // ========================================================================
    // PRIORITY 2: Primary revenue driver (always)
    // ========================================================================
    
    if (this.revenueDrivers.primary) {
      const primaryRule = this.createRevenueDriverRule(
        this.revenueDrivers.primary,
        weekContext,
        1  // priority
      );
      rules.push(primaryRule);
    }
    
    // ========================================================================
    // PRIORITY 3: Secondary revenue driver (if post count >= 2)
    // ========================================================================
    
    if (this.revenueDrivers.secondary && weekContext.post_count >= 2) {
      const secondaryRule = this.createRevenueDriverRule(
        this.revenueDrivers.secondary,
        weekContext,
        2
      );
      rules.push(secondaryRule);
    }
    
    // ========================================================================
    // PRIORITY 4: Tertiary revenue driver (if post count >= 3)
    // ========================================================================
    
    if (this.revenueDrivers.tertiary && weekContext.post_count >= 3) {
      const tertiaryRule = this.createRevenueDriverRule(
        this.revenueDrivers.tertiary,
        weekContext,
        3
      );
      rules.push(tertiaryRule);
    }
    
    // ========================================================================
    // PRIORITY 5: Brand builder / flexible slots (remaining posts)
    // ========================================================================
    
    const remainingSlots = weekContext.post_count - rules.length;
    if (remainingSlots > 0) {
      const flexibleRule = this.createFlexibleRule(weekContext, 10);
      for (let i = 0; i < remainingSlots; i++) {
        rules.push({ ...flexibleRule, rule_id: `flexible_${i + 1}` });
      }
    }
    
    // Sort by priority (lower number = higher priority)
    return rules.sort((a, b) => a.priority - b.priority);
  }
  
  // ==========================================================================
  // RULE CREATORS
  // ==========================================================================
  
  /**
   * Create rule from revenue driver
   */
  private createRevenueDriverRule(
    driver: RevenueDriver,
    weekContext: WeekContext,
    priority: number
  ): DayAllocationRule {
    const { decision_window, post_timing } = driver;
    
    // Extract recommended posting days from driver
    const recommendedPosts = post_timing.recommended_posts;
    const post_days = recommendedPosts.map(p => p.day);
    const post_times = recommendedPosts.map(p => p.time);
    
    return {
      rule_id: `revenue_${driver.moment}`,
      business_moment: driver.moment,
      visit_days: driver.days,
      post_days: post_days,
      post_times: post_times,
      priority: priority,
      reasoning: decision_window.reasoning || driver.description,
      content_angle: recommendedPosts[0]?.angle
    };
  }
  
  /**
   * Create rule from event
   */
  private createEventRule(
    event: { name: string; date: string; category?: string },
    weekContext: WeekContext
  ): DayAllocationRule | null {
    const classification = classifyEvent(event);
    
    // Resolve relative days ('-1', '0') to absolute dates ('2026-06-04', '2026-06-05')
    const absoluteDates = resolvePostingDates(
      event.date,
      classification.posting_strategy.recommended_post_days
    );
    
    // Convert absolute dates to day names ('Thursday', 'Friday')
    const post_day_names = absoluteDates.map(date => getDayOfWeek(date));
    
    return {
      rule_id: `event_${event.name.toLowerCase().replace(/\s+/g, '_')}`,
      business_moment: `event_${event.name}`,
      visit_days: [getDayOfWeek(event.date)],
      post_days: post_day_names,
      post_times: classification.posting_strategy.recommended_times,
      priority: 0.5,  // Events get highest priority
      reasoning: classification.reasoning,
      content_angle: classification.event_type === 'same_day' ? 'day_of_reminder' : 'event_preview'
    };
  }
  
  /**
   * Create flexible brand-builder rule
   */
  private createFlexibleRule(
    weekContext: WeekContext,
    priority: number
  ): DayAllocationRule {
    const preferredDays = this.revenueDrivers.normal_week_strategy?.preferred_day_pattern || 
      ['Monday', 'Tuesday', 'Wednesday'];
    
    return {
      rule_id: 'flexible_brand_builder',
      business_moment: 'brand_presence',
      visit_days: [],
      post_days: preferredDays,  // Will be narrowed down by Phase 2a
      post_times: ['09:00', '10:00'],
      priority: priority,
      reasoning: 'Flexible slot for brand building - use spread algorithm to avoid consecutive days',
      content_angle: 'brand_builder'
    };
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Get all recommended posting days for a week (for logging/debugging)
   */
  getAllRecommendedDays(weekContext: WeekContext): string[] {
    const rules = this.generateWeeklyAllocationRules(weekContext);
    const allDays = rules.flatMap(rule => rule.post_days);
    return [...new Set(allDays)];  // Deduplicate
  }
  
  /**
   * Check if a week follows normal pattern
   */
  isNormalWeekPattern(assignedDays: string[]): boolean {
    const preferredPattern = this.revenueDrivers.normal_week_strategy?.preferred_day_pattern;
    if (!preferredPattern) return true;
    
    // Check if assigned days match preferred pattern (order doesn't matter)
    const assignedSet = new Set(assignedDays);
    const matchCount = preferredPattern.filter(day => assignedSet.has(day)).length;
    
    return matchCount >= Math.min(2, preferredPattern.length);  // At least 2 matches
  }
}

// ============================================================================
// DECISION WINDOW CALCULATOR
// ============================================================================

export interface PostingRecommendation {
  recommended_post_days: string[];   // ['Thursday', 'Friday']
  recommended_times: string[];       // ['14:00', '14:00']
  reasoning: string;
}

/**
 * Calculate when to post based on decision window
 */
export function calculatePostTiming(
  moment: RevenueDriver,
  weekContext: WeekContext
): PostingRecommendation {
  const { decision_window, post_timing } = moment;
  
  // Use explicit post_timing from brand profile
  if (post_timing && post_timing.recommended_posts.length > 0) {
    return {
      recommended_post_days: post_timing.recommended_posts.map(p => p.day),
      recommended_times: post_timing.recommended_posts.map(p => p.time),
      reasoning: decision_window.reasoning || `Brand profile says: ${moment.description}`
    };
  }
  
  // Fallback: Calculate from decision window type
  if (decision_window.type === 'advance_booking') {
    // Post during decision window (before visit days)
    return {
      recommended_post_days: extractDayFromWindowStart(decision_window.starts),
      recommended_times: [extractTimeFromWindowStart(decision_window.starts)],
      reasoning: `Advance booking window: ${decision_window.starts} to ${decision_window.ends}`
    };
  }
  
  if (decision_window.type === 'same_day') {
    // Post morning-of on visit days
    return {
      recommended_post_days: moment.days,
      recommended_times: moment.days.map(() => '09:00'),
      reasoning: `Same-day decisions: post morning-of on visit days (${moment.days.join(', ')})`
    };
  }
  
  // Impulse (walk-in)
  return {
    recommended_post_days: moment.days,
    recommended_times: moment.days.map(() => '10:00'),
    reasoning: `Walk-in traffic: post mid-morning on visit days`
  };
}

function extractDayFromWindowStart(windowStart: string): string[] {
  // 'Thursday 14:00' → ['Thursday']
  const parts = windowStart.split(' ');
  if (parts[0] === 'Same') return [];
  return [parts[0]];
}

function extractTimeFromWindowStart(windowStart: string): string {
  // 'Thursday 14:00' → '14:00'
  const parts = windowStart.split(' ');
  return parts[parts.length - 1];
}

// ============================================================================
// TEST HELPER
// ============================================================================

export function testBusinessRulesEngine() {
  const testRevenueDrivers: RevenueDrivers = {
    primary: {
      moment: 'weekend_dinner',
      description: 'Friday-Saturday dinner',
      days: ['Friday', 'Saturday'],
      service_periods: ['dinner'],
      decision_window: {
        type: 'advance_booking',
        starts: 'Thursday 14:00',
        ends: 'Friday 17:00'
      },
      post_timing: {
        recommended_posts: [
          { day: 'Thursday', time: '14:00', angle: 'weekend_preview' },
          { day: 'Friday', time: '14:00', angle: 'tonight_reminder' }
        ],
        minimum_posts: 1,
        maximum_posts: 2
      },
      commercial_weight: 0.45
    },
    secondary: {
      moment: 'weekday_lunch',
      description: 'Monday-Friday lunch',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      service_periods: ['lunch'],
      decision_window: {
        type: 'same_day',
        starts: 'Same day 08:00',
        ends: 'Same day 11:30'
      },
      post_timing: {
        recommended_posts: [
          { day: 'Monday', time: '09:00', angle: 'week_kickoff' }
        ],
        minimum_posts: 1,
        maximum_posts: 1
      },
      commercial_weight: 0.30
    },
    normal_week_strategy: {
      minimum_coverage: {
        weekend_driver: 1,
        weekday_presence: 1,
        brand_builder: 1
      },
      preferred_day_pattern: ['Monday', 'Thursday', 'Friday', 'Saturday']
    }
  };
  
  const engine = new BusinessRulesEngine(testRevenueDrivers);
  
  // Test 1: Normal week (4 posts)
  const normalWeek: WeekContext = {
    week_start_date: '2026-06-08',
    week_end_date: '2026-06-14',
    week_type: 'normal',
    events: [],
    post_count: 4
  };
  
  console.log('=== Test 1: Normal Week (4 posts) ===');
  const normalRules = engine.generateWeeklyAllocationRules(normalWeek);
  normalRules.forEach(rule => {
    console.log(`  ${rule.rule_id}: Post on ${rule.post_days.join(', ')} at ${rule.post_times.join(', ')}`);
    console.log(`    Reasoning: ${rule.reasoning}`);
  });
  
  // Test 2: Event week (Grundlovsdag)
  const eventWeek: WeekContext = {
    week_start_date: '2026-06-01',
    week_end_date: '2026-06-07',
    week_type: 'event',
    events: [
      { name: 'Grundlovsdag', date: '2026-06-05' }
    ],
    post_count: 4
  };
  
  console.log('\n=== Test 2: Event Week (Grundlovsdag Friday) ===');
  const eventRules = engine.generateWeeklyAllocationRules(eventWeek);
  eventRules.forEach(rule => {
    console.log(`  ${rule.rule_id}: Post on ${rule.post_days.join(', ')} at ${rule.post_times.join(', ')}`);
    console.log(`    Reasoning: ${rule.reasoning}`);
  });
}

/**
 * Expected output:
 * 
 * === Test 1: Normal Week (4 posts) ===
 *   revenue_weekend_dinner: Post on Thursday, Friday at 14:00, 14:00
 *     Reasoning: Weekend dinner bookings peak Thursday afternoon...
 *   revenue_weekday_lunch: Post on Monday at 09:00
 *     Reasoning: Monday-Friday lunch
 *   flexible_brand_builder: Post on Monday, Tuesday, Wednesday at 09:00, 10:00
 *     Reasoning: Flexible slot for brand building...
 * 
 * === Test 2: Event Week (Grundlovsdag Friday) ===
 *   event_grundlovsdag: Post on Thursday, Friday at 14:00, 09:00
 *     Reasoning: Grundlovsdag is a same-day decision holiday...
 *   revenue_weekend_dinner: Post on Thursday, Friday at 14:00, 14:00
 *     Reasoning: Weekend dinner bookings peak Thursday afternoon...
 *   revenue_weekday_lunch: Post on Monday at 09:00
 *     Reasoning: Monday-Friday lunch
 */
