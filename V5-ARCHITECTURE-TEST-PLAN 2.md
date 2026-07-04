# V5 Architecture Refactoring - Test Plan

**Date:** May 10, 2026  
**Status:** Ready for Testing  
**Goal:** Validate zero regression in Danish V5 generation after multi-language architecture refactoring

---

## Test Overview

### What Changed
1. ✅ Created centralized prompt library ([v5-prompts.ts](supabase/functions/_shared/brand-profile/v5-prompts.ts))
2. ✅ Refactored all 6 V5 layer files to use prompt library
3. ✅ Added language parameter flow through entire V5 generation pipeline
4. ✅ Created pattern libraries for location/programme detection
5. ✅ Created cultural concepts framework

### What Should NOT Change
- Danish V5 profile outputs (character-for-character identical)
- All V5 JSONB field values
- Content generation quality in all three systems (Weekly Plan, Dagens Forslag, Skrive Selv)

---

## Test Suite

### Test 1: V5 Profile Generation (Cafe Faust)

**Business:** Cafe Faust (business_id from production)  
**Language:** Danish  
**Method:** Generate V5 profile, compare before/after

**Expected Results:**
- `brand_essence`: Identical text
- `positioning`: Identical text
- `core_values`: Identical array
- `what_makes_us_different`: Identical text
- `tone_rules`: Identical array
- `personality_traits`: Identical array
- `typical_openings`: Identical array
- `typical_closings`: Identical array (should include CTA for paid tier)
- `signature_phrases`: Identical array
- `never_say`: Identical array
- `content_exclusions`: Identical array
- `location_identity.water_proximity`: Should be "åen" (from business description)
- All programme profiles: Identical commercial orientation, audience segments

**Validation Command:**
```bash
# In scripts/ folder
npx ts-node test-v5-generation.ts --business-id=<cafe_faust_id> --compare
```

**Success Criteria:**
- ✅ All fields match exactly
- ✅ No TypeScript compilation errors
- ✅ Function completes in <60 seconds
- ✅ Console logs show `language detected: da`

---

### Test 2: Weekly Plan Generation

**Business:** Cafe Faust  
**Week:** May 12-18, 2026  
**Method:** Generate weekly plan using V5 profile from Test 1

**Expected Results:**
- 7 days of posts generated successfully
- Posts use "åen" (not "vandet" or "floden")
- Posts include brand CTAs from `typical_closings`
- Hashtags: Instagram 3-5, Facebook 1-2
- Tone consistent with V5 voice profile
- Menu items referenced appropriately

**Validation Command:**
```bash
curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"business_id": "<cafe_faust_id>", "week_start": "2026-05-12"}'
```

**Success Criteria:**
- ✅ All 7 posts generated
- ✅ Water term detected correctly ("åen")
- ✅ CTAs present in closings
- ✅ Hashtag counts correct (IG: 3-5, FB: 1-2)
- ✅ No generic/translated terms

---

### Test 3: Dagens Forslag (Free Tier)

**Business:** Free tier test business (no V5 profile)  
**Method:** Generate 3 quick suggestions

**Expected Results:**
- 3 suggestions generated successfully
- Generic CTAs used (not brand-specific)
- Hashtags: Instagram 3-5, Facebook 1-2
- Functional fallback to deterministic content
- No errors despite missing V5 profile

**Validation Command:**
```bash
curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-quick-suggestions \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"business_id": "<free_tier_business_id>"}'
```

**Success Criteria:**
- ✅ 3 suggestions generated
- ✅ Generic CTAs only
- ✅ Hashtag counts correct
- ✅ No V5-dependent failures

---

### Test 4: Skrive Selv Enhancement (Paid Tier)

**Business:** Cafe Faust  
**Input:** "Vi har lige fået friske østers ind. Kom og smag dem ved åen!"  
**Method:** Enhance text via ai-enhance function

**Expected Results:**
- Text enhanced with V5 voice
- "åen" preserved (not changed to "vandet")
- Brand CTA added from `typical_closings`
- Hashtags: Instagram 3-5, Facebook 1-2
- Menu item "østers" detected and leveraged
- Emojis added according to V5 voice profile

**Validation Command:**
```bash
curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/ai-enhance \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"business_id": "<cafe_faust_id>", "text": "Vi har lige fået friske østers ind. Kom og smag dem ved åen!", "platform": "instagram"}'
```

**Success Criteria:**
- ✅ Enhancement applied
- ✅ "åen" preserved exactly
- ✅ Brand CTA added
- ✅ Hashtag count correct
- ✅ Menu detection worked

---

### Test 5: Skrive Selv Smart Tier

**Business:** Cafe Faust (Smart tier - has V5 profile)  
**Input:** "Weekend brunch med vennerne"  
**Method:** Enhance text via ai-enhance function

**Expected Results:**
- Full V5 brand voice enhancement applied
- "ved åen" location reference used (not "i Aarhus")
- Brand-specific CTA from `typical_closings`
- Hashtags: Instagram 3-5, Facebook 1-2
- V5 voice/tone rules followed
- Menu detection attempted (brunch items)
- Emojis according to V5 emoji_level

**Validation Command:**
```bash
curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/ai-enhance \
  -H "Authorization: Bearer <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"business_id": "f4679fa9-3120-4a59-9506-d059b010c34a", "text": "Weekend brunch med vennerne", "userTier": "smart", "platform": "instagram"}'
```

**Success Criteria:**
- ✅ V5 brand voice enhancement works
- ✅ "ved åen" appears in output (not "i Aarhus")
- ✅ Brand CTA included
- ✅ Hashtag count correct
- ✅ local_location_reference field used correctly

---

## Regression Checklist

### Code Quality
- [ ] No TypeScript compilation errors in any V5 file
- [ ] All edge functions deploy successfully
- [ ] Bundle sizes within limits (brand-profile-generator-v5 < 300kB)
- [ ] No console errors in production logs

### Data Integrity
- [ ] V5 profile JSONB structure unchanged
- [ ] All fields populated correctly
- [ ] No null/undefined values in required fields
- [ ] Database schema unchanged

### Functional Tests
- [ ] Test 1: V5 generation identical before/after
- [ ] Test 2: Weekly Plan uses V5 correctly
- [ ] Test 3: Free tier Dagens Forslag works
- [ ] Test 4: Paid tier Skrive Selv works
- [ ] Test 5: Free tier Skrive Selv works

### Content Quality
- [ ] Water terms preserved ("åen" not "vandet")
- [ ] Brand CTAs injected correctly (paid tier)
- [ ] Generic CTAs used correctly (free tier)
- [ ] Hashtag counts correct (IG: 3-5, FB: 1-2)
- [ ] No translation loops detected
- [ ] Cultural concepts preserved (hygge, smørrebrød, etc.)

---

## Test Execution Plan

### Phase 1: Pre-Deployment Validation (Local)
1. Run TypeScript compiler on all V5 files
2. Check bundle sizes
3. Review git diff for unexpected changes

### Phase 2: Deployment
1. Deploy brand-profile-generator-v5 to production
2. Monitor deployment logs for errors
3. Verify function deployed successfully (check Supabase dashboard)

### Phase 3: Smoke Tests (Production)
1. Execute Test 1 (V5 generation for Cafe Faust)
2. If Test 1 passes → Execute Tests 2-5
3. If any test fails → ROLLBACK immediately

### Phase 4: Monitoring (24 hours)
1. Monitor production logs for errors
2. Check for any support requests about content quality
3. Validate no increase in error rates

---

## Rollback Plan

### If Regression Detected:

**Step 1: Immediate Rollback**
```bash
# Redeploy previous version from git
git checkout <previous_commit_hash>
npx supabase functions deploy brand-profile-generator-v5
```

**Step 2: Identify Root Cause**
- Compare generated V5 profiles before/after
- Check which field changed
- Review relevant prompt in v5-prompts.ts

**Step 3: Fix and Retest**
- Apply fix to v5-prompts.ts or layer file
- Rerun Test 1 locally
- Only redeploy after local validation passes

---

## Success Metrics

**Definition of Success:**
1. ✅ All 5 tests pass with identical outputs
2. ✅ Zero TypeScript compilation errors
3. ✅ Zero production errors in 24-hour monitoring period
4. ✅ No support requests about content quality changes

**Definition of Failure:**
1. ❌ Any V5 field value differs from baseline
2. ❌ Any test generates errors
3. ❌ Translation loops detected (DA→EN→DA)
4. ❌ Water terms genericized ("åen" → "vandet")
5. ❌ CTAs missing or incorrect for tier

---

## Post-Deployment Tasks

### If All Tests Pass:
1. ✅ Mark Tasks 7-8 complete
2. ✅ Document deployment in conversation summary
3. ✅ Update README with refactoring completion
4. ✅ Archive test artifacts for future reference
5. ✅ Begin planning for Swedish prompt additions (when Sweden launch confirmed)

### Future Expansion Readiness:
- Swedish prompts: Add to v5-prompts.ts under `'sv'` key
- Norwegian prompts: Add to v5-prompts.ts under `'no'` key
- German prompts: Add to v5-prompts.ts under `'de'` key
- Dutch prompts: Add to v5-prompts.ts under `'nl'` key

**No code changes required** - just add prompts to library!

---

## Test Data

### Cafe Faust Expected Values (Baseline)
```json
{
  "brand_essence": "Hyggelig casual dining ved åen med fransk bistro-stemning",
  "positioning": "Lokal fransk-inspireret restaurant med fokus på friske råvarer og autentisk madlavning",
  "location_identity": {
    "water_proximity": "åen",
    "landmark_proximity": "Nyhavn",
    "full_reference": "ved åen i hjertet af Nyhavn"
  },
  "typical_closings": [
    "Book bord på vores hjemmeside ☕",
    "Vi glæder os til at se dig ved åen 🌊",
    "Besøg os i dag - vi har åbent til 22:00 ⏰"
  ]
}
```

### Test Business IDs
- Cafe Faust (paid tier): `<to be determined from production>`
- Free tier test business: `<to be determined from production>`

---

## Notes

**Critical Observations:**
- All Danish prompts extracted character-for-character from original files
- No prompt content changed during refactoring
- Language detection defaults to 'da' for backward compatibility
- V5-first fallback pattern ensures free tier still works

**Known Non-Issues:**
- Pattern libraries (location-patterns.ts, programme-patterns.ts) created but NOT YET INTEGRATED
- Cultural concepts framework created but NOT YET USED
- These are infrastructure for future expansion, not active in current code

**Next Steps After Successful Testing:**
1. Optional: Integrate pattern libraries into resolve-context.ts
2. Optional: Add cultural concept validation to V5 generation
3. Required: Add Swedish prompts when Sweden launch confirmed (3-4 months timeline)
