import { useMemo } from 'react'
import type { PostContent } from '../../../stores/postCreationStore'
import type { FuturePost, RecentPost, TimelineItem } from './ScheduleTimeline'
import { buildPlatformPreviewContent, normalizePlatformKey } from './utils'

const MAX_VISIBLE_RECENT_POSTS = 3
const MAX_VISIBLE_FUTURE_POSTS = 3

interface TimelineDependencies {
  recentPosts: RecentPost[]
  futurePosts: FuturePost[]
  selectedDate: Date | null
  selectedHour: string
  selectedMinute: string
  selectedDraftTitle?: string | null
  postContent: PostContent | null
  selectedPlatforms: string[]
}

export interface SelectedPlatformPreview {
  platform: string
  headline: string
  text: string
  textWithHashtags?: string
}

const buildSelectedTimelineItem = (
  selectedDate: Date,
  selectedHour: string,
  selectedMinute: string
): TimelineItem => {
  const dateWithTime = new Date(selectedDate)
  dateWithTime.setHours(parseInt(selectedHour, 10), parseInt(selectedMinute, 10))

  return {
    type: 'selected',
    id: 'selected',
    date: dateWithTime
  }
}

const toRecentItem = (post: RecentPost): TimelineItem => ({
  type: 'recent',
  id: post.id,
  date: post.date,
  post
})

const toFutureItem = (post: FuturePost): TimelineItem => ({
  type: 'future',
  id: post.id,
  date: post.date,
  post
})

const normalizeKey = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()

export const usePublishTimeline = ({
  recentPosts,
  futurePosts,
  selectedDate,
  selectedHour,
  selectedMinute,
  selectedDraftTitle,
  postContent,
  selectedPlatforms
}: TimelineDependencies) => {
  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = []

    const visibleRecentPosts = [...recentPosts]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, MAX_VISIBLE_RECENT_POSTS)

    const visibleFuturePosts = [...futurePosts]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, MAX_VISIBLE_FUTURE_POSTS)

    for (const post of visibleRecentPosts) {
      items.push(toRecentItem(post))
    }

    if (selectedDate) {
      const draftTitle = normalizeKey(selectedDraftTitle)
      const hasMatchingSavedPost =
        draftTitle.length > 0 &&
        [...visibleRecentPosts, ...visibleFuturePosts].some((post) => {
          const postTitle = normalizeKey(post.title)
          return postTitle === draftTitle && isSameDay(post.date, selectedDate)
        })

      if (!hasMatchingSavedPost) {
        items.push(buildSelectedTimelineItem(selectedDate, selectedHour, selectedMinute))
      }
    }

    for (const post of visibleFuturePosts) {
      items.push(toFutureItem(post))
    }

    return items.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [recentPosts, futurePosts, selectedDate, selectedHour, selectedMinute])

  const postPreview = useMemo(() => {
    if (!postContent) {
      return null
    }

    const normalizedSelections = selectedPlatforms
      .map((value) => normalizePlatformKey(value))
      .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)

    const previewPlatform = normalizedSelections.includes('facebook')
      ? 'facebook'
      : normalizedSelections[0] ?? 'facebook'

    return buildPlatformPreviewContent(postContent, previewPlatform, selectedPlatforms)
  }, [postContent, selectedPlatforms])

  const selectedPlatformPreviews = useMemo<SelectedPlatformPreview[]>(() => {
    if (!postContent) {
      return []
    }

    const normalizedSelections = selectedPlatforms
      .map((value) => normalizePlatformKey(value))
      .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)

    const platforms = normalizedSelections.length > 0 ? normalizedSelections : ['facebook']

    const previews = platforms.map((platform) => {
      const preview = buildPlatformPreviewContent(postContent, platform, selectedPlatforms)

      return {
        platform,
        headline: preview.headline,
        text: preview.text,
        textWithHashtags: preview.textWithHashtags,
      }
    })

    console.log('[usePublishTimeline] selectedPlatformPreviews:', {
      selectedPlatforms,
      normalizedSelections,
      platforms,
      previewsCount: previews.length,
      previews
    })

    return previews
  }, [postContent, selectedPlatforms])

  return { timelineItems, postPreview, selectedPlatformPreviews }
}