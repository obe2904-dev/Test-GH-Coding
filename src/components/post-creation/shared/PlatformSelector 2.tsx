import type { Tier } from '../../../stores/tierStore'
import { memo, useId } from 'react'

type SupportedPlatform = 'facebook' | 'instagram'

interface PlatformSelectorProps {
  currentTier: Tier
  selectedPlatforms: string[]
  onSelectPlatforms: (platforms: string[]) => void
  activePlatform: string
  onActivePlatformChange?: (platform: string) => void
  availablePlatforms?: SupportedPlatform[]
}

const SUPPORTED_PLATFORMS: SupportedPlatform[] = ['facebook', 'instagram']

const FacebookIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#1877F2" />
    <path
      d="M13.5 12.5V18H11V12.5H9V10H11V8.5C11 6.5 12 5.5 14 5.5H16V8H14.5C13.9 8 13.5 8.4 13.5 9V10H16L15.5 12.5H13.5Z"
      fill="white"
    />
  </svg>
)

const InstagramIcon = () => {
  const gradientId = useId()

  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F58529" />
          <stop offset="50%" stopColor="#DD2A7B" />
          <stop offset="100%" stopColor="#515BD4" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill={`url(#${gradientId})`} />
      <rect x="7" y="7" width="10" height="10" rx="2.5" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="2.5" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="white" />
    </svg>
  )
}

function PlatformSelectorComponent({
  currentTier,
  selectedPlatforms,
  onSelectPlatforms,
  activePlatform,
  onActivePlatformChange,
  availablePlatforms = SUPPORTED_PLATFORMS
}: PlatformSelectorProps) {
  console.log('[PlatformSelector] 🎨 Rendering with props:', {
    selectedPlatforms,
    activePlatform,
    currentTier,
    availablePlatforms
  });

  const visiblePlatforms = SUPPORTED_PLATFORMS.filter((platform) =>
    availablePlatforms.includes(platform)
  )

  console.log('[PlatformSelector] Visible platforms:', visiblePlatforms);

  const handleSelect = (platform: SupportedPlatform) => {
    console.log('[PlatformSelector] 🎯 Platform clicked:', {
      platform,
      currentSelected: selectedPlatforms,
      currentTier,
      activePlatform
    });

    if (selectedPlatforms.includes(platform)) {
      console.log('[PlatformSelector] Platform already selected, attempting to deselect');
      if (selectedPlatforms.length > 1) {
        const next = selectedPlatforms.filter((p) => p !== platform)
        console.log('[PlatformSelector] ✅ Deselecting, new platforms:', next);
        onSelectPlatforms(next)
        if (!next.includes(activePlatform) && next.length > 0) {
          console.log('[PlatformSelector] Switching active platform to:', next[0]);
          onActivePlatformChange?.(next[0])
        }
      } else {
        console.log('[PlatformSelector] ⚠️ Cannot deselect - last platform');
      }
      return
    }

    const next = [...selectedPlatforms, platform]
    console.log('[PlatformSelector] ✅ Adding platform, new platforms:', next);
    onSelectPlatforms(next)
    onActivePlatformChange?.(platform)
  }

  const renderControl = (platform: SupportedPlatform) => {
    const isSelected = selectedPlatforms.includes(platform)
    const platformColor = platform === 'facebook' ? '#1877F2' : '#E4405F'

    if (platform === 'facebook') {
      return (
        <button
          key={platform}
          onClick={() => handleSelect(platform)}
          className="flex items-center gap-1.5 group cursor-pointer"
        >
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
              isSelected
                ? 'border-transparent text-white'
                : 'border-gray-300 bg-white text-transparent group-hover:border-gray-400'
            }`}
            style={
              isSelected
                ? {
                    backgroundColor: platformColor,
                    borderColor: platformColor
                  }
                : undefined
            }
          >
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <FacebookIcon />
        </button>
      )
    }

    return (
      <button
        key={platform}
        onClick={() => handleSelect(platform)}
        className="flex items-center gap-1.5 group cursor-pointer"
      >
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
            isSelected
              ? 'border-transparent text-white'
              : 'border-gray-300 bg-white text-transparent group-hover:border-gray-400'
          }`}
          style={
            isSelected
              ? {
                  backgroundColor: platformColor,
                  borderColor: platformColor
                }
              : undefined
          }
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <InstagramIcon />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-[#6B7280]">Hvor vil du poste?</span>
      <div className="flex items-center gap-3">
        {visiblePlatforms.map(renderControl)}
      </div>
    </div>
  )
}

export const PlatformSelector = memo(PlatformSelectorComponent)