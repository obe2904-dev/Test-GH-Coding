# Implementation Plan: Two-Dimensional Content Framework

## Executive Summary

**Objective:** Replace the three-goal system (`drive_footfall`, `build_brand`, `retain_loyalty`) with a clearer two-dimensional framework:
- **Dimension 1 (Tactical CTA):** What action do we want THIS post to drive? (booking/footfall/brand)
- **Dimension 2 (Content Style):** How should the content tell the story? (performance_driven/brand_building/balanced)

**Why:** Loyalty in F&B is a brand outcome, not a tactical goal. Posts don't retain loyalty through CTAs—they build mental availability through consistent brand strength. This framework separates what business result we target (CTA) from how we tell the story (content strategy).

---

## Current State Analysis

### What Exists (Keep/Modify)

#### ✅ **Database Schema - MOSTLY READY**
**Location:** `business_brand_profile.content_strategy` (JSONB)

**Current Structure:**
```json
{
  "goal_blend": {
    "build_brand": 30,
    "drive_footfall": 50,
    "retain_loyalty": 20
  },
  "primary_goal": "drive_footfall",
  "content_category_weights": {
    "team_people": 15,
    "product_menu": 30,
    "behind_scenes": 25,
    "craving_visual": 30
  }
}
```

**Assessment:**
- ✅ `content_category_weights` - KEEP (already separates content distribution from goals)
- ❌ `goal_blend` - REPLACE with new two-dimensional structure
- ❌ `primary_goal` - REPLACE with `tactical_focus`
- ➕ MISSING: `tactical_capabilities`, `content_balance`, `brand_maturity`

#### ✅ **Business Operations Schema - PERFECT**
**Location:** `business_profile` + `business_operations`

**Existing Fields:**
- `business_profile.booking_url` (enables booking CTA)
- `business_operations.reservation_required` (TRUE = no footfall allowed)
- `business_operations.accepts_walk_ins` (TRUE = footfall allowed)

**Assessment:** NO CHANGES NEEDED. These determine tactical capabilities perfectly.

#### ✅ **Posts Table - 95% READY**
**Location:** `public.posts`

**Existing Strategic Fields:**
- `cta_intent` TEXT ✅ (booking/traffic/engagement/awareness)
- `goal_mode` TEXT ✅ (drive_footfall/build_brand/retain_loyalty)
- `content_type` TEXT ✅
- `content_angle` TEXT ✅
- `weekly_plan_id`, `weekly_plan_slot_date`, `slot_id` ✅
- `planner_rationale` TEXT ✅

**Missing:**
- ⚠️ `content_style` TEXT (performance_driven/brand_building/balanced)

---

### What Changes (Architecture)

#### 🔄 **Phase 0: Contextual Analysis**
**Location:** `supabase/functions/_shared/post-helpers/strategy/phase0.ts`

**Current Role:** Analyzes week context (weather, events, economic signals) → outputs `key_factors`

**Assessment:** ✅ **NO CHANGES NEEDED**
- Phase 0 provides context; doesn't make strategic decisions
- Output feeds Phase 1 for informed angle generation

---

#### 🔄 **Phase 1: Strategic Brief Generator**
**Location:** `supabase/functions/_shared/post-helpers/strategy/phase1.ts`

**Current Flow:**
1. Reads `content_strategy.goal_blend` (30% brand, 50% footfall, 20% loyalty)
2. AI generates angles with `goal_mode`, `content_category`, `cta_mode`
3. `assignSlotMetadata()` enforces goal_blend distribution
4. Slots get IDs: A, B (footfall), C (brand), D (loyalty/flexible)

**Required Changes:**

##### 1.1 Update Input Reading
**Function:** `buildFullStrategyPrompt()` + `assignSlotMetadata()`

**CURRENT:**
```typescript
const goalBlend = contentStrategy?.week_goal_blend ?? contentStrategy?.goal_blend;
// { build_brand: 30, drive_footfall: 50, retain_loyalty: 20 }
```

**NEW:**
```typescript
const tacticalFocus = contentStrategy?.tactical_focus; // "drive_bookings" | "drive_footfall"
const tacticalCapabilities = contentStrategy?.tactical_capabilities; // { booking: true, footfall: true }
const contentBalance = contentStrategy?.content_balance; // { performance_driven: 50, brand_building: 50 }
const brandMaturity = contentStrategy?.brand_maturity; // "new" | "growing" | "established" | "premium"
```

##### 1.2 Update AI Prompt Instructions
**Function:** `buildFullStrategyPrompt()`

**CURRENT PROMPT SECTION (to replace):**
```
Tildel goal_mode (4 angles): MIX footfall/brand/loyalty → brug vægtninger som guide
```

**NEW PROMPT SECTION:**
```
## TWO-DIMENSIONAL CONTENT FRAMEWORK

**DIMENSION 1: TACTICAL CTA (what action)**
Based on business capabilities:
${tacticalCapabilities.booking ? `✅ Booking: Use "booking" cta_mode for reservation-driving posts` : '❌ No booking capability'}
${tacticalCapabilities.footfall ? `✅ Footfall: Use "walk_in" cta_mode for spontaneous visit posts` : '❌ No walk-in capability'}

Tactical focus this week: ${tacticalFocus}
- If "drive_bookings" → prioritize 2 booking slots, 1 footfall, 1 brand
- If "drive_footfall" → prioritize 2 footfall slots, 1 booking, 1 brand

**DIMENSION 2: CONTENT STYLE (how we tell the story)**
Content balance target: ${contentBalance.performance_driven}% performance / ${contentBalance.brand_building}% brand

**Performance-driven posts:**
- Focus: Specific product/offer, urgency, tangible benefits
- Language: "Ny forret", "Denne uge", "Book nu"
- Visual: Hero dish, finished product, close-up food
- Goal: Drive immediate action (booking/visit)

**Brand-building posts:**
- Focus: Craft, values, team, process, origin story
- Language: Sensory, emotional, "hvordan vi laver", "vores filosofi"
- Visual: Behind-scenes, process, team, raw ingredients
- Goal: Build mental availability, emotional connection

**Balanced posts:**
- Blend product + story (e.g., "pasta-making video + book table")
- Visual: Dish in context (chef preparing, ingredient sourcing)

ALLOCATE content_style TO EACH ANGLE:
- Target: ~${Math.round(4 * contentBalance.performance_driven / 100)} performance, ~${Math.round(4 * contentBalance.brand_building / 100)} brand
- Booking slots → tend toward performance_driven
- Brand slots → tend toward brand_building
- Adjust for week context (new menu launch = more performance)
```

##### 1.3 Update Angle Output Schema
**Function:** `generateStrategicBrief()` return type

**CURRENT ANGLE SHAPE:**
```typescript
{
  slot_id: 'A' | 'B' | 'C' | 'D',
  goal_mode: 'drive_footfall' | 'build_brand' | 'retain_loyalty',
  cta_mode: 'booking' | 'walk_in' | 'engagement',
  content_category: 'product_menu' | 'behind_scenes' | ...,
  timing_window: 'Thu-Fri 14:00',
  focus: string,
  reasoning: string,
  content_direction: string
}
```

**NEW ANGLE SHAPE:**
```typescript
{
  slot_id: 'A' | 'B' | 'C' | 'D',
  goal_mode: 'drive_bookings' | 'drive_footfall' | 'build_brand',  // SIMPLIFIED
  cta_mode: 'booking' | 'walk_in' | 'engagement',
  content_style: 'performance_driven' | 'brand_building' | 'balanced',  // NEW
  content_category: 'product_menu' | 'behind_scenes' | ...,
  timing_window: 'Thu-Fri 14:00',
  focus: string,
  reasoning: string,
  content_direction: string
}
```

**Changes:**
- ❌ Remove `retain_loyalty` from goal_mode
- ➕ Add `content_style` field
- 🔄 Rename `drive_footfall` → keep as-is for tactical clarity

##### 1.4 Update Slot Assignment Logic
**Function:** `assignSlotMetadata()`

**CURRENT LOGIC:**
```typescript
// Derive slot_id from goal_mode
if (goalMode === 'drive_footfall') {
  slotId = footfallCount === 0 ? 'A' : 'B';
} else if (goalMode === 'build_brand') {
  slotId = 'C';
} else {
  slotId = 'D';  // loyalty or flexible
}
```

**NEW LOGIC:**
```typescript
// Priority-based slot assignment (from POST-PROCESS pattern)
// Sort angles by priority: booking(1) > footfall(2) > brand(4)
const priority = getSlotPriority(angle.cta_mode, angle.goal_mode);
// After sorting, assign slot_ids sequentially as A, B, C, D

function getSlotPriority(ctaMode, goalMode) {
  if (ctaMode === 'booking') return 1;
  if (ctaMode === 'walk_in' || goalMode === 'drive_footfall') return 2;
  if (goalMode === 'build_brand') return 4;
  return 5;
}
```

##### 1.5 Update Goal-Blend Enforcement
**Function:** `assignSlotMetadata()` → goal-blend validation section

**CURRENT:**
```typescript
const expectedCounts = computeSlotCounts(targetPostCount, goalBlend);
// Expected: { drive_footfall: 2, build_brand: 1, retain_loyalty: 1 }
```

**NEW:**
```typescript
const expectedDistribution = computeContentDistribution(
  targetPostCount, 
  tacticalFocus, 
  contentBalance,
  tacticalCapabilities
);
// Expected: {
//   tactical: { booking: 2, footfall: 1, brand: 1 },
//   content: { performance: 2, brand: 2 }
// }
```

---

#### 🔄 **Phase 2: Content Generation**
**Location:** `supabase/functions/_shared/post-helpers/strategy/phase2/`

**Current Flow:**
- Phase 2a (planner): Selects menu items, timing per angle
- Phase 2b (detailer): Generates post_ideas with caption, visual_direction
- Phase 2c (narrative): Writes week_summary

**Required Changes:**

##### 2.1 Update Prompt Injection
**Location:** `phase2/phase2b-detail.ts` (or equivalent detailer)

**CURRENT:**
```
For this angle:
goal_mode: ${angle.goal_mode}
content_category: ${angle.content_category}
```

**NEW:**
```
For this angle:
goal_mode: ${angle.goal_mode}
content_style: ${angle.content_style}
content_category: ${angle.content_category}

Content style guidance:
${angle.content_style === 'performance_driven' 
  ? 'Focus on specific product/offer with urgency. Visual: hero dish.'
  : angle.content_style === 'brand_building'
    ? 'Focus on craft/values/process. Visual: behind-scenes, team.'
    : 'Blend product + story. Visual: dish in context.'}
```

##### 2.2 Template Selection Logic
**Function:** Caption generation template routing

**CURRENT:** Routes by `content_category` only

**NEW:** Routes by `content_style` first, then `content_category`

**Example:**
```typescript
function selectCaptionTemplate(angle) {
  if (angle.content_style === 'performance_driven') {
    // Use templates with product focus, urgency, CTA
    return PERFORMANCE_TEMPLATES[angle.content_category];
  } else if (angle.content_style === 'brand_building') {
    // Use templates with storytelling, craft, values
    return BRAND_TEMPLATES[angle.content_category];
  } else {
    // Balanced: mix template elements
    return BALANCED_TEMPLATES[angle.content_category];
  }
}
```

---

#### 🔄 **POST-PROCESS: Enforcement & Day Assignment**
**Location:** `supabase/functions/get-weekly-strategy/index.ts` (lines 2037-2100)

**Current Flow:**
1. Sort angles by priority (booking > footfall > brand)
2. Reassign slot_ids as A, B, C, D based on priority
3. Remap post_ideas.slot_id using oldToNewSlotMap
4. ✅ **BUG FIXED:** Sort post_ideas by slot_id before day assignment
5. Assign unique days with Set-based exclusion

**Required Changes:**

##### POST-1: Update Priority Function
**Function:** `getSlotPriority()`

**CURRENT:**
```typescript
function getSlotPriority(ctaMode, goalMode) {
  if (ctaMode === 'booking') return 1;
  if (ctaMode === 'walk_in') return 2;
  if (goalMode === 'retain_loyalty') return 3;  // REMOVE
  if (goalMode === 'build_brand') return 4;
  return 5;
}
```

**NEW:**
```typescript
function getSlotPriority(ctaMode, goalMode) {
  if (ctaMode === 'booking') return 1;
  if (ctaMode === 'walk_in' || goalMode === 'drive_footfall') return 2;
  if (goalMode === 'build_brand') return 4;
  return 5;
}
```

##### POST-2: Update Week Summary Rebuild
**Function:** `rebuildWeekSummarySentence()`

**CURRENT:**
```typescript
for (const a of angles) {
  if (a.cta_mode === 'booking') counts.booking++;
  else if (a.goal_mode === 'drive_footfall') counts.walk_in++;
  else if (a.goal_mode === 'build_brand') counts.build_brand++;
  else if (a.goal_mode === 'retain_loyalty') counts.retain_loyalty++;  // REMOVE
}
```

**NEW:**
```typescript
for (const a of angles) {
  if (a.cta_mode === 'booking') counts.booking++;
  else if (a.cta_mode === 'walk_in' || a.goal_mode === 'drive_footfall') counts.walk_in++;
  else if (a.goal_mode === 'build_brand') counts.build_brand++;
}

// Also count content_style distribution
const styleDistribution = {
  performance: angles.filter(a => a.content_style === 'performance_driven').length,
  brand: angles.filter(a => a.content_style === 'brand_building').length,
  balanced: angles.filter(a => a.content_style === 'balanced').length
};
```

---

## Database Migration Plan

### Migration 1: Update business_brand_profile.content_strategy

**File:** `supabase/migrations/YYYYMMDD_two_dimensional_framework.sql`

```sql
-- Add comment explaining new structure
COMMENT ON COLUMN business_brand_profile.content_strategy IS 
'Two-dimensional content framework:
{
  "tactical_capabilities": { "booking": bool, "footfall": bool },
  "tactical_focus": "drive_bookings" | "drive_footfall",
  "content_balance": { "performance_driven": 0-100, "brand_building": 0-100 },
  "brand_maturity": "new" | "growing" | "established" | "premium",
  "market_position": "leader" | "challenger" | "specialist",
  "content_category_weights": { ... existing ... }
}';

-- Data migration: Convert existing goal_blend to new structure
-- NOTE: This is illustrative - actual migration needs business logic
UPDATE business_brand_profile
SET content_strategy = jsonb_set(
  jsonb_set(
    jsonb_set(
      content_strategy,
      '{tactical_capabilities}',
      jsonb_build_object(
        'booking', EXISTS(SELECT 1 FROM businesses WHERE id = business_brand_profile.business_id AND booking_url IS NOT NULL),
        'footfall', TRUE  -- Assume all can accept footfall unless proven otherwise
      )
    ),
    '{tactical_focus}',
    CASE 
      WHEN (content_strategy->'goal_blend'->>'drive_footfall')::int > (content_strategy->'goal_blend'->>'build_brand')::int 
      THEN '"drive_footfall"'::jsonb
      ELSE '"drive_bookings"'::jsonb
    END
  ),
  '{content_balance}',
  jsonb_build_object(
    'performance_driven', 50,  -- Default 50/50 split
    'brand_building', 50
  )
)
WHERE content_strategy IS NOT NULL 
  AND content_strategy ? 'goal_blend';

-- Keep old goal_blend temporarily for rollback safety
-- Remove in later migration after validation
```

### Migration 2: Add content_style to posts table

```sql
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS content_style TEXT 
CHECK (content_style IS NULL OR content_style IN ('performance_driven', 'brand_building', 'balanced'));

COMMENT ON COLUMN public.posts.content_style IS 
'Content strategy dimension: performance_driven (product focus, urgency), brand_building (craft, values, team), or balanced (hybrid)';

CREATE INDEX IF NOT EXISTS idx_posts_content_style 
ON public.posts(business_id, content_style) 
WHERE content_style IS NOT NULL;
```

### Migration 3: Update TypeScript Types

**File:** `supabase/functions/_shared/post-helpers/types/strategy-types.ts`

```typescript
export type GoalMode = 'drive_bookings' | 'drive_footfall' | 'build_brand';
// Removed: 'retain_loyalty'

export type ContentStyle = 'performance_driven' | 'brand_building' | 'balanced';

export interface ContentStrategy {
  tactical_capabilities: {
    booking: boolean;
    footfall: boolean;
  };
  tactical_focus: 'drive_bookings' | 'drive_footfall';
  content_balance: {
    performance_driven: number;  // 0-100
    brand_building: number;       // 0-100
  };
  brand_maturity?: 'new' | 'growing' | 'established' | 'premium';
  market_position?: 'leader' | 'challenger' | 'specialist';
  content_category_weights: {
    team_people: number;
    product_menu: number;
    behind_scenes: number;
    craving_visual: number;
  };
  // Legacy - keep for rollback
  goal_blend?: {
    build_brand: number;
    drive_footfall: number;
    retain_loyalty: number;
  };
}

export interface StrategicAngle {
  slot_id: 'A' | 'B' | 'C' | 'D';
  goal_mode: GoalMode;
  cta_mode: 'booking' | 'walk_in' | 'engagement' | 'hybrid';
  content_style: ContentStyle;  // NEW
  content_category: ContentCategory;
  timing_window: string;
  focus: string;
  reasoning: string;
  content_direction: string;
  menu_alignment?: string;
  weight: number;
  phase0_factors_used: string[];
}
```

---

## UI Changes

### WeeklyPlanOverview.tsx
**Status:** ✅ NO CHANGES - Already uses `cta_intent` from POST-PROCESS

**Reason:** UI displays CTA badge from deterministic field, unaffected by goal_mode changes

### PostDetailModal.tsx  
**Status:** ✅ NO CHANGES - Already uses `cta_intent` from POST-PROCESS

**Optional Enhancement:**
```tsx
{/* NEW: Show content style badge */}
{post.strategicContext.content_style && (
  <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-800">
    {post.strategicContext.content_style === 'performance_driven' ? '🎯 Performance' :
     post.strategicContext.content_style === 'brand_building' ? '🎨 Brand' :
     '⚖️ Balanced'}
  </span>
)}
```

---

## Testing Strategy

### 1. Database Migration Testing
```sql
-- Test 1: Verify tactical_capabilities derived correctly
SELECT 
  bp.business_id,
  b.booking_url IS NOT NULL as has_booking_url,
  bp.content_strategy->'tactical_capabilities'->>'booking' as tactical_booking,
  bp.content_strategy->'tactical_capabilities'->>'footfall' as tactical_footfall
FROM business_brand_profile bp
JOIN businesses b ON b.id = bp.business_id
LIMIT 10;

-- Test 2: Verify content_balance defaults
SELECT 
  business_id,
  content_strategy->'content_balance'->>'performance_driven' as perf,
  content_strategy->'content_balance'->>'brand_building' as brand
FROM business_brand_profile
WHERE content_strategy ? 'content_balance'
LIMIT 10;
```

### 2. Phase 1 Output Validation
**Test:** Generate weekly strategy for test business

**Expected Output:**
```json
{
  "angles": [
    {
      "slot_id": "A",
      "goal_mode": "drive_bookings",
      "cta_mode": "booking",
      "content_style": "performance_driven",
      "focus": "Weekend brunch bookinger"
    },
    {
      "slot_id": "B",
      "goal_mode": "drive_footfall",
      "cta_mode": "walk_in",
      "content_style": "balanced",
      "focus": "Dagens frokost"
    },
    {
      "slot_id": "C",
      "goal_mode": "build_brand",
      "cta_mode": "engagement",
      "content_style": "brand_building",
      "focus": "Køkkenhåndværk"
    },
    {
      "slot_id": "D",
      "goal_mode": "build_brand",
      "cta_mode": "engagement",
      "content_style": "performance_driven",
      "focus": "Ny forret denne uge"
    }
  ]
}
```

**Validation Checks:**
- ✅ No `retain_loyalty` in goal_mode
- ✅ All angles have `content_style` field
- ✅ Content style distribution ≈ content_balance target
- ✅ Booking slots tend toward performance_driven
- ✅ Brand slots tend toward brand_building

### 3. POST-PROCESS Priority Testing
```typescript
// Test case: Verify slot priority order
const testAngles = [
  { cta_mode: 'engagement', goal_mode: 'build_brand' },  // Should be C or D
  { cta_mode: 'booking', goal_mode: 'drive_bookings' },  // Should be A
  { cta_mode: 'walk_in', goal_mode: 'drive_footfall' }, // Should be B
  { cta_mode: 'engagement', goal_mode: 'build_brand' }  // Should be C or D
];

const sorted = testAngles
  .map((a, idx) => ({ ...a, originalIdx: idx }))
  .sort((a, b) => getSlotPriority(a.cta_mode, a.goal_mode) - getSlotPriority(b.cta_mode, b.goal_mode));

// Expected order: [1 (booking), 2 (walk_in), 0 (brand), 3 (brand)]
// Slot IDs after assignment: A, B, C, D
```

### 4. End-to-End Weekly Plan Generation
**Business:** Café Faust (test business ID: `8da404df-2654-4bfe-b118-24016d9b17f2`)

**Test Steps:**
1. Update test business content_strategy with new framework
2. Trigger weekly strategy generation
3. Verify POST-PROCESS logs show priority sorting
4. Verify post_ideas sorted before day assignment
5. Verify no day collisions
6. Verify UI displays correct CTA badges
7. Verify content reflects content_style (performance vs brand tone)

---

## Rollback Plan

### Phase 1: Keep Legacy Fields
**Duration:** 2-4 weeks after deployment

**Strategy:**
- Keep `goal_blend` in database alongside new structure
- Keep `retain_loyalty` in TypeScript types (deprecated)
- Phase 1 AI reads both old and new structure (new takes precedence)
- POST-PROCESS writes both old and new fields to angles

### Phase 2: Deprecation Warnings
**Duration:** 2 weeks

**Strategy:**
- Log warnings when old fields used
- Monitor usage metrics
- Communicate deprecation to team

### Phase 3: Removal
**After:** 4 weeks + zero old field usage

**Actions:**
- Remove `goal_blend` from database
- Remove `retain_loyalty` from types
- Remove legacy field handling from code
- Run final migration to clean up data

---

## Success Metrics

### Technical Metrics
- ✅ Zero day collisions in weekly plans
- ✅ 100% of angles have `content_style` field
- ✅ Content style distribution within ±1 of target
- ✅ Priority sorting produces deterministic slot order
- ✅ All posts saved with `content_style` in database

### Content Quality Metrics
- 📊 Performance-driven posts have higher CTR (Click-Through Rate)
- 📊 Brand-building posts have higher save/share rate
- 📊 Balanced content balance correlates with higher repeat visit rate
- 📊 Posts with `content_style` alignment score higher in manual review

### Business Metrics
- 📈 Businesses with balanced strategy show more consistent weekly engagement
- 📈 Booking-focused weeks drive measurable reservation increases
- 📈 Brand-building content improves follower growth rate

---

## Implementation Sequence

### Week 1: Database & Types
- [ ] Migration 1: Update `business_brand_profile.content_strategy` schema
- [ ] Migration 2: Add `content_style` to `posts` table
- [ ] Migration 3: Update TypeScript types
- [ ] Migration 4: Backfill test business with new structure
- [ ] Test: Verify schema changes work correctly

### Week 2: Phase 1 Updates
- [ ] Update `buildFullStrategyPrompt()` to read new fields
- [ ] Update prompt instructions for two-dimensional framework
- [ ] Update `assignSlotMetadata()` for priority-based assignment
- [ ] Update goal-blend enforcement logic
- [ ] Test: Generate strategy for test business, verify output

### Week 3: Phase 2 & POST-PROCESS
- [ ] Update Phase 2b prompt injection with `content_style`
- [ ] Add template selection logic based on `content_style`
- [ ] Update `getSlotPriority()` to remove `retain_loyalty`
- [ ] Update `rebuildWeekSummarySentence()` for new structure
- [ ] Test: Full weekly plan generation end-to-end

### Week 4: Validation & Rollout
- [ ] Deploy to staging environment
- [ ] Run end-to-end tests with multiple businesses
- [ ] Validate content quality manually
- [ ] Deploy to production (gradual rollout)
- [ ] Monitor logs for errors/warnings
- [ ] Collect initial metrics

### Week 5-8: Monitoring & Iteration
- [ ] Monitor technical metrics
- [ ] Review content quality samples
- [ ] Gather business feedback
- [ ] Iterate on prompt instructions if needed
- [ ] Plan legacy field removal

---

## Risk Mitigation

### Risk 1: AI Doesn't Follow New Instructions
**Likelihood:** Medium  
**Impact:** High  

**Mitigation:**
- Add explicit examples in prompt
- Use JSON schema validation for output
- Add fallback logic in `assignSlotMetadata()`
- Monitor and log when AI deviates from instructions

### Risk 2: Content Style Distribution Skewed
**Likelihood:** Medium  
**Impact:** Medium  

**Mitigation:**
- Add distribution validation in POST-PROCESS
- Auto-correct if >±2 posts off target
- Log warnings for manual review
- Iterate prompt instructions based on patterns

### Risk 3: Existing Businesses Broken by Migration
**Likelihood:** Low  
**Impact:** High  

**Mitigation:**
- Keep legacy fields during transition
- Gradual rollout (10% → 50% → 100%)
- Rollback script ready
- Monitor error rates closely

### Risk 4: UI Shows Inconsistent Labels
**Likelihood:** Low  
**Impact:** Medium  

**Mitigation:**
- UI already uses deterministic `cta_intent` field
- No UI changes required for core functionality
- Optional content_style badge is additive, not breaking

---

## File Checklist

### Files to Modify
- [ ] `supabase/migrations/YYYYMMDD_two_dimensional_framework.sql`
- [ ] `supabase/migrations/YYYYMMDD_add_content_style_to_posts.sql`
- [ ] `supabase/functions/_shared/post-helpers/types/strategy-types.ts`
- [ ] `supabase/functions/_shared/post-helpers/strategy/phase1.ts`
- [ ] `supabase/functions/_shared/post-helpers/strategy/phase2/phase2b-detail.ts`
- [ ] `supabase/functions/get-weekly-strategy/index.ts` (POST-PROCESS)
- [ ] `supabase/functions/get-weekly-strategy/context-interpreters.ts` (if goal_blend refs)

### Files to Review (No Changes Expected)
- [ ] `src/components/weekly-plan/WeeklyPlanOverview.tsx` (already correct)
- [ ] `src/components/weekly-plan/PostDetailModal.tsx` (already correct)
- [ ] `supabase/functions/_shared/post-helpers/strategy/phase0.ts` (context only)

### New Files to Create
- [ ] `supabase/functions/_shared/post-helpers/strategy/content-style-allocator.ts` (helper)
- [ ] `supabase/functions/_shared/post-helpers/strategy/tactical-capability-detector.ts` (helper)

---

## Notes for Implementation

### Important Context from Conversation
1. **Day Collision Bug Fixed:** POST-PROCESS now sorts `post_ideas` by `slot_id` after remapping (deployed)
2. **UI Already Correct:** WeeklyPlanOverview and PostDetailModal use `cta_intent` from POST-PROCESS, not AI fields
3. **Priority System Works:** Booking > Footfall > Brand priority produces deterministic slot order
4. **Content Strategy Vision:** Retention is an outcome of brand strength, not a tactical goal to assign weekly

### AI Prompt Engineering Tips
1. Use **explicit examples** in prompts for each content_style
2. Use **JSON schema** with `content_style` as required field
3. Add **validation section** in prompt: "Verify content_style distribution matches target"
4. Include **week context adjustment**: "New menu launch this week → +1 performance post"

### Testing Priority
1. **Critical:** No day collisions, all angles have content_style
2. **High:** Content style distribution within tolerance
3. **Medium:** Content quality reflects style (manual review)
4. **Low:** UI enhancements (badges)

---

**READY FOR IMPLEMENTATION** ✅

This plan can be followed step-by-step to implement the two-dimensional content framework without breaking existing functionality. All critical code locations identified, migration strategy defined, and rollback plan in place.
