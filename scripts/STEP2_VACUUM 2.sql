-- Run this AFTER executing EXECUTE_CLEANUP_NOW.sql
-- This optimizes the database and reclaims space

VACUUM ANALYZE;

-- You should see a success message
-- This may take 10-30 seconds depending on database size
