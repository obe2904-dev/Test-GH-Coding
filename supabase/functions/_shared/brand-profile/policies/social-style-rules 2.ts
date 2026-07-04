/**
 * Social Style Policies
 * 
 * Research-backed rules for social media content (emoji, hashtags, voice examples).
 * These policies are enforced post-generation as deterministic validation,
 * keeping Prompt B concise and focused on brand profile generation.
 * 
 * Research basis: 5M+ social media posts analyzed for engagement patterns.
 */

/**
 * Emoji Research Policy
 * Based on engagement data from 5M+ posts
 */
export interface EmojiPolicy {
  optimal_count: number
  max_recommended: number
  placement: "end" | "start" | "inline"
  high_performers: string[]
  industry_specific: Record<string, string[]>
  banned: string[]
  skip_contexts: string[]
}

export const EMOJI_RESEARCH_POLICY: EmojiPolicy = {
  optimal_count: 1, // 29% more engagement vs no emoji
  max_recommended: 3, // Diminishing returns after 3
  placement: "end", // Best performance at sentence end
  
  high_performers: [
    "🔥", // Fire - urgency, excitement, limited-time
    "🚀", // Rocket - growth, speed, new launches
    "🎯", // Bullseye - precision, targeted solutions
    "⬇️", // Blue arrow - best performer in studies
    "❤️", // Red heart - emotional connection
    "⚠️", // Warning - attention-grabbing
    "✨", // Sparkle - excitement, new things
    "✅", // Checkmark - lists, confirmations
  ],
  
  industry_specific: {
    cafe: ["☕", "🥐", "🍳", "🥗", "🍽️", "🍷"],
    restaurant: ["🍽️", "🍷", "🥗", "🍳", "🥘"],
    bar: ["🍸", "🍻", "🍷", "🎵", "🌃"],
    bistro: ["🍽️", "🍷", "🥐", "🍴"],
    fitness: ["💪", "🥗", "🏃‍♀️", "🏋️"],
    real_estate: ["🏠", "🗝️", "📍", "🏡"],
    ecommerce: ["🛒", "🎁", "📦", "💳"],
    finance: ["💰", "📈", "🏦", "💵"],
    health: ["❤️", "🏥", "💊", "🩺"],
  },
  
  banned: [
    "👍", // Thumbs up (passive-aggressive to younger users)
    "👌", // OK hand (negative connotations)
    "💩", // Poop (unprofessional)
    "🍆", // Eggplant (can get posts flagged)
    "💦", // Water drops (can get posts flagged)
    "🍑", // Peach (can get posts flagged)
  ],
  
  skip_contexts: [
    "legal",
    "finance_formal",
    "healthcare_serious",
    "grief_counseling",
    "formal_b2b",
  ],
}

/**
 * Emoji usage levels mapped to business formality
 */
export type EmojiUsageLevel = "none" | "minimal" | "moderate" | "expressive"

export interface EmojiUsageGuidance {
  level: EmojiUsageLevel
  count_range: [number, number]
  description: string
  best_for: string[]
}

export const EMOJI_USAGE_LEVELS: Record<EmojiUsageLevel, EmojiUsageGuidance> = {
  none: {
    level: "none",
    count_range: [0, 0],
    description: "No emojis - formal/serious tone",
    best_for: ["legal", "finance", "grief_counseling", "formal_b2b"],
  },
  minimal: {
    level: "minimal",
    count_range: [1, 2],
    description: "1-2 emojis (OPTIMAL for most businesses)",
    best_for: ["most_businesses", "professional_services", "cafes", "restaurants"],
  },
  moderate: {
    level: "moderate",
    count_range: [3, 5],
    description: "3-5 emojis - casual/lifestyle brands",
    best_for: ["casual_dining", "lifestyle_brands", "retail"],
  },
  expressive: {
    level: "expressive",
    count_range: [5, 10],
    description: "5+ emojis - youth/entertainment only",
    best_for: ["youth_brands", "entertainment", "very_casual"],
  },
}

/**
 * Voice Examples Guidance
 * Location and personality-based voice adaptation rules
 */
export interface VoiceExamplesPolicy {
  do_say_guidance: string
  dont_say_guidance: string
  vocabulary_guidance: string
  location_personality_map: Record<string, { do_say: string[]; dont_say: string[] }>
}

export const VOICE_EXAMPLES_POLICY: VoiceExamplesPolicy = {
  do_say_guidance: "Write 3-5 example post phrases THIS brand would actually use, adapted to their location + personality",
  dont_say_guidance: "Write 3-5 phrases that would feel WRONG for this brand (wrong tone, too generic, wrong personality)",
  vocabulary_guidance: "Choose words that match their voice: gæster/kunder, hjemmelavet/artisan, hyggelig/vibes",
  
  location_personality_map: {
    hipster_urban: {
      do_say: [
        "Drop by for a flat white ☕",
        "New roast just dropped",
        "Weekend vibes ved åen",
      ],
      dont_say: [
        "Vi inviterer til kulinariske oplevelser",
        "Hyggelig stemning for hele familien",
        "Kom og nyd vores lækre udvalg",
      ],
    },
    traditional_local: {
      do_say: [
        "Kom forbi til kaffe og hjemmebagt kage",
        "Søndagsbrunch med udsigt",
        "Velkommen til bords",
      ],
      dont_say: [
        "Check out our new drops",
        "Limited edition vibes",
        "Tag a friend who needs this",
      ],
    },
    premium_fine_dining: {
      do_say: [
        "Reservér bord til en aften i køkkenet",
        "Sæsonens menu er klar",
        "Oplev årstidens råvarer",
      ],
      dont_say: [
        "Kom og nyd vores lækre mad",
        "Hyggelig stemning garanteret",
        "Best burgers in town 🍔",
      ],
    },
  },
}

/**
 * Validation Functions
 */

export interface ValidationResult {
  valid: boolean
  warnings: string[]
  suggestions: string[]
}

/**
 * Validate emoji usage against research-backed policies
 */
export function validateEmojiUsage(
  emoji_examples: string[],
  emoji_usage: EmojiUsageLevel,
  business_category?: string
): ValidationResult {
  const warnings: string[] = []
  const suggestions: string[] = []
  
  // Check count alignment with declared level
  const expected_range = EMOJI_USAGE_LEVELS[emoji_usage].count_range
  if (emoji_examples.length < expected_range[0] || emoji_examples.length > expected_range[1]) {
    warnings.push(
      `Emoji count (${emoji_examples.length}) doesn't match declared level "${emoji_usage}". ` +
      `Expected ${expected_range[0]}-${expected_range[1]} emojis.`
    )
  }
  
  // Check for optimal count (1 emoji = best engagement)
  if (emoji_examples.length > EMOJI_RESEARCH_POLICY.max_recommended) {
    warnings.push(
      `Too many emojis (${emoji_examples.length}). Research shows optimal engagement with 1-3 emojis. ` +
      `Diminishing returns after ${EMOJI_RESEARCH_POLICY.max_recommended}.`
    )
    suggestions.push(`Reduce to ${EMOJI_RESEARCH_POLICY.max_recommended} most impactful emojis`)
  }
  
  // Check for banned emojis
  const banned_found = emoji_examples.filter(e => EMOJI_RESEARCH_POLICY.banned.includes(e))
  if (banned_found.length > 0) {
    warnings.push(
      `Banned emojis detected: ${banned_found.join(", ")}. ` +
      `These are unprofessional or can get posts flagged.`
    )
    suggestions.push(`Replace with high-performers: ${EMOJI_RESEARCH_POLICY.high_performers.slice(0, 3).join(" ")}`)
  }
  
  // Suggest high-performers if none are used
  const high_performers_used = emoji_examples.filter(e => EMOJI_RESEARCH_POLICY.high_performers.includes(e))
  if (emoji_examples.length > 0 && high_performers_used.length === 0 && business_category) {
    const industry_key = business_category.toLowerCase()
    const industry_emojis = EMOJI_RESEARCH_POLICY.industry_specific[industry_key] || []
    
    if (industry_emojis.length > 0) {
      suggestions.push(
        `Consider industry-specific emojis for ${business_category}: ${industry_emojis.slice(0, 3).join(" ")}`
      )
    } else {
      suggestions.push(
        `Consider high-performing emojis: ${EMOJI_RESEARCH_POLICY.high_performers.slice(0, 3).join(" ")}`
      )
    }
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
    suggestions,
  }
}

/**
 * Validate voice examples for consistency and quality
 */
export function validateVoiceExamples(
  do_say: string[],
  dont_say: string[],
  vocabulary_prefer: string[],
  vocabulary_avoid: string[]
): ValidationResult {
  const warnings: string[] = []
  const suggestions: string[] = []
  
  // Check minimum counts
  if (do_say.length < 3) {
    warnings.push(`Too few do_say examples (${do_say.length}). Provide at least 3.`)
  }
  if (dont_say.length < 3) {
    warnings.push(`Too few dont_say examples (${dont_say.length}). Provide at least 3.`)
  }
  if (vocabulary_prefer.length < 5) {
    warnings.push(`Too few vocabulary.prefer words (${vocabulary_prefer.length}). Provide at least 5.`)
  }
  if (vocabulary_avoid.length < 5) {
    warnings.push(`Too few vocabulary.avoid words (${vocabulary_avoid.length}). Provide at least 5.`)
  }
  
  // Check for overlap between prefer and avoid
  const overlap = vocabulary_prefer.filter(word => vocabulary_avoid.includes(word))
  if (overlap.length > 0) {
    warnings.push(`Vocabulary conflict: words appear in both prefer and avoid: ${overlap.join(", ")}`)
  }
  
  // Check for generic placeholder text
  const generic_patterns = /jeres|perfekt til|hvem|\.\.\.|\.\.\./i
  const generic_do_say = do_say.filter(phrase => generic_patterns.test(phrase))
  if (generic_do_say.length > 0) {
    warnings.push(`Generic placeholder text in do_say: "${generic_do_say[0]}"`)
    suggestions.push("Use specific, brand-adapted phrases instead of placeholders")
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
    suggestions,
  }
}

/**
 * Get recommended emojis for a business category
 */
export function getRecommendedEmojis(
  business_category: string,
  count: number = 3
): string[] {
  const category_key = business_category.toLowerCase()
  const industry_emojis = EMOJI_RESEARCH_POLICY.industry_specific[category_key]
  
  if (industry_emojis) {
    return industry_emojis.slice(0, count)
  }
  
  // Fallback to high-performers
  return EMOJI_RESEARCH_POLICY.high_performers.slice(0, count)
}

/**
 * Determine optimal emoji usage level for a business
 */
export function determineEmojiUsageLevel(
  business_category: string,
  tone_formality: "formal" | "professional" | "casual" | "very_casual" = "professional"
): EmojiUsageLevel {
  const category_lower = business_category.toLowerCase()
  
  // None - formal contexts
  if (EMOJI_RESEARCH_POLICY.skip_contexts.includes(category_lower) || tone_formality === "formal") {
    return "none"
  }
  
  // Expressive - youth/entertainment
  if (["entertainment", "youth_brand", "nightclub"].includes(category_lower) || tone_formality === "very_casual") {
    return "expressive"
  }
  
  // Moderate - casual dining/lifestyle
  if (["casual_dining", "lifestyle", "retail"].includes(category_lower) || tone_formality === "casual") {
    return "moderate"
  }
  
  // Minimal - most businesses (OPTIMAL)
  return "minimal"
}
