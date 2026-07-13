-- Add menu_results_v2_id foreign key to track which menu version generated each profile
-- This is CRITICAL for data lineage: we need to know which menu snapshot created which profile

ALTER TABLE business_programme_profiles
ADD COLUMN IF NOT EXISTS menu_results_v2_id uuid REFERENCES menu_results_v2(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_menu_results_v2_id 
ON business_programme_profiles(menu_results_v2_id);

COMMENT ON COLUMN business_programme_profiles.menu_results_v2_id IS 'Foreign key to menu_results_v2 - tracks which menu version this profile was generated from (NULL = generated from legacy data or opening hours only)';
