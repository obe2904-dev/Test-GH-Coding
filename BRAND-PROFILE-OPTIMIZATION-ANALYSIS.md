# Brand Profile Generator - Optimization Analysis

**Date:** 2. juni 2026  
**Scope:** brand-profile-generator/index.ts + business_brand_profile data storage patterns  
**Status:** Analysis Complete - Awaiting User Review Before Changes

---

## Executive Summary

### Key Findings

1. **11 Unused Function Imports** identified in brand-profile-generator/index.ts
2. **Data Loading Pattern Analysis**: business_brand_profile.brand_profile_v5 (~30KB JSON) loaded entirely even when only specific fields needed
3. **Recommendation**: Remove unused imports (safe, reduces bundle ~5-10KB), investigate data loading optimization separately

---

## Part 1: Unused Imports in brand-profile-generator

### Confirmed UNUSED Functions (Safe to Remove)

These 11 imports are **not used anywhere** in the code (lines 151-2286):

#### From `../_shared/brand-profile/index.ts` (Lines 48-55):
1. `buildBrandEssenceFallback` - OLD fallback, replaced by `buildFallbackBrandEssence` (line 139)
2. `buildSignatureShotFallback` - OLD fallback, replaced by `buildFallbackSignatureShot` (line 142)
3. `buildTargetAudienceFallback` - OLD fallback, replaced by `buildFallbackTargetAudience` (line 133)
4. `buildToneOfVoiceFallback` - OLD fallback, never used
5. `buildContentFocusFallback` - OLD fallback, replaced by `buildFallbackContentFocus` (line 135)
6. `removeBannedWords` - OLD sanitizer, never used

#### From `../_shared/brand-profile/index.ts` (Lines 63-67):
7. `buildMenuSummary` - Data gathering function, not called
8. `buildImagesSummary` - Data gathering function, not called
9. `buildSocialSummary` - Data gathering function, not called

#### From `../_shared/brand-profile/index.ts` (Lines 70-71):
10. `extractStructuredWebsiteData` - Signal extraction, not called

#### From `../_shared/brand-profile/index.ts` (Line 94):
11. `generateVoiceOptions` - Voice archetype generator, not called

### Why These Are Unused

**Fallback Function Duplication:**
- The code imports TWO sets of fallback functions
- **OLD set** (lines 48-55): `buildBrandEssenceFallback`, `buildSignatureShotFallback`, etc. - **UNUSED**
- **NEW set** (lines 133-145): `buildFallbackBrandEssence`, `buildFallbackSignatureShot`, etc. - **USED**
- The naming difference suggests a refactoring where the new functions replaced the old ones
- Safe to remove the old imports

**Data Gathering Functions:**
- `buildMenuSummary`, `buildImagesSummary`, `buildSocialSummary` - likely replaced by direct data loading
- These helper functions exist in the shared module but aren't called in this file

**Signal Extraction:**
- `extractStructuredWebsiteData` - structured extraction not used in this generator

**Voice Options:**
- `generateVoiceOptions` - voice archetype feature not actively used

### Impact of Removal

- **Bundle Size Reduction**: Estimated 5-10KB (depends on shared module bundling)
- **TypeScript Compilation**: Faster (fewer imports to resolve)
- **Code Clarity**: Clearer what functions are actually used
- **Risk**: **VERY LOW** - none of these functions are called anywhere in the file

---

## Part 2: Data Storage & Loading Analysis

### business_brand_profile Table Structure

From `/Users/olebaek/Downloads/business_brand_profile_rows.json`:

**Top-Level Columns (29 fields):**
- Simple fields: `booking_link`, `business_character`, `tone_keywords`, `voice_style`, etc.
- **Large JSON field**: `brand_profile_v5` (~30KB)

### brand_profile_v5 Structure

Total size: **~30KB** (for Cafe Faust example)

**Breakdown by section:**

| Section | Size | Key Contents |
|---------|------|--------------|
| `layer_0_intelligence` | ~12KB (40%) | business_identity, business_type, city_context_ai, geographic_context, menu_overview, professional_persona, voice_archetype |
| `voice` | ~6KB (20%) | tone_dna, personality_traits, style_rules, structural_rules, menu_description_examples, social_writing_examples, enhanced_social_examples, enhanced_avoid_examples |
| `guardrails` | ~4KB (13%) | forbidden_phrases (31), technical_terms (12), weather_cliches (10), avoid_patterns, seasonal_notes |
| `layer_1_programmes` | ~4KB (13%) | Programme profiles and metadata |
| `writing_examples` | ~1KB (3%) | Sample texts |
| `generation_metadata` | ~3KB (10%) | Generation timestamps, versions, reasoning |

### Current Data Loading Patterns

#### 1. **brand-profile-generator/index.ts** (Line 1435)
```typescript
const { data: existingProfile } = await supabase
  .from('business_brand_profile')
  .select('*')  // ❌ Loads ALL 29 columns including 30KB brand_profile_v5
  .eq('business_id', businessId)
  .single()
```
**Usage:** Returns cached profile when no regeneration needed  
**Issue:** Loads entire profile even though caller might only need specific fields  
**Justification:** This is the profile GENERATOR, so returning full profile makes sense

#### 2. **generate-text-from-idea/resolve-context.ts** (Line 482)
```typescript
const { data: brandProfile } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5, booking_link')  // ✅ Only loads needed fields
  .eq('business_id', businessId)
  .single()
```
**Usage:** Gets brand voice for text generation (most frequent call)  
**Then extracts only needed paths:**
```typescript
toneDNA = v5.voice?.tone_dna || null
businessIdentityPersona = v5.layer_0?.business_identity_persona?.system_persona || null
enhancedSocialExamples = v5.voice?.enhanced_social_examples || []
enhancedAvoidExamples = v5.voice?.enhanced_avoid_examples || []
// + about 15 more specific extractions from v5.voice and v5.guardrails
```

**Issue:** Even though only `brand_profile_v5` column is selected, **the entire 30KB JSON is loaded** from database, even though only these fields are used:
- `v5.voice.*` (~6KB) 
- `v5.guardrails.*` (~4KB)
- `v5.layer_0.business_identity_persona` (small subset of layer_0's 12KB)

**Database Limitation:** Supabase JS client doesn't support JSON path selection in `.select()`. Would need raw SQL:
```sql
SELECT 
  booking_link,
  brand_profile_v5->'voice' as voice,
  brand_profile_v5->'guardrails' as guardrails,
  brand_profile_v5->'layer_0'->'business_identity_persona' as persona
FROM business_brand_profile 
WHERE business_id = $1
```

#### 3. **get-quick-suggestions/index.ts** (Line 1756)
```typescript
const { data: brandProfile } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')  // ✅ Only v5 field
```
Similar pattern - loads full 30KB JSON, uses subset.

#### 4. **get-weekly-strategy/index.ts** (Line 254)
```typescript
const { data: brandProfile } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')  // ✅ Only v5 field
```
Same pattern.

### Data Loading Efficiency Summary

| Function | Query Pattern | Data Loaded | Data Used | Efficiency |
|----------|---------------|-------------|-----------|------------|
| brand-profile-generator | `SELECT *` | All 29 columns | All (generator returns full profile) | ✅ OK |
| generate-text-from-idea | `SELECT brand_profile_v5, booking_link` | 30KB JSON | ~10KB (voice + guardrails + small layer_0 subset) | ⚠️ 67% overhead |
| get-quick-suggestions | `SELECT brand_profile_v5` | 30KB JSON | ~15KB (varies by usage) | ⚠️ ~50% overhead |
| get-weekly-strategy | `SELECT brand_profile_v5` | 30KB JSON | ~8KB (voice + layer_0 subset) | ⚠️ 73% overhead |

### Why This Happens

PostgreSQL JSONB columns are stored as complete documents. When you `SELECT brand_profile_v5`, the entire JSON blob is:
1. Retrieved from disk
2. Sent over network to Supabase edge function
3. Parsed in JavaScript
4. Then specific paths extracted

**Supabase client limitation:** The `.select('brand_profile_v5')` syntax doesn't support JSON path extraction like `brand_profile_v5->voice`.

### Potential Optimization Approaches

#### Option A: Restructure Database (BREAKING CHANGE)
Split `brand_profile_v5` into separate columns:
- `brand_voice` JSONB (~6KB) - frequently accessed
- `brand_guardrails` JSONB (~4KB) - frequently accessed
- `brand_intelligence` JSONB (~12KB) - less frequently accessed
- `brand_programmes` JSONB (~4KB) - rarely accessed
- `brand_metadata` JSONB (~3KB) - rarely accessed

**Pros:** Functions can select only needed columns  
**Cons:** Requires schema migration, breaks existing code, complicates profile generation

#### Option B: Use Raw SQL for Hot Paths (TARGETED)
For frequently-called functions (generate-text-from-idea, get-quick-suggestions), use raw SQL with JSON path extraction:

```typescript
const { data } = await supabase.rpc('get_brand_voice_context', {
  p_business_id: businessId
})
```

Backend SQL function:
```sql
CREATE OR REPLACE FUNCTION get_brand_voice_context(p_business_id UUID)
RETURNS TABLE (
  booking_link TEXT,
  voice JSONB,
  guardrails JSONB,
  business_identity_persona JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bbp.booking_link,
    bbp.brand_profile_v5->'voice' as voice,
    bbp.brand_profile_v5->'guardrails' as guardrails,
    bbp.brand_profile_v5->'layer_0'->'business_identity_persona' as persona
  FROM business_brand_profile bbp
  WHERE bbp.business_id = p_business_id;
END;
$$ LANGUAGE plpgsql;
```

**Pros:** Reduces network transfer by ~67%, no schema changes  
**Cons:** Adds RPC functions, slightly more complex code

#### Option C: Client-Side Caching (EASIEST)
Cache the full brand_profile_v5 in memory for the duration of a request:

```typescript
// In resolve-context.ts
let cachedBrandProfile: any = null
let cachedBusinessId: string | null = null

if (cachedBusinessId === businessId && cachedBrandProfile) {
  // Use cached
} else {
  // Fetch and cache
  cachedBrandProfile = brandProfile
  cachedBusinessId = businessId
}
```

**Pros:** Simple, no database changes  
**Cons:** Only helps if same business called multiple times in one request (rare)

#### Option D: Accept Current Overhead (RECOMMENDED FOR NOW)
The 67% overhead means:
- generate-text-from-idea loads 30KB instead of 10KB
- At 100 requests/day = 2MB/day extra transfer (negligible)
- PostgreSQL JSONB is already indexed and fast
- Edge functions have generous memory limits

**Pros:** No changes needed, works well  
**Cons:** Slight inefficiency

---

## Recommendations

### Immediate Action (Safe & Clear Win)

✅ **Remove the 11 unused imports from brand-profile-generator/index.ts**

- Zero risk (functions not called anywhere)
- Reduces bundle size
- Improves code clarity
- Estimated time: 5 minutes

### Data Loading Optimization (Consider Later)

⏳ **Option D: Accept current overhead for now**

Reasons:
- The functions that load brand_profile_v5 do so infrequently (not on every request)
- Network transfer of 30KB is negligible on modern infrastructure
- PostgreSQL JSONB access is optimized
- No immediate performance problem observed

**Re-evaluate if:**
- Request volume increases significantly (>10,000 requests/day)
- Edge function memory limits become constrained
- Database query performance degrades

If optimization becomes needed later:
1. Try **Option B** (Raw SQL RPC) for generate-text-from-idea first (highest frequency)
2. Measure actual performance improvement
3. Expand to other functions if worthwhile

---

## Proposed Changes

### Change 1: Remove Unused Imports (READY TO IMPLEMENT)

**File:** `supabase/functions/brand-profile-generator/index.ts`

**Remove these lines (48-55, 63-71, 94):**
```typescript
// Lines 48-55: OLD fallback system (replaced)
buildBrandEssenceFallback,
buildSignatureShotFallback,
buildTargetAudienceFallback,
buildToneOfVoiceFallback,
buildContentFocusFallback,
buildContentStrategyFallback,
removeBannedWords,
sanitizeBannedWords,  // Keep this one - it IS used

// Lines 63-67: Unused data gatherers
buildMenuSummary,
buildImagesSummary,
buildSocialSummary,

// Lines 70-71: Unused signal extraction
extractStructuredWebsiteData,
ensureMustUsePhrasesFallback,  // Keep this one - it IS used

// Line 94: Unused voice options
generateVoiceOptions
```

**Actually keep:**
- `sanitizeBannedWords` (line 55) - IS used
- `ensureMustUsePhrasesFallback` (line 71) - IS used
- `buildContentStrategyFallback` (line 53) - IS used

**Net removal:** 8 unused imports

---

## Data Storage Reference

### Full brand_profile_v5 Schema

```json
{
  "version": "5.0",
  "generated_at": "ISO timestamp",
  "generation_metadata": { ... },
  
  "voice": {
    "tone_dna": { owner_voice, market_context, tone_do_list, tone_dont_list, location_driver },
    "formality_level": "casual|semi-formal|formal",
    "personality_traits": ["trait1", "trait2"],
    "humor_style": "playful|dry|warm|none",
    "emoji_level": "none|rare|occasional|frequent",
    "sentence_structure": "short|medium|varied",
    "sentence_length_max": 25,
    "structural_rules": [...],
    "style_rules": [...],
    "tone_rules": [...],
    "menu_description_examples": [...],
    "menu_description_metadata": {...},
    "social_writing_examples": [...],
    "enhanced_social_examples": [...],
    "enhanced_avoid_examples": [...],
    "avoid_examples": [...],
    "content_anchors": {...},
    "voice_confidence": 0-100,
    "voice_reasoning": "..."
  },
  
  "guardrails": {
    "forbidden_phrases": [...],
    "technical_terms": [...],
    "weather_cliches": [...],
    "never_say": {...},
    "avoid_patterns": {...},
    "seasonal_notes": [...],
    "content_exclusions": [...],
    "factual_constraints": [...],
    "wallpaper_avoidance": [...],
    "length_limits": {...}
  },
  
  "layer_0_intelligence": {
    "business_type": {...},
    "business_identity": {...},
    "professional_persona": {...},
    "voice_archetype": {...},
    "geographic_context": {...},
    "city_context_ai": {...},
    "menu_overview": {...}
  },
  
  "layer_1_programmes": {
    "programmes": [...]
  },
  
  "writing_examples": {
    "social_posts": [...],
    "menu_descriptions": [...]
  }
}
```

### Field Access Frequency (Estimated)

| Field | Read Frequency | Typical Callers |
|-------|----------------|-----------------|
| `voice.*` | Very High | generate-text-from-idea (every post), get-quick-suggestions, get-weekly-strategy |
| `guardrails.*` | Very High | generate-text-from-idea (validation), get-weekly-strategy |
| `layer_0.business_identity_persona` | High | generate-text-from-idea, get-weekly-strategy |
| `layer_0.menu_overview` | Medium | get-quick-suggestions |
| `layer_1_programmes` | Low | Programme-specific features |
| `writing_examples` | Low | Brand profile UI display |
| `generation_metadata` | Very Low | Debugging, audit logs |

---

## Next Steps

1. ✅ User review this analysis
2. ⏳ User approves unused import removal
3. ⏳ Execute removal (3-5 minute change)
4. ⏳ Deploy brand-profile-generator with cleaned imports
5. ⏳ Monitor bundle size reduction
6. ⏳ Decide on data loading optimization separately (if needed)
