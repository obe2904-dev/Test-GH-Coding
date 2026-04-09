# Layer 2: Strategic Baselines - Assessment & Implementation

## Executive Summary

**Overall Status:** 80% Complete ✅

**Strengths:**
- Brand Profile system is mature and production-ready
- Content pillars and messaging hooks well-defined
- Target audience personas implemented
- Business type defaults now formalized (Layer 1 output)

**Critical Gap:**
- ❌ **NO PERFORMANCE TRACKING SYSTEM** - This is the biggest missing piece
- ❌ **NO HISTORICAL BASELINE** - Can't optimize without past performance data
- ❌ **NO LEARNING LOOP** - System can't improve based on results

---

## Layer 2 Components Assessment

### 1. Brand Strategy Baselines ✅

#### Status: 95% Complete - EXCELLENT

**What You Have:**

✅ **Brand Profile System** ([`brand_profile` table](supabase/migrations/20260117000000_brand_strategy_model.sql))
- Brand essence
- Tone of voice  
- Core offerings
- Things to avoid
- Content pillars
- Messaging hooks
- Target audience (primary + seasonal)

✅ **Brand Strategy Model**
- `target_audience_primary` - Max 2 primary audiences
- `target_audience_seasonal` - Additive seasonal modifiers
- `content_pillars` - Core content themes
- `messaging_hooks` - Behavioral drivers

**Database Structure:**
```sql
-- business_brand_profile
- brand_essence TEXT
- tone_of_voice TEXT  
- core_offerings TEXT[]
- things_to_avoid TEXT[]
- content_pillars JSONB
- messaging_hooks JSONB
- target_audience_primary TEXT[] (max 2)
- target_audience_seasonal JSONB
```

**Source Quality:** ⭐⭐⭐⭐⭐ Production-ready

---

### 2. Content Type Distribution Ratios ✅

#### Status: 100% Complete - NEW

**What You Have:**

✅ **Business Type Defaults** (Created in Layer 1)
- [`business_type_defaults` table](supabase/migrations/20260128000000_expand_business_types.sql)
- Ratios per business type (FSE, SBO, MFV, MFD, QSR)

**Ratios Example (FSE):**
```
menu_highlight_ratio: 0.35 (35%)
location_story_ratio: 0.20 (20%)
behind_scenes_ratio: 0.15 (15%)
event_promotion_ratio: 0.20 (20%)
engagement_ratio: 0.10 (10%)
```

**Platform Weights:**
```
FSE: Instagram 50% / Facebook 50%
SBO: Instagram 70% / Facebook 30%
MFV: Instagram 65% / Facebook 35%
```

**This provides the strategic baseline for content distribution.**

---

### 3. Performance Baselines ❌

#### Status: 0% Complete - CRITICAL GAP

**What You're Missing:**

❌ **No Performance Tracking Table**
- No historical post performance data
- No engagement metrics (likes, comments, shares, saves)
- No reach/impression tracking
- No click-through rate data
- No conversion tracking

❌ **No Baseline Metrics**
- Don't know what "good" engagement looks like for this business
- Can't compare new posts to historical performance
- Can't identify winning content patterns
- Can't learn what works

❌ **No Learning Loop**
- System generates content blindly
- No feedback from real-world results
- No optimization based on performance
- No A/B testing capability

**What Layer 2 Needs:**

```sql
-- Content Performance Tracking
CREATE TABLE content_performance_log (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  
  -- Content identification
  post_idea_id UUID REFERENCES post_ideas(id),
  content_type TEXT,  -- 'menu_highlight', 'location_story', etc.
  content_pillar TEXT,  -- From brand profile
  
  -- Context
  posted_at TIMESTAMPTZ,
  platform TEXT,  -- 'instagram', 'facebook'
  post_time TIME,
  post_day_of_week INTEGER,
  
  -- Performance metrics
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_total INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  
  -- Calculated metrics
  engagement_rate DECIMAL(5,2),  -- (engagement / reach) * 100
  click_through_rate DECIMAL(5,2),  -- (clicks / impressions) * 100
  
  -- Learning signals
  content_tags TEXT[],  -- ['brunch', 'outdoor', 'family']
  calendar_event_id UUID,  -- If tied to contextual calendar
  weather_condition TEXT,  -- 'sunny', 'rainy', 'cold'
  
  -- Quality indicators
  was_ai_generated BOOLEAN DEFAULT TRUE,
  user_edited BOOLEAN DEFAULT FALSE,
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Baseline Performance by Content Type
CREATE TABLE content_type_baselines (
  business_id UUID PRIMARY KEY REFERENCES businesses(id),
  
  -- Per content type baselines
  baselines JSONB DEFAULT '{}'::jsonb,
  -- Format:
  -- {
  --   "menu_highlight": {
  --     "avg_engagement_rate": 3.2,
  --     "avg_reach": 1200,
  --     "sample_size": 45,
  --     "best_time": "10:30",
  --     "best_day": 5
  --   },
  --   "location_story": { ... }
  -- }
  
  -- Platform-specific baselines
  platform_baselines JSONB DEFAULT '{}'::jsonb,
  -- Format:
  -- {
  --   "instagram": {
  --     "avg_engagement_rate": 4.1,
  --     "best_posting_times": ["09:00", "13:00", "18:00"]
  --   },
  --   "facebook": { ... }
  -- }
  
  -- Overall business baseline
  overall_avg_engagement_rate DECIMAL(5,2),
  overall_avg_reach INTEGER,
  total_posts_analyzed INTEGER DEFAULT 0,
  
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4. Posting Frequency Baselines ✅

#### Status: 100% Complete - NEW

**What You Have:**

✅ **Frequency Defaults per Business Type**
```
FSE: 3-5 posts/week (ideal: 4)
SBO: 3-6 posts/week (ideal: 4)
MFV: 5-8 posts/week (ideal: 6)
MFD: 2-3 posts/week (ideal: 2)
QSR: 3-5 posts/week (ideal: 4)
```

**This provides the strategic baseline for posting volume.**

---

### 5. Content Style Defaults ✅

#### Status: 100% Complete - NEW

**What You Have:**

✅ **Style Defaults per Business Type**
```
FSE: Refined tone, minimal emoji, medium captions
SBO: Casual tone, moderate emoji, short captions
MFV: Playful tone, frequent emoji, short captions
MFD: Professional tone, minimal emoji, short captions
QSR: Casual tone, moderate emoji, short captions
```

**This provides the strategic baseline for content tone.**

---

## Critical Missing Piece: Performance Tracking System

### Why This Matters

**Current State:**
```
1. AI generates 3 post ideas
2. User approves and posts them
3. Posts go live on social media
4. ??? (no data collection)
5. AI generates more ideas (with no learning)
```

**What Should Happen:**
```
1. AI generates 3 post ideas
2. User approves and posts them
3. Posts go live on social media
4. ✅ Performance data collected (reach, engagement, clicks)
5. ✅ Baseline updated (learn what works)
6. ✅ AI generates better ideas (based on learning)
```

### Performance Data Flow

```
POST PUBLISHED
     ↓
PLATFORM API (Facebook/Instagram Graph API)
     ↓
FETCH PERFORMANCE METRICS (24h, 7d, 30d)
     ↓
STORE IN content_performance_log
     ↓
UPDATE content_type_baselines
     ↓
FEED BACK TO AI GENERATOR
     ↓
NEXT POST IDEAS ARE SMARTER
```

---

## Layer 2 → Layer 3 Data Flow

**Layer 2 Output (Strategic Baselines) feeds Layer 3 (Temporal Context):**

```
LAYER 2: STRATEGIC BASELINES
├── Brand Strategy
│   → Tone: "Casual", Emoji: "Moderate", Pillars: ["Breakfast", "Local"]
│
├── Content Type Ratios
│   → Menu highlights: 35%, Location stories: 20%, Events: 20%
│
├── Performance Baselines
│   → Avg engagement: 3.2%, Best time: 10:30, Best day: Friday
│   → Menu posts perform 15% better than average
│   → "Brunch" content gets 2x engagement
│
├── Posting Frequency
│   → Target: 4 posts/week (based on SBO business type)
│
└── Platform Priority
    → Instagram 70%, Facebook 30%

                    ↓
              LAYER 3 INPUT
         (Temporal Context combines
          baselines with calendar events,
          weather, time-of-day)
```

---

## Implementation Plan

### Phase 1: Performance Tracking Schema ⚠️ CRITICAL

**Priority: HIGHEST**
**Time: 2-3 hours**

1. Create `content_performance_log` table
2. Create `content_type_baselines` table
3. Add performance fields to `post_ideas` table:
   ```sql
   ALTER TABLE post_ideas
   ADD COLUMN reach INTEGER DEFAULT 0,
   ADD COLUMN engagement INTEGER DEFAULT 0,
   ADD COLUMN clicks INTEGER DEFAULT 0,
   ADD COLUMN engagement_rate DECIMAL(5,2),
   ADD COLUMN posted_at TIMESTAMPTZ;
   ```

**Migration File:** `20260128000002_create_performance_tracking.sql`

### Phase 2: Manual Performance Entry (MVP) 🟡

**Priority: MEDIUM**
**Time: 4-6 hours**

**Why Manual First:**
- Facebook/Instagram API integration is complex
- Requires app review process (7-14 days)
- OAuth flow setup
- Need business verification

**Quick Win Approach:**
1. Add "Update Performance" button to posted content
2. User manually enters metrics from platform:
   - Reach
   - Engagement (likes + comments + shares)
   - Clicks
3. System calculates engagement rate
4. Updates baselines automatically

**UI Mockup:**
```
┌─────────────────────────────────────────────────┐
│ Posted: "Brunch ved åen! 🥐☕"                   │
│ Platform: Instagram • Posted 3 days ago         │
├─────────────────────────────────────────────────┤
│                                                  │
│ 📊 Update Performance                           │
│                                                  │
│ Reach: [_____] people                           │
│ Likes: [_____]                                  │
│ Comments: [_____]                               │
│ Shares: [_____]                                 │
│ Saves: [_____]                                  │
│ Link Clicks: [_____]                            │
│                                                  │
│ [Cancel]  [Save Performance Data]               │
└─────────────────────────────────────────────────┘
```

### Phase 3: Baseline Calculation Engine 🟡

**Priority: MEDIUM**
**Time: 6-8 hours**

**Functions to Implement:**

```sql
-- Calculate baseline for content type
CREATE OR REPLACE FUNCTION update_content_type_baseline(
  p_business_id UUID,
  p_content_type TEXT
)
RETURNS void AS $$
BEGIN
  -- Aggregate last 30 posts of this type
  -- Calculate avg engagement rate, reach, best time/day
  -- Update content_type_baselines table
END;
$$ LANGUAGE plpgsql;

-- Get baseline for comparison
CREATE OR REPLACE FUNCTION get_baseline_for_content(
  p_business_id UUID,
  p_content_type TEXT,
  p_platform TEXT
)
RETURNS JSONB AS $$
  -- Returns expected performance range
  -- e.g., {"min": 2.1, "avg": 3.2, "max": 5.8}
END;
$$ LANGUAGE plpgsql;
```

### Phase 4: AI Learning Integration 🟢

**Priority: LOW (Future)**
**Time: 10-15 hours**

**Enhance AI Generator to use baselines:**

```typescript
// In ai-generate function
const baselines = await getContentTypeBaselines(businessId);

// Adjust content mix based on performance
if (baselines.menu_highlight.avg_engagement_rate > baselines.location_story.avg_engagement_rate) {
  // Generate more menu highlights
  contentMix.menu_highlight += 0.1;
  contentMix.location_story -= 0.1;
}

// Optimize posting times
const bestTimes = baselines.platform_baselines[platform].best_posting_times;
// Suggest these in UI

// Learn from successful patterns
const topPerformingTags = await getTopPerformingTags(businessId);
// Incorporate into prompts
```

### Phase 5: API Integration (Future) 🔵

**Priority: FUTURE**
**Time: 20-30 hours**

**Facebook/Instagram Graph API:**
1. App review and permissions
2. OAuth flow implementation
3. Automated metrics fetching
4. Webhook setup for real-time updates
5. Error handling and retry logic

**This is Phase 3-4 months out - start with manual entry.**

---

## Testing Checklist

### Performance Tracking:
- [ ] Performance log table created
- [ ] Baselines table created
- [ ] Manual entry UI implemented
- [ ] Metrics calculations correct
- [ ] Engagement rate formula verified
- [ ] Baseline aggregation working

### Baseline Calculations:
- [ ] Content type baseline updated after N posts
- [ ] Platform-specific baselines calculated
- [ ] Best posting time/day identified
- [ ] Outliers handled (viral posts don't skew baseline)
- [ ] Minimum sample size enforced (10+ posts)

### AI Integration:
- [ ] Baselines feed into content mix decisions
- [ ] Underperforming content types reduced
- [ ] High-performing patterns amplified
- [ ] Posting time suggestions match baselines

---

## Sample Data Structure

### Content Performance Log Entry:
```json
{
  "id": "uuid",
  "business_id": "uuid",
  "post_idea_id": "uuid",
  "content_type": "menu_highlight",
  "content_pillar": "brunch",
  "posted_at": "2026-01-28T10:30:00Z",
  "platform": "instagram",
  "post_time": "10:30:00",
  "post_day_of_week": 5,  // Friday
  "reach": 1247,
  "engagement_total": 87,
  "likes": 62,
  "comments": 15,
  "shares": 7,
  "saves": 3,
  "clicks": 23,
  "engagement_rate": 6.98,
  "click_through_rate": 1.84,
  "content_tags": ["brunch", "outdoor", "weekend"],
  "calendar_event_id": "uuid",  // Weekend event
  "weather_condition": "sunny",
  "was_ai_generated": true,
  "user_edited": false,
  "user_rating": 5
}
```

### Content Type Baseline:
```json
{
  "business_id": "uuid",
  "baselines": {
    "menu_highlight": {
      "avg_engagement_rate": 3.2,
      "avg_reach": 1200,
      "sample_size": 45,
      "best_time": "10:30",
      "best_day": 5,
      "top_performing_tags": ["brunch", "organic", "local"]
    },
    "location_story": {
      "avg_engagement_rate": 2.8,
      "avg_reach": 980,
      "sample_size": 32,
      "best_time": "15:00",
      "best_day": 6
    }
  },
  "platform_baselines": {
    "instagram": {
      "avg_engagement_rate": 4.1,
      "best_posting_times": ["09:00", "13:00", "18:00"]
    },
    "facebook": {
      "avg_engagement_rate": 2.3,
      "best_posting_times": ["12:00", "17:00", "20:00"]
    }
  },
  "overall_avg_engagement_rate": 3.2,
  "overall_avg_reach": 1100,
  "total_posts_analyzed": 77
}
```

---

## Questions for Decision

### 1. Performance Tracking Approach
**Question:** Start with manual entry or wait for API integration?

**Recommendation:** Start manual. Here's why:
- ✅ Can launch in 1 week vs 2-3 months
- ✅ Get immediate feedback data
- ✅ Validate baseline calculation logic
- ✅ API can come later without changing data model

### 2. Minimum Sample Size
**Question:** How many posts before baselines are reliable?

**Recommendation:** 
- 10 posts minimum per content type
- 20 posts minimum overall
- Show "Learning..." status until threshold reached
- Use industry averages as fallback (Instagram: ~3%, Facebook: ~1.5%)

### 3. Baseline Update Frequency
**Question:** How often should baselines recalculate?

**Recommendation:**
- Real-time after each performance entry
- But show "Last 30 days" rolling window
- Older posts (90+ days) weighted less
- Prevents stale baselines from outdated posts

### 4. Performance Incentives
**Question:** How to encourage users to enter performance data?

**Ideas:**
- 🏆 "Performance Champion" badge after 10 entries
- 📊 Unlock "Smart Insights" feature after 20 entries
- 🎯 Show improvement graph ("Your posts improved 15%!")
- 💡 "Enter performance to unlock AI learning"

---

## Success Metrics

**Phase 1** (Performance Tracking MVP):
- [ ] Schema deployed
- [ ] Manual entry UI live
- [ ] 50+ performance entries collected (across 10 businesses)
- [ ] Baselines calculated for 5+ businesses

**Phase 2** (Learning Loop):
- [ ] AI generator uses baselines in content mix
- [ ] Measurable improvement in engagement rates (10%+)
- [ ] Users see "Your posts are performing 15% better" message
- [ ] High-performing content types prioritized

**Phase 3** (API Integration):
- [ ] Automated metrics fetching working
- [ ] 80%+ of posts have performance data
- [ ] Real-time baseline updates
- [ ] Predictive performance estimates ("Expected reach: 1000-1500")

---

## Next Steps

1. **Review and Approve** this assessment
2. **Prioritize** which phase to start with
3. **Create migration** for performance tracking tables
4. **Implement manual entry UI** (if approved)
5. **Deploy and test** with 3-5 pilot businesses
6. **Move to Layer 3** once baselines are collecting data

**Estimated Timeline to Layer 3:**
- With manual entry: 1-2 weeks (can proceed now)
- With API integration: 2-3 months (wait for approval + development)

---

## Summary

✅ **What's Ready:**
- Brand strategy baselines (excellent)
- Content type ratios (new from Layer 1)
- Posting frequency defaults (new from Layer 1)
- Content style defaults (new from Layer 1)

❌ **What's Missing:**
- Performance tracking system (CRITICAL)
- Historical baseline data (CRITICAL)
- Learning loop integration (CRITICAL)

**Recommendation:** Build performance tracking MVP with manual entry, collect data for 2-4 weeks, then move to Layer 3 while API integration happens in parallel.

**Ready to implement?**
