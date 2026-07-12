/**
 * Validation & Quality Assurance Layer
 * 
 * Purpose: Cross-validate AI results against structured data
 * Detect conflicts, assess confidence, prevent misclassifications
 * 
 * Key Feature: Souk Aarhus Prevention - detect when restaurant is misclassified as retail
 */

import type { ExtractionCompleteness, ExtractedField, FieldSource } from './extraction-waterfall.ts'

export interface ValidationResult {
  field: string
  isValid: boolean
  confidence: number
  conflicts: Array<{
    source1: FieldSource
    value1: string
    source2: FieldSource
    value2: string
    severity: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  warnings: string[]
  recommendation: 'ACCEPT' | 'REVIEW' | 'REJECT'
}

export interface QualityReport {
  overallQuality: 'HIGH' | 'MEDIUM' | 'LOW' | 'FAILED'
  validations: ValidationResult[]
  criticalIssues: string[]
  requiresManualReview: boolean
  autoCorrections: Array<{
    field: string
    from: string
    to: string
    reason: string
  }>
}

/**
 * Source confidence ranking (higher = more authoritative)
 */
const SOURCE_AUTHORITY: Record<FieldSource, number> = {
  'USER_PROVIDED': 1.0,   // User knows best
  'JSON_LD': 0.95,        // Structured data is usually accurate
  'HTML_SEMANTIC': 0.85,  // Semantic HTML tags
  'META_TAG': 0.75,       // Meta tags can be generic
  'REGEX': 0.7,           // Pattern matching
  'AI_PREMIUM': 0.6,      // AI can hallucinate
  'AI_CHEAP': 0.5         // Cheaper AI more prone to errors
}

/**
 * Validate business type for hospitality signals
 * Prevents "Restaurant → Retail" misclassifications
 */
function validateBusinessType(
  extractedType: ExtractedField<string>,
  evidence: {
    hasMenuUrl: boolean
    hasBookingUrl: boolean
    mentionsFood: boolean
    hasTableService: boolean
    jsonLdType: string | null
  }
): ValidationResult {
  const warnings: string[] = []
  const conflicts: ValidationResult['conflicts'] = []
  let confidence = extractedType.confidence
  let recommendation: 'ACCEPT' | 'REVIEW' | 'REJECT' = 'ACCEPT'
  
  if (!extractedType.value) {
    return {
      field: 'businessType',
      isValid: false,
      confidence: 0,
      conflicts: [],
      warnings: ['Business type not found'],
      recommendation: 'REJECT'
    }
  }
  
  const type = extractedType.value.toLowerCase()
  const isClassifiedAsRetail = type.includes('retail') || type.includes('shop') || type.includes('store')
  const isClassifiedAsRestaurant = type.includes('restaurant') || type.includes('café') || type.includes('cafe') || type.includes('bar')
  
  // CRITICAL: Detect restaurant misclassified as retail
  if (isClassifiedAsRetail && (evidence.hasMenuUrl || evidence.mentionsFood || evidence.jsonLdType?.includes('Restaurant'))) {
    const hospitalitySignals = [
      evidence.hasMenuUrl && 'menu URL',
      evidence.hasBookingUrl && 'booking URL',
      evidence.mentionsFood && 'food mentions',
      evidence.hasTableService && 'table service',
      evidence.jsonLdType?.includes('Restaurant') && 'JSON-LD type: Restaurant'
    ].filter(Boolean)
    
    warnings.push(`⚠️ MISCLASSIFICATION DETECTED: Classified as retail but has hospitality signals: ${hospitalitySignals.join(', ')}`)
    
    // Add conflict if JSON-LD says Restaurant
    if (evidence.jsonLdType?.includes('Restaurant')) {
      conflicts.push({
        source1: 'JSON_LD',
        value1: evidence.jsonLdType,
        source2: extractedType.source!,
        value2: extractedType.value,
        severity: 'HIGH'
      })
    }
    
    confidence = 0.2  // Very low confidence in misclassification
    recommendation = 'REJECT'
  }
  
  // Validate: If JSON-LD says Restaurant, AI should agree
  if (evidence.jsonLdType?.includes('Restaurant') && !isClassifiedAsRestaurant) {
    warnings.push(`JSON-LD indicates Restaurant but extracted type is: ${extractedType.value}`)
    
    conflicts.push({
      source1: 'JSON_LD',
      value1: evidence.jsonLdType,
      source2: extractedType.source!,
      value2: extractedType.value,
      severity: 'HIGH'
    })
    
    confidence = Math.min(confidence, 0.4)
    recommendation = 'REVIEW'
  }
  
  // Validate: Hospitality indicators should mean hospitality business
  if ((evidence.hasMenuUrl || evidence.hasBookingUrl || evidence.mentionsFood) && !isClassifiedAsRestaurant && !type.includes('hotel')) {
    warnings.push(`Hospitality indicators present but type is: ${extractedType.value}`)
    confidence = Math.min(confidence, 0.6)
    recommendation = 'REVIEW'
  }
  
  return {
    field: 'businessType',
    isValid: recommendation !== 'REJECT',
    confidence,
    conflicts,
    warnings,
    recommendation
  }
}

/**
 * Cross-validate description against meta tags
 */
function validateDescription(
  extractedDesc: ExtractedField<string>,
  metaDescription: string | null
): ValidationResult {
  const warnings: string[] = []
  const conflicts: ValidationResult['conflicts'] = []
  let confidence = extractedDesc.confidence
  let recommendation: 'ACCEPT' | 'REVIEW' | 'REJECT' = 'ACCEPT'
  
  if (!extractedDesc.value) {
    return {
      field: 'description',
      isValid: false,
      confidence: 0,
      conflicts: [],
      warnings: ['Description not found'],
      recommendation: 'REJECT'
    }
  }
  
  // If meta description exists and differs significantly, flag it
  if (metaDescription && extractedDesc.source === 'AI_CHEAP') {
    const similarity = calculateStringSimilarity(extractedDesc.value, metaDescription)
    
    if (similarity < 0.3 && metaDescription.length > 50) {
      warnings.push(`AI description differs significantly from meta description (${Math.round(similarity * 100)}% similar)`)
      
      conflicts.push({
        source1: 'META_TAG',
        value1: metaDescription,
        source2: extractedDesc.source,
        value2: extractedDesc.value,
        severity: 'MEDIUM'
      })
      
      confidence = Math.min(confidence, 0.6)
      recommendation = 'REVIEW'
    }
  }
  
  // Check for generic AI descriptions
  const genericPhrases = [
    'this business',
    'this establishment',
    'we are a',
    'located in',
    'offers a variety of'
  ]
  
  const hasGenericPhrases = genericPhrases.some(phrase => 
    extractedDesc.value!.toLowerCase().includes(phrase)
  )
  
  if (hasGenericPhrases && extractedDesc.source === 'AI_CHEAP') {
    warnings.push('Description contains generic AI phrases')
    confidence = Math.min(confidence, 0.7)
  }
  
  return {
    field: 'description',
    isValid: true,
    confidence,
    conflicts,
    warnings,
    recommendation
  }
}

/**
 * Validate contact information format
 */
function validateContact(
  phone: ExtractedField<string>,
  email: ExtractedField<string>
): ValidationResult[] {
  const results: ValidationResult[] = []
  
  // Validate phone
  if (phone.value) {
    const warnings: string[] = []
    let confidence = phone.confidence
    
    // Danish phone validation
    const cleanPhone = phone.value.replace(/[\s\-]/g, '')
    const isDanishFormat = /^\+?45\d{8}$/.test(cleanPhone) || /^\d{8}$/.test(cleanPhone)
    
    if (!isDanishFormat) {
      warnings.push('Phone number does not match Danish format')
      confidence = Math.min(confidence, 0.6)
    }
    
    results.push({
      field: 'phone',
      isValid: true,
      confidence,
      conflicts: [],
      warnings,
      recommendation: warnings.length > 0 ? 'REVIEW' : 'ACCEPT'
    })
  }
  
  // Validate email
  if (email.value) {
    const warnings: string[] = []
    let confidence = email.confidence
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.value)) {
      warnings.push('Email format invalid')
      confidence = 0.3
    }
    
    // Check for suspicious domains
    if (email.value.includes('example.com') || email.value.includes('domain.com')) {
      warnings.push('Email appears to be placeholder')
      confidence = 0.2
    }
    
    results.push({
      field: 'email',
      isValid: emailRegex.test(email.value),
      confidence,
      conflicts: [],
      warnings,
      recommendation: warnings.length > 0 ? 'REVIEW' : 'ACCEPT'
    })
  }
  
  return results
}

/**
 * Auto-correct obvious misclassifications
 */
function applyAutoCorrections(
  completeness: ExtractionCompleteness,
  evidence: {
    hasMenuUrl: boolean
    hasBookingUrl: boolean
    mentionsFood: boolean
    hasTableService: boolean
    jsonLdType: string | null
  }
): Array<{field: string, from: string, to: string, reason: string}> {
  const corrections: Array<{field: string, from: string, to: string, reason: string}> = []
  
  // Auto-correct: Retail → Restaurant when hospitality signals present
  if (completeness.businessType.value) {
    const type = completeness.businessType.value.toLowerCase()
    const isRetail = type.includes('retail') || type.includes('shop') || type.includes('store')
    
    if (isRetail && (evidence.hasMenuUrl || evidence.jsonLdType?.includes('Restaurant'))) {
      const newType = evidence.jsonLdType?.includes('Restaurant') ? evidence.jsonLdType : 'Restaurant'
      
      corrections.push({
        field: 'businessType',
        from: completeness.businessType.value,
        to: newType,
        reason: 'Hospitality signals detected (menu URL, JSON-LD, food mentions) - auto-correcting retail misclassification'
      })
      
      // Apply correction
      completeness.businessType.value = newType
      completeness.businessType.source = 'JSON_LD'
      completeness.businessType.confidence = 0.95
    }
  }
  
  return corrections
}

/**
 * Main validation function
 */
export function validateExtractionQuality(
  completeness: ExtractionCompleteness,
  context: {
    hasMenuUrl: boolean
    hasBookingUrl: boolean
    websiteContent: string
    jsonLdType: string | null
    metaDescription: string | null
  }
): QualityReport {
  console.log('🔍 Starting quality validation...')
  
  const validations: ValidationResult[] = []
  const criticalIssues: string[] = []
  
  // Detect hospitality indicators
  const mentionsFood = /menu|mad|retter|drinks|cocktails|restaurant|café|bar|takeaway|delivery/i.test(context.websiteContent)
  const hasTableService = /bordbetjening|table service|servering/i.test(context.websiteContent)
  
  const evidence = {
    hasMenuUrl: context.hasMenuUrl,
    hasBookingUrl: context.hasBookingUrl,
    mentionsFood,
    hasTableService,
    jsonLdType: context.jsonLdType
  }
  
  // Apply auto-corrections FIRST
  const autoCorrections = applyAutoCorrections(completeness, evidence)
  
  // Log corrections
  for (const correction of autoCorrections) {
    console.log(`🔧 AUTO-CORRECTION: ${correction.field}: "${correction.from}" → "${correction.to}"`)
    console.log(`   Reason: ${correction.reason}`)
  }
  
  // Validate business type
  const typeValidation = validateBusinessType(completeness.businessType, evidence)
  validations.push(typeValidation)
  
  if (typeValidation.recommendation === 'REJECT') {
    criticalIssues.push(`Business type validation failed: ${typeValidation.warnings.join(', ')}`)
  }
  
  // Validate description
  const descValidation = validateDescription(completeness.description, context.metaDescription)
  validations.push(descValidation)
  
  // Validate contacts
  const contactValidations = validateContact(completeness.phone, completeness.email)
  validations.push(...contactValidations)
  
  // Overall quality assessment
  const avgConfidence = validations.reduce((sum, v) => sum + v.confidence, 0) / validations.length
  const hasHighSeverityConflicts = validations.some(v => 
    v.conflicts.some(c => c.severity === 'HIGH')
  )
  const requiresReview = validations.some(v => v.recommendation === 'REVIEW' || v.recommendation === 'REJECT')
  
  let overallQuality: 'HIGH' | 'MEDIUM' | 'LOW' | 'FAILED'
  if (criticalIssues.length > 0 || hasHighSeverityConflicts) {
    overallQuality = 'FAILED'
  } else if (avgConfidence > 0.8 && !requiresReview) {
    overallQuality = 'HIGH'
  } else if (avgConfidence > 0.6) {
    overallQuality = 'MEDIUM'
  } else {
    overallQuality = 'LOW'
  }
  
  console.log(`📊 Quality assessment: ${overallQuality} (avg confidence: ${(avgConfidence * 100).toFixed(1)}%)`)
  
  if (autoCorrections.length > 0) {
    console.log(`🔧 Applied ${autoCorrections.length} auto-correction(s)`)
  }
  
  if (criticalIssues.length > 0) {
    console.error('❌ Critical issues detected:', criticalIssues)
  }
  
  return {
    overallQuality,
    validations,
    criticalIssues,
    requiresManualReview: requiresReview,
    autoCorrections
  }
}

/**
 * Helper: Calculate string similarity (Levenshtein-based)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  const editDistance = levenshteinDistance(shorter, longer)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}
