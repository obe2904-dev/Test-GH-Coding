# Database Migration Deployment Guide - Layers 1-4

**Date:** May 6, 2026  
**Status:** Ready to Deploy  
**Purpose:** Deploy database schema for programme-aware brand profile system

---

## Migrations to Deploy

### 1. `20260506_create_business_programme_profiles.sql`
**Purpose:** Create table for programme-level data (Layers 1, 2, 4)  
**Impact:** New table, no existing data affected  
**Risk:** LOW

### 2. `20260506_add_positioning_column.sql`
**Purpose:** Add positioning column to business_brand_profile (Layer 3)  
**Impact:** Adds nullable column to existing table  
**Risk:** LOW

---

## Deployment Options

### Option A: Supabase Dashboard SQL Editor (RECOMMENDED)

**Steps:**
1. Go to https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn
2. Navigate to **SQL Editor**
3. Copy and paste the SQL from each migration file
4. Execute in order:
   - First: `20260506_create_business_programme_profiles.sql`
   - Second: `20260506_add_positioning_column.sql`
5. Verify: Check Tables section shows `business_programme_profiles` table
6. Verify: Check `business_brand_profile` has `positioning` column

**Why this method:**
- Direct execution, no migration history conflicts
- Can verify results immediately
- Safe rollback if needed (just DROP the column/table)

---

### Option B: Direct psql Connection

**Get Connection String:**
```bash
# From Supabase Dashboard:
# Settings → Database → Connection String (Postgres)
```

**Execute migrations:**
```bash
psql "postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \
  -f supabase/migrations/20260506_create_business_programme_profiles.sql

psql "postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \
  -f supabase/migrations/20260506_add_positioning_column.sql
```

---

### Option C: Repair Migration History (Advanced)

**If you want to keep migration history in sync:**

```bash
# Mark all remote migrations as applied locally
# (Copy command output from previous error, run each line)
supabase migration repair --status reverted 001
supabase migration repair --status reverted 002
# ... (all ~120 migrations)

# Then push new migrations
supabase db push
```

**Why NOT recommended:**
- 120+ repair commands to run
- Error-prone
- Doesn't add value vs. direct SQL execution

---

## Verification Steps

### After Deployment:

**1. Check table exists:**
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'business_programme_profiles'
);
-- Should return: true
```

**2. Check table structure:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'business_programme_profiles'
ORDER BY ordinal_position;
```

**Expected columns:**
- `id` (uuid)
- `business_id` (uuid)
- `programme_type` (text)
- `programme_name` (text)
- `time_windows` (ARRAY)
- `operating_days` (ARRAY)
- `menu_evidence` (ARRAY)
- `confidence` (numeric)
- `baseline_goal_split` (jsonb)
- `decision_timing` (text)
- `content_type_affinity` (jsonb)
- `audience_segments` (jsonb)
- `segment_confidence` (numeric)
- `segment_reasoning` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `version_hash` (text)
- `generation_errors` (jsonb)

**3. Check positioning column:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'business_brand_profile'
AND column_name = 'positioning';
```

**Expected:**
- `positioning` (text), nullable

**4. Test insert (optional):**
```sql
-- Test programme profile insert
INSERT INTO business_programme_profiles (
  business_id,
  programme_type,
  programme_name,
  time_windows,
  operating_days,
  menu_evidence,
  confidence
) VALUES (
  (SELECT id FROM businesses LIMIT 1), -- Use first business
  'brunch',
  'Weekend Brunch',
  ARRAY['Lør-Søn 09:00-14:00'],
  ARRAY['Lør', 'Søn'],
  ARRAY['eggs benedict', 'pancakes'],
  0.90
) RETURNING id;

-- Verify
SELECT * FROM business_programme_profiles;

-- Clean up test
DELETE FROM business_programme_profiles WHERE programme_type = 'brunch';
```

---

## Rollback Plan

### If something goes wrong:

**Rollback programme profiles table:**
```sql
DROP TABLE IF EXISTS business_programme_profiles CASCADE;
```

**Rollback positioning column:**
```sql
ALTER TABLE business_brand_profile DROP COLUMN IF EXISTS positioning;
```

**Note:** No data loss risk - both migrations are additive only.

---

## Next Steps After Deployment

1. **Verify migrations deployed successfully** (run verification queries)
2. **Generate test data** (run Layer 1-4 generation for Café Faust)
3. **Test frontend** (navigate to `/dashboard/brand`, check programme profiles section)
4. **Monitor for errors** (check Edge Function logs after generation)

---

## Migration SQL Files

### File 1: `supabase/migrations/20260506_create_business_programme_profiles.sql`

```sql
-- Create business_programme_profiles table
-- Stores programme-level brand profile data (Layers 1, 2, 4)
-- Complements business_brand_profile (Layers 3, 5 - business-level data)

CREATE TABLE IF NOT EXISTS business_programme_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  programme_type text NOT NULL,
  
  -- LAYER 1: Programme Detection (deterministic)
  programme_name text NOT NULL,
  time_windows text[] NOT NULL DEFAULT '{}',
  operating_days text[] NOT NULL DEFAULT '{}',
  menu_evidence text[] NOT NULL DEFAULT '{}',
  confidence numeric,
  
  -- LAYER 2: Commercial Orientation (AI-generated per programme)
  baseline_goal_split jsonb,
  decision_timing text,
  content_type_affinity jsonb,
  
  -- LAYER 4: Audience Segmentation (AI-generated per programme)
  audience_segments jsonb,
  segment_confidence numeric,
  segment_reasoning text,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version_hash text,
  generation_errors jsonb,
  
  -- Constraints
  UNIQUE(business_id, programme_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_business_id 
  ON business_programme_profiles(business_id);

CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_programme_type 
  ON business_programme_profiles(programme_type);

CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_updated_at 
  ON business_programme_profiles(updated_at DESC);

-- RLS policies
ALTER TABLE business_programme_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own programme profiles"
  ON business_programme_profiles
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own programme profiles"
  ON business_programme_profiles
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_business_programme_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_business_programme_profiles_updated_at
  BEFORE UPDATE ON business_programme_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_business_programme_profiles_updated_at();

-- Comments
COMMENT ON TABLE business_programme_profiles IS 
'Programme-level brand profile data (Layers 1, 2, 4). Complements business_brand_profile which stores business-level data (Layers 3, 5).';

COMMENT ON COLUMN business_programme_profiles.programme_type IS 
'Type of dining programme (e.g., brunch, lunch, dinner)';

COMMENT ON COLUMN business_programme_profiles.time_windows IS 
'Operating hours for this programme as text array, e.g., ["Lør-Søn 09:00-14:00"]';

COMMENT ON COLUMN business_programme_profiles.menu_evidence IS 
'Menu items that prove this programme exists, e.g., ["eggs benedict", "pasta"]';

COMMENT ON COLUMN business_programme_profiles.confidence IS 
'Layer 1 detection confidence (0.0-1.0)';

COMMENT ON COLUMN business_programme_profiles.baseline_goal_split IS 
'Layer 2: Commercial strategy baseline - % split between drive_footfall, strengthen_brand, retain_regulars (must sum to 100)';

COMMENT ON COLUMN business_programme_profiles.content_type_affinity IS 
'Layer 2: Content type weights as 0.0-1.0 scores (product_menu, behind_scenes, atmosphere, community, educational)';

COMMENT ON COLUMN business_programme_profiles.decision_timing IS 
'Layer 2: Customer decision pattern - spontaneous, planned, or mixed';

COMMENT ON COLUMN business_programme_profiles.audience_segments IS 
'Layer 4: Array of audience segments specific to this programme with evidence';

COMMENT ON COLUMN business_programme_profiles.segment_confidence IS 
'Layer 4: Segment generation confidence (0.0-1.0)';

COMMENT ON COLUMN business_programme_profiles.segment_reasoning IS 
'Layer 4: AI explanation of why these segments were chosen';
```

### File 2: `supabase/migrations/20260506_add_positioning_column.sql`

```sql
-- Layer 3: Add positioning column for brand identity
-- Migration for programme-aware brand profile system
-- Date: May 6, 2026

-- Add positioning column (Layer 3 competitive differentiation)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS positioning TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN business_brand_profile.positioning IS 
'Layer 3: Business-level competitive differentiation (2-3 sentences). 
Generated by identity-profile.ts AI module. 
Example: "Vi er den eneste café i Nyhavn med både traditionel dansk morgenmad og autentisk italiensk pasta."';

-- Note: Other Layer 3 fields use existing columns:
-- - brand_essence (already exists)
-- - values (already exists, will store core_values)
-- - what_makes_us_different (already exists)
```

---

## Status

**Migration Files:** ✅ Ready  
**Deployment Method:** ⏳ Choose Option A (Dashboard SQL Editor)  
**Verification Queries:** ✅ Prepared  
**Rollback Plan:** ✅ Documented

**Next Action:** Deploy using Supabase Dashboard SQL Editor
