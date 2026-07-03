# Brand Profile Generator - Architecture & Implementation

## Overview
The `brand-profile-generator` Supabase Edge Function generates the 9 canonical brand voice variables automatically using a two-stage AI analysis system.

## Architecture

```
Frontend Request
    ↓
brand-profile-generator Edge Function
    ↓
┌─────────────────────────────────────────┐
│  Step 1: Gather Data Sources           │
│  - Tier 1: Business, Profile, Menu     │
│  - Tier 2: Website Analysis, Posts     │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Step 2: Prompt A (Internal Analysis)  │
│  - Heavy processing (GPT-4o)            │
│  - Extracts structured insights         │
│  - Hidden from user                     │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Step 3: Prompt B (Brand Generation)   │
│  - Clean output (GPT-4o-mini)           │
│  - User-facing Danish text              │
│  - 9 brand variables                    │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Step 4: Confidence Scoring             │
│  - Calculate 0-1 score per variable     │
│  - Map to high/medium/low               │
│  - Track signal sources                 │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Step 5: Save to Database               │
│  - Upsert to business_brand_profile     │
│  - All 9 variables + metadata           │
└─────────────────────────────────────────┘
```

## Data Sources (Priority Order)

### Tier 1 - Authoritative (Always Trust)
✅ **Business snapshot** (`businesses` table)
- `business_name`, `business_category`, `city`, `country`

✅ **User profile** (`business_profiles` table)
- `short_description`, `long_description`, `target_audience`
- **Weight**: +0.4 confidence if populated

✅ **Menu data** (`menu_items` table)
- Structured menu with names, descriptions, prices
- **Weight**: +0.2 confidence

✅ **Uploaded images** (future)
- Metadata: lighting, people, setting (not content analysis)

### Tier 2 - Supporting (Read-Only, Cautious)
📖 **Website analysis** (`website_analyses` table)
- Homepage content, About page, detected tone, key themes
- **Weight**: +0.2 for tone, +0.1 for themes
- **Used for**: Tone signals, NOT source of truth

📖 **Recent social posts** (future)
- Last ~10 posts max
- Captions only (not comments)
- **Used for**: Communication patterns, NOT claims

### Tier 3 - Do NOT Use (For Now)
❌ Reviews (Google, TripAdvisor)
❌ Ratings
❌ Engagement metrics
❌ Third-party articles

**Rule**: If a claim is not stated by the business itself, do not promote it into brand truth.

## Prompt A - Internal Analysis (Heavy, Hidden)

**Model**: GPT-4o  
**Purpose**: Extract structured insights from raw data  
**Temperature**: 0.3 (conservative)  
**Max Tokens**: 2000

### Output Structure
```json
{
  "brandIdentity": {
    "coreValues": ["value1", "value2", "value3"],
    "uniqueAttributes": ["attribute1", "attribute2"],
    "positioning": "one sentence"
  },
  "audienceInsights": {
    "primaryDemographic": "who they serve",
    "needs": ["need1", "need2"],
    "language": "how they speak"
  },
  "offeringAnalysis": {
    "topProducts": ["product1", "product2"],
    "serviceStyle": "how they deliver"
  },
  "communicationPatterns": {
    "toneSignals": ["signal1", "signal2"],
    "commonPhrases": ["phrase1", "phrase2"],
    "avoidancePatterns": ["avoid1", "avoid2"]
  },
  "confidence": {
    "dataQuality": 0.0-1.0,
    "signalsFound": ["source1", "source2"]
  }
}
```

## Prompt B - Brand Profile Generation (Clean, User-Facing)

**Model**: GPT-4o-mini  
**Purpose**: Generate user-readable brand variables in Danish  
**Temperature**: 0.7 (creative but controlled)  
**Max Tokens**: 3000

### Output Structure
```json
{
  "brand_essence": "Kernen i jeres brand...",
  "tone_of_voice": "Jeres kommunikationsstil...",
  "things_to_avoid": "Undgå...",
  "target_audience": "Jeres primære målgruppe...",
  "core_offerings": "Jeres hovedprodukter...",
  "content_focus": "Jeres indholdsfokus...",
  "cta_style": "Jeres call-to-action stil...",
  "communication_goal": "Jeres kommunikationsmål...",
  "image_preferences": "Jeres visuelle præferencer..."
}
```

### Writing Guidelines
1. Write in 2nd person ("I", "jeres", "jer") - speaking to the business
2. Be specific - avoid vague terms like "god kvalitet"
3. Use the business's own words when possible
4. If data is sparse, be conservative but helpful
5. Each variable should be 2-4 sentences

## Confidence Scoring

### Calculation Method
Start at 0.0, then add:

| Signal | Weight | When Applied |
|--------|--------|--------------|
| User onboarding answer | +0.4 | Profile fields populated |
| Website explicit statement | +0.3 | High-quality website analysis |
| Menu data supports it | +0.2 | Menu exists and relevant |
| Consistent tone across sources | +0.1 | Multiple sources agree |
| Internal analysis quality | +0.3 | Good data quality from Prompt A |

**Cap at 1.0**

### Confidence Levels
- **High**: ≥ 0.7 → Strong data, high trust
- **Medium**: 0.4 - 0.69 → Decent data, moderate trust
- **Low**: < 0.4 → Sparse data, conservative fallback

### Low Confidence Behavior
✅ **DO**: Generate conservative, generic-but-honest text  
✅ **DO**: Mark internally as low confidence  
✅ **DO**: Allow user to edit freely  
❌ **DON'T**: Hide the variable  
❌ **DON'T**: Hallucinate information  

## User Flows

### Auto-Generate (Automatic)
Triggers automatically when:
1. Website analysis completes for the first time
2. User completes onboarding (if website exists)

**Behavior**:
- Runs silently in background
- Only generates if profile is empty
- Provides instant value, avoids "empty state anxiety"

### Manual Generate (Explicit)
User clicks "Opdater Brandprofil med AI" button in Brand Profile page.

**Behavior**:
- Always visible
- Shows loading state
- Can override existing profile with `forceRegenerate: true`
- Shows "du kan redigere alt bagefter" message

## API Interface

### Request
```typescript
POST /brand-profile-generator

{
  "businessId": "uuid",
  "forceRegenerate": false // Optional, defaults to false
}
```

### Response (Success)
```typescript
{
  "success": true,
  "brandProfile": {
    "brand_essence": "text...",
    "tone_of_voice": "text...",
    // ... all 9 variables
  },
  "confidence": {
    "brand_essence": "high" | "medium" | "low",
    "tone_of_voice": "high" | "medium" | "low",
    // ... all 9 levels
  }
}
```

### Response (Already Exists)
```typescript
{
  "message": "Brand profile already exists",
  "existing": true
}
```

### Response (Error)
```typescript
{
  "error": "Failed to generate brand profile",
  "details": "error message"
}
```

## Database Schema

### Saved to: `business_brand_profile`
```sql
{
  business_id: uuid (FK),
  brand_essence: text,
  tone_of_voice: text,
  things_to_avoid: text,
  target_audience: text,
  core_offerings: text,
  content_focus: text,
  cta_style: text,
  communication_goal: text,
  image_preferences: text,
  updated_at: timestamp
}
```

**Note**: Confidence scores are NOT stored in database (internal only).

## Regeneration & Lifecycle Rules

### When to Auto-Regenerate
✅ New website analysis completed  
✅ User completes onboarding (first time only)

### When to Preserve User Edits
🔒 **NEVER overwrite user edits without `forceRegenerate: true`**

Check logic:
```typescript
if (!forceRegenerate && (existing.brand_essence || existing.tone_of_voice)) {
  return { existing: true }
}
```

### Versioning Strategy (Future)
For now: Simple upsert with `updated_at` timestamp.

Future enhancement:
- Store generation history
- Track which signals were used
- Allow rollback to previous versions

## Deployment

### 1. Deploy the Edge Function
```bash
supabase functions deploy brand-profile-generator
```

### 2. Set Environment Variables
Ensure these are set in Supabase:
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3. Test the Function
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/brand-profile-generator' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"businessId": "uuid-here"}'
```

## Frontend Integration

### Call from Website Analysis Completion
```typescript
// In website analyzer worker callback
if (analysisComplete && !brandProfileExists) {
  await fetch('https://your-project.supabase.co/functions/v1/brand-profile-generator', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ businessId })
  })
}
```

### Manual Trigger from Brand Profile Page
```typescript
// In BrandProfilePage_NEW.tsx
const handleGenerateBrandProfile = async () => {
  setIsGenerating(true)
  
  try {
    const response = await fetch('https://your-project.supabase.co/functions/v1/brand-profile-generator', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        businessId,
        forceRegenerate: true // Allow override
      })
    })
    
    const data = await response.json()
    
    if (data.success) {
      // Refresh brand profile data
      loadBrandProfile()
    }
  } catch (error) {
    console.error('Failed to generate brand profile:', error)
  } finally {
    setIsGenerating(false)
  }
}
```

## Error Handling

### Common Errors
1. **Missing OPENAI_API_KEY**: Check environment variables
2. **Invalid businessId**: Ensure business exists in database
3. **AI API timeout**: Retry with exponential backoff
4. **JSON parse error**: Check AI response format

### Monitoring
Log key events:
- ✅ Generation started
- ✅ Data gathered
- ✅ Prompt A completed
- ✅ Prompt B completed
- ✅ Profile saved
- ❌ Errors at each stage

## Future Enhancements

### Phase 2
- [ ] Store confidence scores in database
- [ ] Add generation history/versioning
- [ ] Support multiple languages (EN, SE)
- [ ] Include social posts analysis
- [ ] Image metadata analysis

### Phase 3
- [ ] A/B testing different prompts
- [ ] User feedback on generated variables
- [ ] Incremental updates (refresh single variable)
- [ ] Category-specific templates

---

**Status**: Ready for deployment ✅  
**Dependencies**: OpenAI API, Supabase, 9 brand voice columns  
**Next Steps**: Deploy function, integrate into website analyzer workflow
