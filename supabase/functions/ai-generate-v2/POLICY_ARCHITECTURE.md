# Policy Architecture - AI Generate V2

## Overview

The V2 system uses a **policy layer** to separate deterministic rules from probabilistic AI prompts. This ensures:

1. **Enforceable Rules**: Policies are checked in code - AI cannot ignore them
2. **Locale Awareness**: Content feels local (Danish hygge, Swedish lagom, German Gemütlichkeit) not American
3. **Maintainability**: Rules in one place, not scattered across prompts
4. **Testability**: Deterministic functions can be unit tested
5. **Extensibility**: Easy to add new countries/languages

## Architecture

```
ai-generate-v2/
├── policies/                    # Deterministic rules (NEW)
│   ├── locale-config.ts         # Cultural norms, meal times, language rules per country
│   ├── menu-rules.ts            # Menu category → daypart validation
│   ├── brand-guards.ts          # [TODO] Forbidden terms, tone compliance
│   └── platform-rules.ts        # [TODO] Instagram/Facebook/LinkedIn rules
│
├── generators/
│   ├── prompt-builder.ts        # USES policies to build context-aware prompts
│   └── smart-generator.ts       # Calls GPT-4o with prompts
│
├── validators/
│   └── content-validator.ts     # USES policies to validate output
│
└── data-sources/                # Fetch from database
```

## Policy Files

### 1. locale-config.ts

**Purpose**: Single source of truth for country/language-specific cultural rules

**Structure**:
```typescript
interface LocaleConfig {
  language: string                // 'Danish', 'Swedish', 'German'
  country: string                 // 'Denmark', 'Sweden', 'Germany'
  timeFormat: '12h' | '24h'
  
  mealTimes: {
    breakfast: string             // "07:00-10:30"
    lunch: string                 // "11:00-15:00" (Denmark) vs "11:00-14:00" (Sweden)
    dinner: string                // "17:00-22:00"
    lateNight: string             // "22:00-02:00"
  }
  
  culturalNorms: {
    formalityLevel: 'informal' | 'mixed' | 'formal'
    emojiUsage: 'minimal' | 'moderate' | 'frequent'
    exclamationLimit: number      // Max ! per text (1 for Danish, 0 for German)
    useImperativeCTA: boolean     // "Kom forbi!" vs "We invite you"
    emphasizeHygge: boolean       // Nordic warmth concept
  }
  
  languageRules: {
    allowEnglishLoanWords: boolean
    preferLocalTerms: boolean
    avoidAmericanisms: boolean    // Block "awesome", "guys", "y'all"
  }
  
  mealTerms: {
    breakfast: string[]           // ["morgenmad", "breakfast"]
    lunch: string[]               // ["frokost", "lunch"]
    dinner: string[]              // ["aften", "aftensmad", "middag"]
    lateNight: string[]           // ["sen aften", "cocktails"]
  }
}
```

**Supported Locales**:
- `da-DK`: Danish/Denmark - Informal, minimal emoji, hygge emphasis, lunch 11:00-15:00
- `sv-SE`: Swedish/Sweden - Lagom mentality, reserved CTAs, lunch 11:00-14:00 (earlier!)
- `de-DE`: German/Germany - Formal, Gemütlichkeit, stricter English rules
- `en-US`: English/USA - Informal, frequent emoji, 12h time
- `en-GB`: English/UK - Mixed formality, British terms, 24h time

**Usage**:
```typescript
const locale = getLocaleConfig('Danish', 'DK')
console.log(locale.mealTimes.lunch) // "11:00-15:00"
console.log(locale.culturalNorms.emphasizeHygge) // true

// Fallback support
const locale2 = getLocaleConfig('Danish') // Uses 'DK' as default
```

### 2. menu-rules.ts

**Purpose**: Deterministic menu validation - ensures menu items match intended daypart

**Key Functions**:

```typescript
// Extract category from menu item
extractMenuCategory(menuItem: MenuItem): string | null

// Get allowed dayparts for category
getAllowedDayparts(category: string): Daypart[]
// Examples:
// 'BREAKFAST' → ['breakfast']
// 'FROKOST' → ['lunch']
// 'AFTEN' → ['dinner']
// 'COCKTAILS' → ['dinner', 'lateNight']

// Infer daypart from time string
inferDaypartFromTime(time: string, locale: LocaleConfig): Daypart | null
// "08:30" → 'breakfast'
// "12:00" → 'lunch'
// "18:00" → 'dinner'

// Infer daypart from content text
inferDaypartFromText(text: string, locale: LocaleConfig): Daypart | null
// "God morgen!" → 'breakfast'
// "Frokosttilbud" → 'lunch'
// "Aftensmad" → 'dinner'

// Validate menu item in context
validateMenuItemInContext(
  menuItem: MenuItem,
  time: string,
  text: string,
  language: string,
  country: string
): { valid: boolean; reason?: string; suggestedFix?: string }

// Generate prompt guidance (REPLACES old analyzeMenuCategories)
getMenuCategoryGuidance(
  menuItems: MenuItem[],
  language: string,
  country: string
): string
```

**Category Mappings** (10 universal mappings):
- BREAKFAST → breakfast only
- BRUNCH → breakfast + lunch
- FROKOST (Danish) → lunch only
- LUNCH → lunch only
- AFTEN (Danish/Norwegian) → dinner only
- MIDDAG (Swedish) → dinner only
- DINNER → dinner only
- COCKTAILS → dinner + lateNight
- DRINKS → all dayparts
- DESSERT → all dayparts

**Example Validation**:
```typescript
// FROKOST item at 18:00 (dinner time)
const result = validateMenuItemInContext(
  { name: "Clubsandwich", category: "FROKOST" },
  "18:00",
  "Aftensmad",
  "Danish",
  "DK"
)
// result.valid = false
// result.reason = "Menu item 'Clubsandwich' from FROKOST category cannot be used for dinner"
// result.suggestedFix = "Choose items from AFTEN or DINNER categories for dinner posts"
```

### 3. brand-guards.ts [TODO]

**Purpose**: Brand voice and language purity validation

**Planned Functions**:
```typescript
// Check forbidden terms
checkForbiddenTerms(text: string, forbidden: string[]): ValidationResult

// Validate tone compliance
validateToneCompliance(text: string, toneKeywords: string[]): ValidationResult

// Check language purity (no American expressions)
checkLanguagePurity(text: string, locale: LocaleConfig): ValidationResult

// Detect Americanisms
checkAmericanisms(text: string, locale: LocaleConfig): ValidationResult
// Examples to block: "awesome", "guys", "y'all", "super excited"
```

### 4. platform-rules.ts [TODO]

**Purpose**: Platform-specific constraints and best practices

**Planned Structure**:
```typescript
interface PlatformRules {
  instagram: {
    maxLength: 2200
    maxHashtags: 30
    allowLinks: false              // Only in bio
    enforceVisualFocus: true
    preferStories: true
  }
  facebook: {
    maxLength: 63206
    maxHashtags: 'unlimited'       // But don't spam
    allowLinks: true
    enforceVisualOptional: false
  }
  linkedin: {
    maxLength: 3000
    maxHashtags: 5                 // Professional limit
    allowLinks: true
    formalTone: true
    noEmojis: true                 // Unless B2C brand
  }
}
```

## Integration Points

### 1. Prompt Builder (generators/prompt-builder.ts)

**Before Policy Layer**:
```typescript
// Hardcoded, American-centric
function buildSystemPrompt(language: string): string {
  return `You are a social media expert...
  - Use emojis
  - Be enthusiastic!
  - Keep it casual`
}
```

**After Policy Layer**:
```typescript
import { getLocaleConfig } from '../policies/locale-config.ts'
import { getMenuCategoryGuidance } from '../policies/menu-rules.ts'

function buildSystemPrompt(language: string): string {
  const locale = getLocaleConfig(language)
  
  return `You are a ${language} social media expert for ${locale.country}...
  
  CULTURAL CONTEXT:
  - Formality: ${locale.culturalNorms.formalityLevel}
  - Emoji usage: ${locale.culturalNorms.emojiUsage}
  - Exclamation limit: max ${locale.culturalNorms.exclamationLimit}
  ${locale.culturalNorms.emphasizeHygge ? '- Emphasize hygge concept' : ''}
  ${locale.culturalNorms.useImperativeCTA ? '- Use direct CTAs' : '- Use soft CTAs'}
  
  LANGUAGE RULES:
  ${locale.languageRules.avoidAmericanisms ? '- NO American expressions' : ''}
  ${locale.languageRules.allowEnglishLoanWords ? '- Natural loan words OK' : ''}`
}

function buildUserPrompt(context: GenerationContext): string {
  // OLD: const menuAnalysis = analyzeMenuCategories(context.menuItems)
  // NEW: Use policy
  const menuGuidance = getMenuCategoryGuidance(
    context.menuItems,
    context.language,
    context.businessProfile.country || 'DK'
  )
  return `...${menuGuidance}...`
}
```

**Benefits**:
- ✅ Rules enforced deterministically
- ✅ Single source of truth
- ✅ Locale-aware (Danish lunch 11-15, Swedish lunch 11-14)
- ✅ Easy to test
- ✅ Easy to extend (add new locales)

### 2. Content Validator (validators/content-validator.ts) [TODO]

**Current State**: Lenient validation with basic checks

**Planned Integration**:
```typescript
import { validateMenuItemInContext } from '../policies/menu-rules.ts'
import { checkLanguagePurity, checkAmericanisms } from '../policies/brand-guards.ts'

function validateSuggestion(suggestion: Suggestion, context: Context): ValidationError[] {
  const errors: ValidationError[] = []
  
  // 1. Menu validation (deterministic)
  if (suggestion.menuItemUsed) {
    const menuValidation = validateMenuItemInContext(
      menuItem,
      suggestion.bestTimeToPost,
      suggestion.text,
      context.language,
      context.country
    )
    
    if (!menuValidation.valid) {
      errors.push({
        field: 'menuItemUsed',
        message: menuValidation.reason,
        severity: 'error',
        suggestedFix: menuValidation.suggestedFix
      })
    }
  }
  
  // 2. Language purity (deterministic)
  const purityCheck = checkLanguagePurity(
    suggestion.text,
    getLocaleConfig(context.language, context.country)
  )
  if (!purityCheck.valid) {
    errors.push(purityCheck.error)
  }
  
  // 3. Americanism detection (deterministic)
  if (locale.languageRules.avoidAmericanisms) {
    const americanismCheck = checkAmericanisms(suggestion.text, locale)
    if (!americanismCheck.valid) {
      errors.push(americanismCheck.error)
    }
  }
  
  return errors
}
```

## Benefits of Policy Layer

### 1. Deterministic Enforcement

**Problem**: AI can ignore prompt instructions
```typescript
// Prompt says: "Max 1 exclamation point"
// AI generates: "Kom forbi! Vi glæder os! Det bliver fantastisk!"
```

**Solution**: Validate in code
```typescript
const locale = getLocaleConfig('Danish')
if (exclamationCount > locale.culturalNorms.exclamationLimit) {
  return ValidationError('Too many exclamation points')
}
```

### 2. Locale Awareness

**Problem**: One-size-fits-all approach
```typescript
// Prompt says: "Lunchtime is 12-14"
// Wrong for Denmark (11-15) and Sweden (11-14)
```

**Solution**: Locale-specific rules
```typescript
const locale = getLocaleConfig('Danish', 'DK')
const lunchTime = locale.mealTimes.lunch // "11:00-15:00"

const locale2 = getLocaleConfig('Swedish', 'SE')
const lunchTime2 = locale2.mealTimes.lunch // "11:00-14:00"
```

### 3. Maintainability

**Problem**: Rules scattered across codebase
- Language rules in prompt-builder.ts
- Validation logic in content-validator.ts
- Menu analysis in data-sources/menu.ts

**Solution**: Single source of truth
- All locale rules in `policies/locale-config.ts`
- All menu rules in `policies/menu-rules.ts`
- All brand rules in `policies/brand-guards.ts`

### 4. Testability

**Problem**: Hard to test prompts
```typescript
// How do you unit test this?
const prompt = "Generate Danish content with hygge"
```

**Solution**: Test deterministic functions
```typescript
test('Danish locale should have hygge emphasis', () => {
  const locale = getLocaleConfig('Danish', 'DK')
  expect(locale.culturalNorms.emphasizeHygge).toBe(true)
})

test('FROKOST item invalid for dinner', () => {
  const result = isMenuItemValidForDaypart(
    { name: "Clubsandwich", category: "FROKOST" },
    'dinner'
  )
  expect(result).toBe(false)
})
```

### 5. Extensibility

**Problem**: Hard to add new countries
- Need to update prompts
- Need to update validation
- Need to update menu analysis
- Risk of inconsistency

**Solution**: Add one config object
```typescript
// Adding Norwegian support
export const LOCALE_CONFIGS: LocaleConfig[] = [
  // ... existing configs
  {
    language: 'Norwegian',
    country: 'Norway',
    timeFormat: '24h',
    mealTimes: {
      breakfast: '07:00-10:00',
      lunch: '11:00-14:00',    // Earlier like Sweden
      dinner: '16:00-20:00',   // Earlier than Denmark!
      lateNight: '20:00-02:00'
    },
    culturalNorms: {
      formalityLevel: 'informal',
      emojiUsage: 'minimal',
      exclamationLimit: 1,
      useImperativeCTA: true,
      emphasizeHygge: true     // Koselig (Norwegian hygge)
    },
    languageRules: {
      allowEnglishLoanWords: true,
      preferLocalTerms: true,
      avoidAmericanisms: true
    },
    mealTerms: {
      breakfast: ['frokost', 'breakfast'],  // Note: "frokost" = breakfast in Norwegian!
      lunch: ['lunsj', 'lunch'],
      dinner: ['middag', 'kveldsmat'],
      lateNight: ['sen kveld', 'nattmat']
    }
  }
]

// Add Norwegian menu categories
const NORWEGIAN_CATEGORIES = [
  { category: 'FROKOST', allowedDayparts: ['breakfast'] },  // Different from Danish!
  { category: 'LUNSJ', allowedDayparts: ['lunch'] },
  { category: 'MIDDAG', allowedDayparts: ['dinner'] }
]
```

## Migration from Old System

### Old Approach (Scattered Rules)

**generators/prompt-builder.ts**:
```typescript
function analyzeMenuCategories(menuItems: MenuItem[]) {
  return {
    morning: menuItems.filter(i => i.category?.includes('BREAKFAST')).length,
    lunch: menuItems.filter(i => i.category?.includes('FROKOST')).length,
    dinner: menuItems.filter(i => i.category?.includes('AFTEN')).length
  }
}

const prompt = `Available: ${analysis.lunch} lunch items`
```

**validators/content-validator.ts**:
```typescript
// Hardcoded English phrase detection
if (text.includes('by the river')) {
  errors.push('Detected English phrase')
}
```

### New Approach (Policy Layer)

**policies/menu-rules.ts**:
```typescript
export function getMenuCategoryGuidance(
  menuItems: MenuItem[],
  language: string,
  country: string
): string {
  const locale = getLocaleConfig(language, country)
  const categories = extractCategories(menuItems)
  
  // Locale-aware guidance
  return `MENU CATEGORIES:
  ${categories.map(cat => {
    const dayparts = getAllowedDayparts(cat)
    const localTerm = getLocalTerm(cat, locale)
    return `- ${cat} (${localTerm}): Valid for ${dayparts.join(', ')}`
  }).join('\n')}`
}
```

**policies/brand-guards.ts**:
```typescript
export function checkLanguagePurity(
  text: string,
  locale: LocaleConfig
): ValidationResult {
  if (!locale.languageRules.avoidAmericanisms) {
    return { valid: true }
  }
  
  const americanisms = ['awesome', 'guys', 'super excited', 'by the river']
  for (const phrase of americanisms) {
    if (text.toLowerCase().includes(phrase)) {
      return {
        valid: false,
        error: `Detected Americanism: "${phrase}"`,
        suggestedFix: getLocalAlternative(phrase, locale)
      }
    }
  }
  
  return { valid: true }
}
```

## Next Steps

### Completed ✅
- [x] Create `policies/locale-config.ts` (5 locales: da-DK, sv-SE, de-DE, en-US, en-GB)
- [x] Create `policies/menu-rules.ts` (deterministic daypart validation)
- [x] Update `generators/prompt-builder.ts` to use policies
- [x] Deploy updated version

### In Progress 🔄
- [ ] Update `validators/content-validator.ts` to use `menu-rules.ts`
- [ ] Test end-to-end with real data

### Pending ⏳
- [ ] Create `policies/brand-guards.ts` (forbidden terms, tone compliance, Americanism detection)
- [ ] Create `policies/platform-rules.ts` (Instagram/Facebook/LinkedIn rules)
- [ ] Add Norwegian support (nb-NO)
- [ ] Add Finnish support (fi-FI)
- [ ] Add unit tests for policy functions
- [ ] Performance testing (policy calls should be fast)

## Usage Examples

### Example 1: Generate Danish Content

```typescript
// System automatically uses policies
const locale = getLocaleConfig('Danish', 'DK')

// Prompt builder uses locale
const systemPrompt = buildSystemPrompt('Danish')
// Contains:
// - Formality: informal
// - Emoji usage: minimal
// - Max 1 exclamation point
// - Emphasize hygge
// - Use imperative CTAs ("Kom forbi!")

// Menu guidance uses locale
const menuGuidance = getMenuCategoryGuidance(menuItems, 'Danish', 'DK')
// Contains:
// - FROKOST = lunch (11:00-15:00)
// - AFTEN = dinner (17:00-22:00)
// - COCKTAILS = dinner + late night
```

### Example 2: Validate Menu Item Usage

```typescript
// User generates post for 18:00 (dinner) but uses FROKOST item
const validation = validateMenuItemInContext(
  { name: "Clubsandwich", category: "FROKOST", price: "89" },
  "18:00",
  "God aftensmad",
  "Danish",
  "DK"
)

// validation.valid = false
// validation.reason = "Menu item 'Clubsandwich' from FROKOST category cannot be used for dinner"
// validation.suggestedFix = "Choose items from AFTEN or DINNER categories for dinner posts"
```

### Example 3: Add New Locale

```typescript
// 1. Add to locale-config.ts
{
  language: 'Finnish',
  country: 'Finland',
  timeFormat: '24h',
  mealTimes: {
    breakfast: '07:00-10:00',
    lunch: '10:30-13:30',  // Finns eat lunch early!
    dinner: '16:00-19:00',  // And dinner very early!
    lateNight: '19:00-02:00'
  },
  culturalNorms: {
    formalityLevel: 'informal',
    emojiUsage: 'minimal',
    exclamationLimit: 0,  // Finns are very reserved!
    useImperativeCTA: false,
    emphasizeHygge: false  // Different concept in Finland
  },
  languageRules: {
    allowEnglishLoanWords: true,
    preferLocalTerms: true,
    avoidAmericanisms: true
  },
  mealTerms: {
    breakfast: ['aamiainen'],
    lunch: ['lounas'],
    dinner: ['illallinen', 'päivällinen'],
    lateNight: ['ilta', 'yö']
  }
}

// 2. Add Finnish menu categories to menu-rules.ts
const FINNISH_CATEGORIES = [
  { category: 'AAMIAINEN', allowedDayparts: ['breakfast'] },
  { category: 'LOUNAS', allowedDayparts: ['lunch'] },
  { category: 'ILLALLINEN', allowedDayparts: ['dinner'] }
]

// 3. Done! System now fully supports Finnish
```

## Design Principles

1. **Separation of Concerns**: Rules (deterministic) separate from prompts (probabilistic)
2. **Single Source of Truth**: One place to update, not scattered across files
3. **Locale First**: Every decision considers cultural context
4. **Fail Fast**: Validate early, before expensive AI calls
5. **Testable**: Pure functions that can be unit tested
6. **Extensible**: Easy to add new locales, categories, rules
7. **Type Safe**: Full TypeScript typing for safety
8. **Performance**: Fast lookups, no expensive operations
9. **Maintainable**: Clear structure, well-documented
10. **User Friendly**: Clear error messages with suggested fixes

## Conclusion

The policy layer transforms ai-generate-v2 from a generic American-centric system into a truly **locale-aware** platform that respects cultural nuances, meal times, language purity, and local conventions.

**Before**: "Generate enthusiastic content! Use lots of emojis! Be super excited!"

**After**: 
- Denmark: Informal tone, max 1 !, minimal emoji, hygge emphasis, lunch 11-15
- Sweden: Lagom mentality, reserved CTAs, lunch 11-14
- Germany: Formal tone, no !, Gemütlichkeit, strict language
- Each market gets content that feels **local**, not American.

This is the foundation for scaling to 50+ countries while maintaining quality and cultural authenticity.
