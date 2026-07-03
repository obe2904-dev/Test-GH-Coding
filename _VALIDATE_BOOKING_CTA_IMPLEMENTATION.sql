-- VALIDATION QUERY: Booking CTA Logic Implementation
-- Business: Café Faust (f4679fa9-3120-4a59-9506-d059b010c34a)
-- Date: 2026-06-15
--
-- This query validates the current booking model state and expected cta_rules.mode
-- Run BEFORE deploying the updated functions to verify data integrity.

WITH target_business AS (
  SELECT 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid AS business_id
)

SELECT
  b.id AS business_id,
  b.name AS business_name,
  
  -- Booking model fields (raw data)
  bp.booking_link,
  bo.reservation_required,
  bo.accepts_walk_ins,
  
  -- Derived CTA mode (should match cta_rules.mode after deployment)
  CASE
    WHEN bo.reservation_required AND bp.booking_link IS NOT NULL THEN 'reservation_only'
    WHEN bo.accepts_walk_ins AND bp.booking_link IS NOT NULL THEN 'mixed'
    WHEN bo.accepts_walk_ins AND bp.booking_link IS NULL THEN 'walk_in_only'
    WHEN bo.reservation_required AND bp.booking_link IS NULL THEN 'reservation_required_no_link'
    ELSE 'unknown'
  END AS expected_cta_mode,
  
  -- Expected booking nudge settings
  CASE
    WHEN (bo.reservation_required OR bo.accepts_walk_ins) AND bp.booking_link IS NOT NULL 
    THEN TRUE
    ELSE FALSE
  END AS expected_booking_nudge_enabled,
  
  CASE
    WHEN (bo.reservation_required OR bo.accepts_walk_ins) AND bp.booking_link IS NOT NULL 
    THEN 2
    ELSE 0
  END AS expected_booking_nudge_lead_days,
  
  -- Check if "book et bord i dag" is in banned phrases (should be present currently)
  CASE
    WHEN bp.voice_guardrails::jsonb #>> '{avoid_patterns,strip_from_output,generic_marketing}' LIKE '%book et bord%'
    THEN '⚠️ BANNED (will be overridden by booking_cta_phrases)'
    ELSE '✅ NOT BANNED'
  END AS booking_cta_status,
  
  -- Voice guardrails structure check
  jsonb_typeof(bp.voice_guardrails::jsonb) AS voice_guardrails_type,
  jsonb_typeof(bp.voice_guardrails::jsonb #> '{avoid_patterns}') AS avoid_patterns_type

FROM businesses b
JOIN business_brand_profile bp ON bp.business_id = b.id
JOIN business_operations bo ON bo.business_id = b.id
JOIN target_business tb ON tb.business_id = b.id;

-- Expected output for Café Faust:
-- booking_link: 'https://...' (non-null)
-- reservation_required: false
-- accepts_walk_ins: true
-- expected_cta_mode: 'mixed'
-- expected_booking_nudge_enabled: true
-- expected_booking_nudge_lead_days: 2
-- booking_cta_status: '⚠️ BANNED (will be overridden by booking_cta_phrases)'
