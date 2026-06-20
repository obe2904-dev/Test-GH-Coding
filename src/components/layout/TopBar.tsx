import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import CountrySelector from '../CountrySelector'
import { useAuthStore } from '../../stores/authStore'
import { useBusinessData } from '../../hooks/useBusinessData'
import { useAllPublishedPosts, useManualPostingCount } from '../../hooks/usePublishedPosts'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { useTierStore } from '../../stores/tierStore'

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

const MenuIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

export function TopBar({ className = '' }: TopBarProps) {
  const { user, signOut } = useAuthStore()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { business } = useBusinessData()
  const { posts } = useAllPublishedPosts(business?.id ?? null)
  const { isConnected } = useConnectionsStore()
  const manualPostCount = useManualPostingCount(posts, isConnected)
  const currentTier = useTierStore((state) => state.currentTier)

  const [notificationOpen, setNotificationOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Use fullName from metadata if available, otherwise fall back to email username
  const fullName = user?.user_metadata?.fullName
  const displayName = fullName || user?.email?.split('@')[0] || 'User'
  const displayEmail = user?.email || 'user@example.com'
  
  // Get initials: first letter of first name and last name if available, otherwise first letter of display name
  const getInitials = () => {
    if (fullName) {
      const names = fullName.trim().split(' ')
      if (names.length >= 2) {
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase()
      }
      return fullName.charAt(0).toUpperCase()
    }
    return displayName.charAt(0).toUpperCase()
  }

  const userData = {
    name: displayName,
    email: displayEmail,
    initials: getInitials(),
  }

  const toggleNotifications = () => {
    setNotificationOpen((prev) => {
      const next = !prev
      if (next) {
        setUserMenuOpen(false)
      }
      return next
    })
  }

  const toggleUserMenu = () => {
    setUserMenuOpen((prev) => {
      const next = !prev
      if (next) {
        setNotificationOpen(false)
      }
      return next
    })
  }

  return (
    <header className={`w-full bg-white border-b border-slate-200 px-4 flex items-center ${className}`} style={{ height: '64px' }}>
      {/* Left Side - Dashboard Link */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all"
      >
        <MenuIcon className="w-5 h-5 text-slate-500" />
        <span>{t('navigation.mainMenu')}</span>
      </button>

      {/* Right Side - Language, Notifications, User Menu */}
      <div className="ml-auto flex items-center gap-3">
        {/* Country Selector (drives UI language) */}
        <CountrySelector />

        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={toggleNotifications}
            className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg transition-all relative"
          >
            <BellIcon className="w-5 h-5 text-slate-600" />
            {manualPostCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 border-2 border-white">
                {manualPostCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {notificationOpen && (
            <div className="absolute right-0 mt-1 w-96 bg-white rounded-lg shadow-lg border border-slate-200 p-3 z-50">
              <div className="px-2 py-2 border-b border-slate-200 mb-2">
                <h3 className="text-sm font-bold text-slate-800">
                  {t('notifications.title', 'Notifikationer')}
                </h3>
                {posts.filter(p => p.status === 'scheduled').length > 0 && (
                  <p className="text-xs text-slate-600 mt-0.5">
                    {posts.filter(p => p.status === 'scheduled').length} planlagte opslag
                    {manualPostCount > 0 && (
                      <span className="text-amber-700"> · {manualPostCount} behøver manuel posting</span>
                    )}
                  </p>
                )}
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {/* All scheduled posts - sorted by date */}
                {posts
                  .filter(p => p.status === 'scheduled')
                  .sort((a, b) => {
                    const dateA = a.scheduledFor ?? a.postedAt
                    const dateB = b.scheduledFor ?? b.postedAt
                    return dateA.getTime() - dateB.getTime()
                  })
                  .slice(0, 10)
                  .map(post => {
                    const date = post.scheduledFor ?? post.postedAt
                    const dateStr = date.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })
                    const timeStr = date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
                    const title = post.menuItemName || post.contentType || 'Opslag'
                    const needsManualPosting = !isConnected(post.platform.toLowerCase())
                    
                    return (
                      <button
                        key={post.id}
                        onClick={() => {
                          setNotificationOpen(false)
                          navigate('/dashboard/calendar')
                        }}
                        className={`w-full px-3 py-2.5 hover:bg-opacity-80 rounded transition-all text-left border ${
                          needsManualPosting 
                            ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-50' 
                            : 'border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/50'
                        }`}
                      >
                        <div className={`text-sm font-medium flex items-center gap-2 ${
                          needsManualPosting ? 'text-amber-900' : 'text-indigo-900'
                        }`}>
                          <span>{needsManualPosting ? '⚠️' : '🤖'}</span>
                          {post.platform} - {title}
                        </div>
                        <div className={`text-xs mt-1 ${
                          needsManualPosting ? 'text-amber-700' : 'text-indigo-700'
                        }`}>
                          Planlagt til {dateStr} {timeStr} {needsManualPosting ? '- Manuel posting påkrævet' : '- Planlagt auto-post'}
                        </div>
                      </button>
                    )
                  })}
                
                {posts.filter(p => p.status === 'scheduled').length === 0 && (
                  <div className="px-3 py-6 text-center">
                    <div className="text-3xl mb-2">📅</div>
                    <p className="text-sm text-slate-600">
                      Ingen planlagte opslag
                    </p>
                  </div>
                )}
                
                {posts.filter(p => p.status === 'scheduled').length > 10 && (
                  <button
                    onClick={() => {
                      setNotificationOpen(false)
                      navigate('/dashboard/calendar')
                    }}
                    className="w-full px-3 py-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Se alle {posts.filter(p => p.status === 'scheduled').length} planlagte opslag →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button 
            onClick={toggleUserMenu}
            className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 rounded-lg transition-all"
          >
            <div className="w-9 h-9 bg-gradient-to-br from-cta to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {userData.initials}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium text-slate-800">{userData.name}</div>
              <div className="text-xs text-slate-500">{userData.email}</div>
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
              </div>

              {/* Menu Items */}
              <div className="space-y-1">
                <button 
                  onClick={() => navigate('/dashboard/my-profile')}
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
                  {currentTier !== 'premium' && <span className="text-xs">⭐</span>}
                </button>
                <button 
                  onClick={() => navigate('/dashboard/settings')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left font-medium text-slate-700 hover:bg-slate-50 rounded transition-all"
                >
                  <SettingsIcon className="w-4 h-4" />
                  <div className="flex flex-col">
                    <span>{t('navigation.settings', 'Indstillinger')}</span>
                    <span className="text-xs font-normal text-slate-500">{t('settings.timeFormatHint', 'Tidsformat & præferencer')}</span>
                  </div>
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