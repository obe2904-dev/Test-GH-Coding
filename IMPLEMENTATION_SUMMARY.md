# Timing Context UI Implementation Summary

## ✅ What Was Implemented

### 1. Core Utilities & Logic

**[src/lib/segmentTimingContext.ts](src/lib/segmentTimingContext.ts)**
- `getCurrentTimingContext()` - Matches current/specified time to strategic segments or gap capacity
- Soft, reassuring Danish language for all UI display
- Helper functions for formatting badges, tooltips, banners
- Handles day ranges (e.g., "Lør-Søn") and time windows

**[src/lib/weeklyPlanUIMessages.ts](src/lib/weeklyPlanUIMessages.ts)**
- Pre-written comfort phrases and reassuring messages
- Weekly plan summary messages
- Help text for onboarding/documentation
- Constants for consistent language across UI

### 2. React Components

**[src/components/timing/TimingContextBanner.tsx](src/components/timing/TimingContextBanner.tsx)**

Three reusable components:

1. **`<TimingContextBanner />`** - Full banner with icon, title, subtitle
   - Variants: `default`, `compact`, `tooltip`
   - Shows "💡 Fredag aften passer godt til vennegrupper"

2. **`<TimingBadge />`** - Small badge for post cards
   - Shows "🎯 For vennegrupper" or "⚡ Åbent for alle"
   - Color-coded (blue for strategic, purple for broad appeal)

3. **`<WeeklyPlanSummary />`** - Weekly plan overview widget
   - Shows post distribution (3 målrettede, 4 bred appel)
   - Reassuring footer message

### 3. React Hooks

**[src/hooks/useTimingContext.ts](src/hooks/useTimingContext.ts)**

1. **`useTimingContext()`** - Get current timing context with strategic segments
   - Loads from brand profile automatically
   - Supports time override for scheduled posts
   - Returns loading state

2. **`useWeeklyPlanSummary(posts)`** - Calculate post distribution
   - Counts strategic vs. broad appeal posts
   - Returns summary data for UI display

### 4. Documentation & Examples

**[src/components/timing/README.md](src/components/timing/README.md)**
- Complete API reference
- Integration examples
- Language guidelines
- Styling guide

**[src/components/timing/GenerateStepExamples.tsx](src/components/timing/GenerateStepExamples.tsx)**
- 5 different implementation options for manual post creation
- Copy-paste ready code examples
- Recommended implementation pattern

**[src/components/timing/WeeklyPlanCardExamples.tsx](src/components/timing/WeeklyPlanCardExamples.tsx)**
- 6 different card layout options
- Grid and list view examples
- Tooltip integration patterns

### 5. TypeScript Types

All components are fully typed with:
- `TimingContext` interface
- Component prop types
- Hook return types
- Helper function signatures

---

## 🎯 Key Features

### Language Philosophy

✅ **Soft & Reassuring**
- "Passer godt til vennegrupper" (not "targets segment")
- "Åbent for alle" (not "gap-time")
- "Bred appel" (not "capacity filling")
- "Alle tider er gode" (baseline comfort)

✅ **No Hierarchy**
- Never implies some times are "better"
- Both strategic and broad appeal have value
- "Different strengths" not "different performance"

✅ **No Percentages**
- "Stærk respons" not "45% better"
- "Solidt engagement" not metrics
- Patterns over numbers

### Visual System

**Icons:**
- 🎯 Strategic segment (targeted)
- ⚡ Broad appeal (open to all)
- 💡 Tips/help

**Colors:**
- Blue for strategic (`bg-blue-50`, `text-blue-700`)
- Purple for broad appeal (`bg-purple-50`, `text-purple-700`)

**Badges:**
- Small, unobtrusive
- Color-coded but not alarming
- Tooltip on hover for details

---

## 📋 Integration Checklist

### Quick Start (Minimal)

1. **Add timing banner to GenerateStep:**
   ```tsx
   import { TimingContextBanner, useTimingContext } from '@/components/timing'
   
   const { context } = useTimingContext()
   return <TimingContextBanner context={context} />
   ```

2. **Add timing badges to weekly plan cards:**
   ```tsx
   import { TimingBadge } from '@/components/timing'
   
   <TimingBadge 
     mode={post.segmentCoverage?.mode || 'gap_capacity'}
     label={post.segmentCoverage?.displayText || 'Åbent for alle'}
   />
   ```

3. **Add weekly plan summary:**
   ```tsx
   import { WeeklyPlanSummary, useWeeklyPlanSummary } from '@/components/timing'
   
   const summary = useWeeklyPlanSummary(posts)
   return <WeeklyPlanSummary {...summary} />
   ```

### Full Integration (Recommended)

1. ✅ GenerateStep - Timing context banner
2. ✅ Weekly plan cards - Timing badges with tooltips
3. ✅ Weekly plan overview - Summary widget
4. ✅ Scheduling calendar - Day labels with hints
5. ✅ Help section - Strategy explanation
6. ✅ Analytics (future) - Pattern comparison without percentages

---

## 🗂️ File Structure

```
src/
├── lib/
│   ├── segmentTimingContext.ts          # Core timing logic
│   └── weeklyPlanUIMessages.ts          # UI message helpers
├── hooks/
│   └── useTimingContext.ts              # React hooks
└── components/
    └── timing/
        ├── index.ts                     # Barrel exports
        ├── README.md                    # Documentation
        ├── TimingContextBanner.tsx      # React components
        ├── GenerateStepExamples.tsx     # Integration examples
        └── WeeklyPlanCardExamples.tsx   # Card examples
```

---

## 🔄 Data Flow

### 1. Brand Profile Generation
```
brand-profile-generator-v5 
  → Generates strategic_coverage map
  → Saves to business_brand_profile.strategic_coverage
```

### 2. Weekly Plan Creation
```
weekly-plan-generator
  → Calls matchTimingToSegment() for each post
  → Adds segmentCoverage to PostSpecification
  → Saved in weekly plan JSON
```

### 3. UI Display
```
useTimingContext()
  → Loads strategic_audience_segments from brand profile
  → getCurrentTimingContext() matches current time
  → Returns soft language for UI display

<TimingContextBanner context={context} />
  → Shows reassuring banner with guidance
```

---

## 🎨 UI Patterns

### Pattern 1: Always-Visible Banner
Best for: Manual post creation, editor views
```tsx
<TimingContextBanner context={context} className="mb-4" />
```

### Pattern 2: Compact Badge
Best for: Post cards, list items
```tsx
<TimingBadge mode={mode} label={displayText} />
```

### Pattern 3: Tooltip on Hover
Best for: Dense UI, power users
```tsx
<div title={getTooltipText(context)}>
  <TimingBadge mode={mode} label={displayText} />
</div>
```

### Pattern 4: Summary Widget
Best for: Weekly plan overview, dashboard
```tsx
<WeeklyPlanSummary {...summary} />
```

---

## 💬 Example Messages

### Strategic Segment (Friday 19:00)
**Banner:**
> 💡 Fredag aften passer godt til vennegrupper  
> Fokuser på: gruppe-oplevelser og deling

**Badge:**
> 🎯 For vennegrupper

**Tooltip:**
> Vennegrupper  
> Vi ved, de kommer — så vi taler direkte til dem

### Gap Time (Monday 13:00)
**Banner:**
> ⚡ Mandag frokost er for alle — bred appel virker her  
> Fokuser på: AYCE værdi og central beliggenhed

**Badge:**
> ⚡ Åbent for alle

**Tooltip:**
> Åbent for alle  
> Vi fokuserer på det der trækker bredt:  
> værdi, beliggenhed og variation

---

## 🚀 Next Steps

### Immediate (Ready to Use)
1. Import components into GenerateStep
2. Add badges to weekly plan cards
3. Add summary widget to weekly plan overview

### Near Term
4. Add scheduling calendar hints
5. Add help section with strategy explanation
6. Add onboarding tooltip for new users

### Future Enhancements
7. Analytics view with pattern comparison (no percentages)
8. A/B test different badge styles
9. Add timing hints to daily suggestions

---

## 📖 Quick Reference

### Import Everything
```tsx
import {
  // Components
  TimingContextBanner,
  TimingBadge,
  WeeklyPlanSummary,
  
  // Hooks
  useTimingContext,
  useWeeklyPlanSummary,
  
  // Helpers
  getCurrentTimingContext,
  getTooltipText,
  getBadgeLabel,
  
  // Messages
  getWeeklyPlanSummaryMessage,
  REASSURANCE_PHRASES,
  POST_TYPE_LABELS
} from '@/components/timing'
```

### Common Use Cases

**Show timing hint in editor:**
```tsx
const { context } = useTimingContext()
<TimingContextBanner context={context} />
```

**Add badge to post card:**
```tsx
<TimingBadge 
  mode={post.segmentCoverage?.mode || 'gap_capacity'}
  label={post.segmentCoverage?.displayText || 'Åbent for alle'}
/>
```

**Weekly plan summary:**
```tsx
const summary = useWeeklyPlanSummary(weeklyPlan.posts)
<WeeklyPlanSummary {...summary} />
```

---

## ✅ Testing Checklist

- [ ] Timing banner shows correct context for different times
- [ ] Strategic segments show targeted message
- [ ] Gap times show broad appeal message
- [ ] Badges display correct icon and color
- [ ] Tooltips show on hover
- [ ] Weekly summary calculates correctly
- [ ] All Danish text is correct and reassuring
- [ ] No technical jargon visible to users
- [ ] Mobile responsive layout
- [ ] Accessibility (keyboard navigation, screen readers)

---

## 🎯 Success Criteria

Users should:
- ✅ Feel confident posting at any time
- ✅ Understand which content fits which time
- ✅ See "all times are good" baseline
- ✅ Get specific guidance when needed
- ✅ Never feel anxious about timing

Users should NOT:
- ❌ See percentages or performance metrics
- ❌ Feel some times are "wasted"
- ❌ See technical terms (gap-time, segment match)
- ❌ Feel hierarchy between strategic/broad
- ❌ Be confused by the system

---

## 📚 Further Reading

- [README.md](src/components/timing/README.md) - Complete API documentation
- [GenerateStepExamples.tsx](src/components/timing/GenerateStepExamples.tsx) - Manual post creation examples
- [WeeklyPlanCardExamples.tsx](src/components/timing/WeeklyPlanCardExamples.tsx) - Weekly plan card examples

---

**Implementation is complete and ready for integration! 🎉**
