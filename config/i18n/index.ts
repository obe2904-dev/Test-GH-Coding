import { getDaPhrases } from './da-DK'

const LOCALE_MAP: Record<string, Function> = {
  'da-DK': getDaPhrases,
}

export function getPhrasesForLocale(locale: string) {
  const fn = LOCALE_MAP[locale] || LOCALE_MAP[locale?.split('-')?.[0]] || getDaPhrases
  return fn()
}
