/**
 * Extract JSON-LD structured data from HTML
 * Most restaurants/businesses have schema.org data with hours, address, etc.
 */

export interface StructuredData {
  '@type'?: string
  [key: string]: any
}

/**
 * Extract all JSON-LD structured data blocks from HTML
 * 
 * @param html - Raw HTML content
 * @returns Array of parsed structured data objects
 */
export function extractStructuredData(html: string): StructuredData[] {
  const structuredData: StructuredData[] = []
  
  // Find all JSON-LD script tags
  const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1])
      structuredData.push(data)
      console.log('📊 Found structured data:', data['@type'] || 'unknown type')
    } catch (e) {
      // Invalid JSON, skip
    }
  }
  
  return structuredData
}
