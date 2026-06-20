/**
 * MediaMetadataEditor Component
 * 
 * Edit media item metadata with:
 * - Post type selection
 * - Dish name input
 * - Tags management
 * - Alt text for accessibility
 * - Save/cancel actions
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { MediaItem, PostType, UpdateMediaMetadata } from '../../../api/mediaLibrary'
import { updateMediaMetadata } from '../../../api/mediaLibrary'

interface MediaMetadataEditorProps {
  media: MediaItem
  onSave?: (media: MediaItem) => void
  onCancel?: () => void
  onError?: (error: Error) => void
}

export function MediaMetadataEditor({
  media,
  onSave,
  onCancel,
  onError,
}: MediaMetadataEditorProps) {
  const { t } = useTranslation()
  
  const POST_TYPES: { value: PostType; label: string }[] = [
    { value: 'food', label: t('media.categories.food', 'Food') },
    { value: 'drinks', label: t('media.categories.drinks', 'Drinks') },
    { value: 'atmosphere', label: t('media.categories.atmosphere', 'Atmosphere') },
    { value: 'other', label: t('media.categories.other', 'Other') },
  ]
  
  const [formData, setFormData] = useState<UpdateMediaMetadata>({
    postType: media.post_type,
    dishName: media.dish_name,
    tags: media.tags || [],
    altText: media.alt_text,
  })
  const [tagInput, setTagInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    // Reset form when media changes
    setFormData({
      postType: media.post_type,
      dishName: media.dish_name,
      tags: media.tags || [],
      altText: media.alt_text,
    })
    setTagInput('')
  }, [media.id])

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !formData.tags?.includes(tag)) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), tag],
      })
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter((tag) => tag !== tagToRemove) || [],
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updatedMedia = await updateMediaMetadata(media.id, formData)
      onSave?.(updatedMedia)
    } catch (error) {
      console.error('Failed to update metadata:', error)
      onError?.(error as Error)
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges =
    formData.postType !== media.post_type ||
    formData.dishName !== media.dish_name ||
    formData.altText !== media.alt_text ||
    JSON.stringify(formData.tags) !== JSON.stringify(media.tags)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <h3 className="text-lg font-semibold text-gray-900">{t('media.editor.title', 'Edit Media Details')}</h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Post Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('media.editor.category', 'Category')}
        </label>
        <select
          value={formData.postType || ''}
          onChange={(e) =>
            setFormData({ ...formData, postType: (e.target.value as PostType) || null })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">{t('media.editor.uncategorized', 'Uncategorized')}</option>
          {POST_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Dish Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('media.editor.dishName', 'Dish/Item Name')}
        </label>
        <input
          type="text"
          value={formData.dishName || ''}
          onChange={(e) => setFormData({ ...formData, dishName: e.target.value || null })}
          placeholder={t('media.editor.dishNamePlaceholder', 'e.g., Signature Burger')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('media.editor.tags', 'Tags')}
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('media.editor.addTagPlaceholder', 'Add a tag...')}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleAddTag}
            disabled={!tagInput.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('media.editor.addTag', 'Add')}
          </button>
        </div>
        {formData.tags && formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-blue-900 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Alt Text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('media.editor.altText', 'Alt Text (Accessibility)')}
        </label>
        <textarea
          value={formData.altText || ''}
          onChange={(e) => setFormData({ ...formData, altText: e.target.value || null })}
          placeholder={t('media.editor.altTextPlaceholder', 'Describe this image for screen readers...')}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isSaving ? t('media.editor.saving', 'Saving...') : t('media.editor.save', 'Save Changes')}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {t('media.editor.cancel', 'Cancel')}
        </button>
      </div>
    </div>
  )
}
