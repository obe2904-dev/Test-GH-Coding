import type { LocationToken, CustomerToken } from './canonical-tokens.ts'

export const DA_DK_PHRASES: Record<string, any> = {
  locations: {
    waterfront: {
      canonical: 'ved åen',
      short: 'åen',
      preposition: 'ved',
      alternatives: ['langs åen', 'ved fjorden', 'ved søen', 'ved havnen', 'ved bugten'],
      fallback: 'ved vandet',  // Only for sea/ocean - not for rivers, lakes, fjords, bays
      cultural_context: 'Især vigtig i byer med å-restaurering (Aarhus Å, Odense Å). Brug specifik term: åen (streams/rivers), fjorden, søen, havnen, bugten.',
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
  },

  // ─── Time-of-day cultural rules (Denmark) ─────────────────────────────────
  // These rules are country-specific. Add a parallel block in other locale files
  // (e.g. en-GB.ts, de-DE.ts) with the culturally appropriate boundaries.
  timeOfDay: {
    // Opening label rules — evaluated in ascending order, first match wins.
    // maxHour is an exclusive upper bound as a decimal (e.g. 11.5 = 11:30).
    // Rule: use the term whose maxHour is the first one GREATER than earliestOpen.
    openingLabels: [
      { maxHour: 9,    term: 'morgenkaffe' },  // opens before 09:00           → morgen
      { maxHour: 11.5, term: 'brunch' },        // opens 09:00–11:29 (incl.)    → brunch
      { maxHour: 15,   term: 'frokost' },       // opens 11:30–14:59 (incl.)    → frokost
      { maxHour: 24,   term: 'aftensmad' },     // opens 15:00+                 → aften
    ],

    // Closing drink label: keys are lowercased substrings checked against programme
    // role names and menu category names. First match wins — order by specificity.
    closingDrinkTerms: {
      cocktail:  'cocktails',
      cocktails: 'cocktails',
      vin:       'vin',
      wine:      'vin',
      øl:        'øl',
      beer:      'øl',
      drinks:    'drinks',
      bar:       'drinks',
    } as Record<string, string>,

    // Used when hasBarSignals is true but no specific drink category matched above.
    closingDrinkFallback: 'drinks',
  },
}

export function getDaPhrases() {
  return DA_DK_PHRASES
}
