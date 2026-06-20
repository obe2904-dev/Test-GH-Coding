# Weekly Strategy Prompt Diagnostic Report
**Date:** 2026-06-02  
**Scope:** Phase 0, Phase 1, Phase 2c (get-weekly-strategy + generate-weekly-plan)  
**Priority:** Stability, Anti-Hallucination, Quality Preservation

---

## Executive Summary

The weekly strategy prompt system has accumulated **significant technical debt** through incremental patching. While functional, it exhibits:

1. **Contradictory Constraints** (5 major conflicts identified)
2. **Instruction Overload** (20+ forbidden phrases, 4-layer constraint hierarchies)
3. **Hallucination Risk** (patched with explicit "don't invent" rules)
4. **Brand Profile Bypass** (hardcoded tone constraints override business-specific voice)
5. **Redundant Validation** (same rules enforced in prompt + code + post-processing)

**Critical Finding:** System fights hallucination with *prohibition lists* rather than *structural constraints*. This creates cognitive load where AI must balance "be creative" against "avoid these 25 things."

---

## 🚨 Priority 1: Contradictory Instructions

### 1.1 Creativity vs Prohibition Lists

**Conflict:**
```
Phase 1: "Du SKAL levere præcis 4 angles der dækker forskellige tidsvinduer, 
         målgrupper og content types" [creativity expected]

Phase 2c: FORBUDTE VENDINGER (må ALDRIG optræde):
  - "hygge" · "hyggelig" · "hyggelige" · "hyggefølelse" · "hyggepause" 
  - "hyggelige rammer" · "den perfekte ramme" · "indbydende atmosfære"
  - "lokal perle" · "socialt samvær" · "fristed" · "oase"
  - [20+ more forbidden phrases]
```

**Problem:** AI must be creative while avoiding 25+ specific phrases. This is defensive writing, not strategic guidance.

**Root Cause:** Each phrase was banned to fix a specific output issue, but collectively they create an "avoid-first" mindset.

**Impact:** AI focuses on constraint satisfaction over quality. Creative energy spent navigating prohibitions.

---

### 1.2 Weather Framing (Triple Contradiction)

**Conflict Location: Phase 0 + Phase 2c**

```
Phase 0 Line 142:
"Hvis ugen er normal... Opfind IKKE dramatik hvor der ingen er."

Phase 0 Line 203:
WEATHER_RELEVANCE cap: weather weight downgraded if business has low relevance

Phase 2c Line 352:
"Vejr åbner KUN S1 hvis weather_relevance = 'high'"

Phase 2c Line 361:
FORBUDT vejrklichéer: "skubber gæsterne indendørs", "trækker indendørs", 
"vejret gør stedet attraktivt"
```

**Problem:** Four separate mechanisms control weather usage:
1. Phase 0: "Don't invent drama"
2. Phase 0: Post-processing weight cap
3. Phase 2c: Conditional opener permission
4. Phase 2c: Forbidden weather phrases

**Impact:** AI receives contradictory signals—weather is provided as data but heavily restricted in usage. Creates confusion about *when* weather is strategically valid.

---

### 1.3 Menu Item Usage (Validation Mismatch)

**Conflict:**
```
Phase 2c Line 332:
"VERIFICERET MENULISTE (brug KUN navne herfra): [list of menu items]"

Validation Warnings (from recent logs):
- 'Post-idé "Eftermiddagskaffen er klar" nævner generisk drik som ikke er i signatur-items'
- 'Narrativ nævner sæsoningrediens "jordbær" som IKKE er på menuen'
```

**Problem:** 
- Prompt says: "Use ONLY names from verified menu list"
- AI uses generic concepts ("kaffe") not literal menu items
- Validation flags this as error
- But generic concepts are often *better* for marketing

**Root Cause:** Prompt wants literal menu items. Marketing needs conceptual framing. System doesn't distinguish between:
- Menu item validation (Phase 2b: specific dish selection)
- Conceptual framing (Phase 2c: "eftermiddagskaffe" as occasion, not menu item)

---

### 1.4 Temporal Distribution (Hardcode vs AI Instruction)

**Conflict:**
```
Phase 1 (newly added):
"⚠️ TEMPORAL DISTRIBUTION: Spread dine 4 angles across forskellige dage... 
Undgå at clustre alle posts på 2-3 på hinanden følgende dage"

Phase 2a.ts Line 263-310:
// Consecutive-days guard (max 2 days in a row) [HARDCODED]
// Automatically moves posts to prevent 3+ consecutive days
```

**Problem:** AI told to spread posts, then code overrides AI decisions anyway.

**Impact:** Wasted AI reasoning. If code enforces anyway, remove from prompt.

---

### 1.5 Brand Voice (Hardcoded Prohibitions Override Profile)

**Critical Design Flaw:**

```
Business-Specific:
brand_profile.never_say: ["hygge", "hyggelig"] [from Cafe Faust brand profile]

System-Wide Hardcoded:
Phase 2c FORBUDTE VENDINGER: 
"hygge" · "hyggelig" · "hyggelige" · [20+ phrases]
```

**Problem:** Hardcoded forbidden phrases list applies to *all businesses*, overriding brand profile flexibility.

**Example Impact:**
- Classical Italian restaurant: Should avoid "hygge" (not Italian)
- Danish hygge-focused café: Might *want* "hygge" as brand identifier
- Current system: Both get same prohibition list

**Consequence:** Brand Profile system bypassed. All businesses get same tone constraints.

---

## ⚡ Priority 2: Instruction Overload

### 2.1 Phase 0 Context Layers (5 Overlapping Hierarchies)

**Problem:** AI receives pre-computed context in 5 different formats:

```
1. FORRETNINGSMODEL: business_mode, visit_mode, primary_daypart_this_week
2. BESØGSKARAKTER: weekly_framing (location_framing, motivation_framing, daypart_framing)
3. DRIVER HIERARKI: business_driver_ranking (primary, secondary, supporting, deprioritized)
4. STRATEGISKE UDGANGSPUNKTER: strategic_priority_candidates_v2
5. POSTING TIMING STRATEGI: posting_windows_by_segment
```

**Each layer provides:**
- Overlapping guidance about "what matters most this week"
- Different terminology for same concepts
- Unclear priority when they conflict

**Cognitive Load:** AI must synthesize 5 context layers before even starting analysis.

**Recommendation:** Consolidate into single unified context brief.

---

### 2.2 Phase 2c Overview Rules (3 Sentences × 8 Rules Each)

**Current Structure:**
```
Sætning 1: TRIGGER
  - Rule 1: Must be observation about world/guest behavior
  - Rule 2: Can't start with strategy labels
  - Rule 3: Weather only if weather_relevance='high'
  - Rule 4: When medium/low, use weekday-timing instead
  - Rule 5: Forbidden weather clichés (7 specific phrases)
  - Rule 6: [implicit] Must connect to PRIMARY_ANGLE

Sætning 2: DIFFERENTIERING  
  - Rule 1: Must use 2 of 4 elements (dagsdel-span, besøgstype, drift, lokation)
  - Rule 2: Blocked phrases (8 specific phrases = auto-rejection)
  - Rule 3: Differentiation test (would competitor say this?)
  - Rule 4: [implicit] Build from business_character

Sætning 3: GÆSTENS NÆSTE SKRIDT
  - Rule 1: Forbidden internal instruction language (4 specific phrases)
  - Rule 2: [implicit] Must be actionable for guest
```

**Problem:** Each sentence has 4-6 rules. AI must satisfy 18+ constraints for 3 sentences.

**Impact:** Compliance-focused output. Safe but generic.

---

### 2.3 Event Handling (Redundant Constraints)

**Event rules appear in:**

```
Phase 0 Line 395-400:
"KRITISK REGEL OM EVENTS:
- Brug KUN de events der er listet ovenfor
- Brug det PRÆCISE navn som står i listen
- Du må IKKE opfinde eller antage events
- Hvis "EVENTS: Ingen", må du IKKE nævne nogen events"

Phase 1 Line 470-474:
"KRITISK REGEL OM EVENTS:
- Brug KUN de events der er listet ovenfor
- Brug det PRÆCISE navn som står i listen  
- Du må IKKE opfinde eller antage events"

Phase 2c Line 352:
"KRITISK REGEL OM EVENTS: Hvis events er nævnt ovenfor, 
brug det PRÆCISE navn fra listen. Må IKKE generalisere."
```

**Problem:** Same rule repeated 3 times across 3 phases. Each addition was a patch for hallucination.

**Impact:** Prompt bloat. If Phase 0 enforces it, later phases shouldn't need to repeat.

---

## 🛡️ Priority 3: Hallucination Risk Areas

### 3.1 Seasonal Ingredients (Persistent Warning Source)

**Pattern from logs:**
```
'Narrativ nævner sæsoningrediens "jordbær" som IKKE er på menuen'
'Narrativ nævner sæsoningrediens "hindbær" som IKKE er på menuen'
```

**Current Approach:**
```
Phase 0 Line 376-382:
"Menustøttede sæsonråvarer (eneste konkrete ingredienser der må nævnes): 
[list or "ingen"]"

Phase 0 Line 381:
"Menustøttede sæsonråvarer: ingen — nævn IKKE specifikke sæsoningredienser"
```

**Problem:** 
- System provides seasonal context (June = "jordbær, hindbær")
- Then says "don't use these specific ingredients"
- AI pattern-matches seasonal context anyway
- Validation flags as error

**Root Cause:** Prompt gives data then restricts usage. Better: Don't provide tempting data.

---

### 3.2 Event Hallucination (Recently Patched)

**Evolution:**
1. **Initial:** No event constraints → AI invented "musikfestival"
2. **Patch 1:** Added "Use only provided events"
3. **Patch 2:** Added "Use exact names, not categories"
4. **Patch 3:** Repeated rules in Phase 1
5. **Patch 4:** Repeated rules in Phase 2c

**Current State:** Three-layer defense against what should be structural constraint.

**Better Approach:** 
- Phase 0: Validate events list is complete
- Later phases: Trust Phase 0 output
- Remove redundant warnings

---

### 3.3 Menu Item Mismatch

**From logs:**
```
'Post-idé "Friskbagt brunch med æg og pølser" nævner generisk drik som 
ikke er i signatur-items'
```

**Problem:** AI generates conceptually correct but validation-failing content.

**Two Conflicting Goals:**
1. Marketing: "Friskbagt brunch" = appetizing, conceptual
2. Validation: Must use exact menu item names

**Impact:** Forced to choose between marketing quality and validation passing.

---

## 🎯 Priority 4: Brand Profile vs Hardcoded Constraints

### 4.1 Tone Constraints Should Be Brand-Driven

**Current System:**
```
Hardcoded FORBUDTE VENDINGER (applies to all businesses):
- "hygge" · "hyggelig" · "hyggelige"
- "lokal perle" · "socialt samvær"
- "autentisk oplevelse"
- [20+ more]
```

**Business-Specific (brand_profile table):**
```typescript
brand_voice: {
  never_say: brandProfile.never_say || [],
  signature_phrases: brandProfile.signature_phrases || [],
  tone_dna: brandProfile.brand_profile_v5?.voice?.tone_dna,
}
```

**Problem:** System has brand-specific `never_say` but ignores it in favor of hardcoded list.

**Solution:** Move forbidden phrases into brand_profile.never_say. Each business customizes.

---

### 4.2 Creativity/Consistency Metrics

**User Requirement:**
> "Creativity, consistency and variety should be determined in Brand Profile. 
> A classical Italian restaurant would have different metrics than Cafe Faust."

**Current Reality:**
- No brand-level creativity dial
- No consistency vs variety slider
- All businesses get same constraint density

**Missing:**
```typescript
brand_profile: {
  creativity_level: 'conservative' | 'balanced' | 'bold'
  consistency_priority: 'high' | 'medium' | 'low'
  variety_tolerance: 0.0 - 1.0
}
```

---

## 📋 Priority 5: Technical Debt Patterns

### 5.1 Post-Processing Overrides (Phase 0)

**Code does cleanup AI should not need:**

```typescript
// Post-process: transform financial language → behavioral language
factor.behavioral_impact = factor.behavioral_impact
  .replace(/budgetbevidsthed/gi, 'folk overvejer mere hvad de bruger')
  .replace(/budgetbevidst(e)?/gi, 'folk vælger mere bevidst')
  .replace(/budgetstramt|stramt budget/gi, 'folk overvejer mere')
  .replace(/impulskøb/gi, 'spontane valg')
  // [8 more replacements]
```

**Problem:** Prompt says "IKKE finansielt sprog" but AI uses it anyway, requiring post-processing.

**Better:** Fix prompt instruction so AI doesn't generate financial language initially.

---

### 5.2 Validation That Duplicates Prompts

**Pattern:**
```
Prompt Phase 2c: "Brug KUN navne fra verificeret menuliste"
Validation: Checks if items are in signature_items list
Log Warning: "nævner generisk drik som ikke er i signatur-items"
```

**Three-layer enforcement:**
1. Prompt instruction
2. Validation check
3. Warning log

**Problem:** If validation catches it, prompt instruction failed. Why have both?

**Decision Needed:** 
- Either trust prompt (remove validation)
- Or enforce in code (simplify prompt)
- Not both

---

## 📊 Quantified Impact

### Prompt Length Analysis

| Phase | Lines | Constraints | Forbidden Phrases |
|-------|-------|-------------|-------------------|
| Phase 0 | 450 | ~15 major rules | 0 (financial → behavioral) |
| Phase 1 | 700 | ~20 major rules | 0 (defers to Phase 2) |
| Phase 2c | 500 | ~30 major rules | 25+ explicit |
| **Total** | **1650** | **~65 rules** | **25+ phrases** |

### Cognitive Load Estimate

**For AI to generate 1 weekly plan:**
1. Process 5 overlapping context hierarchies (Phase 0)
2. Satisfy 65+ constraints
3. Avoid 25+ forbidden phrases
4. Pass 3-layer validation (prompt → code → post-process)
5. Balance contradictory goals (creative yet constrained)

**Result:** Compliance-first output. Safe, predictable, occasionally generic.

---

## 🎯 Recommendations (Step-Wise)

### Phase 1: Immediate Wins (Low Risk)

**1. Consolidate Event Rules**
- Keep event constraint in Phase 0 only
- Remove duplicates from Phase 1, Phase 2c
- **Risk:** None. Reduces bloat.

**2. Remove Hardcoded Temporal Distribution**
- Phase 2a guard works. Remove Phase 1 AI instruction.
- **Risk:** None. Code already enforces.

**3. Consolidate Weather Guidance**
- Single weather relevance check in Phase 0
- Remove redundant Phase 2c conditional
- **Risk:** Low. Simplifies one contradiction.

**Impact:** ~15% prompt reduction, clearer AI guidance.

---

### Phase 2: Structural Improvements (Medium Risk)

**4. Move Forbidden Phrases to Brand Profile**
- Create `brand_profile.forbidden_phrases` column
- Migrate hardcoded list as default
- Allow per-business customization
- **Risk:** Medium. Test on Cafe Faust first.

**5. Unified Context Layer (Phase 0)**
- Consolidate 5 hierarchies into single "Strategic Brief"
- Remove redundant/overlapping guidance
- **Risk:** Medium. Requires regression testing.

**6. Seasonal Ingredient Structural Fix**
- Don't provide ingredient lists if they're restricted
- Or clearly separate "descriptive context" vs "usable content"
- **Risk:** Low. Reduces hallucination surface.

**Impact:** ~25% prompt reduction, brand flexibility, fewer contradictions.

---

### Phase 3: Comprehensive Refactor (High Risk, High Reward)

**7. Brand-Driven Constraint System**
```typescript
brand_profile: {
  creativity_level: 'conservative' | 'balanced' | 'bold'
  tone_constraints: {
    forbidden_phrases: string[]
    required_elements: string[]
    voice_positioning: string
  }
  content_preferences: {
    weather_relevance: 'low' | 'medium' | 'high'
    event_emphasis: 'minimal' | 'moderate' | 'primary'
    menu_specificity: 'conceptual' | 'balanced' | 'literal'
  }
}
```

**8. Prompt Simplification Architecture**
- Phase 0: Pure factual analysis (no prohibitions)
- Phase 1: Strategic brief (use Phase 0 facts)
- Phase 2: Execution (use Phase 1 strategy)
- Validation: Catch genuine errors only (not re-enforce prompt rules)

**9. Testing Protocol**
- Regression test suite with 10+ historical weeks
- Quality scoring (specificity, accuracy, brand fit)
- A/B test simplified prompts vs current
- Gradual rollout with monitoring

**Impact:** ~40% prompt reduction, brand flexibility, quality improvement.

---

## 🚦 Recommended Next Steps

**Your Choice:**

**Option A: Conservative (Phases 1 only)**
- 2-3 hours work
- Low risk
- 15% improvement
- Test on Week 24 regeneration

**Option B: Balanced (Phases 1-2)**
- 1-2 days work  
- Medium risk
- 25% improvement
- Requires brand profile migration
- Test on staging/copy first

**Option C: Comprehensive (All 3 phases)**
- 1 week work
- High risk (requires extensive testing)
- 40% improvement
- Brand flexibility unlocked
- Quality ceiling raised

---

## Questions for You

1. **Immediate Priority:** Should we start with Phase 1 (safe, quick wins)?

2. **Brand Profile Philosophy:** Should tone constraints be business-specific or system-wide?

3. **Validation Strategy:** Should we enforce in prompt OR code, not both?

4. **Testing Appetite:** Are you OK with temporary quality dips during refactor testing?

5. **Seasonal Ingredients:** Should we remove them from prompts entirely if they cause validation warnings?

Please clarify priorities and I'll proceed with implementation.
