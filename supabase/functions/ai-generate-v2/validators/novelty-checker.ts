/**
 * Novelty Checker - Prevents repetitive content by comparing post fingerprints
 * 
 * Instead of soft "previous post patterns", this computes hard fingerprints
 * and requires new ideas to differ on at least 2 dimensions.
 */

import { PostIdea, PreviousPost, PostFingerprint, BrandPolicy } from '../types.ts'

/**
 * Extract fingerprint from a PostIdea
 */
export function extractIdeaFingerprint(idea: PostIdea): PostFingerprint {
  return {
    theme: idea.idea_type,
    anchors: extractAnchorsFromText(idea.caption_base),
    menuItems: idea.menu_item ? [idea.menu_item.name] : [],
    ctaIntent: idea.cta_intent
  }
}

/**
 * Extract fingerprint from a previous post's text content
 * More heuristic since we only have the final text, not structured data
 */
export function extractPreviousPostFingerprint(
  post: PreviousPost,
  brandPolicy: BrandPolicy
): PostFingerprint {
  const content = post.content.toLowerCase()
  
  // Infer theme from content patterns
  const theme = inferThemeFromContent(content, brandPolicy)
  
  // Extract anchors (verified location/interior/experience phrases)
  const anchors = extractAnchorsFromText(post.content)
  
  // Extract menu items (match against offerings allowlist)
  const menuItems = extractMenuItemsFromText(content, brandPolicy)
  
  // Infer CTA intent from content patterns
  const ctaIntent = inferCtaIntentFromContent(content)
  
  return {
    theme,
    anchors,
    menuItems,
    ctaIntent
  }
}

/**
 * Check if a new idea is sufficiently novel compared to previous posts
 * 
 * @param idea - New idea to check
 * @param previousFingerprints - Fingerprints of recent posts
 * @param minDifferences - Minimum number of dimensions that must differ (default: 2)
 * @returns true if novel, false if too similar
 */
export function isNovel(
  idea: PostIdea,
  previousFingerprints: PostFingerprint[],
  minDifferences: number = 2
): { novel: boolean; reason?: string; similarTo?: number } {
  const newFingerprint = extractIdeaFingerprint(idea)
  
  for (let i = 0; i < previousFingerprints.length; i++) {
    const prevFingerprint = previousFingerprints[i]
    const differences = countDifferences(newFingerprint, prevFingerprint)
    
    if (differences < minDifferences) {
      return {
        novel: false,
        reason: `Too similar to previous post #${i + 1} (only ${differences} differences, need ${minDifferences})`,
        similarTo: i
      }
    }
  }
  
  return { novel: true }
}

/**
 * Count how many dimensions differ between two fingerprints
 * 
 * Dimensions:
 * 1. Theme (menu/vibe/occasion)
 * 2. Anchors (location/interior/experience phrases)
 * 3. Menu items
 * 4. CTA intent
 */
function countDifferences(fp1: PostFingerprint, fp2: PostFingerprint): number {
  let differences = 0
  
  // Dimension 1: Theme
  if (fp1.theme !== fp2.theme) {
    differences++
  }
  
  // Dimension 2: Anchors (check for overlap)
  const anchorsOverlap = hasArrayOverlap(fp1.anchors, fp2.anchors)
  if (!anchorsOverlap) {
    differences++
  }
  
  // Dimension 3: Menu items (check for overlap)
  const menuItemsOverlap = hasArrayOverlap(fp1.menuItems, fp2.menuItems)
  if (!menuItemsOverlap) {
    differences++
  }
  
  // Dimension 4: CTA intent
  if (fp1.ctaIntent !== fp2.ctaIntent) {
    differences++
  }
  
  return differences
}

/**
 * Check if two arrays have any overlapping elements
 */
function hasArrayOverlap(arr1: string[], arr2: string[]): boolean {
  if (arr1.length === 0 || arr2.length === 0) {
    return false  // No overlap if either is empty
  }
  
  const set1 = new Set(arr1.map(s => s.toLowerCase()))
  return arr2.some(item => set1.has(item.toLowerCase()))
}

/**
 * Extract anchor phrases from text
 * Looks for verified anchors from BrandPolicy in the text
 */
function extractAnchorsFromText(text: string): string[] {
  const anchors: string[] = []
  const lowerText = text.toLowerCase()
  
  // Common anchor patterns (location, interior, experience phrases)
  const anchorPatterns = [
    // Location patterns
    /ved (åen|stranden|havnen|søen|kanalen)/gi,
    /(i hjertet af|midt i|tæt på) \w+/gi,
    /\d+ min\.? fra \w+/gi,
    
    // Interior patterns
    /hyggelig(t)? (atmosfære|stemning|miljø)/gi,
    /moderne (indretning|design|lokaler)/gi,
    /autentisk(t)? (miljø|stemning|atmosfære)/gi,
    
    // Experience patterns
    /perfekt til (brunch|dating|familier|grupper)/gi,
    /familievenlig(t)?/gi,
    /romantisk(t)? (stemning|atmosfære)/gi
  ]
  
  for (const pattern of anchorPatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      anchors.push(match[0].toLowerCase())
    }
  }
  
  return [...new Set(anchors)]  // Deduplicate
}

/**
 * Extract menu item names from text content
 */
function extractMenuItemsFromText(text: string, brandPolicy: BrandPolicy): string[] {
  const menuItems: string[] = []
  
  // Check for offerings allowlist items in text
  for (const offering of brandPolicy.offerings_allowlist) {
    if (text.includes(offering.toLowerCase())) {
      menuItems.push(offering)
    }
  }
  
  return [...new Set(menuItems)]  // Deduplicate
}

/**
 * Infer theme (menu/vibe/occasion) from content
 */
function inferThemeFromContent(content: string, brandPolicy: BrandPolicy): 'menu' | 'vibe' | 'occasion' {
  // Menu theme: mentions specific offerings or menu items
  const hasMenuItems = brandPolicy.offerings_allowlist.some(item => 
    content.includes(item.toLowerCase())
  )
  
  // Vibe theme: emphasizes atmosphere, location, interior
  const vibeKeywords = ['atmosfære', 'stemning', 'hyggelig', 'cozy', 'ambiance', 'lokaler', 'indretning']
  const hasVibeKeywords = vibeKeywords.some(kw => content.includes(kw))
  
  // Occasion theme: mentions situations, times, events
  const occasionKeywords = ['perfekt til', 'ideal til', 'planlagt', 'aften', 'morgen', 'weekend', 'anledning']
  const hasOccasionKeywords = occasionKeywords.some(kw => content.includes(kw))
  
  // Prioritize menu if present (most specific)
  if (hasMenuItems && !hasVibeKeywords) {
    return 'menu'
  }
  
  // Then vibe
  if (hasVibeKeywords && !hasOccasionKeywords) {
    return 'vibe'
  }
  
  // Then occasion
  if (hasOccasionKeywords) {
    return 'occasion'
  }
  
  // Default: vibe (safest general theme)
  return 'vibe'
}

/**
 * Infer CTA intent from content
 */
function inferCtaIntentFromContent(content: string): 'book' | 'menu' | 'visit' | 'engage' {
  // Book: explicit booking language
  if (/book|reserv|bestil/i.test(content)) {
    return 'book'
  }
  
  // Menu: menu focus
  if (/menu|se vores|tjek|kig på/i.test(content)) {
    return 'menu'
  }
  
  // Visit: come in, visit
  if (/kom (forbi|ind)|besøg|visit/i.test(content)) {
    return 'visit'
  }
  
  // Engage: comments, share, tell us
  if (/fortæl|del|kommenter|share|tag|meld/i.test(content)) {
    return 'engage'
  }
  
  // Default: visit (most common)
  return 'visit'
}

/**
 * Batch extract fingerprints from previous posts
 */
export function extractPreviousPostsFingerprints(
  posts: PreviousPost[],
  brandPolicy: BrandPolicy
): PostFingerprint[] {
  return posts.map(post => extractPreviousPostFingerprint(post, brandPolicy))
}

/**
 * Get detailed novelty report for debugging
 */
export interface NoveltyReport {
  idea: PostIdea
  fingerprint: PostFingerprint
  isNovel: boolean
  reason?: string
  comparisonDetails: {
    previousPostIndex: number
    differences: number
    dimensions: {
      theme: { same: boolean; new: string; old: string }
      anchors: { overlap: boolean; new: string[]; old: string[] }
      menuItems: { overlap: boolean; new: string[]; old: string[] }
      ctaIntent: { same: boolean; new: string; old: string }
    }
  }[]
}

export function getNoveltyReport(
  idea: PostIdea,
  previousFingerprints: PostFingerprint[]
): NoveltyReport {
  const newFingerprint = extractIdeaFingerprint(idea)
  const comparisonDetails = []
  
  for (let i = 0; i < previousFingerprints.length; i++) {
    const prevFingerprint = previousFingerprints[i]
    
    comparisonDetails.push({
      previousPostIndex: i,
      differences: countDifferences(newFingerprint, prevFingerprint),
      dimensions: {
        theme: {
          same: newFingerprint.theme === prevFingerprint.theme,
          new: newFingerprint.theme,
          old: prevFingerprint.theme
        },
        anchors: {
          overlap: hasArrayOverlap(newFingerprint.anchors, prevFingerprint.anchors),
          new: newFingerprint.anchors,
          old: prevFingerprint.anchors
        },
        menuItems: {
          overlap: hasArrayOverlap(newFingerprint.menuItems, prevFingerprint.menuItems),
          new: newFingerprint.menuItems,
          old: prevFingerprint.menuItems
        },
        ctaIntent: {
          same: newFingerprint.ctaIntent === prevFingerprint.ctaIntent,
          new: newFingerprint.ctaIntent,
          old: prevFingerprint.ctaIntent
        }
      }
    })
  }
  
  const noveltyCheck = isNovel(idea, previousFingerprints)
  
  return {
    idea,
    fingerprint: newFingerprint,
    isNovel: noveltyCheck.novel,
    reason: noveltyCheck.reason,
    comparisonDetails
  }
}
