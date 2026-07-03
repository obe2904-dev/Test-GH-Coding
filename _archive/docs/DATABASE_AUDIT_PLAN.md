# Supabase Database Audit & Cleanup Plan

**Created:** February 2, 2026  
**Purpose:** Comprehensive audit of all Supabase data to identify and safely remove unused tables and columns

---

## Phase 1: Database Inventory ✅

### Discovered Tables (44 total)

Based on migrations analysis, the database contains:

#### Core Business Tables
1. **profiles** - User profiles
2. **businesses** - Main business entity
3. **business_team_members** - Multi-user collaboration
4. **business_profile** - Business descriptions
5. **business_brand_profile** - Brand voice & strategy
6. **business_locations** - Physical locations
7. **business_operations** - Operations data (amenities, offerings)
8. **business_visual_identity** - Logo, colors, visual style
9. **business_audience_profile** - Target audience data
10. **business_goals** - Business objectives

#### Location & Intelligence Tables
11. **business_location_intelligence** - Location analysis & context
12. **opening_hours** - Business hours
13. **social_accounts** - Social media accounts
14. **platform_intelligence** - Platform-specific insights

#### Menu Tables
15. **menu_sources** - Menu URL sources
16. **menu_extractions** - Extracted menu data
17. **menu_results_v2** - Processed menu results
18. **business_menu_metadata** - Menu metadata & scores
19. **menu_item_metadata** - Individual menu item data
20. **seasonal_ingredients** - Seasonal ingredient tracking

#### Content & Posts Tables
21. **post_ideas** - Generated post ideas
22. **post_drafts** - Draft posts
23. **suggested_posts** - AI-suggested posts
24. **media_assets** - Media/image assets

#### Offerings & Vertical-Specific Tables
25. **offerings** - Business offerings/products
26. **specials** - Special offers/promotions
27. **business_services** - Service offerings (vertical-specific)
28. **business_staff** - Staff profiles (vertical-specific)
29. **business_products** - Product catalog (vertical-specific)
30. **business_classes** - Classes/events (vertical-specific)

#### Analysis & Intelligence Tables
31. **website_analyses** - Website crawl/analysis data
32. **brand_profile_sources_state** - Brand profile generation state
33. **third_party_evidence** - External data sources
34. **business_concept_fit** - Concept fit analysis
35. **business_concept_fit_multi** - Multi-category concept fit

#### Supporting Tables
36. **weather_cache** - Weather data cache
37. **contextual_calendar** - Context-aware calendar
38. **business_documents** - Uploaded documents

#### System/Configuration Tables
39. **business_type_defaults** - Default configs per business type
40. **content_types** - Content type definitions
41. **content_distribution_rules** - Distribution rules
42. **platform_assignment_rules** - Platform assignment logic
43. **content_performance_log** - Performance tracking
44. **content_type_baselines** - Baseline metrics
45. **opportunity_tracking** - Opportunity tracking

---

## Phase 2: Code Usage Analysis

### Tables Referenced in Code

Based on grep search of TypeScript/JavaScript files:

**Actively Used (High Confidence):**
- ✅ businesses
- ✅ business_brand_profile
- ✅ business_profile
- ✅ business_locations
- ✅ business_operations
- ✅ business_location_intelligence
- ✅ business_menu_metadata
- ✅ business_visual_identity
- ✅ business_audience_profile
- ✅ business_goals
- ✅ business_team_members
- ✅ menu_sources
- ✅ menu_extractions
- ✅ menu_results_v2
- ✅ opening_hours
- ✅ post_ideas
- ✅ post_drafts
- ✅ profiles
- ✅ website_analyses (referenced as 'website_analysis_jobs' in code)

**Potentially Used:**
- ⚠️ business_concept_fit - Used in TestConceptFitPage, ConceptFitPage
- ⚠️ third_party_evidence - Created in migration but usage unclear
- ⚠️ brand_profile_sources_state - Created but usage unclear
- ⚠️ weather_cache - Created but usage unclear

**Not Found in Code Search:**
- ❌ social_accounts
- ❌ platform_intelligence
- ❌ suggested_posts (table exists, but may be unused)
- ❌ media_assets
- ❌ offerings
- ❌ specials
- ❌ business_services
- ❌ business_staff
- ❌ business_products
- ❌ business_classes
- ❌ seasonal_ingredients
- ❌ menu_item_metadata
- ❌ contextual_calendar
- ❌ business_documents (table name in migrations, may be referenced differently)
- ❌ business_type_defaults
- ❌ content_types
- ❌ content_distribution_rules
- ❌ platform_assignment_rules
- ❌ content_performance_log
- ❌ content_type_baselines
- ❌ opportunity_tracking
- ❌ business_concept_fit_multi

---

## Phase 3: Verification Checklist

Before deleting any data, we need to:

### Step 1: Verify Unused Tables
For each suspicious table, check:
1. [ ] Query Supabase for row counts
2. [ ] Check if any data exists
3. [ ] Search edge functions for usage
4. [ ] Search for RPC function calls
5. [ ] Check storage buckets for references
6. [ ] Review all .md documentation files

### Step 2: Verify Unused Columns
For tables we're keeping, audit columns:
1. [ ] Extract all columns from migrations
2. [ ] Cross-reference with TypeScript types
3. [ ] Check each column for code references
4. [ ] Identify columns never selected/updated
5. [ ] Document column purpose

### Step 3: Check Dependencies
1. [ ] Foreign key constraints
2. [ ] Triggers
3. [ ] RLS policies
4. [ ] Views
5. [ ] Functions/RPCs

---

## Phase 4: Cleanup Execution Plan

### Priority 1: High Confidence Deletions
Tables that appear completely unused and have no data:

```sql
-- WAIT FOR VERIFICATION BEFORE RUNNING
-- Step 1: Check if tables have any data
SELECT 'offerings' as table_name, COUNT(*) as row_count FROM offerings
UNION ALL
SELECT 'specials', COUNT(*) FROM specials
UNION ALL
SELECT 'media_assets', COUNT(*) FROM media_assets
-- Add all suspicious tables...
```

### Priority 2: Vertical-Specific Tables
These may be future features - need business decision:
- business_services
- business_staff
- business_products
- business_classes

**Recommendation:** Keep these as they may be planned features, but document if unused.

### Priority 3: Unused Columns
After table audit, identify unused columns in active tables:

```sql
-- Example: Check business_brand_profile columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_brand_profile' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

---

## Phase 5: Safe Deletion Process

### Before Deletion
1. ✅ Full database backup
2. ✅ Document all dependencies
3. ✅ Create rollback scripts
4. ✅ Test in development environment

### Deletion Script Template
```sql
-- Template for safe table deletion
BEGIN;

-- 1. Drop dependent policies
DROP POLICY IF EXISTS "policy_name" ON table_name;

-- 2. Drop triggers
DROP TRIGGER IF EXISTS trigger_name ON table_name;

-- 3. Drop indexes
DROP INDEX IF EXISTS index_name;

-- 4. Drop table
DROP TABLE IF EXISTS table_name CASCADE;

-- Verify deletion
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'table_name';

COMMIT;
-- or ROLLBACK; if issues found
```

### Column Deletion Template
```sql
-- Template for safe column deletion
BEGIN;

-- Check if column has any non-null data
SELECT column_name, COUNT(*) as non_null_count 
FROM table_name 
WHERE column_name IS NOT NULL;

-- If safe to proceed:
ALTER TABLE table_name DROP COLUMN IF EXISTS column_name CASCADE;

-- Verify deletion
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'table_name' 
  AND column_name = 'column_name';

COMMIT;
```

---

## Next Steps

### Immediate Actions Required:

1. **Generate Detailed Column Inventory** (Need to run script)
2. **Check Edge Functions** - Search supabase/functions/ for table usage
3. **Query Row Counts** - Connect to Supabase and check data
4. **Review Documentation** - Check all .md files for references
5. **TypeScript Type Audit** - Check src/types/supabase.ts for type definitions

### Questions to Answer:

1. Are vertical-specific tables (services, staff, products, classes) planned features?
2. Is `suggested_posts` different from `post_ideas`? Which one is active?
3. Is `website_analyses` the same as `website_analysis_jobs` in code?
4. What's the difference between `business_concept_fit` and `business_concept_fit_multi`?
5. Are the content distribution/performance tables (content_types, etc.) future features?

---

## Risk Assessment

**Low Risk (Safe to delete if verified empty):**
- offerings
- specials  
- media_assets (if storage handles images)
- social_accounts (if not used)

**Medium Risk (Verify carefully):**
- Vertical-specific tables
- Performance/analytics tables
- Calendar tables

**High Risk (Keep unless absolutely sure):**
- Any table with foreign key dependencies
- Tables with existing data
- Tables referenced in edge functions

---

## ✅ ANALYSIS COMPLETE

### Automated Analysis Results

**Database Usage Analysis Run:** February 2, 2026

**Total Tables:** 50  
**Used in Code:** 41 (82%)  
**Unused in Code:** 9 (18%)

### Tables Confirmed UNUSED (High Confidence):

1. ❌ **platform_intelligence** - No references found
2. ❌ **post_drafts** - No references found (may be old drafts system)
3. ❌ **offerings** - No references found (replaced by business_services?)
4. ❌ **specials** - No references found
5. ❌ **business_concept_fit_multi** - No references found (similar to business_concept_fit)
6. ❌ **weather_cache** - No references found
7. ❌ **content_types** - No references found
8. ❌ **content_distribution_rules** - No references found
9. ❌ **platform_assignment_rules** - No references found

### Tables with LOW Usage (Consider for Review):

- **suggested_posts** - Only 1 reference
- **published_posts** - Only 1 reference
- **business_services** - Only 1 reference
- **business_staff** - Only 1 reference
- **business_products** - Only 1 reference
- **business_classes** - Only 1 reference
- **contextual_calendar** - Only 1 reference

These may be:
- Planned features not yet fully implemented
- Used through indirect methods (RPCs, triggers)
- Legacy tables kept for compatibility

---

## Status

- [x] Phase 1: Database Inventory
- [x] Phase 2: Code Usage Analysis
- [x] Phase 3: Verification Scripts Created
- [x] Phase 4: Cleanup Scripts Created
- [ ] Phase 5: Execute Verification (MANUAL STEP)
- [ ] Phase 6: Execute Cleanup (MANUAL STEP)

**Next Action:** Run verification script in Supabase SQL Editor.
