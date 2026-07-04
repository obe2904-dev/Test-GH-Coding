# Manual Migration Required ⚠️

## Issue
The automated schema migration failed due to database connection issues. Please apply the migration manually.

## Quick Instructions

### Option 1: Supabase SQL Editor (Recommended)

1. **Open Supabase SQL Editor:**  
   https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql

2. **Open the migration file:**  
   `_FIX_BRAND_PROFILE_SCHEMA.sql`

3. **Copy all SQL content** (Cmd+A, Cmd+C)

4. **Paste into SQL Editor** (Cmd+V)

5. **Click "RUN"** (or press Cmd+Enter)

6. **Wait for completion** (~5-10 seconds)

7. **Verify results** at the bottom of the page

### Option 2: Supabase Dashboard Table Editor

If you prefer a visual approach:

1. Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/editor

2. Find table: `business_brand_profile`

3. Click the **"+ New Column"** button for each missing column

4. Add these columns (copy from `_FIX_BRAND_PROFILE_SCHEMA.sql`)

---

## What the Migration Does

Adds **58 missing columns** to `business_brand_profile` table:

**Core Columns (8):**
- tone_of_voice, content_focus, communication_goal
- target_audience, core_offerings, content_pillars
- things_to_avoid, image_preferences

**V2 Fields (5):**
- brand_essence_elaboration, identity_keywords, voice_constraints
- business_character, voice_rationale

**JSONB Columns (13):**
- audience_framework, voice_system, content_strategy
- posting_occasions, things_to_avoid_jsonb, etc.

**Quality & Tracking (3):**
- quality_status, generation_errors, version_hash

**Intelligence & Classification (10):**
- location_intelligence, business_model_type, etc.

**Stage-Specific (7):**
- commercial_baseline_mode, trigger_configuration
- posting_strategy, busy_pattern, audience_segments, etc.

---

## After Migration

Once complete, run this to verify:

\`\`\`bash
node _test_brand_profile_revenue_drivers.mjs
\`\`\`

Expected output:
- ✅ Brand profile generation succeeds
- ✅ Stage RD (Revenue Drivers) executes
- ✅ No "tone_of_voice column not found" error

---

## Estimated Time

**3-5 minutes** (copy + paste + verify)

---

## Need Help?

If migration fails in SQL Editor:
1. Check for error messages at bottom of page
2. Ensure you're logged into the correct Supabase project
3. Verify you have owner/admin permissions

---

**Ready to proceed?** Open the SQL Editor link above and paste the migration! 🚀
