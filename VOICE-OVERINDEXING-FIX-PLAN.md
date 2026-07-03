# Voice Over-Indexing Fix Plan
**Issue**: Seasonal physical features (waterfront) dominate brand profile, making voice unusable 7 months/year
**Root Cause**: business_character emphasizes physical features → Prompt B amplifies single distinctive feature
**Goal**: Balance physical, temporal, and operational features without hardcoded examples

---

## Problem Analysis

### Current Cascade Effect:
```
business_character: "Café, restaurant og bar med stor udendørs terrasse ved åen..."
↓
brand_essence: "...ved åen i Aarhus..."
↓
brand_essence_elaboration: "beliggenheden ved åen..."
↓
content_strategy.brand_anchors: ["Unikke oplevelser ved åen"]
↓
tone_of_voice: "Inddrag åen som aktiv del af fortællingen"
```

**Result**: "ved åen" appears in 5/10 fields → Voice only works May-September

### Core Identity Should Be:
**Multi-programme venue** (morning café → lunch → dinner → late cocktails) **with** seasonal waterfront seating

---

## Solution Architecture

### Phase 1: Feature Prioritization System (No Hardcoding)

**File**: `supabase/functions/_shared/brand-profile/repair/fallback-builders.ts`

**Changes to `buildBusinessCharacterFallback()`**:

1. **Feature Scoring System**:
   ```typescript
   interface FeatureScore {
     category: 'operational' | 'temporal' | 'physical'
     text: string
     distinctiveness: number  // 1-10
     seasonal: boolean
   }
   ```

2. **Distinctiveness Rules** (systematic, not hardcoded):
   - Multi-programme transitions: 9/10 (rare - only ~15% of venues)
   - Late-night service (past 23:00): 8/10 (distinctive in restaurant context)
   - Hybrid roles (3+ programmes): 8/10 (distinctive)
   - Outdoor seating: 4/10 (common - ~60% of venues in DK)
   - Waterfront location: 6/10 (distinctive but seasonal)
   - Transit hub: 5/10 (common)

3. **Reorder Output Priority**:
   ```
   CURRENT: VenueType + Physical + Temporal
   FIXED:   VenueType + Temporal + Physical(conditional)
   ```

4. **Seasonal Context Modifier**:
   ```typescript
   const isSeasonalFeature = (feature: string) => 
     /terrasse|udendørs|outdoor|waterfront|åen|ved vandet/i.test(feature)
   
   const shouldMentionInCore = (feature: FeatureScore) => {
     if (!feature.seasonal) return true
     if (feature.distinctiveness < 7) return false  // Don't lead with low-value seasonal
     return feature.distinctiveness >= 8  // Only mention highly distinctive seasonal features
   }
   ```

**Result**: 
- High-value temporal features mentioned first
- Seasonal physical features downweighted or moved to subordinate clause
- Output: "Café, restaurant og bar der serverer fra morgenkaffe til sen-aften cocktails, med terrasse ved åen."

---

### Phase 2: Prompt B Diversity Instructions (No Examples)

**File**: `supabase/functions/_shared/brand-profile/prompts/prompt-b.ts`

**Add instruction block** (around line 150-180 where core instructions are):

```typescript
## DIVERSITETSKONTROL (Feature Distribution)

For at undgå overrepræsentation af enkelte features:

1. **Feature-balance**:
   - Operational features (åbningstider, programmer, service-transitions): Prioriter i tone-regler
   - Physical features (lokation, indretning, udsigt): Nævn selektivt, ikke i alle felter
   - Temporal features (dag-til-nat, sæsonvariationer): Prioriter hvis multi-program
   
2. **Keyword-distribution**:
   - Hvis et nøgleord (fx 'terrasse', 'åen', 'udsigt') optræder i business_character
   - Må det IKKE gentages i mere end 2 af følgende: brand_essence, tone_of_voice, content_strategy
   - Erstat med OPERATIONAL beskrivelser (tidspunkter, programmer, transitions)

3. **Sæsonkontekst (Danmark)**:
   - Outdoor features (terrasse, udsigt, vandfront) er kun relevante maj-september
   - Hvis venue har multi-program karakter (morgen-til-nat), prioriter dette i stemme-regler
   - Physical features bruges som KONTEKST, ikke hovedidentitet

4. **Distintivitets-hierarki**:
   - Sjældne features først: Multi-program transitions, sen-nat service, hybrid roles
   - Almindelige features sidst: Outdoor seating, central location
   - Test: Ville denne feature være unik i en by med 500 caféer?

**VALIDERINGSREGEL**: 
Scan alle genererede felter. Hvis SAMME feature-ord (≥4 chars) optræder i >40% af felter → reducer til max 30%.
```

**Key Principles**:
- NO hardcoded seasonal dates
- NO specific business examples  
- YES systematic rules based on distinctiveness
- YES context-aware weighting

---

### Phase 3: Post-Generation Diversity Validator

**File**: `supabase/functions/_shared/brand-profile/validators.ts`

**Add new function** (after existing validators):

```typescript
/**
 * Check for feature over-representation across brand profile fields
 * Returns warnings when single feature appears in too many fields
 */
export function validateFeatureDiversity(brandProfile: any): string[] {
  const warnings: string[] = []
  
  // Extract text from all major fields
  const fields = [
    brandProfile.business_character,
    brandProfile.brand_essence?.value,
    brandProfile.brand_essence_elaboration?.value,
    brandProfile.tone_of_voice?.value,
    JSON.stringify(brandProfile.content_strategy),
    JSON.stringify(brandProfile.voice_examples),
  ].filter(Boolean)
  
  const totalFields = fields.length
  
  // Define keywords to track (systematic patterns, not hardcoded list)
  const extractKeywords = (text: string): string[] => {
    // Match significant noun phrases (≥4 chars, not common words)
    const matches = text.match(/\b[\wæøå]{4,}\b/gi) || []
    const commonWords = new Set(['café', 'restaurant', 'bar', 'sted', 'stedet', 'deres', 'vores', 'ikke', 'også', 'være', 'eller', 'have'])
    return matches
      .map(w => w.toLowerCase())
      .filter(w => !commonWords.has(w))
  }
  
  // Count keyword occurrences across fields
  const keywordCounts = new Map<string, number>()
  
  fields.forEach(field => {
    const keywords = extractKeywords(field)
    const uniqueKeywords = new Set(keywords)  // Count once per field
    uniqueKeywords.forEach(kw => {
      keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1)
    })
  })
  
  // Flag keywords appearing in >40% of fields
  const threshold = totalFields * 0.4
  
  keywordCounts.forEach((count, keyword) => {
    const percentage = Math.round((count / totalFields) * 100)
    if (count > threshold) {
      warnings.push(
        `⚠️ Feature over-representation: "${keyword}" appears in ${count}/${totalFields} fields (${percentage}%) — should be <40%`
      )
    }
  })
  
  // Check for seasonal feature dominance
  const seasonalKeywords = ['terrasse', 'udendørs', 'outdoor', 'åen', 'waterfront', 'udsigt']
  let seasonalMentions = 0
  
  fields.forEach(field => {
    if (seasonalKeywords.some(kw => new RegExp(kw, 'i').test(field))) {
      seasonalMentions++
    }
  })
  
  if (seasonalMentions > totalFields * 0.3) {
    warnings.push(
      `⚠️ Seasonal feature over-emphasis: Outdoor/waterfront features in ${seasonalMentions}/${totalFields} fields — may reduce year-round relevance`
    )
  }
  
  return warnings
}
```

**Integration Point**: Call in `validateFinalBrandProfile()` (existing function around line 1035)

---

### Phase 4: business_character Rewrite Logic

**File**: `supabase/functions/_shared/brand-profile/repair/fallback-builders.ts`

**Modify `buildBusinessCharacterFallback()` structure**:

```typescript
export function buildBusinessCharacterFallback(...): string {
  // ... existing role detection ...
  
  // NEW: Collect features with scores
  const features: FeatureScore[] = []
  
  // Temporal features (HIGH priority for multi-programme venues)
  if (earlyMorning && lateNight && programmes.length >= 2) {
    const dayProg = programmes.find(p => /brunch|frokost|morgen/i.test(p.role))?.role || 'morgenmad'
    const nightProg = programmes.find(p => /aften|cocktail|drink/i.test(p.role))?.role || 'drinks'
    features.push({
      category: 'temporal',
      text: `der serverer ${dayProg} om dagen og skifter til ${nightProg} om aftenen`,
      distinctiveness: 9,
      seasonal: false
    })
  }
  
  // Physical features (LOWER priority, conditional on distinctiveness)
  const areaType = location?.enrichment?.micro?.area_type
  if (areaType === 'waterfront') {
    features.push({
      category: 'physical',
      text: 'ved åen',
      distinctiveness: 6,
      seasonal: true
    })
  }
  
  const hasOutdoor = (dataSources as any)?.operationalFeatures?.has_outdoor_seating
  if (hasOutdoor) {
    features.push({
      category: 'physical',
      text: 'med udendørs servering',
      distinctiveness: 4,
      seasonal: true
    })
  }
  
  // Sort by: distinctiveness desc, seasonal last
  features.sort((a, b) => {
    if (a.seasonal !== b.seasonal) return a.seasonal ? 1 : -1
    return b.distinctiveness - a.distinctiveness
  })
  
  // Include only top 2 features, skip low-value seasonal
  const includedFeatures = features
    .filter(f => !f.seasonal || f.distinctiveness >= 7)
    .slice(0, 2)
  
  const featurePart = includedFeatures.length > 0 
    ? ', ' + includedFeatures.map(f => f.text).join(', ')
    : ''
  
  return `${venuePhrase.charAt(0).toUpperCase() + venuePhrase.slice(1)}${featurePart}.`
}
```

**Result Examples**:
- Multi-programme + waterfront: "Café, restaurant og bar, der serverer brunch om dagen og skifter til cocktails om aftenen."
  (Waterfront omitted - low distinctiveness + seasonal)
  
- Multi-programme + unique location: "Café, restaurant og bar, der serverer fra morgenkaffe til sen-aften drinks, ved åen."
  (Included - temporal first, location as context)
  
- Single programme + waterfront: "Café med terrasse ved åen."
  (Included - physical feature IS distinctive when no temporal variety)

---

## Implementation Steps

### Step 1: Add Feature Scoring Types
- [ ] Define `FeatureScore` interface in `types.ts`
- [ ] Add `distinctivenessRules` config object (not hardcoded in logic)

### Step 2: Refactor business_character Fallback
- [ ] Implement feature collection with scoring
- [ ] Add sorting by distinctiveness + seasonal flag
- [ ] Add seasonal context filter
- [ ] Test with Café Faust (expect temporal-first output)

### Step 3: Add Prompt B Diversity Instructions
- [ ] Insert diversity control block in prompt-b.ts
- [ ] Add keyword distribution rule
- [ ] Add seasonal context rule
- [ ] Test regeneration (expect reduced "ved åen" repetition)

### Step 4: Add Post-Generation Validator
- [ ] Implement `validateFeatureDiversity()` in validators.ts
- [ ] Integrate into `validateFinalBrandProfile()`
- [ ] Add to soft error reporting
- [ ] Test with Café Faust (expect warnings on >40% keyword usage)

### Step 5: Deploy & Test
- [ ] Deploy updated function
- [ ] Regenerate Café Faust profile
- [ ] Verify: business_character leads with temporal features
- [ ] Verify: "ved åen" appears in ≤2 fields (down from 5)
- [ ] Verify: voice usable year-round

---

## Success Metrics

**Before**:
- "ved åen" in 5/10 fields (50%)
- Temporal transitions not mentioned in voice rules
- Voice only relevant May-September

**After**:
- Feature repetition <30% across fields
- Temporal transitions mentioned in tone_of_voice
- Voice relevant year-round
- High-distinctiveness features prioritized

---

## Non-Goals (What We're NOT Doing)

❌ Hardcode seasonal date ranges (May-September)
❌ Add specific business examples to prompts
❌ Create blacklist of banned words
❌ Add location-specific rules ("if Denmark then...")
❌ Increase prompt size significantly

✅ Use systematic distinctiveness scoring
✅ Add structural diversity rules
✅ Validate output programmatically
✅ Make fallback logic feature-aware

---

## File Changes Summary

1. **types.ts**: Add `FeatureScore` interface (~5 lines)
2. **fallback-builders.ts**: Refactor `buildBusinessCharacterFallback()` (~60 lines)
3. **prompt-b.ts**: Add diversity instruction block (~25 lines)
4. **validators.ts**: Add `validateFeatureDiversity()` (~50 lines)

**Total**: ~140 lines of systematic logic, 0 hardcoded examples
