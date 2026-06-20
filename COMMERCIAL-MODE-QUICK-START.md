# Commercial Mode System - Quick Start

## What Was Built

✅ **Complete commercial objective enforcement system** for Priority Issue 1

### 7 New Files Created:

1. **Database Migration (Schema)**
   - `supabase/migrations/20260505000001_add_commercial_mode_system.sql`
   - Adds commercial mode tracking to database
   - Creates trigger catalog table
   - Adds validation tracking fields

2. **Database Migration (Data)**
   - `supabase/migrations/20260505000002_initialize_commercial_configs.sql`
   - Auto-generates smart defaults for all existing businesses
   - Detects capabilities and assigns appropriate triggers

3. **Type Definitions**
   - `supabase/functions/_shared/post-helpers/types/commercial-mode-types.ts`
   - Complete TypeScript type system for commercial mode

4. **Commercial Classifier**
   - `supabase/functions/_shared/post-helpers/commercial-mode-classifier.ts`
   - Determines weekly commercial mode BEFORE strategy generation
   - Supports 8 different triggers (Valentine's, weather, events, etc.)

5. **Validation System**
   - `supabase/functions/_shared/post-helpers/commercial-validation.ts`
   - Validates generated strategies AFTER generation
   - Scores ideas 1-5 for commercial clarity
   - Enforces quotas (min booking/footfall ideas)

6. **Test Suite**
   - `supabase/functions/_shared/post-helpers/commercial-mode.test.ts`
   - Comprehensive tests for classifier and validator
   - Run with: `deno test --allow-env commercial-mode.test.ts`

7. **Implementation Guide**
   - `COMMERCIAL-MODE-IMPLEMENTATION-GUIDE.md`
   - Complete deployment instructions
   - Testing procedures
   - Monitoring queries
   - Troubleshooting guide

---

## Quick Deployment (30 minutes)

### Step 1: Apply Database Migrations (5 min)

```bash
cd supabase
supabase db push
```

Or manually run:
1. `20260505000001_add_commercial_mode_system.sql`
2. `20260505000002_initialize_commercial_configs.sql`

**Verify:**
```sql
SELECT COUNT(*) FROM trigger_catalog; -- Should return 8
SELECT COUNT(*) FROM business_brand_profile WHERE trigger_configuration IS NOT NULL;
```

### Step 2: Run Tests (5 min)

```bash
cd supabase/functions/_shared/post-helpers
deno test --allow-env commercial-mode.test.ts
```

**Expected:** All tests pass ✅

### Step 3: Review Auto-Generated Configs (10 min)

```sql
-- See how businesses were configured
SELECT 
  b.name,
  bbp.commercial_baseline_mode,
  (SELECT COUNT(*) FROM jsonb_object_keys(bbp.trigger_configuration)) as enabled_triggers
FROM businesses b
JOIN business_brand_profile bbp ON b.id = bbp.business_id
WHERE bbp.trigger_configuration IS NOT NULL
LIMIT 20;

-- Check trigger distribution
SELECT 
  commercial_baseline_mode,
  COUNT(*) as count
FROM business_brand_profile
GROUP BY commercial_baseline_mode;
```

### Step 4: Integration Code Changes (10 min)

**See detailed instructions in:** `COMMERCIAL-MODE-IMPLEMENTATION-GUIDE.md` → Phase 2

**Summary:**
1. Import classifier and validator in `get-weekly-strategy/index.ts`
2. Call `classifyCommercialMode()` BEFORE running strategy generation
3. Pass directive to prompt builders
4. Call `validateCommercialStrategy()` AFTER generation
5. Save commercial metadata to weekly_strategies table

---

## How It Works

### Before Generation:

```typescript
// 1. Classify the week's commercial mode
const directive = classifyCommercialMode({
  business_id,
  week_start,
  has_reservation_system: true,
  trigger_configuration: { VD_WEEK: { enabled: true, mode: 'booking_push' } },
  month: 2  // February
});

// Result for Valentine's Week:
// {
//   commercial_mode: 'booking_push',
//   trigger_reason: "Valentine's Day falls within this week (Feb 12-14)",
//   min_booking_ideas: 3,
//   min_footfall_ideas: 1,
//   timing_urgency: 'this_week'
// }
```

### During Generation:

Prompt builder receives directive and adds:
```
## COMMERCIAL OBJECTIVE (CRITICAL PRIORITY)

This week is classified as: BOOKING_PUSH

Reason: Valentine's Day falls within this week (Feb 12-14)

PRIMARY SUCCESS CRITERIA:
- Generate minimum 3 ideas that drive table reservations
- Each booking idea MUST include: specific CTA, timing urgency, compelling reason to book NOW
- Recommended CTAs: reserve_table, book_appointment, limited_time

All strategic decisions must serve this commercial objective FIRST...
```

### After Generation:

```typescript
// 2. Validate generated ideas
const validation = validateCommercialStrategy(post_ideas, directive);

// Result:
// {
//   passed: true,
//   score: 4.2,
//   booking_ideas_count: 3,
//   footfall_ideas_count: 2,
//   quota_met: true,
//   issues: [],
//   warnings: []
// }
```

---

## Business-Specific Configuration

Each business in `business_brand_profile` now has:

```json
{
  "commercial_baseline_mode": "booking_push",
  "trigger_configuration": {
    "VD_WEEK": {
      "enabled": true,
      "mode": "booking_push",
      "min_booking_ideas": 4,
      "min_footfall_ideas": 1,
      "reasoning": "Fine dining - Valentine's is critical"
    },
    "WEATHER_BREAK": {
      "enabled": true,
      "mode": "footfall_push",
      "min_footfall_ideas": 5,
      "reasoning": "Waterfront terrace is key differentiator"
    }
  }
}
```

**Supported Triggers:**
- `VD_WEEK` - Valentine's Day (Feb 12-14)
- `MD_WEEK` - Mother's Day (week before)
- `FD_WEEK` - Father's Day (week before)
- `FIRST_WEEKEND` - First weekend of month
- `PAYDAY_PERIOD` - Payday windows (15th, end of month)
- `WEATHER_BREAK` - First 20°C+ day after winter
- `LOCAL_EVENT` - High commercial weight events
- `QUIET_WEEK` - Baseline (no triggers)

---

## Testing Scenarios

Test with these weeks:

### 1. Valentine's Week (Feb 9-15, 2026)
- **Expected:** `booking_push` for restaurants/bars
- **Quota:** Min 3-4 booking ideas
- **Validation:** Ideas should have `reserve_table` CTA, `this_week` timing

### 2. First Weekend of Month
- **Expected:** `footfall_push` for most businesses
- **Quota:** Min 4 footfall ideas
- **Validation:** Ideas should have `visit_today`/`visit_this_week` CTA

### 3. Random Summer Week (No Events)
- **Expected:** Baseline mode (varies by business)
- **Quota:** Lower quotas (1-2 commercial ideas)
- **Validation:** Mix of booking/footfall/brand/loyalty

### 4. Outdoor Café in April + Warm Weather
- **Expected:** `footfall_push` via `WEATHER_BREAK` trigger
- **Quota:** Min 5 footfall ideas
- **Validation:** Weather-related conversion hooks

---

## Monitoring After Deployment

### Key Metrics:

```sql
-- Validation pass rate (target: >85%)
SELECT 
  ROUND(100.0 * SUM(CASE WHEN commercial_validation_passed THEN 1 ELSE 0 END) / COUNT(*), 1) as pass_rate,
  ROUND(AVG(commercial_validation_score), 2) as avg_score
FROM weekly_strategies
WHERE commercial_mode IS NOT NULL
AND generated_at > NOW() - INTERVAL '7 days';

-- Most active triggers
SELECT 
  trigger_id,
  COUNT(*) as uses
FROM weekly_strategies,
LATERAL unnest(triggered_by) as trigger_id
WHERE generated_at > NOW() - INTERVAL '7 days'
GROUP BY trigger_id
ORDER BY uses DESC;

-- Failed validations to review
SELECT * FROM v_strategies_failing_validation
WHERE generated_at > NOW() - INTERVAL '7 days';
```

---

## What This Solves

### Before:
- ❌ Generic strategies that don't drive business outcomes
- ❌ Booking opportunities missed (Valentine's, Mother's Day)
- ❌ Weather/seasonal moments ignored
- ❌ No enforcement of commercial intent
- ❌ Post ideas lack specific CTAs and urgency

### After:
- ✅ Every week has clear commercial mode (booking/footfall/balanced)
- ✅ Minimum quotas enforce conversion-focused content
- ✅ Triggers automatically detect commercial opportunities
- ✅ Validation ensures ideas have CTAs, timing, conversion hooks
- ✅ Business-specific configuration respects each venue's reality

---

## Next Actions

1. **Review this summary** ✅ (you're reading it)
2. **Apply database migrations** → `supabase db push`
3. **Run tests** → `deno test commercial-mode.test.ts`
4. **Review auto-configurations** → SQL queries above
5. **Read full implementation guide** → `COMMERCIAL-MODE-IMPLEMENTATION-GUIDE.md`
6. **Integrate into get-weekly-strategy** → Code examples in guide
7. **Test with real business** → Valentine's week recommended
8. **Monitor validation results** → Queries provided above
9. **Refine as needed** → Adjust quotas/thresholds based on data

---

## Support

All details, troubleshooting, and advanced configuration in:

📘 **COMMERCIAL-MODE-IMPLEMENTATION-GUIDE.md**

Includes:
- Complete integration code examples
- Prompt update templates
- Rollout strategy (shadow → warning → enforcement)
- Troubleshooting guide
- Monitoring dashboards
- Success criteria

---

**Status:** ✅ Ready for deployment  
**Testing:** ✅ All components tested  
**Documentation:** ✅ Complete  
**Deployment Time:** ~30 minutes + integration  
**Risk:** Low (additive only, no breaking changes)
