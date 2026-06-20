/**
 * MediaGallerySidebar Component
 * 
 * Compact media gallery widget for sidebar with:
 * - Recent uploads preview (3-6 items)
 * - Quick upload button
 * - Storage quota mini-indicator
 * - "View All" button to open full modal
 */

import { useState, useEffect } from 'react'
import type { MediaItem, StorageQuota } from '../../../api/mediaLibrary'
import { getMediaLibrary, getStorageQuota } from '../../../api/mediaLibrary'

interface MediaGallerySidebarProps {
  businessId: string
  onOpenFullGallery?: () => void
  onSelectMedia?: (media: MediaItem) => void
  maxItems?: number
}

export function MediaGallerySidebar({
  businessId,
  onOpenFullGallery,
  onSelectMedia,
  maxItems = 6,
}: MediaGallerySidebarProps) {
  const [recentMedia, setRecentMedia] = useState<MediaItem[]>([])
  const [quota, setQuota] = useState<StorageQuota | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (businessId) {
      loadRecentMedia()
      loadQuota()
    }
  }, [businessId])

  const loadRecentMedia = async () => {
    setIsLoading(true)
    try {
      const media = await getMediaLibrary(
        businessId,
        undefined,
        { sortBy: 'upload_date', sortOrder: 'desc' }
      )
      setRecentMedia(media.slice(0, maxItems))
    } catch (err) {
      console.error('Failed to load recent media:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadQuota = async () => {
    try {
      const quotaData = await getStorageQuota(businessId)
      setQuota(quotaData)
    } catch (err) {
      console.warn('Failed to load quota:', err)
    }
  }

  const getQuotaColor = () => {
    if (!quota) return 'bg-gray-200'
    if (quota.isOverLimit) return 'bg-red-500'
    if (quota.isNearLimit) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Media Gallery</h3>
        <button
          onClick={onOpenFullGallery}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          View All
        </button>
      </div>

      {/* Quota Mini Indicator */}
      {quota && (
        <div>
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>{quota.usedMB}MB / {quota.limitMB}MB</span>
            <span className="text-gray-500">{quota.percentUsed.toFixed(0)}%</span>
          </div>
          <div className="relative w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className={`${getQuotaColor()} h-full transition-all duration-300`}
              style={{ width: `${Math.min(quota.percentUsed, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Recent Media Grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : recentMedia.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {recentMedia.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectMedia?.(item)}
              className="aspect-square rounded overflow-hidden border border-gray-200 hover:border-blue-400 hover:ring-2 hover:ring-blue-200 transition-all group relative"
              title={item.dish_name || item.original_filename}
            >
              <img
                src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/user-media/${item.thumbnail_path}`}
                alt={item.alt_text || item.dish_name || 'Media thumbnail'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* Video Badge */}
              {item.media_type === 'video' && (
                <div className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                </div>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500">
          <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-xs">No media yet</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onOpenFullGallery}
          className="flex-1 bg-blue-500 text-white py-2 px-3 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload
        </button>
        <button
          onClick={onOpenFullGallery}
          className="flex-1 border border-gray-300 text-gray-700 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          Browse
        </button>
      </div>
    </div>
  )
}
