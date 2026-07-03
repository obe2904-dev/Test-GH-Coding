# Brand Profile Specificity Assessment
**Date**: 28. april 2026  
**Focus**: Generic → Specific Brand Profile Generation  
**Scope**: Analysis only (NO CODE)

---

## Executive Summary

**Current State**: The AI receives rich, specific data (menu items, location phrases, website content) but produces **adequate-but-generic** brand profiles that could apply to multiple similar businesses.

**Root Cause**: Insufficient **signal differentiation** — the AI is pattern-matching to "typical café by water" instead of isolating what makes THIS café unique among waterfront cafés.

**Opportunity**: Your data infrastructure is excellent. The gap is in **prompt-level signal isolation** — teaching the AI to identify and amplify the 2-3 signals that make this business irreplaceable within its category.

---

## The Generic→Specific Gap: Café Faust Analysis

### What's Generic (Current Output)

**Target Audience** (current):
```
"Når gæster samles om brunch, frokost eller middag, når der er tid til at blive siddende, og når stemningen indbyder til mere end blot et måltid."
```

**Why this is generic**:
- Could apply to ANY sit-down restaurant with extended hours
- No mention of waterfront location (despite "ved åen" being key differentiator)
- No reference to tourist/local mix (tourist_strength=secondary confirmed in data)
- "tid til at blive siddende" is vague — doesn't cite the actual behavioral hook from usage occasions

**What would be SPECIFIC**:
```
"Når gæster tager turen til åen som heldagsdestination, når besøgende til Aarhus finder vejen til terrassen, samt når børn kan spise med uden børnemenuen at diktere programmet."
```

**Why this is specific**:
- Cites exact location hook: "til åen" (waterfront confirmed)
- References tourist_strength: "besøgende til Aarhus" (permission granted by category_scores)
- Cites operational signal: has_kids_menu=true BUT with quality spin (not just nuggets)
- Each clause traceable to a data signal

---

### What's Specific (Current Output)

**Brand Essence** (current):
```
"Café, restaurant og bar ved åen i Aarhus — brunch og frokost til aftensmad og drinks, alle ugens dage."
```

**Why this IS specific**:
- ✅ Exact location phrase: "ved åen i Aarhus"
- ✅ Hybrid role explicitly stated: "café, restaurant og bar"
- ✅ Meal arc referenced: "brunch og frokost til aftensmad og drinks"
- ✅ Temporal scope: "alle ugens dage"
- Could NOT apply to a café without waterfront location
- Could NOT apply to single-programme venue

**This field demonstrates what "specific" looks like** — every word is traceable to a confirmed data signal.

---

## Data Richness vs Output Specificity Matrix

### ✅ WELL-LEVERAGED Data Signals

| Signal | Data Source | Current Output Example |
|--------|-------------|------------------------|
| Location phrase | `location_intelligence.area_type='waterfront'` | "ved åen i Aarhus" (used consistently) |
| Hybrid programmes | `menu_signal` (3+ programmes) | "café, restaurant og bar" |
| Specific menu items | `menu_results_v2.ai_summary` | "CARPACCIO" in signature shot |
| Opening hours | `opening_hours` table | "alle ugens dage" |

### ⚠️ UNDER-LEVERAGED Data Signals

| Signal | Data Available | Currently Used? | Opportunity |
|--------|----------------|-----------------|-------------|
| **Tourist context** | `tourist_strength=secondary`<br>`category_scores.tourist=65` | ❌ No | Could add "Når besøgende til Aarhus..." clause in target_audience |
| **Outdoor seating** | `has_outdoor_seating=true`<br>`area_type=waterfront` | ⚠️ Partial | Signature shot mentions "ved åen" but doesn't emphasize terrace as destination |
| **Kids menu** | `has_kids_menu=true`<br>Børnemenu in menu anchors | ❌ No | Could add behavioral constraint: "Når børn kan spise med" (not as persona "familier") |
| **Price register** | `price_register=mid`<br>`~150 DKK average` | ⚠️ Partial | Mentioned in tone signal citations but not in audience framing |
| **Late hours** | Opening to 02:00 on weekends | ❌ No | Could drive "fra morgenkaffe til natøl" hook in brand_essence (which is present!) |
| **City position** | `city_centre` secondary type | ❌ No | Could frame as "i Aarhus midtby ved åen" (double anchor) |

### ❌ MISSING Data (Cannot Improve Without)

| What's Missing | Impact on Specificity |
|----------------|----------------------|
| **Craft provenance signals** | Can't claim "hjemmelavet" or supplier names without menu detail |
| **Interior photos** | Can't populate `recognizable_interior_identity` |
| **Social post history** | Can't extract voice patterns (currently Path B = inferred) |
| **Review snippets** | Can't cite guest language ("gæster kalder det..."") |

---

## The "Proof Too Generic" Problem

### Why Validation Fails

**What the validator checks**:
```typescript
buildAllowedProofTokens() returns [
  "ved åen i Aarhus",
  "CARPACCIO",
  "BOOK DIT BORD",
  "BRUNCH",
  "usage occasion #1",
  "distinctive hook #2",
  ...
]
```

**What the AI currently writes** (hypothetical, based on soft errors):
```json
{
  "target_audience": {
    "value": "Når gæster samles om brunch...",
    "proof": [
      "Field derived from meal arc spanning breakfast through dinner",
      "Location supports extended dwell time",
      "Multi-programme format serves diverse guest needs"
    ]
  }
}
```

**Why this fails validation**:
- ❌ "meal arc" is not in `ALLOWED_PROOF_TOKENS[]`
- ❌ "location" is not in tokens (but "ved åen i Aarhus" IS)
- ❌ "multi-programme format" is reasoning, not citation

**What would PASS validation**:
```json
{
  "target_audience": {
    "value": "Når gæster samles om brunch...",
    "proof": [
      "Usage occasion #1 (brunch-to-work) + #2 (dinner-to-drinks) = time-span occasions",
      "Location hook 'ved åen i Aarhus' creates destination visit motivation",
      "Menu anchors BRUNCH, FROKOST, AFTEN confirm multi-session programmes"
    ]
  }
}
```

**The gap**: AI needs to **quote specific tokens** instead of **paraphrasing signals**.

---

## Specificity Hierarchy: 5 Levels

### Level 1: CATEGORY GENERIC ❌
*Could apply to ANY business in the same category*

Example: "Når gæster søger en god oplevelse med kvalitetsmad"
- No location reference
- No price anchor
- No operational detail
- No differentiator

### Level 2: TYPE-SPECIFIC ⚠️
*Applies to businesses of this type, but not unique to THIS one*

Example: "Når gæster samles om brunch ved åen"
- ✅ Has location type (waterfront)
- ❌ No specific location name
- ❌ No unique operational hook
- Could apply to ANY waterfront brunch café

### Level 3: LOCATION-ANCHORED 🟡
*Tied to specific geography, but not operationally unique*

Example (CURRENT STATE): "Når gæster tager turen til åen som destination"
- ✅ Specific location reference
- ✅ Behavioral framing (destination visit)
- ⚠️ Still missing: what makes THIS waterfront destination different from another?

### Level 4: MULTI-SIGNAL SPECIFIC 🟢
*Combines 2-3 confirmed signals from different dimensions*

Example: "Når besøgende til Aarhus finder terrassen ved åen, når børn kan spise med i roligt tempo"
- ✅ Location: "ved åen"
- ✅ Tourist signal: "besøgende til Aarhus" (tourist_strength=secondary)
- ✅ Operational: has_kids_menu=true
- ✅ Tempo hook: "roligt tempo" (mid price_register)
- Competitors WITHOUT these 3 signals combined cannot use this

### Level 5: IRREFUTABLE UNIQUE 🏆
*Impossible for competitor to claim without lying*

Example: "Når åbningstiden fra brunch til kl. 02 bliver forskellen, når CARPACCIO til frokost og cocktails til natten bor samme sted"
- ✅ Specific hours (opening_hours data)
- ✅ Named dish (menu data: CARPACCIO)
- ✅ Meal arc extremes (brunch → 02:00)
- Zero competitors can claim this exact combination

**Current Output Quality**: Hovering between **Level 2-3** (type-specific to location-anchored)  
**Data Supports**: **Level 4** (multi-signal specific) easily achievable  
**Aspiration**: **Level 4** as baseline, **Level 5** where unique signals exist

---

## Recommendations: Generic → Specific Roadmap

### 🎯 CRITICAL: Signal Isolation Prompt Block

**Problem**: AI receives 50+ signals and pattern-matches to "typical waterfront café"

**Solution**: Add **UNIQUENESS FILTER** block that forces AI to identify the 2-3 signals that differentiate THIS business within its micro-category.

**Prompt Structure** (conceptual — NO CODE):
```
UNIQUENESS FILTER (answer before writing any field):
1. Micro-category: What is the narrowest category this business belongs to?
   (Not "café" — too broad. "Waterfront hybrid café/restaurant with extended hours" — specific)

2. Competitive set: List 3 businesses in Aarhus that could claim similar positioning
   (Forces AI to think about actual competition, not theoretical)

3. Differentiation signals: Which 2-3 data signals does THIS business have that those competitors DON'T?
   Options:
   - Location specificity (ved åen vs ved havnen vs i gågaden)
   - Temporal arc (brunch-only vs brunch-to-late-night)
   - Operational uniqueness (kids menu + cocktails + terrace)
   - Price register WITHIN micro-category (budget waterfront vs premium waterfront)
   - Menu provenance (generic suppliers vs named farms vs hjemmelavet)

4. Proof construction rule: Every field must cite at least ONE differentiation signal
   Generic proofs that ignore the differentiation signals = WRONG
```

**Expected impact**: Forces AI to move from Level 2 → Level 4 specificity

---

### 🎯 HIGH: Behavioral Occasion Expansion

**Problem**: `target_audience` uses vague temporal frames ("når der er tid")

**Current prompt provides**: 4 occasion templates (Duration, Transition, Destination, Constraint)

**Missing**: Explicit instruction to **combine multiple signal types in ONE occasion clause**

**Example of single-signal clause** (current):
```
"Når gæster tager turen til åen som destination"
→ Uses: location signal only
```

**Example of multi-signal clause** (better):
```
"Når besøgende til Aarhus tager børnene med til terrassen ved åen i roligt tempo"
→ Uses: location + tourist_strength + has_kids_menu + price_register (4 signals!)
```

**Recommendation**: Instruct AI to **stack 2-3 confirmed signals per occasion clause** instead of writing separate clauses for each signal.

**Expected impact**: Each occasion becomes more specific, fewer clauses needed

---

### 🎯 MEDIUM: Proof Format Enforcement

**Problem**: AI writes reasoning ("based on X") instead of citations ("X confirms Y")

**Current guidance**: Shows wrong/right examples, lists allowed tokens

**Missing**: **Explicit proof format template** that AI must fill in

**Recommended proof template** (add to PROOF CITATION REQUIREMENTS):
```
MANDATORY PROOF FORMAT:
"[Field name] derived from [Token 1] + [Token 2] + [Signal type]: [How they combine]"

Examples using ACTUAL tokens:
✅ "tone_of_voice: Location hook 'ved åen i Aarhus' + price_register=mid + has_kids_menu=true → casual-inclusive register required"
✅ "target_audience: Usage occasion #1 (brunch-to-work) + tourist_strength=secondary → destination-visit framing"
✅ "brand_essence: CARPACCIO + COCKTAILS + opening to 02:00 → full-day-arc positioning"

FORBIDDEN proof patterns:
❌ "Based on waterfront location..."
❌ "The multi-programme format..."
❌ "Given the casual dining context..."
```

**Expected impact**: Proof bullets pass validation, soft errors reduced 6 → 0-2

---

### 🎯 LOW: Business Character Population

**Problem**: `business_character` is null in test output (should always be populated)

**Likely cause**: Field is optional in some code path, or AI skips it

**Recommendation**: 
1. Make `business_character` explicitly REQUIRED in schema
2. Add validation that fails if this field is null
3. In prompt, mark it as "FIRST FIELD TO WRITE" (before brand_essence)

**Why it matters**: This field is the foundation — if AI writes this correctly, all other fields inherit its specificity

---

### 🎯 LOW: Proof Array Format Clarification

**Observation**: Soft errors mention "proof must have 1-3 bullets" — suggests AI might be writing single string instead of array

**Current schema**: `proof: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 }`

**Hypothesis**: AI writes:
```json
"proof": "Single string explanation here"  // WRONG
```

Instead of:
```json
"proof": [
  "Bullet 1",
  "Bullet 2"
]  // RIGHT
```

**Recommendation**: In prompt PROOF CITATION REQUIREMENTS block, show explicit JSON structure:
```
OUTPUT FORMAT:
{
  "field_name": {
    "value": "...",
    "proof": [
      "First bullet citing Token A + Token B",
      "Second bullet citing Token C + Signal D",
      "Optional third bullet"
    ]
  }
}
```

---

## Testing Strategy: Measuring Specificity Gains

### Baseline Metrics (Café Faust Current)

| Metric | Current Value | Target |
|--------|---------------|--------|
| Soft errors | 6 | 0-2 |
| Specificity level (target_audience) | 2-3 | 4 |
| Proof validation pass rate | ~40% (4 of 10 fields) | 90%+ |
| Generic word count | TBD | <5 per field |
| Signal citation density | Low (2-3 signals per profile) | High (8-12 signals explicitly cited) |

### Test Suite Recommendations

**1. Specificity Ladder Test**  
Generate brand profile for 3 businesses:
- Business A: Minimal data (name, address, category only)
- Business B: Moderate data (menu + location)
- Business C: Rich data (menu + location + website + operations)

Expected: Output specificity should scale with data richness  
Current risk: All three produce similar generic output regardless of data availability

**2. Competitive Distinctiveness Test**  
Find 2 similar businesses in same city (e.g., two waterfront cafés in Aarhus)  
Generate profiles for both  
Compare outputs:
- ❌ FAIL: Profiles are interchangeable (swap business name, still accurate)
- ✅ PASS: Each profile contains 3+ signals the OTHER business cannot claim

**3. Token Citation Audit**  
For each field with proof array, count:
- How many proof bullets cite exact tokens from `ALLOWED_PROOF_TOKENS[]`
- How many use paraphrasing or reasoning instead
- Target: 100% of bullets cite at least one exact token

**4. "Competitor Falsification Test"**  
For each generated profile, ask:
*"Could a similar business 200m away use this same profile without lying?"*

- If YES → output is too generic
- If NO → output is appropriately specific

Apply this test to:
- brand_essence
- target_audience
- tone_of_voice STEMME-IDENTITET rules

---

## Prioritized Improvement Sequence

Based on **Impact × Effort** and **data availability**:

### Phase 1: Quick Wins (1-2 hours implementation)
1. **Make business_character required** (5min)
   - Ensures foundation field is always populated
   - Low effort, high reliability gain

2. **Add proof array format example** (15min)
   - Shows AI explicit JSON structure
   - Likely fixes "must have 1-3 bullets" errors

3. **Expand ALLOWED_PROOF_TOKENS to include signal names** (30min)
   - Currently: only exact phrases ("ved åen i Aarhus")
   - Add: signal type labels ("usage occasion #1", "price_register=mid")
   - AI can cite these in proofs, validator accepts them

### Phase 2: Specificity Core (3-4 hours)
4. **Add UNIQUENESS FILTER prompt block** (2h)
   - Forces micro-category identification
   - Lists 2-3 differentiation signals
   - Every field must cite at least one
   - **Highest impact** on generic→specific gap

5. **Strengthen occasion multi-signal stacking** (1h)
   - Update occasion templates to show 3-signal examples
   - Add instruction: "Combine 2-3 signals per clause"

### Phase 3: Validation Alignment (2-3 hours)
6. **Proof format template enforcement** (2h)
   - Mandatory citation structure
   - More wrong/right examples with actual Café Faust tokens
   - Expected: soft errors 6 → 0-2

### Phase 4: Testing & Iteration (4-6 hours)
7. **Run specificity ladder test** (2h)
8. **Run competitive distinctiveness test** (2h)
9. **Token citation audit** (1h)
10. **Iterate on weakest performers** (1-3h)

**Total estimated time**: 10-15 hours to reach Level 4 specificity baseline

---

## Conclusion

**Current State**: Your system produces **competent but generic** brand profiles. The data infrastructure is excellent — the issue is purely in the prompt engineering layer.

**Root Cause**: AI is pattern-matching to "typical [category]" instead of isolating the 2-3 signals that make THIS business irreplaceable within its micro-category.

**Opportunity**: With the rich data you're already collecting, you can reach **Level 4 specificity** (multi-signal specific) as a baseline. This would mean:
- ✅ Every profile field cites 2-3 confirmed data signals
- ✅ Competitors without those exact signals cannot claim the same positioning
- ✅ Proof validation passes because AI quotes exact tokens
- ✅ Business owners recognize their business in the output (not a generic template)

**Key Insight**: Moving from generic → specific is NOT about collecting more data. It's about teaching the AI to **isolate what's unique** from the data you already have.

The UNIQUENESS FILTER concept is the highest-leverage intervention — forces AI to think "What can THIS business claim that competitors in the same micro-category cannot?" before writing any field.

---

## Next Steps (if proceeding with implementation)

1. **Validate hypothesis**: Check if `business_character` null issue is schema-level or prompt-level
2. **Implement Phase 1** (quick wins): business_character required + proof array format
3. **Test with Café Faust**: Regenerate, measure soft error reduction
4. **Design UNIQUENESS FILTER block**: This is the core intervention
5. **A/B test**: Current prompt vs +UNIQUENESS FILTER on 5 businesses
6. **Measure specificity gain**: Use competitive distinctiveness test

**Expected outcome**: 
- Soft errors: 6 → 0-2
- Specificity level: 2-3 → 4
- Business owner satisfaction: "This is actually us" instead of "This could be anyone"
