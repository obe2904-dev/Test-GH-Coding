# Quick Suggestions V2 - Deployment Summary

## ✅ Completed (January 2025)

### Core Functionality
- **Segmentation-driven architecture**: Replaced 3,171-line monolithic function with ~580-line modular system
- **Single AI call**: Migrated from 2-7 Gemini calls to 1 call using Gemini 2.5 Flash
- **Time-based constraints**: 
  - 6+ hours → max 3 ideas
  - 3-6 hours → max 2 ideas  
  - 1-3 hours → max 1 idea
  - <1 hour → refuse with helpful message
- **3-Tier menu filtering**: Prevents AI from inventing dishes
  - Tier 1: Items not used in last 7 days (if ≥2 available)
  - Tier 2: Items not used in last 3 days (if ≥2 available)
  - Tier 3: All items, ranked oldest-first
- **Recency tracking**: 14-day lookback across published_posts + daily_suggestions
- **Real service period detection**: Queries `business_programme_profiles` for dynamic hours
  - Parses `programme_name`, `programme_type`, `time_windows`, `operating_days`
  - Calculates actual close time from latest service end
  - Provides rich context to AI (e.g., "FROKOST (11:00-17:30) • AFTEN (17:30-23:00)")
- **Danish day parsing**: Handles "Mandag-Fredag 12:00-14:00" timing windows correctly (segment matching)

### Testing Results
✅ **Test 1 (Early morning)**: 12:00 local → allowed 3 ideas, tier 3 filtering
✅ **Test 2 (Late afternoon)**: 20:00 local → allowed 2 ideas, tier 3 filtering  
✅ **Test 3 (Near closing)**: 23:30 local → allowed 1 idea, smart "last call" strategy
✅ **Test 4 (Service periods)**: AI correctly references "FROKOST", "MENUKORT", "AFTEN" from database
✅ **Test 5 (Close time)**: Hours remaining accurately calculated from latest service end time
✅ **No invented dishes**: All suggestions matched actual menu items
✅ **Reasonable timing**: AI suggested appropriate post times based on hours remaining

### Architecture
```
Hard Constraints (Pre-filter):
  ↓ Time boundaries (hours remaining calculation)
  ↓ Tiered menu filtering (7d/3d/all with recency map)
  ↓ Language filtering (Danish menus only)

Rich Context (Facts passed to AI):
  ↓ Business info (name, vertical, country)
  ↓ Current time + day of week
  ↓ Hours remaining until close
  ↓ Service periods (today only)
  ↓ Pre-filtered menu
  ↓ Recent history (what to avoid or prioritize)
  ↓ Weather context (TODO)
  ↓ Outdoor seating status (TODO)

AI Reasoning (Single call):
  ↓ Choose 1-maxIdeas items
  ↓ Determine strategic timing
  ↓ Explain relevance
  → Return JSON with suggestions
```

## 🔄 Partially Complete

### Service Period Detection ✅ COMPLETED
**Status**: Fully implemented and tested  
**Implementation**: Queries `business_programme_profiles` for:
- `programme_name`, `programme_type` (e.g., "FROKOST", "lunch")
- `time_windows` (e.g., ["11:00:00-17:30:00"])
- `operating_days` (e.g., ["monday", "tuesday", ...])

**Features**:
- Day-aware filtering (only shows programmes for current day)
- Dynamic close time calculation (finds latest end time)
- Rich AI context (e.g., "FROKOST (11:00-17:30) • AFTEN (17:30-23:00)")
- Handles overlapping service periods
- See [SERVICE_PERIODS_UPDATE.md](./SERVICE_PERIODS_UPDATE.md) for details

### Weather Integration (Not Implemented)
**Needed**: 
- Fetch hourly forecast for today until close
- Implement 4-tier outdoor suitability:
  - Perfect: ≥20°C + sunny
  - Good: 15-19°C + partly cloudy
  - Acceptable: With heaters/umbrellas
  - Indoor: <15°C or rain
- Pass to AI as context (not rules)

**Implementation Approach**:
```typescript
// Only fetch if has_outdoor_seating = true
if (business.has_outdoor_seating) {
  const weather = await fetchWeatherForToday(lat, lon, closeHour)
  const suitability = evaluateOutdoorSuitability(weather, business)
  weatherContext = formatWeatherContext(suitability)
}
```

### Outdoor Seating Field (Not in DB)
**Needed**: Add `has_outdoor_seating` boolean to `businesses` table  
**Impact**: Determines whether to fetch/evaluate weather

## 📋 Testing Checklist

### Implemented ✅
- [x] Early morning (full day) → 3 ideas
- [x] Mid-service (limited time) → 1-2 ideas  
- [x] Near closing → 1 idea with "last call" strategy
- [x] Menu boundary validation (no invented dishes)
- [x] Tiered filtering (all items recently used)

### Not Yet Tested
- [ ] After closing → refusal message
- [ ] Tier 1 filtering (7d threshold with fresh items available)
- [ ] Tier 2 filtering (3d threshold)
- [ ] Sunny + outdoor seating → outdoor angles
- [ ] Rainy + no outdoor → warm refuge messaging
- [ ] Language filter (non-Danish menus filtered out)
- [ ] Cache behavior (return cached suggestions when < 6hrs old)

## 🎯 Philosophy: "Constraints + Context + Creativity"

### What We Learned
1. **Over-engineering relocates complexity**: Adding repair logic, fallbacks, and orchestration doesn't reduce complexity—it moves it
2. **Better model > more code**: Gemini 2.5 Flash with simple prompt eliminates need for 6 helper calls
3. **Trust AI reasoning**: Pass weather as facts, not rules. AI knows "sunny + outdoor seating = patio vibes"
4. **User's data > generic heuristics**: Segmentation timing windows are smarter than hardcoded "lunch = 11-14" rules
5. **Hard constraints prevent hallucinations**: Pre-filtering menu is more reliable than asking AI not to invent dishes

### Design Principles
- **Pre-filter aggressively**: Time boundaries, menu boundaries, language filtering
- **Context richly**: Pass all facts AI needs to make good decisions  
- **Trust judgment**: Let AI decide timing strategy, not endless IF-THEN rules
- **Fail explicitly**: Refuse when constraints violated (too late, no menu, etc.)

## 📊 Performance Metrics

### Before (V1)
- Lines of code: 3,171
- AI calls: 2-7 (orchestrated with helpers)
- Debugging difficulty: Extreme (variable scope issues, feature creep)
- Menu hallucinations: Common (AI invented dishes)
- Time-based logic: None

### After (V2)
- Lines of code: ~580 (main + utils + types)
- AI calls: 1 (single Gemini 2.5 Flash)
- Debugging difficulty: Low (modular, typed, testable)
- Menu hallucinations: Zero (3-tier pre-filtering)
- Time-based logic: Smart (6/3/1 hour thresholds)

## 🚀 Next Steps (Priority Order)

1. **Add `has_outdoor_seating` to `businesses` table** (optional)
   - Run migration to add boolean field
   - Update business onboarding to capture this
   - Conditionally fetch/evaluate weather based on this flag

2. **Add weather integration** (optional, nice-to-have)
   - Fetch hourly forecast for today
   - Evaluate outdoor suitability (4 tiers)
   - Pass as context to AI
   - Only fetch when has_outdoor_seating = true

3. **Full testing suite**
   - Test all 7 scenarios from IMPLEMENTATION_PLAN
   - Validate tier transitions (1→2→3 as items get used)
   - Test cache behavior
   - Test language filtering
   - Test different service period configurations

4. **Monitor in production**
   - Watch for AI-invented dishes (should be zero)
   - Check tier distribution (expect more Tier 1/2 in production)
   - Validate timing appropriateness
   - Verify service period context is helpful
   - Collect user feedback

5. **Performance optimization** (if needed)
   - Add indices on frequently queried columns
   - Consider caching service period data
   - Monitor AI response times

## 📝 Notes

### Why Tier 3 in Tests?
Tests show "Tier 3 (all)" because:
- Test database has limited recent posts/suggestions
- Most/all menu items have been used recently
- System correctly falls back to Tier 3 and ranks by oldest-first

In production with real usage:
- More items unused in last 7 days → Tier 1 more common
- Better freshness distribution
- Tier 3 only when menu rotation is very aggressive

### Why Simple Time Logic?
Original plan had complex service period matching. Simplified to:
- **6+ hours**: Full flexibility → 3 ideas
- **3-6 hours**: Limited window → 2 ideas  
- **1-3 hours**: Last push → 1 idea
- **<1 hour**: Too late → refuse

This works because:
- AI handles timing strategy (not us)
- User gets flexibility when time allows
- Hard constraints prevent bad UX (posting after close)

### Why Trust AI?
Instead of encoding rules like:
```
IF sunny AND outdoor AND lunch THEN "patio" angle
IF rainy AND dinner AND cold THEN "cozy refuge" angle
```

We pass context and let AI reason:
```
Weather: 22°C, sunny. Outdoor seating: Available
→ AI: "Suggest Caesar Salad at 12:30 with angle about sunny patio lunch"
```

This scales better and handles edge cases we didn't think of.

## 🐛 Known Issues

### Fixed in Clean Rebuild
- ✅ "menu is not defined" errors (variable scope)
- ✅ Duplicate recencyMap building
- ✅ Tiered filtering causing initialization order issues
- ✅ Hardcoded close time - now uses real service period data

### Outstanding
- ⚠️ No weather integration - optional enhancement
- ⚠️ No outdoor seating field in DB - needs migration (optional)

## 📖 Related Documentation
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Full architecture & testing plan
- [types.ts](./types.ts) - TypeScript interfaces
- [constants.ts](./constants.ts) - Configuration values
- [utils.ts](./utils.ts) - Helper functions
- [segment-matcher.ts](./segment-matcher.ts) - Timing window parser

---

**Status**: ✅ Core functionality deployed and tested, service periods fully implemented  
**Last Updated**: January 2025  
**Deployed Version**: Clean rebuild with real service period detection  
**Previous Version**: Backed up to index-broken.ts

**Remaining TODOs**: Weather integration (optional), outdoor seating field (optional)
