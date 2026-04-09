import { create } from 'zustand'
import type { PostSpecification, WeeklyContentPlan } from '../types/weekly-plan'

export interface GeneratedIdea {
  id: string
  title: string
  description: string
  headline: string
  text: string
  hashtags?: string // AI-generated hashtags (separate from text)
  bestTimeToPost?: string
  impact?: 'low' | 'medium' | 'high'
  menuItemUsed?: string
  // CTA object (separate from text for independent styling)
  _cta?: {
    text: string  // "Kom forbi" or "Book dit bord"
    type: 'soft' | 'booking' | 'menu' | 'custom'
    url?: string  // booking_url for Facebook, undefined for Instagram
  }
  // Content type mapped from idea_type (used by generate-text-from-idea)
  contentType?: string
  // Store raw idea and platform-specific formatted posts
  _rawIdea?: any
  _formattedPosts?: {
    facebook?: any
    instagram?: any
  }
}

export interface TextAdjustments {
  length: 'shorter' | 'current' | 'longer'
  tone: 'professional' | 'casual' | 'friendly' | 'excited' | 'brand'
  includeHashtags: boolean
  includeEmojis: boolean
  includeBookingLink: boolean
}

export interface PlatformHashtag {
  tag: string
  enabled: boolean
  platforms?: string[] // Optional for shared hashtags to show which platforms they apply to
}

export interface PlatformContent {
  headline: string
  text: string // Clean text without hashtags
  textWithHashtags?: string // Text with hashtags appended
  adjustments: TextAdjustments
  hashtags: PlatformHashtag[]
}

export interface PostContent {
  headline: string
  text: string // Clean text without hashtags appended
  textWithHashtags?: string // Text with selected hashtags appended (for Design step)
  adjustments: TextAdjustments
  platformSpecific?: boolean
  platformContent?: Record<string, PlatformContent>
  hashtags?: PlatformHashtag[]
  platformHashtagViews?: Record<string, PlatformHashtag[]>
  aiGeneratedHashtags?: string[] // Track which hashtags came from AI (without # prefix)
}

// Suggestion object built from PostSpecification and passed to generate-text-from-idea
// when the user clicks "Create Post" from the Weekly Plan.
export interface WeeklyPlanSuggestion {
  id: string               // used for deterministic CTA cycling
  title: string            // post subject (= opportunity.subject)
  captionBase?: string     // copy brief (menu: menuItemDescription; non-menu: empty — guestMoment carries the occasion)
  source: 'weekly_plan'
  contentType?: string     // 'menu_item' | 'atmosphere' | 'behind_scenes' | 'seasonal' | 'product_menu'
  menuItemName?: string    // DB item name (when menu post)
  menuItemDescription?: string  // DB item description (when menu post)
  rationale?: string       // Phase 2b strategic rationale — displayed in UI only, NOT passed to copy AI
  goalMode?: 'drive_footfall' | 'build_brand' | 'retain_loyalty'
  // Weekly Plan occasion/context fields — activate richer prompt in generate-text-from-idea
  guestMoment?: string          // occasion / guest angle (whyThisDish[0] for non-menu; selectionRationale for menu)
  timingDay?: string            // timing.day (e.g. "Fredag")
  timingTime?: string           // timing.time (e.g. "19:00")
  timingRationale?: string      // timing.rationale
  visualSubject?: string        // visualDirection.subject
  visualAngle?: string          // visualDirection.angle
  visualSetting?: string        // visualDirection.setting
  ctaIntent?: string            // caption.ctaType
  platformFormat?: string       // platformFormat.format (e.g. "Reel", "photo")
  selectionRationale?: string   // PostSpec.selectionRationale — why this post was chosen for this week
  captionFirstLine?: string     // caption.firstLine — soft opening line seed
  holidayContext?: string       // "[name] – [strategic_angle] – [marketing_hook]" when post day is a public holiday
}

export interface PhotoAdjustments {
  cropAndSize: {
    platform: 'facebook' | 'instagram' | 'both'
    focusMode: 'auto' | 'center' | 'face' | 'product'
    enabled: boolean
  }
  cleaning: {
    removeBackground: boolean
    removeObjects: boolean
    reduceBlemishes: boolean
    intensity: number
    enabled: boolean
  }
  colorGrading: {
    temperature: number
    preset: 'natural' | 'vibrant' | 'muted' | 'custom'
    enabled: boolean
  }
}

export interface ImageVariant {
  platform: string
  size: string
  width: number
  height: number
  url: string
  filename: string
}

export interface MediaItem {
  id: string
  file: File
  url: string
  type: 'image' | 'video'
  originalUrl?: string
  adjustedUrl?: string
  adjustedUrlHistory?: (string | null)[] // stack of pre-enhancement states; null = was showing original
  adjustments?: PhotoAdjustments
  isProcessing?: boolean
  selectedVersionForPost?: 'original' | 'adjusted'
  platformVariants?: ImageVariant[] // Platform-specific versions created by image processing
  duration?: number // Video duration in seconds
  canAnalyze?: boolean // Whether video is short enough for AI analysis (≤30s)
  analysisCache?: Record<string, unknown> // AI analysis results keyed by context (path:ideaId)
}

export interface PhotoContent {
  uploadedMedia: MediaItem[]
  selectedMedia: string | null
  isOriginal: boolean
  photoAdjustments: PhotoAdjustments | null
}

type ContentStep = 'generate' | 'create' | 'publish'
type ActivePath = 'write' | 'ai-ideas' | 'weekly-plan'

interface PostCreationState {
  // ── Active path routing (Skriv Selv / AI Forslag / AI Ugentlig Plan) ──
  activePath: ActivePath
  setActivePath: (path: ActivePath) => void

  // ── Per-path current step (persists across sidebar navigation) ──
  writeSelfStep: ContentStep
  setWriteSelfStep: (step: ContentStep) => void
  aiIdeerStep: ContentStep
  setAiIdeerStep: (step: ContentStep) => void
  weeklyPlanStep: ContentStep
  setWeeklyPlanStep: (step: ContentStep) => void

  // ── Per-path post content (each path has its own slot) ──
  writeSelfContent: PostContent | null
  setWriteSelfContent: (content: PostContent | null) => void
  aiIdeerContent: PostContent | null
  setAiIdeerContent: (content: PostContent | null) => void

  // ── Per-path photo idea (each path has its own slot) ──
  writeSelfPhotoIdea: string
  setWriteSelfPhotoIdea: (idea: string) => void
  aiIdeerPhotoIdea: string
  setAiIdeerPhotoIdea: (idea: string) => void
  // weeklyPlanPhotoIdea is the shared photoIdea field (written by handleDirectTransfer)

  // Platform selection
  selectedPlatforms: string[]
  setSelectedPlatforms: (platforms: string[]) => void

  // Ideas step
  ideas: GeneratedIdea[]
  aiIdeas: GeneratedIdea[]
  selectedIdea: string | null
  setIdeas: (ideas: GeneratedIdea[]) => void
  setAiIdeas: (ideas: GeneratedIdea[]) => void
  setSelectedIdea: (id: string | null) => void
  
  // Selected AI suggestion for text generation
  selectedSuggestionData: any | null
  setSelectedSuggestionData: (data: any | null) => void

  // CTA to append on publish (booking URL etc.) — set after text generation, cleared on path switch
  postCta: { text: string; type: string; url?: string } | null
  setPostCta: (cta: { text: string; type: string; url?: string } | null) => void

  // Text step (weekly plan path — other paths use writeSelfContent / aiIdeerContent)
  postContent: PostContent | null
  setPostContent: (content: PostContent | null) => void
  
  // Full PostSpecification from Weekly Plan (for direct transfer to Create step)
  weeklyPlanPost: PostSpecification | null
  setWeeklyPlanPost: (post: PostSpecification | null) => void

  // Suggestion payload for generate-text-from-idea (built from weeklyPlanPost on transfer)
  weeklyPlanSuggestion: WeeklyPlanSuggestion | null
  setWeeklyPlanSuggestion: (suggestion: WeeklyPlanSuggestion | null) => void

  // Weekly plan navigation context (Plan Context Strip)
  weeklyContentPlan: WeeklyContentPlan | null
  setWeeklyContentPlan: (plan: WeeklyContentPlan | null) => void
  weeklyPlanPostIndex: number
  setWeeklyPlanPostIndex: (index: number) => void
  // Indices of posts marked done in this session (NOT cleared on reset)
  weeklyPlanSessionDone: number[]
  addWeeklyPlanSessionDone: (index: number) => void
  clearWeeklyPlanSession: () => void

  // Per-idea draft cache for multi-idea Weekly Plan flow (NOT cleared on reset — survives idea switching)
  draftMap: Record<number, PostContent | null>
  setDraftMapEntry: (index: number, content: PostContent | null) => void
  clearDraftMap: () => void

  // Strategic idea context (for AI auto-fill from weekly strategy)
  strategicIdea: {
    title: string
    rationale: string
    contentType?: string
    suggestedDay?: string
    ctaIntent?: string
    platformFormat?: string
    suggestedMedia?: {
      type: string
      direction?: string
      why?: string
      photo_count?: number
    }
  } | null
  setStrategicIdea: (idea: {
    title: string
    rationale: string
    contentType?: string
    suggestedDay?: string
    ctaIntent?: string
    platformFormat?: string
    suggestedMedia?: {
      type: string
      direction?: string
      why?: string
      photo_count?: number
    }
  } | null) => void
  
  // Photo idea from AI
  photoIdea: string
  setPhotoIdea: (idea: string) => void

  // Photo step
  photoContent: PhotoContent | null
  setPhotoContent: (content: PhotoContent | null) => void

  // Reset store
  reset: () => void
}

export const usePostCreationStore = create<PostCreationState>((set) => ({
  // ── Active path routing ──
  activePath: 'write',
  // Switching path atomically updates postContent and photoIdea so CreateStep
  // never sees stale values from the previous path.
  setActivePath: (path) => set((state) => ({
    activePath: path,
    postContent:
      path === 'write' ? state.writeSelfContent
      : path === 'ai-ideas' ? state.aiIdeerContent
      : state.postContent,
    photoIdea:
      path === 'write' ? state.writeSelfPhotoIdea
      : path === 'ai-ideas' ? state.aiIdeerPhotoIdea
      : state.photoIdea, // weekly-plan: handleDirectTransfer sets it
    // Clear weekly-plan-specific fields when leaving the weekly-plan path
    ...(path !== 'weekly-plan' ? { weeklyPlanPost: null, strategicIdea: null, postCta: null } : {}),
  })),

  // ── Per-path steps ──
  writeSelfStep: 'generate',
  setWriteSelfStep: (step) => set({ writeSelfStep: step }),
  aiIdeerStep: 'generate',
  setAiIdeerStep: (step) => set({ aiIdeerStep: step }),
  weeklyPlanStep: 'generate',
  setWeeklyPlanStep: (step) => set({ weeklyPlanStep: step }),

  // ── Per-path content ──
  writeSelfContent: null,
  // Also mirror to postContent when this is the active path (atomic, no effect gap).
  setWriteSelfContent: (content) => set((state) => ({
    writeSelfContent: content,
    postContent: state.activePath === 'write' ? content : state.postContent,
  })),
  aiIdeerContent: null,
  setAiIdeerContent: (content) => set((state) => ({
    aiIdeerContent: content,
    postContent: state.activePath === 'ai-ideas' ? content : state.postContent,
  })),

  // ── Per-path photo idea ──
  writeSelfPhotoIdea: '',
  setWriteSelfPhotoIdea: (idea) => set((state) => ({
    writeSelfPhotoIdea: idea,
    photoIdea: state.activePath === 'write' ? idea : state.photoIdea,
  })),
  aiIdeerPhotoIdea: '',
  setAiIdeerPhotoIdea: (idea) => set((state) => ({
    aiIdeerPhotoIdea: idea,
    photoIdea: state.activePath === 'ai-ideas' ? idea : state.photoIdea,
  })),

  // Platform selection
  selectedPlatforms: [],
  setSelectedPlatforms: (platforms) => set({ selectedPlatforms: platforms }),

  // Ideas step
  ideas: [],
  aiIdeas: [],
  selectedIdea: null,
  setIdeas: (ideas) => set({ ideas }),
  setAiIdeas: (ideas) => set({ aiIdeas: ideas }),
  setSelectedIdea: (id) => set({ selectedIdea: id }),
  
  // Selected suggestion data
  selectedSuggestionData: null,
  setSelectedSuggestionData: (data) => set({ selectedSuggestionData: data }),

  postCta: null,
  setPostCta: (cta) => set({ postCta: cta }),

  // Text step (weekly plan path)
  postContent: null,
  setPostContent: (content) => set((state) => ({
    postContent: content,
    // Mirror to per-path slot so path switching restores correctly
    writeSelfContent: state.activePath === 'write' ? content : state.writeSelfContent,
    aiIdeerContent: state.activePath === 'ai-ideas' ? content : state.aiIdeerContent,
  })),
  
  // Weekly plan post (full spec)
  weeklyPlanPost: null,
  setWeeklyPlanPost: (post) => set({ weeklyPlanPost: post }),

  // Weekly plan suggestion (for generate-text-from-idea)
  weeklyPlanSuggestion: null,
  setWeeklyPlanSuggestion: (suggestion) => set({ weeklyPlanSuggestion: suggestion }),

  // Weekly plan navigation context
  weeklyContentPlan: null,
  setWeeklyContentPlan: (plan) => set((state) => {
    // When loading a plan, restore any previously saved post drafts from localStorage
    const restoredDraftMap: Record<number, any> = { ...state.draftMap }
    const planId = (plan as any)?.id
    const MAX_AGE = 7 * 24 * 60 * 60 * 1000
    if (planId && plan?.posts) {
      plan.posts.forEach((_: any, index: number) => {
        // Don't overwrite if we already have a draft for this index in memory
        if (restoredDraftMap[index]) return
        try {
          const raw = localStorage.getItem(`p2g_draft_plan_${planId}_${index}`)
          if (raw) {
            const entry = JSON.parse(raw)
            if (Date.now() - entry.savedAt <= MAX_AGE) {
              restoredDraftMap[index] = entry.data
            }
          }
        } catch { /* ignore */ }
      })
    }
    return { weeklyContentPlan: plan, draftMap: restoredDraftMap }
  }),
  weeklyPlanPostIndex: 0,
  setWeeklyPlanPostIndex: (index) => set({ weeklyPlanPostIndex: index }),
  weeklyPlanSessionDone: [],
  addWeeklyPlanSessionDone: (index) =>
    set((state) => ({
      weeklyPlanSessionDone: state.weeklyPlanSessionDone.includes(index)
        ? state.weeklyPlanSessionDone
        : [...state.weeklyPlanSessionDone, index],
    })),
  clearWeeklyPlanSession: () => set({ weeklyContentPlan: null, weeklyPlanPostIndex: 0, weeklyPlanSessionDone: [] }),

  // Per-idea draft cache (also persisted to localStorage keyed by planId)
  draftMap: {},
  setDraftMapEntry: (index, content) =>
    set((state) => {
      // Persist to localStorage so edits survive page refresh
      const planId = (state.weeklyContentPlan as any)?.id
      if (planId && content) {
        try {
          localStorage.setItem(
            `p2g_draft_plan_${planId}_${index}`,
            JSON.stringify({ data: content, savedAt: Date.now() })
          )
        } catch { /* quota exceeded — fail silently */ }
      }
      return { draftMap: { ...state.draftMap, [index]: content } }
    }),
  clearDraftMap: () => set({ draftMap: {} }),

  // Strategic idea
  strategicIdea: null,
  setStrategicIdea: (idea) => set({ strategicIdea: idea }),
  
  // Photo idea
  photoIdea: '',
  setPhotoIdea: (idea) => set({ photoIdea: idea }),

  // Photo step
  photoContent: null,
  setPhotoContent: (content) => set({ photoContent: content }),

  // Reset store (weeklyContentPlan + weeklyPlanSessionDone intentionally preserved for back/forth nav)
  reset: () => set({
    selectedPlatforms: [],
    ideas: [],
    aiIdeas: [],
    selectedIdea: null,
    selectedSuggestionData: null,
    postCta: null,
    postContent: null,
    writeSelfContent: null,
    aiIdeerContent: null,
    writeSelfPhotoIdea: '',
    aiIdeerPhotoIdea: '',
    writeSelfStep: 'generate',
    aiIdeerStep: 'generate',
    weeklyPlanStep: 'generate',
    weeklyPlanPost: null,
    weeklyPlanSuggestion: null,
    strategicIdea: null,
    photoIdea: '',
    photoContent: null
  })
}))