# Phase 2: V5 Generator Update Guide

**Status:** Ready for Implementation  
**Timeline:** Week 1, Day 3-5 (8-12 hours)  
**Dependency:** Phase 1 migration must be executed first

---

## Overview

Update `brand-profile-generator-v5/index.ts` to:
1. Add Layer 5 generation (voice, writing_examples, guardrails)
2. Build complete V5 JSONB structure
3. Save to `brand_profile_v5` JSONB column (instead of separate tables/columns)

---

## Current Flow (Layers 1-4 Only)

```typescript
// supabase/functions/brand-profile-generator-v5/index.ts

1. Detect programmes (Layer 1)
2. Generate commercial orientation per programme (Layer 2)
3. Generate identity (Layer 3)
4. Generate audience segments per programme (Layer 4)
5. Save to:
   - business_programme_profiles table
   - Individual columns (brand_essence, positioning, core_values, etc.)
```

**Problem:** No Layer 5, fragmented storage, no JSONB structure.

---

## New Flow (Complete V5)

```typescript
1. Detect programmes (Layer 1) ✅
2. Generate commercial orientation per programme (Layer 2) ✅
3. Generate identity (Layer 3) ✅
4. Generate audience segments per programme (Layer 4) ✅
5. ⭐ Generate voice profile (Layer 5a) — NEW
6. ⭐ Generate writing examples (Layer 5b) — NEW
7. ⭐ Generate guardrails (Layer 5c) — NEW
8. ⭐ Assemble complete V5 JSONB structure — NEW
9. ⭐ Save to brand_profile_v5 column — NEW
10. ⭐ Update metadata (generated_at, version) — NEW
```

---

## Code Changes Required

### 1. Add Imports

```typescript
// Add at top of index.ts
import { generateVoiceProfile } from '../_shared/brand-profile/voice-profile.ts'
import { generateWritingExamples } from '../_shared/brand-profile/writing-examples.ts'
import { generateGuardrails } from '../_shared/brand-profile/guardrails.ts'
import type { 
  V5BrandProfile, 
  VoiceGenerationInput, 
  WritingExamplesGenerationInput,
  GuardrailsGenerationInput 
} from '../_shared/brand-profile/types-v5.ts'
```

### 2. Update Main Function

**BEFORE (current):**
```typescript
// After Layer 4 generation...
const result = {
  programmes: programmeProfiles,
  identity: identityResult,
  audienceSegments: audienceSegments
}

// Save to business_programme_profiles + individual columns
await saveBrandProfile(businessId, result)
```

**AFTER (new):**
```typescript
// After Layer 4 generation...

// === LAYER 5: VOICE, EXAMPLES, GUARDRAILS ===
console.log('📢 Generating Layer 5: Voice Profile...')
const voiceInput: VoiceGenerationInput = {
  business: {
    business_name: businessDetails.business_name,
    business_category: businessDetails.business_category,
    establishment_type: businessDetails.establishment_type
  },
  identity: identityResult,
  legacy_voice: {
    tone_of_voice: businessDetails.tone_of_voice,
    tone_model: businessDetails.tone_model,
    voice_constraints: businessDetails.voice_constraints
  }
}
const voiceProfile = await generateVoiceProfile(voiceInput, openAiKey)

console.log('✍️ Generating Layer 5b: Writing Examples...')
const examplesInput: WritingExamplesGenerationInput = {
  voice: voiceProfile,
  legacy_examples: {
    typical_openings: businessDetails.typical_openings,
    typical_closings: businessDetails.typical_closings,
    signature_phrases: businessDetails.signature_phrases
  },
  business: {
    business_name: businessDetails.business_name,
    menu_highlights: businessDetails.menu_highlights,
    location_reference: businessDetails.location_reference
  }
}
const writingExamples = await generateWritingExamples(examplesInput, openAiKey)

console.log('🛡️ Generating Layer 5c: Guardrails...')
const guardrailsInput: GuardrailsGenerationInput = {
  voice: voiceProfile,
  identity: identityResult,
  legacy_guardrails: {
    never_say: businessDetails.never_say,
    things_to_avoid: businessDetails.things_to_avoid,
    voice_constraints: businessDetails.voice_constraints
  },
  business: {
    business_category: businessDetails.business_category,
    common_mistakes: []
  }
}
const guardrails = await generateGuardrails(guardrailsInput, openAiKey)

// === ASSEMBLE COMPLETE V5 JSONB ===
const v5Profile: V5BrandProfile = {
  version: '5.0',
  generated_at: new Date().toISOString(),
  generation_metadata: {
    request_id: crypto.randomUUID(),
    duration_ms: Date.now() - startTime,
    ai_models_used: {
      layer_2: 'gpt-4o-mini',
      layer_3: 'gpt-4o',
      layer_4: 'gpt-4o-mini',
      layer_5: 'gpt-4o'
    }
  },
  programmes: programmeProfiles, // Already has commercialOrientation + audienceSegments
  identity: identityResult,
  voice: voiceProfile,
  writing_examples: writingExamples,
  guardrails: guardrails
}

// Save to brand_profile_v5 JSONB column
await saveV5Profile(businessId, v5Profile)
```

### 3. Create Save Function

**Add new function at bottom of index.ts:**

```typescript
/**
 * Save complete V5 profile to brand_profile_v5 JSONB column
 */
async function saveV5Profile(
  businessId: string,
  profile: V5BrandProfile
): Promise<void> {
  
  const { error } = await supabaseClient
    .from('business_brand_profile')
    .update({
      brand_profile_v5: profile,
      brand_profile_v5_generated_at: profile.generated_at,
      brand_profile_v5_version: profile.version
    })
    .eq('business_id', businessId)
  
  if (error) {
    console.error('❌ Failed to save V5 profile:', error)
    throw new Error(`Failed to save V5 profile: ${error.message}`)
  }
  
  console.log('✅ V5 profile saved to brand_profile_v5 column')
}
```

### 4. Query Business Details (Add Missing Fields)

**Update the business details query to fetch legacy voice fields:**

```typescript
const { data: businessDetails, error: businessError } = await supabaseClient
  .from('business_brand_profile')
  .select(`
    business_id,
    business_name,
    business_category,
    establishment_type,
    tone_of_voice,
    tone_model,
    tone_keywords,
    typical_openings,
    typical_closings,
    signature_phrases,
    never_say,
    things_to_avoid,
    voice_constraints,
    menu_highlights,
    location_reference
  `)
  .eq('business_id', businessId)
  .single()
```

---

## Testing

### Test 1: Full V5 Generation

```bash
# Trigger generator for Café Faust
curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5 \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"businessId": "2037d63c-a138-4247-89c5-5b6b8cef9f3f"}'
```

**Expected logs:**
```
🔍 Detecting programmes...
✅ Found 4 programmes
📊 Generating Layer 2: Commercial Orientation...
🎯 Generating Layer 3: Identity...
👥 Generating Layer 4: Audience Segments...
📢 Generating Layer 5: Voice Profile...
✅ Voice profile derived from legacy tone_of_voice
✍️ Generating Layer 5b: Writing Examples...
✅ Copied 4 typical_openings from legacy
🤖 Generating typical_closings with AI...
🛡️ Generating Layer 5c: Guardrails...
✅ V5 profile saved to brand_profile_v5 column
```

### Test 2: Verify Database

```sql
-- Check V5 profile structure
SELECT 
  business_id,
  business_name,
  brand_profile_v5->>'version' as version,
  brand_profile_v5_generated_at,
  jsonb_array_length(brand_profile_v5->'programmes') as programme_count,
  brand_profile_v5->'voice'->>'formality_level' as formality,
  jsonb_array_length(brand_profile_v5->'voice'->'tone_rules') as tone_rules_count,
  jsonb_array_length(brand_profile_v5->'writing_examples'->'typical_openings') as openings_count,
  jsonb_array_length(brand_profile_v5->'guardrails'->'never_say') as never_say_count
FROM business_brand_profile
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
```

**Expected output:**
```
business_id  | 2037d63c-a138-4247-89c5-5b6b8cef9f3f
business_name| Café Faust
version      | 5.0
generated_at | 2026-05-09T12:34:56Z
programme_count | 4
formality    | informal
tone_rules_count | 5
openings_count | 4
never_say_count | 5
```

### Test 3: Extract Voice Rules

```sql
-- Extract voice rules from JSONB
SELECT 
  business_name,
  jsonb_array_elements_text(brand_profile_v5->'voice'->'tone_rules') as tone_rule
FROM business_brand_profile
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
```

**Expected output:**
```
Café Faust | Skriv én tanke pr. sætning — stop før du forklarer
Café Faust | Tal direkte til gæsten — brug du-form
Café Faust | Vær konkret — brug navne, ikke kategorier
Café Faust | Skriv som du taler — undgå bogsprog
Café Faust | Start med handling — udsæt ikke pointen
```

---

## Rollback Plan

If V5 generation fails:

1. **Check Error Logs:**
   ```bash
   # View Edge Function logs
   supabase functions logs brand-profile-generator-v5
   ```

2. **Rollback Database:**
   ```sql
   -- Clear failed V5 profile
   UPDATE business_brand_profile
   SET 
     brand_profile_v5 = NULL,
     brand_profile_v5_generated_at = NULL
   WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
   ```

3. **Fix Code and Redeploy:**
   ```bash
   supabase functions deploy brand-profile-generator-v5
   ```

4. **Retry Generation**

---

## Success Criteria

✅ Generator creates complete V5 JSONB with all 5 layers  
✅ brand_profile_v5 column populated  
✅ Voice rules (5-7 items) present  
✅ Writing examples (typical_openings, typical_closings, signature_phrases) present  
✅ Guardrails (never_say, content_exclusions, factual_constraints) present  
✅ Metadata (version, generated_at, generation_metadata) correct  
✅ Legacy voice data preserved (typical_openings copied if exists)  

---

## Next Phase

After Phase 2 complete → **Phase 3: Backfill Script**  
Create script to migrate existing businesses to V5 JSONB format.

