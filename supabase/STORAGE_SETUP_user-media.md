# Storage Bucket Setup: user-media

**Part of**: Media Gallery Implementation - Phase 1  
**Date**: 2026-06-10  
**Status**: Manual Setup Required

---

## Overview

The `user-media` bucket stores all user-uploaded photos and videos for the media gallery feature. This bucket is separate from `post-images` and provides structured storage with thumbnails.

---

## 1. Create Bucket

**Location**: Supabase Dashboard → Storage

### Steps:
1. Navigate to Storage section in Supabase dashboard
2. Click "Create new bucket"
3. Enter bucket name: `user-media`
4. Set as **Public bucket** (for CDN access)
5. File size limit: `10 MB`
6. Allowed MIME types: 
   - `image/jpeg`
   - `image/png`
   - `image/webp`
   - `video/mp4`
   - `video/webm`

---

## 2. Folder Structure

The bucket uses a structured folder hierarchy:

```
user-media/
├── {businessId}/
│   ├── originals/          # Compressed originals (max 2048px, 85% quality)
│   │   └── timestamp_random.jpg
│   ├── thumbnails/         # Small previews (150x150)
│   │   └── thumb_timestamp_random.jpg
│   ├── adjusted/           # AI-enhanced versions (future)
│   │   └── adjusted_timestamp_random.jpg
│   └── video-covers/       # Video cover frames
│       └── cover_timestamp_random.jpg
```

### Naming Convention

**Originals**: `{timestamp}_{random}.{ext}`
- Example: `1717948800000_a3f9k2.jpg`
- Timestamp: Unix milliseconds
- Random: 6-char alphanumeric
- Extension: `jpg` (images compressed to JPEG), `mp4`/`webm` (videos)

**Thumbnails**: `thumb_{timestamp}_{random}.{ext}`
- Example: `thumb_1717948800000_a3f9k2.jpg`
- Always JPEG format
- 150x150 pixels (maintains aspect ratio, fits within box)

---

## 3. Storage Policies

**Location**: Supabase Dashboard → Storage → user-media → Policies

### Policy 1: Authenticated Upload
```sql
-- Allow authenticated users to upload to their own business folder
CREATE POLICY "Users can upload to own business folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-media' 
  AND (storage.foldername(name))[1] = auth.jwt() ->> 'user_id'::text
);
```

### Policy 2: Public Read Access
```sql
-- Allow public read access (for CDN serving)
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-media');
```

### Policy 3: Authenticated Update (Metadata)
```sql
-- Allow users to update their own files
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-media'
  AND (storage.foldername(name))[1] = auth.jwt() ->> 'user_id'::text
)
WITH CHECK (
  bucket_id = 'user-media'
  AND (storage.foldername(name))[1] = auth.jwt() ->> 'user_id'::text
);
```

### Policy 4: Authenticated Delete
```sql
-- Allow users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-media'
  AND (storage.foldername(name))[1] = auth.jwt() ->> 'user_id'::text
);
```

---

## 4. Storage Quotas by Tier

Enforced at application level (not Supabase bucket level):

| Tier | Storage Quota | Max File Size |
|------|---------------|---------------|
| **Free** | 100 MB | 5 MB |
| **Standard Plus** | 1 GB | 10 MB |
| **Premium** | 5 GB | 10 MB |

**Implementation**: Check quota before upload in `uploadToMediaLibrary()` function.

---

## 5. Compression Strategy

All images are compressed before upload:

### Images
- **Max dimension**: 2048px (longest side)
- **Quality**: 85% JPEG
- **Format**: Converted to JPEG (even if uploaded as PNG/WebP)
- **Function**: `compressImageFile()` in `src/api/image-processing.ts`

### Thumbnails
- **Size**: 150x150px (maintains aspect ratio, fits within box)
- **Quality**: 80% JPEG
- **Generated**: On upload via `generateThumbnail()` helper

### Videos
- **No compression**: Uploaded as-is (user responsibility to keep under 10MB)
- **Cover extraction**: Generate 3 candidate frames for user selection

**Result**: Typical 4MB iPhone photo → ~200-400KB after compression ✅

---

## 6. CDN & Performance

### Public URL Format
```
https://{project}.supabase.co/storage/v1/object/public/user-media/{path}
```

### Optimization
- **Cache-Control**: `31536000` (1 year) - set during upload
- **CDN**: Supabase automatically serves via CDN
- **Lazy Loading**: Thumbnails loaded on-demand in gallery

### Best Practices
- Always use thumbnail URLs in gallery grid
- Load full image only on click/preview
- Use `loading="lazy"` attribute on `<img>` tags

---

## 7. Manual Setup Checklist

After running the migration, complete these steps in Supabase Dashboard:

- [ ] Create `user-media` bucket (public, 10MB limit)
- [ ] Add storage policies (4 policies above)
- [ ] Test upload with authenticated user
- [ ] Verify public read access (open URL in browser)
- [ ] Confirm folder structure creates correctly
- [ ] Test quota enforcement (application level)

---

## 8. Testing the Setup

### Test Upload (cURL)
```bash
# Get auth token from Supabase Auth
TOKEN="your_user_token"

# Upload test image
curl -X POST \
  "https://{project}.supabase.co/storage/v1/object/user-media/test-business/originals/test.jpg" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: image/jpeg" \
  --data-binary "@test-image.jpg"
```

### Verify Public Access
```bash
# Should return image (no auth required)
curl "https://{project}.supabase.co/storage/v1/object/public/user-media/test-business/originals/test.jpg"
```

### Check in Dashboard
1. Go to Storage → user-media
2. Verify file appears in correct folder
3. Click file → verify public URL works
4. Check file size is compressed

---

## 9. Migration Path

**For existing users**: Gallery starts empty (no migration needed)

**Optional**: Extract media from recent published posts
- Query `published_posts` table
- Parse `media_urls` array
- Download from `post-media` bucket
- Re-upload to `user-media` with metadata
- **Decision**: Skip for MVP - let users build library organically

---

## 10. Monitoring & Maintenance

### Storage Usage Metrics
```sql
-- Total storage per business
SELECT 
  business_id,
  COUNT(*) as file_count,
  SUM(file_size) / (1024 * 1024) as storage_mb,
  SUM(file_size) / (1024 * 1024 * 1024) as storage_gb
FROM media_library
WHERE deleted_at IS NULL
GROUP BY business_id
ORDER BY storage_mb DESC;
```

### Soft-Deleted Items
```sql
-- Files marked deleted but not purged
SELECT COUNT(*), SUM(file_size) / (1024 * 1024) as wasted_mb
FROM media_library
WHERE deleted_at IS NOT NULL;
```

### Cleanup (Optional)
```sql
-- Hard delete files older than 30 days
DELETE FROM media_library
WHERE deleted_at < NOW() - INTERVAL '30 days';

-- Also delete from storage (manual or scheduled function)
```

---

## 11. Next Steps

After completing this setup:

1. ✅ Run migration: `20260610000001_create_media_library.sql`
2. ✅ Create bucket and policies in dashboard
3. ⏭️ Proceed to **Phase 2**: Build API functions in `src/api/mediaLibrary.ts`

---

**Last Updated**: 2026-06-10  
**Owner**: Development Team  
**Related**: [Media Gallery Implementation Plan](_MEDIA_GALLERY_IMPLEMENTATION_PLAN.md)
