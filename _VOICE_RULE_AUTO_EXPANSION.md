# Voice Rule Auto-Expansion: Simple Solution to Translation Gap

## Date: June 15, 2026

## Problem Identified

User insight: "We have a persona that communicates to the owner (critical for customer value), but we may need an AI persona translator for what other AI prompts use."

**The translation gap:**
```
"sofistikeret" (abstract trait - owner understands)
    ↓ 
    ❌ Missing translator
    ↓
"Undgå imperativer" (concrete instruction - AI can execute)
```

## Solution: Auto-Expand Personality Traits at Generation Time

**Kept architecture simple** - no new translator layer needed.

**Instead:** Enhanced voice rule generation to auto-translate traits into operational rules.

### Implementation

**File:** [voice-profile.ts](supabase/functions/_shared/brand-profile/voice-profile.ts)

**New function:** `expandPersonalityTraitsToRules()`

**Mapping logic:**

| Personality Trait | Auto-Generated Operational Rule |
|---|---|
| **sofistikeret/sophisticated/elegant** | "Undgå imperativer som åbning (ikke 'Kom forbi', 'Oplev', 'Tag' — brug deklarative åbninger)" |
| | "Undgå generisk salgssprog: 'perfekt', 'lækker', 'hyggelig', 'nyd', 'unik', 'autentisk'" |
| **moderne/modern** | "Undgå dateret sprog: 'svip', 'tag en pause fra hverdagen', 'varm omfavnelse'" |
| **informal + sofistikeret** | "Balancér venlig informalitet med kvalitetsbevidsthed — undgå både stiv formality OG billig casual-tale" |

### How It Works

```typescript
function buildVoiceFromArchetype(...) {
  // 1. Get base rules from archetype
  const tone_rules = [...archetype.base_rules]
  
  // 2. Extract personality traits
  const personality_traits = [...]
  
  // 3. AUTO-EXPAND traits into concrete rules
  const expandedRules = expandPersonalityTraitsToRules(
    personality_traits, 
    archetype.formality_level
  )
  
  // 4. Append expanded rules
  tone_rules.push(...expandedRules)
  
  // Result: Complete operational guidance
}
```

### Expected Result for Cafe Faust

**Before (current):**
```json
{
  "personality_traits": ["moderne", "indbydende", "sofistikeret"],
  "tone_rules": [
    "Skriv én tanke pr. sætning",
    "Fokusér på tilberedningsmetoder og fusion",
    "Brug lokale referencer til Aarhus og livet ved åen",
    ...
  ]
}
```

**After (with auto-expansion):**
```json
{
  "personality_traits": ["moderne", "indbydende", "sofistikeret"],
  "tone_rules": [
    "Skriv én tanke pr. sætning",
    "Fokusér på tilberedningsmetoder og fusion",
    "Brug lokale referencer til Aarhus og livet ved åen",
    ...
    "Undgå imperativer som åbning (ikke 'Kom forbi', 'Oplev', 'Tag' — brug deklarative åbninger)",
    "Undgå generisk salgssprog: 'perfekt', 'lækker', 'hyggelig', 'nyd', 'unik', 'autentisk'",
    "Undgå dateret sprog: 'svip', 'tag en pause fra hverdagen', 'varm omfavnelse'"
  ]
}
```

## Why This is the Right Solution

✅ **Simple** - No new translator layer, no architectural complexity  
✅ **Scalable** - Works for all businesses automatically  
✅ **Maintainable** - Rules defined in one place (expandPersonalityTraitsToRules)  
✅ **Owner-friendly** - Personality traits still readable by owners  
✅ **AI-executable** - Concrete operational guidance added automatically  

## Cascade Effect

```
Enhanced Voice Rules (Layer 4)
    ↓
good_examples generation (Layer 5b) - sees "Undgå imperativer"
    ↓
good_examples stored in brand profile (clean, declarative)
    ↓
Caption generation (Layer 6-8) - learns from clean examples
    ↓
High-quality captions automatically
```

**No hardcoding needed in caption generation** - quality comes from source.

## Next Steps

1. **Regenerate Cafe Faust brand profile**
   - New voice rules will include auto-expanded trait rules
   
2. **Verify voice rules:**
   ```sql
   -- Run: _CHECK_voice_rules.sql
   -- Should now include "Undgå imperativer" rule
   ```

3. **Check good_examples:**
   ```sql
   -- Run: _FIX2_verify_good_examples_SUPABASE.sql
   -- Should now be declarative, no imperatives
   ```

4. **Test caption generation:**
   - Generate "DEN ENE" Sunday brunch post
   - Should be declarative, concrete, location-anchored
   - No "Kom forbi", "Oplev", "Nyd" etc.

## Integration with Previous Fixes

**Fix 1:** Surfaced tone_dna sub-fields in prompts ✅  
**Fix 2 (revised):** Voice rules auto-expand from traits ✅  
**Fix 2b:** good_examples generation constraints (safety net) ✅  

Together creates **self-teaching quality system.**

## Status

- ✅ Code complete
- ✅ No TypeScript errors
- ⏳ Awaiting brand profile regeneration
- ⏳ Awaiting verification
