import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  
  const [step, setStep] = useState(1)
  const [businessName, setBusinessName] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [country] = useState('Danmark')
  const [isFetchingCity, setIsFetchingCity] = useState(false)
  const [postalLookupError, setPostalLookupError] = useState<string | null>(null)
  const [businessType] = useState('cafe') // Preselected - café/restaurant
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook']) // Default to Facebook
  const [isSaving, setIsSaving] = useState(false)

  const handleStep1Continue = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!businessName.trim()) {
      alert(t('onboarding.fillRequired', 'Udfyld venligst alle felter'))
      return
    }

    if (isFetchingCity) {
      alert(t('onboarding.postalLookupInProgress', 'Hang on while we look up your town.'))
      return
    }

    const sanitizedPostalCode = postalCode.trim()

    if (sanitizedPostalCode.length !== 4 || !city.trim()) {
      alert(t('onboarding.postalValidation', 'Enter a valid postal code'))
      return
    }

    setStep(2)
  }

  useEffect(() => {
    const sanitizedPostalCode = postalCode.trim()

    if (sanitizedPostalCode.length !== 4) {
      setIsFetchingCity(false)
      setCity('')
      setPostalLookupError(null)
      return
    }

    let isActive = true

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
          setPostalLookupError(t('onboarding.postalLookupNotFound', "Couldn't find a town for that postal code."))
        }
      } catch (error) {
        if (!isActive) return
        setCity('')
        setPostalLookupError(t('onboarding.postalLookupNotFound', "Couldn't find a town for that postal code."))
      } finally {
        if (isActive) {
          setIsFetchingCity(false)
        }
      }
    }

    lookupCity()

    return () => {
      isActive = false
    }
  }, [postalCode, t])

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  const handleFinalSubmit = async (platformsOverride?: string[]) => {
    const sanitizedPostalCode = postalCode.trim()
    if (sanitizedPostalCode.length !== 4 || !city.trim()) {
      alert(t('onboarding.postalValidation', 'Enter a valid postal code'))
      return
    }

    setIsSaving(true)

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user) {
        alert(t('onboarding.notLoggedIn', 'Du skal være logget ind'))
        navigate('/login')
        return
      }

      const finalPlatforms =
        platformsOverride && platformsOverride.length > 0
          ? platformsOverride
          : selectedPlatforms

      if (finalPlatforms.length === 0) {
        console.warn('Onboarding: Attempted to submit without any platforms selected')
        alert(t('onboarding.fillRequired', 'Udfyld venligst alle felter'))
        return
      }

      if (!user.email) {
        console.error('Error saving onboarding: Missing user email for profile upsert')
        alert(t('onboarding.saveFailed', 'Kunne ikke gemme. Prøv igen.'))
        return
      }

      const normalizedCategory = businessType === 'cafe' ? 'café' : businessType

      // Call the business onboarding function to create business + location records
      const { data: businessId, error: onboardingError } = await supabase
        .rpc('create_business_onboarding', {
          p_user_id: user.id,
          p_business_name: businessName.trim(),
          p_business_vertical: normalizedCategory,
          p_postal_code: sanitizedPostalCode,
          p_city: city.trim(),
          p_country: country,
          p_selected_platforms: finalPlatforms
        })

      if (onboardingError) {
        console.error('Error saving onboarding:', onboardingError)
        console.error('Error details:', {
          message: onboardingError.message,
          details: onboardingError.details,
          hint: onboardingError.hint,
          code: onboardingError.code
        })
        alert(`Fejl: ${onboardingError.message || 'Kunne ikke gemme. Prøv igen.'}`)
        return
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(`onboarding:completed:${user.id}`, 'true')
      }

      console.log('✅ Business created:', businessId)

      // Save selected platforms to localStorage for AI prompt context
      localStorage.setItem('onboarding:platforms', JSON.stringify(finalPlatforms))

      // For Free tier: set first platform as active, but remember all selections
      if (finalPlatforms.length > 0) {
        localStorage.setItem('onboarding:activePlatform', finalPlatforms[0])
      }

      // Redirect to first post creation (Skriv step)
      navigate('/dashboard/create')
    } catch (error) {
      console.error('Error during onboarding:', error)
      alert(t('onboarding.error', 'Der opstod en fejl. Prøv igen.'))
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        
        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8 gap-2">
          <div className={`w-3 h-3 rounded-full ${step === 1 ? 'bg-[#88F2D7]' : 'bg-gray-300'}`}></div>
          <div className={`w-3 h-3 rounded-full ${step === 2 ? 'bg-[#88F2D7]' : 'bg-gray-300'}`}></div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {step === 1 
              ? t('onboarding.welcome', 'Velkommen! 👋')
              : t('onboarding.step2Title', 'Hvor vil du poste?')
            }
          </h1>
          <p className="text-lg text-gray-700">
            {step === 1
              ? t('onboarding.subtitle', 'Lad os lære din café at kende')
              : t('onboarding.step2Subtitle', 'Vælg dine sociale medier')
            }
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          {step === 1 && (
            <form onSubmit={handleStep1Continue} className="space-y-6">
            
            {/* Business Name */}
            <div>
              <label htmlFor="businessName" className="block text-sm font-semibold text-gray-900 mb-2">
                {t('onboarding.businessNameLabel', 'Navn på café/restaurant')} *
              </label>
              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={t('onboarding.businessNamePlaceholder', 'fx Café Nørrebro')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#88F2D7] focus:border-[#88F2D7] text-base"
                required
              />
            </div>

            {/* City */}
            <div>
              <label htmlFor="postalCode" className="block text-sm font-semibold text-gray-900 mb-2">
                {t('onboarding.postalCodeLabel', 'Postnummer')} *
              </label>
              <input
                id="postalCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={postalCode}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setPostalCode(digitsOnly)
                }}
                placeholder={t('onboarding.postalCodePlaceholder', 'fx 2200')}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#88F2D7] focus:border-[#88F2D7] text-base ${postalLookupError ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : 'border-gray-300'}`}
                required
              />
              {postalLookupError && (
                <p className="text-sm text-red-600 mt-2">
                  {postalLookupError}
                </p>
              )}
            </div>

            {/* Auto city lookup */}
            <div>
              <label htmlFor="city" className="block text-sm font-semibold text-gray-900 mb-2">
                {t('onboarding.cityAutoLabel', 'By (udfyldes automatisk)')} *
              </label>
              <input
                id="city"
                type="text"
                value={city}
                readOnly
                placeholder={t('onboarding.cityAutoPlaceholder', 'Vent på bynavn...')}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-base text-gray-700"
              />
              <p className={`text-xs mt-2 ${postalLookupError ? 'text-red-600' : 'text-gray-500'}`}>
                {postalLookupError
                  ? t('onboarding.cityAutoHelperError', 'Check the postal code to find the town.')
                  : isFetchingCity
                    ? t('onboarding.postalLookupLoading', 'Looking up postal code...')
                    : city
                      ? t('onboarding.postalLookupSuccess', 'Town found automatically from the postal code.')
                      : t('onboarding.cityAutoHelper', 'The town fills automatically once you enter a valid postal code.')}
              </p>
            </div>

            {/* Country */}
            <div>
              <label htmlFor="country" className="block text-sm font-semibold text-gray-900 mb-2">
                {t('onboarding.countryLabel', 'Land')}
              </label>
              <input
                id="country"
                type="text"
                value={country}
                readOnly
                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-base text-gray-700"
              />
            </div>

            {/* Business Type (preselected) */}
            <div>
              <label htmlFor="businessType" className="block text-sm font-semibold text-gray-900 mb-2">
                {t('onboarding.businessTypeLabel', 'Branche')}
              </label>
              <select
                id="businessType"
                value={businessType}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-base cursor-not-allowed"
              >
                <option value="cafe">{t('onboarding.cafeRestaurant', 'Café / Restaurant')}</option>
              </select>
            </div>

            {/* Helper Text */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                💡 {t('onboarding.helperText', 'Det er nok til at jeg kan lave gode forslag til tekst og hashtags. Du kan altid tilføje mere senere.')}
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isFetchingCity}
              className="w-full px-6 py-3 bg-[#0F2E32] text-[#88F2D7] rounded-lg text-base font-semibold shadow-md hover:bg-[#12393D] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('onboarding.continue', 'Fortsæt')}
            </button>
          </form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* Platform Checkboxes */}
              <div className="space-y-4">
                {/* Facebook */}
                <label className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-[#88F2D7] transition-all cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes('facebook')}
                    onChange={() => togglePlatform('facebook')}
                    className="w-5 h-5 mt-0.5 text-[#88F2D7] rounded focus:ring-[#88F2D7]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-semibold text-gray-900">Facebook</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {t('onboarding.facebookHashtags', 'Standard: 2-3 hashtags')}
                    </p>
                  </div>
                </label>

                {/* Instagram */}
                <label className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-[#88F2D7] transition-all cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes('instagram')}
                    onChange={() => togglePlatform('instagram')}
                    className="w-5 h-5 mt-0.5 text-[#88F2D7] rounded focus:ring-[#88F2D7]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-semibold text-gray-900">Instagram</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {t('onboarding.instagramHashtags', 'Standard: 8-12 hashtags')}
                    </p>
                  </div>
                </label>
              </div>

              {/* Helper Text */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  💡 {t('onboarding.platformsHelperText', 'Du vælger kun platforme her - du kan tilslutte dem senere. Dette hjælper AI med at lave bedre hashtags og preview.')}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => handleFinalSubmit()}
                  disabled={isSaving || selectedPlatforms.length === 0}
                  className="w-full px-6 py-3 bg-[#0F2E32] text-[#88F2D7] rounded-lg text-base font-semibold shadow-md hover:bg-[#12393D] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving 
                    ? t('onboarding.saving', 'Gemmer...') 
                    : t('onboarding.continueToFirstPost', 'Fortsæt til dit første opslag')}
                </button>

                <button
                  onClick={() => setStep(1)}
                  disabled={isSaving}
                  className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg text-base font-medium hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                  {t('onboarding.back', 'Tilbage')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Skip Link - Only on Step 2 */}
        {step === 2 && (
          <div className="text-center mt-4">
            <button
              onClick={handleSkipPlatforms}
              disabled={isSaving}
              className="text-sm text-gray-600 hover:text-gray-900 underline disabled:opacity-50"
            >
              {t('onboarding.skipPlatforms', 'Spring over – du kan vælge senere')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
