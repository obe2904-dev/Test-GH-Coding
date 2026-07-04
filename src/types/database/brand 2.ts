/**
 * Brand & Visual Identity Types
 */
import { DatabaseTimestamps } from './shared';

// Photography style structure
export interface PhotographyStyle {
  overall_aesthetic?: string;
  lighting_preference?: string;
  composition_style?: string;
  color_temperature?: string;
  mood?: string;
}

// Platform visuals structure
export interface PlatformVisualSpec {
  aspect_ratio?: string;
  primary_format?: string;
  use_reels?: boolean;
  content_style?: string;
}

export interface PlatformVisuals {
  instagram?: PlatformVisualSpec;
  facebook?: PlatformVisualSpec;
  google_my_business?: PlatformVisualSpec;
}

// Color palette
export interface ColorDefinition {
  color: string; // Hex code
  name: string;
  usage: string;
}

export interface BusinessVisualIdentity extends DatabaseTimestamps {
  business_id: string;
  
  photography_style: PhotographyStyle;
  platform_visuals: PlatformVisuals;
  
  interior_style: string | null;
  signature_visual_elements: string[];
  
  primary_colors: ColorDefinition[];
  
  logo_url: string | null;
  has_consistent_branding: boolean;
  
  preferred_photo_subjects: string[];
  avoid_photo_types: string[];
}

export type CreateVisualIdentity = Omit<BusinessVisualIdentity, 'created_at' | 'updated_at'>;
export type UpdateVisualIdentity = Partial<CreateVisualIdentity>;
