import { useMemo } from 'react'
import type { PostContent } from '../../../stores/postCreationStore'
import type { FuturePost, RecentPost, TimelineItem } from './ScheduleTimeline'
import { buildPlatformPreviewContent, normalizePlatformKey } from './utils'

interface TimelineDependencies {
  recentPosts: RecentPost[]
  futurePosts: FuturePost[]
  selectedDate: Date | null
  selectedHour: string
  selectedMinute: string
  postContent: PostContent | null
  selectedPlatforms: string[]
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

export const usePublishTimeline = ({
  recentPosts,
  futurePosts,
  selectedDate,
  selectedHour,
  selectedMinute,
  postContent,
  selectedPlatforms
}: TimelineDependencies) => {
  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = []

    for (const post of recentPosts) {
      items.push(toRecentItem(post))
    }

    if (selectedDate) {
      items.push(buildSelectedTimelineItem(selectedDate, selectedHour, selectedMinute))
    }

    for (const post of futurePosts) {
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

  return { timelineItems, postPreview }
}