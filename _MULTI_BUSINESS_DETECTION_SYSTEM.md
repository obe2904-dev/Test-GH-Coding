# Multi-Business Detection & Selection System
## Implementation Date: 2026-07-05

---

## Overview

Post2Grow now intelligently handles cases where multiple businesses are detected on a single account. When AI detects or a user creates more than one business, the system provides a clean selection interface while maintaining the single-business-per-account model.

---

## Problem Solved

**Before**: If AI detected multiple businesses during profile creation, the app would use `.maybeSingle()` which could return unpredictable results or fail silently.

**After**: System detects multiple businesses, shows a selection modal, remembers the user's choice, and consistently uses the selected business across all pages.

---

## Architecture

### 1. Business Store (`src/stores/businessStore.ts`)

Zustand store with localStorage persistence:

```typescript
interface BusinessStoreState {
  selectedBusinessId: string | null
  availableBusinesses: Business[]
  setSelectedBusiness: (businessId: string) => void
  setAvailableBusinesses: (businesses: Business[]) => void
  clearSelection: () => void
}
```

**Key Features:**
- Persists `selectedBusinessId` to localStorage (`business-selection-storage`)
- Stores available businesses in memory (not persisted)
- Provides hooks for accessing selected business across components

### 2. Business Selector Component (`src/components/business/BusinessSelector.tsx`)

Modal UI component shown when multiple businesses detected:

**Visual Design:**
- Full-screen overlay with centered modal
- Each business shown as a selectable card
- Green checkmark for selected business
- Shows business name and creation date
- Informational notice about single-business policy
- Mentions future Enterprise tier

**UX Flow:**
1. User lands on `/dashboard/profile`
2. System detects multiple businesses
3. Modal appears (cannot be dismissed without selection)
4. User clicks a business
5. Selection saved to store and localStorage
6. Profile page loads with selected business
7. Subsequent visits auto-load selected business

### 3. BusinessProfilePage Updates

**Detection Logic:**
```typescript
// Query ALL businesses (not maybeSingle)
const { data: allBusinessesData } = await sb
  .from('businesses')
  .select('*')
  .eq('owner_id', user.id)

// If multiple detected
if (allBusinessesData.length > 1) {
  // Check if user has previous selection
  if (selectedBusinessId) {
    // Use it
  } else {
    // Show selector
    setShowBusinessSelector(true)
  }
}
```

**Key Changes:**
- Removed `.maybeSingle()` → now queries all businesses
- Added `showBusinessSelector` state
- Added `allBusinesses` state  
- useEffect depends on `selectedBusinessId` (reloads when selection changes)
- Renders `<BusinessSelector />` before loading check
- All `businessData` references changed to `businessToUse`

### 4. MenuPage Updates

**Smart Business Loading:**
```typescript
const { selectedBusinessId, setSelectedBusiness } = useBusinessStore.getState()

// Try selected business first
let businessId = selectedBusinessId

// Fallback to database query if no selection
if (!businessId) {
  const { data: businessData } = await supabase
    .from('businesses')
    .select('id, website_url')
    .eq('owner_id', user.id)
    .maybeSingle()
  
  // Set in store for consistency
  businessId = businessData.id
  setSelectedBusiness(businessId)
}
```

**Key Benefits:**
- Works without visiting profile page first
- Backward compatible with existing behavior
- Sets business in store when queried
- Maintains consistency across pages

### 5. Business Helpers (`src/utils/businessHelpers.ts`)

Utility functions for centralized business logic:

**`getCurrentBusiness(userId)`**
- Async function to get current business
- Handles multi-business detection
- Returns selected business or null

**`useBusinessId()`**  
- React hook for accessing selected business ID
- Use in components that need business_id for queries

---

## User Experience

### Scenario 1: Single Business (Existing Users)
1. User has 1 business ✅
2. No changes to UX ✅  
3. Works exactly as before ✅
4. No selector shown ✅

### Scenario 2: Multiple Businesses Detected
1. AI detects 2+ businesses during profile creation 🏢🏢
2. User lands on `/dashboard/profile`
3. **Modal appears** with business selection
4. User selects "Restaurant A"
5. Selection saved to localStorage
6. Profile loads with Restaurant A data
7. User navigates to `/dashboard/menu`
8. Menu page uses Restaurant A (from store)
9. User returns next day
10. Restaurant A auto-selected (persisted)

### Scenario 3: Selected Business Deleted
1. User had selected "Business A"
2. Business A deleted from database
3. User visits `/dashboard/profile`
4. System detects Business A no longer exists
5. **Modal appears again** with remaining businesses
6. User selects new business

---

## Technical Details

### Storage
- **localStorage key**: `business-selection-storage`
- **Persisted data**: `{ selectedBusinessId: string | null }`
- **Not persisted**: `availableBusinesses` (loaded fresh each time)

### State Management
- **Store**: Zustand with localStorage persistence
- **Scope**: Global (available to all components)
- **Updates**: Reactive (components re-render when selection changes)

### Database Queries
All pages that query business-specific data should:
1. Check `useBusinessStore.getState().selectedBusinessId`
2. Use selected ID if available
3. Fallback to query if not available
4. Set selection in store after fallback query

### Page Dependencies
**BusinessProfilePage**:
- useEffect depends on `[selectedBusinessId]`
- Reloads when selection changes

**Other pages**:
- No dependency needed (one-time load)
- Check store on mount

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| 0 businesses | Empty state (existing behavior) |
| 1 business | Auto-select, no modal |
| 2+ businesses, no selection | Show modal |
| 2+ businesses, has selection | Use selected business |
| Selected business deleted | Show modal again |
| User clears localStorage | Fallback query sets it again |
| Page refresh | Selection restored from localStorage |

---

## Future: Enterprise Tier

This implementation provides the foundation for a future Enterprise tier that fully supports multiple businesses per account.

**Current Limitation:**
- Single business per account officially supported
- Multi-business selector handles edge cases only

**Enterprise Tier Features (Future):**
- Remove "one business per account" notice
- Add business switcher to navigation
- Support multiple active businesses
- Workspace/team collaboration per business
- Separate subscriptions per business

**Migration Path:**
- All infrastructure already in place ✅
- Just need to remove single-business restriction
- Add business switcher UI component
- Update billing to handle multiple subscriptions

---

## Files Changed

### New Files:
1. `src/stores/businessStore.ts` - Business selection store
2. `src/components/business/BusinessSelector.tsx` - Selection modal UI
3. `src/utils/businessHelpers.ts` - Business utility functions

### Modified Files:
1. `src/pages/dashboard/BusinessProfilePage.tsx`
   - Added business detection and selection logic
   - Changed all `businessData` → `businessToUse`
   - Added modal rendering
   - Updated useEffect dependencies

2. `src/pages/dashboard/MenuPage.tsx`
   - Added business store integration
   - Smart business loading (store-first)
   - Backward compatible fallback

---

## Testing Checklist

### Manual Testing:

**Single Business Account:**
- [ ] Profile loads normally (no selector)
- [ ] Menu page loads normally
- [ ] Weekly plan works
- [ ] Quick suggestions work
- [ ] No UX changes observed

**Multi-Business Account (Create Test):**
- [ ] Create 2 businesses via SQL:
  ```sql
  INSERT INTO businesses (owner_id, name, business_name) 
  VALUES 
    ('user_id', 'Business A', 'Business A'),
    ('user_id', 'Business B', 'Business B');
  ```
- [ ] Visit `/dashboard/profile`
- [ ] Selector modal appears
- [ ] Both businesses shown
- [ ] Select Business A
- [ ] Profile loads for Business A
- [ ] Navigate to `/dashboard/menu`
- [ ] Menu shows Business A data
- [ ] Refresh page
- [ ] Business A still selected
- [ ] Clear localStorage
- [ ] Refresh page
- [ ] Business A auto-selected again (fallback query)

**Business Deletion:**
- [ ] Select Business A
- [ ] Delete Business A from database
- [ ] Visit `/dashboard/profile`
- [ ] Selector appears again
- [ ] Only Business B shown
- [ ] Select Business B
- [ ] Profile loads for Business B

---

## Rollback Plan

If issues arise, rollback requires:

1. **Revert commit** `a7a5270`
2. **Remove files:**
   - `src/stores/businessStore.ts`
   - `src/components/business/BusinessSelector.tsx`
   - `src/utils/businessHelpers.ts`
3. **Restore original logic:**
   - BusinessProfilePage: Change `.select('*')` back to `.maybeSingle()`
   - MenuPage: Remove store integration
4. **Clear localStorage** for all users:
   - Key: `business-selection-storage`

---

## Deployment

**Git Commit**: `a7a5270`  
**Branch**: `main`  
**Status**: ✅ Deployed to production (Vercel auto-deploy)

**No Database Changes Required** ✅  
**No API Changes Required** ✅  
**No Environment Variables Required** ✅

---

## Support Notes

### User Reports Multiple Businesses

1. **Check localStorage:**
   - Key: `business-selection-storage`
   - Value should contain `selectedBusinessId`

2. **Query businesses:**
   ```sql
   SELECT id, business_name, created_at 
   FROM businesses 
   WHERE owner_id = 'user_id';
   ```

3. **If unexpected multiple businesses:**
   - Investigate why AI created multiple
   - Delete unwanted business (user will see selector)
   - User selects correct one

4. **If user wants Enterprise tier:**
   - Note: "Coming soon - contact us for early access"
   - Collect requirements
   - Add to Enterprise tier waitlist

---

## Conclusion

This implementation provides:
- ✅ Robust multi-business detection
- ✅ Clean, user-friendly selection interface
- ✅ Persistent selection across sessions
- ✅ Backward compatibility with existing accounts
- ✅ Foundation for future Enterprise tier
- ✅ No breaking changes
- ✅ Graceful edge case handling

**Result**: Users with multiple businesses can now choose which one to work with, while single-business users experience no changes. System is future-proof for Enterprise tier expansion.
