import { Database } from '../types/database'
import { getAIModel, type UserTier } from '../config/features'

type Business = Database['public']['Tables']['businesses']['Row']
type BusinessProfile = Database['public']['Tables']['business_profile']['Row']
type BusinessLocation = Database['public']['Tables']['business_locations']['Row']
type WebsiteAnalysis = Database['public']['Tables']['website_analyses']['Row']

export interface BusinessContext {
  business: Business | null
  profile: BusinessProfile | null
  location: BusinessLocation | null
  websiteAnalysis: WebsiteAnalysis | null
}

export type AITier = UserTier

export interface AIPromptOptions {
  mode: 'custom' | 'ai'
  userTopic?: string // For custom ideas mode
  userTier: AITier
  language: string // 'da' or 'en'
  targetPlatforms?: string[] // Selected platforms from onboarding (facebook, instagram, etc.)
}

/**
 * Builds AI prompt for post idea generation based on available business context
 * Automatically uses the best available data (website analysis if available, otherwise basic info)
 */
export function buildPostIdeaPrompt(
  context: BusinessContext,
  options: AIPromptOptions
): string {
  const { business, profile, location, websiteAnalysis } = context
  const { mode, userTopic, userTier, language, targetPlatforms } = options

  // Check what data we have available
  const hasWebsiteData = websiteAnalysis?.raw_result !== null
  const hasBasicInfo = business !== null

  if (!hasBasicInfo) {
    throw new Error('Business information is required. Please complete your business profile.')
  }

  // Build context section based on available data
  let businessContextSection = ''
  
  if (hasWebsiteData && websiteAnalysis) {
    // Enhanced context from website analysis
    const analysisData = websiteAnalysis.raw_result as any
    businessContextSection = `
BUSINESS CONTEXT (From Website Analysis):
- Business Name: ${analysisData.businessName || business.name}
- Type: ${business.vertical}
- Location: ${location?.city || 'Not specified'}
- Description: ${analysisData.description || profile?.long_description || 'Not specified'}
- Target Audience: ${analysisData.targetAudience || profile?.target_audience || 'Not specified'}
- Website: ${business.website_url}
- Tone: ${analysisData.tone || 'Professional and friendly'}
${analysisData.keyOfferings ? `- Key Products/Services: ${analysisData.keyOfferings.join(', ')}` : ''}
${analysisData.uniqueSellingPoints ? `- Unique Selling Points: ${analysisData.uniqueSellingPoints.join(', ')}` : ''}
`
  } else {
    // Basic context from profile
    businessContextSection = `
BUSINESS CONTEXT (Basic Information):
- Business Name: ${business.name}
- Type: ${business.vertical}
- Location: ${location?.city || 'Not specified'}
${profile?.short_description ? `- Description: ${profile.short_description}` : ''}
${profile?.target_audience ? `- Target Audience: ${profile.target_audience}` : ''}
`
  }

  // Build mode-specific instructions
  let modeInstructions = ''
  
  if (mode === 'custom' && userTopic) {
    modeInstructions = `
TASK: Generate 3 social media post ideas about: "${userTopic}"

The ideas should be relevant to the business and the specific topic provided by the user.
Make the ideas actionable and ready to post with minimal editing.
`
  } else if (mode === 'ai') {
    modeInstructions = `
TASK: Generate 3 diverse social media post ideas for this business.

The ideas should:
1. Leverage the business's unique strengths and offerings
2. Be varied in type (e.g., promotional, educational, behind-the-scenes, customer-focused)
3. Be seasonally appropriate and timely
4. Drive engagement and reflect the business's authentic voice
`
  }

  // Build tier-specific instructions
  const tierInstructions = userTier === 'free' 
    ? '\nNote: Keep ideas concise and straightforward (free tier).'
    : '\nCreate sophisticated, detailed ideas with strategic insights.'

  // Language instructions
  const languageInstruction = language === 'da'
    ? 'IMPORTANT: Write all content in Danish. Use "du-form" (informal you).'
    : 'IMPORTANT: Write all content in English.'

  // Platform-specific hashtag instructions
  let hashtagInstructions = ''
  if (targetPlatforms && targetPlatforms.length > 0) {
    const platformList = targetPlatforms.join(', ')
    const hashtagCount = targetPlatforms.includes('instagram') 
      ? '8-12 hashtags' 
      : targetPlatforms.includes('facebook')
        ? '2-3 hashtags'
        : '3-5 hashtags'
    
    hashtagInstructions = `\n\nTARGET PLATFORMS: ${platformList}
Include ${hashtagCount} in the post text (appropriate for these platforms).`
  }

  // Final prompt structure
  return `
${languageInstruction}

${businessContextSection}

${modeInstructions}

${tierInstructions}${hashtagInstructions}

OUTPUT FORMAT:
Return exactly 3 post ideas as a JSON array with this structure:
[
  {
    "id": "idea-1",
    "title": "Brief title (3-5 words)",
    "headline": "Attention-grabbing headline with emoji",
    "text": "Full post text (50-150 words)",
    "photoSuggestion": "Description of ideal photo/visual"
  },
  {
    "id": "idea-2",
    "title": "...",
    "headline": "...",
    "text": "...",
    "photoSuggestion": "..."
  },
  {
    "id": "idea-3",
    "title": "...",
    "headline": "...",
    "text": "...",
    "photoSuggestion": "..."
  }
]

Guidelines:
- Headlines should be 5-10 words with 1-2 relevant emojis
- Post text should be engaging, authentic, and include a call-to-action
- Keep the business's voice and target audience in mind
- Make ideas immediately actionable
`.trim()
}

/**
 * Determines which AI model to use based on user tier
 * Now uses centralized configuration from /src/config/features.ts
 * 
 * @param tier - User's subscription tier
 * @param _mode - Legacy parameter, no longer used (kept for backward compatibility)
 */
export function getAIModelForTier(tier: AITier, _mode?: 'custom' | 'ai'): string {
  // Use centralized configuration - no longer varies by mode
  return getAIModel(tier)
}

/**
 * Checks if user can use AI Ideas mode (requires website analysis)
 */
export function canUseAIIdeasMode(hasWebsiteAnalysis: boolean): {
  allowed: boolean
  reason?: string
} {
  if (!hasWebsiteAnalysis) {
    return {
      allowed: false,
      reason: 'Please analyze your website in Business Profile first'
    }
  }
  
  return { allowed: true }
}

/**
 * Gets quota limits for free tier users
 */
export function getFreeTierLimits() {
  return {
    customIdeasPerWeek: 10,
    aiIdeasPerWeek: 3,
    ideasVisibleAtOnce: 3,
  }
}
