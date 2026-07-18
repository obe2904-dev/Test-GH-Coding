/**
 * Extraction Orchestrator
 * Coordinates strategy cascade and produces final extraction result
 */

import { StructuredJSONStrategy } from './strategies/StructuredJSONStrategy';
import { PDFTextStrategy } from './strategies/PDFTextStrategy';
import { SemanticDOMStrategy } from './strategies/SemanticDOMStrategy';
import { StandardQualityScorer } from './QualityScorer';
import { MenuValidator } from './MenuValidator';
import { MenuPersistence } from './MenuPersistence';
import { ArtifactCapture } from './ArtifactCapture';
import {
  ExtractionContext,
  ExtractionResult,
  MenuExtractionResult,
  IExtractionStrategy,
  MenuCandidate,
  NormalizedMenu,
  ExtractionQuality,
} from './types';
import {
  STRATEGY_PRIORITY,
  QUALITY_THRESHOLDS,
  CONFIG,
} from './constants';

export interface OrchestrationOptions {
  supabaseUrl: string;
  supabaseKey: string;
  enableArtifactCapture?: boolean;
  enablePersistence?: boolean;
  maxStrategyAttempts?: number;
}

export class ExtractionOrchestrator {
  private strategies: IExtractionStrategy[];
  private qualityScorer: StandardQualityScorer;
  private validator: MenuValidator;
  private persistence: MenuPersistence;
  private artifactCapture: ArtifactCapture;
  private options: OrchestrationOptions;
  
  constructor(options: OrchestrationOptions) {
    this.options = {
      enableArtifactCapture: true,
      enablePersistence: true,
      maxStrategyAttempts: 5,
      ...options,
    };
    
    // Initialize strategies in priority order
    this.strategies = [
      new StructuredJSONStrategy(),
      new PDFTextStrategy(),
      new SemanticDOMStrategy(),
      // Additional strategies would be added here
    ];
    
    // Sort by priority
    this.strategies.sort((a, b) => {
      const aPriority = STRATEGY_PRIORITY[a.name] || 999;
      const bPriority = STRATEGY_PRIORITY[b.name] || 999;
      return aPriority - bPriority;
    });
    
    this.qualityScorer = new StandardQualityScorer();
    this.validator = new MenuValidator();
    this.persistence = new MenuPersistence(options.supabaseUrl, options.supabaseKey);
    this.artifactCapture = new ArtifactCapture(options.supabaseUrl, options.supabaseKey);
  }
  
  /**
   * Run extraction cascade and return best result
   */
  async extract(context: ExtractionContext): Promise<MenuExtractionResult> {
    const startTime = Date.now();
    const candidates: MenuCandidate[] = [];
    
    // 1. Capture artifacts if enabled
    if (this.options.enableArtifactCapture && context.artifacts) {
      await this.captureArtifacts(context);
    }
    
    // 2. Run strategies in priority order
    for (const strategy of this.strategies) {
      // Check timeout
      if (Date.now() - startTime > CONFIG.TOTAL_EXTRACTION_TIMEOUT_MS) {
        break;
      }
      
      // Check if strategy can handle this source
      const canHandle = await strategy.canHandle(context);
      if (!canHandle) {
        continue;
      }
      
      // Run strategy
      try {
        const result = await this.runStrategyWithTimeout(strategy, context);
        
        if (result.status === 'success' && result.candidates.length > 0) {
          // Score and validate each candidate
          for (const candidate of result.candidates) {
            const quality = this.qualityScorer.calculateQuality(candidate, {
              itemCount: this.countItems(candidate.menu),
              sourceType: context.sourceType,
            });
            const validation = this.validator.validate(candidate.menu, context);
            
            candidates.push({
              menu: candidate.menu,
              strategy: strategy.name,
              quality,
              validation,
            });
          }
          
          // If we have a high-quality result, we can stop early
          const bestQuality = Math.max(...result.candidates.map(c => c.quality.overallScore));
          if (bestQuality >= QUALITY_THRESHOLDS.AUTO_ACCEPT) {
            break;
          }
        }
      } catch (error: any) {
        console.error(`Strategy ${strategy.name} failed:`, error.message);
        continue;
      }
      
      // Check max attempts
      if (candidates.length >= (this.options.maxStrategyAttempts || 5)) {
        break;
      }
    }
    
    // 3. Select best candidate
    const bestCandidate = this.selectBestCandidate(candidates);
    
    if (!bestCandidate) {
      return {
        status: 'permanent_error',
        menu: undefined,
        quality: undefined,
        validationResult: { valid: false, warnings: [], hardFailures: ['No viable menu found'] },
        attempts: [],
        errorCode: 'ERR_NO_MENU_EXISTS',
      };
    }
    
    // 4. Build final result
    const finalResult: MenuExtractionResult = {
      status: this.determineStatus(bestCandidate.quality, bestCandidate.validation) as any,
      menu: bestCandidate.menu,
      quality: bestCandidate.quality,
      validationResult: bestCandidate.validation || { valid: true, warnings: [], hardFailures: [] },
      attempts: candidates.map((c, i) => ({
        strategy: c.strategy,
        version: '1.0.0',
        status: 'success' as const,
        duration: 500,
        candidateCount: 1,
        diagnostics: {
          strategy: c.strategy,
          version: '1.0.0',
          durationMs: 500,
          warningCodes: c.validation?.warnings || [],
        },
      })),
    };
    
    // 5. Persist to database if enabled
    if (this.options.enablePersistence) {
      await this.persistence.persistExtractionResult(finalResult, context);
    }
    
    return finalResult;
  }
  
  /**
   * Run strategy with timeout
   */
  private async runStrategyWithTimeout(
    strategy: IExtractionStrategy,
    context: ExtractionContext
  ): Promise<ExtractionResult> {
    return Promise.race([
      strategy.extract(context),
      this.createTimeoutPromise(CONFIG.STRATEGY_TIMEOUT_MS),
    ]);
  }
  
  /**
   * Create timeout promise
   */
  private createTimeoutPromise(ms: number): Promise<ExtractionResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Strategy timeout'));
      }, ms);
    });
  }
  
  /**
   * Capture artifacts for debugging
   */
  private async captureArtifacts(context: ExtractionContext): Promise<void> {
    try {
      await this.artifactCapture.ensureBucketExists();
      
      const manifest = await this.artifactCapture.createManifest(
        context.businessId,
        context.sourceId,
        context.runId,
        {
          initialHtml: context.artifacts.initialHtml,
          renderedHtml: context.artifacts.renderedHtml,
          visibleText: context.artifacts.visibleText,
          diagnostics: context.artifacts.platformMetadata,
        }
      );
      
      context.artifactStoragePrefix = manifest.storagePrefix;
    } catch (error: any) {
      console.error('Failed to capture artifacts:', error.message);
      // Continue extraction even if artifact capture fails
    }
  }
  
  /**
   * Select best candidate from multiple results
   */
  private selectBestCandidate(candidates: MenuCandidate[]): MenuCandidate | null {
    if (candidates.length === 0) return null;
    
    // Filter out invalid candidates
    const valid = candidates.filter(c => c.validation?.valid !== false);
    
    // If no valid candidates, try partial results
    if (valid.length === 0) {
      return candidates.sort((a, b) => b.quality.overallScore - a.quality.overallScore)[0] || null;
    }
    
    // Sort by quality score
    valid.sort((a, b) => b.quality.overallScore - a.quality.overallScore);
    
    return valid[0];
  }
  
  /**
   * Determine final status based on quality and validation
   */
  private determineStatus(
    quality: ExtractionQuality,
    validation?: { valid: boolean; warnings: string[]; hardFailures: string[] }
  ): string {
    if (validation && !validation.valid) {
      return 'permanent_error';
    }
    
    if (quality.overallScore >= QUALITY_THRESHOLDS.AUTO_ACCEPT) {
      return 'done';
    }
    
    if (quality.overallScore >= QUALITY_THRESHOLDS.PARTIAL_ACCEPT) {
      return 'partial';
    }
    
    return 'manual_review_needed';
  }
  
  /**
   * Count items in menu
   */
  private countItems(menu: NormalizedMenu): number {
    return menu.categories.reduce((sum, cat) => sum + cat.items.length, 0);
  }
}
