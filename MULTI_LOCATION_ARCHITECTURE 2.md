# Multi-Location Business Support Analysis

## Current Architecture

### Database Schema (Confirmed)

**`business_locations` table**:
```sql
- id (PK)
- business_id (FK to businesses)
- is_primary BOOLEAN  ← Only ONE per business_id
- address_line1, postal_code, city, country
```

**Intelligence tables** (keyed by business_id only):
```
✅ business_brand_profile          → SHARED (correct)
❌ business_location_intelligence  → SHOULD be per-location
❌ business_programme_profiles     → SHOULD be per-location  
❌ menu_items_normalized           → SHOULD be per-location
```

### Critical Issue

**The system assumes 1 business_id = 1 physical location**

All intelligence tables use `business_id` only:
```sql
WHERE business_id = 'xxx'  -- Gets ONE row
```

But `business_locations` supports MULTIPLE locations per business_id!

## Problem Scenarios

### Scenario: Cafe Faust with 3 Locations

**Downtown** (current):
- Location: Waterfront (score 95)
- Service: Full dinner, brunch, lunch
- Strategy: 40% strengthen_brand (romantic atmosphere)

**Airport**:
- Location: Transport hub (score 90)
- Service: Fast lunch only, no dinner
- Strategy: 90% drive_footfall (quick service)

**Shopping Mall**:
- Location: Suburban (score 60)
- Service: Family brunch, casual lunch
- Strategy: 70% drive_footfall (family-friendly)

### Current Behavior (Broken)
- ❌ All 3 locations share waterfront score (95)
- ❌ Airport gets romantic dinner content (wrong!)
- ❌ Mall gets "cocktails ved åen" content (no waterfront!)
- ❌ Cannot customize per location

## Critical Bug Found!

### In My Phase 2 Implementation

**File**: [strategy/phase2/index.ts](supabase/functions/_shared/post-helpers/strategy/phase2/index.ts#L36)

```typescript
// Line 36 - BUG:
const businessIntelligence = await assembleBusinessIntelligence(supabase, context.business_id)
//                                                                        ^^^^^^^^^^^^^^^^^^
//                                                                        DOESN'T EXIST!
```

**Problem**: `WeekContext` interface has NO `business_id` field!

**Impact**: TypeScript error when deploying to production

## Solutions

### Immediate Fix: Add business_id to WeekContext

**1. Update type definition**:
```typescript
// types/strategy-types.ts
export interface WeekContext {
  // ADD THIS:
  business_id: string  // Business entity identifier
  
  // Existing fields:
  business_name: string
  week_number: number
  // ... rest
}
```

**2. Update context builder** (get-weekly-strategy/index.ts):
```typescript
const weekContext = {
  business_id: body.business_id,  // ADD THIS LINE
  
  week_number: weekNumber,
  business_name: businessName,
  // ... rest
}
```

**3. Update Phase 2 orchestrator** (already done):
```typescript
const businessIntelligence = await assembleBusinessIntelligence(
  supabase, 
  context.business_id  // Now available!
)
```

### Multi-Location Support (Future)

**Option A: Add location_id everywhere** (Flexible)

1. Add `location_id` to WeekContext:
```typescript
export interface WeekContext {
  business_id: string      // Business brand entity
  location_id?: string     // Specific physical location
  // ...
}
```

2. Migrate database schema:
```sql
ALTER TABLE business_location_intelligence 
  ADD COLUMN location_id UUID REFERENCES business_locations(id);

ALTER TABLE business_programme_profiles
  ADD COLUMN location_id UUID REFERENCES business_locations(id);

ALTER TABLE menu_items_normalized
  ADD COLUMN location_id UUID REFERENCES business_locations(id);
```

3. Update queries to use location_id when available:
```typescript
const query = locationId
  ? .eq('location_id', locationId)
  : .eq('business_id', businessId).eq('is_primary', true)
```

**Option B: Separate business_id per location** (Simple)

- Each location = different business_id in `businesses` table
- Share brand profile via new `parent_business_id` field
- Pro: Works with current schema
- Con: Duplicates some data

**Option C: Stay single-location** (Current)

- Fix immediate bug
- Design multi-location later when needed

## Recommended Action Plan

### Step 1: Fix Critical Bug (Now) ✅
- [ ] Add `business_id` to WeekContext interface
- [ ] Update get-weekly-strategy context builder
- [ ] Verify TypeScript compilation
- [ ] Test end-to-end flow

### Step 2: Decide Multi-Location Approach

**Questions for you**:
1. Do you have multi-location businesses NOW or PLANNED?
2. Should locations share brand profile? (likely YES)
3. Should locations have different menus/service periods? (likely YES)
4. Preferred approach: Option A (location_id) or Option B (separate IDs)?

### Step 3: Implement Multi-Location (If Needed)
- Design chosen architecture
- Migrate database schema
- Update UI for location selection
- Test with real multi-location business

## Immediate Next Steps

I'll fix the critical `business_id` bug now. This won't break existing single-location functionality and sets foundation for future multi-location support.

After that, we can discuss whether to implement full multi-location now or later.

**Proceed with bug fix?**
