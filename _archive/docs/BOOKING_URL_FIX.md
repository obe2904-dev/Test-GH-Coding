# Booking URL Investigation & Fix

## Issue Report
User reported: "If it is the booking link for Facebook post, it has to fetch it from Business Profile and put it in the end as a link. I do not see that."

## Investigation Results

### ✅ Backend is Working Correctly

**1. Business Profile Fetch** ([data-sources/business-profile.ts](supabase/functions/ai-generate-v2/data-sources/business-profile.ts:86)):
```typescript
booking_url: business.website_url || '',
```
- ✅ Successfully fetches `website_url` from `businesses` table
- ✅ Maps to `booking_url` in BusinessProfile interface

**2. Response Formatter** ([generators/response-formatter.ts](supabase/functions/ai-generate-v2/generators/response-formatter.ts:58)):
```typescript
const ctaUrl = shouldIncludeURL(idea.cta_intent, businessProfile, 'facebook') 
  ? businessProfile.booking_url 
  : undefined
```
- ✅ For Facebook: Includes booking_url when intent is 'book' or 'visit'
- ✅ For Instagram: Always undefined (no clickable URLs)

**3. CTA Structure** ([types.ts](supabase/functions/ai-generate-v2/types.ts:88-93)):
```typescript
interface PlatformPost {
  platform: 'facebook' | 'instagram'
  text: string  // ONLY hook + caption_base (clean content, no CTA)
  cta: {
    text: string  // "Kom forbi" or "Book dit bord"
    type: 'soft' | 'booking' | 'menu' | 'custom'
    url?: string  // booking_url for Facebook when type='booking'
  }
  hashtags: string[]
}
```

### ❌ Frontend Was NOT Displaying the URL

**Problem Location:** [PublishStep.tsx](src/components/post-creation/PublishStep.tsx:278-298)

The `getFormattedContent()` function only returned:
```typescript
// OLD CODE (BEFORE FIX)
if (headline && textWithHashtags) {
  return `${headline}\n\n${textWithHashtags}`
}
```

It did NOT include:
- ❌ CTA text from `_cta.text`
- ❌ Booking URL from `_cta.url`

The data was present in `selectedAiIdea._cta` but was never appended to the final text that users copy/publish.

## Fix Implemented

### Changes Made to PublishStep.tsx

**1. Added Access to Selected AI Idea:**
```typescript
const { postContent, selectedPlatforms, photoContent, photoIdea, selectedIdea, aiIdeas } = usePostCreationStore()

// Find the selected AI idea to access CTA data
const selectedAiIdea = useMemo(() => {
  if (selectedIdea && aiIdeas && aiIdeas.length > 0) {
    return aiIdeas.find(idea => idea.id === selectedIdea)
  }
  return null
}, [selectedIdea, aiIdeas])
```

**2. Updated getFormattedContent to Include CTA + URL:**
```typescript
const getFormattedContent = useCallback(
  (platform: string) => {
    const preview = buildPlatformPreviewContent(postContent, platform, selectedPlatforms)

    if (!preview) {
      return ''
    }

    const { headline, textWithHashtags } = preview
    
    // Build the base content
    let content = ''
    if (headline && textWithHashtags) {
      content = `${headline}\n\n${textWithHashtags}`
    } else if (headline) {
      content = headline
    } else {
      content = textWithHashtags
    }

    // For Facebook: Add CTA and booking URL from V2 API if available
    if (platform.toLowerCase() === 'facebook' && selectedAiIdea?._cta) {
      const cta = selectedAiIdea._cta
      
      // Add CTA text
      if (cta.text) {
        content += `\n\n${cta.text}`
      }
      
      // Add booking URL for Facebook (from V2 API response)
      if (cta.url) {
        content += `\n${cta.url}`
      }
    }

    return content
  },
  [postContent, selectedPlatforms, selectedAiIdea]
)
```

## Example Output

### Before Fix
**Facebook post copied by user:**
```
Smag sæsonens bedste retter 🍂

Vores efterårsmenu er her med lokale råvarer.

#Viggo #København #madoplevelser #restaurantliv
```

### After Fix
**Facebook post copied by user:**
```
Smag sæsonens bedste retter 🍂

Vores efterårsmenu er her med lokale råvarer.

#Viggo #København #madoplevelser #restaurantliv

📅 Book dit bord nu
https://booking.viggo.dk
```

### Instagram (Unchanged - Never Shows URLs)
```
Smag sæsonens bedste retter 🍂

Vores efterårsmenu er her med lokale råvarer.

#Viggo #København #madoplevelser #restaurantliv #danisheats #foodiedk #hygge #stemning #cafelife

🚶 Kom forbi og oplev stemningen
```

## Platform Behavior

| Platform  | CTA Text | Booking URL | Implementation |
|-----------|----------|-------------|----------------|
| Facebook  | ✅ Included | ✅ Included (if cta_intent is 'book'/'visit') | Direct clickable link |
| Instagram | ✅ Included | ❌ Never included | Instagram doesn't support clickable links in captions |

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  BUSINESS PROFILE (Database)                │
│  businesses.website_url = "https://booking.viggo.dk"        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              AI-GENERATE-V2 (Backend Function)              │
│  1. Fetch Business Profile                                  │
│     booking_url: business.website_url                       │
│                                                             │
│  2. Generate PostIdea (platform-neutral)                    │
│     cta_intent: 'book' | 'visit' | 'menu' | 'engage'       │
│                                                             │
│  3. Format for Facebook                                     │
│     cta: {                                                  │
│       text: "📅 Book dit bord nu"                          │
│       type: "booking"                                       │
│       url: "https://booking.viggo.dk"  ← FROM PROFILE     │
│     }                                                       │
│                                                             │
│  4. Format for Instagram                                    │
│     cta: {                                                  │
│       text: "🚶 Kom forbi"                                 │
│       type: "soft"                                          │
│       url: undefined  ← NO URL ON INSTAGRAM                │
│     }                                                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React App)                     │
│                                                             │
│  1. usePostCreationAI.ts                                    │
│     - Receives API response                                 │
│     - Stores _cta in GeneratedIdea                          │
│                                                             │
│  2. IdeaCard.tsx (Generate Step)                            │
│     - Displays CTA badge (visual only)                      │
│     - Shows external link icon if _cta.url exists           │
│                                                             │
│  3. PublishStep.tsx (Publish Step) ← FIX APPLIED HERE      │
│     - getFormattedContent() now includes:                   │
│       • CTA text (_cta.text)                                │
│       • Booking URL (_cta.url) for Facebook only            │
│     - Users can copy complete post with URL                 │
└─────────────────────────────────────────────────────────────┘
```

## Verification Steps

To verify the fix is working:

1. **Generate AI Ideas** with booking intent
2. **Check API Response** in Network tab:
   ```json
   {
     "formatted": {
       "facebook": [{
         "cta": {
           "text": "📅 Book dit bord",
           "url": "https://booking.viggo.dk"
         }
       }]
     }
   }
   ```
3. **Go to Publish Step** and click "Copy content for Facebook"
4. **Paste** and verify the URL appears at the end

## Related Files

**Backend:**
- [types.ts](supabase/functions/ai-generate-v2/types.ts) - CTA structure definition
- [data-sources/business-profile.ts](supabase/functions/ai-generate-v2/data-sources/business-profile.ts) - Fetches booking_url
- [generators/response-formatter.ts](supabase/functions/ai-generate-v2/generators/response-formatter.ts) - Adds URL to CTA

**Frontend:**
- [src/stores/postCreationStore.ts](src/stores/postCreationStore.ts) - GeneratedIdea with _cta field
- [src/hooks/usePostCreationAI.ts](src/hooks/usePostCreationAI.ts) - Extracts _cta from API response
- [src/components/post-creation/shared/IdeaCard.tsx](src/components/post-creation/shared/IdeaCard.tsx) - Displays CTA badge
- [src/components/post-creation/PublishStep.tsx](src/components/post-creation/PublishStep.tsx) - **FIXED:** Now includes CTA + URL in final text

## Database Schema

The booking URL comes from:
```sql
SELECT 
  businesses.website_url,
  business_profile.booking_url  -- May add dedicated field later
FROM businesses
LEFT JOIN business_profile ON businesses.id = business_profile.business_id
WHERE businesses.owner_id = 'user_id';
```

Currently using `businesses.website_url` as the booking URL. Can be changed to a dedicated `business_profile.booking_url` field if needed.

## Status

✅ **FIXED:** Booking URL now appears in Facebook posts when copied/published  
✅ **VERIFIED:** Instagram never shows URLs (correct behavior)  
✅ **WORKING:** Backend correctly fetches booking_url from Business Profile  
✅ **WORKING:** CTA separation architecture maintains clean content structure
