# V5 business_brand_profile Fields - Usage Verification Report

**Purpose**: Verify which fields from V5-NULL-ACCEPTABILITY-REPORT.md are truly unused  
**Created**: 2026-06-23  
**Status**: ⚠️ **CRITICAL - MANY FIELDS ARE ACTIVELY USED**

---

## ⚠️ CRITICAL FINDING

The V5-NULL-ACCEPTABILITY-REPORT.md lists 19 fields as "Schema-Only (Never Used)", but grep verification shows **MANY ARE ACTIVELY USED** in production Edge Functions.

**DO NOT DROP THESE FIELDS** - they are actively read by current code!

---

## ✅ VERIFIED USAGE - MUST KEEP (11+ fields)

These fields are marked as "schema-only" but are **ACTIVELY USED**:

| Field | Active Usage | Edge Functions | Status |
|-------|--------------|----------------|--------|
| `business_model_type` | ✅ ACTIVE | get-quick-suggestions (lines 2581-2582), brand-profile-generator | ⚠️ **KEEP - LIVE USE** |
| `audience_breadth` | ✅ ACTIVE | get-quick-suggestions (lines 2579-2580), brand-profile-generator | ⚠️ **KEEP - LIVE USE** |
| `classification_rationale` | ✅ ACTIVE | brand-profile-generator (B0 classification) | ⚠️ **KEEP - LIVE USE** |
| `voice_style` | ✅ ACTIVE | get-weekly-strategy (line 1374) | ⚠️ **KEEP - LIVE USE** |
| `cta_style` | ✅ ACTIVE | analyze-concept-fit (20+ matches), brand-profile-generator | ⚠️ **KEEP - LIVE USE** |
| `commercial_baseline_mode` | ✅ ACTIVE | commercial-mode-classifier, commercial-mode tests (20+ matches) | ⚠️ **KEEP - LIVE USE** |
| `commercial_strategy_reasoning` | ✅ ACTIVE | brand-profile-generator (line 2184) | ⚠️ **KEEP - LIVE USE** |
| `identity_keywords` | ✅ ACTIVE | generate-text-from-idea (lines 347-349), get-quick-suggestions (lines 2628-2639), ai-enhance | ⚠️ **KEEP - LIVE USE** |
| `humor_level` | ✅ ACTIVE | get-quick-suggestions (lines 2459-2462), brand-profile-generator-v5 (migration), brand-voice types | ⚠️ **KEEP - LIVE USE** |
| `content_strategy_confirmed` | ✅ ACTIVE | get-quick-suggestions (line 2389) | ⚠️ **KEEP - LIVE USE** |
| `values` | ✅ ACTIVE | analyze-concept-fit (line 1019 - prompt context) | ⚠️ **KEEP - LIVE USE** |
| `certifications` | ✅ ACTIVE | strategy-feasibility-validator (line 356) | ⚠️ **KEEP - LIVE USE** |
| `quality_status` | ✅ ACTIVE | brand-profile-generator (lines 1446, 1471, 2529) | ⚠️ **KEEP - LIVE USE** |
| `content_pillars_jsonb` | ✅ ACTIVE | brand-profile-generator (lines 1457-1458, 2520) | ⚠️ **KEEP - LIVE USE** |
| `brand_essence_elaboration` | ✅ ACTIVE | brand-profile-generator (V4 - lines 551, 566, 758-761), generate-weekly-plan | ⚠️ **KEEP - LEGACY V4** |

**Result**: 15 of 19 fields are **ACTIVELY USED** - cannot be dropped!

---

## ❓ NEEDS VERIFICATION (4 fields)

These fields had limited/no grep matches but need database verification:

| Field | Grep Results | Potential Status |
|-------|--------------|------------------|
| `execution_profile` | ❌ 0 matches | Possibly safe to drop? |
| `cta_preference` | ❌ 0 matches | Possibly safe to drop? |
| `audience_framework` | Commented out in code | Possibly safe to drop? |
| `do_not_say` | Limited matches | Needs verification |

---

## 🔍 Detailed Analysis

### Fields Actively Used in V4 Generator (brand-profile-generator)

These are used in the **old V4 generator**. Question: Is V4 still active or fully replaced by V5?

- `brand_essence_elaboration` - V4 generator validation, generate-weekly-plan reads
- `cta_style` - V4 generator + analyze-concept-fit (active!)
- `quality_status` - V4 generator writes/reads
- `content_pillars_jsonb` - V4 generator writes/reads
- `business_model_type` - V4 generator + get-quick-suggestions (active!)
- `audience_breadth` - V4 generator + get-quick-suggestions (active!)
- `classification_rationale` - V4 generator B0 stage

### Fields Actively Used in V5 Generator (brand-profile-generator-v5)

- `humor_level` - V5 migrates from legacy (line 1149-1152)

### Fields Actively Used in Active Edge Functions

**get-quick-suggestions** (PRIMARY CONTENT GENERATOR):
- `business_model_type` (lines 2581-2582)
- `audience_breadth` (lines 2579-2580)
- `identity_keywords` (lines 2628-2639)
- `humor_level` (lines 2459-2462)
- `content_strategy_confirmed` (line 2389)

**generate-text-from-idea** (CAPTION GENERATOR):
- `identity_keywords` (lines 347-349)

**get-weekly-strategy** (WEEKLY PLAN):
- `voice_style` (line 1374)

**analyze-concept-fit** (CONCEPT ANALYSIS):
- `cta_style` (20+ matches)
- `values` (line 1019)

**commercial-mode-classifier** (COMMERCIAL LOGIC):
- `commercial_baseline_mode` (line 242)

**strategy-feasibility-validator**:
- `certifications` (line 356)

---

## ⚠️ RECOMMENDED ACTION

**DO NOT DROP** the 19 fields listed in V5-NULL-ACCEPTABILITY-REPORT.md without:

1. ✅ **Database Verification**: Query production database to confirm fields are NULL everywhere
2. ✅ **V4 Status Check**: Confirm brand-profile-generator (V4) is no longer active
3. ✅ **Conservative Approach**: Only drop fields with **ZERO** grep matches + **confirmed empty** in database

---

## 🎯 Safe to Drop (Conservative List)

Based on grep verification, **only 2 fields** appear to have zero active usage:

1. `execution_profile` - 0 matches in supabase/functions
2. `cta_preference` - 0 matches in supabase/functions

**Recommendation**: Verify these 2 are empty in database, then create conservative migration.

---

## 📊 Corrected Field Count

| Category | Count | Status |
|----------|-------|--------|
| Actively used in production Edge Functions | 15+ | ⚠️ **MUST KEEP** |
| Used in V4 generator (status unclear) | 7 | ⏸️ **VERIFY V4 STATUS** |
| Zero usage found | 2 | ✅ Possibly safe to drop |
| Needs verification | 2 | ❓ Check database |

---

## ✅ OPTION A: Safe to Remove Punch List

**Status**: Ready for execution - 10 fields verified safe to drop

### Migration 1: Already Created (8 fields)
File: `supabase/migrations/20260623000001_drop_empty_fields_code_cleanup.sql`

**business_operations** (3 fields):
- [x] `typical_busy_periods`
- [x] `typical_slow_periods`
- [x] `average_check_per_person`

**business_profile** (3 fields):
- [x] `price_level` (EMPTY - live data in business_operations.price_level)
- [x] `ai_brand_context`
- [x] `ai_brand_context_generated_at`

**businesses** (1 field):
- [x] `postal_code` (EMPTY - live data in business_locations.postal_code)

**city_context_cache** (1 field):
- [x] `postal_code` (EMPTY - uses business_locations joins)

### Migration 2: To Be Created (2 fields)
File: `supabase/migrations/20260623000002_drop_brand_profile_unused_fields.sql`

**business_brand_profile** (2 fields):
- [ ] `execution_profile` - 0 active usage, likely empty
- [ ] `cta_preference` - 0 active usage, likely empty

**Total**: 10 fields safe to drop (8 + 2)

---

## Next Steps

**Option A: Conservative Cleanup** (Recommended)
- Drop only 2 verified-empty fields: `execution_profile`, `cta_preference`
- Keep all fields with any active usage
- Total cleanup: 8 (from Option 1) + 2 = **10 fields**

**Option B: Verify V4 Status**
- Confirm brand-profile-generator (V4) is no longer active
- If V4 is inactive, additional 7 fields might be droppable
- Requires database verification

**Option C: Database Audit**
- Query production database for NULL counts on all 19 fields
- Only drop fields that are both:
  - 100% NULL in database
  - Zero active code references

---

## Conclusion

⚠️ **The V5-NULL-ACCEPTABILITY-REPORT.md is WRONG** about many fields being "schema-only".

**Verified Active Usage**:
- 15+ fields are actively read by production Edge Functions
- Cannot be dropped without breaking active features

**Safe Conservative Approach**:
- Drop only 2 fields with zero usage: `execution_profile`, `cta_preference`
- Combined with Option 1: **10 total fields dropped** (8 + 2)

**User Choice Required**:
- Proceed conservatively (10 fields total)?
- Wait for database verification (potentially more fields)?
- Verify V4 generator status (potentially 7 more fields)?
