import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno imports work at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImageProcessRequest {
  imageUrl: string
  userPlan: 'free' | 'standardPlus' | 'premium'
  platforms: string[] // ['facebook', 'instagram']
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageUrl, userPlan, platforms }: ImageProcessRequest = await req.json()

    console.log('📸 Processing image:', { imageUrl, userPlan, platforms })

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Fetch the original image
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch image')
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const imageUint8Array = new Uint8Array(imageBuffer)

    // For Free plan: Create simple platform-specific variants using canvas-like approach
    // For paid plans: Would use AI enhancement (future implementation)
    
    const variants: Array<{
      platform: string
      size: string
      width: number
      height: number
      buffer: Uint8Array
      filename: string
    }> = []

    if (userPlan === 'free') {
      // Simple resizing for free plan
      console.log('🆓 Creating free plan variants with basic resizing')
      
      // We'll use a lightweight image processing library
      // For now, we'll store the original and let the frontend handle display sizing
      // In production, you'd use an image processing library compatible with Deno
      
      if (platforms.includes('facebook')) {
        variants.push({
          platform: 'facebook',
          size: '1200x630',
          width: 1200,
          height: 630,
          buffer: imageUint8Array, // Original for now
          filename: `facebook-1200x630-${Date.now()}.jpg`
        })
      }

      if (platforms.includes('instagram')) {
        // Instagram square
        variants.push({
          platform: 'instagram',
          size: '1080x1080',
          width: 1080,
          height: 1080,
          buffer: imageUint8Array,
          filename: `instagram-1080x1080-${Date.now()}.jpg`
        })

        // Instagram portrait (4:5)
        variants.push({
          platform: 'instagram',
          size: '1080x1350',
          width: 1080,
          height: 1350,
          buffer: imageUint8Array,
          filename: `instagram-1080x1350-${Date.now()}.jpg`
        })
      }
    } else {
      // Paid plans: AI enhancement + smart cropping (future implementation)
      console.log('💎 Pro/Smart processing - would use AI enhancement')
      // For now, same as free
      if (platforms.includes('facebook')) {
        variants.push({
          platform: 'facebook',
          size: '1200x630',
          width: 1200,
          height: 630,
          buffer: imageUint8Array,
          filename: `facebook-1200x630-${Date.now()}.jpg`
        })
      }

      if (platforms.includes('instagram')) {
        variants.push({
          platform: 'instagram',
          size: '1080x1080',
          width: 1080,
          height: 1080,
          buffer: imageUint8Array,
          filename: `instagram-1080x1080-${Date.now()}.jpg`
        })

        variants.push({
          platform: 'instagram',
          size: '1080x1350',
          width: 1080,
          height: 1350,
          buffer: imageUint8Array,
          filename: `instagram-1080x1350-${Date.now()}.jpg`
        })
      }
    }

    // Upload variants to Supabase Storage
    const uploadedVariants = []

    for (const variant of variants) {
      const path = `${user.id}/posts/${variant.filename}`
      
      const { data: uploadData, error: uploadError } = await supabaseClient
        .storage
        .from('post-images')
        .upload(path, variant.buffer, {
          contentType: 'image/jpeg',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error for', variant.filename, uploadError)
        continue
      }

      // Get public URL
      const { data: { publicUrl } } = supabaseClient
        .storage
        .from('post-images')
        .getPublicUrl(path)

      uploadedVariants.push({
        platform: variant.platform,
        size: variant.size,
        width: variant.width,
        height: variant.height,
        url: publicUrl,
        filename: variant.filename
      })
    }

    console.log('✅ Image processing complete:', uploadedVariants.length, 'variants created')

    return new Response(
      JSON.stringify({
        success: true,
        variants: uploadedVariants,
        originalUrl: imageUrl
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Error processing image:', error)
    return new Response(
      JSON.stringify({
        error: (error as Error).message || 'Failed to process image'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
