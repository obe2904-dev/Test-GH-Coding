import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SocialPlatformCard } from '../../components/connections'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { GenerateStep, CreateStep, PublishStep } from '../../components/post-creation'
import { usePostCreationStore } from '../../stores/postCreationStore'

export function CreatePostPage() {
  const { isEnabled } = useConnectionsStore()
  const { 
    setSelectedPlatforms
  } = usePostCreationStore()
  const [currentStep, setCurrentStep] = useState<'generate' | 'create' | 'publish'>('generate')

  // Initialize selected platforms with all enabled platforms
  useEffect(() => {
    const availablePlatforms = ['facebook', 'instagram'].filter(platform => 
      isEnabled(platform)
    )
    setSelectedPlatforms(availablePlatforms)
  }, [isEnabled, setSelectedPlatforms])

  // Navigation handlers for 3-step flow
  const handleGenerateNext = () => {
    setCurrentStep('create')
  }

  const handleCreateNext = () => {
    setCurrentStep('publish')
  }

  const handleCreateBack = () => {
    setCurrentStep('generate')
  }

  const handlePublishNext = () => {
    // Handle final publication or redirect
    console.log('Post published!')
  }

  const handlePublishBack = () => {
    setCurrentStep('create')
  }

  const handleStepClick = (step: number) => {
    const steps = ['generate', 'create', 'publish'] as const
    setCurrentStep(steps[step - 1])
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 py-3 px-3 min-h-full">
      <div className="max-w-6xl mx-auto space-y-4">
        
        {/* Step-Specific Content */}
        <div className="transition-all duration-200 ease-in-out">
          <div>
            {currentStep === 'generate' && (
              <div key="generate" className="relative">
                <GenerateStep 
                  onNext={handleGenerateNext}
                  onStepClick={handleStepClick}
                />
              </div>
            )}
            
            {currentStep === 'create' && (
              <div key="create" className="relative">
                <CreateStep 
                  onNext={handleCreateNext}
                  onBack={handleCreateBack}
                  onStepClick={handleStepClick}
                />
              </div>
            )}
            
            {currentStep === 'publish' && (
              <div key="publish" className="relative">
                <PublishStep 
                  onNext={handlePublishNext}
                  onBack={handlePublishBack}
                  onStepClick={handleStepClick}
                />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export function BusinessProfilePage() {
  const { t } = useTranslation()
  const { 
    connectPlatform, 
    disconnectPlatform, 
    togglePlatformEnabled, 
    isConnected, 
    isEnabled 
  } = useConnectionsStore()

  const handleConnect = async (platform: 'facebook' | 'instagram') => {
    // TODO: Implement OAuth flow - for now just simulate
    await connectPlatform(platform)
  }

  const handleDisconnect = async (platform: 'facebook' | 'instagram') => {
    await disconnectPlatform(platform)
  }

  const handleToggleEnabled = (platform: 'facebook' | 'instagram', enabled: boolean) => {
    togglePlatformEnabled(platform, enabled)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Social Media Connections Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            {t('connections.title')}
          </h2>
          <p className="text-sm text-gray-600">
            {t('connections.description')}
          </p>
        </div>
        
        <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SocialPlatformCard
              platform="facebook"
              isConnected={isConnected('facebook')}
              isEnabled={isEnabled('facebook')}
              onConnect={() => handleConnect('facebook')}
              onDisconnect={() => handleDisconnect('facebook')}
              onToggleEnabled={(enabled) => handleToggleEnabled('facebook', enabled)}
            />
            <SocialPlatformCard
              platform="instagram"
              isConnected={isConnected('instagram')}
              isEnabled={isEnabled('instagram')}
              onConnect={() => handleConnect('instagram')}
              onDisconnect={() => handleDisconnect('instagram')}
              onToggleEnabled={(enabled) => handleToggleEnabled('instagram', enabled)}
            />
          </div>
        </div>
      </div>

      {/* Business Homepage URL Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-4">
          <h2 className="text-base font-medium text-gray-900 mb-2">
            {t('business.homepageUrl')}
          </h2>
          <p className="text-xs text-gray-600">
            {t('business.homepageDescription')}
          </p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="homepage-url" className="block text-xs font-medium text-gray-700 mb-2">
              {t('business.websiteUrl')}
            </label>
            <input
              type="url"
              id="homepage-url"
              placeholder="https://www.your-business.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs">
              {t('business.analyzeWebsite')}
            </button>
            <span className="text-xs text-gray-500">
              {t('business.aiAnalysisNote')}
            </span>
          </div>
        </div>
      </div>

      {/* Placeholder for future sections */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-medium mb-4 text-gray-700">Coming Next:</h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
          <li>Business information and branding settings</li>
          <li>Account preferences and notifications</li>
          <li>Team management (for premium plans)</li>
          <li>API keys and integrations</li>
        </ul>
      </div>
    </div>
  )
}

export function CalendarPage() {
  const { t } = useTranslation()

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('navigation.calendar')}</h2>
        <p className="text-gray-600">
          Content calendar will be built here. This will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>Monthly/weekly calendar view</li>
          <li>Scheduled posts visualization</li>
          <li>Drag-and-drop rescheduling</li>
          <li>Content planning tools</li>
        </ul>
      </div>
    </div>
  )
}

export function AllPostsPage() {
  const { t } = useTranslation()

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{t('navigation.allPosts')}</h2>
        <p className="text-gray-600">
          Post management dashboard will be built here. This will include:
        </p>
        <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
          <li>List of all posts (published, scheduled, drafts)</li>
          <li>Post performance analytics</li>
          <li>Bulk editing and management</li>
          <li>Search and filtering</li>
        </ul>
      </div>
    </div>
  )
}