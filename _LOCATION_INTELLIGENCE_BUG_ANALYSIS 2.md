# Location Intelligence Bug Analysis
**Date**: 2026-06-25  
**Business**: KOREAN BBQ & SUSHI (ID: `95d657ad-d791-422b-ad40-ec7a5f1c2b0c`)  
**Location**: Søndergade 20a, 8600 Silkeborg (Coordinates: 56.16744600, 9.55035480)

---

## 🔍 Confirmed Issues

### Issue 1: Wrong Neighborhood
- **Current Value**: `neighborhood = "Aarhus"`
- **Expected Value**: `"Silkeborg"` (or a neighborhood within Silkeborg)
- **Impact**: Aarhus is 45km away from Silkeborg - completely wrong city
- **Coordinates**: CORRECT (56.16744600, 9.55035480 is in Silkeborg)

### Issue 2: Invalid area_type
- **Current Value**: `area_type = "student"`
- **Expected Value**: One of the valid geographic types: `city_centre`, `residential`, `office`, `transport_hub`, `waterfront`, `shopping_district`, `mixed_use`, `destination`, `nature_park`
- **Impact**: Invalid value breaks content generation logic that expects geographic types

---

## 🔬 Root Cause Analysis

### 1. "student" in area_type - Old Schema Bug

**Discovery**: Found migration `20260522000002_migrate_demographics.sql` that reveals:

```sql
-- Purpose: Migrate existing student/tourist scores from category_scores to demographic_proximity
-- STEP 3: Remove student and tourist from category_scores
UPDATE business_location_intelligence
SET category_scores = category_scores - 'student' - 'tourist'
```

**Timeline**:
1. **Old Schema (pre-May 2026)**: "student" and "tourist" were stored in `category_scores` (and apparently sometimes in `area_type`)
2. **Migration (May 22, 2026)**: Moved demographic data to new `demographic_proximity` field
3. **Bug**: Migration cleaned `category_scores` but **NOT** `area_type`
4. **Result**: This business has stale "student" value in `area_type` from old schema

**Evidence**: 
- Line 109 in `location-analyzer.ts` shows `area_type` should ONLY be set to `primaryAreaType` from geographic types
- "student" is not in the valid list: `city_centre`, `residential`, `office`, `transport_hub`, `waterfront`, `shopping_district`, `mixed_use`, `destination`, `nature_park`

### 2. Wrong Neighborhood from Google Maps

**Code Path**: `populate-location-intelligence/index.ts` → `google-maps.ts`

```typescript
// index.ts line 155
const fullAddress = city ? `${address}, ${city}, Denmark` : `${address}, Denmark`;
const geocodeResult = await googleMaps.geocodeAddress(fullAddress);

// google-maps.ts line 78-81
for (const component of result.address_components) {
  if (component.types.includes('sublocality') || component.types.includes('neighborhood')) {
    neighborhood = component.long_name;  // ⚠️ Blindly trusts Google's response
  }
}
```

**Problem**: The code:
1. Sends correct address to Google: `"Søndergade 20a st. th., Silkeborg, Denmark"`
2. Gets correct coordinates back: `(56.16744600, 9.55035480)`
3. But Google's `address_components` contains `neighborhood = "Aarhus"` (wrong!)
4. Code **blindly accepts** this without validation

**Why Google Returns Wrong Data**:
- Apartment notation `"st. th."` (Danish for ground floor, right) may confuse geocoder
- Google may lack granular neighborhood data for Silkeborg 8600
- Possible data quality issue in Google's Danish address database

---

## 🛠️ Required Fixes

### Fix 1: Clean Up Invalid area_type Values (Migration)

**File**: Create new migration `_FIX_INVALID_AREA_TYPES.sql`

```sql
-- Fix invalid area_type values from old schema
UPDATE business_location_intelligence
SET 
  area_type = 'mixed_use',  -- Safe default
  last_updated_by_ai = NOW()
WHERE area_type NOT IN (
  'city_centre', 'residential', 'office', 'transport_hub',
  'waterfront', 'shopping_district', 'mixed_use', 'destination', 'nature_park'
)
OR area_type IS NULL;
```

### Fix 2: Add Validation in Edge Function

**File**: `supabase/functions/populate-location-intelligence/index.ts`

Add validation after geocoding (around line 160):

```typescript
const geocodeResult = await googleMaps.geocodeAddress(fullAddress);

// VALIDATION: Ensure geocoded city matches input city
if (city && geocodeResult.city && geocodeResult.city.toLowerCase() !== city.toLowerCase()) {
  console.warn(`⚠️ City mismatch: Input="${city}", Google="${geocodeResult.city}". Using input city.`);
  geocodeResult.city = city;  // Override with correct city
}

// VALIDATION: If neighborhood doesn't match city at all, use city as neighborhood
if (geocodeResult.neighborhood && city) {
  const neighborhoodLower = geocodeResult.neighborhood.toLowerCase();
  const cityLower = city.toLowerCase();
  
  if (!neighborhoodLower.includes(cityLower) && !cityLower.includes(neighborhoodLower)) {
    console.warn(`⚠️ Neighborhood mismatch: neighborhood="${geocodeResult.neighborhood}", city="${city}". Using city as neighborhood.`);
    geocodeResult.neighborhood = city;  // Fall back to city name
  }
}
```

### Fix 3: Add Validation Before Database Save

**File**: `supabase/functions/populate-location-intelligence/services/database-saver.ts`

```typescript
async saveLocationIntelligence(businessId: string, locationData: any): Promise<void> {
  // Remove poi_counts as it's not a database column
  const { poi_counts, ...dataToSave } = locationData;
  
  // VALIDATION: Ensure area_type is valid
  const validAreaTypes = [
    'city_centre', 'residential', 'office', 'transport_hub',
    'waterfront', 'shopping_district', 'mixed_use', 'destination', 'nature_park'
  ];
  
  if (dataToSave.area_type && !validAreaTypes.includes(dataToSave.area_type)) {
    console.error(`❌ Invalid area_type: "${dataToSave.area_type}". Defaulting to "mixed_use".`);
    dataToSave.area_type = 'mixed_use';
  }
  
  const { error } = await this.supabase
    .from('business_location_intelligence')
    .upsert({
      business_id: businessId,
      ...dataToSave,
      last_updated_by_ai: new Date().toISOString(),
    }, {
      onConflict: 'business_id'
    });

  if (error) {
    throw new Error(`Failed to save location intelligence: ${error.message}`);
  }
}
```

### Fix 4: Improve Geocoding Accuracy

**File**: `supabase/functions/populate-location-intelligence/index.ts`

Simplify address format to avoid confusing Google:

```typescript
// Before: "Søndergade 20a st. th., Silkeborg, Denmark"
// After: "Søndergade 20a, 8600 Silkeborg, Denmark"

const addressParts = [];
if (address) {
  // Remove apartment details (st. th., 1. sal, etc.) that confuse Google
  const cleanAddress = address.replace(/\s+(st\.|tv\.|th\.|sal|mf)\.?\s*$/i, '').trim();
  addressParts.push(cleanAddress);
}
if (postal_code) addressParts.push(postal_code);
if (city) addressParts.push(city);
addressParts.push('Denmark');

const fullAddress = addressParts.join(', ');
```

---

## 📋 Implementation Checklist

- [ ] **Migration**: Create and run `_FIX_INVALID_AREA_TYPES.sql`
- [ ] **Edge Function**: Add city/neighborhood validation in `index.ts`
- [ ] **Database Saver**: Add area_type validation in `database-saver.ts`
- [ ] **Geocoding**: Simplify address format to improve accuracy
- [ ] **Testing**: Force refresh for business `95d657ad-d791-422b-ad40-ec7a5f1c2b0c`
- [ ] **Verification**: Check all Silkeborg businesses for similar issues

---

## 🧪 Testing Steps

1. **Run migration** to fix all invalid area_type values
2. **Deploy updated Edge Function** with validations
3. **Test with problematic business**:
   ```bash
   POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/populate-location-intelligence
   Body: {"business_id": "95d657ad-d791-422b-ad40-ec7a5f1c2b0c", "force_refresh": true}
   ```
4. **Verify results**:
   ```sql
   SELECT neighborhood, area_type, latitude, longitude
   FROM business_location_intelligence
   WHERE business_id = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c';
   ```
   Expected: `neighborhood = "Silkeborg"`, `area_type` in valid list

---

## 🎯 Prevention

These fixes ensure:
1. ✅ Invalid area_type values are rejected
2. ✅ Google's wrong neighborhood data is caught and corrected
3. ✅ City mismatches are logged and fixed
4. ✅ Old schema bugs are cleaned up
5. ✅ Future updates maintain data quality
