# AI Functions Architecture Guide

This document outlines how AI functionalities are structured in the Post2Grow codebase. Use this as a reference when building or modifying AI features.

---

## 📁 File Structure

```
supabase/functions/
├── _shared/
│   ├── ai-config.ts              # ⭐ CENTRALIZED CONFIG - models, tasks, languages
│   ├── ai-extractors/
│   │   ├── basic-info-extractor.ts
│   │   ├── contact-extractor.ts
│   │   ├── keywords-extractor.ts
│   │   └── menu-extractor.ts
│   └── brand-profile/
│       ├── languages.ts          # Brand profile language prompts
│       ├── prompts/
│       │   ├── prompt-a.ts       # Analysis prompt
│       │   └── prompt-b.ts       # Generation prompt
│       └── ...
├── ai-photo-idea/                # Photo suggestion function
├── ai-generate/                  # Post generation (tier-based)
├── ai-enhance/                   # Content enhancement (tier-based)
├── analyze-website/              # Website analysis orchestrator
├── analyze-photo/                # Image analysis (Gemini)
├── spelling/                     # Spelling correction
├── brand-profile-generator/      # Brand profile (2-prompt system)
├── menu-extract-v2/              # Menu extraction from URLs
└── generate-brand-context/       # Brand context document
```

---

## ⚙️ Centralized AI Config

**File:** `supabase/functions/_shared/ai-config.ts`

### Models

```typescript
export const AI_MODELS = {
  premium: 'gpt-4o',      // Best quality, ~$5/1M input tokens
  fast: 'gpt-4o-mini',    // Good quality, ~$0.15/1M input tokens
  vision: 'gemini-2.0-flash-exp'  // Image analysis
}
```

### Task Configurations

Each AI task has predefined settings:

```typescript
export const AI_TASKS = {
  basicInfo:    { model: 'gpt-4o', temperature: 0.1, maxTokens: 300 },
  contact:      { model: 'gpt-4o', temperature: 0.1, maxTokens: 500 },
  keywords:     { model: 'gpt-4o', temperature: 0.3, maxTokens: 200 },
  menu:         { model: 'gpt-4o', temperature: 0.0, maxTokens: 3000 },
  photoIdea:    { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 100 },
  spelling:     { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 1200 },
  // ... more tasks
}
```

### Content Limits

```typescript
export const CONTENT_LIMITS = {
  basicInfo: 3000,   // chars sent to AI
  contact: 8000,     // needs more to find footer
  keywords: 2000,
  menu: 50000,
}
```

---

## 🌍 Language Support

### Supported Languages

| Code | Language | Country | Phone Code |
|------|----------|---------|------------|
| `da` | Danish | Danmark | +45 |
| `no` | Norwegian | Norge | +47 |
| `sv` | Swedish | Sverige | +46 |
| `de` | German | Deutschland | +49 |
| `en` | English | United Kingdom | +44 |

### Language Mapping

The system automatically normalizes various language codes:

```typescript
// All of these → 'da'
'da', 'dk', 'dan'

// All of these → 'no'
'no', 'nb', 'nn', 'nor'

// All of these → 'de'
'de', 'deu', 'ger', 'at', 'ch'
```

### Using Language in Extractors

```typescript
import { getLanguageCode, type LanguageCode } from '../ai-config.ts'

// Get normalized language code
const langCode = getLanguageCode(htmlLangAttribute, 'da') // default to 'da'
```

---

## 🆕 Adding a New Language

### Step 1: Update `ai-config.ts`

```typescript
// Add to LanguageCode type
export type LanguageCode = 'da' | 'no' | 'sv' | 'de' | 'en' | 'fi'

// Add to LANGUAGES
export const LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  // ... existing ...
  fi: {
    code: 'fi',
    name: 'Finnish',
    nativeName: 'Suomi',
    countryCode: 'FI',
    phoneCode: '+358',
    postalCodeDigits: 5,
    defaultCountry: 'Suomi'
  }
}

// Add to LANGUAGE_MAP
export const LANGUAGE_MAP: Record<string, LanguageCode> = {
  // ... existing ...
  'fi': 'fi', 'fin': 'fi'
}
```

### Step 2: Add Language-Specific Prompts

Each extractor has its own prompts. Add entries to:

1. **basic-info-extractor.ts** → `LANGUAGE_PROMPTS`
2. **contact-extractor.ts** → `COUNTRY_CONFIGS`
3. **keywords-extractor.ts** → `LANGUAGE_PROMPTS`
4. **ai-photo-idea/index.ts** → `LANGUAGE_PROMPTS`
5. **brand-profile/languages.ts** → Full prompt set

---

## 📝 Prompt Best Practices

### 1. Language Preservation

Always instruct the AI to preserve the original language:

```typescript
// ✅ Good
system: `Skriv ALTID på DANSK. Oversæt ALDRIG til engelsk.`

// ❌ Bad - AI may translate
system: `Extract business information.`
```

### 2. JSON Response Format

Force JSON output for structured data:

```typescript
body: JSON.stringify({
  model: taskConfig.model,
  messages: [...],
  response_format: { type: 'json_object' }  // ← Forces valid JSON
})
```

### 3. Temperature Guidelines

| Temperature | Use Case |
|-------------|----------|
| 0.0 | Precise extraction (menu items) |
| 0.1 | Structured data (contact, basic info) |
| 0.3 | Keywords, spelling, photo ideas |
| 0.5 | Brand profile generation |
| 0.7-0.8 | Creative content (posts) |

### 4. System Prompt Structure

```typescript
const LANGUAGE_PROMPTS = {
  da: {
    system: `Du er [rolle].
    
KRITISKE REGLER:
- ✅ Gør dette
- ❌ Gør IKKE dette
    
Returner KUN gyldig JSON.`,
    userPromptSuffix: 'Specifik instruktion på dansk...'
  }
}
```

---

## 💡 AI Ideas (3 post-ideer)

AI Ideas er en “strict JSON + validering” flow, som genererer **præcis 3** post-ideer baseret på brandprofil + menupunkter.

AI Ideas er **ikke kun** “menu-spotlights”: ideerne kan også dække visuals, proces, team, stemning, social proof og engagement – så længe de overholder guardrails (ingen opfindelser).

### Hvor ligger prompten?

- **Frontend (prompt-bygning + i18n):**
  - `src/features/aiPromptBuilder.ts` bygger den fulde prompt (brandprofil, regler, menupunkter, outputformat).
  - `src/features/promptI18n.ts` indeholder de lokaliserede danske/engelske overskrifter og instruktioner.
- **Backend (generation + validering):**
  - `supabase/functions/ai-generate/index.ts` vælger system prompt, kalder modellen, validerer output og retry’er én gang ved fejl.

### Sprog-markør og robuste overskrifter

- Prompten inkluderer en maskinlæsbar linje: `PROMPT_SPROG: da|en`.
  - Backenden accepterer også legacy `PROMPT_LANGUAGE: ...`.
- For dansk prompt bruges **fuldt danske sektionstitler** (fx `MENUPUNKTER`, `TONEANKRE`, `OUTPUTFORMAT`).
  - Backenden kan parse både engelske og danske varianter af de relevante overskrifter.

### Output (strict JSON)

AI Ideas forventer et objekt med `ideas`, hvor `ideas` er en array med **3** elementer.

Minimumsfelter pr. idé:

- `title`, `headline`, `text`, `photoSuggestion`
- `menuItemUsed` (eksakt match fra MENUPUNKTER-listen)
- `bestTimeToPost` (kort én-linjers ugedag + tidsvindue)
- `impact` (`low` | `medium` | `high`)

### Server-side guardrails

- Præcis 3 ideer.
- Hver idé skal bruge et **forskelligt** menupunkt.
- `menuItemUsed` skal matche **tegn-for-tegn** en linje fra MENUPUNKTER.
- Kundevendt tekst må ikke inkludere kategori-suffix: hvis `menuItemUsed` er `RET (KATEGORI)`, skal `text` indeholde `RET` uden parentes-delen.
- Tone: mindst én idé skal indeholde én af de eksakte `TONEANKRE`-fraser (hvis de findes).
- Anti-hype: begræns udråbstegn og undgå FOMO/klichéer.

### Indholdspiller (konceptuelt)

Brug disse som “vinkler” for variation mellem de 3 ideer. Hvis der er menupunkter, skal hver idé stadig knyttes til ét konkret menupunkt via `menuItemUsed`.

1. **Crave-worthy visuals**
  - Close-up på signaturret, tekstur, damp, “pour”/sauce, knas.
  - Foto/video-forslag skal matche Billedpræferencer.

2. **Proces (Reels/TikTok-stil)**
  - Kort, snappy “fra køkken til servering”: anretning, samling, barista-flow.
  - God til at signalere “friskt og hurtigt” (fx food trucks) uden at love noget nyt.

3. **Behind-the-scenes & menneske**
  - “Mød teamet” eller “dagens prep” – koblet til et menupunkt (fx teamets favorit).
  - Må ikke opfinde navne, roller eller historier hvis de ikke er kendt.

4. **Social proof & community**
  - UGC/review framing kan være stærkt, men kræver **kildekontekst** (se guardrails).
  - Alternativ: community-agtig framing uden at påstå konkrete anmeldelser.

5. **Ambience & vibe**
  - Golden hour, “tredje sted”, work-from-cafe, event recap.
  - Må gerne beskrive stemning, men undgå at påstå events/tiltag der ikke er nævnt.

6. **Engagement & interaktive posts**
  - Poll/“this or that”/spørgsmål, gerne med menupunkter som valgmuligheder.
  - Må ikke opfinde giveaways, præmier eller rabatter.

### Guardrails for “ekstra” vinkler

Når ideer går ud over ren menutekst, gælder disse principper:

- **Sæson-specials / limited time**: Kun hvis vi eksplicit har et sæsonprodukt/special i data. Ellers må AI ikke skabe falsk “urgency”.
- **UGC / reviews**: Kun hvis vi har en reel anmeldelse eller post-historik som kilde. Ellers må AI højest formulere generisk “folk elsker…”-agtig framing uden at citere eller påstå stjerner.
- **Partnerskaber (lokale bryggerier, leverandører, florist, osv.)**: Kun hvis partneren er nævnt i data.
- **Secret menu / hacks / tips**: Kun hvis “hack’et” er kendt/angivet. Ingen opfundne kombinationer eller “hemmelige” produkter.
- **Giveaways / vouchers**: Må ikke opfindes. Hvis der en dag kommer en officiel giveaway-feature, skal præmier/krav komme fra produktdata, ikke fra AI.

---

## 🔄 Extractor Pattern

All extractors follow this pattern:

```typescript
import { AI_TASKS, getLanguageCode } from '../ai-config.ts'

export async function extractSomething(
  content: string,
  openaiApiKey: string,
  languageHint?: string | null
): Promise<SomeResult> {
  
  // 1. Get language config
  const langCode = getLanguageCode(languageHint, 'da')
  const langConfig = LANGUAGE_PROMPTS[langCode]
  const taskConfig = AI_TASKS.somethingTask
  
  // 2. Build prompt
  const prompt = `...${content.slice(0, CONTENT_LIMITS.something)}...`
  
  // 3. Call OpenAI
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: taskConfig.model,
      messages: [
        { role: 'system', content: langConfig.system },
        { role: 'user', content: prompt }
      ],
      temperature: taskConfig.temperature,
      max_tokens: taskConfig.maxTokens,
      response_format: { type: 'json_object' }
    })
  })
  
  // 4. Parse and return
  const data = await response.json()
  return JSON.parse(data.choices[0].message.content)
}
```

---

## 💰 Tier-Based Model Selection

Some functions upgrade the model based on user subscription:

```typescript
import { getModelForTier, type UserTier } from '../_shared/ai-config.ts'

// Returns { model, temperature, maxTokens } based on tier
const config = getModelForTier(userTier)

// Tier configs:
// free:        gpt-4o-mini, temp 0.3, 500 tokens
// standardplus: gpt-4o, temp 0.7, 1000 tokens
// premium:     gpt-4o, temp 0.7, 1500 tokens
```

---

## 🖼️ Image Analysis (Gemini)

The `analyze-photo` function uses Google Gemini for vision:

```typescript
// Model: gemini-2.0-flash-exp
// Endpoint: https://generativelanguage.googleapis.com/v1beta/models/...

// Image is passed as base64 in the request:
{
  contents: [{
    parts: [
      { text: prompt },
      { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
    ]
  }]
}
```

---

## 📊 Cost Optimization Tips

1. **Use gpt-4o-mini for simple tasks** (spelling, photo ideas)
2. **Limit content sent** via `CONTENT_LIMITS`
3. **Cache results** where possible (e.g., website analysis)
4. **Set appropriate maxTokens** - don't over-allocate

---

## 🚀 Deployment

After modifying AI functions:

```bash
# Deploy specific function
supabase functions deploy analyze-website

# Deploy all functions
supabase functions deploy
```

---

## 📋 Quick Reference

| Task | Model | Temp | Tokens | Language-Aware |
|------|-------|------|--------|----------------|
| Basic Info | gpt-4o | 0.1 | 300 | ✅ |
| Contact | gpt-4o | 0.1 | 500 | ✅ |
| Keywords | gpt-4o | 0.3 | 200 | ✅ |
| Menu | gpt-4o | 0.0 | 3000 | ❌ (preserves original) |
| Photo Idea | gpt-4o-mini | 0.3 | 100 | ✅ |
| Spelling | gpt-4o-mini | 0.3 | 1200 | ✅ (auto-detect) |
| Brand Analysis | gpt-4o | 0.3 | 2000 | ✅ |
| Brand Generation | gpt-4o | 0.5 | 3000 | ✅ |
| Post Generation | tier-based | 0.8 | 1500 | ⚠️ (AI Ideas: ✅ via PROMPT_SPROG; andre flows kan variere) |
| Photo Analysis | Gemini | 0.7 | 2048 | ✅ |
