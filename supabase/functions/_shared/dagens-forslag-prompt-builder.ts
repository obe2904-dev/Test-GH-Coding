/**
 * Dagens Forslag Prompt Builder
 * 
 * Constructs Gemini prompts for the 3-slot daily suggestion system.
 * Extracted from get-quick-suggestions/index.ts for reusability and maintainability.
 * 
 * Responsibilities:
 * - Assemble confirmed facts bank from business data
 * - Build menu blocks with service-period awareness
 * - Construct never-say lists with brand + location context
 * - Generate slot-specific prompts (A: offering, B: guest_moment, C: brand_behind)
 * - Run slot planner to decide daily content mix
 */

import { buildNeverSayList } from './never-say-config/builder.ts'
import { getHospitalityRegisterBlock, countryToLangCode } from './utils/hospitality-register.ts'
import { getBTSAnchors } from './post-helpers/bts-by-vertical.ts'
import { buildMenuMediaInstruction, buildBehindScenesMediaInstruction, buildAtmosphereMediaInstruction } from './media-suggestion/media-builders-typed.ts'

function buildRecencyRationaleBlock(targetQualifier: string): string {
  return `
   FORMAT: "[Sensorisk faktum om ingrediens/teknik]. Sidst fremhævet for [X] dage siden, hvilket [strategic value] til ${targetQualifier}"
   FALLBACK HVIS RETTEN IKKE HAR EN TIDLIGERE MENTION: "[Sensorisk faktum om ingrediens/teknik]. Aldrig fremhævet endnu, hvilket [strategic value] til ${targetQualifier}"`
}

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export interface MenuCategory {
  catName: string
  items: Array<{ name: string; description?: string }>
}

export interface DagensPromptContext {
  // Business identity
  businessName: string
  effectiveVertical: string
  isHybridBusiness: boolean
  businessCharacter?: string
  cuisineStyle?: string
  identityKeywords?: string
  visualCharacter?: string
  venueScene?: string
  venueEnergyText?: string
  guestSituation?: string
  emotionalPromise?: string
  
  // Location
  city?: string
  country?: string
  localLocationReference?: string  // Exact local place term from businesses.local_location_reference (e.g. "ved åen", "Nyhavn")
  
  // Operations
  todayOpenTime?: string
  todayCloseTime?: string
  kitchenCloseTime?: string
  activeServicePeriod?: string
  priceLevel?: number
  
  // Programs (service periods with accurate times from menu)
  currentProgram?: {name: string; start: string; end: string; hoursUntilClose: number}
  allPrograms?: Array<{name: string; start: string; end: string}>
  
  // Day/time context
  dayName: string
  dayBehavior: {
    mode: string
    danishMode: string
    emphasis: string
    avoidPushFootfall: boolean
    offeringTone: string
    slotBDefault: string
    slotCDefault: string
  }
  isWeekend: boolean
  currentHour: number
  
  // Weather/season
  weatherInfo: string
  season: string
  outdoorNote: string
  outdoorSuitability: boolean
  outdoorProhibitionBlock: string
  
  // Audience
  targetAudienceText?: string
  activeSegmentAngle?: string
  audienceBreadth?: string
  businessModelType?: string
  primaryCopyHook?: string
  
  // V5 Behavioral Guidance (June 2026)
  v5ToneNote?: string  // Danish tone guidance from motivation × decision_timing
  v5CTAType?: 'walk_in' | 'book_table' | 'impulse_visit'  // CTA type from segment + business ops
  v5ContentAngles?: string[]  // Content angles from active segment
  
  // Menu
  menuCategories: MenuCategory[]
  signatureItems: string[]
  timeAppropriateItems?: string[]  // Subset of signatureItems that match current time (for prioritization guidance)
  menuDescriptionMap: Map<string, string>
  socialLeadLabel?: string
  menuLanguage?: string
  
  // Facts banks
  confirmedFacts: string[]
  confirmedFactsSlotB: string[]
  calendarEventFacts: string[]
  locationMarketingHooks: string[]
  menuIntelligenceFacts: string[]
  
  // Constraints
  hasKidsMenu: boolean
  hasTakeaway: boolean
  hasOutdoorSeating: boolean
  hasTableService: boolean
  
  // Content strategy
  contentExclusions?: string
  conceptFitAvoid: string[]
  disabledSlots: string[]
  
  // History
  recentSuggestions: Array<{ title: string; content_type: string; photo_idea: string }>
  recentSlotADishes: string[]
  recentSlotADishesWithAge?: Array<{name: string; daysAgo: number}>
  selectionBiasBlock: string
  
  // Brand voice
  toneInstructions: string
  voiceRationale?: string
  isPaidTier: boolean
  touristContext?: string
  // Layer 5: user-provided context override (max 120 chars, typed at generation time)
  userContext?: string
}

export interface SlotPlannerResult {
  slot_types: string[]
  rationale: string
}

// ────────────────────────────────────────────────────────────────────────────
// HELPER: Cuisine Framing Map
// ────────────────────────────────────────────────────────────────────────────

const CUISINE_FRAMING_MAP: Record<string, string> = {
  'italian': 'Italiensk køkken: pasta, risotto, antipasti',
  'mediterranean': 'Middelhavskøkken: grillet fisk, hummus, friske urter',
  'french': 'Fransk bistro: smør, vin, klassiske teknikker',
  'nordic': 'Nordisk/New Nordic: lokale råvarer, sæsonbetinget',
  'danish': 'Dansk køkken: smørrebrød, frikadeller, årstidens råvarer',
  'mexican': 'Mexicansk street food: tacos, guacamole, chili',
  'asian': 'Asiatisk fusion: umami, frisk, krydret',
  'japanese': 'Japansk: sushi, ramen, umami-fokus',
  'indian': 'Indisk: krydderier, curry, tandoori',
  'american': 'Amerikansk: burgere, BBQ, comfort food',
  'middle eastern': 'Mellemøstlig: falafel, shawarma, krydderier',
  'vegetarian': 'Plantebaseret/vegetarisk: sæsongrøntsager i centrum',
}

export function getCuisineBlock(cuisineStyle?: string): string {
  if (!cuisineStyle) return ''
  const cuisineKey = cuisineStyle.toLowerCase()
  const cuisineHint = CUISINE_FRAMING_MAP[cuisineKey]
    || `Køkkenprofil: ${cuisineStyle}`
  return `\n── Køkkentype: ${cuisineHint} (lad dette farve beskrivelsernes stemning, men opfind ikke retter der ikke er på menuen)\n`
}

// ────────────────────────────────────────────────────────────────────────────
// HELPER: BTS Activity Window
// ────────────────────────────────────────────────────────────────────────────

export function getBTSActivityWindow(
  openTime: string | null,
  closeTime: string | null,
  vertical = 'cafe'
): string {
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const isBar = vertical === 'bar' || vertical === 'cocktail_bar' || vertical === 'wine_bar'
  const isBakery = vertical === 'bakery' || vertical === 'patisserie'
  const isCoffee = vertical === 'coffee_shop' || vertical === 'kaffebar'

  const earlyPrep = isBar
    ? 'Tidlig forberedelse (>2t til åbning): mise en place, sirupper, garnisher, isproduktion'
    : isBakery
    ? 'Morgenbagning (>2t til åbning): deje, ovnopstart, brød og wienerbrød formes'
    : isCoffee
    ? 'Morgenforberedelse (>2t til åbning): brygning, kalibrering, mælkeforberedelse, mise en place'
    : 'Tidlig forberedelse (>2t til åbning): mise en place, brød, deje, saucer, optøning'

  const preService = isBar
    ? 'Klargøring til åbning (<2t): barsætning, glas poleres, drinks-kort gennemgås'
    : isBakery
    ? 'Klargøring til åbning (<2t): bagværk afkøles, udstykning, vinduesopsætning'
    : isCoffee
    ? 'Klargøring til åbning (<2t): maskiner varmes op, kaffe kalibrereres, bord- og bardisksætning'
    : 'Klargøring til service (<2t til åbning): anretningsopsætning, bordklargøring, den stille time inden første gæst'

  const earlyService = isBar
    ? 'Åbner snart: de første gæster, enkle drinks, aftenens første bestillinger'
    : isBakery
    ? 'Tidlig morgen: de første kunder, friskbagt brød ud, kasseklargøring'
    : isCoffee
    ? 'Morgenrush: de første kaffer, mælkeskumning, køen bygger sig op'
    : 'Tidlig service: de første bestillinger, morgen- eller frokostopstart'

  const closing = isBar
    ? 'Slutfase: oprydning af bar, glas vaskes, mise en place til i morgen'
    : isBakery
    ? 'Slutfase: restbagværk nedbringes, rengøring, forberedelse til næste morgen'
    : isCoffee
    ? 'Slutfase: maskiner rengøres, restkaffe, klargøring til næste morgen'
    : 'Slut på service: oprydning, optælling, klargøring til i morgen'

  if (openTime) {
    const [openH, openM = 0] = openTime.split(':').map(Number)
    const openMinutes = openH * 60 + openM
    const minutesUntilOpen = openMinutes - nowMinutes
    const minutesSinceOpen = nowMinutes - openMinutes
    if (minutesUntilOpen > 120) return earlyPrep
    if (minutesUntilOpen > 0) return preService
    if (minutesSinceOpen < 90) return earlyService
    if (closeTime) {
      const [closeH, closeM = 0] = closeTime.split(':').map(Number)
      const closeMinutes = closeH * 60 + closeM
      if (nowMinutes > closeMinutes - 90) return closing
    }
  }

  // Fallback by clock
  const h = now.getHours()
  if (isBar) {
    if (h >= 14 && h < 17) return 'Barklargøring: bardisk sættes op, sirupper, garnisher, isproduktion'
    if (h >= 17 && h < 22) return 'Aftenservice: drinks bestilles, bar er travl, cocktails mixet live'
    if (h >= 22) return 'Sen service: fuldt hus eller oprydning, næste dags mise en place'
    return 'Dagsklargøring: mise en place, glas poleres, barsortiment tjekkes'
  }
  if (isBakery) {
    if (h >= 4 && h < 8) return 'Morgenbagning: ovne varme, brød bages, deje formes'
    if (h >= 8 && h < 12) return 'Morgensalg: friskbagt varer ud, kunder strømmer ind'
    if (h >= 12 && h < 15) return 'Eftermiddagsbagning: wienerbrød, kager, sødmælksprodukter'
    return 'Klargøring til næste dag: deje stilles, rengøring, bestilling'
  }
  if (isCoffee) {
    if (h >= 6 && h < 9) return 'Morgenrush: espresso, mælkeskumning, kø ved kassen'
    if (h >= 9 && h < 12) return 'Formiddag: roligst interval, single origin-shots, slow bar'
    if (h >= 12 && h < 15) return 'Frokostpeak: kaffe og mad, maskine kører konstant'
    if (h >= 15 && h < 18) return 'Eftermiddagskaffe: filter, espresso, det rolige interval'
    return 'Slutfase: maskiner rengøres, mise en place til i morgen'
  }
  // Default
  if (h >= 6 && h < 10) return 'Morgenforberedelse: bagning, brygning, mise en place'
  if (h >= 10 && h < 14) return 'Frokostkøkken: anretning, bestillinger ind, travlt'
  if (h >= 14 && h < 17) return 'Eftermiddagsklargøring: opfyldning, forberedelse til aftenservice'
  if (h >= 17 && h < 22) return 'Aftenservice: det travle køkken, plating, tjansen'
  return 'Slutfase: oprydning, optælling, klargøring til i morgen'
}

// ────────────────────────────────────────────────────────────────────────────
// HELPER: Build Never-Say List
// ────────────────────────────────────────────────────────────────────────────

export function buildComprehensiveNeverSayList(
  ctx: DagensPromptContext,
  brandProfile: any
): { list: string[]; block: string } {
  const neverSayBusinessType: 'FSE' | 'SBO' | 'MFV' =
    ['cafe', 'restaurant', 'bakery'].includes(ctx.effectiveVertical) ? 'FSE'
    : ['bar', 'coffee_shop'].includes(ctx.effectiveVertical) ? 'SBO'
    : ctx.effectiveVertical === 'food_truck' ? 'MFV'
    : 'FSE'

  const neverSayList = buildNeverSayList({
    country: ctx.country || 'Denmark',
    businessType: neverSayBusinessType,
    city: ctx.city || '',
  }).slice(0, 25)

  // Brand-specific never_say (do_not_say.words removed May 8, 2026)
  // V5-first fallback: brand_profile_v5.guardrails.never_say → never_say
  const brandNS: string[] = []
  const v5Guardrails = (brandProfile as any)?.brand_profile_v5?.guardrails
  const neverSayV5 = v5Guardrails?.never_say
  if (Array.isArray(neverSayV5)) {
    brandNS.push(...neverSayV5)
  } else {
    const bpNS = (brandProfile as any)?.never_say
    if (Array.isArray(bpNS)) brandNS.push(...bpNS)
  }
  // Note: do_not_say.words field deleted from database in Phase 0 migration
  if (brandNS.length > 0) neverSayList.push(...brandNS)

  // Concept fit avoid items
  if (ctx.conceptFitAvoid.length > 0) neverSayList.push(...ctx.conceptFitAvoid)

  const neverSayBlock = neverSayList.length > 0
    ? `\n\n──── ALDRIG BRUG DISSE ORD/FRASER (4A never-say) ────\n${neverSayList.join(', ')}\n`
    : ''

  return { list: neverSayList, block: neverSayBlock }
}

// ────────────────────────────────────────────────────────────────────────────
// HELPER: Normalize Dish Name Capitalization
// ────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes dish name capitalization to prevent ALL CAPS in prompts.
 * 
 * Rules:
 * - ALL CAPS → Title Case (BØRNEBRUNCH → Børnebrunch)
 * - Mixed case → Preserve as-is (Faustburger → Faustburger)
 * - Special cases: Numbers, hyphens, apostrophes handled correctly
 * 
 * @param name - Raw dish name from database
 * @returns Properly capitalized dish name
 * 
 * @example
 * normalizeDishName("BØRNEBRUNCH") → "Børnebrunch"
 * normalizeDishName("FAUSTBURGER") → "Faustburger"
 * normalizeDishName("FAUST GRYDE") → "Faust Gryde"
 * normalizeDishName("24h-MARINERET KYLLING") → "24h-Marineret Kylling"
 */
export function normalizeDishName(name: string): string {
  if (!name) return name
  
  // Check if the name is ALL CAPS (more than 50% uppercase letters)
  const letterCount = (name.match(/[A-ZÆØÅ]/gi) || []).length
  const uppercaseCount = (name.match(/[A-ZÆØÅ]/g) || []).length
  const isAllCaps = letterCount > 0 && uppercaseCount / letterCount > 0.8
  
  if (!isAllCaps) {
    // Name has mixed case, preserve it
    return name
  }
  
  // Convert ALL CAPS to Title Case
  return name
    .toLowerCase()
    .split(/\s+/)  // Split by whitespace
    .map(word => {
      // Capitalize first letter of each word
      if (word.length === 0) return word
      
      // Handle hyphenated words (e.g., "24h-marineret" → "24h-Marineret")
      if (word.includes('-')) {
        return word.split('-').map((part, idx) => {
          // Keep numbers/short prefixes lowercase (24h, etc)
          if (idx === 0 && /^[0-9]+[a-z]?$/.test(part)) return part
          // Capitalize first letter of other parts
          return part.charAt(0).toUpperCase() + part.slice(1)
        }).join('-')
      }
      
      // Regular word capitalization
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

// ────────────────────────────────────────────────────────────────────────────
// HELPER: Build Menu Block
// ────────────────────────────────────────────────────────────────────────────

/** Returns a menuBlock with specific dish names filtered out (for slots B/C to prevent repeating slot A's dish). */
export function buildMenuBlockExcluding(ctx: DagensPromptContext, excludedNames: string[]): string {
  if (excludedNames.length === 0) return buildMenuBlock(ctx)
  const isExcluded = (name: string) =>
    excludedNames.some(ex =>
      name.toLowerCase().includes(ex.toLowerCase()) ||
      ex.toLowerCase().includes(name.toLowerCase())
    )
  const filteredCtx = {
    ...ctx,
    menuCategories: ctx.menuCategories
      .map(cat => ({ ...cat, items: cat.items.filter(item => !isExcluded(item.name)) }))
      .filter(cat => cat.items.length > 0),
    signatureItems: ctx.signatureItems.filter(item => !isExcluded(item)),
  }
  return buildMenuBlock(filteredCtx)
}

export function buildMenuBlock(ctx: DagensPromptContext): string {
  const servicePeriodGuide = ctx.activeServicePeriod && ctx.activeServicePeriod !== 'all_day'
    ? `\nService-periode i dag: ${ctx.activeServicePeriod === 'dinner' ? 'AFTENSMAD' : ctx.activeServicePeriod === 'brunch' ? 'BRUNCH/MORGENMAD' : 'FROKOST'} — prioritér retter fra denne kategori, men alle kategorier er gyldige valg.\n`
    : ''

  const socialLeadNote = ctx.socialLeadLabel
    ? `\nEjer har markeret dette menukort som det de vil fremhæve socialt: "${ctx.socialLeadLabel}" — prioritér retter herfra til Slot A hvis de passer til service-perioden.\n`
    : ''
  
  // Time-appropriate prioritization hint
  const timeHint = (ctx.timeAppropriateItems && ctx.timeAppropriateItems.length > 0)
    ? `\n⏰ TIDSPRIORITET (kl. ${ctx.currentHour}): Følgende retter passer særligt godt til nuværende tidspunkt/service-periode — PRIORITÉR disse, men alle menuretter er tilgængelige valg:\n${ctx.timeAppropriateItems.slice(0, 12).map(item => normalizeDishName(item)).join(', ')}\n`
    : ''

  const menuLangLabel = ctx.menuLanguage === 'en' ? 'engelsksprogede'
    : ctx.menuLanguage === 'de' ? 'tysksproget'
    : ctx.menuLanguage === 'fr' ? 'fransksprogede'
    : ctx.menuLanguage !== 'da' ? `${ctx.menuLanguage}-sproget`
    : ''

  const menuLangTouristSuffix = (menuLangLabel && ctx.touristContext)
    ? ` Stedet tiltrækker internationale gæster — et ${menuLangLabel} menukort er en anledning til at nævne denne internationale appel i why_explanation-strategisætningen.`
    : ''

  const menuLanguageNote = menuLangLabel
    ? `\n\nSPROG-NOTE: Dette menukort er på ${menuLangLabel}. Bevar alle rettebetegnelser og ingredienser PRÆCIST som de er skrevet på menuen. Skriv titel, dish_text_brief og why_explanation på dansk.${menuLangTouristSuffix}`
    : ''

  if (ctx.menuCategories.length > 0) {
    const categoryLines = ctx.menuCategories.map(cat => {
      const itemLines = cat.items.map(item => {
        const normalizedName = normalizeDishName(item.name)
        return item.description 
          ? `  - ${normalizedName} (${item.description})` 
          : `  - ${normalizedName}`
      }).join('\n')
      return `${cat.catName.toUpperCase()}:\n${itemLines}`
    }).join('\n\n')
    return `Vælg ÉT konkret tilbud fra menukortet til Slot A:${servicePeriodGuide}${socialLeadNote}${timeHint}\n${categoryLines}\n\nTilbud-tone i dag (${ctx.dayBehavior.danishMode}): ${ctx.dayBehavior.offeringTone}${menuLanguageNote}`
  }

  if (ctx.signatureItems.length > 0) {
    const normalizedItems = ctx.signatureItems.map(item => normalizeDishName(item))
    return `Vælg ÉT konkret tilbud fra denne liste til Slot A:${timeHint}\n${normalizedItems.join(', ')}\nTilbud-tone i dag (${ctx.dayBehavior.danishMode}): ${ctx.dayBehavior.offeringTone}${menuLanguageNote}`
  }

  // Fallback when no menu
  const slotAFallbackType = ctx.effectiveVertical === 'bar'
    ? ctx.dayBehavior.slotBDefault
    : (ctx.effectiveVertical === 'coffee_shop' || ctx.effectiveVertical === 'bakery')
    ? 'brunch_moment'
    : 'atmosphere'

  const slotAFallbackLabel = slotAFallbackType === 'afterwork_moment' ? 'afterwork/aftenmøde-moment'
    : slotAFallbackType === 'brunch_moment' ? 'morgen/brunch-moment'
    : slotAFallbackType === 'lunch_moment' ? 'frokostmoment'
    : 'gæstemoment'

  return `Ingen menu-data tilgængelig — generer i stedet et ${slotAFallbackLabel} til Slot A (content_type: ${slotAFallbackType}, slot: "guest_moment"). Brug bekræftede facts nedenfor som anchor.`
}

// ────────────────────────────────────────────────────────────────────────────
// HELPER: Shared Context Block
// ────────────────────────────────────────────────────────────────────────────

export function buildSharedContext(ctx: DagensPromptContext): string {
  const servicePeriodHint = ctx.activeServicePeriod && ctx.activeServicePeriod !== 'all_day'
    ? ` (serverer primært ${ctx.activeServicePeriod === 'dinner' ? 'aftensmad' : ctx.activeServicePeriod === 'brunch' ? 'brunch/morgenmad' : 'frokost'})`
    : ''

  const cuisineBlock = getCuisineBlock(ctx.cuisineStyle)
  
  // Add current program information
  const programBlock = ctx.currentProgram 
    ? `\nAktivt program: ${ctx.currentProgram.name} (${ctx.currentProgram.start}-${ctx.currentProgram.end}) — ${ctx.currentProgram.hoursUntilClose < 2 ? `⚠️ SNART LUKKET (${ctx.currentProgram.hoursUntilClose.toFixed(1)}h tilbage)` : `${ctx.currentProgram.hoursUntilClose.toFixed(1)}h tilbage`}`
    : ''
  
  // Add constraint about program availability
  const programConstraint = ctx.currentProgram && ctx.currentProgram.hoursUntilClose < 1.5
    ? `\n⚠️ POST TIDSBEGRÆNSNING: Foreslå KUN retter fra aktive menuer. ${ctx.currentProgram.name} lukker om ${ctx.currentProgram.hoursUntilClose.toFixed(1)}h — vælg derfor retter fra menuer der er tilgængelige EFTER programskift.`
    : ctx.currentProgram
    ? `\nMenubegrænsning: Foreslå primært retter fra ${ctx.currentProgram.name}-menuen (aktiv nu)`
    : ''

  // Location naming constraint: when a local place term is set, lock AI to that exact phrase
  const locationNamingRule = ctx.localLocationReference
    ? `\n🚫 STEDSNAVN-REGEL: Stedet ligger "${ctx.localLocationReference}" — brug KUN denne betegnelse. Skriv ALDRIG "terrassen", "haven", "gården", "udeområdet" eller andre stedsbetegnelser der ikke er bekræftet ovenfor.`
    : ''

  return `Forretning: ${ctx.businessName}${ctx.city ? `, ${ctx.city}` : ''}${servicePeriodHint}
Type: ${ctx.effectiveVertical}${ctx.businessCharacter ? ` — ${ctx.businessCharacter}` : ''}${cuisineBlock}${programBlock}
Vejr: ${ctx.weatherInfo} | Sæson: ${ctx.season}
Dag: ${ctx.dayName} (${ctx.dayBehavior.danishMode}) | Weekend: ${ctx.isWeekend ? 'ja' : 'nej'}
Dagsstemning: ${ctx.dayBehavior.emphasis}
Udeservering: ${ctx.outdoorNote}${ctx.outdoorProhibitionBlock}${locationNamingRule}${programConstraint}${(ctx.audienceBreadth !== 'broad' && ctx.businessModelType !== 'offer_led' && ctx.targetAudienceText) ? `\nAktiv målgruppe: ${ctx.targetAudienceText}` : ''}${(ctx.audienceBreadth !== 'broad' && ctx.businessModelType !== 'offer_led' && ctx.activeSegmentAngle) ? `\nAnbefalet vinkel: ${ctx.activeSegmentAngle}` : ''}${ctx.priceLevel ? `\nPrisniveau: ${['', 'Budget', 'Casual', 'Middelklasse', 'Premium'][ctx.priceLevel] || ''}` : ''}${ctx.identityKeywords ? `\nNøgleord: ${ctx.identityKeywords}` : ''}`
}

// ────────────────────────────────────────────────────────────────────────────
// HELPER: Shared Writing Rules
// ────────────────────────────────────────────────────────────────────────────

export function buildSharedRules(ctx: DagensPromptContext, neverSayBlock: string): string {
  const priceLevelFormalityHint = (() => {
    const pl = ctx.priceLevel
    if (pl === 1) return '\n💰 BUDGET-REGISTER: Hold sproget afslappet, direkte, nærværende. Undgå fancy-ord eller gourmet-jargon.'
    if (pl === 4) return '\n💰 PREMIUM-REGISTER: Tillad et mere raffineret sprog, men stadig tilgængeligt. Undgå slang eller alt-for casual tone.'
    if (pl === 2 || pl === 3) return '\n💰 CASUAL/MIDDELKLASSE: Balance mellem tilgængeligt og kvalitetsbevidst. Naturligt dansk uden overdreven formalitet.'
    return ''
  })()

  return `──── SKRIVESTIL ────
${getHospitalityRegisterBlock(countryToLangCode(ctx.country ?? ''), ctx.effectiveVertical)}${priceLevelFormalityHint}${neverSayBlock}${ctx.toneInstructions}
⛔ ABSOLUTTE TITELREGLER (ingen undtagelse):
- INGEN punktum i titlen — aldrig.
- INGEN kolon der opdeler titlen i to dele.
- INGEN "X venter", "X kalder", "X lokker" konstruktion — hverken mad- eller abstrakte substantiver.
- INGEN interiørelement som titelsubjekt — lys, vinduer, gulve, rum er kulisse, ikke protagonister.
- Titlen er EN sammenhængende sætning. 3–7 ord. Aktiv konstruktion. Naturligt dansk.${ctx.voiceRationale ? `\n🚫 REGISTERVAGT: ${ctx.voiceRationale}` : ''}

⛔ TIMING-REGLER for why_explanation:
- UNDGÅ specifikke lukkeTIDSPUNKTER som "kl. 21:30", "til kl. 22:00" — de skaber modsigelser
- Brug i stedet RELATIVE formuleringer: "resten af aftenen", "hele eftermiddagen", "til sent"
- Kun nævn åbningstid eller programstart når det er direkte relevant for valget
- Hold fokus på HVORFOR retten/situationen passer til målgruppen — ikke på tekniske detaljer`
}

// ────────────────────────────────────────────────────────────────────────────
// TIMING SIGNAL HELPERS
// ────────────────────────────────────────────────────────────────────────────

function seasonInDanish(season: string): string {
  const map: Record<string, string> = { spring: 'forår', summer: 'sommer', autumn: 'efterår', winter: 'vinter' }
  return map[season] ?? season
}

/** Builds a concrete timing-facts block to inject into slot prompts.
 *  Gemini is required to cite at least one of these values in why_explanation. */
function buildTimingSignalBlock(ctx: DagensPromptContext, options?: { isFollowUpSlot?: boolean; targetPostTime?: string; targetSegmentTime?: string; targetServiceWindow?: { name: string; start: string; end: string } }): string {
  const lines: string[] = []
  
  // ── FIX #1: Suppress generation time for follow-up slots ──
  // When isFollowUpSlot is true AND targetPostTime is provided, AI should ONLY
  // reference the target posting time, not the current generation time.
  // Problem: AI would see "Genereret nu: kl. 13" and incorrectly write rationales
  // for Slot 2 (19:30) and Slot 3 (22:30) mentioning "kl. 13:00".
  if (options?.isFollowUpSlot && options?.targetPostTime) {
    // Follow-up slot: emphasize ONLY the target posting time
    lines.push(`- 🎯 VIGTIGT: Dette opslag er beregnet til kl. ${options.targetPostTime}`)
    lines.push(`- Beskriv UDELUKKENDE situationen kl. ${options.targetPostTime} — IGNORER det nuværende klokkeslæt (${ctx.currentHour}:00)`)
    
    // NEW: Add explicit service period availability context
    if (options?.targetServiceWindow) {
      const { name, start, end } = options.targetServiceWindow
      const postMins = options.targetPostTime.split(':').map(Number).reduce((h, m) => h * 60 + m)
      const serviceMins = start.split(':').map(Number).reduce((h, m) => h * 60 + m)
      
      // Detect service period type for prohibition rules
      const nameLower = name.toLowerCase()
      const isBrunch = nameLower.includes('brunch') || nameLower.includes('morgenmad')
      const isLunch = nameLower.includes('frokost') || nameLower.includes('lunch')
      const isDinner = nameLower.includes('aften') || nameLower.includes('dinner')
      
      if (postMins < serviceMins) {
        // Posting BEFORE service starts - this is a lead-up post
        lines.push(`- 🍽️ MÅLRETTET SERVICE-PERIODE: ${name} (${start}–${end})`)
        lines.push(`- ⚠️ VIGTIGT: Denne ret er FØRST tilgængelig fra kl. ${start}. Opslaget kl. ${options.targetPostTime} er en FORHÅNDSANNONCERING der bygger forventning til ${name}`)
        lines.push(`- 📋 RATIONALE SKAL NÆVNE: At gæster skal booke/komme kl. ${start} eller senere, når ${name} starter`)
      } else {
        // Posting during service
        lines.push(`- 🍽️ MÅLRETTET SERVICE-PERIODE: ${name} (${start}–${end}) — denne ret serveres lige nu`)
      }
      
      // Add explicit prohibitions based on service period type
      if (isBrunch) {
        lines.push(`- ⛔ FORBUDT: Referencer til "frokost", "frokosten", "aftensmad", "aftenens menu", "til aften", eller tidspunkter efter kl. ${end}`)
        lines.push(`- ✅ PÅKRÆVET: Brug kun brunch/morgenmad-kontekst og tidspunkter mellem ${start}–${end}`)
      } else if (isLunch) {
        lines.push(`- ⛔ FORBUDT: Referencer til "aftensmad", "aftenens menu", "til aften", "middag" (som aftensbegivenhed), eller tidspunkter efter kl. ${end}`)
        lines.push(`- ✅ PÅKRÆVET: Brug kun frokost-kontekst og tidspunkter mellem ${start}–${end}. Skriv "frokost-menuen" eller "frokosten" — ALDRIG "aftenens"`)
      } else if (isDinner) {
        lines.push(`- ⛔ FORBUDT: Referencer til "brunch", "frokost", "frokosten", eller tidspunkter før kl. ${start}`)
        lines.push(`- ✅ PÅKRÆVET: Brug kun aften/middag-kontekst og tidspunkter mellem ${start}–${end}`)
      }
    }
    
    if (options?.targetSegmentTime) {
      lines.push(`- 👥 MÅLGRUPPE PÅ DET TIDSPUNKT: ${options.targetSegmentTime} — beskriv hvad der gør dette relevant for DEM på DETTE tidspunkt`)
    }
  } else {
    // Slot A (NOW): show generation time as primary anchor
    lines.push(`- Genereret nu: kl. ${ctx.currentHour}`)
  }

  // Pre-opening guard: if the business hasn't opened yet, make it crystal clear
  // that posts are for TODAY — not tomorrow. Without this, Gemini writes "i morgen".
  // Use natural language that won't leak into output if AI quotes the context.
  if (ctx.todayOpenTime) {
    const [openH] = ctx.todayOpenTime.split(':').map(Number)
    const isPreOpening = ctx.currentHour < openH
    if (isPreOpening) {
      const minsUntilOpen = openH * 60 - ctx.currentHour * 60
      lines.push(`- Planlægningskontekst: Stedet åbner senere i dag kl. ${ctx.todayOpenTime} (om ${minsUntilOpen} min)`)
      lines.push(`- Vigtigt: Dette opslag er for i dag — brug aldrig "i morgen" i titel eller why_explanation`)
      // For pre-opening with target time: already emphasized above in follow-up slot logic
    } else if (!options?.isFollowUpSlot) {
      // Follow-up slots: suppress open time — hours have passed and it makes an irrelevant anchor
      lines.push(`- Åbningstid i dag: kl. ${ctx.todayOpenTime}`)
    }
  }

  // ── PRIMARY TIMING ANCHOR: Active service period (with time window) ──
  // This should be the FIRST thing Gemini sees and uses in rationales
  if (ctx.currentProgram) {
    lines.push(`- 🍽️ AKTIV SERVICE-PERIODE: ${ctx.currentProgram.name} (${ctx.currentProgram.start}–${ctx.currentProgram.end}) — vi serverer dette menukort lige nu`)
  } else if (ctx.activeServicePeriod && ctx.activeServicePeriod !== 'all_day') {
    const periodLabel: Record<string, string> = { 
      dinner: 'aftensmad', 
      brunch: 'brunch/morgenmad', 
      lunch: 'frokost' 
    }
    const label = periodLabel[ctx.activeServicePeriod] ?? ctx.activeServicePeriod
    // Include time window if available from allPrograms
    const program = ctx.allPrograms?.find(p => 
      p.name.toLowerCase().includes(ctx.activeServicePeriod!) ||
      label.includes(p.name.toLowerCase())
    )
    if (program) {
      lines.push(`- 🍽️ AKTIV SERVICE-PERIODE: ${label} (${program.start}–${program.end})`)
    } else {
      lines.push(`- 🍽️ AKTIV SERVICE-PERIODE: ${label}`)
    }
  }
  
  // Secondary timing signals (only shown for Slot A, not follow-up slots)
  if (!options?.isFollowUpSlot) {
    // Follow-up slots omit all closing-time signals — Slot A already owns that urgency anchor.
    // Showing the time (even in a comment) causes Gemini to reproduce it verbatim.
    if (ctx.kitchenCloseTime) lines.push(`- Køkkenet lukker: kl. ${ctx.kitchenCloseTime}`)
    if (ctx.todayCloseTime) lines.push(`- Stedet lukker: kl. ${ctx.todayCloseTime}`)
  }
  lines.push(`- Sæson: ${seasonInDanish(ctx.season)}`)
  if (ctx.outdoorNote?.includes('PERFEKT')) lines.push('- 🌤️ Vejr: PERFEKT til udeservering i dag')

  // Recency: ONLY show dishes that have been ACTUALLY PUBLISHED (not just suggested).
  // If a dish has never been posted, don't mention it at all (no speculation).
  // This ensures claims like "ikke fremhævet i X dage" are factually accurate.
  if (ctx.recentSlotADishesWithAge && ctx.recentSlotADishesWithAge.length > 0) {
    const ageLine = ctx.recentSlotADishesWithAge
      .map(d => `${d.name} (${d.daysAgo}d siden)`)
      .join(', ')
    lines.push(`- Senest postede retter: ${ageLine}`)
  }
  // No "ingen historik" fallback - if there are no published posts, simply omit the line

  return `\n──── TIMING-FACTS (cite mindst én i why_explanation) ────\n${lines.join('\n')}\n`
}

// ────────────────────────────────────────────────────────────────────────────
// SLOT PLANNER
// ────────────────────────────────────────────────────────────────────────────

export async function runSlotPlanner(
  ctx: DagensPromptContext,
  geminiApiKey: string
): Promise<SlotPlannerResult> {
  const defaultSlotAType = ctx.signatureItems.length > 0
    ? 'menu_item'
    : ctx.effectiveVertical === 'bar' ? ctx.dayBehavior.slotBDefault
    : (ctx.effectiveVertical === 'coffee_shop' || ctx.effectiveVertical === 'bakery') ? 'brunch_moment'
    : 'atmosphere'

  const defaultSlotC = ctx.dayBehavior.slotCDefault === 'behind_scenes' ? 'behind_scenes' : 'atmosphere'

  const defaultSlotTypes = [defaultSlotAType, 'atmosphere', defaultSlotC]

  // Only run planner for paid tier
  if (!ctx.isPaidTier || ctx.disabledSlots.includes('offering')) {
    return { slot_types: defaultSlotTypes, rationale: '' }
  }

  const recentMix = ctx.recentSuggestions.slice(0, 6).map((s: any) => s.content_type).join(', ')
  const calendarSignal = ctx.calendarEventFacts.length > 0
    ? `Kommende events: ${ctx.calendarEventFacts.slice(0, 2).join(' | ')}`
    : 'Ingen kommende events'

  const hasBookingMenu = ctx.menuCategories.some(c =>
    /booking|reservation|prix.?fixe|fast.?menu|aftenmenu|festmenu/i.test(c.catName)
  )
  // Count distinct service periods (allPrograms) — more accurate than category count
  const distinctProgramCount = ctx.allPrograms ? ctx.allPrograms.length : 0
  const menuSourceCount = distinctProgramCount >= 2 ? distinctProgramCount
    : ctx.menuCategories.length > 0 ? 1
    : ctx.signatureItems.length > 0 ? 1 : 0

  const menuSignal = hasBookingMenu
    ? 'Menukortet indeholder en tydelig booking/reservations-menu OG et à la carte tilbud'
    : distinctProgramCount >= 2
    ? `${distinctProgramCount} adskilte service-perioder med hvert sit menukort (${ctx.allPrograms!.map(p => p.name).join(', ')})`
    : menuSourceCount === 1 ? '1 menukort' : 'Ingen menukort'

  const segmentSignal = (ctx.audienceBreadth !== 'broad' && ctx.businessModelType !== 'offer_led' && ctx.targetAudienceText)
    ? `Aktivt segment: ${ctx.targetAudienceText}${ctx.activeSegmentAngle ? ` — anbefalet vinkel: ${ctx.activeSegmentAngle}` : ''}${
        ctx.v5ToneNote ? `\n  TONE (V5): ${ctx.v5ToneNote}` : ''
      }${
        ctx.v5CTAType ? `\n  CTA (V5): ${ctx.v5CTAType === 'walk_in' ? 'Inviter til walk-in' : ctx.v5CTAType === 'book_table' ? 'Opfordre til bordbestilling' : 'Understøt impulsbeslutninger'}` : ''
      }${
        ctx.v5ContentAngles && ctx.v5ContentAngles.length > 0 ? `\n  CONTENT ANGLES (V5): ${ctx.v5ContentAngles.join(', ')}` : ''
      }`
    : ctx.audienceBreadth === 'broad' ? 'Bred målgruppe — ingen aktiv segmentering' : ''

  // Active events/specials from confirmedFactsSlotB — these should bias the planner toward
  // atmosphere or menu_item depending on event type
  const specialsSignal = ctx.confirmedFactsSlotB
    .filter(f => f.toLowerCase().startsWith('aktiv event') || f.toLowerCase().startsWith('aktiv'))
    .slice(0, 2)
    .join(' | ')

  const plannerPrompt = `Du er strategisk redaktør for ${ctx.businessName} (${ctx.effectiveVertical}, ${ctx.city || ''}).

Din opgave: Beslut hvad de 3 forslag til dagens opslag skal handle om.
${ctx.userContext ? `\n🎯 STYRENDE KONTEKST FRA VIRKSOMHEDEN (VIGTIGST — lad dette overstyre generiske valg):\n"${ctx.userContext}"\n` : ''}
TILGÆNGELIGE MULIGHEDER:
- "menu_item": Fremhæv en konkret ret eller drink fra menuen
- "atmosphere": Gæstemoment — vis den sociale situation der gør stedet rigtigt at vælge NU
- "behind_scenes": Bag facaden — vis menneskene og praksisserne bag oplevelsen

SIGNALS I DAG:
- Dag: ${ctx.dayName} (${ctx.dayBehavior.danishMode}) | Service-periode: ${ctx.activeServicePeriod || 'all_day'}
- Menu: ${menuSignal}
- ${segmentSignal || 'Ingen segmentdata'}
- Kalender: ${calendarSignal}
${specialsSignal ? `- Aktive events/tilbud: ${specialsSignal}` : ''}
- Seneste mix (undgå gentagelse): ${recentMix || 'ingen historik'}
- businessModelType: ${ctx.businessModelType || 'ukendt'}
${ctx.primaryCopyHook ? `- primaryCopyHook: ${ctx.primaryCopyHook} (brandets primære kommunikationskrog)` : ''}

REGLER:
1. Returner altid præcis 3 slot-typer i rækkefølge (position 1, 2, 3).
2. "menu_item" MÅ bruges to gange KUN hvis: (a) der er en klar booking/reservationsmenu OG en à la carte menu, ELLER (b) der er to adskilte service-perioder med hvert sit menukort (fx morgenmad + aftensmad). I alle andre tilfælde: max ét "menu_item".
3. "behind_scenes" MÅ bruges to gange KUN på dage med stærk BTS-vinkel (mandag/tirsdag + ingen kalender-event).
4. Mindst ét af de 3 slots skal altid være "atmosphere" ELLER "behind_scenes".
5. Hvis ingen menukort findes: brug aldrig "menu_item".
6. Forretningsmodel "offer_led": prioritér "menu_item" + "atmosphere" fremfor segmenterede vinkler.
7. primaryCopyHook "location": Slot 3 skal foretrækkes som "atmosphere" (vis stedet og anledningen frem for køkken-bag-facaden).
8. primaryCopyHook "identity": Slot 3 skal foretrækkes som "behind_scenes" (vis menneskene bag brandet).
9. primaryCopyHook "programme": Slot 2 bør afspejle en tidsbestemt lejlighed (fx afterwork, brunch) fremfor en generisk stemning.

Svar KUN med ét JSON-objekt:
{
  "slot_types": ["menu_item", "atmosphere", "behind_scenes"],
  "rationale": "1-2 sætninger på dansk: hvorfor NETOP denne kombination i dag — nævn den specifikke signal der drev valget (event, menukort-struktur, segment, dag-adfærd)"
}`

  try {
    const plannerRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: 'Svar KUN med ét gyldigt JSON-objekt.' }] },
          contents: [{ role: 'user', parts: [{ text: plannerPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 }
          },
        }),
      }
    )
    if (plannerRes.ok) {
      const pData = await plannerRes.json()
      const pText: string | undefined = pData.candidates?.[0]?.content?.parts?.[0]?.text
      if (pText) {
        const clean = pText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
        const s = clean.indexOf('{')
        const e = clean.lastIndexOf('}')
        if (s >= 0 && e >= 0) {
          const parsed = JSON.parse(clean.slice(s, e + 1))
          const validTypes = ['menu_item', 'atmosphere', 'behind_scenes', 'brunch_moment', 'lunch_moment', 'afterwork_moment']
          if (Array.isArray(parsed.slot_types) && parsed.slot_types.length === 3 && parsed.slot_types.every((t: string) => validTypes.includes(t))) {
            // Guard: if no menu data, strip menu_item from planner output
            const guardedTypes = parsed.slot_types.map((t: string) =>
              (t === 'menu_item' && ctx.signatureItems.length === 0) ? 'atmosphere' : t
            )
            console.log(`🗂️ Planner: [${guardedTypes.join(', ')}] — ${parsed.rationale?.slice(0, 80)}`)
            return { slot_types: guardedTypes, rationale: parsed.rationale || '' }
          }
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ Slot planner failed (non-fatal) — using defaults:', e)
  }

  return { slot_types: defaultSlotTypes, rationale: '' }
}

// ────────────────────────────────────────────────────────────────────────────
// SLOT A PROMPT (Offering)
// ────────────────────────────────────────────────────────────────────────────

export function buildSlotAPrompt(
  ctx: DagensPromptContext,
  slotAExpectedType: string,
  sharedCtx: string,
  sharedRules: string,
  menuBlock: string,
  recentSlotASection: string,
  avoidSection: string,
  options?: { isFollowUpSlot?: boolean; targetPostTime?: string; targetSegmentTime?: string; targetServiceWindow?: { name: string; start: string; end: string } }
): string {
  const isBarVertical = ctx.effectiveVertical === 'bar'
  const isBakeryVertical = ctx.effectiveVertical === 'bakery'
  const isCoffeeVertical = ctx.effectiveVertical === 'coffee_shop'

  const slotAProductRule = isBarVertical
    ? '→ Vælg en DRINK, cocktail, vin eller deletallerken der er det primære tilbud for dette sted — dette er et bar/drinkskoncept. IKKE generiske mad-retter der ikke passer til konceptet.'
    : isBakeryVertical
      ? '→ Vælg ét BAGVÆRK, brød eller kage fra menuen — det primære produkt for dette bageri/konditori. Led med produktet som aktivt substantiv i titlen.'
      : isCoffeeVertical
        ? '→ Vælg én KAFFEDRIK, te eller tilhørende bagværk — det primære produkt for denne kaffebar. Led med produktet som aktivt substantiv i titlen.'
        : '→ Vælg KUN egentlige måltider (forret, main, dessert, brunch-ret) — IKKE snacks, nibbles, dips, nachos, chips, eller retter der primært serveres som tilbehør til drinks. Sådanne retter giver ikke gæsten grund til at komme ind alene.'

  return `Du er social media manager for ${ctx.businessName}. Generer ÉT post-forslag til SLOT A – TILBUD.

──── KONTEKST ────
${sharedCtx}${ctx.calendarEventFacts.length > 0 ? `\nKommende events (reference): ${ctx.calendarEventFacts.slice(0, 2).join(' | ')}` : ''}${ctx.isHybridBusiness ? `\nAktiv profil nu (kl. ${ctx.currentHour}): ${ctx.effectiveVertical} — matche denne profil.` : ''}
Bekræftede facts: Børnemenu: ${ctx.hasKidsMenu ? 'JA' : 'NEJ'} | Takeaway: ${ctx.hasTakeaway ? 'JA' : 'NEJ'}

──── MENU (vælg herfra) ────
${menuBlock}${recentSlotASection}
${sharedRules}

──── SLOT A REGLER ────
${slotAProductRule}
→ ⛔ ABSOLUT KRAV: Du SKAL vælge en ret der IKKE er på listen "Retter brugt nyligt" ovenfor. ALLE retter på listen er FORBUDT — uanset hvor mange dage siden (0-6 dage = seneste uge). Vælg ALTID en anden ret fra menuen. Dette er ikke et forslag — det er en hård regel.
→ dish_text_brief: List den valgte rets ingredienser/karakteristika direkte fra menulisten. Inkluder ALLE ingredienser medmindre retten har 7+ komponenter — vælg da de 5-6 mest visuelle eller smags-definerende. Undgå generiske: "sauce", "salat", "brød". Foretruk specifikke: "syltede rødløg", "24h-marineret kylling".
→ TITLEN SKAL være grammatisk komplet — aldrig afbrudt midt i sætning, altid med korrekt tegnsætning.
→ FORMAT-EKSEMPLER til titel (erstat [RET] med din valgte ret):
  "[RET] og en times pause"
  "To tallerkener [RET] til middag"
  "Frokosttid: [RET] klar nu"
→ Tilbud-tone: ${ctx.dayBehavior.offeringTone}

⏱️ ARBEJDSKONTEKST FOR EJEREN: Dette er en LYNHURTIG arbejdsgang ("POST NU"). Ejeren skal kunne poste INDEN FOR 5 MINUTTER — valget skal være objektivt: "Har vi denne ret? Ja/Nej" og IKKE kræve koordinering med team eller strategiske vurderinger.

${buildTimingSignalBlock(ctx, { isFollowUpSlot: options?.isFollowUpSlot, targetPostTime: options?.targetPostTime, targetSegmentTime: options?.targetSegmentTime, targetServiceWindow: options?.targetServiceWindow })}
${ctx.isPaidTier ? `why_explanation FORMAT — 2 SÆTNINGER — følg denne præcise struktur:

(a) TIDSVINDUE (PRIORITERET RÆKKEFØLGE — vælg den første der passer):
${options?.isFollowUpSlot
  ? `   1. Aktiv service-periode med tidsvindue (se TIMING-FACTS): "Vi er midt i frokostservicen (12:00-15:00)" eller "Aftenmenuen er aktiv lige nu (17:00-22:00)"
   2. NUVÆRENDE klokkeslæt: "Klokken er ${ctx.currentHour}:00 — [kontekst]"
   ⛔ FORBUDT: Åbningstidspunkt (irrelevant nu) og køkkentider (allerede brugt i Slot A).${ctx.outdoorNote?.includes('PERFEKT') ? '\n   🌤️ VEJR: Det er PERFEKT vejr til udeservering i dag — DU SKAL nævne det i denne sætning.' : ''}`
  : `   1. Aktiv service-periode med tidsvindue (se TIMING-FACTS): "Vi serverer frokost lige nu (12:00-15:00)" eller "Aftenmenuen er aktiv til kl. 22:00"
   2. Nuværende tidspunkt: "Klokken nærmer sig ${ctx.currentHour}:00 — [hvad tænker gæsterne på?]"
   3. KUN hvis stedet IKKE er åbent endnu: "Stedet åbner kl. [open]"
   ⛔ FORBUDT: Køkkentider alene uden service-periode-kontekst.${ctx.outdoorNote?.includes('PERFEKT') ? '\n   🌤️ VEJR: Det er PERFEKT vejr til udeservering i dag — DU SKAL nævne det i denne sætning.' : ''}`}

(b) DETTE VALG — KOMBINER 3 elementer i ÉN velstruktureret sætning:
   SENSORISK → ROTATION → STRATEGISK VÆRDI
   
${buildRecencyRationaleBlock('[audience/tidspunkt]')}
   
   EKSEMPLER på STRATEGISK VÆRDI:
   - "giver frisk synlighed til frokostgæster kl. 13:00"
   - "introducerer signaturret til aftenssegmentet"
   - "matcher perfekt til ${ctx.outdoorNote?.includes('PERFEKT') ? 'dagens perfekte udeservering' : seasonInDanish(ctx.season)}"
   - "appellerer til ${ctx.dayName.toLowerCase()}s gæster der søger [konkret behov]"
   
   FORBUDT:
  ❌ "Retten er ikke fremhævet for nylig" (standalone — mangler sensorisk + strategisk værdi)
   ❌ "Passer til sæsonen" (generisk — hvad specifikt matcher?)
   ❌ "klassiker", "hyggelig", "[ugedag]sstemning" (vage meninger)
   
  ✅ GOD: "Hjemmelavet pastadej med svampe og trøffel. Sidst fremhævet for 6 dage siden, hvilket giver frisk synlighed til aftensgæster kl. 19:30"
  ✅ GOD: "Hjemmelavet pastadej med svampe og trøffel. Aldrig fremhævet endnu, hvilket giver frisk synlighed til aftensgæster kl. 19:30"
  ❌ DÅRLIG: "Denne ret er ikke fremhævet for nylig og passer til torsdagsstemningen"

✅ GODT EKSEMPEL:
"Vi serverer frokost lige nu (12:00-15:00) — Faustburger passer perfekt til frokosten. Sidst fremhævet for 8 dage siden, hvilket giver frisk synlighed til gæster i den aktive service-periode."

❌ DÅRLIGT EKSEMPEL:
"Køkkenet åbner kl. Denne ret er ikke fremhævet i den seneste uge og passer til den let festlige torsdagsstemning."

⛔ FORBUDT:
- "klassiker", "hyggelig", "passer til sæsonen" som standalone
- Kalenderdag-"energi" eller vage "stemninger" ("torsdagsstemning", "mandagsstart")
- Nævne retter fra "Retter brugt nyligt" listen (0-6 dage)
- Køkkentider uden service-periode-kontekst

` : ''}occasion_context FORMAT — 1 SÆTNING (creative brief for Stage 2 AI):
Beskriv SITUATIONEN eller LEJLIGHEDEN der gør denne ret relevant NU.
- Brug konkrete udtryk: "ved åen", "frokostpause", "aftensmøde", "weekend brunch"
- Fokuser på GÆSTens moment, ikke stedet eller retten
- Vær konkret og sensorisk — undgå abstrakt marketing-sprog

EKSEMPLER på occasion_context:
✅ "Frokostpause ved åen midt på dagen"
✅ "Weekend brunch når solen rammer bordet"
✅ "Aftensmøde efter arbejdstid med kollegerne"
✅ "Rolig eftermiddagskaffe mellem to ærinder"
❌ "Dette er det perfekte tidspunkt" (for generisk)
❌ "Kl. 13:00 i frokostservicen" (for system-level)

media_suggestion: Trin-for-trin guide til mobiltelefon-foto (3 imperative sætninger):
${buildMenuMediaInstruction({ isCravingVisual: false, language: 'da' })}${avoidSection}

Svar KUN med ét JSON-objekt (ingen array):
{
  "title": "Kort post-titel (3–7 ord)",
  "menu_item_name": "Det SPECIFIKKE rettens navn fra menulisten — IKKE kategori-overskrift som 'Brunchtilbud' eller 'Dagsmenu'",
  "dish_text_brief": "Ingredienser/karakteristika",${ctx.isPaidTier ? `
  "why_explanation": "2 sætninger: (a) tidsvindue med præcist klokkeslæt, (b) verificerbar grund til dette valg",
  "occasion_context": "1 sætning som beskrevet — konkret situation/lejlighed",` : ''}
  "media_suggestion": {
    "primary": { "type": "photo", "instruction": "3 konkrete imperativ-sætninger" },
    "alternatives": []
  },
  "content_type": "${slotAExpectedType}",
  "slot": "offering"
}`
}

// ────────────────────────────────────────────────────────────────────────────
// SLOT B PROMPT (Guest Moment)
// ────────────────────────────────────────────────────────────────────────────

export function buildSlotBPrompt(
  ctx: DagensPromptContext,
  plannedSlotBType: string,
  slotBIsMenu: boolean,
  sharedCtx: string,
  sharedRules: string,
  menuBlock: string,
  recentSlotASection: string,
  confirmedFactsSlotBBlock: string,
  avoidSection: string,
  targetPostTime?: string,
  targetSegmentTime?: string,
  targetServiceWindow?: { name: string; start: string; end: string }
): string {
  const isBarVertical = ctx.effectiveVertical === 'bar'
  const isBakeryVertical = ctx.effectiveVertical === 'bakery'
  const isCoffeeVertical = ctx.effectiveVertical === 'coffee_shop'

  const slotAProductRule = isBarVertical
    ? '→ Vælg en DRINK, cocktail, vin eller deletallerken der er det primære tilbud for dette sted — dette er et bar/drinkskoncept. IKKE generiske mad-retter der ikke passer til konceptet.'
    : isBakeryVertical
      ? '→ Vælg ét BAGVÆRK, brød eller kage fra menuen — det primære produkt for dette bageri/konditori. Led med produktet som aktivt substantiv i titlen.'
      : isCoffeeVertical
        ? '→ Vælg én KAFFEDRIK, te eller tilhørende bagværk — det primære produkt for denne kaffebar. Led med produktet som aktivt substantiv i titlen.'
        : '→ Vælg KUN egentlige måltider (forret, main, dessert, brunch-ret) — IKKE snacks, nibbles, dips, nachos, chips, eller retter der primært serveres som tilbehør til drinks. Sådanne retter giver ikke gæsten grund til at komme ind alene.'

  if (slotBIsMenu) {
    const slotBMenuNote = `\n\nOBS: Slot A fremhæver allerede ét tilbud. Dette slot B skal fremhæve ET ANDET tilbud med en ANDEN vinkel:\n- Vælg en ret/drink fra en ANDEN menukategori eller service-periode end Slot A.\n- Vinklen kan være booking/reservation, aftenmenu, speciel anledning, eller et format der adskiller sig fra hverdagsmenuen.\n- Brug "menu_item_name" og "dish_text_brief" som for Slot A.\n${recentSlotASection}`

    return `Du er social media manager for ${ctx.businessName}. Generer ÉT post-forslag til SLOT B – TILBUD (andet end Slot A).

──── KONTEKST ────
${sharedCtx}${ctx.calendarEventFacts.length > 0 ? `\nKommende events (reference): ${ctx.calendarEventFacts.slice(0, 2).join(' | ')}` : ''}${ctx.isHybridBusiness ? `\nAktiv profil nu (kl. ${ctx.currentHour}): ${ctx.effectiveVertical} — matche denne profil.` : ''}
Bekræftede facts: Børnemenu: ${ctx.hasKidsMenu ? 'JA' : 'NEJ'} | Takeaway: ${ctx.hasTakeaway ? 'JA' : 'NEJ'}${slotBMenuNote}

──── MENU (vælg herfra — vælg IKKE den samme ret/kategori som Slot A) ────
${menuBlock}

${sharedRules}

──── SLOT B MENU-REGLER ────
${slotAProductRule}
→ ⛔ ABSOLUT KRAV: Du SKAL vælge en ret der IKKE er på listen "Retter brugt nyligt" ovenfor. ALLE retter på listen er FORBUDT — uanset hvor mange dage siden (0-6 dage = seneste uge). Vælg ALTID en anden ret fra menuen. Dette er ikke et forslag — det er en hård regel.
→ dish_text_brief: List rettens ingredienser/karakteristika direkte fra menulisten.
→ Vinkel SKAL adskille sig fra Slot A — brug en anden service-periode, kategori eller social ramme.
→ Tilbud-tone: ${ctx.dayBehavior.offeringTone}

${buildTimingSignalBlock(ctx, { isFollowUpSlot: true, targetPostTime, targetSegmentTime, targetServiceWindow })}
why_explanation FORMAT — 3 sætninger med strategisk rationale:
(a) TIDSVINDUE: Se TIMING-FACTS. Citer det MÅLRETTEDE klokkeslæt (kl. ${targetPostTime || 'fra TIMING-FACTS'}). Sæt retten i kontekst af dag-adfærd (${ctx.dayBehavior.danishMode})${(ctx.audienceBreadth !== 'broad' && ctx.businessModelType !== 'offer_led' && ctx.targetAudienceText) ? ` eller segment ('${ctx.targetAudienceText}')` : ''}. FORBUDT: genereringstidspunkt fra TIMING-FACTS.
(b) ROTATION + TIMING STRATEGI — KOMBINER i ÉN velstruktureret sætning:
   SENSORISK → ROTATION → STRATEGISK VÆRDI
   
${buildRecencyRationaleBlock('[audience] kl. [targetPostTime]')}
   
   EKSEMPLER:
   ✅ "Andeconfit med sitrus og sprød overflade. Ikke vist i 6 dage, hvilket giver frisk synlighed til aftensgæster kl. 19:30"
   ✅ "Hjemmelavet pastadej med sæsonsvampe. Aldrig fremhævet — introducerer signaturret til aftensegmentet"
   ❌ "Denne ret er ikke fremhævet for nylig og passer til aftensstemningen" (mangler sensorisk + specifik værdi)
(c) KONTRAST: I ét konkret led — hvad tilbyder DENNE ret gæsten, som adskiller sig fra Slot A's valg? Fx: en anden service-periode (aftensmad vs. frokost), sensorisk kontrast (let vs. fyldigt), eller en social anledning retten passer særlig godt til. Intet system-sprog om slots.
❌ UNDGÅ: imperativ-tone, tilbudssprog, "forkæl dig selv", "kom ind", "nyd", system-jargon ("slots", "tilbuds-slots").

occasion_context FORMAT — 1 SÆTNING (creative brief):
Beskriv den konkrete lejlighed eller situation for DENNE ret lige nu.
EKSEMPLER:
✅ "Frokostbordet ved vandet med godt selskab"
✅ "Aftensmenu når dagen tager af"
✅ "Weekend eftermiddag med venner til bordet"
❌ "Perfekt tidspunkt at komme ind" (marketing-sprog)

media_suggestion: Trin-for-trin guide til mobiltelefon-foto (3 imperative sætninger):
${buildMenuMediaInstruction({ isCravingVisual: false, language: 'da' })}
${avoidSection}
Svar KUN med ét JSON-objekt (ingen array):
{
  "title": "Kort post-titel (3–7 ord)",
  "menu_item_name": "Det SPECIFIKKE rettens navn fra menulisten",
  "dish_text_brief": "Ingredienser/karakteristika",
  "why_explanation": "3 sætninger som beskrevet",
  "occasion_context": "1 sætning — konkret situation/lejlighed",
  "media_suggestion": {
    "primary": { "type": "photo", "instruction": "3 konkrete imperativ-sætninger" },
    "alternatives": []
  },
  "content_type": "menu_item",
  "slot": "guest_moment"
}`
  }

  // Default atmosphere/guest moment prompt
  return `Du er social media manager for ${ctx.businessName}. Generer ÉT post-forslag til SLOT B – GÆSTEMOMENT.

──── KONTEKST ────
${sharedCtx}${ctx.calendarEventFacts.length > 0 ? `\nKommende events (reference): ${ctx.calendarEventFacts.slice(0, 2).join(' | ')}` : ''}${ctx.isHybridBusiness ? `\nAktiv profil nu (kl. ${ctx.currentHour}): ${ctx.effectiveVertical} — matche denne profil.` : ''}${confirmedFactsSlotBBlock}
${sharedRules}

──── SLOT B REGLER ────
→ VIS den sociale situation som gør dette sted relevant LIGE NU — hvem kommer, hvorfor, og hvad gør de.
→ TITLEN skal fange gæstens øjeblik — ikke stedet, ikke produktet, ikke interiøret, men situationen.
→ TITLEN SKAL være grammatisk komplet — aldrig afbrudt midt i sætning, altid med korrekt tegnsætning (- eller ,).
→ concrete_anchor: Vælg ÉT faktum fra BEKRÆFTEDE SERVICE-FACTS ovenfor. MAKS 80 tegn.
→ FORMAT-EKSEMPLER til titel:
  ✅ "Fredag kalder — afgørelsen skal træffes nu"
  ✅ "Mellem to møder og en halv times ro"
  ✅ "Når solen rammer bordet kl. 14"
  ✅ "Køkkenet lukker tidligt — baren holder åben til 02"
  ❌ "Køkkenet lukker tidligt baren holder" (ufuldstændig, mangler tegnsætning)
  ❌ "Bar åben til" (ufuldstændig)
→ FORBUDT: "Kom ind", "Nyd", passiv stedsbeskrivelse, ruminventar, lys som titelsubjekt

why_explanation FORMAT — 3 SÆTNINGER — alle tre skal være specifikt begrundede:
(a) SITUATION: Se TIMING-FACTS. Hvis der er angivet "MÅLRETTET POSTETID" → beskriv gæsterne på DET tidspunkt (ikke nu). Ellers beskriv gæsterne NU. Brug dag (${ctx.dayName}) og det relevante klokkeslæt som anchor. Hvem er gæsterne og hvad gør de? FORBUDT: "Køkkenet holder åbent til kl. X" — det er Slot A's urgency-anchoret; brug ikke samme sætning her.
(b) MATCH: Citer ét konkret faktum fra BEKRÆFTEDE SERVICE-FACTS der gør DETTE sted til det rigtige svar — fx udeservering, aktiv service-periode, stedets beliggenhed, eller program. FORBUDT: "stemningen", "den gode energi", "vi elsker vores gæster". Vælg et ANDET fact end køkkenlukningstidspunktet OG åbningstidspunktet.
(c) STRATEGI: Nævn den navngivne signal der drev valget — dag-adfærd (${ctx.dayBehavior.danishMode}), aktivt segment${ctx.targetAudienceText ? ` ("${ctx.targetAudienceText}")` : ''}, kalender-event, eller at atmosfære-formatet mangler i historikken.
→ ✅ GOD: "${ctx.dayName} kl. ${ctx.currentHour} er det klassiske tidspunkt hvor vennegruppen eller kollegerne skal beslutte sig. Der er god tid — ingen stress. Atmosfære valgt fordi ${ctx.dayBehavior.danishMode}-profilen prioriterer social invitation frem for menu-fokus."
→ ❌ DÅRLIG: "Der er god stemning på stedet nu. Det er det perfekte sted at mødes. Valgt fordi det passer til dagen."

occasion_context FORMAT — 1 SÆTNING (creative brief):
Beskriv den sociale scene eller situation lige nu.
EKSEMPLER:
✅ "${ctx.dayName.toLowerCase()} eftermiddag ved åen med venner"
✅ "Pause mellem møder med udsigt til vandet"
✅ "Stille morgen før byen vågner"
❌ "God stemning til at mødes" (for generisk)

media_suggestion: Trin-for-trin guide til mobiltelefon-foto (3 imperative sætninger) — dette er en ATMOSFÆRE/STEMNINGSPOST, IKKE en ret-post:
${buildAtmosphereMediaInstruction({ 
  contentType: 'atmosphere', 
  suggestedTime: ctx.currentHour ? `${ctx.currentHour}:00` : '12:00',
  locationContext: ctx.city?.toLowerCase().includes('å') ? 'åen' : undefined,
  language: 'da' 
})}${avoidSection}

Svar KUN med ét JSON-objekt (ingen array):
{
  "title": "Kort post-titel (3–7 ord)",
  "concrete_anchor": "Bekræftet fact valgt fra listen ovenfor",
  "why_explanation": "3 sætninger som beskrevet",
  "occasion_context": "1 sætning — scene/situation",
  "media_suggestion": {
    "primary": { "type": "photo", "instruction": "3 konkrete imperativ-sætninger" },
    "alternatives": []
  },
  "content_type": "${plannedSlotBType}",
  "slot": "guest_moment"
}`
}

// ────────────────────────────────────────────────────────────────────────────
// SLOT C PROMPT (Brand/Behind Scenes)
// ────────────────────────────────────────────────────────────────────────────

export function buildSlotCPrompt(
  ctx: DagensPromptContext,
  slotCType: string,
  sharedCtx: string,
  sharedRules: string,
  confirmedFactsSlotCBlock: string,
  menuIntelligenceBlock: string,
  avoidSection: string,
  targetPostTime?: string,
  targetSegmentTime?: string,
  targetServiceWindow?: { name: string; start: string; end: string }
): string {
  const effectiveSlotC = slotCType === 'behind_scenes' ? 'behind_scenes' : 'atmosphere'
  const btsActivityWindow = getBTSActivityWindow(
    ctx.todayOpenTime ?? null,
    ctx.todayCloseTime ?? null,
    ctx.effectiveVertical ?? null,
  )
  
  const btsAnchors = effectiveSlotC === 'behind_scenes'
    ? getBTSAnchors(ctx.effectiveVertical, ctx.currentHour)
    : []
  
  const btsAnchorsBlock = btsAnchors.length > 0
    ? `\n→ BTS INSPIRATIONSVINKLER (vælg én som udgangspunkt — disse er spørgsmål, ikke krav. Kombiner med konkrete facts fra BEKRÆFTEDE FACTS):\n${btsAnchors.map(a => `  • ${a}`).join('\n')}`
    : ''

  const slotCHeader = effectiveSlotC === 'behind_scenes' ? 'BAG FACADEN' : 'BRAND/INVITATION'
  
  const slotCWhyFormat = effectiveSlotC === 'behind_scenes'
    ? `(a) MENNESKENE: ÉT specifikt faktum om en navngiven person, rolle eller praksis bag oplevelsen — fra BEKRÆFTEDE FACTS. Ikke generisk teamsprog. FORBUDT: "vores passion", "varmen fra teamet", "den gode energi bag kulisserne".\n(b) GÆSTENS OPLEVELSE: Hvad dette faktum konkret betyder for gæsten — tryghed, genkendelighed, forbindelsen til stedet. Angiv effekten specifikt, ikke følelsesmæssigt ("grunden til at folk vender tilbage" ✅, "folk føler sig velkomne" ❌).\n(c) STRATEGI: Nævn det navngivne signal der drev valget — aktivt segment${ctx.targetAudienceText ? ` ("${ctx.targetAudienceText}")` : ''}, dag (${ctx.dayName}), mangel på BTS-indhold i historikken, eller specifikt brand-anker fra BEKRÆFTEDE FACTS.`
    : `(a) SITUATION: ÉN konkret social anledning gæsten befinder sig i NU — brug dag (${ctx.dayName}) og NUVÆRENDE klokkeslæt (kl. ${ctx.currentHour}) som tidsanchor. Hvad laver gæsterne specifikt? FORBUDT: "Køkkenet holder åbent til kl. X" — det er Slot A's urgency-anchoret; brug ikke samme sætning her.\n(b) MATCH: Citer ét konkret faktum fra BEKRÆFTEDE FACTS — fx udeservering, stedets beliggenhed, aktiv service-periode, eller program. Vælg et ANDET fact end køkkenlukningstidspunktet OG åbningstidspunktet. FORBUDT: "stemningen er god", "der er god energi".\n(c) STRATEGI: Nævn det navngivne signal der drev valget af atmosfære-vinkel frem for tilbuds-vinkel — dag-adfærd (${ctx.dayBehavior.danishMode}), segment, kalender-event, eller historik.`

  const slotCGoodExample = effectiveSlotC === 'behind_scenes'
    ? `"Kasper bag baren kender halvdelen af gæsterne ved navn og har styr på deres stamdrink. Den slags genkendelse er grunden til at folk vender tilbage frem for at prøve noget nyt. Bag-facaden-vinkel valgt fordi det aktive segment er stamgæster og atmosfære-formatet er brugt de to seneste dage."`
    : `"${ctx.dayName} kl. ${ctx.currentHour} og vennegruppen skal beslutte sig i løbet af de næste 30 minutter. Der er god tid til både middag og aftenbaren. Valgt fordi ${ctx.dayBehavior.danishMode}-profilen prioriterer social invitation og bag-facaden ikke er brugt i dag."`

  const slotCBadExample = effectiveSlotC === 'behind_scenes'
    ? `"Teamet klargør lokalet til dagens gæster. Det er vigtigt for os at alt er perfekt." — ruminventar og generisk teamsprog, ingen person, ingen strategi.`
    : `"Stemningen er indbydende og der er god energi hos os. Kom ind og oplev det!" — ingen situation, ingen strategi, imperativ-tone.`

  return `Du er social media manager for ${ctx.businessName}. Generer ÉT post-forslag til SLOT C – ${slotCHeader}.

──── KONTEKST ────
${sharedCtx}${ctx.visualCharacter ? `\nKonceptkarakter (toneregister — IKKE titelsubjekt): ${ctx.visualCharacter}` : ''}${ctx.venueScene ? `\nScenestemning: ${ctx.venueScene}` : ''}${ctx.venueEnergyText ? `\nEnergi/vibe: ${ctx.venueEnergyText}` : ''}${ctx.guestSituation ? `\nGæstesituation: ${ctx.guestSituation}` : ''}${ctx.isHybridBusiness ? `\nAktiv profil nu (kl. ${ctx.currentHour}): ${ctx.effectiveVertical}` : ''}${confirmedFactsSlotCBlock}${menuIntelligenceBlock}${avoidSection}${ctx.selectionBiasBlock}
${sharedRules}

──── SLOT C REGLER ────
${effectiveSlotC === 'behind_scenes'
    ? (ctx.isPaidTier 
        ? `→ VIS MENNESKENE bag oplevelsen — teamet, en specifik medarbejder, en service-praksis der skaber tillid og loyalitet.
→ TITLEN skal handle om en PERSON, en RELATION eller en HANDLING der forbinder teamet med gæsterne — aldrig om et rum eller en ting der forberedes.
→ TITLEN SKAL være grammatisk komplet — aldrig afbrudt midt i sætning, altid med korrekt tegnsætning.
→ FORMAT-EKSEMPLER til titel (personen og relationen driver titlen):
  ✅ "Samme ansigt bag baren hver onsdag"
  ✅ "Line kender din ordre inden du sætter dig"
  ✅ "Brødet bagt fra bunden — gæsterne mærker det"
→ FORBUDT TITELFORMAT:
  ❌ "Vi + [klargøre/stå/forberede]" → fx "Vi står ved åen og gør klar"
  ❌ "[Rum/møbel] gøres klar" → fx "Bordet dækkes", "Lokalet gøres klar"`
        : `→ DU ER OBSERVATØR — ikke historiefortæller.

ROLLE: Du beskriver præcist hvad der ER — menneskene, stedet, servicen.
GRÆNSE: Du må KUN rapportere verificerbare facts fra BEKRÆFTEDE FACTS og MENU nedenfor.
KONSEKVENS: Hvis du ikke kan verificere det i data, eksisterer det ikke.

Eksempel på GRÆNSEN:
- Data viser: "BURGER med hakkebøf" 
- Du skriver: "Børnemenu med burger og fritter" ✅
- Du skriver IKKE: "Hænder former burgerboller" ❌ (opfundet — ikke i data)
- Du skriver IKKE: "Kærnermælk fra egen gård" ❌ (opfundet — ikke i data)

→ TITLEN skal handle om en PERSON, en RELATION eller HVAD gæsten får — aldrig om HOW mad laves (med mindre det står eksplicit i FACTS).
→ TITLEN SKAL være grammatisk komplet — aldrig afbrudt midt i sætning, altid med korrekt tegnsætning.
→ FORBUDT TITELFORMAT:
  ❌ "Vi + [klargøre/stå/forberede]" → fx "Vi står ved åen og gør klar"
  ❌ "[Rum/møbel] gøres klar" → fx "Bordet dækkes", "Lokalet gøres klar"
  ❌ Opfundet tilberedning: "Hænder former...", "Vi hakker selv...", "Fra egen have..." (med mindre EKSPLICIT i FACTS)`)
    : `→ SOCIAL INVITATION: Hvilken anledning, social energi eller stemning gør dette sted til det rigtige valg NETOP NU?
→ TITLEN SKAL være grammatisk komplet — aldrig afbrudt midt i sætning, altid med korrekt tegnsætning.
→ Sælg oplevelsen som svar på en social situation. Invitér — beskriv ikke.
→ FORBUDT: passiv stedsbeskrivelse, ruminventar, lys og overflader som titelsubjekt`}${ctx.emotionalPromise ? `\n→ 💡 BRANDFØLELSE: ${ctx.emotionalPromise}` : ''}${ctx.contentExclusions ? `\n→ 🚫 ALDRIG I DETTE OPSLAG: ${ctx.contentExclusions}` : ''}
→ Aktivitetsvindue i køkken/service lige nu: ${btsActivityWindow}${btsAnchorsBlock}
→ concrete_anchor: Vælg ÉT faktum fra BEKRÆFTEDE FACTS ovenfor. MAKS 80 tegn — ét faktum, én kort sætning, ingen forklaring.${effectiveSlotC === 'behind_scenes' ? (ctx.isPaidTier ? ' Anker SKAL handle om en PERSON, NAVNGIVEN PRAKSIS eller TEAMHANDLING — IKKE et rum, møbel eller klargøringsoperation.' : ' Anker SKAL handle om en PERSON eller HVAD gæsten får — ALDRIG HOW noget laves med mindre det er verificeret i BEKRÆFTEDE FACTS.') : ' En konkret handling, et rum eller en service er alle gyldige.'}
  FORBUDT: "varmen fra teamet", "den gode energi bag kulisserne", "vores passion" — meninger, ikke fakta.${ctx.isPaidTier ? '' : '\n  HUSK GRÆNSEN: Hvis det ikke står i BEKRÆFTEDE FACTS eller MENU, må du ikke skrive det.'}${effectiveSlotC === 'behind_scenes'
    ? (ctx.isPaidTier 
        ? '\n  GYLDIGT: "Kasper bag baren kender halvdelen af gæsterne ved navn", "Børnemenu med burger og fritter"' 
        : '\n  GYLDIGT: "Kasper bag baren kender halvdelen af gæsterne ved navn", "Børnemenu med burger og fritter"\n  IKKE GYLDIGT: "Vi former burgerboller selv" (opfundet — ikke i FACTS), "Kærnermælk fra egen gård" (opfundet)')
    : '\n  GYLDIGT: "Åbent køkken med udsyn til gæsterne", "Bar åben fra kl. 17"'}

why_explanation FORMAT — 3 sætninger med strategisk rationale (ejeren skal forstå HVORFOR denne vinkel, HVEM den taler til, og hvad der drev valget):
${slotCWhyFormat} — aktivt segment${(ctx.audienceBreadth !== 'broad' && ctx.businessModelType !== 'offer_led' && ctx.targetAudienceText) ? ` ('${ctx.targetAudienceText}')` : ''}, dag, mangel på variation i historikken eller et specifikt brand-anker.
✅ GODT EKSEMPEL: ${slotCGoodExample}
❌ DÅRLIGT EKSEMPEL: ${slotCBadExample}

occasion_context FORMAT — 1 SÆTNING (creative brief):
${effectiveSlotC === 'behind_scenes'
  ? `Beskriv hvad der sker bag facaden lige nu.\nEKSEMPLER:\n✅ "Morgenforberedelse i køkkenet før første gæst"\n✅ "Barklargøring til aftenrush"\n❌ "Vi arbejder hårdt" (for generisk)`
  : `Beskriv den sociale situation.\nEKSEMPLER:\n✅ "Pause mellem møder med kaffe ved åen"\n✅ "Weekend eftermiddag med venner omkring bordet"\n❌ "God stemning at mødes i" (for generisk)`}

media_suggestion: Trin-for-trin guide til mobiltelefon-foto (3 imperative sætninger):
${effectiveSlotC === 'behind_scenes'
    ? buildBehindScenesMediaInstruction({ language: 'da' })
    : buildAtmosphereMediaInstruction({ 
        contentType: 'atmosphere', 
        suggestedTime: ctx.currentHour ? `${ctx.currentHour}:00` : '12:00',
        locationContext: ctx.city?.toLowerCase().includes('å') ? 'åen' : undefined,
        language: 'da' 
      })}

Svar KUN med ét JSON-objekt (ingen array) — UNDGÅ at tilføje felter der IKKE er nævnt (fx menu_item_name hører til slot A, ikke til bag-facaden-slot):
{
  "title": "Kort post-titel (3–7 ord)",
  "concrete_anchor": "Bekræftet fact valgt fra listen ovenfor",
  "why_explanation": "3 sætninger som beskrevet",
  "occasion_context": "1 sætning — konkret situation",
  "media_suggestion": {
    "primary": { "type": "photo", "instruction": "3 konkrete imperativ-sætninger" },
    "alternatives": []
  },
  "content_type": "${slotCType}",
  "slot": "brand_behind"
}`
}
