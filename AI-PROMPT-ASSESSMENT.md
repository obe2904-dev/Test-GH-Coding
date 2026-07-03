# AI Prompt Assessment - Brand Profile Generator
**Date**: 28. april 2026  
**Focus**: Translation layer from data → brand profile output  
**Status**: Data flow ✅ SOLID | Prompt quality 🟡 NEEDS OPTIMIZATION

---

## Executive Summary

**The Good News**: Your data flow is perfect. All three sources (menu, location, website) successfully reach the AI prompts.

**The Challenge**: The AI prompt translation layer is creating **generic output despite having specific data**. The soft errors you're seeing are symptoms of a deeper issue: **the AI is being given excellent raw material but isn't being prompted strongly enough to USE IT SPECIFICALLY**.

---

## Current Architecture Overview

### Two-Phase Prompt System

**Prompt A (Analysis/Extraction)** → Compact signal extractor
- **Input**: Raw data (menu, location, website)
- **Output**: Structured JSON with hooks, occasions, tone markers
- **Goal**: Extract high-signal steering data for Prompt B

**Prompt B (Generation)** → Brand profile writer  
- **Input**: Prompt A analysis + raw data references
- **Output**: Final brand profile (brand essence, tone, audience, etc.)
- **Goal**: Translate signals into natural, usable content

### Data Flow Evidence (Café Faust Example)

**✅ Menu Data Reaching AI**:
- Source: `menu_results_v2.ai_summary`
- Evidence: "CARPACCIO" appears in signature shot
- Anchors: BRUNCH, FROKOST, AFTEN, COCKTAILS

**✅ Location Data Reaching AI**:
- Source: `business_location_intelligence`
- Evidence: "ved åen i Aarhus" appears 4+ times
- Type: waterfront (primary)

**✅ Website Data Reaching AI**:
- Source: `website_analyses`
- Evidence: Tone model source = "website"
- Confidence: low (limited content)

**Verdict**: Data → Prompt connection is **SOLID**.

---

## Problem Analysis: Why "Proof Too Generic" Errors?

### Soft Error Examples (Café Faust Output)

```
⚠️ "Field 'tone_of_voice' proof does not reference Prompt A hooks/phrases (too generic)"
⚠️ "Field 'target_audience' proof does not reference Prompt A hooks/phrases (too generic)"  
⚠️ "Field 'communication_goal' proof does not reference Prompt A hooks/phrases (too generic)"
⚠️ "brand_essence must include an offering cue (e.g., brunch/frokost/aften)"
```

### Root Cause: Proof Token Validation Gap

**What's Happening**:
1. **Prompt B** provides AI with `ALLOWED_PROOF_TOKENS[]` containing specific menu items, location phrases, CTA texts
2. AI generates brand profile fields with `value` and `proof[]` bullets
3. **Validator** checks if `proof[]` references any `ALLOWED_PROOF_TOKENS`
4. **Failure**: AI writes proof bullets that explain reasoning but don't quote the exact tokens

**Example of Generic Proof** (what AI currently does):
```json
{
  "tone_of_voice": {
    "value": "Skriv direkte og jordnært...",
    "proof": [
      "Based on waterfront location requiring casual approach",
      "Price register suggests informal tone",
      "Multi-programme venue needs flexible voice"
    ]
  }
}
```

**What Validator Wants** (specific token references):
```json
{
  "tone_of_voice": {
    "value": "Skriv direkte og jordnært...",
    "proof": [
      "Location hook 'ved åen i Aarhus' drives outdoor/casual positioning",
      "Menu anchors BRUNCH, COCKTAILS, BØRNEMENU span formal registers",
      "CTA 'Book dit bord' requires direct imperative style"
    ]
  }
}
```

**The Gap**: AI is reasoning correctly but not **citing its sources with exact phrases from the data**.

---

## Detailed Prompt Analysis

### Prompt A (Signal Extraction) - 8/10 Quality

**Strengths**:
✅ Clear size limits (max 4 hooks, max 8 tone markers)  
✅ Hard constraints on banned personas  
✅ Multi-tier evidence system (internal > website > third-party)  
✅ Requires evidence quotes with every extraction  
✅ Voice context signals (kids_menu, price_register) are deterministic

**Weaknesses**:
⚠️ **Location phrase extraction**: Instructions say "use deterministic location phrase" but don't show HOW to embed it in hooks
⚠️ **Tone markers too abstract**: Asks for "technical observations" but examples are still somewhat vague:
   - GOOD: "Sætninger er under 10 ord i gennemsnit"
   - STILL VAGUE: "Åbninger: Sætninger starter med stedsnavn"
⚠️ **Menu signal loss**: Menu AI summaries are rich (CARPACCIO, specific dishes) but Prompt A only extracts category-level anchors

**Impact on Output**:
- Prompt A returns useful signals, but they're **one level too abstract**
- Example: Returns "waterfront" but not "ved åen i Aarhus" as a must-use phrase
- Menu returns "BRUNCH, FROKOST" but not "CARPACCIO, EGGS BENEDICT" as specific proof tokens

---

### Prompt B (Brand Profile Generation) - 7/10 Quality

**Strengths**:
✅ Excellent behavioral framing ("Når gæster..." temporal format)  
✅ Strong banned words enforcement  
✅ Clear field-by-field contracts in schema descriptions  
✅ Proof requirement is explicit: "1-3 bullets proving which Prompt A hooks/phrases were used"  
✅ Multi-signal content strategy logic (maturity × distinctiveness)

**Critical Weaknesses**:

#### 1. **ALLOWED_PROOF_TOKENS Disconnect** (HIGHEST PRIORITY)
```typescript
const ALLOWED_PROOF_TOKENS = [
  canonicalLocationHook,     // "ved åen i Aarhus"
  primaryCta,                 // "BOOK DIT BORD"
  ...uniqueMenuTokens,        // ["BRUNCH", "FROKOST", "CARPACCIO"]
  locationPhrase || 'ved åen',
  cityName,
  ...
]
```

**Problem**: These tokens are **built but not explicitly shown to the AI in the prompt text**.

**Current Prompt B approach**:
- Lists menu anchors as uppercase: `BRUNCH, FROKOST, AFTEN, COCKTAILS`
- Mentions location phrase: "ved åen i Aarhus"
- BUT: Doesn't tell AI "YOU MUST CITE THESE EXACT PHRASES IN YOUR PROOF BULLETS"

**Fix needed**: Add explicit instruction block:
```
PROOF REQUIREMENTS (CRITICAL):
Your proof[] arrays MUST quote at least one of these EXACT tokens per field:
- Location: "ved åen i Aarhus", "ved åen", "Aarhus"
- Menu: BRUNCH, FROKOST, AFTEN, COCKTAILS, CARPACCIO, [dish names]
- CTA: "BOOK DIT BORD"
- Hooks: [list from Prompt A]

WRONG proof: "Based on waterfront location" (too generic)
RIGHT proof: "Location hook 'ved åen i Aarhus' drives outdoor positioning"
```

#### 2. **Brand Essence Behavioral Hook Vagueness**
Current instruction:
> "Include EXACTLY ONE non-menu behavioral hook: flow/duration/transition/tempo"  
> "Hook examples: 'roligt tempo', 'glide naturligt over i aftenen', 'lange ophold'"

**Problem**: Too many acceptable alternatives without clear selection criteria.

**Actual output** (Café Faust):
> "Café, restaurant og bar ved åen i Aarhus — brunch og frokost til aftensmad og drinks, alle ugens dage"

**Analysis**: 
- ✅ Location included ("ved åen i Aarhus")
- ✅ Offerings included (brunch, frokost, aftensmad, drinks)
- ❌ Behavioral hook is weak: "alle ugens dage" = operational fact, not behavioral moment

**Better behavioral hooks from available data**:
- "fra morgenkaffe til natøl" (temporal arc)
- "hvor man bliver siddende længe" (duration — already used in signature shot!)
- "når dagen glider over i aften" (transition)

**Fix needed**: Give AI **selection priority**:
1. Duration/tempo hooks (IF opening hours span >10h)
2. Transition hooks (IF multi-programme: breakfast→dinner→bar)
3. Flow hooks (IF location supports lingering: waterfront, park-adjacent)

#### 3. **Target Audience - Temporal vs Persona Confusion**
Excellent framing: "Når gæster..." format enforced.

**But**: Multi-audience logic is buried in system prompt, not in data presentation.

Current data block shows:
```
CONCURRENT VISITOR AUDIENCE category_scores:
- waterfront: 100
- city_centre: 65  
- tourist: 60
```

**AI receives scores but unclear mapping**:
- What score threshold = one "Når..." clause?
- How many occasions should be written?
- Which scores unlock which behavioral frames?

**Actual output** (Café Faust):
> "Når gæster samles om brunch, frokost eller middag, når der er tid til at blive siddende, og når stemningen indbyder til mere end blot et måltid."

**Analysis**:
- ✅ Temporal framing used
- ✅ 3 occasions (good count)
- ⚠️ Generic: "samles om brunch" = happens at ANY brunch café
- ❌ Doesn't use waterfront advantage: "når man vil sidde ved åen"

**Fix needed**: Provide **occasion scaffolds** in prompt:
```
OCCASION GENERATION LOGIC:
For each category_score ≥ 40, generate ONE "Når..." clause:
- waterfront (100): "Når gæster vil sidde ved åen"
- city_centre (65): "Når bylivet lokker til længere ophold"
- tourist (60): "Når besøgende i Aarhus søger en oplevelse ved vandet"

Combine with meal arc (brunch→frokost→middag) to create specific occasions.
```

#### 4. **Tone Model - Style vs Content Separation Violation**
Schema says:
> "writing_rules: FORBIDDEN: dish names, location markers, specific menu items"

**Problem**: This creates a contradiction.

**Why it fails**: 
- Location IS part of brand identity
- Menu style (brunch vs fine dining) DOES affect writing style
- Removing all content references makes tone rules **too generic to be actionable**

**Example of over-generic rule** (what AI might produce):
> "Brug korte sætninger"

**vs. Content-anchored but still portable** (what works):
> "Start sætninger med konkrete tidspunkter eller steder — ikke med følelser eller vurderinger"

**This IS style-focused** but uses content awareness.

**Fix needed**: Allow **category-level content references**, ban only **specific items**:
- ✅ ALLOWED: "Åbn med dagens måltid (brunch/frokost/middag)"
- ❌ BANNED: "Nævn altid carpaccio"
- ✅ ALLOWED: "Reference lokation som aktør i scenen"
- ❌ BANNED: "Skriv 'ved åen' i hver caption"

---

### Proof Token System - 6/10 Quality

**File**: `proof-tokens.ts`

**Strengths**:
✅ Comprehensive token extraction (CTAs, hooks, menu items, location phrases)  
✅ Normalized comparison (lowercase, whitespace handling)  
✅ Hook labels AND evidence quotes included  
✅ Usage occasion IDs tracked

**Weaknesses**:

⚠️ **Menu token gap**: Only top 6 menu items included as proof tokens, but Café Faust has 5 menu periods with different dishes per period
- Result: AI can't cite "CARPACCIO" in proof even though it appears in AI summary
- Fix: Include ALL `aiSummaryItems` as proof tokens (currently limited to 15, should be unlimited)

⚠️ **Location phrase hierarchy unclear**:
```typescript
const locationPhraseProof = areaType === 'waterfront' ? 'ved åen'
  : areaType === 'transit_hub' ? 'ved stationen'
  : ''
```
- Returns ONLY the generic phrase ("ved åen")
- Doesn't include the full canonical hook ("ved åen i Aarhus")
- AI proof validation fails because proof says "ved åen" but validator expects "ved åen i Aarhus"

**Fix**: Include BOTH generic and specific:
```typescript
const proofTokens = [
  canonicalLocationHook,        // "ved åen i Aarhus"  
  locationPhraseProof,           // "ved åen"
  `${locationPhraseProof} i ${cityProof}`,  // redundancy is OK for validation
]
```

---

## Recommendations (Priority Order)

### 🔴 CRITICAL - Fix Immediately

#### 1. **Explicit Proof Token Block in Prompt B**
**File**: `prompts/prompt-b.ts`  
**Location**: After data sections, before TASK block

**Add**:
```
═══════════════════════════════════════════════════════════════
🎯 PROOF CITATION REQUIREMENTS (MANDATORY)
═══════════════════════════════════════════════════════════════

EVERY field with a proof[] array MUST cite at least ONE of these EXACT tokens:

📍 LOCATION TOKENS (use in brand_essence, tone_of_voice, target_audience):
${canonicalLocationHook ? `- "${canonicalLocationHook}"` : ''}
${locationPhrase ? `- "${locationPhrase}"` : ''}
- "${cityName}"

🍽️ MENU TOKENS (use in core_offerings, content_focus, brand_essence):
${uniqueMenuTokens.slice(0, 20).map(t => `- ${t}`).join('\n')}

📢 CTA TOKENS (use in cta_style):
${allCtaTexts.slice(0, 5).map(t => `- "${t}"`).join('\n')}

🎣 DISTINCTIVE HOOKS (use in any field):
${(analysis?.distinctive_hooks || []).slice(0, 5).map((h: any, i: number) => 
  `- Hook ${i+1}: "${h.hook}" — ${h.evidence}`
).join('\n')}

VALIDATION RULE:
Each proof[] bullet must contain at least ONE token from above.

WRONG:  "Based on waterfront location" (generic reasoning)
RIGHT:  "Location hook 'ved åen i Aarhus' drives outdoor positioning" (quotes token)

WRONG:  "Menu spans multiple meal periods" (generic)
RIGHT:  "Menu anchors BRUNCH, FROKOST, AFTEN create day-to-night arc" (quotes tokens)
═══════════════════════════════════════════════════════════════
```

**Impact**: This single change will likely fix 70%+ of "proof too generic" errors.

---

#### 2. **Brand Essence Behavioral Hook Selection Logic**
**File**: `prompts/prompt-b.ts`  
**Location**: In brand_essence field description in schema

**Change FROM**:
> "Include EXACTLY ONE non-menu behavioral hook: flow/duration/transition/tempo  
> Hook examples: 'roligt tempo', 'glide naturligt over i aftenen', 'lange ophold'"

**Change TO**:
```
Include EXACTLY ONE behavioral hook using this selection priority:

1. DURATION/TEMPO (if opening hours >10h OR late closing >22:00):
   - "fra morgenkaffe til natøl"
   - "hvor man bliver siddende længe"
   - "i roligt tempo"

2. TRANSITION (if ≥3 meal programmes: brunch+frokost+middag+bar):
   - "når dagen glider over i aften"
   - "fra dag til nat"
   - "hvor morgenmad bliver til aftensmad"

3. FLOW (if waterfront/park_adjacent/outdoor_seating):
   - "ved vandkanten"
   - "hvor tiden går sin egen vej"
   - "med god tid"

SELECT THE HIGHEST PRIORITY that matches available signals.
```

**Impact**: Creates more specific, data-driven behavioral hooks.

---

### 🟡 HIGH PRIORITY - Fix This Week

#### 3. **Expand Proof Token Coverage**
**File**: `proof-tokens.ts` → `buildAllowedProofTokens()`

**Changes**:
```typescript
// BEFORE: Limited to 15 summary items
const summaryTokens = (aiSummaryItems || []).slice(0, 15)

// AFTER: Include ALL summary items (they're already curated)
const summaryTokens = (aiSummaryItems || [])

// BEFORE: Only top 6 menu items
const dishNames = (menu || []).slice(0, 10).map((item: any) => item.name)

// AFTER: Include dishes from ALL menu periods (up to 30 total)
const dishNamesByPeriod = (menuSummaries || []).flatMap((period: any) => 
  period.items?.slice(0, 5).map((item: any) => item.name) || []
)
const dishNames = [
  ...(menu || []).slice(0, 10).map((item: any) => item.name),
  ...dishNamesByPeriod
].filter(Boolean)

// ADD: Full canonical location hook with city
const locationVariants = [
  canonicalLocationHook,                          // "ved åen i Aarhus"
  locationPhraseProof,                            // "ved åen"
  `${locationPhraseProof} i ${cityProof}`,       // "ved åen i Aarhus" (duplicate OK)
  cityProof,                                       // "Aarhus"
].filter(Boolean)
```

**Impact**: AI can cite "CARPACCIO" and other specific dishes in proof bullets.

---

#### 4. **Target Audience Occasion Scaffolds**
**File**: `prompts/prompt-b.ts`  
**Location**: Before target_audience schema field

**Add data block**:
```typescript
// Build occasion scaffolds from category scores
const occasionScaffolds: string[] = []
sortedCategories.filter(([, score]) => score >= 40).forEach(([category, score]) => {
  const scaffolds: Record<string, string> = {
    waterfront: `Når gæster vil sidde ${locationPhrase || 'ved vandet'}`,
    city_centre: 'Når bylivet lokker til længere ophold',
    tourist: `Når besøgende i ${cityName} søger en oplevelse ${locationPhrase ? locationPhrase : ''}`,
    residential: 'Når man søger sit lokale arnested',
    shopping_street: 'Når handleturen glider over i en pause',
    office_area: 'Når frokostmødet skal holdes udenfor kontoret',
  }
  if (scaffolds[category]) {
    occasionScaffolds.push(`[${category}, score ${score}]: ${scaffolds[category]}`)
  }
})

const occasionGuidance = occasionScaffolds.length > 0 
  ? `
OCCASION SCAFFOLDS (use these as starting points):
${occasionScaffolds.join('\n')}

Combine with meal arc (${menuSummaries.map(m => m.title).join(' → ')}) to create specific occasions.
Example: "Når gæster vil sidde ved åen → specify meal → om brunch"
`
  : ''
```

**In prompt**: Insert `${occasionGuidance}` before target_audience instructions.

**Impact**: AI writes occasions anchored to actual location + menu data.

---

### 🟢 MEDIUM PRIORITY - Nice to Have

#### 5. **Prompt A: Require Location Phrase in must_use_phrases**
**File**: `prompts/prompt-a.ts`  
**Location**: In must_use_phrases section of output schema

**Add validation**:
```
must_use_phrases: {
  brand_essence: [string],  // max 3
  cta: [string]             // max 3
}

CRITICAL: If canonical_location_phrase exists ("${locationPhrase || ''}"), 
you MUST include it in must_use_phrases.brand_essence[0].

Example:
canonical_location_phrase = "ved åen i Aarhus"
→ must_use_phrases.brand_essence = ["ved åen i Aarhus", "brunch", "cocktails"]
```

**Impact**: Forces Prompt A to surface the location phrase to Prompt B.

---

#### 6. **Tone Model: Allow Category-Level Content References**
**File**: `prompts/brand-profile-schema.ts`  
**Location**: tone_model.writing_rules description

**Change FROM**:
> "FORBIDDEN: dish names, location markers, specific menu items"

**Change TO**:
> "STYLE FOCUS: Rules must describe HOW to write, not WHAT to write about.  
> ALLOWED: Category-level references (brunch/frokost/middag, waterfront/city, casual/premium)  
> FORBIDDEN: Specific items (carpaccio, tapas, champagne), specific locations (Aarhus Å 5)"

**Impact**: Rules become more actionable while staying portable.

---

## Testing Plan

### Before/After Comparison

**Test Subject**: Café Faust (2037d63c-a138-4247-89c5-5b6b8cef9f3f)

**Metrics to Track**:
1. Proof validation error count (currently 3 soft errors)
2. Location phrase inclusion rate (brand_essence, target_audience, signature_shot)
3. Specific menu item citations (CARPACCIO, dish names in proof bullets)
4. Behavioral hook specificity (scale 1-5, human judgment)

**Success Criteria**:
- ✅ Zero "proof too generic" errors
- ✅ Location phrase appears in ALL required fields
- ✅ At least 2 specific menu items cited in proof bullets
- ✅ Behavioral hook rated 4+ on specificity scale

---

## Summary of Key Issues

| Issue | Severity | Fix Effort | Impact |
|-------|----------|------------|--------|
| Proof tokens not shown to AI | 🔴 Critical | Low (add text block) | High (fixes 70% of errors) |
| Behavioral hook selection vague | 🔴 Critical | Low (add priority logic) | High (improves essence quality) |
| Menu token coverage gap | 🟡 High | Medium (expand extraction) | Medium (enables dish citations) |
| Occasion scaffolds missing | 🟡 High | Medium (generate from scores) | Medium (improves audience) |
| Location phrase not required in Prompt A | 🟢 Medium | Low (add validation) | Medium (ensures consistency) |
| Tone rules too content-restricted | 🟢 Medium | Low (relax prohibition) | Low (improves actionability) |

---

## Conclusion

**Your data infrastructure is excellent.** The problem is NOT the data — it's that the AI isn't being explicitly told to **quote its sources** with the specific phrases you want to validate.

**The core fix is simple**: Add an explicit `PROOF CITATION REQUIREMENTS` block to Prompt B that lists all allowed tokens and shows examples of correct vs incorrect proof formatting.

**Secondary fixes** improve specificity: better behavioral hook selection, expanded menu tokens, occasion scaffolds.

**Estimated time to implement critical fixes**: 2-3 hours  
**Estimated improvement**: 70-80% reduction in soft errors + significantly more specific output

Would you like me to proceed with implementing these changes?
