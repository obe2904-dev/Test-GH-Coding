## Revenue Drivers UI - Visual Design

### Business Profile Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Business Profile                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Social Media Connections                              [Edit] │ │
│ │ Connect your social media accounts...                        │ │
│ │                                                               │ │
│ │  [Facebook: Connected]    [Instagram: Connected]             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🎯 Revenue Drivers                           [Regenerate AI] │ │
│ │ AI-analyzed revenue moments for optimal post timing          │ │
│ │                                                               │ │
│ │ ┌───────────────────────────────────────────────────────┐   │ │
│ │ │ PRIMARY REVENUE MOMENT                               │   │ │
│ │ │                                                       │   │ │
│ │ │ 🍽️ Weekend Dinner                                    │   │ │
│ │ │ Thursday-Friday evenings | Advance booking pattern   │   │ │
│ │ │                                                       │   │ │
│ │ │ Decision Windows:                                    │   │ │
│ │ │ • Thursday 14:00-17:00 (HIGH conversion)             │   │ │
│ │ │   Booking surge for weekend reservations             │   │ │
│ │ │ • Friday 11:00-14:00 (MEDIUM conversion)             │   │ │
│ │ │   Same-day last-minute bookings                      │   │ │
│ │ │                                                       │   │ │
│ │ │ Post Timing Rules:                                   │   │ │
│ │ │ ✅ REQUIRED: Thursday 14:00 (prime booking window)   │   │ │
│ │ │ ⭐ RECOMMENDED: Friday 12:00 (day-of reminder)       │   │ │
│ │ │                                                       │   │ │
│ │ │ Content Focus: Menu items, atmosphere, booking CTA  │   │ │
│ │ └───────────────────────────────────────────────────────┘   │ │
│ │                                                               │ │
│ │ ┌───────────────────────────────────────────────────────┐   │ │
│ │ │ SECONDARY MOMENTS (2)                     [Expand All]│   │ │
│ │ │                                                       │   │ │
│ │ │ 🥗 Weekday Lunch                              [View]  │   │ │
│ │ │ Mon-Fri 11:30-14:00 | Same-day morning pattern      │   │ │
│ │ │                                                       │   │ │
│ │ │ 🥐 Weekend Brunch                             [View]  │   │ │
│ │ │ Sat-Sun 09:00-13:00 | Spontaneous decision          │   │ │
│ │ └───────────────────────────────────────────────────────┘   │ │
│ │                                                               │ │
│ │ Normal Week Strategy:                                        │ │
│ │ • Preferred Days: Monday, Thursday, Friday, Saturday         │ │
│ │ • Weekend driver posts: 2 minimum                            │ │
│ │ • Weekday presence: 1 minimum                                │ │
│ │                                                               │ │
│ │ Analyzed: 2026-06-09 via structured_programmes              │ │
│ │ Confidence: 88%                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Business Homepage URL                                        │ │
│ │ ...                                                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Expanded Revenue Moment Detail

When user clicks "[View]" on a secondary moment:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🥗 Weekday Lunch                                      [Collapse] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Service Type: Lunch                                              │
│ Active Days: Monday, Tuesday, Wednesday, Thursday, Friday        │
│ Time Range: 11:30 - 14:00                                        │
│ Decision Pattern: Same-day morning                               │
│ Typical Lead Time: 2-4 hours                                     │
│                                                                  │
│ Decision Windows:                                                │
│ ┌────────────────────────────────────────────────────┐          │
│ │ 🟢 HIGH Conversion                                 │          │
│ │ Monday-Friday 09:00-10:30                          │          │
│ │ "Morning coffee scroll - deciding lunch plans"     │          │
│ └────────────────────────────────────────────────────┘          │
│                                                                  │
│ ┌────────────────────────────────────────────────────┐          │
│ │ 🟡 MEDIUM Conversion                               │          │
│ │ Monday-Friday 11:00-12:00                          │          │
│ │ "Last-minute lunch decision"                       │          │
│ └────────────────────────────────────────────────────┘          │
│                                                                  │
│ Post Timing Rules:                                               │
│ ⭐ RECOMMENDED: Monday 09:00 (start week visibility)             │
│ 📌 OPTIONAL: Mid-week 09:00 (maintain presence)                 │
│                                                                  │
│ Content Focus:                                                   │
│ • Daily specials  • Quick lunch options  • Takeaway mentions    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Loading State

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎯 Revenue Drivers                           [Regenerating...] │
│                                                                  │
│       ⏳ Analyzing your business patterns...                     │
│                                                                  │
│       This may take 10-15 seconds                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Empty/No Data State

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎯 Revenue Drivers                              [Generate AI] │
│                                                                  │
│    💡 Let AI analyze your business to find optimal posting      │
│       days and times based on customer behavior patterns.       │
│                                                                  │
│    This will help your Weekly Plan generate posts when          │
│    customers are most likely to book or visit.                  │
│                                                                  │
│                     [Analyze My Business]                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Error State

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎯 Revenue Drivers                                  [Try Again] │
│                                                                  │
│    ⚠️  Failed to analyze revenue drivers                         │
│                                                                  │
│    Error: No programme data and business description too short  │
│                                                                  │
│    💡 Suggestion: Add a detailed "About Us" description or       │
│       generate a brand profile first.                            │
│                                                                  │
│                        [Go to Brand Profile]                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Mobile Responsive View

```
┌───────────────────────────┐
│ 🎯 Revenue Drivers    [...│
├───────────────────────────┤
│                           │
│ PRIMARY                   │
│ ┌───────────────────────┐ │
│ │ 🍽️ Weekend Dinner    │ │
│ │ Thu-Fri | Advance    │ │
│ │                      │ │
│ │ 📌 Thu 14:00 (HIGH)  │ │
│ │ Booking surge        │ │
│ │                      │ │
│ │ ⭐ Fri 12:00 (MED)   │ │
│ │ Same-day bookings    │ │
│ └───────────────────────┘ │
│                           │
│ SECONDARY (2) [Expand]    │
│                           │
│ Preferred: Mon, Thu, Fri  │
│ Analyzed: 88% confidence  │
│                           │
└───────────────────────────┘
```

---

## Color Palette

- **Primary Moment:** Indigo background (#4F46E5)
- **Secondary Moments:** Gray background (#F3F4F6)
- **HIGH Conversion:** Green indicator (#10B981)
- **MEDIUM Conversion:** Yellow indicator (#F59E0B)
- **LOW Conversion:** Gray indicator (#6B7280)
- **Required Posts:** Red badge (#EF4444)
- **Recommended Posts:** Blue badge (#3B82F6)
- **Optional Posts:** Gray badge (#9CA3AF)

---

## Icons

- 🎯 Revenue Drivers (main section)
- 🍽️ Dinner service
- 🥗 Lunch service
- 🥐 Brunch service
- ☕ Coffee/cafe
- 🟢 High conversion
- 🟡 Medium conversion
- ⚪ Low conversion
- ✅ Required post
- ⭐ Recommended post
- 📌 Optional post
- ⏳ Loading
- ⚠️ Error
- 💡 Info/suggestion

---

## Interactions

1. **Regenerate Button:**
   - Shows loading spinner
   - Disables button during analysis
   - Shows success toast on completion
   - Shows error message on failure

2. **Expand/Collapse:**
   - Smooth height transition
   - Arrow icon rotates
   - Remembers state in session storage

3. **View Detail:**
   - Opens expandable panel
   - Smooth animation
   - Close button at top-right

4. **Copy to Clipboard:**
   - Click preferred days list
   - Shows "Copied!" tooltip
   - Useful for manual planning

---

## Accessibility

- **ARIA labels** for all interactive elements
- **Keyboard navigation** (Tab, Enter, Escape)
- **Screen reader** friendly descriptions
- **High contrast** mode support
- **Focus indicators** on all buttons

---

## Implementation Priority

1. **MVP (Phase 1):**
   - Basic card with primary moment only
   - Regenerate button
   - Loading and error states

2. **Enhanced (Phase 2):**
   - Secondary moments expandable
   - Full detail views
   - Copy to clipboard
   - Toast notifications

3. **Advanced (Phase 3):**
   - Visual timeline chart
   - Confidence score explanation
   - Edit manual overrides
   - A/B test different strategies
