# Goal-Blend Slot Distribution Analysis

**Date**: 2026-07-02  
**Status**: ✅ Mostly Implemented — Minor Adjustment Needed for Flexible Slot  

---

## 🔍 **Current Implementation Status**

### ✅ What's Already Working

**1. `content_strategy.goal_blend` IS being used** (phase1.ts L1468-1481)
```typescript
const contentStrategy = (context.brand_voice as any)?.content_strategy;
const goalBlend = contentStrategy?.week_goal_blend ?? contentStrategy?.goal_blend;

if (goalBlend) {
  const expectedCounts = computeSlotCounts(targetPostCount, goalBlend);
  console.log(`Expected composition (from goal_blend): ${expectedCounts.drive_footfall} footfall, ${expectedCounts.build_brand} brand`);
  // Enforces goal_blend by reassigning angles if AI output doesn't match
}
```

**2. `computeSlotCounts` function exists** (phase1.ts L1275-1333)
- Normalizes goal_blend percentages
- Computes slot distribution
- Handles remainder posts with **footfall priority**

**3. `cta_mode` already distinguishes walk-in vs booking** (phase1.ts L1453-1462)
```typescript
const bm = (context as any).booking_model;
const fallbackCtaMode = bm?.reservation_required
  ? 'booking'
  : (bm?.accepts_walk_ins && bm?.has_booking_link)
    ? 'hybrid'
    : bm?.accepts_walk_ins
      ? 'walk_in'
      : 'booking';
```

So `business_operations.reservation_required` and `accepts_walk_ins` ARE being used! ✅

---

## 📊 **Your Example: goal_blend {drive_footfall: 65, build_brand: 35}**

### Current Behavior (computeSlotCounts)

**Input**: 4 slots, 65% footfall, 35% brand

**Step 1 - Raw calculation**:
- drive_footfall: 65% × 4 = 2.6 slots
- build_brand: 35% × 4 = 1.4 slots

**Step 2 - Floor**:
- drive_footfall: floor(2.6) = 2
- build_brand: floor(1.4) = 1
- Remainder: 1 slot left

**Step 3 - Distribute remainder** (L1307-1317):
```typescript
const remainders = {
  drive_footfall: 0.6,  // (2.6 - 2)
  build_brand: 0.4      // (1.4 - 1)
};

// FOOTFALL PRIORITY: If remainders are within 0.05, footfall wins
const footfallWins = 0.6 >= 0.4 - 0.05;  // true
counts.drive_footfall++;  // 2 → 3
```

**Current Output**: 3 footfall, 1 brand

---

## 🎯 **Your Proposed Behavior**

**Proposed Output**: 2 footfall, 1 brand, **1 FLEXIBLE** (AI decides based on the week)

### Why This Makes Sense

**Advantages**:
1. ✅ **Weekly adaptability** — AI can respond to seasonal shifts, weather, news
2. ✅ **Honors brand strategy** — 2:1 ratio maintained as floor
3. ✅ **Strategic flexibility** — Remainder slot not rigidly assigned
4. ✅ **Contextual intelligence** — AI sees weekly context (summer = more craving visuals, winter = more cozy behind-scenes)

**Example scenarios where flexible slot adds value**:
- **Summer week + heatwave** → Use flexible slot for craving_visual (ice cream, cold drinks)
- **New signature dish launch** → Use flexible slot for product_menu (drive footfall)
- **Cultural event week** → Use flexible slot for behind_scenes (build brand, storytelling)
- **Slow week** → Use flexible slot for drive_footfall (boost walk-ins)

---

## 🔧 **What Needs to Change**

### Current Code Issue

The `computeSlotCounts` function **deterministically assigns the remainder** with footfall priority (L1307-1317).

Your example (65/35 split) would currently produce:
- ❌ 3 footfall, 1 brand (remainder → footfall)

You want:
- ✅ 2 footfall, 1 brand, 1 flexible

### Proposed Fix

**Option 1: Return remainder count separately**
```typescript
function computeSlotCounts(
  targetPostCount: number,
  goalBlend: { drive_footfall?: number; build_brand?: number }
): { 
  drive_footfall: number; 
  build_brand: number;
  flexible: number;  // NEW
} {
  // ... existing normalization logic ...
  
  // Floor all
  const counts = {
    drive_footfall: Math.floor(raw.drive_footfall),
    build_brand: Math.floor(raw.build_brand),
  };
  
  // Calculate remainder but DON'T assign it
  const flexible = targetPostCount - counts.drive_footfall - counts.build_brand;
  
  // FLOOR RULE: minimum 1 footfall
  if (targetPostCount >= 3 && counts.drive_footfall === 0) {
    counts.drive_footfall = 1;
    counts.build_brand = Math.max(0, counts.build_brand - 1);
  }
  
  return {
    drive_footfall: counts.drive_footfall,
    build_brand: counts.build_brand,
    flexible: flexible
  };
}
```

**Option 2: Add flexible slot flag to Phase 1 output**
```typescript
// For each angle, mark if it's a "flexible" slot
return { 
  ...angle, 
  slot_id: slotId, 
  goal_mode: goalMode,
  is_flexible: flexibleSlotIndex.has(i)  // NEW
};
```

---

## 🧪 **Test Cases**

### Test Case 1: Your Example (65/35)
**Input**: 4 slots, {drive_footfall: 65, build_brand: 35}  
**Current**: 3 footfall, 1 brand  
**Proposed**: 2 footfall, 1 brand, 1 flexible  

### Test Case 2: Luxury Restaurant (30/70)
**Input**: 4 slots, {drive_footfall: 30, build_brand: 70}  
**Current**: 2 footfall (floor rule), 2 brand  
**Proposed**: 1 footfall (floor rule), 2 brand, 1 flexible  

### Test Case 3: High-Volume Café (80/20)
**Input**: 4 slots, {drive_footfall: 80, build_brand: 20}  
**Current**: 4 footfall, 0 brand  
**Proposed**: 3 footfall, 0 brand, 1 flexible  

### Test Case 4: Perfect Split (50/50)
**Input**: 4 slots, {drive_footfall: 50, build_brand: 50}  
**Current**: 3 footfall (tie → footfall priority), 1 brand  
**Proposed**: 2 footfall, 2 brand, 0 flexible  

---

## ❓ **Open Questions**

### Q1: How should flexible slots be assigned?
**Option A**: AI decides goal_mode during Phase 1 strategic brief generation (current behavior, just don't override it)  
**Option B**: Defer to Phase 2b based on weekly context (weather, events, etc.)  
**Option C**: Mark slot as "flexible" and let Phase 2a ideas competition decide  

**Recommendation**: Option A (simplest, already works)

### Q2: Should flexible count be visible to AI?
**Example prompt addition**:
```
You have 4 slots this week:
- 2 MUST be drive_footfall (walking visits/bookings)
- 1 MUST be build_brand (brand storytelling)
- 1 is FLEXIBLE (you decide based on weekly context)
```

**Recommendation**: Yes — helps AI understand strategic constraints

### Q3: Should remainder always go to flexible, or only when > 0.3?
**Example**: If remainder is 0.1 (negligible), maybe just assign to primary goal?

**Recommendation**: Threshold approach (if remainder > 0.3, make it flexible)

---

## ✅ **Implementation Path**

### Immediate (this solves the hardcoding issue!)

**Step 1**: Modify `computeSlotCounts` to return flexible count
- Change return type to include `flexible: number`
- Remove remainder assignment logic (L1307-1317)
- Keep floor rule (minimum 1 footfall)

**Step 2**: Update goal-blend enforcement to respect flexible slots
- Don't enforce strict match if flexible slots exist
- Allow AI's goal_mode for flexible positions

**Step 3**: Update Phase 1 prompt to communicate slot distribution
- "You have 2 footfall slots, 1 brand slot, 1 flexible slot"
- Let AI decide goal_mode for flexible slot based on weekly context

**Effort**: 1-2 hours  
**Risk**: Low (simplifies code, removes deterministic assignment)  
**Impact**: Solves hardcoding issue + adds strategic flexibility

---

## 🎯 **Answer to Your Question**

> "Does this make sense?"

**YES!** And it's even better than expected:

1. ✅ **goal_blend IS already implemented** (phase1.ts uses it)
2. ✅ **walk_in vs booking distinction EXISTS** (cta_mode from booking_model)
3. ✅ **Small fix needed** — just return remainder as "flexible" instead of auto-assigning

**Your proposed approach**:
- Uses existing content_strategy data ✅
- Honors brand strategy (floor values) ✅
- Adds weekly flexibility (remainder slots) ✅
- Simpler than full slot refactor ✅

**This is Path A LITE** — you already had the architecture, just need to unlock the flexible slot behavior!

---

## 💡 **Recommendation**

**Do this FIRST** (1-2 hours):
1. Fix `computeSlotCounts` to return flexible count
2. Update goal-blend enforcement to allow AI decision for flexible slots
3. Test with your 65/35 example

**THEN** (2-3 hours):
4. Implement menu intelligence enhancement (8 new extraction patterns for C/D slots)

**Result**: Both issues solved in 3-5 hours total, low risk, incremental changes.

Ready to proceed? 🚀
