/**
 * PostModal - Popup for viewing/editing a post from the timeline
 * 
 * Modes:
 * - Draft (udkast): Edit text, time, post now, delete, with "Apply to both" option
 * - Scheduled (planlagt): Post now, reschedule, delete
 * - Published (udgivet): Read-only preview in Facebook/Instagram style
 */

import { useState, useMemo } from 'react'
import { X, Calendar, Send, Trash2, Download, Copy, ExternalLink } from 'lucide-react'
import type { PostStatus, Platform } from './PostFrame'
import type { PlatformHashtag } from '../../stores/postCreationStore'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { QuarterHourTimePicker } from '../ui/QuarterHourTimePicker'

// Helper: Get current time rounded to next 15-minute interval
function getNearest15MinInterval() {
  const now = new Date()
  const minutes = now.getMinutes()
  const roundedMinutes = Math.ceil(minutes / 15) * 15
  
  if (roundedMinutes === 60) {
    now.setHours(now.getHours() + 1)
    now.setMinutes(0)
  } else {
    now.setMinutes(roundedMinutes)
  }
  
  return {
    hour: String(now.getHours()).padStart(2, '0'),
    minute: String(now.getMinutes()).padStart(2, '0')
  }
}

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
  const { isConnected } = useConnectionsStore()
  const nearestTime = useMemo(() => getNearest15MinInterval(), [])
  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState(post.text)
  const [isEditingHashtags, setIsEditingHashtags] = useState(false)
  const [editedHashtags, setEditedHashtags] = useState<PlatformHashtag[]>(post.hashtags || [])
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [newScheduleTime, setNewScheduleTime] = useState('')
  const [showReschedule, setShowReschedule] = useState(false)
  const [showManualPosting, setShowManualPosting] = useState(false)
  const [copiedText, setCopiedText] = useState(false)
  const [confirmedPosted, setConfirmedPosted] = useState(false)
  const [selectedHour, setSelectedHour] = useState(nearestTime.hour)
  const [selectedMinute, setSelectedMinute] = useState(nearestTime.minute)

  if (!isOpen) return null

  const colors = PLATFORM_COLORS[post.platform]
  const isPublished = post.status === 'udgivet'
  const isDraft = post.status === 'udkast'
  // Text and hashtag editing now only happens in Design - Udgiv is read-only
  const canEditText = false
  const canSchedule = !isPublished

  const platformConnected = isConnected(post.platform.toLowerCase())

  const handleSaveText = async () => {
    await onUpdateText(post.id, editedText, false)
    setIsEditing(false)
  }

  const handleSaveHashtags = async () => {
    if (onUpdateHashtags) {
      await onUpdateHashtags(post.id, editedHashtags, false)
      setIsEditingHashtags(false)
    }
  }

  const handlePostNowClick = () => {
    if (platformConnected) {
      // Show confirmation for connected platforms
      if (confirm('Bekræft post nu - Vil du udgive dette opslag nu?')) {
        handlePostNow()
      }
    } else {
      // Show manual posting UI for unconnected platforms
      setShowManualPosting(true)
    }
  }

  const handlePostNow = async () => {
    setIsPosting(true)
    try {
      await onPostNow(post.id, false)
      onClose()
    } finally {
      setIsPosting(false)
    }
  }

  const handleReschedule = async () => {
    if (!newScheduleTime) return
    await onReschedule(post.id, newScheduleTime, false)
    setShowReschedule(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!confirm('Sikker på sletning af opslag?')) {
      return
    }
    
    setIsDeleting(true)
    try {
      await onDelete(post.id, false)
      onClose()
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCopyText = async () => {
    await navigator.clipboard.writeText(post.text)
    setCopiedText(true)
    setTimeout(() => setCopiedText(false), 2000)
  }

  const handleDownloadPhoto = async () => {
    if (!post.photoUrl) return
    const link = document.createElement('a')
    link.href = post.photoUrl
    link.download = `post-${post.platform}-${Date.now()}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleOpenPlatform = () => {
    const urls: Record<string, string> = {
      facebook: 'https://www.facebook.com/',
      instagram: 'https://www.instagram.com/'
    }
    window.open(urls[post.platform.toLowerCase()] || urls.facebook, '_blank')
  }

  const handleConfirmPosted = async () => {
    const [hours, minutes] = [parseInt(selectedHour), parseInt(selectedMinute)]
    const postedAt = new Date()
    postedAt.setHours(hours, minutes, 0, 0)
    setConfirmedPosted(true)
    await handlePostNow()
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

          {/* Scheduled Time */}
          {post.scheduledAt && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="text-slate-700">
                {new Date(post.scheduledAt).toLocaleString('da-DK', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).replace(',', ' kl.')}
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
        </div>

        {/* Actions Footer */}
        {canSchedule && !showManualPosting && (
          <div className="border-t border-slate-200 p-4 bg-slate-50 flex gap-3 flex-wrap">
            <button
              onClick={handlePostNowClick}
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

        {/* Manual Posting Side-by-Side UI for Unconnected Platforms */}
        {showManualPosting && (
          <div className="border-t border-slate-200 bg-gradient-to-br from-amber-50 to-orange-50">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                  <span className="text-white text-lg">📋</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Manuel posting påkrævet</h3>
                  <p className="text-sm text-slate-600">
                    {post.platform.charAt(0).toUpperCase() + post.platform.slice(1)} er ikke tilsluttet - kopiér indholdet og post manuelt
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Preview */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700">Indhold</h4>
                  
                  {post.photoUrl && (
                    <div className="rounded-lg overflow-hidden border-2 border-amber-200">
                      <img
                        src={post.photoUrl}
                        alt="Post preview"
                        className="w-full h-auto"
                      />
                    </div>
                  )}

                  <div className="bg-white rounded-lg border-2 border-amber-200 p-3">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{post.text}</p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700">Trin til at poste</h4>

                  {post.photoUrl && (
                    <div className="bg-white rounded-lg border-2 border-slate-200 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 rounded-full bg-cta text-white text-xs font-bold flex items-center justify-center">1</span>
                        <span className="text-sm font-semibold text-slate-700">Gem billede</span>
                      </div>
                      <button
                        onClick={handleDownloadPhoto}
                        className="w-full px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Gem billede
                      </button>
                    </div>
                  )}

                  <div className="bg-white rounded-lg border-2 border-slate-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-cta text-white text-xs font-bold flex items-center justify-center">{post.photoUrl ? '2' : '1'}</span>
                      <span className="text-sm font-semibold text-slate-700">Kopiér tekst</span>
                    </div>
                    <button
                      onClick={handleCopyText}
                      className="w-full px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      {copiedText ? 'Kopieret!' : 'Kopiér tekst'}
                    </button>
                  </div>

                  <div className="bg-white rounded-lg border-2 border-slate-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-cta text-white text-xs font-bold flex items-center justify-center">{post.photoUrl ? '3' : '2'}</span>
                      <span className="text-sm font-semibold text-slate-700">Åbn {post.platform}</span>
                    </div>
                    <button
                      onClick={handleOpenPlatform}
                      className="w-full px-4 py-2 bg-cta text-white rounded-lg text-sm font-semibold hover:bg-cta-hover flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Åbn {post.platform.charAt(0).toUpperCase() + post.platform.slice(1)}
                    </button>
                  </div>

                  <div className="bg-white rounded-lg border-2 border-green-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">{post.photoUrl ? '4' : '3'}</span>
                      <span className="text-sm font-semibold text-slate-700">Bekræft at du har postet</span>
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Tidspunkt for post</label>
                      <div className="flex gap-2">
                        <select
                          value={selectedHour}
                          onChange={(e) => setSelectedHour(e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={String(i).padStart(2, '0')}>
                              {String(i).padStart(2, '0')}
                            </option>
                          ))}
                        </select>
                        <select
                          value={selectedMinute}
                          onChange={(e) => setSelectedMinute(e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                          {['00', '15', '30', '45'].map((min) => (
                            <option key={min} value={min}>
                              {min}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={handleConfirmPosted}
                      disabled={confirmedPosted || isPosting}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {confirmedPosted ? '✓ Bekræftet' : 'Bekræft postet'}
                    </button>
                  </div>

                  <button
                    onClick={() => setShowManualPosting(false)}
                    className="w-full px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                  >
                    Tilbage
                  </button>
                </div>
              </div>
            </div>
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
