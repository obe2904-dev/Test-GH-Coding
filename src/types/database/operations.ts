/**
 * Business Operations Types
 */
import { DatabaseTimestamps, DayOfWeek, ServicePeriod, PriceLevel } from './shared';

// Opening hours structure
export interface DayHours {
  open: string; // "08:00"
  close: string; // "22:00"
  closed: boolean;
}

export type OpeningHours = Partial<Record<DayOfWeek, DayHours>>;

// Service period structure
export interface ServicePeriodDetails {
  available: boolean;
  days: DayOfWeek[];
  hours: {
    start: string;
    end: string;
  };
  special_notes?: string;
}

export type ServicePeriods = Partial<Record<ServicePeriod, ServicePeriodDetails>>;

// Capacity pattern structure
export interface CapacityPattern {
  day: DayOfWeek;
  period: ServicePeriod;
  capacity_pct: number; // 0-100
  notes?: string;
  marketing_opportunity?: boolean;
}

// Main operations type
export interface BusinessOperations extends DatabaseTimestamps {
  business_id: string;
  
  // Hours
  opening_hours: OpeningHours;
  
  // Service periods
  service_periods: ServicePeriods;
  
  // Capacity patterns
  typical_busy_periods: CapacityPattern[];
  typical_slow_periods: CapacityPattern[];
  
  // Seating
  seating_capacity_indoor: number | null;
  seating_capacity_outdoor: number | null;
  
  // Pricing
  price_level: PriceLevel | null;
  average_check_per_person: number | null;
  currency: string;
  
  // Service model
  has_table_service: boolean;
  has_takeaway: boolean;
  has_delivery: boolean;
  reservation_required: boolean;
  accepts_walk_ins: boolean;
  
  // Amenities
  has_wifi: boolean;
  has_power_outlets: boolean;
  has_parking: boolean;
}

export type CreateBusinessOperations = Omit<BusinessOperations, 'created_at' | 'updated_at'>;
export type UpdateBusinessOperations = Partial<CreateBusinessOperations>;
