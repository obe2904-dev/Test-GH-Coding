-- Check if menu data exists for Café Faust
-- Run this in Supabase SQL Editor

-- 1. Check business_profile.menu_structure
SELECT 
  bp.business_id,
  b.name as business_name,
  bp.menu_structure IS NOT NULL as has_menu_structure,
  jsonb_typeof(bp.menu_structure) as menu_structure_type,
  bp.menu_description,
  bp.updated_at
FROM business_profile bp
JOIN businesses b ON b.id = bp.business_id
WHERE b.name ILIKE '%faust%';

-- 2. If menu_structure exists, show its content
SELECT 
  b.name as business_name,
  jsonb_pretty(bp.menu_structure) as menu_data
FROM business_profile bp
JOIN businesses b ON b.id = bp.business_id
WHERE b.name ILIKE '%faust%'
  AND bp.menu_structure IS NOT NULL;

-- 3. Check menu_extractions table (alternative menu source)
SELECT 
  me.id,
  me.menu_item_name,
  me.description,
  me.price,
  me.category,
  me.created_at
FROM menu_extractions me
JOIN businesses b ON b.id = me.business_id
WHERE b.name ILIKE '%faust%'
ORDER BY me.created_at DESC
LIMIT 10;

-- 4. Check menu_sources table (detected menu URLs)
SELECT 
  ms.source_url,
  ms.source_type,
  ms.is_primary,
  ms.detected_at
FROM menu_sources ms
JOIN businesses b ON b.id = ms.business_id  
WHERE b.name ILIKE '%faust%';
