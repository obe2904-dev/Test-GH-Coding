# Step 1 Complete: Database Storage for Location Enrichment + Execution Profile ✅

## Migration Applied Successfully

**Migration file**: `supabase/migrations/20260107000000_add_location_enrichment_and_execution_profile.sql`

**Status**: ✅ **DEPLOYED TO PRODUCTION** (January 7, 2026)

---

## What Was Added

### 1. Location Enrichment Storage (`business_locations.enrichment`)

```sql
ALTER TABLE public.business_locations
ADD COLUMN IF NOT EXISTS enrichment JSONB;

CREATE INDEX idx_business_locations_enrichment
ON public.business_locations USING GIN (enrichment);
```

**Purpose**: Store LocationEnrichment data for each business location:
- **Macro context**: country, region, city, city_tier (capital, major_city, mid_city, small_town, rural)
- **Micro context**: area_type (tourist_zone, waterfront, transit_hub, etc.), nearby_signals
- **Geo coordinates**: lat/lng with accuracy level

**Type Structure** (from Phase 0):
```typescript
{
  geo?: { lat: number; lng: number; accuracy: "high" | "medium" | "low" },
  macro: {
    country: string,
    region?: string,
    city: string,
    city_tier?: "capital" | "major_city" | "mid_city" | "small_town" | "rural"
  },
  micro: {
    area_type: "tourist_zone" | "shopping_street" | "transit_hub" | ...,
    nearby_signals: string[],
    confidence: "high" | "medium" | "low"
  },
  version: string
}
```

---

### 2. Execution Profile Storage (`business_brand_profile.execution_profile`)

```sql
ALTER TABLE public.business_brand_profile
ADD COLUMN IF NOT EXISTS execution_profile JSONB;

CREATE INDEX idx_business_brand_profile_execution_profile
ON public.business_brand_profile USING GIN (execution_profile);
```

**Purpose**: Store AI-optimized, structured brand profile for post-idea generation:
- **locale_context**: primary_language, country, city, city_tier, region
- **micro_location_context**: area_type, nearby_signals, confidence
- **usage_occasions**: 2-6 situational phrases (behavioral moments)
- **offerings_allowlist**: menu_items, allowed_generics
- **cta_policy**: primary_intent, platform-specific rules (Facebook vs Instagram)
- **forbidden_terms**: words/phrases AI must avoid
- **photo_rules**: dos, donts, signature_pattern

**Type Structure** (from Phase 0):
```typescript
{
  version: "1.0",
  locale_context: {
    primary_language: string,
    country?: string,
    city?: string,
    city_tier?: string,
    region?: string
  },
  micro_location_context: {
    area_type: LocationEnrichment["micro"]["area_type"],
    nearby_signals: string[],
    confidence: "high" | "medium" | "low"
  },
  usage_occasions: string[],
  offerings_allowlist: {
    menu_items: Array<{ name: string; category?: string }>,
    allowed_generics: string[]
  },
  cta_policy: {
    primary_intent: "book" | "visit" | "menu" | "engage",
    facebook: { allow_url: boolean },
    instagram: { allow_url: boolean; fallback_text: string }
  },
  forbidden_terms: string[],
  photo_rules: {
    dos: string[],
    donts: string[],
    signature_pattern?: string
  }
}
```

---

## Migration Output

```
NOTICE: ✓ business_locations.enrichment column created
NOTICE: ✓ business_brand_profile.execution_profile column created
NOTICE: ✓ idx_business_locations_enrichment index created
NOTICE: ✓ idx_business_brand_profile_execution_profile index created
```

---

## Key Features

### ✅ Backward Compatible
- Both columns are nullable
- Existing queries unaffected
- No breaking changes

### ✅ Performance Optimized
- GIN indexes for efficient JSONB queries
- Query by `city_tier`, `area_type`, `usage_occasions`, etc.

### ✅ Self-Documenting
- Column comments explain structure and purpose
- Follows existing codebase pattern (`extracted_json` in `business_documents`)

### ✅ RLS Policies
- No changes needed
- Existing policies cover new JSONB columns automatically

---

## Verification

Run `VERIFY_MIGRATION_SUCCESS.sql` in Supabase SQL Editor to confirm:
1. ✅ enrichment column exists in business_locations (JSONB, nullable)
2. ✅ execution_profile column exists in business_brand_profile (JSONB, nullable)
3. ✅ GIN indexes created for both columns
4. ✅ Column comments documented

---

## Next Steps

### **Phase 1: Location Enrichment** (30 minutes)
- Map existing `geo_context` → `LocationEnrichment.macro`
- Classify `city_tier` using `classifyCityTier()` helper
- Map existing `micro_location_context[]` → `LocationEnrichment.micro`
- Extract `area_type` from cue_type (near_railway_station → transit_hub, etc.)
- Populate `business_locations.enrichment` column

### **Phase 2: Execution Profile Generation** (1-2 hours)
- Build transformer: `generateExecutionProfile(brandProfile: BrandProfile): ExecutionProfile`
- Extract `usage_occasions` from `target_audience.value`
- Build `offerings_allowlist` from menu + `core_offerings.value`
- Compile `cta_policy`, `forbidden_terms`, `photo_rules`
- Populate `business_brand_profile.execution_profile` column

### **Phase 3: AI Integration** (2-3 hours)
- Update post-idea generation to read `execution_profile` instead of Display Profile prose
- Refactor prompts to consume structured data
- Implement platform-specific CTA handling
- Measure token reduction (target: 30-40%)
- A/B test location-aware personalization

---

## Architecture Benefits

### **Separation of Concerns**
- **Display Profile** (BrandProfile): User-facing fields users edit in UI
- **Execution Profile**: AI-optimized, structured data AI reads for post ideas

### **Token Efficiency**
- Structured data vs prose → ~30-40% reduction expected
- No repetition of location context across prompts
- Compact CTA policy instead of platform-specific instructions

### **Location-Aware Personalization**
- Capital vs small town style differences
- Tourist zone vs business district context
- Waterfront vs transit hub photo suggestions

### **Platform-Specific Logic**
- Facebook: allow_url = true
- Instagram: allow_url = false, fallback_text = "Book via link i bio"
- Enforced at profile level, not per-post

---

## Repository State

```
/supabase/migrations/
  └── 20260107000000_add_location_enrichment_and_execution_profile.sql  ✅ DEPLOYED

/supabase/functions/_shared/
  ├── types/
  │   └── location-enrichment.ts  ✅ Created (Phase 0)
  └── brand-profile/
      └── types.ts  ✅ Updated (Phase 0 - added ExecutionProfile type)
```

**Status**: Phase 0 + Step 1 complete. Ready for Phase 1 (Location Enrichment) or Phase 2 (Execution Profile Generation).
