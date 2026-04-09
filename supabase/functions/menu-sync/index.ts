import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// =====================================================
// MENU SYNC FUNCTION
// =====================================================
// Purpose: Parse menu_results_v2.structured_data and populate menu_items_normalized
// Trigger: Call after menu extraction or via cron job

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { businessId, menuResultId, forceResync } = await req.json()

    console.log('[MenuSync] Starting sync...', { businessId, menuResultId, forceResync })

    // =====================================================
    // STEP 1: Get menu records to sync
    // =====================================================
    let query = supabase
      .from('menu_results_v2')
      .select('*')
      .eq('status', 'done')
      .not('structured_data', 'is', null)

    if (businessId) {
      query = query.eq('business_id', businessId)
    }

    if (menuResultId) {
      query = query.eq('id', menuResultId)
    }

    const { data: menuResults, error: fetchError } = await query

    if (fetchError) {
      throw new Error(`Failed to fetch menu results: ${fetchError.message}`)
    }

    if (!menuResults || menuResults.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No menus to sync',
        synced: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`[MenuSync] Found ${menuResults.length} menus to sync`)

    // =====================================================
    // STEP 2: Sync each menu
    // =====================================================
    let totalSynced = 0
    let totalItems = 0

    for (const menuResult of menuResults) {
      try {
        // Check if already synced (unless force resync)
        if (!forceResync && menuResult.sha256) {
          const { data: existing } = await supabase
            .from('menu_items_normalized')
            .select('id')
            .eq('menu_result_id', menuResult.id)
            .eq('source_sha256', menuResult.sha256)
            .limit(1)

          if (existing && existing.length > 0) {
            console.log(`[MenuSync] Menu ${menuResult.id} already synced, skipping`)
            continue
          }
        }

        // Parse structured data
        const structuredData = typeof menuResult.structured_data === 'string' 
          ? JSON.parse(menuResult.structured_data) 
          : menuResult.structured_data

        console.log(`[MenuSync] Menu ${menuResult.id}: structuredData type=${typeof structuredData}, has categories=${!!structuredData?.categories}`)

        if (!structuredData || !structuredData.categories) {
          console.warn(`[MenuSync] Menu ${menuResult.id} has no categories, skipping. Data:`, JSON.stringify(structuredData).substring(0, 200))
          continue
        }

        // Delete existing items for this menu (for resync)
        await supabase
          .from('menu_items_normalized')
          .delete()
          .eq('menu_result_id', menuResult.id)

        // Extract items
        const itemsToInsert = []

        for (const category of structuredData.categories) {
          if (!category.items || !Array.isArray(category.items)) continue

          // Classify category type
          const categoryType = classifyCategoryType(category.name)

          for (const item of category.items) {
            // Skip items without names (extras, notes, etc.)
            if (!item.name || item.name.trim().length === 0) continue

            // Get metadata for this item (if exists)
            const { data: metadata } = await supabase
              .from('menu_item_metadata')
              .select('*')
              .eq('business_id', menuResult.business_id)
              .eq('item_name', item.name)
              .maybeSingle()

            // Infer metadata if not found
            const dishTempCategory = metadata?.dish_temp_category || inferTempCategory(item.name, item.description || '')
            const isSignature = metadata?.is_signature ?? inferIsSignature(item.name, category.name)
            const isSeasonal = metadata?.is_seasonal ?? inferIsSeasonal(item.name, item.description || '')
            const seasonalIngredients = metadata?.seasonal_ingredients || inferSeasonalIngredients(item.name, item.description || '')
            const locationTags = metadata?.location_tags || inferLocationTags(item.name, category.name)

            itemsToInsert.push({
              business_id: menuResult.business_id,
              menu_result_id: menuResult.id,
              item_name: item.name,
              item_description: item.description || null,
              item_price: item.price || null,
              category_name: category.name,
              category_type: categoryType,
              service_periods: menuResult.service_periods || [],
              service_period_name: menuResult.service_period_name || null,
              menu_title: structuredData.menuTitle || menuResult.source_url,
              menu_url: menuResult.source_url,
              is_signature: isSignature,
              is_seasonal: isSeasonal,
              is_limited_time: metadata?.is_limited_time || false,
              dish_temp_category: dishTempCategory,
              seasonal_ingredients: seasonalIngredients,
              location_tags: locationTags,
              total_times_posted: metadata?.total_times_posted || 0,
              avg_engagement_rate: metadata?.avg_engagement_rate || 0,
              last_posted_date: metadata?.last_posted_date || null,
              source_sha256: menuResult.sha256,
              synced_at: new Date().toISOString()
            })
          }
        }

        // Insert items
        if (itemsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('menu_items_normalized')
            .insert(itemsToInsert)

          if (insertError) {
            console.error(`[MenuSync] Failed to insert items for menu ${menuResult.id}:`, insertError)
            continue
          }

          console.log(`[MenuSync] Synced ${itemsToInsert.length} items from menu ${menuResult.id}`)
          totalItems += itemsToInsert.length
          totalSynced++
        }

      } catch (error) {
        console.error(`[MenuSync] Error syncing menu ${menuResult.id}:`, error)
      }
    }

    // =====================================================
    // STEP 3: Return results
    // =====================================================
    console.log(`[MenuSync] Complete: ${totalSynced} menus, ${totalItems} items`)

    return new Response(JSON.stringify({
      success: true,
      menusProcessed: menuResults.length,
      menusSynced: totalSynced,
      totalItems: totalItems
    }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[MenuSync] Fatal error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function classifyCategoryType(categoryName: string): string {
  const lower = categoryName.toLowerCase()
  
  // Kids menu
  if (lower.includes('børnemenu') || lower.includes('kids') || lower.includes('children')) {
    return 'kids_menu'
  }
  
  // Desserts
  if (lower.includes('dessert') || lower.includes('desserter') || lower.includes('kage') || lower.includes('cake')) {
    return 'dessert'
  }
  
  // Appetizers
  if (lower.includes('forretter') || lower.includes('appetizer') || lower.includes('starter')) {
    return 'appetizer'
  }
  
  // Sides/extras
  if (lower.includes('tilbehør') || lower.includes('sides') || lower.includes('ekstra') || lower.includes('tilvalg')) {
    return 'sides'
  }
  
  // Default: main course
  return 'main'
}

function inferTempCategory(name: string, description: string): 'cold' | 'hot' | 'warm' | 'neutral' {
  const text = `${name} ${description}`.toLowerCase()
  
  // Cold indicators
  const coldTerms = ['salat', 'salad', 'cold', 'koldrøget', 'is', 'ice', 'smoothie', 'carpaccio', 'gazpacho']
  if (coldTerms.some(term => text.includes(term))) {
    return 'cold'
  }
  
  // Hot indicators
  const hotTerms = ['gryde', 'stew', 'soup', 'bagt', 'grilled', 'stegt', 'stegte', 'varm', 'hot', 'ristet']
  if (hotTerms.some(term => text.includes(term))) {
    return 'hot'
  }
  
  // Warm indicators (room temp or slightly heated)
  const warmTerms = ['sandwich', 'burger', 'wrap', 'toast']
  if (warmTerms.some(term => text.includes(term))) {
    return 'warm'
  }
  
  return 'neutral'
}

function inferIsSignature(name: string, category: string): boolean {
  const text = `${name} ${category}`.toLowerCase()
  return text.includes('signatur') || text.includes('klassiker') || text.includes('classic')
}

function inferIsSeasonal(name: string, description: string): boolean {
  const text = `${name} ${description}`.toLowerCase()
  const seasonalTerms = ['sæson', 'season', 'limited', 'special', 'vinter', 'sommer', 'forår', 'efterår']
  return seasonalTerms.some(term => text.includes(term))
}

function inferSeasonalIngredients(name: string, description: string): string[] {
  const text = `${name} ${description}`.toLowerCase()
  const ingredients: string[] = []
  
  const seasonalMap: Record<string, string> = {
    'laks': 'salmon',
    'salmon': 'salmon',
    'oksekød': 'beef',
    'beef': 'beef',
    'kylling': 'chicken',
    'chicken': 'chicken',
    'svampe': 'mushrooms',
    'mushroom': 'mushrooms',
    'tomat': 'tomatoes',
    'tomato': 'tomatoes',
    'asparges': 'asparagus',
    'asparagus': 'asparagus',
    'græskar': 'pumpkin',
    'pumpkin': 'pumpkin',
    'jordbær': 'strawberries',
    'strawberry': 'strawberries'
  }
  
  for (const [term, ingredient] of Object.entries(seasonalMap)) {
    if (text.includes(term) && !ingredients.includes(ingredient)) {
      ingredients.push(ingredient)
    }
  }
  
  return ingredients
}

function inferLocationTags(name: string, category: string): string[] {
  const text = `${name} ${category}`.toLowerCase()
  const tags: string[] = []
  
  if (text.includes('fotogen') || text.includes('photo') || text.includes('instagram')) {
    tags.push('photogenic')
  }
  
  if (text.includes('signatur') || text.includes('klassiker') || text.includes('classic')) {
    tags.push('classic')
  }
  
  if (text.includes('comfort') || text.includes('gryde') || text.includes('stew')) {
    tags.push('comfort_food')
  }
  
  if (tags.length === 0) {
    tags.push('standard')
  }
  
  return tags
}
