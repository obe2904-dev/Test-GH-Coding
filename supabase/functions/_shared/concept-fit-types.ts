/**
 * Concept Fit Analysis Type Definitions
 */

export interface ConceptFitInput {
  businessId: string;
  locationTypeId: string;  // From Step 1: primary location type
  locationScore: number;   // From Step 1: category score
  
  // Business data (from your existing tables)
  businessData: {
    // From business_operations
    openingHours: Record<string, { open: string; close: string; closed: boolean }>;
    servicePeriods?: any;
    priceLevel: string;  // Budget/Mid-range/Premium/Fine Dining
    establishmentType: string;
    hasTableService: boolean;
    hasTakeaway: boolean;
    hasDelivery: boolean;
    hasOutdoorSeating: boolean;
    seatingCapacityIndoor?: number;
    seatingCapacityOutdoor?: number;
    
    // From business_profile
    shortDescription?: string;
    longDescription?: string;
    targetAudience?: string;
    menuDescription?: string;
    
    // From business_brand_profile
    voiceStyle?: string;
    values?: string[];
    offerings?: any;
    
    // From business_menu_metadata
    hasSpecialtyCoffee?: boolean;
    hasWineList?: boolean;
    dietaryOptions?: string[];
  };
}

export interface ConceptFitOutput {
  businessId: string;
  locationTypeId: string;
  
  // Overall fit
  overall_fit_level: 'strong' | 'moderate' | 'challenging';
  overall_fit_score: number;  // 0.0 to 1.0
  overall_fit_confidence: number;  // 0.0 to 1.0
  
  // Factor-by-factor fits
  customer_fit: 'good' | 'moderate' | 'poor';
  motivation_fit: 'good' | 'moderate' | 'poor';
  pace_fit: 'good' | 'moderate' | 'poor';
  price_fit: 'good' | 'moderate' | 'poor';
  winning_angles_fit: 'good' | 'moderate' | 'poor';
  
  // Analysis details
  fit_reasons: string[];
  mismatch_reasons: string[];
  strengths: string[];
  weaknesses: string[];
  
  // Strategy
  strategy_approach: 'amplify' | 'adapt' | 'contrarian';
  emphasis: string[];
  avoid: string[];
}
