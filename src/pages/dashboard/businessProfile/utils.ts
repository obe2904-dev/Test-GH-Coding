import { createEmptyWeekSchedule } from '../../../types/businessProfile'
import type { WeekSchedule } from '../../../types/businessProfile'
import type { BusinessSector } from '../../../types/businessSector'
import type { BusinessOfferingsProfile } from '../../../types/businessOfferings'
import type { Database } from '../../../types/database'

export type ProfileRow = Database['public']['Tables']['profiles']['Row']

export const isBusinessSectorValue = (value: string | null): value is BusinessSector =>
  value === 'hospitality' || value === 'beauty' || value === 'wellness' || value === 'retail'

export const parseBusinessOfferings = (
  value: ProfileRow['business_offerings']
): BusinessOfferingsProfile | null => {
  if (!value) {
    return null
  }

  return Array.isArray(value.categories) ? value : null
}

export const parseOpeningHours = (
  value: ProfileRow['opening_hours']
): WeekSchedule | null => {
  if (!value) {
    return null
  }

  const requiredKeys: Array<keyof WeekSchedule> = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn']
  const schedule = createEmptyWeekSchedule()

  for (const key of requiredKeys) {
    const entry = value[key]
    schedule[key] = {
      open: entry?.open ?? '',
      close: entry?.close ?? ''
    }
  }

  return schedule
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const parseStoredAddress = (value: string | null, savedCountry?: string | null) => {
  if (!value) {
    return { street: '', postal: '', city: '' }
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return { street: '', postal: '', city: '' }
  }

  const countryName = savedCountry?.trim()
  const countryPattern = countryName
    ? new RegExp(`,\\s*${escapeRegExp(countryName)}$`, 'i')
    : null
  const withoutCountry = countryPattern ? trimmed.replace(countryPattern, '').trim() : trimmed

  const postalMatch = withoutCountry.match(/(\d{4})\s*([A-Za-zÀ-ÖØ-öø-ÿ.\- ]+)?$/)

  if (postalMatch && postalMatch.index !== undefined) {
    const streetPart = withoutCountry
      .slice(0, postalMatch.index)
      .replace(/[, ]+$/, '')

    return {
      street: streetPart,
      postal: postalMatch[1] || '',
      city: (postalMatch[2] || '').trim()
    }
  }

  return {
    street: withoutCountry,
    postal: '',
    city: ''
  }
}

export const mapCountryLabel = (value?: string | null) => {
  if (!value) return 'Danmark'

  return value.trim().toLowerCase() === 'denmark' ? 'Danmark' : value
}

export const getItemPlaceholder = (businessSector: BusinessSector | null): string => {
  switch (businessSector) {
    case 'hospitality':
      return 'fx Espresso, Americano, Cappuccino'
    case 'beauty':
      return 'fx Herreklip, Dameklip, Farve'
    case 'wellness':
      return 'fx Sportsmassage, Afspændingsmassage'
    case 'retail':
      return 'fx Kjole, Bukser, Sko'
    default:
      return 'fx Produkt 1, Produkt 2'
  }
}

export const makeRandomId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`
