// Shared types for generate-text-from-idea

export interface Suggestion {
  id: number | string
  title: string
  // v2 fields (new)
  captionBase?: string          // 50-150 word platform-neutral brief from ai-generate-v2
  contentType?: string          // 'menu_item' | 'atmosphere' | 'behind_scenes' | 'seasonal'
  menuItemName?: string         // specific menu item name from v2 idea
  menuItemDescription?: string  // DB description for menu item (weekly_plan source)
  ctaIntent?: string            // 'visit' | 'social' | 'engagement' | 'save'
  goalMode?: 'drive_footfall' | 'build_brand' | 'retain_loyalty'  // weekly_plan source
  photoIdea?: string
  source?: 'ai_ideas' | 'weekly_plan'  // caller origin
  // legacy fields (backward compat)
  rationale?: string
  whyExplanation?: string       // Gemini's 2-3 sentence strategic angle (AI Ideas path); seeds scene for non-menu posts
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
  thingsToAvoid: string
  voiceConstraints: string
  emojiInstruction: string
  todayOpenTime: string
  selectedCta: string
  businessName: string
  city: string
  language: string
  isPaid: boolean
  weeklyPlanContext: string   // pre-built UGEPLANKONTEKST block; empty string for AI Ideer path
  isWeeklyPlan: boolean       // drives startRules and context block injection
  ctaStyle: 'strict' | 'soft' // strict = verbatim booking CTA with URL; soft = model integrates naturally
  goalMode?: string           // weekly_plan: 'drive_footfall' | 'build_brand' | 'retain_loyalty'
  voiceRationale: string      // v5: voice_rationale — "Hvorfor denne anbefaling?" — register constraint
  venueIdentity: string       // v5: recognizable_interior_identity.value — factual venue description
  businessCharacter: string   // v5: business_character — what this business actually is
  identityKeywords: string[]  // v5: identity_keywords — 3-5 identity chips
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
  brandSignaturePhrases: string[]
  contentAnchors: string[]      // tone_model.content_anchors — programmes + menu categories
  thingsToAvoid: string
  goalMode?: string             // weekly_plan only — shifts BRANDSTEMME header framing
  isSceneMoodPost?: boolean     // team_people / behind_scenes / atmosphere — reframes examples as voice-register reference
  voiceRationale?: string       // v5: voice_rationale — injected as 🚫 REGISTERVAGT for scene/mood posts
  venueIdentity?: string        // v5: recognizable_interior_identity.value — factual anchor for atmosphere posts
  businessCharacter?: string    // v5: business_character — what the business IS (prevents product hallucination)
  identityKeywords?: string[]   // v5: identity_keywords — category guardrail
}
