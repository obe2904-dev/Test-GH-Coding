# Menu Items Normalized - Setup Complete

## ✅ What Was Fixed

**Problem**: Code referenced `menu_items_normalized` table that didn't exist in production
- Edge function crashed with "relation does not exist" errors
- Fallback to JSONB queries was slower and failed silently

**Solution**: Applied missing migration + created sync function

## 📊 Current Status

### Café Faust
- **178 menu items** synced successfully
- **6 menu sources** processed (different menus/languages)
- **Quality**: 89-104 character prose descriptions

Example:
```
Item: PARISERBØF
Description: "af 350 g. oksekød, med rødbeder, kapers, løg, peberrod, pickles og æggeblomme (ca. 20 min.)"
Length: 91 chars ✅
```

vs daily_suggestions ingredient list:
```
"Hakkebøf, æggeblomme, kapers, peberrod, rødbeder, løg, ristet brød"
66 chars - filtered out as "list format" ⚠️
```

## 🔄 How It Works Now

### Text Generation Flow
1. User selects suggestion (e.g., "Klassisk Pariserbøf til frokost")
2. Edge function receives: `{ menuItemName: "PARISERBØF", menuItemDescription: "ingredient list" }`
3. resolve-context.ts queries `menu_items_normalized`:
   ```sql
   SELECT item_name, item_description 
   FROM menu_items_normalized 
   WHERE business_id = '...' AND item_name ILIKE 'PARISERBØF'
   ```
4. Gets full menu description (91 chars instead of 66)
5. Builds prompt: `RET: PARISERBØF\n[full description]`
6. AI generates with proper context ✅

### Sync Process
Menu updates → Run sync function → Normalized table updated

```sql
-- Sync one business
SELECT * FROM sync_menu_items_normalized('f4679fa9-3120-4a59-9506-d059b010c34a');

-- Sync all businesses
SELECT * FROM sync_menu_items_normalized();
```

**Returns**: `(synced_count, deleted_count, business_count)`

## 🛠️ Maintenance

### When to Sync
- After menu extraction completes
- After updating menu_results_v2
- When adding new menus
- Weekly maintenance (optional)

### Check Sync Status
```sql
-- Count items per business
SELECT business_id, COUNT(*) as item_count
FROM menu_items_normalized
GROUP BY business_id
ORDER BY item_count DESC;

-- Check last sync time
SELECT business_id, MAX(synced_at) as last_sync
FROM menu_items_normalized
GROUP BY business_id;
```

## 📝 Files Created/Updated

### New Migrations (Applied ✅)
- `20260203000001_create_menu_items_normalized.sql` - Table schema
- `20260526000001_sync_menu_items_normalized.sql` - Sync function

### Updated Documentation
- `DATABASE_SCHEMA.md` - Full schema reference for future chats
- `_check_cafe_faust_menu_data.sql` - Verification queries

## 🚨 Important Notes

1. **Menu status field**: Uses `status IN ('completed', 'done')` - both values exist in production
2. **Category type inference**: Automatically classifies kids_menu, dessert, appetizer from category names
3. **Unique constraint**: Allows same item in multiple menus (different menu_result_id)
4. **RLS enabled**: Service role required for sync function

## 🔍 Verification

Run the updated check file to verify menu data quality:
```bash
# Uses corrected queries for actual schema
_check_cafe_faust_menu_data.sql
```

This ensures future AI assistants have schema documentation and won't reference non-existent tables.
