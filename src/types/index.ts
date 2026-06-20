// Shared TypeScript interfaces and types

// =====================================================
// DATABASE SCHEMA TYPES (Phase 1B)
// =====================================================

// Shared types
export * from './database/shared';

// Domain-specific types
export * from './database/location';
export * from './database/operations';
export * from './database/menu';
export * from './database/brand';
export * from './database/goals';
export * from './database/audience';
export * from './database/platform';

// Re-export main interfaces for convenience
export type {
  BusinessLocationIntelligence,
  CreateLocationIntelligence,
  UpdateLocationIntelligence,
} from './database/location';

export type {
  BusinessOperations,
  CreateBusinessOperations,
  UpdateBusinessOperations,
} from './database/operations';

// ⚠️ DROPPED TABLE — business_menu_metadata removed April 2026. Do NOT use in new code.
export type {
  BusinessMenuMetadata,
  CreateMenuMetadata,
  UpdateMenuMetadata,
} from './database/menu';

export type {
  BusinessVisualIdentity,
  CreateVisualIdentity,
  UpdateVisualIdentity,
} from './database/brand';

// ⚠️ DROPPED TABLE — business_goals removed April 2026. Do NOT use in new code.
export type {
  BusinessGoal,
  CreateBusinessGoal,
  UpdateBusinessGoal,
} from './database/goals';

// ⚠️ DROPPED TABLE — business_audience_profile removed April 2026. Do NOT use in new code.
export type {
  BusinessAudienceProfile,
  CreateAudienceProfile,
  UpdateAudienceProfile,
} from './database/audience';

export type {
  PlatformIntelligence,
} from './database/platform';

// Complete business knowledge aggregate type.
// LIVE TABLES ONLY — fields for dropped tables have been removed.
export interface BusinessKnowledge {
  business_id: string;
  location?: import('./database/location').BusinessLocationIntelligence;
  operations?: import('./database/operations').BusinessOperations;
  visual_identity?: import('./database/brand').BusinessVisualIdentity;
  // menu_metadata: REMOVED — business_menu_metadata table dropped April 2026
  // goals: REMOVED — business_goals table dropped April 2026
  // audience_profile: REMOVED — business_audience_profile table dropped April 2026
}

// =====================================================
// LEGACY TYPES (Keep for backward compatibility)
// =====================================================

export interface User {
  id: string
  email: string
  created_at: string
}

export interface Profile {
  id: string
  email: string
  business_type: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  user_id: string
  content: string
  media_urls: string[]
  scheduled_time: string | null
  published_time: string | null
  platforms: string[]
  is_evergreen: boolean
  repost_interval: number | null
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  created_at: string
  updated_at: string
}

export interface ConnectedAccount {
  id: string
  user_id: string
  platform: 'facebook' | 'instagram' | 'linkedin' | 'twitter'
  account_id: string
  account_name: string
  access_token: string // encrypted
  refresh_token?: string // encrypted
  expires_at?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Template {
  id: string
  category: string
  platform: string
  content_template: string
  preview_image_url?: string
  industry_tags: string[]
  created_at: string
}

export interface InboxMessage {
  id: string
  user_id: string
  account_id: string
  platform_message_id: string
  message_type: 'comment' | 'dm' | 'mention'
  sender_name: string
  sender_avatar?: string
  content: string
  sentiment_score: number // -1 to 1
  is_read: boolean
  replied_at?: string
  created_at: string
}

export interface Analytics {
  user_id: string
  account_id: string
  date: string
  reach: number
  impressions: number
  engagement_count: number
  link_clicks: number
  follower_count: number
}

// API Response types
export interface ApiResponse<T = any> {
  data: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Form types
export interface LoginForm {
  email: string
  password: string
}

export interface SignUpForm extends LoginForm {
  confirmPassword?: string
}

export interface PostForm {
  content: string
  platforms: string[]
  scheduled_time?: string
  media_files: File[]
}

// Error types
export interface ApiError {
  code: string
  message: string
  details?: any
}

// Language types
export interface Language {
  code: string
  name: string
  flag: string
}

// Component prop types
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}

export interface FormFieldProps extends BaseComponentProps {
  id: string
  label?: string
  error?: string
  required?: boolean
  disabled?: boolean
}

// Store types
export interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
}

export interface PostsState {
  posts: Post[]
  loading: boolean
  error: string | null
  fetchPosts: () => Promise<void>
  createPost: (post: Omit<Post, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updatePost: (id: string, updates: Partial<Post>) => Promise<void>
  deletePost: (id: string) => Promise<void>
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>