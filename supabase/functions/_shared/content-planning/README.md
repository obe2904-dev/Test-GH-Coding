# Content Planning Utilities - Phase 1 Implementation

**Status:** ✅ Complete - Ready for Integration  
**Date:** 2026-06-08  
**Migration Phase:** 0 Complete (Database schema + indexes)

---

## 📋 Overview

Phase 1 utilities provide **deterministic business logic** for content planning:

1. **Menu Rotation Queue** - Fair dish rotation (least-recently-used first)
2. **Service Period Detector** - Time-aware meal service detection
3. **Pattern Tracker** - Posting pattern analysis (avoid repetition)
4. **Brand Voice Loader** - Minimal voice context (5 properties only)

---

## 🎯 Design Principles

### **Context Minimalism**
- Load ONLY what's needed (5 brand voice properties, not 60)
- Query indexed columns only (menu_item_name, content_type, posted_at)
- Return structured data (no AI inference at this layer)

### **Deterministic Logic**
- Rotation queue: SQL GROUP BY + ORDER BY (no AI)
- Service period: Time ranges + programme config (no AI)
- Pattern tracking: COUNT + weekday analysis (no AI)
- Voice loading: Direct column fetch (no AI)

### **Performance First**
- All queries use new indexes (idx_published_posts_menu_rotation, etc.)
- Target: <5ms for all queries combined
- No JOINs in hot path (denormalized menu_item_name)

---

## 📁 File Structure

```
supabase/functions/_shared/content-planning/
├── index.ts                      # Central exports
├── menu-rotation-queue.ts        # Dish rotation logic
├── service-period-detector.ts    # Meal service detection
├── pattern-tracker.ts            # Posting pattern analysis
└── brand-voice-loader.ts         # Minimal voice context
```

---

## 🔧 Usage Examples

### **1. Menu Rotation Queue**

```typescript
import { getMenuRotationQueue, getNextDishToPost } from '../_shared/content-planning/index.ts'

// Get rotation queue for lunch service
const queue = await getMenuRotationQueue(supabase, {
  businessId: 'abc-123',
  servicePeriod: 'lunch',  // Filter by service period
  lookbackDays: 90,        // Rotation history window
  limit: 10                // Top 10 priority dishes
})

// queue[0] = dish that should be posted next (never posted OR oldest post)
console.log('Next dish:', queue[0].menu_item_name)
console.log('Days since posted:', queue[0].days_since_posted)  // null if never posted

// Or get single next dish
const nextDish = await getNextDishToPost(supabase, {
  businessId: 'abc-123',
  servicePeriod: 'lunch'
})
```

**Returns:**
```typescript
{
  menu_item_name: "Croque Monsieur",
  menu_item_id: "uuid-here",
  last_posted_at: "2026-05-15T12:00:00Z",  // null if never posted
  days_since_posted: 24,                    // null if never posted
  total_posts: 3,
  service_period: "lunch"
}
```

### **2. Service Period Detection**

```typescript
import { detectServicePeriod, getDishesForServicePeriod } from '../_shared/content-planning/index.ts'

// Detect current service period
const result = await detectServicePeriod(supabase, businessId, '14:30')

console.log('Current:', result.currentPeriod)        // 'lunch'
console.log('Next:', result.nextPeriod)              // 'dinner'
console.log('Starts at:', result.nextPeriodStartsAt) // '17:00'

// Get dishes available for lunch
const lunchDishes = await getDishesForServicePeriod(supabase, businessId, 'lunch')
```

### **3. Pattern Tracking**

```typescript
import { analyzePostingPatterns, getRecommendedContentType } from '../_shared/content-planning/index.ts'

// Analyze last 14 days
const analysis = await analyzePostingPatterns(supabase, businessId, 14)

console.log('Overused types:', analysis.overusedTypes)       // ['product'] (>40% of posts)
console.log('Underused types:', analysis.underusedTypes)     // ['experience', 'atmosphere']
console.log('Recommended:', analysis.recommendedTypes[0])    // 'experience'

// Or get recommendation directly
const nextType = await getRecommendedContentType(supabase, businessId)
```

### **4. Brand Voice (Minimal)**

```typescript
import { loadMinimalBrandVoice, formatVoiceForPrompt } from '../_shared/content-planning/index.ts'

// Load ONLY 5 essential properties
const voice = await loadMinimalBrandVoice(supabase, businessId)

console.log('Essence:', voice.essence)                        // "Venlig og jordnær..."
console.log('Never say:', voice.neverSay)                     // ['åens første lys', ...]
console.log('Always say:', voice.alwaysSay)                   // ['Hjemmelavet', ...]
console.log('Forbidden phrases:', voice.forbiddenPhrases)     // Weather clichés
console.log('Weather clichés:', voice.weatherClichesToAvoid)  // Seasonal clichés

// Format for AI prompt (compact string)
const promptVoice = formatVoiceForPrompt(voice)
// "Brand: Venlig og jordnær...\nUndgå: åens første lys, ...\nBrug: Hjemmelavet, ..."
```

---

## 🚀 Integration Plan

### **Step 1: Quick Suggestions Enhancement** (Fastest ROI)

**File:** `supabase/functions/get-quick-suggestions/index.ts`

**Changes:**
```typescript
// BEFORE (manual logic, no rotation):
const signatureItems = await fetchMenuFromKeyOfferings(...)
const recentPosts = await fetchRecentPosts(...)
// Manual deduplication logic...

// AFTER (rotation queue):
import { getMenuRotationQueue, detectServicePeriod, loadMinimalBrandVoice } from '../_shared/content-planning/index.ts'

// 1. Detect current service period
const { currentPeriod } = await detectServicePeriod(supabase, businessId, currentTimeHHMM)

// 2. Get rotation queue (dishes that haven't been posted recently)
const queue = await getMenuRotationQueue(supabase, {
  businessId,
  servicePeriod: currentPeriod,
  limit: 5
})

// 3. Load minimal brand voice
const voice = await loadMinimalBrandVoice(supabase, businessId)

// 4. Use queue[0] as primary suggestion, queue[1-2] as alternatives
const suggestionDish = queue[0]
```

**Output Enhancement:**
```typescript
// Add metadata to suggestion record
const suggestion = {
  title: 'Croque Monsieur',
  caption_base: '...',
  menu_item_id: suggestionDish.menu_item_id,        // ✅ NEW
  menu_item_name: suggestionDish.menu_item_name,    // ✅ NEW
  content_type: 'product',                          // ✅ NEW
  service_period: suggestionDish.service_period,    // ✅ NEW
  content_angle: 'Rainy-day comfort classic'        // ✅ NEW
}

// When user accepts → metadata flows to published_posts automatically
```

**Benefits:**
- ✅ Fair dish rotation (no dish over-featured)
- ✅ Service-period aware (lunch dishes at lunch time)
- ✅ Metadata tracking enabled (rotation works going forward)
- ✅ Minimal code changes (~50 lines)

---

### **Step 2: Weekly Plan Architecture** (Full Implementation)

**Phase 2-6 Implementation:**

1. **Phase 2: Strategic Brief** (get-weekly-strategy)
   - Use `loadMinimalBrandVoice()` instead of full brand profile
   - Use `analyzePostingPatterns()` for content balance
   - Generate structured brief (JSON, not prose)

2. **Phase 3: Schedule Generation** (NEW: generate-weekly-schedule)
   - Deterministic slot allocation (Mon-Sun, 7 slots)
   - Service period detection for each slot
   - Rotation queue determines dish selection
   - Pattern tracker ensures variety

3. **Phase 4: Content Selection** (NEW: select-weekly-content)
   - For each slot: query rotation queue
   - Filter by service period + avoid recent patterns
   - Return structured content plan (dish + angle)

4. **Phase 5: Caption Writing** (existing generate-text-from-idea)
   - Use minimal brand voice (5 properties)
   - Structured JSON input → structured JSON output
   - No context drift

5. **Phase 6: Validation** (NEW: validate-weekly-plan)
   - Check metadata completeness
   - Verify rotation tracking data
   - Audit quality rules

---

## 📊 Testing

### **Database Performance Test**

Run: `_TEST_CONTENT_PLANNING_UTILITIES.sql`

**Expected Results:**
- Test 1 (Rotation queue): <1ms, uses `idx_published_posts_menu_rotation`
- Test 2 (Pattern history): <1ms, uses `idx_published_posts_pattern_history`
- Test 3 (Menu items): <1ms, returns service_periods JSONB
- Test 4 (Programmes): <1ms, returns brunch/lunch/dinner config
- Test 5 (Brand voice): <1ms, returns 5 properties only

### **TypeScript Function Test**

Create test edge function:

```typescript
// supabase/functions/test-content-planning/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getMenuRotationQueue,
  detectServicePeriod,
  analyzePostingPatterns,
  loadMinimalBrandVoice
} from '../_shared/content-planning/index.ts'

serve(async (req) => {
  const { businessId } = await req.json()
  const supabase = createClient(...)

  // Test all utilities
  const [queue, period, patterns, voice] = await Promise.all([
    getMenuRotationQueue(supabase, { businessId, limit: 5 }),
    detectServicePeriod(supabase, businessId),
    analyzePostingPatterns(supabase, businessId),
    loadMinimalBrandVoice(supabase, businessId)
  ])

  return new Response(JSON.stringify({
    queue,
    period,
    patterns,
    voice
  }, null, 2))
})
```

**Deploy:**
```bash
supabase functions deploy test-content-planning
```

**Test:**
```bash
curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/test-content-planning \
  -H "Authorization: Bearer <anon-key>" \
  -d '{"businessId":"f4679fa9-3120-4a59-9506-d059b010c34a"}'
```

---

## 🎯 Next Steps

1. **Run Database Test** (_TEST_CONTENT_PLANNING_UTILITIES.sql)
   - Verify all queries use indexes
   - Confirm <5ms total execution time

2. **Deploy Test Function** (test-content-planning)
   - Verify TypeScript utilities work in Deno runtime
   - Test with real Cafe Faust data

3. **Integrate into Quick Suggestions** (Step 1 above)
   - Update get-quick-suggestions/index.ts
   - Deploy and test with real user
   - Verify metadata flows to published_posts

4. **Plan Weekly Plan Overhaul** (Phases 2-6)
   - Create detailed task breakdown
   - Estimate implementation timeline
   - User approval before starting

---

## 📝 Migration Checklist

- [x] **Migration 1:** Metadata enforcement (published_posts constraints)
- [x] **Migration 2:** Rotation indexes (4 indexes on published_posts)
- [x] **Migration 3:** Daily suggestions metadata (5 columns + 3 constraints)
- [x] **Phase 1 Code:** TypeScript utilities (4 modules + index)
- [ ] **Database Test:** Run _TEST_CONTENT_PLANNING_UTILITIES.sql
- [ ] **Function Test:** Deploy test-content-planning and verify
- [ ] **Integration:** Update get-quick-suggestions
- [ ] **User Testing:** Verify with Cafe Faust
- [ ] **Weekly Plan:** Phases 2-6 implementation

---

## 🐛 Troubleshooting

### Slow Queries
**Symptom:** Rotation queue takes >10ms  
**Fix:** Run `ANALYZE published_posts;` to update statistics

### Missing Service Periods
**Symptom:** `detectServicePeriod()` returns null  
**Fix:** Check `business_programme_profiles` has active programmes

### Empty Rotation Queue
**Symptom:** `getMenuRotationQueue()` returns []  
**Fix:** Check `menu_items_normalized` has items with `service_periods`

### Default Voice Used
**Symptom:** `loadMinimalBrandVoice()` returns default voice  
**Fix:** Check `business_brand_profile` exists and has `brand_essence`

---

**End of Phase 1 Documentation**
