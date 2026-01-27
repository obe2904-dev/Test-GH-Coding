/**
 * Audience & Market Profile Types
 */
import { DatabaseTimestamps } from './shared';

// Customer segment structure
export interface CustomerSegment {
  segment_name: string;
  characteristics: string[];
  behaviors: string[];
  preferences: string[];
  marketing_insights?: string;
}

// Social media audience structure
export interface SocialMediaPlatformData {
  follower_count?: number;
  engagement_rate?: number;
  top_demographics?: string[];
  peak_activity_times?: string[];
}

export interface SocialMediaAudience {
  instagram?: SocialMediaPlatformData;
  facebook?: SocialMediaPlatformData;
  google_my_business?: {
    total_views_per_month?: number;
    average_rating?: number;
    total_reviews?: number;
  };
}

// Market position structure
export interface MarketPosition {
  positioning_statement?: string;
  unique_selling_points?: string[];
  target_reputation?: 'hidden_gem' | 'neighborhood_favorite' | 'destination';
}

// Competitor structure
export interface Competitor {
  name: string;
  competitive_advantage?: string;
  differentiation?: string;
}

export interface BusinessAudienceProfile extends DatabaseTimestamps {
  business_id: string;
  
  customer_segments: CustomerSegment[];
  social_media_audience: SocialMediaAudience;
  market_position: MarketPosition;
  main_competitors: Competitor[];
  
  local_market_trends: string[];
  seasonal_customer_patterns: string | null;
  
  last_updated: string | null;
}

export type CreateAudienceProfile = Omit<BusinessAudienceProfile, 'created_at' | 'updated_at' | 'last_updated'>;
export type UpdateAudienceProfile = Partial<CreateAudienceProfile>;
