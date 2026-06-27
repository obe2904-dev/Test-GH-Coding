/**
 * USP (Unique Selling Points) Extractor - Layer 0 Enhancement
 * 
 * Synthesizes scattered brand differentiation data into clear, prioritized USPs
 * that marketing AI can emphasize in content creation.
 * 
 * SOURCES:
 * - signature_themes (from menu overview)
 * - location_marketing_hooks (from location intelligence)
 * - location category_scores (waterfront, city_centre, etc.)
 * - gastronomic_profile (culinary essence)
 * 
 * OUTPUT:
 * - primary_usp: Highest-impact differentiation point (with score + source)
 * - secondary_usps: Additional selling points
 * - synthesis_metadata: How USPs were prioritized
 * 
 * @version 1.0.0
 * @date June 21, 2026
 */

export interface USPExtractionInput {
  signatureThemes?: string[]  // From menu overview (e.g., ["Italiensk-dansk fusion", "Hjemmelavet pasta"])
  locationMarketingHooks?: string[]  // From location intelligence
  locationScores?: Record<string, number>  // {waterfront: 95, city_centre: 78, ...}
  gastronomicProfile?: string  // 95-word culinary essence
  businessName: string
  businessCategory: string
}

export interface ExtractedUSPs {
  primary_usp: {
    text: string
    source: 'location' | 'menu' | 'culinary' | 'combined'
    score: number  // 0-1 confidence/impact score
    evidence: string  // What data supports this
  }
  secondary_usps: Array<{
    text: string
    source: 'location' | 'menu' | 'culinary'
    evidence: string
  }>
  synthesis_reasoning: string  // How prioritization was determined
}

/**
 * Extract and prioritize USPs from brand intelligence data
 * 
 * PRIORITIZATION LOGIC:
 * 1. Location scores ≥90 = Primary USP (strongest differentiator)
 * 2. Location scores 80-89 = Secondary USP
 * 3. Signature themes (unique menu offerings) = Secondary USP
 * 4. Gastronomic profile insights = Tertiary (supporting context)
 */
export function extractUSPs(input: USPExtractionInput): ExtractedUSPs {
  const usps: ExtractedUSPs = {
    primary_usp: {
      text: '',
      source: 'location',
      score: 0,
      evidence: ''
    },
    secondary_usps: [],
    synthesis_reasoning: ''
  }
  
  const reasons: string[] = []
  
  // === 1. LOCATION-BASED USPs (strongest differentiators) ===
  
  if (input.locationScores) {
    // Find highest location score
    const sortedScores = Object.entries(input.locationScores)
      .sort(([, a], [, b]) => b - a)
    
    if (sortedScores.length > 0) {
      const [topCategory, topScore] = sortedScores[0]
      
      // Primary USP if score ≥ 90
      if (topScore >= 90) {
        // Map category to Danish marketing language
        const categoryLabels: Record<string, string> = {
          waterfront: 'Beliggenhed ved vandet',
          city_centre: 'Central beliggenhed',
          tourist: 'Destination i turistområde',
          student: 'Populær blandt studerende',
          residential: 'Lokal beliggenhed',
          transport_hub: 'Let tilgængelig',
          shopping_district: 'Centralt i shoppingområde',
          office: 'Tæt på kontorområde'
        }
        
        const labelText = categoryLabels[topCategory] || topCategory
        usps.primary_usp = {
          text: labelText,
          source: 'location',
          score: Math.round(topScore) / 100,
          evidence: `Location score: ${Math.round(topScore)}${input.locationMarketingHooks?.[0] ? ` - ${input.locationMarketingHooks[0]}` : ''}`
        }
        
        reasons.push(`Primary USP: ${topCategory} (${Math.round(topScore)} score) - strongest location differentiator`)
      }
      
      // Secondary location USPs (scores 80-89)
      sortedScores.slice(1, 3).forEach(([category, score]) => {
        if (score >= 80) {
          const categoryLabels: Record<string, string> = {
            waterfront: 'Ved vandet',
            city_centre: 'I byens centrum',
            tourist: 'Turistdestination',
            student: 'Studenterfavorit',
            residential: 'Lokalt samlingssted'
          }
          
          const labelText = categoryLabels[category] || category
          usps.secondary_usps.push({
            text: labelText,
            source: 'location',
            evidence: `Location score: ${Math.round(score)}`
          })
          
          reasons.push(`Secondary USP: ${category} (${Math.round(score)} score)`)
        }
      })
    }
  }
  
  // === 2. LOCATION MARKETING HOOKS (qualitative location USPs) ===
  
  if (input.locationMarketingHooks && input.locationMarketingHooks.length > 0) {
    // If no primary USP from scores, use first marketing hook
    if (usps.primary_usp.score === 0) {
      usps.primary_usp = {
        text: input.locationMarketingHooks[0],
        source: 'location',
        score: 0.85,  // Default high score for marketing hooks
        evidence: `Marketing hook: "${input.locationMarketingHooks[0]}"`
      }
      reasons.push(`Primary USP: Marketing hook (location-based positioning)`)
    }
    
    // Additional hooks as secondary USPs
    input.locationMarketingHooks.slice(1, 3).forEach(hook => {
      if (!usps.secondary_usps.some(usp => usp.text === hook)) {
        usps.secondary_usps.push({
          text: hook,
          source: 'location',
          evidence: `Marketing hook from location intelligence`
        })
      }
    })
  }
  
  // === 3. MENU-BASED USPs (signature themes) ===
  
  if (input.signatureThemes && input.signatureThemes.length > 0) {
    input.signatureThemes.slice(0, 2).forEach(theme => {
      // Only add if it's truly unique (not generic like "Fresh ingredients")
      const isGeneric = /fresh|quality|homemade|seasonal/i.test(theme)
      
      if (!isGeneric) {
        usps.secondary_usps.push({
          text: theme,
          source: 'menu',
          evidence: `Signature theme from menu analysis`
        })
        reasons.push(`Menu USP: "${theme}"`)
      }
    })
  }
  
  // === 4. CULINARY PROFILE (contextual support) ===
  
  if (input.gastronomicProfile) {
    // Extract key phrases (look for fusion patterns, specialty items)
    const fusionPattern = /(\w+(-\w+)*\s+fusion)/i
    const fusionMatch = input.gastronomicProfile.match(fusionPattern)
    
    if (fusionMatch && !usps.secondary_usps.some(usp => usp.text.includes('fusion'))) {
      usps.secondary_usps.push({
        text: fusionMatch[1],
        source: 'culinary',
        evidence: `Gastronomic profile: "${fusionMatch[1]}"`
      })
      reasons.push(`Culinary USP: ${fusionMatch[1]}`)
    }
  }
  
  // === FALLBACK: No strong USPs found ===
  
  if (usps.primary_usp.score === 0) {
    // Try business category first, then first signature theme, then business name
    let fallbackText = input.businessCategory
    let fallbackSource: 'combined' | 'menu' = 'combined'
    let fallbackEvidence = 'Fallback to business category'
    
    if (!fallbackText && input.signatureThemes && input.signatureThemes.length > 0) {
      fallbackText = input.signatureThemes[0]
      fallbackSource = 'menu'
      fallbackEvidence = 'Fallback to first signature theme (no location data, no category)'
      // Remove from secondary USPs to avoid duplication
      const firstThemeIndex = usps.secondary_usps.findIndex(usp => usp.text === fallbackText)
      if (firstThemeIndex >= 0) {
        usps.secondary_usps.splice(firstThemeIndex, 1)
      }
    }
    
    if (!fallbackText) {
      fallbackText = input.businessName
      fallbackEvidence = 'Fallback to business name (no other data available)'
    }
    
    usps.primary_usp = {
      text: fallbackText,
      source: fallbackSource,
      score: 0.50,  // Low confidence
      evidence: fallbackEvidence
    }
    reasons.push(`Fallback: ${fallbackEvidence}`)
  }
  
  // Build synthesis reasoning
  usps.synthesis_reasoning = reasons.join('. ') + '.'
  
  // Limit secondary USPs to top 3
  usps.secondary_usps = usps.secondary_usps.slice(0, 3)
  
  return usps
}

/**
 * Format USPs as marketing guidance text
 * 
 * Used in marketing manager brief generation
 */
export function formatUSPsForBrief(usps: ExtractedUSPs): string {
  const parts: string[] = []
  
  if (usps.primary_usp.score >= 0.80) {
    parts.push(`Primær USP: ${usps.primary_usp.text} (${Math.round(usps.primary_usp.score * 100)} score).`)
    parts.push(`Denne skal fremhæves i næsten hvert opslag.`)
  } else {
    parts.push(`Primær differentiering: ${usps.primary_usp.text}.`)
  }
  
  if (usps.secondary_usps.length > 0) {
    parts.push(``)
    parts.push(`Sekundære USP'er: ${usps.secondary_usps.map(u => u.text).join(', ')}.`)
    parts.push(`Disse kan veksles i content for variation.`)
  }
  
  return parts.join('\n')
}
