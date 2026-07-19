/**
 * Core Types for Robust Menu Extraction System
 * Version: 2.0.0
 * Architecture: Source-first, evidence-based extraction
 */

// ============================================================================
// Source Types
// ============================================================================

export enum SourceType {
  HTML_INLINE = 'html_inline',           // Menu in page HTML
  HTML_NESTED = 'html_nested',           // Menu across multiple pages
  PDF_DIRECT = 'pdf_direct',             // Direct PDF link
  PDF_EMBEDDED = 'pdf_embedded',         // PDF in viewer/iframe
  IMAGE_GALLERY = 'image_gallery',       // Multiple menu images
  IMAGE_SINGLE = 'image_single',         // Single menu image
  JSON_EMBEDDED = 'json_embedded',       // JSON-LD or script tag
  JSON_API = 'json_api',                 // API response
  PROVIDER_IFRAME = 'provider_iframe',   // External provider widget
  UNKNOWN = 'unknown'
}

// ============================================================================
// Extraction Status
// ============================================================================

export type ExtractionStatus = 
  | 'queued'
  | 'discovering'
  | 'fetching'
  | 'rendering'
  | 'interacting'
  | 'extracting'
  | 'normalizing'
  | 'validating'
  | 'done'
  | 'partial'
  | 'manual_review_needed'
  | 'retryable_error'
  | 'permanent_error';

export type StrategyStatus = 
  | 'success'
  | 'partial'
  | 'no_menu_found'
  | 'failed';

// ============================================================================
// Evidence References
// ============================================================================

export type EvidenceType = 
  | 'dom_text'
  | 'dom_attribute'
  | 'pdf_text'
  | 'pdf_ocr'
  | 'image_ocr'
  | 'json_field'
  | 'api_response'
  | 'screenshot_region';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EvidenceReference {
  type: EvidenceType;
  
  // Source location
  artifactPath?: string;
  sourceUrl?: string;
  
  // Precise location within source
  domSelector?: string;
  jsonPath?: string;
  pdfPage?: number;
  boundingBox?: BoundingBox;
  
  textExcerpt: string;
  contentHash?: string;
}

// ============================================================================
// Platform & Provider Detection
// ============================================================================

export interface PlatformMetadata {
  platform: string;              // 'wordpress', 'umbraco', 'wix', etc.
  confidence: number;            // 0-1
  version?: string;
  isSPA: boolean;
  detectedFeatures: string[];
}

export interface PlatformHints {
  navigationTimeoutMs: number;
  contentStabilityPolicy: 'wait_for_idle' | 'wait_for_content' | 'fixed_timeout';
  
  likelyDataLocations: string[];
  interactionRecipes: InteractionRecipe[];
  knownNoiseSelectors: string[];
}

export interface InteractionRecipe {
  type: 'click' | 'scroll' | 'wait' | 'hover';
  selector?: string;
  waitMs?: number;
  scrollPixels?: number;
}

// ============================================================================
// Artifacts
// ============================================================================

export interface ArtifactReference {
  storagePath: string;
  sizeBytes: number;
  contentType: string;
  compressed: boolean;
  hash: string;
}

export interface ArtifactManifest {
  runId: string;
  businessId: string;
  sourceId: string;
  
  storagePrefix: string;
  
  artifacts: {
    initialHtml?: ArtifactReference;
    renderedHtml?: ArtifactReference;
    visibleText?: ArtifactReference;
    screenshotFull?: ArtifactReference;
    screenshotMenu?: ArtifactReference[];
    networkCaptures?: ArtifactReference;
    sourcePdf?: ArtifactReference;
    diagnostics?: ArtifactReference;
  };
  
  contentHashes: Record<string, string>;
  totalSizeBytes: number;
  capturedAt: string;
}

export interface NetworkCapture {
  url: string;
  method: string;
  status: number;
  contentType: string;
  responseBody?: any;
  requestHeaders?: Record<string, string>;
  timestamp: number;
}

// ============================================================================
// Menu Discovery (from v3 scraper)
// ============================================================================

export interface MenuDiscovery {
  structure: 'image_gallery' | 'direct_pdf' | 'nested_pages' | 'inline_html' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  extractionMethod?: 'ocr_required' | 'pdf_extract' | 'html_parse' | 'nested_crawl';
  reasoning?: string;
  assets?: {
    imageLinks?: Array<{ url: string; text: string; ariaLabel?: string }>;
    displayedImages?: Array<{ url: string; alt: string; width: number; height: number }>;
    pdfLinks?: Array<{ url: string; text: string } | string>; // Can be object or just URL string
  };
}

// ============================================================================
// Extraction Context
// ============================================================================

export interface ExtractionContext {
  sourceUrl: string;
  sourceType: SourceType;
  businessId: string;
  sourceId: string;
  runId: string;
  
  artifacts: {
    initialHtml?: string;
    renderedHtml?: string;
    visibleText?: string;
    screenshot?: Uint8Array;
    platformMetadata?: PlatformMetadata;
    networkResponses?: NetworkCapture[];
    menu_discovery?: MenuDiscovery[]; // v3 scraper menu discovery data for ImageOCR
  };
  
  hints?: PlatformHints;
  artifactStoragePrefix?: string;
}

// ============================================================================
// Quality Scoring
// ============================================================================

export interface ExtractionQuality {
  overallScore: number;  // 0-1
  
  // Coverage dimensions
  completenessScore: number;  // How complete is the extraction?
  evidenceScore: number;      // How much is backed by evidence?
  structuralScore: number;    // How well-structured is the result?
  consistencyScore: number;   // Are there contradictions?
  
  // Field-specific coverage
  itemNameCoverage: number;     // % items with names
  priceCoverage: number;        // % items with prices
  categoryCoverage: number;     // % items with categories
  descriptionCoverage: number;  // % items with descriptions
  
  warningCodes: string[];
  hardFailureCodes: string[];
}

// ============================================================================
// Normalized Menu Schema
// ============================================================================

export interface NormalizedMenu {
  title?: string;
  description?: string;
  language?: string;
  currency?: string;
  
  validFrom?: string;  // ISO date
  validTo?: string;    // ISO date
  
  servicePeriods?: ServicePeriod[];
  categories: MenuCategory[];
  
  sourceEvidence: EvidenceReference[];
}

export interface ServicePeriod {
  name: string;  // 'breakfast', 'lunch', 'dinner', 'brunch'
  description?: string;
  
  daysOfWeek?: string[];  // ['monday', 'tuesday', ...]
  startTime?: string;     // '11:00'
  endTime?: string;       // '15:00'
  
  sourceEvidence: EvidenceReference[];
}

export interface MenuCategory {
  id: string;  // Generated UUID
  name: string;
  description?: string;
  
  items: MenuItem[];
  
  sourceEvidence: EvidenceReference[];
}

export interface MenuItem {
  sourceItemId?: string;  // Original ID if available
  
  name: string;
  description?: string;
  
  categoryId?: string;
  subcategoryId?: string;
  
  prices: ItemPrice[];
  variants?: MenuVariant[];
  modifierGroups?: ModifierGroup[];
  
  // Dietary and allergen info
  dietaryLabels?: string[];        // ['vegetarian', 'vegan', 'gluten-free']
  allergensExplicit?: string[];    // Only if explicitly stated
  allergenCodesRaw?: string[];     // e.g., ['A', 'G'] if using legend
  ingredients?: string[];
  
  // Additional details
  alcoholVolumePercent?: number;
  servingSize?: string;            // '250 ml', '200 g'
  
  // Availability
  availability?: {
    days?: string[];
    startTime?: string;
    endTime?: string;
    servicePeriod?: string;
  };
  
  // Evidence and confidence
  sourceEvidence: EvidenceReference[];
  fieldConfidence?: Record<string, number>;  // Per-field confidence
}

export interface ItemPrice {
  amount?: number;       // Parsed numeric amount
  currency?: string;     // 'DKK', 'EUR'
  rawText: string;       // Original price string: '145,-' or '145 kr.'
  
  label?: string;        // 'lille', 'stor', '0.5L'
  quantity?: string;     // '25 cl', '500 ml'
  
  sourceEvidence?: EvidenceReference;
}

// Alias for backward compatibility
export type Price = ItemPrice;

export interface MenuVariant {
  name: string;                // 'Lille', 'Stor', 'Med ost'
  prices?: ItemPrice[];
  
  sourceEvidence?: EvidenceReference;
}

export interface ModifierGroup {
  name: string;                // 'Tilkøb', 'Ekstra'
  required?: boolean;
  
  minSelections?: number;
  maxSelections?: number;
  
  modifiers: Modifier[];
}

export interface Modifier {
  name: string;
  priceDelta?: number;         // +10 DKK
  
  sourceEvidence?: EvidenceReference;
}

// ============================================================================
// Menu Candidate
// ============================================================================

export interface MenuCandidate {
  menu: NormalizedMenu;
  strategy: string;
  quality: ExtractionQuality;
  validation?: ValidationResult;
}

// ============================================================================
// Extraction Results
// ============================================================================

export interface StrategyDiagnostics {
  strategy: string;
  version: string;
  durationMs: number;
  warningCodes: string[];
  errorCode?: string;
  errorMessage?: string;
}

export interface ExtractionResult {
  status: StrategyStatus;
  
  candidates: MenuCandidate[];
  evidence: EvidenceReference[];
  
  diagnostics: StrategyDiagnostics;
}

export interface StrategyAttempt {
  strategy: string;
  version: string;
  status: StrategyStatus;
  duration: number;
  candidateCount: number;
  diagnostics: StrategyDiagnostics;
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  hardFailures: string[];
}

export interface AgreementScore {
  score: number;
  details?: {
    nameAgreement?: number;
    priceAgreement?: number;
    categoryAgreement?: number;
  };
}

export interface AcceptanceDecision {
  status: ExtractionStatus;
  reason: string;
}

export interface ExtractionReconciliationResult {
  status: ExtractionStatus;
  menu?: NormalizedMenu;  // Optional when extraction fails
  quality?: ExtractionQuality;  // Optional when extraction fails
  validationResult: ValidationResult;
  agreementScore?: number;
}

export interface MenuExtractionResult extends ExtractionReconciliationResult {
  attempts: StrategyAttempt[];
  errorCode?: string;
}

// ============================================================================
// Strategy Interface
// ============================================================================

export interface IExtractionStrategy {
  readonly name: string;
  readonly version: string;
  
  canHandle(context: ExtractionContext): boolean;
  extract(context: ExtractionContext): Promise<ExtractionResult>;
}

// ============================================================================
// Source Discovery
// ============================================================================

export interface DiscoveredSource {
  url: string;
  type: SourceType;
  confidence: number;  // 0-1, how likely this is a menu
  rank: number;        // Priority order (lower = higher priority)
  
  metadata: {
    fileSize?: number;
    contentType?: string;
    linkText?: string;
    linkContext?: string;
    domPath?: string;
    
    qualityIndicators?: {
      isPDF: boolean;
      isImage: boolean;
      hasMenuKeywords: boolean;
      hasServicePeriod: boolean;
      isExternalProvider: boolean;
      foundInMainContent: boolean;
      linkTextRelevance: number;
    };
  };
  
  discovery: {
    discoveredAt: string;
    discoveryMethod: string;
    htmlSnapshot?: string;
  };
}

// ============================================================================
// Persistence (maps to existing database tables)
// ============================================================================

export interface MenuResultRow {
  id: string;
  business_id: string;
  source_id: string;
  source_kind?: 'url' | 'storage';  // Database constraint: defaults to 'url'
  source_url?: string | null;  // Required when source_kind = 'url'
  structured_data: NormalizedMenu;  // JSONB
  ai_summary?: string;
  service_periods?: string[];
  status: 'queued' | 'processing' | 'done' | 'error'; // Database constraint
  
  // Tracking metadata (new columns)
  platform_detected?: string;
  provider_detected?: string;
  strategy_used?: string;
  extraction_run_id?: string;
  artifact_storage_prefix?: string;
  quality_summary?: ExtractionQuality;
  extraction_attempts?: number;
  pipeline_version?: string;
  
  created_at: string;
  updated_at: string;
}

export interface MenuItemNormalizedRow {
  id: string;
  menu_result_id: string;
  item_name: string;
  item_price?: number;
  price_raw?: string;
  category_name?: string;
  description?: string;
  dietary_labels?: string[];
  allergens?: string[];
  service_period?: string;
  source_evidence?: string;  // JSON string of evidence
  created_at: string;
}

// ============================================================================
// Flattening Helper Types
// ============================================================================

export interface FlattenedMenuItem {
  menuResultId: string;
  itemName: string;
  itemPrice?: number;
  priceRaw?: string;
  categoryName: string;
  description?: string;
  dietaryLabels?: string[];
  allergens?: string[];
  servicePeriod?: string;
  sourceEvidence?: EvidenceReference[];
}
