// Shared types for generate-text-from-idea

export interface Suggestion {
  id: number | string
  title: string
  // v2 fields (new)
  captionBase?: string          // 50-150 word platform-neutral brief from ai-generate-v2
  contentType?: string          // 'menu_item' | 'atmosphere' | 'behind_scenes' | 'seasonal'
  menuItemId?: string           // UUID of menu item in menu_items_normalized (preferred lookup method)
  menuItemName?: string         // specific menu item name from v2 idea
  menuItemDescription?: string  // DB description for menu item (weekly_plan source)
  ctaIntent?: string            // 'visit' | 'social' | 'engagement' | 'save'
  goalMode?: 'drive_footfall' | 'build_brand' | 'retain_loyalty'  // weekly_plan source
  photoIdea?: string
  source?: 'ai_ideas' | 'weekly_plan'  // caller origin
  // legacy fields (backward compat)
  rationale?: string
  whyExplanation?: string       // Gemini's 2-3 sentence strategic angle (AI Ideas path); seeds scene for non-menu posts
  occasionContext?: string      // NEW: Creative occasion brief for LEJLIGHED/KONTEKST (1 sentence)
  // Weekly Plan occasion/context fields (source === 'weekly_plan')
  guestMoment?: string          // occasion / guest angle (whyThisDish[0] for non-menu)
  timingDay?: string            // e.g. "Fredag"
  timingTime?: string           // e.g. "19:00"
  timingRationale?: string      // reason for timing choice
  visualSubject?: string        // visualDirection.subject
  visualAngle?: string          // visualDirection.angle
  visualSetting?: string        // visualDirection.setting
  platformFormat?: string       // e.g. "Reel", "photo"
  selectionRationale?: string   // why this post was chosen for this week
  captionFirstLine?: string     // soft opening line seed from the weekly plan
  holidayContext?: string       // e.g. "Langfredag – Emphasis: Easter traditions – Promote: Traditional Danish Easter lunch"
  drinkPairing?: string         // Phase 2b drink pairing suggestion (e.g. "Negroni", "husets øl")
  strategyBrief?: string         // Phase 2b compact directive: what caption should achieve + weather/timing/role context
  mediaDirection?: string        // Phase 2b photo/scene direction — what to photograph and how
  sceneSpec?: string             // Phase 2b scene specification for experience posts (who/action/setting)
}

export interface PromptOptions {
  hook: string
  contentBlock: string        // pre-built INDHOLD block (scene/mood/dish + optional description)
  menuItemName: string        // set when a specific dish is named (drives isolation rule)
  menuItemDescription: string // sanitized description (drives sensory detail rule)
  contentType: string         // drives dish-isolation vs. scene-only instruction
  brandTone: string           // v5: 5 writing rules; v2: primary_tone string
  brandWritingRules: string[] // v5: tone_model.writing_rules
  brandGoodExamples: string[] // v5: tone_model.good_examples
  brandAvoidExamples: string[]// v5: tone_model.avoid_examples
  brandPreferVocab: string[]  // v5: voice_examples.vocabulary.prefer
  brandAvoidVocab: string[]   // v5: voice_examples.vocabulary.avoid
  brandSignaturePhrases: string[] // v5: signature_phrases — brand-specific phrases (context-filtered)
  contentAnchors: string[]    // v5: tone_model.content_anchors — programmes + menu categories
  keyOfferings?: string       // Free tier: newline-separated menu names from business_profile.key_offerings
  thingsToAvoid: string[]     // v5: things_to_avoid + never_say combined
  forbidden_phrases: string[] // Phase 2 Week 1: forbidden phrases from guardrails
  technical_terms: string[]   // Phase 2 Week 1: technical database terms to avoid
  weather_cliches: string[]   // Phase 2 Week 1: weather clichés to avoid
  avoid_patterns?: { brochure_language?: string[], superlatives?: string[], generic_marketing?: string[] } // Phase 2 Week 1: pattern-based guardrails
  seasonal_notes: string[]    // Phase 2 Week 1: time-based content constraints (filtered for current month)
  voiceConstraints: string
  emojiInstruction: string
  todayOpenTime: string
  todayCloseTime: string
  kitchenCloseTime?: string   // kitchen close time (may differ from venue close); used for food posts
  selectedCta: string | null  // null for behind_scenes; optional for other types
  businessName: string
  city: string
  locationText: string        // computed: localLocationReference OR "i ${city}"
  language: string
  isPaid: boolean
  weeklyPlanContext: string   // pre-built UGEPLANKONTEKST block; empty string for AI Ideer path
  isWeeklyPlan: boolean       // drives startRules and context block injection
  ctaStyle: 'strict' | 'soft' // strict = verbatim booking CTA with URL; soft = model integrates naturally
  goalMode?: string           // weekly_plan: 'drive_footfall' | 'build_brand' | 'retain_loyalty'
  bookingLink?: string | null // booking URL for drive_footfall CTA
  voiceRationale: string      // v5: voice_rationale — "Hvorfor denne anbefaling?" — register constraint
  venueIdentity: string       // v5: recognizable_interior_identity.value — factual venue description
  venueCharacter: string      // v5: visual_character — concept label (formality + type) from photo analysis
  venueScene: string          // v5: venue_scene — observational scene-setting from photo analysis
  keyOfferings?: string       // Free tier: menu names from Profile (newline-separated)
  identityKeywords: string[]  // v5: identity_keywords — 3-5 identity chips
  vertical: string            // business vertical within F&B (cafe, restaurant, bar, bakery…)
  effectiveVertical: string   // keyword-detected operational type for prompt context
  humorLevel: string          // v5: humor_level — 'none' | 'subtle' | 'moderate' | 'high'
  formalityLevel: string      // v5: formality_level — 'informal' | 'semi-formal' | 'formal' (synced from tone_dna)
  targetAudience: string      // v5: target_audience — who this business serves
  communicationGoal: string   // v5: communication_goal — primary comms objective
  emotionalPromise: string    // Stage B3: the feeling a guest takes home (one sentence)
  contentExclusions: string   // Stage B3: what this brand never posts about (one sentence)
  typicalOpenings: string[]   // example opening phrases from tone_of_voice Eksempel: lines
  locationIntelligenceMotivations: string[]  // matched_motivations (e.g. 'destinationsbesøg')
  priceLevel?: string                         // operations.price_level mapped to label (budget/casual/mid-range/premium)
  doSayExamples?: string[]                    // §16.13: voice_examples.do_say — curated example sentences
  brandContext?: { origin_story?: string; unique_differentiator?: string; local_landmarks?: string[] } | null  // §16.8
  // B5 audience segment — active for current day/hour
  activeSegmentName?: string
  activeSegmentMotivation?: string
  activeSegmentAngle?: string
  seasonalContextSignal?: string              // L3: month + weekday + location-category seasonality
  // B5 business model classification
  businessModelType?: string   // "offer_led" | "occasion_led" | "destination_led" | "audience_led"
  primaryCopyHook?: string     // "product" | "location" | "programme" | "identity"
  audienceBreadth?: string     // "narrow" | "mixed" | "broad"
  // V5.5: Tone DNA and enhanced examples
  tone_dna?: any                        // V5.5: Full tone DNA structure
  tone_dna_summary?: string | null      // tone_dna.strategic_summary
  tone_do_list?: string[] | null        // tone_dna.tone_do_list
  tone_dont_list?: string[] | null      // tone_dna.tone_dont_list
  location_natural_vocab?: string[] | null  // tone_dna.location_driver.natural_vocabulary
  location_avoid_vocab?: string[] | null    // tone_dna.location_driver.avoid_vocabulary
  humor_style?: string | null           // brand_profile_v5.voice.humor_style
  locationIntelligenceNarrative?: string | null  // Fix 4: geographic_context.narrative for atmosphere posts
  business_identity_persona?: string    // V5.5: Full business identity persona
  enhanced_social_examples?: any[]      // V5.5: Enhanced social examples
  enhanced_avoid_examples?: any[]       // V5.5: Enhanced avoid examples
}

export interface SharedToneCore {
  faktaforbud: Record<string, string>
  dishRules: Record<string, string>
  sensoryRules: Record<string, string>
  cappedWritingRules: string[]
  cappedGoodExamples: string[]
  cappedAvoidExamples: string[]
  cappedPreferVocab: string[]
  cappedAvoidVocab: string[]
  cappedContentAnchors: string[]
  isSceneMoodPost: boolean
  qualityNote: string
}

export interface BrandBlockOptions {
  brandTone: string
  voiceConstraints: string
  brandWritingRules: string[]
  brandGoodExamples: string[]
  brandAvoidExamples: string[]
  brandPreferVocab: string[]
  brandAvoidVocab: string[]
  locationVocabulary: string[]   // tone_dna.location_driver.natural_vocabulary — FACTUAL location references
  brandSignaturePhrases: string[]
  contentAnchors: string[]      // tone_model.content_anchors — programmes + menu categories
  thingsToAvoid: string[]       // v5: things_to_avoid + never_say combined (array format)
  forbidden_phrases?: string[]  // Phase 2 Week 1: forbidden phrases from guardrails
  technical_terms?: string[]    // Phase 2 Week 1: technical database terms to avoid
  weather_cliches?: string[]    // Phase 2 Week 1: weather clichés to avoid
  goalMode?: string             // weekly_plan only — shifts BRANDSTEMME header framing
  isSceneMoodPost?: boolean     // team_people / behind_scenes / atmosphere — reframes examples as voice-register reference
  voiceRationale?: string       // v5: voice_rationale — injected as 🚫 REGISTERVAGT for scene/mood posts
  contentType?: string          // post content type — used to split atmosphere vs behind_scenes primary source
  venueIdentity?: string        // v5: recognizable_interior_identity.value — factual anchor for atmosphere posts
  venueCharacter?: string       // v5: visual_character — concept label for tone register calibration
  venueScene?: string           // v5: venue_scene — scene-setting language from photo analysis
  keyOfferings?: string         // Free tier: newline-separated menu names from business_profile.key_offerings
  identityKeywords?: string[]   // v5: identity_keywords — category guardrail
  humorLevel?: string           // v5: humor_level — voice register hint
  formalityLevel?: string        // v5: formality_level — 'informal' | 'semi-formal' | 'formal'
  targetAudience?: string       // v5: target_audience — who to address
  communicationGoal?: string    // v5: communication_goal — what the brand wants to achieve
  emotionalPromise?: string     // Stage B3: the feeling a guest takes home — injected for atmosphere/BTS
  contentExclusions?: string    // Stage B3: what this brand never posts about — injected as hard prohibition
  priceLevel?: string            // business_operations.price_level mapped to Danish label
  doSayExamples?: string[]       // §16.13: voice_examples.do_say — example sentences (strong few-shot voice anchor)
  brandContext?: { origin_story?: string; unique_differentiator?: string; local_landmarks?: string[] } | null  // §16.8
  typicalOpenings?: string[]     // v5: writing_examples.typical_openings — example opening phrases
  locationIntelligenceMotivations?: string[]  // matched_motivations (e.g. 'destinationsbesøg')
  hospitalityDensityText?: string            // competitive context for atmosphere/BTS posts
  seasonalContextSignal?: string             // L3: month + weekday + location-category seasonality
  // B5 audience segment — active for current day/hour
  activeSegmentName?: string
  activeSegmentMotivation?: string
  activeSegmentAngle?: string
  // B5 business model classification
  businessModelType?: string   // "offer_led" | "occasion_led" | "destination_led" | "audience_led"
  primaryCopyHook?: string     // "product" | "location" | "programme" | "identity"
  audienceBreadth?: string     // "narrow" | "mixed" | "broad"
  // V5.5: Tone DNA fields
  tone_dna?: any                              // tone DNA object from brand_profile_v5.voice.tone_dna
  business_identity_persona?: string          // synthesized persona from tone DNA
  enhanced_social_examples?: any[]            // good examples with reasoning
  enhanced_avoid_examples?: any[]             // avoid examples with failure reasons
}
