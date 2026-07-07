/**
 * HashtagEditModal
 *
 * Pop-up hashtag editor for the Design step.
 * - Edit, add, delete hashtags independently for Facebook and Instagram
 * - Toggle hashtags on/off per platform
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { PlatformHashtag } from '../../../stores/postCreationStore'

// ─── Icons ──────────────────────────────────────────────────────────────────

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 5v14m-7-7h14" />
  </svg>
)

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

// ─── Types ───────────────────────────────────────────────────────────────────

interface HashtagEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (hashtags: PlatformHashtag[], platformHashtags: Record<string, PlatformHashtag[]>) => void
  sharedHashtags: PlatformHashtag[]
  platformHashtags: Record<string, PlatformHashtag[]>
  selectedPlatforms: string[]
  isPlatformSpecific: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function HashtagEditModal({
  isOpen,
  onClose,
  onSave,
  sharedHashtags,
  platformHashtags,
  selectedPlatforms,
  isPlatformSpecific,
}: HashtagEditModalProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })

  // ── Local state ────────────────────────────────────────────────────────────
  const [editedShared, setEditedShared] = useState<PlatformHashtag[]>([])
  const [editedPlatform, setEditedPlatform] = useState<Record<string, PlatformHashtag[]>>({})
  const [newHashtag, setNewHashtag] = useState('')
  const [activeTab, setActiveTab] = useState<'shared' | 'facebook' | 'instagram'>('shared')

  // ── Reset state when modal opens ─────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setEditedShared(JSON.parse(JSON.stringify(sharedHashtags)))
      setEditedPlatform(JSON.parse(JSON.stringify(platformHashtags)))
      setNewHashtag('')
      // Set initial tab based on mode
      if (isPlatformSpecific && selectedPlatforms.includes('facebook')) {
        setActiveTab('facebook')
      } else if (isPlatformSpecific && selectedPlatforms.includes('instagram')) {
        setActiveTab('instagram')
      } else {
        setActiveTab('shared')
      }
    }
  }, [isOpen, sharedHashtags, platformHashtags, isPlatformSpecific, selectedPlatforms])

  // ── Toggle hashtag ──────────────────────────────────────────────────────────
  const toggleHashtag = useCallback((platform: 'shared' | 'facebook' | 'instagram', index: number) => {
    if (platform === 'shared') {
      setEditedShared(prev => {
        const updated = [...prev]
        updated[index] = { ...updated[index], enabled: !updated[index].enabled }
        return updated
      })
    } else {
      setEditedPlatform(prev => {
        const platformTags = [...(prev[platform] || [])]
        platformTags[index] = { ...platformTags[index], enabled: !platformTags[index].enabled }
        return { ...prev, [platform]: platformTags }
      })
    }
  }, [])

  // ── Add new hashtag ─────────────────────────────────────────────────────────
  const addHashtag = useCallback(() => {
    const cleanTag = newHashtag.trim().replace(/^#+/, '') // Remove leading #
    if (!cleanTag) return

    const formattedTag = `#${cleanTag}`

    if (activeTab === 'shared') {
      // Check if hashtag already exists
      if (editedShared.some(h => h.tag.toLowerCase() === formattedTag.toLowerCase())) {
        return
      }
      setEditedShared(prev => [...prev, { tag: formattedTag, enabled: true }])
    } else {
      const platformTags = editedPlatform[activeTab] || []
      // Check if hashtag already exists for this platform
      if (platformTags.some(h => h.tag.toLowerCase() === formattedTag.toLowerCase())) {
        return
      }
      setEditedPlatform(prev => ({
        ...prev,
        [activeTab]: [...platformTags, { tag: formattedTag, enabled: true, platforms: [activeTab] }]
      }))
    }

    setNewHashtag('')
  }, [newHashtag, activeTab, editedShared, editedPlatform])

  // ── Delete hashtag ──────────────────────────────────────────────────────────
  const deleteHashtag = useCallback((platform: 'shared' | 'facebook' | 'instagram', index: number) => {
    if (platform === 'shared') {
      setEditedShared(prev => prev.filter((_, i) => i !== index))
    } else {
      setEditedPlatform(prev => ({
        ...prev,
        [platform]: (prev[platform] || []).filter((_, i) => i !== index)
      }))
    }
  }, [])

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    onSave(editedShared, editedPlatform)
    onClose()
  }, [editedShared, editedPlatform, onSave, onClose])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && newHashtag.trim()) {
      e.preventDefault()
      addHashtag()
    }
  }, [onClose, newHashtag, addHashtag])

  if (!isOpen) return null

  const currentHashtags = activeTab === 'shared' ? editedShared : (editedPlatform[activeTab] || [])

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Rediger hashtags</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs (only show if platform-specific or multiple platforms) */}
        {(isPlatformSpecific || selectedPlatforms.length > 1) && (
          <div className="px-6 pt-4 border-b border-gray-200">
            <div className="flex gap-2">
              {!isPlatformSpecific && (
                <button
                  onClick={() => setActiveTab('shared')}
                  className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                    activeTab === 'shared'
                      ? 'bg-white text-cta border-b-2 border-cta'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Fælles
                </button>
              )}
              {selectedPlatforms.includes('facebook') && (
                <button
                  onClick={() => setActiveTab('facebook')}
                  className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                    activeTab === 'facebook'
                      ? 'bg-white text-cta border-b-2 border-cta'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Facebook
                </button>
              )}
              {selectedPlatforms.includes('instagram') && (
                <button
                  onClick={() => setActiveTab('instagram')}
                  className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                    activeTab === 'instagram'
                      ? 'bg-white text-cta border-b-2 border-cta'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Instagram
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Add new hashtag */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tilføj nyt hashtag
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="#eksempel"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cta focus:border-transparent"
              />
              <button
                onClick={addHashtag}
                disabled={!newHashtag.trim()}
                className="px-4 py-2 bg-cta hover:bg-cta-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Tilføj
              </button>
            </div>
          </div>

          {/* Hashtag list */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {activeTab === 'shared' ? 'Fælles hashtags' : `${activeTab === 'facebook' ? 'Facebook' : 'Instagram'} hashtags`}
            </label>
            {currentHashtags.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                Ingen hashtags endnu. Tilføj et ovenfor.
              </div>
            ) : (
              <div className="space-y-2">
                {currentHashtags.map((hashtag, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <button
                      onClick={() => toggleHashtag(activeTab, index)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        hashtag.enabled
                          ? 'bg-cta border-cta'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {hashtag.enabled && <CheckIcon className="w-3 h-3 text-white" />}
                    </button>
                    <span className={`flex-1 text-sm ${hashtag.enabled ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                      {hashtag.tag}
                    </span>
                    <button
                      onClick={() => deleteHashtag(activeTab, index)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Slet hashtag"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Annuller
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-cta hover:bg-cta-hover text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <CheckIcon className="w-4 h-4" />
            Gem
          </button>
        </div>
      </div>
    </div>
  )
}
