# ✅ v5.1.6 - Sentence Truncation Fix

## Problem
Text was being truncated when containing subordinate clauses with "når", "da", "mens", "selvom", "fordi", "eftersom".

**Example symptom:**
- Expected: `"Vi har åbent, og du er velkommen, når du er klar."`
- Actual: `"Vi har åbent, og."`

## Root Cause
`silentCorrect` function in `silent-correct.ts` had a rule (#5 - run-on sentences) that was incorrectly treating grammatically correct compound sentences with subordinate clauses as incomplete sentences.

**Bug location:** `supabase/functions/_shared/utils/silent-correct.ts`

**Processing flow:**
1. AI generates: `"Vi har åbent, og du er velkommen, når du er klar."`
2. `stripBannedClosers` → passes through (no matching patterns)
3. `stripAIDashes` → passes through (no dashes)
4. `silentCorrect` → **TRUNCATES** (incorrectly sees "når" clause as incomplete)
5. Step 7b adds period → `"Vi har åbent, og."`

## Fix Applied
Added explicit guard in `silentCorrect` prompt after Rule #5:

```typescript
CRITICAL: Sentences containing subordinate clauses introduced by "når", "mens", 
"da", "selvom", "fordi", "eftersom" are NOT incomplete or run-on sentences — 
these are grammatically correct compound sentences. Do NOT truncate them. 

Example: "Vi har åbent, og du er velkommen, når du er klar" is a complete, 
correct sentence. DO NOT change it.
```

## Deployment
- **File modified:** `supabase/functions/_shared/utils/silent-correct.ts`
- **Function deployed:** `generate-text-from-idea` (178.7kB)
- **Version:** v5.1.6 (silent-correct fix)
- **Deployed:** 2026-06-14

## Test Cases
To verify the fix works, test text generation with these patterns:

1. **"når" clause:** `"Vi har åbent, og du er velkommen, når du er klar"`
2. **"da" clause:** `"Prøv vores brunch, da den er frisklavet hver dag"`
3. **"mens" clause:** `"Nyd kaffen, mens du ser på åen"`
4. **"selvom" clause:** `"Kom forbi, selvom det regner"`
5. **"fordi" clause:** `"Vi elsker brunch, fordi det samler folk"`
6. **"eftersom" clause:** `"Vi bruger lokale råvarer, eftersom kvalitet er vigtigst"`

**Expected behavior:** All sentences should remain intact, not truncated at the subordinate clause.

## Related Fixes
This is part of the v5.1.x series:
- **v5.1.3:** Split `avoid_patterns` into `strip_from_output` vs `generation_constraints`
- **v5.1.4:** Fixed examples priority (enhanced_social_examples first)
- **v5.1.5:** Deprecated business_character field
- **v5.1.6:** Fixed sentence truncation in silentCorrect

## Architecture Notes
The `compound_sentences` patterns (["mens","selvom","fordi","eftersom","når","da"]) in `generation_constraints` are correctly used ONLY in prompts to guide AI generation. They are NOT used for post-processing stripping, which prevents the misuse that would have caused the original architectural violation described in issue #1.
