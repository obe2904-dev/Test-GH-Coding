/**
 * Resizes images to at most MAX_SIDE pixels on the longest side before
 * sending to Gemini. Reduces image token cost by up to 12× for phone photos
 * (a 4000×3000 image goes from ~49k tokens to ~4k tokens).
 *
 * Uses OffscreenCanvas + createImageBitmap (Web APIs available in Deno / Supabase
 * edge runtime). Falls back silently to the original if the runtime does not
 * support canvas, so it never breaks existing behaviour.
 */

const MAX_SIDE = 1024

export async function resizeForGemini(
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  // Skip non-image types (video, etc.)
  if (!mimeType.startsWith('image/')) {
    return { buffer, mimeType }
  }

  try {
    const blob = new Blob([buffer], { type: mimeType })
    const bitmap = await createImageBitmap(blob)
    const { width, height } = bitmap

    // Already small enough — return original unchanged
    if (width <= MAX_SIDE && height <= MAX_SIDE) {
      bitmap.close()
      return { buffer, mimeType }
    }

    const scale = MAX_SIDE / Math.max(width, height)
    const newWidth  = Math.round(width  * scale)
    const newHeight = Math.round(height * scale)

    const canvas = new OffscreenCanvas(newWidth, newHeight)
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight)
    bitmap.close()

    const resizedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
    const resizedBuffer = await resizedBlob.arrayBuffer()

    console.log(
      `📐 Resized for Gemini: ${width}×${height} → ${newWidth}×${newHeight}` +
      ` (${Math.round(buffer.byteLength / 1024)}KB → ${Math.round(resizedBuffer.byteLength / 1024)}KB)`
    )

    return { buffer: resizedBuffer, mimeType: 'image/jpeg' }
  } catch (e) {
    // Canvas not available in this runtime — send original without breaking anything
    console.warn('⚠️ Image resize unavailable, using original:', e instanceof Error ? e.message : String(e))
    return { buffer, mimeType }
  }
}
