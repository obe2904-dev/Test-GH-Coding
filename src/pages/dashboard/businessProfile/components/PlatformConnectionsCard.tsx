import type { TFunction } from 'i18next'

interface PlatformConnectionsCardProps {
  t: TFunction
  active: boolean
  onActivate: () => void
  isConnected: (platform: 'facebook' | 'instagram') => boolean
  savingPlatform: string | null
  savedPlatform: string | null
  onConnect: (platform: 'facebook' | 'instagram') => void
  onDisconnect: (platform: 'facebook' | 'instagram') => void
}

export function PlatformConnectionsCard({
  t,
  active,
  onActivate,
  isConnected,
  savingPlatform,
  savedPlatform,
  onConnect,
  onDisconnect
}: PlatformConnectionsCardProps) {
  const showHighlightedState = active && (isConnected('facebook') || isConnected('instagram'))
  const borderColorClass = active ? 'border-brand' : 'border-gray-200'
  const borderWidthClass = active ? 'border-4' : 'border-2'
  const shadowClass = active ? (showHighlightedState ? 'shadow-lg' : 'shadow-sm') : 'shadow-sm'

  const handleToggle = (platform: 'facebook' | 'instagram', checked: boolean) => {
    if (checked) {
      onConnect(platform)
    } else {
      onDisconnect(platform)
    }
  }

  return (
    <div
      id="social-media"
      onClick={onActivate}
      className={`bg-white rounded-lg ${borderWidthClass} p-6 transition-all duration-300 cursor-pointer ${borderColorClass} ${shadowClass}`}
      style={{
        boxShadow: active ? 'rgba(0,0,0,0.03) 0px 4px 10px' : 'rgba(0,0,0,0.02) 0px 2px 6px'
      }}
    >
      <div className="mb-4">
        <h2
          className={`text-lg mb-2 ${
            active && (isConnected('facebook') || isConnected('instagram'))
              ? 'font-extrabold text-brand'
              : 'font-bold text-gray-900'
          }`}
        >
          {t('businessProfile.frame2.title')}
        </h2>
        <p className="text-sm text-gray-700 mb-2">
          {t('businessProfile.frame2.subtitle')}
        </p>
        <p className="text-xs text-gray-600 leading-relaxed">
          <strong>{t('businessProfile.frame2.supportText1')}</strong><br />
          — {t('businessProfile.frame2.supportText2')}<br />
          — {t('businessProfile.frame2.supportText3')}<br /><br />
          {t('businessProfile.frame2.supportText4')}
        </p>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(['facebook', 'instagram'] as const).map((platform) => {
            const connected = isConnected(platform)
            const isSaving = savingPlatform === platform
            const wasJustSaved = savedPlatform === platform

            const platformCopy = platform === 'facebook' ? {
              label: 'Facebook',
              icon: (
                <svg className={`w-4 h-4 ${connected ? 'text-brand' : 'text-[#9CA3AF]'}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              )
            } : {
              label: 'Instagram',
              icon: (
                <svg className={`w-4 h-4 ${connected ? 'text-brand' : 'text-[#9CA3AF]'}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              )
            }

            return (
              <label
                key={platform}
                className={`flex items-center justify-between px-3 py-2 border rounded-lg cursor-pointer transition-colors h-10 ${
                  connected ? 'border-accent bg-[#F4F1FE]' : 'border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {platformCopy.icon}
                  <span className={`text-xs font-medium ${connected ? 'text-brand' : 'text-[#374151]'}`}>
                    {platformCopy.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isSaving && (
                    <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  )}
                  {wasJustSaved && (
                    <span className="text-xs font-medium text-green-600">Gemt</span>
                  )}
                  {!isSaving && !wasJustSaved && !connected && (
                    <span className="text-xs font-medium text-gray-400">Ikke gemt</span>
                  )}
                  <div className={`w-4 h-4 rounded flex items-center justify-center ${
                    connected ? 'bg-mint' : 'bg-white border border-[#D1D5DB]'
                  }`}>
                    {connected && (
                      <svg className="w-3 h-3 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={connected}
                    disabled={isSaving}
                    onChange={(event) => {
                      event.stopPropagation()
                      handleToggle(platform, event.target.checked)
                    }}
                    onClick={(event) => event.stopPropagation()}
                    className="sr-only"
                  />
                </div>
              </label>
            )
          })}
        </div>
        <button
          disabled={!isConnected('facebook') && !isConnected('instagram')}
          className="w-full px-6 py-2 bg-brand text-mint rounded-lg text-sm font-semibold shadow-md hover:bg-[#12393D] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Forbind dine profiler til automatisk posting
        </button>
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Du har fuld kontrol —der postes kun det, du vil have
          </p>
        </div>
      </div>
    </div>
  )
}
