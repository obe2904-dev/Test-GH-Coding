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
  // FIX 07 (2026-07-04): Category hashtags ONLY if explicitly mentioned in POST TEXT
  // Rule from paid tier: "Do not infer any dish, menu or drink unless mentioned in the text"
  // Prevents #Cafe appearing just because business is a cafe when post is about burgers
  const text = (context.text || '').toLowerCase()
  
  // Check POST TEXT for explicit category mentions (word boundaries to avoid false matches)
  if (/\b(kaffe|coffee|espresso|latte|cappuccino|cafe|café|barista|filterkaffe)\b/.test(text)) return 'Cafe'
  if (/\b(cocktail|drinks?|øl|beer|bar|vin|wine|spirit)\b/.test(text)) return 'Bar'
  if (/\b(bread|brød|bager|bakery|croissant|pastry|wienerbrød|konditori)\b/.test(text)) return 'Bakery'
  if (/\b(restaurant|dining|menu|ret|dish|mad|food)\b/.test(text)) return 'Restaurant'

  // No category hashtag unless mentioned in text (prevents business-type inference)
  return ''
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

  if (/\b(new menu|ny menu|menu launch|launch|introducing|introduktion)\b/.test(text)) return 'NewMenu'
  if (/\b(summer menu|sommermenu)\b/.test(text)) return 'SummerMenu'
  if (/\b(brunch launch|brunchmenu)\b/.test(text)) return 'BrunchLaunch'
  if (/\b(coffee deal|kaffe tilbud|tilbud)\b/.test(text)) return 'CoffeeDeal'
  if (/\b(win|konkurrence|competition|taste and win)\b/.test(text)) return 'TasteAndWin'

  return ''
}

function inferCommunityTag(context: PlatformHashtagContext): string {
  const category = inferVenueCategory(context)
  if (category === 'Bar') return 'DrinkLocal'
  if (category === 'Cafe' || category === 'Restaurant' || category === 'Bakery') return 'EatLocal'
  // FIX 07: Only use SupportLocal if no category was detected from text
  if (!category) return 'SupportLocal'
  return ''
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
