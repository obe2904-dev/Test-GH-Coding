# PERSONA DATA FLOW FOR CAFE FAUST
## How Professional Persona is Built and Stored

### 📥 INPUT SOURCES (What data goes IN)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. BUSINESS DATA (from businesses table)                        │
│    • name: "Cafe Faust"                                         │
│    • establishment_type: "cafe"                                 │
│    • category: business.category                                │
│    • local_location_reference: "ved åen"                        │
│    • country: "Denmark"                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. LOCATION DATA (from business_locations via JOIN)             │
│    • postal_code: "8000"                                        │
│    • city: "Aarhus"                                             │
│    • country: "Denmark" (fallback)                              │
│    • is_primary: true                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. MENU DATA (from programmes detection)                        │
│    • Programme types: ["brunch", "lunch", "dinner"]             │
│    • Menu items: extracted from business_profile.menu_structure │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. LOCATION INTELLIGENCE (from business_location_intelligence)  │
│    • neighborhood: location intelligence data                   │
│    • area_type: derived from location                          │
│    • city context: from postal code mapping                     │
└─────────────────────────────────────────────────────────────────┘
```

### ⚙️ PROCESSING (How persona is BUILT)

**File:** `brand-profile-generator-v5/index.ts`

```typescript
// Step 2.5: Layer 0 - Business Intelligence (Lines 267-332)

1. detectBusinessType({
     programmes: ["brunch", "lunch", "dinner"],
     menu_text: "menu items as text",
     establishment_type: "cafe",
     category: business.category
   })
   → Returns: {
       type: "cafe_bar_restaurant",
       professional_domain: "café & restaurant",
       confidence: 0.85,
       reasoning: "Multiple meal programmes..."
     }

2. enrichGeographicContext(
     postal_code: "8000",
     city: "Aarhus",
     local_location_reference: "ved åen"
   )
   → Returns: {
       city_profile: {
         city: "Aarhus",
         population: 285273,
         size_category: "major_city",
         cultural_context: "...",
         tone_guidance: "..."
       },
       location_context: {
         type: "waterfront_neighborhood",
         signature: "ved åen"
       }
     }

3. assignProfessionalPersona(
     businessType: "cafe_bar_restaurant",
     geographicContext: {...}
   )
   → Returns: {
       formality: "casual_professional",
       sentence_style: "short_direct",
       emoji_usage: "minimal_contextual",
       expertise_areas: [...],
       system_prompt: "Du er en erfaren café-professionel..."
     }

4. assignVoiceArchetype(
     businessType: "cafe_bar_restaurant",
     persona: {...},
     city: "Aarhus"
   )
   → Returns: {
       archetype_id: "danish_casual_authentic",
       base_rules: [17 Danish language rules],
       location_context_weight: "medium"
     }
```

### 💾 OUTPUT STORAGE (Where it's STORED)

```
┌─────────────────────────────────────────────────────────────────┐
│ TABLE: business_brand_profile                                    │
│                                                                  │
│ Row for business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'    │
│                                                                  │
│ Column: brand_profile_v5 (JSONB)                                │
│ {                                                                │
│   "layer_0_intelligence": {                                      │
│     "business_type": {                                           │
│       "detected_type": "cafe_bar_restaurant",                   │
│       "professional_domain": "café & restaurant",               │
│       "confidence": 0.85,                                        │
│       "reasoning": "..."                                         │
│     },                                                           │
│     "geographic_context": {                                      │
│       "postal_code": "8000",                                    │
│       "city": "Aarhus",                                         │
│       "population": 285273,                                      │
│       "population_size": "major_city",                          │
│       "location_type": "waterfront_neighborhood",               │
│       "signature_reference": "ved åen",                         │
│       "city_profile_description": {                             │
│         "cultural_context": "...",                              │
│         "tone_guidance": "...",                                 │
│         "competition_level": "..."                              │
│       }                                                          │
│     },                                                           │
│     "professional_persona": {                                    │
│       "formality": "casual_professional",                       │
│       "sentence_style": "short_direct",                         │
│       "emoji_usage": "minimal_contextual",                      │
│       "expertise_areas": ["café drift", "gastronomi", ...],     │
│       "system_prompt": "Du er en erfaren café-professionel..." │
│       "system_prompt_preview": "First 500 chars..."            │
│     },                                                           │
│     "voice_archetype": {                                         │
│       "archetype_id": "danish_casual_authentic",                │
│       "base_rules": [17 Danish rules],                          │
│       "base_rules_count": "17",                                 │
│       "location_context_weight": "medium"                       │
│     }                                                            │
│   },                                                             │
│   ... (rest of V5 profile)                                      │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 🔄 HOW IT'S USED (Downstream consumption)

```
Layer 0 Intelligence (Persona)
        ↓
Layer 3: Identity Profile (generateIdentityProfile)
        ↓
Layer 4: Audience Segmentation (generateAudienceSegments)
        ↓
Content Generation (ideas, posts, text)
        ↓
All content inherits the SAME persona characteristics
```

### 📍 KEY FILES

**Generation:**
- `brand-profile-generator-v5/index.ts` (Lines 267-332)
- `_shared/brand-profile-v5/business-type-detection.ts`
- `_shared/brand-profile-v5/geographic-context.ts`
- `_shared/brand-profile-v5/professional-persona.ts`
- `_shared/brand-profile-v5/voice-archetype.ts`

**Storage:**
- Table: `business_brand_profile`
- Column: `brand_profile_v5` (JSONB)
- Path: `brand_profile_v5.layer_0_intelligence`

**Query:**
- `CHECK-PERSONA.sql` (full details)
- `CHECK-PERSONA-SUMMARY.sql` (quick view)
