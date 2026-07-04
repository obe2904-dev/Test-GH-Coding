-- Drop dead columns from business_concept_fit
-- These are confirmed unused by any edge function or UI read path.
--
-- strategy_positioning  → no consumer; not shown in UI
-- detected_motivations  → duplicate of business_location_intelligence.location_marketing_hooks (which IS used)
-- weather_sensitivity   → static config snapshot from location-expectations.ts; never read back
-- seasonality_pattern   → same as above
-- seasonal_weights      → same as above
-- cta_style             → CTA logic uses ctaIntent + booking_link; this field is not read
--
-- business_concept_fit_multi → confirmed 0 rows; write path never activated

ALTER TABLE business_concept_fit DROP COLUMN IF EXISTS strategy_positioning;
ALTER TABLE business_concept_fit DROP COLUMN IF EXISTS detected_motivations;
ALTER TABLE business_concept_fit DROP COLUMN IF EXISTS weather_sensitivity;
ALTER TABLE business_concept_fit DROP COLUMN IF EXISTS seasonality_pattern;
ALTER TABLE business_concept_fit DROP COLUMN IF EXISTS seasonal_weights;
ALTER TABLE business_concept_fit DROP COLUMN IF EXISTS cta_style;

DROP TABLE IF EXISTS business_concept_fit_multi;
