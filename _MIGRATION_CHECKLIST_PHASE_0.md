# Phase 0: Database Migrations - Execution Checklist

## 📋 Pre-Flight Checks

Before running any migrations:

- [ ] You have Supabase dashboard access
- [ ] You can access SQL Editor at: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
- [ ] You have a database backup (recommended)
- [ ] No users are currently generating posts (low-risk if violated, but cleaner)

---

## 🎯 Migration Files Created

### 1. `APPLY_METADATA_ENFORCEMENT.sql`
**Purpose:** Add constraints to ensure AI posts have proper metadata  
**Risk:** LOW - Only adds constraints, doesn't delete data  
**Estimated time:** < 5 seconds  

**What it does:**
- Backfills `content_type = 'product'` for existing AI posts
- Adds CHECK constraint: AI posts must have `content_type`
- Adds CHECK constraint: Product posts must have `menu_item_name`
- Adds valid content types enum

**Expected output:** 3 constraints added, 0 missing content_types

---

### 2. `APPLY_ROTATION_INDEXES.sql`
**Purpose:** Speed up rotation queue and pattern queries  
**Risk:** NONE - Only adds indexes (read-only optimization)  
**Estimated time:** 5-10 seconds (depends on table size)  

**What it does:**
- Creates 4 indexes for fast rotation tracking
- Tests index performance with EXPLAIN query

**Expected output:** 4 indexes created, query plan shows "Index Scan"

---

### 3. `APPLY_DAILY_SUGGESTIONS_METADATA.sql`
**Purpose:** Add metadata columns to daily_suggestions table  
**Risk:** LOW - Only adds columns, doesn't modify existing data  
**Estimated time:** < 5 seconds  

**What it does:**
- Adds 5 new columns: `menu_item_id`, `menu_item_name`, `content_type`, `service_period`, `content_angle`
- Adds constraints matching `published_posts` structure
- Creates 2 indexes for fast lookups

**Expected output:** 5 columns added, 3 constraints added, 2 indexes created

---

## ⚡ Execution Order

**MUST run in this order:**

1. ✅ `APPLY_METADATA_ENFORCEMENT.sql` (foundation)
2. ✅ `APPLY_ROTATION_INDEXES.sql` (performance)
3. ✅ `APPLY_DAILY_SUGGESTIONS_METADATA.sql` (suggestions schema)

---

## 🚨 Rollback Plan (If Something Goes Wrong)

### If migration 1 fails:
```sql
-- Remove constraints
ALTER TABLE published_posts DROP CONSTRAINT IF EXISTS content_type_required_for_ai_posts;
ALTER TABLE published_posts DROP CONSTRAINT IF EXISTS menu_item_required_for_ai_product_posts;
ALTER TABLE published_posts DROP CONSTRAINT IF EXISTS valid_content_types;
```

### If migration 2 fails:
```sql
-- Remove indexes (safe - just slower queries)
DROP INDEX IF EXISTS idx_published_posts_menu_rotation;
DROP INDEX IF EXISTS idx_published_posts_pattern_history;
DROP INDEX IF EXISTS idx_published_posts_scheduled_week;
DROP INDEX IF EXISTS idx_published_posts_by_period;
```

### If migration 3 fails:
```sql
-- Remove columns and constraints from daily_suggestions
ALTER TABLE daily_suggestions DROP CONSTRAINT IF EXISTS daily_sugg_content_type_required;
ALTER TABLE daily_suggestions DROP CONSTRAINT IF EXISTS daily_sugg_product_needs_menu;
ALTER TABLE daily_suggestions DROP CONSTRAINT IF EXISTS daily_sugg_valid_content_types;
DROP INDEX IF EXISTS idx_daily_suggestions_menu_item;
DROP INDEX IF EXISTS idx_daily_suggestions_service_period;

-- Remove columns (only if you want to fully rollback)
ALTER TABLE daily_suggestions DROP COLUMN IF EXISTS menu_item_id;
ALTER TABLE daily_suggestions DROP COLUMN IF EXISTS menu_item_name;
ALTER TABLE daily_suggestions DROP COLUMN IF EXISTS content_type;
ALTER TABLE daily_suggestions DROP COLUMN IF EXISTS service_period;
ALTER TABLE daily_suggestions DROP COLUMN IF EXISTS content_angle;
```

---

## ✅ Verification Steps After Each Migration

### After Migration 1:
```sql
-- Check constraints exist
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'published_posts' 
  AND constraint_name LIKE '%content_type%' 
  OR constraint_name LIKE '%menu_item%';

-- Check data quality
SELECT 
  idea_source,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE content_type IS NULL) as missing_type
FROM published_posts
GROUP BY idea_source;
```

**Expected:** 
- 3 constraints shown
- `missing_type = 0` for quick_suggestions and weekly_plan

---

### After Migration 2:
```sql
-- Check indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'published_posts' 
  AND indexname LIKE 'idx_published_posts_%';

-- Test query speed
EXPLAIN ANALYZE
SELECT menu_item_name, MAX(posted_at)
FROM published_posts
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND menu_item_name IS NOT NULL
GROUP BY menu_item_name;
```

**Expected:**
- At least 6 indexes shown (4 new + 2 from previous migration)
- Query execution time < 10ms

---

### After Migration 3:
```sql
-- Check columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'daily_suggestions'
  AND column_name IN ('menu_item_id', 'menu_item_name', 'content_type', 'service_period', 'content_angle');

-- Try inserting a test suggestion (should fail without content_type)
INSERT INTO daily_suggestions (business_id, caption)
VALUES ('test-id', 'test caption');
```

**Expected:**
- 5 columns shown
- Insert fails with: "violates check constraint daily_sugg_content_type_required" ✓ (this is good!)

---

## 📊 Post-Migration Data Audit

After ALL migrations complete, run this audit:

```sql
SELECT 
  '📊 Post-Migration Audit' AS report_name,
  
  -- published_posts stats
  (SELECT COUNT(*) FROM published_posts) AS total_posts,
  (SELECT COUNT(*) FROM published_posts WHERE idea_source IN ('quick_suggestions', 'weekly_plan')) AS ai_posts,
  (SELECT COUNT(*) FROM published_posts WHERE idea_source IN ('quick_suggestions', 'weekly_plan') AND content_type IS NULL) AS ai_posts_missing_type,
  (SELECT COUNT(*) FROM published_posts WHERE content_type IN ('product', 'occasion') AND menu_item_name IS NULL AND idea_source != 'manual') AS product_posts_missing_menu,
  
  -- daily_suggestions stats
  (SELECT COUNT(*) FROM daily_suggestions) AS total_suggestions,
  (SELECT COUNT(*) FROM daily_suggestions WHERE content_type IS NOT NULL) AS suggestions_with_type,
  
  -- Index stats
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'published_posts' AND indexname LIKE 'idx_published%') AS published_posts_indexes,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'daily_suggestions' AND indexname LIKE 'idx_daily%') AS daily_suggestions_indexes;
```

**Expected healthy state:**
- `ai_posts_missing_type = 0` ✓
- `product_posts_missing_menu = 0` ✓
- `published_posts_indexes >= 6` ✓
- `daily_suggestions_indexes >= 2` ✓

---

## 🎬 Next Steps After Successful Migration

Once all 3 migrations pass:

1. ✅ Report back: "Migrations complete, audit passed"
2. ⏭️ I'll implement TypeScript rotation queue functions
3. ⏭️ We'll update Quick Suggestions generation
4. ⏭️ We'll update Weekly Plan generation

---

## 🆘 If You Hit Issues

**Common issues:**

**Error: "column already exists"**
→ Safe to ignore - migration uses `IF NOT EXISTS`

**Error: "constraint already exists"**  
→ Safe to ignore - migration uses `DROP ... IF EXISTS` first

**Error: "violates check constraint"**
→ You have corrupt data - send me the error message and we'll fix

**Slow execution (> 30 seconds)**
→ Large table - wait for completion, then check audit query

---

## 📝 Ready to Execute?

When you're ready:
1. Open Supabase SQL Editor
2. Run migration 1 → Verify output
3. Run migration 2 → Verify output  
4. Run migration 3 → Verify output
5. Run final audit query
6. Report back: "✅ All migrations successful" or "❌ Error on migration X: [error message]"

I'll be waiting for your confirmation before proceeding to Phase 1 (TypeScript implementation). 🚀
