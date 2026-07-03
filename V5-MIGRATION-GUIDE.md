# V5 Migration Guide

**Purpose**: Practical examples for migrating from flat columns to V5 extractors  
**Target Audience**: Developers implementing Phase 2+ of V5 migration plan  
**Reference**: See V5-FIELD-MIGRATION-MATRIX.md for complete field mapping

---

## Quick Start

### 1. Import Extractors

```typescript
import {
  extractBrandEssence,
  extractPositioning,
  extractCoreValues,
  extractToneRules,
  extractVoiceGuardrails,
  extractIdentityConfiguration,
  extractVoiceConfiguration,
  hasV5Data
} from '../_shared/brand-profile/v5-extractors.ts'
```

### 2. Update SELECT Queries

**BEFORE** (reads NULL flat columns):
```typescript
const { data: brandProfile } = await supabase
  .from('business_brand_profile')
  .select('brand_essence, positioning, core_values, tone_of_voice')
  .eq('business_id', businessId)
  .single()
```

**AFTER** (includes V5 JSONB):
```typescript
const { data: brandProfile } = await supabase
  .from('business_brand_profile')
  .select(`
    brand_profile_v5,
    brand_essence,
    positioning,
    core_values,
    tone_of_voice,
    tone_model
  `)
  .eq('business_id', businessId)
  .single()
```

### 3. Replace Direct Reads with Extractors

**BEFORE**:
```typescript
const essence = brandProfile.brand_essence || ''
const positioning = brandProfile.positioning || ''
const values = brandProfile.core_values || []
```

**AFTER**:
```typescript
const essence = extractBrandEssence(brandProfile)
const positioning = extractPositioning(brandProfile)
const values = extractCoreValues(brandProfile)
```

---

## Migration Patterns by File Type

### Pattern 1: Context Resolution (resolve-context.ts style)

**Current Code** (Lines 217-250):
```typescript
const { data: brandData } = await supabase
  .from('business_brand_profile')
  .select('brand_essence, tone_of_voice, tone_model, voice_rationale')
  .eq('business_id', businessId)
  .single()

const brandEssence = brandData.brand_essence || ''
const voiceRationale = brandData.voice_rationale || ''
const toneRules = brandData.tone_model?.writing_rules || []
```

**Migrated Code**:
```typescript
import { 
  extractBrandEssence, 
  extractVoiceRationale, 
  extractToneRules,
  extractVoiceConfiguration
} from '../_shared/brand-profile/v5-extractors.ts'

const { data: brandData } = await supabase
  .from('business_brand_profile')
  .select(`
    brand_profile_v5,
    brand_essence,
    tone_model,
    voice_rationale
  `)
  .eq('business_id', businessId)
  .single()

// V5-first extraction with automatic fallback
const brandEssence = extractBrandEssence(brandData)
const voiceRationale = extractVoiceRationale(brandData)
const toneRules = extractToneRules(brandData)

// Or use combined extractor for all voice fields:
const voiceConfig = extractVoiceConfiguration(brandData)
// voiceConfig.tone_rules, voiceConfig.voice_reasoning, etc.
```

---

### Pattern 2: Audience Profile (audience-profile.ts style)

**Current Code** (Lines 237-240):
```typescript
const identityContext = `
Brand essence: ${identity.brand_essence}
Positionering: ${identity.positioning}
Kerneværdier: ${identity.core_values.join(', ')}
USP: ${identity.what_makes_us_different}
`

const prompt = `
${identityContext}

Based on the above brand identity, generate audience segments...
`
```

**Migrated Code**:
```typescript
import { extractIdentityConfiguration } from '../_shared/brand-profile/v5-extractors.ts'

// Extract all identity fields at once
const identity = extractIdentityConfiguration(brandProfile)

const identityContext = `
Brand essence: ${identity.brand_essence}
Positionering: ${identity.positioning}
Kerneværdier: ${identity.core_values.join(', ')}
USP: ${identity.usp}
`

const prompt = `
${identityContext}

Based on the above brand identity, generate audience segments...
`
```

**Benefits**:
- Single function call for all identity fields
- Guaranteed non-null values (empty strings instead of null)
- Automatic V5 → legacy fallback chain

---

### Pattern 3: Weekly Plan (generate-weekly-plan/index.ts style)

**Current Code** (Line 498):
```typescript
const { data: brandProfile } = await supabase
  .from('business_brand_profile')
  .select('*') // Wasteful - pulls 60+ columns
  .eq('business_id', businessId)
  .single()

const essence = brandProfile.brand_essence || 'Unknown brand'
const guardrails = brandProfile.voice_guardrails || []
```

**Migrated Code**:
```typescript
import { 
  extractBrandEssence,
  extractVoiceGuardrails,
  extractAudienceSegments,
  extractLocationNarrative
} from '../_shared/brand-profile/v5-extractors.ts'

// Explicit column list - only what we need
const { data: brandProfile } = await supabase
  .from('business_brand_profile')
  .select(`
    brand_profile_v5,
    business_identity_persona,
    marketing_manager_brief,
    content_strategy,
    voice_guardrails,
    strategic_audience_segments,
    brand_essence,
    location_intelligence
  `)
  .eq('business_id', businessId)
  .single()

// Extract with V5-first logic
const essence = extractBrandEssence(brandProfile)
const guardrails = extractVoiceGuardrails(brandProfile)
const audiences = extractAudienceSegments(brandProfile)
const locationNarrative = extractLocationNarrative(brandProfile)
```

**Performance Improvement**: Query size reduced from ~60 columns to ~8 columns

---

### Pattern 4: Combined Configuration Objects

When you need multiple related fields, use combined extractors:

**Identity Bundle**:
```typescript
import { extractIdentityConfiguration } from '../_shared/brand-profile/v5-extractors.ts'

const identity = extractIdentityConfiguration(brandProfile)
// Returns: {
//   brand_essence: string,
//   positioning: string,
//   core_values: string[],
//   usp: string,
//   reasoning: string
// }
```

**Voice Bundle**:
```typescript
import { extractVoiceConfiguration } from '../_shared/brand-profile/v5-extractors.ts'

const voice = extractVoiceConfiguration(brandProfile)
// Returns: {
//   tone_rules: string[],
//   formality_level: string,
//   emoji_usage: string,
//   sentence_structure: string,
//   voice_reasoning: string,
//   good_examples: string[],
//   avoid_examples: string[],
//   guardrails: string[]
// }
```

**Location Bundle**:
```typescript
import { extractLocationConfiguration } from '../_shared/brand-profile/v5-extractors.ts'

const location = extractLocationConfiguration(brandProfile)
// Returns: {
//   city: string,
//   area_type: string,
//   narrative: string
// }
```

---

## Migration Checklist

For each file you migrate:

- [ ] Add `brand_profile_v5` to SELECT query
- [ ] Keep legacy columns for fallback (don't remove yet)
- [ ] Import needed extractors from `v5-extractors.ts`
- [ ] Replace direct reads with extractor calls
- [ ] Test with V5-enabled business (Café Faust)
- [ ] Test with legacy business (if any remain)
- [ ] Verify no TypeScript errors
- [ ] Check logs for V5 vs legacy usage
- [ ] Deploy and monitor

---

## Handling Special Cases

### Case 1: Flattened V5 Columns

Some V5 data is already flattened to top-level columns. Extractors handle this automatically:

```typescript
// These are ALREADY flattened by V5 generator:
// - business_identity_persona
// - marketing_manager_brief
// - voice_guardrails
// - enhanced_social_examples
// - strategic_audience_segments
// - content_strategy

// For flattened columns, extractors check flattened first, then V5 JSONB
const guardrails = extractVoiceGuardrails(brandProfile)
// Prefers: voice_guardrails (flattened)
// Falls back to: brand_profile_v5.guardrails
// Then: things_to_avoid + voice_constraints (legacy)
```

**No action needed** - extractors prioritize flattened columns automatically.

### Case 2: Deprecated Fields

Some fields are intentionally NULL in V5:

```typescript
// tone_of_voice is deprecated (June 14, V5 sets to NULL)
// DO NOT migrate - this field is being phased out
const toneOfVoice = brandProfile.tone_of_voice // Will be NULL

// Use tone_rules instead:
const toneRules = extractToneRules(brandProfile)
```

**Action**: Remove references to deprecated fields, use V5 equivalents.

### Case 3: Missing V5 Equivalents

Some legacy fields have no V5 equivalent:

```typescript
// communication_goal - NO V5 EQUIVALENT
// Options:
// A) Remove from code (if not used in prompts)
// B) Add to V5 structure (if critical)
// C) Derive from existing V5 data

// Current recommendation: Remove or derive
const communicationGoal = brandProfile.content_strategy?.primary_goal || ''
```

**Action**: See V5-FIELD-MIGRATION-MATRIX.md "Decision Needed" section.

---

## Testing Your Migration

### Unit Test Example

```typescript
Deno.test('Caption generation uses V5 brand essence', async () => {
  const mockProfile = {
    brand_profile_v5: {
      identity: {
        brand_essence: 'V5 Test Essence'
      }
    },
    brand_essence: 'Legacy Test Essence' // Should be ignored
  }
  
  const essence = extractBrandEssence(mockProfile)
  assertEquals(essence, 'V5 Test Essence')
})
```

### Integration Test Example

```typescript
Deno.test('Café Faust caption uses V5 data', async () => {
  const cafeId = '36e24a84-c32d-4123-910a-1bb2e64d34af'
  
  const { data: profile } = await supabase
    .from('business_brand_profile')
    .select('brand_profile_v5, brand_essence')
    .eq('business_id', cafeId)
    .single()
  
  const essence = extractBrandEssence(profile)
  
  // Should use V5 data (not NULL flat column)
  assertExists(essence)
  assert(essence.length > 0)
  
  // Optional: Log which source was used
  const diagnostic = getV5DiagnosticReport(profile)
  assertEquals(diagnostic.extraction_sources.brand_essence, 'V5')
})
```

---

## Monitoring & Logging

### Add Diagnostic Logging

```typescript
import { getV5DiagnosticReport } from '../_shared/brand-profile/v5-extractors.ts'

const diagnostic = getV5DiagnosticReport(brandProfile)

console.log('[V5_MIGRATION_STATUS]', {
  business_id: businessId,
  has_v5: diagnostic.has_v5_data,
  sources: diagnostic.extraction_sources
})

// Example output:
// [V5_MIGRATION_STATUS] {
//   business_id: '36e24a84...',
//   has_v5: true,
//   sources: {
//     brand_essence: 'V5',
//     positioning: 'V5',
//     tone_rules: 'V5'
//   }
// }
```

### Track V5 Adoption Rate

```sql
-- Query to check V5 vs legacy usage
SELECT 
  COUNT(*) FILTER (WHERE brand_profile_v5 IS NOT NULL) as businesses_with_v5,
  COUNT(*) FILTER (WHERE brand_profile_v5 IS NULL) as businesses_legacy_only,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE brand_profile_v5 IS NOT NULL) / COUNT(*),
    2
  ) as v5_adoption_percentage
FROM business_brand_profile;
```

---

## Common Pitfalls

### ❌ Don't Do This

```typescript
// BAD: Direct read from flat column (brand profile field)
const essence = brandProfile.brand_essence || ''

// BAD: Forget to include brand_profile_v5 in SELECT
.select('brand_essence, positioning')

// BAD: Assume V5 always exists
const essence = brandProfile.brand_profile_v5.identity.brand_essence // Can crash!

// BAD: Remove legacy columns from SELECT before migration complete
.select('brand_profile_v5') // No fallback possible

// BAD: Migrate operational fields (these should stay as flat columns)
const bookingLink = extractBookingLink(brandProfile) // NO! booking_link is operational, not brand profile
```

### ✅ Do This Instead

```typescript
// GOOD: Use extractor with automatic fallback (brand profile fields only)
const essence = extractBrandEssence(brandProfile)

// GOOD: Include both V5 and legacy in SELECT
.select('brand_profile_v5, brand_essence, positioning')

// GOOD: Let extractor handle null checks
const essence = extractBrandEssence(brandProfile) // Always returns string, never crashes

// GOOD: Keep legacy columns during migration period
.select('brand_profile_v5, brand_essence, positioning, core_values')

// GOOD: Read operational fields directly (they're not migrated)
const bookingLink = brandProfile.booking_link ?? null // ✅ Correct - operational field
const kitchenClose = operations.kitchen_close_time ?? null // ✅ Correct - operational field
```

### 🔍 How to Identify Field Types

**Brand Profile Fields** (migrate to V5 extractors):
- Identity: brand_essence, positioning, core_values, what_makes_us_different
- Voice: tone_rules, voice_rationale, formality_level, emoji_usage
- Examples: good_examples, typical_openings
- Guardrails: voice_constraints, things_to_avoid

**Operational Fields** (leave as flat columns):
- Booking: booking_link, booking_url, reservation_required
- Operations: kitchen_close_time, opening_hours, accepts_walkins
- Infrastructure: website_url, menu_signal
- Features: has_outdoor_seating, has_takeaway, has_delivery

**Flattened V5 Fields** (already working correctly):
- business_identity_persona, marketing_manager_brief, voice_guardrails
- strategic_audience_segments, content_strategy
- enhanced_social_examples, enhanced_avoid_examples

---

## Rollback Plan

If migration causes issues:

1. **Immediate**: Extractors automatically fall back to legacy data
2. **Revert code**: Change extractors back to direct reads
3. **Query**: Legacy columns still in database
4. **No data loss**: Both V5 and legacy data preserved during migration

---

## File-by-File Migration Priority

Based on V5-FIELD-MIGRATION-MATRIX.md:

### 🔥 Critical (Do First)

1. **resolve-context.ts** (Line 217)
   - Impact: Caption generation gets NULL identity
   - Fields: brand_essence, positioning, tone_rules, voice_rationale
   - Est. effort: 1-2 hours

2. **audience-profile.ts** (Lines 237-240)
   - Impact: Audience generation missing brand context
   - Fields: brand_essence, positioning, core_values, usp
   - Est. effort: 1 hour

### ⚠️ High Priority

3. **generate-weekly-plan/index.ts** (Line 498)
   - Impact: Wasteful query + missing V5 data
   - Fields: Replace SELECT * + extract identity/voice
   - Est. effort: 2-3 hours

4. **get-quick-suggestions** (Multiple locations)
   - Impact: Quick suggestions missing V5 voice
   - Fields: tone_rules, guardrails, voice_config
   - Est. effort: 2-3 hours

### 📊 Medium Priority

5. **Other brand-profile files**
   - brandProfileService.ts
   - voice-profile.ts
   - contextBuilder.ts

---

## Success Criteria

Migration complete when:

- ✅ All extractors imported and used
- ✅ No direct reads from flat columns in prompts
- ✅ SELECT queries include brand_profile_v5
- ✅ Tests pass (unit + integration)
- ✅ No TypeScript errors
- ✅ Logs show >90% V5 usage
- ✅ Caption quality maintained/improved
- ✅ Performance not degraded

---

## Next Steps

1. Read V5-FIELD-MIGRATION-MATRIX.md for field mapping
2. Start with Critical files (resolve-context.ts, audience-profile.ts)
3. Follow patterns in this guide
4. Run tests after each migration
5. Deploy incrementally (one file at a time)
6. Monitor logs for V5 adoption rate

---

*Last Updated: 2026-06-23*  
*Phase: 1 - Foundation complete, ready for Phase 2 implementation*
