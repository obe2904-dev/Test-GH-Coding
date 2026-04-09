/**
 * Prompt B - Brand Profile Generation
 * 
 * User-facing brand profile generation prompt.
 * Takes analysis from Prompt A and produces clean, usable content.
 */

import type { DataSources, LanguageConfig } from '../types.ts'
import { extractStructuredWebsiteData } from '../signal-extractor.ts'
import { buildMenuSummary } from '../data-gatherer.ts'
import { detectWebsitePresence } from '../website-presence.ts'
import { renderLocationPhrase } from './prompt-builder.ts'

import { DEFAULT_BANNED_WORDS_DA, DEFAULT_BANNED_WORDS_EN, aggregateWebsiteText, filterBannedWordsByBusinessUsage, computeAllowedSet } from './brand-word-lists.ts'
import { BRAND_PROFILE_SCHEMA } from './brand-profile-schema.ts'
import { filterAudienceLabels } from '../../utils/audience-filter.ts'

/**
 * Builds the system prompt for Prompt B.
 * Contains core rules and behavioral contracts for the AI.
 */
export function buildSystemPromptB(language: LanguageConfig): string {
  return `You are a social media expert who builds Brand Profiles for small local businesses. The tone_of_voice rules you produce will be used verbatim as writing guidelines for every Instagram and Facebook caption this business publishes. Output: JSON only.

🚨 LOCATION CONTEXT (HIGHEST PRIORITY) 🚨
If the prompt provides location enrichment data with area_type (waterfront, transit_hub, etc.), you MUST include the specific location phrase in:
1. brand_essence.value (start the sentence with it, e.g., "Café ved åen i Aarhus hvor...")
2. image_preferences.signature_shot (include the area phrase, e.g., "ved åen", "ved stationen")
→ Copy the exact phrases from the prompt. Don't paraphrase. Validation checks for these specific words.

STYLE:
- Write in natural ${language.name}
- Use the business's OWN words from the data provided
- Be specific where evidence exists, neutral where it doesn't
- Sound like a helpful colleague, not a marketing agency

STRUCTURE (3+2 rule for core_offerings):
- 3 meal anchors (brunch, frokost, middag, etc.)
- 2 experience/service anchors (terrasse, takeaway, etc.)

TARGET AUDIENCE (behavior-centric, TEMPORAL FORMAT):
- Use "Når gæster..." temporal phrasing to describe WHEN and HOW guests use the venue
- Each clause = SITUATION + TIME + CONTEXT (observable behavior only)
- Write 2-4 occasions using this pattern: "Når gæster [behavior + context], når [situation + time], samt når [transition]"
- ALLOWED: Temporal behavioral moments and contextual constraints
  ✅ "Når gæster samles om længere brunch ved bordet"
  ✅ "Når børn kan spise med uden bøvl" (behavioral constraint, NOT persona)
  ✅ "Når man søger hurtig frokost mellem møder" (temporal context)
  ✅ "Når aftenen glider fra middag til cocktails" (temporal flow)
  ✅ "med god tid", "i eget tempo", "før/efter arbejde" (duration/time context)
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

BUSINESS CHARACTER (business_character):
- 1–2 plain-text sentences describing what this business factually IS
- When a hybrid, list EVERY role explicitly: 'café, restaurant og bar' — not just the primary one
- Include defining physical features when they shape content opportunities: 'med udendørs terrasse', 'med havudsigt', 'i en gammel industrihal'
- Include temporal format or transitions if relevant: 'om morgenen som kaffebar, om aftenen som vinbar'
- No marketing language — just enough for an AI to infer post content priorities
- Example: 'Café, restaurant og bar med stor udendørs terrasse, der serverer kaffe og brunch om dagen og skifter til mad og drinks om aftenen.'

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
- LOCATION RULE: when a signal references the physical location, use the EXACT location type word from the data ("åen", "søen", "havnen", "stranden", "torvet" etc.). Only use "vandet" if the actual location is the sea or open coast — it is wrong for rivers (åen), lakes (søen) and harbours (havnen).

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
- notes: 1–2 sentences explaining HOW this pillar applies specifically to THIS venue — reference the venue's own attributes (location signal, food style, temporal context). Never write a generic note.

BANNED WORDS (never use):
hyggelig, lækker, indbydende, autentisk, unik, afslappet/afslappede, perfekt spot, charmerende, fantastisk, udsøgt, gastronomisk

INSTEAD USE SPECIFIC ALTERNATIVES:
- NOT "afslappet" → USE "roligt tempo", "uhøjtidelig", "i eget tempo"
- NOT "hyggelig" → USE specific details (candlelight, intimate tables, warm lighting)
- NOT "lækker" → USE actual descriptors (sprød, cremet, syrlig)

GAPS: Uncertainties go to clarifications_needed[] only. Never write "(mangler evidens)" in main fields.`
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
  const { business, location, profile, menu, images, websiteAnalysis, operations, locationIntelligenceRow, menuSummaries, aiSummaryItems, existingSamplePosts,
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
  const multiLocationNote = isMultiLocationBusiness
    ? `MULTI-LOCATION BALANCE (${highScoreCategories.length} location types ≥70 — all roughly equal): Do NOT anchor solely on the top-scoring location type. At least one sentence MUST reflect non-seasonal, non-waterfront contexts (city-centre pedestrian traffic, shopping-detour stop, everyday proximity visit). The brand narrative must work year-round, not just in good weather.`
    : ''

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

  const analysisLoc = Array.isArray(analysis?.micro_location_context) ? analysis.micro_location_context[0] : null
  const fallbackLocationPhrase = analysisLoc?.description ? analysisLoc.description : cityName

  const rawVenueType = (profile as any)?.business_category || business?.vertical || 'Café'
  const venueTypeMap: Record<string, string> = {
    'hospitality': 'Café', 'food_service': 'Restaurant', 'cafe': 'Café',
    'restaurant': 'Restaurant', 'bar': 'Bar', 'bistro': 'Bistro'
  }
  const venueType = venueTypeMap[rawVenueType.toLowerCase()] || rawVenueType

  const cityPreposition = langCode.startsWith('da') ? 'i' : langCode.startsWith('de') ? 'in' : 'in'
  const canonicalLocationHook = locationPhrase ? `${locationPhrase} ${cityPreposition} ${cityName}` : ''

  // Build menu proof tokens — use aiSummaryItems (category-level phrases) instead of raw item names
  // This eliminates the root cause of dish names leaking into core_offerings via ALLOWED_PROOF_TOKENS
  const menuAnchors = analysis?.signals?.core_offerings?.must_use_phrases || []
  const summaryTokens = (aiSummaryItems || []).slice(0, 8)
  const uniqueMenuTokens = Array.from(new Set([
    ...menuAnchors.map((a: string) => String(a).toUpperCase()),
    ...summaryTokens.map((t: string) => t.toUpperCase())
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
    canonicalLocationHook, primaryCta, ...uniqueMenuTokens, locationPhrase || 'ved åen', cityName
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

  const hooksSection = [
    listWithEvidence(analysis?.distinctive_hooks || [], 'hook', 'DISTINCTIVE HOOKS (non-menu differentiators)'),
    listWithEvidence(analysis?.physical_space_cues || [], 'cue', 'PHYSICAL SPACE CUES'),
    listWithEvidence(analysis?.rituals_and_moments || [], 'moment', 'RITUALS & MOMENTS'),
    listWithEvidence(analysis?.local_identity_cues || [], 'cue', 'LOCAL IDENTITY CUES'),
    listWithEvidence(analysis?.copy_patterns || [], 'pattern', 'COPY PATTERNS (exact phrasing)')
  ].filter(Boolean).join('\n\n') || 'No distinctive hooks identified'

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

  // Content triggers
  const contentTriggers = Array.isArray(analysis?.content_triggers) ? analysis.content_triggers.slice(0, 5) : []
  const triggersSection = contentTriggers.length
    ? contentTriggers.map((t: any, i: number) => {
        const ev = Array.isArray(t.evidence) && t.evidence[0]
          ? `"${t.evidence[0].quote}" [${t.evidence[0].source}]`
          : (Array.isArray(t.evidence_refs) ? t.evidence_refs.slice(0, 2).join('; ') : '—')
        return `${i + 1}. ${t.trigger}
   Based on: ${(t.based_on_usage_occasion_ids || []).join(', ') || '—'}
   What to show: ${(t.what_to_show || []).join(', ') || '—'}
   Copy angles: ${(t.copy_angles || []).join(', ') || '—'}
   Evidence: ${ev}`
      }).join('\n\n')
    : 'No content triggers identified'

  // Voice context
  const voiceCtx = analysis?.voice_context
  const voiceContextSection = voiceCtx
    ? `Voice Context (use to calibrate tone + competitive positioning):
  - location_profile: ${voiceCtx.location_profile || '—'}
  - business_personality: ${voiceCtx.business_personality || '—'}
  - language_mix: ${voiceCtx.language_mix || '—'}
  - energy_level: ${voiceCtx.energy_level || '—'}
  ${voiceCtx.reasoning?.length ? `- reasoning: ${voiceCtx.reasoning.join('; ')}` : ''}`
    : ''

  // Must-use phrases from signals
  const signals = analysis?.signals || {}
  const mustUsePhrases: Record<string, string[]> = {}
  Object.keys(signals).forEach((key: string) => {
    const sig = signals[key]
    if (Array.isArray(sig?.must_use_phrases) && sig.must_use_phrases.length > 0) {
      mustUsePhrases[key] = sig.must_use_phrases
    }
  })
  const mustUseSection = Object.keys(mustUsePhrases).length > 0
    ? Object.entries(mustUsePhrases).map(([k, ps]) => `${k}: ${ps.map((p: string) => `"${p}"`).join(', ')}`).join('\n')
    : '—'

  // Example sentences from evidence
  const evidence = analysis?.evidence || {}
  const exampleSentences: string[] = []
  if (Array.isArray(evidence.tone_of_voice?.example_phrases)) {
    exampleSentences.push(...evidence.tone_of_voice.example_phrases.slice(0, 3))
  }
  if (structuredWebsite.valuePhrases?.length > 0) {
    exampleSentences.push(...structuredWebsite.valuePhrases.slice(0, 2))
  }
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

  // toneConstraintsSection: retired — constraints are now part of signalProfileSection (Voice Reasoning Framework)
  const toneConstraintsSection = ''

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
  const hasCityCenter = locationAtmosphere.includes('city_centre') || locationAtmosphere.includes('shopping_street')
  const hasNeighbourhood = locationAtmosphere.includes('neighbourhood')

  // Writing samples section (Tier 1 tone signal — V2)
  // Path A quality gate: reject posts that contain banned words — prevents dirty AI-generated
  // sample_posts (containing 'lækker', 'hyggelig' etc.) from teaching the AI its own worst habits.
  const cleanSamplePosts = (existingSamplePosts && existingSamplePosts.length > 0)
    ? existingSamplePosts.filter((p: { post_text: string }) => {
        const text = (p.post_text || '').toLowerCase()
        return !finalBannedWords.some(w => new RegExp(`\\b${w.toLowerCase()}\\b`).test(text))
      })
    : null

  // existingSamplePosts comes from business_brand_profile.sample_posts (saved from social media)
  // Path A: clean samples available — derive rules FROM observed patterns
  // Path B: no clean samples — derive rules from tone markers + signal profile
  const writingSamplesSection = (cleanSamplePosts && cleanSamplePosts.length > 0)
    ? `---
WRITING SAMPLES (Path A — Tier 1 tone signal — highest priority for tone_of_voice):
Analyse sentence rhythm, punctuation style, use of du/vi/man, sentence length, and warmth level.
For each pattern you observe, derive exactly ONE rule that operationalises that pattern.
Derive tone_of_voice rules ONLY FROM these samples — do NOT add rules not evidenced here.
Apply VOICE REASONING FRAMEWORK constraints from SIGNAL PROFILE.

${cleanSamplePosts.slice(0, 6).map((p: { post_text: string; why_this_works?: string }, i: number) => `Sample ${i + 1}:\n"${p.post_text}"${p.why_this_works ? `\n(Note: ${p.why_this_works})` : ''}`).join('\n\n')}
`
    : `---
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
    if (!day || day.closed) return false
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
  const mealArc = menuSignalProgrammes && menuSignalProgrammes.length > 0
    ? menuSignalProgrammes.map((p: { role: string; timeContext: string | null }) =>
        `${p.role}${p.timeContext ? ` (${p.timeContext})` : ''}`
      ).join(', ')
    : isHybridVenue
      ? `dag${waHasDaySignal ? ' (kaffe/brunch/frokost)' : ''}, aften${hasBarOrEveningSignal ? '/bar' : ''} — inferred fra venue_type (ingen menu-ekstrakt tilgængelig)`
      : hasBarOrEveningSignal && !waHasDaySignal
        ? 'aften/bar — inferred fra venue_type (ingen menu-ekstrakt tilgængelig)'
        : waHasDaySignal
          ? 'dag (kaffe/brunch/frokost) — inferred fra venue_type (ingen menu-ekstrakt tilgængelig)'
          : null

  // Ordered programme slot labels for data-driven Eksempel: slot instruction
  const confirmedProgrammeSlots: string[] = menuSignalProgrammes && menuSignalProgrammes.length > 0
    ? menuSignalProgrammes.map((p: { role: string; timeContext: string | null }) =>
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

  const voiceDerivationHintsSection = '' // Legacy: fully replaced by signalProfileSection

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
This business has MULTIPLE confirmed service programmes including an evening/bar dimension.
brand_essence.value MUST capture the full time arc — NOT just one meal period.
Required format: "[full hybrid type] [location] der serverer [day programme] om dagen og skifter til [evening programme] om aftenen."
Example: "Café, restaurant og bar ${canonicalLocationHook || `i ${cityName}`} der serverer brunch og frokost om dagen og skifter til aftensmad og drinks om aftenen."
Rules:
- venueType MUST list ALL confirmed roles from OPERATIONAL PROGRAMMES (e.g. 'café, restaurant og bar') — never reduce to one
- Do NOT use 'kan nydes i roligt tempo' — use the time-arc format
- Keep under 200 chars
- BANNED: "lækker", "hyggelig", "afslappet", "autentisk", "unik"
` : `
🎯 BRAND ESSENCE — NOTE:
brand_essence.value is post-processed and will be built from your data automatically.
Still fill brand_essence.value with your best attempt following this pattern:
"${venueType} ${canonicalLocationHook || `i ${cityName}`} hvor [meal category] kan nydes [behavioral hook]."
Example: "${venueType} ${canonicalLocationHook || `i ${cityName}`} hvor brunch og frokost kan nydes i roligt tempo."
- Use a meal CATEGORY (brunch/frokost/middag) — not a specific dish name
- Include EXACTLY ONE behavioral hook: flow/tempo/duration (e.g. "i roligt tempo", "med god tid")
- BANNED: "lækker", "hyggelig", "afslappet", "autentisk", "unik"
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
- area_type: ${location.enrichment.micro.area_type}
- nearby_signals: ${location.enrichment.micro.nearby_signals.join(', ')}
- confidence: ${location.enrichment.micro.confidence}
- neighborhood: ${neighborhood || '—'}

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
- waterfront → ved vandet / åen / havnen
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

🔴 MANDATORY PHRASES — COPY EXACTLY:
1. brand_essence.value MUST START WITH: "${venueType} ${canonicalLocationHook} hvor..."
2. image_preferences.signature_shot MUST INCLUDE: "${locationPhrase}"
3. image_preferences.dos[0] MUST REFERENCE: "${locationPhrase}"` : `LOCATION: ${cityName} (no enrichment — use city name only)`}

OPERATIONS:
- establishment_type: ${operations?.establishment_type || '—'}
- has_outdoor_seating: ${operations?.has_outdoor_seating ?? false}
- has_takeaway: ${operations?.has_takeaway ?? false}
${operations?.has_outdoor_seating ? '- NOTE: has_outdoor_seating=true → include outdoor terrace/udendørs as an experience anchor in core_offerings; reflect terrace occasions in target_audience' : ''}

${(menuSignalProgrammes && menuSignalProgrammes.length > 0) || (openingHoursRows && openingHoursRows.length > 0) ? `OPERATIONAL PROGRAMMES (confirmed from menu extraction + opening hours):
${menuSignalProgrammes && menuSignalProgrammes.length > 0
  ? menuSignalProgrammes.map((p: { role: string; timeContext: string | null; items: string[] }) =>
      `- ${p.role}${p.timeContext ? ` (${p.timeContext})` : ''}${p.items?.length > 0 ? `: ${p.items.slice(0, 5).join(', ')}` : ''}`
    ).join('\n')
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

${voiceContextSection ? `---\n${voiceContextSection}\n---` : ''}

${brandEssenceConstraint}
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
CONTENT TRIGGERS (derive content_focus what_to_show + copy_angles):
${triggersSection}

---
PROMPT A SIGNALS:
${hooksSection}

MUST-USE PHRASES (copy exact words):
${mustUseSection}

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
ALLOWED PROOF TOKENS (use verbatim in proof bullets):
${ALLOWED_PROOF_TOKENS.slice(0, 10).map((t, i) => `${i + 1}. "${t}"`).join('\n')}
Every proof bullet MUST contain at least one of these verbatim.` : ''}

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
   - EXPERIENCE ANCHORS = non-food offerings: "Terrasse ved åen", "Take away", "Private events", "Bar og cocktails"
   - STRICTLY FORBIDDEN: copying menu item names (THE FAVORIT, BRUNCH DELUXE, DEN NYE, etc.) or ALL-CAPS token names
   - USE EVIDENCE: Derive categories from the MENU items and USAGE OCCASIONS — don't copy item names verbatim
   - EXAMPLE: "- Brunch og morgenmad\n- Frokost og salater\n- Middagsmenuer\n- Udendørs terrasse ved åen\n- Cocktails og drinks"

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

0) voice_rationale — SKRIV DETTE FØR tone_of_voice
   - List every signal category available for this business with its specific voice implication
   - Explicitly state text evidence quality: was there real prose to observe? (website copy, social posts) Or only structural signals (menu items, opening hours, location)?
   - Close with: are the Voice rules "observed" (from actual text) or "assessed" (inferred from situational signals)?
   - Written in plain Danish a business owner can read and understand
   - Every sentence must contain at least one concrete business signal — no generic filler

3) tone_of_voice.value — TWO-PART FORMAT
   Write this field in two clearly labelled sections, then Eksempel: lines.

   SECTION 1 — STEMME-MEKANIK (2–3 rules):
   Universal mechanics rules about HOW sentences are built. These are portable — they could apply to other venues in the same category.
   - Each rule: imperative verb + specific guidance. No period at end.
   - Must cover: sentence register (du/vi/man), tense (nutid), sentence length or rhythm.
   - FORBIDDEN: content tactics ("Indled med spørgsmål for engagement", "Afslut med CTA") — wrong section entirely.
   - Path A (writing samples): derive mechanics from observed owner rhythm — do NOT invent generic rules.
   - Path B no samples: derive EXACTLY 2–3 mechanics. Do NOT pad.
   Example mechanics (form only — do NOT copy these words): "Undgå hjælpeverber — aktiv form holder tempo", "Tal til én, ikke mange — 'du' frem for 'alle'", "Klip relativsætninger — ét verbum pr. sætning".
   CRITICAL: the examples above show the FORMAT (imperative + specific guidance) only. Derive mechanics from THIS business's actual signals — not from any wording in these instructions.

   SECTION 2 — STEMME-IDENTITET (2–3 rules):
   Voice POSTURE rules grounded in THIS business's specific SIGNAL PROFILE signals. These are NOT portable — a competitor with different signals cannot use them.
   - Each rule MUST name the specific signal it comes from in parentheses. SIGNAL KEYS — CLOSED SET (use exactly one, verbatim): meal_arc | price_register | location | venue_type | exclusion_list | dietary_flags. Do NOT invent compound keys, append Danish words to keys, or join keys with slashes.
   - Derive from confirmed signals in SIGNAL PROFILE: meal_arc, venue_type, price_register, location, dietary_flags, exclusion_list.
   - FALSIFICERINGSTEST (OBLIGATORISK): For each rule ask: "Kan en naborestaurant med et andet signal bruge denne regel?" Ja → kassér og omskriv med et smallere signal.
   - FORBIDDEN: generic rules that apply to all casual cafés. Rules must reference THIS venue's specific configuration.
   GOOD examples (these would FAIL at a different venue):
     'Stedet har et konkret fysisk anker — skriv det som aktør i situationen, ikke som stemningsbaggrund' (signal: location)
     'Første service og sen aften er ikke det samme gæsteforhold — ton ned med klokkeslættet' (signal: meal_arc)
     'Sproget behøver ikke appellere til studerende — de er ekskluderet konceptmæssigt' (signal: exclusion_list)
   BAD examples (portable to any café — would PASS at a competitor — FORBIDDEN):
     'Skriv som en person, ikke et reklamebureau' (no specific signal — fails test)
     'Vær uformel og varm' (no signal — fails test)

   FORMAT strictly:
   STEMME-MEKANIK:
   - [regel]
   - [regel]
   STEMME-IDENTITET:
   - [identitetsregel (signal: ...)]
   - [identitetsregel (signal: ...)]
   Eksempel: "[eksempel]"
   Eksempel: "[eksempel]"

   EKSEMPEL LINES — quantity:
   - Non-hybrid venue: EXACTLY 2 Eksempel: lines.
   - Hybrid venue (SIGNAL PROFILE contains dag_til_aften_arc OR meal_arc lists ≥2 programme roles):
     Write ${confirmedProgrammeSlots.length > 0 ? confirmedProgrammeSlots.length : 3} Eksempel: lines — one per confirmed programme from OPERATIONAL PROGRAMMES, in this order:
${confirmedProgrammeSlots.length > 0
    ? confirmedProgrammeSlots.map((slot, i) =>
        `     Eksempel: "[${slot} — ${i === 0 ? 'lidt rummeligere' : i === confirmedProgrammeSlots.length - 1 ? 'lakonisk, færrest mulige ord' : 'kortere, mere bestemt'}]"`
      ).join('\n')
    : `     Eksempel: "[første programme fra OPERATIONAL PROGRAMMES — lidt rummeligere]"
     Eksempel: "[aftenregister — kortere, mere bestemt]"
     Eksempel: "[sen aften/bar — lakonisk, færrest mulige ord]"`}
     Do NOT label or annotate the lines — just write ${confirmedProgrammeSlots.length > 0 ? confirmedProgrammeSlots.length : 3} sequential Eksempel: lines.

   EKSEMPEL LINES — content rules:
   - Demonstrate REGISTER ONLY: rhythm and tone, nothing else.
   - FORBIDDEN: location, setting, menu content, CTA, dish names.
   - WRONG: "Oplev café-kulturen ved vandet" (location), "Nyd carpaccio" (menu), "Bestil bord til fredag" (CTA).
   - RIGHT: short statement demonstrating stated register — no identifiable content.
   - CRITICAL: Do NOT copy or paraphrase any sentence shown as RIGHT: in these instructions. Write fresh lines that demonstrate the STEMME-MEKANIK rules you derived.

3a) tone_model.good_examples — STYLE DEMONSTRATIONS ONLY
   - Each example must demonstrate rhythm and register, NOT facts about the business
   - WRONG: "Nyd carpaccio ved åen" (dish name + location — NOT allowed)
   - WRONG: "Bestil bord til fredag aften" (CTA — NOT allowed)
   - RIGHT: "Vi er klar." (register only — neutral, clear)
   - RIGHT: "Det tager ti minutter." (rhythm only — facts-free, no context)
   - A reader should NOT be able to identify the business from these examples alone

3b) voice_constraints.value
   - ONE principle sentence explaining WHY this tone fits this specific business
   - NOT a list of forbidden words — a principle AI can reason from
   - Example: "Undgå ord der lyder som de hører hjemme i et reklamefirma — dette sted kommunikerer som en person, ikke en kampagne"

4) content_focus.value
   - USAGE-DRIVEN: derive from CONTENT TRIGGERS what_to_show + copy_angles
   - Required coverage: (1) food/service observable, (2) atmosphere/flow, (3) behavioral moments
   - Multi-signal threshold: ≥2 different signals = SUFFICIENT evidence
   - NOT allowed: Menu-only focus ("Fokus på brunch og frokost")

5) image_preferences — dos: [3 items], donts: [3 items], signature_shot: 1 iconic description
   - dos[0]: reference the mandatory location phrase
   - donts: focus on tone mismatches and generic stock-photo feel ONLY
   - signature_shot: scene + lighting + people/objects + location phrase

6) cta_style.value
   - MUST define BOTH: primary CTA (booking) AND 2-3 secondary soft CTAs
   - Not allowed: single CTA only

7) content_strategy
   - FIRST: silently classify the business on maturity (emerging/growing/established) and concept distinctiveness (commodity/distinctive_concept/destination_experience) using the evidence in the data. These are reasoning steps only — do NOT output them as fields.
   - primary_goal: the single dominant goal derived from maturity × orientation (see system prompt rules)
   - goal_blend: percentages summing to 100 using the maturity-anchored ranges from system prompt. CONSTRAINT: if emerging, retain_loyalty must be lowest. Justify your classification in your internal reasoning before committing to numbers.
   - footfall_signals: derive from USAGE OCCASIONS and business type (e.g. "weekend dinner service")
   - brand_anchors: derive from DISTINCTIVE HOOKS and brand identity signals. For commodity businesses: focus on execution quality and specific dishes, not concept narrative.
   - loyalty_hooks: derive from RITUALS & MOMENTS and repeat-visit patterns. For emerging businesses: forward-looking language only — do not fabricate existing loyalty. For established businesses: must be specific and earned, not generic.
   - LOCATION RULE: use the precise location type from the data ("åen", "søen", "havnen", "stranden"). Only use "vandet" if the location is actually the sea or open coast — it is incorrect for rivers, lakes and harbours.
   - content_category_weights: percentages summing to 100; apply concept distinctiveness modifiers from system prompt (destination_experience boosts craving_visual, distinctive_concept boosts behind_scenes, established boosts team_people)

8) voice_examples — BRAND DISPLAY LAYER (shown to business owner, NOT injected into caption AI except vocabulary)
   - do_say: MINIMUM 3 brand-authentic phrases — INCLUDE location anchors, specific CTAs, place marketing hooks here verbatim
   - dont_say: MINIMUM 3 phrases (wrong tone, too generic, wrong personality)
   - vocabulary.prefer: MINIMUM 5 words — these DO feed the caption AI as soft word signals
   - vocabulary.avoid: MINIMUM 5 words — these DO feed the caption AI as suppressed words
   - NOTE: tone_model.good_examples feeds caption AI style; do_say/dont_say are for display only

OUTPUT: Return complete Brand Profile JSON matching all required fields.
Write in ${language.name}.`.trim()
  return { prompt: builtPrompt, anchorCount: structuralSignalLines.length, isPathB: !(existingSamplePosts && existingSamplePosts.length > 0) }
}


