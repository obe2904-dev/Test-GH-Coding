/**
 * PostModal - Popup for viewing/editing a post from the timeline
 * 
 * Modes:
 * - Draft (udkast): Edit text, time, post now, delete, with "Apply to both" option
 * - Scheduled (planlagt): Post now, reschedule, delete
 * - Published (udgivet): Read-only preview in Facebook/Instagram style
 */

import { useState } from 'react'
import { X, Calendar, Send, Trash2, Hash } from 'lucide-react'
import type { PostStatus, Platform } from './PostFrame'
import type { PlatformHashtag } from '../../stores/postCreationStore'

interface PostModalProps {
  isOpen: boolean
  onClose: () => void
  post: {
    id: string
    platform: Platform
    status: PostStatus
    text: string
    headline?: string | null
    photoUrl?: string | null
    scheduledAt?: string | null
    ideaSource?: string
    suggestionId?: number | null
    hashtags?: PlatformHashtag[]
  }
  // If there's a sibling post on the other platform (for "Apply to both")
  siblingPost?: {
    id: string
    platform: Platform
  } | null
  onPostNow: (postId: string, applyToBoth: boolean) => Promise<void>
  onReschedule: (postId: string, newTime: string, applyToBoth: boolean) => Promise<void>
  onDelete: (postId: string, applyToBoth: boolean) => Promise<void>
  onUpdateText: (postId: string, newText: string, applyToBoth: boolean) => Promise<void>
  onUpdateHashtags?: (postId: string, newHashtags: PlatformHashtag[], applyToBoth: boolean) => Promise<void>
}

const PLATFORM_COLORS: Record<Platform, { primary: string; bg: string }> = {
  facebook: { primary: '#1877F2', bg: '#E7F3FF' },
  instagram: { primary: '#E4405F', bg: '#FFE7EC' },
}

export function PostModal({
  isOpen,
  onClose,
  post,
  siblingPost,
  onPostNow,
  onReschedule,
  onDelete,
  onUpdateText,
  onUpdateHashtags,
}: PostModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState(post.text)
  const [isEditingHashtags, setIsEditingHashtags] = useState(false)
  const [editedHashtags, setEditedHashtags] = useState<PlatformHashtag[]>(post.hashtags || [])
  const [applyToBoth, setApplyToBoth] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [newScheduleTime, setNewScheduleTime] = useState('')
  const [showReschedule, setShowReschedule] = useState(false)

  if (!isOpen) return null

  const colors = PLATFORM_COLORS[post.platform]
  const isPublished = post.status === 'udgivet'
  const isDraft = post.status === 'udkast'
  // Text and hashtag editing now only happens in Design - Udgiv is read-only
  const canEditText = false
  const canSchedule = !isPublished

  const handleSaveText = async () => {
    await onUpdateText(post.id, editedText, applyToBoth)
    setIsEditing(false)
  }

  const handleSaveHashtags = async () => {
    if (onUpdateHashtags) {
      // Hashtags are always platform-specific - never apply to both
      await onUpdateHashtags(post.id, editedHashtags, false)
      setIsEditingHashtags(false)
    }
  }

  const handlePostNow = async () => {
    setIsPosting(true)
    try {
      await onPostNow(post.id, applyToBoth)
      onClose()
    } finally {
      setIsPosting(false)
    }
  }

  const handleReschedule = async () => {
    if (!newScheduleTime) return
    await onReschedule(post.id, newScheduleTime, applyToBoth)
    setShowReschedule(false)
    onClose()
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete(post.id, applyToBoth)
      onClose()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.primary }}>
              <span className="text-white text-xs font-bold">{post.platform === 'facebook' ? 'F' : 'I'}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 capitalize">{post.platform}</h2>
              <p className="text-sm text-slate-500">
                {post.status === 'udkast' && 'Udkast'}
                {post.status === 'planlagt' && 'Planlagt opslag'}
                {post.status === 'udgivet' && 'Udgivet opslag'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Photo */}
          {post.photoUrl && (
            <img
              src={post.photoUrl}
              alt="Post"
              className="w-full rounded-lg mb-4"
            />
          )}

          {/* Text Content */}
          {isEditing ? (
            <div className="mb-4">
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-3 text-sm resize-none"
                rows={8}
                placeholder="Skriv din tekst her..."
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveText}
                  className="px-4 py-2 bg-cta text-white rounded-lg text-sm font-semibold hover:bg-cta-hover"
                >
                  Gem
                </button>
                <button
                  onClick={() => {
                    setEditedText(post.text)
                    setIsEditing(false)
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuller
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              {post.headline && post.platform === 'facebook' && (
                <h3 className="text-lg font-bold text-slate-900 mb-2">{post.headline}</h3>
              )}
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {post.text || <span className="italic text-slate-400">Ingen tekst</span>}
              </p>
              {canEditText && !isPublished && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                  💡 Tip: Gå tilbage til Design for at redigere tekst
                </div>
              )}
            </div>
          )}

          {/* Hashtags Section */}
          {isEditingHashtags ? (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Hashtags (# tilføjes automatisk)
              </label>
              <div className="space-y-2">
                {editedHashtags.map((tag, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tag.tag}
                      onChange={(e) => {
                        const newHashtags = [...editedHashtags]
                        newHashtags[idx] = { ...tag, tag: e.target.value }
                        setEditedHashtags(newHashtags)
                      }}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="hashtag"
                    />
                    <button
                      onClick={() => {
                        setEditedHashtags(editedHashtags.filter((_, i) => i !== idx))
                      }}
                      className="px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50"
                    >
                      Slet
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setEditedHashtags([...editedHashtags, { tag: '', enabled: true }])
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  + Tilføj hashtag
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSaveHashtags}
                  className="px-4 py-2 bg-cta text-white rounded-lg text-sm font-semibold hover:bg-cta-hover"
                >
                  Gem
                </button>
                <button
                  onClick={() => {
                    setEditedHashtags(post.hashtags || [])
                    setIsEditingHashtags(false)
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuller
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              {(post.hashtags && post.hashtags.length > 0) ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Hashtags</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {post.hashtags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded"
                      >
                        #{tag.tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">Ingen hashtags</p>
              )}
              {canEditText && !isPublished && onUpdateHashtags && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                  💡 Tip: Gå tilbage til Design for at redigere hashtags
                </div>
              )}
            </div>
          )}

          {/* Scheduled Time */}
          {post.scheduledAt && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="text-slate-700">
                {new Date(post.scheduledAt).toLocaleString('da-DK', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}

          {/* Reschedule UI */}
          {showReschedule && canSchedule && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nyt tidspunkt
              </label>
              <input
                type="datetime-local"
                value={newScheduleTime}
                onChange={(e) => setNewScheduleTime(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleReschedule}
                  disabled={!newScheduleTime}
                  className="px-4 py-2 bg-cta text-white rounded-lg text-sm font-semibold hover:bg-cta-hover disabled:opacity-50"
                >
                  Bekræft
                </button>
                <button
                  onClick={() => setShowReschedule(false)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700"
                >
                  Annuller
                </button>
              </div>
            </div>
          )}

          {/* "Apply to Both" Checkbox (only if sibling exists and can schedule) */}
          {siblingPost && canSchedule && (
            <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToBoth}
                  onChange={(e) => setApplyToBoth(e.target.checked)}
                  className="w-4 h-4 text-cta border-slate-300 rounded focus:ring-cta"
                />
                <span className="text-sm font-medium text-slate-700">
                  📋 Anvend ændringer på begge platforme (Facebook + Instagram). Gælder ikke hashtags
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        {canSchedule && (
          <div className="border-t border-slate-200 p-4 bg-slate-50 flex gap-3 flex-wrap">
            <button
              onClick={handlePostNow}
              disabled={isPosting}
              className="flex-1 px-4 py-2.5 bg-cta text-white rounded-lg text-sm font-semibold hover:bg-cta-hover disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {isPosting ? 'Udgiver...' : 'Post nu'}
            </button>

            {!showReschedule && (
              <button
                onClick={() => setShowReschedule(true)}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Skift tidspunkt
              </button>
            )}

            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Sletter...' : 'Slet'}
            </button>
          </div>
        )}

        {/* Read-only footer for published posts */}
        {isPublished && (
          <div className="border-t border-slate-200 p-4 bg-slate-50">
            <p className="text-sm text-slate-600 text-center">
              ✓ Dette opslag er allerede udgivet og kan ikke ændres
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
