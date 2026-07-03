# ASSESSMENT: Booking & CTA Logic Implementation

**Date:** 2026-06-15  
**Source:** `/Users/olebaek/Downloads/booking-cta-logic.instructions.md`  
**Functions:** `get-weekly-strategy/index.ts` + `generate-weekly-plan/index.ts`  
**Test Business:** Café Faust (`f4679fa9-3120-4a59-9506-d059b010c34a`)

---

## Executive Summary

The booking CTA logic instructions provide a **well-structured, comprehensive fix** for a critical gap in the content generation pipeline. The implementation addresses four distinct issues across two Edge Functions, with clear technical specifications and proper sequencing.

**Overall Assessment:** ✅ **READY FOR IMPLEMENTATION**

The instructions are:
- Technically sound
- Properly sequenced
- Well-documented with clear "why" explanations
- Include validation checklist
- Address both data bugs and prompt gaps

---

## Current State Analysis

### Data Model

The booking model is stored across two tables:

```
business_brand_profile
  └── booking_link: VARCHAR | NULL              ← URL string

business_operations
  └── reservation_required: BOOLEAN (default FALSE)
  └── accepts_walk_ins: BOOLEAN (default TRUE)
```

This creates a **2×2 matrix** of booking scenarios:

| Scenario | `reservation_required` | `accepts_walk_ins` | `booking_link` | CTA Mode |
|----------|------------------------|-----------------------|----------------|-----------|
| 1 | `true` | `false` | Present | `reservation_only` |
| 2 | `false` | `true` | Present | `mixed` |
| 3 | `false` | `true` | Absent | `walk_in_only` |
| 4 | `true` | `false` | Absent | `reservation_required_no_link` (edge case) |

### Current Bugs Identified

#### Bug 1: Data Loss on Snapshot Path (generate-weekly-plan)
**Location:** Line ~398 in `generate-weekly-plan/index.ts`

**Current Code:**
```typescript
businessOps = {
  has_outdoor_seating: loc.has_outdoor_seating ?? false,
  has_takeaway: loc.has_takeaway ?? false,
  has_table_service: loc.has_table_service ?? false,
}
```

**Issue:** When `hasSnap === true`, the function reconstructs `businessOps` from the snapshot's location block, but the booking model fields are stored at the **snapshot root level** (`snap.booking_model` and `snap.booking_link`), not in `snap.location`. This causes `reservation_required`, `accepts_walk_ins`, and `booking_link` to be **silently dropped**.

**Impact:** The plan generator cannot distinguish between walk-in vs. reservation CTAs when using cached strategy data.

---

#### Bug 2: "book et bord i dag" Banned by Guardrails
**Location:** `business_brand_profile.voice_guardrails.avoid_patterns.strip_from_output.generic_marketing`

**Issue:** The natural Danish booking CTA phrase `"book et bord i dag"` is currently in the banned phrase list under generic marketing fluff. This means the AI's most natural booking CTA gets **silently stripped** during post-processing.

**Impact:** Booking-capable businesses end up with no CTA at all, or fall back to generic "kom forbi" even when they require reservations.

---

#### Gap 3: No Explicit CTA Rules in weekContext
**Location:** `get-weekly-strategy/index.ts` around line 1052-1066

**Issue:** The `weekContext` object currently includes raw `booking_model` data (3 boolean flags), but doesn't translate this into **actionable prompt instructions**. The AI must re-reason the 2×2 matrix on every generation, leading to inconsistent CTA selection.

**Impact:** 
- Inconsistent CTA types across posts
- No structured booking nudge logic
- Prompt bloat from redundant reasoning

---

#### Gap 4: No Booking Nudge in Phase 1 Slot Assignment
**Location:** `_shared/post-helpers/weekly-strategy-generator.ts` (referenced in `get-weekly-strategy/index.ts`)

**Issue:** The Phase 1 strategy prompt has no explicit instruction to:
- Identify peak footfall days (Friday/Saturday)
- Assign a booking nudge post 2+ days before peak
- Use approved booking CTA phrases (not walk-in language)

**Impact:** Booking-capable businesses get random CTAs across all posts, with no strategic timing for reservation-driving content.

---

## Proposed Fixes Assessment

### FIX 1: Restore Booking Fields on Snapshot Path ✅ APPROVED

**Change Type:** Data bug fix  
**Risk Level:** 🟢 Low (additive, no breaking changes)  
**Complexity:** Simple

**Proposed Code:**
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

**Assessment:**
- ✅ Correct source: reads from `snap.booking_model` (not `loc`)
- ✅ Safe defaults: matches database defaults
- ✅ Maintains backward compatibility: adds fields without removing existing ones
- ✅ Type consistency: boolean flags + nullable string for link

**Recommendation:** **IMPLEMENT AS-IS**

---

### FIX 2: Approved Booking CTA Override ✅ APPROVED WITH NOTES

**Change Type:** Guardrails enhancement  
**Risk Level:** 🟡 Medium (modifies guardrails enforcement)  
**Complexity:** Simple

**Proposed Code:**
```typescript
// Approved booking CTA phrases — used when booking_link is present.
// These override the generic_marketing banned list for booking-specific posts.
booking_cta_phrases: brandProfile?.booking_link
  ? ['Reservér dit bord her', 'Book via link i bio', 'Book bord til weekenden']
  : [],
```

**Assessment:**
- ✅ Correct placement: inside `brand_voice` object at same level as `voice_guardrails`
- ✅ Conditional logic: only populated when `booking_link` exists
- ✅ Natural Danish: phrases are idiomatic and customer-friendly
- ⚠️ Hardcoded phrases: may need localization for non-DK businesses

**Recommendations:**
1. **Short-term:** Implement as-is for Danish businesses
2. **Future enhancement:** Add language-specific phrase mapping:
   ```typescript
   const BOOKING_CTA_PHRASES: Record<string, string[]> = {
     da: ['Reservér dit bord her', 'Book via link i bio', 'Book bord til weekenden'],
     no: ['Reserver bordet ditt her', 'Book via lenke i bio', 'Book bord til helgen'],
     sv: ['Boka ditt bord här', 'Boka via länk i bio', 'Boka bord till helgen'],
     // etc.
   }
   ```

**Recommendation:** **IMPLEMENT AS-IS, FLAG FOR FUTURE LOCALIZATION**

---

### FIX 3: Add cta_rules to weekContext ✅ APPROVED

**Change Type:** Strategic enhancement  
**Risk Level:** 🟢 Low (additive, extends existing object)  
**Complexity:** Medium

**Proposed Code Structure:**
```typescript
cta_rules: {
  mode: 'reservation_only' | 'mixed' | 'walk_in_only' | 'reservation_required_no_link',
  instruction: string,  // AI-readable prompt instruction
  booking_nudge_enabled: boolean,
  booking_nudge_lead_days: number,
}
```

**Assessment:**
- ✅ **Correct architecture:** Separates raw data (`booking_model`) from derived rules (`cta_rules`)
- ✅ **Reduces prompt complexity:** AI follows deterministic rules instead of re-reasoning matrix
- ✅ **Type-safe modes:** Enum-style strings enable frontend integration
- ✅ **Strategic metadata:** `booking_nudge_lead_days` enables Phase 1 slot timing logic
- ✅ **Defensive edge case handling:** Includes `reservation_required_no_link` mode for data quality issues

**Logic Validation:**

| Input State | Derived Mode | Correct? |
|-------------|-------------|----------|
| `required=true`, `walkIn=false`, `hasLink=true` | `reservation_only` | ✅ |
| `required=false`, `walkIn=true`, `hasLink=true` | `mixed` | ✅ |
| `required=false`, `walkIn=true`, `hasLink=false` | `walk_in_only` | ✅ |
| `required=true`, `walkIn=false`, `hasLink=false` | `reservation_required_no_link` | ✅ (edge case) |

**Recommendation:** **IMPLEMENT AS-IS**

---

### FIX 4: Inject CTA Rules into Phase 1 Prompt ✅ APPROVED WITH NOTES

**Change Type:** Prompt enhancement  
**Risk Level:** 🟡 Medium (modifies AI behavior)  
**Complexity:** Medium

**Proposed Template Addition:**
```
## BOOKING & CTA RULES
Mode: {{cta_rules.mode}}
Instruction: {{cta_rules.instruction}}
Booking nudge enabled: {{cta_rules.booking_nudge_enabled}}
Lead days for booking nudge: {{cta_rules.booking_nudge_lead_days}}
Booking link available: {{booking_model.has_booking_link}}

If booking_nudge_enabled is true:
- Identify the highest-footfall day this week using busy_pattern and the day-of-week.
  For most hospitality businesses this will be Friday or Saturday evening.
- Assign ONE post slot to land {{booking_nudge_lead_days}} days before that peak day.
- Label this post idea with goal_mode: "drive_footfall" and content_category: "booking_nudge".
- The suggested_time for this post should be 11:00–13:00 (peak social media reach window).
- This post must use one of booking_cta_phrases from brand_voice — not generic walk-in language.

If mode is "mixed":
- All other posts in the week default to walk-in CTA unless they are the designated booking nudge.
- Do not use booking language in atmosphere, team, or retention posts.

If mode is "walk_in_only":
- No post in this week should reference booking or reservations in any form.
```

**Assessment:**
- ✅ **Structured instructions:** Clear deterministic rules for each mode
- ✅ **Strategic timing logic:** Explicitly assigns booking nudge 2 days before peak
- ✅ **Content category integration:** Uses existing `goal_mode` and `content_category` taxonomy
- ✅ **Time-of-day optimization:** 11:00-13:00 aligns with social media best practices
- ⚠️ **Assumes Friday/Saturday peak:** May not apply to all business types (e.g., cafés may peak on Sunday brunch)

**Recommendations:**
1. **Short-term:** Implement as-is with Friday/Saturday default
2. **Future enhancement:** Use `busy_pattern` from location intelligence to derive peak day dynamically:
   ```typescript
   const peakDay = locationIntel.busy_pattern?.find(d => d.score === 'high')?.day || 'friday'
   ```

**Location Validation:**
The instructions reference `weekly-strategy-generator.ts`, but the actual prompt template location needs verification. Likely injection points:
1. `_shared/post-helpers/weekly-strategy-generator.ts` (Phase 1 system prompt)
2. `get-weekly-strategy/index.ts` (weekContext preprocessing)

**Action Required:** Verify exact template file before implementation.

**Recommendation:** **IMPLEMENT WITH PEAK DAY VERIFICATION**

---

## Implementation Sequence Validation

The instructions specify this order:

1. **FIX 1** (snapshot data bug)
2. **FIX 2** (guardrails repair)
3. **FIX 3** (cta_rules object)
4. **FIX 4** (prompt injection)

**Assessment:** ✅ **CORRECT SEQUENCE**

**Rationale:**
- FIX 1 is independent (pure data fix)
- FIX 2 must precede FIX 3 (approved phrases must exist before cta_rules references them)
- FIX 3 must precede FIX 4 (cta_rules object must exist before prompt references it)
- Dependencies are strictly sequential with no circular references

---

## Testing Checklist Validation

The instructions provide this checklist for Café Faust:

- [ ] `cta_rules.mode` resolves to `"mixed"` (has booking link + accepts walk-ins)
- [ ] `weekContext.booking_cta_phrases` contains `['Reservér dit bord her', 'Book via link i bio', 'Book bord til weekenden']`
- [ ] Snap path `businessOps` includes `reservation_required`, `accepts_walk_ins`, `booking_link`
- [ ] At least one post idea per week has `content_category: "booking_nudge"` when `booking_nudge_enabled: true`
- [ ] The booking nudge post lands Wednesday or Thursday (2 days before Friday peak)
- [ ] Non-nudge posts use walk-in language, not booking CTA
- [ ] "book et bord i dag" does not appear in any generated caption

**Assessment:** ✅ **COMPREHENSIVE AND TESTABLE**

**Additional Test Cases Recommended:**

1. **Reservation-only business** (mode: `reservation_only`)
   - Verify ALL posts include booking CTA
   - Verify no walk-in language appears

2. **Walk-in only business** (mode: `walk_in_only`)
   - Verify NO booking CTAs appear
   - Verify no "reservér" language

3. **Edge case: reservation required but no link** (mode: `reservation_required_no_link`)
   - Verify fallback to "ring og reservér" or no CTA
   - Verify no false promises about online booking

4. **Snapshot path regression** (hasSnap = true)
   - Verify booking fields survive reconstruction
   - Compare output with fresh query path (hasSnap = false)

---

## Risk Assessment

### 🟢 Low Risk Areas
- FIX 1: Pure data bug fix, additive only
- FIX 3: Extends existing object, no breaking changes
- All fixes are backward compatible (no field removals)

### 🟡 Medium Risk Areas
- FIX 2: Modifies guardrails enforcement logic
  - **Mitigation:** Only affects businesses with `booking_link` present
  - **Validation:** Test with and without booking link
  
- FIX 4: Changes AI prompt behavior
  - **Mitigation:** Structured rules reduce AI variability
  - **Validation:** Generate 10+ weeks of content for Café Faust, verify consistency

### 🔴 High Risk Areas
**NONE IDENTIFIED**

---

## Gaps & Recommendations

### Gap 1: Language Localization ⚠️
**Issue:** `booking_cta_phrases` are hardcoded in Danish  
**Impact:** Non-DK businesses (Norway, Sweden, Finland) will see Danish CTAs  
**Recommendation:** Add language mapping using existing `countryToLanguageCode()` helper

**Suggested Fix:**
```typescript
const businessLang = countryToLanguageCode(locationData?.country || 'DK')
const BOOKING_CTA_BY_LANG: Record<string, string[]> = {
  da: ['Reservér dit bord her', 'Book via link i bio', 'Book bord til weekenden'],
  no: ['Reserver bordet ditt her', 'Book via lenke i bio', 'Book bord til helgen'],
  sv: ['Boka ditt bord här', 'Boka via länk i bio', 'Boka bord till helgen'],
  fi: ['Varaa pöytä täältä', 'Varaa bio-linkin kautta', 'Varaa pöytä viikonlopuksi'],
}
booking_cta_phrases: brandProfile?.booking_link
  ? (BOOKING_CTA_BY_LANG[businessLang] || BOOKING_CTA_BY_LANG.da)
  : [],
```

---

### Gap 2: Peak Day Derivation ⚠️
**Issue:** FIX 4 assumes Friday/Saturday is peak day  
**Impact:** May misallocate booking nudge for brunch-focused or Sunday-heavy businesses  
**Recommendation:** Use `busy_pattern` from location intelligence or business_programmes

**Suggested Enhancement:**
```typescript
const peakDay = (()=>{
  // 1. Check if business_programmes has explicit peak data
  const programmeSignal = businessProgrammes?.find(p => p.confidence === 'high')
  if (programmeSignal?.peak_days?.length) return programmeSignal.peak_days[0]
  
  // 2. Fallback to opening_hours busy_pattern
  const busyPatternSignal = weekContext.busy_pattern?.find(d => d.level === 'peak')
  if (busyPatternSignal) return busyPatternSignal.day
  
  // 3. Default to Friday for dinner/all_day, Sunday for brunch
  return primaryServicePeriod === 'brunch_only' ? 'sunday' : 'friday'
})()

const bookingNudgeDay = (() => {
  const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(peakDay)
  const leadDays = cta_rules.booking_nudge_lead_days
  const nudgeIndex = (dayIndex - leadDays + 7) % 7
  return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][nudgeIndex]
})()
```

---

### Gap 3: CTA Phrase Tracking 📊
**Issue:** No telemetry for which CTA phrase was used  
**Impact:** Cannot A/B test phrase effectiveness  
**Recommendation:** Add `cta_phrase_used` to post metadata

**Suggested Addition to Post Schema:**
```typescript
interface PostIdea {
  // ... existing fields
  cta_metadata?: {
    mode: string           // e.g., 'mixed', 'reservation_only'
    phrase_used: string    // e.g., 'Reservér dit bord her'
    is_booking_nudge: boolean
  }
}
```

---

### Gap 4: Guardrails Override Documentation 📝
**Issue:** No documentation of how `booking_cta_phrases` overrides `voice_guardrails.never_say`  
**Impact:** Future developers may not understand override precedence  
**Recommendation:** Add inline comment in guardrails enforcement code

**Example:**
```typescript
// Guardrails enforcement (in post generation)
const isBanned = (phrase: string) => {
  const guardrails = weekContext.brand_voice.voice_guardrails
  const approvedBookingPhrases = weekContext.brand_voice.booking_cta_phrases || []
  
  // CRITICAL: Booking CTAs override generic_marketing bans when booking_link exists
  if (approvedBookingPhrases.some(approved => phrase.includes(approved))) {
    return false  // Allow approved booking phrase even if in banned list
  }
  
  return guardrails.never_say.some(banned => phrase.includes(banned))
}
```

---

## Café Faust Validation Query

To verify current state before implementation:

```sql
SELECT
  b.id AS business_id,
  b.name AS business_name,
  bp.booking_link,
  bo.reservation_required,
  bo.accepts_walk_ins,
  -- Expected cta_rules.mode: 'mixed' (has link + accepts walk-ins)
  CASE
    WHEN bo.reservation_required AND bp.booking_link IS NOT NULL THEN 'reservation_only'
    WHEN bo.accepts_walk_ins AND bp.booking_link IS NOT NULL THEN 'mixed'
    WHEN bo.accepts_walk_ins AND bp.booking_link IS NULL THEN 'walk_in_only'
    WHEN bo.reservation_required AND bp.booking_link IS NULL THEN 'reservation_required_no_link'
    ELSE 'unknown'
  END AS expected_cta_mode,
  -- Check if "book et bord i dag" is in banned phrases
  bp.voice_guardrails #>> '{avoid_patterns,strip_from_output,generic_marketing}' AS current_banned_phrases
FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN business_operations bo ON bo.business_id = b.id
WHERE b.id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

**Expected Result:**
- `booking_link`: `'https://...'` (non-null)
- `reservation_required`: `false`
- `accepts_walk_ins`: `true`
- `expected_cta_mode`: `'mixed'`
- `current_banned_phrases`: Should contain `'book et bord i dag'`

---

## Implementation Checklist

### Pre-Implementation
- [ ] Run validation query against Café Faust
- [ ] Verify current guardrails structure in DB
- [ ] Backup current `get-weekly-strategy` and `generate-weekly-plan` functions
- [ ] Create test plan for all 4 CTA modes

### FIX 1: Snapshot Data Bug
- [ ] Locate line ~398 in `generate-weekly-plan/index.ts`
- [ ] Apply booking fields to `businessOps` reconstruction
- [ ] Verify TypeScript types (if any)
- [ ] Test with `hasSnap = true` and `hasSnap = false` paths

### FIX 2: Guardrails Repair
- [ ] Locate `voice_guardrails` assembly in `get-weekly-strategy/index.ts` (around line 1186)
- [ ] Add `booking_cta_phrases` field inside `brand_voice` object
- [ ] Verify conditional logic: only populated when `booking_link` exists
- [ ] Consider adding language localization (see Gap 1)

### FIX 3: CTA Rules Object
- [ ] Locate `weekContext` construction in `get-weekly-strategy/index.ts` (around line 1052)
- [ ] Add `cta_rules` block after `booking_model` (around line 1067)
- [ ] Implement 4-mode logic with all conditional branches
- [ ] Add edge case handling for `reservation_required_no_link`
- [ ] Verify fallback defaults

### FIX 4: Prompt Injection
- [ ] **CRITICAL:** Locate actual prompt template file (verify `weekly-strategy-generator.ts` location)
- [ ] Add `BOOKING & CTA RULES` section to Phase 1 prompt
- [ ] Inject `cta_rules` fields using template interpolation
- [ ] Add booking nudge slot assignment logic
- [ ] Consider peak day derivation enhancement (see Gap 2)

### Post-Implementation
- [ ] Deploy to staging/dev environment first
- [ ] Generate 5 weekly strategies for Café Faust
- [ ] Validate all 7 test checklist items
- [ ] Test edge cases: reservation-only, walk-in-only, no-link
- [ ] Verify no regression in non-booking businesses
- [ ] Check guardrails enforcement: confirm approved phrases not stripped
- [ ] Review generated CTAs for naturalness and correctness

### Production Deployment
- [ ] Code review by second developer
- [ ] Final staging validation
- [ ] Deploy `get-weekly-strategy` first (contains data definitions)
- [ ] Wait 5 minutes, monitor logs
- [ ] Deploy `generate-weekly-plan` second (consumes data)
- [ ] Monitor first production run for Café Faust
- [ ] Check customer-facing posts for correct CTAs

---

## Final Recommendation

**Status:** ✅ **APPROVE FOR IMPLEMENTATION**

The booking CTA logic instructions are **production-ready** with the following conditions:

### Must-Have Before Merge
1. ✅ All 4 fixes implemented in sequence
2. ✅ Café Faust validation (7-item checklist)
3. ✅ Test all 4 CTA modes (reservation-only, mixed, walk-in-only, edge case)

### Should-Have Before Merge
1. ⚠️ Language localization for `booking_cta_phrases` (see Gap 1)
2. ⚠️ Peak day derivation from `busy_pattern` (see Gap 2)
3. ⚠️ Verify exact prompt template file location (FIX 4)

### Nice-to-Have (Future Iteration)
1. 📊 CTA phrase tracking metadata (see Gap 3)
2. 📝 Guardrails override documentation (see Gap 4)
3. 🧪 A/B testing framework for CTA phrase effectiveness

---

## Questions for Implementer

1. **Prompt Template Location:**  
   Where exactly is the Phase 1 strategy prompt template? The instructions reference `weekly-strategy-generator.ts`, but need to confirm the exact injection point.

2. **Language Support:**  
   Should we implement language localization for `booking_cta_phrases` now, or defer to a future iteration?

3. **Peak Day Logic:**  
   Should we use the hardcoded Friday/Saturday assumption, or derive from `busy_pattern` / `business_programmes`?

4. **Testing Scope:**  
   Do we have access to businesses with all 4 CTA modes for comprehensive testing, or should we focus only on Café Faust (`mixed` mode)?

5. **Deployment Strategy:**  
   Should we deploy behind a feature flag first, or directly to production for all businesses?

---

**Assessment prepared by:** GitHub Copilot  
**Review status:** Pending human validation  
**Next steps:** Address questions above, then proceed with implementation sequence
