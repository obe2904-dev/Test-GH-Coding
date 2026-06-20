# Deep Dive: Content Generation Database Integration Review

## Executive Summary

This review examines how the three content generation flows (write mode, AI ideas, weekly plan) consume database fields, focusing on:
1. Recent database field additions and their impact
2. How updated profile, menu location, and brand profile are integrated
3. Potential gaps and inconsistencies

---

## 1. DATABASE FIELD CHANGES ANALYSIS

### 1.1 Critical Finding: Duplicate `local_location_reference` Implementations

**ISSUE IDENTIFIED:** The `local_location_reference` field was added to TWO different tables with conflicting implementations:

#### Migration `20260507000000_add_local_location_reference.sql`
- **Table:** `business_location_intelligence`
- **Status:** Applied (migration exists in migrations folder)
- **Features:** Includes source tracking and metadata
  ```sql
  ALTER TABLE business_location_intelligence
  ADD COLUMN IF NOT EXISTS local_location_reference text;
  ADD COLUMN IF NOT EXISTS local_location_reference_source text;
  ADD COLUMN IF NOT EXISTS local_location_reference_updated_at timestamptz;
  ```

#### File `ADD_LOCAL_LOCATION_REFERENCE_TO_BUSINESSES.sql` (NOT migrated)
- **Table:** `businesses`
- **Status:** NOT APPLIED (manual SQL file, not in migrations/)
- **Features:** Simple TEXT field, no metadata
  ```sql
  ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS local_location_reference TEXT;
  ```

#### Our Code Today (in `generate-text-from-idea`)
- **Reads from:** `businesses.local_location_reference`
- **Problem:** This column does NOT exist in production database
- **Impact:** Edge Function will receive NULL for all businesses

### 1.2 What Actually Exists in Production

Based on migration history:

**✅ EXISTS:**
- `business_location_intelligence.local_location_reference` (from migration 20260507)
- `business_location_intelligence.local_location_reference_source`
- `business_location_intelligence.local_location_reference_updated_at`

**❌ DOES NOT EXIST:**
- `businesses.local_location_reference` (manual SQL file not applied)

### 1.3 Impact Assessment

**Current Status:**

**1. Brand Profile V5 Generation (`brand-profile-generator-v5`):**
- ⚠️ Works via FALLBACK PATH only
- **Primary read (fails):**
  ```typescript
  // index.ts line 102
  supabase.from('businesses').select('*, local_location_reference')
  // Returns null (column doesn't exist)
  ```
- **Fallback read (succeeds):**
  ```typescript
  // index.ts line 181
  supabase.from('business_location_intelligence').select('*')
  
  // index.ts line 262, 318, 375
  local_location_reference: business.local_location_reference || location?.local_location_reference
  // Falls back to location intelligence table value
  ```
- **Result:** ✅ Currently WORKS because fallback exists
- **Risk:** Fragile implementation, relies on undocumented fallback

**2. Content Generation (`generate-text-from-idea`):**
- ❌ NO FALLBACK - Will always receive `null`
- **Read attempt:**
  ```typescript
  // resolve-context.ts line ~311
  supabase.from('businesses').select('name, vertical, local_location_reference')
  // Returns null (column doesn't exist)
  ```
- **No fallback logic:**
  ```typescript
  const localLocationReference = businessResult.data?.local_location_reference || null
  // Always null in production
  ```
- **Result:** ❌ BROKEN - All businesses use generic "i {city}"

**Evidence:**
This query will succeed but `local_location_reference` will always be `null` because the column doesn't exist in the `businesses` table.

---

## 2. THREE CONTENT GENERATION FLOWS ANALYSIS

### 2.1 Flow Architecture Overview

All three flows use the SAME backend:
```
┌──────────────────┐
│ CreatePostPage   │
│ mode=write       │──┐
└──────────────────┘  │
                      │
┌──────────────────┐  │    ┌─────────────────────────┐    ┌──────────────────┐
│ CreatePostPage   │──┼───▶│ generate-text-from-idea │───▶│ OpenAI API       │
│ mode=ai          │  │    │ (Edge Function)         │    │ (gpt-4o/mini)    │
└──────────────────┘  │    └─────────────────────────┘    └──────────────────┘
                      │              ▲
┌──────────────────┐  │              │
│ AI Weekly Plan   │──┘              │
│ PostDetailModal  │                 │
└──────────────────┘                 │
                                     │
                          ┌──────────┴─────────────┐
                          │ fetchBusinessContext() │
                          │ resolveContentContext()│
                          └────────────────────────┘
```

### 2.2 Data Flow: Database → Edge Function → OpenAI

#### Step 1: Frontend Calls Edge Function

**Write Mode (`mode=write`):**
```typescript
// CreatePostPage.tsx line ~365
await supabase.functions.invoke('generate-text-from-idea', {
  body: {
    businessId,
    suggestion: {
      id, title, source: 'ai_ideas',
      contentType, menuItemName, menuItemDescription,
      captionBase, ctaIntent, photoIdea, whyExplanation
    },
    platforms: ['facebook', 'instagram'],
    tier: 'free' | 'paid'
  }
})
```

**AI Ideas Mode (`mode=ai`):**
- Same invocation as Write Mode
- Pre-populated suggestion data from `daily_suggestions` table

**Weekly Plan:**
```typescript
// PostDetailModal.tsx (via CreatePostPage)
await supabase.functions.invoke('generate-text-from-idea', {
  body: {
    businessId,
    suggestion: {
      source: 'weekly_plan',
      timingDay, timingTime, guestMoment,
      visualSubject, visualAngle, drinkPairing,
      sceneSpec, holidayContext, // etc.
    },
    platforms,
    tier
  }
})
```

#### Step 2: Edge Function Fetches Business Context

**Function:** `fetchBusinessContext()` in `resolve-context.ts`

**Database Queries:**

1. **Business Info:**
   ```typescript
   supabase.from('businesses')
     .select('name, vertical, local_location_reference') // ❌ Field doesn't exist
   ```

2. **Location Info:**
   ```typescript
   supabase.from('business_locations')
     .select('city, country')
   ```

3. **Brand Profile V5 (Paid Only):**
   ```typescript
   supabase.from('business_brand_profile')
     .select('brand_profile_v5, booking_link, content_strategy, location_intelligence')
   ```
   
   **V5 Structure Used:**
   - `brand_profile_v5.voice.*` → Writing rules, tone, vocabulary
   - `brand_profile_v5.programmes` → Business model, copy hooks
   - `brand_profile_v5.identity.*` → Brand essence, positioning
   - `brand_profile_v5.audience_segments` → Time-based targeting

4. **Opening Hours (Paid Only):**
   ```typescript
   supabase.from('opening_hours')
     .select('*')
   ```

5. **Menu Data:**
   ```typescript
   supabase.from('menu_results_v2')
     .select('service_period_name, ai_summary, structured_data')
   ```

6. **Location Intelligence:**
   ```typescript
   supabase.from('business_location_intelligence')
     .select('hospitality_density_text, category_scores')
   ```

#### Step 3: Computed Context

**BusinessContext Object Contains:**
```typescript
{
  // Basic
  businessName, vertical, effectiveVertical,
  city, localLocationReference, locationText,
  language,
  
  // Voice (from V5)
  brandTone, brandWritingRules, brandGoodExamples,
  brandSignaturePhrases, voiceConstraints,
  
  // Identity (from V5)
  venueIdentity, venueCharacter, businessCharacter,
  identityKeywords, targetAudience,
  
  // Operational
  todayOpenTime, todayCloseTime, kitchenCloseTime,
  bookingLink, reservationRequired, acceptsWalkIns,
  
  // Strategy (from V5)
  businessModelType, primaryCopyHook, audienceBreadth,
  activeSegmentName, activeSegmentMotivation,
  
  // Location
  locationIntelligenceMotivations,
  hospitalityDensityText,
  seasonalContextSignal
}
```

#### Step 4: Prompt Construction

**Prompt Template (line ~662 in prompt-builders.ts):**
```
Skriv ÉN social media-tekst til ${businessName} ${locationText} (${effectiveVertical}).
```

**With `local_location_reference`:**
```
Skriv ÉN social media-tekst til Cafe Faust ved åen (café).
```

**Without (current production):**
```
Skriv ÉN social media-tekst til Cafe Faust i Aarhus (café).
```

---

## 3. CRITICAL ISSUES IDENTIFIED

### Issue #1: Database Field Location Mismatch ⚠️

**Problem:**
- Code reads from `businesses.local_location_reference`
- Database has `business_location_intelligence.local_location_reference`

**Root Cause:**
- Migration 20260507 added to `business_location_intelligence`
- Manual SQL file `ADD_LOCAL_LOCATION_REFERENCE_TO_BUSINESSES.sql` never applied
- Today's code changes assumed `businesses` table location

**Impact:**
- ❌ Content generation receives `null` for `local_location_reference`
- ❌ Prompts use generic "i Aarhus" instead of "ved åen"
- ❌ Ban list logic for "ved åen" doesn't work

**Resolution Options:**

**Option A: Move to `businesses` table (Recommended)**
- Apply `ADD_LOCAL_LOCATION_REFERENCE_TO_BUSINESSES.sql`
- Migrate data from `business_location_intelligence` to `businesses`
- Simpler architecture (single source of truth)
- User-editable field belongs with user-facing data

**Option B: Update code to read from `business_location_intelligence`**
- Change `fetchBusinessContext()` to query correct table
- Keep richer metadata (source, updated_at)
- More complex queries (requires JOIN or separate fetch)

### Issue #2: Onboarding Function Parameter Mismatch

**Problem:**
- `create_business_onboarding` function signaturATTEMPT to read from same source, but have different fallback behavior:

**Brand Profile Generator (`brand-profile-generator-v5`):**
- **Primary read:** `businesses.local_location_reference` (fails → null)
- **Fallback read:** `business_location_intelligence.local_location_reference` (succeeds)
- **Stores result in:** `brand_profile_v5` JSONB (via fallback value)
- **Used in:** Layer 2, 3, 4, 5 prompts
- **Current status:** ✅ Works (via fallback)

**Content Generator (`generate-text-from-idea`):**
- **Primary read:** `businesses.local_location_reference` (fails → null)
- **Fallback read:** NONE (no fallback logic implemented)
- **Uses:** null → falls back to "i {city}"
- **Current status:** ❌ Broken (no fallback)

**Result:**
- ✅ Brand profile contains "ved åen" throughout (from fallback source)
- ❌ Generated posts use "i Aarhus" (no fallback, gets null)
- ❌ Inconsistent: same business has different location text in profile vs posts

**Root Cause:**
Both Edge Functions were updated to use `businesses` table, but:
- `brand-profile-generator-v5` has fallback to `business_location_intelligence`
- `generate-text-from-idea` has NO fallback
- Neither works from intended source (businesses table column doesn't exist)mismatch error

**Resolution:**
- Apply `APPLY-ONBOARDING-MIGRATION.sql` manually via Supabase dashboard

### Issue #3: Brand Profile V5 vs Content Generation Field Consistency

**Observation:**
Brand profile generation and content generation read from DIFFERENT sources:

**Brand Profile Generator (`brand-profile-generator-v5`):**
- Likely reads from `business_location_intelligence.local_location_reference`
- Stores result in `brand_profile_v5` JSONB
- Used in Layer 2, 3, 4, 5 prompts

**Content Generator (`generate-text-from-idea`):**
- Tries to read from `businesses.local_location_reference` (doesn't exist)
- Gets `null`
- Prompt uses fallback "i {city}"

**Result:**
- ✅ Brand profile contains "ved åen" throughout
- ❌ Generated posts use "i Aarhus"
- Inconsistent user experience

---

## 4. MENU & LOCATION INTEGRATION STATUS

### 4.1 Menu Data Flow

**Source:** `menu_results_v2` table

**How It's Used:**

1. **Menu Item Lookup:**
   ```typescript
   // resolve-context.ts line ~900+
   supabase.from('menu_items_normalized')
     .select('dish_text, dish_text_brief, menu_label')
   ```

2. **Active Menu Context:**
   ```typescript
   supabase.from('menu_results_v2')
     .select('service_period_name, ai_summary, structured_data')
     .eq('status', 'extracted')
   ```
   
   **Determines:** "klassisk brunchmenu", "moderne a la carte", etc.

3. **Time-Based Selection:**
   - Current hour (9-12 → brunch, 12-16 → frokost, 16+ → aften)
   - Matches `availabilityTime` from `structured_data`

**Integration Status:** ✅ FULLY INTEGRATED
- All three flows receive menu context
- Dish descriptions sanitized (`sanitizeMenuDesc()`)
- Menu character included in prompts

### 4.2 Location Data Flow

**Sources:**
1. `business_locations` → city, country
2. `business_location_intelligence` → motivations, density, category scores
3. `businesses.local_location_reference` → ❌ doesn't exist (should be source of truth)

**How It's Used:**

1. **City & Country:**
   ```typescript
   const city = locationResult.data?.city || ''
   const country = locationResult.data?.country || 'Denmark'
   const language = country === 'Denmark' ? 'da' : 'sv'
   ```

2. **Location Intelligence Motivations:**
   ```typescript
   const li = brandProfile.location_intelligence
   locationIntelligenceMotivations = li.matched_motivations.slice(0, 5)
   ```
   
   **Examples:** "destinationsbesøg", "romantisk_stemning", "morgenbagværk_stop"

3. **Hospitality Density:**
   ```typescript
   const density = locationIntelligenceData?.hospitality_density_text
   ```
   
   **Examples:** "moderat hospitality-densitet", "højt konkurrencepres"

**Integration Status:** ⚠️ PARTIALLY INTEGRATED
- ✅ City/country working
- ✅ Location intelligence motivations working
- ❌ Local location reference broken (wrong table)

---

## 5. BRAND PROFILE V5 INTEGRATION

### 5.1 What V5 Contains

**Structure:**
```typescript
brand_profile_v5 = {
  programmes: [],         // Detected business models (dining, drinks, events, etc.)
  identity: {},          // Brand essence, positioning, values
  voice: {},             // Tone rules, structural rules, examples
  audience_segments: [], // Time-based targeting (morning regulars, weekend nightlife, etc.)
  business_model: {}     // Classification (offer_led, occasion_led, etc.)
}
```

### 5.2 How V5 is Consumed by Content Generation

**Free Tier:**
- ❌ No V5 access
- Fallback to simple tone (`SAFE_HOSPITALITY_FALLBACK`)
- Generic prompts with basic menu names

**Paid Tier:**

1. **Voice Layer:**
   ```typescript
   const structuralRules = v5.voice.structural_rules || []
   const styleRules = v5.voice.style_rules || []
   const toneRules = v5.voice.tone_rules || []
   brandWritingRules = [...structuralRules, ...styleRules].slice(0, 3)
   ```

2. **Identity Layer:**
   ```typescript
   venueIdentity = v5.identity.recognizable_interior_identity.value
   businessCharacter = v5.identity.business_character
   identityKeywords = v5.identity.identity_keywords
   ```

3. **Audience Segments (Time-Based):**
   ```typescript
   const segments = v5.audience_segments || []
   const activeSegment = matchActiveSegment(segments, dayOfWeek, hourOfDay, monthOfYear)
   activeSegmentName = activeSegment?.name
   activeSegmentMotivation = activeSegment?.motivation
   activeSegmentAngle = activeSegment?.content_angles?.[0]?.label
   ```

4. **Business Model:**
   ```typescript
   businessModelType = v5.business_model.business_type
   primaryCopyHook = v5.business_model.primary_copy_hook
   audienceBreadth = v5.business_model.audience_breadth
   ```

**Integration Status:** ✅ FULLY INTEGRATED (for paid tier)
- Voice rules flow into prompt constraints
- Identity anchors guide tone
- Audience segments enable time-based targeting
- Business model shapes content strategy

### 5.3 Hybrid Business Detection

**Question:** Does Cafe Faust maintain hybrid status?

**Answer:** YES, if V5 contains multiple programmes

**Verification Method:**
```sql
SELECT jsonb_array_length(brand_profile_v5->'programmes') AS programme_count
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

**Expected:** `programme_count >= 2`

**V5 Detection Logic:**
- NOT based on `businesses.vertical` enum ⚠️ CRITICAL

**Action Required:**
1. Decide: `businesses` table OR `business_location_intelligence` table?
2. If `businesses`: Apply `ADD_LOCAL_LOCATION_REFERENCE_TO_BUSINESSES.sql`
3. If `business_location_intelligence`: Update code in BOTH Edge Functions

**Recommended:** Use `businesses` table
- User-editable fields belong with business core data
- Simpler queries (no JOIN needed)
- Matches implementation we coded today
- Matches intended architecture in both Edge Functions

**Implementation Steps:**
```sql
-- 1. Apply to production database
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS local_location_reference TEXT;

-- 2. Copy existing data from location intelligence table
UPDATE businesses b
SET local_location_reference = li.local_location_reference
FROM business_location_intelligence li
WHERE b.id = li.business_id
  AND li.local_location_reference IS NOT NULL;

-- 3. Set Cafe Faust test data
UPDATE businesses
SET local_location_reference = 'ved åen'
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 4. Refresh schema cache
NOTIFY pgrst, 'reload schema';
```

**Alternative (Less Recommended):**
Add fallback logic to `generate-text-from-idea`:
```typescript
// Fetch both sources
const [businessResult, locationIntelResult] = await Promise.all([
  supabase.from('businesses').select('name, vertical').eq('id', businessId).single(),
  supabase.from('business_location_intelligence').select('local_location_reference').eq('business_id', businessId).single()
])

const localLocationReference = businessResult.data?.local_location_reference 
  || locationIntelResult.data?.local_location_reference 
  || null
```

**Pros of alternative:** Works immediately without migration
**Cons of alternative:** Inconsistent data model, more complex queries, two sources of truth
**Action Required:**
1. Decide: `businesses` table OR `business_location_intelligence` table?
2. If `businesses`: Apply `ADD_LOCAL_LOCATION_REFERENCE_TO_BUSINESSES.sql`
3. If `business_location_intelligence`: Update `fetchBusinessContext()` query

**Recommended:** Use `businesses` table
- User-editable fields belong with business core data
- Simpler queries (no JOIN needed)
- Matches implementation we coded today

### Priority 2: Apply Onboarding Migration

**Action Required:**
- Execute `APPLY-ONBOARDING-MIGRATION.sql` in Supabase SQL editor
- Enables auto-population from website analysis
- Prevents function signature errors

### Priority 3: Verify Cafe Faust Hybrid Status

**Action Required:**
- Run verification query (see 5.3 above)
- Check that multiple programmes exist
- Ensure V5 regeneration didn't collapse to single category

### Priority 4: End-to-End Testing

**Test Checklist:**
1. ✅ Generate brand profile V5 → Check "ved åen" appears
2. ❌ Generate content (write mode) → Currently will use "i Aarhus" (wrong)
3. ❌ Generate content (AI ideas) → Currently will use "i Aarhus" (wrong)
4. ❌ Generate content (weekly plan) → Currently will use "i Aarhus" (wrong)

After fixing database field location:
- Re-test all three flows
- Verify "ved åen" appears in generated captions
- Check Edge Function logs for confirmation

---

## 7. SUMMARY TABLE: DATABASE FIELDS IMPACT

| Field | Table | Status | Impact on Content Gen | Integration |
|-------|-------|--------|----------------------|-------------|
| `local_location_reference` | `businesses` | ❌ NOT EXISTS | None (returns null) | Broken |
| `local_location_reference` | `business_location_intelligence` | ✅ EXISTS | Used by V5 gen only | Partial |
| `vertical` | `businesses` | ✅ EXISTS | Determines business type | ✅ Working |
| `brand_profile_v5` | `business_brand_profile` | ✅ EXISTS | Full voice/identity system | ✅ Working |
| `city`, `country` | `business_locations` | ✅ EXISTS | Location context | ✅ Working |
| Service period data | `menu_results_v2` | ✅ EXISTS | Menu character context | ✅ Working |
| Opening hours | `opening_hours` | ✅ EXISTS | Time-based CTAs | ✅ Working |
| `booking_link` | `business_brand_profile` | ✅ EXISTS | Drive-footfall CTAs | ✅ Working |

---

## 8. NEXT STEPS

1. **IMMEDIATE:** Determine correct table for `local_location_reference`
2. **URGENT:** Apply database migration to production
3. **VERIFY:** Run Cafe Faust hybrid status check
4. **TEST:** End-to-end content generation with "ved åen"
5. **MONITOR:** Edge Function logs for location context confirmation

