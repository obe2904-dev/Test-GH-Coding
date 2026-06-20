import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Calendar, Clock, Trash2, Sparkles } from './publish/icons'
import { getScheduledPostById, deletePublishedPost, updatePublishedPost, type ScheduledPostDetails } from '../../hooks/usePublishedPosts'
import { PlatformIndicator } from './publish/PlatformIndicator'
import { useBusinessData } from '../../hooks/useBusinessData'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { ManualPostModal } from './publish/ManualPostModal'

interface ScheduledPostModalProps {
  postId: string
  isOpen: boolean
  onClose: () => void
  onDeleted?: () => void
  onUpdated?: () => void
}

export function ScheduledPostModal({ postId, isOpen, onClose, onDeleted, onUpdated }: ScheduledPostModalProps) {
  const { t } = useTranslation()
  const { business } = useBusinessData()
  const { isConnected } = useConnectionsStore()
  const [post, setPost] = useState<ScheduledPostDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showTimeEdit, setShowTimeEdit] = useState(false)
  const [showManualPostModal, setShowManualPostModal] = useState(false)
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedHour, setSelectedHour] = useState<string>('14')
  const [selectedMinute, setSelectedMinute] = useState<string>('00')
  const [isSaving, setIsSaving] = useState(false)
  
  // Manual post callbacks
  const downloadPhoto = async () => {
    if (!post?.photoUrl) return
    const link = document.createElement('a')
    link.href = post.photoUrl
    link.download = 'post-image.jpg'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const copyToClipboard = async (platform: string) => {
    if (!post?.postText) return
    await navigator.clipboard.writeText(post.postText)
    setCopiedPlatform(platform)
    setTimeout(() => setCopiedPlatform(null), 2000)
  }

  const openPlatform = (platform: string) => {
    const urls: Record<string, string> = {
      facebook: 'https://www.facebook.com/',
      instagram: 'https://www.instagram.com/'
    }
    window.open(urls[platform.toLowerCase()] || urls.facebook, '_blank')
  }

  const getFormattedContent = (platform: string) => {
    return post?.postText || ''
  }

  const onConfirmPosted = async (platform: string, postedAt: Date) => {
    // Update post status to published
    const { error } = await updatePublishedPost(postId, {
      status: 'published',
      postedAt: postedAt
    })
    
    if (!error) {
      console.log('[ScheduledPostModal] Post marked as published:', postId)
      // Refresh parent and close modal
      onUpdated?.()
      setShowManualPostModal(false)
      setTimeout(() => {
        onClose()
      }, 500)
    } else {
      console.error('[ScheduledPostModal] Failed to update post status:', error)
      alert('Kunne ikke opdatere opslag status. Prøv igen.')
    }
  }

  const onConnectPlatform = (platform: string) => {
    // Navigate to connections page or show connection modal
    console.log('Connect platform:', platform)
  }

  // Load post data when modal opens
  useEffect(() => {
    if (!isOpen) return
    
    const loadPost = async () => {
      setIsLoading(true)
      const { data, error } = await getScheduledPostById(postId)
      if (data && !error) {
        setPost(data)
        setSelectedDate(data.scheduledFor)
        setSelectedHour(String(data.scheduledFor.getHours()).padStart(2, '0'))
        setSelectedMinute(String(data.scheduledFor.getMinutes()).padStart(2, '0'))
      } else {
        console.error('[ScheduledPostModal] Failed to load post:', error)
      }
      setIsLoading(false)
    }
    
    loadPost()
  }, [isOpen, postId])

  const handleDelete = async () => {
    if (!confirm('Er du sikker på at du vil slette dette planlagte opslag?')) return
    
    console.log('[ScheduledPostModal] Starting delete process:', { 
      postId, 
      currentBusinessId: business?.id,
      postBusinessId: post?.businessId,
      businessMatch: business?.id === post?.businessId,
      hasPost: !!post,
      hasBusiness: !!business
    })
    
    if (!post) {
      console.error('[ScheduledPostModal] Cannot delete - post data not loaded yet')
      alert('Vent venligst mens opslaget indlæses...')
      return
    }
    
    if (!business?.id) {
      console.error('[ScheduledPostModal] Cannot delete - no business context')
      alert('Ingen virksomhed valgt')
      return
    }
    
    setIsDeleting(true)
    const { error, deleted } = await deletePublishedPost(postId, business.id)
    setIsDeleting(false)
    
    console.log('[ScheduledPostModal] Delete result:', { error, deleted })
    
    if (deleted && !error) {
      console.log('[ScheduledPostModal] Delete successful, calling onDeleted callback')
      onDeleted?.()
      onClose()
    } else {
      console.error('[ScheduledPostModal] Delete failed:', error)
      alert(error || 'Kunne ikke slette opslaget. Prøv igen.')
    }
  }

  const handleSaveTime = async () => {
    if (!selectedDate) return
    
    const newScheduledTime = new Date(selectedDate)
    newScheduledTime.setHours(parseInt(selectedHour), parseInt(selectedMinute), 0, 0)
    
    if (newScheduledTime < new Date()) {
      alert('Du kan ikke planlægge et opslag i fortiden.')
      return
    }
    
    setIsSaving(true)
    const { error } = await updatePublishedPost(postId, {
      postedAt: newScheduledTime,
      status: 'scheduled',
      scheduledFor: newScheduledTime,
    })
    setIsSaving(false)
    
    if (!error) {
      setPost(prev => prev ? { ...prev, scheduledFor: newScheduledTime } : null)
      setShowTimeEdit(false)
      onUpdated?.()
    } else {
      alert('Kunne ikke opdatere tiden. Prøv igen.')
    }
  }

  if (!isOpen) return null

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('da-DK', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Planlagt opslag</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Luk"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">
              Indlæser...
            </div>
          ) : !post ? (
            <div className="text-center py-8 text-red-500">
              Kunne ikke indlæse opslaget
            </div>
          ) : (
            <div className="space-y-6">
              {/* Platform */}
              <div>
                <PlatformIndicator 
                  platform={post.platform.charAt(0).toUpperCase() + post.platform.slice(1)} 
                  isConnected={true}
                />
              </div>

              {/* Photo */}
              {post.photoUrl && (
                <div className="rounded-lg overflow-hidden bg-slate-100">
                  <img 
                    src={post.photoUrl} 
                    alt="Post preview" 
                    className="w-full h-auto max-h-96 object-contain"
                  />
                </div>
              )}

              {/* Caption */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Tekst</h3>
                <p className="text-slate-800 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-200">
                  {post.postText || '(Ingen tekst)'}
                </p>
              </div>

              {/* Scheduled Time */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-900 mb-1">
                      Planlagt til
                    </h3>
                    <p className="text-sm text-blue-800">
                      {formatDateTime(post.scheduledFor)}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Manual Posting Warning */}
              {!isConnected(post.platform.toLowerCase()) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-amber-600 text-xl flex-shrink-0">⚠️</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-amber-900 mb-1">
                        Manuel posting påkrævet
                      </h3>
                      <p className="text-sm text-amber-800">
                        {post.platform} er ikke tilsluttet. Du skal kopiere indholdet og poste det manuelt.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Suggested Time (if available) */}
              {post.suggestedPostTime && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-purple-900">
                        AI anbefalede kl. {post.suggestedPostTime}
                      </p>
                      <p className="text-xs text-purple-700">
                        Optimalt tidspunkt for engagement
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Time Edit Section */}
              {showTimeEdit && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800">Vælg nyt tidspunkt</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Date Picker */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Dato</label>
                      <input
                        type="date"
                        value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => setSelectedDate(new Date(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    
                    {/* Time Pickers */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Time</label>
                        <select
                          value={selectedHour}
                          onChange={(e) => setSelectedHour(e.target.value)}
                          className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={String(i).padStart(2, '0')}>
                              {String(i).padStart(2, '0')}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Min</label>
                        <select
                          value={selectedMinute}
                          onChange={(e) => setSelectedMinute(e.target.value)}
                          className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                          {['00', '15', '30', '45'].map((min) => (
                            <option key={min} value={min}>
                              {min}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveTime}
                      disabled={isSaving}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSaving ? 'Gemmer...' : 'Gem nyt tidspunkt'}
                    </button>
                    <button
                      onClick={() => setShowTimeEdit(false)}
                      disabled={isSaving}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold text-sm hover:bg-slate-300 disabled:opacity-50 transition-colors"
                    >
                      Annuller
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!showTimeEdit && (
                <div className="space-y-3">
                  {/* Publish Now & Change Time (for all platforms) */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowManualPostModal(true)}
                      className={`flex-1 px-4 py-3 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                        isConnected(post.platform.toLowerCase())
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      {isConnected(post.platform.toLowerCase()) 
                        ? '🚀 Udgiv Nu' 
                        : '📋 Post nu (Manuel)'}
                    </button>
                    <button
                      onClick={() => setShowTimeEdit(true)}
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      Skift tidspunkt
                    </button>
                  </div>
                  
                  {/* Delete Action */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {isDeleting ? 'Sletter...' : 'Slet opslag'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Manual Post Modal */}
      {post && showManualPostModal && (
        <ManualPostModal
          isOpen={showManualPostModal}
          platforms={[post.platform.toLowerCase()]}
          photoContent={post.photoUrl ? {
            uploadedMedia: [{ url: post.photoUrl, type: 'image' }]
          } : null}
          copiedPlatform={copiedPlatform}
          t={t}
          onClose={() => setShowManualPostModal(false)}
          onComplete={() => {
            setShowManualPostModal(false)
            onClose()
          }}
          onConnectPlatform={onConnectPlatform}
          downloadPhoto={downloadPhoto}
          copyToClipboard={copyToClipboard}
          openPlatform={openPlatform}
          getFormattedContent={getFormattedContent}
          onConfirmPosted={onConfirmPosted}
        />
      )}
    </div>
  )
}
