-- Add draw_type, reachable_guest_profile, and permitted_who_types to business_programme_profiles
-- Part of Change B: commercial-orientation.ts demographic + draw-type detection
-- Date: 1. juli 2026

ALTER TABLE business_programme_profiles
  ADD COLUMN IF NOT EXISTS draw_type text,
  ADD COLUMN IF NOT EXISTS reachable_guest_profile text,
  ADD COLUMN IF NOT EXISTS permitted_who_types jsonb;

COMMENT ON COLUMN business_programme_profiles.draw_type IS 
'Commercial draw type: passing_trade | local_draw | destination_draw - describes how guests reach this programme';

COMMENT ON COLUMN business_programme_profiles.reachable_guest_profile IS 
'1-2 sentence Danish description of who actually visits this programme (filtered by price/hours, not just who lives nearby)';

COMMENT ON COLUMN business_programme_profiles.permitted_who_types IS 
'WhoType[] after price+hours filtering. E.g. ["local_resident", "office_worker", "shopper"]. Computed at brand profile generation time from location.who + menu prices.';
