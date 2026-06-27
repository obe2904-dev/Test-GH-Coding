# Brand Dashboard Database Mapping
**URL:** `http://localhost:3000/dashboard/brand`  
**Route:** `src/App.tsx` → `/dashboard/brand`  
**Page:** `src/pages/dashboard/BrandProfilePageV5.tsx`  
**Generator:** `src/components/brandProfile/BrandProfileV5Generator.tsx`  
**Generated:** 5. maj 2026

---

## Overview

This document maps all information displayed on the `/dashboard/brand` page to its corresponding database storage locations.

**Primary Database Table:** `business_brand_profile`  
**Relationship:** One-to-one with `businesses` table via `business_id`

## Current Code / Prompt / Database Map

### Field state notation

| State | Meaning |
|------|---------|
| `Filled` | The field currently has data for the business or is expected to be populated by the active V5 flow. |
| `Empty` | The field can be `NULL`, an empty array, or an empty object depending on column type. |
| `Format` | The stored shape when filled, for example `TEXT`, `JSONB`, `TEXT[]`, `JSONB array`, or nested object paths like `voice.tone_rules[]`. |
| `Fallback` | The UI can still render using a fallback field if the primary field is empty. |

### Code path

| Layer | File | Role |
|------|------|------|
| Route | `src/App.tsx` | Mounts `/dashboard/brand` inside the protected dashboard layout |
| Page | `src/pages/dashboard/BrandProfilePageV5.tsx` | Fetches the active business, loads brand data, renders V5 sections, and triggers regeneration |
| Generator UI | `src/components/brandProfile/BrandProfileV5Generator.tsx` | Shows the V5 generate/regenerate CTA and progress state |
| Hook | `src/hooks/useBrandProfileV5Generation.ts` | Runs the two-step regeneration flow |
| Menu summary function | `supabase/functions/menu-overview-summary/index.ts` | Builds cross-menu summary before brand generation |
| Brand generator | `supabase/functions/brand-profile-generator-v5/index.ts` | Generates and persists the V5 brand profile |

### Prompt files

| Prompt file | What it controls |
|-------------|------------------|
| `supabase/functions/_shared/brand-profile/v5-prompts.ts` | Shared V5 prompt library for layer 2/3/4/5 system prompts |
| `supabase/functions/_shared/brand-profile/business-identity-persona.ts` | Layer 0 persona prompt for business facts |
| `supabase/functions/_shared/brand-profile/professional-persona.ts` | Professional persona / role framing |
| `supabase/functions/_shared/brand-profile/commercial-orientation.ts` | Layer 2 commercial strategy prompt |
| `supabase/functions/_shared/brand-profile/audience-profile.ts` | Layer 4 audience segment prompt |
| `supabase/functions/_shared/brand-profile/voice-profile.ts` | Layer 5 voice / example generation |
| `supabase/functions/_shared/brand-profile/guardrails.ts` | Layer 5 guardrails / never-say / exclusions |
| `supabase/functions/_shared/brand-profile/marketing-manager-brief-generator.ts` | Layer 6 synthesis brief used by downstream content generation |

### Database tables used by the page flow

| Table | How it is used | Typical state / format |
|-------|----------------|------------------------|
| `businesses` | Resolves the logged-in owner to the active business id and business name | Usually `Filled`; `id`, `name`, `owner_id` are `TEXT`/`UUID` |
| `business_brand_profile` | Main storage for the brand dashboard and regenerated V5 profile | Usually `Filled`; mixed `TEXT`, `JSONB`, `TEXT[]`, and `brand_profile_v5` JSONB |
| `business_programme_profiles` | Programme-level timing, audience, and commercial data shown in the V5 view | Usually `Filled` after generation; rows contain `programme_type`, `time_windows[]`, `audience_segments[]`, `commercial_orientation` JSONB |
| `menu_results_v2` | Source menu data for the menu-overview summary function | Often `Filled` if menus exist; `structured_data` JSONB plus AI summary text |
| `business_operations` | Operational constraints consumed by the V5 generator | Usually `Filled`; mostly `JSONB`/`TEXT` fields for booking and service rules |
| `business_location_intelligence` | Location context and scoring used by the V5 generator | Can be `Empty` on free/basic flows; when filled it is `JSONB` with scores, hooks, and narrative |
| `opening_hours` | Opening-hours context used by the V5 generator | Usually `Filled`; `JSONB` or structured rows with day/time values |
| `business_profile` | Legacy / fallback brand fields used in parts of the page and generator | Mixed; some fields `Filled`, some `Empty`, primarily `TEXT` / `JSONB` |

### Write targets

| Write target | Written by | Notes | Typical state / format |
|-------------|------------|-------|------------------------|
| `business_brand_profile.menu_overview_summary` | `menu-overview-summary` | Cross-menu summary stored before V5 generation | `Filled` when at least one menu exists; `JSONB` summary object |
| `business_brand_profile.brand_profile_v5` | `brand-profile-generator-v5` | Main V5 brand intelligence JSONB | `Filled` for V5 businesses; nested `JSONB` profile with `voice`, `identity`, `layer_0_intelligence`, etc. |
| `business_brand_profile.content_strategy` | `brand-profile-generator-v5` | Strategy summary used by downstream content tools | `Filled` when V5 generation succeeds; `JSONB` strategy object |
| `business_brand_profile.marketing_manager_brief` | `brand-profile-generator-v5` | Layer 6 synthesis brief | `Filled` after V5 generation; `TEXT` brief |
| `business_brand_profile.business_identity_persona` | `brand-profile-generator-v5` | Core facts persona used across generators | `Filled` after V5 generation; `TEXT` persona block |

### Appendix: business_character only

`business_character` is a legacy plain-text descriptor. It is still active as a factual fallback anchor, but it should stay short and descriptive: what the business is, what it offers, and how it operates.

| Area | Key files | Current role |
|------|-----------|--------------|
| Prompt / schema | `supabase/functions/_shared/brand-profile/prompts/prompt-b.ts`, `supabase/functions/_shared/brand-profile/prompts/brand-profile-schema.ts`, `supabase/functions/_shared/prompts/languages/da/brand-profile-b-core-rules.ts`, `supabase/functions/_shared/prompts/languages/da/brand-profile-b-field-instructions.ts`, `supabase/functions/_shared/brand-profile/prompts/prompt-a.ts` | Defines the field as mandatory, factual, and separate from `brand_essence` |
| Runtime consumers | `supabase/functions/brand-profile-generator/index.ts`, `supabase/functions/brand-profile-generator-v5/index.ts`, `supabase/functions/ai-enhance/index.ts`, `supabase/functions/get-quick-suggestions/index.ts`, `supabase/functions/generate-weekly-plan/index.ts`, `supabase/functions/analyze-revenue-drivers/index.ts`, `src/features/contextBuilder.ts` | Read as fallback context or written for backward compatibility |
| UI / forms | `src/pages/dashboard/BrandProfilePageV5.tsx`, `src/pages/dashboard/BusinessProfilePage.tsx` | Displayed or edited as a legacy text field |
| Schema / docs | `supabase/migrations/20260421000001_add_business_brand_profile_ai_columns.sql`, `supabase/migrations/20260430000000_add_brand_elaboration_fields.sql`, `supabase/migrations/20260612000002_flatten_voice_guardrails.sql`, `APPLY_MIGRATIONS_MANUAL.sql`, `_FIX_BRAND_PROFILE_SCHEMA.sql`, `_FIX_BRAND_PROFILE_SCHEMA_V2.sql` | Defines the column and documents migration / compatibility behavior |

**Practical read:** keep `business_character` as the factual “what is this business?” field. Use it when V5 persona / marketing brief is missing, but do not use it for the competitive “why choose us” logic that belongs in `brand_essence`.

### Appendix: business_identity_persona only

`business_identity_persona` is the current flattened V5 persona field. It is the main plain-text persona source for downstream generation, but many flows still treat the nested V5 persona as the upstream source of truth.

| Area | Key files | Current role |
|------|-----------|--------------|
| Schema / migration | `supabase/migrations/20260612000002_flatten_voice_guardrails.sql`, `supabase/migrations/20260612000003_flatten_audience_segments.sql`, `BRAND_PROFILE_V5_DATABASE_MAPPING.md`, `BRAND-DASHBOARD-DATABASE-MAPPING.md` | Adds the flattened top-level column and documents the persona flattening path from `brand_profile_v5->identity->business_character` / `brand_profile_v5.layer_0_intelligence.business_identity.system_persona` |
| V5 generator write path | `supabase/functions/brand-profile-generator-v5/index.ts` | Writes `business_identity_persona` as the top-level persona text and treats `business_character` as deprecated compatibility output |
| Prompt / content generation | `supabase/functions/_shared/brand-profile/v5-prompts.ts`, `supabase/functions/_shared/brand-profile/tone-dna-generator.ts`, `supabase/functions/_shared/brand-profile/marketing-manager-brief-generator.ts` | Injects the persona into prompt templates and synthesizes the marketing-manager brief from it |
| Text generation runtime | `supabase/functions/generate-text-from-idea/resolve-context.ts`, `supabase/functions/generate-text-from-idea/index.ts`, `supabase/functions/get-quick-suggestions/index.ts`, `supabase/functions/get-quick-suggestions-v2/index.ts`, `supabase/functions/analyze-menu-metadata/index.ts`, `supabase/functions/ai-enhance/index.ts`, `supabase/functions/generate-weekly-plan/index.ts`, `supabase/functions/get-weekly-strategy/index.ts` | Uses the persona as the preferred live context, usually after `marketing_manager_brief` and before legacy `business_character` |
| UI / read paths | `src/pages/dashboard/BrandProfilePageV5.tsx`, `src/pages/dashboard/businessProfile/FreeBusinessProfile.tsx`, `src/hooks/usePostCreationAI.ts` | Reads the persona for display or for post-generation context fallbacks |
| Validation / tests | `_check_persona.mjs`, `_verify_persona.mjs`, `_verify_segment_separation.mjs`, `_check_persona_migration.sql`, `_test_flattened_columns.sql`, `_test_regenerate_cafe_faust.sql`, `_check_audience_reconciliation.mjs`, `_verify_strategic_segments_in_persona.sql` | Checks persona storage, length, content quality, and segment leakage |
| Documentation | `_ASSESSMENT_BUSINESS_IDENTITY_PERSONA_INTEGRATION.md`, `_ASSESSMENT_BUSINESS_IDENTITY_PERSONA_CONTENT_FIX.md`, `_SEGMENT_SEPARATION_ARCHITECTURE.md`, `BRAND-PROFILE-V5-FIELD-GAP-MAP.md`, `DASHBOARD-UI-VS-DB-INVENTORY.md`, `_FIX_BRAND_PROFILE_V5_REGENERATION.md`, `_TEST_GUIDE_V5_3.md`, `get-quick-suggestions-prompt-cleanup-matrix.md`, `PHASE-2-COMPLETE-V5-LEGACY-REMOVAL.md` | Documents persona flattening, quality rules, and fallback ordering |

**Practical read:** use `business_identity_persona` as the flattened V5 persona for content generation and strategy context. It should contain only the factual business identity, not the strategic audience segments or the competitive positioning logic that belongs in other fields.

### Appendix: requested brand_brand_profile fields

This appendix is split into two shorter views: live fields that still feed the current prompt/runtime stack, and legacy/schema-only fields that exist mostly for compatibility, inventory, or docs.

#### Live fields

| Field | Where it is used |
|------|-------------------|
| `brand_essence` | `supabase/functions/_shared/brand-profile/fallbacks.ts`, `supabase/functions/_shared/brand-profile/quality-validators.ts`, `supabase/functions/_shared/brand-profile/guardrails.ts`, `supabase/functions/brand-profile-generator-v5/index.ts`, `src/services/brandProfileService.ts` |
| `positioning` | `supabase/functions/_shared/brand-profile/identity-profile.ts`, `supabase/functions/_shared/brand-profile/voice-profile.ts`, `WEEKLY-PLAN-V5-INTEGRATION-IMPLEMENTATION.md` |
| `core_values` | `supabase/functions/_shared/brand-profile/identity-profile.ts`, `supabase/functions/_shared/brand-profile/guardrails.ts` |
| `what_makes_us_different` | `supabase/functions/_shared/brand-profile/identity-profile.ts` |
| `identity_reasoning` | `supabase/functions/_shared/brand-profile/identity-profile.ts` |
| `primary_copy_hook` | `supabase/functions/_shared/brand-profile/tone-dna-generator.ts` |
| `tone_of_voice` | `src/services/brandProfileService.ts`, `supabase/functions/_shared/brand-profile/voice-profile.ts`, `supabase/functions/_shared/brand-profile/guardrails.ts` |
| `voice_rationale` | `src/services/brandProfileService.ts`, `supabase/functions/_shared/brand-profile/voice-profile.ts` |
| `voice_constraints` | `supabase/functions/_shared/brand-profile/guardrails.ts`, `src/services/brandProfileService.ts`, `src/features/aiPromptBuilder.ts` |
| `voice_examples` | `supabase/functions/_shared/brand-profile/voice-profile.ts`, `_TEXT_GENERATION_INPUT_DATA_MAP.md` |
| `tone_model` | `src/services/brandProfileService.ts`, `supabase/functions/_shared/brand-profile/voice-profile.ts` |
| `social_style` | `src/types/database.ts`, `src/services/brandProfileService.ts` |
| `things_to_avoid` | `supabase/functions/_shared/brand-profile/guardrails.ts`, `src/services/brandProfileService.ts` |
| `things_to_avoid_jsonb` | `src/services/brandProfileService.ts`, `src/types/database.ts` |
| `typical_openings` | `src/services/brandProfileService.ts`, `_TEXT_GENERATION_INPUT_DATA_MAP.md` |
| `target_audience` | `src/features/contextBuilder.ts`, `supabase/functions/_shared/brand-profile/voice-profile.ts`, `src/features/aiPromptBuilder.ts` |
| `audience_segments` | `src/pages/dashboard/BrandProfilePageV5.tsx`, `supabase/functions/get-quick-suggestions/index.ts`, `supabase/functions/generate-weekly-plan/index.ts` |
| `communication_goal` | `src/features/contextBuilder.ts`, `src/services/brandProfileService.ts` |
| `content_focus` | `src/services/brandProfileService.ts`, `src/features/contextBuilder.ts`, `supabase/functions/generate-weekly-plan/index.ts` |
| `core_offerings` | `src/services/brandProfileService.ts`, `src/features/contextBuilder.ts` |
| `core_offerings_jsonb` | `src/services/brandProfileService.ts`, `src/types/database.ts` |
| `posting_strategy` | `supabase/functions/generate-weekly-plan/index.ts` |
| `posting_occasions` | `supabase/functions/generate-weekly-plan/index.ts`, `supabase/functions/get-quick-suggestions/index.ts` |
| `posting_occasions_hash` | `supabase/functions/generate-weekly-plan/index.ts` |
| `busy_pattern` | `supabase/functions/generate-weekly-plan/index.ts` |
| `revenue_drivers` | `supabase/functions/generate-weekly-plan/index.ts` |
| `location_intelligence` | `supabase/functions/_shared/brand-profile/tone-dna-generator.ts`, `supabase/functions/_shared/brand-profile/data-gatherer.ts`, `supabase/functions/generate-weekly-plan/index.ts` |
| `trigger_configuration` | `_sync_trigger_config_outdoor_seating.mjs`, `BRAND-DASHBOARD-DATABASE-MAPPING.md` |

#### Legacy, schema-only, or docs-only fields

| Field | Where it is used |
|------|-------------------|
| `brand_essence_elaboration` | `BRAND-DASHBOARD-DATABASE-MAPPING.md`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `business_model_type` | `src/types/database.ts`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `values` | `src/types/database.ts`, `src/types/supabase.ts`, `src/types/brand-profile-v5.ts` |
| `certifications` | `src/types/database.ts`, `src/types/supabase.ts`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `tone_keywords` | `src/types/database.ts`, `src/types/supabase.ts`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `voice_style` | `src/types/supabase.ts`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `do_not_say` | `src/types/database.ts`, `src/types/supabase.ts`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `cta_preference` | `src/types/database.ts`, `src/types/supabase.ts`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `cta_style` | `src/types/database.ts`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `audience_breadth` | `src/types/database.ts`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `classification_rationale` | `src/types/database.ts`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `audience_framework` | `BRAND-DASHBOARD-DATABASE-MAPPING.md`, dashboard inventory docs |
| `content_pillars` | `src/types/database.ts`, `src/types/supabase.ts`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `content_pillars_jsonb` | `BRAND-DASHBOARD-DATABASE-MAPPING.md`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `commercial_baseline_mode` | `BRAND-DASHBOARD-DATABASE-MAPPING.md`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `commercial_strategy_reasoning` | `BRAND-DASHBOARD-DATABASE-MAPPING.md`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `execution_profile` | `BRAND-DASHBOARD-DATABASE-MAPPING.md`, `DASHBOARD-UI-VS-DB-INVENTORY.md` |
| `quality_status` | `DASHBOARD-UI-VS-DB-INVENTORY.md`, `src/types/database.ts` |

**Practical read:** the runtime stack is mostly live around identity, voice, audience, offer context, location intelligence, and posting triggers. The second table is the cleanup list: fields that are still present in the schema or docs, but do not drive the current prompts directly.

---

## UI Sections & Database Mapping

### 🎯 **Section 1: "Din Brandprofil" (Your Brand Profile)**
*Owner-facing summary of the brand - shown at the top of the page*

| UI Element | Database Location | Column Type | Notes | State / Format |
|------------|------------------|-------------|-------|----------------|
| **Brand Essence** (pull-quote) | `business_brand_profile.brand_essence` | TEXT | Primary brand identity statement (fallback: `owner_document.brand_feel`) | Usually `Filled` in legacy profiles; `TEXT` |
| **Stemme** (Voice sentence) | `business_brand_profile.owner_document → tone_sentence` | JSONB | How the brand speaks | `Filled` when owner document exists; nested `JSONB` string/object |
| **Hvad I tilbyder** (USPs) | `business_brand_profile.owner_document → usps[]` | JSONB array | Unique selling points list | `Filled` when owner document exists; `JSONB array` |
| **Jeres gæster** - Segment cards | `business_brand_profile.audience_segments → segments[]` | JSONB | Structured audience segments (Stage B5) | `Filled` after audience generation; `JSONB array` |
| Segment: Label | `audience_segments → segments[].label` | JSONB | Display name | `Filled` inside each segment; `TEXT` |
| Segment: Priority badge | `audience_segments → segments[].priority` | JSONB | 'primary', 'secondary', 'niche' | `Filled` inside each segment; `TEXT` enum-like value |
| Segment: Strategic value | `audience_segments → segments[].strategic_value` | JSONB | 'high', 'medium', 'low' | `Filled` inside each segment; `TEXT` enum-like value |
| Segment: Timing | `audience_segments → segments[].timing[]` | JSONB | `{day, hour_start, hour_end}` | `Filled` inside each segment; `JSONB array/object` |
| Segment: Description | `audience_segments → segments[].mindset_description` or `.who` | JSONB | Who they are | `Filled` when segment exists; `TEXT` |
| Segment: Motivation | `audience_segments → segments[].motivation` | JSONB | Why they visit | `Filled` when segment exists; `TEXT` |
| **Primary mindset** (italic text) | `business_brand_profile.audience_segments → primary_mindset` | JSONB | Overall audience mindset | `Filled` when audience segments exist; `JSONB` or `TEXT` |
| *Fallback: Occasions* | `owner_document → audience.occasions[]` | JSONB | Used if audience_segments not available | `Fallback` path; `JSONB array` |

---

### 📌 **Section 2: Gruppe 1 — Identitet (Identity)**
*Core brand identity - always visible*

| UI Element | Database Location | Column Type | Notes |
|------------|------------------|-------------|-------|
| **Badge label** | Hardcoded: "Gruppe 1 — Identitet" | - | i18n key: `brand.display.group1Badge` |
| **Brand essence** (large text) | `business_brand_profile.brand_essence` | TEXT | Core identity statement |
| **Business type** icon + label | `business_brand_profile.business_character` | TEXT | AI-generated business descriptor (e.g., "Casual industriel café") |

**Expandable Details** (click "Vis positionering"):

| UI Element | Database Location | Column Type | Notes |
|------------|------------------|-------------|-------|
| **Gæstegrundlag** (audience chips) | `business_brand_profile.audience_framework → primaryAudiences[]` | JSONB array | Primary audience types |
| **Variation over dagen** - Time slot cards | `audience_framework → timeSlots[]` | JSONB | Programme-based time slots |
| Time slot: Icon + label | Derived from `timeSlots[].programmes[]` | JSONB | Auto-generated from programme names |
| Time slot: Programmes | `timeSlots[].programmes[]` | JSONB | e.g., "Brunch, Morgenmad" |
| Time slot: Location contexts | Matched from `audience_framework → locationContexts[]` | JSONB | Matched by audience overlap |
| Time slot: Audiences | `timeSlots[].audiences[]` | JSONB | Who visits during this time |
| **Programme Revenue Weights** | `business_brand_profile.programme_revenue_weights` | JSONB | `{"Brunch": 25, "Frokost": 30, ...}` |
| *Fallback text* | `brand_essence_elaboration` | TEXT | Used if audience_framework not available |

---

### 🎤 **Section 3: Gruppe 2 — Stemme (Voice)**
*How the brand communicates*

#### **Modern View** (when `voice_options` exists):

| UI Element | Database Location | Column Type | Notes | State / Format |
|------------|------------------|-------------|-------|----------------|
| **Voice Archetype Selector** | `business_brand_profile.voice_options` | JSONB | Contains recommended + alternative archetypes | Often `Empty` in V5-only flows; `JSONB` |
| Active archetype | `business_brand_profile.voice_archetype` | TEXT | Currently selected archetype key | May be `Empty` in V5-only flows; `TEXT` |
| Archetype: Label | `voice_options → options[key].label` | JSONB | e.g., "Lokal vært" | `Filled` only if voice_options exists; `TEXT` |
| Archetype: Tagline | `voice_options → options[key].tagline` | JSONB | Short description | `Filled` only if voice_options exists; `TEXT` |
| Archetype: Tone keywords | `voice_options → options[key].tone_model.primary_keywords[]` | JSONB | Tone chips | `Filled` only if voice_options exists; `TEXT[]` |
| Archetype: Writing rules | `voice_options → options[key].tone_model.writing_rules[]` | JSONB | How to write | `Filled` only if voice_options exists; `TEXT[]` |
| Archetype: Good examples | `voice_options → options[key].tone_model.good_examples[]` | JSONB | Example phrases | `Filled` only if voice_options exists; `TEXT[]` |
| Archetype: Avoid examples | `voice_options → options[key].tone_model.avoid_examples[]` | JSONB | What not to say | `Filled` only if voice_options exists; `TEXT[]` |
| Archetype: Formality | `voice_options → options[key].tone_model.formality` | JSONB | Formality level | `Filled` only if voice_options exists; `TEXT` |
| Archetype: Example posts | `voice_options → options[key].example_posts[]` | JSONB | Sample captions | `Filled` only if voice_options exists; `JSONB array` |

#### **Legacy View** (when `voice_options` does NOT exist):

| UI Element | Database Location | Column Type | Notes | State / Format |
|------------|------------------|-------------|-------|----------------|
| **Tone keyword chips** | `business_brand_profile.tone_model → primary_keywords[]` | JSONB | Tone descriptors | `Filled` for legacy or hybrid profiles; `TEXT[]` |
| **Rules text** (code block) | `business_brand_profile.tone_of_voice` | TEXT | Writing rules (new format) | `Filled` for legacy profiles; `TEXT` |
| *Legacy primary tone* | `tone_of_voice → primary_tone` | JSONB | Old format (before text rules) | `Empty` in newer profiles; `TEXT` inside JSONB |
| **Voice rationale** (collapsible) | `business_brand_profile.voice_rationale` | TEXT | How voice rules were derived | Often `Filled` in legacy profiles; `TEXT` |
| **Typical opening** | `business_brand_profile.typical_openings[0]` | TEXT[] | First opening phrase | Can be `Empty`; `TEXT[]` |
| **Humor label** | `business_brand_profile.humor_level` | TEXT | 'none', 'subtle', 'playful' | Often `Filled` in V5+ profiles; `TEXT` |

#### **Post Length Guidelines** (editable subsection):

| UI Element | Database Location | Column Type | Notes | State / Format |
|------------|------------------|-------------|-------|----------------|
| Guidelines cards | `business_brand_profile.post_length_guidelines[]` | JSONB | Array of content type guidelines | Usually `Empty` in live schema; if present, `JSONB array` |
| Content type | `post_length_guidelines[].content_type` | JSONB | e.g., "menu_item" | `Filled` only when parent exists; `TEXT` |
| Sentence count | `post_length_guidelines[].sentences` | JSONB | e.g., "2-3" | `Filled` only when parent exists; `TEXT` |
| Character range | `post_length_guidelines[].characters` | JSONB | e.g., "120-180" | `Filled` only when parent exists; `TEXT` |
| Structure | `post_length_guidelines[].structure` | JSONB | Post structure guide | `Filled` only when parent exists; `TEXT` |
| Rationale | `post_length_guidelines[].rationale` | JSONB | Why this length | `Filled` only when parent exists; `TEXT` |

**Note:** `post_length_guidelines` column may not exist in live schema (referenced but not migrated as of 5. maj 2026).

---

### 🎯 **Section 4: Gruppe 3 — Content Pillars**
*What content themes to emphasize*

| UI Element | Database Location | Column Type | Notes | State / Format |
|------------|------------------|-------------|-------|----------------|
| **Content pillar cards** | `business_brand_profile.content_focus` | TEXT | Parsed to array in component | Often `Filled`; `TEXT` with newline-separated items or JSON-like text |
| Pillar: Hook text | `content_hooks[].hook` | Derived | Main theme | `Derived` from `content_focus`; not stored directly |
| Pillar: Usage note | `content_hooks[].usage` | Derived | Optional usage guidance | `Derived` from `content_focus`; not stored directly |

**Transform Logic:**
- Database stores: TEXT (legacy) or JSONB array
- Component parses TEXT as newline-separated list
- Removes leading `-` from each line
- Wraps in `{hook: string, usage?: string}` objects

---

### 🚫 **Section 5: Gruppe 4 — Grænser (Boundaries)**
*What to emphasize and avoid*

| UI Element | Database Location | Column Type | Notes | State / Format |
|------------|------------------|-------------|-------|----------------|
| **💡 Brandfølelse** (Emotional promise) | `business_brand_profile.emotional_promise` | TEXT | Feeling guests take home | Can be `Empty`; if filled, `TEXT` |
| **🚫 Aldrig i opslag** (Never post about) | `business_brand_profile.content_exclusions` | TEXT | Content exclusions (menu posts excepted) | Can be `Empty`; if filled, `TEXT` or structured JSON text |
| **Voice constraints** | `business_brand_profile.voice_constraints` | TEXT | Hard communication rules | Can be `Empty`; if filled, `TEXT` |
| **Avoid examples** | `business_brand_profile.tone_model → avoid_examples[]` | JSONB | Phrases to never use | `Filled` if tone model exists; `TEXT[]` |
| **Signature phrases** (clickable chips) | `business_brand_profile.signature_phrases[]` | TEXT[] | First 5 phrases shown | Can be `Empty`; if filled, `TEXT[]` |

---

### 📊 **Section 6: Post Strategi (Content Strategy)**
*Shown conditionally when `content_strategy` exists*

| UI Element | Database Location | Column Type | Notes | State / Format |
|------------|------------------|-------------|-------|----------------|
| **Primary goal label** | `business_brand_profile.content_strategy → primary_goal` | JSONB | 'drive_footfall', 'build_brand', 'retain_loyalty' | `Filled` after strategy generation; `TEXT` inside `JSONB` |
| **Goal blend chart** | `content_strategy → goal_blend` | JSONB | `{drive_footfall: 60, build_brand: 25, retain_loyalty: 15}` | `Filled` after strategy generation; `JSONB object` |
| **Footfall signals** | `content_strategy → footfall_signals[]` | JSONB | Drive-traffic content themes | `Filled` after strategy generation; `JSONB array` |
| **Brand anchors** | `content_strategy → brand_anchors[]` | JSONB | Brand-building themes | `Filled` after strategy generation; `JSONB array` |
| **Loyalty hooks** | `content_strategy → loyalty_hooks[]` | JSONB | Retention themes | `Filled` after strategy generation; `JSONB array` |
| **Content category weights** | `content_strategy → content_category_weights` | JSONB | `{product_menu: 40, craving_visual: 30, ...}` | `Filled` after strategy generation; `JSONB object` |
| **Natural moments** | `content_strategy → anchors[]` | JSONB | Slot B/C content anchors | `Filled` after strategy generation; `JSONB array` |

---

### 💼 **Section 7: Commercial Strategy**
*Business-specific trigger configuration*

| UI Element | Database Location | Column Type | Notes | State / Format |
|------------|------------------|-------------|-------|----------------|
| **Baseline mode** | `business_brand_profile.commercial_baseline_mode` | TEXT | 'booking_push', 'footfall_push', 'balanced' | Can be `Empty`; if filled, `TEXT` |
| **Trigger configuration** | `business_brand_profile.trigger_configuration` | JSONB | Business-specific trigger policies | Can be `Empty`; if filled, `JSONB object` |
| **Strategy reasoning** | `business_brand_profile.commercial_strategy_reasoning` | TEXT | AI explanation of recommendations | Can be `Empty`; if filled, `TEXT` |
| **Last updated timestamp** | `business_brand_profile.trigger_last_updated` | TIMESTAMPTZ | When config was last modified | Can be `Empty`; if filled, `TIMESTAMPTZ` |
| **Updated by** | `business_brand_profile.trigger_updated_by` | TEXT | 'ai' or user ID | Can be `Empty`; if filled, `TEXT` |

---

## Data Not Shown on Dashboard (Stored but Hidden)

The following fields exist in `business_brand_profile` but are **not displayed** on `/dashboard/brand`:

### **Used Internally by AI** (not user-facing):
- `target_audience` (old format - superseded by `audience_segments`)
- `communication_goal` (old format - superseded by `content_strategy`)
- `competitive_positioning` (deprecated)
- `banned_words` (legacy - replaced by `things_to_avoid_jsonb`)
- `brand_positioning` (legacy)
- `tone_keywords[]` (legacy - replaced by `tone_model`)
- `values[]` (brand values - not displayed)
- `certifications[]` (certifications - not displayed)
- `do_not_say` (JSONB - superseded by structured fields)

### **Voice Enrichment** (consumed by AI, not shown in UI):
- `never_say[]` (avoid list)
- `typical_closings[]` (closing phrases)
- `formality` (formality level)
- `storytelling_style` (storytelling preference)
- `emoji_style` (emoji usage preference)
- `punctuation_style` (punctuation preference)
- `brand_origin_story` (brand history)
- `signature_approach` (unique methodology)
- `owner_perspective` (owner's view)
- `founded_year` (founding year)

### **Visual & Atmosphere** (used in content generation, not shown):
- `recognizable_interior_identity` (photo-based atmosphere)
- `visual_character` (concept label)
- `venue_scene` (visual description)
- `venue_energy` (energy descriptor)
- `guest_situation_type` (guest activity in photos)

### **Strategy Metadata** (internal tracking):
- `offerings_full` (all offering candidates - **DROPPED**)
- `offerings_weights` (offering scoring)
- `offerings_reasoning[]` (offering rationale)
- `offerings_confidence` (confidence level)
- `target_audience_primary[]` (primary audiences - old format)
- `target_audience_seasonal` (seasonal modifiers)
- `audience_reasoning[]` (audience rationale)
- `audience_confidence` (confidence level)
- `goal_reasoning[]` (goal rationale)
- `goal_confidence` (confidence level)
- `strategy_version` (strategy model version)
- `approved_by_user` (user approval flag)

### **Quality & Generation**:
- `quality_status` ('green', 'yellow', 'red')
- `generation_errors` (error log JSONB)
- `last_edited_by` ('ai' or 'user')
- `last_edited_at` (edit timestamp)
- `voice_extraction_source` (extraction method)
- `voice_extracted_at` (extraction timestamp)
- `voice_confidence_score` (0-100 confidence)

### **Location Intelligence**:
- `location_intelligence` (denormalized snapshot from `business_location_intelligence`)

### **Posting Schedule**:
- `posting_occasions` (AI-selected schedule JSONB)
- `posting_occasions_hash` (staleness detection)

### **JSONB Source of Truth** (replaced legacy TEXT columns):
- `things_to_avoid_jsonb`
- `image_preferences_jsonb`
- `core_offerings_jsonb`

### **Business Classification** (Stage B0):
- `business_model_type` ('offer_led', 'occasion_led', 'destination_led', 'audience_led')
- `primary_copy_hook` ('product', 'location', 'programme', 'identity')
- `audience_breadth` ('narrow', 'mixed', 'broad')
- `classification_rationale` (classification explanation)

### **Settings**:
- `booking_link` (reservation URL - shown in other contexts)
- `cta_preference` (CTA style)
- `business_voice` (legacy voice setting)
- `content_strategy_confirmed` (owner confirmation flag)
- `atmosphere_confidence_level` ('none', 'building', 'high')

### **Dropped Columns** (no longer in schema):
- `voice_style` (dropped)
- `cta_style` (dropped)
- `content_pillars_jsonb` (dropped)
- `personality` (dropped)
- `voice_execution` (dropped)
- `execution_profile` (dropped)
- `sample_posts` (dropped)
- `what_makes_us_different` (dropped)

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────┐
│  USER VIEWS: /dashboard/brand                           │
│  Route: src/App.tsx → BrandProfilePageV5                │
└─────────────────────────┬───────────────────────────────┘
                          │
                          │ Fetch via Supabase client
                          ↓
┌─────────────────────────────────────────────────────────┐
│  DATABASE: business_brand_profile                       │
│  • One row per business (PK: business_id)               │
│  • Main V5 JSONB lives in brand_profile_v5              │
│  • Menu summary stored in menu_overview_summary         │
│  • Legacy brand columns still exist for fallback use    │
└─────────────────────────┬───────────────────────────────┘
                          │
                          │ Transform via transformProfile()
                          ↓
┌─────────────────────────────────────────────────────────┐
│  PAGE: BrandProfilePageV5.tsx                           │
│  • Fetches businesses → brand profile → programme rows  │
│  • Shows programme detection, menu summary, V5 sections  │
│  • Regenerate flow calls menu-overview-summary first     │
└─────────────────────────────────────────────────────────┘
```

---

## Key Transform Functions

### `transformProfile(dbProfile)` 
**Location:** `src/pages/dashboard/BrandProfilePageV5.tsx`

Converts database format to display format:
- Parses JSON fields stored as strings
- Handles legacy vs. new tone format
- Wraps content_focus TEXT into array of `{hook, usage}` objects
- Ensures target_audience and competitive_positioning have expected structure
- Maps all JSONB fields to typed objects

---

## Regeneration Flow

**Trigger:** User clicks "🔄 Regenerér" button  
**Handler:** `handleRegenerateV5()` in `BrandProfilePageV5.tsx`

1. Calls `menu-overview-summary` Edge Function first
2. `menu-overview-summary` reads `businesses` + `menu_results_v2`
3. It upserts `business_brand_profile.menu_overview_summary`
4. Calls `brand-profile-generator-v5` with the menu summary payload
5. `brand-profile-generator-v5` reads `business_programme_profiles`, `business_brand_profile`, `business_location_intelligence`, `business_operations`, and `opening_hours`
6. It writes the regenerated V5 payload back to `business_brand_profile`
7. The page refetches brand and programme data and rerenders

**Edge Functions:** `supabase/functions/menu-overview-summary/index.ts` and `supabase/functions/brand-profile-generator-v5/index.ts`

---

## Authentication & Access Control

- **User must be logged in** to view `/dashboard/brand`
- Redirects to `/login` if not authenticated
- Component fetches `businesses.id` based on `auth.users.id` (owner_id)
- Only shows brand profile for businesses owned by logged-in user

---

## Tier-Based Features

- **Free Tier:** Shows upgrade prompt instead of brand profile
- **Smart/Standard Plus & Premium:** Full brand profile functionality
- Tier check happens in component before rendering

---

## Technical Notes

1. **One-to-One Relationship:** Each business has exactly one `business_brand_profile` row
2. **JSONB Columns:** Most structured data stored as JSONB for flexibility
3. **Array Columns:** Some fields use `TEXT[]` for simple lists
4. **Legacy Compatibility:** Old format columns kept alongside new JSONB columns during migration
5. **Missing Column:** `post_length_guidelines` referenced in code but not in live schema (needs migration)
6. **Dropped Columns:** 10+ columns have been removed over time (see "Dropped Columns" section)

---

## Related Tables

While the brand dashboard primarily uses `business_brand_profile`, it references:

- **`businesses`** - for `business_id`, owner verification
- **`business_profile`** - legacy fallback for some fields (e.g., `ai_brand_context`)
- **`business_location_intelligence`** - denormalized into `location_intelligence` JSONB

---

## Quick Suggestions Input Matrix

This section maps the dashboard overview data to the fields actually used by `get-quick-suggestions`.

### Direct prompt inputs

| Overview source | Prompt input / effect | Current status |
|-----------------|------------------------|----------------|
| `business_brand_profile.brand_essence` | Core brand identity anchor for idea selection and tone | Live |
| `business_brand_profile.business_character` | Plain-language business descriptor used as a shared context anchor | Live |
| `business_brand_profile.audience_segments` | Audience matching, timing, tone note, CTA type, content angles | Live |
| `business_brand_profile.content_strategy.brand_anchors` | Confirmed identity signals for idea framing | Live |
| `business_brand_profile.content_strategy.loyalty_hooks` | Retention / repeat-visit framing signals | Live |
| `business_brand_profile.content_strategy.primary_goal` | High-level content direction | Live |
| `business_brand_profile.content_strategy.anchors` | Slot B/C framing cues | Live |
| `business_brand_profile.voice_constraints` | Guardrail language for what not to say | Live |
| `business_brand_profile.tone_model` | Tone keywords, writing rules, avoid examples | Legacy support |
| `business_brand_profile.tone_of_voice` | Legacy style fallback, only used if newer voice fields are missing | Legacy support |
| `business_brand_profile.humor_level` | Tone modulation for the prompt | Legacy support |
| `business_brand_profile.voice_rationale` | Register guidance when V5 voice guidance is unavailable | Legacy support |
| `business_brand_profile.recognizable_interior_identity` | Atmosphere and BTS idea framing | Legacy support |
| `business_brand_profile.visual_character` | Atmosphere / visual framing fallback | Legacy support |
| `business_brand_profile.venue_scene` | Atmosphere / scene fallback | Legacy support |
| `business_brand_profile.venue_energy` | Atmosphere energy cue | Legacy support |
| `business_brand_profile.guest_situation_type` | Guest-context cue for atmosphere ideas | Legacy support |
| `business_brand_profile.posting_occasions` | High-priority occasion triggers for Slot B/C | Live |
| `business_brand_profile.location_intelligence` | Location facts, motivations, and confirmed locality hooks | Live |
| `business_brand_profile.brand_profile_v5.voice` | Current V5 voice rules, examples, emoji, formality, and anchors | Live |
| `business_brand_profile.brand_profile_v5.guardrails` | Seasonal notes and strict avoid patterns | Live |
| `business_brand_profile.brand_profile_v5.layer_0_intelligence.business_identity.system_persona` | Main persona foundation for paid-tier prompt assembly | Live |
| `business_brand_profile.brand_profile_v5.layer_0_intelligence.geographic_context.narrative` | Location tone and framing narrative | Live |

### Supporting tables used in the prompt flow

| Supporting source | Prompt input / effect | Current status |
|-------------------|------------------------|----------------|
| `business_programme_profiles` | Programme-aware audience matching and time-window selection | Live / primary |
| `business_operations` | Reservation, walk-in, and operational CTA constraints | Live / primary |
| `business_profile.booking_url` | Booking CTA support when available | Live / secondary |
| `business_brand_profile.brand_profile_v5.layer_1_programmes` | Fallback programme context from V5 JSONB | Live / secondary |
| `business_brand_profile.brand_profile_v5.layer_0_intelligence.menu_overview` | Culinary identity and signature theme context | Live / secondary |
| `business_brand_profile.menu_overview_summary` | Cross-menu summary, average price, signature themes | Live / secondary |
| `business_brand_profile.gastronomic_profile` | Ultra-short food-style profile used in context assembly | Live / secondary |

### Not used as direct prompt inputs in the current quick-suggestions path

- `post_length_guidelines`
- `voice_options`
- `programme_revenue_weights`
- `commercial_baseline_mode`
- `trigger_configuration`
- `commercial_strategy_reasoning`

### Practical reading of the flow

The quick-suggestions prompt is built mostly from three layers of data:

1. V5 brand identity and guardrails from `business_brand_profile.brand_profile_v5`
2. Active programme timing and behavioral matching from `business_programme_profiles`
3. Legacy fallback fields from `business_brand_profile` only when V5 data is incomplete

That means the dashboard overview is not used uniformly. The most important fields for quick suggestions are the V5 identity/voice fields, programme profiles, content strategy, and the guardrails/occasion data. Older dashboard sections still matter, but mainly as compatibility fallbacks.

---

## Generate Weekly Plan Input Matrix

This section maps the dashboard overview data to the fields actually used by `generate-weekly-plan`.

### Direct prompt inputs / execution inputs

| Overview source | Prompt input / effect | Current status |
|-----------------|------------------------|----------------|
| `weekly_strategies.id` | Required `strategy_id` handoff from the AI Weekly Plan page | Live |
| `weekly_strategies.narrative` | Weekly strategic narrative passed into plan execution | Live |
| `weekly_strategies.strategic_priorities` | Priority framing for post execution | Live |
| `weekly_strategies.strategic_brief` | Phase 1 brief context for plan generation | Live |
| `weekly_strategies.post_ideas` | Selected ideas used to build the weekly plan | Live |
| `weekly_strategies.generated_at` | Strategy freshness / handoff timestamp | Live |
| `weekly_strategies.week_number` | Week metadata for plan output | Live |
| `weekly_strategies.business_type` | Business-type context for the generator | Live |
| `weekly_strategies.platforms` | Platform selection for the plan | Live |
| `weekly_strategies.subscription_tier` | Smart vs Pro post-count behavior | Live |
| `weekly_strategies.target_post_count` | Desired post count for the week | Live |
| `weekly_strategies.week_context_snapshot` | Primary continuity payload for snapshot-path execution | Live |
| `business_brand_profile.brand_profile_v5` | Brand voice, guardrails, menu overview, and identity context reconstructed into the plan input | Live |
| `business_brand_profile.business_character` | Business descriptor used as a shared planning anchor | Live |
| `business_brand_profile.business_archetype` | Legacy / compatibility classification used in strategy context | Legacy support |
| `business_brand_profile.revenue_drivers` | Revenue-moment signal for weekly strategy alignment | Live |
| `business_brand_profile.target_type_mix` | Content-type allocation hint for plan balance | Live |
| `business_brand_profile.brand_essence` | Core identity anchor used in the reconstructed brand profile | Live |
| `business_brand_profile.gastronomic_profile` | Food-style summary used to preserve culinary context | Live |
| `business_brand_profile.posting_strategy` | Legacy strategic posting context | Legacy support |
| `business_brand_profile.busy_pattern` | Operational rhythm signal used in plan reasoning | Legacy support |
| `business_brand_profile.voice_guardrails` | Forbidden phrasing and safety constraints | Live |
| `business_brand_profile.business_identity_persona` | Main persona block when available | Live |
| `business_brand_profile.booking_link` | CTA and booking fallback data | Live |
| `business_brand_profile.content_strategy` | Goal framing and content balance cues | Live |
| `business_brand_profile.recognizable_interior_identity` | Visual / atmosphere context fallback | Legacy support |
| `business_brand_profile.never_say` | Additional voice exclusion list | Legacy support |
| `business_brand_profile.typical_openings` | Opening-style fallback for captions | Legacy support |
| `business_brand_profile.things_to_avoid` | Avoidance guidance in legacy form | Legacy support |
| `business_brand_profile.content_focus` | Content theme background context | Legacy support |
| `business_brand_profile.core_offerings` | Product / offer context for plan ideas | Legacy support |
| `business_brand_profile.tone_model` | Tone and voice modulation fallback | Legacy support |
| `business_brand_profile.tone_of_voice` | Legacy style fallback | Legacy support |
| `business_brand_profile.enhanced_social_examples` | Example language used downstream by caption assembly | Live |
| `business_brand_profile.enhanced_avoid_examples` | Negative examples used by downstream text generation | Live |

### Supporting tables used in the execution flow

| Supporting source | Prompt input / effect | Current status |
|-------------------|------------------------|----------------|
| `business_location_intelligence` | Location context, area type, and comfort/timing cues | Live / primary |
| `business_profile.menu_signal` | Programme/menu signal when reconstructing week context | Live / primary |
| `menu_items_normalized` | Canonical dish descriptions and service-period matching | Live / primary |
| `menu_results_v2` | Fallback menu source and language-filtered history | Live / primary |
| `business_programme_profiles` | Active programme filters and goal-split weighting | Live / primary |
| `business_operations` | Reservation, walk-in, takeaway, kitchen-close, and language constraints | Live / primary |
| `opening_hours` | Open-day filtering and daily open/close windows | Live / primary |
| `profiles.selected_platforms` | Connected platform selection for execution | Live / primary |
| `business_social_accounts` | Validation-only connected platform check | Live / secondary |
| `subscriptions.tier` | Validation-only capability and tier context | Live / secondary |
| `weekly_content_plans` | Previous-plan variation tracking | Live / secondary |

### Not used as direct prompt inputs in the current weekly-plan path

- `voice_options`
- `commercial_baseline_mode`
- `trigger_configuration`
- `commercial_strategy_reasoning`
- `post_length_guidelines`
- `posting_occasions_hash`

### Practical reading of the flow

`generate-weekly-plan` is not a fresh brand-prompt generator. It is an execution layer that consumes the saved weekly strategy plus the live brand and operations context needed to turn selected ideas into a dated content plan.

The most important inputs are:

1. `strategy_id` and the stored `weekly_strategies` row
2. V5 brand identity, voice, and guardrails from `business_brand_profile`
3. Active programme, menu, and opening-hours data from the operational tables

In practice, the dashboard overview matters here mostly through the V5 brand profile and the operating context. The plan step relies less on legacy display sections and more on the saved strategy handoff plus current execution constraints.

---

## Weekly Strategy Input Matrix

This section maps the dashboard overview data to the fields actually used by `get-weekly-strategy`.

### Direct prompt and strategy inputs

| Overview source | Weekly strategy input / effect | Current status |
|-----------------|--------------------------------|----------------|
| `business_brand_profile.business_archetype` | Primary business model / operating model used in strategy selection | Live |
| `business_brand_profile.business_character` | Business character and classification fallback for strategy framing | Live |
| `business_brand_profile.brand_profile_v5.layer_0_intelligence.business_identity.system_persona` | Main identity foundation for weekly strategy briefing | Live |
| `business_brand_profile.brand_profile_v5.layer_0_intelligence.geographic_context` | City, location type, narrative, and local positioning cues | Live |
| `business_brand_profile.brand_profile_v5.layer_0_intelligence.menu_overview` | Cross-menu identity, average price, signature themes, gastronomic profile | Live |
| `business_brand_profile.brand_profile_v5.layer_1_programmes` | Fallback programme context when database programmes are incomplete | Live |
| `business_brand_profile.brand_profile_v5.voice` | Voice rules, tone, sentence structure, emoji level, content anchors | Live |
| `business_brand_profile.brand_profile_v5.guardrails` | Seasonal notes and avoid-pattern guidance | Live |
| `business_brand_profile.brand_profile_v5.writing_examples` | Supporting language style for strategic copy generation | Live |
| `business_brand_profile.content_strategy` | Goal mix, brand anchors, loyalty hooks, natural moments | Live |
| `business_brand_profile.content_strategy_confirmed` | Signals whether content_strategy is owner-confirmed | Live |
| `business_brand_profile.target_audience` | Legacy audience fallback if V5 segments are missing | Legacy support |
| `business_brand_profile.communication_goal` | Legacy communication fallback for strategy briefing | Legacy support |
| `business_brand_profile.identity_keywords` | Legacy identity keyword fallback | Legacy support |
| `business_brand_profile.recognizable_interior_identity` | Atmosphere / location / venue identity fallback | Legacy support |
| `business_brand_profile.never_say` | Hard avoid language for strategic copy generation | Live / legacy mix |
| `business_brand_profile.typical_openings` | Example phrasing and tonal fallback | Legacy support |
| `business_brand_profile.things_to_avoid` | Legacy avoid-language fallback | Legacy support |
| `business_brand_profile.voice_rationale` | Voice guidance fallback when V5 voice is missing | Legacy support |
| `business_brand_profile.location_intelligence` | Location motivations, area type, and proximity hooks | Live |
| `business_brand_profile.posting_occasions` | Priority occasion triggers used for weekly framing | Live |
| `business_brand_profile.revenue_drivers` | Commercial priority and business-model weighting | Live |
| `business_brand_profile.target_type_mix` | Content type distribution target | Live |
| `business_brand_profile.booking_link` | Booking CTA support | Live |

### Supporting tables used in the strategy flow

| Supporting source | Weekly strategy input / effect | Current status |
|-------------------|--------------------------------|----------------|
| `businesses` | Business name, category, and ownership validation | Live / primary |
| `business_locations` | City and country for language and regional filtering | Live / primary |
| `business_location_intelligence` | Neighborhood, area type, category scores, marketing hooks, coordinates | Live / primary |
| `business_operations` | Outdoor seating, reservation settings, walk-in behavior, kitchen close time, takeaway, table service | Live / primary |
| `opening_hours` | Open days, daily open/close times, weekly availability filter | Live / primary |
| `menu_items_normalized` | Normalized menu item pool for weekly content selection | Live / primary |
| `menu_results_v2` | Fallback menu evidence, AI summaries, signature items, service periods | Live / primary |
| `business_programme_profiles` | Active programmes, time windows, operating days, goal splits, audience segments | Live / primary |
| `profiles.selected_platforms` | Platform targeting for the strategy output | Live |
| `business_profile.menu_signal` | Menu signal fallback for content synthesis | Live / secondary |

### Not used as direct strategy inputs in the current flow

- `post_length_guidelines`
- `voice_options`
- `commercial_baseline_mode`
- `trigger_configuration`
- `commercial_strategy_reasoning`
- `strategic_audience_segments` as a primary source, because weekly strategy relies on the live programme rows and V5 persona first

### Practical reading of the flow

The weekly strategy generator uses a broader but more operationally grounded set of inputs than quick suggestions. The strategy is assembled from:

1. V5 brand identity and commercial context from `business_brand_profile.brand_profile_v5`
2. Live operational constraints from `business_operations`, `opening_hours`, and `business_locations`
3. Menu and programme evidence from `menu_items_normalized`, `menu_results_v2`, and `business_programme_profiles`
4. Legacy brand fields only as compatibility fallbacks when V5 data is incomplete

The strongest dashboard fields for weekly strategy are the V5 persona, location intelligence, revenue drivers, target type mix, programme profiles, opening hours, and menu evidence. The older text fields still matter, but mostly to keep older businesses functioning until all regenerated V5 data is present.

---

## AI Weekly Plan Page Input Matrix

This section maps the actual inputs used by `http://localhost:3000/dashboard/ai-weekly-plan`.

### Direct page inputs

| Page source | Page input / effect | Current status |
|-------------|---------------------|----------------|
| `auth.user` | Required to load the plan for the signed-in owner | Live |
| `businesses.id` (by `owner_id`) | Primary business lookup before any plan generation | Live |
| `weekly_content_plans` | Existing plan load / cache / regeneration target | Live |
| `weekly_content_plans.posts` | Weekly plan rendering, post detail, and create-post transfer | Live |
| `weekly_content_plans.summary` | Plan summary cards and header counts | Live |
| `weekly_content_plans.strategy_id` | Handoff to the stored weekly strategy | Live |
| `weekly_content_plans.week_start` | Determines whether current or next week is displayed | Live |
| `weekly_content_plans.week_end` | Week-range display in the overview component | Live |
| `weekly_content_plans.generated_at` | Weather staleness checks and refresh prompts | Live |
| `weekly_content_plans.learning_data` | Edit / timing / platform change tracking | Live |
| `weekly_strategies.narrative` | Strategy headline and overview shown in the plan | Live |
| `weekly_strategies.strategy_rationale` | Strategic rationale shown in plan context | Live |
| `weekly_strategies.week_context_snapshot` | Main context source for weather, events, CTA mode, and summary chips | Live |
| `weekly_strategies.post_ideas` | Used to determine booking-nudge state and idea availability | Live |
| `business_location_intelligence.latitude` | Weather refresh input for Open-Meteo | Live |
| `business_location_intelligence.longitude` | Weather refresh input for Open-Meteo | Live |
| `business_location_intelligence.neighborhood` | Location context in the generated plan summary | Live |
| `business_location_intelligence.area_type` | Area / venue framing in the plan context | Live |
| `business_location_intelligence.category_scores` | Input to comfort-tier and outdoor-opportunity assessment | Live |
| `business_location_intelligence.location_marketing_hooks` | Supporting location hooks in plan reasoning | Live |
| `business_operations.enabled_menu_languages` | Language filtering for menu evidence in generation and refresh flows | Live |
| `business_operations.has_outdoor_seating` | Outdoor seating availability used in weather / CTA reasoning | Live |
| `business_operations.reservation_required` | CTA mode and booking availability context | Live |
| `business_operations.accepts_walk_ins` | CTA mode and walk-in context | Live |
| `opening_hours.weekday` | Open-day filtering and per-day scheduling | Live |
| `opening_hours.open_time` | Daily availability and timing constraints | Live |
| `opening_hours.close_time` | Daily availability and timing constraints | Live |
| `menu_items_normalized.item_name` | Canonical dish name for selection and transfer to create-post | Live |
| `menu_items_normalized.item_description` | Caption seed, dish rationale, and detail modal context | Live |
| `menu_items_normalized.service_periods` | Service-period matching for dish selection and duplicate disambiguation | Live |
| `menu_items_normalized.service_period_name` | Menu block labeling and execution grouping | Live |
| `menu_items_normalized.menu_result_id` | Language-filter linkage back to `menu_results_v2` | Live |
| `menu_results_v2.structured_data` | Structured dish lookup fallback when normalized menu data is missing | Live |
| `menu_results_v2.ai_summary` | Menu summary and fallback dish lines for execution context | Live |
| `menu_results_v2.service_periods` | Service-period fallback for older menu rows | Live |
| `business_programme_profiles` | Active programme filtering and goal-split weighting in plan assembly | Live |
| `profiles.selected_platforms` | Platform selection used in the plan and downstream create flow | Live |
| `business_social_accounts` | Validation-only connected platform check during generation | Live |
| `subscriptions.tier` | Validation-only tier capabilities for plan feasibility | Live |
| `published_posts` | Commitment history for locking already-published ideas | Live |
| `posts` | Committed suggestion / scheduled-plan locking via `useCommittedSuggestions` | Live |

### Supporting state and derived inputs

| Source | Page input / effect | Current status |
|--------|---------------------|----------------|
| `useCommittedSuggestions` | Locks already-committed weekly-plan ideas and dates | Live |
| `weatherDays` | Weather summary, stale alerts, and comfort-tier change detection | Derived |
| `weekSummary` | Context strip chips for occasion, weather, economic signal, and CTA mode | Derived |
| `weatherAssessment` | Impacted-posts alert after weather refresh | Derived |
| `committedWeeklyPlanIdeaIds` | Disable duplicate idea selection in the plan view | Derived |
| `committedWeeklyPlanDates` | Date-based lock for already committed slots | Derived |
| `ownerNote` | Optional Pro-only regeneration guidance sent to strategy generation | User input |
| `viewingWeek` | Switches between current week and next week plan rows | UI state |
| `generateNewPlan(forceRegenerate)` | Triggers the strategy-first → plan-second pipeline | UI action |
| `handleRefreshWeather()` | Refreshes live weather and recomputes comfort tier changes | UI action |
| `handleCreatePost(post)` | Transfers the selected weekly-plan post into the create flow | UI action |

### What the page does with that data

The AI weekly-plan page is an orchestration surface, not a generator itself. It:

1. Looks up the current business for the logged-in user.
2. Loads an existing weekly plan if one exists, or starts the generation pipeline.
3. Calls `get-weekly-strategy` first, then passes the resulting `strategy_id` into `generate-weekly-plan`.
4. Rehydrates the UI from `weekly_content_plans` plus `weekly_strategies.week_context_snapshot`.
5. Uses live weather and location data to decide whether the existing plan should be refreshed.
6. Locks already-committed ideas through `useCommittedSuggestions` so the user cannot duplicate published content.

The important distinction is that this page does not assemble brand strategy from scratch. It consumes the saved strategy, the saved plan, and live operational data to decide whether to show, refresh, or regenerate the weekly plan.

---

## Generate Text From Idea Input Matrix

This section maps the actual inputs used by `generate-text-from-idea` when a user transfers a weekly-plan post or a quick idea into the create flow.

### Direct request inputs

| Source | Text-generation input / effect | Current status |
|--------|-------------------------------|----------------|
| `businessId` | Required business lookup for all downstream context fetches | Live |
| `suggestion.id` | Suggestion identifier used for tracking and CTA behavior | Live |
| `suggestion.source` | Switches between `ai_ideas` and `weekly_plan` prompt paths | Live |
| `suggestion.title` | Main hook / title fed into the content resolver | Live |
| `suggestion.captionBase` | Menu brief or fallback content brief for copy generation | Live |
| `suggestion.contentType` | Determines menu vs atmosphere vs behind-scenes prompt structure | Live |
| `suggestion.menuItemId` | Primary UUID lookup into `menu_items_normalized` | Live |
| `suggestion.menuItemName` | Fallback dish name for content and hashtag resolution | Live |
| `suggestion.menuItemDescription` | Fallback dish description for prompt context | Live |
| `suggestion.ctaIntent` | CTA selection seed for booking / visit / engagement behavior | Live |
| `suggestion.goalMode` | Weekly-plan goal mode used to select the directive block | Live |
| `suggestion.photoIdea` | Fallback visual / photo direction for AI ideas | Live |
| `suggestion.whyExplanation` | Legacy occasion / rationale fallback for AI ideas | Live |
| `suggestion.occasionContext` | Creative occasion brief, especially for AI ideas | Live |
| `suggestion.guestMoment` | Weekly-plan guest/occasion context injected into the prompt | Live |
| `suggestion.timingDay` | Weekly-plan timing context used in the UGEPLANKONTEKST block | Live |
| `suggestion.timingTime` | Weekly-plan timing context used in the UGEPLANKONTEKST block | Live |
| `suggestion.timingRationale` | Why this time was selected | Live |
| `suggestion.visualSubject` | Visual direction subject from weekly-plan posts | Live |
| `suggestion.visualAngle` | Visual direction angle from weekly-plan posts | Live |
| `suggestion.visualSetting` | Visual direction setting from weekly-plan posts | Live |
| `suggestion.platformFormat` | Photo / reel / carousel routing in the prompt | Live |
| `suggestion.selectionRationale` | Why the post was chosen for the week | Live |
| `suggestion.captionFirstLine` | Potential opening-line seed, especially for weekly-plan non-menu posts | Live |
| `suggestion.holidayContext` | Holiday-aware content cue | Live |
| `suggestion.drinkPairing` | Beverage pairing hint for the copy AI | Live |
| `suggestion.strategyBrief` | Compact strategic directive from Phase 2b | Live |
| `suggestion.mediaDirection` | Photography / scene direction from weekly strategy | Live |
| `suggestion.sceneSpec` | Scene specification for experience posts | Live |
| `platforms` | Platform-specific CTA / hashtag and output formatting | Live |
| `tier` | Free vs paid model selection and validation depth | Live |

### Supporting database reads

| Supporting source | Text-generation input / effect | Current status |
|-------------------|--------------------------------|----------------|
| `businesses` | Business name, vertical, city, language baseline | Live / primary |
| `business_locations` | Primary city/country lookup for language and locale | Live / primary |
| `business_location_intelligence.local_location_reference` | Operator-set location phrase injected as factual location vocabulary | Live / primary |
| `business_location_intelligence.narrative` | Location narrative for atmosphere / location posts | Live / primary |
| `business_brand_profile.brand_essence` | Core brand identity fallback for paid-tier prompt building | Live / primary |
| `business_brand_profile.tone_of_voice` | Legacy voice baseline / writing rules fallback | Live / primary |
| `business_brand_profile.tone_model` | Writing rules, examples, anchors, emoji level | Live / primary |
| `business_brand_profile.content_strategy` | Content anchors and strategy framing | Live / primary |
| `business_brand_profile.things_to_avoid` | Legacy avoid language merged into guardrails | Live / primary |
| `business_brand_profile.voice_constraints` | Hard voice constraints injected into the prompt | Live / primary |
| `business_brand_profile.voice_examples` | Prefer / avoid vocabulary and example language | Live / primary |
| `business_brand_profile.booking_link` | Booking CTA support when relevant | Live / primary |
| `business_brand_profile.voice_rationale` | Register guidance for scene / mood posts | Live / primary |
| `business_brand_profile.recognizable_interior_identity` | Factual venue/interior description for atmosphere posts | Live / primary |
| `business_brand_profile.business_identity_persona` | Full persona fallback when V5 persona is unavailable | Live / primary |
| `business_brand_profile.identity_keywords` | Identity chips for prompt framing | Live / primary |
| `business_brand_profile.voice_guardrails` | Forbidden phrases, technical terms, weather clichés, avoid patterns | Live / primary |
| `business_brand_profile.brand_profile_v5` | V5 voice, tone DNA, writing examples, and location vocabulary source | Live / primary |
| `opening_hours` | Today open/close time for conditional hour mentions | Live / primary |
| `business_operations` | Reservation, walk-in, takeaway, table service, delivery, parking, kitchen close | Live / primary |
| `business_profile.key_offerings` | Free-tier menu names used as a verification fallback | Live / secondary |
| `business_profile.menu_description` | Free-tier menu / offer context | Live / secondary |
| `business_profile.user_about_text` | Free-tier venue identity fallback | Live / secondary |
| `menu_items_normalized` | Primary UUID lookup for dish names and descriptions | Live / primary |
| `menu_results_v2` | Fallback menu structure and AI summaries when normalized rows are missing | Live / primary |
| `published_posts` | Not read directly here, but indirectly relevant via committed suggestion / transfer flow | Context only |

### Weekly-plan specific prompt context

| Weekly-plan field | Text-generation effect | Current status |
|-------------------|------------------------|----------------|
| `weeklyPlanSuggestion.guestMoment` | Becomes `GÆSTEMOMENT` in the UGEPLANKONTEKST block | Live |
| `weeklyPlanSuggestion.timingDay` / `timingTime` | Becomes `TIMING` in the prompt context | Live |
| `weeklyPlanSuggestion.visualSubject` / `visualAngle` / `visualSetting` | Becomes `VISUEL RETNING` in the prompt context | Live |
| `weeklyPlanSuggestion.captionFirstLine` | Promoted to hook for non-menu weekly-plan posts | Live |
| `weeklyPlanSuggestion.selectionRationale` | Becomes `POSTENS ROLLE I UGEN` | Live |
| `weeklyPlanSuggestion.holidayContext` | Injected as a hard holiday constraint | Live |
| `weeklyPlanSuggestion.strategyBrief` | Added as compact strategic direction | Live |
| `weeklyPlanSuggestion.drinkPairing` | Passed to prompt and later preserved in post detail | Live |

### Direct prompt-building outputs from helper layers

| Helper output | Text-generation effect | Current status |
|--------------|-----------------------|----------------|
| `fetchBusinessContext()` | Supplies brand tone, guardrails, venue identity, opening hours, booking link, and persona fields | Live |
| `resolveContentContext()` | Produces the final `hook`, `contentBlock`, `menuItemName`, `menuItemDescription`, and `resolvedGoalMode` | Live |
| `buildWeeklyPlanContext()` | Builds the `UGEPLANKONTEKST` block for weekly-plan transfers | Live |
| `selectCTA()` | Chooses CTA text/style/intent based on booking and content type | Live |
| `buildPrompt()` / prompt builders | Turns the resolved context into the final language-specific caption prompt | Live |

---

## Requested Field Appendix: Operations, Profile, and Location Cache

This appendix mirrors the earlier field mapping format for the additional fields you asked about.

### Field-state legend

- **Live / primary**: actively read in current runtime or prompt code
- **Live / legacy support**: still read, but as a compatibility fallback
- **Schema-only / dropped**: present in schema history or generated types, but not read by current runtime code
- **Archive / legacy only**: only used by old dashboard code or archive pages

### `business_operations`

| Field | Where it is used | Status |
|-------|------------------|--------|
| `typical_busy_periods` | Old schema / archived migration paths only; no current runtime reads found | Schema-only / dropped - DROP |
| `typical_slow_periods` | Old schema / archived migration paths only; no current runtime reads found | Schema-only / dropped - DROP |
| `seating_capacity_indoor` | `supabase/functions/analyze-concept-fit/index.ts`, `supabase/functions/_shared/brand-profile/build-week-context-brand-voice.ts`, `supabase/functions/get-quick-suggestions/index.ts`, `src/types/*` | Live / primary |
| `seating_capacity_outdoor` | `supabase/functions/analyze-concept-fit/index.ts`, `supabase/functions/get-quick-suggestions/index.ts`, `supabase/functions/_shared/brand-profile/build-week-context-brand-voice.ts`, `src/types/*` | Live / primary |
| `average_check_per_person` | Dropped in migration `20260420000008`; still referenced in older docs / inventory files only | Schema-only / dropped - DROP |
| `price_level` | `supabase/functions/get-quick-suggestions/index.ts` (line 1209, 2255), `supabase/functions/_shared/brand-profile/build-week-context-brand-voice.ts` (line 58), type definitions | **Live / primary - PRIMARY SOURCE FOR PRICE DATA** |

**CRITICAL NOTE**: The live `price_level` data is stored in **business_operations.price_level** (e.g., "moderate"), NOT in business_profile.price_level (which is empty).

### `business_profile`

| Field | Where it is used | Status |
|-------|------------------|--------|
| `price_level` | `supabase/functions/_shared/brand-profile/prompts/prompt-a.ts` (reads EMPTY field; live data in business_operations.price_level) | Schema-only / EMPTY - DROP |
| `target_audience` | `src/services/brandProfileService.ts`, `src/services/enhancedAIContext.ts`, `src/features/contextBuilder.ts`, `src/features/aiPromptBuilder.ts`, `src/brand-profile/forbidden-gate.ts`, prompt / test helpers | Live / legacy support |
| `menu_structure` | `src/services/enhancedAIContext.ts`, `src/hooks/usePostCreationAI.ts`, archived dashboard brand-profile page | Live / legacy support |
| `ai_brand_context` | `src/pages/dashboard/_archive/BrandProfilePage.tsx`, type definitions, older schema inventory docs | Archive / legacy only - DROP |
| `ai_brand_context_generated_at` | `src/pages/dashboard/_archive/BrandProfilePage.tsx`, type definitions, older schema inventory docs | Archive / legacy only - DROP |

**CRITICAL NOTE**: The live `price_level` data is stored in `business_operations.price_level` (e.g., "moderate"). The `business_profile.price_level` column is EMPTY and should be dropped.

### `businesses`

| Field | Where it is used | Status |
|-------|------------------|--------|
| `postal_code` | Type definitions only; runtime reads from `business_locations.postal_code` instead | Schema-only / EMPTY - DROP |

**CRITICAL NOTE**: The live `postal_code` data is stored in **business_locations.postal_code**. The businesses.postal_code column is EMPTY and should be dropped.

### `city_context_cache`

| Field | Where itSchema field only; runtime uses `business_locations.postal_code` via joins | Schema-only / EMPTY - DROP |

**CRITICAL NOTE**: The live `postal_code` data comes from **business_locations.postal_code** via table joins. The city_context_cache.postal_code column is EMPTY and should be dropped.
|-------|------------------|--------|
| `postal_code` | `supabase/functions/_shared/brand-profile/city-context-ai.ts` via city inference fallback, plus cache schema / seeded city context flows | Live / supporting cache field |

### Short read
price_level` is the **PRIMARY SOURCE** for price data (e.g., "moderate"). Keep this field.
- `business_operations.typical_busy_periods`, `typical_slow_periods`, and `average_check_per_person` are effectively legacy or dropped. Safe to drop.
- `business_profile.price_level` is **EMPTY** (live data in business_operations.price_level). Safe to drop.
- `business_profile.target_audience` and `menu_structure` still support older prompt paths and compatibility layers. Keep these.
- `business_profile.ai_brand_context` and `ai_brand_context_generated_at` are archive-side fields, not current runtime inputs. Safe to drop.
- `businesses.postal_code` is **EMPTY** (live data in business_locations.postal_code). Safe to drop.
- `city_context_cache.postal_code` is **EMPTY** (uses business_locations via joins). Safe to drop.

**Total 8 empty fields identified for cleanup** across business_operations (3), business_profile (3), businesses (1), and city_context_cache (1)
- `business_profile.ai_brand_context` and `ai_brand_context_generated_at` are archive-side fields, not current runtime inputs.
- `businesses.postal_code` is a supporting location seed, while `city_context_cache.postal_code` is part of the live city inference fallback.
| `validateAgainstVoice()` | Checks the generated text against voice guardrails before return | Live |
| `applyTargetedVoiceFixes()` | Repairs common voice violations without full regeneration | Live |

### What the function is actually doing

`generate-text-from-idea` is the final caption-generation step. It does not invent the brand context itself; it resolves and normalizes context from three layers:

1. The transferred idea or weekly-plan suggestion payload
2. Live brand, operations, and menu data from Supabase tables
3. V5 brand profile fields and helper-derived prompt blocks

For weekly-plan transfers, the most important inputs are the suggestion fields (`guestMoment`, `timing`, `visualDirection`, `selectionRationale`, `captionFirstLine`) plus the V5 brand voice and guardrails. For AI-ideas transfers, the important inputs are the suggestion title, caption base, content type, occasion context, and the same brand/operations fetches.

The practical effect is that the dashboard overview matters here mostly through the brand profile, menu data, opening hours, and the weekly-plan suggestion payload. The function then turns those inputs into a single caption and platform-specific response.

---

## Last Updated
5. maj 2026 — Complete schema mapping verified against live database and component code.
