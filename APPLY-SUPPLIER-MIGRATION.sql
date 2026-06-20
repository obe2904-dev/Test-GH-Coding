-- STEP 1: Apply this SQL migration in Supabase Dashboard
-- URL: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new

ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS supplier_analysis JSONB DEFAULT NULL;

COMMENT ON COLUMN business_location_intelligence.supplier_analysis IS 
'Supplier location and distance analysis extracted from menu items. Used for factual geographic claims in brand profile.';

-- After applying this migration:
-- 1. Run: deno run --allow-net --allow-env --allow-read --env-file=.env scripts/extract-supplier-distances.ts
-- 2. Verify supplier data was stored
-- 3. Regenerate brand profile to see factual geographic claims
