# Bugs & Issues to Fix - Post Layer Review

**Status:** Review complete through Layer 6 of 9
**Date:** January 30, 2026
**Business:** Café Faust (test case)

---

## 🔴 CRITICAL BUGS

### 1. Layer 7: Alt Text Has "undefined" Values
**File:** `supabase/functions/_shared/post-helpers/visual-direction-generator.ts`
**Lines:** ~250-280 (alt text generation)
**Issue:** ALL 60 posts (100%) have "undefined" in altText

**Current Output:**
```
"altText": "FAVORITTEN on restaurant table, undefined setting visible in background, undefined styling with natural lighting"
```

**Problem:**
- Template string references variables that don't exist or are null
- Likely: `${setting}` and `${styling}` variables undefined in scope
- Alt text is critical for accessibility (screen readers)

**Impact:** Accessibility broken, invalid alt text for all posts

**Fix Required:**
1. Check variable names in alt text template
2. Add null checks before string interpolation
3. Use actual setting/styling values from PhotoDirection object
4. Fallback to descriptive text if values missing

**Priority:** CRITICAL - Accessibility compliance failure

---

### 2. Layer 7: Visual Direction Identical for All Posts
**File:** `supabase/functions/_shared/post-helpers/visual-direction-generator.ts`
**Issue:** All posts get same generic visual direction

**Current State:**
- Angle: "45-degree angle, balanced composition" (all posts)
- Setting: "On restaurant table, restaurant interior" (all posts)
- Styling: "Balanced, appetizing color palette" (all posts)
- Lighting: "Bright natural daylight, overhead sun, crisp shadows" (all posts)

**Problem:**
- No differentiation between FAVORITTEN vs Pandekage vs atmosphere posts
- Visual direction generator using fallback values instead of content-specific
- Should vary by: dish type (salad vs steak), content type (menu vs atmosphere), time of day

**Expected Behavior:**
- Brunch dish: "Top-down angle, bright morning light, fresh ingredients visible"
- Dinner entrée: "Eye-level 45-degree, warm evening ambiance, shallow depth of field"
- Atmosphere: "Wide shot showing space, customers, ambient lighting"

**Fix Required:**
1. Pass content subject to visual direction generator
2. Use dish characteristics (temperature, meal period, plating style)
3. Vary lighting by post time (morning/lunch/dinner/evening)
4. Create content-type-specific templates

**Priority:** HIGH - Reduces content uniqueness and creator guidance

---

### 3. Layer 5: Menu Scoring Not Working
**File:** `supabase/functions/_shared/post-helpers/menu-scorer.ts`
**Line:** 159
**Issue:** All menu items get hardcoded score of 70 instead of real calculated scores

**Current Code:**
```typescript
const score: MenuItemScore = {
  itemId: `${item.business_id}-${item.name}`,
  itemName: item.name,
  itemCategory: item.category,
  finalScore: 70, // ❌ HARDCODED DEFAULT
  // ... rest
}
```

**Problem:**
- `scoreMenuItems()` loops through items and creates scores with `finalScore: 70`
- Never calls `scoreMenuItem()` which has the real scoring logic:
  - baseScore: 50-100 (regular/seasonal/limited/signature)
  - seasonalBonus: 0-50
  - weatherBonus: hot/cold alignment
  - locationBonus: waterfront/tourist tags
  - performanceBonus: historical engagement
  - recencyPenalty: -100 if posted <7 days

**Impact:** No differentiation between items - everything looks equally important

**Fix Required:**
1. Loop should call `await scoreMenuItem(item, context, supabase)` for each item
2. Remove hardcoded finalScore: 70
3. Use returned score object

**Priority:** HIGH - Affects content selection quality

---

### 4. Layer 6: Time Collision Not Prevented
**File:** `supabase/functions/_shared/post-helpers/post-slot-optimizer.ts`
**Issue:** Two posts scheduled at same time (Friday 11:00)

**Current Schedule:**
- Monday 11:00 - FAVORITTEN (menu_item)
- Wednesday 11:00 - DEN NYE (menu_item)
- Friday 11:00 - Pandekage (menu_item)
- Friday 11:00 - Atmosphere (compound) ❌ COLLISION

**Problem:**
- Layer 6 should detect when a timeslot is already used
- Should spread posts across different times
- Currently allows multiple posts at same time

**Expected Behavior:**
- Friday 11:00 - Pandekage
- Friday 15:00 - Atmosphere (different time)
- OR Friday 11:00 - Pandekage, Saturday 11:00 - Atmosphere (different day)

**Fix Required:**
1. Track used timeslots during optimization
2. Check if day+hour already allocated before assigning
3. Use alternative times: [9:00, 11:00, 14:00, 17:00, 19:00]
4. Spread posts minimum 3 hours apart on same day

**Priority:** MEDIUM - Causes scheduling conflicts but posts still created

---

## ⚠️ DATA GAPS & LOW PRIORITY

### 7. Layer 7: Production Notes Too Minimal
**Issue:** Production notes only contain time estimates, no creative guidance

**Current State:**
```json
{
  "timing": "11:00",
  "estimatedTime": "10-15 minutes",
  "logistics": []
}
```

**Missing:**
- Shot requirements (angles, framing)
- Props needed (plates, garnishes, backgrounds)
- Styling instructions (plating, arrangement)
- Lighting setup (natural/artificial, direction)
- Technical notes (focus points, depth of field)

**Fix Required:**
1. Expand production notes with actionable guidance
2. Include dish-specific requirements
3. A9d equipment/props list
4. Specify shot composition details

**Priority:** MEDIUM - Affects content creator experience

---

### 8. Layer 5: Real Menu Items Have No Metadata
**Issue:** menu_item_metadata table has test data, not real Café Faust items

**Current State:**
- menu_results_v2: 73 REAL items (FAVORITTEN, PARISERBØF, etc.)
- menu_item_metadata: 7 TEST items (Caesar Salad, Strawberry Ice Cream, etc.)
- Zero overlap

**Impact:**
- Real items can't use metadata-based scoring
- No tracking of is_signature, is_seasonal, dish_temp_category
- No historical posting data

**Fix Required:**
1. Create metadata entries for real menu items during extraction
2. OR join menu_results_v2 with menu_item_metadata during scoring
3. Allow AI to infer metadata from descriptions if missing

**Priority:** MEDIUM - Scoring works but without enrichment data

---

### 6. Missing Location Context Schema
**Issue:** Code expects location fields that don't exist in database

**Missing Columns in `businesses` table:**
- outdoor_seating (boolean)
- area_type (text: urban/suburban/rural/tourist)
- category_scores (JSONB: waterfront, tourist_area, business_district)

**Impact:**
- Layer 3 compound opportunities can't detect:
  - Waterfront locations (score ≥70 trigger)
  - Tourist areas + season
  - Outdoor seating + weather
- Most compound opportunity patterns disabled

**Fix Required:**
1. Add schema migration for location context columns
2. OR extract from business_locations table
3. OR allow manual input in business profile UI

**Priority:** LOW - Calendar events work, location-based patterns are bonus

---

## ✅ FIXED DURING REVIEW

### Layer 3: Calendar Schema Mismatch (FIXED)
**File:** `supabase/functions/_shared/post-helpers/compound-opportunities.ts`
**Lines:** 797-803

**Was:**
```typescript
.from('contextual_calendar')
.select('event_date, event_type, event_name, event_category')
.eq('business_id', businessId)
```

**Fixed To:**
```typescript
.from('contextual_calendar')
.select('date_start, date_end, event_type, event_name, relevance_tags, content_angle, marketing_hook')
.eq('country', countryCode)
```

**Status:** ✅ DEPLOYED - Calendar events now generating compound opportunities

---

## 📝 DESIGN DECISIONS (Not Bugs)

### Layer 2: Hardcoded Distribution (By Design)
**Current:** 7 slots hardcoded (3 menu, 2 atmosphere, 1 behind_scenes, 1 promotional)
**Reason:** Database table `content_distribution_rules` empty for cafes
**Status:** Working as intended - falls back to sensible defaults

### Layer 4: Cold Start (By Design)
**Current:** Zero performance data, uses Layer 2 defaults
**Reason:** No posts published yet, table empty
**Status:** Working as intended - graceful fallback until 20+ posts

---

## 🔧 IMPLEMENTATION NOTES

### Layer 5 Fix Details
**Approach:**
1. Replace simplified scoring loop with full scoring
2. Preserve description/price passing (already fixed in review)
3. Handle missing metadata gracefully (use defaults if null)

**Pseudo-code:**
```typescript
for (const item of menuItems) {
  // Check if metadata exists for this item
  const metadata = await getItemMetadata(item.name, businessId)
  
  // Call real scoring function
  const score = await scoreMenuItem({
    item_name: item.name,
    item_category: item.category,
    is_signature: metadata?.is_signature || false,
    is_seasonal: metadata?.is_seasonal || false,
    dish_temp_category: metadata?.dish_temp_category || inferFromName(item.name),
    // ... other fields
  }, context, supabase)
  
  scores.push(score)
}
```

### Layer 6 Fix Details
**Approach:**
1. Track allocated timeslots in a Set: `usedSlots = new Set<string>()`
2. Before assigning, check: `usedSlots.has(\`\${day}-\${hour}\`)`
3. If collision, try alternative times or next day
4. Add used slot after assignment

**Pseudo-code:**
```typescript
const usedSlots = new Set<string>()
const alternativeTimes = [9, 11, 14, 17, 13 (scoring)
- ⚠️ Layer 6: Post Slot Optimizer - Bug #4 (collision)
- ❌ Layer 7: Media Format Selector - Bugs #1, #2, #7 (alt text, visual direction, production notes)
- ⏳ Layer 8: AI Caption Generator - Fixed earlier, needs reverification
  let hour = selectOptimalHour(slot.contentType, day)
  
  // Check collision
  while (usedSlots.has(`${day}-${hour}`)) {
    hour = getNextAvailableTime(alternativeTimes, hour)
    if (!hour) {
      day =7 Alt Text** (Critical) - Accessibility compliance failure
2. **Layer 7 Visual Direction** (High) - All posts identical, no differentiation
3. **Layer 5 Scoring** (High) - Affects content quality
4. **Layer 6 Collision** (Medium) - Causes scheduling conflicts
5. **Production Notes** (Medium) - Improves creator experience
6. **Menu Metadata** (Medium) - Improves scoring accuracy
7. **Location Schema** (Low) - Enables bonus features
8. Complete Layers 8
  slot.day = day
  slot.hour = hour
  usedSlots.add(`${day}-${hour}`)
}
```

---

## 📊 VERIFICATION STATUS

- ✅ Layer 1: Business Fundamentals - Complete, no bugs
- ✅ Layer 2: Content Distribution - Complete, uses defaults
- ✅ Layer 3: Contextual Calendar - Fixed, 3 DK events found
- ✅ Layer 4: Performance Analyzer - Complete, cold start
- ⚠️ Layer 5: Opportunity Selector - Bug #1 (scoring)
- ⚠️ Layer 6: Post Slot Optimizer - Bug #2 (collision)
- ⏳ Layer 7: Media Format Selector - Not yet verified
- ⏳ Layer 8: AI Caption Generator - Fixed earlier (separate issue)
- ⏳ Layer 9: Content Brief Assembler - Not yet verified

---

## 🎯 PRIORITY ORDER

1. **Layer 5 Scoring** (Critical) - Affects content quality
2. **Layer 6 Collision** (Medium) - Causes scheduling conflicts
3. **Menu Metadata** (Medium) - Improves scoring accuracy
4. **Location Schema** (Low) - Enables bonus features
5. Complete Layers 7-9 verification before implementing fixes

---

## 📋 NEXT STEPS

1. Complete review of Layers 7-9
2. Create comprehensive fix plan
3. Implement fixes in priority order
4. Test with Café Faust
5. Deploy to production
