# V5.3 Testing Guide

## ✅ Implementation Complete

All V5.3 enhancements have been successfully implemented and deployed:

### 🚀 Deployed Functions
- ✅ `brand-profile-generator-v5` - Updated with V5.3 enhancements
- ✅ `get-quick-suggestions` - Updated to use marketing manager brief

### 📦 New Modules Created
1. ✅ **marketing-manager-brief-generator.ts** - Danish Business DNA Analyst persona
2. ✅ **usp-extractor.ts** - Extract and prioritize USPs from location intelligence
3. ✅ **customer-situations.ts** - Derive customer situation contexts from timing + motivation

### 🔧 Integrations Complete
1. ✅ USP extraction added to Layer 0 (Step 4b in brand-profile-generator-v5)
2. ✅ Customer situations added to Layer 4 audience segments
3. ✅ Marketing manager brief generation added (Layer 6 / Step 5d)
4. ✅ Marketing manager brief saved to database (both JSONB and top-level column)
5. ✅ get-quick-suggestions updated to prioritize marketing_manager_brief

---

## 🧪 Manual Testing Instructions

### Step 1: Regenerate Brand Profile

Use the UI or run this SQL to trigger regeneration:

```sql
-- Trigger brand profile regeneration for test business
SELECT brand_profile_generator_v5('561f8fe8-41cb-4191-87e4-5cabf9bcdd79', true);
```

### Step 2: Verify Marketing Manager Brief

```sql
SELECT 
  business_id,
  marketing_manager_brief,
  length(marketing_manager_brief) as brief_length,
  marketing_manager_brief LIKE '%Du er%' as is_danish,
  marketing_manager_brief LIKE '%you are%' as has_english_pollution
FROM business_brand_profile
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';
```

**Expected Results:**
- ✅ `brief_length` between 800-1500 characters (~150-250 words)
- ✅ `is_danish` = true (starts with "Du er marketingansvarlig...")
- ✅ `has_english_pollution` = false (no English phrases)

### Step 3: Verify USP Extraction

```sql
SELECT 
  business_id,
  brand_profile_v5->'layer_0_intelligence'->'usps'->'primary_usp'->>'text' as primary_usp,
  brand_profile_v5->'layer_0_intelligence'->'usps'->'primary_usp'->>'score' as primary_score,
  jsonb_array_length(brand_profile_v5->'layer_0_intelligence'->'usps'->'secondary_usps') as secondary_count
FROM business_brand_profile
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';
```

**Expected Results:**
- ✅ `primary_usp` exists (e.g., "Atmosfære", "Kaffe", etc.)
- ✅ `primary_score` >= 80
- ✅ `secondary_count` >= 0 (may have 0-5 secondary USPs)

### Step 4: Verify Customer Situations

```sql
SELECT 
  programme_type,
  programme_name,
  segment->>'label' as segment_label,
  segment->'situations' as situations
FROM business_programme_profiles,
  jsonb_array_elements(audience_segments) as segment
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND segment->'situations' IS NOT NULL;
```

**Expected Results:**
- ✅ Each audience segment has a `situations` array
- ✅ Situations are concrete scenarios (e.g., "lunch break", "business meeting", "date night")
- ✅ All text in Danish

### Step 5: Test Stage 2 Integration (Quick Suggestions)

Use the UI to generate quick suggestions for a menu item or run:

```sql
-- This will invoke get-quick-suggestions through the UI
-- Navigate to: Dashboard → Quick Suggestions → Enter a dish name
```

**Expected Behavior:**
- ✅ Suggestions generated successfully
- ✅ All suggestions in Danish (no English)
- ✅ Console logs show: "✅ Using marketing_manager_brief (V5.3 synthesized guidance)"

### Step 6: Language Quality Check

```sql
-- Check for English pollution across all V5 outputs
SELECT 
  business_id,
  CASE
    WHEN marketing_manager_brief LIKE '%you are%' OR 
         marketing_manager_brief LIKE '%always%' OR
         marketing_manager_brief LIKE '%never%' THEN 'FAIL - English detected'
    WHEN marketing_manager_brief LIKE '%Du er%' AND
         marketing_manager_brief LIKE '%Fremhæv%' THEN 'PASS - Danish confirmed'
    ELSE 'UNKNOWN'
  END as language_quality
FROM business_brand_profile
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';
```

**Expected Result:**
- ✅ `language_quality` = 'PASS - Danish confirmed'

---

## 📊 Quality Benchmarks

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Marketing Brief Length | 100-300 words | `SELECT length(marketing_manager_brief)` |
| Danish Language | 100% | No "you are", "always", "never" phrases |
| USP Primary Score | ≥ 80 | `brand_profile_v5.layer_0_intelligence.usps.primary_usp.score` |
| Customer Situations | ≥ 1 per segment | Check `audience_segments[].situations` array length |
| Stage 2 Quality | Higher relevance | Compare suggestions before/after |

---

## 🔍 Automated Test Script

A comprehensive test script is available at `_test_brand_profile_v5_3.mjs`.

**To run (requires SUPABASE_SERVICE_ROLE_KEY):**

```bash
# Option 1: Set environment variable
export SUPABASE_URL="https://kvqdkohdpvmdylqgujpn.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"
deno run --allow-net --allow-env --no-lock _test_brand_profile_v5_3.mjs 561f8fe8-41cb-4191-87e4-5cabf9bcdd79

# Option 2: Get service key from Supabase Dashboard
# Dashboard → Settings → API → service_role key (secret)
```

**The automated test validates:**
1. ✅ Marketing manager brief generated (Danish, 100-300 words, structured)
2. ✅ USP extraction (primary + secondary USPs)
3. ✅ Customer situations added to audience segments
4. ✅ Language quality (no English pollution)
5. ✅ Database structure (version, metadata)
6. ✅ Stage 2 integration (get-quick-suggestions uses brief)

---

## 🎯 Success Criteria

**All tests should pass:**
- ✅ Marketing manager brief exists and is in Danish
- ✅ USPs extracted with scores ≥ 80
- ✅ Customer situations present in audience segments
- ✅ No English pollution detected
- ✅ get-quick-suggestions uses marketing_manager_brief (check console logs)
- ✅ Stage 2 output quality improved (more targeted, relevant suggestions)

**If any test fails:**
1. Check Edge Function logs: Dashboard → Edge Functions → Logs
2. Verify deployment: `supabase functions deploy brand-profile-generator-v5`
3. Check database schema: Ensure `marketing_manager_brief` column exists
4. Re-run regeneration with force flag: `forceRegenerate: true`

---

## 🚦 Next Steps

1. **Run Manual Tests** - Follow Steps 1-6 above
2. **Compare Before/After** - Generate suggestions on same dish, compare quality
3. **Validate Language** - All outputs should be 100% Danish
4. **Monitor Performance** - Check generation time (should be similar to V5.2)
5. **Update Weekly Plan** - Apply same pattern to `generate-weekly-plan` function

---

## 📝 Implementation Notes

### Architecture Changes (V5.3)
- **New Layer 6**: Marketing Manager Brief (synthesizes all layers into one Danish role instruction)
- **Enhanced Layer 0**: USP extraction from location intelligence (≥90 = primary, 80-89 = secondary)
- **Enhanced Layer 4**: Customer situations derived from timing + motivation + programme type
- **Stage 2 Priority**: marketing_manager_brief → business_identity_persona → legacy assembly

### Key Files Modified
1. `supabase/functions/_shared/brand-profile/marketing-manager-brief-generator.ts` (NEW)
2. `supabase/functions/_shared/brand-profile/usp-extractor.ts` (NEW)
3. `supabase/functions/_shared/brand-profile/customer-situations.ts` (NEW)
4. `supabase/functions/brand-profile-generator-v5/index.ts` (MODIFIED - integrated all enhancements)
5. `supabase/functions/get-quick-suggestions/index.ts` (MODIFIED - uses marketing_manager_brief)

### Database Schema Changes
- Added `marketing_manager_brief` column to `business_brand_profile` (TEXT, nullable)
- Added `marketing_manager_brief` field to `brand_profile_v5` JSONB structure
- Added `marketing_manager_brief_metadata` to V5 JSONB (word count, generation timestamp)
- Added `usps` field to `layer_0_intelligence` in V5 JSONB
- Enhanced `audience_segments` in `business_programme_profiles` with `situations` array

---

**Version:** V5.3  
**Date:** June 21, 2026  
**Status:** ✅ DEPLOYED AND READY FOR TESTING
