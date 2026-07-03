# Quick Start: Timing Context UI

**Get up and running in 5 minutes**

---

## 1️⃣ Add Timing Banner to Manual Post Creation

**File:** `src/components/post-creation/GenerateStep.tsx`

```tsx
// Add these imports at the top
import { TimingContextBanner, useTimingContext } from '../timing'

// Inside your GenerateStep component
export function GenerateStep() {
  const { context, isLoading } = useTimingContext()
  
  return (
    <div className="generate-step">
      {/* Add timing banner */}
      {!isLoading && (
        <TimingContextBanner 
          context={context} 
          className="mb-4"
        />
      )}
      
      {/* Your existing editor */}
      <EditorPane {...props} />
    </div>
  )
}
```

**Result:** Users see soft guidance like:
- "💡 Fredag aften passer godt til vennegrupper — Fokuser på gruppe-oplevelser"
- "⚡ Mandag frokost er for alle — Fokuser på AYCE værdi og beliggenhed"

---

## 2️⃣ Add Timing Badges to Weekly Plan Cards

**File:** `src/components/weekly-plan/WeeklyPlanOverview.tsx` (or your post card component)

```tsx
// Add import
import { TimingBadge } from '../timing'

// Inside your post card component
function PostCard({ post }) {
  const { mode, displayText } = post.segmentCoverage || {
    mode: 'gap_capacity',
    displayText: 'Åbent for alle'
  }
  
  return (
    <div className="post-card">
      {/* Header with badge */}
      <div className="flex items-start justify-between">
        <h3>{post.title}</h3>
        <TimingBadge mode={mode} label={displayText} />
      </div>
      
      {/* Rest of card */}
    </div>
  )
}
```

**Result:** Each post card shows:
- 🎯 For vennegrupper (blue badge)
- ⚡ Åbent for alle (purple badge)

---

## 3️⃣ Add Weekly Plan Summary

**File:** Same as above, in the weekly plan overview

```tsx
// Add imports
import { WeeklyPlanSummary, useWeeklyPlanSummary } from '../timing'

// Above your post list
function WeeklyPlanOverview({ posts }) {
  const summary = useWeeklyPlanSummary(posts)
  
  return (
    <div>
      {/* Add summary widget */}
      <WeeklyPlanSummary {...summary} className="mb-6" />
      
      {/* Your existing post grid/list */}
      <PostList posts={posts} />
    </div>
  )
}
```

**Result:** Shows reassuring overview:
```
Din uge (7 posts)
🎯 3 målrettede posts
⚡ 4 bred appel posts

💡 Blandet strategi — begge typer arbejder for dig
```

---

## ✅ That's It!

**Three simple additions give you:**
- ✅ Timing hints in manual post creation
- ✅ Visual badges on weekly plan cards
- ✅ Reassuring summary of content mix

**No configuration needed** - components automatically load strategic segments from brand profile.

---

## 🎨 Customization (Optional)

### Change Banner Style

```tsx
{/* Compact version */}
<TimingContextBanner context={context} variant="compact" />

{/* Tooltip version */}
<TimingContextBanner context={context} variant="tooltip" />
```

### Override Time (for scheduled posts)

```tsx
const { context } = useTimingContext({
  overrideTime: { day: 'Friday', time: '19:00' }
})
```

### Add Tooltip to Badge

```tsx
import { getTooltipText } from '../timing'

const tooltipText = getTooltipText(post.segmentCoverage)

<div title={tooltipText}>
  <TimingBadge mode={mode} label={displayText} />
</div>
```

---

## 📚 Next Steps

- See [README.md](src/components/timing/README.md) for complete API docs
- See [GenerateStepExamples.tsx](src/components/timing/GenerateStepExamples.tsx) for more integration options
- See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for full overview

---

**Ready to go! 🚀**
