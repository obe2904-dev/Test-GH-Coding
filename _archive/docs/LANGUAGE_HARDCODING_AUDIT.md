# Language Hardcoding Audit - Brand Profile Generator
**Date:** January 9, 2026  
**Version:** v4.8.9  
**Auditor:** GitHub Copilot

## Executive Summary

Deep dive audit of brand profile generation codebase to identify hard-coded language dependencies. The system is designed to support multiple languages (Danish, English, German) but has several areas where Danish is either assumed or hard-coded.

## ✅ PROPERLY LANGUAGE-AWARE COMPONENTS

### 1. Prompt System (`prompts/prompt-b.ts`)
- ✅ Banned words list is language-specific via `language.code === 'da' ? DEFAULT_BANNED_WORDS_DA : DEFAULT_BANNED_WORDS_EN`
- ✅ Grammar rules conditionally shown: `${language.code === 'da' ? 'DANISH GRAMMAR RULES...' : ''}`
- ✅ Uses `language` parameter throughout
- ✅ Template concludes with: `Write in ${language.name}`

### 2. Fallback Builders (`repair/fallback-builders.ts`)
- ✅ All functions check: `String(language?.code || '').toLowerCase().startsWith('da')` 
- ✅ Ternary operators for language-specific text: `isDanish ? 'brunch' : 'brunch'`, `isDanish ? 'frokost' : 'lunch'`
- ✅ Multi-language fallback examples for brand essence, tone, etc.

### 3. Main Fallbacks (`fallbacks.ts`)
- ✅ Extensive `locale.language === 'da'` checks throughout
- ✅ German (`de`) and English (`en`) alternatives provided
- ✅ Examples:
  - Line 60: `locale.language === 'da' ? 'i' : locale.language === 'de' ? 'in' : 'in'`
  - Lines 179-193: Target audience in Danish, German, English
  - Lines 282-286: Tone of voice examples in all three languages

### 4. Locales System (`locales.ts`)
- ✅ Proper locale configuration per language
- ✅ Includes `bannedWords`, `preferredPhrasing` per language

## ⚠️ PARTIAL LANGUAGE AWARENESS

### 1. Validators (`validators.ts`)

**Language Detection Logic** (Lines 362-383):
```typescript
const isDanishContext = (() => {
  const lang = String(dataSources?.business?.primary_language || '').toLowerCase()
  if (lang.startsWith('da')) return true
  // Falls back to true if unclear
  return true
})()
```
- ⚠️ **ISSUE:** Defaults to `true` (assumes Danish) when language is unclear
- ⚠️ **ISSUE:** English fragment detection only runs for Danish context
- ✅ Has language detection function: `detectLanguage(text): 'da' | 'de' | 'en' | 'unknown'`

**Hard-Coded Error Messages** (Lines 780-892):
```typescript
errors.push('brand_essence must include an offering cue (e.g., brunch/frokost/aften, cocktails, coffee)')
errors.push('tone_of_voice contains English fragments; must be consistently Danish')
errors.push('image_preferences.signature_shot contains English fragments; must be consistently Danish')
```
- ⚠️ **ISSUE:** Error messages always in English, but mention "must be consistently Danish"
- ⚠️ **RECOMMENDATION:** Should dynamically reference the target language: `must be consistently ${language.name}`

**Domain Allowlist** (Lines 574-618):
```typescript
const LOCATION_SIGNALS = [
  'ved åen',        // Danish
  'ved stationen',
  // ...
]

const DOMAIN_ALLOWLIST = [
  'brunch',         // Universal
  'frokost',        // Danish
  'middag',         // Danish
  // ...
]
```
- ⚠️ **ISSUE:** Mixed Danish/English/universal terms without language filtering
- ⚠️ **RECOMMENDATION:** Split into language-specific allowlists or mark terms by language

### 2. Contract Validators (`validation/contract-validators.ts`)

**Generic Hook Detection** (Lines 224-225):
```typescript
// Common generic hook patterns (Danish/English)
if (/\b(perfekt\s+til|unikke\s+oplevelser|kulinariske\s+oplevelser|lækker\s+mad|lækkert\s+mad|good\s+vibes|culinary\s+experiences)\b/i.test(t)) return true
```
- ⚠️ **ISSUE:** Regex includes both Danish and English patterns without language context
- ⚠️ **RECOMMENDATION:** Pass language parameter and filter patterns accordingly

**Offering Detection** (Line 212):
```typescript
const FOOD_WORDS = [
  'mad', 'menu', 'retter', 'drikke', 'drikkevarer', 'kaffe', 'brunch', 'frokost', 'aften', 'vin', 'øl', 'cocktails'
]
```
- ⚠️ **ISSUE:** Only Danish food words, missing English/German equivalents
- ⚠️ **RECOMMENDATION:** Create `FOOD_WORDS_DA`, `FOOD_WORDS_EN`, `FOOD_WORDS_DE`

### 3. Value Validators (`validation/value-validators.ts`)

**Food Detection** (Line 38):
```typescript
const food = /\b(brunch|frokost|middag|aften|kaffe|menu|retter|mad|servering)\b/i.test(n)
```
- ⚠️ **ISSUE:** Only Danish terms for food detection
- ⚠️ **RECOMMENDATION:** Use language-aware patterns

### 4. Tone Model (`tone-model.ts`)

**Fallback Language** (Line 100):
```typescript
language = languageCode.toLowerCase().slice(0, 2) || 'da'
```
- ⚠️ **ISSUE:** Defaults to `'da'` when no language provided
- ⚠️ **RECOMMENDATION:** Either require language or default to user's system language

**Test Cases** (Lines 199, 215, 227):
```typescript
language: 'da',  // Hard-coded in test examples
```
- ✅ OK for test cases, but ensure tests cover multiple languages

## 🔴 CRITICAL ISSUES - HARD-CODED DANISH CONTENT

### 1. Deterministic Repairs (`repair/deterministic-repairs.ts`)

**Location Phrase** (Line 23):
```typescript
const locationPhrase = location?.enrichment?.micro?.area_type === 'waterfront' 
  ? (locale.preferredPhrasing['location_waterfront'] || 'ved åen')
  : // ...
```
- 🔴 **CRITICAL:** Fallback `'ved åen'` is hard-coded Danish
- ✅ **FIX:** Use `locale.preferredPhrasing` correctly (it's trying to, but the fallback should be language-aware)

**Offering Detection** (Line 89):
```typescript
const hasOffering = /brunch|frokost|aften|mad|retter|kaffe|drinks|essen|food/i.test(be)
```
- ⚠️ **ISSUE:** Mixed Danish/English/German without language filtering
- ⚠️ **RECOMMENDATION:** Use language-specific patterns

### 2. Validators - Repair Instructions (`validators.ts`)

**Danish-Only Repair Examples** (Lines 1479-1480):
```typescript
- "lækker brunch" → "brunch med friskbagte croissanter"
- "hyggelig stemning" → "roligt tempo og bløde lydsætninger"
```
- 🔴 **CRITICAL:** Repair prompt sent to AI contains only Danish examples
- 🔴 **IMPACT:** May cause AI to produce Danish output even for non-Danish businesses
- ✅ **FIX:** Make repair examples language-aware

**Error Message Language Mismatch** (Lines 790-892):
```typescript
errors.push('tone_of_voice contains English fragments; must be consistently Danish')
```
- 🔴 **CRITICAL:** Assumes Danish is the target language
- ✅ **FIX:** Change to: `errors.push(\`tone_of_voice contains ${detectedLanguage} fragments; must be consistently ${targetLanguage}\`)`

### 3. Prompt B - Location Phrases (`prompts/prompt-b.ts`)

**Hard-Coded Location Logic** (Lines 850-856):
```typescript
const locationPhrase = location?.enrichment?.micro?.area_type === 'waterfront'
  ? 'ved åen'
  : location?.enrichment && location.enrichment.micro.area_type === 'transit_hub'
  ? 'ved stationen'
  : // ...
```
- 🔴 **CRITICAL:** All location phrases are in Danish regardless of `language.code`
- ✅ **FIX:** Create language-specific location phrase maps

## 📊 STATISTICS

### Language Awareness Breakdown:
- ✅ **Fully Language-Aware:** 4 files (prompt-b.ts main logic, fallbacks.ts, fallback-builders.ts, locales.ts)
- ⚠️ **Partially Language-Aware:** 5 files (validators.ts, contract-validators.ts, value-validators.ts, tone-model.ts, deterministic-repairs.ts)
- 🔴 **Hard-Coded Danish:** 3 critical issues (location phrases in prompt-b.ts, repair examples in validators.ts, error messages)

### Most Common Hard-Coded Terms:
1. `'ved åen'` - 10+ occurrences (waterfront location)
2. `'brunch'` / `'frokost'` / `'middag'` - 40+ occurrences
3. `'hyggelig'` / `'lækker'` - 20+ occurrences in examples/comments
4. Error messages mentioning "Danish" - 6 occurrences

## 🎯 RECOMMENDATIONS

### Priority 1: CRITICAL (Breaks Non-Danish Businesses)

1. **Fix Location Phrases in Prompt B** (`prompts/prompt-b.ts` lines 850-856)
   ```typescript
   // BEFORE (hard-coded Danish)
   const locationPhrase = location?.enrichment?.micro?.area_type === 'waterfront' ? 'ved åen' : // ...
   
   // AFTER (language-aware)
   const locationPhrases = {
     da: { waterfront: 'ved åen', transit_hub: 'ved stationen', shopping_street: 'på gågaden', /* ... */ },
     en: { waterfront: 'by the waterfront', transit_hub: 'by the station', shopping_street: 'on the main street', /* ... */ },
     de: { waterfront: 'am Wasser', transit_hub: 'am Bahnhof', shopping_street: 'in der Fußgängerzone', /* ... */ }
   }
   const locationPhrase = locationPhrases[language.code]?.[location?.enrichment?.micro?.area_type] || ''
   ```

2. **Fix Validator Error Messages** (`validators.ts` lines 790-892)
   ```typescript
   // BEFORE
   errors.push('tone_of_voice contains English fragments; must be consistently Danish')
   
   // AFTER
   if (isDanishContext && containsEnglishFragment(tov)) {
     errors.push(`tone_of_voice contains English fragments; must be consistently ${targetLanguage}`)
   } else if (isEnglishContext && containsDanishFragment(tov)) {
     errors.push(`tone_of_voice contains Danish fragments; must be consistently English`)
   }
   ```

3. **Fix Repair Prompt Examples** (`validators.ts` lines 1470-1490)
   - Add language parameter to `repairBrandProfile()`
   - Provide language-specific example transformations

### Priority 2: HIGH (Reduces Quality for Non-Danish)

4. **Create Language-Specific Domain Lists**
   - Split `DOMAIN_ALLOWLIST` by language
   - Split `LOCATION_SIGNALS` by language
   - Pass language context to all validator functions

5. **Fix Default Language Assumptions**
   - Change `isDanishContext` default from `true` to require explicit language
   - Change tone-model.ts fallback from `'da'` to `'en'` (more universal)
   - Require `primary_language` field in business data

### Priority 3: MEDIUM (Code Quality & Maintainability)

6. **Centralize Language-Specific Content**
   - Create `language-constants.ts` with all language-specific terms
   - Export as objects indexed by language code
   - Import and use throughout codebase

7. **Add Language Parameter to All Functions**
   - Validators should accept `language: LanguageConfig`
   - Contract validators should accept language context
   - Value validators should accept language context

8. **Test Coverage**
   - Add tests for English business profiles
   - Add tests for German business profiles  
   - Add tests for language mismatch detection

## 📝 IMPLEMENTATION CHECKLIST

```typescript
// Example centralized language constants file:
// supabase/functions/_shared/brand-profile/language-constants.ts

export const LOCATION_PHRASES = {
  da: {
    waterfront: 'ved åen',
    transit_hub: 'ved stationen',
    shopping_street: 'på gågaden',
    tourist_area: 'i turistområdet',
    residential: 'i kvarteret',
    business_district: 'i centrum'
  },
  en: {
    waterfront: 'by the waterfront',
    transit_hub: 'by the station',
    shopping_street: 'on the main street',
    tourist_area: 'in the tourist area',
    residential: 'in the neighborhood',
    business_district: 'downtown'
  },
  de: {
    waterfront: 'am Wasser',
    transit_hub: 'am Bahnhof',
    shopping_street: 'in der Fußgängerzone',
    tourist_area: 'im Touristengebiet',
    residential: 'im Viertel',
    business_district: 'im Zentrum'
  }
}

export const FOOD_TERMS = {
  da: ['brunch', 'frokost', 'middag', 'aften', 'kaffe', 'menu', 'retter', 'mad'],
  en: ['brunch', 'lunch', 'dinner', 'evening', 'coffee', 'menu', 'dishes', 'food'],
  de: ['brunch', 'mittagessen', 'abendessen', 'abend', 'kaffee', 'menü', 'gerichte', 'essen']
}

export const ERROR_MESSAGES = {
  da: {
    mustIncludeOffering: 'brand_essence skal indeholde et tilbudssignal (f.eks. brunch/frokost/aften, cocktails, kaffe)',
    languageConsistency: (found: string, expected: string) => `indeholder ${found} fragmenter; skal være konsekvent ${expected}`
  },
  en: {
    mustIncludeOffering: 'brand_essence must include an offering cue (e.g., brunch/lunch/dinner, cocktails, coffee)',
    languageConsistency: (found: string, expected: string) => `contains ${found} fragments; must be consistently ${expected}`
  },
  // ...
}
```

## ✅ CONCLUSION

The codebase has **good foundation for multi-language support** but requires targeted fixes in 3 critical areas:

1. Location phrase generation (hard-coded Danish)
2. Validator error messages (assumes Danish)
3. Repair prompt examples (Danish-only)

With Priority 1 fixes implemented, the system will properly support English and German businesses. Priority 2 and 3 improvements will enhance code quality and maintainability.

**Estimated Effort:**
- Priority 1: 4-6 hours
- Priority 2: 6-8 hours  
- Priority 3: 8-12 hours

**Total: 18-26 hours** for complete language independence.
