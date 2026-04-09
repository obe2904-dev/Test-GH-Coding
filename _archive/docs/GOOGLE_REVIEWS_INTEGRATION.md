# Google Places Reviews Integration

## Overview
Added Google Places reviews to the WHO/WHEN/WHY analysis to provide more accurate marketing insights based on real customer feedback.

## What Was Implemented

### 1. GoogleMapsService Updates
**File**: `supabase/functions/populate-location-intelligence/services/google-maps.ts`

- Added `place_id` to `GeocodeResult` interface
- Added `getPlaceReviews()` method to fetch top 5 reviews from Google Places API
- Returns: `{ text, rating, author }`

### 2. ClaudeAnalyzer Updates
**File**: `supabase/functions/populate-location-intelligence/services/claude-analyzer.ts`

- Added `review_snippets` field to `BusinessInput` interface
- Updated WHO/WHEN/WHY prompt to include customer reviews section
- Format: "**Customer Reviews (Google):**\n- 5/5: \"Review text...\""

### 3. Main Function Updates
**File**: `supabase/functions/populate-location-intelligence/index.ts`

- Fetch Google reviews after geocoding (using place_id from geocode result)
- Pass reviews to WHO/WHEN/WHY analysis
- Graceful fallback if reviews unavailable

## Data Flow

```
User clicks "🔄 Opdater data"
    ↓
Geocode business address → Get place_id
    ↓
Fetch top 5 Google reviews for place_id
    ↓
Pass to GPT-4o along with:
  - Website URL
  - Menu items
  - Price level
  - Opening hours
  - Location vibe
  - Customer reviews ← NEW
    ↓
GPT-4o generates WHO/WHEN/WHY with review insights
    ↓
Display in Location Intelligence page
```

## Example Review Format in Prompt

```
**Customer Reviews (Google):**
- 5/5: "Great brunch options! Perfect for families."
- 4/5: "Cozy atmosphere, excellent coffee."
- 5/5: "Best weekend spot in the neighborhood."
```

## Benefits

1. **Real Customer Voice**: GPT-4o now has actual customer feedback to inform WHO/WHEN/WHY analysis
2. **Better Accuracy**: Reviews reveal actual customer segments and preferences
3. **Time Patterns**: Reviews often mention when customers visit ("perfect for Sunday brunch")
4. **Positioning Insights**: Reviews highlight what makes the place unique
5. **No Extra API**: Uses existing Google Maps API integration

## Deployment Status

✅ **DEPLOYED** - Edge Function successfully deployed with reviews integration
- Version: 94.94kB (slight increase from 93.99kB)
- All error handling in place
- Graceful fallbacks if reviews unavailable

## Next Steps

1. ⏳ Apply database migration (ADD_WHO_WHEN_WHY_COLUMNS.sql)
2. ⏳ Test with real business data
3. ⏳ Verify Danish output quality with review insights
4. ⏳ Monitor GPT-4o token usage (reviews add ~500 tokens per business)

## Notes

- Fetches top 5 most recent reviews (configurable in getPlaceReviews method)
- Reviews are optional - system works without them
- Place ID comes from geocoding the business address
- No additional API calls needed beyond existing Google Maps integration
