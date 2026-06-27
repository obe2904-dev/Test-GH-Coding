# ROOT CAUSE IDENTIFIED: Weak Prompt Protection

**Date**: 2026-06-22  
**Status**: ✅ ROOT CAUSE FOUND  
**Business**: Café Faust (36e24a84-c32d-4123-910a-1bb2e64d34af)

---

## The Smoking Gun: Database Evidence

```
NATURAL VOCABULARY (ACTUAL):
1. "ved åen" ✅ (from local_location_reference - enforced as first)
2. "på Åboulevarden" ✅
3. "i hjertet af Aarhus" ✅
4. "ved vandet" ❌ AI ADDED THIS DESPITE PROTECTION
5. "udsigt" ❌ AI ADDED THIS DESPITE PROTECTION
6. "udeservering" ✅

businesses.local_location_reference: "ved åen" ✅ EXISTS
Profile generated: 2026-06-21T21:10:07.854Z (yesterday!)
Local_location_reference is first: ✅ YES
```

---

## What Worked

### ✅ Extraction (analyze-website)
- Successfully extracted `local_location_reference: "ved åen"` from cafefaust.dk
- Saved to `businesses.local_location_reference`
- Language detection worked correctly (Danish)

### ✅ Enforcement (brand-profile-generator-v5)
- Successfully enforced "ved åen" as FIRST entry in `natural_vocabulary`
- Post-processing code worked as designed

### ❌ Protection (tone-dna-generator prompt)
- **FAILED**: AI ignored prompt warnings and added "ved vandet" and "udsigt" anyway
- Prompt says: "Aldrig erstattes af generiske alternativer ('ved vandet', 'havnefronten'...)"
- AI interpreted this as: "Don't REPLACE ved åen" but still added "ved vandet" as additional entry

---

## The Bug: Prompt Misinterpretation

**Current prompt logic**:
```typescript
prompt += `\n  2. Aldrig erstattes af generiske alternativer 
         ("ved vandet", "havnefronten", "waterfront", "åen" alene osv.)`;
```

**How AI interprets this**:
- ✅ "Don't replace 'ved åen' with 'ved vandet'" → Correct
- ❌ "You can still add 'ved vandet' as another entry" → Wrong but plausible interpretation

**Result**:
```json
{
  "natural_vocabulary": [
    "ved åen",        // ← Preserved (not replaced) ✅
    "ved vandet"      // ← Added anyway ❌
  ]
}
```

---

## Why "udsigt" Appeared

**Similar logic failure**:
- Prompt doesn't explicitly forbid "udsigt"/"udsigten" 
- AI saw waterfront location (category_scores.waterfront = high)
- Generated "udsigt" as reasonable vocabulary for waterfront setting
- No protection against this term exists in current prompts

**The gap**: Protection only covers:
- "ved vandet" ✅
- "havnefronten" ✅
- "waterfront" ✅
- "åen" alene ✅

But NOT:
- "udsigt" ❌
- "udsigten" ❌
- "havudsigt" ❌
- "vandkanten" ❌
- other generic water terms ❌

---

## The Fix Strategy

### Option A: Strengthen Prompt (Weak - Didn't Work)
Add more explicit warnings:
```
"ALDRIG inkluder disse generiske termer i natural_vocabulary:
 - 'ved vandet'
 - 'havnefronten'
 - 'udsigt'
 - 'udsigten'
 - 'vandkanten'
```

**Problem**: AI may still ignore it. Prompts are suggestions, not enforcement.

### Option B: Post-Processing Blacklist (RECOMMENDED)
Add validation AFTER AI response:
```typescript
const FORBIDDEN_LOCATION_TERMS = [
  'ved vandet',
  'havnefronten',
  'waterfront',
  'udsigt',
  'udsigten',
  'havudsigt',
  'vandkanten',
  'åen', // alone without context
  'søen', // generic
];

// After AI returns vocabulary
if (parsed.location_driver?.natural_vocabulary) {
  const vocab = parsed.location_driver.natural_vocabulary;
  const llr = localLocationReference?.toLowerCase();
  
  const cleaned = vocab.filter(term => {
    const termLower = term.toLowerCase();
    
    // Keep local_location_reference (source of truth)
    if (termLower === llr) return true;
    
    // Remove forbidden generic terms
    if (FORBIDDEN_LOCATION_TERMS.includes(termLower)) {
      console.log(`[ToneDNA] ⚠️ Removed forbidden term: "${term}"`);
      return false;
    }
    
    return true;
  });
  
  parsed.location_driver.natural_vocabulary = cleaned;
}
```

### Option C: Semantic Validation (BEST - Long Term)
Check if term is more generic than local_location_reference:
```typescript
// If local_location_reference is specific ("ved åen")
// Remove any generic water references ("ved vandet", "vandkanten")
const isGenericWaterTerm = (term) => {
  const waterKeywords = ['vandet', 'havet', 'søen', 'fjorden'];
  return waterKeywords.some(kw => term.includes(kw));
};

const hasSpecificWaterReference = (llr) => {
  const specific = ['åen', 'kanalen', 'havnen', 'bugten'];
  return specific.some(kw => llr?.includes(kw));
};

if (hasSpecificWaterReference(llr)) {
  vocab = vocab.filter(term => !isGenericWaterTerm(term));
}
```

---

## Immediate Action Items

### 1. Add Post-Processing Blacklist ⚡ CRITICAL
**File**: `/supabase/functions/_shared/brand-profile/tone-dna-generator.ts`  
**Location**: After line 239 (after current enforcement)

**Code to add**:
```typescript
// BLACKLIST: Remove forbidden generic location terms
const FORBIDDEN_GENERIC_TERMS = [
  'ved vandet',
  'havnefronten', 
  'waterfront',
  'udsigt',
  'udsigten',
  'havudsigt',
  'vandkanten',
  'ved havet',
  'ved søen'
];

if (parsed.location_driver?.natural_vocabulary) {
  const before = parsed.location_driver.natural_vocabulary.length;
  parsed.location_driver.natural_vocabulary = 
    parsed.location_driver.natural_vocabulary.filter(term => {
      const termLower = term.toLowerCase().trim();
      if (FORBIDDEN_GENERIC_TERMS.includes(termLower)) {
        console.log(`[ToneDNA] ⚠️ Removed forbidden generic term: "${term}"`);
        return false;
      }
      return true;
    });
  const after = parsed.location_driver.natural_vocabulary.length;
  if (before !== after) {
    console.log(`[ToneDNA] ✅ Cleaned ${before - after} forbidden terms from vocabulary`);
  }
}
```

### 2. Regenerate Café Faust Profile
Run: `brand-profile-generator-v5` for business_id `36e24a84-c32d-4123-910a-1bb2e64d34af`

Expected result:
```json
{
  "natural_vocabulary": [
    "ved åen",              // ← From local_location_reference
    "på Åboulevarden",      // ← AI-generated, specific ✅
    "i hjertet af Aarhus"   // ← AI-generated, acceptable ✅
    // "ved vandet" REMOVED by blacklist ✅
    // "udsigt" REMOVED by blacklist ✅
  ]
}
```

### 3. Add Unit Test
**File**: Create `/supabase/functions/_shared/brand-profile/tone-dna-generator.test.ts`

```typescript
Deno.test('Blacklist removes forbidden generic location terms', () => {
  const input = [
    'ved åen',
    'på Åboulevarden',
    'ved vandet',    // ← Should be removed
    'udsigt',        // ← Should be removed
    'udeservering'
  ];
  
  const cleaned = removeF forbiddenTerms(input);
  
  assertEquals(cleaned, [
    'ved åen',
    'på Åboulevarden',
    'udeservering'
  ]);
});
```

---

## Long-Term Improvements

### 1. Semantic Water Body Hierarchy
Build a taxonomy that understands:
- **"ved åen"** (specific) > **"ved vandet"** (generic)
- **"i Nyhavn"** (specific) > **"i havnen"** (generic)
- **"ved Søerne"** (specific) > **"ved søen"** (generic)

### 2. Location Intelligence Feedback Loop
If `local_location_reference` mentions water ("åen", "havnen"):
- Block ALL other water references
- Only allow local_location_reference + landmarks

### 3. Operator Override System
Let businesses mark terms as:
- ✅ Approved: Always include
- ❌ Forbidden: Never include
- ⚠️ Review: Flag for manual check

---

## Summary

**ROOT CAUSE**: AI ignored prompt warnings and added forbidden terms anyway  
**WHY**: Prompts are suggestions; AI can choose to add terms despite warnings  
**FIX**: Add post-processing blacklist that programmatically removes forbidden terms  
**IMPACT**: Affects all water-adjacent businesses (rivers, harbors, lakes, coasts)  
**URGENCY**: HIGH - Core brand identity issue  
**EFFORT**: LOW - ~20 lines of code  
**TESTING**: Regenerate Café Faust profile to verify fix

**STATUS**: Ready for implementation ✅
