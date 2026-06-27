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
  const haystack = [context.vertical, context.businessCharacter, context.businessName, context.text, context.contentType]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (/(bakery|bageri|bager|wienerbrød|brød|kage)/i.test(haystack)) return 'Bakery'
  if (/(bar|cocktail|wine|vin|drinks?|spirit|øl|beer)/i.test(haystack)) return 'Bar'
  if (/(coffee|cafe|café|espresso|latte|barista|filterkaffe)/i.test(haystack)) return 'Cafe'
  if (/(food truck|street food|foodtruck)/i.test(haystack)) return 'FoodTruck'
  if (/(takeaway|to go|udbring|afhent)/i.test(haystack)) return 'Takeaway'
  if (/(restaurant|spisested|køkken|menu|diner)/i.test(haystack)) return 'Restaurant'

  return context.contentType === 'behind_scenes' ? 'Cafe' : 'Restaurant'
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

  // Coffee: only if the post itself is about coffee
  if (/(coffee|cafe|café|espresso|latte|cappuccino|cortado|filterkaffe|kaffebar)/.test(text)) return 'CoffeeLovers'
  
  // Brunch: only if post mentions it
  if (/(brunch|morgenmad)/.test(text)) return 'BrunchTime'
  
  // Drinks: only if post mentions it
  if (/(cocktail|drinks?|vin|øl|beer|bar)/.test(text)) return 'DrinkLovers'
  
  // Meal occasions: only if post mentions them
  if (/(lunch|frokost)/.test(text)) return 'LunchBreak'
  if (/(dinner|aftensmad)/.test(text) && /(date|par|romantisk)/.test(text)) return 'DateNight'
  if (/(cozy|hygg|warm|varm|indendørs|inside)/.test(text)) return 'CozyCafe'

  // Food in general — only if food words appear in the post
  if (/(food|mad|dish|ret|menu|meal|måltid|smag|serverer)/.test(text)) return 'FoodLovers'

  // IMPORTANT: no venue-category fallback here.
  // A café posting about a concert or an event should NOT get #CoffeeLovers.
  return ''
}

function inferOccasionTag(context: PlatformHashtagContext): string {
  const text = [context.text, context.detectedDishDescription].filter(Boolean).join(' ').toLowerCase()

  if (/(weekend|lørdag|saturday|søndag|sunday)/.test(text) && /(brunch|morgenmad)/.test(text)) return 'WeekendBrunch'
  if (/(friday|fredag)/.test(text) && /(drink|drinks|cocktail|bar|vin|øl|beer)/.test(text)) return 'FridayDrinks'
  if (/(lunch|frokost)/.test(text)) return 'LunchBreak'
  if (/(date night|datenight|aften)/.test(text)) return 'DateNight'
  if (/(summer|sommer)/.test(text) && /(drink|drinks|cocktail|bar)/.test(text)) return 'SummerDrinks'
  if (/(christmas|jul|jule)/.test(text)) return 'ChristmasMenu'
  if (/(new menu|newmenu|ny menu|lan(?:c|)ering|launch)/.test(text)) return 'NewMenu'

  return ''
}

function inferDietaryTag(context: PlatformHashtagContext): string {
  const text = [context.text, context.detectedDishDescription].filter(Boolean).join(' ').toLowerCase()

  if (/(vegan|vegansk)/.test(text)) return 'VeganFood'
  if (/(vegetarian|vegetarisk)/.test(text)) return 'VegetarianFood'
  if (/(glutenfri|gluten free|glutenfree)/.test(text)) return 'GlutenFree'
  if (/(plant based|plantebaseret|plantebaseret)/.test(text)) return 'PlantBased'
  if (/(healthy|sund|sundt)/.test(text)) return 'HealthyLunch'

  return ''
}

function inferCampaignTag(context: PlatformHashtagContext): string {
  const text = [context.text, context.detectedDishDescription].filter(Boolean).join(' ').toLowerCase()

  if (/(new menu|ny menu|menu launch|launch|introducing|introduktion)/.test(text)) return 'NewMenu'
  if (/(summer menu|sommermenu)/.test(text)) return 'SummerMenu'
  if (/(brunch launch|brunchmenu)/.test(text)) return 'BrunchLaunch'
  if (/(coffee deal|kaffe tilbud|tilbud)/.test(text)) return 'CoffeeDeal'
  if (/(win|konkurrence|competition|taste and win)/.test(text)) return 'TasteAndWin'

  return ''
}

function inferCommunityTag(context: PlatformHashtagContext): string {
  const category = inferVenueCategory(context)
  if (category === 'Bar') return 'DrinkLocal'
  if (category === 'Cafe' || category === 'Restaurant' || category === 'Bakery') return 'EatLocal'
  return 'SupportLocal'
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
  
  const localPrimary = locationVocabTags.length > 0 
    ? locationVocabTags[0]
    : (context.city ? compactTag(context.city, categoryTag) : '')
  const localSecondary = locationVocabTags.length > 1
    ? locationVocabTags[1]
    : (cityTag && cityTag !== localPrimary ? cityTag : '')
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
    // Facebook: prioritise local + the most specific content signal
    // Order: local primary → product (dish/keyword) → occasion → lifestyle → category
    const fbOrder: HashtagLayerName[] = ['local', 'product', 'occasion', 'lifestyle', 'category']
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
