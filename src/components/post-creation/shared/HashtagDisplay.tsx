import { memo, useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { PlatformHashtag } from '../../../stores/postCreationStore'

type SupportedPlatform = 'facebook' | 'instagram'

interface HashtagDisplayProps {
  includeHashtags: boolean
  hashtags: string[]
  selectedHashtags: Set<string>
  onToggleHashtag: (tag: string) => void
  selectedPlatforms: SupportedPlatform[]
  platformHashtagViews?: Record<string, PlatformHashtag[]>
}

const PlatformBadge = ({ platform }: { platform: SupportedPlatform }) => {
  const gradientId = useId()

  if (platform === 'facebook') {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="12" fill="#1877F2" />
        <path
          d="M13.5 12.5V18H11V12.5H9V10H11V8.5C11 6.5 12 5.5 14 5.5H16V8H14.5C13.9 8 13.5 8.4 13.5 9V10H16L15.5 12.5H13.5Z"
          fill="white"
        />
      </svg>
    )
  }

  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F58529" />
          <stop offset="50%" stopColor="#DD2A7B" />
          <stop offset="100%" stopColor="#515BD4" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="12" fill={`url(#${gradientId})`} />
      <rect x="7" y="7" width="10" height="10" rx="2.5" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="2.5" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="white" />
    </svg>
  )
}

const HashtagChip = ({ tag, selected, onToggle }: { tag: string; selected: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className={`pointer-events-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
      selected ? 'bg-[#124044] border border-[#124044] text-[#88F2D7]' : 'bg-white border border-[#D1D5DB] text-[#374151]'
    }`}
  >
    <span>{selected ? '✓' : '×'}</span>
    <span>#{tag}</span>
  </button>
)

function HashtagDisplayComponent({
  includeHashtags,
  hashtags,
  selectedHashtags,
  onToggleHashtag,
  selectedPlatforms,
  platformHashtagViews
}: HashtagDisplayProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })

  if (!includeHashtags || hashtags.length === 0) {
    return null
  }

  const hasPlatformViews = platformHashtagViews && Object.keys(platformHashtagViews).length > 0

  const platformLabels: Record<SupportedPlatform, string> = {
    facebook: t('hashtagGroupFacebook', 'For Facebook'),
    instagram: t('hashtagGroupInstagram', 'For Instagram')
  }

  const renderPlatformView = (platform: SupportedPlatform, tags: PlatformHashtag[]) => {
    if (!tags || tags.length === 0) {
      return null
    }

    const normalizedTags: string[] = []
    const seen = new Set<string>()

    tags.forEach((item) => {
      const clean = item.tag.replace(/^#+/, '').trim()
      if (!clean || seen.has(clean)) {
        return
      }
      seen.add(clean)
      normalizedTags.push(clean)
    })

    if (normalizedTags.length === 0) {
      return null
    }

    return (
      <div key={platform} className="flex-1 min-w-[200px] space-y-1.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide whitespace-nowrap">
            {platformLabels[platform]}
          </span>
          <PlatformBadge platform={platform} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {normalizedTags.map((tag, idx) => (
            <HashtagChip
              key={`${platform}-${tag}-${idx}`}
              tag={tag}
              selected={selectedHashtags.has(tag)}
              onToggle={() => onToggleHashtag(tag)}
            />
          ))}
        </div>
      </div>
    )
  }

  if (hasPlatformViews && platformHashtagViews) {
    const orderedPlatforms = selectedPlatforms.length > 0
      ? selectedPlatforms
      : (Object.keys(platformHashtagViews) as SupportedPlatform[])

    return (
      <div className="flex flex-wrap gap-4">
        {orderedPlatforms.map((platform) => {
          if (platform !== 'facebook' && platform !== 'instagram') {
            return null
          }
          return renderPlatformView(platform, platformHashtagViews[platform] ?? [])
        })}
      </div>
    )
  }

  const hasFacebook = selectedPlatforms.includes('facebook')
  const hasInstagram = selectedPlatforms.includes('instagram')
  const both = hasFacebook && hasInstagram

  const mainHashtags = hashtags.slice(0, 3)
  const extraInstagramHashtags = hashtags.slice(3)

  const renderGroup = (
    title: string,
    platform: SupportedPlatform | 'both',
    tags: string[],
    offset = 0,
    containerClassName = ''
  ) => (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide whitespace-nowrap">
          {title}
        </span>
        {platform === 'both' ? (
          <div className="flex items-center gap-1">
            <PlatformBadge platform="facebook" />
            <PlatformBadge platform="instagram" />
          </div>
        ) : (
          <PlatformBadge platform={platform} />
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, idx) => (
          <HashtagChip
            key={`${tag}-${idx + offset}`}
            tag={tag}
            selected={selectedHashtags.has(tag)}
            onToggle={() => onToggleHashtag(tag)}
          />
        ))}
      </div>
    </div>
  )

  if (both) {
    return (
      <div className="flex flex-wrap gap-4">
        {mainHashtags.length > 0 &&
          renderGroup(
            t('hashtagGroupShared', 'Shared across platforms'),
            'both',
            mainHashtags,
            0,
            'flex-1 min-w-[200px]'
          )}
        {extraInstagramHashtags.length > 0 &&
          renderGroup(
            t('hashtagGroupInstagramExtra', 'Extra for Instagram'),
            'instagram',
            extraInstagramHashtags,
            3,
            'flex-1 min-w-[200px]'
          )}
      </div>
    )
  }

  if (hasFacebook) {
    return (
      <div className="flex flex-wrap gap-4">
        {renderGroup(t('hashtagGroupFacebook', 'For Facebook'), 'facebook', mainHashtags, 0, 'flex-1 min-w-[200px]')}
      </div>
    )
  }

  if (hasInstagram) {
    return (
      <div className="flex flex-wrap gap-4">
        {mainHashtags.length > 0 &&
          renderGroup(t('hashtagGroupInstagram', 'For Instagram'), 'instagram', mainHashtags, 0, 'flex-1 min-w-[200px]')}
        {extraInstagramHashtags.length > 0 &&
          renderGroup(
            t('hashtagGroupInstagramExtra', 'Extra for Instagram'),
            'instagram',
            extraInstagramHashtags,
            3,
            'flex-1 min-w-[200px]'
          )}
      </div>
    )
  }

  return null
}

export const HashtagDisplay = memo(HashtagDisplayComponent)