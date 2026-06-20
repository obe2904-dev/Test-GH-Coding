# Diversity Enforcement Plan
**Goal**: Reduce feature repetition from 43% (3/7 fields) to <30% (≤2/7 fields)
**Current Status**: Validator detects issues, AI doesn't fully respect Prompt B instructions

---

## Problem Analysis

### Why Current Approach Falls Short

**What's Working:**
- ✅ Validator correctly detects over-representation (udendørs 43%, brunch 71%, cocktails 43%)
- ✅ Fallback builder uses feature scoring (temporal > physical priority)
- ✅ Prompt B has diversity instructions (lines 54-85)

**What's NOT Working:**
- ❌ AI generates all fields simultaneously → can't self-correct during generation
- ❌ Diversity rules buried mid-prompt (line 54 of ~1000+ line prompt)
- ❌ Rules are guidance ("may appear in MAX 2 fields") not structural enforcement
- ❌ business_character seeds physical features → cascade effect to other fields
- ❌ No feedback loop between validator detection and AI correction

### Root Cause Chain

```
business_character mentions "ved åen"
    ↓
brand_essence copies location context
    ↓
tone_of_voice references waterfront in examples
    ↓
Validator flags 43% repetition (3/7 fields)
    ↓
But no automatic correction happens
```

---

## Option 1: Strengthen Prompt B Instructions (Lowest Effort)

### Approach
- Move DIVERSITETSKONTROL block from line 54 → line 10 (before any field instructions)
- Change from guidance to hard rules with validation checkpoint
- Add explicit "BEFORE FINALIZING" scan instruction
- Include negative examples showing over-indexing

### Implementation

**Changes to prompt-b.ts:**
1. Move diversity block to system prompt section (top 50 lines)
2. Add field-by-field checklist:
   ```
   BEFORE FINALIZING — SCAN ALL FIELDS:
   □ Count how many times "ved åen"/"terrasse"/"udsigt" appear across all fields
   □ If any keyword appears >2 times → remove from lowest-priority field
   □ Priority order: voice_rationale > business_character > brand_essence > others
   ```
3. Add bad example:
   ```
   ❌ WRONG (over-indexing):
   business_character: "...ved åen..."
   brand_essence: "...ved åen..."
   tone_of_voice: "Inddrag åen som aktør..."
   content_strategy: "Unikke oplevelser ved åen"
   → "ved åen" in 4 fields = 57% repetition
   
   ✅ RIGHT (balanced):
   business_character: "...ved åen..."
   brand_essence: "Café i Aarhus — brunch til drinks..."
   tone_of_voice: "Skriv med terrassen som del af oplevelsen når relevant"
   content_strategy: "Varieret menu fra morgen til nat"
   → "ved åen" in 1 field = 14% repetition
   ```

### Pros
- ⚡ Quick to implement (~30 min)
- 💰 No architectural changes
- 🎯 Directly addresses AI attention issue

### Cons
- ⚠️ Relies on AI self-compliance (not guaranteed)
- ⚠️ Prompt already very long (token cost)
- ⚠️ May need multiple iterations to find right phrasing

### Success Probability: 60-70%

---

## Option 2: Post-Generation Selective Rewrite (Medium Effort)

### Approach
When validator detects >40% repetition:
1. Identify overused keyword and affected fields
2. Rank fields by "editability" (some fields MUST keep location context)
3. Regenerate ONLY the lowest-priority field with explicit "avoid [keyword]" instruction
4. Re-validate until <40%

### Implementation

**New file: `diversity-repair.ts`**
- Function: `repairFeatureOverIndexing(brandProfile, diversityWarnings)`
- Input: Full brand profile + validator warnings
- Output: Repaired brand profile with selective field regeneration

**Logic:**
```
FOR EACH warning about keyword K appearing in N fields:
  IF N > 2:
    fields_with_K = [business_character, brand_essence, ...]
    
    editability_priority = [
      content_strategy (most editable),
      brand_essence_elaboration,
      tone_of_voice,
      brand_essence,
      business_character (least editable - factual basis)
    ]
    
    field_to_fix = fields_with_K[lowest in editability_priority]
    
    prompt = f"Rewrite {field_to_fix} without mentioning {K}. 
              Focus on: [temporal/operational features from data]
              Must maintain: [factual accuracy, tone consistency]"
    
    regenerate(field_to_fix, prompt)
```

**Integration Point:**
- After validateFinalBrandProfile() in index.ts (around line 1350)
- Before saving to database

### Pros
- 🎯 Guaranteed to reduce repetition (keeps regenerating until <40%)
- 🧠 Smart field selection (protects factual fields)
- 📊 Measurable improvement on every generation

### Cons
- ⏱️ Adds 5-10 seconds to generation time (extra AI call)
- 💸 Increases cost (additional gpt-4o-mini call per repair)
- 🔧 More complex error handling (what if repair fails?)

### Success Probability: 85-90%

---

## Option 3: Two-Pass Generation (High Effort)

### Approach
Instead of generating all fields at once, use two-pass system:

**Pass 1: Core Identity Fields**
- Generate: business_character, brand_essence, identity_keywords
- Extract features mentioned → create "diversity budget" for Pass 2

**Pass 2: Voice & Strategy Fields**
- Generate: tone_of_voice, content_strategy, voice_examples
- Pass explicit "already mentioned in Pass 1" context
- Enforce: "If 'ved åen' already in business_character, describe waterfront as 'beliggenheden' or omit"

### Implementation

**Changes to index.ts:**
```
// Current: One Prompt B call
const response = await callPromptB(allData)

// New: Two sequential calls
const pass1 = await callPromptB_CoreIdentity(allData)
  → Returns: business_character, brand_essence, identity_keywords

const diversityContext = extractMentionedFeatures(pass1)
  → Returns: ["ved åen": 1, "brunch": 1, "cocktails": 1]

const pass2 = await callPromptB_VoiceStrategy(allData, diversityContext)
  → Passes: "ALREADY MENTIONED: ved åen (1x), brunch (1x) — avoid repeating"
  → Returns: tone_of_voice, content_strategy, voice_examples

const fullProfile = merge(pass1, pass2)
```

### Pros
- 🎯 Structural enforcement (not just guidance)
- 🧠 AI gets explicit "budget" information
- 🔒 Prevents over-indexing before it happens

### Cons
- ⏱️ Significantly slower (2 sequential AI calls = +30-40 seconds)
- 💸 Doubles AI costs for brand profile generation
- 🏗️ Major architectural change (risk of bugs)
- 🔧 Complex prompt splitting logic

### Success Probability: 90-95%

---

## Option 4: Field-Specific Keyword Blocklists (Medium Effort)

### Approach
After generating each field, build a cumulative blocklist:
1. Generate business_character → extract keywords → blocklist = []
2. Generate brand_essence → pass blocklist from step 1 → update blocklist
3. Generate tone_of_voice → pass cumulative blocklist → update blocklist
...

But wait — current architecture generates all fields in ONE response_format: json_object call. This won't work without changing to multiple calls (similar to Option 3).

**Alternative:** Generate all fields at once but include field-by-field budget in prompt:

```
DIVERSITY BUDGET (enforce these limits):
- "ved åen" / "waterfront": MAX 2 fields total
  Priority: business_character (must) > brand_essence (optional) > others (avoid)
  
- "brunch" / "frokost": MAX 2 fields total
  Priority: brand_essence (must) > core_offerings (must) > others (avoid)
  
- "cocktails" / "drinks": MAX 2 fields total
  Priority: core_offerings (must) > brand_essence (optional) > others (avoid)
```

### Pros
- 🎯 Explicit per-feature limits
- 📋 Clear priority rules for AI
- 💰 No extra AI calls needed

### Cons
- 📝 Very prompt-heavy (need to list all potential features)
- 🤔 Requires predicting which features might over-index (hard to generalize)
- ⚠️ Still relies on AI compliance

### Success Probability: 65-75%

---

## Option 5: Validation-Then-Repair Loop (Current + Enhancement)

### Approach
Current system already has validator → just make the repair more aggressive:

1. Keep existing validator (detects >40% repetition)
2. When detected, trigger automatic repair (not just logging)
3. Repair strategy: Remove keyword from fields in priority order until <40%

### Implementation

**Enhance validators.ts:**
```
Function: validateFeatureDiversity()
  → Returns: { warnings: string[], repairs: FieldRepair[] }
  
Interface FieldRepair {
  field: string  // e.g., "tone_of_voice"
  keyword: string  // e.g., "ved åen"
  action: "remove" | "replace"
  replacement?: string  // e.g., "beliggenheden"
}
```

**New function: applyDiversityRepairs()**
- Input: brandProfile, repairs[]
- Logic: Simple string replacement (no AI call)
- Example: 
  - Find "ved åen" in tone_of_voice
  - Replace with "beliggenheden" or remove sentence
  - OR replace with operational equivalent: "multi-program venue"

### Pros
- ⚡ Fast (no extra AI calls — just string ops)
- 💰 Free (no additional costs)
- 🔧 Deterministic (always same repair for same input)

### Cons
- ⚠️ Dumb replacement (might create awkward phrasing)
- ⚠️ Can't understand context (might remove important info)
- 📝 Need to maintain replacement dictionary

### Success Probability: 70-75%

---

## Recommended Approach: Hybrid Strategy

### Phase A: Quick Win (Week 1)
**Option 1: Strengthen Prompt B Instructions**
- Move diversity block to top of prompt
- Add explicit scan checkpoint
- Add negative examples
- **Expected improvement: 43% → 35%**

### Phase B: Structural Fix (Week 2)
**Option 2: Post-Generation Selective Rewrite**
- Implement diversity-repair.ts
- Only trigger when validator detects >40%
- Regenerate lowest-priority field with "avoid [keyword]" instruction
- **Expected improvement: 35% → 25%** (below 30% target ✅)

### Why This Combination?

1. **Fast feedback**: Option 1 can be tested in 1 hour
2. **Guaranteed success**: Option 2 ensures we hit target even if Option 1 partially fails
3. **Cost-effective**: Repair only runs when needed (not on every generation)
4. **Low risk**: Both changes are additive (can rollback independently)

---

## Implementation Timeline

### Week 1: Prompt Enhancement
- [ ] Day 1: Move DIVERSITETSKONTROL to top of prompt-b.ts
- [ ] Day 1: Add BEFORE FINALIZING scan checkpoint
- [ ] Day 1: Add negative examples (over-indexing vs balanced)
- [ ] Day 2: Deploy and test with 10 businesses
- [ ] Day 2: Measure improvement (target: 43% → 35%)

### Week 2: Repair System (if needed)
- [ ] Day 1: Create diversity-repair.ts with field editability ranking
- [ ] Day 1: Implement repairFeatureOverIndexing() function
- [ ] Day 2: Add repair trigger logic to index.ts validation flow
- [ ] Day 2: Test repair with Café Faust and other waterfront businesses
- [ ] Day 3: Measure final improvement (target: <30%)

---

## Success Metrics

### Before Fix (Current)
- Feature repetition: 43% (3/7 fields for "ved åen")
- Seasonal over-emphasis: 43% (3/7 fields)
- Brunch mentions: 71% (5/7 fields)

### After Phase A (Target)
- Feature repetition: <35% (≤2/7 fields for any single feature)
- Seasonal over-emphasis: <35%
- Brunch mentions: <50%

### After Phase B (Final Target)
- Feature repetition: <30% (≤2/7 fields) ✅
- Seasonal over-emphasis: <30% ✅
- Voice usable year-round ✅
- No single feature dominates brand profile ✅

---

## Risk Mitigation

### Risk 1: Prompt changes break other validations
**Mitigation**: Test with full validation suite before deployment

### Risk 2: Repair creates awkward phrasing
**Mitigation**: Only repair fields with editability_rank ≥ 3 (leave core identity fields alone)

### Risk 3: Generation time increases too much
**Mitigation**: Only trigger repair when validator detects >40% (not every generation)

### Risk 4: Cost increases unacceptably
**Mitigation**: Use gpt-4o-mini for repairs (not gpt-4o), estimated +$0.001 per repair

---

## Alternative: If Budget/Time Constrained

**Minimum Viable Fix:**
- Only implement Option 1 (Strengthen Prompt B)
- Add one additional rule: "Before finalizing, count 'ved åen' across all fields. If >2, rewrite brand_essence without location mention."
- Estimated time: 1 hour
- Estimated improvement: 43% → 38% (not quite to target, but better)

**Why this works as MVP:**
- brand_essence is the most "flexible" field (can describe business without location)
- business_character must keep location (factual requirement)
- Removing from brand_essence alone: 3 fields → 2 fields = 28% ✅

---

## Decision Matrix

| Option | Time | Cost/Gen | Success % | Risk |
|--------|------|----------|-----------|------|
| 1. Strengthen Prompt | 1h | $0 | 60-70% | Low |
| 2. Selective Rewrite | 8h | +$0.001 | 85-90% | Medium |
| 3. Two-Pass | 20h | +$0.015 | 90-95% | High |
| 4. Keyword Blocklists | 6h | $0 | 65-75% | Low |
| 5. Validation-Repair Loop | 4h | $0 | 70-75% | Medium |
| **Hybrid (1+2)** | **9h** | **+$0.001** | **90%** | **Low** |

**Recommendation: Hybrid (1+2)** ✅

Delivers 90% success probability with minimal cost and risk, while providing fast feedback loop for iteration.
