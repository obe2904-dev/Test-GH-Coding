/**
 * Business Goals Types
 */
import { DatabaseTimestamps, GoalType, Priority, GoalStatus, DayOfWeek, ServicePeriod } from './shared';

// Target metric structure
export interface TargetMetric {
  metric: 'bookings' | 'revenue' | 'foot_traffic' | 'engagement' | 'awareness' | string;
  current_value: number;
  target_value: number;
  target_date: string; // Date string
  measurement_unit?: string; // "per_week", "total", etc.
}

// Time constraints structure
export interface TimeConstraints {
  target_days?: DayOfWeek[];
  target_periods?: ServicePeriod[];
  avoid_days?: DayOfWeek[];
  start_date?: string;
  end_date?: string;
}

// Target audience segment structure
export interface TargetAudienceSegment {
  demographics?: string[];
  behaviors?: string[];
}

// Promotional hook structure
export interface PromotionalHook {
  offer_type?: 'discount' | 'special_menu' | 'experience' | string;
  message_angle?: string;
  cta?: string;
}

// Main goals type
export interface BusinessGoal extends DatabaseTimestamps {
  id: string;
  business_id: string;
  
  // Goal definition
  goal_type: GoalType;
  priority: Priority;
  title: string;
  description: string;
  
  // Targeting
  target_metric: TargetMetric;
  time_constraints: TimeConstraints;
  target_audience_segment: TargetAudienceSegment;
  promotional_hook: PromotionalHook;
  
  // Progress
  status: GoalStatus;
  progress_pct: number; // 0-100
  notes: string | null;
  
  // Metadata
  created_by: string | null;
}

export type CreateBusinessGoal = Omit<BusinessGoal, 'id' | 'created_at' | 'updated_at' | 'created_by'>;
export type UpdateBusinessGoal = Partial<Omit<BusinessGoal, 'id' | 'business_id' | 'created_at' | 'updated_at'>>;
