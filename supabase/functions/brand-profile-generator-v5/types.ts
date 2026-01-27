/**
 * Types for Brand Profile Generator
 */

export interface BrandProfileGenerationRequest {
  business_id: string;
}

export interface BusinessKnowledgeGathered {
  // Core business info
  business: {
    id: string;
    name: string;
    type: string;
    address: string;
    city: string;
  };
  
  // Location intelligence
  location?: {
    neighborhood: string | null;
    area_type: string | null;
    landmarks_nearby: any[];
    has_view: boolean;
    view_type: string[] | null;
    outdoor_space_type: string | null;
    location_marketing_hooks: string[];
  };
  
  // Operations
  operations?: {
    seating_capacity_indoor: number | null;
    seating_capacity_outdoor: number | null;
    price_level: string | null;
    has_table_service: boolean;
    has_takeaway: boolean;
  };
  
  // Menu data
  menu_items?: Array<{
    name: string;
    description: string | null;
    is_signature: boolean;
  }>;
  
  // Menu metadata
  menu_metadata?: {
    organic_certified: boolean;
    food_philosophy: string | null;
    has_specialty_coffee: boolean;
    coffee_roaster: string | null;
  };
}

export interface BrandProfileGenerated {
  brand_essence: string;
  brand_positioning: string;
  tone_of_voice: {
    primary_tone: string;
    attributes: string[];
    formality_level: string;
  };
  content_hooks: Array<{
    hook: string;
    usage: string;
  }>;
  banned_words: string[];
  target_audience: {
    primary: string;
    characteristics: string[];
  };
  competitive_positioning: {
    differentiators: string[];
    key_advantages: string[];
  };
}

export interface GenerationProgress {
  step: 'gathering' | 'analyzing' | 'generating' | 'validating' | 'saving' | 'complete';
  message: string;
  percentage: number;
}
