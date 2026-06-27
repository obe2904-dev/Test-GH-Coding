# Phase 1 Implementation Notes

## Status: In Progress

### Challenge Identified

The current get-quick-suggestions/index.ts has **inter-slot dependencies**:

1. **Slot B depends on Slot A result**:
   - Filters out Slot A's dish from menu
   - Builds deduplication rules based on actual Slot A output
   - Lines 3430-3460

2. **Slot C depends on Slot A result**:
   - Checks if Slot A is menu_item before generating
   - Line 3515: `const hasMenuBasedSlotA = rawSlotA?.content_type === 'menu_item'`

### Original Plan (Blocked)

**Goal**: Merge 3 separate AI calls into 1 unified call

**Problem**: Cannot build unified prompt without knowing Slot A's result first (needed for Slot B deduplication)

### Revised Approach: Two-Stage Strategy

#### Stage 1A: Build Unified Prompt (✅ Complete)
- ✅ Created `buildUnifiedPrompt()` in dagens-forslag-prompt-builder.ts
- ✅ Added import to index.ts
- Function ready to use when dependencies resolved

#### Stage 1B: Pre-Compute Deduplication Rules (Next Step)
Instead of sequential calls, pre-compute what to avoid:

```typescript
// CURRENT (Sequential):
1. Call AI → get Slot A → extract menu_item_name
2. Build avoid rules based on Slot A result
3. Call AI → get Slot B with avoidance

// NEW (Unified):
1. Pre-select diverse dishes from rotation queue
2. Build unified prompt with pre-assigned dishes
3. Call AI once → get all 3 slots with diversity baked in
```

### Implementation Options

#### Option A: Smart Pre-Selection (Recommended)
```typescript
// Before AI call:
const slotADish = rotationQueue[0]  // Oldest dish
const slotBDish = rotationQueue.find(d => d.name !== slotADish.name && d.category !== slotADish.category)
const slotCType = 'behind_scenes'  // Non-menu

// Unified prompt:
const unifiedPrompt = buildUnifiedPrompt(ctx, {
  slotA: 'menu_item',
  slotADish: slotADish.name,  // Pre-assigned
  slotB: 'menu_item',  
  slotBDish: slotBDish.name,  // Pre-assigned
  slotC: slotCType
}, ...)

// One AI call returns 3 structured suggestions
```

**Pros**: True unified call, 66% AI cost reduction  
**Cons**: Requires changing prompt structure to accept pre-assigned dishes

#### Option B: Feature Flag Toggle (Conservative)
```typescript
const USE_UNIFIED_PROMPTS = Deno.env.get('ENABLE_UNIFIED_PROMPTS') === 'true'

if (USE_UNIFIED_PROMPTS) {
  // New unified path
  const unifiedPrompt = buildUnifiedPrompt(...)
  const allSuggestions = await callGeminiArray(...)
  [rawSlotA, rawSlotB, rawSlotC] = allSuggestions
} else {
  // Existing sequential path (current code)
  rawSlotA = await callGemini(buildSlotAPrompt(...))
  rawSlotB = await callGemini(buildSlotBPrompt(...))
  rawSlotC = await callGemini(buildSlotCPrompt(...))
}
```

**Pros**: Safe A/B testing, easy rollback  
**Cons**: Still requires solving deduplication issue

#### Option C: Hybrid Approach (Pragmatic)
Keep Slot A separate, unify B+C:

```typescript
// Step 1: Generate Slot A (menu item)
rawSlotA = await callGemini(buildSlotAPrompt(...))

// Step 2: Generate Slots B+C together (unified)
const unifiedPromptBC = buildUnifiedPromptBC(ctx, {
  slotB: slotBType,
  slotC: slotCType,
  avoidDish: rawSlotA.menu_item_name  // Inject Slot A result
}, ...)

const [rawSlotB, rawSlotC] = await callGeminiArray(unifiedPromptBC)
```

**Pros**: 50% reduction in AI calls (4 → 3 → 2), preserves deduplication  
**Cons**: Not full unification, but significant improvement

### Recommendation

**Proceed with Option C (Hybrid)**:
1. ✅ Keep `buildUnifiedPrompt()` for future use
2. Create `buildUnifiedPromptBC()` for Slots B+C only
3. Reduce from 4 AI calls to 2 (planner + Slot A, then B+C unified)
4. Achieves 50% latency reduction with minimal risk

### Next Steps

1. Create `buildUnifiedPromptBC()` in dagens-forslag-prompt-builder.ts
2. Update index.ts to call Slots B+C together
3. Test with Café Faust (business_id: 38fc71f8-8afb-4702-a4d7-c981e84bb779)
4. Measure:
   - Response time improvement
   - Token usage reduction
   - Output quality maintained

### Success Metrics (Revised)

**Phase 1A Goals** (Hybrid Approach):
- 🎯 **AI calls**: 50% reduction (4 → 2: planner+A, B+C)
- 🎯 **Response time**: <10s (from 12-15s)
- 🎯 **Token usage**: 30% reduction (~14k from 20k)
- 🎯 **Quality**: No regression in suggestion diversity

**Future Phase 1B** (Full Unification):
- Will require slot planner redesign to pre-assign dishes
- Target: 66% reduction (4 → 2: planner+ABC)

---

**Decision Point**: Should we proceed with Option C (Hybrid) or pause to redesign slot planner for full unification?
