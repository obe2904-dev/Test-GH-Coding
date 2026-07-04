# Weekly Plan Post Navigation Feature

## Summary
Implemented the ability for users to navigate to created posts directly from the AI weekly plan dashboard. When a post has been generated from a weekly plan idea, the UI now shows a "✓ Lavet" badge and changes the button to "Gå til opslag →" which navigates to the calendar page.

## Changes Made

### 1. Updated `useCommittedSuggestions` Hook
**File:** `src/hooks/useCommittedSuggestions.ts`

- Added new interface `WeeklyPlanPostInfo` to track post details:
  ```typescript
  export interface WeeklyPlanPostInfo {
    postId: string
    scheduledFor?: Date
    postedAt?: Date
  }
  ```

- Extended `CommittedState` interface with new field:
  - `weeklyPlanPostMap: Map<number, WeeklyPlanPostInfo>` - Maps weekly_plan_idea_id to post details

- Modified query to include `id` and `scheduled_for` fields from posts table

- Added logic to populate `weeklyPlanPostMap` with post details for each committed weekly plan idea

### 2. Updated `WeeklyPlanOverview` Component
**File:** `src/components/weekly-plan/WeeklyPlanOverview.tsx`

- Added import for `useNavigate` from react-router-dom
- Added import for `WeeklyPlanPostInfo` type
- Added `weeklyPlanPostMap` prop to component interface
- Added `navigate` hook initialization

**UI Changes:**
- Introduced `hasCreatedPost` boolean to check if a post has been created from an idea
- Extracted `createdPostInfo` for the post details
- Modified `isLocked` logic to exclude ideas that have created posts

**Badge Display:**
- Shows "✓ Lavet" badge (green) when `hasCreatedPost` is true
- "Låst" badge only shows for truly locked ideas without created posts
- Other badges (session done, past) respect the new state

**Button Behavior:**
- Button shows "Gå til opslag →" (green background) when post has been created
- Button shows "Lav opslag →" (normal CTA color) when post needs to be created
- Clicking "Gå til opslag →" navigates to `/dashboard/calendar`
- Clicking "Lav opslag →" creates a new post (existing behavior)

**Card Styling:**
- Cards with created posts show green border and light green background (same as session done)

### 3. Updated AI Weekly Plan Page
**File:** `src/app/content/ai-weekly-plan/page.tsx`

- Updated destructuring to include `weeklyPlanPostMap` from `useCommittedSuggestions`
- Passed `weeklyPlanPostMap` prop to `WeeklyPlanOverview` component

### 4. Updated Danish Translations
**File:** `src/lib/locales/da.json`

Added new translation keys:
- `weeklyPlan.overview.createdBadge`: "Lavet"
- `weeklyPlan.overview.goToPost`: "Gå til opslag →"

## User Experience Flow

1. **Before Creating Post:**
   - Badge: None (or "⏰ Fortid" if past)
   - Button: "Lav opslag →" (blue/purple CTA color)
   - Border: Normal slate or orange (if past)

2. **After Creating Post:**
   - Badge: "✓ Lavet" (green)
   - Button: "Gå til opslag →" (green)
   - Border: Green with light green background
   - Click behavior: Navigates to `/dashboard/calendar`

3. **Locked Ideas (committed but not via this system):**
   - Badge: "Låst" (gray)
   - Button: "Låst" (gray, disabled)
   - Border: Gray with light gray background

## Data Flow

1. When a post is created from a weekly plan idea, the `weekly_plan_idea_id` is stored in the `posts` table
2. `useCommittedSuggestions` queries the `posts` table to find all posts with `weekly_plan_idea_id` values
3. Creates a Map of `idea_id` → `{ postId, scheduledFor, postedAt }`
4. UI checks if an idea exists in the map to determine if a post has been created
5. Button click navigates to calendar page where the user can see/edit their created post

## Technical Notes

- The feature uses the existing `posts` table schema (no database changes required)
- The `weeklyPlanPostMap` is reactive and updates when posts are created/deleted
- Navigation uses React Router's `navigate` function
- The calendar page is the destination because it shows all posts in a timeline view
- Future enhancement: Could scroll to the specific post on the calendar page using date filters

## Testing Checklist

- [x] No TypeScript errors
- [ ] Badge shows "✓ Lavet" after creating a post from a weekly plan idea
- [ ] Button changes to "Gå til opslag →" after creating a post
- [ ] Button color changes to green after creating a post
- [ ] Clicking "Gå til opslag →" navigates to calendar page
- [ ] Cards with created posts have green border and background
- [ ] Multiple posts from the same week work correctly
- [ ] Refreshing the page maintains the "created" state
- [ ] Creating a post updates the UI immediately without page refresh
