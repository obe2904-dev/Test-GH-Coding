import { useState } from 'react'
import { uploadVideoCoverFrame } from '../api/image-processing'

// Fraction offsets for the three candidate frames (10%, 50%, 90% of duration)
const FRAME_OFFSETS = [0.1, 0.5, 0.9]

/**
 * Extracts a single frame from a video file at a given time offset (0–1 fraction of duration).
 * Renders via a hidden <video> + <canvas> — entirely client-side, no server required.
 */
function extractFrame(file: File, fraction: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const objectUrl = URL.createObjectURL(file)

    video.onloadedmetadata = () => {
      const seekTo = video.duration * fraction
      video.currentTime = seekTo
    }

    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      // Cap at 720px wide to keep cover frames compact
      const scale = Math.min(1, 720 / video.videoWidth)
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Canvas 2D context unavailable'))
        return
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl)
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob returned null'))
        },
        'image/jpeg',
        0.82
      )
    }

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Video element failed to load'))
    }

    video.src = objectUrl
  })
}

/**
 * useVideoCover — extracts three candidate cover frames from a video file,
 * uploads them to Supabase Storage, and returns their public URLs.
 *
 * Usage:
 *   const { extractCoverCandidates, isExtracting } = useVideoCover()
 *   const candidates = await extractCoverCandidates(file, userId)
 */
export function useVideoCover() {
  const [isExtracting, setIsExtracting] = useState(false)

  async function extractCoverCandidates(file: File, userId: string): Promise<string[]> {
    setIsExtracting(true)
    try {
      const urls: string[] = []
      for (let i = 0; i < FRAME_OFFSETS.length; i++) {
        const blob = await extractFrame(file, FRAME_OFFSETS[i])
        const url = await uploadVideoCoverFrame(blob, userId, i)
        urls.push(url)
      }
      return urls
    } catch (err) {
      console.warn('useVideoCover: frame extraction failed', err)
      return []
    } finally {
      setIsExtracting(false)
    }
  }

  return { extractCoverCandidates, isExtracting }
}
