-- Menu Extraction Queue Setup
-- Using menu_results table as the job queue (simple polling model)
-- Records with status='queued' are waiting for processing by the Cloud Run worker

-- Enable pgmq extension (for future use if needed)
create extension if not exists pgmq;

-- Create menu_results table to serve as our job queue
create table if not exists menu_results (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  pdf_url text not null,
  status text not null default 'queued', -- queued, processing, done, error
  raw_text text, -- Raw OCR output before corrections
  structured_data jsonb, -- Parsed menu structure {categories: [...], items: [...]}
  error_message text,
  ocr_engine text default 'tesseract', -- tesseract or paddleocr
  confidence_score numeric, -- Average confidence from OCR
  processing_time_ms integer, -- How long it took to process
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index for querying by business and status
create index if not exists idx_menu_results_business_status 
  on menu_results(business_id, status);

create index if not exists idx_menu_results_status 
  on menu_results(status);

-- Enable realtime for this table so frontend gets live updates
-- (Idempotent: avoid ERROR 42710 if already added)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'menu_results'
  ) then
    alter publication supabase_realtime add table public.menu_results;
  end if;
end
$$;

-- Function to update the updated_at timestamp
create or replace function update_menu_results_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to automatically update updated_at
create trigger menu_results_updated_at
  before update on menu_results
  for each row
  execute function update_menu_results_updated_at();

-- Note: pgmq already exists in Supabase, but here's the queue create command:
-- Run this to initialize the queue
select pgmq.create('menu_queue');
