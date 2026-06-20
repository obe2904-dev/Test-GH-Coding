# Step 3: Phase 1 Integration - COMPLETE ✅

**Date:** 2026-06-07  
**Status:** Business Rules Engine integrated into Phase 1  

---

## ✅ What Was Implemented

### Changes Made

1. **Updated phase1.ts**
   - Imported `generateSlotsFromRevenueDrivers` from business-rules-engine.ts
   - Renamed `BASE_SLOTS` → `BASE_SLOTS_FALLBACK` (kept as fallback only)
   - Updated `assignSlotMetadata()` to use revenue-driven slots
   - Added logging to show when Business Rules Engine is active

2. **Updated strategy-types.ts**
   - Added `revenue_drivers` field to `WeekContext` interface
   - Includes confidence_score, analyzed_from, and strategy data

3. **Updated get-weekly-strategy/index.ts**
   - Added `revenue_drivers` to brand_profile SELECT query
   - Added `revenue_drivers` to context object
   - Now fetched and passed to Phase 1 automatically

---

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────────┐
│  1. analyze-revenue-drivers Edge Function               │
│     Analyzes brand_profile_v5.layer_1_programmes        │
│     Stores in business_brand_profile.revenue_drivers    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  2. get-weekly-strategy fetches revenue_drivers         │
│     SELECT query includes revenue_drivers               │
│     Added to WeekContext object                         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  3. Phase 1 (assignSlotMetadata)                        │
│     Calls generateSlotsFromRevenueDrivers()             │
│     Uses data-driven slots instead of BASE_SLOTS        │
│     Falls back to BASE_SLOTS_FALLBACK if no data        │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  4. Phase 2a uses slot metadata                         │
│     slot_id, goal_mode, content_category, timing_window │
│     All derived from actual revenue patterns            │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 Code Changes Summary

### 1. phase1.ts (Line ~30)

**Before:**
```typescript
import type { ActivationEngineOutput } from '../types/activation-types.ts';
import { silentSpellingCorrection } from './infrastructure.ts';
```

**After:**
```typescript
import type { ActivationEngineOutput } from '../types/activation-types.ts';
import { silentSpellingCorrection } from './infrastructure.ts';
import { generateSlotsFromRevenueDrivers } from '../business-rules-engine.ts';
```

---

### 2. phase1.ts (Line ~730)

**Before:**
```typescript
const BASE_SLOTS: SlotTemplate[] = [
  { slot_id: 'A', goal_mode: 'drive_footfall', content_category: 'product_menu',   timing_window: 'Fri-Sat 14:00' },
  { slot_id: 'B', goal_mode: 'drive_footfall', content_category: 'product_menu',   timing_window: 'Wed-Thu 11:00' },
  { slot_id: 'C', goal_mode: 'build_brand',    content_category: 'behind_scenes',  timing_window: 'Mon 09:00' },
  { slot_id: 'D', goal_mode: 'retain_loyalty', content_category: 'craving_visual', timing_window: 'any' },
];
```

**After:**
```typescript
/**
 * Legacy BASE_SLOTS - kept as fallback when revenue_drivers unavailable
 * See business-rules-engine.ts for data-driven slot generation
 */
const BASE_SLOTS_FALLBACK: SlotTemplate[] = [
  { slot_id: 'A', goal_mode: 'drive_footfall', content_category: 'product_menu',   timing_window: 'Fri-Sat 14:00' },
  { slot_id: 'B', goal_mode: 'drive_footfall', content_category: 'product_menu',   timing_window: 'Wed-Thu 11:00' },
  { slot_id: 'C', goal_mode: 'build_brand',    content_category: 'behind_scenes',  timing_window: 'Mon 09:00' },
  { slot_id: 'D', goal_mode: 'retain_loyalty', content_category: 'craving_visual', timing_window: 'any' },
];
```

---

### 3. phase1.ts (Line ~927)

**Before:**
```typescript
    // Fallback: BASE_SLOTS ordered by index
    const fallback = BASE_SLOTS[idx % BASE_SLOTS.length];
    const goalMode:        GoalMode        = occasionGoalMode  ?? aiGoalMode  ?? fallback.goal_mode;
    const contentCategory: ContentCategory = occasionContentCat ?? aiContentCat ?? fallback.content_category;
    const timingWindow:    string          = occasionTiming ?? aiTimingWindow ?? fallback.timing_window;
```

**After:**
```typescript
    // Fallback: Revenue-driven slots (or BASE_SLOTS if revenue_drivers unavailable)
    const revenueDrivers = (context as any).revenue_drivers;
    if (idx === 0) {
      // Log once per week (not per angle)
      if (revenueDrivers) {
        console.log(`[Phase 1] Using Business Rules Engine (${revenueDrivers.analyzed_from}, confidence ${revenueDrivers.confidence_score}%)`);
      } else {
        console.log('[Phase 1] No revenue_drivers found, using BASE_SLOTS_FALLBACK');
      }
    }
    const slots = revenueDrivers 
      ? generateSlotsFromRevenueDrivers(revenueDrivers)
      : BASE_SLOTS_FALLBACK;
    const fallback = slots[idx % slots.length];
    
    const goalMode:        GoalMode        = occasionGoalMode  ?? aiGoalMode  ?? fallback.goal_mode;
    const contentCategory: ContentCategory = occasionContentCat ?? aiContentCat ?? fallback.content_category;
    const timingWindow:    string          = occasionTiming ?? aiTimingWindow ?? fallback.timing_window;
```

---

### 4. strategy-types.ts (Line ~447)

**Added:**
```typescript
  /**
   * Revenue drivers from business_brand_profile.revenue_drivers
   * Analyzed by analyze-revenue-drivers Edge Function
   * Used by Business Rules Engine to generate intelligent slot allocation
   * Confidence score 90-100 when from structured programme data
   */
  revenue_drivers?: {
    analyzed_at: string;
    analyzed_from: string;
    confidence_score: number;
    primary_revenue_moment: any;
    secondary_revenue_moments: any[];
    normal_week_strategy: any;
  };
```

---

### 5. get-weekly-strategy/index.ts (Line ~254)

**Before:**
```typescript
      dataClient
        .from('business_brand_profile')
        .select(`
          brand_essence,
          brand_essence_elaboration,
          core_offerings,
          ...
          target_type_mix
        `)
```

**After:**
```typescript
      dataClient
        .from('business_brand_profile')
        .select(`
          brand_essence,
          brand_essence_elaboration,
          core_offerings,
          ...
          target_type_mix,
          revenue_drivers
        `)
```

---

### 6. get-weekly-strategy/index.ts (Line ~1258)

**Before:**
```typescript
      // REAL: Previous week from weekly_content_plans (Step 6)
      previous_week: previousWeek,
    };
```

**After:**
```typescript
      // REAL: Previous week from weekly_content_plans (Step 6)
      previous_week: previousWeek,
      
      // Revenue drivers from business_brand_profile (for Business Rules Engine)
      revenue_drivers: brandProfile?.revenue_drivers || null,
    };
```

---

## 🧪 Testing

### Expected Console Logs

When generating a weekly plan for Cafe Faust, you should see:

```
[Phase 1] Using Business Rules Engine (brand_profile_v5.layer_1_programmes, confidence 95%)
[Business Rules Engine] Generating slots from revenue drivers
  Primary: lunch_frokost
  Secondary count: 2
  Confidence: 95%
  Source: brand_profile_v5.layer_1_programmes
[Business Rules Engine] Generated slots: A(drive_footfall/product_menu): same_day 08:00-10:00, B(drive_footfall/product_menu): Thursday 14:00, C(build_brand/behind_scenes): Monday 09:00, D(retain_loyalty/craving_visual): Wednesday 11:00
```

### For Businesses Without revenue_drivers

```
[Phase 1] No revenue_drivers found, using BASE_SLOTS_FALLBACK
[Business Rules Engine] Using hardcoded BASE_SLOTS fallback
```

---

## ✅ Verification Checklist

- [x] Import statement added to phase1.ts
- [x] BASE_SLOTS renamed to BASE_SLOTS_FALLBACK
- [x] generateSlotsFromRevenueDrivers() called in assignSlotMetadata
- [x] revenue_drivers added to WeekContext interface
- [x] revenue_drivers added to brand_profile SELECT query
- [x] revenue_drivers added to context object
- [x] Logging added to show which system is active
- [x] TypeScript errors checked (none found)

---

## 🎯 Impact

### For Cafe Faust

**OLD System (BASE_SLOTS):**
- Slot A: Fri-Sat 14:00 → Generic weekend timing
- Slot B: Wed-Thu 11:00 → Generic mid-week timing
- Slot C: Mon 09:00 → Same for all businesses
- Slot D: any → No specific guidance

**NEW System (Revenue-Driven):**
- Slot A: **same_day 08:00-10:00** → Matches lunch decision window ✅
- Slot B: **Thursday 14:00** → Captures weekend dinner bookings ✅
- Slot C: Monday 09:00 → Brand awareness (unchanged)
- Slot D: **Wednesday 11:00** → Brunch mid-week engagement ✅

### For All Businesses

- ✅ Each business gets custom slot timing based on actual revenue patterns
- ✅ 95% confidence when using structured programme data
- ✅ Automatic updates when programmes change
- ✅ Graceful fallback to BASE_SLOTS when revenue_drivers not available

---

## 🚀 Next Steps

### Immediate

1. **Deploy get-weekly-strategy function** (updated with revenue_drivers fetch)
2. **Test with Cafe Faust** (business_id: f4679fa9-3120-4a59-9506-d059b010c34a)
3. **Monitor logs** for Business Rules Engine activation
4. **Verify slot timing** in generated weekly plans

### Follow-up

1. **Analyze revenue_drivers for other businesses** (run analyze-revenue-drivers for businesses with brand_profile_v5.layer_1_programmes)
2. **Monitor confidence scores** (should see 95%+ for businesses with structured programme data)
3. **Compare weekly plan quality** before/after integration
4. **Document edge cases** (businesses without programmes, hybrid businesses, etc.)

---

## 📁 Files Modified

1. ✅ `supabase/functions/_shared/post-helpers/strategy/phase1.ts`
2. ✅ `supabase/functions/_shared/post-helpers/types/strategy-types.ts`
3. ✅ `supabase/functions/get-weekly-strategy/index.ts`

---

## 📚 Related Documentation

- **Step 1**: [REVENUE_DRIVER_UPGRADE_SUMMARY.md](REVENUE_DRIVER_UPGRADE_SUMMARY.md)
- **Step 2**: [BUSINESS_RULES_ENGINE_IMPLEMENTATION.md](BUSINESS_RULES_ENGINE_IMPLEMENTATION.md)
- **Step 3**: This document

---

*Generated: 2026-06-07 - Revenue Driver Analyzer Full Integration*
