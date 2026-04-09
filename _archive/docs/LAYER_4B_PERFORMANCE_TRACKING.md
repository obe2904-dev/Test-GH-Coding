# Layer 4B: Performance Tracking & Learning

**Status:** ✅ Infrastructure Complete | ⏳ Awaiting API Integration

## Overview

Complete performance tracking system that learns from Instagram and Facebook engagement data. Automatically adjusts content strategy based on what actually works for each business.

**Graceful Degradation:** Works immediately with empty data (uses Layer 2 static baselines), automatically switches to performance-optimized baselines when sufficient data (20+ posts) is available.

---

## Architecture

```
┌─────────────────────┐
│ Instagram/Facebook  │  ← API Integration (TO BE BUILT)
│   Insights APIs     │
└──────────┬──────────┘
           │ Fetch metrics
           ↓
┌─────────────────────┐
│ logPostPerformance()│  ← Helper function (READY)
└──────────┬──────────┘
           │ Store
           ↓
┌─────────────────────────────────────┐
│ content_performance_log TABLE       │
│ ├─ reach, engagement, clicks        │
│ ├─ calculated: engagement_rate      │
│ └─ context: menu items, weather     │
└──────────┬──────────────────────────┘
           │ Analyze (daily cron)
           ↓
┌─────────────────────────────────────┐
│ calculate_content_baselines()       │
│ ├─ 90-day rolling window            │
│ ├─ Group by content_type            │
│ ├─ Group by platform                │
│ └─ Identify patterns                │
└──────────┬──────────────────────────┘
           │ Store
           ↓
┌─────────────────────────────────────┐
│ content_type_baselines TABLE        │
│ ├─ overall_avg_engagement_rate      │
│ ├─ baselines JSONB (per type)       │
│ ├─ platform_baselines JSONB         │
│ └─ sufficient_data (TRUE when 20+)  │
└──────────┬──────────────────────────┘
           │ Apply adjustments
           ↓
┌──────────────────────────────────────┐
│ get_performance_adjusted_distribution│
│ ├─ If sufficient_data: adjust ±20%  │
│ └─ Else: return Layer 2 defaults    │
└──────────┬───────────────────────────┘
           │
           ↓
┌─────────────────────┐
│ Content Generation  │
│ (uses optimized mix)│
└─────────────────────┘
```

---

## Database Schema

### content_performance_log

Stores raw metrics from Instagram/Facebook APIs.

```sql
CREATE TABLE content_performance_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses NOT NULL,
  post_idea_id UUID REFERENCES post_ideas,
  
  -- Classification
  content_type TEXT NOT NULL, -- 'menu_highlight', 'atmosphere_experience', etc.
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'both')),
  
  -- Timing
  posted_at TIMESTAMPTZ NOT NULL,
  post_time TIME, -- Auto-extracted
  post_day_of_week INTEGER, -- Auto-extracted (0=Sunday, 6=Saturday)
  
  -- Performance Metrics (from APIs)
  reach INTEGER NOT NULL, -- How many people saw it
  impressions INTEGER, -- How many times it was shown
  engagement_total INTEGER NOT NULL, -- Total interactions
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0, -- Instagram saves
  clicks INTEGER DEFAULT 0, -- Link clicks
  
  -- Calculated Metrics
  engagement_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN reach > 0 THEN (engagement_total::DECIMAL / reach) * 100 ELSE 0 END
  ) STORED,
  click_through_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN impressions > 0 THEN (clicks::DECIMAL / impressions) * 100 ELSE 0 END
  ) STORED,
  
  -- Context (helps identify patterns)
  menu_items_featured TEXT[], -- Which dishes were featured
  location_hooks TEXT[], -- Location categories used
  weather_condition TEXT, -- Weather when posted
  calendar_event_id UUID, -- Associated holiday/event
  seasonal_context TEXT, -- 'summer', 'winter', etc.
  
  -- Quality Indicators
  was_ai_generated BOOLEAN DEFAULT true,
  user_edited BOOLEAN DEFAULT false,
  visual_style TEXT, -- 'food_closeup', 'atmosphere_wide', etc.
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_perf_business ON content_performance_log(business_id);
CREATE INDEX idx_perf_posted_at ON content_performance_log(posted_at DESC);
CREATE INDEX idx_perf_content_type ON content_performance_log(content_type);
CREATE INDEX idx_perf_platform ON content_performance_log(platform);
CREATE INDEX idx_perf_engagement ON content_performance_log(engagement_rate DESC);
CREATE INDEX idx_perf_business_type ON content_performance_log(business_id, content_type);
CREATE INDEX idx_perf_business_posted ON content_performance_log(business_id, posted_at DESC);
```

### content_type_baselines

Stores calculated baselines and patterns.

```sql
CREATE TABLE content_type_baselines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses NOT NULL UNIQUE,
  
  -- Overall Performance
  overall_avg_engagement_rate DECIMAL(5,2) NOT NULL,
  overall_avg_reach INTEGER NOT NULL,
  total_posts_analyzed INTEGER NOT NULL,
  
  -- Per Content Type Baselines
  baselines JSONB NOT NULL,
  -- Example structure:
  -- {
  --   "menu_highlight": {
  --     "avg_engagement_rate": 3.2,
  --     "avg_reach": 1200,
  --     "sample_size": 15,
  --     "best_time": "10:30:00",
  --     "best_day": 6,
  --     "top_performing_items": ["Burger", "Pasta"],
  --     "variance": 0.8
  --   },
  --   "atmosphere_experience": { ... }
  -- }
  
  -- Per Platform Baselines
  platform_baselines JSONB NOT NULL,
  -- Example structure:
  -- {
  --   "instagram": {
  --     "avg_engagement_rate": 4.1,
  --     "avg_reach": 1400,
  --     "best_posting_times": ["10:00", "17:00"],
  --     "best_days": [5, 6]
  --   },
  --   "facebook": { ... }
  -- }
  
  -- Data Quality
  sufficient_data BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE when >= 20 posts
  last_calculated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Functions

### calculate_content_baselines(business_id)

Analyzes last 90 days of performance data and calculates baselines.

**Triggers:**
- Daily cron job
- After logging new performance data
- When user requests insights

**Returns:** Complete baselines JSONB structure

**Example:**
```sql
SELECT calculate_content_baselines('business-uuid');
-- Returns:
-- {
--   "overall_avg_engagement_rate": 3.5,
--   "overall_avg_reach": 1100,
--   "total_posts_analyzed": 47,
--   "sufficient_data": true,
--   "baselines": { ... },
--   "platform_baselines": { ... }
-- }
```

### get_performance_adjusted_distribution(business_id, business_type)

Returns content distribution adjusted by actual performance.

**Logic:**
- If `sufficient_data = FALSE`: Return Layer 2 static baselines unchanged
- If `sufficient_data = TRUE`: Adjust each content type:
  - **+20%** if performs 30%+ above average
  - **+10%** if performs 10-30% above average
  - **-10%** if performs 10-30% below average
  - **-20%** if performs 30%+ below average
  - Cap: max 50%, min 5%

**Example:**
```sql
SELECT * FROM get_performance_adjusted_distribution('business-uuid', 'FSE');
-- Returns:
-- content_type         | baseline | adjusted | reason
-- menu_highlight       | 40%      | 48%      | High performer (+30% above avg)
-- atmosphere           | 25%      | 20%      | Low performer (-25% below avg)
-- behind_scenes        | 20%      | 20%      | Performing at baseline
-- event_promotion      | 15%      | 12%      | Slightly below average
```

### log_post_performance(...)

Helper for API integration to log metrics.

**Parameters:**
- `p_business_id`: Business UUID
- `p_post_idea_id`: Optional post_ideas reference
- `p_content_type`: Content type slug
- `p_platform`: 'instagram', 'facebook', or 'both'
- `p_posted_at`: When post went live
- `p_reach`: How many people reached
- `p_engagement`: Total engagement count
- `p_likes`, `p_comments`, `p_shares`, `p_saves`, `p_clicks`: Individual metrics

**Auto-extracts:**
- `post_time`: Time from `posted_at`
- `post_day_of_week`: Day from `posted_at`

**Example:**
```sql
SELECT log_post_performance(
  'business-uuid',
  'post-idea-uuid',
  'menu_highlight',
  'instagram',
  '2026-01-25 10:30:00',
  1247, -- reach
  87,   -- engagement
  75,   -- likes
  8,    -- comments
  2,    -- shares
  14,   -- saves
  3     -- clicks
);
-- Returns: log UUID
```

---

## TypeScript API

### logPostPerformance()

```typescript
await logPostPerformance({
  businessId: 'uuid',
  contentType: 'menu_highlight',
  platform: 'instagram',
  postedAt: new Date('2026-01-25T10:30:00Z'),
  metrics: {
    reach: 1247,
    likes: 87,
    comments: 12,
    shares: 5,
    saves: 23,
    clicks: 14
  },
  menuItemsFeatured: ['Burger', 'Fries'],
  locationHooks: ['waterfront', 'outdoor_seating'],
  weatherCondition: 'sunny',
  visualStyle: 'food_closeup'
})
```

### recalculateBaselines()

```typescript
const baselines = await recalculateBaselines('business-uuid')
console.log(`Analyzed ${baselines.totalPostsAnalyzed} posts`)
console.log(`Overall engagement: ${baselines.overallAvgEngagementRate}%`)
console.log(`Sufficient data: ${baselines.sufficientData}`)
```

### getPerformanceAdjustedDistribution()

```typescript
const distribution = await getPerformanceAdjustedDistribution('business-uuid', 'FSE')

for (const item of distribution) {
  console.log(`${item.contentType}: ${item.baselinePercentage}% → ${item.adjustedPercentage}%`)
  console.log(`  Reason: ${item.adjustmentReason}`)
}
```

---

## Integration Guide

### Step 1: Apply Migration

```bash
supabase db push supabase/migrations/20260128000003_performance_tracking_infrastructure.sql
```

**Verify:**
```sql
-- Check tables exist
SELECT * FROM content_performance_log LIMIT 1;
SELECT * FROM content_type_baselines LIMIT 1;

-- Test with empty data (should return Layer 2 defaults)
SELECT * FROM get_performance_adjusted_distribution('any-business-uuid', 'FSE');
-- ✅ Returns static baselines with adjustment_reason: 'No data yet'
```

### Step 2: Build Instagram API Integration

**Requirements:**
- Instagram Business Account connected to Facebook Page
- OAuth access token with permissions: `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights`
- API calls: `/v19.0/{ig-media-id}/insights`

**Metrics to fetch:**
- `reach`: Number of unique accounts reached
- `impressions`: Total views
- `engagement`: Total likes + comments + saves
- `saved`: Number of saves (Instagram only)

**Implementation:**
```typescript
// In your auto-post integration
async function fetchAndLogInstagramInsights(businessId: string, postId: string) {
  const accessToken = await getInstagramAccessToken(businessId)
  
  // Wait 24-48h after posting for data to stabilize
  const metrics = await fetch(
    `https://graph.instagram.com/v19.0/${postId}/insights?metric=reach,impressions,engagement,saved&access_token=${accessToken}`
  ).then(r => r.json())
  
  // Parse and log
  await logPostPerformance({
    businessId,
    contentType: post.contentType,
    platform: 'instagram',
    postedAt: post.publishedAt,
    metrics: {
      reach: metrics.data.find(m => m.name === 'reach').values[0].value,
      likes: post.like_count,
      comments: post.comments_count,
      shares: 0, // Instagram doesn't expose shares via API
      saves: metrics.data.find(m => m.name === 'saved').values[0].value,
      clicks: 0
    }
  })
}
```

### Step 3: Build Facebook API Integration

**Requirements:**
- Facebook Page
- OAuth access token with permissions: `pages_read_engagement`, `pages_read_user_content`
- API calls: `/v19.0/{post-id}/insights`, `/v19.0/{post-id}?fields=reactions,comments,shares`

**Metrics to fetch:**
- `post_impressions`: Total views
- `post_engaged_users`: Unique engagers
- `reactions`, `comments`, `shares`: Interaction counts
- `post_clicks`: Link clicks

**Implementation:**
```typescript
async function fetchAndLogFacebookInsights(businessId: string, postId: string) {
  const accessToken = await getFacebookAccessToken(businessId)
  
  // Fetch insights
  const insights = await fetch(
    `https://graph.facebook.com/v19.0/${postId}/insights?metric=post_impressions,post_engaged_users,post_clicks&access_token=${accessToken}`
  ).then(r => r.json())
  
  // Fetch engagement details
  const engagement = await fetch(
    `https://graph.facebook.com/v19.0/${postId}?fields=reactions.summary(total_count),comments.summary(total_count),shares&access_token=${accessToken}`
  ).then(r => r.json())
  
  // Parse and log
  await logPostPerformance({
    businessId,
    contentType: post.contentType,
    platform: 'facebook',
    postedAt: post.created_time,
    metrics: {
      reach: insights.data.find(m => m.name === 'post_engaged_users').values[0].value,
      impressions: insights.data.find(m => m.name === 'post_impressions').values[0].value,
      likes: engagement.reactions.summary.total_count,
      comments: engagement.comments.summary.total_count,
      shares: engagement.shares?.count || 0,
      clicks: insights.data.find(m => m.name === 'post_clicks')?.values[0].value || 0
    }
  })
}
```

### Step 4: Set Up Daily Cron Job

**Create:** `supabase/functions/calculate-baselines-cron/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { recalculateBaselines } from '../_shared/post-helpers/performance-tracking.ts'

serve(async (req) => {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  // Get all active businesses
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id')
    .eq('status', 'active')
  
  // Recalculate baselines for each
  const results = []
  for (const business of businesses) {
    const baselines = await recalculateBaselines(business.id)
    if (baselines) {
      results.push({
        businessId: business.id,
        totalPosts: baselines.totalPostsAnalyzed,
        sufficientData: baselines.sufficientData
      })
    }
  }
  
  return new Response(JSON.stringify({
    success: true,
    businessesProcessed: businesses.length,
    results
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

**Schedule:** Supabase Dashboard → Edge Functions → calculate-baselines-cron → Schedule → `0 2 * * *` (2am daily)

### Step 5: Update Content Generation

**Modify:** Content generation functions to use performance-adjusted distribution

```typescript
// OLD: Static baselines
const { data: distribution } = await supabase
  .from('content_distribution_rules')
  .select('*')
  .eq('business_type', businessType)

// NEW: Performance-adjusted
import { getPerformanceAdjustedDistribution } from '../_shared/post-helpers/performance-tracking.ts'

const distribution = await getPerformanceAdjustedDistribution(businessId, businessType)

// distribution now includes:
// - baseline_percentage (Layer 2 default)
// - adjusted_percentage (optimized based on performance)
// - adjustment_reason (transparency)
// - priority (sort order)

// Use adjusted_percentage for content selection
const contentTypeWeights = distribution.map(d => ({
  type: d.contentType,
  weight: d.adjustedPercentage
}))
```

---

## Data Flow Timeline

### Day 0 (Deployment)
```
✅ Migration applied
✅ Tables created (empty)
✅ Functions deployed
✅ TypeScript helpers available
```

**Behavior:** `get_performance_adjusted_distribution()` returns Layer 2 static baselines unchanged

### Days 1-7 (Data Collection)
```
⏳ Posts going out via auto-post integration
⏳ After 24-48h, API integration fetches metrics
⏳ logPostPerformance() called for each post
⏳ content_performance_log fills up
```

**Behavior:** Still returns static baselines (`sufficient_data = FALSE`)

### Day 8+ (Learning Begins)
```
✅ 20+ posts logged
✅ Daily cron calls calculate_content_baselines()
✅ sufficient_data switches to TRUE
✅ get_performance_adjusted_distribution() starts returning optimized mix
```

**Behavior:** Content generation now uses performance-optimized distribution

### Month 2+ (Continuous Improvement)
```
🚀 90-day rolling window analysis
🚀 Patterns identified: best times, best days, top dishes
🚀 Content mix self-optimizes based on engagement
🚀 Business-specific insights mature
```

**Behavior:** Each business has unique optimized distribution based on their audience

---

## Example Scenario

**Business:** Waterfront Cafe (FSE type)

### Week 1: Static Baselines
```
Layer 2 defaults:
- menu_highlight: 40%
- atmosphere: 25%
- behind_scenes: 20%
- event_promotion: 15%

Posts created with this distribution
```

### Week 4: Data Collected
```
Performance log shows:
- menu_highlight: 2.8% engagement (below 3.5% avg)
- atmosphere: 5.2% engagement (above avg) ← Waterfront views!
- behind_scenes: 3.9% engagement (above avg) ← People love the kitchen
- event_promotion: 2.1% engagement (below avg)

Total posts: 25 ← sufficient_data = TRUE
```

### Week 5+: Optimized Distribution
```
Adjusted distribution:
- menu_highlight: 32% (-20%, reason: "Underperforming by 20%")
- atmosphere: 35% (+40%, reason: "High performer +49%") ← Waterfront amplified!
- behind_scenes: 23% (+15%, reason: "Above average +11%")
- event_promotion: 10% (-33%, reason: "Low engagement")

Content generation now prioritizes what works for this specific business
```

### Month 3: Deep Insights
```
Baselines show:
- Atmosphere posts with "waterfront" hook: 6.1% engagement
- Best posting time for atmosphere: 17:00 (golden hour)
- Best day: Saturday (weekend crowds)
- Top performing menu items: "Fish & Chips", "Sunset Cocktail"

System automatically:
1. Increases atmosphere content
2. Suggests waterfront + golden hour combinations
3. Features top-performing menu items more often
4. Posts atmosphere content at 17:00 on weekends
```

---

## UI Integration

### Performance Dashboard

Show baselines and insights in business dashboard:

```typescript
const baselines = await getBaselines(businessId)

if (!baselines || !baselines.sufficientData) {
  return (
    <Alert>
      <AlertTitle>Building Your Performance Profile</AlertTitle>
      <AlertDescription>
        We need at least 20 posts to start learning what works best for your audience.
        Currently: {baselines?.totalPostsAnalyzed || 0} posts analyzed.
      </AlertDescription>
    </Alert>
  )
}

return (
  <div>
    <h3>Your Performance Insights</h3>
    <p>Based on {baselines.totalPostsAnalyzed} posts over 90 days</p>
    
    <h4>Overall Performance</h4>
    <Metric label="Average Engagement Rate" value={`${baselines.overallAvgEngagementRate}%`} />
    <Metric label="Average Reach" value={baselines.overallAvgReach} />
    
    <h4>Best Performing Content Types</h4>
    {Object.entries(baselines.contentTypeBaselines)
      .sort((a, b) => b[1].avgEngagementRate - a[1].avgEngagementRate)
      .slice(0, 5)
      .map(([type, data]) => (
        <div key={type}>
          <h5>{type}</h5>
          <p>Engagement: {data.avgEngagementRate}% ({data.sampleSize} posts)</p>
          <p>Best time: {data.bestTime || 'Any'}</p>
          <p>Top items: {data.topPerformingItems?.join(', ') || 'N/A'}</p>
        </div>
      ))
    }
    
    <h4>Platform Performance</h4>
    {Object.entries(baselines.platformBaselines).map(([platform, data]) => (
      <div key={platform}>
        <h5>{platform}</h5>
        <p>Engagement: {data.avgEngagementRate}%</p>
        <p>Reach: {data.avgReach}</p>
        <p>Best days: {data.bestDays?.join(', ') || 'Any'}</p>
      </div>
    ))}
  </div>
)
```

### Content Suggestions

Show why content is suggested:

```typescript
const distribution = await getPerformanceAdjustedDistribution(businessId, businessType)

return (
  <div>
    <h3>Recommended Content Mix This Week</h3>
    {distribution.map(item => (
      <div key={item.contentType}>
        <h4>{item.contentType}</h4>
        <p>Recommended: {item.adjustedPercentage}%</p>
        {item.adjustedPercentage !== item.baselinePercentage && (
          <Badge>
            {item.adjustmentReason}
          </Badge>
        )}
      </div>
    ))}
  </div>
)
```

---

## Testing

### Manual Testing (Empty State)

```sql
-- Should return Layer 2 defaults unchanged
SELECT * FROM get_performance_adjusted_distribution('test-business-uuid', 'FSE');
-- ✅ All adjusted_percentage = baseline_percentage
-- ✅ All adjustment_reason = 'No data yet - using baseline'
```

### Manual Testing (With Mock Data)

```sql
-- Insert mock performance data
INSERT INTO content_performance_log (
  business_id, content_type, platform, posted_at,
  reach, engagement_total, likes, comments, shares, saves, clicks
) VALUES
  -- High performer: atmosphere
  ('test-uuid', 'atmosphere_experience', 'instagram', NOW() - INTERVAL '5 days', 1500, 75, 60, 10, 3, 15, 5),
  ('test-uuid', 'atmosphere_experience', 'instagram', NOW() - INTERVAL '12 days', 1400, 70, 55, 12, 2, 18, 3),
  ('test-uuid', 'atmosphere_experience', 'instagram', NOW() - INTERVAL '19 days', 1600, 80, 65, 8, 4, 20, 4),
  
  -- Low performer: menu_highlight
  ('test-uuid', 'menu_highlight', 'instagram', NOW() - INTERVAL '3 days', 1200, 24, 20, 2, 1, 5, 1),
  ('test-uuid', 'menu_highlight', 'instagram', NOW() - INTERVAL '10 days', 1100, 22, 18, 3, 0, 4, 2),
  ('test-uuid', 'menu_highlight', 'instagram', NOW() - INTERVAL '17 days', 1300, 26, 22, 1, 1, 6, 1);

-- Calculate baselines
SELECT calculate_content_baselines('test-uuid');

-- Check adjusted distribution
SELECT * FROM get_performance_adjusted_distribution('test-uuid', 'FSE');
-- ✅ atmosphere: adjusted > baseline (high performer)
-- ✅ menu_highlight: adjusted < baseline (low performer)
```

---

## Monitoring

### Key Metrics

**Data Quality:**
- `SELECT business_id, total_posts_analyzed, sufficient_data FROM content_type_baselines`
- Alert if `sufficient_data = FALSE` after 30 days

**Performance Trends:**
- `SELECT DATE_TRUNC('week', posted_at), AVG(engagement_rate) FROM content_performance_log GROUP BY 1 ORDER BY 1 DESC`
- Track if engagement improving over time

**Learning Effectiveness:**
- Compare baseline vs adjusted distributions
- Track how many businesses have `sufficient_data = TRUE`
- Monitor if adjustments correlate with improved engagement

---

## Summary

✅ **Infrastructure:** Complete and production-ready
⏳ **API Integration:** To be built (Instagram + Facebook)
⏳ **Cron Job:** To be scheduled (daily baseline calculation)

**Current State:**
- Tables exist (empty)
- Functions work (graceful degradation)
- TypeScript helpers ready
- Returns Layer 2 defaults until data arrives

**Next Steps:**
1. Apply migration `20260128000003`
2. Build Instagram Insights API integration
3. Build Facebook Graph API integration
4. Schedule daily cron job for baseline calculation
5. Update content generation to use `getPerformanceAdjustedDistribution()`

**Timeline:**
- Week 1: Empty state, static baselines
- Week 2-3: Data collection begins
- Week 4+: Learning activated, optimized distributions
- Month 2+: Deep insights, business-specific optimization
