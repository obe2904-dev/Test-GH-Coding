# 🚨 URGENT: Brand Profile Database Migration Required

## The Problem
The Brand Profile page code is working correctly, but the database columns don't exist!

## The Solution
Run ONE of these commands:

### Option 1: Use the helper script (easiest)
```bash
./apply-brand-voice-migration.sh
```

### Option 2: Use Supabase CLI
```bash
npx supabase db push
```

### Option 3: Manual SQL (if CLI doesn't work)
Go to your Supabase SQL Editor and run:

```sql
-- Add all 9 brand voice columns + lifecycle tracking
ALTER TABLE public.business_brand_profile
ADD COLUMN IF NOT EXISTS brand_essence TEXT,
ADD COLUMN IF NOT EXISTS tone_of_voice TEXT,
ADD COLUMN IF NOT EXISTS things_to_avoid TEXT,
ADD COLUMN IF NOT EXISTS core_offerings TEXT,
ADD COLUMN IF NOT EXISTS content_focus TEXT,
ADD COLUMN IF NOT EXISTS cta_style TEXT,
ADD COLUMN IF NOT EXISTS communication_goal TEXT,
ADD COLUMN IF NOT EXISTS image_preferences TEXT,
ADD COLUMN IF NOT EXISTS last_edited_by TEXT,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;
```

## What This Adds
These columns store the 9 canonical brand variables:
1. **brand_essence** - Core brand identity
2. **tone_of_voice** - Communication style
3. **things_to_avoid** - Guardrails
4. **core_offerings** - Products/services
5. **content_focus** - Content themes
6. **cta_style** - Call-to-action preference
7. **communication_goal** - Overall objective
8. **image_preferences** - Visual style
9. **last_edited_by** - Track AI vs user edits
10. **last_edited_at** - Last edit timestamp

## Verification
After running the migration, go to your Supabase Table Editor:
1. Open `business_brand_profile` table
2. Verify all 10 columns exist
3. Try saving data in the Brand Profile page
4. Refresh and verify data persists

## Need Help?
If the migration fails, check:
- You're connected to the correct Supabase project
- Your database connection is active
- You have admin permissions
