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
   * Persist extraction result to database via Edge Function (service_role)
   */
  async persistExtractionResult(
    result: MenuExtractionResult,
    context: ExtractionContext
  ): Promise<string> {
    // Call Edge Function with service_role for secure persistence
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/persist-menu-extraction`;
    
    // Get current session for JWT
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session - user must be authenticated');
    }

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ result, context }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to persist extraction result');
    }

    console.log(`✅ Persisted via Edge Function: ${data.menuResultId} (${data.itemCount} items)`);
    return data.menuResultId;
  }
  
  /**
   * Insert menu result into menu_results_v2
   */
  private async insertMenuResult(
    result: MenuExtractionResult,
    context: ExtractionContext
  ): Promise<string> {
    const successfulAttempt = result.attempts.find(a => a.status === 'success');
    
    // Map internal status to database-allowed values
    const mapStatusToDb = (status: string): 'queued' | 'processing' | 'done' | 'error' => {
      if (status === 'done') return 'done';
      if (status === 'partial') return 'done'; // Partial success = done
      if (status === 'queued') return 'queued';
      if (status === 'processing' || status === 'extracting' || status === 'normalizing') return 'processing';
      return 'error'; // Everything else (permanent_error, manual_review_needed, etc.)
    };
    
    const row: Partial<MenuResultRow> = {
      business_id: context.businessId, // Required for RLS policy
      source_id: context.sourceId,
      source_kind: 'url',  // Required for CHECK constraint
      source_url: context.sourceUrl,  // Required when source_kind = 'url'
      structured_data: result.menu || undefined,
      ai_summary: result.menu ? this.generateMenuSummary(result.menu) : undefined,
      service_periods: result.menu ? this.extractServicePeriods(result.menu) : [],
      status: mapStatusToDb(result.status) as any,
      
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
    menuResultId: string,
    businessId: string
  ): Promise<void> {
    const items = this.flattenMenuToItems(menu, menuResultId);
    
    if (items.length === 0) return;
    
    const rows: Partial<MenuItemNormalizedRow>[] = items.map(item => ({
      business_id: businessId,
      menu_result_id: menuResultId,
      item_name: item.itemName,
      item_description: item.description,
      item_price: item.priceRaw || (item.itemPrice ? String(item.itemPrice) : undefined),
      category_name: item.categoryName,
      category_type: 'FOOD', // Default - could be enhanced later
      service_periods: item.servicePeriod ? [item.servicePeriod] : [],
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
