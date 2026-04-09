# Brand Policy + IdeaPlan Implementation Summary

## What Was Built

Implemented deterministic constraint system that transforms Brand Profile into hard constraints before AI generation. This prevents AI from inventing offerings, mixing dayparts, and making unverified claims.

---

## 1. **New Types** (types.ts)

### BrandPolicy
```typescript
interface BrandPolicy {
  voice_rules: { tone, essence, style_notes }
  forbidden_terms: string[]
  offerings_allowlist: string[]  // What can be mentioned without menu proof
  verified_anchors: {
    location?: string[]   // "ved åen", "i hjertet af København"
    interior?: string[]   // "hyggelig atmosfære", "moderne indretning"
    experience?: string[] // "perfekt til dating", "familievenlig"
  }
}
```

### IdeaSlot
```typescript
interface IdeaSlot {
  slot_id: 'A' | 'B' | 'C'
  idea_type: 'menu' | 'vibe' | 'occasion'
  daypart?: Daypart
  allowed_categories?: string[]
  must_include: {
    menu_item?: { category?: string }
    anchors?: string[]  // Required verified anchors
  }
  must_avoid: {
    forbidden_terms: string[]
    unverified_claims: boolean
  }
  cta_intent: 'book' | 'menu' | 'visit' | 'engage'
}
```

### IdeaPlan
```typescript
interface IdeaPlan {
  slots: [IdeaSlot, IdeaSlot, IdeaSlot]  // Exactly 3 slots
  policy: BrandPolicy
  strategy_reasoning: string
}
```

---

## 2. **Brand Policy Compiler** (policies/brand-policy-compiler.ts)

### Compile Function
```typescript
compileBrandPolicy(profile: BusinessProfile, menuCatalog: MenuCatalog): BrandPolicy
```

**What It Does:**
- **Offerings Allowlist**: Extracts from `business_offerings` + menu categories → ["kaffe", "brunch", "kager", ...]
- **Verified Anchors**: Parses `business_offerings` for location/interior/experience claims with evidence
- **Voice Rules**: Compiles tone/essence/style from `brand_voice`
- **Forbidden Terms**: Passes through from `business_brand_profile.do_not_say.words`

**Example Output:**
```typescript
{
  offerings_allowlist: ["kaffe", "brunch", "kager", "mad", "drinks"],
  verified_anchors: {
    location: ["ved åen"],
    interior: ["hyggelig"],
    experience: []
  },
  forbidden_terms: ["billig", "hurtig"],
  voice_rules: { tone: ["venlig", "autentisk"], essence: "..." }
}
```

### Helper Functions
- `isAllowedOffering(term, policy)` - Check if term in allowlist
- `isVerifiedAnchor(anchor, type, policy)` - Check if anchor has evidence
- `formatPolicyForPrompt(policy)` - Format for AI prompt

---

## 3. **Enhanced Strategy Engine** (generators/strategy-engine.ts)

### New Function
```typescript
createIdeaPlan(context: GenerationContext): IdeaPlan
```

**3-Slot Strategy:**
- **Slot A**: Menu Spotlight (current daypart, must use menu item)
- **Slot B**: Vibe/Experience (verified anchors only, no menu required)
- **Slot C**: Occasion/Ritual (flexible - menu optional, situation-rich)

**What Changed:**
- **Before**: Returns generic `GenerationPlan` with idea types
- **After**: Returns `IdeaPlan` with 3 explicit slots, each with hard constraints

**Slot Creation Logic:**
```typescript
createMenuSlot('A', daypart, menuByCategory, policy)
  → { slot_id: 'A', idea_type: 'menu', daypart: 'lunch', allowed_categories: ['FROKOST'], must_include: { menu_item: {...} } }

createVibeSlot('B', policy, contentPillars)
  → { slot_id: 'B', idea_type: 'vibe', must_include: { anchors: ['ved åen', 'hyggelig'] } }

createOccasionSlot('C', adjacentDaypart, menuByCategory, policy)
  → { slot_id: 'C', idea_type: 'occasion', daypart: 'dinner', must_include: {} }
```

---

## 4. **Slot-Aware Prompts** (generators/prompt-builder.ts)

### Updated Function
```typescript
buildUserPrompt(context, ideaPlan?: IdeaPlan, legacyPlan?: GenerationPlan)
```

**Prompt Format:**
```
=== 3-SLOT GENERATION PLAN (MANDATORY) ===
Strategy: Time-aware 3-slot plan: A=menu, B=vibe, C=occasion

━━━ SLOT A: MENU ━━━
Type: menu
Daypart: lunch
REQUIRED: Must feature a menu item from category: FROKOST
Allowed categories: FROKOST, BRUNCH
FORBIDDEN: billig, hurtig
CTA Intent: book

━━━ SLOT B: VIBE ━━━
Type: vibe
REQUIRED: Must reference at least one verified anchor:
  - ved åen
  - hyggelig
ALLOWED OFFERINGS: kaffe, brunch, kager, mad
Do NOT invent other offerings or claims.
FORBIDDEN: Unverified location/interior/experience claims
CTA Intent: visit

━━━ SLOT C: OCCASION ━━━
Type: occasion
Focus: Situation, ritual, or usage occasion (menu reference optional)
Allowed mentions: kaffe, brunch, mad
FORBIDDEN: billig, hurtig
CTA Intent: engage
```

**Key Changes:**
- Each slot gets explicit section with constraints
- Offerings allowlist shown for non-menu slots
- Verified anchors listed explicitly
- Daypart/category restrictions stated upfront

---

## 5. **Slot Compliance Validators** (validators/content-validator.ts)

### New Function
```typescript
validateSlotCompliance(idea: PostIdea, slot: IdeaSlot, policy: BrandPolicy, menuCatalog, prefix)
```

**Validation Checks:**

1. **idea_type Match**
   ```typescript
   if (idea.idea_type !== slot.idea_type) {
     errors.push({ message: `Slot A requires 'menu', got 'vibe'` })
   }
   ```

2. **Menu Item Requirement**
   ```typescript
   if (slot.must_include.menu_item) {
     if (!idea.menu_item) → ERROR
     if (!menuCatalog.includes(idea.menu_item)) → ERROR
     if (!slot.allowed_categories.includes(item.category)) → ERROR
     if (!item.daypart_tags.includes(slot.daypart)) → ERROR
   }
   ```

3. **Offerings Allowlist** (for vibe/occasion slots)
   ```typescript
   if (content.includes('cocktail') && !isAllowedOffering('cocktail', policy)) {
     errors.push({ message: `Mentions "cocktail" not in allowlist` })
   }
   ```

4. **Verified Anchors Requirement**
   ```typescript
   if (slot.must_include.anchors) {
     if (!content.includes(any anchor)) → ERROR
   }
   ```

### Updated validateSuggestions
```typescript
validateSuggestions(ideas, businessProfile, menuCatalog, ideaPlan?: IdeaPlan)
```
- Added `ideaPlan` parameter
- Calls `validateSlotCompliance()` for each idea if ideaPlan provided
- Backward compatible (legacy mode if no ideaPlan)

---

## 6. **Orchestration Update** (generators/smart-generator.ts)

### What Changed
```typescript
// BEFORE:
const plan = createGenerationPlan(context)
const userPrompt = buildUserPrompt(context, plan)

// AFTER:
const ideaPlan = createIdeaPlan(context)  // Creates BrandPolicy + 3 slots
const userPrompt = buildUserPrompt(context, ideaPlan)
```

**New Logs:**
```
📋 Creating 3-slot idea plan with brand policy...
   Strategy: Time-aware 3-slot plan: A=menu, B=vibe, C=occasion
   Slots: A=menu, B=vibe, C=occasion
   Offerings allowlist: 15 terms
   Verified anchors: 3 total
```

**PostIdea Enhancement:**
- Added `slot_id?: string` field to PostIdea
- AI returns `slot_id: "A"|"B"|"C"` for each idea
- Used in validation to match idea against slot constraints

---

## Data Flow (Before vs After)

### BEFORE (Generic Planning)
```
BusinessProfile → strategy-engine → GenerationPlan
  ↓
GenerationPlan: { ideas: [{ type: 'menu', category: 'BRUNCH' }], reasoning: "..." }
  ↓
Prompt: "Generate 3 ideas: menu, vibe, moment"
  ↓
AI: Improvises structure, invents offerings, mixes dayparts
  ↓
Validation: Only checks forbidden terms + menu existence
```

### AFTER (Deterministic Constraints)
```
BusinessProfile + MenuCatalog → brand-policy-compiler
  ↓
BrandPolicy: { offerings_allowlist, verified_anchors, forbidden_terms, voice_rules }
  ↓
BrandPolicy + Context → strategy-engine → IdeaPlan
  ↓
IdeaPlan: {
  slots: [
    { slot_id: 'A', idea_type: 'menu', daypart: 'lunch', allowed_categories: ['FROKOST'] },
    { slot_id: 'B', idea_type: 'vibe', must_include: { anchors: ['ved åen'] } },
    { slot_id: 'C', idea_type: 'occasion', daypart: 'dinner' }
  ],
  policy: BrandPolicy
}
  ↓
Prompt: Explicit slot instructions with allowlists + constraints
  ↓
AI: Fills each slot per constraints (no improvisation)
  ↓
Validation: Slot compliance + allowlist + daypart match + verified anchors
```

---

## What This Solves

### Problem 1: Invented Offerings
**Before**: AI mentions "cocktails" when business only serves coffee  
**After**: Offerings allowlist prevents mentions not in `business_offerings` or menu

### Problem 2: Daypart Collisions
**Before**: "BØF & BEARNAISE" framed as brunch post  
**After**: Slot specifies `daypart: 'dinner'`, validator checks `menu_item.daypart_tags`

### Problem 3: Unverified Location Claims
**Before**: AI writes "ved åen" without evidence  
**After**: Only verified anchors from `business_offerings` allowed in vibe slots

### Problem 4: Generic Flat Posts
**Before**: AI guesses structure, 3 similar vibe posts  
**After**: Explicit slots force: 1 menu + 1 vibe + 1 occasion

### Problem 5: Prompt Bloat
**Before**: 2,700 tokens to explain structure  
**After**: Same token count, but structured as hard constraints (not suggestions)

---

## Backward Compatibility

### Legacy Mode Support
- `createGenerationPlan()` still exists (marked DEPRECATED)
- `buildUserPrompt()` accepts `ideaPlan` OR `legacyPlan`
- `validateSuggestions()` works without `ideaPlan` parameter
- Frontend receives same `PostIdea[]` structure (added optional `slot_id`)

### Migration Path
1. Deploy with both systems active
2. Test new IdeaPlan system in production
3. Monitor slot compliance validation
4. After 1 week stable, remove legacy `GenerationPlan` code

---

## Example: Complete Flow

### Input Business Profile
```typescript
{
  business_name: "Café Viggo",
  business_offerings: "Økologisk kaffe, hjemmelavet brunch ved åen",
  forbidden_terms: ["billig", "hurtig"]
}
```

### Step 1: Compile BrandPolicy
```typescript
{
  offerings_allowlist: ["kaffe", "coffee", "brunch", "mad"],
  verified_anchors: {
    location: ["ved åen"],
    interior: [],
    experience: []
  },
  forbidden_terms: ["billig", "hurtig"]
}
```

### Step 2: Create IdeaPlan (3 slots)
```typescript
{
  slots: [
    {
      slot_id: 'A',
      idea_type: 'menu',
      daypart: 'breakfast',
      allowed_categories: ['BRUNCH'],
      must_include: { menu_item: { category: 'BRUNCH' } },
      must_avoid: { forbidden_terms: ['billig', 'hurtig'], unverified_claims: true },
      cta_intent: 'book'
    },
    {
      slot_id: 'B',
      idea_type: 'vibe',
      must_include: { anchors: ['ved åen'] },
      must_avoid: { forbidden_terms: ['billig', 'hurtig'], unverified_claims: true },
      cta_intent: 'visit'
    },
    {
      slot_id: 'C',
      idea_type: 'occasion',
      daypart: 'lunch',
      must_avoid: { forbidden_terms: ['billig', 'hurtig'], unverified_claims: true },
      cta_intent: 'engage'
    }
  ],
  policy: { /* BrandPolicy from step 1 */ }
}
```

### Step 3: AI Generates (following slots)
```json
{
  "ideas": [
    {
      "slot_id": "A",
      "idea_type": "menu",
      "menu_item": { "name": "Eggs Benedict", "category": "BRUNCH" },
      "hook": "Perfekt søndagsbrunch",
      "caption_base": "Nyd vores Eggs Benedict lavet med økologiske æg...",
      "cta_intent": "book"
    },
    {
      "slot_id": "B",
      "idea_type": "vibe",
      "menu_item": null,
      "hook": "Hygge ved åen",
      "caption_base": "Find roen ved åen med en kop økologisk kaffe...",
      "cta_intent": "visit"
    },
    {
      "slot_id": "C",
      "idea_type": "occasion",
      "menu_item": null,
      "hook": "Den perfekte frokostpause",
      "caption_base": "Tag en pause fra travle hverdag med god mad...",
      "cta_intent": "engage"
    }
  ]
}
```

### Step 4: Validation Passes
- ✅ Slot A: Menu item "Eggs Benedict" exists, category "BRUNCH" allowed for breakfast
- ✅ Slot B: Contains verified anchor "ved åen", mentions only allowed "kaffe"
- ✅ Slot C: Mentions allowed "mad", no unverified claims
- ✅ All slots: No forbidden terms ("billig", "hurtig")

---

## Metrics

**Token Impact:**
- Before: ~2,700 tokens
- After: ~2,800 tokens (+100 for explicit constraints)
- Trade-off: +3.7% tokens for deterministic quality

**Code Added:**
- brand-policy-compiler.ts: 250 lines
- strategy-engine.ts: +150 lines (slot creation)
- prompt-builder.ts: +50 lines (slot formatting)
- validators/content-validator.ts: +100 lines (slot compliance)
- **Total**: ~550 lines

**Code Changed:**
- types.ts: +70 lines (BrandPolicy, IdeaSlot, IdeaPlan types)
- smart-generator.ts: ~10 lines (use createIdeaPlan)

---

## Next Steps

1. **Test in Production**: Monitor slot compliance errors
2. **Tune Allowlists**: Adjust offerings extraction keywords
3. **Expand Anchors**: Add more location/interior patterns
4. **Content Pillars**: Integrate into slot strategy (currently unused)
5. **Performance Tracking**: Log which slots get highest engagement

---

## Files Modified

### New Files
- `/supabase/functions/ai-generate-v2/policies/brand-policy-compiler.ts` (250 lines)

### Modified Files
- `/supabase/functions/ai-generate-v2/types.ts` (+70 lines)
- `/supabase/functions/ai-generate-v2/generators/strategy-engine.ts` (+150 lines)
- `/supabase/functions/ai-generate-v2/generators/prompt-builder.ts` (+50 lines)
- `/supabase/functions/ai-generate-v2/generators/smart-generator.ts` (+15 lines)
- `/supabase/functions/ai-generate-v2/validators/content-validator.ts` (+100 lines)

---

*Implementation completed: January 2026*  
*Ready for deployment and testing*
