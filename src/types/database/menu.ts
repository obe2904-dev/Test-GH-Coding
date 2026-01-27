/**
 * Menu Metadata Types
 */
import { DatabaseTimestamps } from './shared';

export interface BusinessMenuMetadata extends DatabaseTimestamps {
  business_id: string;
  
  // Update tracking
  last_updated: string | null;
  update_frequency: 'seasonal' | 'monthly' | 'quarterly' | 'annually' | null;
  next_planned_update: string | null; // Date string
  
  // Statistics
  total_items_count: number;
  signature_items_count: number;
  seasonal_items_count: number;
  
  // Sourcing & philosophy
  local_ingredients_pct: number | null; // 0-100
  organic_certified: boolean;
  sustainability_focus: string[]; // ['local_sourcing', 'zero_waste', etc.]
  food_philosophy: string | null;
  
  // Beverage program
  has_specialty_coffee: boolean;
  coffee_roaster: string | null;
  has_full_bar: boolean;
  has_wine_list: boolean;
  wine_list_focus: string | null;
  
  // Dietary accommodations
  dietary_options: string[]; // ['vegetarian', 'vegan', etc.]
}

export type CreateMenuMetadata = Omit<BusinessMenuMetadata, 'created_at' | 'updated_at'>;
export type UpdateMenuMetadata = Partial<CreateMenuMetadata>;
