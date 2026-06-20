import { useTranslation } from 'react-i18next'
import { Clock } from './icons'
import { PlatformIndicator } from './PlatformIndicator'
import { getPlatformLabel } from './utils'
import { TimelinePostCard } from './TimelinePostCard'

export interface EngagementMetrics {
  views: number
  likes: number
  comments: number
  shares: number
}

export interface RecentPost {
  id: string | number
  date: Date
  title: string
  platform: string
  time: string
  snippet?: string
  engagement: EngagementMetrics
  thumbnail?: string
}

export interface FuturePost {
  id: string | number
  date: Date
  title: string
  platform: string
  time: string
  snippet?: string
  timeUntil: string
  thumbnail?: string
}

export interface SelectedPostPreview {
  headline: string
  text: string
  textWithHashtags?: string
}

interface TimelineItemRecent {
  type: 'recent'
  id: string | number
  date: Date
  post: RecentPost
}

interface TimelineItemSelected {
  type: 'selected'
  id: 'selected'
  date: Date
}

interface TimelineItemFuture {
  type: 'future'
  id: string | number
  date: Date
  post: FuturePost
}

export type TimelineItem = TimelineItemRecent | TimelineItemSelected | TimelineItemFuture

interface ScheduleTimelineProps {
  items: TimelineItem[]
  selectedPlatforms: string[]
  postPreview: SelectedPostPreview | null
  selectedPlatformPreviews?: Array<{
    platform: string
    headline: string
    text: string
    textWithHashtags?: string
  }>
  locale: string
  isPlatformConnected: (platform: string) => boolean
  unconnectedPlatforms: string[]
  manualPostingRequiredLabel: string
  selectedMediaUrl?: string
  onPublishNow?: () => void
  onSave?: () => void
  isPublishing?: boolean
  canSave?: boolean
  saveDisabledReason?: string
  saveLabel?: string
  publishNowLabel?: string
  onScheduledPostClick?: (postId: string | number) => void
}

const HEADLINE_FALLBACK = 'Your New Post'

const renderEngagement = (metrics: EngagementMetrics) => (
  <div className="flex gap-3 text-xs text-slate-600">
    <span>👁 {metrics.views}</span>
    <span>❤️ {metrics.likes}</span>
    <span>💬 {metrics.comments}</span>
    <span>↗️ {metrics.shares}</span>
  </div>
)

const renderSelectedTitle = (postPreview: SelectedPostPreview | null) => {
  if (!postPreview) {
    return HEADLINE_FALLBACK
  }

  const { headline, textWithHashtags, text } = postPreview

  if (headline && headline.trim().length > 0) {
    return headline
  }

  const content = textWithHashtags || text

  if (!content) {
    return HEADLINE_FALLBACK
  }

  const trimmed = content.trim()
  if (trimmed.length <= 50) {
    return trimmed
  }

  return `${trimmed.substring(0, 50)}...`
}

const formatSelectedMeta = (date: Date, locale: string) => {
  const datePart = date.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric'
  })
  const timePart = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${datePart} ${timePart}`
}

const renderSelectedDescription = (preview: SelectedPostPreview | null) => {
  if (!preview) {
    return null
  }

  const content = preview.textWithHashtags || preview.text

  if (!content) {
    return null
  }

  return (
    <p className="text-xs text-slate-700 line-clamp-1">{content}</p>
  )
}

export function ScheduleTimeline({
  items,
  selectedPlatforms,
  postPreview,
  selectedPlatformPreviews,
  locale,
  isPlatformConnected,
  unconnectedPlatforms,
  manualPostingRequiredLabel,
  selectedMediaUrl,
  onPublishNow,
  onSave,
  isPublishing,
  canSave,
  saveDisabledReason,
  saveLabel,
  publishNowLabel,
  onScheduledPostClick,
}: ScheduleTimelineProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      {items.map((item) => {
        if (item.type === 'recent') {
          const post = item.post
          return (
            <TimelinePostCard
              key={item.id}
              platform={post.platform}
              isConnected={isPlatformConnected(post.platform)}
              statusLabel={t('posts.status.published')}
              statusClassName="bg-green-100 text-green-700"
              title={post.title}
              time={post.time}
              thumbnail={post.thumbnail}
            >
              {renderEngagement(post.engagement)}
            </TimelinePostCard>
          )
        }

        if (item.type === 'selected') {
          const hasUnconnected = unconnectedPlatforms.length > 0
          const formattedDate = formatSelectedMeta(item.date, locale)
          const hasPlatformSplit = (selectedPlatformPreviews?.length ?? 0) > 1

          console.log('[ScheduleTimeline] selected item rendering:', {
            selectedPlatformPreviewsLength: selectedPlatformPreviews?.length,
            hasPlatformSplit,
            selectedPlatforms,
            selectedPlatformPreviews
          })

          // Render separate frames for each platform when split
          if (hasPlatformSplit) {
            return (
              <div key="selected" className="space-y-2">
                {(selectedPlatformPreviews ?? []).map((preview, index) => {
                  const platformName = getPlatformLabel(preview.platform)
                  const isFirstFrame = index === 0
                  
                  return (
                    <div key={preview.platform} className="p-2 bg-purple-50 rounded-lg border-2 border-purple-400">
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <PlatformIndicator
                                platform={platformName}
                                isConnected={isPlatformConnected(preview.platform)}
                              />
                              <span className="text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded font-bold">
                                selected
                              </span>
                            </div>

                            {/* Show action buttons only on first frame */}
                            {isFirstFrame && (onSave && onPublishNow ? (
                              <div className="flex-shrink-0 grid grid-cols-2 gap-1.5 min-w-[180px]">
                                <button
                                  onClick={onPublishNow}
                                  disabled={isPublishing}
                                  className="px-2.5 py-1 bg-purple-600 text-white text-[11px] font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                >
                                  {isPublishing ? (
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <span>⚡</span>
                                  )}
                                  <span>{publishNowLabel ?? 'Udgiv nu'}</span>
                                </button>
                                <button
                                  onClick={onSave}
                                  disabled={!canSave || isPublishing}
                                  title={!canSave ? saveDisabledReason : undefined}
                                  className="px-2.5 py-1 bg-purple-600 text-white text-[11px] font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                >
                                  {isPublishing ? (
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <span>💾</span>
                                  )}
                                  <span>{saveLabel ?? 'Planlæg'}</span>
                                </button>
                              </div>
                            ) : onSave ? (
                              <button
                                onClick={onSave}
                                disabled={!canSave || isPublishing}
                                className="flex-shrink-0 px-2.5 py-1 bg-purple-600 text-white text-[11px] font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                              >
                                {isPublishing ? (
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <span>💾</span>
                                )}
                                <span>{saveLabel ?? 'Gem'}</span>
                              </button>
                            ) : null)}
                          </div>

                          <p className="text-xs font-bold text-purple-900 mb-0.5">
                            {preview.headline && preview.headline.trim().length > 0
                              ? preview.headline
                              : renderSelectedTitle(postPreview)}
                          </p>
                          <p className="text-[11px] text-purple-700 mb-1 line-clamp-2">
                            {(preview.textWithHashtags || preview.text || '').trim() || renderSelectedDescription(postPreview)}
                          </p>

                          {isFirstFrame && !canSave && saveDisabledReason && (
                            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                              <span>⏰</span> {saveDisabledReason}
                            </p>
                          )}

                          {isFirstFrame && hasUnconnected && (
                            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                              <span>⚠️</span> {manualPostingRequiredLabel}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }

          // Single platform - render single frame
          return (
            <div key="selected" className="p-2 bg-purple-50 rounded-lg border-2 border-purple-400">
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedPlatforms.map((platform) => {
                        const platformName = getPlatformLabel(platform)
                        return (
                          <PlatformIndicator
                            key={platform}
                            platform={platformName}
                            isConnected={isPlatformConnected(platformName)}
                          />
                        )
                      })}
                      <span className="text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded font-bold">
                        selected
                      </span>
                    </div>

                    {/* Top-right actions — publish now + schedule */}
                    {onSave && onPublishNow ? (
                      <div className="flex-shrink-0 grid grid-cols-2 gap-1.5 min-w-[180px]">
                        <button
                          onClick={onPublishNow}
                          disabled={isPublishing}
                          className="px-2.5 py-1 bg-purple-600 text-white text-[11px] font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                          {isPublishing ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <span>⚡</span>
                          )}
                          <span>{publishNowLabel ?? 'Udgiv nu'}</span>
                        </button>
                        <button
                          onClick={onSave}
                          disabled={!canSave || isPublishing}
                          title={!canSave ? saveDisabledReason : undefined}
                          className="px-2.5 py-1 bg-purple-600 text-white text-[11px] font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                          {isPublishing ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <span>💾</span>
                          )}
                          <span>{saveLabel ?? 'Planlæg'}</span>
                        </button>
                      </div>
                    ) : onSave && (
                      <button
                        onClick={onSave}
                        disabled={!canSave || isPublishing}
                        className="flex-shrink-0 px-2.5 py-1 bg-purple-600 text-white text-[11px] font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {isPublishing ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span>💾</span>
                        )}
                        <span>{saveLabel ?? 'Gem'}</span>
                      </button>
                    )}
                  </div>

                  <p className="text-xs font-bold text-purple-900 mb-0.5">
                    {renderSelectedTitle(postPreview)}
                  </p>
                  <p className="text-xs text-purple-700 mb-1">{formattedDate}</p>

                  {renderSelectedDescription(postPreview)}

                  {!canSave && saveDisabledReason && (
                    <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                      <span>⏰</span> {saveDisabledReason}
                    </p>
                  )}

                  {hasUnconnected && (
                    <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                      <span>⚠️</span> {manualPostingRequiredLabel}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        }

        if (item.type === 'future') {
          const post = item.post
          return (
            <TimelinePostCard
              key={item.id} 
              platform={post.platform}
              isConnected={isPlatformConnected(post.platform)}
              statusLabel={t('posts.status.scheduled')}
              statusClassName="bg-white text-green-700 border border-green-300"
              title={post.title}
              time={post.time}
              thumbnail={post.thumbnail}
              onClick={() => onScheduledPostClick?.(item.id)}
            >
              <div className="flex items-center gap-1 mt-1">
                <Clock className="w-2.5 h-2.5 text-slate-500" />
                <span className="text-xs text-slate-600">{post.timeUntil}</span>
              </div>
            </TimelinePostCard>
          )
        }

        return null
      })}
    </div>
  )
}