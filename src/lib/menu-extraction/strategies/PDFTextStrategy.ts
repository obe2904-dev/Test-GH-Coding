/**
 * PDF Text Extraction Strategy
 * Handles PDFs with selectable text using GPT-4 for structured extraction
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
import { StrategyError, CONFIG } from '../constants';

export class PDFTextStrategy extends BaseStrategy {
  readonly name = 'pdf_text';
  readonly version = '1.0.0';
  
  /**
   * Check if strategy can handle this source
   */
  canHandle(context: ExtractionContext): boolean {
    // Check if source is PDF
    const isPdf = context.sourceType === SourceType.PDF_DIRECT ||
                  context.sourceUrl.toLowerCase().endsWith('.pdf');
    
    if (!isPdf) return false;
    
    // Check if we have visible text (indicates text layer)
    const visibleText = context.artifacts.visibleText;
    if (!visibleText || visibleText.trim().length < 100) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Extract menu from PDF text
   */
  async extract(context: ExtractionContext): Promise<ExtractionResult> {
    this.startTime = Date.now();
    this.warnings = [];
    
    const visibleText = context.artifacts.visibleText;
    if (!visibleText) {
      return this.failed(StrategyError.STRATEGY_INSUFFICIENT_DATA, 'No PDF text available');
    }
    
    try {
      // Clean and truncate text
      const cleanedText = this.cleanTextForLLM(visibleText);
      
      // Use OpenAI to extract structured data
      const extracted = await this.extractWithOpenAI(cleanedText, context);
      
      // Validate result
      if (!this.isViableMenu(extracted)) {
        return this.failed(StrategyError.STRATEGY_NOT_APPLICABLE, 'No viable menu found');
      }
      
      return {
        status: 'success',
        candidates: [{
          menu: extracted,
          strategy: this.name,
          quality: {
            overallScore: 0.7,
            completenessScore: 0.7,
            evidenceScore: 0.8,
            structuralScore: 0.7,
            consistencyScore: 0.6,
            itemNameCoverage: 0.8,
            priceCoverage: 0.7,
            categoryCoverage: 0.6,
            descriptionCoverage: 0.5,
            warningCodes: [],
            hardFailureCodes: [],
          },
        }],
        evidence: extracted.sourceEvidence || [],
        diagnostics: this.createDiagnostics(),
      };
      
    } catch (error: any) {
      return this.failed(StrategyError.STRATEGY_PARSE_FAILED, error.message);
    }
  }
  
  /**
   * Extract structured menu using OpenAI
   */
  private async extractWithOpenAI(
    pdfText: string,
    context: ExtractionContext
  ): Promise<NormalizedMenu> {
    const prompt = this.buildExtractionPrompt(pdfText);
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a menu extraction expert. Extract restaurant menu data from text and return it as structured JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: CONFIG.LLM_TEMPERATURE,
        max_tokens: CONFIG.LLM_MAX_TOKENS,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const result = await response.json();
    const content = result.choices[0].message.content;
    const parsed = JSON.parse(content);
    
    // Convert to normalized format
    return this.convertOpenAIResponseToNormalized(parsed, context, pdfText);
  }
  
  /**
   * Build extraction prompt for OpenAI
   */
  private buildExtractionPrompt(pdfText: string): string {
    return `
Extract menu data from this Danish restaurant menu PDF text.

Instructions:
- Extract all menu items with their names, descriptions, and prices
- Organize items into categories (e.g., "Forretter", "Hovedretter", "Desserter")
- Extract prices in Danish format (145,- or 145 kr. or 145 DKK)
- Extract quantities (25 cl, 200 g, etc.)
- Identify dietary labels (vegetar, vegansk, glutenfri)
- Identify service periods if mentioned (frokost, middag, etc.)

Return JSON with this structure:
{
  "menu": {
    "title": "Menu title",
    "categories": [
      {
        "name": "Category name",
        "items": [
          {
            "name": "Item name",
            "description": "Item description",
            "price": 145.0,
            "priceRaw": "145,-",
            "quantity": "25 cl",
            "dietaryLabels": ["vegetarian"],
            "servicePeriod": "lunch"
          }
        ]
      }
    ]
  }
}

PDF Text:
${pdfText}

Respond with only valid JSON, no markdown or explanations.
`.trim();
  }
  
  /**
   * Convert OpenAI response to normalized format
   */
  private convertOpenAIResponseToNormalized(
    openaiResponse: any,
    context: ExtractionContext,
    sourceText: string
  ): NormalizedMenu {
    const menu = openaiResponse.menu || openaiResponse;
    
    const categories: MenuCategory[] = (menu.categories || []).map((cat: any) => ({
      id: this.hashContent(JSON.stringify(cat)),
      name: cat.name,
      description: cat.description,
      items: (cat.items || []).map((item: any) => this.convertOpenAIItem(item, sourceText)),
    }));
    
    return {
      title: menu.title || 'Menu',
      description: menu.description,
      categories,
      language: 'da',
      currency: 'DKK',
      sourceEvidence: [{
        type: 'pdf_text',
        pdfPage: 1,
        textExcerpt: sourceText.substring(0, 200),
        contentHash: this.hashContent(sourceText),
      }],
    };
  }
  
  /**
   * Convert OpenAI item to normalized MenuItem
   */
  private convertOpenAIItem(item: any, sourceText: string): MenuItem {
    const prices: ItemPrice[] = [];
    
    if (item.price !== undefined) {
      prices.push({
        amount: typeof item.price === 'number' ? item.price : this.parsePrice(item.price),
        currency: 'DKK',
        rawText: item.priceRaw || String(item.price),
      });
    }
    
    // Extract dietary labels
    const dietaryLabels = (item.dietaryLabels || []).map((label: string) =>
      this.normalizeDietaryLabel(label)
    );
    
    // Create evidence reference
    const evidence: EvidenceReference[] = [];
    
    // Find item name in source text
    const nameIndex = sourceText.indexOf(item.name);
    if (nameIndex !== -1) {
      evidence.push({
        type: 'pdf_text',
        pdfPage: 1,
        textExcerpt: sourceText.substring(nameIndex, nameIndex + 100),
        contentHash: this.hashContent(item.name),
      });
    }
    
    return {
      name: item.name,
      description: item.description,
      prices,
      variants: [],
      dietaryLabels,
      sourceEvidence: evidence,
      availability: item.servicePeriod ? {
        servicePeriod: this.normalizeServicePeriod(item.servicePeriod),
      } : undefined,
    };
  }
}
