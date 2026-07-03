/**
 * Website Presence Detection Utility
 * 
 * Phase 1, Task A: Fix website presence detection (v4.9.0)
 * 
 * Provides accurate detection of website data availability with detailed logging.
 * Resolves issue where hasWebsite=false even when websiteAnalysis contains data.
 */

import type { DataSources } from './types.ts'

export interface WebsitePresence {
  hasWebsiteAnalysis: boolean
  hasWebsite: boolean
  hasContent: boolean
  hasRawText: boolean
  contentLength: number
  triggers: string[]  // Which fields triggered detection
  debugInfo: {
    source_url?: string
    raw_html_length?: number
    homepage_content_length?: number
    about_content_length?: number
    headers_count?: number
    hero_texts_count?: number
    cta_texts_count?: number
    nav_items_count?: number
    keywords_count?: number
  }
}

/**
 * Detects website presence with multiple fallback checks.
 * 
 * Logic:
 * - hasWebsiteAnalysis: websiteAnalysis row exists
 * - hasWebsite: any meaningful data exists in websiteAnalysis
 * - hasContent: any text content exists (headers/homepage/about/hero)
 * - hasRawText: aggregated text > MIN_TEXT_THRESHOLD characters
 */
export function detectWebsitePresence(dataSources: DataSources): WebsitePresence {
  const MIN_RAW_HTML_LENGTH = 500 // Minimum HTML to consider valid
  const MIN_TEXT_THRESHOLD = 200  // Minimum aggregated text to consider meaningful
  
  const triggers: string[] = []
  const debugInfo: WebsitePresence['debugInfo'] = {}
  
  // Check for websiteAnalysis (actual table row)
  const websiteAnalysis = (dataSources as any).websiteAnalysis || (dataSources as any).website
  const hasWebsiteAnalysis = !!websiteAnalysis
  
  if (!hasWebsiteAnalysis) {
    return {
      hasWebsiteAnalysis: false,
      hasWebsite: false,
      hasContent: false,
      hasRawText: false,
      contentLength: 0,
      triggers: ['No websiteAnalysis data found'],
      debugInfo: {}
    }
  }
  
  // Check source_url
  if (websiteAnalysis.source_url && websiteAnalysis.source_url.trim()) {
    triggers.push('source_url present')
    debugInfo.source_url = websiteAnalysis.source_url
  }
  
  // Check raw_html
  if (websiteAnalysis.raw_html && websiteAnalysis.raw_html.length > MIN_RAW_HTML_LENGTH) {
    triggers.push(`raw_html (${websiteAnalysis.raw_html.length} chars)`)
    debugInfo.raw_html_length = websiteAnalysis.raw_html.length
  }
  
  // Check homepage_content
  if (websiteAnalysis.homepage_content && websiteAnalysis.homepage_content.trim().length > 0) {
    triggers.push(`homepage_content (${websiteAnalysis.homepage_content.length} chars)`)
    debugInfo.homepage_content_length = websiteAnalysis.homepage_content.length
  }
  
  // Check about_content
  if (websiteAnalysis.about_content && websiteAnalysis.about_content.trim().length > 0) {
    triggers.push(`about_content (${websiteAnalysis.about_content.length} chars)`)
    debugInfo.about_content_length = websiteAnalysis.about_content.length
  }
  
  // Check array fields
  const checkArray = (field: string, arr: any) => {
    if (Array.isArray(arr) && arr.length > 0) {
      triggers.push(`${field} (${arr.length} items)`)
      ;(debugInfo as any)[`${field}_count`] = arr.length
      return true
    }
    return false
  }
  
  checkArray('headers', websiteAnalysis.headers)
  checkArray('hero_texts', websiteAnalysis.hero_texts)
  checkArray('cta_texts', websiteAnalysis.cta_texts)
  checkArray('nav_items', websiteAnalysis.nav_items)
  checkArray('keywords', websiteAnalysis.keywords)
  
  // Check raw_result text fields
  if (websiteAnalysis.raw_result) {
    const rr = websiteAnalysis.raw_result
    if (typeof rr === 'object') {
      const textFields = ['title', 'description', 'content', 'text', 'body']
      for (const field of textFields) {
        if (rr[field] && String(rr[field]).trim().length > 50) {
          triggers.push(`raw_result.${field}`)
          break
        }
      }
    }
  }
  
  // Aggregate all text content
  const textParts: string[] = []
  
  if (websiteAnalysis.homepage_content) textParts.push(websiteAnalysis.homepage_content)
  if (websiteAnalysis.about_content) textParts.push(websiteAnalysis.about_content)
  if (websiteAnalysis.about_block) textParts.push(websiteAnalysis.about_block)
  
  // Add array text
  const addArrayText = (arr: any) => {
    if (Array.isArray(arr)) {
      arr.forEach(item => {
        if (typeof item === 'string' && item.trim()) textParts.push(item)
      })
    }
  }
  
  addArrayText(websiteAnalysis.headers)
  addArrayText(websiteAnalysis.hero_texts)
  addArrayText(websiteAnalysis.cta_texts)
  addArrayText(websiteAnalysis.nav_items)
  
  const aggregatedText = textParts.join(' ')
  const contentLength = aggregatedText.length
  
  // Determine flags
  const hasWebsite = triggers.length > 0
  const hasContent = textParts.length > 0
  const hasRawText = contentLength >= MIN_TEXT_THRESHOLD
  
  if (!hasRawText && hasContent) {
    triggers.push(`⚠️ Text exists but below threshold (${contentLength}/${MIN_TEXT_THRESHOLD} chars)`)
  }
  
  return {
    hasWebsiteAnalysis,
    hasWebsite,
    hasContent,
    hasRawText,
    contentLength,
    triggers,
    debugInfo
  }
}

/**
 * Logs website presence detection results in a human-readable format.
 */
export function logWebsitePresence(presence: WebsitePresence, businessName?: string): void {
  const prefix = businessName ? `📊 Website Presence [${businessName}]` : '📊 Website Presence'
  
  console.log(`${prefix}:`, {
    hasWebsiteAnalysis: presence.hasWebsiteAnalysis ? '✅' : '❌',
    hasWebsite: presence.hasWebsite ? '✅' : '❌',
    hasContent: presence.hasContent ? '✅' : '❌',
    hasRawText: presence.hasRawText ? '✅' : '❌',
    contentLength: `${presence.contentLength} chars`,
    triggers: presence.triggers.length
  })
  
  if (presence.triggers.length > 0) {
    console.log('🔍 Detection triggers:')
    presence.triggers.forEach(trigger => console.log(`   - ${trigger}`))
  }
  
  if (Object.keys(presence.debugInfo).length > 0) {
    console.log('🐛 Debug info:', presence.debugInfo)
  }
}
