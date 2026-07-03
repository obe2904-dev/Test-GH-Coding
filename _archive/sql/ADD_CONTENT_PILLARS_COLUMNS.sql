-- Adds content pillars to business_brand_profile
-- Safe to run multiple times.

alter table if exists public.business_brand_profile
  add column if not exists content_pillars text;

alter table if exists public.business_brand_profile
  add column if not exists content_pillars_jsonb jsonb;
