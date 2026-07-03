/**
 * Danish Core Rules for Brand Profile Generation (Prompt B)
 * 
 * This file contains the main instruction blocks for generating brand profiles.
 * These are language-specific rules that guide the AI's output generation.
 * 
 * MIGRATION: Extracted from hardcoded prompt-b.ts to enable:
 * - Language-specific versions (DA/EN/SV)
 * - Business-type-specific rule injection
 * - Easier maintenance and testing
 * 
 * Date: 2026-05-12
 * Part of: Brand Profile Prompt Refactoring Phase 1
 */

export interface CoreRules {
  locationContext: string
  style: string
  diversityControl: string
  targetAudienceRules: string
  structureRules: string
}

/**
 * Builds location context rules
 * Ensures location information is properly incorporated into outputs
 */
export function buildLocationContextRules(languageName: string): string {
  return `🚨 LOCATION CONTEXT (HIGHEST PRIORITY) 🚨
If the prompt provides location enrichment data with area_type (waterfront, transit_hub, etc.), you MUST include the specific location phrase in:
1. brand_essence.value (start the sentence with it, e.g., "Café ved åen i Aarhus hvor...")
2. image_preferences.signature_shot (include the area phrase, e.g., "ved åen", "ved stationen")
→ Copy the exact phrases from the prompt. Don't paraphrase. Validation checks for these specific words.`
}

/**
 * Builds general style rules
 * Defines the overall tone and approach
 */
export function buildStyleRules(languageName: string): string {
  return `STYLE:
- Write in natural ${languageName}
- Use the business's OWN words from the data provided
- Be specific where evidence exists, neutral where it doesn't
- Sound like a helpful colleague, not a marketing agency`
}

/**
 * Builds diversity control rules
 * Prevents over-representation of single features
 */
export function buildDiversityControlRules(): string {
  return `🔄 DIVERSITETSKONTROL — Feature Distribution (v4.12.1)
Prevents over-representation of single features across multiple output fields.

PRINCIPLE: Physical features (location, outdoor spaces, views) are CONTEXT, not core identity.
Operational and temporal features (programmes, hours, transitions) define the business.

RULES:
1. **Feature Balance Priority**:
   - FIRST: Operational features (programmes, service transitions, menu variety)
   - SECOND: Temporal features (day-to-night shifts, seasonal changes)
   - LAST: Physical features (location, seating, décor)

2. **Keyword Distribution Limit**:
   - If a physical keyword appears in business_character (e.g., 'terrasse', 'åen', 'udsigt')
   - It may appear in MAX 2 additional fields from: brand_essence, tone_of_voice, content_strategy
   - Beyond that limit: Replace with operational/temporal descriptions

3. **Seasonal Context (Denmark)**:
   - Outdoor features (terrasse, vandfront, udsigt) are only relevant May-September
   - Multi-programme venues: Lead with temporal transitions, not physical spaces
   - Test: Would this voice work in January? If no → rebalance toward year-round features

4. **Distinctiveness Hierarchy**:
   - Rare features (multi-programme transitions, late-night service, hybrid roles) → Mention in voice rules
   - Common features (outdoor seating, central location) → Mention once max, subordinate position
   - Validation: Could this feature apply to 50+ other venues in this city? If yes → deprioritize

VALIDATION CHECKPOINT:
Before finalizing, scan all output fields. If the SAME physical feature appears in >2 fields → reduce to max 2 mentions.
Prioritize what makes this business FUNCTION differently, not just where it sits.`
}

/**
 * Builds structure rules for core offerings
 */
export function buildStructureRules(): string {
  return `STRUCTURE (3+2 rule for core_offerings):
- 3 meal anchors (brunch, frokost, middag, etc.)
- 2 experience/service anchors (terrasse, takeaway, etc.)`
}

/**
 * Builds target audience rules
 * Behavior-centric temporal format with persona gating
 */
export function buildTargetAudienceRules(): string {
  return `TARGET AUDIENCE (behavior-centric, TEMPORAL FORMAT):
- Use "Når gæster..." temporal phrasing to describe WHEN and HOW guests use the venue
- Each clause = SITUATION + TIME + CONTEXT (observable behavior only)
- Write 2-4 occasions using this pattern: "Når gæster [behavior + context], når [situation + time], samt når [transition]"
- ALLOWED: Temporal behavioral moments and contextual constraints
  ✅ "Når gæster samles om længere brunch ved bordet"
  ✅ "Når børn kan spise med uden bøvl" (behavioral constraint, NOT persona)
  ✅ "Når man søger hurtig frokost mellem møder" (temporal context)
  ✅ "Når aftenen glider fra middag til cocktails" (temporal flow)
  ✅ "med god tid", "i eget tempo", "før/efter arbejde" (duration/time context)

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
- VALIDATE: No always-banned personas; minimum 2 occasions; maximum 4 occasions`
}

/**
 * Builds multi-signal stacking rules
 * Ensures specificity through signal combination
 */
export function buildMultiSignalStackingRules(): string {
  return `🎯 MULTI-SIGNAL STACKING (CRITICAL FOR SPECIFICITY):
DO NOT write one clause per signal. STACK 2-3 signals in EACH clause for maximum specificity.

❌ WRONG (single-signal clauses — too generic):
"Når gæster tager turen til åen som destination"
"Når børn kan spise med"
"Når der er tid til at blive siddende"
→ Could apply to ANY waterfront family café

✅ RIGHT (multi-signal clauses — specific):
"Når besøgende til [city name from data] tager børnene med til terrassen ved åen i roligt tempo"
→ Stacks 4 signals: tourist_strength + has_kids_menu + location hook + price_register

"Når åbningstiden fra brunch til kl. 02:00 bliver forskellen"
→ Stacks 2 signals: meal_arc (brunch) + late hours (if data shows late closing)

"Når CARPACCIO til frokost og cocktails til natten bor samme sted ved åen"
→ Stacks 4 signals: specific menu item + meal_arc span + bar programme + location

STACKING STRATEGY:
- Combine location + operational + temporal in one clause
- Combine menu specificity + location + visitor type in one clause
- Each clause = mini brand positioning statement (not just one attribute)`
}

/**
 * Main builder function that assembles all core rules
 */
export function buildCoreRulesSection(languageName: string = 'Danish'): string {
  const sections = [
    buildLocationContextRules(languageName),
    buildStyleRules(languageName),
    buildDiversityControlRules(),
    buildStructureRules(),
    buildTargetAudienceRules(),
    buildMultiSignalStackingRules(),
  ]
  
  return sections.join('\n\n')
}
