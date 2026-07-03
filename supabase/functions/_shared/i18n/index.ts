import { getDaPhrases } from './da-DK.ts'

const LOCALE_MAP: Record<string, () => Record<string, any>> = {
  'da-DK': getDaPhrases,
}

export function getPhrasesForLocale(locale: string) {
  const fn = LOCALE_MAP[locale] || LOCALE_MAP[locale?.split('-')?.[0]] || getDaPhrases
  return fn()
}
