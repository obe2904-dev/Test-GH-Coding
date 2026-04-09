import { useState, useEffect, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { PlanContextStrip } from '../../components/post-creation/PlanContextStrip'
import { usePostCreationStore } from '../../stores/postCreationStore'
import type { WeeklyPlanSuggestion, PostContent } from '../../stores/postCreationStore'
import { useContextDraft } from '../../hooks/useContextDraft'
import { useBusinessData } from '../../hooks/useBusinessData'
import { useTierStore } from '../../stores/tierStore'
import { supabase } from '../../lib/supabase'

// Bump this when prompt logic or grounding payload changes significantly.
// Any cached row with a lower version is treated as stale and regenerated.
// v2: initial versioning (task 7)
// v3: anledningRule KRAV #5 + LEJLIGHED for menu posts (task 8) + goalDirectiveLine + goalMode in brand block (task 9)
// v4: location-decoration ban (KRAV 10) + intransitive-verb sentence ban (KRAV 11) in generated text
// v5: 'ved åen' named explicitly in faktaforbud + 'svip' banned + snacks filtered from Slot A
// v6: full category structure in menu block; dish_text_brief curated by Gemini; curated brief skips DB re-fetch; hasQualifiedDescription threshold raised to 30
const CURRENT_TEXT_VERSION = 6

// Lazy load post creation steps for better performance
const GenerateStep = lazy(() => import('../../components/post-creation/GenerateStep').then(m => ({ default: m.GenerateStep })))
const CreateStep = lazy(() => import('../../components/post-creation/CreateStep').then(m => ({ default: m.CreateStep })))
const PublishStep = lazy(() => import('../../components/post-creation/PublishStep').then(m => ({ default: m.PublishStep })))

// Loading component
const StepLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4 motion-reduce:animate-none"></div>
      <p className="text-sm text-muted">Loading...</p>
    </div>
  </div>
)

export function CreatePostPage() {
  const { isEnabled, loadPlatformsFromDatabase, enabledPlatforms } = useConnectionsStore()
  const navigate = useNavigate()
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const { 
    activePath,
    writeSelfStep, setWriteSelfStep,
    writeSelfContent, setWriteSelfContent,
    aiIdeerStep, setAiIdeerStep,
    aiIdeerContent, setAiIdeerContent,
    setWriteSelfPhotoIdea,
    setAiIdeerPhotoIdea,
    weeklyPlanStep, setWeeklyPlanStep,
    selectedPlatforms,
    setSelectedPlatforms, 
    selectedSuggestionData,
    weeklyPlanPost,
    setWeeklyPlanPost,
    weeklyPlanSuggestion: _weeklyPlanSuggestion,
    setWeeklyPlanSuggestion,
    setPostContent,
    postContent,
    setPhotoIdea,
    setStrategicIdea,
    weeklyContentPlan,
    weeklyPlanPostIndex,
    setWeeklyPlanPostIndex,
    weeklyPlanSessionDone,
    addWeeklyPlanSessionDone,
    draftMap,
    setDraftMapEntry,
    clearWeeklyPlanSession,
    reset: resetStore,
    setPostCta,
    photoContent,
    setPhotoContent,
  } = usePostCreationStore()

  // ── Path-aware current step (replaces local useState) ──
  const currentStep: 'generate' | 'create' | 'publish' =
    activePath === 'write' ? writeSelfStep
    : activePath === 'ai-ideas' ? aiIdeerStep
    : weeklyPlanStep

  const setCurrentStep = (step: 'generate' | 'create' | 'publish') => {
    if (activePath === 'write') setWriteSelfStep(step)
    else if (activePath === 'ai-ideas') setAiIdeerStep(step)
    else setWeeklyPlanStep(step)
  }

  // ── Path-aware content (write/ai-ideas have their own slots; weekly-plan uses postContent) ──
  const activeContent = activePath === 'write' ? writeSelfContent
    : activePath === 'ai-ideas' ? aiIdeerContent
    : postContent

  const setActiveContent = (content: PostContent | null) => {
    if (activePath === 'write') setWriteSelfContent(content)
    else if (activePath === 'ai-ideas') setAiIdeerContent(content)
    else setPostContent(content)
  }

  // Route photo idea to the active path's slot so switching paths shows the correct suggestion.
  const setActivePhotoIdea = (idea: string) => {
    if (activePath === 'write') setWriteSelfPhotoIdea(idea)
    else if (activePath === 'ai-ideas') setAiIdeerPhotoIdea(idea)
    else setPhotoIdea(idea) // weekly-plan: writes directly
  }

  const [isGenerating, setIsGenerating] = useState(false)
  const businessData = useBusinessData()
  const { currentTier } = useTierStore()

  // ── Auto-save: context-keyed localStorage draft (no modal, no interval) ──
  // Weekly Plan posts are persisted by the store's setDraftMapEntry; only
  // Skriv Selv and AI Ideer need a key here.
  const draftKey = activePath === 'weekly-plan' || weeklyContentPlan
    ? null
    : activePath === 'ai-ideas' && selectedSuggestionData?.id
      ? `p2g_draft_idea_${selectedSuggestionData.id}`
      : 'p2g_draft_manual'
  const { save: saveDraft, restoreNow, clear: clearDraft } = useContextDraft(draftKey)

  // No-ops kept for backward compat with child component props
  const markAsChanged = () => {}
  const markAsSaved = () => {}
  const hasUnsavedChanges = false

  // Load platforms from database on mount
  useEffect(() => {
    loadPlatformsFromDatabase()
  }, [loadPlatformsFromDatabase])

  // Auto-advance to Design when entering from Weekly Plan (skip Generate step)
  useEffect(() => {
    console.log('[WeeklyPlanEffect] fired', {
      hasWeeklyContentPlan: !!weeklyContentPlan,
      hasWeeklyPlanPost: !!weeklyPlanPost,
      currentStep,
      weeklyPlanPostIndex,
      hasDraftText: !!(draftMap[weeklyPlanPostIndex] as any)?.text,
    })
    if (weeklyContentPlan && weeklyPlanPost && currentStep === 'generate') {
      const savedContent = draftMap[weeklyPlanPostIndex]
      if (savedContent?.text) {
        // Restore previously saved draft for this idea.
        // Also populate weeklyPlanSuggestion so the photo suggestion is
        // visible in the design stage (same data that handleDirectTransfer sets).
        setWeeklyPlanSuggestion(buildWeeklyPlanSuggestion(weeklyPlanPost, weeklyPlanPostIndex))
        if (weeklyPlanPost.visualDirection) {
          const briefParts = [
            weeklyPlanPost.visualDirection.subject,
            weeklyPlanPost.visualDirection.angle,
            weeklyPlanPost.visualDirection.setting,
          ].filter(Boolean)
          setPhotoIdea(briefParts.join(' — '))
        }
        setPostContent(savedContent)
        setCurrentStep('create')
      } else {
        // Fresh idea — run direct transfer (populates store from plan data)
        handleDirectTransfer()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeklyPlanPost])

  // Silent restore for Skriv Selv: if the user has a manual draft from a previous session,
  // hydrate it automatically and skip the Generate step.
  useEffect(() => {
    if (activePath === 'write' && !writeSelfContent) {
      const saved = restoreNow() as any
      if (saved) {
        setWriteSelfContent(saved.content ?? saved)
        // Restore photo URLs — recreate MediaItem stubs (no File object needed for display)
        if (saved.photoMedia?.length) {
          setPhotoContent({
            uploadedMedia: saved.photoMedia.map((m: any) => ({
              id: m.id,
              file: new File([], 'restored'),
              url: m.originalUrl || m.url,
              originalUrl: m.originalUrl,
              adjustedUrl: m.adjustedUrl,
              type: m.type || 'image',
              selectedVersionForPost: m.selectedVersionForPost || 'original',
              analysisCache: m.analysisCache,
            })),
            selectedMedia: null,
            isOriginal: true,
            photoAdjustments: null,
          })
        }
        setWriteSelfStep('create')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount-only: intentionally ignore refs

  // Auto-save postContent + photo URLs whenever they change (Skriv Selv + AI Ideer).
  // Weekly Plan posts are saved separately inside the store's setDraftMapEntry.
  useEffect(() => {
    if (activeContent && activePath !== 'weekly-plan') {
      // Serialise photo media as URL-only stubs (File objects can't be JSON-stringified)
      const photoMedia = photoContent?.uploadedMedia?.map(m => ({
        id: m.id,
        url: m.originalUrl || m.url,
        originalUrl: m.originalUrl,
        adjustedUrl: m.adjustedUrl,
        type: m.type,
        selectedVersionForPost: m.selectedVersionForPost,
        analysisCache: m.analysisCache,
      })) ?? []
      saveDraft({ content: activeContent, photoMedia })
    }
  }, [activeContent, photoContent, activePath, saveDraft])

  // Initialize selected platforms with enabled platforms (all platforms for both tiers)
  useEffect(() => {
    // Use enabledPlatforms from store hook (reactively updates when data loads from database)
    console.log('🔍 CreatePostPage platform init:', { 
      enabledPlatforms, 
      currentTier,
      hasData: enabledPlatforms.length > 0,
      selectedPlatformsLength: selectedPlatforms.length
    })
    // Set all enabled platforms for both FREE and PAID tiers (for preview purposes)
    if (enabledPlatforms.length > 0 && selectedPlatforms.length === 0) {
      console.log('✅ Setting platforms to:', enabledPlatforms)
      setSelectedPlatforms(enabledPlatforms)
    } else if (enabledPlatforms.length === 0) {
      console.log('⏳ Waiting for platforms to load from database...')
    }
  }, [enabledPlatforms, setSelectedPlatforms, currentTier, selectedPlatforms.length])

  // Navigation handlers for 3-step flow
  const handleGenerateNext = async () => {
    console.log('[CreatePostPage] handleGenerateNext called')
    console.log('[CreatePostPage] selectedSuggestionData:', selectedSuggestionData)
    console.log('[CreatePostPage] selectedPlatforms:', selectedPlatforms)
    
    // Check if user selected an AI suggestion
    if (selectedSuggestionData && selectedSuggestionData.id !== 0) {
      console.log('[CreatePostPage] ✨ AI suggestion detected, checking for cached content...')

      // 1️⃣ Check localStorage draft first — this contains any user edits on top of the
      //    original AI output, so it takes priority over the daily_suggestions DB cache.
      //    Only restore if the draft has actual text — an empty draft means a previous
      //    generation failed and was never retried. Silently discard and regenerate.
      const localDraft = restoreNow() as any
      // Support both old format (PostContent directly) and new format ({ content, photoMedia })
      const localDraftContent = localDraft?.content ?? localDraft
      const localDraftPhotoMedia = localDraft?.photoMedia ?? null
      if (localDraftContent && localDraftContent.text?.trim()) {
        console.log('✅ Restoring user-edited draft from localStorage for suggestion:', selectedSuggestionData.id)
        setActiveContent(localDraftContent)
        if (selectedSuggestionData.photoIdea) setActivePhotoIdea(selectedSuggestionData.photoIdea)
        // Restore photos if saved alongside the draft
        if (localDraftPhotoMedia?.length && !photoContent?.uploadedMedia?.length) {
          setPhotoContent({
            uploadedMedia: localDraftPhotoMedia.map((m: any) => ({
              id: m.id,
              file: new File([], 'restored'),
              url: m.originalUrl || m.url,
              originalUrl: m.originalUrl,
              adjustedUrl: m.adjustedUrl,
              type: m.type || 'image',
              selectedVersionForPost: m.selectedVersionForPost || 'original',
              analysisCache: m.analysisCache,
            })),
            selectedMedia: null,
            isOriginal: true,
            photoAdjustments: null,
          })
        }
        setCurrentStep('create')
        return
      }
      
      try {
        // 2️⃣ Check DB cache (original AI-generated text)
        console.log('🔍 Checking DB cache for suggestion ID:', selectedSuggestionData.id)
        const { data: cachedSuggestion, error: fetchError } = await supabase
          .from('daily_suggestions')
          .select('generated_text, generated_hashtags, generated_platform_content, generated_at, platforms_generated, text_generation_version')
          .eq('id', selectedSuggestionData.id)
          .single()
        
        if (fetchError) {
          console.error('❌ Error fetching cached content:', fetchError)
        }
        
        console.log('📦 Cache lookup result:', {
          suggestionId: selectedSuggestionData.id,
          hasGeneratedText: !!cachedSuggestion?.generated_text,
          hasGeneratedAt: !!cachedSuggestion?.generated_at,
          platformsInCache: cachedSuggestion?.platforms_generated,
          currentPlatforms: selectedPlatforms,
          cachedTextPreview: cachedSuggestion?.generated_text?.substring(0, 50),
        })
        
        let data
        let hashtagArray
        const platformsMatch = cachedSuggestion?.platforms_generated?.length === selectedPlatforms.length &&
          selectedPlatforms.every(p => cachedSuggestion.platforms_generated?.includes(p))
        const versionMatch = (cachedSuggestion?.text_generation_version ?? 0) >= CURRENT_TEXT_VERSION
        
        console.log('🔎 Cache decision:', {
          hasText: !!cachedSuggestion?.generated_text,
          hasTimestamp: !!cachedSuggestion?.generated_at,
          platformsMatch,
          versionMatch,
          cachedVersion: cachedSuggestion?.text_generation_version ?? 0,
          currentVersion: CURRENT_TEXT_VERSION,
          willUseCache: !!(cachedSuggestion?.generated_text && cachedSuggestion?.generated_at && platformsMatch && versionMatch)
        })
        
        // Use cached content if available, platforms match, and version is current
        if (cachedSuggestion?.generated_text && cachedSuggestion?.generated_at && platformsMatch && versionMatch) {
          console.log('✅ Loading cached content from database (generated at:', cachedSuggestion.generated_at, ')')
          data = {
            sharedText: cachedSuggestion.generated_text,
            facebook: cachedSuggestion.generated_platform_content?.facebook,
            instagram: cachedSuggestion.generated_platform_content?.instagram
          }
          // Use cached hashtags
          hashtagArray = cachedSuggestion.generated_hashtags || []
          // No loading state needed for cached content - it's instant!
        } else {
          // No cache or platforms changed - show loading and generate fresh content
          setIsGenerating(true)
          console.log('🚀 Generating fresh text from idea:', selectedSuggestionData.title)
          
          const rawIdea = selectedSuggestionData._rawIdea
          const contentType = selectedSuggestionData.contentType || rawIdea?.idea_type || 'atmosphere'
          const menuItemName = selectedSuggestionData.menuItemName || rawIdea?.menu_item?.name || ''
          // Prefer explicit description; fall back to captionBase (same value for menu posts)
          const menuItemDescription = selectedSuggestionData.menuItemDescription
            || selectedSuggestionData.captionBase
            || rawIdea?.caption_base
            || ''
          const captionBase = selectedSuggestionData.captionBase || rawIdea?.caption_base || ''
          const ctaIntent = selectedSuggestionData.ctaIntent || rawIdea?.cta_intent || 'visit'
          const { data: generatedData, error } = await supabase.functions.invoke('generate-text-from-idea', {
            body: {
              businessId: businessData.business?.id,
              suggestion: {
                id: selectedSuggestionData.id,
                title: selectedSuggestionData.title,
                source: 'ai_ideas',
                contentType,
                menuItemName,
                menuItemDescription,
                captionBase,
                ctaIntent,
                photoIdea: selectedSuggestionData.photoIdea || '',
                whyExplanation: selectedSuggestionData.whyExplanation || '',
              },
              platforms: selectedPlatforms,
              tier: currentTier,
            }
          })
        
        if (error) {
          console.error('❌ Generation error:', error)
          throw error
        }
        
        data = generatedData
        console.log('✅ Generated content:', data)
        
          // Merge platform-specific hashtags into unified structure
          const allHashtags = new Map<string, { tag: string; platforms: string[] }>()
          
          if (data.facebook?.hashtags) {
            data.facebook.hashtags.forEach((tag: string) => {
              const normalized = tag.replace(/^#/, '')
              if (!allHashtags.has(normalized)) {
                allHashtags.set(normalized, { tag: normalized, platforms: [] })
              }
              allHashtags.get(normalized)!.platforms.push('facebook')
            })
          }
          
          if (data.instagram?.hashtags) {
            data.instagram.hashtags.forEach((tag: string) => {
              const normalized = tag.replace(/^#/, '')
              if (!allHashtags.has(normalized)) {
                allHashtags.set(normalized, { tag: normalized, platforms: [] })
              }
              if (!allHashtags.get(normalized)!.platforms.includes('instagram')) {
                allHashtags.get(normalized)!.platforms.push('instagram')
              }
            })
          }
          
          hashtagArray = Array.from(allHashtags.values()).map(({ tag, platforms }) => ({
            tag: `#${tag}`,
            enabled: true,
            platforms
          }))
        
          // Save generated content to database for future use
          try {
            console.log('💾 Saving generated content to database:', {
              suggestionId: selectedSuggestionData.id,
              hasText: !!(data.sharedText || data.facebook?.text),
              hashtagCount: hashtagArray.length,
              platforms: selectedPlatforms,
              textPreview: (data.sharedText || data.facebook?.text || '').substring(0, 50)
            })
            
            const { error: saveError } = await supabase
              .from('daily_suggestions')
              .update({
                generated_text: data.sharedText || data.facebook?.text || '',
                generated_hashtags: hashtagArray,
                generated_platform_content: {
                  facebook: data.facebook,
                  instagram: data.instagram
                },
                generated_at: new Date().toISOString(),
                platforms_generated: selectedPlatforms,
                text_generation_version: CURRENT_TEXT_VERSION
              })
              .eq('id', selectedSuggestionData.id)
            
            if (saveError) {
              console.warn('⚠️ Failed to cache generated content:', saveError)
            } else {
              console.log('✅ Successfully saved generated content to database')
            }
          } catch (cacheError) {
            console.warn('⚠️ Cache save error:', cacheError)
          }
        }
        
        // Use the hashtags from either cache or fresh generation
        // (already stored in hashtagArray variable)
        
        // Populate store with generated content
        setActiveContent({
          headline: selectedSuggestionData.title,
          text: data.sharedText || data.facebook?.text || '',
          hashtags: hashtagArray,
          adjustments: {
            length: 'current',
            tone: 'brand',
            includeHashtags: true,
            includeEmojis: true,
            includeBookingLink: false
          },
          platformSpecific: selectedPlatforms.length > 1,
          platformContent: {
            facebook: {
              headline: selectedSuggestionData.title,
              // Fall back to sharedText so cache hits without generated_platform_content still render
              text: data.facebook?.text || data.sharedText || '',
              hashtags: hashtagArray.filter(h => h.platforms?.includes('facebook')),
              adjustments: {
                length: 'current',
                tone: 'brand',
                includeHashtags: true,
                includeEmojis: true,
                includeBookingLink: false
              }
            },
            instagram: {
              headline: selectedSuggestionData.title,
              text: data.instagram?.text || data.sharedText || '',
              hashtags: hashtagArray.filter(h => h.platforms?.includes('instagram')),
              adjustments: {
                length: 'current',
                tone: 'brand',
                includeHashtags: true,
                includeEmojis: true,
                includeBookingLink: false
              }
            }
          },
          aiGeneratedHashtags: hashtagArray.map(h => h.tag.replace(/^#/, ''))
        })
        
        // Set photo idea
        if (selectedSuggestionData.photoIdea) {
          setActivePhotoIdea(selectedSuggestionData.photoIdea)
        }

        // Store CTA with booking URL for PublishStep
        setPostCta(data.facebook?.cta || null)

        console.log('✅ Store populated, advancing to Design step')
        
      } catch (err) {
        console.error('❌ Text generation failed:', err)
        console.error('Error details:', err)
        // Show user-facing error — do not silently advance with empty text
        alert('Tekstgenerering fejlede. Prøv igen.')
        setIsGenerating(false)
        return
      } finally {
        console.log('[CreatePostPage] Generation complete, clearing loading state')
        setIsGenerating(false)
      }
    }
    
    // Advance to Design step
    console.log('[CreatePostPage] Navigating to Design step')
    setCurrentStep('create')
  }

  const handleCreateNext = () => {
    // Save current text to draftMap so it survives idea switching (weekly plan only)
    if (weeklyContentPlan && activeContent) {
      setDraftMapEntry(weeklyPlanPostIndex, activeContent)
    }
    setCurrentStep('publish')
  }

  // Direct transfer from Weekly Plan: call generate-text-from-idea with strategy data.
  // This mirrors handleGenerateNext but uses PostSpecification fields instead of daily_suggestions.
  // Accepts an optional override post + index for use by handleSwitchToIdea.
  // Build a WeeklyPlanSuggestion from a PostSpecification without triggering text generation.
  // This is used both by handleDirectTransfer and by draft-restore paths so that
  // the photo suggestion (mediaSuggestionStructured) is always available in the design stage.
  const buildWeeklyPlanSuggestion = (plan: NonNullable<typeof weeklyPlanPost>, index: number): WeeklyPlanSuggestion => {
    const isMenuPostType = plan.postType.type === 'menu_item' || plan.postType.type === 'product_menu' || plan.postType.type === 'craving_visual'
    const captionBaseForIdea = isMenuPostType
      ? (plan.contentSubject.menuItemDescription || '')
      : ''
    const guestMoment = !isMenuPostType
      ? (plan.contentSubject.whyThisDish?.[0] || plan.selectionRationale || '')
      : (plan.selectionRationale || '')
    return {
      id: plan.idea_id ? String(plan.idea_id) : `weekly-${index}`,
      title: plan.contentSubject.dish,
      captionBase: captionBaseForIdea,
      source: 'weekly_plan',
      contentType: plan.postType.type,
      menuItemName: plan.contentSubject.menuItemName,
      menuItemDescription: plan.contentSubject.menuItemDescription,
      rationale: plan.strategicContext?.rationale,
      goalMode: plan.postType.goal_mode,
      guestMoment: guestMoment || undefined,
      timingDay: plan.timing?.day || undefined,
      timingTime: plan.timing?.time || undefined,
      timingRationale: plan.timing?.rationale || undefined,
      visualSubject: plan.visualDirection?.subject || undefined,
      visualAngle: plan.visualDirection?.angle || undefined,
      visualSetting: plan.visualDirection?.setting || undefined,
      ctaIntent: plan.caption?.ctaType || undefined,
      platformFormat: plan.platformFormat?.format || undefined,
      selectionRationale: plan.selectionRationale || undefined,
      captionFirstLine: plan.caption?.firstLine || undefined,
      holidayContext: plan.holiday_context
        ? [plan.holiday_context.name, plan.holiday_context.strategic_angle, plan.holiday_context.marketing_hook].filter(Boolean).join(' – ')
        : undefined,
    }
  }

  const handleDirectTransfer = async (overridePost?: typeof weeklyPlanPost, overrideIndex?: number) => {
    const plan = overridePost ?? weeklyPlanPost
    const index = overrideIndex ?? weeklyPlanPostIndex
    if (!plan) return

    const suggestion = buildWeeklyPlanSuggestion(plan, index)
    setWeeklyPlanSuggestion(suggestion)

    setIsGenerating(true)
    console.log('[handleDirectTransfer] calling generate-text-from-idea', {
      businessId: weeklyContentPlan?.businessId || businessData.business?.id,
      hastitle: !!(plan.contentSubject?.dish),
      platforms: selectedPlatforms,
      tier: currentTier,
    })
    try {
      const { data, error } = await supabase.functions.invoke('generate-text-from-idea', {
        body: {
          businessId: weeklyContentPlan?.businessId || businessData.business?.id,
          suggestion,
          platforms: selectedPlatforms.length > 0 ? selectedPlatforms : ['instagram', 'facebook'],
          tier: currentTier,
        }
      })

      if (error) throw error

      // Merge platform-specific hashtags into unified PlatformHashtag structure
      const allHashtags = new Map<string, { tag: string; platforms: string[] }>()
      ;(data.facebook?.hashtags || []).forEach((tag: string) => {
        const normalized = tag.replace(/^#/, '')
        if (!allHashtags.has(normalized)) allHashtags.set(normalized, { tag: normalized, platforms: [] })
        allHashtags.get(normalized)!.platforms.push('facebook')
      })
      ;(data.instagram?.hashtags || []).forEach((tag: string) => {
        const normalized = tag.replace(/^#/, '')
        if (!allHashtags.has(normalized)) allHashtags.set(normalized, { tag: normalized, platforms: [] })
        if (!allHashtags.get(normalized)!.platforms.includes('instagram')) {
          allHashtags.get(normalized)!.platforms.push('instagram')
        }
      })
      const hashtagArray = Array.from(allHashtags.values()).map(({ tag, platforms }) => ({
        tag: `#${tag}`,
        enabled: true,
        platforms,
      }))

      const sharedText = data.sharedText || data.facebook?.text || ''

      const transferredContent = {
        headline: plan.contentSubject.dish,
        text: sharedText,
        hashtags: hashtagArray,
        adjustments: {
          length: 'current',
          tone: 'brand',
          includeHashtags: hashtagArray.length > 0,
          includeEmojis: true,
          includeBookingLink: false
        },
        platformSpecific: false,
        platformContent: {
          facebook: {
            headline: plan.contentSubject.dish,
            text: data.facebook?.text || sharedText,
            hashtags: hashtagArray.filter(h => h.platforms?.includes('facebook')),
            adjustments: { length: 'current', tone: 'brand', includeHashtags: true, includeEmojis: true, includeBookingLink: false }
          },
          instagram: {
            headline: '',
            text: data.instagram?.text || sharedText,
            hashtags: hashtagArray.filter(h => h.platforms?.includes('instagram')),
            adjustments: { length: 'current', tone: 'brand', includeHashtags: true, includeEmojis: true, includeBookingLink: false }
          }
        },
        aiGeneratedHashtags: hashtagArray.map((h: { tag: string }) => h.tag.replace(/^#/, ''))
      } as const

      // Guard: user may have switched paths while generation was in flight
      if (usePostCreationStore.getState().activePath !== 'weekly-plan') return
      setPostContent(transferredContent)
      setPostCta(data.facebook?.cta || null)
      setDraftMapEntry(index, transferredContent)
    } catch (err) {
      console.error('[handleDirectTransfer] Text generation failed:', err)
      // Guard: user may have switched paths while generation was in flight
      if (usePostCreationStore.getState().activePath !== 'weekly-plan') return
      // Stay on Generate step — user can retry via "Brug dette opslag →"
      alert('Tekstgenerering fejlede. Prøv igen.')
      return
    } finally {
      setIsGenerating(false)
    }

    // Guard: user may have switched paths while generation was in flight
    if (usePostCreationStore.getState().activePath !== 'weekly-plan') return

    // Set photo idea from visual direction
    if (plan.visualDirection) {
      const briefParts = [
        plan.visualDirection.subject,
        plan.visualDirection.angle,
        plan.visualDirection.setting
      ].filter(Boolean)
      setPhotoIdea(briefParts.join(' — '))
    }

    // Mark this plan post as done in the session
    if (weeklyContentPlan) {
      addWeeklyPlanSessionDone(index)
    }

    setCurrentStep('create')
  }

  const handleBackToPlan = () => {
    navigate('/dashboard/content/ai-weekly-plan')
  }

  // Switch to a different idea from the Design-step tab strip.
  // Saves current text to draftMap, loads the new idea (from draftMap or fresh transfer).
  const handleSwitchToIdea = (newIndex: number) => {
    if (!weeklyContentPlan || newIndex === weeklyPlanPostIndex) return
    const newPost = weeklyContentPlan.posts[newIndex]
    if (!newPost) return

    // Persist current edits before leaving
    if (postContent) {
      setDraftMapEntry(weeklyPlanPostIndex, postContent)
    }

    const newStrategicIdea = {
      title: newPost.contentSubject.dish,
      rationale: newPost.selectionRationale || newPost.postType.category,
      contentType: newPost.postType.type,
      suggestedDay: newPost.timing.day,
      ctaIntent: newPost.caption.ctaType,
      platformFormat: newPost.platformFormat?.format,
      suggestedMedia: newPost.visualDirection ? {
        type: newPost.platformFormat?.format || 'photo',
        direction: newPost.visualDirection.subject,
        why: newPost.visualDirection.angle,
      } : undefined,
    }

    setWeeklyPlanPost(newPost)
    setStrategicIdea(newStrategicIdea)
    setWeeklyPlanPostIndex(newIndex)

    const savedContent = draftMap[newIndex]
    if (savedContent) {
      // Restore previously saved draft — instant, no transfer needed.
      // Also populate weeklyPlanSuggestion so the photo suggestion stays
      // visible in the design stage when switching between ideas.
      setWeeklyPlanSuggestion(buildWeeklyPlanSuggestion(newPost, newIndex))
      if (newPost.visualDirection) {
        const briefParts = [
          newPost.visualDirection.subject,
          newPost.visualDirection.angle,
          newPost.visualDirection.setting,
        ].filter(Boolean)
        setPhotoIdea(briefParts.join(' — '))
      }
      setPostContent(savedContent)
      setCurrentStep('create')
    } else {
      // No draft yet — run the direct transfer inline (avoids useEffect race condition)
      handleDirectTransfer(newPost, newIndex)
    }
  }

  // PlanContextStrip navigation — delegates to handleSwitchToIdea so draftMap is always respected
  const handleSwitchPlanPost = (rawIndex: number) => handleSwitchToIdea(rawIndex)

  // Exit Weekly Plan flow entirely — go to Skriv Selv with clean state
  const handleNewPost = () => {
    clearWeeklyPlanSession()
    setWeeklyPlanStep('generate')
  }

  const handleCreateBack = () => {
    setCurrentStep('generate')
  }

  const handlePublishNext = () => {
    // Handle final publication or redirect
    console.log('Post published!')
  }

  const handlePublishBack = () => {
    setCurrentStep('create')
  }

  const handleStepClick = (step: number) => {
    const steps = ['generate', 'create', 'publish'] as const
    setCurrentStep(steps[step - 1])
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 py-3 px-3 min-h-full">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* Plan Context Strip — shown only on the weekly-plan path, Generate step only */}
        {activePath === 'weekly-plan' && weeklyContentPlan && currentStep === 'generate' && (
          <PlanContextStrip
            plan={weeklyContentPlan}
            currentIndex={weeklyPlanPostIndex}
            sessionDoneIndices={weeklyPlanSessionDone}
            onBack={handleBackToPlan}
            onSwitchPost={handleSwitchPlanPost}
            onNewPost={handleNewPost}
          />
        )}
        
        {/* 3-Stage Progress Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            {/* Stage 1: Write - Clickable */}
            <button
              onClick={() => handleStepClick(1)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg flex-1 border-2 transition-all cursor-pointer ${
                currentStep === 'generate' 
                  ? 'bg-cta-surface border-cta' 
                  : 'bg-green-50 border-green-500 hover:border-green-600'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                currentStep === 'generate' 
                  ? 'bg-cta' 
                  : 'bg-green-500'
              }`}>
                {currentStep === 'generate' ? '1' : '✓'}
              </div>
              <div className="flex-1 text-left">
                <div className={`text-sm font-semibold ${
                  currentStep === 'generate' ? 'text-brand' : 'text-green-900'
                }`}>{activePath === 'weekly-plan' ? t('steps.weeklyPlan') : activePath === 'ai-ideas' ? t('steps.aiIdeas') : t('steps.writeSelf')}</div>
                <div className={`text-xs ${
                  currentStep === 'generate' ? 'text-cta-text' : 'text-green-700'
                }`}>
                  {currentStep === 'generate' ? (activePath === 'weekly-plan' ? t('steps.editText') : t('steps.writeText')) : t('steps.textReady')}
                </div>
              </div>
            </button>

            <div className="text-gray-300">→</div>

            {/* Stage 2: Design - Clickable */}
            <button
              onClick={() => handleStepClick(2)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg flex-1 border-2 transition-all cursor-pointer ${
                currentStep === 'create' 
                  ? 'bg-cta-surface border-cta' 
                  : currentStep === 'publish'
                    ? 'bg-green-50 border-green-500 hover:border-green-600'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                currentStep === 'create' 
                  ? 'bg-cta' 
                  : currentStep === 'publish'
                    ? 'bg-green-500'
                    : 'bg-gray-300'
              }`}>
                {currentStep === 'publish' ? '✓' : '2'}
              </div>
              <div className="flex-1 text-left">
                <div className={`text-sm font-semibold ${
                  currentStep === 'create' ? 'text-brand' : 
                  currentStep === 'publish' ? 'text-green-900' : 
                  'text-gray-500'
                }`}>Design</div>
                <div className={`text-xs ${
                  currentStep === 'create' ? 'text-cta-text' : 
                  currentStep === 'publish' ? 'text-green-700' : 
                  'text-gray-400'
                }`}>
                  {currentStep === 'create' ? t('steps.choosePhoto') : 
                   currentStep === 'publish' ? t('steps.photoReady') : 
                   t('steps.pending')}
                </div>
              </div>
            </button>

            <div className="text-gray-300">→</div>

            {/* Stage 3: Publish - Clickable */}
            <button
              onClick={() => handleStepClick(3)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg flex-1 border-2 transition-all cursor-pointer ${
                currentStep === 'publish' 
                  ? 'bg-cta-surface border-cta' 
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                currentStep === 'publish' ? 'bg-cta' : 'bg-gray-300'
              }`}>
                3
              </div>
              <div className="flex-1 text-left">
                <div className={`text-sm font-semibold ${
                  currentStep === 'publish' ? 'text-brand' : 'text-gray-500'
                }`}>Publish</div>
                <div className={`text-xs ${
                  currentStep === 'publish' ? 'text-cta-text' : 'text-gray-400'
                }`}>
                  {currentStep === 'publish' ? t('steps.schedule') : t('steps.pending')}
                </div>
              </div>
            </button>
          </div>
        </div>
        
        {/* Step-Specific Content */}
        <div className="transition-all duration-200 ease-in-out">
          <Suspense fallback={<StepLoader />}>
            {currentStep === 'generate' && (
              <div key="generate" className="relative">
                <GenerateStep 
                  onNext={handleGenerateNext}
                  onDirectTransfer={handleDirectTransfer}
                  markAsChanged={markAsChanged}
                  markAsSaved={markAsSaved}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              </div>
            )}
            
            {currentStep === 'create' && (
              <div key="create" className="relative">
                <CreateStep 
                  onNext={handleCreateNext}
                  onBack={handleCreateBack}
                  onStepClick={handleStepClick}
                  markAsChanged={markAsChanged}
                  markAsSaved={markAsSaved}
                  hasUnsavedChanges={hasUnsavedChanges}
                  suggestionId={selectedSuggestionData?.id}
                  onSwitchIdea={activePath === 'weekly-plan' && weeklyContentPlan ? handleSwitchToIdea : undefined}
                />
              </div>
            )}
            
            {currentStep === 'publish' && (
              <div key="publish" className="relative">
                <PublishStep 
                  onNext={handlePublishNext}
                  onBack={handlePublishBack}
                  onStepClick={handleStepClick}
                  markAsSaved={markAsSaved}
                  hasUnsavedChanges={hasUnsavedChanges}
                />
              </div>
            )}
          </Suspense>
        </div>
      </div>
      
      {/* Loading Modal for AI Text Generation */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
            <div className="w-16 h-16 border-4 border-cta border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Genererer tekst med AI
            </h3>
            <p className="text-sm text-gray-600">
              Jeg skriver nu et opslag baseret på din idé...
            </p>
          </div>
        </div>
      )}
    </div>
  )
}