// ============================================================================
// BUSINESS TYPE DETECTION
// ============================================================================
// Auto-detects business type from programmes, menu, and establishment data
// Returns professional domain expertise in Danish
// ============================================================================

export type BusinessType = 
  | 'hybrid_cafe'        // morgenmad + frokost + bar
  | 'restaurant'         // frokost/middag fokus
  | 'fine_dining'        // upscale middag
  | 'coffee_bar'         // specialty kaffe fokus
  | 'wine_bar'           // vin-fokuseret bar
  | 'cocktail_bar'       // cocktail/aften bar
  | 'bakery_cafe'        // bageri med café-service
  | 'casual_dining'      // casual restaurant
  | 'bistro'             // fransk-stil bistro
  | 'pub';               // dansk pub/bar med mad

export interface BusinessTypeDetection {
  type: BusinessType;
  confidence: number;  // 0-1
  reasoning: string;
  professional_domain: string;  // Danish: "all-day dining koncepter"
}

interface BusinessData {
  programmes: string[];
  menu_text?: string;
  establishment_type?: string;
  category?: string;
}

// ============================================================================
// PROFESSIONAL DOMAIN MAPPINGS (DANISH)
// ============================================================================

const PROFESSIONAL_DOMAINS: Record<BusinessType, string> = {
  'hybrid_cafe': 'all-day dining koncepter',
  'restaurant': 'restaurant marketing',
  'fine_dining': 'fine dining og gastronomi',
  'coffee_bar': 'specialty coffee og moderne kaffebarer',
  'wine_bar': 'vin-barer og wine pairing',
  'cocktail_bar': 'cocktail-barer og drinks marketing',
  'bakery_cafe': 'bageri-café koncepter',
  'casual_dining': 'casual dining og everyday restaurants',
  'bistro': 'bistro og fransk-inspireret dining',
  'pub': 'pub og bar mad'
};

// ============================================================================
// DETECTION LOGIC
// ============================================================================

export function detectBusinessType(data: BusinessData): BusinessTypeDetection {
  const { programmes, menu_text = '', establishment_type = '', category = '' } = data;
  
  const menuLower = menu_text.toLowerCase();
  const typeLower = establishment_type.toLowerCase();
  const categoryLower = category.toLowerCase();
  
  // ========================================
  // 1. FINE DINING (Highest priority)
  // ========================================
  if (
    typeLower.includes('fine_dining') ||
    typeLower.includes('fine dining') ||
    menuLower.match(/tasting menu|chef.*table|michelin|gastronomisk|gourmet menu/)
  ) {
    return {
      type: 'fine_dining',
      confidence: 0.95,
      reasoning: 'Fine dining indikatorer i type eller menu (tasting menu, michelin, gastronomisk)',
      professional_domain: PROFESSIONAL_DOMAINS.fine_dining
    };
  }
  
  // ========================================
  // 2. HYBRID CAFE (Multiple programmes) - CHECK BEFORE SPECIALTY COFFEE
  // ========================================
  // Hybrid cafe is MORE specific than coffee bar (requires 3+ programmes vs just 1 + coffee terms)
  // Must be checked FIRST to avoid false coffee_bar classification
  if (
    programmes.includes('morning') &&
    programmes.includes('lunch') &&
    (programmes.includes('bar') || programmes.includes('dinner'))
  ) {
    return {
      type: 'hybrid_cafe',
      confidence: 0.9,
      reasoning: 'Flere programmer der spænder over hele dagen (morgenmad, frokost, bar/middag)',
      professional_domain: PROFESSIONAL_DOMAINS.hybrid_cafe
    };
  }
  
  // ========================================
  // 3. SPECIALTY COFFEE BAR
  // ========================================
  // Only matches if NOT hybrid cafe (checked above)
  if (
    programmes.includes('morning') &&
    menuLower.match(/espresso|flat white|cortado|pour over|filter coffee|specialty coffee|single origin|aeropress/)
  ) {
    return {
      type: 'coffee_bar',
      confidence: 0.85,
      reasoning: 'Specialty coffee terminologi i menu (espresso, flat white, specialty coffee)',
      professional_domain: PROFESSIONAL_DOMAINS.coffee_bar
    };
  }
  
  // ========================================
  // 4. WINE BAR
  // ========================================
  if (
    programmes.includes('bar') &&
    (menuLower.match(/vin|wine|rosé|champagne|naturvin/) &&
     menuLower.split(/\n/).filter(line => line.match(/vin|wine|rosé/i)).length > 10)
  ) {
    return {
      type: 'wine_bar',
      confidence: 0.8,
      reasoning: 'Bar-program med stort vin-fokus (10+ vin-entries i menu)',
      professional_domain: PROFESSIONAL_DOMAINS.wine_bar
    };
  }
  
  // ========================================
  // 5. COCKTAIL BAR
  // ========================================
  if (
    programmes.includes('bar') &&
    menuLower.match(/cocktail|martini|negroni|old fashioned|gin tonic|mojito|espresso martini/)
  ) {
    return {
      type: 'cocktail_bar',
      confidence: 0.85,
      reasoning: 'Bar-program med cocktail-fokus (cocktail navne i menu)',
      professional_domain: PROFESSIONAL_DOMAINS.cocktail_bar
    };
  }
  
  // ========================================
  // 6. BAKERY CAFE
  // ========================================
  if (
    (categoryLower.includes('bakery') || typeLower.includes('bageri')) &&
    programmes.includes('morning')
  ) {
    return {
      type: 'bakery_cafe',
      confidence: 0.85,
      reasoning: 'Bageri-kategori med café-service (morning program)',
      professional_domain: PROFESSIONAL_DOMAINS.bakery_cafe
    };
  }
  
  // ========================================
  // 7. BISTRO
  // ========================================
  if (
    typeLower.includes('bistro') ||
    categoryLower.includes('bistro') ||
    menuLower.match(/fransk|french|entrecôte|confit|ratatouille/)
  ) {
    return {
      type: 'bistro',
      confidence: 0.75,
      reasoning: 'Bistro i type/kategori eller fransk-inspireret menu',
      professional_domain: PROFESSIONAL_DOMAINS.bistro
    };
  }
  
  // ========================================
  // 8. PUB
  // ========================================
  if (
    typeLower.includes('pub') ||
    (programmes.includes('bar') && menuLower.match(/burger|fish.*chips|pub|øl|beer|draft/))
  ) {
    return {
      type: 'pub',
      confidence: 0.8,
      reasoning: 'Pub i type eller bar med pub-menu (burger, fish & chips, øl)',
      professional_domain: PROFESSIONAL_DOMAINS.pub
    };
  }
  
  // ========================================
  // 9. CASUAL DINING (Lunch/Dinner only)
  // ========================================
  if (
    (programmes.includes('lunch') || programmes.includes('dinner')) &&
    !programmes.includes('morning')
  ) {
    return {
      type: 'casual_dining',
      confidence: 0.7,
      reasoning: 'Frokost/middag program uden morgenmad = casual dining',
      professional_domain: PROFESSIONAL_DOMAINS.casual_dining
    };
  }
  
  // ========================================
  // 10. DEFAULT: RESTAURANT
  // ========================================
  return {
    type: 'restaurant',
    confidence: 0.6,
    reasoning: 'Standard restaurant uden specifik type-indikator',
    professional_domain: PROFESSIONAL_DOMAINS.restaurant
  };
}

// ============================================================================
// HELPER: Get professional domain for business type
// ============================================================================

export function getProfessionalDomain(businessType: BusinessType): string {
  return PROFESSIONAL_DOMAINS[businessType] || PROFESSIONAL_DOMAINS.restaurant;
}
