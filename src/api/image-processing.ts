import { supabase } from '../lib/supabase'

interface ProcessImageRequest {
  imageUrl: string
  userPlan: 'free' | 'standardplus' | 'premium'
  platforms: string[]
}

interface ImageVariant {
  platform: string
  size: string
  width: number
  height: number
  url: string
  filename: string
}

interface ProcessImageResponse {
  success: boolean
  variants: ImageVariant[]
  originalUrl: string
}

export async function processImage(
  imageUrl: string,
  platforms: string[],
  userPlan: 'free' | 'standardplus' | 'premium' = 'free'
): Promise<ProcessImageResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-image`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          imageUrl,
          userPlan,
          platforms
        } as ProcessImageRequest)
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to process image')
    }

    const result: ProcessImageResponse = await response.json()
    return result

  } catch (error) {
    console.error('Error processing image:', error)
    throw error
  }
}

/**
 * Upload an AI-adjusted image (data URL or blob URL) to Supabase Storage.
 * Returns a persistent public URL so the adjusted image survives page refresh and
 * is stored as a proper CDN URL rather than a ~1 MB base64 string in the DB.
 */
export async function uploadAdjustedImageToStorage(
  dataUrl: string,
  userId: string
): Promise<string> {
  // Convert data URL → Blob
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const fileName = `${userId}/adjusted/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('post-images')
    .upload(fileName, blob, {
      contentType: blob.type,
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('post-images')
    .getPublicUrl(fileName)

  return publicUrl
}

/**
 * Compress an image file to JPEG (max 2048px, 0.85 quality) before upload.
 * Skips compression if the file is already within safe limits.
 */
function compressImageFile(file: File, maxDimension = 2048, quality = 0.85): Promise<File> {
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
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file) }
    img.src = objectUrl
  })
}

export async function uploadImageToStorage(file: File, userId: string): Promise<string> {
  try {
    // Compress before upload to ensure image stays within the 4MB edge function limit
    const compressed = await compressImageFile(file)
    const fileName = `${userId}/originals/${Date.now()}.jpg`

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('post-images')
      .upload(fileName, compressed, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw error
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('post-images')
      .getPublicUrl(fileName)

    return publicUrl

  } catch (error) {
    console.error('Error uploading image:', error)
    throw error
  }
}

/**
 * Upload a single video cover frame JPEG blob to Supabase Storage.
 * Returns a public URL. Used by useVideoCover to persist extracted thumbnails.
 */
export async function uploadVideoCoverFrame(
  blob: Blob,
  userId: string,
  index: number
): Promise<string> {
  const fileName = `${userId}/covers/${Date.now()}-${index}.jpg`

  const { error } = await supabase.storage
    .from('post-images')
    .upload(fileName, blob, {
      contentType: 'image/jpeg',
      cacheControl: '31536000', // 1 year — cover frames are immutable once uploaded
      upsert: false,
    })

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('post-images')
    .getPublicUrl(fileName)

  return publicUrl
}
