// Platform-specific rules and constraints for social media platforms
// Deterministic enforcement of platform best practices

export type Platform = 'facebook' | 'instagram' | 'linkedin'

export interface PlatformRules {
  platform: Platform
  maxLength: number
  maxHashtags: number
  allowLinksInCaption: boolean
  hashtagStrategy: 'minimal' | 'moderate' | 'aggressive'
  ctaStyle: 'direct' | 'soft' | 'professional'
  emojiUsage: 'minimal' | 'moderate' | 'frequent'
  urlPlacement: 'inline' | 'bio_reference' | 'separate_field'
}

// Platform rules catalog
const PLATFORM_RULES_CATALOG: Record<Platform, PlatformRules> = {
  facebook: {
    platform: 'facebook',
    maxLength: 63206,  // Technical limit, but aim for 500-1000 for readability
    maxHashtags: 10,  // Less than Instagram, 3-5 recommended
    allowLinksInCaption: true,
    hashtagStrategy: 'minimal',  // Facebook users don't rely on hashtags
    ctaStyle: 'direct',  // "Book nu", "Læs mere"
    emojiUsage: 'moderate',
    urlPlacement: 'inline'  // Can include booking URL directly
  },
  
  instagram: {
    platform: 'instagram',
    maxLength: 2200,  // Technical limit
    maxHashtags: 30,  // Technical limit, 10-15 recommended
    allowLinksInCaption: false,  // Links not clickable (except in bio)
    hashtagStrategy: 'aggressive',  // Instagram relies heavily on hashtags
    ctaStyle: 'soft',  // "Link i bio", softer than Facebook
    emojiUsage: 'frequent',  // Instagram culture
    urlPlacement: 'bio_reference'  // "Link in bio" only
  },
  
  linkedin: {
    platform: 'linkedin',
    maxLength: 3000,  // Technical limit
    maxHashtags: 5,  // Professional context, fewer is better
    allowLinksInCaption: true,
    hashtagStrategy: 'minimal',  // 2-3 professional hashtags
    ctaStyle: 'professional',  // More formal tone
    emojiUsage: 'minimal',  // Professional context
    urlPlacement: 'inline'
  }
}

/**
 * Get platform-specific rules
 */
export function getPlatformRules(platform: Platform): PlatformRules {
  return PLATFORM_RULES_CATALOG[platform]
}

/**
 * Get recommended hashtag count based on strategy
 */
export function getRecommendedHashtagCount(platform: Platform): { min: number, max: number } {
  const rules = getPlatformRules(platform)
  
  switch (rules.hashtagStrategy) {
    case 'minimal':
      return { min: 2, max: 5 }
    case 'moderate':
      return { min: 5, max: 10 }
    case 'aggressive':
      return { min: 10, max: 20 }
  }
}

/**
 * Get platform-specific CTA templates based on locale
 */
export function getPlatformCTATemplates(
  platform: Platform,
  locale: { language: string, country: string }
): { book: string[], menu: string[], visit: string[], engage: string[] } {
  const rules = getPlatformRules(platform)
  const language = locale.language.toLowerCase()
  
  // Danish templates
  if (language === 'danish' || language === 'da' || language === 'dansk') {
    if (rules.ctaStyle === 'direct') {
      return {
        book: ['📅 Book bord nu', '🍽️ Reserver dit bord', '📞 Ring og book'],
        menu: ['📖 Se hele menuen', '🍴 Tjek vores menu', '👉 Fuld menu her'],
        visit: ['🚶 Kom forbi', '📍 Besøg os', '👋 Vi glæder os til at se dig'],
        engage: ['💬 Del med os', '❤️ Fortæl os hvad du synes', '✨ Tag os med']
      }
    } else if (rules.ctaStyle === 'soft') {
      return {
        book: ['Book via link i bio', 'Reserver i bio', 'Link til booking i bio'],
        menu: ['Se menuen i bio', 'Fuld menu i bio', 'Mere i bio'],
        visit: ['Kom forbi når det passer dig', 'Døren er åben', 'Vi ses snart'],
        engage: ['Hvad synes du?', 'Del dine tanker', 'Vi vil gerne høre fra dig']
      }
    } else {
      // Professional
      return {
        book: ['Kontakt os for reservation', 'Book via vores hjemmeside'],
        menu: ['Udforsk vores menu', 'Se vores tilbud'],
        visit: ['Besøg os på adressen', 'Velkommen til vores lokation'],
        engage: ['Del dine erfaringer', 'Giv os din feedback']
      }
    }
  }
  
  // Swedish templates
  if (language === 'swedish' || language === 'sv' || language === 'svenska') {
    if (rules.ctaStyle === 'direct') {
      return {
        book: ['📅 Boka nu', '🍽️ Reservera bord', '📞 Ring och boka'],
        menu: ['📖 Se hela menyn', '🍴 Kolla vår meny', '👉 Full meny här'],
        visit: ['🚶 Kom förbi', '📍 Besök oss', '👋 Vi ser fram emot ditt besök'],
        engage: ['💬 Dela med oss', '❤️ Berätta vad du tycker', '✨ Tagga oss']
      }
    } else {
      return {
        book: ['Boka via länk i bio', 'Bokning i bio'],
        menu: ['Se menyn i bio', 'Mer i bio'],
        visit: ['Välkommen när det passar', 'Vi ses snart'],
        engage: ['Vad tycker du?', 'Dela dina tankar']
      }
    }
  }
  
  // Default English
  if (rules.ctaStyle === 'direct') {
    return {
      book: ['📅 Book now', '🍽️ Reserve your table', '📞 Call to book'],
      menu: ['📖 See full menu', '🍴 Check our menu', '👉 Full menu here'],
      visit: ['🚶 Come visit', '📍 Visit us', '👋 We look forward to seeing you'],
      engage: ['💬 Share with us', '❤️ Tell us what you think', '✨ Tag us']
    }
  } else {
    return {
      book: ['Book via link in bio', 'Reservation link in bio'],
      menu: ['See menu in bio', 'More in bio'],
      visit: ['Come by when it suits you', 'See you soon'],
      engage: ['What do you think?', 'Share your thoughts']
    }
  }
}

/**
 * Validate text length for platform
 */
export function validateTextLength(text: string, platform: Platform): {
  valid: boolean
  length: number
  maxLength: number
  recommendation?: string
} {
  const rules = getPlatformRules(platform)
  const length = text.length
  
  if (length > rules.maxLength) {
    return {
      valid: false,
      length,
      maxLength: rules.maxLength,
      recommendation: `Text exceeds ${platform} limit of ${rules.maxLength} characters`
    }
  }
  
  // Readability recommendations
  if (platform === 'facebook' && length > 1000) {
    return {
      valid: true,
      length,
      maxLength: rules.maxLength,
      recommendation: 'Consider shortening for better engagement (500-1000 chars recommended)'
    }
  }
  
  if (platform === 'instagram' && length > 500) {
    return {
      valid: true,
      length,
      maxLength: rules.maxLength,
      recommendation: 'Instagram users prefer shorter captions (300-500 chars recommended)'
    }
  }
  
  return {
    valid: true,
    length,
    maxLength: rules.maxLength
  }
}

/**
 * Validate hashtag count for platform
 */
export function validateHashtagCount(hashtags: string[], platform: Platform): {
  valid: boolean
  count: number
  maxCount: number
  recommended: { min: number, max: number }
  recommendation?: string
} {
  const rules = getPlatformRules(platform)
  const count = hashtags.length
  const recommended = getRecommendedHashtagCount(platform)
  
  if (count > rules.maxHashtags) {
    return {
      valid: false,
      count,
      maxCount: rules.maxHashtags,
      recommended,
      recommendation: `Too many hashtags for ${platform} (max ${rules.maxHashtags})`
    }
  }
  
  if (count < recommended.min) {
    return {
      valid: true,
      count,
      maxCount: rules.maxHashtags,
      recommended,
      recommendation: `Consider adding more hashtags (${recommended.min}-${recommended.max} recommended)`
    }
  }
  
  if (count > recommended.max) {
    return {
      valid: true,
      count,
      maxCount: rules.maxHashtags,
      recommended,
      recommendation: `Consider using fewer hashtags for better engagement (${recommended.min}-${recommended.max} recommended)`
    }
  }
  
  return {
    valid: true,
    count,
    maxCount: rules.maxHashtags,
    recommended
  }
}

/**
 * Get platform-specific best practices
 */
export function getPlatformBestPractices(platform: Platform): string[] {
  const rules = getPlatformRules(platform)
  const practices: string[] = []
  
  if (platform === 'facebook') {
    practices.push('Keep text concise (500-1000 characters)')
    practices.push('Use 3-5 hashtags maximum')
    practices.push('Include direct booking link if applicable')
    practices.push('Front-load important information')
    practices.push('Ask questions to encourage engagement')
  }
  
  if (platform === 'instagram') {
    practices.push('Start with strong hook (first 125 characters visible)')
    practices.push('Use 10-15 relevant hashtags')
    practices.push('Include "Link in bio" for external links')
    practices.push('Use emojis to break up text')
    practices.push('Encourage tagging and sharing')
    practices.push('Post during peak hours (11am-1pm, 7pm-9pm)')
  }
  
  if (platform === 'linkedin') {
    practices.push('Professional tone and language')
    practices.push('Use 2-3 professional hashtags')
    practices.push('Include relevant industry keywords')
    practices.push('Avoid excessive emojis')
    practices.push('Focus on value proposition')
  }
  
  return practices
}
