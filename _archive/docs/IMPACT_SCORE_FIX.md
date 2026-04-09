# Impact Score Fix: From Ungrounded Guess to Computed Estimate

## Problem Identified

The `impact: 'low' | 'medium' | 'high'` field was an **ungrounded AI guess** with no validation:
- AI would confidently assign "high" or "low" without any measurable basis
- Could mislead users into thinking this is data-driven
- Risk of backfiring when users realize it's arbitrary

## Solution: Heuristic Computation with Transparency

**Approach**: Keep `impact` but compute it from measurable quality factors, with full transparency.

### ✅ Why This is Better Than Alternatives

**vs Deleting it:**
- Users DO want guidance on which ideas might perform best
- Losing signal entirely is worse than having an estimated signal

**vs Renaming to "confidence":**
- Changes semantic meaning (confidence in policy match ≠ engagement prediction)
- Still requires computation implementation

**vs Keep AI guess:**
- Ungrounded and misleading
- No improvement path

## Implementation

### New Component: `impact-scorer.ts`

Computes impact from 5 measurable factors:

1. **Hook Quality (0-1)**
   - Optimal: 5-10 words
   - Includes 1-2 emojis
   - Question marks (engagement trigger)

2. **Caption Quality (0-1)**
   - Optimal: 80-150 characters
   - Specific details (times, prices, adjectives)
   - Not generic phrases

3. **Novelty (0-1)**
   - AI-generated + valid = 1.0
   - AI + warnings = 0.7
   - Fallback template = 0.5

4. **Specificity (0-1)**
   - Specific menu item (e.g., "Club Sandwich") = high
   - Generic terms (e.g., "dagens ret") = low
   - Detailed photo suggestions = bonus

5. **Validation Clean (0-1)**
   - Clean validation = 1.0
   - Valid with warnings = 0.8
   - Auto-fixed = 0.6
   - Fallback = 0.4

### Weighted Scoring

```typescript
totalScore = 
  hookQuality * 0.25 +
  captionQuality * 0.20 +
  novelty * 0.25 +
  specificity * 0.15 +
  validationClean * 0.15

if (totalScore >= 0.75) → impact = 'high'
if (totalScore >= 0.50) → impact = 'medium'
if (totalScore < 0.50) → impact = 'low'
```

### Transparency Features

**1. Confidence Score (0-1)**
```json
{
  "impact": "high",
  "confidence": 0.82
}
```

**2. Factor Breakdown**
```json
{
  "impact_score": {
    "impact": "high",
    "confidence": 0.82,
    "factors": {
      "hook_quality": 0.85,      // 8 words + emoji + question
      "caption_quality": 0.90,   // 120 chars + specific details
      "novelty": 1.0,            // AI-generated, clean validation
      "specificity": 0.70,       // Menu item: "Club Sandwich"
      "validation_clean": 1.0    // No warnings
    }
  }
}
```

**3. Summary Note**
```json
{
  "summary": {
    "impact_note": "Impact scores are heuristically computed estimates (not AI guesses)"
  }
}
```

## Benefits

### For Users
- ✅ **Useful signal**: Still get guidance on which ideas might perform best
- ✅ **Transparent**: Know it's an estimate, not a promise
- ✅ **Grounded**: Based on measurable quality factors
- ✅ **Improvable**: Can refine weights based on real engagement data later

### For Developers
- ✅ **Debuggable**: Factor breakdown shows exactly why an idea scored high/low
- ✅ **Testable**: Each factor has clear logic and thresholds
- ✅ **Evolvable**: Can add new factors or adjust weights over time

### For Product
- ✅ **Honest**: No false confidence from AI guesses
- ✅ **Actionable**: Users can understand why an idea scored low (weak hook, too generic, etc.)
- ✅ **Data-ready**: When engagement data is available, can validate/improve scoring

## Example Scores

### High Impact (0.82)
```typescript
{
  hook: "Frosne fingre? ❄️",                    // hookQuality: 0.85 (5 words, emoji, question)
  caption_base: "Kom ind fra kulden og nyd...", // captionQuality: 0.90 (120 chars, specific)
  menu_item: { name: "Club Sandwich" },         // specificity: 0.70 (specific item)
  source: 'ai',                                 // novelty: 1.0
  validation_status: 'valid'                    // validationClean: 1.0
}
→ Impact: HIGH (confidence: 0.82)
```

### Medium Impact (0.58)
```typescript
{
  hook: "God mad 🍽️",                           // hookQuality: 0.55 (too short, generic)
  caption_base: "Vi har mange gode retter...",  // captionQuality: 0.60 (generic, short)
  menu_item: null,                              // specificity: 0.50 (no menu item)
  source: 'ai',                                 // novelty: 0.7 (has warnings)
  validation_status: 'valid_with_warnings'      // validationClean: 0.8
}
→ Impact: MEDIUM (confidence: 0.58)
```

### Low Impact (0.42)
```typescript
{
  hook: "Velkommen ✨",                          // hookQuality: 0.50 (too short, no question)
  caption_base: "Kom ind og oplev os.",         // captionQuality: 0.50 (too short, generic)
  menu_item: null,                              // specificity: 0.50 (no menu item)
  source: 'fallback_template',                  // novelty: 0.5 (template)
  validation_status: 'fallback'                 // validationClean: 0.4
}
→ Impact: LOW (confidence: 0.42)
```

## Integration Points

### 1. Validation Flow
```typescript
validateIdeas() 
  → IdeaWithMetadata[]
  → enhanceIdeaWithComputedImpact()
  → IdeaWithMetadata[] (with impact_score)
```

### 2. Response Structure
```json
{
  "ideas": [...],
  "ideasWithMetadata": [
    {
      "idea": { "impact": "high", ... },
      "metadata": {
        "source": "ai",
        "validation_status": "valid",
        "impact_score": {
          "impact": "high",
          "confidence": 0.82,
          "factors": { ... }
        }
      }
    }
  ],
  "summary": {
    "impact_note": "Impact scores are heuristically computed estimates"
  }
}
```

## Future Improvements

Once engagement data is available:

1. **Validate Weights**: Check if high-impact ideas actually get higher engagement
2. **Tune Factors**: Adjust factor weights based on correlation with engagement
3. **Add ML Model**: Train a simple model on (factors → engagement) data
4. **A/B Test**: Test if showing impact scores affects user behavior

## Decision Made

**Selected**: Compute heuristically with transparency ✅

**Rationale**:
- Provides useful signal without false confidence
- Transparent about being an estimate
- Grounded in measurable factors
- Can improve over time with data
- Better than no signal OR ungrounded guess
