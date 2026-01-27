import { useState, useEffect, lazy, Suspense } from 'react'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { usePostCreationStore } from '../../stores/postCreationStore'
import { useDraftSave, UNSAVED_CHANGES_MESSAGE } from '../../hooks/useDraftSave'
import { useDraftAutoRecover } from '../../hooks/useDraftAutoRecover'
import { DraftRecoveryModal } from '../../components/ui/DraftRecoveryModal'
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt'

// Lazy load post creation steps for better performance
const GenerateStep = lazy(() => import('../../components/post-creation/GenerateStep').then(m => ({ default: m.GenerateStep })))
const CreateStep = lazy(() => import('../../components/post-creation/CreateStep').then(m => ({ default: m.CreateStep })))
const PublishStep = lazy(() => import('../../components/post-creation/PublishStep').then(m => ({ default: m.PublishStep })))

// Loading component
const StepLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4 motion-reduce:animate-none"></div>
      <p className="text-sm text-muted">Loading...</p>
    </div>
  </div>
)

export function CreatePostPage() {
  const { isEnabled, loadPlatformsFromDatabase } = useConnectionsStore()
  const { setSelectedPlatforms } = usePostCreationStore()
  const [currentStep, setCurrentStep] = useState<'generate' | 'create' | 'publish'>('generate')

  // Draft save and recovery hooks
  const { showRecoveryPrompt, recoverDraft, discardDraft } = useDraftAutoRecover()
  const { markAsChanged, markAsSaved, hasUnsavedChanges } = useDraftSave()

  useUnsavedChangesPrompt(hasUnsavedChanges, UNSAVED_CHANGES_MESSAGE)

  // Load platforms from database on mount
  useEffect(() => {
    loadPlatformsFromDatabase()
  }, [loadPlatformsFromDatabase])

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
      {/* Draft Recovery Modal */}
      <DraftRecoveryModal 
        isOpen={showRecoveryPrompt}
        onRecover={recoverDraft}
        onDiscard={discardDraft}
      />

      <div className="max-w-6xl mx-auto space-y-4">
        
        {/* Step-Specific Content */}
        <div className="transition-all duration-200 ease-in-out">
          <Suspense fallback={<StepLoader />}>
            {currentStep === 'generate' && (
              <div key="generate" className="relative">
                <GenerateStep 
                  onNext={handleGenerateNext}
                  onStepClick={handleStepClick}
                  markAsChanged={markAsChanged}
                  markAsSaved={markAsSaved}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              </div>
            )}
            
            {currentStep === 'create' && (
              <div key="create" className="relative">
                <CreateStep 
                  onNext={handleCreateNext}
                  onBack={handleCreateBack}
                  onStepClick={handleStepClick}
                  markAsChanged={markAsChanged}
                  markAsSaved={markAsSaved}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              </div>
            )}
            
            {currentStep === 'publish' && (
              <div key="publish" className="relative">
                <PublishStep 
                  onNext={handlePublishNext}
                  onBack={handlePublishBack}
                  onStepClick={handleStepClick}
                  markAsSaved={markAsSaved}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              </div>
            )}
          </Suspense>
        </div>
      </div>
    </div>
  )
}