import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier'
import { useTierStore } from '../../stores/tierStore'
import { usePostCreationStore } from '../../stores/postCreationStore'

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

const DocumentTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
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

const ChartBarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
  </svg>
)

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3m15.364 6.364l-4.243-4.243m-6.364 0l-4.243 4.243m12.728 0l-4.243 4.243m-6.364 0l-4.243-4.243"/>
  </svg>
)

const CogIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
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

const CalendarDaysIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <line x1="8" y1="14" x2="8" y2="14"/>
    <line x1="12" y1="14" x2="12" y2="14"/>
    <line x1="16" y1="14" x2="16" y2="14"/>
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

export function Sidebar({ className = '' }: SidebarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentTier = useTierStore((state) => state.currentTier)
  const { isPro } = useSubscriptionTier()
  const { activePath, setActivePath, setWriteSelfStep, setAiIdeerStep, setWeeklyPlanStep } = usePostCreationStore()
  const { pathname } = useLocation()
  
  const [setupOpen, setSetupOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Check if user is on free tier
  const isFree = currentTier === 'free'

  // Helper to render nav item
  const renderNavItem = (item: { id: string; label: string; icon: any; path: string; locked?: boolean; badge?: string }) => {
    const Icon = item.icon
    const isLocked = item.locked
    
    if (isLocked) {
      return (
        <button
          key={item.id}
          onClick={() => navigate('/dashboard/plans')}
          className="group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium text-text-muted hover:bg-surface-alt hover:text-text opacity-60"
        >
          <Icon className="w-5 h-5 flex-shrink-0" />
          <span className="truncate">{item.label}</span>
          <span className="ml-auto text-xs">🔒</span>
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
              ? 'bg-cta-surface text-cta-text border-l-[3px] border-cta'
              : 'text-text-muted hover:bg-surface-alt hover:text-text'
          }`
        }
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="truncate">{item.label}</span>

      </NavLink>
    )
  }

  return (
    <div className={`w-72 bg-surface border-r border-border flex flex-col h-screen ${className}`}>
      {/* Logo */}
      <div className="px-4 py-4">
        <h1 className="text-2xl font-bold text-brand">
          Post2Grow
        </h1>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
        {/* SETUP Section */}
        <div className="space-y-1.5">
          <button
            onClick={() => setSetupOpen(!setupOpen)}
            className="group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 text-xs font-semibold text-text-muted hover:bg-surface-alt uppercase tracking-wide"
          >
            {setupOpen ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
            <span>{t('navigation.yourBusiness')}</span>
          </button>

          {setupOpen && (
            <div className="relative pl-3 space-y-0">
              <div className="absolute left-0 top-3 bottom-3 w-px bg-border"></div>
              <div className="relative">
                <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-border-strong ring-2 ring-surface"></div>
                {renderNavItem({ id: 'profile', label: t('navigation.setup.profile'), icon: GlobeIcon, path: '/dashboard/profile' })}
              </div>
              <div className="relative">
                <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-border-strong ring-2 ring-surface"></div>
                {renderNavItem({ id: 'menu', label: t('navigation.setup.menu'), icon: MenuIcon, path: '/dashboard/menu', locked: isFree })}
              </div>
              <div className="relative">
                <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-border-strong ring-2 ring-surface"></div>
                {renderNavItem({ id: 'location', label: t('navigation.setup.location'), icon: MapPinIcon, path: '/dashboard/location', locked: isFree })}
              </div>
              <div className="relative">
                <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-border-strong ring-2 ring-surface"></div>
                {renderNavItem({ id: 'brand-profile', label: t('navigation.setup.brand'), icon: SparklesIcon, path: '/dashboard/brand-v5' })}
              </div>
            </div>
          )}
        </div>

        {/* INDHOLD Section */}
        <div className="space-y-1.5 mt-4 pt-4 border-t border-border-subtle">
          <div className="px-2 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
            {t('navigation.sectionContent')}
          </div>
          <div className="space-y-1">
            {/* Skriv Selv */}
            <button
              onClick={() => {
                setActivePath('write')
                setWriteSelfStep('generate')
                navigate('/dashboard/create?mode=write')
              }}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                pathname === '/dashboard/create' && activePath === 'write'
                  ? 'bg-cta-surface text-cta-text border-l-[3px] border-cta'
                  : 'text-text hover:bg-surface-alt'
              }`}
            >
              <PencilIcon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{t('navigation.writeSelf')}</span>
            </button>

            {/* AI Forslag */}
            <button
              onClick={() => {
                setActivePath('ai-ideas')
                setAiIdeerStep('generate')
                navigate('/dashboard/create?mode=ai')
              }}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                pathname === '/dashboard/create' && activePath === 'ai-ideas'
                  ? 'bg-cta-surface text-cta-text border-l-[3px] border-cta'
                  : 'text-text hover:bg-surface-alt'
              }`}
            >
              <LightBulbIcon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{t('navigation.dailySuggestion')}</span>
            </button>

            {/* AI Ugentlig Plan */}
            <button
              onClick={() => {
                setActivePath('weekly-plan')
                setWeeklyPlanStep('generate')
                navigate('/dashboard/ai-weekly-plan')
              }}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                pathname === '/dashboard/ai-weekly-plan'
                  ? 'bg-cta-surface text-cta-text border-l-[3px] border-cta'
                  : 'text-text hover:bg-surface-alt'
              }`}
            >
              <CalendarDaysIcon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{t('navigation.weeklyPlan')}</span>
            </button>
          </div>
        </div>

        {/* PUBLICERING Section */}
        <div className="space-y-1.5 mt-4 pt-4 border-t border-border-subtle">
          <div className="px-2 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
            {t('navigation.sectionPublishing')}
          </div>
          <div className="space-y-1">
            {renderNavItem({ id: 'calendar', label: t('navigation.calendar'), icon: CalendarIcon, path: '/dashboard/calendar' })}
            {renderNavItem({ id: 'social', label: t('navigation.socialMedia'), icon: ShareIcon, path: '/dashboard/social-media' })}
          </div>
        </div>

        {/* Performance (single item) */}
        <div className="space-y-1">
          {renderNavItem({ id: 'analytics', label: t('navigation.analytics'), icon: ChartBarIcon, path: '/dashboard/analytics' })}
        </div>

        {/* Divider */}
        <div className="border-t border-border"></div>

        {/* INDSTILLINGER Section */}
        <div className="space-y-1.5">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 text-xs font-semibold text-text-muted hover:bg-surface-alt uppercase tracking-wide"
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

      {/* Bottom - Tier Badge */}
      <div className="px-3 py-3 border-t border-border">
        <button
          onClick={() => navigate('/dashboard/plans')}
          className="w-full px-3 py-2 rounded-lg bg-cta-surface border border-cta-surface hover:border-cta transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <div className="text-xs font-semibold text-brand">
                {currentTier === 'free' && t('navigation.tier.free')}
                {currentTier === 'standardplus' && t('navigation.tier.standard')}
                {currentTier === 'premium' && t('navigation.tier.premium')}
              </div>
              <div className="text-xs text-cta">
                {currentTier !== 'premium' && t('navigation.tier.upgrade')}
                {currentTier === 'premium' && t('navigation.tier.unlocked')}
              </div>
            </div>
            <span className="text-lg">
              {currentTier === 'free' && '🆓'}
              {currentTier === 'standardplus' && '⭐'}
              {currentTier === 'premium' && '💎'}
            </span>
          </div>
        </button>
        
        <div className="text-xs text-text-muted text-center mt-3">
          Post2Grow © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}