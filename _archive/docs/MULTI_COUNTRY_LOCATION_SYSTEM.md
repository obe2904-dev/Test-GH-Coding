# Multi-Country Location Type Matching System

## Overview

The location type matching system now supports **multiple countries** with locale-specific patterns and keywords. This enables accurate location analysis across Denmark, Sweden, Germany, and the United Kingdom using pattern-based intelligence instead of hardcoded location lists.

## Supported Countries

- 🇩🇰 **Denmark (DK)** - Danish keywords, patterns, and language
- 🇸🇪 **Sweden (SE)** - Swedish keywords, patterns, and language  
- 🇩🇪 **Germany (DE)** - German keywords, patterns, and language
- 🇬🇧 **United Kingdom (UK)** - English keywords, patterns, and language

## Architecture

### 1. Country Pattern Configuration

**File:** `src/lib/location/countryPatterns.ts`

Each country has its own pattern configuration:

```typescript
export interface CountryPatterns {
  city_centre: {
    neighborhoodKeywords: string[];        // e.g., ['centrum', 'city', 'midtby']
    streetTypes: Array<{pattern, reason, boost}>;  // e.g., 'gågade', 'torv', 'plads'
    iconicLandmarks?: string[];            // Optional city-specific landmarks
  };
  residential: {
    neighborhoodKeywords: string[];
    lowDensityReason: string;
    highCommercialReason: string;
    defaultReason: string;
  };
  tourist: { /* ... */ };
  waterfront: { /* ... */ };
  shopping: { /* ... */ };
  office: { /* ... */ };
  transport: { /* ... */ };
  student: { /* ... */ };
  mixed_use: { /* ... */ };
  destination: { /* ... */ };
  language: string;  // ISO 639-1 code ('da', 'sv', 'de', 'en')
}
```

### 2. Pattern Examples by Country

#### Denmark 🇩🇰
```typescript
city_centre: {
  neighborhoodKeywords: ['indre by', 'centrum', 'city', 'midtby'],
  streetTypes: [
    { pattern: 'gågade', reason: 'Gågade', boost: 25 },
    { pattern: 'torv', reason: 'Ved torvet', boost: 20 },
    { pattern: 'plads', reason: 'Ved pladsen', boost: 15 }
  ]
},
waterfront: {
  waterKeywords: ['havn', 'kaj', 'strand', 'bro', 'å', 'limfjorden']
}
```

#### Sweden 🇸🇪
```typescript
city_centre: {
  neighborhoodKeywords: ['centrum', 'city', 'stan', 'innerstan'],
  streetTypes: [
    { pattern: 'gågata', reason: 'Gågata', boost: 25 },
    { pattern: 'torg', reason: 'Vid torget', boost: 20 }
  ]
},
waterfront: {
  waterKeywords: ['hamn', 'kaj', 'strand', 'sjö', 'å']
}
```

#### Germany 🇩🇪
```typescript
city_centre: {
  neighborhoodKeywords: ['zentrum', 'altstadt', 'innenstadt', 'mitte'],
  streetTypes: [
    { pattern: 'fußgängerzone', reason: 'Fußgängerzone', boost: 25 },
    { pattern: 'platz', reason: 'Am Platz', boost: 20 }
  ]
},
waterfront: {
  waterKeywords: ['hafen', 'kai', 'ufer', 'see', 'fluss']
}
```

#### UK 🇬🇧
```typescript
city_centre: {
  neighborhoodKeywords: ['city centre', 'town centre', 'downtown', 'central'],
  streetTypes: [
    { pattern: 'high street', reason: 'High Street', boost: 25 },
    { pattern: 'square', reason: 'At the square', boost: 20 }
  ]
},
waterfront: {
  waterKeywords: ['harbour', 'quay', 'wharf', 'pier', 'waterfront', 'riverside']
}
```

## Usage

### 1. In Production Code

```typescript
import { analyzeLocationTypes } from '../../lib/location/locationTypeMatcher';

// Get country code from business data
const countryCode = business.country || 'DK';

// Create location context
const locationContext = {
  address: 'Drottninggatan 45, Stockholm',
  neighborhood: 'Gamla Stan',
  city: 'Stockholm',
  countryCode: 'SE',  // Optional: can also pass as parameter
  nearbyPOIs: {
    restaurants: 40,
    cafes: 28,
    hotels: 12,
    tourist_attractions: 8
  }
};

// Analyze with country-specific patterns
const matches = analyzeLocationTypes(locationContext, 'SE');
```

### 2. In Test Page

Navigate to `/dashboard/test-location-types` and:
1. Select country (DK, SE, DE, UK)
2. Choose a test case for that country
3. Click "Test" to see results

The test page automatically filters test cases by selected country and applies appropriate patterns.

## Integration Points

### LocationIntelligencePage

**File:** `src/pages/dashboard/LocationIntelligencePage.tsx`

```typescript
// Get country code from business data
const businessDataForCountry = await loadBusinessData();
const countryCode = (businessDataForCountry as any)?.country || 'DK';

// Pass country code to location context
const locationContext = {
  address: address,
  neighborhood: analysis.neighborhood,
  city: analysis.city,
  countryCode: countryCode,  // From business.country
  nearbyPOIs: { /* ... */ }
};

// Analyze with country-specific patterns
const locationTypeMatches = analyzeLocationTypes(locationContext, countryCode);
console.log('📍 STEP 1 - Location Type Matches (Country: ' + countryCode + '):', locationTypeMatches);
```

### Database Storage

Location type matches are stored in the `location_type_matches` column with **reasons in the appropriate language**:

```json
{
  "city_centre": {
    "match_score": 85,
    "match_level": "strong",
    "confidence": 0.9,
    "reason": "Gågade. Høj tæthed af restauranter og cafeer"  // Danish
  },
  "city_centre": {
    "match_score": 85,
    "match_level": "strong",
    "confidence": 0.9,
    "reason": "Gågata. Hög täthet av restauranger och caféer"  // Swedish
  }
}
```

## Adding New Countries

To add support for a new country:

### 1. Add Country Pattern Configuration

Edit `src/lib/location/countryPatterns.ts`:

```typescript
export const COUNTRY_PATTERNS: Record<string, CountryPatterns> = {
  // ... existing countries
  
  NO: {  // Norway
    city_centre: {
      neighborhoodKeywords: ['sentrum', 'byen', 'city'],
      streetTypes: [
        { pattern: 'gågate', reason: 'Gågate', boost: 25 },
        { pattern: 'torg', reason: 'Ved torget', boost: 20 },
        { pattern: 'plass', reason: 'Ved plassen', boost: 15 }
      ],
      iconicLandmarks: ['karl johans gate', 'bryggen']
    },
    residential: {
      neighborhoodKeywords: ['boligområde', 'bydel', 'område'],
      lowDensityReason: 'Lav tetthet av butikker',
      highCommercialReason: 'Høy kommersiell tetthet (ikke primært boligområde)',
      defaultReason: 'Ikke primært boligområde'
    },
    waterfront: {
      waterKeywords: ['havn', 'kai', 'strand', 'fjord', 'sjø'],
      closeProximityReason: 'Meget nær vann',
      moderateProximityReason: 'Nær vann'
    },
    // ... complete all 10 location types
    language: 'no'
  }
};
```

### 2. Add Test Cases

Edit `src/pages/dashboard/TestLocationTypesPage.tsx`:

```typescript
const testCases: Record<string, LocationContext> = {
  // ... existing test cases
  
  // NORWAY
  oslo_sentrum: {
    address: 'Karl Johans gate 10, Oslo',
    neighborhood: 'Oslo Sentrum',
    city: 'Oslo',
    countryCode: 'NO',
    nearbyPOIs: {
      restaurants: 35,
      cafes: 25,
      hotels: 12,
      tourist_attractions: 8
    }
  },
  bergen_bryggen: {
    address: 'Bryggen, Bergen',
    neighborhood: 'Bryggen',
    city: 'Bergen',
    countryCode: 'NO',
    waterDistance: 50,
    nearbyPOIs: {
      restaurants: 28,
      cafes: 18,
      hotels: 10,
      tourist_attractions: 6
    }
  }
};
```

### 3. Update Country Selector UI

Edit `src/pages/dashboard/TestLocationTypesPage.tsx`:

```typescript
<div className="flex gap-4 mb-6">
  {['DK', 'SE', 'DE', 'UK', 'NO'].map(country => (
    <button key={country} /* ... */>
      {country === 'NO' ? '🇳🇴 Norway' : ''}
      {/* ... other countries */}
    </button>
  ))}
</div>
```

### 4. Test Your Patterns

1. Navigate to `/dashboard/test-location-types`
2. Select your new country
3. Test with multiple city sizes (small, medium, large)
4. Verify scores and reasons are appropriate
5. Tune thresholds if needed

## Pattern-Based Intelligence

### Why Patterns vs. Hardcoded Lists?

❌ **Hardcoded Approach:**
```typescript
if (address.includes('strøget') || 
    address.includes('nyhavn') || 
    address.includes('vestergade')) {
  // Only works for København
}
```

✅ **Pattern-Based Approach:**
```typescript
if (patterns.city_centre.streetTypes.some(type => 
  address.includes(type.pattern.toLowerCase())
)) {
  // Works for ANY Danish city with gågade/torv/plads
}
```

### Universal Signals

Some signals work across all countries:

- **POI Density:** Restaurant/cafe count indicates commercial activity
- **Thresholds:** 
  - `> 35` = Very high density (strong city centre)
  - `> 20` = High density (moderate city centre)
  - `> 12` = Moderate density (small city centre)
  - `< 5` = Low density (residential/destination)
- **Water Distance:** Distance-based scoring (< 100m, < 300m, < 500m)
- **Diversity:** Office + retail + hotel presence for mixed-use

### Country-Specific Signals

Keywords and terminology vary by language:

| Location Type | DK | SE | DE | UK |
|--------------|----|----|----|----|
| Pedestrian Street | gågade | gågata | fußgängerzone | high street |
| Square | torv | torg | platz | square |
| Centre | centrum | centrum | zentrum | centre |
| Harbor | havn | hamn | hafen | harbour |

## Console Logging

When analyzing a location, you'll see:

```
🧪 Testing: Drottninggatan 45, Stockholm Country: SE
📍 STEP 1 - Location Type Matches (Country: SE):
{
  city_centre: {
    match_score: 90,
    match_level: 'strong',
    confidence: 0.9,
    reason: 'Gågata. Hög täthet av restauranger och caféer'
  },
  tourist: {
    match_score: 75,
    match_level: 'strong',
    confidence: 0.85,
    reason: 'Hög täthet av turistattraktioner'
  }
}
```

## Performance Considerations

- **Lazy Loading:** Pattern configuration loaded only when needed
- **Fallback:** Unknown country codes default to Denmark (DK)
- **Caching:** Country patterns loaded once, reused for multiple analyses
- **Lightweight:** Pattern matching uses simple string operations

## Future Enhancements

### 1. More Countries
- 🇳🇴 Norway
- 🇫🇮 Finland
- 🇳🇱 Netherlands
- 🇫🇷 France
- 🇪🇸 Spain
- 🇮🇹 Italy

### 2. Regional Variations
- UK: Scotland vs. England patterns
- Germany: Bavaria vs. Northern Germany
- Sweden: Stockholm vs. Göteborg

### 3. Dynamic Pattern Learning
- Analyze successful matches to improve patterns
- Machine learning to discover new keywords
- User feedback to refine scoring

### 4. Multi-Language Reasons
- Generate reasons in business's primary language
- Support for multi-lingual displays
- Translation system for pattern reasons

## Troubleshooting

### Issue: Wrong country patterns applied

**Solution:** Verify `business.country` field is set correctly in database:
```sql
SELECT id, name, country FROM businesses WHERE id = 'your-business-id';
```

### Issue: Low scores in new country

**Solution:** Test with multiple city sizes and adjust thresholds:
1. Add test cases for small/medium/large cities
2. Review POI density thresholds (may need country-specific adjustment)
3. Verify neighborhood keywords are comprehensive

### Issue: Reasons in wrong language

**Solution:** Check pattern configuration has correct `language` field and all reason strings match that language.

## Summary

The multi-country location type matching system provides:

✅ **Scalable:** Works for any city in supported countries  
✅ **Intelligent:** Pattern-based detection, not hardcoded lists  
✅ **Localized:** Country-specific keywords and language  
✅ **Maintainable:** Easy to add new countries  
✅ **Tested:** Test page validates patterns across city sizes  

**Files Modified:**
- `src/lib/location/countryPatterns.ts` (NEW)
- `src/lib/location/locationTypeMatcher.ts` (UPDATED)
- `src/pages/dashboard/LocationIntelligencePage.tsx` (UPDATED)
- `src/pages/dashboard/TestLocationTypesPage.tsx` (UPDATED)

**Ready for Production:** ✅ System tested with 4 countries (DK, SE, DE, UK)
