-- =====================================================
-- WEEKLY STRATEGIES TABLE VERIFICATION
-- =====================================================
-- Run these queries after creating the table to verify setup

-- 1. Check table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'weekly_strategies'
ORDER BY ordinal_position;

-- 2. Check indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'weekly_strategies';

-- 3. Check RLS policies
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'weekly_strategies';

-- 4. View recent strategies (after first generation)
SELECT 
  id,
  business_id,
  week_start,
  week_number,
  business_type,
  status,
  jsonb_array_length(post_ideas) as idea_count,
  array_length(selected_idea_ids, 1) as selected_count,
  generated_at
FROM weekly_strategies
ORDER BY generated_at DESC
LIMIT 5;

-- 5. Check strategy content structure (after first generation)
SELECT 
  id,
  week_start,
  jsonb_pretty(narrative -> 'headline') as headline,
  jsonb_array_length(strategic_priorities) as priority_count,
  jsonb_array_length(post_ideas) as post_idea_count,
  status
FROM weekly_strategies
ORDER BY generated_at DESC
LIMIT 1;
