# Language Onboarding Guide

## Adding a New Language to the Application

This guide explains how to add support for a new language to the social media management platform.

---

## Overview

The application uses **i18next** for internationalization with:
- **ISO 639-1 two-letter language codes** (e.g., `da`, `en`, `sv`, `no`, `de`)
- **JSON translation files** for each language
- **Dynamic language detection** from browser/localStorage
- **Backend language support** for AI responses

---

## Step-by-Step Process

### 1. Create Translation File

**Location:** `src/lib/locales/`

1. Copy an existing translation file (e.g., `en.json` or `da.json`)
2. Rename it with the ISO 639-1 code (e.g., `sv.json` for Swedish)
3. Translate all values while keeping keys unchanged

**Example structure:**
```json
{
  "auth": {
    "signIn": "Logga in på ditt konto",
    "signUp": "Skapa ditt konto",
    ...
  },
  "createPost": {
    "photoAnalysis": {
      "analyzeButton": "Analysera Foto",
      ...
    }
  }
}
```

### 2. Register Language in i18n Configuration

**File:** `src/lib/i18n.ts`

Add import and resource:

```typescript
import svTranslations from './locales/sv.json'

const resources = {
  en: { translation: enTranslations },
  da: { translation: daTranslations },
  sv: { translation: svTranslations }, // ✅ Add new language
}
```

### 3. Add Language to LanguageSwitcher Component

**File:** `src/components/LanguageSwitcher.tsx`

Add option to language selector dropdown:

```typescript
const languages = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'da', label: 'Dansk', flag: '🇩🇰' },
  { code: 'sv', label: 'Svenska', flag: '🇸🇪' }, // ✅ Add new option
]
```

### 4. Update Backend Functions

Each Supabase Edge Function that generates text needs language support.

#### **analyze-photo** (`supabase/functions/analyze-photo/index.ts`)

Add system prompts for the new language:

```typescript
systemPrompt = language === 'da'
  ? `Du er en professionel fotograf...` // Danish
  : language === 'sv'
  ? `Du är en professionell fotograf...` // ✅ Swedish
  : `You are a professional photographer...` // English (fallback)
```

#### **ai-enhance** (`supabase/functions/ai-enhance/index.ts`)

Add language-specific instructions:

```typescript
const languageInstructions = language === 'da'
  ? 'Skriv på dansk...'
  : language === 'sv'
  ? 'Skriv på svenska...' // ✅ Add Swedish
  : 'Write in English...'
```

#### **ai-generate** (if applicable)

Follow the same pattern for any AI generation functions.

### 5. Test Language Implementation

#### **Frontend Testing:**
```bash
# 1. Start development server
npm run dev

# 2. Open browser and:
- Click language switcher
- Select new language
- Verify all UI text translates correctly
- Check that no English/Danish text remains
- Test all major features (post creation, photo analysis, etc.)
```

#### **Backend Testing:**
```bash
# Test photo analysis in new language
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/analyze-photo \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/photo.jpg",
    "postText": "Test text in new language",
    "language": "sv",
    "tier": "free"
  }'

# Verify response is in Swedish
```

### 6. Deploy Backend Functions

After adding language support to backend functions:

```bash
# Deploy each updated function
supabase functions deploy analyze-photo --project-ref YOUR_PROJECT_REF
supabase functions deploy ai-enhance --project-ref YOUR_PROJECT_REF
supabase functions deploy ai-generate --project-ref YOUR_PROJECT_REF
```

---

## Translation Keys Structure

### **Critical Sections to Translate:**

1. **Authentication** (`auth.*`)
   - Sign in/sign up forms
   - Error messages

2. **Post Creation** (`createPost.*`)
   - All step labels and instructions
   - Photo analysis (`photoAnalysis.*`)
   - Error messages

3. **Generate Step** (`generate.*`)
   - AI suggestions
   - Manual mode text
   - Hashtags and tone options

4. **Publish Step** (`publish.*`)
   - Scheduling options
   - Platform selection
   - Success/error messages

5. **Business Profile** (`businessProfile.*`)
   - Setup wizard
   - Form labels
   - Analysis results

6. **Plans & Upgrade** (`plans.*`, `upgrade.*`)
   - Tier names and features
   - Upgrade prompts

---

## Common Pitfalls & Tips

### ❌ **Don't:**
- Hardcode text strings in components
- Mix languages in translation files
- Skip testing backend AI responses
- Forget to update language switcher UI

### ✅ **Do:**
- Use `t('key.path')` for all user-facing text
- Keep translation keys consistent across languages
- Test with actual users who speak the language
- Maintain consistent tone across translations
- Document any language-specific formatting rules

---

## Language-Specific Considerations

### **Date & Time Formatting**

Update `src/lib/locales/{lang}.json` with locale settings:

```json
{
  "publish": {
    "locale": "sv-SE",
    "dayNames": ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"],
    "monthNames": ["Januari", "Februari", ...]
  }
}
```

### **Number Formatting**

```json
{
  "plans": {
    "standardPlus": {
      "price": "99 kr", // Denmark/Sweden
      "price": "€9.99"   // European
    }
  }
}
```

### **Cultural Adaptations**

Consider:
- Formal vs informal tone (tu/vous, du/Sie)
- Business terminology (especially for tier names)
- Social media platform terminology
- Call-to-action phrases

---

## Validation Checklist

Before considering a language complete:

- [ ] All translation keys from `en.json`/`da.json` are present
- [ ] No missing translations (check browser console for warnings)
- [ ] Language switcher shows new language option
- [ ] Backend functions respond in correct language
- [ ] Date/time formatting is correct
- [ ] Currency symbols are appropriate
- [ ] All user flows tested (signup → post creation → publish)
- [ ] AI-generated content is in correct language
- [ ] Error messages are translated
- [ ] Email templates updated (if applicable)

---

## Supported Languages (Current)

| Code | Language | Status | Backend Support |
|------|----------|--------|-----------------|
| `en` | English  | ✅ Complete | ✅ Full |
| `da` | Danish   | ✅ Complete | ✅ Full |
| `sv` | Swedish  | 🔄 Example | 🔄 Example |

---

## Getting Help

If you encounter issues:

1. **Check i18n initialization:** Look for errors in browser console
2. **Verify file paths:** Ensure translation file is in correct location
3. **Test fallback:** If a key is missing, it should fallback to English
4. **Backend logs:** Check Supabase function logs for language-related errors

---

## Maintenance

### **Regular Updates:**
- When adding new features, add keys to ALL language files
- Keep translation files in sync
- Review AI prompt quality in each language
- Update this guide with new languages added

### **Quality Assurance:**
- Quarterly review of translations with native speakers
- User feedback on AI-generated content quality
- A/B testing of tone variations per language
