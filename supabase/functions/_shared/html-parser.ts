/**
 * HTML parsing and text extraction utilities
 */

/**
 * Improved HTML to text conversion that preserves semantic structure
 * 
 * @param html - Raw HTML content to parse
 * @param isHomepage - Whether this is the homepage (affects character limits)
 * @returns Cleaned text with preserved structure markers (H1/H2/H3, bullets, etc.)
 */
export function htmlToCleanText(html: string, isHomepage: boolean = false): string {
  let text = html
  
  // 1. Remove scripts, styles, and non-content elements
  text = text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
  
  // 2. Preserve important semantic structure with markers
  text = text
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n### H1: $1 ###\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## H2: $1 ##\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n# H3: $1 #\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n• $1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, ' | $1')  // Preserve table structure
    .replace(/<tr[^>]*>/gi, '\n')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
  
  // 3. Strip remaining tags
  text = text.replace(/<[^>]+>/g, ' ')
  
  // 4. Clean up whitespace but preserve line breaks
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')  // Multiple spaces to single space
    .replace(/\n[ \t]+/g, '\n')  // Remove leading spaces on lines
    .replace(/\n{4,}/g, '\n\n\n')  // Max 3 newlines
    .trim()
  
  // 5. More generous character limits
  const limit = isHomepage ? 120000 : 30000  // Increased for better menu extraction
  return text.slice(0, limit)
}
