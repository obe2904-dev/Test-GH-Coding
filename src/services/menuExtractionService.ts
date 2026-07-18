/**
 * Menu Extraction Service
 * Client-side wrapper for Menu Extraction v2.0 system
 * Coordinates scraper calls and orchestrator execution
 */

import { ExtractionOrchestrator } from '../lib/menu-extraction/ExtractionOrchestrator';
import { ExtractionContext, MenuExtractionResult, SourceType } from '../lib/menu-extraction/types';
import { supabase } from '../lib/supabase';

// Use Supabase Edge Function as CORS proxy to Cloud Run scraper
const getScraperUrl = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL not configured');
  }
  return `${supabaseUrl}/functions/v1/scrape-menu`;
};

interface ScraperResponse {
  url: string;
  success: boolean;
  scraper_metadata: {
    platform_detected?: string;
    provider_detected?: string;
    structure_type?: string;
  };
  pages_crawled: Array<{
    url: string;
    page_data: {
      html: string;
      visible_text: string;
      blocks: any[];
    };
  }>;
  extraction?: {
    menu?: any;
  };
}

interface MenuExtractionOptions {
  businessId: string;
  sourceId: string;
  sourceUrl: string;
  supabaseUrl: string;
  supabaseKey: string;
}

export class MenuExtractionService {
  private orchestrator: ExtractionOrchestrator;
  
  constructor(options: { supabaseUrl: string; supabaseKey: string }) {
    this.orchestrator = new ExtractionOrchestrator({
      supabaseUrl: options.supabaseUrl,
      supabaseKey: options.supabaseKey,
      enablePersistence: true,
      maxStrategyAttempts: 5,
    });
  }
  
  /**
   * Main entry point: Extract menu from URL
   */
  async extractMenu(options: MenuExtractionOptions): Promise<MenuExtractionResult> {
    console.log('🚀 Starting Menu Extraction v2.0 for:', options.sourceUrl);
    
    // Step 1: Call scraper to fetch and render page
    const scraperData = await this.callScraper(options.sourceUrl, options.businessId);
    
    // Step 2: Validate scraper response
    this.validateScraperResponse(scraperData);
    
    // Step 3: Determine source type
    const sourceType = this.determineSourceType(scraperData, options.sourceUrl);
    
    // Step 4: Build extraction context
    const context = this.buildExtractionContext(
      scraperData,
      sourceType,
      options.businessId,
      options.sourceId,
      options.sourceUrl
    );
    
    // Step 5: Run orchestrator
    console.log('🔄 Running extraction orchestrator...');
    const result = await this.orchestrator.extract(context);
    
    console.log('✅ Extraction complete:', {
      status: result.status,
      quality: result.quality?.overallScore,
      itemCount: result.menu?.categories.reduce((sum, cat) => sum + cat.items.length, 0),
    });
    
    return result;
  }
  
  /**
   * Call Cloud Run scraper
   */
  private async callScraper(url: string, businessId: string): Promise<ScraperResponse> {
    console.log('🌐 Calling scraper:', url);
    
    // Get auth token for Supabase Edge Function
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const scraperUrl = getScraperUrl();
    
    const response = await fetch(scraperUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        url,
        business_id: businessId,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Scraper failed: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Scraper returned success=false');
    }
    
    return data;
  }
  
  /**
   * Validate scraper response structure
   */
  private validateScraperResponse(scraperData: ScraperResponse): void {
    if (!scraperData) {
      throw new Error('Scraper returned null or undefined response');
    }

    if (!scraperData.pages_crawled || !Array.isArray(scraperData.pages_crawled)) {
      throw new Error('Scraper response missing pages_crawled array');
    }

    if (scraperData.pages_crawled.length === 0) {
      throw new Error('Scraper returned no pages');
    }

    // Edge Function now transforms v3 → v2, so page_data should exist
    // But be lenient if it doesn't (log warning instead of throwing)
    const firstPage = scraperData.pages_crawled[0];
    if (!firstPage?.page_data) {
      console.warn('⚠️ First page missing page_data - extraction may fail');
    }
  }
  
  /**
   * Determine source type from scraper response
   */
  private determineSourceType(scraperData: ScraperResponse, url: string): SourceType {
    const structure = scraperData.scraper_metadata?.structure_type?.toLowerCase();
    
    if (url.toLowerCase().endsWith('.pdf') || structure === 'direct_pdf') {
      return SourceType.PDF_DIRECT;
    }
    
    if (structure === 'image_gallery') {
      return SourceType.IMAGE_GALLERY;
    }
    
    if (structure === 'json_embedded' || scraperData.scraper_metadata?.provider_detected) {
      return SourceType.JSON_EMBEDDED;
    }
    
    return SourceType.HTML_INLINE;
  }
  
  /**
   * Build extraction context from scraper data
   */
  private buildExtractionContext(
    scraperData: ScraperResponse,
    sourceType: SourceType,
    businessId: string,
    sourceId: string,
    sourceUrl: string
  ): ExtractionContext {
    const firstPage = scraperData.pages_crawled[0];
    const runId = crypto.randomUUID();
    
    return {
      sourceUrl,
      sourceType,
      businessId,
      sourceId,
      runId,
      
      artifacts: {
        initialHtml: firstPage?.page_data?.html,
        renderedHtml: firstPage?.page_data?.html,
        visibleText: firstPage?.page_data?.visible_text,
        screenshot: undefined,
        networkResponses: [],
        platformMetadata: scraperData.scraper_metadata?.platform_detected ? {
          platform: scraperData.scraper_metadata.platform_detected,
          confidence: 0.8,
          isSPA: false,
          detectedFeatures: [
            scraperData.scraper_metadata?.structure_type,
            scraperData.scraper_metadata?.provider_detected,
          ].filter(Boolean) as string[],
        } : undefined,
      },
    };
  }
}

/**
 * Singleton instance factory
 */
let serviceInstance: MenuExtractionService | null = null;

export function getMenuExtractionService(
  supabaseUrl: string,
  supabaseKey: string
): MenuExtractionService {
  if (!serviceInstance) {
    serviceInstance = new MenuExtractionService({ supabaseUrl, supabaseKey });
  }
  return serviceInstance;
}
