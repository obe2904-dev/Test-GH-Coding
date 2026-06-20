-- Drop unused tables confirmed empty (0 rows) or never populated (schema-only)
-- All verified: zero reads in src/ and supabase/functions/ — April 2026

-- Tables confirmed 0 rows in table-stats
DROP TABLE IF EXISTS content_performance_log;
DROP TABLE IF EXISTS opportunity_tracking;
DROP TABLE IF EXISTS post_approvals;
DROP TABLE IF EXISTS post_drafts;
DROP TABLE IF EXISTS menu_extractions;
DROP TABLE IF EXISTS social_accounts;
DROP TABLE IF EXISTS business_team_members;
DROP TABLE IF EXISTS media_assets;
DROP TABLE IF EXISTS content_type_baselines;

-- Tables that did not appear in table-stats (schema-only or never created)
DROP TABLE IF EXISTS business_audience_profile;
DROP TABLE IF EXISTS business_menu_metadata;
DROP TABLE IF EXISTS business_goals;
DROP TABLE IF EXISTS specials;
DROP TABLE IF EXISTS business_staff;
DROP TABLE IF EXISTS weather_cache;
DROP TABLE IF EXISTS platform_intelligence;
