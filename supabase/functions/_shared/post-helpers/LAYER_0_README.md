# Layer 0: Weekly Strategy Generator - Phase 1

## Overview
Layer 0 generates AI-powered weekly content strategies using Gemini 2.5 Flash. It analyzes weather, events, seasonality, and business context to create a strategic narrative and 7 post ideas.

## Files Created

```
supabase/functions/_shared/post-helpers/
├── types/
│   └── strategy-types.ts          # Type definitions (WeekContext, WeeklyStrategy, etc.)
├── config/
│   └── business-type-frameworks.ts # Business type strategies (FSE, SBO, QSR, etc.)
├── mock/
│   └── mock-week-context.ts       # Mock data for testing (Café Faust, wine bar, hybrid)
├── weekly-strategy-generator.ts   # Main generator function
└── tests/
    └── test-layer0-strategy.ts    # Test script
```

## Phase 1: Mock Data Testing

Phase 1 uses hardcoded mock data to validate:
- ✅ Gemini prompt quality
- ✅ JSON output structure
- ✅ Business type framework adaptation
- ✅ Hybrid business logic
- ✅ Validation rules

## Running Tests

### Prerequisites
1. Gemini API key set in environment:
   ```bash
   export GEMINI_API_KEY=your_key_here
   ```

2. Or check Supabase secrets:
   ```bash
   supabase secrets list
   ```

### Run Tests
```bash
cd /Users/olebaek/Test\ P2G\ 1
deno run --allow-net --allow-env supabase/functions/_shared/post-helpers/tests/test-layer0-strategy.ts
```

### Expected Output
```
🧪 LAYER 0 STRATEGY GENERATOR - TEST SUITE
======================================================================
✓ GEMINI_API_KEY found

======================================================================
TEST: Café Faust (FSE) - Valentine's Week
======================================================================

📊 HEADLINE: Uge 7: Valentines ved åen + vinterhygge
📝 OVERVIEW: Kulden fortsætter denne uge med temperaturer omkring frysepunktet...

🎯 STRATEGIC PRIORITIES:
  - warm_dishes (40%): Koldt vejr kræver varme komfortretter
  - valentines (30%): Valentines Day fredag er perfekt til romantik
  - atmosphere (30%): Vores placering ved åen skaber unik stemning

💡 POST IDEAS:
  1. [2026-02-10 11:00] Faust Gryde til vinterdagen
     Type: menu_item
     Rationale: Varm ret til koldt vejr - perfekt til mandag
     Performance: high | Fit: 0.95

✅ VALIDATION:
   Passed: YES
   Duration: 2847ms

🔍 QUALITY CHECKS:
   Weight sum: 1.00 ✓
   Post count: 7 ✓
   All have dates: ✓
   All have times: ✓
```

## Business Types Supported

- **FSE** - Fine Service Establishment (fine dining)
- **SBO** - Specialized Beverage Outlet (generic)
- **SBO_wine** - Wine bar specific
- **SBO_coffee** - Coffee shop specific
- **SBO_cocktail** - Cocktail bar specific
- **MFV** - Multiple Format Venue
- **MFD** - Multiple per Day
- **QSR** - Quick Service Restaurant
- **FOOD_TRUCK** - Food truck
- **HYBRID** - Auto-detected from service periods

## Integration with Existing System

### Uses Existing Infrastructure
- ✅ `gemini-client.ts` - Reuses existing Gemini API client
- ✅ Gemini API key from `Deno.env.get('GEMINI_API_KEY')`
- ✅ Model: `gemini-2.5-flash` (same as brand profile)

### Compatible With
- ✅ No breaking changes to Layers 1-9
- ✅ `business_profile.target_audience` for business type
- ✅ `service_periods` array for hybrid detection
- ✅ Multi-country ready (uses country parameter)

## Phase 2 (Future)

Phase 2 will wire real data:
1. Replace mock weather with OpenWeatherMap API
2. Query `contextual_calendar` for real events
3. Calculate seasonal ingredients from DB
4. Detect economic patterns from date
5. Feed strategic priorities into Layer 5 (opportunity-selector)

## Testing Checklist

- [ ] Test with Café Faust (FSE) - ✓ Mock data ready
- [ ] Test with wine bar (SBO_wine) - ✓ Mock data ready
- [ ] Test with hybrid (coffee + wine) - ✓ Mock data ready
- [ ] Verify JSON structure validates
- [ ] Verify all 7 post ideas generated
- [ ] Verify weights sum to 1.0
- [ ] Verify dates within available_days
- [ ] Verify no invented menu items (warnings only)
- [ ] Verify narrative under 300 words
- [ ] Check Danish language quality
- [ ] Measure generation time (<5 seconds)

## Troubleshooting

### Error: "GEMINI_API_KEY not configured"
**Solution**: Set the API key in your environment or Supabase secrets

### Error: "Strategy output was not valid JSON"
**Cause**: Gemini returned non-JSON text
**Solution**: Check prompt clarity, may need to adjust temperature or add examples

### Warning: "Post-idé X refererer muligvis til ukendt menu-item"
**Cause**: AI invented a dish name not in signature_items
**Impact**: Warning only, may be generic like "Dagens suppe"
**Solution**: Review and validate AI output

### Error: "Strategiske vægte summerer til X, forventede 1.0"
**Cause**: AI didn't balance priority weights correctly
**Solution**: Retry or adjust prompt to emphasize weight constraint

## Next Steps

1. Run tests with real Gemini API key
2. Review output quality for all 3 business types
3. Adjust prompts if needed based on output
4. Document any edge cases found
5. Prepare for Phase 2 integration with real data
