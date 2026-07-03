# Phase 1 Implementation - Content-Timing Rules System
## Deployment Guide

**Status**: ✅ Code Complete - Ready for Database Migration  
**Date**: May 3, 2026  
**Purpose**: Fix drinks-on-Sunday bug and prevent content-timing violations

---

## What Was Implemented

### 1. **Archetype Rules System**
File: `supabase/functions/_shared/config/archetype-rules.ts`

- **8 Base Archetypes**: casual_dining, nightlife_bar, brunch_specialist, fine_dining, fast_casual, hotel_restaurant, bakery_cafe, family_casual
- **4 Hybrid Archetypes**: cafe_bar, brunch_and_dinner, coffee_and_wine, bistro_bar
- **Content-Type Rules**: Each archetype defines when different content should post (drinks, brunch, lunch, dinner, etc.)

**Example - Nightlife Bar Rules**:
```typescript
drinks: {
  primary_days: ["Thursday", "Friday", "Saturday"],
  secondary_days: ["Sunday", "Wednesday"],
  optimal_times: ["16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"],
  avoid: {
    days: ["Monday", "Tuesday"],
    times: ["00:00-15:59"]  // No drinks before 16:00
  }
}
```

### 2. **Regional Timing Adjustments**
File: `supabase/functions/_shared/config/regional-adjustments.ts`

- **11 Countries**: DK, ES, UK, US, CN, SE, NO, FI, FR, DE, IT
- **Cultural Timing Differences**: 
  - Denmark: Early dinner (18:00), posts 14:00-19:00
  - Spain: Late dinner (21:00), posts 17:00-22:00 (+3 hour shift)
  - UK: Sunday pub culture
  - China: Sunday family dining tradition

### 3. **Validation Layer**
File: `supabase/functions/_shared/post-helpers/content-timing-validator.ts`

**7 Universal Validation Rules**:
1. ✅ Evening/drinks content must post ≥ 14:00
2. ✅ Morning content should post ≤ 11:00
3. ✅ Brunch content weekends only (Sat/Sun)
4. ✅ Rationale-execution coherence (detects mismatches)
5. ✅ Goal-content alignment (footfall posts 11:00-19:00)
6. ✅ Event timing logic
7. ✅ Programme-archetype compliance

**Auto-Fix Capability**: Automatically suggests fixes for critical violations

**Example Validation**:
```typescript
INPUT:  "Signature Cocktails" Sunday 09:00
VIOLATIONS:
  - drinks content before 14:00 (critical)
  - drinks on Sunday not in primary_days (critical)
AUTO-FIX: Friday 17:00 ✅
```

### 4. **Phase 1 Prompt Enhancement**
File: `supabase/functions/_shared/post-helpers/strategy/phase1.ts`

AI now receives content-timing rules in prompt:
```
⚠️ INDHOLD-TIMING REGLER (gælder for timing_window i vinkler):
  • DRINKS/COCKTAILS: Skal poste torsdag-lørdag kl. 16:00-22:00
  • Undgå drinks-content mandag-tirsdag og før kl. 16:00
```

### 5. **Database Schema**
File: `supabase/migrations/20260503_add_content_timing_support.sql`

**New Columns**:
- `businesses.archetype` - Business type (casual_dining, nightlife_bar, etc.)
- `businesses.country_code` - Country for regional timing (DK, ES, UK, etc.)
- `programmes.programme_archetype` - Per-programme override for hybrids
- `programmes.temporal_relevance` - Seasonal/temporal context (JSONB)
- `posts.validation_result` - Validation tracking (JSONB)
- `posts.inferred_content_type` - Content type (drinks, brunch, etc.)

---

## How to Deploy

### Step 1: Apply Database Schema Changes

**Option A - Supabase SQL Editor** (Recommended):

1. Open: https://supabase.com/dashboard/project/zzauefccejjkdguuyapl/sql
2. Copy contents of: `supabase/migrations/PHASE1_ESSENTIAL_SCHEMA.sql`
3. Paste and click "Run"
4. Verify output shows all columns created

**Option B - Use Full Migration File**:

1. Copy contents of: `supabase/migrations/20260503_add_content_timing_support.sql`
2. Paste into SQL Editor and run
3. This includes additional helper functions and views

### Step 2: Verify Schema Changes

Run this query in SQL Editor:
```sql
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('businesses', 'programmes', 'posts')
  AND column_name IN ('archetype', 'country_code', 'programme_archetype', 
                      'temporal_relevance', 'validation_result', 'inferred_content_type')
ORDER BY table_name, column_name;
```

Expected output: 6 rows showing all new columns

### Step 3: Set Business Archetypes

**For Cafe Faust** (the test case):
```sql
UPDATE businesses 
SET archetype = 'cafe_bar', country_code = 'DK'
WHERE LOWER(name) LIKE '%faust%';
```

**For other businesses**, check their type:
```sql
-- See all businesses
SELECT id, name, description 
FROM businesses
ORDER BY name;

-- Update archetype based on type
UPDATE businesses 
SET archetype = 'nightlife_bar'
WHERE LOWER(name) LIKE '%bar%' OR LOWER(description) LIKE '%cocktail%';

UPDATE businesses 
SET archetype = 'brunch_specialist'
WHERE LOWER(description) LIKE '%brunch%';

UPDATE businesses 
SET archetype = 'fine_dining'
WHERE LOWER(description) LIKE '%fine dining%' OR LOWER(description) LIKE '%michelin%';
```

### Step 4: Test the System

**Generate a weekly plan for Cafe Faust**:

1. Use existing UI or API to generate weekly plan
2. Check that drinks posts are scheduled:
   - **Days**: Thursday, Friday, or Saturday (not Sunday/Monday)
   - **Times**: Between 16:00-22:00 (not morning)
3. Check that brunch posts are scheduled:
   - **Days**: Saturday or Sunday only
   - **Times**: Before 12:00

**Verify validation is working**:
```sql
-- Check recent posts for validation results
SELECT 
  b.name as business_name,
  p.title,
  p.promoted_moment,
  p.inferred_content_type,
  p.validation_result->>'valid' as is_valid,
  p.validation_result->'violations' as violations
FROM posts p
JOIN businesses b ON p.business_id = b.id
WHERE p.created_at >= NOW() - INTERVAL '1 day'
ORDER BY p.created_at DESC
LIMIT 20;
```

---

## Expected Behavior Changes

### Before Phase 1:
```
Programme: "Signature Cocktails"
Business: Cafe Faust
Scheduled: Sunday 09:00 ❌
Problem: Drinks content on wrong day at wrong time
```

### After Phase 1:
```
Programme: "Signature Cocktails"
Business: Cafe Faust (archetype: cafe_bar)
Content Type: drinks → nightlife_bar rules
Validation:
  - Sunday not in primary_days (Thu-Sat) ❌
  - 09:00 not in optimal_times (16:00-22:00) ❌
Auto-Fix: Friday 17:00 ✅
Result: Post scheduled correctly
```

---

## Monitoring & Metrics

### Daily Validation Check
```sql
SELECT 
  COUNT(*) as total_posts,
  SUM(CASE WHEN (validation_result->>'valid')::boolean = true THEN 1 ELSE 0 END) as valid_posts,
  SUM(CASE WHEN (validation_result->>'auto_fix_applied')::boolean = true THEN 1 ELSE 0 END) as auto_fixed,
  ROUND(100.0 * SUM(CASE WHEN (validation_result->>'valid')::boolean = true THEN 1 ELSE 0 END) / 
        NULLIF(COUNT(*), 0), 1) as validation_rate
FROM posts
WHERE created_at >= NOW() - INTERVAL '24 hours';
```

### Archetype Distribution
```sql
SELECT 
  archetype,
  country_code,
  COUNT(*) as business_count
FROM businesses
GROUP BY archetype, country_code
ORDER BY business_count DESC;
```

### Common Violations
```sql
SELECT 
  violation->>'rule' as rule_name,
  COUNT(*) as occurrences
FROM posts,
LATERAL jsonb_array_elements(validation_result->'violations') as violation
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY violation->>'rule'
ORDER BY occurrences DESC;
```

---

## Troubleshooting

### Issue: Drinks still posting on wrong days

**Check**:
```sql
SELECT 
  b.name,
  b.archetype,
  pr.name as programme_name,
  p.promoted_moment,
  p.inferred_content_type
FROM posts p
JOIN businesses b ON p.business_id = b.id
JOIN programmes pr ON p.programme_id = pr.id
WHERE p.inferred_content_type = 'drinks'
  AND EXTRACT(DOW FROM p.promoted_moment_datetime) IN (0, 1, 2)  -- Sun, Mon, Tue
ORDER BY p.created_at DESC;
```

**Fix**: Ensure business has correct archetype and regenerate plan

### Issue: Validation not running

**Check**: Validation integration in weekly plan generation
```typescript
// Should be in get-weekly-strategy/index.ts after Phase 2
const validationSummary = await validateWeeklyPlanBeforeSave(
  generatedPosts,
  business,
  programmes
);
```

### Issue: Too many auto-fixes needed

**Root Cause**: Phase 1 AI prompt not including archetype rules

**Fix**: Verify Phase 1 prompt shows content-timing rules for business archetype

---

## Next Steps (Phase 2-6)

### Phase 2: Temporal Context (1-2 weeks)
- Seasonal emphasis shifts (May cocktails 40% → Nov 10%)
- Event-driven emphasis
- Weather-based boosts

### Phase 3: Hybrid Business Support (1-2 weeks)
- AI auto-detection of programme archetypes
- Keyword matching refinement

### Phase 4: Regional Expansion (2 weeks)
- Additional countries
- Cultural pattern refinement

### Phase 5: Owner Control (2 weeks)
- UI for archetype override
- Dashboard transparency

### Phase 6: Continuous Improvement (Ongoing)
- Learning from validation failures
- Pattern detection

---

## Success Metrics

**Phase 1 Goals** (2-3 week target):
- ✅ 95%+ validation pass rate
- ✅ 90%+ auto-fix success rate
- ✅ Zero drinks-on-Sunday bugs
- ✅ Zero brunch-on-weekday bugs
- ✅ Cafe Faust correctly posts drinks Thu-Sat evenings

**Track Weekly**:
```sql
SELECT 
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as posts,
  ROUND(100.0 * SUM(CASE WHEN (validation_result->>'valid')::boolean = true THEN 1 ELSE 0 END) / 
        COUNT(*), 1) as validation_rate,
  SUM(CASE WHEN (validation_result->>'auto_fix_applied')::boolean = true THEN 1 ELSE 0 END) as auto_fixes
FROM posts
WHERE created_at >= NOW() - INTERVAL '4 weeks'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC;
```

---

## Files Reference

**Configuration**:
- `/supabase/functions/_shared/config/archetype-rules.ts` - 8 archetypes + 4 hybrids
- `/supabase/functions/_shared/config/regional-adjustments.ts` - 11 countries

**Validation**:
- `/supabase/functions/_shared/post-helpers/content-timing-validator.ts` - 7 validation rules
- `/supabase/functions/_shared/post-helpers/validation-integration-example.ts` - Integration patterns

**Database**:
- `/supabase/migrations/20260503_add_content_timing_support.sql` - Full migration
- `/supabase/migrations/PHASE1_ESSENTIAL_SCHEMA.sql` - Essential changes only

**AI Integration**:
- `/supabase/functions/_shared/post-helpers/strategy/phase1.ts` - Modified (archetype rules in prompt)
- `/supabase/functions/_shared/post-helpers/strategy/phase2/phase2a.ts` - Day assignment (no changes needed)
- `/supabase/functions/_shared/post-helpers/strategy/phase2/phase2b.ts` - Time determination (no changes needed)

---

## Support

For issues or questions:
1. Check validation results in database
2. Review archetype configuration
3. Test with Cafe Faust first (known case)
4. Monitor validation metrics daily for first week
