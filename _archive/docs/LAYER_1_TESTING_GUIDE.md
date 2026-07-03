# Layer 1 Testing Guide - Information Foundation

## Overview

Layer 1 provides the foundational business data needed by all other layers. This includes business profile, location intelligence, operations data, and menu database.

## Test Files Created

### 1. `ENSURE_LAYER_1_COLUMNS.sql`
**Purpose:** Ensures all required Layer 1 database columns exist  
**Usage:** Run this FIRST in Supabase SQL Editor before testing

**What it does:**
- Adds `selected_platforms` to `businesses` table (JSONB array)
- Adds `category_scores` to `business_location_intelligence` (JSONB object)
- Adds `establishment_type` to `business_operations` (FSE/SBO/MFV/MFD/QSR)
- Adds `has_outdoor_seating` to `business_operations` (boolean)
- Verifies all columns were created successfully

**Safe to run multiple times** - Uses `IF NOT EXISTS` checks

---

### 2. `TEST_LAYER_1_DATABASE.sql`
**Purpose:** Comprehensive test of all Layer 1 data and relationships  
**Usage:** Run AFTER ensuring columns exist

**Before running:**
1. Replace the user_id variable at the top:
   ```sql
   \set test_user_id 'YOUR-ACTUAL-USER-ID-HERE'
   ```

**What it tests:**

#### Test 1: BUSINESSES Table
- ✅ Table exists
- ✅ Required columns present: `id`, `owner_id`, `name`, `category`, `selected_platforms`
- ✅ Data exists for test user
- ✅ `category` is valid (FSE/SBO/MFV/MFD/QSR or NULL)
- ✅ `selected_platforms` is JSONB array

#### Test 2: BUSINESS_LOCATION_INTELLIGENCE Table
- ✅ Table exists
- ✅ Required columns: `business_id`, `neighborhood`, `area_type`, `category_scores`, `has_view`, `outdoor_space_type`
- ✅ Data linked to business
- ✅ `category_scores` is JSONB object with location type scores (0-100)
- ✅ Expected format: `{"waterfront": 85, "city_center": 60, ...}`

#### Test 3: BUSINESS_OPERATIONS Table
- ✅ Table exists
- ✅ Required columns: `opening_hours`, `service_periods`, `establishment_type`, `has_outdoor_seating`, `price_level`
- ✅ Data linked to business
- ✅ `establishment_type` is valid (FSE/SBO/MFV/MFD/QSR)
- ✅ `has_outdoor_seating` is boolean
- ✅ `price_level` is valid (budget/moderate/upscale/fine_dining)

#### Test 4: MENU_RESULTS_V2 Table
- ✅ Table exists
- ✅ Required columns: `business_id`, `status`, `structured_data`, `language_code`
- ✅ Menu data exists with status='done'
- ✅ `structured_data` is JSONB with proper menu structure
- ✅ Structure: `{ menu: { sections: [{ items: [{ name, description, price }] }] } }`

#### Test 5: Cross-Table Relationships
- ✅ Business exists
- ✅ Location intelligence linked to business
- ✅ Operations linked to business
- ✅ Menu items exist and linked to business

#### Test 6: Data Quality Checks
- ✅ Business category is valid or NULL (defaults to FSE)
- ✅ Location has category scores object
- ✅ Operations has establishment type
- ✅ Menu has structured sections
- ✅ Outdoor seating flag is set

#### Test 7: Simulated Edge Function Fetch
- Shows exactly what data the `generate-weekly-plan` Edge Function would receive
- Validates data format matches expected Layer 1 interface

---

## Expected Column Values

### businesses.category
- **Type:** TEXT
- **Valid Values:** `FSE`, `SBO`, `MFV`, `MFD`, `QSR`, or `NULL`
- **Default Behavior:** If NULL, system defaults to `FSE`

### businesses.selected_platforms
- **Type:** JSONB
- **Format:** Array of platform strings
- **Example:** `["instagram", "facebook"]`
- **Valid Platforms:** `instagram`, `facebook`, `linkedin`, `tiktok`

### business_location_intelligence.category_scores
- **Type:** JSONB
- **Format:** Object with location type keys and 0-100 scores
- **Example:**
  ```json
  {
    "waterfront": 85,
    "city_center": 60,
    "tourist_area": 40,
    "residential": 20,
    "park_adjacent": 30
  }
  ```

### business_operations.establishment_type
- **Type:** VARCHAR(10)
- **Valid Values:** 
  - `FSE` - Full-Service Establishment (fine dining, 4 posts/week)
  - `SBO` - Service-Based Operation (cafes, 4 posts/week)
  - `MFV` - Mobile Food Vendor (food trucks, 5 posts/week)
  - `MFD` - Multi-location Full Service (chains, 6 posts/week)
  - `QSR` - Quick Service Restaurant (fast food, 7 posts/week)

### business_operations.has_outdoor_seating
- **Type:** BOOLEAN
- **Values:** `true` or `false`
- **Impact:** If `true`, boosts seasonal content in Q2-Q3 (spring/summer)

---

## How to Run Tests

### Step 1: Ensure Columns Exist
```bash
# In Supabase Dashboard > SQL Editor
# Run: ENSURE_LAYER_1_COLUMNS.sql
```

Expected output:
```
✅ businesses.selected_platforms exists
✅ business_location_intelligence.category_scores exists
✅ business_operations.establishment_type exists
✅ business_operations.has_outdoor_seating exists
========================================
LAYER 1 COLUMNS VERIFIED
========================================
```

### Step 2: Run Comprehensive Tests
```bash
# Edit TEST_LAYER_1_DATABASE.sql
# Replace: \set test_user_id 'YOUR-USER-ID'

# Run in Supabase SQL Editor
```

Expected output: Multiple test sections with ✅ checks

### Step 3: Review Results

**If all ✅ checks pass:**
- Layer 1 is fully functional
- Data structure matches expected format
- Ready to proceed to Layer 2 testing

**If any ❌ errors appear:**
- Review the specific test section that failed
- Check the error message for details
- Common issues:
  - Missing data (run onboarding process)
  - NULL values where data expected
  - Incorrect data types
  - Menu not extracted yet (check menu_results_v2.status)

---

## Common Issues & Fixes

### Issue: "Business profile not found"
**Cause:** User hasn't completed onboarding  
**Fix:** Complete onboarding process in dashboard

### Issue: "Location intelligence missing"
**Cause:** Location analysis hasn't run  
**Fix:** Trigger location intelligence generation (should happen during onboarding)

### Issue: "Menu data missing or not processed"
**Cause:** Menu extraction incomplete or failed  
**Fix:** 
1. Check `menu_results_v2.status` - should be 'done'
2. Re-run menu extraction if status is 'error'
3. Check `menu_results_v2.error_message` for details

### Issue: "category_scores missing or invalid"
**Cause:** Column doesn't exist or hasn't been populated  
**Fix:** 
1. Run `ENSURE_LAYER_1_COLUMNS.sql`
2. Trigger location intelligence update
3. Manually populate if needed:
   ```sql
   UPDATE business_location_intelligence
   SET category_scores = '{"waterfront": 50, "city_center": 50}'::jsonb
   WHERE business_id = 'YOUR-BUSINESS-ID';
   ```

### Issue: "establishment_type is NULL"
**Cause:** Field hasn't been set  
**Fix:** 
1. Run `ENSURE_LAYER_1_COLUMNS.sql`
2. Let system default to FSE, or manually set:
   ```sql
   UPDATE business_operations
   SET establishment_type = 'FSE'  -- or SBO, MFV, MFD, QSR
   WHERE business_id = 'YOUR-BUSINESS-ID';
   ```

---

## What Edge Function Expects

The `generate-weekly-plan` Edge Function fetches this exact data:

```typescript
// From businesses table
const business = {
  id: UUID,
  name: string,
  category: 'FSE' | 'SBO' | 'MFV' | 'MFD' | 'QSR' | null,
  selected_platforms: string[] // ["instagram", "facebook"]
}

// From business_location_intelligence
const locationIntel = {
  area_type: string,           // "waterfront", "city_center"
  category_scores: {           // JSONB object
    waterfront: 85,
    city_center: 60,
    tourist_area: 40
  },
  has_view: boolean,
  outdoor_space_type: string
}

// From business_operations
const operations = {
  establishment_type: 'FSE' | 'SBO' | 'MFV' | 'MFD' | 'QSR',
  has_outdoor_seating: boolean,
  price_level: 'budget' | 'moderate' | 'upscale' | 'fine_dining',
  seating_capacity_indoor: number,
  seating_capacity_outdoor: number
}

// From menu_results_v2
const menuItems = [{
  id: UUID,
  business_id: UUID,
  status: 'done',
  structured_data: {
    menu: {
      sections: [
        {
          name: string,
          items: [
            {
              name: string,
              description: string,
              price: number
            }
          ]
        }
      ]
    }
  }
}]
```

---

## Success Criteria

Layer 1 is considered **fully functional** when:

1. ✅ All 4 core tables have data for the test user
2. ✅ All required columns exist with correct data types
3. ✅ `businesses.category` is valid or NULL
4. ✅ `businesses.selected_platforms` is JSONB array
5. ✅ `business_location_intelligence.category_scores` is populated JSONB object
6. ✅ `business_operations.establishment_type` is set
7. ✅ `business_operations.has_outdoor_seating` is boolean
8. ✅ `menu_results_v2` has at least one 'done' record
9. ✅ Menu structured_data has proper sections/items structure
10. ✅ All relationships (foreign keys) are intact

When all criteria pass, **Layer 1 is ready** and you can proceed to Layer 2 testing.

---

## Next Steps

After Layer 1 passes:
1. Proceed to Layer 2 testing (Strategic Baselines)
2. Verify brand profile data
3. Test content distribution ratios
4. Validate target audience configuration

---

## Quick Test Command

For a quick check, run this single query:

```sql
-- Quick Layer 1 Health Check
SELECT 
  CASE WHEN COUNT(*) = 4 THEN '✅ Layer 1 HEALTHY' ELSE '❌ Layer 1 INCOMPLETE' END as status,
  COUNT(*) as tables_with_data
FROM (
  SELECT 1 FROM businesses WHERE owner_id = 'YOUR-USER-ID'
  UNION ALL
  SELECT 1 FROM business_location_intelligence bli
  JOIN businesses b ON b.id = bli.business_id WHERE b.owner_id = 'YOUR-USER-ID'
  UNION ALL
  SELECT 1 FROM business_operations bo
  JOIN businesses b ON b.id = bo.business_id WHERE b.owner_id = 'YOUR-USER-ID'
  UNION ALL
  SELECT 1 FROM menu_results_v2 mr
  JOIN businesses b ON b.id = mr.business_id WHERE b.owner_id = 'YOUR-USER-ID' AND mr.status = 'done'
) checks;
```

Expected: `✅ Layer 1 HEALTHY` with `tables_with_data = 4`
