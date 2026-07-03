# Schema Cleanup Instructions

## What This Does
Removes 10 unused/orphaned tables from production database.

## Tables Being Dropped

### Category 1: Never Used (6 tables)
- `business_classes` - Class schedules, always empty
- `business_products` - Retail catalog, always empty
- `business_services` - Service catalog, always empty
- `offerings` - Completely unused
- `post_drafts` - Never implemented
- `specials` - Never implemented

### Category 2: Failed April 2026 Drops (4 tables)
These have code warnings saying "DROPPED April 2026" but tables still exist:
- `business_menu_metadata`
- `business_goals`
- `business_audience_profile`
- `business_visual_identity`

## How to Apply

### Option 1: Supabase SQL Editor (RECOMMENDED)
1. Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql
2. Click "New Query"
3. Copy contents of `supabase/migrations/20260602000001_cleanup_unused_tables.sql`
4. Click "Run"
5. Check output for ✅ confirmations

### Option 2: Terminal (if migration system works)
```bash
supabase db push
```

## Verification
After running, the migration will print status for each table:
- ✅ = Successfully dropped
- ❌ = Still exists (error)

## Safety
- Uses `DROP TABLE IF EXISTS CASCADE`
- No data loss - all tables are empty
- Cascades will clean up any foreign key references
- Can be re-run safely (idempotent)

## Next Steps After Cleanup
1. Remove TypeScript definitions from `src/types/supabase.ts`
2. Remove warnings from `src/types/index.ts`
3. Update documentation files
