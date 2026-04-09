# Brand Profile Generation System - v4.8.7

**Last Updated**: January 9, 2026  
**Current Version**: v4.8.7  
**Status**: Production-ready with enhanced validation alignment

---

## 📊 System Overview

The Brand Profile generation is a **5-stage pipeline** that transforms raw business data into user-facing brand guidelines optimized for AI content generation.

**Performance**:
- Timeline: 25-35 seconds (end-to-end)
- AI Success Rate: Target 70-85%
- Template Fallback Rate: Target 10-20%
- Repair Success Rate: Target 75-85%

**AI Models**:
- Prompt A (Analysis): GPT-4o @ temp 0.25
- Prompt B (Generation): GPT-4o @ temp 0.25
- Repair: GPT-4o @ temp 0.3

**Cost**: ~$0.05-0.10 per generation

---

## 🏗️ Architecture: 5-Stage Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    STAGE 1: DATA GATHERING                   │
│  Aggregate all available business data from 8+ sources      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    STAGE 2: PROMPT A (Analysis)              │
│  Extract evidence-backed signals & distinctive hooks        │
│  Output: Internal analysis JSON (not user-facing)           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  STAGE 3: PROMPT B (Generation)              │
│  Generate user-facing brand profile sections                │
│  Output: Complete brand profile JSON                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              STAGE 4: VALIDATION & REPAIR                    │
│  Validate output → AI repair if needed → Fallbacks          │
│  Ensures 100% success rate with quality tiers               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    STAGE 5: DATABASE SAVE                    │
│  Persist to business_brand_profile with metadata            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📥 Stage 1: Data Gathering

**Location**: `brand-profile-generator/index.ts` → `gatherDataSources()`

**Purpose**: Aggregate all available business data into a single `DataSources` object.

**Data Sources** (8 total):

| Source | Table | Key Fields | Priority |
|--------|-------|------------|----------|
| **Business** | `businesses` | name, city, address, vertical | 🔴 Required |
| **Profile** | `business_profile` | short_description, long_description | 🟡 High |
| **Menu** | `menu_extractions` | items[], categories[] | 🟡 High |
| **Images** | `business_images` | urls, ai_labels, category_tags | 🟢 Medium |
| **Website** | `website_analyses` | structured_data, content | 🟢 Medium |
| **Social** | `social_media_accounts` | bio, posts[], engagement | 🟢 Medium |
| **Location** | `business_locations` | enrichment (macro/micro) | 🟡 High |
| **Existing Profile** | `business_brand_profile` | (for regeneration) | 🔵 Optional |

**Location Enrichment** (Critical for quality):
```typescript
location: {
  enrichment: {
    macro: {
      city: "Aarhus",           // ← Used by validators
      region: "Midtjylland"
    },
    micro: {
      area_type: "waterfront",   // ← Triggers "ved åen"
      nearby_signals: ["Åen", "Musikhuset"]
    }
  }
}
```

**Output**: `DataSources` object passed to all subsequent stages.

---

## 🔍 Stage 2: Prompt A (Internal Analysis)

**Location**: `prompts/prompt-a.ts` → `buildPromptA()`

**Purpose**: Extract evidence-backed signals and distinctive hooks from raw data.

**AI Configuration**:
- Model: GPT-4o
- Temperature: 0.25 (factual, deterministic)
- Max tokens: 3000
- Response format: JSON object

**Key Sections Generated**:

1. **Distinctive Hooks** (8 max)
   - Format: `{ hook, evidence, source }`
   - Must cite verbatim evidence from data sources
   - Examples: "Ved åen i Aarhus", "Fra brunch til aften"

2. **Core Offerings** (Signal)
   - `must_use_phrases[]`: Menu items to reference (uppercase)
   - `concrete_anchors[]`: Specific dishes with evidence
   - `generic_offerings[]`: Avoid these (too vague)

3. **Physical Space Cues**
   - Interior elements, ambiance, seating style
   - Evidence from images or website descriptions

4. **Rituals & Moments**
   - Behavioral patterns (lingering, transitions)
   - Usage occasions (brunch → lunch → dinner)

5. **CTA Style**
   - `must_use_phrases[]`: Preferred CTAs (e.g., "BOOK DIT BORD")

**Validation Rules**:
- ✅ Every hook must have `evidence` field
- ✅ Evidence must exist verbatim in input data
- ✅ Confidence scores: 0-100 per section
- ❌ Block: Generic phrases without evidence

**Output Example**:
```json
{
  "distinctive_hooks": [
    {
      "hook": "Ved åen i Aarhus",
      "evidence": "Located by the river in Aarhus city center",
      "source": "website_analysis.structured_data",
      "confidence": 95
    }
  ],
  "signals": {
    "core_offerings": {
      "must_use_phrases": ["PARISERBØF", "ÆGGEKAGE"],
      "concrete_anchors": ["pariserbøf", "brunch"],
      "generic_offerings": ["mad og drikke"]
    }
  }
}
```

---

## 🎨 Stage 3: Prompt B (Brand Profile Generation)

**Location**: `prompts/prompt-b.ts` → `buildPromptB()`

**Purpose**: Transform Prompt A analysis into user-facing brand guidelines.

**AI Configuration**:
- Model: GPT-4o
- Temperature: 0.25
- Max tokens: 3000
- Response format: JSON object (strict schema)

**Dynamic Proof Tokens** (v4.8.6):
```typescript
// Built from multiple sources with fallback chain
const primaryCta = (() => {
  // 1. Try website CTAs first
  if (structuredWebsite?.ctaTexts?.length > 0) {
    const bookingCta = structuredWebsite.ctaTexts.find(cta => 
      /book|reserv|bord/i.test(cta)
    )
    if (bookingCta) return bookingCta.toUpperCase()
  }
  // 2. Fallback to locale
  return locale?.preferredPhrasing?.['cta_book'] || 'BOOK DIT BORD'
})()

const ALLOWED_PROOF_TOKENS = [
  canonicalLocationHook,        // "ved åen i Aarhus"
  primaryCta,                    // "BOOK DIT BORD"
  ...uniqueMenuTokens,           // ["PARISERBØF", "ÆGGEKAGE"]
  locationPhrase || 'ved åen',
  cityName                       // "Aarhus"
]
```

**Key Sections Generated**:

### 1. **brand_essence** (1 sentence)
**Rules**:
- MUST include: venue type + location + offerings + behavioral hook
- Location pattern: `ved åen|ved stationen|på gågaden|i centrum|i kvarteret`
- Behavioral hook (pick ONE): `roligt tempo|glide naturligt over i aftenen|lange ophold|fra dag til aften`
- ❌ BANNED: "lækker", "hyggelig", "afslappet", "autentisk"

**Example**: 
```
"Café ved åen i Aarhus hvor pariserbøf og brunch kan nydes i roligt tempo."
```

### 2. **tone_of_voice** (Rule-based system)
**Format**: Bullets + Examples + Optional "Undgå:"
```
- Undgå tomt markedsførings-sprog
- Fokusér på konkrete detaljer (retter, stemning, tid på dagen)
- Brug "BOOK DIT BORD" når bordbestilling nævnes

Eksempel: "Nyd brunch ved åen i dit eget tempo"
Eksempel: "Start med brunch, bliv til aften"
```

### 3. **target_audience** (Free text)
Must reference actual data, avoid generic phrases.

### 4. **content_pillars** (3 pillars)
Each with:
- `pillar`: Title
- `description`: What to post about
- `notes`: Hook references with proof

### 5. **image_preferences**
```json
{
  "signature_shot": "Et bord ved åen i gyldent aftenlys...",
  "dos": ["Natural lighting", "Food close-ups"],
  "donts": ["Stock photos", "Empty plates"]
}
```

**Proof Tokens Validation**:
- All proof bullets MUST contain numbered tokens
- ✅ Correct: `"Location hook 'ved åen i Aarhus' (#1)"`
- ❌ Wrong: `"Based on waterfront location"` (generic)

---

## ✅ Stage 4: Validation & Repair

**Location**: `validators.ts` + `index.ts` (repair loop)

### **4.1: Deterministic Repairs**

Applied before validation:
```typescript
applyDeterministicRepairs(sections, dataSources, analysis, language, locale)
```

**Fixes**:
- Remove placeholder text: "Hvem taler i til?", "menu categories"
- Capitalize proper nouns: "pariserbøf" → keep lowercase in value fields
- Trim whitespace
- Fix JSONB structure

### **4.2: Validation Rules** (v4.8.7 - Aligned with Fallbacks)

**Critical Fix**: Validators now check **same sources** as fallback logic.

```typescript
// Extract location from all available sources (match fallback logic)
const location = (dataSources as any)?.location

const locationCandidates: string[] = [
  location?.enrichment?.macro?.city,  // ← PRIMARY (matches fallback)
  business?.city,                      // Fallback if no enrichment
  business?.address,
  // ... other sources
]

const offeringCandidates: string[] = [
  ...(analysis?.signals?.core_offerings?.must_use_phrases || []),
  ...(analysis?.signals?.core_offerings?.concrete_anchors || []),
  ...(structuredWebsite?.menuCategoriesMentioned || []),
  // ← NEW: Also check menu items directly
  ...(dataSources?.menu || []).slice(0, 10).map(item => item.name).filter(Boolean)
]
```

**Why This Matters**:
- Before: Validator checked `business.city` ("Aarhus C")
- AI writes: "Café i Aarhus" (using `location.enrichment.macro.city`)
- Validator failed: "Aarhus" ≠ "Aarhus C" → false positive fallback
- **After v4.8.7**: Both check `location.enrichment.macro.city` first ✅

**Validation Checks**:
1. ✅ All required fields present
2. ✅ Location cue exists in brand_essence
3. ✅ Offering cue exists in brand_essence
4. ✅ Behavioral hook present (roligt tempo, etc.)
5. ✅ No banned words
6. ✅ Proof tokens reference allowed list
7. ✅ Language consistency (da/en/de)

### **4.3: AI Repair Loop** (if validation fails)

**Location**: `validators.ts` → `repairBrandProfile()`

**Strategy** (v4.8.5):
1. Call repair with priority-based prompt:
   - 🔴 CRITICAL errors (missing required fields)
   - 🟠 HIGH errors (location/offering missing)
   - 🟡 MEDIUM errors (banned words, proof tokens)

2. Validate repair output

3. If partial success (some errors fixed):
   - Retry with CRITICAL errors only
   - Max 1 retry to prevent infinite loops

**AI Configuration**:
- Temperature: 0.3 (slightly creative for fixes)
- Instructions: "Fix ONLY the errors listed"

### **4.4: Fallback Tier System** (last resort)

**Location**: `fallbacks.ts`

If repair fails, apply template fallbacks:

| Tier | Quality | When Used |
|------|---------|-----------|
| AI_PRIMARY | 95-100% | Original AI output ✅ |
| AI_SIMPLIFIED | 80-90% | After successful repair |
| TEMPLATE_RICH | 70-80% | Fallback with rich data |
| TEMPLATE_BASIC | 50-60% | Fallback with minimal data |
| HARDCODED | 40-50% | Last resort |

**Fallback Builders**:
- `buildBrandEssenceFallback()`: Uses location enrichment + menu data
- `buildSignatureShotFallback()`: Template with location + atmosphere
- `buildTargetAudienceFallback()`: Venue-type based template
- `buildToneOfVoiceFallback()`: Structure-based template
- `buildContentFocusFallback()`: 3-area template (MAD/STEMNING/FOLK)

**Quality Preservation**:
```typescript
// Fallback uses SAME location logic as validators
const locationPhrase = location?.enrichment?.micro?.area_type === 'waterfront' 
  ? 'ved åen'
  : location?.enrichment?.micro?.area_type === 'transit_hub'
  ? 'ved stationen'
  : ''

const city = location?.enrichment?.macro?.city || business?.city || 'byen'
```

---

## 💾 Stage 5: Database Save

**Location**: `index.ts` → Save to `business_brand_profile`

**Schema** (18 fields):

```typescript
{
  business_id: UUID,
  brand_essence: string,
  tone_of_voice: string,
  things_to_avoid: JSONB,
  target_audience: string,
  core_offerings: string,
  content_focus: string,
  content_pillars: JSONB[],           // Array of {pillar, description, notes}
  cta_style: string,
  communication_goal: string,
  recognizable_interior_identity: string,
  image_preferences: JSONB,           // {signature_shot, dos[], donts[]}
  social_style: JSONB,                // {emoji_usage, hashtag_strategy}
  voice_examples: JSONB,              // {do_say[], dont_say[], vocabulary}
  confidence_metadata: JSONB,         // {scores per field, fallback tier}
  last_generated_at: timestamp,
  version_hash: string,               // SHA-256 of data sources
  tone_model: string                  // e.g., "balanced"
}
```

**Version Hashing** (v4.7):
- Generates SHA-256 hash of all data sources
- Prevents unnecessary regenerations
- Stored in `version_hash` column

---

## 🐛 Debugging & Logging (v4.8.6.2)

**Debug Logs Added**:

```typescript
// Stage 3 - Prompt B token verification
console.log('🔧 ALLOWED_PROOF_TOKENS:', ALLOWED_PROOF_TOKENS.slice(0, 8))

// Stage 4 - Pre-repair AI output
if (validationErrors.length > 0) {
  console.log(`[${requestId}] ❌ Validation errors:`, validationErrors)
  console.log(`[${requestId}] 📄 AI output BEFORE fallback:`, 
    JSON.stringify(sections, null, 2))
}
```

**How to Analyze Failures**:
1. Check Supabase logs for request ID
2. Look for 📄 AI output dump
3. Compare against validation errors
4. Identify root cause:
   - AI ignoring instructions? → Prompt issue
   - Validator too strict? → Validation rule issue
   - Data quality problem? → Data gathering issue

---

## 📊 Quality Metrics & Success Criteria

| Metric | Target | Current (Jan 2026) | How to Measure |
|--------|--------|--------------------|----------------|
| AI Success Rate | 70-85% | Testing | % of generations passing validation without repair |
| Repair Success Rate | 75-85% | Testing | % of repairs that fix all errors |
| Template Fallback Rate | 10-20% | Testing | % of generations using fallback tier |
| Location Detection | 95%+ | ✅ Good | % with valid location enrichment |
| Menu Detection | 90%+ | ✅ Good | % with menu items extracted |
| No Banned Words | 99%+ | ✅ Good | % without "lækker", "hyggelig" |
| No Placeholders | 99%+ | ✅ Fixed v4.8.2 | % without "menu categories" |
| Generation Time | <35s | ✅ 25-35s | Median p50 latency |

---

## 🔄 Recent Changes (Version History)

### **v4.8.7** (Jan 9, 2026) - Validator Alignment ✅
- **Fix**: Validators now check `location.enrichment.macro.city` (same as fallbacks)
- **Fix**: Added direct menu items to offering candidates
- **Impact**: Eliminates false-positive validation failures
- **Files**: `validators.ts`

### **v4.8.6.2** (Jan 9, 2026) - Debug Logging
- **Add**: Pre-repair AI output logging
- **Add**: Validation error details
- **Purpose**: Diagnose AI vs validator misalignment
- **Files**: `index.ts`

### **v4.8.6.1** (Jan 9, 2026) - Minimal Variable Fix
- **Fix**: Removed duplicate variable declarations
- **Fix**: Reuse `uniqueMenuTokens` built at line 577
- **Fix**: Simplified `primaryCta` extraction
- **Files**: `prompt-b.ts`

### **v4.8.6** (Jan 9, 2026) - Dynamic Proof Tokens
- **Add**: Multi-source CTA extraction (website → locale fallback)
- **Add**: Complete proof token collection from menu + location
- **Add**: Numbered token list (1-10) with detailed usage rules
- **Add**: Deduplication and filtering logic
- **Files**: `prompt-b.ts`

### **v4.8.5** (Jan 8, 2026) - Soft Hook Encouragement
- **Add**: Warning for missing distinctive hooks (not error)
- **Improve**: Repair retry strategy with simplified prompt
- **Add**: Priority-based repair (🔴 CRITICAL → 🟠 HIGH → 🟡 MEDIUM)
- **Files**: `validators.ts`, `index.ts`

### **v4.8.4** (Jan 8, 2026) - Dynamic Menu Tokens
- **Fix**: Removed hardcoded "PARISERBØF", "ÆGGEKAGE"
- **Add**: Dynamic extraction from analysis + menu data
- **Add**: Enhanced placeholder detection regex
- **Files**: `prompt-b.ts`

### **v4.8.3** (Jan 8, 2026) - Enhanced Proof Tokens
- **Add**: Extended language validation (core_offerings, target_audience)
- **Add**: More proof token clarification
- **Files**: `prompt-b.ts`, `validators.ts`

### **v4.8.2** (Jan 8, 2026) - Placeholder Prevention
- **Fix**: 3-layer defense against "menu categories" leakage
- **Add**: communication_goal language validation
- **Files**: `validators.ts`, `fallbacks.ts`, `prompt-b.ts`

### **v4.8.1** (Jan 8, 2026) - Fallback Fix
- **Fix**: "menu categories" placeholder in fallback builder
- **Files**: `fallbacks.ts`

### **v4.8.0** (Jan 8, 2026) - Validation Crisis Resolution
- **Fix**: Relaxed validation rules (70-80% template fallback → target 10-20%)
- **Change**: Made distinctive hooks "encouraged" not "required"
- **Files**: `validators.ts`

---

## 🎯 Future Improvements

### **High Priority**
- [ ] Monitor v4.8.7 metrics (location/offering detection rate)
- [ ] A/B test: Prompt B temperature 0.25 vs 0.3
- [ ] Add telemetry: Track fallback tier distribution

### **Medium Priority**
- [ ] Multi-language support expansion (Swedish, Norwegian)
- [ ] Confidence score calibration per section
- [ ] Automated quality regression tests

### **Low Priority**
- [ ] Prompt A → B data compression (reduce token usage)
- [ ] Parallel processing for Prompt A + data gathering
- [ ] Cache analysis results for similar businesses

---

## 🔧 Troubleshooting Guide

### **High Template Fallback Rate (>30%)**
**Symptoms**: Most generations use fallback tier instead of AI output

**Root Causes**:
1. ✅ **Fixed v4.8.7**: Validator checking wrong data sources
2. Prompt instructions too complex/contradictory
3. Data quality issues (missing location enrichment)

**How to Fix**:
- Check debug logs for validation errors
- Verify `location.enrichment` is populated
- Review AI output vs validator logic alignment

### **Placeholder Leakage ("menu categories")**
**Symptoms**: Generated content contains literal "menu categories" text

**Root Causes**:
1. ✅ **Fixed v4.8.2**: AI copying prompt examples verbatim
2. Fallback builder using placeholder

**Prevention** (3-layer defense):
- Prompt: Clear instructions not to copy placeholders
- Validators: Detect and reject placeholders
- Fallbacks: Filter generic fragments

### **Missing Location Context**
**Symptoms**: brand_essence lacks city/area mention

**Root Causes**:
1. ✅ **Fixed v4.8.7**: Validator not finding location in AI output
2. No location enrichment data
3. AI skipping location despite instructions

**How to Fix**:
- Ensure `location.enrichment.macro.city` is populated
- Check `locationCandidates` in validator debug logs
- Verify prompt includes location in REQUIRED section

### **Banned Words in Output**
**Symptoms**: "lækker", "hyggelig" appear in generated text

**Root Causes**:
1. AI ignoring banned words list
2. Fallback template contains banned words

**Prevention**:
- Prompt: List banned words explicitly
- Validators: Reject any output with banned words
- Fallbacks: Pre-sanitize templates

---

## 📚 Related Documentation

- [BRAND_PROFILE_SYSTEM.md](BRAND_PROFILE_SYSTEM.md) - Overall system architecture
- [BRAND_PROFILE_TO_AI_MAPPING.md](BRAND_PROFILE_TO_AI_MAPPING.md) - How profiles feed into idea generation
- [AI_ARCHITECTURE_GUIDE.md](AI_ARCHITECTURE_GUIDE.md) - AI decision tree across all functions
- [CONFIDENCE_SCORING_V2.md](CONFIDENCE_SCORING_V2.md) - Confidence model details

---

## 💡 Key Design Principles

1. **Evidence-First**: Every statement must have verifiable evidence
2. **Progressive Fallbacks**: Never fail, degrade gracefully through quality tiers
3. **Validator-Fallback Alignment**: Check same data sources to prevent false positives
4. **No Placeholders**: Zero tolerance for generic template text in production
5. **Debug-Friendly**: Extensive logging for post-mortem analysis
6. **Version Tracking**: Hash data sources to prevent unnecessary regenerations

---

**Generated by**: GitHub Copilot  
**Model**: Claude Sonnet 4.5  
**Last Review**: January 9, 2026
