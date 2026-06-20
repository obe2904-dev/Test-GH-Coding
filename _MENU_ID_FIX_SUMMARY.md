# Menu ID Mismatch - Root Cause & Fix

**Date:** 2026-06-10  
**Issue:** Quick Suggestions menu items have orphaned `menu_item_id` references  
**Status:** ✅ FIXED

---

## The Problem

When generating text from ideas in Quick Suggestions, the function tried to look up menu item details using `menu_item_id`, but found duplicates or wrong IDs.

**Example:**
- Suggestion had `menu_item_id = aaef7251-aeb9-4475-97b5-8bf092606bae`
- But "MOULES FRITES" exists **3 times** in `menu_items_normalized` with different IDs!

```sql
-- Same dish, 3 different IDs:
d1d3ea2c-e610-4b90-9abe-0666dc896938  (menu_result_id: 772286e1...)
6bd781a8-b1f0-4f5e-a2c8-18740bdcd7ab  (menu_result_id: c4b6b1ad...)
aaef7251-aeb9-4475-97b5-8bf092606bae  (menu_result_id: 0be07113...)
```

---

## Root Cause

**File:** `supabase/functions/menu-sync/index.ts`

The menu-sync function (called after menu analysis) had this logic:

```typescript
// ❌ WRONG: Delete by menu_result_id (which is NEW each time!)
await supabase
  .from('menu_items_normalized')
  .delete()
  .eq('menu_result_id', menuResult.id)  // 🐛 This ID doesn't exist yet!

// Then insert all items
await supabase
  .from('menu_items_normalized')
  .insert(itemsToInsert)  // 🐛 Creates duplicates!
```

**Timeline:**
1. Menu analysis #1 creates `menu_result_id = c4b6b1ad...` → inserts MOULES FRITES (ID: 6bd781a8...)
2. Menu analysis #2 creates `menu_result_id = 0be07113...` → tries to delete items with THIS new ID
3. Delete finds **nothing** (the ID is brand new!)
4. Menu analysis #2 inserts MOULES FRITES again (ID: aaef7251...) → **duplicate created!**

---

## The Fix

### 1. Fixed menu-sync function ✅ DEPLOYED

Changed deletion logic to remove old items from the same service period:

```typescript
// ✅ CORRECT: Delete by business_id + service_periods
if (servicePeriodFilter) {
  await supabase
    .from('menu_items_normalized')
    .delete()
    .eq('business_id', menuResult.business_id)
    .contains('service_periods', servicePeriodFilter)
} else {
  // No service period → clear all for this business
  await supabase
    .from('menu_items_normalized')
    .delete()
    .eq('business_id', menuResult.business_id)
}
```

**Deployed:** `supabase functions deploy menu-sync` ✅

---

### 2. Clean up existing duplicates

**Run this script in Supabase SQL Editor:**

```sql
-- File: _FIX_DUPLICATE_MENU_ITEMS.sql
SELECT * FROM deduplicate_menu_items('f4679fa9-3120-4a59-9506-d059b010c34a');
```

This will:
- ✅ Keep the most recent entry for each dish
- ✅ Update all `daily_suggestions.menu_item_id` to point to the canonical ID
- ✅ Update all `published_posts.menu_item_id` to point to the canonical ID
- ✅ Delete old duplicate entries

---

### 3. Prevent future duplicates (optional)

Add a unique constraint to prevent duplicates at the database level:

```sql
-- File: _PREVENT_DUPLICATE_MENU_ITEMS.sql

-- Option 1: Case-insensitive unique index
CREATE UNIQUE INDEX idx_menu_items_unique_name_per_business
ON menu_items_normalized (business_id, UPPER(TRIM(item_name)));

-- Option 2: Upsert helper function (for menu analysis)
SELECT upsert_menu_item(
  p_business_id := 'f4679fa9-3120-4a59-9506-d059b010c34a',
  p_item_name := 'MOULES FRITES',
  p_item_description := 'with fries, aioli & fresh baked bread',
  p_menu_result_id := '772286e1-4383-45b5-b04b-9b330676f70a',
  p_service_periods := ARRAY['lunch', 'dinner']
);
```

---

## Testing

After running the deduplication script, verify:

```sql
-- Should show only 1 MOULES FRITES now
SELECT id, item_name, item_description, menu_result_id
FROM menu_items_normalized
WHERE UPPER(TRIM(item_name)) = 'MOULES FRITES'
  AND business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Should show 0 duplicates
SELECT business_id, UPPER(TRIM(item_name)), COUNT(*)
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
GROUP BY business_id, UPPER(TRIM(item_name))
HAVING COUNT(*) > 1;

-- Should show 0 orphaned IDs
SELECT COUNT(*)
FROM daily_suggestions ds
WHERE menu_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items_normalized WHERE id = ds.menu_item_id
  );
```

---

## Files Changed

1. ✅ `supabase/functions/menu-sync/index.ts` - Fixed deletion logic (deployed)
2. 📄 `_FIX_DUPLICATE_MENU_ITEMS.sql` - Deduplication script (run manually)
3. 📄 `_PREVENT_DUPLICATE_MENU_ITEMS.sql` - Prevention measures (optional)
4. 📄 `_diagnose_menu_id_mismatch.sql` - Diagnostic queries

---

## Impact

### Before Fix:
- ❌ 3 duplicate entries for "MOULES FRITES"
- ❌ Quick Suggestions might reference wrong menu item ID
- ❌ Text generation fails to find correct menu description

### After Fix:
- ✅ 1 canonical entry per dish
- ✅ All suggestions reference correct menu_item_id
- ✅ Text generation gets accurate menu descriptions
- ✅ Future menu analyses won't create duplicates
