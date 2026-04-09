# Location Analysis System - Setup Guide

## 📋 Overview

Complete location categorization system that analyzes business addresses against 9 universal area types and provides tailored content strategy recommendations.

## ✅ Implementation Status

### Completed Components

1. **Type Definitions** (`src/types/location.ts`)
   - LocationCategoryId (9 categories)
   - CategoryMatch, AnalysisSignal, LocationAnalysis, LocationProfile

2. **Category Definitions** (`src/lib/location/categories.ts`)
   - 9 complete categories with icons, definitions, CTAs (Danish)
   - Helper functions: getCategoryById(), getAllCategories()

3. **Scoring Algorithm** (`src/lib/location/scoring.ts`)
   - POI-based scoring for all 9 categories
   - Confidence levels (high/medium/low)
   - Reasoning generation and signal extraction

4. **Geocoding Service** (`src/lib/location/geocoding.ts`)
   - Address → coordinates (Google Maps Geocoding API)
   - POI analysis within 500m radius
   - Water distance estimation
   - Landmark extraction

5. **Main Analyzer** (`src/lib/location/analyzer.ts`)
   - analyzeLocation(): Full analysis pipeline
   - generateLocationProfile(): Profile generation
   - deriveContentStrategy(): Marketing intelligence per category

6. **UI Components**
   - Location Page (`src/app/setup/location/page.tsx`)
   - LocationAnalysisDisplay (`src/components/setup/LocationAnalysis.tsx`)
   - LocationCategoryCard (`src/components/setup/LocationCategoryCard.tsx`)

## 🔧 Setup Requirements

### 1. Google Maps API Configuration

**Required APIs:**
- Geocoding API
- Places API (Nearby Search)

**Enable in Google Cloud Console:**
```
https://console.cloud.google.com/apis/library
```

**Estimated Cost:**
- Geocoding: $0.005 per request
- Places Nearby Search: ~$0.017 per request × 10 = $0.17
- **Total per analysis: ~$0.18**

### 2. Environment Variables

Add to `.env.local`:
```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

### 3. Database Schema Extension

Extend `business_location_intelligence` table or Brand Profile with:

```sql
-- Option 1: Extend existing business_location_intelligence table
ALTER TABLE business_location_intelligence
ADD COLUMN primary_category VARCHAR(50),
ADD COLUMN secondary_categories TEXT[], 
ADD COLUMN category_scores JSONB,
ADD COLUMN category_analysis JSONB,
ADD COLUMN content_strategy JSONB,
ADD COLUMN analyzed_at TIMESTAMP;

-- Option 2: Create new location_profiles table
CREATE TABLE location_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id),
  address TEXT NOT NULL,
  coordinates JSONB NOT NULL,
  primary_category VARCHAR(50) NOT NULL,
  secondary_categories TEXT[],
  category_scores JSONB NOT NULL,
  content_strategy JSONB NOT NULL,
  analyzed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. API Endpoint (Recommended)

Create API route to save location profiles:

**`src/app/api/business/location/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { locationProfile } = await req.json();
    const supabase = await createClient();
    
    // Get current user's business
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (!business) return NextResponse.json({ error: 'No business found' }, { status: 404 });
    
    // Save location profile
    const { error } = await supabase
      .from('location_profiles')
      .upsert({
        business_id: business.id,
        ...locationProfile
      });
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving location profile:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
```

## 📊 The 9 Universal Categories

| Category | Icon | Primary Characteristics | Competition Level |
|----------|------|------------------------|-------------------|
| **City Centre** | 🏛️ | High foot traffic, evening/night demand | High |
| **Residential** | 🏘️ | Families, local regulars, loyalty-focused | Medium |
| **Tourist** | 📸 | Seasonal spikes, walk-ins, landmarks | High |
| **Office** | 🏢 | Lunch peak (11:30-13:30), speed matters | Medium |
| **Transport Hub** | 🚉 | Grab-and-go, morning/afternoon spikes | High |
| **Student** | 🎓 | Price-sensitive, group behavior | Medium |
| **Waterfront** | 🌊 | Weather-dependent, summer-heavy | Medium |
| **Shopping District** | 🛍️ | Daytime shoppers, break mentality | High |
| **Mixed Use** | 🏙️ | Diverse audiences, flexible positioning | Medium |

## 🚀 Usage

### Basic Flow

```typescript
import { analyzeLocation, generateLocationProfile } from '@/lib/location/analyzer';

// 1. Analyze address
const analysis = await analyzeLocation('Nyhavn 17, 1051 København K');

// 2. Generate profile
const profile = generateLocationProfile(analysis);

// 3. Access results
console.log('Primary category:', analysis.primaryCategory);
console.log('Score:', analysis.matches[0].score);
console.log('CTAs:', profile.contentStrategy.recommendedCTAs);
```

### Integration Points

**With WHO/WHEN/WHY:**
- Use `profile.contentStrategy.targetAudience` to inform WHO segments
- Use `profile.contentStrategy.peakDemandTimes` for WHEN patterns
- Use category-specific positioning angles for WHY content

**With Content Generation:**
- Inject `profile.contentStrategy.recommendedCTAs` into post templates
- Use `profile.primaryCategory` to adjust tone/style
- Apply seasonal notes for timing content

**With Brand Profile:**
```typescript
// Store in brand profile
brandProfile.location = {
  address: profile.address,
  primaryCategory: profile.primaryCategory,
  secondaryCategories: profile.secondaryCategories,
  contentStrategy: profile.contentStrategy
};
```

## 🔄 Next Steps

1. **Create database migration** for location_profiles table
2. **Implement API endpoint** at `/api/business/location`
3. **Add navigation** to location page in setup flow
4. **Test with real addresses** to validate scoring algorithm
5. **Integrate with existing Brand Profile** system
6. **Add to onboarding flow** after basic business info

## 📝 Notes

- **Privacy**: All location data stays in your database
- **Caching**: Consider caching analysis results for 90 days
- **Fallback**: System gracefully handles API failures
- **Extensibility**: Easy to add new categories or scoring rules
- **Testing**: Use mock POI data for development/testing

## 🐛 Troubleshooting

**"Address not found" error:**
- Check API key is valid
- Verify Geocoding API is enabled
- Try more specific address format

**Low confidence scores:**
- May indicate truly mixed-use area
- Check POI data quality in Google Maps
- Consider manual category override option

**API rate limits:**
- Google Maps: 50 requests/second default
- Implement request throttling if needed
- Consider batch analysis for multiple locations
