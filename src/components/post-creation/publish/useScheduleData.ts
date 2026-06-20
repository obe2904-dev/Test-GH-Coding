import { useBusinessData } from '../../../hooks/useBusinessData'
import { usePublishedPostsTimeline } from '../../../hooks/usePublishedPosts'
import type { FuturePost, RecentPost } from './ScheduleTimeline'

interface UseScheduleDataResult {
  recentPosts: RecentPost[]
  futurePosts: FuturePost[]
  refresh: () => void
}

/**
 * Loads recent manually-confirmed posts from published_posts for the current
 * business. futurePosts is empty until automatic scheduling is implemented.
 */
export function useScheduleData(): UseScheduleDataResult {
  const { business } = useBusinessData()
  const { recentPosts, futurePosts, refresh } = usePublishedPostsTimeline(business?.id ?? null)

  return { recentPosts, futurePosts, refresh }
}
