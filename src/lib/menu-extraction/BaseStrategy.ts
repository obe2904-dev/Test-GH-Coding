/**
 * Base Strategy Class
 * Provides common utilities and structure for all extraction strategies
 */

import {
  IExtractionStrategy,
  ExtractionContext,
  ExtractionResult,
  StrategyDiagnostics,
  StrategyStatus,
  MenuItem,
  NormalizedMenu,
  ItemPrice,
  EvidenceReference,
} from './types';
import {
  StrategyError,
  DANISH_PRICE_PATTERNS,
  QUANTITY_PATTERNS,
  DIETARY_LABEL_MAPPING,
  SERVICE_PERIOD_MAPPING,
} from './constants';

export abstract class BaseStrategy implements IExtractionStrategy {
  abstract readonly name: string;
  abstract readonly version: string;
  
  protected startTime: number = 0;
  protected warnings: string[] = [];
  
  abstract canHandle(context: ExtractionContext): boolean;
  abstract extract(context: ExtractionContext): Promise<ExtractionResult>;
  
  /**
   * Create a failed result
   */
  protected failed(
    errorCode: string,
    errorMessage?: string
  ): ExtractionResult {
    return {
      status: 'failed',
      candidates: [],
      evidence: [],
      diagnostics: this.createDiagnostics(errorCode, errorMessage)
    };
  }
  
  /**
   * Create a no menu found result
   */
  protected noMenuFound(): ExtractionResult {
    return {
      status: 'no_menu_found',
      candidates: [],
      evidence: [],
      diagnostics: this.createDiagnostics(StrategyError.STRATEGY_NOT_APPLICABLE)
    };
  }
  
  /**
   * Create diagnostics object
   */
  protected createDiagnostics(
    errorCode?: string,
    errorMessage?: string
  ): StrategyDiagnostics {
    return {
      strategy: this.name,
      version: this.version,
      durationMs: Date.now() - this.startTime,
      warningCodes: this.warnings,
      errorCode,
      errorMessage
    };
  }
  
  /**
   * Start timing for diagnostics
   */
  protected startTiming(): void {
    this.startTime = Date.now();
    this.warnings = [];
  }
  
  /**
   * Add a warning
   */
  protected addWarning(code: string): void {
    if (!this.warnings.includes(code)) {
      this.warnings.push(code);
    }
  }
  
  /**
   * Parse Danish price from text
   */
  protected parsePrice(priceText: string): number | undefined {
    for (const pattern of DANISH_PRICE_PATTERNS) {
      const match = priceText.match(pattern);
      if (match) {
        // Extract numeric parts
        const numbers = match.slice(1).filter(n => n !== undefined);
        
        if (numbers.length === 1) {
          // Simple integer: "145 kr."
          return parseFloat(numbers[0]);
        } else if (numbers.length === 2) {
          // Decimal: "145,50 kr."
          return parseFloat(`${numbers[0]}.${numbers[1]}`);
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Parse quantity from text
   */
  protected parseQuantity(text: string): string | undefined {
    for (const pattern of QUANTITY_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return match[0]; // Return full match like "25 cl"
      }
    }
    
    return undefined;
  }
  
  /**
   * Normalize dietary label from Danish to English
   */
  protected normalizeDietaryLabel(label: string): string {
    const lowerLabel = label.toLowerCase().trim();
    return DIETARY_LABEL_MAPPING[lowerLabel] || label;
  }
  
  /**
   * Normalize service period from Danish to English
   */
  protected normalizeServicePeriod(period: string): string {
    const lowerPeriod = period.toLowerCase().trim();
    return SERVICE_PERIOD_MAPPING[lowerPeriod] || period;
  }
  
  /**
   * Generate content hash for deduplication
   */
  protected hashContent(content: string): string {
    // Browser-compatible hash function (simple FNV-1a)
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < content.length; i++) {
      hash ^= content.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16).substring(0, 16).padStart(16, '0');
  }
  
  /**
   * Clean text for LLM input
   */
  protected cleanTextForLLM(text: string, maxLength: number = 60000): string {
    // Remove excessive whitespace
    let cleaned = text.replace(/\s+/g, ' ').trim();
    
    // Remove common noise patterns
    cleaned = cleaned.replace(/cookie|gdpr|accept|reject|privacy policy/gi, '');
    
    // Truncate if too long
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength);
    }
    
    return cleaned;
  }
  
  /**
   * Get all items from menu (flatten categories)
   */
  protected getAllItems(menu: NormalizedMenu): MenuItem[] {
    return menu.categories.flatMap(c => c.items);
  }
  
  /**
   * Create truncated text excerpt for evidence
   */
  protected createExcerpt(
    text: string,
    maxLength: number = 200
  ): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    
    return cleaned.substring(0, maxLength) + '...';
  }
  
  /**
   * Map generic JSON to NormalizedMenu
   * Override in subclasses for specific formats
   */
  protected mapToNormalizedSchema(data: any): NormalizedMenu | null {
    // This is a basic implementation
    // Subclasses should override with format-specific logic
    
    if (!data || typeof data !== 'object') {
      return null;
    }
    
    const categories = [];
    
    // Try to find categories array
    const categoriesData = 
      data.categories || 
      data.sections || 
      data.menuCategories ||
      data.menu?.categories;
    
    if (Array.isArray(categoriesData)) {
      for (const cat of categoriesData) {
        const items = [];
        const itemsData = cat.items || cat.dishes || cat.menuItems || [];
        
        for (const item of itemsData) {
          const prices: ItemPrice[] = [];
          
          // Try to extract price
          const priceData = item.price || item.prices?.[0] || item.amount;
          if (priceData) {
            const priceText = typeof priceData === 'object' 
              ? priceData.value || priceData.amount || priceData.price
              : priceData;
            
            prices.push({
              rawText: String(priceText),
              amount: this.parsePrice(String(priceText)),
              currency: item.currency || 'DKK'
            });
          }
          
          items.push({
            name: item.name || item.title || '',
            description: item.description || item.desc,
            prices,
            sourceEvidence: []
          });
        }
        
        if (items.length > 0) {
          categories.push({
            id: crypto.randomUUID(),
            name: cat.name || cat.title || 'Uncategorized',
            description: cat.description,
            items,
            sourceEvidence: []
          });
        }
      }
    }
    
    if (categories.length === 0) {
      return null;
    }
    
    return {
      title: data.title || data.name,
      description: data.description,
      language: data.language || 'da',
      currency: data.currency || 'DKK',
      categories,
      sourceEvidence: []
    };
  }
  
  /**
   * Validate that menu has minimum viable content
   */
  protected isViableMenu(menu: NormalizedMenu): boolean {
    const items = this.getAllItems(menu);
    
    // Must have at least 3 items
    if (items.length < 3) {
      return false;
    }
    
    // At least 50% must have names
    const itemsWithNames = items.filter(i => i.name && i.name.length > 0);
    if (itemsWithNames.length < items.length * 0.5) {
      return false;
    }
    
    // At least 30% must have prices
    const itemsWithPrices = items.filter(i => i.prices.length > 0);
    if (itemsWithPrices.length < items.length * 0.3) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Create evidence reference for DOM element
   */
  protected createDOMEvidence(
    selector: string,
    text: string
  ): EvidenceReference {
    return {
      type: 'dom_text',
      domSelector: selector,
      textExcerpt: this.createExcerpt(text),
      contentHash: this.hashContent(text)
    };
  }
  
  /**
   * Create evidence reference for JSON field
   */
  protected createJSONEvidence(
    jsonPath: string,
    value: any
  ): EvidenceReference {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return {
      type: 'json_field',
      jsonPath,
      textExcerpt: this.createExcerpt(text),
      contentHash: this.hashContent(text)
    };
  }
  
  /**
   * Create evidence reference for PDF
   */
  protected createPDFEvidence(
    page: number,
    text: string
  ): EvidenceReference {
    return {
      type: 'pdf_text',
      pdfPage: page,
      textExcerpt: this.createExcerpt(text),
      contentHash: this.hashContent(text)
    };
  }
}
