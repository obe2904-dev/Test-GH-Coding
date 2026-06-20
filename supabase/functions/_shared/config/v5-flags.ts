// V5 Feature Flags - Centralized Control System
// Toggle V5 features without redeployment

/**
 * Feature Flag Configuration
 * Set via Supabase Dashboard → Settings → Edge Functions → Secrets
 */
export const V5_FLAGS = {
  // === GLOBAL CONTROLS ===
  
  /**
   * Master kill switch - disables ALL V5 features
   * Set to 'false' for emergency rollback
   */
  ENABLED: Deno.env.get('V5_ENABLED') === 'true',
  
  // === PHASE-SPECIFIC CONTROLS ===
  
  /**
   * Phase 1: Layer 3 (Identity Profile) integration
   * Uses brand_essence, positioning, core_values from business_brand_profile
   */
  LAYER3_ENABLED: Deno.env.get('V5_LAYER3_ENABLED') === 'true',
  
  /**
   * Phase 2: Layer 4 (Audience Segments) integration
   * Uses programme-specific segments from business_programme_profiles
   */
  LAYER4_ENABLED: Deno.env.get('V5_LAYER4_ENABLED') === 'true',
  
  /**
   * Phase 3: Content Quality Rules
   * Enforces brunch terminology, location consistency
   */
  QUALITY_RULES_ENABLED: Deno.env.get('V5_QUALITY_RULES_ENABLED') === 'true',
  
  /**
   * Phase 4: Evidence Validation
   * Validates claims against segment evidence
   */
  EVIDENCE_ENABLED: Deno.env.get('V5_EVIDENCE_ENABLED') === 'true',
  
  // === SAFETY CONTROLS ===
  
  /**
   * Limit V5 to specific test business(es)
   * When true, only TEST_BUSINESS_IDS get V5 features
   */
  TEST_BUSINESS_ONLY: Deno.env.get('V5_TEST_BUSINESS_ONLY') === 'true',
  
  /**
   * Test business ID(s) - comma separated
   * Default: Café Faust
   */
  TEST_BUSINESS_IDS: (Deno.env.get('V5_TEST_BUSINESS_IDS') || '2037d63c-a138-4247-89c5-5b6b8cef9f3f').split(','),
  
  // === LOGGING CONTROLS ===
  
  /**
   * Enable verbose debug logging
   * Logs V5 data fetches, segment matches, validation results
   */
  DEBUG_LOGGING: Deno.env.get('V5_DEBUG') === 'true',
  
  /**
   * Log V5 vs Legacy comparisons
   * Useful for measuring quality improvements
   */
  LOG_COMPARISONS: Deno.env.get('V5_LOG_COMPARISONS') === 'true',
  
  /**
   * Log evidence validation details
   * Shows which claims were validated against which evidence
   */
  LOG_EVIDENCE: Deno.env.get('V5_LOG_EVIDENCE') === 'true',
}

/**
 * Check if V5 is enabled for a specific business
 * 
 * @param businessId - Business UUID to check
 * @returns true if V5 features should be used for this business
 */
export function isV5EnabledForBusiness(businessId: string): boolean {
  // Global kill switch
  if (!V5_FLAGS.ENABLED) {
    return false
  }
  
  // Test business restriction
  if (V5_FLAGS.TEST_BUSINESS_ONLY) {
    return V5_FLAGS.TEST_BUSINESS_IDS.includes(businessId)
  }
  
  // All businesses get V5
  return true
}

/**
 * Log V5 events with consistent formatting
 * Only logs if DEBUG_LOGGING is enabled
 * 
 * @param phase - Which phase is logging (e.g., "layer3-fetch", "segment-match")
 * @param data - Data to log (will be JSON stringified)
 */
export function logV5(phase: string, data: any): void {
  if (!V5_FLAGS.DEBUG_LOGGING) return
  
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    phase: `V5-${phase.toUpperCase()}`,
    ...data
  }
  
  console.log(JSON.stringify(logEntry, null, 2))
}

/**
 * Log V5 vs Legacy comparison
 * Only logs if LOG_COMPARISONS is enabled
 * 
 * @param comparison - Object with v5 and legacy results
 */
export function logComparison(comparison: {
  businessId: string
  phase: string
  v5Result: any
  legacyResult: any
  metrics?: any
}): void {
  if (!V5_FLAGS.LOG_COMPARISONS) return
  
  console.log('[V5-COMPARISON]', JSON.stringify({
    timestamp: new Date().toISOString(),
    ...comparison
  }, null, 2))
}

/**
 * Log evidence validation
 * Only logs if LOG_EVIDENCE is enabled
 * 
 * @param validation - Validation details
 */
export function logEvidence(validation: {
  claim: string
  evidence: string[]
  result: boolean
  reason?: string
}): void {
  if (!V5_FLAGS.LOG_EVIDENCE) return
  
  console.log('[V5-EVIDENCE]', JSON.stringify({
    timestamp: new Date().toISOString(),
    ...validation
  }, null, 2))
}

/**
 * Get current V5 configuration summary
 * Useful for debugging and status checks
 */
export function getV5Status(): {
  enabled: boolean
  phases: {
    layer3: boolean
    layer4: boolean
    qualityRules: boolean
    evidence: boolean
  }
  safety: {
    testBusinessOnly: boolean
    testBusinessCount: number
  }
  logging: {
    debug: boolean
    comparisons: boolean
    evidence: boolean
  }
} {
  return {
    enabled: V5_FLAGS.ENABLED,
    phases: {
      layer3: V5_FLAGS.LAYER3_ENABLED,
      layer4: V5_FLAGS.LAYER4_ENABLED,
      qualityRules: V5_FLAGS.QUALITY_RULES_ENABLED,
      evidence: V5_FLAGS.EVIDENCE_ENABLED
    },
    safety: {
      testBusinessOnly: V5_FLAGS.TEST_BUSINESS_ONLY,
      testBusinessCount: V5_FLAGS.TEST_BUSINESS_IDS.length
    },
    logging: {
      debug: V5_FLAGS.DEBUG_LOGGING,
      comparisons: V5_FLAGS.LOG_COMPARISONS,
      evidence: V5_FLAGS.LOG_EVIDENCE
    }
  }
}

/**
 * Validate environment configuration
 * Call on function startup to ensure flags are set correctly
 */
export function validateV5Config(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []
  
  // Check for contradictory settings
  if (V5_FLAGS.LAYER4_ENABLED && !V5_FLAGS.LAYER3_ENABLED) {
    warnings.push('Layer 4 enabled but Layer 3 disabled - Layer 4 depends on Layer 3')
  }
  
  if (V5_FLAGS.EVIDENCE_ENABLED && !V5_FLAGS.LAYER4_ENABLED) {
    warnings.push('Evidence validation enabled but Layer 4 disabled - Evidence comes from Layer 4 segments')
  }
  
  // Check test business configuration
  if (V5_FLAGS.TEST_BUSINESS_ONLY && V5_FLAGS.TEST_BUSINESS_IDS.length === 0) {
    warnings.push('TEST_BUSINESS_ONLY enabled but no test business IDs configured')
  }
  
  // Warn if V5 enabled but no phases active
  if (V5_FLAGS.ENABLED && 
      !V5_FLAGS.LAYER3_ENABLED && 
      !V5_FLAGS.LAYER4_ENABLED && 
      !V5_FLAGS.QUALITY_RULES_ENABLED && 
      !V5_FLAGS.EVIDENCE_ENABLED) {
    warnings.push('V5 enabled but all phases disabled - no effect')
  }
  
  return {
    valid: warnings.length === 0,
    warnings
  }
}
