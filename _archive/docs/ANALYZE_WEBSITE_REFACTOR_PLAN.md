# Website Analysis Refactor - Implementeringsplan

## 📋 Bruger Beslutninger (Bekræftet)

1. ✅ **AI Model**: Switch Free tier GPT-4o → GPT-4o-mini (kan ændres tilbage)
2. ✅ **businessType**: Hybrid struktur SKAL implementeres (eksisterende data er test)
3. ✅ **Database**: Undersøg eksisterende struktur først
4. ✅ **Gemini API**: Vi har key - skal bruges
5. ✅ **Free Tier Pages**: Prioritet: About, Menu, Adresse
6. ✅ **EXTRACTOR_MODELS**: Ja, men menu: gemini → gpt-4o-mini
7. ✅ **Menu Extraction**: Supplement eksisterende system

---

## 🔍 Status efter Database/Kodebase Analyse

### Database Struktur
- ✅ **tone_of_voice**: Eksisterer i `business_brand_profile` som TEXT (ikke JSONB)
- ❌ **menu_signal**: Findes IKKE - skal oprettes i `business_profile` som JSONB

### businessType Usage (50+ steder)
**Edge Functions:**
- `analyze-website/index.ts`: Input hint og response
- Brand strategy: `goalDeduction.ts`, `offeringsDetector.ts`, `generator.ts`

**Frontend:**
- `BusinessProfilePage.tsx`, `FreeBusinessProfile.tsx`
- `ConceptFitPage.tsx`
- Type definitions: `brandStrategy/types.ts`

### Menu Extraction System
- Eksisterende: `menu-extract-v2` (komplekst paid tier system)
- Ny: `menuSignal` extractor (text-based, supplement)

---

## 🎯 Refactoring Strategi: Dual Structure Approach

### Problem: Breaking Change Risk
Hvis vi ændrer `businessType` fra string → object vil 50+ steder i koden bryde.

### Løsning: Gradual Migration Pattern
```typescript
// Phase 1: Dual structure (backwards compatible)
type BusinessType = string | {
  primary: string
  secondary?: string[]
  hybridLabel?: string
  cuisineType?: string
  conceptTags?: string[]
}

// Helper functions (create once, use everywhere)
function normalizeBusinessType(type: BusinessType): string {
  return typeof type === 'string' ? type : type.primary
}

function getBusinessTypeLabel(type: BusinessType): string {
  if (typeof type === 'string') return type
  return type.hybridLabel || type.primary
}
```

### Migration Path
1. **Week 1**: Add dual type support + helper functions
2. **Week 2**: Update extractors to return new format
3. **Week 3**: Update frontend to display hybridLabel
4. **Week 4+**: Gradually update all consumers to use helpers

---

## 📝 Implementation Steps

### TRIN 1: Database Migration
**File:** `supabase/migrations/20260218140000_add_menu_signal_column.sql`

```sql
-- Add menu_signal to business_profile
ALTER TABLE business_profile
ADD COLUMN IF NOT EXISTS menu_signal JSONB;

COMMENT ON COLUMN business_profile.menu_signal IS 'AI-extracted menu signal from website (Free+Paid tiers)';

-- Note: tone_of_voice already exists in business_brand_profile as TEXT
-- Document proposes JSONB but we keep TEXT for now to avoid breaking changes
```

**Action:** Run in Supabase Dashboard → SQL Editor

---

### TRIN 2: Create Helper Utilities
**File:** `supabase/functions/_shared/business-type-helpers.ts` (NEW)

```typescript
/**
 * BusinessType Helper Functions
 * Provides backwards-compatible handling of string vs object businessType
 */

export type LegacyBusinessType = string

export interface HybridBusinessType {
  primary: 'cafe' | 'restaurant' | 'bar' | 'hotel' | 'retail' | 'service'
  secondary?: string[]
  hybridLabel?: string
  cuisineType?: string
  conceptTags?: string[]
}

export type BusinessType = LegacyBusinessType | HybridBusinessType

/**
 * Normalize to simple string (for existing logic)
 */
export function getPrimaryType(type: BusinessType | null | undefined): string {
  if (!type) return ''
  return typeof type === 'string' ? type : type.primary
}

/**
 * Get display label (supports hybrid labels)
 */
export function getBusinessTypeLabel(type: BusinessType | null | undefined): string {
  if (!type) return ''
  if (typeof type === 'string') return type
  return type.hybridLabel || type.primary
}

/**
 * Check if type is hybrid
 */
export function isHybridType(type: BusinessType | null | undefined): boolean {
  return !!type && typeof type === 'object' && !!type.secondary
}

/**
 * Extract all types (primary + secondary)
 */
export function getAllTypes(type: BusinessType | null | undefined): string[] {
  if (!type) return []
  if (typeof type === 'string') return [type]
  return [type.primary, ...(type.secondary || [])]
}
```

---

### TRIN 3: AI Model Configuration
**File:** `supabase/functions/_shared/ai-config.ts`

**Add new section after existing AI_MODELS:**
```typescript
/**
 * EXTRACTOR_MODELS: Per-extractor model configuration
 * Allows different models for Free vs Paid tiers per extraction task
 */
export const EXTRACTOR_MODELS = {
  basicInfo: {
    free: 'gpt-4o-mini',
    paid: 'gpt-4o-mini'
  },
  contact: {
    free: 'gpt-4o-mini',
    paid: 'gpt-4o'
  },
  menuSignal: {
    free: 'gemini-2.5-flash',
    paid: 'gemini-2.5-flash'
  },
  toneOfVoice: {
    free: 'gpt-4o-mini',
    paid: 'gpt-4o'
  },
  keywords: {
    free: 'gpt-4o-mini',
    paid: 'gpt-4o'
  },
  venueHooks: {
    free: 'gpt-4o-mini',
    paid: 'gpt-4o'
  },
  experiencePillars: {
    free: 'gpt-4o-mini',
    paid: 'gpt-4o'
  },
  visualHooks: {
    free: 'gpt-4o-mini',
    paid: 'gpt-4o'
  }
} as const

export type ExtractorName = keyof typeof EXTRACTOR_MODELS

/**
 * Get model for extractor based on tier
 */
export function getExtractorModel(
  extractor: ExtractorName,
  tier: 'free' | 'standardplus' | 'premium'
): string {
  const isPaid = tier === 'standardplus' || tier === 'premium'
  return EXTRACTOR_MODELS[extractor][isPaid ? 'paid' : 'free']
}
```

---

### TRIN 4: Create Menu Signal Extractor (Gemini)
**File:** `supabase/functions/_shared/ai-extractors/menu-signal-extractor.ts` (NEW)

```typescript
/**
 * Menu Signal Extractor (Gemini 2.5 Flash)
 * 
 * Lightweight text-based menu signal extraction for Free tier
 * Returns plain text description (not structured JSON like paid menu extraction)
 */

export interface MenuSignalResult {
  hasMenu: boolean
  menuDescription: string | null
  menuCategories: string[] | null
  signatureItems: string[] | null
  rawExtract: string | null
}

export async function extractMenuSignal(
  content: string,
  context: {
    businessName?: string | null
    businessType?: string | null
    languageHint?: string | null
  }
): Promise<MenuSignalResult> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiApiKey) {
    console.warn('⚠️ GEMINI_API_KEY not found - skipping menu signal extraction')
    return {
      hasMenu: false,
      menuDescription: null,
      menuCategories: null,
      signatureItems: null,
      rawExtract: null
    }
  }

  const language = context.languageHint || 'da'
  const businessType = context.businessType || 'restaurant'

  const prompt = `Analyze this website content and extract menu information.

Business: ${context.businessName || 'Unknown'}
Type: ${businessType}
Language: ${language}

Content:
${content.slice(0, 8000)}

Instructions:
1. Determine if there is menu content (YES/NO)
2. If YES, extract:
   - Brief overall menu description (2-3 sentences)
   - Main menu categories (list)
   - 3-5 signature/highlighted items

Format your response as plain text with clear sections:
HAS_MENU: [YES/NO]
DESCRIPTION: [text]
CATEGORIES: [comma-separated list]
SIGNATURE_ITEMS: [comma-separated list]

If NO menu, just respond: "HAS_MENU: NO"`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500
          }
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Parse response
    const hasMenuMatch = text.match(/HAS_MENU:\s*(YES|NO)/i)
    const hasMenu = hasMenuMatch?.[1]?.toUpperCase() === 'YES'

    if (!hasMenu) {
      return {
        hasMenu: false,
        menuDescription: null,
        menuCategories: null,
        signatureItems: null,
        rawExtract: text
      }
    }

    const descMatch = text.match(/DESCRIPTION:\s*(.+?)(?=\n[A-Z_]+:|$)/s)
    const categoriesMatch = text.match(/CATEGORIES:\s*(.+?)(?=\n[A-Z_]+:|$)/s)
    const itemsMatch = text.match(/SIGNATURE_ITEMS:\s*(.+?)(?=\n[A-Z_]+:|$)/s)

    return {
      hasMenu: true,
      menuDescription: descMatch?.[1]?.trim() || null,
      menuCategories: categoriesMatch?.[1]
        ?.split(',')
        .map(c => c.trim())
        .filter(Boolean) || null,
      signatureItems: itemsMatch?.[1]
        ?.split(',')
        .map(i => i.trim())
        .filter(Boolean) || null,
      rawExtract: text
    }
  } catch (error) {
    console.error('❌ Menu signal extraction failed:', error)
    return {
      hasMenu: false,
      menuDescription: null,
      menuCategories: null,
      signatureItems: null,
      rawExtract: null
    }
  }
}
```

---

### TRIN 5: Create Tone of Voice Extractor (GPT-4o-mini)
**File:** `supabase/functions/_shared/ai-extractors/tone-of-voice-extractor.ts` (NEW)

```typescript
/**
 * Tone of Voice Extractor (GPT-4o-mini for Free, GPT-4o for Paid)
 * 
 * Extracts communication style from website content
 * Returns JSONB structure for business_brand_profile.tone_of_voice
 */

import OpenAI from 'https://esm.sh/openai@4.68.4'

export interface ToneOfVoiceResult {
  overallTone: string // "Professionel og venlig"
  characteristics: string[] // ["Høflig", "Inkluderende"]
  dosList: string[] // Things to do
  dontsList: string[] // Things to avoid
  examplePhrases: string[] // Brand-specific phrases from site
  confidence: 'high' | 'medium' | 'low'
}

export async function extractToneOfVoice(
  content: string,
  model: string,
  openai: OpenAI,
  context: {
    businessName?: string | null
    businessType?: string | null
    languageHint?: string | null
  }
): Promise<ToneOfVoiceResult | null> {
  const language = context.languageHint || 'da'
  const systemPrompt = `You are an expert at analyzing brand voice and communication style from website content.

Extract the tone of voice used in the following website content.

Business: ${context.businessName || 'Unknown'}
Type: ${context.businessType || 'Unknown'}
Language: ${language}

Analyze:
1. Overall tone (formal/casual, friendly/professional, etc.)
2. Key characteristics (3-5 adjectives)
3. Communication guidelines (do's and don'ts)
4. Example phrases from the site that demonstrate the tone

Return JSON with this structure:
{
  "overallTone": "Brief description",
  "characteristics": ["Adjective1", "Adjective2"],
  "dosList": ["Do this", "Use this style"],
  "dontsList": ["Avoid this", "Don't use"],
  "examplePhrases": ["Phrase from site"],
  "confidence": "high|medium|low"
}`

  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content.slice(0, 6000) }
      ]
    })

    const text = response.choices[0]?.message?.content
    if (!text) return null

    const parsed = JSON.parse(text)
    
    return {
      overallTone: String(parsed.overallTone || ''),
      characteristics: Array.isArray(parsed.characteristics) ? parsed.characteristics : [],
      dosList: Array.isArray(parsed.dosList) ? parsed.dosList : [],
      dontsList: Array.isArray(parsed.dontsList) ? parsed.dontsList : [],
      examplePhrases: Array.isArray(parsed.examplePhrases) ? parsed.examplePhrases : [],
      confidence: (['high', 'medium', 'low'].includes(parsed.confidence) 
        ? parsed.confidence 
        : 'medium')
    }
  } catch (error) {
    console.error('❌ Tone of voice extraction failed:', error)
    return null
  }
}
```

---

### TRIN 6: Update basic-info-extractor.ts
**File:** `supabase/functions/_shared/ai-extractors/basic-info-extractor.ts`

**Changes needed:**
1. Import helper functions
2. Update JSON schema in prompt to support hybrid businessType
3. Add backwards compatibility layer

**Key change in system prompt (around line 40-80):**
```typescript
// OLD:
"businessType": "restaurant|cafe|bar|bakery|hotel|..."

// NEW:
"businessType": {
  "type": "object",
  "properties": {
    "primary": { "type": "string", "description": "Primary business type" },
    "secondary": { "type": "array", "items": { "type": "string" } },
    "hybridLabel": { "type": "string", "description": "For hybrids: e.g., 'Kaffebar & Vinbar'" },
    "cuisineType": { "type": "string" },
    "conceptTags": { "type": "array", "items": { "type": "string" } }
  }
}
```

**Add fallback logic (around line 150):**
```typescript
// Normalize businessType for backwards compatibility
let normalizedType = extracted.businessType

// If old format (string), convert to new format
if (typeof normalizedType === 'string') {
  normalizedType = {
    primary: normalizedType,
    secondary: [],
    hybridLabel: normalizedType
  }
}

return {
  ...extracted,
  businessType: normalizedType,
  _legacyType: typeof extracted.businessType === 'string' 
    ? extracted.businessType 
    : extracted.businessType.primary
}
```

---

### TRIN 7: Update analyze-website/index.ts

**Changes needed:**

1. **Import new extractors and helpers** (top of file):
```typescript
import { extractMenuSignal } from '../_shared/ai-extractors/menu-signal-extractor.ts'
import { extractToneOfVoice } from '../_shared/ai-extractors/tone-of-voice-extractor.ts'
import { getExtractorModel } from '../_shared/ai-config.ts'
import { getPrimaryType, getBusinessTypeLabel } from '../_shared/business-type-helpers.ts'
```

2. **Update tierModelMap** (line 61-67):
```typescript
// OLD:
const tierModelMap: Record<string, string> = {
  'free': 'gpt-4o',
  'standardplus': 'gpt-4o',
  'premium': 'gpt-4o'
}

// NEW:
const tierModelMap: Record<string, string> = {
  'free': 'gpt-4o-mini',  // ← CHANGED
  'standardplus': 'gpt-4o',
  'premium': 'gpt-4o'
}
```

3. **Update Free tier page priority** (line 74-109, getTierConfig function):
```typescript
// OLD:
free: {
  maxPriorityPages: 1,
  priorityTypes: ['home']
}

// NEW:
free: {
  maxPriorityPages: 3,  // About, Menu, Kontakt
  priorityTypes: ['home', 'about', 'menu', 'contact']
}
```

4. **Add new extractors to parallel extraction** (around line 1263-1295):
```typescript
// BEFORE Promise.all:
const isPaid = tier === 'standardplus' || tier === 'premium'

// Inside Promise.all (add 2 new extractors):
const [
  basicInfo,
  contactInfo,
  keywords,
  venueHooks,
  experiencePillars,
  visualHooks,
  menuSignal,      // NEW
  toneOfVoice      // NEW
] = await Promise.all([
  extractBasicInfo(...),
  extractContact(...),
  extractKeywords(...),
  extractVenueHooks(...),
  extractExperiencePillars(...),
  extractVisualVenueHooks(...),
  
  // NEW: Menu signal (Free+Paid, Gemini)
  extractMenuSignal(
    websiteContent,
    { 
      businessName, 
      businessType: getPrimaryType(businessType),  // Use helper
      languageHint: htmlLang 
    }
  ),
  
  // NEW: Tone of voice (Free+Paid, model varies)
  extractToneOfVoice(
    websiteContent,
    getExtractorModel('toneOfVoice', tier),
    openaiClient,
    { businessName, businessType: getPrimaryType(businessType), languageHint: htmlLang }
  )
])
```

5. **Update response object** (around line 1450):
```typescript
const analysisResult = {
  businessName: basicInfo.businessName,
  businessType: basicInfo.businessType,  // Now supports hybrid structure
  businessTypeLabel: getBusinessTypeLabel(basicInfo.businessType),  // NEW: Display label
  shortDescription: basicInfo.shortDescription,
  longDescription: basicInfo.longDescription,
  
  // ... existing fields ...
  
  // NEW FIELDS:
  menuSignal: menuSignal || null,
  toneOfVoice: toneOfVoice || null
}
```

6. **Update database save logic** (around line 1550+):
```typescript
// Save menuSignal to business_profile
if (menuSignal && businessId) {
  const { error: menuSignalError } = await supabase
    .from('business_profile')
    .update({ menu_signal: menuSignal })
    .eq('business_id', businessId)
  
  if (menuSignalError) {
    console.warn('⚠️ Failed to save menu_signal:', menuSignalError)
  }
}

// Save toneOfVoice to business_brand_profile (as TEXT for now)
if (toneOfVoice && businessId) {
  // Convert JSONB to readable text format
  const toneText = `${toneOfVoice.overallTone}

Karakteristika: ${toneOfVoice.characteristics.join(', ')}

Gør:
${toneOfVoice.dosList.map(d => `- ${d}`).join('\n')}

Undgå:
${toneOfVoice.dontsList.map(d => `- ${d}`).join('\n')}`

  const { error: toneError } = await supabase
    .from('business_brand_profile')
    .update({ tone_of_voice: toneText })
    .eq('business_id', businessId)
  
  if (toneError) {
    console.warn('⚠️ Failed to save tone_of_voice:', toneError)
  }
}
```

---

### TRIN 8: Update Brand Strategy (Non-Breaking)

**File:** `src/lib/brandStrategy/types.ts`

```typescript
// Add after existing types (around line 223)
import type { BusinessType } from '../../../supabase/functions/_shared/business-type-helpers'

export interface StrategyDeductionInputs {
  // ... existing fields ...
  
  // UPDATED: Support both string and hybrid structure
  businessType: BusinessType;  // Changed from: string
  
  // Helper: Always use getPrimaryType(businessType) when comparing strings
  locale: string;
}
```

**Files:** `goalDeduction.ts`, `offeringsDetector.ts`, `generator.ts`

Update all comparisons:
```typescript
// OLD:
if (rules.businessTypes.includes(inputs.businessType)) { ... }

// NEW:
import { getPrimaryType } from '../../supabase/functions/_shared/business-type-helpers'

if (rules.businessTypes.includes(getPrimaryType(inputs.businessType))) { ... }
```

---

## 🧪 Testing Checklist

### Database
- [ ] Migration applied successfully
- [ ] `menu_signal` column exists in `business_profile`
- [ ] RLS policies allow read/write

### AI Extractors
- [ ] Menu signal returns valid structure (Gemini)
- [ ] Tone of voice returns valid JSON (GPT-4o-mini)
- [ ] Fallback graceful if API keys missing

### Backwards Compatibility
- [ ] Old businessType strings still work
- [ ] New hybrid format displays correctly
- [ ] Brand strategy accepts both formats
- [ ] No breaking changes in existing flows

### Free Tier
- [ ] Uses gpt-4o-mini (not gpt-4o)
- [ ] Extracts 3 pages (About, Menu, Kontakt)
- [ ] Menu signal extracted successfully
- [ ] Tone of voice extracted successfully

### Cost Verification
- [ ] Free tier cost reduced ~9x (GPT-4o → gpt-4o-mini)
- [ ] Menu signal uses Gemini (cheaper)
- [ ] Paid tier still uses GPT-4o for quality

---

## 🚨 Rollback Plan

If issues occur:

1. **Database**: No action needed (`IF NOT EXISTS` is safe)
2. **AI Models**: Update `tierModelMap` back to `gpt-4o`
3. **Extractors**: Comment out new extractors in `Promise.all`
4. **BusinessType**: Helper functions ensure backwards compatibility

---

## 📊 Expected Improvements

### Cost Reduction
- **Free tier**: ~90% cost reduction (GPT-4o → gpt-4o-mini)
- **Menu signal**: Gemini 2.5 Flash (~5x cheaper than GPT-4o-mini)

### Feature Enhancements
- **Hybrid types**: Better categorization (cafe+vinbar, restaurant+cocktailbar)
- **Menu signal**: Quick overview without full extraction
- **Tone of voice**: Direct AI integration (no manual entry)

### User Experience
- **Free users**: More pages analyzed (1 → 3)
- **All users**: Hybrid labels display correctly
- **Business profile**: Auto-populated tone and menu info

---

## 📅 Implementation Timeline

**Phase 1 (Day 1): Database + Utilities**
- Create migration
- Create helper functions
- Update ai-config.ts

**Phase 2 (Day 2): New Extractors**
- Create menu-signal-extractor.ts
- Create tone-of-voice-extractor.ts
- Test standalone

**Phase 3 (Day 3): Integration**
- Update basic-info-extractor.ts
- Update analyze-website/index.ts
- Add new extractors to pipeline

**Phase 4 (Day 4): Brand Strategy Update**
- Update types.ts
- Update goalDeduction.ts
- Update offeringsDetector.ts
- Update generator.ts

**Phase 5 (Day 5): Testing**
- Test Free tier flow
- Test Paid tier flow
- Verify cost reduction
- Verify backwards compatibility

---

## ✅ Ready to Implement

Følgende rækkefølge anbefales:
1. Database migration (kan ikke gøre skade)
2. Helper utilities (bruges af alle)
3. Nye extractors (isoleret funktionalitet)
4. Integration i analyze-website
5. Brand strategy updates (sidst, da det påvirker mest)

Skal jeg starte med implementeringen?
