/**
 * Shared database types and utilities
 */

// Standard timestamp fields present on all tables
export interface DatabaseTimestamps {
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

// Common enums
export type BusinessType = 
  | 'cafe' 
  | 'restaurant' 
  | 'bar' 
  | 'bistro' 
  | 'hotel_restaurant'
  | 'bakery'
  | 'food_truck';

export type PriceLevel = 
  | 'budget' 
  | 'moderate' 
  | 'upscale' 
  | 'fine_dining';

export type Priority = 
  | 'critical' 
  | 'high' 
  | 'medium' 
  | 'low';

export type GoalStatus = 
  | 'not_started' 
  | 'in_progress' 
  | 'achieved' 
  | 'paused'
  | 'abandoned';

export type GoalType = 
  | 'fill_timeslot' 
  | 'promote_offering' 
  | 'build_awareness' 
  | 'drive_reservations'
  | 'increase_engagement'
  | 'launch_new_offering'
  | 'seasonal_campaign';

export type DayOfWeek = 
  | 'monday' 
  | 'tuesday' 
  | 'wednesday' 
  | 'thursday' 
  | 'friday' 
  | 'saturday' 
  | 'sunday';

export type ServicePeriod = 
  | 'breakfast' 
  | 'brunch' 
  | 'lunch' 
  | 'afternoon_coffee' 
  | 'dinner' 
  | 'late_night';

// Utility types for API operations
export type WithTimestamps<T> = T & DatabaseTimestamps;

export type CreateInput<T> = Omit<T, 'created_at' | 'updated_at'>;

export type UpdateInput<T> = Partial<Omit<T, 'id' | 'business_id' | 'created_at' | 'updated_at'>>;
