# Phase 2a Fixes - Validation Report

**Date:** 2026-06-21  
**Week Tested:** Week 26, 2025  
**Strategy ID:** `0a3e5c5c-8140-4253-bc07-4e41b919dc36`

---

## ✅ FIXED: MEDIUM 4 - Slot ID Taxonomy Drift

### Before
- Legacy expansion created slot_ids like `A_exp2`, `C_exp3`
- Caused debugging confusion and undefined slot references

### After
- **Removed** legacy expansion code (lines 172-191)
- Added **validation** that throws error if slot count mismatch
- Added **revenue-adaptive distribution** that creates clean duplicates:
  - Instead of `A_exp2` → `"Frokostbesøg (2)"`
  - Semantic naming, easier to debug

### Validation Results
✅ **NO `_exp` patterns found** in generated strategy  
✅ **Angle count matches post count** (4 angles for 4 posts)  
✅ **Clean slot IDs**: A, B, C, D

---

## ⚠️ PARTIALLY FIXED: MEDIUM 5 - Metadata Consistency

### 5a. Time Drift ✅ FIXED
- Timing intelligence now provides `suggested_post_time`
- weekly-plan-generator uses it correctly
- No more time mismatches between strategy and plan

### 5b. Angle Focus Mislabeling ⚠️ STILL OCCURRING

**Problem:** Gemini 2.5 Flash in Phase 2a ignores "Brug EKSAKTE fokus-navne" instruction

**Evidence from Week 26:**
```
Post 1:
  angle_focus: "Midtuge boost med fokus på lokale stamgæster"  (Angle 4)
  slot_id: "A"  (Angle 1)  ← MISMATCH

Post 3:
  angle_focus: "Brand-fortælling om Café Fausts unikke beliggenhed"  (Angle 2)
  slot_id: "A"  (Angle 1)  ← MISMATCH

Post 4:
  angle_focus: "Frokostbesøg torsdag-fredag..."  (Angle 1)
  slot_id: "B"  (Angle 3)  ← MISMATCH
```

**Impact:**
- Posts get wrong metadata (strategic_intent, timing_window, etc.)
- Weight distribution becomes inaccurate
- Debugging confusion

**Mitigation Added:**
- Fuzzy matching with warning logs when exact match fails
- Fallback to any unused slot if no fuzzy match
- Console warnings should appear in function logs

**Still Needed:**
- Check if warnings actually fired (need function logs)
- Consider stricter prompt or different matching strategy
- Possibly switch Phase 2a to structured output mode

### 5c. Content Type Confusion ❓ NEEDS INVESTIGATION
- Still depends on Gemini interpretation
- Example: Post 1 is "Pariserbøf" (menu item) with angle_focus "Midtuge boost" (retention)
- Content type categorization may be off

---

## Summary

| Issue | Status | Details |
|-------|--------|---------|
| **MEDIUM 4: Slot ID Taxonomy** | ✅ **FIXED** | No legacy `_exp` patterns, clean slot IDs |
| **MEDIUM 5a: Time Drift** | ✅ **FIXED** | Timing intelligence working |
| **MEDIUM 5b: Angle Mislabeling** | ⚠️ **PARTIAL** | Fuzzy matching added, but Gemini still mislabels |
| **MEDIUM 5c: Content Type** | ❓ **UNKNOWN** | Needs real-world usage data |

---

## Recommendations

### High Priority
1. **Check function logs** for fuzzy matching warnings
2. If warnings fired → system is self-correcting ✅
3. If warnings didn't fire → prompt/matching logic needs adjustment ❌

### Medium Priority
4. Consider forcing Phase 2a to use structured output (JSON schema validation)
5. Add stricter validation: throw error if >50% of posts fail exact match

### Low Priority
6. Monitor content_type categorization in production
7. Consider adding Phase 2a validation step before Phase 2b

---

## Deployment Status

- ✅ Code deployed: 782.9kB
- ✅ Validation complete
- ⚠️ Angle matching needs monitoring
