/**
 * MediaGalleryModal Component
 * 
 * Full-screen media gallery modal with:
 * - Upload tab
 * - Browse tab with filters
 * - Quota indicator
 * - Selection mode for post creation
 * - Metadata editing
 */

import { useState, useEffect } from 'react'
import type { MediaItem } from '../../../api/mediaLibrary'
import {
  getMediaLibrary,
  deleteMediaItem,
  getStorageQuota,
  type StorageQuota,
} from '../../../api/mediaLibrary'
import { MediaGalleryGrid } from './MediaGalleryGrid'
import { MediaFilterBar, type MediaFilterState } from './MediaFilterBar'
import { MediaUploadZone } from './MediaUploadZone'
import { MediaQuotaIndicator } from './MediaQuotaIndicator'
import { MediaMetadataEditor } from './MediaMetadataEditor'

interface MediaGalleryModalProps {
  businessId: string
  isOpen: boolean
  onClose: () => void
  onSelectMedia?: (media: MediaItem) => void
  selectionMode?: boolean
  defaultPostType?: PostType
}

type TabType = 'browse' | 'upload'

export function MediaGalleryModal({
  businessId,
  isOpen,
  onClose,
  onSelectMedia,
  selectionMode = false,
  defaultPostType,
}: MediaGalleryModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('browse')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null)
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [quota, setQuota] = useState<StorageQuota | null>(null)
  const [filters, setFilters] = useState<MediaFilterState>({
    sortBy: 'upload_date',
    sortOrder: 'desc',
  })

  // Load media and quota when modal opens
  useEffect(() => {
    if (isOpen && businessId) {
      loadMedia()
      loadQuota()
    }
  }, [isOpen, businessId, filters])

  const loadMedia = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getMediaLibrary(
        businessId,
        {
          mediaType: filters.mediaType,
          postType: filters.postType,
          tags: filters.tags,
          searchQuery: filters.searchQuery,
        },
        {
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        }
      )
      setMedia(result)
    } catch (err) {
      console.error('Failed to load media:', err)
      setError(err as Error)
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

  const handleSelectMedia = (mediaItem: MediaItem) => {
    if (selectionMode && onSelectMedia) {
      onSelectMedia(mediaItem)
      onClose()
    } else {
      setSelectedMediaId(mediaItem.id === selectedMediaId ? null : mediaItem.id)
    }
  }

  const handleDeleteMedia = async (mediaItem: MediaItem) => {
    try {
      await deleteMediaItem(mediaItem.id)
      setMedia((prev) => prev.filter((m) => m.id !== mediaItem.id))
      if (selectedMediaId === mediaItem.id) {
        setSelectedMediaId(null)
      }
      await loadQuota() // Refresh quota after deletion
    } catch (err) {
      console.error('Failed to delete media:', err)
      alert('Failed to delete media. Please try again.')
    }
  }

  const handleEditMedia = (mediaItem: MediaItem) => {
    setEditingMedia(mediaItem)
  }

  const handleMetadataSaved = (updatedMedia: MediaItem) => {
    setMedia((prev) =>
      prev.map((m) => (m.id === updatedMedia.id ? updatedMedia : m))
    )
    setEditingMedia(null)
  }

  const handleUploadComplete = async () => {
    await loadMedia()
    await loadQuota()
    setActiveTab('browse')
  }

  const handleUploadError = (error: Error) => {
    alert(error.message)
    // TODO: Replace with toast notification
  }

  const handleFilterChange = (newFilters: MediaFilterState) => {
    setFilters(newFilters)
  }

  const handleUseSelected = () => {
    const selected = media.find((m) => m.id === selectedMediaId)
    if (selected && onSelectMedia) {
      onSelectMedia(selected)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="absolute inset-4 md:inset-8 bg-white rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Media Gallery</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'browse'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Browse ({media.length})
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Upload New
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'browse' ? (
              <div className="flex flex-col h-full">
                <MediaFilterBar onFilterChange={handleFilterChange} showAdvanced />
                <div className="flex-1 p-6 overflow-y-auto">
                  <MediaGalleryGrid
                    media={media}
                    selectedMediaId={selectedMediaId}
                    onSelectMedia={handleSelectMedia}
                    onDeleteMedia={handleDeleteMedia}
                    onEditMedia={handleEditMedia}
                    isLoading={isLoading}
                    error={error}
                  />
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {/* Quota Warning Banner */}
                {quota?.isOverLimit && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-red-900 mb-1">Storage Full</h4>
                        <p className="text-sm text-red-700">
                          You've used all {quota.limitMB}MB of storage. Delete old media or upgrade to continue uploading.
                        </p>
                        {quota.tier === 'free' && (
                          <button
                            onClick={() => window.location.href = '/dashboard/settings/subscription'}
                            className="mt-2 inline-block bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                          >
                            Upgrade to 1GB Storage →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {quota?.isNearLimit && !quota?.isOverLimit && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-yellow-900 mb-1">Storage Almost Full</h4>
                        <p className="text-sm text-yellow-700">
                          You've used {quota.percentUsed.toFixed(0)}% of your {quota.limitMB}MB storage. Consider deleting old media or upgrading.
                        </p>
                        {quota.tier === 'free' && (
                          <button
                            onClick={() => window.location.href = '/dashboard/settings/subscription'}
                            className="mt-2 inline-block bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                          >
                            Upgrade to 1GB Storage →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <MediaQuotaIndicator quota={quota} isLoading={!quota} />
                <MediaUploadZone
                  businessId={businessId}
                  onUploadComplete={handleUploadComplete}
                  onUploadError={handleUploadError}
                  defaultPostType={defaultPostType}
                  className="min-h-[300px]"
                  quota={quota}
                />
              </div>
            )}
          </div>

          {/* Sidebar for Metadata Editor */}
          {editingMedia && (
            <div className="w-96 border-l border-gray-200 overflow-y-auto p-4">
              <MediaMetadataEditor
                media={editingMedia}
                onSave={handleMetadataSaved}
                onCancel={() => setEditingMedia(null)}
                onError={(err) => alert(err.message)}
              />
            </div>
          )}
        </div>

        {/* Footer with Selection Actions */}
        {selectionMode && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedMediaId
                ? '1 item selected'
                : 'Select a photo or video to use in your post'}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUseSelected}
                disabled={!selectedMediaId}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Use Selected
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
