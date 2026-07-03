# Content Type System Implementation - Phase A & B Complete

## Overview
Implementing a two-axis content allocation system for Weekly Plan: **Programme × Type** grid with drift correction.

### The 4 Content Types
1. **PRODUCT** (35% target): Menu highlights, ingredients, preparation
2. **EXPERIENCE** (30% target): Atmosphere, setting, behind-the-scenes  
3. **OCCASION** (25% target): Calendar events, urgency, booking prompts
4. **RETENTION** (10% target): Insider knowledge, rituals, loyalty

## Implementation Status

### ✅ Phase A: Foundation (COMPLETE)
**Status**: Schema changes ready, no behavior changes yet

**Database Changes** (run PHASE_A_CONTENT_TYPE_FOUNDATION.sql):
- ✅ Added `target_type_mix` JSONB to `business_brand_profile` (business-level distribution)
- ✅ Added `accepts_reservations` boolean to `business_programme_profiles` (booking vs walk-in nuance)
- ✅ Added `is_active` boolean to `business_programme_profiles` (already queried but was missing from schema)

**TypeScript Changes**:
- ✅ Created `supabase/functions/_shared/contentTypeSystem.ts` - Core types, constants, helpers
- ✅ Type enum: `PRODUCT | EXPERIENCE | OCCASION | RETENTION`
- ✅ Goal-mode to type eligibility mapping
- ✅ Helper functions for type selection and validation

**Files Created**:
1. `PHASE_A_CONTENT_TYPE_FOUNDATION.sql` - Schema migration (run manually in SQL Editor)
2. `supabase/functions/_shared/contentTypeSystem.ts` - Types and constants
3. `supabase/migrations/20260602_add_content_type_system.sql` - Migration file (for reference)

### ✅ Phase B: Tracking (COMPLETE - Logging Only)
**Status**: Analytics ready, logs to console, no behavior changes

**Features Implemented**:
- ✅ **Staleness Calculation**: Tracks when each type was last used (8-week lookback)
  - Never used = max staleness
  - Days since last use → priority score (0.0-1.0)
  
- ✅ **Drift Calculation**: Measures actual vs target type distribution
  - Compares last 8 weeks of posts to target_type_mix
  - Calculates correction multiplier (0.0-2.0x) for under/over-represented types
  
- ✅ **Analytics Logging**: Beautiful console output showing:
  - Which types are stale (haven't been used)
  - Which types are drifting (over/under-represented)
  - Recommendations (most stale, most underrepresented)

**Files Created/Modified**:
1. `supabase/functions/_shared/contentTypeTracking.ts` - Staleness & drift calculators
2. `supabase/functions/get-weekly-strategy/index.ts` - Added Phase B logging block

**What to See in Logs**:
```
📊 [PHASE B] CONTENT TYPE ANALYTICS (informational only):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Staleness (what types haven't been used recently):
  PRODUCT: 2 days ago (priority: 0.07)
  EXPERIENCE: 14 days ago (priority: 0.47)
  OCCASION: NEVER USED (priority: 1.00)
  RETENTION: 7 days ago (priority: 0.23)

Drift (actual vs target distribution):
  PRODUCT: 45.0% actual vs 35.0% target (drift: +10.0%, correction: 0.80x)
  EXPERIENCE: 25.0% actual vs 30.0% target (drift: -5.0%, correction: 1.10x)
  OCCASION: 0.0% actual vs 25.0% target (drift: -25.0%, correction: 1.50x)
  RETENTION: 30.0% actual vs 10.0% target (drift: +20.0%, correction: 0.60x)

Recommendations:
  → Most stale type: OCCASION
  → Most underrepresented: OCCASION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Next Steps

### ⏳ Phase C: Allocation (Not Started)
**Goal**: Assign types to post slots in get-weekly-strategy

**Implementation**:
1. Create type allocator function in `contentTypeSystem.ts`
2. Combine:
   - Target type mix (business-level)
   - Programme goal-mode split (footfall/brand/retention %)
   - Type staleness (what hasn't been used)
   - Type drift (what's over/under-represented)
3. Output: `post_ideas` array with `content_type` field assigned
4. Modify `get-weekly-strategy` to call allocator and add types to strategy output

**Behavior Change**: Strategy JSON will include type assignments, but generate-weekly-plan will ignore them (until Phase D)

### ⏳ Phase D: Generation (Not Started)
**Goal**: Generate type-specific content in generate-weekly-plan

**Implementation**:
1. Read `content_type` from strategy.post_ideas
2. Route each idea through type-specific generator:
   - **PRODUCT**: Focus on menu items, ingredients, preparation
   - **EXPERIENCE**: Focus on atmosphere, behind-the-scenes, story
   - **OCCASION**: Focus on calendar events, urgency, booking
   - **RETENTION**: Focus on insider knowledge, rituals, loyalty
3. Adapt AI prompts per type using `TYPE_METADATA`
4. Save generated posts with `content_type` and `type_rationale` fields

**Behavior Change**: Full type-aware content generation with variety enforcement

## Deployment Instructions

### Step 1: Run Database Migration
Execute in Supabase SQL Editor:
```bash
# Copy content from PHASE_A_CONTENT_TYPE_FOUNDATION.sql
# Paste into SQL Editor and run
```

Verify:
- `business_brand_profile` has `target_type_mix` column
- `business_programme_profiles` has `accepts_reservations` and `is_active`
- All existing rows have default values

### Step 2: Deploy Edge Function Updates
```bash
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"

# Deploy get-weekly-strategy with Phase B logging
supabase functions deploy get-weekly-strategy
```

### Step 3: Test Logging
1. Generate a weekly plan via dashboard
2. Check Supabase function logs
3. Look for `[PHASE B] CONTENT TYPE ANALYTICS` block
4. Verify staleness and drift calculations show reasonable numbers

## Architecture Decisions

### Per-Programme Goal Splits (KEEP AS IS)
- Each programme (BRUNCH, FROKOST, AFTEN, BAR) has its own goal-mode split
- Stored in `business_programme_profiles.baseline_goal_split`:
  ```json
  {
    "drive_footfall": 70,
    "strengthen_brand": 20,
    "retain_regulars": 10
  }
  ```
- **Rationale**: Different programmes have different commercial strategies
  - Brunch/Frokost: High footfall, spontaneous
  - Aften: Balanced brand/retention, planned
  - Bar: High footfall, spontaneous evening

### Business-Level Type Mix (NEW)
- Target distribution across ALL posts over time
- Stored in `business_brand_profile.target_type_mix`:
  ```json
  {
    "product": 0.35,
    "experience": 0.30,
    "occasion": 0.25,
    "retention": 0.10
  }
  ```
- **Rationale**: Type diversity is a business-level concern, not per-programme
  - All programmes need variety
  - Drift correction works at portfolio level
  - Prevents "all PRODUCT all the time" trap

### Type-Goal Eligibility Mapping
- Each goal mode favors certain types:
  ```typescript
  PRODUCT: ['footfall']
  EXPERIENCE: ['brand', 'retention']
  OCCASION: ['footfall', 'brand']
  RETENTION: ['retention']
  ```
- **Allocation Logic** (Phase C):
  1. Look at programme's goal split (e.g., BRUNCH: 70% footfall)
  2. Filter eligible types (footfall → PRODUCT, OCCASION)
  3. Apply staleness/drift correction
  4. Assign type to post slot

### Booking/Walk-In Distinction (NEW)
- Added `accepts_reservations` boolean per programme
- **Use Case**: Adapt OCCASION post language
  - `accepts_reservations: true` → "Book dit bord til Grundlovsdag"
  - `accepts_reservations: false` → "Drop forbi i dag til Grundlovsdag"

## File Inventory

### SQL Files
- `PHASE_A_CONTENT_TYPE_FOUNDATION.sql` - Manual migration (run in SQL Editor)
- `supabase/migrations/20260602_add_content_type_system.sql` - Migration file (reference)

### TypeScript Files
- `supabase/functions/_shared/contentTypeSystem.ts` - Core types & constants
- `supabase/functions/_shared/contentTypeTracking.ts` - Staleness & drift calculators
- `supabase/functions/get-weekly-strategy/index.ts` - Updated with Phase B logging

### Documentation
- This file: Implementation status and deployment guide

## Testing Checklist

### Phase A (Foundation)
- [ ] SQL migration runs without errors
- [ ] `target_type_mix` exists in `business_brand_profile`
- [ ] `accepts_reservations` and `is_active` exist in `business_programme_profiles`
- [ ] Existing Cafe Faust data has default values
- [ ] get-weekly-strategy still works (no regressions)

### Phase B (Tracking)
- [ ] get-weekly-strategy logs show Phase B analytics block
- [ ] Staleness calculation shows reasonable "days since" values
- [ ] Drift calculation shows percentages that sum correctly
- [ ] No errors in function logs
- [ ] Analytics fail gracefully if weekly_content_plans is empty

## Known Limitations

### Phase A & B
- **No behavior changes yet**: Posts are generated exactly as before
- **Limited historical data**: Drift/staleness need 8 weeks of typed posts to be accurate
- **Manual SQL migration**: Can't use `supabase db push` due to migration history mismatch

### Future Considerations
- May need to seed initial `content_type` values for historical posts (Phase D)
- Type system assumes weekly_content_plans.posts is an array (validate structure)
- Drift correction assumes ~4-7 posts per week (may need tuning for different volumes)

## Questions for User

1. **Database migration**: Should I run PHASE_A_CONTENT_TYPE_FOUNDATION.sql now, or wait for your review?
2. **Edge function deployment**: Ready to deploy get-weekly-strategy with Phase B logging?
3. **Phase C timing**: When should we implement type allocation (next session, or wait to see Phase B logs first)?

## Success Metrics

### Phase A & B
- ✅ No errors in function logs
- ✅ Phase B analytics appear in logs
- ✅ Staleness/drift numbers look reasonable
- ✅ System still generates plans correctly

### Phase C (Future)
- Strategy output includes `content_type` field on each post_idea
- Type distribution respects goal-mode eligibility
- Staleness influences type selection

### Phase D (Future)
- Generated posts vary in type week-over-week
- 8-week drift stays within ±10% of target for all types
- Cafe Faust sees OCCASION posts for Danish holidays
- RETENTION posts show insider knowledge
