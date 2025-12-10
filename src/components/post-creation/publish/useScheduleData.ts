import { useMemo } from 'react'
import type { FuturePost, RecentPost } from './ScheduleTimeline'

interface UseScheduleDataResult {
  recentPosts: RecentPost[]
  futurePosts: FuturePost[]
}

/**
 * Temporary data hook while the scheduling API is unavailable.
 * Replace the hard-coded lists with a real data fetch once backend wiring is ready.
 */
export function useScheduleData(): UseScheduleDataResult {
  const recentPosts = useMemo<RecentPost[]>(
    () => [
      {
        id: 1,
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        time: '2 hours ago',
        title: 'Summer sale announcement',
        platform: 'Facebook',
        snippet: 'Check out our amazing summer deals...',
        engagement: { views: 1540, likes: 127, comments: 23, shares: 8 },
        thumbnail:
          'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=100&h=100&fit=crop'
      },
      {
        id: 2,
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        time: '5 hours ago',
        title: 'New menu items',
        platform: 'Instagram',
        snippet: 'Introducing our fresh seasonal menu...',
        engagement: { views: 2840, likes: 342, comments: 45, shares: 12 },
        thumbnail:
          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop'
      }
    ],
    []
  )

  const futurePosts = useMemo<FuturePost[]>(
    () => [
      {
        id: 3,
        date: new Date(Date.now() + 18 * 60 * 60 * 1000),
        time: 'Tomorrow, 16:00',
        title: 'Weekend special offer',
        platform: 'Facebook',
        snippet: 'Limited time weekend promo...',
        timeUntil: 'in 18 hours',
        thumbnail:
          'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=100&h=100&fit=crop'
      },
      {
        id: 4,
        date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        time: 'Friday, 12:00',
        title: 'Weekly highlights',
        platform: 'Instagram',
        snippet: "This week's best moments...",
        timeUntil: 'in 4 days',
        thumbnail:
          'https://images.unsplash.com/photo-1611095790444-1dfa35e37b52?w=100&h=100&fit=crop'
      }
    ],
    []
  )

  return { recentPosts, futurePosts }
}
