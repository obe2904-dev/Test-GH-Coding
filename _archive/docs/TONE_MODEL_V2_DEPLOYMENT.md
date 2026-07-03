# Tone Model v2 Deployment Guide

## Pre-Deployment Checklist

### 1. Backup Database
```sql
-- Backup business_brand_profile table
pg_dump -U postgres -h <host> -t business_brand_profile > backup_brand_profile_$(date +%Y%m%d).sql
```

### 2. Review Migration
File: `supabase/migrations/20260108_add_tone_model_v2_column.sql`

**What it does:**
- Drops old constraint `tone_model_valid_structure` (if exists)
- Drops old index `idx_tone_model_keywords` (if exists)  
- Adds `tone_model` JSONB column (idempotent - safe if already exists)
- Creates comprehensive validation constraint with:
  - Required fields (11 total: 6 core + 5 metadata)
  - Array bounds (2-6, 3-8, 2-6, 2-6)
  - Enum validation (formality, emoji_level, source, confidence)
  - String length limits
- Creates GIN indexes for performance:
  - `idx_tone_model_keywords_lang` on primary_keywords + language
  - `idx_tone_model_confidence` on confidence field

**Safety:**
- ✅ Non-destructive (doesn't delete data)
- ✅ Backwards compatible (column nullable)
- ✅ Idempotent (can run multiple times safely)
- ⚠️ Will FAIL if existing tone_model data doesn't match v2 schema

---

## Deployment Steps

### Step 1: Test Migration Locally
```bash
# Connect to local Supabase database
psql postgresql://postgres:postgres@localhost:54322/postgres

# Run migration
\i supabase/migrations/20260108_add_tone_model_v2_column.sql

# Verify
\d business_brand_profile
-- Should see tone_model column with constraint tone_model_valid_structure_v2

# Check indexes
\di+ idx_tone_model*
-- Should see idx_tone_model_keywords_lang and idx_tone_model_confidence

# Test constraint
-- This should FAIL (missing metadata):
INSERT INTO business_brand_profile (business_id, tone_model) 
VALUES ('test-id', '{"primary_keywords": ["test"]}');

-- This should SUCCEED:
INSERT INTO business_brand_profile (business_id, tone_model) 
VALUES ('test-id', '{
  "primary_keywords": ["hyggelig", "varm"],
  "writing_rules": ["Rule 1", "Rule 2", "Rule 3"],
  "good_examples": ["Example 1", "Example 2"],
  "avoid_examples": ["Avoid 1", "Avoid 2"],
  "formality": "informal",
  "emoji_level": "moderate",
  "version": "2.0",
  "language": "da",
  "generated_at": "2026-01-08T14:30:00Z",
  "source": "website",
  "confidence": "high"
}');

-- Clean up test
DELETE FROM business_brand_profile WHERE business_id = 'test-id';
```

### Step 2: Handle Existing Data (If Any)

**Check for existing tone_model data:**
```sql
SELECT 
  business_id,
  tone_model IS NOT NULL as has_tone_model,
  jsonb_typeof(tone_model) as type,
  tone_model ? 'version' as has_version
FROM business_brand_profile
WHERE tone_model IS NOT NULL;
```

**If you have v1 tone_model data (no metadata):**

Option A: **Delete old data** (simplest - regenerate profiles):
```sql
-- Backup first!
UPDATE business_brand_profile SET tone_model = NULL WHERE tone_model IS NOT NULL;
-- Regenerate brand profiles to get v2 data
```

Option B: **Upgrade v1 to v2** (preserve existing data):
```sql
-- Add metadata to existing tone_model data
UPDATE business_brand_profile
SET tone_model = tone_model || jsonb_build_object(
  'version', '2.0',
  'language', COALESCE(primary_language, 'da'),
  'generated_at', COALESCE(updated_at, created_at)::text,
  'source', 'website',
  'confidence', 'medium',
  'notes', 'Upgraded from v1'
)
WHERE tone_model IS NOT NULL 
  AND NOT (tone_model ? 'version');
```

### Step 3: Deploy to Production

**Using Supabase CLI:**
```bash
# Link to production project
supabase link --project-ref <your-project-ref>

# Push migration
supabase db push

# Verify
supabase db diff
# Should show no changes (migration applied)
```

**Or manually via Supabase Dashboard:**
1. Go to Database > SQL Editor
2. Paste contents of `supabase/migrations/20260108_add_tone_model_v2_column.sql`
3. Run migration
4. Check for errors in output

### Step 4: Deploy Function Changes

**Deploy updated Edge Functions:**
```bash
# Deploy brand-profile-generator (updated parser with metadata)
supabase functions deploy brand-profile-generator

# Verify deployment
supabase functions list
```

### Step 5: Verify Production

**Test brand profile generation:**
```sql
-- Find a business without tone_model
SELECT business_id, name FROM businesses 
WHERE business_id NOT IN (
  SELECT business_id FROM business_brand_profile WHERE tone_model IS NOT NULL
)
LIMIT 1;

-- Trigger brand profile generation for that business (via API or manually)
-- Then check result:
SELECT 
  business_id,
  tone_model->>'version' as version,
  tone_model->>'language' as language,
  tone_model->>'confidence' as confidence,
  jsonb_array_length(tone_model->'primary_keywords') as keyword_count,
  jsonb_array_length(tone_model->'writing_rules') as rule_count
FROM business_brand_profile
WHERE business_id = '<test-business-id>';

-- Should see:
-- version: 2.0
-- language: da (or business primary_language)
-- confidence: high/medium/low
-- keyword_count: 2-6
-- rule_count: 3-8
```

---

## Post-Deployment Monitoring

### Key Metrics to Watch

**1. Constraint Violations:**
```sql
-- Check logs for constraint violations
-- (Supabase Dashboard > Logs > Database)
-- Look for: "violates check constraint tone_model_valid_structure_v2"
```

**2. Generation Success Rate:**
```sql
-- Count businesses with tone_model v2
SELECT 
  COUNT(*) FILTER (WHERE tone_model IS NOT NULL) as has_tone_model,
  COUNT(*) FILTER (WHERE tone_model->>'version' = '2.0') as has_v2,
  COUNT(*) as total
FROM business_brand_profile;
```

**3. Confidence Distribution:**
```sql
-- Check confidence levels
SELECT 
  tone_model->>'confidence' as confidence,
  COUNT(*) as count
FROM business_brand_profile
WHERE tone_model IS NOT NULL
GROUP BY tone_model->>'confidence'
ORDER BY count DESC;
```

**4. Language Distribution:**
```sql
-- Check languages (critical for multi-language expansion)
SELECT 
  tone_model->>'language' as language,
  COUNT(*) as count
FROM business_brand_profile
WHERE tone_model IS NOT NULL
GROUP BY tone_model->>'language'
ORDER BY count DESC;
```

---

## Rollback Plan

**If migration fails or causes issues:**

### Immediate Rollback (Remove Constraint):
```sql
-- Remove v2 constraint (allows NULL tone_model)
ALTER TABLE business_brand_profile 
DROP CONSTRAINT IF EXISTS tone_model_valid_structure_v2;

-- Drop v2 indexes
DROP INDEX IF EXISTS idx_tone_model_keywords_lang;
DROP INDEX IF EXISTS idx_tone_model_confidence;

-- Optionally: Clear all tone_model data
UPDATE business_brand_profile SET tone_model = NULL;
```

### Restore from Backup:
```bash
# Restore from backup file
psql -U postgres -h <host> -d postgres < backup_brand_profile_YYYYMMDD.sql
```

---

## Expected Timeline

- **Local Testing**: 15-30 minutes
- **Data Migration** (if needed): 5-15 minutes (depending on data size)
- **Production Deployment**: 5-10 minutes
- **Verification**: 10-20 minutes
- **Total**: 35-75 minutes

---

## Success Criteria

✅ Migration runs without errors  
✅ Constraint `tone_model_valid_structure_v2` exists  
✅ Indexes `idx_tone_model_keywords_lang` and `idx_tone_model_confidence` created  
✅ Existing data (if any) migrated or handled  
✅ New brand profiles generate with v2 structure (12 fields)  
✅ AI Generate V2 reads primary_keywords successfully  
✅ No constraint violations in logs  

---

## Troubleshooting

### Issue: Constraint violation on insert
**Symptom:** `violates check constraint "tone_model_valid_structure_v2"`

**Cause:** AI returned invalid tone_model (missing fields, wrong types, out-of-bound arrays)

**Fix:**
```sql
-- Check what's being inserted
SELECT * FROM pg_stat_activity WHERE query LIKE '%business_brand_profile%';

-- Verify Prompt B schema matches migration constraint
-- Check: supabase/functions/_shared/brand-profile/prompts/prompt-b.ts
```

### Issue: Old data fails constraint
**Symptom:** Migration fails with "check constraint ... for table business_brand_profile"

**Cause:** Existing tone_model data doesn't match v2 schema

**Fix:**
```sql
-- Clear old data before running migration
UPDATE business_brand_profile SET tone_model = NULL WHERE tone_model IS NOT NULL;

-- Or upgrade old data (see Step 2, Option B)
```

### Issue: Parser not generating metadata
**Symptom:** tone_model missing version/language fields

**Cause:** Parser fallback logic not updated or Edge Function not deployed

**Fix:**
```bash
# Redeploy function
supabase functions deploy brand-profile-generator

# Check function logs
supabase functions logs brand-profile-generator
```

---

## Contact & Support

**For issues:**
1. Check Supabase logs (Dashboard > Logs)
2. Review Edge Function logs (`supabase functions logs`)
3. Verify migration constraint matches Prompt B schema
4. Use rollback plan if critical

**Documentation:**
- `STRUCTURED_TONE_MODEL_IMPLEMENTATION.md` - Full v2 implementation guide
- `IDEA_GENERATION_ARCHITECTURE.md` - Design Decision #13 (v2)
