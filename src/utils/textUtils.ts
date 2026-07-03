/**
 * Text Utilities
 * 
 * Shared utility functions for text manipulation across post creation components.
 * Handles hashtags, emojis, CTAs, and text cleaning operations.
 */

/**
 * Strip emojis from text
 * Removes all Unicode emoji characters
 */
export function stripEmojis(text: string): string {
  return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim()
}

/**
 * Extract hashtags from text
 * Only extracts complete hashtags after word boundaries
 * Supports Danish characters (æ, ø, å)
 * 
 * @returns Array of hashtag strings (without the # prefix)
 */
export function extractHashtags(text: string): string[] {
  // Only extract hashtags that are complete words (preceded and followed by space/boundary)
  const matches = text.match(/(?:^|\s)(#[\wæøåÆØÅ]{3,30})(?=\s|$)/g)
  return matches ? matches.map(match => match.trim().slice(1)) : []
}

/**
 * Remove hashtags from text
 * Only removes complete hashtags after word boundaries
 * Cleans up extra whitespace
 */
export function removeHashtags(text: string): string {
  return text.replace(/(?:^|\s)(#[\wæøåÆØÅ]{3,30})(?=\s|$)/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Extract Call-to-Action (CTA) from text
 * Detects CTAs in the last 1-2 sentences based on:
 * - Action verbs (Danish + English)
 * - URLs or "link in bio"
 * - Contact info patterns
 * 
 * @returns The CTA text if found, empty string otherwise
 */
export function extractCTA(text: string): string {
  // Split into sentences
  const sentences = text.split(/(?<=[.!?])\s+/)
  if (sentences.length === 0) return ''
  
  // Check last 2 sentences for CTA patterns
  const lastTwo = sentences.slice(-2).join(' ')
  const lastOne = sentences[sentences.length - 1]
  
  // Patterns that indicate a CTA:
  // 1. Action verbs (Danish + English)
  // 2. URLs or "link in bio"
  // 3. Contact info patterns
  const ctaPattern = /kom|besøg|prøv|oplev|se|kik|følg|book|ring|kontakt|visit|try|check|click|call|shop|order|learn|discover|find|get|join|sign|start|link in bio|http|www\./i
  
  // Check if last sentence is a CTA
  if (ctaPattern.test(lastOne)) {
    return lastOne
  }
  
  // Check if last two sentences together form a CTA
  if (sentences.length > 1 && ctaPattern.test(lastTwo) && lastTwo.length < 100) {
    return sentences.slice(-2).join(' ')
  }
  
  return ''
}

/**
 * Remove CTA from text
 * Extracts and removes the CTA, cleaning up extra whitespace
 */
export function removeCTA(text: string): string {
  const cta = extractCTA(text)
  if (cta) {
    // Remove the CTA and clean up extra whitespace/newlines
    return text.replace(cta, '').replace(/\s+$/, '').trim()
  }
  return text
}

/**
 * Count words in text
 * Simple word counter for caption length estimation
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length
}

/**
 * Truncate text to a maximum length while preserving word boundaries
 * Adds ellipsis if truncated
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  
  const truncated = text.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  
  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace) + '...'
  }
  
  return truncated + '...'
}

/**
 * Clean text by removing extra whitespace and normalizing line breaks
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive line breaks to 2
    .trim()
}
