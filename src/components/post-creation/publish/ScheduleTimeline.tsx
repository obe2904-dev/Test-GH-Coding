import { Clock } from './icons'
import { PlatformIndicator } from './PlatformIndicator'
import { getPlatformLabel } from './utils'

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
  locale: string
  isPlatformConnected: (platform: string) => boolean
  unconnectedPlatforms: string[]
  manualPostingRequiredLabel: string
  selectedMediaUrl?: string
}

const HEADLINE_FALLBACK = 'Your New Post'

const renderThumbnail = (thumbnail?: string) => (
  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
    {thumbnail ? (
      <img src={thumbnail} alt="" className="w-full h-full object-cover" />
    ) : (
      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
        📷
      </div>
    )}
  </div>
)

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
  locale,
  isPlatformConnected,
  unconnectedPlatforms,
  manualPostingRequiredLabel,
  selectedMediaUrl
}: ScheduleTimelineProps) {
  return (
    <div className="space-y-2">
      {items.map((item) => {
        if (item.type === 'recent') {
          const post = item.post
          return (
            <div key={item.id} className="p-2 bg-white rounded-lg border border-slate-200">
              <div className="flex gap-2">
                {renderThumbnail(post.thumbnail)}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <PlatformIndicator
                      platform={post.platform}
                      isConnected={isPlatformConnected(post.platform)}
                    />
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                      published
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-900 mb-0.5 line-clamp-1">
                    {post.title}
                  </p>
                  <p className="text-xs text-slate-500 mb-1">{post.time}</p>
                  {renderEngagement(post.engagement)}
                </div>
              </div>
            </div>
          )
        }

        if (item.type === 'selected') {
          const hasUnconnected = unconnectedPlatforms.length > 0
          const formattedDate = formatSelectedMeta(item.date, locale)

          return (
            <div key="selected" className="p-2 bg-purple-50 rounded-lg border-2 border-purple-400">
              <div className="flex gap-2">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-purple-100 flex items-center justify-center flex-shrink-0">
                  {selectedMediaUrl ? (
                    <img src={selectedMediaUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-purple-500 text-lg">📍</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
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

                  <p className="text-xs font-bold text-purple-900 mb-0.5">
                    {renderSelectedTitle(postPreview)}
                  </p>
                  <p className="text-xs text-purple-700 mb-1">{formattedDate}</p>

                  {renderSelectedDescription(postPreview)}

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
            <div key={item.id} className="p-2 bg-white rounded-lg border border-slate-200">
              <div className="flex gap-2">
                {renderThumbnail(post.thumbnail)}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <PlatformIndicator
                      platform={post.platform}
                      isConnected={isPlatformConnected(post.platform)}
                    />
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                      scheduled
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-900 mb-0.5 line-clamp-1">
                    {post.title}
                  </p>
                  <p className="text-xs text-slate-500">{post.time}</p>

                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-2.5 h-2.5 text-slate-500" />
                    <span className="text-xs text-slate-600">{post.timeUntil}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        return null
      })}
    </div>
  )
}