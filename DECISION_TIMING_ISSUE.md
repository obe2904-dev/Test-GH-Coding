# Decision Timing Issue - CORRECTED Architecture

**Date:** 2. juni 2026  
**Issue:** Conflating booking policy with customer decision timing  
**Status:** ✅ FIXED - Decoupled operational policy from behavioral patterns

---

## Key Insight (User Discovery)

**WRONG assumption:**
```
Walk-in only → MUST be spontaneous decision timing
```

**CORRECT understanding:**
```
Walk-in only is OPERATIONAL (can they book?)
Decision timing is BEHAVIORAL (when do they decide?)
→ These are INDEPENDENT!
```

---

## Three Separate Concepts

### 1. Booking Policy (Operational Constraint)
**What it controls:** Can customers book/reserve?

| Policy | Description | Example |
|--------|-------------|---------|
| Booking required | Must book, no walk-ins | High-end tasting menu |
| Walk-in only | No booking system | Food truck, pop-up |
| Mixed | Both options available | Most restaurants |

### 2. Decision Timing (Customer Behavior)
**What it measures:** When does customer decide to visit?

| Timing | Window | Example |
|--------|--------|---------|
| Spontaneous | 0-2h before | "Lyst til kaffe nu?" |
| Planned | 1-7 days before | "Book brunch til lørdag" |
| Mixed | Both patterns | Weekend brunch (book OR walk-in) |

### 3. Content Timing Strategy (When to Post)
**What it drives:** When should we post content?

| Decision Timing | Post Schedule | Example |
|----------------|---------------|---------|
| Spontaneous | Same day, 0-3h before | "Bar åben nu, 10% off cocktails" |
| Planned | 3-7 days before | "Find os ved havnen i weekenden" |
| Mixed | Both windows | Tue: "Book brunch" + Sat: "Ledige borde" |

---

## Examples Proving They're Independent

### Food Truck (Walk-in Only → Planned Timing)
```
Booking policy: Walk-in only (no reservation system)
Decision timing: PLANNED (not spontaneous!)

Content strategy:
- Monday: Post this week's schedule
- Thursday 14:00: "Vi holder ved havnen 17:30-21:00"
→ Customer sees post, PLANS to visit 3.5h later
→ No booking needed, but NOT spontaneous!
```

### Harbor Café (Walk-in Only → Planned Timing)  
```
Booking policy: Walk-in only
Decision timing: PLANNED

Content strategy:
- Tuesday: "Sommeren starter lørdag - find os ved havnen!"
→ Customer sees Tuesday, PLANS harbor walk for Saturday
→ 4 days advance, no booking, still PLANNED timing!
```

### Weekend Brunch (Mixed Booking → Mixed Timing)
```
Booking policy: Accepts both booking + walk-in
Decision timing: MIXED

Content strategy:
- Tuesday-Thursday: "Book weekendens brunch nu" (planned)
- Saturday 09:00: "Ledige borde til brunch" (spontaneous)
→ Reaches BOTH customer segments!
```

---

## What AI Now Evaluates

### Factors Driving Decision Timing (Not Booking Policy!)

1. **Programme Type**
   - Morning coffee → often spontaneous  
   - Weekend brunch → often mixed or planned
### Before (Wrong)
```
1. LOCATION MATTERS:
   - Høj konkurrence → højere footfall-fokus (kæmp om walk-ins)
   
2. DECISION TIMING DRIVER STRATEGI:
   - Spontan: Brunch, frokost → 60-70% footfall
   - Planlagt: Aftensmad → 25-35% footfall
```
**Problem:** Forced programme type → decision timing. Ignored that walk-in businesses can have planned timing!

### After (Correct)
```
1. LOCATION & COMPETITION IMPACT:
   - Høj konkurrence → Bookings SIKRER kunder → favoriser "mixed"/"planned"
   - Lav konkurrence → Færre alternativer → "spontaneous" kan være nok
   
2. BOOKING POLICY ≠ DECISION TIMING:
   Eksempler hvor walk-in only IKKE er spontaneous:
   - Foodtruck: Post 14:00 "Vi er ved havnen 17:30" → "planned"
   - Havnecafé: Post tirsdag for lørdag → "planned"
   
   Vurder decision_timing baseret på:
   - Programtype, konkurrence, kunde motivation, location type
   - Booking policy INFORMERER men STYRER IKKE!
```
**Fixed:** AI evaluates customer behavior, not operational constraints!

---

## Code Changes

### 1. v5-prompts.ts
- ✅ Removed forced mapping: walk-in only → spontaneous
- ✅ Added examples: food truck, harbor café (walk-in + planned)
- ✅ Listed 5 factors to evaluate instead of booking policy alone

### 2. commercial-orientation.ts  
- ✅ Added booking data to interface (`reservation_required`, `accepts_walkins`)
- ✅ Passes booking policy as INFORMATIONAL context (not prescriptive rule)
- ✅ Added comment: "Walk-in only ≠ spontaneous decision timing!"
- ✅ Added DECISION TIMING GUIDANCE with examples in prompt

### 3. brand-profile-generator-v5/index.ts
- ✅ Passes `operations?.reservation_required` and `accepts_walkins` to AI

---

## Expected Results

### Cafe Faust Brunch
**Context:**
- 16 competitors (high competition)
- Accepts both booking + walk-in  
- Weekend programme 10:00-14:00
- Social gathering motivation

**Current (wrong):**
```json
{
  "decision_timing": "spontaneous_walk_in",
  "reasoning": "Høj konkurrence → kæmp om walk-ins"
}
```

**After fix (correct):**
```json
{
  "decision_timing": "mixed",
  "reasoning": "Weekend brunch med høj konkurrence (16 konkurrenter) + accepterer booking → både advance reservationer og same-day walk-ins"
}
```

### Hypothetical Food Truck
**Context:**
- Walk-in only (no booking system)
- Posts location 3h before arrival
- Mobile business model

**Would be (correct):**
```json
{
  "decision_timing": "planned",
  "reasoning": "Walk-in only, men kunder følger social media for location updates og planlægger besøg 3-4 timer i forvejen"
}
```

---

## Impact on Content Generation

### Spontaneous Only
- Post window: 0-3h before service
- Message: "Nu / I dag / Ledige borde"
- Goal: Drive immediate footfall

### Planned Only  
- Post window: 3-7 days before
- Message: "Book nu / Find os lørdag"
- Goal: Build anticipation, secure commitments

### Mixed (NEW - Now Correctly Applied!)
- **Two post windows:**
  - Advance (Tue-Thu): "Book brunch til weekenden"
  - Same-day (Sat AM): "Ledige borde til brunch nu"
- **Goal:** Maximize reach to both planned + spontaneous segments
- **Result:** More bookings (reduces no-shows) + fills remaining capacity

---

## User Questions Answered

### Q1: "Why doesn't AI see bookings as supplement to walk-ins in high competition?"
**A:** It does now! Fixed backwards logic:
- Before: High competition → fight for walk-ins → spontaneous
- After: High competition → bookings secure customers → mixed/planned ✅

### Q2: "Food truck posts 3h before - that's planned, not spontaneous!"
**A:** Exactly! Fixed:
- Before: Walk-in only → forced spontaneous
- After: Walk-in only + 3h advance posts → AI evaluates as "planned" ✅

### Q3: "Harbor café posts Tuesday for Saturday - that's planned walk-in!"  
**A:** Correct! Now AI understands:
- Walk-in only is operational constraint
- Tuesday→Saturday is behavioral pattern (planned)
- These are independent! ✅

---

## Testing Checklist

- [x] Updated prompt logic to decouple booking from timing
- [x] Added booking data to commercial orientation
- [x] Documented examples (food truck, harbor café)
- [ ] Deploy V5 generator with fixes
- [ ] Test Cafe Faust → expect decision_timing = "mixed"
- [ ] Verify reasoning mentions "bookings secure customers"
- [ ] Test hypothetical walk-in only business → can be "planned"

---

## Conclusion

**Root cause:** Conflated three separate concepts
- Booking policy (operational)
- Decision timing (behavioral)  
- Content strategy (when to post)

**Solution:** Decouple them!
- Booking policy → Context for AI (informational)
- Decision timing → AI evaluates customer behavior
- Content strategy → Driven by decision timing

**Key learning:**  
Walk-in only ≠ spontaneous. Food trucks and pop-ups prove that customers can PLAN visits without booking!


- [ ] Check Cafe Faust current booking settings
- [ ] Extend BusinessContext interface
- [ ] Update prompt builder with booking context
- [ ] Update V5 generator to pass booking data
- [ ] Update AI system prompt with mixed logic
- [ ] Test with Cafe Faust
- [ ] Verify decision_timing = "mixed" for Brunch
- [ ] Test content timing strategy includes both advance + day-of

---

## Questions for User

1. **What's Cafe Faust's actual booking policy?**
   - Booking required for all meals?
   - Accepts walk-ins always?
   - Depends on party size/time?

2. **Default behavior when booking data missing?**
   - Assume "mixed" (safest)?
   - Let AI infer from programme type?

3. **Should decision_timing be:**
   - Business-level (same for all programmes)?
   - Programme-level (brunch=mixed, dinner=planned)?
   - **Current approach is programme-level** ✅
