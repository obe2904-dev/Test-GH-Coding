# Quick Suggestions V2 - Implementation Plan

## Core Philosophy
**Constraints + Context + Creativity**
- Hard constraints: Pre-filter (code enforces)
- Rich context: Pass facts (AI receives)
- Simple task: Trust reasoning (AI decides)

## Architecture

### 1. HARD CONSTRAINTS (Pre-Processing)
**Enforced BEFORE AI sees data:**

#### A. Time Boundaries
```javascript
- Get business local time (from timezone)
- Calculate hours until last kitchen close
- Determine max ideas:
  * 6+ hours → max 3 ideas
  * 3-6 hours → max 2 ideas
  * 1-3 hours → max 1 idea
  * <1 hour → REFUSE (direct to Skriv Selv)
```

#### B. Menu Filtering (3-Tier System)
```javascript
// Build recency map from published_posts + daily_suggestions
recencyMap: Map<dishName, daysAgo>

// Tier 1: Exclude dishes used in last 7 days
if (dishes_remaining >= 2) → use Tier 1

// Tier 2: Exclude dishes used in last 3 days  
else if (dishes_remaining >= 2) → use Tier 2

// Tier 3: Show all WITH recency ranking
else → show all, tell AI to pick oldest
```

#### C. Language Filtering
```javascript
// Only use menus in business's primary language
// Danish business → only Danish menus (not tourist menus)
menuLanguage = business.country → 'da'
```

### 2. RICH CONTEXT (Data Collection)

#### A. Business Information
```sql
SELECT 
  name,
  vertical,
  country,
  timezone,
  has_outdoor_seating,
  outdoor_type
FROM businesses
WHERE id = businessId
```

#### B. Service Periods (Today Only)
```sql
SELECT 
  programme_name,
  audience_segments,
  start_time,
  end_time,
  active_days
FROM business_programme_profiles
WHERE business_id = businessId
  AND active_days CONTAINS today
```

#### C. Menu Items (Pre-filtered)
```sql
-- Option 1: menu_signal (signature items)
SELECT menu_signal->signatureItems
FROM business_profile
WHERE business_id = businessId

-- Option 2: menu_results_v2 (full menu - paid tier)
SELECT structured_data
FROM menu_results_v2  
WHERE business_id = businessId
  AND language_code = business_language
  AND status = 'done'
```

#### D. Recent History (14 days)
```sql
-- Published posts
SELECT menu_item_name, posted_at
FROM published_posts
WHERE business_id = businessId
  AND posted_at >= NOW() - INTERVAL '14 days'

-- Suggested (not necessarily posted)
SELECT menu_item_name, created_at
FROM daily_suggestions
WHERE business_id = businessId
  AND created_at >= NOW() - INTERVAL '14 days'
```

#### E. Weather (Today Only)
```javascript
// Fetch hourly forecast from NOW to close of business
// Time range: localTime → lastKitchenClose
// Data needed: temp, conditions, wind_speed, precipitation

weatherAPI.getHourlyForecast({
  location: business.city,
  startTime: now,
  endTime: lastKitchenClose
})
```

### 3. WEATHER EVALUATION

#### If has_outdoor_seating = TRUE
```javascript
// Evaluate outdoor suitability for each time block
function evaluateOutdoor(hour) {
  // Tier 1 (Perfect): 20°C+, sunny, wind <15 km/h
  // Tier 2 (Good): 15-19°C sunny OR 22°C+ partly cloudy
  // Tier 3 (Acceptable): 15-18°C partly cloudy + heaters
  // Tier 4 (Indoor): <15°C OR rain OR wind >25 km/h
  
  return { rating, recommendation }
}

// Group consecutive hours with similar ratings
timeBlocks = groupByConditions(hourlyWeather)
// Result: "Afternoon 14:00-17:00: Perfect outdoor (20°C, sunny)"
```

#### If has_outdoor_seating = FALSE
```javascript
// Evaluate weather for indoor contrast messaging
function evaluateIndoorContrast(weather) {
  if (cold OR rainy) → "Warm refuge from bad weather"
  if (hot > 25°C) → "Cool escape from heat"
  if (nice) → "Experience focus (minimal weather mention)"
  
  return { contrastStrategy, messaging }
}
```

### 4. AI PROMPT STRUCTURE

```
CONTEXT (Facts):
- Current time: {day} {time} (local)
- Business: {type}, {cuisine}
- Today's service: {periods with times}
- Hours until close: {hours}
- Weather: {conditions by time block}
- Outdoor: {status or N/A}

CONSTRAINTS (Physics):
- Time limit: All posts must be before {lastKitchenClose}
- Quantity: Suggest UP TO {maxIdeas} ideas
- Menu: Only dishes listed below (no inventions)

MENU ({programme}):
{list of filtered dishes}
{if Tier 3: "NOTE: All recently used - pick oldest items"}

TASK:
Pick {1 to maxIdeas} menu items with strategic timing for TODAY.

For each suggestion provide:
1. menu_item_name (exact from menu)
2. post_time (HH:MM format)
3. why (why this item + timing + context makes sense)

Use your judgment:
- Consider business type, cuisine, and service flow
- Consider time remaining and service priorities
- Use weather/outdoor context if it enhances the idea
- Don't force patterns - suggest what actually makes sense

Quality over quantity. {maxIdeas} is a maximum, not a requirement.
```

### 5. VALIDATION & OUTPUT

#### Post-AI Validation
```javascript
// Check AI didn't invent dishes
const menuSet = new Set(menu.map(i => i.name.toLowerCase()))
suggestions.forEach(s => {
  if (!menuSet.has(s.menu_item_name.toLowerCase())) {
    console.warn('AI invented dish:', s.menu_item_name)
  }
})

// Validate time format
suggestions.forEach(s => {
  if (!/^\d{2}:\d{2}$/.test(s.post_time)) {
    s.post_time = getDefaultTime()
  }
})

// Ensure times are in future and before close
// Deduplicate dishes
```

#### Response Format
```json
{
  "suggestions": [
    {
      "menu_item_name": "Aperol Spritz",
      "post_time": "16:00",
      "why": "Friday afternoon...",
      "goal": "Drive dinner bookings",
      "service_period": "Dinner"
    }
  ],
  "cached": false,
  "metadata": {
    "time_generated": "14:00",
    "hours_remaining": 7.5,
    "max_ideas_allowed": 2,
    "tier_used": "Tier 1 (7d)",
    "weather_context": "Perfect outdoor afternoon"
  }
}
```

### 6. ERROR HANDLING

```javascript
// After closing time
if (hoursRemaining <= 0) {
  return {
    error: "outside_service_hours",
    message: "All services closed for today. Try 'Skriv Selv' for custom posts.",
    next_service: "Tomorrow 10:00 (Brunch)"
  }
}

// No menu items
if (menu.length === 0) {
  return {
    error: "no_menu_items",
    message: "No menu configured. Please add menu items first."
  }
}

// No active service periods
if (activeServicePeriods.length === 0) {
  return {
    error: "no_service_today",
    message: "No service periods configured for today."
  }
}
```

## Testing Plan

### Test Scenario 1: Early Morning (Full Day)
```
Input: Friday 10:00, Italian restaurant
Expected: 3 ideas (brunch/lunch/dinner)
```

### Test Scenario 2: Mid-Service (Limited Time)
```
Input: Friday 19:00, closes 21:30
Expected: 1-2 ideas max (immediate focus)
```

### Test Scenario 3: After Closing
```
Input: Friday 23:00
Expected: Error + redirect to Skriv Selv
```

### Test Scenario 4: Sunny + Outdoor
```
Input: Saturday 12:00, 20°C sunny, has terrace
Expected: Outdoor angles in suggestions
```

### Test Scenario 5: Rainy + No Outdoor
```
Input: Monday 14:00, 10°C rainy, no outdoor
Expected: Warm refuge / cozy indoor messaging
```

### Test Scenario 6: All Dishes Recently Used (Tier 3)
```
Input: 5 dishes, all posted in last 3 days
Expected: Show all + AI picks oldest
```

### Test Scenario 7: Language Filter
```
Input: Danish business with both Danish + English menus
Expected: Only Danish menu items shown
```

## Success Metrics

✅ No invented dishes (all from menu)
✅ No recently posted dishes (unless Tier 3)
✅ Timing makes strategic sense
✅ Weather used intelligently (when relevant)
✅ Quantity adapts to time remaining
✅ Refuses after closing hours
✅ Single AI call (no multi-step coordination)
✅ Response time <5 seconds
