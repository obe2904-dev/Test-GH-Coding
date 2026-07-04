# OUTDOOR SEATING BUG FIX

## Problem
Businesses that do NOT have outdoor seating (`has_outdoor_seating` = false or null) were receiving content ideas that referenced outdoor seating, terraces, or outdoor dining.

## Root Cause
The outdoor seating constraint was implemented differently across the codebase:

### get-weekly-strategy
- **Phase 2** (content generation) only blocked outdoor mentions when weather was rainy
- **Phase 1** (strategic brief) had NO outdoor seating check at all
- Strategic angles referencing outdoor seating were generated before any constraint could block them

### get-quick-suggestions  
- The prohibition block only fired when:
  - Business HAS outdoor seating AND
  - Weather is unsuitable
- When business had NO outdoor seating, the prohibition block was empty
- The AI could still suggest outdoor content because no explicit prohibition existed

## Solution

### Fix 1: get-weekly-strategy (phase1.ts)
Added outdoor seating constraints in three locations within Phase 1:

#### Location 1: Step 1 Contextual Analysis Prompt
```typescript
const outdoorSeatingConstraint = (() => {
  const hasOutdoorSeating = (context.weather as any)?.has_outdoor_seating ?? (context.location as any)?.has_outdoor_seating ?? false;
  if (hasOutdoorSeating) return '';
  return `
⚠️ UDESERVERING (kritisk — gælder for hele analysen):
Forretningen HAR IKKE udeservering.
• Nævn ALDRIG udeservering, udendørs servering, terrasse, gårdhave, udeområde eller andre udendørs faciliteter som en faktor eller fordel.
• Generer INGEN angles eller faktorer der relaterer til udendørs oplevelser.
• Fokusér udelukkende på indendørs oplevelser, stemning, menu og service.`;
})();
```

Then injected into prompt:
```typescript
${weatherReframingInstruction}
${outdoorSeatingConstraint}
${identityBlock ? `${identityBlock}\n` : ''}
```

#### Location 2: Step 2 Strategic Brief Prompt (Early Section)
Added same constraint after weather reframing to ensure angles don't reference outdoor seating.

#### Location 3: Step 2 Language Rules Section
Added concise version in language rules to reinforce the constraint.

### Fix 2: get-quick-suggestions (index.ts)
Modified the prohibition block logic (line ~1453) to fire in TWO cases:

**Before:**
```typescript
const outdoorProhibitionBlock = (!outdoorSuitability && hasOutdoorSeating)
  ? `\n🚫 FORBUDT I DAG: Forslå IKKE udeservering...`
  : ''
```

**After:**
```typescript
const outdoorProhibitionBlock = !hasOutdoorSeating
  ? `\n🚫 FORBUDT I DAG: Forretningen HAR IKKE udeservering. Forslå ALDRIG udeservering, udendørs servering, terrasse, gårdhave eller udendørs-relaterede idéer. Fokusér kun på indendørs oplevelser.`
  : (!outdoorSuitability && hasOutdoorSeating)
    ? `\n🚫 FORBUDT I DAG: Forslå IKKE udeservering eller udendørs-ophold som indholds-ide. Vejret kvalificerer IKKE (${weatherInfo}). Gæsterne sidder ikke udenfor — udelad dette fra alle tre slots.`
    : ''
```

## Files Modified
1. `/supabase/functions/_shared/post-helpers/strategy/phase1.ts` (get-weekly-strategy)
2. `/supabase/functions/get-quick-suggestions/index.ts`

## Impact

### When business has outdoor seating (`has_outdoor_seating = true`)
- **Good weather**: No change, outdoor content is allowed
- **Bad weather**: Existing prohibition blocks outdoor content

### When business lacks outdoor seating (`has_outdoor_seating = false`)
- **All weather conditions**: Strong prohibition blocks ALL outdoor content
- AI will:
  - Never generate angles/ideas based on outdoor seating
  - Never mention outdoor facilities in any strategy text
  - Focus exclusively on indoor experiences

## Testing
To test the fix for business ID `69fabd28-83cd-4b60-859e-b1f80c387df9`:

### Weekly Strategy (get-weekly-strategy)
1. Regenerate weekly strategy
2. Verify no ideas/angles reference outdoor seating, terrasse, udendørs servering
3. Check that ideas focus on indoor experiences only

### Quick Suggestions (get-quick-suggestions)  
1. Request dagens forslag (daily suggestions)
2. Verify all 3 slots avoid outdoor references
3. Confirm suggestions focus on indoor experiences

## Additional Notes
- Both fixes use null-coalescing pattern (`?? false`) to ensure null values are treated as false
- The constraint checks multiple sources for `has_outdoor_seating` value as it appears in different objects depending on code path
- The fixes are defensive and explicit to prevent AI hallucination of outdoor facilities
