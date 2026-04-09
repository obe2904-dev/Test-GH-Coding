-- Check if weekly_strategies has the new columns
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'weekly_strategies'
ORDER BY ordinal_position;

-- Check if the strategy exists
SELECT 
  id,
  business_id,
  week_number,
  status,
  platforms,
  subscription_tier,
  target_post_count,
  generated_at
FROM weekly_strategies
WHERE id = 'a542058e-1787-44d5-8a90-12f345b75899';
