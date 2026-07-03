// ============================================================
// COMMERCIAL MODE CLASSIFIER
// ============================================================
// Determines weekly commercial mode based on:
// - Business trigger configuration
// - Calendar events
// - Temporal patterns
// - Weather signals
//
// Priority Issue 1: Commercial Objective Governance
// Generated: 5. maj 2026
// ============================================================

import type {
  CommercialMode,
  CommercialModeDirective,
  ClassifierContext,
  BusinessTriggerConfiguration,
  TriggerConfig,
  CTAType
} from '../types/commercial-mode-types.ts';

/**
 * Main classifier function.
 * Call this BEFORE running Phase 0/1/2 prompts.
 * 
 * @param context - Complete context needed for classification
 * @returns Commercial mode directive with quotas and reasoning
 */
export function classifyCommercialMode(
  context: ClassifierContext
): CommercialModeDirective {
  // Step 1: Check for active triggers
  const activeTriggers = identifyActiveTriggers(context);
  
  // Step 2: If no triggers, use baseline mode
  if (activeTriggers.length === 0) {
    return buildBaselineDirective(context);
  }
  
  // Step 3: Resolve mode from highest-priority trigger
  const primaryTrigger = selectPrimaryTrigger(activeTriggers, context);
  
  // Step 4: Build directive from trigger configuration
  return buildTriggerDirective(primaryTrigger, activeTriggers, context);
}

/**
 * Identifies all triggers that should activate for this week.
 */
interface ActiveTrigger {
  trigger_id: string;
  trigger_name: string;
  config: TriggerConfig;
  priority: number;
  reason: string;
}

function identifyActiveTriggers(context: ClassifierContext): ActiveTrigger[] {
  const active: ActiveTrigger[] = [];
  
  // No trigger configuration = no custom triggers
  if (!context.trigger_configuration) {
    return active;
  }
  
  const week = context.week_start;
  const weekNumber = context.week_number;
  const month = context.month;
  
  // Check each configured trigger
  for (const [triggerId, triggerConfig] of Object.entries(context.trigger_configuration)) {
    if (!triggerConfig.enabled) {
      continue;
    }
    
    // Check trigger-specific activation logic
    const activation = checkTriggerActivation(triggerId, context);
    
    if (activation.shouldActivate) {
      active.push({
        trigger_id: triggerId,
        trigger_name: getTriggerName(triggerId),
        config: triggerConfig,
        priority: triggerConfig.priority || getSystemPriority(triggerId),
        reason: activation.reason
      });
    }
  }
  
  return active;
}

/**
 * Checks if a specific trigger should activate for this week.
 */
function checkTriggerActivation(
  triggerId: string,
  context: ClassifierContext
): { shouldActivate: boolean; reason: string } {
  const week = context.week_start;
  const month = context.month;
  const weekNumber = context.week_number;
  
  switch (triggerId) {
    case 'VD_WEEK': {
      // Valentine's Day: Feb 12-14
      // Activate for the week containing Feb 12-14
      if (month === 2) {
        const weekDay = week.getDate();
        if (weekDay <= 14 && weekDay + 6 >= 12) {
          return {
            shouldActivate: true,
            reason: "Valentine's Day falls within this week (Feb 12-14)"
          };
        }
      }
      return { shouldActivate: false, reason: "" };
    }
    
    case 'MD_WEEK': {
      // Mother's Day: 2nd Sunday of May in Denmark
      // Activate week before Mother's Day
      if (month === 5) {
        const secondSunday = getSecondSunday(2026, 5); // TODO: Make year dynamic
        const weekBefore = new Date(secondSunday);
        weekBefore.setDate(weekBefore.getDate() - 7);
        
        if (isSameWeek(week, weekBefore)) {
          return {
            shouldActivate: true,
            reason: "Week before Mother's Day (advance booking critical)"
          };
        }
      }
      return { shouldActivate: false, reason: "" };
    }
    
    case 'FD_WEEK': {
      // Father's Day: June 5 in Denmark
      // Activate week before
      if (month === 6) {
        const fathersDay = new Date(2026, 5, 5); // TODO: Make year dynamic
        const weekBefore = new Date(fathersDay);
        weekBefore.setDate(weekBefore.getDate() - 7);
        
        if (isSameWeek(week, weekBefore)) {
          return {
            shouldActivate: true,
            reason: "Week before Father's Day"
          };
        }
      }
      return { shouldActivate: false, reason: "" };
    }
    
    case 'FIRST_WEEKEND': {
      // First weekend of month
      if (context.first_weekend_of_month) {
        return {
          shouldActivate: true,
          reason: "First weekend of the month - fresh month spending energy"
        };
      }
      return { shouldActivate: false, reason: "" };
    }
    
    case 'PAYDAY_PERIOD': {
      // Payday periods (15th or last week of month)
      if (context.is_payday_period) {
        return {
          shouldActivate: true,
          reason: "Payday window - increased spending capacity"
        };
      }
      return { shouldActivate: false, reason: "" };
    }
    
    case 'WEATHER_BREAK': {
      // First warm day (20°C+) after winter
      if (context.weather_forecast && (month >= 3 && month <= 5)) { // Spring months
        const hasWarmDay = context.weather_forecast.some(
          day => day.temp_high >= 20
        );
        const isPreviousWeeksCold = true; // TODO: Check historical weather
        
        if (hasWarmDay && isPreviousWeeksCold) {
          return {
            shouldActivate: true,
            reason: "First warm day (20°C+) after winter - outdoor opportunity"
          };
        }
      }
      return { shouldActivate: false, reason: "" };
    }
    
    case 'LOCAL_EVENT': {
      // High commercial weight events from contextual_calendar
      if (context.contextual_calendar) {
        const highCommercialEvents = context.contextual_calendar.filter(
          event => event.commercial_weight > 8
        );
        
        if (highCommercialEvents.length > 0) {
          const eventNames = highCommercialEvents.map(e => e.event).join(', ');
          return {
            shouldActivate: true,
            reason: `High commercial events: ${eventNames}`
          };
        }
      }
      return { shouldActivate: false, reason: "" };
    }
    
    case 'QUIET_WEEK': {
      // Always available as fallback (handled separately)
      return { shouldActivate: false, reason: "" };
    }
    
    default:
      return { shouldActivate: false, reason: "Unknown trigger" };
  }
}

/**
 * Selects the primary trigger when multiple are active.
 * Uses priority scoring.
 */
function selectPrimaryTrigger(
  triggers: ActiveTrigger[],
  context: ClassifierContext
): ActiveTrigger {
  // Sort by priority (highest first)
  const sorted = [...triggers].sort((a, b) => b.priority - a.priority);
  return sorted[0];
}

/**
 * Builds directive from baseline mode (no triggers active).
 */
function buildBaselineDirective(context: ClassifierContext): CommercialModeDirective {
  const mode = context.commercial_baseline_mode || 'balanced';
  
  const quotas = getDefaultQuotas(mode, context);
  
  return {
    commercial_mode: mode,
    trigger_reason: `Baseline mode (no active triggers). ${getBaselineExplanation(mode, context)}`,
    triggered_by: ['QUIET_WEEK'],
    min_booking_ideas: quotas.booking,
    min_footfall_ideas: quotas.footfall,
    required_cta_types: quotas.ctas,
    timing_urgency: 'flexible'
  };
}

/**
 * Builds directive from active trigger configuration.
 */
function buildTriggerDirective(
  primaryTrigger: ActiveTrigger,
  allTriggers: ActiveTrigger[],
  context: ClassifierContext
): CommercialModeDirective {
  const config = primaryTrigger.config;
  
  // Determine mode
  let mode: CommercialMode;
  if (config.mode === 'context_dependent') {
    mode = determineContextDependentMode(context);
  } else {
    mode = config.mode || 'balanced';
  }
  
  // Get quotas (use trigger config or defaults)
  const quotas = {
    booking: config.min_booking_ideas ?? getDefaultQuotas(mode, context).booking,
    footfall: config.min_footfall_ideas ?? getDefaultQuotas(mode, context).footfall
  };
  
  // Build reason string
  const reasons = allTriggers.map(t => t.reason);
  const reasonText = reasons.length === 1 
    ? reasons[0]
    : `${primaryTrigger.reason} (also: ${reasons.slice(1).join('; ')})`;
  
  return {
    commercial_mode: mode,
    trigger_reason: reasonText,
    triggered_by: allTriggers.map(t => t.trigger_id),
    min_booking_ideas: quotas.booking,
    min_footfall_ideas: quotas.footfall,
    required_cta_types: getRecommendedCTAs(mode, context),
    timing_urgency: mode === 'booking_push' ? 'this_week' : 'immediate',
    booking_window_days: config.booking_window_days
  };
}

/**
 * Determines mode for context-dependent triggers.
 * Example: LOCAL_EVENT can be booking or footfall depending on event type.
 */
function determineContextDependentMode(context: ClassifierContext): CommercialMode {
  // If business has reservations, prefer booking push for high commercial events
  if (context.has_reservation_system && context.contextual_calendar) {
    const hasBookingRelevantEvent = context.contextual_calendar.some(
      event => event.booking_relevance && event.booking_relevance > 7
    );
    if (hasBookingRelevantEvent) {
      return 'booking_push';
    }
  }
  
  // Otherwise footfall push
  return 'footfall_push';
}

/**
 * Returns default idea quotas for a given mode.
 */
function getDefaultQuotas(mode: CommercialMode, context: ClassifierContext): {
  booking: number;
  footfall: number;
  ctas: CTAType[];
} {
  switch (mode) {
    case 'booking_push':
      return {
        booking: context.has_reservation_system ? 3 : 1,
        footfall: 1,
        ctas: ['reserve_table', 'book_appointment', 'limited_time'] as CTAType[]
      };
    
    case 'footfall_push':
      return {
        booking: 0,
        footfall: 4,
        ctas: ['visit_today', 'visit_this_week', 'try_new_item', 'check_menu'] as CTAType[]
      };
    
    case 'balanced':
      return {
        booking: context.has_reservation_system ? 1 : 0,
        footfall: 2,
        ctas: ['visit_this_week', 'check_menu', 'join_community'] as CTAType[]
      };
  }
}

/**
 * Returns recommended CTA types for a mode.
 */
function getRecommendedCTAs(mode: CommercialMode, context: ClassifierContext): CTAType[] {
  return getDefaultQuotas(mode, context).ctas;
}

/**
 * Helper: Get system priority for a trigger ID.
 */
function getSystemPriority(triggerId: string): number {
  const priorities: Record<string, number> = {
    'VD_WEEK': 90,
    'MD_WEEK': 85,
    'FD_WEEK': 80,
    'WEATHER_BREAK': 95,
    'LOCAL_EVENT': 70,
    'FIRST_WEEKEND': 40,
    'PAYDAY_PERIOD': 45,
    'QUIET_WEEK': 10
  };
  return priorities[triggerId] || 50;
}

/**
 * Helper: Get human-readable trigger name.
 */
function getTriggerName(triggerId: string): string {
  const names: Record<string, string> = {
    'VD_WEEK': "Valentine's Week",
    'MD_WEEK': "Mother's Day Week",
    'FD_WEEK': "Father's Day Week",
    'WEATHER_BREAK': "First Warm Day",
    'LOCAL_EVENT': "High Commercial Event",
    'FIRST_WEEKEND': "First Weekend",
    'PAYDAY_PERIOD': "Payday Period",
    'QUIET_WEEK': "Quiet Week"
  };
  return names[triggerId] || triggerId;
}

/**
 * Helper: Explain why baseline mode was chosen.
 */
function getBaselineExplanation(mode: CommercialMode, context: ClassifierContext): string {
  switch (mode) {
    case 'booking_push':
      return "Business is reservation-focused with default booking priority.";
    case 'footfall_push':
      return "Business relies on walk-in traffic and immediate visits.";
    case 'balanced':
      return "Maintaining presence and engagement across commercial objectives.";
  }
}

/**
 * Helper: Get second Sunday of a month (for Mother's Day).
 */
function getSecondSunday(year: number, month: number): Date {
  const firstDay = new Date(year, month - 1, 1);
  const firstDayOfWeek = firstDay.getDay();
  const firstSunday = firstDayOfWeek === 0 ? 1 : 8 - firstDayOfWeek;
  return new Date(year, month - 1, firstSunday + 7);
}

/**
 * Helper: Check if two dates are in the same week.
 */
function isSameWeek(date1: Date, date2: Date): boolean {
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const diff = Math.abs(date1.getTime() - date2.getTime());
  return diff < oneWeek;
}

/**
 * Export for testing and debugging.
 */
export const __testing = {
  identifyActiveTriggers,
  checkTriggerActivation,
  selectPrimaryTrigger,
  getDefaultQuotas,
  getSystemPriority
};
