-- Drop unused tables confirmed empty (0 rows) or never populated (schema-only)
-- All verified: zero reads in src/ and supabase/functions/ — April 2026

-- Tables confirmed 0 rows in table-stats
DROP TABLE IF EXISTS content_performance_log CASCADE;
DROP TABLE IF EXISTS opportunity_tracking CASCADE;
DROP TABLE IF EXISTS post_approvals CASCADE;
DROP TABLE IF EXISTS post_drafts CASCADE;
DROP TABLE IF EXISTS menu_extractions CASCADE;
DROP TABLE IF EXISTS social_accounts CASCADE;
DROP TABLE IF EXISTS business_team_members CASCADE;
DROP TABLE IF EXISTS media_assets CASCADE;
DROP TABLE IF EXISTS content_type_baselines CASCADE;

-- Tables that did not appear in table-stats (schema-only or never created)
DROP TABLE IF EXISTS business_audience_profile CASCADE;
DROP TABLE IF EXISTS business_menu_metadata CASCADE;
DROP TABLE IF EXISTS business_goals CASCADE;
DROP TABLE IF EXISTS specials CASCADE;
DROP TABLE IF EXISTS business_staff CASCADE;
DROP TABLE IF EXISTS weather_cache CASCADE;
DROP TABLE IF EXISTS platform_intelligence CASCADE;
