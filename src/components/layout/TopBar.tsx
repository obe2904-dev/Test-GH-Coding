import { useAuthStore } from '../../stores/authStore'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { DateFormatSwitcher } from '../DateFormatSwitcher'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

interface TopBarProps {
  className?: string
}

// Icon Components
const BellIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
)

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const GlobeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
  </svg>
)

const UsersIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75"/>
  </svg>
)

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3m15.364 6.364l-4.243-4.243m-6.364 0l-4.243 4.243m12.728 0l-4.243 4.243m-6.364 0l-4.243-4.243"/>
  </svg>
)

const LogOutIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9"/>
  </svg>
)

export function TopBar({ className = '' }: TopBarProps) {
  const { user, signOut } = useAuthStore()
  const { t } = useTranslation()
  const navigate = useNavigate()
  
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // TODO: Get user data from store
  const userData = {
    name: user?.email?.split('@')[0] || 'User',
    email: user?.email || 'user@example.com',
    plan: 'Gratis'
  }

  return (
    <header className={`bg-white border-b border-slate-200 px-4 flex items-center justify-between ${className}`} style={{ height: '64px' }}>
      {/* Left Section - Welcome Message */}
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">
            {t('welcome.message', 'Velkommen tilbage, {{name}}! 👋', { name: userData.name })}
          </h2>
          <p className="text-sm text-slate-500">
            {t('welcome.subtitle', 'Klar til at lave noget fantastisk indhold i dag?')}
          </p>
        </div>
      </div>

      {/* Right Section - Notifications & User */}
      <div className="flex items-center gap-3">
        {/* Date Format Switcher */}
        <DateFormatSwitcher />
        
        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => setNotificationOpen(!notificationOpen)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg transition-all relative"
          >
            <BellIcon className="w-5 h-5 text-slate-600" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
          </button>

          {/* Notification Dropdown */}
          {notificationOpen && (
            <div className="absolute right-0 mt-1 w-80 bg-white rounded-lg shadow-lg border border-slate-200 p-3 z-50">
              <div className="px-2 py-2 border-b border-slate-200 mb-2">
                <h3 className="text-sm font-bold text-slate-800">
                  {t('notifications.title', 'Notifikationer')}
                </h3>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <div className="px-3 py-2.5 hover:bg-slate-50 rounded transition-all">
                  <div className="text-sm font-medium text-slate-800">
                    {t('notifications.postScheduled', 'Nyt opslag planlagt')}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {t('notifications.postScheduledDesc', 'Dit opslag er planlagt til i morgen kl. 10:00')}
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5">
                    {t('notifications.time.hoursAgo', 'For 2 timer siden')}
                  </div>
                </div>
                <div className="px-3 py-2.5 hover:bg-slate-50 rounded transition-all">
                  <div className="text-sm font-medium text-slate-800">
                    {t('notifications.performanceUpdate', 'Performance opdatering')}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {t('notifications.performanceDesc', 'Dit seneste opslag har 234 visninger')}
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5">
                    {t('notifications.time.yesterday', 'I går')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button 
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 rounded-lg transition-all"
          >
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {userData.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium text-slate-800">{userData.name}</div>
              <div className="text-xs text-slate-500">{userData.plan}</div>
            </div>
            <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* User Dropdown Menu */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-slate-200 p-2 z-50">
              {/* User Info Header */}
              <div className="px-3 py-2.5 border-b border-slate-200 mb-2">
                <div className="text-sm font-bold text-slate-800">{userData.name}</div>
                <div className="text-xs text-slate-600">{userData.email}</div>
                <div className="mt-1.5">
                  <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-full font-medium">
                    {userData.plan}
                  </span>
                </div>
              </div>

              {/* Menu Items */}
              <div className="space-y-1">
                <button 
                  onClick={() => navigate('/dashboard/profile')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded transition-all"
                >
                  <UserIcon className="w-4 h-4" />
                  {t('navigation.profile', 'Min Profil')}
                </button>
                <button 
                  onClick={() => navigate('/dashboard/profile')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded transition-all"
                >
                  <GlobeIcon className="w-4 h-4" />
                  {t('navigation.businessProfile', 'Virksomhedsprofil')}
                </button>
                <button 
                  onClick={() => navigate('/dashboard/team')}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <UsersIcon className="w-4 h-4" />
                    {t('navigation.team', 'Team & Brugere')}
                  </div>
                  {userData.plan !== 'Premium' && <span className="text-xs">⭐</span>}
                </button>
                <button 
                  onClick={() => navigate('/dashboard/settings')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded transition-all"
                >
                  <SettingsIcon className="w-4 h-4" />
                  {t('navigation.settings', 'Indstillinger')}
                </button>
                
                <div className="border-t border-slate-200 my-1.5"></div>
                
                <button 
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-all"
                >
                  <LogOutIcon className="w-4 h-4" />
                  {t('auth.signOut', 'Log ud')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}