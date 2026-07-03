/**
 * Brand Profile V5 Pipeline Type Definitions
 * 
 * Defines strict TypeScript interfaces for all layer inputs/outputs
 * in the brand profile generation pipeline.
 * 
 * Architecture:
 * - Layer 0: Business Intelligence (facts)
 * - Layer 1: Programme Detection (structure)
 * - Layer 2: Commercial Orientation (strategy per programme)
 * - Layer 4: Audience Segmentation (who responds per programme)
 * - Layer 5: Voice Profile (how we speak)
 * - Layer 5.5: Strategic Tone DNA (voice in practice)
 * - Layer 6: Marketing Manager Brief (synthesis)
 * 
 * @version 1.0.0
 * @date 2026-06-23
 */

// ============================================================================
// LAYER 0: BUSINESS INTELLIGENCE
// ============================================================================

export interface BusinessIdentityPersona {
  system_persona: string;
  metadata: {
    word_count: number;
    generated_at: string;
    om_os_length: number;
    has_location_intelligence: boolean;
    has_menu_overview: boolean;
    location_dimensions: number;
    signature_themes_count: number;
  };
}

export interface GeographicContext {
  neighborhood?: string;
  area_type?: string;
  category_scores?: {
    waterfront?: number;
    city_centre?: number;
    tourist?: number;
    student?: number;
    residential?: number;
  };
  location_marketing_hooks?: string[];
  is_strategy_driver?: string;
  local_location_reference?: string;
  signature_reference?: string;
  location_type?: string;
}

export interface MenuOverview {
  signature_themes: string[];
  gastronomic_profile?: string;  // Optional - may be missing for single-menu venues or AI failures
  cross_menu_summary?: string;
  total_items: number;
  total_menus: number;
  overall_avg_price?: number;
  craft_signals?: string[];
}

export interface ExtractedUSPs {
  primary_usp: {
    text: string;
    score: number;
    source: 'menu' | 'location' | 'hybrid';
  };
  secondary_usps: Array<{
    text: string;
    score: number;
    source: string;
  }>;
  synthesis_reasoning: string;
}

export interface Layer0Output {
  businessIdentityPersona: BusinessIdentityPersona;
  geographicContext: GeographicContext;
  menuOverview: MenuOverview | null;  // May be null if menu-overview-summary hasn't run
  extractedUSPs: ExtractedUSPs;
  metadata: {
    generated_at: string;
    model_version: string;
    business_id: string;
  };
}

// ============================================================================
// LAYER 1: PROGRAMME DETECTION
// ============================================================================

export interface Programme {
  type: string;           // 'brunch', 'lunch', 'dinner', 'cocktails', etc.
  label: string;          // Display name
  timeWindow: {
    start: string;        // "09:00"
    end: string;          // "14:00"
  };
  daysOfWeek: string[];   // ['monday', 'tuesday', ...]
  menuEvidence: string[]; // Menu names that support this programme
  confidence: 'high' | 'medium' | 'low';
  metadata?: {
    languageVariants?: Record<string, string>;
  };
}

export interface Layer1Output {
  programmes: Programme[];
  metadata: {
    detection_method: 'v2_extraction' | 'v1_keywords';
    total_programmes_detected: number;
    generated_at: string;
  };
}

// ============================================================================
// LAYER 2: COMMERCIAL ORIENTATION (per programme)
// ============================================================================

export interface CommercialOrientation {
  baseline_goal_split: {
    booking_push: number;    // 0-100
    footfall_push: number;   // 0-100
  };
  decision_timing: 'last_minute' | 'planned' | 'hybrid';
  content_type_affinity: {
    visual_content_importance: 'high' | 'medium' | 'low';
    menu_detail_emphasis: 'high' | 'medium' | 'low';
  };
  price_positioning: 'budget' | 'value' | 'moderate' | 'upscale' | 'premium';
  reasoning: string;
}

export interface Layer2Output {
  commercial_orientations: Array<{
    programme_id: string;  // References programme.type from Layer 1
    orientation: CommercialOrientation;
  }>;
  metadata: {
    generated_at: string;
    model_used: string;
  };
}

// ============================================================================
// LAYER 4: AUDIENCE SEGMENTATION (per programme)
// ============================================================================

export interface AudienceSegment {
  segment_name: string;
  motivation: string;
  timing_preference: string;
  content_angle: string;
  confidence: number;
}

export interface Layer4Output {
  audience_segments_by_programme: Array<{
    programme_id: string;  // References programme.type from Layer 1
    segments: AudienceSegment[];
  }>;
  strategic_audience_segments?: string;  // Synthesized overview
  metadata: {
    generated_at: string;
    total_segments: number;
  };
}

// ============================================================================
// ENRICHED PROGRAMME (Combines Layer 1, 2, 4)
// ============================================================================

export interface EnrichedProgramme {
  // Layer 1: Base programme
  programme: Programme;
  
  // Layer 2: Commercial orientation (added after Layer 2)
  commercialOrientation?: CommercialOrientation;
  
  // Layer 4: Audience segments (added after Layer 4)
  audienceSegments?: AudienceSegment[];
}

// ============================================================================
// LAYER 5: VOICE PROFILE
// ============================================================================

export interface VoiceProfile {
  formality_level: string;
  emoji_usage: string;
  tone_rules: string[];
  humor_level?: string;
  voice_rationale?: string;
}

export interface Guardrails {
  never_say: string[];
  avoid_patterns: {
    strip_from_output: Record<string, string[]>;
    generation_constraints: Record<string, string[]>;
  };
}

export interface WritingExamples {
  typical_openings: string[];
  typical_closings?: string[];
  good_examples?: string[];
}

export interface Layer5Output {
  voiceProfile: VoiceProfile;
  guardrails: Guardrails;
  writingExamples: WritingExamples;
  metadata: {
    generated_at: string;
    model_used: string;
  };
}

// ============================================================================
// LAYER 5.5: STRATEGIC TONE DNA
// ============================================================================

export interface ToneDNA {
  tone_positioning: string;
  culinary_character?: {
    craft_signals?: string[];
    signature_themes?: string[];
  };
  constraints_summary?: string;
}

export interface EnhancedExample {
  text: string;
  rationale: string;
}

export interface AvoidExample {
  text: string;
  why_avoid: string;
}

export interface EnhancedExamples {
  social_examples: EnhancedExample[];
  avoid_examples: AvoidExample[];
}

export interface Layer5_5Output {
  toneDNA: ToneDNA;
  enhancedExamples: EnhancedExamples;
  metadata: {
    generated_at: string;
    examples_count: number;
  };
}

// ============================================================================
// LAYER 6: MARKETING MANAGER BRIEF
// ============================================================================

export interface MarketingManagerBrief {
  marketing_manager_brief: string;
  metadata: {
    word_count: number;
    generated_at: string;
  };
}

export interface Layer6Output {
  marketingManagerBrief: MarketingManagerBrief;
}

// ============================================================================
// COMPLETE V5 PROFILE (All Layers Combined)
// ============================================================================

export interface CompleteV5Profile {
  // Layer outputs (saved to brand_profile_v5 JSONB)
  layer_0_intelligence: Layer0Output;
  layer_1_programmes: EnrichedProgramme[];  // Includes Layer 2 & 4 data
  voice: VoiceProfile;
  guardrails: Guardrails;
  writing_examples: WritingExamples;
  tone_dna: ToneDNA;
  enhanced_social_examples: EnhancedExamples;
  marketing_manager_brief: MarketingManagerBrief;
  
  // Derived/flattened fields for backward compatibility
  commercial_baseline_mode: 'booking_push' | 'footfall_push' | 'balanced';
  business_identity_persona: string;
  strategic_audience_segments?: string;
  
  // Metadata
  metadata: {
    generated_at: string;
    generation_duration_ms: number;
    layer_versions: {
      layer_0: string;
      layer_1: string;
      layer_2: string;
      layer_4: string;
      layer_5: string;
      layer_5_5: string;
      layer_6: string;
    };
  };
}

// ============================================================================
// VALIDATION & ERROR TYPES
// ============================================================================

export class ValidationError extends Error {
  constructor(
    public layer: string,
    public field: string,
    message: string
  ) {
    super(`[${layer}] Validation failed for ${field}: ${message}`);
    this.name = 'ValidationError';
  }
}

export class AuditFailure extends Error {
  constructor(
    public layer: string,
    public contradictions: number,
    public retryable: boolean,
    message: string
  ) {
    super(`[${layer}] Audit failed with ${contradictions} contradiction(s): ${message}`);
    this.name = 'AuditFailure';
  }
}

// ============================================================================
// LAYER FUNCTION SIGNATURES (Type Definitions Only)
// ============================================================================

export type Layer0Function = (
  businessId: string,
  supabaseClient: any,
  openaiClient: any,
  language: string,
  requestId: string,
  menuOverviewSummary?: any
) => Promise<Layer0Output>;

export type Layer1Function = (
  layer0: Layer0Output,
  supabaseClient: any,
  businessId: string,
  requestId: string
) => Promise<Layer1Output>;

export type Layer2Function = (
  layer0: Layer0Output,
  layer1: Layer1Output,
  supabaseClient: any,
  openaiClient: any,
  businessId: string,
  requestId: string
) => Promise<EnrichedProgramme[]>;

export type Layer4Function = (
  layer0: Layer0Output,
  layer1: Layer1Output,
  enrichedProgrammes: EnrichedProgramme[],
  supabaseClient: any,
  openaiClient: any,
  businessId: string,
  requestId: string
) => Promise<EnrichedProgramme[]>;

export type Layer5Function = (
  layer0: Layer0Output,
  layer4AggregatedSegments: AudienceSegment[],
  enrichedProgrammes: EnrichedProgramme[],
  supabaseClient: any,
  openaiClient: any,
  businessId: string,
  language: string,
  requestId: string
) => Promise<Layer5Output>;

export type Layer5_5Function = (
  layer0: Layer0Output,
  layer5: Layer5Output,
  enrichedProgrammes: EnrichedProgramme[],
  openaiClient: any,
  requestId: string
) => Promise<Layer5_5Output>;

export type Layer6Function = (
  layer0: Layer0Output,
  enrichedProgrammes: EnrichedProgramme[],
  layer5: Layer5Output,
  layer5_5: Layer5_5Output,
  openaiClient: any,
  requestId: string
) => Promise<Layer6Output>;

// ============================================================================
// VALIDATION FUNCTION SIGNATURES
// ============================================================================

export type ValidationFunction<T> = (
  output: T,
  requestId: string
) => void;  // Throws ValidationError if invalid

export type AuditFunction = (
  ...args: any[]
) => void;  // Throws AuditFailure if quality issues found
