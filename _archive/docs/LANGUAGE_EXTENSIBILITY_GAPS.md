# Language Extensibility Gaps & Solutions

## Current State

The language leakage and anchor provenance fixes work well for **Danish, Swedish, and German** but require **manual configuration** for each new language.

---

## Required Updates Per Language

### 1. Language Validator (`validators/language-validator.ts`)

**What's Needed**:
```typescript
// ADD TO: LANGUAGE_SPECIFIC_CHECKS
'fr': {
  forbiddenPhrases: [
    { en: 'by the water', local: 'au bord de l\'eau' },
    { en: 'come in', local: 'entrez' },
    { en: 'try our', local: 'essayez notre' },
    { en: 'perfect for', local: 'parfait pour' }
  ],
  frenchEquivalents: {
    'by the water': 'au bord de l\'eau',
    'come in': 'entrez',
    'try our': 'essayez notre'
  }
},
'es': {
  forbiddenPhrases: [
    { en: 'by the water', local: 'junto al río' },
    { en: 'come in', local: 'ven' },
    { en: 'try our', local: 'prueba nuestro' }
  ],
  spanishEquivalents: { /* ... */ }
}
```

**Currently Missing**: French, Spanish, Italian, Norwegian, Finnish, Dutch, Polish, etc.

---

### 2. Fallback Templates (`validators/fallback-generator.ts`)

**What's Needed**:
```typescript
// ADD TO: LOCALE_TEMPLATES
'fr': {
  menu_spotlight: {
    caption: (item, anchor, reasoning) => 
      `Essayez notre ${item}. ${anchor || ''} ${reasoning || ''}`,
    hookSuffix: ''
  },
  vibe_reminder: {
    caption: (anchor, businessName) => 
      `${anchor}. Venez découvrir ${businessName}.`,
    defaultAnchor: 'Venez nous découvrir'
  },
  occasion_prompt: {
    caption: (occasion, cta, businessName) =>
      `${occasion}. ${cta} chez ${businessName}.`,
    hookPhrases: {
      breakfast: 'Commencez bien la journée',
      lunch: 'C\'est l\'heure du déjeuner?',
      dinner: 'Dîner ce soir?',
      lateNight: 'Soirée tardive?',
      default: 'Besoin d\'une pause?'
    },
    ctaPhrases: {
      book: 'Réservez votre table',
      visit: 'Venez nous voir',
      menu: 'Voir notre menu',
      engage: 'Dites-nous ce que vous en pensez'
    }
  }
},
'es': {
  menu_spotlight: {
    caption: (item, anchor, reasoning) => 
      `Prueba nuestro ${item}. ${anchor || ''} ${reasoning || ''}`,
    hookSuffix: ''
  },
  vibe_reminder: {
    caption: (anchor, businessName) => 
      `${anchor}. Ven a disfrutar de ${businessName}.`,
    defaultAnchor: 'Ven a visitarnos'
  },
  occasion_prompt: {
    caption: (occasion, cta, businessName) =>
      `${occasion}. ${cta} en ${businessName}.`,
    hookPhrases: {
      breakfast: 'Empieza el día bien',
      lunch: '¿Hora de almorzar?',
      dinner: '¿Cena esta noche?',
      lateNight: '¿Noche tardía?',
      default: '¿Necesitas un descanso?'
    },
    ctaPhrases: {
      book: 'Reserva tu mesa',
      visit: 'Ven a visitarnos',
      menu: 'Ver nuestro menú',
      engage: 'Cuéntanos qué piensas'
    }
  }
}
```

**Currently Missing**: All languages except da/sv/de

---

### 3. Anchor Extraction (`policies/brand-policy-compiler.ts`)

**What's Needed**:
```typescript
// Location patterns need localization
const LOCATION_PATTERNS = {
  da: [
    { pattern: /ved (åen|vandet|havet|søen)\s+i\s+(\w+)/gi, confidence: 'high' },
    { pattern: /(i hjertet af|midt i)\s+(\w+)/gi, confidence: 'high' }
  ],
  fr: [
    { pattern: /au bord de (l'eau|la rivière|la mer)\s+à\s+(\w+)/gi, confidence: 'high' },
    { pattern: /(au cœur de|au centre de)\s+(\w+)/gi, confidence: 'high' }
  ],
  es: [
    { pattern: /junto al (río|agua|mar)\s+en\s+(\w+)/gi, confidence: 'high' },
    { pattern: /(en el corazón de|en el centro de)\s+(\w+)/gi, confidence: 'high' }
  ]
  // ... more languages
}

// Generic keywords also need localization
const GENERIC_KEYWORDS = {
  da: ['hyggelig', 'god', 'dejlig', 'nice', 'cozy'],
  fr: ['agréable', 'sympathique', 'chaleureux', 'nice', 'cozy'],
  es: ['acogedor', 'agradable', 'simpático', 'nice', 'cozy']
}
```

**Currently**: Only Danish patterns exist

---

### 4. Prompt Language Guidance (`generators/prompt-builder.ts`)

**What's Needed**:
```typescript
// ADD TO: getLanguageGuidance()
case 'fr':
  return `⚠️ EXIGENCE ABSOLUE: TOUTE LA SORTIE DOIT ÊTRE 100% FRANÇAIS
- PAS de mots anglais sauf noms propres (noms d'entreprises, marques)
- PAS de phrases anglaises comme "by the water", "come in", "try our"
- UTILISEZ UNIQUEMENT le français: "au bord de l'eau", "entrez", "essayez notre"
- EN CAS DE DOUTE: Utilisez un français plus simple plutôt que l'anglais
- CECI N'EST PAS NÉGOCIABLE - La sortie en anglais est INVALIDE

Erreurs courantes à éviter:
❌ "by the water" → ✅ "au bord de l'eau"
❌ "come in" → ✅ "entrez"
❌ "try our" → ✅ "essayez notre"`

case 'es':
  return `⚠️ REQUISITO ABSOLUTO: TODA LA SALIDA DEBE SER 100% ESPAÑOL
- NO palabras en inglés excepto nombres propios (nombres de empresas, marcas)
- NO frases en inglés como "by the water", "come in", "try our"
- USE SOLO español: "junto al río", "ven", "prueba nuestro"
- SI TIENE DUDAS: Use español más simple en lugar de inglés
- ESTO NO ES NEGOCIABLE - La salida en inglés es INVÁLIDA

Errores comunes a evitar:
❌ "by the water" → ✅ "junto al río"
❌ "come in" → ✅ "ven"
❌ "try our" → ✅ "prueba nuestro"`
```

**Currently**: Only handles da/sv/de

---

## Solution: Language Configuration System

### Proposed Architecture

```typescript
// NEW FILE: config/language-configs.ts

export interface LanguageConfig {
  code: string  // ISO 639-1 (da, sv, de, fr, es, etc.)
  name: string  // Display name
  
  // Language validator config
  forbiddenTokens: string[]  // English words to detect
  forbiddenPhrases: Array<{ en: string, local: string }>
  
  // Fallback template config
  templates: {
    menu_spotlight: {
      caption: (item: string, anchor: string, reasoning?: string) => string
      hookSuffix: string
    }
    vibe_reminder: {
      caption: (anchor: string, businessName: string) => string
      defaultAnchor: string
    }
    occasion_prompt: {
      caption: (occasion: string, cta: string, businessName: string) => string
      hookPhrases: Record<string, string>
      ctaPhrases: Record<string, string>
    }
  }
  
  // Anchor extraction patterns
  anchorPatterns: {
    location: Array<{ pattern: RegExp, confidence: 'high' | 'medium' }>
    interior: string[]  // Generic keywords to avoid
    experience: Array<{ pattern: RegExp, confidence: 'high' | 'medium' }>
  }
  
  // Prompt guidance
  languageGuidance: string  // Instructions for GPT-4o
  commonMistakes: Array<{ wrong: string, correct: string }>
  
  // Cultural context
  formality: 'formal' | 'informal' | 'mixed'
  emojiUsage: 'minimal' | 'moderate' | 'frequent'
  exclamationLimit: number
  culturalConcept?: string  // "hygge", "lagom", etc.
}

// Language registry
export const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  da: { /* Danish config */ },
  sv: { /* Swedish config */ },
  de: { /* German config */ },
  fr: { /* French config - TO BE ADDED */ },
  es: { /* Spanish config - TO BE ADDED */ },
  // ... more languages
}

// Helper to get config (with fallback)
export function getLanguageConfig(code: string): LanguageConfig {
  return LANGUAGE_CONFIGS[code] || LANGUAGE_CONFIGS['da']  // Default to Danish
}
```

### Updated Component Integration

**Language Validator**:
```typescript
import { getLanguageConfig } from '../config/language-configs.ts'

export function detectEnglishLeakage(text: string, language: string) {
  const config = getLanguageConfig(language)
  
  // Use config.forbiddenTokens instead of hardcoded list
  const englishFound = config.forbiddenTokens.filter(token => {
    const regex = new RegExp(`\\b${token}\\b`, 'i')
    return regex.test(text.toLowerCase())
  })
  
  // ... rest of logic
}
```

**Fallback Generator**:
```typescript
import { getLanguageConfig } from '../config/language-configs.ts'

export function generateMenuFallback(slot, ideaPlan, profile) {
  const config = getLanguageConfig(profile.primary_language)
  
  // Use config.templates instead of LOCALE_TEMPLATES
  const caption = config.templates.menu_spotlight.caption(
    menuItem.name,
    anchor,
    slot.reasoning
  )
  
  // ... rest of logic
}
```

**Anchor Extraction**:
```typescript
import { getLanguageConfig } from '../config/language-configs.ts'

function extractVerifiedAnchors(profile) {
  const config = getLanguageConfig(profile.primary_language)
  
  // Use config.anchorPatterns.location
  for (const { pattern, confidence } of config.anchorPatterns.location) {
    const matches = text.matchAll(pattern)
    // ... extract with confidence
  }
  
  // Check against config.anchorPatterns.interior (generic keywords)
  const isGeneric = config.anchorPatterns.interior.some(keyword =>
    text.toLowerCase().includes(keyword)
  )
}
```

**Prompt Builder**:
```typescript
import { getLanguageConfig } from '../config/language-configs.ts'

function getLanguageGuidance(language: string) {
  const config = getLanguageConfig(language)
  
  // Use config.languageGuidance directly
  return config.languageGuidance
}
```

---

## Benefits of Configuration System

✅ **Centralized**: All language-specific data in one place  
✅ **Extensible**: Add new language = add one config object  
✅ **Type-Safe**: TypeScript interface ensures completeness  
✅ **Maintainable**: Update language rules without touching logic  
✅ **Testable**: Easy to validate each language config  
✅ **Discoverable**: Clear what's needed for new languages  

---

## Migration Plan

### Phase 1: Extract Current Configs (Week 1)
- Create `config/language-configs.ts`
- Move da/sv/de configs from 4 files into registry
- Refactor components to use `getLanguageConfig()`
- Test: Ensure no regressions for existing languages

### Phase 2: Document Template (Week 1)
- Create `ADDING_NEW_LANGUAGE.md` guide
- Provide empty config template
- Document each field's purpose
- Include examples from da/sv/de

### Phase 3: Add Priority Languages (Week 2-3)
- French (fr) - High priority (European market)
- Spanish (es) - High priority (growing market)
- Norwegian (no) - Medium priority (Nordic expansion)
- Italian (it) - Medium priority (European market)

### Phase 4: Community Contributions (Ongoing)
- Open-source language configs
- Accept PRs for new languages
- Validate with native speakers
- Build language config test suite

---

## Current Risk Assessment

**For Existing Languages (da/sv/de)**:
- ✅ **LOW RISK**: Fully protected against language leakage and generic anchors

**For New Languages**:
- ⚠️ **MEDIUM RISK**: Falls back to Danish templates (language leakage likely)
- ⚠️ **HIGH RISK**: No language validation (English will slip through)
- ⚠️ **HIGH RISK**: No anchor localization (Danish patterns won't match)

**Recommendation**: 
1. Implement configuration system BEFORE adding new languages
2. Make language config a deployment requirement
3. Add validation: "Language X not supported yet" error

---

## Example: Adding French

**Step 1: Create Config**
```typescript
fr: {
  code: 'fr',
  name: 'French',
  
  forbiddenTokens: [
    'the', 'by', 'at', 'in', 'on', 'with', 'for', 'to', 'and', 'or',
    'come', 'try', 'visit', 'enjoy', 'perfect', 'amazing', 'best',
    'our', 'your', 'we', 'us', 'you',
    'food', 'drink', 'menu', 'restaurant', 'cafe', 'coffee'
    // ... full English token list
  ],
  
  forbiddenPhrases: [
    { en: 'by the water', local: 'au bord de l\'eau' },
    { en: 'come in', local: 'entrez' },
    { en: 'try our', local: 'essayez notre' },
    { en: 'perfect for', local: 'parfait pour' },
    { en: 'in the heart of', local: 'au cœur de' }
  ],
  
  templates: {
    menu_spotlight: {
      caption: (item, anchor, reasoning) => {
        let text = `Essayez notre ${item}.`
        if (anchor) text += ` ${anchor}.`
        if (reasoning) text += ` ${reasoning}`
        return text
      },
      hookSuffix: ''
    },
    vibe_reminder: {
      caption: (anchor, businessName) => 
        `${anchor}. Venez découvrir ${businessName}.`,
      defaultAnchor: 'Venez nous découvrir'
    },
    occasion_prompt: {
      caption: (occasion, cta, businessName) =>
        `${occasion}. ${cta} chez ${businessName}.`,
      hookPhrases: {
        breakfast: 'Commencez bien la journée',
        lunch: 'C\'est l\'heure du déjeuner?',
        dinner: 'Dîner ce soir?',
        lateNight: 'Soirée tardive?',
        default: 'Besoin d\'une pause?'
      },
      ctaPhrases: {
        book: 'Réservez votre table',
        visit: 'Venez nous voir',
        menu: 'Voir notre menu',
        engage: 'Dites-nous ce que vous en pensez'
      }
    }
  },
  
  anchorPatterns: {
    location: [
      { 
        pattern: /au bord de (l'eau|la rivière|la mer)\s+à\s+(\w+)/gi, 
        confidence: 'high' 
      },
      { 
        pattern: /(au cœur de|au centre de)\s+(\w+)/gi, 
        confidence: 'high' 
      },
      { 
        pattern: /près de (l'eau|la rivière|la mer)/gi, 
        confidence: 'medium' 
      }
    ],
    interior: [
      'agréable', 'sympathique', 'chaleureux', 'nice', 'cozy',
      'atmosphère', 'ambiance'  // Too generic
    ],
    experience: [
      { 
        pattern: /(parfait|idéal) pour (le déjeuner|le dîner|le brunch)/gi, 
        confidence: 'high' 
      }
    ]
  },
  
  languageGuidance: `⚠️ EXIGENCE ABSOLUE: TOUTE LA SORTIE DOIT ÊTRE 100% FRANÇAIS
- PAS de mots anglais sauf noms propres (noms d'entreprises, marques)
- PAS de phrases anglaises comme "by the water", "come in", "try our"
- UTILISEZ UNIQUEMENT le français: "au bord de l'eau", "entrez", "essayez notre"
- EN CAS DE DOUTE: Utilisez un français plus simple plutôt que l'anglais
- CECI N'EST PAS NÉGOCIABLE - La sortie en anglais est INVALIDE

Erreurs courantes à éviter:
❌ "by the water" → ✅ "au bord de l'eau"
❌ "in the heart of" → ✅ "au cœur de"
❌ "come in" → ✅ "entrez"
❌ "try our" → ✅ "essayez notre"`,
  
  commonMistakes: [
    { wrong: 'by the water', correct: 'au bord de l\'eau' },
    { wrong: 'come in', correct: 'entrez' },
    { wrong: 'try our', correct: 'essayez notre' }
  ],
  
  formality: 'mixed',  // "vous" for formal, "tu" for casual
  emojiUsage: 'moderate',
  exclamationLimit: 1,
  culturalConcept: 'Joie de vivre'
}
```

**Step 2: Test French Config**
- Validate all required fields present
- Test template generation
- Verify pattern matching on French text
- Native speaker review

**Step 3: Deploy**
- Add to `LANGUAGE_CONFIGS` registry
- No code changes needed (uses `getLanguageConfig()`)
- Immediate protection against language leakage

---

## Conclusion

**Current State**: ✅ Robust for da/sv/de, ❌ Not robust for new languages

**Solution**: Implement language configuration system

**Effort**: 
- Configuration system: 1 week
- Per new language: 2-4 hours (native speaker + developer)

**Benefit**: Truly extensible system that maintains quality across all languages
