# Brand Profile Quality Improvement Plan
## From "Well" to "Great" - Café Faust Case Study

**Date**: April 28, 2026  
**Test Subject**: Café Faust (cafefaust.dk)  
**Current Status**: ✅ Data flow working, output coherent but generic  
**Goal**: Increase specificity, reduce generic proofs, calibrate confidence

---

## Phase 1: Define "Great" ⭐

### Success Criteria

**User Outcome** (Restaurant Owner Experience):
- ✅ Can generate 10 on-brand posts/week without manual edits
- ✅ Voice examples specific enough to guide AI in edge cases (e.g., "How to announce kitchen closed for holiday?")
- ✅ Content pillars prevent off-brand suggestions (no "motivational Monday" for upscale restaurant)

**AI Outcome** (Content Generation Quality):
- ✅ Captions reference specific dishes: "Pariserbøf" not "klassiske retter"
- ✅ Location hooks integrated: "ved åen" appears naturally in 70%+ of suggestions
- ✅ Tone consistency: AI never generates "✨ Kom og oplev ✨" for a minimalist voice

**Quality Metrics**:
- ✅ Zero "generic proof" soft errors
- ✅ Confidence score ≤ 75% when menu_source = 'none', ≥ 85% when all data present
- ✅ Every proof references at least 1 specific data point (dish name, location hook, or menu category)

---

## Phase 2: High-Impact Fields Analysis

### Critical Fields (Drive 80% of Value)

#### 1. `tone_of_voice` - **HIGHEST IMPACT**

**Why Critical**:
- Used in EVERY text generation request (captions, headlines, menu descriptions)
- Direct training for AI voice cloning
- Determines feel: "Kom forbi" vs. "Besøg os i dag"

**Current Café Faust Output**:
```
- STEMME-MEKANIK:
- Skriv én tanke pr. sætning — stop før du forklarer
- Tal til én, ikke mange — brug 'du'
- STEMME-IDENTITET:
- Inddrag åen som aktør i situationen, ikke som baggrund (signal: location)
- Tonen skal være direkte og præcis uden fyldord (signal: price_register)
Eksempel: "Vi er klar."
Eksempel: "Kom forbi."
Eksempel: "Det tager ti minutter."
Eksempel: "Vi ses snart."
```

**Quality Assessment**:
- ✅ **Good**: Specific mechanics ("Skriv én tanke pr. sætning")
- ✅ **Good**: Location signal explicitly named ("Inddrag åen som aktør")
- ⚠️ **Generic**: Examples are universal ("Vi er klar" could be any business)
- ❌ **Missing**: No dish-specific examples ("Pariserbøf er klar kl. 12")
- ❌ **Missing**: No time-of-day variation (brunch vs. dinner voice?)

**Improvement Target**:
```
- STEMME-MEKANIK:
- Skriv én tanke pr. sætning — stop før du forklarer
- Tal til én, ikke mange — brug 'du'
- Navngiv retter direkte: "Pariserbøf" ikke "en klassiker"

- STEMME-IDENTITET:
- Inddrag åen som aktør i situationen, ikke som baggrund
- Tonen skal være direkte og præcis uden fyldord
- Brunch-stemme: afslappet, langsomt ("Tag den med ro")
- Aften-stemme: præcis, energisk ("Det går stærkt nu")

Eksempel (brunch): "Pariserbøf ved åen. Klokken er 11."
Eksempel (frokost): "Kalvecoulotte til to. Bordet venter."
Eksempel (aften): "Cocktails ved vandet kl. 22."
Eksempel (generel): "Vi ses snart."
```

**Impact**: 🔥🔥🔥 **CRITICAL** - Affects every generated text

---

#### 2. `voice_examples` (do_say / dont_say) - **HIGH IMPACT**

**Why Critical**:
- Negative examples prevent AI mistakes ("Don't say 'Oplev den autentiske stemning'")
- Positive examples are proof tokens for content generation

**Current Café Faust Output**:
```json
{
  "do_say": [
    "udeservering",
    "café-kultur",
    "aftenliv",
    "turistattraktion",
    "sociale sammenkomster"
  ],
  "dont_say": [
    "Oplev den autentiske stemning",
    "Nyd den lækre mad",
    "Velkommen til en unik oplevelse"
  ]
}
```

**Quality Assessment**:
- ✅ **Good**: `dont_say` examples are specific clichés to avoid
- ⚠️ **Generic**: `do_say` examples are LOCATION MARKETING HOOKS not voice examples
- ❌ **Missing**: No dish names in `do_say` (should have "Pariserbøf", "CARPACCIO")
- ❌ **Missing**: No service period words ("brunch", "frokost", "cocktails")

**Root Cause**: AI is confusing "marketing hooks" (from location intelligence) with "voice vocabulary"

**Improvement Target**:
```json
{
  "do_say": [
    "Pariserbøf",
    "ved åen",
    "brunch",
    "cocktails",
    "klokken 12",
    "åbent til 02",
    "Børnemenu"
  ],
  "dont_say": [
    "Oplev den autentiske stemning",
    "Nyd den lækre mad",
    "Velkommen til en unik oplevelse",
    "hyggelig atmosfære",
    "fantastisk udsigt"
  ]
}
```

**Impact**: 🔥🔥 **HIGH** - Used as proof tokens in content generation

---

#### 3. `content_pillars` - **HIGH IMPACT**

**Why Critical**:
- Determines what types of content to suggest (food photos vs. behind-the-scenes)
- Each pillar has `encouraged` flag that drives suggestion frequency

**Current Café Faust Output**:
```json
[
  {
    "pillar": "Crave-worthy",
    "allowed": true,
    "encouraged": true,
    "notes": "Mad og drikkevarer er kernen i Cafe Fausts tilbud — visuelle retter giver direkte lyst til at bestille og besøge. (#1)"
  },
  {
    "pillar": "BTS",
    "allowed": true,
    "encouraged": true,
    "notes": "Produktionsprocesser og håndværk på køkkenet er relevante: vis forberedelserne frem for kun det færdige resultat. (#1)"
  },
  {
    "pillar": "Social proof",
    "allowed": true,
    "encouraged": true,
    "notes": "ved åen i Aarhus i Aarhus er et destinationsvalg — gæstebilleder og taggede besøg forstærker at stedet er værd at tage turen til. (#1)"
  },
  {
    "pillar": "Vibe",
    "allowed": true,
    "encouraged": true,
    "notes": "Cafe Faust ligger direkte ved åen i Aarhus — atmosfærebilleder af lyset og livet ved terrassen er oplagt primært indhold. (#1)"
  }
]
```

**Quality Assessment**:
- ✅ **Good**: 4 pillars encouraged (appropriate for hybrid café/restaurant/bar)
- ✅ **Good**: Notes reference specific assets ("terrassen", "håndværk på køkkenet")
- ⚠️ **Typo**: "ved åen i Aarhus i Aarhus" (double "i Aarhus")
- ❌ **Missing**: No time-of-day guidance (Crave-worthy: brunch 09-12, dinner 18-22?)

**Improvement Target**:
```json
{
  "pillar": "Crave-worthy",
  "allowed": true,
  "encouraged": true,
  "notes": "Mad og drikkevarer er kernen — Pariserbøf (frokost), CARPACCIO (aften), cocktails (21-02). Vis retter ved åen i naturligt lys.",
  "timing_hints": ["brunch: 09-14", "frokost: 11-17", "aften: 18-23"]
}
```

**Impact**: 🔥🔥 **HIGH** - Drives daily suggestion types

---

#### 4. `brand_essence` - **MEDIUM-HIGH IMPACT**

**Why Critical**:
- Anchors positioning in every caption
- Shown to user as tagline in dashboard
- Used as context in all AI generations

**Current Café Faust Output**:
```
"Café, restaurant og bar ved åen i Aarhus — brunch og frokost til aftensmad og drinks, alle ugens dage."
```

**Quality Assessment**:
- ✅ **Excellent**: Hybrid model clearly stated
- ✅ **Excellent**: Location hook integrated naturally
- ✅ **Excellent**: Service breadth clear (brunch → drinks)
- ✅ **Excellent**: Temporal scope (alle ugens dage)
- ⚠️ **Soft Error**: Missing offering cue (flagged in errors)

**Current Soft Error**:
```
"brand_essence must include an offering cue (e.g., brunch/frokost/aften, cocktails, coffee)"
```

**Analysis**: This is a FALSE POSITIVE! The essence DOES include offering cues: "brunch og frokost til aftensmad og drinks"

**Fix Required**: Update validation regex in brand-profile-generator to recognize compound offering phrases

**Impact**: 🔥 **MEDIUM** - Already excellent, just needs validation fix

---

#### 5. `business_character` (Prompt A Output) - **MEDIUM IMPACT**

**Why Critical**:
- Seeds Prompt B (main generation)
- Internal analysis that shapes all downstream outputs
- NOT shown to user but drives everything

**Current Café Faust Output**: (Need to query database)

**Action Required**: 
```sql
SELECT business_character 
FROM business_brand_profile 
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
```

**Impact**: 🔥 **MEDIUM** - Internal but foundational

---

## Phase 3: Systematic Review by Field Type

### A. Voice Fields (Directly Used in Text Generation)

| Field | Current Quality | Improvement Priority | Impact |
|-------|----------------|---------------------|---------|
| `tone_of_voice` | Generic examples | 🔥🔥🔥 CRITICAL | Affects every text |
| `voice_examples.do_say` | Location hooks not voice | 🔥🔥 HIGH | Proof tokens |
| `voice_examples.dont_say` | Good | ✅ OK | Prevents mistakes |
| `tone_model` | Good mechanics | 🔥 MEDIUM | AI voice cloning |
| `voice_constraints` | Good | ✅ OK | Guardrails |

**Recommended Action**: Fix `tone_of_voice` examples and `do_say` vocabulary first

---

### B. Content Strategy Fields (Drive Suggestions)

| Field | Current Quality | Improvement Priority | Impact |
|-------|----------------|---------------------|---------|
| `content_pillars` | Good, minor typo | 🔥 MEDIUM | Daily suggestions |
| `content_focus` | Good | ✅ OK | Topic distribution |
| `content_strategy.primary_goal` | Good (drive_footfall) | ✅ OK | Strategy alignment |
| `content_strategy.content_category_weights` | Good distribution | ✅ OK | Post type mix |

**Recommended Action**: Fix "i Aarhus i Aarhus" typo, add timing hints

---

### C. Audience & Positioning Fields (Context)

| Field | Current Quality | Improvement Priority | Impact |
|-------|----------------|---------------------|---------|
| `brand_essence` | Excellent (false error) | 🔧 FIX VALIDATION | User tagline |
| `target_audience` | Generic proof | 🔥 MEDIUM | Audience targeting |
| `core_offerings` | Generic categories | 🔥 LOW | Menu coverage |
| `communication_goal` | N/A output | 🔧 INVESTIGATE | Purpose clarity |

**Recommended Action**: Fix brand_essence validation, review target_audience proof

---

### D. Metadata & Quality Control Fields

| Field | Current Quality | Improvement Priority | Impact |
|-------|----------------|---------------------|---------|
| `quality_status` | yellow (expected) | ✅ OK | Quality gate |
| `voice_rationale` | Claims zero data? | 🔥 HIGH | Transparency |
| `analysisEvidence` | Differentiation focus | ✅ OK | Debugging |
| Proofs (all fields) | "too generic" errors | 🔥🔥 HIGH | Trust & transparency |

**Recommended Action**: Fix proof specificity across all fields

---

## Phase 4: Root Cause Analysis

### Issue 1: Generic Proofs (Highest Priority)

**Symptoms**:
- ✅ `tone_of_voice` proof: "too generic"
- ✅ `target_audience` proof: "too generic"  
- ✅ `communication_goal` proof: "too generic"

**Example Generic Proof**:
```
"Café Fausts beliggenhed ved åen gør det til et naturligt valg for gæster..."
```

**Root Cause**: Prompt B doesn't have access to SPECIFIC dish names or menu items for proof construction

**Evidence**: 
- `menuSummaries` exists (ai_summary from menu_results_v2)
- But Prompt B may only get CATEGORIES not ITEMS
- AI has to invent generic examples instead of citing real dishes

**Fix Strategy**:
1. ✅ Verify `buildPromptB()` includes `aiSummaryItems` (proof tokens)
2. ✅ Update proof instructions: "Reference specific dishes (e.g., Pariserbøf) or menu categories (e.g., COCKTAILS)"
3. ✅ Add proof validation: Reject if proof doesn't contain at least 1 capitalized word (dish name or menu signal)

**Expected Improvement**:
```
❌ Before: "Café Fausts beliggenhed ved åen gør det til et naturligt valg for gæster..."
✅ After: "Pariserbøf og Kalvecoulotte på frokostkortet signalerer klassisk dansk køkken, mens COCKTAILS om aftenen tiltrækker et bredere publikum..."
```

---

### Issue 2: Voice Rationale Claims Zero Data

**Symptom**:
```
"Der er ingen direkte tekst fra sociale medier, men strukturelle signaler 
som menu og åbningstider indikerer en bred målgruppe."
```

**But we know**:
- ✅ Menu data EXISTS (5 periods with AI summaries)
- ✅ Location intelligence EXISTS (waterfront hooks)
- ✅ Website analysis EXISTS (tone, keywords)

**Root Cause**: `voice_rationale` is generated BEFORE data gathering OR from incomplete context

**Fix Strategy**:
1. Check when `voice_rationale` is generated (Prompt B? Post-processing?)
2. Ensure it has access to `dataSources.menuSummaries`, `websiteAnalysis`, `locationIntelligenceRow`
3. Update prompt: "List data sources used (menu periods: X, website analysis: yes/no, location intelligence: yes/no)"

**Expected Improvement**:
```
❌ Before: "Der er ingen direkte tekst fra sociale medier..."
✅ After: "Baseret på 5 menukort (brunch, frokost, aften), location intelligence (waterfront, city_centre), og website-analyse (åbningstider 09:30-02:00), er stemmen kalibreret til en hybrid café/restaurant/bar..."
```

---

### Issue 3: Confidence Over-Calibration

**Symptom**:
- Differentiation confidence: 91.75% (high)
- But: Generic proofs, unexplained reasoning

**Root Cause**: Confidence score based on DIFFERENTIATION HOOKS count, not DATA AVAILABILITY

**Current Logic**:
```typescript
differentiation_confidence_score: 0.9175  // Based on 2 hooks found
```

**Should Be**:
```typescript
base_confidence = 0.5  // Starting point
+ 0.15 if locationIntelligenceRow exists
+ 0.15 if menuSummaries.length > 0
+ 0.15 if websiteAnalysis exists
+ 0.05 per distinctive hook (max 2 hooks = +0.10)
= 0.85 max for Café Faust (0.5 + 0.15 + 0.15 + 0.15 + 0.10)
```

**Fix Strategy**:
1. Locate confidence calculation in `index.ts`
2. Add data availability weighting
3. Document formula in code comments

---

## Phase 5: Implementation Roadmap

### Priority 1: Fix Generic Proofs (🔥🔥🔥 CRITICAL)

**Files to Edit**:
- `supabase/functions/_shared/brand-profile/prompts/prompt-b.ts`
- `supabase/functions/brand-profile-generator/index.ts` (validation)

**Changes**:
1. Ensure `buildPromptB()` passes `aiSummaryItems` as proof tokens
2. Update proof instruction: "Cite specific dishes or menu categories in CAPS"
3. Add proof validation: Must contain ≥1 word from `aiSummaryItems` or `locationMarketingHooks`

**Expected Time**: 2 hours (edit + test + deploy)

---

### Priority 2: Improve `tone_of_voice` Examples (🔥🔥 HIGH)

**Files to Edit**:
- `supabase/functions/_shared/brand-profile/prompts/prompt-b.ts`

**Changes**:
1. Update example generation prompt: "Include 2 dish-specific examples using items from menu"
2. Add time-of-day variation: "1 brunch example, 1 dinner example"

**Expected Time**: 1 hour

---

### Priority 3: Fix `voice_examples.do_say` Confusion (🔥🔥 HIGH)

**Files to Edit**:
- `supabase/functions/_shared/brand-profile/prompts/prompt-b.ts`

**Changes**:
1. Clarify prompt: "do_say = vocabulary TO USE (dishes, service periods, location words)"
2. Not: "do_say ≠ marketing hooks (those go in location_intelligence)"

**Expected Time**: 1 hour

---

### Priority 4: Calibrate Confidence Score (🔥 MEDIUM)

**Files to Edit**:
- `supabase/functions/brand-profile-generator/index.ts`

**Changes**:
1. Add data availability weighting to confidence calculation
2. Document formula in comments

**Expected Time**: 30 minutes

---

### Priority 5: Fix brand_essence Validation (🔧 QUICK FIX)

**Files to Edit**:
- `supabase/functions/brand-profile-generator/index.ts` (validation regex)

**Changes**:
1. Update regex to accept compound offering phrases: "brunch og frokost til aftensmad"
2. Current regex likely only checks for single words

**Expected Time**: 15 minutes

---

### Priority 6: Fix Content Pillar Typo (🔧 QUICK FIX)

**Files to Edit**:
- `supabase/functions/_shared/brand-profile/prompts/prompt-b.ts`

**Changes**:
1. Add de-duplication for location references in pillar notes
2. "ved åen i Aarhus i Aarhus" → "ved åen i Aarhus"

**Expected Time**: 15 minutes

---

## Phase 6: Quality Validation Test

### After implementing fixes, run this test:

```bash
# Generate fresh profile
curl -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"businessId":"2037d63c-a138-4247-89c5-5b6b8cef9f3f","forceRegenerate":true}' \
  > cafe-faust-after-fixes.json

# Check improvements
jq '{
  soft_errors: .softErrors,
  tone_examples: .brandProfile.tone_of_voice.good_examples,
  do_say: .brandProfile.voice_examples.do_say,
  brand_essence_error: (.softErrors[] | select(contains("brand_essence"))),
  confidence: .analysisEvidence.differentiation_confidence_score
}' cafe-faust-after-fixes.json
```

### Success Criteria (After Fixes):

- ✅ Zero "generic proof" errors (down from 3)
- ✅ `tone_of_voice` examples include ≥1 dish name ("Pariserbøf")
- ✅ `do_say` includes ≥3 dish/menu words (not just location hooks)
- ✅ No brand_essence validation error
- ✅ Confidence score ≤ 85% (calibrated to data availability)
- ✅ `voice_rationale` mentions data sources used

---

## Phase 7: End-to-End Content Generation Test

### After brand profile improvements, test downstream impact:

```bash
# Generate daily suggestions using improved profile
curl -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-quick-suggestions" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"businessId":"2037d63c-a138-4247-89c5-5b6b8cef9f3f"}' \
  > daily-suggestions-after-fixes.json

# Check caption quality
jq '.suggestions[] | {
  headline: .headline,
  caption: .caption,
  has_dish_name: (.caption | test("Pariserbøf|CARPACCIO|Kalvecoulotte")),
  has_location: (.caption | test("åen|Aarhus")),
  word_count: (.caption | split(" ") | length)
}' daily-suggestions-after-fixes.json
```

### Success Criteria (Content Quality):

- ✅ ≥60% of captions reference specific dishes (up from ~20% estimated)
- ✅ ≥70% of captions mention location ("ved åen")
- ✅ Voice consistency: No "✨" emojis, no "Oplev" clichés
- ✅ Time-appropriate: Brunch suggestions before 14:00, cocktail suggestions after 18:00

---

## Summary: Recommended Sequence

### Week 1: Critical Fixes (8 hours total)

1. **Fix generic proofs** (2h) → Biggest quality impact
2. **Improve tone_of_voice examples** (1h) → Affects every generation
3. **Fix do_say vocabulary** (1h) → Proof token quality
4. **Calibrate confidence** (30min) → Transparency
5. **Fix brand_essence validation** (15min) → Remove false error
6. **Fix pillar typo** (15min) → Polish
7. **Test & validate** (3h) → Ensure improvements work

### Week 2: Field-by-Field Audit (Optional)

Only if Week 1 improvements don't achieve "great" status:
- Deep-dive `target_audience` proof specificity
- Review `core_offerings` categorization
- Investigate `communication_goal` N/A output
- Add timing hints to content pillars

---

## Decision Point

**Start with Priority 1-3** (generic proofs, tone examples, do_say vocabulary).

**Then measure impact** with end-to-end content generation test.

**If ≥80% of suggestions are on-brand and specific** → Success! 🎉

**If still generic** → Proceed to field-by-field audit.

---

**Next Step**: Should I proceed with implementing Priority 1 (Fix Generic Proofs)?
