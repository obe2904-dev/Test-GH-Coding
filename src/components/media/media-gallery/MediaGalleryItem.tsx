/**
 * MediaGalleryItem Component
 * 
 * Single media item in the gallery grid with:
 * - Thumbnail preview
 * - Hover actions (select, delete, edit)
 * - Usage count badge
 * - Media type indicator
 * - Selection state
 */

import { useState } from 'react'
import type { MediaItem } from '../../../api/mediaLibrary'
import { getMediaThumbnailUrl, getMediaUrl } from '../../../api/mediaLibrary'

interface MediaGalleryItemProps {
  media: MediaItem
  isSelected?: boolean
  onSelect?: (media: MediaItem) => void
  onDelete?: (media: MediaItem) => void
  onEdit?: (media: MediaItem) => void
  showActions?: boolean
}

export function MediaGalleryItem({
  media,
  isSelected = false,
  onSelect,
  onDelete,
  onEdit,
  showActions = true,
}: MediaGalleryItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageError, setImageError] = useState(false)

  const thumbnailUrl = getMediaThumbnailUrl(media)
  const fullUrl = getMediaUrl(media.storage_path)

  const handleClick = () => {
    if (onSelect) {
      onSelect(media)
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDelete && confirm('Delete this media? This cannot be undone.')) {
      onDelete(media)
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onEdit) {
      onEdit(media)
    }
  }

  return (
    <div
      className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Thumbnail Image */}
      <div className="aspect-square bg-gray-100 relative">
        {!imageError ? (
          <img
            src={thumbnailUrl}
            alt={media.alt_text || media.dish_name || 'Media thumbnail'}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Media Type Badge */}
        {media.media_type === 'video' && (
          <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
            Video
          </div>
        )}

        {/* Usage Count Badge */}
        {media.usage_count > 0 && (
          <div className="absolute top-2 left-2 bg-green-500/90 text-white px-2 py-1 rounded text-xs font-medium">
            Used {media.usage_count}x
          </div>
        )}

        {/* Selection Checkmark */}
        {isSelected && (
          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
            <div className="bg-blue-500 rounded-full p-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}

        {/* Hover Overlay with Actions */}
        {showActions && isHovered && !isSelected && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2">
            <button
              onClick={handleClick}
              className="bg-white text-gray-800 px-3 py-2 rounded hover:bg-gray-100 text-sm font-medium transition-colors"
              title="Select this media"
            >
              Select
            </button>
            <button
              onClick={handleEdit}
              className="bg-white text-gray-800 p-2 rounded hover:bg-gray-100 transition-colors"
              title="Edit metadata"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="bg-red-500 text-white p-2 rounded hover:bg-red-600 transition-colors"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Item Info */}
      <div className="p-2 bg-white">
        <div className="text-xs text-gray-600 truncate font-medium">
          {media.dish_name || media.original_filename}
        </div>
        {media.resolved_category && (
          <div className="text-xs text-gray-400 capitalize mt-0.5">
            {media.resolved_category.replace(/_/g, ' ')}
          </div>
        )}
        <div className="text-xs text-gray-400 mt-1">
          {new Date(media.upload_date).toLocaleDateString()}
        </div>
      </div>

      {/* Full-size Preview on Hover (optional enhancement) */}
      {isHovered && (
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-16 right-2 bg-white text-gray-700 p-1.5 rounded shadow-lg hover:bg-gray-50 transition-colors text-xs"
          onClick={(e) => e.stopPropagation()}
          title="View full size"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  )
}
