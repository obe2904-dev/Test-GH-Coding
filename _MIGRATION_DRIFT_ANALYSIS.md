# Migration Drift Analysis
**Generated:** 2026-06-29  
**Status:** 232 unapplied migrations identified

## Executive Summary

Your codebase references columns that don't exist in the production database. This creates a **HIGH RISK** situation where:
- ✅ **Some operations work** (columns not saved to DB)
- ⚠️ **Some operations silently fail** (columns written but ignored)
- ❌ **Some may cause errors** (if database constraints get stricter)

---

## Critical Missing Columns (June 2026)

### 🔴 HIGH RISK - Written to Database

| Column | Table | Migration | Status | Impact |
|--------|-------|-----------|--------|--------|
| `location_strategy` | `business_brand_profile` | `20260626000001` | ⚠️ **WRITING TO DB** | 3 code refs, saved in v5 generator |
| `menu_results_v2_id` | `business_programme_profiles` | `20260629120000` | ✅ **FIXED** | Was causing 500 error, now resolved |
| `local_location_reference` | `businesses` | `20260628192940` | ⚠️ **LIKELY USED** | 147+ code refs across system |

**Risk:** These columns are being written to by the code but may not be saved, causing data loss.

---

### 🟡 MEDIUM RISK - Read from Database

| Column | Table | Migration | Status | Impact |
|--------|-------|-----------|--------|--------|
| `business_type_hybrid` | `businesses` | `20260625000000` | ⚠️ **READ OPERATIONS** | 18 code refs, used in suggestions |
| `day_pattern` | `business_programme_profiles` | `20260627000001` | ⚠️ **QUERY OPS** | 46+ code refs, heavy usage |
| `meal_periods` | `business_programme_profiles` | `20260627000001` | ⚠️ **QUERY OPS** | 4 code refs, frontend types |

**Risk:** If these are queried from DB, they'll return null/undefined, potentially breaking logic.

---

### 🟢 LOW RISK - Only in Code

| Column | Usage | Notes |
|--------|-------|-------|
| `meal_periods` | Intermediate data | Passed to AI prompts, not saved to DB |
| `day_pattern` | Intermediate data | Used for processing, not persisted |

**Risk:** Minimal - these are only used for temporary calculations.

---

## Evidence: Code vs Database

### 1. `location_strategy` - **ACTIVELY BEING WRITTEN**

**File:** `supabase/functions/brand-profile-generator-v5/index.ts:2090`
```typescript
.upsert({
  business_id: businessId,
  brand_profile_v5: v5Profile,
  location_strategy: locationStrategy,  // ⚠️ COLUMN DOESN'T EXIST
  // ...
})
```

**Migration:** `20260626000001_add_location_strategy.sql`
```sql
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS location_strategy JSONB DEFAULT NULL;
```

**Status:** ❌ Not applied to production

---

### 2. `local_location_reference` - **WIDELY REFERENCED**

**Usage Examples:**
- `supabase/functions/ai-enhance/index.ts` - SELECT query
- `supabase/functions/get-quick-suggestions/context-fetcher.ts` - SELECT query  
- `supabase/functions/brand-profile-generator-v5/index.ts` - Multiple refs
- Frontend: 13 TypeScript type definitions

**Migration:** `20260628192940_add_local_location_reference_to_businesses.sql`
```sql
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS local_location_reference TEXT;
```

**Status:** ❌ Not applied to production

---

### 3. `business_type_hybrid` - **QUERY OPERATIONS**

**File:** `supabase/functions/get-quick-suggestions/context-fetcher.ts`
```typescript
.select('name, business_type_hybrid, website_url, country')
```

**Migration:** `20260625000000_replace_vertical_with_hybrid.sql`
```sql
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS business_type_hybrid JSONB;
```

**Status:** ❌ Not applied to production

---

## Recommended Action Plan

### Immediate (Today)

1. **Apply critical June migrations**
   ```bash
   # Run these SQLs directly in Supabase Dashboard
   # In order of dependency:
   
   # 1. businesses table
   ALTER TABLE businesses
   ADD COLUMN IF NOT EXISTS local_location_reference TEXT;
   
   ALTER TABLE businesses 
   ADD COLUMN IF NOT EXISTS business_type_hybrid JSONB;
   
   # 2. business_brand_profile table
   ALTER TABLE business_brand_profile
   ADD COLUMN IF NOT EXISTS location_strategy JSONB DEFAULT NULL;
   
   # 3. business_programme_profiles table
   ALTER TABLE business_programme_profiles 
   ADD COLUMN IF NOT EXISTS meal_periods text[] DEFAULT '{}';
   
   ALTER TABLE business_programme_profiles 
   ADD COLUMN IF NOT EXISTS day_pattern text;
   ```

2. **Test brand profile generation** after applying above

---

### Short-term (This Week)

1. **Create schema baseline:**
   ```bash
   supabase db pull
   ```
   
2. **Archive old migrations:**
   ```bash
   mkdir supabase/migrations_archive
   mv supabase/migrations/202601*.sql supabase/migrations_archive/
   mv supabase/migrations/202602*.sql supabase/migrations_archive/
   mv supabase/migrations/202603*.sql supabase/migrations_archive/
   mv supabase/migrations/202604*.sql supabase/migrations_archive/
   mv supabase/migrations/202605*.sql supabase/migrations_archive/
   ```

3. **Keep only June 2026 migrations** that align with current code

---

### Long-term (Process Fix)

1. **Establish migration workflow:**
   - Local test: `supabase db reset` (test all migrations)
   - Remote apply: `supabase db push` (apply to production)
   - Frequency: Daily or after each schema change

2. **Add pre-commit hook** to prevent code using non-existent columns

3. **Document schema** in README with current column inventory

---

## Migration File Status

**Total local migrations:** ~380+  
**Applied to remote:** ~150  
**Unapplied:** 232

**Recent June migrations (unapplied):**
```
20260627000001_add_programme_meal_periods_day_pattern.sql
20260628192940_add_local_location_reference_to_businesses.sql
20260625000000_replace_vertical_with_hybrid.sql
20260626000001_add_location_strategy.sql
20260629120000_add_menu_results_v2_id_to_programme_profiles.sql ✅ FIXED
```

---

## Risk Assessment

| Risk Level | Count | Impact |
|------------|-------|--------|
| 🔴 High (Data Loss) | 3 columns | Write operations fail silently |
| 🟡 Medium (Null Data) | 3 columns | Read operations return unexpected nulls |
| 🟢 Low (No Impact) | Many | Old migrations for deleted features |

**Overall Risk:** 🔴 **HIGH**

**Mitigation:** Apply critical column migrations ASAP (see SQL above)
