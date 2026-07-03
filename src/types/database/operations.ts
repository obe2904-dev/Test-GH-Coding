/**
 * Business Operations Types
 */
import { DatabaseTimestamps, DayOfWeek, PriceLevel } from './shared';

// Opening hours structure
export interface DayHours {
  open: string; // "08:00"
  close: string; // "22:00"
  closed: boolean;
}

export type OpeningHours = Partial<Record<DayOfWeek, DayHours>>;

// Main operations type
export interface BusinessOperations extends DatabaseTimestamps {
  business_id: string;
  
  // Hours
  opening_hours: OpeningHours;
  
  // Seating
  seating_capacity_indoor: number | null;
  seating_capacity_outdoor: number | null;
  
  // Pricing
  price_level: PriceLevel | null;
  
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
