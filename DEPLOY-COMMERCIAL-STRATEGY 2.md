# Commercial Strategy AI Deployment Guide

**Purpose:** Deploy AI-powered commercial strategy analysis to production  
**Date:** 5. maj 2026  
**Estimated Time:** 15 minutes

---

## Overview

This deployment adds AI-powered commercial strategy analysis that runs automatically during brand profile generation. The AI analyzes business characteristics, menu, location, and operations to recommend optimal commercial content triggers.

---

## Step 1: Database Migration ⚙️

### Option A: Via Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Run Migration SQL**
   
   Copy and paste this SQL:

   ```sql
   -- Add AI reasoning field to business_brand_profile
   ALTER TABLE business_brand_profile 
   ADD COLUMN IF NOT EXISTS commercial_strategy_reasoning TEXT;

   COMMENT ON COLUMN business_brand_profile.commercial_strategy_reasoning IS 
   'AI-generated explanation of why this commercial configuration was recommended. Generated during brand profile creation.';

   -- Add index for businesses that need review
   CREATE INDEX IF NOT EXISTS idx_commercial_strategy_review 
   ON business_brand_profile(business_id) 
   WHERE commercial_strategy_reasoning IS NULL OR commercial_baseline_mode IS NULL;

   -- Update existing records with placeholder text
   UPDATE business_brand_profile
   SET 
     commercial_strategy_reasoning = 'Auto-configured based on business characteristics. Regenerate brand profile for AI-analyzed recommendations.',
     trigger_updated_by = 'migration'
   WHERE trigger_configuration IS NOT NULL 
     AND commercial_strategy_reasoning IS NULL;
   
   -- Verify the changes
   SELECT 
     COUNT(*) as total_businesses,
     COUNT(commercial_strategy_reasoning) as with_reasoning,
     COUNT(commercial_baseline_mode) as with_mode
   FROM business_brand_profile;
   ```

4. **Click "Run"**
   - Should see success message
   - Should see results showing business counts

5. **Verify Migration**
   
   Run this query to check:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'business_brand_profile' 
   AND column_name = 'commercial_strategy_reasoning';
   ```
   
   Should return one row showing the column exists.

### Option B: Via Supabase CLI

```bash
# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Push migration
supabase db push
```

---

## Step 2: Deploy Edge Functions 🚀

### Option A: Via Supabase CLI (Recommended)

1. **Check you're in project root**
   ```bash
   cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"
   pwd
   ```

2. **Link to project (if needed)**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. **Deploy brand-profile-generator function**
   ```bash
   supabase functions deploy brand-profile-generator
   ```
   
   This will upload the updated edge function with Stage CS (Commercial Strategy) integration.

4. **Verify deployment**
   ```bash
   supabase functions list
   ```
   
   Should show `brand-profile-generator` with recent deployment timestamp.

### Option B: Via Supabase Dashboard

1. **Navigate to Edge Functions**
   - Supabase Dashboard → Edge Functions
   - Find `brand-profile-generator`

2. **Update function code**
   - Click on function
   - Replace code with contents from:
     `supabase/functions/brand-profile-generator/index.ts`
   
3. **Update shared modules**
   - Upload new files:
     - `_shared/brand-profile/prompts/commercial-strategy-prompt.ts`
     - `_shared/brand-profile/commercial-strategy-analyzer.ts`

4. **Deploy**
   - Click "Deploy" button

---

## Step 3: Test the Implementation 🧪

### 3.1 Choose a Test Business

Pick a business to test with (preferably one with good data):
- Has menu items
- Has business_operations data
- Has business_location_intelligence data

### 3.2 Regenerate Brand Profile

1. **Open your app**
   - Navigate to Brand Profile page
   - Select the test business

2. **Click "Regenerate Brand Profile"**
   - Wait for generation to complete (30-60 seconds)
   - Watch for any errors

3. **Check Edge Function Logs** (Optional)
   
   In Supabase Dashboard → Edge Functions → brand-profile-generator → Logs:
   
   Look for these log messages:
   ```
   💰 Stage CS: starting commercial strategy analysis...
   ✅ Stage CS: saved commercial strategy (mode=booking_push, confidence=0.92)
   💡 Stage CS: Your upscale restaurant with reservations should focus...
   ```

### 3.3 Verify UI Display

After regeneration completes, the Brand Profile page should show:

1. **Commercial Strategy Section** at bottom
2. **AI Reasoning Box** (blue background) with:
   - 🤖 emoji
   - "AI-Recommended Commercial Strategy" header
   - Badge showing "AI-configured"
   - 3-4 sentence explanation like:
     > "Your upscale restaurant with reservations and outdoor seating should focus primarily on booking conversion. Key opportunities include Valentine's Day, Mother's Day, and other romantic occasions. When warm weather arrives, pivot to footfall content showcasing your terrace."

3. **Baseline Mode** (booking_push / footfall_push / balanced)
4. **Trigger Configuration** with 7 toggles

### 3.4 Test Manual Override

1. **Click "Edit Strategy"**
2. **Change a trigger or baseline mode**
3. **Click "Save"**
4. **Verify badge changes to "User-edited"**

---

## Step 4: Verify Database Changes 📊

Run these queries in Supabase SQL Editor:

### Check AI-configured businesses
```sql
SELECT 
  b.business_name,
  bbp.commercial_baseline_mode,
  bbp.trigger_updated_by,
  LEFT(bbp.commercial_strategy_reasoning, 100) as reasoning_preview
FROM business_brand_profile bbp
JOIN businesses b ON b.id = bbp.business_id
WHERE bbp.commercial_strategy_reasoning IS NOT NULL
ORDER BY bbp.updated_at DESC
LIMIT 10;
```

### Check trigger configuration
```sql
SELECT 
  business_id,
  commercial_baseline_mode,
  jsonb_pretty(trigger_configuration) as triggers,
  trigger_updated_by,
  trigger_updated_at
FROM business_brand_profile
WHERE trigger_configuration IS NOT NULL
LIMIT 3;
```

---

## Troubleshooting 🔧

### Migration Issues

**Error: "column already exists"**
- Safe to ignore if using `IF NOT EXISTS`
- Column was added in a previous attempt

**Error: "permission denied"**
- Ensure you're logged in as admin/owner
- Check RLS policies if applicable

### Edge Function Issues

**Error: "Function not found"**
- Verify function deployed: `supabase functions list`
- Check function name matches exactly: `brand-profile-generator`

**Error: "OpenAI API error"**
- Check `OPENAI_API_KEY` environment variable is set
- Verify API key is valid and has credits

**Stage CS logs show "⚠️ Stage CS exception"**
- Non-fatal error - brand profile still saves
- Check logs for specific error message
- Common causes:
  - Missing business data
  - OpenAI timeout
  - Invalid menu data

### UI Issues

**AI reasoning box doesn't appear**
- Verify `commercial_strategy_reasoning` has value in database
- Check browser console for errors
- Clear browser cache and reload
- Verify you regenerated the brand profile (old profiles won't have AI analysis)

**Badge shows "User-edited" instead of "AI-configured"**
- Check `trigger_updated_by` column value
- Should be 'ai' for AI-generated
- If you manually edited, it correctly shows "User-edited"

**TypeScript errors in console**
- Restart development server: `npm run dev`
- Clear `.next` cache if using Next.js
- Verify all TypeScript files compiled

---

## Rollback Procedure 🔄

If you need to rollback:

### 1. Remove Database Column (Optional)
```sql
-- Only if you want to completely remove the feature
ALTER TABLE business_brand_profile 
DROP COLUMN IF EXISTS commercial_strategy_reasoning;

DROP INDEX IF EXISTS idx_commercial_strategy_review;
```

### 2. Revert Edge Function
```bash
# Checkout previous version from git
git checkout HEAD~1 supabase/functions/brand-profile-generator/index.ts

# Redeploy
supabase functions deploy brand-profile-generator
```

### 3. Revert UI Changes
```bash
# Checkout previous versions
git checkout HEAD~1 src/components/brandProfile/CommercialStrategySection.tsx
git checkout HEAD~1 src/components/brandProfile/BrandProfileDisplay.tsx
git checkout HEAD~1 src/pages/dashboard/BrandProfilePageV5.tsx

# Restart dev server
npm run dev
```

---

## Success Criteria ✅

Deployment is successful when:

- [x] Database migration runs without errors
- [x] `commercial_strategy_reasoning` column exists in `business_brand_profile`
- [x] Edge function deploys without errors
- [x] Brand profile regeneration completes successfully
- [x] Logs show "Stage CS: saved commercial strategy"
- [x] UI displays AI reasoning box with blue background
- [x] Badge shows "AI-configured" for new profiles
- [x] Manual edits change badge to "User-edited"
- [x] No console errors in browser

---

## Next Steps 🎯

After successful deployment:

1. **Monitor performance**
   - Check Stage CS execution time in logs
   - Verify AI recommendations make sense for different business types

2. **Test different business types**
   - Upscale restaurant → Should recommend booking_push
   - Casual café → Should recommend footfall_push
   - Business with outdoor seating → Weather trigger enabled

3. **Gather feedback**
   - Review AI reasoning quality
   - Check if recommendations align with business reality
   - Note any improvements needed

4. **Update documentation**
   - Mark PROMPT-GOVERNANCE-CHECKLIST.md sections as verified
   - Update AI-COMMERCIAL-STRATEGY-IMPLEMENTATION.md with production learnings

---

## Support & Documentation

- **Implementation Guide:** `AI-COMMERCIAL-STRATEGY-IMPLEMENTATION.md`
- **Prompt Checklist:** `PROMPT-GOVERNANCE-CHECKLIST.md`
- **Original System Design:** `COMMERCIAL-MODE-IMPLEMENTATION-GUIDE.md`
- **UI Documentation:** `BRAND-PROFILE-COMMERCIAL-UI-SUMMARY.md`

For issues, check edge function logs in Supabase Dashboard.
