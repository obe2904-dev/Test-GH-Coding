# Robust Menu Extraction System — Implementation Plan

**Date:** 2026-07-18  
**Status:** Planning Phase  
**Target:** Increase menu extraction success rate from ~60% to 90%+

---

## Executive Summary

**Current Problem:**  
Menu extraction works perfectly for WordPress sites (cafefaust.dk) but fails for most other platforms (Umbraco Heartcore, Wix, Webflow, Contentful, etc.) because the system uses a single extraction strategy optimized for WordPress HTML structure.

**Solution:**  
Implement a **cascading strategy pattern** where each menu URL attempts multiple extraction strategies in order of reliability, with automatic fallback if a strategy fails. Sequential queue processing is maintained — one menu at a time, but each menu can try multiple methods before giving up.

**Expected Outcome:**  
- Success rate: 60% → 90%+
- Manual review rate: <10%
- Average extraction time: <30 seconds
- Zero regression for existing WordPress extractions

---

## Problem Analysis

### What Works Today

✅ **WordPress sites** (e.g., cafefaust.dk):
- Server-rendered HTML with semantic markup
- Standard `<ul>`, `<li>`, `<p>` tags
- WordPress gallery widgets with `wPT_` image patterns
- Consistent link structures
- All content visible in initial HTML response
- **Success rate: ~95%**

### What Fails Today

❌ **Umbraco Heartcore** (e.g., soukaarhus.dk):
- React SPA with async data fetching
- Menu data comes from API as JSON
- Content rendered client-side after hydration
- Non-semantic div soup markup
- 12-second wait often insufficient
- **Success rate: ~20%**

❌ **Wix Sites**:
- Proprietary framework with client-side rendering
- Menu stored in `window.wixData` or fetched via API
- 8-second wait insufficient for full load
- Heavily nested div structure with no semantic tags
- **Success rate: ~30%**

❌ **Webflow**:
- Design-focused CMS with custom data attributes
- Often renders progressively in stages
- Clean output but non-standard structure
- **Success rate: ~50%**

❌ **Squarespace**:
- Mostly server-rendered but with JS enhancements
- Current method partially works
- **Success rate: ~65%**

### Root Causes

1. **Single extraction strategy** — HTML→Text→OpenAI optimized for WordPress
2. **Fixed hydration timeouts** — doesn't adapt to platform needs
3. **Semantic HTML assumptions** — modern frameworks use divs for everything
4. **No API interception** — headless CMS data never captured
5. **No fallback on failure** — one attempt and done
6. **Platform detection unused** — we detect but don't act on it

---

## Architectural Solution

### Core Principle: Cascading Strategy Pattern

Replace single extraction path with **tiered fallback system**:

```
URL received
  ↓
Detect platform (Cloud Run)
  ↓
Select strategy array based on platform
  ↓
Try Strategy #1 (platform-specific, high confidence)
  ↓ FAIL
Try Strategy #2 (generic enhanced, medium confidence)
  ↓ FAIL
Try Strategy #3 (minimal fallback, low confidence)
  ↓ FAIL
Mark for manual review (preserve data for analysis)
```

### Strategy Tiers

#### **Tier 1: Direct Structured Data** (95%+ success)
- **PDF Files** → OCR extraction (✅ already works)
- **Image Files** → Google Vision OCR (✅ already works)
- **API Interception** → Capture JSON from headless CMS (🆕 new)

#### **Tier 2: Platform-Specific HTML** (85%+ success)
- **WordPress** → Current method (✅ keep as-is)
- **Umbraco Heartcore** → 18s hydration + API intercept + React parsing (🆕 new)
- **Wix** → 12s hydration + wixData extraction + data attributes (🆕 new)
- **Webflow** → 8s hydration + data-wf-* attributes (🆕 new)
- **Squarespace** → Current method (✅ mostly works)

#### **Tier 3: Generic Fallback** (70%+ success)
- **Content Stability** → Wait for DOM to stop changing (🆕 new)
- **Data Attribute Mining** → Extract from data-* patterns (🆕 new)
- **Aggressive Text Extraction** → Skip deduplication, let AI parse (🆕 new)

#### **Tier 4: Minimal Parsing** (40-50% success)
- **Raw Text Dump** → Strip tags, send everything to OpenAI (🆕 new)
- Use GPT-4o-mini (cheaper) for cost control

#### **Tier 5: Manual Review**
- Store raw HTML + strategy logs
- Surface in admin UI
- Learn from manual reviews to improve strategies

---

## Enhanced Queue System

### Current Behavior
```
Queue: [menu1, menu2, menu3]
Process menu1 → done → process menu2 → done → process menu3
```

### Enhanced Behavior
```
Queue with strategy tracking:
[
  { sourceId: 'abc', url: 'menu1', strategies: ['wordpress', 'generic', 'minimal'], attempts: 0 },
  { sourceId: 'def', url: 'menu2', strategies: ['umbraco', 'generic', 'minimal'], attempts: 0 },
  { sourceId: 'ghi', url: 'menu3', strategies: ['wix', 'generic', 'minimal'], attempts: 0 }
]

Processing loop:
1. Take first item from queue
2. Try first remaining strategy
3. If SUCCESS:
   - Remove from queue
   - Save result with confidence score
4. If FAIL:
   - Remove used strategy from list
   - Log attempt
   - If strategies remain: move to END of queue (circular retry)
   - If no strategies left: mark manual_review_needed
5. Move to next item in queue
```

### Key Benefits
- ✅ Sequential processing maintained (one at a time)
- ✅ No infinite loops (fixed strategy list per URL)
- ✅ Other menus don't wait (failed menu goes to back)
- ✅ Automatic retry (no user intervention)
- ✅ Graceful degradation (progressively easier strategies)

---

## Strategy Selection Logic

```
Platform Detection (Cloud Run) → Strategy Array Selection:

if (contentType === 'pdf')
  → ['pdf_ocr']

else if (contentType === 'image')
  → ['image_ocr']

else if (platform === 'wordpress')
  → ['wordpress', 'generic_enhanced', 'minimal']

else if (platform === 'umbraco_heartcore')
  → ['umbraco_heartcore', 'content_stability', 'generic_enhanced', 'minimal']

else if (platform === 'wix')
  → ['wix', 'content_stability', 'data_attribute_mining', 'minimal']

else if (platform === 'webflow')
  → ['webflow', 'generic_enhanced', 'minimal']

else if (platform === 'squarespace')
  → ['squarespace', 'generic_enhanced', 'minimal']

else // unknown platform
  → ['content_stability', 'data_attribute_mining', 'generic_enhanced', 'minimal']
```

---

## Database Schema Changes

### No Changes To:
- ✅ `menu_sources` (already perfect)
- ✅ `menu_items_normalized` (already perfect)
- ✅ `structured_data` JSON format (categories→items)
- ✅ Data flow between tables (FKs, relationships)

### Enhancements to menu_results_v2 Only:

```sql
-- Add strategy tracking columns (nullable for backward compatibility)
ALTER TABLE menu_results_v2 
ADD COLUMN platform_detected TEXT,           -- 'wordpress', 'umbraco_heartcore', 'wix', etc.
ADD COLUMN strategy_used TEXT,               -- which strategy succeeded
ADD COLUMN confidence_score DECIMAL(3,2),    -- 0.00-1.00 extraction confidence
ADD COLUMN extraction_attempts JSONB;        -- fallback history log

-- Example extraction_attempts value:
{
  "attempts": [
    {
      "strategy": "umbraco_heartcore",
      "success": false,
      "error": "Hydration timeout - content still loading",
      "timestamp": "2026-07-18T14:23:45Z",
      "duration_ms": 18400
    },
    {
      "strategy": "content_stability",
      "success": true,
      "confidence": 0.82,
      "timestamp": "2026-07-18T14:24:15Z",
      "duration_ms": 22100
    }
  ]
}
```

### Backward Compatibility
- ✅ All new columns nullable
- ✅ Old extractions still work
- ✅ Frontend doesn't break if columns missing
- ✅ No migration required for existing data

---

## Data Flow

### Current Flow (Unchanged)
```
User clicks "Importer (X) valgte"
  ↓
1. Insert into menu_sources
   - business_id, source_url, status: 'pending'
   - label, menu_type, source_origin: 'ai_detected'
  ↓
2. Create job in menu_results_v2
   - business_id, source_id (FK to menu_sources)
   - status: 'queued' → 'processing' → 'done' / 'error'
  ↓
3. menu-extract-v2 Edge Function processes
   - Fetches URL via Cloud Run scraper
   - Extracts structured_data (JSON)
   - Saves ai_summary, service_periods
  ↓
4. menu-sync flattens to menu_items_normalized
   - Reads structured_data.categories[].items[]
   - Creates one row per menu item
   - Auto-triggered on menu_results_v2 insert
```

### Enhanced Flow (New)
```
User clicks "Importer (X) valgte"
  ↓
1. Insert into menu_sources (unchanged)
  ↓
2. Create job in menu_results_v2 (unchanged)
  ↓
3. menu-extract-v2 Edge Function processes:
   ↓
   A. Fetch URL via Cloud Run
      → Cloud Run returns: HTML + platform_detected + isSPA
   ↓
   B. StrategySelector.getStrategies(platform)
      → Returns: ['strategy1', 'strategy2', 'strategy3']
   ↓
   C. For each strategy:
      ├─ Execute strategy.extract(html, url, platform)
      ├─ If success + confidence ≥ 0.7:
      │  └─ Save structured_data
      │  └─ Save platform_detected, strategy_used, confidence_score
      │  └─ Save extraction_attempts log
      │  └─ EXIT (success)
      │
      └─ If fail:
         └─ Log attempt in extraction_attempts
         └─ Continue to next strategy
   ↓
   D. All strategies failed:
      └─ Mark status: 'manual_review_needed'
      └─ Save extraction_attempts with all failures
  ↓
4. menu-sync flattens to menu_items_normalized (unchanged)
```

---

## Implementation Phases

### Phase 1: Infrastructure (3-4 hours)
**Goal:** Add strategy pattern framework without changing behavior

**Tasks:**
1. Add `platform_detected`, `strategy_used`, `confidence_score`, `extraction_attempts` columns to menu_results_v2
2. Update Cloud Run `/scrape-v3` to include platform metadata in response
3. Create `ExtractionResult` interface for strategy responses
4. Create `StrategySelector` class for platform → strategy mapping
5. Extract current extraction logic into `WordPressStrategy` class
6. Test with cafefaust.dk — verify zero regression

**Success Criteria:**
- ✅ No changes to existing WordPress extraction behavior
- ✅ Database columns added successfully
- ✅ Infrastructure deployed without errors

### Phase 2: Fallback System (4-5 hours)
**Goal:** Implement strategy cascade with one strategy (WordPress)

**Tasks:**
1. Refactor `menu-extract-v2/index.ts` to loop through strategies
2. Implement attempt logging to `extraction_attempts` column
3. Add confidence threshold check (≥0.7 to accept)
4. Update frontend MenuPage.tsx to handle `manual_review_needed` status
5. Add progress messages: "Retrying with fallback strategy..."
6. Test deliberately failing WordPress extraction → verify fallback triggered

**Success Criteria:**
- ✅ Fallback loop executes correctly
- ✅ Attempts logged to database
- ✅ Frontend shows retry messages
- ✅ WordPress still works on first attempt

### Phase 3A: Umbraco Heartcore Strategy (6-8 hours)
**Goal:** Handle React SPAs with API interception

**Tasks:**
1. Extend Cloud Run hydration timeout to 18s for Umbraco
2. Add Puppeteer `page.on('response')` listener to capture API calls
3. Check for `umbraco` + `api` in response URLs
4. Store API JSON responses in scraper response
5. Create `UmbracoHeartcoreStrategy` class:
   - Check if API data available → extract from JSON directly
   - Fallback to React component parsing (data attributes)
6. Test with soukaarhus.dk

**Success Criteria:**
- ✅ soukaarhus.dk extracts successfully
- ✅ Menu data captured from API or parsed from DOM
- ✅ Confidence score ≥0.7

### Phase 3B: Wix Strategy (6-8 hours)
**Goal:** Handle Wix proprietary framework

**Tasks:**
1. Extend Cloud Run hydration to 12s for Wix
2. Add `window.wixData` extraction in Cloud Run
3. Parse `/_api/wix-restaurants-menus` API responses
4. Create `WixStrategy` class:
   - Check window.wixData → extract
   - Check API responses → extract
   - Fallback to data attribute mining
5. Test with Wix demo sites

**Success Criteria:**
- ✅ Wix demo site extracts successfully
- ✅ Confidence score ≥0.7

### Phase 3C: Content Stability Strategy (4-5 hours)
**Goal:** Generic SPA handler for unknown platforms

**Tasks:**
1. Add DOM mutation observer in Cloud Run
2. Monitor `MutationObserver` events
3. Mark stable when: no mutations for 2 seconds
4. Max timeout: 25 seconds
5. Create `ContentStabilityStrategy` class
6. Use for all unknown platforms + as fallback

**Success Criteria:**
- ✅ Unknown SPA waits for content to stabilize
- ✅ Doesn't hang on slow sites (25s max)
- ✅ Confidence score ≥0.6

### Phase 4: Data Mining & Minimal Fallback (4-5 hours)
**Goal:** Extract value from "difficult" sites

**Tasks:**
1. Create `DataAttributeMiningStrategy`:
   - Search for `[data-price]`, `[data-name]`, `[data-description]`
   - Build structured data from attributes
2. Create `MinimalParsingStrategy`:
   - Strip all deduplication rules
   - Send everything to OpenAI
   - Use GPT-4o-mini (cheaper)
   - Accept confidence ≥0.5
3. Add manual review UI in MenuPage.tsx:
   - Show `extraction_attempts` history
   - Display raw HTML for inspection
   - Button to retry with specific strategy

**Success Criteria:**
- ✅ Overall success rate ≥90%
- ✅ Manual review rate <10%
- ✅ Cost per extraction <$0.05

---

## Error Handling & Safety

### Prevent Infinite Loops
- ✅ Max 4 strategies per URL (hard limit)
- ✅ Each strategy attempts ONCE per queue cycle
- ✅ 90-second timeout per strategy attempt
- ✅ Total max time per URL: 6 minutes (4 × 90s)

### Queue Starvation Prevention
- ✅ Failed items move to END of queue (circular)
- ✅ Other URLs process while one retries
- ✅ After all strategies exhausted → remove from queue

### Database Conflict Prevention
- ✅ Queue processor already sequential
- ✅ No concurrent writes to same source_id

### Cost Control
- ✅ Primary strategies: GPT-4o (accurate, expensive)
- ✅ Fallback strategies: GPT-4o-mini (cheaper)
- ✅ Rule-based strategies: $0 (data attribute mining)
- ✅ Estimated cost: $0.02-0.04 per extraction

### User Communication
Show detailed progress in UI:
```
⏳ Extracting menu... (WordPress strategy)
⚠️ Primary extraction failed, trying enhanced generic strategy...
⏳ Retrying with content stability detection (may take longer)...
✅ Extracted successfully using generic strategy (78% confidence)
```

Or on failure:
```
❌ Extraction failed after 3 attempts
📋 Marked for manual review
🔍 View extraction logs
```

---

## Success Metrics

### Phase 1: Infrastructure
- ✅ Zero regression in WordPress extractions
- ✅ New columns added to database
- ✅ Cloud Run returns platform metadata

### Phase 2: Fallback System
- ✅ Strategy cascade executes correctly
- ✅ Attempts logged to database
- ✅ Frontend shows progress messages

### Phase 3: Platform Strategies
- ✅ Umbraco Heartcore: soukaarhus.dk succeeds
- ✅ Wix: Demo sites succeed
- ✅ Content Stability: Unknown SPAs succeed
- ✅ Overall success rate: 75%+ (up from 60%)

### Phase 4: Complete System
- ✅ Overall success rate: 90%+
- ✅ Manual review rate: <10%
- ✅ Average extraction time: <30 seconds
- ✅ Cost per extraction: <$0.05

---

## Timeline Estimate

| Phase | Tasks | Hours |
|-------|-------|-------|
| **Phase 1** | Infrastructure | 3-4 |
| **Phase 2** | Fallback system | 4-5 |
| **Phase 3A** | Umbraco Heartcore | 6-8 |
| **Phase 3B** | Wix strategy | 6-8 |
| **Phase 3C** | Content stability | 4-5 |
| **Phase 4** | Data mining + minimal | 4-5 |
| **Total** | | **27-35 hours** |

### Quick Win Path (80% solution)
Phases 1-2 + 3C = **~12-14 hours**
- Adds infrastructure + fallback system
- Adds content stability for SPAs
- Solves most Umbraco/unknown SPA issues
- Achieves ~75-80% success rate

### Full Solution (90% solution)
All phases = **~27-35 hours**
- Platform-specific strategies
- Data attribute mining
- Minimal fallback
- Achieves ~90% success rate

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Longer processing time** | User confusion | Show detailed progress messages |
| **Increased AI costs** | Budget overrun | Use GPT-4o-mini for fallbacks |
| **Breaking existing extractions** | Production outage | Phase 1 keeps all current code |
| **Queue getting stuck** | Poor UX | Max strategies, timeouts per attempt |
| **API interception overhead** | Slower scraping | Only for identified headless CMS |

---

## Testing Plan

### Regression Tests (Phase 1-2)
- ✅ cafefaust.dk extracts successfully (WordPress baseline)
- ✅ Existing menus in database still load correctly
- ✅ Frontend shows correct status messages

### Integration Tests (Phase 3-4)
- ✅ soukaarhus.dk (Umbraco Heartcore)
- ✅ Wix demo sites
- ✅ Unknown SPA with slow loading
- ✅ PDF menu (existing functionality)
- ✅ Image menu (existing functionality)

### Failure Tests
- ✅ Invalid URL → error handling
- ✅ All strategies fail → manual review status
- ✅ Timeout during strategy → next strategy attempted
- ✅ Network error → graceful failure

---

## Next Steps

1. **Review and approve this plan**
2. **Set up test URLs** for each platform
3. **Begin Phase 1** — Infrastructure (non-breaking)
4. **Test Phase 1** with cafefaust.dk (verify zero regression)
5. **Continue to Phase 2** — Fallback system
6. **Iterate through Phases 3-4** based on priority

---

## Appendix: Current vs. Future Architecture

### Current (Single Strategy)
```
URL → Cloud Run → HTML → HTML→Text → cleanHtml → OpenAI → Result
                                                      ↓ FAIL
                                                    Give Up
```

### Future (Cascading Strategies)
```
URL → Cloud Run → HTML + Platform Metadata
                      ↓
              StrategySelector
                      ↓
         Try Strategy #1 (platform-specific)
                      ↓ FAIL
         Try Strategy #2 (generic enhanced)
                      ↓ FAIL
         Try Strategy #3 (minimal fallback)
                      ↓ FAIL
              Manual Review Queue
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-18  
**Author:** System Architecture Team  
**Status:** Ready for Implementation
