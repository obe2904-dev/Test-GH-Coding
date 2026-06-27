/**
 * BTS (Behind-The-Scenes) Content Anchors by Vertical
 *
 * Static editorial guidance for Slot C (brand_behind) post ideas.
 * Returns 3-5 context-relevant BTS prompts keyed by business vertical and time-of-day.
 *
 * These anchors are injected as inspiration — not as mandatory topics.
 * The confirmed facts bank (venue_scene, emotional_promise, origin_story) always takes priority.
 *
 * Usage:
 *   const anchors = getBTSAnchors(effectiveVertical, new Date().getHours())
 */

// Maps vertical → time bucket → array of BTS anchor suggestions (Danish).
// Time buckets: 'morning' (6-11), 'midday' (11-15), 'afternoon' (15-18), 'evening' (18-24), 'general'
const BTS_ANCHORS: Record<string, Record<string, string[]>> = {
  cafe: {
    morning: [
      'Det første hold gæster: hvem er de, og hvad siger de altid?',
      'Hvad gøres klar inden åbning — det ingen gæster ser',
      'Hvordan starter din dag som ejer/barista?',
      'Kaffen inden kaffen — hvad drikker personalet om morgenen?',
    ],
    midday: [
      'Brunchen er over — hvad husker du bedst fra i dag?',
      'En samtale ved bordet der fik dig til at smile',
      'Hvad gik overraskende hurtigt i dag?',
      'Stamkunder: hvem er dem der altid bestiller det samme?',
    ],
    afternoon: [
      'Eftermiddagens stille time — hvad laver du?',
      'Et produkt der kræver mere tid end gæsterne aner',
      'Personalet: hvem er de, og hvad kan de ud over at lave kaffe?',
      'Forbereder til i morgen — hvad gøres klar nu?',
    ],
    evening: [
      'Hvad sker der efter lukketid?',
      'Den mest uventede bestilling i dag',
      'Hvem var den sidste gæst, og hvad satte de ord på?',
    ],
    general: [
      'Historien bag et produkt på menuen',
      'Hvorfra kommer ingredienserne?',
      'Hvad er dit favoritøjeblik i arbejdsdagen?',
      'Noget vi gør anderledes end de fleste — og hvorfor',
    ],
  },
  restaurant: {
    morning: [
      'Morgenlevering: hvad ankom i dag, og hvad er særligt?',
      'Mise en place — hvad forberedes der til aften?',
      'Hvad er på menuen i dag, og hvad var baggrunden for valget?',
    ],
    midday: [
      'Frokosttjeneren: en dag på arbejde fra indsiden',
      'Hvad tester kokken til frokost?',
      'Et råvare-fund fra torvet eller leverandøren',
    ],
    afternoon: [
      'Borddækning — detaljer ingen lægger mærke til, men alle mærker',
      'Hvad sker der i køkkenet en time inden service?',
      'Vinkortet: historien bag ét bestemt glas',
    ],
    evening: [
      'En aften i billeder — fra tom sal til fuldt hus',
      'Gæstens reaktion på retterne i aften',
      'Hvad serverede vi i aften, som vi er særligt stolte af?',
    ],
    general: [
      'Leverandørhistorie: hvem leverer og hvorfor netop dem?',
      'En ret der har været på menuen siden starten',
      'Hvad er dit bedste råd til gæster der besøger os første gang?',
      'Sæsonens råvarer — hvad former menuen lige nu?',
    ],
  },
  bar: {
    morning: [
      'Hvad forberedes der inden åbning — bartenderens prep-rutine',
      'Nye flasker på hylden: hvad er kommet ind?',
    ],
    midday: [
      'Et cocktail-tip til hjemmet — fra bartenderens noter',
      'Hvad handler en god bartender egentlig om?',
    ],
    afternoon: [
      'Happy hour starter — hvad er filosofien bag tilbuddet?',
      'Garnish og detaljer: det gæsterne ikke altid ser',
      'Lyden inden det starter: hvad spilles der under prep?',
    ],
    evening: [
      'Aftenens signature-drink — hvad er historien bag den?',
      'Et øjeblik fra baren der ikke kan glemmes',
      'Baren når den er fuld: hvad er stemningen?',
      'Den klassiker alle bestiller — og én der burde bestilles mere',
    ],
    general: [
      'Hvad gør vores bar anderledes end nabolaget?',
      'Et råd til gæster der ikke ved hvad de skal bestille',
      'Bartenderens favorit-kombination denne uge',
      'Hvorfra stammer vores spirits — leverandørhistorie',
    ],
  },
  cocktail_bar: {
    morning: [
      'Ny sirup eller tinktur — hvad laver vi fra bunden?',
      'Ingrediensjagt: hvad er der ude efter i dag?',
    ],
    afternoon: [
      'En opskrift vi testede i dag — hvad virkede, hvad virkede ikke?',
      'Gæsterne ser glasset. Vi ser de 20 minutter inden.',
    ],
    evening: [
      'Aftenens menu: hvad er konceptet bag sekvensen?',
      'En gæst spurgte om noget vi ikke forventede — og det ledte til en ny drink',
      'Hvad er det sværeste at forklare ved det vi laver?',
    ],
    general: [
      'Balancen i en cocktail — hvad handler det om for os?',
      'Sæsonens spirit eller smag vi bygger rundt om',
      'Inspiration: hvad inspirerer vores drinksliste?',
      'En klassiker vi aldrig ville fjerne — og én vi aldrig ville sætte på',
    ],
  },
  wine_bar: {
    morning: [
      'Ny flaske ankommet: hvad er historien bag producenten?',
      'Glasprøve: hvad testede vi til morgenkaffe?',
    ],
    midday: [
      'Vinkortet opdateres — hvad ryger ud, hvad kommer ind og hvorfor?',
      'En producent vi elsker og gerne vil fortælle om',
    ],
    evening: [
      'Aftenens åbne flaske — hvad serverer vi i glas?',
      'Et øjeblik ved bordet der fortæller hvad vi handler om',
      'Gæsternes spørgsmål om vin: hvad spurgte nogen i aften?',
    ],
    general: [
      'Naturvin vs. konventionel vin — hvad mener vi?',
      'Vores tanke om servering: glas, temperatur, dekant?',
      'En region vi er særligt passionerede for — og hvorfor',
      'Hvad gør en god vin-aften for en gæst?',
    ],
  },
  bakery: {
    morning: [
      'Hvad kom ud af ovnen kl. 05 i morges?',
      'Hævetiden: hvad sker der natten over?',
      'Den del af bagning ingen ser — men alle smager',
    ],
    midday: [
      'Hvad er udsolgt i dag — og hvad betyder det?',
      'Et brød der kræver tre dage at lave',
      'Mel, vand, salt, tid — hvad er hemmeligheden?',
    ],
    afternoon: [
      'Hvad bages til i morgen — og hvad er det nye denne uge?',
      'En opskrift vi har tweaket i måneder — endelig er vi der',
    ],
    general: [
      'Kornet: hvem malter det, og hvorfra kommer det?',
      'Surdej: vores starter har navn — hvad er historien?',
      'Hvad er filosofien bag vores sortiment?',
      'En gæst der kom hver dag i en uge — hvad bestilte de?',
    ],
  },
  coffee_shop: {
    morning: [
      'Første espresso af dagen: hvad smager vi, og hvad justerer vi?',
      'Nyindkøbt kaffebønne — hvad er dets karakter?',
      'Hvad snakker morgenholdet om inden åbning?',
    ],
    midday: [
      'Filterkaffe-brygningen: hvad er vores metode og hvorfor?',
      'En gæst der altid bestiller det samme — og en dag bestilte noget nyt',
    ],
    afternoon: [
      'Hvad er populært om eftermiddagen — og hvad overrasker?',
      'Kaffeuddannelse: hvad har vi lært nyligt om ekstraktion?',
    ],
    general: [
      'Vores leverandør-relation: hvem brygger vi fra og hvorfor?',
      'Baristaens tips til at lave bedre kaffe derhjemme',
      'En dag i arbejdslivet som barista hos os',
      'Hvad adskiller en god kop fra en fantastisk?',
    ],
  },
  fast_casual: {
    morning: [
      'Hvad forberedes der inden åbning i dag?',
      'Råvarer der kom ind i morges — hvad er specielt?',
    ],
    midday: [
      'Hvad har vi lavet flest af i dag?',
      'En gæst der overraskede os med sin bestilling',
    ],
    afternoon: [
      'Hvad er dagens bestseller og hvorfor?',
      'Teamet midt i servicetoppen: hvad sker der?',
    ],
    general: [
      'Hvad er filosofien bag vores menu?',
      'Hvad gør vi fra bunden — selvom det tager længere tid?',
      'En ingrediens vi er særligt stolte af at bruge',
      'Hvad siger gæster der vender tilbage?',
    ],
  },
}

const DEFAULT_ANCHORS: string[] = [
  'Hvad sker der bag kulisserne i dag?',
  'En detalje ved stedet som gæsterne sjældent opdager',
  'Hvad er vi mest stolte af denne uge?',
  'Historien bag et af vores produkter',
  'Personalet: hvem er de, og hvad elsker de ved arbejdet?',
]

function getTimeBucket(hour: number): string {
  if (hour >= 6 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 15) return 'midday'
  if (hour >= 15 && hour < 18) return 'afternoon'
  if (hour >= 18 || hour < 3) return 'evening'
  return 'general'
}

/**
 * Returns 3-5 BTS content anchor suggestions for the given vertical and hour.
 * Falls back to DEFAULT_ANCHORS if the vertical is unknown.
 *
 * @param vertical - The resolved effective vertical (e.g. 'cafe', 'bar', 'bakery')
 * @param currentHour - 0-23 hour for time-of-day bucketing
 * @returns Array of Danish BTS content prompts (max 5)
 */
export function getBTSAnchors(vertical: string, currentHour: number): string[] {
  const verticalMap = BTS_ANCHORS[vertical] ?? BTS_ANCHORS[vertical?.replace('_', '')] ?? null
  if (!verticalMap) return DEFAULT_ANCHORS.slice(0, 4)

  const bucket = getTimeBucket(currentHour)
  const timeBucketAnchors: string[] = verticalMap[bucket] ?? []
  const generalAnchors: string[] = verticalMap['general'] ?? []

  // Combine: time-specific first, then general, deduplicate, cap at 5
  const combined = [...timeBucketAnchors, ...generalAnchors]
  const deduped = Array.from(new Set(combined))
  return deduped.slice(0, 5)
}

/**
 * VALIDATION-AWARE BTS ANCHORS (V5.6 - June 22, 2026)
 * 
 * Filters BTS template suggestions based on actual menu evidence and verified facilities.
 * Prevents hallucinations when recognizable_interior_identity is NULL.
 * 
 * FILTERING RULES:
 * 1. Personnel references (barista, sommelier, chef) → Requires menu evidence
 * 2. Facility references (udeservering, terrasse) → Requires verified facility flag
 * 3. Product references (kaffe, vin, cocktails) → Requires menu category match
 * 
 * @param vertical - The resolved effective vertical (e.g. 'cafe', 'bar', 'bakery')
 * @param currentHour - 0-23 hour for time-of-day bucketing
 * @param menuCategories - Array of menu categories from actual menu data (e.g. ['brunch', 'frokost', 'middag'])
 * @param menuItemsText - Combined text of all menu items (names + descriptions) for keyword matching
 * @param verifiedFacilities - Object with verified facility flags from business_operations
 * @returns Filtered array of Danish BTS content prompts (max 5)
 */
export function getBTSAnchorsFiltered(
  vertical: string,
  currentHour: number,
  menuCategories: string[] = [],
  menuItemsText: string = '',
  verifiedFacilities: {
    has_outdoor_seating?: boolean
    has_bar?: boolean
    has_kitchen?: boolean
    serves_coffee?: boolean
    serves_alcohol?: boolean
  } = {}
): string[] {
  // Get unfiltered anchors
  const allAnchors = getBTSAnchors(vertical, currentHour)
  
  // If no menu data provided, return safe fallback anchors only
  if (menuCategories.length === 0 && !menuItemsText) {
    console.log('[BTS Filter] ⚠️  No menu data provided, using safe fallback anchors only')
    return DEFAULT_ANCHORS.filter(anchor => !requiresVerification(anchor)).slice(0, 4)
  }
  
  // Normalize menu text for keyword matching (lowercase, preserve Danish characters)
  const normalizedMenuText = menuItemsText.toLowerCase()
  const normalizedCategories = menuCategories.map(c => c.toLowerCase())
  
  // Filter anchors based on verification requirements
  const filtered = allAnchors.filter(anchor => {
    const anchorLower = anchor.toLowerCase()
    
    // RULE 1: BARISTA - Requires coffee in menu
    if (anchorLower.includes('barista')) {
      const hasCoffee = verifiedFacilities.serves_coffee 
        || normalizedMenuText.includes('kaffe')
        || normalizedMenuText.includes('coffee')
        || normalizedMenuText.includes('espresso')
        || normalizedMenuText.includes('latte')
        || normalizedMenuText.includes('cappuccino')
        || normalizedCategories.some(cat => /kaffe|coffee/i.test(cat))
      
      if (!hasCoffee) {
        console.log(`[BTS Filter] ❌ Filtered (no coffee in menu): "${anchor.substring(0, 50)}..."`)
        return false
      }
    }
    
    // RULE 2: KAFFE/COFFEE - Requires coffee in menu
    if (anchorLower.includes('kaffe') || anchorLower.includes('coffee')) {
      const hasCoffee = verifiedFacilities.serves_coffee
        || normalizedMenuText.includes('kaffe')
        || normalizedMenuText.includes('coffee')
        || normalizedMenuText.includes('espresso')
        || normalizedCategories.some(cat => /kaffe|coffee/i.test(cat))
      
      if (!hasCoffee) {
        console.log(`[BTS Filter] ❌ Filtered (no coffee in menu): "${anchor.substring(0, 50)}..."`)
        return false
      }
    }
    
    // RULE 3: OUTDOOR SEATING - Requires verified facility
    if (anchorLower.match(/udendørs|udeservering|terrasse|outdoor/)) {
      const hasOutdoor = verifiedFacilities.has_outdoor_seating === true
      
      if (!hasOutdoor) {
        console.log(`[BTS Filter] ❌ Filtered (no outdoor seating): "${anchor.substring(0, 50)}..."`)
        return false
      }
    }
    
    // RULE 4: SOMMELIER - Requires wine in menu
    if (anchorLower.includes('sommelier')) {
      const hasWine = verifiedFacilities.serves_alcohol
        || normalizedMenuText.includes('vin')
        || normalizedMenuText.includes('wine')
        || normalizedMenuText.includes('rødvin')
        || normalizedMenuText.includes('hvidvin')
        || normalizedCategories.some(cat => /vin|wine/i.test(cat))
      
      if (!hasWine) {
        console.log(`[BTS Filter] ❌ Filtered (no wine in menu): "${anchor.substring(0, 50)}..."`)
        return false
      }
    }
    
    // RULE 5: BARTENDER - Requires bar/cocktails in menu
    if (anchorLower.includes('bartender')) {
      const hasBar = verifiedFacilities.has_bar
        || verifiedFacilities.serves_alcohol
        || normalizedMenuText.includes('cocktail')
        || normalizedMenuText.includes('drink')
        || normalizedMenuText.includes('øl')
        || normalizedMenuText.includes('beer')
        || normalizedCategories.some(cat => /bar|cocktail|drinks/i.test(cat))
      
      if (!hasBar) {
        console.log(`[BTS Filter] ❌ Filtered (no bar/cocktails): "${anchor.substring(0, 50)}..."`)
        return false
      }
    }
    
    // RULE 6: CHEF/KOK - Requires kitchen operation
    if (anchorLower.match(/\bkok\b|kokken|chef/)) {
      const hasKitchen = verifiedFacilities.has_kitchen
        || normalizedCategories.some(cat => /frokost|middag|brunch|lunch|dinner/i.test(cat))
        || normalizedMenuText.length > 100  // Assumes substantial food menu
      
      if (!hasKitchen) {
        console.log(`[BTS Filter] ❌ Filtered (no kitchen operation): "${anchor.substring(0, 50)}..."`)
        return false
      }
    }
    
    // Anchor passed all filters
    return true
  })
  
  // If all anchors were filtered out, return safe generic fallbacks
  if (filtered.length === 0) {
    console.log('[BTS Filter] ⚠️  All anchors filtered, using generic fallbacks')
    return [
      'Hvad sker der bag kulisserne i dag?',
      'En detalje ved stedet som gæsterne sjældent opdager',
      'Historien bag et af produkterne på menuen',
      'Hvad er vi mest stolte af denne uge?',
    ]
  }
  
  console.log(`[BTS Filter] ✅ ${filtered.length}/${allAnchors.length} anchors passed validation`)
  return filtered
}

/**
 * Helper: Check if anchor requires verification
 * Used to identify anchors that should not be shown without menu data
 */
function requiresVerification(anchor: string): boolean {
  const lower = anchor.toLowerCase()
  return lower.includes('barista')
    || lower.includes('kaffe')
    || lower.includes('coffee')
    || lower.includes('sommelier')
    || lower.includes('bartender')
    || lower.match(/udendørs|udeservering|terrasse/)
    || lower.match(/\bkok\b|kokken|chef/)
}
