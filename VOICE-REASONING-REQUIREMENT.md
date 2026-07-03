# VOICE REASONING REQUIREMENT

**Date:** May 6, 2026  
**Context:** Sprint 2 Planning - Voice Field Reduction  
**Decision:** Keep `voice_rationale` field (reversal from initial cut plan)

---

## Executive Summary

**Original Sprint 2 Plan:** Cut `voice_rationale` as "metadata only" (13 → 5 voice fields)  
**Revised Sprint 2 Plan:** Keep `voice_rationale` as transparency field (13 → 6 voice fields)  

**Reason:** AI must explain WHY it made voice decisions, not just generate them blindly.

---

## Problem Statement

When AI generates a brand voice profile, the owner sees the output but has no visibility into:
1. **What evidence** AI used to derive the voice
2. **Why** AI chose casual vs. formal tone
3. **Whether** AI understood the business correctly
4. **Which signals** (website, menu, location) influenced decisions

**Risk without reasoning:**
- Owner can't validate if AI misunderstood the business
- No way to debug when voice feels "off"
- Black box = low trust = manual overrides = reduced AI value

---

## Solution: voice_rationale Field

### What It Contains

2-3 sentences explaining voice derivation with evidence:

**Example 1 (Casual Café):**
```
"Tone er afslappet baseret på website-sprog ('kom forbi', 'hyggelig') 
og menukort-stil (ingen fine dining-termer). Nærværende fordi café 
ligger i boligkvarter uden turist-fokus."
```

**Example 2 (Fine Dining):**
```
"Tone er professionel baseret på website-beskrivelse ('exquisite', 
'curated menu') og pris-niveau (retter 350-500kr). Fokus på madoplevelse 
fremfor casual samvær."
```

**Example 3 (Hybrid Venue):**
```
"Tone skifter mellem casual (brunch/frokost) og elegant (aften). 
Website bruger 'afslappet atmosfære' om dagen og 'sofistikeret' om aftenen. 
Menu-programmer understøtter dual-identity."
```

### Key Elements

1. **Tone decision** (casual/professional/elegant) + evidence
2. **Signal sources** (website phrases, menu language, price level)
3. **Location context** (neighborhood type, tourist area, etc.)
4. **Business model** (quick service vs. destination dining)

---

## Why This Is Critical

### 1. Owner Trust & Validation
- Owner can verify: "Yes, we do say 'kom forbi' not 'besøg os'"
- If reasoning is weak/wrong, owner knows voice may be wrong
- Transparency builds confidence in AI decisions

### 2. Quality Gate
- **Strong reasoning:** "Casual tone based on 12 menu items using 'lækker', 'hjemmelavet', 'nybagt'"
- **Weak reasoning:** "Casual tone based on general café vibes"
- If AI can't justify voice, it's probably generic/wrong

### 3. Debugging Hallucinations
- When voice feels off, owner can check reasoning
- Example: "AI said formal because it saw 'Copenhagen' on website, but we're a neighborhood café"
- Pinpoints where AI misread signals

### 4. Manual Refinement
- Owner can correct specific misunderstandings
- Example: "AI thought we're tourist-focused because of waterfront location, but we're actually locals-only"
- Reasoning makes feedback actionable

---

## Updated Sprint 2 Plan

### Voice Fields to KEEP (6 total)

1. **tone_of_voice** - Narrative writing rules
2. **tone_model.good_examples** - Concrete style examples
3. **never_say** - Hard constraints (banned words)
4. **voice_constraints** - Absolute rules (emoji policy, etc.)
5. **signature_phrases** - Brand-specific language
6. **voice_rationale** - WHY AI chose this voice ⭐ **NEW**

### Voice Fields to CUT (7 total)

1. **typical_openings** - Auto-extracted from tone_of_voice examples
2. **typical_closings** - Redundant cache
3. **voice_examples** - Duplicates tone_model.good_examples
4. **tone_keywords** - Unused quick-reference tags
5. **recognizable_interior_identity** - Image context, not voice
6. **venue_scene** - Image context, not voice
7. **visual_character** - Image context, not voice

### Impact

- **Columns removed:** 7 (down from 8 in original plan)
- **Voice fields kept:** 6 (up from 5 in original plan)
- **Reduction:** 13 → 6 (54% reduction, down from 62%)
- **Quality gain:** Transparency, trust, debuggability

---

## Implementation Requirements

### 1. Prompt Enhancement

Stage B (Brand Profile Generation) must include reasoning output:

```typescript
// Add to Stage B prompt
`
### 6. voice_rationale
Explain in 2-3 sentences WHY you chose this tone of voice.

Include:
- Specific evidence from website (quote exact phrases)
- Menu language signals (formal vs. casual terms)
- Location context (neighborhood type, tourist area)
- Price level signals (if relevant)

Example: "Tone er afslappet baseret på website-sprog ('kom forbi', 'hyggelig') 
og menukort-stil (ingen fine dining-termer). Nærværende fordi café ligger i 
boligkvarter uden turist-fokus."
`
```

### 2. Validation

**Quality checks:**
- voice_rationale must be 50-300 characters
- Must contain at least one quoted evidence phrase
- Must reference at least one signal source (website/menu/location)
- Cannot be generic ("chose casual because it's a café")

**Fallback:**
```typescript
if (!voice_rationale || isGeneric(voice_rationale)) {
  voice_rationale = buildVoiceRationaleFallback(dataSources)
  // "Tone baseret på ${businessType} kategori og ${location} placering"
}
```

### 3. Frontend Display

**Dashboard section:**
```tsx
{profile.voice_rationale && (
  <details className="mt-4 group">
    <summary className="cursor-pointer">
      💡 Hvorfor valgte AI denne stemme?
    </summary>
    <div className="mt-2 p-3 bg-surface-alt rounded">
      <p className="text-sm">{profile.voice_rationale}</p>
    </div>
  </details>
)}
```

**Position:** Under "Stemme" (Voice) section, collapsed by default

---

## Success Metrics

**Transparency:**
- [ ] 100% of profiles have voice_rationale populated
- [ ] 90%+ of rationales include quoted evidence
- [ ] 80%+ of rationales reference 2+ signal sources

**Quality:**
- [ ] Generic rationale rate < 5% ("based on café category")
- [ ] Owner satisfaction with voice increases (survey)
- [ ] Manual override rate decreases (AI gets it right more often)

**Trust:**
- [ ] Owners report understanding AI decisions
- [ ] Debugging time reduced when voice feels wrong
- [ ] Confidence in AI voice generation increases

---

## Examples: Good vs. Bad Rationale

### ✅ Good Rationale (Specific Evidence)

**Café in Vesterbro:**
```
"Afslappet tone valgt baseret på website-fraser ('kom forbi', 'hyggelig') 
og menukort uden fancy termer. Lokal fokus fordi kvarter-placering og 
ingen turist-signaler i beskrivelse."
```

**Fine Dining:**
```
"Professionel tone baseret på website ('exquisite ingredients', 'curated menu') 
og pris-niveau (hovedretter 350-500kr). Destination-restaurant fremfor 
casual sted."
```

**Bakery Chain:**
```
"Venlig men energisk tone. Website bruger imperatives ('Prøv', 'Smag') og 
hurtig-service signaler. Kæde-struktur betyder konsistent voice på tværs."
```

### ❌ Bad Rationale (Generic, No Evidence)

**Generic:**
```
"Casual tone because it's a café in Copenhagen."
```
*Problem: No specific evidence, could apply to any café*

**Circular:**
```
"Friendly tone chosen because the business seems friendly."
```
*Problem: Doesn't explain what signals indicated "friendly"*

**Vague:**
```
"Tone matches the business type and location."
```
*Problem: No actionable evidence owner can verify*

---

## Migration Path

### Phase 1: Code Update (Sprint 2)
1. Update Stage B prompt to request voice_rationale
2. Add validation for voice_rationale output
3. Update frontend to display rationale (collapsed section)

### Phase 2: Backfill Existing Profiles
1. Regenerate voice_rationale for all existing profiles (background job)
2. Use deterministic fallback for profiles missing source data
3. Flag profiles with weak rationale for manual review

### Phase 3: Quality Improvement
1. Monitor rationale quality (generic rate, evidence inclusion)
2. Tune prompt if rationale quality < 90%
3. Add examples to prompt for better reasoning

---

## Related Documentation

- [BRAND-PROFILE-SYSTEM-OVERVIEW.md](BRAND-PROFILE-SYSTEM-OVERVIEW.md) - Main system docs (Sprint 2 section updated)
- [SPRINT-1-IMPLEMENTATION-SUMMARY.md](SPRINT-1-IMPLEMENTATION-SUMMARY.md) - Sprint 1 results
- [SPRINT-2-PRE-DEPLOYMENT-CHECKLIST.md](SPRINT-2-PRE-DEPLOYMENT-CHECKLIST.md) - To be created

---

**Conclusion:** Keeping `voice_rationale` is not just about metadata—it's about trust, transparency, and quality. AI decisions are only valuable if owners can understand and validate them.
