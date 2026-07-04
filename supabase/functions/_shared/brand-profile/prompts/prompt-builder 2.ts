import { getPhrasesForLocale } from '../../i18n/index.ts'

/**
 * Render canonical location phrase for given area type and locale.
 * areaType should match keys in locale phrases (e.g., 'waterfront').
 */
export function renderLocationPhrase(areaType: string | undefined, langCode: string, nearbySignal?: string) {
  if (!areaType) return ''
  const phrases = getPhrasesForLocale(langCode || 'da-DK')
  const loc = phrases.locations?.[areaType]
  if (loc && loc.canonical) return loc.canonical

  // Fallback: if tourist_area and we have a nearby signal, return preposition + signal
  if (areaType === 'tourist_area' && nearbySignal) {
    const prep = (phrases.locations?.[areaType]?.preposition) || 'ved'
    return `${prep} ${nearbySignal}`
  }

  return ''
}

export function getLocationGuidance(token: string, locale: string) {
  const phrases = getPhrasesForLocale(locale || 'da-DK')
  const loc = phrases.locations?.[token]
  if (!loc) return ''

  return `Lokation "${loc.canonical}" betyder:\n- Preposition: ${loc.preposition}\n- Korte form: ${loc.short}\n- Alternativer: ${loc.alternatives?.slice(0,3).join(', ') || 'ingen'}\n${loc.cultural_context ? `\n${loc.cultural_context}` : ''}`
}
