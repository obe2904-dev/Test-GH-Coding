# Image Processing System

## Overview

The image processing system handles uploading user photos and creating platform-specific variants optimized for Facebook and Instagram.

## How It Works

### 1. User Uploads Photo (Frontend)

- User selects image in Design step
- Image is uploaded to Supabase Storage (`post-images` bucket)
- Stored in user's folder: `{user_id}/originals/{timestamp}.{ext}`

### 2. Image Processing (Edge Function)

The `process-image` edge function creates platform-specific variants:

#### Free Plan
- **Basic resizing** to fit platform requirements
- No AI enhancement
- Variants created:
  - Facebook: 1200x630 (landscape, fit: cover)
  - Instagram Square: 1080x1080 (fit: cover)
  - Instagram Portrait: 1080x1350 (4:5 ratio, fit: cover)

#### StandardPlus/Premium Plans
- **AI enhancement** (future implementation)
  - Brightness/sharpness optimization
  - Smart cropping with face detection
  - Color grading
- Same variant dimensions as Free

### 3. Storage

All variants are saved to Supabase Storage:
- Path: `{user_id}/posts/{platform}-{size}-{timestamp}.jpg`
- Public URLs returned for each variant
- Original image preserved in `originals/` folder

### 4. Post Publishing

When publishing, the appropriate variant is used for each platform:
- Facebook posts use `facebook-1200x630` variant
- Instagram posts use `instagram-1080x1080` or `instagram-1080x1350` variants

## Files

### Edge Function
- `supabase/functions/process-image/index.ts` - Image processing logic

### Frontend API
- `src/api/image-processing.ts` - Upload and process functions
  - `uploadImageToStorage()` - Upload original to Supabase
  - `processImage()` - Trigger variant creation

### Components
- `src/components/post-creation/CreateStep.tsx` - Handles upload
- `src/components/post-creation/design/PhotoUploadManager.tsx` - UI

### Types
- `src/stores/postCreationStore.ts`
  - `ImageVariant` - Platform variant metadata
  - `MediaItem.platformVariants` - Array of variants

## Storage Structure

```
post-images/
├── {user_id}/
│   ├── originals/
│   │   └── 1234567890.jpg (original upload)
│   └── posts/
│       ├── facebook-1200x630-1234567890.jpg
│       ├── instagram-1080x1080-1234567890.jpg
│       └── instagram-1080x1350-1234567890.jpg
```

## Database Migration

Run `005_storage_post_images.sql` to create the storage bucket and policies.

## Future Enhancements

### For Paid Plans
- [ ] Implement Sharp or similar for actual resizing in edge function
- [ ] Add AI enhancement (brightness, contrast, sharpness)
- [ ] Smart cropping with face/object detection
- [ ] Remove background option
- [ ] Color grading presets

### General
- [ ] Compress images to reduce storage/bandwidth
- [ ] Support video processing
- [ ] Add watermark option
- [ ] Batch processing for multiple images

## Testing

1. Upload image in Design step
2. Check browser console for logs:
   - "📤 Uploading image to storage..."
   - "✅ Image uploaded: {url}"
   - "🔄 Processing image variants..."
   - "✅ Image processing complete: X variants"
3. Check Supabase Storage for files
4. Verify variants are attached to MediaItem in state

## Notes

- Current implementation stores originals but doesn't resize yet (needs Sharp or similar library compatible with Deno)
- Free plan creates same files as paid (no AI yet)
- All plans save to Supabase Storage
- Edge function handles authentication and user folder isolation
