# Intelligent Routing System: NEW vs OLD Extraction Paths

## Concept

Implement a quality-based gate that automatically routes websites to the optimal extraction system based on scraper quality metrics.

## Two Extraction Paths

### Path A: NEW System (Fast & Cheap)
- **Flow:** Cloud Run Scraper → Structured JSON → AI Extractors (3 parallel)
- **Speed:** 8-15 seconds
- **Cost:** ~$0.002 per business
- **Coverage:** Single-page focus
- **Best for:** Simple sites with homepage containing all info

### Path B: OLD System (Comprehensive & Expensive)
- **Flow:** Multi-page crawler → Labeled text → 7 AI Extractors (parallel)
- **Speed:** 20-40 seconds
- **Cost:** ~$0.005-0.010 per business
- **Coverage:** Deep multi-page crawling (About, Menu, Contact, etc.)
- **Best for:** Complex multi-page sites, service businesses

## Routing Decision Criteria

### Use NEW System (Default) When:
✅ Scraper quality: "good" or "excellent"  
✅ Fields found: ≥ 6 out of 8  
✅ Content length: ≥ 500 characters  
✅ Noise ratio: < 30%  
✅ Contact info: Present in scraper output  
✅ Business type: Restaurant, cafe, bar (menu-focused)  
✅ Opening hours: Detected  

### Fallback to OLD System When:
❌ Scraper quality: "poor"  
❌ Fields found: < 4  
❌ Content too short: < 300 characters  
❌ High noise ratio: > 40%  
❌ Missing critical fields: No contact info, no hours  
❌ Complex service business: Hotel, spa, multi-service venue  
❌ Menu URL exists but no content extracted  
❌ JavaScript-heavy site: Scraper can't extract text  

## Implementation Strategy

### Option 1: In Orchestrator (analyze-and-distribute-website)

```
User clicks "Analysér hjemmeside"
  ↓
Run Cloud Run Scraper
  ↓
Analyze Quality Metrics:
  - extraction.quality.rating
  - extraction.quality.fields_found
  - extraction.quality.business_text_characters
  - extraction.quality.noise_ratio
  ↓
IF quality_score > threshold:
  → Call extract-from-scrape (NEW system)
ELSE:
  → Call analyze-website (OLD multi-page crawler)
  ↓
Save results to database
```

### Option 2: Separate Intelligence Layer

```
User clicks "Analysér hjemmeside"
  ↓
Pre-check service (lightweight HEAD request)
  ↓
Predict optimal extraction path
  ↓
Route to NEW or OLD system
```

### Quality Score Calculation

```typescript
function calculateQualityScore(scraperPayload) {
  let score = 0;
  
  // Rating (0-40 points)
  if (quality.rating === 'excellent') score += 40;
  else if (quality.rating === 'good') score += 30;
  else if (quality.rating === 'fair') score += 15;
  
  // Fields found (0-30 points)
  score += (quality.fields_found / 8) * 30;
  
  // Content length (0-20 points)
  if (quality.business_text_characters > 1000) score += 20;
  else if (quality.business_text_characters > 500) score += 15;
  else if (quality.business_text_characters > 300) score += 10;
  
  // Noise ratio (0-10 points)
  if (quality.noise_ratio < 0.2) score += 10;
  else if (quality.noise_ratio < 0.4) score += 5;
  
  return score; // Max 100 points
}

// Threshold: 60+ = NEW system, <60 = OLD system
```

## Real-World Routing Examples

### → NEW System (Fast Path)
- **cafefaust.dk**: Single-page site, all info on homepage ✅
- **Simple restaurant**: Menu, hours, contact visible ✅
- **Modern SPA**: Clear structure, good content ✅
- **Score: 75-90 points**

### → OLD System (Comprehensive Path)
- **Multi-location chain**: Info spread across 10+ pages ❌
- **Hotel with complex services**: Spa, restaurant, events separate ❌
- **Poor homepage**: Scraper returns < 300 chars ❌
- **JavaScript-heavy**: Scraper can't extract text ❌
- **Score: 20-50 points**

## Benefits

### Cost Optimization
- 80-90% of sites use cheap NEW path ($0.002)
- 10-20% complex sites get expensive OLD path ($0.008)
- **Average cost drops**: From $0.005 → $0.0025 per business
- **Annual savings** (10,000 analyses): $25 → $50

### Quality Assurance
- Simple sites: Fast results with good accuracy
- Complex sites: Thorough extraction guaranteed
- No "one size fits all" compromise
- Automatic quality improvement

### User Experience
- **Fast for most cases**: 8-15 seconds
- **Accurate for all cases**: Fallback ensures coverage
- **Transparent**: User doesn't need to choose
- **Adaptive**: System learns optimal routing

## Key Metrics to Monitor

After implementing gate:
1. **Routing Split**: % using NEW vs OLD (target: 80/20)
2. **Quality Improvement**: Does fallback improve poor scrapes?
3. **Cost Savings**: Average cost per extraction
4. **User Satisfaction**: Field completeness by path
5. **Failure Rate**: How often does NEW path fail?
6. **Override Rate**: How often do we need fallback?

## Implementation Phases

### Phase 1: Metrics Collection (Week 1-2)
- Run both systems in parallel
- Collect quality scores
- Identify routing patterns
- No actual routing yet

### Phase 2: Conservative Routing (Week 3-4)
- Implement gate with low threshold (score < 40)
- Only route worst cases to OLD system
- Monitor results closely
- Adjust threshold based on data

### Phase 3: Optimized Routing (Week 5-6)
- Adjust threshold to optimal point (score < 60)
- Route 10-20% to OLD system
- Maximize cost savings
- Ensure quality maintained

### Phase 4: Machine Learning (Future)
- Train model on routing decisions
- Predict optimal path before scraping
- Learn business type patterns
- Continuous improvement

## Technical Considerations

### Caching Strategy
- Cache scraper results (24h TTL)
- Cache routing decisions with scrape
- Don't re-scrape for route changes
- Allow manual override (force OLD path)

### Fallback Logic
- NEW fails → Auto-retry with OLD
- OLD fails → Surface error to user
- Timeout handling: 30s NEW, 60s OLD
- Partial results: Save what we have

### Testing Strategy
- A/B test routing thresholds
- Compare field completeness by path
- Track user satisfaction scores
- Monitor cost per business type

## Open Questions

1. **Threshold tuning**: What's optimal quality score cutoff?
2. **Business type weights**: Should hotels always use OLD?
3. **User override**: Allow manual path selection?
4. **Retry logic**: How many attempts before fallback?
5. **Cost limits**: Cap daily OLD system usage?

## Decision: When to Implement?

**Wait to see refactored NEW system performance first:**
- Current refactor uses OLD extractors in NEW system
- Should combine best of both worlds
- If quality issues persist → implement routing
- If quality good → routing may be unnecessary

**Triggers for implementation:**
- >20% of extractions have poor quality
- User complaints about missing fields
- Complex sites consistently fail
- Cost becomes significant concern

## Status: FUTURE CONSIDERATION

This routing system is **not currently needed**. The refactored extraction system (NEW scraper + OLD AI extractors) should handle most cases well. 

**Revisit if:**
- Quality issues persist after refactor
- Cost becomes a concern at scale
- We identify clear failure patterns
- User feedback indicates need for deeper crawling

---

**Created:** 2026-07-17  
**Author:** System Architecture Analysis  
**Priority:** Low (Future Enhancement)  
**Dependencies:** Refactored extraction system must be stable first
