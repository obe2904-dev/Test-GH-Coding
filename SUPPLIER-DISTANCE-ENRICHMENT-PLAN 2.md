# Supplier Distance Enrichment System

## GOAL
Make geographic claims factual by adding supplier distance data to business_location_intelligence.

## DATA SOURCE
Menu items already contain supplier location mentions in `item_description`:
- "Sausages from Højer"
- "Danish cheese from Tange Sø"

## SOLUTION ARCHITECTURE

### 1. Add Supplier Analysis Field
```sql
ALTER TABLE business_location_intelligence
ADD COLUMN supplier_analysis JSONB;
```

Structure:
```json
{
  "suppliers": [
    {
      "name": "Højer",
      "type": "location",  // or "brand" for non-location names
      "distance_km": 160,
      "verified": true,
      "mentioned_in": ["THE ONE brunch", "Frokost menu"]
    },
    {
      "name": "Tange Sø",
      "type": "location",
      "distance_km": 90,
      "verified": true,
      "mentioned_in": ["THE FAVORIT brunch"]
    }
  ],
  "geographic_scope": "regional",  // or "local" (<30km), "national"
  "local_count": 0,
  "regional_count": 2,
  "updated_at": "2026-05-07T..."
}
```

### 2. Danish Location Distance Database
Hardcoded known distances from major cities (static, factual):

```typescript
const KNOWN_DANISH_LOCATIONS: Record<string, {lat: number, lng: number}> = {
  "Aarhus": {lat: 56.1629, lng: 10.2039},
  "Højer": {lat: 54.9561, lng: 8.6667},  // ~160km from Aarhus
  "Tange": {lat: 56.3500, lng: 9.5833},  // Tange Sø ~90km from Aarhus
  "Bornholm": {lat: 55.1333, lng: 14.9167},
  "Fanø": {lat: 55.4333, lng: 8.4167},
  "Thise": {lat: 56.6833, lng: 9.2667},
  // Add more as needed
};

function calculateDistance(lat1, lon1, lat2, lon2): number {
  // Haversine formula
}
```

### 3. Extraction Process

**When:** After menu sync, before brand profile generation

**How:**
1. Parse all `item_description` fields for pattern: `from {location}`
2. Match against known locations database
3. Calculate distance from business city
4. Aggregate per business
5. Store in `business_location_intelligence.supplier_analysis`

### 4. Layer 3 Integration

Pass supplier_analysis to identity-profile.ts:

```typescript
interface LocationData {
  area_type?: string;
  local_location_reference?: string;
  supplier_analysis?: {
    geographic_scope: 'local' | 'regional' | 'national';
    local_count: number;
    regional_count: number;
  };
}
```

Update SYSTEM_PROMPT Rule 9:
```typescript
9. GEOGRAPHIC ACCURACY (uses supplier_analysis data when available)
   
   IF supplier_analysis exists:
     - geographic_scope="local" → Title "Lokal forankring" + "lokale produkter"
     - geographic_scope="regional" → Title "Regional forankring" or "Dansk kvalitet" + "regionale/danske råvarer"
     - geographic_scope="national" → Title "Dansk kvalitet" + "danske råvarer"
   
   IF no supplier_analysis:
     - Default to "Dansk kvalitet" + "danske råvarer" (safe, factual)
   
   NEVER claim "lokal" without data evidence.
```

## IMPLEMENTATION STEPS

1. **Database Migration** (ADD-SUPPLIER-ANALYSIS.sql)
   - Add supplier_analysis JSONB column
   
2. **Known Locations Database** (scripts/known-locations.ts)
   - Danish cities/regions with coordinates
   - Distance calculation function
   
3. **Supplier Extractor** (scripts/extract-suppliers.ts)
   - Parse menu descriptions
   - Match locations
   - Calculate distances
   - Update business_location_intelligence
   
4. **Layer 3 Integration** (identity-profile.ts)
   - Read supplier_analysis
   - Use in SYSTEM_PROMPT rule
   - Pass to user prompt

5. **Run for Café Faust**
   - Extract: Højer (160km), Tange Sø (90km)
   - Result: geographic_scope="regional", regional_count=2
   - Output: "Regional forankring - danske råvarer fra Højer og Tange Sø" OR "Dansk kvalitet - danske råvarer"

## WHY THIS IS FACTUAL & GENERIC

✅ **Data-driven:** Extracts from actual menu descriptions  
✅ **Verifiable:** Uses known geographic coordinates  
✅ **Generic:** Works for any business in any Danish city  
✅ **Scalable:** Add more locations to database as needed  
✅ **Accurate:** Haversine formula for real distances  
✅ **Transparent:** Shows which items mention which suppliers  

## NEXT STEPS

User to decide:
- **Quick:** Just run extractor for Café Faust (manual, one-time)
- **Proper:** Build full system (automated, all businesses)
