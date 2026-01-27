import { KnownLocation } from '../../core/types';

/**
 * Known waterfront, cultural, and significant locations in Denmark
 * Organized by city for efficient lookup
 */
export const KNOWN_LOCATIONS_DA: Record<string, KnownLocation[]> = {
  'Aarhus': [
    {
      identifier: 'Åboulevarden',
      score: 85,
      description: 'Aarhus\' primære sociale destination langs åen',
      culturalContext: {
        significance: 'very_high',
        description: 'Ikonisk gade langs Aarhus Å med caféliv, restauranter og aftenliv',
        knownFor: ['udeservering', 'café-kultur', 'aftenliv', 'turistattraktion', 'sociale sammenkomster'],
        seasonality: 'Ekstremt sommerfokuseret - udeservering langs åen trækker store mængder maj-september',
        historicalNote: 'Åen blev åbnet i 1990erne efter at have været overdækket siden 1930erne'
      }
    },
    {
      identifier: 'Mejlgade',
      score: 70,
      description: 'Ved Aarhus Å med blanding af cafeer og butikker',
      culturalContext: {
        significance: 'medium',
        description: 'Bymidtegade med adgang til åen',
        knownFor: ['shopping', 'cafeer', 'centralt beliggende'],
        seasonality: 'Moderat sæsonudsving'
      }
    },
    {
      identifier: 'Mindet',
      score: 80,
      description: 'Aarhus havn og marina',
      culturalContext: {
        significance: 'high',
        description: 'Havneområde med marina, restauranter og nye byudviklinger',
        knownFor: ['havn', 'marina', 'seafood', 'moderne udvikling'],
        seasonality: 'Sommer-peak for havnelivet'
      }
    },
    {
      identifier: 'Strøget',
      score: 75,
      description: 'Aarhus\' primære gågade og shoppingstrøg',
      culturalContext: {
        significance: 'high',
        description: 'Central gågade med detailhandel og caféer',
        knownFor: ['shopping', 'gågade', 'turister', 'bymidten'],
        seasonality: 'Helårs med december-peak'
      }
    }
  ],

  'København': [
    {
      identifier: 'Nyhavn',
      score: 95,
      description: 'Danmarks mest ikoniske havnefront',
      culturalContext: {
        significance: 'very_high',
        description: 'Historisk havn med farverige bygninger, international turistmagnet',
        knownFor: ['turistmagnet', 'restauranter', 'historisk havn', 'fotografering', 'H.C. Andersen'],
        seasonality: 'Helårs turistdestination, men sommer-ekstremt travlt',
        historicalNote: 'Etableret 1671 af Christian V, hjem til H.C. Andersen i flere perioder'
      }
    },
    {
      identifier: 'Havnegade',
      score: 85,
      description: 'Inderhavnens centrale promenade',
      culturalContext: {
        significance: 'high',
        description: 'Moderne havnefront med mix af lokale og turister',
        knownFor: ['havnepromenade', 'cykling', 'caféliv'],
        seasonality: 'Sommer-fokuseret'
      }
    },
    {
      identifier: 'Christians Brygge',
      score: 80,
      description: 'Havnefront med udsigt til Christiansborg',
      culturalContext: {
        significance: 'high',
        description: 'Historisk havnepromenade langs Inderhavnen',
        knownFor: ['udsigt', 'cykelsti', 'bymidten'],
        seasonality: 'Helårs med sommerpeak'
      }
    },
    {
      identifier: 'Strøget',
      score: 90,
      description: 'Europas længste gågade og shoppingdestination',
      culturalContext: {
        significance: 'very_high',
        description: 'Ikonisk gågade fra Rådhuspladsen til Kongens Nytorv',
        knownFor: ['shopping', 'gågade', 'turister', 'gadesalg', 'street performers'],
        seasonality: 'Helårs med jul-peak i december'
      }
    },
    {
      identifier: 'Vesterbro',
      score: 70,
      description: 'Trendy bydel med caféliv og natteliv',
      culturalContext: {
        significance: 'high',
        description: 'Hipster-kvarter med moderne cafeer, barer og restauranter',
        knownFor: ['trendy', 'natteliv', 'café-kultur', 'kreative miljøer'],
        seasonality: 'Helårs med stærk lokal base'
      }
    }
  ],

  'Odense': [
    {
      identifier: 'Odense Å',
      score: 75,
      description: 'Odenses å med stier og grønne områder',
      culturalContext: {
        significance: 'medium',
        description: 'Byens å med rekreative stier',
        knownFor: ['natur', 'gåture', 'cykling'],
        seasonality: 'Sommer-fokuseret'
      }
    }
  ],

  'Aalborg': [
    {
      identifier: 'Jomfru Ane Gade',
      score: 85,
      description: 'Danmarks mest kendte bar- og nattelivsgade',
      culturalContext: {
        significance: 'very_high',
        description: 'Ikonisk nattelivsgade med tæt koncentration af barer og restauranter',
        knownFor: ['natteliv', 'barer', 'studenter', 'fest'],
        seasonality: 'Helårs natteliv, ekstra travlt i studietiden'
      }
    }
  ]
};
