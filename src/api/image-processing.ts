import { supabase } from '../lib/supabase'

interface ProcessImageRequest {
  imageUrl: string
  userPlan: 'free' | 'standardPlus' | 'premium'
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
  userPlan: 'free' | 'standardPlus' | 'premium' = 'free'
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

export async function uploadImageToStorage(file: File, userId: string): Promise<string> {
  try {
    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/originals/${Date.now()}.${fileExt}`

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('post-images')
      .upload(fileName, file, {
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
