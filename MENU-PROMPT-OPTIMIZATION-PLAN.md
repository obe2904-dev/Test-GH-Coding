# Menu Prompt Optimization Plan
**Date:** 21. maj 2026  
**Status:** Planning Phase  
**Objective:** Remove hardcoded constraints, trust AI intelligence with sharp boundaries

---

## 🎯 CORE INSIGHT

**User Observation:** "Shorter, sharper prompts with 'do not invent' work better than longer prompts with many rules, exceptions, don'ts and dos."

**Why This Matters:**
- GPT-4o-mini is highly capable at nuanced assessment
- Long rule lists create conflicting priorities and confusion
- Sharp boundaries (quality guards) > Prescriptive instructions (creative constraints)
- "Do not invent" = boundary ✅ | "Use exactly 4 bullets" = micromanagement ❌

---

## 📋 PROMPT ENGINEERING PRINCIPLES

### 1. Quality Guards (KEEP)
These prevent AI from inventing or distorting:
- ✅ "Do not invent ingredients not in source"
- ✅ "Describe categories - never specific dish names"
- ✅ "No subjective language"
- ✅ "No target audience"
- ✅ "Return only JSON"

**Why Keep:** These define what's TRUE vs FALSE, REAL vs FABRICATED

### 2. Creative Constraints (REMOVE)
These prevent AI from adapting:
- ❌ "Use exactly 4-5 bullets"
- ❌ "100-150 words total"
- ❌ "Simple café = 4 themes, hybrid = 8 themes"
- ❌ "Dedicate one bullet to drinks"
- ❌ "1-2 sentences only"

**Why Remove:** These define HOW TO THINK, not WHAT IS TRUE

### 3. Analytical Frameworks (TRANSFORM)
Current state: Hidden as "implicit thinking"
- "Bredde/dybde: Hvor mange kategorier?"
- "Stilretning: Klassisk vs. moderne"
- "Prisprofil: Budget vs. premium"

**Problem:** These are great frameworks but buried in prose

**Solution:** Make them explicit core dimensions, remove prescriptive outputs

---

## 🔬 CURRENT STATE ANALYSIS

### Stage 2: Individual Menu Summary

**Current Prompt Structure:**
```
System: 6 critical rules (186 words)
User: Menu data + 9 requirement bullets (148 words)
Total: 334 words
```

**Breakdown:**
- Quality Guards: 40% (good - keep)
- Creative Constraints: 30% (bad - remove)
- Redundancy: 20% (saying same thing multiple ways)
- Data: 10% (actual menu content)

**Issues:**
1. "4-5 bullets" - Why not 3? Why not 6?
2. ".slice(0, 8)" - Code caps example dishes at 8
3. Repeats "objektiv" and "neutral" 4 times
4. Says both "KUN produkter" and "IKKE målgruppe" (same thing, inverse)

### Stage 3: Cross-Menu Summary

**Current Prompt Structure:**
```
User: Business data + Analytical frameworks + Requirements + Examples
Total: ~520 words
```

**Breakdown:**
- Quality Guards: 25%
- Creative Constraints: 35% (WORSE than Stage 2!)
- Analytical Frameworks: 20% (good concept, poor execution)
- Examples: 15% (risk of anchoring)
- Data: 5%

**Issues:**
1. "5-6 bullet points" - Prescriptive
2. "4-8 definerende karakteristika" - Range but still prescriptive
3. "VÆLG ANTAL baseret på... (simpel café = 4, hybrid = 8)" - Literal if-then
4. "100-150 ord totalt" - Artificial limit
5. "Hvis cocktail-/kaffe-/vinmenu: dediker ét bullet" - Micromanaging structure
6. Long example list might anchor AI to those exact patterns
7. Analytical frameworks hidden as "implicit" - should be explicit core

**System Prompt Structure:**
```
7 critical rules + quality markers examples
Total: ~280 words
```

**Issues:**
1. Repeats same rules as user prompt (redundant)
2. Quality markers show both ✅ and ❌ examples (helpful)
3. Still has prescriptive "5-6 bullet points" repetition

### Stage 4: Gastronomic Profile

**Current Prompt Structure:**
```
User: Simple Danish prompt (73 words)
System: Ultra-short (22 words)
Total: 95 words
```

**This is GOOD!** Short, sharp, clear boundary ("1-2 sætninger").

**Why It Works:**
- Single clear instruction
- One quality guard ("uden salgsgas")
- Trusts AI to assess complexity
- No examples, no rules lists

**Question:** Is "1-2 sætninger" a creative constraint or reasonable output format?
- **Assessment:** Reasonable format (like "return JSON"). Ultra-short IS the feature.

---

## 🎨 OPTIMIZATION STRATEGY

### Philosophy: Trust + Boundaries

**Instead of:**
```
Long list of what to do, what not to do, how many bullets, 
how many words, what if cocktails, what if café, etc.
```

**Use:**
```
1. What is your job? (role)
2. What must be true? (quality guards)
3. What dimensions matter? (analytical framework)
4. Return format (structure)
```

### Concrete Example Transformation

**BEFORE (Long & Prescriptive):**
```
Du er professionel menu-analytiker der laver objektive menubeskrivelser.

KRITISKE REGLER:
1. Beskriv KUN hvad menuen tilbyder - produkter, retter, mad/drikke
2. Beskriv KATEGORIER (smørrebrød, hovedretter, desserter) - ALDRIG specifikke retnavne
3. Objektiv tone - INGEN subjektive ord (lækre, hyggelig, fantastisk, afslappet)
4. INGEN målgruppe (familier, par, børn)
5. INGEN atmosfære (afslappet, hyggelig, stemningsfuld)
6. Returner KUN bullet-listen med • symbol

Lav objektiv oversigt over HVAD MENUEN TILBYDER:
- Fokuser KUN på produkter, retter og tilbud - IKKE målgruppe
- Beskriv KATEGORIER og MADTYPER - ALDRIG specifikke retnavne
- INGEN subjektive ord (lækre, hyggelig, afslappet, fantastisk)
- INGEN atmosfære-beskrivelser
- INGEN målgruppe-vurderinger
- Neutral, faktuel tone
- 4-5 bullets med • symbol
- Professionel dansk sprogbrug

Returner KUN bullet-listen, intet andet.
```

**AFTER (Short & Sharp):**
```
System:
Du er menu-analytiker. Beskriv objektivt hvad menuen tilbyder.

Regler:
- Beskriv kategorier, aldrig specifikke retter
- Faktuel tone - opfind intet
- Returner bullet-liste med •

User:
Menu: [data]

Beskriv hvad de tilbyder.
```

**Word count:** 334 words → ~40 words (88% reduction)

**What's removed:**
- Redundancy (saying "objektiv" 4 times)
- Inverse rules ("KUN produkter" + "IKKE målgruppe" = same thing)
- Prescriptive counts ("4-5 bullets")
- Micromanagement ("professionel formulering")

**What's kept:**
- Role definition
- Quality guards (categories not dishes, factual)
- Output format (bullet list)

**What's trusted to AI:**
- How many bullets are appropriate
- What tone "faktuel" means
- Whether drinks need separate bullet
- Length

---

## 📐 PROPOSED ARCHITECTURE

### Hierarchy of Prompting

```
TIER 1: IDENTITY
Who are you? What's your job?
→ "Du er menu-analytiker"

TIER 2: BOUNDARIES  
What must NEVER be false?
→ "Beskriv kategorier, aldrig specifikke retter"
→ "Opfind intet"

TIER 3: DIMENSIONS (if analytical)
What factors matter in your analysis?
→ For cross-menu: "Vurder bredde, stil, inklusivitet"

TIER 4: FORMAT
How to return output?
→ "Returner bullet-liste" eller "Returner JSON"

TIER 5: DATA
Here's what to analyze
→ [menu content]
```

**AVOID:**
- Prescriptive counts
- If-then logic
- Micromanagement
- Redundancy
- Example lists (unless demonstrating quality)

---

## 🔄 STAGE-BY-STAGE OPTIMIZATION PLAN

### Stage 2: Individual Menu Summary

**Current Issues:**
1. 334 words (too long)
2. Redundant rules
3. "4-5 bullets" constraint
4. ".slice(0, 8)" code limitation

**Proposed Changes:**

**Option A (Minimalist):**
```javascript
const systemPrompt = `Du er menu-analytiker. Beskriv objektivt hvad menuen tilbyder.

Regler:
- Beskriv kategorier - aldrig specifikke retter
- Faktuel tone - opfind intet
- Returner bullet-liste med •`;

const userPrompt = `Menu: "${menuTitle}"
Kategorier: ${itemLines.join('\n')}

Beskriv hvad menuen tilbyder.`;
```

**Word count:** ~35 words (90% reduction)

**Option B (Balanced):**
```javascript
const systemPrompt = `Du er menu-analytiker. Lav objektiv beskrivelse af menuens tilbud.

Kvalitetsregler:
- Beskriv kategorier og madtyper, aldrig specifikke retnavne
- Faktuel, neutral tone uden subjektive ord
- Opfind intet - kun hvad der fremgår
- Returner bullet-liste med •`;

const userPrompt = `Menu: "${menuTitle}"
${itemLines.join('\n')}

Beskriv hvad denne menu tilbyder.`;
```

**Word count:** ~55 words (84% reduction)

**Recommendation:** Start with Option B (balanced). Test Option A if results are still good.

**Code Changes:**
```javascript
// Remove constraint
.slice(0, 8)  →  .slice(0, 15)  // Show more context

// Remove prescriptive count
"4-5 bullets med • symbol"  →  "Returner bullet-liste med •"
```

---

### Stage 3: Cross-Menu Summary

**Current Issues:**
1. 520 words user prompt (too long)
2. 280 words system prompt (redundant with user)
3. "5-6 bullets", "4-8 themes", "100-150 words" (prescriptive)
4. "simpel café = 4, hybrid = 8" (if-then logic)
5. Long example list (anchoring risk)
6. Analytical frameworks buried as "implicit thinking"

**Proposed Changes:**

**Option A (Sharp):**
```javascript
const systemPrompt = `Du er menu-analytiker. Syntetiser etablissementets samlede menuudbud.

Vurder:
- Bredde & dybde (kategorier, udvalg)
- Stil (klassisk, moderne, fusion)
- Inklusivitet (vegetar, allergi)
- Drikkefokus (hvis relevant)

Regler:
- Beskriv kategorier, aldrig specifikke retter
- Faktuel tone - opfind intet
- Returner JSON: {"summary": "• bullets", "signature_themes": ["tema1", ...]}`;

const userPrompt = `Etablissement: ${businessName}

${menuBreakdownText}

Analyser og beskriv hvad de tilbyder.`;
```

**Word count:** ~80 words (85% reduction from 520)

**Option B (Balanced with Examples):**
```javascript
const systemPrompt = `Du er menu-analytiker der syntetiserer menuudbud til forbruger-information.

Analyser etablissementets kompleksitet og tilpas beskrivelsen:
- Bredde: Få fokuserede retter eller bredt udvalg?
- Stil: Klassisk, moderne café, fusion?
- Fokus: Mad, drikke, eller begge?
- Inklusivitet: Vegetar/allergi-tilgængelighed?

Kvalitetsregler:
- Beskriv kategorier og madtyper, aldrig specifikke retnavne
- Faktuel tone - opfind intet
- Signature-temaer: 2-10 labels afhængigt af kompleksitet
  (Simpelt sted = færre temaer, komplekst sted = flere temaer)

Returner JSON: {"summary": "• bullets", "signature_themes": ["label1", ...]}`;

const userPrompt = `${businessName}
${menuBreakdownText}

Analyser menuudbuddet.`;
```

**Word count:** ~120 words (77% reduction)

**Recommendation:** Option B (balanced). Keeps analytical framework explicit, removes if-then logic ("2-10 afhængigt af kompleksitet" trusts AI judgment).

**What's Removed:**
- "5-6 bullet points" → AI decides
- "4-8 themes" → "2-10 afhængigt af kompleksitet" (range, not prescription)
- "simpel café = 4, hybrid = 8" → Trust AI to assess complexity
- "100-150 ord" → AI decides appropriate length
- "Hvis cocktail-menu: dediker ét bullet" → AI decides structure
- Long example lists → Removed (or keep 2-3 if needed for quality)

**What's Kept:**
- Analytical dimensions (Bredde, Stil, Inklusivitet)
- Quality guards (categories not dishes)
- Complexity guidance (without prescription)

---

### Stage 4: Gastronomic Profile

**Current State:** 95 words - already optimized ✅

**Assessment:** No changes needed. This is the gold standard.

**Why:**
- Short and sharp
- Single clear instruction
- One quality guard
- Trusts AI completely

**Keep as-is.**

---

## 🧪 TESTING STRATEGY

### Phase 1: Baseline Testing (Before Changes)
**Objective:** Document current behavior

**Test Cases:**
1. **Café Faust** (hybrid restaurant)
   - Expected: 5-6 bullets, 6-8 themes
   - Currently: Forced to these numbers
   
2. **Simple Coffee Bar** (hypothetical)
   - Expected: 2-3 bullets, 3-4 themes
   - Currently: Forced to 4-5 bullets, 4 themes minimum
   
3. **Fine Dining Restaurant** (hypothetical)
   - Expected: 4-5 bullets, 5-7 themes
   - Currently: Works reasonably well
   
4. **Juice Bar** (hypothetical)
   - Expected: 2 bullets, 2 themes
   - Currently: Forced to 4-5 bullets, padding needed

**Metrics:**
- Bullet count variance
- Theme count variance
- Quality (subjective assessment: does it feel natural or forced?)
- Specificity (does it mention specific dishes when it shouldn't?)

### Phase 2: Optimized Testing (After Changes)
**Same test cases, new prompts**

**Expected Improvements:**
1. Coffee bar: 2-3 bullets (not forced to 4-5)
2. Juice bar: 2 themes (not padded to 4)
3. Complex hybrid: 8-10 themes if needed (not capped at 8)
4. All cases: More natural language, less forced structure

**Metrics:**
- Bullet count variance (should increase - adaptation)
- Theme count variance (should increase - adaptation)
- Quality (should improve - natural fit)
- Still no specific dishes (quality guard holds)
- Still no subjective language (quality guard holds)

### Phase 3: Edge Case Testing

**Test Cases:**
1. **Omakase Sushi** (single tasting menu)
   - No categories, just progression
   - How does it adapt?
   
2. **Specialty Coffee Roastery** (15+ coffee offerings)
   - Complex beverage focus
   - Currently capped at 8 examples
   
3. **Food Truck** (3 items total)
   - Minimal offering
   - Should be 1-2 bullets
   
4. **Multi-Concept** (breakfast café, lunch restaurant, evening cocktail bar)
   - High complexity
   - Should get 8-10 themes

### Phase 4: A/B Testing (If Possible)

**Method:** Run both prompts on same data, compare

**Evaluation Criteria:**
- Accuracy (does it describe reality?)
- Adaptability (does it fit the business?)
- Quality (no invention, no subjectivity)
- Conciseness (efficient communication)

---

## 🎯 SUCCESS CRITERIA

### Must Maintain (Quality Guards)
- ✅ Zero specific dish names in summaries
- ✅ Zero subjective language
- ✅ Zero target audience mentions
- ✅ Zero atmosphere descriptions
- ✅ Category-focused descriptions
- ✅ Factual tone throughout

### Must Improve (Adaptability)
- ✅ Bullet count varies appropriately (2-8 range observed)
- ✅ Theme count varies appropriately (2-12 range observed)
- ✅ Simple businesses get concise descriptions
- ✅ Complex businesses get comprehensive descriptions
- ✅ Coffee bars recognized and described appropriately
- ✅ Wine bars recognized and described appropriately
- ✅ Multi-concept venues get full theme coverage

### Must Not Regress (Quality)
- ❌ AI invents dishes not in source
- ❌ AI adds subjective opinions
- ❌ AI describes target audience
- ❌ Output becomes inconsistent or unreliable

---

## ⚠️ RISK ASSESSMENT

### Risk 1: AI Generates Too Many Bullets
**Scenario:** Without "4-5 bullets" cap, AI generates 15 bullets

**Mitigation:**
- Add soft guidance: "Hold det koncist"
- If testing shows this, add reasonable range: "typisk 3-6 bullets"
- Monitor in Phase 2 testing

**Likelihood:** Low (GPT-4o-mini is good at conciseness)

### Risk 2: AI Invents Content Without Explicit Ban
**Scenario:** Removing "opfind intet" causes hallucinations

**Mitigation:**
- KEEP "opfind intet" - this is a quality guard, not a creative constraint
- Test thoroughly in Phase 2
- If issues arise, strengthen: "Kun hvad der eksplicit fremgår"

**Likelihood:** Medium (this is critical boundary)

### Risk 3: AI Ignores Quality Guards in Short Prompts
**Scenario:** Shorter prompt = less emphasis on "no specific dishes"

**Mitigation:**
- Keep all quality guards, just remove redundancy
- "Beskriv kategorier, aldrig specifikke retter" stays
- Test specifically for this in Phase 2

**Likelihood:** Low (quality guards are clear boundaries)

### Risk 4: Output Becomes Too Variable
**Scenario:** Different runs produce wildly different structures

**Mitigation:**
- Keep format requirement: "Returner bullet-liste"
- Keep JSON structure for cross-menu
- Temperature is already 0.3 (consistent)
- If variance is too high, add soft guidance

**Likelihood:** Low (structured output format + low temperature)

### Risk 5: Example Removal Hurts Quality
**Scenario:** Without examples, AI doesn't understand theme types

**Mitigation:**
- Keep 2-3 example categories: "Eksempler: Kaffespecialist, Casual dining, Plantebaseret"
- Phrase as "inspiration" not "constraints"
- Test without examples first; add back if needed

**Likelihood:** Medium (examples can help, but might anchor)

---

## 📅 IMPLEMENTATION ROADMAP

### Step 1: Baseline Documentation (1 hour)
- [ ] Run current prompts on Café Faust
- [ ] Document exact output (bullets, themes, quality)
- [ ] Save in `_test_baseline_menu_output.sql`

### Step 2: Stage 2 Optimization (1 hour)
- [ ] Update `menu-extract-v2/index.ts` with Option B (balanced)
- [ ] Remove `.slice(0, 8)` cap → `.slice(0, 15)`
- [ ] Deploy Edge Function
- [ ] Test on Café Faust
- [ ] Compare with baseline

### Step 3: Stage 3 Optimization (1.5 hours)
- [ ] Update `menu-overview-summary.ts` with Option B (balanced)
- [ ] Remove prescriptive counts
- [ ] Remove if-then logic
- [ ] Keep analytical frameworks as explicit dimensions
- [ ] Deploy Edge Function
- [ ] Test on Café Faust
- [ ] Compare with baseline

### Step 4: Edge Case Testing (2 hours)
- [ ] Test with hypothetical coffee bar menu
- [ ] Test with hypothetical juice bar menu
- [ ] Test with complex multi-concept menu
- [ ] Document variance in outputs
- [ ] Assess quality maintenance

### Step 5: Refinement (1 hour)
- [ ] If AI too verbose: Add "Hold det koncist"
- [ ] If AI too variable: Add soft range "typisk 3-6 bullets"
- [ ] If quality issues: Strengthen quality guards
- [ ] Re-test problematic cases

### Step 6: Documentation Update (30 min)
- [ ] Update MENU-EXTRACTION-PROMPTS-DOCUMENTATION.md
- [ ] Document new prompt philosophy
- [ ] Update quality validation criteria
- [ ] Archive old prompts for reference

### Step 7: Rollout (30 min)
- [ ] Final deployment
- [ ] Monitor production usage
- [ ] Collect feedback from actual business data

**Total Estimated Time:** 7.5 hours

---

## 💭 PHILOSOPHICAL ALIGNMENT

### Current System Thinking
"We must control AI output with precise rules to ensure quality"
→ Result: Rigid, doesn't adapt, feels forced

### Proposed System Thinking
"AI is intelligent. Give it sharp boundaries and trust its judgment"
→ Expected Result: Adaptive, natural, fits each business

### User's Insight Applied
"Shorter, sharper prompts with 'do not invent' work better"
→ Translation:
- ✅ Quality boundaries: "Beskriv kategorier, aldrig retter" (sharp, clear)
- ✅ Trust: "Vurder kompleksitet og tilpas" (intelligent assessment)
- ❌ Micromanagement: "Use exactly 4-5 bullets" (removes)
- ❌ Redundancy: Saying same rule 3 different ways (removes)

### Alignment with Existing Successful Patterns

Looking at the codebase, `generate-text-from-idea` uses:
```
🚫 Faktakrav: Opfind ALDRIG ingredienser...
```

This works because:
1. **Sharp emoji** (🚫) signals importance
2. **Clear boundary** (ALDRIG = NEVER)
3. **Specific scope** (ingredients, not "be creative")
4. **Trusts AI** with everything else

We should apply same principle:
```
Menu-analytiker:
Beskriv kategorier - aldrig specifikke retter ← sharp boundary
Opfind intet ← sharp boundary
[Everything else: trust AI]
```

---

## 🎓 KEY LEARNINGS TO APPLY

### From Successful Prompts in Codebase

**Gastronomic Profile** (95 words, works great):
- Simple role
- One instruction
- One guard
- Trusts AI completely

**Generate-text-from-idea** (emoji + faktakrav):
- Visual signal (🚫)
- Absolute language (ALDRIG)
- Specific scope
- Short

### From Problematic Prompts in Codebase

**Overly Complex Rules:**
When prompts have 7+ rules with sub-bullets and exceptions, they perform worse.

**Redundancy:**
Saying "objektiv tone", "neutral sprogbrug", "faktuel beskrivelse", "professionel formulering" is 4 ways to say same thing.

**Inverse Rules:**
"Fokuser KUN på X" + "IKKE Y" = same constraint twice

### Lessons for Menu Prompts

1. **Keep quality guards sharp and absolute**
   - "Aldrig specifikke retter" ✅
   - "Opfind intet" ✅
   
2. **Remove redundancy**
   - "Objektiv, neutral, faktuel, professionel" → "Faktuel tone" ✅
   
3. **Remove inverse duplicates**
   - "KUN kategorier" + "IKKE specifikke retter" → "Beskriv kategorier, aldrig retter" ✅
   
4. **Trust AI with appropriate complexity**
   - "4-5 bullets" → "Bullet-liste" ✅
   - "simpel café = 4 themes" → "2-10 themes afhængigt af kompleksitet" ✅

---

## ✅ FINAL RECOMMENDATIONS

### Immediate Actions

1. **Approve this plan** (or request modifications)

2. **Start with Stage 2** (Individual Menu Summary)
   - Lower risk
   - Faster to test
   - Clear quality metrics

3. **Use Option B (Balanced)** for both stages
   - Not too radical
   - Keeps analytical frameworks
   - Removes clear constraints

4. **Test on Café Faust first**
   - Real data
   - Can compare with current output
   - Can verify quality guards hold

5. **Monitor these metrics:**
   - Quality guards: Must maintain 100%
   - Adaptability: Should improve
   - Conciseness: Should improve
   - Variance: Should increase (good - shows adaptation)

### Long-term Vision

**Move toward "Trust + Boundaries" model across all AI features:**

Current codebase has inconsistent philosophies:
- Some prompts are sharp and minimal (gastronomic profile) ✅
- Some prompts are long with many rules (cross-menu summary) ❌
- Some use visual signals (🚫 Faktakrav) ✅
- Some use redundant text rules ❌

**Standardize on:**
```
Role → Boundaries → Trust
Short → Sharp → Intelligent
```

**This applies beyond menus to:**
- Content generation
- Location intelligence
- Brand profile analysis
- All AI features

---

## 📊 DECISION MATRIX

| Aspect | Current | Option A (Minimalist) | Option B (Balanced) | Recommendation |
|--------|---------|---------------------|-------------------|----------------|
| **Word Count** | 334 words | 35 words | 55 words | Option B |
| **Quality Guards** | Strong but redundant | Minimal | Clear | Option B |
| **Adaptability** | Low (prescriptive) | High | High | Either |
| **Risk** | Low (known behavior) | Medium (radical change) | Low-Medium | Option B |
| **Testing Effort** | Baseline | High | Medium | Option B |
| **User Philosophy Fit** | Poor | Excellent | Excellent | Either |
| **Rollback Ease** | N/A | Easy | Easy | Either |

**Verdict:** Option B (Balanced) - Best risk/reward ratio

---

## 🤔 OPEN QUESTIONS FOR USER

1. **Testing Approach:** Should we test on production data (Café Faust) or create test dataset first?

2. **Rollback Plan:** If quality degrades, do we:
   - Revert immediately? 
   - Try to fix with strengthened guards?
   - Test more edge cases?

3. **Example Lists:** Keep 2-3 example theme labels as "inspiration" or remove entirely?

4. **Analytical Frameworks:** Keep them explicit ("Vurder bredde, stil, inklusivitet") or make them even more implicit?

5. **Deploy Sequence:** 
   - Stage 2 first, validate, then Stage 3?
   - Or both at once for consistent experience?

6. **Success Definition:** What's acceptable variance?
   - If one business gets 3 bullets and another gets 7, is that good (adaptive) or bad (inconsistent)?

---

**Status:** Ready for review and approval. No code changes made yet - pure planning phase.

**Next Step:** Await your feedback on approach, then proceed with implementation.
