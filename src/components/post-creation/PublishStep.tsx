import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { usePostCreationStore, type PlatformContent } from '../../stores/postCreationStore'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { useTierStore } from '../../stores/tierStore'
import { ManualPostModal } from './publish/ManualPostModal'
import { AiSuggestionGrid, type AiSuggestion } from './publish/AiSuggestionGrid'
import { PublishModeSelector, type PublishMode } from './publish/PublishModeSelector'
import { ScheduleCalendarPicker } from './publish/ScheduleCalendarPicker'
import { ScheduleTimeline } from './publish/ScheduleTimeline'
import { usePublishTimeline } from './publish/usePublishTimeline'
import { useScheduleData } from './publish/useScheduleData'
import { Calendar, Send, TrendingUp, ChevronLeft, ChevronRight, Sun, Users, Link2 } from './publish/icons'
import {
  formatPlatformList,
  getPlatformLabel,
  buildPlatformPreviewContent
} from './publish/utils.ts'
import { PostCreationFooter } from './shared/PostCreationFooter'

const DEFAULT_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

const DEFAULT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface PublishStepProps {
  onNext: () => void
  onBack: () => void
  onStepClick?: (step: number) => void
  markAsSaved?: () => void
  hasUnsavedChanges?: boolean
}

export function PublishStep({ onNext, onBack, markAsSaved, hasUnsavedChanges }: PublishStepProps) {
  const { t: tPublish, i18n } = useTranslation(undefined, { keyPrefix: 'createPost.publish' })
  const { postContent, selectedPlatforms, photoContent, photoIdea, selectedIdea, aiIdeas, weeklyPlanPost, postCta } = usePostCreationStore()
  const { isConnected } = useConnectionsStore()
  const { 
    canSchedulePost, 
    incrementScheduledPost
  } = useTierStore()

  // TODO: Replace placeholder schedule data hook once backend timeline API is wired up.
  const { recentPosts, futurePosts } = useScheduleData()

  const [publishMode, setPublishMode] = useState<PublishMode>('now')
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedHour, setSelectedHour] = useState<string>('14')
  const [selectedMinute, setSelectedMinute] = useState<string>('00')
  const [scheduleFromPlan, setScheduleFromPlan] = useState(false)

  // Pre-populate schedule from Weekly Plan timing (runs once on mount)
  useEffect(() => {
    if (!weeklyPlanPost?.timing?.date) return
    try {
      const [y, m, d] = weeklyPlanPost.timing.date.split('-').map(Number)
      // Parse time: handle "18:00", "18:00-21:00", "6 PM" formats
      let hour = 12
      let minute = 0
      const rawTime = weeklyPlanPost.timing.time || ''
      const timeMatch = rawTime.match(/(\d{1,2}):(\d{2})/)
      if (timeMatch) {
        hour = parseInt(timeMatch[1], 10)
        minute = parseInt(timeMatch[2], 10)
      } else {
        const hourOnlyMatch = rawTime.match(/(\d{1,2})\s*(am|pm)?/i)
        if (hourOnlyMatch) {
          hour = parseInt(hourOnlyMatch[1], 10)
          if (hourOnlyMatch[2]?.toLowerCase() === 'pm' && hour < 12) hour += 12
        }
      }
      const date = new Date(y, m - 1, d, hour, minute)
      if (!isNaN(date.getTime()) && date > new Date()) {
        setSelectedDate(date)
        setSelectedHour(String(hour).padStart(2, '0'))
        setSelectedMinute(String(minute).padStart(2, '0'))
        setPublishMode('schedule')
        setScheduleFromPlan(true)
      }
    } catch {
      // Silently ignore parse errors — user can pick manually
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [isPublishing, setIsPublishing] = useState(false)
  // const [schedulingConflicts, setSchedulingConflicts] = useState<string[]>([])
  const [showManualPostModal, setShowManualPostModal] = useState(false)
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null)

  // Find the selected AI idea to access CTA data
  const selectedAiIdea = useMemo(() => {
    if (selectedIdea && aiIdeas && aiIdeas.length > 0) {
      return aiIdeas.find(idea => idea.id === selectedIdea)
    }
    return null
  }, [selectedIdea, aiIdeas])

  const unconnectedPlatforms = useMemo(
    () => selectedPlatforms.filter((platform) => !isConnected(platform)),
    [selectedPlatforms, isConnected]
  )

  const isPlatformConnected = useCallback((platform: string) => isConnected(platform), [isConnected])

  const hasPersistedDraft = useMemo(() => {
    if (postContent) {
      const trimmedHeadline = (postContent.headline ?? '').trim()
      const trimmedText = (postContent.text ?? '').trim()

      if (trimmedHeadline.length > 0 || trimmedText.length > 0) {
        return true
      }

      if (postContent.platformSpecific && postContent.platformContent) {
        const hasPlatformContent = Object.values(postContent.platformContent as Record<string, PlatformContent>).some((content) => {
          const platformHeadline = (content.headline ?? '').trim()
          const platformText = (content.text ?? '').trim()
          return platformHeadline.length > 0 || platformText.length > 0
        })

        if (hasPlatformContent) {
          return true
        }
      }

      if (postContent.hashtags && postContent.hashtags.length > 0) {
        return true
      }
    }

    if (photoContent?.uploadedMedia && photoContent.uploadedMedia.length > 0) {
      return true
    }

    if (photoIdea && photoIdea.trim().length > 0) {
      return true
    }

    return false
  }, [postContent, photoContent, photoIdea])

  const handleSaveDraft = useCallback(() => {
    const snapshot = postContent

    if (!snapshot && (!photoContent || photoContent.uploadedMedia.length === 0) && (!photoIdea || photoIdea.trim().length === 0)) {
      return false
    }

    let serializablePhotoContent = null
    if (photoContent && photoContent.uploadedMedia.length > 0) {
      serializablePhotoContent = {
        ...photoContent,
        uploadedMedia: photoContent.uploadedMedia.map((media) => ({
          id: media.id,
          url: media.originalUrl || media.url,
          originalUrl: media.originalUrl,
          type: media.type,
          adjustedUrl: media.adjustedUrl,
          adjustments: media.adjustments,
          selectedVersionForPost: media.selectedVersionForPost,
          platformVariants: media.platformVariants,
        })),
      }
    }

    const draft = {
      timestamp: Date.now(),
      selectedPlatforms,
      postContent: snapshot,
      photoContent: serializablePhotoContent || photoContent,
      photoIdea,
    }

    try {
      localStorage.setItem('post2grow_draft_recovery', JSON.stringify(draft))
      markAsSaved?.()
      return true
    } catch (error) {
      console.error('Failed to persist draft:', error)
      return false
    }
  }, [postContent, photoContent, photoIdea, selectedPlatforms, markAsSaved])

  const monthNames = useMemo(() => {
    const resource = i18n.getResource(i18n.language, 'translation', 'publish.monthNames') as unknown

    if (Array.isArray(resource)) {
      const normalized = resource.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
      if (normalized.length === 12) {
        return normalized
      }
    }

    if (typeof resource === 'string') {
      const parts = resource.split(',').map((part) => part.trim()).filter(Boolean)
      if (parts.length === 12) {
        return parts
      }
    }

    return DEFAULT_MONTH_NAMES
  }, [i18n, i18n.language])

  const dayNames = useMemo(() => {
    const resource = i18n.getResource(i18n.language, 'translation', 'publish.dayNames') as unknown

    if (Array.isArray(resource)) {
      const normalized = resource.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
      if (normalized.length === 7) {
        return normalized
      }
    }

    if (typeof resource === 'string') {
      const parts = resource.split(',').map((part) => part.trim()).filter(Boolean)
      if (parts.length === 7) {
        return parts
      }
    }

    return DEFAULT_DAY_NAMES
  }, [i18n, i18n.language])

  const timeInterval = useMemo(() => {
    const resource = i18n.getResource(i18n.language, 'translation', 'publish.timeIntervalMinutes')
    const parsed = Number(resource)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30
  }, [i18n, i18n.language])

  // Helper function to format relative date/time
  const formatRelativeDateTime = useCallback((date: Date): string => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    
    if (targetDate.getTime() === today.getTime()) {
      return `${tPublish('today', 'Today')}, ${timeStr}`
    }

    if (targetDate.getTime() === tomorrow.getTime()) {
      return `${tPublish('tomorrow', 'Tomorrow')}, ${timeStr}`
    }

    const dayName = dayNames[date.getDay()]
    return `${dayName}, ${timeStr}`
  }, [dayNames, tPublish])

  const aiSuggestions = useMemo<AiSuggestion[]>(() => {
    const today6pm = new Date()
    today6pm.setHours(18, 0, 0, 0)

    const tomorrow10am = new Date()
    tomorrow10am.setDate(tomorrow10am.getDate() + 1)
    tomorrow10am.setHours(10, 0, 0, 0)

    const nextFriday = new Date()
    const daysUntilFriday = (5 - nextFriday.getDay() + 7) % 7 || 7
    nextFriday.setDate(nextFriday.getDate() + daysUntilFriday)
    nextFriday.setHours(12, 0, 0, 0)

    return [
      {
        id: 1,
        time: formatRelativeDateTime(today6pm),
        date: today6pm,
        reason: tPublish('suggestion1', 'Peak evening engagement'),
        expectedReach: 'High',
        icon: Sun,
        color: 'emerald'
      },
      {
        id: 2,
        time: formatRelativeDateTime(tomorrow10am),
        date: tomorrow10am,
        reason: tPublish('suggestion2', 'Morning coffee scroll time'),
        expectedReach: 'Medium',
        icon: Users,
        color: 'amber'
      },
      {
        id: 3,
        time: formatRelativeDateTime(nextFriday),
        date: nextFriday,
        reason: tPublish('suggestion3', 'Lunch break browsing'),
        expectedReach: 'High',
        icon: TrendingUp,
        color: 'emerald'
      }
    ]
  }, [formatRelativeDateTime, tPublish])

  const handleSuggestionClick = (suggestion: AiSuggestion) => {
    setSelectedSuggestion(suggestion.id)
    setSelectedDate(suggestion.date)
    const hoursString = suggestion.date.getHours().toString().padStart(2, '0')
    const minutesString = suggestion.date.getMinutes().toString().padStart(2, '0')
    setSelectedHour(hoursString)
    setSelectedMinute(minutesString)
  }

  // Get formatted content for platform
  const getFormattedContent = useCallback(
    (platform: string) => {
      const preview = buildPlatformPreviewContent(postContent, platform, selectedPlatforms)

      if (!preview) {
        return ''
      }

      const { headline, textWithHashtags } = preview
      
      // Build the base content
      let content = ''
      if (headline && textWithHashtags) {
        content = `${headline}\n\n${textWithHashtags}`
      } else if (headline) {
        content = headline
      } else {
        content = textWithHashtags
      }

      // For Facebook: Add CTA and booking URL from V2 API if available
      if (platform.toLowerCase() === 'facebook' && selectedAiIdea?._cta) {
        const cta = selectedAiIdea._cta
        
        // Add CTA text
        if (cta.text) {
          content += `\n\n${cta.text}`
        }
        
        // Add booking URL for Facebook (from V2 API response)
        if (cta.url) {
          content += `\n${cta.url}`
        }
      } else if (platform.toLowerCase() === 'facebook' && postCta?.url) {
        // Weekly-plan / generate-text-from-idea path: CTA text is already baked into the GPT
        // output, so only append the booking URL on a new line.
        content += `\n${postCta.url}`
      }

      return content
    },
    [postContent, selectedPlatforms, selectedAiIdea, postCta]
  )

  // Copy to clipboard
  const copyToClipboard = useCallback(async (platform: string) => {
    const content = getFormattedContent(platform)
    try {
      await navigator.clipboard.writeText(content)
      setCopiedPlatform(platform)
      setTimeout(() => setCopiedPlatform(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [getFormattedContent])

  // Download photo
  const downloadPhoto = async () => {
    if (!photoContent?.uploadedMedia?.[0]?.url) return
    
    try {
      const imageUrl = photoContent.uploadedMedia[0].url
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `post-photo-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download photo:', err)
    }
  }

  // Open platform
  const openPlatform = (platform: string) => {
    const urls = {
      Facebook: 'https://www.facebook.com',
      Instagram: 'https://www.instagram.com'
    }
    window.open(urls[platform as keyof typeof urls], '_blank')
  }

  // Handle connect platform
  const handleConnectPlatform = (platform: string) => {
    // In real app, this would trigger OAuth flow
    console.log('Connect platform:', platform)
    // Show the manual post modal which includes connection options
    setShowManualPostModal(true)
  }

  const handlePublish = useCallback(async () => {
    if (unconnectedPlatforms.length > 0) {
      setShowManualPostModal(true)
      return
    }

    if (publishMode === 'schedule' && !canSchedulePost()) {
      alert(tPublish('scheduleQuotaExceeded', 'Reached monthly limit'))
      return
    }

    setIsPublishing(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    console.log('Auto-posting to:', selectedPlatforms)
    if (publishMode === 'schedule') {
      incrementScheduledPost()
    }

    setIsPublishing(false)
    onNext()
  }, [
    unconnectedPlatforms,
    publishMode,
    canSchedulePost,
    tPublish,
    selectedPlatforms,
    incrementScheduledPost,
    onNext
  ])

  const selectedTime = useMemo(() => `${selectedHour}:${selectedMinute}`, [selectedHour, selectedMinute])

  const canPublish = publishMode === 'now' || (publishMode === 'schedule' && selectedDate && selectedTime)

  // Get locale for displaying dates - use current language (da-DK or en-GB) combined with date format preference
  const locale = useMemo(() => {
    const currentLang = i18n.language

    try {
      const prefs = localStorage.getItem('userPreferences')
      if (prefs) {
        const parsed = JSON.parse(prefs)
        const dateFormat = parsed?.dateFormat
        if (dateFormat === 'en-US') {
          return 'en-US'
        }
      }
    } catch (error) {
      console.error('Error reading date format preference:', error)
    }

    return currentLang === 'da' ? 'da-DK' : 'en-GB'
  }, [i18n.language])

  const { timelineItems, postPreview } = usePublishTimeline({
    recentPosts,
    futurePosts,
    selectedDate,
    selectedHour,
    selectedMinute,
    postContent,
    selectedPlatforms
  })

  const selectedMediaUrl = useMemo(() => {
    const media = photoContent?.uploadedMedia?.[0]
    if (!media) return null
    return media.adjustedUrl || media.url || media.originalUrl || null
  }, [photoContent])

  const unconnectedPlatformLabels = useMemo<string[]>(
    () => unconnectedPlatforms.map((platform) => getPlatformLabel(platform)),
    [unconnectedPlatforms]
  )

  const manualPostingRequiredLabel = useMemo(
    () => tPublish('manualPostingRequired', 'Manual post required'),
    [tPublish]
  )

  const publishNowLabel = useMemo(
    () => tPublish('publishNow', 'Publish Now'),
    [tPublish]
  )

  const publishNowSubtitle = useMemo(
    () =>
      unconnectedPlatforms.length > 0
        ? tPublish('manualPost', 'Manual post')
        : tPublish('postImmediately', 'Post immediately'),
    [tPublish, unconnectedPlatforms.length]
  )

  const scheduleLabel = useMemo(
    () => tPublish('schedule', 'Schedule'),
    [tPublish]
  )

  const scheduleSubtitle = useMemo(
    () =>
      unconnectedPlatforms.length > 0
        ? tPublish('scheduleManual', 'Schedule manual')
        : tPublish('bestTime', 'Best time'),
    [tPublish, unconnectedPlatforms.length]
  )

  const aiSuggestionsTitle = useMemo(
    () => tPublish('aiSuggestions', 'AI-Suggested Times'),
    [tPublish]
  )

  return (
    <div className="space-y-4">
      {/* No Platforms Selected - Show gentle prompt */}
      {selectedPlatforms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-6">
          <div className="max-w-md text-center">
            <div className="mb-4 text-6xl">📱</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Vælg dine sociale medier
            </h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Vælg dine sociale medier, så jeg kan vise den rigtige forhåndsvisning af dit opslag.
            </p>
            <button
              onClick={() => {
                // Navigate to business profile social media section
                window.location.href = '/dashboard/profile#social-media'
              }}
              className="px-6 py-3 bg-cta text-white rounded-lg text-sm font-semibold hover:bg-cta-hover transition-colors flex items-center gap-2 mx-auto"
            >
              <span>Vælg sociale medier</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Connection Notice (Gentle, at top) */}
          {unconnectedPlatforms.length > 0 && (
        <div className="p-3 bg-[#FEFCE8] rounded-lg border border-[#F6EBA5]">
          <div className="flex items-start gap-2">
            <Link2 className="w-4 h-4 text-[#8C6D1F] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-[#8C6D1F] mb-1">
                {tPublish('manualPosting', 'Manual Posting')}
              </p>
              <p className="text-xs text-[#8C6D1F] leading-relaxed mb-2">
                {tPublish('manualPostingDesc', "We'll prepare your content for copy-paste to {platforms}. Connect accounts anytime for automatic posting (it's free!).", {
                  platforms: formatPlatformList(unconnectedPlatforms)
                })}
              </p>
              <button 
                onClick={() => handleConnectPlatform(unconnectedPlatforms[0])}
                className="text-xs text-[#8C6D1F] font-medium hover:text-[#78350F] underline flex items-center gap-1"
              >
                {tPublish('continueToConnect', 'Continue to Copy Content')} →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Controls */}
      <div className="space-y-3">
        
        <PublishModeSelector
          mode={publishMode}
          onChange={setPublishMode}
          nowTitle={publishNowLabel}
          nowSubtitle={publishNowSubtitle}
          scheduleTitle={scheduleLabel}
          scheduleSubtitle={scheduleSubtitle}
        />

        {/* Schedule Options */}
        {publishMode === 'schedule' && (
          <div className="space-y-3">
            
            {/* AI Suggestions */}
            <AiSuggestionGrid
              suggestions={aiSuggestions}
              selectedId={selectedSuggestion}
              title={aiSuggestionsTitle}
              onSelect={handleSuggestionClick}
            />

            {/* Calendar with Timeline */}
            <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
              <div className="flex items-center gap-1.5 mb-3">
                <Calendar className="w-4 h-4 text-cta" />
                <h3 className="text-sm font-bold text-slate-800">
                  {tPublish('calendar', 'Calendar & Timeline')}
                </h3>
                {scheduleFromPlan && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold bg-cta-surface text-cta-text px-2 py-0.5 rounded-full">
                    📅 Fra ugeplanen
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* LEFT: Calendar & Time Selection */}
                <div>
                  <ScheduleCalendarPicker
                    selectedDate={selectedDate}
                    selectedHour={selectedHour}
                    selectedMinute={selectedMinute}
                    selectedTime={selectedTime}
                    timeInterval={timeInterval}
                    monthNames={monthNames}
                    dayNames={dayNames}
                    locale={locale}
                    selectTimeLabel={tPublish('selectTime', 'Time')}
                    hourLabel={tPublish('hour', 'Hour')}
                    minuteLabel={tPublish('minute', 'Min')}
                    timeInPastLabel={tPublish('timeInPast', 'Time is in the past')}
                    onSelectDate={(date) => setSelectedDate(date)}
                    onSelectHour={(hour) => setSelectedHour(hour)}
                    onSelectMinute={(minute) => setSelectedMinute(minute)}
                    onManualDateSelection={() => setSelectedSuggestion(null)}
                  />
                </div>

                {/* RIGHT: Posts Timeline */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-700">
                      {tPublish('postsTimeline', 'Posts Timeline')}
                    </p>
                    <p className="text-xs text-slate-500">
                      ⏰ {tPublish('chronological', 'Chronological')}
                    </p>
                  </div>
                  
                  <ScheduleTimeline
                    items={timelineItems}
                    selectedPlatforms={selectedPlatforms}
                    postPreview={postPreview}
                    locale={locale}
                    isPlatformConnected={isPlatformConnected}
                    unconnectedPlatforms={unconnectedPlatformLabels}
                    manualPostingRequiredLabel={manualPostingRequiredLabel}
                    selectedMediaUrl={selectedMediaUrl ?? undefined}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Separator line */}
      <div className="border-t border-[#D1D5DB] mt-4"></div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 pb-4 gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{tPublish('back', 'Tilbage')}</span>
        </button>

        <PostCreationFooter
          hasUnsavedChanges={Boolean(hasUnsavedChanges)}
          hasPersistedDraft={hasPersistedDraft}
          onSaveDraft={handleSaveDraft}
          onNext={handlePublish}
          renderNextButton={({ onNext }) => (
            <button
              onClick={onNext}
              disabled={!canPublish || isPublishing}
              className="px-6 py-2 bg-brand text-mint rounded-lg hover:bg-[#12393D] transition-all font-bold text-xs shadow-md flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPublishing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{unconnectedPlatforms.length > 0 ? 'Preparing...' : publishMode === 'now' ? 'Publishing...' : 'Scheduling...'}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    {unconnectedPlatforms.length > 0
                      ? tPublish('prepareManualPost', 'Forbered manual post')
                      : publishMode === 'now'
                        ? tPublish('publishNowCta', 'Udgiv opslag')
                        : tPublish('schedulePost', 'Planlæg opslag')}
                  </span>
                </>
              )}
            </button>
          )}
        />
      </div>

      <ManualPostModal
        isOpen={showManualPostModal && unconnectedPlatforms.length > 0}
        platforms={unconnectedPlatforms}
        photoContent={photoContent}
        copiedPlatform={copiedPlatform}
        t={tPublish}
        onClose={() => setShowManualPostModal(false)}
        onComplete={() => {
          setShowManualPostModal(false)
          onNext()
        }}
        onConnectPlatform={handleConnectPlatform}
        downloadPhoto={downloadPhoto}
        copyToClipboard={copyToClipboard}
        openPlatform={openPlatform}
        getFormattedContent={getFormattedContent}
      />
        </>
      )}
    </div>
  )
}
