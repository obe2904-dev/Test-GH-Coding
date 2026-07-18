/**
 * Menu Extraction System - Public API
 * Export all public types and classes
 */

// Core Orchestrator
export { ExtractionOrchestrator } from './ExtractionOrchestrator';
export type { OrchestrationOptions } from './ExtractionOrchestrator';

// Strategies
export { StructuredJSONStrategy } from './strategies/StructuredJSONStrategy';
export { PDFTextStrategy } from './strategies/PDFTextStrategy';
export { SemanticDOMStrategy } from './strategies/SemanticDOMStrategy';

// Quality & Validation
export { StandardQualityScorer } from './QualityScorer';
export type { IQualityScorer } from './QualityScorer';
export { MenuValidator } from './MenuValidator';

// Persistence
export { MenuPersistence } from './MenuPersistence';

// Artifact Capture
export { ArtifactCapture } from './ArtifactCapture';

// Base Strategy
export { BaseStrategy } from './BaseStrategy';

// Types
export * from './types';

// Constants
export * from './constants';

/**
 * Quick Start Example:
 * 
 * ```typescript
 * import { ExtractionOrchestrator } from '@/lib/menu-extraction';
 * 
 * const orchestrator = new ExtractionOrchestrator({
 *   supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *   supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
 * });
 * 
 * const result = await orchestrator.extract({
 *   businessId: 'business-uuid',
 *   sourceId: 'source-uuid',
 *   sourceUrl: 'https://example.com/menu',
 *   sourceType: SourceType.HTML_INLINE,
 *   runId: crypto.randomUUID(),
 *   artifacts: {
 *     initialHtml: '<html>...</html>',
 *     renderedHtml: '<html>...</html>',
 *     visibleText: 'Menu text...',
 *   },
 * });
 * 
 * console.log('Status:', result.status);
 * console.log('Menu:', result.menu);
 * console.log('Quality:', result.quality);
 * ```
 */
