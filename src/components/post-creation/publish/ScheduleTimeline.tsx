import { useTranslation } from 'react-i18next'
import { PostFrame, type Platform, type PostStatus } from './PostFrame'
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
  onSelectedPostClick?: () => void  // New: Opens modal for draft post actions
}

const HEADLINE_FALLBACK = 'Your New Post'

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

const getSelectedPostText = (preview: SelectedPostPreview | null): string => {
  if (!preview) {
    return ''
  }
  return (preview.textWithHashtags || preview.text || '').trim()
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
  onSelectedPostClick,  // New callback for draft/selected posts
}: ScheduleTimelineProps) {
  const { t } = useTranslation()

  // Helper to normalize platform names to match PostFrame Platform type
  const normalizePlatform = (platform: string): Platform => {
    const lower = platform.toLowerCase()
    if (lower.includes('facebook')) return 'facebook'
    if (lower.includes('instagram')) return 'instagram'
    return 'facebook' // default fallback
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        if (item.type === 'recent') {
          const post = item.post
          return (
            <PostFrame
              key={item.id}
              id={String(item.id)}
              platform={normalizePlatform(post.platform)}
              status="udgivet"
              headline={post.title}
              text={post.snippet || post.title}
              photoUrl={post.thumbnail}
              scheduledAt={post.date.toISOString()}
              onClick={() => {
                // Could open a modal with full post details
                console.log('Clicked published post:', item.id)
              }}
              engagement={post.engagement}
            />
          )
        }

        if (item.type === 'selected') {
          const hasPlatformSplit = (selectedPlatformPreviews?.length ?? 0) > 1

          // Render separate frames for each platform when split
          if (hasPlatformSplit && selectedPlatformPreviews) {
            return (
              <div key="selected" className="space-y-2">
                {selectedPlatformPreviews.map((preview) => (
                  <PostFrame
                    key={`selected-${preview.platform}`}
                    id="selected"
                    platform={normalizePlatform(preview.platform)}
                    status="udkast"
                    headline={preview.headline || renderSelectedTitle(postPreview)}
                    text={preview.textWithHashtags || preview.text || getSelectedPostText(postPreview)}
                    photoUrl={selectedMediaUrl}
                    scheduledAt={item.date.toISOString()}
                    onClick={() => onSelectedPostClick?.()}
                    isSelected={true}
                  />
                ))}
              </div>
            )
          }

          // Single platform - render single frame
          return (
            <PostFrame
              key="selected"
              id="selected"
              platform={normalizePlatform(selectedPlatforms[0] || 'facebook')}
              status="udkast"
              headline={renderSelectedTitle(postPreview)}
              text={getSelectedPostText(postPreview)}
              photoUrl={selectedMediaUrl}
              scheduledAt={item.date.toISOString()}
              onClick={() => onSelectedPostClick?.()}
              isSelected={true}
            />
          )
        }

        if (item.type === 'future') {
          const post = item.post
          return (
            <PostFrame
              key={item.id}
              id={String(item.id)}
              platform={normalizePlatform(post.platform)}
              status="planlagt"
              headline={post.title}
              text={post.snippet || post.title}
              photoUrl={post.thumbnail}
              scheduledAt={post.date.toISOString()}
              onClick={() => onScheduledPostClick?.(item.id)}
            />
          )
        }

        return null
      })}
    </div>
  )
}