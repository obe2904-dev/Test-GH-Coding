import { LocationCategoryId, LocalizedCategoryContent } from '../../core/types';

export const CATEGORIES_DA: Record<LocationCategoryId, LocalizedCategoryContent> = {
  city_centre: {
    name: 'Bymidten',
    icon: '🏛️',
    definition: 'Centrale gader med tæt detailhandel, natteliv og høj gangtrafik. Blanding af lokale, turister og shoppere.',
    whyItMatters: [
      'Senere aftenefterspørgsel',
      'Stærk walk-in-trafik',
      'Konkurrencepræget miljø - klarhed vinder',
      'Højere marketingstøj'
    ],
    ctaShifts: [
      'Walk-ins velkommen',
      'Sidste borde i aften',
      'Kig forbi',
      'Book nu'
    ],
    seasonalNotes: 'Helårstrafik med sommerpeak for udeservering'
  },

  residential: {
    name: 'Boligområde',
    icon: '🏘️',
    definition: 'Omgivet af boliger med begrænset detail/natteliv. Lokale dominerer kundebasen.',
    whyItMatters: [
      'Stærk morgen & weekend efterspørgsel',
      'Familieorienteret klientel',
      'Loyalitet > impulskøb',
      'Lokal reputation er afgørende'
    ],
    ctaShifts: [
      'Dit lokale sted',
      'Tag familien med',
      'Nem aftensmad',
      'Vi kender dig'
    ],
    seasonalNotes: 'Konsistent helårs, let sommerdyk (ferier)'
  },

  tourist: {
    name: 'Turistområde',
    icon: '📸',
    definition: 'Nær vartegn, attraktioner eller krydstogtterminaler. Sæsonbetonede trafikstigninger med høj andel ikke-lokale.',
    whyItMatters: [
      'Dagtid + sommerpeaks',
      'Walk-ins dominerer',
      'Lav langsigtet loyalitet',
      'Flersprogsovervejelser'
    ],
    ctaShifts: [
      'Tæt på [vartegn]',
      'Walk-ins velkommen',
      'Autentisk lokal oplevelse',
      'Perfekt efter sightseeing'
    ],
    seasonalNotes: 'Ekstrem sommerpeak (maj-sep), vinterdyk'
  },

  office: {
    name: 'Kontor / Erhvervsområde',
    icon: '🏢',
    definition: 'Kontorbygninger dominerer. Kun hverdag-trafik, stille aftener og weekender.',
    whyItMatters: [
      'Frokost er konge (11:30-13:30)',
      'Hastighed > atmosfære',
      'Forudsigelige efterspørgselsmønstre',
      'Forudbestillingsmuligheder'
    ],
    ctaShifts: [
      'Dagens frokost',
      'Klar på 10 min',
      'Bestil på forhånd',
      'Hurtig levering'
    ],
    seasonalNotes: 'Død i ferier, konsistent hverdagsmønster'
  },

  transport_hub: {
    name: 'Trafikknudepunkt',
    icon: '🚉',
    definition: 'Tog/metro/busstationer med kontinuerlig gangtrafik. Kort ophold, høj gennemstrømning.',
    whyItMatters: [
      'Morgen & eftermiddags-spidser',
      'Grab-and-go adfærd',
      'Impulsbeslutninger',
      'Hastighed er kritisk'
    ],
    ctaShifts: [
      'Tag med',
      'Klar nu',
      'På farten?',
      'Hurtig takeaway'
    ],
    seasonalNotes: 'Konsistent pendlertrafik, turistboost om sommeren'
  },

  student: {
    name: 'Studie / Uddannelsesområde',
    icon: '🎓',
    definition: 'Nær universiteter eller højskoler. Ung demografi med aften- og hverdagsaktivitet.',
    whyItMatters: [
      'Prisfølsom målgruppe',
      'Gruppeadfærd almindelig',
      'Begivenhedsdrevet efterspørgsel',
      'Fredagsbar-kultur'
    ],
    ctaShifts: [
      'Studierabat',
      'Del med venner',
      'Quiz / event i aften',
      'Budgetvenlig'
    ],
    seasonalNotes: 'Død i sommer/juleferier, peak under semester'
  },

  waterfront: {
    name: 'Vandfront',
    icon: '🌊',
    definition: 'Tæt på vand (havnefront, hav, sø eller å). Høj vejrfølsomhed, destinationsbaserede besøg.',
    whyItMatters: [
      'Weekend & eftermiddags-peaks',
      'Sommer-tung efterspørgsel',
      'Walk-ins dominerer',
      'Udendørs sidepladser er premium'
    ],
    ctaShifts: [
      'Sid i solen',
      'Ud til vandet',
      'Nyd udsigten',
      'Kig forbi'
    ],
    seasonalNotes: 'Ekstrem sommerfokus, vinterudfordringer'
  },

  nature_park: {
    name: 'Park / Naturområde',
    icon: '🌳',
    definition: 'Nær parker, skove eller grønne områder. Tiltrækker gående, hundejere, cyklister og familier der laver udendørsaktiviteter.',
    whyItMatters: [
      'Opvarmning og læ-søgende',
      'Familieudflugter og gåture med hund',
      'Sæsonpeaks (forår/sommer)',
      'Takeaway og udeservering er nøglefaktorer'
    ],
    ctaShifts: [
      'Perfekt efter gåturen',
      'Tag hunden med',
      'Familievenlig',
      'Kaffe og kage to-go'
    ],
    seasonalNotes: 'Sommerpeak, stille om vinteren'
  },

  shopping_district: {
    name: 'Shoppingområde',
    icon: '🛍️',
    definition: 'Detailhandels-tungt område med høj dagstrafik. Shoppere leder efter pauser.',
    whyItMatters: [
      'Frokost + eftermiddagskaffe peaks',
      'Impulskøbere',
      'Rastplads-mentalitet',
      'Weekendtrafik'
    ],
    ctaShifts: [
      'Shopping pause?',
      'Tag en break',
      'Slap af',
      'Midt i shoppingen'
    ],
    seasonalNotes: 'December-peak (jul), sommer moderat'
  },

  mixed_use: {
    name: 'Blandet / Moderne Byudvikling',
    icon: '🏙️',
    definition: 'Nye områder der kombinerer bolig, kontor og detail. Varieret demografi.',
    whyItMatters: [
      'Varierede efterspørgselsmønstre',
      'Yngre demografi',
      'Fleksibel positionering nødvendig',
      'Voksende områdepotentiale'
    ],
    ctaShifts: [
      'For alle',
      'Fleksibel menu',
      'Morgen til aften',
      'Dit nye lokale sted'
    ],
    seasonalNotes: 'Afbalanceret helårs'
  },
  
  destination: {
    name: 'Destination / Køre-til Område',
    icon: '🚗',
    definition: 'Uden for centrale gangtrafikzoner med lav walk-in strøm. Kunder ankommer typisk med bil eller tager en bevidst tur (ofte pga. parkering, afstand eller selvstændig placering). Besøg er mere planlagte end spontane.',
    whyItMatters: [
      'Lav walk-in trafik - marketing er kritisk',
      'Bevidste besøg dominerer',
      'Stærkt forudbestillingspotentiale',
      'Parkerings-/tilgængelighedskommunikation vigtig'
    ],
    ctaShifts: [
      'Book dit bord',
      'Værd at køre efter',
      'Planlagt aften ud',
      'Vi har parkering'
    ],
    seasonalNotes: 'Vejrafhængig adgang, vinterudfordringer hvis afsides'
  }
};
