/**
 * Semantic DOM Extraction Strategy
 * Handles well-structured HTML with semantic attributes, ARIA labels, and clean markup
 */

import { BaseStrategy } from '../BaseStrategy';
import {
  SourceType,
  ExtractionContext,
  ExtractionResult,
  MenuCandidate,
  NormalizedMenu,
  MenuItem,
  MenuCategory,
  ItemPrice,
  EvidenceReference,
} from '../types';
import { StrategyError } from '../constants';

export class SemanticDOMStrategy extends BaseStrategy {
  readonly name = 'semantic_dom';
  readonly version = '1.0.0';
  
  /**
   * Check if strategy can handle this source
   */
  canHandle(context: ExtractionContext): boolean {
    // Defensive: check context and artifacts exist
    if (!context || !context.artifacts) {
      return false;
    }

    const html = context.artifacts.renderedHtml || context.artifacts.initialHtml;
    if (!html) return false;
    
    // Look for semantic menu markup
    const hasSemanticMarkup = 
      html.includes('data-menu') ||
      html.includes('role="menu"') ||
      html.includes('itemtype="http://schema.org/Menu') ||
      html.includes('class="menu-item') ||
      html.includes('class="dish') ||
      html.includes('data-dish') ||
      html.includes('data-item-name') ||
      html.includes('data-price');
    
    return hasSemanticMarkup;
  }
  
  /**
   * Extract menu from semantic HTML
   */
  async extract(context: ExtractionContext): Promise<ExtractionResult> {
    this.startTime = Date.now();
    this.warnings = [];
    
    const html = context.artifacts.renderedHtml || context.artifacts.initialHtml;
    if (!html) {
      return this.failed(StrategyError.STRATEGY_INSUFFICIENT_DATA, 'No HTML available');
    }
    
    try {
      // Parse HTML (simplified - in real implementation would use DOM parser)
      const categories = await this.extractCategories(html, context);
      
      if (categories.length === 0) {
        return this.failed(StrategyError.STRATEGY_NOT_APPLICABLE, 'No menu categories found');
      }
      
      const menu: NormalizedMenu = {
        title: this.extractMenuTitle(html) || 'Menu',
        description: undefined,
        categories,
        language: 'da',
        currency: 'DKK',
        sourceEvidence: [{
          type: 'dom_text',
          domSelector: 'body',
          textExcerpt: html.substring(0, 200),
          contentHash: this.hashContent(html),
        }],
      };
      
      if (!this.isViableMenu(menu)) {
        return this.failed(StrategyError.STRATEGY_NOT_APPLICABLE, 'No viable menu found');
      }
      
      return {
        status: 'success',
        candidates: [{
          menu,
          strategy: this.name,
          quality: {
            overallScore: 0.6,
            completenessScore: 0.6,
            evidenceScore: 0.7,
            structuralScore: 0.6,
            consistencyScore: 0.5,
            itemNameCoverage: 0.7,
            priceCoverage: 0.5,
            categoryCoverage: 0.8,
            descriptionCoverage: 0.3,
            warningCodes: [],
            hardFailureCodes: [],
          },
        }],
        evidence: menu.sourceEvidence || [],
        diagnostics: this.createDiagnostics(),
      };
      
    } catch (error: any) {
      return this.failed(StrategyError.STRATEGY_PARSE_FAILED, error.message);
    }
  }
  
  /**
   * Extract menu title from HTML
   */
  private extractMenuTitle(html: string): string | undefined {
    // Look for menu title in various places
    const patterns = [
      /<h1[^>]*class="[^"]*menu[^"]*"[^>]*>(.*?)<\/h1>/i,
      /<h2[^>]*class="[^"]*menu[^"]*"[^>]*>(.*?)<\/h2>/i,
      /<div[^>]*data-menu-title[^>]*>(.*?)<\/div>/i,
      /<[^>]*class="menu-title"[^>]*>(.*?)<\//i,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        return this.stripHtml(match[1]);
      }
    }
    
    return undefined;
  }
  
  /**
   * Extract categories from HTML
   */
  private async extractCategories(
    html: string,
    context: ExtractionContext
  ): Promise<MenuCategory[]> {
    const categories: MenuCategory[] = [];
    
    // Strategy 1: Look for data-category or similar attributes
    const categoryPatterns = [
      /<div[^>]*data-category="([^"]*)"[^>]*>(.*?)<\/div>/g,
      /<section[^>]*class="[^"]*menu-category[^"]*"[^>]*>(.*?)<\/section>/g,
      /<div[^>]*class="[^"]*category[^"]*"[^>]*>(.*?)<\/div>/g,
    ];
    
    for (const pattern of categoryPatterns) {
      const matches = Array.from(html.matchAll(pattern));
      for (const match of matches) {
        const categoryHtml = match[match.length - 1]; // Last capture group
        const categoryName = this.extractCategoryName(categoryHtml);
        const items = await this.extractItems(categoryHtml, context);
        
        if (items.length > 0) {
          categories.push({
            id: this.hashContent(categoryName),
            name: categoryName,
            description: undefined,
            items,
            sourceEvidence: [],
          });
        }
      }
    }
    
    // Strategy 2: If no categories found, extract all items into "Main Menu"
    if (categories.length === 0) {
      const allItems = await this.extractItems(html, context);
      if (allItems.length > 0) {
        categories.push({
          id: this.hashContent('main-menu'),
          name: 'Main Menu',
          description: undefined,
          items: allItems,
          sourceEvidence: [],
        });
      }
    }
    
    return categories;
  }
  
  /**
   * Extract category name from HTML
   */
  private extractCategoryName(html: string): string {
    // Look for headings
    const patterns = [
      /<h2[^>]*>(.*?)<\/h2>/i,
      /<h3[^>]*>(.*?)<\/h3>/i,
      /<h4[^>]*>(.*?)<\/h4>/i,
      /<div[^>]*class="[^"]*category-name[^"]*"[^>]*>(.*?)<\/div>/i,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        return this.stripHtml(match[1]);
      }
    }
    
    return 'Category';
  }
  
  /**
   * Extract menu items from HTML
   */
  private async extractItems(
    html: string,
    context: ExtractionContext
  ): Promise<MenuItem[]> {
    const items: MenuItem[] = [];
    
    // Look for menu items with various patterns
    const itemPatterns = [
      /<div[^>]*data-menu-item[^>]*>(.*?)<\/div>/g,
      /<li[^>]*class="[^"]*menu-item[^"]*"[^>]*>(.*?)<\/li>/g,
      /<div[^>]*class="[^"]*dish[^"]*"[^>]*>(.*?)<\/div>/g,
      /<article[^>]*class="[^"]*item[^"]*"[^>]*>(.*?)<\/article>/g,
    ];
    
    for (const pattern of itemPatterns) {
      const matches = Array.from(html.matchAll(pattern));
      for (const match of matches) {
        const itemHtml = match[1];
        const item = this.parseMenuItem(itemHtml, context);
        if (item && item.name) {
          items.push(item);
        }
      }
    }
    
    return items;
  }
  
  /**
   * Parse individual menu item from HTML
   */
  private parseMenuItem(html: string, context: ExtractionContext): MenuItem | null {
    // Extract name
    const name = this.extractItemName(html);
    if (!name) return null;
    
    // Extract description
    const description = this.extractItemDescription(html);
    
    // Extract prices
    const prices = this.extractItemPrices(html);
    
    // Extract dietary labels
    const dietaryLabels = this.extractDietaryLabels(html);
    
    // Create evidence
    const evidence: EvidenceReference[] = [{
      type: 'dom_text',
      domSelector: '[data-menu-item]',
      textExcerpt: this.stripHtml(html).substring(0, 100),
      contentHash: this.hashContent(html),
    }];
    
    return {
      name,
      description,
      prices,
      variants: [],
      dietaryLabels,
      sourceEvidence: evidence,
    };
  }
  
  /**
   * Extract item name from HTML
   */
  private extractItemName(html: string): string | undefined {
    const patterns = [
      /<[^>]*data-item-name="([^"]*)"/i,
      /<h3[^>]*>(.*?)<\/h3>/i,
      /<h4[^>]*>(.*?)<\/h4>/i,
      /<strong[^>]*>(.*?)<\/strong>/i,
      /<span[^>]*class="[^"]*name[^"]*"[^>]*>(.*?)<\/span>/i,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const name = this.stripHtml(match[1]);
        if (name && name.length > 0 && name.length < 100) {
          return name;
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Extract item description from HTML
   */
  private extractItemDescription(html: string): string | undefined {
    const patterns = [
      /<[^>]*data-description="([^"]*)"/i,
      /<p[^>]*>(.*?)<\/p>/i,
      /<span[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/span>/i,
      /<div[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/div>/i,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const description = this.stripHtml(match[1]);
        if (description && description.length > 0 && description.length < 500) {
          return description;
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Extract prices from HTML
   */
  private extractItemPrices(html: string): ItemPrice[] {
    const prices: ItemPrice[] = [];
    
    // Look for data-price attribute
    const dataPrice = html.match(/<[^>]*data-price="([^"]*)"/i);
    if (dataPrice) {
      const amount = this.parsePrice(dataPrice[1]);
      if (amount !== undefined) {
        prices.push({
          amount,
          currency: 'DKK',
          rawText: dataPrice[1],
        });
        return prices;
      }
    }
    
    // Look for price in text
    const pricePatterns = [
      /<span[^>]*class="[^"]*price[^"]*"[^>]*>(.*?)<\/span>/i,
      /<div[^>]*class="[^"]*price[^"]*"[^>]*>(.*?)<\/div>/i,
      /<p[^>]*class="[^"]*price[^"]*"[^>]*>(.*?)<\/p>/i,
    ];
    
    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match) {
        const priceText = this.stripHtml(match[1]);
        const amount = this.parsePrice(priceText);
        if (amount !== undefined) {
          prices.push({
            amount,
            currency: 'DKK',
            rawText: priceText,
          });
          return prices;
        }
      }
    }
    
    return prices;
  }
  
  /**
   * Extract dietary labels from HTML
   */
  private extractDietaryLabels(html: string): string[] {
    const labels: string[] = [];
    
    // Look for data attributes
    const patterns = [
      /data-dietary="([^"]*)"/gi,
      /class="[^"]*vegetar[^"]*"/gi,
      /class="[^"]*vegan[^"]*"/gi,
      /class="[^"]*glutenfri[^"]*"/gi,
    ];
    
    for (const pattern of patterns) {
      const matches = Array.from(html.matchAll(pattern));
      for (const match of matches) {
        const label = this.normalizeDietaryLabel(match[1] || match[0]);
        if (label && !labels.includes(label)) {
          labels.push(label);
        }
      }
    }
    
    return labels;
  }
  
  /**
   * Strip HTML tags from string
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }
}
