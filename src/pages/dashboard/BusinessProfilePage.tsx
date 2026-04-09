import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { useTierStore } from '../../stores/tierStore'
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt'
import { AnalyzeIcon } from './BusinessProfileIcons'
import type { BusinessSector } from '../../types/businessSector'
import { guessBusinessSector } from '../../types/businessSector'
import { getPrimaryType, getBusinessTypeLabel } from '../../lib/businessTypeHelpers'

const DEFAULT_COUNTRY = 'Danmark'

type ProfileFormState = {
  websiteUrl: string
  businessName: string
  businessSector: BusinessSector | null
  businessCategory: string
  tagline: string
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
  tagline: '',
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
  const sb = supabase as any
  const currentTier = useTierStore((state) => state.currentTier)
  const loadPlatformsFromDatabase = useConnectionsStore((state) => state.loadPlatformsFromDatabase)

  // Form state
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessSector, setBusinessSector] = useState<BusinessSector | null>(null)
  const [businessCategory, setBusinessCategory] = useState('')
  const [tagline, setTagline] = useState('')
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
  const [isEditingHours, setIsEditingHours] = useState(false)
  const [isEditingMenu, setIsEditingMenu] = useState(false)
  const [newMenuItem, setNewMenuItem] = useState('')
  const [menuHighlights, setMenuHighlights] = useState<string[]>([])
  const [menuDescription, setMenuDescription] = useState('')
  const [menuProgrammes, setMenuProgrammes] = useState<any[]>([])
  const [isEditingService, setIsEditingService] = useState(false)

  // Business character (AI-inferred hybrid type + physical features)
  const [businessCharacter, setBusinessCharacter] = useState('')
  const [isEditingCharacter, setIsEditingCharacter] = useState(false)
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false)


  // Opening hours state
  type DaySchedule = { open: string; close: string }
  type WeekSchedule = {
    man: DaySchedule
    tir: DaySchedule
    ons: DaySchedule
    tor: DaySchedule
    fre: DaySchedule
    lør: DaySchedule
    søn: DaySchedule
  }
  type DayKey = keyof WeekSchedule

  const createEmptySchedule = (): WeekSchedule => ({
    man: { open: '', close: '' },
    tir: { open: '', close: '' },
    ons: { open: '', close: '' },
    tor: { open: '', close: '' },
    fre: { open: '', close: '' },
    lør: { open: '', close: '' },
    søn: { open: '', close: '' }
  })

  const [openingHours, setOpeningHours] = useState<WeekSchedule>(createEmptySchedule())

  // Service model state
  const [hasTableService, setHasTableService] = useState(false)
  const [hasTakeaway, setHasTakeaway] = useState(false)
  const [hasDelivery, setHasDelivery] = useState(false)
  const [hasOutdoorSeating, setHasOutdoorSeating] = useState(false)
  const [hasWifi, setHasWifi] = useState(false)
  const [hasPowerOutlets, setHasPowerOutlets] = useState(false)
  const [hasParking, setHasParking] = useState(false)
  const [reservationRequired, setReservationRequired] = useState(false)
  const [hasKidsMenu, setHasKidsMenu] = useState(false)

  const markUnsaved = () => setHasUnsavedChanges(true)

  useUnsavedChangesPrompt(
    hasUnsavedChanges,
    t('common.unsavedChanges')
  )

  const buildStateSnapshot = (): ProfileFormState => ({
    websiteUrl,
    businessName,
    businessSector,
    businessCategory,
    tagline,
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
    setTagline(state.tagline)
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
        const { data: authData } = await sb.auth.getUser()
        const user = authData?.user
        if (!user) return

        const { data: businessData, error: businessError } = await sb
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
        const { data: locationData } = await sb
          .from('business_locations')
          .select('*')
          .eq('business_id', (businessData as any).id)
          .eq('is_primary', true)
          .maybeSingle()
        
        console.log('📍 Location data loaded:', locationData)

        const { data: profileData } = await sb
          .from('business_profile')
          .select('*')
          .eq('business_id', (businessData as any).id)
          .maybeSingle()
        
        // Extract menu highlights (max 10 items)
        if (profileData) {
          console.log('📊 Profile data loaded:', {
            hasMenuSignal: !!profileData.menu_signal,
            menuSignal: profileData.menu_signal,
            hasMenuStructure: !!profileData.menu_structure
          })

          const highlights: string[] = []
          
          // Extract menu description if available
          if (profileData.menu_signal?.menuDescription) {
            setMenuDescription(profileData.menu_signal.menuDescription)
          }

          // Extract structured programmes if available
          if (profileData.menu_signal?.programmes && Array.isArray(profileData.menu_signal.programmes)) {
            setMenuProgrammes(profileData.menu_signal.programmes)
          }
          
          // Priority 1: Use menu_signal.signatureItems (from website analysis)
          if (profileData.menu_signal?.signatureItems && profileData.menu_signal.signatureItems.length > 0) {
            console.log('✅ Using signatureItems:', profileData.menu_signal.signatureItems)
            highlights.push(...profileData.menu_signal.signatureItems.slice(0, 10))
          }
          // Priority 1b: Fallback to menuCategories if no signature items
          else if (profileData.menu_signal?.menuCategories && profileData.menu_signal.menuCategories.length > 0) {
            console.log('✅ Using menuCategories:', profileData.menu_signal.menuCategories)
            highlights.push(...profileData.menu_signal.menuCategories.slice(0, 10))
          }
          // Priority 2: Extract from menu_structure if available
          else if (profileData.menu_structure && Array.isArray(profileData.menu_structure)) {
            console.log('✅ Using menu_structure')
            profileData.menu_structure.forEach((category: any) => {
              if (category.items && Array.isArray(category.items)) {
                category.items.forEach((item: string) => {
                  if (highlights.length < 10) {
                    highlights.push(item)
                  }
                })
              }
            })
          }
          
          setMenuHighlights(highlights)
          console.log('🍽️ Menu highlights loaded:', highlights.length, 'items', highlights)
        }

        const { data: brandData } = await sb
          .from('business_brand_profile')
          .select('*')
          .eq('business_id', (businessData as any).id)
          .maybeSingle()

        // Load AI-inferred business character
        if ((brandData as any)?.business_character) {
          setBusinessCharacter((brandData as any).business_character)
        }

        // Load opening hours from opening_hours table
        const { data: hoursData } = await sb
          .from('opening_hours')
          .select('*')
          .eq('business_id', (businessData as any).id)

        // Load service model from business_operations table
        const { data: operationsData } = await sb
          .from('business_operations')
          .select('*')
          .eq('business_id', (businessData as any).id)
          .maybeSingle()

        // Parse opening hours into WeekSchedule format
        if (hoursData && hoursData.length > 0) {
          const schedule: WeekSchedule = createEmptySchedule()
          const dayMap: Record<string, DayKey> = {
            monday: 'man',
            tuesday: 'tir',
            wednesday: 'ons',
            thursday: 'tor',
            friday: 'fre',
            saturday: 'lør',
            sunday: 'søn'
          }

          hoursData.forEach((dayData: any) => {
            const dayKey = dayMap[dayData.weekday]
            if (dayKey) {
              schedule[dayKey] = {
                open: dayData.open_time?.substring(0, 5) || '',
                close: dayData.close_time?.substring(0, 5) || ''
              }
            }
          })

          setOpeningHours(schedule)
        }

        // Set service model data
        if (operationsData) {
          setHasTableService(operationsData.has_table_service || false)
          setHasTakeaway(operationsData.has_takeaway || false)
          setHasDelivery(operationsData.has_delivery || false)
          setHasOutdoorSeating(operationsData.has_outdoor_seating || false)
          setHasWifi(operationsData.has_wifi || false)
          setHasPowerOutlets(operationsData.has_power_outlets || false)
          setHasParking(operationsData.has_parking || false)
          setReservationRequired(operationsData.reservation_required || false)
          setHasKidsMenu(operationsData.has_kids_menu || false)
        }

        const sector: BusinessSector | null = 
          (businessData as any).vertical && 
          ['hospitality', 'beauty', 'wellness', 'retail'].includes((businessData as any).vertical)
            ? (businessData as any).vertical as BusinessSector
            : null

        const loadedState: ProfileFormState = {
          websiteUrl: (businessData as any).website_url ?? '',
          businessName: (businessData as any).name ?? '',
          businessSector: sector,
          businessCategory: (businessData as any).vertical ?? '',
          tagline: (profileData as any)?.short_description ?? '',
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
    const sanitized = websiteUrl.trim()
    if (!sanitized) {
      alert(t('businessProfile.alertEnterWebsite'))
      return
    }

    setIsAnalyzing(true)

    try {
      const { data: { session } } = await sb.auth.getSession()
      const authToken = session?.access_token

      let effectiveBusinessId: string | undefined = businessId || undefined
      const userId = session?.user?.id
      if (!effectiveBusinessId && userId) {
        const { data: b } = await sb
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
        const businessTypeStr = getBusinessTypeLabel(analysis.businessType)
        setBusinessCategory(businessTypeStr)
        fieldsUpdated++

        const primaryType = getPrimaryType(analysis.businessType)
        const guessedSector = guessBusinessSector(primaryType)
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

      // Opening hours
      if (analysis.openingHours && Object.keys(analysis.openingHours).length > 0) {
        const hasExistingHours = Object.values(openingHours).some(h => h.open || h.close)
        if (!hasExistingHours) {
          const convertedSchedule: WeekSchedule = {
            man: { 
              open: analysis.openingHours.monday?.open || '', 
              close: analysis.openingHours.monday?.close || '' 
            },
            tir: { 
              open: analysis.openingHours.tuesday?.open || '', 
              close: analysis.openingHours.tuesday?.close || '' 
            },
            ons: { 
              open: analysis.openingHours.wednesday?.open || '', 
              close: analysis.openingHours.wednesday?.close || '' 
            },
            tor: { 
              open: analysis.openingHours.thursday?.open || '', 
              close: analysis.openingHours.thursday?.close || '' 
            },
            fre: { 
              open: analysis.openingHours.friday?.open || '', 
              close: analysis.openingHours.friday?.close || '' 
            },
            lør: { 
              open: analysis.openingHours.saturday?.open || '', 
              close: analysis.openingHours.saturday?.close || '' 
            },
            søn: { 
              open: analysis.openingHours.sunday?.open || '', 
              close: analysis.openingHours.sunday?.close || '' 
            }
          }
          setOpeningHours(convertedSchedule)
          fieldsUpdated++
          console.log('✅ Opening hours extracted and populated:', convertedSchedule)
        } else {
          console.log('ℹ️ Skipping opening hours - user already has hours filled in')
        }
      }

      // Service model detection - save to business_operations
      console.log('🔍 Checking service model fields:', {
        takeaway: (analysis as any).takeaway,
        delivery: (analysis as any).delivery,
        hasTableService: (analysis as any).hasTableService,
        reservationRequired: (analysis as any).reservationRequired
      })
      
      if ((analysis as any).takeaway !== null && (analysis as any).takeaway !== undefined ||
          (analysis as any).delivery !== null && (analysis as any).delivery !== undefined ||
          (analysis as any).hasTableService !== null && (analysis as any).hasTableService !== undefined ||
          (analysis as any).reservationRequired !== null && (analysis as any).reservationRequired !== undefined) {
        
        // Update or create business_operations record with service model flags
        const { data: existingOps } = await sb
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
        if ((analysis as any).delivery !== null && (analysis as any).delivery !== undefined) {
          serviceModelData.has_delivery = Boolean((analysis as any).delivery)
          console.log(`✅ Delivery detected: ${serviceModelData.has_delivery ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }
        if ((analysis as any).hasTableService !== null && (analysis as any).hasTableService !== undefined) {
          serviceModelData.has_table_service = Boolean((analysis as any).hasTableService)
          console.log(`✅ Table service detected: ${serviceModelData.has_table_service ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }
        if ((analysis as any).reservationRequired !== null && (analysis as any).reservationRequired !== undefined) {
          serviceModelData.reservation_required = Boolean((analysis as any).reservationRequired)
          serviceModelData.accepts_walk_ins = !Boolean((analysis as any).reservationRequired)
          console.log(`✅ Reservation required: ${serviceModelData.reservation_required ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }

        if (existingOps) {
          // Update existing record
          console.log('📝 Updating existing operations record with:', serviceModelData)
          await sb
            .from('business_operations')
            .update(serviceModelData)
            .eq('business_id', effectiveBusinessId)
        } else {
          // Create new record
          console.log('📝 Creating new operations record with:', serviceModelData)
          await sb
            .from('business_operations')
            .insert({
              business_id: effectiveBusinessId,
              ...serviceModelData
            })
        }
      }

      // Log detected menu URLs for user awareness
      if (analysis.detectedMenuUrls && analysis.detectedMenuUrls.length > 0) {
        console.log('📋 Detected menu URLs:', analysis.detectedMenuUrls)
        console.log('ℹ️ Menu URLs are saved to database. Visit the "Menukort" tab to manage them.')
      }

      if (fieldsUpdated > 0) {
        console.log(`✅ Updated ${fieldsUpdated} fields from website analysis`)
        
        // Reload menu highlights from database after analysis
        if (effectiveBusinessId) {
          const { data: updatedProfile } = await sb
            .from('business_profile')
            .select('menu_signal, menu_structure')
            .eq('business_id', effectiveBusinessId)
            .maybeSingle()
          
          if (updatedProfile) {
            console.log('📊 Profile data after analysis:', {
              hasMenuSignal: !!updatedProfile.menu_signal,
              menuSignal: updatedProfile.menu_signal,
              hasMenuStructure: !!updatedProfile.menu_structure
            })

            const highlights: string[] = []
            
            // Extract menu description if available
            if (updatedProfile.menu_signal?.menuDescription) {
              setMenuDescription(updatedProfile.menu_signal.menuDescription)
            }

            // Extract structured programmes if available
            if (updatedProfile.menu_signal?.programmes && Array.isArray(updatedProfile.menu_signal.programmes)) {
              setMenuProgrammes(updatedProfile.menu_signal.programmes)
            }
            
            // Priority 1: Use menu_signal.signatureItems
            if (updatedProfile.menu_signal?.signatureItems && updatedProfile.menu_signal.signatureItems.length > 0) {
              console.log('✅ Using signatureItems after analysis:', updatedProfile.menu_signal.signatureItems)
              highlights.push(...updatedProfile.menu_signal.signatureItems.slice(0, 10))
            }
            // Priority 1b: Fallback to menuCategories if no signature items
            else if (updatedProfile.menu_signal?.menuCategories && updatedProfile.menu_signal.menuCategories.length > 0) {
              console.log('✅ Using menuCategories after analysis:', updatedProfile.menu_signal.menuCategories)
              highlights.push(...updatedProfile.menu_signal.menuCategories.slice(0, 10))
            }
            // Priority 2: Extract from menu_structure
            else if (updatedProfile.menu_structure && Array.isArray(updatedProfile.menu_structure)) {
              console.log('✅ Using menu_structure after analysis')
              updatedProfile.menu_structure.forEach((category: any) => {
                if (category.items && Array.isArray(category.items)) {
                  category.items.forEach((item: string) => {
                    if (highlights.length < 10) {
                      highlights.push(item)
                    }
                  })
                }
              })
            }
            
            setMenuHighlights(highlights)
            console.log('🍽️ Menu highlights refreshed after analysis:', highlights.length, 'items', highlights)

            // Auto-generate business character after analysis (always refresh if analysis ran)
            try {
              const freshProgrammes = updatedProfile.menu_signal?.programmes
              const { data: charData } = await sb.functions.invoke('suggest-business-character', {
                body: {
                  businessName: analysis.businessName || businessName,
                  businessCategory,
                  aboutText: analysis.shortDescription || '',
                  menuDescription: updatedProfile.menu_signal?.menuDescription || '',
                  menuHighlights: highlights,
                  programmes: freshProgrammes && Array.isArray(freshProgrammes) && freshProgrammes.length > 0
                    ? freshProgrammes
                    : undefined,
                  openingHours,
                  hasOutdoorSeating,
                  hasTableService,
                  hasTakeaway: analysis.takeaway ?? hasTakeaway,
                  websiteUrl: sanitized,
                },
              })
              if (charData?.suggestion) {
                setBusinessCharacter(charData.suggestion)
              }
            } catch (e) {
              console.warn('Auto-generering af forretningstype fejlede:', e)
            }
          }
        }
        
        // Mark as unsaved so user can review and save manually
        markUnsaved()
        
        // Show success message
        alert(t('businessProfile.alertFieldsFetched', { count: fieldsUpdated }))
      } else {
        alert(t('businessProfile.alertFetchFailed'))
      }
    } catch (error) {
      console.error('Error analyzing website:', error)
      alert(t('businessProfile.alertAnalysisError'))
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
        websiteUrl,
        tagline,
        aboutText,
        address: effectiveAddress,
        postalCode: effectivePostalCode,
        city: effectiveCity,
        phone: effectivePhone,
        email: effectiveEmail,
        businessCategory
      })

      if (!businessName.trim()) {
        alert(t('businessProfile.alertNameRequired'))
        return
      }

      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user
      if (!user) {
        alert(t('businessProfile.alertNotLoggedIn'))
        return
      }

      // Get or create business
      let effectiveBusinessId: string = businessId || ''
      if (!effectiveBusinessId) {
        const { data: existingBusiness } = await sb
          .from('businesses')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (existingBusiness) {
          effectiveBusinessId = (existingBusiness as any).id
        } else {
          // Only insert when creating new business
          const { data: newBusiness, error: createError } = await sb
            .from('businesses')
            .insert({
              owner_id: user.id,
              name: businessName,
              vertical: businessCategory || businessSector || 'other',
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
        name: businessName
      }
      
      // Map businessCategory to vertical column
      if (businessCategory) {
        updateData.vertical = businessCategory
      } else if (businessSector) {
        updateData.vertical = businessSector
      }
      
      // Only include URLs if they have values
      if (websiteUrl) {
        updateData.website_url = websiteUrl
      }
      if (logoUrl) {
        updateData.logo_url = logoUrl
      }

      console.log('💾 Saving business data:', updateData)

      const { error: businessError } = await sb
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
      
      console.log('✅ Business data saved:', updateData)

      // Update or create location
      console.log('🔍 Checking for existing location with business_id:', effectiveBusinessId, 'is_primary: true')
      const { data: existingLocation } = await sb
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
        const { error: locationUpdateError } = await sb
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
        
        const { data: insertResult, error: locationInsertError } = await sb
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
      const { data: existingProfile } = await sb
        .from('business_profile')
        .select('business_id')
        .eq('business_id', effectiveBusinessId)
        .maybeSingle()

      console.log('📋 Saving about text:', aboutText, 'Existing profile:', !!existingProfile)

      if (existingProfile) {
        const { error: profileUpdateError } = await sb
          .from('business_profile')
          .update({
            short_description: tagline || null,
            long_description: aboutText || null
          })
          .eq('business_id', effectiveBusinessId)
        
        if (profileUpdateError) {
          console.error('❌ Profile update error:', profileUpdateError)
        } else {
          console.log('✅ Profile updated with tagline + about text')
        }
      } else {
        const { error: profileInsertError } = await sb
          .from('business_profile')
          .insert({
            business_id: effectiveBusinessId,
            short_description: tagline || null,
            long_description: aboutText || null
          })
        
        if (profileInsertError) {
          console.error('❌ Profile insert error:', profileInsertError)
        } else {
          console.log('✅ Profile created with tagline + about text')
        }
      }

      // Update or create brand profile (booking link + business_character)
      const businessProfileUpdates: Record<string, any> = {}
      if (effectiveBookingLink) businessProfileUpdates.booking_link = effectiveBookingLink
      if (businessCharacter.trim()) businessProfileUpdates.business_character = businessCharacter.trim()

      if (Object.keys(businessProfileUpdates).length > 0) {
        await sb
          .from('business_brand_profile')
          .upsert({
            business_id: effectiveBusinessId,
            ...businessProfileUpdates
          } as any, { onConflict: 'business_id' })
      }

      // Save opening hours - delete and re-insert approach
      const { error: deleteHoursError } = await sb
        .from('opening_hours')
        .delete()
        .eq('business_id', effectiveBusinessId)
        .eq('kind', 'normal')

      if (deleteHoursError) {
        console.error('❌ Opening hours delete error:', deleteHoursError)
        throw deleteHoursError
      }

      const dayMap: Record<DayKey, string> = {
        man: 'monday',
        tir: 'tuesday',
        ons: 'wednesday',
        tor: 'thursday',
        fre: 'friday',
        lør: 'saturday',
        søn: 'sunday'
      }

      const hoursToInsert = Object.entries(openingHours)
        .filter(([_, hours]) => hours.open && hours.close)
        .map(([dayKey, hours]) => ({
          business_id: effectiveBusinessId,
          weekday: dayMap[dayKey as DayKey],
          kind: 'normal',
          open_time: hours.open,
          close_time: hours.close
        }))

      if (hoursToInsert.length > 0) {
        const { error: insertHoursError } = await sb
          .from('opening_hours')
          .insert(hoursToInsert)

        if (insertHoursError) {
          console.error('❌ Opening hours insert error:', insertHoursError)
          throw insertHoursError
        }
      }

      // Save service model to business_operations
      await sb
        .from('business_operations')
        .upsert({
          business_id: effectiveBusinessId,
          has_table_service: hasTableService,
          has_takeaway: hasTakeaway,
          has_delivery: hasDelivery,
          has_outdoor_seating: hasOutdoorSeating,
          has_wifi: hasWifi,
          has_power_outlets: hasPowerOutlets,
          has_parking: hasParking,
          reservation_required: reservationRequired,
          has_kids_menu: hasKidsMenu,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'business_id'
        })

      const snapshot = buildStateSnapshot()
      syncSavedSnapshot(snapshot)
      setHasUnsavedChanges(false)

      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 3000)

      console.log('✅ Profile saved successfully')
    } catch (error) {
      console.error('Error saving profile:', error)
      alert(t('businessProfile.alertSaveFailed'))
    }
  }

  const handleGenerateBusinessCharacter = async () => {
    setIsGeneratingCharacter(true)
    try {
      const { data, error } = await sb.functions.invoke('suggest-business-character', {
        body: {
          businessName,
          businessCategory,
          aboutText,
          menuDescription,
          menuHighlights,
          programmes: menuProgrammes.length > 0 ? menuProgrammes : undefined,
          openingHours,
          hasOutdoorSeating,
          hasTableService,
          hasTakeaway,
          websiteUrl,
        },
      })
      if (!error && data?.suggestion) {
        setBusinessCharacter(data.suggestion)
        markUnsaved()
      }
    } catch (e) {
      console.error('Business character suggestion error:', e)
    } finally {
      setIsGeneratingCharacter(false)
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
        <div className="text-sm text-text-muted">{t('businessProfile.loading')}</div>
      </div>
    )
  }

  // FREE TIER VIEW
  if (currentTier === 'free') {
    return (
      <div className="bg-surface-page min-h-full py-6 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-brand mb-1">{t('businessProfile.title')}</h1>
            <p className="text-sm text-text-secondary">{t('businessProfile.freeSubtitleBasic')}</p>
          </div>

          <div className="bg-surface rounded-lg border border-border p-4 mb-4">
            <h3 className="text-sm font-semibold text-brand mb-3">{t('businessProfile.basicInfoSection')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.businessName')}</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => { setBusinessName(e.target.value); markUnsaved() }}
                  className="w-full px-3 py-2 border border-border rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.websiteLabel')}</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => { setWebsiteUrl(e.target.value); markUnsaved() }}
                    placeholder={t('businessProfile.websitePlaceholder')}
                    className="flex-1 px-3 py-2 border border-border rounded text-sm"
                  />
                  <button
                    onClick={handleWebsiteAnalysis}
                    disabled={!websiteUrl.trim()}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-opacity
                      ${isAnalyzing
                        ? 'bg-cta text-text-inverse opacity-75 cursor-wait'
                        : 'bg-cta text-text-inverse hover:bg-cta-hover disabled:bg-surface-alt disabled:text-text-muted disabled:cursor-not-allowed'
                      }`}
                  >
                    <AnalyzeIcon className={isAnalyzing ? 'w-4 h-4 animate-spin motion-reduce:animate-none text-text-inverse' : 'w-4 h-4 text-text-inverse'} />
                    <span>{isAnalyzing ? t('businessProfile.analyzingWebsiteButton') : t('businessProfile.analyzeWebsiteButton')}</span>
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  {t('businessProfile.analyzeHint')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  {t('businessProfile.taglineLabel')}
                  <span className="ml-1 text-xs font-normal text-cta">{t('businessProfile.taglineAiBadge')}</span>
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => { setTagline(e.target.value); markUnsaved() }}
                  placeholder={t('businessProfile.taglinePlaceholder')}
                  maxLength={100}
                  className="w-full px-3 py-2 border border-border rounded text-sm"
                />
                <p className="text-xs text-text-muted mt-0.5">{t('businessProfile.taglineHint')}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.aboutLabel')}</label>
                <textarea
                  value={aboutText}
                  onChange={(e) => { setAboutText(e.target.value); markUnsaved() }}
                  placeholder={t('businessProfile.aboutPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.addressLabel')}</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); markUnsaved() }}
                  className="w-full px-3 py-2 border border-border rounded text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.postalCodeLabel')}</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => { setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 4)); markUnsaved() }}
                    maxLength={4}
                    className="w-full px-3 py-2 border border-border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.cityLabel')}</label>
                  <input
                    type="text"
                    value={city}
                    readOnly
                    className="w-full px-3 py-2 border border-border rounded bg-surface-alt text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.typeLabel')}</label>
                <input
                  type="text"
                  value={businessCategory}
                  onChange={(e) => { setBusinessCategory(e.target.value); markUnsaved() }}
                  placeholder={t('businessProfile.typePlaceholder')}
                  className="w-full px-3 py-2 border border-border rounded text-sm"
                />
              </div>
            </div>
          </div>

          <div className="bg-surface-alt rounded-lg border border-border p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">✨</div>
              <div className="flex-1">
                <h3 className="font-semibold text-brand mb-1 text-sm">{t('businessProfile.upgradeBannerTitle')}</h3>
                <p className="text-xs text-text-secondary mb-2">
                  {t('businessProfile.upgradeBannerDesc')}
                </p>
                <button
                  onClick={() => window.location.href = '/dashboard/plans'}
                  className="px-3 py-1.5 bg-cta text-text-inverse rounded text-xs font-medium"
                >
                  {t('businessProfile.upgradeBannerCta')}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {justSaved ? (
                  <span className="text-success font-medium">{t('businessProfile.savedStatus')}</span>
                ) : hasUnsavedChanges ? (
                  <span className="text-warning">{t('businessProfile.unsavedStatus')}</span>
                ) : (
                  <span className="text-text-muted">{t('businessProfile.noChangesStatus')}</span>
                )}
              </div>
              <button
                onClick={() => handleSaveProfile()}
                disabled={!hasUnsavedChanges || !businessName.trim()}
                className="px-4 py-2 bg-cta text-text-inverse rounded text-sm font-semibold disabled:bg-surface-alt"
              >
                {t('businessProfile.saveButton')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // SMART/PRO TIER VIEW
  return (
    <div className="bg-surface-page min-h-full py-6 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-brand font-semibold">{t('location.breadcrumb.profile')}</span>
            <span className="text-text-muted">→</span>
            <a href="/dashboard/menu" className="text-text-muted hover:text-text-secondary">{t('location.breadcrumb.menu')}</a>
            <span className="text-text-muted">→</span>
            <a href="/dashboard/location" className="text-text-muted hover:text-text-secondary">{t('location.breadcrumb.location')}</a>
            <span className="text-text-muted">→</span>
            <a href="/dashboard/brand-v5" className="text-text-muted hover:text-text-secondary">{t('location.breadcrumb.brand')}</a>
          </div>
        </div>
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-brand mb-1">{t('businessProfile.title')}</h1>
          <p className="text-sm text-text-secondary">{t('businessProfile.fullSubtitle')}</p>
        </div>

        <div className="space-y-3">
          {/* Website Analysis */}
          <div className="bg-surface rounded-lg border border-border px-4 py-3" aria-busy={isAnalyzing}>
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  {t('businessProfile.websiteUrlLabel')}
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => { setWebsiteUrl(e.target.value); markUnsaved() }}
                  placeholder={t('businessProfile.websiteUrlPlaceholder')}
                  className="w-full px-3 py-2 border border-border rounded text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleWebsiteAnalysis}
                  disabled={!websiteUrl.trim()}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-opacity
                    ${isAnalyzing
                      ? 'bg-cta text-text-inverse opacity-75 cursor-wait'
                      : 'bg-cta text-text-inverse hover:bg-cta-hover disabled:bg-surface-alt disabled:text-text-muted disabled:cursor-not-allowed'
                    }`}
                >
                  <AnalyzeIcon className={isAnalyzing ? 'w-4 h-4 animate-spin motion-reduce:animate-none text-text-inverse' : 'w-4 h-4 text-text-inverse'} />
                  <span>{isAnalyzing ? t('businessProfile.analyzingWebsiteButton') : t('businessProfile.analyzeWebsiteButton')}</span>
                </button>
                <span className="text-xs text-text-muted">{t('businessProfile.analyzeWebsiteHint')}</span>
                <span className="sr-only" aria-live="polite">{isAnalyzing ? t('businessProfile.analyzeWebsiteAriaLive') : ''}</span>
              </div>
            </div>
          </div>

          {/* Business Basics */}
          <div className="bg-surface rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-brand mb-1">{t('businessProfile.sectionBusiness')}</h3>
                {!isEditingBasics && (
                  <p className="text-sm text-text-secondary">
                    {businessName || t('businessProfile.notFilled')} {businessCategory && `· ${businessCategory}`}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingBasics(!isEditingBasics)}
                className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded hover:bg-surface-alt"
              >
                {isEditingBasics ? t('businessProfile.closeButton') : t('businessProfile.editButton')}
              </button>
            </div>

            {isEditingBasics && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Virksomhedsnavn *</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => { setBusinessName(e.target.value); markUnsaved() }}
                    className="w-full px-3 py-2 border border-border rounded text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Branche</label>
                    <select
                      value={businessSector || ''}
                      onChange={(e) => { setBusinessSector(e.target.value as BusinessSector); markUnsaved() }}
                      className="w-full px-3 py-2 border border-border rounded text-sm"
                    >
                      <option value="">{t('businessProfile.sectorPlaceholder')}</option>
                      <option value="hospitality">Hospitality</option>
                      <option value="beauty">Beauty</option>
                      <option value="wellness">Wellness</option>
                      <option value="retail">Retail</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.typeLabel')}</label>
                    <input
                      type="text"
                      value={businessCategory}
                      onChange={(e) => { setBusinessCategory(e.target.value); markUnsaved() }}
                      placeholder={t('businessProfile.typePlaceholder')}
                      className="w-full px-3 py-2 border border-border rounded text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.logoLabel')}</label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => { setLogoUrl(e.target.value); markUnsaved() }}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-border rounded text-sm"
                  />
                  <p className="text-xs text-text-muted mt-1">{t('businessProfile.logoHint')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Business Character */}
          <div className="bg-surface rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-brand mb-1">{t('businessProfile.sectionAbout')}</h3>
                {!isEditingCharacter && (
                  <p className="text-sm text-text-secondary">
                    {businessCharacter || (
                      <span className="text-text-muted italic">{t('businessProfile.aboutRunAnalysis')}</span>
                    )}
                  </p>
                )}
                {!isEditingCharacter && menuProgrammes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {menuProgrammes.map((p: any, i: number) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-surface-alt text-text-secondary">
                        {p.role}{p.timeContext ? ` · ${p.timeContext}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsEditingCharacter(!isEditingCharacter)}
                className="shrink-0 px-3 py-1.5 text-sm text-text-secondary border border-border rounded hover:bg-surface-alt"
              >
                {isEditingCharacter ? t('businessProfile.closeButton') : t('businessProfile.editButton')}
              </button>
            </div>

            {isEditingCharacter && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    {t('businessProfile.aboutBusinessLabel')}
                    <span className="ml-1 text-text-muted font-normal">{t('businessProfile.aboutBusinessSuffix')}</span>
                  </label>
                  <textarea
                    value={businessCharacter}
                    onChange={(e) => { setBusinessCharacter(e.target.value); markUnsaved() }}
                    rows={3}
                    placeholder={t('businessProfile.aboutCharacterPlaceholder')}
                    className="w-full px-3 py-2 border border-border rounded text-sm resize-none"
                  />
                  <p className="text-xs text-text-muted mt-1">{t('businessProfile.aboutCharacterHint')}</p>
                </div>
                <button
                  onClick={handleGenerateBusinessCharacter}
                  disabled={isGeneratingCharacter || (!businessName.trim() && !aboutText.trim())}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-cta text-cta-text rounded hover:bg-cta-surface disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingCharacter ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      {t('businessProfile.generatingCharacter')}
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      {t('businessProfile.aiSuggestButton')}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="bg-surface rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-brand mb-1">{t('businessProfile.sectionLocation')}</h3>
                {!isEditingLocation && (
                  <p className="text-sm text-text-secondary">
                    {address && city ? `${address}, ${city}` : t('businessProfile.notFilled')}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingLocation(!isEditingLocation)}
                className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded hover:bg-surface-alt"
              >
                {isEditingLocation ? t('businessProfile.closeButton') : t('businessProfile.editButton')}
              </button>
            </div>

            {isEditingLocation && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.addressLabel')}</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); markUnsaved() }}
                    className="w-full px-3 py-2 border border-border rounded text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.postalCodeLabel')}</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => { setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 4)); markUnsaved() }}
                      maxLength={4}
                      className="w-full px-3 py-2 border border-border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.cityLabel')}</label>
                    <input
                      type="text"
                      value={city}
                      readOnly
                      className="w-full px-3 py-2 border border-border rounded bg-surface-alt text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.countryLabel')}</label>
                    <input
                      type="text"
                      value={country}
                      readOnly
                      className="w-full px-3 py-2 border border-border rounded bg-surface-alt text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="bg-surface rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-brand mb-1">{t('businessProfile.sectionContact')}</h3>
                {!isEditingContact && (
                  <p className="text-sm text-text-secondary">
                    {[phone, email].filter(Boolean).join(' · ') || t('businessProfile.notFilled')}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingContact(!isEditingContact)}
                className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded hover:bg-surface-alt"
              >
                {isEditingContact ? t('businessProfile.closeButton') : t('businessProfile.editButton')}
              </button>
            </div>

            {isEditingContact && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.phoneLabel')}</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); markUnsaved() }}
                      className="w-full px-3 py-2 border border-border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.emailLabel')}</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); markUnsaved() }}
                      className="w-full px-3 py-2 border border-border rounded text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">{t('businessProfile.bookingLinkLabel')}</label>
                  <input
                    type="url"
                    value={bookingLink}
                    onChange={(e) => { setBookingLink(e.target.value); markUnsaved() }}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-border rounded text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Opening Hours */}
          <div className="bg-surface rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-brand mb-1">{t('businessProfile.sectionHours')}</h3>
                {!isEditingHours && (
                  <p className="text-sm text-text-secondary">
                    {Object.values(openingHours).some(h => h.open || h.close) ? t('businessProfile.hoursHasData') : t('businessProfile.hoursEmpty')}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingHours(!isEditingHours)}
                className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded hover:bg-surface-alt"
              >
                {isEditingHours ? t('businessProfile.closeButton') : t('businessProfile.editButton')}
              </button>
            </div>

            {isEditingHours && (
              <div className="mt-4 pt-4 border-t space-y-2">
                {(Object.keys(openingHours) as DayKey[]).map((day) => {
                  const dayNames: Record<DayKey, string> = {
                    man: t('businessProfile.days.man'),
                    tir: t('businessProfile.days.tir'),
                    ons: t('businessProfile.days.ons'),
                    tor: t('businessProfile.days.tor'),
                    fre: t('businessProfile.days.fre'),
                    lør: t('businessProfile.days.lør'),
                    søn: t('businessProfile.days.søn')
                  }

                  return (
                    <div key={day} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-text-secondary">{dayNames[day]}</div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="time"
                          value={openingHours[day].open}
                          onChange={(e) => {
                            setOpeningHours(prev => ({
                              ...prev,
                              [day]: { ...prev[day], open: e.target.value }
                            }))
                            markUnsaved()
                          }}
                          className="px-2 py-1.5 border border-border rounded text-xs"
                        />
                        <span className="text-xs text-text-muted">-</span>
                        <input
                          type="time"
                          value={openingHours[day].close}
                          onChange={(e) => {
                            setOpeningHours(prev => ({
                              ...prev,
                              [day]: { ...prev[day], close: e.target.value }
                            }))
                            markUnsaved()
                          }}
                          className="px-2 py-1.5 border border-border rounded text-xs"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Service Model */}
          <div className="bg-surface rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-brand mb-1">{t('businessProfile.sectionService')}</h3>
                {!isEditingService && (
                  <p className="text-sm text-text-secondary">
                    {[
                      hasTableService && t('businessProfile.tableService'),
                      hasTakeaway && t('businessProfile.takeaway'),
                      hasDelivery && t('businessProfile.delivery')
                    ].filter(Boolean).join(', ') || t('businessProfile.serviceNotSet')}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingService(!isEditingService)}
                className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded hover:bg-surface-alt"
              >
                {isEditingService ? t('businessProfile.closeButton') : t('businessProfile.editButton')}
              </button>
            </div>

            {isEditingService && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasTableService}
                    onChange={(e) => { setHasTableService(e.target.checked); markUnsaved() }}
                    className="rounded"
                  />
                  <span className="text-sm text-text-secondary">{t('businessProfile.tableService')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasTakeaway}
                    onChange={(e) => { setHasTakeaway(e.target.checked); markUnsaved() }}
                    className="rounded"
                  />
                  <span className="text-sm text-text-secondary">{t('businessProfile.takeaway')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasDelivery}
                    onChange={(e) => { setHasDelivery(e.target.checked); markUnsaved() }}
                    className="rounded"
                  />
                  <span className="text-sm text-text-secondary">{t('businessProfile.delivery')}</span>
                </label>
                <label className="flex items-center gap-2 py-1 px-2 rounded bg-cta-surface border border-cta-surface">
                  <input
                    type="checkbox"
                    checked={hasOutdoorSeating}
                    onChange={(e) => { setHasOutdoorSeating(e.target.checked); markUnsaved() }}
                    className="rounded accent-cta"
                  />
                  <span className="text-sm font-medium text-cta-text">
                    {t('businessProfile.outdoorSeating')}
                    <span className="ml-1 text-xs font-normal text-cta">{t('businessProfile.outdoorSeatingBadge')}</span>
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasWifi}
                    onChange={(e) => { setHasWifi(e.target.checked); markUnsaved() }}
                    className="rounded"
                  />
                  <span className="text-sm text-text-secondary">{t('businessProfile.wifi')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasPowerOutlets}
                    onChange={(e) => { setHasPowerOutlets(e.target.checked); markUnsaved() }}
                    className="rounded"
                  />
                  <span className="text-sm text-text-secondary">{t('businessProfile.powerOutlets')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasParking}
                    onChange={(e) => { setHasParking(e.target.checked); markUnsaved() }}
                    className="rounded"
                  />
                  <span className="text-sm text-text-secondary">{t('businessProfile.parking')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reservationRequired}
                    onChange={(e) => { setReservationRequired(e.target.checked); markUnsaved() }}
                    className="rounded"
                  />
                  <span className="text-sm text-text-secondary">{t('businessProfile.reservationRequired')}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasKidsMenu}
                    onChange={(e) => { setHasKidsMenu(e.target.checked); markUnsaved() }}
                    className="rounded"
                  />
                  <span className="text-sm text-text-secondary">{t('businessProfile.kidsMenu')}</span>
                </label>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="bg-surface border border-border rounded-lg px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {justSaved ? (
                  <span className="text-success font-medium">{t('businessProfile.savedStatus')}</span>
                ) : hasUnsavedChanges ? (
                  <span className="text-warning">{t('businessProfile.unsavedStatus')}</span>
                ) : (
                  <span className="text-text-muted">{t('businessProfile.noChangesStatus')}</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRevertChanges}
                  disabled={!hasUnsavedChanges}
                  className="px-3 py-1.5 border border-border text-text-secondary rounded text-sm disabled:opacity-50"
                >
                  {t('businessProfile.revertButton')}
                </button>
                <button
                  onClick={() => handleSaveProfile()}
                  disabled={!hasUnsavedChanges || !businessName.trim()}
                  className="px-4 py-2 bg-cta text-text-inverse rounded text-sm font-semibold disabled:bg-surface-alt"
                >
                  {t('businessProfile.saveButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation button */}
      <div className="flex justify-end mt-6">
        <a
          href="/dashboard/menu"
          className="inline-flex items-center gap-2 px-6 py-2 text-sm bg-cta text-text-inverse font-medium rounded-lg hover:bg-cta-hover transition-colors"
        >
          {t('businessProfile.nextMenu')}
        </a>
      </div>
    </div>
  )
}

export default BusinessProfilePage
