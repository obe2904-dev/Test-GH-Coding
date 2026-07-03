import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { PlatformConnectionsCard } from './businessProfile/components/PlatformConnectionsCard'
import { PlatformStatusPanel } from './businessProfile/components/PlatformStatusPanel'

function SocialMediaPage() {
  const { t } = useTranslation()
  
  const connectPlatform = useConnectionsStore((state) => state.connectPlatform)
  const disconnectPlatform = useConnectionsStore((state) => state.disconnectPlatform)
  const isEnabled = useConnectionsStore((state) => state.isEnabled)
  const loadPlatformsFromDatabase = useConnectionsStore((state) => state.loadPlatformsFromDatabase)

  const [directPostingConnected, setDirectPostingConnected] = useState({ facebook: false, instagram: false })
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null)
  const [savedPlatform, setSavedPlatform] = useState<string | null>(null)

  // Load platforms on mount
  useEffect(() => {
    loadPlatformsFromDatabase()
  }, [loadPlatformsFromDatabase])

  const handleConnect = async (platform: 'facebook' | 'instagram') => {
    setSavingPlatform(platform)
    try {
      await connectPlatform(platform)
      setSavedPlatform(platform)
      setTimeout(() => setSavedPlatform(null), 2000)
    } finally {
      setSavingPlatform(null)
    }
  }

  const handleDisconnect = async (platform: 'facebook' | 'instagram') => {
    try {
      await disconnectPlatform(platform)
    } catch (error) {
      console.error('Failed to disconnect platform:', error)
    }
  }

  const handleToggleDirectPosting = (platform: 'facebook' | 'instagram') => {
    setDirectPostingConnected(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-6 px-8">
        {/* Page Header */}
        <div className="max-w-6xl mx-auto mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Social Medier</h1>
          <p className="mt-1 text-sm text-gray-600">
            Tilslut og administrer dine sociale medier platforme
          </p>
        </div>

        {/* Platform Connections Card */}
        <div className="max-w-6xl mx-auto mb-6">
          <PlatformConnectionsCard
            t={t}
            active={true}
            onActivate={() => {}}
            isConnected={isEnabled as (platform: 'facebook' | 'instagram') => boolean}
            savingPlatform={savingPlatform}
            savedPlatform={savedPlatform}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>

        {/* Platform Status Panel */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg border-2 border-gray-200 shadow-md p-6">
            <PlatformStatusPanel
              isConnected={isEnabled as (platform: 'facebook' | 'instagram') => boolean}
              directPostingConnected={directPostingConnected}
              onToggleDirectPosting={handleToggleDirectPosting}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SocialMediaPage
