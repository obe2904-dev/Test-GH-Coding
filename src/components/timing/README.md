# Timing Context UI Components

**Soft, reassuring UI for strategic segment timing**

## Philosophy

All times are good times. Some get laser-focused content (strategic segments), others get broad appeal (gap capacity). The UI should feel reassuring, never hierarchical.

**Golden Rules:**
- ✅ Show the OUTCOME, not the SYSTEM
- ✅ Use soft, reassuring language ("passer godt", "bred appel")
- ✅ Avoid percentages and performance comparisons
- ✅ Never say "gap-time" or "capacity" to users
- ✅ Make every time feel valuable

---

## Quick Start

### 1. Show Timing Context Banner (Manual Post Creation)

```tsx
import { TimingContextBanner, useTimingContext } from '@/components/timing'

function GenerateStep() {
  const { context, isLoading } = useTimingContext()
  
  if (isLoading) return null
  
  return (
    <div>
      {/* Show timing hint at top of editor */}
      <TimingContextBanner context={context} />
      
      {/* Your post editor here */}
    </div>
  )
}
```

**Result:**
```
┌────────────────────────────────────────────────────┐
│ 💡 Fredag aften passer godt til vennegrupper       │
│    Fokuser på: gruppe-oplevelser og deling         │
└────────────────────────────────────────────────────┘
```

---

### 2. Show Timing Badge on Post Cards

```tsx
import { TimingBadge } from '@/components/timing'

function WeeklyPlanPostCard({ post }) {
  const { mode, displayText } = post.segmentCoverage || {
    mode: 'gap_capacity',
    displayText: 'Åbent for alle'
  }
  
  return (
    <div className="post-card">
      <TimingBadge mode={mode} label={displayText} />
      <h3>{post.title}</h3>
      {/* Rest of card */}
    </div>
  )
}
```

**Result:**
```
🎯 For vennegrupper   (blue badge)
⚡ Åbent for alle      (purple badge)
```

---

### 3. Show Weekly Plan Summary

```tsx
import { WeeklyPlanSummary, useWeeklyPlanSummary } from '@/components/timing'

function WeeklyPlanOverview({ posts }) {
  const summary = useWeeklyPlanSummary(posts)
  
  return (
    <div>
      <WeeklyPlanSummary {...summary} />
      
      {/* Your weekly plan posts */}
    </div>
  )
}
```

**Result:**
```
┌─────────────────────────────────┐
│ Din uge (7 posts)               │
│ Alle tidspunkter dækket         │
├─────────────────────────────────┤
│ 🎯 3 målrettede posts           │
│ ⚡ 4 bred appel posts           │
├─────────────────────────────────┤
│ 💡 Blandet strategi — begge     │
│    typer arbejder for dig       │
└─────────────────────────────────┘
```

---

### 4. Add Tooltips to Post Cards

```tsx
import { getTooltipText } from '@/components/timing'

function PostCard({ post }) {
  const tooltipText = getTooltipText(post.segmentCoverage)
  
  return (
    <div title={tooltipText}>
      {/* Post card content */}
    </div>
  )
}
```

**Result on hover:**
```
Vennegrupper
Vi ved, de kommer — så vi taler direkte til dem
```

---

### 5. Scheduling Calendar with Hints

```tsx
import { getDayLabel, POST_TYPE_LABELS } from '@/components/timing'

function SchedulingPicker({ segments }) {
  return (
    <div>
      <h3>Vælg posting-tid</h3>
      
      <div className="day-slot">
        <TimeBadge icon="⚡" />
        Mandag 13:00 — Åbent for alle
      </div>
      
      <div className="day-slot">
        <TimeBadge icon="🎯" />
        Fredag 19:00 — Vennegrupper (stærkt valg)
      </div>
      
      <footer>
        💡 Alle tider er gode — vi guider dig til hvad der passer bedst
      </footer>
    </div>
  )
}
```

---

## Component API Reference

### `TimingContextBanner`

Display timing context with soft guidance.

**Props:**
- `context: TimingContext` - Timing context object
- `variant?: 'default' | 'compact' | 'tooltip'` - Display style
- `className?: string` - Additional CSS classes

**Variants:**
- `default` - Full banner with icon, title, and subtitle
- `compact` - Small inline badge
- `tooltip` - Tooltip-friendly text format

**Example:**
```tsx
<TimingContextBanner context={context} variant="default" />
```

---

### `TimingBadge`

Small badge for post cards.

**Props:**
- `mode: 'strategic_segment' | 'gap_capacity'` - Timing mode
- `label: string` - Display text (e.g., "For vennegrupper")
- `className?: string` - Additional CSS classes

**Example:**
```tsx
<TimingBadge mode="strategic_segment" label="For vennegrupper" />
```

---

### `WeeklyPlanSummary`

Overview of post mix in weekly plan.

**Props:**
- `totalPosts: number` - Total number of posts
- `targetedPosts: number` - Number of strategic segment posts
- `broadAppealPosts: number` - Number of gap-time posts
- `className?: string` - Additional CSS classes

**Example:**
```tsx
<WeeklyPlanSummary 
  totalPosts={7} 
  targetedPosts={3} 
  broadAppealPosts={4} 
/>
```

---

## Hook API Reference

### `useTimingContext()`

Get current timing context with strategic segments.

**Options:**
- `overrideTime?: { day: string; time: string }` - Override current time

**Returns:**
- `context: TimingContext` - Current timing context
- `isLoading: boolean` - Loading state
- `hasSegments: boolean` - Whether strategic segments exist

**Example:**
```tsx
const { context, isLoading, hasSegments } = useTimingContext()

// Override time for scheduled posts
const { context } = useTimingContext({
  overrideTime: { day: 'Friday', time: '19:00' }
})
```

---

### `useWeeklyPlanSummary(posts)`

Calculate weekly plan post distribution.

**Args:**
- `posts: any[]` - Array of posts with segmentCoverage

**Returns:**
- `totalPosts: number`
- `targetedPosts: number`
- `broadAppealPosts: number`

**Example:**
```tsx
const summary = useWeeklyPlanSummary(weeklyPlan.posts)
```

---

## Utility Functions

### Timing Context

```tsx
import {
  getCurrentTimingContext,  // Get timing context for a time
  getTimingHintText,        // Get banner hint text
  getTooltipText,           // Get tooltip text
  getBadgeLabel,            // Get badge label
  formatContextBanner       // Format for banner display
} from '@/components/timing'
```

### UI Messages

```tsx
import {
  getWeeklyPlanSummaryMessage,  // Get summary text
  getTimingStrategyHelpText,    // Get help section text
  getDayReassurance,            // Get day-specific comfort text
  REASSURANCE_PHRASES,          // Pre-written comfort phrases
  POST_TYPE_LABELS              // Icon + label constants
} from '@/components/timing'
```

---

## Language Patterns

### ✅ DO SAY (User-Friendly)

- "For vennegrupper" / "For familier"
- "Åbent for alle"
- "Bred appel"
- "Passer godt til..."
- "Stærkt valg"
- "Målrettet indhold"
- "Alle tider er gode"

### ❌ DON'T SAY (Technical)

- "Strategic segment"
- "Gap-time capacity"
- "Segment match mode"
- "Passive capacity"
- Performance percentages
- "Better" / "Worse"

---

## Integration Examples

### Example 1: Add to GenerateStep.tsx

```tsx
import { TimingContextBanner, useTimingContext } from '@/components/timing'

export function GenerateStep() {
  const { context } = useTimingContext()
  
  return (
    <div className="generate-step">
      {/* Add timing banner at top */}
      <TimingContextBanner context={context} className="mb-4" />
      
      {/* Existing editor */}
      <EditorPane {...props} />
    </div>
  )
}
```

### Example 2: Add to Weekly Plan Cards

```tsx
import { TimingBadge } from '@/components/timing'

function PostCard({ post }) {
  return (
    <div className="post-card">
      <div className="card-header">
        <h3>{post.title}</h3>
        <TimingBadge 
          mode={post.segmentCoverage?.mode || 'gap_capacity'}
          label={post.segmentCoverage?.displayText || 'Åbent for alle'}
        />
      </div>
      {/* Rest of card */}
    </div>
  )
}
```

### Example 3: Add to Weekly Plan Overview

```tsx
import { WeeklyPlanSummary, useWeeklyPlanSummary } from '@/components/timing'

function WeeklyPlanOverview({ plan }) {
  const summary = useWeeklyPlanSummary(plan.posts)
  
  return (
    <div>
      <WeeklyPlanSummary {...summary} className="mb-6" />
      <PostsList posts={plan.posts} />
    </div>
  )
}
```

---

## Styling Guide

**Colors:**
- Strategic segments: Blue (`bg-blue-50`, `text-blue-700`)
- Broad appeal: Purple (`bg-purple-50`, `text-purple-700`)

**Icons:**
- Strategic: 🎯
- Broad appeal: ⚡
- Help/tips: 💡

**Tone:**
- Reassuring, never anxious
- Inclusive ("åbent for alle")
- Positive framing ("passer godt", "stærkt valg")

---

## Questions?

See the source files:
- `src/lib/segmentTimingContext.ts` - Core timing logic
- `src/lib/weeklyPlanUIMessages.ts` - UI message helpers
- `src/components/timing/TimingContextBanner.tsx` - React components
- `src/hooks/useTimingContext.ts` - React hooks
