/**
 * V5 Brand Profile - Complete Type Definitions
 * 
 * This file defines the complete V5 brand profile structure stored in
 * business_brand_profile.brand_profile_v5 JSONB column.
 * 
 * @version 5.0
 * @date May 9, 2026
 */

import type { LocationStrategyOutput } from './location-strategy.ts';

// ============================================================================
// LAYER 1-4: Programme Detection, Commercial Orientation, Identity, Audience
// ============================================================================

export interface V5Programme {
  type: string;                    // 'brunch' | 'lunch' | 'dinner' | 'bar' | etc.
  name: string;                    // Display name: "Brunch", "Aftensmad"
  timeWindow: {
    start: string;                 // "10:00"
    end: string;                   // "14:00"
  };
  daysOfWeek: string[];           // ["saturday", "sunday"]
  confidence: 'high' | 'medium' | 'low';
  menuEvidence: string[];          // ["Brunch menu", "Weekend brunch"]
  
  // Layer 2: Commercial Orientation (per programme)
  commercialOrientation: {
    decision_timing: 'impulse' | 'planned' | 'mixed';
    baseline_goal_split: {
      drive_footfall: number;      // 0-100
      strengthen_brand: number;    // 0-100
    };
    content_type_affinity?: {
      product_showcase: number;    // 0-1
      experience_story: number;    // 0-1
      values_mission: number;      // 0-1
    };
    reasoning: string;
  };
  
  // Layer 4: Audience Segments (per programme)
  audienceSegments: Array<{
    segment_name: string;          // "Weekend-brunch-gæster"
    motivation: string;            // "social_gathering" | "experience_seeking" | etc.
    timing_preference: string;     // "Lør-Søn 10:00-14:00"
    content_angle: string;         // "Social brunch-oplevelse"
    confidence: number;            // 0-1
  }>;
}

export interface V5Identity {
  brand_essence: string;                // 1-2 sentence soul of the business
  positioning: string;                  // 2-3 sentence competitive differentiation
  business_description: string;         // Casual conversational identity ("alsidig café") - less formal than positioning
  category_keywords: string[];          // Identity chips: ["café", "brunch-spot", "cocktailbar"]
  core_values: string[];                // 3-5 guiding principles
  what_makes_us_different: string;      // One sentence USP
  location_identity?: {                 // Structured location proximity data (NEW - V5.1)
    water_proximity?: string;           // Specific water body: "åen" | "bugten" | "havet" | "søen" | "fjorden" | etc.
    landmark_proximity?: string;        // Specific landmark: "domkirken" | "slottet" | "torvet" | etc.
    full_reference?: string;            // Complete local reference: "ved åen" | "ved domkirken"
  };
  identity_confidence: number;          // 0-1 score
  identity_reasoning: string;           // Why these values chosen
  identity_sources: string[];           // Array of evidence sources
  
  // === MIGRATED FROM LEGACY (Phase 1) ===
  target_audience?: string;             // Who the brand speaks to (from legacy)
  communication_goal?: string;          // What each post should achieve (from legacy)
  emotional_promise?: string;           // Emotional value proposition (from legacy)
  brand_context?: {                     // Origin story and differentiators (from legacy)
    origin_story?: string;
    unique_differentiator?: string;
    local_landmarks?: string[];
  };
  venue_identity?: string;              // Recognizable interior identity (from legacy recognizable_interior_identity)
  visual_identity?: {                   // Photo analysis results (from legacy visual_character, venue_scene)
    visual_character?: string;
    venue_scene?: string;
  };
}

// ============================================================================
// LAYER 5: Voice, Writing Examples, Guardrails
// ============================================================================

// ============================================================================
// LAYER 5: Tone DNA (Strategic Tone Recommendation)
// ============================================================================

// NEW V5.5: Strategic tone recommendation from marketing expert perspective
export interface V5ToneDNARecommendation {
  strategic_analysis: string;           // Marketing expert's analysis of optimal tone
  tone_positioning: string;             // Recommended tone position: "casual-warm", "professional-friendly", etc.
  confidence: number;                   // 0-1 confidence in recommendation
  key_factors: string[];                // What drove this recommendation
}

export interface V5ToneDNALocationDriver {
  primary_dimension: string;            // "waterfront", "city_centre", "residential", etc.
  score: number;                        // 85-100
  strategic_importance: 'critical' | 'important' | 'moderate';  // How much it drives tone
  tone_implications: string[];          // Why this location type matters for tone
  natural_vocabulary: string[];         // Location-appropriate words/phrases
  avoid_vocabulary: string[];           // Words that clash with this positioning
}

export interface V5ToneDNACulinaryCharacter {
  price_positioning: 'budget' | 'value' | 'moderate' | 'upscale' | 'premium';  // From commercial orientation
  culinary_identity: string;            // "casual dining", "modern bistro", "neighborhood café"
  signature_themes: string[];           // From menu_overview_summary
  fusion_patterns: string[];            // Cultural/culinary fusion signals
  craft_signals: string[];              // "Hjemmelavet", "egen produktion", etc.
  tone_implications: string[];          // How culinary character affects tone
  natural_vocabulary: string[];         // Food/quality descriptors that fit
  formality_requirement: string;        // "Casual", "elevated-casual", "formal"
}

export interface V5ToneDNAOwnerVoice {
  register_level: 'casual' | 'professional' | 'formal';
  style_observations: string[];         // Observed style patterns (NOT specific words to avoid seed contamination)
  sentence_structure: string;           // "Simple, direct", "flowing, descriptive"
  tone_implications?: string[];         // How owner's voice should guide brand voice
  authenticity_note: string;            // Reminder to match owner's natural register
}

export interface V5ToneDNAMarketContext {
  country: string;                      // "Danmark"
  cultural_norms: string[];             // Danish communication expectations
  competition_level: 'low' | 'medium' | 'high' | 'very_high';
  demographic_signals: {
    primary_demographic?: string;       // "student", "tourist", "residential", "office"
    score?: number;
    tone_implications?: string[];
  };
  market_maturity: string;              // "emerging", "growing", "mature", "saturated"
  strategic_positioning_need: string;   // What the market demands (differentiation, accessibility, etc.)
}

export interface V5ToneDNA {
  // Core strategic recommendation
  recommended_tone: V5ToneDNARecommendation;
  
  // Four pillars of tone strategy
  location_driver: V5ToneDNALocationDriver;
  culinary_character: V5ToneDNACulinaryCharacter;
  owner_voice: V5ToneDNAOwnerVoice;
  market_context: V5ToneDNAMarketContext;
  
  // Synthesis
  strategic_summary: string;            // 2-3 sentences: "Given waterfront position, casual dining, and student demographic..."
  tone_do_list: string[];               // 5-7 strategic tone guidelines (replacing generic tone_rules)
  tone_dont_list: string[];             // 3-5 strategic tone warnings
  
  // Metadata
  generated_at: string;
  confidence_score: number;             // 0-1 overall confidence
  expert_reasoning: string;             // Marketing expert's full reasoning
}

// NEW V5.5: Enhanced social writing example with reasoning
export interface V5EnhancedSocialExample {
  text: string;                         // The example phrase/sentence
  why_it_works: string[];               // 2-4 reasons this exemplifies the tone
  tone_elements_demonstrated: string[]; // Which DNA elements it shows
  content_type?: string;                // "menu_item", "atmosphere", "event", "offer"
  platform_fit?: string[];              // ["instagram", "facebook"] if specific
}

// NEW V5.5: Enhanced avoid example with reasoning
export interface V5EnhancedAvoidExample {
  text: string;                         // The problematic example
  why_it_fails: string[];               // 2-4 reasons it misses the mark
  violates_dna_elements: string[];      // Which DNA principles it breaks
  better_alternative?: string;          // Optional: What to do instead
}

export interface V5Voice {
  // NEW V5.5: Strategic tone DNA (replaces generic tone_rules)
  tone_dna?: V5ToneDNA;
  
  // ENHANCED V5.5: Examples with reasoning
  enhanced_social_examples?: V5EnhancedSocialExample[];  // 12-15 examples with reasoning
  enhanced_avoid_examples?: V5EnhancedAvoidExample[];    // 8-10 anti-patterns with reasoning
  
  // LEGACY FIELDS (kept for backward compatibility)
  tone_rules: string[];                 // Actionable voice rules (max 5-7) - DEPRECATED in v5.5
  structural_rules?: string[];          // NEW: Rules that are enforceable (v5.1)
  style_rules?: string[];               // NEW: Style guidance (non-enforceable) (v5.1)
  personality_traits: string[];         // 3-5 traits: ["kortfattet", "direkte", "venlig"]
  formality_level: 'informal' | 'semi-formal' | 'formal';
  humor_style: 'dry' | 'playful' | 'professional' | 'none';
  humor_level?: 'none' | 'subtle' | 'moderate' | 'high';  // MIGRATION: Legacy humor_level format (will be mapped to humor_style)
  sentence_structure: 'short_declarative' | 'conversational' | 'formal' | 'varied';
  emoji_level: 'none' | 'minimal' | 'moderate' | 'expressive';  // Research-backed emoji frequency
  emoji_reasoning?: string;             // Why this emoji level (category + formality logic)
  content_anchors: string[];            // Factual boundaries: ["Brunch", "Frokost", "Bar"] (prevents hallucination)
  team_people_anchors?: string[];       // NEW (v5.6): Verified team roles and processes for BTS content
                                        // Prevents hallucination in brand_behind/team_people posts
                                        // Examples: ["Bartender med cocktailprogram", "Køkken der tilbereder hjemmelavede elementer", "Barista med specialty coffee"]
                                        // Extracted from menu (craft signals) and vertical/programme (roles)
  menu_description_examples?: string[]; // NEW (v5.2): 2-3 examples showing how to describe menu items in this voice (casual + culinary awareness)
  social_writing_examples?: string[];   // NEW (v5.4): 8 tone-demonstrating phrases for social media (not CTAs/emojis - just tone) - LEGACY
  menu_description_metadata?: {         // NEW (v5.3): Origin mention strategy guidance
    origin_mention_frequency?: 'never' | 'selective' | 'frequent' | 'always';  // How often to mention dish origins
    origin_mention_reasoning?: string;  // Why this frequency (based on signature_themes, menu analysis)
    variation_enforced?: boolean;       // Whether examples deliberately show varied structures
    detected_origin_keywords?: string[]; // Origins found in menu items ["fransk", "italiensk", "belgisk"]
  };
  avoid_examples?: string[];            // Anti-pattern sentences (what NOT to write) - LEGACY
  register_guidance?: string;           // Voice constraint for atmosphere posts (tone register)
  voice_confidence: number;             // 0-1 score
  voice_reasoning: string;              // How voice was derived
  
  // NEW: Enforcement metadata for validation
  enforcement_level?: 'strict' | 'moderate' | 'flexible';  // How strictly to enforce rules (derived from structural_rules count)
  sentence_length_max?: number;         // Max words per sentence (derived from sentence_structure + tone_rules)
}

export interface V5WritingExamples {
  typical_openings: string[];           // 3-5 example opening sentences
  typical_closings: string[];           // 3-5 example closing CTAs
  signature_phrases: string[];          // 3-5 brand-specific phrases
  do_say_examples?: string[];           // Curated voice-perfect full sentences (best examples)
  prefer_vocabulary?: string[];         // Brand-natural words (max 8)
  avoid_vocabulary?: string[];          // Off-brand words (max 8)
  good_examples?: string[];             // Optional: Full post examples (good)
  bad_examples?: string[];              // Optional: Full post examples (bad)
  
  // NEW v5.6: Intent-based CTA library (brand-specific call-to-action texts)
  cta_library?: {
    visit?: {
      casual?: string[];                // Informal visit CTAs: "Kom forbi!"
      formal?: string[];                // Formal visit CTAs: "Besøg os på [location]"
    };
    booking?: {
      soft?: string[];                  // Gentle booking CTAs: "Book bord hvis du vil være sikker"
      urgent?: string[];                // Urgent booking CTAs: "Book nu – få pladser tilbage"
    };
    engagement?: {
      question?: string[];              // Question-based CTAs: "Hvad synes du?"
      social?: string[];                // Social sharing CTAs: "Tag en ven med"
    };
    social_media?: string[];            // Platform-specific CTAs: "Tag os med @handle"
    signature_closing?: string;         // Brand's signature CTA (optional)
  };
  
  // NEW v5.6: CTA selection preferences
  cta_preferences?: {
    default_style?: 'casual' | 'formal';        // Default tone for visit CTAs
    booking_priority?: 'soft' | 'urgent';       // Default booking intensity
    avoid_phrases?: string[];                    // Phrases to never use (e.g., "Svip forbi")
  };
}

export interface V5Guardrails {
  never_say: string[];                  // Word replacements: "morgenmad → brunch"
  content_exclusions: string[];         // Topics to avoid: "Ingen politiske emner"
  factual_constraints: string[];        // Rules: "Opfind aldrig events"
  seasonal_notes?: string[];            // Optional: "Undgå terrasse-fokus oktober-marts"
  
  // NEW: Structured avoid patterns (v5.1, split in v5.1.3)
  // CRITICAL: These two sub-objects have DIFFERENT purposes:
  avoid_patterns?: {
    // ═══ POST-PROCESSING STRIP/VALIDATION TARGETS ═══
    // These patterns ARE used for output validation and remediation.
    // Safe to iterate and check against generated text.
    strip_from_output?: {
      brochure_language?: string[];       // e.g., ["pirrer næsen", "fuldender oplevelsen"]
      superlatives?: string[];            // e.g., ["perfekt", "fantastisk", "unik"]
      generic_marketing?: string[];       // e.g., ["forkæl dig selv", "en oplevelse"]
      ai_tells?: string[];                // e.g., ["således", "ydermere", "derudover"]
      formulaic_wallpaper?: string[];     // e.g., ["Ikke start hver ret med nationality"]
    };
    
    // ═══ GENERATION-ONLY CONSTRAINTS ═══
    // These are PROMPT INSTRUCTIONS ONLY — never used for post-processing strip/validation.
    // DANGER: These contain common words ("når", "da") that would amputate legitimate sentences.
    // Example bug: Stripping "når" from "Vi har åbent, og du er velkommen når du er klar" → "Vi har åbent, og."
    generation_constraints?: {
      compound_sentences?: string[];      // e.g., ["mens", "selvom", "fordi", "når", "da"]
      // Future: max_sentence_length, avoid_passive_voice, etc.
    };
  };
  
  // NEW: Wallpaper avoidance rules (v5.3)
  wallpaper_avoidance?: {
    max_origin_mentions_percentage?: number;  // e.g., 30 = max 30% of menu descriptions should mention origin
    required_variation_patterns?: string[];   // ["Variér mellem ingrediens/tilberedning/oprindelse som åbning"]
    forbidden_repetitions?: string[];         // ["Ikke brug 'klassisk [nationality]' i 2+ beskrivelser"]
  };
  
  // NEW: Platform-specific length targets (v5.1)
  length_limits?: {
    instagram?: { sentences: string; characters: string };
    facebook?: { sentences: string; characters: string };
    google?: { sentences: string; characters: string };
    story?: { sentences: string; characters: string };
  };
}

export interface V5AudienceClassification {
  business_model: 'offer_led' | 'occasion_led' | 'destination_led' | 'audience_led';  // Content strategy driver
  primary_hook: 'product' | 'location' | 'programme' | 'identity';                    // Lead angle for captions
  audience_breadth: 'narrow' | 'mixed' | 'broad';                                     // Audience diversity
  classification_reasoning?: string;                                                   // Why these classifications
}

// ============================================================================
// COMPLETE V5 PROFILE
// ============================================================================

export interface V5BrandProfile {
  version: string;                      // "5.0", "5.1", etc.
  generated_at: string;                 // ISO timestamp
  
  generation_metadata?: {
    request_id: string;
    duration_ms: number;
    ai_models_used: {
      layer_2?: string;                 // "gpt-4o-mini"
      layer_3?: string;                 // "gpt-4o"
      layer_4?: string;                 // "gpt-4o-mini"
      layer_5?: string;                 // "gpt-4o"
    };
  };
  
  // NEW V5.1: Layer 0 Business Intelligence (for transparency and debugging)
  layer_0_intelligence?: {
    business_type: {
      detected_type: string;            // "casual_dining", "fine_dining", etc.
      professional_domain: string;      // Danish description
      confidence: number;               // 0-1
      reasoning: string;                // Why this type was detected
    };
    geographic_context: {
      postal_code?: string;             // Danish postal code (postnummer) - most reliable city identifier
      city: string;
      population_size: string;          // "capital", "medium_city", "small_town"
      population: number;
      location_type: string;            // "waterfront_leisure", "downtown_commercial", etc.
      signature_reference?: string;     // "ved åen", "Nyhavn", etc.
      city_profile_description: {
        tone_guidance: string;          // Danish guidance for city tone
        cultural_context: string;       // Cultural context description
        competition_level: string;      // "very_high", "high", "medium", "low"
        characteristics: string[];      // ["university_town", "tourist_heavy", etc.]
      };
      location_advantages: string[];    // ["scenic location", "outdoor seating", etc.]
      narrative: string;                // Full Danish narrative sent to AI
    };
    professional_persona: {
      expertise_areas: string[];        // ["restaurant marketing", "menu communication", etc.]
      content_focus: string[];          // What the persona focuses on
      formality: string;                // "casual_friend", "casual_enthusiast", etc.
      sentence_style: string;           // "short_declarative", "conversational", "descriptive_flowing"
      emoji_usage: string;              // "minimal", "moderate", "liberal"
      system_prompt_preview: string;    // First 500 chars of actual Danish system prompt
    };
    voice_archetype: {
      archetype_id: string;             // "restaurant_approachable", etc.
      base_rules: string[];             // All Danish rules (concrete, measurable)
      base_rules_count: number;         // Number of rules
      formality_level: string;          // Formality description
      sentence_structure: string;       // Sentence structure guidance
      location_context_weight: string;  // "low", "medium", "high"
      content_priorities: string[];     // Content priority areas
    };
    // NEW V5.2: HYBRID Business Identity Persona
    business_identity: {
      system_persona: string;           // Full business identity (100-150 words Danish)
      word_count: number;
      menu_summaries_count: number;
      programmes_count: number;
      city_context_used: boolean;
      generated_at: string;
    };
    // NEW V5.2: AI-generated city context (with 90-day caching)
    city_context_ai: {
      city: string;
      country: string;
      population: number;
      city_size: string;
      cultural_context: string;
      tone: string;
      characteristics: string[];
      cached_until: string;
      ai_generated: boolean;
    } | null;
    // NEW V5.7: Location Strategy (reachable demographics + positioning angles + content triggers)
    location_strategy?: LocationStrategyOutput;
  };
  
  programmes: V5Programme[];            // Layer 1-2-4 combined
  identity: V5Identity;                 // Layer 3
  voice: V5Voice;                       // Layer 5a
  writing_examples: V5WritingExamples;  // Layer 5b
  guardrails: V5Guardrails;             // Layer 5c (enhanced in v5.1 with avoid_patterns + length_limits)
  audience_classification?: V5AudienceClassification;  // B5: Business model + copy strategy
}

// ============================================================================
// GENERATION INPUTS
// ============================================================================

export interface VoiceGenerationInput {
  business: {
    business_name: string;
    business_category: string;
    establishment_type?: string;
  };
  // DEPRECATED: identity removed - use menuContext.signature_themes instead
  identity?: V5Identity;                // Optional for backwards compatibility
  legacy_voice?: {
    tone_of_voice?: string;             // DEPRECATED (June 14, 2026) - NOT passed to AI
                                        // Legacy examples contradict V5 guardrails (generic marketing avoidance)
                                        // V5 derives voice from signature themes + context instead
    tone_model?: {
      primary_keywords?: string[];      // USED: Existing personality hints
    };
    voice_constraints?: string;         // USED: Existing voice constraints
  };
  // NEW V5.2: Enhanced context for AI-generated voice
  professionalPersona?: any;            // Professional expertise and tone defaults
  voiceArchetype?: any;                 // Voice archetype metadata (for transparency)
  geographicContext?: any;              // City profile, location type
  businessTypeDetection?: any;          // Detected business type and professional domain
  cityContext?: any;                    // AI-generated city cultural context
  locationIntelligence?: {              // Multi-dimensional location positioning
    category_scores?: {
      waterfront?: number;
      city_centre?: number;
      tourist?: number;
      student?: number;
      residential?: number;
    };
    neighborhood_character?: string;
    area_type?: string;
  };
  menuContext?: {                       // Menu intelligence for voice customization
    overall_avg_price?: number;         // Price tier for tone matching
    signature_themes?: string[];        // Menu themes for content anchors
    total_items?: number;
    sample_items?: Array<{              // NEW (v5.2): 2-3 representative menu items for description examples
      name: string;                     // Item name (e.g., "Moules frites")
      description?: string;             // Existing description if available
      ingredients?: string[];           // Key ingredients
      price?: number;
    }>;
  };
}

export interface WritingExamplesGenerationInput {
  voice: V5Voice;                       // Use Layer 5a output
  legacy_examples?: {
    typical_openings?: string[];        // Copy if exists
    typical_closings?: string[];
    signature_phrases?: string[];
  };
  legacy_never_say?: string[];          // Banned words to avoid in examples
  business: {
    business_name: string;
    menu_highlights?: string[];         // For signature phrase extraction
    location_reference?: string;        // "ved åen"
  };
}

export interface GuardrailsGenerationInput {
  voice: V5Voice;                       // Use Layer 5a output
  identity?: V5Identity;                // DEPRECATED: Use Layer 3 output (optional)
  legacy_guardrails?: {
    never_say?: string[];               // Copy if exists
    things_to_avoid?: string;
    voice_constraints?: string;
  };
  business: {
    business_category: string;
    common_mistakes?: string[];         // Industry-specific issues
    has_outdoor_seating?: boolean;      // For vocabulary-aware seasonal notes
    business_character?: string;        // To extract actual outdoor seating terminology
  };
}

// ============================================================================
// OUTPUT TYPES (for API responses)
// ============================================================================

export interface V5GenerationResult {
  success: boolean;
  requestId: string;
  durationMs: number;
  business: {
    id: string;
    name: string;
  };
  profile: V5BrandProfile;
}

export interface V5GenerationError {
  error: string;
  requestId: string;
  durationMs: number;
  layer?: string;                       // Which layer failed
  details?: unknown;
}
