# V5 Generator Migration Status
**Date:** 2. juni 2026  
**Decision:** Migrate to brand-profile-generator-v5 (5-layer programme-aware system)

---

## Current Status: PARTIALLY MIGRATED

### Migrations Applied Successfully ✅
From December 2025 to January 2026:
- `20251220111140` - Vertical-specific tables (FIXED uuid function)
- `20251220111150` - Logo URL
- `20251220111200` - Requeue stale menu results
- `20251220112500` - Fix menu results RLS
- `20251220120000` - Restrict menu queue RPCs
- `20251221000000` - Fix RLS policies
- `20251221000001` - Sync profiles to businesses
- `20251223093000` - Website analysis extracted fields
- `20251223100000` - Website analysis crawl fields

### Migrations Still Pending ❌
**Critical V5 Migrations** (needed for full V5 functionality):
- `20260106000000` - Brand voice and lifecycle columns
- `20260107000000` - Location enrichment and execution profile
- `20260108000000` - Quality status to brand profile
- `20260108140000` - Tone model column
- `20260113000000` - Business knowledge foundation
- `20260506_create_business_programme_profiles.sql` ← **KEY V5 TABLE**
- `20260506_add_positioning_column.sql`
- `20260506_add_layer3_fields.sql`
- `20260507_add_commercial_reasoning.sql`
- `20260508_integrate_voice_v5.sql`
- `20260509_add_brand_profile_v5_jsonb.sql`
- And ~120 more migrations...

### Blocking Issues

1. **Orphaned Remote Migrations**
   - Remote database has migrations not in local history
   - Causes `supabase db push` to reject all new migrations
   - Repair command needed for each orphaned migration

2. **Policy Conflicts**
   - Migration `20251224000001` tries to create policies that already exist
   - Marked as applied to skip, but prevents batch migration

3. **Missing Tables**
   - `weekly_content_plans` doesn't exist (migration `20260211000003` fails)
   - `business_programme_profiles` not created yet (V5 won't work without this!)

---

## What This Means

### V4 Generator (`brand-profile-generator`)
- **Status:** ❌ CANNOT SAVE
- **Reason:** Database missing columns: `tone_of_voice`, `content_focus`, etc.
- **Drinks Filter:** ✅ Code deployed and working (logs confirm)
- **Can Test:** ❌ No, save fails immediately

### V5 Generator (`brand-profile-generator-v5`)
- **Status:** ❌ CANNOT RUN
- **Reason:** Missing `business_programme_profiles` table (created in migration `20260506`)
- **Drinks Filter:** Built into Layer 1 (Programme Detection)
- **Can Test:** ❌ No, will fail on missing table

---

## Migration Strategy Options

### Option A: Manual Migration Repair (COMPLEX, 2-4 hours)
**Steps:**
1. Identify all orphaned remote migrations
2. Run `supabase migration repair --status reverted <ID>` for each
3. Fix or skip all failing migrations
4. Apply remaining 120+ migrations one batch at a time
5. Fix any new conflicts that arise

**Risks:**
- Time-consuming (many conflicts to resolve)
- May break existing features
- Production downtime possible

### Option B: Fresh Schema Reset (DESTRUCTIVE, 30 mins)
**Steps:**
1. Backup all production data
2. Reset migration history: `supabase db reset --linked`
3. Apply all migrations in one go
4. Restore data

**Risks:**
- ⚠️ **DESTROYS ALL DATA** if backup/restore fails
- Not recommended for production database

### Option C: Create V5 Table Manually (QUICK, 15 mins)
**Steps:**
1. Read migration file: `20260506_create_business_programme_profiles.sql`
2. Execute SQL directly on production database
3. Manually create other critical V5 tables
4. Mark migrations as applied
5. Test V5 generator

**Risks:**
- Manual process error-prone
- Migration history out of sync
- May miss dependencies

### Option D: Wait for Complete Migration (SAFEST, schedule downtime)
**Steps:**
1. Schedule maintenance window
2. Work through migrations systematically
3. Test thoroughly before re-enabling

**Risks:**
- Delays V5 adoption
- Drinks filter testing blocked until complete

---

## Recommended Approach: **Option C** (Manual V5 Tables)

Since you want to use V5 and test the drinks filter:

1. **Create Essential V5 Tables Manually**
   ```sql
   -- Execute these SQL files directly:
   - 20260506_create_business_programme_profiles.sql
   - 20260506_add_positioning_column.sql
   - 20260506_add_layer3_fields.sql
   ```

2. **Mark Migrations as Applied**
   ```bash
   supabase migration repair --status applied 20260506_create_business_programme_profiles
   supabase migration repair --status applied 20260506_add_positioning_column
   supabase migration repair --status applied 20260506_add_layer3_fields
   ```

3. **Test V5 Generator**
   ```bash
   curl -X POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5' \
     -H "Authorization: Bearer <SERVICE_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"businessId": "f4679fa9-3120-4a59-9506-d059b010c34a", "forceRegenerate": true}'
   ```

4. **Gradually Apply Remaining Migrations** (background task)
   - Work through migration conflicts during off-hours
   - Don't block V5 testing on full migration completion

---

## Immediate Next Steps

1. **Read V5 migration files to understand schema**
   ```bash
   cat supabase/migrations/20260506_create_business_programme_profiles.sql
   cat supabase/migrations/20260506_add_positioning_column.sql
   ```

2. **Execute SQL directly on production** (via Supabase dashboard or psql)

3. **Update frontend to use V5**
   - Change calls from `brand-profile-generator` to `brand-profile-generator-v5`
   - Use `useBrandProfileV5Generation` hook instead of `useBrandProfileGeneration`

4. **Test drinks filter in V5 context**
   - V5 has programme detection in Layer 1
   - Drinks filtering happens during programme detection
   - Verify AFTEN/Cocktails excluded, only food programmes remain

---

## Questions to Answer

Before proceeding, verify:

1. **Is production data safe to modify?**
   - Do you have recent backups?
   - Can you afford downtime if something breaks?

2. **Which approach do you prefer?**
   - Quick manual fix (Option C)?
   - Complete migration repair (Option A)?
   - Schedule proper migration window (Option D)?

3. **Is V5 the definitive choice?**
   - Should we deprecate V4 entirely?
   - Or keep both generators running?

---

## Summary

**The drinks filter code is working perfectly** - logs prove it filters "Cocktails" correctly. The problem is **infrastructure**, not code.

To test the filter, you need:
1. V5 `business_programme_profiles` table
2. Updated frontend to call V5
3. Database migrations applied (or manually created tables)

**Don't write more filter code** - focus on migration completion or manual table creation.
