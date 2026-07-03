# Investigation Report: business-rules-engine.ts and loyalty field
**Date**: 2026-06-30  
**Type**: Discovery / Read-only Analysis  
**Status**: Complete

---

## Question 1: Which business-rules-engine.ts is live?

### 1.1 All files matching `business-rules-engine*`

Two files exist:
1. `/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud/supabase/functions/_shared/post-helpers/business-rules-engine.ts`
2. `/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud/supabase/functions/_shared/content-planning/business-rules-engine.ts`

### 1.2 Version identification

**File 1 (post-helpers/business-rules-engine.ts)** = **Version B**
- Contains `export function generateSlotsFromRevenueDrivers()` (line 253)
- Contains `export function generateSlotsFromRevenueDriversUnified()` (line 752)
- Exports `PostingStrategy` interface (line 89)
- Exports `BookingModel` interface (line 104)
- Defines `type GoalMode = 'drive_footfall' | 'build_brand' | 'retain_loyalty'` (line 18)
- Contains complex `RevenueDrivers` schema with `primary_revenue_moments` / `secondary_revenue_moments` arrays (lines 153-178)
- Generates Slot D with `goal_mode: 'retain_loyalty'` (line 370)

**File 2 (content-planning/business-rules-engine.ts)** = **Version A**
- Imports from `'./event-classifier.ts'` (line 12)
- Exports class `BusinessRulesEngine` with a different schema (line 94)
- Uses simplified `RevenueDriver` / `RevenueDrivers` types with `primary` / `secondary` / `tertiary` fields (lines 21-60)
- Has `createFlexibleRule()` method whose output includes `content_angle: 'brand_builder'` (line 257)
- Does NOT export `generateSlotsFromRevenueDrivers`, `generateSlotsFromRevenueDriversUnified`, `PostingStrategy`, or `BookingModel`
- Does NOT define `GoalMode` type
- Does NOT have the `retain_loyalty` goal concept

### 1.3 Resolved import path from phase1.ts

**phase1.ts location**: `supabase/functions/_shared/post-helpers/strategy/phase1.ts`

**Import line** (line 39):
```typescript
import { generateSlotsFromRevenueDrivers, generateSlotsFromRevenueDriversUnified, type PostingStrategy, type BookingModel } from '../business-rules-engine.ts';
```

**Resolved absolute path**: `supabase/functions/_shared/post-helpers/business-rules-engine.ts` (Version B)

### 1.4 Confirmation: Version B is the live file

Yes, the resolved file matches **Version B**.

**Evidence** - the `type GoalMode` line from the resolved file (line 18):
```typescript
type GoalMode = 'drive_footfall' | 'build_brand' | 'retain_loyalty';
```

### 1.5 All files importing from business-rules-engine

Only 2 TypeScript files import from business-rules-engine:

1. **`supabase/functions/_shared/post-helpers/strategy/phase1.ts`** (line 39)
   - Imports: `generateSlotsFromRevenueDrivers`, `generateSlotsFromRevenueDriversUnified`, `PostingStrategy`, `BookingModel`
   - Resolves to: `supabase/functions/_shared/post-helpers/business-rules-engine.ts` (**Version B**)

2. **`supabase/functions/_shared/post-helpers/strategy/phase2/phase2a.ts`** (line 13)
   - Imports: `BusinessRulesEngine`, `WeekContext`, `DayAllocationRule`
   - Resolves to: `supabase/functions/_shared/post-helpers/business-rules-engine.ts` (**Version B**)

### 1.6 Dead code assessment

**Version A is dead code, confirmed unreferenced.**

- Searched entire codebase for any imports from `content-planning/business-rules-engine` - **0 matches found**
- Searched for any reference to the path `content-planning/business-rules-engine` - **0 matches found**
- No dynamic `import()` statements reference this file
- No re-exports from index/barrel files
- The file is completely isolated and unused in the codebase

### 1.7 Filename disambiguation

Both files have the **exact same filename** `business-rules-engine.ts` but in different directories:

- **Version B (LIVE)**: `supabase/functions/_shared/post-helpers/business-rules-engine.ts`
- **Version A (DEAD)**: `supabase/functions/_shared/content-planning/business-rules-engine.ts`

---

## Question 2: Is posting_strategy.slot_windows.loyalty live in stored data?

### 2.1 Code that WRITES posting_strategy

**File**: `supabase/functions/brand-profile-generator/index.ts`

**Location**: Lines 2204-2378 (Stage PS - Posting Strategy generation)

**Function**: AI-generated posting strategy using OpenAI GPT-4o-mini

**Evidence of AI prompt instructing loyalty field** (lines 2243-2250):
```javascript
  "posting_strategy": {
    "booking_model_type": "${bookingModelType}",
    "slot_windows": {
      "footfall_primary": "Day-Day HH:MM",
      "footfall_secondary": "Day-Day HH:MM",
      "brand_builder": "Day HH:MM",
      "loyalty": "Day-Day HH:MM"
    },
```

**Database write operation** (line 2378):
```typescript
posting_strategy: ps ?? null,
```

The AI prompt explicitly asks the model to generate a `loyalty` key under `slot_windows`.

### 2.2 Schema confirms loyalty field generation

Yes, the AI generation prompt explicitly instructs the model to produce a `loyalty` key under `slot_windows`.

**Quoted prompt text** (lines 2243-2249):
```
"slot_windows": {
  "footfall_primary": "Day-Day HH:MM",
  "footfall_secondary": "Day-Day HH:MM",
  "brand_builder": "Day HH:MM",
  "loyalty": "Day-Day HH:MM"
},
```

### 2.3 Database query results

**Query 1** - Count rows with `posting_strategy` containing `loyalty`:
```sql
select business_id, posting_strategy
from business_brand_profile
where posting_strategy is not null
  and posting_strategy -> 'slot_windows' ? 'loyalty';
```

**Result**: **0 rows** match

**Query 2** - Total rows with `posting_strategy`:
```sql
select count(*) as total_with_posting_strategy
from business_brand_profile
where posting_strategy is not null;
```

**Result**: **0 rows** (denominator = 0)

### 2.4 Denominator

**Total businesses with `posting_strategy` populated**: **0**

This means the `posting_strategy` column exists in the schema (added by migration `20260608000002_add_posting_strategy_and_busy_pattern.sql`) but has never been populated with data in the production database.

### 2.5 Impact assessment

**NO** - Renaming the `loyalty` field in the TypeScript `PostingStrategy` interface will cause **0** existing businesses' stored `slot_windows.loyalty` value to silently stop being read at runtime.

**Reason**: N = 0 (no businesses have `posting_strategy` data in the database)

### 2.6 Migration necessity

Since N = 0, **no JSONB key-rename migration is needed** for existing data.

However, the AI-generation writer code in `brand-profile-generator/index.ts` (lines 2243-2249) **DOES need to change** to stop producing the `loyalty` key going forward. 

**Evidence from code**: The AI prompt template at lines 2243-2250 explicitly instructs the model to generate:
```javascript
"loyalty": "Day-Day HH:MM"
```

If the TypeScript interface renames this field, the prompt must be updated to match, otherwise future AI generations will produce a field that the TypeScript code won't read.

**Code that reads the loyalty field** (`supabase/functions/_shared/post-helpers/business-rules-engine.ts`, line ~370):
```typescript
const flexibleTiming = psWindows?.loyalty ?? bmWindows?.loyalty ?? getFlexibleTiming(strategy.preferred_days, [
  primaryTiming.timing_window,
  slotBTiming.timing_window,
  brandBuilderTiming,
])
```

This assigns the loyalty timing window to Slot D, which uses `goal_mode: 'retain_loyalty'`.

---

## Summary / recommendation

**Safe to proceed with renaming — but with one condition:**

1. ✅ **Version A is confirmed dead code** - `content-planning/business-rules-engine.ts` can be safely deleted with no impact
2. ✅ **Version B is the only live file** - `post-helpers/business-rules-engine.ts` is imported by phase1.ts and phase2a.ts
3. ✅ **Zero data migration required** - 0 businesses have `posting_strategy` populated in production database
4. ⚠️ **AI prompt must be updated** - If renaming the `loyalty` field in TypeScript, the AI generation prompt in `brand-profile-generator/index.ts` (line 2249) must be updated simultaneously to prevent schema drift

### Recommendation

The planned fix is safe to proceed, but ensure the brand-profile-generator AI prompt is updated atomically with any TypeScript interface changes to maintain schema consistency for future data generation.

---

## Investigation methodology

- File system search for all `business-rules-engine*` files
- Static code analysis of imports across the entire codebase
- Database queries against production (`--linked`) and local databases
- AI prompt analysis in brand-profile-generator
- Line-by-line code inspection with exact line number references

**No files were modified during this investigation** (read-only analysis only).
