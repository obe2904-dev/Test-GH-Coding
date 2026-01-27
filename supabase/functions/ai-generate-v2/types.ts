// Core TypeScript interfaces for AI Generate V2

// Opening hours structure (matches WeekHours from opening-hours-extractor.ts)
export interface DayHours {
  open?: string  // "09:00"
  close?: string  // "22:00"
  closed?: boolean
}

export interface WeekHours {
  monday?: DayHours
  tuesday?: DayHours
  wednesday?: DayHours
  thursday?: DayHours
  friday?: DayHours
  saturday?: DayHours
  sunday?: DayHours
}

export interface BusinessProfile {
  id: string
  user_id: string
  business_name: string
  primary_language: string
  country?: string
  city?: string
  timezone?: string  // e.g., "Europe/Copenhagen" (IANA timezone)
  opening_hours?: WeekHours  // Business hours by day of week
  brand_voice?: {
    tone?: string[]
    essence?: string
    style_notes?: string
  }
  business_offerings?: string
  content_pillars?: string[]
  booking_url?: string
  forbidden_terms?: string[]
  required_tone_anchors?: string[]
  cta_config?: {
    default_style?: 'soft' | 'booking'  // Default CTA style preference
    custom_ctas?: {
      book?: string      // Custom booking CTA: "Book dit bord nu"
      visit?: string     // Custom visit CTA: "Kom forbi i dag"
      menu?: string      // Custom menu CTA: "Se vores menu"
      engage?: string    // Custom engagement CTA: "Del med os"
    }
    use_emojis?: boolean  // Whether to include emojis in CTAs
  }
}

export type Daypart = 'breakfast' | 'lunch' | 'dinner' | 'lateNight'

export interface MenuItem {
  id: string
  name: string
  category: string
  daypart_tags: Daypart[]  // Allowed dayparts from menu-rules.ts
  short_desc?: string
  price?: number
  menu_source: string  // "Brunch Menu", "Aftermenu", etc.
  raw_line: string  // Original "NAME (CATEGORY)" format
}

export interface MenuCatalog {
  items: MenuItem[]
  getItemsByCategory: (category: string) => MenuItem[]
  getAllowedItemsForDaypart: (daypart: Daypart) => MenuItem[]
  getAllowedItemsForTime: (time: string, language: string, country?: string) => MenuItem[]
  getItemsByMenuSource: (source: string) => MenuItem[]
}

export interface WeatherData {
  temperature: number
  condition: string  // e.g., "Clear", "Rain", "Clouds"
  description: string  // e.g., "light rain", "clear sky"
  icon: string
  timestamp: number
}

export interface PreviousPost {
  id: string
  content: string
  platform: string
  created_at: string
  engagement?: {
    likes?: number
    comments?: number
    shares?: number
  }
}

/**
 * PostFingerprint - Compact representation of a post's key characteristics
 * Used for novelty checking to prevent repetitive content
 */
export interface PostFingerprint {
  theme: 'menu' | 'vibe' | 'occasion'  // Primary theme
  anchors: string[]  // Location/interior/experience anchors used
  menuItems: string[]  // Menu item names mentioned
  ctaIntent: 'book' | 'menu' | 'visit' | 'engage'  // Call-to-action type
}

/**
 * VerifiedAnchor - Anchor with provenance tracking
 * Prevents using generic phrases like "hyggelig atmosfære" as if they were verified
 * 
 * Source hierarchy (confidence order):
 * 1. location_enrichment: From Google Places, high confidence
 * 2. website: Extracted from business website
 * 3. user_input: Explicitly provided by user
 * 4. photos: Inferred from photo analysis
 * 5. reviews: Mentioned in customer reviews
 * 6. generic: Too generic to be considered verified (DON'T USE)
 */
export interface VerifiedAnchor {
  text: string  // The actual anchor text: "ved åen i Aarhus"
  source: 'location_enrichment' | 'website' | 'user_input' | 'photos' | 'reviews' | 'generic'
  confidence: 'high' | 'medium' | 'low'
  category: 'location' | 'interior' | 'experience'
  metadata?: {
    extracted_from?: string  // URL, review ID, photo ID, etc.
    verified_at?: string     // ISO timestamp
    verified_by?: string     // "user" | "system" | "enrichment"
  }
}

/**
 * VerifiedAnchors - Collection of anchors with provenance
 * IMPORTANT: Only use anchors with source !== 'generic' and confidence === 'high'
 */
export interface VerifiedAnchors {
  location: VerifiedAnchor[]
  interior: VerifiedAnchor[]
  experience: VerifiedAnchor[]
}

export interface PostIdea {
  idea_type: 'menu' | 'vibe' | 'occasion'
  menu_item: { name: string, category: string } | null
  hook: string  // Opening line/headline
  caption_base: string  // Core message without platform-specific formatting
  cta_intent: 'book' | 'menu' | 'visit' | 'engage'
  best_time: string
  impact: 'low' | 'medium' | 'high'
  photo_suggestion: string
  reasoning?: string  // Why this idea (internal)
  slot_id?: string  // Which slot this idea fills (A, B, C)
}

// Validation result for a single idea
export interface ValidationResult {
  valid: boolean
  severity?: 'critical' | 'fixable' | 'warning'  // Error classification
  errors: ValidationError[]
  warnings: ValidationError[]
  fixable?: boolean
  fixes?: Array<{ type: string, description: string }>  // Auto-fix suggestions
}

// PostIdea with validation metadata (for graceful degradation)
export interface IdeaWithMetadata {
  idea: PostIdea
  metadata: {
    source: 'ai' | 'fallback_template' | 'auto_fixed'  // Generation source
    quality: 'high' | 'standard'  // Quality indicator
    validation_status: 'valid' | 'valid_with_warnings' | 'auto_fixed' | 'fallback'
    template_type?: 'menu_spotlight' | 'vibe_reminder' | 'occasion_prompt'  // If fallback
    original_error?: string  // If fallback, what went wrong
    fixes_applied?: Array<{ type: string, description: string }>  // If auto-fixed
    warnings?: string[]  // If valid_with_warnings
    impact_score?: {  // NEW: Computed impact estimation (replaces AI guess)
      impact: 'low' | 'medium' | 'high'
      confidence: number  // 0-1, how confident we are in this estimate
      factors: {
        hook_quality: number      // 0-1, optimal 5-10 words + emoji
        caption_quality: number   // 0-1, optimal 80-150 chars + specificity
        novelty: number           // 0-1, based on validation status and source
        specificity: number       // 0-1, menu items > generic vibes
        validation_clean: number  // 0-1, clean > warnings > fallback
      }
    }
  }
}

// BrandPolicy - Compiled constraints from BusinessProfile
// ENHANCED: Three-tier offerings structure for better hallucination prevention
// ENHANCED: Anchor provenance system to prevent generic "verified" claims
export interface BrandPolicy {
  voice_rules: {
    tone: string[]
    essence?: string
    style_notes?: string
  }
  forbidden_terms: string[]
  offerings_allowlist: string[]  // DEPRECATED: Use offerings.exact + offerings.generic
  offerings?: {
    exact: string[]  // Verified specific offerings: ["kaffe", "brunch", "pariserbøf"]
    generic: string[]  // Safe category terms: ["mad", "drikkevarer", "dessert"]
    forbidden: string[]  // Common hallucinations: ["cocktails", "rooftop", "livemusik"]
  }
  verified_anchors: VerifiedAnchors  // NEW: With provenance tracking
  verified_anchors_legacy?: {  // DEPRECATED: Old string-only format (backward compatibility)
    location?: string[]
    interior?: string[]
    experience?: string[]
  }
  language: string
  country: string
}

// IdeaSlot - Explicit constraint for each of 3 ideas
export interface IdeaSlot {
  slot_id: 'A' | 'B' | 'C'
  idea_type: 'menu' | 'vibe' | 'occasion'
  daypart?: Daypart
  allowed_categories?: string[]  // Menu categories allowed for this slot
  must_include: {
    menu_item?: { name?: string; category?: string }  // Specific item or just category
    anchors?: string[]  // Must reference these verified anchors
    time_reference?: string  // NEW: "Opens at 08:00" for closed business
    forward_looking?: boolean  // NEW: Use anticipatory language
    planning_language?: boolean  // NEW: Encourage booking/planning
  }
  must_avoid: {
    forbidden_terms: string[]
    unverified_claims: boolean  // Can't invent offerings
    urgent_language?: boolean  // NEW: Avoid "now", "hurry", "today"
  }
  cta_intent: 'book' | 'menu' | 'visit' | 'engage'
  reasoning: string  // Why this slot was chosen
}

// IdeaPlan - Complete 3-slot plan with policy
export interface IdeaPlan {
  slots: [IdeaSlot, IdeaSlot, IdeaSlot]
  policy: BrandPolicy
  strategy_reasoning: string
}

export interface PlatformPost {
  platform: 'facebook' | 'instagram'
  text: string  // ONLY hook + caption_base (clean content, no CTA)
  cta: {
    text: string  // "Kom forbi" or "Book dit bord"
    type: 'soft' | 'booking' | 'menu' | 'custom'
    url?: string  // booking_url for Facebook when type='booking', undefined for Instagram
  }
  hashtags: string[]
}

// DEPRECATED: Use PostIdea instead
export interface PostSuggestion {
  headline: string
  text: string
  photoSuggestion: string
  bestTimeToPost: string
  impact: 'low' | 'medium' | 'high'
  menuItemUsed?: string
  reasoning?: string  // Why this suggestion (internal, not shown to user)
}

export interface GenerationContext {
  businessProfile: BusinessProfile
  menuCatalog: MenuCatalog
  weather?: WeatherData
  previousPosts?: PreviousPost[]
  userTier: 'smart' | 'standardplus' | 'premium'
  language: string
}

export interface GenerationRequest {
  user_id: string
  business_id?: string
  count?: number  // Number of suggestions (default 3)
  userTier: string
}

export interface GenerationResponse {
  ideas: PostIdea[]  // Raw platform-neutral ideas (deprecated: use ideasWithMetadata)
  ideasWithMetadata?: IdeaWithMetadata[]  // Ideas with validation/source metadata
  formatted: {
    facebook: PlatformPost[]
    instagram: PlatformPost[]
  }
  metadata: {
    model: string
    language: string
    context_used: string[]
    generated_at: string
  }
  summary?: {
    generation_quality: 'full' | 'partial' | 'degraded'  // Quality assessment
    ai_ideas: number  // Count of AI-generated ideas
    fallback_ideas: number  // Count of template fallbacks
    auto_fixed_ideas: number  // Count of auto-fixed ideas
    warnings: number  // Count of warnings
    total_cost: string  // e.g., "$0.015"
    cost_saved: string  // e.g., "$0.000 (no retry needed)"
    impact_note?: string  // NEW: Explains that impact is computed, not AI-guessed
  }
}

// DEPRECATED: Old response format
export interface LegacyGenerationResponse {
  suggestions: PostSuggestion[]
  metadata: {
    model: string
    language: string
    context_used: string[]
    generated_at: string
  }
}

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}
