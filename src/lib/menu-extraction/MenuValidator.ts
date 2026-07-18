/**
 * Menu Validator
 * Rule-based validation to catch extraction errors
 */

import {
  NormalizedMenu,
  MenuItem,
  ExtractionContext,
  ValidationResult,
} from './types';
import {
  QualityWarning,
  HardFailure,
  QUALITY_THRESHOLDS,
  NAVIGATION_KEYWORDS,
} from './constants';

export class MenuValidator {
  /**
   * Validate extracted menu
   */
  validate(menu: NormalizedMenu, context: ExtractionContext): ValidationResult {
    const warnings: string[] = [];
    const hardFailures: string[] = [];
    
    const items = this.getAllItems(menu);
    
    // 1. Item count validation
    this.validateItemCount(items, warnings, hardFailures);
    
    // 2. Name validation
    this.validateItemNames(items, warnings, hardFailures);
    
    // 3. Navigation detection
    this.detectNavigation(items, warnings);
    
    // 4. Price validation
    this.validatePrices(items, warnings);
    
    // 5. Currency validation
    this.validateCurrencies(items, warnings);
    
    // 6. Category validation
    this.validateCategories(menu, warnings);
    
    // 7. Cookie banner detection
    this.detectCookieBanner(items, warnings);
    
    // 8. Sample menu detection
    this.detectSampleMenu(menu, warnings);
    
    // 9. Seasonal menu detection
    this.detectSeasonalMenu(menu, warnings);
    
    // 10. Duplicate detection
    this.detectDuplicates(items, warnings);
    
    return {
      valid: hardFailures.length === 0,
      warnings,
      hardFailures
    };
  }
  
  /**
   * Validate item count
   */
  private validateItemCount(
    items: MenuItem[],
    warnings: string[],
    hardFailures: string[]
  ): void {
    if (items.length === 0) {
      hardFailures.push(HardFailure.HARD_FAIL_NO_ITEMS);
    } else if (items.length < QUALITY_THRESHOLDS.MIN_ITEM_COUNT) {
      warnings.push(QualityWarning.WARN_FEW_ITEMS);
    }
  }
  
  /**
   * Validate item names
   */
  private validateItemNames(
    items: MenuItem[],
    warnings: string[],
    hardFailures: string[]
  ): void {
    if (items.length === 0) return;
    
    // Check for missing names
    const itemsWithoutName = items.filter(i => !i.name || i.name.trim().length === 0);
    if (itemsWithoutName.length > items.length * 0.5) {
      hardFailures.push(HardFailure.HARD_FAIL_MISSING_NAMES);
    }
    
    // Check for invalid names (too short)
    const avgNameLength = items.reduce((sum, i) => sum + i.name.length, 0) / items.length;
    if (avgNameLength < 3) {
      hardFailures.push(HardFailure.HARD_FAIL_INVALID_NAMES);
    }
  }
  
  /**
   * Detect navigation content
   */
  private detectNavigation(items: MenuItem[], warnings: string[]): void {
    const navigationCount = items.filter(i =>
      NAVIGATION_KEYWORDS.some(kw => i.name.toLowerCase().includes(kw))
    ).length;
    
    if (navigationCount > items.length * QUALITY_THRESHOLDS.MAX_NAVIGATION_RATIO) {
      warnings.push(QualityWarning.WARN_NAVIGATION_DETECTED);
    }
  }
  
  /**
   * Validate prices
   */
  private validatePrices(items: MenuItem[], warnings: string[]): void {
    // Check price coverage
    const itemsWithPrice = items.filter(i => i.prices.length > 0);
    const priceCoverage = itemsWithPrice.length / items.length;
    
    if (priceCoverage < 0.5) {
      warnings.push(QualityWarning.WARN_NO_PRICES_FOUND);
    }
    
    // Check price consistency
    const prices = itemsWithPrice
      .flatMap(i => i.prices.map(p => p.amount))
      .filter(p => p !== undefined) as number[];
    
    if (prices.length > 0) {
      const max = Math.max(...prices);
      const min = Math.min(...prices);
      
      // Outlier detection
      if (max > min * QUALITY_THRESHOLDS.MAX_PRICE_OUTLIER_RATIO) {
        warnings.push(QualityWarning.WARN_PRICE_OUTLIERS);
      }
      
      // All same price
      const uniquePrices = new Set(prices);
      if (uniquePrices.size === 1 && items.length > QUALITY_THRESHOLDS.MIN_ITEM_COUNT) {
        warnings.push(QualityWarning.WARN_DUPLICATE_PRICES);
      }
    }
  }
  
  /**
   * Validate currencies
   */
  private validateCurrencies(items: MenuItem[], warnings: string[]): void {
    const currencies = items
      .flatMap(i => i.prices.map(p => p.currency))
      .filter(c => c !== undefined);
    
    const uniqueCurrencies = new Set(currencies);
    if (uniqueCurrencies.size > 1) {
      warnings.push(QualityWarning.WARN_MULTIPLE_CURRENCIES);
    }
  }
  
  /**
   * Validate categories
   */
  private validateCategories(menu: NormalizedMenu, warnings: string[]): void {
    if (!menu.categories || menu.categories.length === 0) {
      warnings.push(QualityWarning.WARN_NO_CATEGORIES);
    }
  }
  
  /**
   * Detect cookie banner text
   */
  private detectCookieBanner(items: MenuItem[], warnings: string[]): void {
    const allText = items
      .map(i => i.name + ' ' + (i.description || ''))
      .join(' ')
      .toLowerCase();
    
    if (allText.includes('cookie') && allText.includes('accept')) {
      warnings.push(QualityWarning.WARN_COOKIE_BANNER_TEXT);
    }
  }
  
  /**
   * Detect sample menu
   */
  private detectSampleMenu(menu: NormalizedMenu, warnings: string[]): void {
    const title = menu.title?.toLowerCase() || '';
    const description = menu.description?.toLowerCase() || '';
    
    if (title.includes('sample') || description.includes('sample') ||
        title.includes('eksempel') || description.includes('eksempel')) {
      warnings.push(QualityWarning.WARN_SAMPLE_MENU);
    }
  }
  
  /**
   * Detect seasonal menu
   */
  private detectSeasonalMenu(menu: NormalizedMenu, warnings: string[]): void {
    const title = menu.title || '';
    
    if (title.match(/sommer|vinter|efterår|forår|spring|summer|fall|winter/i)) {
      warnings.push(QualityWarning.WARN_SEASONAL_MENU);
    }
  }
  
  /**
   * Detect duplicates
   */
  private detectDuplicates(items: MenuItem[], warnings: string[]): void {
    const itemNames = items.map(i => i.name.toLowerCase().trim());
    const duplicates = itemNames.filter((name, index) =>
      itemNames.indexOf(name) !== index
    );
    
    if (duplicates.length > items.length * QUALITY_THRESHOLDS.MAX_DUPLICATE_RATIO) {
      warnings.push(QualityWarning.WARN_CONFLICTING_DATA);
    }
  }
  
  /**
   * Get all items from menu
   */
  private getAllItems(menu: NormalizedMenu): MenuItem[] {
    return menu.categories.flatMap(c => c.items);
  }
}
