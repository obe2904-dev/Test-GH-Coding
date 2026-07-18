/**
 * Structured JSON Extraction Strategy
 * Handles Schema.org Menu, JSON-LD, and Next.js page data
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

export class StructuredJSONStrategy extends BaseStrategy {
  readonly name = 'structured_json';
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
    
    // Look for JSON-LD script tags
    const hasJsonLd = html.includes('application/ld+json') || 
                      html.includes('type="application/ld+json"');
    
    // Look for structured menu data
    const hasSchemaMenu = html.includes('"@type":"Menu"') || 
                         html.includes('"@type": "Menu"');
    
    // Look for Next.js data
    const hasNextData = html.includes('id="__NEXT_DATA__"');
    
    return hasJsonLd || hasSchemaMenu || hasNextData;
  }
  
  /**
   * Extract menu from structured JSON
   */
  async extract(context: ExtractionContext): Promise<ExtractionResult> {
    this.startTime = Date.now();
    this.warnings = [];
    const html = context.artifacts.renderedHtml || context.artifacts.initialHtml;
    if (!html) {
      return this.failed(StrategyError.STRATEGY_INSUFFICIENT_DATA, 'No HTML available');
    }
    
    try {
      // 1. Try Schema.org Menu
      const schemaResult = await this.trySchemaOrgMenu(html, context);
      if (schemaResult) {
        return schemaResult;
      }
      
      // 2. Try Next.js page data
      const nextResult = await this.tryNextData(html, context);
      if (nextResult) {
        return nextResult;
      }
      
      // 3. Try generic JSON-LD
      const jsonLdResult = await this.tryJsonLd(html, context);
      if (jsonLdResult) {
        return jsonLdResult;
      }
      
      return this.noMenuFound();
      
    } catch (error: any) {
      return this.failed(StrategyError.STRATEGY_PARSE_FAILED, error.message);
    }
  }
  
  /**
   * Try Schema.org Menu extraction
   */
  private async trySchemaOrgMenu(
    html: string,
    context: ExtractionContext
  ): Promise<ExtractionResult | null> {
    // Extract JSON-LD blocks
    const jsonLdBlocks = this.extractJsonLdBlocks(html);
    
    // Find Menu types
    const menuBlocks = jsonLdBlocks.filter(block => {
      const type = block['@type'];
      return type === 'Menu' || 
             type === 'MenuSection' || 
             (Array.isArray(type) && type.includes('Menu'));
    });
    
    if (menuBlocks.length === 0) return null;
    
    // Convert to normalized format
    const menu = this.convertSchemaOrgToNormalized(menuBlocks, context);
    
    if (!this.isViableMenu(menu)) {
      return null;
    }
    
    return {
      status: 'success',
      candidates: [{
        menu,
        strategy: this.name,
        quality: {
          overallScore: 0.9,
          completenessScore: 0.9,
          evidenceScore: 0.95,
          structuralScore: 0.9,
          consistencyScore: 0.85,
          itemNameCoverage: 0.95,
          priceCoverage: 0.85,
          categoryCoverage: 0.9,
          descriptionCoverage: 0.7,
          warningCodes: [],
          hardFailureCodes: [],
        },
      }],
      evidence: menu.sourceEvidence || [],
      diagnostics: this.createDiagnostics(),
    };
  }
  
  /**
   * Try Next.js page data extraction
   */
  private async tryNextData(
    html: string,
    context: ExtractionContext
  ): Promise<ExtractionResult | null> {
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/);
    if (!match) return null;
    
    try {
      const nextData = JSON.parse(match[1]);
      
      // Look for menu data in props
      const menuData = this.findMenuDataInObject(nextData.props?.pageProps);
      if (!menuData) return null;
      
      // Convert to normalized format
      const menu = this.convertGenericJsonToNormalized(menuData, context, 'next-data');
      
      if (!this.isViableMenu(menu)) {
        return null;
      }
      
      return {
        status: 'success',
        candidates: [{
          menu,
          strategy: this.name,
          quality: {
            overallScore: 0.85,
            completenessScore: 0.85,
            evidenceScore: 0.9,
            structuralScore: 0.85,
            consistencyScore: 0.8,
            itemNameCoverage: 0.9,
            priceCoverage: 0.8,
            categoryCoverage: 0.85,
            descriptionCoverage: 0.6,
            warningCodes: [],
            hardFailureCodes: [],
          },
        }],
        evidence: menu.sourceEvidence || [],
        diagnostics: this.createDiagnostics(),
      };
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Try generic JSON-LD extraction
   */
  private async tryJsonLd(
    html: string,
    context: ExtractionContext
  ): Promise<ExtractionResult | null> {
    const jsonLdBlocks = this.extractJsonLdBlocks(html);
    
    for (const block of jsonLdBlocks) {
      const menuData = this.findMenuDataInObject(block);
      if (menuData) {
        const menu = this.convertGenericJsonToNormalized(menuData, context, 'json-ld');
        if (this.isViableMenu(menu)) {
          return {
            status: 'success',
            candidates: [{
              menu,
              strategy: this.name,
              quality: {
                overallScore: 0.8,
                completenessScore: 0.8,
                evidenceScore: 0.85,
                structuralScore: 0.8,
                consistencyScore: 0.75,
                itemNameCoverage: 0.85,
                priceCoverage: 0.75,
                categoryCoverage: 0.8,
                descriptionCoverage: 0.5,
                warningCodes: [],
                hardFailureCodes: [],
              },
            }],
            evidence: menu.sourceEvidence || [],
            diagnostics: this.createDiagnostics(),
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extract all JSON-LD blocks from HTML
   */
  private extractJsonLdBlocks(html: string): any[] {
    const blocks: any[] = [];
    const regex = /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/g;
    
    let match;
    while ((match = regex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        blocks.push(parsed);
      } catch (error) {
        continue;
      }
    }
    
    return blocks;
  }
  
  /**
   * Convert Schema.org Menu to normalized format
   */
  private convertSchemaOrgToNormalized(
    menuBlocks: any[],
    context: ExtractionContext
  ): NormalizedMenu {
    const categories: MenuCategory[] = [];
    
    for (const block of menuBlocks) {
      // Handle MenuSection
      if (block['@type'] === 'MenuSection' || 
          (Array.isArray(block['@type']) && block['@type'].includes('MenuSection'))) {
        const category = this.convertSchemaSection(block, context);
        if (category) {
          categories.push(category);
        }
      }
      
      // Handle Menu with hasMenuSection
      if (block.hasMenuSection) {
        const sections = Array.isArray(block.hasMenuSection) 
          ? block.hasMenuSection 
          : [block.hasMenuSection];
        
        for (const section of sections) {
          const category = this.convertSchemaSection(section, context);
          if (category) {
            categories.push(category);
          }
        }
      }
      
      // Handle Menu with MenuItem directly
      if (block.hasMenuItem) {
        const items = Array.isArray(block.hasMenuItem) 
          ? block.hasMenuItem 
          : [block.hasMenuItem];
        
        categories.push({
          id: this.hashContent(JSON.stringify(block)),
          name: block.name || 'Main Menu',
          description: block.description,
          items: items.map((item: any) => this.convertSchemaMenuItem(item, context)),
          sourceEvidence: [],
        });
      }
    }
    
    return {
      title: menuBlocks[0]?.name || 'Menu',
      description: menuBlocks[0]?.description,
      categories,
      language: 'da',
      currency: 'DKK',
      sourceEvidence: [{
        type: 'json_field',
        jsonPath: '$["@type"]',
        textExcerpt: JSON.stringify(menuBlocks[0]).substring(0, 200),
        contentHash: this.hashContent(JSON.stringify(menuBlocks)),
      }],
    };
  }
  
  /**
   * Convert Schema.org MenuSection to MenuCategory
   */
  private convertSchemaSection(section: any, context: ExtractionContext): MenuCategory | null {
    if (!section.hasMenuItem) return null;
    
    const items = Array.isArray(section.hasMenuItem) 
      ? section.hasMenuItem 
      : [section.hasMenuItem];
    
    return {
      id: this.hashContent(JSON.stringify(section)),
      name: section.name || 'Category',
      description: section.description,
      items: items.map((item: any) => this.convertSchemaMenuItem(item, context)),
      sourceEvidence: [],
    };
  }
  
  /**
   * Convert Schema.org MenuItem to normalized MenuItem
   */
  private convertSchemaMenuItem(item: any, context: ExtractionContext): MenuItem {
    const prices: ItemPrice[] = [];
    
    // Extract offers (prices)
    if (item.offers) {
      const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
      for (const offer of offers) {
        if (offer.price || offer.lowPrice) {
          prices.push({
            amount: parseFloat(offer.price || offer.lowPrice),
            currency: offer.priceCurrency || 'DKK',
            rawText: String(offer.price || offer.lowPrice),
          });
        }
      }
    }
    
    return {
      name: item.name || 'Unknown Item',
      description: item.description,
      prices,
      variants: [],
      dietaryLabels: [],
      sourceEvidence: [{
        type: 'json_field',
        jsonPath: '$.name',
        textExcerpt: item.name,
        contentHash: this.hashContent(JSON.stringify(item)),
      }],
    };
  }
  
  /**
   * Convert generic JSON to normalized format
   */
  private convertGenericJsonToNormalized(
    data: any,
    context: ExtractionContext,
    sourcePath: string
  ): NormalizedMenu {
    const menu = this.mapToNormalizedSchema(data);
    if (menu) {
      // Add JSON-specific evidence
      menu.sourceEvidence = menu.sourceEvidence || [];
      menu.sourceEvidence.push({
        type: 'json_field',
        jsonPath: sourcePath,
        textExcerpt: JSON.stringify(data).substring(0, 200),
        contentHash: this.hashContent(JSON.stringify(data)),
      });
    }
    return menu!;
  }
  
  /**
   * Find menu data in nested object
   */
  private findMenuDataInObject(obj: any, maxDepth: number = 5): any {
    if (!obj || maxDepth === 0) return null;
    
    // Check current level
    if (this.looksLikeMenuData(obj)) {
      return obj;
    }
    
    // Recurse into properties
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object') {
        const result = this.findMenuDataInObject(obj[key], maxDepth - 1);
        if (result) return result;
      }
    }
    
    return null;
  }
  
  /**
   * Check if object looks like menu data
   */
  private looksLikeMenuData(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    
    const hasMenuKeys = ['menu', 'menuItems', 'categories', 'sections', 'items']
      .some(key => key in obj || key.toLowerCase() in obj);
    
    if (!hasMenuKeys) return false;
    
    // Check if it has array of items
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key]) && obj[key].length > 0) {
        const firstItem = obj[key][0];
        if (typeof firstItem === 'object' && ('name' in firstItem || 'title' in firstItem)) {
          return true;
        }
      }
    }
    
    return false;
  }
}
