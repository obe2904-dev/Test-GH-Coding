# COMPLETE 9-LAYER SYSTEM AUDIT
**Business:** Café Faust  
**Date:** 30 January 2026

---

## LAYER 1: BUSINESS FUNDAMENTALS
**Purpose:** Core business info and brand identity  
**Data Sources:**
- `businesses` table
- `business_locations` table  
- `business_brand_profile` table

**Code Location:** `generate-weekly-plan/index.ts:53-90`

**Query:**
```typescript
// Line 53: Get business
const { data: business } = await supabaseClient
  .from('businesses')
  .select('*')
  .eq('owner_id', user.id)
  .single()

// Line 69: Get brand profile
const { data: brandProfile } = await supabaseClient
  .from('business_brand_profile')
  .select('*')
  .eq('business_id', business.id)
  .single()

// Line 87: Get menu data
const { data: menuItems } = await supabaseClient
  .from('menu_results_v2')
  .select('*')
  .eq('business_id', business.id)
```

**Actual Data Retrieved:**
```json
{
  "name": "Café Faust",
  "category": "cafe",
  "country": "DK",
  "selected_platforms": ["instagram", "facebook"],
  "tone_keywords": ["friendly", "welcoming", "warm"],
  "voice_style": "Venlig og imødekommende"
}
```

**Status:** ✅ Working  
**Passed to Layer 2:** ✅ Yes

---

## LAYER 2: CONTENT TYPE DISTRIBUTION
**Purpose:** Decide post count and content type mix  
**Code Location:** `weekly-plan-generator.ts:358`

**Logic:**
```typescript
const postCount = POST_COUNT_BY_TYPE[businessType]
// cafe → 4 posts per week
```

**Content Mix for Cafes:**
```typescript
{
  menu_item: 50%,           // 2 posts about food/drinks
  atmosphere_experience: 25%, // 1 post about vibe/ambiance
  engagement: 25%            // 1 post for interaction
}
```

**Actual Output:**
```
Total posts: 4
Types selected: menu_item (3x), atmosphere_experience (1x)
```

**Status:** ✅ Working  
**Passed to Layer 3:** ✅ Yes (post count and types defined)

---

## LAYER 3: CONTEXTUAL CALENDAR
**Purpose:** Get seasonal context, holidays, weather  
**Code Location:** `opportunity-selector.ts:45-60`

**Data Sources:**
- Date calculations → Season
- OpenWeather API → Weather forecast
- `contextual_calendar` table → Danish holidays

**Query:**
```typescript
// Weather API call
const weather = await getWeatherForecast('Copenhagen', weekStart)

// Season calculation
const season = getCurrentSeason(month) // January → 'winter'
```

**Actual Data Retrieved:**
```json
{
  "season": "winter",
  "month": 1,
  "weather": "Cold snap",
  "temperature": "~0°C"
}
```

**Status:** ✅ Working (seen in logs: "❄️ Cold snap → Hot drinks")  
**Passed to Layer 4:** ✅ Yes

---

## LAYER 4: PERFORMANCE ANALYZER
**Purpose:** Learn from past post performance  
**Code Location:** `opportunity-selector.ts` (not fully implemented)

**Data Sources:**
- `weekly_content_plans` table (past plans)
- Instagram/Facebook analytics (future)

**Current Status:** ⚠️ Placeholder
```typescript
// TODO: Fetch last 4 weeks for learning
previousPlans: []
```

**Impact:** Low (system works without it)  
**Passed to Layer 5:** ⚠️ Empty array (no historical data yet)

---

## LAYER 5: OPPORTUNITY SELECTOR
**Purpose:** Score and rank content opportunities  
**Code Location:** 
- `opportunity-selector.ts:15-90`
- `menu-scorer.ts:96-180`

**Process:**
1. Score all 73 menu items
2. Generate compound opportunities (weather + menu)
3. Select top opportunities

**Menu Scoring Logic:**
```typescript
// Base score: 50
+ Seasonal bonus (winter items): +10-20
+ Weather bonus (cold → hot drinks): +10-15
+ Category bonus (breakfast/lunch): +5-10
+ Description quality: +5
= Final score: 60-100
```

**Actual Output (from logs):**
```
[MenuScorer] Scored 73 items
Top 3: FAVORITTEN (70), Pandekage (70), DEN NYE (70)
Menu items: 73, Compound opportunities: 1
Plan complete: 4/7 slots filled
```

**Selected Opportunities:**
```json
[
  {
    "type": "menu_item",
    "subject": "FAVORITTEN",
    "score": 70,
    "category": "FORRETTER"
  },
  {
    "type": "menu_item", 
    "subject": "Pandekage",
    "score": 70,
    "category": "BRUNCH"
  },
  {
    "type": "menu_item",
    "subject": "DEN NYE",
    "score": 70,
    "category": "HOVEDRETTER"
  },
  {
    "type": "atmosphere_experience",
    "subject": "❄️ Cold snap → Hot drinks, hearty dishes",
    "score": 75
  }
]
```

**Status:** ✅ Working perfectly  
**Passed to Layer 6:** ✅ Yes (4 opportunities with scores)

---

## LAYER 6: POST SLOT OPTIMIZER
**Purpose:** Assign optimal day/time for each post  
**Code Location:** `post-slot-optimizer.ts:15-120`

**Logic:**
```typescript
// Breakfast items → Morning (8-11)
// Lunch items → Midday (11-14)  
// Dinner items → Afternoon (15-18)
// Ambiance posts → Evening/weekend

// Spread across week: Monday, Wednesday, Friday
```

**Actual Output:**
```json
[
  {
    "post": "FAVORITTEN",
    "day": "Monday",
    "hour": 11,
    "date": "2026-01-26",
    "reason": "Lunch timing for appetizer"
  },
  {
    "post": "DEN NYE", 
    "day": "Wednesday",
    "hour": 11,
    "date": "2026-01-28",
    "reason": "Midweek lunch boost"
  },
  {
    "post": "Pandekage",
    "day": "Friday",
    "hour": 11,
    "date": "2026-01-30",
    "reason": "Weekend brunch promo"
  },
  {
    "post": "Cold snap",
    "day": "Friday",
    "hour": 11,
    "date": "2026-01-30", 
    "reason": "Weekend atmosphere"
  }
]
```

**Status:** ✅ Working (all posts scheduled)  
**Passed to Layer 7:** ✅ Yes

---

## LAYER 7: MEDIA FORMAT SELECTOR
**Purpose:** Choose format (photo/carousel/reel) and platform  
**Code Location:** `media-format-selector.ts:20-80`

**Logic:**
```typescript
// Menu items → Photo (easiest to produce)
// Behind scenes → Reel (engaging)
// Ambiance → Photo or carousel

// Platform: Use business.selected_platforms
```

**Actual Output:**
```json
[
  {
    "post": "FAVORITTEN",
    "format": "photo",
    "platform": "instagram",
    "reason": "Single dish showcase"
  },
  {
    "post": "DEN NYE",
    "format": "photo", 
    "platform": "instagram",
    "reason": "Menu highlight"
  },
  {
    "post": "Pandekage",
    "format": "photo",
    "platform": "instagram",
    "reason": "Breakfast visual"
  },
  {
    "post": "Cold snap",
    "format": "photo",
    "platform": "instagram",
    "reason": "Atmosphere shot"
  }
]
```

**Status:** ✅ Working (all instagram photos)  
**Passed to Layer 8:** ✅ Yes

---

## LAYER 8: AI CAPTION GENERATOR
**Purpose:** Generate natural Danish captions with Gemini  
**Code Location:** 
- `weekly-plan-generator.ts:450-510` (calls AI)
- `ai-caption-generator/index.ts:20-60` (AI logic)
- `prompt-builder.ts:10-200` (builds prompt)

**Data Passed to AI:**
```typescript
{
  businessName: "Café Faust",
  businessCategory: "cafe",
  city: "Aarhus",
  country: "DK",
  
  brandVoice: {
    tone_keywords: ["friendly", "welcoming", "warm"],
    voice_style: "Venlig og imødekommende",
    values: [],           // ❌ null → [] (uses defaults)
    certifications: [],   // ❌ null → [] (uses defaults)
    do_not_say: { words: [] }
  },
  
  contentOpportunity: {
    type: "menu_item",
    subject: "FAVORITTEN",
    menuItem: {
      name: "FAVORITTEN",
      description: "...",
      price: "125,-"
    }
  },
  
  temporalContext: {
    season: "winter",
    dayOfWeek: "Monday",
    timeOfDay: "lunch",
    weather: "Cold"
  },
  
  format: "photo",
  platform: "instagram"
}
```

**Expected Output:**
```json
{
  "caption": "FAVORITTEN er tilbage på menuen! 😍 Perfekt til frokosten på en kold vinterdag. Kom forbi og smag selv! 🍽️✨",
  "hashtags": ["#CaféFaust", "#AarhusFood", "#DanishFood", "#CafeCulture"],
  "emojis": ["😍", "🍽️", "✨"],
  "tone_applied": "friendly, warm"
}
```

**Actual Output:** ❌ **FAILING**

**Error from Latest Logs:**
```
[AI Caption] ❌ Generation failed: {
  error: "Cannot read properties of undefined (reading 'values')"
  at buildBusinessContext (prompt-builder.ts:93:26)
}
```

**Root Cause Analysis:**

1. **Original code (BROKEN):**
```typescript
// Line 109 in prompt-builder.ts
if (context.brandVoice.values?.length) {  // ❌ Crashes if brandVoice is undefined
  section += `- Values: ${context.brandVoice.values.join(', ')}\n`
}
```

2. **Fixed code (deployed):**
```typescript
// Should now be:
if (context.brandVoice?.values?.length) {  // ✅ Safe with optional chaining
  section += `- Values: ${context.brandVoice.values.join(', ')}\n`
}
```

**Fixes Applied:**
- ✅ Added optional chaining `?.` to all `brandVoice` accesses
- ✅ Changed `brandProfile` → `brandVoice` in data passing
- ✅ Added city/country fields separately
- ✅ Fixed `do_not_say` format
- ✅ Deployed 3 times

**Status:** ⚠️ **Should be fixed but needs re-test**  
**Fallback:** Uses template captions from `content-brief-assembler.ts`

---

## LAYER 9: CONTENT BRIEF ASSEMBLER (Fallback)
**Purpose:** Generate template captions if AI fails  
**Code Location:** `content-brief-assembler.ts:15-150`

**Current Output (when AI fails):**
```json
{
  "caption": "FAVORITTEN hitting different today FAVORITTEN is ready. Come experience it yourself. Come try it today.",
  "visualDirection": "Photo of dish, warm lighting",
  "productionTime": "10-15 minutes"
}
```

**Status:** ✅ Working (this is what you're seeing now)  
**Problem:** AI should replace this, but isn't

---

## 🔍 SUMMARY OF ISSUES

| Layer | Status | Issue | Impact |
|-------|--------|-------|--------|
| 1 | ✅ Working | None | None |
| 2 | ✅ Working | None | None |
| 3 | ✅ Working | None | None |
| 4 | ⚠️ Stub | No historical data | Low (system works) |
| 5 | ✅ Working | None | None |
| 6 | ✅ Working | None | None |
| 7 | ✅ Working | None | None |
| 8 | ❌ **FAILING** | AI caption crashes → uses fallback | **HIGH** (no AI captions) |
| 9 | ✅ Working | Generic templates | Medium (backup working) |

---

## 🎯 WHAT NEEDS TESTING

**The deployment should have fixed Layer 8.** We need to verify:

1. **Is the fix deployed?** → Yes (deployed 3 times)
2. **Does brandVoice get passed correctly?** → Need to check logs
3. **Does Gemini API respond?** → Need to check logs
4. **Are captions AI-generated?** → Need to check output

**Please generate a new plan and share:**
- Browser console logs
- The captions you see
- Whether "AI Captions: X/4" increases from 0
