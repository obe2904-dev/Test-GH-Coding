/**
 * Media Library API
 * 
 * Manages persistent user-uploaded photos and videos with metadata
 * for reuse across posts. Includes compression, thumbnail generation,
 * quota enforcement, and soft delete support.
 * 
 * Part of: Media Gallery Feature - Phase 2: Backend API
 */

import { supabase } from '../lib/supabase'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type MediaType = 'image' | 'video'

export type PostType = 
  | 'food'
  | 'drinks' 
  | 'atmosphere' 
  | 'other'

export interface MediaItem {
  id: string
  user_id: string
  business_id: string
  storage_path: string
  storage_bucket: string
  thumbnail_path: string | null
  filename: string
  original_filename: string
  file_size: number
  mime_type: string
  media_type: MediaType
  // Image properties
  width: number | null
  height: number | null
  aspect_ratio: number | null
  // Video properties
  duration: number | null
  video_thumbnail_path: string | null
  // Categorization
  post_type: PostType | null
  dish_name: string | null
  menu_item_id: string | null // FK to menu_items_normalized
  resolved_category: PostType | null // Derived from menu_item media_category or post_type
  tags: string[]
  alt_text: string | null
  // Usage tracking
  upload_date: string
  last_used_date: string | null
  usage_count: number
  // Timestamps
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface UploadMediaOptions {
  file: File
  businessId: string
  postType?: PostType
  dishName?: string
  menuItemId?: string // Link to menu_items_normalized for category derivation
  tags?: string[]
  altText?: string
}

export interface MediaLibraryFilters {
  mediaType?: MediaType
  postType?: PostType
  tags?: string[]
  searchQuery?: string // Search in dish_name, alt_text, tags
}

export interface MediaLibrarySortOptions {
  sortBy?: 'upload_date' | 'usage_count' | 'file_size'
  sortOrder?: 'asc' | 'desc'
}

export interface UpdateMediaMetadata {
  postType?: PostType | null
  dishName?: string | null
  menuItemId?: string | null // Link to menu_items_normalized
  tags?: string[]
  altText?: string | null
}

export interface StorageQuota {
  tier: 'free' | 'standardplus' | 'premium'
  usedBytes: number
  limitBytes: number
  usedMB: number
  limitMB: number
  percentUsed: number
  remaining: number
  isNearLimit: boolean // > 90%
  isOverLimit: boolean
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_BUCKET = 'user-media'

// Storage quotas by tier (in bytes)
const TIER_STORAGE_QUOTAS = {
  free: 100 * 1024 * 1024, // 100 MB
  standardplus: 1 * 1024 * 1024 * 1024, // 1 GB
  premium: 5 * 1024 * 1024 * 1024, // 5 GB
}

// Max file sizes by tier (in bytes)
const TIER_FILE_SIZE_LIMITS = {
  free: 5 * 1024 * 1024, // 5 MB
  standardplus: 10 * 1024 * 1024, // 10 MB
  premium: 10 * 1024 * 1024, // 10 MB
}

// Image compression settings
const IMAGE_COMPRESSION = {
  maxDimension: 2048,
  quality: 0.85,
  thumbnailSize: 400, // Increased from 150 for better gallery display quality
  thumbnailQuality: 0.8,
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get user's tier from profiles.plan
 */
async function getUserBusinessTier(userId: string): Promise<'free' | 'standardplus' | 'premium'> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle()

  const profileTier = profile?.plan?.toLowerCase()
  if (!profileError && (profileTier === 'standardplus' || profileTier === 'pro' || profileTier === 'premium')) {
    return profileTier === 'standardplus' ? 'standardplus' : 'premium'
  }

  if (profileError) {
    console.warn('Could not fetch profile tier, defaulting to free:', profileError)
  }
  return 'free'
}

/**
 * Compress an image file to JPEG (reuses existing compression logic)
 */
function compressImageFile(
  file: File, 
  maxDimension = IMAGE_COMPRESSION.maxDimension, 
  quality = IMAGE_COMPRESSION.quality
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => resolve(blob
          ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
          : file),
        'image/jpeg',
        quality
      )
    }
    
    img.onerror = () => { 
      URL.revokeObjectURL(objectUrl)
      resolve(file) 
    }
    
    img.src = objectUrl
  })
}

/**
 * Generate a thumbnail (150x150) for gallery display
 */
function generateThumbnail(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      
      const size = IMAGE_COMPRESSION.thumbnailSize
      const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight)
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      
      canvas.toBlob(
        (blob) => resolve(blob
          ? new File([blob], `thumb_${file.name}`.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
          : file),
        'image/jpeg',
        IMAGE_COMPRESSION.thumbnailQuality
      )
    }
    
    img.onerror = () => { 
      URL.revokeObjectURL(objectUrl)
      resolve(file) 
    }
    
    img.src = objectUrl
  })
}

/**
 * Get image dimensions from file
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    
    img.onerror = () => { 
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }
    
    img.src = objectUrl
  })
}

/**
 * Generate unique filename with timestamp and random string
 */
function generateFilename(originalName: string, prefix = ''): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg'
  return `${prefix}${timestamp}_${random}.${ext}`
}

// ============================================================================
// PUBLIC API FUNCTIONS
// ============================================================================

/**
 * Upload a photo or video to the media library
 * 
 * Process:
 * 1. Check user's tier and quota
 * 2. Validate file size against tier limit
 * 3. Compress image (if image)
 * 4. Generate thumbnail (if image)
 * 5. Upload to Supabase Storage
 * 6. Create database record
 * 
 * @throws Error if quota exceeded or upload fails
 */
export async function uploadToMediaLibrary({
  file,
  businessId,
  postType,
  dishName,
  menuItemId,
  tags = [],
  altText,
}: UploadMediaOptions): Promise<MediaItem> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  // Check tier and quota
  const tier = await getUserBusinessTier(user.id)
  const quota = await getStorageQuota(businessId)
  
  // Check file size against tier limit
  const maxFileSize = TIER_FILE_SIZE_LIMITS[tier]
  if (file.size > maxFileSize) {
    const maxMB = maxFileSize / (1024 * 1024)
    throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds ${tier} tier limit of ${maxMB}MB`)
  }

  // Check storage quota (before compression)
  if (quota.isOverLimit) {
    throw new Error(`Storage quota exceeded. Using ${quota.usedMB}MB of ${quota.limitMB}MB.`)
  }

  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')
  const mediaType: MediaType = isImage ? 'image' : isVideo ? 'video' : 'image'

  let uploadFile = file
  let thumbnailFile: File | null = null
  let dimensions: { width: number; height: number } | null = null

  // Process images: compress + generate thumbnail
  if (isImage) {
    try {
      // Compress original
      uploadFile = await compressImageFile(file)
      
      // Generate thumbnail
      thumbnailFile = await generateThumbnail(uploadFile)
      
      // Get dimensions
      dimensions = await getImageDimensions(uploadFile)
    } catch (error) {
      console.error('Error processing image:', error)
      throw new Error('Failed to process image')
    }
  }

  // Check quota again after compression (final check)
  const finalSize = uploadFile.size + (thumbnailFile?.size || 0)
  if (quota.usedBytes + finalSize > quota.limitBytes) {
    const neededMB = ((quota.usedBytes + finalSize) / (1024 * 1024)).toFixed(1)
    throw new Error(`Upload would exceed storage quota (need ${neededMB}MB, limit ${quota.limitMB}MB)`)
  }

  // Generate storage paths
  const originalPath = `${businessId}/originals/${generateFilename(file.name)}`
  const thumbnailPath = thumbnailFile 
    ? `${businessId}/thumbnails/${generateFilename(file.name, 'thumb_')}`
    : null

  try {
    // Upload original to storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(originalPath, uploadFile, {
        contentType: uploadFile.type,
        cacheControl: '31536000', // 1 year
        upsert: false,
      })

    if (uploadError) {
      throw uploadError
    }

    // Upload thumbnail to storage (if exists)
    if (thumbnailFile && thumbnailPath) {
      const { error: thumbError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(thumbnailPath, thumbnailFile, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
          upsert: false,
        })

      if (thumbError) {
        console.warn('Thumbnail upload failed:', thumbError)
        // Continue anyway - thumbnail is optional
      }
    }

    // Create database record
    const { data: mediaItem, error: dbError } = await supabase
      .from('media_library' as any)
      .insert({
        user_id: user.id,
        business_id: businessId,
        storage_path: originalPath,
        storage_bucket: STORAGE_BUCKET,
        thumbnail_path: thumbnailPath,
        filename: uploadFile.name,
        original_filename: file.name,
        file_size: uploadFile.size,
        mime_type: uploadFile.type,
        media_type: mediaType,
        width: dimensions?.width || null,
        height: dimensions?.height || null,
        aspect_ratio: dimensions 
          ? parseFloat((dimensions.width / dimensions.height).toFixed(3))
          : null,
        duration: null, // TODO: Extract video duration in future
        video_thumbnail_path: null,
        post_type: postType || null,
        dish_name: dishName || null,
        menu_item_id: menuItemId || null,
        tags: tags,
        alt_text: altText || null,
        upload_date: new Date().toISOString(),
        usage_count: 0,
      })
      .select()
      .single()

    if (dbError) {
      // Cleanup: Delete uploaded files if database insert fails
      await supabase.storage.from(STORAGE_BUCKET).remove([originalPath])
      if (thumbnailPath) {
        await supabase.storage.from(STORAGE_BUCKET).remove([thumbnailPath])
      }
      throw dbError
    }

    return mediaItem as any as MediaItem

  } catch (error) {
    console.error('Upload to media library failed:', error)
    throw error
  }
}

/**
 * Get all media from user's library with optional filtering and sorting
 */
export async function getMediaLibrary(
  businessId: string,
  filters?: MediaLibraryFilters,
  sortOptions?: MediaLibrarySortOptions
): Promise<MediaItem[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  let query = supabase
    .from('media_library_with_category' as any)
    .select('*')
    .eq('business_id', businessId)

  // Apply filters
  if (filters?.mediaType) {
    query = query.eq('media_type', filters.mediaType)
  }
  
  if (filters?.postType) {
    // Filter by resolved_category which accounts for menu item categorization
    query = query.eq('resolved_category', filters.postType)
  }
  
  if (filters?.tags && filters.tags.length > 0) {
    query = query.contains('tags', filters.tags)
  }

  if (filters?.searchQuery) {
    // Search in dish_name, alt_text, and tags
    query = query.or(`dish_name.ilike.%${filters.searchQuery}%,alt_text.ilike.%${filters.searchQuery}%`)
  }

  // Apply sorting
  const sortBy = sortOptions?.sortBy || 'upload_date'
  const sortOrder = sortOptions?.sortOrder || 'desc'
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching media library:', error)
    throw error
  }

  return data as any as MediaItem[]
}

/**
 * Get a single media item by ID
 */
export async function getMediaItem(mediaId: string): Promise<MediaItem | null> {
  const { data, error } = await supabase
    .from('media_library_with_category' as any)
    .select('*')
    .eq('id', mediaId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching media item:', error)
    throw error
  }

  return data as any as MediaItem | null
}

/**
 * Get public URL for a media file
 */
export function getMediaUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath)

  return data.publicUrl
}

/**
 * Get thumbnail URL (or fallback to original if no thumbnail)
 */
export function getMediaThumbnailUrl(media: MediaItem): string {
  if (media.thumbnail_path) {
    return getMediaUrl(media.thumbnail_path)
  }
  return getMediaUrl(media.storage_path)
}

/**
 * Update media item metadata (tags, post_type, dish_name, alt_text)
 */
export async function updateMediaMetadata(
  mediaId: string,
  metadata: UpdateMediaMetadata
): Promise<MediaItem> {
  // Map camelCase to snake_case for database
  const dbUpdate: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }
  
  if (metadata.postType !== undefined) dbUpdate.post_type = metadata.postType
  if (metadata.dishName !== undefined) dbUpdate.dish_name = metadata.dishName
  if (metadata.menuItemId !== undefined) dbUpdate.menu_item_id = metadata.menuItemId
  if (metadata.tags !== undefined) dbUpdate.tags = metadata.tags
  if (metadata.altText !== undefined) dbUpdate.alt_text = metadata.altText

  const { data, error } = await supabase
    .from('media_library' as any)
    .update(dbUpdate)
    .eq('id', mediaId)
    .select()
    .single()

  if (error) {
    console.error('Error updating media metadata:', error)
    throw error
  }

  return data as any as MediaItem
}

/**
 * Soft delete a media item (sets deleted_at timestamp)
 * Preserves media referenced in scheduled posts
 */
export async function deleteMediaItem(mediaId: string): Promise<void> {
  const { error } = await supabase
    .from('media_library' as any)
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', mediaId)

  if (error) {
    console.error('Error deleting media item:', error)
    throw error
  }
}

/**
 * Permanently delete a media item and its storage files
 * ⚠️ Use with caution - this cannot be undone
 */
export async function permanentlyDeleteMediaItem(mediaId: string): Promise<void> {
  // Get media item first
  const media = await getMediaItem(mediaId)
  if (!media) {
    throw new Error('Media item not found')
  }

  // Delete from storage
  const pathsToDelete = [media.storage_path]
  if (media.thumbnail_path) {
    pathsToDelete.push(media.thumbnail_path)
  }

  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove(pathsToDelete)

  if (storageError) {
    console.error('Error deleting from storage:', storageError)
    // Continue to delete DB record anyway
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from('media_library' as any)
    .delete()
    .eq('id', mediaId)

  if (dbError) {
    console.error('Error deleting from database:', dbError)
    throw dbError
  }
}

/**
 * Record media usage when user selects media from gallery
 * Increments usage_count and updates last_used_date
 */
export async function recordMediaUsage(mediaId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_media_usage' as any, {
    media_id: mediaId,
  })

  if (error) {
    console.error('Error recording media usage:', error)
    // Don't throw - usage tracking is non-critical
  }
}

/**
 * Get current storage quota for a business
 */
export async function getStorageQuota(businessId: string): Promise<StorageQuota> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  // Get user's tier
  const tier = await getUserBusinessTier(user.id)
  const limitBytes = TIER_STORAGE_QUOTAS[tier]

  // Calculate total storage used
  const { data, error } = await supabase
    .from('media_library' as any)
    .select('file_size')
    .eq('business_id', businessId)
    .is('deleted_at', null)

  if (error) {
    console.error('Error fetching storage quota:', error)
    throw error
  }

  const usedBytes = (data as any[]).reduce((total, item) => total + (item.file_size || 0), 0)
  const usedMB = parseFloat((usedBytes / (1024 * 1024)).toFixed(2))
  const limitMB = parseFloat((limitBytes / (1024 * 1024)).toFixed(2))
  const percentUsed = limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0
  const remaining = Math.max(0, limitBytes - usedBytes)

  return {
    tier,
    usedBytes,
    limitBytes,
    usedMB,
    limitMB,
    percentUsed,
    remaining,
    isNearLimit: percentUsed >= 90,
    isOverLimit: usedBytes >= limitBytes,
  }
}

/**
 * Get storage usage stats for analytics
 */
export async function getStorageStats(businessId: string) {
  const { data, error } = await supabase
    .from('media_library' as any)
    .select('media_type, file_size, post_type')
    .eq('business_id', businessId)
    .is('deleted_at', null)

  if (error) {
    console.error('Error fetching storage stats:', error)
    throw error
  }

  const items = data as any[]
  const stats = {
    totalFiles: items.length,
    totalImages: items.filter(item => item.media_type === 'image').length,
    totalVideos: items.filter(item => item.media_type === 'video').length,
    totalSize: items.reduce((sum, item) => sum + (item.file_size || 0), 0),
    byPostType: {} as Record<string, number>,
  }

  // Count by post_type
  items.forEach(item => {
    const type = item.post_type || 'uncategorized'
    stats.byPostType[type] = (stats.byPostType[type] || 0) + 1
  })

  return stats
}

/**
 * Regenerate thumbnail for a media item
 * Useful when thumbnail quality settings change or thumbnails are missing
 */
export async function regenerateThumbnail(mediaId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  // Get media item
  const { data: mediaItem, error: fetchError } = await supabase
    .from('media_library' as any)
    .select('*')
    .eq('id', mediaId)
    .single()

  if (fetchError || !mediaItem) {
    throw new Error('Media item not found')
  }

  // Only process images
  if ((mediaItem as any).media_type !== 'image') {
    throw new Error('Can only regenerate thumbnails for images')
  }

  try {
    // Download original image from storage
    const item = mediaItem as any
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(item.storage_path)

    if (downloadError || !fileData) {
      throw new Error('Failed to download original image')
    }

    // Convert blob to File
    const file = new File([fileData], item.filename, { type: item.mime_type })

    // Generate new thumbnail with current settings (400px)
    const thumbnailFile = await generateThumbnail(file)

    // Generate new thumbnail path
    const newThumbnailPath = `${item.business_id}/thumbnails/${generateFilename(item.filename, 'thumb_')}`

    // Upload new thumbnail
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(newThumbnailPath, thumbnailFile, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: false,
      })

    if (uploadError) {
      throw uploadError
    }

    // Delete old thumbnail if it exists
    if (item.thumbnail_path) {
      await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([item.thumbnail_path])
    }

    // Update database with new thumbnail path
    const { error: updateError } = await supabase
      .from('media_library' as any)
      .update({ thumbnail_path: newThumbnailPath })
      .eq('id', mediaId)

    if (updateError) {
      throw updateError
    }

    console.log(`✅ Regenerated thumbnail for ${item.filename}`)

  } catch (error) {
    console.error('Failed to regenerate thumbnail:', error)
    throw error
  }
}

/**
 * Regenerate thumbnails for all images in a business's media library
 * Progress callback reports completion percentage
 */
export async function regenerateAllThumbnails(
  businessId: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ succeeded: number; failed: number }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  // Get all images for this business
  const { data: images, error } = await supabase
    .from('media_library' as any)
    .select('id, filename')
    .eq('business_id', businessId)
    .eq('media_type', 'image')
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  if (!images || images.length === 0) {
    return { succeeded: 0, failed: 0 }
  }

  const items = images as any[]
  let succeeded = 0
  let failed = 0

  // Process each image
  for (let i = 0; i < items.length; i++) {
    try {
      await regenerateThumbnail(items[i].id)
      succeeded++
    } catch (error) {
      console.error(`Failed to regenerate thumbnail for ${items[i].filename}:`, error)
      failed++
    }

    // Report progress
    if (onProgress) {
      onProgress(i + 1, images.length)
    }
  }

  console.log(`✅ Thumbnail regeneration complete: ${succeeded} succeeded, ${failed} failed`)
  return { succeeded, failed }
}

