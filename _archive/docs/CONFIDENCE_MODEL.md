# CONFIDENCE MODEL & SCORING ALGORITHM

**Version**: 1.0  
**Purpose**: Calculate confidence scores for brand profile variables  
**Used By**: Prompt A (Internal Analysis)  

---

## OVERVIEW

The Confidence Model ensures AI-generated brand profiles are **honest about evidence strength** and **transparent about gaps**.

**Key Principles**:
- Start at 0.0, add weights for evidence
- Strong signals = higher confidence
- Missing data = explicit flags
- Never fake confidence

---

## CONFIDENCE SCORE CALCULATION (0.0 - 1.0)

### Base Formula

Start at **0.0**, then add weights based on available evidence sources:

```
Confidence Score = 
  (User Profile Weight × Relevance) +
  (Website Weight × Relevance) +
  (Menu Weight × Relevance) +
  (Analysis Weight × Consistency) +
  (Image Weight × Quality)

Cap at 1.0
```

---

## EVIDENCE SOURCE WEIGHTS

### Tier 1: Internal/Authoritative Data

| Source | Base Weight | Condition | Reasoning |
|--------|-------------|-----------|-----------|
| **User onboarding answer** | +0.40 | Field explicitly filled for this variable | User explicitly stated this |
| **User business profile** | +0.30 | `short_description`, `long_description`, or related field exists | User-edited content |
| **Menu data** | +0.20 | Menu exists with 5+ items | Direct evidence of offerings |

### Tier 2: External/Supporting Data

| Source | Base Weight | Condition | Reasoning |
|--------|-------------|-----------|-----------|
| **Website explicit statement** | +0.30 | Clear positioning/mission on About page | Business self-describes |
| **Website inferred signals** | +0.15 | Tone/patterns detected across pages | Indirect evidence |
| **Social media bio** | +0.10 | Bio text exists (not posts/reviews) | Business self-describes |
| **Image metadata** | +0.10 | 5+ images with descriptions | Visual evidence |

### Consistency Bonuses

| Bonus | Condition |
|-------|-----------|
| +0.10 | Same signal appears in 2+ sources |
| +0.05 | Same signal appears in 3+ sources |

---

## VARIABLE-SPECIFIC WEIGHTS

Each of the 9 variables has different evidence sources that matter most:

### 1. brand_essence

| Source | Weight | Notes |
|--------|--------|-------|
| User profile (`short_description`, `long_description`) | +0.40 | Most authoritative |
| Website About page | +0.30 | Self-stated mission |
| Menu specialties | +0.15 | What they emphasize |
| Consistency bonus | +0.10 | If multiple sources align |

**High confidence threshold**: ≥0.70 (requires user profile + website OR strong consistency)

---

### 2. tone_of_voice

| Source | Weight | Notes |
|--------|--------|-------|
| Website tone analysis | +0.30 | Language patterns detected |
| User profile language style | +0.25 | How they write about themselves |
| Social media bio | +0.15 | Self-stated tone |
| Menu descriptions | +0.10 | Product copy style |
| Consistency bonus | +0.10 | If tone is uniform |

**High confidence threshold**: ≥0.70 (requires multiple text sources)

---

### 3. things_to_avoid

| Source | Weight | Notes |
|--------|--------|-------|
| User onboarding (explicit "don'ts") | +0.50 | Explicitly stated |
| Website red flags | +0.20 | What they explicitly avoid saying |
| Category norms | +0.10 | Industry defaults (allergen warnings, etc.) |

**High confidence threshold**: ≥0.60 (typically LOW unless explicitly stated)

⚠️ **Most likely to be flagged as INSUFFICIENT_DATA**

---

### 4. target_audience

| Source | Weight | Notes |
|--------|--------|-------|
| User onboarding (`target_audience` field) | +0.50 | Explicitly stated |
| Price level + location | +0.20 | Inferred demographic |
| Menu complexity/type | +0.10 | Audience signals |
| Website language level | +0.10 | Who they speak to |

**High confidence threshold**: ≥0.70 (requires explicit user input OR strong convergence)

---

### 5. core_offerings

| Source | Weight | Notes |
|--------|--------|-------|
| Menu data (structured) | +0.50 | Authoritative |
| User profile offerings | +0.30 | Self-stated |
| Website services page | +0.15 | Secondary source |

**High confidence threshold**: ≥0.75 (menu data is usually strong)

⚠️ **Typically HIGH confidence if menu exists**

---

### 6. content_focus

| Source | Weight | Notes |
|--------|--------|-------|
| Website content themes | +0.30 | What they talk about |
| Social media bio | +0.20 | Stated focus |
| Menu categories | +0.15 | Topical structure |
| User profile emphasis | +0.20 | What they highlight |

**High confidence threshold**: ≥0.60 (often MEDIUM)

---

### 7. cta_style

| Source | Weight | Notes |
|--------|--------|-------|
| Website CTA examples | +0.40 | Direct evidence |
| Social media CTAs | +0.20 | Pattern across posts |
| User preference (if stated) | +0.30 | Explicit |

**High confidence threshold**: ≥0.60 (often LOW or MEDIUM)

⚠️ **Commonly flagged as INSUFFICIENT_DATA**

---

### 8. communication_goal

| Source | Weight | Notes |
|--------|--------|-------|
| User onboarding goal | +0.40 | Explicit |
| Website structure (e-commerce vs info) | +0.25 | Inferred from design |
| Business category | +0.15 | Industry defaults |
| CTA frequency | +0.10 | Conversion vs awareness |

**High confidence threshold**: ≥0.60 (often MEDIUM)

---

### 9. image_preferences

| Source | Weight | Notes |
|--------|--------|-------|
| Image metadata (5+ photos) | +0.40 | Visual analysis |
| User-uploaded style | +0.30 | Intentional choices |
| Website visual theme | +0.20 | Design consistency |

**High confidence threshold**: ≥0.60 (often LOW unless many images)

⚠️ **Commonly flagged as INSUFFICIENT_DATA**

---

## CONFIDENCE LEVEL MAPPING

Once score is calculated, map to human-readable level:

| Score Range | Level | Color | UI Icon | Meaning |
|-------------|-------|-------|---------|---------|
| **≥ 0.70** | High | Green | ✅ | Strong evidence, multiple sources, can be trusted |
| **0.40 - 0.69** | Medium | Yellow | ⚠️ | Some evidence, may be inferred, review recommended |
| **< 0.40** | Low | Orange | 🔶 | Weak or missing evidence, user should edit |

---

## INSUFFICIENT_DATA FLAGS

A variable should be flagged in `insufficient_data_flags[]` if:

1. **Score < 0.30** (very low confidence)
2. **AND** no direct evidence exists (only category defaults or guesses)

**Example**:
```json
"confidence": {
  "things_to_avoid": {
    "score": 0.20,
    "level": "low",
    "reason": "No explicit constraints mentioned, only category defaults assumed",
    "sources_used": []
  }
},
"insufficient_data_flags": ["things_to_avoid"]
```

**UI Behavior**:
- Show yellow/orange highlight in Brand Profile page
- Display message: "Vi mangler data her – ret gerne denne beskrivelse"
- Prioritize these fields for user review

---

## CALCULATION EXAMPLES

### Example 1: High Confidence (brand_essence)

**Available Data**:
- User profile `short_description`: "Cozy neighborhood café with organic coffee"
- Website About page: "We're a local café focused on community and quality"
- Menu has "Organic latte" as specialty

**Calculation**:
```
User profile: +0.40 (explicit description)
Website About: +0.30 (self-stated mission)
Menu specialty: +0.15 (supports "organic" claim)
Consistency bonus: +0.10 (3 sources align on "local + quality")
-----
Total: 0.95 → Capped at 1.0
Level: HIGH
```

**Output**:
```json
"confidence": {
  "brand_essence": {
    "score": 0.95,
    "level": "high",
    "reason": "Strong convergence: user profile + website + menu all emphasize local, organic, community",
    "sources_used": ["user_profile", "website_about", "menu_specialties"]
  }
}
```

---

### Example 2: Medium Confidence (target_audience)

**Available Data**:
- Price level: Mid-range (45-65 kr for items)
- Location: København (urban)
- Menu: Avocado toast, organic coffee (health-conscious signals)
- No explicit target audience stated

**Calculation**:
```
User onboarding: +0.00 (not provided)
Price + location: +0.20 (inferred: mid-market urban)
Menu signals: +0.10 (health-conscious items)
Website language: +0.10 (casual, accessible)
-----
Total: 0.40
Level: MEDIUM
```

**Output**:
```json
"confidence": {
  "target_audience": {
    "score": 0.40,
    "level": "medium",
    "reason": "Inferred from price level and menu choices, not explicitly stated",
    "sources_used": ["price_level", "location", "menu_items"]
  }
}
```

---

### Example 3: Low Confidence + INSUFFICIENT_DATA (things_to_avoid)

**Available Data**:
- No explicit constraints mentioned anywhere
- Category defaults: Avoid allergen misinformation (hospitality norm)

**Calculation**:
```
User explicit: +0.00 (not provided)
Website red flags: +0.00 (none detected)
Category norms: +0.10 (generic hospitality defaults)
-----
Total: 0.10
Level: LOW
```

**Output**:
```json
"confidence": {
  "things_to_avoid": {
    "score": 0.10,
    "level": "low",
    "reason": "No explicit constraints provided, only category defaults assumed",
    "sources_used": []
  }
},
"insufficient_data_flags": ["things_to_avoid"]
```

**Prompt B Handling**:
> "Vi mangler specifik information her. Overvej hvad AI aldrig skal sige på vegne af jer – f.eks. overdrivelser, konkurrent-sammenligninger, eller emner der ikke passer til jeres brand."

---

## CONFIDENCE TRENDS & SIGNALS

### Typical HIGH Confidence Variables

Variables that usually score ≥0.70 (if data exists):

- **brand_essence** (user profile + website)
- **tone_of_voice** (multiple text sources)
- **core_offerings** (menu data)

### Typical MEDIUM Confidence Variables

Variables that usually score 0.40-0.69:

- **target_audience** (inferred from multiple signals)
- **content_focus** (website themes)
- **communication_goal** (business model + structure)
- **cta_style** (some website examples)

### Typical LOW Confidence Variables

Variables that often score <0.40:

- **things_to_avoid** (rarely explicitly stated)
- **image_preferences** (requires many images)
- **cta_style** (if no website examples)

---

## DATA QUALITY SUMMARY

Prompt A should include a `data_quality_summary` object:

```json
"data_quality_summary": {
  "overall_confidence": 0.58,
  "strong_signals": ["core_offerings", "tone_of_voice", "brand_essence"],
  "weak_signals": ["image_preferences", "things_to_avoid", "cta_style"],
  "missing_sources": ["social_posts", "customer_testimonials"],
  "recommendations": [
    "More visual content needed for image preferences",
    "Explicit brand guidelines would improve confidence",
    "CTA analysis needs more post examples"
  ]
}
```

**Overall Confidence** = Average of all 9 variable scores

---

## UI INTEGRATION

### Display Confidence in Brand Profile Page

```tsx
// BrandProfilePage_NEW.tsx

const getConfidenceBadge = (confidence: string) => {
  switch (confidence) {
    case 'high':
      return <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">✅ Høj tillid</span>
    case 'medium':
      return <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">⚠️ Gennemgå</span>
    case 'low':
      return <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">🔶 Ret gerne</span>
    default:
      return null
  }
}

// In each variable card:
<div className="flex items-center gap-2">
  <h3>Brand Essence</h3>
  {getConfidenceBadge(metadata?.confidence?.brand_essence?.level)}
</div>
```

---

## VALIDATION RULES

Before finalizing confidence scores, verify:

- [ ] All scores are between 0.0 and 1.0
- [ ] Level mapping is correct (high/medium/low)
- [ ] `sources_used` array lists actual evidence sources
- [ ] `reason` explains WHY the score is what it is
- [ ] Variables with score <0.30 are in `insufficient_data_flags`
- [ ] No "fake" high confidence (must have real evidence)

---

## DEBUGGING CONFIDENCE ISSUES

### Problem: Everything is HIGH confidence (suspicious)

**Check**:
- Are you inventing evidence?
- Are you using Tier 3 data (reviews, ratings)?
- Are you giving credit for "category defaults" as real signals?

**Fix**: Be more conservative. Require actual evidence from Tier 1 or Tier 2 sources.

---

### Problem: Everything is LOW confidence (too conservative)

**Check**:
- Are you ignoring valid user profile data?
- Are you requiring perfect data when inference is reasonable?
- Are you penalizing for missing sources that don't matter for this variable?

**Fix**: Trust strong signals when they exist. Medium confidence is okay for inferred variables.

---

### Problem: Inconsistent confidence across similar variables

**Check**:
- Are you applying weights consistently?
- Are some variables using different evidence than expected?

**Fix**: Use variable-specific weight tables above. Document deviations.

---

## ANTI-PATTERNS

### ❌ Fake High Confidence
```json
"confidence": {
  "image_preferences": {
    "score": 0.85,
    "level": "high",
    "reason": "They probably like bright photos",
    "sources_used": []
  }
}
```

**Problem**: No actual evidence, just guessing

---

### ❌ Ignoring User Input
```json
"confidence": {
  "brand_essence": {
    "score": 0.30,
    "level": "low",
    "reason": "Not enough data",
    "sources_used": []
  }
}
```

**Problem**: User provided `short_description` = "Cozy café with organic coffee"  
Should be HIGH confidence (+0.40 for user profile)

---

### ❌ Over-Rewarding Category Defaults
```json
"confidence": {
  "things_to_avoid": {
    "score": 0.70,
    "level": "high",
    "reason": "Hospitality businesses should avoid allergen misinformation",
    "sources_used": ["category_defaults"]
  }
}
```

**Problem**: This is a generic rule, not business-specific evidence  
Should be LOW confidence (<0.40)

---

## CODE IMPLEMENTATION

```typescript
// supabase/functions/brand-profile-generator/index.ts

interface ConfidenceScore {
  score: number
  level: 'high' | 'medium' | 'low'
  reason: string
  sources_used: string[]
}

function calculateConfidence(
  variable: string,
  dataSources: DataSources
): ConfidenceScore {
  let score = 0.0
  const sources: string[] = []

  // Variable-specific weights
  switch (variable) {
    case 'brand_essence':
      if (dataSources.userProfile?.short_description) {
        score += 0.40
        sources.push('user_profile')
      }
      if (dataSources.website?.aboutPage) {
        score += 0.30
        sources.push('website_about')
      }
      if (dataSources.menu?.specialties) {
        score += 0.15
        sources.push('menu_specialties')
      }
      if (sources.length >= 2) {
        score += 0.10 // Consistency bonus
      }
      break

    case 'tone_of_voice':
      if (dataSources.website?.toneAnalysis) {
        score += 0.30
        sources.push('website_tone')
      }
      if (dataSources.userProfile?.languageStyle) {
        score += 0.25
        sources.push('user_profile')
      }
      if (dataSources.socialMedia?.bio) {
        score += 0.15
        sources.push('social_bio')
      }
      if (dataSources.menu?.descriptions) {
        score += 0.10
        sources.push('menu_copy')
      }
      if (sources.length >= 2) {
        score += 0.10
      }
      break

    // ... (other variables)
  }

  // Cap at 1.0
  score = Math.min(score, 1.0)

  // Map to level
  let level: 'high' | 'medium' | 'low'
  if (score >= 0.70) level = 'high'
  else if (score >= 0.40) level = 'medium'
  else level = 'low'

  // Generate reason
  const reason = generateReason(variable, score, sources)

  return { score, level, reason, sources_used: sources }
}

function generateReason(
  variable: string,
  score: number,
  sources: string[]
): string {
  if (score >= 0.70) {
    return `Strong evidence from ${sources.length} sources: ${sources.join(', ')}`
  } else if (score >= 0.40) {
    return `Moderate evidence, inferred from ${sources.join(', ')}`
  } else if (sources.length === 0) {
    return `No specific evidence available, only category defaults`
  } else {
    return `Limited evidence from ${sources.join(', ')}, confidence is low`
  }
}
```

---

**Status**: Production-ready ✅  
**Next**: Use this model in Prompt A to calculate confidence for all 9 variables
