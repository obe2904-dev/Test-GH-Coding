/**
 * 🤖 CENTRALIZED AI MODEL CONFIGURATION
 * 
 * Single source of truth for AI model selection across all features.
 * Models are chosen based on:
 * - Cost efficiency (Free tier)
 * - Task requirements (what works best for each feature)
 * - User tier value proposition
 */

export type UserTier = 'free' | 'standardplus' | 'premium'
export type AIFeature = 
  | 'ideaGeneration'
  | 'enhancement' 
  | 'spelling'
  | 'photoAnalysis'
  | 'documentAnalysis'
  | 'hashtags'

/**
 * AI Models per Feature and Tier
 * 
 * Free: gpt-4o-mini (cheapest, good enough for basic tasks)
 * Paid: Best model for the specific task
 */
export const AI_MODELS: Record<AIFeature, Record<UserTier, string>> = {
  // Post idea generation (creative writing)
  ideaGeneration: {
    free: 'gpt-4o-mini',       // Basic ideas, still creative
    standardplus: 'gpt-4o',    // Better storytelling
    premium: 'gpt-4o',         // Best creativity
  },
  
  // Content enhancement (quality critical for brand)
  enhancement: {
    free: 'gpt-4o-mini',       // Basic polish, fix typos
    standardplus: 'gpt-4o',    // Professional tone, engagement
    premium: 'gpt-4o',         // Publication-ready, persuasive
  },
  
  // Spelling & grammar check (accuracy critical)
  // Note: o1-mini is a reasoning model, excellent for complex grammar/context
  // but overkill and expensive for simple typo fixes
  spelling: {
    free: 'gpt-4o-mini',       // Catch obvious typos (fast & cheap)
    standardplus: 'gpt-4o',    // Better context understanding
    premium: 'gpt-4o',         // Best accuracy & context
  },
  
  // Photo analysis (vision task)
  // Uses Gemini 2.0 Flash (Google's vision model) - configured in Edge Function
  photoAnalysis: {
    free: 'gemini-2.0-flash-exp',      // Google Gemini (all tiers use same model)
    standardplus: 'gemini-2.0-flash-exp', // Analysis depth varies by tier
    premium: 'gemini-2.0-flash-exp',      // Most detailed analysis
  },
  
  // Website/PDF analysis (comprehension)
  documentAnalysis: {
    free: 'gpt-4o-mini',       // Extract key info
    standardplus: 'gpt-4o',    // Deep understanding
    premium: 'gpt-4o',         // Strategic insights
  },
  
  // Hashtag generation (specialized task)
  hashtags: {
    free: 'gpt-4o-mini',       // Basic relevant hashtags
    standardplus: 'gpt-4o',    // Strategic hashtag mix
    premium: 'gpt-4o',         // Optimized for reach
  },
} as const

/**
 * Get AI model for a specific feature and tier
 */
export function getAIModel(feature: AIFeature, tier: UserTier): string {
  return AI_MODELS[feature][tier]
}

/**
 * Get all models being used (for cost tracking)
 */
export function getAllModelsInUse(): Set<string> {
  const models = new Set<string>()
  
  for (const feature of Object.keys(AI_MODELS) as AIFeature[]) {
    for (const tier of Object.keys(AI_MODELS[feature]) as UserTier[]) {
      models.add(AI_MODELS[feature][tier])
    }
  }
  
  return models
}

/**
 * Backward compatibility: Get model for "general" AI tasks
 * Used by legacy code that doesn't specify feature
 */
export function getAIModelForTier(tier: UserTier): string {
  // Default to ideaGeneration model
  return AI_MODELS.ideaGeneration[tier]
}

/**
 * Get spelling check model (legacy compatibility)
 */
export function getSpellingCheckModel(tier: UserTier): string {
  return AI_MODELS.spelling[tier]
}
