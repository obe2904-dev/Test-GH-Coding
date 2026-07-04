-- Create write_drafts table for single live draft per user+business in "Skriv Selv" mode
-- Replaces multi-source localStorage + DB caching with single source of truth
-- Lifecycle: Create on first edit → Update on every change → Delete on "Slet alt" or moving to Udgiv

create table if not exists public.write_drafts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  
  -- PostContent structure (text, hashtags, adjustments, platform-specific content)
  content jsonb,
  
  -- PhotoContent structure (uploaded media, adjustments)
  photo_content jsonb,
  
  -- Selected platforms for this draft
  selected_platforms text[] default '{}',
  
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  -- Ensure one draft per user per business
  constraint write_drafts_user_business_unique unique(user_id, business_id)
);

-- Index for fast lookups
create index if not exists write_drafts_user_business_idx 
  on public.write_drafts(user_id, business_id);

-- Enable RLS
alter table public.write_drafts enable row level security;

-- RLS Policies: Users can only see/edit their own drafts
-- Drop existing policies first to make this migration idempotent
drop policy if exists "Users can view own drafts" on public.write_drafts;
drop policy if exists "Users can insert own drafts" on public.write_drafts;
drop policy if exists "Users can update own drafts" on public.write_drafts;
drop policy if exists "Users can delete own drafts" on public.write_drafts;

create policy "Users can view own drafts"
  on public.write_drafts for select
  using (auth.uid() = user_id);

create policy "Users can insert own drafts"
  on public.write_drafts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own drafts"
  on public.write_drafts for update
  using (auth.uid() = user_id);

create policy "Users can delete own drafts"
  on public.write_drafts for delete
  using (auth.uid() = user_id);

-- Add comment
comment on table public.write_drafts is 
  'Single live draft per user+business for Skriv Selv mode. Deleted when user clears content or moves to Udgiv stage.';
