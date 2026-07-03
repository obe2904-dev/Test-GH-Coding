# Menu Data Missing - Root Cause Analysis

## The Problem

Runtime logs show:
```
✅ Extracted 0 menu items from menu_structure
⚠️ generic_anchor_risk=true (must_use_phrases are generic)
```

**Result**: Brand profile generation has no concrete menu data → falls back to generic phrases → validation errors.

---

## Data Flow Architecture

```
┌─────────────┐
│  MenuPage   │ ← User enters menu items/categories here
└──────┬──────┘
       │ Saves to
       ▼
┌──────────────────────────────┐
│ business_profile             │
│ ├─ menu_structure (JSONB)    │ ← Expected format: { categories: [ {name, items: [{name, description, price}]} ] }
│ └─ menu_description (text)   │
└──────┬───────────────────────┘
       │ Read by
       ▼
┌──────────────────────────────────┐
│ brand-profile-generator          │
│ (Edge Function)                  │
│                                  │
│ ├─ gatherDataSources()           │
│ │  └─ parseMenuStructure()       │ ← Extracts items from JSONB
│ │     └─ Returns menu[]          │
│ │                                │
│ ├─ buildPromptA()                │
│ │  └─ buildMenuSummary(menu, 15) │ ← "No menu data available" if empty
│ │                                │
│ └─ buildPromptB()                │
│    └─ buildMenuSummary(menu, 12) │
└────────────────────────────────┘
```

---

## Why 0 Items Were Extracted

### Hypothesis 1: No Menu Data Entered ⭐ MOST LIKELY
User never visited `/menu` page to enter menu data.

**Evidence**:
- MenuPage is separate from Brand Profile page
- Brand Profile page does NOT have menu entry UI
- User may not know menu data exists elsewhere

**Solution**: User needs to navigate to Menu page and add menu items.

---

### Hypothesis 2: Menu Data Not Saved Properly
Menu data entered but not persisting to `menu_structure` column.

**Check**:
```sql
-- Run CHECK_MENU_DATA.sql in Supabase SQL Editor
SELECT 
  b.business_name,
  bp.menu_structure IS NOT NULL as has_menu_structure,
  jsonb_typeof(bp.menu_structure) as type
FROM business_profile bp
JOIN businesses b ON b.id = bp.business_id
WHERE b.business_name ILIKE '%faust%';
```

**Expected**:
- `has_menu_structure = true`
- `type = 'object'` or `'array'`

**If False**: Save logic broken in MenuPage → needs debugging

---

### Hypothesis 3: Parsing Logic Broken
Menu data exists but `parseMenuStructure()` fails to extract it.

**Code Check**: [`data-gatherer.ts:13-46`](supabase/functions/_shared/brand-profile/data-gatherer.ts)

```typescript
function parseMenuStructure(menuStructure: unknown): any[] {
  const menuItems: any[] = []
  
  if (!menuStructure) {
    return menuItems  // ← Returns empty array if null
  }
  
  try {
    const parsed = typeof menuStructure === 'string'
      ? JSON.parse(menuStructure)
      : menuStructure
    
    // Flatten categories into individual menu items
    if (Array.isArray(parsed)) {
      parsed.forEach((category: any) => {
        if (Array.isArray(category.items)) {
          category.items.forEach((item: any) => {
            menuItems.push({
              name: item.name,
              description: item.description || null,
              price: item.price || null,
              category: category.name || null,
              dietary: item.dietary || []
            })
          })
        }
      })
    }
    
    console.log(`✅ Extracted ${menuItems.length} menu items from menu_structure`)
  } catch (e) {
    console.error('Failed to parse menu_structure:', e)
  }
  
  return menuItems
}
```

**Expected JSON Structure**:
```json
{
  "categories": [
    {
      "name": "Brunch",
      "items": [
        {
          "name": "Eggs Benedict",
          "description": "Poached eggs with hollandaise",
          "price": "125 kr",
          "dietary": ["vegetarian"]
        }
      ]
    }
  ]
}
```

**Bug Check**: Parsing expects `parsed` to be an array directly, but actual structure has `categories` wrapper.

---

## Immediate Action Items

### 1. Verify Data Exists
Run `CHECK_MENU_DATA.sql` in Supabase SQL Editor to check if menu data exists.

### 2a. If No Data Exists (Most Likely)
**Solution**: User needs to add menu data.

**Steps**:
1. Navigate to `/menu` page in dashboard
2. Add menu categories and items
3. Click "Gem Menu" (Save Menu)
4. Go back to Brand Profile
5. Click "Generer Brand Profil" again

### 2b. If Data Exists But Not Parsing
**Solution**: Fix `parseMenuStructure()` logic.

**Current Code** (line 24-38):
```typescript
// Expects: array directly
if (Array.isArray(parsed)) {
  parsed.forEach((category: any) => { ... })
}
```

**Should Be**:
```typescript
// Handle both formats:
// 1. Direct array: [{name: "Brunch", items: [...]}]
// 2. Wrapped object: {categories: [{name: "Brunch", items: [...]}]}
const categories = Array.isArray(parsed) 
  ? parsed 
  : parsed?.categories || []

categories.forEach((category: any) => {
  if (Array.isArray(category.items)) {
    category.items.forEach((item: any) => { ... })
  }
})
```

### 3. Add Warning If No Menu Data
Add user-facing warning when generating brand profile without menu data:

```typescript
// In brand-profile-generator/index.ts
if (menu.length === 0) {
  return new Response(JSON.stringify({
    error: 'NO_MENU_DATA',
    message: 'Ingen menu-data fundet. Gå til Menu-siden og tilføj dine menupunkter først.',
    suggestion: 'Besøg /menu for at tilføje menu-kategorier og retter.'
  }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  })
}
```

---

## Long-Term Fixes

### 1. Make Menu Entry Required
Add validation in Brand Profile page:
```typescript
if (!hasMenuData) {
  setError('Du skal tilføje menu-data først. Gå til Menu-siden.')
  return
}
```

### 2. Add Menu Preview to Brand Profile
Show menu summary in Brand Profile page so users know if data exists:
```tsx
<div className="border rounded p-4">
  <h3>Menu Data</h3>
  {menuItems.length === 0 ? (
    <p className="text-red-500">
      Ingen menu fundet. <Link to="/menu">Tilføj menu her</Link>
    </p>
  ) : (
    <p className="text-green-600">
      ✓ {menuItems.length} retter fundet
    </p>
  )}
</div>
```

### 3. Merge Menu & Brand Profile Pages
Alternative: Combine menu entry into Brand Profile page as a section.

---

## Why Location Context Works But Menu Doesn't

**Location enrichment**: Computed from `business_locations` table (always exists after onboarding).
**Menu data**: User-provided via separate Menu page (may not exist).

Location = automatic computation ✅  
Menu = manual user entry ❌ (depends on user visiting `/menu`)

---

## Next Steps

1. Run `CHECK_MENU_DATA.sql` to confirm menu data status
2. If no data: User adds menu via `/menu` page
3. If data exists: Fix parsing logic in `parseMenuStructure()`
4. If parsing works: Check JSONB column format mismatch

**Priority**: Verify data exists first before changing code.
