# 🔧 Database Migration & Deployment Instructions

## CRITICAL: Run These Migrations in Supabase

### Step 1: Fix RLS Policies (MUST DO FIRST)
This fixes "permission denied" errors that block users from accessing their own data.

**File:** `supabase/migrations/20251221000000_fix_rls_policies.sql`

**How to run:**
1. Open Supabase Dashboard → SQL Editor
2. Copy the entire contents of `20251221000000_fix_rls_policies.sql`
3. Click "Run" - should show "Success"
4. Verify: Run this query to check policies were created:
   ```sql
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public' 
   ORDER BY tablename, policyname;
   ```

**What this fixes:**
- ✅ Users can now SELECT from business_locations
- ✅ Users can now SELECT from business_profile
- ✅ Users can now SELECT from business_brand_profile
- ✅ Users can now SELECT/INSERT/UPDATE opening_hours
- ✅ Team members get proper access (for future team features)

---

### Step 2: Sync Existing Data (IF YOU HAVE EXISTING USERS)
This migrates data from the old `profiles` schema to the new `businesses` schema.

**File:** `supabase/migrations/20251221000001_sync_profiles_to_businesses.sql`

**When to run:**
- ✅ If you have existing users who completed onboarding before this migration
- ❌ Skip if this is a fresh install with no users

**How to run:**
1. Open Supabase Dashboard → SQL Editor
2. Copy the entire contents of `20251221000001_sync_profiles_to_businesses.sql`
3. Click "Run"
4. Check results:
   ```sql
   -- Verify businesses were created
   SELECT COUNT(*) FROM businesses;
   
   -- Verify locations were created
   SELECT COUNT(*) FROM business_locations;
   
   -- Verify opening hours were migrated
   SELECT COUNT(*) FROM opening_hours;
   ```

**What this does:**
- ✅ Creates `businesses` records from `profiles.business_name`
- ✅ Creates `business_locations` from `profiles.phone` and `profiles.business_email`
- ✅ Creates `business_profile` from `profiles.about_text`
- ✅ Converts `profiles.opening_hours` (JSONB) to `opening_hours` table rows
- ✅ Sets all businesses to 'free' plan by default

---

## Verification Checklist

After running migrations, test these flows:

### 1. Test Onboarding (New User)
```bash
# Create a test user
# Complete onboarding
# Check that business is created:
```
```sql
SELECT b.*, bl.* 
FROM businesses b
LEFT JOIN business_locations bl ON bl.business_id = b.id
WHERE b.owner_id = 'YOUR_USER_ID';
```

### 2. Test Business Profile Page
- Log in as existing user
- Navigate to Business Profile
- Should see your business name, city, phone
- Should NOT see "permission denied" errors in console

### 3. Test Opening Hours
- Go to Business Profile → Info tab → Opening Hours
- Add opening hours
- Save
- Refresh page
- Should load correctly

---

## Current Schema Status

### ✅ COMPLETED:
- `businesses` table with RLS policies
- `business_locations` table with RLS policies
- `business_profile` table with RLS policies
- `business_brand_profile` table with RLS policies
- `opening_hours` table with RLS policies
- `social_accounts` table with RLS policies
- Onboarding RPC function (`create_business_onboarding`)

### ⚠️ LEGACY (Still Active):
- `profiles` table - Contains business data for old users
- Some UI components still read from `profiles` as fallback
- Will be fully deprecated after all users migrate

### 🎯 DATA FLOW:
```
New User Signup
  ↓
OnboardingPage
  ↓
RPC: create_business_onboarding()
  ↓
Creates: businesses + business_locations
  ↓
BusinessProfilePage loads from businesses ✅
```

---

## Rollback Plan (If Migrations Fail)

### To rollback RLS policies:
```sql
-- Drop the new policies (they won't affect old data)
DROP POLICY IF EXISTS "Users can view their business locations" ON business_locations;
DROP POLICY IF EXISTS "Team members can view business locations" ON business_locations;
-- ... (repeat for all policies created)
```

### To rollback data sync:
```sql
-- Delete synced data (won't affect profiles table)
DELETE FROM opening_hours WHERE business_id IN (
  SELECT id FROM businesses WHERE created_at > '2025-12-21'
);
DELETE FROM business_locations WHERE created_at > '2025-12-21';
DELETE FROM businesses WHERE created_at > '2025-12-21';
```

---

## Next Steps (After Migrations)

1. ✅ Run migrations in Supabase
2. ✅ Test onboarding flow
3. ✅ Test business profile loading
4. ✅ Monitor Supabase logs for errors
5. 🔄 (Optional) Remove quota duplication (see next section)

---

## Known Issues (Being Addressed)

### 1. Quota Logic Duplication
**Status:** Non-critical, but should be fixed
**Files affected:**
- `src/config/quotas.ts` (source of truth)
- `src/stores/tierStore.ts` (duplicate definitions)
- `supabase/functions/_shared/quota-utils.ts` (backend duplicate)

**Fix plan:** Remove duplicates, use only `config/quotas.ts`

### 2. BusinessProfilePage Size
**Status:** Works but hard to maintain (2,119 lines)
**Fix plan:** Refactor into smaller components (future work)

### 3. Website Analyzer Worker
**Status:** ✅ Has all dependencies
**Note:** Error about missing `playwright` was incorrect - it's in requirements.txt

---

## Support

If you encounter issues:
1. Check Supabase logs: Dashboard → Logs
2. Check browser console for errors
3. Verify policies: `SELECT * FROM pg_policies WHERE schemaname = 'public';`
4. Check your `.env` file has correct Supabase keys

---

## Summary

**Required Actions:**
1. ✅ Run `20251221000000_fix_rls_policies.sql` in Supabase
2. ⚠️ Run `20251221000001_sync_profiles_to_businesses.sql` if you have existing users
3. ✅ Test onboarding and business profile page

**Time Estimate:** 10-15 minutes

**Risk Level:** Low (no data deletion, only adds policies and syncs data)

---

Last Updated: December 21, 2025
