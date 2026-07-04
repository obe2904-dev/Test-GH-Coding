-- ============================================================================
-- RESET STUCK CAFÉ FAUST MENU EXTRACTIONS
-- ============================================================================
-- Run this AFTER applying FIX-SCHEMA-CACHE-MENU-COLUMNS.sql
-- This cleans up old failed extractions so you can retry with working schema
-- ============================================================================

-- Clear all stuck/failed extractions for Café Faust
UPDATE menu_results_v2 
SET 
  status = 'error',
  error_message = 'Schema cache refreshed - superseded by new extraction',
  completed_at = NOW()
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a' 
  AND status IN ('queued', 'processing');

-- Reset menu sources to allow re-extraction
UPDATE menu_sources
SET status = 'pending'
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND status IN ('extracting', 'extracted');

-- Verify cleanup
SELECT 
  'Cleanup complete - ready for fresh extraction' AS status,
  COUNT(*) FILTER (WHERE status = 'error') as old_errors,
  COUNT(*) FILTER (WHERE status = 'done') as successful,
  COUNT(*) as total_results
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Show menu sources ready for extraction
SELECT 
  COALESCE(label, source_url) as menu_name,
  source_url,
  source_type,
  status
FROM menu_sources
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY COALESCE(label, source_url);
