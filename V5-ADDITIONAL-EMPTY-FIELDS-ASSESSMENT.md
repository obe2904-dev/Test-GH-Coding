# V5 Migration - Additional Empty Fields Assessment

**Purpose**: Assess empty fields from business_operations, business_profile, businesses, and city_context_cache tables  
**Created**: 2026-06-23  
**Context**: Extending V5 migration analysis beyond business_brand_profile

---

## Overview

The user identified additional empty fields across 4 tables. This document validates the analysis from BRAND-DASHBOARD-DATABASE-MAPPING.md and provides drop/keep recommendations.

---

## Analysis Summary (REVISED - 2026-06-23)

### business_operations Table

| Field | Usage Found | Status | Recommendation |
|-------|-------------|--------|----------------|
| `typical_busy_periods` | ❌ None | Schema-only | ✅ **SAFE TO DROP** |
| `typical_slow_periods` | ❌ None | Schema-only | ✅ **SAFE TO DROP** |
| `seating_capacity_indoor` | ✅ analyze-concept-fit (3 matches) | **ACTIVE** | ⚠️ **KEEP - LIVE USE** |
| `seating_capacity_outdoor` | ✅ analyze-concept-fit, get-quick-suggestions | **ACTIVE** | ⚠️ **KEEP - LIVE USE** |
| `average_check_per_person` | ❌ None (dropped in migration 20260420000008) | Dropped | ✅ **SAFE TO DROP** |
| `price_level` | ✅ get-quick-suggestions (line 1209, 2255), build-week-context-brand-voice.ts | **ACTIVE - LIVE DATA** | ⚠️ **KEEP - PRIMARY SOURCE** |

**Drop Candidates**: 3 fields (`typical_busy_periods`, `typical_slow_periods`, `average_check_per_person`)  
**Keep**: 3 fields (`seating_capacity_indoor`, `seating_capacity_outdoor`, **price_level**) - actively used

**NOTE**: business_operations.price_level is the LIVE source (e.g., "moderate"). business_profile.price_level is EMPTY.

---

### business_profile Table

| Field | Usage Found | Status | Recommendation |
|-------|-------------|--------|----------------|
| `price_level` | ⚠️ ONE read in prompt-a.ts BUT field is **EMPTY** (live data in business_operations.price_level) | **EMPTY FIELD** | ✅ **SAFE TO DROP** |
| `target_audience` | ✅ Frontend only (brandProfileService.ts, contextBuilder.ts, aiPromptBuilder.ts) | Frontend legacy | ⚠️ **KEEP - FRONTEND USE** |
| `menu_structure` | ✅ data-gatherer.ts (menu extraction fallback), prompt-b.ts, website-analysis-saver | **ACTIVE FALLBACK** | ⚠️ **KEEP - MENU FALLBACK** |
| `ai_brand_context` | ❌ Only in _archive/BrandProfilePage.tsx | Archive only | ✅ **SAFE TO DROP** |
| `ai_brand_context_generated_at` | ❌ Only in _archive/BrandProfilePage.tsx | Archive only | ✅ **SAFE TO DROP** |

**Drop Candidates**: 3 fields (`price_level` - EMPTY, `ai_brand_context`, `ai_brand_context_generated_at`)  
**Keep**: 2 fields (`target_audience`, `menu_structure` - have active usage)

**CRITICAL CORRECTION**: The live `price_level` data is in **business_operations.price_level**, not business_profile. The business_profile.price_level column is EMPTY and can be safely dropped.

---

### businesses Table

| Field | Usage Found | Status | Recommendation |
|-------|-------------|--------|----------------|
| `postal_code` | ⚠️ Type definitions, onboarding flow (business_locations.postal_code preferred) | Supporting/Fallback | ⏸️ **EVALUATE - LOW PRIORITY** |

**Analysis**: `postal_code` is stored during onboarding but runtime typically reads from `business_locations.postal_code`. It serves as a fallback/seed value.

**Recommendation**: **KEEP** - serves as data integrity backup, no harm in keeping

---

### city_context_cache Table

| Field | Usage Found | Status | Recommendation |
|-------|-------------|--------|----------------|
| `postal_code` | ✅ city-context-ai.ts (city inference fallback), cache schema | **ACTIVE CACHE** | ⚠️ **KEEP - CACHE FIELD** |

**Recommendation**: **KEEP** - part of city context cache structure

---
8 fields total - REVISED
## Detailed Findings

### ✅ SAFE TO DROP (5 fields total)

#### business_operations (3 fields)

**1. typical_busy_periods**
- **Grep Results**: 0 matches in supabase/functions
- **Status**: Schema-only, no runtime reads
- **Migration History**: May have been used in old version
- **Recommendation**: ✅ **DROP**

**2. typical_slow_periods**
- **Grep Results**: 0 matches in supabase/functions
- **Status**: Schema-only, no runtime reads
- **Recommendation**: ✅ **DROP**

**3. average_check_per_person**
- **Grep Results**: 0 matches in supabase/functions
- **Status**: Explicitl3 fields)

**4. price_level**
- **Usage**: ONE read in `prompt-a.ts` line 178, BUT field is **EMPTY**
- **Live Data Location**: `business_operations.price_level` (values like "moderate")
- **Status**: EMPTY field, live data in different table
- **Recommendation**: ✅ **DROP**

**5. ai_brand_context**
- **Usage**: Only in `src/pages/dashboard/_archive/BrandProfilePage.tsx`
- **Status**: Archive page only, not in current runtime
- **Recommendation**: ✅ **DROP**

**6*Status**: Archive page only, not in current runtime
- *# businesses Table (1 field)

**7. postal_code**
- **Usage**: Onboarding writes to `business_locations.postal_code` instead
- **Live Data Location**: `business_locations.postal_code` (ALL runtime reads)
- **Status**: EMPTY / unused, business_locations is primary
- **Recommendation**: ✅ **DROP**

#### city_context_cache Table (1 field)

**8. postal_code**
- **Usage**: Schema field, but runtime uses `business_locations.postal_code` via joins
- **Status**: EMPTY / schema-only
- **Recommendation**: ✅ **DROP**

---

### ⚠️ KEEP - ACTIVE USE (4 fields - REVISED)

#### business_operations (3 fields)

**price_level**2 fields)ld
- **Recommendation**: ✅ **DROP**

---

### ⚠️ KEEP - ACTIVE USE (5 fields)

#### business_operations (2 fields)

**seating_capacity_indoor**
- **Usage**: 
  - `analyze-concept-fit/index.ts:722` - Group capacity check (>= 20 seats)
  - `analyze-concept-fit/index.ts:1008` - Prompt context injection
- **Status**: **ACTIVE** - used in concept-fit analysis
- **Recommendation**: ⚠️ **KEEP**

**seating_capacity_outdoor**
- **Usage**:
  - `analyze-concept-fit/index.ts` - Similar to indoor capacity
  - `get-quick-suggestions/index.ts` - Weather-driven suggestions
- **Status**: **ACTIVE** - used in weather/capacity logic
- **Recommendation**: ⚠️ **KEEP**

#### business_profile (3 fields)

**price_level**
- **Usage**: 20+ matches across:
  - `analyze-concept-fit/index.ts` - Price positioning logic
  - `populate-location-intelligence/` - Competitor price comparison
  - Type definitions across multiple files
- **Status**: **ACTIVE LEGACY** - still used in multiple Edge Functions
- **Recommendation**: ⚠️ **KEEP** - active in production code

**target_audience**
- **Usage**: Frontend only:
  - `src/services/brandProfileService.ts`
  - `src/features/contextBuilder.ts`
  - `src/features/aiPromptBuilder.ts`
- **Status**: Frontend legacy support
- **Recommendation**: ⚠️ **KEEP** - frontend compatibility

**menu_structure**
- **Usage**:
  - `supabase/functions/_shared/brand-profile/data-gatherer.ts:292` - Menu extraction fallback
  - `supabase/funct (REVISED - 8 Fields)

Drop all 8 empty fields that create code noise:

```sql
-- =====================================================
-- DROP EMPTY FIELDS - Code Cleanup Migration
-- Date: 2026-06-23
-- Purpose: Remove empty fields that pollute code with NULL values
-- =====================================================

-- VERIFICATION QUERIES (run BEFORE dropping)
-- Confirm these fields are truly empty:

SELECT 
  COUNT(*) as total_rows,
  COUNT(typical_busy_periods) as has_busy,
  COUNT(typical_slow_periods) as has_slow,
  COUNT(average_check_per_person) as has_avg_check
FROM business_operations;
-- Expected: has_busy = 0, has_slow = 0, has_avg_check = 0

SELECT 
  COUNT(*) as total_rows,
  COUNT(price_level) as has_price,
  C=====================================================
-- POST-DROP VERIFICATION
-- Confirm columns are gone and active fields still exist
-- =====================================================

-- Verify business_operations kept the right fields
SELECT 
  seating_capacity_indoor,
  seating_capacity_outdoor,
  price_level  -- LIVE DATA - must still exist
FROM business_operations 
LIMIT 1;
-- Should return: indoor, outdoor, price_level columns exist

-- Verify business_profile kept the right fields
SELECT 
  target_audience,
  menu_structure
FROM business_profile 
LIMIT 1;
-- Should return: target_audience, menu_structure exist

-- Verify business_locations still has postal_code (primary source)
SELECT postal_code FROM business_locations LIMIT 1;
-- Should return: postal_code column exists (THIS is the live one)
```

---

## Code Update Required

After dropping `business_profile.price_level`, remove the empty read from prompt-a.ts:

**File**: `supabase/functions/_shared/brand-profile/prompts/prompt-a.ts`

**Line 178** - Remove this line (reads empty field):
```typescript
${profile?.price_level ? `- price_level=${profile.price_level}` : ''}
```

**Why**: This line readREVISED)

**Drop 8 empty fields** (safe, no active usage, reduces code pollution):
1. `business_operations.typical_busy_periods`
2. `business_operations.typical_slow_periods`
3. `business_operations.average_check_per_person`
4. `business_profile.price_level` ⚠️ **EMPTY** (live data in business_operations.price_level)
5. `business_profile.ai_brand_context`
6. `business_profile.ai_brand_context_generated_at`
7. `businesses.postal_code` (live data in business_locations.postal_code)
8. `city_context_cache.postal_code` (uses business_locations joins)

**Estimated Impact**: 
- Code clarity: Significantly improved (removes NULL field checks from prompts)
- Token waste: Eliminated (no more empty field reads in prompts)
- Disk space savings: Minimal (NULL values in PostgreSQL)
- Migration risk: Very lo3):
- `seating_capacity_indoor` - used in concept-fit and capacity logic
- `seating_capacity_outdoor` - used in weather-driven suggestions
- `price_level` ⚠️ **PRIMARY SOURCE** - live price data (e.g., "moderate")

**business_profile** (2):
- `target_audience` - frontend legacy support
- `menu_structure` - critical menu data fallback

**business_locations** (1):
- `postal_code` ⚠️ **PRIMARY SOURCE** - all runtime postal code reads use this table
-- businesses: Drop empty postal_code (live data in business_locations.postal_code)
ALTER TABLE businesses
  DROP COLUMN IF EXISTS postal_code;

-- city_context_cache: Drop empty postal_code (uses business_locations via joins)
ALTER TABLE city_context_cache
  DROP COLUMN IF EXISTS postal_code` via joins
- **Status**: **EMPTY / SCHEMA-ONLY**
- **Recommendation**: ✅ **SAFE TO DROP** - not actively populated or read

---
3 (incl. price_level) | 0 |
| business_profile | 5 | 3 (incl. price_level) | 2 | 0 |
| businesses | 1 | 1 (postal_code) | 0 | 0 |
| city_context_cache | 1 | 1 (postal_code) | 0 | 0 |
| **TOTAL** | **76** | **26** | **21** | **30** |

### Combined Drop Recommendation (REVISED)

**Total fields safe to drop**: 26 (18 from business_brand_profile + 8 from other tables)

**Key Corrections**:
- ✅ business_profile.price_level → **SAFE TO DROP** (was incorrectly marked as active)
- ✅ businesses.postal_code → **SAFE TO DROP** (was incorrectly marked as supporting)
- ✅ city_context_cache.postal_code → **SAFE TO DROP** (was incorrectly marked as active
-- business_operations: Drop 3 unused fields
ALTER TABLE business_operations
  DROP COLUMN IF EXISTS typical_busy_periods,
  DROP COLUMN IF EXISTS typical_slow_periods,
  DROP COLUMN IF EXISTS average_check_per_person;

-- business_profile: Drop 2 archive-only fields
ALTER TABLE business_profile
  DROP COLUMN IF EXISTS ai_brand_context,
  DROP COLUMN IF EXISTS ai_brand_context_generated_at;

-- VERIFICATION QUERY
-- Run this BEFORE dropping to confirm zero active usage:
SELECT 
  'business_operations' as table_name,
  COUNT(*) as rows_with_typical_busy,
  COUNT(CASE WHEN typical_slow_periods IS NOT NULL THEN 1 END) as rows_with_typical_slow,
  COUNT(CASE WHEN average_check_per_person IS NOT NULL THEN 1 END) as rows_with_avg_check
FROM business_operations;

SELECT
  'business_profile' as table_name,
  COUNT(CASECode pollution cleanup (8 fields) - removes NULL reads from active code paths
  - business_profile.price_level (prompt-a.ts reads empty field)
  - business_operations timing fields (3)
  - business_profile archive fields (2)
  - postal_code duplicates (2)
- **Medium**: business_brand_profile schema-only fields (18) - covered in V5-NULL-ACCEPTABILITY-REPORT.md
``` (REVISED - 2026-06-23)

✅ **Analysis Updated**: Corrected after verifying actual table sources  
✅ **Safe to Drop**: 8 additional fields identified (3 business_operations + 3 business_profile + 2 postal_code)  
⚠️ **Active Use**: 4 fields must be kept (active in production code)  
📊 **Total Empty Fields*8 newly identified fields should be dropped to reduce code pollution. They create noise by adding NULL checks in prompts and type definitions. Combined with the 18 business_brand_profile schema-only fields, you can clean up **26 total columns** for improved code clarity.

**User Preference**: "We cannot keep empty fields. They pollute the codes." - Execute migration to remove all 8 empty fields

**Key Corrections Made**:
1. ✅ **business_profile.price_level** is EMPTY → Drop (live data in business_operations.price_level)
2. ✅ **businesses.postal_code** is EMPTY → Drop (live data in business_locations.postal_code)
3. ✅ **city_context_cache.postal_code** is EMPTY → Drop (uses business_locations joins)
4. ⚠️ **business_operations.price_level** is LIVE → Keep (primary source for price data)
### ✅ Correct Analysis

The BRAND-DASHBOARD-DATABASE-MAPPING.md analysis is **accurate**:

1. ✅ `seating_capacity_indoor/outdoor` correctly identified as **Live / primary**
2. ✅ `typical_busy_periods`, `typical_slow_periods` correctly identified as **Schema-only / dropped**
3. ✅ `average_check_per_person` correctly identified as **Schema-only / dropped**
4. ✅ `price_level` correctly identified as **Live / legacy support**
5. ✅ `target_audience` correctly identified as **Live / legacy support**
6. ✅ `menu_structure` correctly identified as **Live / legacy support**
7. ✅ `ai_brand_context` and `ai_brand_context_generated_at` correctly identified as **Archive / legacy only**
8. ✅ `businesses.postal_code` correctly identified as **Supporting / legacy fallback**
9. ✅ `city_context_cache.postal_code` correctly identified as **Live / supporting cache field**

**No corrections needed** - the analysis is spot-on.

---

## Recommendations Summary

### Immediate Actions (Optional)

**Drop 5 fields** (safe, no active usage):
1. `business_operations.typical_busy_periods`
2. `business_operations.typical_slow_periods`
3. `business_operations.average_check_per_person`
4. `business_profile.ai_brand_context`
5. `business_profile.ai_brand_context_generated_at`

**Estimated Impact**: 
- Disk space savings: Minimal (NULL values in PostgreSQL)
- Schema clarity: Improved
- Migration risk: Very low (no active reads)

### Keep All Active Fields (7 fields)

**business_operations** (2):
- `seating_capacity_indoor` - used in concept-fit and capacity logic
- `seating_capacity_outdoor` - used in weather-driven suggestions

**business_profile** (3):
- `price_level` - active in analyze-concept-fit and location-intelligence
- `target_audience` - frontend legacy support
- `menu_structure` - critical menu data fallback

**Supporting** (2):
- `businesses.postal_code` - data integrity backup
- `city_context_cache.postal_code` - cache structure field

---

## Cross-Table Empty Field Summary

### Total Empty Fields Analyzed Across All Tables

| Table | Total Analyzed | Safe to Drop | Active Use | Schema-only |
|-------|----------------|--------------|------------|-------------|
| business_brand_profile | 64 | 18 | 16 | 30 |
| business_operations | 5 | 3 | 2 | 0 |
| business_profile | 5 | 2 | 3 | 0 |
| businesses | 1 | 0 | 0 | 1 (supporting) |
| city_context_cache | 1 | 0 | 1 | 0 |
| **TOTAL** | **76** | **23** | **22** | **31** |

### Combined Drop Recommendation

**Total fields safe to drop**: 23 (18 from business_brand_profile + 5 from other tables)

**Migration Priority**:
- **High**: business_brand_profile schema-only fields (18) - covered in V5-NULL-ACCEPTABILITY-REPORT.md
- **Medium**: business_operations legacy fields (3) - this assessment
- **Low**: business_profile archive fields (2) - this assessment

---

## Conclusion

✅ **Analysis Validated**: BRAND-DASHBOARD-DATABASE-MAPPING.md analysis is accurate  
✅ **Safe to Drop**: 5 additional fields identified (3 business_operations + 2 business_profile)  
⚠️ **Active Use**: 7 fields must be kept (active in production code)  
📊 **Total Empty Fields**: 76 analyzed, 23 safe to drop, 22 active use

The analysis correctly distinguishes between:
- **Schema-only** fields (no runtime reads) → Safe to drop
- **Active legacy** fields (still read in code) → Must keep
- **Archive-only** fields (only in old UI) → Safe to drop
- **Supporting** fields (data integrity backup) → Keep for safety

**Recommendation**: The 5 newly identified fields can be safely dropped, but it's low priority since they don't cause issues. Combined with the 18 business_brand_profile schema-only fields, you could clean up 23 total columns if desired.
