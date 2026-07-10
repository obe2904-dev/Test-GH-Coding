# Weather in AI Ideas - Current Implementation

## 1. Weather Display in UI (Top Frame)

**Location:** `src/components/post-creation/AiSuggestionsCard.tsx` lines 705-741

**Current Display:**
```tsx
{weatherForecast && (
  <div className="...sky-50 border-sky-200...">
    <p>Vejret i {weatherForecast.city}</p>
    
    {weatherForecast.summary ? (
      <p>{weatherForecast.summary}</p>  // Example: "18°C → 22°C • Let skyet • Vind 3-5 m/s"
    ) : (
      <p>{weatherForecast.temperature} · {weatherForecast.conditions}</p>
    )}
    
    {weatherForecast.rainRisk && (
      <p>💧 {weatherForecast.rainRisk}</p>  // Example: "Regn fra kl. 15 (60%)"
    )}
    
    {weatherForecast.outdoor && (
      <p>☀️ {weatherForecast.outdoor}</p>  // Example: "Perfekt til udeservering (22°C)"
    )}
    
    <p>{weatherForecast.until}</p>  // Currently: "Gælder til kl. 23:59"
  </div>
)}
```

**Weather Forecast Structure:**
```typescript
interface WeatherForecast {
  city: string                    // "Kolding"
  until: string                   // "Gælder til kl. 23:59"
  summary?: string                // "18°C → 22°C • Let skyet • Vind 3-5 m/s • Regn fra kl. 15 (60%)"
  temperature: string             // "18°C" or "18°C → 22°C"
  conditions: string              // "sunny" | "partly_cloudy" | "cloudy" | "rain" | "snow" | "fog"
  rainRisk?: string              // "Regn fra kl. 15 (60%)" or "Risiko for regn efter kl. 18"
  outdoor?: string               // "Perfekt til udeservering (22°C)" or "Udeservering mulig omkring kl. 15"
  windRange: string              // "3-5 m/s"
}
```

### 🔧 ENHANCEMENT NEEDED:
**Change "until" from 23:59 to actual closing time:**
- Read `opening_hours` from `profiles` table (JSON field)
- Parse today's closing time
- If no opening_hours, fallback to 23:59
- Update display: "Gælder til lukketid (kl. 22:00)"

---

## 2. Weather Data Source (Open-Meteo API)

**Location:** `supabase/functions/get-quick-suggestions/index.ts` lines 540-694

**API Call:**
```typescript
async function fetchHourlyWeatherUntilEOD(
  lat: number,
  lon: number,
  city: string,
  hasOutdoorSeating: boolean,
  clientNow: Date
)
```

**Fetches from:** `https://api.open-meteo.com/v1/forecast`

**Parameters:**
- `latitude` & `longitude` - From business_locations table
- `hourly` metrics:
  - `temperature_2m` - Temperature at 2 meters
  - `precipitation_probability` - Rain chance (%)
  - `weathercode` - WMO weather codes (0-99)
  - `cloudcover` - Cloud coverage (%)
  - `windspeed_10m` - Wind speed at 10 meters
- `timezone=Europe/Copenhagen` - Denmark timezone (handles UTC+1/+2 automatically)
- `forecast_days=1` - Today only

**Processing:**
1. Gets all remaining hours until 23:59
2. Calculates temp range (current → max)
3. Finds dominant weather condition (most frequent WMO code)
4. Detects rain risk (precipProb > 30%)
5. Assesses outdoor suitability (if `hasOutdoorSeating = true`)

---

## 3. Outdoor Seating Assessment (Scoring System)

**Location:** `supabase/functions/_shared/post-helpers/strategy/weather-comfort-tiers.ts`

### 📊 Scoring System (0-100 points)

**Weighted Components:**
1. **Feels-like Temperature** (50 points max) - Most important
2. **Cloud Cover** (20 points max)
3. **Wind Speed** (20 points max)
4. **Rain Probability** (10 points max)

### Temperature Scoring (50 points)
```
Perfect (50 pts):   25-28°C feels-like
Excellent (45 pts): 21-24°C
Good (35 pts):      18-20°C
Acceptable (20 pts): 16-17°C
Marginal (10 pts):  14-15°C
Hot (40 pts):       28-32°C (needs shade)
Too hot (15 pts):   >32°C (needs misters/shade)
```

### Cloud Cover Scoring (20 points)
```
Clear (20 pts):      ≤20% clouds
Scattered (15 pts):  21-40% clouds (ideal for preventing too hot)
Moderate (8 pts):    41-60% clouds
Heavy (3 pts):       61-80% clouds
Overcast (0 pts):    >80% clouds
```

### Wind Speed Scoring (20 points)
```
Calm (20 pts):       ≤3 m/s
Light breeze (15 pts): 3-5 m/s
Moderate (8 pts):    5-7 m/s (napkins fly)
Fresh (3 pts):       7-9 m/s
Strong (0 pts):      >9 m/s
```

### Rain Probability Scoring (10 points)
```
Negligible (10 pts): ≤10%
Slight (8 pts):      11-20%
Moderate (5 pts):    21-40%
Likely (2 pts):      41-60%
High (0 pts):        >60%
```

### 🚫 Hard Blockers (Instant "Unviable" = 0 points)
1. Feels-like temp <13°C
2. Active rain (WMO rain/snow + precip prob >70%)
3. Wind >9.8 m/s

### 🏆 Comfort Tiers
```
PREMIUM (85-100 pts):  🥇 "Peak Patio Weather"
  → Lead with outdoor dining, terrace beauty shots, "perfect weather"

VIABLE (65-84 pts):    ✅ "Good for Outdoor"
  → Mention outdoor seating availability, show terrace

MARGINAL (40-64 pts):  ⚠️ "Indoor Preferred"
  → Focus on indoor, mention outdoor as option

UNVIABLE (0-39 pts):   ❌ "Indoor Only"
  → Promote indoor comfort, DO NOT mention outdoor seating
```

---

## 4. Outdoor Suitability in Quick Suggestions

**Location:** `supabase/functions/get-quick-suggestions/index.ts` lines 645-663

**Criteria for "Good Outdoor Hours":**
```typescript
const goodHours = remainingHours.filter(h => 
  h.temp >= 15 &&          // At least 15°C
  h.precipProb < 30 &&     // Less than 30% rain chance
  h.wind <= 5 &&           // Max 5 m/s wind
  h.clouds < 75            // Less than 75% cloud cover
)
```

**Display Logic:**
```typescript
if (goodHours.length === remainingHours.length) {
  outdoorNote = `Perfekt til udeservering (${bestTemp}°C)`
} 
else if (goodHours.length >= 3) {
  outdoorNote = `Udeservering: Bedst kl. ${startHour}-${endHour} (${bestTemp}°C)`
} 
else if (goodHours.length > 0) {
  outdoorNote = `Udeservering mulig omkring kl. ${startHour}`
}
```

**Example Outputs:**
- "Perfekt til udeservering (22°C)"
- "Udeservering: Bedst kl. 12-18 (24°C)"
- "Udeservering mulig omkring kl. 15"
- *(No outdoor note if no good hours)*

---

## 5. Weather Usage in AI Idea Generation

**Location:** `supabase/functions/get-quick-suggestions/prompt-builder.ts` lines 110-126

### Weather Tier Logic in Prompt
```typescript
const weatherTier = weather.tier || ''  // 'premium' | 'viable' | 'marginal' | 'unviable'

const shouldMentionWeather = weatherTier
  ? weatherTier === 'premium' || weatherTier === 'viable'
  : temp >= 18 && !conditions.includes('regn')

if (shouldMentionWeather) {
  prompt += `og vejret er godt (${weather.temperature}, ${weather.conditions})`
} 
else if (weatherTier === 'unviable') {
  prompt += `og vejret kalder på indehygge (${weather.temperature}, ${weather.conditions})`
}
```

### Context Passed to AI:
**For Premium/Viable Weather:**
- "I dag er det torsdag og vejret er godt (22°C, let skyet)"
- AI will naturally mention outdoor seating, terrace, sunshine in suggestions

**For Unviable Weather:**
- "I dag er det torsdag og vejret kalder på indehygge (8°C, regn)"
- AI will focus on cozy indoor atmosphere, comfort food

**For Marginal Weather:**
- No weather mention in prompt
- AI generates neutral suggestions

### What AI Receives:
```typescript
interface PromptContext {
  dayContext: string           // "I dag er det torsdag og vejret er godt (22°C, let skyet)"
  businessName: string         // "Restaurant Valdemar"
  placeType: string           // "restaurant"
  hasOutdoorSeating: boolean  // true/false
  topMenuItems: MenuItem[]    // Top 5 items by quality score
  recentlyUsed: string[]      // Recent post content to avoid repeats
  timing: {
    currentTime: string       // "15:30"
    slots: TimeSlot[]         // Available posting slots
  }
  userContext?: string        // Optional user-provided context
}
```

---

## 6. How hasOutdoorSeating Flag Works

**Database Field:** `business_locations.enrichment` (JSON field)
```json
{
  "has_outdoor_seating": true
}
```

**Usage Flow:**
1. **Weather Fetch** - If `hasOutdoorSeating = true`, calculate outdoor suitability
2. **Scoring** - Use 0-100 point system to assess comfort
3. **Prompt** - Include weather tier (premium/viable/marginal/unviable)
4. **AI Generation** - AI naturally adjusts suggestions based on context:
   - Premium weather → "Nyd vores 3-retters menu på terrassen i det skønne vejr"
   - Unviable weather → "Find indehygge hos os mens regnen falder udenfor"

**No Flag = No Outdoor Assessment:**
- Weather still fetched (temp, conditions, rain)
- No outdoor comfort scoring
- No "Perfekt til udeservering" message
- AI doesn't mention outdoor seating

---

## 7. WMO Weather Code Mapping

**Location:** `supabase/functions/get-quick-suggestions/index.ts` lines 520-537

```typescript
0-1:   Sunny           (clear/few clouds)
2:     Partly cloudy   (scattered clouds)
3:     Cloudy          (overcast)
45-48: Fog
51-57: Drizzle
61-67: Rain
71-77: Snow
80-82: Rain showers
85-86: Snow showers
95-99: Thunderstorm
```

**Danish Labels:**
- Sunny: "Sol"
- Partly cloudy: "Let skyet"
- Cloudy: "Skyet"
- Rain: "Regn"
- Snow: "Sne"
- Fog: "Tåge"

---

## 🎯 Summary: Weather's Role in AI Ideas

### ✅ Currently Working:
1. **Real-time hourly weather** from Open-Meteo API
2. **Outdoor comfort scoring** (0-100 points) when `hasOutdoorSeating = true`
3. **Visual weather display** in top frame with:
   - Temperature range (current → max)
   - Conditions (sunny, cloudy, etc.)
   - Rain risk alerts
   - Outdoor suitability messages
4. **Context-aware AI prompts**:
   - "vejret er godt" for premium/viable weather
   - "vejret kalder på indehygge" for unviable weather
5. **Smart outdoor messaging**:
   - "Perfekt til udeservering" when all hours are good
   - "Udeservering: Bedst kl. X-Y" when some hours are good
   - No outdoor mention when weather is bad

### 🔧 Enhancement Needed:
1. **Change "Gælder til kl. 23:59" to actual closing time**
   - Read `opening_hours` from profiles table
   - Parse today's closing time from JSON
   - Display: "Gælder til lukketid (kl. 22:00)"
   - Fallback to 23:59 if no opening hours set

### 📊 Outdoor Scoring Example:
**Perfect Summer Day:**
- Temp: 24°C (45 pts)
- Clouds: 20% (20 pts)
- Wind: 3 m/s (20 pts)
- Rain: 5% (10 pts)
- **Total: 95 points = PREMIUM** 🥇

**Marginal Spring Day:**
- Temp: 16°C (20 pts)
- Clouds: 60% (8 pts)
- Wind: 6 m/s (8 pts)
- Rain: 25% (5 pts)
- **Total: 41 points = MARGINAL** ⚠️

**Unviable Winter Day:**
- Temp: 8°C → **BLOCKER** (feels too cold)
- **Total: 0 points = UNVIABLE** ❌
