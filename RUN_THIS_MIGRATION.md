# Database Migration Required

## Please run this migration in Supabase SQL Editor:

1. Go to your Supabase project: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql
2. Click "New Query"
3. Copy and paste the SQL from: `supabase/migrations/20260120110000_update_concept_fit_to_per_category.sql`
4. Click "Run"

## What this migration does:

- Drops old single-category concept fit columns (`concept_fit_level`, `concept_fit_reasons`, etc.)
- Adds new `concept_fit_by_category` JSONB column to store fit analysis for each detected location category
- Keeps `concept_fit_analyzed_at` timestamp column

## After running the migration:

Reload the Location Intelligence page and click "Analyser Lokation". You should see:
- Each location category card (primary + secondaries with score ≥ 60%) will show its own concept fit
- Fit badge (✅ Strong / 🟡 Moderate / ⚠️ Challenging)
- One-liner explanation in Danish
- Marketing angle suggestion

The fit assessment is now **per-category** instead of a single overall assessment!
