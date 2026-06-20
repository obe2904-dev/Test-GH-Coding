/**
 * BEHAVIORAL ACTIVATION ENGINE
 * 
 * Core logic for activating/deactivating audience segments based on week context.
 * 
 * Architecture:
 * 1. Detect behavioral patterns (family, work, leisure, tourist) from week context
 * 2. Score each segment based on pattern activation + normal priority
 * 3. Extend timing windows based on behavioral patterns
 * 4. Generate allocation guidance for content generation
 * 
 * This is DETERMINISTIC CODE - no AI, pure logic.
 */

import type {
  ActivationEngineInput,
  ActivationEngineOutput,
  BehavioralPattern,
  ActivatedSegment,
  DeactivatedSegment,
  AllocationGuidance,
  BrandSegment,
  TimingWindow,
} from '../types/activation-types.ts';

// ============================================================
// CONSTANTS
// ============================================================

const PRIORITY_SCORES = {
  primary: 60,
  secondary: 40,
  niche: 20,
};

const ACTIVATION_LEVEL_SCORES = {
  surge: 40,
  high: 25,
  active: 10,
  sustain: 0,
  deactivated: -100,
};

const DECISION_TYPE_VALUES = {
  planned: 1.2, // Higher value - advance bookings
  mixed: 1.0,
  spontaneous: 0.9, // Lower value - walk-ins
};

// ============================================================
// BEHAVIORAL PATTERN DETECTION
// ============================================================

/**
 * Detect behavioral patterns active this week based on context
 */
export function detectBehavioralPatterns(input: ActivationEngineInput): BehavioralPattern[] {
  const patterns: BehavioralPattern[] = [];
  const { weekContext } = input;
  
  // Pattern 1: Family Behavior (bridge day holidays)
  for (const holiday of weekContext.public_holidays) {
    if (holiday.typical_bridge_day) {
      const holidayDate = new Date(holiday.date);
      const dayOfWeek = holidayDate.getDay();
      
      // Thursday or Friday holiday with bridge day = extended family window
      if (dayOfWeek === 4 || dayOfWeek === 5) { // Thu=4, Fri=5
        patterns.push({
          pattern_name: 'family_behavior',
          activation_level: 'surge',
          active_days: ['Thursday', 'Friday', 'Saturday', 'Sunday'],
          trigger_reason: `${holiday.name} (${holiday.day_of_week}) creates 4-day family window with typical bridge day`,
        });
      }
      // Monday holiday = extended weekend
      else if (dayOfWeek === 1) {
        patterns.push({
          pattern_name: 'family_behavior',
          activation_level: 'high',
          active_days: ['Saturday', 'Sunday', 'Monday'],
          trigger_reason: `${holiday.name} extends weekend for family activities`,
        });
      }
    } else {
      // Regular holiday (no bridge) - single day family activation
      const dayName = holiday.day_of_week;
      patterns.push({
        pattern_name: 'family_behavior',
        activation_level: 'active',
        active_days: [dayName],
        trigger_reason: `${holiday.name} activates family behavior on ${dayName}`,
      });
    }
  }
  
  // Pattern 2: Work Behavior Deactivation
  for (const holiday of weekContext.public_holidays) {
    const holidayDate = new Date(holiday.date);
    const dayOfWeek = holidayDate.getDay();
    
    // Weekday holidays deactivate work segments
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const affectedDays = [holiday.day_of_week];
      
      // If bridge day, also deactivate Friday
      if (holiday.typical_bridge_day && dayOfWeek === 4) {
        affectedDays.push('Friday');
      }
      
      patterns.push({
        pattern_name: 'work_behavior',
        activation_level: 'deactivated',
        active_days: affectedDays,
        trigger_reason: `Offices closed on ${holiday.name}, work segments inactive`,
      });
    }
  }
  
  // Pattern 3: Leisure Behavior (extended weekend)
  const hasWeekendExtension = weekContext.public_holidays.some(h => {
    const dayOfWeek = new Date(h.date).getDay();
    return h.typical_bridge_day && (dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 1);
  });
  
  if (hasWeekendExtension) {
    patterns.push({
      pattern_name: 'leisure_behavior',
      activation_level: 'high',
      active_days: ['Thursday', 'Friday', 'Saturday', 'Sunday'],
      trigger_reason: 'Extended weekend creates sustained leisure window',
    });
  }
  
  // Pattern 4: Weather-dependent patterns
  if (input.weekContext.weather.avg_temp >= 16 && input.weekContext.weather.precipitation_days < 3) {
    patterns.push({
      pattern_name: 'outdoor_dining_enabled',
      activation_level: 'active',
      active_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      trigger_reason: `Good weather (${input.weekContext.weather.avg_temp}°C, low precipitation) supports outdoor dining`,
    });
  } else if (input.weekContext.weather.avg_temp < 12) {
    patterns.push({
      pattern_name: 'outdoor_dining_enabled',
      activation_level: 'sustain',
      active_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      trigger_reason: `Cool weather (${input.weekContext.weather.avg_temp}°C) - outdoor available but not headline feature`,
    });
  }
  
  return patterns;
}

// ============================================================
// SEGMENT ACTIVATION SCORING
// ============================================================

/**
 * Parse timing window string like "Mon-Fri 12-14" or "Sat-Sun 10-14"
 */
function parseTimingWindow(window: string): TimingWindow | null {
  // Pattern: "Mon-Fri 12-14" or "Lør-Søn 10:00-14:00" or "Weekday 12-14"
  const dayMap: Record<string, string> = {
    'mon': 'Monday', 'tue': 'Tuesday', 'wed': 'Wednesday', 'thu': 'Thursday',
    'fri': 'Friday', 'sat': 'Saturday', 'sun': 'Sunday',
    'lør': 'Saturday', 'søn': 'Sunday', 'man': 'Monday', 'tir': 'Tuesday',
    'ons': 'Wednesday', 'tor': 'Thursday', 'fre': 'Friday',
  };
  
  // Try to parse day range and time
  const match = window.match(/(\w+)(?:-(\w+))?\s+(\d+)(?::(\d+))?-(\d+)(?::(\d+))?/i);
  if (!match) return null;
  
  const [, startDayRaw, endDayRaw, startHourStr, , endHourStr] = match;
  const startDay = dayMap[startDayRaw.toLowerCase()] || startDayRaw;
  const endDay = endDayRaw ? (dayMap[endDayRaw.toLowerCase()] || endDayRaw) : startDay;
  
  const start_hour = parseInt(startHourStr);
  const end_hour = parseInt(endHourStr);
  
  // Build day list
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const startIdx = dayOrder.indexOf(startDay);
  const endIdx = dayOrder.indexOf(endDay);
  
  let days: string[] = [];
  if (startIdx !== -1 && endIdx !== -1) {
    for (let i = startIdx; i <= endIdx; i++) {
      days.push(dayOrder[i]);
    }
  } else if (startDay === 'Weekday' || startDayRaw.toLowerCase() === 'weekday') {
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  } else if (startDay === 'Weekend' || startDayRaw.toLowerCase() === 'weekend') {
    days = ['Saturday', 'Sunday'];
  } else {
    days = [startDay];
  }
  
  return {
    days,
    start_hour,
    end_hour,
    raw_string: window,
  };
}

/**
 * Check if segment name or content angles indicate work-related segment
 */
function isWorkSegment(segment: BrandSegment): boolean {
  const workKeywords = ['pendler', 'work', 'lunch-rush', 'after-work', 'kontorfolk'];
  const segmentText = `${segment.segment_name} ${segment.content_angles.join(' ')}`.toLowerCase();
  return workKeywords.some(kw => segmentText.includes(kw));
}

/**
 * Check if segment is family-oriented
 */
function isFamilySegment(segment: BrandSegment): boolean {
  const familyKeywords = ['familie', 'family', 'børn', 'kids', 'children'];
  const segmentText = `${segment.segment_name} ${segment.content_angles.join(' ')}`.toLowerCase();
  return familyKeywords.some(kw => segmentText.includes(kw));
}

/**
 * Calculate activation score for a segment based on patterns and context
 */
function calculateActivationScore(
  segment: BrandSegment,
  patterns: BehavioralPattern[],
  input: ActivationEngineInput
): {
  score: number;
  priority: 'surge' | 'high' | 'active' | 'sustain' | 'deactivated';
  reasons: string[];
  extended_timing: string[];
  extended_days: string[];
  decision_shift?: string;
} {
  const reasons: string[] = [];
  let baseScore = PRIORITY_SCORES[segment.segment_size];
  let behavioralBonus = 0;
  let timingBonus = 0;
  let weatherModifier = 0;
  
  reasons.push(`Base priority: ${segment.segment_size} (${baseScore} points)`);
  
  // Check behavioral pattern matches
  const familyPattern = patterns.find(p => p.pattern_name === 'family_behavior' && p.activation_level !== 'deactivated');
  const workDeactivation = patterns.find(p => p.pattern_name === 'work_behavior' && p.activation_level === 'deactivated');
  const outdoorPattern = patterns.find(p => p.pattern_name === 'outdoor_dining_enabled');
  
  // Family behavior boost
  if (familyPattern && isFamilySegment(segment)) {
    const boost = ACTIVATION_LEVEL_SCORES[familyPattern.activation_level];
    behavioralBonus += boost;
    reasons.push(`Family behavior ${familyPattern.activation_level} (+${boost} points)`);
  }
  
  // Work segment deactivation
  if (workDeactivation && isWorkSegment(segment)) {
    behavioralBonus = ACTIVATION_LEVEL_SCORES.deactivated;
    reasons.push(`Work behavior deactivated (${behavioralBonus} points)`);
  }
  
  // Timing window extension
  let extended_timing = [...segment.timing_windows];
  let extended_days: string[] = [];
  let decision_shift: string | undefined;
  
  // Parse original timing to get normal days
  const normalDays = new Set<string>();
  for (const window of segment.timing_windows) {
    const parsed = parseTimingWindow(window);
    if (parsed) {
      parsed.days.forEach(d => normalDays.add(d));
    }
  }
  
  // Extend timing if family pattern activates family segment
  if (familyPattern && isFamilySegment(segment)) {
    const originalDayCount = normalDays.size;
    const extendedDaySet = new Set([...normalDays, ...familyPattern.active_days]);
    
    if (extendedDaySet.size > originalDayCount) {
      timingBonus = 15;
      reasons.push(`Time window extended from ${originalDayCount} to ${extendedDaySet.size} days (+${timingBonus} points)`);
      
      // Build new timing windows
      extended_days = Array.from(extendedDaySet);
      
      // Extract time range from original
      const firstWindow = parseTimingWindow(segment.timing_windows[0]);
      if (firstWindow) {
        // Generate extended timing string
        const dayRange = extended_days.length === 7 ? 'All week' : 
                        extended_days.includes('Thursday') && extended_days.includes('Sunday') ? 'Thu-Sun' :
                        extended_days.join(', ');
        extended_timing = [`${dayRange} ${firstWindow.start_hour}:00-${firstWindow.end_hour}:00`];
      }
      
      // Decision type shift for holiday bookings
      if (familyPattern.activation_level === 'surge' && segment.decision_timing === 'spontaneous') {
        decision_shift = 'planned';
        reasons.push('Decision type shifted to planned (holiday advance bookings)');
      }
    }
  } else {
    extended_days = Array.from(normalDays);
  }
  
  // Weather modifier
  if (outdoorPattern && input.brandContext.features.includes('outdoor_seating')) {
    if (outdoorPattern.activation_level === 'sustain') {
      weatherModifier = -10;
      reasons.push(`Cool weather reduces outdoor dining priority (${weatherModifier} points)`);
    }
    // 'active' level = neutral, no modifier
  }
  
  // Commercial value from decision type
  const commercialValue = DECISION_TYPE_VALUES[segment.decision_timing];
  
  // Calculate final score
  const finalScore = baseScore + behavioralBonus + timingBonus + weatherModifier;
  
  // Determine priority tier
  let priority: 'surge' | 'high' | 'active' | 'sustain' | 'deactivated';
  if (finalScore < 0) {
    priority = 'deactivated';
  } else if (finalScore >= 75) {
    priority = 'surge';
  } else if (finalScore >= 55) {
    priority = 'high';
  } else if (finalScore >= 35) {
    priority = 'active';
  } else {
    priority = 'sustain';
  }
  
  reasons.push(`Final score: ${finalScore} → ${priority}`);
  
  return {
    score: finalScore,
    priority,
    reasons,
    extended_timing,
    extended_days,
    decision_shift,
  };
}

// ============================================================
// ALLOCATION GUIDANCE
// ============================================================

/**
 * Generate allocation guidance for content generation
 */
function generateAllocationGuidance(
  activatedSegments: ActivatedSegment[],
  targetPostCount: number,
  goalBlend: { drive_footfall: number; strengthen_brand: number }
): AllocationGuidance {
  const notes: string[] = [];
  
  // Sort by priority then score
  const priorityOrder = { surge: 4, high: 3, active: 2, sustain: 1, deactivated: 0 };
  const sorted = [...activatedSegments].sort((a, b) => {
    const priorityDiff = priorityOrder[b.this_week_priority] - priorityOrder[a.this_week_priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.activation_score - a.activation_score;
  });
  
  // Calculate target goal distribution
  const targetDriveFootfall = Math.round(targetPostCount * goalBlend.drive_footfall);
  const targetStrengthenBrand = targetPostCount - targetDriveFootfall;
  
  // Select top N segments, balancing goals and offerings
  const selected: ActivatedSegment[] = [];
  const offeringCounts: Record<string, number> = {};
  let driveFootfallCount = 0;
  let strengthenBrandCount = 0;
  
  for (const segment of sorted) {
    if (selected.length >= targetPostCount) break;
    if (segment.this_week_priority === 'deactivated') continue;
    
    // Check offering balance (avoid N-1 from same offering)
    const offeringCount = offeringCounts[segment.programme_name] || 0;
    if (offeringCount >= targetPostCount - 1) {
      notes.push(`Skipped ${segment.segment_name} to avoid offering fatigue (${offeringCount}+ from ${segment.programme_name})`);
      continue;
    }
    
    // Track selection
    selected.push(segment);
    offeringCounts[segment.programme_name] = offeringCount + 1;
    
    if (segment.goal === 'drive_footfall') {
      driveFootfallCount++;
    } else {
      strengthenBrandCount++;
    }
  }
  
  // Check goal distribution tolerance (+/-10%)
  const tolerance = Math.ceil(targetPostCount * 0.1);
  if (Math.abs(driveFootfallCount - targetDriveFootfall) > tolerance) {
    notes.push(`Goal distribution slightly off target (${driveFootfallCount}/${strengthenBrandCount} vs ${targetDriveFootfall}/${targetStrengthenBrand})`);
  }
  
  // Check offering diversity
  const maxOfferingCount = Math.max(...Object.values(offeringCounts));
  if (maxOfferingCount > targetPostCount - 1) {
    notes.push(`Warning: ${maxOfferingCount} posts from single offering may cause fatigue`);
  }
  
  return {
    recommended_segments: selected,
    allocation_notes: notes,
    goal_distribution: {
      drive_footfall: driveFootfallCount,
      strengthen_brand: strengthenBrandCount,
    },
    offering_distribution: offeringCounts,
  };
}

// ============================================================
// MAIN EXPORT
// ============================================================

/**
 * Run the activation engine
 */
export function runActivationEngine(input: ActivationEngineInput): ActivationEngineOutput {
  console.log('[ActivationEngine] Starting activation for week', input.weekContext.week_number);
  console.log('[ActivationEngine] Segments to analyze:', input.brandSegments.length);
  console.log('[ActivationEngine] Holidays this week:', input.weekContext.public_holidays.map(h => h.name).join(', ') || 'none');
  
  // Step 1: Detect behavioral patterns
  const patterns = detectBehavioralPatterns(input);
  console.log('[ActivationEngine] Behavioral patterns detected:', patterns.length);
  patterns.forEach(p => {
    console.log(`  - ${p.pattern_name} (${p.activation_level}): ${p.trigger_reason}`);
  });
  
  // Step 2: Score and activate segments
  const activatedSegments: ActivatedSegment[] = [];
  const deactivatedSegments: DeactivatedSegment[] = [];
  
  for (const segment of input.brandSegments) {
    const result = calculateActivationScore(segment, patterns, input);
    
    if (result.priority === 'deactivated') {
      deactivatedSegments.push({
        segment_name: segment.segment_name,
        programme_name: segment.programme_name,
        deactivation_reason: result.reasons.join('; '),
      });
      console.log(`[ActivationEngine] DEACTIVATED: ${segment.segment_name} (${segment.programme_name})`);
    } else {
      const activated: ActivatedSegment = {
        segment_name: segment.segment_name,
        programme_name: segment.programme_name,
        programme_type: segment.programme_type,
        normal_priority: segment.segment_size,
        this_week_priority: result.priority,
        activation_score: result.score,
        normal_timing: segment.timing_windows,
        extended_timing: result.extended_timing,
        active_days: result.extended_days,
        normal_decision: segment.decision_timing,
        this_week_decision: result.decision_shift || segment.decision_timing,
        content_angles: segment.content_angles,
        goal: segment.goal_contribution,
        commercial_value: DECISION_TYPE_VALUES[segment.decision_timing],
        activation_reasons: result.reasons,
      };
      
      activatedSegments.push(activated);
      console.log(`[ActivationEngine] ACTIVATED: ${segment.segment_name} (${segment.programme_name}) - ${result.priority} (score: ${result.score})`);
    }
  }
  
  // Step 3: Generate allocation guidance
  const allocation = generateAllocationGuidance(
    activatedSegments,
    input.targetPostCount,
    input.brandContext.goal_blend
  );
  
  console.log('[ActivationEngine] Allocation guidance:', {
    recommended: allocation.recommended_segments.length,
    goals: allocation.goal_distribution,
    offerings: allocation.offering_distribution,
  });
  
  // Step 4: Determine week type
  let weekType: 'normal' | 'holiday_week' | 'event_week' | 'extended_weekend' = 'normal';
  if (patterns.some(p => p.pattern_name === 'family_behavior' && p.activation_level === 'surge')) {
    weekType = 'extended_weekend';
  } else if (input.weekContext.public_holidays.length > 0) {
    weekType = 'holiday_week';
  }
  
  const primaryBehaviors = patterns
    .filter(p => p.activation_level === 'surge' || p.activation_level === 'high')
    .map(p => p.pattern_name);
  
  return {
    behavioral_patterns: patterns,
    activated_segments: activatedSegments,
    deactivated_segments: deactivatedSegments,
    allocation_guidance: allocation,
    metadata: {
      week_type: weekType,
      primary_behaviors: primaryBehaviors,
      confidence: 0.95, // High confidence - deterministic logic
    },
  };
}
