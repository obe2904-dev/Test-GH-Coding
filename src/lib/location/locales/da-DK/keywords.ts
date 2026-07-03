import { LocationKeywords } from '../../core/types';

export const KEYWORDS_DA: LocationKeywords = {
  waterfront: [
    // Direct water references
    'åen', 'å', 'havn', 'havnen', 'havnefront', 'kaj', 'kajen', 'brygge',
    'marina', 'strand', 'stranden', 'søen', 'sø', 'ved vandet', 'vandkant',
    
    // Descriptive phrases
    'udsigt til vandet', 'udsigt over åen', 'ved havnen', 'langs åen',
    'havneudsigt', 'vandudsigt', 'åbred',
    
    // English variants (for mixed content)
    'waterfront', 'riverside', 'harborfront', 'harbour'
  ],

  cityCenter: [
    'centrum', 'bymidten', 'city', 'midtbyen', 'indre by',
    'gågade', 'strøget', 'torv', 'pladsen',
    'centralt beliggende', 'central placering', 'midt i byen'
  ],

  residential: [
    'boligområde', 'kvarter', 'bydel', 'roligt område',
    'familievenligt', 'lokalt', 'nabolag',
    'boligkvarter', 'villakvarter'
  ],

  tourist: [
    'seværdighed', 'seværdigheder', 'attraktion', 'attraktioner',
    'vartegn', 'monument', 'turistattraktion',
    'nær [museum/slot/kirke]', 'tæt på seværdigheder',
    'turistområde', 'populær destination'
  ],

  office: [
    'erhvervsområde', 'kontorområde', 'businesspark',
    'kontorhus', 'kontorbygning', 'erhvervspark'
  ],

  student: [
    'universitet', 'campus', 'studerende', 'studenterområde',
    'kollegieområde', 'kollegier', 'uddannelsesinstitution'
  ],

  shopping: [
    'shoppingcenter', 'handelsområde', 'butiksgade',
    'shoppinggade', 'indkøbscenter', 'detailhandel'
  ],

  leisure: [
    'fritidsområde', 'rekreativt område', 'park', 'grønt område',
    'spadseretur', 'gåtur', 'udflugt', 'destination'
  ]
};
