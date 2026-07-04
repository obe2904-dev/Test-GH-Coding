# PROPOSAL: Programme-Specific Price Positioning

## Problem Statement

**Current Gap:**
A business with a 99 DKK børnemenu and a 239 DKK per-person brunch is labeled with ONE price tier (e.g., "moderate" at 142 DKK average). This loses critical context:
- **Saturday brunch post** should reflect "upscale" positioning (239 DKK)
- **Tuesday lunch post** should reflect "value" positioning (120 DKK)
- **Children's menu content** should reflect "budget" positioning (99 DKK)

**User Quote:**
> "The price positioning function should consider the *spread* of prices and the *programme context*, not just the average. The tone for a Saturday evening post should draw on different price positioning signals than a Tuesday lunch post."

---

## Value Assessment: SUBSTANTIAL 🟢

### Quality Impact Examples:

**Scenario: Café Faust (Brunch 239 DKK, Lunch 120 DKK, Kids 99 DKK)**

#### ❌ Current (Single Tier: "Moderate" @ 142 DKK avg)
```
Saturday Brunch Post:
"Start din weekend med vores brunch - en god oplevelse til en fair pris 🌅"
(Tone: Mid-range, generic value proposition)

Tuesday Lunch Post:
"Frokost er serveret - kom og nyd vores udvalg i dag ☀️"
(Tone: Mid-range, doesn't emphasize value)
```

#### ✅ Proposed (Per-Programme Positioning)
```
Saturday Brunch Post (Upscale @ 239 DKK):
"Forkæl dig selv med vores weekend brunch - en kulinarisk oplevelse ved vandet 🥂✨"
(Tone: Premium, experience-focused, aspirational)

Tuesday Lunch Post (Value @ 120 DKK):
"Hurtig business lunch fra 120 kr - kvalitet uden at sprænge budgettet 💼"
(Tone: Value-conscious, practical, time-efficient)
```

### Content Strategy Benefits:
1. **Tone calibration**: Premium vs value language per occasion
2. **Audience targeting**: Brunch → experience-seekers; Lunch → professionals
3. **CTA optimization**: "Book bord" (upscale) vs "Drop forbi" (value)
4. **Social proof**: Different testimonials per price tier

---

## Implementation Analysis

### 1. Brand Profile Changes (Layer 2)

**Current State:**
```typescript
// supabase/functions/brand-profile-generator-v5/index.ts
// Line ~1373: Global price positioning from overall average
const pricePositioning = determinePricePositioning(crossMenuSummary?.overall_avg_price);

// Stored in Layer 5 (voice) only:
{
  voice: {
    tone_dna: {
      culinary_character: {
        price_positioning: "moderate"  // ← Single value for entire business
      }
    }
  }
}
```

**Proposed Change:**
```typescript
// For EACH programme, calculate price positioning from programme-specific menu items
const programmesWithPricing = detectedProgrammes.map(prog => {
  const programmeMenuItems = filterMenuItemsByProgramme(normalizedMenuItems, prog);
  const priceStats = calculatePriceStats(programmeMenuItems);
  
  return {
    ...prog,
    price_positioning: {
      tier: determinePricePositioning(priceStats.avg),
      min: priceStats.min,
      max: priceStats.max,
      avg: priceStats.avg,
      spread: priceStats.max - priceStats.min,
      sample_count: programmeMenuItems.length
    }
  };
});

// Store in Layer 2 (Commercial Orientation) per programme:
{
  programmes: {
    brunch: {
      commercial_orientation: {
        baseline_goal_split: {...},
        decision_timing: "planned",
        content_type_affinity: {...},
        price_positioning: {  // ← NEW
          tier: "upscale",
          min: 189,
          max: 289,
          avg: 239,
          spread: 100,
          sample_count: 12
        }
      }
    },
    lunch: {
      commercial_orientation: {
        // ...
        price_positioning: {  // ← NEW
          tier: "value",
          min: 89,
          max: 159,
          avg: 124,
          spread: 70,
          sample_count: 24
        }
      }
    }
  }
}
```

**Implementation Complexity: MEDIUM** 🟡
- ✅ Menu items already have `service_periods` array
- ✅ Can filter by programme using existing mapping logic
- ✅ `determinePricePositioning()` function already exists
- ⚠️ Need to map programme types to service periods (brunch → ['brunch'], lunch → ['lunch'], dinner → ['dinner'])
- ⚠️ Edge case: Items in multiple service periods (e.g., desserts in both lunch and dinner)

**New Function Needed:**
```typescript
// supabase/functions/brand-profile-generator-v5/programme-price-analyzer.ts
function filterMenuItemsByProgramme(
  menuItems: NormalizedMenuItem[], 
  programme: DetectedProgramme
): NormalizedMenuItem[] {
  const servicePeriodMap = {
    breakfast: ['breakfast', 'morgenmad'],
    brunch: ['brunch'],
    lunch: ['lunch', 'frokost'],
    dinner: ['dinner', 'aften'],
    bar: ['bar', 'drinks']
  };
  
  const periods = servicePeriodMap[programme.type] || [];
  
  return menuItems.filter(item => 
    item.service_periods?.some(sp => periods.includes(sp.toLowerCase()))
  );
}

function calculatePriceStats(items: NormalizedMenuItem[]): PriceStats {
  const prices = items
    .map(i => i.price)
    .filter((p): p is number => p != null && p > 0);
  
  if (prices.length === 0) return { min: null, max: null, avg: null, spread: 0 };
  
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    spread: Math.max(...prices) - Math.min(...prices),
    sample_count: prices.length
  };
}
```

---

### 2. Downstream Integration

**Affected Endpoints:** All Stage 2 content generation (6 endpoints)
- get-quick-suggestions
- generate-weekly-plan
- generate-text-from-idea
- get-weekly-strategy
- ai-enhance
- (generate-text-from-scratch if exists)

**Integration Method: EASY** 🟢

**Option A: Include in Marketing Manager Brief (Recommended)**
```typescript
// supabase/functions/_shared/brand-profile/marketing-manager-brief-generator.ts
// Update buildMarketingBriefPrompt() to include per-programme pricing

const briefPrompt = `
### KOMMERCIEL POSITIONERING (PER PROGRAM)
${programmes.map(p => `
- **${p.programme_name}** (${p.time_windows}):
  ${p.commercial_orientation.price_positioning.tier.toUpperCase()} (${p.commercial_orientation.price_positioning.avg} kr gennemsnit, ${p.commercial_orientation.price_positioning.min}-${p.commercial_orientation.price_positioning.max} kr)
  → Tone: ${getPriceToneGuidance(p.commercial_orientation.price_positioning.tier)}
`).join('')}
`;

function getPriceToneGuidance(tier: string): string {
  const guidance = {
    budget: 'tilgængelighed, værdi, daglig glæde - undgå eksklusivitet',
    value: 'kvalitet til fair pris, smart valg - balance tilgængelighed og oplevelse',
    moderate: 'kvalitetsfokus, lokal favorit - bred appel',
    upscale: 'elevated experience, forkæl dig selv - aspirational tone',
    premium: 'destination dining, eksklusivitet, særlige øjeblikke - premium language'
  };
  return guidance[tier] || guidance.moderate;
}
```

**Content generation prompts automatically inherit this context via marketing_manager_brief!**

**Option B: Direct Lookup (If needed for specific features)**
```typescript
// In generate-text-from-idea or similar
const programmeTiming = extractProgrammeFromIdea(idea); // "brunch", "lunch", etc.
const programmeProfile = brandProfile.brand_profile_v5.programmes[programmeTiming];
const priceTier = programmeProfile.commercial_orientation.price_positioning.tier;

// Use in prompt:
const priceGuidance = `Dette indlæg er for ${programmeTiming} (${priceTier} positionering - ${programmeProfile.commercial_orientation.price_positioning.avg} kr)`;
```

**No endpoint changes needed if using Option A** ✅

---

### 3. Database Schema

**Changes: MINOR** 🟢

**Option 1: JSONB Only (Recommended)**
```sql
-- No ALTER TABLE needed
-- Just update brand_profile_v5 JSONB structure:
{
  "programmes": {
    "brunch": {
      "commercial_orientation": {
        "baseline_goal_split": {...},
        "price_positioning": {  -- NEW field
          "tier": "upscale",
          "min": 189,
          "max": 289,
          "avg": 239,
          "spread": 100,
          "sample_count": 12
        }
      }
    }
  }
}
```
**No migration needed!** ✅

**Option 2: Indexed Column (If needed for querying)**
```sql
-- Only if we need to query by price tier
ALTER TABLE business_programme_profiles 
ADD COLUMN price_positioning_tier TEXT;

CREATE INDEX idx_programme_price_tier 
ON business_programme_profiles(business_id, price_positioning_tier);
```
**Skip this unless analytics requires it.** ⚠️

---

## Implementation Plan

### Phase 1: Core Logic (1-2 hours)
1. ✅ Create `programme-price-analyzer.ts` module
   - `filterMenuItemsByProgramme()`
   - `calculatePriceStats()`
   - `determineProgrammePricePositioning()`

2. ✅ Update `brand-profile-generator-v5/index.ts`
   - After Layer 1 (programme detection), before Layer 2
   - Add price analysis to each programme
   - Include in Layer 2 structure

3. ✅ Update `commercial-orientation.ts` (if separate file)
   - Add `price_positioning` to interface
   - Include in prompt generation

### Phase 2: Marketing Brief Integration (30 min)
4. ✅ Update `marketing-manager-brief-generator.ts`
   - Add per-programme pricing to brief prompt
   - Include tone guidance per tier

### Phase 3: Testing (1 hour)
5. ✅ Create test SQL queries
   - Verify price stats per programme
   - Check tier assignments
   - Validate marketing brief includes pricing

6. ✅ Regenerate test business (Café Faust)
   - Should see different tiers for different programmes
   - Marketing brief should reflect per-programme positioning

7. ✅ Generate test content
   - Brunch post vs lunch post
   - Verify tone difference

### Phase 4: Validation (30 min)
8. ✅ Check bundle size (should be minimal increase)
9. ✅ Verify no errors in production
10. ✅ Document new structure in BRAND_PROFILE_V5_DATABASE_MAPPING.md

**Total Effort: ~3-4 hours** ⏱️

---

## Edge Cases & Considerations

### 1. Missing Menu Prices
**Issue:** Some items have no price (market price, seasonal)
**Solution:** Use available items only, flag low sample count
```typescript
if (priceStats.sample_count < 3) {
  console.warn(`[${programme.label}] Low price sample count: ${priceStats.sample_count}`);
  // Fallback to business-wide average if < 3 items
  return fallbackToGlobalPricing();
}
```

### 2. Overlapping Service Periods
**Issue:** Desserts might appear in both lunch and dinner
**Solution:** Accept duplication - it's realistic (same dessert has same price across occasions)

### 3. Children's Menu
**Issue:** Kids menu (99 DKK) skews lunch average downward
**Debate:** Should kids items be excluded from pricing calculations?
**Recommendation:** 
- **Include** in overall stats (it's a real price point)
- **Flag** in marketing brief: "Note: Includes børnemenu (99 kr)"
- Content AI can decide if kids menu is relevant to current post

### 4. Multi-Programme Items
**Issue:** All-day items (e.g., coffee, cake) in multiple programmes
**Solution:** Include in all relevant programmes - price is same regardless

### 5. Programme Without Menu Items
**Issue:** Bar programme detected from opening hours, but no drinks have prices
**Solution:** 
```typescript
if (priceStats.sample_count === 0) {
  console.log(`[${programme.label}] No menu prices - using fallback tier`);
  return { tier: 'moderate', min: null, max: null, avg: null };
}
```

---

## Success Metrics

### Quantitative
- ✅ Each programme has `price_positioning` field populated
- ✅ Marketing brief includes per-programme pricing (verify with LIKE '%brunch%upscale%')
- ✅ Price spread captured (max - min) > 0 for multi-item programmes

### Qualitative  
- ✅ Brunch posts use premium language ("forkæl dig selv", "kulinarisk oplevelse")
- ✅ Lunch posts use value language ("fra 120 kr", "hurtig", "fair pris")
- ✅ Content tone matches programme price tier

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Incorrect service_period mapping | Medium | Map programmes to multiple period variants (lunch → ['lunch', 'frokost']) |
| Low sample count per programme | Low | Fallback to global pricing if < 3 items |
| Marketing brief becomes too long | Low | Concise format (1 line per programme) |
| Content AI ignores per-programme signals | Medium | Explicit tone guidance in brief |
| Programme detection fails | High | Price analysis happens AFTER detection (safe failure mode) |

---

## Recommendation: ✅ IMPLEMENT

**Rationale:**
1. **High value**: Meaningful content quality improvement for multi-programme businesses
2. **Low risk**: Data already exists (service_periods), incremental change
3. **Easy integration**: Marketing brief pattern already working
4. **No schema migration**: Pure JSONB update
5. **Fast implementation**: 3-4 hours total

**Next Steps:**
1. User approval
2. Run `_check_programme_prices.sql` to validate data availability
3. Implement Phase 1 (core logic)
4. Test on Café Faust
5. Deploy + verify
