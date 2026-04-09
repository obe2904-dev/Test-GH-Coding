# Multi-Language Menu Parsing System

## Architecture Overview

The menu parsing system is now designed to be **language-agnostic and extensible**. All language-specific configurations are separated into individual files, making it trivial to add new languages.

### File Structure

```
supabase/functions/parse-menu-text/
├── index.ts                    # Main Edge Function (language-agnostic)
├── types.ts                    # Language configuration types
└── languages/
    ├── index.ts               # Language registry
    ├── danish.ts              # Danish configuration
    ├── swedish.ts             # Swedish configuration (template)
    ├── dutch.ts               # Dutch configuration (template)
    └── english.ts             # English configuration (in danish.ts)
```

## How It Works

### 1. **Language Configuration** (`types.ts`)

Each language is defined by a `LanguageConfig` interface:

```typescript
interface LanguageConfig {
  code: string                                    // 'da', 'sv', 'nl', 'en-US'
  name: string                                    // Display name
  ocrCorrections: Record<string, string>        // Dictionary of corrections
  systemPrompt: string                           // GPT-4o system context
  correctionInstructions: string                 // Specific rules for the model
  verificationRules?: string                     // Optional verification hints
}
```

### 2. **Language Registry** (`languages/index.ts`)

Central management of all supported languages:

```typescript
export const LANGUAGES: Record<LanguageCode, LanguageConfig> = {
  da: danish,
  sv: swedish,
  nl: dutch,
  'en-US': english
}

// Utility functions:
getLanguageConfig(code)           // Get config by code
getAvailableLanguages()           // Get all languages
getLanguageCodeByName(name)       // Find by name
```

### 3. **Edge Function Usage** (`index.ts`)

The main function is now language-agnostic:

```typescript
// Request body includes language parameter:
{
  extractedText: string,
  menuName: string,
  language: 'da' | 'sv' | 'nl' | 'en-US'    // NEW!
}

// Processing pipeline:
1. parseMenuWithGPT4o()          // Extract structure
2. correctMenuSpelling()          // Apply language OCR dictionary
3. verifyMenuWithGPT4o()         // Verify with language expertise
```

### 4. **Frontend Integration** (`MenuOfferingsPanel.tsx`)

Language selector in UI:

```tsx
<select value={menuLanguage} onChange={(e) => setMenuLanguage(e.target.value)}>
  <option value="da">🇩🇰 Dansk</option>
  <option value="sv">🇸🇪 Svenska</option>
  <option value="nl">🇳🇱 Nederlands</option>
  <option value="en-US">🇺🇸 English</option>
</select>

// Pass to API:
body: JSON.stringify({
  extractedText: data.extractedText,
  menuName: menuName,
  language: menuLanguage    // NEW!
})
```

---

## Adding a New Language

### Step 1: Create Language Configuration File

Create `/supabase/functions/parse-menu-text/languages/YOUR_LANGUAGE.ts`:

```typescript
import { LanguageConfig } from '../types.ts'

export const yourLanguage: LanguageConfig = {
  code: 'xx',  // ISO 639-1 code (e.g., 'fr', 'de', 'it')
  name: 'Your Language Name',

  // Dictionary of OCR corrections
  ocrCorrections: {
    // Common OCR errors in your language
    'misspelled': 'correct',
    'common_error': 'proper_spelling',
    
    // French terms (often appear on all menus)
    'croutons': 'crôutons',
    'a la carte': 'à la carte',
  },

  // System prompt for GPT-4o
  systemPrompt: `You are an expert in [Language] culinary terminology and food culture. 
You understand:
- Compound word conventions
- Proper accents and diacritics
- Traditional ingredient names
- Local food culture and dishes
- French culinary terms used in [Language] menus`,

  // Specific correction rules
  correctionInstructions: `CRITICAL CORRECTIONS TO LOOK FOR:

1. **Compound Words**: Follow [Language] conventions
   - Example: "word word" (separate)
   - NOT "wordword" (joined)

2. **Accents/Diacritics**: Maintain proper characters
   - French terms should have French accents
   - Local language special characters

3. **Plural Forms**: Context-aware
   - Singular when referring to single ingredient
   - Plural when referring to multiple items

4. **Menu-Specific Terms**: Preserve authentic [Language] terminology

5. **French Terms**: Use French spelling and accents for authenticity`,

  // Optional: Additional verification rules
  verificationRules: `
- Preserve all local language accents and special characters
- Keep menu items in their authentic form
- Verify measurements match local conventions
- Check for proper brand name capitalization
  `
}
```

### Step 2: Register in Language Registry

Update `/supabase/functions/parse-menu-text/languages/index.ts`:

```typescript
import { yourLanguage } from './your_language.ts'

export const LANGUAGES: Record<LanguageCode, LanguageConfig> = {
  da: danish,
  sv: swedish,
  nl: dutch,
  'en-US': english,
  'xx': yourLanguage,  // ← Add your language
}
```

### Step 3: Update Frontend Language Selector

Update `MenuOfferingsPanel.tsx`:

```tsx
<select value={menuLanguage} onChange={(e) => setMenuLanguage(e.target.value)}>
  <option value="da">🇩🇰 Dansk</option>
  <option value="sv">🇸🇪 Svenska</option>
  <option value="nl">🇳🇱 Nederlands</option>
  <option value="en-US">🇺🇸 English</option>
  <option value="xx">🇫🇷 Français</option>  {/* Add new language */}
</select>
```

### Step 4: Update TypeScript Type

Update `MenuOfferingsPanel.tsx`:

```tsx
// Current:
const [menuLanguage, setMenuLanguage] = React.useState<'da' | 'sv' | 'nl' | 'en-US'>('da')

// Update to:
const [menuLanguage, setMenuLanguage] = React.useState<'da' | 'sv' | 'nl' | 'en-US' | 'xx'>('da')
```

### Step 5: Deploy

```bash
cd "/Users/olebaek/Test P2G 1"
/opt/homebrew/bin/supabase functions deploy parse-menu-text
```

---

## Language Configuration Examples

### Danish (`danish.ts`)
- **OCR Errors**: Danish special characters (ø, æ, å)
- **Compound Words**: "dild mayo" (separate), not "dildmayo"
- **Accents**: French terms with proper accents (crôutons, á la mande)
- **Plurals**: Context-aware (rødbeder vs rødbede)

### Swedish (`swedish.ts`)
- **OCR Errors**: Swedish special characters (å, ä, ö)
- **Compound Words**: Swedish menu conventions
- **Accents**: French culinary terms
- **Food Culture**: Swedish dishes (köttbullar, gravlax)

### Dutch (`dutch.ts`)
- **OCR Errors**: Dutch common substitutions
- **Compound Words**: Dutch conventions
- **International**: Indonesian/Asian cuisine (nasi, bami)
- **Accents**: French terms

### English US (`english-us`)
- **OCR Errors**: Minimal, mainly proper nouns
- **French Terms**: Common culinary vocabulary
- **Measurements**: US standard (cups, oz, lbs)
- **Brand Names**: Proper capitalization

---

## Best Practices for New Languages

### 1. Build Comprehensive OCR Dictionary
- Collect common OCR errors from actual PDFs
- Include:
  - Character substitutions (0→ø, 1→l)
  - Common misspellings
  - Compound word splitting
  - Accent restoration
- Order by frequency (most common first)

### 2. Write Clear GPT-4o Prompts
- Be specific about what constitutes "correct"
- Provide examples of common mistakes
- Explain your language's conventions
- Mention special characters and accents

### 3. Test with Real Menus
- Extract actual restaurant menus in the language
- Verify all corrections are accurate
- Check that authentic terminology is preserved
- Test compound words and accents

### 4. Document Regional Variations
- Note if different regions have different conventions
- Consider dialect-specific spellings
- Handle plural/singular forms properly

---

## Quality Checklist for New Languages

- [ ] All OCR corrections are accurate
- [ ] French culinary terms have correct accents
- [ ] Compound words follow language conventions
- [ ] System prompt mentions all important language features
- [ ] Correction instructions are specific and actionable
- [ ] Tested with 5+ real restaurant menus
- [ ] All local special characters preserved
- [ ] Brand names and proper nouns handled correctly
- [ ] Edge Function deployed successfully
- [ ] Frontend language selector updated
- [ ] Documentation updated

---

## Troubleshooting

### "Unknown language code"
- Check that language code is registered in `LANGUAGES`
- Verify code matches TypeScript union type

### Corrections not applied
- Check OCR dictionary spelling (case-sensitive keys)
- Verify regex word boundary handling
- Test regex with sample text

### GPT-4o ignoring corrections
- Review system prompt - be more specific
- Improve correction instructions with examples
- Lower temperature (0.2) for more accuracy
- Add verification rules

### Performance issues
- OCR dictionary size shouldn't matter (<100ms for 1000 entries)
- Check GPT-4o response time (usually <2-3 seconds)
- Monitor Deno function execution time

---

## Current Supported Languages

| Language | Code | Status | Notes |
|----------|------|--------|-------|
| Danish | `da` | ✅ Full | 40+ OCR corrections, French terms |
| Swedish | `sv` | 📋 Template | Ready to expand |
| Dutch | `nl` | 📋 Template | Ready to expand |
| English (US) | `en-US` | ✅ Minimal | Good fallback for all languages |

---

## Future Enhancements

- [ ] Auto-detect language from PDF metadata
- [ ] Support language-specific PDF extraction (e.g., Arabic RTL)
- [ ] Add per-business language preferences
- [ ] Machine learning for OCR pattern recognition
- [ ] User-submitted corrections to improve dictionaries
- [ ] Real-time language detection on extracted text
