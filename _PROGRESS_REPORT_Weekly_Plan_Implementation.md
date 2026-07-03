# Weekly Plan Full Architecture - Progress Report

**Date:** 2026-06-08  
**Status:** Phase A & B Complete, Integration Layer Needed

---

## ✅ Completed Work

### 1. Implementation Plan Document
- File: `_IMPLEMENTATION_PLAN_Weekly_Plan_Full_Architecture.md`
- Complete 3-phase implementation roadmap
- Estimated 4-6 hours total work
- Clear success criteria defined

### 2. Revenue Drivers Schema (Simplified)
- File: `_SCHEMA_revenue_drivers.sql`
- JSONB schema for brand_profile_v5.revenue_drivers
- Three priority levels: primary, secondary, tertiary
- Decision window types: advance_booking, same_day, impulse
- Normal week strategy patterns
- Ready to apply to database

### 3. Event Classifier
- File: `supabase/functions/_shared/content-planning/event-classifier.ts`
- 5 event types: advance_booking, same_day, multi_day, reactive, season_start
- Posting strategy calculator
- Date resolution logic
- Test suite included

### 4. Business Rules Engine (New)
- File: `supabase/functions/_shared/content-planning/business-rules-engine.ts`
- Revenue-driven day allocation
- Event-aware posting rules
- Decision window calculator
- Priority-based rule generation

---

## 🔍 Discovery: Existing Infrastructure

### Found Existing Files

**File:** `supabase/functions/_shared/post-helpers/business-rules-engine.ts`

**Current Schema:** More detailed RevenueMoment structure
```typescript
interface RevenueDrivers {
  primary_revenue_moment: RevenueMoment;
  secondary_revenue_moments: RevenueMoment[];
  normal_week_strategy: { ... };
}

interface RevenueMoment {
  moment_id: string;
  decision_pattern: 'advance_booking' | 'same_day_morning' | ...;
  decision_windows: Array<{ ... }>;
  post_timing_rules: Array<{ timing, purpose, priority }>;
}
```

**My New Schema:** Simpler, more accessible structure
```typescript
interface RevenueDrivers {
  primary: { moment, decision_window, post_timing, ... };
  secondary: { ... };
  tertiary: { ... };
  normal_week_strategy: { ... };
}
```

**Status:**
- ✅ Existing `generateSlotsFromRevenueDrivers()` function works
- ✅ Already integrated into Phase 1 (line 1049)
- ⚠️ Uses complex schema (not yet populated in database)
- ⚠️ My simpler schema is more user-friendly

---

## 📋 Integration Needs

### Option A: Use Existing Complex Schema
**Pros:**
- Infrastructure already in place
- Phase 1 already imports it
- No breaking changes

**Cons:**
- Complex nested structure
- Harder to understand and maintain
- No migration SQL exists for this schema

### Option B: Update to Simplified Schema
**Pros:**
- Cleaner, more intuitive structure
- Migration SQL already written
- Easier for future updates

**Cons:**
- Need to update existing `generateSlotsFromRevenueDrivers()`
- Need to update Phase 1 import

### Option C: Support Both Schemas
**Pros:**
- Backward compatible
- Gradual migration path

**Cons:**
- More complexity in business-rules-engine.ts

---

## 🎯 Recommended Next Steps

### Immediate (15-30 min)

**1. Consolidate Business Rules Engine**
- Merge my new file into existing post-helpers location
- Add support for simplified schema
- Keep existing complex schema support
- Export both `generateSlotsFromRevenueDrivers` and `BusinessRulesEngine` class

**2. Apply Database Migration**
```bash
psql $DATABASE_URL -f _SCHEMA_revenue_drivers.sql
```

**3. Test Schema in Database**
```sql
SELECT revenue_drivers FROM brand_profile_v5 
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

### Phase 2a Integration (1-2 hours)

**Current State:**
- Phase 2a uses timing_window from Phase 1 slots
- Has sophisticated spread algorithm
- Already has event pinning logic

**Needed Changes:**
- Add BusinessRulesEngine call at start of phase2a
- Use allocation rules to override calendar-first logic
- Keep spread algorithm as fallback for flexible slots
- Enhance event pinning with event classifier

**File to Update:**
`supabase/functions/_shared/post-helpers/strategy/phase2/phase2a.ts`

**Lines to Modify:**
- Lines 88-150: Add business rules engine initialization
- Lines 165-280: Update day assignment to use allocation rules
- Lines 287-380: Keep consecutive guard logic (still needed)

### Testing & Validation (30-45 min)

**Create Test Suite:**
- Test revenue drivers load correctly
- Test business rules generate correct allocation
- Test Phase 2a assigns days per business rules
- Test event weeks have day-of posting
- Test normal weeks follow preferred patterns

**Manual Testing:**
1. Generate strategy for normal week → verify Thu/Fri posts
2. Generate strategy for Grundlovsdag week → verify Friday post exists
3. Compare to previous calendar-first output

---

## 💡 What We've Achieved So Far

### Problem Solved (Conceptually)
- ✅ Event type taxonomy (advance-booking vs same-day vs multi-day)
- ✅ Decision window modeling (when customers decide vs visit)
- ✅ Revenue-driven posting logic (not calendar templates)
- ✅ Event-aware posting strategy (day-of + lead-up)

### Infrastructure Built
- ✅ Event classifier with 5 event types
- ✅ Business rules engine for day allocation
- ✅ Revenue drivers schema (simplified)
- ✅ Migration SQL ready

### What Remains
- ⏳ Consolidate into existing files
- ⏳ Apply database migration
- ⏳ Update Phase 2a day allocation
- ⏳ Create test suite
- ⏳ Deploy and validate

---

## 🚀 Quick-Start Next Session

If continuing later, start here:

**1. Consolidate Files (merge my new business-rules-engine.ts into existing)**
**2. Run migration:** `_SCHEMA_revenue_drivers.sql`
**3. Update Phase 2a:** Add business rules call
**4. Test:** Generate strategy for normal week, verify Thu-Fri posts
**5. Deploy:** `supabase functions deploy get-weekly-strategy`

---

## 📊 Time Estimate

**Remaining Work:**
- Consolidation: 15-30 min
- Phase 2a integration: 1-2 hours
- Testing: 30-45 min
- Deployment & validation: 15-30 min
**Total:** 2.5-4 hours

**Completed So Far:** ~1.5 hours

**Original Estimate:** 4-6 hours  
**On Track:** Yes ✅

---

## 🎓 Key Insights from This Session

### Discovery #1: Existing Infrastructure
- System already has business-rules-engine.ts (complex schema)
- Phase 1 already checks for revenue_drivers
- Infrastructure more advanced than expected

### Discovery #2: Schema Design Choice
- Complex nested schema (RevenueMoment) vs simple flat schema
- Trade-off: Expressiveness vs Accessibility
- Both can work, need to choose one

### Discovery #3: Phase 2a Sophistication
- Already has spread algorithm
- Already has event pinning
- Already has consecutive guard
- Need to enhance, not replace

### Lesson: Integration > Replacement
- Don't recreate what exists
- Enhance existing logic with business rules
- Keep proven algorithms (spread, consecutive guard)
- Add business-first intelligence layer

---

## 📝 Files Created This Session

1. `_IMPLEMENTATION_PLAN_Weekly_Plan_Full_Architecture.md` (comprehensive plan)
2. `_SCHEMA_revenue_drivers.sql` (database migration)
3. `supabase/functions/_shared/content-planning/event-classifier.ts` (taxonomy)
4. `supabase/functions/_shared/content-planning/business-rules-engine.ts` (new version)
5. `_PROGRESS_REPORT_Weekly_Plan_Implementation.md` (this file)

**Status:** All foundational pieces ready for integration ✅
