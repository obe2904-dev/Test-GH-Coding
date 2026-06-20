# Strategy-Aware Day Selection Fix

**Date**: 2026-06-07  
**Status**: ✅ **DEPLOYED**  
**Issue**: Phase 2a was ignoring strategic focus and using hardcoded day templates

---

## Problem Identified

User generated a strategy with clear weekend focus:
```
"Fokus: Frokostbesøg i weekenden"  
(Focus: Weekend lunch visits)
```

**Expected distribution**: Posts clustered Thu-Sun to build momentum toward weekend

**Actual distribution**: 
- Monday 9:00 (brand post)
- Tuesday 7:00 (menu post)
- **Wed-Fri: EMPTY** ❌
- Saturday 10:00 (menu post)
- Sunday 15:00 (menu post)

### Root Cause

Phase 2a had **hardcoded timing_window preferences** from slot system:
```typescript
Slot A: 'Fri-Sat 14:00'  // Weekend driver
Slot B: 'Wed-Thu 11:00'  // Weekday support  
Slot C: 'Mon 09:00'      // Brand builder
Slot D: 'any'            // Flexible
```

These timing windows **deterministically assigned days** regardless of what the strategy said:
1. AI generated strategic angles
2. Slots applied timing_window templates
3. **Hardcoded preferences overrode strategic narrative**

Even when strategy said "weekend focus", the system was using:
> "Mon-Tue-Sat-Sun" (from slot templates)

Instead of strategic clustering:
> "Thu-Fri-Sat-Sun" (building toward weekend)

---

## Solution Implemented

### 1. Added Strategic Context to Phase 2a Prompt

**Before**:
```typescript
const prompt = `Du er marketing-chef. Fordel ${targetPostCount} posts over ugen.

FOKUS-OMRÅDER: ${anglesSummary}
TILGÆNGELIGE DAGE: ${availableDays.join(', ')}
...`
```

**After**:
```typescript
const strategicContext = weekSummary 
  ? `\n\nSTRATEGISK KONTEKST:\n"${weekSummary}"\n${competitiveAdvantage ? `\nKoncurrencefordel: "${competitiveAdvantage}"\n` : ''}\n⚠️ KRITISK: Vælg dage der understøtter denne strategi. Hvis strategien fokuserer på weekend, cluster posts torsdag-søndag. Hvis strategien handler om hverdage, brug mandag-fredag. Skab et narrativ-flow med posts der bygger på hinanden.`
  : '';

const prompt = `Du er marketing-chef. Fordel ${targetPostCount} posts over ugen.

FOKUS-OMRÅDER: ${anglesSummary}
${strategicContext}
TILGÆNGELIGE DAGE: ${availableDays.join(', ')}
...`
```

Now Gemini sees:
- Week summary (the strategic narrative)
- Competitive advantage
- **Explicit instructions to cluster posts based on strategic focus**

### 2. Trust AI's Day Selection

**Before**:
```typescript
suggested_day: assignedDay, // calendar-aware, overrides AI pick
```

**After**:
```typescript
// STRATEGY-AWARE DAY SELECTION:
// Trust AI's strategic day choice IF it's valid and available.
// Only fall back to slot timing preferences if AI's choice is invalid.
const aiDay = p.suggested_day;
const isAiDayValid = aiDay && availableDays.includes(aiDay);
const finalDay = isAiDayValid ? aiDay : slotPreferredDay;

if (isAiDayValid && aiDay !== slotPreferredDay) {
  console.log(`[Phase 2a] AI chose ${aiDay} for "${p.angle_focus}" (slot preference was ${slotPreferredDay}) - trusting strategic clustering`);
}

suggested_day: finalDay, // Trust AI's strategic clustering when valid
```

Now:
- ✅ AI picks days based on strategic narrative
- ✅ Slot timing preferences are **fallback only** (if AI picks invalid day)
- ✅ Logging shows when AI overrides slot preferences

### 3. Added Clustering Instructions

New prompt rule:
```
• Vælg suggested_day baseret på strategisk timing (byg narrativ-momentum mod hovedfokus)
```

Translation: *"Choose suggested_day based on strategic timing (build narrative momentum toward main focus)"*

---

## Expected Behavior After Fix

### Scenario: Weekend Lunch Focus

**Strategy says**: "Fokus: Frokostbesøg i weekenden"

**AI should cluster**:
- **Thursday**: Build anticipation ("Her er hvad vi serverer i weekenden")
- **Friday**: Final push ("Klar til weekend-frokost i morgen?")
- **Saturday**: Main weekend lunch post
- **Sunday**: Continuation/alternative

### Scenario: Weekday Dinner Focus

**Strategy says**: "Fokus: Hverdagsaftener"

**AI should cluster**:
- **Monday-Friday**: Concentrated weekday presence
- **Weekend**: Minimal or none

---

## Architecture Changes

### Phase 2a Input (Before)
- Focus areas + weights
- Available days
- Content type rules
- Platform list

### Phase 2a Input (After)
- Focus areas + weights
- Available days  
- Content type rules
- Platform list
- **✨ Week summary (strategic narrative)**
- **✨ Competitive advantage**
- **✨ Clustering instructions**

### Day Assignment Logic (Before)
```
Slot timing_window → Deterministic day preference → Override AI
```

### Day Assignment Logic (After)
```
AI reads strategy → Picks days intelligently → Used if valid
  ↓ (only if AI picks invalid day)
Slot timing_window → Fallback preference
```

---

## Testing

**To validate the fix**:

1. Generate new strategy for Cafe Faust (business_id f4679fa9-3120-4a59-9506-d059b010c34a)
2. Check Week 24 (8-14 June 2026) with weekend focus strategy
3. Expected post distribution:
   - **Thu-Sun cluster** (not Mon-Tue-Sat-Sun)
   - Posts build narrative momentum
   - No arbitrary Wed-Fri gaps

**Monitoring**:
Check function logs for:
```
[Phase 2a] AI chose 2026-06-12 for "Weekend brunch" (slot preference was 2026-06-09) - trusting strategic clustering
```

This indicates AI is making strategic day choices different from slot templates.

---

## Impact

### ✅ Benefits
- **Strategic coherence**: Days match narrative focus
- **Better storytelling**: Posts build momentum toward key days
- **Flexible clustering**: Weekend focus → weekend posts; weekday focus → weekday posts
- **No arbitrary gaps**: AI fills the week intelligently

### ⚠️ Risks
- **AI day picking quality**: If Gemini picks poorly, strategies may be scattered
- **Validation needed**: Monitor first few strategies to ensure quality maintained

### 🔄 Backward Compatibility
- Slot timing_window preferences still exist as **fallback**
- If AI fails to pick valid days, system reverts to old behavior
- No breaking changes to database schema or API

---

## Files Modified

1. **[phase2a.ts](supabase/functions/_shared/post-helpers/strategy/phase2/phase2a.ts)**
   - Lines ~30-70: Added strategic context to prompt
   - Lines ~350-380: Changed day selection to trust AI when valid
   - Added logging for AI override decisions

---

## Deployment

**Deployed**: 2026-06-07  
**Bundle size**: 700kB (0.2kB increase from strategic context)  
**Production endpoint**: https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy

---

## Related Issues

This fix addresses the gap between:
- **Phase 1** (Strategic Brief): "Weekend focus" 
- **Phase 2a** (Day Selection): Ignoring focus, using templates
- **Phase 2b** (Content Details): Writing content for wrong days

Now all phases align with the strategic narrative.

---

**Status**: ✅ Deployed, awaiting validation with next strategy generation
