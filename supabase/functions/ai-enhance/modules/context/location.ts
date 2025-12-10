import { getSeasonForCountry, sanitizeForHashtagValue, type Season } from '../../tone-cards.ts'

interface CityProfile {
  slug: string
  displayName: string
  aliases: string[]
  hashtags: string[]
}

export interface LocationEvent {
  key: string
  label: string
  month: number
  day: number
  durationDays?: number
  leadDays?: number
  hashtags: string[]
  description?: string
  appliesTo?: string[] // Optional whitelist of ISO-2 country codes
}

interface LocationProfile {
  iso2: string
  countryName: string
  defaultHashtags: string[]
  seasonalHashtags?: Partial<Record<Season, string[]>>
  cities?: CityProfile[]
  events?: LocationEvent[]
}

export interface LocationContext {
  countryCode: string | null
  countryName: string | null
  season: Season
  seasonHashtags: string[]
  countryHashtags: string[]
  city?: {
    slug: string
    displayName: string
    hashtags: string[]
  } | null
  activeEvents: LocationEvent[]
  upcomingEvents: LocationEvent[]
}

const DEFAULT_EVENT_LEAD_DAYS = 21
const DEFAULT_EVENT_DURATION_DAYS = 1

const LOCATION_PROFILES: Record<string, LocationProfile> = {
  dk: {
    iso2: 'DK',
    countryName: 'Denmark',
    defaultHashtags: ['danmark', 'visitdenmark', 'lokal'],
    seasonalHashtags: {
      spring: ['foraar', 'paaske', 'foraarshygge'],
      summer: ['sommer', 'sommerhygge', 'sommeraften'],
      autumn: ['efteraar', 'halloween', 'mortensaften'],
      winter: ['vinter', 'vinterhygge', 'juletid', 'nytaar'],
    },
    cities: [
      {
        slug: 'copenhagen',
        displayName: 'København',
        aliases: ['kobenhavn', 'københavn', 'copenhagen', 'kbh'],
        hashtags: ['kbh', 'visitcopenhagen', 'kobenhavnmad']
      },
      {
        slug: 'aarhus',
        displayName: 'Aarhus',
        aliases: ['aarhus', 'arhus'],
        hashtags: ['aarhus', 'smiletsby', 'visitaarhus']
      },
      {
        slug: 'odense',
        displayName: 'Odense',
        aliases: ['odense'],
        hashtags: ['odense', 'fyn', 'hca']
      }
    ],
    events: [
      {
        key: 'mortensaften',
        label: 'Mortensaften',
        month: 11,
        day: 10,
        durationDays: 2,
        hashtags: ['mortensaften', 'and', 'hygge'],
        description: 'Traditional Danish feast with roast duck.'
      },
      {
        key: 'julefrokost',
        label: 'Julefrokost',
        month: 12,
        day: 1,
        durationDays: 31,
        hashtags: ['julefrokost', 'jul', 'julehygge'],
        description: 'Company holiday gatherings peak in December.'
      }
    ]
  },
  se: {
    iso2: 'SE',
    countryName: 'Sweden',
    defaultHashtags: ['sverige', 'visitsweden', 'lokalt'],
    seasonalHashtags: {
      spring: ['var', 'pask', 'varerbjudande'],
      summer: ['sommar', 'sommarmys', 'midsommar'],
      autumn: ['host', 'hostmys', 'lussekatt'],
      winter: ['vinter', 'jul', 'nyar'],
    },
    cities: [
      {
        slug: 'stockholm',
        displayName: 'Stockholm',
        aliases: ['stockholm'],
        hashtags: ['stockholm', 'visitstockholm', 'stockholmfood']
      },
      {
        slug: 'gothenburg',
        displayName: 'Göteborg',
        aliases: ['gothenburg', 'goteborg', 'göteborg'],
        hashtags: ['goteborg', 'visitgbg', 'goteborgcity']
      }
    ],
    events: [
      {
        key: 'midsommar',
        label: 'Midsommar',
        month: 6,
        day: 21,
        durationDays: 3,
        hashtags: ['midsommar', 'sommar', 'blomsterkrans'],
        description: 'Peak Swedish summer celebration with flower crowns and outdoor dining.'
      }
    ]
  }
}

const COUNTRY_ALIASES: Record<string, keyof typeof LOCATION_PROFILES> = {
  dk: 'dk',
  denmark: 'dk',
  danmark: 'dk',
  se: 'se',
  sweden: 'se',
  sverige: 'se'
}

const GLOBAL_EVENTS: LocationEvent[] = [
  {
    key: 'valentines-day',
    label: "Valentine's Day",
    month: 2,
    day: 14,
    hashtags: ['valentinesday', 'love', 'selflove'],
    description: 'Romantic offers, dining experiences, and gifting.',
    leadDays: 10,
    appliesTo: ['dk', 'se']
  },
  {
    key: 'mothers-day',
    label: "Mother's Day",
    month: 5,
    day: 12,
    hashtags: ['morsdag', 'mothersday', 'forkaelmor'],
    description: 'Popular for brunch, gifts, and pampering.',
    leadDays: 14,
    appliesTo: ['dk', 'se']
  }
]

function normalizeCountryCode(value?: string | null): keyof typeof LOCATION_PROFILES | null {
  const sanitized = sanitizeForHashtagValue(value || '')
  if (!sanitized) {
    return null
  }
  if (COUNTRY_ALIASES[sanitized]) {
    return COUNTRY_ALIASES[sanitized]
  }
  const twoLetter = sanitized.slice(0, 2) as keyof typeof LOCATION_PROFILES
  return LOCATION_PROFILES[twoLetter] ? twoLetter : null
}

function findCityProfile(profile: LocationProfile | undefined, city?: string | null): CityProfile | null {
  if (!profile || !profile.cities || !city) {
    return null
  }
  const sanitizedCity = sanitizeForHashtagValue(city)
  if (!sanitizedCity) {
    return null
  }
  for (const entry of profile.cities) {
    if (entry.aliases.some((alias) => sanitizeForHashtagValue(alias) === sanitizedCity)) {
      return entry
    }
  }
  return null
}

function resolveEvents(
  profile: LocationProfile | undefined,
  countryCode: string | null,
  referenceDate: Date
): { active: LocationEvent[]; upcoming: LocationEvent[] } {
  const allEvents = [
    ...(profile?.events ?? []),
    ...GLOBAL_EVENTS.filter((event) =>
      !event.appliesTo || (countryCode && event.appliesTo.includes(countryCode))
    )
  ]

  if (allEvents.length === 0) {
    return { active: [], upcoming: [] }
  }

  const active: LocationEvent[] = []
  const upcoming: LocationEvent[] = []
  const refYear = referenceDate.getUTCFullYear()

  allEvents.forEach((event) => {
    const duration = event.durationDays ?? DEFAULT_EVENT_DURATION_DAYS
    const leadDays = event.leadDays ?? DEFAULT_EVENT_LEAD_DAYS

    const eventStart = Date.UTC(refYear, event.month - 1, event.day)
    const eventEnd = Date.UTC(refYear, event.month - 1, event.day + duration)
    const refTime = referenceDate.getTime()

    if (refTime >= eventStart && refTime <= eventEnd) {
      active.push(event)
      return
    }

    const daysUntil = Math.floor((eventStart - refTime) / (1000 * 60 * 60 * 24))
    if (daysUntil >= 0 && daysUntil <= leadDays) {
      upcoming.push(event)
    }
  })

  return { active, upcoming }
}

export function resolveLocationContext(params: {
  country?: string | null
  city?: string | null
  referenceDate?: Date
}): LocationContext {
  const referenceDate = params.referenceDate ?? new Date()
  const countryCode = normalizeCountryCode(params.country)
  const profile = countryCode ? LOCATION_PROFILES[countryCode] : undefined
  const season = getSeasonForCountry(params.country ?? undefined, referenceDate)

  const cityProfile = findCityProfile(profile, params.city)
  const { active, upcoming } = resolveEvents(profile, countryCode, referenceDate)

  return {
    countryCode: profile?.iso2 ?? null,
    countryName: profile?.countryName ?? null,
    season,
    seasonHashtags: profile?.seasonalHashtags?.[season] ?? [],
    countryHashtags: profile?.defaultHashtags ?? [],
    city: cityProfile
      ? {
          slug: cityProfile.slug,
          displayName: cityProfile.displayName,
          hashtags: cityProfile.hashtags
        }
      : null,
    activeEvents: active,
    upcomingEvents: upcoming
  }
}
