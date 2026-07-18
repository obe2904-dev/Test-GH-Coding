/**
 * Image OCR Extraction Strategy
 * Handles scanned PDFs and menu images using OCR + GPT-4 for structured extraction
 * 
 * Use Cases:
 * - Scanned PDF menus (no text layer)
 * - Menu images in galleries
 * - Instagram/social media menu posts
 * 
 * High frequency in F&B: ~40% of Danish restaurants use scanned menus
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

interface OCRResponse {
  success: boolean;
  text: string;
  confidence: number;
  imageUrl: string;
  error?: string;
}

export class ImageOCRStrategy extends BaseStrategy {
  readonly name = 'image_ocr';
  readonly version = '1.0.0';
  
  private ocrEndpoint: string;
  private downloadPdfEndpoint: string;
  private extractPdfEndpoint: string;
  private supabaseKey: string;
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    super();
    this.ocrEndpoint = `${supabaseUrl}/functions/v1/ocr-menu`;
    this.downloadPdfEndpoint = `${supabaseUrl}/functions/v1/download-menu-pdf`;
    this.extractPdfEndpoint = `${supabaseUrl}/functions/v1/extract-pdf-text`;
    this.supabaseKey = supabaseKey;
  }
  
  /**
   * Check if strategy can handle this source
   */
  canHandle(context: ExtractionContext): boolean {
    // Defensive: check context exists
    if (!context || !context.artifacts) {
      console.log('⚠️ ImageOCRStrategy.canHandle: context or artifacts missing');
      return false;
    }

    console.log('🔍 ImageOCRStrategy.canHandle:', {
      sourceType: context.sourceType,
      hasMenuDiscovery: !!context.artifacts.menu_discovery,
      menuDiscoveryCount: context.artifacts.menu_discovery?.length || 0,
    });

    // Handle IMAGE_GALLERY type
    if (context.sourceType === SourceType.IMAGE_GALLERY) {
      console.log('✅ ImageOCRStrategy selected: sourceType is IMAGE_GALLERY');
      return true;
    }
    
    // Handle scanned PDFs (PDF without text layer)
    if (context.sourceType === SourceType.PDF_DIRECT) {
      const visibleText = context.artifacts?.visibleText;
      // If PDF has no text or very little text, it's likely scanned
      if (!visibleText || visibleText.trim().length < 100) {
        console.log('✅ ImageOCRStrategy selected: scanned PDF detected (no text layer)');
        return true;
      }
    }
    
    // Check if menu_discovery indicates OCR is required
    const menuDiscovery = context.artifacts.menu_discovery;
    if (menuDiscovery && Array.isArray(menuDiscovery)) {
      const requiresOcr = menuDiscovery.some((d: any) => 
        d.extractionMethod === 'ocr_required' ||
        d.structure === 'image_gallery'
      );
      if (requiresOcr) {
        console.log('✅ ImageOCRStrategy selected: menu_discovery indicates OCR required');
        return true;
      }
    }
    
    console.log('❌ ImageOCRStrategy not applicable for this source');
    return false;
  }
  
  /**
   * Extract menu from images using OCR + GPT-4
   */
  async extract(context: ExtractionContext): Promise<ExtractionResult> {
    this.startTime = Date.now();
    this.warnings = [];
    
    try {
      // Step 1: Get image URLs from menu_discovery
      const imageUrls = this.extractImageUrls(context);
      
      if (imageUrls.length === 0) {
        return this.failed(StrategyError.STRATEGY_INSUFFICIENT_DATA, 'No menu images found');
      }
      
      console.log(`🖼️ Found ${imageUrls.length} menu images for OCR`);
      
      // Step 2: Perform OCR on all images
      const ocrResults = await this.performOCROnImages(imageUrls, context);
      
      if (ocrResults.length === 0 || ocrResults.every(r => !r.success)) {
        return this.failed(StrategyError.STRATEGY_EXTERNAL_SERVICE_FAILED, 'OCR failed for all images');
      }
      
      // Step 3: Combine OCR text
      const combinedText = ocrResults
        .filter(r => r.success && r.text)
        .map(r => r.text)
        .join('\n\n--- Next Page ---\n\n');
      
      if (!combinedText || combinedText.trim().length < 50) {
        return this.failed(StrategyError.STRATEGY_INSUFFICIENT_DATA, 'OCR extracted too little text');
      }
      
      console.log(`📝 OCR extracted ${combinedText.length} characters`);
      
      // Step 4: Extract structured menu using GPT-4
      const extracted = await this.extractWithOpenAI(combinedText, context);
      
      // Step 5: Validate result
      if (!this.isViableMenu(extracted)) {
        return this.failed(StrategyError.STRATEGY_NOT_APPLICABLE, 'No viable menu found in OCR text');
      }
      
      console.log(`✅ Extracted ${extracted.categories.length} categories with ${this.countItems(extracted)} items`);
      
      return {
        status: 'success',
        candidates: [{
          menu: extracted,
          strategy: this.name,
          quality: {
            overallScore: 0.75,
            completenessScore: 0.7,
            evidenceScore: 0.8,
            structuralScore: 0.75,
            consistencyScore: 0.7,
            itemNameCoverage: 0.8,
            priceCoverage: 0.75,
            categoryCoverage: 0.7,
            descriptionCoverage: 0.6,
            warningCodes: [],
            hardFailureCodes: [],
          },
        }],
        evidence: extracted.sourceEvidence || [],
        diagnostics: this.createDiagnostics(),
      };
      
    } catch (error: any) {
      console.error('ImageOCR extraction failed:', error);
      return this.failed(StrategyError.STRATEGY_PARSE_FAILED, error.message);
    }
  }
  
  /**
   * Extract image URLs from context
   */
  private extractImageUrls(context: ExtractionContext): string[] {
    const urls: string[] = [];
    
    console.log('🔍 Extracting image URLs from menu_discovery...');
    
    // Get from menu_discovery (v3 scraper format)
    const menuDiscovery = context.artifacts.menu_discovery;
    if (menuDiscovery && Array.isArray(menuDiscovery)) {
      console.log(`📊 Found ${menuDiscovery.length} menu_discovery entries`);
      
      menuDiscovery.forEach((discovery, index) => {
        console.log(`  Entry ${index + 1}: structure=${discovery.structure}, extractionMethod=${discovery.extractionMethod}`);
        
        // Handle PDF links (clean them to remove image transformation params)
        if (discovery.assets?.pdfLinks && discovery.assets.pdfLinks.length > 0) {
          console.log(`    - Found ${discovery.assets.pdfLinks.length} PDF links`);
          discovery.assets.pdfLinks.forEach((pdfLink: any) => {
            const pdfUrl = typeof pdfLink === 'string' ? pdfLink : pdfLink.url;
            if (pdfUrl) {
              const cleanUrl = this.cleanPdfUrl(pdfUrl);
              console.log(`      ✓ PDF: ${cleanUrl.substring(0, 80)}...`);
              urls.push(cleanUrl);
            }
          });
        }
        
        if (discovery.assets?.displayedImages) {
          console.log(`    - Found ${discovery.assets.displayedImages.length} displayed images`);
          discovery.assets.displayedImages.forEach((img: any) => {
            if (img.url) {
              // Check if this is actually a PDF with image params
              if (img.url.toLowerCase().includes('.pdf')) {
                const cleanUrl = this.cleanPdfUrl(img.url);
                console.log(`      ✓ PDF (from image): ${cleanUrl.substring(0, 80)}...`);
                urls.push(cleanUrl);
              } else {
                // Regular image - clean image params
                const cleanUrl = this.cleanImageUrl(img.url);
                console.log(`      ✓ Image: ${cleanUrl.substring(0, 80)}...`);
                urls.push(cleanUrl);
              }
            }
          });
        }
        
        if (discovery.assets?.imageLinks) {
          console.log(`    - Found ${discovery.assets.imageLinks.length} image links`);
          discovery.assets.imageLinks.forEach((link: { url: string; text: string; ariaLabel?: string }) => {
            // Check if this is actually a PDF
            if (link.url.toLowerCase().includes('.pdf')) {
              const cleanUrl = this.cleanPdfUrl(link.url);
              console.log(`      ✓ PDF (from link): ${cleanUrl.substring(0, 80)}...`);
              urls.push(cleanUrl);
            } else {
              const cleanUrl = this.cleanImageUrl(link.url);
              console.log(`      ✓ Link: ${cleanUrl.substring(0, 80)}...`);
              urls.push(cleanUrl);
            }
          });
        }
      });
    } else {
      console.log('⚠️ No menu_discovery data available in context');
    }
    
    // If source is direct PDF, use the source URL
    if (context.sourceType === SourceType.PDF_DIRECT && context.sourceUrl) {
      console.log('📄 Adding direct PDF URL from sourceUrl');
      const cleanUrl = this.cleanPdfUrl(context.sourceUrl);
      urls.push(cleanUrl);
    }
    
    // Deduplicate
    const uniqueUrls = Array.from(new Set(urls));
    console.log(`🎯 Total unique URLs for OCR: ${uniqueUrls.length}`);
    
    return uniqueUrls;
  }
  
  /**
   * Clean PDF URL: remove image transformation params but keep PDF file
   * Umbraco and other CMSs often add image params to PDF URLs for conversion
   */
  private cleanPdfUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // Remove ALL query params for PDFs - we want the raw file
      // Common Umbraco/CMS params: w, h, auto, format, compress, q, quality, fit, crop, ar, fp-x, fp-y, page
      urlObj.search = '';
      
      // Decode HTML entities
      let cleaned = urlObj.toString();
      cleaned = cleaned.replace(/&amp;/g, '&');
      
      console.log(`    🧹 Cleaned PDF URL: ${url.substring(0, 60)}... → ${cleaned.substring(0, 60)}...`);
      
      return cleaned;
    } catch {
      // If URL parsing fails, return as-is
      return url.replace(/&amp;/g, '&');
    }
  }
  
  /**
   * Clean image URL: remove width/height/resize params
   */
  private cleanImageUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // Remove common image transformation params
      const paramsToRemove = ['w', 'h', 'width', 'height', 'auto', 'q', 'quality', 
        'fit', 'crop', 'ar', 'fp-x', 'fp-y', 'page'];
      
      paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
      
      // Decode HTML entities
      let cleaned = urlObj.toString();
      cleaned = cleaned.replace(/&amp;/g, '&');
      
      return cleaned;
    } catch {
      // If URL parsing fails, return as-is
      return url.replace(/&amp;/g, '&');
    }
  }
  
  /**
   * Perform OCR on multiple images/PDFs
   */
  private async performOCROnImages(imageUrls: string[], context: ExtractionContext): Promise<OCRResponse[]> {
    const results: OCRResponse[] = [];
    
    // Process images/PDFs sequentially to avoid rate limits
    for (const imageUrl of imageUrls) {
      try {
        console.log(`🔍 Processing: ${imageUrl.substring(0, 80)}...`);
        
        // Check if this is a PDF - if so, download and store first
        const isPdf = imageUrl.toLowerCase().includes('.pdf');
        
        if (isPdf) {
          console.log('📄 Detected PDF - downloading to storage first...');
          const pdfResult = await this.processPdf(imageUrl, context.businessId, context.sourceId);
          if (pdfResult) {
            results.push(pdfResult);
          }
          continue;
        }
        
        // Regular image - process with OCR
        const response = await fetch(this.ocrEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.supabaseKey}`,
          },
          body: JSON.stringify({ imageUrl }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`OCR failed for ${imageUrl}:`, response.status, errorText);
          results.push({
            success: false,
            text: '',
            confidence: 0,
            imageUrl,
            error: `HTTP ${response.status}: ${errorText}`,
          });
          continue;
        }
        
        const data = await response.json();
        results.push({
          success: data.success || false,
          text: data.text || '',
          confidence: data.confidence || 0,
          imageUrl,
          error: data.error,
        });
        
        // Rate limiting: wait between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error: any) {
        console.error(`OCR exception for ${imageUrl}:`, error);
        results.push({
          success: false,
          text: '',
          confidence: 0,
          imageUrl,
          error: error.message,
        });
      }
    }
    
    return results;
  }
  
  /**
   * Process a PDF: download, store, check for text layer, then OCR if needed
   */
  private async processPdf(pdfUrl: string, businessId: string, sourceId: string): Promise<OCRResponse | null> {
    try {
      // Step 1: Download PDF to storage
      console.log('📥 Step 1/3: Downloading PDF to storage...');
      const downloadResponse = await fetch(this.downloadPdfEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
        body: JSON.stringify({ 
          pdfUrl,
          businessId,
          sourceId,
        }),
      });
      
      if (!downloadResponse.ok) {
        const errorText = await downloadResponse.text();
        console.error(`PDF download failed: ${downloadResponse.status} ${errorText}`);
        return null;
      }
      
      const downloadData = await downloadResponse.json();
      if (!downloadData.success) {
        console.error('PDF download failed:', downloadData.error);
        return null;
      }
      
      console.log(`✅ PDF stored at: ${downloadData.storagePath}`);
      
      // Step 2: Try to extract text layer
      console.log('📝 Step 2/3: Checking for text layer...');
      const extractResponse = await fetch(this.extractPdfEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.supabaseKey}`,
        },
        body: JSON.stringify({ storagePath: downloadData.storagePath }),
      });
      
      if (!extractResponse.ok) {
        console.warn('Text extraction failed, will use OCR');
      } else {
        const extractData = await extractResponse.json();
        if (extractData.success && extractData.hasTextLayer && extractData.text) {
          console.log(`✅ Extracted ${extractData.text.length} chars from text layer (no OCR needed!)`);
          return {
            success: true,
            text: extractData.text,
            confidence: 0.95,
            imageUrl: pdfUrl,
          };
        }
      }
      
      // Step 3: No text layer - need OCR
      console.log('🖼️ Step 3/3: No text layer found - running OCR...');
      // TODO: Implement PDF-to-images conversion + OCR
      // For now, return empty (this will cause the extraction to fail gracefully)
      console.warn('⚠️ PDF OCR not yet implemented - need to convert PDF pages to images first');
      
      return {
        success: false,
        text: '',
        confidence: 0,
        imageUrl: pdfUrl,
        error: 'PDF OCR not yet implemented',
      };
      
    } catch (error: any) {
      console.error('PDF processing failed:', error);
      return null;
    }
  }
  
  /**
   * Extract structured menu data using OpenAI
   * Reuses parsing logic from PDFTextStrategy
   */
  private async extractWithOpenAI(ocrText: string, context: ExtractionContext): Promise<NormalizedMenu> {
    const cleanedText = this.cleanTextForLLM(ocrText);
    
    const prompt = `Extract the menu from this OCR text. The text may have OCR errors.

IMPORTANT RULES:
1. Extract ALL items with names and prices
2. Group items into logical categories (Starters, Mains, Desserts, Drinks, etc.)
3. Keep Danish names as-is (don't translate)
4. Format prices as numbers (remove currency symbols)
5. Include descriptions if present
6. Handle multi-page menus (look for "--- Next Page ---" markers)

OCR TEXT:
${cleanedText}

Return a JSON object with this structure:
{
  "categories": [
    {
      "id": "unique-id",
      "name": "Category Name",
      "description": "Optional description",
      "items": [
        {
          "id": "unique-id",
          "name": "Item Name",
          "description": "Item description",
          "price": { "amount": 129, "currency": "DKK" },
          "dietary": [],
          "allergens": [],
          "modifiers": []
        }
      ]
    }
  ],
  "currency": "DKK",
  "language": "da"
}`;

    try {
      const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!openaiKey) {
        throw new Error('VITE_OPENAI_API_KEY not configured');
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 4000,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API failed: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('OpenAI returned empty response');
      }
      
      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in OpenAI response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Convert to NormalizedMenu format
      return this.convertToNormalizedMenu(parsed, context);
      
    } catch (error: any) {
      console.error('OpenAI extraction failed:', error);
      throw error;
    }
  }
  
  /**
   * Convert parsed data to NormalizedMenu format
   */
  private convertToNormalizedMenu(parsed: any, context: ExtractionContext): NormalizedMenu {
    const categories: MenuCategory[] = [];
    
    if (!parsed.categories || !Array.isArray(parsed.categories)) {
      throw new Error('Invalid menu structure: missing categories array');
    }
    
    parsed.categories.forEach((cat: any, catIndex: number) => {
      const items: MenuItem[] = [];
      
      if (cat.items && Array.isArray(cat.items)) {
        cat.items.forEach((item: any, itemIndex: number) => {
          const menuItem: MenuItem = {
            sourceItemId: item.id || `item-${catIndex}-${itemIndex}`,
            name: item.name || 'Unknown Item',
            description: item.description || undefined,
            prices: item.price ? [{
              amount: parseFloat(item.price.amount) || 0,
              currency: item.price.currency || parsed.currency || 'DKK',
              rawText: `${item.price.amount || 0}`,
            }] : [],
            dietaryLabels: item.dietary || undefined,
            allergensExplicit: item.allergens || undefined,
            sourceEvidence: [],
          };
          
          items.push(menuItem);
        });
      }
      
      const category: MenuCategory = {
        id: cat.id || `cat-${catIndex}`,
        name: cat.name || 'Other',
        description: cat.description || null,
        items,
        sourceEvidence: [],
      };
      
      categories.push(category);
    });
    
    return {
      categories,
      currency: parsed.currency || 'DKK',
      language: parsed.language || 'da',
      sourceEvidence: [{
        type: 'image_ocr',
        textExcerpt: 'OCR extracted text',
        sourceUrl: context.sourceUrl,
      }],
    };
  }
  
  /**
   * Check if extracted menu is viable
   */
  protected isViableMenu(menu: NormalizedMenu): boolean {
    if (!menu.categories || menu.categories.length === 0) {
      return false;
    }
    
    const totalItems = this.countItems(menu);
    return totalItems >= 3; // Minimum 3 items to be considered viable
  }
  
  /**
   * Count total menu items
   */
  private countItems(menu: NormalizedMenu): number {
    return menu.categories.reduce((sum, cat) => sum + cat.items.length, 0);
  }
  
  /**
   * Clean text for LLM processing
   */
  protected cleanTextForLLM(text: string): string {
    // Remove excessive whitespace
    let cleaned = text.replace(/\s+/g, ' ');
    
    // Truncate if too long (max 15000 chars for context window)
    if (cleaned.length > 15000) {
      cleaned = cleaned.substring(0, 15000) + '... [truncated]';
      this.warnings.push('Text truncated for LLM processing');
    }
    
    return cleaned.trim();
  }
}
