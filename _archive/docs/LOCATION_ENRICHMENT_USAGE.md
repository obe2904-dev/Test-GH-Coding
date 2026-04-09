# Location Enrichment - Usage Examples

## Overview

The `location-enrichment` module provides deterministic computation of structured location context from basic address data. No external APIs required.

## Basic Usage

```typescript
import { computeLocationEnrichment } from './_shared/location/location-enrichment.ts'

// Basic example - minimal input
const enrichment = computeLocationEnrichment({
  city: 'Aarhus',
  country: 'Denmark',
  address_line1: 'Åboulevarden 23'
})

console.log(enrichment)
// {
//   version: "1.0",
//   macro: {
//     country: "Denmark",
//     city: "Aarhus",
//     city_tier: "major_city"
//   },
//   micro: {
//     area_type: "waterfront",
//     nearby_signals: [
//       "waterfront (å)",
//       "scenic views likely",
//       "evening foot traffic",
//       "tourist appeal"
//     ],
//     confidence: "medium"
//   }
// }
```

## With Coordinates (High Confidence)

```typescript
const enrichment = computeLocationEnrichment({
  city: 'København',
  country: 'Denmark',
  address_line1: 'Banegårdspladsen 7',
  latitude: 55.6761,
  longitude: 12.5683
})

console.log(enrichment)
// {
//   version: "1.0",
//   geo: {
//     lat: 55.6761,
//     lng: 12.5683,
//     accuracy: "high"
//   },
//   macro: {
//     country: "Denmark",
//     city: "København",
//     city_tier: "capital"
//   },
//   micro: {
//     area_type: "transit_hub",
//     nearby_signals: [
//       "near transit (Banegårdspladsen)",
//       "commuter traffic",
//       "quick stops",
//       "morning/evening rush"
//     ],
//     confidence: "high"
//   }
// }
```

## Area Type Detection

### Waterfront

```typescript
// Danish waterfront indicators: å, åen, havn, havnen, kanal, fjord, strand
computeLocationEnrichment({
  city: 'Aarhus',
  address_line1: 'Havnegade 15'
})
// → area_type: "waterfront"

computeLocationEnrichment({
  city: 'København',
  address_line1: 'Ved Kanalen 8'
})
// → area_type: "waterfront"
```

### Transit Hub

```typescript
// Transit indicators: Station, Banegård, Hovedbanen, etc.
computeLocationEnrichment({
  city: 'Odense',
  address_line1: 'Ved Odense Station 1'
})
// → area_type: "transit_hub"

computeLocationEnrichment({
  city: 'Hamburg',
  country: 'Germany',
  address_line1: 'Hauptbahnhof 12'
})
// → area_type: "transit_hub"
```

### Shopping District

```typescript
// Shopping indicators: Torv, Strøget, Gågade, Center, Mall
computeLocationEnrichment({
  city: 'København',
  address_line1: 'Strøget 42'
})
// → area_type: "shopping_street"

computeLocationEnrichment({
  city: 'Aarhus',
  address_line1: 'Store Torv 8'
})
// → area_type: "shopping_street"
```

### Tourist Zone

```typescript
// Tourist landmarks: Nyhavn, Rådhuspladsen, Gamla Stan, etc.
computeLocationEnrichment({
  city: 'København',
  address_line1: 'Nyhavn 17'
})
// → area_type: "tourist_zone"

computeLocationEnrichment({
  city: 'Stockholm',
  country: 'Sweden',
  address_line1: 'Gamla Stan 8'
})
// → area_type: "tourist_zone"
```

### Campus

```typescript
// Campus indicators: Universitet, Campus, Højskole
computeLocationEnrichment({
  city: 'Aarhus',
  address_line1: 'Campus Vej 55'
})
// → area_type: "campus"
```

### Business District

```typescript
// Business indicators: Vesterbro, Business, Erhverv, Kontor
computeLocationEnrichment({
  city: 'København',
  address_line1: 'Vesterbrogade 1A'
})
// → area_type: "business_district"
```

## City Tier Classification

### Denmark

```typescript
// Capital
classifyCityTier('København', 'Denmark') // → "capital"
classifyCityTier('Copenhagen', 'Denmark') // → "capital"

// Major cities
classifyCityTier('Aarhus', 'Denmark')    // → "major_city"
classifyCityTier('Odense', 'Denmark')    // → "major_city"
classifyCityTier('Aalborg', 'Denmark')   // → "major_city"

// Mid-tier cities
classifyCityTier('Esbjerg', 'Denmark')   // → "mid_city"
classifyCityTier('Randers', 'Denmark')   // → "mid_city"
classifyCityTier('Kolding', 'Denmark')   // → "mid_city"

// Small towns (unlisted)
classifyCityTier('Skagen', 'Denmark')    // → "small_town"
```

### Germany

```typescript
classifyCityTier('Berlin', 'Germany')    // → "capital"
classifyCityTier('Hamburg', 'Germany')   // → "major_city"
classifyCityTier('München', 'Germany')   // → "major_city"
classifyCityTier('Leipzig', 'Germany')   // → "mid_city"
```

### Sweden

```typescript
classifyCityTier('Stockholm', 'Sweden')  // → "capital"
classifyCityTier('Göteborg', 'Sweden')   // → "major_city"
classifyCityTier('Malmö', 'Sweden')      // → "major_city"
classifyCityTier('Västerås', 'Sweden')   // → "mid_city"
```

## Confidence Levels

### High Confidence

- ✅ Geo coordinates provided
- ✅ Specific area type detected
- ✅ Multiple nearby signals (2+)

```typescript
computeLocationEnrichment({
  city: 'Aarhus',
  address_line1: 'Åboulevarden 23',
  latitude: 56.1629,
  longitude: 10.2039
})
// → confidence: "high"
```

### Medium Confidence

- ⚠️ No geo coordinates OR specific area type detected
- ⚠️ 1-2 signals

```typescript
computeLocationEnrichment({
  city: 'Esbjerg',
  address_line1: 'Ved Havnen 10'
  // No coordinates
})
// → confidence: "medium" (has waterfront detection)
```

### Low Confidence

- ❌ No geo coordinates
- ❌ Unknown area type
- ❌ Few or no signals

```typescript
computeLocationEnrichment({
  city: 'Skagen',
  address_line1: 'Hovedgaden 12'
})
// → confidence: "low"
```

## Integration with Database

### Populating `business_locations.enrichment`

```typescript
import { createClient } from '@supabase/supabase-js'
import { computeLocationEnrichment } from './_shared/location/location-enrichment.ts'

const supabase = createClient(url, key)

// Get all locations without enrichment
const { data: locations } = await supabase
  .from('business_locations')
  .select('*')
  .is('enrichment', null)

// Compute and update enrichment for each
for (const location of locations) {
  const enrichment = computeLocationEnrichment({
    address_line1: location.address_line1,
    address_line2: location.address_line2,
    city: location.city,
    postal_code: location.postal_code,
    country: location.country,
    latitude: location.latitude,
    longitude: location.longitude
  })

  await supabase
    .from('business_locations')
    .update({ enrichment })
    .eq('id', location.id)
}
```

### Querying Enriched Locations

```sql
-- Find all waterfront locations
SELECT 
  id, 
  city,
  enrichment->'micro'->>'area_type' as area_type,
  enrichment->'micro'->'nearby_signals' as signals
FROM business_locations
WHERE enrichment->'micro'->>'area_type' = 'waterfront';

-- Find capital city locations with high confidence
SELECT 
  id,
  city,
  enrichment->'macro'->>'city_tier' as city_tier,
  enrichment->'micro'->>'confidence' as confidence
FROM business_locations
WHERE enrichment->'macro'->>'city_tier' = 'capital'
  AND enrichment->'micro'->>'confidence' = 'high';
```

## Testing

```bash
# Run all tests
cd supabase/functions/_shared/location
deno test location-enrichment.test.ts

# Run with verbose output
deno test --allow-read location-enrichment.test.ts

# Run specific test
deno test --filter "waterfront" location-enrichment.test.ts
```

## Extending the Module

### Adding New Area Types

1. Define keywords in the constants section
2. Add detection logic in `detectAreaType()`
3. Add behavioral signals in `extractNearbySignals()`
4. Add tests in `location-enrichment.test.ts`

### Adding New Countries

1. Add to `CITY_TIERS` constant
2. Add language-specific keywords to keyword arrays
3. Add country code normalization in `normalizeCountryCode()`
4. Add tests for new country

### Adjusting Confidence Thresholds

Modify `computeConfidence()` function:

```typescript
function computeConfidence(
  hasGeo: boolean,
  areaType: LocationEnrichment['micro']['area_type'],
  signalCount: number
): LocationEnrichment['micro']['confidence'] {
  // Adjust thresholds here
  if (hasGeo && areaType !== 'unknown' && signalCount >= 3) { // Changed from 2
    return 'high'
  }
  // ... etc
}
```

## Fallback Behavior

If minimal data is provided, the module gracefully degrades:

```typescript
computeLocationEnrichment({ city: 'UnknownCity' })
// {
//   version: "1.0",
//   macro: {
//     country: "Denmark",  // Default
//     city: "UnknownCity",
//     city_tier: "small_town"  // Conservative default
//   },
//   micro: {
//     area_type: "unknown",
//     nearby_signals: ["no distinctive area markers"],
//     confidence: "low"
//   }
// }
```

## Performance

- **No external API calls** - all computation is local
- **Fast execution** - simple string matching and lookups
- **Deterministic** - same input always produces same output
- **Cacheable** - results can be stored and reused

## Limitations

1. **Requires explicit keywords** - Won't detect nuanced location types without clear address markers
2. **Language-specific** - Best results with Danish/German/Swedish addresses
3. **No geocoding** - Doesn't convert addresses to coordinates (provide coordinates for better results)
4. **Static city lists** - City tier classifications require updates for new cities

## Recommended Workflow

1. **Onboarding**: Collect address + optional coordinates
2. **Compute enrichment**: Run `computeLocationEnrichment()` immediately
3. **Store**: Save to `business_locations.enrichment` column
4. **Use**: Read enrichment for AI context, filtering, analytics
5. **Update**: Re-run if address changes or city tier list updates
