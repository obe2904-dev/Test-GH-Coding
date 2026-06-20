import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MediaGalleryModal } from '../../components/media/media-gallery'
import { useBusinessData } from '../../hooks/useBusinessData'
import { useSetupCompletion } from '../../hooks/useSetupCompletion'
import { useDashboardNavigationStore } from '../../stores/dashboardNavigationStore'
import { usePostCreationStore } from '../../stores/postCreationStore'
import { useTierStore } from '../../stores/tierStore'

const GlobeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
)

const MenuIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
)

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
)

const PencilIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const LightBulbIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.5-1.3 4.7-3.2 6H8.2C6.3 13.7 5 11.5 5 9a7 7 0 017-7z" />
  </svg>
)

const WeeklyPlanIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="7" y1="14" x2="17" y2="14" />
    <line x1="7" y1="17" x2="14" y2="17" />
    <line x1="7" y1="20" x2="12" y2="20" />
  </svg>
)

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const ShareIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    <circle cx="18" cy="8" r="3" />
  </svg>
)

const PhotoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
)

type DashboardCard = {
  sidebarId: string
  title: string
  description: string
  icon: ({ className }: { className?: string }) => JSX.Element
  action: { kind: 'route'; to: string } | { kind: 'modal' }
  locked?: boolean
  completed?: boolean
  statusTone?: 'ok' | 'warn' | 'empty'
}

type DashboardSection = {
  title: string
  cards: DashboardCard[]
}

export function DashboardOverviewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentTier = useTierStore((state) => state.currentTier)
  const { business, profile, location, latestAnalysis } = useBusinessData()
  const setupCompletion = useSetupCompletion()
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false)
  const setHoveredSidebarItem = useDashboardNavigationStore((state) => state.setHoveredSidebarItem)
  const clearHoveredSidebarItem = useDashboardNavigationStore((state) => state.clearHoveredSidebarItem)
  const setActivePath = usePostCreationStore((state) => state.setActivePath)
  const setWriteSelfStep = usePostCreationStore((state) => state.setWriteSelfStep)

  const isFreeTier = currentTier === 'free'

  const getFrameTone = (completed: boolean, hasData: boolean): 'ok' | 'warn' | 'empty' => {
    if (completed) return 'ok'
    if (hasData) return 'warn'
    return 'empty'
  }

  const profileHasData = Boolean(
    business?.name?.trim() ||
    business?.website_url?.trim() ||
    profile?.short_description?.trim() ||
    profile?.long_description?.trim() ||
    profile?.menu_description?.trim() ||
    profile?.ai_brand_context?.trim() ||
    profile?.menu_structure ||
    profile?.detected_menu_urls
  )

  const menuHasData = Boolean(
    profile?.menu_structure ||
    profile?.menu_description?.trim() ||
    profile?.detected_menu_urls ||
    latestAnalysis
  )

  const locationHasData = Boolean(
    location?.address_line1?.trim() ||
    location?.city?.trim() ||
    location?.postal_code?.trim() ||
    location?.phone?.trim() ||
    location?.label?.trim()
  )

  const brandHasData = Boolean(
    profile?.ai_brand_context?.trim() ||
    profile?.short_description?.trim() ||
    profile?.long_description?.trim() ||
    latestAnalysis
  )

  const dashboardSections: DashboardSection[] = [
    {
      title: t('navigation.yourBusiness'),
      cards: [
        {
          sidebarId: 'profile',
          title: t('navigation.businessProfile'),
          description: t('navigation.businessProfileDescription'),
          icon: GlobeIcon,
          action: { kind: 'route' as const, to: '/dashboard/profile' },
          completed: setupCompletion.profile,
          statusTone: getFrameTone(setupCompletion.profile, profileHasData),
        },
        {
          sidebarId: 'menu',
          title: t('navigation.whatWeOffer'),
          description: t('navigation.offeringsDescription'),
          icon: MenuIcon,
          action: currentTier === 'free'
            ? { kind: 'route' as const, to: '/dashboard/plans' }
            : { kind: 'route' as const, to: '/dashboard/menu' },
          locked: currentTier === 'free',
          completed: setupCompletion.menu,
          statusTone: getFrameTone(setupCompletion.menu, menuHasData),
        },
        {
          sidebarId: 'location',
          title: t('navigation.location'),
          description: t('navigation.locationDescription'),
          icon: MapPinIcon,
          action: currentTier === 'free'
            ? { kind: 'route' as const, to: '/dashboard/plans' }
            : { kind: 'route' as const, to: '/dashboard/location' },
          locked: currentTier === 'free',
          completed: setupCompletion.location,
          statusTone: getFrameTone(setupCompletion.location, locationHasData),
        },
        {
          sidebarId: 'brand-profile',
          title: t('navigation.brandProfile'),
          description: t('navigation.brandProfileDescription'),
          icon: SparklesIcon,
          action: currentTier === 'free'
            ? { kind: 'route' as const, to: '/dashboard/plans' }
            : { kind: 'route' as const, to: '/dashboard/brand' },
          locked: currentTier === 'free',
          completed: setupCompletion.brandProfile,
          statusTone: getFrameTone(setupCompletion.brandProfile, brandHasData),
        },
      ],
    },
    {
      title: t('navigation.sectionContent'),
      cards: [
        {
          sidebarId: 'write',
          title: t('navigation.writeSelf'),
          description: t('navigation.writeSelfDescription'),
          icon: PencilIcon,
          action: { kind: 'route' as const, to: '/dashboard/create?mode=write' },
        },
        {
          sidebarId: 'ai-ideas',
          title: t('navigation.dailySuggestion'),
          description: t('navigation.dailySuggestionDescription'),
          icon: LightBulbIcon,
          action: { kind: 'route' as const, to: '/dashboard/create?mode=ai' },
        },
        {
          sidebarId: 'weekly-plan',
          title: t('navigation.weeklyPlan'),
          description: t('navigation.weeklyPlanDescription'),
          icon: WeeklyPlanIcon,
          action: currentTier === 'free'
            ? { kind: 'route' as const, to: '/dashboard/plans' }
            : { kind: 'route' as const, to: '/dashboard/ai-weekly-plan' },
          locked: currentTier === 'free',
        },
        {
          sidebarId: 'calendar',
          title: t('navigation.calendar'),
          description: t('navigation.contentCalendarDescription'),
          icon: CalendarIcon,
          action: { kind: 'route' as const, to: '/dashboard/calendar' },
        },
      ],
    },
    {
      title: t('navigation.sectionPublishing'),
      cards: [
        {
          sidebarId: 'social',
          title: t('navigation.socialMedia'),
          description: t('navigation.socialMediaDescription'),
          icon: ShareIcon,
          action: { kind: 'route' as const, to: '/dashboard/social-media' },
        },
        {
          sidebarId: 'media-gallery',
          title: t('navigation.mediaGallery'),
          description: t('navigation.mediaGalleryDescription'),
          icon: PhotoIcon,
          action: { kind: 'modal' as const },
        },
      ],
    },
  ]

  const handleCardClick = (action: { kind: 'route'; to: string } | { kind: 'modal' }) => {
    if (action.kind === 'route') {
      navigate(action.to)
      return
    }

    setMediaGalleryOpen(true)
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            {t('dashboard.welcome')}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            {t('dashboard.description')}
          </p>
        </div>

        <div className="space-y-6">
          {dashboardSections.map((section) => (
            <div key={section.title} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                {section.title}
              </h3>
              <div
                className={`grid grid-cols-1 gap-4 ${
                  section.cards.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-4'
                }`}
              >
                {section.cards.map((card) => {
                  const Icon = card.icon
                  const isBusinessSection = section.title === t('navigation.yourBusiness')
                  const emphasizeFrame = isFreeTier && ['profile', 'write', 'ai-ideas'].includes(card.sidebarId)
                  const statusTone = card.statusTone ?? 'empty'
                  const businessFrameClass = statusTone === 'ok'
                    ? 'border-[#CFE3DB] bg-[#FBFCFB]'
                    : statusTone === 'warn'
                      ? 'border-[#E6DDC4] bg-[#FCFBF5]'
                      : 'border-[#E8D8D8] bg-[#FCF8F8]'

                  return (
                    <div
                      key={card.title}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (card.sidebarId === 'write') {
                          setActivePath('write')
                          setWriteSelfStep('generate')
                        }
                        handleCardClick(card.action)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          if (card.sidebarId === 'write') {
                            setActivePath('write')
                            setWriteSelfStep('generate')
                          }
                          handleCardClick(card.action)
                        }
                      }}
                      onMouseEnter={() => setHoveredSidebarItem(card.sidebarId)}
                      onMouseLeave={clearHoveredSidebarItem}
                      onFocus={() => setHoveredSidebarItem(card.sidebarId)}
                      onBlur={clearHoveredSidebarItem}
                      data-card-id={card.sidebarId}
                      className={`cursor-pointer rounded-3xl p-5 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#0A7D5F]/20 ${card.locked ? 'bg-white border border-slate-200 opacity-70' : isBusinessSection ? `${businessFrameClass} border` : 'bg-white border border-slate-200'} ${emphasizeFrame ? 'border-2 border-slate-300' : ''}`}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <Icon className="h-5 w-5 shrink-0 text-slate-500" />
                        <h4 className="text-base font-semibold text-slate-900">
                          {card.title}
                        </h4>
                        {card.locked && <span className="ml-auto text-xs text-slate-400">🔒</span>}
                      </div>
                      <p className="text-sm leading-6 text-slate-600">
                        {card.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {business?.id && (
        <MediaGalleryModal
          businessId={business.id}
          isOpen={mediaGalleryOpen}
          onClose={() => setMediaGalleryOpen(false)}
          onSelectMedia={() => setMediaGalleryOpen(false)}
          selectionMode={false}
        />
      )}
    </div>
  )
}