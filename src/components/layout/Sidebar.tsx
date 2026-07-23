import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier'
import { useTierStore } from '../../stores/tierStore'
import { usePostCreationStore } from '../../stores/postCreationStore'
import { useSetupCompletion } from '@/hooks/useSetupCompletion'
import type { CompletionState } from '@/hooks/useSetupCompletion'
import { useBusinessData } from '../../hooks/useBusinessData'
import { MediaGalleryModal } from '../media/media-gallery'
import type { MediaItem } from '../../api/mediaLibrary'
import { useDashboardNavigationStore } from '../../stores/dashboardNavigationStore'

interface SidebarProps {
  className?: string
}

// Icon Components
const PencilIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
  </svg>
)

const GlobeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
  </svg>
)

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const MenuIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
  </svg>
)

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
  </svg>
)

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3m15.364 6.364l-4.243-4.243m-6.364 0l-4.243 4.243m12.728 0l-4.243 4.243m-6.364 0l-4.243-4.243"/>
  </svg>
)

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
)

const UsersIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75"/>
  </svg>
)

const ShareIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    <circle cx="18" cy="8" r="3"/>
  </svg>
)

const QuestionMarkCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

const LightBulbIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.5-1.3 4.7-3.2 6H8.2C6.3 13.7 5 11.5 5 9a7 7 0 017-7z"/>
  </svg>
)

const WeeklyPlanIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <line x1="7" y1="14" x2="17" y2="14"/>
    <line x1="7" y1="17" x2="14" y2="17"/>
    <line x1="7" y1="20" x2="12" y2="20"/>
  </svg>
)

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
  </svg>
)

const PhotoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

export function Sidebar({ className = '' }: SidebarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentTier = useTierStore((state) => state.currentTier)
  const tierStatus = useTierStore((state) => state.tierStatus)
  const { isPro } = useSubscriptionTier()
  const { activePath, setActivePath, setWriteSelfStep, setAiIdeerStep, setWeeklyPlanStep } = usePostCreationStore()
  const { pathname } = useLocation()
  const completion = useSetupCompletion()
  const { business } = useBusinessData()
  const hoveredSidebarItem = useDashboardNavigationStore((state) => state.hoveredSidebarItem)
  
  const [setupOpen, setSetupOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mediaGalleryModalOpen, setMediaGalleryModalOpen] = useState(false)

  // Check if user is on free tier
  const isFree = tierStatus === 'ready' && currentTier === 'free'
  const isWeeklyPlanLocked = isFree

  // Debug logging for tier status
  useEffect(() => {
    console.log('🔧 Sidebar tier check:', { tierStatus, currentTier, isFree })
    console.log('🔧 Sidebar completion check:', { 
      profileState: completion.profileState,
      menuState: completion.menuState, 
      locationState: completion.locationState,
      brandState: completion.brandState,
      loading: completion.loading
    })
  }, [tierStatus, currentTier, isFree, completion])

  // Helper to render nav item
  const renderNavItem = (item: { id: string; label: string; icon: any; path: string; locked?: boolean; isSequentialLock?: boolean; badge?: string; completed?: boolean; completionState?: CompletionState }) => {
    const Icon = item.icon
    const isLocked = item.locked
    const isSequentialLock = item.isSequentialLock
    const isCompleted = item.completed
    const isHovered = hoveredSidebarItem === item.id
    
    if (isLocked) {
      return (
        <button
          key={item.id}
          onClick={() => navigate('/dashboard/plans')}
          className="group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium text-text-muted hover:bg-surface-alt hover:text-text opacity-60"
        >
          <Icon className="w-5 h-5 flex-shrink-0" />
          <span className={`truncate ${isHovered ? 'font-semibold text-text' : ''}`}>{item.label}</span>
          <span className="ml-auto text-xs">{isSequentialLock ? '⏻' : '🔒'}</span>
        </button>
      )
    }
    
    return (
      <NavLink
        key={item.id}
        to={item.path}
        className={({ isActive }) =>
          `group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
            isActive
              ? 'bg-[#E6F4F1] text-[#076B4E] font-semibold border border-[#0A7D5F] shadow-sm'
              : 'text-text-muted hover:bg-surface-alt hover:text-text'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={`w-5 h-5 flex-shrink-0 ${isActive || isHovered ? 'text-[#0A7D5F]' : ''}`} />
            <span className={`truncate flex-1 ${isActive || isHovered ? 'font-semibold text-text' : ''}`}>{item.label}</span>
            {isCompleted && !completion.loading && (
              <CheckCircleIcon className="w-4 h-4 text-[#0A7D5F] flex-shrink-0" />
            )}
          </>
        )}
      </NavLink>
    )
  }

  return (
    <div className={`w-72 bg-surface border-r border-border flex flex-col h-screen ${className}`}>
      {/* Logo */}
      <div className="px-4 py-4 flex items-center justify-between gap-3">
        <button 
          onClick={() => navigate('/dashboard')}
          className="text-2xl font-bold text-brand hover:text-brand-hover transition-colors cursor-pointer"
        >
          Post2Grow
        </button>
        {/* Tier Badge */}
        {tierStatus === 'loading' ? (
          <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500">
            Henter plan...
          </span>
        ) : tierStatus === 'error' ? (
          <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">
            Plan utilgængelig
          </span>
        ) : isFree ? (
          <button
            onClick={() => navigate('/dashboard/plans')}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-md text-[10px] font-medium text-purple-700 hover:from-purple-100 hover:to-blue-100 transition-all"
          >
            <span>Opgrader: Free</span>
          </button>
        ) : currentTier === 'standardplus' ? (
          <button
            onClick={() => navigate('/dashboard/plans')}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-md text-[10px] font-semibold text-blue-700 hover:bg-blue-100 transition-all cursor-pointer"
          >
            <span>Opgrader: Smart</span>
          </button>
        ) : currentTier === 'premium' ? (
          <button
            onClick={() => navigate('/dashboard/plans')}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 bg-purple-50 border border-purple-200 rounded-md text-[10px] font-semibold text-purple-700 hover:bg-purple-100 transition-all cursor-pointer"
          >
            <span>Pro</span>
          </button>
        ) : null}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
        {/* SETUP Section */}
        <div className="space-y-1.5">
          <button
            onClick={() => setSetupOpen(!setupOpen)}
            className="group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 text-[11px] font-medium text-[#A09A91] hover:bg-surface-alt uppercase tracking-[0.07em]"
          >
            {setupOpen ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
            <span>{t('navigation.yourBusiness')}</span>
          </button>

          {setupOpen && (
            <div className="relative pl-3 space-y-0">
              <div className="absolute left-0 top-3 bottom-3 w-px bg-border"></div>
              
              {renderNavItem({ id: 'profile', label: t('navigation.setup.profile'), icon: GlobeIcon, path: '/dashboard/profile', completed: completion.profileState === 'complete', completionState: completion.profileState })}
              {renderNavItem({ id: 'menu', label: t('navigation.setup.menu'), icon: MenuIcon, path: '/dashboard/menu', locked: isFree || (!isFree && completion.profileState !== 'complete'), isSequentialLock: !isFree && completion.profileState !== 'complete', completed: completion.menu, completionState: completion.menuState })}
              {renderNavItem({ id: 'location', label: t('navigation.setup.location'), icon: MapPinIcon, path: '/dashboard/location', locked: isFree || (!isFree && completion.menuState === 'none'), isSequentialLock: !isFree && completion.menuState === 'none', completed: completion.location, completionState: completion.locationState })}
              {renderNavItem({ id: 'brand-profile', label: t('navigation.setup.brand'), icon: SparklesIcon, path: '/dashboard/brand', locked: isFree || (!isFree && completion.locationState === 'none'), isSequentialLock: !isFree && completion.locationState === 'none', completed: completion.brandProfile, completionState: completion.brandState })}
            </div>
          )}
        </div>

        {/* INDHOLD Section */}
        <div className="space-y-1.5 mt-4 pt-4 border-t border-border-subtle">
          <div className="px-2 py-1.5 text-[11px] font-medium text-[#A09A91] uppercase tracking-[0.07em]">
            {t('navigation.sectionContent')}
          </div>
          <div className="bg-cta-surface rounded-xl p-2 space-y-1">
            {/* Skriv Selv */}
            <button
              onClick={() => {
                setActivePath('write')
                setWriteSelfStep('generate')
                navigate('/dashboard/create?mode=write')
              }}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm ${
                pathname === '/dashboard/create' && activePath === 'write'
                  ? 'bg-[#E6F4F1] text-[#076B4E] font-semibold border border-[#0A7D5F] shadow-sm'
                  : 'text-text font-medium hover:bg-surface-alt'
              }`}
            >
              <PencilIcon className={`w-5 h-5 flex-shrink-0 ${pathname === '/dashboard/create' && activePath === 'write' ? 'text-[#0A7D5F]' : 'text-[#5C5650]'}`} />
              <span className="truncate">{t('navigation.writeSelf')}</span>
            </button>

            {/* AI Forslag */}
            <button
              onClick={() => {
                setActivePath('ai-ideas')
                setAiIdeerStep('generate')
                navigate('/dashboard/create?mode=ai')
              }}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm ${
                pathname === '/dashboard/create' && activePath === 'ai-ideas'
                  ? 'bg-[#E6F4F1] text-[#076B4E] font-semibold border border-[#0A7D5F] shadow-sm'
                  : 'text-text font-medium hover:bg-surface-alt'
              }`}
            >
              <LightBulbIcon className={`w-5 h-5 flex-shrink-0 ${pathname === '/dashboard/create' && activePath === 'ai-ideas' ? 'text-[#0A7D5F]' : 'text-[#5C5650]'}`} />
              <span className="truncate">{t('navigation.dailySuggestion')}</span>
            </button>

            {/* AI Ugentlig Plan */}
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  if (isWeeklyPlanLocked) {
                    navigate('/dashboard/plans')
                    return
                  }

                  setActivePath('weekly-plan')
                  setWeeklyPlanStep('generate')
                  navigate('/dashboard/ai-weekly-plan')
                }}
                className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm ${
                  isWeeklyPlanLocked
                    ? 'text-text-muted font-medium hover:bg-surface-alt hover:text-text opacity-60'
                    : pathname === '/dashboard/ai-weekly-plan'
                      ? 'bg-[#E6F4F1] text-[#076B4E] font-semibold border border-[#0A7D5F] shadow-sm'
                      : 'text-text font-medium hover:bg-surface-alt'
                }`}
              >
                <WeeklyPlanIcon className={`w-5 h-5 flex-shrink-0 ${isWeeklyPlanLocked ? 'text-[#5C5650]' : pathname === '/dashboard/ai-weekly-plan' ? 'text-[#0A7D5F]' : 'text-[#5C5650]'}`} />
                <span className="truncate">{t('navigation.weeklyPlan')}</span>
                {isWeeklyPlanLocked && <span className="ml-auto text-xs">🔒</span>}
              </button>
            </div>
          </div>
          
          {/* Subtle dotted separator */}
          <div className="border-t border-dashed border-border-subtle my-2"></div>
          
          {/* Calendar - grouped with planning tools */}
          <div className="space-y-1">
            {renderNavItem({ id: 'calendar', label: t('navigation.calendar'), icon: CalendarIcon, path: '/dashboard/calendar' })}
          </div>
        </div>

        {/* PUBLICERING Section */}
        <div className="space-y-1.5 mt-4 pt-4 border-t border-border-subtle">
          <div className="px-2 py-1.5 text-[11px] font-medium text-[#A09A91] uppercase tracking-[0.07em]">
            {t('navigation.sectionPublishing')}
          </div>
          <div className="space-y-1">
            {renderNavItem({ id: 'social', label: t('navigation.socialMedia'), icon: ShareIcon, path: '/dashboard/social-media' })}
            <button
              onClick={() => setMediaGalleryModalOpen(true)}
              className="group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium text-text-muted hover:bg-surface-alt hover:text-text"
            >
              <PhotoIcon className={`w-5 h-5 flex-shrink-0 ${hoveredSidebarItem === 'media-gallery' ? 'text-[#0A7D5F]' : 'text-[#5C5650]'}`} />
              <span className={`truncate ${hoveredSidebarItem === 'media-gallery' ? 'font-semibold text-text' : ''}`}>{t('navigation.mediaGallery')}</span>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border"></div>

        {/* INDSTILLINGER Section */}
        <div className="space-y-1.5">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 text-[11px] font-medium text-[#A09A91] hover:bg-surface-alt uppercase tracking-[0.07em]"
          >
            {settingsOpen ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
            <span>{t('navigation.settings')}</span>
          </button>

          {settingsOpen && (
            <div className="space-y-1">
              {/* Team - Pro only */}
              {isPro ? (
                renderNavItem({ id: 'team', label: t('navigation.team'), icon: UsersIcon, path: '/dashboard/team' })
              ) : (
                <button
                  onClick={() => navigate('/dashboard/plans')}
                  className="group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium text-text-muted hover:bg-surface-alt hover:text-text"
                >
                  <UsersIcon className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">{t('navigation.team')}</span>
                  <span className="ml-auto text-xs">⭐</span>
                </button>
              )}
              
              {renderNavItem({ id: 'settings', label: t('navigation.settings'), icon: SettingsIcon, path: '/dashboard/settings' })}
              {renderNavItem({ id: 'help', label: t('navigation.help'), icon: QuestionMarkCircleIcon, path: '/dashboard/help' })}
              
              {/* Submenu items without icons */}
              <NavLink
                to="/dashboard/contact"
                className={({ isActive }) =>
                  `group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                    isActive
                      ? 'bg-accent-surface text-brand'
                      : 'text-text-muted hover:bg-surface-alt hover:text-text'
                  }`
                }
              >
                <div className="w-5 h-5 flex-shrink-0"></div>
                <span className="truncate">{t('navigation.contact')}</span>
              </NavLink>
              <NavLink
                to="/dashboard/privacy"
                className={({ isActive }) =>
                  `group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                    isActive
                      ? 'bg-accent-surface text-brand'
                      : 'text-text-muted hover:bg-surface-alt hover:text-text'
                  }`
                }
              >
                <div className="w-5 h-5 flex-shrink-0"></div>
                <span className="truncate">{t('navigation.privacy')}</span>
              </NavLink>
              <NavLink
                to="/dashboard/terms"
                className={({ isActive }) =>
                  `group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                    isActive
                      ? 'bg-accent-surface text-brand'
                      : 'text-text-muted hover:bg-surface-alt hover:text-text'
                  }`
                }
              >
                <div className="w-5 h-5 flex-shrink-0"></div>
                <span className="truncate">{t('navigation.terms')}</span>
              </NavLink>
            </div>
          )}
        </div>
      </nav>

      {/* Media Gallery Modal */}
      {business?.id && (
        <MediaGalleryModal
          businessId={business.id}
          isOpen={mediaGalleryModalOpen}
          onClose={() => setMediaGalleryModalOpen(false)}
          onSelectMedia={(media: MediaItem) => {
            console.log('Selected media from modal:', media)
            setMediaGalleryModalOpen(false)
            // Future: Navigate to create post with selected media
            navigate('/dashboard/create-post')
          }}
          selectionMode={false}
        />
      )}
    </div>
  )
}
