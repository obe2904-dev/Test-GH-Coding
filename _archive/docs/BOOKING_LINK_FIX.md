# Booking Link Persistence Fix

**Date**: January 22, 2026  
**Issue**: AI detected booking link disappears on page reload

## Problem Analysis

The booking link was being detected by AI and set in state, but never saved to the database during the auto-save operation.

### Root Cause

1. **AI Analysis** (line 326): Sets `bookingLink` state ✅
2. **Auto-Save** (line 390): Called `handleSaveProfile()` but didn't include `bookingLink` in override parameters ❌
3. **Save Function** (line 598): No code to save booking link to database ❌
4. **Reload** (line 195): Tried to load from `business_brand_profile.booking_link` but found empty value ❌

## Solution Implemented

### 1. Added Booking Link to Auto-Save Override
**File**: `src/pages/dashboard/BusinessProfilePage.tsx` (line 402)
```typescript
await handleSaveProfile({
  phone: analysis.contact?.phone || phone,
  email: analysis.contact?.email || email,
  // ... other fields
  bookingLink: analysis.bookingUrl || bookingLink  // ✅ ADDED
})
```

### 2. Updated handleSaveProfile Signature
**File**: `src/pages/dashboard/BusinessProfilePage.tsx` (line 413)
```typescript
const handleSaveProfile = async (overrideValues?: {
  phone?: string
  email?: string
  address?: string
  postalCode?: string
  city?: string
  bookingLink?: string  // ✅ ADDED
}) => {
```

### 3. Added Effective Booking Link Variable
**File**: `src/pages/dashboard/BusinessProfilePage.tsx` (line 421)
```typescript
const effectiveBookingLink = overrideValues?.bookingLink ?? bookingLink
```

### 4. Implemented Database Save Logic
**File**: `src/pages/dashboard/BusinessProfilePage.tsx` (lines 600-622)
```typescript
// Update or create brand profile (for booking link and tone/voice settings)
if (effectiveBookingLink) {
  const { data: existingBrandProfile } = await supabase
    .from('business_brand_profile')
    .select('business_id')
    .eq('business_id', effectiveBusinessId)
    .maybeSingle()

  if (existingBrandProfile) {
    await supabase
      .from('business_brand_profile')
      .update({
        booking_link: effectiveBookingLink
      } as any)
      .eq('business_id', effectiveBusinessId)
  } else {
    await supabase
      .from('business_brand_profile')
      .insert({
        business_id: effectiveBusinessId,
        booking_link: effectiveBookingLink
      } as any)
  }
}
```

### 5. Updated TypeScript Types
**File**: `src/types/database.ts` (lines 218, 240, 267)

Added `booking_link: string | null` to:
- `business_brand_profile.Row` 
- `business_brand_profile.Insert`
- `business_brand_profile.Update`

## Data Flow (Fixed)

```
AI Analysis
    ↓
analysis.bookingUrl → setBookingLink(value)
    ↓
Auto-Save with bookingLink in overrides
    ↓
handleSaveProfile receives effectiveBookingLink
    ↓
Save to business_brand_profile.booking_link
    ↓
On reload: Load from business_brand_profile.booking_link
    ↓
bookingLink state populated ✅
```

## Testing

1. Open Business Profile for Café Faust
2. Click "Analyser Website"
3. Check console for `analysis.bookingUrl` value
4. Auto-save completes (check console: "✅ Profile auto-saved successfully")
5. Reload page
6. Booking link should persist ✅

## Database Schema

The `booking_link` column exists in `business_brand_profile` table (migration `013_add_brand_and_menu_fields.sql`):

```sql
ALTER TABLE public.business_brand_profile
    ADD COLUMN IF NOT EXISTS booking_link TEXT;

COMMENT ON COLUMN public.business_brand_profile.booking_link IS 'URL for booking/reservation system';
```

## Files Modified

1. ✅ `src/pages/dashboard/BusinessProfilePage.tsx` - Added save logic
2. ✅ `src/types/database.ts` - Added TypeScript types

## Status

🟢 **FIXED** - Booking link now persists after AI analysis and page reload
