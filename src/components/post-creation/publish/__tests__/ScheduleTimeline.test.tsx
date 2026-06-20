import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScheduleTimeline, type TimelineItem } from '../ScheduleTimeline'

const translations: Record<string, string> = {
  'posts.status.published': 'Udgivet',
  'posts.status.scheduled': 'Planlagt',
  'posts.status.draft': 'Kladde',
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}))

describe('ScheduleTimeline', () => {
  it('renders recent and future posts with the shared post card layout', () => {
    const items: TimelineItem[] = [
      {
        type: 'recent',
        id: 'recent-1',
        date: new Date('2026-06-19T11:57:00Z'),
        post: {
          id: 'recent-1',
          date: new Date('2026-06-19T11:57:00Z'),
          title: 'Breakfast offer',
          platform: 'Facebook',
          time: 'fre. 19. jun. 11.57',
          engagement: { views: 0, likes: 0, comments: 0, shares: 0 },
        },
      },
      {
        type: 'future',
        id: 'future-1',
        date: new Date('2026-06-20T11:57:00Z'),
        post: {
          id: 'future-1',
          date: new Date('2026-06-20T11:57:00Z'),
          title: 'Tomorrow lunch',
          platform: 'Facebook',
          time: 'lør. 20. jun. 11.57',
          timeUntil: 'om 1 dag',
        },
      },
    ]

    render(
      <ScheduleTimeline
        items={items}
        selectedPlatforms={['facebook']}
        postPreview={null}
        locale="da-DK"
        isPlatformConnected={() => true}
        unconnectedPlatforms={[]}
        manualPostingRequiredLabel="Manual posting required"
      />
    )

    expect(screen.getByText('Udgivet')).toBeInTheDocument()
    expect(screen.getByText('Planlagt')).toBeInTheDocument()
    expect(screen.getByText('Udgivet')).toHaveClass('bg-green-100')
    expect(screen.getByText('Udgivet')).toHaveClass('text-green-700')
    expect(screen.getByText('Planlagt')).toHaveClass('bg-white')
    expect(screen.getByText('Planlagt')).toHaveClass('text-green-700')
    expect(screen.getByText('Planlagt')).toHaveClass('border')
    expect(screen.getByText('Planlagt')).toHaveClass('border-green-300')
    expect(screen.getByText('Breakfast offer')).toBeInTheDocument()
    expect(screen.getByText('Tomorrow lunch')).toBeInTheDocument()
    expect(screen.getByText('om 1 dag')).toBeInTheDocument()
  })
})