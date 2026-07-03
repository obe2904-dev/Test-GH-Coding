# Location Enrichment - Quick Start Guide

## ⚡ TL;DR

```typescript
import { computeLocationEnrichment } from './_shared/location/location-enrichment.ts'

// Basic usage
const enrichment = computeLocationEnrichment({
  city: 'Aarhus',
  country: 'Denmark',
  address_line1: 'Åboulevarden 23'
})

// Result:
// {
//   version: '1.0',
//   macro: { country: 'Denmark', city: 'Aarhus', city_tier: 'major_city' },
//   micro: {
//     area_type: 'waterfront',
//     nearby_signals: ['waterfront (å)', 'scenic views likely', ...],
//     confidence: 'medium'
//   }
// }
```

## 🎯 Key Features

- ✅ **Zero API calls** - Fully offline, deterministic
- ✅ **Fast** - 1-2ms per location
- ✅ **Multi-language** - Danish, German, Swedish + English
- ✅ **Smart fallback** - Works without coordinates, graceful degradation
- ✅ **Type-safe** - Matches LocationEnrichment type exactly

## 📊 What You Get

### City Tier (38 cities classified)
- **capital**: København, Berlin, Stockholm
- **major_city**: Aarhus, Odense, Aalborg, Hamburg, München, Göteborg, Malmö
- **mid_city**: 28 mid-tier cities across DK/DE/SE
- **small_town**: Any unlisted city (fallback)

### Area Type (6 types + unknown)
- **waterfront**: Rivers, harbors, canals (å, havn, fluss, hamn)
- **transit_hub**: Stations, terminals (Banegård, Hauptbahnhof, Station)
- **shopping_street**: Shopping districts (Strøget, Platz, Torg)
- **tourist_zone**: Landmarks (Nyhavn, Altstadt, Gamla Stan)
- **campus**: Universities (Universitet, Hochschule)
- **business_district**: Business areas (Vesterbro, Geschäftsviertel)
- **unknown**: No clear match (fallback)

### Confidence Level
- **high**: Geo coordinates + specific area + 2+ signals
- **medium**: Specific area OR geo coordinates
- **low**: Unknown area + no geo

### Nearby Signals (max 6)
Behavioral insights based on area type:
- Waterfront: "scenic views likely", "evening foot traffic", "tourist appeal"
- Transit: "commuter traffic", "quick stops", "morning/evening rush"
- Shopping: "retail traffic", "weekend shoppers", "lunch crowd"
- Tourist: "high foot traffic", "international visitors", "weekend busy"
- Campus: "student traffic", "term-time busy", "study-friendly"
- Business: "weekday lunch crowd", "after-work traffic", "quiet weekends"

## 🚀 Common Use Cases

### 1. Onboarding - Enrich New Location
```typescript
// User enters location during onboarding
const enrichment = computeLocationEnrichment({
  city: formData.city,
  country: formData.country,
  address_line1: formData.address,
  latitude: formData.latitude,  // optional
  longitude: formData.longitude  // optional
})

// Store in database
await supabase
  .from('business_locations')
  .insert({
    ...locationData,
    enrichment
  })
```

### 2. Migration - Backfill Existing Locations
```typescript
// Get all locations without enrichment
const { data: locations } = await supabase
  .from('business_locations')
  .select('*')
  .is('enrichment', null)

// Compute + update
for (const location of locations) {
  const enrichment = computeLocationEnrichment(location)
  
  await supabase
    .from('business_locations')
    .update({ enrichment })
    .eq('id', location.id)
}
```

### 3. Query - Find Locations by Type
```sql
-- Find all waterfront locations
SELECT id, city, address_line1,
       enrichment->'micro'->>'area_type' as area_type,
       enrichment->'micro'->>'confidence' as confidence
FROM business_locations
WHERE enrichment->'micro'->>'area_type' = 'waterfront'
  AND enrichment->'micro'->>'confidence' = 'high';

-- Find capitals with high confidence
SELECT id, city,
       enrichment->'macro'->>'city_tier' as city_tier,
       enrichment->'micro'->>'confidence' as confidence
FROM business_locations
WHERE enrichment->'macro'->>'city_tier' = 'capital'
  AND enrichment->'micro'->>'confidence' = 'high';
```

### 4. AI Integration - Use in Post Generation
```typescript
// Get location enrichment for context
const { data: location } = await supabase
  .from('business_locations')
  .select('enrichment')
  .eq('id', locationId)
  .single()

// Use in AI prompt
const prompt = `
Generate a social media post for this business:

Location context:
- City tier: ${location.enrichment.macro.city_tier}
- Area type: ${location.enrichment.micro.area_type}
- Signals: ${location.enrichment.micro.nearby_signals.join(', ')}

${location.enrichment.macro.city_tier === 'capital' 
  ? 'Use cosmopolitan style, reference city landmarks' 
  : 'Use local charm, community-focused'}

${location.enrichment.micro.area_type === 'waterfront'
  ? 'Emphasize scenic views, evening ambiance'
  : ''}
`
```

## 🧪 Testing

```bash
# Run all tests (27 tests)
cd supabase/functions/_shared/location
deno test location-enrichment.test.ts --allow-read

# Expected output:
# ✅ 27 passed | 0 failed (19ms)
```

## 📝 Example Outputs

### High Confidence (Waterfront with Coordinates)
```json
{
  "version": "1.0",
  "geo": {
    "lat": 56.1629,
    "lng": 10.2039,
    "accuracy": "high"
  },
  "macro": {
    "country": "Denmark",
    "city": "Aarhus",
    "city_tier": "major_city"
  },
  "micro": {
    "area_type": "waterfront",
    "nearby_signals": [
      "waterfront (å)",
      "scenic views likely",
      "evening foot traffic",
      "tourist appeal"
    ],
    "confidence": "high"
  }
}
```

### Medium Confidence (Shopping Street, No Coords)
```json
{
  "version": "1.0",
  "macro": {
    "country": "Denmark",
    "city": "København",
    "city_tier": "capital"
  },
  "micro": {
    "area_type": "shopping_street",
    "nearby_signals": [
      "shopping area (Strøget)",
      "retail traffic",
      "weekend shoppers",
      "lunch crowd"
    ],
    "confidence": "medium"
  }
}
```

### Low Confidence (Unknown Area)
```json
{
  "version": "1.0",
  "macro": {
    "country": "Denmark",
    "city": "Skagen",
    "city_tier": "small_town"
  },
  "micro": {
    "area_type": "unknown",
    "nearby_signals": [],
    "confidence": "low"
  }
}
```

## 🔧 Extending the Module

### Add a New City
```typescript
// In location-enrichment.ts
const CITY_TIERS = {
  DK: {
    capital: ['København'],
    major_city: ['Aarhus', 'Odense', 'Aalborg'],
    mid_city: ['Esbjerg', 'Randers', 'YourNewCity'],  // Add here
  },
  // ...
}
```

### Add a New Area Type
```typescript
// 1. Add keywords
const YOUR_TYPE_KEYWORDS = {
  DK: ['keyword1', 'keyword2'],
  DE: ['keyword3', 'keyword4'],
  SE: ['keyword5', 'keyword6'],
  EN: ['keyword7', 'keyword8']
}

// 2. Add detection in detectAreaType()
const yourTypeMatch = YOUR_TYPE_KEYWORDS[countryCode].find(kw => matchesKeyword(fullText, kw))
if (yourTypeMatch) {
  signals.push(`your type (${yourTypeMatch})`)
  return { type: 'your_type', signals }
}

// 3. Add behavioral signals in extractNearbySignals()
case 'your_type':
  signals.push('signal 1', 'signal 2', 'signal 3')
  break
```

### Add a New Country
```typescript
// 1. Add to normalizeCountryCode()
if (normalized === 'norway' || normalized === 'norge' || normalized === 'no') {
  return 'NO'
}

// 2. Add to CITY_TIERS
const CITY_TIERS = {
  // ...
  NO: {
    capital: ['Oslo'],
    major_city: ['Bergen', 'Trondheim', 'Stavanger'],
    mid_city: ['Drammen', 'Kristiansand']
  }
}

// 3. Add to keyword sets
const WATERFRONT_KEYWORDS = {
  // ...
  NO: ['elv', 'havn', 'fjord', 'strand']
}
```

## 🎓 Best Practices

### DO ✅
- ✅ Store enrichment in database during onboarding
- ✅ Use confidence level to decide when to ask user for clarification
- ✅ Query by area_type or city_tier for analytics
- ✅ Use signals in AI prompts for context-aware content
- ✅ Re-compute enrichment if user updates address

### DON'T ❌
- ❌ Don't rely on enrichment for mission-critical location accuracy
- ❌ Don't expect POI data (nearby restaurants, shops, etc.)
- ❌ Don't expect real-time traffic or footfall data
- ❌ Don't use for non-DK/DE/SE countries (will default to English keywords)
- ❌ Don't skip storing enrichment (compute once, use many times)

## 🐛 Troubleshooting

### "Area type is always 'unknown'"
**Cause**: Address doesn't contain recognized keywords

**Solutions**:
- Check if city/country are correct
- Verify address format (e.g., "Åboulevarden" not "A-boulevarden")
- Add more keywords to keyword sets
- Manually override area_type in database if needed

### "Confidence is always 'low'"
**Cause**: No geo coordinates + no keyword matches

**Solutions**:
- Add latitude/longitude during onboarding
- Improve keyword coverage for your region
- Accept low confidence for ambiguous locations

### "Wrong area type detected"
**Cause**: Keyword collision (e.g., "gård" in "Banegård" vs "Kirkegård")

**Solutions**:
- Check keyword priority order (Transit > Tourist > Shopping > Waterfront)
- Use more specific keywords (e.g., "Banegård" instead of "gård")
- Adjust matchesKeyword() logic for edge cases

## 📚 Additional Resources

- **Full documentation**: `LOCATION_ENRICHMENT_USAGE.md`
- **Implementation details**: `STEP_2_COMPLETE.md`
- **Type definitions**: `supabase/functions/_shared/types/location-enrichment.ts`
- **Unit tests**: `supabase/functions/_shared/location/location-enrichment.test.ts`

## 🚦 Status

- ✅ Phase 0: Types defined
- ✅ Step 1: Database migration deployed
- ✅ Step 2: Computation function implemented (YOU ARE HERE)
- ⏸️ Step 3: Populate existing locations
- ⏸️ Phase 2: Execution profile generation
- ⏸️ Phase 3: AI integration

## 💡 Quick Tips

1. **High confidence = trust the data**: Use directly in AI prompts
2. **Medium confidence = verify signals**: Check if signals make sense
3. **Low confidence = ask user**: Prompt for manual verification
4. **No geo? No problem**: Module works fine without coordinates
5. **Update on move**: Re-compute if business changes location

---

**Need help?** Check `LOCATION_ENRICHMENT_USAGE.md` for detailed examples and SQL integration patterns.
