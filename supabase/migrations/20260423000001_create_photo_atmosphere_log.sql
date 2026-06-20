-- photo_atmosphere_log: stores per-photo atmosphere extractions for silent
-- brand profile enrichment. Populated by analyze-photo when a photo passes
-- the gate: contentMatch excellent/good + atmosphere-type caption + not retake.
-- When a business accumulates 10 entries a synthesis prompt runs and the result
-- is written to business_brand_profile (venue_scene, visual_character).

create table if not exists photo_atmosphere_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  -- SHA-256 hex of the storage URL — used to prevent re-analysis of the same file
  photo_url_hash text not null,
  -- Type of content detected from the caption text
  content_type text not null check (content_type in ('interior', 'atmosphere', 'behind_the_scenes')),
  -- Perceptual atmosphere description extracted by Gemini (no object names)
  venue_scene text not null,
  -- Short concept label, e.g. "Casual moderne café"
  visual_character text,
  created_at timestamptz not null default now()
);

-- Prevent duplicate extraction of the same photo for the same business
create unique index photo_atmosphere_log_business_photo_key
  on photo_atmosphere_log(business_id, photo_url_hash);

-- Fast lookup: count entries per business, fetch N most recent
create index photo_atmosphere_log_business_created_idx
  on photo_atmosphere_log(business_id, created_at desc);

-- RLS: each business owner can only read their own log
alter table photo_atmosphere_log enable row level security;

create policy "business owner can read own photo atmosphere log"
  on photo_atmosphere_log for select
  using (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  );

-- Edge functions run with service role key and bypass RLS — no insert policy needed
-- for the write path (analyze-photo uses SUPABASE_SERVICE_ROLE_KEY).

-- Track synthesis confidence on the brand profile so we don't re-synthesize
-- on every new photo once the profile has been confirmed.
-- Values: 'none' (no synthesis yet), 'building' (< 10 photos), 'high' (synthesised from 10+)
alter table business_brand_profile
  add column if not exists atmosphere_confidence_level text not null default 'none'
  check (atmosphere_confidence_level in ('none', 'building', 'high'));

