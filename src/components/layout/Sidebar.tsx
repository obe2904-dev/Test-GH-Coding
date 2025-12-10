import { useTranslation } from 'react-i18next'
import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'

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

const UsersIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75"/>
  </svg>
)

const QuestionMarkCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
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
  
  const [settingsOpen, setSettingsOpen] = useState(false)

  // TODO: Get user subscription plan from profile/settings
  const getUserPlan = (): 'Gratis' | 'Smart' | 'Pro' => {
    return 'Gratis' // This will be dynamic later
  }
  const userPlan = getUserPlan()

  const mainNavItems = [
    { id: 'create', label: t('navigation.createPost', 'Opret Opslag'), icon: PencilIcon, path: '/dashboard/create' },
    { id: 'profile', label: t('navigation.businessProfile', 'Virksomhedsprofil'), icon: GlobeIcon, path: '/dashboard/profile' },
    { id: 'calendar', label: t('navigation.calendar', 'Kalender'), icon: CalendarIcon, path: '/dashboard/calendar' },
    { id: 'posts', label: t('navigation.allPosts', 'Alle Opslag'), icon: DocumentTextIcon, path: '/dashboard/posts' },
    { id: 'analytics', label: t('navigation.analytics', 'Performance'), icon: ChartBarIcon, path: '/dashboard/analytics', badge: 'NY' }
  ]

  const settingsItems = [
    { id: 'team', label: t('navigation.team', 'Team & Brugere'), icon: UsersIcon, badge: userPlan === 'Pro' ? null : '⭐' },
    { id: 'settings', label: t('navigation.settings', 'Indstillinger'), icon: SettingsIcon },
    { id: 'help', label: t('navigation.help', 'Hjælp & Support'), icon: QuestionMarkCircleIcon },
    { id: 'contact', label: t('navigation.contact', 'Kontakt'), icon: null },
    { id: 'privacy', label: t('navigation.privacy', 'Privatliv'), icon: null },
    { id: 'terms', label: t('navigation.terms', 'Vilkår'), icon: null }
  ]

  return (
    <div className={`w-72 bg-white border-r border-slate-200 flex flex-col h-screen ${className}`}>
      {/* Logo */}
      <div className="px-4 py-4">
        <h1 className="text-2xl font-bold text-[#0F2E32]">
          Post2Grow
        </h1>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="space-y-1.5">
          {mainNavItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  `group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
                    isActive
                      ? 'bg-[#F4F1FE] text-[#0F2E32] border-l-[3px] border-[#C7BAF7]'
                      : 'text-[#9CA3AF] hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 my-3"></div>

        {/* Settings Section - Collapsible */}
        <div className="space-y-1.5">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium text-[#9CA3AF] hover:bg-slate-100 hover:text-slate-900"
          >
            <SettingsIcon className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">{t('navigation.settings', 'Indstillinger')}</span>
            <ChevronRightIcon className={`w-4 h-4 ml-auto transition-transform ${settingsOpen ? 'rotate-90' : ''}`} />
          </button>

          {settingsOpen && (
            <div className="ml-6 space-y-1 border-l-2 border-slate-200 pl-3">
              {settingsItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/dashboard/${item.id}`)}
                    className="group w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm text-[#9CA3AF] hover:bg-slate-50 hover:text-[#1F2937]"
                  >
                    {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                    {!Icon && <div className="w-4 h-4 flex-shrink-0"></div>}
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto text-xs">{item.badge}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Bottom spacing */}
      <div className="px-3 py-3 border-t border-slate-200">
        <div className="text-xs text-slate-500 text-center">
          Post2Grow © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}