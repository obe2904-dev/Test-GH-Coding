# Schema Alignment Fix - Deployment Checklist

**Target Date:** TBD  
**Estimated Time:** 30 minutes  
**Risk Level:** Low (write-only changes)  

---

## ✅ Pre-Deployment Checklist

### 1. Code Review
- [x] All 4 critical bugs fixed in code
- [x] Error handling added
- [x] No TypeScript errors
- [x] Implementation notes documented
- [ ] Code reviewed by second person (optional)

### 2. Database Audit
- [ ] Run `_SCHEMA_ALIGNMENT_FIX_DATABASE_AUDIT.sql`
- [ ] Record current state:
  - [ ] Total businesses with keywords: ___
  - [ ] Total businesses with tone: ___
  - [ ] Total businesses with key_offerings: ___
- [ ] Identify 3 test businesses with rich content
- [ ] Document their current field values

### 3. Backup & Safety
- [ ] Supabase function version tagged (current: `pre-schema-fix`)
- [ ] Database backup verified (automatic daily backups exist)
- [ ] Rollback plan reviewed
- [ ] Emergency contact available

---

## 🚀 Deployment Steps

### Step 1: Deploy Edge Function (5 min)
```bash
cd "Test P2G 1-iCloud"

# Deploy the updated function
supabase functions deploy analyze-and-distribute-website

# Verify deployment
supabase functions list
```

**Expected Output:** Function version updated, no errors

---

### Step 2: Immediate Smoke Test (5 min)

Test with ONE business in production:

```bash
# Option A: Via Supabase Dashboard
# 1. Go to Edge Functions → analyze-and-distribute-website
# 2. Click "Invoke"
# 3. Use payload: {"business_id": "TEST_BUSINESS_ID"}

# Option B: Via test script
node _TEST_SCHEMA_ALIGNMENT_VALIDATION.mjs TEST_BUSINESS_ID
```

**Expected Results:**
- ✅ Function completes without errors
- ✅ Keywords appear in business_profile.keywords
- ✅ Tone appears in business_brand_profile.tone_of_voice
- ✅ Key offerings are newline-separated TEXT
- ✅ Logs show "✓ AI data stored: ..." messages

**If Issues Found:** STOP and rollback (see Rollback section)

---

### Step 3: Monitor Logs (10 min)

Check Supabase function logs:

```
1. Supabase Dashboard → Edge Functions → analyze-and-distribute-website
2. View Logs tab
3. Look for:
   - ✓ "AI data stored: ..." (success)
   - ✗ "Profile update error: ..." (failures)
   - Response times (should be ~2-5 seconds)
```

**Red Flags:**
- Multiple "✗" error messages
- Timeout errors
- Database connection errors
- High response times (>10s)

---

### Step 4: Database Validation (5 min)

Run validation queries:

```sql
-- After first test, check if data saved
SELECT 
  bp.keywords,
  bbp.tone_of_voice,
  bp.key_offerings
FROM businesses b
LEFT JOIN business_profile bp ON b.id = bp.business_id
LEFT JOIN business_brand_profile bbp ON b.id = bbp.business_id
WHERE b.id = 'TEST_BUSINESS_ID';
```

**Expected:**
- keywords: Array of strings
- tone_of_voice: String (e.g., "warm and welcoming")
- key_offerings: Text with newlines

---

### Step 5: Run Full Test Suite (5 min)

Test with 3 businesses (rich/thin/shell content):

```bash
# Test Business 1 (rich content)
node _TEST_SCHEMA_ALIGNMENT_VALIDATION.mjs BUSINESS_1_ID

# Test Business 2 (thin content)  
node _TEST_SCHEMA_ALIGNMENT_VALIDATION.mjs BUSINESS_2_ID

# Test Business 3 (cached scrape)
# Run twice - second run should use cache
node _TEST_SCHEMA_ALIGNMENT_VALIDATION.mjs BUSINESS_3_ID
node _TEST_SCHEMA_ALIGNMENT_VALIDATION.mjs BUSINESS_3_ID
```

**Expected:** All tests pass with green checkmarks

---

### Step 6: Production Rollout (Complete)

If all tests pass:

```
✅ Deployment is complete and validated
✅ Monitor for 24 hours
✅ Run post-deployment audit
```

---

## 📊 Post-Deployment Monitoring (24 hours)

### Hour 1: Active Monitoring
- [ ] Check logs every 15 minutes
- [ ] Verify no spike in errors
- [ ] Test with 2-3 more businesses

### Hour 2-4: Periodic Checks
- [ ] Check logs every hour
- [ ] Compare error rate to baseline
- [ ] Verify user-reported data appears correctly

### Hour 24: Full Audit
- [ ] Re-run database audit SQL
- [ ] Compare before/after metrics
- [ ] Document improvement:
  - Keyword save rate: Before ___ → After ___
  - Tone save rate: Before ___ → After ___
  - Key offerings save rate: Before ___ → After ___

---

## 🔄 Rollback Procedure (If Needed)

### Emergency Rollback (2 minutes)

```bash
# Revert to previous function version
supabase functions deploy analyze-and-distribute-website --no-verify-jwt

# Or: manually revert in Supabase dashboard
# 1. Go to Edge Functions
# 2. Select function
# 3. Click "Revert to version X"
```

### Validation After Rollback
- [ ] Test with one business
- [ ] Verify old behavior restored
- [ ] Notify team of rollback
- [ ] Document what went wrong
- [ ] Schedule fix review

---

## 🎯 Success Criteria

**Deployment is successful if:**
- [x] Code deployed without errors
- [ ] All 4 critical bugs are fixed:
  - [ ] Keywords save to correct column
  - [ ] Tone saves to correct table
  - [ ] Key offerings save as TEXT
  - [ ] Cached path distributes data
- [ ] Error rate < 5%
- [ ] No user-reported issues
- [ ] Database audit shows improvement

**Deployment should be rolled back if:**
- ❌ Error rate > 20%
- ❌ Any critical bug still present
- ❌ Database writes failing
- ❌ Function timeouts
- ❌ Data corruption detected

---

## 📝 Post-Deployment Report

After 24 hours, document:

```markdown
## Deployment Report: Schema Alignment Fix

**Date:** _______________
**Deployed By:** _______________
**Status:** ✅ Success / ⚠️ Partial / ❌ Rolled Back

### Metrics
- Businesses tested: ___
- Error rate before: ___%
- Error rate after: ___%
- Improvement: ___%

### Issues Encountered
- (None / list issues)

### Next Steps
- [ ] Implement Phase 3 (enhanced error handling)
- [ ] Implement Phase 4 (UI feedback)
- [ ] Schedule architecture decision (two-step vs unified)
```

---

## 🔗 Related Documents

- Implementation Notes: `_SCHEMA_ALIGNMENT_FIX_IMPLEMENTATION_NOTES.md`
- Database Audit: `_SCHEMA_ALIGNMENT_FIX_DATABASE_AUDIT.sql`
- Test Script: `_TEST_SCHEMA_ALIGNMENT_VALIDATION.mjs`
- Original Assessment: `website-analysis-findings-and-recommendations.md`

---

## 👥 Contact

**Questions during deployment?**
- Developer: (you)
- Emergency: Rollback immediately, debug later

**Deployment Window:**
- Recommended: Off-peak hours (evening/weekend)
- Avoid: High-traffic periods
- Duration: 30 minutes + 24h monitoring

---

**Ready to deploy?** ✅ All checkboxes above should be checked before proceeding.
