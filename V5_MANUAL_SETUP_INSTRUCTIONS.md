# Execute V5 Tables - Manual Instructions

## Step 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql
2. Click "New Query"

## Step 2: Copy and Execute This SQL

```sql
-- V5 Essential Tables - Manual Migration
-- Execute this on production database to enable V5 generator

-- =====================================================
-- MIGRATION 1: Create business_programme_profiles table
-- =====================================================

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
  
  UNIQUE(business_id, programme_type)
);

CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_business_id 
  ON business_programme_profiles(business_id);

CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_programme_type 
  ON business_programme_profiles(programme_type);

CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_updated_at 
  ON business_programme_profiles(updated_at DESC);

ALTER TABLE business_programme_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own programme profiles"
  ON business_programme_profiles
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can manage their own programme profiles"
  ON business_programme_profiles
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_business_programme_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_business_programme_profiles_updated_at ON business_programme_profiles;
CREATE TRIGGER update_business_programme_profiles_updated_at
  BEFORE UPDATE ON business_programme_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_business_programme_profiles_updated_at();

-- =====================================================
-- MIGRATION 2: Add positioning column (Layer 3)
-- =====================================================

ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS positioning TEXT DEFAULT NULL;

-- =====================================================
-- MIGRATION 3: Add Layer 3 fields
-- =====================================================

ALTER TABLE business_brand_profile 
ADD COLUMN IF NOT EXISTS core_values JSONB,
ADD COLUMN IF NOT EXISTS what_makes_us_different TEXT,
ADD COLUMN IF NOT EXISTS identity_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS identity_reasoning TEXT;

-- =====================================================
-- VERIFICATION (run this after executing above)
-- =====================================================

-- Check table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'business_programme_profiles'
    ) 
    THEN '✅ business_programme_profiles table created'
    ELSE '❌ business_programme_profiles table MISSING'
  END AS table_status;

-- Check columns exist
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'business_brand_profile'
  AND column_name IN ('positioning', 'core_values', 'what_makes_us_different', 'identity_confidence', 'identity_reasoning')
ORDER BY column_name;
```

## Step 3: Verify Execution

After running the SQL, you should see:
- ✅ business_programme_profiles table created
- 5 new columns in business_brand_profile table

## Step 4: Mark Migrations as Applied

Once SQL is executed successfully, run these commands in terminal:

```bash
supabase migration repair --status applied 20260506_create_business_programme_profiles
supabase migration repair --status applied 20260506_add_positioning_column
supabase migration repair --status applied 20260506_add_layer3_fields
```

## Step 5: Test V5 Generator

```bash
curl -X POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1anBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMwMzU2NiwiZXhwIjoyMDQzODc5NTY2fQ.xVdZA0TKHmFJmBlUxSuFTx5tLfxzgIbPigpaNSZOI00" \
  -H "Content-Type: application/json" \
  -d '{"businessId": "f4679fa9-3120-4a59-9506-d059b010c34a", "forceRegenerate": true}'
```

---

## Alternative: Execute via Terminal (if you have correct DB password)

If you know your Supabase database password:

```bash
# Set password
export PGPASSWORD="your-supabase-db-password"

# Execute SQL
psql "postgresql://postgres.kvqdkohdpvmdylqgujpn@db.kvqdkohdpvmdylqgujpn.supabase.co:5432/postgres" \
  -f v5_manual_migration.sql
```

You can find your database password in:
https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/settings/database
