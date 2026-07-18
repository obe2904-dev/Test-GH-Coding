/**
 * Quality Scoring Framework
 * Multi-dimensional quality assessment for menu extractions
 */

import {
  ExtractionQuality,
  MenuCandidate,
  NormalizedMenu,
  MenuItem,
  SourceType,
} from './types';
import {
  QualityWarning,
  HardFailure,
  QUALITY_THRESHOLDS,
  NAVIGATION_KEYWORDS,
  CONFIG,
} from './constants';

export interface ScoringContext {
  itemCount: number;
  sourceType: SourceType;
  expectedCategories?: string[];
  otherCandidates?: MenuCandidate[];
}

export interface IQualityScorer {
  calculateQuality(candidate: MenuCandidate, context: ScoringContext): ExtractionQuality;
}

export class StandardQualityScorer implements IQualityScorer {
  /**
   * Calculate comprehensive quality scores
   */
  calculateQuality(candidate: MenuCandidate, context: ScoringContext): ExtractionQuality {
    const menu = candidate.menu;
    const items = this.getAllItems(menu);
    
    // 1. Coverage scores
    const itemNameCoverage = this.calculateItemNameCoverage(items);
    const priceCoverage = this.calculatePriceCoverage(items);
    const categoryCoverage = this.calculateCategoryCoverage(items);
    const descriptionCoverage = this.calculateDescriptionCoverage(items);
    
    // 2. Evidence score
    const evidenceScore = this.calculateEvidenceScore(items);
    
    // 3. Completeness score (weighted average of coverage)
    const completenessScore = this.calculateCompletenessScore(
      itemNameCoverage,
      priceCoverage,
      categoryCoverage,
      descriptionCoverage
    );
    
    // 4. Structural score (menu organization quality)
    const structuralScore = this.calculateStructuralScore(menu);
    
    // 5. Consistency score (internal contradictions)
    const consistencyScore = this.calculateConsistencyScore(menu, items);
    
    // 6. Overall score (weighted combination)
    const overallScore = this.calculateOverallScore(
      completenessScore,
      evidenceScore,
      structuralScore,
      consistencyScore
    );
    
    // 7. Warnings and failures
    const warningCodes = this.detectWarnings(menu, items, context);
    const hardFailureCodes = this.detectHardFailures(menu, items);
    
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
      warningCodes,
      hardFailureCodes
    };
  }
  
  /**
   * Calculate item name coverage
   */
  private calculateItemNameCoverage(items: MenuItem[]): number {
    if (items.length === 0) return 0;
    const itemsWithNames = items.filter(i => i.name && i.name.trim().length > 0);
    return itemsWithNames.length / items.length;
  }
  
  /**
   * Calculate price coverage
   */
  private calculatePriceCoverage(items: MenuItem[]): number {
    if (items.length === 0) return 0;
    const itemsWithPrices = items.filter(i => i.prices && i.prices.length > 0);
    return itemsWithPrices.length / items.length;
  }
  
  /**
   * Calculate category coverage
   */
  private calculateCategoryCoverage(items: MenuItem[]): number {
    if (items.length === 0) return 0;
    const itemsWithCategories = items.filter(i => i.categoryId);
    return itemsWithCategories.length / items.length;
  }
  
  /**
   * Calculate description coverage
   */
  private calculateDescriptionCoverage(items: MenuItem[]): number {
    if (items.length === 0) return 0;
    const itemsWithDescriptions = items.filter(i => i.description && i.description.length > 0);
    return itemsWithDescriptions.length / items.length;
  }
  
  /**
   * Calculate evidence score
   */
  private calculateEvidenceScore(items: MenuItem[]): number {
    if (items.length === 0) return 0;
    
    const itemsWithEvidence = items.filter(i => 
      i.sourceEvidence && i.sourceEvidence.length > 0
    );
    
    return itemsWithEvidence.length / items.length;
  }
  
  /**
   * Calculate completeness score (weighted average)
   */
  private calculateCompletenessScore(
    nameC: number,
    priceC: number,
    categoryC: number,
    descriptionC: number
  ): number {
    return (
      nameC * 0.4 +           // Names are critical
      priceC * 0.3 +          // Prices are very important
      categoryC * 0.2 +       // Categories are helpful
      descriptionC * 0.1      // Descriptions are nice-to-have
    );
  }
  
  /**
   * Calculate structural score
   */
  private calculateStructuralScore(menu: NormalizedMenu): number {
    let score = 1.0;
    
    // Penalize if no categories
    if (!menu.categories || menu.categories.length === 0) {
      score -= 0.3;
    }
    
    // Penalize if only one category (likely not properly organized)
    if (menu.categories && menu.categories.length === 1) {
      score -= 0.1;
    }
    
    // Penalize if categories are severely imbalanced
    if (menu.categories && menu.categories.length > 1) {
      const itemCounts = menu.categories.map(c => c.items.length);
      const max = Math.max(...itemCounts);
      const min = Math.min(...itemCounts);
      
      // One category has 10x more items than another
      if (max > min * 10) {
        score -= 0.2;
      }
    }
    
    // Bonus if service periods are defined
    if (menu.servicePeriods && menu.servicePeriods.length > 0) {
      score += 0.1;
    }
    
    // Bonus if menu has title
    if (menu.title && menu.title.length > 0) {
      score += 0.05;
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Calculate consistency score
   */
  private calculateConsistencyScore(menu: NormalizedMenu, items: MenuItem[]): number {
    let score = 1.0;
    
    // Check for price inconsistencies
    const prices = items
      .flatMap(i => i.prices.map(p => p.amount))
      .filter(p => p !== undefined) as number[];
    
    if (prices.length > 0) {
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      
      // Flag if max > min * 20 (e.g., 5 DKK and 500 DKK - likely error)
      if (maxPrice > minPrice * QUALITY_THRESHOLDS.MAX_PRICE_OUTLIER_RATIO) {
        score -= 0.2;
      }
      
      // Check if all prices are identical (likely extraction error)
      const uniquePrices = new Set(prices);
      if (uniquePrices.size === 1 && items.length > QUALITY_THRESHOLDS.MIN_ITEM_COUNT) {
        score -= 0.4;
      }
    }
    
    // Check for multiple currencies
    const currencies = items
      .flatMap(i => i.prices.map(p => p.currency))
      .filter(c => c !== undefined);
    const uniqueCurrencies = new Set(currencies);
    
    if (uniqueCurrencies.size > 1) {
      score -= 0.15;
    }
    
    // Check for duplicate items
    const itemNames = items.map(i => i.name.toLowerCase().trim());
    const duplicates = itemNames.filter((name, index) => 
      itemNames.indexOf(name) !== index
    );
    
    if (duplicates.length > items.length * QUALITY_THRESHOLDS.MAX_DUPLICATE_RATIO) {
      score -= 0.1 * (duplicates.length / items.length);
    }
    
    return Math.max(0, score);
  }
  
  /**
   * Calculate overall score
   */
  private calculateOverallScore(
    completeness: number,
    evidence: number,
    structural: number,
    consistency: number
  ): number {
    return (
      completeness * CONFIG.COMPLETENESS_WEIGHT +
      evidence * CONFIG.EVIDENCE_WEIGHT +
      structural * CONFIG.STRUCTURAL_WEIGHT +
      consistency * CONFIG.CONSISTENCY_WEIGHT
    );
  }
  
  /**
   * Detect quality warnings
   */
  private detectWarnings(
    menu: NormalizedMenu,
    items: MenuItem[],
    context: ScoringContext
  ): string[] {
    const warnings: string[] = [];
    
    // Low item count
    if (items.length < QUALITY_THRESHOLDS.MIN_ITEM_COUNT) {
      warnings.push(QualityWarning.WARN_FEW_ITEMS);
    }
    
    // Low price coverage
    const priceCoverage = this.calculatePriceCoverage(items);
    if (priceCoverage < 0.5) {
      warnings.push(QualityWarning.WARN_NO_PRICES_FOUND);
    }
    
    // No categories
    if (!menu.categories || menu.categories.length === 0) {
      warnings.push(QualityWarning.WARN_NO_CATEGORIES);
    }
    
    // Low evidence coverage
    const evidenceScore = this.calculateEvidenceScore(items);
    if (evidenceScore < QUALITY_THRESHOLDS.LOW_EVIDENCE) {
      warnings.push(QualityWarning.WARN_LOW_EVIDENCE);
    }
    
    // Multiple currencies
    const currencies = items.flatMap(i => i.prices.map(p => p.currency)).filter(Boolean);
    if (new Set(currencies).size > 1) {
      warnings.push(QualityWarning.WARN_MULTIPLE_CURRENCIES);
    }
    
    // Price outliers
    const prices = items.flatMap(i => i.prices.map(p => p.amount)).filter(p => p !== undefined) as number[];
    if (prices.length > 0) {
      const max = Math.max(...prices);
      const min = Math.min(...prices);
      if (max > min * QUALITY_THRESHOLDS.MAX_PRICE_OUTLIER_RATIO) {
        warnings.push(QualityWarning.WARN_PRICE_OUTLIERS);
      }
      
      // All same price
      if (new Set(prices).size === 1 && items.length > QUALITY_THRESHOLDS.MIN_ITEM_COUNT) {
        warnings.push(QualityWarning.WARN_DUPLICATE_PRICES);
      }
    }
    
    // Navigation keywords detected
    const navigationCount = items.filter(i => 
      NAVIGATION_KEYWORDS.some(kw => i.name.toLowerCase().includes(kw))
    ).length;
    if (navigationCount > items.length * QUALITY_THRESHOLDS.MAX_NAVIGATION_RATIO) {
      warnings.push(QualityWarning.WARN_NAVIGATION_DETECTED);
    }
    
    // Cookie banner text
    const allText = items.map(i => i.name + ' ' + (i.description || '')).join(' ').toLowerCase();
    if (allText.includes('cookie') && allText.includes('accept')) {
      warnings.push(QualityWarning.WARN_COOKIE_BANNER_TEXT);
    }
    
    // Sample menu
    if (menu.title?.toLowerCase().includes('sample') || 
        menu.description?.toLowerCase().includes('sample')) {
      warnings.push(QualityWarning.WARN_SAMPLE_MENU);
    }
    
    // Seasonal menu
    if (menu.title?.match(/sommer|vinter|efterår|forår|spring|summer|fall|winter/i)) {
      warnings.push(QualityWarning.WARN_SEASONAL_MENU);
    }
    
    // High duplicate ratio
    const itemNames = items.map(i => i.name.toLowerCase().trim());
    const duplicates = itemNames.filter((name, index) => itemNames.indexOf(name) !== index);
    if (duplicates.length > items.length * QUALITY_THRESHOLDS.MAX_DUPLICATE_RATIO) {
      warnings.push(QualityWarning.WARN_CONFLICTING_DATA);
    }
    
    return warnings;
  }
  
  /**
   * Detect hard failures
   */
  private detectHardFailures(menu: NormalizedMenu, items: MenuItem[]): string[] {
    const failures: string[] = [];
    
    // No items at all
    if (items.length === 0) {
      failures.push(HardFailure.HARD_FAIL_NO_ITEMS);
      return failures; // Early return, no point checking other failures
    }
    
    // All item names are very short (likely extraction error)
    const avgNameLength = items.reduce((sum, i) => sum + i.name.length, 0) / items.length;
    if (avgNameLength < 3) {
      failures.push(HardFailure.HARD_FAIL_INVALID_NAMES);
    }
    
    // More than 50% of items have no name
    const itemsWithoutName = items.filter(i => !i.name || i.name.trim().length === 0);
    if (itemsWithoutName.length > items.length * 0.5) {
      failures.push(HardFailure.HARD_FAIL_MISSING_NAMES);
    }
    
    return failures;
  }
  
  /**
   * Get all items from menu (flatten categories)
   */
  private getAllItems(menu: NormalizedMenu): MenuItem[] {
    return menu.categories.flatMap(c => c.items);
  }
}
