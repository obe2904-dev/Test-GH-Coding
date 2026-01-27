// Response formatter - converts platform-neutral PostIdeas into platform-specific PlatformPosts
import { PostIdea, PlatformPost, BusinessProfile } from '../types.ts'
import { getLocaleConfig } from '../policies/locale-config.ts'
import { 
  getPlatformRules, 
  getPlatformCTATemplates,
  getRecommendedHashtagCount,
  Platform 
} from '../policies/platform-rules.ts'

/**
 * Format ideas for all platforms
 */
export function formatIdeasForPlatforms(
  ideas: PostIdea[],
  businessProfile: BusinessProfile
): { facebook: PlatformPost[], instagram: PlatformPost[] } {
  const locale = getLocaleConfig(
    businessProfile.primary_language,
    businessProfile.country
  )
  
  return {
    facebook: ideas.map(idea => formatForFacebook(idea, businessProfile, locale)),
    instagram: ideas.map(idea => formatForInstagram(idea, businessProfile, locale))
  }
}

/**
 * Format idea for Facebook
 */
export function formatForFacebook(
  idea: PostIdea,
  businessProfile: BusinessProfile,
  locale: ReturnType<typeof getLocaleConfig>
): PlatformPost {
  const rules = getPlatformRules('facebook')
  const ctaTemplates = getPlatformCTATemplates('facebook', locale)
  
  // Build clean text: ONLY hook + caption_base (NO CTA, NO URL)
  const parts: string[] = []
  
  // Hook (with spacing)
  if (idea.hook) {
    parts.push(idea.hook)
    parts.push('') // Empty line
  }
  
  // Caption base
  parts.push(idea.caption_base)
  
  const text = parts.join('\n')
  
  // Build CTA object (separate from text)
  const ctaText = selectCTAText(idea.cta_intent, businessProfile, ctaTemplates, locale, 'facebook')
  const ctaType = determineCTAType(idea.cta_intent, businessProfile)
  const ctaUrl = shouldIncludeURL(idea.cta_intent, businessProfile, 'facebook') 
    ? businessProfile.booking_url 
    : undefined
  
  // Generate hashtags (minimal for Facebook: 3-5)
  const hashtags = generateHashtags(idea, businessProfile, 'facebook', locale)
  
  return {
    platform: 'facebook',
    text,
    cta: {
      text: ctaText,
      type: ctaType,
      url: ctaUrl
    },
    hashtags
  }
}

/**
 * Format idea for Instagram
 */
export function formatForInstagram(
  idea: PostIdea,
  businessProfile: BusinessProfile,
  locale: ReturnType<typeof getLocaleConfig>
): PlatformPost {
  const rules = getPlatformRules('instagram')
  const ctaTemplates = getPlatformCTATemplates('instagram', locale)
  
  // Build clean text: ONLY hook + caption_base (NO CTA, NO "Link in bio")
  const parts: string[] = []
  
  // Hook (with spacing)
  if (idea.hook) {
    parts.push(idea.hook)
    parts.push('') // Empty line
  }
  
  // Caption base
  parts.push(idea.caption_base)
  
  const text = parts.join('\n')
  
  // Build CTA object (separate from text)
  const ctaText = selectCTAText(idea.cta_intent, businessProfile, ctaTemplates, locale, 'instagram')
  const ctaType = determineCTAType(idea.cta_intent, businessProfile)
  
  // Instagram never has clickable URLs (always undefined)
  const ctaUrl = undefined
  
  // Generate hashtags (aggressive for Instagram: 10-15)
  const hashtags = generateHashtags(idea, businessProfile, 'instagram', locale)
  
  return {
    platform: 'instagram',
    text,
    cta: {
      text: ctaText,
      type: ctaType,
      url: ctaUrl
    },
    hashtags
  }
}

/**
 * Select appropriate CTA text with business config priority
 * 
 * Priority order:
 * 1. Business custom CTA (businessProfile.cta_config.custom_ctas[intent])
 * 2. Business default style (soft vs booking)
 * 3. Locale-aware templates from platform-rules.ts
 */
function selectCTAText(
  intent: PostIdea['cta_intent'],
  businessProfile: BusinessProfile,
  templates: ReturnType<typeof getPlatformCTATemplates>,
  locale: ReturnType<typeof getLocaleConfig>,
  platform: Platform
): string {
  // Priority 1: Check for custom CTA from business config
  if (businessProfile.cta_config?.custom_ctas) {
    const customCTA = businessProfile.cta_config.custom_ctas[intent]
    if (customCTA) {
      // Add emoji if configured
      if (businessProfile.cta_config.use_emojis && !customCTA.includes('📅') && !customCTA.includes('🚶')) {
        const emoji = getIntentEmoji(intent)
        return emoji ? `${emoji} ${customCTA}` : customCTA
      }
      return customCTA
    }
  }
  
  // Priority 2: Check default style preference
  const defaultStyle = businessProfile.cta_config?.default_style
  if (defaultStyle) {
    // If default_style is 'soft', prefer softer CTAs
    // If default_style is 'booking', prefer direct booking CTAs
    const options = templates[intent]
    if (options && options.length > 0) {
      if (defaultStyle === 'soft' && intent === 'book') {
        // For booking intent with soft style, use visit CTA instead
        const visitOptions = templates['visit']
        return visitOptions?.[0] || options[0]
      }
      return options[0]
    }
  }
  
  // Priority 3: Fall back to platform/locale templates
  const options = templates[intent]
  if (!options || options.length === 0) {
    // Final fallback: generic CTA based on intent
    return getFallbackCTA(intent, locale)
  }
  
  return options[0]
}

/**
 * Determine CTA type based on intent and business config
 */
function determineCTAType(
  intent: PostIdea['cta_intent'],
  businessProfile: BusinessProfile
): 'soft' | 'booking' | 'menu' | 'custom' {
  // Check if business has custom CTA for this intent
  if (businessProfile.cta_config?.custom_ctas?.[intent]) {
    return 'custom'
  }
  
  // Check default style preference
  const defaultStyle = businessProfile.cta_config?.default_style
  if (defaultStyle && intent === 'book') {
    return defaultStyle === 'soft' ? 'soft' : 'booking'
  }
  
  // Map intent to CTA type
  if (intent === 'book') return 'booking'
  if (intent === 'menu') return 'menu'
  return 'soft'
}

/**
 * Determine if URL should be included (Facebook only, for booking/visit intents)
 */
function shouldIncludeURL(
  intent: PostIdea['cta_intent'],
  businessProfile: BusinessProfile,
  platform: Platform
): boolean {
  // Instagram never has URLs
  if (platform === 'instagram') return false
  
  // Facebook only includes URL for booking/visit intents when booking_url exists
  if (platform === 'facebook' && businessProfile.booking_url) {
    return ['book', 'visit'].includes(intent)
  }
  
  return false
}

/**
 * Get emoji for CTA intent
 */
function getIntentEmoji(intent: PostIdea['cta_intent']): string {
  const emojiMap: Record<PostIdea['cta_intent'], string> = {
    book: '📅',
    visit: '🚶',
    menu: '📋',
    engage: '💬'
  }
  return emojiMap[intent] || ''
}

/**
 * Fallback CTA when templates are unavailable
 */
function getFallbackCTA(
  intent: PostIdea['cta_intent'],
  locale: ReturnType<typeof getLocaleConfig>
): string {
  const language = locale.language.toLowerCase()
  
  if (language === 'danish' || language === 'da') {
    const fallbacks: Record<PostIdea['cta_intent'], string> = {
      book: '📅 Book bord',
      visit: '🚶 Kom forbi',
      menu: '📋 Se menuen',
      engage: '💬 Fortæl os'
    }
    return fallbacks[intent] || '🚶 Kom forbi'
  }
  
  if (language === 'swedish' || language === 'sv') {
    const fallbacks: Record<PostIdea['cta_intent'], string> = {
      book: '📅 Boka bord',
      visit: '🚶 Kom förbi',
      menu: '📋 Se menyn',
      engage: '💬 Berätta för oss'
    }
    return fallbacks[intent] || '🚶 Kom förbi'
  }
  
  // English fallback
  const fallbacks: Record<PostIdea['cta_intent'], string> = {
    book: '📅 Book a table',
    visit: '🚶 Visit us',
    menu: '📋 View menu',
    engage: '💬 Tell us'
  }
  return fallbacks[intent] || '🚶 Visit us'
}

/**
 * Generate platform-appropriate hashtags
 */
function generateHashtags(
  idea: PostIdea,
  businessProfile: BusinessProfile,
  platform: Platform,
  locale: ReturnType<typeof getLocaleConfig>
): string[] {
  const hashtags: string[] = []
  const recommended = getRecommendedHashtagCount(platform)
  const targetCount = platform === 'facebook' ? 4 : 12
  
  // 1. Business name hashtag
  if (businessProfile.business_name) {
    const nameTag = businessProfile.business_name
      .replace(/[^a-zA-ZæøåÆØÅäöÄÖ0-9]/g, '')
    if (nameTag) {
      hashtags.push(`#${nameTag}`)
    }
  }
  
  // 2. Location hashtags
  if (businessProfile.city) {
    const cityTag = businessProfile.city.replace(/[^a-zA-ZæøåÆØÅäöÄÖ0-9]/g, '')
    if (cityTag) {
      hashtags.push(`#${cityTag}`)
    }
  }
  
  // 3. Business category hashtags (from offerings if available)
  if (businessProfile.business_offerings) {
    // Extract first word from offerings as category tag (e.g., "Café" from "Café & Restaurant")
    const categoryMatch = businessProfile.business_offerings.match(/^[a-zA-ZæøåÆØÅäöÄÖ]+/)
    if (categoryMatch) {
      hashtags.push(`#${categoryMatch[0]}`)
    }
  }
  
  // 4. Menu item hashtag (if menu-based idea)
  if (idea.menu_item) {
    const itemTag = idea.menu_item.name
      .replace(/[^a-zA-ZæøåÆØÅäöÄÖ0-9]/g, '')
    if (itemTag) {
      hashtags.push(`#${itemTag}`)
    }
  }
  
  // 5. Common food/restaurant hashtags based on locale
  const commonTags = getCommonHashtags(locale, platform, idea.idea_type)
  hashtags.push(...commonTags)
  
  // Deduplicate and limit to target count
  const uniqueTags = [...new Set(hashtags)]
  return uniqueTags.slice(0, targetCount)
}

/**
 * Get common hashtags based on locale and platform
 */
function getCommonHashtags(
  locale: ReturnType<typeof getLocaleConfig>,
  platform: Platform,
  ideaType: PostIdea['idea_type']
): string[] {
  const language = locale.language.toLowerCase()
  
  // Danish hashtags
  if (language === 'danish' || language === 'da') {
    const base = [
      '#madoplevelser',
      '#restaurantliv',
      '#danisheats',
      '#foodiedk',
      '#instafooddk'
    ]
    
    if (ideaType === 'menu') {
      base.push('#menuinspiration', '#smagsoplevelse')
    }
    
    if (ideaType === 'vibe') {
      base.push('#hygge', '#stemning', '#cafelife')
    }
    
    return platform === 'facebook' ? base.slice(0, 3) : base
  }
  
  // Swedish hashtags
  if (language === 'swedish' || language === 'sv') {
    const base = [
      '#matupplevelser',
      '#restaurangliv',
      '#swedisheats',
      '#foodiesverige',
      '#matinspiration'
    ]
    
    if (ideaType === 'vibe') {
      base.push('#fika', '#mysigt')
    }
    
    return platform === 'facebook' ? base.slice(0, 3) : base
  }
  
  // Default English hashtags
  const base = [
    '#foodie',
    '#restaurant',
    '#foodporn',
    '#instafood',
    '#foodstagram'
  ]
  
  if (ideaType === 'menu') {
    base.push('#menuinspiration', '#chefsspecial')
  }
  
  if (ideaType === 'vibe') {
    base.push('#atmosphere', '#diningexperience')
  }
  
  return platform === 'facebook' ? base.slice(0, 3) : base
}

/**
 * Add hashtags to text (for platforms that need inline hashtags)
 */
export function addHashtagsToText(text: string, hashtags: string[]): string {
  if (hashtags.length === 0) return text
  
  const hashtagLine = hashtags.join(' ')
  return `${text}\n\n${hashtagLine}`
}
