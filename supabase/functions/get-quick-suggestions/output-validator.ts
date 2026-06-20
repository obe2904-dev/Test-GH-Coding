/**
 * Output Validator
 *
 * Post-generation validation and repair for Gemini suggestion objects.
 * Runs after all Gemini calls, before persist-to-DB.
 *
 * Responsibilities:
 *  1. Anchor repair: ensure concrete_anchor refers to a real confirmed fact
 *  2. Ingredient hallucination guard: flag why_explanation sentences that mention
 *     ingredients not present in dish_text_brief
 *  3. Weather tone guard: strip positive outdoor/weather framing when conditions are poor
 *  4. Cross-slot characterization repair: ensure why_explanation doesn't reference the
 *     content_type of a different slot
 *  5. Promotional copy sanitization: remove forbidden salesy phrases from why_explanation
 *  6. Kitchen-close time anchor guard: when isFoodEligible=false, strip time references
 *     that imply food is still being served
 *
 * These are SILENT corrections — no error is thrown, original text is logged alongside
 * the corrected text so the change is traceable.
 */

import type { SlotTiming } from './operational-timeline.ts'

export type RawSuggestion = {
  title?: string
  menu_item_name?: string
  dish_text_brief?: string
  why_explanation?: string
  occasion_context?: string
  concrete_anchor?: string
  content_type?: string
  slot?: string
  photo_idea?: string
  [key: string]: unknown
}

// ── Promotional copy patterns (always stripped from why_explanation) ──────────

const WHY_CAPTION_RE = new RegExp(
  [
    'tag\\s+din\\s+(veninde|ven|kæreste|mor|far|chef)\\b',
    'kan\\s+bookes?\\s+(nu|her|direkte)',
    'skriv\\s+til\\s+os\\s+(nu|for)',
    'klik\\s+på\\s+linket',
    '\\d{1,2}\\s+sæder?\\s+tilbage',
    'begrænset\\s+(antal\\s+)?pladser?',
    'kun\\s+(\\d+|et\\s+par)\\s+dage?\\s+tilbage',
    '(first|first-come|først\\s+til)',
    '(DM|dm)\\s+os',
    'book\\s+(nu|her|direkte)(?!\\s+(?:bord|et\\s+bord|plads))',
  ].join('|'),
  'gi'
)

// ── Hallucination guard: known safe ingredient signal words ──────────────────
// These words are safe even if not in dish_text_brief (they describe cooking method or generic concept)
const SAFE_GENERIC_CULINARY = new Set([
  'serveret', 'tilberedt', 'grillet', 'stegt', 'bagt', 'kogt', 'røget',
  'hjemmelavet', 'frisk', 'sæsonens', 'dagens', 'klassisk', 'traditionel',
  'let', 'svampet', 'luftig', 'sprød', 'saftig', 'mild', 'cremet',
  'retten', 'retterne', 'menuen', 'serveringen',
])

// Common ingredient words that should ONLY appear if they're in the dish description
const INGREDIENT_WORDS = /\b(oksekød|kalvekød|lammekød|svinekød|svinemørbrad|kylling|kalkun|and|fisk|laks|torsk|rejer|kammuslinger|bacon|pølser|chorizo|parmesan|pecorino|guanciale|truffle|trøffel|ansjoviser|kapers|jalapeño|avocado|ricotta|burrata|taleggio|gorgonzola|pancetta|prosciutto|bresaola|mortadella|coppa|nduja|rodfrugter|kartofler|løg|gulerødder|selleri|porre|kål|broccoli|blomkål|asparges|svampe|champignon|tomat|paprika|chili|aubergine|squash|ærter|bønner|linser|persille|basilikum|timian|rosmarin|oregano)\b/gi

/**
 * Scan a why_explanation string for ingredient references not backed by dish_text_brief.
 * Returns sentences that contain likely hallucinated ingredient claims.
 */
function detectHallucinatedIngredients(
  whyExplanation: string,
  dishTextBrief: string | undefined,
): string[] {
  if (!dishTextBrief || !whyExplanation) return []

  // Build a set of words from the dish description (normalise case and remove punctuation)
  const briefWords = new Set(
    dishTextBrief
      .toLowerCase()
      .replace(/[^a-zæøå\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2),
  )

  const sentences = whyExplanation.split(/(?<=[.!?])\s+/)
  const flagged: string[] = []

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase()
    
    // Check for specific ingredient mentions
    const ingredientMatches = [...lower.matchAll(INGREDIENT_WORDS)]
    if (ingredientMatches.length > 0) {
      // Check if ANY of these ingredients are NOT in the dish description
      const hallucinated = ingredientMatches.some(match => {
        const ingredient = match[0]
        return !briefWords.has(ingredient) && !dishTextBrief.toLowerCase().includes(ingredient)
      })
      
      if (hallucinated) {
        flagged.push(sentence.trim())
        continue
      }
    }

    const words = lower.replace(/[^a-zæøå\s]/g, ' ').split(/\s+/).filter(w => w.length > 3)
    
    // Check for ingredient claims (words that appear in why_explanation but NOT in dish brief)
    // and are not safe generic culinary terms
    const unknownSpecifics = words.filter(w =>
      !briefWords.has(w) &&
      !SAFE_GENERIC_CULINARY.has(w) &&
      w.length > 4, // ignore short words
    )
    // Only flag if the sentence also contains a possessive or quality claim pattern
    const hasQualityClaim = /\b(med|indeholder|lavet af|tilsat|krydret|garneret|toppet|serveres med)\b/i.test(sentence)
    if (unknownSpecifics.length >= 3 && hasQualityClaim) {
      flagged.push(sentence.trim())
    }
  }

  return flagged
}

/**
 * Strip sentences with hallucinated ingredients from why_explanation.
 * Returns cleaned text with hallucinated sentences removed.
 */
function stripHallucinatedIngredients(
  whyExplanation: string,
  dishTextBrief: string | undefined,
  menuItemName: string = '',
): string {
  const flagged = detectHallucinatedIngredients(whyExplanation, dishTextBrief)
  if (flagged.length === 0) return whyExplanation
  
  // If hallucination detected and we have real ingredients, rebuild with them
  if (dishTextBrief && dishTextBrief.trim().length > 10) {
    // Extract the first sentence structure if it exists (before hallucinated ingredients)
    const sentences = whyExplanation.split(/[.!?]+/)
    const firstClean = sentences.find(s => {
      const trimmed = s.trim()
      return trimmed.length > 5 && !flagged.some(f => f.includes(trimmed))
    })
    
    // Rebuild: [intro phrase] + [real ingredients from DB]
    const intro = firstClean?.trim() || menuItemName
    const ingredients = dishTextBrief.slice(0, 120).replace(/\.$/, '')
    return `${intro}: ${ingredients}.`
  }
  
  // Fallback: strip bad sentences
  let cleaned = whyExplanation
  for (const bad of flagged) {
    cleaned = cleaned.replace(bad, '').replace(/\s\s+/g, ' ').trim()
  }
  
  if (cleaned.length < 20 && dishTextBrief) {
    cleaned = `${dishTextBrief.slice(0, 100)}.`
  }
  
  return cleaned
}

/**
 * Validate that title doesn't mention ingredients not present in dish_text_brief.
 * Returns cleaned title with fabricated ingredients removed, or original if valid.
 * 
 * Example issue:
 * - Title: "Torsk og tigerrejer ved åen"
 * - Dish: "TIGERREJER & LAKS med frisk pasta..."
 * - Problem: "Torsk" (cod) doesn't exist in dish
 * - Solution: Remove "torsk og" from title
 */
function validateTitleIngredients(
  title: string,
  dishTextBrief: string | undefined,
  menuItemName: string = '',
): string {
  if (!dishTextBrief || !title) return title
  
  // Build a set of words from the dish description (normalise case)
  const briefWords = new Set(
    dishTextBrief
      .toLowerCase()
      .replace(/[^a-zæøå\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2),
  )
  
  // Also include words from menu_item_name (they're definitely correct)
  const nameWords = new Set(
    menuItemName
      .toLowerCase()
      .replace(/[^a-zæøå\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2),
  )
  
  const titleLower = title.toLowerCase()
  
  // Check for specific ingredient mentions
  const ingredientMatches = [...titleLower.matchAll(INGREDIENT_WORDS)]
  
  for (const match of ingredientMatches) {
    const ingredient = match[0]
    const isInBrief = briefWords.has(ingredient) || dishTextBrief.toLowerCase().includes(ingredient)
    const isInName = nameWords.has(ingredient) || menuItemName.toLowerCase().includes(ingredient)
    
    if (!isInBrief && !isInName) {
      console.warn(`🚫 Title mentions "${ingredient}" not in dish: "${dishTextBrief.slice(0, 60)}..."`)
      // Strip the fabricated ingredient from title
      // Remove patterns like "torsk og ", "og torsk ", "torsk"
      const pattern = new RegExp(`\\b${ingredient}\\s+(og|&|,)\\s+|\\s+(og|&|,)\\s+${ingredient}\\b|\\b${ingredient}\\b`, 'gi')
      return title.replace(pattern, '').replace(/\s+/g, ' ').trim()
    }
  }
  
  return title
}

// ── Anchor repair ────────────────────────────────────────────────────────────

const PROMOTIONAL_ANCHOR_RE = /\b(bestil|reserver|book|klik|skriv til os|tilmeld)\b/i
const HALLUCINATED_ANCHOR_RE = /^"[^"]{5,}"$|stjerne|michelins? stjerne|ingen|unik(?:t)? (?:i byen|i danmark|i verden)/i

/**
 * Validate and optionally repair a concrete_anchor field against the confirmed facts bank.
 * Returns the repaired anchor (or original if valid).
 */
function repairAnchor(
  anchor: string | undefined,
  confirmedFacts: string[],
  businessName: string,
): string {
  if (!anchor || anchor.trim().length < 4) {
    return confirmedFacts[0] ?? businessName
  }

  if (PROMOTIONAL_ANCHOR_RE.test(anchor) || HALLUCINATED_ANCHOR_RE.test(anchor)) {
    console.warn(`⚠️ OutputValidator: anchor repaired — promotional/hallucinated: "${anchor}"`)
    // Find a relevant confirmed fact as replacement
    const factMatch = confirmedFacts.find(f => anchor.length > 6 && f.toLowerCase().includes(anchor.toLowerCase().slice(0, 6)))
    return factMatch ?? confirmedFacts[0] ?? businessName
  }

  return anchor
}

// ── Weather tone guard ────────────────────────────────────────────────────────

const POSITIVE_OUTDOOR_RE = /\b(perfekt\s+(?:vejr|til\s+udeservering)|godt\s+vejr|smukt\s+vejr|sol(?:rigt)?|strålende|varmt\s+(?:og\s+)?(?:solrigt|dejligt|skønt)|nyd\s+(?:solen|vejret|udelivet)|udeservering[^.!?]*(sol|varm|skøn|perfekt)|dejlig\s+dag|smuk\s+dag)\b/gi

/**
 * When outdoor weather is unsuitable, strip positive outdoor/weather framing from
 * why_explanation. Replaces positive weather sentences with a neutral alternative.
 */
function applyWeatherGuard(
  suggestion: RawSuggestion,
  outdoorSuitable: boolean,
  hasOutdoorSeating: boolean,
): RawSuggestion {
  if (outdoorSuitable || !hasOutdoorSeating) return suggestion
  if (!suggestion.why_explanation) return suggestion

  const before = suggestion.why_explanation
  const after = before.replace(POSITIVE_OUTDOOR_RE, '[hyggeligt inde]')
  if (after !== before) {
    console.warn(`☁️ OutputValidator: stripped positive outdoor framing (weather unsuitable)`)
    return { ...suggestion, why_explanation: after }
  }
  return suggestion
}

// ── Timing consistency guard ──────────────────────────────────────────────────

/**
 * Light validation: strip "i morgen" (tomorrow) references and promotional copy.
 * Does NOT strip valid service period times - those are correct AI output.
 * 
 * The old logic compared mentioned times against closing time, which broke for:
 * - Midnight-crossing venues (01:00 close interpreted as earlier than 09:30 open)
 * - Service periods ending before closing time (brunch 09:30-14:00 when close is 01:00)
 * 
 * New approach: Only strip clear errors, preserve valid time references.
 */
function validateTimingConsistency(
  whyExplanation: string,
  serviceWindow: { name: string; end: string; endMins: number } | null,
): string {
  if (!whyExplanation) return whyExplanation

  let cleaned = whyExplanation
  
  // ── Strip 1: "i morgen" (tomorrow) references ──
  // Quick Suggestions are TODAY ONLY - any tomorrow reference is an error
  const tomorrowPattern = /\b(i\s+morgen|til\s+i\s+morgen|næste\s+dag)\b/gi
  if (tomorrowPattern.test(cleaned)) {
    console.warn(`📅 Light validator: stripped "i morgen" reference (Quick Suggestions are for today only)`)
    cleaned = cleaned.replace(tomorrowPattern, '').trim()
  }
  
  // ── Strip 2: Promotional urgency copy ──
  // This is still valid - we don't want salesy language in rationales
  const promotionalPattern = /\b(kun\s+i\s+dag|sidste\s+chance|begrænsede?\s+pladser?|book\s+nu)\b/gi
  if (promotionalPattern.test(cleaned)) {
    console.warn(`🚫 Light validator: stripped promotional urgency copy`)
    cleaned = cleaned.replace(promotionalPattern, '').trim()
  }
  
  // ── DO NOT strip service period times ──
  // If Gemini mentions "kl. 09:30" or "serveres til kl. 14:00", that's CORRECT
  // if it matches a service period from the menu classification system.
  // The pre-check gate already validated we're in a valid generation window,
  // so any times Gemini mentions are contextually appropriate.

  // Cleanup multiple spaces and empty sentences
  cleaned = cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim()

  // Fallback if we stripped too much (rare, but safety net)
  if (cleaned.length < 20) {
    cleaned = `Perfekt valg til dagens menu.`
  }

  return cleaned
}

// ── Content-type cross-slot characterization guard ───────────────────────────

const MENU_ITEM_MARKERS = /\b(retten|menuen|ingredienser|menukort|nøje\s+udvalgte|anretning|tilberedning|serveres\s+med)\b/gi
const ATMOSPHERE_MARKERS = /\b(atmosfæren|stemningen|gæsternes\s+oplevelse|den\s+unikke\s+atmosfære)\b/gi
const BTS_MARKERS = /\b(bag\s+facaden|vores\s+køkken|chef\s+(\w+|en)|leverandør|morgenleveringen|klargøring)\b/gi

function detectContentTypeMismatch(suggestion: RawSuggestion): string | null {
  const { content_type, why_explanation } = suggestion
  if (!why_explanation || !content_type) return null

  if (content_type === 'atmosphere' && MENU_ITEM_MARKERS.test(why_explanation)) {
    return `atmosphere slot why_explanation contains menu item language`
  }
  if (content_type === 'behind_scenes' && ATMOSPHERE_MARKERS.test(why_explanation)) {
    return `behind_scenes slot why_explanation contains pure atmosphere framing`
  }
  return null
}

// ── Promotional copy sanitizer ────────────────────────────────────────────────

function sanitizePromotionalCopy(text: string): string {
  return text.replace(WHY_CAPTION_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ── Kitchen-close guard ───────────────────────────────────────────────────────

/**
 * When a slot is bar-only (no food service), strip time references that imply
 * ongoing kitchen / food service. This is a light-touch replacement only.
 */
const KITCHEN_OPEN_RE = /\bkøkkenet\s+(?:er\s+åbent|holder\s+åbent|åbent)\s+(?:til|frem til)\s+kl\.?\s+\d{1,2}[:.]\d{2}/gi

function applyKitchenCloseGuard(suggestion: RawSuggestion, slotTiming: SlotTiming): RawSuggestion {
  if (!slotTiming.isBarOnly || !suggestion.why_explanation) return suggestion
  const before = suggestion.why_explanation
  const after = before.replace(KITCHEN_OPEN_RE, 'baren er åben')
  if (after !== before) {
    console.warn(`🍺 OutputValidator: stripped kitchen-open reference (bar-only slot ${slotTiming.position})`)
    return { ...suggestion, why_explanation: after }
  }
  return suggestion
}

// ── Menu item name whitelist check ──────────────────────────────────────────

/**
 * Checks whether Gemini's menu_item_name exists in the menuDescriptionMap.
 * Tries: exact match → case-insensitive → contains match (both directions).
 * Returns the corrected name (from the map) or null if no match found.
 */
function resolveMenuItemName(
  name: string,
  menuDescriptionMap: Map<string, string>,
): string | null {
  if (menuDescriptionMap.size === 0) return name // no map available — pass through

  // 1. Exact match
  if (menuDescriptionMap.has(name)) return name

  // 2. Case-insensitive match
  const nameLower = name.toLowerCase().trim()
  for (const key of menuDescriptionMap.keys()) {
    if (key.toLowerCase().trim() === nameLower) return key
  }

  // 3. Strict substring match — only if significant overlap (min 6 chars)
  if (nameLower.length >= 6) {
    for (const key of menuDescriptionMap.keys()) {
      const keyLower = key.toLowerCase().trim()
      // Menu key must contain AI name (not vice versa) to avoid false positives
      // E.g. "CHOCOLATE OMELETTE" contains "OMELET" ✓, but "OMELET" doesn't contain "ÆGGEWRAP" ✓
      if (keyLower.includes(nameLower)) return key
    }
  }

  return null // no match — treat as hallucinated
}

// ── Main entry: validateAndRepair ────────────────────────────────────────────

export function validateAndRepair(
  suggestions: RawSuggestion[],
  slotTimings: SlotTiming[],
  confirmedFacts: string[],
  businessName: string,
  outdoorSuitable: boolean,
  hasOutdoorSeating: boolean,
  menuDescriptionMap: Map<string, string> = new Map(),
): RawSuggestion[] {
  const repaired = suggestions.map((s, idx) => {
    const timing = slotTimings[idx]
    let repaired = { ...s }

    // 1. Anchor repair
    if (repaired.concrete_anchor !== undefined) {
      const original = repaired.concrete_anchor
      repaired.concrete_anchor = repairAnchor(original, confirmedFacts, businessName)
      if (repaired.concrete_anchor !== original) {
        console.log(`🔧 [Slot ${idx + 1}] Anchor: "${original}" → "${repaired.concrete_anchor}"`)
      }
    }

    // 2. Promotional copy sanitization (why_explanation)
    if (repaired.why_explanation) {
      const before = repaired.why_explanation
      repaired.why_explanation = sanitizePromotionalCopy(before)
      if (repaired.why_explanation !== before) {
        console.log(`🔧 [Slot ${idx + 1}] Promotional copy removed from why_explanation`)
      }
    }

    // 3. Menu item name whitelist check — catches hallucinated dish names
    if (repaired.content_type === 'menu_item' && repaired.menu_item_name) {
      const resolved = resolveMenuItemName(repaired.menu_item_name, menuDescriptionMap)
      if (resolved === null) {
        console.warn(`🚫 [Slot ${idx + 1}] menu_item_name not on menu — clearing hallucinated name: "${repaired.menu_item_name}"`)
        repaired.menu_item_name = ''
        repaired.dish_text_brief = ''
      } else if (resolved !== repaired.menu_item_name) {
        console.log(`🔧 [Slot ${idx + 1}] menu_item_name normalised: "${repaired.menu_item_name}" → "${resolved}"`)
        repaired.menu_item_name = resolved
        // Update dish_text_brief from map if we corrected the name
        const description = menuDescriptionMap.get(resolved)
        if (description) repaired.dish_text_brief = description
      }
    }

    // 3b. Ingredient hallucination guard (runs after name check; dish_text_brief may have been updated)
    if (repaired.content_type === 'menu_item' && repaired.why_explanation) {
      const before = repaired.why_explanation
      repaired.why_explanation = stripHallucinatedIngredients(
        repaired.why_explanation,
        repaired.dish_text_brief,
        repaired.menu_item_name || '',
      )
      if (repaired.why_explanation !== before) {
        console.warn(`🔧 [Slot ${idx + 1}] Rebuilt why_explanation with real ingredients from DB`)
        console.warn(`   Before: "${before.slice(0, 100)}..."`)
        console.warn(`   After: "${repaired.why_explanation.slice(0, 100)}..."`)
      }
    }
    
    // 3c. Title ingredient validation — ensure title doesn't mention ingredients not in dish
    if (repaired.content_type === 'menu_item' && repaired.title) {
      const before = repaired.title
      repaired.title = validateTitleIngredients(
        repaired.title,
        repaired.dish_text_brief,
        repaired.menu_item_name || '',
      )
      if (repaired.title !== before) {
        console.warn(`🔧 [Slot ${idx + 1}] Removed fabricated ingredient from title`)
        console.warn(`   Before: "${before}"`)
        console.warn(`   After: "${repaired.title}"`)
      }
    }

    // 3d. Timing consistency guard — strip time references that contradict the service window
    if (repaired.why_explanation && timing?.serviceWindow) {
      const before = repaired.why_explanation
      repaired.why_explanation = validateTimingConsistency(
        repaired.why_explanation,
        timing.serviceWindow,
      )
      if (repaired.why_explanation !== before) {
        console.warn(`🔧 [Slot ${idx + 1}] Stripped contradictory timing from why_explanation`)
        console.warn(`   Before: "${before.slice(0, 100)}..."`)
        console.warn(`   After: "${repaired.why_explanation.slice(0, 100)}..."`)
      }
    }

    // 4. Weather tone guard
    repaired = applyWeatherGuard(repaired, outdoorSuitable, hasOutdoorSeating) as RawSuggestion

    // 5. Content-type mismatch check
    const mismatch = detectContentTypeMismatch(repaired)
    if (mismatch) {
      console.warn(`⚠️ [Slot ${idx + 1}] Content-type mismatch: ${mismatch}`)
    }

    // 6. Kitchen-close guard (only when we have timing data)
    if (timing) {
      repaired = applyKitchenCloseGuard(repaired, timing) as RawSuggestion
    }

    return repaired
  })

  // ── Post-generation duplicate dish detection ──────────────────────────────
  // Safety net: if Gemini ignored the "⛔ ABSOLUT KRAV" instruction and suggested
  // the same dish twice in one batch, detect it here and log a warning.
  // This helps diagnose prompt compliance issues.
  const seenDishes = new Set<string>()
  for (let i = 0; i < repaired.length; i++) {
    const sug = repaired[i]
    if (sug.menu_item_name && sug.content_type === 'menu_item') {
      const dishKey = sug.menu_item_name.toLowerCase().trim()
      if (seenDishes.has(dishKey)) {
        console.error(`🚫 DUPLICATE DISH IN BATCH: "${sug.menu_item_name}" appears in multiple slots!`)
        console.error(`   → This violates the "⛔ ABSOLUT KRAV" constraint in the prompt.`)
        console.error(`   → Slot ${i + 1} will keep the duplicate, but this indicates AI non-compliance.`)
      }
      seenDishes.add(dishKey)
    }
  }

  return repaired
}

// ── Re-export repairSuggestions compat wrapper ────────────────────────────────
// The existing index.ts calls `repairSuggestions(suggestions, confirmedFacts)`.
// This wrapper maintains that interface while delegating to the new validator.

export function repairSuggestions(
  suggestions: RawSuggestion[],
  confirmedFacts: string[],
  businessName = '',
  slotTimings: SlotTiming[] = [],
  outdoorSuitable = false,
  hasOutdoorSeating = false,
): RawSuggestion[] {
  // Pad timing array with nulls if shorter than suggestions
  const timings = suggestions.map((_, i) => slotTimings[i] ?? null)

  return suggestions.map((s, idx) => {
    let repaired = { ...s }
    const timing = timings[idx]

    // Existing anchor repair (from index.ts line ~500):
    // content_type for Slot B/C: concrete_anchor must come from confirmedFacts
    if (repaired.concrete_anchor !== undefined) {
      const original = repaired.concrete_anchor
      repaired.concrete_anchor = repairAnchor(original, confirmedFacts, businessName)
    }

    // Promotional copy
    if (repaired.why_explanation) {
      repaired.why_explanation = sanitizePromotionalCopy(repaired.why_explanation)
    }

    // Weather guard
    repaired = applyWeatherGuard(repaired, outdoorSuitable, hasOutdoorSeating) as RawSuggestion

    // Kitchen guard
    if (timing) {
      repaired = applyKitchenCloseGuard(repaired, timing) as RawSuggestion
    }

    return repaired
  })
}
