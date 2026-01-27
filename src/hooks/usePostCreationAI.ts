import { useState, useCallback, type Dispatch, type SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { buildPostIdeaPrompt, type AITier } from '../features/aiPromptBuilder'
import { supabase } from '../lib/supabase'
import { gatherEnhancedAIContext, fetchBrandProfileForAI } from '../services/enhancedAIContext'
import type {
  GeneratedIdea,
  PhotoContent,
  PostContent
} from '../stores/postCreationStore'
import type { Tier } from '../stores/tierStore'

type PlatformTextMap = Record<string, { headline: string; text: string }>

export interface UsePostCreationAIParams {
  t: TFunction
  language: string
  currentTier: Tier
  getTierLimits: (tier: Tier) => { aiIdeasPerDay: number; captionGenerationsPerDay: number }
  canUseAiIdeas: () => boolean
  canUseCaptionGeneration: () => boolean
  incrementAiIdeas: () => void
  incrementCaptionGeneration: () => void
  businessData: any
  getOnboardingPlatforms: () => string[]
  selectedPlatforms: string[]
  setAiIdeas: (ideas: GeneratedIdea[]) => void
  setShowBusinessInfoPrompt: (open: boolean) => void
  isEnabled: (platform: string) => boolean
  photoContent: PhotoContent | null
  setPhotoIdea: (idea: string) => void
  includeEmojis: boolean
  includeHashtags: boolean
  setIncludeHashtags: (include: boolean) => void
  customizePerPlatform: boolean
  activePlatform: string
  setPlatformTexts: Dispatch<SetStateAction<PlatformTextMap>>
  setHeadline: (value: string) => void
  setText: (value: string) => void
  setHashtags: (tags: string[]) => void
  setSelectedHashtags: Dispatch<SetStateAction<Set<string>>>
  setAiGeneratedHashtags: Dispatch<SetStateAction<Set<string>>>
  hashtagPlatforms: Record<string, string[]>
  setHashtagPlatforms: Dispatch<SetStateAction<Record<string, string[]>>>
  setIsEdited: (edited: boolean) => void
  appendSelectedHashtags: (baseText: string, tags?: Set<string>, include?: boolean, platform?: string) => string
  setPostContent: (content: PostContent) => void
  headline: string
  hashtags: string[]
  selectedHashtags: Set<string>
  aiGeneratedHashtags: Set<string>
  getCurrentText: () => { headline: string; text: string }
  isEdited: boolean
  markAsChanged?: () => void
}

export interface UsePostCreationAIReturn {
  // State
  isGenerating: boolean
  isAIEnhancing: boolean
  isSpellingChecking: boolean
  isSpellingChecked: boolean
  clarificationQuestion: string | null
  clarificationInput: string
  errorMessage: string
  isLoadingPhotoIdea: boolean

  // Actions
  generateAiIdeas: () => Promise<void>
  handleAIUpdate: () => Promise<void>
  handleSpellingCheck: () => Promise<void>
  generateHashtagsOnly: (textToUse: string, headlineToUse?: string) => Promise<void>
  handleClarificationDismiss: () => void
  handleClarificationSubmit: () => void
  resetClarificationState: () => void
  clearClarificationPrompt: () => void

  // Setters exposed to component
  setClarificationInput: (value: string) => void
  setIsSpellingChecked: (checked: boolean) => void
}

export function usePostCreationAI(params: UsePostCreationAIParams): UsePostCreationAIReturn {
  const {
    t,
    language,
    currentTier,
    getTierLimits,
    canUseAiIdeas,
    canUseCaptionGeneration,
    incrementAiIdeas,
    incrementCaptionGeneration,
    businessData,
    getOnboardingPlatforms,
    selectedPlatforms,
    setAiIdeas,
    setShowBusinessInfoPrompt,
    isEnabled,
    photoContent,
    setPhotoIdea,
    includeEmojis,
    includeHashtags,
    setIncludeHashtags,
    customizePerPlatform,
    activePlatform,
    setPlatformTexts,
    setHeadline,
    setText,
    setHashtags,
    setSelectedHashtags,
    setAiGeneratedHashtags,
    hashtagPlatforms,
    setHashtagPlatforms,
    setIsEdited,
    appendSelectedHashtags,
    setPostContent,
    headline,
    hashtags,
    selectedHashtags,
    aiGeneratedHashtags,
    getCurrentText,
    isEdited,
    markAsChanged
  } = params

  const [isGenerating, setIsGenerating] = useState(false)
  const [isAIEnhancing, setIsAIEnhancing] = useState(false)
  const [isSpellingChecking, setIsSpellingChecking] = useState(false)
  const [isSpellingChecked, setIsSpellingChecked] = useState(false)
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null)
  const [clarificationInput, setClarificationInput] = useState('')
  const [hasUsedClarification, setHasUsedClarification] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoadingPhotoIdea, setIsLoadingPhotoIdea] = useState(false)

  const showError = useCallback((message: string, duration = 5000) => {
    setErrorMessage(message)
    if (message) {
      setTimeout(() => setErrorMessage(''), duration)
    }
  }, [])

  const resetClarificationState = useCallback(() => {
    setClarificationQuestion(null)
    setClarificationInput('')
    setHasUsedClarification(false)
  }, [])

  const clearClarificationPrompt = useCallback(() => {
    setClarificationQuestion(null)
    setClarificationInput('')
  }, [])

  const fetchPhotoIdea = useCallback(async (correctedText?: string, correctedHeadline?: string) => {
    const currentContent = getCurrentText()
    const textToUse = correctedText || currentContent.text
    const headlineToUse = correctedHeadline || currentContent.headline

    if (!textToUse || textToUse.trim() === '') {
      return
    }

    setIsLoadingPhotoIdea(true)

    try {
      let businessProfile: any = null
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: business } = await supabase
          .from('businesses')
          .select('name, vertical')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (business) {
          businessProfile = {
            business_name: business.name,
            business_category: business.vertical
          }
        }
      }

      const response = await fetch(import.meta.env.VITE_SUPABASE_FUNCTION_AI_PHOTO_IDEA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          text: textToUse,
          headline: headlineToUse || '',
          businessCategory: businessProfile?.business_category || '',
          businessName: businessProfile?.business_name || '',
          language
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get photo idea')
      }

      const data = await response.json()
      if (data?.photoIdea) {
        setPhotoIdea(data.photoIdea)
      }
    } catch (error) {
      console.error('Error fetching photo idea:', error)
    } finally {
      setIsLoadingPhotoIdea(false)
    }
  }, [getCurrentText, language, setPhotoIdea])

  const generateAiIdeas = useCallback(async () => {
    if (!canUseAiIdeas()) {
      const limits = getTierLimits(currentTier)
      alert(
        t(
          'generate.quotaExceeded',
          `You've reached your daily limit of ${limits.aiIdeasPerDay} AI ideas. ${currentTier === 'free' ? 'Upgrade to Smart for unlimited ideas!' : 'Try again tomorrow.'}`
        )
      )
      return
    }

    if (!businessData.hasWebsiteAnalysis) {
      alert(t('generate.needWebsiteAnalysis', 'Please analyze your website in Business Profile first to use AI Ideas.'))
      return
    }

    setIsGenerating(true)

    try {
      // Get current user for enhanced context
      const { data: { user } } = await supabase.auth.getUser()
      
      // Gather enhanced context for paid tiers (brand voice, weather, holidays, post history)
      let enhancedContext = undefined
      let brandProfile = undefined
      
      if (currentTier !== 'free' && businessData.business?.id && user?.id) {
        try {
          // Fetch brand profile and enhanced context in parallel
          const [brandProfileResult, enhancedContextResult] = await Promise.all([
            fetchBrandProfileForAI(businessData.business.id),
            gatherEnhancedAIContext(
              businessData.business.id,
              user.id,
              businessData.location?.city,
              businessData.location?.country || 'DK'
            )
          ])
          
          brandProfile = brandProfileResult
          enhancedContext = enhancedContextResult
          
          console.log('Brand profile loaded:', brandProfile ? 'yes' : 'no')
          console.log('Enhanced context gathered:', enhancedContext?.formattedContext?.substring(0, 200))
        } catch (e) {
          console.warn('Could not gather enhanced context:', e)
        }
      }

      // Fetch profile data with offerings and opening hours from correct sources
      let profileData = undefined
      const businessId = businessData.business?.id
      
      if (businessId) {
        try {
          // Fetch opening hours from opening_hours table
          const { data: openingHoursData } = await supabase
            .from('opening_hours')
            .select('weekday, open_time, close_time, closed, kind')
            .eq('business_id', businessId)
            .eq('kind', 'normal')
          
          // Fetch menu_structure from business_profile (has category structure)
          const { data: businessProfileData } = await supabase
            .from('business_profile')
            .select('menu_structure, booking_url')
            .eq('business_id', businessId)
            .maybeSingle()
          
          // Fetch actual menu items from menu_extractions table (where Menukort page stores them)
          const { data: menuExtractionsData } = await supabase
            .from('menu_extractions')
            .select('extracted_data, menu_name, menu_type')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })
          
          console.log('🔍 Menu data sources:', {
            businessProfileExists: !!businessProfileData,
            hasMenuStructure: !!(businessProfileData as any)?.menu_structure,
            menuExtractionsCount: menuExtractionsData?.length || 0,
            firstExtractionPreview: menuExtractionsData?.[0] ? JSON.stringify(menuExtractionsData[0]).slice(0, 300) : 'none'
          })
          
          // Merge menu extractions into a single offerings structure
          let mergedMenuItems: any = null
          if (menuExtractionsData && menuExtractionsData.length > 0) {
            const normalizeKey = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

            // Prefer the most recent extraction per menu_type to avoid mixing old and new versions
            const latestByType = new Map<string, any>()
            for (const extraction of menuExtractionsData) {
              const menuType = String((extraction as any)?.menu_type || 'unknown')
              if (!latestByType.has(menuType)) {
                latestByType.set(menuType, extraction)
              }
            }

            const selectedExtractions = Array.from(latestByType.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([, extraction]) => extraction)

            const mergedCategoryMap = new Map<
              string,
              { id?: string; name: string; items: Array<{ id?: string; name: string; short_desc?: string }> }
            >()

            for (const extraction of selectedExtractions) {
              const extractedData = (extraction as any).extracted_data
              const categories = extractedData?.categories
              if (!categories || !Array.isArray(categories)) continue

              for (const category of categories) {
                const categoryName = String(category?.name || '').trim()
                if (!categoryName) continue

                const categoryKey = normalizeKey(categoryName)
                const existing = mergedCategoryMap.get(categoryKey)

                const next = existing || {
                  id: category?.id,
                  name: categoryName,
                  items: [] as Array<{ id?: string; name: string; short_desc?: string }>
                }

                const items = Array.isArray(category?.items) ? category.items : []
                const seenItemNames = new Set(next.items.map((it) => normalizeKey(String(it?.name || ''))))

                for (const item of items) {
                  const itemName = String(item?.name || '').trim()
                  if (!itemName) continue
                  const itemKey = normalizeKey(itemName)
                  if (seenItemNames.has(itemKey)) continue

                  next.items.push({
                    id: item?.id,
                    name: itemName,
                    short_desc: item?.short_desc
                  })
                  seenItemNames.add(itemKey)
                }

                mergedCategoryMap.set(categoryKey, next)
              }
            }

            const mergedCategories = Array.from(mergedCategoryMap.values())
              .map((cat) => ({
                ...cat,
                items: [...cat.items].sort((a, b) => a.name.localeCompare(b.name))
              }))
              .sort((a, b) => a.name.localeCompare(b.name))

            const mergedTotalItems = mergedCategories.reduce((sum, cat) => sum + (cat.items?.length || 0), 0)

            console.log('🍽️ AI menu merge summary:', {
              selectedMenuTypes: selectedExtractions.map((e) => String((e as any)?.menu_type || 'unknown')),
              selectedMenus: selectedExtractions.map((e) => ({
                menu_type: String((e as any)?.menu_type || 'unknown'),
                menu_name: String((e as any)?.menu_name || ''),
              })),
              mergedCategories: mergedCategories.length,
              mergedTotalItems,
              firstCategoryPreview: mergedCategories[0]
                ? {
                    name: mergedCategories[0].name,
                    items: mergedCategories[0].items.slice(0, 3).map((it) => it.name)
                  }
                : null
            })

            if (mergedCategories.length > 0) {
              mergedMenuItems = { categories: mergedCategories }
            }
          }
          
          // Also check profiles table for business_offerings (fallback)
          let businessOfferings = null
          if (user?.id) {
            const { data: userProfile } = await supabase
              .from('profiles')
              .select('business_offerings')
              .eq('id', user.id)
              .maybeSingle()
            businessOfferings = userProfile?.business_offerings
          }
          
          // Convert opening_hours array to object format
          let openingHoursObj = null
          if (openingHoursData && openingHoursData.length > 0) {
            openingHoursObj = {} as any
            for (const row of openingHoursData) {
              openingHoursObj[row.weekday] = {
                open: row.open_time,
                close: row.close_time,
                closed: row.closed
              }
            }
          }
          
          // Use merged menu_extractions data (has actual menu items), fallback to business_profile or profiles
          const menuStructure = (businessProfileData as any)?.menu_structure
          const bookingUrl = (businessProfileData as any)?.booking_url
          const offerings = mergedMenuItems || menuStructure || businessOfferings
          
          profileData = {
            opening_hours: openingHoursObj,
            business_offerings: offerings,
            booking_url: bookingUrl
          }
          
          console.log('Profile data loaded:', {
            hasOfferings: !!offerings,
            hasOpeningHours: !!openingHoursObj,
            hasBookingUrl: !!bookingUrl,
            offeringsSource: mergedMenuItems ? 'menu_extractions' : (menuStructure ? 'business_profile.menu_structure' : (businessOfferings ? 'profiles.business_offerings' : 'none')),
            openingHoursDays: openingHoursObj ? Object.keys(openingHoursObj) : [],
            bookingUrl: bookingUrl || 'none',
            offeringsStructure: offerings ? JSON.stringify(offerings).slice(0, 200) : 'none'
          })
          
          // Diagnostic: Check if offerings has actual items
          if (offerings) {
            const parsed = typeof offerings === 'string' ? JSON.parse(offerings) : offerings
            const cats = Array.isArray(parsed) ? parsed : (parsed?.categories || [])
            const totalItems = cats.reduce((sum: number, cat: any) => sum + (cat?.items?.length || 0), 0)
            console.log(`📊 Menu structure has ${cats.length} categories with ${totalItems} total items`)
            if (totalItems === 0) {
              console.warn('⚠️ Menu structure has NO items - AI will use category names or fail validation')
            }
          }
        } catch (e) {
          console.warn('Could not fetch profile data:', e)
        }
      }

      const promptContext = {
        business: businessData.business,
        profile: businessData.profile,
        location: businessData.location,
        websiteAnalysis: businessData.latestAnalysis,
        brandProfile,  // Pass brand profile for AI prompt (highest priority)
        enhancedContext,
        profileData
      }

      const aiPrompt = buildPostIdeaPrompt(promptContext, {
        mode: 'ai',
        userTopic: '',
        userTier: currentTier as AITier,
        language,
        targetPlatforms: getOnboardingPlatforms()
      })

      const aiPromptWithNonce = `${aiPrompt}

    === VARIATION (MANDATORY) ===
    - The 3 ideas must NOT use the same opening phrase/sentence structure.
    - Avoid repeating the same CTA wording across ideas.

    REQUEST_ID: ${Date.now()}`

      // Use ai-generate-v2 Edge Function
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate-v2`

      if (!import.meta.env.VITE_SUPABASE_URL) {
        console.warn('VITE_SUPABASE_URL not set — using mock ideas')
        const mockIdeas: GeneratedIdea[] = [
          {
            id: `ai-${Date.now()}-1`,
            title: t('generate.aiIdea1Title', 'Weekend Special Offer'),
            headline: t('generate.aiIdea1Headline', '🔥 Weekend Special: 20% Off Everything!'),
            text:
              t(
                'generate.aiIdea1Text',
                'This weekend only! Get 20% off all our products. Perfect time to treat yourself or find that special gift. Visit us in-store or shop online. Limited time offer!'
              ) + '\n\n#WeekendSale #Shopping #Discount #SpecialOffer #LimitedTime',
            description: t('generate.aiIdea1Photo', 'Bright photo showing popular products with "20% OFF" overlay')
          },
          {
            id: `ai-${Date.now()}-2`,
            title: t('generate.aiIdea2Title', 'Customer Success Story'),
            headline: t('generate.aiIdea2Headline', '💬 What Our Customers Are Saying'),
            text:
              t(
                'generate.aiIdea2Text',
                '"Absolutely love this place! The quality is outstanding and the service is exceptional. Highly recommend!" - Maria K. Thank you for your amazing support!'
              ) + '\n\n#CustomerReview #Testimonial #HappyCustomers #FiveStars',
            description: t('generate.aiIdea2Photo', 'Happy customer testimonial photo with quote overlay')
          },
          {
            id: `ai-${Date.now()}-3`,
            title: t('generate.aiIdea3Title', 'Behind the Scenes'),
            headline: t('generate.aiIdea3Headline', '👀 Behind the Scenes at [Your Business]'),
            text:
              t(
                'generate.aiIdea3Text',
                'Ever wondered how we create our products? Take a peek behind the curtain! Our team works hard every day to bring you the best quality. Check out our process!'
              ) + '\n\n#BehindTheScenes #TeamWork #Quality #Process #MadeWithLove',
            description: t('generate.aiIdea3Photo', 'Authentic workspace photo showing team or production process')
          }
        ]

        setAiIdeas(mockIdeas)
        incrementAiIdeas()
        setIsGenerating(false)
        return
      }

      // Get user's access token for authentication
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          count: 3,
          userTier: currentTier
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const backendMessage = (errorData as any)?.message || (errorData as any)?.error
        const validationDetails = Array.isArray((errorData as any)?.details) ? (errorData as any)?.details : null
        
        // Log detailed validation errors from backend
        if (errorData) {
          console.error('❌ Backend error response:', JSON.stringify(errorData, null, 2))
          if ((errorData as any)?.validationErrors) {
            console.error('Validation errors:', (errorData as any).validationErrors)
          }
          if ((errorData as any)?.debug) {
            console.error('Debug info:', (errorData as any).debug)
          }
        }

        if (response.status === 404) {
          setShowBusinessInfoPrompt(true)
        }

        const messageWithDetails = validationDetails?.length
          ? `${backendMessage || 'Failed to generate AI ideas'}: ${validationDetails.join(' | ')}`
          : backendMessage

        throw new Error(messageWithDetails || 'Failed to generate AI ideas')
      }

      const data = await response.json()

      // V2 API returns ideas (platform-neutral) and formatted posts
      if (!data.ideas || data.ideas.length === 0) {
        throw new Error('No ideas returned from API')
      }

      // Map PostIdea to GeneratedIdea format
      const ideas: GeneratedIdea[] = data.ideas.map((idea: any, index: number) => {
        // Use Instagram formatted post for display (has more hashtags)
        const instagramPost = data.formatted?.instagram?.[index]
        const facebookPost = data.formatted?.facebook?.[index]
        
        return {
          id: `ai-${Date.now()}-${index + 1}`,
          title: idea.hook || `Idea ${index + 1}`,
          headline: idea.hook || '',
          text: instagramPost?.text || facebookPost?.text || idea.caption_base || '',
          hashtags: instagramPost?.hashtags?.join(' ') || facebookPost?.hashtags?.join(' ') || '',
          description: idea.photo_suggestion || t('generate.aiIdeaPhoto', 'Suggested photo for this post'),
          bestTimeToPost: idea.best_time || undefined,
          impact: (idea.impact === 'high' || idea.impact === 'medium' || idea.impact === 'low')
            ? idea.impact
            : undefined,
          menuItemUsed: idea.menu_item?.name || undefined,
          // Store raw idea, formatted posts, and CTA for later use
          _rawIdea: idea,
          _formattedPosts: {
            facebook: facebookPost,
            instagram: instagramPost
          },
          _cta: instagramPost?.cta || facebookPost?.cta
        }
      })

      setAiIdeas(ideas)
      incrementAiIdeas()
    } catch (error: any) {
      console.error('Error generating AI ideas:', error)
      const displayMessage = error?.message || 'Failed to generate AI ideas'
      const translated = t('generate.aiError', displayMessage as any) as unknown
      showError(typeof translated === 'string' ? translated : String(displayMessage))
    } finally {
      setIsGenerating(false)
    }
  }, [
    businessData,
    canUseAiIdeas,
    currentTier,
    getOnboardingPlatforms,
    getTierLimits,
    incrementAiIdeas,
    language,
    selectedPlatforms,
    setAiIdeas,
    setShowBusinessInfoPrompt,
    showError,
    t
  ])

  const handleAIUpdate = useCallback(async () => {
    const currentContent = getCurrentText()

    if (!currentContent.text || currentContent.text.trim() === '') {
      showError(t('generate.errors.enterTextFirst'))
      return
    }

    const wordCount = currentContent.text.trim().split(/\s+/).length
    if (wordCount <= 3 && !clarificationInput && !hasUsedClarification) {
      setClarificationQuestion(t('generate.errors.tellMoreAbout'))
      return
    }

    showError('')

    if (!canUseCaptionGeneration()) {
      const limits = getTierLimits(currentTier)
      showError(
        t(
          'generate.quotaExceeded',
          `Du har nået din daglige grænse på ${limits.captionGenerationsPerDay} tekstforbedringer.`
        )
      )
      return
    }

    // For paid tiers, show business info prompt if no data exists
    // But allow them to proceed anyway for testing/development
    if (currentTier !== 'free' && !businessData.profile && !businessData.business) {
      console.log('⚠️ No business data found for paid tier - showing prompt but allowing enhancement')
      // Only show prompt once, don't block the enhancement
      if (!hasUsedClarification) {
        setShowBusinessInfoPrompt(true)
      }
      // Don't return - allow enhancement to proceed
    }

    setIsAIEnhancing(true)
    setPhotoIdea('')

    try {
      let businessProfile: any = null
      let businessId: string | null = null
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Get business data from businesses table
        const { data: business } = await supabase
          .from('businesses')
          .select('id, name, vertical')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (business) {
          businessId = business.id

          // Get location data (primary location, or first with country if no primary)
          let location = null
          
          // First try to get primary location
          const { data: primaryLocation } = await supabase
            .from('business_locations')
            .select('postal_code, city, country')
            .eq('business_id', business.id)
            .eq('is_primary', true)
            .maybeSingle()
          
          if (primaryLocation?.country) {
            location = primaryLocation
          } else {
            // Fallback: get any location with country set
            const { data: anyLocation } = await supabase
              .from('business_locations')
              .select('postal_code, city, country')
              .eq('business_id', business.id)
              .not('country', 'is', null)
              .limit(1)
              .maybeSingle()
            
            location = anyLocation
          }
          
          console.log('📍 Location query result:', { primaryLocation, location })

          // Get business profile for menu data
          const { data: businessProfileData } = await supabase
            .from('business_profile')
            .select('menu_structure, menu_description')
            .eq('business_id', business.id)
            .maybeSingle()

          // Get opening hours
          const { data: hoursData } = await supabase
            .from('opening_hours')
            .select('*')
            .eq('business_id', business.id)

          // Convert opening hours to weekday format
          let openingHours = null
          if (hoursData && hoursData.length > 0) {
            openingHours = {}
            hoursData.forEach((h: any) => {
              if (h.weekday) {
                openingHours[h.weekday] = {
                  open: h.open_time?.substring(0, 5) || '',
                  close: h.close_time?.substring(0, 5) || '',
                  closed: h.closed || false
                }
              }
            })
          }

          // Try to get keywords from profiles (optional, may not exist)
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('keywords')
            .eq('id', user.id)
            .maybeSingle()

          businessProfile = {
            business_name: business.name,
            business_category: business.vertical,
            address: location?.city || null,
            opening_hours: openingHours,
            keywords: userProfile?.keywords || null,
            country: location?.country ? location.country.trim() : null,
            city: location?.city || null,
            menu_structure: businessProfileData?.menu_structure || null,
            menu_description: businessProfileData?.menu_description || null
          }

          console.log('📊 Business profile assembled:', {
            hasMenuStructure: !!businessProfile.menu_structure,
            hasMenuDescription: !!businessProfile.menu_description,
            hasOpeningHours: !!businessProfile.opening_hours,
            country: businessProfile.country,
            city: businessProfile.city,
            businessId
          })
          
          console.log('📍 Location data from DB:', location)
        }
      }

      const hasPhoto = (photoContent?.uploadedMedia?.length || 0) > 0

      const availablePlatforms = ['facebook', 'instagram'].filter((platform) =>
        isEnabled(platform)
      )

      const response = await fetch(import.meta.env.VITE_SUPABASE_FUNCTION_AI_ENHANCE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          text: currentContent.text,
          headline: currentContent.headline || '',
          platforms: availablePlatforms,
          includeEmojis,
          includeHashtags,
          userTier: currentTier,
          language,
          businessProfile,
          businessId,
          skipClarification: hasUsedClarification,
          hasPhoto,
          clarificationContext: clarificationInput || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to enhance content' }))
        throw new Error(errorData.error || 'Failed to enhance content')
      }

      const data = await response.json()

      if (data?.needs_clarification && data?.question && !clarificationInput) {
        setClarificationQuestion(data.question)
      }

      if (data?.text?.includes('error:meaningless_input')) {
        showError(t('generate.errors.meaningfulText'))
        setIsAIEnhancing(false)
        return
      }

      if (data?.text) {
        const sanitizeHashtag = (value: string) => value.replace(/^#+/, '').trim()
        const normalizeKey = (value: string) => sanitizeHashtag(value).replace(/\s+/g, '').toLowerCase()
        if (customizePerPlatform) {
          setPlatformTexts((prev) => ({
            ...prev,
            [activePlatform]: {
              headline: data.headline || prev[activePlatform]?.headline || '',
              text: data.text
            }
          }))
        } else {
          if (data.headline) setHeadline(data.headline)
          setText(data.text)
        }

        let nextHashtagsList = [...hashtags]
        let nextSelectedSet: Set<string> = new Set(selectedHashtags)
        let nextAiSet: Set<string> = new Set(aiGeneratedHashtags)
        let nextIncludeHashtags = includeHashtags
        let platformAssignmentRecord = hashtagPlatforms

        if (data.hashtags && Array.isArray(data.hashtags) && data.hashtags.length > 0) {
          const sanitizedAiTags: string[] = data.hashtags
            .map((tag: string) => sanitizeHashtag(tag))
            .filter((tag: string): tag is string => tag.length > 0)

          if (sanitizedAiTags.length > 0 && (isEdited || hashtags.length === 0)) {
            const nextAiSetLocal: Set<string> = new Set(sanitizedAiTags)
            const userHashtags = hashtags.filter((tag) => !nextAiSetLocal.has(tag))
            const allHashtags = [...new Set([...userHashtags, ...sanitizedAiTags])]

            setHashtags(allHashtags)
            nextHashtagsList = allHashtags
            nextAiSet = nextAiSetLocal
            setAiGeneratedHashtags(nextAiSetLocal)

            nextSelectedSet = new Set(selectedHashtags)
            sanitizedAiTags.forEach((tag: string) => nextSelectedSet.add(tag))
            setSelectedHashtags(nextSelectedSet)

            setIncludeHashtags(true)
            nextIncludeHashtags = true

            const baseMap = new Map<string, Set<string>>()
            Object.entries(hashtagPlatforms).forEach(([key, platforms]) => {
              baseMap.set(key, new Set(platforms))
            })

            const selectedPlatformList = selectedPlatforms.length > 0 ? selectedPlatforms : ['facebook']
            const sharedPlatforms = selectedPlatforms.includes('facebook') && selectedPlatforms.includes('instagram')
              ? ['facebook', 'instagram']
              : selectedPlatformList

            const assignPlatforms = (tags: unknown, platforms: string[]) => {
              if (!Array.isArray(tags)) return
              tags.forEach((rawTag) => {
                if (typeof rawTag !== 'string') return
                const clean = sanitizeHashtag(rawTag)
                if (!clean) return
                const key = normalizeKey(clean)
                if (!key) return
                const entry = baseMap.get(key) ?? new Set<string>()
                platforms.forEach((platform) => entry.add(platform))
                baseMap.set(key, entry)
              })
            }

            const groups = data.hashtag_groups
            console.log('📊 Hashtag groups received:', JSON.stringify(groups, null, 2))
            console.log('🎯 Selected platforms:', selectedPlatforms)
            
            const hasInstagram = selectedPlatforms.includes('instagram')
            const instagramOnlyPlatforms = hasInstagram ? ['instagram'] : []
            
            // Primary and local: shared across all platforms (includes Facebook brand, location, and mood)
            assignPlatforms(groups?.primary, sharedPlatforms)
            assignPlatforms(groups?.local, sharedPlatforms)
            
            // Foodie and extras: Instagram ONLY (never show on Facebook)
            assignPlatforms(groups?.foodie, instagramOnlyPlatforms)
            assignPlatforms(groups?.extras, instagramOnlyPlatforms)
            
            console.log('✅ Platform assignments:', {
              primary: groups?.primary?.length || 0,
              local: groups?.local?.length || 0,
              foodie: groups?.foodie?.length || 0,
              extras: groups?.extras?.length || 0,
              instagramOnly: instagramOnlyPlatforms,
              hasInstagram: hasInstagram
            })

            sanitizedAiTags.forEach((tag: string) => {
              const key = normalizeKey(tag)
              if (!baseMap.has(key)) {
                baseMap.set(key, new Set(sharedPlatforms))
              }
            })

            const record: Record<string, string[]> = {}
            baseMap.forEach((platforms, key) => {
              if (platforms.size > 0) {
                record[key] = Array.from(platforms)
              }
            })

            platformAssignmentRecord = record
            setHashtagPlatforms(record)
          }
        }

        setIsEdited(false)
        setIsSpellingChecked(false)

        const enhancedContent: PostContent = {
          headline: data.headline || headline,
          text: data.text,
          textWithHashtags: appendSelectedHashtags(
            data.text,
            nextSelectedSet,
            nextIncludeHashtags
          ),
          platformSpecific: false,
          adjustments: {
            length: 'current',
            tone: 'professional',
            includeHashtags: nextIncludeHashtags,
            includeEmojis,
            includeBookingLink: false
          },
          hashtags: nextHashtagsList.map((tag) => {
            const clean = sanitizeHashtag(tag)
            const key = normalizeKey(clean)
            const platforms = platformAssignmentRecord[key] && platformAssignmentRecord[key].length > 0
              ? platformAssignmentRecord[key]
              : (selectedPlatforms.length > 0 ? selectedPlatforms : ['facebook'])
            return {
              tag: `#${clean}`,
              enabled: nextSelectedSet.has(clean),
              platforms
            }
          }),
          aiGeneratedHashtags: Array.from(nextAiSet)
        }

        setPostContent(enhancedContent)
        markAsChanged?.()
        fetchPhotoIdea(data.text, data.headline || currentContent.headline)
      }

      incrementCaptionGeneration()
    } catch (error: any) {
      console.error('Error enhancing content:', error)
      const errMsg = error instanceof Error ? error.message : 'Der opstod en fejl ved forbedring af teksten'
      showError(errMsg)
    } finally {
      setIsAIEnhancing(false)
    }
  }, [
    activePlatform,
    aiGeneratedHashtags,
    appendSelectedHashtags,
    canUseCaptionGeneration,
    clarificationInput,
    customizePerPlatform,
    currentTier,
    fetchPhotoIdea,
    getCurrentText,
    getTierLimits,
    hashtagPlatforms,
    hashtags,
    hasUsedClarification,
    headline,
    includeEmojis,
    includeHashtags,
    incrementCaptionGeneration,
    isEdited,
    language,
    photoContent,
    selectedHashtags,
    selectedPlatforms,
    setAiGeneratedHashtags,
    setHeadline,
    setHashtagPlatforms,
    setHashtags,
    setIncludeHashtags,
    setIsEdited,
    setPlatformTexts,
    setPostContent,
    setSelectedHashtags,
    setText,
    setShowBusinessInfoPrompt,
    showError,
    t,
    markAsChanged
  ])

  /**
   * Generate hashtags only (without text enhancement)
   * Called automatically when selecting an AI idea
   */
  const generateHashtagsOnly = useCallback(async (textToUse: string, headlineToUse?: string) => {
    if (!textToUse || textToUse.trim() === '') {
      return
    }

    console.log('[generateHashtagsOnly] Starting hashtag generation for:', textToUse.slice(0, 100))

    try {
      let businessProfile: any = null
      let businessId: string | null = null
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: business } = await supabase
          .from('businesses')
          .select('id, name, vertical')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (business) {
          businessId = business.id
          
          // Get location data
          const { data: location } = await supabase
            .from('business_locations')
            .select('postal_code, city, country')
            .eq('business_id', business.id)
            .eq('is_primary', true)
            .maybeSingle()
          
          // Get business profile - handle missing profile gracefully
          const { data: profileData, error: profileError } = await supabase
            .from('business_profile')
            .select('short_description')
            .eq('business_id', business.id)
            .maybeSingle()

          if (profileError) {
            console.warn('[generateHashtagsOnly] Could not fetch business_profile:', profileError.message)
          }

          businessProfile = {
            business_name: business.name,
            business_category: business.vertical, // Use vertical from businesses table
            short_description: (profileData as any)?.short_description,
            city: location?.city,
            country: location?.country || 'DK'
          }
        }
      }

      const availablePlatforms = ['facebook', 'instagram'].filter((platform) =>
        isEnabled(platform)
      )

      const response = await fetch(import.meta.env.VITE_SUPABASE_FUNCTION_AI_ENHANCE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          text: textToUse,
          headline: headlineToUse || '',
          platforms: availablePlatforms,
          includeEmojis: false,  // Don't modify text
          includeHashtags: true,  // Just get hashtags
          userTier: currentTier,
          language,
          businessProfile,
          businessId,
          skipTextEnhancement: true,  // Signal to skip text changes
          hasPhoto: false
        })
      })

      if (!response.ok) {
        console.warn('[generateHashtagsOnly] Failed to generate hashtags')
        return
      }

      const data = await response.json()

      if (data?.hashtags && Array.isArray(data.hashtags) && data.hashtags.length > 0) {
        const sanitizeHashtag = (value: string) => value.replace(/^#+/, '').trim()
        const normalizeKey = (value: string) => sanitizeHashtag(value).replace(/\s+/g, '').toLowerCase()
        const sanitizedTags: string[] = data.hashtags
          .map((tag: string) => sanitizeHashtag(tag))
          .filter((tag: string): tag is string => tag.length > 0)

        if (sanitizedTags.length > 0) {
          console.log('[generateHashtagsOnly] Generated hashtags:', sanitizedTags)
          
          setHashtags(sanitizedTags)
          setSelectedHashtags(new Set(sanitizedTags))
          setAiGeneratedHashtags(new Set(sanitizedTags))
          setIncludeHashtags(true)
          
          // Handle platform-specific hashtag assignments
          {
            const groups = (data as any)?.hashtag_groups ?? (data as any)?.hashtagGroups

            const selectedPlatformList = selectedPlatforms.length > 0 ? selectedPlatforms : ['facebook']
            const sharedPlatforms = selectedPlatforms.includes('facebook') && selectedPlatforms.includes('instagram')
              ? ['facebook', 'instagram']
              : selectedPlatformList

            const hasInstagram = selectedPlatforms.includes('instagram')
            const instagramOnlyPlatforms = hasInstagram ? ['instagram'] : []

            const baseMap = new Map<string, Set<string>>()

            const assignPlatforms = (tags: unknown, platforms: string[]) => {
              if (!Array.isArray(tags)) return
              tags.forEach((rawTag) => {
                if (typeof rawTag !== 'string') return
                const clean = sanitizeHashtag(rawTag)
                if (!clean) return
                const key = normalizeKey(clean)
                if (!key) return
                const entry = baseMap.get(key) ?? new Set<string>()
                platforms.forEach((platform) => entry.add(platform))
                baseMap.set(key, entry)
              })
            }

            // Keep the same rules as handleAIUpdate
            assignPlatforms(groups?.primary, sharedPlatforms)
            assignPlatforms(groups?.local, sharedPlatforms)
            assignPlatforms(groups?.foodie, instagramOnlyPlatforms)
            assignPlatforms(groups?.extras, instagramOnlyPlatforms)

            // Ensure every AI tag has a fallback assignment
            sanitizedTags.forEach((tag: string) => {
              const key = normalizeKey(tag)
              if (!baseMap.has(key)) {
                baseMap.set(key, new Set(sharedPlatforms))
              }
            })

            const record: Record<string, string[]> = {}
            baseMap.forEach((platforms, key) => {
              if (platforms.size > 0) {
                record[key] = Array.from(platforms)
              }
            })

            setHashtagPlatforms(record)
          }
        }
      }
    } catch (error) {
      console.warn('[generateHashtagsOnly] Error generating hashtags:', error)
      // Silent fail - don't block the user
    }
  }, [currentTier, isEnabled, language, selectedPlatforms, setAiGeneratedHashtags, setHashtagPlatforms, setHashtags, setIncludeHashtags, setSelectedHashtags])

  const handleSpellingCheck = useCallback(async () => {
    if (!canUseCaptionGeneration()) {
      const limits = getTierLimits(currentTier)
      alert(
        t(
          'generate.quotaExceeded',
          `You've reached your daily limit of ${limits.captionGenerationsPerDay} caption improvements.`
        )
      )
      return
    }

    setIsSpellingChecking(true)

    try {
      const currentContent = getCurrentText()

      const response = await fetch(import.meta.env.VITE_SUPABASE_FUNCTION_SPELLING, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          text: currentContent.text,
          language
        })
      })

      if (!response.ok) throw new Error('Failed to check spelling')

      const data = await response.json()

      if (data?.corrected && typeof data.corrected === 'string') {
        if (customizePerPlatform) {
          setPlatformTexts((prev) => ({
            ...prev,
            [activePlatform]: {
              ...prev[activePlatform],
              text: data.corrected
            }
          }))
        } else {
          setText(data.corrected)
        }

        if (currentContent.headline && currentContent.headline.trim()) {
          try {
            const headlineResponse = await fetch(import.meta.env.VITE_SUPABASE_FUNCTION_SPELLING, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
              },
              body: JSON.stringify({
                text: currentContent.headline,
                language
              })
            })

            if (headlineResponse.ok) {
              const headlineData = await headlineResponse.json()
              if (headlineData?.corrected && typeof headlineData.corrected === 'string') {
                if (customizePerPlatform) {
                  setPlatformTexts((prev) => ({
                    ...prev,
                    [activePlatform]: {
                      ...prev[activePlatform],
                      headline: headlineData.corrected
                    }
                  }))
                } else {
                  setHeadline(headlineData.corrected)
                }
              }
            }
          } catch (headlineError) {
            console.warn('Headline spelling check failed:', headlineError)
          }
        }

        setIsSpellingChecked(true)
        setIsEdited(false)
      }

      incrementCaptionGeneration()
    } catch (error) {
      console.error('Error checking spelling:', error)
      alert(t('generate.aiError', 'Failed to check spelling.'))
    } finally {
      setIsSpellingChecking(false)
    }
  }, [
    activePlatform,
    canUseCaptionGeneration,
    currentTier,
    customizePerPlatform,
    getCurrentText,
    getTierLimits,
    incrementCaptionGeneration,
    language,
    setHeadline,
    setIsEdited,
    setPlatformTexts,
    setText,
    t
  ])

  const handleClarificationDismiss = useCallback(() => {
    setClarificationQuestion(null)
    setClarificationInput('')
    setHasUsedClarification(true)
  }, [])

  const handleClarificationSubmit = useCallback(() => {
    if (!clarificationInput.trim()) {
      return
    }

    setHasUsedClarification(true)
    setClarificationQuestion(null)

    Promise.resolve(handleAIUpdate()).finally(() => {
      setClarificationInput('')
    })
  }, [clarificationInput, handleAIUpdate])

  return {
    isGenerating,
    isAIEnhancing,
    isSpellingChecking,
    isSpellingChecked,
    clarificationQuestion,
    clarificationInput,
    errorMessage,
    isLoadingPhotoIdea,
    generateAiIdeas,
    handleAIUpdate,
    handleSpellingCheck,
    generateHashtagsOnly,
    handleClarificationDismiss,
    handleClarificationSubmit,
    resetClarificationState,
    clearClarificationPrompt,
    setClarificationInput,
    setIsSpellingChecked
  }
}
