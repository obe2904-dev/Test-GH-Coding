import { type Season } from '../../tone-cards.ts'

export const INTENT_GROUPS: string[][] = [
  ['cafe', 'café', 'coffeeshop', 'coffeehouse', 'kaffebar', 'cafebar'],
  ['burger', 'burgers', 'burgerbar', 'burgerrestaurant', 'burgermenu', 'burgermeny'],
  ['pizza', 'pizzas', 'pizzamenu', 'pizzarestaurant'],
  ['brunch', 'breakfast'],
  ['pommesfrites', 'pommes', 'fritter', 'fries', 'frenchfries', 'grovepommesfrites', 'sprødepommes', 'sprødepommesfrites', 'crispyfries']
]

export const BANNED_GENERIC_HASHTAG_KEYS = new Set<string>([
  'love',
  'happy',
  'photo',
  'follow4follow',
  'like4like',
  'komforbi',
  'nyd',
  'klar',
  'laekre',
  'laekker',
  'laekkert',
  'nydlaekre',
  'nydlaekker',
  'nydlaekkert',
  'lokal',
  'lokalt',
  'lokale',
  'stoetlokalt',
  'supportlokalt',
  'lokalforretning',
  'supportlocal',
  'localbusiness',
  'supportsmallbusiness',
  'supportlocalbusiness',
  'localbusinesssupport',
  'localshop',
  'community',
  'smallbusiness',
  'shoplocal',
  'kvalitet',
  'godservice',
  'lokalstolt',
  'faellesskab',
  'forkael',
  'forkaelelse',
  'saftig',
  'saftige',
  'saftigt'
])

export const WEAK_CONTEXT_KEYWORDS = new Set<string>([
  'dagens',
  'friske',
  'frisk',
  'serveret',
  'serverede',
  'saeson',
  'saesonen',
  'saesonens',
  'hjertet',
  'velkommen',
  'glaeder',
  'glader',
  'klar',
  'nyd'
])

export const FACEBOOK_CONCEPT_KEYWORDS: string[] = [
  'lokal',
  'lokalt',
  'lokale',
  'local',
  'localbusiness',
  'støtlokalt',
  'supportlocal',
  'community',
  'lokalforretning',
  'smallbusiness',
  'shoplocal',
  'supportsmallbusiness',
  'supportlocalbusiness',
  'localbusinesssupport',
  'localshop'
]

export const PROMPT_EXCLUDED_HASHTAG_KEYS = new Set<string>([
  'lokal',
  'lokalt',
  'lokale',
  'lokalforretning',
  'stoetlokalt',
  'supportlokalt',
  'local',
  'localbusiness',
  'supportlocal',
  'supportsmallbusiness',
  'supportlocalbusiness',
  'localbusinesssupport',
  'localshop',
  'community',
  'smallbusiness',
  'shoplocal',
  'kvalitet',
  'godservice',
  'lokalstolt',
  'faellesskab',
  'komforbi',
  'nyd',
  'klar',
  'laekre',
  'laekker',
  'laekkert',
  'nydlaekre',
  'nydlaekker',
  'nydlaekkert',
  'forkael',
  'forkaelelse',
  'saftig',
  'saftige',
  'saftigt'
])

export const SEASON_KEYWORD_MAP: Record<Season, string[]> = {
  winter: ['winter', 'vinter', 'jul', 'christmas', 'snow', 'nytar', 'newyear'],
  spring: ['spring', 'foraar', 'forar', 'easter', 'paaske', 'bloom'],
  summer: ['summer', 'sommer', 'sun', 'beach', 'grill', 'sommerferie'],
  autumn: ['autumn', 'efteraar', 'efterar', 'fall', 'harvest', 'halloween']
}

export const SEASONAL_CONTEXT_KEYWORDS: Record<string, string[]> = {
  julemenu: ['jul', 'jule', 'christmas', 'nytaar', 'nytar', 'newyear', 'december'],
  vinterhygge: ['vinter', 'winter', 'kulde', 'frost', 'sne', 'snow'],
  foraarstemning: ['foraar', 'forar', 'spring', 'april', 'maj', 'blomst', 'blomster'],
  sommerhygge: ['sommer', 'summer', 'sol', 'strand', 'beach', 'varme', 'grill'],
  iskaffe: ['kaffe', 'coffee', 'iced', 'iskold', 'iste', 'coldbrew'],
  efteraarshygge: ['efteraar', 'efterar', 'autumn', 'fall', 'oktober', 'november'],
  vintertilbud: ['tilbud', 'rabat', 'rabatter', 'rabatt', 'discount', 'udsalg']
}

export const GENERIC_CATEGORY_KEYWORDS = new Set<string>([
  'cafe', 'café', 'kaffebar',
  'restaurant', 'restaurang',
  'bar', 'pub',
  'bageri', 'bakery',
  'sushi', 'sushibar',
  'burger', 'burgerbar',
  'pizza', 'pizzeria',
  'bistro', 'brasserie',
  'grill', 'steakhouse',
  'diner', 'eatery',
  'food', 'mad', 'dining'
])
