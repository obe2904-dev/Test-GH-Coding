// App-wide constants and configuration
export const APP_CONFIG = {
  name: 'Social Media Manager',
  version: '0.1.0',
  supportEmail: 'support@example.com'
} as const

// API endpoints (for future use)
export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    signup: '/auth/signup',
    logout: '/auth/logout'
  },
  posts: '/posts',
  analytics: '/analytics'
} as const

// Supported languages
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'da', name: 'Dansk', flag: '🇩🇰' }
] as const

// Supported countries (display name + language mapping)
export const SUPPORTED_COUNTRIES = [
  { code: 'DK', name: 'Danmark', language: 'da', flag: '🇩🇰' },
  { code: 'SE', name: 'Sverige', language: 'sv', flag: '🇸🇪' },
  { code: 'GB', name: 'United Kingdom', language: 'en', flag: '🇬🇧' }
] as const

// Social media platforms
export const SOCIAL_PLATFORMS = {
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
  LINKEDIN: 'linkedin',
  TWITTER: 'twitter'
} as const

// Default settings
export const DEFAULTS = {
  postsPerPage: 10,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  supportedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
  supportedVideoTypes: ['video/mp4', 'video/webm']
} as const

// Validation rules
export const VALIDATION = {
  password: {
    minLength: 6,
    maxLength: 128
  },
  email: {
    maxLength: 254
  },
  post: {
    maxLength: 2200, // Twitter limit
    minLength: 1
  }
} as const