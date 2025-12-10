import { create } from 'zustand'

export interface GeneratedIdea {
  id: string
  title: string
  description: string
  headline: string
  text: string
}

export interface TextAdjustments {
  length: 'shorter' | 'current' | 'longer'
  tone: 'professional' | 'casual' | 'friendly' | 'excited'
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
  adjustments?: PhotoAdjustments
  isProcessing?: boolean
  selectedVersionForPost?: 'original' | 'adjusted'
  platformVariants?: ImageVariant[] // Platform-specific versions created by image processing
}

export interface PhotoContent {
  uploadedMedia: MediaItem[]
  selectedMedia: string | null
  isOriginal: boolean
  photoAdjustments: PhotoAdjustments | null
}

interface PostCreationState {
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

  // Text step
  postContent: PostContent | null
  setPostContent: (content: PostContent) => void
  
  // Photo idea from AI
  photoIdea: string
  setPhotoIdea: (idea: string) => void

  // Photo step
  photoContent: PhotoContent | null
  setPhotoContent: (content: PhotoContent) => void

  // Reset store
  reset: () => void
}

export const usePostCreationStore = create<PostCreationState>((set) => ({
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

  // Text step
  postContent: null,
  setPostContent: (content) => set({ postContent: content }),
  
  // Photo idea
  photoIdea: '',
  setPhotoIdea: (idea) => set({ photoIdea: idea }),

  // Photo step
  photoContent: null,
  setPhotoContent: (content) => set({ photoContent: content }),

  // Reset store
  reset: () => set({
    selectedPlatforms: [],
    ideas: [],
    aiIdeas: [],
    selectedIdea: null,
    postContent: null,
    photoIdea: '',
    photoContent: null
  })
}))