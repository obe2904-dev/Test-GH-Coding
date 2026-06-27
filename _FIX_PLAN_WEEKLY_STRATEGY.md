# 🔧 COMPREHENSIVE FIX PLAN: Weekly Strategy Generation

**Date**: 2026-06-21  
**Status**: CRITICAL - Blocking weekly plan generation  
**Affected Components**: get-weekly-strategy, generate-weekly-plan, Phase C content allocation

---

## 🎯 EXECUTIVE SUMMARY

Three critical issues prevent weekly plans from being saved to database:

1. **Content Type Case Mismatch** - Phase C uses uppercase, database expects lowercase
2. **Programme Mapping Broken** - All posts assigned to "bar" instead of AFTEN/FROKOST/Brunch
3. **Menu Items Unavailable** - 0/101 menu items available despite valid data

---

## 🔴 ISSUE #1: Content Type Database Constraint Violation

### Symptom
```
Failed to insert daily_suggestions: violates check constraint "daily_sugg_valid_content_types"
Failing row contains: content_type = "EXPERIENCE"
```

### Root Cause Analysis

**Phase C Allocation** (`contentTypeSystem.ts:12`)
```typescript
export type ContentType = 'PRODUCT' | 'EXPERIENCE' | 'OCCASION' | 'RETENTION';
// Returns uppercase values
```

**Database Constraint** (`APPLY_DAILY_SUGGESTIONS_METADATA.sql:100`)
```sql
CHECK (content_type IN ('product', 'experience', 'occasion', 'retention', 'atmosphere', 'team'))
-- Expects lowercase values
```

**Impact**: ❌ Weekly plan cannot be saved - constraint violation on INSERT

### Fix Implementation

**File**: `supabase/functions/_shared/contentTypeSystem.ts`  
**Line**: 400 (in `allocateContentTypes` function)

**BEFORE**:
```typescript
return {
  ...post,
  content_type: selectedType,  // "PRODUCT", "EXPERIENCE", etc.
  type_rationale: rationale,
};
```

**AFTER**:
```typescript
return {
  ...post,
  content_type: selectedType.toLowerCase(),  // "product", "experience", etc.
  type_rationale: rationale,
};
```

**Migration Required**: NO - Backwards compatible change

---

## 🔴 ISSUE #2: Programme Mapping Broken ("bar" for everything)

### Symptom
```
[allocateContentTypes] No goal_split for programme bar, using fallback (5 warnings)
All posts: programme_type: "bar", service_period: "bar"
Phase 3 validation: Service periods not covered: , , 
```

### Root Cause Chain

#### 2A. `fetchMenuTiming()` Default Values

**File**: `assemble-business-intelligence.ts:274-280`

**Problem**: Menus without explicit periods default to `00:00-23:59`

```typescript
let startTime = '00:00'
let endTime = '23:59'

if (structured.menuPeriods && structured.menuPeriods.length > 0) {
  const firstPeriod = structured.menuPeriods[0]
  if (firstPeriod.startTime && firstPeriod.endTime) {
    startTime = firstPeriod.startTime
    endTime = firstPeriod.endTime
  }
}
```

**Result**: "Cocktails" menu has no periods → defaults to `00:00-23:59` → matches EVERY time

#### 2B. `inferServicePeriod()` Matching Logic

**File**: `phase2b.ts:75-88`

**Problem**: First match wins, no priority for specific periods over all-day

```typescript
for (const menu of menuTiming) {
  if (totalMinutes >= startMinutes && totalMinutes < endMinutes) {
    return menu.servicePeriodName;  // Returns "bar" first
  }
}
```

**Timeline**:
1. Post scheduled at `09:00`
2. `menuTiming = [{ menuTitle: "Cocktails", startTime: "00:00", endTime: "23:59", servicePeriodName: "bar" }, ...]`
3. `inferServicePeriod(09:00)` checks "Cocktails" first
4. `09:00` falls within `00:00-23:59` ✓
5. Returns `"bar"` 
6. Never checks "FROKOST" (09:00-17:30) or "Brunch" (09:00-14:00)

#### 2C. Service Period to Programme Type Mapping

**File**: `get-weekly-strategy/index.ts:1889`

```typescript
const servicePeriodMap = {
  brunch: 'morning',
  frokost: 'lunch', 
  aften: 'dinner'
}

programme_type: servicePeriodMap[post.service_period?.toLowerCase()] || post.service_period || 'all_day'
// "bar" not in map → returns "bar" unchanged
```

#### 2D. Content Allocation Lookup Fails

**File**: `contentTypeSystem.ts:272`

```typescript
const goalSplit = programmeGoalSplits[programmeType] || fallbackSplit
// programmeGoalSplits = { AFTEN: {...}, FROKOST: {...}, Brunch: {...} }
// Looking for "bar" → NOT FOUND → uses fallback all_day split
```

### Fix Implementation

**Solution**: Prioritize specific meal periods over all-day periods

**File**: `supabase/functions/_shared/post-helpers/strategy/phase2/phase2b.ts`  
**Function**: `inferServicePeriod` (line 57)

**BEFORE**:
```typescript
function inferServicePeriod(
  postSlot: any, 
  canonicalTime: string,
  menuTiming?: MenuTiming[]
): string | undefined {
  // ...
  if (menuTiming && menuTiming.length > 0) {
    console.log(`[inferServicePeriod] Using ${menuTiming.length} menu timing facts`);
    
    for (const menu of menuTiming) {
      if (!menu.startTime || !menu.endTime) continue;
      // ... check if time falls within period
      if (totalMinutes >= startMinutes && totalMinutes < endMinutes) {
        console.log(`[inferServicePeriod] → ${menu.servicePeriodName}`);
        return menu.servicePeriodName;  // 🔴 PROBLEM: First match wins
      }
    }
  }
}
```

**AFTER**:
```typescript
function inferServicePeriod(
  postSlot: any, 
  canonicalTime: string,
  menuTiming?: MenuTiming[]
): string | undefined {
  // ...
  if (menuTiming && menuTiming.length > 0) {
    console.log(`[inferServicePeriod] Using ${menuTiming.length} menu timing facts`);
    
    // ✅ FIX: Sort by specificity - shorter windows first (exclude all-day periods)
    const sortedTiming = menuTiming
      .filter(m => m.startTime && m.endTime)
      .map(m => {
        const [sH, sM] = m.startTime.split(':');
        const [eH, eM] = m.endTime.split(':');
        const startMin = parseInt(sH) * 60 + parseInt(sM || '0');
        const endMin = parseInt(eH) * 60 + parseInt(eM || '0');
        const duration = endMin - startMin;
        return { ...m, duration, startMin, endMin };
      })
      .filter(m => m.duration < 1440)  // Exclude 24h periods (1440 min)
      .sort((a, b) => a.duration - b.duration);  // Shortest first
    
    for (const menu of sortedTiming) {
      // ... check if time falls within period
      if (totalMinutes >= menu.startMin && totalMinutes < menu.endMin) {
        console.log(`[inferServicePeriod] → ${menu.servicePeriodName} (matched ${menu.menuTitle}: ${menu.startTime}-${menu.endTime}, duration: ${menu.duration}min)`);
        return menu.servicePeriodName;  // ✅ Returns most specific period
      }
    }
    console.log('[inferServicePeriod] No specific menu period matched, using fallback');
  }
  // ... fallback logic
}
```

**Alternative Fix** (if sorting doesn't work):

Exclude "bar" / "Cocktails" explicitly:
```typescript
const filteredTiming = menuTiming.filter(m => 
  !['bar', 'cocktails', 'drinks'].includes(m.servicePeriodName?.toLowerCase())
);
```

---

## 🔴 ISSUE #3: Menu Items Unavailable

### Symptom
```
Menu: 101 total → 0 available for active programmes
menuItemsTotal: 0 (in quality report)
```

### Root Cause

**Problem**: Service period filtering cascade failure

1. Posts get `service_period: "bar"` (Issue #2)
2. Menu items have `service_periods: ['lunch', 'dinner']`  
3. Filter: `menu_items WHERE 'bar' = ANY(service_periods)` → 0 results
4. Even "Pariserbøf" (explicitly selected) shows as unavailable

### Fix Implementation

**This will auto-fix once Issue #2 is resolved**

Once posts correctly have `service_period: "lunch"/"dinner"/"morning"`, the menu item filter will work:
- `WHERE 'lunch' = ANY(service_periods)` → returns lunch items ✓
- `WHERE 'dinner' = ANY(service_periods)` → returns dinner items ✓

**Verification Query**:
```sql
-- After fix, run this to verify
SELECT 
  item_name,
  service_periods,
  category_name
FROM menu_items_normalized
WHERE business_id = '07b7a9f6-d2cf-4fa9-85af-714a8b294ea4'
  AND 'lunch' = ANY(service_periods);
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Critical Fixes (Immediate)

- [ ] **Fix #1**: Lowercase content types in `contentTypeSystem.ts:400`
  - File: `supabase/functions/_shared/contentTypeSystem.ts`
  - Change: Add `.toLowerCase()` to `content_type` assignment
  - Test: Verify constraint accepts "product", "experience", etc.

- [ ] **Fix #2**: Prioritize specific periods in `inferServicePeriod`
  - File: `supabase/functions/_shared/post-helpers/strategy/phase2/phase2b.ts`
  - Change: Sort menuTiming by duration, exclude 24h periods
  - Test: Verify posts get "FROKOST", "AFTEN", "Brunch" instead of "bar"

### Phase 2: Verification (30 min)

- [ ] **Test Strategy Generation**
  - Run: `get-weekly-strategy` for Café Faust
  - Verify: post_ideas have correct `programme_type` values
  - Expected: Mix of "FROKOST", "AFTEN", "Brunch"

- [ ] **Test Plan Generation**
  - Run: `generate-weekly-plan` with fixed strategy
  - Verify: No database constraint violations
  - Verify: `menuItemsTotal > 0` in logs
  - Expected: 4 posts saved to `daily_suggestions`

### Phase 3: Data Quality (Optional)

- [ ] **Update servicePeriodMap** (`get-weekly-strategy/index.ts:1889`)
  - Add: `'bar': 'all_day'` to mapping
  - Reason: Handle edge cases where "bar" is still returned

- [ ] **Add Programme Type Validation**
  - Log warning if `programme_type` not in active programmes
  - Helps catch future mapping issues

---

## 🧪 TEST SCENARIOS

### Scenario 1: FROKOST Post (09:00-14:00)

**Input**: Post scheduled at `11:00`

**Expected Flow**:
1. `menuTiming` has: `[{menuTitle:"Cocktails",start:"00:00",end:"23:59",period:"bar"}, {menuTitle:"FROKOST",start:"09:00",end:"17:30",period:"FROKOST"}]`
2. After sort/filter: `[{menuTitle:"FROKOST",start:"09:00",end:"17:30",duration:510}]`  (Cocktails excluded)
3. `inferServicePeriod(11:00)` → checks FROKOST (09:00-17:30) → ✅ match
4. Returns: `service_period: "FROKOST"`
5. Maps to: `programme_type: "lunch"`
6. Finds goal split: `programmeGoalSplits["FROKOST"]` → ✅ found
7. Allocates type: `PRODUCT` (35% footfall priority)
8. Lowercases: `content_type: "product"` 
9. Inserts: ✅ No constraint violation

### Scenario 2: AFTEN Post (17:30-21:30)

**Input**: Post scheduled at `18:00`

**Expected**: `service_period: "AFTEN"` → `programme_type: "dinner"` → uses AFTEN goal split

### Scenario 3: Brunch Post (09:00-14:00)

**Input**: Post scheduled at `09:30`

**Expected**: `service_period: "Brunch"` → `programme_type: "morning"` → uses Brunch goal split

---

## 🎯 SUCCESS CRITERIA

✅ **Issue #1 Fixed**: 
- All posts in `daily_suggestions` have lowercase content_type values
- No constraint violations on INSERT

✅ **Issue #2 Fixed**:
- Posts distributed across AFTEN, FROKOST, Brunch (not all "bar")
- Each post has correct `baseline_goal_split` from its programme
- No "No goal_split for programme bar" warnings

✅ **Issue #3 Fixed**:
- `menuItemsTotal > 0` in plan generation logs
- Menu item posts (e.g., "Pariserbøf") have full descriptions
- Service period filtering returns correct items

---

## 🚨 ROLLBACK PLAN

If fixes cause new issues:

1. **Revert `contentTypeSystem.ts`**:
   ```typescript
   content_type: selectedType  // Restore uppercase
   ```

2. **Revert `phase2b.ts`**:
   ```typescript
   // Remove sorting logic, restore original loop
   for (const menu of menuTiming) { ... }
   ```

3. **Database Fix** (if reverted to uppercase):
   ```sql
   ALTER TABLE daily_suggestions DROP CONSTRAINT daily_sugg_valid_content_types;
   ALTER TABLE daily_suggestions ADD CONSTRAINT daily_sugg_valid_content_types
     CHECK (content_type IN ('PRODUCT', 'EXPERIENCE', 'OCCASION', 'RETENTION', ...));
   ```

---

## 📊 ESTIMATED IMPACT

- **Dev Time**: 45 minutes (2 code changes)
- **Test Time**: 30 minutes (end-to-end verification)
- **Risk Level**: LOW (isolated changes, easy rollback)
- **User Impact**: HIGH (unblocks weekly plan generation)

---

## 🔗 RELATED FILES

### Modified Files
1. `supabase/functions/_shared/contentTypeSystem.ts` (line 400)
2. `supabase/functions/_shared/post-helpers/strategy/phase2/phase2b.ts` (lines 57-110)

### Verification Files
- `supabase/functions/get-weekly-strategy/index.ts`
- `supabase/functions/_shared/post-helpers/weekly-plan-generator.ts`
- `APPLY_DAILY_SUGGESTIONS_METADATA.sql`

### Test Data
- Business: Café Faust (`07b7a9f6-d2cf-4fa9-85af-714a8b294ea4`)
- Programmes: AFTEN, FROKOST, Brunch
- Strategy ID: `eebd6582-aa87-4e9e-80db-10d67488a2cc`

---

## 📝 NOTES

- The "Cocktails" menu defaulting to 00:00-23:59 is likely because its `menuPeriods` array is empty or missing in `menu_results_v2.structured_data`
- Consider adding validation to `fetchMenuTiming` to log warnings for all-day periods
- Future enhancement: Store programme_type directly in V5 profiles instead of mapping from service_period

---

**Next Steps**: Review plan, implement fixes, test with Café Faust business
