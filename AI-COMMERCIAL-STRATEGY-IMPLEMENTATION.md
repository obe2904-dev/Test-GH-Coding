# AI-Powered Commercial Strategy Implementation Summary

**Date:** January 2026  
**Status:** ✅ Complete  
**Integration:** Brand Profile Generator (Stage CS)

---

## Overview

Implemented AI-powered commercial strategy analysis that automatically runs during brand profile generation. The system analyzes business characteristics, menu, location, and operational capabilities to recommend optimal commercial content strategy configuration (baseline mode + trigger configuration).

**User Requirements Met:**
- ✅ Runs automatically with brand-profile-generator (no separate button)
- ✅ Analyzes operations, menu, and location types (up to 4)
- ✅ Generates general summary text with example triggers (not exhaustive lists)
- ✅ Static recommendations for now (no feedback loop yet)
- ✅ Integrated into Brand Profile workflow with dynamic weekly overrides possible
- ✅ AI auto-configures with user override capability
- ✅ Extended brand-profile-generator directly (Stage CS)

---

## Implementation Components

### 1. Database Migration

**File:** `supabase/migrations/20260505000003_add_commercial_strategy_reasoning.sql`

**Changes:**
```sql
-- Add AI reasoning field to store commercial strategy explanations
ALTER TABLE business_brand_profile 
ADD COLUMN commercial_strategy_reasoning TEXT;

COMMENT ON COLUMN business_brand_profile.commercial_strategy_reasoning IS 
  'AI-generated explanation of why this commercial strategy configuration was recommended';

-- Index for businesses needing review (null reasoning)
CREATE INDEX idx_business_brand_profile_reasoning_null 
  ON business_brand_profile (business_id) 
  WHERE commercial_strategy_reasoning IS NULL;

-- Update existing auto-configured records
UPDATE business_brand_profile
SET commercial_strategy_reasoning = 'Auto-configured based on business characteristics. Regenerate brand profile for AI-analyzed recommendations.'
WHERE trigger_updated_by = 'auto';
```

**Purpose:** Stores AI-generated reasoning text explaining commercial strategy recommendations.

---

### 2. AI Prompt Template

**File:** `supabase/functions/_shared/brand-profile/prompts/commercial-strategy-prompt.ts`

**Key Features:**
- Analyzes business profile, operations, location, menu characteristics
- Generates JSON configuration with baseline mode + 7 trigger configs
- Outputs conversational summary text (3-4 sentences)
- Uses general terms with example triggers (not exhaustive lists)
- Handles Danish holidays generically (Easter, summer vacation, etc.)
- Includes confidence score and key decision factors

**Input Context:**
```typescript
interface CommercialStrategyContext {
  business_id: string;
  category: string;
  brand_essence?: string;
  has_reservation_system: boolean;
  outdoor_seating_capacity?: number;
  delivery_options?: string[];
  service_periods?: string[];
  location_types?: string[]; // Up to 4 types
  footfall_pattern?: string;
  menu_price_point?: 'budget' | 'moderate' | 'upscale' | 'luxury';
  menu_item_count?: number;
  has_seasonal_items?: boolean;
  fine_dining_indicators?: string[];
  tourist_factor?: 'none' | 'minor' | 'moderate' | 'dominant';
  primary_audience?: string;
}
```

**Output Structure:**
```json
{
  "commercial_baseline_mode": "booking_push|footfall_push|balanced",
  "baseline_reasoning": "1-2 sentences",
  "trigger_configuration": {
    "VD_WEEK": {
      "enabled": true/false,
      "mode": "booking_push|footfall_push|balanced",
      "min_booking_ideas": 1-4,
      "min_footfall_ideas": 1-5,
      "reasoning": "Why this trigger matters"
    },
    // ... 6 more triggers
  },
  "summary_text": "3-4 sentence explanation with examples",
  "confidence_score": 0.0-1.0,
  "key_factors": ["factor1", "factor2"]
}
```

**Decision Logic Guidelines:**
- **booking_push**: Reservation system + upscale/fine dining + special occasion positioning
- **footfall_push**: No reservations OR casual positioning OR residential location
- **balanced**: Mixed signals or moderate positioning
- Higher booking quotas (3-4) for upscale with reservations
- Higher footfall quotas (4-5) for casual/neighborhood venues
- Weather trigger only for outdoor seating 15+ seats
- Family occasions (MD/FD) only for family-friendly venues
- Payday/weekend patterns for residential, not tourist areas

---

### 3. Analysis Function

**File:** `supabase/functions/_shared/brand-profile/prompts/commercial-strategy-analyzer.ts`

**Main Functions:**

**`analyzeMenu()`** - Analyzes menu items to extract:
- Price point (budget/moderate/upscale/luxury) based on average price
- Item count
- Seasonal indicators (keywords in descriptions)
- Fine dining indicators (tasting menu, wine pairing, chef-driven)

**`gatherBusinessContext()`** - Collects context from:
- `businesses` table (category)
- `business_operations` table (reservations, outdoor seating, delivery, service periods)
- `business_location_intelligence` table (location types up to 4, footfall pattern)
- `business_brand_profile` table (brand essence, primary audience, tourist factor)
- Menu analysis (price point, size, seasonal items, fine dining indicators)

**`callOpenAI()`** - Calls GPT-4o-mini with structured JSON output

**`validateRecommendation()`** - Ensures:
- All required fields exist with valid values
- Modes are valid (booking_push/footfall_push/balanced)
- All 7 triggers are configured
- Quotas are within range (0-7)
- Provides safe defaults if validation fails

**`analyzeCommercialStrategy()`** - Main entry point:
- Gathers business context
- Builds and sends prompt to OpenAI
- Validates and sanitizes response
- Returns safe defaults on error

**Error Handling:**
- Returns safe defaults if analysis fails
- All triggers disabled with balanced mode
- Confidence score 0.3 to indicate fallback
- Summary explains error state

---

### 4. Brand Profile Generator Integration

**File:** `supabase/functions/brand-profile-generator/index.ts`

**Location:** After Stage B5 (Audience Segments), before final response

**Code Added:**
```typescript
// Stage CS (Commercial Strategy) — AI-Powered Commercial Strategy Analysis
console.log(`[${requestId}] 💰 Stage CS: starting commercial strategy analysis...`)
try {
  const { analyzeCommercialStrategy } = await import('../_shared/brand-profile/commercial-strategy-analyzer.ts')
  
  const commercialStrategy = await analyzeCommercialStrategy(
    supabaseClient,
    businessId,
    Deno.env.get('OPENAI_API_KEY')!
  )
  
  const { error: csErr } = await supabaseClient
    .from('business_brand_profile')
    .update({
      commercial_baseline_mode: commercialStrategy.commercial_baseline_mode,
      trigger_configuration: commercialStrategy.trigger_configuration,
      commercial_strategy_reasoning: commercialStrategy.summary_text,
      trigger_updated_by: 'ai',
      trigger_updated_at: new Date().toISOString()
    })
    .eq('business_id', businessId)
  
  if (csErr) {
    console.warn(`[${requestId}] ⚠️ Stage CS save failed (non-fatal):`, csErr.message)
  } else {
    console.log(`[${requestId}] ✅ Stage CS: saved commercial strategy (mode=${commercialStrategy.commercial_baseline_mode}, confidence=${commercialStrategy.confidence_score})`)
    console.log(`[${requestId}] 💡 Stage CS: ${commercialStrategy.summary_text}`)
  }
} catch (csErr) {
  console.warn(`[${requestId}] ⚠️ Stage CS exception (non-fatal):`, String(csErr))
}
```

**Characteristics:**
- Non-blocking, non-fatal (like Stage B5)
- Runs after main brand profile is saved
- Updates 5 fields in business_brand_profile
- Logs reasoning text for debugging
- Continues if analysis fails

---

### 5. UI Updates

#### A. CommercialStrategySection Component

**File:** `src/components/brandProfile/CommercialStrategySection.tsx`

**New Props:**
```typescript
interface CommercialStrategyProps {
  businessId: string;
  currentBaselineMode?: CommercialMode;
  currentTriggerConfig?: BusinessTriggerConfiguration;
  commercialStrategyReasoning?: string;  // NEW
  triggerUpdatedBy?: 'ai' | 'manual' | null;  // NEW
  onUpdate?: () => void;
}
```

**New UI Section:**
```tsx
{/* AI Reasoning Display */}
{commercialStrategyReasoning && (
  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="flex items-start gap-3">
      <span className="text-2xl">🤖</span>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-semibold text-blue-900">
            AI-Recommended Commercial Strategy
          </h3>
          {triggerUpdatedBy === 'ai' && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
              AI-configured
            </span>
          )}
          {triggerUpdatedBy === 'manual' && (
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
              User-edited
            </span>
          )}
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">
          {commercialStrategyReasoning}
        </p>
      </div>
    </div>
  </div>
)}
```

**Save Handler Update:**
- Sets `trigger_updated_by: 'manual'` when user manually edits
- This changes badge from "AI-configured" to "User-edited"

**Visual Design:**
- 🤖 emoji for AI indicator
- Blue background box to highlight AI reasoning
- Badge shows whether AI-configured or user-edited
- Reasoning text displayed prominently at top of section

#### B. BrandProfileDisplay Component

**File:** `src/components/brandProfile/BrandProfileDisplay.tsx`

**Interface Updates:**
```typescript
interface BrandProfile {
  // ... existing fields
  commercial_baseline_mode?: 'booking_push' | 'footfall_push' | 'balanced';
  trigger_configuration?: any;
  commercial_strategy_reasoning?: string;  // NEW
  trigger_updated_by?: 'ai' | 'manual' | null;  // NEW
}
```

**Usage Update:**
```tsx
<CommercialStrategySection
  businessId={businessId}
  currentBaselineMode={profile.commercial_baseline_mode}
  currentTriggerConfig={profile.trigger_configuration || {}}
  commercialStrategyReasoning={profile.commercial_strategy_reasoning}  // NEW
  triggerUpdatedBy={profile.trigger_updated_by}  // NEW
/>
```

#### C. BrandProfilePageV5 Component

**File:** `src/pages/dashboard/BrandProfilePageV5.tsx`

**transformProfile Function Updates:**
```typescript
// Commercial strategy
commercial_baseline_mode: dbProfile.commercial_baseline_mode ?? 'balanced',
trigger_configuration: parseField(dbProfile.trigger_configuration) ?? null,
commercial_strategy_reasoning: dbProfile.commercial_strategy_reasoning ?? null,  // NEW
trigger_updated_by: dbProfile.trigger_updated_by ?? null,  // NEW
```

**Purpose:** Fetches and passes new fields from database to display components.

---

## Data Flow

### Generation Flow (Brand Profile Creation)

```
1. User triggers brand profile generation
2. Brand-profile-generator runs main stages A, B0, B1, B2, B3, B4, B5
3. STAGE CS: Commercial Strategy Analysis
   ↓
4. analyzeCommercialStrategy() gathers context:
   - Business category, brand essence
   - Operations data (reservations, outdoor seating, delivery)
   - Location intelligence (up to 4 location types, footfall pattern)
   - Menu analysis (price point, size, seasonal items, fine dining)
   - Tourist factor, primary audience
   ↓
5. buildCommercialStrategyPrompt() creates AI prompt
   ↓
6. callOpenAI() with GPT-4o-mini + JSON response format
   ↓
7. validateRecommendation() ensures valid output
   ↓
8. Save to business_brand_profile:
   - commercial_baseline_mode
   - trigger_configuration (7 triggers)
   - commercial_strategy_reasoning (summary text)
   - trigger_updated_by = 'ai'
   - trigger_updated_at = now()
   ↓
9. Brand profile generation completes
```

### Display Flow (Brand Profile Page)

```
1. BrandProfilePageV5 fetches business_brand_profile
   ↓
2. transformProfile() includes:
   - commercial_baseline_mode
   - trigger_configuration
   - commercial_strategy_reasoning
   - trigger_updated_by
   ↓
3. BrandProfileDisplay passes to CommercialStrategySection
   ↓
4. Component displays:
   - AI reasoning box (if reasoning exists)
   - Badge: "AI-configured" or "User-edited"
   - Baseline mode selector
   - 7 trigger toggles with per-trigger quotas
   ↓
5. User can edit and save
   ↓
6. Save sets trigger_updated_by = 'manual'
   ↓
7. Badge changes to "User-edited"
```

---

## Example AI Output

**For an upscale restaurant with reservations and outdoor seating:**

```json
{
  "commercial_baseline_mode": "booking_push",
  "baseline_reasoning": "As an upscale restaurant with a reservation system, your commercial focus should prioritize advance bookings to ensure table management and revenue predictability.",
  
  "trigger_configuration": {
    "VD_WEEK": {
      "enabled": true,
      "mode": "booking_push",
      "min_booking_ideas": 4,
      "min_footfall_ideas": 1,
      "reasoning": "Valentine's Day is a major booking opportunity for upscale dining."
    },
    "MD_WEEK": {
      "enabled": true,
      "mode": "booking_push",
      "min_booking_ideas": 3,
      "min_footfall_ideas": 2,
      "reasoning": "Mother's Day brunch and celebrations drive advance reservations."
    },
    "WEATHER_BREAK": {
      "enabled": true,
      "mode": "footfall_push",
      "min_footfall_ideas": 4,
      "min_booking_ideas": 1,
      "reasoning": "Your outdoor seating is a major asset when warm weather arrives."
    },
    "FIRST_WEEKEND": {
      "enabled": false,
      "mode": "footfall_push",
      "reasoning": "First weekend patterns less relevant for destination dining."
    }
    // ... other triggers
  },
  
  "summary_text": "Your upscale restaurant with reservations and outdoor seating should focus primarily on booking conversion. Key opportunities include Valentine's Day, Mother's Day, and other romantic/celebratory occasions. When warm weather arrives, pivot to footfall content showcasing your terrace. First-of-month and payday patterns are less relevant for your destination dining model.",
  
  "confidence_score": 0.92,
  "key_factors": [
    "has_reservation_system",
    "upscale_price_point",
    "outdoor_seating_capacity",
    "fine_dining_positioning"
  ]
}
```

**For a casual café in residential area:**

```json
{
  "commercial_baseline_mode": "footfall_push",
  "baseline_reasoning": "As a casual café in a residential neighborhood without reservations, your success depends on spontaneous walk-in visits from local regulars.",
  
  "trigger_configuration": {
    "FIRST_WEEKEND": {
      "enabled": true,
      "mode": "footfall_push",
      "min_footfall_ideas": 4,
      "min_booking_ideas": 0,
      "reasoning": "First weekend of month is prime time for neighborhood cafés when locals have just been paid."
    },
    "PAYDAY_PERIOD": {
      "enabled": true,
      "mode": "footfall_push",
      "min_footfall_ideas": 4,
      "min_booking_ideas": 0,
      "reasoning": "Payday periods drive increased spending at local cafés."
    },
    "VD_WEEK": {
      "enabled": false,
      "mode": "balanced",
      "reasoning": "Valentine's Day not a major driver for casual café visits."
    }
    // ... other triggers
  },
  
  "summary_text": "Your neighborhood café should focus on driving spontaneous visits from local regulars. Key patterns include first weekend and payday periods when locals have spending power. Special occasion triggers like Valentine's or Mother's Day are less relevant for your casual, everyday positioning. Weather and seasonal events matter more than calendar-based celebrations.",
  
  "confidence_score": 0.88,
  "key_factors": [
    "residential_location",
    "no_reservation_system",
    "budget_price_point",
    "casual_positioning"
  ]
}
```

---

## Testing & Validation

### Automated Validation

The `validateRecommendation()` function ensures:
- ✅ All 7 triggers are configured
- ✅ Modes are valid (booking_push, footfall_push, balanced)
- ✅ Quotas are within range (0-7)
- ✅ Required fields exist (baseline_mode, summary_text)
- ✅ Confidence score is numeric (0.0-1.0)
- ✅ Safe defaults provided on any validation failure

### Manual Testing Checklist

**Test 1: New Brand Profile Generation**
1. Delete existing brand profile for test business
2. Trigger brand profile generation
3. Check logs for "Stage CS: starting commercial strategy analysis"
4. Verify `commercial_baseline_mode`, `trigger_configuration`, `commercial_strategy_reasoning` saved
5. Check `trigger_updated_by = 'ai'`

**Test 2: UI Display**
1. Open Brand Profile page
2. Scroll to Commercial Strategy section
3. Verify AI reasoning box displays with 🤖 emoji
4. Check badge shows "AI-configured"
5. Verify baseline mode and triggers match database

**Test 3: Manual Override**
1. Click "Edit Strategy" button
2. Change baseline mode or toggle trigger
3. Click "Save"
4. Verify success message
5. Check badge changes to "User-edited"
6. Verify `trigger_updated_by = 'manual'` in database

**Test 4: Different Business Types**
- Upscale restaurant → Should recommend booking_push
- Casual café → Should recommend footfall_push
- Venue with outdoor seating → Weather trigger enabled
- No reservations → Booking triggers should be disabled/deprioritized

---

## Error Handling

### Database Migration Errors
**Scenario:** Migration fails to add column  
**Fallback:** Manual ALTER TABLE can be run; field is optional

### AI Analysis Errors
**Scenario:** OpenAI API fails or times out  
**Fallback:** Returns safe defaults (all triggers disabled, balanced mode, confidence 0.3)

### Validation Errors
**Scenario:** AI returns invalid JSON or missing fields  
**Fallback:** validateRecommendation() fills in safe defaults for any missing/invalid fields

### Save Errors
**Scenario:** Database update fails in Stage CS  
**Fallback:** Logged as warning, brand profile generation continues (non-fatal)

### UI Errors
**Scenario:** Missing reasoning or trigger_updated_by in database  
**Fallback:** Fields are optional; UI gracefully hides reasoning box if not present

---

## Monitoring & Logging

### Brand Profile Generator Logs

**Stage CS Start:**
```
[request-123] 💰 Stage CS: starting commercial strategy analysis...
```

**Stage CS Success:**
```
[request-123] ✅ Stage CS: saved commercial strategy (mode=booking_push, confidence=0.92)
[request-123] 💡 Stage CS: Your upscale restaurant with reservations should focus primarily on booking conversion...
```

**Stage CS Warning:**
```
[request-123] ⚠️ Stage CS save failed (non-fatal): Database error message
```

**Stage CS Exception:**
```
[request-123] ⚠️ Stage CS exception (non-fatal): OpenAI timeout
```

### Database Monitoring

**Check businesses without AI analysis:**
```sql
SELECT business_id, commercial_baseline_mode, trigger_updated_by
FROM business_brand_profile
WHERE commercial_strategy_reasoning IS NULL
  AND trigger_configuration IS NOT NULL;
```

**Check AI vs manual configurations:**
```sql
SELECT 
  trigger_updated_by,
  COUNT(*) as count
FROM business_brand_profile
WHERE trigger_updated_by IS NOT NULL
GROUP BY trigger_updated_by;
```

**Check confidence distribution:**
Would require extracting from reasoning text or adding confidence_score column (future enhancement).

---

## Next Steps & Future Enhancements

### Phase 2: Dynamic Weekly Overrides
- Weekly strategy generator can override AI baseline for specific weeks
- E.g., LOCAL_EVENT trigger temporarily switches mode for that week only
- Requires: weekly_strategies table integration with commercial mode overrides

### Phase 3: Feedback Loop
- Track which triggers actually drive engagement/conversions
- Feed back into AI recommendations
- Adjust quotas based on performance data
- Requires: Analytics integration + performance tracking

### Phase 4: Seasonal Learning
- AI learns which triggers work best for each business over time
- Automatically adjusts quotas based on historical performance
- Requires: Time-series data + ML feedback loop

### Phase 5: Multi-Location Intelligence
- Businesses with multiple locations get location-specific configurations
- Tourist area location gets different triggers than residential location
- Requires: business_locations table integration

### Phase 6: Owner Override Preferences
- Owners can set "never do this" rules (e.g., "never push Valentine's Day")
- AI respects these constraints in future regenerations
- Requires: business_preferences table

---

## Documentation Updates

### Files Created
1. ✅ `supabase/migrations/20260505000003_add_commercial_strategy_reasoning.sql`
2. ✅ `supabase/functions/_shared/brand-profile/prompts/commercial-strategy-prompt.ts`
3. ✅ `supabase/functions/_shared/brand-profile/commercial-strategy-analyzer.ts`
4. ✅ `AI-COMMERCIAL-STRATEGY-IMPLEMENTATION.md` (this file)

### Files Modified
1. ✅ `supabase/functions/brand-profile-generator/index.ts` (Stage CS integration)
2. ✅ `src/components/brandProfile/CommercialStrategySection.tsx` (UI updates)
3. ✅ `src/components/brandProfile/BrandProfileDisplay.tsx` (interface + props)
4. ✅ `src/pages/dashboard/BrandProfilePageV5.tsx` (data fetching)

### Related Documentation
- `COMMERCIAL-MODE-IMPLEMENTATION-GUIDE.md` - Original commercial mode system design
- `BRAND-PROFILE-COMMERCIAL-UI-SUMMARY.md` - UI component documentation
- `PROMPT-GOVERNANCE-CHECKLIST.md` - Prompt validation framework

---

## Success Criteria

✅ **Automatic Execution:** Runs with brand-profile-generator without separate button  
✅ **Comprehensive Analysis:** Analyzes operations, menu, location types (up to 4)  
✅ **User-Friendly Output:** General summary text with examples, not exhaustive lists  
✅ **Integrated Workflow:** Part of Brand Profile, with weekly overrides possible  
✅ **User Control:** AI auto-configures, user can override  
✅ **Non-Blocking:** Non-fatal errors don't stop brand profile generation  
✅ **Visual Clarity:** UI clearly shows AI vs manual configuration  
✅ **Error Resilience:** Safe defaults if AI analysis fails  

---

## Contact & Support

For questions or issues:
1. Check logs in brand-profile-generator for Stage CS output
2. Review database fields: `commercial_strategy_reasoning`, `trigger_updated_by`
3. Test with different business types to see variation in recommendations
4. Refer to `COMMERCIAL-MODE-IMPLEMENTATION-GUIDE.md` for overall system context

---

**Implementation Status:** ✅ COMPLETE  
**Ready for Testing:** Yes  
**Ready for Production:** Yes (with monitoring)
