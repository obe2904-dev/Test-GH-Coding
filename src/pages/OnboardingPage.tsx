import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useTierStore } from '../stores/tierStore'
import { getPrimaryType, getBusinessTypeLabel, type BusinessType } from '../lib/businessTypeHelpers'

// ══════════════════════════════════════════
// TYPE DEFINITIONS
// ══════════════════════════════════════════

interface WebsiteAnalysis {
  businessName?: string
  businessType?: BusinessType  // Support both string and hybrid businessType
  shortDescription?: string
  logoUrl?: string
  contact?: {
    phone?: string
    email?: string
    address?: string | {
      street?: string
      postalCode?: string
      city?: string
      country?: string
    }
  }
  offerings?: {
    menuStructure?: Array<{
      category: string
      items?: Array<{ name: string; description?: string; price?: string }>
    }>
    dietaryOptions?: string[]
  }
  takeaway?: boolean
  delivery?: boolean
  outdoorSeating?: boolean
  detectedMenuUrls?: string[]
  establishmentType?: 'FSE' | 'SBO'
  keywords?: string[]
  menuSignal?: {
    hasMenu: boolean
    menuDescription?: string
    menuCategories?: string[]
    signatureItems?: string[]
  }
  error?: string
}

interface ManualSelection {
  servesCoffee: boolean
  servesFood: boolean
  servesDrinks: boolean
  servesBrunch: boolean
  servesBar: boolean
  servesTakeaway: boolean
}

// ══════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════

function countMenuItems(analysis: WebsiteAnalysis): number {
  // Use new menu_signal structure
  if (analysis.menuSignal?.signatureItems?.length) {
    return analysis.menuSignal.signatureItems.length
  }
  if (analysis.menuSignal?.menuCategories?.length) {
    return analysis.menuSignal.menuCategories.length
  }
  // Fallback to old structure
  const menu = analysis.offerings?.menuStructure || []
  return menu.reduce((sum, cat) => sum + (cat.items?.length || 0), 0)
}

function getSignatureItems(analysis: WebsiteAnalysis, limit: number): string[] {
  // Use new menu_signal structure
  if (analysis.menuSignal?.signatureItems?.length) {
    return analysis.menuSignal.signatureItems.slice(0, limit)
  }
  if (analysis.menuSignal?.menuCategories?.length) {
    return analysis.menuSignal.menuCategories.slice(0, limit)
  }
  // Fallback to old structure
  const menu = analysis.offerings?.menuStructure || []
  const items: string[] = []
  for (const cat of menu) {
    for (const item of cat.items || []) {
      if (items.length < limit) items.push(item.name)
    }
  }
  return items
}

function deriveVerticalFromAnalysis(analysis: WebsiteAnalysis): string {
  // Handle both string and hybrid businessType
  const businessTypeStr = analysis.businessType ? getPrimaryType(analysis.businessType) : ''
  const type = businessTypeStr.toLowerCase()
  
  // Map analyze-website types to BusinessVertical values
  if (type.includes('café') || type.includes('cafe')) return 'cafe'
  if (type.includes('restaurant')) return 'restaurant'
  if (type.includes('bar') || type.includes('wine')) return 'bar'
  if (type.includes('bakery') || type.includes('bageri')) return 'bakery'
  if (type.includes('food truck') || type.includes('street food')) return 'food_truck'
  
  // Default to cafe for food service establishments
  return 'cafe'
}

function deriveVerticalFromManual(selections: ManualSelection): string {
  // Priority mapping: most specific first
  if (selections.servesBar) return 'bar'
  if (selections.servesBrunch) return 'cafe'
  if (selections.servesCoffee) return 'cafe'
  if (selections.servesFood && selections.servesDrinks) return 'restaurant'
  if (selections.servesFood) return 'restaurant'
  if (selections.servesTakeaway) return 'food_truck'
  
  // Default
  return 'cafe'
}

function extractLocationFromAnalysis(analysis: WebsiteAnalysis): { postalCode: string; city: string } | null {
  const address = analysis.contact?.address
  
  if (typeof address === 'object' && address.postalCode && address.city) {
    return {
      postalCode: address.postalCode.replace(/\D/g, '').slice(0, 4),
      city: address.city
    }
  }
  
  if (typeof address === 'string') {
    // Try to extract postal code (4 digits in Denmark)
    const postalMatch = address.match(/\b(\d{4})\b/)
    const cityMatch = address.match(/\d{4}\s+([^\d,]+)/)
    
    if (postalMatch && cityMatch) {
      return {
        postalCode: postalMatch[1],
        city: cityMatch[1].trim()
      }
    }
  }
  
  return null
}

// ══════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════

export function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const tierStore = useTierStore()
  
  // ── Step & Form State ──
  const [step, setStep] = useState(1)
  const [businessName, setBusinessName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const defaultCountry = t('ui.country.default_name')
  const [country] = useState(defaultCountry)
  const [businessVertical, setBusinessVertical] = useState('cafe')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook'])
  
  // ── Website Analysis State ──
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<WebsiteAnalysis | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [useManualMode, setUseManualMode] = useState(false)
  
  // ── Manual Selection State ──
  const [manualSelections, setManualSelections] = useState<ManualSelection>({
    servesCoffee: false,
    servesFood: false,
    servesDrinks: false,
    servesBrunch: false,
    servesBar: false,
    servesTakeaway: false,
  })
  
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
        navigate('/dashboard/create', { replace: true })
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
  // STEP 1: Business Name + Website URL
  // ══════════════════════════════════════════
  
  const handleStep1Continue = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!businessName.trim()) {
      alert(t('onboarding.fillRequired'))
      return
    }

    // If website URL provided, analyze it
    if (websiteUrl.trim() && !useManualMode) {
      // Check quota for website analysis
      const currentTier = tierStore.currentTier
      const canAnalyze = tierStore.canUseFeature('websiteAnalysis', 'daily')
      
      if (!canAnalyze) {
        setAnalysisError(t('onboarding.quotaExceeded'))
        setUseManualMode(true)
        setStep(2)
        return
      }

      setIsAnalyzing(true)
      setAnalysisError(null)

      try {
        // Normalize URL
        let normalizedUrl = websiteUrl.trim()
        if (!normalizedUrl.startsWith('http')) {
          normalizedUrl = `https://${normalizedUrl}`
        }

        // Validate URL
        try {
          new URL(normalizedUrl)
        } catch {
          alert(t('onboarding.invalidUrl'))
          setIsAnalyzing(false)
          return
        }

        // Call analyze-website with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 sec timeout

        const { data, error } = await supabase.functions.invoke('analyze-website', {
          body: {
            url: normalizedUrl,
            businessName: businessName.trim(),
            businessType: 'cafe',
            tier: currentTier,
            debugMode: false,
          }
        })

        clearTimeout(timeoutId)

        if (error) throw error

        if (data && !data.error) {
          setAnalysisResult(data)
          
          // Increment quota
          tierStore.incrementUsage('websiteAnalysis', 'daily')
          
          // Auto-fill location if available
          const location = extractLocationFromAnalysis(data)
          if (location) {
            setPostalCode(location.postalCode)
            setCity(location.city)
          }
          
          // Derive vertical
          const vertical = deriveVerticalFromAnalysis(data)
          setBusinessVertical(vertical)
          
          setStep(2)
        } else {
          throw new Error(data?.error || 'Analysis failed')
        }
      } catch (err: any) {
        console.error('Website analysis error:', err)
        if (err.name === 'AbortError') {
          setAnalysisError(t('onboarding.analysisTimeout'))
        } else {
          setAnalysisError(t('onboarding.analysisError'))
        }
        // Fallback to manual mode
        setUseManualMode(true)
        setStep(2)
      } finally {
        setIsAnalyzing(false)
      }
    } else {
      // No website URL or manual mode → go to Step 2 (manual selection)
      setUseManualMode(true)
      setStep(2)
    }
  }

  // ══════════════════════════════════════════
  // STEP 2: Show Analysis OR Manual Selection
  // ══════════════════════════════════════════
  
  const handleStep2Continue = () => {
    // If manual mode, ensure at least one selection
    if (useManualMode && !Object.values(manualSelections).some(v => v)) {
      alert(t('onboarding.selectAtLeastOne'))
      return
    }

    // If manual mode, derive vertical from selections
    if (useManualMode) {
      const vertical = deriveVerticalFromManual(manualSelections)
      setBusinessVertical(vertical)
    }

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

  const toggleManualSelection = (key: keyof ManualSelection) => {
    setManualSelections(prev => ({ ...prev, [key]: !prev[key] }))
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

      // Prepare website URL (normalize)
      let normalizedUrl: string | null = null
      if (websiteUrl.trim()) {
        normalizedUrl = websiteUrl.trim()
        if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`
      }

      // Call updated RPC with website_url
      const { data: businessId, error: onboardingError } = await (supabase as any)
        .rpc('create_business_onboarding', {
          p_user_id: user.id,
          p_business_name: businessName.trim(),
          p_business_vertical: businessVertical, // NO accent - 'cafe' not 'café'
          p_postal_code: sanitizedPostalCode,
          p_city: city.trim(),
          p_country: country,
          p_selected_platforms: finalPlatforms,
          p_website_url: normalizedUrl, // NEW: 8th parameter
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

      // Store onboarding data in localStorage for immediate use
      if (typeof window !== 'undefined') {
        localStorage.setItem(`onboarding:completed:${user.id}`, 'true')
        localStorage.setItem('onboarding:platforms', JSON.stringify(finalPlatforms))
        localStorage.setItem('onboarding:activePlatform', finalPlatforms[0])
        localStorage.setItem('onboarding:businessId', businessId)
        
        // Store analysis result for dashboard AI suggestions
        if (analysisResult) {
          localStorage.setItem('onboarding:analysisResult', JSON.stringify({
            menuItemCount: countMenuItems(analysisResult),
            signatureItems: getSignatureItems(analysisResult, 5),
            businessType: analysisResult.businessType,
            outdoorSeating: analysisResult.outdoorSeating,
            hasMenu: analysisResult.menuSignal?.hasMenu || (analysisResult.offerings?.menuStructure?.length ?? 0) > 0,
          }))
        }
      }

      // Save service model data if extracted from website
      if (analysisResult && businessId) {
        const serviceModelData: any = {}
        let hasServiceModelData = false

        if (analysisResult.takeaway !== null && analysisResult.takeaway !== undefined) {
          serviceModelData.has_takeaway = Boolean(analysisResult.takeaway)
          hasServiceModelData = true
          console.log('✅ Takeaway detected during onboarding:', serviceModelData.has_takeaway)
        }
        if (analysisResult.delivery !== null && analysisResult.delivery !== undefined) {
          serviceModelData.has_delivery = Boolean(analysisResult.delivery)
          hasServiceModelData = true
          console.log('✅ Delivery detected during onboarding:', serviceModelData.has_delivery)
        }
        if ((analysisResult as any).hasTableService !== null && (analysisResult as any).hasTableService !== undefined) {
          serviceModelData.has_table_service = Boolean((analysisResult as any).hasTableService)
          hasServiceModelData = true
          console.log('✅ Table service detected during onboarding:', serviceModelData.has_table_service)
        }
        if ((analysisResult as any).reservationRequired !== null && (analysisResult as any).reservationRequired !== undefined) {
          serviceModelData.reservation_required = Boolean((analysisResult as any).reservationRequired)
          serviceModelData.accepts_walk_ins = !Boolean((analysisResult as any).reservationRequired)
          hasServiceModelData = true
          console.log('✅ Reservation required detected during onboarding:', serviceModelData.reservation_required)
        }

        if (hasServiceModelData) {
          console.log('💾 Saving service model data from onboarding analysis')
          ;(supabase as any).from('business_operations')
            .insert({
              business_id: businessId,
              ...serviceModelData
            })
            .then(({ error }: { error: any }) => {
              if (error) {
                console.warn('⚠️ Failed to save service model during onboarding:', error.message)
              } else {
                console.log('✅ Service model saved successfully')
              }
            })
        }
      }

      // Trigger background menu extraction if we have detected menu URLs
      if (analysisResult?.detectedMenuUrls?.length) {
        supabase.functions.invoke('menu-extract-v2', {
          body: {
            url: analysisResult.detectedMenuUrls[0],
            businessId: businessId,
            language_code: 'da',
          }
        }).catch(err => console.warn('Background menu extraction failed:', err))
      }

      // Navigate to dashboard
      localStorage.setItem('onboarding:navigating', 'true')
      navigate('/dashboard/create', { replace: true })
      
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
            {step === 2 && (analysisResult ? t('onboarding.analysisResultTitle') : t('onboarding.manualTitle'))}
            {step === 3 && t('onboarding.step2Title')}
          </h1>
          <p className="text-lg text-gray-700">
            {step === 1 && t('onboarding.subtitleNew')}
            {step === 2 && (analysisResult ? t('onboarding.analysisResultSubtitle') : t('onboarding.manualSubtitle'))}
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

              {/* Website URL */}
              <div>
                <label htmlFor="websiteUrl" className="block text-sm font-semibold text-gray-900 mb-2">
                  {t('onboarding.websiteUrlLabel')}
                </label>
                <div className="flex gap-2">
                  <input
                    id="websiteUrl"
                    type="text"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder={t('onboarding.websiteUrlPlaceholder')}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint focus:border-mint text-base"
                  />
                </div>
                {analysisError && (
                  <p className="text-sm text-red-600 mt-2">{analysisError}</p>
                )}
              </div>

              {/* Loading state during analysis */}
              {isAnalyzing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                  <div className="w-10 h-10 border-3 border-brand border-t-mint rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm font-medium text-blue-900">
                    {t('onboarding.analyzingWebsite')}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {t('onboarding.analyzingWebsiteSubtext')}
                  </p>
                </div>
              )}

              {/* Helper + No website link */}
              {!isAnalyzing && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      💡 {t('onboarding.websiteHelperText')}
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => { setUseManualMode(true); setStep(2) }}
                    className="text-sm text-gray-600 hover:text-gray-900 underline"
                  >
                    {t('onboarding.noWebsite')}
                  </button>
                </div>
              )}

              {/* Submit */}
              {!isAnalyzing && (
                <button
                  type="submit"
                  disabled={!businessName.trim()}
                  className="w-full px-6 py-3 bg-brand text-mint rounded-lg text-base font-semibold shadow-md hover:bg-[#12393D] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {websiteUrl.trim() && !useManualMode
                    ? t('onboarding.analyzeAndContinue')
                    : t('onboarding.continue')
                  }
                </button>
              )}
            </form>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* STEP 2a: Website Analysis Result        */}
          {/* ═══════════════════════════════════════ */}
          {step === 2 && analysisResult && !useManualMode && (
            <div className="space-y-6">
              
              {/* Analysis result display */}
              <div className="space-y-3">
                {/* Business type */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <svg className="w-5 h-5 text-text flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 2v6a3 3 0 003 3v11" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 2v6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 2v6a3 3 0 01-3 3" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 2c0 0 3 2 3 7s-3 7-3 7v6" />
                  </svg>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {analysisResult.businessName || businessName}
                    </p>
                    <p className="text-sm text-gray-600">
                      {analysisResult.shortDescription || getBusinessTypeLabel(analysisResult.businessType)}
                    </p>
                  </div>
                </div>

                {/* Location */}
                {analysisResult.contact?.address && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xl">📍</span>
                    <p className="text-sm text-gray-700">
                      {typeof analysisResult.contact.address === 'string'
                        ? analysisResult.contact.address
                        : `${analysisResult.contact.address.street}, ${analysisResult.contact.address.postalCode} ${analysisResult.contact.address.city}`
                      }
                    </p>
                  </div>
                )}

                {/* Menu items found */}
                {countMenuItems(analysisResult) > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-xl">☕</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {t('onboarding.menuItemsFound', { count: countMenuItems(analysisResult) })}
                        </p>
                        {analysisResult.menuSignal?.menuDescription && (
                          <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                            {analysisResult.menuSignal.menuDescription}
                          </p>
                        )}
                        {getSignatureItems(analysisResult, 5).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {getSignatureItems(analysisResult, 5).map((item, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Outdoor seating */}
                {analysisResult.outdoorSeating && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xl">🪑</span>
                    <p className="text-sm text-gray-700">{t('onboarding.outdoorSeatingDetected')}</p>
                  </div>
                )}
              </div>

              {/* Location fields (pre-filled or manual) */}
              {!extractLocationFromAnalysis(analysisResult) && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700">{t('onboarding.confirmLocation')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{t('onboarding.postalCodeLabel')} *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder={t('onboarding.postalCodePlaceholder')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{t('onboarding.cityAutoLabel')}</label>
                      <input
                        type="text"
                        value={city}
                        readOnly
                        placeholder={t('onboarding.cityAutoPlaceholder')}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleStep2Continue}
                  disabled={isFetchingCity || (!city.trim() && !extractLocationFromAnalysis(analysisResult))}
                  className="w-full px-6 py-3 bg-brand text-mint rounded-lg text-base font-semibold shadow-md hover:bg-[#12393D] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('onboarding.looksGood')}
                </button>
                <button
                  onClick={() => { setUseManualMode(true) }}
                  className="w-full text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  {t('onboarding.editManually')}
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* STEP 2b: Manual Selection (no website)  */}
          {/* ═══════════════════════════════════════ */}
          {step === 2 && (useManualMode || !analysisResult) && (
            <div className="space-y-6">
              
              {/* Multi-select tiles */}
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-3">
                  {t('onboarding.whatDoYouServe')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: 'servesCoffee' as const, icon: '☕', label: t('onboarding.tile.coffee') },
                    { key: 'servesFood' as const, icon: '🍽️', label: t('onboarding.tile.food') },
                    { key: 'servesDrinks' as const, icon: '🍷', label: t('onboarding.tile.drinks') },
                    { key: 'servesBrunch' as const, icon: '🥐', label: t('onboarding.tile.brunch') },
                    { key: 'servesBar' as const, icon: '🍺', label: t('onboarding.tile.bar') },
                    { key: 'servesTakeaway' as const, icon: '🍔', label: t('onboarding.tile.takeaway') },
                  ]).map(({ key, icon, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleManualSelection(key)}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                        manualSelections[key]
                          ? 'border-mint bg-mint/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">{icon}</span>
                      <span className="text-sm font-medium text-gray-900">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Location fields */}
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
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    {t('onboarding.cityAutoLabel')} *
                  </label>
                  <input
                    type="text"
                    value={city}
                    readOnly
                    placeholder={t('onboarding.cityAutoPlaceholder')}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-base"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleStep2Continue}
                  disabled={isFetchingCity || !city.trim() || !Object.values(manualSelections).some(v => v)}
                  className="w-full px-6 py-3 bg-brand text-mint rounded-lg text-base font-semibold shadow-md hover:bg-[#12393D] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('onboarding.continue')}
                </button>
                <button
                  onClick={() => { setUseManualMode(false); setStep(1) }}
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
                  className="w-full px-6 py-3 bg-brand text-mint rounded-lg text-base font-semibold shadow-md hover:bg-[#12393D] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
