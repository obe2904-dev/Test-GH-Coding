/**
 * Prompt A2 - Interpretation Layer
 * 
 * Takes A1 evidence JSON and produces interpretations:
 * - Distinctive hooks (differentiators)
 * - Rituals and moments (behavioral patterns)
 * - Usage occasions (behavior-centric, agentless)
 * - Content triggers (social media themes)
 * - Voice context (tone/personality inference)
 * 
 * References ONLY A1 evidence + deterministic location enrichment.
 * All claims must connect to evidence_refs.
 */

import type { DataSources, LanguageConfig } from '../types.ts'
import type { PromptA1Evidence } from './prompt-a1-evidence.ts'
import { renderLocationPhrase } from './prompt-builder.ts'

/**
 * Prompt A2 Interpretation Output Schema
 * 
 * Interpretation-only JSON derived from A1 evidence.
 * All claims traced back to A1 via evidence_refs.
 */
export type PromptA2Interpretation = {
  business_id: string
  generated_at: string
  analysis_version: "1.0"
  
  // Differentiators (max 5)
  distinctive_hooks: Array<{
    hook: string                                    // e.g., "ved åen i Aarhus", "brunch + cocktails"
    evidence_refs: string[]                         // e.g., ["location.quotes[0]", "menu.quotes[2]"]
    confidence: "high" | "medium" | "low"
  }>
  
  // Behavioral flow patterns (max 3)
  rituals_and_moments: Array<{
    moment: string                                  // e.g., "i roligt tempo ved åen"
    evidence_refs: string[]                         // References to A1 quotes
    confidence: "high" | "medium" | "low"
  }>
  
  // Usage occasions (max 4) - agentless, behavior-centric
  usage_occasions: Array<{
    id: string                                      // e.g., "brunch_with_kids", "waterfront_dinner"
    name: string                                    // e.g., "Weekend brunch hvor børn kan spise med"
    when: string                                    // Time/frequency, e.g., "Weekend mornings"
    situation: string                               // Context, e.g., "Family gatherings"
    behavior: string                                // What happens, e.g., "Long leisurely meals"
    job_to_be_done: string                          // User goal, e.g., "Feed family in relaxed setting"
    evidence_refs: string[]                         // References to A1 quotes
    confidence: "high" | "medium" | "low"
  }>
  
  // Social media content themes (max 5)
  content_triggers: Array<{
    trigger: string                                 // e.g., "Waterfront Dining Experience"
    based_on_usage_occasion_ids: string[]           // Links to usage_occasions ids
    what_to_show: string[]                          // Visual elements, e.g., ["outdoor seating", "food plates"]
    copy_angles: string[]                           // Messaging angles, e.g., ["Ved åen i Aarhus"]
    safe_claims_only: true                          // Always true (no unverified claims)
    evidence_refs: string[]                         // References to A1 quotes
    confidence: "high" | "medium" | "low"
  }>
  
  // Voice/personality inference
  voice_context: {
    location_profile: "MAJOR_CITY_CENTER" | "TRENDY_NEIGHBORHOOD" | "SUBURBAN_RESIDENTIAL" | "SMALL_TOWN_RURAL" | "TOURIST_AREA"
    business_personality: "TRADITIONAL_COZY" | "MODERN_CASUAL" | "URBAN_TRENDY" | "PREMIUM_REFINED" | "LOCAL_AUTHENTIC"
    language_mix: "PURE_DANISH" | "DANISH_PRIMARY" | "BILINGUAL" | "ENGLISH_PRIMARY"
    energy_level: "HIGH" | "MEDIUM" | "LOW"
    reasoning: string[]                             // Short bullets explaining classifications
  }
}

// Legacy type alias for backwards compatibility
export type A2InterpretationOutput = PromptA2Interpretation

/**
 * Build Prompt A2 - Interpretation from A1 Evidence
 * 
 * This prompt interprets A1 evidence to produce behavioral insights,
 * usage occasions, voice context, and distinctive hooks.
 * 
 * All interpretations must reference A1 evidence via evidence_refs.
 */
export function buildPromptA2Interpretation(
  a1Evidence: PromptA1Evidence,
  dataSources: DataSources,
  language: LanguageConfig,
  allowThirdParty: boolean = false
): string {
  const { business, location } = dataSources
  const waterfrontHook = renderLocationPhrase('waterfront', language.code, location?.enrichment?.micro?.nearby_signals?.[0]) || 'ved åen i [city]'
  const waterfrontSample = waterfrontHook.replace('[city]', business?.city || 'Aarhus')
  const waterfrontShort = (waterfrontHook.split(' i ')[0]) || 'ved åen'
  const capitalizedWaterfrontSample = waterfrontSample.charAt(0).toUpperCase() + waterfrontSample.slice(1)

  return `${language.instructionsPromptA}

---

TASK: Interpret A1 evidence to identify behavioral patterns, usage occasions, and voice context.

INPUT: A1 Evidence JSON (stringified)
\`\`\`json
${JSON.stringify(a1Evidence, null, 2)}
\`\`\`

CONTEXT:
- Business: ${business?.name || 'Unknown'} (${business?.vertical || 'Unknown'})
- Location: ${business?.city || 'Unknown'}, ${business?.country || 'Unknown'}
${location?.enrichment ? `- Area type: ${location.enrichment.micro.area_type}
- City tier: ${location.enrichment.macro.city_tier}
- Nearby signals: ${location.enrichment.micro.nearby_signals.slice(0, 6).join(', ')}` : ''}

---

OUTPUT FORMAT: Strict JSON matching PromptA2Interpretation schema:

{
  "business_id": "${a1Evidence.business_id}",
  "generated_at": "${new Date().toISOString()}",
  "analysis_version": "1.0",
  "distinctive_hooks": [
    {
      "hook": "${waterfrontSample}",
      "evidence_refs": ["location.quotes[0]", "website.quotes[3]"],
      "confidence": "high"
    }
  ],
  "rituals_and_moments": [
    {
      "moment": "i roligt tempo ${waterfrontShort}",
      "evidence_refs": ["location.quotes[0]", "menu.meal_anchors[0]"],
      "confidence": "medium"
    }
  ],
  "usage_occasions": [
    {
      "id": "weekend_brunch_with_kids",
      "name": "Weekend brunch hvor børn kan spise med",
      "when": "Weekend mornings, 9:00-12:00",
      "situation": "Family gatherings on weekends",
      "behavior": "Long leisurely meals with kids menu options",
      "job_to_be_done": "Feed family in relaxed child-friendly setting",
      "evidence_refs": ["menu.meal_anchors[0]", "menu.quotes[2]", "images.quotes[1]"],
      "confidence": "high"
    }
  ],
  "content_triggers": [
    {
      "trigger": "Waterfront Dining Experience",
      "based_on_usage_occasion_ids": ["weekend_brunch_with_kids"],
      "what_to_show": ["outdoor seating by water", "food plates", "morning light"],
      "copy_angles": ["${capitalizedWaterfrontSample}", "Brunch med udsigt"],
      "safe_claims_only": true,
      "evidence_refs": ["location.quotes[0]", "images.quotes[0]"],
      "confidence": "high"
    }
  ],
  "voice_context": {
    "location_profile": "TRENDY_NEIGHBORHOOD",
    "business_personality": "MODERN_CASUAL",
    "language_mix": "DANISH_PRIMARY",
    "energy_level": "MEDIUM",
    "reasoning": [
      "Aarhus centrum area suggests trendy neighborhood profile",
      "Casual CTAs and informal website text indicate modern casual personality",
      "Mostly Danish with occasional English terms shows Danish primary",
      "Balanced tone without urgency suggests medium energy"
    ]
  }
}

---

**SIZE LIMITS (Enforce Strictly):**
- distinctive_hooks: max 5
- rituals_and_moments: max 3
- usage_occasions: max 4
- content_triggers: max 5

**If evidence is weak (few quotes, low tier):**
- Reduce counts (e.g., 2 hooks, 1-2 occasions, 2-3 triggers)
- Lower confidence to "medium" or "low"
- Only include interpretations with ≥2 supporting evidence_refs

---

**1. DISTINCTIVE HOOKS (max 5)**

Extract differentiators from A1 evidence:
- **Location hook**: Combine location.canonical_location_hook or construct from area_type + city
- **Offering hook**: Unique menu combinations (e.g., "brunch + cocktails", "pariserbøf ved åen")
- **Time hook**: Unusual hours (e.g., "åben til midnat", "morgenmad fra 07:00")
- **Vibe hook**: Unique atmosphere (e.g., "roligt tempo ved vandet", "urban brunch hub")
- **Service hook**: Distinctive service (e.g., "bordreservation anbefales", "walk-ins welcome")

Each hook:
- Must reference ≥2 A1 quotes via evidence_refs
- Format: ["location.quotes[0]", "menu.quotes[2]", "website.quotes[5]"]
- Confidence: high (3+ refs), medium (2 refs), low (1 ref, use sparingly)

Examples:
\`\`\`json
{
  "hook": "ved åen i Aarhus",
  "hook": "${waterfrontSample}",
  "confidence": "high"
}
\`\`\`

---

**2. RITUALS AND MOMENTS (max 3)**

Behavioral flow patterns combining location + offerings + time:
- **Tempo phrases**: "i roligt tempo", "i eget tempo", "hurtige måltider"
- **Transitions**: "fra brunch til middag", "fra dag til aften"
- **Duration**: "lange ophold", "hurtige stop"
- **Time anchors**: "morgenmad før arbejde", "aftenmad ved åen"

Each moment:
- Must reference ≥2 A1 quotes
- Combine multiple evidence types (location + menu, website + images)
- Confidence based on evidence strength

Examples:
\`\`\`json
{
  "moment": "fra brunch til aften ved åen",
  "moment": "fra brunch til aften ${waterfrontShort}",
  "confidence": "high"
}
\`\`\`

---

**3. USAGE OCCASIONS (max 4) - AGENTLESS, BEHAVIOR-CENTRIC**

Multi-signal inference patterns (≥2 signals = MEDIUM confidence):

**Common Patterns:**
- Kids menu + family portions → "Måltider hvor børn kan spise med"
- Cocktails + late hours → "Aften der starter med mad og fortsætter med drinks"
- Brunch-heavy + weekend → "Weekend/late-morning samlinger omkring brunch"
- Takeaway + quick service → "Hurtige måltider mellem ærinder"
- Wine pairings + tasting → "Lange måltider med vinpairing"
- Outdoor seating + terrace → "Måltider udendørs i sommermåneder"
- Coffee focus + laptop-friendly → "Kaffe og arbejde over længere tid"
- Early opening (before 08:00) → "Morgenmad før arbejde"
- Reservation system → "Måltider der kræver bordreservation"
- City center + lunch hours → "Frokoststop mellem møder midt i byen"
- Waterfront location → "Måltider ved vandet med udsigt"

**Each occasion must include:**
- **id**: snake_case identifier (e.g., "weekend_brunch_with_kids")
- **name**: Agentless description (e.g., "Weekend brunch hvor børn kan spise med")
- **when**: Time/frequency (e.g., "Weekend mornings, 9:00-12:00")
- **situation**: Context (e.g., "Family gatherings on weekends")
- **behavior**: What happens (e.g., "Long leisurely meals with kids menu")
- **job_to_be_done**: User goal (e.g., "Feed family in relaxed setting")
- **evidence_refs**: ≥2 A1 quote references
- **confidence**: high (3+ refs), medium (2 refs), low (1 ref - avoid)

**CRITICAL: AGENTLESS PHRASING**

✅ ALLOWED behavioral/contextual phrases:
- "børn kan spise med" - behavioral constraint
- "mellem møder", "mellem ærinder" - temporal context
- "før arbejde", "efter arbejde" - time-of-day
- "med god tid", "i eget tempo" - duration/tempo
- "hvor der er plads til..." - spatial constraint

❌ BANNED demographic personas:
- "familier", "børnefamilier", "par", "venner"
- "turister", "studerende", "lokale", "unge"

---

**4. CONTENT TRIGGERS (max 5)**

Social media content themes based on usage occasions:

Each trigger:
- **trigger**: Theme name (e.g., "Waterfront Dining Experience")
- **based_on_usage_occasion_ids**: Links to usage_occasions ids
- **what_to_show**: Visual elements (e.g., ["outdoor seating", "food plates", "morning light"])
- **copy_angles**: Messaging angles using A1 phrases (e.g., ["Ved åen i Aarhus", "Brunch med udsigt"])
- **safe_claims_only**: ALWAYS true (no unverified claims)
- **evidence_refs**: ≥2 A1 quote references
- **confidence**: Based on evidence strength

Examples:
\`\`\`json
{
  "trigger": "Weekend Brunch Culture",
  "based_on_usage_occasion_ids": ["weekend_brunch_with_kids"],
  "what_to_show": ["brunch plates", "families at tables", "morning coffee"],
  "copy_angles": ["Brunch ved åen", "Weekend morgen i Aarhus"],
  "safe_claims_only": true,
  "evidence_refs": ["menu.quotes[0]", "location.quotes[0]", "images.quotes[1]"],
  "confidence": "high"
}
\`\`\`

---

**5. VOICE CONTEXT**

Classify based on A1 evidence:

**A) location_profile** (from location.city + location.area_type):
- MAJOR_CITY_CENTER: København, Aarhus, Odense centrum
- TRENDY_NEIGHBORHOOD: Vesterbro, Nørrebro, Latinerkvarteret, Trøjborg
- SUBURBAN_RESIDENTIAL: Suburban areas, family neighborhoods
- SMALL_TOWN_RURAL: Towns < 50k population
- TOURIST_AREA: Nyhavn, Skagen, tourist hotspots

**B) business_personality** (from website.ctas, website.hero_texts, social.bios):
- TRADITIONAL_COZY: Classic, warm, traditional vocabulary
- MODERN_CASUAL: Contemporary, relaxed, minimal marketing fluff
- URBAN_TRENDY: Punchy, English-mix okay, Instagram-friendly
- PREMIUM_REFINED: Sophisticated, elevated, formal language
- LOCAL_AUTHENTIC: Community-focused, personal, down-to-earth

**C) language_mix** (from A1 quotes language analysis):
- PURE_DANISH: All quotes in Danish
- DANISH_PRIMARY: 80%+ Danish, some English terms
- BILINGUAL: 50/50 mix
- ENGLISH_PRIMARY: Tourist/international focus

**D) energy_level** (from website.ctas punctuation style):
- HIGH: Exclamation marks, action verbs, urgency
- MEDIUM: Balanced, inviting, conversational
- LOW: Calm, descriptive, understated

**reasoning**: 3-5 short bullets explaining each classification

---

**EVIDENCE_REFS FORMAT:**

Reference A1 quotes using dot notation:
- \`"location.quotes[0]"\` - First location quote
- \`"menu.quotes[2]"\` - Third menu quote
- \`"website.quotes[5]"\` - Sixth website quote
- \`"images.quotes[1]"\` - Second image quote
- \`"social.quotes[0]"\` - First social quote
- \`"location.canonical_location_hook"\` - Direct field reference
- \`"menu.meal_anchors[0]"\` - First meal anchor

**CRITICAL RULES:**
1. All interpretations MUST have evidence_refs (min 2 per item)
2. Do NOT invent facts - only interpret A1 evidence
3. Respect size limits (hooks≤5, rituals≤3, occasions≤4, triggers≤5)
4. If evidence is weak, reduce counts and lower confidence
5. All occasions must be agentless (no personas)
6. All content triggers must have safe_claims_only: true
7. Include reasoning array for voice_context

Return ONLY the JSON object. No commentary, no markdown wrapper, no explanation.`
}
