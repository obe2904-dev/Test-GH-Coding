# Edge Function Validation Patches

## Required Changes to `populate-location-intelligence`

### File 1: `supabase/functions/populate-location-intelligence/index.ts`

**Location**: After line 157 (after `const geocodeResult = await googleMaps.geocodeAddress(fullAddress);`)

**Add this validation**:

```typescript
// VALIDATION: Ensure geocoded city matches input city
if (city && geocodeResult.city && geocodeResult.city.toLowerCase() !== city.toLowerCase()) {
  console.warn(
    `⚠️ City mismatch detected:\n` +
    `  Input city: "${city}"\n` +
    `  Google returned: "${geocodeResult.city}"\n` +
    `  Coordinates: ${geocodeResult.latitude}, ${geocodeResult.longitude}\n` +
    `  → Using input city as source of truth`
  );
  geocodeResult.city = city;  // Override with database city
}

// VALIDATION: If neighborhood doesn't match city at all, fall back to city name
if (geocodeResult.neighborhood && city) {
  const neighborhoodLower = geocodeResult.neighborhood.toLowerCase();
  const cityLower = city.toLowerCase();
  
  // Check if neighborhood and city are completely different (not contained in each other)
  const isComplete Mismatch = 
    !neighborhoodLower.includes(cityLower) && 
    !cityLower.includes(neighborhoodLower);
  
  if (isCompleteMismatch) {
    console.warn(
      `⚠️ Neighborhood-City mismatch detected:\n` +
      `  Google neighborhood: "${geocodeResult.neighborhood}"\n` +
      `  Database city: "${city}"\n` +
      `  → This suggests Google returned wrong location data\n` +
      `  → Using city name as neighborhood fallback`
    );
    geocodeResult.neighborhood = city;  // Use city as neighborhood
  }
}

console.log(`✅ Validated location: City="${geocodeResult.city}", Neighborhood="${geocodeResult.neighborhood}"`);
```

**Alternative**: Simplify address format to improve Google accuracy:

Replace lines 154-156:
```typescript
// OLD: May confuse Google with apartment details
const fullAddress = city ? `${address}, ${city}, Denmark` : `${address}, Denmark`;
```

With:
```typescript
// NEW: Clean address format for better geocoding
const addressParts = [];
if (address) {
  // Remove Danish apartment notation (st. th., 1. sal, etc.) that confuses Google
  const cleanAddress = address
    .replace(/\s+(st|tv|th|mf)\.?\s*$/i, '')  // Remove floor position
    .replace(/\s+\d+\.\s*sal\.?\s*$/i, '')     // Remove floor number
    .trim();
  addressParts.push(cleanAddress);
}
if (locationData?.postal_code) addressParts.push(locationData.postal_code);
if (city) addressParts.push(city);
addressParts.push('Denmark');

const fullAddress = addressParts.join(', ');
console.log(`📍 Geocoding: "${fullAddress}"`);
```

---

### File 2: `supabase/functions/populate-location-intelligence/services/database-saver.ts`

**Location**: Inside `saveLocationIntelligence()` method, before the upsert

**Add this validation**:

```typescript
async saveLocationIntelligence(businessId: string, locationData: any): Promise<void> {
  // Remove poi_counts as it's not a database column (used for analysis only)
  const { poi_counts, ...dataToSave } = locationData;
  
  // VALIDATION: Ensure area_type is valid (prevent old schema bugs)
  const validAreaTypes = [
    'city_centre', 'residential', 'office', 'transport_hub',
    'waterfront', 'shopping_district', 'mixed_use', 'destination', 'nature_park'
  ];
  
  if (dataToSave.area_type) {
    if (!validAreaTypes.includes(dataToSave.area_type)) {
      console.error(
        `❌ INVALID area_type detected: "${dataToSave.area_type}"\n` +
        `   Valid types: ${validAreaTypes.join(', ')}\n` +
        `   → Defaulting to "mixed_use"\n` +
        `   This suggests old schema data or code bug!`
      );
      dataToSave.area_type = 'mixed_use';
    }
  } else {
    console.warn(`⚠️ Missing area_type for business ${businessId}, defaulting to "mixed_use"`);
    dataToSave.area_type = 'mixed_use';
  }
  
  // VALIDATION: Ensure required fields exist
  if (!dataToSave.latitude || !dataToSave.longitude) {
    throw new Error(`Missing required coordinates for business ${businessId}`);
  }
  
  console.log(`💾 Saving location intelligence: area_type="${dataToSave.area_type}", neighborhood="${dataToSave.neighborhood}"`);
  
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
  
  console.log(`✅ Location intelligence saved successfully for business ${businessId}`);
}
```

---

### File 3: `supabase/functions/populate-location-intelligence/services/google-maps.ts`

**Optional Enhancement**: Add logging to help debug geocoding issues

**Location**: In `geocodeAddress()` method, after extracting components (around line 95)

**Add this logging**:

```typescript
// Log what Google returned for debugging
console.log(
  `📍 Google Geocoding Result:\n` +
  `   Formatted Address: ${result.formatted_address}\n` +
  `   Coordinates: ${location.lat}, ${location.lng}\n` +
  `   City (locality): ${city || 'NOT FOUND'}\n` +
  `   Neighborhood (sublocality): ${neighborhood || 'NOT FOUND'}\n` +
  `   Postal Code: ${postal_code || 'NOT FOUND'}\n` +
  `   Place ID: ${result.place_id || 'N/A'}`
);

// Log all address components for debugging mismatches
if (!city || !neighborhood) {
  console.warn(`⚠️ Missing components. All address_components:`, 
    result.address_components.map((c: any) => ({
      name: c.long_name,
      types: c.types
    }))
  );
}
```

---

## Testing After Implementation

1. **Deploy updated Edge Functions**:
   ```bash
   npx supabase functions deploy populate-location-intelligence
   ```

2. **Test with problematic business**:
   ```bash
   curl -X POST \
     https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/populate-location-intelligence \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"business_id": "95d657ad-d791-422b-ad40-ec7a5f1c2b0c", "force_refresh": true}'
   ```

3. **Check logs** in Supabase Dashboard → Edge Functions → populate-location-intelligence → Logs

4. **Verify results**:
   ```sql
   SELECT neighborhood, area_type, latitude, longitude
   FROM business_location_intelligence
   WHERE business_id = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c';
   ```

Expected after fix:
- `neighborhood` = `"Silkeborg"` (corrected from "Aarhus")
- `area_type` = valid value (e.g., `"city_centre"`, `"mixed_use"`)
- Coordinates unchanged: `56.16744600, 9.55035480`
