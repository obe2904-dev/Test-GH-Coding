-- VERIFY: Location Signal → Commercial Orientation Fix
-- Check if FROKOST and AFTEN programmes have different baseline_goal_splits

\echo '═══════════════════════════════════════════════════'
\echo '  VERIFICATION: Location Signal Fix                '
\echo '═══════════════════════════════════════════════════'
\echo ''

-- Get Café Faust business ID
\echo 'Business ID:'
SELECT id, name FROM businesses WHERE name ILIKE '%faust%';
\echo ''

-- Check location intelligence category_scores
\echo 'Location Intelligence - Category Scores for Café Faust:'
SELECT 
  business_id,
  area_type,
  category_scores,
  demographic_proximity
FROM business_location_intelligence
WHERE business_id = (SELECT id FROM businesses WHERE name ILIKE '%faust%' LIMIT 1);
\echo ''

-- Check programme profiles baseline_goal_split
\echo 'Programme Profiles - Baseline Goal Splits:'
SELECT 
  programme_label,
  programme_type,
  baseline_goal_split,
  decision_timing,
  (baseline_goal_split->>'drive_footfall')::int as footfall_pct,
  (baseline_goal_split->>'strengthen_brand')::int as brand_pct,
  created_at
FROM business_programme_profiles
WHERE business_id = (SELECT id FROM businesses WHERE name ILIKE '%faust%' LIMIT 1)
ORDER BY 
  CASE programme_type
    WHEN 'morning' THEN 1
    WHEN 'lunch' THEN 2
    WHEN 'dinner' THEN 3
    WHEN 'bar' THEN 4
  END;
\echo ''

-- Analysis
\echo 'EXPECTED RESULTS:'
\echo '- FROKOST (lunch): Higher drive_footfall (reflects city_centre/shopping signals)'
\echo '- AFTEN (dinner): Higher strengthen_brand or more balanced (reflects waterfront evening destination)'
\echo '- If both are identical → daypart composition is not being applied'
\echo ''

-- Also check Havnær for comparison
\echo '═══════════════════════════════════════════════════'
\echo 'Havnær Comparison (should show no pace mismatch):'
SELECT 
  programme_label,
  programme_type,
  baseline_goal_split,
  (baseline_goal_split->>'drive_footfall')::int as footfall_pct,
  (baseline_goal_split->>'strengthen_brand')::int as brand_pct
FROM business_programme_profiles
WHERE business_id = (SELECT id FROM businesses WHERE name ILIKE '%havnær%' LIMIT 1)
ORDER BY programme_type;
