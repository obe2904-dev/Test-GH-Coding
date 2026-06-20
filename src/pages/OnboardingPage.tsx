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
  
  // ── Step & Form State ──
  const [step, setStep] = useState(1)
  const [businessName, setBusinessName] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const defaultCountry = t('ui.country.default_name')
  const [country] = useState(defaultCountry)
  const [businessVertical, setBusinessVertical] = useState('cafe')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook'])
  
  // ── Postal Lookup State ──
  const [isFetchingCity, setIsFetchingCity] = useState(false)
  const [postalLookupError, setPostalLookupError] = useState<string | null>(null)
  
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
  // POSTAL CODE LOOKUP (with debouncing)
  // ══════════════════════════════════════════
  
  useEffect(() => {
    const sanitizedPostalCode = postalCode.trim()

    if (sanitizedPostalCode.length !== 4) {
      setIsFetchingCity(false)
      setCity('')
      setPostalLookupError(null)
      return
    }

    let isActive = true
    const timer = setTimeout(() => {
      const lookupCity = async () => {
        setIsFetchingCity(true)
        setPostalLookupError(null)

        try {
          const response = await fetch(`https://api.dataforsyningen.dk/postnumre/${sanitizedPostalCode}`)

          if (!response.ok) {
            throw new Error('POSTAL_LOOKUP_FAILED')
          }

          const data = await response.json()

          if (!isActive) return

          if (data?.navn) {
            setCity(data.navn)
            setPostalLookupError(null)
          } else {
            setCity('')
            setPostalLookupError(t('onboarding.postalLookupNotFound'))
          }
        } catch (error) {
          if (!isActive) return
          setCity('')
          setPostalLookupError(t('onboarding.postalLookupNotFound'))
        } finally {
          if (isActive) {
            setIsFetchingCity(false)
          }
        }
      }

      lookupCity()
    }, 500) // Debounce 500ms

    return () => {
      isActive = false
      clearTimeout(timer)
    }
  }, [postalCode, t])

  // ══════════════════════════════════════════
  // STEP 1: Business Name
  // ══════════════════════════════════════════
  
  const handleStep1Continue = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!businessName.trim()) {
      alert(t('onboarding.fillRequired'))
      return
    }

    setStep(2)
  }

  // ══════════════════════════════════════════
  // STEP 2: Postnummer + Location
  // ══════════════════════════════════════════
  
  const handleStep2Continue = () => {
    // Validate location
    const sanitizedPostalCode = postalCode.trim()
    if (sanitizedPostalCode.length !== 4 || !city.trim()) {
      alert(t('onboarding.postalValidation'))
      return
    }

    setStep(3)
  }

  // ══════════════════════════════════════════
  // STEP 3: Platform Selection + Final Submit
  // ══════════════════════════════════════════
  
  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  const handleFinalSubmit = async (platformsOverride?: string[]) => {
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
    
    const sanitizedPostalCode = postalCode.trim()
    if (sanitizedPostalCode.length !== 4 || !city.trim()) {
      alert(t('onboarding.postalValidation'))
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

      const finalPlatforms = platformsOverride?.length ? platformsOverride : selectedPlatforms
      if (finalPlatforms.length === 0) {
        alert(t('onboarding.fillRequired'))
        setIsSaving(false)
        return
      }

      // Call onboarding RPC
      const { data: businessId, error: onboardingError } = await (supabase as any)
        .rpc('create_business_onboarding', {
          p_user_id: user.id,
          p_business_name: businessName.trim(),
          p_business_vertical: businessVertical, // NO accent - 'cafe' not 'café'
          p_postal_code: sanitizedPostalCode,
          p_city: city.trim(),
          p_country: country,
          p_selected_platforms: finalPlatforms,
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

  const handleSkipPlatforms = async () => {
    // Use default (Facebook) and proceed
    const fallbackPlatforms = ['facebook']
    setSelectedPlatforms(fallbackPlatforms)
    await handleFinalSubmit(fallbackPlatforms)
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
        
        {/* Progress Indicator (3 steps now) */}
        <div className="flex items-center justify-center mb-8 gap-2">
          <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-mint' : 'bg-gray-300'}`} />
          <div className={`w-8 h-0.5 ${step >= 2 ? 'bg-mint' : 'bg-gray-300'}`} />
          <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-mint' : 'bg-gray-300'}`} />
          <div className={`w-8 h-0.5 ${step >= 3 ? 'bg-mint' : 'bg-gray-300'}`} />
          <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-mint' : 'bg-gray-300'}`} />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {step === 1 && t('onboarding.welcome')}
            {step === 2 && t('onboarding.manualTitle')}
            {step === 3 && t('onboarding.step2Title')}
          </h1>
          <p className="text-lg text-gray-700">
            {step === 1 && t('onboarding.subtitleNew')}
            {step === 2 && t('onboarding.manualSubtitle')}
            {step === 3 && t('onboarding.step2Subtitle')}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          
          {/* ═══════════════════════════════════════ */}
          {/* STEP 1: Business Name + Website URL     */}
          {/* ═══════════════════════════════════════ */}
          {step === 1 && (
            <form onSubmit={handleStep1Continue} className="space-y-6">
              
              {/* Business Name */}
              <div>
                <label htmlFor="businessName" className="block text-sm font-semibold text-gray-900 mb-2">
                  {t('onboarding.businessNameLabelNew')} *
                </label>
                <input
                  id="businessName"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder={t('onboarding.businessNamePlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint focus:border-mint text-base"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!businessName.trim()}
                className="w-full px-6 py-3 bg-cta text-text-inverse rounded-lg text-base font-medium shadow-md hover:bg-cta-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('onboarding.continue')}
              </button>
            </form>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* STEP 2: Postnummer                    */}
          {/* ═══════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    {t('onboarding.postalCodeLabel')} *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder={t('onboarding.postalCodePlaceholder')}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-mint text-base ${
                      postalLookupError ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {postalLookupError && (
                    <p className="text-sm text-red-600 mt-1">{postalLookupError}</p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleStep2Continue}
                  disabled={isFetchingCity || !city.trim()}
                  className="w-full px-6 py-3 bg-cta text-text-inverse rounded-lg text-base font-medium shadow-md hover:bg-cta-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('onboarding.continue')}
                </button>
                <button
                  onClick={() => setStep(1)}
                  disabled={isSaving}
                  className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg text-base font-medium hover:bg-gray-200 transition-all"
                >
                  {t('onboarding.back')}
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* STEP 3: Platform Selection              */}
          {/* ═══════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-4">
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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">💡 {t('onboarding.platformsHelperText')}</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleFinalSubmit()}
                  disabled={isSaving || selectedPlatforms.length === 0}
                  className="w-full px-6 py-3 bg-cta text-text-inverse rounded-lg text-base font-medium shadow-md hover:bg-cta-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSaving ? t('onboarding.saving') : t('onboarding.continueToFirstPost')}
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={isSaving}
                  className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg text-base font-medium hover:bg-gray-200 transition-all"
                >
                  {t('onboarding.back')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Skip link on step 3 */}
        {step === 3 && (
          <div className="text-center mt-4">
            <button
              onClick={handleSkipPlatforms}
              disabled={isSaving}
              className="text-sm text-gray-600 hover:text-gray-900 underline disabled:opacity-50"
            >
              {t('onboarding.skipPlatforms')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
