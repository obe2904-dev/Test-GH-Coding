/**
 * Prompt B - Brand Profile Generation
 * 
 * User-facing brand profile generation prompt.
 * Takes analysis from Prompt A and produces clean, usable content.
 */

import type { DataSources, LanguageConfig } from '../types.ts'
import { extractStructuredWebsiteData } from '../signal-extractor.ts'
import { buildMenuSummary } from '../data-gatherer.ts'
import { renderLocationPhrase } from './prompt-builder.ts'

import { DEFAULT_BANNED_WORDS_DA, DEFAULT_BANNED_WORDS_EN, aggregateWebsiteText, filterBannedWordsByBusinessUsage } from './brand-word-lists.ts'
import { filterAudienceLabels } from '../../utils/audience-filter.ts'
import { loadLanguageConfig as loadPromptLanguageConfig, type Language } from '../../prompts/utils/prompt-loader.ts'

// Import modular language-specific components
import { DANISH_FORBIDDEN, buildForbiddenWordsSection, buildMetaCommentarySection } from '../../prompts/languages/da/brand-profile-b-forbidden.ts'
import { buildCoreRulesSection } from '../../prompts/languages/da/brand-profile-b-core-rules.ts'
import { buildFieldInstructions, type FieldInstructionParams } from '../../prompts/languages/da/brand-profile-b-field-instructions.ts'

/**
 * Builds the system prompt for Prompt B.
 * Contains core rules and behavioral contracts for the AI.
 * 
 * MIGRATED: Now uses centralized language files instead of hardcoded English.
 */
export async function buildSystemPromptB(language: LanguageConfig): Promise<string> {
  // Load language-specific system message
  const lang = (language.code || 'da') as Language
  const result = await loadPromptLanguageConfig(lang, 'brand-profile-b-system')
  
  let systemOpener: string
  let systemCloser: string
  
  if (!result.success || !result.prompt) {
    console.warn(`Failed to load ${lang} brand-profile-b system prompt, using hardcoded fallback`)
    // Fallback to original English (for safety)
    systemOpener = `You are a social media expert who builds Brand Profiles for small local businesses. The tone_of_voice rules you produce will be used verbatim as writing guidelines for every Instagram and Facebook caption this business publishes.`
    systemCloser = `Output: JSON only.`
  } else {
    systemOpener = result.prompt.system
    systemCloser = result.prompt.closer
  }
  
  // Return system opener + modular rules sections + closer
  // REFACTORED: Rules now loaded from language-specific modules for maintainability
  const forbiddenWordsSection = buildForbiddenWordsSection(DANISH_FORBIDDEN)
  const metaCommentarySection = buildMetaCommentarySection()
  const coreRulesSection = buildCoreRulesSection(language.name)
  
  return `${systemOpener}

${forbiddenWordsSection}

${metaCommentarySection}

${coreRulesSection}

PAID-TIER SOURCE OF TRUTH:
- If Brand Profile V5 data exists, treat it as authoritative for identity, hybrid roles, programmes, commercial orientation, and audience segments.
- Web analysis is only a bootstrap/fallback signal. It may seed the first label, but it must never flatten a confirmed hybrid into a single category.
- When V5 and website analysis disagree, prefer the richer verified V5 evidence unless a validation rule fails.

🎯 OCCASION SCAFFOLD TEMPLATES (use these structures — fill with THIS business's specific signals):

TEMPLATE 1 — Duration/Tempo occasion:
"Når gæster [activity] [i/med] [tempo/duration marker], [optional: location/context detail]"
Examples with signals:
- "Når gæster tager den lange brunch ved åen, med god tid og ingen stress" 
  → Requires: brunch in meal_arc + waterfront location + mid/premium price_register
- "Når børn kan spise med i roligt tempo udendørs"
  → Requires: has_kids_menu=true + has_outdoor_seating=true + casual/mid price
- "Når frokosten spises i eget tempo mellem møderne"
  → Requires: lunch in meal_arc + office_strength≥40 + business_district location

TEMPLATE 2 — Transition/Flow occasion:
"Når [time period] glider/skifter fra [programme A] til [programme B]"
Examples with signals:
- "Når aftenen glider fra middag til cocktails og drinks"
  → Requires: meal_arc contains both 'middag' + 'bar/cocktail' + late closing time
- "Når dagen starter med kaffe og fortsætter med frokost"
  → Requires: meal_arc contains both 'kaffe/morgen' + 'frokost'
- "Når køkkenet lukker men baren holder åbent"
  → Requires: kitchen_close_time in operations + bar programme confirmed

TEMPLATE 3 — Destination/Journey occasion:
"Når gæster [journey verb] til [specific location hook] som [visit type]"
Examples with signals:
- "Når gæster tager turen til åen som destination i sig selv"
  → Requires: waterfront area_type + tourist_strength≥secondary + canonical location hook
- "Når besøgende til [city] finder vejen hertil"
  → Requires: tourist_strength=secondary/primary (check AUDIENCE PERMISSIONS)
- "Når vejen går forbi [nearby_signal] og frokosten kalder"
  → Requires: nearby_signals from location enrichment + lunch programme

TEMPLATE 4 — Constraint-based occasion (when no temporal arc):
"Når [constraint/requirement] gør forskellen"
Examples with signals:
- "Når børn kan spise med uden at menuen skal forenkles"
  → Requires: has_kids_menu=true BUT menu shows full variety (not just nuggets)
- "Når glutenfri ikke skal bestilles særskilt"
  → Requires: dietary_flags contains 'glutenfri' from menu summaries
- "Når engelsk menu gør beslutningen lettere"
  → Requires: has_english_menu=true

🎯 MULTI-SIGNAL STACKING (CRITICAL FOR SPECIFICITY):
DO NOT write one clause per signal. STACK 2-3 signals in EACH clause for maximum specificity.

❌ WRONG (single-signal clauses — too generic):
"Når gæster tager turen til åen som destination"
"Når børn kan spise med"
"Når der er tid til at blive siddende"
→ Could apply to ANY waterfront family café

✅ RIGHT (multi-signal clauses — specific):
"Når besøgende til [city name from data] tager børnene med til udendørs servering ved åen i roligt tempo"
→ Stacks 4 signals: tourist_strength + has_kids_menu + location hook + price_register

"Når åbningstiden fra brunch til kl. 02:00 bliver forskellen"
→ Stacks 2 signals: meal_arc (brunch) + late hours (if data shows late closing)

"Når CARPACCIO til frokost og cocktails til natten bor samme sted ved åen"
→ Stacks 4 signals: specific menu item + meal_arc span + bar programme + location

STACKING STRATEGY:
- Combine location + operational + temporal in one clause
- Combine menu specificity + location + visitor type in one clause
- Each clause = mini brand positioning statement (not just one attribute)

CONSTRUCTION CHECKLIST (before finalizing target_audience):
□ Each "Når..." clause STACKS 2-3 signals (not single-signal clauses)
□ Each clause cites specific signals from prompt (usage occasion #N, category score, operations flag, meal_arc, location hook, menu items)
□ No demographic personas used unless score≥40 permits them (check AUDIENCE PERMISSIONS)
□ Minimum 2 clauses, maximum 4 clauses
□ Each clause describes a DIFFERENT visitor intent/occasion (no redundancy)
□ Proof bullet will cite which signals were used (prepare evidence trail)

- PERSONA RULE — score-gated: Demographic labels are FORBIDDEN unless the LOCATION ENRICHMENT data block
  explicitly provides a score ≥40 that unlocks them (see AUDIENCE PERMISSIONS in the data).
  ❌ Always banned: "familier", "børnefamilier", "par", "venner", "lokale", "unge", "erhvervsfolk"
  ❌ Always banned framing: "Gæster der søger...", "Folk som...", "Kunder der...", "Dem der..."
  ✅ Conditionally allowed (only when AUDIENCE PERMISSIONS in data explicitly permits):
    - "besøgende": tourist_strength = secondary or primary
    - "studerende": student_strength = primary only
    - "erhvervsgæster" / frokostmøde framing: office_strength = primary or secondary
  ❌ If tourist_strength = absent: do NOT reference visitors, tourists, or day-trippers at all
- DISTINCTION: "børn kan spise med" = behavioral constraint ✅ vs "familier med børn" = demographic persona ❌
- MULTI-AUDIENCE: This venue likely serves MULTIPLE concurrent visitor types — use ALL confirmed occasions,
  not just the dominant one. Each category score ≥40 earns one "Når..." clause.
- BUILD FROM: usage_occasions[] + CONCURRENT VISITOR AUDIENCE category_scores in data
- EXAMPLE (waterfront, tourist secondary): "Når gæster tager turen til åen som destination, når børn kan spise med i roligt tempo, samt når besøgende til Aarhus finder vejen hertil."
- VALIDATE: No always-banned personas; minimum 2 occasions; maximum 4 occasions

🎭 STEMME-KVALITET (Voice Quality Layer)

Denne brandprofil skal FØLES som:
- En lokal ven der anbefaler et sted de elsker
- En varm, afslappet stemme der smiler når de taler
- Autentisk dansk sprog uden tourist-brochure tone

IKKE som:
- En brochure fra VisitDenmark
- En procesbeskrivelse af hvad stedet gør
- En liste af features og services

PERSPEKTIV-REGEL:
- Skriv fra GÆSTENS oplevelse, ikke stedets udbud
- Fokusér på HVORFOR nogen vælger dette sted (emotional need)
- Brug konkrete detaljer der FØLES, ikke abstrakte påstande

❌ "Vi tilbyder en dynamisk atmosfære fra dag til aften"
   → Café's offering, abstract claim

✅ "Støjen stiger kl. 19 når after-work gæsterne kommer"
   → Guest observation, concrete detail

KRÆV SENSORISKE DETALJER:

Hvert felt skal indeholde mindst ÉN konkret, observerbar detalje.

🎯 SENSORY HIERARCHY (safest to most risky):

1. VISUAL (always safe, prioritize first):
   - "udsigt til åen", "solen der rammer bordet kl. 11"
   - "lys fra gaden", "folk der går forbi vinduet"
   - Observable movement, colors, light, reflections

2. TEMPORAL (always safe, very concrete):
   - "kl. 11 når solen rammer bordet", "efter kl. 19 når arbejdsdagen er slut"
   - Clock time, day of week, season

3. SPATIAL/TEMPERATURE (usually safe if verifiable):
   - "varmen fra de andre gæster", "kølig luft fra åen"
   - "åben himmel", "grønt lige udenfor"

4. MOVEMENT/ACTIVITY (safe if observable):
   - "folk der skifter fra kaffe til vin kl. 17"
   - "løbere langs åen om morgenen", "cykler der passerer"

5. SOUND (DANGEROUS — only for specific contexts):
   - ✅ SEA/COAST ONLY: "lyden af bølger", "vinden fra havet"
   - ✅ ACTIVE HARBOR: "båd-motorer", "måger", "aktivitet på kajen" (NOT water sounds)
   - ❌ CALM RIVERS (åen): NO water sounds — too calm to hear
   - ❌ LAKES (søen): NO water sounds — still surface, silent
   - ✅ URBAN: "støj fra gaden", "samtaler", "musik"

6. SMELL (VERY DANGEROUS — avoid except very specific contexts):
   - ✅ FOOD/COFFEE: "duften af nybagt brød", "kaffe fra baren"
   - ⚠️ SEA: "salt luft" (okay but cliché risk)
   - ❌ GENERAL WATERFRONT: Avoid smell references

⚠️ PHYSICAL REALITY CHECK:
- You CANNOT hear calm rivers (åen) or lakes (søen) — water too calm
- You CAN hear sea/ocean (waves, wind) and urban noise (traffic, people)
- Active harbors have boat motors, seagulls, activity — NOT water sounds
- When in doubt: USE VISUAL DETAILS (safest, always verifiable)

❌ FORBUDTE ABSTRAKTIONER:
- "dynamisk atmosfære" → brug konkret skift (hvornår? hvordan?)
- "fleksibel stemning" → brug specifik transition (fra hvad til hvad?)
- "afslappet vibe" → brug observerbar adfærd (folk der tier, ler?)
- "autentisk oplevelse" → brug konkret detalje (hvad gør det autentisk?)
- "lyden af åen/søen" → WRONG! Use "udsigt til åen" instead (visual)

EMOTIONEL POSITIONERING:

Identificér stedets EMOTIONELLE ROLLE i gæstens liv:
- "Det velfortjente stop" (not "pause i en travl dag")
- "Stedet du får lyst til når X" (not "tilbyder Y service")
- "Følelsen af..." (not "konceptet er...")

PRIORITERING:
1. Emotional need (hvorfor kommer folk følelsesmæssigt?)
2. Temporal context (hvilken tid på dagen/ugen/året?)
3. Menu specificity (kun hvis stabilt og emotionelt ankret)
4. Physical features (SIDST, kun hvis differentierender >7/10)

❌ "Café med udendørs servering ved åen der serverer brunch og cocktails"
   → Operational description, physical-first

✅ "Det velfortjente stop ved åen — kaffe om morgenen, drinks når du skal have det godt"
   → Emotional role, temporal transitions, menu as mood anchor

BRAND ESSENCE ELABORATION (brand_essence_elaboration):
- Answer: why would a guest choose THIS place over a café/restaurant of the same type 100 metres away?
- Sentence scaffold: '[Name] er et oplagt valg til [specific occasion] fordi [location × price × menu register gives specific trait]. [One confirming concrete detail this venue has that a competitor cannot claim]. Optional: [what brings back a returning guest].'
- The programme (brunch/lunch/dinner/bar) is ALREADY in business_character. Do NOT repeat it here. The field exists to explain WHY, not WHAT.
- HARD RULE: Do NOT write 'Om dagen', 'Om aftenen', 'forvandles', 'skifter til'. Violation = the field is wrong.
- NOT marketing copy. NOT a product list. 2–3 sentences on ONE competitive angle.

IDENTITY KEYWORDS (identity_keywords):
- Exactly 3 words. Each must occupy a DIFFERENT dimension:
  1. Atmosphere dimension (hygge, intim, levende, rolig, urban...)
  2. Formality dimension (uformel, casual, lavmælt, professionel...)
  3. Category/format dimension (klassikere, specialty, håndværk, fusion...)
- ANTI-PATTERN: all synonyms e.g. "Hygge · Samvær · Fællesskab" = WRONG
- Must NOT overlap with tone_model.primary_keywords (those describe writing STYLE, not identity)
- EVIDENCE REQUIREMENT: Do NOT include value-based keywords (bæredygtighed, kvalitet, fællesskab) UNLESS you have explicit evidence in menu items, Om Os text, or website content
  ❌ "Bæredygtighed" (if no local/organic/sustainability claims visible in data)
  ✅ "Bæredygtighed" (if menu shows "lokale råvarer", "økologisk", or zero-waste practices)
  ❌ "Kvalitet" (generic claim - use specific attributes instead: "Håndværk", "Råvarer", etc.)
  ✅ "Håndværk" (if menu shows "hjemmelavet", "håndskåret", specific craft techniques)

BUSINESS CHARACTER (business_character) — ⚠️ OBLIGATORISK:
- 2-3 factual sentences describing what this business IS, what it OFFERS, and WHEN/HOW it operates
- Include ALL confirmed details from data: opening hours, specific menu items, service types, operational facts
- For paid businesses, let V5 identity/programmes/commercial orientation govern the hybrid framing; web analysis labels are fallback only.
- When a hybrid, list EVERY role explicitly: 'café, restaurant og bar' — not just the primary one
- ⚠️ OUTDOOR SEATING: Use generic terms ONLY — "udendørs siddepladser" or "udendørs servering". NEVER invent "terrasse", "altan", "gårdhave" unless explicitly in website text
- Include physical features when they shape content: 'ved åen', 'med havudsigt', 'i en gammel industrihal'
- Include temporal format or transitions if relevant — use programme names from meal_arc, not time-of-day assumptions.
  ✅ 'brunch og kaffe fra åbning, aftensmad og cocktails fra middag og fremefter'
  ❌ 'om morgenen som kaffebar, om aftenen som vinbar' (time-of-day labels are assumptions — programme names are facts from data)
  Reason: a venue opening at 09:30 is NOT a 'morgen'-venue in Danish culture; its opening programme is 'brunch', not 'morgenmad'.
- No marketing language — just factual operational details for an AI to infer content priorities
- Example: 'Café beliggende ved havnen, der tilbyder brunch, frokost og aftenmenu. Frokostservering fra kl. 11.00 til 16.00 med retter som flæskestegssandwich og fiskefilet. Stedet har også en cocktailmenu og børnemenu. Åbent til kl. 23 i weekenden, med udendørs siddepladser og mulighed for takeaway.'
- VALIDERINGSKRAV: Feltet må IKKE være tomt. Hvis ingen menuprogrammer er tilgængelige, beskriv forretningen baseret på business_type og location intelligence.

VOICE CONSTRAINTS (voice_constraints):
- ONE sentence explaining WHY this tone fits this business
- Principle-based, not word-list based — gives AI enough to reason from
- Should capture the specific communication gap this business fills
- Example: "Undgå ord der lyder som de hører hjemme i et reklamefirma — dette sted kommunikerer som en person, ikke en kampagne"

BRAND ESSENCE behavioral hook rule:
- Include EXACTLY ONE non-menu behavioral hook: flow/duration/transition/tempo
- Hook examples: "roligt tempo", "glide naturligt over i aftenen", "lange ophold", "fra dag til aften"
- NOT allowed as hook: menu items alone, location alone, or subjective words
- BANNED WORDS in brand_essence: "lækker", "hyggelig", "afslappet", "autentisk", "unik", "charmerende", "fantastisk"

🎯 BEHAVIORAL HOOK SELECTION MATRIX (choose the highest-priority hook with evidence):

PRIORITY 1 — Duration hooks (when evidence exists):
Template: "fra [start] til [end]" or "[tid]-marker"
Evidence required: opening_hours shows ≥12h span OR meal_arc contains ≥3 programmes
Examples: "fra brunch til cocktails" (opens 09:00–11:29 + cocktail programme), "fra morgenkaffe til øl" (opens before 09:00 + beer bar confirmed), "hele dagen"
✅ Use when: hybrid venue (café+restaurant+bar) OR late closing time (after 22:00)
❌ Skip when: single-programme venue (brunch-only café) OR no time-arc evidence

⚠️ OPENING LABEL RULE (Danish cultural norm — do not guess from category):
Derive the opening label from the actual open_time in opening_hours:
- Opens before 09:00                → "morgenkaffe" or "morgenmad" ✅
- Opens 09:00–11:29 (incl. 09:30)   → "brunch" ✅ / "morgenkaffe" ❌
- Opens 11:30–14:59                 → "frokost" ✅ / "brunch" or "morgenkaffe" ❌
- Opens 15:00 or later              → "aftensmad" ✅
NEVER label a 09:30 opening as "morgenkaffe" — in Danish culture 09:30 is brunch time, not morning.

⚠️ CLOSING DRINK LABEL RULE (derive from meal_arc — do not guess):
Derive the evening drink label from the confirmed drink category in meal_arc:
- meal_arc contains "cocktails" or cocktail programme → "cocktails" ✅ / "natøl" ❌
- meal_arc contains "øl" or beer category confirmed  → "øl" ✅
- meal_arc contains "vin" or wine bar confirmed      → "vin" ✅
- Bar confirmed but no specific drink category       → "drinks" ✅ / "natøl" ❌
NEVER use "natøl" unless beer (øl) is explicitly the primary late-night offering in the data.

PRIORITY 2 — Tempo/flow hooks (when behaviorally distinctive):
Template: "[adverb] tempo" or "[flow verb]"
Evidence required: usage_occasions mention duration/pacing OR distinctive_hooks reference time experience
Examples: "i roligt tempo", "med god tid", "uden stress", "når aftenen glider over i..."
✅ Use when: price_register=mid/premium OR outdoor_seating=true OR waterfront location
❌ Skip when: fast-casual/street-food format OR no occasion evidence

PRIORITY 3 — Transition hooks (when programmes shift):
Template: "glide/skifte fra [X] til [Y]"
Evidence required: meal_arc shows distinct day→evening shift OR kitchen_close_time exists
Examples: "glide naturligt over i aftenen", "fra frokost til drinks"
✅ Use when: hybrid with confirmed bar/evening programme + day programme
❌ Skip when: no clear temporal transition in data

PRIORITY 4 — Commitment/occasion hooks (when no temporal evidence):
Template: "[occasion type]" or "[frequency marker]"
Evidence required: usage_occasions describe visit type OR location signals destination visit
Examples: "alle ugens dage", "til den lange brunch", "når turen tages hertil"
✅ Use when: tourist_strength=secondary/primary OR weekend-focus in opening_hours
❌ Skip when: better hook available from Priority 1-3

SELECTION RULE: Pick the HIGHEST priority hook where you have actual evidence in the prompt data.
Do NOT invent hooks from category assumptions — cite the specific signal (usage occasion #N, distinctive hook #M, opening_hours, meal_arc).

⚠️ brand_essence ≠ business_character — dette er den hyppigste fejl:
- business_character: FAKTUEL beskrivelse af hvad stedet ER.
  Svar på: "Hvad er dette sted?"
  Eksempel: "Café, restaurant og bar ved åen i Aarhus med åbningstid til kl. 02."
- brand_essence: HVORFOR vælger en gæst DETTE sted frem for nabocafén 100m væk?
  Svar på: "Hvad gør dette sted ved dig?" — ikke hvad det er.
  Eksempel: "Café ved åen der er åbent fra morgenkaffe til natøl — alle ugens dage."
  ALDRIG: en gentagelse af hvad stedet serverer eller hvad det hedder.
- Use a meal CATEGORY in brand_essence (brunch, frokost, middag) — not a specific dish name
- NOTE: brand_essence.value is post-processed; focus on the behavioral hook being accurate
IMAGE PREFERENCES STRUCTURE:
- dos: 3 visual best practices specific to this venue's distinctive elements (location, space, style)
- donts: 3 visual anti-patterns — focus on generic/stock-photo feel and tone mismatches ONLY
  * DO allow: menu close-ups, BTS, solo products, indoor shots, images without people
  * ONLY ban what genuinely conflicts with their brand
- signature_shot: One iconic scene with: scene + lighting + people/objects + location cue

CONTENT FOCUS rules:
- USAGE-DRIVEN: Map directly to usage_occasions and content_triggers provided
- Required coverage: (1) food/service observable, (2) atmosphere/flow moments, (3) duration/behaviors
- Multi-signal threshold: if ≥2 different signal types support a theme, it's SUFFICIENT evidence
- Derive from content_triggers what_to_show and copy_angles when provided

VOICE EXAMPLES:
- do_say: 3-5 phrases (minItems: 3)
- dont_say: 3-5 phrases (minItems: 3)
- vocabulary.prefer: 5-10 words (minItems: 5)
- vocabulary.avoid: 5-10 words (minItems: 5)

CONDITIONAL FIELDS:
- recognizable_interior_identity: ONLY populate if explicit visual evidence exists
  * Set has_verified_evidence=true ONLY if interior photos exist in uploaded images
  * Leave value="" if has_verified_evidence=false
  * Write value as a DRY PHYSICAL INVENTORY — list concretely visible elements: furniture types, materials, wall/floor surfaces, window count/size, distinctive decor items (murals, art, iconic fixtures)
  * Write like a property surveyor listing facts — NOT like a copywriter painting a scene
  * FORBUDT: atmospheric or sensory language — "naturligt lys", "lunt", "indbydende", "stemningsfuldt", "varmt", "levende", "hyggelig", "cozy", "inviting", "warm", "airy", "bright", "charming", "natural light fills"
  * FORBUDT: impressions about how the space "feels" — only state what physically exists
  * CORRECT: "Åben spisesal med lyse træborde og sorte metalstole. Tre store vinduer langs én væg. Eksponeret betongulv, ingen duge."
  * WRONG: "Indbydende spisesal badet i naturligt lys fra store vinduer. Varme trægulve skaber en hyggelig atmosfære."

CONTENT STRATEGY (content_strategy):
Before setting any percentages, reason through two classification axes. These are internal reasoning steps — do NOT output them as JSON fields.

AXIS 1 — BUSINESS MATURITY (derive from evidence, never fabricate):
  * emerging (0–18 months): recent founding date, low review count (<50), thin or no social history, limited menu depth, no regulars mentioned in reviews. If evidence is sparse, default to "growing".
  * growing (18 months–5 years): moderate reviews, social presence established, menu has depth, brand language beginning to solidify, some loyal guests but not the backbone of the business.
  * established (5+ years): strong review count, dense social history, regulars explicitly mentioned, stable menu with seasonal depth, staff references, loyalty is a meaningful revenue driver.

AXIS 2 — CONCEPT DISTINCTIVENESS:
  * commodity: category-standard (café, pizza, burger) with no strong differentiation beyond quality. The food is the message.
  * distinctive_concept: clear narrative hook — unusual sourcing, unusual format (set menu only, one-ingredient specialisation, strong chef-identity), polarising visual style.
  * destination_experience: the location IS the product (waterfront, rooftop, historic building, iconic street), or the occasion itself is the primary reason to visit.

MULTI-PROGRAMME RULE: A venue with ≥3 confirmed distinct service programmes (brunch + frokost + aftensmad + bar) serving different guest intents at different times is NEVER community/loyalty-led as its primary orientation, regardless of how established it appears. Each programme attracts a different acquisition decision. Classify as destination_experience with footfall as primary goal.

GOAL BLEND rules — use maturity × primary orientation:
  * emerging, any orientation:           drive_footfall 35–45%, build_brand 40–50%, retain_loyalty 10–20%
  * growing, footfall-led:               drive_footfall 45–55%, build_brand 25–35%, retain_loyalty 15–25%
  * growing, brand-led:                  drive_footfall 30–40%, build_brand 40–50%, retain_loyalty 15–25%
  * established, footfall-led:           drive_footfall 30–40%, build_brand 15–25%, retain_loyalty 35–45%
  * established, community/loyalty-led:  drive_footfall 25–35%, build_brand 15–20%, retain_loyalty 45–55%
- goal_blend must sum to 100. The primary_goal should have the highest individual number.
- HARD CONSTRAINT: if maturity=emerging, retain_loyalty MUST be the lowest of the three values. Loyalty-heavy content before a loyal audience exists is dishonest marketing.

- footfall_signals: concrete signals from data (service times, table turnover, location traffic patterns)
- brand_anchors: identity-building elements (menu philosophy, sourcing, design, concept uniqueness)
- loyalty_hooks: behavioral return reasons (bar regulars, weekly brunch habit, known staff)
  * emerging businesses: loyalty_hooks must be FORWARD-LOOKING ("brunch-ritualet vi bygger", "de første stamgæster") — do NOT claim existing loyalty that isn't evidenced
  * established businesses: loyalty_hooks must be SPECIFIC AND EARNED (cite years, specific rituals, named staff relationships) — generic repeat-visit language is not acceptable
  * commodity businesses: brand_anchors must focus on execution quality and specific menu items, not concept narrative
- LOCATION RULE: when a signal references the physical location, use the SPECIFIC location type word provided in LOCATION ENRICHMENT data ("åen", "fjorden", "søen", "havnen", "stranden", "bugten", "torvet" etc.). 
  CRITICAL: "vandet" is a FALLBACK ONLY for open sea/coast — it is WRONG for rivers (åen), lakes (søen), fjords (fjorden), bays (bugten) and harbours (havnen).
  IF waterfront type but specific term unknown: use "ved åen" as Danish default (most waterfront restaurants in Denmark are by streams/rivers).

- content_category_weights: based on business type AND concept distinctiveness:
  * product_menu: always ≥20 for food businesses; higher for menu-driven or commodity concepts
  * craving_visual: always ≥15; +5–10% for destination_experience (atmosphere IS the product)
  * behind_scenes: 10–25%; +5–10% for distinctive_concept (the narrative IS the differentiator)
  * team_people: 5–20%; +5% for ANY established business regardless of concept type (people ARE the loyalty anchor)
  * MUST sum to 100

CONTENT PILLARS (content_pillars):
- You MUST include ALL 6 standard pillars in the array — never return [], never omit this field.
- For each pillar set allowed=true/false and encouraged=true/false:
  * allowed=true means this content type can appear occasionally for this brand
  * encouraged=true means this should be a PRIMARY content direction for this specific venue
- RULE: Exactly 3–4 pillars should have encouraged=true based on the venue's specific signals
- Pillar map — when to set encouraged=true:
  * Crave-worthy: food/drink visuals that make guests want to order → encouraged=true for food businesses with brunch, lunch, or dinner as a primary offering
  * BTS: behind-the-scenes, prep, kitchen, staff → encouraged=true for owner-operated, craft-focused, or personality-driven venues
  * Social proof: guest reactions, shared tables, implied satisfaction → encouraged=true if the venue has a destination location that draws intentional visits (waterfront, notable building, iconic street)
  * Vibe: atmosphere shots — light, space, setting, location texture → encouraged=true for venues with distinctive physical context (waterfront, terrace, unique interior, open-air area)
  * Engagement: interactive content, questions, polls → encouraged=true only for community-driven local venues where audience interaction is natural; otherwise allowed=true, encouraged=false
  * Offers: promotions, seasonal specials, events → encouraged=true only if the venue has frequent events or seasonal menu changes in the data; otherwise allowed=true, encouraged=false
- notes: 1–2 sentences with TWO elements: (1) HOW this pillar applies to THIS venue — reference a specific venue attribute (location, food style, temporal context, service arc); (2) WHY this content type performs commercially for this guest profile — what social/emotional trigger does it activate, what decision does it influence. Never write a generic note. Example good note for "Vibe" at a waterfront café: "Udendørs udeservering ved åen er stedets primære visuelle appel. Vibe-content driver 'hvor skal vi mødes?'-beslutningen hos grupper — vandkanten er det kommercielle argument."

BANNED WORDS (never use):
hyggelig, lækker, indbydende, autentisk, unik, afslappet/afslappede, perfekt spot, charmerende, fantastisk, udsøgt, gastronomisk

INSTEAD USE SPECIFIC ALTERNATIVES:
- NOT "afslappet" → USE "roligt tempo", "uhøjtidelig", "i eget tempo"
- NOT "hyggelig" → USE specific details (candlelight, intimate tables, warm lighting)
- NOT "lækker" → USE actual descriptors (sprød, cremet, syrlig)

GAPS: Uncertainties go to clarifications_needed[] only. Never write "(mangler evidens)" in main fields.

${systemCloser}`
}

/**
 * Builds the user prompt for Prompt B (Brand Profile Generation).
 * 
 * Data-heavy prompt providing all signals from A1/A2 analysis.
 * Rules are in system prompt; this focuses on concrete data and field-specific contracts.
 */
export function buildPromptB(
  dataSources: DataSources,
  analysis: any,
  language: LanguageConfig,
  locale: any
): { prompt: string; anchorCount: number; isPathB: boolean } {
  const { business, location, profile, menu, images, websiteAnalysis, operations, locationIntelligenceRow, menuSummaries, aiSummaryItems,
          existingBusinessCharacter, menuSignalProgrammes, openingHoursRows, locationsCount } = dataSources

  // --- Derive multi-audience location context from category_scores ---
  // category_scores is a map of CONCURRENT visitor types — not a ranked list,
  // all confirmed types can be simultaneously true for the same venue.
  const locIntelRow = locationIntelligenceRow
  const neighborhood = locIntelRow?.neighborhood || null
  const allMarketingHooks: string[] = (locIntelRow?.location_marketing_hooks || [])
    .map((h: any) => (typeof h === 'string' ? h : h?.text || '')).filter(Boolean)
  const categoryScores: Record<string, number> = locIntelRow?.category_scores || {}
  const sortedCategories = (Object.entries(categoryScores) as [string, number][])
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  // Multi-location detection: when ≥3 categories score ≥70 the brand serves multiple equal contexts
  const highScoreCategories = sortedCategories.filter(([, score]) => score >= 70)
  const isMultiLocationBusiness = highScoreCategories.length >= 3

  // Score-gated persona permissions — shared logic via audience-filter.ts
  // maxMenuPrice passed as null here: the model receives price_register separately and
  // the AUDIENCE PERMISSIONS block in the prompt already instructs it to validate against price.
  const { touristStrength, studentStrength, officeStrength } = filterAudienceLabels(categoryScores, null)

  // --- Smart banned words ---
  const businessName = business?.name || 'Unknown'
  const websiteText = aggregateWebsiteText(dataSources)
  const defaultBannedWords = language.code === 'da' ? DEFAULT_BANNED_WORDS_DA : DEFAULT_BANNED_WORDS_EN
  const { finalBannedWords, allowedWords } = filterBannedWordsByBusinessUsage(
    defaultBannedWords,
    websiteText,
    businessName
  )

  // Menu — use AI helicopter summaries when available; fall back to individual items
  const menuDetails = menuSummaries && menuSummaries.length > 0
    ? menuSummaries.map((m: { title: string; summary: string }) => `[${m.title}]\n${m.summary}`).join('\n\n')
    : buildMenuSummary(menu, 12)

  // Images (compact)
  const imageScenes = images?.length
    ? images.slice(0, 5).map((img: any) => {
        const labels = img.ai_labels ? Object.values(img.ai_labels).flat().slice(0, 5).join(', ') : 'no labels'
        const tags = img.category_tags ? img.category_tags.slice(0, 3).join(', ') : ''
        return `- ${img.type}${img.is_hero ? ' (HERO)' : ''}: ${labels}${tags ? ` [${tags}]` : ''}`
      }).join('\n')
    : 'No images uploaded'

  // Website structured
  const structuredWebsite = extractStructuredWebsiteData(websiteAnalysis)
  const ctas = structuredWebsite.ctaTexts?.slice(0, 8).join(', ') || '—'
  const headers = structuredWebsite.headers?.slice(0, 6).join(' | ') || '—'
  const valuePhrases = structuredWebsite.valuePhrases?.slice(0, 3).join(' | ') || '—'
  const menuCats = structuredWebsite.menuCategoriesMentioned?.slice(0, 10).join(', ') || '—'

  // Location phrase
  const langCode = language.code || 'da-DK'
  const cityName = location?.enrichment?.macro?.city || business?.city || 'Unknown'
  const areaType = location?.enrichment?.micro?.area_type
  const nearbySignal = location?.enrichment?.micro?.nearby_signals?.[0]
  const locationPhrase = renderLocationPhrase(areaType, langCode, nearbySignal)


  const rawVenueType = (profile as any)?.business_category || business?.business_type_hybrid?.primary || 'café'
  const venueTypeMap: Record<string, string> = {
    'hospitality': 'Café', 'food_service': 'Restaurant', 'cafe': 'Café',
    'restaurant': 'Restaurant', 'bar': 'Bar', 'bistro': 'Bistro'
  }
  const venueType = venueTypeMap[rawVenueType.toLowerCase()] || rawVenueType

  const cityPreposition = langCode.startsWith('da') ? 'i' : langCode.startsWith('de') ? 'in' : 'in'
  const canonicalLocationHook = locationPhrase ? `${locationPhrase} ${cityPreposition} ${cityName}` : ''

  // Build menu proof tokens — use aiSummaryItems (category-level phrases) PLUS specific dish names
  // This gives AI concrete examples to cite in proofs instead of generic statements
  const menuAnchors = Array.isArray(analysis?.must_use_phrases?.brand_essence) ? analysis.must_use_phrases.brand_essence : []
  const summaryTokens = (aiSummaryItems || []).slice(0, 15)  // Increased from 8 to 15 for more proof material
  
  // Extract specific dish names from menu items (first 10 items for proof diversity)
  const dishNames = (menu || []).slice(0, 10).map((item: any) => item.name).filter(Boolean)
  
  const uniqueMenuTokens = Array.from(new Set([
    ...menuAnchors.map((a: string) => String(a).toUpperCase()),
    ...summaryTokens.map((t: string) => t.toUpperCase()),
    ...dishNames.map((d: string) => String(d))  // Keep dish names in original case for natural citation
  ].filter(Boolean))) as string[]

  // Primary CTA
  const primaryCta = (() => {
    if (structuredWebsite?.ctaTexts?.length > 0) {
      const bookingCta = structuredWebsite.ctaTexts.find((cta: string) => /book|reserv|bord/i.test(cta))
      if (bookingCta) return bookingCta.toUpperCase()
    }
    return locale?.preferredPhrasing?.['cta_book'] || 'BOOK DIT BORD'
  })()

  const ALLOWED_PROOF_TOKENS = [
    canonicalLocationHook, 
    primaryCta, 
    ...uniqueMenuTokens, 
    locationPhrase || 'ved åen',  // Specific location term from locale
    cityName,
    // Add opening hours if available (proof of late-night service)
    ...(openingHoursRows || []).filter((h: any) => h.close_time >= '22:00').map((h: any) => `åbent til ${h.close_time}`),
    // Add service period names as proof tokens
    ...(menuSummaries || []).map((m: any) => m.title)
  ].filter(Boolean).map(t => String(t)).filter((t, i, arr) => arr.indexOf(t) === i)

  // ---- Analysis sections ----

  // Distinctive hooks helper
  const listWithEvidence = (items: any[], labelKey: string, title: string): string => {
    if (!Array.isArray(items) || items.length === 0) return ''
    return `${title}:\n` + items.slice(0, 5).map((it, idx) => {
      const label = String(it?.[labelKey] || '').trim() || '(missing)'
      const ev = String(it?.evidence || it?.evidence_refs?.join('; ') || '').trim()
      const src = String(it?.source || '').trim()
      return `  #${idx + 1} ${label}${ev ? ` — "${ev}"` : ''}${src ? ` [${src}]` : ''}`
    }).join('\n')
  }

  const hooksSection = listWithEvidence(analysis?.distinctive_hooks || [], 'hook', 'DISTINCTIVE HOOKS (non-menu differentiators)') || 'No distinctive hooks identified'

  // Usage occasions
  const usageOccasions = Array.isArray(analysis?.usage_occasions) ? analysis.usage_occasions.slice(0, 4) : []
  const occasionsSection = usageOccasions.length
    ? usageOccasions.map((o: any, i: number) => {
        const ev = Array.isArray(o.evidence) && o.evidence[0]
          ? `"${o.evidence[0].quote}" [${o.evidence[0].source}]`
          : (Array.isArray(o.evidence_refs) ? o.evidence_refs.slice(0, 2).join('; ') : '—')
        return `${i + 1}. [${o.id}] ${o.name}
   When: ${o.when}
   Situation: ${o.situation || '—'}
   Behavior: ${o.behavior}
   Job-to-be-done: ${o.job_to_be_done}
   Evidence: ${ev}
   Confidence: ${o.confidence}`
      }).join('\n\n')
    : 'No usage occasions identified'

  // Example sentences from website (value phrases only — Prompt A evidence field is not populated in compact schema)
  const exampleSentences: string[] = structuredWebsite.valuePhrases?.slice(0, 2) || []
  const exampleSentencesSection = exampleSentences.length > 0
    ? exampleSentences.map((s: string) => `"${s}"`).join('\n')
    : '—'

  // Tone markers
  const toneMarkers = Array.isArray(analysis?.tone_markers_from_text) ? analysis.tone_markers_from_text.slice(0, 8) : []

  // Voice context signals from Prompt A (Phase 1 extraction)
  const voiceSignals = analysis?.voice_context_signals || {}
  const hasKidsMenu = voiceSignals.has_kids_menu === true || operations?.has_kids_menu === true
  const hasEnglishMenu = voiceSignals.has_english_menu === true
  const priceRegister: string = voiceSignals.price_register || (profile?.price_level === '1' ? 'budget' : profile?.price_level === '3' || profile?.price_level === '4' ? 'premium' : 'mid')
  const locationAtmosphere: string[] = Array.isArray(voiceSignals.location_atmosphere) ? voiceSignals.location_atmosphere : []
  const hasWaterfront = locationAtmosphere.includes('waterfront') || /åen|havn|strand|waterfront/i.test(business?.address || '')
  const hasOutdoor = operations?.has_outdoor_seating === true || locationAtmosphere.includes('outdoor_seating')


  // --- Signal profile: location cluster detection ---
  // Co-primary cluster: signals within COPRIMARY_SPREAD pts of top score are treated as co-equal.
  // Prevents single-signal dominance (e.g. waterfront capturing all voice rules).
  const COPRIMARY_SPREAD = 15
  const allCategoryEntries = (Object.entries(categoryScores) as [string, number][])
    .sort(([, a], [, b]) => b - a)
  const topCatScore = allCategoryEntries[0]?.[1] ?? 0
  const includedSignals = allCategoryEntries.filter(([, score]) => score >= 15)
  const coprimarySignals = includedSignals.filter(([, score]) => topCatScore - score <= COPRIMARY_SPREAD)
  const secondarySignals = includedSignals.filter(([, score]) => topCatScore - score > COPRIMARY_SPREAD && score >= 30)
  const isCoprimaryCluster = coprimarySignals.length >= 2
  const conceptFit = locIntelRow?.concept_fit_by_category || {}

  // --- Signal profile: menu signal extraction (3 voice-relevant dimensions only — not prose) ---
  const menuSignalExtracts = (menuSummaries || []).map((m: { title: string; summary: string }) => {
    const text = `${m.title} ${m.summary}`.toLowerCase()
    const priceMatch = text.match(/ø\s*(\d+)\s*dkk/i)
      || text.match(/gns\.?\s*(\d+)\s*kr/i)
      || text.match(/fra\s+(\d{2,3})\s*kr/i)
      || text.match(/[\s(,](\d{2,3})\s*kr[\s.,)]/i)
      || text.match(/(\d{2,3}),-/i)
    const avgPriceKr = priceMatch ? parseInt(priceMatch[1], 10) : null
    let structureType = 'ukendt'
    if (/\d+[-\s.]rett|sæt\s?menu|tasting\s?menu|fast\s?menu/i.test(text)) structureType = 'set-menu'
    else if (/brunch/i.test(text)) structureType = 'brunch-menu'
    else if (/tapas|deleretter|sharing/i.test(text)) structureType = 'deleretter'
    else if (/a[\s-]la[\s-]carte|à la carte/i.test(text)) structureType = 'a-la-carte'
    else if (/burger|pizza|sandwich|smørrebrød/i.test(text)) structureType = 'casual'
    const dietaryFlags: string[] = []
    if (/børnemenu|børneret|barneret/i.test(text)) dietaryFlags.push('børnemenu')
    if (/vegansk|vegan/i.test(text)) dietaryFlags.push('vegan')
    if (/glutenfri|gluten.fri/i.test(text)) dietaryFlags.push('glutenfri')
    return { title: m.title, avgPriceKr, structureType, dietaryFlags }
  })
  const validPrices = menuSignalExtracts.map((e: any) => e.avgPriceKr).filter((p: any): p is number => p !== null)
  let confirmedAvgPrice: number | null = null
  if (validPrices.length > 0) {
    confirmedAvgPrice = Math.round(validPrices.reduce((a: number, b: number) => a + b, 0) / validPrices.length)
  } else if (menu && menu.length > 0) {
    // Fallback: extract prices from structured menu items (parsed from menu_results_v2.structured_data)
    const menuItemPrices = menu
      .map((item: any) => {
        const p = item.price
        if (!p) return null
        const n = typeof p === 'number' ? p : parseFloat(String(p).replace(/[^0-9.]/g, ''))
        return n >= 30 && n <= 800 ? n : null // plausible food price range
      })
      .filter((p: any): p is number => p !== null)
    if (menuItemPrices.length >= 3) { // require at least 3 items for a reliable average
      confirmedAvgPrice = Math.round(menuItemPrices.reduce((a: number, b: number) => a + b, 0) / menuItemPrices.length)
    }
  }
  const confirmedStructures = [...new Set(menuSignalExtracts.map((e: any) => e.structureType as string).filter((t: string) => t !== 'ukendt'))]
  const confirmedDietaryFromSummary = [...new Set(menuSignalExtracts.flatMap((e: any) => e.dietaryFlags as string[]))]

  // Craft provenance (from menu text)
  const allMenuItemText: string = [
    ...(menuSignalProgrammes || []).flatMap((p: { items: string[] }) => p.items || []),
    ...(Array.isArray(aiSummaryItems) ? aiSummaryItems.map((i: any) => `${i.name || ''} ${i.description || ''}`) : [])
  ].join(' ')
  const hasCraftProvenance = /hjemmelavet|hjemmebagt|hjemmerøget|håndlavet|selvlavet|\bhøjer\b|\bhanegal\b|\bfriland\b|\bøkologisk|lokale producent|lokal leverandør/i.test(allMenuItemText)

  // Venue vertical flags (for signal profile description)
  const venueTypeLower = rawVenueType.toLowerCase()
  const isBakeryPatisserie = /bageri|bager|patisserie|konditori|kagebar/i.test(venueTypeLower)
  const isStreetFoodFastCasual = /pizza|burger|street.?food|food.?truck|shawarma|sandwich|smørrebrød|pølsevogn|takeaway|fastfood/i.test(venueTypeLower)

  // No saved social posts — derive tone rules from observed markers (Path B always).
  const writingSamplesSection = `---
NO WRITING SAMPLES (Path B — derive rules from observed markers):
No saved social posts exist. Derive tone_of_voice rules using this strict process:
1. Look at TONE MARKERS FROM TEXT below. Each marker describes something observed in the actual website copy.
2. For each marker, formulate exactly ONE writing rule that would produce that pattern in captions.
3. Only generate as many rules as you have markers — do NOT pad with generic writing advice.
4. Apply VOICE REASONING FRAMEWORK from SIGNAL PROFILE — these signal-derived constraints override generic choice.
4a. THIN SIGNAL CHECK: If SIGNAL PROFILE contains a ⚠️ THIN SIGNAL warning, TONE MARKERS alone are insufficient.
    Every rule must additionally name the specific signal from SIGNAL PROFILE (venue_type, price_register, or business_character) that grounds it.
    A rule that could equally apply to a generic café or restaurant of the same type FAILS this test — rewrite it with a narrower constraint.
5. Every rule must be written in plain Danish that a business owner can read and act on the same day.
   FORBIDDEN in rules: linguistics terms ('nominale konstruktioner', 'fragmenter', 'sætningsstruktur').
   REQUIRED format: imperative verb + concrete guidance. Bad: 'Variér sætningslængden'. Good: 'Skriv én tanke pr. sætning — stop før du forklarer.'.

`

  // Brand essence note (field is built deterministically in post-processing — AI output is overwritten)
  // WP1: Determine if this is a hybrid/bar venue based on operational programmes + late_night signal
  // Also check website_analyses.raw_result.analysis for venues where business_profile.menu_signal is empty

  // --- Source 1: business_profile.menu_signal + opening_hours table (structured) ---
  const hasProgrammeMultiple = menuSignalProgrammes != null && menuSignalProgrammes.length >= 2
  const hasProgrammeBarSignal = menuSignalProgrammes != null && menuSignalProgrammes.some(
    (p: { role: string; timeContext: string | null; items: string[] }) =>
      /bar|cocktail|drink|aften|3[-.\s]rett|dinner|middag/i.test(p.role)
  )
  const hasTableLateNight = openingHoursRows != null && openingHoursRows.some(
    (r: { weekday: string; open_time: string; close_time: string }) => {
      const h = parseInt((r.close_time || '99:00').split(':')[0], 10); return h >= 0 && h < 6
    }
  )

  // --- Source 2: website_analyses.raw_result.analysis (for businesses without business_profile row) ---
  const waAnalysis: any = (websiteAnalysis as any)?.raw_result?.analysis || {}
  const waKeywords: string[] = Array.isArray(waAnalysis?.keywords) ? waAnalysis.keywords : []
  const waUniqueHooks: any[] = waAnalysis?.venueHooks?.uniqueHooks || []
  const waKeywordText = waKeywords.join(' ').toLowerCase()
  const waHooksText = waUniqueHooks.map((h: any) => `${h.hook || ''} ${h.text || ''}`).join(' ').toLowerCase()
  // Also scan profile description fields and existing business_character for hybrid signals
  const waProfileText = [
    (profile as any)?.short_description || '',
    (profile as any)?.long_description || '',
    existingBusinessCharacter || ''
  ].join(' ').toLowerCase()
  const waAllText = `${waKeywordText} ${waHooksText} ${waProfileText}`

  // Bar/evening signal from website keywords + hooks
  const waHasBarSignal = /cocktail|bar\b|drink|aftensmad|aftensmenu|3[-.\s]rett|dinner|middag/i.test(waAllText)
  // Day-time signal from website (confirms venue serves daytime meals too)
  const waHasDaySignal = /brunch|frokost|morgen|morgenmad|lunch/i.test(waAllText)
  // Late-night from website openingHours object: {friday: {close: "02:00"}, ...}
  const waOpeningHours: Record<string, any> = waAnalysis?.openingHours || {}
  const waHasLateNight = Object.values(waOpeningHours).some((day: any) => {
    // Skip if explicitly closed or missing close time
    if (!day || day.closed === true || !day.close) return false
    const closeStr: string = day.close || ''
    const h = parseInt(closeStr.split(':')[0], 10)
    return !isNaN(h) && h >= 0 && h < 6
  })

  // --- Combined hybrid detection ---
  const hasMultipleProgrammes = hasProgrammeMultiple || (waHasDaySignal && waHasBarSignal)
  const hasBarOrEveningSignal = hasProgrammeBarSignal || hasTableLateNight || waHasBarSignal || waHasLateNight
  const isHybridVenue = hasMultipleProgrammes && hasBarOrEveningSignal

  // --- Signal profile: late computed flags (depend on isHybridVenue / hasBarOrEveningSignal) ---
  const isPureBar = /cocktailbar|natbar|\bbar\b|diskotek|natklub/i.test(venueTypeLower) && !waHasDaySignal

  // --- Build SIGNAL PROFILE section ---
  // Replaces Voice Derivation Anchors + Tone Constraints.
  // TypeScript assembles structured facts; the AI reasons to conclusions from them (not from pre-written rules).

  const physicalLocCount = locationsCount ?? 1

  // Service model detection
  const hasTableService = operations?.has_table_service === true
    || (isHybridVenue && hasBarOrEveningSignal)
    || /bordservering|bordbetjening/i.test(existingBusinessCharacter || '')

  // Confirmed venue roles from programme data
  const confirmedVenueRoles: string[] = []
  if (menuSignalProgrammes && menuSignalProgrammes.length > 0) {
    if (menuSignalProgrammes.some((p: { role: string }) => /brunch|kaffe|cafe|morgen|dag/i.test(p.role))) confirmedVenueRoles.push('café')
    if (menuSignalProgrammes.some((p: { role: string }) => /frokost|lunch|middag|dinner|aften|3.rett/i.test(p.role))) {
      if (!confirmedVenueRoles.includes('restaurant')) confirmedVenueRoles.push('restaurant')
    }
    if (menuSignalProgrammes.some((p: { role: string }) => /bar|cocktail|drink/i.test(p.role))) confirmedVenueRoles.push('bar')
  }
  const venueRolesDisplay = confirmedVenueRoles.length > 1
    ? `${confirmedVenueRoles.join(', ')} (fuldt hybrid bekræftet — alle roller)`
    : venueType

  // Meal arc from programme data, with structural fallback when menu extraction is unavailable
  // Only primary brand programmes contribute to the meal arc (operational ones like BØRNEMENU are excluded)
  const brandProgrammes = menuSignalProgrammes
    ? menuSignalProgrammes.filter((p: { brand_weight?: string }) => p.brand_weight !== 'operational')
    : null
  const mealArc = brandProgrammes && brandProgrammes.length > 0
    ? brandProgrammes.map((p: { role: string; timeContext: string | null }) =>
        `${p.role}${p.timeContext ? ` (${p.timeContext})` : ''}`
      ).join(', ')
    : isHybridVenue
      ? `dag${waHasDaySignal ? ' (kaffe/brunch/frokost)' : ''}, aften${hasBarOrEveningSignal ? '/bar' : ''} — inferred fra venue_type (ingen menu-ekstrakt tilgængelig)`
      : hasBarOrEveningSignal && !waHasDaySignal
        ? 'aften/bar — inferred fra venue_type (ingen menu-ekstrakt tilgængelig)'
        : waHasDaySignal
          ? 'dag (kaffe/brunch/frokost) — inferred fra venue_type (ingen menu-ekstrakt tilgængelig)'
          : null

  // Ordered programme slot labels for data-driven Eksempel: slot instruction (brand programmes only)
  const confirmedProgrammeSlots: string[] = brandProgrammes && brandProgrammes.length > 0
    ? brandProgrammes.map((p: { role: string; timeContext: string | null }) =>
        p.timeContext ? `${p.role} (${p.timeContext})` : p.role
      )
    : []

  // Dietary flags: merge from menu summaries + operations flags
  const allDietaryFlags = [...new Set([
    ...confirmedDietaryFromSummary,
    ...(hasKidsMenu ? ['børnemenu'] : [])
  ])]

  // Build structural signal lines
  const structuralSignalLines: string[] = []
  if (physicalLocCount >= 2) {
    structuralSignalLines.push(`- physical_locations: ${physicalLocCount} — ingen stemmeregel må referere én specifik adresse`)
  }
  structuralSignalLines.push(`- venue_type: ${venueRolesDisplay}`)
  if (mealArc) structuralSignalLines.push(`- meal_arc: ${mealArc}`)
  if (hasTableService && isHybridVenue) {
    structuralSignalLines.push('- service_model: bordbetjening (aften), casual (dag) — aftensession har commitment-vægt')
  } else if (hasTableService) {
    structuralSignalLines.push('- service_model: bordbetjening')
  }
  if (operations?.has_takeaway) structuralSignalLines.push('- takeaway: bekræftet')
  if (confirmedAvgPrice !== null) {
    structuralSignalLines.push(`- avg_menu_price: ~${confirmedAvgPrice} DKK (fra AI-summary — bekræfter prisniveau)`)
  }
  if (confirmedStructures.length > 0) {
    structuralSignalLines.push(`- menu_structure: ${confirmedStructures.join(' + ')}`)
  }
  if (allDietaryFlags.length > 0) {
    structuralSignalLines.push(`- dietary_flags: ${allDietaryFlags.join(', ')} — inkluderende register krævet`)
  }
  const priceConfirmNote = confirmedAvgPrice !== null ? ` (bekræftet: ~${confirmedAvgPrice} DKK)` : ''
  structuralSignalLines.push(`- price_register: ${priceRegister}${priceConfirmNote}`)
  if (hasEnglishMenu) {
    structuralSignalLines.push('- has_english_menu: JA — internationalt tilgængeligt register; undgå idiomer uden universelt forankring')
  }
  if (hasOutdoor) structuralSignalLines.push('- outdoor_seating: JA')
  if (hasCraftProvenance) structuralSignalLines.push('- craft_provenance: bekræftet (hjemmelavet/leverandørnavne/øko i menu)')
  if (isBakeryPatisserie) structuralSignalLines.push('- vertical: bageri/konditori')
  if (isStreetFoodFastCasual) structuralSignalLines.push('- vertical: street food/fast casual')
  if (isPureBar) structuralSignalLines.push('- vertical: ren bar/natklub (ingen dagtidsprogram)')
  if (isHybridVenue) structuralSignalLines.push('- dag_til_aften_arc: bekræftet — stemmen bærer to registerlag')

  // Build location cluster lines
  const locationClusterLines: string[] = []
  if (isCoprimaryCluster && coprimarySignals.length >= 2) {
    const spread = topCatScore - (coprimarySignals[coprimarySignals.length - 1]?.[1] ?? topCatScore)
    locationClusterLines.push(`LOCATION SIGNALS (co-primary cluster — top ${coprimarySignals.length} signaler inden for ${spread} pts):`)
    for (const [type, score] of coprimarySignals) {
      const fit = conceptFit[type] as any
      const seasonal = fit?.seasonal_relevance as string | undefined
      const seasonalNote = seasonal ? ` — sæsonvægt (${seasonal}; moderat helårligt)` : ''
      locationClusterLines.push(`- ${type}: ${score} — co-primary${seasonalNote}`)
    }
    for (const [type, score] of secondarySignals) {
      const fit = conceptFit[type] as any
      // Exclude challenging/poor fit — offering_fit='mismatch' kept as backwards-compat fallback
      const isExcludedSecondary = fit?.fit_level === 'challenging' || fit?.fit_level === 'poor' || fit?.offering_fit === 'mismatch'
      if (!isExcludedSecondary) {
        locationClusterLines.push(`- ${type}: ${score} — secondary`)
      }
    }
    // Confirmed exclusions with reasons
    for (const [type] of allCategoryEntries) {
      const fit = conceptFit[type] as any
      const isExcluded = fit?.fit_level === 'challenging' || fit?.fit_level === 'poor' || fit?.offering_fit === 'mismatch'
      if (isExcluded) {
        const reason = fit?.watchouts?.[0] || fit?.exclusion_reason || 'prisleje/format passer ikke til kategorien'
        const label = fit?.fit_level === 'challenging' ? 'svær pasform' : fit?.fit_level === 'poor' ? 'dårlig pasform' : 'offering-mismatch'
        locationClusterLines.push(`- ${type}: ekskluderet (${label} — ${reason})`)
      }
    }
    const seasonalSignals = coprimarySignals.filter(([type]) => (conceptFit[type] as any)?.seasonal_relevance)
    locationClusterLines.push('')
    locationClusterLines.push('VOICE IMPLICATION (co-primary cluster — udled herfra, ikke fra pre-skrevne ankertekster):')
    locationClusterLines.push(`Ingen enkelt lokations-register dominerer stemmen.`)
    locationClusterLines.push(`Stemmen skal fungere for alle co-primary publikumstyper helårligt.`)
    if (seasonalSignals.length > 0) {
      for (const [type] of seasonalSignals) {
        const seasonal = (conceptFit[type] as any)?.seasonal_relevance
        locationClusterLines.push(`${type} er indholds-forstærker (${seasonal}) — ikke et helårligt stemmefundament.`)
      }
    }
  } else if (includedSignals.length > 0) {
    locationClusterLines.push('LOCATION SIGNALS:')
    for (const [type, score] of includedSignals) {
      const label = score >= 70 ? 'primary' : score >= 30 ? 'secondary' : 'present'
      locationClusterLines.push(`- ${type}: ${score} (${label})`)
    }
  }

  // Build voice reasoning framework questions (business-specific)
  const hasMenuProgrammeData = menuSignalProgrammes != null && menuSignalProgrammes.length > 0
  const reasoningQuestions: string[] = [
    'Baseret på SIGNAL PROFILE ovenfor — afgør stemme-regler ved at besvare disse spørgsmål:',
    '',
    '1. REGISTERSPÆND: Givet meal_arc og venue_type — hvilke registre skal stemmen dække?',
    '   Hvad adskiller dag-register fra aftenregister for DENNE specifikke forretning?',
    ...(existingBusinessCharacter
      ? [`   business_character: "${existingBusinessCharacter.slice(0, 120)}${existingBusinessCharacter.length > 120 ? '...' : ''}" — hvilke registerimplikationer har dette konkret?`]
      : []),
  ]
  if (allDietaryFlags.length > 0 || hasKidsMenu) {
    reasoningQuestions.push('2. INKLUDERINGSKRAV: Hvad signalerer dietary_flags + price_register kombineret?')
    reasoningQuestions.push('   Hvad ville lyde forkert eller ekskluderende for DENNE gæsteprofil?')
  }
  if (physicalLocCount >= 2) {
    reasoningQuestions.push(`3. MULTI-LOKATION (${physicalLocCount} lokationer): Hvilke regler MÅ IKKE referere en specifik adresse eller sceneri?`)
  }
  if (hasEnglishMenu) {
    reasoningQuestions.push('4. INTERNATIONAL FLADE: Hvad kræver has_english_menu til sproget? Hvad skubber ikke-danske gæster væk?')
  }
  if (isCoprimaryCluster) {
    reasoningQuestions.push('5. CO-PRIMARY CLUSTER: Hvad er galt med en stemme der kun passer til ét af de co-primary lokationsregistre?')
  }
  if (!hasMenuProgrammeData) {
    reasoningQuestions.push('')
    reasoningQuestions.push('⚠️ THIN SIGNAL: Ingen menu-ekstrakt tilgængelig. meal_arc er inferred, ikke bekræftet.')
    reasoningQuestions.push(`Udled regler DIREKTE fra: (1) venue_type: ${venueType}, (2) price_register: ${priceRegister}${existingBusinessCharacter ? ', (3) business_character ovenfor' : ''}.`)
    reasoningQuestions.push('Én specifik regel pr. signal. Ingen regel må kunne skrives af en konkurrent inden for samme kategori.')
  }
  reasoningQuestions.push('')
  reasoningQuestions.push('FALSIFICERBARHEDSTEST (obligatorisk for HVER regel):')
  reasoningQuestions.push('Kan en nærliggende konkurrent bruge denne regel om sig selv uden at lyve?')
  reasoningQuestions.push('Ja → kassér den og formuler én mere specifik, grundet i SIGNAL PROFILE.')
  reasoningQuestions.push('Kun regler med konkret evidens fra SIGNAL PROFILE eller TONE MARKERS accepteres.')

  // Assemble the full signal profile section
  const signalProfileSection = [
    '---',
    'SIGNAL PROFILE (strukturerede fakta — Emotionel kerne og Stemme udledes herfra, ikke fra pre-skrevne ankertekster):',
    ...(existingBusinessCharacter ? [
      'BUSINESS DESCRIPTION (bekræftet fra tidligere generering — brug som primær seed):',
      `"${existingBusinessCharacter}"`,
      ''
    ] : []),
    'STRUCTURAL SIGNALS:',
    ...structuralSignalLines,
    '',
    ...(locationClusterLines.length > 0 ? [...locationClusterLines, ''] : []),
    '---',
    'VOICE REASONING FRAMEWORK:',
    ...reasoningQuestions,
  ].join('\n')


  // Elaboration constraint: competitive differentiation framing — NOT temporal narration
  const brandElaborationConstraint = isHybridVenue ? `
🎯 BRAND ESSENCE ELABORATION — HYBRID VENUE:
Task: explain why a guest picks THIS place, not the programme it runs. Use this sentence scaffold:
- Sentence 1: '[Name] er et oplagt valg til [specific occasion] fordi [location × price × menu register] — ikke på trods af at det også er [other programme], men fordi kombinationen gør det til [specific competitive trait].'
- Sentence 2: one concrete confirming detail only THIS venue has (location name, specific dish register, price signal, opening arc)
- Sentence 3 (optional): a returning-guest angle — what confirms the choice on visit 3, not visit 1
Rule: 'Om dagen', 'Om aftenen', 'forvandles', 'skifter til' are programme narration — they belong in business_character, not here. Do not use them.
BANNED: afslapppet, afslappende, hyggelig, lækker, autentisk, unik, charmerende
` : `
🎯 BRAND ESSENCE ELABORATION:
- Task: one competitive differentiator sentence + one confirming detail. Why THIS over the similar place nearby? Do not describe the programme.
- BANNED: 'Om dagen', 'Om aftenen', 'forvandles', 'skifter til', afslappet, afslappende, hyggelig, lækker, autentisk, unik, charmerende
`

  const brandEssenceConstraint = isHybridVenue ? `
🎯 BRAND ESSENCE — HYBRID VENUE:
Stedet har FLERE bekræftede serviceprogrammer inkl. en aften/bar-dimension.
brand_essence.value skal indeholde lokationsfrasen naturligt og antyde at stedet bruges hele dagen.
REGLER:
- Svar på: "Hvorfor vælger en gæst DETTE sted frem for nabocafén 100m væk?" — ikke hvad det er.
- Nævn IKKE programmer som en liste ("frokost om dagen og skifter til cocktails om aftenen") — det er business_character, ikke brand_essence.
- Antyd tidsbuen med én sætning der indikerer bredde, f.eks. "fra morgenkaffe til natøl" eller "morgen til sen aften".
- Inkludér lokationsfrasen (f.eks. "${canonicalLocationHook || `i ${cityName}`}") naturligt i sætningen.
- Maks 180 tegn.
- FORBUDT: "lækker", "hyggelig", "afslappet", "autentisk", "unik", "serverer", "skifter til", "om dagen", "om aftenen"
Godt eksempel: "Stamstedet ${canonicalLocationHook || `i ${cityName}`} — åbent fra morgenkaffe til natøl, seks dage om ugen."
Dårligt eksempel: "${venueType} ${canonicalLocationHook || `i ${cityName}`} der serverer frokost om dagen og skifter til cocktails om aftenen."
` : `
🎯 BRAND ESSENCE — NOTE:
brand_essence.value post-processes men skriv dit bedste forsøg baseret på data.
Krav: indeholder lokationsfrasen naturligt. Starter IKKE med en fast skabelon.
Mål: en fremmed læser skal genkende stedet og ikke forveksle det med nabocaféen.
Eksempel på godt: "Det velfortjente stop ${canonicalLocationHook || `i ${cityName}`} — åbent fra morgenkaffe til natøl."
Eksempel på dårligt: "${venueType} ${canonicalLocationHook || `i ${cityName}`} hvor brunch og frokost kan nydes i roligt tempo."
- Brug en måltidskategori (brunch, frokost, middag) — IKKE et specifikt rettavn
- Inkludér én adfærdshook: flow/tempo/varighed (f.eks. "i roligt tempo", "med god tid")
- FORBUDT: "lækker", "hyggelig", "afslappet", "autentisk", "unik"
`

  const builtPrompt = `
LANGUAGE: ${language.name} only (except brand names).

BANNED WORDS (do not use anywhere):
${finalBannedWords.join(', ')}

${allowedWords.length > 0 ? `ALLOWED EXCEPTIONS (used 2+ times on website):
${allowedWords.map((w: any) => `"${w.word}" (${w.count}x)`).join(', ')}` : ''}

BUSINESS:
- name: ${business?.name || 'Unknown'}
- venue_type: ${venueType}
- city: ${cityName}
- address: ${(business as any)?.address || '—'}

${location?.enrichment ? `LOCATION ENRICHMENT (deterministic — COPY VERBATIM):
- city: ${location.enrichment.macro.city} (${location.enrichment.macro.city_tier})
- country: ${location.enrichment.macro.country}
- area_type: ${location.enrichment.micro.area_type}${location.enrichment.micro.waterfront_term ? ` → use "${location.enrichment.micro.waterfront_term}" (NEVER generic "ved vandet" or "waterfront")` : location.enrichment.micro.area_type === 'waterfront' ? ' (use specific waterway term if mentioned elsewhere)' : ''}
- nearby_signals: ${location.enrichment.micro.nearby_signals.join(', ')}
- confidence: ${location.enrichment.micro.confidence}
- neighborhood: ${locIntelRow?.local_location_reference || neighborhood || cityName || '—'}

CONCURRENT VISITOR AUDIENCE (category_scores — all true simultaneously, not a ranked list):
${sortedCategories.length > 0
  ? sortedCategories.map(([k, v]) => {
      const fit = (locIntelRow?.concept_fit_by_category || {})[k]
      const seasonal = fit?.seasonal_relevance ? ` — sæson: ${fit.seasonal_relevance}` : ''
      const driver = fit?.is_strategy_driver ? ' — strategi-driver: ja' : ''
      return `- ${k}: ${v}${seasonal}${driver}`
    }).join('\n')
  : '- (no category scores — use lightweight area_type only)'}
CATEGORY KEY TRANSLATIONS (brug disse når du skriver publikumslabels):
- waterfront → ${location?.enrichment?.micro?.waterfront_term || 'ved åen (default) / ved fjorden / ved søen / ved havnen / ved stranden / ved bugten'}
  ${location?.enrichment?.micro?.waterfront_term ? `USE "${location.enrichment.micro.waterfront_term}" (already detected from location)` : 'NEVER use "ved vandet" unless explicitly a sea/ocean location'}
- city_centre → bymidten / bycentrum
- tourist → turister / besøgende
- student → studerende
- office → erhvervsgæster / kolleger
- transport_hub → pendlere / rejsende
- shopping_district → shoppere / butiksbesøgende
- residential → naboer / lokale beboere
AUDIENCE PERMISSIONS (score-gated — check before using ANY audience label):
- tourist_strength: ${touristStrength}  →  primary/secondary: "besøgende" allowed in ONE clause; absent: forbidden
- student_strength: ${studentStrength}  →  primary only: "studerende" allowed; otherwise forbidden
- office_strength: ${officeStrength}  →  primary/secondary: "erhvervsgæster" allowed; otherwise forbidden
- NOTE: category scores reflect area geography — validate against price_register and menu_signal before using any audience label in output.
SERVICE FACTS (fact-gated — OVERRIDE any demographic inference from location or menu signals):
${hasKidsMenu ? '- has_kids_menu: true → "børnemenu" MUST appear as an experience anchor in core_offerings.value; add "Når børn kan spise med" occasion in target_audience' : '- has_kids_menu: false → FORBIDDEN: do NOT mention børnemenu, børn spiser med, familietilbud, or any family-meal framing anywhere in the profile'}
${allMarketingHooks.length > 0 ? `LOCATION MARKETING HOOKS (place verbatim in voice_examples.do_say AND cta_style — do not paraphrase, do NOT put in tone_model.good_examples):\n${allMarketingHooks.map(h => `- "${h}"`).join('\n')}` : ''}

🔴 MANDATORY PHRASES:
1. brand_essence.value SKAL indeholde lokationsfrasen naturligt — sætningen behøver IKKE starte med en fast skabelon.
   Mål: stedet er uigenkendeligt fra en konkurrent 100m væk. Konstatér — reklamér ikke.
   Godt eksempel: "Det velfortjente stop ${canonicalLocationHook} — åbent fra morgenkaffe til natøl."
   Dårligt eksempel: "${venueType} ${canonicalLocationHook} hvor man kan nyde brunch og cocktails hele dagen."
2. image_preferences.signature_shot MUST INCLUDE: "${locationPhrase}"
3. image_preferences.dos[0] MUST REFERENCE: "${locationPhrase}"` : `LOCATION: ${cityName} (no enrichment — use city name only)`}

OPERATIONS:
- establishment_type: ${operations?.establishment_type || '—'}
- has_outdoor_seating: ${operations?.has_outdoor_seating ?? false}
- has_takeaway: ${operations?.has_takeaway ?? false}
${operations?.has_outdoor_seating ? '- NOTE: has_outdoor_seating=true → include outdoor terrace/udendørs as an experience anchor in core_offerings; reflect terrace occasions in target_audience' : ''}
${operations?.kitchen_close_time ? `- kitchen_close_time: ${operations.kitchen_close_time} — signals a bar/drinks arc AFTER kitchen closes. Include this temporal transition in business_character and as a content anchor in content_focus. The period from kitchen close until venue close is a distinct social/bar occasion.` : ''}
${operations?.weekly_programme ? `- weekly_programme: "${operations.weekly_programme}" — these recurring events are confirmed non-food content anchors. Include them in content_strategy.loyalty_hooks and as explicit occasion types in target_audience (not as demographic labels).` : '- weekly_programme: null — no confirmed recurring events; do NOT invent happy hours, quiz nights, or DJ nights.'}

${(menuSignalProgrammes && menuSignalProgrammes.length > 0) || (openingHoursRows && openingHoursRows.length > 0) ? `OPERATIONAL PROGRAMMES (confirmed from menu extraction + opening hours):
${menuSignalProgrammes && menuSignalProgrammes.length > 0
  ? (() => {
      const brandProgs = menuSignalProgrammes.filter((p: { brand_weight?: string }) => p.brand_weight !== 'operational')
      const opProgs = menuSignalProgrammes.filter((p: { brand_weight?: string }) => p.brand_weight === 'operational')
      const brandLines = brandProgs.map((p: { role: string; timeContext: string | null; items: string[] }) =>
        `- ${p.role}${p.timeContext ? ` (${p.timeContext})` : ''}${p.items?.length > 0 ? `: ${p.items.slice(0, 5).join(', ')}` : ''}`
      ).join('\n')
      const opLines = opProgs.length > 0
        ? `\nTILGÆNGELIGT MEN IKKE ET BRAND-ANKER (nævn kun hvis direkte relevant — driver IKKE tone, caption-eksempler eller brand_essence):\n${opProgs.map((p: { role: string }) => `- ${p.role}`).join('\n')}`
        : ''
      return brandLines + opLines
    })()
  : ''}
${openingHoursRows && openingHoursRows.length > 0 ? (() => {
  const lateRows = openingHoursRows!.filter((r: { weekday: string; open_time: string; close_time: string }) => {
    const h = parseInt((r.close_time || '00:00').split(':')[0], 10)
    return h >= 0 && h < 6
  })
  const latestRow = [...openingHoursRows!].sort((a: { weekday: string; open_time: string; close_time: string }, b: { weekday: string; open_time: string; close_time: string }) =>
    parseInt((b.close_time || '00:00').split(':')[0], 10) - parseInt((a.close_time || '00:00').split(':')[0], 10)
  )[0]
  const parts: string[] = []
  if (lateRows.length > 0) parts.push(`- late_night_venue=true (closes after midnight: ${lateRows.map((r: { weekday: string; open_time: string; close_time: string }) => r.weekday).join(', ')})`)
  if (latestRow) parts.push(`- latest_closing_time=${latestRow.close_time} (${latestRow.weekday})`)
  return parts.join('\n')
})() : ''}
NOTE: business_character MUST list all confirmed programme roles (e.g. 'café, restaurant og bar') — do NOT reduce to single venue type.
` : ''}

${existingBusinessCharacter ? `EXISTING BUSINESS CHARACTER (previously confirmed — use as seed):
"${existingBusinessCharacter}"
Rule: Only improve/expand this — do NOT regress to a shorter or less specific description.
` : ''}

${brandEssenceConstraint}

⚠️ KRITISK FORSKEL — læs dette inden du skriver brand_essence:

business_character = HVAD stedet er (faktuel, deskriptiv)
brand_essence = HVORFOR dette sted frem for naboen 100m væk (differentierende)

FORKERT brand_essence (dette er business_character):
"Café, restaurant og bar ved åen i Aarhus der serverer frokost om dagen og skifter til cocktails om aftenen."

RIGTIGT brand_essence (dette er differentierende):
"Café ved åen der er åbent fra morgenkaffe til natøl — alle ugens dage."
"Det eneste sted i Aarhus midtby hvor du kan bruge hele dagen ved åen."

brand_essence må ALDRIG være en omskrivning af business_character.
Spørg dig selv: kunne en hvilken som helst café i Aarhus sige dette? Hvis ja — skriv om.

${brandElaborationConstraint}
---
USAGE OCCASIONS (build target_audience + content_focus from these):
${occasionsSection}

---
LOCATION MOTIVATIONS (why people visit — map each to one 'Når...' clause in target_audience):
${sortedCategories.length > 0
  ? sortedCategories.filter(([, score]) => score >= 40).map(([type, score]) => `- ${type} (${score}): confirmed visit motive`).join('\n') || '- no categories ≥40'
  : '- no category scores available (use usage_occasions only)'}

---
PROMPT A SIGNALS:
${hooksSection}

TONE MARKERS FROM TEXT (each marker = one observed pattern from website copy — derive one rule per marker):
${toneMarkers.length ? toneMarkers.map((t: string) => `- ${t}`).join('\n') : '— (no markers extracted — use TONE CONSTRAINTS only and generate minimum viable rules)'}

EXAMPLE SENTENCES FROM WEBSITE (copy their style):
${exampleSentencesSection}

${signalProfileSection}
${writingSamplesSection}
---
MENU (top items):
${menuDetails}

WEBSITE SIGNALS:
- CTAs: ${ctas}
- Headers: ${headers}
- Value phrases: ${valuePhrases}
- Menu categories: ${menuCats}

IMAGES:
${imageScenes}

${ALLOWED_PROOF_TOKENS.length > 0 ? `---
🎯 PROOF CITATION REQUIREMENTS (CRITICAL — READ THIS BEFORE WRITING ANY PROOF BULLET)

WHY PROOFS EXIST:
Proof bullets explain HOW you know the field value is correct. They cite specific data from this prompt.
Validators check that proofs reference actual tokens — generic statements fail validation.

ALLOWED PROOF TOKENS (cite these EXACT phrases in proof bullets):
${ALLOWED_PROOF_TOKENS.slice(0, 15).map((t, i) => `${i + 1}. "${t}"`).join('\n')}

PROOF BULLET FORMAT — USE ONE OF THESE CITATION PATTERNS:
Pattern 1 (Location hook): "Location hook '${canonicalLocationHook || 'ved åen i ' + cityName}' appears in..."
Pattern 2 (Menu item): "Menu analysis contains '${uniqueMenuTokens[0] || 'BRUNCH'}' + [X other items]..."
Pattern 3 (Usage occasion): "Usage occasion #[N] confirms [behavioral pattern]..."
Pattern 4 (Distinctive hook): "Distinctive hook #[N]: [hook label] supports..."
Pattern 5 (CTA anchor): "Website CTA '${primaryCta}' signals..."
Pattern 6 (Signal type): "Signal price_register=${priceRegister} + tourist_strength=${touristStrength} + area_type=${areaType}..."

EXAMPLES — WRONG vs RIGHT:

❌ WRONG (generic reasoning — NO SPECIFIC TOKEN):
"Field 'tone_of_voice' derived from waterfront location and casual dining context"
"Based on the business being by the water and serving brunch"
"The atmosphere and target audience suggest..."
→ FAILS validation: contains NO exact token from ALLOWED_PROOF_TOKENS

✅ RIGHT (cites specific tokens from data):
"Field 'tone_of_voice': Location hook '${canonicalLocationHook || 'ved åen i ' + cityName}' + usage occasion #1 (roligt tempo) supports casual register"
"Field 'brand_essence': Menu analysis contains '${uniqueMenuTokens[0] || 'BRUNCH'}' + distinctive hook #1 + location hook '${locationPhrase || 'ved åen'}'"
"Field 'target_audience': Usage occasions #1, #2, #3 describe behavioral patterns; tourist_strength=${touristStrength} permits 'besøgende'"
"Field 'tone_of_voice': Signal price_register=${priceRegister} + has_kids_menu=true + area_type=${areaType} → inclusive register required"

VALIDATION RULE:
Every proof bullet MUST contain at least ONE exact phrase from ALLOWED_PROOF_TOKENS above.
If your proof could apply to any café/restaurant with similar characteristics → it's too generic → REWRITE IT.

OUTPUT JSON FORMAT (proofs must be ARRAY of strings):
{
  "field_name": {
    "value": "...",
    "proof": [
      "First bullet citing Token A + Token B",
      "Second bullet citing Token C",
      "Optional third bullet (1-3 total)"
    ]
  }
}

❌ WRONG FORMAT (single string):
"proof": "Single explanation here"

✅ RIGHT FORMAT (array of 1-3 strings):
"proof": ["Bullet 1", "Bullet 2"]

CITATION CHECKLIST (before writing each proof):
□ Does this proof mention a specific token by name? (location hook, menu item, usage occasion #N, distinctive hook #N)
□ Would this proof still make sense if I removed all the business data from the prompt?
  → If YES, it's too generic — add specific token citations
□ Can I point to the exact line in the prompt where this evidence appears?
  → If NO, I'm making an inference — cite the signal I'm inferring FROM
` : ''}

---
🎯 UNIQUENESS FILTER (ANSWER BEFORE WRITING ANY FIELD)

This is your STRATEGIC FRAMEWORK for moving from generic → specific brand profiles.

STEP 1: IDENTIFY MICRO-CATEGORY
What is the NARROWEST category this business belongs to?
- ❌ TOO BROAD: "café", "restaurant", "bar"
- ✅ SPECIFIC: "waterfront hybrid café/restaurant with extended hours"
- ✅ SPECIFIC: "specialty coffee shop with morning rush + afternoon quiet"
- ✅ SPECIFIC: "traditional lunch-focused restaurant with modern dinner menu"

Your micro-category: Combine venue_type + location type + temporal pattern (opening hours span)

STEP 2: LIST COMPETITIVE SET (mental exercise — do not output)
Think of 3 businesses in this city that could claim similar positioning.
This forces you to understand what's COMMON vs what's UNIQUE.

STEP 3: IDENTIFY DIFFERENTIATION SIGNALS (2-3 REQUIRED)
Which data signals does THIS business have that competitors in the micro-category DON'T?

Available differentiation dimensions (check the data above to identify which apply):
□ Location specificity: exact location phrase (NOT just "waterfront" — exact landmark like "ved åen i Aarhus")
□ Temporal arc: opening hours range (brunch-only vs brunch-to-late-night = different positioning)
□ Operational combo: kids menu + outdoor seating + bar (unique COMBINATION matters)
□ Price register WITHIN micro-category: budget/mid/premium (budget waterfront vs premium waterfront = different audiences)
□ Menu provenance: named suppliers, hjemmelavet, specific signature dishes
□ Tourist context: tourist_strength from location data (locals-only vs tourist-friendly)
□ Physical features: terrace, view, waterfront, historic building

YOUR DIFFERENTIATION SIGNALS FOR THIS BUSINESS:
(Identify 2-3 signals from the data above that most competitors in micro-category DON'T have)

Signal 1: [Location specificity - identify exact location phrase]
Signal 2: [Temporal/operational uniqueness - identify from hours/menu/operational data]
Signal 3: [Menu/price/tourist context - identify from available data]

STEP 4: PROOF CONSTRUCTION RULE (MANDATORY)
Every field MUST cite at least ONE differentiation signal from Step 3.
- brand_essence: Must reference Signal 1 (location)
- target_audience: Must reference at least 2 of the 3 signals in occasion clauses
- tone_of_voice STEMME-IDENTITET: Must cite signal types (price_register, area_type, meal_arc, etc.)
- core_offerings: Must reflect operational uniqueness (Signal 3)

FALSIFICATION TEST:
For each field you write, ask: "Could a competitor in my micro-category use this same text without lying?"
→ If YES: Field is too generic. Add more differentiation signals.
→ If NO: Field is appropriately specific. ✅

---
FIELD-SPECIFIC RULES:

1) brand_essence.value — see BRAND ESSENCE block above.
   BANNED WORDS: "lækker", "hyggelig", "afslappet", "autentisk", "unik", "charmerende", "fantastisk"

1b) brand_essence_elaboration.value
   - 2–3 strategic sentences contextualizing the brand essence
   - Express WHY this business exists and what makes it distinctively worth visiting
   - NOT a product list. NOT marketing copy. Strategic brand brief language.

1c) identity_keywords (array of exactly 3)
   - Each word must occupy a DIFFERENT dimension (atmosphere, formality, category)
   - WRONG: "Hygge · Samvær · Fællesskab" (all fall in atmosphere/community)
   - RIGHT: "Hygge · Uformel · Klassikere" (atmosphere + formality + category)
   - Must NOT overlap with tone_model.primary_keywords

1d) core_offerings.value
   - MUST list 3 meal CATEGORY anchors + 2 experience/service anchors
   - MEAL ANCHORS = broad meal time categories: "Brunch og morgenmad", "Frokost og smørrebrød", "Middag og 3-retters", "Brunch og frokost" etc.
   - EXPERIENCE ANCHORS = non-food offerings with SPECIFIC location terms when applicable: "Udendørs servering ved åen" (NOT "ved vandet"), "Take away", "Private events", "Bar og cocktails", "Beliggenhed ved fjorden", "Udsigt over søen". ONLY use "terrasse" if the business explicitly calls it that in their own description.
   - LOCATION TERMINOLOGY: ALWAYS use specific waterway terms ("åen", "fjorden", "søen", "havnen", "bugten") - NEVER "vandet" unless actually open sea
   - STRICTLY FORBIDDEN: copying menu item names (THE FAVORIT, BRUNCH DELUXE, DEN NYE, etc.) or ALL-CAPS token names
   - USE EVIDENCE: Derive categories from the MENU items and USAGE OCCASIONS — don't copy item names verbatim
   - EXAMPLE: "- Brunch og morgenmad\n- Frokost og salater\n- Middagsmenuer\n- Udendørs servering ved åen\n- Cocktails og drinks"

2) target_audience.value
   - Pattern: "Når gæster [behavior + context], når [situation + time], samt når [transition]"
   - MINIMUM 2 occasions. MAXIMUM 4.
   - MULTI-AUDIENCE RULE: Build from TWO sources together:
     a) USAGE OCCASIONS (behavioral — when and how guests use the venue)
     b) CONCURRENT VISITOR AUDIENCE category_scores (why they come — visit motivations)
     Each category score ≥40 earns ONE "Når..." clause. Hospitality businesses serve all
     confirmed audiences simultaneously — do NOT collapse to a single dominant type.
   - AUDIENCE PERMISSION CHECK: Before using "besøgende", check tourist_strength in data.
     tourist_strength=primary/secondary → include one visitor clause. absent → omit completely.
   - MOTIVATION → CLAUSE mapping:
     • destinationsbesøg / belønning_forkælelse → "Når gæster tager turen hertil som destination..."
     • familieudflug → "Når børn kan spise med..." (behavioral, NOT "familier")
     • hverdagskaffe / frokostpause → local routine framing
     • forretningsfrokost → "Når mødet holdes over frokosten..." (only if office_strength ≥40)
     • besøgende → allowed if tourist_strength is secondary or primary
   - OUTDOOR SEATING: If has_outdoor_seating=true (see OPERATIONS), add seasonal/terrace occasion
   - EXAMPLE (waterfront, tourist secondary): "Når gæster tager turen til åen som heldagsoplevelse, når børn kan spise med i roligt tempo, samt når besøgende til Aarhus finder vejen hertil."
   - VALIDATE: No always-banned personas; minimum 2 clauses; maximum 4 clauses
   - proof MUST reference usage_occasion IDs or #hook numbers

📋 PROOF QUALITY REQUIREMENTS (ALL FIELDS):
Every proof MUST cite at least ONE specific data point:
- ✅ ALLOWED: Specific dish names ("Pariserbøf", "CARPACCIO"), menu categories in CAPS ("BRUNCH", "COCKTAILS"), location hooks ("ved åen", "udeservering"), opening hours ("åbent til 02:00"), price points ("ca. 150 kr"). Note: "terrassen" only allowed if business explicitly uses that term.
- ❌ FORBIDDEN: Generic statements without evidence ("beliggenheden gør det til...", "bredt udvalg af...", "passer til mange gæster...")
- VALIDATION: If proof contains NO words from ALLOWED_PROOF_TOKENS or menu summary items, it is GENERIC and must be rewritten

${buildFieldInstructions({ confirmedProgrammeSlots, languageName: language.name })}`.trim()
  // isPathB: always true — sample_posts column removed; Path B (no examples) is now the only path.
  return { prompt: builtPrompt, anchorCount: structuralSignalLines.length, isPathB: true }
}


