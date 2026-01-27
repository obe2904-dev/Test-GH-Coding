/**
 * Locale Configuration
 * Defines country/language-specific rules for natural, local-feeling content
 */

export type SupportedLocale = 'da-DK' | 'sv-SE' | 'de-DE' | 'en-US' | 'en-GB'

export interface LocaleConfig {
  language: string
  country: string
  
  // Time preferences
  timeFormat: '12h' | '24h'
  mealTimes: {
    breakfast: { start: string; end: string }
    lunch: { start: string; end: string }
    dinner: { start: string; end: string }
    lateNight: { start: string; end: string }
  }
  
  // Cultural norms
  culturalNorms: {
    formalityLevel: 'informal' | 'mixed' | 'formal'
    emojiUsage: 'minimal' | 'moderate' | 'frequent'
    exclamationLimit: number
    useImperativeCTA: boolean // "Kom forbi!" vs "Visit us"
    emphasizeHygge: boolean // Nordic warmth/coziness
  }
  
  // Language specifics
  languageRules: {
    allowEnglishLoanWords: boolean
    preferLocalTerms: string[] // ["frokost" not "lunch", "hygge" not "cozy"]
    avoidAmericanisms: string[] // ["awesome", "amazing", "perfect"]
  }
  
  // Meal terminology
  mealTerms: {
    breakfast: string[]
    lunch: string[]
    dinner: string[]
    lateNight: string[]
  }
}

export const LOCALE_CONFIGS: Record<SupportedLocale, LocaleConfig> = {
  'da-DK': {
    language: 'da',
    country: 'DK',
    timeFormat: '24h',
    mealTimes: {
      breakfast: { start: '07:00', end: '11:00' },
      lunch: { start: '11:00', end: '15:00' },
      dinner: { start: '17:00', end: '22:00' },
      lateNight: { start: '22:00', end: '02:00' }
    },
    culturalNorms: {
      formalityLevel: 'informal',
      emojiUsage: 'minimal',
      exclamationLimit: 1,
      useImperativeCTA: true,
      emphasizeHygge: true
    },
    languageRules: {
      allowEnglishLoanWords: true, // Natural borrowings OK (brunch, toast)
      preferLocalTerms: ['frokost', 'middag', 'hygge', 'ved åen'],
      avoidAmericanisms: ['awesome', 'amazing', 'perfect', 'best ever', 'grab']
    },
    mealTerms: {
      breakfast: ['morgenmad', 'brunch'],
      lunch: ['frokost', 'middag'],
      dinner: ['aftensmad', 'middag', 'aften'],
      lateNight: ['cocktail', 'drink', 'bar']
    }
  },
  
  'sv-SE': {
    language: 'sv',
    country: 'SE',
    timeFormat: '24h',
    mealTimes: {
      breakfast: { start: '07:00', end: '11:00' },
      lunch: { start: '11:00', end: '14:00' }, // Earlier than DK
      dinner: { start: '17:00', end: '21:00' },
      lateNight: { start: '21:00', end: '01:00' }
    },
    culturalNorms: {
      formalityLevel: 'mixed',
      emojiUsage: 'minimal',
      exclamationLimit: 1,
      useImperativeCTA: false, // More reserved than Danish
      emphasizeHygge: false // Use "lagom" instead
    },
    languageRules: {
      allowEnglishLoanWords: true,
      preferLocalTerms: ['fika', 'lagom', 'mysig'],
      avoidAmericanisms: ['awesome', 'amazing', 'super', 'grab']
    },
    mealTerms: {
      breakfast: ['frukost'],
      lunch: ['lunch'],
      dinner: ['middag', 'kvällsmat'],
      lateNight: ['cocktail', 'bar']
    }
  },
  
  'de-DE': {
    language: 'de',
    country: 'DE',
    timeFormat: '24h',
    mealTimes: {
      breakfast: { start: '07:00', end: '11:00' },
      lunch: { start: '12:00', end: '14:00' },
      dinner: { start: '18:00', end: '22:00' },
      lateNight: { start: '22:00', end: '02:00' }
    },
    culturalNorms: {
      formalityLevel: 'formal',
      emojiUsage: 'minimal',
      exclamationLimit: 1,
      useImperativeCTA: true,
      emphasizeHygge: false // Use "Gemütlichkeit"
    },
    languageRules: {
      allowEnglishLoanWords: false, // Stricter than Nordic
      preferLocalTerms: ['Gemütlichkeit', 'lecker', 'frisch'],
      avoidAmericanisms: ['cool', 'awesome', 'amazing', 'yummy']
    },
    mealTerms: {
      breakfast: ['Frühstück'],
      lunch: ['Mittagessen'],
      dinner: ['Abendessen'],
      lateNight: ['Cocktail', 'Bar']
    }
  },
  
  'en-US': {
    language: 'en',
    country: 'US',
    timeFormat: '12h',
    mealTimes: {
      breakfast: { start: '07:00', end: '11:00' },
      lunch: { start: '11:00', end: '14:00' },
      dinner: { start: '17:00', end: '21:00' },
      lateNight: { start: '21:00', end: '02:00' }
    },
    culturalNorms: {
      formalityLevel: 'informal',
      emojiUsage: 'frequent',
      exclamationLimit: 3,
      useImperativeCTA: true,
      emphasizeHygge: false
    },
    languageRules: {
      allowEnglishLoanWords: true,
      preferLocalTerms: [],
      avoidAmericanisms: [] // Native market
    },
    mealTerms: {
      breakfast: ['breakfast', 'brunch'],
      lunch: ['lunch'],
      dinner: ['dinner', 'supper'],
      lateNight: ['late night', 'cocktails']
    }
  },
  
  'en-GB': {
    language: 'en',
    country: 'GB',
    timeFormat: '24h',
    mealTimes: {
      breakfast: { start: '07:00', end: '11:00' },
      lunch: { start: '12:00', end: '14:00' },
      dinner: { start: '18:00', end: '21:00' },
      lateNight: { start: '21:00', end: '01:00' }
    },
    culturalNorms: {
      formalityLevel: 'mixed',
      emojiUsage: 'moderate',
      exclamationLimit: 2,
      useImperativeCTA: false, // More reserved
      emphasizeHygge: false
    },
    languageRules: {
      allowEnglishLoanWords: true,
      preferLocalTerms: ['brilliant', 'lovely', 'proper'],
      avoidAmericanisms: ['awesome', 'gotten', 'sidewalk', 'cookies'] // Use British terms
    },
    mealTerms: {
      breakfast: ['breakfast', 'brekkie'],
      lunch: ['lunch', 'dinner'], // Regional: dinner = lunch in some areas
      dinner: ['dinner', 'tea', 'supper'],
      lateNight: ['late night', 'drinks']
    }
  }
}

export function getLocaleConfig(language: string, country?: string): LocaleConfig {
  // Try exact match first
  const localeKey = `${language}-${country}` as SupportedLocale
  if (LOCALE_CONFIGS[localeKey]) {
    return LOCALE_CONFIGS[localeKey]
  }
  
  // Fallback to language-only match
  const fallback = Object.values(LOCALE_CONFIGS).find(config => config.language === language)
  if (fallback) return fallback
  
  // Default to Danish (your primary market)
  return LOCALE_CONFIGS['da-DK']
}
