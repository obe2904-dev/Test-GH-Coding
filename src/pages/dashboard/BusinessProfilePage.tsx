import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase, profilesTable } from '../../lib/supabase'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { createEmptyWeekSchedule } from '../../types/businessProfile'
import type { WeekSchedule } from '../../types/businessProfile'
import type { BusinessSector } from '../../types/businessSector'
import { guessBusinessSector } from '../../types/businessSector'
import { defaultOfferingsForSector } from '../../types/businessOfferings'
import type { BusinessOfferingsProfile } from '../../types/businessOfferings'
import type { Database } from '../../types/database'
import { BusinessInfoCard } from './businessProfile/components/BusinessInfoCard'
import { PlatformConnectionsCard } from './businessProfile/components/PlatformConnectionsCard'
import { BusinessDetailsPanel } from './businessProfile/components/BusinessDetailsPanel'
import { PlatformStatusPanel } from './businessProfile/components/PlatformStatusPanel'
import {
  parseBusinessOfferings,
  parseOpeningHours,
  parseStoredAddress,
  mapCountryLabel,
  getItemPlaceholder,
  makeRandomId,
  isBusinessSectorValue
} from './businessProfile/utils'
import { extractBrandSignals } from '../../features/BrandProfileExtractor'

const DEFAULT_COUNTRY = 'Danmark'

type ProfileFormState = {
  websiteUrl: string
  businessName: string
  businessSector: BusinessSector | null
  businessCategory: string
  aboutText: string
  phone: string
  email: string
  address: string
  postalCode: string
  city: string
  country: string
  openingHours: WeekSchedule
  keywords: string[]
  businessOfferings: BusinessOfferingsProfile
  hasBookingButton: boolean
}

const cloneWeekSchedule = (schedule: WeekSchedule): WeekSchedule =>
  JSON.parse(JSON.stringify(schedule)) as WeekSchedule

const cloneOfferings = (offerings: BusinessOfferingsProfile): BusinessOfferingsProfile =>
  JSON.parse(JSON.stringify(offerings)) as BusinessOfferingsProfile

const buildAddressLine = (street: string, postal: string, city: string, country: string) => {
  const parts: string[] = []
  const trimmedStreet = street.trim()
  const trimmedPostal = postal.trim()
  const trimmedCity = city.trim()
  const trimmedCountry = country.trim()

  if (trimmedStreet) {
    parts.push(trimmedStreet)
  }

  const postalCity = [trimmedPostal, trimmedCity].filter(Boolean).join(' ')
  if (postalCity) {
    parts.push(postalCity)
  }

  if (trimmedCountry) {
    parts.push(trimmedCountry)
  }

  return parts.join(', ')
}

const createDefaultState = (): ProfileFormState => ({
  websiteUrl: '',
  businessName: '',
  businessSector: null,
  businessCategory: '',
  aboutText: '',
  phone: '',
  email: '',
  address: '',
  postalCode: '',
  city: '',
  country: DEFAULT_COUNTRY,
  openingHours: createEmptyWeekSchedule(),
  keywords: [],
  businessOfferings: { categories: [] },
  hasBookingButton: false
})

function BusinessProfilePage() {
  const { t } = useTranslation()

  const connectPlatform = useConnectionsStore((state) => state.connectPlatform)
  const disconnectPlatform = useConnectionsStore((state) => state.disconnectPlatform)
  const isConnected = useConnectionsStore((state) => state.isConnected)
  const loadPlatformsFromDatabase = useConnectionsStore((state) => state.loadPlatformsFromDatabase)

  const [activeFrame, setActiveFrame] = useState<'business' | 'platforms'>('business')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [highlightWebsite, setHighlightWebsite] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const [businessName, setBusinessName] = useState('')
  const [businessSector, setBusinessSector] = useState<BusinessSector | null>(null)
  const [businessCategory, setBusinessCategory] = useState('')
  const [aboutText, setAboutText] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState(DEFAULT_COUNTRY)
  const [postalLookupError, setPostalLookupError] = useState<string | null>(null)
  const [isFetchingCity, setIsFetchingCity] = useState(false)

  const [openingHours, setOpeningHours] = useState<WeekSchedule>(createEmptyWeekSchedule())
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [businessOfferings, setBusinessOfferings] = useState<BusinessOfferingsProfile>({ categories: [] })
  const [hasBookingButton, setHasBookingButton] = useState(false)
  const [directPostingConnected, setDirectPostingConnected] = useState({ facebook: false, instagram: false })

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null)
  const [savedPlatform, setSavedPlatform] = useState<string | null>(null)
  const [savedState, setSavedState] = useState<ProfileFormState | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  const isDanishCountry = country.trim().toLowerCase() === 'danmark' || country.trim().toLowerCase() === 'denmark'

  const markUnsaved = () => setHasUnsavedChanges(true)

  const buildStateSnapshot = (): ProfileFormState => ({
    websiteUrl,
    businessName,
    businessSector,
    businessCategory,
    aboutText,
    phone,
    email,
    address,
    postalCode,
    city,
    country,
    openingHours: cloneWeekSchedule(openingHours),
    keywords: [...keywords],
    businessOfferings: cloneOfferings(businessOfferings),
    hasBookingButton
  })

  const applyState = (state: ProfileFormState) => {
    setWebsiteUrl(state.websiteUrl)
    setBusinessName(state.businessName)
    setBusinessSector(state.businessSector)
    setBusinessCategory(state.businessCategory)
    setAboutText(state.aboutText)
    setPhone(state.phone)
    setEmail(state.email)
    setAddress(state.address)
    setPostalCode(state.postalCode)
    setCity(state.city)
    setCountry(state.country || DEFAULT_COUNTRY)
    setOpeningHours(cloneWeekSchedule(state.openingHours))
    setKeywords([...state.keywords])
    setBusinessOfferings(cloneOfferings(state.businessOfferings))
    setHasBookingButton(state.hasBookingButton)
    setNewKeyword('')
    setPostalLookupError(null)
  }

  const syncSavedSnapshot = (state: ProfileFormState) => {
    setSavedState({
      ...state,
      openingHours: cloneWeekSchedule(state.openingHours),
      keywords: [...state.keywords],
      businessOfferings: cloneOfferings(state.businessOfferings)
    })
    setHasUnsavedChanges(false)
  }

  useEffect(() => {
    loadPlatformsFromDatabase()
  }, [loadPlatformsFromDatabase])

  useEffect(() => {
    let isActive = true

    const fetchProfile = async () => {
      try {
        setIsLoadingProfile(true)
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user
        if (!user) {
          return
        }

        const { data, error } = await profilesTable()
          .select('*')
          .eq('id', user.id)
          .maybeSingle<Database['public']['Tables']['profiles']['Row']>()

        if (error) {
          console.error('Failed to load business profile:', error.message)
          return
        }

        if (!data) {
          const emptyState = createDefaultState()
          applyState(emptyState)
          syncSavedSnapshot(buildStateSnapshot())
          return
        }

        const sector: BusinessSector | null = isBusinessSectorValue(data.business_sector)
          ? data.business_sector
          : null
        const schedule = parseOpeningHours(data.opening_hours) ?? createEmptyWeekSchedule()
        const offerings = parseBusinessOfferings(data.business_offerings) ?? defaultOfferingsForSector(sector)
        const parsedAddress = parseStoredAddress(data.address, data.country)
        const displayCountry = mapCountryLabel(data.country)

        const loadedState: ProfileFormState = {
          websiteUrl: data.website_url ?? '',
          businessName: data.business_name ?? '',
          businessSector: sector,
          businessCategory: data.business_category ?? '',
          aboutText: data.about_text ?? '',
          phone: data.phone ?? '',
          email: data.business_email ?? '',
          address: parsedAddress.street,
          postalCode: parsedAddress.postal,
          city: parsedAddress.city,
          country: displayCountry ?? DEFAULT_COUNTRY,
          openingHours: schedule,
          keywords: Array.isArray(data.keywords) ? data.keywords : [],
          businessOfferings: offerings,
          hasBookingButton: Boolean(data.has_booking_button)
        }

        if (!isActive) {
          return
        }

        applyState(loadedState)
        syncSavedSnapshot(loadedState)
        setAnalysisComplete(Boolean(data.profile_completed) || Boolean(data.business_name))
        setHighlightWebsite(false)
        setAnalysisError(null)
      } finally {
        if (isActive) {
          setIsLoadingProfile(false)
        }
      }
    }

    fetchProfile()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    const sanitizedPostal = postalCode.trim()

    if (!isDanishCountry || sanitizedPostal.length !== 4) {
      setIsFetchingCity(false)
      if (!isDanishCountry) {
        setPostalLookupError(null)
      }
      return
    }

    let isActive = true

    const lookupCity = async () => {
      setIsFetchingCity(true)
      setPostalLookupError(null)

      try {
        const response = await fetch(`https://api.dataforsyningen.dk/postnumre/${sanitizedPostal}`)

        if (!response.ok) {
          throw new Error('POSTAL_LOOKUP_FAILED')
        }

        const data = await response.json()

        if (!isActive) {
          return
        }

        if (data?.navn) {
          setCity(data.navn)
          setPostalLookupError(null)
        } else {
          setCity('')
          setPostalLookupError(t('onboarding.postalLookupNotFound', "Couldn't find a town for that postal code."))
        }
      } catch (error) {
        if (!isActive) {
          return
        }
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
  }, [postalCode, isDanishCountry, t])

  const handleWebsiteInputChange = (value: string) => {
    setWebsiteUrl(value)
    setHighlightWebsite(false)
    markUnsaved()
  }

  const handleWebsiteAnalysis = async () => {
    const sanitized = websiteUrl.trim()

    if (!sanitized) {
      setHighlightWebsite(true)
      return
    }

    setIsAnalyzing(true)
    setAnalysisError(null)

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500))

      if (!businessName) {
        try {
          const parsedUrl = new URL(sanitized.startsWith('http') ? sanitized : `https://${sanitized}`)
          const guessedName = parsedUrl.hostname.replace(/^www\./, '')
          if (guessedName) {
            setBusinessName(guessedName)
          }
        } catch (error) {
          // Ignore invalid URL parsing errors
        }
      }

      if (!businessSector && businessCategory) {
        const guessedSector = guessBusinessSector(businessCategory)
        if (guessedSector) {
          setBusinessSector(guessedSector)
        }
      }

      setAnalysisComplete(true)
      setActiveFrame('business')
    } catch (error) {
      console.error('Error analyzing website:', error)
      setAnalysisError('Kunne ikke analysere hjemmesiden. Prøv igen senere.')
    } finally {
      setIsAnalyzing(false)
      setHighlightWebsite(false)
    }
  }

  const handleManualEntry = () => {
    setAnalysisComplete(true)
    setActiveFrame('business')
    setHighlightWebsite(false)
  }

  const handleBusinessNameChange = (value: string) => {
    setBusinessName(value)
    markUnsaved()
  }

  const handleBusinessSectorChange = (value: BusinessSector | null) => {
    setBusinessSector(value)
    setBusinessOfferings((previous) => {
      if (!value) {
        return previous
      }

      if (previous.categories.length === 0) {
        return cloneOfferings(defaultOfferingsForSector(value))
      }

      return previous
    })
    markUnsaved()
  }

  const handleBusinessCategoryChange = (value: string) => {
    setBusinessCategory(value)
    if (!businessSector && value.trim()) {
      const guessed = guessBusinessSector(value)
      if (guessed) {
        setBusinessSector(guessed)
      }
    }
    markUnsaved()
  }

  const handleAboutTextChange = (value: string) => {
    setAboutText(value)
    markUnsaved()
  }

  const handlePhoneChange = (value: string) => {
    setPhone(value)
    markUnsaved()
  }

  const handleEmailChange = (value: string) => {
    setEmail(value)
    markUnsaved()
  }

  const handleAddressChange = (value: string) => {
    setAddress(value)
    markUnsaved()
  }

  const handlePostalCodeChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 4)
    setPostalCode(digitsOnly)
    setPostalLookupError(null)
    markUnsaved()
  }

  const handleCityChange = (value: string) => {
    setCity(value)
    setPostalLookupError(null)
    markUnsaved()
  }

  const handleOpeningHoursChange = (day: keyof WeekSchedule, field: 'open' | 'close', value: string) => {
    setOpeningHours((previous) => ({
      ...previous,
      [day]: {
        ...previous[day],
        [field]: value
      }
    }))
    markUnsaved()
  }

  const handleKeywordInputChange = (value: string) => {
    setNewKeyword(value)
  }

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim()
    if (!trimmed) {
      return
    }

    setKeywords((previous) => [...previous, trimmed])
    setNewKeyword('')
    markUnsaved()
  }

  const handleRemoveKeyword = (index: number) => {
    setKeywords((previous) => previous.filter((_, idx) => idx !== index))
    markUnsaved()
  }

  const handleAddCategory = () => {
    setBusinessOfferings((previous) => ({
      ...previous,
      categories: [
        ...previous.categories,
        { id: makeRandomId('cat'), name: '', items: [] }
      ]
    }))
    markUnsaved()
  }

  const handleRemoveCategory = (categoryId: string) => {
    setBusinessOfferings((previous) => ({
      ...previous,
      categories: previous.categories.filter((category) => category.id !== categoryId)
    }))
    markUnsaved()
  }

  const handleUpdateCategoryName = (categoryId: string, name: string) => {
    setBusinessOfferings((previous) => ({
      ...previous,
      categories: previous.categories.map((category) =>
        category.id === categoryId ? { ...category, name } : category
      )
    }))
    markUnsaved()
  }

  const handleAddItem = (categoryId: string) => {
    setBusinessOfferings((previous) => ({
      ...previous,
      categories: previous.categories.map((category) =>
        category.id === categoryId
          ? { ...category, items: [...category.items, { id: makeRandomId('item'), name: '' }] }
          : category
      )
    }))
    markUnsaved()
  }

  const handleRemoveItem = (categoryId: string, itemId: string) => {
    setBusinessOfferings((previous) => ({
      ...previous,
      categories: previous.categories.map((category) =>
        category.id === categoryId
          ? { ...category, items: category.items.filter((item) => item.id !== itemId) }
          : category
      )
    }))
    markUnsaved()
  }

  const handleUpdateItemName = (categoryId: string, itemId: string, name: string) => {
    setBusinessOfferings((previous) => ({
      ...previous,
      categories: previous.categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              items: category.items.map((item) =>
                item.id === itemId ? { ...item, name } : item
              )
            }
          : category
      )
    }))
    markUnsaved()
  }

  const handleToggleDirectPosting = (platform: 'facebook' | 'instagram') => {
    setDirectPostingConnected((previous) => ({
      ...previous,
      [platform]: !previous[platform]
    }))
  }

  const handleDeleteAll = () => {
    const cleared = createDefaultState()
    applyState({ ...cleared, websiteUrl })
    setAnalysisComplete(true)
    setDirectPostingConnected({ facebook: false, instagram: false })
    markUnsaved()
  }

  const handleRevertChanges = () => {
    if (!savedState) {
      return
    }

    applyState(savedState)
    setAnalysisComplete(true)
    setDirectPostingConnected({ facebook: false, instagram: false })
    setHasUnsavedChanges(false)
  }

  const handleSaveProfile = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user

      if (!user) {
        alert(t('auth.notLoggedIn', 'Du skal være logget ind'))
        return
      }

      const updatePayload: Database['public']['Tables']['profiles']['Update'] = {
        website_url: websiteUrl.trim() || null,
        business_name: businessName.trim() || null,
        business_sector: businessSector ?? null,
        business_category: businessCategory.trim() || null,
        about_text: aboutText.trim() || null,
        phone: phone.trim() || null,
        business_email: email.trim() || null,
        address: buildAddressLine(address, postalCode, city, country) || null,
        country: country || DEFAULT_COUNTRY,
        opening_hours: openingHours,
        keywords,
        has_booking_button: hasBookingButton,
        business_offerings: businessOfferings,
        profile_completed: true,
        updated_at: new Date().toISOString()
      }

      const { error } = await profilesTable()
        .update(updatePayload)
        .eq('id', user.id)

      if (error) {
        console.error('Failed to save business profile:', error.message)
        alert(t('businessProfile.saveFailed', 'Kunne ikke gemme profilen. Prøv igen.'))
        return
      }

      // Extract brand signals from profile data
      const brandSignals = extractBrandSignals({
        businessOfferings,
        openingHours,
        businessSector,
        city,
        keywords
      })

      // Get business_id to save brand signals
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (businessError) {
        console.error('Failed to retrieve business_id:', businessError.message)
        console.warn('⚠️ Brand signals not saved - business record not found')
      } else if (!businessData) {
        console.warn('⚠️ No business record found for user. Brand signals not saved.')
        console.info('This usually means onboarding was incomplete. Business should be created during signup.')
      } else {
        // Save extracted brand signals to business_brand_profile
        const { error: brandError } = await supabase
          .from('business_brand_profile')
          .upsert({
            business_id: businessData.id,
            has_alcohol: brandSignals.has_alcohol,
            dietary_options: brandSignals.dietary_options,
            signature_items: brandSignals.signature_items,
            dominant_usage_mode: brandSignals.dominant_usage_mode,
            opens_early: brandSignals.opens_early,
            closes_late: brandSignals.closes_late,
            weekend_focused: brandSignals.weekend_focused,
            target_audiences: brandSignals.target_audiences,
            updated_at: new Date().toISOString()
          })

        if (brandError) {
          console.error('Failed to save brand signals:', brandError.message)
          // Don't fail the whole save if brand signals fail
        } else {
          console.log('✅ Brand signals extracted and saved:', brandSignals)
        }
      }

      const snapshot = buildStateSnapshot()
      syncSavedSnapshot(snapshot)
      setAnalysisComplete(true)
      setAnalysisError(null)
      setHighlightWebsite(false)
    } catch (error) {
      console.error('Unexpected error while saving profile:', error)
      alert(t('businessProfile.saveFailed', 'Kunne ikke gemme profilen. Prøv igen.'))
    }
  }

  const handleConnect = async (platform: 'facebook' | 'instagram') => {
    try {
      setSavingPlatform(platform)
      await connectPlatform(platform)
      setSavedPlatform(platform)
      setTimeout(() => setSavedPlatform(null), 2000)
    } catch (error) {
      console.error(`Failed to connect platform ${platform}:`, error)
    } finally {
      setSavingPlatform(null)
    }
  }

  const handleDisconnect = async (platform: 'facebook' | 'instagram') => {
    try {
      setSavingPlatform(platform)
      await disconnectPlatform(platform)
      setSavedPlatform(platform)
      setTimeout(() => setSavedPlatform(null), 2000)
    } catch (error) {
      console.error(`Failed to disconnect platform ${platform}:`, error)
    } finally {
      setSavingPlatform(null)
    }
  }

  if (isLoadingProfile) {
    return (
      <div className="flex min-h-full items-center justify-center py-12">
        <div className="text-sm text-gray-500">{t('common.loading', 'Loading...')}</div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-full py-6 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">{t('businessProfile.setupTitle', 'Kom i gang med din forretningsprofil')}</h1>
          <p className="text-sm text-gray-600">{t('businessProfile.setupSubtitle', 'Giv mig lidt information så jeg kan skrive bedre opslag til dig')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <BusinessInfoCard
            t={t}
            websiteUrl={websiteUrl}
            highlightWebsite={highlightWebsite}
            analysisComplete={analysisComplete}
            active={activeFrame === 'business'}
            onActivate={() => {
              setActiveFrame('business')
              setHighlightWebsite(false)
            }}
            onWebsiteChange={handleWebsiteInputChange}
            onAnalyze={handleWebsiteAnalysis}
            onManualEntry={handleManualEntry}
          />

          <PlatformConnectionsCard
            t={t}
            active={activeFrame === 'platforms'}
            onActivate={() => setActiveFrame('platforms')}
            isConnected={isConnected as (platform: 'facebook' | 'instagram') => boolean}
            savingPlatform={savingPlatform}
            savedPlatform={savedPlatform}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>

        <div className="max-w-6xl mx-auto mt-4">
          <div className="bg-white rounded-lg border-2 border-gray-200 shadow-md p-6 transition-all duration-300">
            {activeFrame === 'business' ? (
              <>
                <BusinessDetailsPanel
                  t={t}
                  isAnalyzing={isAnalyzing}
                  analysisComplete={analysisComplete}
                  businessName={businessName}
                  onBusinessNameChange={handleBusinessNameChange}
                  businessSector={businessSector}
                  onBusinessSectorChange={handleBusinessSectorChange}
                  businessCategory={businessCategory}
                  onBusinessCategoryChange={handleBusinessCategoryChange}
                  aboutText={aboutText}
                  onAboutTextChange={handleAboutTextChange}
                  phone={phone}
                  onPhoneChange={handlePhoneChange}
                  email={email}
                  onEmailChange={handleEmailChange}
                  address={address}
                  onAddressChange={handleAddressChange}
                  postalCode={postalCode}
                  onPostalCodeChange={handlePostalCodeChange}
                  city={city}
                  onCityChange={handleCityChange}
                  country={country}
                  postalLookupError={postalLookupError}
                  isFetchingCity={isFetchingCity}
                  isDanishCountry={isDanishCountry}
                  openingHours={openingHours}
                  onOpeningHoursChange={handleOpeningHoursChange}
                  keywords={keywords}
                  onRemoveKeyword={handleRemoveKeyword}
                  onAddKeyword={handleAddKeyword}
                  onKeywordInputChange={handleKeywordInputChange}
                  newKeyword={newKeyword}
                  businessOfferings={businessOfferings}
                  onAddCategory={handleAddCategory}
                  onRemoveCategory={handleRemoveCategory}
                  onUpdateCategoryName={handleUpdateCategoryName}
                  onAddItem={handleAddItem}
                  onRemoveItem={handleRemoveItem}
                  onUpdateItemName={handleUpdateItemName}
                  getItemPlaceholder={() => getItemPlaceholder(businessSector)}
                  hasBookingButton={hasBookingButton}
                  hasUnsavedChanges={hasUnsavedChanges}
                  onDeleteAll={handleDeleteAll}
                  onRevertChanges={handleRevertChanges}
                  onSaveProfile={handleSaveProfile}
                />
                {analysisError && (
                  <p className="mt-4 text-sm text-red-600">{analysisError}</p>
                )}
                {hasUnsavedChanges && (
                  <p className="mt-4 text-xs text-gray-500">
                    {t('businessProfile.unsavedChangesHint', 'Du har ikke gemte ændringer. Husk at gemme inden du forlader siden.')}
                  </p>
                )}
              </>
            ) : (
              <PlatformStatusPanel
                isConnected={isConnected as (platform: 'facebook' | 'instagram') => boolean}
                directPostingConnected={directPostingConnected}
                onToggleDirectPosting={handleToggleDirectPosting}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BusinessProfilePage
