/**
 * Constants for Menu Extraction System
 * Error codes, version info, and configuration
 */

// ============================================================================
// Version Information
// ============================================================================

export const PIPELINE_VERSION = '2.0.0';
export const SCHEMA_VERSION = '1.0.0';

// ============================================================================
// Error Codes - Retryable Errors
// ============================================================================

export enum RetryableError {
  NETWORK_TIMEOUT = 'ERR_NETWORK_TIMEOUT',
  DNS_FAILURE = 'ERR_DNS_FAILURE',
  BROWSER_CRASH = 'ERR_BROWSER_CRASH',
  SCRAPER_TIMEOUT = 'ERR_SCRAPER_TIMEOUT',
  HTTP_429_RATE_LIMIT = 'ERR_HTTP_429',
  HTTP_5XX_SERVER = 'ERR_HTTP_5XX',
  CLOUD_RUN_COLD_START = 'ERR_CLOUD_RUN_COLD_START',
  OPENAI_RATE_LIMIT = 'ERR_OPENAI_RATE_LIMIT',
  OPENAI_TIMEOUT = 'ERR_OPENAI_TIMEOUT',
}

// ============================================================================
// Error Codes - Permanent Errors
// ============================================================================

export enum PermanentError {
  SOURCE_NOT_FOUND = 'ERR_SOURCE_NOT_FOUND',           // 404
  SOURCE_FORBIDDEN = 'ERR_SOURCE_FORBIDDEN',           // 403
  SOURCE_LOGIN_REQUIRED = 'ERR_SOURCE_LOGIN_REQUIRED', // Auth wall
  SOURCE_PAYWALL = 'ERR_SOURCE_PAYWALL',               // Content locked
  SOURCE_REMOVED = 'ERR_SOURCE_REMOVED',               // Gone
  SOURCE_INVALID = 'ERR_SOURCE_INVALID',               // Malformed URL
  PDF_ENCRYPTED = 'ERR_PDF_ENCRYPTED',                 // Password-protected
  PDF_CORRUPT = 'ERR_PDF_CORRUPT',                     // Cannot parse
  NO_MENU_EXISTS = 'ERR_NO_MENU_EXISTS',               // Confirmed no menu
}

// ============================================================================
// Error Codes - Quality Warnings
// ============================================================================

export enum QualityWarning {
  WARN_NO_PRICES_FOUND = 'WARN_NO_PRICES',
  WARN_NO_CATEGORIES = 'WARN_NO_CATEGORIES',
  WARN_FEW_ITEMS = 'WARN_FEW_ITEMS',                   // <5 items
  WARN_NAVIGATION_DETECTED = 'WARN_NAVIGATION',        // Extracted nav instead of menu
  WARN_COOKIE_BANNER_TEXT = 'WARN_COOKIE_BANNER',      // Cookie text in result
  WARN_LOW_EVIDENCE = 'WARN_LOW_EVIDENCE',             // <50% evidence coverage
  WARN_MULTIPLE_CURRENCIES = 'WARN_MULTIPLE_CURRENCIES',
  WARN_PRICE_OUTLIERS = 'WARN_PRICE_OUTLIERS',         // Prices vary >10x
  WARN_DUPLICATE_PRICES = 'WARN_DUPLICATE_PRICES',     // Same price for all items
  WARN_CONFLICTING_DATA = 'WARN_CONFLICTING_DATA',     // Strategies disagree
  WARN_SAMPLE_MENU = 'WARN_SAMPLE_MENU',               // Page says "sample menu"
  WARN_SEASONAL_MENU = 'WARN_SEASONAL_MENU',           // May be outdated
  WARN_MIXED_SERVICE_PERIODS = 'WARN_MIXED_PERIODS',  // Breakfast + dinner mixed
}

// ============================================================================
// Error Codes - Strategy Errors
// ============================================================================

export enum StrategyError {
  STRATEGY_NOT_APPLICABLE = 'ERR_STRATEGY_NA',
  STRATEGY_INSUFFICIENT_DATA = 'ERR_STRATEGY_INSUFFICIENT',
  STRATEGY_PARSE_FAILED = 'ERR_STRATEGY_PARSE_FAILED',
  STRATEGY_TIMEOUT = 'ERR_STRATEGY_TIMEOUT',
}

// ============================================================================
// Hard Failure Codes
// ============================================================================

export enum HardFailure {
  HARD_FAIL_NO_ITEMS = 'HARD_FAIL_NO_ITEMS',
  HARD_FAIL_INVALID_NAMES = 'HARD_FAIL_INVALID_NAMES',
  HARD_FAIL_MISSING_NAMES = 'HARD_FAIL_MISSING_NAMES',
}

// ============================================================================
// Danish Market Patterns
// ============================================================================

export const DANISH_PRICE_PATTERNS = [
  /(\d+),(\d+)\s*kr\.?/i,      // '145,50 kr.'
  /(\d+)\s*kr\.?/i,             // '145 kr.'
  /(\d+),-/,                    // '145,-'
  /kr\.?\s*(\d+),?(\d+)?/i,     // 'kr. 145'
  /(\d+)\s*DKK/i,               // '145 DKK'
  /(\d+),(\d+)\s*DKK/i,         // '145,50 DKK'
];

export const QUANTITY_PATTERNS = [
  /(\d+)\s*cl/i,                // '25 cl'
  /(\d+)\s*ml/i,                // '250 ml'
  /(\d+)\s*g/i,                 // '200 g'
  /(\d+)\s*kg/i,                // '1 kg'
  /(\d+)\s*stk\.?/i,            // '2 stk.'
  /(\d+)\s*l/i,                 // '1 l'
];

export const DIETARY_LABEL_MAPPING: Record<string, string> = {
  'vegetar': 'vegetarian',
  'vegansk': 'vegan',
  'glutenfri': 'gluten-free',
  'laktosefri': 'lactose-free',
  'økologisk': 'organic',
  'halal': 'halal',
  'kosher': 'kosher',
};

export const SERVICE_PERIOD_MAPPING: Record<string, string> = {
  'morgenmad': 'breakfast',
  'frokost': 'lunch',
  'middag': 'dinner',
  'aften': 'dinner',
  'brunch': 'brunch',
  'eftermiddag': 'afternoon',
  'late night': 'late_night',
};

export const MENU_KEYWORDS_DANISH = [
  'menu',
  'menukort',
  'mad',
  'drikkevarer',
  'drinks',
  'food',
  'lunch',
  'frokost',
  'middag',
  'aften',
  'brunch',
  'cocktails',
  'vin',
  'wine',
  'se menu',
  'vis menu',
  'menuer',
];

export const NAVIGATION_KEYWORDS = [
  'home',
  'about',
  'contact',
  'booking',
  'reservation',
  'gallery',
  'hjem',
  'om',
  'kontakt',
  'om os',
  'galleri',
  'book',
  'reservér',
  'find us',
  'find vej',
];

// ============================================================================
// Quality Thresholds
// ============================================================================

export const QUALITY_THRESHOLDS = {
  AUTO_ACCEPT: 0.8,           // Automatic acceptance threshold
  PARTIAL_ACCEPT: 0.6,        // Partial acceptance threshold
  MIN_ACCEPTABLE: 0.4,        // Below this = manual review
  
  HIGH_EVIDENCE: 0.7,         // High evidence coverage
  LOW_EVIDENCE: 0.5,          // Low evidence warning threshold
  
  MIN_ITEM_COUNT: 5,          // Minimum items for auto-accept
  MAX_PRICE_OUTLIER_RATIO: 15, // Max/min price ratio before warning
  MAX_DUPLICATE_RATIO: 0.2,   // Max duplicate item ratio
  MAX_NAVIGATION_RATIO: 0.3,  // Max navigation keyword ratio
};

// ============================================================================
// Strategy Priority Order
// ============================================================================

export const STRATEGY_PRIORITY: Record<string, number> = {
  'structured_json': 1,        // Highest quality
  'pdf_text': 2,
  'provider_adapter': 3,
  'visual_screenshot': 4,
  'semantic_dom': 5,
  'network_json': 6,
  'generic_html': 7,           // Lowest quality
};

// ============================================================================
// Known Menu Providers
// ============================================================================

export interface MenuProvider {
  domain: string;
  name: string;
  confidence: number;
  apiPattern?: string;
}

export const KNOWN_MENU_PROVIDERS: MenuProvider[] = [
  { domain: 'menufy.com', name: 'Menufy', confidence: 0.9 },
  { domain: 'zenchef.com', name: 'Zenchef', confidence: 0.9 },
  { domain: 'resengo.com', name: 'Resengo', confidence: 0.9 },
  { domain: 'tablebooker.com', name: 'TableBooker', confidence: 0.9 },
  { domain: 'opentable.com', name: 'OpenTable', confidence: 0.85 },
  { domain: 'resy.com', name: 'Resy', confidence: 0.85 },
  { domain: 'toasttab.com', name: 'Toast', confidence: 0.85 },
];

// ============================================================================
// Configuration
// ============================================================================

export const CONFIG = {
  // Artifact storage
  ARTIFACT_RETENTION_DAYS: 90,
  ARTIFACT_BUCKET_NAME: 'menu-extraction-artifacts',
  COMPRESS_ARTIFACTS: true,
  
  // Extraction timeouts
  STRATEGY_TIMEOUT_MS: 30_000,
  TOTAL_EXTRACTION_TIMEOUT_MS: 120_000,
  
  // LLM settings
  LLM_MAX_TOKENS: 4000,
  LLM_TEMPERATURE: 0.1,
  LLM_MAX_INPUT_CHARS: 60_000,
  
  // Retry settings
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_MS: [1000, 5000, 15000],
  
  // Evidence settings
  MIN_EVIDENCE_EXCERPT_LENGTH: 20,
  MAX_EVIDENCE_EXCERPT_LENGTH: 200,
  
  // Quality calculation
  COMPLETENESS_WEIGHT: 0.35,
  EVIDENCE_WEIGHT: 0.25,
  STRUCTURAL_WEIGHT: 0.2,
  CONSISTENCY_WEIGHT: 0.2,
};

// ============================================================================
// Helper Functions
// ============================================================================

export function isRetryableError(errorCode: string): boolean {
  return Object.values(RetryableError).includes(errorCode as RetryableError);
}

export function isPermanentError(errorCode: string): boolean {
  return Object.values(PermanentError).includes(errorCode as PermanentError);
}

export function isQualityWarning(code: string): boolean {
  return Object.values(QualityWarning).includes(code as QualityWarning);
}

export function getRetryDelay(attemptNumber: number): number {
  const index = Math.min(attemptNumber - 1, CONFIG.RETRY_BACKOFF_MS.length - 1);
  return CONFIG.RETRY_BACKOFF_MS[index];
}

export function determineNextAction(errorCode: string): {
  action: 'retry' | 'fail_permanent' | 'review_manual' | 'try_next_strategy';
  delay?: number;
  maxRetries?: number;
} {
  if (isRetryableError(errorCode)) {
    return {
      action: 'retry',
      delay: getRetryDelay(1),
      maxRetries: CONFIG.MAX_RETRY_ATTEMPTS
    };
  }
  
  if (isPermanentError(errorCode)) {
    return {
      action: 'fail_permanent'
    };
  }
  
  if (isQualityWarning(errorCode)) {
    return {
      action: 'review_manual'
    };
  }
  
  // Strategy errors - try next strategy
  if (Object.values(StrategyError).includes(errorCode as StrategyError)) {
    return {
      action: 'try_next_strategy'
    };
  }
  
  // Unknown error - conservative approach
  return {
    action: 'review_manual'
  };
}
