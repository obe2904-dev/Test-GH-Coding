# Fix 2 Complete: Brand Profile Quality Constraints

## Date: June 15, 2026

## What Was Fixed

### Problem Identified
Your key insight: **"What we need is good texts that fits the business. We should avoid hardcoding, unless it is best way to teach AI in Brand profile what is expected."**

The issue was that Fix 2 only improved `typical_openings` (which aren't actually used in caption generation), but `good_examples` (which ARE used) still lacked quality constraints.

### Data Flow Discovery
```
Brand Profile Generation (writing-examples.ts)
├─ typical_openings → stored but NOT used in captions ❌
└─ good_examples → DIRECTLY injected into caption prompts ✅
   
Caption Generation (generate-text-from-idea)
└─ Learns from good_examples → if examples have imperatives, captions have imperatives
```

### Solution Implemented

**Enhanced `aiGenerateGoodExamples()` prompt with 6 critical quality constraints:**

1. **NO IMPERATIVES as opening words**
   - Forbidden: Start, Kom, Oplev, Tag, Vælg, Prøv, Nyd, Book, Se, Smag
   - Required: Declarative openings with concrete details

2. **LENGTH: 300-450 characters** (including emojis and CTA)

3. **CONCRETE DETAILS over abstractions**
   - Avoid: "lækker", "perfekt", "autentisk", "passion"
   - Use: Precise descriptions of preparation, ingredients, setting

4. **ONE THOUGHT PER SENTENCE**
   - Short, clear statements
   - No long compound constructions

5. **PREPARATION/PROCESS visibility**
   - Show how things are made: "Steges langsomt i smør"
   - Not just result: "lækker bøf"

6. **NATURAL DANISH**
   - Avoid tourist brochure language
   - No generic sales pitches

## Files Modified

1. **[writing-examples.ts](supabase/functions/_shared/brand-profile/writing-examples.ts#L638-L698)**
   - Enhanced `aiGenerateGoodExamples()` Danish prompt (lines ~638-670)
   - Enhanced `aiGenerateGoodExamples()` English prompt (lines ~672-698)
   - Added 🚨 CRITICAL QUALITY REQUIREMENTS section to both

## Verification Scripts Created

1. **[_FIX2_verify_good_examples_SUPABASE.sql](_FIX2_verify_good_examples_SUPABASE.sql)**
   - Check `good_examples` structure (count)
   - Check quality: imperatives, generic words, location anchors, concrete details
   - Check lengths (should be 100-500 chars per example)

## Next Steps

### 1. Deploy Code Changes
Ensure the updated `writing-examples.ts` is deployed to Supabase Edge Functions.

### 2. Regenerate Cafe Faust Brand Profile
Run the brand profile generator to create new `good_examples` with quality constraints.

### 3. Verify Results
Run verification script:
```sql
-- In Supabase SQL Editor:
_FIX2_verify_good_examples_SUPABASE.sql
```

**Expected good result:**
```json
{
  "good_examples": [
    "Pariserbøf med bearnaise og pommes frites. Steges rosa i smør, serveres ved Aarhus Å. Klar fra kl. 17:30. Book bord 📞",
    "Morgenbrød bages hver dag kl. 6. Frisktrukket kaffe ved siden af. Start dagen ved åen. ☕",
    "Fredagsaften. Jazz spiller lavt, vandet glitrer udenfor. Book dit bord nu. 🎵"
  ]
}
```

**Bad result (would need regeneration):**
```json
{
  "good_examples": [
    "Kom og oplev vores lækre Pariserbøf! Perfekt til dig...",  // ❌ Imperatives
    "Nyd den autentiske café-oplevelse...",  // ❌ Generic
    "Tag en pause fra hverdagen..."  // ❌ Imperative opening
  ]
}
```

### 4. Test Caption Generation
Once `good_examples` pass verification:
- Generate a post for "DEN ENE" (Sunday brunch)
- Check if caption is declarative, location-anchored, concrete
- Verify no forbidden words appear

### 5. If Caption Quality Improves
✅ Fix 2 is successful - the AI learns from clean examples  
✅ Proceed to Fix 3 (multi-angle content_angles support)

## Why This Approach is Correct

Following your principle: **"avoid hardcoding unless it's best way to teach AI in Brand profile"**

- ✅ Quality rules are in **brand profile generation** (teaching phase)
- ✅ `good_examples` teach the desired pattern
- ✅ Caption generation learns from examples (no hardcoding needed)
- ✅ Single source of truth: well-crafted `good_examples`

This creates a **self-reinforcing quality system** where:
1. Brand profile generator creates high-quality examples
2. Caption generator learns from those examples
3. Generated captions match the quality standard
4. No need for redundant rules in caption generation prompts

## Integration with Fix 1

**Fix 1:** Surfaced `tone_dna` sub-fields in caption prompts  
**Fix 2:** Ensured brand profile examples are high-quality  

Together these create:
- Strategic tone guidance from `tone_dna`
- Concrete demonstration from `good_examples`
- Complete brand voice consistency

## Status

- ✅ Code changes complete
- ✅ No TypeScript errors
- ⏳ Awaiting deployment and brand profile regeneration
- ⏳ Awaiting verification test results
