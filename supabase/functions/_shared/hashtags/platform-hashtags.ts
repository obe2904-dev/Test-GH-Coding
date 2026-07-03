export interface PlatformHashtagContext {
  city?: string | null
  businessName?: string | null
  businessCharacter?: string | null
  vertical?: string | null
  contentType?: string | null
  extractedKeyword?: string | null
  text?: string | null
  detectedDishName?: string | null
  detectedDishDescription?: string | null
  locationVocabulary?: string[] | null  // FIX 03-B: Location-specific hashtag vocabulary
  language?: string | null              // Language code (da, sv, de, en) for localized hashtags
  // FIX 04: Stable business-profile signals for venue classification
  aiPlaceSynopsis?: string | null      // e.g. "Korean BBQ and sushi restaurant in central Silkeborg"
  menuDescription?: string | null      // e.g. "Korean-inspired fusion with AYCE options"
}

export interface PlatformHashtagSets {
  facebook: string[]
  instagram: string[]
}

type HashtagLayerName =
  | 'local'
  | 'product'
  | 'category'
  | 'lifestyle'
  | 'brand'
  | 'occasion'
  | 'dietary'
  | 'campaign'
  | 'community'

// Localized hashtags based on language
interface LocalizedHashtags {
  coffeeLovers: string
  brunchTime: string
  drinkLovers: string
  lunchBreak: string
  dateNight: string
  cozyCafe: string
  foodLovers: string
  weekendBrunch: string
  fridayDrinks: string
  summerDrinks: string
  christmasMenu: string
  newMenu: string
  veganFood: string
  vegetarianFood: string
  glutenFree: string
  plantBased: string
  healthyLunch: string
  summerMenu: string
  brunchLaunch: string
  coffeeDeal: string
  tasteAndWin: string
  drinkLocal: string
  eatLocal: string
  supportLocal: string
}

function getLocalizedHashtags(language: string): LocalizedHashtags {
  switch (language) {
    case 'da':  // Danish
      return {
        coffeeLovers: 'KaffeElskere',
        brunchTime: 'BrunchTid',
        drinkLovers: 'DrinksElskere',
        lunchBreak: 'Frokostpause',
        dateNight: 'DateNat',
        cozyCafe: 'HyggeligCafe',
        foodLovers: 'MadElskere',
        weekendBrunch: 'WeekendBrunch',
        fridayDrinks: 'FredagsDrinks',
        summerDrinks: 'SommerDrinks',
        christmasMenu: 'Julemenu',
        newMenu: 'NytMenukort',
        veganFood: 'VeganskMad',
        vegetarianFood: 'VegetariskMad',
        glutenFree: 'Glutenfri',
        plantBased: 'Plantebaseret',
        healthyLunch: 'SundFrokost',
        summerMenu: 'Sommermenu',
        brunchLaunch: 'NytBrunchkort',
        coffeeDeal: 'KaffeTilbud',
        tasteAndWin: 'SmagOgVind',
        drinkLocal: 'DrikLokalt',
        eatLocal: 'SpisLokalt',
        supportLocal: 'StøtLokalt',
      }
    case 'sv':  // Swedish
      return {
        coffeeLovers: 'KaffeÄlskare',
        brunchTime: 'BrunchDags',
        drinkLovers: 'DrinksÄlskare',
        lunchBreak: 'Lunchpaus',
        dateNight: 'DateKväll',
        cozyCafe: 'MysKafé',
        foodLovers: 'MatÄlskare',
        weekendBrunch: 'HelgBrunch',
        fridayDrinks: 'FredagsDrinks',
        summerDrinks: 'SommarDrinks',
        christmasMenu: 'Julmeny',
        newMenu: 'NyMeny',
        veganFood: 'VeganMat',
        vegetarianFood: 'VegetariskMat',
        glutenFree: 'Glutenfri',
        plantBased: 'Växtbaserad',
        healthyLunch: 'NyttigLunch',
        summerMenu: 'Sommarmeny',
        brunchLaunch: 'NyBrunchmeny',
        coffeeDeal: 'KaffeErbjudande',
        tasteAndWin: 'SmakaOchVinn',
        drinkLocal: 'DrickLokalt',
        eatLocal: 'ÄtLokalt',
        supportLocal: 'StödLokalt',
      }
    case 'de':  // German
      return {
        coffeeLovers: 'KaffeeLovers',
        brunchTime: 'BrunchZeit',
        drinkLovers: 'DrinkLovers',
        lunchBreak: 'Mittagspause',
        dateNight: 'DateNight',
        cozyCafe: 'GemütlichesCafé',
        foodLovers: 'EssensLovers',
        weekendBrunch: 'WochenendBrunch',
        fridayDrinks: 'FreitagDrinks',
        summerDrinks: 'SommerDrinks',
        christmasMenu: 'Weihnachtsmenü',
        newMenu: 'NeueSpeisekarte',
        veganFood: 'VeganesEssen',
        vegetarianFood: 'VegetarischesEssen',
        glutenFree: 'Glutenfrei',
        plantBased: 'Pflanzenbasiert',
        healthyLunch: 'GesunderLunch',
        summerMenu: 'Sommermenü',
        brunchLaunch: 'NeueBrunchkarte',
        coffeeDeal: 'KaffeeAngebot',
        tasteAndWin: 'SchmeckenUndGewinnen',
        drinkLocal: 'TrinkenLokal',
        eatLocal: 'EssenLokal',
        supportLocal: 'UnterstützenLokal',
      }
    default:  // English fallback
      return {
        coffeeLovers: 'CoffeeLovers',
        brunchTime: 'BrunchTime',
        drinkLovers: 'DrinkLovers',
        lunchBreak: 'LunchBreak',
        dateNight: 'DateNight',
        cozyCafe: 'CozyCafe',
        foodLovers: 'FoodLovers',
        weekendBrunch: 'WeekendBrunch',
        fridayDrinks: 'FridayDrinks',
        summerDrinks: 'SummerDrinks',
        christmasMenu: 'ChristmasMenu',
        newMenu: 'NewMenu',
        veganFood: 'VeganFood',
        vegetarianFood: 'VegetarianFood',
        glutenFree: 'GlutenFree',
        plantBased: 'PlantBased',
        healthyLunch: 'HealthyLunch',
        summerMenu: 'SummerMenu',
        brunchLaunch: 'BrunchLaunch',
        coffeeDeal: 'CoffeeDeal',
        tasteAndWin: 'TasteAndWin',
        drinkLocal: 'DrinkLocal',
        eatLocal: 'EatLocal',
        supportLocal: 'SupportLocal',
      }
  }
}

// FIX 03-B: Updated platform limits to support ranges (FB: 0-2, IG: 3-5)
const PLATFORM_LIMITS: Record<'facebook' | 'instagram', { min: number; max: number }> = {
  facebook: { min: 0, max: 2 },
  instagram: { min: 3, max: 5 },
}

function toPascalTag(input: string): string {
  const cleaned = input
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

  if (!cleaned) return ''

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function compactTag(...parts: Array<string | null | undefined>): string {
  return toPascalTag(parts.filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(' '))
}

function pushUnique(target: string[], value: string | undefined | null): void {
  if (!value) return
  const clean = value.trim()
  if (!clean) return
  if (!target.some(existing => existing.toLowerCase() === clean.toLowerCase())) {
    target.push(clean)
  }
}

function inferVenueCategory(context: PlatformHashtagContext): string {
  // FIX 04: This classifies the VENUE, not the post content.
  // Post text and contentType are intentionally excluded — scanning post text causes
  // food keyword bleed (e.g. "pandekager" in post → Bakery classification on K-BBQ restaurant).
  // aiPlaceSynopsis and menuDescription are stable business-level signals.
  const haystack = [
    context.vertical,
    context.businessCharacter,
    context.businessName,
    context.aiPlaceSynopsis,
    context.menuDescription,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  // Order matters: more specific signals first
  if (/(bakery|bageri|bager|wienerbrød|konditori)/i.test(haystack)) return 'Bakery'
  if (/(bar|cocktail|wine bar|vinbar|drinks?|spirit|øl|beer)/i.test(haystack)) return 'Bar'
  if (/(coffee|cafe|café|espresso|latte|barista|filterkaffe|kaffebar)/i.test(haystack)) return 'Cafe'
  if (/(food truck|street food|foodtruck)/i.test(haystack)) return 'FoodTruck'
  if (/(takeaway|to go|udbring|afhent)/i.test(haystack)) return 'Takeaway'
  // All restaurant types — aiPlaceSynopsis naturally contains cuisine type
  if (/(restaurant|spisested|køkken|menu|diner|bbq|sushi|thai|vietnamese|pho|indian|curry|chinese|wok|korean|koreansk|asian|asiatisk|fusion|tapas|bistro)/i.test(haystack)) return 'Restaurant'

  return 'Restaurant'  // Safe default — never Cafe for unknown venues
}

function inferProductTag(context: PlatformHashtagContext): string {
  const candidate = [context.extractedKeyword, context.detectedDishName, context.businessName]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0)

  return candidate ? toPascalTag(candidate) : ''
}

function inferLifestyleTag(context: PlatformHashtagContext, categoryTag: string): string {
  const text = [context.text, context.detectedDishDescription]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const lang = context.language || 'da'
  const tags = getLocalizedHashtags(lang)

  // Coffee: only if the post itself is about coffee
  if (/(coffee|cafe|café|espresso|latte|cappuccino|cortado|filterkaffe|kaffebar)/.test(text)) return tags.coffeeLovers
  
  // Brunch: only if post mentions it
  if (/(brunch|morgenmad)/.test(text)) return tags.brunchTime
  
  // Drinks: only if post mentions it
  if (/(cocktail|drinks?|vin|øl|beer|bar)/.test(text)) return tags.drinkLovers
  
  // Meal occasions: only if post mentions them
  if (/(lunch|frokost)/.test(text)) return tags.lunchBreak
  if (/(dinner|aftensmad)/.test(text) && /(date|par|romantisk)/.test(text)) return tags.dateNight
  if (/(cozy|hygg|warm|varm|indendørs|inside)/.test(text)) return tags.cozyCafe

  // Food in general — only if food words appear in the post
  if (/(food|mad|dish|ret|menu|meal|måltid|smag|serverer)/.test(text)) return tags.foodLovers

  // IMPORTANT: no venue-category fallback here.
  // A café posting about a concert or an event should NOT get #CoffeeLovers.
  return ''
}

function inferOccasionTag(context: PlatformHashtagContext): string {
  const text = [context.text, context.detectedDishDescription].filter(Boolean).join(' ').toLowerCase()

  const lang = context.language || 'da'
  const tags = getLocalizedHashtags(lang)

  if (/(weekend|lørdag|saturday|søndag|sunday)/.test(text) && /(brunch|morgenmad)/.test(text)) return tags.weekendBrunch
  if (/(friday|fredag)/.test(text) && /(drink|drinks|cocktail|bar|vin|øl|beer)/.test(text)) return tags.fridayDrinks
  if (/(lunch|frokost)/.test(text)) return tags.lunchBreak
  if (/(date night|datenight|aften)/.test(text)) return tags.dateNight
  if (/(summer|sommer)/.test(text) && /(drink|drinks|cocktail|bar)/.test(text)) return tags.summerDrinks
  if (/(christmas|jul|jule)/.test(text)) return tags.christmasMenu
  if (/(new menu|newmenu|ny menu|lan(?:c|)ering|launch)/.test(text)) return tags.newMenu

  return ''
}

function inferDietaryTag(context: PlatformHashtagContext): string {
  const text = [context.text, context.detectedDishDescription].filter(Boolean).join(' ').toLowerCase()

  const lang = context.language || 'da'
  const tags = getLocalizedHashtags(lang)

  if (/(vegan|vegansk)/.test(text)) return tags.veganFood
  if (/(vegetarian|vegetarisk)/.test(text)) return tags.vegetarianFood
  if (/(glutenfri|gluten free|glutenfree)/.test(text)) return tags.glutenFree
  if (/(plant based|plantebaseret|plantebaseret)/.test(text)) return tags.plantBased
  if (/(healthy|sund|sundt)/.test(text)) return tags.healthyLunch

  return ''
}

function inferCampaignTag(context: PlatformHashtagContext): string {
  const text = [context.text, context.detectedDishDescription].filter(Boolean).join(' ').toLowerCase()

  const lang = context.language || 'da'
  const tags = getLocalizedHashtags(lang)

  if (/(new menu|ny menu|menu launch|launch|introducing|introduktion)/.test(text)) return tags.newMenu
  if (/(summer menu|sommermenu)/.test(text)) return tags.summerMenu
  if (/(brunch launch|brunchmenu)/.test(text)) return tags.brunchLaunch
  if (/(coffee deal|kaffe tilbud|tilbud)/.test(text)) return tags.coffeeDeal
  if (/(win|konkurrence|competition|taste and win)/.test(text)) return tags.tasteAndWin

  return ''
}

function inferCommunityTag(context: PlatformHashtagContext): string {
  const lang = context.language || 'da'
  const tags = getLocalizedHashtags(lang)
  const category = inferVenueCategory(context)
  if (category === 'Bar') return tags.drinkLocal
  if (category === 'Cafe' || category === 'Restaurant' || category === 'Bakery') return tags.eatLocal
  return tags.supportLocal
}

function buildLayers(context: PlatformHashtagContext): Record<HashtagLayerName, string[]> {
  const cityTag = context.city ? toPascalTag(context.city) : ''
  const categoryTag = inferVenueCategory(context)
  
  // FIX 03-B: Use location vocabulary if available, otherwise fall back to city+category
  const locationVocabTags = context.locationVocabulary
    ? context.locationVocabulary
        .slice(0, 3)  // Max 3 location-specific tags
        .map(vocab => toPascalTag(vocab))
        .filter(Boolean)
    : [];
  
  // FIX 04: localPrimary should be plain city or first vocab word — never city+category compound
  const localPrimary = locationVocabTags.length > 0
    ? locationVocabTags[0]
    : cityTag  // plain city only (#Silkeborg, not #SilkeborgRestaurant)
  
  // localSecondary: second vocab word, or plain city if vocab has only one word
  // This ensures businesses WITH locationVocabulary still get city as second local tag
  const localSecondary = locationVocabTags.length > 1
    ? locationVocabTags[1]
    : locationVocabTags.length === 1 && cityTag !== locationVocabTags[0]
      ? cityTag
      : ''
  
  const localTertiary = locationVocabTags.length > 2 ? locationVocabTags[2] : ''
  
  const productTag = inferProductTag(context)
  const lifestyleTag = inferLifestyleTag(context, categoryTag)
  const brandTag = context.businessName ? toPascalTag(context.businessName) : ''
  const occasionTag = inferOccasionTag(context)
  const dietaryTag = inferDietaryTag(context)
  const campaignTag = inferCampaignTag(context)
  const communityTag = inferCommunityTag(context)

  return {
    local: [localPrimary, localSecondary, localTertiary].filter(Boolean),
    product: [productTag].filter(Boolean),
    category: [categoryTag].filter(Boolean),
    lifestyle: [lifestyleTag].filter(Boolean),
    brand: [brandTag].filter(Boolean),
    occasion: [occasionTag].filter(Boolean),
    dietary: [dietaryTag].filter(Boolean),
    campaign: [campaignTag].filter(Boolean),
    community: [communityTag].filter(Boolean),
  }
}

function selectForPlatform(
  layers: Record<HashtagLayerName, string[]>,
  platform: 'facebook' | 'instagram'
): string[] {
  const limits = PLATFORM_LIMITS[platform]

  if (platform === 'facebook') {
    // FIX 04: Facebook 2026 — local discovery only.
    // 1 tag (city/location) is correct for atmosphere posts.
    // 2 tags only when a specific occasion or dish is present.
    // Never lifestyle tags (#DrinkLovers, #FoodLovers) — these are IG signals, not FB signals.
    const fbOrder: HashtagLayerName[] = ['local', 'occasion', 'product']
    const pool: string[] = []
    for (const layer of fbOrder) {
      for (const tag of layers[layer]) pushUnique(pool, tag)
      if (pool.length >= limits.max) break
    }
    return pool.slice(0, limits.max)
  }

  // Instagram: full pool in standard order
  const order: HashtagLayerName[] = [
    'local', 'product', 'category', 'lifestyle',
    'brand', 'occasion', 'dietary', 'campaign', 'community',
  ]
  const pool: string[] = []
  for (const layer of order) {
    for (const tag of layers[layer]) pushUnique(pool, tag)
  }
  return pool.slice(0, limits.max)
}

export function buildPlatformHashtagSets(context: PlatformHashtagContext): PlatformHashtagSets {
  const layers = buildLayers(context)

  const facebook = selectForPlatform(layers, 'facebook')
  const instagram = selectForPlatform(layers, 'instagram')

  return { facebook, instagram }
}
