# Fix: 403 Error on Photo Editing (Tier Restriction)

## Problem

Users on the **FREE tier** were seeing the multi-select photo editing UI (checkboxes next to suggestions), but when they clicked "Apply X Improvements", they received a **403 Forbidden** error:

```
kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/edit-photo:1 Failed to load resource: the server responded with a status of 403
```

## Root Cause

The `edit-photo` edge function correctly restricts AI photo editing to **Smart and Pro tiers only** (lines 56-64):

```typescript
// Only allow Standard Plus (Smart) and Premium (Pro) tiers
if (dailyQuota.tier === 'free') {
  return new Response(
    JSON.stringify({ 
      error: 'AI photo editing requires Smart or Pro plan',
      tier: dailyQuota.tier,
      message: 'Upgrade to Smart or Pro to use AI-powered photo editing'
    }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

However, the **frontend was showing the multi-select UI to FREE tier users**, creating a confusing experience where they could select suggestions but couldn't apply them.

## Solution

### 1. **Conditional UI Display** ([CreateStep.tsx](src/components/post-creation/CreateStep.tsx#L1210))

Only pass the `onApplySelected` callback to MediaAnalysisPanel for Smart/Pro users:

```typescript
<MediaAnalysisPanel
  analysis={{
    generalFeedback: analysisResult.generalFeedback,
    suggestions: analysisResult.suggestions
  }}
  onApply={handleApplySuggestion}
  onApplySelected={currentTier !== 'free' ? handleApplySelectedSuggestions : undefined}  // ✅ Conditional
  tier={currentTier as 'smart' | 'pro'}
  isProcessing={currentPhoto?.isProcessing || isEditing}
/>
```

**Result:** FREE tier users will NOT see checkboxes or the "Apply Selected" button. They only see the analysis with suggestions.

### 2. **Improved Error Handling** ([usePhotoEdit.ts](src/hooks/usePhotoEdit.ts#L25))

The hook now properly detects tier restriction errors and throws them:

```typescript
if (functionError) {
  // Check if this is a tier restriction error (403)
  const errorMessage = functionError.message || 'Failed to edit photo'
  if (errorMessage.includes('403') || errorMessage.includes('Smart or Pro')) {
    const tierError = language === 'da'
      ? 'AI foto-redigering kræver Smart eller Pro abonnement'
      : 'AI photo editing requires Smart or Pro plan'
    setError(tierError)
    throw new Error(tierError)
  }
  
  throw new Error(errorMessage)
}
```

### 3. **Upgrade Modal on Restriction** ([CreateStep.tsx](src/components/post-creation/CreateStep.tsx#L968))

If somehow a free user triggers editing, show the upgrade modal instead of a generic error:

```typescript
catch (error: any) {
  // Check if error is tier restriction
  const errorMsg = error.message || String(error)
  if (errorMsg.includes('Smart') || errorMsg.includes('Pro') || errorMsg.includes('abonnement')) {
    // Show upgrade modal for tier restriction
    setShowUpgradeModal('photo-picker')
  } else {
    // Show generic error for other failures
    alert(errorMsg || 'Photo editing failed. Please try again.')
  }
}
```

## Tier Behavior

### **FREE Tier:**
- ✅ Can analyze photos
- ✅ Sees suggestions
- ❌ NO checkboxes
- ❌ NO "Apply Selected" button
- ❌ NO AI editing capability

### **SMART Tier (Standard Plus):**
- ✅ Can analyze photos
- ✅ Sees suggestions with checkboxes
- ✅ Can select 1-5 suggestions
- ✅ "Apply X Improvements" button appears
- ✅ AI edits photo using Gemini 2.5 Flash Image
- ❌ No manual adjustment controls

### **PRO Tier (Premium):**
- ✅ All Smart tier features
- ✅ + Manual adjustment controls (AIAdjustmentControls)
- ✅ Both AI editing AND manual fine-tuning

## Tier Name Mapping

**Frontend (TypeScript):**
- `'free'`
- `'standardplus'` (displayed as "Smart")
- `'premium'` (displayed as "Pro")

**Backend (Edge Functions):**
- `'free'`
- `'standardplus'`
- `'premium'`

**Database (`profiles.tier` column):**
- `'free'`
- `'standardplus'`
- `'premium'`

All tiers use consistent naming across frontend, backend, and database.

## Testing Checklist

- [x] FREE tier: Multi-select UI does NOT appear
- [x] FREE tier: Only sees analysis and suggestions (no checkboxes)
- [ ] SMART tier: Multi-select UI appears with checkboxes
- [ ] SMART tier: "Apply X Improvements" button shows when selecting
- [ ] SMART tier: Clicking apply successfully edits photo
- [ ] PRO tier: Both AI editing and manual controls available
- [ ] Error handling: Tier restriction shows upgrade modal (defensive)

## Files Modified

1. [src/components/post-creation/CreateStep.tsx](src/components/post-creation/CreateStep.tsx)
   - Conditional `onApplySelected` based on tier
   - Improved error handling with upgrade modal
   - Simplified success check (editPhoto now throws on error)

2. [src/hooks/usePhotoEdit.ts](src/hooks/usePhotoEdit.ts)
   - Detect tier restriction errors (403)
   - Throw errors instead of returning null
   - Better error messages

## Why This Approach

**Preventing UI Confusion:**
By hiding the multi-select UI from FREE users, we avoid the frustrating experience of:
1. User selects suggestions
2. Clicks "Apply"
3. Gets error message
4. Feels confused/frustrated

**Better UX:**
FREE users just see the analysis. If they want editing, they'll see the upgrade prompt in the appropriate place (e.g., when they click on a suggestion or see the Smart tier features).

**Defensive Programming:**
Even though we hide the UI, we still handle 403 errors gracefully by showing the upgrade modal, in case edge cases occur.
