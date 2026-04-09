import type { LocationToken, CustomerToken } from './canonical-tokens.ts'

export const DA_DK_PHRASES: Record<string, any> = {
  locations: {
    waterfront: {
      canonical: 'ved åen',
      short: 'åen',
      preposition: 'ved',
      alternatives: ['ved vandet', 'langs åen'],
      cultural_context: 'Især vigtig i byer med å-restaurering (Aarhus Å, Odense Å)',
    },
    city_centre: {
      canonical: 'i bymidten',
      short: 'bymidten',
      preposition: 'i',
      alternatives: ['centrum', 'på hovedgaden'],
    },
    shopping_street: {
      canonical: 'på gågaden',
      short: 'gågaden',
      preposition: 'på',
      alternatives: ['på hovedgaden'],
    },
    tourist_area: {
      canonical: 'i turistområdet',
      short: 'turistområdet',
      preposition: 'i',
      alternatives: ['ved attraktioner'],
    },
    residential: {
      canonical: 'i kvarteret',
      short: 'kvarteret',
      preposition: 'i',
      alternatives: ['i boligområdet'],
    },
    business_district: {
      canonical: 'i centrum',
      short: 'centrum',
      preposition: 'i',
      alternatives: ['i bymidten'],
    }
  },
  customers: {
    families_with_kids: {
      canonical: 'familier med børn',
      short: 'familier',
    },
    couples: {
      canonical: 'par',
      short: 'par',
    },
    friends_social_groups: {
      canonical: 'vennegrupper',
      short: 'venner',
    }
  }
}

export function getDaPhrases() {
  return DA_DK_PHRASES
}
