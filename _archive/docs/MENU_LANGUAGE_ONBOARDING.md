# Menu Language Support - Onboarding Guide

Complete guide for adding new language support to the **Menu Extraction & Parsing System**.

---

## Quick Summary

The menu extraction system is **multi-layered** for language support:

1. **Tika OCR Layer** - Apache Tika uses Tesseract OCR with language-specific engines
2. **Language Configuration** - Language-specific OCR corrections and culinary expertise
3. **GPT-4o Verification** - Multi-lingual culinary verification

**Key Files:**
- Tika extraction: `/supabase/functions/extract-menu-pdf/index.ts`
- Language configs: `/supabase/functions/parse-menu-text/languages/{CODE}.ts`
- Registry: `/supabase/functions/parse-menu-text/languages/index.ts`
- Type definitions: `/supabase/functions/parse-menu-text/types.ts`

---

## How Language Support Works

### Processing Pipeline

```
PDF Upload
    ↓
Tika OCR (with language-specific engine: dan, swe, nld, etc.)
    ↓
Extract raw text (already better with language-specific OCR)
    ↓
Pre-process with OCR corrections dictionary
    ↓
GPT-4o parses with language context
    ↓
Post-process corrections on parsed items
    ↓
GPT-4o verification (culinary expert in selected language)
    ↓
Clean menu items returned
```

---

## Part 1: Enable Language-Specific OCR in Tika

### Tika Tesseract Language Codes

Apache Tika uses Tesseract for OCR. When you add a new language, Tika needs the Tesseract language code.

**Supported Languages:**

| ISO 639-1 | Tesseract Code | Language | Notes |
|-----------|----------------|----------|-------|
| da | dan | Danish | Production-ready ✅ |
| sv | swe | Swedish | Production-ready ✅ |
| nl | nld | Dutch | Production-ready ✅ |
| en | eng | English | Production-ready ✅ |
| en-US | eng | English US | Same as en |
| fr | fra | French | Production-ready ✅ |
| de | deu | German | Production-ready ✅ |
| it | ita | Italian | Production-ready ✅ |
| es | spa | Spanish | Production-ready ✅ |
| pt | por | Portuguese | Production-ready ✅ |
| no | nor | Norwegian | Production-ready ✅ |
| pl | pol | Polish | Production-ready ✅ |
| ru | rus | Russian | Production-ready ✅ |

**How Tika Uses Language Codes:**

File: `/supabase/functions/extract-menu-pdf/index.ts`

```typescript
// Language mapping (line ~30)
const languageMap: Record<string, string> = {
  'da': 'dan',      // Danish OCR
  'sv': 'swe',      // Swedish OCR
  'nl': 'nld',      // Dutch OCR
  'en': 'eng',      // English OCR
  // ... etc
}

// Tika call with language (line ~45)
const tikaResponse = await fetch(TIKA_ENDPOINT, {
  method: 'PUT',
  headers: {
    'Accept': 'text/plain',
    'X-Tika-OCRLanguage': tesseractLang,  // ← Language-specific OCR
  },
  body: pdfBuffer
})
```

### To Add New Language Support to Tika:

1. Add mapping to `languageMap` in `/supabase/functions/extract-menu-pdf/index.ts`:
```typescript
const languageMap: Record<string, string> = {
  // ... existing
  'pt': 'por',      // ✅ Add Portuguese
}
```

2. That's it! Tika will automatically use Portuguese OCR for PDF extraction

**No other changes needed** - the Tika function automatically passes language codes through the system.

---

## Part 2: Create Menu Language Configuration

This is the second layer where you define OCR corrections and culinary expertise.

### Step 1: Create Language Configuration

**File:** `/supabase/functions/parse-menu-text/languages/{LANGUAGE_CODE}.ts`

**Template:**
```typescript
/**
 * {Language} Language Configuration for Menu Parsing
 * Handles {Language} culinary terminology, OCR corrections, and spelling verification
 */

import { LanguageConfig } from '../types.ts'

export const {languageVar}: LanguageConfig = {
  code: '{LANGUAGE_CODE}',           // ISO 639-1 code (e.g., 'fr', 'de', 'it')
  name: '{Language Name}',           // Display name (e.g., 'Français (French)')

  // ===== MOST IMPORTANT: OCR Correction Dictionary =====
  ocrCorrections: {
    // Common OCR mistakes for this language
    // Format: "what_ocr_produces": "correct_spelling"
    
    // Special characters restoration (PRIMARY FOCUS)
    'a': 'à',              // if context-dependent
    'c': 'ç',
    'e': 'é',
    
    // Common ingredient mistakes
    'rechuate': 'recherche',
    'sauce': 'sauce',
    
    // Culinary terms
    'creme brulee': 'crème brûlée',
    'veloute': 'velouté',
    'croutons': 'crôutons',
    
    // Compound words (separate/join as needed)
    'bearnaisesauce': 'béarnaise sauce',
  },

  systemPrompt: `You are an expert in {Language} culinary terminology and food culture.

CRITICAL RULES:
1. PRESERVE all {Language} special characters ({examples}) - these are CORRECT
2. DO NOT "correct" them to ASCII - this is wrong
3. You understand:
   - {Language} ingredient names and traditional dishes
   - Compound word conventions in {Language}
   - French culinary terms (if applicable to menus in {Language})
   - Regional variations and authentic terminology

Your job is to verify menu accuracy, not revert corrections already applied.`,

  correctionInstructions: `CRITICAL RULES FOR {Language} MENUS:

1. **ACCEPT ALREADY-CORRECTED ITEMS**:
   - All items come pre-corrected from OCR dictionary
   - DO NOT revert these corrections
   - Examples of correct forms:
     • "{example_correct_1}"
     • "{example_correct_2}"

2. **Special Characters** - These are CORRECT:
   - List with examples: {char_examples}
   - DO NOT convert to ASCII substitutes
   - Examples: "à" is CORRECT (not "a"), "ç" is CORRECT (not "c")

3. **Compound Words** - Follow {Language} standards:
   - Description of compound word rules
   - When to separate/join
   - Examples: "{example_1}", "{example_2}"

4. **French Culinary Terms** (if used in {Language} menus):
   - Maintain proper accents: crôutons, velouté, à la, etc.
   - These are CORRECT with accents

5. **ONLY correct if absolutely necessary**:
   - Obvious typos in non-{Language} words
   - Spelling variations that affect meaning
   - Never "fix" what's already correct

6. **Verification Checklist**:
   - ✓ All special characters preserved
   - ✓ No ASCII substitutions
   - ✓ Compound words formatted correctly
   - ✓ Reads as authentic {Language} menu
   - ✓ Culinary terminology is traditional (not anglicized)`,
}
```

### Step 2: Register Language

**File:** `/supabase/functions/parse-menu-text/languages/index.ts`

Add import:
```typescript
import { {languageVar} } from './{LANGUAGE_CODE}.ts'
```

Add to registry:
```typescript
export const LANGUAGES: Record<LanguageCode, LanguageConfig> = {
  '{LANGUAGE_CODE}': {languageVar},
  // ... other languages
}
```

### Step 3: Update Type Definitions

**File:** `/supabase/functions/parse-menu-text/types.ts`

Update the `LanguageCode` type:
```typescript
export type LanguageCode = 'da' | 'sv' | 'nl' | 'en-US' | '{LANGUAGE_CODE}'
```

### Step 4: Test with Sample Menu

1. Upload a PDF menu in the new language
2. Check extracted text for accuracy
3. Compare with PDF line-by-line
4. Add any missed OCR patterns to `ocrCorrections` dictionary

---

## OCR Corrections Dictionary - The Most Important Part

**This is where you capture all language-specific OCR errors.**

### Structure
```typescript
ocrCorrections: {
  "pattern_ocr_outputs": "correct_spelling",
  // Order doesn't matter - system sorts by specificity (longest first)
  // Longer patterns take precedence
}
```

### Categories to Include

**1. Special Characters (HIGHEST PRIORITY)**
```typescript
// French example
'a': 'à',
'c': 'ç',
'e': 'é',
'ceuef': 'chef',  // letter substitutions
'flaute': 'flûte',  // missing accent
```

**2. Common Ingredient Mistakes**
```typescript
// What OCR commonly misreads
'boeuf': 'bœuf',      // ligatures
'oignon': 'oignon',   // double-letter issues
'poisson': 'poisson',  // if misread
```

**3. Culinary Terms**
```typescript
'creme brulee': 'crème brûlée',
'veloute': 'velouté',
'croutons': 'crôutons',
'saucepan': 'sauce panne',  // if applicable
```

**4. Compound Words**
```typescript
// Should be separated
'bearnaisesauce': 'béarnaise sauce',
'poivreorange': 'poivre orange',

// Should be joined
'pommes frites': 'pommes-frites',  // if language style requires
```

**5. Brand/Proper Names**
```typescript
'camembert': 'Camembert',  // if needs capitalization
'champagne': 'Champagne',
```

### Real Example: French Dictionary (to expand)

```typescript
ocrCorrections: {
  // Accents
  'a': 'à',
  'c': 'ç',
  'e': 'é',
  'e': 'è',
  'e': 'ê',
  'e': 'ë',
  'i': 'î',
  'i': 'ï',
  'o': 'ô',
  'o': 'ö',
  'u': 'ù',
  'u': 'û',
  'u': 'ü',
  
  // Common dishes
  'creme brulee': 'crème brûlée',
  'sole meuniere': 'sole meunière',
  'filet mignon': 'filet mignon',
  'coq au vin': 'coq au vin',
  'beef bourguignon': 'bœuf bourguignon',
  
  // Ingredients
  'oignon': 'oignon',
  'champignon': 'champignon',
  'fromage': 'fromage',
  
  // Techniques
  'sauté': 'sauté',
  'poché': 'poché',
  'braisé': 'braisé',
}
```

---

## Language-Specific Notes

### French 🇫🇷
**Special chars:** à, é, è, ê, ë, ï, ô, ù, û, ü, ç  
**Complexity:** Very high - most accented language  
**Common errors:** Accents stripped, ligatures (œ, æ) become separate letters

### German 🇩🇪
**Special chars:** ä, ö, ü, ß  
**Complexity:** Medium - fewer accents but compound words are long  
**Common errors:** ä→ae, ö→oe, ü→ue, ß→ss

### Italian 🇮🇹
**Special chars:** à, è, é, ì, ò, ù  
**Complexity:** Medium - fewer than French  
**Common errors:** Accents on vowels most common

### Spanish 🇪🇸
**Special chars:** á, é, í, ó, ú, ü, ñ  
**Complexity:** Medium - accent on vowels, tildes on n  
**Common errors:** ñ→n, accents stripped

### Portuguese 🇵🇹
**Special chars:** á, à, â, ã, é, ê, í, ó, ô, õ, ú, ü, ç  
**Complexity:** HIGH - most accented  
**Common errors:** Cedilla and tildes frequently lost

### Dutch 🇳🇱
**Special chars:** é, ë, ï, ö, ü  
**Complexity:** Low to medium  
**Common errors:** Double vowels misread (aa→a, ee→e)

---

## Testing Checklist

- [ ] Language file created and registered
- [ ] OCR dictionary includes 50+ common errors (start with this minimum)
- [ ] System prompt mentions language explicitly
- [ ] Correction instructions have clear examples
- [ ] Test with real menu PDF in target language
- [ ] Compare extracted text with PDF (line-by-line)
- [ ] All special characters display correctly
- [ ] No ASCII substitutions present
- [ ] Compound words formatted correctly
- [ ] Culinary terms authentic (not anglicized)

---

## Files That Reference Menu Languages

**Track these files when adding a new language:**

1. `/supabase/functions/parse-menu-text/languages/{LANGUAGE_CODE}.ts`
   - NEW FILE - create this
   - Contains: ocrCorrections, systemPrompt, correctionInstructions

2. `/supabase/functions/parse-menu-text/languages/index.ts`
   - EDIT - add import and register in LANGUAGES
   - Update: import statement, LANGUAGES object

3. `/supabase/functions/parse-menu-text/types.ts`
   - EDIT - add language code to LanguageCode type
   - Update: LanguageCode union type

4. `/supabase/functions/parse-menu-text/index.ts`
   - NO CHANGE - automatically uses any registered language
   - Reference: `getLanguageConfig(language, 'da')`

5. `/src/pages/dashboard/businessProfile/hooks/useMenuHandlers.ts`
   - NO CHANGE - passes language to extract function
   - Reference: `languageCode` parameter flow

6. `/src/lib/i18n.ts`
   - POSSIBLE UPDATE - if UI language selection needs to map to menu language
   - Reference: Language code mapping

---

## Current Language Status

| Code | Language | Status | Notes |
|------|----------|--------|-------|
| da | Danish | ✅ Full | 100+ OCR corrections, production-ready |
| sv | Swedish | ⚠️ Partial | 20+ OCR corrections, needs expansion |
| nl | Dutch | ⚠️ Partial | 15+ OCR corrections, needs expansion |
| en-US | English | ⚠️ Basic | 5+ OCR corrections, minimal |

---

## Questions?

Refer to:
- **Danish (da)** - Reference implementation with comprehensive OCR dictionary
- **System prompt** - Shows examples of language-specific context
- **Correction instructions** - Shows how to guide GPT-4o verification

