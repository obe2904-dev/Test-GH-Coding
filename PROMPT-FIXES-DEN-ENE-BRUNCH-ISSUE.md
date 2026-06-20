# Prompt System Fixes: Den Ene Brunch Post Issues

**Date:** 2026-06-14  
**Issue:** "Den ene: Skyr med æblekompot" post misrepresents comprehensive brunch offering and violates brand voice guidelines

---

## Issues Identified

### Issue 1: Title doesn't reflect full brunch value
- **Problem:** Title "Den ene: Skyr med æblekompot" highlights only 1 of 12+ components
- **Menu Item:** "DEN ENE" = 189 DKK all-inclusive brunch with: Skyr, Spejlæg, Brunchpølser, Milanopølse, Kalvepølse, Serrano, Lakserillette, Avocado, Gulerodskake, Frisk frugt, Brød
- **Impact:** Customers think they're getting a simple yogurt bowl, not understanding the comprehensive offering

### Issue 2: Caption violates brand voice guardrails
**Generated text:**
> "Søndag morgen på Cafe Faust er som at få en varm omfavnelse. Vores skyr med æblekompot og hjemmelavet granola er en symfoni af sødme og knasende tekstur, perfekt til den morgenfriske brunchgæst. Uanset vejret udenfor, skaber vi den perfekte ramme til afslapning. Vi har åbent."

**Violations:**
1. ✗ **"perfekt"** - Explicitly forbidden word (should use "velafbalanceret" or delete)
2. ✗ **"som at få en varm omfavnelse"** - Vague emotional metaphor (violates Rule 1: focus on preparation methods)
3. ✗ **"en symfoni af sødme"** - Pretentious, not aligned with "tilgængelig" personality
4. ✗ Missing **preparation methods** (Rule 1: "Fokusér på tilberedningsmetoder og lokale råvarer")
5. ✗ Missing **Aarhus/å references** (Rule 2)
6. ✗ Not **one thought per sentence** (Rule 3)
7. ✗ No **value demonstration** (Rule 6) - critical for 189 DKK all-inclusive offering

---

## Files Modified

### 1. `/supabase/functions/_shared/post-helpers/strategy/phase2/phase2b.ts`

**Change:** Enhanced menu item detection to identify comprehensive all-inclusive offerings

**What was added:**
```typescript
// Detect comprehensive offerings: 3+ items separated by commas
const itemCount = d.description.split(',').length;
const isComprehensive = itemCount >= 3;

if (isComprehensive) {
  line += `: ${d.description} [ALL-INCLUSIVE BRUNCH/SET MENU med ${itemCount} elementer]`;
}
```

**New prompt instruction:**
```
🎯 ALL-INCLUSIVE MENU ITEMS (mærket [ALL-INCLUSIVE BRUNCH/SET MENU]):
Disse er KOMPLETTE måltider med mange elementer (fx brunch-tallerken med 10+ items).
- Titlen skal TYDELIGT kommunikere den samlede VÆRDI, ikke bare ét element
- FORKERT: "Skyr med æblekompot" (kun 1 af 12 items)
- RIGTIGT: "Den ene brunch — komplet brunch-tallerken" eller "Brunch-menuen med 12 retter"
- Captions skal fremhæve mangfoldigheden og det all-inclusive format (189 DKK dækker ALT)
```

**Impact:** AI will now recognize when a menu item is a comprehensive offering and generate titles that reflect the full value proposition.

---

### 2. `/supabase/functions/generate-text-from-idea/prompt-builders.ts`

**Change:** Strengthened brand voice enforcement in caption generation

**What was added:**

#### A. Forbidden Words Block
```typescript
const forbiddenWordsBlock = forbiddenWords.length > 0
  ? `\n⛔ FORBUDTE ORD (brug ALDRIG disse — brug alternativer fra skrivereglerne):\n${forbiddenWords.slice(0, 8).map(w => `  • "${w}"`).join('\n')}\n`
  : '';
```

#### B. Enhanced Writing Rules (Rule #5)
```
5) SKRIVEREGLER — følg disse STRENGT:
   a) ÉN TANKE PR. SÆTNING — stop før du forklarer. Undgå sammensatte konstruktioner.
   b) TILBEREDNING & RÅVARER FØRST — beskriv hvordan maden er lavet (langsomt ovnbagt, 
      præcist grillet, hjemmelavet), ikke bare hvordan den smager
   c) KONKRETE DETALJER — ingen vage metaforer ("som en varm omfavnelse", "en symfoni af")
   d) NATURLIGT DANSK — skriv som en dansker skriver. Undgå: "lækker", "hyggelig", 
      "autentisk", "unik", "svip" (dateret), "nyd" som imperativ åbning
   e) VÆRDI-DEMONSTRATION (kun for all-inclusive menuer/set menus): Vis bredden af 
      tilbudet — hvor mange retter/elementer er inkluderet? Hvad får gæsten for prisen?
```

**Impact:** 
- Forbidden words are now explicitly listed in the prompt
- "One thought per sentence" is now rule 5a (higher visibility)
- Preparation methods requirement is explicit (rule 5b)
- Vague metaphors are explicitly forbidden with examples (rule 5c)
- Value demonstration is required for comprehensive menu items (rule 5e)

---

## Expected Results

### For "Den ene" Brunch Post:

**Improved Title Examples:**
- "Den ene brunch — komplet brunch-tallerken"
- "All-inclusive brunch med 12 retter"
- "Brunchmenuen: alt inkluderet for 189 DKK"

**Improved Caption Example:**
```
Den ene brunch samler alt til én pris. Langsomt ovnbagt brød, håndskåret dansk 
kalvepølse, hjemmelavet lakserillette og frisk frugt fra morgenen. 12 elementer 
på tallerkenen — du vælger hvad du starter med. Vi har åbent fra 09:00.
```

**Why this works:**
✓ No forbidden words ("perfekt" removed)
✓ One thought per sentence (3 separate facts)
✓ Preparation methods highlighted ("langsomt ovnbagt", "håndskåret", "hjemmelavet")
✓ Concrete details, no vague metaphors
✓ Value demonstration (12 elementer, alt til én pris)
✓ Clear service info (åbent fra 09:00)

---

## Testing Recommendations

1. **Regenerate the weekly strategy** for Week 25 (June 15-21, 2026)
2. **Check the Sunday brunch post** specifically
3. **Verify the title** mentions the comprehensive nature
4. **Review the caption** for:
   - Absence of "perfekt", "symfoni", "omfavnelse"
   - Presence of preparation methods
   - Value demonstration (how many items included)
   - One thought per sentence structure

---

## Additional Notes

### Why These Fixes Work

**Phase 2b Fix (Title):**
- Detects comprehensive offerings using comma count (3+ items = comprehensive)
- Adds explicit marker `[ALL-INCLUSIVE BRUNCH/SET MENU med X elementer]`
- Provides clear examples of good vs bad titles
- AI sees the full context and knows this is a multi-item offering

**prompt-builders.ts Fix (Caption):**
- Forbidden words are now surfaced in dedicated block (higher visibility)
- Brand voice rules are numbered and explicit (a, b, c, d, e structure)
- Examples of what NOT to do are provided ("som en varm omfavnelse")
- Value demonstration is a separate requirement for comprehensive items
- Preparation method focus is explicit requirement, not buried in tone guidelines

### Brand Profile Compliance

The fixes ensure alignment with Cafe Faust's brand profile:

| Brand Guideline | How Fix Addresses It |
|----------------|---------------------|
| **Rule 1:** Focus on preparation methods | Now explicit requirement 5b |
| **Rule 2:** Aarhus cultural references | Already in locationVocabulary block |
| **Rule 3:** One thought per sentence | Now explicit requirement 5a |
| **Rule 4:** Balance classical and modern | Maintained in tone keywords |
| **Rule 5:** Social/waterfront elements | Already in location hooks |
| **Rule 6:** Value & customization | Now explicit requirement 5e |
| **Guardrails:** Forbidden words | Now surfaced in dedicated block |

---

## Rollback Instructions

If these changes cause issues, revert by:

1. Remove `[ALL-INCLUSIVE BRUNCH/SET MENU]` detection logic from phase2b.ts (lines ~810-820)
2. Remove `forbiddenWordsBlock` from prompt-builders.ts (lines ~645-650)
3. Restore original Rule 5 structure (simple list instead of a/b/c/d/e)

**Git restore commands:**
```bash
git checkout HEAD -- supabase/functions/_shared/post-helpers/strategy/phase2/phase2b.ts
git checkout HEAD -- supabase/functions/generate-text-from-idea/prompt-builders.ts
```
