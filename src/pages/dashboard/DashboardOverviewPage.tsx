import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { MediaGalleryModal } from '../../components/media/media-gallery'
import { useBusinessData } from '../../hooks/useBusinessData'
import { useSetupCompletion } from '../../hooks/useSetupCompletion'
import { useDashboardNavigationStore } from '../../stores/dashboardNavigationStore'
import { usePostCreationStore } from '../../stores/postCreationStore'
import { useTierStore } from '../../stores/tierStore'
import { DashboardCard } from '../../components/dashboard/DashboardCard'
import { ContentCard } from '../../components/dashboard/ContentCard'
import { supabase } from '../../lib/supabase'

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

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
)

type DashboardCard = {
  sidebarId: string
  title: string
  description: string
  icon: ({ className }: { className?: string }) => JSX.Element
  action: { kind: 'route'; to: string } | { kind: 'modal' }
  locked?: boolean
  lockedReason?: string
  isSequentialLock?: boolean
  completed?: boolean
  statusTone?: 'ok' | 'warn' | 'empty'
}

type DashboardSection = {
  title: string
  cards: DashboardCard[]
}

// Helper Components
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-[11px] font-semibold tracking-widest text-slate-500 uppercase mb-3">
        {label}
      </p>
      {children}
    </div>
  );
}

function SequenceArrow({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center pt-5">
      <ArrowRightIcon className={`h-3.5 w-3.5 ${active ? 'text-[#0A7D5F]' : 'text-slate-400'}`} />
    </div>
  );
}

export function DashboardOverviewPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const currentTier = useTierStore((state) => state.currentTier)
  const { business, profile, location, latestAnalysis } = useBusinessData()
  const setupCompletion = useSetupCompletion()
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false)
  const [hasWeeklyPlan, setHasWeeklyPlan] = useState(false)
  const [hasDailySuggestions, setHasDailySuggestions] = useState(false)
  const [currentTip, setCurrentTip] = useState<{ tip_da: string; tip_en: string } | null>(null)
  const setHoveredSidebarItem = useDashboardNavigationStore((state) => state.setHoveredSidebarItem)
  const clearHoveredSidebarItem = useDashboardNavigationStore((state) => state.clearHoveredSidebarItem)
  const setActivePath = usePostCreationStore((state) => state.setActivePath)
  const setWriteSelfStep = usePostCreationStore((state) => state.setWriteSelfStep)

  const isFreeTier = currentTier === 'free'

  // Fetch a random tip (excluding last 5 shown)
  useEffect(() => {
    const fetchRandomTip = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || isFreeTier) {
          console.log('Tips: Skipping - user not logged in or free tier')
          return
        }

        console.log('Tips: Fetching for user:', user.id)

        // Get the last 5 shown tip IDs for this user
        const { data: recentTips, error: recentError } = await supabase
          .from('user_shown_tips')
          .select('tip_id')
          .eq('user_id', user.id)
          .order('shown_at', { ascending: false })
          .limit(5)

        if (recentError) {
          console.error('Tips: Error fetching recent tips:', recentError)
        }

        const excludedIds = recentTips?.map(t => t.tip_id) || []
        console.log('Tips: Excluding', excludedIds.length, 'recent tips')

        // Get a random tip that's not in the excluded list
        let query = supabase
          .from('dashboard_tips')
          .select('id, tip_da, tip_en')
          .eq('active', true)

        if (excludedIds.length > 0) {
          query = query.not('id', 'in', `(${excludedIds.join(',')})`)
        }

        const { data: tips, error: tipsError } = await query

        if (tipsError) {
          console.error('Tips: Error fetching tips:', tipsError)
          return
        }

        console.log('Tips: Found', tips?.length || 0, 'available tips')

        if (tips && tips.length > 0) {
          // Select random tip from available ones
          const randomTip = tips[Math.floor(Math.random() * tips.length)]
          console.log('Tips: Selected tip:', randomTip.id)
          setCurrentTip(randomTip)

          // Track that this tip was shown
          const { error: upsertError } = await supabase
            .from('user_shown_tips')
            .upsert({
              user_id: user.id,
              tip_id: randomTip.id,
              shown_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,tip_id'
            })

          if (upsertError) {
            console.error('Tips: Error tracking shown tip:', upsertError)
          }
        }
      } catch (error) {
        console.error('Tips: Unexpected error:', error)
      }
    }

    fetchRandomTip()
  }, [isFreeTier])

  // Check for existing weekly plan and daily suggestions
  useEffect(() => {
    const checkContentStatus = async () => {
      if (!business) return

      // Check for weekly plan
      const { data: weeklyPlan } = await supabase
        .from('weekly_content_plans')
        .select('id')
        .eq('business_id', business.id)
        .limit(1)
        .maybeSingle()
      
      setHasWeeklyPlan(!!weeklyPlan)

      // Check for daily suggestions
      const { data: dailySuggestion } = await supabase
        .from('daily_suggestions')
        .select('id')
        .eq('business_id', business.id)
        .limit(1)
        .maybeSingle()
      
      setHasDailySuggestions(!!dailySuggestion)
    }

    checkContentStatus()
  }, [business])

  const getFrameTone = (completed: boolean, hasData: boolean): 'ok' | 'warn' | 'empty' => {
    if (completed) return 'ok'
    if (hasData) return 'warn'
    return 'empty'
  }

  // Determine which welcome message to show based on tier and completion states
  const getWelcomeMessageKey = (): string => {
    if (isFreeTier) {
      // Free tier logic
      if (setupCompletion.profileState !== 'complete') {
        return 'dashboard.welcomeFreeNoProfile'
      } else {
        return 'dashboard.welcomeFreeProfileDone'
      }
    } else {
      // Paid tier logic - first check setup completion
      if (setupCompletion.menuState === 'none') {
        return 'dashboard.welcomePaidNoMenu'
      } else if (setupCompletion.locationState === 'none') {
        return 'dashboard.welcomePaidNoLocation'
      } else if (setupCompletion.brandState === 'none') {
        return 'dashboard.welcomePaidNoBrand'
      } else {
        // Setup complete - check content generation status
        if (!hasWeeklyPlan && !hasDailySuggestions) {
          return 'dashboard.welcomePaidNoContent'
        } else if (hasWeeklyPlan && !hasDailySuggestions) {
          return 'dashboard.welcomePaidHasWeeklyNoDaily'
        } else if (!hasWeeklyPlan && hasDailySuggestions) {
          return 'dashboard.welcomePaidHasDailyNoWeekly'
        } else {
          return 'dashboard.welcomePaidHasBoth'
        }
      }
    }
  }

  const welcomeMessageKey = getWelcomeMessageKey()

  // Determine header text based on setup completion
  const getWelcomeHeaderKey = (): string => {
    if (isFreeTier) {
      return setupCompletion.profileState === 'complete' ? 'dashboard.welcome' : 'dashboard.welcomeIncomplete'
    } else {
      // Paid tier - check if basic setup is complete
      const setupComplete = setupCompletion.menuState !== 'none' && 
                           setupCompletion.locationState !== 'none' && 
                           setupCompletion.brandState !== 'none'
      return setupComplete ? 'dashboard.welcome' : 'dashboard.welcomeIncomplete'
    }
  }

  const welcomeHeaderKey = getWelcomeHeaderKey()

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
    profile?.user_about_text?.trim() ||
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
          completed: setupCompletion.profileState === 'complete',
          statusTone: setupCompletion.profileState === 'complete' ? 'ok' : 'warn',
        },
        {
          sidebarId: 'menu',
          title: t('navigation.whatWeOffer'),
          description: t('navigation.offeringsDescription'),
          icon: MenuIcon,
          action: isFreeTier
            ? { kind: 'route' as const, to: '/dashboard/plans' }
            : { kind: 'route' as const, to: '/dashboard/menu' },
          locked: isFreeTier || (!isFreeTier && setupCompletion.profileState !== 'complete'),
          isSequentialLock: !isFreeTier && setupCompletion.profileState !== 'complete',
          lockedReason: isFreeTier 
            ? undefined 
            : setupCompletion.profileState !== 'complete'
              ? 'Udfyld først virksomhedsprofil for at låse menuen op'
              : undefined,
          completed: setupCompletion.menu,
          statusTone: getFrameTone(setupCompletion.menu, menuHasData),
        },
        {
          sidebarId: 'location',
          title: t('navigation.location'),
          description: t('navigation.locationDescription'),
          icon: MapPinIcon,
          action: isFreeTier
            ? { kind: 'route' as const, to: '/dashboard/plans' }
            : { kind: 'route' as const, to: '/dashboard/location' },
          locked: isFreeTier || (!isFreeTier && setupCompletion.menuState === 'none'),
          isSequentialLock: !isFreeTier && setupCompletion.menuState === 'none',
          lockedReason: isFreeTier 
            ? undefined 
            : setupCompletion.menuState === 'none'
              ? 'Tilføj først menu data for at låse lokation op'
              : undefined,
          completed: setupCompletion.location,
          statusTone: getFrameTone(setupCompletion.location, locationHasData),
        },
        {
          sidebarId: 'brand-profile',
          title: t('navigation.brandProfile'),
          description: t('navigation.brandProfileDescription'),
          icon: SparklesIcon,
          action: isFreeTier
            ? { kind: 'route' as const, to: '/dashboard/plans' }
            : { kind: 'route' as const, to: '/dashboard/brand' },
          locked: isFreeTier || (!isFreeTier && setupCompletion.locationState === 'none'),
          isSequentialLock: !isFreeTier && setupCompletion.locationState === 'none',
          lockedReason: isFreeTier 
            ? undefined 
            : setupCompletion.locationState === 'none'
              ? 'Tilføj først lokation data for at låse brand profil op'
              : undefined,
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

  const handleCardClick = (action: { kind: 'route'; to: string } | { kind: 'modal' }, locked?: boolean, lockedReason?: string) => {
    if (locked && lockedReason) {
      // Show toast or alert with nudging message
      alert(lockedReason)
      return
    }

    if (action.kind === 'route') {
      navigate(action.to)
      return
    }

    setMediaGalleryOpen(true)
  }

  // Helper to determine lock tier based on whether it's a free tier requirement
  const getLockTier = (locked?: boolean, isSequentialLock?: boolean): 'Smart' | 'Pro' | undefined => {
    if (!locked) return undefined;
    return isSequentialLock ? undefined : 'Smart'; // Only show tier badge for tier locks, not sequential
  }

  // Helper to map statusTone to status for DashboardCard
  const mapStatus = (statusTone?: 'ok' | 'warn' | 'empty', completed?: boolean): 'complete' | 'partial' | undefined => {
    if (completed) return 'complete';
    if (statusTone === 'warn') return 'partial';
    return undefined;
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {isFreeTier ? (
          // Free tier: full-width welcome message
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              {t(welcomeHeaderKey)}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              <Trans
                i18nKey={welcomeMessageKey}
                components={{
                  profileLink: <Link to="/dashboard/profile" className="text-[#0A7D5F] hover:text-[#0A7D5F]/80 font-medium underline" />,
                  aiLink: <Link to="/dashboard/create?mode=ai" className="text-[#0A7D5F] hover:text-[#0A7D5F]/80 font-medium underline" />,
                  writeLink: <Link to="/dashboard/create?mode=write" className="text-[#0A7D5F] hover:text-[#0A7D5F]/80 font-medium underline" />,
                  menuLink: <Link to="/dashboard/menu" className="text-[#0A7D5F] hover:text-[#0A7D5F]/80 font-medium underline" />,
                  locationLink: <Link to="/dashboard/location" className="text-[#0A7D5F] hover:text-[#0A7D5F]/80 font-medium underline" />,
                  brandLink: <Link to="/dashboard/brand" className="text-[#0A7D5F] hover:text-[#0A7D5F]/80 font-medium underline" />,
                  weeklyLink: <Link to="/dashboard/ai-weekly-plan" className="text-[#0A7D5F] hover:text-[#0A7D5F]/80 font-medium underline" />
                }}
              />
            </p>
          </div>
        ) : (
          // Paid tier: welcome message + tips in grid layout matching business cards below
          <div className="grid grid-cols-[1fr_16px_1fr_16px_1fr_16px_1fr] gap-0 items-stretch">
            {/* Welcome message - spans 3 cards + 2 arrows (columns 1-5) */}
            <div className="col-span-5 h-full rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                {t(welcomeHeaderKey)}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                <Trans
                  i18nKey={welcomeMessageKey}
                  components={{
                    profileLink: <Link to="/dashboard/profile" className="text-[#0A7D5F] hover:text-[#0A7D5F]/80 font-medium underline" />,
                    aiLink: <Link to="/dashboard/create?mode=ai" className="text-[#0A7D5F] hover:text-[#0A7D5F]/80 font-medium underline" />,
                    writeLink: <Link to="/dashboard/create?mode=write" className="text-[#0A7D5F] hover:text-[#0A7D5F]/80 font-medium underline" />,
                    menuLink: <Link to="/dashboard/menu" className="text-[#0A7D5F] hover:text-[#0A7D5F]/80 font-medium underline" />,
                    locationLink: <Link to="/dashboard/location" className="text-[#0A7D5F] hover:text-[#0A7D5F]/80 font-medium underline" />,
                    brandLink: <Link to="/dashboard/brand" className="text-[#0A7D5F] hover:text-[#0A7D5F]/80 font-medium underline" />,
                    weeklyLink: <Link to="/dashboard/ai-weekly-plan" className="text-[#0A7D5F] hover:text-[#0A7D5F]/80 font-medium underline" />
                  }}
                />
              </p>
            </div>
            
            {/* Empty arrow space */}
            <div />
            
            {/* Tips card - spans last card (column 7) */}
            <div className="h-full rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                {t('dashboard.tipsTitle')}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {currentTip 
                  ? (i18n.language === 'da' ? currentTip.tip_da : currentTip.tip_en)
                  : t('dashboard.tipsLoading')
                }
              </p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {dashboardSections.map((section) => {
            const isBusinessSection = section.title === t('navigation.yourBusiness');
            
            // Business section with sequence arrows
            if (isBusinessSection) {
              return (
                <Section key={section.title} label={section.title}>
                  <div className="grid grid-cols-[1fr_16px_1fr_16px_1fr_16px_1fr] gap-0 items-start">
                    {section.cards.map((card, index) => {
                      const Icon = card.icon;
                      const tier = getLockTier(card.locked, card.isSequentialLock);
                      const status = mapStatus(card.statusTone, card.completed);
                      
                      return (
                        <>
                          <DashboardCard
                            key={card.sidebarId}
                            icon={<Icon className="w-[18px] h-[18px]" />}
                            title={card.title}
                            description={card.description}
                            status={status}
                            locked={card.locked ? {
                              tier: tier || 'Smart',
                              prerequisite: card.lockedReason
                            } : undefined}
                            onClick={() => {
                              if (card.sidebarId === 'write') {
                                setActivePath('write');
                                setWriteSelfStep('generate');
                              }
                              handleCardClick(card.action, card.locked, card.lockedReason);
                            }}
                          />
                          {index < section.cards.length - 1 && (
                            <SequenceArrow 
                              key={`arrow-${index}`}
                              active={card.completed || false} 
                            />
                          )}
                        </>
                      );
                    })}
                  </div>
                </Section>
              );
            }

            // Other sections - grid layout
            const isContentSection = section.title === t('navigation.sectionContent');
            
            return (
              <Section key={section.title} label={section.title}>
                <div className={`grid gap-2.5 ${
                  section.cards.length === 2 ? 'grid-cols-2' : 'grid-cols-4'
                }`}>
                  {section.cards.map((card) => {
                    const Icon = card.icon;
                    const tier = getLockTier(card.locked, card.isSequentialLock);
                    const status = mapStatus(card.statusTone, card.completed);
                    
                    // Use ContentCard for content section
                    if (isContentSection) {
                      const isHeroCard = card.sidebarId === 'ai-ideas' || card.sidebarId === 'weekly-plan';
                      const payoffKey = card.sidebarId === 'write' 
                        ? 'writeSelfPayoff'
                        : card.sidebarId === 'ai-ideas'
                          ? 'dailySuggestionPayoff'
                          : card.sidebarId === 'weekly-plan'
                            ? 'weeklyPlanPayoff'
                            : 'contentCalendarPayoff';
                      
                      return (
                        <ContentCard
                          key={card.sidebarId}
                          icon={<Icon className="w-[17px] h-[17px]" />}
                          title={card.title}
                          description={card.description}
                          payoff={t(`navigation.${payoffKey}`)}
                          isHero={isHeroCard}
                          locked={card.locked ? {
                            tier: tier || 'Smart',
                            prerequisite: card.lockedReason
                          } : undefined}
                          onClick={() => {
                            if (card.sidebarId === 'write') {
                              setActivePath('write');
                              setWriteSelfStep('generate');
                            }
                            handleCardClick(card.action, card.locked, card.lockedReason);
                          }}
                        />
                      );
                    }
                    
                    // Use DashboardCard for other sections
                    return (
                      <DashboardCard
                        key={card.sidebarId}
                        icon={<Icon className="w-[18px] h-[18px]" />}
                        title={card.title}
                        description={card.description}
                        status={status}
                        locked={card.locked ? {
                          tier: tier || 'Smart',
                          prerequisite: card.lockedReason
                        } : undefined}
                        onClick={() => {
                          if (card.sidebarId === 'write') {
                            setActivePath('write');
                            setWriteSelfStep('generate');
                          }
                          handleCardClick(card.action, card.locked, card.lockedReason);
                        }}
                      />
                    );
                  })}
                </div>
              </Section>
            );
          })}
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