// Impact scorer - Heuristic engagement prediction
// Computes estimated impact based on measurable quality factors

import { PostIdea, ValidationResult, IdeaWithMetadata } from '../types.ts'

/**
 * Compute impact score based on idea quality factors
 * Returns: 'low' | 'medium' | 'high' + confidence + breakdown
 * 
 * Factors considered:
 * - Hook quality (5-10 words, emoji, question)
 * - Caption quality (80-150 chars optimal, specific)
 * - Novelty score (vs previous posts)
 * - Menu specificity (specific > generic)
 * - Validation status (clean > warnings > fallback)
 */
export interface ImpactScore {
  impact: 'low' | 'medium' | 'high'
  confidence: number  // 0-1, how confident we are in this estimate
  factors: {
    hook_quality: number      // 0-1
    caption_quality: number   // 0-1
    novelty: number           // 0-1
    specificity: number       // 0-1
    validation_clean: number  // 0-1
  }
}

export function computeImpactScore(
  ideaWithMetadata: IdeaWithMetadata,
  validationResult?: ValidationResult
): ImpactScore {
  const idea = ideaWithMetadata.idea
  const metadata = ideaWithMetadata.metadata
  
  // Factor 1: Hook Quality (0-1)
  const hookQuality = scoreHookQuality(idea.hook)
  
  // Factor 2: Caption Quality (0-1)
  const captionQuality = scoreCaptionQuality(idea.caption_base)
  
  // Factor 3: Novelty (0-1) - high if AI-generated and valid
  const novelty = metadata.source === 'ai' && metadata.validation_status === 'valid' ? 1.0
    : metadata.source === 'ai' ? 0.7  // AI but with warnings
    : 0.5  // Fallback template
  
  // Factor 4: Specificity (0-1) - menu items score higher
  const specificity = scoreSpecificity(idea)
  
  // Factor 5: Validation Clean (0-1)
  const validationClean = metadata.validation_status === 'valid' ? 1.0
    : metadata.validation_status === 'valid_with_warnings' ? 0.8
    : metadata.validation_status === 'auto_fixed' ? 0.6
    : 0.4  // Fallback
  
  // Weighted average
  const weights = {
    hook: 0.25,
    caption: 0.20,
    novelty: 0.25,
    specificity: 0.15,
    validation: 0.15
  }
  
  const totalScore = 
    hookQuality * weights.hook +
    captionQuality * weights.caption +
    novelty * weights.novelty +
    specificity * weights.specificity +
    validationClean * weights.validation
  
  // Map to impact categories
  let impact: 'low' | 'medium' | 'high'
  let confidence: number
  
  if (totalScore >= 0.75) {
    impact = 'high'
    confidence = totalScore
  } else if (totalScore >= 0.50) {
    impact = 'medium'
    confidence = totalScore
  } else {
    impact = 'low'
    confidence = totalScore
  }
  
  return {
    impact,
    confidence,
    factors: {
      hook_quality: hookQuality,
      caption_quality: captionQuality,
      novelty,
      specificity,
      validation_clean: validationClean
    }
  }
}

/**
 * Score hook quality (0-1)
 * Optimal: 5-10 words, 1-2 emojis, question mark
 */
function scoreHookQuality(hook: string): number {
  let score = 0.5  // Base score
  
  // Word count (optimal: 5-10)
  const words = hook.trim().split(/\s+/).length
  if (words >= 5 && words <= 10) {
    score += 0.2
  } else if (words >= 3 && words <= 12) {
    score += 0.1
  }
  
  // Emoji presence (1-2 is good)
  const emojiCount = (hook.match(/[\p{Emoji}]/gu) || []).length
  if (emojiCount >= 1 && emojiCount <= 2) {
    score += 0.15
  }
  
  // Question mark (engagement trigger)
  if (hook.includes('?')) {
    score += 0.15
  }
  
  return Math.min(score, 1.0)
}

/**
 * Score caption quality (0-1)
 * Optimal: 80-150 chars, specific details, no generic phrases
 */
function scoreCaptionQuality(caption: string): number {
  let score = 0.5  // Base score
  
  // Length (optimal: 80-150 chars for engagement)
  const length = caption.length
  if (length >= 80 && length <= 150) {
    score += 0.2
  } else if (length >= 50 && length <= 200) {
    score += 0.1
  }
  
  // Specificity markers (specific > generic)
  const specificMarkers = [
    /\b(økologisk|lokal|hjemmelavet|frisk|sæson)\b/i,  // Quality adjectives
    /\b(kl\. \d{2}:\d{2}|\d{2}:\d{2})\b/,  // Specific times
    /\b(i dag|i aften|i morgen)\b/i,  // Specific timeframes
    /\b(\d+ kr\.?|\d+,-)\b/,  // Prices
  ]
  
  const specificCount = specificMarkers.filter(marker => marker.test(caption)).length
  score += Math.min(specificCount * 0.1, 0.3)
  
  return Math.min(score, 1.0)
}

/**
 * Score idea specificity (0-1)
 * Menu items with specific names score higher than generic vibes
 */
function scoreSpecificity(idea: PostIdea): number {
  let score = 0.5  // Base score
  
  // Menu item presence
  if (idea.menu_item && idea.menu_item.name) {
    score += 0.3
    
    // Specific menu item name (not generic)
    const genericMenuTerms = ['mad', 'ret', 'menu', 'dagens', 'special']
    const isGeneric = genericMenuTerms.some(term => 
      idea.menu_item!.name.toLowerCase().includes(term)
    )
    
    if (!isGeneric) {
      score += 0.2  // Specific item like "Club Sandwich"
    }
  }
  
  // Photo suggestion detail
  if (idea.photo_suggestion && idea.photo_suggestion.length > 50) {
    score += 0.1  // Detailed photo instructions
  }
  
  return Math.min(score, 1.0)
}

/**
 * Enhance idea with computed impact (replaces AI guess)
 */
export function enhanceIdeaWithComputedImpact(
  ideaWithMetadata: IdeaWithMetadata,
  validationResult?: ValidationResult
): IdeaWithMetadata {
  const impactScore = computeImpactScore(ideaWithMetadata, validationResult)
  
  return {
    ...ideaWithMetadata,
    idea: {
      ...ideaWithMetadata.idea,
      impact: impactScore.impact  // Override AI guess with computed score
    },
    metadata: {
      ...ideaWithMetadata.metadata,
      impact_score: impactScore  // Include breakdown for transparency
    }
  }
}
