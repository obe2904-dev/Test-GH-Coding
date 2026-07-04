/**
 * LAYER 8: CAPTION GENERATOR
 * Generates platform-optimized captions with brand voice, context weaving, and CTAs
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// ============================================================================
// TYPES
// ============================================================================

interface BrandVoice {
  tone: 'casual' | 'refined' | 'playful' | 'professional'
  emoji_frequency: 'none' | 'minimal' | 'moderate' | 'frequent'
  voice_description?: string
}

interface SeasonalContext {
  season: 'spring' | 'summer' | 'fall' | 'winter'
  weather?: string
  temperature?: string
}

interface LocationContext {
  type: 'waterfront' | 'city_center' | 'historic' | 'residential' | 'suburban'
  amplifiers?: string[]
  secondary_types?: string[] // Additional scored location types (≥60%) beyond primary
}

interface ContentPurpose {
  type: 'menu_highlight' | 'location_story' | 'behind_scenes' | 'engagement' | 'event_promotion' | 'atmosphere'
  subject: string
  postTime?: string // e.g., "lunch", "dinner", "morning"
}

interface CaptionInput {
  brandVoice: BrandVoice
  seasonalContext: SeasonalContext
  locationContext: LocationContext
  contentPurpose: ContentPurpose
  platform: 'instagram' | 'facebook' | 'linkedin' | 'tiktok'
}

interface GeneratedCaption {
  caption: string
  firstLine: string // First 125 chars for truncation preview
  characterCount: number
  emojiCount: number
  structure: {
    hook: string
    coreMessage: string
    contextEnrichment: string
    cta: string
    emojis: string[]
  }
}

// ============================================================================
// PLATFORM CHARACTER LIMITS
// ============================================================================

const PLATFORM_LIMITS = {
  instagram: { max: 2200, optimal: 150 },
  facebook: { max: 63206, optimal: 400 },
  linkedin: { max: 3000, optimal: 250 },
  tiktok: { max: 2200, optimal: 150 },
} as const

const FIRST_LINE_LIMIT = 125 // Instagram feed truncation

// ============================================================================
// EMOJI FREQUENCY MAPPING
// ============================================================================

const EMOJI_FREQUENCIES = {
  none: { min: 0, max: 0 },
  minimal: { min: 1, max: 2 },
  moderate: { min: 2, max: 3 },
  frequent: { min: 3, max: 5 },
} as const

// ============================================================================
// CONTEXT WEAVING PATTERNS
// ============================================================================

const CONTEXT_PATTERNS = {
  // Location + Season + Weather combinations
  waterfront_spring_sunny: "Perfect weather for waterfront dining",
  waterfront_summer_sunny: "Golden hour dining by the water",
  waterfront_fall_crisp: "Crisp fall air meets harbor views",
  waterfront_winter_clear: "Winter dining with stunning harbor views",
  
  city_center_lunch_weekday: "Quick business lunch done right",
  city_center_dinner_weekday: "City dining in the heart of Copenhagen",
  
  historic_fall_cozy: "Historic charm meets autumn comfort",
  historic_winter_cold: "Warm up in our historic setting",
  
  cozy_rainy_any: "Rainy days call for hygge",
  cozy_winter_cold: "Winter warmth in every corner",
  
  // Time-based patterns
  morning_prep: "Early morning prep at",
  lunch_special: "Lunch special ready",
  afternoon_light: "Afternoon light hitting just right",
  evening_ambiance: "Evening ambiance like no other",
} as const

// ============================================================================
// HOOK GENERATORS
// ============================================================================

function generateHook(
  brandVoice: BrandVoice,
  contentType: string,
  subject: string
): string {
  const hooks = {
    casual: {
      menu_highlight: [
        `${subject} hitting different today`,
        `You need to try this ${subject.toLowerCase()}`,
        `Is it just us or does ${subject.toLowerCase()} look amazing?`,
      ],
      behind_scenes: [
        `Behind every dish there's a story`,
        `Want to see how we make ${subject.toLowerCase()}?`,
        `Early morning kitchen vibes`,
      ],
      engagement: [
        `Quick question for you`,
        `We need to know`,
        `Tell us your favorite`,
      ],
    },
    refined: {
      menu_highlight: [
        `${subject}, elevated.`,
        `Introducing: ${subject}`,
        `Crafted with precision and care.`,
      ],
      behind_scenes: [
        `The art of ${subject.toLowerCase()}.`,
        `Craftsmanship in every detail.`,
        `Excellence takes time.`,
      ],
      engagement: [
        `We're curious.`,
        `Your perspective matters.`,
        `A question of taste.`,
      ],
    },
    playful: {
      menu_highlight: [
        `Warning: ${subject.toLowerCase()} levels dangerously high`,
        `This ${subject.toLowerCase()} situation is getting out of hand`,
        `Prepare yourself for ${subject.toLowerCase()} excellence`,
      ],
      behind_scenes: [
        `Plot twist: our chef is obsessed`,
        `Secret ingredient: lots of love (and skill)`,
        `Kitchen magic in progress`,
      ],
      engagement: [
        `Hot take incoming`,
        `Unpopular opinion time`,
        `Let's settle this once and for all`,
      ],
    },
    professional: {
      menu_highlight: [
        `Now featuring: ${subject}`,
        `Available this week: ${subject}`,
        `${subject} - sustainably sourced, expertly prepared`,
      ],
      behind_scenes: [
        `Our process, explained.`,
        `Quality starts with preparation.`,
        `Behind the scenes at [Restaurant]`,
      ],
      engagement: [
        `We value your feedback.`,
        `Join the conversation.`,
        `What matters most to you?`,
      ],
    },
  }

  const voiceHooks = hooks[brandVoice.tone]?.[contentType as keyof typeof hooks.casual] || hooks.casual.menu_highlight
  return voiceHooks[Math.floor(Math.random() * voiceHooks.length)]
}

// ============================================================================
// CORE MESSAGE GENERATOR
// ============================================================================

function generateCoreMessage(
  brandVoice: BrandVoice,
  subject: string,
  contentType: string
): string {
  if (contentType === 'menu_highlight') {
    if (brandVoice.tone === 'refined') {
      return `${subject}, prepared with locally sourced ingredients and traditional techniques.`
    } else if (brandVoice.tone === 'playful') {
      return `Our chef's been perfecting this ${subject.toLowerCase()} all week. It shows.`
    } else if (brandVoice.tone === 'professional') {
      return `${subject} - crafted using sustainable ingredients from Danish suppliers.`
    } else {
      return `${subject} made fresh this morning with ingredients from local farms.`
    }
  } else if (contentType === 'behind_scenes') {
    if (brandVoice.tone === 'refined') {
      return `Every dish represents hours of preparation and decades of expertise.`
    } else {
      return `Here's what goes into making ${subject.toLowerCase()} special.`
    }
  } else if (contentType === 'engagement') {
    return `We want to hear from you.`
  }
  
  return `${subject} is ready.`
}

// ============================================================================
// CONTEXT ENRICHMENT
// ============================================================================

function weaveContext(
  seasonal: SeasonalContext,
  location: LocationContext,
  postTime?: string
): string {
  const { season, weather } = seasonal
  const { type: locationType } = location
  
  // Try specific pattern match
  if (locationType === 'waterfront' && season === 'spring' && weather === 'sunny') {
    return CONTEXT_PATTERNS.waterfront_spring_sunny
  }
  if (locationType === 'waterfront' && season === 'summer') {
    return CONTEXT_PATTERNS.waterfront_summer_sunny
  }
  if (locationType === 'city_center' && postTime === 'lunch') {
    return CONTEXT_PATTERNS.city_center_lunch_weekday
  }
  if (weather === 'rainy') {
    return CONTEXT_PATTERNS.cozy_rainy_any
  }
  if (season === 'winter' && weather === 'cold') {
    return CONTEXT_PATTERNS.cozy_winter_cold
  }
  
  // Fallback patterns
  if (season === 'spring') {
    return "Spring flavors at their finest"
  }
  if (season === 'summer') {
    return "Summer dining done right"
  }
  if (season === 'fall') {
    return "Autumn comfort in every bite"
  }
  if (season === 'winter') {
    return "Winter warmth awaits"
  }
  
  return "Come experience it yourself"
}

// ============================================================================
// CTA GENERATOR
// ============================================================================

function generateCTA(
  brandVoice: BrandVoice,
  contentType: string
): string {
  const ctas = {
    casual: {
      menu_highlight: ["Stop by this week!", "Reserve your table 👆", "Come hungry!"],
      behind_scenes: ["Want to see more? Follow along!", "Drop a 👨‍🍳 if you love it"],
      engagement: ["Drop your answer below!", "Tag a friend who needs this!"],
      event_promotion: ["Book your spot now!", "See you there?"],
    },
    refined: {
      menu_highlight: ["Reserve your experience today.", "Book your table."],
      behind_scenes: ["Discover more stories from our kitchen."],
      engagement: ["We'd love to hear your thoughts."],
      event_promotion: ["Reserve your seat for this exclusive experience."],
    },
    playful: {
      menu_highlight: ["Don't say we didn't warn you 😉", "Your taste buds will thank us!"],
      behind_scenes: ["Chef's orders: hit follow for daily kitchen shenanigans"],
      engagement: ["Wrong answers only 👇", "Fight us in the comments"],
      event_promotion: ["Grab your spot before it's gone!"],
    },
    professional: {
      menu_highlight: ["Book your reservation today."],
      behind_scenes: ["Learn more about our preparation process."],
      engagement: ["Share your feedback with us."],
      event_promotion: ["Register for this exclusive event."],
    },
  }
  
  const voiceCTAs = ctas[brandVoice.tone]?.[contentType as keyof typeof ctas.casual] || ctas.casual.menu_highlight
  return voiceCTAs[Math.floor(Math.random() * voiceCTAs.length)]
}

// ============================================================================
// EMOJI SELECTOR
// ============================================================================

const CONTENT_EMOJIS = {
  menu_highlight: ['🍽️', '🌿', '✨', '😋', '👨‍🍳'],
  behind_scenes: ['👨‍🍳', '🔥', '💪', '⚡', '🎬'],
  engagement: ['👇', '💭', '🤔', '💬', '❤️'],
  event_promotion: ['🎉', '📅', '🎊', '✨', '🍾'],
  location_story: ['📍', '🌅', '🏛️', '🌊', '🌆'],
  atmosphere: ['✨', '🕯️', '🌙', '💫', '🌟'],
  seasonal_spring: ['🌸', '🌿', '🌱', '☀️', '🌼'],
  seasonal_summer: ['☀️', '🌊', '🍉', '🌴', '😎'],
  seasonal_fall: ['🍂', '🎃', '🍁', '🌰', '☕'],
  seasonal_winter: ['❄️', '☃️', '🔥', '🧣', '⛄'],
} as const

function selectEmojis(
  frequency: BrandVoice['emoji_frequency'],
  contentType: string,
  season: string
): string[] {
  const { min, max } = EMOJI_FREQUENCIES[frequency]
  const count = Math.floor(Math.random() * (max - min + 1)) + min
  
  if (count === 0) return []
  
  const contentEmojis = CONTENT_EMOJIS[contentType as keyof typeof CONTENT_EMOJIS] || CONTENT_EMOJIS.menu_highlight
  const seasonalEmojis = CONTENT_EMOJIS[`seasonal_${season}` as keyof typeof CONTENT_EMOJIS] || []
  
  const allEmojis = [...contentEmojis, ...seasonalEmojis]
  const selected: string[] = []
  
  for (let i = 0; i < count; i++) {
    const emoji = allEmojis[Math.floor(Math.random() * allEmojis.length)]
    if (!selected.includes(emoji)) {
      selected.push(emoji)
    }
  }
  
  return selected
}

// ============================================================================
// MAIN CAPTION GENERATOR
// ============================================================================

export async function generateCaption(
  input: CaptionInput
): Promise<GeneratedCaption> {
  const { brandVoice, seasonalContext, locationContext, contentPurpose, platform } = input
  
  // 1. Generate hook (attention grabber)
  const hook = generateHook(brandVoice, contentPurpose.type, contentPurpose.subject)
  
  // 2. Build core message
  const coreMessage = generateCoreMessage(brandVoice, contentPurpose.subject, contentPurpose.type)
  
  // 3. Weave context (season/weather/location)
  const contextEnrichment = weaveContext(seasonalContext, locationContext, contentPurpose.postTime)
  
  // 4. Generate CTA
  const cta = generateCTA(brandVoice, contentPurpose.type)
  
  // 5. Select emojis
  const emojis = selectEmojis(brandVoice.emoji_frequency, contentPurpose.type, seasonalContext.season)
  
  // 6. Assemble caption
  let caption = `${hook} ${coreMessage} ${contextEnrichment}. ${cta}`
  
  // Add emojis based on voice
  if (emojis.length > 0) {
    if (brandVoice.tone === 'playful' || brandVoice.tone === 'casual') {
      // Sprinkle emojis throughout
      caption = caption.replace(/(\.|\!|\?)/g, (match, punct, offset) => {
        if (offset < caption.length * 0.3 && emojis[0]) {
          return `${punct} ${emojis.shift()}`
        }
        return punct
      })
      // Add remaining emojis at end
      if (emojis.length > 0) {
        caption += ` ${emojis.join(' ')}`
      }
    } else {
      // Refined/professional: emojis at end only
      caption += ` ${emojis.join(' ')}`
    }
  }
  
  // 7. Validate platform character limit
  const limit = PLATFORM_LIMITS[platform]
  if (caption.length > limit.max) {
    caption = caption.substring(0, limit.max - 3) + '...'
  }
  
  // 8. Extract first line (for truncation preview)
  const firstLine = caption.substring(0, FIRST_LINE_LIMIT)
  
  return {
    caption,
    firstLine: firstLine + (caption.length > FIRST_LINE_LIMIT ? '...' : ''),
    characterCount: caption.length,
    emojiCount: emojis.length,
    structure: {
      hook,
      coreMessage,
      contextEnrichment,
      cta,
      emojis,
    },
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateCaption(caption: GeneratedCaption, platform: string): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []
  const limit = PLATFORM_LIMITS[platform as keyof typeof PLATFORM_LIMITS]
  
  if (!limit) {
    issues.push(`Unknown platform: ${platform}`)
  }
  
  if (caption.characterCount > limit.max) {
    issues.push(`Caption exceeds ${platform} limit (${caption.characterCount}/${limit.max})`)
  }
  
  if (caption.firstLine.length < 50) {
    issues.push('Hook may be too short (first line < 50 chars)')
  }
  
  if (caption.structure.hook.length === 0) {
    issues.push('Missing hook')
  }
  
  if (caption.structure.cta.length === 0) {
    issues.push('Missing CTA')
  }
  
  return {
    valid: issues.length === 0,
    issues,
  }
}

// Export for testing
export const testHelpers = {
  generateHook,
  generateCoreMessage,
  weaveContext,
  generateCTA,
  selectEmojis,
  PLATFORM_LIMITS,
  EMOJI_FREQUENCIES,
  CONTEXT_PATTERNS,
}
