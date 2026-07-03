# LAYER 4: PERFORMANCE-DRIVEN OPTIMIZATION - ASSESSMENT

**Status:** 🟡 **50% Complete** (Variety filter ✅ built, Performance tracking ⏳ pending)

**Purpose:** Learn from results and maintain content diversity

---

## 🎯 Components Overview

### Component A: Recency & Variety Filter ✅ **100% Complete - NEW**

**Status:** Just built, ready to use

**Purpose:** Prevents repetition and maintains content diversity

**What It Does:**

#### Check 1: Dish Repetition
- **Rule:** Don't post same dish within 7 days
- **Hero dishes:** 14 days between posts (signature items posted frequently)
- **Example:** Posted salmon 3 days ago → Salmon blocked
- **Scoring:** -40 points if blocked, -20 if discouraged

#### Check 2: Content Type Sequence
- **Rule:** Max 2 of same type in a row
- **Example:** Menu → Menu → ❌ Menu (blocked)
- **Grace period:** 3 days minimum between same type
- **Scoring:** -30 points if blocked, -15 if discouraged

#### Check 3: Platform Balance
- **Target ratios (7-day window):**
  - Instagram: 40-70%
  - Facebook: 30-60%
- **Example:** 3 Instagram, 0 Facebook → Next MUST be Facebook
- **Scoring:** +20 bonus for needed platform, -15 for overused

#### Check 4: Visual Variety
- **Rule:** Max 3 same visual style in a row
- **Styles:** food_closeup, atmosphere, people, action
- **Check:** If 80%+ food closeups in last 6 posts → Atmosphere/people needed
- **Scoring:** +15 bonus for needed style, -10 for monotony

**Priority Levels:**
```typescript
'blocked'     // Cannot post (variety rules violated)
'discouraged' // Not recommended, but allowed
'neutral'     // No particular preference
'encouraged'  // Fills a gap, recommended
'required'    // Critically needed for balance
```

**Scoring System:**
- Starts at 100
- Deductions for violations
- Bonuses for filling gaps
- Final score: 0-100 (higher = better variety)

**Usage Example:**
```typescript
import { checkContentVariety, rankCandidatesByVariety } from './variety-filter.ts'

// Check single candidate
const result = checkContentVariety(candidate, recentPosts)

if (!result.eligible) {
  console.log(`Blocked: ${result.reason}`)
}

// Rank multiple candidates
const ranked = rankCandidatesByVariety(candidates, recentPosts)
const bestCandidate = ranked[0] // Highest variety score
```

**Files:**
- [supabase/functions/_shared/post-helpers/variety-filter.ts](supabase/functions/_shared/post-helpers/variety-filter.ts)

---

### Component B: Historical Performance Analysis ⏳ **0% Complete - BLOCKED**

**Status:** Cannot build yet - requires platform integration

**Why Blocked:**
```
USER'S NOTE: "We do not have the integration to Facebook and Instagram 
coded yet, so keep this in mind. I don't know if we need that implemented 
before this."
```

**Current State:**
```
1. User creates post in Post2Grow ✅
2. User copies to Instagram/Facebook ✅
3. Post gets engagement (likes, comments, shares) ✅
4. ❌ NO WAY TO GET THAT DATA BACK
5. ❌ No learning happens
6. ❌ System generates next post blindly
```

**What's Needed:**

#### Option A: Manual Entry (Quick MVP)
**Time:** 1 week  
**Complexity:** Low  

**How it works:**
1. User posts content manually
2. After 24-48h, user checks platform
3. User enters metrics in Post2Grow:
   - Reach: 1,247
   - Engagement: 87 (likes + comments + shares)
   - Clicks: 23
4. System learns immediately

**Pros:**
- ✅ Can start collecting data NOW
- ✅ Validates learning logic
- ✅ No API complexity

**Cons:**
- ❌ Manual work for user
- ❌ Not automated
- ❌ User might forget

#### Option B: Platform API Integration (Full Solution)
**Time:** 2-3 months  
**Complexity:** High  

**Requirements:**
1. **Facebook Graph API:**
   - App creation & review (7-14 days)
   - OAuth flow for business pages
   - Permissions: pages_read_engagement, instagram_basic, instagram_manage_insights
   - Fetch insights: reach, engagement, impressions, clicks

2. **Instagram Graph API:**
   - Only works with Instagram Business accounts
   - Requires connected Facebook page
   - Fetch insights: reach, impressions, engagement, saves

3. **Implementation:**
   - OAuth connection flow
   - Token management & refresh
   - Daily/weekly metric fetching
   - Error handling & retries

**Pros:**
- ✅ Fully automated
- ✅ Real-time data
- ✅ No user action needed

**Cons:**
- ❌ Complex to build
- ❌ Requires Facebook app review
- ❌ Blocks learning for months

**What Performance Data Enables:**

Once collected, this data powers:

#### 1. Post Type Performance
```
INPUT: 30+ posts with engagement data
OUTPUT:
  - menu_highlight: 3.2% engagement (baseline)
  - atmosphere_experience: 2.8% engagement (-13% below avg)
  - behind_scenes: 4.8% engagement (+50% above avg)
  
DECISION:
  - Increase behind_scenes from 20% → 25%
  - Decrease atmosphere from 25% → 15%
```

#### 2. Subject Performance
```
INPUT: Which menu items get most engagement
OUTPUT:
  - Burger posts: 4.5% engagement (top performer)
  - Salmon posts: 3.8% engagement
  - Salad posts: 2.1% engagement
  
DECISION:
  - Prioritize burger content
  - Feature in 40% of menu posts
```

#### 3. Time Performance
```
INPUT: Post performance by time
OUTPUT:
  - 08:00-09:00: 4.2% engagement (best)
  - 12:00-13:00: 3.5% engagement
  - 18:00-19:00: 3.8% engagement
  
DECISION:
  - Prioritize morning slots (8-9am)
  - Schedule top content for peak times
```

#### 4. Platform Performance
```
INPUT: Instagram vs Facebook effectiveness
OUTPUT:
  - Instagram: 4.1% engagement, 1,200 avg reach
  - Facebook: 2.3% engagement, 800 avg reach
  
DECISION:
  - Instagram for visual content (food, atmosphere)
  - Facebook for promotions and events
```

#### 5. Format Performance
```
INPUT: Photo vs Carousel vs Reel
OUTPUT:
  - Single photo: 3.2% engagement
  - Carousel: 3.8% engagement (+19%)
  - Reels: 5.1% engagement (+59%)
  
DECISION:
  - Prioritize Reels for high-impact content
  - Use carousels for multiple dishes
```

**Database Schema (Ready, No Data):**

From [LAYER_2_STRATEGIC_BASELINES.md](LAYER_2_STRATEGIC_BASELINES.md):

```sql
-- Performance tracking table (EXISTS, but empty)
CREATE TABLE IF NOT EXISTS post_ideas (
  ...
  -- Performance fields (placeholders)
  reach INTEGER,
  engagement INTEGER,
  clicks INTEGER
  ...
)
```

**Needs:**
```sql
CREATE TABLE content_performance_log (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  post_idea_id UUID REFERENCES post_ideas(id),
  
  content_type TEXT,
  content_pillar TEXT,
  platform TEXT,
  posted_at TIMESTAMPTZ,
  post_time TIME,
  post_day_of_week INTEGER,
  
  -- Metrics
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_total INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  
  -- Calculated
  engagement_rate DECIMAL(5,2), -- (engagement / reach) * 100
  click_through_rate DECIMAL(5,2),
  
  -- Context
  weather_condition TEXT,
  calendar_event_id UUID,
  content_tags TEXT[]
);

CREATE TABLE content_type_baselines (
  business_id UUID PRIMARY KEY,
  baselines JSONB, -- Per content type averages
  platform_baselines JSONB, -- Per platform averages
  last_updated TIMESTAMPTZ
);
```

---

## 🔄 Data Flow: Layer 4 Impact

### Current Flow (No Performance Data)
```
Layer 2: "Post 4 times/week, 40% menu, 25% atmosphere..."
    ↓
Layer 3: "Summer + Sunny + Waterfront = Outdoor opportunity"
    ↓
Layer 4 Variety: "✅ No salmon for 3 days, platform balanced"
    ↓
Layer 5: Select content → Post
    ↓
❌ NO FEEDBACK LOOP
```

### Future Flow (With Performance Data)
```
Layer 2: "Post 4 times/week, 40% menu, 25% atmosphere..."
    ↓
Layer 4 Performance: "⚠️ Atmosphere posts -30% → Adjust to 15%"
    ↓ (MODIFIES LAYER 2)
Layer 2 Updated: "40% menu, 15% atmosphere, 30% behind-scenes..."
    ↓
Layer 3: "Summer + Sunny + Waterfront = Outdoor opportunity"
    ↓
Layer 4 Variety: "✅ No salmon for 3 days, platform balanced"
    ↓
Layer 5: Select content → Post
    ↓
✅ PERFORMANCE TRACKED
    ↓
✅ BASELINES UPDATED
    ↓
✅ NEXT POST SMARTER
```

---

## 📊 What's Working Now vs What's Missing

### ✅ Working Now (Variety Filter)

**You can immediately:**
1. Check if content is too repetitive
2. Detect platform imbalance
3. Identify missing visual styles
4. Score candidates by variety
5. Get UI recommendations

**Example Integration:**
```typescript
// In post-idea-generator or content-suggestion engine
import { rankCandidatesByVariety, getVarietyRecommendations } from './variety-filter.ts'

// Get recent post history
const recentPosts = await fetchRecentPosts(businessId, 14)

// Generate candidates
const candidates = await generateContentIdeas(businessId)

// Filter and rank by variety
const ranked = rankCandidatesByVariety(candidates, recentPosts)

// Show top 3 with best variety
const suggestions = ranked.slice(0, 3)

// Show UI hints
const recommendations = getVarietyRecommendations(recentPosts)
// → ["Mix in some atmosphere shots", "Balance platforms: more Facebook needed"]
```

### ⏳ Missing (Performance Optimization)

**Cannot do yet:**
1. Learn which content types perform best
2. Learn which dishes get most engagement
3. Learn optimal posting times
4. Learn platform effectiveness
5. Adjust Layer 2 baselines based on results

**Blocker:** No way to get engagement data from Instagram/Facebook

---

## 🎯 Decision Required: Manual Entry MVP?

**Question:** Should we build manual performance entry (Option A) while platform integration (Option B) is in progress?

### Recommendation: YES, Build Manual Entry Now

**Why:**
1. **Immediate data collection** - Start learning in 1 week vs 3 months
2. **Validates logic** - Test baseline calculation before API complexity
3. **User feedback** - Learn what metrics users care about
4. **Parallel development** - Can work on API integration separately
5. **Graceful degradation** - Manual works, API enhances

**Timeline:**
- Week 1: Build manual entry UI + baseline calculation
- Week 2-4: Collect data from 10-20 test businesses
- Week 5-8: Validate learning logic, adjust algorithms
- Month 2-3: Build API integration (parallel)
- Month 3: API launches, manual entry remains as fallback

**Minimal Manual Entry UI:**
```
┌──────────────────────────────────────────────┐
│ Update Post Performance                       │
├──────────────────────────────────────────────┤
│ Post: "Brunch ved åen! 🥐☕"                  │
│ Posted: 3 days ago (Instagram)               │
│                                               │
│ Reach: [_____] views                         │
│ Likes: [_____]                               │
│ Comments: [_____]                            │
│ Shares: [_____]                              │
│ Clicks: [_____] (link clicks)                │
│                                               │
│ [Save Performance]  [Skip]                   │
└──────────────────────────────────────────────┘

💡 Tip: Check Instagram Insights for these numbers
```

---

## ✅ Layer 4 Completion Checklist

- [x] Recency & variety filter built
- [x] Dish repetition prevention
- [x] Content type sequence checking
- [x] Platform balance monitoring
- [x] Visual variety enforcement
- [x] Candidate scoring and ranking
- [ ] **PENDING:** Performance tracking schema deployed
- [ ] **PENDING:** Manual entry UI (or API integration)
- [ ] **PENDING:** Baseline calculation engine
- [ ] **PENDING:** Performance-driven baseline adjustments
- [ ] **PENDING:** AI learning integration

---

## 🚀 Integration Points

### Ready to Integrate Now ✅
```typescript
// In post-idea-generator
import { checkContentVariety } from './_shared/post-helpers/variety-filter.ts'

// Before suggesting content
const varietyCheck = checkContentVariety(candidate, recentPosts)

if (!varietyCheck.eligible) {
  // Skip this candidate
  continue
}

// Prefer higher variety scores
suggestions.sort((a, b) => b.varietyScore - a.varietyScore)
```

### Waiting for Data Collection ⏳
```typescript
// In baseline-optimizer (to be built)
import { calculateContentTypeBaselines } from './performance-analyzer.ts'

// After collecting 30+ posts
const baselines = calculateContentTypeBaselines(performanceData)

// Update Layer 2 distribution
await updateContentDistributionRules(businessId, baselines)
```

---

## 📈 What Feeds Into Layer 5

**Layer 5 (Content Selection) receives from Layer 4:**

### From Variety Filter (Available Now):
```typescript
{
  eligibleCandidates: ContentCandidate[],
  varietyScores: Record<string, number>,
  platformNeeded: 'instagram' | 'facebook' | 'both',
  visualStyleNeeded: 'atmosphere' | 'people' | null,
  recommendations: string[] // UI hints
}
```

### From Performance Optimization (Future):
```typescript
{
  topPerformingTypes: ['behind_scenes', 'menu_highlight'],
  topPerformingDishes: ['Burger', 'Ribeye Steak'],
  optimalPostingTimes: ['08:30', '13:00', '18:00'],
  platformPreference: { instagram: 0.65, facebook: 0.35 },
  expectedEngagement: { min: 800, max: 1500 } // Predicted reach
}
```

---

## 🔮 Layer 4 → Layer 5 Flow

```
LAYER 2: Strategic Baselines
  "FSE should post 4x/week: 40% menu, 25% atmosphere, 20% behind-scenes..."
     ↓
LAYER 3: Temporal Context
  "Summer + Sunny weekend + Waterfront = Outdoor opportunity (CRITICAL)"
     ↓
LAYER 4A: Variety Filter ✅
  Input: 10 content candidates
  Process:
    - Salmon posted 2 days ago → Block salmon
    - 2 menu posts in row → Discourage menu
    - 3 Instagram, 0 Facebook → Require Facebook
    - 5 food closeups → Encourage atmosphere
  Output: Ranked candidates [atmosphere_facebook_waterfront SCORE:95]
     ↓
LAYER 4B: Performance Optimizer ⏳ (Future)
  Input: Historical performance data
  Process:
    - Atmosphere posts -30% vs baseline
    - Behind-scenes +50% vs baseline
    - Morning posts +25% engagement
  Output: "Prioritize behind-scenes at 8am on Facebook"
     ↓
LAYER 5: Final Content Selection
  Combines:
    - Layer 2 baselines
    - Layer 3 opportunities
    - Layer 4 variety requirements
    - Layer 4 performance insights
  Selects: Single winning content idea
```

---

## 🎯 Summary

**Layer 4 Grade:** 🟡 **50% Complete** (Infrastructure Ready)

### Component A: Variety Filter
**Status:** ✅ 100% COMPLETE - Production-ready

**Delivered:**
- `supabase/functions/_shared/post-helpers/variety-filter.ts` (320 lines)
- Multi-dimensional scoring (dish, type, platform, visual)
- Priority-based recommendations (blocked/discouraged/neutral/encouraged/required)
- Batch ranking capability
- Scoring system (0-100)

**Next:** Wire into content suggestion engine

### Component B: Performance Learning Engine
**Status:** ✅ Infrastructure Complete - Awaiting API Integration

**Decision Made:** User chose **Option B** (API integration, not manual entry)
- Auto-post integration already exists
- Just needs reverse data flow (metrics from platforms)
- Infrastructure built to handle empty state gracefully

**Delivered:**
- `supabase/migrations/20260128000003_performance_tracking_infrastructure.sql` (350+ lines)
  - Complete schema: content_performance_log, content_type_baselines
  - Analysis engine: calculate_content_baselines() (90-day rolling window)
  - Optimization logic: get_performance_adjusted_distribution() (±20% adjustments)
  - Graceful degradation: returns Layer 2 defaults when insufficient data
  - Indexes, triggers, documentation

- `supabase/functions/_shared/post-helpers/performance-tracking.ts` (450+ lines)
  - logPostPerformance(): API integration helper
  - recalculateBaselines(): Daily cron trigger
  - getPerformanceAdjustedDistribution(): Content generation integration
  - getBaselines(): UI insights display
  - Placeholder functions for Instagram/Facebook (documented for future)

- `LAYER_4B_PERFORMANCE_TRACKING.md` (comprehensive guide)
  - Architecture diagrams
  - Integration instructions (Instagram Insights API, Facebook Graph API)
  - Testing procedures
  - Example scenarios (empty state → learning → optimization)
  - UI integration examples

**Timeline:**
- Week 1: Empty state, returns Layer 2 static baselines ← **WE ARE HERE**
- Week 2-3: Data collection begins (once API integration built)
- Week 4+: Learning activated (20+ posts → sufficient_data = TRUE)
- Month 2+: Deep insights, business-specific optimization

**Next Steps:**
1. Apply migration 20260128000003
2. Build Instagram Insights API integration (fetch reach, engagement, saves)
3. Build Facebook Graph API integration (fetch reach, reactions, comments, shares, clicks)
4. Schedule daily cron job for baseline calculation
5. Update content generation to use getPerformanceAdjustedDistribution()

**User Quote:** *"I tend to be more towards B, so we dont have to change again. We also have the integration to auto-post made, so all is missing on that front. Can you build something that we can then have the integration afterwards so we have the flow to the next steps in place, just with no data as of now?"*

**Delivered:** ✅ Complete flow ready, works with no data, automatically activates when data flows in. No code changes needed when API integration is complete.

---

## Next: Layer 5 Assessment

Layer 4 provides inputs for Layer 5 (Content Selection & Media Format):
- Variety requirements (what to avoid)
- Performance insights (what works)
- Combined with Layer 2 baselines (strategic distribution)
- Combined with Layer 3 opportunities (temporal context)

Ready to proceed to Layer 5 when user provides framework.

