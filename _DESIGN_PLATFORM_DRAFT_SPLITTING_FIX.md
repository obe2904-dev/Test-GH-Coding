# Platform-Specific Draft Splitting Fix
## Complete Technical Specification

**Date**: 2026-06-19  
**Status**: Design Document  
**Impact**: Critical - Affects all AI Ideas posts with multiple platforms

---

## 🎯 Objective

When user clicks "Fortsæt til Udgiv" (Continue to Publish) in the Design step, the system must:

1. Split the unified draft into **separate platform-specific drafts** (one for Facebook, one for Instagram)
2. Each draft must contain **complete, ready-to-publish content** including:
   - Platform-specific text
   - Platform-specific hashtags
   - Platform-specific CTA (with booking URL for Facebook, without for Instagram)
   - Platform-specific emojis (already in text from generate-text-from-idea)
3. Update `daily_suggestions.status` from `'selected'` → `'consumed'`
4. Maintain full traceability back to the original suggestion via `suggestion_id`

---

## 📊 Current Data Flow (What Works)

### Stage 1: Forslag → Database
✅ **Working correctly**

```
get-quick-suggestions edge function
  ↓
daily_suggestions table
  - status: 'available'
  - selected: false
  - generated_platform_content: NULL
```

### Stage 2: Design → Database
✅ **Working correctly**

```
User clicks "Generer" on idea card
  ↓
generate-text-from-idea edge function
  ↓ Generates platform-specific content:
  {
    sharedText: "Dampende muslinger med sprøde pomfritter...",
    facebook: {
      text: "Dampende muslinger med sprøde pomfritter...",
      hashtags: ["AarhusCCafe", "AarhusC", "Moulesfrites"],
      cta: {
        text: "Kom forbi",
        type: "booking",
        url: "https://booking.example.com"
      }
    },
    instagram: {
      text: "Dampende muslinger med sprøde pomfritter...",
      hashtags: ["AarhusCCafe", "AarhusC", "Moulesfrites", "Cafe", "CoffeeLovers"],
      cta: {
        text: "Kom forbi",
        type: "soft"
      }
    }
  }
  ↓
UPDATE daily_suggestions SET
  generated_text = "Dampende muslinger...",
  generated_platform_content = { facebook: {...}, instagram: {...} },
  generated_hashtags = [...],
  status = 'selected',
  selected = true,
  selected_at = NOW()
  ↓
Frontend PostContent store populated:
  {
    headline: "Mæt og glad med Moules Frites",
    text: "Dampende muslinger...",
    platformSpecific: true,
    platformContent: {
      facebook: {
        text: "Dampende muslinger...",
        hashtags: [{tag: "#AarhusCCafe", enabled: true, platforms: ["facebook", "instagram"]}, ...],
        adjustments: { includeHashtags: true, ... }
      },
      instagram: {
        text: "Dampende muslinger...",
        hashtags: [{tag: "#AarhusCCafe", enabled: true, platforms: ["facebook", "instagram"]}, ...],
        adjustments: { includeHashtags: true, ... }
      }
    }
  }
  ↓
Auto-save creates unified draft in post_drafts:
  {
    business_id: "xxx",
    idea_source: "quick_suggestions",
    suggestion_id: 53,
    platform: NULL,  // Unified draft
    post_text: "Dampende muslinger...",
    content_json: { /* full PostContent object */ },
    photo_url: "https://...",
    platforms: ["facebook", "instagram"]
  }
```

### Stage 3: Design → Udgiv Transition
❌ **BROKEN - Needs Fix**

```
User clicks "Fortsæt til Udgiv"
  ↓
handleCreateNext() function
  ↓
❌ CURRENT (WRONG):
  Creates 2 drafts with IDENTICAL content:
    - Facebook draft: { contentJson: { platformContent: { facebook: {...}, instagram: {...} } } }
    - Instagram draft: { contentJson: { platformContent: { facebook: {...}, instagram: {...} } } }
  ↓
❌ Missing: Update daily_suggestions status to 'consumed'
```

---

## 🔧 Required Fix: Complete Data Structure

### What Each Platform Draft Must Contain

#### Facebook Draft
```typescript
{
  // Identification
  id: "uuid-1",
  business_id: "xxx",
  idea_source: "quick_suggestions",
  suggestion_id: 53,  // ✅ Traceability to daily_suggestions
  platform: "facebook",  // ✅ Platform identifier
  
  // Content ready for publish
  post_text: "Dampende muslinger med sprøde pomfritter venter på dig hos Café Faust. Forkæl dig selv med en klassisk Moules Frites, der er perfekt til en aften i godt selskab. Kom forbi i dag og lad smagen tage dig til Paris! 🍽️\n\n#AarhusCCafe #AarhusC #Moulesfrites",
  
  // Full content snapshot for editing
  content_json: {
    headline: "Mæt og glad med Moules Frites",
    text: "Dampende muslinger med sprøde pomfritter venter på dig hos Café Faust. Forkæl dig selv med en klassisk Moules Frites, der er perfekt til en aften i godt selskab. Kom forbi i dag og lad smagen tage dig til Paris! 🍽️",
    textWithHashtags: "Dampende muslinger... 🍽️\n\n#AarhusCCafe #AarhusC #Moulesfrites",
    hashtags: [
      { tag: "#AarhusCCafe", enabled: true, platforms: ["facebook"] },
      { tag: "#AarhusC", enabled: true, platforms: ["facebook"] },
      { tag: "#Moulesfrites", enabled: true, platforms: ["facebook"] }
    ],
    adjustments: {
      length: "current",
      tone: "brand",
      includeHashtags: true,
      includeEmojis: true,
      includeBookingLink: true
    },
    cta: {
      text: "Kom forbi",
      type: "booking",
      url: "https://booking.example.com"  // ✅ Booking URL for Facebook
    }
  },
  
  // Media
  photo_url: "https://storage.supabase.co/...",
  
  // Scheduling
  suggested_post_datetime: "2026-06-19T21:00:00Z",
  platforms: ["facebook"],  // ✅ Single platform
  
  // Metadata
  created_at: "2026-06-19T18:40:00Z",
  updated_at: "2026-06-19T18:40:00Z"
}
```

#### Instagram Draft
```typescript
{
  // Identification
  id: "uuid-2",
  business_id: "xxx",
  idea_source: "quick_suggestions",
  suggestion_id: 53,  // ✅ Same suggestion_id for traceability
  platform: "instagram",  // ✅ Platform identifier
  
  // Content ready for publish (MORE HASHTAGS, NO BOOKING URL)
  post_text: "Dampende muslinger med sprøde pomfritter venter på dig hos Café Faust. Forkæl dig selv med en klassisk Moules Frites, der er perfekt til en aften i godt selskab. Kom forbi i dag og lad smagen tage dig til Paris! 🍽️\n\n#AarhusCCafe #AarhusC #Moulesfrites #Cafe #CoffeeLovers",
  
  // Full content snapshot for editing
  content_json: {
    headline: "Mæt og glad med Moules Frites",
    text: "Dampende muslinger med sprøde pomfritter venter på dig hos Café Faust. Forkæl dig selv med en klassisk Moules Frites, der er perfekt til en aften i godt selskab. Kom forbi i dag og lad smagen tage dig til Paris! 🍽️",
    textWithHashtags: "Dampende muslinger... 🍽️\n\n#AarhusCCafe #AarhusC #Moulesfrites #Cafe #CoffeeLovers",
    hashtags: [
      { tag: "#AarhusCCafe", enabled: true, platforms: ["instagram"] },
      { tag: "#AarhusC", enabled: true, platforms: ["instagram"] },
      { tag: "#Moulesfrites", enabled: true, platforms: ["instagram"] },
      { tag: "#Cafe", enabled: true, platforms: ["instagram"] },
      { tag: "#CoffeeLovers", enabled: true, platforms: ["instagram"] }
    ],
    adjustments: {
      length: "current",
      tone: "brand",
      includeHashtags: true,
      includeEmojis: true,
      includeBookingLink: false  // ✅ No booking link for Instagram
    },
    cta: {
      text: "Kom forbi",
      type: "soft"
      // ✅ NO url property for Instagram
    }
  },
  
  // Media
  photo_url: "https://storage.supabase.co/...",
  
  // Scheduling
  suggested_post_datetime: "2026-06-19T21:00:00Z",
  platforms: ["instagram"],  // ✅ Single platform
  
  // Metadata
  created_at: "2026-06-19T18:40:00Z",
  updated_at: "2026-06-19T18:40:00Z"
}
```

---

## 🔍 Data Source: Where Platform-Specific Content Comes From

### Primary Source: `PostContent` Store
The frontend already has the complete platform-specific content in `postCreationStore.postContent`:

```typescript
// Located in: usePostCreationStore state
postContent = {
  headline: "...",
  text: "...",  // Base text (no hashtags)
  platformSpecific: true,  // ✅ Indicates platform-specific content exists
  platformContent: {
    facebook: {
      text: "...",
      hashtags: [...],  // Filtered for Facebook
      adjustments: {...}
    },
    instagram: {
      text: "...",
      hashtags: [...],  // Filtered for Instagram (more hashtags)
      adjustments: {...}
    }
  },
  hashtags: [...]  // All hashtags with platform assignments
}
```

### Secondary Source: `daily_suggestions.generated_platform_content`
Backup source if PostContent is lost (shouldn't happen):

```json
{
  "facebook": {
    "text": "...",
    "hashtags": ["AarhusCCafe", "AarhusC", "Moulesfrites"],
    "cta": { "type": "soft" }
  },
  "instagram": {
    "text": "...",
    "hashtags": ["AarhusCCafe", "AarhusC", "Moulesfrites", "Cafe", "CoffeeLovers"],
    "cta": { "type": "soft" }
  }
}
```

### CTA Source: `postCreationStore.postCta`
```typescript
// Located in: usePostCreationStore state
postCta = {
  text: "Kom forbi",
  type: "booking",  // or "soft"
  url: "https://booking.example.com"  // Only for Facebook when type === "booking"
}
```

---

## 🛠️ Implementation Plan

### Step 1: Update `handleCreateNext` Function
**File**: `src/pages/dashboard/CreatePostPage.tsx`

**Current Code** (lines 954-1003):
```typescript
const handleCreateNext = async () => {
  // Save current text to draftMap (weekly plan only)
  if (weeklyContentPlan && activeContent) {
    setDraftMapEntry(weeklyPlanPostIndex, activeContent)
  }

  const suggestedPostDatetime = computeSuggestedPostDatetime()

  // ❌ WRONG: Copies entire combinedDraft.data to both platforms
  if (selectedPlatforms.length > 1) {
    const baseKey = buildDbDraftKey()
    if (baseKey) {
      const combinedDraft = await postDrafts.loadDraft(baseKey)
      
      if (combinedDraft) {
        for (const platform of selectedPlatforms) {
          const platformKey = { ...baseKey, platform }
          await postDrafts.saveDraft(platformKey, {
            ...combinedDraft.data,  // ❌ Entire object copied
            suggestedPostDatetime,
          })
        }
        
        await postDrafts.deleteByKey(baseKey)
      }
    }
  }
  
  setCurrentStep('publish')
}
```

**Required Changes**:
1. ✅ Load unified draft (already done)
2. ✅ Extract `PostContent` from `combinedDraft.data.contentJson`
3. ✅ For each platform, call `buildPlatformPreviewContent()` to extract platform-specific content
4. ✅ Build platform-specific `content_json` and `post_text`
5. ✅ Include CTA with booking URL for Facebook only
6. ✅ Save platform-specific drafts
7. ✅ Update `daily_suggestions.status` to `'consumed'`
8. ✅ Delete unified draft

### Step 2: Create Helper Function for Platform Content Extraction

**New Function**: `buildPlatformDraftContent()`

```typescript
/**
 * Extracts platform-specific content from unified PostContent
 * Returns complete draft data ready for publishing
 */
function buildPlatformDraftContent(
  postContent: PostContent,
  platform: 'facebook' | 'instagram',
  selectedPlatforms: string[],
  postCta: { text: string; type: string; url?: string } | null
): {
  postText: string,
  contentJson: object
} {
  // Use existing utility to extract platform-specific content
  const preview = buildPlatformPreviewContent(postContent, platform, selectedPlatforms)
  
  // Get platform-specific hashtags
  const platformHashtags = preview.hashtags
    .filter(h => h.enabled)
    .map(h => ({ ...h, platforms: [platform] }))
  
  // Build post_text with hashtags appended
  const hashtagString = platformHashtags
    .map(h => h.tag)
    .join(' ')
  
  const postText = preview.includeHashtags && hashtagString
    ? `${preview.text}\n\n${hashtagString}`
    : preview.text
  
  // Build platform-specific content_json
  const contentJson = {
    headline: preview.headline,
    text: preview.text,
    textWithHashtags: postText,
    hashtags: platformHashtags,
    adjustments: {
      length: 'current',
      tone: 'brand',
      includeHashtags: true,
      includeEmojis: true,
      includeBookingLink: platform === 'facebook' && postCta?.type === 'booking'
    },
    // Include CTA with URL only for Facebook booking intent
    ...(postCta && {
      cta: platform === 'facebook' && postCta.type === 'booking'
        ? { text: postCta.text, type: postCta.type, url: postCta.url }
        : { text: postCta.text, type: 'soft' }
    })
  }
  
  return { postText, contentJson }
}
```

### Step 3: Update Daily Suggestions Status

**New Function**: `updateSuggestionStatus()`

```typescript
/**
 * Updates daily_suggestions status lifecycle
 */
async function updateSuggestionStatus(
  suggestionId: number,
  businessId: string,
  status: 'selected' | 'consumed' | 'published'
) {
  const timestampField = 
    status === 'selected' ? 'selected_at' :
    status === 'consumed' ? 'consumed_at' :
    'published_at'
  
  const { error } = await supabase
    .from('daily_suggestions')
    .update({
      status,
      [timestampField]: new Date().toISOString(),
      selected: status !== 'available'
    })
    .eq('id', suggestionId)
    .eq('business_id', businessId)
  
  if (error) {
    console.warn(`Failed to update suggestion status to ${status}:`, error)
  } else {
    console.log(`✅ Updated suggestion ${suggestionId} status: ${status}`)
  }
}
```

### Step 4: Revised `handleCreateNext` Implementation

```typescript
const handleCreateNext = async () => {
  // 1. Save to weekly plan draft map if applicable
  if (weeklyContentPlan && activeContent) {
    setDraftMapEntry(weeklyPlanPostIndex, activeContent)
  }

  const suggestedPostDatetime = computeSuggestedPostDatetime()

  // 2. Update suggestion status to 'consumed' when entering Udgiv
  if (activePath === 'ai-ideas' && selectedSuggestionData?.id && businessData.business?.id) {
    await updateSuggestionStatus(
      selectedSuggestionData.id,
      businessData.business.id,
      'consumed'
    )
  }

  // 3. Split draft into platform-specific drafts
  if (selectedPlatforms.length > 1) {
    const baseKey = buildDbDraftKey()
    if (!baseKey) {
      setCurrentStep('publish')
      return
    }

    // Load the unified draft
    const combinedDraft = await postDrafts.loadDraft(baseKey)
    
    if (combinedDraft) {
      console.log('[handleCreateNext] Splitting draft into platform-specific drafts:', selectedPlatforms)
      
      // Extract PostContent from the unified draft
      const postContent = combinedDraft.data.contentJson as PostContent
      const photoUrl = combinedDraft.data.photoUrl
      
      // Create a platform-specific draft for each platform
      for (const platform of selectedPlatforms) {
        const platformKey = { ...baseKey, platform }
        
        // Extract platform-specific content
        const { postText, contentJson } = buildPlatformDraftContent(
          postContent,
          platform as 'facebook' | 'instagram',
          selectedPlatforms,
          postCta
        )
        
        // Save platform-specific draft
        await postDrafts.saveDraft(platformKey, {
          platforms: [platform],  // Single platform only
          postText,
          photoUrl,
          contentJson,
          suggestedPostDatetime,
        })
        
        console.log(`✅ Created ${platform} draft with ${(contentJson as any).hashtags?.length || 0} hashtags`)
      }
      
      // Delete the original unified draft
      await postDrafts.deleteByKey(baseKey)
      
      console.log('[handleCreateNext] Platform split complete')
    }
  } else {
    // Single platform - update existing draft with suggested datetime
    const baseKey = buildDbDraftKey()
    if (baseKey) {
      const existingDraft = await postDrafts.loadDraft(baseKey)
      if (existingDraft && suggestedPostDatetime) {
        await postDrafts.saveDraft(baseKey, {
          ...existingDraft.data,
          suggestedPostDatetime,
        })
      }
    }
  }
  
  setCurrentStep('publish')
}
```

---

## 📋 Verification Checklist

After implementation, verify:

### Database Verification
- [ ] `post_drafts` table has 2 rows (one per platform) when user has both FB and IG
- [ ] Each draft has `platform` field set correctly (`'facebook'` or `'instagram'`)
- [ ] Each draft has identical `suggestion_id` (traceability preserved)
- [ ] `daily_suggestions.status` is `'consumed'` after entering Udgiv
- [ ] `daily_suggestions.consumed_at` timestamp is set

### Content Verification - Facebook Draft
- [ ] `post_text` contains text + Facebook hashtags only
- [ ] `content_json.hashtags` contains only Facebook hashtags (3 hashtags)
- [ ] `content_json.cta.url` exists when booking intent is set
- [ ] `content_json.adjustments.includeBookingLink` is `true` when booking

### Content Verification - Instagram Draft
- [ ] `post_text` contains text + Instagram hashtags (5 hashtags - MORE than Facebook)
- [ ] `content_json.hashtags` contains only Instagram hashtags
- [ ] `content_json.cta.url` does NOT exist (soft CTA only)
- [ ] `content_json.adjustments.includeBookingLink` is `false`

### Functional Verification
- [ ] Uitgiv timeline shows 2 separate draft cards (one per platform)
- [ ] Facebook draft preview shows booking URL when applicable
- [ ] Instagram draft preview does NOT show booking URL
- [ ] Hashtag counts differ between platforms (Instagram has more)
- [ ] Publishing one platform doesn't affect the other draft

---

## 🚨 Edge Cases to Handle

### Case 1: User has only Facebook
- **Expected**: No split needed, update existing draft with suggested datetime
- **Status update**: Still update to `'consumed'`

### Case 2: User has only Instagram
- **Expected**: No split needed, update existing draft with suggested datetime
- **Status update**: Still update to `'consumed'`

### Case 3: User edits text in Design before clicking Udgiv
- **Expected**: Edited content (in PostContent store) is used for split
- **Source**: `activeContent` from store, not database cache

### Case 4: No booking link configured
- **Expected**: Both platforms get soft CTA without URL
- **Facebook**: `{ text: "Kom forbi", type: "soft" }`
- **Instagram**: `{ text: "Kom forbi", type: "soft" }`

### Case 5: User goes back from Udgiv to Design
- **Expected**: Platform-specific drafts remain (don't merge back)
- **Or**: Delete platform drafts and restore unified draft (needs decision)

### Case 6: Weekly Plan posts (not AI Ideas)
- **Expected**: Same platform-splitting logic applies
- **Status update**: N/A (no daily_suggestions row)

---

## 🔄 Complete Data Flow (After Fix)

```
FORSLAG
  ↓ User selects idea
  ↓ User clicks "Generer"
DESIGN
  ↓ generate-text-from-idea creates platform-specific content
  ↓ Saves to daily_suggestions.generated_platform_content
  ↓ Saves to PostContent store
  ↓ Auto-save creates unified draft (platform=NULL)
  ↓
  ↓ User clicks "Fortsæt til Udgiv"
  ↓
handleCreateNext() {
  1. Update daily_suggestions.status = 'consumed' ✅
  2. Load unified draft ✅
  3. Extract PostContent ✅
  4. For each platform: ✅
     - Call buildPlatformPreviewContent()
     - Build platform-specific content_json
     - Build post_text with platform hashtags
     - Add CTA (with URL for FB, without for IG)
     - Save platform draft with platform field set
  5. Delete unified draft ✅
}
  ↓
UDGIV
  ↓ Shows 2 draft cards (Facebook + Instagram)
  ↓ Each draft has complete, ready-to-publish content
  ↓ User schedules/publishes
  ↓
  ↓ Update daily_suggestions.status = 'published' ✅
  ↓ Create published_posts rows ✅
  ↓ Delete platform drafts ✅
DONE
```

---

## 📊 Database Schema Alignment

### `post_drafts` Table Structure
```sql
CREATE TABLE post_drafts (
  id UUID PRIMARY KEY,
  business_id TEXT NOT NULL,
  idea_source TEXT NOT NULL,  -- 'quick_suggestions' | 'weekly_plan' | 'write'
  
  -- Platform identifier (NULL for unified drafts, specific for split)
  platform TEXT,  -- 'facebook' | 'instagram' | NULL
  
  -- Traceability
  suggestion_id INTEGER,  -- FK to daily_suggestions.id
  weekly_plan_id TEXT,
  weekly_plan_slot_date DATE,
  
  -- Content (ready to publish)
  platforms TEXT[],  -- ['facebook'] or ['instagram'] after split
  post_text TEXT,  -- Text + hashtags formatted for platform
  photo_url TEXT,
  content_json JSONB,  -- Platform-specific PostContent snapshot
  
  -- Scheduling
  suggested_post_datetime TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraints (from rollback migration)
CREATE UNIQUE INDEX idx_post_drafts_unique_suggestion
  ON post_drafts (business_id, suggestion_id, idea_source)
  WHERE suggestion_id IS NOT NULL AND platform IS NULL;

CREATE UNIQUE INDEX idx_post_drafts_unique_platform_suggestion
  ON post_drafts (business_id, platform, suggestion_id, idea_source)
  WHERE suggestion_id IS NOT NULL AND platform IS NOT NULL;
```

### `daily_suggestions` Table Structure
```sql
CREATE TABLE daily_suggestions (
  id SERIAL PRIMARY KEY,
  business_id UUID NOT NULL,
  
  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'available',  -- 'available' | 'selected' | 'consumed' | 'published'
  selected BOOLEAN DEFAULT false,
  selected_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  
  -- Generated content
  generated_text TEXT,
  generated_hashtags JSONB,
  generated_platform_content JSONB,  -- { facebook: {...}, instagram: {...} }
  platforms_generated TEXT[],
  
  -- Other fields...
  title TEXT,
  menu_item_name TEXT,
  content_type TEXT,
  photo_idea TEXT,
  -- ...
);
```

---

## 🎯 Success Criteria

✅ **The fix is successful when**:

1. **Facebook draft contains**:
   - Text with 3 hashtags: `#AarhusCCafe #AarhusC #Moulesfrites`
   - CTA with booking URL when applicable
   - `platform: "facebook"`
   - `suggestion_id: 53`

2. **Instagram draft contains**:
   - Text with 5 hashtags: `#AarhusCCafe #AarhusC #Moulesfrites #Cafe #CoffeeLovers`
   - CTA without booking URL (soft only)
   - `platform: "instagram"`
   - `suggestion_id: 53`

3. **Database state**:
   - `daily_suggestions.status = 'consumed'` after entering Udgiv
   - 2 rows in `post_drafts` (one per platform)
   - Both drafts reference same `suggestion_id`
   - Unified draft (platform=NULL) is deleted

4. **User experience**:
   - Udgiv timeline shows 2 separate draft cards
   - Each card displays platform-specific content
   - Publishing one platform leaves the other draft intact
   - Full traceability maintained for analytics

---

## 🚀 Implementation Priority

1. **Critical**: Create `buildPlatformDraftContent()` helper function
2. **Critical**: Update `handleCreateNext()` to use platform extraction
3. **Critical**: Add `updateSuggestionStatus()` function
4. **Important**: Add logging for debugging platform splits
5. **Nice-to-have**: Add UI indicator showing platform split occurred

---

## 📝 Notes

- **No data migration needed** - fix applies only to new drafts going forward
- **Existing utility reuse** - `buildPlatformPreviewContent()` already exists and works
- **CTA source** - Comes from `postCta` store field (set during text generation)
- **Emoji handling** - Already in text from `generate-text-from-idea`, no special handling needed
- **Photo handling** - Same photo URL copied to both platform drafts

---

**End of Design Document**
