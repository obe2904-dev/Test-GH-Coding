# Menu Language Implementation Map

**Tracks all code files that use menu language configuration.**  
Use this to ensure all necessary files are updated when adding a new language.

---

## File Update Checklist

### Core Language System (MUST UPDATE)

#### ✅ `/supabase/functions/parse-menu-text/languages/{LANGUAGE_CODE}.ts`
- **Type:** NEW FILE
- **Purpose:** Language configuration with OCR corrections
- **Update When Adding Language:** CREATE NEW FILE
- **Example:** `danish.ts`, `swedish.ts`, `dutch.ts`
- **Contains:**
  - `ocrCorrections` - OCR error dictionary (most important!)
  - `systemPrompt` - GPT-4o context instruction
  - `correctionInstructions` - Verification guidance

**Status:**
- ✅ da (Danish) - COMPLETE
- ⚠️ sv (Swedish) - PARTIAL
- ⚠️ nl (Dutch) - PARTIAL
- ⚠️ en-US (English) - BASIC

---

#### ✅ `/supabase/functions/parse-menu-text/languages/index.ts`
- **Type:** REGISTRY (central hub)
- **Purpose:** Import and register all language configurations
- **Update When Adding Language:** 
  1. Add import: `import { {var} } from './{CODE}.ts'`
  2. Add to LANGUAGES object: `'{CODE}': {var},`
- **Current Imports:**
  ```typescript
  import { danish } from './danish.ts'
  import { swedish } from './swedish.ts'
  import { dutch } from './dutch.ts'
  ```
- **Critical:** If language not registered here, system won't find it

**Status:** ✅ All currently supported languages registered

---

#### ✅ `/supabase/functions/parse-menu-text/types.ts`
- **Type:** TYPE DEFINITIONS
- **Purpose:** TypeScript type safety for language codes
- **Update When Adding Language:** Add to `LanguageCode` union type
- **Location:** Line with `type LanguageCode = 'da' | 'sv' | ...`
- **Example:** 
  ```typescript
  // Before
  export type LanguageCode = 'da' | 'sv' | 'nl' | 'en-US'
  
  // After adding French
  export type LanguageCode = 'da' | 'sv' | 'nl' | 'en-US' | 'fr'
  ```

**Status:** ✅ Updated after each language addition

---

### Processing Pipeline (NO UPDATE NEEDED)

These files automatically support all registered languages:

#### 📖 `/supabase/functions/parse-menu-text/index.ts`
- **Purpose:** Main processing function
- **How It Uses Languages:**
  ```typescript
  const languageConfig = getLanguageConfig(language, 'da')
  const correctedText = preprocessTextWithOCRCorrections(extractedText, languageConfig)
  let menuData = await parseMenuWithGPT4o(extractedText, menuName, languageConfig)
  ```
- **Key Functions:**
  - `getLanguageConfig()` - Retrieves language config from registry
  - `preprocessTextWithOCRCorrections()` - Applies OCR dictionary
  - `correctMenuSpelling()` - Applies corrections to parsed items
  - `verifyMenuWithGPT4o()` - Verification with culinary expertise
- **Status:** ✅ No changes needed when adding language

---

### Frontend Integration (CONDITIONAL)

#### 📖 `/src/pages/dashboard/businessProfile/hooks/useMenuHandlers.ts`
- **Purpose:** Handles menu extraction from various sources
- **How It Uses Languages:**
  - Detects business language setting
  - Passes `languageCode` to extraction functions
  - Currently: `const languageCode = 'da'` (hardcoded to Danish)
- **Update When:** If you need multi-language UI support
- **Change Needed:**
  ```typescript
  // Currently
  const languageCode = 'da'
  
  // Could be changed to
  const languageCode = business.language_code || 'da'
  ```
- **Status:** ⚠️ Currently hardcoded to Danish

**File Content:**
```typescript
// Line ~30: Menu extraction call
const extractionResponse = await supabase.functions.invoke(
  'extract-menu-pdf',
  {
    body: {
      url: urlString,
      languageCode: 'da'  // ← Currently hardcoded
    }
  }
)

// Line ~180: URL extraction call
const urlExtractionResponse = await supabase.functions.invoke(
  'extract-menu-url',
  {
    body: {
      url: urlString,
      languageCode: 'da'  // ← Currently hardcoded
    }
  }
)

// Line ~220: Manual menu entry
const parseResponse = await supabase.functions.invoke(
  'parse-menu-text',
  {
    body: {
      extractedText: text,
      menuName: extractedName,
      language: 'da'  // ← Currently hardcoded
    }
  }
)
```

---

#### 📖 `/src/pages/dashboard/businessProfile/components/MenuOfferingsPanel.tsx`
- **Purpose:** UI panel for menu management
- **How It Uses Languages:** Indirectly through useMenuHandlers
- **Update When:** If implementing language selection UI
- **Status:** ✅ No changes needed for backend support

---

#### 📖 `/src/lib/i18n.ts`
- **Purpose:** Application internationalization (i18next)
- **How It Uses Languages:** Provides UI translations
- **Related To Menu Languages?** Potentially - could map UI language to menu language
- **Example Mapping:**
  ```typescript
  // i18next language → menu language
  'da' → 'da'      // Danish → Danish menu language
  'sv' → 'sv'      // Swedish → Swedish menu language
  'en' → 'en-US'   // English → English menu language
  ```
- **Update When:** Implementing multi-language menu support
- **Status:** ⚠️ Currently independent systems

---

### Extraction Functions (REFERENCE ONLY)

#### 📖 `/supabase/functions/extract-menu-pdf/index.ts`
- **Purpose:** Extract text from PDF files
- **Uses Languages?** No - just extracts raw text
- **Status:** ✅ No language-specific logic needed

#### 📖 `/supabase/functions/extract-menu-url/index.ts`
- **Purpose:** Extract text from web URLs
- **Uses Languages?** No - just extracts raw text
- **Status:** ✅ No language-specific logic needed

---

## Language Code Mapping Reference

| Code | Language | Region | Encoding | Special Chars |
|------|----------|--------|----------|---|
| da | Danish | Denmark 🇩🇰 | UTF-8 | æ ø å |
| sv | Swedish | Sweden 🇸🇪 | UTF-8 | å ä ö |
| nl | Dutch | Netherlands 🇳🇱 | UTF-8 | é ë ï ö ü |
| en-US | English | USA 🇺🇸 | UTF-8 | ' - (minimal) |
| fr | French | France 🇫🇷 | UTF-8 | à é è ê ë ï ô ù û ü ç |
| de | German | Germany 🇩🇪 | UTF-8 | ä ö ü ß |
| it | Italian | Italy 🇮🇹 | UTF-8 | à è é ì ò ù |
| es | Spanish | Spain 🇪🇸 | UTF-8 | á é í ó ú ü ñ |
| pt | Portuguese | Portugal 🇵🇹 | UTF-8 | à á â ã é ê í ó ô õ ú ü ç |

---

## How Language Selection Works

### Current Flow (Hardcoded to Danish)
```
PDF Upload → extract-menu-pdf (no lang) → parse-menu-text (language: 'da')
                                            ↓
                                      getLanguageConfig('da')
                                            ↓
                                      danish.ts config loaded
                                            ↓
                                      OCR corrections applied
                                            ↓
                                      GPT-4o verification (Danish expert)
                                            ↓
                                      Corrected menu items returned
```

### Future Flow (Multi-Language)
```
PDF Upload + Language Selection → extract-menu-pdf (lang param)
                                        ↓
                                  parse-menu-text (language: selected)
                                        ↓
                                  getLanguageConfig(selected_language)
                                        ↓
                                  {language}.ts config loaded
                                        ↓
                                  OCR corrections applied
                                        ↓
                                  GPT-4o verification (language expert)
                                        ↓
                                  Corrected menu items returned
```

---

## Checklist: Adding a New Language

```markdown
## Adding {LANGUAGE} Support

### Step 1: Create Files
- [ ] Create `/supabase/functions/parse-menu-text/languages/{CODE}.ts`
  - [ ] Add `ocrCorrections` (50+ entries minimum)
  - [ ] Add `systemPrompt` (language-specific context)
  - [ ] Add `correctionInstructions` (verification rules)

### Step 2: Register Language
- [ ] Edit `/supabase/functions/parse-menu-text/languages/index.ts`
  - [ ] Add import statement
  - [ ] Add to LANGUAGES object
- [ ] Edit `/supabase/functions/parse-menu-text/types.ts`
  - [ ] Add '{CODE}' to LanguageCode type

### Step 3: Test
- [ ] Upload test menu PDF in {LANGUAGE}
- [ ] Check extracted text accuracy
- [ ] Compare with PDF (line-by-line)
- [ ] Fix OCR errors in dictionary
- [ ] Re-test

### Step 4: Documentation
- [ ] Add language to status table in MENU_LANGUAGE_ONBOARDING.md
- [ ] Document any special requirements
- [ ] Add to this implementation map

### Step 5: Update UI (Optional)
- [ ] Add language selection to business profile settings
- [ ] Map UI language to menu language in `useMenuHandlers.ts`
- [ ] Update language selector if needed
```

---

## Performance Considerations

**OCR Corrections Application Speed:**
- System processes corrections in order of pattern length (longest first)
- 100+ corrections = ~50-100ms per menu
- Scales well - no performance issues expected

**GPT-4o Verification:**
- Cost: ~$0.02-0.05 per menu (variable pricing)
- Speed: 2-3 seconds per verification
- Bottleneck: API response time, not language support

**Adding More Languages:**
- No performance impact on existing languages
- Each language is isolated configuration
- Registry lookup is O(1) - instant

---

## Troubleshooting

**Language not found?**
- ✓ Check it's imported in `/supabase/functions/parse-menu-text/languages/index.ts`
- ✓ Check it's in LANGUAGES object
- ✓ Check LanguageCode type in types.ts
- ✓ Check spelling of language code

**OCR corrections not applied?**
- ✓ Check corrections dictionary is populated
- ✓ Check regex patterns use word boundaries
- ✓ Test with exact OCR error from PDF
- ✓ Check casing (patterns are case-insensitive but should match)

**GPT-4o not understanding the language?**
- ✓ Check systemPrompt says language name explicitly
- ✓ Check correctionInstructions has language-specific examples
- ✓ Verify examples in prompt match actual text
- ✓ Add more specific examples to prompt

**Special characters not displaying?**
- ✓ Ensure file saved as UTF-8
- ✓ Check browser encoding is UTF-8
- ✓ Verify database supports UTF-8
- ✓ Check API response headers include charset=utf-8

---

## Reference: Danish Configuration

Use `/supabase/functions/parse-menu-text/languages/danish.ts` as the reference implementation.

It includes:
- ✅ 100+ OCR corrections
- ✅ Comprehensive system prompt
- ✅ Detailed correction instructions
- ✅ Real-world tested patterns

Copy this structure when adding new languages.

