/**
 * Location Intelligence Types
 */
import { DatabaseTimestamps } from './shared';

// Landmark nearby structure
export interface LandmarkNearby {
  name: string;
  type: 'tourist_attraction' | 'cultural' | 'transport' | 'commercial' | 'park';
  walking_minutes: number;
  marketing_angle?: string;
}

// Public transport structure
export interface MetroStation {
  name: string;
  line: string;
  walking_minutes: number;
}

export interface BusStop {
  name: string;
  lines: string[];
  walking_minutes: number;
}

export interface PublicTransport {
  metro_stations?: MetroStation[];
  bus_stops?: BusStop[];
  parking?: {
    available: boolean;
    type: 'street' | 'garage' | 'lot';
    price_info?: string;
  };
}

// Location type match structure
export interface LocationTypeMatch {
  match_score: number; // 0-100
  match_level: 'strong' | 'moderate' | 'weak';
  confidence: number; // 0.0-1.0
  reason: string;
}

// Main location intelligence type
export interface BusinessLocationIntelligence extends DatabaseTimestamps {
  business_id: string;
  
  // Geographic context
  neighborhood: string | null;
  neighborhood_character: string | null;
  area_type: 'old_town' | 'harbor_front' | 'residential' | 'business_district' | 'shopping_district' | 'cultural_quarter' | 'mixed' | null;
  
  // Coordinates
  latitude: number | null;
  longitude: number | null;
  
  // Pure location type analysis (STEP 1)
  location_type_matches: Record<string, LocationTypeMatch>; // Which location types describe this location
  
  // Proximity data (JSONB)
  landmarks_nearby: LandmarkNearby[];
  public_transport: PublicTransport;
  
  // Location assets
  has_view: boolean;
  view_type: string[] | null;
  outdoor_space_type: 'terrace' | 'courtyard' | 'sidewalk' | 'rooftop' | 'garden' | null;
  
  // Marketing hooks
  location_marketing_hooks: string[];
  
  // User-editable flags
  is_hidden_gem: boolean;
  street_visibility: 'high' | 'medium' | 'low' | 'hidden' | null;
  
  // Metadata
  last_updated_by_ai: string | null;
  user_confirmed_at: string | null;
}

// Create/Update input types
export type CreateLocationIntelligence = Omit<
  BusinessLocationIntelligence, 
  'created_at' | 'updated_at' | 'last_updated_by_ai' | 'user_confirmed_at'
>;

export type UpdateLocationIntelligence = Partial<CreateLocationIntelligence>;
