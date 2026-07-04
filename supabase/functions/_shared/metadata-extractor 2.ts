/**
 * HTML metadata extraction (Open Graph, meta tags, etc.)
 */

export interface PageMetadata {
  description?: string
  title?: string
  image?: string
}

/**
 * Extract metadata from HTML (title, description, image)
 * Prioritizes Open Graph tags, falls back to standard meta tags
 * 
 * @param html - Raw HTML content
 * @returns Extracted metadata object
 */
export function extractMetadata(html: string): PageMetadata {
  const metadata: PageMetadata = {}
  
  // OG Description (usually the best)
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
  if (ogDesc) metadata.description = ogDesc[1]
  
  // Meta description (fallback)
  if (!metadata.description) {
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    if (metaDesc) metadata.description = metaDesc[1]
  }
  
  // OG Title
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (ogTitle) metadata.title = ogTitle[1]
  
  // Title tag (fallback)
  if (!metadata.title) {
    const titleTag = html.match(/<title>([^<]+)<\/title>/i)
    if (titleTag) metadata.title = titleTag[1]
  }
  
  // OG Image
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  if (ogImage) metadata.image = ogImage[1]
  
  console.log('📝 Extracted metadata:', { 
    hasDesc: !!metadata.description, 
    hasTitle: !!metadata.title,
    hasImage: !!metadata.image 
  })
  
  return metadata
}
