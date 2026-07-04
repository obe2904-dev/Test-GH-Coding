# Phase 2 Implementation Plan - Brand Profile Location Strategy
## Revised Based on User Feedback

## Implementation Scope

**Based on user feedback:**
- ✅ Phase 2A: Foundation fixes (Changes 1-4)
- ✅ Phase 2B: Location Strategy Module (Changes 5, 6, 8)
- ❌ Phase 2C: SKIP - Audience integration (Change 7) - "Wait with this"
- ❌ Phase 2D: SKIP - Marketing Brief (Change 9) - Depends on 2C

**Rationale:** Location strategy module generates valuable intelligence that gets saved to database. Audience profile integration can happen later when ready to refactor audience segmentation logic.

---

## Concerns Addressed

### ✅ Ref 1: Type Safety & Code Quality

**Files Created:**
- `location-strategy-config.ts` - Centralized config with validation
- `competitive-gap-analyzer.ts` - AI-driven analysis module
- `_BRAND_PROFILE_GRACEFUL_DEGRADATION.md` - Strategy document

**Implementation:**
- TypeScript interfaces for all inputs/outputs
- Runtime validation of business/programme data
- Safe fallbacks for missing fields
- Comprehensive error handling

### ✅ Ref 2: Hardcoded Thresholds - Balanced Solution

**Solution:** `location-strategy-config.ts` with:
- Documented thresholds based on Danish market research
- Source citations (Visitdenmark.dk, SU budget data, etc.)
- Version tracking (v1.0.0)
- Easy override path for future (currently returns defaults)

**Example:**
```typescript
export const DEFAULT_LOCATION_STRATEGY_CONFIG = {
  demographic_filters: {
    tourist: {
      max_price: 350, // DKK - based on tourist meal budget data
      requires_walkin: true
    },
    student: {
      max_price: 200 // DKK - based on SU budget constraints
    }
  }
};
```

**Benefits:**
- Stable defaults prevent drift
- Centralized for easy tuning
- Can be data-driven later (fetch overrides from DB)
- Documented reasoning prevents arbitrary changes

### ✅ Ref 3: AI-Driven Competitive Gap

**Solution:** `competitive-gap-analyzer.ts` with GPT-4o-mini

**Why GPT-4o-mini:**
- Fast: ~1 second response
- Cheap: ~$0.15 per 1M tokens (vs $15 for GPT-4o)
- Good enough: Competitive gap is simple analysis
- Fallback: Deterministic logic if AI fails

**Benefits:**
- No hardcoded cuisine lists
- Handles all restaurant types/hybrids
- Returns structured JSON output
- Graceful degradation to rule-based fallback

**Cost per generation:** <$0.001 (negligible)

### ✅ Ref 4: Migration Created

**File:** `20260625000002_add_brand_profile_location_strategy.sql`

**Columns added:**
- `location_strategy` JSONB - Main strategy output
- `generation_status` JSONB - Graceful degradation flags
- `data_sources_used` JSONB - Track what data was available

### ✅ Ref 5: Graceful Degradation

**Solution:** Layer-by-layer fallbacks with UI flags

**Key Design:**
```typescript
generation_status: {
  menu_status: 'complete' | 'missing' | 'partial',
  location_status: 'complete' | 'missing' | 'partial',
  brand_profile_status: 'complete' | 'partial',
  missing_components: ['menu_data', 'location_intelligence'],
  fallback_mode: boolean,
  warnings: ['Location intelligence not generated - using generic positioning']
}
```

**Hierarchy:**
1. **Menu Missing** → Block generation (critical dependency)
2. **Location Missing** → Degraded mode (location_strategy = null, continue)
3. **Operations Missing** → Minor degradation (use sensible defaults)

**UI Integration:**
- Amber warning banner for degraded mode
- Actionable CTAs to complete missing steps
- Clear explanation of what's missing

### ❌ Ref 6: Audience Integration - Postponed

**Status:** Skipped in this phase

**Impact:** Location strategy will be generated and saved, but audience segmentation won't consume it yet. This is fine - audience module can be updated later when ready.

---

## Implementation Files

### New Files Created

1. **supabase/functions/_shared/brand-profile/location-strategy-config.ts**
   - Centralized configuration
   - Documented thresholds
   - Validation helpers

2. **supabase/functions/_shared/brand-profile/competitive-gap-analyzer.ts**
   - AI-driven competitive gap analysis
   - GPT-4o-mini integration
   - Fallback logic

3. **supabase/migrations/20260625000002_add_brand_profile_location_strategy.sql**
   - Database schema changes
   - Comments for documentation

4. **_BRAND_PROFILE_GRACEFUL_DEGRADATION.md**
   - Strategy document
   - UI integration examples
   - Testing scenarios

### Files to Modify (in deployed Edge Function)

**Note:** Since brand profile code isn't in this workspace, changes will be:

1. **index.ts** (Brand Profile main)
   - Update location data fetch query (Change 1)
   - Fix `extractToneRelevantDemographics` (Change 2)
   - Fix `voiceProfile` filter (Change 3)
   - Import and call `generateLocationStrategy` (Change 6)
   - Add graceful degradation wrapper
   - Save location_strategy to DB (Change 8)

2. **tone-dna-generator.ts**
   - Update input type (Change 4)
   - Use `demographic_proximity` field

3. **voice-profile.ts**
   - Accept `demographic_proximity` alongside `category_scores`

---

## Testing Plan

### Phase 2A: Foundation (Low Risk)

**Test 1:** Location data fetch
```typescript
// Verify category_scores and demographic_proximity separated
console.log('category_scores:', location.category_scores);
console.log('demographic_proximity:', location.demographic_proximity);
// Expected: No student/tourist in category_scores
```

**Test 2:** Tone DNA input
```typescript
// Verify demographic_proximity passed correctly
console.log('tone input demographics:', input.location_intelligence.demographic_proximity);
// Expected: {student: 15, tourist: 30, local_resident: 60, ...}
```

### Phase 2B: Location Strategy (Medium Risk)

**Test 3:** Location strategy generation (K-BBQ)
```typescript
// Business: K-BBQ, avg_price: 420 DKK, booking_required: true
const strategy = generateLocationStrategy({...});
console.log('Reachable demographics:', strategy.reachable_demographics);
// Expected: Tourist filtered out (price + booking)
// Expected: positioning_angles includes unique cuisine
```

**Test 4:** Competitive gap analysis (K-BBQ)
```typescript
const gap = await analyzeCompetitiveGap({...});
console.log('Competitive gap:', gap.gap_description);
// Expected: "Unique Korean BBQ concept" or similar
```

**Test 5:** Graceful degradation (Location missing)
```typescript
// Simulate: location = null
const result = await generateBrandProfileV5(business_id);
console.log('Generation status:', result.generation_status);
// Expected: 
//   fallback_mode: true
//   missing_components: ['location_intelligence']
//   location_strategy: null
```

---

## Deployment Sequence

### Step 1: Apply Migration ✅
```bash
# In Supabase Dashboard SQL Editor
\i supabase/migrations/20260625000002_add_brand_profile_location_strategy.sql
```

### Step 2: Deploy Helper Modules ✅
```bash
# Since _shared/ is referenced by Edge Function, ensure these are deployed:
# - location-strategy-config.ts
# - competitive-gap-analyzer.ts

# These will be imported by the main Edge Function
```

### Step 3: Update Edge Function Code
```typescript
// In generate-brand-profile-v5/index.ts
import { generateLocationStrategy } from '../_shared/brand-profile/location-strategy-config.ts'
import { analyzeCompetitiveGap } from '../_shared/brand-profile/competitive-gap-analyzer.ts'

// ... implement Changes 1-6, 8 from original doc
```

### Step 4: Deploy Edge Function
```bash
supabase functions deploy generate-brand-profile-v5
```

### Step 5: Test with K-BBQ
```bash
curl -X POST \
  https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/generate-brand-profile-v5 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -d '{"business_id": "K_BBQ_BUSINESS_ID"}'
```

### Step 6: Verify Database
```sql
SELECT 
  business_id,
  location_strategy->'positioning_angles' as positioning,
  location_strategy->'competitive_gap' as gap,
  generation_status->>'fallback_mode' as fallback,
  generation_status->'missing_components' as missing
FROM business_brand_profile
WHERE business_id = 'K_BBQ_BUSINESS_ID';
```

---

## Success Criteria

✅ Migration applies without errors  
✅ location_strategy, generation_status, data_sources_used columns exist  
✅ category_scores contains only geographic types (no student/tourist)  
✅ demographic_proximity contains student/tourist/etc  
✅ Location strategy generates with reachable_demographics  
✅ Tourist filtered out for high-price or booking-required businesses  
✅ Competitive gap uses AI (no hardcoded cuisine)  
✅ Graceful degradation works when location missing  
✅ K-BBQ shows unique cuisine positioning  
✅ No errors during Brand Profile generation  

---

## Next Steps After This Phase

**When ready for Phase 2C (audience integration):**
1. Update `generateAudienceSegments` to consume `reachable_demographics`
2. Prevent duplicate segment inference
3. Test with multiple business types
4. Validate audience quality vs old method

**Future enhancements:**
1. Data-driven threshold tuning based on conversion data
2. Per-city threshold adjustments (Copenhagen vs Silkeborg)
3. Seasonal demographic shifts
4. Competitive gap confidence scoring
5. Location strategy versioning for A/B testing
