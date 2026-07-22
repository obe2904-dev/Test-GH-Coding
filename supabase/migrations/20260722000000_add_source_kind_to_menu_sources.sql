-- Add source_kind classification to menu_sources.
-- Written by MenuPage at upsert time from detect-menus' detectedSources payload.
-- Read by menu-extract-v2 to route extraction without re-probing the URL.
-- NULL is valid: legacy rows and manual URL adds fall back to probe-based routing.

alter table public.menu_sources
  add column if not exists source_kind text
  check (source_kind in ('html', 'pdf', 'image', 'mealo', 'iframe_platform'));

comment on column public.menu_sources.source_kind is
  'Detected content kind from detect-menus: html | pdf | image | mealo | iframe_platform. NULL = unknown, extractor probes.';
