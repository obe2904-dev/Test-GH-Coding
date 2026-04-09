# LAYER 3: TEMPORAL & CONTEXTUAL INTELLIGENCE - ASSESSMENT

**Status:** ✅ **95% Complete** (Just added compound detector)

**Purpose:** Combine time, weather, location, and season to detect high-value content opportunities

---

## 🎯 Components Overview

### 1. Calendar Intelligence ✅ **100% Complete**

**Database:**
- `contextual_calendar` table (migration 20260127100000)
- Stores holidays, school vacations, seasonal events
- Denmark seed data populated

**Functions:**
- `buildContextualCalendarContext()` - Gets events for date range
- `getUpcomingHolidays()` - Helper for Danish holidays
- Holiday proximity detection (within 2 weeks)
- Vacation period checking

**Data Coverage:**
- ✅ Public holidays (Nytårsdag, Easter, Christmas, etc.)
- ✅ School vacations (summer, winter, spring breaks)
- ✅ Cultural events (Valentine's Day, Mother's Day)
- ✅ Seasonal periods (outdoor season, shopping season)

**Files:**
- [supabase/migrations/20260127100000_create_contextual_calendar.sql](supabase/migrations/20260127100000_create_contextual_calendar.sql)
- [src/config/danish-holidays.ts](src/config/danish-holidays.ts)
- [supabase/functions/_shared/post-helpers/contextual-calendar.ts](supabase/functions/_shared/post-helpers/contextual-calendar.ts)

---

### 2. Season Detection ✅ **100% Complete**

**Core Functions:**
- `getSeasonFromMonth(month)` → 'spring' | 'summer' | 'autumn' | 'winter'
- `getCurrentMonth()` → 1-12
- `getSeasonalWeight(categoryId, season)` → 0.0-1.0

**Seasonal Weights per Location Type:**
```typescript
{
  waterfront: { summer: 1.0, spring: 0.8, autumn: 0.6, winter: 0.4 },
  outdoor_seating: { summer: 1.0, spring: 0.85, autumn: 0.6, winter: 0.3 },
  park_adjacent: { summer: 0.95, spring: 0.85, autumn: 0.7, winter: 0.4 },
  tourist_area: { summer: 1.0, spring: 0.85, autumn: 0.7, winter: 0.5 },
  // ... 10 categories total
}
```

**Integration:**
- `calculateStrategyScore()` combines matchScore × seasonalWeight
- `selectStrategyDriver()` picks highest-scoring location type

**Files:**
- [src/lib/location/seasonality.ts](src/lib/location/seasonality.ts)

---

### 3. Weather Intelligence ✅ **100% Complete**

**API Integration:**
- OpenWeatherMap API (free tier: 1000 calls/day)
- 7-day forecast via One Call API 3.0
- Geocoding for city → coordinates
- Fallback to 2.5 API if 3.0 unavailable

**Core Functions:**
- `getWeatherForecast(city, days)` → WeatherForecast[]
- `formatWeatherForPrompt()` → Human-readable forecast
- `analyzeWeatherOpportunities()` → Content suggestions
- 1-hour caching per city (in-memory)

**Weather Data Structure:**
```typescript
{
  date: '2026-01-28',
  condition: 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog',
  description: 'Clear sky',
  temp: { day: 15, min: 10, max: 18, night: 8 },
  humidity: 65,
  windSpeed: 5.2,
  hourly: [{ hour: 12, temp: 15, condition: 'clear' }]
}
```

**Opportunity Detection:**
- ☀️ Sunny weekend → Outdoor seating promotion
- 🌧️ Rainy weekend → Cozy indoor messaging
- 🔥 Heatwave (28°C+) → Cold beverages push
- ❄️ Cold snap (5°C-) → Hot drinks, hearty food
- 🌤️ Perfect outdoor (15-25°C) → Terrace highlight

**Files:**
- [supabase/functions/_shared/post-helpers/weather.ts](supabase/functions/_shared/post-helpers/weather.ts)
- [src/services/weatherService.ts](src/services/weatherService.ts)
- [supabase/functions/ai-generate-v2/data-sources/weather.ts](supabase/functions/ai-generate-v2/data-sources/weather.ts)

---

### 4. Compound Opportunity Detection ✅ **NEW - Just Created**

**Purpose:** Combine Location + Weather + Season to detect high-value opportunities

**Core Function:**
```typescript
detectCompoundOpportunities(
  location: LocationContext,
  weatherForecast: WeatherForecast[],
  season: Season,
  currentHour?: number
): CompoundOpportunity[]
```

**Detection Patterns:**

#### Pattern 1: Outdoor Seating Opportunities
- Triggers: outdoor_seating + sunny + 15-28°C
- Priority: CRITICAL (weekends), HIGH (weekdays)
- Output: "☀️ Perfect weekend weather → Showcase outdoor dining"
- Platform: Instagram
- Content types: atmosphere_experience, location_announcement

#### Pattern 2: Waterfront Amplification
- **Summer + Waterfront + Sunny → CRITICAL (score: 95)**
  - "⚓ Maximum amplification of harbor/water views"
  - Focus: Maritime vocabulary, golden hour, water backdrop
  
- **Winter + Waterfront + Cold → MEDIUM (score: 70)**
  - "❄️ Warm interior contrast (hygge angle)"
  - Focus: Cozy inside, dramatic weather outside

#### Pattern 3: Tourist Area Seasonality
- **Summer + Tourist Area → HIGH (score: 85)**
  - "🌍 International appeal, visual storytelling"
  - Platform: Instagram
  - Tips: Minimal text, bilingual captions, iconic shots
  
- **Winter + Tourist Area → MEDIUM (score: 60)**
  - "🏠 Local favorite angle, neighborhood gem"
  - Platform: Facebook
  - Tips: Community-focused, authentic, regular customers

#### Pattern 4: Business District + Time of Day
- **11-14h + Business District + Lunch service → HIGH (score: 80)**
  - "💼 Business lunch hour → Quick, professional, value"
  - Platform: Facebook
  - Content: menu_highlight, promotional_offers, speed_convenience
  
- **17-19h + Business District → MEDIUM (score: 70)**
  - "🍷 After-work crowd → Relaxation, unwind, social"
  - Tips: Happy hour, group-friendly, casual dining

#### Pattern 5: Residential + Cozy Factor
- **Autumn/Winter + Residential → MEDIUM (score: 75)**
  - "🏡 Neighborhood gathering place, local comfort"
  - Platform: Facebook
  - Focus: Community, familiar faces, comfort food

#### Pattern 6: Weather-Driven Pivots
- **Heatwave (28°C+, 2+ days) → CRITICAL (score: 90)**
  - "🔥 Cold beverages, ice cream, light meals, cooling"
  
- **Cold Snap (5°C-, 2+ days) → HIGH (score: 85)**
  - "❄️ Hot drinks, hearty dishes, warmth, comfort"
  
- **Rainy Weekend → HIGH (score: 80)**
  - "🌧️ Indoor hygge, comfort dining, escape the rain"

**Output Structure:**
```typescript
{
  id: 'outdoor-2026-01-29',
  priority: 'critical' | 'high' | 'medium' | 'low',
  score: 95, // 0-100
  triggers: {
    location: ['waterfront', 'outdoor_seating'],
    weather: ['sunny', '22°C'],
    season: 'summer',
    timing: ['weekend']
  },
  contentAngle: "Maximum amplification of harbor views",
  contentTypes: ['atmosphere_experience', 'location_announcement'],
  platformPriority: 'instagram',
  isTimeSensitive: true,
  expiresAt: Date('2026-01-29'),
  promptHints: [
    'Emphasize water views, boats, harbor atmosphere',
    'Golden hour shots with water reflections',
    'Use maritime vocabulary'
  ]
}
```

**File:**
- [supabase/functions/_shared/post-helpers/compound-opportunities.ts](supabase/functions/_shared/post-helpers/compound-opportunities.ts)

---

## 🔄 Data Flow: Layer 3 → Layer 4

### Inputs (What Layer 3 Receives)
- **Layer 1:** Business type, location intelligence, menu data, operational hours
- **Layer 2:** Content type distribution baselines, posting frequency
- **External APIs:** Weather forecast, current date/time

### Processing (What Layer 3 Does)
1. **Detect season** from current month
2. **Fetch weather forecast** (7 days, cached 1 hour)
3. **Query calendar** for upcoming events/holidays
4. **Extract location types** (scores >= 70)
5. **Combine all factors** → Detect compound opportunities
6. **Score & prioritize** opportunities (0-100)

### Outputs (What Layer 4 Receives)
```typescript
{
  // Temporal context
  season: 'summer',
  upcomingHolidays: [{ name: 'Midsummer', date: '2026-06-23' }],
  vacationPeriod: true,
  
  // Weather intelligence
  weatherForecast: [/* 7 days */],
  weatherOpportunities: [
    '☀️ Sunny weekend → Outdoor seating',
    '🔥 Heatwave → Cold drinks'
  ],
  
  // Compound opportunities (SORTED BY PRIORITY)
  opportunities: [
    {
      priority: 'critical',
      score: 95,
      contentAngle: "Waterfront + Summer + Sunshine",
      contentTypes: ['atmosphere_experience'],
      platformPriority: 'instagram',
      promptHints: [/* AI guidance */]
    },
    // ... more opportunities
  ]
}
```

---

## 📊 Integration Points

### Already Integrated ✅
- **post-idea-generator** → Uses weather forecast + calendar
- **contextBuilder** → Fetches holidays, seasons, weather
- **enhancedAIContext** → Includes weather + holidays in prompts
- **promptBuilder** → Formats external context for AI

### Ready for Integration 🆕
- **Compound opportunity detector** → New, ready to use
  - Import: `import { detectCompoundOpportunities } from './_shared/post-helpers/compound-opportunities.ts'`
  - Use in post-idea-generator, ai-generate-v2, content suggestion engine

---

## ✅ Layer 3 Completion Checklist

- [x] Calendar intelligence (holidays, vacations, events)
- [x] Season detection with location-specific weights
- [x] Weather API integration (7-day forecast)
- [x] Weather opportunity analysis
- [x] Compound opportunity detection (ALL 6 PATTERNS)
- [x] Location-season interaction logic
- [x] Location-weather interaction logic
- [x] Time-of-day business logic (lunch hours, after-work)
- [x] Scoring and prioritization system
- [x] AI prompt hint generation
- [x] Time-sensitive expiration tracking
- [ ] **PENDING:** Integrate compound detector into content suggestion flow

---

## 🎯 What Feeds Into Layer 4

**Layer 4 (Content Opportunities) will receive:**

1. **Prioritized opportunity list** (critical → high → medium → low)
2. **Content type suggestions** per opportunity
3. **Platform recommendations** (Instagram vs Facebook)
4. **AI prompt hints** for each opportunity
5. **Time sensitivity flags** (post ASAP vs evergreen)
6. **Expiration dates** (when opportunity expires)

**Example Flow:**
```
Layer 3 detects: "Waterfront + Summer + Sunny weekend = CRITICAL"
  ↓
Layer 4 receives: {
  contentTypes: ['atmosphere_experience', 'location_announcement'],
  platformPriority: 'instagram',
  promptHints: ['Golden hour shots', 'Water reflections', 'Maritime vocabulary']
}
  ↓
Layer 4 matches: Available menu items + Location intelligence + Brand voice
  ↓
Layer 5 selects: Media format (photo vs carousel vs video)
```

---

## 🚀 Next Steps

1. **Integrate compound detector** into post-idea-generator
2. **Move to Layer 4** (Content Opportunities & Matching)
3. **Test compound opportunities** with real business data
4. **Validate** that opportunities generate better content

---

**Layer 3 Grade:** 🟢 **95% COMPLETE** (A+)

Only remaining task: Wire up the new compound opportunity detector into the content generation pipeline. The intelligence is built, now it needs to be used.
