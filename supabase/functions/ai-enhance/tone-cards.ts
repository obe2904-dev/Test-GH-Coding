/**
 * Tone Cards - Category-specific tone guidelines for AI text enhancement
 * Maps business categories to their characteristic communication styles and suggested hashtags
 */

export interface ToneCardHashtags {
  shared?: string[]
  instagramOnly?: string[]
  branded?: string
  seasonal?: string[]
  core?: string[]
  generic?: string[]
}

export interface ToneCard {
  category: string
  tone: string
  characteristics: string[]
  voiceGuidelines: string
  hashtags?: ToneCardHashtags
}

export interface HashtagPlan {
  shared: string[]
  instagramOnly: string[]
  seasonal: string[]
  branded?: string
}

export type Season = 'winter' | 'spring' | 'summer' | 'autumn'

const NORTHERN_SEASON_BY_MONTH: Season[] = [
  'winter', // January
  'winter', // February
  'spring', // March
  'spring', // April
  'spring', // May
  'summer', // June
  'summer', // July
  'summer', // August
  'autumn', // September
  'autumn', // October
  'autumn', // November
  'winter' // December
]

const SOUTHERN_SEASON_BY_MONTH: Season[] = [
  'summer', // January
  'summer', // February
  'autumn', // March
  'autumn', // April
  'autumn', // May
  'winter', // June
  'winter', // July
  'winter', // August
  'spring', // September
  'spring', // October
  'spring', // November
  'summer' // December
]

const SOUTHERN_HEMISPHERE_COUNTRIES = new Set([
  'au', 'australia',
  'nz', 'newzealand',
  'za', 'southafrica',
  'na', 'namibia',
  'bw', 'botswana',
  'zw', 'zimbabwe',
  'mz', 'mozambique',
  'ls', 'lesotho',
  'sz', 'eswatini', 'swaziland',
  'ao', 'angola',
  'mw', 'malawi',
  'zm', 'zambia',
  'ar', 'argentina',
  'bo', 'bolivia',
  'br', 'brazil', 'brasil',
  'cl', 'chile',
  'co', 'colombia',
  'ec', 'ecuador',
  'gy', 'guyana',
  'pe', 'peru',
  'py', 'paraguay',
  'sr', 'suriname',
  'uy', 'uruguay',
  've', 'venezuela'
])

const SEASONAL_HASHTAGS_BY_LOCALE: Record<string, Record<Season, string[]>> = {
  da: {
    spring: ['foraar', 'foraarshygge', 'foraarstilbud', 'paaske', 'paasketid'],
    summer: ['sommer', 'sommerhygge', 'sommeraften', 'sommerferie', 'iskaffe'],
    autumn: ['efteraar', 'efteraarsmenu', 'efteraarshygge', 'halloween', 'mortensaften'],
    winter: ['vinter', 'vinterhygge', 'juletid', 'julehygge', 'nytaar', 'vintertilbud']
  },
  sv: {
    spring: ['var', 'varkansla', 'pask', 'paskmys', 'varerbjudande'],
    summer: ['sommar', 'sommarmys', 'sommarliv', 'sommarlov', 'iskaffe'],
    autumn: ['host', 'hostmys', 'hosterbjudande', 'halloween', 'lussekatt'],
    winter: ['vinter', 'vintermys', 'jul', 'julmys', 'nyar', 'vintererbjudande']
  },
  en: {
    spring: ['spring', 'springtime', 'blossom', 'springvibes', 'easterseason'],
    summer: ['summer', 'summervibes', 'sunnydays', 'holiday', 'warmweather'],
    autumn: ['autumn', 'fall', 'cozyseason', 'harvesttime', 'fallvibes'],
    winter: ['winter', 'wintertime', 'cozyseason', 'holidayseason', 'snowday', 'festiveseason']
  }
}

const ENGLISH_SEASON_KEYWORDS = ['spring', 'summer', 'autumn', 'fall', 'winter', 'holiday', 'season', 'snow', 'cozy', 'cozyszn', 'festive']

const LOCALE_SEASON_KEYWORDS: Record<string, string[]> = {
  da: ['foraar', 'sommer', 'efteraar', 'vinter', 'jul', 'hygge', 'nytaar', 'paaske'],
  sv: ['var', 'sommar', 'host', 'vinter', 'jul', 'mys', 'nyar', 'pask'],
  en: []
}

function getSeasonalHashtagsForLocale(season: Season, languageCode: string): string[] {
  const localeSet = SEASONAL_HASHTAGS_BY_LOCALE[languageCode] || SEASONAL_HASHTAGS_BY_LOCALE.en
  return [...(localeSet[season] || [])]
}

function isSeasonalTagAllowedForLocale(tag: string, languageCode: string): boolean {
  if (!tag) {
    return false
  }

  if (languageCode === 'en') {
    return true
  }

  const sanitized = sanitizeForHashtagValue(tag) || ''
  if (!sanitized) {
    return false
  }

  const hasEnglishKeyword = ENGLISH_SEASON_KEYWORDS.some((keyword) => sanitized.includes(keyword))
  if (!hasEnglishKeyword) {
    return true
  }

  const localeKeywords = LOCALE_SEASON_KEYWORDS[languageCode] || []
  return localeKeywords.some((keyword) => sanitized.includes(keyword))
}

const FALLBACK_HASHTAGS_EN: HashtagPlan = {
  shared: ['local', 'localbusiness'],
  instagramOnly: ['supportlocal', 'shopsmall', 'community'],
  seasonal: getSeasonalHashtagsForLocale('spring', 'en'),
  branded: '{businessName}'
}

const FALLBACK_HASHTAGS_DA: HashtagPlan = {
  shared: ['lokal', 'lokalforretning'],
  instagramOnly: ['stoetlokalt', 'oplevelse'],
  seasonal: getSeasonalHashtagsForLocale('spring', 'da'),
  branded: '{businessName}'
}

const FALLBACK_HASHTAGS_SV: HashtagPlan = {
  shared: ['lokal', 'lokalforetag'],
  instagramOnly: ['stotlokalt', 'upplevelse'],
  seasonal: getSeasonalHashtagsForLocale('spring', 'sv'),
  branded: '{businessName}'
}

function cloneHashtagPlan(plan: HashtagPlan): HashtagPlan {
  return {
    shared: [...plan.shared],
    instagramOnly: [...plan.instagramOnly],
    seasonal: [...plan.seasonal],
    branded: plan.branded
  }
}

function dedupeHashtagValues(values: (string | undefined | null)[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    if (!value) {
      continue
    }
    const sanitized = sanitizeForHashtagValue(value)
    if (!sanitized) {
      continue
    }
    if (seen.has(sanitized)) {
      continue
    }
    seen.add(sanitized)
    result.push(sanitized)
  }

  return result
}

export function getSeasonForCountry(country?: string | null, referenceDate: Date = new Date()): Season {
  const sanitized = sanitizeForHashtagValue(country) || ''
  const hemisphere = sanitized && SOUTHERN_HEMISPHERE_COUNTRIES.has(sanitized) ? 'southern' : 'northern'
  const monthIndex = referenceDate.getUTCMonth()
  const seasonByMonth = hemisphere === 'southern' ? SOUTHERN_SEASON_BY_MONTH : NORTHERN_SEASON_BY_MONTH
  return seasonByMonth[monthIndex] ?? 'winter'
}

export function sanitizeForHashtagValue(value?: string | null): string | null {
  if (!value || typeof value !== 'string') {
    return null
  }

  const sanitized = value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .replace(/å/g, 'aa')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '')

  return sanitized || null
}

export function getHashtagPlan(category: string, language: string = 'en', country?: string | null): HashtagPlan {
  const normalized = (language || 'en').toLowerCase()
  const languageCode = normalized.split('-')[0]
  const toneCard = getToneCard(category, languageCode) || null

  let fallbackBase: HashtagPlan
  switch (languageCode) {
    case 'da':
      fallbackBase = FALLBACK_HASHTAGS_DA
      break
    case 'sv':
      fallbackBase = FALLBACK_HASHTAGS_SV
      break
    default:
      fallbackBase = FALLBACK_HASHTAGS_EN
      break
  }

  const season = getSeasonForCountry(country ?? undefined)

  if (!toneCard?.hashtags) {
    const fallbackClone = cloneHashtagPlan(fallbackBase)
    fallbackClone.seasonal = getSeasonalHashtagsForLocale(season, languageCode)
    return fallbackClone
  }

  const { shared, instagramOnly, branded, seasonal, core, generic } = toneCard.hashtags

  const sharedList = dedupeHashtagValues([
    ...(shared || []),
    ...(shared ? [] : core || []),
  ]).slice(0, 3)

  const instagramOnlyList = dedupeHashtagValues([
    ...(instagramOnly || []),
    ...(core ? core.slice(sharedList.length) : []),
    ...(generic || []),
  ]).filter((tag) => !sharedList.some((sharedTag) => sharedTag.toLowerCase() === tag.toLowerCase()))

  const seasonalCandidates = [...(seasonal || []), ...getSeasonalHashtagsForLocale(season, languageCode)]
  const seasonalList = dedupeHashtagValues(seasonalCandidates)
    .filter((tag) => isSeasonalTagAllowedForLocale(tag, languageCode))

  return {
    shared: sharedList.length > 0 ? sharedList : [...fallbackBase.shared],
    instagramOnly: instagramOnlyList.length > 0 ? instagramOnlyList : [...fallbackBase.instagramOnly],
    branded,
    seasonal: seasonalList,
  }
}

export const TONE_CARDS_EN: Record<string, ToneCard> = {
  // Food & Beverage
  'Café': {
    category: 'Café',
    tone: 'Casual, cozy, relaxed, and comfortable',
    characteristics: [
      'Warm and welcoming',
      'Community-focused',
      'Approachable and friendly',
      'Emphasis on atmosphere and experience'
    ],
    voiceGuidelines: 'Use conversational language that makes customers feel at home. Focus on comfort, quality, and the social experience.',
    hashtags: {
      shared: ['cafe', 'brunch'],
      instagramOnly: ['coffeetime', 'coffeelover', 'breakfast', 'brunch', 'foodie', 'instafood', 'local', 'coffee', 'coffeeaddict'],
      branded: '{businessName}cafe'
    }
  },
  'Restaurant': {
    category: 'Restaurant',
    tone: 'Inviting, appetizing, and professional',
    characteristics: [
      'Emphasizes quality and taste',
      'Sophisticated yet accessible',
      'Detail-oriented about cuisine',
      'Creates anticipation'
    ],
    voiceGuidelines: 'Balance professionalism with warmth. Highlight culinary expertise while remaining welcoming.',
    hashtags: {
      shared: ['restaurant', 'foodlover'],
      instagramOnly: ['dining', 'food', 'delicious', 'foodie', 'instafood', 'yummy', 'dinner', 'lunch', 'finedining'],
      branded: '{businessName}restaurant'
    }
  },
  'Bageri': {
    category: 'Bageri',
    tone: 'Fresh, warm, traditional, and comforting',
    characteristics: [
      'Artisanal and authentic',
      'Early morning energy',
      'Focus on freshness and craftsmanship',
      'Nostalgic and homey'
    ],
    voiceGuidelines: 'Emphasize freshness, tradition, and the sensory experience of baking.',
    hashtags: {
      core: ['bakery', 'freshbaked', 'artisanbread', 'bakedgoods'],
      generic: ['bread', 'pastry', 'breakfast', 'homemade', 'foodie']
    }
  },
  'Bar': {
    category: 'Bar',
    tone: 'Lively, social, energetic, and fun',
    characteristics: [
      'Vibrant and engaging',
      'Social and community-building',
      'Celebratory atmosphere',
      'Relaxed and entertaining'
    ],
    voiceGuidelines: 'Create excitement around social experiences. Be approachable and fun without being unprofessional.',
    hashtags: {
      shared: ['bar', 'cocktails'],
      instagramOnly: ['drinks', 'nightlife', 'cheers', 'happyhour', 'weekend', 'goodtimes', 'drinkup', 'cocktailbar', 'mixology'],
      branded: '{businessName}bar'
    }
  },

  // Health & Wellness
  'Frisør': {
    category: 'Frisør',
    tone: 'Professional, creative, personal, and caring',
    characteristics: [
      'Style-conscious',
      'Personal attention',
      'Expertise in beauty',
      'Confidence-building'
    ],
    voiceGuidelines: 'Balance creativity with professionalism. Make clients feel valued and beautiful.',
    hashtags: {
      core: ['hairsalon', 'hairstylist', 'hairdresser', 'salon'],
      generic: ['hair', 'beauty', 'style', 'haircut', 'hairstyle', 'beforeandafter']
    }
  },
  'Skønhedsklinik': {
    category: 'Skønhedsklinik',
    tone: 'Professional, soothing, trustworthy, and refined',
    characteristics: [
      'Expert and credible',
      'Calm and reassuring',
      'Focus on results and care',
      'Pro but accessible'
    ],
    voiceGuidelines: 'Project expertise and trustworthiness. Emphasize care, quality, and transformation.',
    hashtags: {
      core: ['beautyclinic', 'skincare', 'beauty', 'aesthetics'],
      generic: ['selfcare', 'wellness', 'glowingskin', 'beautytips', 'skincareroutine']
    }
  },
  'Spa': {
    category: 'Spa',
    tone: 'Tranquil, luxurious, peaceful, and rejuvenating',
    characteristics: [
      'Calm and serene',
      'Focus on wellness and relaxation',
      'Pro experience',
      'Self-care oriented'
    ],
    voiceGuidelines: 'Use calming language that evokes relaxation. Emphasize escape, rejuvenation, and self-care.'
  },
  'Fitness': {
    category: 'Fitness',
    tone: 'Motivating, energetic, supportive, and empowering',
    characteristics: [
      'Goal-oriented',
      'Encouraging and positive',
      'Community-focused',
      'Results-driven'
    ],
    voiceGuidelines: 'Be motivational without being pushy. Emphasize progress, community, and personal achievement.'
  },
  'Yoga': {
    category: 'Yoga',
    tone: 'Peaceful, mindful, balanced, and welcoming',
    characteristics: [
      'Holistic and centered',
      'Inclusive and accepting',
      'Focus on mind-body connection',
      'Gentle and encouraging'
    ],
    voiceGuidelines: 'Use mindful, inclusive language. Emphasize balance, wellness, and personal journey.'
  },

  // Retail
  'Tøjbutik': {
    category: 'Tøjbutik',
    tone: 'Stylish, trendy, confident, and personal',
    characteristics: [
      'Fashion-forward',
      'Personal styling focus',
      'Expressive and creative',
      'Customer empowerment'
    ],
    voiceGuidelines: 'Be style-conscious and inspiring. Help customers feel confident and fashionable.'
  },
  'Butik': {
    category: 'Butik',
    tone: 'Friendly, helpful, personal, and reliable',
    characteristics: [
      'Customer service focused',
      'Knowledgeable and helpful',
      'Local and personal',
      'Trustworthy'
    ],
    voiceGuidelines: 'Be approachable and helpful. Emphasize personal service and local connection.'
  },
  'Boghandel': {
    category: 'Boghandel',
    tone: 'Thoughtful, literary, welcoming, and knowledgeable',
    characteristics: [
      'Cultured and educated',
      'Passionate about books',
      'Community-oriented',
      'Thoughtful recommendations'
    ],
    voiceGuidelines: 'Show passion for literature and reading. Be knowledgeable without being pretentious.'
  },

  // Professional Services
  'Advokat': {
    category: 'Advokat',
    tone: 'Professional, trustworthy, clear, and authoritative',
    characteristics: [
      'Expert and credible',
      'Clear communication',
      'Client-focused',
      'Ethical and reliable'
    ],
    voiceGuidelines: 'Project expertise and trustworthiness. Be clear and professional while remaining approachable.'
  },
  'Revisor': {
    category: 'Revisor',
    tone: 'Professional, precise, trustworthy, and reliable',
    characteristics: [
      'Detail-oriented',
      'Credible and authoritative',
      'Clear and transparent',
      'Service-oriented'
    ],
    voiceGuidelines: 'Emphasize accuracy, reliability, and trust. Be professional yet accessible.'
  },
  'Konsulent': {
    category: 'Konsulent',
    tone: 'Professional, insightful, strategic, and helpful',
    characteristics: [
      'Expert guidance',
      'Solution-oriented',
      'Strategic thinking',
      'Results-focused'
    ],
    voiceGuidelines: 'Project expertise and insight. Focus on solutions and value delivery.'
  },

  // Home & Services
  'Ejendomsmægler': {
    category: 'Ejendomsmægler',
    tone: 'Professional, trustworthy, knowledgeable, and helpful',
    characteristics: [
      'Market expert',
      'Clear communicator',
      'Client advocate',
      'Results-oriented'
    ],
    voiceGuidelines: 'Balance professionalism with personal service. Build trust through expertise.'
  },
  'Håndværker': {
    category: 'Håndværker',
    tone: 'Reliable, skilled, straightforward, and honest',
    characteristics: [
      'Practical and solution-focused',
      'Quality craftsmanship',
      'Dependable service',
      'Clear communication'
    ],
    voiceGuidelines: 'Be straightforward and reliable. Emphasize quality work and dependability.'
  },
  'Rengøring': {
    category: 'Rengøring',
    tone: 'Reliable, thorough, trustworthy, and professional',
    characteristics: [
      'Detail-oriented',
      'Dependable service',
      'Quality-focused',
      'Respectful and discreet'
    ],
    voiceGuidelines: 'Emphasize reliability, thoroughness, and trust. Be professional and respectful.'
  },

  // Creative & Events
  'Fotograf': {
    category: 'Fotograf',
    tone: 'Creative, artistic, personal, and professional',
    characteristics: [
      'Visual storytelling',
      'Artistic vision',
      'Moment capturing',
      'Personal connection'
    ],
    voiceGuidelines: 'Show artistic passion while being professional. Emphasize storytelling and moments.'
  },
  'Eventbureau': {
    category: 'Eventbureau',
    tone: 'Creative, organized, exciting, and professional',
    characteristics: [
      'Detail-oriented planning',
      'Creative solutions',
      'Experience-focused',
      'Reliable execution'
    ],
    voiceGuidelines: 'Balance creativity with reliability. Create excitement while projecting professionalism.'
  },

  // Pet Services
  'Dyrlæge': {
    category: 'Dyrlæge',
    tone: 'Caring, professional, compassionate, and trustworthy',
    characteristics: [
      'Compassionate care',
      'Medical expertise',
      'Pet and owner focused',
      'Reassuring presence'
    ],
    voiceGuidelines: 'Show compassion for pets and owners. Balance medical expertise with emotional support.'
  },
  'Dyrepension': {
    category: 'Dyrepension',
    tone: 'Caring, playful, reliable, and loving',
    characteristics: [
      'Pet-loving',
      'Safety-focused',
      'Fun and engaging',
      'Peace of mind for owners'
    ],
    voiceGuidelines: 'Show genuine love for animals. Emphasize safety, care, and fun.'
  },

  // Education & Childcare
  'Børnehave': {
    category: 'Børnehave',
    tone: 'Warm, nurturing, playful, and professional',
    characteristics: [
      'Child development focused',
      'Safe and caring',
      'Educational and fun',
      'Parent partnership'
    ],
    voiceGuidelines: 'Be warm and reassuring to parents. Emphasize development, safety, and care.'
  },
  'Skole': {
    category: 'Skole',
    tone: 'Professional, supportive, educational, and caring',
    characteristics: [
      'Learning-focused',
      'Student development',
      'Community-oriented',
      'Clear communication'
    ],
    voiceGuidelines: 'Balance professionalism with warmth. Focus on learning and student success.'
  },

  // Automotive
  'Autoværksted': {
    category: 'Autoværksted',
    tone: 'Reliable, knowledgeable, honest, and straightforward',
    characteristics: [
      'Technical expertise',
      'Transparent pricing',
      'Dependable service',
      'Customer education'
    ],
    voiceGuidelines: 'Be straightforward and honest. Emphasize reliability and expertise.'
  },
  'Bilforhandler': {
    category: 'Bilforhandler',
    tone: 'Professional, helpful, knowledgeable, and trustworthy',
    characteristics: [
      'Product expertise',
      'Customer needs focused',
      'Transparent and fair',
      'Service-oriented'
    ],
    voiceGuidelines: 'Be helpful without being pushy. Focus on matching customer needs with solutions.'
  },

  // Default fallback for unknown categories
  'Default': {
    category: 'Default',
    tone: 'Friendly, simple, local and professional',
    characteristics: [],
    voiceGuidelines: 'Use natural, direct language. Focus on service and relationships.',
    hashtags: {
      core: ['local', 'localbusiness'],
      generic: ['supportlocal', 'service', 'quality', 'smallbusiness', 'community']
    }
  }
}

export const TONE_CARDS_DA: Record<string, ToneCard> = {
  // Food & Beverage
  'Café': {
    category: 'Café',
    tone: 'Hyggelig, afslappet, varm og uformel',
    characteristics: [],
    voiceGuidelines: 'Brug jordnære ord, enkel humor og nærvær. Fokus på stemning, hygge og små hverdagsøjeblikke.',
    hashtags: {
      shared: ['café', 'brunch'],
      instagramOnly: ['kaffe', 'kaffehygge', 'morgenmad', 'brunch', 'frokost', 'hygge', 'lokalcafé', 'coffee', 'coffeetime'],
      branded: '{businessName}'
    }
  },
  'Restaurant': {
    category: 'Restaurant',
    tone: 'Indbydende, appetitvækkende, professionel',
    characteristics: [],
    voiceGuidelines: 'Fremhæv smag, håndværk og detaljer. Brug et roligt, selvsikkert sprog.',
    hashtags: {
      core: ['restaurant', 'madoplevelse', 'dining', 'spisestedet'],
      generic: ['mad', 'food', 'foodie', 'madglæde', 'frokost', 'middag', 'lokalrestaurant']
    }
  },
  'Bageri': {
    category: 'Bageri',
    tone: 'Frisk, hjemlig, varm og traditionel',
    characteristics: [],
    voiceGuidelines: 'Fokus på duft, friskhed og håndværk. Brug sanseligt og imødekommende sprog.',
    hashtags: {
      core: ['bageri', 'nybagt', 'håndværksbageri', 'brød'],
      generic: ['morgenmad', 'friskbagt', 'wienerbrød', 'kage', 'bakery']
    }
  },
  'Bar': {
    category: 'Bar',
    tone: 'Livlig, social, energisk og uformel',
    characteristics: [],
    voiceGuidelines: 'Brug let humor og festlig tone. Fokus på stemning, selskab og "kom forbi"-energi.',
    hashtags: {
      core: ['bar', 'cocktails', 'drinks', 'natteliv'],
      generic: ['skål', 'happyhour', 'weekend', 'fredagsbar', 'hygge']
    }
  },

  // Health & Wellness
  'Frisør': {
    category: 'Frisør',
    tone: 'Professionel, kreativ, personlig og omsorgsfuld',
    characteristics: [],
    voiceGuidelines: 'Fokus på rådgivning og forvandling. Brug varm, motiverende tone.',
    hashtags: {
      core: ['frisør', 'salon', 'hairstylist', 'hår'],
      generic: ['frisure', 'beauty', 'klipning', 'hårfarve', 'forogefter', 'hairstyle']
    }
  },
  'Skønhedsklinik': {
    category: 'Skønhedsklinik',
    tone: 'Rolig, tryg, kompetent og indbydende',
    characteristics: [],
    voiceGuidelines: 'Brug blide ord og fokus på resultater. Ingen salgspres — kun ro, kvalitet og omsorg.',
    hashtags: {
      core: ['skønhedsklinik', 'beauty', 'hudpleje', 'skincare'],
      generic: ['selvforkælelse', 'wellness', 'skønhed', 'ansigtsbehandling', 'glowingskin']
    }
  },
  'Spa': {
    category: 'Spa',
    tone: 'Afslappende, luksuriøs, blid og fornyende',
    characteristics: [],
    voiceGuidelines: 'Roligt tempo. Fokus på velvære, pauser og selvforkælelse.',
    hashtags: {
      core: ['spa', 'wellness', 'afslapning', 'velvære'],
      generic: ['selvforkælelse', 'massage', 'relax', 'selfcare', 'wellbeing']
    }
  },
  'Fitness': {
    category: 'Fitness',
    tone: 'Motiverende, energisk, støttende og positiv',
    characteristics: [],
    voiceGuidelines: 'Kort, direkte og opmuntrende. Fokus på fremskridt og fællesskab.',
    hashtags: {
      core: ['fitness', 'træning', 'workout', 'fitnesscenter'],
      generic: ['sundhed', 'motivation', 'styrke', 'health', 'gym', 'fitfam']
    }
  },
  'Yoga': {
    category: 'Yoga',
    tone: 'Rolig, balanceret, mindful og varm',
    characteristics: [],
    voiceGuidelines: 'Brug blide ord og et roligt flow. Fokus på nærvær og udvikling.'
  },

  // Retail
  'Tøjbutik': {
    category: 'Tøjbutik',
    tone: 'Stilet, moderne, personlig og selvsikker',
    characteristics: [],
    voiceGuidelines: 'Inspirerende og smagfuld tone. Fokus på udtryk, stil og selvtillid.'
  },
  'Butik': {
    category: 'Butik',
    tone: 'Venlig, hjælpsom, nærværende og lokal',
    characteristics: [],
    voiceGuidelines: 'Brug enkel, menneskelig kommunikation. Fokus på service, udvalg og lokale vibes.'
  },
  'Boghandel': {
    category: 'Boghandel',
    tone: 'Eftertænksom, varm, nørdet og inviterende',
    characteristics: [],
    voiceGuidelines: 'Brug blide ord og passion for bøger. Fokus på oplevelse, inspiration og anbefalinger.'
  },

  // Professional Services
  'Advokat': {
    category: 'Advokat',
    tone: 'Klar, faglig, autoritativ og rolig',
    characteristics: [],
    voiceGuidelines: 'Brug præcist og sobert sprog. Ingen overdrivelser.'
  },
  'Revisor': {
    category: 'Revisor',
    tone: 'Troværdig, præcis, professionel og klar',
    characteristics: [],
    voiceGuidelines: 'Brug struktureret og nøgtern stil. Fokus på sikkerhed og overblik.'
  },
  'Konsulent': {
    category: 'Konsulent',
    tone: 'Strategisk, hjælpsom, faglig og indsigtsfuld',
    characteristics: [],
    voiceGuidelines: 'Brug løsningsorienteret sprog. Fokus på værdi og resultater.'
  },

  // Home & Services
  'Ejendomsmægler': {
    category: 'Ejendomsmægler',
    tone: 'Professionel, troværdig, imødekommende og hjælpsom',
    characteristics: [],
    voiceGuidelines: 'Brug varme ord og god struktur. Fokus på tryghed, hjem og muligheder.'
  },
  'Håndværker': {
    category: 'Håndværker',
    tone: 'Direkte, ærlig, pålidelig og jordnær',
    characteristics: [],
    voiceGuidelines: 'Kort og no-nonsense. Fokus på kvalitet og løsning.'
  },
  'Rengøring': {
    category: 'Rengøring',
    tone: 'Grundig, rolig, troværdig og respektfuld',
    characteristics: [],
    voiceGuidelines: 'Brug klare, enkle sætninger. Fokus på tryghed og grundighed.'
  },

  // Creative & Events
  'Fotograf': {
    category: 'Fotograf',
    tone: 'Kreativ, kunstnerisk, personlig og professionel',
    characteristics: [],
    voiceGuidelines: 'Brug sanselige, visuelle beskrivelser. Fokus på øjeblikke, stemning og mennesker.'
  },
  'Eventbureau': {
    category: 'Eventbureau',
    tone: 'Kreativ, energisk, professionel og struktureret',
    characteristics: [],
    voiceGuidelines: 'Balancer farverig energi med klarhed. Fokus på oplevelser og planlægning.'
  },

  // Pet Services
  'Dyrlæge': {
    category: 'Dyrlæge',
    tone: 'Omsorgsfuld, faglig, rolig og empatisk',
    characteristics: [],
    voiceGuidelines: 'Brug blide, støttende ord. Fokus på tryghed og ekspertise.'
  },
  'Dyrepension': {
    category: 'Dyrepension',
    tone: 'Kærlig, legende, omsorgsfuld og tillidsfuld',
    characteristics: [],
    voiceGuidelines: 'Brug varme, kærlige ord. Fokus på tryghed og sjov.'
  },

  // Education & Childcare
  'Børnehave': {
    category: 'Børnehave',
    tone: 'Varm, legende, nænsom og professionel',
    characteristics: [],
    voiceGuidelines: 'Ret dig til forældre. Brug blide ord og fokus på udvikling og trivsel.'
  },
  'Skole': {
    category: 'Skole',
    tone: 'Støttende, tydelig, engagerende og professionel',
    characteristics: [],
    voiceGuidelines: 'Brug klar og positiv tone. Fokus på læring og fællesskab.'
  },

  // Automotive
  'Autoværksted': {
    category: 'Autoværksted',
    tone: 'Ærlig, ligefrem, pålidelig og hjælpsom',
    characteristics: [],
    voiceGuidelines: 'Kort og praktisk kommunikation. Fokus på kvalitet og tryghed.'
  },
  'Bilforhandler': {
    category: 'Bilforhandler',
    tone: 'Hjælpsom, troværdig, professionel og imødekommende',
    characteristics: [],
    voiceGuidelines: 'Undgå salgspres. Fokus på rådgivning og match af behov.'
  },

  // Default fallback for unknown categories
  'Default': {
    category: 'Default',
    tone: 'Venlig, enkel, lokal og professionel',
    characteristics: [],
    voiceGuidelines: 'Brug naturligt, direkte dansk. Fokus på service og relationer.',
    hashtags: {
      core: ['lokal', 'lokalforretning'],
      generic: ['støtlokalt', 'service', 'kvalitet', 'local', 'localbusiness']
    }
  }
}

/**
 * Get tone card for a specific business category
 */
export function getToneCard(category: string, language: string = 'en'): ToneCard | null {
  const normalized = (language || 'en').toLowerCase()
  const languageCode = normalized.split('-')[0]
  const toneCards = languageCode === 'da'
    ? TONE_CARDS_DA
    : languageCode === 'sv'
      ? TONE_CARDS_DA
      : TONE_CARDS_EN
  return toneCards[category] || null
}

/**
 * Get tone description for use in AI prompts
 * Always returns a tone description - uses category-specific tone if available,
 * otherwise returns a generic professional fallback
 */
export function getToneDescription(category: string, language: string = 'en'): string {
  const normalized = (language || 'en').toLowerCase()
  const languageCode = normalized.split('-')[0]
  const toneCard = getToneCard(category, languageCode)
  if (!toneCard) {
    // Fallback tone for unknown categories
    if (languageCode === 'da') {
      return 'Tone: Venlig, enkel, lokal og professionel.\nSkrivestil: Brug naturligt, direkte dansk. Fokus på service og relationer.'
    }
    if (languageCode === 'sv') {
      return 'Ton: Vänlig, enkel, lokal och professionell.\nSkrivstil: Använd naturlig, tydlig svenska med fokus på service och relationer.'
    }
    return 'Tone: Friendly, simple, local and professional.\nWriting style: Use natural, direct language. Focus on service and relationships.'
  }

  const toneLabel = languageCode === 'sv' ? 'Ton' : 'Tone'
  const styleLabel = languageCode === 'da' ? 'Skrivestil' : languageCode === 'sv' ? 'Skrivstil' : 'Voice'

  return `${toneLabel}: ${toneCard.tone}\n${styleLabel}: ${toneCard.voiceGuidelines}`
}

function renderHashtagSample(tag: string): string | null {
  if (!tag) {
    return null
  }

  const cleaned = tag.replace(/^#+/, '')
  const sanitized = sanitizeForHashtagValue(cleaned)

  if (!sanitized) {
    return null
  }

  return `#${sanitized}`
}

function buildLocationExample(businessProfile: any, category: string, language: string): string {
  const normalized = (language || 'en').toLowerCase()
  const languageCode = normalized.split('-')[0]
  const cityCandidate = typeof businessProfile?.city === 'string' ? businessProfile.city : null
  const regionCandidate = typeof businessProfile?.region === 'string' ? businessProfile.region : null
  const addressCandidate = typeof businessProfile?.address === 'string' ? businessProfile.address.split(',')[0] : null

  const locationSlug = sanitizeForHashtagValue(cityCandidate || regionCandidate || addressCandidate)
  const categorySlug = sanitizeForHashtagValue(category || '') || (languageCode === 'da' ? 'virksomhed' : languageCode === 'sv' ? 'foretag' : 'business')

  if (locationSlug) {
    return `#${locationSlug}${categorySlug}`
  }

  if (languageCode === 'da') {
    return '#{by}{kategori}'
  }
  if (languageCode === 'sv') {
    return '#{stad}{kategori}'
  }
  return '#{city}{category}'
}

function buildBrandedSample(
  brandedTemplate: string | undefined,
  businessProfile: any,
  language: string
): { sample: string; placeholderUsed: boolean } {
  const normalized = (language || 'en').toLowerCase()
  const languageCode = normalized.split('-')[0]
  const fallbackName = languageCode === 'da' ? 'dinvirksomhed' : languageCode === 'sv' ? 'dittforetag' : 'yourbusiness'
  const businessSlug = sanitizeForHashtagValue(businessProfile?.business_name) || fallbackName

  if (!brandedTemplate) {
    return {
      sample: `#${businessSlug}`,
      placeholderUsed: false,
    }
  }

  const replaced = brandedTemplate.replace('{businessName}', businessSlug)
  const sanitized = sanitizeForHashtagValue(replaced)

  if (!sanitized) {
    return {
      sample: `#${businessSlug}`,
      placeholderUsed: brandedTemplate.includes('{businessName}')
    }
  }

  return {
    sample: `#${sanitized}`,
    placeholderUsed: brandedTemplate.includes('{businessName}')
  }
}

function formatHashtagList(list: string[]): string {
  const formatted = list
    .map(renderHashtagSample)
    .filter((value): value is string => Boolean(value))

  return formatted.join(', ')
}

/**
 * Get hashtag guidance text for AI prompts
 * Provides business-specific hashtag suggestions to guide AI selection
 */
export function getHashtagGuidance(
  category: string,
  language: string = 'en',
  businessProfile: any = null
): string {
  const normalized = (language || 'en').toLowerCase()
  const languageCode = normalized.split('-')[0]
  const plan = getHashtagPlan(category, languageCode)
  const sharedLine = formatHashtagList(plan.shared)
  const instagramLine = formatHashtagList(plan.instagramOnly)
  const seasonalLine = formatHashtagList(plan.seasonal)
  const locationExample = buildLocationExample(businessProfile, category, languageCode)
  const { sample: brandedSample, placeholderUsed } = buildBrandedSample(plan.branded, businessProfile, languageCode)
  const businessSlug = sanitizeForHashtagValue(businessProfile?.business_name)

  if (languageCode === 'da') {
    const businessNameHint = businessSlug || 'dinvirksomhed'
    const brandedInstruction = placeholderUsed
      ? `${brandedSample} (erstat {businessName} med ${businessNameHint} uden mellemrum eller specialtegn.)`
      : `${brandedSample} (brug firmanavnet, fx ${businessNameHint}, uden mellemrum eller specialtegn.)`

    return `HASHTAG-PLAN (${category}):
Delte hashtags (brug først på både Facebook og Instagram): ${sharedLine || '#lokal, #lokalforretning'}
Instagram (kun Instagram efter de delte): ${instagramLine || 'Tilføj hashtags, der beskriver retten/servicen i opslaget.'}${seasonalLine ? `
Sæson (kun når relevant på Instagram): ${seasonalLine}` : ''}

Lokations-hashtag: ${locationExample} (by + kategori uden mellemrum. Spring over, hvis lokationen er ukendt.)
Branded hashtag: ${brandedInstruction}

Totaler:
- Facebook: 2-3 hashtags (kun de delte + evt. lokation, hvis der stadig max er 3).
- Instagram: 10-15 hashtags (delte + Instagram-kun + lokation + branded + 1-2 tags fra selve teksten).

Prioritér hashtags, der matcher indholdet (retter, services, events) og undgå irrelevante eller opfundne ord.`
  }

  if (languageCode === 'sv') {
    const businessNameHint = businessSlug || 'dittforetag'
    const brandedInstruction = placeholderUsed
      ? `${brandedSample} (ersätt {businessName} med ${businessNameHint} utan mellanslag eller specialtecken.)`
      : `${brandedSample} (använd företagsnamnet, t.ex. ${businessNameHint}, utan mellanslag eller specialtecken.)`

    return `HASHTAG-PLAN (${category}):
Delade hashtags (använd först på både Facebook och Instagram): ${sharedLine || '#lokalt, #lokalforetag'}
Instagram (endast Instagram efter de delade): ${instagramLine || 'Lägg till hashtags som beskriver rätten/tjänsten i inlägget.'}${seasonalLine ? `
Säsong (endast när relevant på Instagram): ${seasonalLine}` : ''}

Plats-hashtag: ${locationExample} (stad + kategori utan mellanslag. Hoppa över om plats saknas.)
Varumärkeshashtag: ${brandedInstruction}

Totalt:
- Facebook: 2-3 hashtags (endast de delade + ev. plats så länge max är 3).
- Instagram: 10-15 hashtags (delade + Instagram-only + plats + varumärke + 1-2 taggar från texten).

Prioritera hashtags som matchar innehållet (rätter, tjänster, evenemang) och undvik irrelevanta eller påhittade ord.`
  }

  const businessNameHint = businessSlug || 'yourbusiness'
  const brandedInstruction = placeholderUsed
    ? `${brandedSample} (replace {businessName} with ${businessNameHint} and remove spaces/symbols.)`
    : `${brandedSample} (use the business name, e.g., ${businessNameHint}, with no spaces or symbols.)`

  return `HASHTAG PLAN (${category}):
Shared hashtags (use first on Facebook & Instagram): ${sharedLine || '#local, #localbusiness'}
Instagram-only suggestions (after the shared hashtags): ${instagramLine || 'Add hashtags that describe the actual items/services mentioned.'}${seasonalLine ? `
Seasonal options (Instagram only when relevant): ${seasonalLine}` : ''}

Location hashtag: ${locationExample} (city + category, no spaces. Skip if the location is unknown.)
Branded hashtag: ${brandedInstruction}

Totals:
- Facebook: 2-3 hashtags (shared only, optionally add the location tag if it still keeps the total ≤3).
- Instagram: 10-15 hashtags (shared + Instagram-only + location + branded + 1-2 tags directly from the text).

Always prioritise hashtags that reflect the real content (dishes, services, events) and avoid irrelevant or invented terms.`

  }

/**
 * Get all available categories
 */
export function getAllCategories(): string[] {
  return Object.keys(TONE_CARDS_EN)
}
