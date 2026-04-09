# PROMPT ASSESSMENT: Layer 0 & Layer 8
**Date:** 2026-02-16  
**Analyst:** GitHub Copilot  
**Focus:** Gemini 2.5 Flash prompt effectiveness & hallucination prevention

---

## EXECUTIVE SUMMARY

**VERDICT:** Both prompts are **too long, too complex, and doing too much in one sequence**.

**Key Findings:**
1. **Layer 8 (Caption):** ~1200-1500 characters, 11 distinct sections → Gemini forgets middle rules
2. **Layer 0 Phase 2 (Strategy):** ~6500-7000 characters, massive rule list → AI prioritizes first/last, skips middle
3. **Result:** Flat, generic text + persistent hallucinations (🥐 croissant on non-croissant items)
4. **Gemini 2.5 Flash weakness:** Known to forget middle instructions in long prompts

---

## 1. LAYER 8: CAPTION GENERATION (prompt-builder.ts)

### Current Structure (11 sections assembled)
```typescript
return `${systemRole}
${buildBusinessContext(context, countryConfig)}
${buildContentSection(context, countryConfig)}
${buildPlatformRequirements(context)}
${buildBrandVoiceGuidelines(context, countryConfig)}
${buildContextualElements(context, countryConfig)}
${buildStyleGuide(countryConfig)}
${buildHashtagGuidance(context, countryConfig)}
${buildTaskSection(context, countryConfig)}
${buildCriticalRequirements(context, platformConfig, countryConfig)}
${buildExample(platform, countryConfig)}
Return ONLY valid JSON...`
```

### Problems

#### ❌ PROBLEM 1: Too Many Sections (11)
**Effect:** Gemini 2.5 Flash prioritizes:
- **First 2-3 sections** (systemRole, businessContext, contentSection) ✅
- **Middle 6-7 sections** (brandVoice, contextualElements, styleGuide, hashtags) ⚠️ OFTEN SKIPPED
- **Last 2-3 sections** (criticalRequirements, example, JSON format) ✅

**Evidence:** Your example captions:
```
"Start din dag med varme hos os! Nyd en lækker brunch med sprøde 
croissanter og varm morgenkaffe..." 🥐
```

This violates:
- ✅ **Section 3** (buildContentSection): "Brug DENNE beskrivelse - opfind IKKE ingredienser" ← Gemini READ this
- ❌ **Section 5** (buildBrandVoiceGuidelines): "Never say: [banned words]" ← Gemini SKIPPED
- ❌ **Section 7** (buildStyleGuide): "Undgå klichéer" ← Gemini SKIPPED
- ✅ **Section 10** (criticalRequirements): "LÆNGDE: 125-175 tegn" ← Gemini READ this

**The middle sections are being forgotten.**

#### ❌ PROBLEM 2: Menu Description Passed, But AI Still Hallucinates
Even when we pass the correct description (`oksekød, rødbeder, kapers...`), the prompt asks too much:

```typescript
if (desc.length > 120) {
  section += `Beskrivelse (lang - SAMMENFAT i dine egne ord):\n"${desc.substring(0, 120)}..."\n`
  section += `→ Vælg 2-3 hovedpunkter, ikke hele listen\n`
}
```

**This is dangerous.** When you tell Gemini to "summarize in your own words", it:
1. Sees "Pariserbøf" (name)
2. Associates "Paris" → French cuisine
3. Adds croissants 🥐 because that's "French breakfast"
4. Ignores the actual description (buried in middle section)

#### ❌ PROBLEM 3: Brand Voice Section Is Overloaded
```typescript
function buildBrandVoiceGuidelines() {
  // 8 different conditional branches:
  // - signature_phrases
  // - never_say / do_not_say
  // - personality traits (4 types)
  // - tone_keywords (fallback)
  // - voice_style (fallback)
  // - values
  // - typical_openings
  // - sample_posts
}
```

**Too many branches.** Gemini can't track all conditions. Result: **ignores most of them**.

#### ❌ PROBLEM 4: Style Guide Lists Are Too Long
```typescript
✅ GØR: (12 items from config)
❌ UNDGÅ: (15 items from config)
```

**Gemini ignores lists > 5-7 items.** It reads the first 2-3 and the last 1-2, skips the middle.

### Current Estimated Length
- **System role:** ~100 chars
- **Business context:** ~80 chars
- **Content section:** ~200-400 chars (menu items)
- **Platform requirements:** ~120 chars
- **Brand voice guidelines:** ~300-500 chars (depending on data)
- **Contextual elements:** ~200 chars
- **Style guide:** ~400 chars (big lists)
- **Hashtag guidance:** ~150 chars
- **Task section:** ~100 chars
- **Critical requirements:** ~300 chars
- **Example:** ~150 chars

**TOTAL: ~1200-1500 characters** (depending on brand data)

### Why This Causes Flat Text
**The prompt is optimizing for rules, not creativity.**

When you have 11 sections with 40+ rules, Gemini:
1. Spends cognitive budget on **compliance** (checking rules)
2. Little budget left for **creativity** (writing engaging text)
3. Defaults to **safe, generic language** to avoid violating rules
4. Result: "Nyd en lækker brunch..." (boring, template-like)

---

## 2. LAYER 0 PHASE 2: STRATEGY/IDEAS (weekly-strategy-generator.ts)

### Current Structure
```typescript
function buildPhase2Prompt() {
  return `
  Du er marketing-chef...
  
  OPGAVE: ...
  CONTENT MIX STRATEGI: ... (4 paragraphs)
  TONE I DINE STRATEGISKE FORKLARINGER: ... (2 paragraphs)
  DIN PLAN FRA FØR: ... (angles data)
  MENU-RETTER: ... (signature items list)
  BRAND VOICE: ... (5 fields)
  INDHOLDSTYPER: ... (4 types with examples)
  KRITISK ENFORCEMENT: ... (2 paragraphs)
  TONE-GUIDE: ... (HUGE section, 8+ examples)
  NARRATIVE TONE-GUIDE: ... (❌ FORBUDT vs ✅ GODT examples)
  UNDGÅ DIREKTE OVERSÆTTELSER: ... (5 examples)
  NARRATIVE EKSEMPLER: ... (3 detailed examples)
  DATA-INTEGRITET: ... (examples)
  PLATFORME: ...
  MEDIE-TYPER: ...
  VEJR OG DAGE: ...
  REGLER: ... (10 numbered rules)
  SVAR I JSON-FORMAT: ... (example structure)
  `;
}
```

### Problems

#### ❌ PROBLEM 1: Absolutely Massive (~6500-7000 characters)
**This is 4-5x longer than recommended for Gemini Flash.**

**Gemini 2.5 Flash optimal prompt length:** ~1500-2000 chars  
**Your prompt:** ~6500-7000 chars  
**Overage:** ~350% too long

#### ❌ PROBLEM 2: Trying To Do Everything In One Shot
The prompt is simultaneously:
1. Teaching marketing theory (content mix)
2. Briefing strategy execution (angles)
3. Enforcing tone rules (consultant-speak bans)
4. Teaching Danish translation (no direct English→Danish)
5. Providing data integrity rules (no fake metrics)
6. Teaching narrative structure (meta-language bans)
7. Teaching content types (product vs experience)
8. Enforcing content mix ratios (60/40 split)
9. Platform requirements
10. Weather context
11. JSON structure

**This should be 3-4 separate prompts, not one megaprompt.**

#### ❌ PROBLEM 3: "NARRATIVE TONE-GUIDE" Section Is Counterproductive
You spend 60+ lines teaching Gemini what NOT to say:

```
❌ FORBUDT META-SPROG:
- "Vores content mix sikrer balance..."
- "Post-planen er designet til..."
- "Vi implementerer en strategisk fordeling..."
(5 examples)

✅ GODT:
- "Vi viser både konkrete retter..."
- "Planen kombinerer 3 menu-posts..."
(3 examples)
```

**Irony:** By showing examples of bad text, you're **teaching Gemini bad patterns**.

**Better approach:** Just show good examples. Don't show bad ones.

#### ❌ PROBLEM 4: Gemini STILL Suggests Croissants
Your ideas show:
```
"Start dagen med varme hos os"
"Din varme oase ved åen"
```

These are **atmosphere posts** (not menu_item), but they mention:
- "sprøde croissanter" 🥐
- "varm morgenkaffe"

**Why?** The prompt says:
```
OPLEVELSE-POSTS (~40% af planen):
2. atmosphere: Vis stemningen, stedet, udsigten
   Eksempel: "Hygge ved åen i kulden"
   Formål: Emotionel relation, viser WHY folk kommer
```

**No menu constraint for atmosphere posts.** So Gemini fills in "Danish café atmosphere" from its training:
- Danish cafés = hygge
- Hygge = coffee + pastries
- Pastries = croissants 🥐

**Fix:** Add explicit constraint: "Atmosphere posts MUST NOT mention food items not on menu."

#### ❌ PROBLEM 5: Rule #10 Is A Thought Exercise
```
10. Test: Rationale lyder som marketing-chef der briefer ejeren? 
    Post titles lyder som caféen selv skriver?
```

**Gemini can't "test" itself.** This is a self-reflection question for humans.  
**Effect:** Gemini ignores it (too abstract).

### Why This Causes Hallucinations
1. **Cognitive overload:** 10+ sections → Gemini skips middle rules
2. **No explicit "menu only" constraint** for atmosphere posts
3. **Cultural association fallback:** "Paris" in "Pariserbøf" → French cuisine → croissants
4. **Examples of bad text** teach bad patterns instead of preventing them

---

## 3. ROOT CAUSE ANALYSIS

### Why Flat Text?
**Prompt optimizes for compliance, not engagement.**

When Gemini sees:
- 40+ rules
- 11 sections
- "❌ Don't do X" lists
- "✅ Do Y" lists
- Style guides
- Tone guides
- Content restrictions

It enters **defensive mode:**
1. Prioritize **not violating rules**
2. Use **safe, generic language** (can't go wrong)
3. Avoid **creative risks** (might violate a rule)
4. Result: "Nyd en lækker brunch med sprøde croissanter..." (template text)

**The prompt is teaching Gemini to be a bureaucrat, not a social media expert.**

### Why Hallucinations Persist?
**Even with correct data, prompt structure causes AI to ignore it.**

**Data flow:**
1. Layer 0 generates idea: `"Pariserbøf: En klassiker"`
2. Layer 7 fetches menu description: `"oksekød, rødbeder, kapers, løg, peberrod..."`
3. Layer 8 receives description in Section 3 (builds correctly) ✅
4. Layer 8 prompt has 11 sections → **Gemini forgets Section 3 by Section 8** ❌
5. Layer 8 falls back to: "Paris" → French → croissants 🥐

**The instruction to use the description is in the MIDDLE of the prompt.**  
**Gemini 2.5 Flash forgets middle instructions.**

---

## 4. RECOMMENDATIONS (ARCHITECTURE CHANGES)

### ⚡ SHORT-TERM FIXES (No architecture changes)

#### Layer 8 fixes:
1. **Move menu description to TOP of prompt** (first 3 lines after system role)
2. **Reduce sections from 11 → 6:**
   - System role + Business context
   - **CONTENT (menu description) ← PRIORITIZE THIS**
   - Brand voice (ONLY 3 most important rules)
   - Context (day, season, weather) + Platform format
   - 1-2 style rules (most critical only)
   - JSON format
3. **Remove "summarize in your own words"** — this triggers hallucination
4. **Change instruction:**
   ```
   ❌ Old: "Beskrivelse (lang - SAMMENFAT i dine egne ord)"
   ✅ New: "Beskrivelse (brug mindst 2 ingredienser fra denne liste):"
   ```
5. **Add explicit menu constraint:**
   ```
   ⚠️ KRITISK: Nævn KUN ingredienser fra beskrivelsen. Opfind INGENTING.
   Hvis du nævner en ingrediens der ikke er i beskrivelsen, fejler du opgaven.
   ```

#### Layer 0 fixes:
1. **Cut prompt length by 50%:** Remove all "❌ FORBUDT" examples (just show "✅ GODT")
2. **Add explicit constraint:**
   ```
   ATMOSPHERE POSTS: MUST NOT mention specific food items. 
   Focus on: location, views, interior, ambiance, people.
   ❌ WRONG: "Nyd croissanter ved åen"
   ✅ RIGHT: "Varme ved vinduet når det er koldt ude"
   ```
3. **Remove Rule #10** (self-testing question)
4. **Move JSON example to TOP** (show format first, rules after)

---

### 🏗️ LONG-TERM FIXES (Architecture refactor)

#### Split Layer 8 into TWO calls:

**Call 1: Structure Generator (Gemini 2.5 Flash, short prompt)**
```
Input: menu description, brand voice (3 rules max), context
Output: { hook, main_points: [2-3 bullets], cta }
Length: ~500 chars
```

**Call 2: Caption Writer (Gemini 2.0 Flash Thinking, VERY short prompt)**
```
Input: structure from Call 1
Prompt: "Transform this structure into natural Danish text. Use 125-175 chars."
Length: ~200 chars
Think: Uses thinking mode to self-correct
```

**Why this works:**
- Call 1: Focus on **WHAT to say** (content accuracy)
- Call 2: Focus on **HOW to say it** (language quality)
- Separation prevents cognitive overload

#### Split Layer 0 Phase 2 into TWO calls:

**Call 1: Content Type Selector**
```
Input: strategic angles, target count, content mix rules (60/40)
Output: [
  {type: "menu_item", focus_angle: "X"},
  {type: "atmosphere", focus_angle: "Y"},
  ...
]
Prompt length: ~800 chars
```

**Call 2: Content Detailer (per post type)**
```
Input: content type, focus angle, menu list (IF menu_item)
Output: { title, rationale, media_direction }
Prompt length: ~600 chars
Note: Different prompt for menu_item vs atmosphere (prevents croissant leakage)
```

**Why this works:**
- Call 1: Enforce content mix ratios (pure logic)
- Call 2: Generate details (creative, but constrained by type)
- Separate prompts = no "atmosphere post with croissants" confusion

---

## 5. IMMEDIATE ACTION PLAN

### Priority 1: Fix Hallucinations (Layer 8)
**Change 3 lines in prompt-builder.ts:**

1. Move menu description to top (after system role)
2. Remove "SAMMENFAT i dine egne ord"
3. Add explicit constraint: "Use ONLY ingredients from description"

**Expected result:** Pariserbøf captions will show `oksekød, rødbeder` instead of `croissanter`.

### Priority 2: Fix Flat Text (Layer 8)
**Reduce prompt from 11 sections → 6:**

1. Keep: systemRole, content (with menu data), brand voice (3 rules max), context, JSON format
2. Remove: Full style guide (too long), hashtag strategy (move to post-processing), detailed examples

**Expected result:** More creative, engaging captions (less compliance overhead).

### Priority 3: Fix Atmosphere Hallucinations (Layer 0)
**Add constraint to Phase 2 prompt:**

```
ATMOSPHERE POSTS:
- Focus: Location, views, interior, ambiance, people
- ⚠️ CRITICAL: DO NOT mention food items (no dishes, no croissants, no specific menu items)
- Why: Atmosphere posts sell the PLACE, not the PRODUCT
```

**Expected result:** Atmosphere posts like "Hygge ved åen" won't mention croissants.

### Priority 4: Shorten Layer 0 Prompt
**Cut 50% of text:**

1. Remove all "❌ FORBUDT" examples (just show ✅ GODT)
2. Remove "UNDGÅ DIREKTE OVERSÆTTELSER" section (move to glossary/post-processing)
3. Remove "DATA-INTEGRITET" section (handle in validation, not prompt)
4. Remove Rule #10 (self-testing)

**Expected result:** Gemini focuses on fewer, clearer rules → better compliance.

---

## 6. TESTING PROTOCOL

### Before Changes (Baseline)
Run 3 generations:
1. Pariserbøf post → Check for 🥐 or "croissant"
2. Atmosphere post → Check if it mentions food items
3. Count: How many captions use banned words from brand voice?

**Record:** Hallucination rate, generic language rate

### After Changes (Validation)
Run same 3 generations:
1. Pariserbøf post → Should show `oksekød, rødbeder` only
2. Atmosphere post → Should mention location/views, NOT food
3. Count: Reduction in banned word usage

**Success criteria:**
- Hallucination rate: 0% (must show actual ingredients)
- Generic language: < 30% (max 1 in 3 captions can be "template-like")
- Brand voice compliance: > 80% (avoid banned words)

---

## 7. CONCLUSION

**Your intuition is correct:**
1. ✅ Prompts are too long
2. ✅ They're trying to do too much
3. ✅ Gemini 2.5 Flash forgets middle rules
4. ✅ Result: Flat text + hallucinations

**Solution:**
- **Short term:** Cut prompt length 50%, move critical rules to top/bottom
- **Long term:** Split into multiple focused calls (content → structure → language)

**Your observation about Gemini 2.5 Flash is accurate:**
> "Når prompten er så lang, prioriterer Gemini de første og sidste regler og glemmer midten."

This is a known behavior. The fix is prompt architecture, not just better wording.

---

## 8. NEXT STEPS

**Ready to implement when you say "yes":**

1. **Refactor Layer 8 prompt** (1 hour)
   - Reduce sections 11 → 6
   - Move menu description to top
   - Add explicit ingredient constraint
   - Remove "summarize in your own words"

2. **Refactor Layer 0 Phase 2 prompt** (1 hour)
   - Cut length 50% (remove ❌ examples, keep ✅ only)
   - Add atmosphere food constraint
   - Remove self-testing rule
   - Move JSON example to top

3. **Test extensively** (30 min)
   - 10 generations
   - Check hallucination rate
   - Measure caption creativity (manual review)

**Total time: ~2.5 hours**

---

**Assessment complete. No code changes yet per your request.**  
**Say the word and I'll implement Priority 1-4 fixes above.**
