/**
 * MediaGalleryGrid Component
 * 
 * Responsive grid layout for media items with:
 * - Empty state
 * - Loading state
 * - Error state
 * - Infinite scroll support (future)
 */

import type { MediaItem } from '../../../api/mediaLibrary'
import { MediaGalleryItem } from './MediaGalleryItem'

interface MediaGalleryGridProps {
  media: MediaItem[]
  selectedMediaId?: string | null
  onSelectMedia?: (media: MediaItem) => void
  onDeleteMedia?: (media: MediaItem) => void
  onEditMedia?: (media: MediaItem) => void
  isLoading?: boolean
  error?: Error | null
  emptyMessage?: string
}

export function MediaGalleryGrid({
  media,
  selectedMediaId,
  onSelectMedia,
  onDeleteMedia,
  onEditMedia,
  isLoading = false,
  error = null,
  emptyMessage = 'No media found. Upload your first photo or video!',
}: MediaGalleryGridProps) {
  // Loading State
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg className="w-12 h-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-gray-700 font-medium mb-1">Failed to load media</p>
        <p className="text-sm text-gray-500">{error.message}</p>
      </div>
    )
  }

  // Empty State
  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="bg-gray-100 rounded-full p-6 mb-4">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-gray-700 font-medium mb-1">No media yet</p>
        <p className="text-sm text-gray-500 max-w-sm">{emptyMessage}</p>
      </div>
    )
  }

  // Grid with Media
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {media.map((item) => (
        <MediaGalleryItem
          key={item.id}
          media={item}
          isSelected={item.id === selectedMediaId}
          onSelect={onSelectMedia}
          onDelete={onDeleteMedia}
          onEdit={onEditMedia}
        />
      ))}
    </div>
  )
}
