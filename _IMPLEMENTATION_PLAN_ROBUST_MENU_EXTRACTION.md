# Implementation Plan: Robust Menu Extraction System
**Status:** Planning Phase  
**Created:** 2026-07-18  
**Architecture Basis:** robust-menu-extraction-assessment.md  
**Target:** 90%+ extraction success rate across diverse F&B businesses

---

## Executive Summary

This plan implements a **source-first, evidence-based menu extraction system** that replaces the current platform-first approach. The architecture prioritizes finding the best menu representation (PDF, JSON, image) before deciding how to extract it.

### Core Architectural Shift

**FROM:**
```
URL → Detect platform → Apply platform strategy → Extract HTML → Hope for success
```

**TO:**
```
URL → Discover all sources → Rank by quality → Apply modality-appropriate extractors → 
Validate with evidence → Accept/Partial/Review
```

### Success Criteria

- ≥95% accessible-source handling
- ≥95% menu/non-menu classification precision
- ≥90% item recall on accepted extractions
- ≥98% item-name precision
- ≥97% price-pairing precision
- ≥95% evidence coverage for accepted fields
- <10% manual review rate after corpus maturity

---

## Phase 0: Foundation Assessment (2-3 hours)

**Goal:** Understand current system capabilities and establish baseline metrics.

### 0.1 Current System Audit

**Tasks:**
1. **Inventory existing extraction capabilities**
   - Document current success rate by CMS platform
   - Identify which menu types work today (inline HTML, PDF links)
   - Map current code flow: MenuPage → queue → extractMenuInternal → menu-extract-v2 → scraper

2. **Catalog existing infrastructure**
   - Cloud Run scraper capabilities (platform detection, hydration timeouts)
   - Supabase Edge Function constraints (memory, timeout, runtime)
   - Database schema (menu_sources, menu_results_v2, menu_items_normalized)
   - Artifact storage availability (Supabase Storage buckets)

3. **Analyze failure corpus**
   - Collect 20-30 failed extraction attempts
   - Categorize failure modes:
     - Source inaccessible
     - Menu not found
     - SPA content not rendered
     - PDF not extracted
     - Price-item pairing failed
     - Navigation content extracted as menu
   - Identify highest-impact failure categories

4. **Establish baseline metrics**
   - Current extraction success rate (overall)
   - Success by platform (WordPress, Umbraco, Wix, Webflow)
   - Success by menu type (inline HTML, PDF, image, nested pages)
   - Average extraction time
   - Manual review rate

**Deliverables:**
- `_BASELINE_METRICS.md` - Current performance data
- `_FAILURE_ANALYSIS.md` - Categorized failure examples
- `_INFRASTRUCTURE_INVENTORY.md` - Available tools and constraints

**Dependencies:** None

---

## Phase 1: Core Infrastructure (8-10 hours)

**Goal:** Build foundation for evidence-based, versioned extraction with artifact capture.

### 1.1 Strategy Interface & Versioning (2-3 hours)

**Technical Design:**

```typescript
// Core extraction contract
interface ExtractionStrategy {
  name: string;
  version: string;
  
  canHandle(context: ExtractionContext): boolean;
  
  extract(context: ExtractionContext): Promise<ExtractionResult>;
}

interface ExtractionContext {
  sourceUrl: string;
  sourceType: SourceType;  // 'html' | 'pdf' | 'image' | 'json' | 'api_response'
  businessId: string;
  sourceId: string;
  runId: string;
  
  // Artifacts available to strategy
  artifacts: {
    initialHtml?: string;
    renderedHtml?: string;
    visibleText?: string;
    screenshot?: Buffer;
    platformMetadata?: PlatformMetadata;
    networkResponses?: NetworkCapture[];
  };
  
  hints?: PlatformHints;
}

interface ExtractionResult {
  status: 'success' | 'partial' | 'no_menu_found' | 'failed';
  
  candidates: MenuCandidate[];
  evidence: EvidenceReference[];
  
  diagnostics: {
    strategy: string;
    version: string;
    durationMs: number;
    warningCodes: string[];
    errorCode?: string;
    errorMessage?: string;
  };
}

interface MenuCandidate {
  menu: NormalizedMenu;
  quality: ExtractionQuality;
  evidence: EvidenceReference[];
}

interface EvidenceReference {
  type: 'dom_text' | 'dom_attribute' | 'pdf_text' | 'pdf_ocr' | 
        'image_ocr' | 'json_field' | 'api_response' | 'screenshot_region';
  
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

interface ExtractionQuality {
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
```

**Implementation Tasks:**

1. **Create shared types package**
   - New directory: `src/lib/menu-extraction/`
   - Files: `types.ts`, `interfaces.ts`, `constants.ts`
   - Export all core interfaces
   - Define error code taxonomy (see Section 1.7)

2. **Create base strategy class**
   - File: `src/lib/menu-extraction/BaseStrategy.ts`
   - Implement common utilities:
     - Evidence capture helpers
     - Quality calculation framework
     - Diagnostic logging
     - Timeout handling

3. **Version tracking utilities**
   - Track pipeline version: `PIPELINE_VERSION = "2.0.0"`
   - Track strategy versions individually
   - Store versions in extraction_run and attempts

**Testing:**
- Verify type compilation
- Create mock strategy implementation
- Test evidence reference creation

**Deliverables:**
- `src/lib/menu-extraction/types.ts`
- `src/lib/menu-extraction/interfaces.ts`
- `src/lib/menu-extraction/BaseStrategy.ts`
- `src/lib/menu-extraction/constants.ts` (error codes, version)

---

### 1.2 Artifact Capture System (3-4 hours)

**Technical Design:**

```typescript
interface ArtifactManifest {
  runId: string;
  businessId: string;
  sourceId: string;
  
  storagePrefix: string;  // e.g., "menu-artifacts/ac838e1d-571a-4aeb"
  
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

interface ArtifactReference {
  storagePath: string;
  sizeBytes: number;
  contentType: string;
  compressed: boolean;
  hash: string;
}
```

**Infrastructure Setup:**

1. **Supabase Storage Bucket**
   - Create bucket: `menu-extraction-artifacts`
   - Set to private (not publicly accessible)
   - Configure retention policy (keep for 90 days, then delete)
   - Enable automatic compression for text files

2. **Capture utilities**
   - File: `src/lib/menu-extraction/ArtifactCapture.ts`
   - Functions:
     - `captureInitialHtml(html: string, runId: string)`
     - `captureRenderedHtml(html: string, runId: string)`
     - `captureScreenshot(buffer: Buffer, type: 'full' | 'menu', runId: string)`
     - `captureNetworkResponses(responses: any[], runId: string)`
     - `captureDiagnostics(data: object, runId: string)`
   - Auto-compress text/JSON with gzip
   - Generate content hashes (SHA-256)
   - Store in bucket with organized paths

3. **Replay utilities**
   - File: `src/lib/menu-extraction/ArtifactReplay.ts`
   - Functions:
     - `loadArtifacts(runId: string): Promise<ArtifactManifest>`
     - `replayExtraction(runId: string, strategyVersion?: string)`
   - Download artifacts from storage
   - Reconstruct extraction context
   - Run new strategy version against old artifacts

**Security Considerations:**

- Redact sensitive data before storage:
  - API keys in network responses
  - Auth tokens in headers
  - Personal data (emails, phone numbers)
  - Credit card patterns
- Implement access control (only authenticated users can access)
- Log all artifact access for audit trail

**Storage Cost Estimation:**

Per extraction:
- Initial HTML: ~50-200 KB (compressed)
- Rendered HTML: ~100-500 KB (compressed)
- Screenshot: ~200-500 KB (WebP format)
- Network captures: ~20-100 KB (compressed)
- **Total per extraction:** ~0.4-1.3 MB

For 1,000 businesses × 5 menus each = ~2-6.5 GB
At $0.021/GB/month = $0.04-0.14/month

**Implementation Tasks:**

1. Create Supabase Storage bucket via dashboard
2. Implement capture utilities with compression
3. Implement redaction patterns (regex for secrets)
4. Create artifact manifest generator
5. Build replay system
6. Test with large HTML files (>1MB)

**Deliverables:**
- Supabase bucket: `menu-extraction-artifacts`
- `src/lib/menu-extraction/ArtifactCapture.ts`
- `src/lib/menu-extraction/ArtifactReplay.ts`
- `src/lib/menu-extraction/SecurityRedaction.ts`

---

### 1.3 Database Schema Enhancement (2 hours)

**Design:** Two approaches available, start with backward-compatible additions.

**Approach A: Minimal (Start Here)**

Add columns to existing `menu_results_v2`:

```sql
-- Add tracking columns (all nullable for backward compatibility)
ALTER TABLE menu_results_v2 ADD COLUMN IF NOT EXISTS 
  platform_detected TEXT;

ALTER TABLE menu_results_v2 ADD COLUMN IF NOT EXISTS 
  provider_detected TEXT;

ALTER TABLE menu_results_v2 ADD COLUMN IF NOT EXISTS 
  strategy_used TEXT;

ALTER TABLE menu_results_v2 ADD COLUMN IF NOT EXISTS 
  extraction_run_id UUID;

ALTER TABLE menu_results_v2 ADD COLUMN IF NOT EXISTS 
  artifact_storage_prefix TEXT;

ALTER TABLE menu_results_v2 ADD COLUMN IF NOT EXISTS 
  quality_summary JSONB;

ALTER TABLE menu_results_v2 ADD COLUMN IF NOT EXISTS 
  extraction_attempts INTEGER DEFAULT 1;

ALTER TABLE menu_results_v2 ADD COLUMN IF NOT EXISTS 
  pipeline_version TEXT;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_menu_results_platform 
  ON menu_results_v2(platform_detected);

CREATE INDEX IF NOT EXISTS idx_menu_results_strategy 
  ON menu_results_v2(strategy_used);

CREATE INDEX IF NOT EXISTS idx_menu_results_run_id 
  ON menu_results_v2(extraction_run_id);
```

**Approach B: Comprehensive (Phase 3)**

Create dedicated operational tables:

```sql
-- Extraction runs (one per complete extraction job)
CREATE TABLE menu_extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES menu_sources(id),
  business_id UUID NOT NULL REFERENCES businesses(id),
  
  status TEXT NOT NULL,  -- 'discovering' | 'extracting' | 'done' | 'partial' | 'failed' | 'manual_review'
  
  source_type TEXT,  -- 'html' | 'pdf' | 'image' | 'json' | 'api_response'
  platform_detected TEXT,
  provider_detected TEXT,
  
  pipeline_version TEXT NOT NULL,
  
  artifact_storage_prefix TEXT,
  artifact_manifest JSONB,
  source_content_hash TEXT,
  
  final_quality_summary JSONB,
  
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_status CHECK (status IN (
    'queued', 'discovering', 'fetching', 'rendering', 'extracting',
    'normalizing', 'validating', 'partial', 'done', 
    'manual_review_needed', 'retryable_error', 'permanent_error'
  ))
);

-- Extraction attempts (one per strategy execution within a run)
CREATE TABLE menu_extraction_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES menu_extraction_runs(id) ON DELETE CASCADE,
  
  strategy_name TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,  -- Order of execution within run
  
  status TEXT NOT NULL,  -- 'success' | 'partial' | 'no_menu_found' | 'failed'
  
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  error_code TEXT,
  error_message TEXT,
  
  candidate_count INTEGER DEFAULT 0,
  quality_metrics JSONB,
  diagnostics JSONB,
  
  CONSTRAINT unique_run_sequence UNIQUE (run_id, sequence_number)
);

-- Evidence references (optional, for deep traceability)
CREATE TABLE menu_extraction_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES menu_extraction_runs(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES menu_extraction_attempts(id) ON DELETE CASCADE,
  
  evidence_type TEXT NOT NULL,
  artifact_path TEXT,
  source_url TEXT,
  
  -- Location details
  dom_selector TEXT,
  json_path TEXT,
  pdf_page INTEGER,
  bounding_box JSONB,
  
  text_excerpt TEXT,
  content_hash TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_extraction_runs_source ON menu_extraction_runs(source_id);
CREATE INDEX idx_extraction_runs_business ON menu_extraction_runs(business_id);
CREATE INDEX idx_extraction_runs_status ON menu_extraction_runs(status);
CREATE INDEX idx_extraction_runs_platform ON menu_extraction_runs(platform_detected);

CREATE INDEX idx_extraction_attempts_run ON menu_extraction_attempts(run_id);
CREATE INDEX idx_extraction_attempts_strategy ON menu_extraction_attempts(strategy_name);

CREATE INDEX idx_extraction_evidence_run ON menu_extraction_evidence(run_id);
```

**Migration Strategy:**

1. **Phase 1:** Add columns to `menu_results_v2` (non-breaking)
2. **Phase 3:** Create dedicated tables (when operational data proves value)
3. **Phase 5:** Migrate historical data if needed
4. **Phase 7:** Deprecate columns in favor of dedicated tables (optional)

**Implementation Tasks:**

1. Create migration file: `_add_extraction_tracking_columns.sql`
2. Test migration on staging database
3. Verify backward compatibility (existing queries still work)
4. Update TypeScript types to match new schema
5. Create convenience views for common queries

**Deliverables:**
- `_add_extraction_tracking_columns.sql`
- Updated database types in `src/types/supabase.ts`
- Optional: `_create_extraction_tracking_tables.sql` (for Phase 3)

---

### 1.4 Source Type Classification (1 hour)

**Goal:** Determine what kind of menu source we're dealing with before extraction.

**Classification Logic:**

```typescript
enum SourceType {
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

function classifySource(context: {
  url: string;
  html?: string;
  contentType?: string;
  assets?: MenuAsset[];
}): SourceType {
  // 1. Direct file type detection
  if (context.url.endsWith('.pdf') || context.contentType === 'application/pdf') {
    return SourceType.PDF_DIRECT;
  }
  
  if (context.url.match(/\.(jpg|jpeg|png|webp)$/i)) {
    return SourceType.IMAGE_SINGLE;
  }
  
  // 2. Content-based detection
  if (context.html) {
    // Check for JSON-LD
    if (context.html.includes('application/ld+json')) {
      return SourceType.JSON_EMBEDDED;
    }
    
    // Check for provider iframes
    if (context.html.match(/iframe.*?(menufy|zenchef|resengo|tablebooker)/i)) {
      return SourceType.PROVIDER_IFRAME;
    }
    
    // Check for PDF viewers
    if (context.html.match(/pdf-viewer|pdfobject|embed.*?application\/pdf/i)) {
      return SourceType.PDF_EMBEDDED;
    }
  }
  
  // 3. Asset-based detection
  if (context.assets) {
    const pdfCount = context.assets.filter(a => a.type === 'pdf').length;
    const imageCount = context.assets.filter(a => a.type === 'image').length;
    
    if (pdfCount > 0 && imageCount < 3) {
      return SourceType.PDF_DIRECT;
    }
    
    if (imageCount >= 3) {
      return SourceType.IMAGE_GALLERY;
    }
    
    if (imageCount === 1) {
      return SourceType.IMAGE_SINGLE;
    }
  }
  
  // 4. Default to HTML inline
  return SourceType.HTML_INLINE;
}
```

**Implementation Tasks:**

1. Create `src/lib/menu-extraction/SourceClassifier.ts`
2. Integrate with existing `menu-discovery.js` output
3. Store classification in `menu_sources` table
4. Use classification to select appropriate strategies

**Deliverables:**
- `src/lib/menu-extraction/SourceClassifier.ts`
- Tests for classification logic

---

### 1.5 Error Code Taxonomy (1 hour)

**Goal:** Standardized error codes for consistent handling and reporting.

**Error Categories:**

```typescript
// Transient/Retryable Errors (retry with exponential backoff)
enum RetryableError {
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

// Permanent Errors (do not retry, mark as failed)
enum PermanentError {
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

// Extraction Quality Issues (send to manual review)
enum QualityWarning {
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

// Strategy-specific issues
enum StrategyError {
  STRATEGY_NOT_APPLICABLE = 'ERR_STRATEGY_NA',
  STRATEGY_INSUFFICIENT_DATA = 'ERR_STRATEGY_INSUFFICIENT',
  STRATEGY_PARSE_FAILED = 'ERR_STRATEGY_PARSE_FAILED',
  STRATEGY_TIMEOUT = 'ERR_STRATEGY_TIMEOUT',
}
```

**Handling Logic:**

```typescript
function determineNextAction(errorCode: string): NextAction {
  if (Object.values(RetryableError).includes(errorCode as any)) {
    return {
      action: 'retry',
      delay: calculateBackoff(attemptNumber),
      maxRetries: 3
    };
  }
  
  if (Object.values(PermanentError).includes(errorCode as any)) {
    return {
      action: 'fail_permanent',
      status: 'permanent_error'
    };
  }
  
  if (Object.values(QualityWarning).includes(errorCode as any)) {
    return {
      action: 'review_manual',
      status: 'manual_review_needed'
    };
  }
  
  if (Object.values(StrategyError).includes(errorCode as any)) {
    return {
      action: 'try_next_strategy',
      cascadeToNext: true
    };
  }
  
  // Unknown error - conservative approach
  return {
    action: 'review_manual',
    status: 'manual_review_needed'
  };
}
```

**Implementation Tasks:**

1. Create `src/lib/menu-extraction/ErrorCodes.ts`
2. Create error handling utilities
3. Document each error code with examples
4. Integrate with strategy interface
5. Add error code to diagnostics

**Deliverables:**
- `src/lib/menu-extraction/ErrorCodes.ts`
- `src/lib/menu-extraction/ErrorHandler.ts`
- Error code documentation

---

### 1.6 Quality Scoring Framework (1-2 hours)

**Goal:** Centralized quality calculation that all strategies use.

**Design:**

```typescript
interface QualityScorer {
  calculateQuality(candidate: MenuCandidate, context: ScoringContext): ExtractionQuality;
}

interface ScoringContext {
  itemCount: number;
  sourceType: SourceType;
  expectedCategories?: string[];
  otherCandidates?: MenuCandidate[];  // For cross-strategy comparison
}

class StandardQualityScorer implements QualityScorer {
  calculateQuality(candidate: MenuCandidate, context: ScoringContext): ExtractionQuality {
    const menu = candidate.menu;
    const items = this.getAllItems(menu);
    
    // 1. Coverage scores
    const itemNameCoverage = items.filter(i => i.name).length / items.length;
    const priceCoverage = items.filter(i => i.prices.length > 0).length / items.length;
    const categoryCoverage = items.filter(i => i.categoryId).length / items.length;
    const descriptionCoverage = items.filter(i => i.description).length / items.length;
    
    // 2. Evidence score
    const itemsWithEvidence = items.filter(i => 
      i.sourceEvidence && i.sourceEvidence.length > 0
    ).length;
    const evidenceScore = itemsWithEvidence / items.length;
    
    // 3. Completeness score (weighted average of coverage)
    const completenessScore = (
      itemNameCoverage * 0.4 +      // Names are critical
      priceCoverage * 0.3 +          // Prices are very important
      categoryCoverage * 0.2 +       // Categories are helpful
      descriptionCoverage * 0.1      // Descriptions are nice-to-have
    );
    
    // 4. Structural score (menu organization quality)
    const structuralScore = this.calculateStructuralScore(menu);
    
    // 5. Consistency score (internal contradictions)
    const consistencyScore = this.calculateConsistencyScore(menu, items);
    
    // 6. Overall score (weighted combination)
    const overallScore = (
      completenessScore * 0.35 +
      evidenceScore * 0.25 +
      structuralScore * 0.2 +
      consistencyScore * 0.2
    );
    
    // 7. Warnings and failures
    const warnings = this.detectWarnings(menu, items, context);
    const hardFailures = this.detectHardFailures(menu, items);
    
    return {
      overallScore,
      completenessScore,
      evidenceScore,
      structuralScore,
      consistencyScore,
      itemNameCoverage,
      priceCoverage,
      categoryCoverage,
      descriptionCoverage,
      warningCodes: warnings,
      hardFailureCodes: hardFailures
    };
  }
  
  private calculateStructuralScore(menu: NormalizedMenu): number {
    let score = 1.0;
    
    // Penalize if no categories
    if (!menu.categories || menu.categories.length === 0) {
      score -= 0.3;
    }
    
    // Penalize if categories are imbalanced
    if (menu.categories) {
      const itemCounts = menu.categories.map(c => c.items.length);
      const max = Math.max(...itemCounts);
      const min = Math.min(...itemCounts);
      if (max > min * 10) {  // One category has 10x more items
        score -= 0.2;
      }
    }
    
    // Bonus if service periods are defined
    if (menu.servicePeriods && menu.servicePeriods.length > 0) {
      score += 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  private calculateConsistencyScore(menu: NormalizedMenu, items: MenuItem[]): number {
    let score = 1.0;
    
    // Check for price inconsistencies
    const prices = items.flatMap(i => i.prices.map(p => p.amount)).filter(Boolean);
    if (prices.length > 0) {
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      
      // Flag if max > min * 20 (e.g., 5 DKK and 500 DKK - likely error)
      if (maxPrice > minPrice * 20) {
        score -= 0.2;
      }
      
      // Check if all prices are identical (likely extraction error)
      const uniquePrices = new Set(prices);
      if (uniquePrices.size === 1 && items.length > 5) {
        score -= 0.4;
      }
    }
    
    // Check for multiple currencies
    const currencies = items.flatMap(i => i.prices.map(p => p.currency)).filter(Boolean);
    const uniqueCurrencies = new Set(currencies);
    if (uniqueCurrencies.size > 1) {
      score -= 0.15;
    }
    
    // Check for duplicate items
    const itemNames = items.map(i => i.name.toLowerCase().trim());
    const duplicates = itemNames.filter((name, index) => 
      itemNames.indexOf(name) !== index
    );
    if (duplicates.length > 0) {
      score -= 0.1 * (duplicates.length / items.length);
    }
    
    return Math.max(0, score);
  }
  
  private detectWarnings(menu: NormalizedMenu, items: MenuItem[], context: ScoringContext): string[] {
    const warnings: string[] = [];
    
    // Low item count
    if (items.length < 5) {
      warnings.push(QualityWarning.WARN_FEW_ITEMS);
    }
    
    // Low price coverage
    const priceCoverage = items.filter(i => i.prices.length > 0).length / items.length;
    if (priceCoverage < 0.5) {
      warnings.push(QualityWarning.WARN_NO_PRICES_FOUND);
    }
    
    // No categories
    if (!menu.categories || menu.categories.length === 0) {
      warnings.push(QualityWarning.WARN_NO_CATEGORIES);
    }
    
    // Evidence coverage too low
    const itemsWithEvidence = items.filter(i => 
      i.sourceEvidence && i.sourceEvidence.length > 0
    ).length;
    if (itemsWithEvidence / items.length < 0.5) {
      warnings.push(QualityWarning.WARN_LOW_EVIDENCE);
    }
    
    // Multiple currencies
    const currencies = items.flatMap(i => i.prices.map(p => p.currency)).filter(Boolean);
    if (new Set(currencies).size > 1) {
      warnings.push(QualityWarning.WARN_MULTIPLE_CURRENCIES);
    }
    
    // Price outliers
    const prices = items.flatMap(i => i.prices.map(p => p.amount)).filter(Boolean);
    if (prices.length > 0) {
      const max = Math.max(...prices);
      const min = Math.min(...prices);
      if (max > min * 15) {
        warnings.push(QualityWarning.WARN_PRICE_OUTLIERS);
      }
    }
    
    // Navigation-like content
    const navigationKeywords = ['home', 'about', 'contact', 'booking', 'reservation', 'gallery'];
    const navigationCount = items.filter(i => 
      navigationKeywords.some(kw => i.name.toLowerCase().includes(kw))
    ).length;
    if (navigationCount > items.length * 0.3) {
      warnings.push(QualityWarning.WARN_NAVIGATION_DETECTED);
    }
    
    return warnings;
  }
  
  private detectHardFailures(menu: NormalizedMenu, items: MenuItem[]): string[] {
    const failures: string[] = [];
    
    // No items at all
    if (items.length === 0) {
      failures.push('HARD_FAIL_NO_ITEMS');
    }
    
    // All item names are very short (likely extraction error)
    const avgNameLength = items.reduce((sum, i) => sum + i.name.length, 0) / items.length;
    if (avgNameLength < 3) {
      failures.push('HARD_FAIL_INVALID_NAMES');
    }
    
    // More than 50% of items have no name
    const itemsWithoutName = items.filter(i => !i.name || i.name.trim().length === 0).length;
    if (itemsWithoutName > items.length * 0.5) {
      failures.push('HARD_FAIL_MISSING_NAMES');
    }
    
    return failures;
  }
  
  private getAllItems(menu: NormalizedMenu): MenuItem[] {
    return menu.categories.flatMap(c => c.items);
  }
}
```

**Implementation Tasks:**

1. Create `src/lib/menu-extraction/QualityScorer.ts`
2. Implement `StandardQualityScorer`
3. Create unit tests with sample menus
4. Document scoring algorithm
5. Integrate with strategy interface

**Deliverables:**
- `src/lib/menu-extraction/QualityScorer.ts`
- Unit tests with known-good and known-bad samples
- Documentation of scoring algorithm

---

### 1.7 Normalized Menu Schema (1 hour)

**Goal:** Rich schema that captures all menu details with evidence.

**Schema Implementation:**

```typescript
interface NormalizedMenu {
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

interface ServicePeriod {
  name: string;  // 'breakfast', 'lunch', 'dinner', 'brunch'
  description?: string;
  
  daysOfWeek?: string[];  // ['monday', 'tuesday', ...]
  startTime?: string;     // '11:00'
  endTime?: string;       // '15:00'
  
  sourceEvidence: EvidenceReference[];
}

interface MenuCategory {
  id: string;  // Generated UUID
  name: string;
  description?: string;
  
  items: MenuItem[];
  
  sourceEvidence: EvidenceReference[];
}

interface MenuItem {
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

interface ItemPrice {
  amount?: number;       // Parsed numeric amount
  currency?: string;     // 'DKK', 'EUR'
  rawText: string;       // Original price string: '145,-' or '145 kr.'
  
  label?: string;        // 'lille', 'stor', '0.5L'
  quantity?: string;     // '25 cl', '500 ml'
  
  sourceEvidence?: EvidenceReference;
}

interface MenuVariant {
  name: string;                // 'Lille', 'Stor', 'Med ost'
  prices?: ItemPrice[];
  
  sourceEvidence?: EvidenceReference;
}

interface ModifierGroup {
  name: string;                // 'Tilkøb', 'Ekstra'
  required?: boolean;
  
  minSelections?: number;
  maxSelections?: number;
  
  modifiers: Modifier[];
}

interface Modifier {
  name: string;
  priceDelta?: number;         // +10 DKK
  
  sourceEvidence?: EvidenceReference;
}
```

**Danish Market Patterns:**

```typescript
// Price normalization
const danishPricePatterns = [
  /(\d+),(\d+)\s*kr\.?/i,      // '145,50 kr.'
  /(\d+)\s*kr\.?/i,             // '145 kr.'
  /(\d+),-/,                    // '145,-'
  /kr\.?\s*(\d+),?(\d+)?/i,     // 'kr. 145'
  /(\d+)\s*DKK/i,               // '145 DKK'
];

// Quantity patterns
const quantityPatterns = [
  /(\d+)\s*cl/i,                // '25 cl'
  /(\d+)\s*ml/i,                // '250 ml'
  /(\d+)\s*g/i,                 // '200 g'
  /(\d+)\s*stk\.?/i,            // '2 stk.'
];

// Dietary label mapping
const dietaryLabels = {
  'vegetar': 'vegetarian',
  'vegansk': 'vegan',
  'glutenfri': 'gluten-free',
  'laktosefri': 'lactose-free',
  'økologisk': 'organic'
};

// Service period mapping
const servicePeriods = {
  'morgenmad': 'breakfast',
  'frokost': 'lunch',
  'middag': 'dinner',
  'aften': 'dinner',
  'brunch': 'brunch',
  'eftermiddag': 'afternoon'
};
```

**Implementation Tasks:**

1. Create `src/lib/menu-extraction/NormalizedSchema.ts`
2. Create `src/lib/menu-extraction/DanishNormalizer.ts`
3. Implement price parsing utilities
4. Implement quantity parsing utilities
5. Create schema validation functions

**Deliverables:**
- `src/lib/menu-extraction/NormalizedSchema.ts`
- `src/lib/menu-extraction/DanishNormalizer.ts`
- Price/quantity parsing utilities
- Schema validation functions

---

## Phase 1 Summary

**Total Effort:** 8-10 hours

**Deliverables:**
- ✅ Versioned strategy interface
- ✅ Evidence reference model
- ✅ Artifact capture and storage system
- ✅ Database schema enhancements
- ✅ Source type classification
- ✅ Error code taxonomy
- ✅ Quality scoring framework
- ✅ Rich normalized menu schema with Danish patterns

**Ready for Phase 2:** Source discovery and ranking

---

## Phase 2: Source Discovery & Ranking (6-8 hours)

**Goal:** Find all potential menu sources before attempting extraction. Prioritize best sources first.

### 2.1 Source Discovery Engine (3-4 hours)

**Design:** "Tier 0" - Find all menu representations on a page.

**Discovery Categories:**

```typescript
interface DiscoveredSource {
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
    
    quality Indicators?: {
      isPDF: boolean;
      isImage: boolean;
      hasMenuKeywords: boolean;
      hasServicePeriod: boolean;  // 'lunch', 'dinner', etc.
      isExternalProvider: boolean;
      foundInMainContent: boolean;
      linkTextRelevance: number;
    };
  };
  
  discovery: {
    discoveredAt: string;
    discoveryMethod: string;  // 'pdf_link', 'json_ld', 'image_srcset', 'iframe'
    htmlSnapshot?: string;    // Relevant HTML fragment
  };
}
```

**Discovery Methods:**

1. **PDF Links**
```typescript
function discoverPDFLinks(html: string, baseUrl: string): DiscoveredSource[] {
  const sources: DiscoveredSource[] = [];
  const $ = cheerio.load(html);
  
  // Direct PDF links
  $('a[href$=".pdf"], a[href*=".pdf?"]').each((i, elem) => {
    const href = $(elem).attr('href');
    const text = $(elem).text().trim();
    const context = $(elem).parent().text().trim();
    
    // Check if menu-related
    const isMenuRelated = /menu|frokost|middag|aften|kort|mad|drikkevarer|drinks|food/i.test(
      text + ' ' + context
    );
    
    if (isMenuRelated) {
      sources.push({
        url: new URL(href, baseUrl).href,
        type: SourceType.PDF_DIRECT,
        confidence: 0.9,  // PDFs are high quality
        rank: 1,          // Prioritize PDFs
        metadata: {
          linkText: text,
          linkContext: context
        },
        discovery: {
          discoveredAt: new Date().toISOString(),
          discoveryMethod: 'pdf_link'
        }
      });
    }
  });
  
  return sources;
}
```

2. **Image Links**
```typescript
function discoverImageMenus(html: string, baseUrl: string): DiscoveredSource[] {
  const sources: DiscoveredSource[] = [];
  const $ = cheerio.load(html);
  
  // Check for image galleries
  const imageContainers = $('[class*="gallery"], [class*="menu"], [id*="menu"]');
  
  imageContainers.each((i, container) => {
    const images = $(container).find('img');
    
    if (images.length >= 2) {
      // Multiple images = likely gallery
      images.each((j, img) => {
        const src = $(img).attr('src') || $(img).attr('data-src');
        const srcset = $(img).attr('srcset');
        const alt = $(img).attr('alt') || '';
        
        // Get highest resolution from srcset
        const imageSrc = srcset ? parseHighestResSrcset(srcset) : src;
        
        if (imageSrc && /menu|kort|frokost|middag/i.test(alt)) {
          sources.push({
            url: new URL(imageSrc, baseUrl).href,
            type: SourceType.IMAGE_GALLERY,
            confidence: 0.7,
            rank: 3,
            metadata: {
              linkText: alt,
              contentType: 'image/jpeg'
            },
            discovery: {
              discoveredAt: new Date().toISOString(),
              discoveryMethod: 'image_gallery'
            }
          });
        }
      });
    }
  });
  
  return sources;
}
```

3. **Embedded JSON**
```typescript
function discoverEmbeddedJSON(html: string, baseUrl: string): DiscoveredSource[] {
  const sources: DiscoveredSource[] = [];
  const $ = cheerio.load(html);
  
  // JSON-LD
  $('script[type="application/ld+json"]').each((i, elem) => {
    try {
      const json = JSON.parse($(elem).html() || '');
      
      // Check if menu-related
      if (json['@type'] === 'Menu' || json['@type'] === 'FoodEstablishment') {
        if (json.hasMenu || json.menu) {
          sources.push({
            url: baseUrl,
            type: SourceType.JSON_EMBEDDED,
            confidence: 0.95,  // Structured data is very high quality
            rank: 1,
            metadata: {
              contentType: 'application/ld+json'
            },
            discovery: {
              discoveredAt: new Date().toISOString(),
              discoveryMethod: 'json_ld',
              htmlSnapshot: $(elem).html() || ''
            }
          });
        }
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  });
  
  // Next.js __NEXT_DATA__
  $('#__NEXT_DATA__').each((i, elem) => {
    try {
      const json = JSON.parse($(elem).html() || '');
      
      // Traverse props to find menu data
      const hasMenuData = JSON.stringify(json).match(/menu|dish|item|price/gi);
      
      if (hasMenuData && hasMenuData.length > 10) {
        sources.push({
          url: baseUrl,
          type: SourceType.JSON_EMBEDDED,
          confidence: 0.8,
          rank: 2,
          metadata: {
            contentType: 'application/json'
          },
          discovery: {
            discoveredAt: new Date().toISOString(),
            discoveryMethod: 'nextjs_data'
          }
        });
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  });
  
  return sources;
}
```

4. **External Provider Detection**
```typescript
function discoverExternalProviders(html: string, baseUrl: string): DiscoveredSource[] {
  const sources: DiscoveredSource[] = [];
  const $ = cheerio.load(html);
  
  const providers = [
    { domain: 'menufy.com', name: 'Menufy', confidence: 0.9 },
    { domain: 'zenchef.com', name: 'Zenchef', confidence: 0.9 },
    { domain: 'resengo.com', name: 'Resengo', confidence: 0.9 },
    { domain: 'tablebooker.com', name: 'TableBooker', confidence: 0.9 },
    { domain: 'opentable.com', name: 'OpenTable', confidence: 0.85 }
  ];
  
  // Check iframes
  $('iframe').each((i, elem) => {
    const src = $(elem).attr('src');
    
    if (src) {
      for (const provider of providers) {
        if (src.includes(provider.domain)) {
          sources.push({
            url: src,
            type: SourceType.PROVIDER_IFRAME,
            confidence: provider.confidence,
            rank: 2,
            metadata: {
              linkText: provider.name
            },
            discovery: {
              discoveredAt: new Date().toISOString(),
              discoveryMethod: 'provider_iframe'
            }
          });
        }
      }
    }
  });
  
  // Check direct links to providers
  $('a').each((i, elem) => {
    const href = $(elem).attr('href');
    
    if (href) {
      for (const provider of providers) {
        if (href.includes(provider.domain)) {
          sources.push({
            url: href,
            type: SourceType.PROVIDER_IFRAME,
            confidence: provider.confidence - 0.1,  // Links slightly lower than iframes
            rank: 3,
            metadata: {
              linkText: $(elem).text().trim()
            },
            discovery: {
              discoveredAt: new Date().toISOString(),
              discoveryMethod: 'provider_link'
            }
          });
        }
      }
    }
  });
  
  return sources;
}
```

5. **Inline HTML Detection**
```typescript
function discoverInlineMenu(html: string, baseUrl: string): DiscoveredSource[] {
  const $ = cheerio.load(html);
  
  // Look for menu-like structures
  const menuIndicators = [
    $('[class*="menu"]'),
    $('[id*="menu"]'),
    $('[class*="food"]'),
    $('[class*="drinks"]'),
    $('article:contains("menu")'),
    $('.dishes'),
    $('.menu-items')
  ];
  
  let totalMenuContent = 0;
  let priceCount = 0;
  
  menuIndicators.forEach(elements => {
    elements.each((i, elem) => {
      const text = $(elem).text();
      totalMenuContent += text.length;
      
      // Count prices
      const prices = text.match(/\d+\s*kr\.?|,\d+|-DKK/gi);
      if (prices) priceCount += prices.length;
    });
  });
  
  // If substantial menu content found
  if (totalMenuContent > 500 && priceCount > 5) {
    return [{
      url: baseUrl,
      type: SourceType.HTML_INLINE,
      confidence: 0.7,
      rank: 4,  // Lower priority than PDFs and structured data
      metadata: {
        contentType: 'text/html',
        linkText: 'Inline HTML menu'
      },
      discovery: {
        discoveredAt: new Date().toISOString(),
        discoveryMethod: 'inline_html_analysis'
      }
    }];
  }
  
  return [];
}
```

**Master Discovery Function:**

```typescript
async function discoverAllSources(
  url: string,
  html: string
): Promise<DiscoveredSource[]> {
  const sources: DiscoveredSource[] = [];
  
  // Run all discovery methods
  sources.push(...discoverPDFLinks(html, url));
  sources.push(...discoverImageMenus(html, url));
  sources.push(...discoverEmbeddedJSON(html, url));
  sources.push(...discoverExternalProviders(html, url));
  sources.push(...discoverInlineMenu(html, url));
  
  // Deduplicate by URL
  const unique = deduplicateSources(sources);
  
  // Rank sources
  const ranked = rankSources(unique);
  
  return ranked;
}
```

**Implementation Tasks:**

1. Create `src/lib/menu-extraction/SourceDiscovery.ts`
2. Implement each discovery method
3. Integrate with Cloud Run scraper as Phase 1a
4. Store discovered sources in `menu_sources` table
5. Test with diverse websites (WordPress, Umbraco, Wix, custom)

**Deliverables:**
- `src/lib/menu-extraction/SourceDiscovery.ts`
- Updated Cloud Run scraper with discovery phase
- Tests with 10+ diverse websites

---

### 2.2 Source Ranking Algorithm (2 hours)

**Goal:** Prioritize highest-quality sources to extract first.

**Ranking Factors:**

```typescript
interface RankingFactors {
  // Quality indicators
  isStructuredData: boolean;      // JSON-LD, schema.org
  isPDF: boolean;                 // Native document
  isImage: boolean;
  isHTML: boolean;
  
  // Relevance indicators
  hasMenuKeywords: boolean;       // 'menu', 'frokost', etc.
  hasServicePeriod: boolean;      // 'lunch', 'dinner'
  linkTextRelevance: number;      // 0-1
  
  // Location indicators
  foundInMainContent: boolean;    // vs sidebar/footer
  domDepth: number;               // Shallower = more prominent
  
  // External indicators
  isExternalProvider: boolean;    // Known menu provider
  fileSize?: number;              // Larger PDFs likely more complete
}

function calculateRankScore(source: DiscoveredSource): number {
  let score = 0;
  
  // Base score by type
  if (source.type === SourceType.JSON_EMBEDDED) score += 100;
  if (source.type === SourceType.PDF_DIRECT) score += 95;
  if (source.type === SourceType.PROVIDER_IFRAME) score += 90;
  if (source.type === SourceType.IMAGE_GALLERY) score += 70;
  if (source.type === SourceType.HTML_INLINE) score += 60;
  
  // Confidence boost
  score += source.confidence * 20;
  
  // Keyword relevance
  const text = source.metadata.linkText || '';
  const context = source.metadata.linkContext || '';
  const combined = text + ' ' + context;
  
  if (/^(menu|menukort|mad|drikkevarer)$/i.test(text)) score += 15;  // Exact match
  if (/menu|menukort/i.test(combined)) score += 10;
  if (/frokost|lunch/i.test(combined)) score += 8;
  if (/middag|dinner|aften/i.test(combined)) score += 8;
  if (/drikkevarer|drinks|cocktails/i.test(combined)) score += 7;
  
  // PDF file size (larger = more likely complete menu)
  if (source.type === SourceType.PDF_DIRECT && source.metadata.fileSize) {
    if (source.metadata.fileSize > 500_000) score += 10;  // > 500 KB
    if (source.metadata.fileSize > 1_000_000) score += 5; // > 1 MB
  }
  
  // Main content location
  if (source.metadata.qualityIndicators?.foundInMainContent) {
    score += 10;
  }
  
  return score;
}

function rankSources(sources: DiscoveredSource[]): DiscoveredSource[] {
  // Calculate scores
  const scored = sources.map(source => ({
    source,
    score: calculateRankScore(source)
  }));
  
  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score);
  
  // Assign rank
  return scored.map((item, index) => ({
    ...item.source,
    rank: index + 1
  }));
}
```

**Implementation Tasks:**

1. Create `src/lib/menu-extraction/SourceRanking.ts`
2. Implement ranking algorithm
3. Test ranking with known-good sources
4. Document ranking factors

**Deliverables:**
- `src/lib/menu-extraction/SourceRanking.ts`
- Ranking documentation
- Test cases

---

### 2.3 Source Pre-Flight Validation (1-2 hours)

**Goal:** Quick checks before expensive extraction.

```typescript
async function validateSource(source: DiscoveredSource): Promise<ValidationResult> {
  // 1. Accessibility check
  try {
    const response = await fetch(source.url, {
      method: 'HEAD',
      timeout: 5000
    });
    
    if (!response.ok) {
      return {
        valid: false,
        errorCode: response.status === 404 
          ? PermanentError.SOURCE_NOT_FOUND 
          : PermanentError.SOURCE_FORBIDDEN
      };
    }
    
    // 2. File size check (for PDFs/images)
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const sizeBytes = parseInt(contentLength);
      
      // Skip if too small (likely error page)
      if (sizeBytes < 1000) {
        return {
          valid: false,
          errorCode: PermanentError.SOURCE_INVALID
        };
      }
      
      // Warn if very large (may timeout)
      if (sizeBytes > 10_000_000) {  // 10 MB
        return {
          valid: true,
          warnings: ['WARN_LARGE_FILE']
        };
      }
    }
    
    // 3. Content type check
    const contentType = response.headers.get('content-type');
    if (contentType) {
      // Verify type matches expectation
      if (source.type === SourceType.PDF_DIRECT && !contentType.includes('pdf')) {
        return {
          valid: false,
          errorCode: PermanentError.SOURCE_INVALID
        };
      }
    }
    
    return { valid: true };
    
  } catch (error) {
    return {
      valid: false,
      errorCode: RetryableError.NETWORK_TIMEOUT
    };
  }
}
```

**Implementation Tasks:**

1. Create `src/lib/menu-extraction/SourceValidation.ts`
2. Implement pre-flight checks
3. Integrate with extraction queue
4. Skip invalid sources early

**Deliverables:**
- `src/lib/menu-extraction/SourceValidation.ts`

---

## Phase 2 Summary

**Total Effort:** 6-8 hours

**Deliverables:**
- ✅ Comprehensive source discovery system
- ✅ Multi-method discovery (PDF, JSON, images, providers, HTML)
- ✅ Intelligent source ranking algorithm
- ✅ Pre-flight validation to skip bad sources early

**Impact:** Instead of blindly extracting HTML, system now finds best menu representation first.

---

## Phase 3: Core Extraction Strategies (12-16 hours)

**Goal:** Implement modality-specific extractors in priority order.

### 3.1 Strategy A: Structured JSON Extraction (3-4 hours)

**Priority:** HIGH (highest success rate when available)

**Handles:**
- JSON-LD with Menu schema
- Next.js __NEXT_DATA__ with menu props
- Embedded Apollo state
- Window state objects

**Implementation:**

```typescript
class StructuredJSONStrategy extends BaseStrategy {
  name = 'structured_json';
  version = '1.0.0';
  
  canHandle(context: ExtractionContext): boolean {
    return context.sourceType === SourceType.JSON_EMBEDDED;
  }
  
  async extract(context: ExtractionContext): Promise<ExtractionResult> {
    const html = context.artifacts.renderedHtml || context.artifacts.initialHtml;
    
    if (!html) {
      return this.failed(StrategyError.STRATEGY_INSUFFICIENT_DATA);
    }
    
    // 1. Extract all JSON-LD blocks
    const jsonLDMenus = this.extractJSONLD(html);
    
    // 2. Extract Next.js data
    const nextJSMenus = this.extractNextJSData(html);
    
    // 3. Extract window state
    const windowMenus = this.extractWindowState(html);
    
    // Combine all candidates
    const allCandidates = [
      ...jsonLDMenus,
      ...nextJSMenus,
      ...windowMenus
    ];
    
    if (allCandidates.length === 0) {
      return this.failed(StrategyError.STRATEGY_NOT_APPLICABLE);
    }
    
    return {
      status: 'success',
      candidates: allCandidates,
      evidence: allCandidates.flatMap(c => c.evidence),
      diagnostics: this.createDiagnostics()
    };
  }
  
  private extractJSONLD(html: string): MenuCandidate[] {
    const $ = cheerio.load(html);
    const candidates: MenuCandidate[] = [];
    
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const json = JSON.parse($(elem).html() || '');
        
        // Check for menu types
        if (json['@type'] === 'Menu' || json['@type'] === 'FoodEstablishmentReservation') {
          const menu = this.parseSchemaOrgMenu(json);
          
          if (menu) {
            candidates.push({
              menu,
              quality: this.scorer.calculateQuality({ menu }, {}),
              evidence: [{
                type: 'json_field',
                jsonPath: '$',
                textExcerpt: JSON.stringify(json).substring(0, 200),
                contentHash: this.hashContent(JSON.stringify(json))
              }]
            });
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    return candidates;
  }
  
  private parseSchemaOrgMenu(json: any): NormalizedMenu | null {
    // Map Schema.org Menu to NormalizedMenu
    const menu: NormalizedMenu = {
      title: json.name,
      description: json.description,
      categories: [],
      sourceEvidence: []
    };
    
    // Parse menu sections
    if (json.hasMenuSection) {
      const sections = Array.isArray(json.hasMenuSection) 
        ? json.hasMenuSection 
        : [json.hasMenuSection];
      
      sections.forEach(section => {
        const category: MenuCategory = {
          id: uuidv4(),
          name: section.name || 'Uncategorized',
          description: section.description,
          items: [],
          sourceEvidence: []
        };
        
        // Parse menu items
        if (section.hasMenuItem) {
          const items = Array.isArray(section.hasMenuItem)
            ? section.hasMenuItem
            : [section.hasMenuItem];
          
          items.forEach(item => {
            const menuItem: MenuItem = {
              name: item.name,
              description: item.description,
              prices: this.parseSchemaOrgOffer(item.offers),
              sourceEvidence: []
            };
            
            category.items.push(menuItem);
          });
        }
        
        menu.categories.push(category);
      });
    }
    
    return menu.categories.length > 0 ? menu : null;
  }
  
  private parseSchemaOrgOffer(offers: any): ItemPrice[] {
    if (!offers) return [];
    
    const offerArray = Array.isArray(offers) ? offers : [offers];
    
    return offerArray.map(offer => ({
      amount: parseFloat(offer.price),
      currency: offer.priceCurrency,
      rawText: `${offer.price} ${offer.priceCurrency}`,
      sourceEvidence: {
        type: 'json_field',
        jsonPath: '$.offers.price',
        textExcerpt: JSON.stringify(offer).substring(0, 100)
      }
    }));
  }
  
  private extractNextJSData(html: string): MenuCandidate[] {
    const $ = cheerio.load(html);
    const candidates: MenuCandidate[] = [];
    
    $('#__NEXT_DATA__').each((i, elem) => {
      try {
        const json = JSON.parse($(elem).html() || '');
        
        // Traverse props to find menu-like structures
        const menuData = this.findMenuDataInObject(json);
        
        if (menuData) {
          const menu = this.parseGenericMenuJSON(menuData);
          
          if (menu) {
            candidates.push({
              menu,
              quality: this.scorer.calculateQuality({ menu }, {}),
              evidence: [{
                type: 'json_field',
                jsonPath: '$.props',
                textExcerpt: JSON.stringify(menuData).substring(0, 200)
              }]
            });
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
    return candidates;
  }
  
  private findMenuDataInObject(obj: any, path: string = ''): any {
    // Recursive search for menu-like structures
    if (!obj || typeof obj !== 'object') return null;
    
    // Check if current object looks like a menu
    if (this.looksLikeMenu(obj)) {
      return obj;
    }
    
    // Recurse into nested objects
    for (const key of Object.keys(obj)) {
      if (key.match(/menu|dish|food|drink|item/i)) {
        const result = this.findMenuDataInObject(obj[key], `${path}.${key}`);
        if (result) return result;
      }
    }
    
    return null;
  }
  
  private looksLikeMenu(obj: any): boolean {
    const str = JSON.stringify(obj);
    
    // Count menu-related keywords
    const keywords = ['name', 'price', 'description', 'category', 'item'];
    const matches = keywords.filter(kw => str.includes(kw)).length;
    
    // Must have at least 3 menu keywords
    return matches >= 3;
  }
  
  private parseGenericMenuJSON(data: any): NormalizedMenu | null {
    // Generic JSON-to-menu mapper
    // This is more complex and would use heuristics to map
    // arbitrary JSON structures to normalized menu schema
    
    // For now, return null (implement in detail during actual coding)
    return null;
  }
}
```

**Implementation Tasks:**

1. Create `src/lib/menu-extraction/strategies/StructuredJSONStrategy.ts`
2. Implement Schema.org Menu parsing
3. Implement Next.js data extraction
4. Implement generic JSON traversal with menu-likeness scoring
5. Create comprehensive tests with real examples
6. Test with Schema.org validator

**Deliverables:**
- `StructuredJSONStrategy.ts`
- Tests with Schema.org menu examples
- Tests with Next.js menu examples

---

### 3.2 Strategy B: PDF Text Extraction (3-4 hours)

**Priority:** HIGH (PDFs are common and high-quality when text layer exists)

**Handles:**
- PDF with native text layer (most common)
- Multi-column layouts
- Multi-page menus
- Preserve section headers
- Fallback to OCR only when text layer absent/poor

**Implementation:**

```typescript
class PDFTextStrategy extends BaseStrategy {
  name = 'pdf_text';
  version = '1.0.0';
  
  canHandle(context: ExtractionContext): boolean {
    return context.sourceType === SourceType.PDF_DIRECT ||
           context.sourceType === SourceType.PDF_EMBEDDED;
  }
  
  async extract(context: ExtractionContext): Promise<ExtractionResult> {
    // 1. Download PDF
    const pdfBuffer = await this.downloadPDF(context.sourceUrl);
    
    // Store artifact
    await this.artifactCapture.capturePDF(pdfBuffer, context.runId);
    
    // 2. Extract text layer
    const textContent = await this.extractTextLayer(pdfBuffer);
    
    // 3. Check text quality
    if (this.isTextQualitySufficient(textContent)) {
      // Use text layer
      return await this.extractFromText(textContent, context);
    } else {
      // Text layer insufficient, need OCR
      return {
        status: 'failed',
        candidates: [],
        evidence: [],
        diagnostics: {
          ...this.createDiagnostics(),
          errorCode: StrategyError.STRATEGY_INSUFFICIENT_DATA,
          errorMessage: 'PDF text layer insufficient, OCR required'
        }
      };
    }
  }
  
  private async extractTextLayer(pdfBuffer: Buffer): Promise<PDFTextContent> {
    // Use pdf-parse or pdfjs-dist
    const pdfData = await pdf(pdfBuffer);
    
    return {
      text: pdfData.text,
      pages: pdfData.numpages,
      info: pdfData.info
    };
  }
  
  private isTextQualitySufficient(content: PDFTextContent): boolean {
    // Check if text layer is usable
    if (!content.text || content.text.length < 100) {
      return false;
    }
    
    // Check for menu-like content
    const menuKeywords = /menu|pris|kr\.|DKK|frokost|middag|aften/gi;
    const matches = content.text.match(menuKeywords);
    
    if (!matches || matches.length < 3) {
      return false;
    }
    
    // Check for prices
    const pricePattern = /\d+\s*(kr\.?|DKK|,-)/gi;
    const prices = content.text.match(pricePattern);
    
    if (!prices || prices.length < 5) {
      return false;
    }
    
    return true;
  }
  
  private async extractFromText(
    content: PDFTextContent,
    context: ExtractionContext
  ): Promise<ExtractionResult> {
    // Structure the text
    const structured = this.structurePDFText(content.text);
    
    // Extract menu with LLM
    const menu = await this.extractWithLLM(structured, context);
    
    if (!menu) {
      return this.failed(StrategyError.STRATEGY_PARSE_FAILED);
    }
    
    return {
      status: 'success',
      candidates: [{
        menu,
        quality: this.scorer.calculateQuality({ menu }, { sourceType: SourceType.PDF_DIRECT }),
        evidence: this.createPDFEvidence(content)
      }],
      evidence: this.createPDFEvidence(content),
      diagnostics: this.createDiagnostics()
    };
  }
  
  private structurePDFText(text: string): string {
    // Clean and structure PDF text
    let structured = text;
    
    // Remove excessive whitespace
    structured = structured.replace(/\s+/g, ' ');
    
    // Preserve line breaks for structure
    structured = structured.replace(/\n\s*\n/g, '\n\n');
    
    // Identify section headers (all caps, short lines)
    structured = structured.replace(/^([A-ZÆØÅ\s]{3,30})$/gm, '\n## $1\n');
    
    // Identify price lines (number + kr/DKK at end)
    structured = structured.replace(/(.+?)(\d+\s*(kr\.?|DKK|,-))\s*$/gm, '$1 | $2');
    
    return structured;
  }
  
  private async extractWithLLM(text: string, context: ExtractionContext): Promise<NormalizedMenu | null> {
    const prompt = `Extract menu items from this Danish restaurant menu PDF text.

PDF Text:
${text.substring(0, 50000)}

Extract as structured JSON with categories, items, names, descriptions, and prices.
Include evidence references with page numbers where applicable.

Return only valid JSON.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-2024-08-06',
        messages: [
          { role: 'system', content: 'You are a menu extraction specialist. Extract structured menu data from text.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      });
      
      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Map to normalized schema
      return this.mapToNormalizedSchema(result);
      
    } catch (error) {
      console.error('LLM extraction failed:', error);
      return null;
    }
  }
  
  private createPDFEvidence(content: PDFTextContent): EvidenceReference[] {
    return [{
      type: 'pdf_text',
      pdfPage: 1,
      textExcerpt: content.text.substring(0, 500),
      contentHash: this.hashContent(content.text)
    }];
  }
}
```

**Implementation Tasks:**

1. Create `src/lib/menu-extraction/strategies/PDFTextStrategy.ts`
2. Integrate `pdf-parse` library
3. Implement text quality assessment
4. Implement PDF text structuring
5. Create LLM prompt for PDF extraction
6. Test with 5+ real PDF menus (Cafe Faust, etc.)

**Deliverables:**
- `PDFTextStrategy.ts`
- Tests with diverse PDF menus
- LLM prompt optimization

---

### 3.3 Strategy C: Semantic DOM Extraction (3-4 hours)

**Priority:** MEDIUM (works for well-structured HTML)

**Handles:**
- Semantic HTML (article, section, li elements)
- Accessible markup (ARIA labels, data attributes)
- Data attribute mining ([data-price], [data-name])
- Microdata and RDFa

**Implementation:**

```typescript
class SemanticDOMStrategy extends BaseStrategy {
  name = 'semantic_dom';
  version = '1.0.0';
  
  canHandle(context: ExtractionContext): boolean {
    return context.sourceType === SourceType.HTML_INLINE;
  }
  
  async extract(context: ExtractionContext): Promise<ExtractionResult> {
    const html = context.artifacts.renderedHtml || context.artifacts.initialHtml;
    
    if (!html) {
      return this.failed(StrategyError.STRATEGY_INSUFFICIENT_DATA);
    }
    
    const $ = cheerio.load(html);
    const candidates: MenuCandidate[] = [];
    
    // 1. Try data attribute extraction (highest precision)
    const dataAttrMenu = this.extractFromDataAttributes($);
    if (dataAttrMenu) {
      candidates.push({
        menu: dataAttrMenu,
        quality: this.scorer.calculateQuality({ menu: dataAttrMenu }, {}),
        evidence: this.createDOMEvidence($, '[data-menu]')
      });
    }
    
    // 2. Try semantic HTML extraction
    const semanticMenu = this.extractFromSemanticHTML($);
    if (semanticMenu) {
      candidates.push({
        menu: semanticMenu,
        quality: this.scorer.calculateQuality({ menu: semanticMenu }, {}),
        evidence: this.createDOMEvidence($, 'article, section')
      });
    }
    
    // 3. Try ARIA extraction
    const ariaMenu = this.extractFromARIA($);
    if (ariaMenu) {
      candidates.push({
        menu: ariaMenu,
        quality: this.scorer.calculateQuality({ menu: ariaMenu }, {}),
        evidence: this.createDOMEvidence($, '[role="menu"]')
      });
    }
    
    if (candidates.length === 0) {
      return this.failed(StrategyError.STRATEGY_NOT_APPLICABLE);
    }
    
    // Return highest quality candidate
    candidates.sort((a, b) => b.quality.overallScore - a.quality.overallScore);
    
    return {
      status: 'success',
      candidates: candidates.slice(0, 1),  // Top candidate only
      evidence: candidates[0].evidence,
      diagnostics: this.createDiagnostics()
    };
  }
  
  private extractFromDataAttributes($: CheerioAPI): NormalizedMenu | null {
    const menuContainer = $('[data-menu], [data-menu-items]').first();
    
    if (menuContainer.length === 0) return null;
    
    const menu: NormalizedMenu = {
      categories: [],
      sourceEvidence: []
    };
    
    // Find all items with data attributes
    menuContainer.find('[data-item-name]').each((i, elem) => {
      const $elem = $(elem);
      
      const item: MenuItem = {
        name: $elem.attr('data-item-name') || $elem.attr('data-name') || '',
        description: $elem.attr('data-description') || $elem.attr('data-desc'),
        prices: [],
        sourceEvidence: []
      };
      
      // Extract price
      const price = $elem.attr('data-price') || $elem.attr('data-item-price');
      if (price) {
        item.prices.push({
          rawText: price,
          amount: this.parsePrice(price),
          currency: 'DKK',
          sourceEvidence: {
            type: 'dom_attribute',
            domSelector: this.getSelector($, elem),
            textExcerpt: price
          }
        });
      }
      
      // Category
      const category = $elem.attr('data-category') || 'Uncategorized';
      
      // Add to menu
      let cat = menu.categories.find(c => c.name === category);
      if (!cat) {
        cat = {
          id: uuidv4(),
          name: category,
          items: [],
          sourceEvidence: []
        };
        menu.categories.push(cat);
      }
      
      cat.items.push(item);
    });
    
    return menu.categories.length > 0 ? menu : null;
  }
  
  private extractFromSemanticHTML($: CheerioAPI): NormalizedMenu | null {
    const menu: NormalizedMenu = {
      categories: [],
      sourceEvidence: []
    };
    
    // Look for semantic menu structures
    const menuContainers = $('article, section, [class*="menu"], [id*="menu"]');
    
    menuContainers.each((i, container) => {
      const $container = $(container);
      
      // Find category headers (h2, h3)
      const headers = $container.find('h2, h3');
      
      headers.each((j, header) => {
        const $header = $(header);
        const categoryName = $header.text().trim();
        
        // Find items after this header (until next header)
        const items: MenuItem[] = [];
        let $current = $header.next();
        
        while ($current.length > 0 && !$current.is('h2, h3')) {
          // Check if this element contains menu items
          if ($current.is('ul, ol')) {
            $current.find('li').each((k, li) => {
              const $li = $(li);
              const item = this.parseMenuItem($, li);
              if (item) items.push(item);
            });
          } else if ($current.is('div, article')) {
            const item = this.parseMenuItem($, $current[0]);
            if (item) items.push(item);
          }
          
          $current = $current.next();
        }
        
        if (items.length > 0) {
          menu.categories.push({
            id: uuidv4(),
            name: categoryName,
            items,
            sourceEvidence: []
          });
        }
      });
    });
    
    return menu.categories.length > 0 ? menu : null;
  }
  
  private parseMenuItem($: CheerioAPI, elem: Element): MenuItem | null {
    const $elem = $(elem);
    const text = $elem.text();
    
    // Extract name and price from text
    // Pattern: "Dish Name ... 145 kr."
    const match = text.match(/^(.+?)\s+(\d+\s*(kr\.?|DKK|,-))\s*$/);
    
    if (match) {
      const name = match[1].trim();
      const priceText = match[2];
      
      return {
        name,
        prices: [{
          rawText: priceText,
          amount: this.parsePrice(priceText),
          currency: 'DKK'
        }],
        sourceEvidence: [{
          type: 'dom_text',
          domSelector: this.getSelector($, elem),
          textExcerpt: text.substring(0, 100)
        }]
      };
    }
    
    return null;
  }
  
  private extractFromARIA($: CheerioAPI): NormalizedMenu | null {
    // Extract menu from ARIA roles and labels
    const menuElements = $('[role="menu"], [role="menubar"], [role="menuitem"]');
    
    if (menuElements.length === 0) return null;
    
    // Implementation similar to semantic HTML extraction
    // but using ARIA attributes
    
    return null;  // Implement during actual coding
  }
  
  private getSelector($: CheerioAPI, elem: Element): string {
    // Generate CSS selector for element
    const $elem = $(elem);
    
    if ($elem.attr('id')) {
      return `#${$elem.attr('id')}`;
    }
    
    if ($elem.attr('class')) {
      return `.${$elem.attr('class')?.split(' ').join('.')}`;
    }
    
    // Use tag + index
    const tagName = $elem.prop('tagName')?.toLowerCase();
    const index = $elem.parent().children(tagName).index($elem[0]);
    
    return `${tagName}:nth-child(${index + 1})`;
  }
  
  private createDOMEvidence($: CheerioAPI, selector: string): EvidenceReference[] {
    const elements = $(selector);
    
    return elements.toArray().slice(0, 5).map(elem => ({
      type: 'dom_text' as const,
      domSelector: this.getSelector($, elem),
      textExcerpt: $(elem).text().substring(0, 200)
    }));
  }
}
```

**Implementation Tasks:**

1. Create `src/lib/menu-extraction/strategies/SemanticDOMStrategy.ts`
2. Implement data attribute extraction
3. Implement semantic HTML extraction
4. Implement ARIA extraction
5. Test with well-structured HTML menus

**Deliverables:**
- `SemanticDOMStrategy.ts`
- Tests with semantic HTML examples

---

### 3.4 Strategy D: Visual Screenshot Extraction (3-4 hours)

**Priority:** HIGH (fallback for image menus, canvas rendering, visual-only content)

**Handles:**
- Image menus (single or gallery)
- Canvas-rendered content
- Full-page screenshot fallback
- Region-specific screenshots (menu area only)

**Implementation:**

```typescript
class VisualScreenshotStrategy extends BaseStrategy {
  name = 'visual_screenshot';
  version = '1.0.0';
  
  canHandle(context: ExtractionContext): boolean {
    return context.sourceType === SourceType.IMAGE_SINGLE ||
           context.sourceType === SourceType.IMAGE_GALLERY ||
           context.artifacts.screenshot !== undefined;
  }
  
  async extract(context: ExtractionContext): Promise<ExtractionResult> {
    let screenshots: Buffer[] = [];
    
    // 1. Get screenshots
    if (context.sourceType === SourceType.IMAGE_SINGLE) {
      // Download image directly
      const imageBuffer = await this.downloadImage(context.sourceUrl);
      screenshots = [imageBuffer];
    } else if (context.artifacts.screenshot) {
      screenshots = [context.artifacts.screenshot];
    }
    
    if (screenshots.length === 0) {
      return this.failed(StrategyError.STRATEGY_INSUFFICIENT_DATA);
    }
    
    // 2. Extract from each screenshot using multimodal model
    const candidates: MenuCandidate[] = [];
    
    for (const [index, screenshot] of screenshots.entries()) {
      const menu = await this.extractFromScreenshot(screenshot, context);
      
      if (menu) {
        candidates.push({
          menu,
          quality: this.scorer.calculateQuality({ menu }, { sourceType: context.sourceType }),
          evidence: [{
            type: 'screenshot_region',
            artifactPath: `screenshots/${context.runId}/screenshot-${index}.webp`,
            textExcerpt: 'Visual extraction from screenshot'
          }]
        });
      }
    }
    
    if (candidates.length === 0) {
      return this.failed(StrategyError.STRATEGY_PARSE_FAILED);
    }
    
    return {
      status: 'success',
      candidates,
      evidence: candidates.flatMap(c => c.evidence),
      diagnostics: this.createDiagnostics()
    };
  }
  
  private async extractFromScreenshot(
    screenshot: Buffer,
    context: ExtractionContext
  ): Promise<NormalizedMenu | null> {
    // Convert screenshot to base64
    const base64Image = screenshot.toString('base64');
    
    const prompt = `Extract all menu items from this Danish restaurant menu image.

Return a structured JSON with:
- categories (name, items array)
- items (name, description if visible, prices)

For prices, preserve original format (e.g., "145,-" or "145 kr.").

Return only valid JSON.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',  // Multimodal model
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'high'  // High detail for menu text
                }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
        temperature: 0.1
      });
      
      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Map to normalized schema
      return this.mapToNormalizedSchema(result);
      
    } catch (error) {
      console.error('Visual extraction failed:', error);
      return null;
    }
  }
  
  private async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
```

**Implementation Tasks:**

1. Create `src/lib/menu-extraction/strategies/VisualScreenshotStrategy.ts`
2. Integrate with OpenAI GPT-4 Vision API
3. Implement screenshot download and conversion
4. Optimize prompt for Danish menus
5. Test with image menus from real restaurants

**Deliverables:**
- `VisualScreenshotStrategy.ts`
- Tests with image menu examples
- Cost analysis (GPT-4 Vision pricing)

---

## Phase 3 Summary

**Total Effort:** 12-16 hours

**Strategies Implemented:**
- ✅ Structured JSON Extraction (highest precision)
- ✅ PDF Text Extraction (common, high quality)
- ✅ Semantic DOM Extraction (well-structured HTML)
- ✅ Visual Screenshot Extraction (visual-only menus)

**Coverage Estimate:**
- JSON-LD/Schema.org: ~5-10% of sites
- PDF menus: ~30-40% of F&B businesses
- Semantic HTML: ~40-50% with degraded quality
- Visual extraction: Universal fallback

**Combined expected success rate:** 75-85% (before additional strategies)

---

## Phase 4: Orchestration & Validation (8-10 hours)

**Goal:** Coordinate strategies, validate results, make acceptance decisions.

### 4.1 Extraction Orchestrator (4-5 hours)

**Design:**

```typescript
class MenuExtractionOrchestrator {
  private strategies: ExtractionStrategy[];
  private scorer: QualityScorer;
  private validator: MenuValidator;
  
  constructor() {
    // Register strategies in priority order
    this.strategies = [
      new StructuredJSONStrategy(),
      new PDFTextStrategy(),
      new VisualScreenshotStrategy(),
      new SemanticDOMStrategy(),
      // More strategies...
    ];
    
    this.scorer = new StandardQualityScorer();
    this.validator = new MenuValidator();
  }
  
  async extract(context: ExtractionContext): Promise<MenuExtractionResult> {
    const runId = context.runId;
    const attempts: StrategyAttempt[] = [];
    const allCandidates: MenuCandidate[] = [];
    
    // Try each applicable strategy
    for (const strategy of this.strategies) {
      if (!strategy.canHandle(context)) {
        continue;
      }
      
      const attemptStart = Date.now();
      
      try {
        console.log(`Trying strategy: ${strategy.name} v${strategy.version}`);
        
        const result = await strategy.extract(context);
        const duration = Date.now() - attemptStart;
        
        // Record attempt
        const attempt: StrategyAttempt = {
          strategy: strategy.name,
          version: strategy.version,
          status: result.status,
          duration,
          candidateCount: result.candidates.length,
          diagnostics: result.diagnostics
        };
        
        attempts.push(attempt);
        
        // Collect candidates
        if (result.status === 'success' || result.status === 'partial') {
          allCandidates.push(...result.candidates);
          
          // If we have high-quality result, stop cascading
          const bestCandidate = result.candidates[0];
          if (bestCandidate && bestCandidate.quality.overallScore >= 0.8) {
            console.log(`High-quality result from ${strategy.name}, stopping cascade`);
            break;
          }
        }
        
        // If strategy succeeded but quality is low, continue to next strategy
        if (result.status === 'success' && result.candidates[0]?.quality.overallScore < 0.6) {
          console.log(`Low quality from ${strategy.name}, trying next strategy`);
          continue;
        }
        
        // If strategy failed deterministically, try next
        if (result.status === 'failed' && result.diagnostics.errorCode) {
          if (this.isRetryableError(result.diagnostics.errorCode)) {
            // Retryable error - stop cascade and requeue
            throw new RetryableExtractionError(result.diagnostics.errorCode);
          } else {
            // Permanent strategy failure - try next
            console.log(`Strategy ${strategy.name} not applicable, trying next`);
            continue;
          }
        }
        
      } catch (error) {
        const duration = Date.now() - attemptStart;
        
        attempts.push({
          strategy: strategy.name,
          version: strategy.version,
          status: 'failed',
          duration,
          candidateCount: 0,
          diagnostics: {
            strategy: strategy.name,
            version: strategy.version,
            durationMs: duration,
            warningCodes: [],
            errorCode: RetryableError.STRATEGY_TIMEOUT,
            errorMessage: error.message
          }
        });
        
        // If retryable error, stop and requeue entire job
        if (error instanceof RetryableExtractionError) {
          throw error;
        }
        
        // Otherwise, continue to next strategy
        continue;
      }
    }
    
    // No candidates found after all strategies
    if (allCandidates.length === 0) {
      return {
        status: 'permanent_error',
        attempts,
        errorCode: PermanentError.NO_MENU_EXISTS,
        quality: null
      };
    }
    
    // Validate and reconcile candidates
    const result = await this.validateAndReconcile(allCandidates, context);
    
    return {
      ...result,
      attempts
    };
  }
  
  private async validateAndReconcile(
    candidates: MenuCandidate[],
    context: ExtractionContext
  ): Promise<ExtractionReconciliationResult> {
    // 1. Sort by quality
    candidates.sort((a, b) => b.quality.overallScore - a.quality.overallScore);
    
    const bestCandidate = candidates[0];
    
    // 2. Run validation
    const validation = this.validator.validate(bestCandidate.menu, context);
    
    // 3. Check for hard failures
    if (validation.hardFailures.length > 0) {
      return {
        status: 'manual_review_needed',
        menu: bestCandidate.menu,
        quality: bestCandidate.quality,
        validationResult: validation
      };
    }
    
    // 4. Check cross-strategy agreement if multiple candidates
    if (candidates.length > 1) {
      const agreement = this.calculateAgreement(candidates);
      
      if (agreement.score < 0.5) {
        // Low agreement - send to review
        return {
          status: 'manual_review_needed',
          menu: bestCandidate.menu,
          quality: bestCandidate.quality,
          validationResult: validation,
          agreementScore: agreement.score
        };
      }
    }
    
    // 5. Make acceptance decision
    const decision = this.makeAcceptanceDecision(bestCandidate, validation);
    
    return {
      status: decision.status,
      menu: bestCandidate.menu,
      quality: bestCandidate.quality,
      validationResult: validation
    };
  }
  
  private calculateAgreement(candidates: MenuCandidate[]): AgreementScore {
    if (candidates.length < 2) {
      return { score: 1.0 };
    }
    
    const [first, second] = candidates;
    
    const firstItems = this.getAllItems(first.menu);
    const secondItems = this.getAllItems(second.menu);
    
    // Compare item names
    const firstNames = new Set(firstItems.map(i => i.name.toLowerCase()));
    const secondNames = new Set(secondItems.map(i => i.name.toLowerCase()));
    
    const intersection = new Set([...firstNames].filter(n => secondNames.has(n)));
    const union = new Set([...firstNames, ...secondNames]);
    
    const nameAgreement = intersection.size / union.size;
    
    // Compare prices for matching items
    let priceMatches = 0;
    let priceComparisons = 0;
    
    for (const firstName of intersection) {
      const firstItem = firstItems.find(i => i.name.toLowerCase() === firstName);
      const secondItem = secondItems.find(i => i.name.toLowerCase() === firstName);
      
      if (firstItem && secondItem && firstItem.prices[0] && secondItem.prices[0]) {
        priceComparisons++;
        if (Math.abs((firstItem.prices[0].amount || 0) - (secondItem.prices[0].amount || 0)) < 5) {
          priceMatches++;
        }
      }
    }
    
    const priceAgreement = priceComparisons > 0 ? priceMatches / priceComparisons : 1.0;
    
    // Combined score
    const score = (nameAgreement * 0.6) + (priceAgreement * 0.4);
    
    return { score };
  }
  
  private makeAcceptanceDecision(
    candidate: MenuCandidate,
    validation: ValidationResult
  ): AcceptanceDecision {
    const quality = candidate.quality;
    
    // Hard failures -> manual review
    if (validation.hardFailures.length > 0) {
      return { status: 'manual_review_needed', reason: 'Hard validation failures' };
    }
    
    // High quality -> automatic acceptance
    if (quality.overallScore >= 0.8 &&
        quality.evidenceScore >= 0.7 &&
        quality.itemNameCoverage >= 0.95 &&
        validation.warnings.length <= 2) {
      return { status: 'done', reason: 'High quality extraction' };
    }
    
    // Medium quality with good name/price coverage -> partial acceptance
    if (quality.overallScore >= 0.6 &&
        quality.itemNameCoverage >= 0.9 &&
        quality.priceCoverage >= 0.7) {
      return { status: 'partial', reason: 'Good core data, some details missing' };
    }
    
    // Low quality or many warnings -> manual review
    if (quality.overallScore < 0.6 || validation.warnings.length > 5) {
      return { status: 'manual_review_needed', reason: 'Low quality or many warnings' };
    }
    
    // Default to partial
    return { status: 'partial', reason: 'Acceptable quality with minor issues' };
  }
  
  private getAllItems(menu: NormalizedMenu): MenuItem[] {
    return menu.categories.flatMap(c => c.items);
  }
  
  private isRetryableError(errorCode: string): boolean {
    return Object.values(RetryableError).includes(errorCode as any);
  }
}
```

**Implementation Tasks:**

1. Create `src/lib/menu-extraction/ExtractionOrchestrator.ts`
2. Implement strategy registration and priority
3. Implement cascading logic with quality thresholds
4. Implement cross-strategy agreement calculation
5. Implement acceptance decision logic
6. Test with mock strategies

**Deliverables:**
- `ExtractionOrchestrator.ts`
- Strategy cascade tests
- Agreement calculation tests

---

### 4.2 Menu Validator (2-3 hours)

**Goal:** Rule-based validation to catch extraction errors.

```typescript
class MenuValidator {
  validate(menu: NormalizedMenu, context: ExtractionContext): ValidationResult {
    const warnings: string[] = [];
    const hardFailures: string[] = [];
    
    const items = this.getAllItems(menu);
    
    // 1. Item count validation
    if (items.length === 0) {
      hardFailures.push('HARD_FAIL_NO_ITEMS');
    } else if (items.length < 5) {
      warnings.push(QualityWarning.WARN_FEW_ITEMS);
    }
    
    // 2. Name validation
    const itemsWithoutName = items.filter(i => !i.name || i.name.trim().length === 0);
    if (itemsWithoutName.length > items.length * 0.5) {
      hardFailures.push('HARD_FAIL_MISSING_NAMES');
    }
    
    const avgNameLength = items.reduce((sum, i) => sum + i.name.length, 0) / items.length;
    if (avgNameLength < 3) {
      hardFailures.push('HARD_FAIL_INVALID_NAMES');
    }
    
    // 3. Navigation detection
    const navigationKeywords = ['home', 'about', 'contact', 'booking', 'reservation', 'gallery', 'hjem', 'om', 'kontakt'];
    const navigationCount = items.filter(i =>
      navigationKeywords.some(kw => i.name.toLowerCase().includes(kw))
    ).length;
    
    if (navigationCount > items.length * 0.3) {
      warnings.push(QualityWarning.WARN_NAVIGATION_DETECTED);
    }
    
    // 4. Price validation
    const itemsWithPrice = items.filter(i => i.prices.length > 0);
    const priceCoverage = itemsWithPrice.length / items.length;
    
    if (priceCoverage < 0.5) {
      warnings.push(QualityWarning.WARN_NO_PRICES_FOUND);
    }
    
    // Check price consistency
    const prices = itemsWithPrice.flatMap(i => i.prices.map(p => p.amount)).filter(Boolean) as number[];
    
    if (prices.length > 0) {
      const max = Math.max(...prices);
      const min = Math.min(...prices);
      
      // Outlier detection
      if (max > min * 15) {
        warnings.push(QualityWarning.WARN_PRICE_OUTLIERS);
      }
      
      // All same price
      const uniquePrices = new Set(prices);
      if (uniquePrices.size === 1 && items.length > 5) {
        warnings.push(QualityWarning.WARN_DUPLICATE_PRICES);
      }
    }
    
    // 5. Currency validation
    const currencies = items.flatMap(i => i.prices.map(p => p.currency)).filter(Boolean);
    const uniqueCurrencies = new Set(currencies);
    
    if (uniqueCurrencies.size > 1) {
      warnings.push(QualityWarning.WARN_MULTIPLE_CURRENCIES);
    }
    
    // 6. Category validation
    if (!menu.categories || menu.categories.length === 0) {
      warnings.push(QualityWarning.WARN_NO_CATEGORIES);
    }
    
    // 7. Cookie banner detection
    const allText = items.map(i => i.name + ' ' + (i.description || '')).join(' ').toLowerCase();
    if (allText.includes('cookie') && allText.includes('accept')) {
      warnings.push(QualityWarning.WARN_COOKIE_BANNER_TEXT);
    }
    
    // 8. Sample menu detection
    if (menu.title?.toLowerCase().includes('sample') || menu.description?.toLowerCase().includes('sample')) {
      warnings.push(QualityWarning.WARN_SAMPLE_MENU);
    }
    
    // 9. Seasonal menu warning
    if (menu.title?.match(/sommer|vinter|efterår|forår|spring|summer|fall|winter/i)) {
      warnings.push(QualityWarning.WARN_SEASONAL_MENU);
    }
    
    // 10. Duplicate detection
    const itemNames = items.map(i => i.name.toLowerCase().trim());
    const duplicates = itemNames.filter((name, index) =>
      itemNames.indexOf(name) !== index
    );
    
    if (duplicates.length > items.length * 0.2) {
      warnings.push(QualityWarning.WARN_CONFLICTING_DATA);
    }
    
    return {
      valid: hardFailures.length === 0,
      warnings,
      hardFailures
    };
  }
  
  private getAllItems(menu: NormalizedMenu): MenuItem[] {
    return menu.categories.flatMap(c => c.items);
  }
}
```

**Implementation Tasks:**

1. Create `src/lib/menu-extraction/MenuValidator.ts`
2. Implement all validation rules
3. Create test cases for each rule
4. Document validation logic

**Deliverables:**
- `MenuValidator.ts`
- Validation rule tests

---

### 4.3 Queue Integration (2 hours)

**Goal:** Integrate orchestrator with existing queue system.

**Modifications to MenuPage.tsx:**

- Queue processor calls orchestrator instead of direct Edge Function
- Handle new status types ('partial', 'manual_review_needed')
- Display enhanced quality information to user
- Show attempt history

**Modifications to menu-extract-v2:**

- Edge Function becomes a thin wrapper around orchestrator
- Pass context to orchestrator
- Store run and attempt data in database
- Upload artifacts to storage

**Implementation Tasks:**

1. Update `src/pages/dashboard/MenuPage.tsx` queue processor
2. Update `supabase/functions/menu-extract-v2/index.ts` to use orchestrator
3. Test queue processing with multiple strategies
4. Handle partial results in UI

**Deliverables:**
- Updated MenuPage.tsx
- Updated menu-extract-v2 Edge Function
- Queue integration tests

---

## Phase 4 Summary

**Total Effort:** 8-10 hours

**Deliverables:**
- ✅ Extraction orchestrator with cascading logic
- ✅ Cross-strategy agreement calculation
- ✅ Acceptance decision framework
- ✅ Comprehensive menu validator
- ✅ Queue integration with new system

**Result:** Complete extraction pipeline from discovery → strategies → validation → acceptance

---

## Phase 5: Advanced Strategies (Optional, 12-16 hours)

**Goal:** Add specialized strategies for remaining edge cases.

### 5.1 Network Response Extraction (4-5 hours)

**Handles:**
- XHR/fetch responses with menu JSON
- GraphQL menu queries
- Headless CMS API responses

### 5.2 PDF OCR Strategy (3-4 hours)

**Handles:**
- PDFs without text layer
- Scanned menu images
- Low-quality PDFs

### 5.3 Provider Adapters (5-7 hours)

**Handles:**
- Known menu providers (Menufy, Zenchef, etc.)
- Ordering system iframes
- Reservation platform menus

---

## Phase 6: Review UI & Correction System (10-12 hours)

**Goal:** Build interface for manual review and correction.

### 6.1 Review Dashboard

- List extractions needing review
- Filter by warning type, business, date
- Bulk approval/rejection

### 6.2 Review Detail Page

- Side-by-side: extracted menu vs. source
- Inline editing of items
- Field-level confidence display
- Evidence highlighting
- Approve/reject/edit actions

### 6.3 Correction Tracking

- Store correction events
- Track correction patterns
- Generate improvement insights

---

## Implementation Roadmap Summary

### Quick Win Path (25-35 hours)

**Phase 1:** Core Infrastructure (8-10h)
- Strategy interface, evidence model, artifacts, database, quality scoring

**Phase 2:** Source Discovery (6-8h)
- Find all menu sources, rank by quality

**Phase 3:** Core Strategies (12-16h)
- JSON, PDF, Semantic DOM, Visual extraction

**Phase 4:** Orchestration (8-10h)
- Strategy cascade, validation, acceptance decisions

**Result:** 70-85% success rate with strong foundation

### Full Implementation (60-80 hours)

Add Phase 5 (Advanced Strategies) and Phase 6 (Review UI) for 90%+ success rate and complete operational system.

---

## Risk Mitigation

### Technical Risks

1. **OpenAI API costs**
   - Mitigation: Use GPT-4o-mini for simple cases, GPT-4o only for complex
   - Expected cost: $0.10-0.30 per menu extraction
   - Budget: Track costs per business, set limits

2. **Cloud Run timeout**
   - Mitigation: Implement progressive timeout strategy
   - Fall back to lighter extraction if timeout approaching

3. **Artifact storage costs**
   - Mitigation: Implement retention policy (90 days)
   - Compress all text artifacts
   - Estimated cost: $0.05-0.15/month for 1,000 businesses

4. **Database migration complexity**
   - Mitigation: Start with nullable columns (Phase 1)
   - Migrate to dedicated tables later (Phase 3)
   - Zero downtime deployment

### Product Risks

1. **User expectation management**
   - Mitigation: Clear communication about partial results
   - Show extraction quality indicators
   - Provide easy path to manual review

2. **Manual review workload**
   - Mitigation: Prioritize high-value extractions
   - Improve validation to reduce false positives
   - Track correction patterns to improve automation

---

## Success Metrics

Track these metrics throughout implementation:

1. **Extraction success rate** (by status: done, partial, review, failed)
2. **Success by source type** (PDF, JSON, HTML, image)
3. **Success by platform** (WordPress, Umbraco, Wix, etc.)
4. **Strategy effectiveness** (success rate per strategy)
5. **Extraction time** (p50, p95, p99)
6. **Manual review rate**
7. **Correction frequency** (per business, per field type)
8. **Cost per extraction** (API costs, storage, compute)

---

## Next Steps

1. ✅ **Review this plan** - Verify approach aligns with goals
2. **Approve Phase 1** - Get approval to start infrastructure work
3. **Create feature branch** - `feature/robust-menu-extraction`
4. **Begin Phase 1.1** - Implement strategy interface and types
5. **Iterative implementation** - Complete phases sequentially with testing
6. **Continuous metrics** - Track success rates throughout development

---

## Questions for Decision

Before implementation begins:

1. **Budget approval:** OpenAI API costs ($100-300/month for 1,000 businesses)
2. **Timeline preference:** Quick win (25-35h) or full system (60-80h)?
3. **Phase priority:** Should visual extraction come before semantic DOM?
4. **Review UI priority:** Build now or defer to Phase 6?
5. **Database approach:** Columns first (simple) or tables first (clean)?

---

**End of Implementation Plan**
