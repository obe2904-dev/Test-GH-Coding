# Assessment: Wire `business_identity_persona` into `fetchBusinessContext`

**Date**: June 12, 2026  
**Proposed by**: User  
**Status**: ✅ **RECOMMENDED** with modifications

---

## Current State Analysis

### How Data Flows Today

1. **In `resolve-context.ts` (lines 182-189)**:
   ```typescript
   // Fetches short business_character from database
   if ((brandProfile as any)?.business_character) {
     const bc = (brandProfile as any).business_character as any
     businessCharacter = typeof bc === 'string' ? bc.trim()
       : (typeof bc === 'object' && bc?.value) ? String(bc.value).trim() : ''
   }
   ```
   - Returns: `businessCharacter: string` (~200 chars)
   - Example: `"En tidløs café ved åen med charmerende charme"`

2. **In `index.ts` (lines 78-103)**:
   ```typescript
   // Separately fetches business_identity_persona for paid tier
   const { data: profileData } = await supabase
     .from('business_brand_profile')
     .select('brand_profile_v5, voice_guardrails, business_identity_persona, ...')
     
   businessIdentityPersona = (brandProfileV5 as any).business_identity_persona || 
                             brandProfileV5.identity?.business_character || 
                             null
   ```
   - Fetched separately ONLY in paid tier path
   - Passed directly to prompt builder as additional parameter

3. **In `prompt-builders.ts` (lines 122-127)**:
   ```typescript
   // Only ONE line used from full persona
   if ((o as any).business_identity_persona) {
     const personaLines = (o as any).business_identity_persona.split('\n')
     const keyLine = personaLines.find((line: string) => 
       line.includes('er') || line.includes('består')) || personaLines[0]
     kontekst += `${keyLine}\n`  // Only includes first key line!
   }
   ```
   - **Problem**: Full rich persona (~2000 chars) reduced to ONE LINE
   - Only used in Tone DNA block (V5.5 path)
   - Not used as system prompt foundation

---

## What `business_identity_persona` Contains

**Full structure** (from verification SQL and migration docs):

```
### Hvad stedet ER

En tidløs, autentisk café ved åen med charmerende, let skæv charme.
Lidt boheme, lidt fransk café-kultur, lidt Nørrebro-stemning.

### Strategiske målgrupper

**Primær**: Aftensmad ved åen (weekday 18-22)
-Par og vennegrupper som søger en afslappet middag ved vandet
- Værdsætter stemning + lokation over fine-dining formalia

**Sekundær**: 
- Brunchentusiaster (weekend 10-14)
- Frokostpauser (weekday 12-14)

### Kommunikationsstrategi

**Tone**: Elevated-casual med French-Nordic register
**Location driver**: Waterfront proximity (89 score)
**Owner voice**: Direct, warm, fact-based
```

**vs. short `business_character`:**
```
En tidløs café ved åen med charmerende charme.
```

---

## Proposed Change Impact

### ✅ Benefits

1. **Richer Persona Foundation**
   - System prompt gets strategic segments, not just venue description
   - AI understands WHO it's writing for (primary/secondary audiences)
   - Communication strategy baked into every generation

2. **Architectural Simplification**
   - Consolidate persona fetching in ONE place (`fetchBusinessContext`)
   - Remove duplicate fetch logic from `index.ts`
   - Single source of truth for "what the business is"

3. **Better Voice Consistency**
   - Currently: tone DNA references full persona, but system prompt uses short character
   - After: Both use same rich persona = aligned mental model

4. **Performance Neutral**
   - `business_identity_persona` already fetched as flattened column (June 12 migration)
   - No additional DB queries needed

### ⚠️ Considerations

1. **Prompt Size**
   - Full persona: ~2000 chars
   - Short character: ~200 chars
   - Impact: +1800 chars to system prompt
   - **Assessment**: Acceptable — system prompts can be larger, and this is high-value context

2. **Free Tier**
   - Currently: `business_identity_persona` only fetched for paid tier
   - Question: Should free tier also get this?
   - **Recommendation**: 
     - Paid tier: Full `business_identity_persona`
     - Free tier: Keep short `business_character` (simpler, faster)

3. **Backward Compatibility**
   - Some businesses may not have `business_identity_persona` populated yet
   - Need fallback logic: `business_identity_persona ?? business_character`

---

## Implementation Plan

### Phase 1: Update `fetchBusinessContext` (resolve-context.ts)

**Current** (line 182-189):
```typescript
if ((brandProfile as any)?.business_character) {
  const bc = (brandProfile as any).business_character as any
  businessCharacter = typeof bc === 'string' ? bc.trim()
    : (typeof bc === 'object' && bc?.value) ? String(bc.value).trim() : ''
}
```

**Proposed**:
```typescript
// New interface field
let businessIdentityPersona = ''

if (isPaid) {
  // Paid tier: fetch full persona with fallback
  if ((brandProfile as any)?.business_identity_persona) {
    businessIdentityPersona = String((brandProfile as any).business_identity_persona).trim()
  } else if ((brandProfile as any)?.business_character) {
    // Fallback to short character if persona not populated
    const bc = (brandProfile as any).business_character
    businessIdentityPersona = typeof bc === 'string' ? bc.trim()
      : (typeof bc === 'object' && bc?.value) ? String(bc.value).trim() : ''
  }
} else {
  // Free tier: keep short character
  if ((brandProfile as any)?.business_character) {
    const bc = (brandProfile as any).business_character
    businessIdentityPersona = typeof bc === 'string' ? bc.trim()
      : (typeof bc === 'object' && bc?.value) ? String(bc.value).trim() : ''
  }
}
```

**Add to SELECT** (line 149):
```typescript
.select('brand_essence, tone_of_voice, ..., business_identity_persona')
//                                         ^^^ ADD THIS
```

**Add to return type** (BusinessContext interface, line 68):
```typescript
export interface BusinessContext {
  // ... existing fields
  businessCharacter: string           // DEPRECATED: keep for backward compat
  businessIdentityPersona: string     // NEW: full persona (paid) or short (free)
}
```

**Add to return statement** (line 282):
```typescript
return {
  // ... all existing fields
  businessCharacter,                  // Keep for backward compat
  businessIdentityPersona,            // NEW
}
```

---

### Phase 2: Update `index.ts`

**Remove duplicate fetch** (lines 78-103):
```typescript
// ❌ DELETE THIS ENTIRE BLOCK
// 4b. Fetch brand profile V5 (needed for prompt building AND validation)
let brandProfileV5 = null
let voiceGuardrails = null
if (isPaid) {
  const { data: profileData } = await supabase
    .from('business_brand_profile')
    .select('brand_profile_v5, voice_guardrails, business_identity_persona, ...')
    .eq('business_id', businessId)
    .single()
  brandProfileV5 = profileData?.brand_profile_v5 || null
  voiceGuardrails = profileData?.voice_guardrails || null
}

// Extract tone DNA
let toneDNA = null
let businessIdentityPersona = null
// ...
```

**Move V5/guardrails fetch to where it's needed** (before validation, line 236):
```typescript
// Voice validation still needs these - fetch them here
let voiceGuardrails = null
let brandProfileV5 = null

if (isPaid) {
  const { data: validationData } = await supabase
    .from('business_brand_profile')
    .select('brand_profile_v5, voice_guardrails, enhanced_social_examples, enhanced_avoid_examples')
    .eq('business_id', businessId)
    .single()
  
  voiceGuardrails = validationData?.voice_guardrails || null
  brandProfileV5 = validationData?.brand_profile_v5 || null
}
```

**Update prompt building** (line 204):
```typescript
business_identity_persona: biz.businessIdentityPersona,  // Use from context
//                         ^^^ FROM BUSINESS CONTEXT NOW
```

---

### Phase 3: Update `prompt-builders.ts`

**Current** (lines 122-127):
```typescript
// Business identity persona (compressed - key line only)
if ((o as any).business_identity_persona) {
  const personaLines = (o as any).business_identity_persona.split('\n')
  const keyLine = personaLines.find((line: string) => 
    line.includes('er') || line.includes('består')) || personaLines[0]
  kontekst += `${keyLine}\n`
}
```

**Proposed** (use FULL persona, not just one line):
```typescript
// Business identity persona (FULL - system prompt foundation)
if ((o as any).business_identity_persona) {
  kontekst += `\n### BUSINESS IDENTITY\n`
  kontekst += (o as any).business_identity_persona + '\n\n'
}
```

**Deprecate `businessCharacter` parameter** (keep for backward compat but don't use):
```typescript
// In buildBrandBlock options:
businessCharacter,                 // DEPRECATED: replaced by business_identity_persona
business_identity_persona,         // NEW: full persona
```

---

## Migration Safety

### Rollback Plan
1. Keep `businessCharacter` in `BusinessContext` interface
2. If issues arise, revert prompt builder to use `businessCharacter`
3. Zero database changes needed (columns already exist)

### Testing Strategy
1. **Before**: Generate post with current implementation
2. **After**: Generate same post with new implementation
3. **Compare**: Tone consistency, strategic alignment, factual accuracy

### Monitoring
- Track generation latency (expect +50-100ms for larger system prompt)
- Monitor voice validation scores (expect improvement)
- Check for hallucination rate (should decrease with richer context)

---

## Decision Matrix

| Criterion | Current | Proposed | Winner |
|-----------|---------|----------|--------|
| **Persona richness** | 200 chars (venue only) | 2000 chars (venue + audience + strategy) | ✅ Proposed |
| **Strategic alignment** | Weak (no audience context) | Strong (primary/secondary segments) | ✅ Proposed |
| **Architecture** | Duplicate fetch logic | Single source of truth | ✅ Proposed |
| **Prompt size** | Small | Larger (+1.8KB) | ⚠️ Current |
| **Performance** | Fast | Fast (same DB query) | 🟰 Tie |
| **Backward compat** | N/A | Fallback to business_character | ✅ Proposed |

---

## Recommendation

### ✅ **PROCEED** with the following modifications:

1. **Wire `business_identity_persona` into `fetchBusinessContext`**
   - Paid tier: Use full persona from top-level column
   - Free tier: Use short `business_character`
   - Fallback: If persona null, use `business_character`

2. **Use full persona in system prompt** (not just one line)
   - Replace current "key line extraction" with full persona
   - This gives AI complete context: venue + audience + strategy

3. **Remove duplicate fetch from `index.ts`**
   - Consolidate persona logic in `fetchBusinessContext`
   - Keep V5/guardrails fetch near validation where it's needed

4. **Keep `businessCharacter` for backward compatibility**
   - Don't break existing code that references it
   - Mark as deprecated in comments

---

## Expected Outcomes

### Positive
- ✅ More strategic, audience-aware copy
- ✅ Better alignment with tone DNA
- ✅ Cleaner architecture (single source of truth)
- ✅ Richer context = fewer hallucinations

### Neutral
- 🟰 Slightly larger system prompts (+1.8KB)
- 🟰 Free tier unchanged

### Risks (Mitigated)
- ⚠️ Backward compat: Mitigated via fallback chain
- ⚠️ Prompt bloat: Acceptable for high-value context
- ⚠️ Performance: No additional queries needed

---

## Next Steps

1. **Review this assessment**
2. **Decide**: Full implementation or limited trial?
3. **If proceed**: I can implement all three phases
4. **Test**: Generate comparison posts before/after

**Your call** — should we proceed? 🚀
