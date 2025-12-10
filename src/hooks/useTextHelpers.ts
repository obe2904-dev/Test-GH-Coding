// Text manipulation utilities for post creation

export function useTextHelpers() {
  // Helper: Strip emojis from text
  const stripEmojis = (text: string) => {
    return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim()
  }

  // Helper: Extract hashtags from text (only complete hashtags after word boundary)
  const extractHashtags = (text: string): string[] => {
    const matches = text.match(/(?:^|\s)(#[\wæøåÆØÅ]{3,30})(?=\s|$)/g)
    return matches ? matches.map(match => match.trim().slice(1)) : []
  }

  // Helper: Remove hashtags from text (only complete hashtags after word boundary)
  const removeHashtags = (text: string): string => {
    return text.replace(/(?:^|\s)(#[\wæøåÆØÅ]{3,30})(?=\s|$)/g, '').replace(/\s+/g, ' ').trim()
  }

  // Helper: Extract CTA (improved detection - last 1-2 sentences with action words or links)
  const extractCTA = (text: string): string => {
    const sentences = text.split(/(?<=[.!?])\s+/)
    if (sentences.length === 0) return ''
    
    const lastTwo = sentences.slice(-2).join(' ')
    const lastOne = sentences[sentences.length - 1]
    
    const ctaPattern = /kom|besøg|prøv|oplev|se|kik|følg|book|ring|kontakt|visit|try|check|click|call|shop|order|learn|discover|find|get|join|sign|start|link in bio|http|www\./i
    
    if (ctaPattern.test(lastOne)) {
      return lastOne
    }
    
    if (sentences.length > 1 && ctaPattern.test(lastTwo) && lastTwo.length < 100) {
      return sentences.slice(-2).join(' ')
    }
    
    return ''
  }

  // Helper: Remove CTA from text
  const removeCTA = (text: string): string => {
    const cta = extractCTA(text)
    if (cta) {
      return text.replace(cta, '').replace(/\s+$/, '').trim()
    }
    return text
  }

  return {
    stripEmojis,
    extractHashtags,
    removeHashtags,
    extractCTA,
    removeCTA
  }
}
