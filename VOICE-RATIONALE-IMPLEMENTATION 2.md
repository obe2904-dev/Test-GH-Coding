# Voice Rationale Implementation (v4.12.1)

## Implementation Summary

**Status**: Deployed (pending confirmation)  
**Objective**: Enforce voice_rationale field population to surface AI reasoning transparency  
**User Request**: "As long as the input we have is used, we do not need to surface it all. What is important is the reasoning, which I would like to surface."

---

## Changes Made

### 1. Enhanced Prompt Instructions (prompt-b.ts, line ~1201)

**BEFORE**: Generic bullet-point instructions
```typescript
0) voice_rationale — SKRIV DETTE FØR tone_of_voice
   - List every DATA SOURCE used: menu AI summaries (X periods), location intelligence...
   - Explicitly state text evidence quality...
   - Close with: are the Voice rules "observed" or "assessed"?
```

**AFTER**: Concrete 3-part structure with example
```typescript
0) voice_rationale — ⚠️ OBLIGATORISK — SKRIV DETTE FØR tone_of_voice
   KRAV: 3–6 sætninger i naturligt dansk, som forklarer HVORDAN du kom frem til stemme-reglerne.
   
   STRUKTUR (3 dele — alle obligatoriske):
   1️⃣ DATAKILDER: Nævn konkrete kilder (menu programmes, åbningstider X→Y, location type, operational features)
   2️⃣ TEKSTKVALITET: "Hjemmesiden bruger X ordvalg" (PATH A) vs "Da hjemmesiden har begrænset tekstindhold..." (PATH B)
   3️⃣ KONKLUSION: "observeret fra stedets egen kommunikation" vs "vurderet ud fra stedets koncept"
   
   ✅ KONKRET EKSEMPEL (PATH B):
   "Datagrundlaget består af 5 menu-programmer (BRUNCH, FROKOST, AFTEN, COCKTAILS, BØRNEMENU), 
   åbningstider 09:30-02:00 (weekend bekræfter senprogrammer), samt location intelligence (vandfront ved åen...). 
   Da hjemmesiden har begrænset tekstindhold, er stemme-reglerne udledt fra multi-program karakteren (morgen til nat), 
   vandfront-specificiteten, og familievenlige features (børnemenu, udendørs servering). 
   Stemme-reglerne er derfor vurderet ud fra stedets koncept — ikke fra direkte tekstprøver."
```

**Impact**: AI now has clear format, minimum length (3-6 sentences), and real example showing what to write

---

### 2. Validation Enforcement (validators.ts, lines ~1240-1255)

**NEW VALIDATION**:
```typescript
// v4.12.1: Enforce REQUIRED fields (voice_rationale, business_character)

// 1) voice_rationale — AI's explanation of how voice was derived from data
if (!brandProfile.voice_rationale || 
    typeof brandProfile.voice_rationale !== 'string' || 
    brandProfile.voice_rationale.trim().length === 0) {
  errors.push('[FINAL] 🚫 HARD ERROR: voice_rationale is required (must explain how voice was derived from data sources)')
} else if (brandProfile.voice_rationale.trim().length < 50) {
  errors.push('[FINAL] ⚠️ voice_rationale too short (minimum 50 chars, needs 3-6 sentences)')
}

// 2) business_character — Required in schema line 515
if (!brandProfile.business_character || 
    typeof brandProfile.business_character !== 'string' || 
    brandProfile.business_character.trim().length === 0) {
  errors.push('[FINAL] 🚫 HARD ERROR: business_character is required (schema line 515)')
}
```

**Impact**: Empty voice_rationale or business_character = HARD ERROR → triggers repair cycle → forces AI to populate

---

## Expected Output Format

For Café Faust, the AI should now generate something like:

```
voice_rationale: "Datagrundlaget består af 5 menu-programmer (BRUNCH, FROKOST, AFTEN, 
COCKTAILS, BØRNEMENU), åbningstider 09:30-02:00 (weekend bekræfter nat-karakter), samt 
location intelligence (vandfront ved åen, bymidte-sekundær, tourist context). Da hjemmesiden 
har begrænset tekstindhold, er stemme-reglerne udledt fra multi-program karakteren 
(morgen til nat), vandfront-specificiteten, og familievenlige features (børnemenu, 
udendørs servering). Stemme-reglerne er derfor vurderet ud fra stedets koncept og 
situationelle signaler — ikke fra direkte tekstprøver."
```

This **opens the black box** by explaining:
1. **What data** was available (5 programmes, 09:30→02:00 hours, waterfront, kids_menu)
2. **How AI interpreted it** (multi-program = morgen til nat, waterfront + tourist context)
3. **PATH taken** (situational signals, not observed text patterns)

---

## UX Philosophy Alignment

**User's vision**: "As long as the input we have is used, we do not need to surface it all. What is important is the reasoning."

**Implementation aligns**:
- ✅ **ONE explanation** instead of raw data tables (opening hours, operations features)
- ✅ **AI's reasoning chain** surfaced in natural Danish for business owners
- ✅ **Transparency** without code changes (no UI work needed, field already exists in schema)
- ✅ **3-6 sentence format** = scannable, not overwhelming

---

## Deployment Status

**Files modified**:
1. `supabase/functions/_shared/brand-profile/prompts/prompt-b.ts` (enhanced instructions)
2. `supabase/functions/_shared/brand-profile/validators.ts` (added hard error checks)

**Deployment command**: `npx supabase functions deploy brand-profile-generator`  
**Status**: In progress (bundling ~1.3MB function)

---

## Testing Plan (Next Step)

Once deployment completes:

1. **Regenerate Café Faust** brand profile
2. **Check voice_rationale field** in output (should be 3-6 sentences)
3. **Verify business_character** also populated (was null before)
4. **Count soft errors**: Should drop from 3→1 (business_character + voice_rationale fixes = 2 of 3 errors)
5. **Quality assessment**: voice_rationale should reference "5 menu-programmer", "09:30-02:00", "vandfront ved åen"

---

## Integration with VOICE-REASONING-ANALYSIS.md

This implementation **realizes the recommendations** from the analysis:

**VOICE-REASONING-ANALYSIS.md Priority 1**:
> "Populate voice_rationale (5 min fix) ⭐ CRITICAL  
> The voice_rationale field exists in schema (required line 515) but returns empty string.  
> User wants to see explanation: 'Stemmereglerne er primært udledt af stedets heldagsdrift...'"

**Implementation status**: ✅ Complete  
**Enforcement**: Hard error if empty or <50 chars  
**Format**: 3-part structure (data sources → text quality → observed vs assessed)

---

## Known Issues (Remaining)

After this fix, **1 soft error** will likely remain:

**brand_essence offering cue validator** (brand_essence proof validation):
- **Problem**: Validator expects single offering keyword but brand_essence contains full offering arc
- **Example error**: "proof does not reference Prompt A hooks/phrases (too generic)"
- **Fix needed**: Adjust regex to accept meal arcs like "brunch og frokost til aftensmad"
- **Priority**: Medium (doesn't block quality, just validation strictness)

---

## Version Metadata

- **Version**: v4.12.1
- **Date**: 2025-01-XX
- **Author**: AI implementation per user approval
- **User quote**: "Yes" (approval to implement voice_rationale enforcement)
- **Philosophy**: "What is important is the reasoning, which I would like to surface"
