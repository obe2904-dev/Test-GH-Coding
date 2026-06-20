-- Drop service_periods from business_operations.
--
-- This column was added to the schema but a write path was never built.
-- All edge functions that use service_period data derive it at runtime from
-- menu_results_v2.service_periods (extracted during menu processing) or from
-- menu_items_normalized via the get-weekly-strategy item loop.
-- The business_operations.service_periods column has always been null.
--
-- primary_service_period does NOT exist as a DB column (confirmed via supabase.ts
-- auto-generated types) — it is only a runtime variable in generate-weekly-plan.

ALTER TABLE business_operations DROP COLUMN IF EXISTS service_periods;
