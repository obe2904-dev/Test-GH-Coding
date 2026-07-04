# LAYER 0 PERSONA INTEGRATION PLAN
## Documentation: Current State → Future Integration

**Created:** 2025-05-20  
**Status:** DOCUMENTATION ONLY - No code changes yet  
**Goal:** Ensure Layer 0 is perfect before integrating into content generation

---

## 📊 CURRENT STATE ANALYSIS

### ✅ What Layer 0 DOES (Working)

**Location:** `business_brand_profile.brand_profile_v5.layer_0_intelligence`

**4 Components Generated:**

1. **business_type**
   - Detects: `casual_dining`, `cafe_bar_restaurant`, etc.
   - Domain: Professional domain in Danish
   - Confidence: 0-1 score
   - Reasoning: Why this type was chosen

2. **geographic_context**
   - City profile with population, characteristics
   - Location type: `waterfront_leisure`, `downtown_urban`, etc.
   - Cultural context and tone guidance
   - Competition level assessment
   - Signature reference (e.g., "ved åen")

3. **professional_persona**
   - Formality: `casual_friend`, `professional`, `formal`
   - Sentence style: `conversational`, `direct`, `flowing`
   - Emoji usage: `minimal`, `moderate`, `frequent`
   - Content focus areas
   - Expertise areas
   - **system_prompt_preview** (truncated)

4. **voice_archetype**
   - Archetype ID: `restaurant_approachable`, `bar_social`, etc.
   - Base rules: 6-17 Danish language rules
   - Content priorities
   - Location context weight

### ❌ What Layer 0 DOESN'T DO (Gaps)

**1. Full System Prompt Missing**
- ✅ Has: `system_prompt_preview` (first 500 chars)
- ❌ Missing: Complete `system_prompt` field
- **Impact:** Can't use full persona in AI prompts

**2. Not Integrated**
- Brand profile generator CREATES Layer 0
- Ideas generator DOESN'T READ Layer 0
- Text generator DOESN'T READ Layer 0
- **Impact:** Inconsistent voice across system

**3. No Validation**
- Layer 0 is generated but never validated
- No quality checks on persona accuracy
- No testing of voice consistency
- **Impact:** Unknown quality of generated personas

---

## 🔍 CAFE FAUST EXAMPLE (Current Data)

### Business Type
```
Type: casual_dining
Domain: "casual dining og everyday restaurants"
Confidence: 70%
Reasoning: "Frokost/middag program uden morgenmad"
```

### Voice Archetype
```
ID: restaurant_approachable
Rules: 6 content rules
- Menu-highlights og chef-anbefalinger
- Seasonal ingredients og skiftende menu
- Dining experience storytelling
- Balance mellem food-fokus og atmosphere
- Accessibility og approachability
- Mad-kvalitet kommunikeret tilgængeligt
```

### Professional Persona
```
Formality: casual_friend
Style: conversational
Emoji: moderate
System Prompt Preview: "Du er en professionel social media manager 
specialiseret i restaurant marketing i Danmark..."
```

### Geographic Context
```
Location: ved åen (waterfront_leisure)
City: Aarhus (medium_city, 350K)
Tone Guidance: "Casual og tilgængelig. Universitetsby med yngre 
demografy. Balance mellem urban cool og approachable."
USP: "Fremhæv location kraftigt - det er jeres USP"
```

---

## ⚠️ QUALITY CONCERNS TO VALIDATE

### 1. Business Type Detection Accuracy
**Current:** `casual_dining` (70% confidence)  
**Questions:**
- Is 70% confidence acceptable?
- Is "casual dining" the right category for Cafe Faust?
- Should it be `cafe_bar_restaurant` instead?
- What triggers casual_dining vs cafe classification?

**Test:** Generate for 5 different business types, verify accuracy

---

### 2. System Prompt Completeness
**Current:** Only preview (truncated at 500 chars)  
**Questions:**
- Where is the full system_prompt stored?
- Is it being generated but not saved?
- Do we need to store the full prompt (could be 2000+ chars)?

**Test:** Check if full prompt exists in brand_profile_v5 elsewhere

---

### 3. Voice Archetype Rule Quality
**Current:** 6 rules for `restaurant_approachable`  
**Questions:**
- Are these rules specific enough?
- Do they differentiate from other archetypes?
- Are they actionable for AI prompts?
- Example: "Accessibility og approachability" - too vague?

**Test:** Compare rules across 3 different archetypes

---

### 4. Geographic Context Usefulness
**Current:** Rich city data + location advantages  
**Questions:**
- Is "medium_city" accurate for Aarhus (350K)?
- Is "waterfront_leisure" the right location type?
- Are location advantages being used in content?
- Is "Fremhæv location kraftigt" being followed?

**Test:** Generate content with/without geographic context

---

### 5. Persona Consistency
**Current:** Generated once, stored in JSONB  
**Questions:**
- If business changes (new menu, new location), does persona update?
- How often should Layer 0 be regenerated?
- What triggers a persona regeneration?
- Is there version tracking?

**Test:** Check if persona changes when business data changes

---

## 📋 VALIDATION CHECKLIST (Before Integration)

### Phase 1: Data Quality Audit
- [ ] Run Layer 0 generation for 10 test businesses
- [ ] Verify business_type accuracy (manual check each one)
- [ ] Check voice_archetype rules are unique per archetype
- [ ] Validate geographic_context matches actual location
- [ ] Confirm professional_persona formality is appropriate

### Phase 2: System Prompt Investigation
- [ ] Find where full system_prompt is stored (if anywhere)
- [ ] If missing, update generator to save full prompt
- [ ] Verify system_prompt is usable in AI API calls
- [ ] Test prompt with OpenAI to ensure it works
- [ ] Check prompt length limits (GPT-4 system message max)

### Phase 3: Consistency Testing
- [ ] Generate brand profile for test business
- [ ] Check Layer 0 persona details
- [ ] Manually create content following persona rules
- [ ] Compare manual vs what system would generate
- [ ] Verify tone/voice matches expectations

### Phase 4: Edge Case Testing
- [ ] Test with minimal data (new business, no menu)
- [ ] Test with rich data (full menu, website, photos)
- [ ] Test different business types (cafe vs restaurant vs bar)
- [ ] Test different locations (waterfront vs downtown vs suburban)
- [ ] Test different cities (Copenhagen vs Aarhus vs small town)

### Phase 5: Performance Check
- [ ] Measure Layer 0 generation time
- [ ] Check JSONB size (is it getting too large?)
- [ ] Verify database indexing for layer_0_intelligence queries
- [ ] Test query performance for reading Layer 0
- [ ] Confirm no timeout issues on generation

---

## 🔄 FUTURE INTEGRATION PLAN (After Validation)

### Step 1: Update generate-text-from-idea
**Current:** Reads `brand_profile_v5.voice` (old structure)  
**Future:** Read `brand_profile_v5.layer_0_intelligence`

**Changes Needed:**
```
resolve-context.ts:
  - Add layer0Intelligence to BusinessContext interface
  - Query brand_profile_v5->'layer_0_intelligence'
  - Extract professional_persona.system_prompt
  - Extract voice_archetype.base_rules
  - Pass to prompt builder

prompt-builders.ts:
  - Accept layer0 data as parameter
  - Use professional_persona.system_prompt as AI system message
  - Include voice_archetype.base_rules in prompt
  - Use business_type for context
  - Use geographic_context for location references
```

**Files to Modify:**
- `supabase/functions/generate-text-from-idea/resolve-context.ts`
- `supabase/functions/generate-text-from-idea/prompt-builders.ts`
- `supabase/functions/generate-text-from-idea/index.ts`

---

### Step 2: Update get-quick-suggestions
**Current:** Uses generic hospitality fallback prompts  
**Future:** Read Layer 0 for persona-matched suggestions

**Changes Needed:**
```
index.ts:
  - Query business_brand_profile for layer_0_intelligence
  - Use professional_persona.system_prompt in Gemini call
  - Apply voice_archetype.base_rules to suggestions
  - Filter suggestion types by business_type
  - Use geographic_context for location-specific ideas
```

**Files to Modify:**
- `supabase/functions/get-quick-suggestions/index.ts`

---

### Step 3: Create Shared Layer 0 Reader Module
**Purpose:** Avoid duplicating Layer 0 reading logic

**New File:** `supabase/functions/_shared/layer0-reader.ts`

**Functions:**
```typescript
export async function getLayer0Intelligence(
  supabase: SupabaseClient,
  businessId: string
): Promise<Layer0Intelligence | null>

export interface Layer0Intelligence {
  businessType: {
    detectedType: string
    professionalDomain: string
    confidence: number
    reasoning: string
  }
  geographicContext: {
    city: string
    populationSize: string
    locationType: string
    signatureReference: string
    narrative: string
  }
  professionalPersona: {
    systemPrompt: string  // FULL prompt, not preview
    formality: string
    sentenceStyle: string
    emojiUsage: string
    contentFocus: string[]
    expertiseAreas: string[]
  }
  voiceArchetype: {
    archetypeId: string
    baseRules: string[]
    contentPriorities: string[]
    formalityLevel: string
    locationContextWeight: string
  }
}
```

---

### Step 4: Update Brand Profile Generator V5
**If system_prompt is missing:**

**Changes Needed:**
```
professional-persona.ts:
  - Generate FULL system_prompt (not just preview)
  - Save complete prompt to layer_0_intelligence
  - Keep preview for quick display
  - Ensure prompt is valid for OpenAI/Anthropic/Gemini
```

**Files to Modify:**
- `supabase/functions/_shared/brand-profile-v5/professional-persona.ts`
- `supabase/functions/brand-profile-generator-v5/index.ts`

---

### Step 5: Create Validation Function
**Purpose:** Ensure generated content matches Layer 0 persona

**New File:** `supabase/functions/_shared/validation/validate-layer0-consistency.ts`

**Functions:**
```typescript
export function validateContentAgainstLayer0(
  content: string,
  layer0: Layer0Intelligence
): {
  score: number  // 0-1
  violations: string[]
  recommendations: string[]
}

// Checks:
// - Formality matches persona.formality
// - Emoji usage matches persona.emojiUsage
// - Content follows voice_archetype.baseRules
// - Tone matches geographic_context.toneGuidance
```

---

## 📁 FILES TO CHECK/MODIFY (Reference)

### Current Layer 0 Generation
```
supabase/functions/brand-profile-generator-v5/index.ts
  └─ Lines 267-332: Layer 0 generation logic

supabase/functions/_shared/brand-profile-v5/
  ├─ business-type-detection.ts (detectBusinessType)
  ├─ geographic-context.ts (enrichGeographicContext)
  ├─ professional-persona.ts (assignProfessionalPersona)
  └─ voice-archetype.ts (assignVoiceArchetype)
```

### Future Integration Points
```
supabase/functions/generate-text-from-idea/
  ├─ index.ts (main orchestrator)
  ├─ resolve-context.ts (fetch business data)
  └─ prompt-builders.ts (construct AI prompts)

supabase/functions/get-quick-suggestions/
  └─ index.ts (suggestion generation)
```

### Storage
```
Database: business_brand_profile table
Column: brand_profile_v5 (JSONB)
Path: brand_profile_v5.layer_0_intelligence.*
```

---

## 🧪 TESTING QUERIES

### Check if Full System Prompt Exists
```sql
SELECT 
  business_id,
  LENGTH(brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'system_prompt') as prompt_length,
  LENGTH(brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'system_prompt_preview') as preview_length
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

### Verify Layer 0 Completeness
```sql
SELECT 
  business_id,
  CASE 
    WHEN brand_profile_v5->'layer_0_intelligence'->'business_type' IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_business_type,
  CASE 
    WHEN brand_profile_v5->'layer_0_intelligence'->'professional_persona'->'system_prompt' IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_full_system_prompt,
  CASE 
    WHEN jsonb_array_length(brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->'base_rules') > 0 THEN '✅'
    ELSE '❌'
  END as has_voice_rules
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

### Compare Persona Across Businesses
```sql
SELECT 
  b.name as business_name,
  brand_profile_v5->'layer_0_intelligence'->'business_type'->>'detected_type' as type,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'formality' as formality,
  brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->>'archetype_id' as archetype
FROM business_brand_profile bbp
JOIN businesses b ON b.id = bbp.business_id
WHERE brand_profile_v5->'layer_0_intelligence' IS NOT NULL
LIMIT 10;
```

---

## 🎯 SUCCESS CRITERIA (Before Code Integration)

### Layer 0 Quality Gates

**Business Type Detection:**
- ✅ 80%+ accuracy on manual review of 10 businesses
- ✅ Confidence scores align with actual accuracy
- ✅ Different business types get different results

**Geographic Context:**
- ✅ City classifications are correct (major/medium/small)
- ✅ Location types match reality (waterfront/downtown/suburban)
- ✅ Tone guidance is specific and actionable

**Professional Persona:**
- ✅ Full system_prompt exists (not just preview)
- ✅ System prompt is 500-2000 chars
- ✅ Formality levels are distinct and appropriate
- ✅ Content focus areas are relevant to business type

**Voice Archetype:**
- ✅ Base rules are specific (not generic platitudes)
- ✅ Different archetypes have meaningfully different rules
- ✅ Rules are actionable for AI content generation
- ✅ 6-17 rules per archetype (not too few, not too many)

### Integration Readiness

**Before writing ANY integration code:**
1. ✅ All quality gates above passed
2. ✅ Full system_prompt confirmed working in OpenAI test
3. ✅ Manual content test shows persona works
4. ✅ Edge cases tested (minimal data, rich data, different types)
5. ✅ Performance validated (generation time < 30s)

---

## 📝 NEXT STEPS (IN ORDER)

1. **NOW:** Review this documentation for completeness
2. **NEXT:** Run validation checklist Phase 1-5
3. **THEN:** Fix any Layer 0 quality issues found
4. **FINALLY:** Implement integration (only when Layer 0 is perfect)

---

## 🔗 RELATED DOCUMENTATION

- [PERSONA-DATA-FLOW.md](PERSONA-DATA-FLOW.md) - How persona data flows
- [CHECK-PERSONA.sql](CHECK-PERSONA.sql) - Full persona inspection queries
- [CHECK-PERSONA-SUMMARY.sql](CHECK-PERSONA-SUMMARY.sql) - Quick persona check
- [GET-FULL-LAYER0.sql](GET-FULL-LAYER0.sql) - Complete Layer 0 JSON export

---

## ⚠️ CRITICAL DECISION POINTS

### Decision 1: System Prompt Storage
**Question:** Do we store full system_prompt (2000+ chars) in JSONB?  
**Options:**
- A) Store in layer_0_intelligence (simple, but large JSONB)
- B) Store in separate column (cleaner, but more complex)
- C) Generate on-the-fly when needed (no storage, but slower)

**Recommendation:** TBD after testing prompt lengths

---

### Decision 2: Regeneration Trigger
**Question:** When should Layer 0 be regenerated?  
**Options:**
- A) Only on manual brand profile regeneration
- B) Automatically when business data changes significantly
- C) On a schedule (e.g., quarterly)
- D) Never (treat as immutable after first generation)

**Recommendation:** TBD after understanding use cases

---

### Decision 3: Fallback Strategy
**Question:** What if Layer 0 doesn't exist for a business?  
**Options:**
- A) Generate Layer 0 on-demand when needed
- B) Use generic hospitality fallback (current behavior)
- C) Require Layer 0 before allowing content generation
- D) Use simplified Layer 0 for free tier

**Recommendation:** TBD based on tier strategy

---

## 📊 METRICS TO TRACK (Post-Integration)

**Quality Metrics:**
- Voice consistency score (manual review sample)
- Persona match rate (does content match archetype?)
- User satisfaction with generated content
- Edit rate (how much do users change AI content?)

**Performance Metrics:**
- Layer 0 generation time
- Content generation time with Layer 0
- Database query performance
- JSONB size growth over time

**Business Metrics:**
- Content engagement (with vs without Layer 0)
- User retention (quality content = retention?)
- Tier upgrades (better content = upgrades?)

---

**STATUS: DOCUMENTATION COMPLETE**  
**NEXT ACTION: Validate Layer 0 quality before any code changes**
