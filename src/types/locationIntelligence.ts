export interface LandmarkNearby {
  name: string;
  type: string;
  walking_distance_minutes: number;
  walking_distance_meters: number;
  marketing_angle?: string;
}

export interface MarketingHook {
  text: string;
  category: 'proximity' | 'area_character' | 'emotional' | 'audience' | 'time_based' | 'vibe';
  show_on_location_page: boolean;
}

export interface WhoSegment {
  segment: string;
  intent: string;
  confidence: 'High' | 'Medium' | 'Low';
  based_on: string[];
}

export interface WhenPattern {
  time_pattern: string;
  description: string;
  confidence: 'High' | 'Medium' | 'Low';
  based_on: string[];
}

export interface WhyAngle {
  angle: string;
  value_proposition: string;
  confidence: 'High' | 'Medium' | 'Low';
  based_on: string[];
}

export interface AssumptionToReview {
  assumption: string;
  reason: string;
}

export interface LocationIntelligence {
  business_id: string;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string | null;
  neighborhood_character: string | null;
  area_type: string | null;
  landmarks_nearby: LandmarkNearby[];
  location_marketing_hooks: MarketingHook[];
  street_visibility: string | null;
  who_analysis?: WhoSegment[];
  when_analysis?: WhenPattern[];
  why_analysis?: WhyAngle[];
  assumptions_to_review?: AssumptionToReview[];
  public_transport?: {
    metro_stations?: Array<{
      station_name: string;
      walking_minutes: number;
    }>;
    bus_stops?: Array<{
      stop_name: string;
      walking_minutes: number;
    }>;
  };
  created_at?: string;
  updated_at?: string;
}

export interface PopulateLocationRequest {
  business_id: string;
  force_refresh?: boolean;  // Task 4.5: Bypass 90-day cache and re-analyze
}

export interface PopulateLocationResponse {
  success: boolean;
  location_intelligence?: LocationIntelligence;
  error?: string;
  cached?: boolean;  // Task 4.5: Indicates if result came from cache
}
