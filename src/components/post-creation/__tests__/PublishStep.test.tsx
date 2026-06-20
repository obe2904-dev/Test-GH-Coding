import { describe, expect, beforeEach, afterEach, vi, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublishStep } from '../PublishStep'
import type { PhotoContent, PostContent, TextAdjustments } from '../../../stores/postCreationStore'

vi.mock('../publish/useScheduleData', () => ({
  useScheduleData: () => ({ recentPosts: [], futurePosts: [] })
}))

vi.mock('../publish/ScheduleCalendarPicker', () => ({
  ScheduleCalendarPicker: () => <div data-testid="schedule-calendar" />
}))

const mockUsePostCreationStore = vi.fn()
const mockUseTierStore = vi.fn()

vi.mock('../../../stores/postCreationStore', () => ({
  usePostCreationStore: () => mockUsePostCreationStore()
}))

vi.mock('../../../stores/tierStore', () => ({
  useTierStore: () => mockUseTierStore()
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string, options?: any) => {
      if (defaultValue) {
        if (options?.platforms) {
          return defaultValue.replace('{platforms}', options.platforms)
        }
        return defaultValue
      }
      return _key
    },
    i18n: {
      language: 'en',
      getResource: (_language: string, _namespace: string, key: string) => {
        if (key === 'publish.monthNames') {
          return [
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
        }
        return undefined
      }
    }
  })
}))

const adjustments: TextAdjustments = {
  length: 'current',
  tone: 'friendly',
  includeHashtags: true,
  includeEmojis: false,
  includeBookingLink: false
}

const basePostContent: PostContent = {
  headline: 'Hello World',
  text: 'Post body',
  textWithHashtags: '#Post body',
  adjustments,
  platformSpecific: false
}

const basePhotoContent: PhotoContent = {
  uploadedMedia: [],
  selectedMedia: null,
  isOriginal: true,
  photoAdjustments: null,
  carouselMode: false,
}

const createProps = () => ({
  onNext: vi.fn(),
  onBack: vi.fn(),
  onStepClick: vi.fn()
})

const setupStores = () => {
  mockUsePostCreationStore.mockReturnValue({
    postContent: basePostContent,
    selectedPlatforms: ['facebook'],
    photoContent: basePhotoContent,
    photoIdea: ''
  })

  mockUseTierStore.mockReturnValue({
    canSchedulePost: () => true,
    incrementScheduledPost: vi.fn()
  })
}

beforeEach(() => {
  setupStores()
  Object.defineProperty(window, 'open', {
    writable: true,
    value: vi.fn()
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('PublishStep', () => {
  it('shows manual posting notice when platforms are not connected', () => {
    render(<PublishStep {...createProps()} />)

    expect(
      screen.getByText(/Kopiér manuelt til/i)
    ).toBeInTheDocument()
  })

  it('shows the selected timeline row by default', () => {
    render(<PublishStep {...createProps()} />)

    expect(screen.getByText('selected')).toBeInTheDocument()
    expect(screen.getByText('Hello World')).toBeInTheDocument()
    expect(screen.getByText('Post body')).toBeInTheDocument()
  })

  it('shows the fallback label for a restored draft without a suggested time', () => {
    render(
      <PublishStep
        {...createProps()}
        restoredDbDraft={{ suggestedPostDatetime: null }}
      />
    )

    expect(screen.getByText('Intet tidspunkt valgt')).toBeInTheDocument()
  })
})
