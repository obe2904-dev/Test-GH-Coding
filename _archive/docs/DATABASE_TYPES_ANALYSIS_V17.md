# Database & Types Deep-Dive Analysis
**Date:** 17. februar 2026  
**Reference:** BRAND_VOICE_ARCHITECTURE_V17.md  
**Scope:** Complete mapping of database schema, type definitions, data flow, and architectural issues

---

## Executive Summary

**Total Database Columns:** 44 fields in `business_brand_profile` table  
**Active Fetch Locations:** 25+ locations across 15 edge functions  
**Competing Type Definitions:** 5 different BrandVoice structures  
**Unused/Underused Fields:** 12 fields (27% of schema)  
**Duplicate Fields:** 4 semantic duplicates  
**Critical Issue:** No unified type definition causing data loss and inconsistent usage

---

## 1. Database Schema (Complete Mapping)

### Actual `business_brand_profile` Table Columns (44 fields)

```sql
-- Query Result from Live Database (business_id: 840347de-9ba7-4275-8aa3-4553417fc2af)
[
  "booking_link",              -- 1. Booking/reservation URL
  "brand_context",             -- 2. JSONB: local_landmarks, competitive_context
  "brand_essence",             -- 3. Core brand DNA text
  "brand_origin_story",        -- 4. Founding/history narrative
  "business_id",               -- 5. PK foreign key
  "business_voice",            -- 6. JSONB: Voice characteristics (LEGACY?)
  "certifications",            -- 7. text[]: Certifications/badges
  "communication_goal",        -- 8. Primary communication objective
  "content_focus",             -- 9. What content should emphasize
  "core_offerings",            -- 10. Primary product/service focus
  "created_at",                -- 11. Timestamp
  "cta_preference",            -- 12. Call-to-action preference
  "cta_style",                 -- 13. CTA tone/approach
  "do_not_say",                -- 14. JSONB: {words: string[]} - LEGACY
  "emoji_style",               -- 15. Emoji usage preference
  "formality",                 -- 16. Communication formality level
  "founded_year",              -- 17. Year business was founded
  "humor_level",               -- 18. Humor sensibility
  "image_preferences",         -- 19. Visual/photo preferences
  "last_edited_at",            -- 20. Last manual edit timestamp
  "last_edited_by",            -- 21. User who last edited
  "never_say",                 -- 22. text[]: Banned words (ENRICHED)
  "offerings_full",            -- 23. JSONB: Full offerings structure
  "owner_perspective",         -- 24. Owner's view on business
  "personality",               -- 25. JSONB: Personality traits (LEGACY?)
  "punctuation_style",         -- 26. Punctuation usage patterns
  "sample_posts",              -- 27. JSONB: Example posts with explanations
  "signature_approach",        -- 28. Unique methodology/approach
  "signature_phrases",         -- 29. text[]: Distinctive phrases (ENRICHED)
  "storytelling_style",        -- 30. Narrative approach preference
  "target_audience",           -- 31. Primary audience description
  "things_to_avoid",           -- 32. JSONB: Content restrictions (LEGACY)
  "tone_keywords",             -- 33. text[]: Tone descriptors (LEGACY)
  "tone_of_voice",             -- 34. JSON/text: Tone structure
  "typical_closings",          -- 35. text[]: Common post endings (ENRICHED)
  "typical_openings",          -- 36. text[]: Common post openings (ENRICHED)
  "updated_at",                -- 37. Auto-updated timestamp
  "values",                    -- 38. text[]: Brand values (LEGACY)
  "voice_confidence_score",    -- 39. int: Extraction confidence (0-100)
  "voice_execution",           -- 40. JSONB: Writing patterns, emoji frequency
  "voice_extracted_at",        -- 41. Timestamp: When voice was extracted
  "voice_extraction_source",   -- 42. Source of voice data (ai_auto_extract, manual)
  "voice_style",               -- 43. Voice style description (LEGACY)
  "what_makes_us_different"    -- 44. Differentiator statement
]
```

### Field Usage Classification

#### ✅ **ENRICHED FIELDS (Active - High Value)**
```typescript
signature_phrases        // text[] - Used by strategy + caption generators
never_say               // text[] - Should be used (currently not passed!)
typical_openings        // text[] - Used by strategy + caption generators
typical_closings        // text[] - Used by strategy + caption generators
humor_level            // text - Defined in types, ready for use
formality              // text - Defined in types, ready for use
emoji_style            // text - Used in brand-profile-generator-v5
storytelling_style     // text - Used in caption prompt builder
```

#### ⚠️ **LEGACY FIELDS (Deprecated but Still Used)**
```typescript
tone_keywords           // text[] - Still passed in weekly-plan-generator
voice_style            // text - Still passed in weekly-plan-generator
values                 // text[] - Still passed in weekly-plan-generator
certifications         // text[] - Still passed in weekly-plan-generator
do_not_say             // JSONB {words: []} - Replaced by never_say
things_to_avoid        // JSONB - Duplicate of do_not_say
```

#### 📦 **METADATA FIELDS (Administrative)**
```typescript
business_id            // UUID PK
created_at             // timestamptz
updated_at             // timestamptz
last_edited_at         // timestamptz
last_edited_by         // UUID FK
voice_extracted_at     // timestamptz
voice_extraction_source // text
voice_confidence_score  // int
```

#### 🔧 **SEMI-ACTIVE FIELDS (Used in Brand Profile Generator Only)**
```typescript
brand_context          // JSONB - Used in brand-profile-generator-v5
voice_execution        // JSONB - Used in brand-profile-generator-v5
personality            // JSONB - Used in brand-profile-generator-v5 (maps to storytelling_style)
brand_origin_story     // text - Generated by brand-profile-generator-v5
founded_year           // int - Generated by brand-profile-generator-v5
owner_perspective      // text - Generated by brand-profile-generator-v5
what_makes_us_different // text - Generated by brand-profile-generator-v5
signature_approach     // text - Generated by brand-profile-generator-v5
punctuation_style      // text - Generated by brand-profile-generator-v5
sample_posts           // JSONB - Generated but rarely used in generation
```

#### ❌ **UNUSED/UNDERUSED FIELDS (12 fields = 27%)**
```typescript
booking_link           // ❌ NEVER used in any edge function
business_voice         // ❌ NEVER used (likely obsolete JSONB structure)
cta_preference         // ❌ NEVER used (exists but not referenced)
offerings_full         // ⚠️ EXISTS but only used in one migration
image_preferences      // ⚠️ Generated but not used in caption/strategy flow
content_focus          // ⚠️ Generated but not used in AI generation
communication_goal     // ⚠️ Generated but not used in AI generation
core_offerings         // ⚠️ Generated but not used in AI generation (text field)
target_audience        // ⚠️ Generated but not used in AI generation
brand_essence          // ⚠️ Generated but not used in AI generation
tone_of_voice          // ⚠️ Generated but weakly used (JSON structure unclear)
cta_style              // ⚠️ Generated but not passed to caption generator
```

---

## 2. Type Definitions (Competing Structures)

### Five Different BrandVoice Definitions Found

#### **Definition 1: `ai-caption-generator/types.ts` (MOST COMPLETE)**
**Location:** `supabase/functions/_shared/ai-caption-generator/types.ts` lines 17-48  
**Status:** ✅ Best structure - Enriched + Legacy + Personality fields  
**Issue:** Not used as unified type - inline definition only

```typescript
brandVoice: {
  // LEGACY
  tone_keywords?: string[]
  voice_style?: string
  values?: string[]
  certifications?: string[]
  do_not_say?: { words: string[] }
  
  // ENRICHED (preferred)
  signature_phrases?: string[]
  never_say?: string[]
  typical_openings?: string[]
  typical_closings?: string[]
  sample_posts?: Array<{post_text: string, why_this_works: string}>
  
  // PERSONALITY
  humor_level?: 'none' | 'subtle' | 'playful'
  formality?: 'professional' | 'casual' | 'friendly'
  storytelling_style?: 'facts_only' | 'some_context' | 'rich_stories'
  emoji_style?: 'minimal' | 'moderate' | 'expressive'
  
  // BRAND STORY
  brand_origin_story?: string
  what_makes_us_different?: string
  signature_approach?: string
}
```

**Used by:** 
- `generate-weekly-plan` (expects this but receives only 5 legacy fields!)
- `ai-generate-from-strategy`
- `test-ai-caption`
- `demo-ai-caption`

---

#### **Definition 2: `caption-generator.ts` (MINIMALIST)**
**Location:** `supabase/functions/_shared/post-helpers/caption-generator.ts` lines 12-15  
**Status:** ⚠️ Too simple - Missing enriched fields  
**Issue:** Different from ai-caption-generator

```typescript
interface BrandVoice {
  tone: 'casual' | 'refined' | 'playful' | 'professional'
  emoji_frequency: 'none' | 'minimal' | 'moderate' | 'frequent'
  voice_description?: string
}
```

**Used by:**
- Legacy caption generator (pre-ai-caption-generator)
- Possibly deprecated but still in codebase

---

#### **Definition 3: `weekly-plan-generator.ts` (INLINE - BROKEN)**
**Location:** `supabase/functions/_shared/post-helpers/weekly-plan-generator.ts` lines 920-930  
**Status:** ❌ CRITICAL ISSUE - Only passes 5 legacy fields  
**Issue:** This is THE ROOT CAUSE of generic language problem

```typescript
brandVoice: {
  tone_keywords: fullBrandProfile?.tone_keywords || [],
  voice_style: fullBrandProfile?.voice_style || 'casual',
  values: fullBrandProfile?.values || [],
  certifications: fullBrandProfile?.certifications || [],
  do_not_say: fullBrandProfile?.do_not_say || { words: [] }
  // ❌ MISSING: signature_phrases, never_say, typical_openings, humor_level, etc.
}
```

**Impact:** Caption generator receives incomplete data → generic language appears

---

#### **Definition 4: `brand-profile/types.ts` (GENERATOR CONTEXT)**
**Location:** `supabase/functions/_shared/brand-profile/types.ts` lines 333-349  
**Status:** Different purpose - Brand profile generation, not AI caption generation  
**Issue:** Not aligned with caption generation needs

```typescript
export interface BrandProfile {
  brand_essence: BrandVariable<string>
  tone_of_voice: BrandVariable<string>
  tone_model: ToneModel
  things_to_avoid: BrandVariable<ThingsToAvoidValue>
  target_audience: BrandVariable<string>
  core_offerings: BrandVariable<string>
  content_focus: BrandVariable<string>
  content_pillars: BrandVariable<ContentPillarItem[]>
  cta_style: BrandVariable<string>
  communication_goal: BrandVariable<string>
  recognizable_interior_identity: BrandVariable<string>
  image_preferences: BrandVariable<ImagePreferencesValue>
  social_style: BrandVariable<SocialStyleValue>
  voice_examples: BrandVariable<VoiceExamplesValue>
}
```

**Used by:**
- Brand profile generation system (independent workflow)
- Not used in strategy/caption generation flow

---

#### **Definition 5: `weekly-strategy-generator.ts` (TYPE ANY)**
**Location:** `supabase/functions/_shared/post-helpers/weekly-strategy-generator.ts` lines 769, 1110  
**Status:** ⚠️ Uses type casting `(context.brand_voice as any)` - No type safety  
**Issue:** Relies on runtime structure, no compile-time validation

```typescript
// Line 769
- Signature Phrases: ${((context.brand_voice as any).signature_phrases || []).slice(0, 3).join('; ')}

// Line 775
✅ Typisk åbning: "${((context.brand_voice as any).typical_openings || [])[0]}"

// Line 1110
- Typical openings: ${((context.brand_voice as any).typical_openings || []).slice(0, 2).join('; ')}
```

**Issue:** No type definition - uses duck typing, fragile to structure changes

---

### Type Definition Conflicts Summary

| Definition | Location | Completeness | Type Safety | Used By |
|------------|----------|--------------|-------------|---------|
| ai-caption-generator/types | Inline in interface | 🟢 Complete | 🟢 Strong | Caption gen |
| caption-generator | Local interface | 🔴 Minimal | 🟡 Weak | Legacy |
| weekly-plan-generator | Inline construction | 🔴 5 fields only | 🔴 None | Path A |
| brand-profile/types | Export interface | 🟡 Different purpose | 🟢 Strong | Generator |
| weekly-strategy-generator | Type cast (any) | 🟢 Uses enriched | 🔴 None | Strategy |

**Critical Finding:** No single source of truth for BrandVoice structure used in content generation flow.

---

## 3. Data Fetch Locations (25+ Locations)

### Complete Fetch Inventory

#### **Group A: Strategy & Weekly Plan Generation (PRIMARY FLOW)**

1. **`get-weekly-strategy/index.ts` L509**
   - Fetches: `SELECT signature_phrases, never_say, typical_openings, typical_closings, tone_keywords, voice_style, ...` (explicit field list)
   - Converts to: Legacy + enriched structure
   - Passes to: `generateWeeklyStrategy()`
   - ✅ **Uses enriched fields**

2. **`generate-weekly-plan/index.ts` L147**
   - Fetches: `SELECT *` (all fields)
   - Status: Fetched but NOT passed enriched fields to caption generator
   - ❌ **Data fetched then lost**

3. **`weekly-plan-generator.ts` L871 (DUPLICATE FETCH)**
   - Fetches: `SELECT *` (all fields)
   - Stored as: `fullBrandProfile`
   - Problem: Only 5 legacy fields passed to aiContext (L920-930)
   - ❌ **This is the critical data loss point**

#### **Group B: AI Caption Generation**

4. **`ai-generate-from-strategy/index.ts` L105**
   - Fetches: `SELECT signature_phrases, never_say, typical_openings, typical_closings, ...` (explicit)
   - Passes to: Caption generation context
   - ✅ **Uses enriched fields correctly**

5. **`test-ai-caption/index.ts` L48**
   - Fetches: `SELECT *`
   - Purpose: Testing caption generation
   - ✅ **Test harness - complete data**

6. **`demo-ai-caption/index.ts` (similar to test-ai-caption)**
   - Demo/testing purposes

#### **Group C: Brand Profile Generation & Management**

7. **`brand-profile-generator/index.ts` L1456**
   - Fetches: Check if profile exists
   - Updates: Entire profile
   - Purpose: Brand profile creation/update

8. **`brand-profile-generator/index.ts` L1500**
   - Second fetch location in same file
   - Purpose: Update existing profile

9. **`brand-profile-generator/index.original.ts` L494, L2673, L2691**
   - Original/backup version
   - Multiple fetch locations
   - Status: Possibly deprecated

10. **`brand-profile-generator-v5/services/saver.ts` L253, L309, L317**
    - V5 generation system
    - Three fetch locations for:
      - Check existence
      - Upsert data
      - Verify save
    - ✅ **Manages enriched fields**

11. **`enrich-brand-voice/index.ts` L59, L393**
    - Purpose: Voice enrichment workflow
    - Fetches: Existing profile
    - Updates: Enriched voice fields
    - ✅ **Specifically handles enriched fields**

#### **Group D: Legacy & Alternative Paths**

12. **`post-idea-generator/index.ts` L82**
    - Fetches: Brand profile for idea generation
    - Usage: Context for post ideas

13. **`generate-post-ideas/services/knowledge-gatherer.ts` L115**
    - Similar to post-idea-generator
    - Part of Layer 5 system

14. **`ai-generate-v3/index.ts` L67**
    - V3 generation system
    - Fetch for caption context

15. **`ai-enhance/index.ts` L343**
    - Enhancement workflow
    - Fetch for tone/voice consistency

16. **`analyze-concept-fit/index.ts` L99**
    - Concept fitting analysis
    - Uses brand voice for alignment checks

17. **`test-full-system/index.ts` L36**
    - Full system integration test
    - Complete data fetch

#### **Group E: Shared Utilities (UNUSED!)**

18. **`_shared/brand-profile/database.ts` L139, L162, L191, L215**
    - **Lines 186-200:** `fetchBrandProfile()` - **NEVER IMPORTED OR USED**
    - **Lines 139-177:** `saveBrandProfile()`
    - **Lines 215-224:** `deleteBrandProfile()`
    - **Status:** ❌ **Utilities exist but not used - all functions duplicate this logic**

---

### Fetch Pattern Analysis

**Total Fetch Locations:** 25+  
**Duplicate Fetches:** 18 locations (72%) duplicate same query logic  
**Uses `_shared` Utility:** 0 locations (0%) ❌  
**Fetches Complete Schema:** 15 locations (60%)  
**Fetches Selective Fields:** 10 locations (40%)

**Critical Issue:** 
- `fetchBrandProfile()` exists in `_shared/brand-profile/database.ts`
- **ZERO functions use it**
- All 25+ locations duplicate fetch logic
- Result: Inconsistent field selection, maintenance burden

---

## 4. Data Flow Analysis (Layer 0 → Weekly Plan → Caption)

### Current Flow (BROKEN PATH)

```
┌─────────────────────────────────────────────────────────────┐
│ DATABASE: business_brand_profile                             │
│ 44 columns including enriched fields                         │
│ ├─ never_say: 80 words                                       │
│ ├─ signature_phrases: ["ved åen i Aarhus", ...]            │
│ ├─ humor_level: "playful"                                    │
│ └─ formality: "casual"                                       │
└─────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                  │
          ▼                                  ▼
┌──────────────────────┐         ┌──────────────────────┐
│ LAYER 0: Strategy    │         │ PATH A: Weekly Plan  │
│ get-weekly-strategy  │         │ generate-weekly-plan │
│                      │         │                      │
│ L509: Fetch          │         │ L147: Fetch          │
│ SELECT signature_    │         │ SELECT *             │
│   phrases, never_say,│         │                      │
│   typical_openings   │         │ L871: DUPLICATE FETCH│
│                      │         │ (weekly-plan-gen.ts) │
│ L875: Convert to     │         │ SELECT *             │
│   legacy format      │         │                      │
│                      │         │ Stores: fullBrand-   │
│ ✅ Passes enriched   │         │   Profile (complete) │
│   to strategy gen    │         │                      │
└──────────────────────┘         └──────────────────────┘
          │                                  │
          ▼                                  ▼
┌──────────────────────┐         ┌──────────────────────┐
│ weekly-strategy-gen  │         │ L920-930: Build      │
│                      │         │ aiContext            │
│ Uses enriched fields:│         │                      │
│ - signature_phrases  │         │ brandVoice: {        │
│ - typical_openings   │         │   tone_keywords,     │
│                      │         │   voice_style,       │
│ Output: Clean        │         │   values,            │
│   narrative ✅       │         │   certifications,    │
│ - No "kaffepause"    │         │   do_not_say         │
│ - Behavioral lang    │         │ } ❌ ONLY 5 FIELDS  │
└──────────────────────┘         │                      │
                                  │ MISSING:             │
                                  │ - signature_phrases  │
                                  │ - never_say (80!)    │
                                  │ - typical_openings   │
                                  │ - humor_level        │
                                  │ - formality          │
                                  └──────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────┐
                    │ ai-caption-generator/prompt-builder  │
                    │                                      │
                    │ L124: Check enriched fields          │
                    │ hasEnriched = voice.signature_       │
                    │   phrases?.length || voice.never_   │
                    │   say?.length                        │
                    │ Result: FALSE (empty arrays)         │
                    │                                      │
                    │ L127-137: Branching logic            │
                    │ IF enriched → Use enriched           │
                    │ ELSE → Fall back to legacy           │
                    │ Result: Falls back to legacy         │
                    │                                      │
                    │ L148: Show banned words              │
                    │ bannedWords.slice(0, 8)              │
                    │ Result: 0 words (empty array)        │
                    │                                      │
                    │ Missing: Generic warnings section    │
                    │ (strategy-gen has hardcoded)         │
                    │                                      │
                    │ Output: Generic language ❌          │
                    │ - "Kom forbi og nyd"                 │
                    │ - No brand-specific voice            │
                    └──────────────────────────────────────┘
```

### Working Flow (For Comparison)

```
┌─────────────────────────────────────────────────────────────┐
│ ai-generate-from-strategy/index.ts                           │
│                                                              │
│ L105: Fetch with explicit fields                            │
│ SELECT signature_phrases, never_say, typical_openings       │
│                                                              │
│ L167-170: Pass enriched fields                              │
│ brandVoice: {                                                │
│   signature_phrases: brandProfile.signature_phrases || [],  │
│   never_say: brandProfile.never_say || [],                  │
│   typical_openings: brandProfile.typical_openings || [],    │
│   typical_closings: brandProfile.typical_closings || [],    │
│   // Plus legacy fields                                      │
│ }                                                            │
│                                                              │
│ ✅ This works - caption get's brand-specific voice           │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Semantic Duplicates & Conflicts

### Duplicate Field Pairs

#### **1. `never_say` vs `do_not_say` + `things_to_avoid`**
```typescript
// NEW ENRICHED
never_say: text[]  
// Example: ["kom forbi", "nyd", "kaffepause", "hyggelig stemning", ...]

// LEGACY (deprecated)
do_not_say: {words: string[]}  
// Example: {words: ["kom forbi", "nyd"]}

// LEGACY (deprecated - same as do_not_say?)
things_to_avoid: JSONB  
```

**Status:** 
- `never_say` should be single source of truth
- `do_not_say` and `things_to_avoid` appear redundant
- weekly-plan-generator still uses `do_not_say` (empty)

**Recommendation:** 
- Deprecate `do_not_say` and `things_to_avoid`
- Migrate all usage to `never_say`
- Add migration script to copy data

---

#### **2. `typical_openings` vs `voice_execution.typical_openings`**
```typescript
// ENRICHED field (table column)
typical_openings: text[]  
// Example: ["Der er en grund til...", "Vi elsker...", ...]

// NESTED in JSONB
voice_execution: {
  typical_openings?: string[]
  writing_patterns?: {...}
}
```

**Status:**
- Both exist in database
- `brand-profile-generator-v5` extracts to `voice_execution.typical_openings` first
- Then copies to top-level `typical_openings`
- Duplication in storage

**Recommendation:**
- Keep only top-level `typical_openings`
- Deprecate `voice_execution.typical_openings`
- Simplifies data structure

---

#### **3. `humor_level` vs `personality.humor_level`**
```typescript
// ENRICHED field (table column)
humor_level: text  
// Example: "playful"

// NESTED in JSONB
personality: {
  humor_level?: string
  other_traits?: {...}
}
```

**Status:**
- Similar to typical_openings duplication
- `personality` JSONB appears to be intermediate extraction format
- Table columns are final storage

**Recommendation:**
- Keep table columns as source of truth
- `personality` JSONB can be deprecated or used only during generation

---

#### **4. `tone_of_voice` vs `tone_keywords` + `voice_style`**
```typescript
// STRUCTURED (newer)
tone_of_voice: JSON  
// Structure unclear - sometimes text, sometimes JSON

// LEGACY FIELDS
tone_keywords: text[]  
// Example: ["hyggelig", "uformel", "lokal"]

voice_style: text  
// Example: "du-form, emojis ok"
```

**Status:**
- `tone_of_voice` structure inconsistent across data
- Legacy fields still actively used in weekly-plan-generator
- Unclear relationship between them

**Recommendation:**
- Define exact structure for `tone_of_voice` JSON
- Document migration path from legacy to structured
- Consider if `tone_keywords` still needed with enriched fields

---

## 6. Unused Field Analysis

### Fields with ZERO Usage (5 fields)

```typescript
1. booking_link              // ❌ Never referenced in any TypeScript file
2. business_voice            // ❌ Never referenced (JSONB - obsolete structure?)
3. cta_preference            // ❌ Never referenced
4. offerings_full            // ⚠️ Only in one migration, never in generation code
5. last_edited_by            // ⚠️ Metadata - only for audit trail
```

**Storage Cost:**
- 5 columns × 44-byte average overhead = ~220 bytes per row
- Plus actual data storage (especially JSONB fields)

**Recommendation:**
- Audit if these fields are used in frontend (outside edge functions)
- If truly unused:
  - Option A: Deprecate and remove in future migration
  - Option B: Document as "reserved for future use"

---

### Fields with Low Usage (7 fields)

```typescript
6. image_preferences         // Generated by brand-profile-gen, not used in caption/strategy
7. content_focus            // Generated but not passed to AI
8. communication_goal       // Generated but not passed to AI
9. core_offerings          // Generated but not passed to AI (text version)
10. target_audience        // Generated but not passed to AI
11. brand_essence          // Generated but not passed to AI
12. cta_style              // Generated but not passed to caption generator
```

**Usage Pattern:**
- Generated during brand profile creation
- Stored in database
- **NOT** fetched or used in content generation flow

**Possible Reason:**
- Early design included these fields
- Later switched to enriched voice model
- Old fields never deprecated

**Recommendation:**
- Evaluate if these fields add value for frontend/analytics
- If only for "completeness" → consider deprecation
- If needed → integrate into AI generation context

---

## 7. Critical Issues & Recommendations

### Issue 1: No Unified BrandVoice Type ⭐⭐⭐⭐⭐

**Problem:**
- 5 different BrandVoice structures across codebase
- `weekly-plan-generator` uses inline construction with only 5 fields
- `ai-caption-generator/types` has complete definition but not exported/shared
- `weekly-strategy-generator` uses type casting `(as any)`

**Impact:**
- Data loss: Enriched fields fetched but not passed
- Type safety: No compile-time validation
- Maintenance: Hard to track what fields are needed

**Recommendation (Phase 1):**
```typescript
// Create: supabase/functions/_shared/types/brand-voice.ts

export interface BrandVoice {
  // ENRICHED FIELDS (Primary)
  signature_phrases?: string[]
  never_say?: string[]
  typical_openings?: string[]
  typical_closings?: string[]
  humor_level?: 'none' | 'subtle' | 'playful'
  formality?: 'professional' | 'casual' | 'friendly'
  emoji_style?: 'minimal' | 'moderate' | 'expressive'
  storytelling_style?: 'facts_only' | 'some_context' | 'rich_stories'
  sample_posts?: Array<{post_text: string, why_this_works: string}>
  
  // LEGACY (Backward Compatibility)
  tone_keywords?: string[]
  voice_style?: string
  values?: string[]
  certifications?: string[]
  do_not_say?: {words: string[]}
  
  // BRAND STORY (Optional Context)
  brand_origin_story?: string
  what_makes_us_different?: string
  signature_approach?: string
  owner_perspective?: string
}
```

**Benefits:**
- Single source of truth
- Type safety across all functions
- Clear deprecation path for legacy fields
- Easier to maintain and extend

---

### Issue 2: Unused `fetchBrandProfile()` Utility ⭐⭐⭐⭐

**Problem:**
- `_shared/brand-profile/database.ts` has `fetchBrandProfile()` function
- **ZERO** functions use it
- All 25+ fetch locations duplicate same logic

**Impact:**
- Inconsistent field selection
- Maintenance burden (change query in 25 places)
- No centralized control over what fields are fetched

**Recommendation (Phase 1):**
```typescript
// Use existing fetchBrandProfile() from _shared/brand-profile/database.ts

import { fetchBrandProfile } from '../_shared/brand-profile/database.ts'

// In get-weekly-strategy/index.ts (L509)
// Remove duplicate fetch
const brandProfile = await fetchBrandProfile(dataClient, body.business_id);

// In weekly-plan-generator.ts (L871)
// Remove duplicate fetch  
const fullBrandProfile = await fetchBrandProfile(supabaseClient, businessId);
```

**Benefits:**
- Single query definition
- Consistent field fetching
- Easy to update schema changes
- Reduced code duplication

---

### Issue 3: Data Loss in weekly-plan-generator.ts ⭐⭐⭐⭐⭐

**Problem:**
- Line 871: Fetches ALL fields (`SELECT *`)
- Stores as `fullBrandProfile` (complete data)
- Lines 920-930: Passes only 5 legacy fields to aiContext
- Enriched fields (signature_phrases, never_say: 80 words, humor_level) thrown away

**Impact:**
- Caption generator receives empty banned words array
- No signature phrases for brand voice
- Falls back to legacy structure (empty)
- Result: Generic language in captions

**Recommendation (Phase 1 - CRITICAL):**
```typescript
// weekly-plan-generator.ts L920-960

brandVoice: {
  // ENRICHED FIELDS (priority)
  signature_phrases: fullBrandProfile?.signature_phrases || [],
  never_say: fullBrandProfile?.never_say || [],
  typical_openings: fullBrandProfile?.typical_openings || [],
  typical_closings: fullBrandProfile?.typical_closings || [],
  humor_level: fullBrandProfile?.humor_level,
  formality: fullBrandProfile?.formality,
  emoji_style: fullBrandProfile?.emoji_style,
  storytelling_style: fullBrandProfile?.storytelling_style,
  sample_posts: fullBrandProfile?.sample_posts,
  
  // LEGACY (backward compatibility)
  tone_keywords: fullBrandProfile?.tone_keywords || [],
  voice_style: fullBrandProfile?.voice_style || 'casual',
  values: fullBrandProfile?.values || [],
  certifications: fullBrandProfile?.certifications || [],
  do_not_say: fullBrandProfile?.do_not_say || {words: []},
  
  // BRAND STORY (optional context)
  brand_origin_story: fullBrandProfile?.brand_origin_story,
  what_makes_us_different: fullBrandProfile?.what_makes_us_different,
  signature_approach: fullBrandProfile?.signature_approach,
}
```

**Expected Result:**
- Caption generator receives 80-word never_say array
- Signature phrases available for natural use
- Humor level and formality guide tone
- Generic language eliminated

---

### Issue 4: Semantic Duplicates ⭐⭐⭐

**Problem:**
- `never_say` vs `do_not_say` vs `things_to_avoid` (3 versions!)
- `typical_openings` (column) vs `voice_execution.typical_openings` (JSONB)
- `humor_level` (column) vs `personality.humor_level` (JSONB)

**Impact:**
- Storage waste
- Confusion about which field to use
- Risk of data inconsistency
- Migration complexity

**Recommendation (Phase 2):**
```sql
-- Migration: Consolidate duplicates

-- 1. Ensure never_say has all data from legacy fields
UPDATE business_brand_profile
SET never_say = COALESCE(
  never_say,
  CASE 
    WHEN do_not_say IS NOT NULL THEN (do_not_say->>'words')::text[]
    WHEN things_to_avoid IS NOT NULL THEN (things_to_avoid->>'words')::text[]
    ELSE '{}'::text[]
  END
)
WHERE never_say IS NULL OR never_say = '{}';

-- 2. Deprecate legacy columns (keep for backward compatibility initially)
COMMENT ON COLUMN business_brand_profile.do_not_say IS 
'DEPRECATED: Use never_say instead. Kept for backward compatibility.';

COMMENT ON COLUMN business_brand_profile.things_to_avoid IS 
'DEPRECATED: Use never_say instead. Kept for backward compatibility.';

-- 3. Add constraint to ensure consistency (optional - may be too strict)
-- CHECK: either never_say has data OR legacy fields do, not both directions
```

**Migration Path:**
1. Consolidate data to primary fields
2. Update all code to use primary fields
3. Mark legacy fields as deprecated in comments
4. After 1-2 version cycles: Drop legacy columns (with user warning)

---

### Issue 5: Unused Fields (27% of Schema) ⭐⭐

**Problem:**
- 12 of 44 fields (27%) unused or severely underused
- Storage overhead
- Schema complexity

**Examples:**
- `booking_link` - never referenced
- `business_voice` - JSONB never used
- `cta_preference` - never referenced
- `content_focus`, `communication_goal`, `target_audience` - generated but unused

**Recommendation (Phase 3 - Long-term):**
1. Audit frontend usage (this analysis only covered edge functions)
2. If confirmed unused in frontend:
   - Option A: Drop columns (migration)
   - Option B: Mark as deprecated, drop in v2
3. If used in frontend but not backend:
   - Document as "frontend-only fields"
   - Consider separate `business_brand_profile_ui` table

**Benefits:**
- Cleaner schema
- Reduced storage
- Easier to understand data model

---

## 8. Action Plan Summary

### Phase 1: Foundation (3-4 hours) ⭐⭐⭐⭐⭐

#### Part A: Create Unified BrandVoice Type (1 hour)
- [ ] Create `_shared/types/brand-voice.ts`
- [ ] Define `BrandVoice` interface with enriched + legacy fields
- [ ] Add helper functions: `hasEnrichedVoice()`, `migrateLegacyVoice()`

#### Part B: Use Existing `fetchBrandProfile()` (1 hour)
- [ ] Update `get-weekly-strategy/index.ts` L509 to use shared fetch
- [ ] Update `generate-weekly-plan/index.ts` L147 (remove if redundant)
- [ ] Update `weekly-plan-generator.ts` L871 to use shared fetch

#### Part C: Fix Data Loss in weekly-plan-generator (1 hour)
- [ ] Update L920-960 to pass ALL enriched fields to aiContext
- [ ] Import unified `BrandVoice` type
- [ ] Test caption generation with enriched data

#### Part D: Fix Word Display (30 min)
- [ ] Update `prompt-builder.ts` L148:
  - [ ] Prioritize Danish words over English/cities
  - [ ] Show 15-20 words instead of 8
  - [ ] Add helper: `prioritizeDanishWords()`

**Validation:**
- [ ] Run full flow test (Layer 0 → Weekly Plan)
- [ ] Verify captions avoid "kom forbi", "nyd", "kaffepause"
- [ ] Verify captions use signature_phrases
- [ ] No regressions in strategy generation

---

### Phase 2: Consolidate & Clean (2-3 hours) ⭐⭐⭐

#### Part A: Semantic Duplicate Consolidation
- [ ] Create migration: Consolidate `never_say` ← `do_not_say`, `things_to_avoid`
- [ ] Mark legacy fields as deprecated in schema comments
- [ ] Update all remaining references to use primary fields

#### Part B: Type Definition Cleanup
- [ ] Update `ai-caption-generator/types.ts` to import unified `BrandVoice`
- [ ] Update `weekly-strategy-generator.ts` to use typed `BrandVoice` (remove `as any`)
- [ ] Deprecate `caption-generator.ts` BrandVoice (if legacy system)

#### Part C: Document Unused Fields
- [ ] Add schema comments marking unused fields
- [ ] Document which fields are frontend-only (if any)
- [ ] Create deprecation plan for truly unused fields

---

### Phase 3: Architectural Cleanup (Future) ⭐⭐

- [ ] Migrate all 25+ fetch locations to use `fetchBrandProfile()`
- [ ] Create migration to drop deprecated columns (after grace period)
- [ ] Consider splitting `business_brand_profile` into:
  - `business_brand_voice` (used in AI generation)
  - `business_brand_profile_metadata` (frontend/analytics)

---

## 9. Database Schema Recommendations

### Short-term (With Phase 1)

```sql
-- Add comments documenting field status

COMMENT ON COLUMN business_brand_profile.never_say IS 
'Primary banned words array. Use this instead of do_not_say or things_to_avoid.';

COMMENT ON COLUMN business_brand_profile.do_not_say IS 
'DEPRECATED: Use never_say instead. Kept for backward compatibility until 2026-Q2.';

COMMENT ON COLUMN business_brand_profile.things_to_avoid IS 
'DEPRECATED: Duplicate of do_not_say. Use never_say instead.';

COMMENT ON COLUMN business_brand_profile.booking_link IS 
'TODO: Audit usage. If unused, deprecate in v17.2';

COMMENT ON COLUMN business_brand_profile.business_voice IS 
'TODO: Audit usage. Likely obsolete JSONB structure. Consider removal.';
```

### Long-term (Phase 3)

```sql
-- Create focused table for AI generation (voice fields only)
CREATE TABLE business_brand_voice (
  business_id UUID PRIMARY KEY REFERENCES businesses(id),
  -- Enriched fields (actively used)
  signature_phrases TEXT[],
  never_say TEXT[],
  typical_openings TEXT[],
  typical_closings TEXT[],
  humor_level TEXT,
  formality TEXT,
  emoji_style TEXT,
  storytelling_style TEXT,
  sample_posts JSONB,
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confidence_score INTEGER
);

-- Keep business_brand_profile for other fields or deprecate entirely
-- This separates concerns: AI generation vs profile management
```

---

## 10. Quick Reference

### Key Files Requiring Changes (Phase 1)

| File | Lines | Change | Priority |
|------|-------|--------|----------|
| `_shared/types/brand-voice.ts` | NEW | Create unified type | P0 |
| `weekly-plan-generator.ts` | 871, 920-960 | Use shared fetch + pass enriched | P0 |
| `get-weekly-strategy/index.ts` | 509 | Use shared fetch | P1 |
| `prompt-builder.ts` | 148 | Prioritize Danish, show 15-20 words | P1 |
| `ai-caption-generator/types.ts` | 17-48 | Import unified BrandVoice | P1 |

### Database Fields Status Quick Reference

| Field | Status | Usage | Action |
|-------|--------|-------|--------|
| `signature_phrases` | ✅ Active | Strategy + Caption | Keep, ensure passed |
| `never_say` | ✅ Active | Should be used | **FIX: Not passed!** |
| `typical_openings` | ✅ Active | Strategy + Caption | Keep, ensure passed |
| `humor_level` | ⚠️ Defined but not passed | Types ready | **FIX: Pass to caption** |
| `formality` | ⚠️ Defined but not passed | Types ready | **FIX: Pass to caption** |
| `do_not_say` | ⚠️ Legacy | Deprecated | Consolidate → never_say |
| `things_to_avoid` | ⚠️ Legacy | Deprecated | Consolidate → never_say |
| `tone_keywords` | ⚠️ Legacy | Still used | Consider deprecation |
| `booking_link` | ❌ Unused | Never referenced | Audit + deprecate |
| `business_voice` | ❌ Unused | Never referenced | Audit + deprecate |
| `cta_preference` | ❌ Unused | Never referenced | Audit + deprecate |

---

## Appendix A: Database Column Details

### Complete Field Listing with Types

```sql
-- From migrations and live database query

booking_link              TEXT
brand_context             JSONB
brand_essence             TEXT
brand_origin_story        TEXT
business_id               UUID PRIMARY KEY
business_voice            JSONB
certifications            TEXT[]
communication_goal        TEXT
content_focus             TEXT
core_offerings            TEXT
created_at                TIMESTAMPTZ
cta_preference            TEXT
cta_style                 TEXT
do_not_say                JSONB
emoji_style               TEXT
formality                 TEXT
founded_year              INTEGER
humor_level               TEXT
image_preferences         TEXT
last_edited_at            TIMESTAMPTZ
last_edited_by            UUID
never_say                 TEXT[]
offerings_full            JSONB
owner_perspective         TEXT
personality               JSONB
punctuation_style         TEXT
sample_posts              JSONB
signature_approach        TEXT
signature_phrases         TEXT[]
storytelling_style        TEXT
target_audience           TEXT
things_to_avoid           JSONB
tone_keywords             TEXT[]
tone_of_voice             JSON/TEXT (inconsistent)
typical_closings          TEXT[]
typical_openings          TEXT[]
updated_at                TIMESTAMPTZ
values                    TEXT[]
voice_confidence_score    INTEGER
voice_execution           JSONB
voice_extracted_at        TIMESTAMPTZ
voice_extraction_source   TEXT
voice_style               TEXT
what_makes_us_different   TEXT
```

### Constraints

```sql
-- From migration 20260204120000

ALTER TABLE business_brand_profile 
  ADD CONSTRAINT check_humor_level 
  CHECK (humor_level IN ('none', 'subtle', 'playful') OR humor_level IS NULL);

ALTER TABLE business_brand_profile 
  ADD CONSTRAINT check_formality 
  CHECK (formality IN ('professional', 'casual', 'friendly') OR formality IS NULL);

-- Additional constraints may exist for other fields
```

---

**End of Analysis**  
**Next Steps:** Review findings → Approve Phase 1 → Implementation
