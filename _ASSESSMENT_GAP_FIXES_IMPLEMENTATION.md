# Gap Fixes Assessment: generate-text-from-idea Prompt Improvements
**Date**: 2026-06-15  
**Function**: `supabase/functions/generate-text-from-idea/`  
**Reference**: `/Users/olebaek/Downloads/copilot-instructions-gap-fixes.md`

## Executive Summary

The improvement document identifies 5 critical gaps between brand profile data (V5 JSONB) and what reaches the AI prompt in `buildPrompt`. This assessment evaluates current implementation status and identifies remaining work.

**Status Overview:**
- ✅ **Fix 1** (humor_style): **IMPLEMENTED**
- ✅ **Fix 2** (tone_rules): **IMPLEMENTED**  
- ✅ **Fix 3** (tone DNA sections): **IMPLEMENTED**
- ❌ **Fix 4** (geographic_context.narrative): **NOT IMPLEMENTED**
- ❌ **Fix 5** (full content_angles array): **NOT IMPLEMENTED**

---

## Fix 1 — Wire `humor_style` from V5 voice ✅ COMPLETE

### Proposed Fix
Read `brand_profile_v5.voice.humor_style` instead of flat `humor_level` column (which is null for all V5 businesses).

### Current Implementation

**File**: [resolve-context.ts](supabase/functions/generate-text-from-idea/resolve-context.ts#L427)

```typescript
// Line 427
humorLevel = v5Voice.humor_style || 'moderate'
```

**Status**: ✅ **Already implemented correctly**

The code extracts `humor_style` from `brand_profile_v5.voice` and sets it on `BusinessContext.humorLevel`. For Café Faust, this correctly reads `"playful"`.

**Evidence**:
- Log line 431: `humor_style: humorLevel` confirms extraction
- Value is passed to prompt via `humor_style` parameter (line 566)

---

## Fix 2 — Use `tone_rules` as `brandWritingRules` ✅ COMPLETE

### Proposed Fix
Prioritize `brand_profile_v5.voice.tone_rules` (10 authoritative rules) over legacy `tone_model.writing_rules` (null for V5).

### Current Implementation

**File**: [resolve-context.ts](supabase/functions/generate-text-from-idea/resolve-context.ts#L446-L460)

```typescript
// Merge structural rules (tone_rules) + strategic rules (tone_do_list)
const v5ToneRules = Array.isArray(v5Voice.tone_rules) 
  ? v5Voice.tone_rules.filter((s: any) => typeof s === 'string')
  : []
const toneDNARules = Array.isArray(tone_dna.tone_do_list)
  ? tone_dna.tone_do_list.filter((s: any) => typeof s === 'string')
  : []

// V5.5 rules override legacy tone_model.writing_rules
if (v5ToneRules.length > 0 || toneDNARules.length > 0) {
  brandWritingRules = [...v5ToneRules, ...toneDNARules]
  console.log('✅ V5.5 brandWritingRules merged:', {
    tone_rules: v5ToneRules.length,
    tone_do_list: toneDNARules.length,
    total: brandWritingRules.length
  })
}
```

**Status**: ✅ **Already implemented correctly**

The code correctly:
1. Extracts `tone_rules` from V5 voice
2. Merges with `tone_dna.tone_do_list` (strategic rules)
3. Overrides legacy `tone_model.writing_rules` when V5 rules exist
4. Logs the merge for verification

For Café Faust, this yields 10 rules including critical guardrails like:
- "Skriv én tanke pr. sætning — stop før du forklarer for meget"
- "Undgå imperativer som åbning"
- "Undgå generisk salgssprog: 'perfekt', 'lækker', 'hyggelig'"

---

## Fix 3 — Surface `tone_dna` sub-fields as explicit sections ✅ COMPLETE

### Proposed Fix
Extract `tone_dna` sub-fields and render them as explicit named prompt sections instead of passing whole object.

### Current Implementation

**File**: [prompt-builders.ts](supabase/functions/generate-text-from-idea/prompt-builders.ts#L674-L705)

```typescript
// ═══ TONE DNA BLOCK ═══
const toneDNABlock: string[] = []

if (tone_dna_summary) {
  toneDNABlock.push(`STRATEGISK TONE:\n${tone_dna_summary}`)
}

if (tone_do_list && tone_do_list.length > 0) {
  toneDNABlock.push(`TONE — GØR DETTE:\n${tone_do_list.map(r => `- ${r}`).join('\n')}`)
}

if (tone_dont_list && tone_dont_list.length > 0) {
  toneDNABlock.push(`TONE — UNDGÅ DETTE:\n${tone_dont_list.map(r => `- ${r}`).join('\n')}`)
}

if (location_natural_vocab && location_natural_vocab.length > 0) {
  toneDNABlock.push(`FORETRUKKET LOKATIONS-VOKABULAR: ${location_natural_vocab.join(', ')}`)
}

if (location_avoid_vocab && location_avoid_vocab.length > 0) {
  toneDNABlock.push(`UNDGÅ DISSE ORD (clasher med lokation): ${location_avoid_vocab.join(', ')}`)
}

if (humor_style && humor_style !== 'none') {
  const humorMap: Record<string, string> = {
    playful: 'Let og lidt selvironisk — aldrig på bekostning af maden eller stedet',
    dry: 'Tør og afdæmpet — brug sparsomt',
    warm: 'Varm og inkluderende — ingen jokes',
    none: ''
  }
  const humorInstruction = humorMap[humor_style] || humor_style
  if (humorInstruction) {
    toneDNABlock.push(`HUMOR: ${humorInstruction}`)
  }
}

const toneDNASection = toneDNABlock.length > 0
  ? `\n\n${toneDNABlock.join('\n\n')}`
  : ''
```

**Status**: ✅ **Already implemented correctly**

The code creates explicit named sections for:
- Strategic summary (`tone_dna.strategic_summary`)
- Do-list rules (`tone_dna.tone_do_list`)
- Don't-list prohibitions (`tone_dna.tone_dont_list`) ← **Critical for preventing abstract/poetic drift**
- Location natural vocabulary (`tone_dna.location_driver.natural_vocabulary`)
- Location avoid vocabulary (`tone_dna.location_driver.avoid_vocabulary`)
- Humor style instruction

These are injected into the system prompt **after** `business_identity_persona` and **before** other writing rules.

For Café Faust, the `tone_dont_list` includes:
- "Undgå abstrakt/poetisk sprog (ejer bruger konkret stil)"
- "Undgå formal/fine-dining tone"
- "Undgå at ignorere location USP"

**This is the most critical fix for preventing tone drift in non-food posts.**

---

## Fix 4 — Use `geographic_context.narrative` for atmosphere posts ❌ NOT IMPLEMENTED

### Proposed Fix
Extract `brand_profile_v5.layer_0_intelligence.geographic_context.narrative` and inject it ONLY for atmosphere/non-food posts.

For Café Faust, this contains:
```
"Fremhæv rolig å-stemning og natur. Konkrete å-referencer (åen, strømmen, grønne bredder).
Undgå marine referencer (bølger, hav, maritim, havnelugt).
Casual leisure tone med naturforankring. Sæson/vejr relevant (foraar, sol over åen)."
```

### Gap Analysis

**What exists**:
- `tone_dna.location_driver.natural_vocabulary` is extracted (line 466 resolve-context.ts)
- `tone_dna.location_driver.avoid_vocabulary` is extracted (line 478 resolve-context.ts)

**What's missing**:
- `layer_0_intelligence.geographic_context.narrative` is **NOT** extracted
- No field `locationIntelligenceNarrative` on `BusinessContext`
- No conditional injection for atmosphere posts in `prompt-builders.ts`

### Impact
Medium-High. The location vocabulary lists (`natural_vocabulary`, `avoid_vocabulary`) partially cover this, but the **narrative** provides critical **Danish-language guidance** about what tone and references to use for this specific location type. 

For Café Faust atmosphere posts, the narrative explicitly bans "marine referencer (bølger, hav, maritim, havnelugt)" — this is **location-specific intelligence** not captured in generic avoid lists.

### Implementation Required

#### Step 1: Extract narrative in `resolve-context.ts`

After line 500 (where tone_dna is logged), add:

```typescript
// Extract geographic_context.narrative for atmosphere/location posts
const geoNarrative = brandProfileV5
  ?.layer_0_intelligence
  ?.geographic_context
  ?.narrative
  || null

if (geoNarrative) {
  console.log('✅ Geographic narrative extracted:', geoNarrative.substring(0, 100))
}
```

Add to `BusinessContext` return (around line 560):

```typescript
locationIntelligenceNarrative: geoNarrative,
```

#### Step 2: Add to type definitions in `types.ts`

Add to `BusinessContext`:
```typescript
locationIntelligenceNarrative?: string | null
```

Add to `PromptOptions`:
```typescript
locationIntelligenceNarrative?: string | null
```

#### Step 3: Inject in `prompt-builders.ts`

After the `toneDNASection` injection (around line 707), add:

```typescript
// ONLY inject geo narrative for atmosphere/non-food posts where location IS the content
const isAtmospherePost = ['atmosphere', 'behind_scenes', 'team_people', 'general_invitation']
  .includes(contentType || '')

const geoNarrativeBlock = locationIntelligenceNarrative && isAtmospherePost
  ? `\n\nLOKATIONSKONTEKST (gælder især for stemnings- og stedsposter):\n${locationIntelligenceNarrative}`
  : ''
```

Inject `geoNarrativeBlock` into system prompt after tone DNA section.

---

## Fix 5 — Pass full `content_angles` array per active segment ⚠️ REQUIRES ADDITIONAL INFRASTRUCTURE

### Proposed Fix
Pass all 2-3 content angles from `business_programme_profiles.audience_segments[].content_angles` instead of just the first one.

For Café Faust lunch segment, this includes:
- "Hurtig frokost ved åen"
- "Lækre frokostretter til travle dage"
- "Frisklavet Faustburger til frokost"

### Gap Analysis

**What exists**:
- `activeSegmentName`, `activeSegmentMotivation`, and `activeSegmentAngle` are defined in `PromptOptions` interface
- These fields are passed from `biz` object to `buildPrompt` in index.ts (line 202-204)

**What's missing**:
- `activeSegmentName`, `activeSegmentMotivation`, `activeSegmentAngle` are **NOT** defined in `BusinessContext` interface (resolve-context.ts)
- No query to `business_programme_profiles` table in `fetchBusinessContext`
- No logic to determine "active segment" based on day/hour
- No field `activeSegmentAngles` (plural) anywhere in codebase

### Impact
Medium. This fix requires implementing a full audience segmentation system that:
1. Fetches `business_programme_profiles` data
2. Determines which segment is active based on current day/time
3. Extracts segment data including full `content_angles` array

This is a **larger architectural change** than the other fixes, not just a data extraction gap.

### Implementation Required

This fix is **more complex than initially assessed**. It requires:

#### Step 1: Add segment fields to BusinessContext

```typescript
// In resolve-context.ts BusinessContext interface
activeSegmentName?: string | null
activeSegmentMotivation?: string | null
activeSegmentAngle?: string | null
activeSegmentAngles?: string[] | null  // NEW: full array
```

#### Step 2: Fetch programme profiles and determine active segment

In `fetchBusinessContext`, add query (around line 150):

```typescript
// Fetch programme profiles to determine active audience segment
const { data: programmeProfiles } = await supabase
  .from('business_programme_profiles')
  .select('programme_type, audience_segments, time_windows, operating_days')
  .eq('business_id', businessId)

let activeSegmentName = null
let activeSegmentMotivation = null
let activeSegmentAngle = null
let activeSegmentAngles = null

if (programmeProfiles && programmeProfiles.length > 0 && timingDay) {
  // Determine active programme based on timingDay and current hour
  // This logic needs to parse time_windows and operating_days
  // For now, simplified: find first programme matching timingDay
  const currentDay = timingDay || dayNames[new Date().getDay()]
  
  for (const profile of programmeProfiles) {
    const operatingDays = profile.operating_days || []
    if (operatingDays.includes(currentDay)) {
      const segments = profile.audience_segments || []
      if (segments.length > 0) {
        const firstSegment = segments[0]  // TODO: Smart matching by hour
        activeSegmentName = firstSegment.segment_name
        activeSegmentMotivation = firstSegment.motivation
        activeSegmentAngles = firstSegment.content_angles || []
        activeSegmentAngle = activeSegmentAngles[0] || null
        break
      }
    }
  }
}
```

#### Step 3: Return segment fields from fetchBusinessContext

```typescript
return {
  // ... existing fields ...
  activeSegmentName,
  activeSegmentMotivation,
  activeSegmentAngle,
  activeSegmentAngles,
}
```

#### Step 4: Pass activeSegmentAngles to prompt (already done in types.ts)

The PromptOptions interface already has these fields defined.

#### Step 5: Inject in prompt-builders.ts

Replace single angle with multi-angle block (as specified in original improvement doc).

### Recommendation

**Do NOT implement Fix 5 in current session** without:
1. Understanding the full programme profile data model
2. Knowing the business logic for "active segment" determination
3. Testing against real programme_profiles data

This should be a separate task with its own planning and testing phase.

---

## Priority Recommendations

| Fix | Priority | Status | Effort | Impact |
|-----|----------|--------|--------|--------|
| Fix 1 — humor_style | ✅ Complete | Implemented | — | — |
| Fix 2 — tone_rules | ✅ Complete | Implemented | — | — |
| Fix 3 — tone DNA sections | ✅ Complete | Implemented | — | — |
| **Fix 4 — geo narrative** | **HIGH** | **Not Implemented** | **Low** (4 lines + type defs) | **High** for atmosphere posts |
| Fix 5 — content_angles array | Medium | Not Implemented | Low (3 lines + type defs) | Medium (variety improvement) |

### Next Actions

1. **Implement Fix 4 first** — Geo narrative is location-specific Danish guidance critical for atmosphere posts. Low effort, high impact.

2. **Implement Fix 5 second** — Content angles array provides better post variety. Low effort, medium impact.

3. **Verification test** (after both fixes):
   - Trigger Café Faust atmosphere post with `contentType: "atmosphere"`
   - Enable `DEBUG_PROMPT_LOGGING=true` in Supabase env vars
   - Verify system prompt contains:
     - ✅ Geo narrative: "Fremhæv rolig å-stemning... Undgå marine referencer..."
     - ✅ Multiple content angles if available for active segment

### Critical Success Metrics

After implementing Fixes 4 & 5, atmosphere posts should:
- ✅ Use correct location vocabulary ("ved åen", "udeservering") — NOT wrong terms ("terrasse", "havneluft")
- ✅ Open with declarative statements — NOT imperatives ("Kom forbi", "Oplev")
- ✅ Avoid abstract/poetic language ("når solen står op", "en stille stund")
- ✅ Contain 3-5 sentences with concrete nouns throughout

---

## Conclusion

**3 of 5 fixes are already implemented** — the most critical ones (tone rules, tone DNA sections, humor style). The codebase is already reading V5 JSONB correctly and surfacing tone prohibitions as explicit prompt instructions.

**2 remaining fixes** (geo narrative, content angles) are both **low-effort, high-value** additions that require:
- 8 lines of extraction code
- 4 type definition additions
- 2 prompt injection blocks

**Estimated implementation time**: 15-20 minutes for both fixes.

**Recommendation**: Implement both fixes in a single commit, deploy, and run verification test with Café Faust atmosphere post.

---

## IMPLEMENTATION SUMMARY — 2026-06-15

### ✅ Completed: Fix 4 (Geographic Context Narrative)

**Status**: Fully implemented and ready to deploy

**Changes Made**:
1. **resolve-context.ts**:
   - Extract `geographic_context.narrative` from `brand_profile_v5.layer_0_intelligence`
   - Add to BusinessContext interface
   - Return in fetchBusinessContext

2. **types.ts**:
   - Add `locationIntelligenceNarrative` to PromptOptions

3. **prompt-builders.ts**:
   - Add conditional geo narrative block for atmosphere posts only
   - Inject into Danish prompt template

4. **index.ts**:
   - Pass `locationIntelligenceNarrative` from BusinessContext to buildPrompt

**Impact**: For Café Faust atmosphere/location posts, the prompt will now include:
```
LOKATIONSKONTEKST (gælder især for stemnings- og stedsposter):
Fremhæv rolig å-stemning og natur. Konkrete å-referencer (åen, strømmen, grønne bredder).
Undgå marine referencer (bølger, hav, maritim, havnelugt).
```

### ⚠️ Deferred: Fix 5 (Full Content Angles Array)

**Status**: Requires additional infrastructure

**Reason**: The `business_programme_profiles` table is not currently queried in `fetchBusinessContext`. Implementing this requires understanding the full programme profile data model and business logic for active segment selection.

**Recommendation**: Make this a separate, properly scoped task.

### Deployment

```bash
npx supabase functions deploy generate-text-from-idea
```

### Files Changed

- supabase/functions/generate-text-from-idea/resolve-context.ts
- supabase/functions/generate-text-from-idea/types.ts  
- supabase/functions/generate-text-from-idea/prompt-builders.ts
- supabase/functions/generate-text-from-idea/index.ts

