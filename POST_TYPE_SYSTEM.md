# Post Type System & Distribution Logic
**Single Source of Truth for Quick Suggestions & Weekly Plan**

Last updated: 2026-06-03  
Applies to: `get-quick-suggestions`, `weekly-plan` (upcoming)

---

## 1. Content Types (Post Types)

All posts are classified by `content_type` which determines:
- What the post focuses on (menu item vs atmosphere vs behind-the-scenes)
- Which prompt builder is used
- What media suggestions are provided
- How the post is validated

### Available Content Types

| Content Type | Purpose | Prompt Builder | Focus |
|-------------|---------|----------------|-------|
| `menu_item` | Showcase a specific dish or drink | `buildSlotAPrompt` | Concrete offering from menu |
| `atmosphere` | Show the guest moment/social situation | `buildSlotBPrompt` | Why choose this venue NOW |
| `behind_scenes` | Show people & practices behind the experience | `buildSlotCPrompt` | Team, craft, values |
| `seasonal` | (Legacy) Seasonal content | - | Deprecated in favor of menu_item with seasonal context |
| `event` | (Legacy) Event content | - | Deprecated in favor of atmosphere with event context |

### Active Content Types in Production
Currently only these 3 are actively used:
- **`menu_item`** - The offering
- **`atmosphere`** - The guest moment  
- **`behind_scenes`** - The brand behind

---

## 2. Slot System

Quick Suggestions generates **3 slots** per day, each with:
- A unique position (1, 2, or 3)
- A content type (menu_item, atmosphere, or behind_scenes)
- A posting time (suggested_time)
- A specific dish/focus (different from other slots)

### Slot Distribution Intent
**Intent**: 3 suggestions = 3 different time windows + 3 different dishes + 3 different purposes.  
**NOT**: 3 variations of the same moment.

### Example (generated at 09:00)
- **Slot A** → brunch post for 11:00 (dish: Eggs Benedict, format: `menu_item`)
- **Slot B** → lunch post for 13:00 (atmosphere: outdoor seating, format: `atmosphere`)
- **Slot C** → dinner teaser for 17:00 (behind scenes: chef prep, format: `behind_scenes`)

### Rule
Each slot must differ in **at LEAST two of**: time, dish, format.  
**Never** two slots targeting the same time window with the same dish.

### Exception
Single-content businesses (e.g. brunch-only café): two slots MAY share a time window if they differ in **FORMAT** (one shows the dish, one shows the atmosphere).

---

## 3. Tier-Based Slot Limits

The number of slots generated depends on the subscription tier:

| Tier | Slots Generated | Content Types Allowed | Planner Active? |
|------|----------------|----------------------|----------------|
| **Free** | 1 | `menu_item` only | ❌ No |
| **Smart** (standardplus) | 3 | `menu_item` only | ❌ No |
| **Pro** (premium) | 3 | All 3 types | ✅ Yes |

### Tier Logic in Code

```typescript
// From index.ts lines 2938-2940
let plannerResult: SlotPlannerResult = { 
  slot_types: ['menu_item', 'menu_item', 'menu_item'], 
  rationale: '' 
}

if (isProTier && effectiveSlotCount > 1) {
  plannerResult = await runSlotPlanner(promptContext, GEMINI_API_KEY)
}
```

**Smart tier (standardplus)**: `menu_item` only — no planner, no atmosphere/BTS.  
**Pro tier (premium)**: Full planner decides content mix (atmosphere, BTS, etc.).  
**Free tier / late-night**: Single menu_item slot, no planner.

---

## 4. Regeneration Limits (Rate Limiting)

Daily regeneration limits prevent API abuse:

| Tier | Daily Regenerations | Production Limit | Current (Testing) |
|------|-------------------|------------------|-------------------|
| Free | 3 | 3 | 100 |
| Smart (standardplus) | 3 | 3 | 100 |
| Pro (premium) | 5 | 5 | 100 |

**Note**: Testing values are set to 100. Switch to production values before launch.

### Implementation
Location: [index.ts](supabase/functions/get-quick-suggestions/index.ts) lines 804-810

```typescript
const TIER_LIMITS: Record<string, number> = {
  free: 100,  // TESTING: 100 (Production: 3)
  standardplus: 100,  // TESTING: 100 (Production: 3)
  premium: 100,  // TESTING: 100 (Production: 5)
}
```

---

## 5. Slot Planner (Pro Tier Only)

The **Slot Planner** is an AI decision engine that determines which 3 content types to generate based on:
- Day of week & day behavior mode
- Available menu data
- Active audience segment
- Recent suggestion history (avoid repetition)
- Business model type (offer_led vs identity_led)
- Primary copy hook (location, identity, programme)
- Calendar events & active specials

### Planner Rules

1. **Always return exactly 3 slot types** in order (position 1, 2, 3)

2. **`menu_item` can be used twice** ONLY if:
   - (a) There's a clear booking/reservation menu AND an à la carte menu, OR
   - (b) There are 2+ distinct service periods with separate menus (e.g., breakfast + dinner)
   - In all other cases: **max 1 `menu_item`**

3. **`behind_scenes` can be used twice** ONLY on:
   - Days with strong BTS angle (Monday/Tuesday) AND no calendar event

4. **At least 1 of the 3 slots must be `atmosphere` OR `behind_scenes`**

5. **If no menu found**: Never use `menu_item`

6. **Business model "offer_led"**: Prioritize `menu_item` + `atmosphere` over segmented angles

7. **Primary copy hook rules**:
   - `"location"`: Slot 3 should prefer `atmosphere` (show the place & occasion)
   - `"identity"`: Slot 3 should prefer `behind_scenes` (show the people behind the brand)
   - `"programme"`: Slot 2 should reflect a time-specific occasion (afterwork, brunch)

### Planner Implementation

Location: [dagens-forslag-prompt-builder.ts](supabase/functions/_shared/dagens-forslag-prompt-builder.ts) lines 500-600

**Input signals**:
- `dayBehavior.slotBDefault` (brunch_moment, lunch_moment, afterwork_moment)
- `dayBehavior.slotCDefault` (atmosphere, behind_scenes)
- `menuCategories` (available menu data)
- `allPrograms` (service periods)
- `audienceBreadth` & `activeSegmentAngle` (persona matching)
- `recentSuggestions` (last 6 suggestions to avoid repetition)
- `calendarEventFacts` (upcoming events)
- `userContext` (business-provided steering context)

**Output**: 
```typescript
interface SlotPlannerResult {
  slot_types: string[]  // e.g., ['menu_item', 'atmosphere', 'behind_scenes']
  rationale: string     // 1-2 sentences explaining the choice
}
```

---

## 6. Database Schema

### Overview

The system uses multiple tables to track the complete lifecycle of content:

1. **`daily_suggestions`** - AI-generated Quick Suggestions (ideas)
2. **`post_drafts`** - Working drafts (planned but not published)
3. **`published_posts`** - Published content records

*See Section 12 "Post Storage & Lifecycle" for complete details on each table and the flow between them.*

### Table: `daily_suggestions` (Quick Suggestions)

Stores AI-generated post suggestions. Each business can have up to 3 active suggestions per day.

#### Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| `id` | SERIAL | Primary key |
| `business_id` | UUID | References `businesses(id)` |
| `date` / `suggestion_date` | DATE | Which day the suggestion is for |
| `position` | SMALLINT | 1, 2, or 3 (slot position) |
| `title` | TEXT | Post headline (spell-checked) |
| `content_type` | TEXT | `menu_item`, `atmosphere`, or `behind_scenes` |
| `suggested_time` | TIME/TEXT | When to post (e.g., "12:00") |
| `menu_item_name` | TEXT | Name of dish (if content_type = menu_item) |
| `menu_item_description` | TEXT | Description of dish |
| `why_explanation` | TEXT | Internal rationale (why this post now) |
| `rationale` | TEXT | Brief explanation shown to user |
| `caption_base` | TEXT | Draft caption text |
| `cta_intent` | TEXT | Call-to-action type (visit, book, order) |
| `photo_idea` | TEXT | Photo suggestion for user |
| `media_suggestion` | JSONB | Structured media guidance |
| `is_active` | BOOLEAN | FALSE when dismissed/regenerated |
| `selected` | BOOLEAN | TRUE when user clicks this suggestion |
| `created_at` | TIMESTAMPTZ | Generation timestamp |

#### Unique Constraint
```sql
UNIQUE(business_id, suggestion_date, position)
```
Each business can only have **one suggestion per position per day**.

#### Indexes
```sql
CREATE INDEX idx_daily_suggestions_business_date 
  ON daily_suggestions(business_id, suggestion_date);

CREATE INDEX idx_daily_suggestions_date 
  ON daily_suggestions(suggestion_date);
```

---

## 7. Prompt Builders by Content Type

Each content type has a dedicated prompt builder:

### `buildSlotAPrompt` - Menu Item Focus
- **Used for**: `menu_item` content type
- **Focus**: Highlight a specific dish or drink from the menu
- **Inputs**: Menu block, signature items, recent dishes to avoid
- **Output**: Post with `menu_item_name`, `menu_item_description`, food-focused `photo_idea`

### `buildSlotBPrompt` - Guest Moment Focus  
- **Used for**: `atmosphere` content type
- **Focus**: Show the social situation or occasion (why visit NOW)
- **Inputs**: Active persona, time-of-day signals, venue atmosphere facts
- **Output**: Post emphasizing the guest experience, ambiance

### `buildSlotCPrompt` - Behind Scenes Focus
- **Used for**: `behind_scenes` content type
- **Focus**: Show the people, craft, and values behind the brand
- **Inputs**: Team stories, brand character, preparation practices
- **Output**: Post showing authenticity, craft, human element

**Special case**: When Slot C needs a menu item (e.g., Pro tier, planner decides), `buildSlotAPrompt` is called with Slot C timing context.

---

## 8. Content Type Distribution Rules

### Day Behavior Defaults

Each day mode has default slot type preferences:

| Day Mode | Slot A Default | Slot B Default | Slot C Default |
|----------|---------------|----------------|----------------|
| Sunday Slow | menu_item/brunch | `brunch_moment` (atmosphere) | `atmosphere` |
| Weekday Restart (Mon) | menu_item | `lunch_moment` (atmosphere) | `behind_scenes` |
| Midweek Quiet | menu_item | `lunch_moment` (atmosphere) | `atmosphere` |
| Hump Day (Wed) | menu_item | `lunch_moment` (atmosphere) | `behind_scenes` |
| Pre-Weekend (Thu) | menu_item | `afterwork_moment` (atmosphere) | `atmosphere` |
| Friday Social | menu_item | `afterwork_moment` (atmosphere) | `atmosphere` |
| Weekend Peak | menu_item | `brunch_moment` (atmosphere) | `atmosphere` |

Source: [operational-timeline.ts](supabase/functions/get-quick-suggestions/operational-timeline.ts) lines 666-672

### Fallback Logic

If no menu data available:
- Slot A → Falls back to `atmosphere` with location/atmosphere anchor
- No `menu_item` content types generated (planner respects this)

If single-vertical business (coffee shop, bakery, bar with no food menu):
- Slot A → May use atmosphere or service-specific moment instead of menu_item

---

## 9. Media Suggestions by Content Type

Each content type triggers different media builders:

| Content Type | Media Builder | Visual Focus |
|-------------|--------------|--------------|
| `menu_item` | `buildMenuMediaInstruction` | Close-up of dish, ingredients, plating |
| `atmosphere` | `buildAtmosphereMediaInstruction` | Venue scene, guests, ambiance, outdoor |
| `behind_scenes` | `buildBehindScenesMediaInstruction` | Chef, barista, prep work, team |

Source: [dagens-forslag-prompt-builder.ts](supabase/functions/_shared/dagens-forslag-prompt-builder.ts) line 18

---

## 10. Validation & Quality Control

After generation, all suggestions pass through `validateAndRepair`:

### Cross-Slot Validation
- **Content-type mismatch detection**: Flags if `atmosphere` suggestion talks about specific dishes (should be `menu_item`)
- **Dish name extraction**: Ensures `menu_item_name` is populated for menu_item posts
- **Format repair**: Fixes JSON structure issues

### Spell Checking
- All titles are checked with `silentCorrect` (GPT-4o-mini)
- Only runs if `needsSpellingCheck` detects surface-level errors (spacing, punctuation, split compounds)
- Native-speaker tone preservation

Source: [output-validator.ts](supabase/functions/get-quick-suggestions/output-validator.ts)

---

## 11. Integration: Weekly Plan ↔ Quick Suggestions ↔ Published Posts

### 🎯 **Core Principle: Ideas Can Coexist, Posts Cannot**

**Ideas** (stored in `daily_suggestions`) can overlap without conflict:
- Weekly Plan generates ideas for Mon-Sun → stored with `source='weekly_plan'`
- User generates Quick Suggestions for Wednesday → stored with `source='quick_suggestions'`
- Both ideas exist for Wednesday ✅ No problem!

**Posts** (stored in `published_posts` and `post_ideas` with `status='scheduled'`) create deduplication needs:
- If user schedules/posts "Faust Burger" on Wednesday
- Weekly Plan for **next week** should avoid suggesting Faust Burger again
- Quick Suggestions should also avoid recently posted dishes

---

### 📊 **System Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. MONDAY: User Generates Weekly Plan                       │
├─────────────────────────────────────────────────────────────┤
│ Input queries:                                               │
│ - published_posts (last 14 days) → avoid recently posted    │
│ - post_ideas WHERE status='scheduled' → avoid already queued│
│                                                              │
│ Output:                                                      │
│ - weekly_content_plans (strategic document)                 │
│ - daily_suggestions (source='weekly_plan', one per day)     │
│                                                              │
│ Status: PLAN (not posted yet)                               │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. WEDNESDAY: User Generates Quick Suggestions              │
├─────────────────────────────────────────────────────────────┤
│ Input queries:                                               │
│ - published_posts (last 14 days) → avoid recently posted    │
│ - daily_suggestions (source='weekly_plan', date=TODAY)      │
│   → show as context note                                    │
│                                                              │
│ Output:                                                      │
│ - daily_suggestions (source='quick_suggestions', 3 ideas)   │
│                                                              │
│ UI shows:                                                    │
│ "ℹ️  Your Weekly Plan suggests: 'Outdoor seating post'"    │
│                                                              │
│ User can choose any idea (Weekly Plan OR Quick Suggestions) │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. User Creates Post from Idea                              │
├─────────────────────────────────────────────────────────────┤
│ Stages:                                                      │
│ a) Draft → post_drafts (working copy)                       │
│ b) Schedule → post_ideas (status='scheduled')               │
│ c) Publish → published_posts                                │
│                                                              │
│ Tracking fields:                                             │
│ - menu_item_name: "Faust Burger"                           │
│ - content_type: "menu_item"                                 │
│ - posted_at / scheduled_for: date                           │
│ - source: 'manual_copy_paste' | 'auto'                     │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. NEXT WEEK: Generate New Weekly Plan                      │
├─────────────────────────────────────────────────────────────┤
│ Deduplication queries:                                       │
│ - published_posts WHERE posted_at >= (14 days ago)          │
│   → Extract posted_menu_items                               │
│ - post_ideas WHERE status='scheduled'                       │
│   → Extract scheduled_menu_items                            │
│                                                              │
│ Weekly Plan avoids:                                          │
│ - "Faust Burger" (posted last week via Quick Suggestions)  │
│ - Any other recently posted dishes                          │
└─────────────────────────────────────────────────────────────┘
```

---

### ✅ **Integration Rules**

#### **Content Types**
- Weekly Plan uses **same 3 content types**: `menu_item`, `atmosphere`, `behind_scenes`
- Quick Suggestions uses **same 3 content types**
- Do not introduce new content types without updating this document

#### **Database Storage**

**Table: `daily_suggestions`**

Add `source` column to distinguish idea origin:

```sql
ALTER TABLE daily_suggestions 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'weekly_plan'
  CHECK (source IN ('quick_suggestions', 'weekly_plan'));

-- Update unique constraint to allow both sources for same date
ALTER TABLE daily_suggestions 
  DROP CONSTRAINT IF EXISTS daily_suggestions_business_id_suggestion_date_position_key;

ALTER TABLE daily_suggestions
  ADD CONSTRAINT daily_suggestions_business_date_position_source_key 
  UNIQUE(business_id, suggestion_date, position, source);
```

**Query patterns**:
- Quick Suggestions: `WHERE source = 'quick_suggestions' AND date = TODAY`
- Weekly Plan: `WHERE source = 'weekly_plan' AND date BETWEEN week_start AND week_end`
- Cross-reference: Fetch opposite source to show awareness note

#### **Deduplication Logic**

**Weekly Plan** must query:

```typescript
// 1. Published posts (what's been posted)
const { data: publishedPosts } = await supabase
  .from('published_posts')
  .select('menu_item_name, content_type, posted_at')
  .eq('business_id', businessId)
  .gte('posted_at', fourteenDaysAgo)

// 2. Scheduled posts (what's queued to post)
const { data: scheduledPosts } = await supabase
  .from('post_ideas')
  .select('caption, content_type, suggested_post_time')
  .eq('business_id', businessId)
  .eq('status', 'scheduled')
  .gte('suggested_post_time', now)

// 3. Extract menu items to avoid (14-day deduplication)
const posted_menu_items = [
  ...publishedPosts.map(p => p.menu_item_name),
  ...scheduledPosts.map(p => extractMenuItemName(p.caption))
].filter(Boolean)

// 4. Pass to strategy generator with full context
const strategy = await generateWeeklyStrategy({
  previous_week: {
    posted_menu_items,  // ← Avoids duplicate menu items
    posted_content_types: publishedPosts.map(p => p.content_type)
  },
  scheduled_posts_this_week: scheduledPosts.map(p => ({
    date: p.suggested_post_time,
    menu_item: extractMenuItemName(p.caption),
    content_type: p.content_type
  }))
  // ℹ️ AI sees scheduled posts and decides if suggesting additional posts for those days is okay
  // Example: Monday has scheduled Pasta → AI may still suggest Monday Dessert if strategic
})
```

**Quick Suggestions** already queries `published_posts` (implemented).

#### **Cross-System Awareness**

**Quick Suggestions UI** should show Weekly Plan context:

```typescript
// Fetch Weekly Plan idea for today
const { data: weeklyPlanIdea } = await supabase
  .from('daily_suggestions')
  .select('title, rationale, content_type')
  .eq('business_id', businessId)
  .eq('source', 'weekly_plan')
  .eq('suggestion_date', TODAY)
  .limit(1)

// Show in UI if exists
if (weeklyPlanIdea) {
  showNote(`ℹ️  Your Weekly Plan suggests: "${weeklyPlanIdea.title}"`)
}
```

**Weekly Plan UI** should show scheduled AND posted content:

```typescript
// 1. Fetch scheduled posts for the week
const { data: scheduledPosts } = await supabase
  .from('post_ideas')
  .select('*')
  .eq('business_id', businessId)
  .eq('status', 'scheduled')
  .gte('scheduled_for', weekStart)
  .lte('scheduled_for', weekEnd)

// 2. Fetch already posted content
const { data: publishedPosts } = await supabase
  .from('published_posts')
  .select('*')
  .eq('business_id', businessId)
  .gte('posted_at', weekStart)
  .lte('posted_at', weekEnd)

// 3. Mark days with scheduled/posted content
planDays.forEach(day => {
  // Show scheduled posts (from Skriv Selv or Quick Suggestions)
  const scheduledOnDay = scheduledPosts.filter(p => 
    isSameDay(p.scheduled_for, day.date)
  )
  
  // Show published posts
  const postedOnDay = publishedPosts.filter(p => 
    isSameDay(p.posted_at, day.date)
  )
  
  if (scheduledOnDay.length > 0) {
    day.scheduledPosts = scheduledOnDay
    day.hasScheduled = true
  }
  
  if (postedOnDay.length > 0) {
    day.publishedPosts = postedOnDay
    day.hasPosted = true
  }
  
  // UI can show both: "✅ Posted: Pasta Carbonara" and "📅 Scheduled: Weekly Special"
})
```

**AI Context for Weekly Plan Generation**: When generating the weekly plan, scheduled posts should be passed to the AI so it can adjust the strategy:

```typescript
// Before calling generateWeeklyStrategy, fetch scheduled posts
const { data: scheduledPosts } = await supabase
  .from('post_ideas')
  .select('*')
  .eq('business_id', businessId)
  .eq('status', 'scheduled')
  .gte('scheduled_for', weekStart)
  .lte('scheduled_for', weekEnd)

// Pass to AI context
const strategy = await generateWeeklyStrategy({
  scheduled_posts_this_week: scheduledPosts.map(p => ({
    date: p.scheduled_for,
    content_type: p.content_type,
    menu_item: extractMenuItemName(p.caption),
    source: p.source // 'manual_copy_paste' or from which suggestion
  })),
  // ... other context
})

// ℹ️ AI decides if multiple posts per day is acceptable
// Example: Monday has scheduled post → AI may still suggest Monday post if strategically valuable
```

#### **Validation & Quality**
- Both systems use `validateAndRepair` from [output-validator.ts](supabase/functions/get-quick-suggestions/output-validator.ts)
- Both systems use `silentCorrect` for spell checking
- Same content-type mismatch detection rules

#### **Regeneration Quotas**
- Quick Suggestions: Check `TIER_LIMITS` before generating
- Weekly Plan: No daily quota (generates once per week)
- Both respect tier-based limits

---

### ⚠️ **Key Differences**

| Aspect | Quick Suggestions | Weekly Plan |
|--------|------------------|-------------|
| **Purpose** | Tactical same-day ideas | Strategic week-ahead planning |
| **Scope** | TODAY only | 7 days (Mon-Sun) |
| **Content Mix** | Smart tier: menu_item only<br>Pro tier: All 3 types | All tiers: All 3 types<br>(brand building) |
| **Planner** | Uses `runSlotPlanner`<br>(dagens-forslag-prompt-builder.ts) | Uses custom Phase 2a planner<br>(strategy/phase2/phase2a.ts) |
| **Timing** | Real-time (suggestions for NOW) | Future-looking (next week) |
| **Regeneration** | Daily quota enforced | Once per week typical |
| **Storage** | `source='quick_suggestions'` | `source='weekly_plan'` |
| **Position** | 1-3 (3 slots per day) | 1-3 (one per day of week) |

---

### 🚀 **Implementation Checklist**

#### **Phase 1: Database Schema** (Required First)
- [ ] Add `source` column to `daily_suggestions`
- [ ] Update unique constraint to include `source`
- [ ] Create index: `CREATE INDEX idx_daily_suggestions_source ON daily_suggestions(business_id, source, suggestion_date)`

#### **Phase 2: Weekly Plan Deduplication & Context** (Critical)
- [ ] Update `get-weekly-strategy` to query `published_posts` (for 14-day menu item deduplication)
- [ ] Update `get-weekly-strategy` to query `post_ideas WHERE status='scheduled'` (for menu item deduplication)
- [ ] Pass scheduled posts for the upcoming week to AI context (so AI can decide if multiple posts/day is okay)
- [ ] Pass combined menu items to `posted_menu_items` context for deduplication

#### **Phase 3: Weekly Plan Storage**
- [ ] Update `weekly-plan-generator.ts` to set `source='weekly_plan'` when writing to `daily_suggestions`
- [ ] Update `weekly-plan-generator.ts` to handle existing `source='quick_suggestions'` gracefully (no overwrite)

#### **Phase 4: Quick Suggestions Awareness**
- [ ] Query Weekly Plan ideas for TODAY in `get-quick-suggestions`
- [ ] Pass to UI response for context note display
- [ ] Set `source='quick_suggestions'` when writing

#### **Phase 5: UI Updates**
- [ ] Quick Suggestions UI: Show Weekly Plan note if exists for today
- [ ] Weekly Plan UI: Show scheduled posts (from `post_ideas.status='scheduled'`) per day
- [ ] Weekly Plan UI: Show posted content (from `published_posts`) per day
- [ ] Weekly Plan UI: Distinguish between plan ideas, scheduled posts, and published posts
- [ ] Both UIs: Visual indicators for source (Weekly Plan idea vs Quick Suggestion idea)

---

### 📝 **Current Implementation Status**

**Implemented** ✅:
- Weekly Plan generates to `weekly_content_plans` + `daily_suggestions`
- Quick Suggestions generates to `daily_suggestions`
- `published_posts` table tracks posted content
- Quick Suggestions queries `published_posts` for deduplication

**Not Implemented** ❌:
- `source` column in `daily_suggestions` (both systems overwrite each other!)
- Weekly Plan doesn't query `published_posts` (misses Quick Suggestion posts)
- Weekly Plan doesn't query `post_ideas.status='scheduled'`
- Cross-system awareness UI (no notes shown)

**Risk** 🚨:
- Current behavior: Quick Suggestions **overwrites** Weekly Plan data for the same day
- User generates Weekly Plan → Wednesday has an idea
- User generates Quick Suggestions on Wednesday → **Weekly Plan idea is lost**

---

### ⚠️ **Differentiation for Weekly Plan**
Weekly Plan differs in:
- **Planning horizon**: 7 days ahead (not same-day)
- **Posting times**: Pre-scheduled calendar slots
- **Persona diversity**: May span multiple audience segments across the week
- **Content balance**: Should ensure weekly variety (not just daily)

**Recommendation**: Create `runWeeklyPlanner` that calls `runSlotPlanner` 7 times (once per day) with day-specific context, ensuring weekly-level distribution balance.

---

## 12. Post Storage & Lifecycle

⚠️ **IMPORTANT UPDATE (2026-06-03)**: The `post_drafts` table documented below **does not currently exist** in the database. It was dropped in migration `20260602000001_cleanup_unused_tables.sql` as "never implemented, always empty".

**Current Reality**:
- ✅ `daily_suggestions` - EXISTS (AI-generated ideas)
- ❌ `post_drafts` - DOES NOT EXIST (was dropped)
- ✅ `published_posts` - EXISTS (published content only)

**See [DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md](DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md) for detailed analysis and recommendation.**

---

The system currently uses two main tables:

### Table 1: `daily_suggestions` (AI Ideas) - ✅ EXISTS

**Purpose**: Stores AI-generated Quick Suggestions (the "ideas" shown on dashboard)

**Key columns**:
- `business_id`, `date`, `position` (1-3)
- `title`, `content_type`, `suggested_time`
- `menu_item_name`, `why_explanation`, `rationale`
- `is_active` (FALSE when dismissed/regenerated)

**Lifecycle**: Created by `get-quick-suggestions` Edge Function → User clicks to start draft

**Storage location**: Database table `daily_suggestions`

---

### Table 2: `post_drafts` (Working Drafts) - ❌ DOES NOT EXIST

**Status**: This table was **dropped** in migration `20260602000001_cleanup_unused_tables.sql` (June 2026) because it was "never implemented, always empty".

**Original Purpose**: Store draft posts being created but not yet published

**Schema exists in**: [20260302000000_extend_post_drafts_idea_context.sql](supabase/migrations/20260302000000_extend_post_drafts_idea_context.sql) (but table was later dropped)

⚠️ **To implement draft/scheduled post functionality**, you need to either:
1. **Extend `published_posts`** with `status` column (recommended - see analysis doc)
2. **Recreate `post_drafts`** table (more complex)

See [DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md](DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md) for detailed options.

---

### Table 3: `published_posts` (Published Content) - ✅ EXISTS

**Purpose**: Stores draft posts that are being created but not yet published

**Key columns**:
| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Owner (references auth.users) |
| `business_id` | UUID | Which business (optional - may derive from user) |
| `idea_source` | TEXT | `'user'`, `'quick_suggestions'`, or `'weekly_plan'` |
| `idea_data` | JSONB | Snapshot of original idea context |
| `strategy_id` | UUID | FK to weekly_strategies (if from Weekly Plan) |
| `idea_index` | INT | Which post in the weekly strategy (0-based) |
| `phase` | TEXT | Current wizard step: `'idea'`, `'create'`, or `'publish'` |
| `selected_platforms` | TEXT[] | Target platforms (facebook, instagram, etc.) |
| `post_content` | JSONB | Draft post text/caption |
| `photo_content` | JSONB | Selected/uploaded photo data |
| `photo_idea` | TEXT | Photo suggestion from AI |
| `media_analysis` | JSONB | AI photo analysis result |
| `caption_data` | JSONB | Generated caption + hashtags + CTA |
| `created_at` | TIMESTAMPTZ | When draft was created |
| `updated_at` | TIMESTAMPTZ | Last edit time |

**Lifecycle**: 
1. User clicks Quick Suggestion → creates draft with `idea_source='quick_suggestions'`
2. User starts manual post → creates draft with `idea_source='user'`
3. Weekly Plan card clicked → creates draft with `idea_source='weekly_plan'` + `strategy_id`
4. User works through wizard (`phase: 'idea' → 'create' → 'publish'`)
5. User publishes → record moves to `published_posts`, draft optionally archived

**Scheduled/Future Posts**:
- Drafts can be created for future dates (e.g., "next Friday")
- No explicit `scheduled_for` date in current schema - consider adding if scheduling is needed
- User can set `posted_at` in `published_posts` to past or future date when confirming publication
- Weekly Plan integration should store intended posting date in `idea_data.suggestedDay`

**Storage location**: Database table `post_drafts` ⚠️ **DOES NOT EXIST - needs implementation**  
**Migration**: [20260302000000_extend_post_drafts_idea_context.sql](supabase/migrations/20260302000000_extend_post_drafts_idea_context.sql) (schema exists, table was dropped)

**Recommended Schema Enhancement**:
See [DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md](DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md) - recommends extending `published_posts` with `status` column instead of recreating separate draft table.

---

### Table 3: `published_posts` (Published Content)

**Purpose**: Records every actually-published post (manual or auto)

**Key columns**:
| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `business_id` | UUID | Which business posted this |
| `user_id` | UUID | Who published it |
| `platform` | TEXT | `facebook` or `instagram` |
| `post_text` | TEXT | Actual posted text (copy of what was shown) |
| `photo_url` | TEXT | Photo that was included |
| `source` | TEXT | `'manual_copy_paste'` or `'auto'` |
| `content_type` | TEXT | `menu_item`, `atmosphere`, `behind_scenes` |
| `menu_item_id` | UUID | Link to specific menu item (if applicable) |
| `menu_item_name` | TEXT | Name of dish featured |
| `weekly_plan_id` | UUID | FK to weekly_content_plans (if from plan) |
| `weekly_plan_slot_date` | DATE | Which planned date this fulfilled |
| `posted_at` | TIMESTAMPTZ | User-selected posting time |
| `published_at` | TIMESTAMPTZ | Alias of posted_at (backwards compatibility) |

**Lifecycle**: 
- Created when user confirms publication (via manual modal or auto-posting)
- Used by recency filters (avoid re-posting same dish within 14 days)
- Feeds posting timeline UI

**Storage location**: Database table `published_posts`  
**Migration**: [20260528000001_published_posts_full_schema.sql](supabase/migrations/20260528000001_published_posts_full_schema.sql)
 (Proposed)

⚠️ **Note**: This flow requires implementing draft storage. Currently only steps 1 and 4 exist in database.

```
┌─────────────────────┐
│ Quick Suggestions   │ ✅ EXISTS
│ (daily_suggestions) │ ← get-quick-suggestions Edge Function
└──────────┬──────────┘   generates 1-3 AI ideas per day
           │ 
           │ User clicks idea
           ↓
┌─────────────────────┐
│   Draft Created     │ ❌ NOT IMPLEMENTED
│ (needs: status col) │ ← Currently drafts work in frontend only
└──────────┬──────────┘   No database persistence for WIP posts
           │
           │ User uploads photo, generates caption
           ↓
┌─────────────────────┐
│  Caption Generated  │ ❌ NOT IMPLEMENTED  
│ (needs: status col) │ ← Draft would store media_analysis, caption_data
└──────────┬──────────┘   
           │
           │ User reviews & confirms publish
           ↓
┌─────────────────────┐
│  Post Published     │ ✅ EXISTS
│ (published_posts)   │ ← Record created on publish
└─────────────────────┘   source, content_type, menu_item_name preserved

Recency Filter:
published_posts.content_type + menu_item_name + posted_at
→ used to avoid repeating same content within 14 days
```

**To implement full flow**: See [DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md](DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md)ency Filter:
published_posts.content_type + menu_item_name + posted_at
→ used to avoid repeating same content within 14 days
```

---

### Legacy Table: `suggested_posts` - ❌ LIKELY DROPPED

**Status**: Appears to be deprecated/dropped

**Evidence**:
- Backup file exists: `20260108125900_drop_suggested_posts.sql.bak`
- Not referenced in current codebase
- Likely dropped same time as `post_drafts`

**Original columns**: `post_content`, `platform`, `idea_source`, `slot_id`, `status` (`draft`/`scheduled`/`published`)

**Migration**: [20260108130000_create_suggested_posts.sql](supabase/migrations/20260108130000_create_suggested_posts.sql) (created but later dropped)

⚠️ **Do not use** - appears to be legacy system replaced by `daily_suggestions` + `published_posts` flow.

---

## Summary: Current vs Intended State

| Component | Current State | Needed for Draft/Scheduled Posts |
|-----------|---------------|----------------------------------|
| **AI Ideas** | ✅ `daily_suggestions` exists | No change needed |
| **Working Drafts** | ❌ No storage (frontend only) | Need `status` column in `published_posts` |
| **Scheduled Posts** | ❌ Not supported | Need `status='scheduled'` + `scheduled_for` |
| **Published Posts** | ✅ `published_posts` exists | Add status tracking |

**Action Required**: Implement [DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md](DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md) Option 1 (extend `published_posts`)

---

### Weekly Plan Integration Notes

⚠️ **Prerequisites**: Before implementing Weekly Plan draft functionality, first implement draft storage system as documented in [DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md](DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md).

When implementing Weekly Plan (after draft storage is ready), ensure:

1. **Draft Creation**: Set `idea_source='weekly_plan'` in status field
2. **Strategy Linkage**: Set `weekly_plan_id` to link back to weekly strategy  
3. **Idea Context**: Store full idea snapshot in appropriate JSONB field
4. **Scheduling**: Set `scheduled_for` date and `status='scheduled'`
5. **Publishing**: When published, update `status='published'`, set `posted_at`

This allows:
- Tracking which Weekly Plan cards have been used
- Recovering drafts if user abandons wizard
- Closing the loop: mark plan card as "posted" when published
- Recency filtering includes Weekly Plan posts

---

## 13. Files to Review

### Core Logic
- **Slot Planner**: [dagens-forslag-prompt-builder.ts](supabase/functions/_shared/dagens-forslag-prompt-builder.ts) lines 500-600
- **Main Orchestrator**: [get-quick-suggestions/index.ts](supabase/functions/get-quick-suggestions/index.ts)
- **Operational Timeline**: [operational-timeline.ts](supabase/functions/get-quick-suggestions/operational-timeline.ts)

### Database
- **Quick Suggestions Schema**: [20260514000000_add_daily_suggestions_schema.sql](supabase/migrations/20260514000000_add_daily_suggestions_schema.sql)
- **Quick Suggestions Original**: [20260218130000_create_daily_suggestions.sql](supabase/migrations/20260218130000_create_daily_suggestions.sql)
- **Post Drafts Schema**: [20260302000000_extend_post_drafts_idea_context.sql](supabase/migrations/20260302000000_extend_post_drafts_idea_context.sql)
- **Published Posts Schema**: [20260528000001_published_posts_full_schema.sql](supabase/migrations/20260528000001_published_posts_full_schema.sql)

### Validation
- **Output Validator**: [output-validator.ts](supabase/functions/get-quick-suggestions/output-validator.ts)
- **Spell Check**: [silent-correct.ts](supabase/functions/_shared/utils/silent-correct.ts)

### Repository Memory
- **Slot Distribution Rule**: [/memories/repo/slot-distribution-rule.md](/memories/repo/slot-distribution-rule.md)
- **Deployment Workflow**: [/memories/repo/deployment-workflow.md](/memories/repo/deployment-workflow.md)

---

## 14. TODO / Known Gaps

⚠️ **Time window differentiation**: NOT yet explicitly enforced in slot planner.  
- `suggested_time` is currently derived from active service period, not planned per slot
- **TODO**: Slot planner should assign a `target_time_window` per slot (e.g., "brunch", "lunch", "dinner")
- Each prompt should frame its slot for that specific time window

✅ **Content type differentiation**: WORKING (menu_item / atmosphere / behind_scenes)

✅ **Persona timing**: FIXED - now matches personas to target posting time, not generation time

✅ **Prompt capitals**: FIXED - changed "FOR I DAG" → "for i dag" to prevent AI quoting

---

### Scheduling & Future Posts

**Current State**:
- ❌ No draft storage exists in database
- ❌ No scheduled post functionality implemented
- Drafts work in frontend session only (lost on page refresh)

**To Implement** (see [DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md](DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md)):

**Option 1 (Recommended)**: Extend `published_posts` table
```sql
ALTER TABLE published_posts 
  ADD COLUMN status TEXT DEFAULT 'published'
    CHECK (status IN ('draft', 'scheduled', 'published'));
  ADD COLUMN scheduled_for DATE;
  ADD COLUMN idea_source TEXT DEFAULT 'manual';
```

**Option 2**: Recreate separate `post_drafts` table (more complex)

**Workflow After Implementation**:
1. User creates draft → `status='draft'`
2. User schedules for Friday → `status='scheduled'`, `scheduled_for='2026-06-06'`
3. User publishes → `status='published'`, `posted_at=NOW()`

**See detailed analysis**: [DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md](DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md)

---

**END OF DOCUMENT**
