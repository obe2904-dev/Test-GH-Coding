# Commercial Mode System - Implementation Guide

**Generated:** 5. maj 2026  
**Priority:** Issue 1 - Commercial Objective Governance  
**Status:** Ready for Testing & Deployment

---

## Overview

This implementation adds commercial intent enforcement to the weekly strategy generation system. It ensures generated post ideas consistently drive footfall, sales, and reservations through:

1. **Business-specific trigger configuration** - Each business defines which events/patterns activate commercial modes
2. **Intelligent mode classification** - System determines booking_push/footfall_push/balanced before generation
3. **Quota enforcement** - Minimum commercial idea requirements based on mode
4. **Post-generation validation** - Ideas scored for commercial clarity and checked against quotas

---

## What Was Built

### 1. Database Schema (2 migrations)

**File:** `supabase/migrations/20260505000001_add_commercial_mode_system.sql`

Added to `business_brand_profile`:
- `trigger_configuration` (JSONB) - Business-specific trigger policies
- `commercial_baseline_mode` (TEXT) - Default mode when no triggers active
- `trigger_last_updated` (TIMESTAMPTZ)
- `trigger_updated_by` (TEXT)

Added to `weekly_strategies`:
- `commercial_mode` (TEXT) - Determined mode for the week
- `commercial_mode_reason` (TEXT) - Why this mode was selected
- `triggered_by` (TEXT[]) - Which triggers activated
- `min_booking_ideas` (INTEGER) - Required booking idea count
- `min_footfall_ideas` (INTEGER) - Required footfall idea count
- `commercial_validation_score` (NUMERIC) - Quality score (0-5)
- `commercial_validation_details` (JSONB) - Full validation results
- `commercial_validation_passed` (BOOLEAN) - Pass/fail status
- `commercial_override_reason` (TEXT) - Manual override explanation

New table: `trigger_catalog`
- Master list of available triggers (VD_WEEK, MD_WEEK, WEATHER_BREAK, etc.)
- 8 default triggers seeded

New views:
- `v_businesses_missing_commercial_config` - Businesses needing setup
- `v_strategies_failing_validation` - Quality monitoring

**File:** `supabase/migrations/20260505000002_initialize_commercial_configs.sql`

- Generates intelligent default configurations for all existing businesses
- Auto-detects capabilities (reservation system, outdoor seating, service periods)
- Assigns appropriate baseline mode and enables relevant triggers

### 2. TypeScript Types

**File:** `supabase/functions/_shared/post-helpers/types/commercial-mode-types.ts`

Complete type system including:
- `CommercialMode` - booking_push | footfall_push | balanced
- `CommercialIntent` - booking | footfall | brand | loyalty
- `CTAType` - 15 specific CTA types
- `TimingWindow` - today | this_week | this_weekend | etc.
- `CommercialModeDirective` - Classifier output
- `CommercialValidationResult` - Validation output
- Full interfaces for configuration, validation, and database rows

### 3. Commercial Mode Classifier

**File:** `supabase/functions/_shared/post-helpers/commercial-mode-classifier.ts`

Main function: `classifyCommercialMode(context: ClassifierContext)`

**What it does:**
1. Identifies active triggers for the week (Valentine's, Mother's Day, weather, etc.)
2. Selects primary trigger by priority
3. Determines commercial mode (booking_push/footfall_push/balanced)
4. Sets minimum idea quotas
5. Returns directive with reasoning

**Supported triggers:**
- `VD_WEEK` - Valentine's Day (Feb 12-14)
- `MD_WEEK` - Mother's Day (week before)
- `FD_WEEK` - Father's Day (week before)
- `FIRST_WEEKEND` - First weekend of month
- `PAYDAY_PERIOD` - Payday windows
- `WEATHER_BREAK` - First warm day (20°C+)
- `LOCAL_EVENT` - High commercial weight events
- `QUIET_WEEK` - Baseline fallback

### 4. Commercial Validation System

**File:** `supabase/functions/_shared/post-helpers/commercial-validation.ts`

Main function: `validateCommercialStrategy(post_ideas, directive, strict)`

**What it does:**
1. Scores each idea 1-5 for commercial clarity
2. Counts ideas by intent (booking/footfall/brand/loyalty)
3. Checks quota requirements (e.g., min 3 booking ideas)
4. Validates average score ≥ 3.5
5. Returns pass/fail with detailed feedback

**Scoring criteria (1-5):**
- 1: No commercial intent
- 2: Intent but missing CTA/timing/hook
- 3: Has basic commercial elements
- 4: Clear commercial purpose with urgency
- 5: Strong conversion focus with compelling hook

### 5. Test Suite

**File:** `supabase/functions/_shared/post-helpers/commercial-mode.test.ts`

**Coverage:**
- Trigger detection (Valentine's, weather, events)
- Baseline mode fallback
- Context-dependent mode resolution
- Validation scoring
- Quota enforcement
- Full integration workflow

**Run tests:**
```bash
cd supabase/functions/_shared/post-helpers
deno test --allow-env commercial-mode.test.ts
```

---

## Deployment Steps

### Phase 1: Database Migration (Safe - No Breaking Changes)

1. **Review migrations:**
```bash
cat supabase/migrations/20260505000001_add_commercial_mode_system.sql
cat supabase/migrations/20260505000002_initialize_commercial_configs.sql
```

2. **Apply to database:**

**Option A: Supabase CLI (Recommended)**
```bash
cd supabase
supabase db push
```

**Option B: Direct SQL (if no CLI)**
```bash
# Run migrations in order:
# 1. 20260505000001_add_commercial_mode_system.sql
# 2. 20260505000002_initialize_commercial_configs.sql
```

3. **Verify migration success:**
```sql
-- Check new columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'business_brand_profile' 
AND column_name IN ('trigger_configuration', 'commercial_baseline_mode');

-- Check trigger catalog populated
SELECT COUNT(*) FROM trigger_catalog; -- Should return 8

-- Check businesses configured
SELECT COUNT(*) FROM business_brand_profile WHERE trigger_configuration IS NOT NULL;

-- View sample configurations
SELECT * FROM v_businesses_missing_commercial_config LIMIT 5;
```

4. **Review auto-generated configurations:**
```sql
-- See distribution of baseline modes
SELECT commercial_baseline_mode, COUNT(*) 
FROM business_brand_profile 
WHERE trigger_configuration IS NOT NULL
GROUP BY commercial_baseline_mode;

-- See most common enabled triggers
SELECT 
  trigger_id,
  COUNT(*) as enabled_count
FROM business_brand_profile,
LATERAL jsonb_each(trigger_configuration) as t(trigger_id, config)
WHERE (config->>'enabled')::boolean = true
GROUP BY trigger_id
ORDER BY enabled_count DESC;
```

### Phase 2: TypeScript Integration (Code Changes Required)

**Files to modify:** `supabase/functions/get-weekly-strategy/index.ts`

**Integration points:**

1. **Import new modules:**
```typescript
import { classifyCommercialMode } from '../_shared/post-helpers/commercial-mode-classifier.ts';
import { validateCommercialStrategy, formatValidationSummary } from '../_shared/post-helpers/commercial-validation.ts';
import type { 
  ClassifierContext, 
  CommercialModeDirective 
} from '../_shared/post-helpers/types/commercial-mode-types.ts';
```

2. **Call classifier BEFORE Phase 0/1/2:**
```typescript
// After assembling WeekContext, before running strategy generation
const classifierContext: ClassifierContext = {
  business_id: business_id,
  week_start: weekStart,
  week_end: weekEnd,
  business_type: weekContext.business_type,
  has_reservation_system: businessOperations?.has_reservation_system || false,
  commercial_baseline_mode: brandProfile.commercial_baseline_mode || 'balanced',
  trigger_configuration: brandProfile.trigger_configuration || null,
  contextual_calendar: weekContext.events || [],
  weather_forecast: weekContext.weather?.days || undefined,
  week_number: weekNumber,
  month: weekStart.getMonth() + 1,
  first_weekend_of_month: isFirstWeekendOfMonth(weekStart),
  is_payday_period: isPaydayPeriod(weekStart)
};

const commercialDirective = classifyCommercialMode(classifierContext);

console.log('Commercial Mode:', commercialDirective.commercial_mode);
console.log('Reason:', commercialDirective.trigger_reason);
console.log('Min booking ideas:', commercialDirective.min_booking_ideas);
console.log('Min footfall ideas:', commercialDirective.min_footfall_ideas);
```

3. **Pass directive to prompt builders:**
```typescript
// In Phase 1/2 prompt generation, add commercial directive
const phase1Prompt = buildPhase1Prompt(
  weekContext,
  contextualAnalysis,
  commercialDirective // NEW: Add this parameter
);
```

4. **Validate after generation:**
```typescript
// After generateStrategy() returns post_ideas
const validationResult = validateCommercialStrategy(
  strategy.post_ideas,
  commercialDirective,
  false // Set to false for initial testing (warnings only)
);

console.log(formatValidationSummary(validationResult));

if (!validationResult.passed) {
  console.warn('Commercial validation failed:', validationResult.issues);
  // Optionally: trigger regeneration with boosted commercial emphasis
}
```

5. **Save commercial metadata:**
```typescript
// When saving to weekly_strategies table
await supabase.from('weekly_strategies').insert({
  // ... existing fields
  commercial_mode: commercialDirective.commercial_mode,
  commercial_mode_reason: commercialDirective.trigger_reason,
  triggered_by: commercialDirective.triggered_by,
  min_booking_ideas: commercialDirective.min_booking_ideas,
  min_footfall_ideas: commercialDirective.min_footfall_ideas,
  commercial_validation_score: validationResult.score,
  commercial_validation_details: validationResult,
  commercial_validation_passed: validationResult.passed,
  // ... rest of fields
});
```

### Phase 3: Prompt Updates (Content Changes)

**Files to modify:**
- `supabase/functions/_shared/post-helpers/strategy/phase1.ts`
- `supabase/functions/_shared/post-helpers/strategy/phase2/phase2ab-unified.ts`

**Add commercial directive block to Phase 1 prompt:**
```typescript
export function buildPhase1Prompt(
  weekContext: WeekContext,
  contextualAnalysis: ContextualAnalysis,
  commercialDirective: CommercialModeDirective // NEW
): string {
  
  let prompt = `... existing Phase 1 intro ...`;
  
  // NEW: Add commercial objective section at top
  prompt += `\n\n## COMMERCIAL OBJECTIVE (CRITICAL PRIORITY)\n\n`;
  prompt += `This week is classified as: **${commercialDirective.commercial_mode.toUpperCase()}**\n\n`;
  prompt += `Reason: ${commercialDirective.trigger_reason}\n\n`;
  
  if (commercialDirective.commercial_mode === 'booking_push') {
    prompt += `PRIMARY SUCCESS CRITERIA:\n`;
    prompt += `- Generate minimum ${commercialDirective.min_booking_ideas} ideas that drive table reservations\n`;
    prompt += `- Each booking idea MUST include: specific CTA, timing urgency, compelling reason to book NOW\n`;
    prompt += `- Recommended CTAs: ${commercialDirective.required_cta_types.join(', ')}\n\n`;
  } else if (commercialDirective.commercial_mode === 'footfall_push') {
    prompt += `PRIMARY SUCCESS CRITERIA:\n`;
    prompt += `- Generate minimum ${commercialDirective.min_footfall_ideas} ideas that drive immediate visits\n`;
    prompt += `- Each footfall idea MUST include: visit trigger, today/this-week urgency, location-specific hook\n`;
    prompt += `- Recommended CTAs: ${commercialDirective.required_cta_types.join(', ')}\n\n`;
  }
  
  prompt += `All strategic decisions must serve this commercial objective FIRST, then brand identity second, then variety third.\n\n`;
  
  prompt += `... rest of existing Phase 1 prompt ...`;
  
  return prompt;
}
```

**Add required commercial fields to Phase 2ab output schema:**
```typescript
// In phase2ab-unified.ts, update output schema
const outputSchema = `
Each post idea must include these fields:

{
  "id": number,
  "title": string,
  "rationale": string,
  "content_type": string,
  "suggested_day": "ISO date",
  "suggested_time": "HH:MM",
  
  // REQUIRED COMMERCIAL FIELDS (NEW):
  "commercial_intent": "booking" | "footfall" | "brand" | "loyalty",
  "cta_type": "reserve_table" | "visit_today" | "try_new_item" | etc.,
  "timing_window": "today" | "this_week" | "this_weekend" | etc.,
  "conversion_hook": "One compelling sentence explaining why to act NOW",
  "expected_outcome": "table_reservation" | "walk_in_visit" | etc.,
  
  // ... rest of existing fields
}
`;
```

### Phase 4: Testing

**Test progression:**

1. **Unit tests (10 minutes):**
```bash
cd supabase/functions/_shared/post-helpers
deno test --allow-env commercial-mode.test.ts
```
Expected: All tests pass

2. **Database verification (5 minutes):**
```sql
-- Verify trigger catalog
SELECT * FROM trigger_catalog WHERE is_active = true;

-- Check sample business configs
SELECT 
  b.name,
  bbp.commercial_baseline_mode,
  jsonb_pretty(bbp.trigger_configuration) as config
FROM businesses b
JOIN business_brand_profile bbp ON b.id = bbp.business_id
LIMIT 3;
```

3. **Integration test (30 minutes):**

Create test script: `test-commercial-mode.ts`
```typescript
// Simulates full workflow for one business
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Pick a test business
const businessId = 'YOUR_TEST_BUSINESS_ID';
const weekStart = '2026-02-09'; // Valentine's week for testing

// Call get-weekly-strategy edge function
const { data, error } = await supabase.functions.invoke('get-weekly-strategy', {
  body: {
    business_id: businessId,
    week_start: weekStart,
    regenerate: true
  }
});

console.log('Commercial Mode:', data.commercial_mode);
console.log('Validation:', data.commercial_validation_passed ? 'PASS' : 'FAIL');
console.log('Score:', data.commercial_validation_score);
console.log('Booking ideas:', data.booking_ideas_count);
```

Run: `deno run --allow-env --allow-net test-commercial-mode.ts`

4. **Validation tests (varied scenarios):**

Test these week types:
- Valentine's Week (Feb 9-15, 2026) → Should be booking_push
- Random summer week (July 20-26) → Should be baseline mode
- First weekend of month → Should activate FIRST_WEEKEND
- Week with outdoor seating business in April → Should consider WEATHER_BREAK

For each, verify:
- Correct mode selected
- Appropriate quotas set
- Validation passes or gives clear feedback
- Ideas have commercial fields populated

### Phase 5: Rollout Strategy

**Week 1: Shadow Mode**
- Run classifier and validation
- Log results but DON'T block generation
- Set `strict = false` in validation
- Collect data on pass rates and common issues

**Week 2: Warning Mode**
- Continue not blocking
- Add UI warnings when validation fails
- Review failure patterns
- Adjust thresholds if needed
- Test manual override workflow

**Week 3: Soft Enforcement**
- Enable blocking for obvious failures (score < 2.5)
- Allow override with reason
- Monitor override frequency
- Gather business owner feedback

**Week 4: Full Enforcement**
- Enable strict validation (score ≥ 3.5, quotas met)
- Offer regeneration when validation fails
- Track quality improvements
- Refine trigger configurations based on data

---

## Monitoring & Metrics

### Key Queries

**1. Validation pass rate by mode:**
```sql
SELECT 
  commercial_mode,
  COUNT(*) as total_strategies,
  SUM(CASE WHEN commercial_validation_passed THEN 1 ELSE 0 END) as passed,
  ROUND(100.0 * SUM(CASE WHEN commercial_validation_passed THEN 1 ELSE 0 END) / COUNT(*), 1) as pass_rate,
  ROUND(AVG(commercial_validation_score), 2) as avg_score
FROM weekly_strategies
WHERE commercial_mode IS NOT NULL
AND generated_at > NOW() - INTERVAL '30 days'
GROUP BY commercial_mode
ORDER BY total_strategies DESC;
```

**2. Most common failure reasons:**
```sql
SELECT 
  issue,
  COUNT(*) as frequency
FROM weekly_strategies,
LATERAL jsonb_array_elements_text(
  commercial_validation_details->'issues'
) as issue
WHERE NOT commercial_validation_passed
AND generated_at > NOW() - INTERVAL '7 days'
GROUP BY issue
ORDER BY frequency DESC
LIMIT 10;
```

**3. Trigger activation frequency:**
```sql
SELECT 
  trigger_id,
  COUNT(*) as activation_count,
  COUNT(DISTINCT business_id) as unique_businesses
FROM weekly_strategies,
LATERAL unnest(triggered_by) as trigger_id
WHERE generated_at > NOW() - INTERVAL '30 days'
GROUP BY trigger_id
ORDER BY activation_count DESC;
```

**4. Businesses needing config review:**
```sql
SELECT * FROM v_businesses_missing_commercial_config;
```

### Dashboard Metrics

Track weekly:
- **Validation pass rate** (target: >85%)
- **Average commercial clarity score** (target: >3.8)
- **Booking idea quota fulfillment** (target: >90% when mode = booking_push)
- **Override frequency** (target: <10% of validations)
- **Businesses with incomplete config** (target: 0)

---

## Troubleshooting

### Issue: Validation always fails

**Symptoms:** All strategies fail validation, scores consistently low

**Check:**
1. Are commercial fields being populated in Phase 2?
   ```sql
   SELECT post_ideas FROM weekly_strategies ORDER BY generated_at DESC LIMIT 1;
   ```
2. Is prompt including commercial directive?
3. Are ideas missing `commercial_intent`, `cta_type`, or `conversion_hook`?

**Fix:** Update Phase 2 prompt to require commercial fields in output schema

### Issue: Wrong mode selected

**Symptoms:** Booking push when it should be footfall, or vice versa

**Check:**
1. Business trigger configuration:
   ```sql
   SELECT trigger_configuration 
   FROM business_brand_profile 
   WHERE business_id = 'XXX';
   ```
2. Classifier context inputs (week dates, calendar events, weather)

**Fix:** Adjust business trigger config or fix classifier date logic

### Issue: Triggers not activating

**Symptoms:** Always baseline mode, no triggers detected

**Check:**
1. Trigger enabled in config?
2. Date ranges correct? (Valentine's Feb 12-14, etc.)
3. Calendar events have correct commercial_weight?

**Fix:** Review trigger activation logic in `checkTriggerActivation()`

### Issue: Quotas too strict/lenient

**Symptoms:** Good strategies failing or bad strategies passing

**Fix:** Adjust quotas in business trigger config:
```sql
UPDATE business_brand_profile
SET trigger_configuration = jsonb_set(
  trigger_configuration,
  '{VD_WEEK,min_booking_ideas}',
  '3'  -- Reduce from 4 to 3
)
WHERE business_id = 'XXX';
```

---

## Next Steps

After deployment:

1. **Week 1:** Monitor validation results, collect failure patterns
2. **Week 2:** Refine prompt wording based on common issues
3. **Week 3:** Implement prompt variation testing (A/B test commercial emphasis)
4. **Week 4:** Add business owner UI for trigger configuration editing
5. **Month 2:** Build analytics dashboard showing commercial effectiveness
6. **Month 3:** Correlate commercial mode/scores with actual business outcomes

---

## Files Reference

```
supabase/
  migrations/
    20260505000001_add_commercial_mode_system.sql          [Database schema]
    20260505000002_initialize_commercial_configs.sql       [Default configs]
  
  functions/
    _shared/
      post-helpers/
        types/
          commercial-mode-types.ts                         [Type definitions]
        commercial-mode-classifier.ts                      [Mode classifier]
        commercial-validation.ts                           [Validation system]
        commercial-mode.test.ts                            [Test suite]
        
    get-weekly-strategy/
      index.ts                                             [TO MODIFY: Integration]
    
    strategy/
      phase1.ts                                            [TO MODIFY: Add directive]
      phase2/
        phase2ab-unified.ts                                [TO MODIFY: Add fields]
```

---

## Success Criteria

System is successful when:

✅ **Database:** All migrations applied, 0 businesses missing config  
✅ **Tests:** All unit tests passing  
✅ **Integration:** Classifier runs before generation, validation runs after  
✅ **Prompts:** Commercial directive visible in Phase 1, fields in Phase 2 output  
✅ **Validation:** >80% pass rate, <15% overrides  
✅ **Quality:** Average score >3.5, quotas met >90% of time  
✅ **Monitoring:** Dashboards tracking metrics, failure patterns identified  

---

**Contact:** Ready for deployment questions and support  
**Version:** 1.0.0  
**Date:** 5. maj 2026
