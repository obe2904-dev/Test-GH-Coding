# Weekly Plan Generation - Two-Step Process Explained

## You're Correct! Here's What's Happening

Weekly Plan generation has **TWO separate steps**:

### Step 1: Generate Strategy (get-weekly-strategy)
**URL:** `https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy`

**What it does:**
- Fetches business_brand_profile (including content_strategy)
- Calculates weekly strategy modulation
- Generates the strategic rationale TEXT:
  - **If content_strategy exists:** "Baseline-strategi: 57% bookinger, 27% brand, 17% stamgæster"
  - **If content_strategy missing:** "Ingen baseline content strategy fundet — standardfordeling anvendt."
- Saves everything to `weekly_strategies` table
- Returns a `strategy_id`

**Key Point:** The text message is generated HERE and saved to the database.

### Step 2: Generate Plan (generate-weekly-plan)
**URL:** `https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/generate-weekly-plan`

**What it does:**
- Takes the `strategy_id` from Step 1
- Generates the actual 3-4 social media posts
- Uses the strategy to determine post types
- Saves posts to `weekly_content_plans` table

**Key Point:** This step uses the EXISTING strategy - it does NOT regenerate the strategy text.

---

## The Problem

Your timeline was:

1. **12:15** - Generated strategy (content_strategy was NULL) → Saved "Ingen baseline content strategy fundet"
2. **12:45** - Fixed content_strategy in database
3. **12:50** - Clicked "Regenerate Weekly Plan"

When you clicked "Regenerate Weekly Plan", the UI probably:
- ✅ Called `generate-weekly-plan` → New posts generated
- ❌ Did NOT call `get-weekly-strategy` → Old strategy reused

So you have:
- **NEW plan** (posts) generated at 12:50
- **OLD strategy** (text) generated at 12:15

The plan is using the old strategy that still has the fallback message baked into it.

---

## The Solution

You need to regenerate the **STRATEGY**, not just the plan.

### Option 1: Check UI for "Regenerate Strategy" button
Look in the UI - there might be a separate button to regenerate the strategy itself.

### Option 2: Delete the old strategy
Run this SQL to delete the old strategy:

```sql
-- First, find the week_start date you're working with
SELECT week_start, generated_at, strategic_brief->>'week_strategic_rationale' as rationale
FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY generated_at DESC
LIMIT 1;

-- Then delete it (replace the date)
DELETE FROM weekly_strategies 
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND week_start = 'YYYY-MM-DD';  -- Use the date from above query
```

Then regenerate in the UI - this will force it to create a NEW strategy with the correct content_strategy data.

### Option 3: Generate for a different week
Generate a plan for NEXT week instead - this will create both a new strategy AND new plan.

---

## Verification Query

Run [_DIAGNOSE_STRATEGY_VS_PLAN_TIMING.sql](_DIAGNOSE_STRATEGY_VS_PLAN_TIMING.sql) to see the exact timestamps:

**Expected result (confirming your hypothesis):**

| week_start | strategy_time | plan_time | diagnosis |
|------------|---------------|-----------|-----------|
| 2026-06-16 | 12:15:17 | 12:50:00 | 🔴 MISMATCH: Plan regenerated but using OLD strategy! |

This confirms:
- Strategy was generated BEFORE the fix (12:15)
- Plan was regenerated AFTER the fix (12:50)
- But plan is still using the old strategy

---

## Architecture Insight

This two-step architecture exists because:

1. **Strategy generation is expensive** (requires AI calls to analyze context)
2. **Plan generation can be fast** (just use the existing strategy to generate posts)
3. Users might want to regenerate posts WITHOUT recalculating the entire strategy

But in this case, you DO want to regenerate the strategy because the underlying data (content_strategy) has changed.

---

## Bottom Line

The UI's "Regenerate Weekly Plan" button is regenerating the **PLAN** (posts) but not the **STRATEGY** (the analysis and rationale text).

You need to either:
1. Find a way to regenerate the strategy specifically
2. Delete the old strategy record and start fresh
3. Generate for a new week (which creates both strategy and plan from scratch)
