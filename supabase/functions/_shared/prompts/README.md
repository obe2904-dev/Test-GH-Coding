# Multilingual Prompt System

**Status:** Phase 1 Complete - Infrastructure Ready  
**Version:** 1.0.0  
**Last Updated:** 2026-05-12

## Overview

This directory contains the infrastructure for managing multilingual AI prompts across all Supabase Edge Functions. The system eliminates language mixing issues by separating language-specific content into structured files.

## Problem Solved

**Before:** Language mixing in prompts caused quality issues
- English system instructions + Danish output = confused AI models
- Meta-commentary ("Based on...", "Given that...")
- Forbidden consultant-speak leaking through
- Bifurcated code for different languages

**After:** Clean language separation
- System prompts in target language
- Explicit language instructions
- Single source of truth per language
- Easy expansion to new languages

## Directory Structure

```
_shared/prompts/
├── types.ts                    # TypeScript interfaces
├── utils/
│   └── prompt-loader.ts        # Loading and compilation utilities
├── languages/
│   ├── da/                     # Danish prompts (primary)
│   │   ├── content-generation-system.ts
│   │   ├── content-generation-output.ts
│   │   └── ...more prompts...
│   ├── en/                     # English prompts (future)
│   │   └── content-generation-system.ts
│   └── sv/                     # Swedish prompts (future)
│       └── content-generation-system.ts
└── README.md                   # This file
```

## Core Types

### Language
```typescript
type Language = 'da' | 'en' | 'sv'
```

### LanguageConfig
```typescript
interface LanguageConfig {
  language: Language
  system: string              // System prompt (AI instructions)
  user?: string              // User prompt template (optional)
  closer: string             // Explicit language instruction
  metadata?: {
    version: string
    updated: string
    author?: string
    notes?: string
  }
}
```

### CompiledPrompt
```typescript
interface CompiledPrompt {
  system: string              // Complete system message
  user: string               // Complete user message
  language: Language         // Language used
  promptId: string          // Identifier
}
```

## Usage

### 1. Load a Single Language Config

```typescript
import { loadLanguageConfig } from '../_shared/prompts/utils/prompt-loader.ts'

const result = await loadLanguageConfig('da', 'content-generation-system')

if (result.success && result.prompt) {
  const config = result.prompt
  console.log(config.system)  // Danish system prompt
  console.log(config.closer)  // "Skriv KUN på dansk..."
}
```

### 2. Load Multilingual Prompt Set

```typescript
import { loadMultilingualPrompt } from '../_shared/prompts/utils/prompt-loader.ts'

const prompt = await loadMultilingualPrompt('content-generation-system', 'da')

if (prompt) {
  const daConfig = prompt.da  // Danish version
  const enConfig = prompt.en  // English version (falls back to DA if missing)
  const svConfig = prompt.sv  // Swedish version (falls back to DA if missing)
}
```

### 3. Build Complete Prompt

```typescript
import { buildPrompt, compileTemplate } from '../_shared/prompts/utils/prompt-loader.ts'

// With variables
const compiled = buildPrompt(config, {
  hospitality_register: getHospitalityRegisterBlock('da'),
  business_name: 'Café Faust'
})

// Result:
// {
//   system: "Du er en professionel... [full system prompt] Skriv KUN på dansk...",
//   user: "...",
//   language: 'da',
//   promptId: '1.0.0'
// }
```

### 4. Use Prompt Builder

```typescript
import { createPromptBuilder } from '../_shared/prompts/utils/prompt-loader.ts'

const multilingual = await loadMultilingualPrompt('content-generation-system')
const builder = createPromptBuilder(multilingual)

// Build for specific language
const daPrompt = builder.build('da', { 
  hospitality_register: '...' 
})

// Get just system message
const systemMsg = builder.getSystem('da')

// Check language support
if (builder.supports('sv')) {
  // Swedish is available
}
```

## Template Variables

Templates use `{{variable_name}}` syntax for placeholders:

```typescript
const template = "Skriv om {{topic}} i stil med {{brand}}"
const compiled = compileTemplate(template, {
  topic: 'kaffe',
  brand: 'Café Faust'
})
// Result: "Skriv om kaffe i stil med Café Faust"
```

## Creating New Language Files

### Step 1: Create the file

```typescript
// _shared/prompts/languages/da/my-new-prompt.ts

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'da',
  
  system: `Du er en professionel...
  
  {{dynamic_content}}
  
  Følg disse regler...`,
  
  user: `Skriv om {{topic}} med fokus på {{focus_area}}`,
  
  closer: `Skriv KUN på dansk. Besvar præcist som beskrevet.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Your Name',
    notes: 'Description of this prompt'
  }
}

export default config
```

### Step 2: Use it in your Edge Function

```typescript
import { loadLanguageConfig, buildPrompt } from '../_shared/prompts/utils/prompt-loader.ts'

const result = await loadLanguageConfig('da', 'my-new-prompt')

if (result.success && result.prompt) {
  const compiled = buildPrompt(result.prompt, {
    dynamic_content: '...',
    topic: 'menu',
    focus_area: 'seasonal ingredients'
  })
  
  // Use compiled.system and compiled.user with OpenAI
}
```

## Quality Guidelines

### ✅ DO

- **Use target language consistently** - If output is Danish, system prompt is Danish
- **Add explicit language closers** - "Skriv KUN på dansk. Besvar præcist..."
- **Use {{placeholders}}** - For dynamic content injection
- **Version your prompts** - Increment version on changes
- **Document changes** - Update metadata.notes

### ❌ DON'T

- **Mix languages** - No English system + Danish output
- **Skip closers** - Always include explicit language instruction
- **Hardcode values** - Use placeholders for dynamic content
- **Forget metadata** - Always include version and update date
- **Use generic instructions** - Be specific about output format

## Validation

Use the language quality tests to validate prompts:

```bash
cd supabase/functions/_shared/tests
./run-tests.sh
```

Or validate programmatically:

```typescript
import { validatePromptConfig } from '../_shared/prompts/utils/prompt-loader.ts'

const validation = validatePromptConfig(config)

if (!validation.valid) {
  console.error('Validation errors:', validation.errors)
}
```

## Migration Status

### ✅ Phase 1 Complete (Week 1-2)
- [x] Directory structure created
- [x] TypeScript types defined
- [x] Utility functions implemented
- [x] Danish content-generation system extracted
- [x] English/Swedish placeholders created

### 🔄 Phase 2 In Progress (Week 2-3)
- [ ] Update generate-text-from-idea to use new system
- [ ] Update get-quick-suggestions
- [ ] Update ai-enhance
- [ ] Update spelling
- [ ] A/B testing and gradual rollout

### ⏳ Phase 3 Pending (Week 3-4)
- [ ] Migrate brand-profile prompts
- [ ] Migrate analyze-photo prompts
- [ ] Consolidate bifurcated code
- [ ] Migrate internal processors

## Language Expansion

To add a new language:

1. **Create directory**: `languages/[lang_code]/`
2. **Copy Danish prompts**: Use DA as template
3. **Translate content**: Ensure quality translation
4. **Update types**: Add language to `Language` type if needed
5. **Test thoroughly**: Run quality tests
6. **Document**: Update this README

## Testing

Before deploying language changes:

```bash
# Run all tests
cd supabase/functions/_shared/tests
./run-tests.sh

# Run specific test
deno test language-quality.test.ts --allow-read
deno test prompt-language-consistency.test.ts --allow-read

# With integration tests (requires env vars)
export SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"
deno test integration-example.test.ts --allow-net --allow-read --allow-write
```

Quality targets:
- **English leakage:** <2%
- **Meta-commentary:** <1%
- **Forbidden phrases:** <1%
- **Overall quality:** >95%

## Support

- **Migration plan**: See `AI-PROMPT-ASSESSMENT.md` (root directory)
- **Test documentation**: See `_shared/tests/README.md`
- **Quick start**: See `_shared/tests/QUICKSTART.md`
- **Issues**: Check `_shared/tests/` for quality validation tools

## Version History

### 1.0.0 (2026-05-12)
- Initial release
- Phase 1 infrastructure complete
- Danish prompts extracted
- EN/SV placeholders created
- Quality testing framework integrated
