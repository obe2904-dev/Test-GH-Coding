import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useConnectionsStore } from '../stores/connectionsStore'

// ══════════════════════════════════════════
// TYPE DEFINITIONS
// ══════════════════════════════════════════

// ══════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════

// ══════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════

export function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  
  // ── Form State ──
  const [businessName, setBusinessName] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook'])
  
  // ── Submission State ──
  const [isSaving, setIsSaving] = useState(false)
  
  // ── Refs ──
  const submittedRef = useRef(false)
  const mountedRef = useRef(false)
  const [shouldShowForm, setShouldShowForm] = useState(false)
  
  // ══════════════════════════════════════════
  // MOUNT/UNMOUNT GUARDS
  // ══════════════════════════════════════════
  
  useEffect(() => {
    const submissionTimestampKey = 'onboarding:submitting:timestamp'
    const lastSubmissionTime = localStorage.getItem(submissionTimestampKey)
    
    if (lastSubmissionTime) {
      const timeSinceLastSubmission = Date.now() - parseInt(lastSubmissionTime, 10)
      if (timeSinceLastSubmission < 5000) {
        console.log('⚠️ OnboardingPage mounted but submission happened recently, redirecting away', {
          timeSinceLastSubmission
        })
        navigate('/dashboard', { replace: true })
        return
      }
    }
    
    mountedRef.current = true
    setShouldShowForm(true)
    console.log('✅ OnboardingPage mounted', { timestamp: Date.now() })
  }, [navigate])

  // ══════════════════════════════════════════
  // PLATFORM SELECTION
  // ══════════════════════════════════════════
  
  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  // ══════════════════════════════════════════
  // FINAL SUBMIT
  // ══════════════════════════════════════════

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    console.log('🔵 handleFinalSubmit called', { 
      submittedRef: submittedRef.current,
      mountedRef: mountedRef.current,
      timestamp: Date.now()
    })
    
    if (!mountedRef.current) {
      console.log('⚠️ Component not fully mounted yet, ignoring submission')
      setIsSaving(false)
      return
    }
    
    const submissionKey = 'onboarding:submitting'
    const submissionTimestampKey = 'onboarding:submitting:timestamp'
    
    const lastSubmissionTime = localStorage.getItem(submissionTimestampKey)
    if (lastSubmissionTime) {
      const timeSinceLastSubmission = Date.now() - parseInt(lastSubmissionTime, 10)
      if (timeSinceLastSubmission < 3000) {
        console.log('⚠️ Onboarding submitted recently, ignoring duplicate')
        setIsSaving(false)
        return
      }
    }
    
    if (localStorage.getItem(submissionKey) === 'true' || submittedRef.current) {
      console.log('⚠️ Onboarding already submitted, ignoring')
      setIsSaving(false)
      return
    }

    submittedRef.current = true
    localStorage.setItem(submissionKey, 'true')
    localStorage.setItem(submissionTimestampKey, Date.now().toString())
    console.log('✅ Marked as submitted, proceeding')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert(t('onboarding.notLoggedIn'))
        navigate('/login')
        submittedRef.current = false
        localStorage.removeItem(submissionKey)
        localStorage.removeItem(submissionTimestampKey)
        return
      }

      // Call onboarding RPC with minimal payload
      const { data: businessId, error: onboardingError } = await (supabase as any)
        .rpc('create_business_onboarding', {
          p_user_id: user.id,
          p_business_name: businessName.trim() || 'My Business',
          p_selected_platforms: selectedPlatforms.length > 0 ? selectedPlatforms : ['facebook'],
        })

      if (onboardingError) {
        console.error('Onboarding error:', onboardingError)
        alert(`Fejl: ${onboardingError.message || 'Kunne ikke gemme. Prøv igen.'}`)
        submittedRef.current = false
        localStorage.removeItem(submissionKey)
        localStorage.removeItem(submissionTimestampKey)
        setIsSaving(false)
        return
      }

      console.log('✅ Business created:', businessId)

      // Prime the in-memory platform store so the dashboard reflects the saved
      // selections immediately in the same session.
      const { togglePlatformEnabled } = useConnectionsStore.getState()
      const finalPlatforms = selectedPlatforms.length > 0 ? selectedPlatforms : ['facebook']
      finalPlatforms.forEach((platform) => togglePlatformEnabled(platform, true))

      // Store onboarding data in localStorage for immediate use
      if (typeof window !== 'undefined') {
        localStorage.setItem(`onboarding:completed:${user.id}`, 'true')
        localStorage.setItem('onboarding:platforms', JSON.stringify(finalPlatforms))
        localStorage.setItem('onboarding:activePlatform', finalPlatforms[0])
        localStorage.setItem('onboarding:businessId', businessId)
      }

      // Navigate to dashboard
      localStorage.setItem('onboarding:navigating', 'true')
      navigate('/dashboard', { replace: true })
      
      setTimeout(() => {
        localStorage.removeItem('onboarding:navigating')
        localStorage.removeItem(submissionKey)
        setTimeout(() => localStorage.removeItem(submissionTimestampKey), 5000)
      }, 1000)

    } catch (error) {
      console.error('Error during onboarding:', error)
      alert(t('onboarding.error'))
      submittedRef.current = false
      localStorage.removeItem(submissionKey)
      localStorage.removeItem(submissionTimestampKey)
    } finally {
      setIsSaving(false)
    }
  }

  // ══════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════

  if (!shouldShowForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand border-t-mint rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-700 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('onboarding.welcome')}
          </h1>
          <p className="text-lg text-gray-700">
            {t('onboarding.subtitleNew')}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleFinalSubmit} className="space-y-6">
            
            {/* Business Name (Optional) */}
            <div>
              <label htmlFor="businessName" className="block text-sm font-semibold text-gray-900 mb-2">
                {t('onboarding.businessNameLabelNew')}
              </label>
              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={t('onboarding.businessNamePlaceholder')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint focus:border-mint text-base"
              />
              <p className="text-sm text-gray-500 mt-1">{t('onboarding.optional')}</p>
            </div>

            {/* Platform Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                {t('onboarding.step2Title')}
              </label>
              <div className="space-y-3">
                {/* Facebook */}
                <label className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-mint transition-all cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes('facebook')}
                    onChange={() => togglePlatform('facebook')}
                    className="w-5 h-5 mt-0.5 text-mint rounded focus:ring-mint"
                  />
                  <div className="flex-1">
                    <span className="text-base font-semibold text-gray-900">Facebook</span>
                    <p className="text-sm text-gray-600">{t('onboarding.facebookHashtags')}</p>
                  </div>
                </label>

                {/* Instagram */}
                <label className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-mint transition-all cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes('instagram')}
                    onChange={() => togglePlatform('instagram')}
                    className="w-5 h-5 mt-0.5 text-mint rounded focus:ring-mint"
                  />
                  <div className="flex-1">
                    <span className="text-base font-semibold text-gray-900">Instagram</span>
                    <p className="text-sm text-gray-600">{t('onboarding.instagramHashtags')}</p>
                  </div>
                </label>
              </div>
              <p className="text-sm text-gray-500 mt-2">{t('onboarding.optional')}</p>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full px-6 py-3 bg-cta text-text-inverse rounded-lg text-base font-medium shadow-md hover:bg-cta-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? t('onboarding.saving') : t('onboarding.continueToFirstPost')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
