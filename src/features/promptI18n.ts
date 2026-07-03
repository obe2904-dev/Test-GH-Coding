import daJson from '../lib/locales/promptI18n.da.json'
import enJson from '../lib/locales/promptI18n.en.json'

export type PromptLanguage = 'da' | 'en'

export function normalizePromptLanguage(language: string | undefined | null): PromptLanguage {
  return language === 'da' ? 'da' : 'en'
}

/**
 * For Danish prompts we want the prompt to be fully Danish.
 * For English prompts we keep the original English titles.
 */
export function withMarker(marker: string, localizedLabel: string, lang: PromptLanguage): string {
  return lang === 'da' ? localizedLabel : marker
}

export interface PromptI18n {
  meta: {
    promptLanguageLine: (lang: PromptLanguage) => string
  }
  language: {
    instruction: string
  }
  businessContext: {
    name: string
    type: string
    location: string
    description: string
    website: string
    keywords: string
    hasMenuPage: string
    targetAudience: string
    notSpecified: string
  }
  optionalContext: {
    sectionTitle: string
    menuContextTitle: string
    menuContextHint: string
  }
  platforms: {
    platformsLabel: string
    noHashtagsRule: string
  }
  operational: {
    noMenuItemsProvidedTitle: string
    noMenuItemsProvidedRules: string
  }
  schedulingImpact: {
    title: string
  }
  openingHours: {
    title: string
    rulesTitle: string
    mustReferenceAtLeastOne: string
  }
  booking: {
    title: string
    rulesTitle: string
    ctaMustInclude: string
    urlOnOwnLine: string
    formatExactly: string
  }
  task: {
    title: string
    aiIdeasIntro: string
    aiIdeasBullets: string
    eachIdeaMust: string
  }
  tier: {
    title: string
    free: string
    paid: string
  }
  output: {
    title: string
    schemaDaHints: {
      title: string
      headline: string
      text: string
      photoSuggestion: string
    }
  }
}

export function getPromptI18n(lang: PromptLanguage): PromptI18n {
  const src = lang === 'da' ? daJson : enJson
  return {
    ...(src as unknown as PromptI18n),
    meta: {
      promptLanguageLine: (l) => `PROMPT_SPROG: ${l}`
    },
  }
}
