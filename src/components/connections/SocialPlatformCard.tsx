import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui'

interface SocialPlatformCardProps {
  platform: 'facebook' | 'instagram'
  isConnected: boolean
  isEnabled: boolean
  onConnect: () => void
  onDisconnect: () => void
  onToggleEnabled: (enabled: boolean) => void
}

export function SocialPlatformCard({ 
  platform, 
  isConnected, 
  isEnabled,
  onConnect, 
  onDisconnect,
  onToggleEnabled
}: SocialPlatformCardProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)

  const handleAction = async () => {
    setIsLoading(true)
    try {
      if (isConnected) {
        await onDisconnect()
      } else {
        await onConnect()
      }
    } finally {
      setIsLoading(false)
    }
  }

  const platformIcons = {
    facebook: '📘',
    instagram: '📷'
  }

  const platformColors = {
    facebook: 'from-blue-500 to-blue-600',
    instagram: 'from-purple-500 to-pink-500'
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all duration-200 ${
      !isEnabled ? 'opacity-60' : ''
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${platformColors[platform]} flex items-center justify-center text-white text-sm`}>
            {platformIcons[platform]}
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              {t(`connections.${platform}`)}
            </h3>
            <p className={`text-xs ${
              isConnected && isEnabled ? 'text-green-600' : 
              isEnabled ? 'text-red-500' : 'text-gray-500'
            }`}>
              {isConnected && isEnabled ? t('connections.connected') : 
               isEnabled ? t('connections.notConnected') : t('connections.disabled')}
            </p>
          </div>
        </div>

        {/* Enable/Disable Checkbox */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
            />
            <span className="text-sm text-gray-600">{t('connections.enable')}</span>
          </label>
          
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              isConnected && isEnabled ? 'bg-green-500' : 
              isEnabled ? 'bg-red-500' : 'bg-gray-300'
            }`} />
            <span className="text-sm text-gray-600">{t('connections.status')}</span>
          </div>
        </div>
      </div>

      {/* Benefits List */}
      {isEnabled && (
        <div className="mb-3 p-2 bg-blue-50 rounded-lg">
          <h4 className="text-xs font-medium text-blue-800 mb-1">Benefits:</h4>
          <ul className="text-xs text-blue-700 space-y-0.5">
            <li>✓ {t('connections.benefits.autoPost')}</li>
            <li>✓ {t('connections.benefits.analytics')}</li>
            <li>✓ {t('connections.benefits.scheduling')}</li>
          </ul>
        </div>
      )}

      {/* Disabled Notice */}
      {!isEnabled && (
        <div className="mb-3 p-2 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            Enable this platform to connect and start posting.
          </p>
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={handleAction}
        loading={isLoading}
        variant={isConnected ? 'secondary' : 'primary'}
        disabled={!isEnabled}
        size="sm"
        className="w-full h-8 text-xs"
      >
        {isConnected ? t('connections.disconnect') : t('connections.connect')}
      </Button>
    </div>
  )
}