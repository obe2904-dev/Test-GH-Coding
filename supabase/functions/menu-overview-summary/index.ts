// ============================================================================
// MENU OVERVIEW SUMMARY - Standalone Edge Function
// ============================================================================
// Generates cross-menu summary BEFORE brand profile generation
// Stores in business_brand_profile.menu_overview_summary column
// Called by frontend "Regenerate" button first, then brand-profile-generator-v5
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import OpenAI from 'https://deno.land/x/openai@v4.28.0/mod.ts'
import { generateCrossMenuSummary } from '../_shared/brand-profile/menu-overview-summary.ts'
import type { MenuSummaryInput } from '../_shared/brand-profile/menu-overview-summary.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  businessId: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID().slice(0, 8)
  
  try {
    console.log(`[${requestId}] 🎯 Menu Overview Summary Request Started`)
    
    // Parse request
    const { businessId }: RequestBody = await req.json()
    
    if (!businessId) {
      throw new Error('businessId is required')
    }
    
    console.log(`[${requestId}] Business ID: ${businessId}`)
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Initialize OpenAI client
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }
    const openaiClient = new OpenAI({ apiKey: openaiApiKey })
    
    // ========================================================================
    // STEP 1: Fetch business name for context
    // ========================================================================
    
    console.log(`[${requestId}] Fetching business name...`)
    
    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', businessId)
      .single()
    
    if (businessError || !businessData) {
      throw new Error(`Business not found: ${businessError?.message}`)
    }
    
    const businessName = businessData.name
    console.log(`[${requestId}] Business: ${businessName}`)
    
    // ========================================================================
    // STEP 2: Fetch menu data from menu_results_v2
    // ========================================================================
    
    console.log(`[${requestId}] Fetching menu data...`)
    
    const { data: menuResults, error: menuError } = await supabase
      .from('menu_results_v2')
      .select('service_period_name, service_periods, ai_summary, structured_data')
      .eq('business_id', businessId)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
    
    if (menuError) {
      throw new Error(`Failed to fetch menus: ${menuError.message}`)
    }
    
    if (!menuResults || menuResults.length === 0) {
      console.log(`[${requestId}] ⚠️  No menus found - skipping summary generation`)
      
      // Store null result
      await supabase
        .from('business_brand_profile')
        .upsert({
          business_id: businessId,
          menu_overview_summary: null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'business_id'
        })
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No menus found',
          menu_overview_summary: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`[${requestId}] Found ${menuResults.length} menu(s)`)
    
    // ========================================================================
    // STEP 3: Check if we have 2+ menus (requirement for cross-summary)
    // ========================================================================
    
    if (menuResults.length < 2) {
      console.log(`[${requestId}] ⚠️  Only 1 menu found - cross-summary requires 2+ menus`)
      
      // Store the single menu summary as fallback
      const singleMenuSummary = {
        cross_menu_summary: menuResults[0].ai_summary || null,
        total_menus: 1,
        total_items: menuResults[0].structured_data?.items?.length || 0,
        overall_avg_price: null,
        menu_breakdown: [{
          service_period: menuResults[0].service_period_name || (menuResults[0].service_periods?.[0] || 'general'),
          item_count: menuResults[0].structured_data?.items?.length || 0,
          avg_price: null,
          ai_summary: menuResults[0].ai_summary
        }],
        signature_themes: [],
        generated_at: new Date().toISOString(),
        is_single_menu: true
      }
      
      await supabase
        .from('business_brand_profile')
        .upsert({
          business_id: businessId,
          menu_overview_summary: singleMenuSummary,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'business_id'
        })
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Single menu - stored individual summary',
          menu_overview_summary: singleMenuSummary
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // ========================================================================
    // STEP 4: Prepare menu data for cross-summary generation
    // ========================================================================
    
    console.log(`[${requestId}] Preparing menu data for cross-summary...`)
    
    const menuInputs: MenuSummaryInput[] = menuResults.map(menu => {
      // Extract items from categories array (structured_data.categories[].items)
      const items = menu.structured_data?.categories?.flatMap(cat => cat.items || []) || []
      const itemCount = items.length
      
      // Calculate average price from structured data
      let avgPrice: number | null = null
      if (itemCount > 0) {
        const prices = items
          .map((item: any) => {
            // Parse price string to number (e.g., "229" -> 229)
            const price = typeof item.price === 'string' ? parseInt(item.price, 10) : item.price
            return price
          })
          .filter((price: any) => typeof price === 'number' && price > 0 && !isNaN(price))
        
        if (prices.length > 0) {
          avgPrice = Math.round(prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length)
        }
      }
      
      return {
        service_period: menu.service_period_name || (menu.service_periods?.[0] || 'general'),
        ai_summary: menu.ai_summary || '',
        item_count: itemCount,
        avg_price: avgPrice
      }
    })
    
    console.log(`[${requestId}] Menu breakdown:`)
    menuInputs.forEach(menu => {
      console.log(`[${requestId}]   • ${menu.service_period}: ${menu.item_count} items, Ø ${menu.avg_price || 'N/A'} DKK`)
    })
    
    // ========================================================================
    // STEP 5: Generate cross-menu summary using AI
    // ========================================================================
    
    console.log(`[${requestId}] 🤖 Generating cross-menu summary...`)
    console.log(`[${requestId}]    • Input: ${menuInputs.length} menus`)
    console.log(`[${requestId}]    • Business: ${businessName}`)
    
    const crossMenuSummary = await generateCrossMenuSummary(
      businessName,
      menuInputs,
      openaiClient
    )
    
    if (!crossMenuSummary) {
      console.error(`[${requestId}] ❌ Cross-menu summary generation returned null!`)
      console.error(`[${requestId}]    This usually means AI generation failed or < 2 menus`)
      console.error(`[${requestId}]    Menu count: ${menuInputs.length}`)
      // Log each menu input for debugging
      menuInputs.forEach((menu, idx) => {
        console.error(`[${requestId}]    Menu ${idx + 1}: ${menu.service_period}, ${menu.item_count} items, ${menu.ai_summary?.substring(0, 50)}...`)
      })
    }
    
    console.log(`[${requestId}] ✅ Cross-menu summary generated`)
    console.log(`[${requestId}]    • Total items: ${crossMenuSummary?.total_items || 0}`)
    console.log(`[${requestId}]    • Total menus: ${crossMenuSummary?.total_menus || 0}`)
    console.log(`[${requestId}]    • Avg price: ${crossMenuSummary?.overall_avg_price || 'N/A'} DKK`)
    console.log(`[${requestId}]    • Signature themes: ${crossMenuSummary?.signature_themes?.join(', ') || 'none'}`)
    console.log(`[${requestId}]    • Gastronomic profile: ${crossMenuSummary?.gastronomic_profile ? 'Generated' : 'Not available'}`)
    
    // ========================================================================
    // STEP 6: Store in business_brand_profile (both JSONB and separate column)
    // ========================================================================
    
    console.log(`[${requestId}] 💾 Storing menu overview summary...`)
    
    const { error: upsertError } = await supabase
      .from('business_brand_profile')
      .upsert({
        business_id: businessId,
        menu_overview_summary: crossMenuSummary,
        gastronomic_profile: crossMenuSummary?.gastronomic_profile || null,
        signature_themes: crossMenuSummary?.signature_themes || [],
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'business_id'
      })
    
    if (upsertError) {
      console.error(`[${requestId}] ❌ Database upsert failed:`, upsertError)
      throw new Error(`Failed to store summary: ${upsertError.message}`)
    }
    
    console.log(`[${requestId}] ✅ Menu overview summary stored successfully`)
    console.log(`[${requestId}] 🎉 Menu Overview Summary Complete`)
    
    // ========================================================================
    // RETURN SUCCESS
    // ========================================================================
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Menu overview summary generated successfully',
        menu_overview_summary: crossMenuSummary,
        business_name: businessName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error:`, error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
