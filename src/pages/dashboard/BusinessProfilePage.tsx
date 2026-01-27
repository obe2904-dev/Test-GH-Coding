import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { useTierStore } from '../../stores/tierStore'
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt'
import { AnalyzeIcon } from './BusinessProfileIcons'
import type { BusinessSector } from '../../types/businessSector'
import { guessBusinessSector } from '../../types/businessSector'

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
  bookingLink: string
  logoUrl: string
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
  bookingLink: '',
  logoUrl: ''
})

function BusinessProfilePage() {
  const { t } = useTranslation()
  const currentTier = useTierStore((state) => state.currentTier)
  const loadPlatformsFromDatabase = useConnectionsStore((state) => state.loadPlatformsFromDatabase)

  // Form state
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessSector, setBusinessSector] = useState<BusinessSector | null>(null)
  const [businessCategory, setBusinessCategory] = useState('')
  const [aboutText, setAboutText] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const defaultCountry = t('ui.country.default_name', DEFAULT_COUNTRY)
  const [country, setCountry] = useState(defaultCountry)
  const [bookingLink, setBookingLink] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  // UI state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [savedState, setSavedState] = useState<ProfileFormState | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)

  // Collapsible sections
  const [isEditingBasics, setIsEditingBasics] = useState(false)
  const [isEditingLocation, setIsEditingLocation] = useState(false)
  const [isEditingContact, setIsEditingContact] = useState(false)
  const [isEditingAbout, setIsEditingAbout] = useState(false)

  const markUnsaved = () => setHasUnsavedChanges(true)

  useUnsavedChangesPrompt(
    hasUnsavedChanges,
    'Du har ændringer, der ikke er gemt. Er du sikker på, du vil forlade siden?'
  )

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
    bookingLink,
    logoUrl
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
    setCountry(state.country || defaultCountry)
    setBookingLink(state.bookingLink)
    setLogoUrl(state.logoUrl)
  }

  const syncSavedSnapshot = (state: ProfileFormState) => {
    setSavedState(state)
    setHasUnsavedChanges(false)
  }

  useEffect(() => {
    loadPlatformsFromDatabase()
  }, [loadPlatformsFromDatabase])

  // Load profile from database
  useEffect(() => {
    let isActive = true

    const fetchProfile = async () => {
      try {
        setIsLoadingProfile(true)
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user
        if (!user) return

        const { data: businessData, error: businessError } = await supabase
          .from('businesses')
          .select('*')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (businessError) {
          console.error('Failed to load business:', businessError.message)
          return
        }

        if (!businessData) {
          const emptyState = createDefaultState()
          applyState(emptyState)
          syncSavedSnapshot(buildStateSnapshot())
          return
        }

        setBusinessId((businessData as any).id)

        console.log('🔍 Loading location for business_id:', (businessData as any).id)
        const { data: locationData } = await supabase
          .from('business_locations')
          .select('*')
          .eq('business_id', (businessData as any).id)
          .eq('is_primary', true)
          .maybeSingle()
        
        console.log('📍 Location data loaded:', locationData)

        const { data: profileData } = await supabase
          .from('business_profile')
          .select('*')
          .eq('business_id', (businessData as any).id)
          .maybeSingle()

        const { data: brandData } = await supabase
          .from('business_brand_profile')
          .select('*')
          .eq('business_id', (businessData as any).id)
          .maybeSingle()

        const sector: BusinessSector | null = 
          (businessData as any).vertical && 
          ['hospitality', 'beauty', 'wellness', 'retail'].includes((businessData as any).vertical)
            ? (businessData as any).vertical as BusinessSector
            : null

        const loadedState: ProfileFormState = {
          websiteUrl: (businessData as any).website_url ?? '',
          businessName: (businessData as any).name ?? '',
          businessSector: sector,
          businessCategory: (businessData as any).category ?? '',
          aboutText: (profileData as any)?.long_description ?? '',
          phone: (locationData as any)?.phone ?? '',
          email: (locationData as any)?.email ?? '',
          address: (locationData as any)?.address_line1 ?? '',
          postalCode: (locationData as any)?.postal_code ?? '',
          city: (locationData as any)?.city ?? '',
          country: (locationData as any)?.country ?? DEFAULT_COUNTRY,
          bookingLink: (brandData as any)?.booking_link ?? '',
          logoUrl: (businessData as any).logo_url ?? ''
        }
        
        console.log('📋 Final loadedState:', loadedState)

        if (!isActive) return

        applyState(loadedState)
        syncSavedSnapshot(loadedState)
      } finally {
        if (isActive) setIsLoadingProfile(false)
      }
    }

    fetchProfile()

    return () => {
      isActive = false
    }
  }, [])

  const handleWebsiteAnalysis = async () => {
    if (currentTier === 'free') {
      alert('Website analyse er tilgængelig fra Smart tier og opefter.')
      return
    }

    const sanitized = websiteUrl.trim()
    if (!sanitized) return

    setIsAnalyzing(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const authToken = session?.access_token

      let effectiveBusinessId: string | undefined = businessId || undefined
      const userId = session?.user?.id
      if (!effectiveBusinessId && userId) {
        const { data: b } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', userId)
          .maybeSingle()

        if (b && (b as any).id) {
          effectiveBusinessId = (b as any).id
          setBusinessId((b as any).id)
        }
      }

      const { analyzeBusinessProfile } = await import('../../features/BusinessProfilerAI')

      const analysis = await analyzeBusinessProfile({
        url: sanitized,
        businessName: businessName || undefined,
        businessType: businessCategory || undefined,
        tier: currentTier,
        authToken,
        businessId: effectiveBusinessId
      })

      if (analysis.error) {
        console.error('Website analysis error:', analysis.error)
        return
      }

      let fieldsUpdated = 0

      // Business name
      if (analysis.businessName && (!businessName.trim() || businessName.trim() === 'Min Virksomhed')) {
        setBusinessName(analysis.businessName)
        fieldsUpdated++
      }

      // Business type/sector
      if (analysis.businessType && !businessCategory.trim()) {
        setBusinessCategory(analysis.businessType)
        fieldsUpdated++

        const guessedSector = guessBusinessSector(analysis.businessType)
        if (guessedSector) setBusinessSector(guessedSector)
      }

      // About text
      if (analysis.shortDescription && !aboutText.trim()) {
        setAboutText(analysis.shortDescription)
        fieldsUpdated++
      }

      // Phone
      if (analysis.contact?.phone && !phone.trim()) {
        setPhone(analysis.contact.phone)
        fieldsUpdated++
      }

      // Email
      if (analysis.contact?.email && !email.trim()) {
        setEmail(analysis.contact.email)
        fieldsUpdated++
      }

      // Address
      if (analysis.contact?.address && !address.trim()) {
        if (typeof analysis.contact.address === 'string') {
          setAddress(analysis.contact.address)
          fieldsUpdated++
        } else if (analysis.contact.address.street) {
          setAddress(analysis.contact.address.street)
          fieldsUpdated++

          if (analysis.contact.address.postalCode && !postalCode.trim()) {
            setPostalCode(analysis.contact.address.postalCode)
          }
          if (analysis.contact.address.city && !city.trim()) {
            setCity(analysis.contact.address.city)
          }
        }
      }

      // Booking URL
      if (analysis.bookingUrl && !bookingLink.trim()) {
        setBookingLink(analysis.bookingUrl)
        fieldsUpdated++
      }

      // Service model detection - save to business_operations
      console.log('🔍 Checking service model fields:', {
        takeaway: analysis.takeaway,
        delivery: analysis.delivery,
        hasTableService: analysis.hasTableService,
        reservationRequired: analysis.reservationRequired
      })
      
      if (analysis.takeaway !== null && analysis.takeaway !== undefined ||
          analysis.delivery !== null && analysis.delivery !== undefined ||
          analysis.hasTableService !== null && analysis.hasTableService !== undefined ||
          analysis.reservationRequired !== null && analysis.reservationRequired !== undefined) {
        
        // Update or create business_operations record with service model flags
        const { data: existingOps } = await supabase
          .from('business_operations')
          .select('business_id')
          .eq('business_id', effectiveBusinessId)
          .maybeSingle()

        const serviceModelData: any = {}
        if (analysis.takeaway !== null && analysis.takeaway !== undefined) {
          serviceModelData.has_takeaway = Boolean(analysis.takeaway)
          console.log(`✅ Takeaway detected: ${serviceModelData.has_takeaway ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }
        if (analysis.delivery !== null && analysis.delivery !== undefined) {
          serviceModelData.has_delivery = Boolean(analysis.delivery)
          console.log(`✅ Delivery detected: ${serviceModelData.has_delivery ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }
        if (analysis.hasTableService !== null && analysis.hasTableService !== undefined) {
          serviceModelData.has_table_service = Boolean(analysis.hasTableService)
          console.log(`✅ Table service detected: ${serviceModelData.has_table_service ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }
        if (analysis.reservationRequired !== null && analysis.reservationRequired !== undefined) {
          serviceModelData.reservation_required = Boolean(analysis.reservationRequired)
          serviceModelData.accepts_walk_ins = !Boolean(analysis.reservationRequired)
          console.log(`✅ Reservation required: ${serviceModelData.reservation_required ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }

        if (existingOps) {
          // Update existing record
          console.log('📝 Updating existing operations record with:', serviceModelData)
          await supabase
            .from('business_operations')
            .update(serviceModelData)
            .eq('business_id', effectiveBusinessId)
        } else {
          // Create new record
          console.log('📝 Creating new operations record with:', serviceModelData)
          await supabase
            .from('business_operations')
            .insert({
              business_id: effectiveBusinessId,
              ...serviceModelData
            })
        }
      }

      if (fieldsUpdated > 0) {
        console.log(`✅ Updated ${fieldsUpdated} fields from website analysis`)
        
        // Auto-save after AI analysis with the actual AI values
        // Pass the values directly to bypass React state batching delays
        console.log('💾 Auto-saving profile after AI analysis...')
        await handleSaveProfile({
          phone: analysis.contact?.phone || phone,
          email: analysis.contact?.email || email,
          address: typeof analysis.contact?.address === 'string' 
            ? analysis.contact.address 
            : analysis.contact?.address?.street || address,
          postalCode: analysis.contact?.address && typeof analysis.contact.address !== 'string'
            ? analysis.contact.address.postalCode || postalCode
            : postalCode,
          city: analysis.contact?.address && typeof analysis.contact.address !== 'string'
            ? analysis.contact.address.city || city
            : city,
          bookingLink: analysis.bookingUrl || bookingLink
        })
        console.log('✅ Profile auto-saved successfully')
      }
    } catch (error) {
      console.error('Error analyzing website:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSaveProfile = async (overrideValues?: {
    phone?: string
    email?: string
    address?: string
    postalCode?: string
    city?: string
    bookingLink?: string
  }) => {
    try {
      const effectivePhone = overrideValues?.phone ?? phone
      const effectiveEmail = overrideValues?.email ?? email
      const effectiveAddress = overrideValues?.address ?? address
      const effectivePostalCode = overrideValues?.postalCode ?? postalCode
      const effectiveCity = overrideValues?.city ?? city
      const effectiveBookingLink = overrideValues?.bookingLink ?? bookingLink
      
      console.log('📝 handleSaveProfile called with state:', {
        businessName,
        address: effectiveAddress,
        postalCode: effectivePostalCode,
        city: effectiveCity,
        phone: effectivePhone,
        email: effectiveEmail,
        websiteUrl,
        businessCategory
      })

      if (!businessName.trim()) {
        alert('Virksomhedsnavn er påkrævet')
        return
      }

      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user
      if (!user) {
        alert('Du skal være logget ind')
        return
      }

      // Get or create business
      let effectiveBusinessId: string = businessId || ''
      if (!effectiveBusinessId) {
        const { data: existingBusiness } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (existingBusiness) {
          effectiveBusinessId = (existingBusiness as any).id
        } else {
          // Only insert when creating new business
          const { data: newBusiness, error: createError } = await supabase
            .from('businesses')
            .insert({
              owner_id: user.id,
              name: businessName,
              vertical: businessSector || 'Andet',
              category: businessCategory,
              subscription_tier: currentTier
            })
            .select()
            .single()

          if (createError) throw createError
          effectiveBusinessId = (newBusiness as any).id
        }

        setBusinessId(effectiveBusinessId)
      }

      // Update business table fields (only update if changed from existing)
      const updateData: any = {
        name: businessName,
        category: businessCategory
      }
      
      // Only include vertical if it has a value
      if (businessSector) {
        updateData.vertical = businessSector
      }
      
      // Only include URLs if they have values
      if (websiteUrl) {
        updateData.website_url = websiteUrl
      }
      if (logoUrl) {
        updateData.logo_url = logoUrl
      }

      const { error: businessError } = await supabase
        .from('businesses')
        .update(updateData)
        .eq('id', effectiveBusinessId)

      if (businessError) {
        console.error('❌ Business update error:', {
          message: businessError.message,
          details: businessError.details,
          hint: businessError.hint,
          code: businessError.code,
          updateData: updateData,
          fullError: JSON.stringify(businessError, null, 2)
        })
        throw businessError
      }

      // Update or create location
      console.log('🔍 Checking for existing location with business_id:', effectiveBusinessId, 'is_primary: true')
      const { data: existingLocation } = await supabase
        .from('business_locations')
        .select('id')
        .eq('business_id', effectiveBusinessId)
        .eq('is_primary', true)
        .maybeSingle()

      console.log('📍 Existing location found:', existingLocation)

      const locationData = {
        phone: effectivePhone || null,
        email: effectiveEmail || null,
        address_line1: effectiveAddress || null,
        postal_code: effectivePostalCode || null,
        city: effectiveCity || null,
        country: country || null
      }

      console.log('💾 Saving location data:', locationData)

      if (existingLocation) {
        const { error: locationUpdateError } = await supabase
          .from('business_locations')
          .update(locationData)
          .eq('id', (existingLocation as any).id)

        if (locationUpdateError) {
          console.error('❌ Location update error:', locationUpdateError)
          throw locationUpdateError
        }
        console.log('✅ Location updated successfully')
      } else {
        const insertPayload = {
          business_id: effectiveBusinessId,
          is_primary: true,
          ...locationData
        }
        console.log('📤 Inserting location with payload:', insertPayload)
        
        const { data: insertResult, error: locationInsertError } = await supabase
          .from('business_locations')
          .insert(insertPayload)
          .select()

        console.log('📥 Insert result:', insertResult)
        if (locationInsertError) {
          console.error('❌ Location insert error:', locationInsertError)
          throw locationInsertError
        }
        console.log('✅ Location inserted successfully')
      }

      // Update or create profile
      const { data: existingProfile } = await supabase
        .from('business_profile')
        .select('business_id')
        .eq('business_id', effectiveBusinessId)
        .maybeSingle()

      if (existingProfile) {
        await supabase
          .from('business_profile')
          .update({
            long_description: aboutText || null
          })
          .eq('business_id', effectiveBusinessId)
      } else {
        await supabase
          .from('business_profile')
          .insert({
            business_id: effectiveBusinessId,
            long_description: aboutText || null
          })
      }

      // Update or create brand profile (for booking link and tone/voice settings)
      if (effectiveBookingLink) {
        const { data: existingBrandProfile } = await supabase
          .from('business_brand_profile')
          .select('business_id')
          .eq('business_id', effectiveBusinessId)
          .maybeSingle()

        if (existingBrandProfile) {
          await supabase
            .from('business_brand_profile')
            .update({
              booking_link: effectiveBookingLink
            } as any)
            .eq('business_id', effectiveBusinessId)
        } else {
          await supabase
            .from('business_brand_profile')
            .insert({
              business_id: effectiveBusinessId,
              booking_link: effectiveBookingLink
            } as any)
        }
      }

      const snapshot = buildStateSnapshot()
      syncSavedSnapshot(snapshot)
      setHasUnsavedChanges(false)

      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 3000)

      console.log('✅ Profile saved successfully')
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Kunne ikke gemme profilen. Prøv igen.')
    }
  }

  const handleRevertChanges = () => {
    if (!savedState) return
    applyState(savedState)
    setHasUnsavedChanges(false)
  }

  if (isLoadingProfile) {
    return (
      <div className="flex min-h-full items-center justify-center py-12">
        <div className="text-sm text-gray-500">Indlæser...</div>
      </div>
    )
  }

  // FREE TIER VIEW
  if (currentTier === 'free') {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-full py-6 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-900 mb-1">Virksomhedsprofil</h1>
            <p className="text-sm text-gray-600">Grundlæggende information</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Basis information</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Virksomhedsnavn</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => { setBusinessName(e.target.value); markUnsaved() }}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); markUnsaved() }}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Postnummer</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => { setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 4)); markUnsaved() }}
                    maxLength={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">By</label>
                  <input
                    type="text"
                    value={city}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <input
                  type="text"
                  value={businessCategory}
                  onChange={(e) => { setBusinessCategory(e.target.value); markUnsaved() }}
                  placeholder="Café, Restaurant..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">✨</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1 text-sm">Opgrader for fuld profil</h3>
                <p className="text-xs text-gray-600 mb-2">
                  Få website analyse, kontakt info, logo upload og meget mere.
                </p>
                <button
                  onClick={() => window.location.href = '/dashboard/plans'}
                  className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded text-xs font-medium"
                >
                  Se priser
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {justSaved ? (
                  <span className="text-green-600 font-medium">✓ Gemt</span>
                ) : hasUnsavedChanges ? (
                  <span className="text-amber-600">Ikke gemt</span>
                ) : (
                  <span className="text-gray-500">Ingen ændringer</span>
                )}
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={!hasUnsavedChanges || !businessName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-semibold disabled:bg-gray-400"
              >
                Gem
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // SMART/PRO TIER VIEW
  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-full py-6 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Virksomhedsprofil</h1>
          <p className="text-sm text-gray-600">Grundlæggende information om din virksomhed</p>
        </div>

        <div className="space-y-3">
          {/* Website Analysis */}
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3" aria-busy={isAnalyzing}>
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Hjemmeside URL
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => { setWebsiteUrl(e.target.value); markUnsaved() }}
                  placeholder="https://www.din-restaurant.dk"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleWebsiteAnalysis}
                  disabled={isAnalyzing || !websiteUrl.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed text-sm"
                >
                  <AnalyzeIcon className={isAnalyzing ? 'w-4 h-4 animate-spin motion-reduce:animate-none' : 'w-4 h-4'} />
                  <span>{isAnalyzing ? 'Analyserer...' : 'Analyser hjemmeside'}</span>
                </button>
                <span className="text-xs text-gray-500">Udfylder automatisk felter nedenfor</span>
                <span className="sr-only" aria-live="polite">{isAnalyzing ? 'Analyserer hjemmeside' : ''}</span>
              </div>
            </div>
          </div>

          {/* Business Basics */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Virksomhed</h3>
                {!isEditingBasics && (
                  <p className="text-sm text-gray-600">
                    {businessName || 'Ikke udfyldt'} {businessCategory && `· ${businessCategory}`}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingBasics(!isEditingBasics)}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                {isEditingBasics ? 'Luk' : 'Rediger'}
              </button>
            </div>

            {isEditingBasics && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Virksomhedsnavn *</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => { setBusinessName(e.target.value); markUnsaved() }}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Branche</label>
                    <select
                      value={businessSector || ''}
                      onChange={(e) => { setBusinessSector(e.target.value as BusinessSector); markUnsaved() }}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="">Vælg...</option>
                      <option value="hospitality">Hospitality</option>
                      <option value="beauty">Beauty</option>
                      <option value="wellness">Wellness</option>
                      <option value="retail">Retail</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                    <input
                      type="text"
                      value={businessCategory}
                      onChange={(e) => { setBusinessCategory(e.target.value); markUnsaved() }}
                      placeholder="Café, Restaurant..."
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Logo (valgfri)</label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => { setLogoUrl(e.target.value); markUnsaved() }}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">URL til dit logo</p>
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Lokation</h3>
                {!isEditingLocation && (
                  <p className="text-sm text-gray-600">
                    {address && city ? `${address}, ${city}` : 'Ikke udfyldt'}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingLocation(!isEditingLocation)}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                {isEditingLocation ? 'Luk' : 'Rediger'}
              </button>
            </div>

            {isEditingLocation && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); markUnsaved() }}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Postnummer</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => { setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 4)); markUnsaved() }}
                      maxLength={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">By</label>
                    <input
                      type="text"
                      value={city}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Land</label>
                    <input
                      type="text"
                      value={country}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Kontakt</h3>
                {!isEditingContact && (
                  <p className="text-sm text-gray-600">
                    {[phone, email].filter(Boolean).join(' · ') || 'Ikke udfyldt'}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingContact(!isEditingContact)}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                {isEditingContact ? 'Luk' : 'Rediger'}
              </button>
            </div>

            {isEditingContact && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Telefon</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); markUnsaved() }}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); markUnsaved() }}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Booking link</label>
                  <input
                    type="url"
                    value={bookingLink}
                    onChange={(e) => { setBookingLink(e.target.value); markUnsaved() }}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* About */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Om virksomheden</h3>
                {!isEditingAbout && (
                  <p className="text-sm text-gray-600">
                    {aboutText ? (aboutText.length > 120 ? aboutText.substring(0, 120) + '...' : aboutText) : 'Ikke udfyldt'}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingAbout(!isEditingAbout)}
                className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                {isEditingAbout ? 'Luk' : 'Rediger'}
              </button>
            </div>

            {isEditingAbout && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Beskrivelse</label>
                  <textarea
                    value={aboutText}
                    onChange={(e) => { setAboutText(e.target.value); markUnsaved() }}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                {websiteUrl.trim() && (
                  <button
                    onClick={handleWebsiteAnalysis}
                    disabled={isAnalyzing}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    {isAnalyzing ? 'Henter...' : '🔄 Hent fra hjemmeside'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Save */}
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {justSaved ? (
                  <span className="text-green-600 font-medium">✓ Gemt</span>
                ) : hasUnsavedChanges ? (
                  <span className="text-amber-600">Ikke gemt</span>
                ) : (
                  <span className="text-gray-500">Ingen ændringer</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRevertChanges}
                  disabled={!hasUnsavedChanges}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm disabled:opacity-50"
                >
                  Fortryd
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={!hasUnsavedChanges || !businessName.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-semibold disabled:bg-gray-400"
                >
                  Gem
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BusinessProfilePage
