# SPRINT 1: PRE-DEPLOYMENT CHECKLIST

**Date:** January 2026  
**Sprint:** Complexity Reduction - Sprint 1  
**Reviewer:** [Owner Name]

---

## 🎯 DEPLOYMENT READINESS

### Stage 1: Code Review
- [ ] Review all modified files listed in SPRINT-1-IMPLEMENTATION-SUMMARY.md
- [ ] Verify no unintended changes to unrelated code
- [ ] Check TypeScript compilation (frontend): `npm run build`
- [ ] Check Supabase function deployment readiness

### Stage 2: Local Testing (Development Environment)
- [ ] Generate new brand profile → verify completes in ~135s
- [ ] Verify generated profile DOES NOT include `voice_options`, `voice_archetype`, `audience_framework`
- [ ] Check frontend dashboard → archetype selector should NOT appear
- [ ] Test Dagens Forslag → verify suggestions still generate correctly
- [ ] Test Weekly Plan generation → verify programmes rotate correctly

### Stage 3: Database Migration (Staging First)
- [ ] **STAGING:** Run SPRINT-1-COMPLEXITY-REDUCTION-MIGRATION.sql
- [ ] **STAGING:** Verify column count: should be 74 (down from 77)
- [ ] **STAGING:** Test brand profile generation end-to-end
- [ ] **STAGING:** Test content generation (Dagens Forslag, Weekly Plan)

### Stage 4: Production Deployment
- [ ] Deploy backend functions (Supabase)
- [ ] Deploy frontend (Vercel/hosting)
- [ ] **PRODUCTION:** Run SPRINT-1-COMPLEXITY-REDUCTION-MIGRATION.sql
- [ ] **PRODUCTION:** Verify column count: should be 74
- [ ] **PRODUCTION:** Smoke test: generate 1 brand profile → verify success

### Stage 5: Post-Deployment Validation
- [ ] Monitor Supabase logs for errors (first 24h)
- [ ] Check dashboard usage analytics → verify no errors
- [ ] Test with 3-5 real businesses → verify quality maintained
- [ ] Measure generation time → should average ~135s (down from ~150s)

---

## ⚠️ ROLLBACK PLAN

If critical issues detected after deployment:

### Immediate Actions
1. **Database:** Run rollback SQL
   ```sql
   ALTER TABLE business_brand_profile 
     ADD COLUMN voice_options JSONB,
     ADD COLUMN voice_archetype TEXT,
     ADD COLUMN audience_framework JSONB;
   ```

2. **Code:** Revert to previous deployment
   - Backend: redeploy previous Supabase functions
   - Frontend: redeploy previous build

3. **Validation:** Verify system returns to baseline functionality

### Rollback Success Criteria
- [ ] Brand profile generation works
- [ ] Dashboard displays profiles correctly
- [ ] Content generation (Dagens Forslag, Weekly Plan) works

---

## 📊 SUCCESS METRICS

Track these metrics for 7 days post-deployment:

| Metric | Baseline (Before) | Target (After) | Actual |
|--------|-------------------|----------------|--------|
| Brand profile generation time | ~150s | ~135s | ___ |
| Database columns | 77 | 74 | ___ |
| Generation success rate | ~95% | ≥95% | ___ |
| Content quality (manual review) | Baseline | ≥Baseline | ___ |
| Dashboard errors (frontend) | <1% | <1% | ___ |

---

## 🚨 KNOWN RISKS & MITIGATIONS

### Risk 1: Existing profiles with voice_archetype data
**Impact:** Owners who previously switched archetypes will lose that data  
**Mitigation:** Expected. They get ONE voice going forward. If unsatisfied, regenerate.  
**Severity:** Low (UI already handles missing data gracefully)

### Risk 2: Cached frontend state
**Impact:** Users with old cached bundle may see archetype selector (frontend out of sync with backend)  
**Mitigation:** Force cache bust on deploy (update version string in package.json)  
**Severity:** Low (resolves on refresh)

### Risk 3: Integration tests relying on voice_archetype
**Impact:** Automated tests may fail if they assert on removed columns  
**Mitigation:** Update tests before deploying, or temporarily skip voice-related assertions  
**Severity:** Medium (blocks CI/CD if not addressed)

---

## ✅ SIGN-OFF

**Code Review Completed:** [ ] YES [ ] NO  
**Local Testing Passed:** [ ] YES [ ] NO  
**Staging Validation Passed:** [ ] YES [ ] NO  
**Production Deployment Approved:** [ ] YES [ ] NO  

**Reviewer Signature:** ___________________  
**Date:** ___________________  

---

## 📝 POST-DEPLOYMENT NOTES

_Use this section to document any issues encountered during deployment or observations from the first 7 days._

---

**Next Sprint:** Sprint 2 - Voice Field Reduction (13→5 fields)  
**Expected Start:** After 7-day observation period
