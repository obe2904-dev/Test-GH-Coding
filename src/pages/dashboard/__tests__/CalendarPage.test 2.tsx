import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CalendarPage } from '../CalendarPage'

const translations: Record<string, string> = {
  'posts.status.published': 'Udgivet',
  'posts.status.scheduled': 'Planlagt',
  'posts.status.draft': 'Kladde',
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
    i18n: { language: 'da' },
  }),
}))

vi.mock('../../../hooks/useBusinessData', () => ({
  useBusinessData: () => ({
    business: { id: 'business-1', name: 'Test Business' },
  }),
}))

vi.mock('../../../hooks/usePublishedPosts', () => ({
  useAllPublishedPosts: () => ({
    posts: [
      {
        id: 'published-1',
        platform: 'Facebook',
        status: 'published',
        postedAt: new Date('2026-06-19T11:30:00.000Z'),
        scheduledFor: null,
        menuItemName: 'Breakfast offer',
        contentType: 'menu',
        photoUrl: 'https://example.com/published.jpg',
        postText: 'Published post text',
      },
      {
        id: 'scheduled-1',
        platform: 'Instagram',
        status: 'scheduled',
        postedAt: new Date('2026-06-20T08:00:00.000Z'),
        scheduledFor: new Date('2026-06-20T08:00:00.000Z'),
        menuItemName: 'Lunch special',
        contentType: 'menu',
        photoUrl: 'https://example.com/scheduled.jpg',
        postText: 'Scheduled post text',
      },
    ],
    isLoading: false,
    refresh: vi.fn(),
  }),
  useManualPostingCount: () => 0,
}))

vi.mock('../../../stores/connectionsStore', () => ({
  useConnectionsStore: () => ({
    isConnected: () => true,
  }),
}))

vi.mock('../../../components/post-creation/ScheduledPostModal', () => ({
  ScheduledPostModal: () => null,
}))

vi.mock('../../../components/calendar/SocialPreviewModal', () => ({
  SocialPreviewModal: () => null,
}))

afterEach(() => {
  vi.useRealTimers()
})

describe('CalendarPage', () => {
  it('uses the shared timeline card layout for calendar posts', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-19T12:00:00.000Z'))

    const { container } = render(<CalendarPage />)

    const publishedBadge = screen.getByText('Udgivet')
    const scheduledBadge = screen.getByText('Planlagt')

    expect(publishedBadge).toHaveClass('absolute')
    expect(publishedBadge).toHaveClass('top-2')
    expect(publishedBadge).toHaveClass('right-2')
    expect(publishedBadge).toHaveClass('bg-green-100')
    expect(publishedBadge).toHaveClass('text-green-700')

    expect(scheduledBadge).toHaveClass('absolute')
    expect(scheduledBadge).toHaveClass('top-2')
    expect(scheduledBadge).toHaveClass('right-2')
    expect(scheduledBadge).toHaveClass('bg-white')
    expect(scheduledBadge).toHaveClass('text-green-700')
    expect(scheduledBadge).toHaveClass('border')
    expect(scheduledBadge).toHaveClass('border-green-300')

    expect(screen.getByText('Breakfast offer')).toBeInTheDocument()
    expect(screen.getByText('Lunch special')).toBeInTheDocument()

    expect(container.querySelectorAll('.relative').length).toBeGreaterThan(0)
  })
})