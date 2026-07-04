/**
 * Error Taxonomy & Logging System
 * 
 * Comprehensive error categorization for debugging and monitoring
 */

export enum ErrorCategory {
  // Data Issues
  DATA_MISSING = 'DATA_MISSING',           // Required data not found
  DATA_INVALID = 'DATA_INVALID',           // Data format/quality issues
  DATA_INSUFFICIENT = 'DATA_INSUFFICIENT', // Not enough data for generation
  
  // AI Issues
  AI_TIMEOUT = 'AI_TIMEOUT',               // OpenAI API timeout
  AI_RATE_LIMIT = 'AI_RATE_LIMIT',         // Rate limit hit
  AI_INVALID_RESPONSE = 'AI_INVALID_RESPONSE', // AI returned invalid format
  AI_INSTRUCTION_FAILURE = 'AI_INSTRUCTION_FAILURE', // AI didn't follow instructions
  
  // Validation Issues
  VALIDATION_STRUCTURAL = 'VALIDATION_STRUCTURAL',     // Missing required fields
  VALIDATION_CONTENT = 'VALIDATION_CONTENT',           // Content quality issues
  VALIDATION_LANGUAGE = 'VALIDATION_LANGUAGE',         // Language consistency issues
  VALIDATION_DIFFERENTIATION = 'VALIDATION_DIFFERENTIATION', // Not enough hooks
  
  // System Issues
  SYSTEM_DATABASE = 'SYSTEM_DATABASE',     // Database errors
  SYSTEM_NETWORK = 'SYSTEM_NETWORK',       // Network/connectivity issues
  SYSTEM_CONFIG = 'SYSTEM_CONFIG',         // Configuration problems
  
  // Locale Issues
  LOCALE_UNSUPPORTED = 'LOCALE_UNSUPPORTED', // Language/region not supported
  LOCALE_FALLBACK = 'LOCALE_FALLBACK',       // Using fallback locale
}

export enum ErrorSeverity {
  CRITICAL = 'CRITICAL',   // Generation failed completely
  HIGH = 'HIGH',           // Major issue, used fallback
  MEDIUM = 'MEDIUM',       // Minor issue, quality degraded
  LOW = 'LOW',             // Informational, no impact
}

export interface BrandProfileError {
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  context: Record<string, any>
  timestamp: number
  phase: 'data_gathering' | 'analysis' | 'generation' | 'validation' | 'persistence'
  businessId?: string
  requestId?: string
}

export class ErrorCollector {
  private errors: BrandProfileError[] = []
  
  constructor(
    private businessId?: string,
    private requestId?: string
  ) {}
  
  add(
    category: ErrorCategory,
    severity: ErrorSeverity,
    message: string,
    phase: BrandProfileError['phase'],
    context: Record<string, any> = {}
  ): void {
    this.errors.push({
      category,
      severity,
      message,
      context,
      timestamp: Date.now(),
      phase,
      businessId: this.businessId,
      requestId: this.requestId
    })
    
    // Log immediately for debugging
    const emoji = this.getSeverityEmoji(severity)
    console.error(`${emoji} [${phase}] ${category}: ${message}`, context)
  }
  
  private getSeverityEmoji(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL: return '🔴'
      case ErrorSeverity.HIGH: return '🟠'
      case ErrorSeverity.MEDIUM: return '🟡'
      case ErrorSeverity.LOW: return '🔵'
    }
  }
  
  getErrors(): BrandProfileError[] {
    return this.errors
  }
  
  hasCriticalErrors(): boolean {
    return this.errors.some(e => e.severity === ErrorSeverity.CRITICAL)
  }
  
  hasErrors(minSeverity: ErrorSeverity = ErrorSeverity.LOW): boolean {
    const severityOrder = [ErrorSeverity.LOW, ErrorSeverity.MEDIUM, ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]
    const minIndex = severityOrder.indexOf(minSeverity)
    return this.errors.some(e => severityOrder.indexOf(e.severity) >= minIndex)
  }
  
  getSummary(): string {
    if (this.errors.length === 0) return 'No errors'
    
    const bySeverity = {
      [ErrorSeverity.CRITICAL]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.LOW]: 0
    }
    
    this.errors.forEach(e => bySeverity[e.severity]++)
    
    return `Errors: ${bySeverity[ErrorSeverity.CRITICAL]} critical, ${bySeverity[ErrorSeverity.HIGH]} high, ${bySeverity[ErrorSeverity.MEDIUM]} medium, ${bySeverity[ErrorSeverity.LOW]} low`
  }
  
  /**
   * Compute quality status from error counts
   * - green: No errors
   * - yellow: Medium/low errors only
   * - red: Critical or high errors present
   */
  getQualityStatus(): 'green' | 'yellow' | 'red' {
    const bySeverity = {
      [ErrorSeverity.CRITICAL]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.LOW]: 0
    }
    
    this.errors.forEach(e => bySeverity[e.severity]++)
    
    if (bySeverity[ErrorSeverity.CRITICAL] > 0 || bySeverity[ErrorSeverity.HIGH] > 0) {
      return 'red'
    }
    if (bySeverity[ErrorSeverity.MEDIUM] > 0 || bySeverity[ErrorSeverity.LOW] > 0) {
      return 'yellow'
    }
    return 'green'
  }
  
  toJSON() {
    return {
      summary: this.getSummary(),
      errors: this.errors,
      hasCritical: this.hasCriticalErrors()
    }
  }
}
