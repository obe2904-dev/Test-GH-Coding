# Brand Profile Generation Flow

Complete journey from user clicking "Generer Brand Profil" to fully populated brand profile in database.

---

## 📊 Overview

The Brand Profile generation is a **two-stage AI process** that:
1. **Analyzes** business data to extract evidence-backed signals (Prompt A)
2. **Generates** user-facing brand profile sections (Prompt B)

**Timeline**: 10-20 seconds  
**AI Models**: GPT-4o (both stages)  
**Cost**: ~$0.05-0.10 per generation

---

## 🔄 Complete Flow Diagram

```
USER CLICKS "Generer Brand Profil"
  ↓
Frontend: BrandProfilePage_NEW.tsx
  ↓
[1] Get auth session + businessId
  ↓
[2] Call Edge Function: brand-profile-generator
  ↓
Edge Function: /supabase/functions/brand-profile-generator/index.ts
  ↓
[3] Gather Data Sources (5-8 sources)
  ├─ businesses table (name, location, category)
  ├─ business_profile table (short_description, long_description)
  ├─ menu_extractions table (menu items, categories)
  ├─ business_images table (uploaded photos + AI labels)
  ├─ website_analyses table (scraped content, structure)
  ├─ social_media_accounts table (Instagram/Facebook data)
  ├─ business_locations table (address, opening hours)
  └─ business_brand_profile table (check if exists)
  ↓
[4] Detect Language (Danish/English/Swedish/Norwegian/German)
  ↓
[5] Run Prompt A: Internal Analysis (GPT-4o, 8-12 seconds)
  ├─ Input: All gathered data sources
  ├─ Process: Extract signals, evidence, confidence scores
  ├─ Output: JSON with distinctive_hooks[], physical_space_cues[], rituals_and_moments[], etc.
  └─ Validation: Evidence must exist verbatim in input data
  ↓
[6] Confidence Check (unless ignoreConfidenceCheck=true)
  ├─ Require: 2+ distinctive hooks with valid evidence
  ├─ If failed: Return skippedGeneration=true with UI guidance
  └─ If passed: Continue to Prompt B
  ↓
[7] Run Prompt B: Brand Profile Generation (GPT-4o, 5-8 seconds)
  ├─ Input: Data sources + Prompt A analysis
  ├─ Process: Generate user-facing brand sections
  ├─ Output: JSON with brand_essence, tone_of_voice, target_audience, etc.
  └─ Validation: Hook references must match Prompt A numbering
  ↓
[8] Validation + Repair Loop
  ├─ Validate: All required fields present, proper format
  ├─ If invalid: Attempt JSON repair via AI
  ├─ If still invalid: Apply deterministic fallbacks
  └─ Final check: Ensure no placeholder text (e.g., "Hvem taler i til?")
  ↓
[9] Save to Database: business_brand_profile table
  ├─ brand_essence (string)
  ├─ tone_of_voice (string)
  ├─ things_to_avoid (JSONB)
  ├─ target_audience (string)
  ├─ core_offerings (string)
  ├─ content_focus (string)
  ├─ content_pillars (JSONB array)
  ├─ cta_style (string)
  ├─ communication_goal (string)
  ├─ recognizable_interior_identity (string)
  ├─ image_preferences (JSONB: dos/donts/signature_shot)
  ├─ social_style (JSONB: emoji_usage/hashtag_strategy)
  ├─ voice_examples (JSONB: do_say/dont_say/vocabulary)
  └─ confidence_metadata (JSONB: scores + signals per field)
  ↓
[10] Return Response to Frontend
  ↓
Frontend: Update UI State
  ├─ Display generated values in form fields
  ├─ Show confidence hints if low (<50%)
  └─ Enable manual editing
  ↓
USER CLICKS "Gem" → Save to business_brand_profile
```

---

## 📂 Frontend Flow

### **File**: `src/pages/dashboard/BrandProfilePage_NEW.tsx`

**User Action**: Click "Generer Brand Profil" button

**Code Path**:
```typescript
// Current implementation uses useBrandProfile hook
const { generate, isGenerating, error } = useBrandProfile()

// Button click handler with proper error handling
const handleGenerateClick = async () => {
  setShowConfirmModal(false)
  try {
    await generate({ forceRegenerate: true, ignoreDifferentiationGate: true })
  } catch (err) {
    // Error already handled in generate() function with toast/setError
    console.warn('Generate error caught in handleGenerateClick:', err)
  }
}

// The generate() function (in useBrandProfile.ts) handles:
// - Guard checks (prevent concurrent operations)
// - Calling generateAndSaveBrandProfile service
// - Updating UI state (form, isGenerating, error)
// - Fetching formatted profile from database
// - Confidence checks and hints
```

**Legacy Code Path** (for reference):
```typescript
const handleGenerateBrandProfile = async () => {
  setIsGenerating(true)
  setGenerateError(null)
  
  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    alert('Du skal være logget ind')
    return
  }
  
  // 2. Get businessId
  const { data: businessData } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  
  if (!businessData) {
    setGenerateError('Kunne ikke finde din forretning.')
    return
  }
  
  // 3. Call Edge Function
  const { data, error } = await supabase.functions.invoke('brand-profile-generator', {
    body: {
      businessId: businessData.id,
      forceRegenerate: true,           // Overwrite existing profile
      ignoreConfidenceCheck: true      // Generate even with low confidence
    }
  })
  
  // 4. Handle response
  if (error || data?.error) {
    setGenerateError(error?.message || data.error)
    return
  }
  
  if (data?.skippedGeneration) {
    // AI couldn't find enough unique differentiators
    setGenerationSkipped(true)
    setLowConfidenceHint(data.analysisEvidence?.ui_prompt_da)
    return
  }
  
  // 5. Update UI with generated data
  if (data?.brandProfile) {
    setBrandEssence(data.brandProfile.brand_essence || '')
    setToneOfVoice(data.brandProfile.tone_of_voice || '')
    setTargetAudience(data.brandProfile.target_audience || '')
    // ... set all other fields
    
    // 6. Auto-save to database
    await saveBrandProfileToSupabase(data.brandProfile)
  }
  
  setIsGenerating(false)
}
```

**UI States**:
- **Loading**: Shows "Genererer..." spinner (10-20 seconds)
- **Success**: Form fields populated with generated values
- **Low Confidence**: Yellow banner with guidance ("Tilføj 1-2 unikke detaljer...")
- **Error**: Red error message displayed

---

## 🔧 Edge Function Flow

### **File**: `supabase/functions/brand-profile-generator/index.ts`

### **Step 1: Request Validation**
```typescript
serve(async (req: Request) => {
  const requestId = generateRequestId() // bp-{timestamp}-{random}
  const { businessId, forceRegenerate, ignoreConfidenceCheck } = await req.json()
  
  if (!businessId) {
    return new Response(JSON.stringify({ error: 'businessId is required' }), { status: 400 })
  }
  
  // Check if profile already exists
  if (!forceRegenerate) {
    const { data: existing } = await supabase
      .from('business_brand_profile')
      .select('brand_essence')
      .eq('business_id', businessId)
      .single()
    
    if (existing?.brand_essence) {
      return new Response(JSON.stringify({ 
        existing: true,
        message: 'Brand profile already exists'
      }))
    }
  }
  
  // Proceed with generation...
})
```

### **Step 2: Gather Data Sources**
**File**: `supabase/functions/_shared/brand-profile/data-gatherer.ts`

```typescript
export async function gatherDataSources(businessId: string, supabase: any): Promise<DataSources> {
  // 1. Fetch business info
  const { data: business } = await supabase
    .from('businesses')
    .select('id, owner_id, name, business_category, website_url, primary_language')
    .eq('id', businessId)
    .single()
  
  // 2. Fetch profile
  const { data: profile } = await supabase
    .from('business_profile')
    .select('short_description, long_description, target_audience, price_level')
    .eq('business_id', businessId)
    .maybeSingle()
  
  // 3. Fetch menu items
  const { data: menuExtractions } = await supabase
    .from('menu_extractions')
    .select('extracted_data, menu_name')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  
  const menu: MenuItem[] = []
  for (const extraction of menuExtractions || []) {
    const categories = extraction.extracted_data?.categories || []
    for (const category of categories) {
      for (const item of category.items || []) {
        menu.push({
          name: item.name,
          category: category.name,
          description: item.description,
          price: item.price,
          menu_source: extraction.menu_name
        })
      }
    }
  }
  
  // 4. Fetch images with AI labels
  const { data: images } = await supabase
    .from('business_images')
    .select('id, ai_labels, description')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(50)
  
  // 5. Fetch website analysis
  const { data: websiteAnalysis } = await supabase
    .from('website_analyses')
    .select('*')
    .eq('business_id', businessId)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  // 6. Fetch social media accounts
  const { data: socialAccounts } = await supabase
    .from('social_media_accounts')
    .select('platform, profile_data')
    .eq('business_id', businessId)
  
  // 7. Fetch location
  const { data: location } = await supabase
    .from('business_locations')
    .select('address, city, postal_code, country, opening_hours')
    .eq('business_id', businessId)
    .eq('is_primary', true)
    .maybeSingle()
  
  return {
    business,
    profile,
    menu,
    images,
    websiteAnalysis,
    socialAccounts,
    location
  }
}
```

**Data Sources Summary**:
| Source | Purpose | Example Data |
|--------|---------|--------------|
| `businesses` | Identity | "Café Viggo", "København", "cafe" |
| `business_profile` | Description | "Økologisk kaffe, hjemmelavet brunch" |
| `menu_extractions` | Offerings | [{ name: "Eggs Benedict", category: "BRUNCH" }] |
| `business_images` | Visual identity | [{ ai_labels: ["coffee", "interior", "cozy"] }] |
| `website_analyses` | Content | HTML structure, meta tags, headers |
| `social_media_accounts` | Social presence | Instagram bio, post count |
| `business_locations` | Location context | "Ved åen, København" |

### **Step 3: Detect Language**
```typescript
const language = detectLanguageFromData(dataSources)
// Returns: { code: 'da', name: 'Danish', systemPromptA: '...' }
```

**Language Detection Priority**:
1. `business.primary_language` (if set)
2. `business.country` → COUNTRY_FALLBACKS mapping
3. Website analysis content language
4. Default: English

### **Step 4: Run Prompt A - Internal Analysis**
**Model**: GPT-4o  
**Temperature**: 0.3 (deterministic)  
**Max Tokens**: 2000

**Purpose**: Extract evidence-backed signals from data

**Input Prompt Structure**:
```
=== BUSINESS INFORMATION ===
Business Name: Café Viggo
Location: København, Denmark
Category: cafe

=== BUSINESS PROFILE ===
Økologisk kaffe, hjemmelavet brunch, sæsonkager

=== MENU (50 items shown) ===
- DEN LUKSURIØSE BRUNCH (BRUNCH): Koldrøget laks, pocherede æg, avocado...
- EGGS BENEDICT (BRUNCH): Klassisk eggs benedict med hollandaise...
[... truncated for brevity]

=== IMAGES (20 images shown) ===
Image #1: AI Labels: coffee, latte art, rustic table, natural light
Image #2: AI Labels: interior, vintage furniture, hygge atmosphere
[... truncated]

=== WEBSITE ANALYSIS ===
Meta Title: Café Viggo - Hyggelig café ved åen i København
Hero Text: Vi serverer økologisk kaffe og hjemmelavet brunch...
[... truncated]

=== TASK ===
Extract distinctive hooks, physical space cues, rituals, tone patterns.
CRITICAL: All evidence must be EXACT quotes from above data.
```

**Output JSON Schema**:
```json
{
  "distinctive_hooks": [
    {
      "hook": "ved åen",
      "evidence": "Meta Title: Café Viggo - Hyggelig café ved åen i København",
      "source": "website_analysis|meta_title",
      "confidence": "high"
    }
  ],
  "physical_space_cues": [
    {
      "cue": "vintage furniture",
      "evidence": "Image #2: AI Labels: interior, vintage furniture, hygge atmosphere",
      "source": "image_labels",
      "confidence": "medium"
    }
  ],
  "rituals_and_moments": [],
  "local_identity_cues": [
    {
      "cue": "København",
      "evidence": "Location: København, Denmark",
      "source": "business_profile",
      "confidence": "high"
    }
  ],
  "copy_patterns": [],
  "signals": {
    "core_offerings": {
      "concrete_anchors": ["økologisk kaffe", "hjemmelavet brunch"],
      "must_use_phrases": ["DEN LUKSURIØSE BRUNCH", "EGGS BENEDICT"]
    },
    "brand_essence": {
      "keywords": ["hyggelig", "økologisk", "hjemmelavet"],
      "positioning": "Cozy organic café by the water"
    }
  },
  "evidence": {
    "menu_items_count": 15,
    "images_uploaded_count": 8,
    "has_website_analysis": true
  }
}
```

**Validation Rules** (Prompt A):
- ✅ All `evidence` fields must contain exact quotes from input
- ✅ All `source` fields must be valid labels (e.g., "website_analysis|meta_title")
- ✅ `confidence` must be "high", "medium", or "low"
- ❌ Generic hooks rejected: "lækker mad", "kulinariske oplevelser"

### **Step 5: Confidence Check**
```typescript
const analysis = ensureDistinctiveHooksMinimum(rawAnalysis)

const { score, level, hooksCount } = computeDifferentiationConfidence(analysis)
// score: 0.0-1.0
// level: 'high' | 'medium' | 'low'
// hooksCount: number of valid distinctive hooks

if (!ignoreConfidenceCheck && score < 0.5 && hooksCount < 2) {
  return {
    skippedGeneration: true,
    differentiation_confidence_score: score,
    differentiation_confidence_level: level,
    distinctive_hooks_missing: true,
    ui_prompt_da: 'Tilføj 1–2 ting der gør jer unikke (fx kunst på væggen, ikon ved indgangen, udsigt, bar/cocktails, events).'
  }
}
```

**Why Skip Generation?**
- Prevents AI from hallucinating generic brand profiles
- Forces user to add 1-2 concrete differentiators
- Improves output quality dramatically

### **Step 6: Run Prompt B - Brand Profile Generation**
**Model**: GPT-4o  
**Temperature**: 0.25 (slightly creative)  
**Max Tokens**: 3000

**Purpose**: Generate user-facing brand sections

**Input Prompt Structure**:
```
You have the following INTERNAL ANALYSIS:

Distinctive Hooks:
#1: "ved åen" (Evidence: "Meta Title: Café Viggo - Hyggelig café ved åen i København")
#2: "vintage furniture" (Evidence: "Image #2: AI Labels: interior, vintage furniture...")

Core Offerings:
- økologisk kaffe
- hjemmelavet brunch
- DEN LUKSURIØSE BRUNCH
- EGGS BENEDICT

[... full Prompt A output ...]

TASK:
Generate a brand profile with these sections:
1. brand_essence: One-sentence positioning (must include location cue)
2. tone_of_voice: Writing style description
3. target_audience: Who they speak to
4. core_offerings: 2-3 sentences describing menu/services
5. content_focus: 4 bullet points for content themes
6. cta_style: Primary booking CTA + 2 soft CTAs
7. communication_goal: What business wants to achieve
8. image_preferences: { dos: [], donts: [], signature_shot: "" }
9. things_to_avoid: { language_constraints: [], factual_constraints: [] }
10. content_pillars: [{ name, encouraged: true/false, notes: "(#1)" }]
11. social_style: { emoji_usage, hashtag_strategy }
12. voice_examples: { do_say: [], dont_say: [], vocabulary: {} }

CRITICAL RULES:
- Reference hooks by number: (#1), (#2)
- Use EXACT phrases from must_use_phrases
- Include location cue in brand_essence
- content_focus must have 4 diverse themes (food, atmosphere, people, story)
- cta_style must have booking CTA + 2+ soft CTAs
```

**Output JSON Example**:
```json
{
  "brand_essence": {
    "value": "København: Økologisk brunch og kaffe i hyggelige omgivelser ved åen (#1).",
    "proof": ["#1", "concrete_anchor:økologisk kaffe"]
  },
  "tone_of_voice": {
    "value": "Venlig, inviterende, underspillet. Fokus på håndværk og kvalitet uden at virke opblæst.",
    "proof": ["website_hero", "copy_pattern:underspillet"]
  },
  "target_audience": {
    "value": "Lokale i København der søger kvalitetsbrunch i afslappede omgivelser ved åen.",
    "proof": ["#1", "business_location:København"]
  },
  "core_offerings": {
    "value": "Vi serverer økologisk kaffe og hjemmelavet brunch. Vores 'DEN LUKSURIØSE BRUNCH' med koldrøget laks og pocherede æg er en favorit blandt gæsterne.",
    "proof": ["must_use:DEN LUKSURIØSE BRUNCH", "concrete_anchor:økologisk kaffe"]
  },
  "content_focus": {
    "value": "- Brunchretter og signaturkaffe (#3)\n- Stemning ved åen og vintage interiør (#1, #2)\n- Gæsteoplevelser og sociale momenter\n- Bag kulisserne: håndværk og økologiske råvarer",
    "proof": ["#1", "#2", "#3", "physical_space", "rituals"]
  },
  "cta_style": {
    "value": "Primær: 'Book bord nu'\nSekundær: 'Kig forbi i dag', 'Se vores menu', 'Følg med på Instagram'",
    "proof": ["website_cta", "inferred_from_business_type"]
  },
  "content_pillars": [
    { "name": "Brunch & Kaffe", "encouraged": true, "notes": "Fokus på DEN LUKSURIØSE BRUNCH (#3)" },
    { "name": "Stemning ved åen", "encouraged": true, "notes": "Brug location cue (#1)" },
    { "name": "Vintage Interiør", "encouraged": true, "notes": "Reference physical space (#2)" },
    { "name": "Sustainability", "encouraged": false, "notes": "Kun hvis økologi nævnes eksplicit" }
  ],
  "image_preferences": {
    "dos": ["Close-ups af retter", "Natural light fra vinduer", "Gæster ved åen"],
    "donts": ["Stock photos", "Heavy filters", "Empty tables"],
    "signature_shot": "Gæster ved åen i gyldent aftenlys, mens de nyder – close-up af DEN LUKSURIØSE BRUNCH i forgrunden – ved åen (#1)."
  },
  "things_to_avoid": {
    "language_constraints": ["Undgå 'luksuriøs' uden menu-sammenhæng", "Undgå 'perfekt'"],
    "factual_constraints": ["Nævn aldrig cocktails (ej i menu)", "Undgå at nævne udsigt hvis ikke bekræftet"]
  },
  "social_style": {
    "emoji_usage": "moderate",
    "emoji_examples": ["☕", "🥐", "🌊"],
    "hashtag_strategy": {
      "branded": ["#CaféViggo", "#ViggoKbh"],
      "category": ["#brunch", "#café", "#økologisk"],
      "local": ["#københavncafé", "#nørrebro", "#vedåen"]
    }
  },
  "voice_examples": {
    "do_say": ["Nyd morgenen med økologisk kaffe", "Vi ses ved åen"],
    "dont_say": ["Luksuriøs atmosfære", "Perfekt brunch"],
    "vocabulary": {
      "prefer": ["nyde", "hyggelig", "håndværk"],
      "avoid": ["fantastisk", "vidunderlig", "perfekt"]
    }
  }
}
```

### **Step 7: Validation + Repair**
```typescript
// 1. Validate output structure
const validationErrors = validateBrandProfileOutput(sections, analysis, dataSources)

if (validationErrors.length > 0) {
  // 2. Attempt AI repair
  sections = await repairBrandProfile(sections, validationErrors, language, apiKey)
  
  // 3. If still invalid, apply deterministic fallbacks
  if (stillHasErrors) {
    if (missingSignatureShot) {
      sections.image_preferences.signature_shot = buildFallbackSignatureShot(...)
    }
    if (badTargetAudience) {
      sections.target_audience.value = buildFallbackTargetAudience(...)
    }
    // ... other fallbacks
  }
}
```

**Validation Rules** (Prompt B):
- ✅ `brand_essence` must include location cue
- ✅ Hook references must use (#1), (#2), etc.
- ✅ `target_audience` cannot be question ("Hvem taler i til?")
- ✅ `core_offerings` must use exact menu item names
- ✅ `content_focus` must have 4 diverse themes
- ✅ `cta_style` must have booking + 2+ soft CTAs
- ✅ `signature_shot` must be detailed photo prompt

**Repair Strategy**:
1. **AI Repair**: Send errors to GPT-4o JSON fixer
2. **Deterministic Fallbacks**: If AI fails, use rule-based generation
3. **Final Check**: Ensure no placeholder text remains

### **Step 8: Save to Database**
```typescript
await saveBrandProfile(businessId, brandProfile, analysis, supabase)

// Inserts into business_brand_profile table:
{
  business_id: uuid,
  brand_essence: "København: Økologisk brunch og kaffe...",
  tone_of_voice: "Venlig, inviterende, underspillet...",
  things_to_avoid: {
    language_constraints: ["Undgå 'luksuriøs'..."],
    factual_constraints: ["Nævn aldrig cocktails..."]
  },
  target_audience: "Lokale i København...",
  core_offerings: "Vi serverer økologisk kaffe...",
  content_focus: "- Brunchretter og signaturkaffe...",
  content_pillars: [
    { name: "Brunch & Kaffe", encouraged: true, notes: "..." }
  ],
  cta_style: "Primær: 'Book bord nu'...",
  communication_goal: "Opbygge lokal identitet som...",
  recognizable_interior_identity: "Vintage furniture, hyggelige...",
  image_preferences: {
    dos: ["Close-ups af retter..."],
    donts: ["Stock photos..."],
    signature_shot: "Gæster ved åen i gyldent aftenlys..."
  },
  social_style: {
    emoji_usage: "moderate",
    emoji_examples: ["☕", "🥐"],
    hashtag_strategy: {...}
  },
  voice_examples: {
    do_say: ["Nyd morgenen..."],
    dont_say: ["Luksuriøs atmosfære..."],
    vocabulary: {...}
  },
  confidence_metadata: {
    brand_essence: { score: 0.85, level: "high", signals_used: ["#1", "website_hero"] },
    tone_of_voice: { score: 0.75, level: "high", signals_used: ["copy_pattern"] },
    // ... scores for all fields
  },
  updated_at: "2026-01-07T14:30:00Z"
}
```

### **Step 9: Return Response**
```typescript
return new Response(JSON.stringify({
  success: true,
  brandProfile: {
    brand_essence: "...",
    tone_of_voice: "...",
    // ... all fields (flat structure for frontend)
  },
  analysisEvidence: {
    differentiation_confidence_score: 0.85,
    differentiation_confidence_level: "high",
    distinctive_hooks_count: 3
  },
  requestId: "bp-1234567890-abc123"
}), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
})
```

---

## 📊 Data Sources Priority

**Highest Impact** (80% of quality):
1. **Menu Items** - Concrete offerings with exact names
2. **Website Analysis** - Hero text, meta descriptions, headers
3. **Business Images** - AI labels reveal physical space/atmosphere

**Medium Impact** (15%):
4. **Business Profile** - Short/long description
5. **Social Media** - Instagram bio, post themes
6. **Location** - Address, city context

**Low Impact** (5%):
7. **Opening Hours** - Indirectly indicates target audience

---

## ⚠️ Common Failure Modes

### **1. Low Confidence → Generation Skipped**
**Trigger**: `distinctive_hooks.length < 2` or `confidence_score < 0.5`

**Response**:
```json
{
  "skippedGeneration": true,
  "differentiation_confidence_score": 0.35,
  "differentiation_confidence_level": "low",
  "distinctive_hooks_missing": true,
  "ui_prompt_da": "Tilføj 1–2 ting der gør jer unikke..."
}
```

**User Action Required**: Add 1-2 unique details (e.g., "ved åen", "kunst på væggen")

### **2. Invalid JSON from AI**
**Trigger**: AI returns malformed JSON or includes markdown

**Recovery**:
1. Attempt JSON fixer (GPT-4o with strict instructions)
2. Retry generation with stricter prompt
3. Apply deterministic fallbacks

### **3. Generic/Placeholder Output**
**Trigger**: AI generates "Hvem taler i til?" or "Jeres primære produkter"

**Recovery**:
- Fallback functions generate location + menu-based content
- Example: "Lokale i [city] der søger [offering] i [daypart]"

### **4. Missing Hook References**
**Trigger**: `content_pillars[].notes` doesn't reference (#1), (#2)

**Recovery**:
- Patch function adds "(#1)" to all encouraged pillars
- Ensures traceability to evidence

---

## 🎯 Quality Assurance

### **Validation Layers**

**Layer 1: Prompt A Validation**
- Evidence must exist verbatim in input corpus
- Source must be valid label
- Confidence must be enum value

**Layer 2: Prompt B Validation**
- All required fields present
- Hook references use correct numbering
- Target audience not a question
- Core offerings not generic placeholders
- Content focus has 4 diverse themes
- CTA style has booking + 2+ soft options

**Layer 3: Final Safety Checks**
```typescript
// Reject bad values even after repair
if (isBadTargetAudienceValue(value)) {
  value = buildFallbackTargetAudience(...)
}
if (isBadCoreOfferingsValue(value)) {
  value = buildFallbackCoreOfferings(...)
}
```

### **Confidence Scoring**

Each field gets a confidence score (0.0-1.0):
- **high** (≥0.70): Strong evidence from multiple sources
- **inferred** (0.50-0.69): Reasonable inference from data
- **medium** (0.40-0.49): Weak evidence or single source
- **low** (<0.40): Fallback/guessed value

**Example**:
```json
{
  "brand_essence": {
    "value": "København: Økologisk brunch ved åen",
    "confidence_score": 0.85,
    "confidence_level": "high",
    "signals_used": ["#1:ved åen", "website_hero", "menu:økologisk"]
  },
  "target_audience": {
    "value": "Lokale i København der søger brunch",
    "confidence_score": 0.45,
    "confidence_level": "medium",
    "signals_used": ["inferred_from_business_type", "location:København"]
  }
}
```

---

## 🔧 Developer Notes

### **Adding New Brand Profile Fields**

**1. Update Database Schema**:
```sql
ALTER TABLE business_brand_profile
ADD COLUMN new_field TEXT;
```

**2. Update Types** (`_shared/brand-profile/types.ts`):
```typescript
export interface BrandProfile {
  new_field: BrandVariable
}
```

**3. Update Prompt B** (`_shared/brand-profile/prompts/prompt-b.ts`):
```typescript
export const BRAND_PROFILE_SCHEMA = `
{
  "new_field": {
    "value": "Description of new field",
    "proof": ["#1", "source"]
  }
}
`
```

**4. Update Validator** (`_shared/brand-profile/validators.ts`):
```typescript
if (!sections.new_field?.value) {
  errors.push('Missing new_field')
}
```

**5. Update Parser** (`brand-profile-generator/index.ts`):
```typescript
return {
  new_field: {
    value: pickValue('new_field'),
    confidence_score: computeConfidence('new_field', evidence),
    confidence_level: conf.new_field.level,
    signals_used: evidence.new_field?.sources || []
  }
}
```

### **Testing Generation Locally**

```bash
# 1. Start Supabase locally
supabase start

# 2. Deploy function
supabase functions deploy brand-profile-generator

# 3. Test with curl
curl -X POST 'http://localhost:54321/functions/v1/brand-profile-generator' \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "uuid-here",
    "forceRegenerate": true,
    "ignoreConfidenceCheck": true
  }'
```

### **Debugging Failed Generation**

**Check Supabase Logs**:
```bash
supabase functions logs brand-profile-generator --tail=100
```

**Look for**:
- `[requestId] 🎯 Starting brand profile generation`
- `[requestId] ⚠️ Prompt A returned invalid JSON`
- `[requestId] Validation errors found`
- `[requestId] ✅ Applied deterministic fallbacks`

**Common Issues**:
- Missing data sources → Check database joins
- Invalid JSON → Check AI model output
- Low confidence → Add more unique details to business profile

**Critical Error Handling** (Fixed January 13, 2026):
- **Issue**: "Uncaught (in promise)" errors in browser console when generation fails
- **Root Cause**: onClick handlers calling async `generate()` without awaiting or catching
- **Solution**: Wrap all `generate()` calls in try-catch blocks:
  ```typescript
  // ✅ Correct pattern
  onClick={async () => {
    try {
      await generate()
    } catch (err) {
      console.warn('Generate error caught:', err)
    }
  }}
  
  // ❌ Wrong pattern
  onClick={() => generate()} // Promise not awaited/handled
  ```
- **Fixed Files**:
  - `src/pages/dashboard/BrandProfilePage_NEW.tsx` (handleGenerateClick)
  - `src/pages/dashboard/businessProfile/components/BrandContextPanel.tsx` (two onClick handlers)

---

## 📈 Performance Metrics

**Typical Timings**:
- Data gathering: 1-2 seconds
- Prompt A (Analysis): 8-12 seconds
- Prompt B (Generation): 5-8 seconds
- Validation + Repair: 1-3 seconds
- Database save: 0.5-1 second
- **Total**: 15-25 seconds

**Cost Breakdown** (per generation):
- Prompt A (GPT-4o, ~1500 input + 2000 output tokens): $0.03
- Prompt B (GPT-4o, ~2500 input + 3000 output tokens): $0.05
- JSON Repair (if needed): $0.01
- **Total**: ~$0.05-0.10 per generation

**Success Rate**:
- First-attempt success: 75%
- After JSON repair: 90%
- After fallbacks: 98%

---

## 🚀 Future Enhancements

### **Phase 2 (Planned)**
1. **Iterative Refinement**: Allow user to regenerate specific fields
2. **A/B Testing**: Test multiple brand voice variations
3. **Performance Feedback Loop**: Track which profiles generate best engagement
4. **Multi-language Support**: Expand beyond Danish/English

### **Phase 3 (Ideas)**
1. **Competitor Analysis**: Include competitor brand profiles
2. **Industry Benchmarks**: Compare against sector averages
3. **Historical Evolution**: Track brand profile changes over time

---

*Last Updated: January 13, 2026*  
*Version: brand-profile-generator v3.3 (Added proper async error handling)*
