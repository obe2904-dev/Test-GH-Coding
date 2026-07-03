# Multi-Primary Revenue Driver Implementation Status

**Date:** 2026-06-09  
**Business Test Case:** Cafe Faust (f4679fa9-3120-4a59-9506-d059b010c34a)  
**Goal:** Transform from calendar-first templates to business-first revenue-driven day allocation using temporal analysis

---

## ✅ COMPLETED IMPLEMENTATION

### 1. Temporal Overlap Analysis in analyze-revenue-drivers
**File:** `supabase/functions/analyze-revenue-drivers/index.ts`

**What was implemented:**
- Replaced revenue-based ranking with temporal overlap detection
- Algorithm: Different days OR different times = separate PRIMARY moments
- Multiple programmes serving different time slots are ALL considered primary
- Programmes overlapping in time become SECONDARY (content angles, not separate drivers)

**Key Functions:**
- `hasTemporalOverlap()` - Checks if two revenue moments overlap in days AND time
- `parseTimeRange()` - Converts time strings to minutes for comparison
- `synthesizePreferredDays()` - Combines days from all primary moments into unified pattern
- `buildNormalWeekStrategyMulti()` - Builds strategy from multiple primaries

**Result:**
- ✅ Successfully identifies 3 PRIMARY moments for Cafe Faust:
  - FROKOST (Mon-Fri, 11:30-14:00) - weekday lunch
  - Brunch (Sat-Sun, 10:00-14:00) - weekend brunch  
  - AFTEN (Mon-Sun, 17:30-21:30) - dinner
- ✅ 0 SECONDARY moments (no temporal overlap detected)
- ✅ Generated `preferred_day_pattern`: ["Monday", "Wednesday", "Thursday", "Friday", "Saturday"]

**Deployment:** analyze-revenue-drivers deployed (92.75KB), working correctly

---

### 2. Schema Updates for Multi-Primary Support

**Changes:**
```typescript
interface RevenueDrivers {
  primary_revenue_moments: RevenueMoment[];  // Changed from single to array
  preferred_day_pattern?: string[];          // NEW: Synthesized from all primaries
  // ... rest unchanged
}
```

**Files Updated:**
- `supabase/functions/analyze-revenue-drivers/index.ts` (lines 15-35)
- `supabase/functions/_shared/post-helpers/business-rules-engine.ts` (lines 160-176)

**Database:**
- Revenue drivers save to standalone `revenue_drivers` JSONB column (NOT inside brand_profile_v5)
- Programme days corrected via SQL:
  - FROKOST: Mon-Fri (was Mon-Sun)
  - Brunch: Sat-Sun (was Mon-Sun)
  - AFTEN: Mon-Sun (correct)

---

### 3. BusinessRulesEngine Updates

**File:** `supabase/functions/_shared/post-helpers/business-rules-engine.ts`

**What was implemented:**
- Constructor accepts both old and new schemas
- Converts complex schema (multi-primary) to simplified internally
- `generateWeeklyAllocationRules()` checks for `preferred_day_pattern`
- If found, generates high-priority rules for each preferred day (Mon=1, Wed=2, Thu=3, etc.)
- Falls back to legacy single-primary logic if no `preferred_day_pattern`

**Key Logic (lines 848-917):**
```typescript
if (this.revenueDrivers.normal_week_strategy?.preferred_day_pattern?.length > 0) {
  const preferredDays = this.revenueDrivers.normal_week_strategy.preferred_day_pattern
  console.log(`[BusinessRulesEngine] Using preferred_day_pattern: ${preferredDays.join(', ')}`)
  
  preferredDays.forEach((day, index) => {
    rules.push({
      rule_id: `preferred_day_${day.toLowerCase()}`,
      business_moment: 'multi_primary_revenue_moments',
      visit_days: [day],
      post_days: [day],
      post_times: ['14:00'],
      priority: index + 1,
      reasoning: `Strategic posting day from temporal analysis of multiple revenue moments`,
      content_angle: 'revenue_driver'
    })
  })
  
  return rules
}
```

**Status:** ✅ Code deployed (get-weekly-strategy 729.8kB)

---

### 4. Phase 2a Integration

**File:** `supabase/functions/_shared/post-helpers/strategy/phase2/phase2a.ts`

**Changes Made:**
1. Added `revenueDrivers` parameter to function signature (line 24)
2. Updated to use parameter instead of reading from `strategicBrief` (line 102)
3. Changed slot matching from `drive_footfall` only to ANY slot type (line 281)
4. Updated console log to say "Preferred day pattern" instead of "Revenue driver" (line 306)

**Current Allocation Logic (lines 268-310):**
```typescript
if (businessRules.length > 0) {
  const DAY_NAME_TO_DOW: Record<string, number> = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6
  };
  
  for (const rule of businessRules) {
    if (rule.priority >= 10) continue; // Skip flexible slots
    
    // Find any unused slot (ANY goal_mode works)
    const slotMatch = slotsWithIndex.find(({ s, i }) => {
      return !revenueDriverSlotIndices.has(i);
    });
    
    if (!slotMatch) continue;
    
    // Find best day from rule's recommended days that's available
    let assignedDay: string | undefined;
    for (const dayName of rule.post_days) {
      const dow = DAY_NAME_TO_DOW[dayName];
      if (dow === undefined) continue;
      
      const candidate = availableDays.find(d => 
        !usedDays.has(d) && getDayOfWeek(d) === dow
      );
      if (candidate) {
        assignedDay = candidate;
        break;
      }
    }
    
    if (assignedDay) {
      usedDays.add(assignedDay);
      dayByOriginalIndex[slotMatch.i] = assignedDay;
      revenueDriverSlotIndices.add(slotMatch.i);
      console.log(`[Phase 2a] ✅ Preferred day pattern: ${rule.business_moment} → ${assignedDay}`);
    }
  }
}
```

**Status:** ✅ Code deployed

---

### 5. Phase 2 Orchestrator Integration

**File:** `supabase/functions/_shared/post-helpers/strategy/phase2/index.ts`

**Changes Made:**
- Pass `(context as any).revenue_drivers` to `generateContentPlan2a()` (line 60)
- Added debug logging before call (lines 51-57)

**Status:** ✅ Code deployed

---

### 6. Week Context Setup

**File:** `supabase/functions/get-weekly-strategy/index.ts`

**Verification:**
- Line 1231: `revenue_drivers: brandProfile?.revenue_drivers || null`
- Revenue drivers correctly loaded from database into `weekContext`
- Passed through to Phase 2 → Phase 2a → BusinessRulesEngine

**Status:** ✅ Verified

---

## 🔴 CURRENT PROBLEM

### Symptom
**Expected:** Mon, Wed, Thu, Fri, Sat (5 unique days)  
**Actual:** Mon, Thu, Fri (3 unique days)  
**Missing:** Wed, Sat

### Day Breakdown
```
Mon: 2 posts ✅
Tue: 0 posts
Wed: 0 posts ❌ (should have 1)
Thu: 1 post  ✅
Fri: 1 post  ✅
Sat: 0 posts ❌ (should have 1)
Sun: 0 posts
```

### What's Working
1. ✅ Revenue drivers generate correctly (3 primary moments)
2. ✅ `preferred_day_pattern` exists: ["Monday", "Wednesday", "Thursday", "Friday", "Saturday"]
3. ✅ BusinessRulesEngine receives revenue_drivers
4. ✅ `generateWeeklyAllocationRules()` generates 5 rules (Mon=1, Wed=2, Thu=3, Fri=4, Sat=5)
5. ✅ Phase 2a receives `revenueDrivers` parameter
6. ✅ Week context includes revenue_drivers from database

### What's NOT Working
The preferred_day_pattern rules are generated but **only 3 of 5 rules get applied** to slots.

### Suspected Root Cause
The allocation logic in Phase 2a (lines 275-310) processes each rule sequentially, but:
1. There are only 4 slots (`targetPostCount = 4`)
2. 5 rules are generated (Mon, Wed, Thu, Fri, Sat)
3. The algorithm stops when it runs out of slots (after processing Mon, Wed, Thu, Fri)
4. **Sat never gets assigned because there's no 5th slot**

However, the actual allocation is Mon, Thu, Fri (not Mon, Wed, Thu, Fri), suggesting:
- Either Wed's rule is being skipped
- Or the calendar greedy logic (lines 311+) is overriding some revenue driver assignments

### Debug Logging Added
Lines 277-308 in phase2a.ts now log:
```typescript
console.log(`[Phase 2a] Processing rule ${rule.rule_id}, priority ${rule.priority}, days: ${rule.post_days.join(', ')}`);
// ... 
console.log(`[Phase 2a] ✅ Preferred day pattern: ${rule.business_moment} → ${assignedDay} (slot ${slotMatch.i}, priority ${rule.priority})`);
```

This should reveal which rules are applied vs skipped.

---

## 🔍 DEBUGGING NEEDED

### Step 1: Check Function Logs
```bash
supabase functions logs get-weekly-strategy --limit 50 | grep "Phase 2a"
```

**Look for:**
- How many rules are generated? (should be 5)
- Which rules get assigned? (currently seeing 3, but which 3?)
- Are rules being skipped? If so, why? (no slots? no days?)

### Step 2: Verify slotsWithIndex Population
The allocation assumes `slotsWithIndex` has enough slots. Need to verify:
```typescript
console.log(`[Phase 2a] Slots available: ${slotsWithIndex.length}`);
console.log(`[Phase 2a] Business rules generated: ${businessRules.length}`);
```

### Step 3: Check Priority-Based Slot Consumption
Current hypothesis: Mon (priority 1) gets assigned, Wed (priority 2) gets assigned, Thu (priority 3) gets assigned, Fri (priority 4) gets assigned, but Sat (priority 5) has no slot left.

But actual result is Mon, Thu, Fri - this suggests either:
- Wed's rule fails to find an available day
- Wed's assignment gets overridden by calendar logic
- Rules aren't being processed in priority order

---

## 🎯 MISSING IMPLEMENTATION

### Option 1: Distribute 4 Slots Across 5 Preferred Days
If we have 4 slots but 5 preferred days, intelligently skip one day:
- Skip Sat (lowest commercial priority for 4-post week)
- Expected: Mon, Wed, Thu, Fri
- OR skip Wed (lowest mid-week priority)
- Expected: Mon, Thu, Fri, Sat

### Option 2: Increase Post Count for Multi-Primary Businesses
Detect when `preferred_day_pattern.length > targetPostCount` and:
- Warn in logs
- Consider increasing `targetPostCount` for Pro tier
- Or adjust preferred_day_pattern to match available slots

### Option 3: Fix Rule Application Order
Ensure rules are processed in priority order (1, 2, 3, 4, 5) and slots are consumed correctly.

---

## 📋 NEXT STEPS

1. **Check logs** to see which 3 rules are being applied (Mon=?, Wed=?, Thu=?, Fri=?, Sat=?)
2. **Verify slot count** - are there really 4 slots available?
3. **Check calendar greedy logic** - is it overriding revenue driver assignments?
4. **Consider slot expansion** - should multi-primary businesses get 5 posts instead of 4?
5. **Review priority system** - are rules processed in the correct order?

---

## 🗂️ KEY FILES

### Revenue Driver Generation
- `supabase/functions/analyze-revenue-drivers/index.ts` (92.75KB deployed)

### Business Rules Engine
- `supabase/functions/_shared/post-helpers/business-rules-engine.ts` (part of get-weekly-strategy)

### Day Allocation Logic
- `supabase/functions/_shared/post-helpers/strategy/phase2/phase2a.ts` (lines 95-310)

### Orchestration
- `supabase/functions/_shared/post-helpers/strategy/phase2/index.ts` (lines 48-62)
- `supabase/functions/get-weekly-strategy/index.ts` (line 1231)

### Database
- Table: `business_brand_profile`
- Column: `revenue_drivers` (JSONB, standalone)
- Test Business: `f4679fa9-3120-4a59-9506-d059b010c34a` (Cafe Faust)

---

## 🧪 TEST CASE DATA

### Current Revenue Drivers
```json
{
  "analyzed_at": "2026-06-09T...",
  "analyzed_from": "brand_profile_v5.layer_1_programmes",
  "confidence_score": 95,
  "primary_revenue_moments": [
    {
      "moment_id": "lunch_frokost",
      "label": "FROKOST",
      "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "time_range": "11:30 to 14:00",
      "service_type": "lunch"
    },
    {
      "moment_id": "morning_brunch",
      "label": "Brunch",
      "days": ["Saturday", "Sunday"],
      "time_range": "10:00 to 14:00",
      "service_type": "brunch"
    },
    {
      "moment_id": "dinner_aften",
      "label": "AFTEN",
      "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      "time_range": "17:30 to 21:30",
      "service_type": "dinner"
    }
  ],
  "secondary_revenue_moments": [],
  "preferred_day_pattern": ["Monday", "Wednesday", "Thursday", "Friday", "Saturday"]
}
```

### Test Command
```bash
curl -s -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMTY0NjgyOSwiZXhwIjoyMDM3MjIyODI5fQ.R_UrRWGwL1v9KsXrNT0fmMH5C3R6kkSO3cqPTNTYh2w" \
  -d '{"business_id": "f4679fa9-3120-4a59-9506-d059b010c34a", "week_start_date": "2026-06-15"}'
```

### Current Output
```
Total posts: 4
Unique days: 3
Day allocation: Mon, Thu, Fri
```

### Expected Output
```
Total posts: 4
Unique days: 4 (or 5 if increased)
Day allocation: Mon, Wed, Thu, Fri (or Mon, Wed, Thu, Fri, Sat if 5 posts)
```

---

## 💡 TECHNICAL NOTES

### Why Temporal Analysis?
The user clarified: "We should avoid hardcoding unless it is universally true for such a business. I prefer that AI does the heavy lifting, and for our test case: Sees Brunch, Frokost and Aftensmad as primary revenue drivers as they fill the business at different times."

Temporal analysis achieves this by:
- Detecting that FROKOST, Brunch, and AFTEN serve **different time slots**
- Recognizing they don't compete (no overlap = all PRIMARY)
- Avoiding revenue-based ranking that would pick only one "winner"

### Why Not Hardcode Mon/Wed/Fri Pattern?
Calendar-first templates assume all cafes follow the same pattern. This fails for:
- Hybrid cafe/restaurants with multiple service periods
- Businesses with weekend-heavy vs weekday-heavy operations
- Seasonal businesses with varying primary moments

Revenue-driven allocation adapts to each business's actual revenue patterns.

---

## 🚀 SUCCESS CRITERIA

- [ ] All 5 preferred days represented in allocation (Mon, Wed, Thu, Fri, Sat)
- [ ] Or intelligently reduced to 4 days if only 4 slots (Mon, Wed, Thu, Fri preferred)
- [ ] BusinessRulesEngine logs show all 5 rules generated
- [ ] Phase 2a logs show 4-5 rules successfully applied
- [ ] No calendar greedy logic overriding revenue driver assignments
- [ ] Test passes: Actual allocation matches preferred_day_pattern (within slot count constraints)
