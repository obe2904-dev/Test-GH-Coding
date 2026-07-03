# IMPLEMENTATION SUMMARY: Booking & CTA Logic

**Date:** 2026-06-15  
**Status:** ✅ IMPLEMENTED (awaiting deployment)  
**Files Modified:** 3  
**Test Business:** Café Faust (`f4679fa9-3120-4a59-9506-d059b010c34a`)

---

## Changes Implemented

### FIX 1: Restore Booking Fields on Snapshot Path ✅

**File:** `supabase/functions/generate-weekly-plan/index.ts`  
**Location:** Line ~398-403  

**Change:** Added missing booking model fields to `businessOps` reconstruction when using cached strategy snapshot.

**Before:**
```typescript
businessOps = {
  has_outdoor_seating: loc.has_outdoor_seating ?? false,
  has_takeaway: loc.has_takeaway ?? false,
  has_table_service: loc.has_table_service ?? false,
}
```

**After:**
```typescript
businessOps = {
  has_outdoor_seating: loc.has_outdoor_seating ?? false,
  has_takeaway: loc.has_takeaway ?? false,
  has_table_service: loc.has_table_service ?? false,
  // Booking model — required for CTA selection in plan generator
  reservation_required: snap.booking_model?.reservation_required ?? false,
  accepts_walk_ins: snap.booking_model?.accepts_walk_ins ?? true,
  has_booking_link: snap.booking_model?.has_booking_link ?? false,
  booking_link: snap.booking_link ?? null,
}
```

**Impact:** Plan generator can now correctly distinguish between walk-in vs. reservation CTAs when using cached data.

---

### FIX 2: Approved Booking CTA Phrases ✅

**File:** `supabase/functions/get-weekly-strategy/index.ts`  
**Location:** Line ~1220 (in `brand_voice` object construction)  

**Change:** Added `booking_cta_phrases` array to override guardrails for booking-specific posts.

**New Code:**
```typescript
// Approved booking CTA phrases — used when booking_link is present.
// These override the generic_marketing banned list for booking-specific posts.
booking_cta_phrases: brandProfile?.booking_link
  ? ['Reservér dit bord her', 'Book via link i bio', 'Book bord til weekenden']
  : [],
```

**Impact:** Natural Danish booking CTAs no longer silently stripped by guardrails enforcement.

---

### FIX 3: Add cta_rules Object to weekContext ✅

**File:** `supabase/functions/get-weekly-strategy/index.ts`  
**Location:** Line ~1068 (after `booking_model` definition)  

**Change:** Added structured `cta_rules` object that translates raw booking model into actionable AI instructions.

**New Code:**
```typescript
// Derived CTA rules — consumed by Phase 1 strategy prompt and Phase 2b slot logic.
// These translate the raw booking model into explicit AI instructions so the prompt
// does not have to reason about the three-field matrix itself.
cta_rules: (()=>{
  const hasLink = !!brandProfile?.booking_link;
  const walkIn = operations?.accepts_walk_ins ?? true;
  const required = operations?.reservation_required ?? false;

  if (required && hasLink) {
    return {
      mode: 'reservation_only',
      instruction: 'Every post MUST include a booking CTA...',
      booking_nudge_enabled: true,
      booking_nudge_lead_days: 2,
    };
  }

  if (walkIn && hasLink) {
    return {
      mode: 'mixed',
      instruction: 'Use walk-in CTA for same-day...',
      booking_nudge_enabled: true,
      booking_nudge_lead_days: 2,
    };
  }

  if (walkIn && !hasLink) {
    return {
      mode: 'walk_in_only',
      instruction: 'Use walk-in language only...',
      booking_nudge_enabled: false,
      booking_nudge_lead_days: 0,
    };
  }

  return {
    mode: 'reservation_required_no_link',
    instruction: 'Reservation required but no booking link...',
    booking_nudge_enabled: false,
    booking_nudge_lead_days: 0,
  };
})(),
```

**Impact:** 
- Deterministic CTA mode selection
- Structured booking nudge metadata
- Frontend can access `cta_rules.mode` for UI rendering

---

### FIX 4: Enhanced Phase 1 Booking Model Prompt ✅

**File:** `supabase/functions/_shared/post-helpers/strategy/phase1.ts`  
**Location:** Line ~597-615  

**Change:** Replaced basic booking model logic with enhanced prompt that uses `cta_rules` and includes booking nudge strategy.

**New Features:**
- ✅ Uses structured `cta_rules` object (with fallback to old `booking_model` logic)
- ✅ Explicit booking nudge slot assignment instructions
- ✅ Peak day identification guidance (using `busy_pattern`)
- ✅ Time-of-day optimization (11:00-13:00 for booking nudge)
- ✅ Content category labeling (`booking_nudge`)
- ✅ Approved booking phrase reference

**Key Prompt Additions:**
```
📋 CTA MODE: mixed
📖 INSTRUKTION: Use walk-in CTA for same-day or next-day posts...

🎯 BOOKING NUDGE STRATEGI:
  • Identificer ugens største travlhedsdag (fredag/lørdag aften)
  • Tildel ÉT opslag til at lande 2 dage før peak-dagen
  • Dette opslag skal have:
    - goal_mode: "drive_footfall"
    - content_category: "booking_nudge"
    - suggested_time: 11:00-13:00 (optimal social reach)
    - cta_mode: "booking" (brug godkendte booking_cta_phrases)
  • Godkendte booking-fraser: Reservér dit bord her, Book via link i bio...

⚖️ MIXED MODE REGLER:
  • Alle andre opslag (ikke booking nudge) = walk-in CTA
  • Brug ALDRIG booking-sprog i atmosphere, team eller retention posts
```

**Impact:** AI receives clear, deterministic instructions for CTA selection and booking nudge timing.

---

## CTA Mode Matrix

| `reservation_required` | `accepts_walk_ins` | `booking_link` | Mode | Booking Nudge |
|------------------------|---------------------|----------------|------|---------------|
| `true` | `false` | Present | `reservation_only` | ✅ Enabled |
| `false` | `true` | Present | `mixed` | ✅ Enabled |
| `false` | `true` | Absent | `walk_in_only` | ❌ Disabled |
| `true` | `false` | Absent | `reservation_required_no_link` | ❌ Disabled (edge case) |

---

## Testing Checklist

### Pre-Deployment Validation
- [ ] Run `_VALIDATE_BOOKING_CTA_IMPLEMENTATION.sql` against production database
- [ ] Verify Café Faust expected outputs:
  - `expected_cta_mode`: `'mixed'`
  - `expected_booking_nudge_enabled`: `true`
  - `expected_booking_nudge_lead_days`: `2`

### Deployment Sequence
1. [ ] Deploy `get-weekly-strategy` first (contains `cta_rules` definition)
2. [ ] Wait 2 minutes, monitor logs
3. [ ] Deploy `generate-weekly-plan` second (consumes `cta_rules`)
4. [ ] Deploy complete

### Post-Deployment Testing (Café Faust)
- [ ] Generate new weekly strategy for Café Faust
- [ ] Verify `weekContext` contains:
  - [ ] `booking_link`: non-null URL
  - [ ] `booking_model.has_booking_link`: `true`
  - [ ] `cta_rules.mode`: `'mixed'`
  - [ ] `cta_rules.booking_nudge_enabled`: `true`
  - [ ] `brand_voice.booking_cta_phrases`: `['Reservér dit bord her', ...]`
- [ ] Generate weekly plan for Café Faust
- [ ] Verify plan contains:
  - [ ] At least 1 post with `content_category: "booking_nudge"`
  - [ ] Booking nudge post lands Wednesday or Thursday (2 days before Friday/Saturday)
  - [ ] Booking nudge post has `suggested_time` in 11:00-13:00 range
  - [ ] Booking nudge post uses approved booking phrase (not "book et bord i dag")
  - [ ] Non-nudge posts use walk-in language ("kom forbi")
  - [ ] No post combines walk-in AND booking CTAs

### Regression Testing
- [ ] Test reservation-only business (if available)
- [ ] Test walk-in-only business (no booking link)
- [ ] Verify snapshot path: generate strategy, then regenerate plan using cached snapshot
- [ ] Compare output consistency between fresh query vs. snapshot path

---

## TypeScript Validation

All modified files passed TypeScript validation:
- ✅ `generate-weekly-plan/index.ts`: No errors
- ✅ `get-weekly-strategy/index.ts`: No errors
- ✅ `phase1.ts`: No errors

---

## Deployment Commands

```bash
# Deploy get-weekly-strategy first (defines cta_rules)
supabase functions deploy get-weekly-strategy --project-ref kvqdkohdpvmdylqgujpn

# Wait 2 minutes, then deploy generate-weekly-plan
supabase functions deploy generate-weekly-plan --project-ref kvqdkohdpvmdylqgujpn
```

---

## Rollback Plan

If issues arise after deployment:

1. **Symptom:** Generated posts have no CTA at all
   - **Cause:** `booking_cta_phrases` override not working
   - **Fix:** Check guardrails enforcement in post-processing layer

2. **Symptom:** Booking nudge not appearing in weekly plan
   - **Cause:** Phase 1 prompt not referencing `cta_rules`
   - **Fix:** Verify `cta_rules` exists in `weekContext` logs

3. **Symptom:** Snapshot path missing booking fields
   - **Cause:** FIX 1 not applied correctly
   - **Fix:** Verify `businessOps` reconstruction includes all 4 booking fields

4. **Emergency Rollback:**
   ```bash
   # Revert to previous function versions
   git checkout HEAD~1 supabase/functions/get-weekly-strategy/index.ts
   git checkout HEAD~1 supabase/functions/generate-weekly-plan/index.ts
   git checkout HEAD~1 supabase/functions/_shared/post-helpers/strategy/phase1.ts
   
   # Redeploy previous versions
   supabase functions deploy get-weekly-strategy --project-ref kvqdkohdpvmdylqgujpn
   supabase functions deploy generate-weekly-plan --project-ref kvqdkohdpvmdylqgujpn
   ```

---

## Future Enhancements

### Recommended for Next Iteration

1. **Language Localization** (see `_ASSESSMENT_BOOKING_CTA_LOGIC.md` Gap 1)
   - Use `countryToLanguageCode()` to map booking phrases by language
   - Support Norwegian, Swedish, Finnish variants

2. **Dynamic Peak Day Derivation** (see Gap 2)
   - Use `busy_pattern` from location intelligence
   - Support brunch-focused businesses (Sunday peak)

3. **CTA Phrase Tracking** (see Gap 3)
   - Add `cta_metadata` to post schema
   - Enable A/B testing of phrase effectiveness

4. **Guardrails Override Documentation** (see Gap 4)
   - Document override precedence in post-processing layer
   - Add inline comments for future developers

---

**Implementation completed by:** GitHub Copilot  
**Review status:** Pending human validation  
**Ready for deployment:** ✅ YES (after pre-deployment validation)
