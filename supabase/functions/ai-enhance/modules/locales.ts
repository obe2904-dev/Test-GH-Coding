import { sanitizeForHashtagValue } from '../tone-cards.ts'

interface LocaleConfigDefinition {
  key: string
  languageCode: string
  countryMatchers: string[]
  languageLabel: string
  stopWords: string[]
  countryLocalization?: {
    translations: Record<string, string>
    includeOriginal?: boolean
  }
}

export interface LocaleConfig extends Omit<LocaleConfigDefinition, 'stopWords'> {
  stopWords: Set<string>
}

const LOCALE_DEFINITIONS: LocaleConfigDefinition[] = [
  {
    key: 'da-DK',
    languageCode: 'da',
    countryMatchers: ['dk', 'denmark', 'danmark'],
    languageLabel: 'dansk',
    stopWords: [
      'og', 'for', 'med', 'det', 'der', 'den', 'til', 'en', 'et', 'er', 'på', 'vi', 'jeg',
      'du', 'har', 'som', 'af', 'fra', 'kan', 'dig', 'jer', 'vores', 'hos', 'om', 'man', 'deres',
      'gør', 'goer', 'klar', 'nyd', 'dagen', 'bedre', 'kom', 'forbi', 'lille', 'perfekt',
      'forkæl', 'forkael', 'forkælelse', 'forkaelelse', 'saftig', 'saftige', 'saftigt',
      'dag', 'oplevelse', 'oplev'
    ],
    countryLocalization: {
      translations: {
        denmark: 'Danmark'
      },
      includeOriginal: false
    }
  },
  {
    key: 'sv-SE',
    languageCode: 'sv',
    countryMatchers: ['se', 'sweden', 'sverige'],
    languageLabel: 'svenska',
    stopWords: [
      'och', 'för', 'med', 'det', 'den', 'som', 'att', 'är', 'på', 'vi', 'har', 'er', 'ni', 'oss',
      'dag', 'liten', 'perfekt', 'upplev', 'njut', 'smaka', 'idag'
    ],
    countryLocalization: {
      translations: {
        sweden: 'Sverige'
      },
      includeOriginal: false
    }
  },
  {
    key: 'en-default',
    languageCode: 'en',
    countryMatchers: ['*'],
    languageLabel: 'english',
    stopWords: [
      'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'our', 'you', 'have', 'make',
      'enjoy', 'day', 'experience', 'visit', 'little', 'perfect', 'today', 'great', 'local'
    ],
    countryLocalization: {
      translations: {},
      includeOriginal: true
    }
  }
]

const LOCALE_CONFIGS: LocaleConfig[] = LOCALE_DEFINITIONS.map((definition) => ({
  ...definition,
  stopWords: new Set(definition.stopWords.map((word) => word.toLowerCase()))
}))

const DEFAULT_LOCALE_CONFIG = LOCALE_CONFIGS.find((config) => config.key === 'en-default') ?? LOCALE_CONFIGS[0]

export function resolveLocaleConfig(params: { language?: string; country?: string | null }): LocaleConfig {
  const languageCode = (params.language || '').toLowerCase()
  const countryValueRaw = (params.country || '').toLowerCase().trim()
  const countryValue = sanitizeForHashtagValue(countryValueRaw) || countryValueRaw

  console.log('🌍 Locale resolution:', { 
    language: params.language, 
    languageCode, 
    country: params.country, 
    countryValueRaw, 
    countryValue 
  })

  const directMatch = LOCALE_CONFIGS.find((config) => {
    if (config.languageCode !== languageCode) {
      return false
    }
    if (config.countryMatchers.includes('*')) {
      return false
    }
    if (!countryValue) {
      return false
    }
    const matches = config.countryMatchers.some((matcher) => countryValue.includes(matcher))
    console.log(`  Checking ${config.key}: languageCode=${config.languageCode}, matches=${matches}`)
    return matches
  })

  if (directMatch) {
    return directMatch
  }

  const languageDefault = LOCALE_CONFIGS.find(
    (config) => config.languageCode === languageCode && config.countryMatchers.includes('*')
  )

  if (languageDefault) {
    return languageDefault
  }

  return DEFAULT_LOCALE_CONFIG
}
