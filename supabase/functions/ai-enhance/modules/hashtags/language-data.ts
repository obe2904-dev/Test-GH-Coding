import { sanitizeForHashtagValue } from '../../tone-cards.ts'

export interface HashtagLocaleResources {
  canonicalDisplayMap: Map<string, string>
  flavorModifierKeys: Set<string>
}

type LanguageCode = string

type LanguageCanonicalCorrections = Record<string, string>

type LanguageFlavorLists = Record<LanguageCode, string[]>

const GLOBAL_CANONICAL_CORRECTIONS: LanguageCanonicalCorrections = {}

const LANGUAGE_CANONICAL_CORRECTIONS: Record<LanguageCode, LanguageCanonicalCorrections> = {
  default: {},
  da: {
    aebleskiver: 'Æbleskiver',
    aebelskiver: 'Æbleskiver',
    aebelskiber: 'Æbleskiver',
    gloegg: 'Gløgg',
    gloeeg: 'Gløgg',
    smorrebrod: 'Smørrebrød',
    smorrebord: 'Smørrebrød',
    rugbroed: 'Rugbrød',
    flaeskesteg: 'Flæskesteg',
    risengroed: 'Risengrød',
    medisterpoelse: 'Medisterpølse',
    stroembede: 'Strømbede',
    roedkaal: 'Rødkål',
    roedspaette: 'Rødspætte',
    roedspaettefilet: 'Rødspættefilet',
    leverpostej: 'Leverpostej',
    frikadeller: 'Frikadeller',
    klejner: 'Klejner',
    brunekartofler: 'Brunede kartofler',
    brunekartoffler: 'Brunede kartofler',
    brunedekartofler: 'Brunede kartofler',
    juleand: 'Juleand'
  }
}

const GLOBAL_FLAVOR_KEYWORDS: string[] = [
  'kanel',
  'kardemomme',
  'anis',
  'stjerneanis',
  'nellike',
  'muskat',
  'ingefar',
  'ingefaer',
  'vanilje',
  'vanilla',
  'sirup',
  'sirups',
  'honning',
  'sukker',
  'spice',
  'spices',
  'krydderi',
  'krydderier'
]

const LANGUAGE_FLAVOR_KEYWORDS: LanguageFlavorLists = {
  default: [],
  da: [],
  sv: [],
  en: ['cinnamon', 'cardamom', 'clove', 'nutmeg', 'ginger']
}

export function buildHashtagLocaleResources(languageCode: string): HashtagLocaleResources {
  const canonicalDisplayMap = new Map<string, string>()
  const flavorModifierKeys = new Set<string>()

  const registerCanonical = (term: string, display: string) => {
    const key = sanitizeForHashtagValue(term)
    if (!key) {
      return
    }
    canonicalDisplayMap.set(key, display)
  }

  const registerFlavor = (term: string) => {
    const key = sanitizeForHashtagValue(term)
    if (!key) {
      return
    }
    flavorModifierKeys.add(key)
  }

  Object.entries(GLOBAL_CANONICAL_CORRECTIONS).forEach(([term, display]) => registerCanonical(term, display))

  const normalizedLanguage = (languageCode || '').toLowerCase()

  const defaultCanonical = LANGUAGE_CANONICAL_CORRECTIONS.default
  Object.entries(defaultCanonical).forEach(([term, display]) => registerCanonical(term, display))

  const languageCanonical = LANGUAGE_CANONICAL_CORRECTIONS[normalizedLanguage]
  if (languageCanonical) {
    Object.entries(languageCanonical).forEach(([term, display]) => registerCanonical(term, display))
  }

  GLOBAL_FLAVOR_KEYWORDS.forEach(registerFlavor)

  const defaultFlavorKeywords = LANGUAGE_FLAVOR_KEYWORDS.default ?? []
  defaultFlavorKeywords.forEach(registerFlavor)

  const languageFlavorKeywords = LANGUAGE_FLAVOR_KEYWORDS[normalizedLanguage] ?? []
  languageFlavorKeywords.forEach(registerFlavor)

  return {
    canonicalDisplayMap,
    flavorModifierKeys
  }
}
