# Quick Suggestions V2

**Segmentation-Driven Menu Ideas** - Simplified, focused implementation

## Overview

Quick Suggestions V2 is a complete rewrite that reduces complexity from **3,171 lines to ~580 lines** (82% reduction) by:

1. **Using segmentation data** instead of time-based heuristics
2. **Separating concerns**: Ideas only (no brand voice, no text generation)
3. **Single AI call** with thinking mode (vs 2-7 calls in v1)
4. **Eliminating repair logic** by using better AI model

## Architecture

```
get-quick-suggestions-v2/
├── index.ts           (~320 lines) Main handler & orchestration
├── segment-matcher.ts (~160 lines) Core segment selection logic
├── types.ts           (~200 lines) TypeScript interfaces
├── constants.ts       (~80 lines)  Configuration constants
└── utils.ts           (~50 lines)  Helper functions
```

**Total: ~580 lines** (vs 3,171 in v1)

## Key Differences from V1

| Feature | V1 (Current) | V2 (New) |
|---------|-------------|----------|
| **Lines of code** | 3,171 | ~580 |
| **AI calls** | 2-7 (slot planner + slots + spellcheck) | 1 (thinking mode) |
| **Time logic** | 2,100 lines of heuristics | 160 lines (segment-based) |
| **Repair logic** | 800+ lines (50% of complexity) | ~30 lines (minimal validation) |
| **Brand voice** | Embedded in function | Moved to text generation |
| **AI model** | Gemini 2.5 Flash | Gemini 2.0 Flash Thinking |
| **Thinking budget** | 0 (external repair) | 4096 tokens (internal reasoning) |

## What V2 Does

**Answers one question**: *"What from our menu should we post TODAY and WHY?"*

1. Matches current time to audience segment
2. Filters menu by segment's program
3. Asks AI: "Pick 3 items that match this audience's motivation"
4. Returns menu item + why_now + posting_angle + suggested_time

**What it doesn't do** (moved elsewhere):
- ❌ Brand voice generation → text generation function
- ❌ Atmosphere/BTS content → weekly plan
- ❌ Multi-slot coordination → single segment focus
- ❌ Extensive repair logic → better AI prevents errors

## Segment-Driven Logic

### How It Works

Segments contain all the intelligence:
```typescript
{
  name: "Weekday Breakfast Rush",
  program: "breakfast",
  timing: { days: [1,2,3,4,5], startHour: 7, endHour: 10 },
  priority: "primary",
  motivation: "Quick, energizing start before work",
  decision: "convenience-first",
  goal: "Get in and out with quality fuel",
  contentAngles: [
    "Ready when you are - quick service",
    "Power through your morning",
    "Your daily ritual, perfected"
  ]
}
```

### Edge Cases (All Handled)

**1. Pre-Opening (8:00 AM, opens 10:00)**
```typescript
selectActiveSegment() → getNextSegment()
// Returns: "Brunch Crowd" (starts 10:00)
// Prompt: "PLANNING AHEAD: Service starts at 10:00"
```

**2. Near Closing (22:45, kitchen closes 23:00)**
```typescript
isSegmentViable() → checks requiresKitchen + maxActiveTime
// Filters out food segments
// Returns: "Late Night Bar" (drinks only)
```

**3. Hybrid Overlap (14:30, both lunch & coffee active)**
```typescript
resolveSegmentConflict() → priority-based selection
// Lunch (primary) wins over Coffee (secondary)
```

## AI Configuration

**Model**: Gemini 2.0 Flash Thinking
- **Temperature**: 0.85 (creative but consistent)
- **Thinking Budget**: 4096 tokens (reasons internally)
- **Output Tokens**: 8192 max
- **Response Format**: JSON mode

**Why Thinking Mode?**
- Eliminates need for repair logic
- Better reasoning about audience fit
- More natural "why now" explanations
- Reduces hallucinations (stays on-menu)

## Data Flow

```
1. Client Request
   ↓
2. Check Cache (< 1.5h old?)
   ↓ (miss)
3. Fetch Context (parallel):
   - Business info
   - Audience segments
   - Menu items
   - Recent posts
   ↓
4. Match Segment (segment-matcher.ts)
   - Current time → active segment
   - OR pre-opening → next segment
   - OR near-closing → viable segment
   ↓
5. Filter Menu by Program
   ↓
6. Build Prompt
   - Segment context (motivation, decision, goal)
   - Content angles
   - Menu items (program-filtered)
   - Recent posts (avoid repetition)
   ↓
7. Single AI Call (Gemini Thinking)
   ↓
8. Light Validation
   - Menu item exists (fuzzy match)
   - Time format valid
   ↓
9. Save to Database
   ↓
10. Return Response
```

## API

### Request
```typescript
{
  businessId: string
  count?: number        // Default: 3
  tier?: string        // Default: 'free'
  regenerate?: boolean // Default: false
  clientTime?: string  // ISO datetime (handles timezone)
}
```

### Response
```typescript
{
  suggestions: [
    {
      menu_item_name: string
      why_now: string         // Why this item + this audience + now
      posting_angle: string   // Which content angle to use
      segment_matched: string // Which audience segment
      program: string         // breakfast/lunch/dinner/bar
      suggested_time: string  // HH:MM when to post
      context: {
        motivation: string
        decision_type: string
        goal: string
      }
    }
  ],
  cached: boolean
  segment_used: string
  generation_context?: string
}
```

## Deployment Plan

1. **Phase 1**: Deploy as `get-quick-suggestions-v2` alongside v1
2. **Phase 2**: A/B test (10% traffic to v2)
3. **Phase 3**: Monitor:
   - Response times
   - Error rates
   - User engagement with suggestions
   - Quota usage
4. **Phase 4**: Gradual rollout (25% → 50% → 100%)
5. **Phase 5**: Deprecate v1 after 30 days
6. **Phase 6**: Keep v1 as backup for emergency rollback

## Testing TODO

### Unit Tests Needed
- [ ] `segment-matcher.ts`: Pre-opening scenario
- [ ] `segment-matcher.ts`: Near-closing scenario  
- [ ] `segment-matcher.ts`: Hybrid overlap scenario
- [ ] `utils.ts`: Menu filtering by program
- [ ] `utils.ts`: Fuzzy menu item matching

### Integration Tests Needed
- [ ] Full flow with mock business
- [ ] Cache hit behavior
- [ ] Quota enforcement
- [ ] AI response parsing

### Edge Cases to Test
- [ ] Business with no segments configured
- [ ] Business with no menu items
- [ ] AI returns invalid menu item names
- [ ] AI returns invalid time formats
- [ ] Multiple regenerations hitting quota
- [ ] Timezone edge cases (clientTime)

## Configuration

### Environment Variables Required
```bash
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
```

### Database Tables Used
- `businesses` - business info, quota tracking
- `business_programme_profiles` - audience segments per programme
- `business_profile` - menu items (menu_signal)
- `published_posts` - recent post tracking
- `daily_suggestions` - output storage

## Monitoring

Key metrics to track:
- **Response time**: Should be ~2-3s (single AI call)
- **Success rate**: Aim for >95%
- **Quota usage**: Track regenerations per tier
- **Cache hit rate**: Should be ~60-70%
- **AI cost per request**: ~$0.001-0.002

## Future Enhancements

1. **Enhanced Menu Data**
   - Pull from proper menu table (not menu_signal)
   - Include descriptions, prices, dietary tags
   - Program mapping (breakfast/lunch/dinner/bar)

2. **Weather Integration**
   - Fetch weather API
   - Pass to segment matcher
   - Use in prompt context

3. **Calendar Events**
   - Pull from business calendar
   - Seasonal/special event awareness
   - Marketing hooks

4. **Kitchen Close Time**
   - Fetch from business_operations
   - Enforce in segment viability checks

5. **Smarter Recency**
   - Weight by engagement (popular items = post more)
   - Category diversity (avoid 3 coffee posts)

6. **Multi-Language**
   - Currently uses `countryToLangCode()`
   - Extend prompt building for other languages

## Notes

- **No authentication yet**: TODO - port from v1 security-audit.ts
- **Simplified menu**: Currently using menu_signal (signature items only)
- **Testing mode**: All tier limits set to 100 (change for production)
- **No weather/calendar**: Stubbed in types, not yet implemented
