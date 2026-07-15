import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { useTierStore } from '../../stores/tierStore'
import { useBusinessStore } from '../../stores/businessStore'
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt'
import { AnalyzeIcon } from './BusinessProfileIcons'
import { BusinessSelector } from '../../components/business/BusinessSelector'
import type { BusinessSector } from '../../types/businessSector'
import { guessBusinessSector } from '../../types/businessSector'
import { getPrimaryType, getBusinessTypeLabel } from '../../lib/businessTypeHelpers'
import { QuarterHourTimePicker } from '../../components/ui/QuarterHourTimePicker'
import { enrichKeyOfferings } from './businessProfile/utils/keyOfferings'

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
  localLocationReference: string
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
  logoUrl: '',
  localLocationReference: ''
})

function BusinessProfilePage() {
  const { t } = useTranslation()
  const sb = supabase as any
  const currentTier = useTierStore((state) => state.currentTier)
  const loadPlatformsFromDatabase = useConnectionsStore((state) => state.loadPlatformsFromDatabase)
  const { 
    selectedBusinessId, 
    availableBusinesses, 
    setSelectedBusiness, 
    setAvailableBusinesses 
  } = useBusinessStore()

  // Multi-business handling
  const [showBusinessSelector, setShowBusinessSelector] = useState(false)
  const [allBusinesses, setAllBusinesses] = useState<any[]>([])

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
  const [keyOfferings, setKeyOfferings] = useState('')
  const [localLocationReference, setLocalLocationReference] = useState('')

  // UI state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisCompleted, setAnalysisCompleted] = useState(false)
  const [analysisAttempts, setAnalysisAttempts] = useState(0)
  const [justSaved, setJustSaved] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [savedState, setSavedState] = useState<ProfileFormState | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)

  // Collapsible sections
  const [isEditingBasics, setIsEditingBasics] = useState(false)
  const [isEditingLocation, setIsEditingLocation] = useState(false)
  const [isEditingContact, setIsEditingContact] = useState(false)
  const [isEditingKeyOfferings, setIsEditingKeyOfferings] = useState(false)

  // Web scraping state
  const [isScraping, setIsScraping] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractStage, setExtractStage] = useState<'idle' | 'extracting' | 'saving' | 'done' | 'error'>('idle')
  const [scrapeResult, setScrapeResult] = useState<any>(null)
  const [extractResult, setExtractResult] = useState<any>(null)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [showRawScrapeData, setShowRawScrapeData] = useState(false)
  const [showRawExtractData, setShowRawExtractData] = useState(false)
  const [_isEditingAbout, _setIsEditingAbout] = useState(false)
  const [_isEditingHours, _setIsEditingHours] = useState(true)
  const [_isEditingMenu, _setIsEditingMenu] = useState(false)
  const [_newMenuItem, _setNewMenuItem] = useState('')
  const [menuHighlights, setMenuHighlights] = useState<string[]>([])
  const [menuDescription, setMenuDescription] = useState('')
  const [menuProgrammes, setMenuProgrammes] = useState<any[]>([])
  const [_isEditingService, _setIsEditingService] = useState(true)

  // Business character (AI-inferred hybrid type + physical features)
  const [businessCharacter, setBusinessCharacter] = useState('')
  const [isEditingCharacter, setIsEditingCharacter] = useState(false)
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false)

  // Opening hours state
  type DaySchedule = { open: string; close: string; isOpen: boolean }
  type ManualWindow = { open: string; close: string }
  type ManualDaySchedule = {
    extraWindows: ManualWindow[]
    kitchenClose: string
  }
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

  type ManualWeekSchedule = {
    [K in DayKey]: ManualDaySchedule
  }

  const createEmptySchedule = (): WeekSchedule => ({
    man: { open: '', close: '', isOpen: true },
    tir: { open: '', close: '', isOpen: true },
    ons: { open: '', close: '', isOpen: true },
    tor: { open: '', close: '', isOpen: true },
    fre: { open: '', close: '', isOpen: true },
    lør: { open: '', close: '', isOpen: true },
    søn: { open: '', close: '', isOpen: false }
  })

  const createEmptyManualDay = (): ManualDaySchedule => ({
    extraWindows: [],
    kitchenClose: ''
  })

  const createEmptyManualSchedule = (): ManualWeekSchedule => ({
    man: createEmptyManualDay(),
    tir: createEmptyManualDay(),
    ons: createEmptyManualDay(),
    tor: createEmptyManualDay(),
    fre: createEmptyManualDay(),
    lør: createEmptyManualDay(),
    søn: createEmptyManualDay()
  })

  const normalizeManualSchedule = (value: unknown): ManualWeekSchedule => {
    const schedule = createEmptyManualSchedule()

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return schedule
    }

    const source = value as Record<string, unknown>
    ;(Object.keys(schedule) as DayKey[]).forEach((day) => {
      const entry = source[day]
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return

      const typedEntry = entry as Record<string, unknown>
      const extraWindows = Array.isArray(typedEntry.extraWindows)
        ? typedEntry.extraWindows
            .map((window) => {
              if (!window || typeof window !== 'object' || Array.isArray(window)) return null
              const typedWindow = window as Record<string, unknown>
              const open = typeof typedWindow.open === 'string' ? typedWindow.open : ''
              const close = typeof typedWindow.close === 'string' ? typedWindow.close : ''
              return open || close ? { open, close } : null
            })
            .filter(Boolean) as ManualWindow[]
        : []

      schedule[day] = {
        extraWindows,
        kitchenClose: typeof typedEntry.kitchenClose === 'string' ? typedEntry.kitchenClose : ''
      }
    })

    return schedule
  }

  const serializeManualSchedule = (schedule: ManualWeekSchedule) => {
    const serialized: Record<string, { extraWindows: ManualWindow[]; kitchenClose: string } | null> = {}

    ;(Object.keys(schedule) as DayKey[]).forEach((day) => {
      const entry = schedule[day]
      const extraWindows = entry.extraWindows.filter((window) => window.open || window.close)
      const kitchenClose = entry.kitchenClose.trim()

      if (extraWindows.length === 0 && !kitchenClose) {
        serialized[day] = null
        return
      }

      serialized[day] = {
        extraWindows,
        kitchenClose
      }
    })

    return Object.values(serialized).some((value) => value !== null) ? serialized : null
  }

  const [openingHours, setOpeningHours] = useState<WeekSchedule>(createEmptySchedule())
  const [manualHours, setManualHours] = useState<ManualWeekSchedule>(createEmptyManualSchedule())
  const [openingHoursReview, setOpeningHoursReview] = useState<{ required: boolean; reasons: string[] }>({
    required: false,
    reasons: []
  })

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
  const [kitchenCloseTime, setKitchenCloseTime] = useState('')
  const [weeklyProgramme, setWeeklyProgramme] = useState('')

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
    aboutText,
    phone,
    email,
    address,
    postalCode,
    city,
    country,
    bookingLink,
    logoUrl,
    localLocationReference
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
    setLocalLocationReference(state.localLocationReference || '')
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

        // Query for ALL businesses for this user (not just one)
        const { data: allBusinessesData, error: businessError } = await sb
          .from('businesses')
          .select('*')
          .eq('owner_id', user.id)

        if (businessError) {
          console.error('Failed to load businesses:', businessError.message)
          return
        }

        // No businesses found - show empty state
        if (!allBusinessesData || allBusinessesData.length === 0) {
          const emptyState = createDefaultState()
          applyState(emptyState)
          syncSavedSnapshot(buildStateSnapshot())
          return
        }

        // Store all businesses
        setAllBusinesses(allBusinessesData)
        setAvailableBusinesses(allBusinessesData)

        let businessToUse: any = null

        // Multiple businesses detected - need user to choose
        if (allBusinessesData.length > 1) {
          console.log(`🏢 Multiple businesses detected (${allBusinessesData.length}) for user ${user.id}`)
          
          // Check if user has already selected a business
          if (selectedBusinessId) {
            const selectedBusiness = allBusinessesData.find((b: any) => b.id === selectedBusinessId)
            if (selectedBusiness) {
              businessToUse = selectedBusiness
              console.log('✅ Using previously selected business:', selectedBusiness.business_name)
            } else {
              // Selected business no longer exists - show selector
              setShowBusinessSelector(true)
              setIsLoadingProfile(false)
              return
            }
          } else {
            // No selection yet - show selector
            setShowBusinessSelector(true)
            setIsLoadingProfile(false)
            return
          }
        } else {
          // Single business - use it directly
          businessToUse = allBusinessesData[0]
          setSelectedBusiness(businessToUse.id)
        }

        if (!businessToUse) return

        setBusinessId(businessToUse.id)

        console.log('🔍 Loading location for business_id:', businessToUse.id)
        const { data: locationData } = await sb
          .from('business_locations')
          .select('*')
          .eq('business_id', businessToUse.id)
          .eq('is_primary', true)
          .maybeSingle()
        
        console.log('📍 Location data loaded:', locationData)

        const { data: profileData } = await sb
          .from('business_profile')
          .select('*')
          .eq('business_id', businessToUse.id)
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
          .eq('business_id', businessToUse.id)
          .maybeSingle()

        const { data: websiteAnalysisData } = await sb
          .from('website_analyses')
          .select('source_url')
          .eq('business_id', businessToUse.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // Load AI-inferred business character (persona/strategy field)
        if ((brandData as any)?.business_character) {
          setBusinessCharacter((brandData as any).business_character)
        }

        // Load owner-editable competitive differentiator
        // Note: what_makes_us_different field removed - use identity_keywords instead

        // Load opening hours from opening_hours table
        const { data: hoursData } = await sb
          .from('opening_hours')
          .select('*')
          .eq('business_id', businessToUse.id)

        console.log('🕐 DEBUG: Opening hours from DB:', hoursData)

        // Load service model from business_operations table
        const { data: operationsData } = await sb
          .from('business_operations')
          .select('*')
          .eq('business_id', businessToUse.id)
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
            console.log('🕐 DEBUG: Processing day:', { weekday: dayData.weekday, dayKey, open_time: dayData.open_time, close_time: dayData.close_time })
            if (dayKey) {
              const hasHours = !!dayData.open_time && !!dayData.close_time
              schedule[dayKey] = {
                open: dayData.open_time?.substring(0, 5) || '',
                close: dayData.close_time?.substring(0, 5) || '',
                isOpen: hasHours
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
          setKitchenCloseTime(operationsData.kitchen_close_time || '')
          setWeeklyProgramme(operationsData.weekly_programme || '')
          setManualHours(normalizeManualSchedule(operationsData.opening_hours))
        }

        const sector: BusinessSector | null = 
          businessToUse.business_type_hybrid?.primary && 
          ['hospitality', 'beauty', 'wellness', 'retail'].includes(businessToUse.business_type_hybrid.primary)
            ? businessToUse.business_type_hybrid.primary as BusinessSector
            : null

        // Load key_offerings
        if ((profileData as any)?.key_offerings) {
          setKeyOfferings(enrichKeyOfferings((profileData as any).key_offerings))
        }

        console.log('🔍 DEBUG businessToUse.local_location_reference:', businessToUse.local_location_reference)
        console.log('🔍 DEBUG full businessToUse keys:', Object.keys(businessToUse))
        
        const loadedState: ProfileFormState = {
          websiteUrl: businessToUse.website_url ?? (websiteAnalysisData as any)?.source_url ?? '',
          businessName: businessToUse.name ?? '',
          businessSector: sector,
          businessCategory: businessToUse.business_type_hybrid?.primary ?? '',
          aboutText: (profileData as any)?.user_about_text ?? (profileData as any)?.long_description ?? '',
          phone: (locationData as any)?.phone ?? '',
          email: (locationData as any)?.email ?? '',
          address: (locationData as any)?.address_line1 ?? '',
          postalCode: (locationData as any)?.postal_code ?? '',
          city: (locationData as any)?.city ?? '',
          country: (locationData as any)?.country ?? DEFAULT_COUNTRY,
          bookingLink: (profileData as any)?.booking_url ?? (brandData as any)?.booking_link ?? '',
          logoUrl: businessToUse.logo_url ?? '',
          localLocationReference: businessToUse.local_location_reference ?? ''
        }
        
        console.log('📋 Final loadedState:', loadedState)
        console.log('📍 loadedState.localLocationReference:', loadedState.localLocationReference)

        if (!isActive) return

        applyState(loadedState)
        syncSavedSnapshot(loadedState)
        
        // Set analysisCompleted if website analysis has been run
        if (websiteAnalysisData || profileData) {
          setAnalysisCompleted(true)
        }
      } finally {
        if (isActive) setIsLoadingProfile(false)
      }
    }

    fetchProfile()

    return () => {
      isActive = false
    }
  }, [selectedBusinessId]) // Reload when business selection changes

  // Handle business selection from selector modal
  const handleBusinessSelect = (businessId: string) => {
    setSelectedBusiness(businessId)
    setShowBusinessSelector(false)
    // Trigger reload by letting useEffect dependency handle it
  }

  const handleWebsiteAnalysis = async (forceRefresh: boolean = false) => {
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

      // Don't send businessName/businessType as hints - let AI extract fresh data from the website
      // Hints can bias the extraction to use old values instead of actual website content
      const analysis = await analyzeBusinessProfile({
        url: sanitized,
        businessName: undefined,
        businessType: undefined,
        tier: currentTier,
        authToken,
        businessId: effectiveBusinessId,
        forceRefresh // Pass force refresh parameter
      })

      if (analysis.error) {
        console.error('Website analysis error:', analysis.error)
        return
      }

      setAnalysisAttempts(prev => prev + 1)
      
      setOpeningHoursReview({
        required: !!analysis.openingHoursReviewRequired,
        reasons: analysis.openingHoursReviewReasons || []
      })

      let fieldsUpdated = 0

      // Business name
      // Prefer the website-derived name so obvious onboarding typos get corrected.
      if (analysis.businessName && analysis.businessName.trim() !== businessName.trim()) {
        setBusinessName(analysis.businessName)
        fieldsUpdated++
      }

      // Business type/sector
      // Always update if analysis provides new type to handle website URL changes
      if (analysis.businessType) {
        const businessTypeStr = getBusinessTypeLabel(analysis.businessType)
        if (businessTypeStr !== businessCategory.trim()) {
          setBusinessCategory(businessTypeStr)
          fieldsUpdated++

          const primaryType = getPrimaryType(analysis.businessType)
          const guessedSector = guessBusinessSector(primaryType)
          if (guessedSector) setBusinessSector(guessedSector)
        }
      }

      // About text
      // Always update if analysis provides new description to handle website URL changes
      if (analysis.shortDescription && analysis.shortDescription.trim() !== aboutText.trim()) {
        setAboutText(analysis.shortDescription)
        fieldsUpdated++
      }

      if (analysis.keyOfferings) {
        setKeyOfferings(enrichKeyOfferings(analysis.keyOfferings))
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

      // Local location reference (extracted from website)
      if (analysis.localLocationReference && !localLocationReference.trim()) {
        console.log('📍 Setting localLocationReference from analysis:', analysis.localLocationReference)
        setLocalLocationReference(analysis.localLocationReference)
        fieldsUpdated++
      }

      // Opening hours
      if (analysis.openingHours && Object.keys(analysis.openingHours).length > 0) {
        const convertedSchedule: WeekSchedule = {
          man: { 
            open: analysis.openingHours.monday?.open || '', 
            close: analysis.openingHours.monday?.close || '',
            isOpen: !!(analysis.openingHours.monday?.open && analysis.openingHours.monday?.close)
          },
          tir: { 
            open: analysis.openingHours.tuesday?.open || '', 
            close: analysis.openingHours.tuesday?.close || '',
            isOpen: !!(analysis.openingHours.tuesday?.open && analysis.openingHours.tuesday?.close)
          },
          ons: { 
            open: analysis.openingHours.wednesday?.open || '', 
            close: analysis.openingHours.wednesday?.close || '',
            isOpen: !!(analysis.openingHours.wednesday?.open && analysis.openingHours.wednesday?.close)
          },
          tor: { 
            open: analysis.openingHours.thursday?.open || '', 
            close: analysis.openingHours.thursday?.close || '',
            isOpen: !!(analysis.openingHours.thursday?.open && analysis.openingHours.thursday?.close)
          },
          fre: { 
            open: analysis.openingHours.friday?.open || '', 
            close: analysis.openingHours.friday?.close || '',
            isOpen: !!(analysis.openingHours.friday?.open && analysis.openingHours.friday?.close)
          },
          lør: { 
            open: analysis.openingHours.saturday?.open || '', 
            close: analysis.openingHours.saturday?.close || '',
            isOpen: !!(analysis.openingHours.saturday?.open && analysis.openingHours.saturday?.close)
          },
          søn: { 
            open: analysis.openingHours.sunday?.open || '', 
            close: analysis.openingHours.sunday?.close || '',
            isOpen: !!(analysis.openingHours.sunday?.open && analysis.openingHours.sunday?.close)
          }
        }
        
        // Check if extracted hours are different from existing hours
        const isDifferent = Object.keys(convertedSchedule).some((day) => {
          const newHours = convertedSchedule[day as keyof WeekSchedule]
          const existingHours = openingHours[day as keyof WeekSchedule]
          return newHours.open !== existingHours.open || 
                 newHours.close !== existingHours.close || 
                 newHours.isOpen !== existingHours.isOpen
        })
        
        if (isDifferent) {
          setOpeningHours(convertedSchedule)
          fieldsUpdated++
          console.log('✅ Opening hours extracted and updated (different from existing):', convertedSchedule)
        } else {
          console.log('ℹ️ Skipping opening hours - extracted hours are identical to existing hours')
        }
      }

      if ((analysis as any).kitchenCloseTime) {
        const extractedKitchenTime = (analysis as any).kitchenCloseTime
        if (extractedKitchenTime !== kitchenCloseTime) {
          setKitchenCloseTime(extractedKitchenTime)
          fieldsUpdated++
          console.log('✅ Kitchen close time extracted and updated:', extractedKitchenTime)
        } else {
          console.log('ℹ️ Skipping kitchen close time - extracted time is identical to existing')
        }
      }

      // Service model detection - save to business_operations
      console.log('🔍 Checking service model fields:', {
        takeaway: (analysis as any).takeaway,
        delivery: (analysis as any).delivery,
        hasTableService: (analysis as any).hasTableService,
        reservationRequired: (analysis as any).reservationRequired,
        outdoorSeating: (analysis as any).outdoorSeating,
        wifi: (analysis as any).wifi,
        powerOutlets: (analysis as any).powerOutlets,
        parking: (analysis as any).parking,
        kidsMenu: (analysis as any).kidsMenu
      })
      
      const hasAnyServiceField = [
        (analysis as any).takeaway,
        (analysis as any).delivery,
        (analysis as any).hasTableService,
        (analysis as any).reservationRequired,
        (analysis as any).outdoorSeating,
        (analysis as any).wifi,
        (analysis as any).powerOutlets,
        (analysis as any).parking,
        (analysis as any).kidsMenu
      ].some(v => v !== null && v !== undefined)

      if (hasAnyServiceField) {
        
        // Update or create business_operations record with service model flags
        const { data: existingOps } = await sb
          .from('business_operations')
          .select('business_id')
          .eq('business_id', effectiveBusinessId)
          .maybeSingle()

        const serviceModelData: any = {}
        if (kitchenCloseTime.trim()) {
          serviceModelData.kitchen_close_time = kitchenCloseTime.trim()
        }
        if (analysis.takeaway !== null && analysis.takeaway !== undefined) {
          serviceModelData.has_takeaway = Boolean(analysis.takeaway)
          setHasTakeaway(Boolean(analysis.takeaway))
          console.log(`✅ Takeaway detected: ${serviceModelData.has_takeaway ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }
        if ((analysis as any).delivery !== null && (analysis as any).delivery !== undefined) {
          serviceModelData.has_delivery = Boolean((analysis as any).delivery)
          setHasDelivery(Boolean((analysis as any).delivery))
          console.log(`✅ Delivery detected: ${serviceModelData.has_delivery ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }
        if ((analysis as any).hasTableService !== null && (analysis as any).hasTableService !== undefined) {
          serviceModelData.has_table_service = Boolean((analysis as any).hasTableService)
          setHasTableService(Boolean((analysis as any).hasTableService))
          console.log(`✅ Table service detected: ${serviceModelData.has_table_service ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }
        if ((analysis as any).reservationRequired !== null && (analysis as any).reservationRequired !== undefined) {
          serviceModelData.reservation_required = Boolean((analysis as any).reservationRequired)
          serviceModelData.accepts_walk_ins = !Boolean((analysis as any).reservationRequired)
          setReservationRequired(Boolean((analysis as any).reservationRequired))
          // NOTE: setAcceptsWalkIns not defined in component state
          // setAcceptsWalkIns(!Boolean((analysis as any).reservationRequired))
          console.log(`✅ Reservation required: ${serviceModelData.reservation_required ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }
        if (analysis.outdoorSeating !== null && analysis.outdoorSeating !== undefined) {
          serviceModelData.has_outdoor_seating = Boolean(analysis.outdoorSeating)
          setHasOutdoorSeating(Boolean(analysis.outdoorSeating))
          console.log(`✅ Outdoor seating detected: ${serviceModelData.has_outdoor_seating ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }
        if (analysis.wifi !== null && analysis.wifi !== undefined) {
          serviceModelData.has_wifi = Boolean(analysis.wifi)
          setHasWifi(Boolean(analysis.wifi))
          console.log(`✅ WiFi detected: ${serviceModelData.has_wifi ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }
        if (analysis.powerOutlets !== null && analysis.powerOutlets !== undefined) {
          serviceModelData.has_power_outlets = Boolean(analysis.powerOutlets)
          setHasPowerOutlets(Boolean(analysis.powerOutlets))
          console.log(`✅ Power outlets detected: ${serviceModelData.has_power_outlets ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }
        if (analysis.parking !== null && analysis.parking !== undefined) {
          serviceModelData.has_parking = Boolean(analysis.parking)
          setHasParking(Boolean(analysis.parking))
          console.log(`✅ Parking detected: ${serviceModelData.has_parking ? 'Yes' : 'No'}`)
          fieldsUpdated++
        }
        if ((analysis as any).kidsMenu !== null && (analysis as any).kidsMenu !== undefined) {
          serviceModelData.has_kids_menu = Boolean((analysis as any).kidsMenu)
          setHasKidsMenu(Boolean((analysis as any).kidsMenu))
          console.log(`✅ Kids menu detected: ${serviceModelData.has_kids_menu ? 'Yes' : 'No'}`)
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

          }
        }
        
        // Mark as unsaved so user can review and save manually
        markUnsaved()
        
        // Set analysis completed state instead of showing alert
        setAnalysisCompleted(true)
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

  // =====================================================
  // New Web Scraping Handlers
  // =====================================================

  // =====================================================
  // DEBUG: STEP 1 - SCRAPE ONLY (No AI extraction)
  // =====================================================
  const handleScrapeOnly = async () => {
    const url = websiteUrl.trim()
    if (!url) {
      alert('Indtast venligst en hjemmeside-URL')
      return
    }

    setIsScraping(true)
    setScrapeError(null)
    setScrapeResult(null)
    setExtractResult(null)

    try {
      console.log('🕷️ DEBUG: Scraping only (no AI)...')

      const { data: { session } } = await sb.auth.getSession()
      const authToken = session?.access_token

      if (!authToken || !businessId) {
        throw new Error('Not authenticated or no business selected')
      }

      // Call the server-side scrape job function to avoid browser CORS issues
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/start-scrape-job`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url, force_refresh: true }),
        }
      )

      if (!response.ok) {
        throw new Error(`Scraper HTTP ${response.status}`)
      }

      const scrapeData = await response.json()
      console.log('✅ Scrape complete:', scrapeData)

      // Edge function already created the database record, just use the returned data
      setScrapeResult({
        scrape_id: scrapeData.job_id,
        content_quality: scrapeData.content_quality || 'unknown',
        menu_source: scrapeData.menu_source || 'none',
        scraped_at: scrapeData.scraped_at,
        cached: false,
        payload: scrapeData.payload,
      })

      alert(`✅ Scrape complete!\n\nQuality: ${scrapeData.content_quality || 'unknown'}\nStored in: website_scrape_results table\n\n▶️ Now click "Populate" to extract with AI`)

    } catch (error: any) {
      console.error('❌ Scrape error:', error)
      setScrapeError(error.message || 'Scraping fejlede')
      alert(`Scraping fejlede: ${error.message}`)
    } finally {
      setIsScraping(false)
    }
  }

  // =====================================================
  // DEBUG: STEP 2 - AI EXTRACT & SAVE (from existing scrape)
  // =====================================================
  const handleExtractAndSave = async () => {
    if (!scrapeResult) {
      alert('❌ Kør først "Step 1: Scrape" for at hente rå data')
      return
    }

    setIsExtracting(true)
    setExtractStage('extracting')
    setExtractError(null)
    setExtractResult(null)

    try {
      const { data: { session } } = await sb.auth.getSession()
      const authToken = session?.access_token

      if (!authToken) {
        throw new Error('Ikke godkendt')
      }

      console.log('🤖 DEBUG: Extracting with AI and saving to database...')

      // Call edge function with business_id (it will fetch latest scrape)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-from-scrape`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            business_id: businessId,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ AI extraction complete:', result)

      setExtractStage('saving')
      setExtractResult(result)
      setExtractStage('done')

      // Reload profile data to show newly extracted fields in UI
      if (result.success) {
        console.log('🔄 Reloading profile to display extracted data...')
        await fetchProfile()
      }

    } catch (error: any) {
      console.error('❌ Extract error:', error)
      setExtractError(error.message || 'AI extraction fejlede')
      setExtractStage('error')
    } finally {
      setIsExtracting(false)
    }
  }

  // =====================================================
  // UNIFIED WEBSITE ANALYSIS
  // One function that does: Scrape → AI Analysis → Data Distribution
  // =====================================================
  const handleAnalyzeWebsite = async () => {
    const url = websiteUrl.trim()
    if (!url) {
      alert('Indtast venligst en hjemmeside-URL')
      return
    }

    setIsScraping(true)
    setScrapeError(null)
    setScrapeResult(null)

    try {
      const { data: { session } } = await sb.auth.getSession()
      const authToken = session?.access_token

      if (!authToken) {
        throw new Error('Ikke godkendt')
      }

      console.log('🚀 Starting unified website analysis for:', url)

      // Call unified analysis function (does everything)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-and-distribute-website`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url, force_refresh: true }),
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Analysis complete:', result)

      setScrapeResult({
        scrape_id: result.scrape_id,
        content_quality: result.quality,
        ai_analysis: result.ai_analysis,
        cached: !!result.cached,
        duration_ms: result.duration_ms,
      })

      // Build detailed summary message
      let summaryMessage = `✅ Website analysis complete!\n\n`
      summaryMessage += `📊 Scrape ID: ${result.scrape_id}\n`
      summaryMessage += `Quality: ${result.quality}\n`
      summaryMessage += `Duration: ${(result.duration_ms / 1000).toFixed(1)}s\n\n`

      // Show what was distributed
      if (result.distribution_summary) {
        const dist = result.distribution_summary
        summaryMessage += `📝 Data Distributed:\n`
        
        // Scraped data
        if (dist.structured_data?.business_name) {
          summaryMessage += `  • Business name updated\n`
        }
        if (dist.fields_by_table?.business_locations) {
          summaryMessage += `  • Contact info: ${dist.fields_by_table.business_locations.join(', ')}\n`
        }
        
        // AI data
        if (dist.ai_fields && !dist.ai_skip_reason) {
          if (dist.ai_fields.user_about_text) summaryMessage += `  • "Om os" text extracted\n`
          if (dist.ai_fields.key_offerings?.length) summaryMessage += `  • ${dist.ai_fields.key_offerings.length} key offerings\n`
          if (dist.ai_fields.menu_signal?.signatureItems?.length) summaryMessage += `  • ${dist.ai_fields.menu_signal.signatureItems.length} menu highlights\n`
          if (dist.ai_fields.service_model) summaryMessage += `  • Service model detected\n`
        } else if (dist.ai_skip_reason) {
          summaryMessage += `  ⚠️ AI skipped: ${dist.ai_skip_reason}\n`
        }
      }

      summaryMessage += `\n🔄 Reloading page to show updates...`

      alert(summaryMessage)

      // Refresh page to show updated data
      window.location.reload()

    } catch (error: any) {
      console.error('❌ Analysis error:', error)
      setScrapeError(error.message || 'Website analysis fejlede')
      alert(`Website analysis fejlede: ${error.message}`)
    } finally {
      setIsScraping(false)
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
              business_type_hybrid: (businessCategory || businessSector) ? { primary: businessCategory || businessSector || '', secondary: [], hybridLabel: businessCategory || businessSector || '' } : null,
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
        // Always include these fields to allow clearing/updating them
        website_url: websiteUrl || null,
        logo_url: logoUrl || null,
        local_location_reference: localLocationReference.trim() || null
      }
      
      // Map businessCategory/businessSector to business_type_hybrid
      if (businessCategory || businessSector) {
        const typeValue = businessCategory || businessSector || ''
        updateData.business_type_hybrid = { primary: typeValue, secondary: [], hybridLabel: typeValue }
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

      const enrichedKeyOfferings = enrichKeyOfferings(keyOfferings)

      console.log('📋 Saving about text:', aboutText, 'Existing profile:', !!existingProfile)

      if (existingProfile) {
        const { error: profileUpdateError } = await sb
          .from('business_profile')
          .update({
            user_about_text: aboutText || null,
            key_offerings: enrichedKeyOfferings || null,
            booking_url: effectiveBookingLink || null
          })
          .eq('business_id', effectiveBusinessId)
        
        if (profileUpdateError) {
          console.error('❌ Profile update error:', profileUpdateError)
        } else {
          console.log('✅ Profile updated with about text and key offerings')
        }
      } else {
        const { error: profileInsertError } = await sb
          .from('business_profile')
          .insert({
            business_id: effectiveBusinessId,
            user_about_text: aboutText || null,
            key_offerings: enrichedKeyOfferings || null,
            booking_url: effectiveBookingLink || null
          })
        
        if (profileInsertError) {
          console.error('❌ Profile insert error:', profileInsertError)
        } else {
          console.log('✅ Profile created with about text and key offerings')
        }
      }

      // Update or create brand profile (booking link + business_character + differentiator)
      // Always save these fields to allow clearing them
      await sb
        .from('business_brand_profile')
        .upsert({
          business_id: effectiveBusinessId,
          booking_link: effectiveBookingLink || null,
          business_character: businessCharacter.trim() || null
        } as any, { onConflict: 'business_id' })

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
        .filter(([_, hours]) => hours.isOpen && hours.open && hours.close)
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
      const { data: existingOperations, error: existingOperationsError } = await sb
        .from('business_operations')
        .select('business_id')
        .eq('business_id', effectiveBusinessId)
        .maybeSingle()

      if (existingOperationsError) {
        throw existingOperationsError
      }

      const operationsPayload = {
        has_table_service: hasTableService,
        has_takeaway: hasTakeaway,
        has_delivery: hasDelivery,
        has_outdoor_seating: hasOutdoorSeating,
        has_wifi: hasWifi,
        has_power_outlets: hasPowerOutlets,
        has_parking: hasParking,
        reservation_required: reservationRequired,
        has_kids_menu: hasKidsMenu,
        kitchen_close_time: kitchenCloseTime || null,
        weekly_programme: weeklyProgramme || null,
        updated_at: new Date().toISOString()
      }

      if (existingOperations) {
        const { error: updateOperationsError } = await sb
          .from('business_operations')
          .update(operationsPayload)
          .eq('business_id', effectiveBusinessId)

        if (updateOperationsError) {
          throw updateOperationsError
        }
      } else {
        const { error: insertOperationsError } = await sb
          .from('business_operations')
          .insert({
            business_id: effectiveBusinessId,
            ...operationsPayload
          })

        if (insertOperationsError) {
          throw insertOperationsError
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
      alert(t('businessProfile.alertSaveFailed'))
    }
  }

  const handleGenerateBusinessCharacter = async () => {
    console.warn('business_character generation is now owned by Brand Profile V5')
  }

  const handleRevertChanges = () => {
    if (!savedState) return
    applyState(savedState)
    setHasUnsavedChanges(false)
  }

  // Show business selector if multiple businesses detected
  if (showBusinessSelector && allBusinesses.length > 1) {
    return (
      <BusinessSelector 
        businesses={allBusinesses} 
        onSelect={handleBusinessSelect}
      />
    )
  }

  if (isLoadingProfile) {
    return (
      <div className="flex min-h-full items-center justify-center py-12">
        <div className="text-sm text-text-muted">{t('businessProfile.loading')}</div>
      </div>
    )
  }

  // ALL TIERS VIEW (Free, Smart, Pro)
  return (
    <div className="bg-[#FAFAF8] min-h-full py-6 px-6">
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
          <h1 className="text-xl font-medium text-brand mb-1">{t('businessProfile.title')}</h1>
          <p className="text-sm text-text-secondary">{t('businessProfile.fullSubtitle')}</p>
        </div>

        <div className="space-y-3">
          {/* Website Analysis */}
          <div className="bg-surface rounded-lg border-[0.5px] border-[#E2DDD6] px-4 py-3" aria-busy={isAnalyzing}>
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-[#3C3830] mb-1">
                  {t('businessProfile.websiteUrlLabel')}
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => { setWebsiteUrl(e.target.value); markUnsaved() }}
                  placeholder={t('businessProfile.websiteUrlPlaceholder')}
                  className="w-full px-3 py-2 border border-[#C8C3BB] bg-[#F4F1EC] rounded-lg text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleWebsiteAnalysis(false)}
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
                
                {analysisAttempts > 0 && !isAnalyzing && (
                  <button
                    onClick={() => handleWebsiteAnalysis(true)}
                    disabled={!websiteUrl.trim()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded text-sm font-medium border border-cta text-cta hover:bg-cta hover:text-text-inverse transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Genindlæs fra hjemmeside og ignorer cache"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Genindlæs</span>
                  </button>
                )}
                
                <span className="text-xs text-text-muted">
                  {analysisCompleted 
                    ? t('businessProfile.analyzeWebsiteHintCompleted')
                    : t('businessProfile.analyzeWebsiteHint')
                  }
                </span>
                <span className="sr-only" aria-live="polite">{isAnalyzing ? t('businessProfile.analyzeWebsiteAriaLive') : ''}</span>
              </div>
            </div>
          </div>

          {/* Web Data Extraction (Two-Step Testing) */}
          <div className="bg-purple-50 rounded-lg border-2 border-purple-200 p-4">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                <h3 className="text-sm font-semibold text-purple-900">
                  🧪 Web Data Extraction (Test)
                </h3>
              </div>

              {/* AI Extraction Mapping Info Box */}
              <div className="bg-white rounded-lg border border-purple-300 p-3 text-xs space-y-2">
                <h4 className="font-semibold text-purple-900">🤖 AI Extracts → Database</h4>
                <div className="grid grid-cols-1 gap-1 text-gray-700">
                  <div><code className="bg-purple-100 px-1 rounded">about</code> → <code className="bg-blue-100 px-1 rounded">business_profile.user_about_text</code></div>
                  <div><code className="bg-purple-100 px-1 rounded">keywords[]</code> → <code className="bg-blue-100 px-1 rounded">business_profile.keywords</code></div>
                  <div><code className="bg-purple-100 px-1 rounded">venue_hooks[]</code> → <code className="bg-blue-100 px-1 rounded">business_profile.key_offerings</code> (as TEXT)</div>
                  <div><code className="bg-purple-100 px-1 rounded">tone_of_voice</code> → <code className="bg-blue-100 px-1 rounded">business_brand_profile.tone_of_voice</code></div>
                  <div><code className="bg-purple-100 px-1 rounded">menu_highlights[]</code> → <code className="bg-blue-100 px-1 rounded">business_profile.menu_signal</code></div>
                  <div><code className="bg-purple-100 px-1 rounded">services{}</code> → <code className="bg-blue-100 px-1 rounded">business_operations.*</code></div>
                </div>
              </div>

              {/* Debug Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleScrapeOnly}
                  disabled={!websiteUrl.trim() || isScraping}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${isScraping
                      ? 'bg-blue-600 text-white opacity-75 cursor-wait'
                      : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed'
                    }`}
                >
                  <svg className={`w-4 h-4 ${isScraping ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>{isScraping ? 'Scraper...' : '1️⃣ Scrape Raw Data'}</span>
                </button>

                <button
                  onClick={handleExtractAndSave}
                  disabled={!scrapeResult || isExtracting}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${isExtracting
                      ? 'bg-pink-600 text-white opacity-75 cursor-wait'
                      : 'bg-pink-600 text-white hover:bg-pink-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed'
                    }`}
                >
                  <svg className={`w-4 h-4 ${isExtracting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>{isExtracting ? 'Ekstraherer...' : '2️⃣ Extract with AI & Save'}</span>
                </button>

                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                  <strong>How it works:</strong><br/>
                  1. Scrape → Save to <code>website_scrape_results</code> table<br/>
                  2. AI reads → Extracts data → Saves to profile tables
                </div>
              </div>

              {/* Single Unified Button (Original) */}
              <div className="pt-2 border-t border-purple-300">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAnalyzeWebsite}
                    disabled={!websiteUrl.trim() || isScraping}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all
                      ${isScraping
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white opacity-75 cursor-wait'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed'
                      }`}
                  >
                    <svg className={`w-5 h-5 ${isScraping ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>{isScraping ? 'Analyserer...' : '🚀 Unified: Scrape + AI + Save'}</span>
                  </button>

                  <button
                    onClick={handleExtractAndSave}
                    disabled={!scrapeResult || isExtracting}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all
                      ${isExtracting
                        ? 'bg-emerald-600 text-white opacity-75 cursor-wait'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed'
                      }`}
                  >
                    <svg className={`w-5 h-5 ${isExtracting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16m-7-7l7 7-7 7" />
                    </svg>
                    <span>{isExtracting ? 'Populerer...' : 'Populate'}</span>
                  </button>

                  {scrapeResult && (
                    <div className="text-xs space-y-1">
                      <div className="text-purple-700 font-medium">
                        ✅ Quality: {scrapeResult.content_quality}
                      </div>
                      {scrapeResult.ai_analysis && (
                        <div className="text-pink-700 font-medium">
                          🤖 AI: {(scrapeResult.ai_analysis.confidence_score || 0).toFixed(2)} confidence
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Errors */}
              {scrapeError && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                  ❌ {scrapeError}
                </div>
              )}
              {extractError && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                  ❌ {extractError}
                </div>
              )}

              {/* Scrape Results */}
              {scrapeResult && (
                <div className="bg-white rounded-lg border border-purple-300 p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-purple-900">📊 Scraped Data</h4>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="font-medium text-gray-600">Quality:</span> <span className="text-gray-900">{scrapeResult.content_quality}</span></div>
                    <div><span className="font-medium text-gray-600">Menu:</span> <span className="text-gray-900">{scrapeResult.menu_source}</span></div>
                    <div><span className="font-medium text-gray-600">Scraped:</span> <span className="text-gray-900">{new Date(scrapeResult.scraped_at).toLocaleString('da-DK')}</span></div>
                    <div><span className="font-medium text-gray-600">Cache:</span> <span className="text-gray-900">{scrapeResult.cached ? '✅ Yes' : '❌ Fresh'}</span></div>
                  </div>
                  
                  <button
                    onClick={() => setShowRawScrapeData(!showRawScrapeData)}
                    className="text-xs text-purple-600 hover:underline mt-1"
                  >
                    {showRawScrapeData ? '▼ Hide' : '▶ Show'} Debug Data
                  </button>

                  {showRawScrapeData && (
                    <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-60 border border-gray-200">
                      {JSON.stringify(scrapeResult, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* Extract Results */}
              {(isExtracting || extractResult) && (
                <div className="bg-white rounded-lg border border-pink-300 p-3 space-y-3">
                  <h4 className="text-xs font-semibold text-pink-900">🤖 Extraction Status</h4>

                  <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${extractStage === 'extracting' ? 'bg-amber-100 text-amber-800' : extractStage === 'done' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {extractStage === 'extracting' ? '⏳' : extractStage === 'done' ? '✅' : '•'} Extracting
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${extractStage === 'saving' || extractStage === 'done' ? 'bg-green-100 text-green-800' : extractStage === 'extracting' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                      {extractStage === 'saving' || extractStage === 'done' ? '✅' : extractStage === 'extracting' ? '⏳' : '•'} Saved
                    </span>
                  </div>

                  {extractResult?.extraction && (
                    <div className="space-y-3">
                      {/* Successfully saved */}
                      {extractResult.extraction.saved.length > 0 && (
                        <div className="rounded border border-green-200 bg-green-50/60 p-3">
                          <div className="text-xs font-semibold text-green-900 mb-2">✅ Gemt til database</div>
                          <div className="space-y-1">
                            {extractResult.extraction.saved.map((field: string) => (
                              <div key={field} className="flex items-center gap-2 text-xs">
                                <span className="text-green-600">✅</span>
                                <code className="bg-white px-1 rounded">{field}</code>
                                {field === 'email' && extractResult.data?.email && (
                                  <span className="text-gray-600">→ {extractResult.data.email}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Not found */}
                      {extractResult.extraction.not_found.length > 0 && (
                        <div className="rounded border border-amber-200 bg-amber-50/60 p-3">
                          <div className="text-xs font-semibold text-amber-900 mb-2">⚠️ Dette kunne jeg desværre ikke finde</div>
                          <div className="space-y-1">
                            {extractResult.extraction.not_found.map((field: string) => (
                              <div key={field} className="flex items-center gap-2 text-xs">
                                <span className="text-amber-600">❌</span>
                                <code className="bg-white px-1 rounded">{field}</code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Errors */}
                      {extractResult.extraction.errors.length > 0 && (
                        <div className="rounded border border-red-200 bg-red-50/60 p-3">
                          <div className="text-xs font-semibold text-red-900 mb-2">❌ Fejl ved gemning</div>
                          <div className="space-y-1">
                            {extractResult.extraction.errors.map((error: string, idx: number) => (
                              <div key={idx} className="text-xs text-red-700">
                                {error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Extracted Values Display */}
                  {extractResult?.debug_extracted_values && (
                    <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 space-y-2">
                      <h4 className="text-xs font-semibold text-blue-900">📦 Extracted Values (What AI Found)</h4>
                      
                      {Object.keys(extractResult.debug_extracted_values.locations || {}).length > 0 && (
                        <div className="bg-white rounded p-2">
                          <div className="text-[11px] font-semibold text-gray-700 mb-1">📍 Contact/Location:</div>
                          <div className="space-y-1 text-xs">
                            {Object.entries(extractResult.debug_extracted_values.locations).map(([key, value]: [string, any]) => (
                              <div key={key} className="flex gap-2">
                                <code className="text-purple-600">{key}:</code>
                                <span className="text-gray-900">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {Object.keys(extractResult.debug_extracted_values.operations || {}).length > 0 && (
                        <div className="bg-white rounded p-2">
                          <div className="text-[11px] font-semibold text-gray-700 mb-1">🔧 Operations:</div>
                          <div className="space-y-1 text-xs">
                            {Object.entries(extractResult.debug_extracted_values.operations).map(([key, value]: [string, any]) => (
                              <div key={key} className="flex gap-2">
                                <code className="text-purple-600">{key}:</code>
                                <span className="text-gray-900">{typeof value === 'boolean' ? (value ? '✅ Yes' : '❌ No') : String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {Object.keys(extractResult.debug_extracted_values.profile || {}).length > 0 && (
                        <div className="bg-white rounded p-2">
                          <div className="text-[11px] font-semibold text-gray-700 mb-1">✨ Profile (AI Text):</div>
                          <div className="space-y-1 text-xs">
                            {Object.entries(extractResult.debug_extracted_values.profile).map(([key, value]: [string, any]) => (
                              <div key={key} className="flex flex-col gap-1">
                                <code className="text-purple-600">{key}:</code>
                                <div className="text-gray-900 bg-gray-50 p-1 rounded max-h-20 overflow-auto">
                                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {extractResult.debug_extracted_values.opening_hours_count > 0 && (
                        <div className="bg-white rounded p-2">
                          <div className="text-[11px] font-semibold text-gray-700">
                            🕐 Opening Hours: {extractResult.debug_extracted_values.opening_hours_count} open days
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => setShowRawExtractData(!showRawExtractData)}
                    className="text-xs text-pink-600 hover:underline"
                  >
                    {showRawExtractData ? '▼ Hide' : '▶ Show'} Debug Data
                  </button>

                  {showRawExtractData && extractResult && (
                    <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-60 border border-gray-200">
                      {JSON.stringify(extractResult, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Business Basics */}
          <div className="bg-surface rounded-lg border-[0.5px] border-[#E2DDD6] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-brand mb-1">{t('businessProfile.sectionBusiness')}</h3>
                {!isEditingBasics && (
                  <p className="text-sm text-text-secondary">
                    {businessName || t('businessProfile.notFilled')} {businessCategory && `· ${businessCategory}`}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingBasics(!isEditingBasics)}
                className="text-[13px] font-medium text-[#076B4E] py-1.5 hover:underline"
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
            )}
          </div>

          {/* Om os */}
          <div className="bg-surface rounded-lg border-[0.5px] border-[#E2DDD6] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-brand mb-1">{t('businessProfile.sectionAbout')}</h3>
                {!isEditingCharacter && (
                  <p className="text-sm text-text-secondary">
                    {aboutText || (
                      <span className="text-text-muted italic">{t('businessProfile.aboutRunAnalysis')}</span>
                    )}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsEditingCharacter(!isEditingCharacter)}
                className="shrink-0 text-[13px] font-medium text-[#076B4E] py-1.5 hover:underline"
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
                    value={aboutText}
                    onChange={(e) => { setAboutText(e.target.value); markUnsaved() }}
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

          {/* Key Offerings */}
          <div className="bg-surface rounded-lg border-[0.5px] border-[#E2DDD6] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-brand mb-1">
                  Hvad tilbyder I?
                  <span className="ml-1 text-text-muted font-normal text-xs">(kun navne)</span>
                </h3>
                {!isEditingKeyOfferings && (
                  keyOfferings ? (
                    <p className="text-sm text-text-secondary whitespace-pre-wrap">{keyOfferings}</p>
                  ) : (
                    <p className="text-sm text-text-muted italic">Ikke angivet</p>
                  )
                )}
              </div>
              <button
                onClick={() => setIsEditingKeyOfferings(!isEditingKeyOfferings)}
                className="text-[13px] font-medium text-[#076B4E] py-1.5 hover:underline"
              >
                {isEditingKeyOfferings ? 'Luk' : 'Rediger'}
              </button>
            </div>

            {isEditingKeyOfferings && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                  <textarea
                    value={keyOfferings}
                    onChange={(e) => { setKeyOfferings(e.target.value); markUnsaved() }}
                    rows={6}
                    placeholder={"Kaffe\nMorgenmad\nSmørrebrød\nSalater\nKage\nSmoothies"}
                    className="w-full px-3 py-2 border border-border rounded text-sm resize-none font-mono"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Angiv 5-7 af jeres hovedprodukter eller populære retter — kun navne, ingen beskrivelser. 
                    Skriv ét produkt per linje. AI'en kender typiske ingredienser og vil automatisk generere passende beskrivelser baseret på rettenavnene.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="bg-surface rounded-lg border-[0.5px] border-[#E2DDD6] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-brand mb-1">{t('businessProfile.sectionLocation')}</h3>
                {!isEditingLocation && (
                  <div className="space-y-2">
                    <p className="text-sm text-text-secondary">
                      {address && city ? `${address}, ${city}` : t('businessProfile.notFilled')}
                    </p>
                    {localLocationReference && (
                      <div className="px-3 py-2 bg-[#F4F1EC] rounded border border-[#E2DDD6]">
                        <p className="text-xs font-medium text-text-secondary mb-0.5">Lokal betegnelse</p>
                        <p className="text-sm text-brand font-medium">{localLocationReference}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsEditingLocation(!isEditingLocation)}
                className="text-[13px] font-medium text-[#076B4E] py-1.5 hover:underline"
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
                <div className="bg-[#F9F8F6] border border-[#E2DDD6] rounded-lg p-4">
                  <label className="block text-sm font-medium text-brand mb-1">
                    Lokal stedsbetegnelse <span className="text-text-tertiary font-normal">(valgfri)</span>
                  </label>
                  <input
                    type="text"
                    value={localLocationReference}
                    onChange={(e) => { setLocalLocationReference(e.target.value); markUnsaved() }}
                    placeholder="f.eks. 'ved åen', 'Nyhavn', 'i Vesterbro'"
                    maxLength={50}
                    className="w-full px-3 py-2 border border-border rounded text-sm"
                  />
                  <div className="mt-2 p-3 bg-[#E8F5F1] rounded border border-[#B8E6D5]">
                    <p className="text-xs text-[#0D5C4C] leading-relaxed">
                      <strong>Hvordan bruges dette?</strong><br/>
                      AI'en bruger denne lokale betegnelse i alt genereret indhold for at gøre opslag mere autentiske. 
                      Eksempler: "ved åen", "Nyhavn", "bugten", "i Vesterbro".<br/>
                      <span className="text-[#0A4A3D] font-medium">→ Forbedrer kvaliteten af opslag markant!</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="bg-surface rounded-lg border-[0.5px] border-[#E2DDD6] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-brand mb-1">{t('businessProfile.sectionContact')}</h3>
                {!isEditingContact && (
                  <div className="space-y-1.5">
                    <p className="text-sm text-text-secondary">
                      {[phone, email].filter(Boolean).join(' · ') || t('businessProfile.notFilled')}
                    </p>
                    {bookingLink.trim() && (
                      <a
                        href={bookingLink.trim()}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-[#076B4E] hover:underline break-all"
                      >
                        {bookingLink.trim()}
                      </a>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsEditingContact(!isEditingContact)}
                className="text-[13px] font-medium text-[#076B4E] py-1.5 hover:underline"
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

          {/* Opening Hours + Service Model — side by side */}
          <div className="grid grid-cols-2 gap-3 items-start">

            {/* Opening Hours */}
            <div className="bg-surface rounded-lg border-[0.5px] border-[#E2DDD6] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-brand">{t('businessProfile.sectionHours')}</h3>
              </div>
              <p className="mb-2 text-xs text-text-muted">
                Brug 15-minutters intervaller: 00, 15, 30 og 45 minutter. Komplekse åbningstider med flere servicevinduer eller forskellige køkkenlukketider pr. dag skal kontrolleres manuelt.
              </p>

              {openingHoursReview.required && (
                <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <p className="font-medium">Åbningstiderne ser tvetydige ud.</p>
                  <p className="mt-1">AI har fundet flere forskellige åbningstidsblokke på hjemmesiden. Gå dem igennem manuelt, før du gemmer.</p>
                  {openingHoursReview.reasons.length > 0 && (
                    <ul className="mt-1 list-disc pl-4 space-y-1">
                      {openingHoursReview.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="space-y-2">
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
                    <div key={day} className="space-y-2 rounded-md border border-[#E7E2DA] bg-[#FCFBF8] p-3">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={openingHours[day].isOpen}
                            onChange={(e) => {
                              setOpeningHours(prev => ({
                                ...prev,
                                [day]: { ...prev[day], isOpen: e.target.checked }
                              }))
                              markUnsaved()
                            }}
                            className="rounded"
                          />
                          <div className="w-8 text-xs text-text-secondary shrink-0">{dayNames[day]}</div>
                        </label>
                        <div className="flex gap-1 items-center">
                          <QuarterHourTimePicker
                            value={openingHours[day].open}
                            className="w-32"
                            disabled={!openingHours[day].isOpen}
                            onChange={(value) => {
                              setOpeningHours(prev => ({
                                ...prev,
                                [day]: { ...prev[day], open: value }
                              }))
                              markUnsaved()
                            }}
                          />
                          <span className="text-xs text-text-muted">–</span>
                          <QuarterHourTimePicker
                            value={openingHours[day].close}
                            className="w-32"
                            disabled={!openingHours[day].isOpen}
                            onChange={(value) => {
                              setOpeningHours(prev => ({
                                ...prev,
                                [day]: { ...prev[day], close: value }
                              }))
                              markUnsaved()
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Service Model */}
            <div className="bg-surface rounded-lg border-[0.5px] border-[#E2DDD6] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-brand">{t('businessProfile.sectionService')}</h3>
              </div>
              <div className="space-y-2">
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
                <label className="flex items-center gap-2 py-1 px-2 rounded-md bg-[#E6F4F1] border border-[#E6F4F1]">
                  <input
                    type="checkbox"
                    checked={hasOutdoorSeating}
                    onChange={(e) => { setHasOutdoorSeating(e.target.checked); markUnsaved() }}
                    className="rounded accent-cta"
                  />
                  <span className="text-sm font-medium text-[#076B4E]">
                    {t('businessProfile.outdoorSeating')}
                    <span className="ml-1.5 inline-block bg-[#E6F4F1] text-[#076B4E] border-[0.5px] border-[#88CDB9] rounded-full px-2 py-0.5 text-[11px] font-medium">{t('businessProfile.outdoorSeatingBadge')}</span>
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
            </div>

            {/* Kitchen close time */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t('businessProfile.kitchenCloseLabel')}
              </label>
              <p className="text-xs text-text-muted mb-2">{t('businessProfile.kitchenCloseHint')}</p>
              <p className="text-xs text-text-muted mb-2">
                Køkkenlukketid er én samlet værdi her. Hvis den varierer pr. dag, bør den eftertjekkes manuelt.
              </p>
              <QuarterHourTimePicker
                value={kitchenCloseTime}
                className="w-32"
                onChange={(value) => { setKitchenCloseTime(value); markUnsaved() }}
              />
            </div>

            {/* Weekly programme */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t('businessProfile.weeklyProgrammeLabel')}
              </label>
              <p className="text-xs text-text-muted mb-2">{t('businessProfile.weeklyProgrammeHint')}</p>
              <textarea
                value={weeklyProgramme}
                onChange={(e) => { setWeeklyProgramme(e.target.value); markUnsaved() }}
                rows={4}
                className="w-full text-sm border border-[#C8C3BB] bg-[#F4F1EC] rounded-lg px-3 py-2 text-text-primary resize-none focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder={"f.eks. Mandag: Quiz-aften fra kl. 19\nFredag: Happy hour 16–18, DJ fra kl. 22\nSøndag: Brunch hele dagen"}
              />
            </div>

          </div>

          {/* Save */}
          <div className="bg-surface border-[0.5px] border-[#E2DDD6] rounded-lg px-4 py-3">
            <p className="mb-3 text-xs text-text-muted">
              {t('businessProfile.saveReminder')}
            </p>
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
                  className="px-3 py-1.5 border border-border text-[#5C5650] rounded text-sm disabled:opacity-50"
                >
                  {t('businessProfile.revertButton')}
                </button>
                <button
                  onClick={() => handleSaveProfile()}
                  disabled={!hasUnsavedChanges || !businessName.trim()}
                  className="px-4 py-2 bg-cta text-text-inverse rounded text-sm font-semibold disabled:opacity-40"
                >
                  {t('businessProfile.saveButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation button - only shown for paid tiers */}
      {currentTier !== 'free' && (
        <div className="flex justify-end mt-6">
          <a
            href="/dashboard/menu"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-cta text-text-inverse font-medium rounded-lg hover:bg-cta-hover transition-colors"
          >
            {t('businessProfile.nextMenu')}
          </a>
        </div>
      )}
    </div>
  )
}

export default BusinessProfilePage
