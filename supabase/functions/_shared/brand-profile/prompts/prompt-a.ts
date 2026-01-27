/**
 * Prompt A - Internal Analysis
 * 
 * Heavy analysis prompt that extracts signals from data sources.
 * Output is internal-only JSON used to drive Prompt B.
 */

import type { DataSources, LanguageConfig } from '../types.ts'
import { extractStructuredWebsiteData } from '../signal-extractor.ts'
import { renderLocationPhrase, getLocationGuidance } from './prompt-builder.ts'
import { buildMenuSummary, buildMenuTypeSummary, buildImagesSummary, buildSocialSummary } from '../data-gatherer.ts'

/**
 * Builds the user prompt for Prompt A (Internal Analysis).
 * 
 * This prompt asks the AI to analyze all data sources and produce
 * a structured JSON with signals, evidence, and must-use phrases.
 * 
 * @param dataSources - All gathered data sources
 * @param language - Language configuration
 * @param allowThirdParty - Whether third-party context is allowed
 * @returns The formatted prompt string
 */
export function buildPromptA(
  dataSources: DataSources,
  language: LanguageConfig,
  allowThirdParty: boolean = false
): string {
  const { business, location, profile, menu, images, websiteAnalysis, socialAccounts } = dataSources

  // Use lightweight menu summary for business type understanding only
  const menuSummary = buildMenuTypeSummary(menu)
  const imagesSummary = buildImagesSummary(images, 20).split('\n').map(img => {
    // Enhanced image summary for Prompt A
    const imgObj = images.find(i => img.includes(i.type))
    if (imgObj) {
      const labels = imgObj.ai_labels ? Object.values(imgObj.ai_labels).flat().slice(0, 5).join(', ') : ''
      const tags = imgObj.category_tags ? imgObj.category_tags.join(', ') : ''
      return `- ${imgObj.type}${imgObj.is_hero ? ' (hero image)' : ''}${labels ? `: ${labels}` : ''}${tags ? ` [${tags}]` : ''}`
    }
    return img
  }).join('\n')
  const socialSummary = buildSocialSummary(socialAccounts)

  // Extract structured website data
  const structuredWebsite = extractStructuredWebsiteData(websiteAnalysis, business)
  const areaType = location?.enrichment?.micro?.area_type
  const nearbySignal = location?.enrichment?.micro?.nearby_signals?.[0]
  const locationPhrase = renderLocationPhrase(areaType, language.code || 'da-DK', nearbySignal)

  return `${language.instructionsPromptA}

---

THIRD-PARTY CONTEXT FLAG: allow_third_party_context=${allowThirdParty}

${allowThirdParty ? '✅ Third-party context is ENABLED. You may use approved sources with mandatory phrasing and LOW confidence.' : '❌ Third-party context is DISABLED. Use only first-party data (Tier 1 & 2).'}

---

INPUT DATA (STRICT PRIORITY ORDER):

TIER 1: INTERNAL DATA (Authoritative — Always Trust)

Business Snapshot:
- Business name: ${business?.name || 'Unknown'}
- Business type/category: ${business?.vertical || 'Unknown'}
- Location: ${business?.city || 'Unknown'}${business?.address ? `, ${business.address}` : ''}
- Country: ${business?.country || 'Unknown'}

${location?.enrichment ? `TIER 1.5: DETERMINISTIC LOCATION CONTEXT (Always Trust)
- country=${location.enrichment.macro.country}
- city=${location.enrichment.macro.city}
- city_tier=${location.enrichment.macro.city_tier}
- micro_area_type=${location.enrichment.micro.area_type} (confidence=${location.enrichment.micro.confidence})
- nearby_signals: [${location.enrichment.micro.nearby_signals.slice(0, 6).map((s: string) => `"${s}"`).join(', ')}]

USAGE RULES:
- geo_context.city: Use deterministic city name above
- micro_location_context: Derive from micro_area_type + nearby_signals
- distinctive_hooks: Include area_type as location differentiator
- local_identity_cues: Use nearby_signals as evidence

` : ''}User Profile (if provided):
${profile?.short_description ? `- Short description: ${profile.short_description}` : ''}
${profile?.long_description ? `- Long description: ${profile.long_description}` : ''}
${profile?.target_audience ? `- Target audience: ${profile.target_audience}` : ''}
${profile?.price_level ? `- Price level: ${profile.price_level}` : ''}

Menu Data (Tier 1):
${menuSummary}

Uploaded Images (Tier 1):
${imagesSummary}

TIER 2: EXTERNAL DATA (Supporting Only — Use Cautiously)

Website Analysis (if available):
${websiteAnalysis ? `
STRUCTURED WEBSITE DATA (Priority - extract exact phrases):
- Page/OG Titles: ${structuredWebsite.metaTitles.length > 0 ? structuredWebsite.metaTitles.join(' | ') : 'None found'}
- Meta Descriptions: ${structuredWebsite.metaDescriptions.length > 0 ? structuredWebsite.metaDescriptions.join(' | ') : 'None found'}
- Headers (H1/H2/H3): ${structuredWebsite.headers.length > 0 ? structuredWebsite.headers.join(' | ') : 'None found'}
- Hero/above-the-fold text: ${structuredWebsite.heroTexts.length > 0 ? structuredWebsite.heroTexts.join(' | ') : 'None found'}
- About snippets: ${structuredWebsite.aboutSnippets.length > 0 ? structuredWebsite.aboutSnippets.join(' | ') : 'None found'}
- Image alt-text / image signals: ${structuredWebsite.imageAltSignals.length > 0 ? structuredWebsite.imageAltSignals.slice(0, 10).join(' | ') : 'None found'}
- Captions (if detected): ${structuredWebsite.imageCaptions.length > 0 ? structuredWebsite.imageCaptions.slice(0, 8).join(' | ') : 'None found'}
- Unique noun cues (statues/murals/terrace/etc): ${structuredWebsite.uniqueNounCues.length > 0 ? structuredWebsite.uniqueNounCues.slice(0, 10).join(' | ') : 'None found'}
- CTA Texts (buttons/links): ${structuredWebsite.ctaTexts.length > 0 ? structuredWebsite.ctaTexts.join(', ') : 'None found'}
- Value Phrases (slogans): ${structuredWebsite.valuePhrases.length > 0 ? structuredWebsite.valuePhrases.slice(0, 3).join(' | ') : 'None found'}
- Menu Categories Mentioned: ${structuredWebsite.menuCategoriesMentioned.length > 0 ? structuredWebsite.menuCategoriesMentioned.join(', ') : 'None found'}
- Detected Tone: ${structuredWebsite.aboutTone}
- Key Themes: ${websiteAnalysis.key_themes?.join(', ') || 'N/A'}

Raw Excerpt (reference if needed, truncated to 500 chars):
${structuredWebsite.rawExcerpt?.slice(0, 500) || 'None'}
` : 'No website analysis available'}

Social Media Accounts (bios only):
${socialSummary}

${allowThirdParty ? `
TIER 3: CONTROLLED THIRD-PARTY (Use with phrasing rules + LOW confidence)

**IMPORTANT THIRD-PARTY RULES**:
1. ALWAYS use hedging language: "Often described as...", "Guests mention...", "Commonly noted for..."
2. Mark ALL third-party signals as LOW confidence
3. NEVER use third-party data as primary evidence - only for confirmation/reinforcement
4. Focus on RECURRING patterns (mentioned 2+ times), not one-off comments
5. Prioritize visual confirmation (Google Maps photos) over text descriptions

**GOOGLE MAPS EVIDENCE** (Read-Only):
${dataSources.thirdPartyEvidence?.googleMaps?.photos ? `
Google Maps Photos (${dataSources.thirdPartyEvidence.googleMaps.photos.length} photos):
${dataSources.thirdPartyEvidence.googleMaps.photos.slice(0, 10).map((p: any, i: number) => 
  `  ${i + 1}. ${p.uploaded_by === 'owner' ? '[OWNER]' : '[CUSTOMER]'} ${p.labels?.join(', ') || 'no labels'}`
).join('\n')}

ALLOWED USE:
- Confirm interior visuals (murals, decor, space layout)
- Identify recurring visual themes across customer photos
- Validate what guests actually see and photograph
` : 'No Google Maps photos available'}

${dataSources.thirdPartyEvidence?.googleMaps?.reviews ? `
Google Maps Review Patterns (Recurring Terms Only):
${dataSources.thirdPartyEvidence.googleMaps.reviews
  .flatMap((r: any) => r.recurring_terms || [])
  .filter((term: string, i: number, arr: string[]) => arr.indexOf(term) === i)
  .slice(0, 15)
  .join(', ') || 'No recurring patterns detected'}

ALLOWED USE:
- Identify strong, repeated descriptors (mentioned 2+ times)
- Confirm distinctive elements guests notice
- NOT for sentiment inflation or generic praise
` : 'No Google Maps review patterns available'}

**INSTAGRAM EVIDENCE** (Business-Owned Content Only):
${dataSources.thirdPartyEvidence?.instagram?.businessPosts ? `
Instagram Posts (Last ${dataSources.thirdPartyEvidence.instagram.businessPosts.length} posts):
${dataSources.thirdPartyEvidence.instagram.businessPosts.slice(0, 8).map((p: any, i: number) => 
  `  ${i + 1}. "${p.caption.substring(0, 80)}..." [${p.image_labels?.slice(0, 3).join(', ') || 'no labels'}]`
).join('\n')}

ALLOWED USE:
- Confirm business's own visual style and messaging
- Identify what they choose to showcase
- Detect communication patterns
` : 'No Instagram business content available'}

**EXTRACTION GUIDELINES FOR THIRD-PARTY**:
1. **Recognizable Interior/Visual Identity**:
   - Google Maps customer photos showing SAME interior elements (murals, decor, features)
   - Recurring visual themes across 2+ photos
   - Label with source: "google_maps_photos|customer|recurring_visual"
   
2. **Distinctive Hooks**:
   - Recurring descriptors in 2+ reviews (e.g., "cozy by the river", "amazing mural")
   - Must be NON-menu differentiators
   - Label with source: "google_maps_reviews|recurring_pattern|low_confidence"

3. **Physical Space Cues**:
   - Confirmed by customer photos (terrace, river view, open kitchen, etc.)
   - Must be visible in multiple photos
   - Label with source: "google_maps_photos|customer|confirmed_visual"

**DISALLOWED FROM THIRD-PARTY**:
❌ Sentiment words ("amazing", "best", "incredible") - DO NOT EXTRACT
❌ Star ratings as evidence - only recurring descriptive patterns
❌ One-off mentions - require 2+ occurrences
❌ Private content or non-business Instagram accounts
❌ Unverified claims or promotional language from reviews

Google Business Category/Attributes (if available):
- Business category: ${business?.vertical || 'N/A'}

TIER 4: EXPLICITLY EXCLUDED
` : `
TIER 3: EXPLICITLY EXCLUDED (Third-party context disabled)
`}
❌ DO NOT USE: Customer reviews, star ratings, third-party blog posts, competitor mentions, claims not stated by the business itself.

---

ANALYSIS FRAMEWORK:

1. Evidence Signals
- Look for repeated words/phrases across sources
- Explicit positioning statements
- What the business emphasizes (visually + verbally)
- Language patterns (formal, casual, Danish, English mix)
- **EXTRACT EXACT PHRASES**: For each section, identify 3-8 must-use phrases (exact text from sources)
- **IDENTIFY CONCRETE ANCHORS**: Specific details like "ved åen", "brunch → middag", "cocktails/aften"
- **MULTI-SIGNAL THRESHOLD**: If a theme is supported by ≥2 different signal types (menu + location, image + text, website + menu), treat as SUFFICIENT evidence even if not explicitly stated.

2. Positioning Context
- What type of business is this?
- Is it everyday, occasion-based, destination, or niche?
- Conservative differentiation (only if explicitly supported)

3. Usage Occasion Signals (BEHAVIOR-CENTRIC, AGENTLESS)
- WHAT occasions/situations does this business enable?
- WHEN and HOW do people use this place?
- Focus on OCCASIONS, not demographics or people groups
- Extract agentless behavior phrases (remove "gæster", "folk", "mennesker", "familier", "par")

**OCCASION INFERENCE RULES** (infer with MEDIUM confidence if ≥2 signals match):
- Kids menu + family portions → "Måltider hvor børn kan spise med"
- Cocktail menu + late hours (after 22:00) → "Aften der starter med mad og fortsætter med drinks"
- Brunch-heavy menu + weekend focus → "Weekend/late-morning samlinger omkring brunch"
- Takeaway emphasis + quick service → "Hurtige måltider mellem ærinder"
- Group booking + large tables + sharing platters → "Samlinger med flere personer omkring bordet"
- Wine pairings + tasting menus → "Lange måltider med vinpairing og flere retter"
- Outdoor seating + terrace emphasis → "Måltider udendørs i sommermåneder"
- Coffee focus + laptop-friendly → "Kaffe og arbejde over længere tid"
- Early opening (before 08:00) → "Morgenmad og morgenkaffe før arbejde"
- Reservation system + booking URL → "Måltider der kræver bordreservation"
- City center location + lunch hours → "Frokoststop mellem møder/ærinder midt i byen"
- Riverside/waterfront location → "Måltider ved vandet med udsigt"

**USAGE OCCASION EXTRACTION** (always identify 2-3 agentless occasions):
- Focus on WHEN + HOW + CONTEXT (not WHO)
- Occasions must be agentless (no agent nouns in the occasion object itself)
- ALLOWED behavioral/contextual phrases:
  * "børn kan spise med" - behavioral constraint (NOT persona "familier")
  * "mellem møder", "mellem ærinder" - temporal context
  * "før arbejde", "efter arbejde" - time-of-day context
  * "med god tid", "i eget tempo" - duration/tempo
  * "hvor der er plads til..." - spatial constraint
- BANNED demographic personas:
  * "familier", "børnefamilier", "par", "venner"
  * "turister", "studerende", "lokale", "unge", "voksne"

Examples (correct - agentless with behavioral phrases):
  ✅ "Brunch hvor børn kan spise med"
  ✅ "Frokost mellem møder midt i byen"
  ✅ "Aftenmad ${locationPhrase || 'ved åen'} i roligt tempo"
  ✅ "Kaffe og arbejde med god tid"
  ✅ "Morgenmad før arbejde"

Examples (wrong - persona framing):
  ❌ "Brunch for familier med børn"
  ❌ "Frokost for travle forretningsmænd"
  ❌ "Aftenmad for par"
  ❌ "Kaffe for studerende"

4. Content & Tone Signals
- Sentence length, formality level, emotional tone
- Danish vs English terminology ratio
- Personal vs corporate voice
- **FLAG GENERIC WORDS**: If evidence is weak, list generic words to avoid
- **TONE-FROM-TEXT HEURISTIC**: Infer tone from sentence structure and adjective usage.

**VOICE CONTEXT INFERENCE** (MANDATORY):

A) **Location Profile** (infer from city + neighborhood):
- MAJOR_CITY_CENTER (København, Aarhus, Odense centrum) → Modern, potentially English-mix
- TRENDY_NEIGHBORHOOD (Vesterbro, Nørrebro, Latinerkvarteret, Trøjborg) → Casual, trendy, some English acceptable
- SUBURBAN_RESIDENTIAL → Family-friendly, approachable, warm
- SMALL_TOWN_RURAL → Traditional, local, personal, community-focused
- TOURIST_AREA (Nyhavn, Skagen, Ærø) → Accessible, welcoming, may use English

B) **Business Personality** (classify as ONE based on all signals):
- TRADITIONAL_COZY: Warm, Danish, family-focused, "hyggelig" acceptable, classic service
- MODERN_CASUAL: Relaxed but contemporary, minimal marketing fluff, friendly
- URBAN_TRENDY: English-mix okay, short punchy phrases, trend-aware, Instagram-friendly
- PREMIUM_REFINED: Sophisticated, descriptive, formal, elevated language
- LOCAL_AUTHENTIC: Community-focused, personal owner voice, local references, down-to-earth

C) **Language Mix Ratio** (from website/social analysis):
- PURE_DANISH: 100% Danish, traditional vocabulary
- DANISH_PRIMARY: 80% Danish, occasional English terms (brunch, coffee, wine)
- BILINGUAL: 50/50 mix, comfortable switching
- ENGLISH_PRIMARY: Tourist/international focus, Danish secondary

D) **Energy Level** (from punctuation, CTAs, imagery):
- HIGH: Exclamation marks, action verbs, urgency, vibrant
- MEDIUM: Balanced, inviting, conversational, warm
- LOW: Calm, descriptive, no pressure, understated

5. Menu & Offerings Discovery
- **CRITICAL**: Investigate homepage content for menu items NOT in Menu Data
- Look for pricing, product names, specialty items
- Cross-reference with existing menu data to identify NEW items
- **EXTRACT SPECIFIC DISH/PRODUCT NAMES**: These become must-use phrases

**CORE OFFERINGS STRUCTURE** (MANDATORY):
A) **Meal Anchors** (3 required): Daypart/meal types
B) **Experience/Service Anchors** (2 required if found): Service types, physical features

**IMAGE PREFERENCES STRUCTURE** (MANDATORY):
A) **DO List** (3 required): Visual best practices
B) **DON'T List** (3 required): Visual anti-patterns
C) **Signature Shot** (1 required): One iconic shot description

**THINGS TO AVOID STRUCTURE** (MANDATORY):
A) **Hard Constraints** (evidence-based only): Explicit don'ts from business
B) **Soft Suggestions** (category best practices): Prefix with "Som tommelfingerregel for [category]-indhold: undgå..."

6. Constraints & Risks
- Topics or language to avoid (if explicitly mentioned)
- Over-promising risks
- Gaps in data

7. Geographic Context Extraction (LOCATION DNA)
- **PURPOSE**: Extract location context beyond just city name - distinctive spatial cues that differentiate this venue
- **GEO_CONTEXT** (always extract):
  * city: From business.city (required, high confidence)
  * area_hint: If mentioned ("centrum", "havnefront", "latinerkvarter", "nyhavn", "${locationPhrase || 'ved åen'}", "strøget", etc.)
  * evidence: Quotes from website/address/images supporting location context

- **MICRO_LOCATION_CONTEXT** (extract 0-3 distinctive cues):
  * Extract ONLY if explicit evidence exists (don't infer from city alone)
  * Prioritize Tier 1 (business.address) > Tier 2 (website mentions) > Tier 3 (image labels)
  * Focus on DISTINCTIVE cues that affect brand positioning
  
**EXTRACTION HIERARCHY**:
1. **Tier 1 (HIGH confidence)**: business_locations.address
   - Parse for: "ved/by/near [landmark]", "[street name] + context", "nær [station/mall/university]"
  - Example: "Åboulevarden 23" → by_waterfront + "${locationPhrase || 'ved åen'}"
   - Example: "Banegårdspladsen 1" → near_railway_station + "ved banegården"

2. **Tier 2 (MEDIUM confidence)**: Website headers/hero/meta
  - Look for explicit mentions: "Nyhavn", "${locationPhrase || 'ved åen'}", "i havnen", "på strøget", "ved banegården"
   - Value phrases like "Centralt beliggende", "Med udsigt til...", "I hjertet af..."
   - Hero text location framing

3. **Tier 3 (LOW-MEDIUM confidence)**: Image AI labels (use cautiously)
   - Waterfront views: "harbor view", "canal", "river view" (cross-check with address)
   - Tourist landmarks: "tourist street", "city center", "plaza"
   - Only use if corroborated by Tier 1 or Tier 2

**CUE TYPE MAPPING** (select most specific):
- by_waterfront: "${locationPhrase || 'ved åen'}", "ved vandet", "havnefront", "canal", "river view", "åboulevarden"
- near_harbor: "i havnen", "ved havnen", "nyhavn", "harbor"
- in_tourist_area: "nyhavn", "strøget", "tourist area", "turistområde"
- near_railway_station: "ved banegården", "banegårdspladsen", "near station"
- city_center: "i centrum", "centralt", "city center", "centrum", "midtbyen"
- on_high_street: "hovedgade", "strøget", "pedestrian street"
- near_mall: "ved [mall name]", "shopping center", "indkøbscenter"
- near_university: "ved universitetet", "campus", "studenterområde"
- residential_neighborhood: "beboelseskvarter", "residential", "villakvarter"
- industrial_area: "industriområde", "erhvervsområde"
- suburb: "forstad", "udenfor centrum"
- other: Any distinctive location not covered above

**VALIDATION RULES**:
- Maximum 3 micro_location_context items (prioritize by distinctiveness)
- Require evidence quote (max 180 chars)
- Mark image-only evidence as LOW-MEDIUM confidence
- If Tier 1 address + Tier 2 website agree → HIGH confidence
- If only website mentions → MEDIUM confidence
- If only image labels → LOW confidence (require cross-validation)

**DO NOT**:
- Infer location cues from business category alone ("café" ≠ "city center")
- Use generic city references without specific spatial context
- Hallucinate landmarks not mentioned in data
- Duplicate information (if "${locationPhrase || 'ved åen'}" in area_hint, don't repeat in micro_location)

---

OUTPUT FORMAT (STRICT JSON):

Return ONLY valid JSON. No markdown, no code blocks, no explanations outside the JSON.

SIZE LIMITS (CRITICAL - prevent truncation):
- MAXIMUM 5 distinctive_hooks
- MAXIMUM 3 physical_space_cues
- MAXIMUM 3 rituals_and_moments
- MAXIMUM 2 local_identity_cues
- MAXIMUM 2 copy_patterns
- MAXIMUM 2 micro_location_context items
- MAXIMUM 4 usage_occasions
- MAXIMUM 3 content_triggers
- Evidence quotes: MAX 150 chars each (was 180)
- Example phrases: MAX 3 per signal section

DISTINCTIVE HOOKS REQUIREMENTS (MANDATORY):
- Purpose: Extract NON-menu differentiators (space, rituals, vibe, location cues, signature objects, distinctive copy patterns).
- DO NOT INVENT. If you cannot quote a supporting snippet from the input data, omit the item.
- Hard requirement: Provide at least 2 items in "distinctive_hooks". If you cannot find 2 solid hooks with evidence, return "distinctive_hooks": [] (empty array).
- MAXIMUM 5 distinctive_hooks (quality over quantity)
- MAXIMUM 3 example_phrases per signal section
- Every item MUST include:
  - evidence: an exact quote/snippet from the provided input (max 150 chars)
  - source: a short provenance string like "website_analysis|homepage|h2" or "ig|bio" or "business_profile|short_description"
  - confidence: one of ["high","medium","low"]
- If nothing is found for a list, return an empty array [].

{
  "business_id": "${business?.id || 'unknown'}",
  "generated_at": "${new Date().toISOString()}",
  "analysis_version": "1.0",

  "distinctive_hooks": [
    {
      "hook": "What makes this venue feel distinctive (non-menu)",
      "evidence": "Exact quote/snippet from input",
      "source": "website_analysis|homepage|h2",
      "confidence": "high"
    }
  ],
  "physical_space_cues": [
    {
      "cue": "Interior/space cue (e.g., mural, statues, open kitchen, river view)",
      "evidence": "Exact quote/snippet from input",
      "source": "website_body",
      "confidence": "medium"
    }
  ],
  "rituals_and_moments": [
    {
      "moment": "Ritual/moment cue (e.g., weekend ritual, golden hour, day→night)",
      "evidence": "Exact quote/snippet from input",
      "source": "website_body",
      "confidence": "medium"
    }
  ],
  "local_identity_cues": [
    {
      "cue": "Local identity cue (street name, neighborhood, landmark reference)",
      "evidence": "Exact quote/snippet from input",
      "source": "website_body",
      "confidence": "medium"
    }
  ],
  "copy_patterns": [
    {
      "pattern": "Exact recurring CTA/phrasing pattern (do not invent)",
      "evidence": "Exact quote/snippet from input",
      "source": "website_cta",
      "confidence": "high"
    }
  ],
  
  "geo_context": {
    "city": "${business?.city || 'Unknown'}",
    "area_hint": "Optional: centrum | havnefront | latinerkvarter | nyhavn | etc (only if evidenced)",
    "evidence": [
      {
        "quote": "Exact location mention from input (≤180 chars)",
        "source": "business_locations|address | website_analysis|hero | image_labels",
        "confidence": "high | medium | low"
      }
    ]
  },
  
  "micro_location_context": [
    {
      "cue_type": "by_waterfront | near_railway_station | in_tourist_area | city_center | near_harbor | on_high_street | near_mall | near_university | residential_neighborhood | industrial_area | suburb | other",
      "description": "Human-readable location phrase (e.g., 'ved åen', 'near Bruuns Galleri', 'i Nyhavn')",
      "evidence": "Exact quote supporting this cue (≤180 chars)",
      "source": "business_locations|address | website_analysis|hero|h1 | image_labels",
      "confidence": "high | medium | low"
    }
  ],
  
  "usage_occasions": [
    {
      "id": "string_kebab_case (e.g., weekend-brunch-with-kids)",
      "name": "Short human-readable name (e.g., Weekend brunch with kids)",
      "when": "Time window / daypart / weekend-weekday cue (e.g., Weekend mornings 10-14, Weekday lunch 12-15)",
      "situation": "Contextual situation - why they're there (e.g., Family gathering, work break, date night)",
      "behavior": "Observable guest behavior (e.g., Long sit-down meals, quick takeaway, sharing multiple dishes)",
      "job_to_be_done": "Underlying need/problem solved (e.g., Kids can eat without hassle, quick refuel between meetings)",
      "evidence": [
        {
          "quote": "Exact snippet from input data (≤180 chars)",
          "source": "tier1_menu | tier2_website | tier2_images | tier3_google_photos (if allowThirdParty=true)",
          "confidence": "high | medium | low"
        }
      ],
      "confidence": "high | medium | low"
    }
  ],
  
  "content_triggers": [
    {
      "trigger": "Short name (e.g., Social Anchor, Day-to-Night Flow, Waterfront Setting)",
      "based_on_usage_occasion_ids": ["occasion-id-1", "occasion-id-2"],
      "what_to_show": ["Visual motif 1 (e.g., Groups at long tables)", "Visual motif 2 (e.g., Sunset by water)"],
      "copy_angles": ["Content angle 1 (e.g., Share the moment)", "Content angle 2 (e.g., From lunch to drinks)"],
      "safe_claims_only": true,
      "evidence": [
        {
          "quote": "Exact snippet supporting this trigger",
          "source": "tier1_menu | tier2_website | tier2_images",
          "confidence": "high | medium | low"
        }
      ],
      "confidence": "high | medium | low"
    }
  ],
  
  "signals": {
    "brand_essence": {
      "signals": ["Signal 1", "Signal 2", "Signal 3"],
      "notes": "Additional context",
      "must_use_phrases": ["exact phrase 1", "exact phrase 2", "exact phrase 3"],
      "concrete_anchors": ["specific detail 1", "specific detail 2"],
      "disallowed_generic_words": ["generic word 1", "generic word 2"]
    },
    "tone_of_voice": {
      "signals": ["Formality level", "Sentence style", "Language patterns"],
      "notes": "Tone patterns observed",
      "must_use_phrases": ["exact phrase from sources"],
      "concrete_anchors": ["specific tone indicators"],
      "disallowed_generic_words": ["words to avoid if no evidence"],
      "tone_markers_from_text": ["CTA word/phrase 1", "Specific phrasing 2"],
      "sentence_length_style": "short/medium/long + example"
    },
    "target_audience": {
      "signals": [
        "TIME-BASED: brunch patterns, lunch hours, evening service, weekend vs weekday",
        "OCCASION-BASED: Kids menu → 'Måltider hvor børn kan spise med' (agentless, NOT 'families')",
        "OCCASION-BASED: Work lunch setup → 'Frokost som arbejdsmøde' (describes occasion, not people)",
        "OCCASION-BASED: Date setup (evening hours, cocktails, ambiance) → 'Aftenmad ${locationPhrase || 'ved åen'} i roligt tempo'",
        "OCCASION-BASED: Cocktails + late hours → 'Aften der starter med mad og fortsætter med drinks'",
        "CONTEXT-BASED: Location (city center → 'Frokoststop midt i byen', by river → '${locationPhrase || 'ved åen'}/ved vandet')",
        "CONTEXT-BASED: Price level implications (quick vs leisurely pacing)",
        "CONTEXT-BASED: Space/seating (terrace, bar seating, group tables → 'plads til hele bordet')"
      ],
      "notes": "AGENTLESS BEHAVIOR-CENTRIC: Describe WHEN/HOW/WHERE occasions happen, NOT WHO. Distinguish behavioral constraints from demographic personas. In Prompt A occasion objects: remove agent nouns (gæster, kunder, folk, mennesker). ALLOWED: 'børn kan spise med', 'mellem møder', 'før/efter arbejde' (contextual, not personas). In Prompt B output: 'Når gæster...' framing is grammatical necessity (not persona).",
      "must_use_phrases": ["exact occasion descriptions if stated in user profile or website"],
      "concrete_anchors": [
        "Brunch hvor børn kan spise med",
        "Frokost mellem møder midt i byen",
        "Aftenmad ${locationPhrase || 'ved åen'} i roligt tempo",
        "Hurtige frokoststop mellem ærinder",
        "Efter-arbejds-drinks ved baren",
        "Weekendbrunch med plads til hele bordet",
        "Aften der starter med mad og fortsætter med drinks",
        "Måltider med god tid ved bordet",
        "Kaffe og arbejde før/efter arbejde",
        "Lange middage i eget tempo"
      ],
      "disallowed_generic_words": [
        "DEMOGRAPHIC PERSONAS (strict ban everywhere):",
        "familier", "børnefamilier", "par", "venner",
        "turister", "studerende", "lokale", "unge", "voksne", "seniorer",
        "AGENTLESS ENFORCEMENT (ban in occasion objects only):",
        "gæster", "kunder", "folk", "mennesker",
        "NOTE: 'gæster' allowed in Prompt B ('Når gæster...') - grammatical framing, not persona",
        "PERSONA-SEEKING FRAMING (ban everywhere):",
        "Gæster der søger", "Kunder der søger", "Folk som", "Bred målgruppe"
      ],
      "allowed_behavioral_context": [
        "børn kan spise med (behavioral constraint, NOT persona 'familier')",
        "mellem møder/ærinder (temporal context)",
        "før/efter arbejde (time-of-day context)",
        "med god tid/i eget tempo (duration/tempo)",
        "hvor der er plads til... (spatial constraint)",
        "når aftenen glider... (temporal flow)"
      ],
      "kids_menu_mapping": "If kids menu detected → use 'Måltider hvor børn kan spise med' OR 'Brunch hvor børn kan spise med' (agentless behavioral constraint), NOT 'families', 'børnefamilier', 'for familier', or demographic framing",
      "inference_required": true,
      "inference_inputs": ["menu_structure", "opening_hours", "location_context", "price_level", "space_setup"]
    },
    "core_offerings": {
      "signals": ["Top 3-5 products/services", "Specialties", "Service style"],
      "notes": "What they sell and how",
      "must_use_phrases": ["specific dish/product names"],
      "concrete_anchors": ["menu categories", "price points"],
      "disallowed_generic_words": ["avoid if no menu evidence"],
      "meal_anchors": ["Meal type 1", "Meal type 2", "Meal type 3"],
      "experience_service_anchors": ["Experience/service 1", "Experience/service 2"]
    },
    "content_focus": {
      "signals": ["Topics emphasized", "Story themes"],
      "notes": "What they talk about",
      "must_use_phrases": ["recurring themes"],
      "concrete_anchors": ["specific topics"],
      "disallowed_generic_words": ["generic content words"]
    },
    "image_preferences": {
      "signals": ["Visual style", "People presence", "Composition"],
      "notes": "Visual patterns",
      "must_use_phrases": ["visual descriptors"],
      "concrete_anchors": ["specific visual elements"],
      "disallowed_generic_words": ["vague visual terms"],
      "image_dos": ["DO 1 (specific to venue)", "DO 2 (evidence-based)", "DO 3 (actionable)"],
      "image_donts": ["DON'T 1 (strategic, not overly restrictive)", "DON'T 2 (focus on tone/feel conflicts)", "DON'T 3 (avoid banning legitimate content types like menu shots, BTS, solo products)"],
      "signature_shot": "One iconic shot description",
      "notes": "CRITICAL: DON'Ts should focus on generic/stock-photo feel and tone mismatches, NOT ban legitimate content types like menu close-ups, behind-the-scenes, solo products, indoor shots, or images without people. Those are valid social media content."
    },
    "things_to_avoid": {
      "signals": ["Explicit don'ts", "Implicit constraints"],
      "notes": "Guardrails and red lines",
      "must_use_phrases": ["explicit constraints quoted"],
      "concrete_anchors": ["specific avoidance patterns"],
      "disallowed_generic_words": [],
      "hard_constraints": ["Hard 1 (explicit evidence)", "Hard 2 or empty if none"],
      "soft_suggestions": ["Soft 1 (category norm)", "Soft 2", "Soft 3"]
    },
    "cta_style": {
      "signals": ["CTA approach", "Action verbs used"],
      "notes": "How they ask for action",
      "must_use_phrases": ["exact CTA phrases found"],
      "concrete_anchors": ["specific action verbs"],
      "disallowed_generic_words": ["generic CTA words"]
    },
    "communication_goal": {
      "signals": ["Primary goal", "Success metric"],
      "notes": "What they want to achieve",
      "must_use_phrases": ["goal statements"],
      "concrete_anchors": ["success indicators"],
      "disallowed_generic_words": ["vague goal terms"]
    },
    "social_style": {
      "emoji_usage": "none | minimal | moderate | expressive (based on website/social tone)",
      "emoji_examples": ["3-5 on-brand emojis if applicable"],
      "hashtag_branded": ["#BusinessName or variations"],
      "hashtag_category": ["#brunch #cafe #restaurant etc based on type"],
      "hashtag_local": ["#cityname #neighborhood based on location"],
      "notes": "Social media style observations"
    },
    "voice_context": {
      "location_profile": "MAJOR_CITY_CENTER | TRENDY_NEIGHBORHOOD | SUBURBAN_RESIDENTIAL | SMALL_TOWN_RURAL | TOURIST_AREA",
      "business_personality": "TRADITIONAL_COZY | MODERN_CASUAL | URBAN_TRENDY | PREMIUM_REFINED | LOCAL_AUTHENTIC",
      "language_mix": "PURE_DANISH | DANISH_PRIMARY | BILINGUAL | ENGLISH_PRIMARY",
      "energy_level": "HIGH | MEDIUM | LOW",
      "notes": "Why this classification was chosen"
    },
    "voice_examples": {
      "do_say_examples": ["3-5 example phrases this brand WOULD say, based on their actual voice"],
      "dont_say_examples": ["3-5 example phrases this brand would NEVER say"],
      "vocabulary_prefer": ["5-8 words that fit this brand"],
      "vocabulary_avoid": ["5-8 words that don't fit this brand"],
      "notes": "Voice example reasoning"
    }
  },
  
  "evidence": {
    "brand_essence": {
      "has_mission_statement": false,
      "has_about_page": false,
      "has_explicit_positioning": false,
      "brand_keywords_found": [],
      "sources": [],
      "supporting_quote": ""
    },
    "tone_of_voice": {
      "has_consistent_language": false,
      "formality_level": "unknown",
      "danish_vs_english_ratio": "unknown",
      "sentence_style": "unknown",
      "sources": [],
      "example_phrases": [],
      "tone_markers_from_text": [],
      "sentence_length_style": ""
    },
    "target_audience": {
      "has_explicit_audience_statement": false,
      "usage_occasions": [],
      "usage_occasions_notes": "AGENTLESS REQUIRED: Remove ALL people words (gæster, folk, mennesker, familier, par). Examples: 'Brunch hvor børn spiser med', 'Frokost som arbejdsmøde', 'Aftenmad ${locationPhrase || 'ved åen'} i roligt tempo'",
      "has_kids_menu": false,
      "has_group_offerings": false,
      "price_level_known": false,
      "inferred_occasions": [],
      "sources": []
    },
    "core_offerings": {
      "menu_items_count": 0,
      "has_specialties_mentioned": false,
      "website_additional_items_found": [],
      "categories_identified": [],
      "sources": []
    },
    "content_focus": {
      "has_website_themes": false,
      "recurring_topics": [],
      "sources": []
    },
    "image_preferences": {
      "images_uploaded_count": 0,
      "hero_images_count": 0,
      "visual_patterns": [],
      "lighting_style": "unknown",
      "composition_style": "unknown",
      "sources": []
    },
    "things_to_avoid": {
      "has_explicit_constraints": false,
      "explicit_donts": [],
      "sources": []
    },
    "cta_style": {
      "has_cta_examples": false,
      "action_verbs_found": [],
      "booking_prompts_found": false,
      "sources": []
    },
    "communication_goal": {
      "has_explicit_goal": false,
      "inferred_from_business_type": "",
      "sources": []
    }
  },
  
  "data_quality_summary": {
    "total_evidence_flags_true": 0,
    "strong_evidence_areas": [],
    "weak_evidence_areas": [],
    "missing_critical_data": [],
    "recommendations": []
  }
}

USAGE OCCASIONS EXTRACTION (LAYER 1 - REQUIRED):

Produce 3-6 usage_occasions[] based on the venue-agnostic behavioral taxonomy:

**BEHAVIORAL PATTERNS TO DETECT**:
1. **Long-form social meals** (stay 2+ hours, share multiple dishes)
   - Signals: Group tables, sharing platters, tasting menus, wine pairings, brunch boards
   - Example id: "long-form-brunch", "multi-course-dinner"
   
2. **Quick refuel stop** (city navigation / shopping break)
   - Signals: City center location, takeaway, quick lunch menu, coffee focus, early hours
   - Example id: "quick-city-lunch", "morning-coffee-stop"
   
3. **Inclusion-first group dining** (dietary variety)
   - Signals: Kids menu, allergy options, vegetarian/vegan, dietary notes, high chairs
   - Example id: "family-friendly-brunch", "inclusive-group-dining"
   
4. **Professional third-space** (work lunch / informal meeting)
   - Signals: Laptop-friendly, WiFi, quiet seating, coffee focus, weekday lunch hours
   - Example id: "work-lunch", "professional-meeting-space"
   
5. **Day→night flow** (dinner into cocktails)
   - Signals: Cocktail menu + late hours (after 22:00), bar seating, evening emphasis
   - Example id: "dinner-to-drinks", "evening-transition"
   
6. **With-children logistics** (kids menu / high chairs signals)
   - Signals: Kids menu, family portions, outdoor play area, changing facilities
   - Example id: "meals-with-kids", "child-friendly-dining"

**USAGE OCCASION REQUIREMENTS**:
- Each occasion MUST have at least 1 evidence quote (exact snippet ≤180 chars)
- If no strong evidence exists, produce fewer occasions (minimum 2)
- Confidence levels:
  * HIGH: Multiple signals + explicit menu/website evidence
  * MEDIUM: 2+ signals from different tiers (menu + hours, location + images)
  * LOW: Single signal or conservative inference
- NEVER add location landmarks (murals/statues) unless verified by uploaded images or allowThirdParty=true Google Maps photos

**EXAMPLE EXTRACTION** (Café Faust, riverside brunch café):
{
  "id": "weekend-brunch-with-kids",
  "name": "Weekend brunch with kids",
  "when": "Weekend mornings 10-14",
  "situation": "Family gathering where kids can eat comfortably",
  "behavior": "Long sit-down meals, sharing brunch boards, kids eating from dedicated menu",
  "job_to_be_done": "Parents can relax while kids are fed and entertained",
  "evidence": [
    { "quote": "Kids menu with pancakes, chicken strips", "source": "tier1_menu", "confidence": "high" },
    { "quote": "Family-friendly brunch spot by the river", "source": "tier2_website", "confidence": "medium" }
  ],
  "confidence": "high"
}

CONTENT TRIGGERS EXTRACTION (LAYER 2 - REQUIRED):

Produce 3-5 content_triggers[] derived from usage_occasions[]:

**TRIGGER TYPES TO EXTRACT**:
1. **Social Anchor** - Places where people gather and connect
   - Based on: Long-form meals, group tables, sharing emphasis
   - what_to_show: ["Groups at long tables", "Sharing platters", "Friends laughing"]
   - copy_angles: ["Share the moment", "Gather around good food", "Make time for connection"]
   
2. **Day-to-Night Flow** - Venues that transition from meals to drinks
   - Based on: Evening transition occasions, cocktail menu + late hours
   - what_to_show: ["Dinner plates transitioning to cocktails", "Evening ambiance", "Bar scene"]
   - copy_angles: ["Start with dinner, stay for drinks", "From meal to moment", "Evening unfolds"]
   
3. **Waterfront/Location Setting** - Distinctive location context
   - Based on: Outdoor seating, riverside/harbor location, view emphasis
   - what_to_show: ["Food with water view", "Terrace shots", "Sunset dining"]
   - copy_angles: ["Dine by the water", "View included", "Outdoor season"]
   
4. **Family Logistics** - Makes dining with kids easy
   - Based on: Kids menu occasions, inclusion-first dining
   - what_to_show: ["Kids enjoying meals", "Family-friendly space", "Relaxed atmosphere"]
   - copy_angles: ["Kids eat, parents relax", "Everyone's welcome", "No stress dining"]
   
5. **Professional Third-Space** - Work-friendly environment
   - Based on: Work lunch occasions, laptop-friendly signals
   - what_to_show: ["Quiet corner seating", "Coffee and laptop", "Meeting-friendly"]
   - copy_angles: ["Your workspace away from work", "Meet over food", "Coffee and focus"]

**CONTENT TRIGGER REQUIREMENTS**:
- Each trigger MUST reference 1-2 usage_occasion_ids that support it
- what_to_show must be SAFE (first-party verifiable) visual motifs only
- NEVER add unverified interior elements (murals, art, specific decor) unless:
  * Present in uploaded images (tier1_images), OR
  * Confirmed in Google Maps customer photos (tier3_google_photos) when allowThirdParty=true
- safe_claims_only: Always set to true
- Evidence quotes required (can reuse from usage_occasions)

**EXAMPLE EXTRACTION** (Café Faust):
{
  "trigger": "Waterfront Social Dining",
  "based_on_usage_occasion_ids": ["weekend-brunch-with-kids", "dinner-to-drinks"],
  "what_to_show": ["Brunch plates by the river", "Sunset dining on terrace", "Groups gathered with water view"],
  "copy_angles": ["Dine by Aarhus Å", "Brunch with a view", "From lunch to evening by the water"],
  "safe_claims_only": true,
  "evidence": [
    { "quote": "Located by Aarhus Å with outdoor seating", "source": "tier2_website", "confidence": "high" },
    { "quote": "Terrace dining visible in uploaded images", "source": "tier1_images", "confidence": "high" }
  ],
  "confidence": "high"
}

EVIDENCE-BASED CONFIDENCE SCORING:

For each brand variable, fill in the evidence flags truthfully based on what you actually find.

The confidence score will be computed deterministically from your evidence flags:

- High: ≥ 0.70 (explicit evidence, authoritative)
- Inferred: 0.50 - 0.69 (reasonable deduction from first-party signals)
- Medium: 0.40 - 0.49 (weak signals)
- Low: < 0.40 (very limited evidence)

IMPORTANT: Do NOT make up evidence flags. If something doesn't exist, set it to false/0/empty.`
}
