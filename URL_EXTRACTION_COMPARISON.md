# URL Extraction Comparison: Onboarding vs "Hent info"

## Executive Summary

Both flows use the **same Edge Function** (`analyze-website`) but handle the response differently:

### ✅ What BOTH Extract & Save to Database
- Business name
- Business type
- Short description
- Contact info (phone, email, address)
- Booking URL
- **Opening hours** ✅ (saved to DB but not shown in UI)
- Menu URLs (saved to DB but handled differently)
- Service model flags
- Menu signal
- Tone of voice

### ❌ What "Hent info" Button DOESN'T Do (but should)
- Does NOT update frontend state with `openingHours` from analysis
- Does NOT extract `detectedMenuUrls` from analysis

---

## Detailed Flow Comparison

## Flow 1: Onboarding (`OnboardingPage.tsx`)

### Entry Point
```typescript
const { data, error } = await supabase.functions.invoke('analyze-website', {
  body: {
    url: normalizedUrl,
    businessName: businessName.trim(),
    businessType: 'cafe',
    tier: currentTier,
    debugMode: false,
  }
})
```

### What It Extracts from Response
1. ✅ **Location** (postal code, city) → `extractLocationFromAnalysis(data)`
2. ✅ **Business vertical** → `deriveVerticalFromAnalysis(data)`
3. ✅ **Menu URLs** → `data.detectedMenuUrls` (sent to backend, triggers background menu extraction)
4. ✅ **Menu signal** → Used for dashboard AI suggestions
5. ❌ **Opening hours** → NOT extracted to frontend state (but saved to DB via persistence layer)

### Backend Persistence During Onboarding
When `businessId` is included in the request to `analyze-website`, the Edge Function automatically saves to:
- `website_analyses` table
- `business_profile` table
- `business_brand_profile` table  
- `business_locations` table
- **`opening_hours` table** ✅
- `business_operations` table

---

## Flow 2: "Hent info" Button (`BusinessProfilePage.tsx`)

### Entry Point
```typescript
const { analyzeBusinessProfile } = await import('../../features/BusinessProfilerAI')

const analysis = await analyzeBusinessProfile({
  url: sanitized,
  businessName: businessName || undefined,
  businessType: businessCategory || undefined,
  tier: currentTier,
  authToken,
  businessId: effectiveBusinessId
})
```

### What `BusinessProfilerAI` Does
1. Normalizes the URL
2. Calls the **same** `supabase.functions.invoke('analyze-website', {...})`
3. Returns enriched analysis with `businessSector` and `offeringsProfile`

### What `handleWebsiteAnalysis` Extracts from Response
```typescript
// ✅ CURRENTLY EXTRACTED:
- analysis.businessName → setBusinessName()
- analysis.businessType → setBusinessCategory()
- analysis.shortDescription → setAboutText()
- analysis.contact?.phone → setPhone()
- analysis.contact?.email → setEmail()
- analysis.contact?.address → setAddress()
- analysis.bookingUrl → setBookingLink()
- analysis.takeaway → saved to business_operations
- analysis.delivery → saved to business_operations
- analysis.hasTableService → saved to business_operations
- analysis.reservationRequired → saved to business_operations
- menu_signal (from DB) → setMenuHighlights()

// ❌ NOT EXTRACTED (but available in response):
- analysis.openingHours → Should call setOpeningHours()
- analysis.detectedMenuUrls → Should be displayed/saved
```

### Backend Persistence During "Hent info"
Same as onboarding - when `businessId` is provided, the Edge Function persistence layer saves everything including opening hours to the database.

---

## The Missing Pieces

### Issue 1: Opening Hours Not Updated in Frontend

**Location**: `src/pages/dashboard/BusinessProfilePage.tsx` line 358 (`handleWebsiteAnalysis`)

**Problem**: The `analysis` object contains `openingHours` but it's never used to update the frontend state.

**What should happen**:
```typescript
// After line 457 (booking URL extraction)
if (analysis.bookingUrl && !bookingLink.trim()) {
  setBookingLink(analysis.bookingUrl)
  fieldsUpdated++
}

// ADD THIS:
// Opening hours
if (analysis.openingHours && Object.keys(analysis.openingHours).length > 0) {
  const hasExistingHours = Object.values(openingHours).some(h => h.open || h.close)
  if (!hasExistingHours) {
    const convertedSchedule: WeekSchedule = {
      man: { open: analysis.openingHours.monday?.open || '', close: analysis.openingHours.monday?.close || '' },
      tir: { open: analysis.openingHours.tuesday?.open || '', close: analysis.openingHours.tuesday?.close || '' },
      ons: { open: analysis.openingHours.wednesday?.open || '', close: analysis.openingHours.wednesday?.close || '' },
      tor: { open: analysis.openingHours.thursday?.open || '', close: analysis.openingHours.thursday?.close || '' },
      fre: { open: analysis.openingHours.friday?.open || '', close: analysis.openingHours.friday?.close || '' },
      lør: { open: analysis.openingHours.saturday?.open || '', close: analysis.openingHours.saturday?.close || '' },
      søn: { open: analysis.openingHours.sunday?.open || '', close: analysis.openingHours.sunday?.close || '' },
    }
    setOpeningHours(convertedSchedule)
    fieldsUpdated++
    console.log('✅ Opening hours extracted:', convertedSchedule)
  }
}
```

### Issue 2: Detected Menu URLs Not Handled

**Location**: Same function

**Problem**: `analysis.detectedMenuUrls` is available but not extracted or displayed.

**What should happen**: Either:
1. Log them for user awareness: `console.log('📋 Detected menu URLs:', analysis.detectedMenuUrls)`
2. Save them to `business_profile.detected_menu_urls` (but this happens in persistence layer already)
3. Display them in UI with option to manage them (navigate to Menu tab?)

---

## Key Differences Summary

| Feature | Onboarding | "Hent info" | Should Be Same? |
|---------|-----------|-------------|-----------------|
| Calls same Edge Function | ✅ | ✅ | ✅ Yes |
| Extracts business name | ✅ | ✅ | ✅ Yes |
| Extracts contact info | ✅ | ✅ | ✅ Yes |
| Extracts booking URL | ✅ | ✅ | ✅ Yes |
| **Saves opening hours to DB** | ✅ | ✅ | ✅ Yes |
| **Updates opening hours in UI** | ❌ | ❌ | **❌ Should be ✅** |
| Extracts menu URLs | ✅ | ❌ | **❌ Should be ✅** |
| Uses BusinessProfilerAI wrapper | ❌ | ✅ | N/A |
| Direct Edge Function call | ✅ | ❌ (via wrapper) | N/A |

---

## Recommendations

### 1. **Add Opening Hours Extraction to "Hent info"**
Update `handleWebsiteAnalysis` to extract and populate opening hours from the analysis result.

### 2. **Optionally: Add Opening Hours to Onboarding**
If you want users to see/confirm opening hours during onboarding, extract them there too.

### 3. **Consider Menu URLs in "Hent info"**
Decide how to handle `detectedMenuUrls` - either:
- Show a notification that menu URLs were detected
- Auto-navigate to Menu tab
- Display count in the success message

### 4. **Unify the Flows**
Consider whether `BusinessProfilePage` should also use direct Edge Function calls like Onboarding, or if Onboarding should use the `BusinessProfilerAI` wrapper for consistency.

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    ONBOARDING FLOW                          │
└─────────────────────────────────────────────────────────────┘
        │
        ├─► analyze-website Edge Function
        │   ├─► Scrapes website
        │   ├─► Extracts all data (including openingHours)
        │   ├─► Saves to DB (if businessId provided)
        │   └─► Returns JSON
        │
        └─► Frontend
            ├─► Extracts location → setPostalCode(), setCity()
            ├─► Derives vertical → setBusinessVertical()
            ├─► Uses detectedMenuUrls → Background menu extraction
            └─► ❌ Does NOT extract openingHours to state


┌─────────────────────────────────────────────────────────────┐
│                  "HENT INFO" FLOW                           │
└─────────────────────────────────────────────────────────────┘
        │
        ├─► BusinessProfilerAI.analyzeBusinessProfile()
        │   └─► analyze-website Edge Function
        │       ├─► Scrapes website
        │       ├─► Extracts all data (including openingHours)
        │       ├─► Saves to DB (if businessId provided)
        │       └─► Returns JSON
        │
        └─► Frontend (handleWebsiteAnalysis)
            ├─► Extracts businessName → setBusinessName()
            ├─► Extracts contact → setPhone(), setEmail(), setAddress()
            ├─► Extracts bookingUrl → setBookingLink()
            ├─► Extracts service model → saves to business_operations
            ├─► Reloads menu_signal from DB → setMenuHighlights()
            ├─► ❌ Does NOT extract openingHours to state
            └─► ❌ Does NOT extract detectedMenuUrls
```

---

## Conclusion

**The "Hent info" button and Onboarding use the same underlying extraction mechanism**, but the frontend handling differs:

1. **✅ Opening hours ARE extracted and saved to database** in both flows
2. **❌ Opening hours are NOT displayed in the UI** in either flow
3. **❌ "Hent info" doesn't handle detectedMenuUrls** (but Onboarding does)

**Fix**: Add opening hours extraction to the frontend state update logic in `handleWebsiteAnalysis`.
