/**
 * Extraction Waterfall System
 * 
 * Purpose: Execute extraction methods in cost order, short-circuit when complete
 * Stages: Zero-cost (JSON-LD) → Low-cost (Regex) → Medium-cost (AI)
 * 
 * Prevents running expensive AI when cheap methods already found data
 */

import type { StructuredData } from '../structured-data-extractor.ts'
import { extractStructuredData } from '../structured-data-extractor.ts'
import { extractMetadata, type PageMetadata } from '../metadata-extractor.ts'
import { extractOpeningHours, extractKitchenCloseTime } from '../opening-hours-extractor.ts'

export type FieldStatus = 'FOUND' | 'PARTIAL' | 'MISSING'
export type FieldSource = 'JSON_LD' | 'REGEX' | 'META_TAG' | 'HTML_SEMANTIC' | 'AI_CHEAP' | 'AI_PREMIUM' | 'USER_PROVIDED'

export interface ExtractedField<T = string> {
  value: T | null
  status: FieldStatus
  source: FieldSource | null
  confidence: number  // 0-1
  raw?: any  // For debugging
}

export interface ExtractionCompleteness {
  businessName: ExtractedField<string>
  businessType: ExtractedField<string>
  description: ExtractedField<string>
  phone: ExtractedField<string>
  email: ExtractedField<string>
  address: ExtractedField<string>
  hours: ExtractedField<any>
  menu: ExtractedField<string[]>
  logo: ExtractedField<string>
  
  overallScore: number  // 0-100
  missingCriticalFields: string[]
  stageSummary: {
    stage1Complete: boolean
    stage2Complete: boolean
    stage3Required: boolean
  }
}

/**
 * Field weights for completeness scoring
 */
const FIELD_WEIGHTS = {
  businessName: 20,  // Critical
  businessType: 20,  // Critical
  description: 15,   // Important
  phone: 10,
  email: 10,
  address: 10,
  hours: 10,
  menu: 3,
  logo: 2
}

/**
 * Stage 1: Zero-Cost Extraction (JSON-LD + Meta Tags)
 */
export async function stage1ZeroCostExtraction(
  html: string,
  metadata: PageMetadata
): Promise<Partial<ExtractionCompleteness>> {
  console.log('📊 Stage 1: Zero-cost extraction (JSON-LD + Meta tags)')
  const startTime = Date.now()
  
  const structuredData = extractStructuredData(html)
  const result: Partial<ExtractionCompleteness> = {}
  
  // Extract from JSON-LD
  for (const data of structuredData) {
    // Business name
    if (data.name && !result.businessName?.value) {
      result.businessName = {
        value: String(data.name),
        status: 'FOUND',
        source: 'JSON_LD',
        confidence: 0.95,
        raw: data.name
      }
    }
    
    // Business type
    if (data['@type'] && !result.businessType?.value) {
      const type = String(data['@type'])
      result.businessType = {
        value: type,
        status: 'FOUND',
        source: 'JSON_LD',
        confidence: 0.95,
        raw: type
      }
    }
    
    // Description
    if (data.description && !result.description?.value) {
      result.description = {
        value: String(data.description),
        status: 'FOUND',
        source: 'JSON_LD',
        confidence: 0.9,
        raw: data.description
      }
    }
    
    // Phone
    if (data.telephone && !result.phone?.value) {
      result.phone = {
        value: String(data.telephone),
        status: 'FOUND',
        source: 'JSON_LD',
        confidence: 0.95,
        raw: data.telephone
      }
    }
    
    // Email
    if (data.email && !result.email?.value) {
      result.email = {
        value: String(data.email),
        status: 'FOUND',
        source: 'JSON_LD',
        confidence: 0.95,
        raw: data.email
      }
    }
    
    // Address
    if (data.address && !result.address?.value) {
      const addr = data.address
      let addressStr = ''
      
      if (typeof addr === 'string') {
        addressStr = addr
      } else if (typeof addr === 'object') {
        const parts = [
          addr.streetAddress,
          addr.addressLocality,
          addr.postalCode,
          addr.addressCountry
        ].filter(Boolean)
        addressStr = parts.join(', ')
      }
      
      if (addressStr) {
        result.address = {
          value: addressStr,
          status: 'FOUND',
          source: 'JSON_LD',
          confidence: 0.9,
          raw: addr
        }
      }
    }
    
    // Hours
    if ((data.openingHoursSpecification || data.openingHours) && !result.hours?.value) {
      const extracted = extractOpeningHours(html, structuredData)
      if (extracted.openingHours) {
        result.hours = {
          value: extracted.openingHours,
          status: 'FOUND',
          source: 'JSON_LD',
          confidence: extracted.reviewRequired ? 0.7 : 0.9,
          raw: extracted
        }
      }
    }
    
    // Logo
    if (data.logo && !result.logo?.value) {
      const logoUrl = typeof data.logo === 'string' ? data.logo : data.logo?.url
      if (logoUrl) {
        result.logo = {
          value: String(logoUrl),
          status: 'FOUND',
          source: 'JSON_LD',
          confidence: 0.85,
          raw: data.logo
        }
      }
    }
  }
  
  // Fallback to meta tags (lower confidence)
  if (!result.businessName?.value && metadata.title) {
    result.businessName = {
      value: metadata.title,
      status: 'PARTIAL',
      source: 'META_TAG',
      confidence: 0.6,
      raw: metadata.title
    }
  }
  
  if (!result.description?.value && metadata.description) {
    result.description = {
      value: metadata.description,
      status: 'FOUND',
      source: 'META_TAG',
      confidence: 0.75,
      raw: metadata.description
    }
  }
  
  if (!result.logo?.value && metadata.image) {
    result.logo = {
      value: metadata.image,
      status: 'FOUND',
      source: 'META_TAG',
      confidence: 0.7,
      raw: metadata.image
    }
  }
  
  const fieldsFound = Object.keys(result).length
  const duration = Date.now() - startTime
  
  console.log(`✅ Stage 1 complete: ${fieldsFound} fields found (${duration}ms)`)
  
  return result
}

/**
 * Stage 2: Low-Cost Extraction (Regex patterns, HTML semantic)
 */
export async function stage2LowCostExtraction(
  html: string,
  url: string,
  stage1Result: Partial<ExtractionCompleteness>
): Promise<Partial<ExtractionCompleteness>> {
  console.log('📊 Stage 2: Low-cost extraction (Regex + HTML semantic)')
  const startTime = Date.now()
  
  const result = { ...stage1Result }
  
  // Phone extraction (if not found in Stage 1)
  if (!result.phone?.value || result.phone.status !== 'FOUND') {
    // Danish phone patterns
    const phonePatterns = [
      /\+45\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}/g,  // +45 12 34 56 78
      /\d{2}\s?\d{2}\s?\d{2}\s?\d{2}(?!\d)/g     // 12 34 56 78
    ]
    
    for (const pattern of phonePatterns) {
      const match = html.match(pattern)
      if (match) {
        result.phone = {
          value: match[0].trim(),
          status: 'FOUND',
          source: 'REGEX',
          confidence: 0.8,
          raw: match[0]
        }
        break
      }
    }
    
    // Also check <a href="tel:"> tags
    const telMatch = html.match(/<a[^>]+href=["']tel:([^"']+)["']/i)
    if (telMatch && (!result.phone?.value || result.phone.confidence < 0.8)) {
      result.phone = {
        value: telMatch[1],
        status: 'FOUND',
        source: 'HTML_SEMANTIC',
        confidence: 0.9,
        raw: telMatch[0]
      }
    }
  }
  
  // Email extraction
  if (!result.email?.value || result.email.status !== 'FOUND') {
    // Email pattern
    const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
    if (emailMatch) {
      // Filter out common false positives
      const validEmails = emailMatch.filter(email => 
        !email.includes('example.com') &&
        !email.includes('domain.com') &&
        !email.includes('@sentry.io') &&
        !email.includes('@googletagmanager')
      )
      
      if (validEmails.length > 0) {
        result.email = {
          value: validEmails[0],
          status: 'FOUND',
          source: 'REGEX',
          confidence: 0.75,
          raw: validEmails[0]
        }
      }
    }
    
    // Check <a href="mailto:"> tags (higher confidence)
    const mailtoMatch = html.match(/<a[^>]+href=["']mailto:([^"']+)["']/i)
    if (mailtoMatch) {
      result.email = {
        value: mailtoMatch[1],
        status: 'FOUND',
        source: 'HTML_SEMANTIC',
        confidence: 0.9,
        raw: mailtoMatch[0]
      }
    }
  }
  
  // Address extraction from <address> tag
  if (!result.address?.value || result.address.status !== 'FOUND') {
    const addressMatch = html.match(/<address[^>]*>([\s\S]*?)<\/address>/i)
    if (addressMatch) {
      const addressText = addressMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      if (addressText.length > 10) {
        result.address = {
          value: addressText,
          status: 'FOUND',
          source: 'HTML_SEMANTIC',
          confidence: 0.85,
          raw: addressMatch[0]
        }
      }
    }
  }
  
  // Hours extraction (if not in JSON-LD)
  if (!result.hours?.value) {
    const extracted = extractOpeningHours(html, [])
    if (extracted.openingHours) {
      result.hours = {
        value: extracted.openingHours,
        status: 'FOUND',
        source: 'REGEX',
        confidence: extracted.reviewRequired ? 0.6 : 0.75,
        raw: extracted
      }
    }
  }
  
  // Kitchen close time (bonus field)
  const kitchenClose = extractKitchenCloseTime(html)
  if (kitchenClose) {
    console.log('🍳 Extracted kitchen close time:', kitchenClose)
  }
  
  // Logo extraction from HTML
  if (!result.logo?.value || result.logo.confidence < 0.8) {
    // Try <link rel="icon">
    const iconMatch = html.match(/<link[^>]+rel=["'](icon|apple-touch-icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i)
    if (iconMatch) {
      const logoUrl = new URL(iconMatch[2], url).href
      result.logo = {
        value: logoUrl,
        status: 'FOUND',
        source: 'HTML_SEMANTIC',
        confidence: 0.8,
        raw: iconMatch[0]
      }
    }
    
    // Try <img> with "logo" in alt/class
    if (!result.logo?.value) {
      const logoImgMatch = html.match(/<img[^>]+(alt|class)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i)
      if (logoImgMatch) {
        const logoUrl = new URL(logoImgMatch[2], url).href
        result.logo = {
          value: logoUrl,
          status: 'FOUND',
          source: 'HTML_SEMANTIC',
          confidence: 0.75,
          raw: logoImgMatch[0]
        }
      }
    }
  }
  
  // Menu URL detection
  const menuLinkMatch = html.match(/<a[^>]+href=["']([^"']*menu[^"']*)["']/i)
  if (menuLinkMatch) {
    const menuUrl = new URL(menuLinkMatch[1], url).href
    result.menu = {
      value: [menuUrl],
      status: 'FOUND',
      source: 'REGEX',
      confidence: 0.7,
      raw: menuLinkMatch[0]
    }
  }
  
  const fieldsFound = Object.keys(result).length - Object.keys(stage1Result).length
  const duration = Date.now() - startTime
  
  console.log(`✅ Stage 2 complete: ${fieldsFound} additional fields found (${duration}ms)`)
  
  return result
}

/**
 * Calculate completeness score
 */
export function calculateCompleteness(
  extractedData: Partial<ExtractionCompleteness>
): ExtractionCompleteness {
  let totalScore = 0
  let maxPossibleScore = 0
  const missingCriticalFields: string[] = []
  
  // Score each field
  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    maxPossibleScore += weight
    const fieldData = extractedData[field as keyof Partial<ExtractionCompleteness>] as ExtractedField | undefined
    
    if (fieldData?.status === 'FOUND') {
      totalScore += weight * (fieldData.confidence || 0.8)
    } else if (fieldData?.status === 'PARTIAL') {
      totalScore += weight * 0.5 * (fieldData.confidence || 0.5)
    } else {
      // Missing
      if (weight >= 15) {  // Critical field (businessName, businessType, description)
        missingCriticalFields.push(field)
      }
    }
  }
  
  const overallScore = Math.round((totalScore / maxPossibleScore) * 100)
  
  // Determine if Stage 3 (AI) is needed
  const stage1Complete = overallScore >= 90
  const stage2Complete = overallScore >= 80
  const stage3Required = overallScore < 80 || missingCriticalFields.length > 0
  
  console.log(`📊 Completeness score: ${overallScore}/100 (Stage 3 required: ${stage3Required})`)
  
  // Fill in default values for missing fields
  const complete: ExtractionCompleteness = {
    businessName: extractedData.businessName || { value: null, status: 'MISSING', source: null, confidence: 0 },
    businessType: extractedData.businessType || { value: null, status: 'MISSING', source: null, confidence: 0 },
    description: extractedData.description || { value: null, status: 'MISSING', source: null, confidence: 0 },
    phone: extractedData.phone || { value: null, status: 'MISSING', source: null, confidence: 0 },
    email: extractedData.email || { value: null, status: 'MISSING', source: null, confidence: 0 },
    address: extractedData.address || { value: null, status: 'MISSING', source: null, confidence: 0 },
    hours: extractedData.hours || { value: null, status: 'MISSING', source: null, confidence: 0 },
    menu: extractedData.menu || { value: null, status: 'MISSING', source: null, confidence: 0 },
    logo: extractedData.logo || { value: null, status: 'MISSING', source: null, confidence: 0 },
    overallScore,
    missingCriticalFields,
    stageSummary: {
      stage1Complete,
      stage2Complete,
      stage3Required
    }
  }
  
  return complete
}

/**
 * Determine which fields need AI extraction
 */
export function identifyFieldsForAI(completeness: ExtractionCompleteness): string[] {
  const fieldsForAI: string[] = []
  
  // Only extract missing or low-confidence critical fields
  if (completeness.businessName.status === 'MISSING' || completeness.businessName.confidence < 0.7) {
    fieldsForAI.push('businessName')
  }
  
  if (completeness.businessType.status === 'MISSING' || completeness.businessType.confidence < 0.7) {
    fieldsForAI.push('businessType')
  }
  
  if (completeness.description.status === 'MISSING' || completeness.description.confidence < 0.7) {
    fieldsForAI.push('description')
  }
  
  // Other fields only if completely missing
  if (completeness.phone.status === 'MISSING') {
    fieldsForAI.push('phone')
  }
  
  if (completeness.email.status === 'MISSING') {
    fieldsForAI.push('email')
  }
  
  if (completeness.address.status === 'MISSING') {
    fieldsForAI.push('address')
  }
  
  console.log(`🤖 Fields requiring AI extraction: ${fieldsForAI.join(', ') || 'none'}`)
  
  return fieldsForAI
}
