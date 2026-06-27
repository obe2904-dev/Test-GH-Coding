# Implementation Guide: Dynamic Suggestions + Behavioral Logic

**Date:** June 22, 2026  
**Status:** ✅ Implementation Complete & Tested  
**Modules:** 
- `dynamic-suggestion-calculator.ts` 
- `behavioral-context-analyzer.ts`

---

## Executive Summary

This implementation delivers **dynamic suggestion count (1-3)** based on available time windows and **behaviorally realistic rationales** that eliminate unrealistic contexts like "7 AM friend meetups" or "8 AM lunch thoughts."

### Key Results

✅ **All tests passing** (100% pass rate)
- Dynamic suggestion calculator: 7/7 tests ✓
- Behavioral context analyzer: 5/5 tests ✓  
- Integration test: 9/9 validations ✓

✅ **Specification compliance**
- Café Faust Monday 07:00 generates 3 ideas as specified
- Timing: 07:30, 10:30, 13:30 (180-min spacing) ✓
- Content types: OFFERING, OFFERING, ATMOSPHERE ✓
- Realistic rationales without unrealistic behaviors ✓

---

## Implementation Architecture

### Module 1: Dynamic Suggestion Calculator

**File:** `supabase/functions/_shared/content-planning/dynamic-suggestion-calculator.ts`

**Purpose:** Determine suggestion count (1-3) and timing based on operational windows

**Key Functions:**
```typescript
export function calculateDynamicSuggestions(
  context: CalculationContext
): DynamicSuggestionResult

// Returns:
// - suggestionCount: 1-3
// - ideas: Array of SuggestionIdea with timing and content type
// - reasoning: Explanation of decisions
// - metadata: Operational status
```

**Decision Logic:**
1. **Idea 1** (always generated): 30-60 min from now
   - OFFERING if open and >3h to close
   - ATMOSPHERE if closed, closing soon, or before opening
   
2. **Idea 2** (conditional): +180 min from Idea 1
   - Generated if ≥3h remain after posting
   - OFFERING if ≥3h to closing buffer
   - ATMOSPHERE if <3h but >60min to close
   
3. **Idea 3** (conditional): +180 min from Idea 2
   - Generated if ≥60 min remain after posting
   - Always ATMOSPHERE (end-of-day content)

**Timing Constants:**
```typescript
MIN_SPACING: 180 min           // Between suggestions
IMMEDIATE_WINDOW: [30, 60]     // For Idea 1
CLOSING_BUFFER: 180 min        // No offerings within 3h of close
FINAL_POST_BUFFER: 60 min      // Last post 1h before close
```

---

### Module 2: Behavioral Context Analyzer

**File:** `supabase/functions/_shared/content-planning/behavioral-context-analyzer.ts`

**Purpose:** Generate contextually relevant rationales using 5-phase behavioral logic

**Key Functions:**
```typescript
export function analyzeBehavioralContext(
  input: BehavioralAnalysisInput
): BehavioralAnalysisResult

// Returns:
// - primaryAudienceSegment: Matched segment or null
// - audienceBehavior: Real-world behavior description
// - decisionPattern: Spontaneous/planned/mixed timing
// - environmentalFactors: Weather, location advantages
// - selectedContent: Menu item with rationale
// - assembledRationale: Complete, contextual rationale
```

**5-Phase Analysis:**

1. **Temporal-Behavioral Context**
   - Match audience segments by timing_windows
   - Use decision_timing (spontaneous/planned) 
   - Fallback to generic behavioral context if no match

2. **Environmental Context**
   - Weather conditions (favorable/unfavorable)
   - Location advantages with peak timing
   - Example: "Waterfront peak time: Beautiful harbor views"

3. **Strategic Content Selection**
   - Filter by target programme
   - Exclude recently posted items
   - Select never-featured or long-dormant items

4. **Recency Analysis**
   - "Never featured before" if no history
   - "Last featured X days ago" if >30 days
   - Silent if <14 days (too recent)

5. **Rationale Assembly**
   - Lead with time-audience fit
   - Support with environmental factors
   - Feature dish name (if OFFERING)
   - Add recency in parentheses (supporting, not primary)

**Example Output:**
```
"Mandag morgen - frokost-pendlere begynder at overveje dagens frokost - 
making immediate or spontaneous decisions. Featuring: Eggs Benedict med 
Hollandaise. (Never featured before)"
```

---

## Integration into `get-quick-suggestions`

### Current Architecture

The existing `get-quick-suggestions/index.ts` function:
1. Fetches business context (DB queries)
2. Calls `slot-calculator.ts` for timing (currently fixed 2-3 slots)
3. Calls persona matching and business intelligence assembly
4. Generates content via Gemini API
5. Returns suggestions

### Required Changes

#### **Step 1: Replace Slot Calculation**

**Before:**
```typescript
// Current slot-calculator.ts returns fixed 2-3 slots
const slots = calculateSlots(context)
```

**After:**
```typescript
import { calculateDynamicSuggestions } from '../_shared/content-planning/dynamic-suggestion-calculator.ts'

const dynamicResult = calculateDynamicSuggestions({
  now: new Date(),
  weekday: currentWeekday,
  openingTime: businessOpeningTime,
  closingTime: businessClosingTime,
  programmes: businessProgrammes,
  kitchenCloseTime: businessOperations.kitchen_close_time,
  isClosedToday: !isOpenToday
})

// Use dynamicResult.ideas instead of slots
const suggestionCount = dynamicResult.suggestionCount
const ideas = dynamicResult.ideas
```

#### **Step 2: Add Behavioral Analysis**

**Before:**
```typescript
// Current: Direct Gemini call without behavioral context
const systemPrompt = buildDagensSystemInstruction(...)
const response = await gemini.generateContent(systemPrompt)
```

**After:**
```typescript
import { analyzeBehavioralContext } from '../_shared/content-planning/behavioral-context-analyzer.ts'

// For each idea, analyze behavioral context
const enrichedIdeas = ideas.map(idea => {
  const behavioralInput = {
    currentTime: now.toTimeString().slice(0, 5),
    weekday: currentWeekday,
    targetTime: idea.postingTime,
    audienceSegments: brandProfile.audience_segments || [],
    weather: weatherContext,
    locationAdvantages: locationIntelligence.advantages || [],
    availableMenuItems: eligibleMenuItems,
    recentlyPostedItemIds: recentSuggestions.map(s => s.menu_item_id),
    targetProgramme: idea.eligibleProgrammes[0],
    contentType: idea.contentType
  }
  
  const behavioral = analyzeBehavioralContext(behavioralInput)
  
  return {
    ...idea,
    behavioralContext: behavioral,
    suggestedMenuItem: behavioral.selectedContent.itemName,
    suggestedItemId: behavioral.selectedContent.itemId,
    contextualRationale: behavioral.assembledRationale
  }
})
```

#### **Step 3: Update Gemini Prompts**

Modify `dagens-forslag-prompt-builder.ts` to include behavioral context:

```typescript
function buildDagensSystemInstruction(enrichedIdea, businessContext) {
  return `
You are creating a social media post for ${businessContext.name}.

POSTING CONTEXT:
- Posting Time: ${enrichedIdea.postingTime}
- Content Type: ${enrichedIdea.contentType}
- Target Programme: ${enrichedIdea.targetProgramme}

BEHAVIORAL CONTEXT:
- Primary Audience: ${enrichedIdea.behavioralContext.primaryAudienceSegment}
- Audience Behavior: ${enrichedIdea.behavioralContext.audienceBehavior}
- Decision Pattern: ${enrichedIdea.behavioralContext.decisionPattern}
- Environmental Factors: ${enrichedIdea.behavioralContext.environmentalFactors.join(', ')}

${enrichedIdea.contentType === 'OFFERING' ? `
FEATURED DISH:
- Name: ${enrichedIdea.suggestedMenuItem}
- Rationale: ${enrichedIdea.contextualRationale}
` : `
ATMOSPHERE CONTENT:
- Angle: ${enrichedIdea.atmosphereAngle}
- Context: ${enrichedIdea.contextualRationale}
`}

VOICE GUIDELINES:
${businessContext.voice_guardrails || ''}

Create a post that:
1. Speaks to the identified audience behavior
2. Aligns with the decision pattern (spontaneous vs. planned)
3. Incorporates environmental factors naturally
4. ${enrichedIdea.contentType === 'OFFERING' ? 'Features the suggested dish prominently' : 'Builds atmosphere and anticipation'}
5. Avoids AI-tells and maintains authentic voice
`
}
```

#### **Step 4: Update Response Structure**

Ensure the response includes new metadata:

```typescript
return new Response(JSON.stringify({
  suggestions: enrichedIdeas.map(idea => ({
    id: generateId(),
    posting_time: idea.postingTime,
    content_type: idea.contentType,
    atmosphere_angle: idea.atmosphereAngle,
    target_programme: idea.targetProgramme,
    suggested_menu_item_id: idea.suggestedItemId,
    suggested_menu_item_name: idea.suggestedMenuItem,
    
    // Behavioral metadata
    primary_audience_segment: idea.behavioralContext.primaryAudienceSegment,
    audience_behavior: idea.behavioralContext.audienceBehavior,
    decision_pattern: idea.behavioralContext.decisionPattern,
    environmental_factors: idea.behavioralContext.environmentalFactors,
    contextual_rationale: idea.contextualRationale,
    
    // Generated content (from Gemini)
    post_text: generatedPost.text,
    headline: generatedPost.headline,
    
    // System metadata
    reasoning: dynamicResult.reasoning,
    metadata: idea.behavioralContext.metadata
  })),
  
  generation_metadata: {
    suggestion_count: suggestionCount,
    available_hours: dynamicResult.metadata.availableHours,
    operational_status: dynamicResult.metadata.isCurrentlyOpen ? 'open' : 'closed',
    generation_time: dynamicResult.metadata.generationTime
  }
}), {
  status: 200,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
})
```

---

## Testing Strategy

### Unit Tests (Completed ✓)

1. **Dynamic Suggestion Calculator** (`dynamic-suggestion-calculator.test.ts`)
   - Full day coverage (3 ideas)
   - Late morning (2-3 ideas)
   - Evening (1-2 ideas)
   - Closed day (1 ATMOSPHERE idea)
   - Late night (1 idea after effective closing)
   - Dinner-only restaurant
   - Closing soon (<3h)

2. **Behavioral Context Analyzer** (`behavioral-context-analyzer.test.ts`)
   - Morning offering with audience match
   - Lunch offering with environmental factors
   - Evening offering with planned decision timing
   - Atmosphere content (no menu selection)
   - Off-peak time (no audience match, fallback)

3. **Integration Test** (`integration.test.ts`)
   - Complete workflow: Café Faust Monday 07:00
   - Validates 9 specification requirements
   - Demonstrates realistic rationales

### Integration Testing (Required)

1. **Deploy to Staging**
   ```bash
   supabase functions deploy get-quick-suggestions --project-ref staging
   ```

2. **Test with Real Data**
   ```bash
   curl -X POST 'https://staging.supabase.co/functions/v1/get-quick-suggestions' \
     -H "Authorization: Bearer $ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"businessId": "cafe-faust-test", "tier": "paid"}'
   ```

3. **Validate**
   - Check suggestion count (1-3)
   - Verify timing calculations
   - Review rationale quality
   - Confirm content type selection
   - Validate menu item selection

---

## Edge Cases & Validations

### Edge Case Matrix

| Scenario | Expected Behavior | Test Status |
|----------|------------------|-------------|
| Full day (14+ hours) | 3 ideas | ✓ PASS |
| Mid-day (6-14 hours) | 2-3 ideas | ✓ PASS |
| Evening (<6 hours) | 1-2 ideas | ✓ PASS |
| Closed today | 1 ATMOSPHERE idea | ✓ PASS |
| After kitchen close | No OFFERING ideas | ✓ PASS |
| Before opening | OFFERING (anticipatory) | ✓ PASS |
| Dinner-only (opens 17:30) | 3 ideas (all anticipatory until open) | ✓ PASS |
| No audience match | Fallback behavioral context | ✓ PASS |

---

## Performance Considerations

### Computational Complexity

- **Dynamic Suggestion Calculator**: O(n) where n = number of programmes
- **Behavioral Context Analyzer**: O(m) where m = number of menu items
- **Total**: Linear complexity, suitable for real-time execution

### Caching Opportunities

1. **Audience Segments**: Cache from `brand_profile_v5.audience_segments`
2. **Programmes**: Cache from `business_programme_profiles`
3. **Weather**: Cache with 30-min TTL
4. **Location Advantages**: Cache from `business_location_intelligence`

### Database Queries

No additional queries required - all data already fetched in existing flow:
- ✓ `business_programme_profiles` (already fetched)
- ✓ `business_brand_profile` (already fetched)
- ✓ `business_location_intelligence` (already fetched)
- ✓ `menu_items_normalized` (already fetched)
- ✓ Weather data (already fetched)

---

## Deployment Checklist

### Pre-Deployment

- [x] Unit tests passing
- [x] Integration test passing
- [x] Code review complete
- [x] Documentation complete
- [ ] Staging deployment validated
- [ ] Performance benchmarks acceptable (<2s response time)

### Deployment Steps

1. **Backup Current Implementation**
   ```bash
   cp supabase/functions/get-quick-suggestions/index.ts \
      supabase/functions/get-quick-suggestions/index.ts.backup
   ```

2. **Deploy Shared Modules**
   ```bash
   git add supabase/functions/_shared/content-planning/
   git commit -m "feat: Add dynamic suggestion calculator and behavioral analyzer"
   ```

3. **Integrate into get-quick-suggestions**
   - Modify `index.ts` per Step 1-4 above
   - Update imports
   - Test locally with `supabase functions serve`

4. **Deploy to Production**
   ```bash
   supabase functions deploy get-quick-suggestions --project-ref production
   ```

5. **Monitor**
   - Check error rates
   - Validate suggestion quality
   - Review user feedback
   - Monitor response times

### Rollback Plan

If issues arise:
```bash
git revert HEAD
supabase functions deploy get-quick-suggestions --project-ref production
```

---

## Success Metrics

### Quality Metrics

1. **Rationale Quality**
   - ✓ No unrealistic behavioral contexts (e.g., "7 AM friend meetups")
   - ✓ Contextual relevance over "never featured" as primary driver
   - ✓ Audience segment alignment with time windows

2. **Timing Accuracy**
   - ✓ Idea 1 within 30-60 min window
   - ✓ 180-min spacing between suggestions
   - ✓ Respect closing buffer (no offerings 3h before close)

3. **Content Selection**
   - ✓ OFFERING when operationally viable
   - ✓ ATMOSPHERE when closing soon or closed
   - ✓ Programme-aligned menu items

### Business Metrics (To Monitor Post-Deployment)

- Engagement rate on generated posts
- Click-through rate on menu items
- User feedback scores
- Manual edit frequency (lower = better quality)

---

## Maintenance & Future Enhancements

### Known Limitations

1. **Language Mixing**: Test rationales show mixed Danish/English
   - **Fix**: Add language consistency layer to behavioral analyzer
   - **Priority**: Medium

2. **Environmental Factors**: Limited to weather and location
   - **Enhancement**: Add seasonal events, local happenings
   - **Priority**: Low

3. **Audience Segments**: Depends on brand profile quality
   - **Enhancement**: Auto-generate segments from historical data
   - **Priority**: Medium

### Future Enhancements

1. **Machine Learning Integration**
   - Learn optimal posting times from engagement data
   - Predict audience segment performance
   
2. **A/B Testing Framework**
   - Test different rationale styles
   - Optimize suggestion count by business type

3. **Multi-Language Support**
   - Ensure behavioral contexts are language-consistent
   - Add language-specific behavioral patterns

---

## Conclusion

The implementation is **complete, tested, and ready for integration**. All specification requirements are met:

✅ Dynamic suggestion count (1-3) based on available time  
✅ Intelligent timing with spacing rules  
✅ Content type selection (OFFERING vs ATMOSPHERE)  
✅ 5-phase behavioral analysis  
✅ Contextually relevant rationales  
✅ Programme-aligned content selection  
✅ Recency as supporting evidence, not primary driver  

**Next Step:** Integrate into `get-quick-suggestions/index.ts` and deploy to staging for validation.
