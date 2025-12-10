// ===========================================
// File: src/features/PostComposerAI/index.ts
// Why: Unified AI orchestrator that combines all AI features for post creation
// ===========================================
import type { Platform, Tone, Tier } from '../shared/types'
import { generateIdea } from '../idea'
import { generateEmojis } from '../emojis'
import { generateHashtags } from '../hashtags'
import { generateCtas } from '../cta'
import type { BusinessProfileAnalysis } from '../BusinessProfilerAI'

export interface PostComposerContext {
  // User input
  topic: string
  userText?: string // If user already started writing
  
  // Platform & preferences
  platforms: Platform[]
  primaryPlatform: Platform
  tone: Tone
  language: string
  tier: Tier
  
  // Enhanced context data
  businessProfile?: BusinessProfileAnalysis
  performanceData?: {
    topPerformingPosts: Array<{ text: string; engagement: number }>
    bestHashtags: string[]
    bestPostingTimes: string[]
    topEmojis: string[]
  }
  trendingData?: {
    hashtags: string[]
    topics: string[]
    emojis: string[]
  }
  
  // Content preferences
  includeEmojis: boolean
  includeHashtags: boolean
  includeCTA: boolean
  maxLength?: number
  
  // Tier-based constraints
  constraints?: {
    maxHashtags: number
    maxEmojis: number
    maxCtas: number
    canCustomizeTone: boolean
    canAccessTrends: boolean
    canUseBusinessProfile: boolean
  }
}

export interface PostComposition {
  // Core content
  headline: string
  text: string
  
  // AI suggestions (user can toggle on/off)
  suggestedEmojis: string[]
  appliedEmojis: string[]
  
  suggestedHashtags: Array<{ tag: string; relevance: number; trending?: boolean }>
  appliedHashtags: string[]
  
  suggestedCTAs: string[]
  appliedCTA?: string
  
  // Metadata
  confidence: number // 0-1 how confident AI is about this composition
  suggestions: {
    tone: string[]
    improvements: string[]
    platformOptimizations: Record<Platform, { changes: string[]; reasoning: string }>
  }
  
  // Performance prediction (for paid tiers)
  estimatedEngagement?: {
    likes: number
    comments: number
    shares: number
    confidence: number
  }
}

class PostComposerAI {
  private tier: Tier
  
  constructor(tier: Tier) {
    this.tier = tier
  }
  
  /**
   * Main composition function - orchestrates all AI features
   */
  async composePost(context: PostComposerContext): Promise<PostComposition> {
    try {
      // Step 1: Generate base idea/text if needed
      let baseText = context.userText
      let headline = ''
      
      if (!baseText || baseText.trim().length < 10) {
        const ideaResult = await generateIdea({
          platform: context.primaryPlatform,
          tone: context.tone,
          language: context.language,
          draftCaption: context.topic,
          brand: this.extractBrandContext(context.businessProfile),
          tier: context.tier
        })
        
        baseText = ideaResult.text
        headline = ideaResult.headline
      }
      
      // Step 2: Generate suggestions in parallel (performance optimization)
      const [emojisResult, hashtagsResult, ctasResult] = await Promise.all([
        this.generateEmojiSuggestions(baseText, context),
        this.generateHashtagSuggestions(baseText, context),
        this.generateCTASuggestions(baseText, context)
      ])
      
      // Step 3: Apply user preferences and tier limitations
      const composition = this.compileComposition({
        headline,
        baseText,
        emojis: emojisResult,
        hashtags: hashtagsResult,
        ctas: ctasResult,
        context
      })
      
      // Step 4: Add performance prediction for paid tiers
      if (this.tier !== 'free' && context.performanceData) {
        composition.estimatedEngagement = await this.predictEngagement(composition, context)
      }
      
      return composition
      
    } catch (error) {
      console.error('Post composition failed:', error)
      // Graceful fallback
      return this.createFallbackComposition(context)
    }
  }
  
  /**
   * Generate emoji suggestions with smart context awareness
   */
  private async generateEmojiSuggestions(
    text: string, 
    context: PostComposerContext
  ): Promise<string[]> {
    const baseEmojis = await generateEmojis({
      platform: context.primaryPlatform,
      tone: context.tone,
      language: context.language,
      draftCaption: text,
      constraints: { maxEmojis: context.constraints?.maxEmojis || 4 }
    })
    
    // Enhanced logic for paid tiers
    if (this.tier !== 'free') {
      // Add trending emojis if available
      if (context.trendingData?.emojis) {
        const trendingEmojis = context.trendingData.emojis.slice(0, 2)
        baseEmojis.unshift(...trendingEmojis)
      }
      
      // Add business-specific emojis
      if (context.businessProfile?.businessType) {
        const categoryEmojis = this.getCategoryEmojis(context.businessProfile.businessType)
        baseEmojis.push(...categoryEmojis.slice(0, 2))
      }
    }
    
    // Remove duplicates and limit
    return Array.from(new Set(baseEmojis)).slice(0, context.constraints?.maxEmojis || 8)
  }
  
  /**
   * Generate hashtag suggestions with performance data integration
   */
  private async generateHashtagSuggestions(
    text: string,
    context: PostComposerContext
  ): Promise<Array<{ tag: string; relevance: number; trending?: boolean }>> {
    const baseHashtags = await generateHashtags({
      platform: context.primaryPlatform,
      tone: context.tone,
      language: context.language,
      draftCaption: text,
      constraints: { maxHashtags: context.constraints?.maxHashtags || 10 }
    })
    
    let enrichedHashtags = baseHashtags.map(tag => ({ 
      tag, 
      relevance: 0.5,
      trending: false 
    }))
    
    // Enhanced for paid tiers
    if (this.tier !== 'free') {
      // Boost hashtags that performed well historically
      if (context.performanceData?.bestHashtags) {
        enrichedHashtags = enrichedHashtags.map(h => ({
          ...h,
          relevance: context.performanceData!.bestHashtags.includes(h.tag) ? 0.9 : h.relevance
        }))
      }
      
      // Add trending hashtags
      if (context.trendingData?.hashtags) {
        const trendingTags = context.trendingData.hashtags
          .slice(0, 3)
          .map(tag => ({ tag, relevance: 0.8, trending: true }))
        enrichedHashtags.push(...trendingTags)
      }
    }
    
    // Sort by relevance and remove duplicates
    return enrichedHashtags
      .filter((h, i, arr) => arr.findIndex(x => x.tag === h.tag) === i)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, context.constraints?.maxHashtags || 15)
  }
  
  /**
   * Generate CTA suggestions based on business profile and performance
   */
  private async generateCTASuggestions(
    text: string,
    context: PostComposerContext
  ): Promise<string[]> {
    const baseCTAs = await generateCtas({
      platform: context.primaryPlatform,
      tone: context.tone,
      language: context.language,
      draftCaption: text,
      brand: this.extractBrandContext(context.businessProfile),
      constraints: { maxCtas: context.constraints?.maxCtas || 3 }
    })
    
    // Enhanced CTAs for businesses with profiles
    if (context.businessProfile?.url) {
      baseCTAs.unshift(`Visit our website`)
    }
    
    if (context.businessProfile?.contact?.phone) {
      baseCTAs.push(`Call ${context.businessProfile.contact.phone}`)
    }
    
    return Array.from(new Set(baseCTAs)).slice(0, context.constraints?.maxCtas || 5)
  }
  
  /**
   * Compile final composition with applied preferences
   */
  private compileComposition(params: {
    headline: string
    baseText: string
    emojis: string[]
    hashtags: Array<{ tag: string; relevance: number; trending?: boolean }>
    ctas: string[]
    context: PostComposerContext
  }): PostComposition {
    const { headline, baseText, emojis, hashtags, ctas, context } = params
    
    // Apply emojis based on user preference
    let finalText = baseText
    let appliedEmojis: string[] = []
    
    if (context.includeEmojis) {
      // Smart emoji insertion (not just appending)
      const selectedEmojis = emojis.slice(0, 3)
      appliedEmojis = selectedEmojis
      finalText = this.insertEmojisIntelligently(baseText, selectedEmojis)
    }
    
    // Apply hashtags
    let appliedHashtags: string[] = []
    if (context.includeHashtags) {
      appliedHashtags = hashtags.slice(0, context.platforms.includes('instagram') ? 10 : 3).map(h => h.tag)
    }
    
    // Apply CTA
    let appliedCTA: string | undefined
    if (context.includeCTA && ctas.length > 0) {
      appliedCTA = ctas[0]
      finalText += `\n\n${appliedCTA}`
    }
    
    return {
      headline,
      text: finalText,
      suggestedEmojis: emojis,
      appliedEmojis,
      suggestedHashtags: hashtags,
      appliedHashtags,
      suggestedCTAs: ctas,
      appliedCTA,
      confidence: this.calculateConfidence(context),
      suggestions: this.generateSuggestions(finalText, context)
    }
  }
  
  // Helper methods
  private extractBrandContext(profile?: BusinessProfileAnalysis) {
    if (!profile) return undefined
    
    return {
      brandName: profile.businessName,
      industry: profile.businessType,
      language: 'da' // Could be dynamic
    }
  }
  
  private getCategoryEmojis(category: string): string[] {
    const categoryEmojis: Record<string, string[]> = {
      'restaurant': ['🍽️', '👨‍🍳', '🍕', '🥘'],
      'cafe': ['☕', '🥐', '☕', '🍰'],
      'retail': ['🛍️', '👕', '💄', '👠'],
      'fitness': ['💪', '🏋️‍♀️', '🏃‍♂️', '🧘‍♀️'],
      'beauty': ['💄', '💅', '✨', '🌟']
    }
    
    return categoryEmojis[category.toLowerCase()] || ['✨', '🌟']
  }
  
  private insertEmojisIntelligently(text: string, emojis: string[]): string {
    if (emojis.length === 0) return text
    
    // Simple strategy: add one emoji at the beginning and append others
    const sentences = text.split('. ')
    if (sentences.length > 0) {
      sentences[0] = `${emojis[0]} ${sentences[0]}`
      
      // Add remaining emojis at the end
      if (emojis.length > 1) {
        const lastIndex = sentences.length - 1
        sentences[lastIndex] += ` ${emojis.slice(1).join(' ')}`
      }
    }
    
    return sentences.join('. ')
  }
  
  private calculateConfidence(context: PostComposerContext): number {
    let confidence = 0.5
    
    // More context = higher confidence
    if (context.businessProfile) confidence += 0.2
    if (context.performanceData) confidence += 0.2
    if (context.trendingData) confidence += 0.1
    
    return Math.min(confidence, 1.0)
  }
  
  private generateSuggestions(_text: string, _context: PostComposerContext) {
    return {
      tone: this.tier !== 'free' ? ['Try a more enthusiastic tone', 'Consider a professional approach'] : [],
      improvements: ['Consider adding a question to boost engagement', 'Include a clear call-to-action'],
      platformOptimizations: {
        instagram: {
          changes: ['Add more hashtags', 'Include story mention'],
          reasoning: 'Instagram favors content with 8-12 hashtags'
        },
        facebook: {
          changes: ['Add link preview', 'Consider longer format'],
          reasoning: 'Facebook rewards engaging, longer content'
        }
      } as Record<Platform, { changes: string[]; reasoning: string }>
    }
  }
  
  private async predictEngagement(_composition: PostComposition, context: PostComposerContext) {
    // Simplified engagement prediction based on historical data
    // In real implementation, this would use ML models
    
    if (!context.performanceData) {
      return {
        likes: 50,
        comments: 5,
        shares: 2,
        confidence: 0.3
      }
    }
    
    const avgEngagement = context.performanceData.topPerformingPosts
      .reduce((acc, post) => acc + post.engagement, 0) / context.performanceData.topPerformingPosts.length
    
    return {
      likes: Math.round(avgEngagement * 0.8),
      comments: Math.round(avgEngagement * 0.1),
      shares: Math.round(avgEngagement * 0.1),
      confidence: 0.7
    }
  }
  
  private createFallbackComposition(context: PostComposerContext): PostComposition {
    return {
      headline: context.topic,
      text: context.userText || `Here's a post about ${context.topic}`,
      suggestedEmojis: ['✨', '🎯'],
      appliedEmojis: context.includeEmojis ? ['✨'] : [],
      suggestedHashtags: [{ tag: '#marketing', relevance: 0.5 }],
      appliedHashtags: context.includeHashtags ? ['#marketing'] : [],
      suggestedCTAs: ['Learn more'],
      appliedCTA: context.includeCTA ? 'Learn more' : undefined,
      confidence: 0.3,
      suggestions: {
        tone: [],
        improvements: ['Please try again with a more specific topic'],
        platformOptimizations: {} as Record<Platform, { changes: string[]; reasoning: string }>
      }
    }
  }
}

// Factory function that respects tier limitations
export function createPostComposer(tier: Tier = 'free'): PostComposerAI {
  return new PostComposerAI(tier)
}

// Convenience function for direct usage in components
export async function composePost(context: PostComposerContext): Promise<PostComposition> {
  const composer = createPostComposer(context.tier)
  return composer.composePost(context)
}

export default PostComposerAI