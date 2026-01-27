# Tone Model v2 - Step-by-Step Deployment Guide

## Current Status
✅ Edge Function deployed (brand-profile-generator with v2 parser)
⏳ Database migration pending

---

## Step 1: Run Database Migration

### A. Open SQL Editor
✅ **Already opened**: https://kvqdkohdpvmdylqgujpn.supabase.co/project/kvqdkohdpvmdylqgujpn/sql/new

### B. Get Migration SQL
Run this in your terminal:
```bash
cat /Users/olebaek/Test\ P2G\ 1/supabase/migrations/20260108_add_tone_model_v2_column.sql | pbcopy
```

Or manually copy from: `supabase/migrations/20260108_add_tone_model_v2_column.sql`

### C. Run in SQL Editor
1. **Paste** the migration SQL
2. **Click "Run"** (bottom right button)
3. **Verify**: Should see "Success. No rows returned"

**If you see an error**, copy it and I'll help troubleshoot.

---

## Step 2: Check Status

### Run Status Check
Paste and run this query:

```sql
-- Check if migration worked
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'tone_model_valid_structure_v2'
    ) THEN '✅ Migration successful'
    ELSE '❌ Migration not applied'
  END as status;

-- Check current Café Faust tone_model
SELECT 
  b.name,
  bp.tone_model IS NOT NULL as has_tone_model,
  bp.tone_model->>'version' as version
FROM businesses b
LEFT JOIN business_brand_profile bp ON bp.business_id = b.id
WHERE b.name ILIKE '%Faust%'
LIMIT 1;
```

---

## Step 3: Force Regeneration (if needed)

### If tone_model is NULL or missing version:

```sql
-- Clear cache to force regeneration
UPDATE business_brand_profile
SET version_hash = NULL
WHERE business_id IN (
  SELECT id FROM businesses WHERE name ILIKE '%Faust%'
);
```

Then in your app:
1. Go to business settings
2. Click "Regenerate Brand Profile"
3. Wait ~10-20 seconds
4. Check logs in Supabase

---

## Step 4: Verify v2 Data

### Check tone_model has all 12 fields:

```sql
SELECT 
  tone_model->>'version' as version,
  tone_model->>'language' as language,
  tone_model->>'confidence' as confidence,
  jsonb_array_length(tone_model->'primary_keywords') as keywords,
  jsonb_array_length(tone_model->'writing_rules') as rules,
  jsonb_array_length(tone_model->'good_examples') as good_examples,
  tone_model->'primary_keywords' as sample_keywords
FROM business_brand_profile
WHERE business_id IN (
  SELECT id FROM businesses WHERE name ILIKE '%Faust%'
);
```

**Expected result:**
- version: "2.0"
- language: "da"
- confidence: "high"/"medium"/"low"
- keywords: 2-6
- rules: 3-8
- good_examples: 2-6

---

## Troubleshooting

### Error: "constraint already exists"
✅ **This is fine!** Migration already applied. Proceed to Step 2.

### Error: "relation does not exist"
❌ Wrong database or table missing. Run in correct project SQL editor.

### Error: "permission denied"
❌ Need owner/admin access. Contact project owner.

### tone_model is NULL after regeneration
Check logs:
```sql
-- See recent brand profile generations
SELECT 
  business_id,
  updated_at,
  tone_model IS NOT NULL as has_tone_model
FROM business_brand_profile
ORDER BY updated_at DESC
LIMIT 5;
```

---

## Quick Commands Reference

### Copy migration SQL:
```bash
cat /Users/olebaek/Test\ P2G\ 1/supabase/migrations/20260108_add_tone_model_v2_column.sql | pbcopy
```

### Copy status check:
```bash
cat /Users/olebaek/Test\ P2G\ 1/check-tone-model-status.sql | pbcopy
```

### Open SQL Editor:
https://kvqdkohdpvmdylqgujpn.supabase.co/project/kvqdkohdpvmdylqgujpn/sql/new

---

## What's Next?

After successful deployment:
1. ✅ All new brand profiles get tone_model v2 automatically
2. ✅ AI Generate V2 reads primary_keywords for validation
3. ✅ Database enforces all constraints (bounds, enums, etc.)
4. 🚀 Ready for multi-language expansion

**Need help?** Share the SQL query results or error messages and I'll guide you through.
