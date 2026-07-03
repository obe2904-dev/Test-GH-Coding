# Media Gallery Implementation Plan

**Feature**: Persistent Media Library for Photo/Video Management  
**Status**: Planning Phase  
**Estimated Timeline**: 7-11 days  
**Priority**: High Value - Improves UX & reduces upload friction

---

## 📋 Executive Summary

Build a persistent media library that stores all uploaded photos/videos in Supabase, allowing users to browse, organize, and reuse media across multiple posts without re-uploading.

### Key Benefits
- **User Efficiency**: Build a library of high-quality assets over time
- **Reduced Friction**: Select from gallery instead of navigating file system
- **Better Organization**: Categorize by post type, dish name, tags
- **Cross-Context Reusability**: Use same photo in Skriv Selv, AI Forslag, Ugeplan
- **Storage Optimization**: Already compressing images to 1080px @ 85% quality

---

## ✅ Current State: Compression Already Implemented

### Existing Compression Functions

#### 1. `image-processing.ts` - For Storage Uploads
```typescript
compressImageFile(file: File, maxDimension = 2048, quality = 0.85)
```
- Resizes to max **2048px** (longest dimension)
- Compresses as **JPEG** at **85% quality**
- Used before uploading to Supabase Storage

#### 2. `postMedia.ts` - For Social Media
```typescript
resizeImageForSocialMedia(file: File, maxPx = 1080, quality = 0.85)
```
- Resizes to max **1080px** (optimal for social media)
- Compresses as **JPEG** at **85% quality**
- Used when saving drafts and publishing

**Storage Savings**: Typical 4MB iPhone photo → ~200-400KB after compression!

---

## 🗂️ PHASE 1: Backend Infrastructure (1 day)

### 1.1 Database Schema

**File**: `supabase/migrations/XXX_create_media_library.sql`

```sql
CREATE TABLE media_library (
  -- Core identifiers
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id TEXT NOT NULL,
  
  -- File storage
  storage_path TEXT NOT NULL UNIQUE,
  storage_bucket TEXT DEFAULT 'user-media' NOT NULL,
  thumbnail_path TEXT, -- Smaller preview (150x150)
  
  -- File metadata
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image', 'video')) NOT NULL,
  
  -- Image properties (NULL for videos)
  width INTEGER,
  height INTEGER,
  aspect_ratio DECIMAL(5,3), -- e.g., 1.778 for 16:9
  
  -- Video properties (NULL for images)
  duration INTEGER, -- seconds
  video_thumbnail_path TEXT, -- Cover frame for videos
  
  -- Categorization & tagging
  post_type TEXT, -- 'menu_item', 'atmosphere', 'behind_the_scenes', etc.
  dish_name TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  alt_text TEXT, -- Accessibility description
  
  -- Usage tracking
  upload_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_used_date TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0 NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- Indexes for performance
CREATE INDEX idx_media_library_user_id ON media_library(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_library_business_id ON media_library(business_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_library_upload_date ON media_library(upload_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_library_post_type ON media_library(post_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_library_media_type ON media_library(media_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_library_tags ON media_library USING GIN(tags) WHERE deleted_at IS NULL;

-- Row Level Security
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own media"
  ON media_library FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own media"
  ON media_library FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own media"
  ON media_library FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can soft-delete own media"
  ON media_library FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE TRIGGER media_library_updated_at
  BEFORE UPDATE ON media_library
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Function to update last_used_date when media is reused
CREATE OR REPLACE FUNCTION increment_media_usage(media_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE media_library
  SET 
    usage_count = usage_count + 1,
    last_used_date = NOW()
  WHERE id = media_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 1.2 Storage Bucket Setup

**Bucket**: `user-media`

**Folder Structure**:
```
/{businessId}/
  /originals/      - Original uploads (compressed to 2048px)
  /thumbnails/     - Small previews (150x150)
  /adjusted/       - AI-enhanced versions
  /video-covers/   - Video cover frames
```

**Policies**:
- Authenticated users can upload to their own businessId folder
- Public read access (images are not sensitive)
- Max file size: 10MB

### 1.3 Post Type Taxonomy

```typescript
type MediaPostType = 
  | 'menu_item'           // Food/drink photos
  | 'atmosphere'          // Venue, ambiance
  | 'behind_the_scenes'   // Kitchen, staff
  | 'event'               // Special occasions
  | 'announcement'        // Opening hours, news
  | 'customer_moment'     // Guest photos
  | 'team'                // Staff portraits
  | 'seasonal'            // Holiday-specific
  | 'branding'            // Logo, graphics
  | 'other'
```

---

## 🔧 PHASE 2: Backend API Functions (1-2 days)

### 2.1 API File Structure

**File**: `src/api/mediaLibrary.ts` (NEW FILE)

```typescript
import { supabase } from '../lib/supabase'
import { compressImageFile } from './image-processing'

export interface MediaMetadata {
  postType?: string
  dishName?: string
  tags?: string[]
  altText?: string
}

export interface MediaLibraryItem {
  id: string
  storage_path: string
  thumbnail_path: string | null
  filename: string
  file_size: number
  mime_type: string
  media_type: 'image' | 'video'
  width: number | null
  height: number | null
  duration: number | null
  post_type: string | null
  dish_name: string | null
  tags: string[]
  upload_date: string
  last_used_date: string | null
  usage_count: number
}
```

### 2.2 Key Functions

#### uploadToMediaLibrary()
- Compress image (using existing `compressImageFile`)
- Upload to `user-media` bucket
- Generate thumbnail (150x150)
- Create database record with metadata
- Return `MediaLibraryItem`

#### getMediaLibrary()
- Fetch user's media with filters
- Support pagination (limit/offset)
- Filter by: mediaType, postType, searchQuery
- Order by upload_date DESC
- Return items + total count

#### getMediaUrl()
- Convert storage_path → public CDN URL
- Use Supabase Storage's `getPublicUrl()`

#### updateMediaMetadata()
- Update post_type, dish_name, tags, alt_text
- Preserve upload date and usage stats

#### deleteMediaItem()
- Soft delete (set deleted_at timestamp)
- Don't delete from storage (for recovery)

#### recordMediaUsage()
- Call `increment_media_usage()` RPC function
- Update last_used_date + increment usage_count

---

## 🎨 PHASE 3: Frontend Components (2-3 days)

### 3.1 Component Structure

```
src/components/media-gallery/
├── MediaGallery.tsx              - Main container
├── MediaGalleryModal.tsx         - Selection modal (for post creation)
├── MediaGallerySidebar.tsx       - Sidebar widget
├── MediaGalleryGrid.tsx          - Grid display with infinite scroll
├── MediaGalleryItem.tsx          - Individual media card
├── MediaGalleryFilters.tsx       - Filter controls
├── MediaUploadMetadataForm.tsx   - Metadata capture during upload
└── MediaGalleryEmptyState.tsx    - Empty state UI
```

### 3.2 MediaGalleryModal (Selection during post creation)

**Props**:
```typescript
interface Props {
  isOpen: boolean
  onClose: () => void
  onSelect: (items: MediaLibraryItem[]) => void
  allowMultiple?: boolean
  mediaType?: 'image' | 'video' | 'both'
}
```

**Features**:
- Search bar
- Filters (post type, date range)
- Grid of selectable items (checkbox on hover)
- Selected count badge
- Footer: "Cancel" + "Select (X)" buttons

### 3.3 MediaGallerySidebar (Under Publicering)

**Features**:
- Collapsible section in sidebar
- Thumbnail previews (3x2 grid of latest 6)
- "View all" button → opens full modal
- Quick upload button
- Storage quota indicator

### 3.4 MediaUploadMetadataForm

**Shown when**: User uploads new photo from device

**Fields**:
- Post Type (dropdown) - required
- Dish/Item Name (text) - optional
- Tags (multi-select or comma-separated) - optional
- Alt Text (textarea) - optional for accessibility

**Smart Defaults**:
- If uploading during Weekly Plan for menu post → auto-select "menu_item"
- If dish name in post content → pre-fill dish name
- Suggest tags based on existing content

---

## 🔗 PHASE 4: Integration with Post Creation (1-2 days)

### 4.1 Modify Upload Flow in CreateStep.tsx

**Current**: Upload from device only  
**New**: Upload from device OR select from gallery

```typescript
// Add source picker
const handleMediaSource = () => {
  showSourcePicker({
    options: [
      { id: 'device', label: 'Upload from device', icon: Upload },
      { id: 'gallery', label: 'Select from library', icon: Image }
    ],
    onSelect: (source) => {
      if (source === 'device') {
        fileInputRef.current?.click()
      } else {
        openMediaGalleryModal()
      }
    }
  })
}

// Modified upload handler
const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const files = event.target.files
  if (!files || files.length === 0) return

  // Show metadata form BEFORE uploading
  const metadata = await showMetadataForm(files[0])
  
  // Upload to gallery (creates persistent record)
  const mediaItem = await uploadToMediaLibrary(files[0], businessId, metadata)
  
  // Also add to current post
  addMediaToPost(mediaItem)
}

// Gallery selection handler
const handleGallerySelection = async (selected: MediaLibraryItem[]) => {
  // Convert to MediaItem format for current post
  const mediaItems = await Promise.all(
    selected.map(async (item) => {
      // Fetch blob from storage URL
      const blob = await fetch(getMediaUrl(item.storage_path)).then(r => r.blob())
      const file = new File([blob], item.filename, { type: item.mime_type })
      const url = URL.createObjectURL(blob)
      
      return {
        id: item.id,
        file,
        url,
        type: item.media_type,
        originalUrl: url,
        selectedVersionForPost: 'original'
      } as MediaItem
    })
  )
  
  setPhotoContent({
    uploadedMedia: [...(photoContent?.uploadedMedia || []), ...mediaItems]
  })
  
  // Record usage
  selected.forEach(item => recordMediaUsage(item.id))
  
  setShowGalleryModal(false)
}
```

### 4.2 Add to Sidebar Navigation

**File**: `src/components/layout/Sidebar.tsx`

```tsx
{/* PUBLICERING Section */}
<div className="space-y-1.5 mt-4 pt-4 border-t border-border-subtle">
  <div className="px-2 py-1.5 text-[11px] font-medium text-[#A09A91] uppercase tracking-[0.07em]">
    {t('navigation.sectionPublishing')}
  </div>
  <div className="space-y-1">
    {renderNavItem({ 
      id: 'social', 
      label: t('navigation.socialMedia'), 
      icon: ShareIcon, 
      path: '/dashboard/social-media' 
    })}
    
    {/* NEW: Media Library */}
    <MediaGallerySidebar />
  </div>
</div>
```

---

## 📊 PHASE 5: Storage Quota & Limits (1 day)

### 5.1 Quota by Tier

```typescript
// File: src/hooks/useStorageQuota.ts

export function useStorageQuota() {
  const { currentTier } = useTierStore()
  
  const limits = {
    free: 100 * 1024 * 1024,           // 100MB
    standardplus: 1024 * 1024 * 1024,  // 1GB
    premium: 5 * 1024 * 1024 * 1024    // 5GB
  }
  
  const quota = limits[currentTier]
  
  const checkQuota = async () => {
    const { data } = await supabase
      .from('media_library')
      .select('file_size')
      .eq('business_id', businessId)
      .is('deleted_at', null)
    
    const used = data?.reduce((sum, item) => sum + item.file_size, 0) || 0
    
    return {
      used,
      quota,
      remaining: quota - used,
      percentUsed: (used / quota) * 100
    }
  }
  
  return { checkQuota, quota }
}
```

### 5.2 Quota Display

**Location**: MediaGallerySidebar + MediaGalleryModal header

**Format**: "250 MB / 1 GB used (25%)"

**Colors**:
- Green: <50% used
- Yellow: 50-80% used
- Red: >80% used

**Behavior**:
- Block upload if quota exceeded
- Show upgrade prompt for free users

---

## ✨ PHASE 6: Polish & UX Refinements (1-2 days)

### 6.1 Bulk Operations

- Select multiple items (checkbox mode)
- Bulk delete
- Bulk tag editing
- Bulk post type assignment

### 6.2 Smart Suggestions

- "You've used similar photos before - reuse?" (based on AI analysis similarity)
- Auto-suggest tags based on image content analysis
- Suggest post type based on detected content
- "Frequently reused" badge on high usage_count items

### 6.3 Search Improvements

- Fuzzy search on dish_name
- Search by date range
- Filter by usage frequency (popular/unused)
- Sort by: upload date, usage count, file size

### 6.4 Accessibility

- Alt text editing interface
- Keyboard navigation (arrow keys, Enter to select)
- Screen reader announcements
- Focus management in modal

### 6.5 Performance

- Lazy load thumbnails (intersection observer)
- Virtual scrolling for 100+ items
- Thumbnail CDN optimization
- Prefetch on hover

---

## 📅 Implementation Timeline

| Phase | Tasks | Duration | Dependencies |
|-------|-------|----------|--------------|
| **Phase 1** | Database schema + storage bucket | 1 day | None |
| **Phase 2** | API functions & endpoints | 1-2 days | Phase 1 |
| **Phase 3** | Frontend components | 2-3 days | Phase 2 |
| **Phase 4** | Post creation integration | 1-2 days | Phase 3 |
| **Phase 5** | Quota management | 1 day | Phase 2, 3 |
| **Phase 6** | Polish & UX | 1-2 days | Phase 3, 4 |
| **Total** | | **7-11 days** | |

### Recommended Order
1. Start with Phase 1 (database foundation)
2. Build Phase 2 API in parallel with Phase 3 components (2 developers)
3. OR build sequentially: Phase 2 → Phase 3 → Phase 4
4. Add Phase 5 quota early to prevent storage abuse
5. Phase 6 features can be added incrementally post-launch

---

## ⚠️ Risk Mitigation

### Storage Costs
- **Risk**: Users upload large libraries, increase costs
- **Mitigation**: Enforce tier-based quotas, compress aggressively (already doing!)
- **Monitor**: Weekly storage usage reports by tier

### Performance
- **Risk**: Slow loading with 100+ items
- **Mitigation**: Implement pagination, thumbnails, virtual scrolling from day 1
- **Monitor**: Page load times, Time to Interactive

### Migration
- **Risk**: Existing users have no gallery content
- **Mitigation**: 
  - Start fresh (no forced migration)
  - Optional: Extract media from recent posts
  - Show onboarding banner: "New feature: Build your media library!"

### Backward Compatibility
- **Risk**: Breaking existing upload flow
- **Mitigation**: Keep device upload as default, gallery as secondary option
- **Fallback**: If gallery fails, fall back to direct upload

---

## 📈 Success Metrics

**Track after 1 month**:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Adoption Rate | >40% users with 5+ items | Query `media_library` table |
| Reuse Rate | >25% posts use gallery | Track `recordMediaUsage()` calls |
| Storage per User | <50MB avg (Free tier) | Average `file_size` by tier |
| Upload Time | <3s for gallery selection | Frontend performance monitoring |
| User Satisfaction | >4.0/5.0 rating | In-app survey |

**Red Flags** (require immediate action):
- Average storage >80MB on Free tier → tighten quotas
- Reuse rate <10% → improve discoverability
- Load time >5s → optimize thumbnails/pagination

---

## 🔄 Alternative Approaches Considered

### 1. Lazy Gallery (Save on Demand)
**Idea**: Only save to library when user clicks "Save to library"  
**Pros**: Less storage used, clearer user intent  
**Cons**: Users forget to save, friction in workflow  
**Decision**: ❌ Rejected - automatic is better UX

### 2. Temporary Cache (30-day retention)
**Idea**: Keep last 30 days accessible, auto-delete older  
**Pros**: Simpler, no long-term storage  
**Cons**: Not truly persistent, loses value proposition  
**Decision**: ❌ Rejected - defeats purpose

### 3. Post-Based Library
**Idea**: Group media by published posts, not standalone  
**Pros**: Context-aware, easier to find  
**Cons**: Harder to manage stock/unused media  
**Decision**: ❌ Rejected - too limiting

---

## 📝 Implementation Checklist

### Phase 1: Backend
- [ ] Create database migration file
- [ ] Run migration in Supabase dashboard
- [ ] Create `user-media` storage bucket
- [ ] Configure bucket policies (authenticated upload, public read)
- [ ] Test RLS policies with test user
- [ ] Test `increment_media_usage()` function

### Phase 2: API
- [ ] Create `src/api/mediaLibrary.ts`
- [ ] Implement `uploadToMediaLibrary()`
- [ ] Implement `getMediaLibrary()` with filters
- [ ] Implement `getMediaUrl()`
- [ ] Implement `updateMediaMetadata()`
- [ ] Implement `deleteMediaItem()`
- [ ] Implement `recordMediaUsage()`
- [ ] Add thumbnail generation helper
- [ ] Test all API functions

### Phase 3: Components
- [ ] Create component folder structure
- [ ] Build `MediaGalleryItem.tsx`
- [ ] Build `MediaGalleryGrid.tsx` with infinite scroll
- [ ] Build `MediaGalleryFilters.tsx`
- [ ] Build `MediaUploadMetadataForm.tsx`
- [ ] Build `MediaGalleryModal.tsx`
- [ ] Build `MediaGallerySidebar.tsx`
- [ ] Build `MediaGalleryEmptyState.tsx`
- [ ] Add translations (i18n keys)

### Phase 4: Integration
- [ ] Create `useMediaLibrary()` hook
- [ ] Modify `CreateStep.tsx` upload flow
- [ ] Add source picker UI (device vs gallery)
- [ ] Add metadata form on upload
- [ ] Handle gallery selection
- [ ] Convert MediaLibraryItem → MediaItem
- [ ] Add sidebar widget to `Sidebar.tsx`
- [ ] Test in Skriv Selv flow
- [ ] Test in AI Forslag flow
- [ ] Test in Weekly Plan flow

### Phase 5: Quota
- [ ] Create `useStorageQuota()` hook
- [ ] Calculate quotas by tier
- [ ] Add quota check before upload
- [ ] Display quota in sidebar
- [ ] Display quota in modal header
- [ ] Show upgrade prompt when quota exceeded
- [ ] Test quota enforcement

### Phase 6: Polish
- [ ] Add bulk selection mode
- [ ] Add bulk delete
- [ ] Add bulk tag editing
- [ ] Implement fuzzy search
- [ ] Add date range filter
- [ ] Add keyboard navigation
- [ ] Add alt text editing
- [ ] Optimize thumbnail loading
- [ ] Add virtual scrolling
- [ ] User testing & feedback

---

## 🎯 Post-Launch Enhancements (Future)

### Smart Features
- AI-powered duplicate detection
- Auto-tagging based on image analysis
- Seasonal content reminders ("Reuse your Christmas decorations photo!")
- Trending content suggestions

### Advanced Organization
- Folders/collections
- Favorites/starred items
- Custom views (grid/list)
- Timeline view

### Collaboration (Pro/Premium)
- Shared team libraries
- Approval workflows
- Usage analytics per team member

### Integrations
- Import from Instagram/Facebook
- Export to Google Drive
- Sync with DAM systems

---

## 📚 Related Documentation

- [Database Schema](/supabase/migrations/XXX_create_media_library.sql)
- [Image Compression](/src/api/image-processing.ts)
- [Storage Architecture](/docs/storage-architecture.md)
- [Component Guidelines](/docs/component-guidelines.md)

---

## ❓ FAQ

**Q: What happens if user deletes a photo that's used in scheduled posts?**  
A: Soft delete only (set `deleted_at`). Don't delete from storage. Scheduled posts keep their blob URLs. Add "restore" feature later.

**Q: Can users upload videos?**  
A: Yes! Videos supported. Max 30s for AI analysis. Need video cover frame selection.

**Q: What about AI-adjusted versions?**  
A: Store adjusted images in `/adjusted/` folder. Link via `adjusted_storage_path` (add column if needed).

**Q: How to handle multi-business accounts (future)?**  
A: Already using `business_id` in schema. Each business gets separate library.

**Q: What if user hits quota mid-upload?**  
A: Check quota BEFORE upload. If over, block with error message + upgrade CTA.

---

**Last Updated**: 2026-06-09  
**Owner**: Development Team  
**Status**: ✅ Ready for Implementation
