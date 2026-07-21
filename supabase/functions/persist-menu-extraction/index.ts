// =====================================================
// Persist Menu Extraction
// =====================================================
// Purpose: Server-side persistence of menu extraction results
// Security: Validates user ownership, writes with service_role
// Handles: Both menu_results_v2 and menu_items_normalized tables

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeStructuredMenu } from '../_shared/menu-structure-normalizer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPELINE_VERSION = '2.0.0';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get user JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { result, context } = await req.json();

    if (!result || !context || !context.businessId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'result, context, and context.businessId are required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user JWT for validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate user owns the business
    const { data: business, error: businessError } = await userClient
      .from('businesses')
      .select('id, owner_id')
      .eq('id', context.businessId)
      .single();

    if (businessError || !business) {
      console.error('❌ Business validation failed:', businessError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Business not found or access denied' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authenticated user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('❌ User authentication failed:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (business.owner_id !== user.id) {
      console.error('❌ Ownership mismatch:', { 
        businessOwnerId: business.owner_id, 
        userId: user.id 
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'You do not own this business' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ User ${user.id} owns business ${context.businessId}`);

    // Now use service_role client for database writes
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Map internal status to database-allowed values
    const mapStatusToDb = (status: string): 'queued' | 'processing' | 'done' | 'error' => {
      if (status === 'done') return 'done';
      if (status === 'partial') return 'done';
      if (status === 'queued') return 'queued';
      if (status === 'processing' || status === 'extracting' || status === 'normalizing') return 'processing';
      return 'error';
    };

    const normalizedMenu = result.menu ? normalizeStructuredMenu(result.menu) : undefined;
    const successfulAttempt = result.attempts?.find((a: any) => a.status === 'success');

    // 1. Insert into menu_results_v2
    const menuResultRow = {
      business_id: context.businessId,
      source_id: context.sourceId,
      source_kind: 'url',
      source_url: context.sourceUrl,
      structured_data: normalizedMenu,
      ai_summary: normalizedMenu ? generateMenuSummary(normalizedMenu) : undefined,
      service_periods: normalizedMenu ? extractServicePeriods(normalizedMenu) : [],
      status: mapStatusToDb(result.status),
      platform_detected: context.artifacts?.platformMetadata?.platform,
      provider_detected: undefined,
      strategy_used: successfulAttempt?.strategy,
      extraction_run_id: context.runId,
      artifact_storage_prefix: context.artifactStoragePrefix,
      quality_summary: result.quality,
      extraction_attempts: result.attempts?.length || 0,
      pipeline_version: PIPELINE_VERSION,
    };

    const { data: menuResult, error: menuResultError } = await serviceClient
      .from('menu_results_v2')
      .insert(menuResultRow)
      .select('id')
      .single();

    if (menuResultError) {
      console.error('❌ Failed to insert menu result:', menuResultError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to insert menu result: ${menuResultError.message}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const menuResultId = menuResult.id;
    console.log(`✅ Inserted menu result: ${menuResultId}`);

    // 2. Insert normalized items if extraction succeeded
    if (normalizedMenu && (result.status === 'done' || result.status === 'partial')) {
      const items = flattenMenuToItems(normalizedMenu, menuResultId);
      
      if (items.length > 0) {
        const itemRows = items.map((item: any) => ({
          business_id: context.businessId,
          menu_result_id: menuResultId,
          item_name: item.itemName,
          item_description: item.description,
          item_price: item.priceRaw || (item.itemPrice ? String(item.itemPrice) : undefined),
          category_name: item.categoryName,
          category_type: 'FOOD',
          service_periods: item.servicePeriod ? [item.servicePeriod] : [],
        }));

        const { error: itemsError } = await serviceClient
          .from('menu_items_normalized')
          .insert(itemRows);

        if (itemsError) {
          console.error('❌ Failed to insert normalized items:', itemsError);
          // Don't fail the whole request - menu result was saved
          console.warn('⚠️ Continuing despite items error');
        } else {
          console.log(`✅ Inserted ${items.length} normalized items`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        menuResultId,
        itemCount: normalizedMenu?.categories?.reduce((sum: number, c: any) => sum + c.items.length, 0) || 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// =====================================================
// Helper Functions
// =====================================================

function generateMenuSummary(menu: any): string {
  const itemCount = menu.categories.reduce((sum: number, c: any) => sum + c.items.length, 0);
  const categoryCount = menu.categories.length;
  const categories = menu.categories.map((c: any) => c.name).join(', ');
  
  return `Menu med ${itemCount} retter fordelt på ${categoryCount} kategorier: ${categories}`;
}

function extractServicePeriods(menu: any): string[] {
  if (!menu.servicePeriods || menu.servicePeriods.length === 0) {
    return [];
  }
  return menu.servicePeriods.map((sp: any) => sp.name);
}

function flattenMenuToItems(menu: any, menuResultId: string): any[] {
  const flattened: any[] = [];
  
  for (const category of menu.categories) {
    for (const item of category.items) {
      flattened.push({
        menuResultId,
        itemName: item.name,
        itemPrice: item.prices?.[0]?.amount,
        priceRaw: item.prices?.[0]?.rawText,
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
