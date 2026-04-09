# 🔬 DEEP DIVE: Complete Bug Analysis & Fix Strategy

**Date:** 2026-01-30  
**Context:** 9-layer review complete for Café Faust  
**Status:** 11 bugs identified across Layers 5, 6, 7, 8  
**Purpose:** Comprehensive root cause analysis to ensure fixes don't create new problems

---

## 📊 EXECUTIVE SUMMARY

### Bug Distribution
- **2 Critical**: AltText undefined (#1), Template fallback (#9)
- **5 High**: Visual direction (#2), Scoring (#3), Quality scores not saved (#8), Language mismatch (#10), Brevity failure (#11)
- **2 Medium**: Time collision (#4), Production notes (#7)
- **2 Data Gaps**: Menu metadata (#5), Location schema (#6)

### Key Insight: ROOT CAUSE CLUSTERS
Most bugs fall into 3 clusters with common root causes:

1. **AI GENERATION CLUSTER** (Bugs #9, #10, #11)
   - Single root cause: AI prompt construction or error handling
   - Manifests as: Template fallback, language inconsistency, brevity failure

2. **VISUAL GENERATION CLUSTER** (Bugs #1, #2)
   - Common root cause: Generic fallback values in visual-direction-generator
   - Manifests as: Undefined variables in altText, identical visual directions

3. **DATA FLOW CLUSTER** (Bugs #3, #8)
   - Common root cause: Bypassed function calls in processing pipeline
   - Manifests as: Hardcoded values, missing database fields

---

## 🔍 CLUSTER 1: AI GENERATION ISSUES

### Bug #9: Template Fallback (CRITICAL)
**Location:** `weekly-plan-generator.ts` lines 509-522

**Observed Behavior:**
- FAVORITTEN: "Is it just us or does favoritten look amazing? FAVORITTEN is ready to make your day better. Come try it today!"
- DEN NYE: Same template pattern
- Pandekage: Proper Danish AI generation
- Atmosphere: Proper Danish AI generation

**Root Cause Analysis:**
```typescript
// Line 509-522: AI caption generation with error handling
try {
  aiCaptionResult = await generateWithGeminiFlash({
    brandVoice, businessType, contentSubject, 
    contentType, description, seasonalContext,
    temperature: 0.5
  })
} catch (error) {
  console.warn('[WeeklyPlan] AI caption generation failed, using fallback:', error)
  // Continue with fallback (will use template)
}

// Line 538: Uses fallback from assembleContentBrief if AI fails
const finalCaption = aiCaptionResult ? aiCaptionResult.caption : brief.caption
```

**Why It Fails:**
1. AI generation throws an error for FAVORITTEN and DEN NYE
2. Error is caught silently (only console.warn)
3. Falls back to `brief.caption` which contains template text
4. No investigation of WHY AI fails for these specific items

**Critical Questions:**
- Why does AI work for "Pandekage" but fail for "FAVORITTEN"?
- Is it the uppercase naming? Special characters? Menu item metadata?
- Does error log show specific Gemini API errors?

**Interdependencies:**
- **Affects Bug #10** (Language): Template is in English, should be Danish
- **Affects Bug #11** (Brevity): Template is 117 chars, too short
- **Related to Bug #8**: If quality_score isn't saved, was AI actually called?

---

### Bug #10: Language Mismatch (HIGH)
**Observed:** FAVORITTEN/DEN NYE in English, Pandekage/Atmosphere in Danish

**Root Cause:**
1. **Primary cause**: Template fallback from Bug #9 uses English
2. **Secondary concern**: AI prompt might not enforce Danish for country="DK"

**Code Location:**
Need to verify `generateWithGeminiFlash()` prompt construction:
- Does it check `country` field?
- Does prompt explicitly request Danish language?
- Is country="DK" properly passed to AI function?

**Fix Dependencies:**
- **MUST fix Bug #9 first** - If AI doesn't fail, language should be correct
- **Then verify**: Check AI prompt includes language directive

---

### Bug #11: Brevity Failure (HIGH)
**Observed:** Only 6.7% meet 125-200 char target
- 50% too short (<125 chars)
- 21.7% way too long (>250 chars, avg 513!)
- 21.7% slightly long (201-250)

**Root Cause Analysis:**
```typescript
// Line 516: Temperature is set correctly
temperature: 0.5  // Lower = more factual, less creative
```

**Why It Fails:**
1. **Too short (<125)**: These might be template fallbacks (Bug #9)
2. **Too long (>250)**: AI ignoring brevity instructions
3. **Temperature 0.5**: Should make AI more consistent, but doesn't enforce brevity

**Critical Question:**
- What's in the AI prompt for brevity?
- Is "125-200 characters" explicitly stated?
- Should we use character count validation + regeneration?

**Potential Solution Pattern:**
```typescript
let attempts = 0
while (attempts < 3) {
  const result = await generateWithGeminiFlash({...})
  if (result.caption.length >= 125 && result.caption.length <= 200) {
    return result
  }
  attempts++
}
// Return best attempt or fallback
```

---

## 🔍 CLUSTER 2: VISUAL GENERATION ISSUES

### Bug #1: AltText "undefined" Values (CRITICAL)
**Location:** `visual-direction-generator.ts` ~250-280

**Observed:** 100% of posts (60/60) have "undefined" in altText
```
"FAVORITTEN on restaurant table, undefined setting visible in background, undefined styling"
```

**Root Cause:**
```typescript
// Line ~280: Alt text template string references undefined variables
function generatePhotoDirection(input: VisualDirectionInput): PhotoDirection {
  const { subject, contentType, seasonalContext, locationContext, postTime } = input
  
  const angle = angles[contentType] || '45-degree angle, balanced composition'
  const setting = getSettingDirection(locationContext.type, locationContext.amplifiers)
  const lighting = getLightingDirection(postTime, seasonalContext.season, seasonalContext.weather)
  const styling = getStylingDirection(seasonalContext.season)
  
  // Somewhere in altText template:
  return {
    altText: `${subject} on restaurant table, ${setting} setting visible in background, ${styling} styling`,
    // ❌ But setting/styling return values don't match template expectations
  }
}
```

**Specific Analysis:**
1. `setting` returns: "outdoor terrace, harbor water view with soft background blur"
2. `styling` returns: "Seasonal winter elements incorporated"
3. Template expects: `${setting}` directly, but result has "undefined"

**Most Likely Cause:**
- Functions return complex strings, but template doesn't use them correctly
- OR: Functions return objects/undefined when they should return strings
- OR: Variables renamed but template not updated

**Fix Strategy:**
1. Read actual return values from getSettingDirection/getStylingDirection
2. Verify they return strings, not objects
3. Update template to use correct property names
4. Add null-safety: `${setting || 'interior'}`

---

### Bug #2: Visual Direction Identical (HIGH)
**Observed:** All posts get same generic visual direction

**Example:**
```
Angle: "45-degree angle, balanced composition"
Setting: "restaurant interior"
Lighting: "Bright natural daylight"
```

**Root Cause:**
```typescript
// Lines 271-285: Using fallback values
const angle = angles[contentType] || '45-degree angle, balanced composition'
const setting = getSettingDirection(locationContext.type, locationContext.amplifiers)
const lighting = getLightingDirection(postTime, seasonalContext.season, seasonalContext.weather)
const styling = getStylingDirection(seasonalContext.season)
```

**Why Fallbacks Trigger:**
1. `angles[contentType]` - Is contentType being passed correctly?
2. `locationContext.type` - Does Café Faust have location data?
3. `seasonalContext.weather` - Is weather data populated?

**Critical Data Check:**
```sql
-- Do posts have proper locationContext?
SELECT 
    p->'visualDirection'->'angle' as angle,
    p->'visualDirection'->'setting' as setting,
    p->'locationContext' as location_data
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
LIMIT 2;
```

**Interdependencies:**
- **Related to Bug #1**: Using fallbacks → variables undefined → altText broken
- **Related to Bug #5**: If menu metadata empty, locationContext might be empty too

---

## 🔍 CLUSTER 3: DATA FLOW ISSUES

### Bug #3: Scoring Hardcoded (HIGH)
**Location:** `menu-scorer.ts` line 159

**Observed:** All 73 menu items get finalScore: 70

**Root Cause (CLEAR):**
```typescript
// Lines 149-176: Creates score objects without calling scoreMenuItem()
for (const item of menuItems) {
  const score: MenuItemScore = {
    itemId: `${item.business_id}-${item.name}`,
    itemName: item.name,
    itemCategory: item.category,
    finalScore: 70, // ❌ HARDCODED DEFAULT - never calls real function
    scoreBreakdown: {
      baseScore: 50,
      seasonalBonus: 10,
      weatherBonus: 5,
      locationBonus: 5,
      performanceBonus: 0,
      recencyPenalty: 0,
    },
    // ... rest hardcoded
  }
  scores.push(score)
}

// Lines 190+: Real scoreMenuItem() function EXISTS but is NEVER CALLED
async function scoreMenuItem(
  item: any,
  context: MenuScoringContext,
  supabase: any
): Promise<MenuItemScore> {
  // Sophisticated scoring logic:
  // - baseScore: 50-100 (signature/seasonal/limited)
  // - seasonalBonus: 0-50 (winter ingredients)
  // - weatherBonus: hot/cold alignment
  // - locationBonus: waterfront/tourist
  // - performanceBonus: historical engagement
  // - recencyPenalty: -100 if posted <7 days
  // NEVER EXECUTED
}
```

**Why This Happened:**
This looks like a **temporary simplification** that was never reverted:
- Developer created simplified loop during testing
- Commented out real scoring to debug menu extraction
- Forgot to uncomment/revert to real implementation

**Fix (SIMPLE):**
```typescript
// Replace lines 149-176 with:
const scores: MenuItemScore[] = []

for (const item of menuItems) {
  // Query metadata for this item
  const { data: metadata } = await context.supabase
    .from('menu_item_metadata')
    .select('*')
    .eq('business_id', item.business_id)
    .eq('item_name', item.name)
    .single()
  
  // Call REAL scoring function
  const score = await scoreMenuItem({
    ...item,
    is_signature: metadata?.is_signature || false,
    is_seasonal: metadata?.is_seasonal || false,
    seasonal_ingredients: metadata?.seasonal_ingredients || [],
    dish_temp_category: metadata?.dish_temp_category || inferTemp(item.name),
  }, context, context.supabase)
  
  scores.push(score)
}
```

**Risk Assessment: LOW**
- Clear fix, just remove hardcoded values
- Real function already exists and tested
- No dependencies on other bugs

**Interdependencies:**
- **Related to Bug #5**: Metadata table empty, so all items will use defaults
- **Independent from** Bugs #1, #2, #9, #10, #11

---

### Bug #8: Quality Scores Not Saved (CRITICAL)
**Location:** `weekly-plan-generator.ts` lines 533-535 (earlier fix attempt)

**Observed:** quality_score and emoji_count are NULL for all 60 posts

**Code Context:**
```typescript
// Line 538: Uses AI result if available
const finalCaption = aiCaptionResult ? aiCaptionResult.caption : brief.caption
const finalHashtags = aiCaptionResult ? aiCaptionResult.hashtags : []
const isAIGenerated = !!aiCaptionResult

// But quality_score and emoji_count not extracted from aiCaptionResult
```

**Root Cause (HYPOTHESIS):**
1. `aiCaptionResult` structure might not include quality_score/emoji_count fields
2. Earlier fix at lines 533-535 might have been incomplete
3. Fields might be in result but not saved to database

**Investigation Needed:**
```typescript
// Check generateWithGeminiFlash return type:
interface GeminiFlashResult {
  caption: string
  hashtags: string[]
  quality_score?: number  // ← Is this returned?
  emoji_count?: number    // ← Is this returned?
}
```

**Fix Strategy:**
1. Read generateWithGeminiFlash() function to see what it returns
2. If quality_score exists in result, extract it:
   ```typescript
   const quality_score = aiCaptionResult?.quality_score || null
   const emoji_count = aiCaptionResult?.emoji_count || null
   ```
3. Add these fields to post object saved to database

**Critical Dependency:**
- **Related to Bug #9**: If AI fails and uses template, no quality_score available
- **Must fix together**: Ensure AI runs successfully to get quality data

---

## 🔍 NON-CLUSTERED BUGS

### Bug #4: Time Collision (MEDIUM)
**Location:** `post-slot-optimizer.ts`

**Observed:** Two posts scheduled Friday 11:00
- Pandekage (menu_item)
- Atmosphere (Cold snap)

**Root Cause:**
```typescript
// Lines 60-95: DAY_PATTERNS define which days content types prefer
const DAY_PATTERNS: Record<string, number[]> = {
  menu_highlight: [1, 3, 5],  // Mon/Wed/Fri
  atmosphere: [4, 5, 6],       // Thu/Fri/Sat
  // ...
}

// But no collision detection when assigning times
function selectOptimalDay(contentType: string, ...): number {
  const pattern = DAY_PATTERNS[contentType]
  // ❌ Doesn't check if day/time already used
  return pattern[0] || fallbackDay
}
```

**Why It Happens:**
1. Both menu_item and atmosphere prefer Friday
2. No tracking of used (day, time) slots
3. No fallback logic if preferred slot taken

**Fix Strategy:**
```typescript
function optimizePostSlots(
  weeklyPlan: WeeklyPlan,
  context: BusinessContext
): OptimizedWeeklyPlan {
  const usedSlots = new Set<string>() // Track "day-hour" combos
  
  for (const slot of weeklyPlan.slots) {
    let day = selectOptimalDay(slot.contentType, context)
    let hour = selectOptimalTime(slot.contentType, context)
    
    let attempts = 0
    while (usedSlots.has(`${day}-${hour}`) && attempts < 7) {
      // Try next day in pattern
      day = (day + 1) % 7
      attempts++
    }
    
    if (usedSlots.has(`${day}-${hour}`)) {
      // Try different hour
      hour = (hour + 2) % 24
    }
    
    usedSlots.add(`${day}-${hour}`)
    
    // ... assign optimized slot
  }
}
```

**Risk Assessment: LOW**
- Straightforward collision detection
- No dependencies on other bugs
- Can test in isolation

---

### Bug #7: Production Notes Minimal (MEDIUM)
**Observed:** Only contains estimatedTime, timing, empty logistics array

**Current Structure:**
```json
{
  "estimatedTime": "10-15 minutes",
  "timing": "Before lunch service",
  "logistics": []
}
```

**Expected Enhancement:**
```json
{
  "estimatedTime": "10-15 minutes",
  "timing": "Before lunch service",
  "shotRequirements": [
    "45-degree angle showing full plate",
    "Include Café Faust branded napkin/menu in corner",
    "Capture steam rising if hot dish"
  ],
  "props": ["Small vase with winter flowers", "Café Faust menu"],
  "styling": "Rustic wooden table, natural elements, cozy winter mood",
  "lighting": "Bright natural window light from left side",
  "locationNotes": "Use window-side tables for best natural light",
  "logistics": [
    "Schedule during 9-10am (best natural light)",
    "Have FAVORITTEN plated and ready",
    "Prepare backup plate if styling attempt fails"
  ]
}
```

**Implementation Priority: LOW**
- Enhancement, not critical bug
- Doesn't block other fixes
- Can implement after core bugs fixed

---

## 🔍 DATA GAPS (NOT BUGS)

### Bug #5: Menu Metadata Missing (MEDIUM)
**Observed:** 
- menu_results_v2: 73 Café Faust items
- menu_item_metadata: 7 test items (no overlap)

**This is NOT a code bug** - It's a data migration task

**Impact:**
- Bug #3 scoring will work but use all defaults
- Advanced features disabled: signature detection, seasonal ingredients
- Location-based scoring reduced

**Solution:**
1. Create migration script to populate metadata
2. For each item in menu_results_v2:
   - Extract name, category, description
   - Infer dish_temp_category from name/description
   - Query seasonal_ingredients table for matches
   - Insert into menu_item_metadata
3. Manual review: Flag signature dishes

**Priority: MEDIUM**
- Not blocking core functionality
- Enhances quality once Bug #3 fixed
- Can run after Bug #3 fix deployed

---

### Bug #6: Location Schema Missing (LOW)
**Code expects but doesn't exist:**
- outdoor_seating (boolean)
- area_type (string)
- category_scores (jsonb)

**Impact:**
- Location-based compound opportunities disabled
- Location bonus in scoring uses generic values
- Weather + outdoor seating combinations don't trigger

**Solution:**
1. Run ADD_LOCATION_CONTEXT_COLUMNS.sql (if exists)
2. Or create migration:
   ```sql
   ALTER TABLE businesses 
   ADD COLUMN IF NOT EXISTS outdoor_seating boolean DEFAULT false,
   ADD COLUMN IF NOT EXISTS area_type text,
   ADD COLUMN IF NOT EXISTS category_scores jsonb DEFAULT '{}'::jsonb;
   ```
3. Populate from location intelligence if available

**Priority: LOW**
- Bonus feature, not core
- Fix after all critical bugs resolved

---

## 🎯 FIX STRATEGY & ORDER

### PHASE 1: Fix Data Flow (Independent Fixes)
**Goal:** Get real data flowing through pipeline

✅ **1A. Fix Bug #3 (Scoring)** - 30 minutes
- File: `menu-scorer.ts` line 159
- Change: Call scoreMenuItem() instead of hardcoding 70
- Test: LAYER_5_VERIFICATION.sql Q5-Q6
- Risk: LOW - Function already exists
- Dependencies: None

✅ **1B. Fix Bug #4 (Collision)** - 45 minutes
- File: `post-slot-optimizer.ts`
- Change: Add usedSlots Set, collision detection
- Test: LAYER_6_VERIFICATION.sql Q6-Q7
- Risk: LOW - Simple logic addition
- Dependencies: None

**Phase 1 Testing:**
- Generate new weekly plan for Café Faust
- Verify scores vary (not all 70)
- Verify no time collisions

---

### PHASE 2: Fix AI Generation (Related Fixes)
**Goal:** Make AI work consistently, enforce quality

✅ **2A. Debug Bug #9 (Template Fallback)** - 60 minutes
- File: `weekly-plan-generator.ts` line 509
- Investigation:
  1. Add detailed logging before/after AI call
  2. Check error messages for FAVORITTEN vs Pandekage
  3. Verify input data differences
- Change: Fix root cause (likely null/undefined in input)
- Test: LAYER_8_VERIFICATION.sql Q1
- Risk: MEDIUM - Need to understand WHY AI fails
- Dependencies: None, but affects #10 and #11

✅ **2B. Verify Bug #10 (Language)** - 15 minutes
- File: `generateWithGeminiFlash()` (need to locate)
- Check: Prompt includes language directive for country="DK"
- Change: If missing, add: "Respond in Danish for Danish businesses"
- Test: All captions should be Danish
- Risk: LOW - Prompt addition
- Dependencies: **REQUIRES #9 fixed first**

✅ **2C. Enforce Bug #11 (Brevity)** - 30 minutes
- File: Same as #9
- Change: Add retry logic with length validation
- Test: LAYER_8_VERIFICATION.sql Q2
- Risk: LOW - Validation wrapper
- Dependencies: **REQUIRES #9 fixed first**

✅ **2D. Fix Bug #8 (Quality Scores)** - 30 minutes
- File: `weekly-plan-generator.ts` line 538
- Investigation: Check generateWithGeminiFlash() return structure
- Change: Extract quality_score and emoji_count from result
- Test: LAYER_8_VERIFICATION.sql Q3-Q4
- Risk: LOW - Data extraction
- Dependencies: **REQUIRES #9 fixed (AI must run)**

**Phase 2 Testing:**
- Generate new weekly plan
- Verify ALL posts use AI (no templates)
- Verify ALL posts in Danish
- Verify 80%+ meet 125-200 char target
- Verify quality_score and emoji_count populated

---

### PHASE 3: Fix Visual Generation (Related Fixes)
**Goal:** Generate unique, valid visual directions

✅ **3A. Fix Bug #1 (AltText undefined)** - 45 minutes
- File: `visual-direction-generator.ts` ~280
- Investigation:
  1. Check getSettingDirection() return type
  2. Check getStylingDirection() return type
  3. Verify template variable names match
- Change: Fix template string or function returns
- Test: LAYER_7_VERIFICATION.sql Q2
- Risk: MEDIUM - Need to understand current structure
- Dependencies: None

✅ **3B. Fix Bug #2 (Visual identical)** - 60 minutes
- File: Same as #1
- Investigation:
  1. Check input data: Is locationContext populated?
  2. Check contentType values match angles keys
  3. Check seasonalContext.weather exists
- Change: Improve fallback logic, add data validation
- Test: LAYER_7_VERIFICATION.sql Q3-Q4
- Risk: MEDIUM - May reveal upstream data issues
- Dependencies: **Related to #1 (same file)**

**Phase 3 Testing:**
- Generate new weekly plan
- Verify 0% posts have "undefined" in altText
- Verify visual directions vary by content type
- Check variety in angle, setting, lighting

---

### PHASE 4: Enhancements (After Critical Fixes)
**Goal:** Improve quality and completeness

✅ **4A. Enhance Bug #7 (Production Notes)** - 90 minutes
- Add detailed shot requirements
- Add props and styling guidance
- Priority: MEDIUM

✅ **4B. Populate Bug #5 (Menu Metadata)** - 120 minutes
- Create migration script
- Populate from menu_results_v2
- Priority: MEDIUM

✅ **4C. Add Bug #6 (Location Schema)** - 60 minutes
- Add schema columns
- Populate from location data
- Priority: LOW

---

## 🛡️ RISK MITIGATION STRATEGIES

### 1. Test After Each Phase
**Don't batch fixes** - Complete phase, test, verify, then move to next

### 2. Verification Checklist Per Phase
- [ ] Run relevant LAYER_X_VERIFICATION.sql queries
- [ ] Generate new weekly plan for Café Faust
- [ ] Compare before/after results
- [ ] Check no new bugs introduced

### 3. Rollback Plan
- Keep current code in separate branch
- Document exact changes per phase
- If phase breaks something, revert and analyze

### 4. Data Validation Logging
Add detailed logging at each step:
```typescript
console.log('[DEBUG] AI Input:', {
  subject: contentSubject,
  type: contentType,
  country: country,
  brandVoice: brandVoice
})

console.log('[DEBUG] AI Output:', {
  caption: result.caption,
  length: result.caption.length,
  hasQualityScore: !!result.quality_score,
  language: detectLanguage(result.caption)
})
```

### 5. Gradual Deployment
- Phase 1: Deploy to test business only
- Phase 2: Deploy to 5 businesses, monitor
- Phase 3: Deploy to all

---

## ❓ CRITICAL QUESTIONS BEFORE FIXING

### Bug #9 (Template Fallback)
1. **What error does Gemini throw for FAVORITTEN but not Pandekage?**
   - Check actual error logs
   - Compare input data structures
   - Test uppercase vs lowercase names

2. **Is there rate limiting or quota issues?**
   - Check Gemini API quotas
   - Verify retry logic
   - Check if first 2 succeed, last 2 fail (order issue)

### Bug #8 (Quality Scores)
1. **What does generateWithGeminiFlash() actually return?**
   - Need to read full function signature
   - Check if quality_score is calculated
   - Verify emoji_count logic exists

### Bugs #1 & #2 (Visual Generation)
1. **What data reaches visual-direction-generator?**
   - Log full input object
   - Verify locationContext exists
   - Check seasonalContext.weather populated

2. **Why do fallbacks trigger for all posts?**
   - Is it missing data or wrong keys?
   - Are contentType values mismatched with angles keys?

---

## 📈 SUCCESS METRICS (Post-Fix)

### Layer 5: Opportunity Selector
- [ ] 0% of items have finalScore=70
- [ ] Scores range from 50-250+ based on factors
- [ ] Seasonal items get 40-50pt bonus
- [ ] Recently posted items get -100pt penalty

### Layer 6: Post Slot Optimizer
- [ ] 0% time collisions
- [ ] All posts have unique (day, hour) slots
- [ ] Collision detection logs when rescheduling

### Layer 7: Media Format Selector
- [ ] 0% posts with "undefined" in altText
- [ ] 80%+ posts have content-specific visual direction
- [ ] Visual directions vary by contentType
- [ ] Angle, setting, lighting all populated correctly

### Layer 8: AI Caption Generator
- [ ] 0% posts use template fallback
- [ ] 100% posts in correct language (Danish for DK)
- [ ] 80%+ posts meet 125-200 char target
- [ ] 100% posts have quality_score and emoji_count
- [ ] 0% hallucinated menu items

### Overall System Health
- [ ] Weekly plan generation completes without errors
- [ ] All 9 layers integrate successfully
- [ ] Content briefs ready for human review
- [ ] No new bugs introduced

---

## 🎬 NEXT STEPS

### Immediate (Today)
1. ✅ Complete this analysis
2. Review with user
3. Get approval to start Phase 1
4. Set up test environment for Café Faust

### Phase 1 (2-3 hours)
1. Fix Bug #3 (Scoring hardcoded)
2. Fix Bug #4 (Time collision)
3. Test: Generate new weekly plan
4. Verify: Scores vary, no collisions

### Phase 2 (3-4 hours)
1. Debug Bug #9 (Template fallback) - MOST CRITICAL
2. Fix Bug #10 (Language)
3. Fix Bug #11 (Brevity)
4. Fix Bug #8 (Quality scores)
5. Test: AI working for all posts

### Phase 3 (2-3 hours)
1. Fix Bug #1 (AltText undefined)
2. Fix Bug #2 (Visual identical)
3. Test: Visual variety and validity

### Phase 4 (Optional, 4-5 hours)
1. Enhance Bug #7 (Production notes)
2. Populate Bug #5 (Menu metadata)
3. Add Bug #6 (Location schema)

---

## 🔑 KEY INSIGHT FOR SUCCESS

**The bugs are not independent** - they cluster around 3 root causes:

1. **AI error handling** → Fixes bugs #8, #9, #10, #11 together
2. **Visual fallbacks** → Fixes bugs #1, #2 together
3. **Data flow bypass** → Fixes bugs #3, #4 independently

**Strategy: Fix clusters, not individual bugs**
- Fixing Bug #9 likely auto-fixes #10, #11, and helps #8
- Fixing Bug #1 will reveal root cause of #2
- Bugs #3, #4 are independent, can fix anytime

**This clustered approach ensures we don't create new problems** ✅

