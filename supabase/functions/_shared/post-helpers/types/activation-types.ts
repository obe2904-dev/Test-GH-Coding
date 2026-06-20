/**
 * ACTIVATION ENGINE TYPE DEFINITIONS
 * 
 * The activation engine pre-processes brand segmentation + week context
 * to determine which audience segments are active/deactivated this week.
 * 
 * This replaces hardcoded examples and generic audience lists with
 * context-specific, data-driven segment activation.
 */

// ============================================================
// INPUT TYPES
// ============================================================

export interface BrandSegment {
  segment_name: string;
  programme_type: string; // "brunch" | "lunch" | "dinner" | "bar"
  programme_name: string; // Display name like "Frokost", "Aftensmad"
  timing_windows: string[]; // ["Mon-Fri 12-14", "Sat-Sun 10-14"]
  content_angles: string[]; // Pre-defined angles from Brand Profile
  segment_size: 'primary' | 'secondary' | 'niche';
  motivation: string; // "social_gathering" | "convenience" | "experience_seeking" | "routine"
  decision_timing: 'spontaneous' | 'planned' | 'mixed';
  goal_contribution: 'drive_footfall' | 'strengthen_brand' | 'retain_regulars';
  evidence?: string[]; // Proof from database
}

export interface HolidayInfo {
  date: string; // ISO date
  name: string;
  typical_bridge_day: boolean;
  day_of_week: string; // "Monday", "Tuesday", etc.
}

export interface WeatherInfo {
  avg_temp: number;
  conditions: string[];
  precipitation_days: number;
}

export interface ActivationEngineInput {
  brandSegments: BrandSegment[];
  weekContext: {
    week_number: number;
    year: number;
    dates: string[]; // ISO dates for the week
    public_holidays: HolidayInfo[];
    weather: WeatherInfo;
  };
  brandContext: {
    location_type: string; // "centrum", "residential", "tourist_area"
    offerings: string[]; // ["Frokost", "Brunch", "Aftensmad", "Bar"]
    features: string[]; // ["outdoor_seating", "takeaway", "børnemenu"]
    goal_blend: { drive_footfall: number; strengthen_brand: number };
  };
  targetPostCount: number;
}

// ============================================================
// OUTPUT TYPES
// ============================================================

export interface BehavioralPattern {
  pattern_name: string; // "family_behavior", "work_behavior", "leisure_behavior"
  activation_level: 'surge' | 'high' | 'active' | 'sustain' | 'deactivated';
  active_days: string[]; // ["Thursday", "Friday", "Saturday", "Sunday"]
  time_windows?: string[]; // Optional specific time windows
  trigger_reason: string; // Human-readable explanation
}

export interface ActivatedSegment {
  segment_name: string;
  programme_name: string; // "Frokost", "Brunch", etc.
  programme_type: string;
  
  // Priority shifts
  normal_priority: 'primary' | 'secondary' | 'niche';
  this_week_priority: 'surge' | 'high' | 'active' | 'sustain';
  activation_score: number; // 0-100 for sorting
  
  // Timing modifications
  normal_timing: string[]; // Original timing windows
  extended_timing: string[]; // Modified for this week
  active_days: string[]; // Day names when segment is active
  
  // Decision context
  normal_decision: string;
  this_week_decision: string; // Can shift spontaneous→planned
  
  // Content guidance
  content_angles: string[];
  emphasis_shift?: string; // Optional note about what to emphasize
  
  // Allocation metadata
  goal: string;
  commercial_value: number; // For prioritization
  
  // Reasoning (transparency & debugging)
  activation_reasons: string[];
}

export interface DeactivatedSegment {
  segment_name: string;
  programme_name: string;
  deactivation_reason: string;
}

export interface AllocationGuidance {
  recommended_segments: ActivatedSegment[]; // Top N, sorted by score
  allocation_notes: string[]; // Warnings or recommendations
  goal_distribution: {
    drive_footfall: number;
    strengthen_brand: number;
  };
  offering_distribution: Record<string, number>; // { "Frokost": 1, "Aftensmad": 2 }
}

export interface ActivationEngineOutput {
  behavioral_patterns: BehavioralPattern[];
  activated_segments: ActivatedSegment[];
  deactivated_segments: DeactivatedSegment[];
  allocation_guidance: AllocationGuidance;
  metadata: {
    week_type: 'normal' | 'holiday_week' | 'event_week' | 'extended_weekend';
    primary_behaviors: string[];
    confidence: number; // 0-1
  };
}

// ============================================================
// UTILITY TYPES
// ============================================================

export interface TimingWindow {
  days: string[]; // ["Monday", "Tuesday", ...]
  start_hour: number;
  end_hour: number;
  raw_string: string;
}

export interface ActivationRule {
  name: string;
  condition: (input: ActivationEngineInput) => boolean;
  apply: (input: ActivationEngineInput) => BehavioralPattern[];
}
