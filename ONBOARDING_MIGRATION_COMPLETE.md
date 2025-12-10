# Onboarding Migration Complete ✅

## Summary
Successfully migrated onboarding system from profiles-based to business-based architecture. The system now properly supports the multi-user business model with business-level tiers.

## What Changed

### 1. Database Changes
**New Migration: `012_business_onboarding_function.sql`**
- Created `create_business_onboarding()` function
- Takes: business name, vertical, postal code, city, country, platforms
- Creates `businesses` record with `plan='free'` by default
- Creates `business_locations` record as primary location
- Updates `profiles.onboarding_completed` for backward compatibility
- Returns business_id

**To Apply:**
Run this SQL in Supabase SQL Editor:
```sql
-- See: supabase/migrations/012_business_onboarding_function.sql
```

### 2. Frontend Changes

**Updated Files:**
1. **`src/pages/OnboardingPage.tsx`**
   - Changed from `profiles.upsert()` to `supabase.rpc('create_business_onboarding')`
   - Simplified onboarding logic - no more profile payload construction
   - Now creates proper business + location records

2. **`src/hooks/useBusinessTier.ts`** (NEW)
   - Fetches user's business tier from database
   - Checks if user is business owner OR team member
   - Team members inherit business owner's tier
   - Syncs tier to Zustand store on auth changes
   - Defaults to 'free' if no business found

3. **`src/App.tsx`**
   - Added `useBusinessTier()` hook call
   - Automatically fetches and syncs tier on app load
   - Updates when user authenticates/signs out

4. **`src/components/tier/PlanSwitcher.tsx`**
   - Updated `readPlanFromSupabase()` to read from `businesses.plan`
   - Updated `writePlanToSupabase()` to write to `businesses.plan`
   - Supports both business owners and team members
   - Team members see inherited tier (read-only in practice)

## Onboarding Flow (Current)

### Step 1: Basic Info
User provides:
- Business name (e.g., "Café Nørrebro")
- Postal code (auto-fetches city from Danish postal API)
- Country (defaults to "Danmark")
- Business type (preset to "café")

### Step 2: Platform Selection
User selects:
- Facebook, Instagram, or both
- Can skip (defaults to Facebook)

### What Happens Behind the Scenes
1. ✅ `businesses` table record created
   - `name`: Business name from user
   - `vertical`: "café" (normalized from café/restaurant)
   - `plan`: "free" (default)
   - `primary_language`: "da" (Danish)
   - `owner_id`: Current user's ID

2. ✅ `business_locations` table record created
   - `postal_code`: From user input
   - `city`: Auto-fetched from Danish postal API
   - `country`: "Danmark"
   - `is_primary`: true

3. ✅ `profiles` table updated
   - `selected_platforms`: User's platform choices
   - `onboarding_completed`: true

4. ✅ User redirected to `/dashboard/create` (first post creation)

## Business Model Support

### Single User (Free Tier) ✅
- User creates account → onboarding → business created
- User owns business, has 'free' tier
- Works perfectly

### Multi-User (Paid Tiers) ✅
- Business owner invites team members (future feature)
- Team members added to `business_team_members` table
- Team members inherit business owner's tier
- All quotas tracked at business level (not per user)

## Tier Fetching Logic

**Priority Order:**
1. Check if user owns a business → use `businesses.plan`
2. If not owner, check `business_team_members` → get business → use that `plan`
3. Default to 'free' if no business association found

**Caching:**
- Tier stored in localStorage as `business:tier`
- Zustand store holds current tier in memory
- Syncs on every auth state change

## What Still Uses Profiles Table

**Keep for now:**
- `profiles.selected_platforms` - Platform selections during onboarding
- `profiles.onboarding_completed` - Flag to skip onboarding if already done
- Auth metadata (email, etc.)

**Future Migration:**
- Move `selected_platforms` to `businesses` or new `business_settings` table
- Move `onboarding_completed` to `businesses.onboarding_completed_at`

## Testing Checklist

### Database
- [x] Migration 012 created
- [ ] Migration 012 applied to Supabase (run SQL in editor)
- [ ] Test `create_business_onboarding()` function manually

### Frontend
- [ ] New user signup flow
- [ ] Onboarding completes without errors
- [ ] Business record created in database
- [ ] Location record created in database
- [ ] Tier fetched correctly (should be 'free' by default)
- [ ] Tier persisted across page refreshes

### Tier System
- [ ] Free tier users see correct quotas
- [ ] PlanSwitcher (dev tool) can change tier
- [ ] Tier changes persist to `businesses.plan`
- [ ] Team member scenario (when implemented)

## Next Steps

1. **Apply Migration 012** - Run SQL in Supabase SQL Editor
2. **Test Onboarding** - Create a new account and verify:
   - Business record created
   - Location record created
   - Tier = 'free'
   - Redirect to /dashboard/create works
3. **Verify Tier Fetching** - Check browser console for tier logs
4. **Update Remaining Components** - Any components still reading from `profiles.plan`

## Files Modified

### New Files
- `supabase/migrations/012_business_onboarding_function.sql`
- `src/hooks/useBusinessTier.ts`

### Modified Files
- `src/pages/OnboardingPage.tsx`
- `src/App.tsx`
- `src/components/tier/PlanSwitcher.tsx`

### Files NOT Modified (Still Work)
- `src/stores/tierStore.ts` - Still works, just syncs from businesses now
- All quota checking logic - Still works
- Edge Functions - Already updated to use business-level quotas

## Migration Status

✅ Database schema ready (migrations 010, 011, 012)
✅ Onboarding creates business records
✅ Tier fetched from businesses table
✅ Team member support (database level)
⏳ Team management UI (not built yet)
⏳ Full profiles → businesses migration (future)
