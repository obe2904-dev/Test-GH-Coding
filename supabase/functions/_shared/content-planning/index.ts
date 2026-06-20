// supabase/functions/_shared/content-planning/index.ts
// Central export for content planning utilities
// Phase 1: Deterministic business logic for Weekly Plan + Quick Suggestions

export {
  getMenuRotationQueue,
  getNextDishToPost,
  wasDishRecentlyPosted,
  type RotationQueueItem,
  type RotationQueueOptions
} from './menu-rotation-queue.ts'

export {
  detectServicePeriod,
  getDishesForServicePeriod,
  type ServicePeriod,
  type ServicePeriodResult,
  type ProgrammeConfig
} from './service-period-detector.ts'

export {
  analyzePostingPatterns,
  getWeekdayFrequency,
  shouldAvoidPattern,
  getRecommendedContentType,
  type PatternSummary,
  type PatternAnalysis
} from './pattern-tracker.ts'

export {
  loadMinimalBrandVoice,
  loadValidatedBrandVoice,
  validateBrandVoice,
  formatVoiceForPrompt,
  type MinimalBrandVoice
} from './brand-voice-loader.ts'
