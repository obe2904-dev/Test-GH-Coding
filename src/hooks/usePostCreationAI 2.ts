import { useState, useCallback, type Dispatch, type SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { supabase } from '../lib/supabase'
import { resolveEffectiveVertical } from '../config/businessVerticals'
import type {
  GeneratedIdea,
  PhotoContent,
  PostContent
} from '../stores/postCreationStore'
import type { Tier } from '../stores/tierStore'

type PlatformTextMap = Record<string, { headline: string; text: string }>

type GeneratedHashtagPayload = {
  hashtags?: unknown
  facebookHashtags?: unknown
  instagramHashtags?: unknown
  hashtag_groups?: Record<string, unknown>
  hashtagGroups?: Record<string, unknown>
}

function sanitizeHashtagValue(value: string): string {
  return value.replace(/^#+/, '').trim()
}

function normalizeHashtagKey(value: string): string {
  return sanitizeHashtagValue(value).replace(/\s+/g, '').toLowerCase()
}

function toHashtagList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => sanitizeHashtagValue(tag))
    .filter((tag) => tag.length > 0)
}

function extractHashtagPlatforms(data: GeneratedHashtagPayload): { facebook: string[]; instagram: string[]; combined: string[]; explicit: boolean } {
  const facebook = toHashtagList(data.facebookHashtags ?? (data.hashtag_groups as any)?.facebook ?? (data.hashtagGroups as any)?.facebook)
  const instagram = toHashtagList(data.instagramHashtags ?? (data.hashtag_groups as any)?.instagram ?? (data.hashtagGroups as any)?.instagram)
  const combined = Array.from(new Set([...facebook, ...instagram, ...toHashtagList(data.hashtags)]))
  return {
    facebook,
    instagram,
    combined,
    explicit: facebook.length > 0 || instagram.length > 0,
  }
}

async function resolveBusinessCategoryForBusiness(businessId: string): Promise<string> {
  const { data: brandProfile } = await supabase
    .from('business_brand_profile')
    .select('business_character, business_identity_persona, identity_keywords, brand_profile_v5')
    .eq('business_id', businessId)
    .maybeSingle()

  const brandProfileV5 = brandProfile?.brand_profile_v5 as any
  const layer0 = brandProfileV5?.layer_0_intelligence as any
  
  const businessCharacter =
    layer0?.business_identity?.system_persona ||
    brandProfile?.business_identity_persona ||
    brandProfile?.business_character ||
    ''
  const identityKeywords = Array.isArray(brandProfile?.identity_keywords)
    ? brandProfile.identity_keywords
    : []

  return resolveEffectiveVertical('cafe', businessCharacter, identityKeywords)
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
    canUseCaptionGeneration,
    incrementCaptionGeneration,
    businessData,
    selectedPlatforms,
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

  const [isGenerating, _setIsGenerating] = useState(false)
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
          .select('id, name')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (business) {
          const businessCategory = await resolveBusinessCategoryForBusiness(business.id)
          businessProfile = {
            business_name: business.name,
            business_category: businessCategory
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
          .select('id, name')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (business) {
          businessId = business.id
          const businessCategory = await resolveBusinessCategoryForBusiness(business.id)

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
            business_category: businessCategory,
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

        const hashtagPayload = extractHashtagPlatforms(data as GeneratedHashtagPayload)

        if (hashtagPayload.combined.length > 0) {
          const sanitizedAiTags: string[] = hashtagPayload.combined

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
                const clean = sanitizeHashtagValue(rawTag)
                if (!clean) return
                const key = normalizeHashtagKey(clean)
                if (!key) return
                const entry = baseMap.get(key) ?? new Set<string>()
                platforms.forEach((platform) => entry.add(platform))
                baseMap.set(key, entry)
              })
            }

            const groups = (data as any)?.hashtag_groups ?? (data as any)?.hashtagGroups
            console.log('📊 Hashtag groups received:', JSON.stringify(groups, null, 2))
            console.log('🎯 Selected platforms:', selectedPlatforms)
            
            const hasInstagram = selectedPlatforms.includes('instagram')
            const instagramOnlyPlatforms = hasInstagram ? ['instagram'] : []
            
            if (hashtagPayload.explicit) {
              assignPlatforms(hashtagPayload.facebook, ['facebook'])
              assignPlatforms(hashtagPayload.instagram, ['instagram'])
            } else {
              // Primary and local: shared across all platforms (includes Facebook brand, location, and mood)
              assignPlatforms(groups?.primary, sharedPlatforms)
              assignPlatforms(groups?.local, sharedPlatforms)
              
              // Foodie and extras: Instagram ONLY (never show on Facebook)
              assignPlatforms(groups?.foodie, instagramOnlyPlatforms)
              assignPlatforms(groups?.extras, instagramOnlyPlatforms)
            }
            
            console.log('✅ Platform assignments:', {
              facebook: hashtagPayload.facebook.length,
              instagram: hashtagPayload.instagram.length,
              primary: groups?.primary?.length || 0,
              local: groups?.local?.length || 0,
              foodie: groups?.foodie?.length || 0,
              extras: groups?.extras?.length || 0,
              instagramOnly: instagramOnlyPlatforms,
              hasInstagram: hasInstagram
            })

            sanitizedAiTags.forEach((tag: string) => {
              const key = normalizeHashtagKey(tag)
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

        console.log('[handleAIUpdate] Setting isEdited to false after successful enhancement')
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
            const clean = sanitizeHashtagValue(tag)
            const key = normalizeHashtagKey(clean)
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
          .select('id, name')
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
            business_category: await resolveBusinessCategoryForBusiness(business.id),
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

      const hashtagPayload = extractHashtagPlatforms(data as GeneratedHashtagPayload)

      if (hashtagPayload.combined.length > 0) {
        const sanitizedTags: string[] = hashtagPayload.combined

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
                const clean = sanitizeHashtagValue(rawTag)
                if (!clean) return
                const key = normalizeHashtagKey(clean)
                if (!key) return
                const entry = baseMap.get(key) ?? new Set<string>()
                platforms.forEach((platform) => entry.add(platform))
                baseMap.set(key, entry)
              })
            }

            if (hashtagPayload.explicit) {
              assignPlatforms(hashtagPayload.facebook, ['facebook'])
              assignPlatforms(hashtagPayload.instagram, ['instagram'])
            } else {
              // Keep the same rules as handleAIUpdate
              assignPlatforms(groups?.primary, sharedPlatforms)
              assignPlatforms(groups?.local, sharedPlatforms)
              assignPlatforms(groups?.foodie, instagramOnlyPlatforms)
              assignPlatforms(groups?.extras, instagramOnlyPlatforms)
            }

            // Ensure every AI tag has a fallback assignment
            sanitizedTags.forEach((tag: string) => {
              const key = normalizeHashtagKey(tag)
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
