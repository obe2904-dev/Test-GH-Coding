# FREE TIER ASSESSMENT - Current State vs Requirements

## User Requirements for Free Tier

1. ✅ **Opening hours** - Should be available
2. ✅ **Booking link** - Should be available (if entered)
3. ✅ **Kitchen closing time** - Should be available (if entered)
4. 🔄 **Brand Voice** - Hardcoded neutral/warm tone that fits all
5. ❓ **Menu from Profile** - How are menus used? (question incomplete)

---

## CURRENT STATE ANALYSIS

### 1. Opening Hours - ❌ CURRENTLY BLOCKED

**Location:** `generate-text-from-idea/resolve-context.ts` lines 688-711

**Current Code:**
```typescript
if (isPaid) {
  // ... brand profile fetching ...
  
  // 3. Opening hours (paid only — factual time constraint)
  const { data: hoursRows } = await supabase
    .from('opening_hours')
    .select('open_time, close_time, closed')
    .eq('business_id', businessId)
    .eq('kind', 'normal')
    .eq('weekday', todayName)
    .limit(1)
  const todayHours = hoursRows?.[0]
  if (todayHours && !todayHours.closed) {
    todayOpenTime = todayHours.open_time || ''
    todayCloseTime = todayHours.close_time || ''
  }
}
```

**Status:** Opening hours fetch is INSIDE the `isPaid` block
**Impact:** Free tier gets empty strings for `todayOpenTime` and `todayCloseTime`
**Fix Required:** Move opening hours fetch OUTSIDE the `isPaid` block

---

### 2. Booking Link - ✅ ALREADY AVAILABLE

**Location:** `generate-text-from-idea/resolve-context.ts` lines 713-721

**Current Code:**
```typescript
} else {
  // Free tier: still resolve booking_link + booking pattern signals
  const { data: freeBooking } = await supabase
    .from('business_brand_profile')
    .select('booking_link, business_character')
    .eq('business_id', businessId)
    .single()
  bookingLink = (freeBooking as any)?.booking_link ?? null
  businessCharacter = (freeBooking as any)?.business_character ?? ''
}
```

**Status:** ✅ Free tier ALREADY fetches booking_link
**No action needed**

---

### 3. Kitchen Closing Time - ❌ CURRENTLY BLOCKED

**Location:** `generate-text-from-idea/resolve-context.ts` lines 527-528 (inside isPaid block)

**Current Code:**
```typescript
if (isPaid) {
  // ... inside business_operations fetch ...
  if (opsRow?.kitchen_close_time) kitchenCloseTime = opsRow.kitchen_close_time
}
```

**Status:** Kitchen close time fetch is INSIDE the `isPaid` block
**Impact:** Free tier gets empty string for `kitchenCloseTime`
**Fix Required:** Move `kitchen_close_time` fetch to Free tier section

**Note:** Free tier ALREADY fetches `reservation_required` and `accepts_walk_ins` from `business_operations` (lines 724-730), so adding `kitchen_close_time` to that same query is trivial.

---

### 4. Brand Voice - 🔄 NEEDS IMPROVEMENT

**Location:** `generate-text-from-idea/resolve-context.ts` line 733

**Current Code:**
```typescript
// Free tier tone fallback: friendly, informative (no brand profile available)
brandTone = SAFE_HOSPITALITY_FALLBACK.personalityTraits.join(', ')
```

**SAFE_HOSPITALITY_FALLBACK definition** (line 289):
```typescript
const SAFE_HOSPITALITY_FALLBACK = {
  formalityLevel: 'casual',
  addressForm: 'du-tiltale',
  sentenceStyle: 'beskrivende',
  personalityTraits: ['venlig', 'informativ'],
  brandVoiceSummary: null,
}
```

**Current Result:** `brandTone = 'venlig, informativ'`

**User Request:** Hardcoded tone like "neutral, varm" that fits all Danish hospitality

**Proposed Improvement:**
```typescript
const SAFE_HOSPITALITY_FALLBACK = {
  formalityLevel: 'casual',
  addressForm: 'du-tiltale',
  sentenceStyle: 'beskrivende',
  personalityTraits: ['neutral', 'varm', 'informativ'],
  brandVoiceSummary: null,
}
```

**Result:** `brandTone = 'neutral, varm, informativ'`

**Additional Consideration:**
Should we add basic writing rules for Free tier? Current state:
- ❌ `brandWritingRules = []` (empty)
- ❌ `emojiInstruction = '1-2 emojis naturligt placeret'` (default)
- ❌ `typicalClosings = []` (empty)

Possible Free tier defaults:
```typescript
brandWritingRules = [
  'Brug korte, klare sætninger',
  'Skriv som du taler',
  'Undgå salgssprog og superlative'
]
emojiInstruction = '1-2 emojis naturligt placeret'
typicalClosings = [
  'Vi ses',
  'Kom forbi',
  'Velkommen'
]
```

---

### 5. Menu from Profile - ❓ QUESTION INCOMPLETE

**User Question:** "How are the menus used from Profile? An" (cut off)

**Possible Interpretations:**

#### A) How does the Business Profile page display menus?
- The Profile page likely shows dish names from `business_brand_profile.brand_profile_v5.menuHighlights` or similar
- User saw: PARISERBØF, VOL AU VENT, CLUB SANDWICH ALA FAUST, FAUSTBURGER, GAMMELDAGS ÆBLEKAGE
- These are likely stored as signature items or menu highlights in the brand profile

#### B) Can Free tier use menu names from Profile?
- Current status: Free tier does NOT have access to menu descriptions
- But Free tier DOES get `businessCharacter` from `business_brand_profile` (line 720)
- Could Free tier also get `menu_highlights` or `signature_items` as simple dish names?

**Database Check Needed:**
We found earlier that `menu_results_v2` is EMPTY for Cafe Faust. Where do those 5 dish names come from?

Likely sources:
1. `business_brand_profile.brand_profile_v5` → `menuHighlights` or `signatureItems`
2. Hand-entered during onboarding
3. Extracted from website analysis

**Question for User:**
Do you want Free tier to have access to **dish names only** (without descriptions) from the Business Profile?

Current flow:
- Paid tier: Full menu from `menu_results_v2` with descriptions
- Free tier: No menu access at all
- Proposed: Free tier gets dish names from Profile (but no descriptions)

---

## SUMMARY OF CHANGES NEEDED

### ✅ Already Working
- [x] Booking link (already fetched for Free tier)
- [x] Booking pattern signals (`reservation_required`, `accepts_walk_ins`)

### 🔧 Easy Fixes (Move outside isPaid block)

1. **Opening Hours**
   - Move `opening_hours` table fetch outside `isPaid` block
   - Lines to move: 688-711
   - Impact: Free tier gets actual opening/closing times for time-aware captions

2. **Kitchen Closing Time**
   - Add `kitchen_close_time` to existing Free tier `business_operations` fetch
   - Current fetch (lines 724-730) already queries `business_operations`
   - Just add `kitchen_close_time` to the SELECT list
   - Impact: Free tier can say "Køkkenet lukker kl. 21" instead of guessing

3. **Brand Voice Tone**
   - Change `SAFE_HOSPITALITY_FALLBACK.personalityTraits`
   - From: `['venlig', 'informativ']`
   - To: `['neutral', 'varm', 'informativ']`
   - Impact: Warmer, more welcoming default tone

### 📋 Decisions Needed

1. **Default Writing Rules for Free Tier?**
   - Should Free tier get 3-5 generic writing rules?
   - Or keep it minimal (OBSERVER persona only)?

2. **Default CTA Closings for Free Tier?**
   - Should Free tier get generic closings like "Vi ses", "Kom forbi", "Velkommen"?
   - Or rely on CTA selection logic only?

3. **Menu Names from Profile?**
   - Should Free tier access dish names (without descriptions) from `brand_profile_v5`?
   - Would this improve idea generation quality?
   - Risk: AI might still hallucinate descriptions even with just names

---

## IMPLEMENTATION PLAN

### Phase 1: Easy Wins (No Risk)
1. Move opening hours fetch outside `isPaid` block
2. Add `kitchen_close_time` to Free tier `business_operations` fetch
3. Update `SAFE_HOSPITALITY_FALLBACK` tone to "neutral, varm, informativ"

### Phase 2: Decisions + Testing
1. Decide on Free tier writing rules
2. Decide on Free tier default closings
3. Decide on menu name access from Profile
4. Test Free tier output with new data access

### Phase 3: Deploy + Monitor
1. Deploy changes to `generate-text-from-idea`
2. Deploy changes to `get-quick-suggestions` (if menu names from Profile)
3. Monitor Free tier hallucination rate
4. Collect user feedback on Free tier quality

---

## RISK ASSESSMENT

### Low Risk Changes ✅
- Opening hours: Factual data, no hallucination risk
- Kitchen closing time: Factual data, no hallucination risk
- Booking link: Already working, no change needed
- Tone adjustment: Minor wording change, minimal impact

### Medium Risk Changes ⚠️
- Default writing rules: Could conflict with some business types
- Default closings: Generic CTAs might not fit all contexts
- Menu names from Profile: Could tempt AI to invent descriptions

### Recommendation
Start with **Phase 1 only** (opening hours + kitchen time + tone).
These are pure factual improvements with zero hallucination risk.

Then test and evaluate before adding menu names or default rules.
