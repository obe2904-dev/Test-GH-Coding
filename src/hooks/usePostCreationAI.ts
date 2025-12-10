import { useState, useCallback, type Dispatch, type SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { buildPostIdeaPrompt, type AITier } from '../features/aiPromptBuilder'
import { supabase } from '../lib/supabase'
import type {
  GeneratedIdea,
  PhotoContent,
  PostContent
} from '../stores/postCreationStore'
import type { Tier } from '../stores/tierStore'

type PlatformTextMap = Record<string, { headline: string; text: string }>

type BusinessProfile = {
  business_name?: string | null
  business_category?: string | null
  address?: string | null
  opening_hours?: string | null
  keywords?: string | null
  country?: string | null
}

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
        const { data: profile } = await supabase
          .from('profiles')
          .select('business_name, business_category')
          .eq('id', user.id)
          .single()

        if (profile) {
          businessProfile = profile
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
      const promptContext = {
        business: businessData.business,
        profile: businessData.profile,
        location: businessData.location,
        websiteAnalysis: businessData.latestAnalysis
      }

      const aiPrompt = buildPostIdeaPrompt(promptContext, {
        mode: 'ai',
        userTopic: '',
        userTier: currentTier as AITier,
        language,
        targetPlatforms: getOnboardingPlatforms()
      })

      const apiUrl = import.meta.env.VITE_SUPABASE_FUNCTION_AI_GENERATE

      if (!apiUrl) {
        console.warn('VITE_SUPABASE_FUNCTION_AI_GENERATE not set — using mock ideas')
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

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          platforms: selectedPlatforms,
          includeEmojis: true,
          includeHashtags: true,
          includeCTA: true,
          mode: 'ai-ideas',
          count: 3
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate AI ideas')
      }

      const data = await response.json()

      if (!data.ideas || data.ideas.length === 0) {
        throw new Error('No ideas returned from API')
      }

      const ideas: GeneratedIdea[] = data.ideas.map((idea: any, index: number) => ({
        id: `ai-${Date.now()}-${index + 1}`,
        title: idea.title,
        headline: idea.headline,
        text: idea.text,
        description: idea.description || t('generate.aiIdeaPhoto', 'Suggested photo for this post')
      }))

      setAiIdeas(ideas)
      incrementAiIdeas()
    } catch (error: any) {
      console.error('Error generating AI ideas:', error)
      alert(t('generate.aiError', `Failed to generate AI ideas: ${error.message}`))
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

    if (currentTier !== 'free' && !businessData.profile && !businessData.business) {
      setShowBusinessInfoPrompt(true)
      return
    }

    setIsAIEnhancing(true)
    setPhotoIdea('')

    try {
      let businessProfile: any = null
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Get business data from businesses table
        const { data: business } = await supabase
          .from('businesses')
          .select(`
            name,
            vertical,
            business_locations!inner(city, country)
          `)
          .eq('owner_id', user.id)
          .maybeSingle()

        // Get profile data for keywords and opening hours
        const { data: profile } = await supabase
          .from('profiles')
          .select('business_category, address, opening_hours, keywords, country')
          .eq('id', user.id)
          .single()

        if (business || profile) {
          businessProfile = {
            business_name: business?.name || null,
            business_category: profile?.business_category || business?.vertical || null,
            address: profile?.address || null,
            opening_hours: profile?.opening_hours || null,
            keywords: profile?.keywords || [],
            city: business?.business_locations?.[0]?.city || null,
            country: business?.business_locations?.[0]?.country || profile?.country || null
          }
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
            assignPlatforms(groups?.primary, sharedPlatforms)
            assignPlatforms(groups?.local, sharedPlatforms)
            assignPlatforms(groups?.foodie, sharedPlatforms)
            const instagramPlatforms = selectedPlatforms.includes('instagram') ? ['instagram'] : sharedPlatforms
            assignPlatforms(groups?.extras, instagramPlatforms)

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
    handleClarificationDismiss,
    handleClarificationSubmit,
    resetClarificationState,
    clearClarificationPrompt,
    setClarificationInput,
    setIsSpellingChecked
  }
}
