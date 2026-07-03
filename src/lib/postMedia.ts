/**
 * postMedia.ts — shared Supabase Storage helpers for post photos.
 *
 * Used by both:
 *   • usePublishedPosts  — upload at publish/schedule time
 *   • usePostDrafts      — upload early (at draft-save time) so photos survive page reload
 */

import { supabase } from './supabase'

const BUCKET = 'post-media'

/**
 * Resizes an image File to fit within maxPx × maxPx (preserving aspect ratio)
 * and re-encodes as JPEG at the given quality (0–1).
 */
export function resizeImageForSocialMedia(file: File, maxPx = 1080, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      let targetW = width
      let targetH = height
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          targetW = maxPx
          targetH = Math.round((height / width) * maxPx)
        } else {
          targetH = maxPx
          targetW = Math.round((width / height) * maxPx)
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return }
      ctx.drawImage(img, 0, 0, targetW, targetH)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null')),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image failed to load')) }
    img.src = url
  })
}

/**
 * Resizes (if image) then uploads a File to the `post-media` bucket.
 * Returns the public URL on success, or null on failure.
 */
export async function uploadPostPhoto(businessId: string, file: File): Promise<string | null> {
  let uploadBlob: Blob = file
  if (file.type.startsWith('image/')) {
    try {
      uploadBlob = await resizeImageForSocialMedia(file)
    } catch (err) {
      console.warn('[uploadPostPhoto] Resize failed, uploading original:', err)
    }
  }
  const ext = file.type.startsWith('image/') ? 'jpg' : (file.name.split('.').pop() ?? 'bin')
  const path = `${businessId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, uploadBlob, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type.startsWith('image/') ? 'image/jpeg' : file.type,
  })
  if (error) {
    console.error('[uploadPostPhoto] Storage upload failed:', error.message)
    return null
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl ?? null
}
