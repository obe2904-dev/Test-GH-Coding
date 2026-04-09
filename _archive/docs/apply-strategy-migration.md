# Apply Brand Strategy Migration

## Migration File
`supabase/migrations/20260117000000_brand_strategy_model.sql`

## To Apply in Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file: `supabase/migrations/20260117000000_brand_strategy_model.sql`
4. Copy the entire contents
5. Paste into SQL Editor
6. Click **Run**

## What This Migration Does:

### 1. Adds Locale Field
- Adds `locale` column to `businesses` table (default: 'da-DK')
- Enables Danish-first content generation with locale awareness

### 2. Adds 15 New Columns to business_brand_profile
**Layer 1 - Core Offerings:**
- `core_offerings[]` - Top 3 identity patterns
- `offerings_weights` - All calculated weights (jsonb)
- `offerings_reasoning[]` - Why these offerings
- `offerings_confidence` - High/medium/low

**Layer 2 - Target Audience:**
- `target_audience_primary[]` - Max 2 from fixed pool
- `target_audience_seasonal` - Additive modifiers (jsonb)
- `audience_reasoning[]` - Why these audiences
- `audience_confidence` - High/medium/low

**Layer 3 - Communication Goal:**
- `communication_goal` - Exactly 1 from pool
- `goal_reasoning[]` - Why this goal
- `goal_confidence` - High/medium/low

**Metadata:**
- `strategy_version` - Model version (1.0.0)
- `generated_at` - When generated
- `approved_by_user` - User approval boolean

### 3. Adds Data Integrity Constraints
- Max 3 core offerings
- Max 2 primary audiences
- Valid audience pool: ['locals', 'families', 'office_workers', 'students', 'social_groups', 'tourists']
- Valid goal pool: ['drive_visits', 'increase_bookings', 'build_local_awareness', 'fill_off_peak']
- Valid confidence levels: ['high', 'medium', 'low']

### 4. Creates Performance Indexes
- Index on `generated_at DESC` for sorting
- Index on `approved_by_user` for filtering

## After Running Migration:

All existing records will:
- Get `locale = 'da-DK'` by default
- Have `strategy_version = '1.0.0'`
- New columns will be NULL until strategy is generated

## To Test:

1. Navigate to `/dashboard/brand-profile-new` in the app
2. Click "Generer brandprofil"
3. Wait 5-10 seconds for generation
4. Review the 3 layers with reasoning
5. Click "Godkend og gem"
6. Check database to verify all constraints work

## Rollback (if needed):

```sql
-- Remove constraints
ALTER TABLE business_brand_profile DROP CONSTRAINT IF EXISTS check_core_offerings_max_3;
ALTER TABLE business_brand_profile DROP CONSTRAINT IF EXISTS check_primary_audiences_max_2;
ALTER TABLE business_brand_profile DROP CONSTRAINT IF EXISTS check_primary_audiences_valid;
ALTER TABLE business_brand_profile DROP CONSTRAINT IF EXISTS check_communication_goal_valid;
ALTER TABLE business_brand_profile DROP CONSTRAINT IF EXISTS check_offerings_confidence_valid;
ALTER TABLE business_brand_profile DROP CONSTRAINT IF EXISTS check_audience_confidence_valid;
ALTER TABLE business_brand_profile DROP CONSTRAINT IF EXISTS check_goal_confidence_valid;

-- Remove indexes
DROP INDEX IF EXISTS idx_brand_profile_generated_at;
DROP INDEX IF EXISTS idx_brand_profile_approved;

-- Remove columns
ALTER TABLE business_brand_profile 
DROP COLUMN IF EXISTS core_offerings,
DROP COLUMN IF EXISTS offerings_weights,
DROP COLUMN IF EXISTS offerings_reasoning,
DROP COLUMN IF EXISTS offerings_confidence,
DROP COLUMN IF EXISTS target_audience_primary,
DROP COLUMN IF EXISTS target_audience_seasonal,
DROP COLUMN IF EXISTS audience_reasoning,
DROP COLUMN IF EXISTS audience_confidence,
DROP COLUMN IF EXISTS communication_goal,
DROP COLUMN IF EXISTS goal_reasoning,
DROP COLUMN IF EXISTS goal_confidence,
DROP COLUMN IF EXISTS strategy_version,
DROP COLUMN IF EXISTS generated_at,
DROP COLUMN IF EXISTS approved_by_user;

-- Remove locale
ALTER TABLE businesses DROP COLUMN IF EXISTS locale;
```
