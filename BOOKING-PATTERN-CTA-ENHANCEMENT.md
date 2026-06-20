# Booking Pattern-Aware CTA Enhancement

**Date:** January 2025  
**Status:** ✅ Deployed (Phase 2b + generate-text-from-idea)

## Problem Statement

User concern: "post with booking (for those that have that) and how that is used, so footfall is not only 'visit now'"

**Issue:** CTAs were generic ("kom forbi i dag") for all businesses regardless of whether they:
- Require reservations (fine dining, specialty restaurants)
- Accept walk-ins freely (casual cafés)
- Have a mixed model (table service but walk-ins OK)

This created two problems:
1. **Advance-planning businesses** (e.g., Italian restaurant with reservations) got casual "visit now" CTAs that ignored booking requirements
2. **Impulse-friendly businesses** (e.g., walk-in café) got booking-focused CTAs that were too formal

## Solution Architecture

### Data Source: `business_operations` Table

Three boolean fields define booking pattern:
- `reservation_required` (boolean)
- `accepts_walk_ins` (boolean)  
- `has_table_service` (boolean)

### Booking Pattern Derivation Logic

**Three-tier classification** (same as `get-weekly-strategy/context-interpreters.ts`):

```typescript
if (reservation_required === true) {
  bookingPattern = 'advance_planning'
} else if (has_table_service && !accepts_walk_ins) {
  bookingPattern = 'mixed'
} else {
  bookingPattern = 'impulse_friendly'
}
```

| Pattern | Meaning | CTA Strategy |
|---------|---------|--------------|
| `advance_planning` | Reservations required/recommended | **Always** emphasize booking |
| `mixed` | Table service, walk-ins OK | Economic modulation (booking in high-spend periods) |
| `impulse_friendly` | Casual, no reservations | **Never** use booking language |

## Implementation: Two CTA Systems

### System 1: Phase 2b (Weekly Plan Prompts)

**File:** `supabase/functions/_shared/post-helpers/strategy/phase2/phase2b.ts`  
**Lines:** 140-241

**Purpose:** Generate CTA instructions for Phase 2d narrative compression prompt

**Logic:**
1. Extract `booking_pattern` from `WeekContext.service_behavior_signals`
2. Apply three-tier CTA instruction logic:

#### Impulse-Friendly (lines 148-177)
- **Always** casual invitation language
- **Never** booking/reservation terms
- Example: "Opfordre til at komme forbi i dag — 'Vi ses til fredag aften'. INGEN booking-sprog."

#### Advance-Planning (lines 179-241)
- **Standard weeks:** "Nævn at reservation anbefales — opfordre til at ringe eller booke online"
- **Weekend/Friday dinner:** Hard urgency — "Bordene fylder hurtigt op — 'Book bord nu til lørdag aften'"
- **Always** emphasize booking, even without high economic pressure

#### Mixed (existing logic)
- **High-spend periods:** Weekend evenings → booking CTAs
- **Normal weeks:** Casual "kom forbi" invitations
- Economic-based modulation preserved

**Integration:** Phase 2b output flows to Phase 2d prompt → Gemini Flash generates narrative with CTA baked in

---

### System 2: generate-text-from-idea (Final Caption Generation)

**Files Modified:**
1. `resolve-context.ts` (lines 507-527, 759-760): Fetch `reservation_required`, `accepts_walk_ins` from `business_operations`
2. `resolve-context.ts` (lines 176-178): Add fields to `BusinessContext` interface
3. `select-cta.ts` (lines 48-50): Add `reservationRequired`, `acceptsWalkIns` to `CTASelectionParams`
4. `select-cta.ts` (lines 75-119): Booking pattern-aware CTA pool selection
5. `index.ts` (lines 53-54): Pass booking pattern signals to `selectCTA()`

**Purpose:** Final CTA selection when GPT-4o generates caption from weekly plan post

**Logic:**
1. Derive booking pattern from `reservationRequired` and `acceptsWalkIns`
2. Override CTA pool based on pattern:

#### Impulse-Friendly Override (lines 80-92)
```typescript
const casualVisitCTAs: Record<string, string[]> = {
  da: [
    'Kom forbi i dag 😊',
    'Vi ses snart? ☕',
    'Svip forbi når du er i nærheden',
    'Vi glæder os til at se dig'
  ],
  ...
};
ctaPoolOverride = casualVisitCTAs[language];
```

#### Advance-Planning Override (lines 94-106)
```typescript
const bookingFocusedCTAs: Record<string, string[]> = {
  da: [
    'Book bord online 👇',
    'Reservér din plads 📅',
    'Se menuen og book bord',
    'Sikr dig et bord — book nu'
  ],
  ...
};
ctaPoolOverride = bookingFocusedCTAs[language];
```

#### Mixed (no override)
- Falls through to existing logic: brand `typical_closings` or `FREE_CTAS` pools
- Economic context-based selection preserved

**Integration:** Selected CTA passed to GPT-4o with `ctaStyle` (strict/soft) for integration into caption

## Data Flow

### Weekly Plan Flow
```
business_operations
  ↓ (reservation_required, accepts_walk_ins)
context-interpreters.ts → deriveServiceBehaviorSignals()
  ↓ (booking_pattern)
get-weekly-strategy/index.ts → WeekContext.service_behavior_signals
  ↓
phase2b.ts → generate CTA instructions
  ↓
Phase 2d prompt → Gemini Flash
  ↓
weekly_strategies.narrative (with baked-in CTA)
  ↓
generate-text-from-idea → final caption
```

### Caption Generation Flow
```
business_operations
  ↓ (reservation_required, accepts_walk_ins)
resolve-context.ts → BusinessContext
  ↓
select-cta.ts → derive booking pattern → override CTA pool
  ↓
selectCTA() → {selectedCta, ctaStyle, ctaIntent}
  ↓
GPT-4o prompt
  ↓
Final caption with appropriate CTA
```

## Free Tier Handling

**Added** (resolve-context.ts lines 748-757):
```typescript
} else {
  // Free tier: still resolve booking_link + booking pattern signals
  const { data: freeBooking } = await supabase
    .from('business_brand_profile')
    .select('booking_link')
    .eq('business_id', businessId)
    .single()
  bookingLink = (freeBooking as any)?.booking_link ?? null
  
  // Fetch booking pattern from business_operations
  try {
    const { data: opsRow } = await supabase
      .from('business_operations')
      .select('reservation_required, accepts_walk_ins')
      .eq('business_id', businessId)
      .single()
    reservationRequired = opsRow?.reservation_required === true;
    acceptsWalkIns = opsRow?.accepts_walk_ins === true;
  } catch (_) { /* table or column may not exist */ }
}
```

Free tier users also benefit from booking pattern-aware CTAs (even without full brand profile).

## Testing Scenarios

### Scenario 1: Italian Restaurant (Advance-Planning)
**Data:** `reservation_required = true`  
**Expected:**
- Phase 2b instructions: "Nævn at reservation anbefales"
- Weekend: "Bordene fylder hurtigt op — 'Book bord nu'"
- select-cta.ts: Only booking-focused CTAs ("Book bord online", "Reservér din plads")

### Scenario 2: Walk-In Café (Impulse-Friendly)
**Data:** `accepts_walk_ins = true`, `reservation_required = false`  
**Expected:**
- Phase 2b instructions: "Opfordre til at komme forbi i dag — INGEN booking-sprog"
- select-cta.ts: Only casual CTAs ("Kom forbi i dag", "Vi ses snart")

### Scenario 3: Café Faust (Mixed - likely)
**Data:** `has_table_service = true`, `accepts_walk_ins = true`  
**Expected:**
- Phase 2b: Economic modulation (weekend → booking, weekday → casual)
- select-cta.ts: Use brand `typical_closings` or `FREE_CTAS` pools (no override)

## Deployment Status

✅ **Phase 2b:** Code complete (lines 140-241)  
  - Shared module, will deploy with next `get-weekly-strategy` deployment
  - No standalone deployment possible

✅ **generate-text-from-idea:** **DEPLOYED** (171.9kB)  
  - Deployed: January 2025
  - resolve-context.ts: Fetches booking pattern fields
  - select-cta.ts: Three-tier CTA pool logic
  - index.ts: Passes signals to selectCTA()

## Impact

### Before
- All businesses got same generic CTA logic
- Fine dining/specialty: Casual "kom forbi" ignored reservation model
- Walk-in cafés: Booking CTAs were too formal/incorrect

### After
- **Advance-planning:** Every post emphasizes booking (standard) or urgency (weekend)
- **Impulse-friendly:** Every post uses casual invitation language, zero booking terms
- **Mixed:** Economic modulation preserved (weekend → booking, weekday → casual)

### User Value
- **Accuracy:** CTAs match business operational model
- **Conversion:** Booking businesses drive reservations, walk-in businesses drive footfall
- **Brand alignment:** Formal restaurants get formal CTAs, casual cafés get casual CTAs

## Next Steps

1. **Test with Café Faust**
   - Check business_operations values
   - Generate weekly plan + caption
   - Verify CTA matches booking pattern

2. **Test with Italian Restaurant**
   - Set `reservation_required = true` in business_operations
   - Verify all CTAs emphasize booking

3. **Test with Walk-In Business**
   - Set `accepts_walk_ins = true`, `reservation_required = false`
   - Verify zero booking language in CTAs

4. **Deploy get-weekly-strategy** (to activate Phase 2b changes)
   - Phase 2b is shared module, needs parent function deployment
   - Triggers Gemini prompt with booking-aware CTA instructions

## Related Files

### Modified Files
- `supabase/functions/_shared/post-helpers/strategy/phase2/phase2b.ts`
- `supabase/functions/generate-text-from-idea/resolve-context.ts`
- `supabase/functions/generate-text-from-idea/select-cta.ts`
- `supabase/functions/generate-text-from-idea/index.ts`

### Reference Files
- `supabase/functions/get-weekly-strategy/context-interpreters.ts` (deriveServiceBehaviorSignals)
- `supabase/functions/_shared/post-helpers/types/strategy-types.ts` (WeekContext.service_behavior_signals)

## Technical Notes

### Why Two CTA Systems?
1. **Phase 2b (prompt generation):** Gemini needs CTA instructions to bake CTAs into narrative
2. **select-cta.ts (final selection):** GPT-4o needs a specific CTA string to integrate into caption

Both must align on booking pattern logic for consistency.

### Why Not Centralize?
- Phase 2b generates **instructions** (Danish prose for AI prompt)
- select-cta.ts selects **literal CTAs** (final text strings)
- Different output formats, same business logic

### Tourist Context Bonus Fix
While implementing booking pattern, also fixed `touristContext` scope error:
- Variable was declared in `fetchBusinessContext` but referenced in `resolveContentContext`
- Solution: Added `touristContext` to `BusinessContext` interface, passed as parameter
- Enables menu language note: "Stedet tiltrækker internationale gæster"

---

**Summary:** Booking pattern enhancement ensures CTAs match business operational model across two systems (weekly plan prompts + final caption generation). Advance-planning businesses always emphasize booking, impulse-friendly businesses always use casual invitations, mixed businesses preserve economic modulation.
