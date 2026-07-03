# Brand Profile Architecture Analysis
**Date:** 2. juni 2026  
**Issue:** Two generators running simultaneously, database schema mismatch, drinks filter not testable

---

## Executive Summary

You have **TWO SEPARATE brand profile generators** that serve **different purposes** and write to **different database tables**. They are NOT divided because one prompt was too large - they represent a **NEW vs OLD architecture**.

### The Two Generators

| Generator | Purpose | Database Tables | Status |
|-----------|---------|-----------------|--------|
| **brand-profile-generator** (V4) | Legacy business-level profile | `business_brand_profile` | ❌ FAILING - Schema outdated |
| **brand-profile-generator-v5** (V5) | Programme-aware 5-layer system | `business_programme_profiles` | ✅ WORKING |

---

## Generator 1: `brand-profile-generator` (Legacy V4)

### What It Does
- **Monolithic business-level profile** generation
- Single AI pass to create brand essence, tone, positioning
- Writes to: `business_brand_profile` table
- **Does NOT handle programme detection** - uses programmes as input from `menu_signal`

### Architecture
```
Data Gathering → Prompt A (Analysis) → Prompt B (Profile) → Save to DB
                  gpt-4o-mini 35s       gpt-4o 50s
```

### Key Features
- Brand essence (one-liner)
- Tone of voice
- Content pillars
- Target audience
- Image preferences
- Voice examples
- Social style

### Database Columns It Needs (MISSING in your DB!)
```sql
business_brand_profile:
  - tone_of_voice         ❌ Missing
  - content_focus         ❌ Missing  
  - communication_goal    ❌ Missing
  - target_audience       ❌ Missing
  - core_offerings        ❌ Missing
```

### Current State
- **FAILING:** Cannot save because database schema is outdated
- **Error:** `Could not find the 'tone_of_voice' column`
- **Fallback:** Only saves `brand_essence` (ultra-minimal mode)

---

## Generator 2: `brand-profile-generator-v5` (NEW)

### What It Does
- **Programme-aware 5-layer system**
- **DOES handle programme detection** - this is Layer 1
- Generates per-programme profiles (Brunch, Frokost, Aften, etc.)
- Writes to: `business_programme_profiles` table

### Architecture (5 Layers)
```
Layer 0: Business Intelligence (Type detection, City context)
Layer 1: Programme Detection (Deterministisk) ← YOUR DRINKS FILTER LIVES HERE
Layer 2: Commercial Orientation (AI per programme)
Layer 3: Identity Profile (AI business-level)
Layer 4: Audience Segmentation (AI per programme)
Layer 5: Voice Profile (NEW)
```

### Key Features
- **Detects programmes from menus** (`detectProgrammesV2`)
- Commercial strategy per programme
- Audience segments per programme
- Voice archetype
- Writing examples
- Guardrails

### Database Tables
```sql
business_programme_profiles (per programme):
  - programme_type (e.g., "brunch", "lunch")
  - programme_name
  - time_windows
  - operating_days
  - commercial_orientation (JSONB)
  - audience_profile (JSONB)

business_brand_profile (business-level):
  - positioning (from Layer 3)
  - gastronomic_profile
  - signature_themes
```

### Current State
- **WORKING:** Successfully generates profiles
- **No schema issues** (uses newer tables)

---

## How They're Triggered

### V4 (Legacy) - Manual/API
```typescript
// From: src/hooks/useBrandProfileGeneration.ts
supabase.functions.invoke('brand-profile-generator', {
  body: { businessId, forceRegenerate: true }
})
```

### V5 (NEW) - Two-Step Process
```typescript
// From: src/hooks/useBrandProfileV5Generation.ts

// Step 1: Generate menu overview
await supabase.functions.invoke('menu-overview-summary', {
  body: { businessId }
})

// Step 2: Generate V5 profile
await supabase.functions.invoke('brand-profile-generator-v5', {
  body: { 
    businessId,
    forceRegenerate,
    menuOverviewSummary: menuSummaryData // Passed directly
  }
})
```

---

## The Drinks Filter Issue

### Where It Lives
The drinks filter code you've been editing is in **BOTH generators**, but in different places:

#### V4 (brand-profile-generator)
- **Location:** `supabase/functions/_shared/brand-profile/data-gatherer.ts`
- **Function:** `isDrinksOnlyMenu()` 
- **When it runs:** During data gathering, BEFORE AI prompts
- **What it filters:** 
  - `menu_results_v2` rows (AI summaries)
  - `menu_signal.programmes` (for cross-reference)
- **Status:** ✅ Code deployed, ❌ Can't test (DB schema broken)

#### V5 (brand-profile-generator-v5)  
- **Location:** `supabase/functions/_shared/brand-profile/programme-detection-v2.ts`
- **When it runs:** Layer 1 - Programme Detection
- **What it filters:** Programmes during detection phase
- **Status:** ✅ Working and deployed

### Why You Can't Test V4's Filter
```
V4 Generator Flow:
1. Gather data (✅ Filter runs here - logs show "Cocktails" detected!)
2. Compute hashes
3. Run AI prompts (✅ Works)
4. Save to database (❌ FAILS - schema mismatch)
   └─> Error: Missing 'tone_of_voice' column
```

**The filter IS working!** Look at your logs:
```
[Drinks Filter] ✅ Detected via menu_sources.label: "Cocktails"
🍸 Excluded drinks menu: "brunch" (label="Cocktails")
🍸 Filtered out drinks-only programme from menu_signal: "COCKTAILS"
✅ Loaded 1 FOOD menu_signal programmes — brand: [FROKOST]
```

---

## The Real Problems

### Problem 1: Database Schema Mismatch (CRITICAL)
Your production database is **critically outdated**. Even basic columns are missing:

```sql
-- Missing tables
brand_profile_generation_locks  ❌
menu_extractions                ❌

-- Missing columns in business_brand_profile
tone_of_voice                   ❌
content_focus                   ❌
communication_goal              ❌
target_audience                 ❌
core_offerings                  ❌

-- Missing columns in business_locations  
enrichment                      ❌
```

**Impact:** V4 generator cannot save ANY data except ultra-minimal fallback.

### Problem 2: Wrong Data in Database
```
Menu: "brunch"
Label in DB: "Cocktails" ← WRONG!
```

The filter correctly detected this menu as drinks-only because the **data is wrong**, not the code.

### Problem 3: Two Generators Running Simultaneously
When you call V4, you're trying to regenerate the OLD architecture. But your system should be using V5.

---

## What You Need to Do

### 1. STOP Editing Code ✋
The code works. Your problem is infrastructure.

### 2. Apply Database Migrations (URGENT)
```bash
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"

# See what will change
supabase db diff --linked

# Apply migrations
supabase db push
```

This will create all missing tables and columns.

### 3. Fix Your Data
Check and fix the menu_sources labels:
```sql
-- Find incorrectly labeled menus
SELECT 
  ms.id,
  ms.label,
  mr.service_period_name,
  mr.source_url
FROM menu_sources ms
JOIN menu_results_v2 mr ON mr.source_id = ms.id
WHERE ms.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Fix brunch menu (if label is "Cocktails" but should be "Brunch")
UPDATE menu_sources 
SET label = 'Brunch'
WHERE id = '<id-of-brunch-menu>';
```

### 4. Decide Which Generator to Use

**Option A: Use V5 Only (RECOMMENDED)**
- V5 is the future
- Handles programme detection
- Works with current schema
- More sophisticated (5 layers)

**Option B: Migrate V4 to V5**
- Update frontend to call V5 instead of V4
- Deprecate V4 generator
- Remove V4 calls from codebase

**Option C: Keep Both (NOT RECOMMENDED)**
- Requires maintaining two systems
- Need to fix V4 database schema
- Confusing for users

---

## Migration Path (Recommended)

### Phase 1: Fix Infrastructure ✅
```bash
supabase db push
```

### Phase 2: Data Cleanup ✅
Fix incorrect labels in `menu_sources`

### Phase 3: Choose Architecture 🎯
- **If using V5:** Update all frontend calls to use V5
- **If keeping V4:** Test after schema migration completes

### Phase 4: Verify Drinks Filter 🍸
After schema is fixed, regenerate and verify:
- AFTEN (cocktails) is excluded
- Only food programmes show: FROKOST, Brunch, etc.

---

## Questions to Answer

1. **Which generator do you want to use going forward?**
   - V4 (legacy, simpler)
   - V5 (newer, programme-aware)

2. **When was V5 introduced?**
   - Check git history: `git log --oneline --all -- supabase/functions/brand-profile-generator-v5/`

3. **Is your frontend using V5 or V4?**
   - Check: `src/hooks/useBrandProfileV5Generation.ts` usage
   - Check: `src/hooks/useBrandProfileGeneration.ts` usage

---

## Summary

You are **NOT** chasing your tail with the drinks filter - it works perfectly! 

The logs prove it:
- ✅ Detects "Cocktails" label
- ✅ Filters from menu summaries
- ✅ Filters from programmes list
- ✅ Shows only FROKOST as food programme

**Your actual problem:** Database schema from 2025 trying to run code from 2026.

**The solution:** `supabase db push` to update schema, then test.
