/**
 * Database Persistence Helpers
 * Converts extraction results to existing database schema
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  NormalizedMenu,
  MenuItem,
  MenuExtractionResult,
  ExtractionContext,
  MenuResultRow,
  MenuItemNormalizedRow,
  FlattenedMenuItem,
} from './types';
import { PIPELINE_VERSION } from './constants';

export class MenuPersistence {
  private supabase: SupabaseClient;
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
  
  /**
   * Persist extraction result to database
   */
  async persistExtractionResult(
    result: MenuExtractionResult,
    context: ExtractionContext
  ): Promise<string> {
    // 1. Insert into menu_results_v2
    const menuResultId = await this.insertMenuResult(result, context);
    
    // 2. Flatten and insert into menu_items_normalized
    if (result.menu && (result.status === 'done' || result.status === 'partial')) {
      await this.insertNormalizedItems(result.menu, menuResultId);
    }
    
    return menuResultId;
  }
  
  /**
   * Insert menu result into menu_results_v2
   */
  private async insertMenuResult(
    result: MenuExtractionResult,
    context: ExtractionContext
  ): Promise<string> {
    const successfulAttempt = result.attempts.find(a => a.status === 'success');
    
    const row: Partial<MenuResultRow> = {
      source_id: context.sourceId,
      structured_data: result.menu || undefined,
      ai_summary: result.menu ? this.generateMenuSummary(result.menu) : undefined,
      service_periods: result.menu ? this.extractServicePeriods(result.menu) : [],
      status: result.status,
      
      // Tracking metadata (new columns)
      platform_detected: context.artifacts.platformMetadata?.platform,
      provider_detected: undefined, // Will be set if provider detected
      strategy_used: successfulAttempt?.strategy,
      extraction_run_id: context.runId,
      artifact_storage_prefix: context.artifactStoragePrefix,
      quality_summary: result.quality,
      extraction_attempts: result.attempts.length,
      pipeline_version: PIPELINE_VERSION,
    };
    
    const { data, error } = await this.supabase
      .from('menu_results_v2')
      .insert(row)
      .select('id')
      .single();
    
    if (error) {
      throw new Error(`Failed to insert menu result: ${error.message}`);
    }
    
    return data.id;
  }
  
  /**
   * Insert normalized items into menu_items_normalized
   */
  private async insertNormalizedItems(
    menu: NormalizedMenu,
    menuResultId: string
  ): Promise<void> {
    const items = this.flattenMenuToItems(menu, menuResultId);
    
    if (items.length === 0) return;
    
    const rows: Partial<MenuItemNormalizedRow>[] = items.map(item => ({
      menu_result_id: menuResultId,
      item_name: item.itemName,
      item_price: item.itemPrice,
      price_raw: item.priceRaw,
      category_name: item.categoryName,
      description: item.description,
      dietary_labels: item.dietaryLabels,
      allergens: item.allergens,
      service_period: item.servicePeriod,
      source_evidence: item.sourceEvidence ? JSON.stringify(item.sourceEvidence) : undefined,
    }));
    
    const { error } = await this.supabase
      .from('menu_items_normalized')
      .insert(rows);
    
    if (error) {
      throw new Error(`Failed to insert normalized items: ${error.message}`);
    }
  }
  
  /**
   * Flatten menu to items for menu_items_normalized
   */
  private flattenMenuToItems(
    menu: NormalizedMenu,
    menuResultId: string
  ): FlattenedMenuItem[] {
    const flattened: FlattenedMenuItem[] = [];
    
    for (const category of menu.categories) {
      for (const item of category.items) {
        flattened.push({
          menuResultId,
          itemName: item.name,
          itemPrice: item.prices[0]?.amount,
          priceRaw: item.prices[0]?.rawText,
          categoryName: category.name,
          description: item.description,
          dietaryLabels: item.dietaryLabels,
          allergens: item.allergensExplicit,
          servicePeriod: item.availability?.servicePeriod,
          sourceEvidence: item.sourceEvidence,
        });
      }
    }
    
    return flattened;
  }
  
  /**
   * Generate AI summary for menu
   */
  private generateMenuSummary(menu: NormalizedMenu): string {
    const itemCount = menu.categories.reduce((sum, c) => sum + c.items.length, 0);
    const categoryCount = menu.categories.length;
    
    const categories = menu.categories.map(c => c.name).join(', ');
    
    return `Menu med ${itemCount} retter fordelt på ${categoryCount} kategorier: ${categories}`;
  }
  
  /**
   * Extract service periods from menu
   */
  private extractServicePeriods(menu: NormalizedMenu): string[] {
    if (!menu.servicePeriods || menu.servicePeriods.length === 0) {
      return [];
    }
    
    return menu.servicePeriods.map(sp => sp.name);
  }
  
  /**
   * Update menu result status
   */
  async updateMenuResultStatus(
    menuResultId: string,
    status: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('menu_results_v2')
      .update({ status })
      .eq('id', menuResultId);
    
    if (error) {
      throw new Error(`Failed to update menu result status: ${error.message}`);
    }
  }
  
  /**
   * Get menu result by ID
   */
  async getMenuResult(menuResultId: string): Promise<MenuResultRow | null> {
    const { data, error } = await this.supabase
      .from('menu_results_v2')
      .select('*')
      .eq('id', menuResultId)
      .single();
    
    if (error) {
      return null;
    }
    
    return data as MenuResultRow;
  }
  
  /**
   * Get normalized items for a menu result
   */
  async getNormalizedItems(menuResultId: string): Promise<MenuItemNormalizedRow[]> {
    const { data, error } = await this.supabase
      .from('menu_items_normalized')
      .select('*')
      .eq('menu_result_id', menuResultId);
    
    if (error) {
      return [];
    }
    
    return data as MenuItemNormalizedRow[];
  }
}
