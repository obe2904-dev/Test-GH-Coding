// Fetch menu items from Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { MenuItem, MenuCatalog, Daypart } from '../types.ts'
import { getAllowedDayparts, inferDaypartFromTime } from '../policies/menu-rules.ts'
import { getLocaleConfig } from '../policies/locale-config.ts'

export async function fetchMenuCatalog(userId: string): Promise<MenuCatalog> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`🍽️ Fetching menu items for user: ${userId}`)

    // First get business_id from user
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle()

    if (businessError || !business) {
      console.warn('⚠️ No business found for user')
      return []
    }

    // Fetch menu extractions from menu_extractions table
    const { data: menuExtractions, error } = await supabase
      .from('menu_extractions')
      .select('extracted_data, menu_name, menu_type')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching menu:', error)
      return []
    }

    if (!menuExtractions || menuExtractions.length === 0) {
      console.warn('⚠️ No menu items found')
      return []
    }

    console.log(`📋 Found ${menuExtractions.length} menu extraction(s)`)

    // Extract items from menu_extractions JSON structure
    // Format: { categories: [{ name, items: [{ name, description, price, currency }] }] }
    const menuItems: MenuItem[] = []
    
    for (const extraction of menuExtractions) {
      const data = extraction.extracted_data as any
      const categories = data?.categories || []
      
      for (const category of categories) {
        const items = category.items || []
        const categoryName = category.name || 'Øvrigt'
        
        for (const item of items) {
          const menuItem: MenuItem = {
            id: `${extraction.menu_name}-${categoryName}-${item.name}`,
            name: item.name,
            category: categoryName,
            daypart_tags: getAllowedDayparts(categoryName),
            short_desc: item.short_desc || item.description || '',
            price: item.price || 0,
            menu_source: extraction.menu_name,
            raw_line: `${item.name} (${categoryName})`
          }
          menuItems.push(menuItem)
        }
      }
    }

    console.log(`✅ Loaded ${menuItems.length} menu items total`)
    
    // Return MenuCatalog with helper methods
    return createMenuCatalog(menuItems)

  } catch (error) {
    console.error('❌ Exception fetching menu:', error)
    return createMenuCatalog([])  // Return empty catalog
  }
}

// Create MenuCatalog with helper methods
function createMenuCatalog(items: MenuItem[]): MenuCatalog {
  return {
    items,
    
    getItemsByCategory: (category: string): MenuItem[] => {
      return items.filter(item => 
        item.category.toUpperCase() === category.toUpperCase()
      )
    },
    
    getAllowedItemsForDaypart: (daypart: Daypart): MenuItem[] => {
      return items.filter(item => 
        item.daypart_tags.includes(daypart)
      )
    },
    
    getAllowedItemsForTime: (time: string, language: string, country: string = 'DK'): MenuItem[] => {
      const locale = getLocaleConfig(language, country)
      const daypart = inferDaypartFromTime(time, locale)
      
      if (!daypart) {
        return items  // Return all if time can't be parsed
      }
      
      return items.filter(item => 
        item.daypart_tags.includes(daypart)
      )
    },
    
    getItemsByMenuSource: (source: string): MenuItem[] => {
      return items.filter(item => 
        item.menu_source.toLowerCase().includes(source.toLowerCase())
      )
    }
  }
}

export function formatMenuForPrompt(catalog: MenuCatalog): string {
  if (catalog.items.length === 0) {
    return '=== MENU ===\nNo menu items available.\n'
  }

  const sections: string[] = ['=== MENU ITEMS ===']
  
  // Group by category
  const byCategory = new Map<string, MenuItem[]>()
  for (const item of catalog.items) {
    const category = item.category || 'Other'
    if (!byCategory.has(category)) {
      byCategory.set(category, [])
    }
    byCategory.get(category)!.push(item)
  }

  // Format each category
  for (const [category, items] of byCategory) {
    sections.push(`\n${category}:`)
    for (const item of items) {
      let line = `- ${item.name}`
      if (item.short_desc) {
        line += `: ${item.short_desc}`
      }
      if (item.price) {
        line += ` (${item.price} kr)`
      }
      sections.push(line)
    }
  }

  return sections.join('\n')
}

// DEPRECATED: Use policies/menu-rules.ts instead
export function analyzeMenuCategories(menuItems: MenuItem[]): {
  morning: number
  lunch: number
  dinner: number
  cocktail: number
  kids: number
  other: number
} {
  return {
    morning: menuItems.filter(item => 
      /MORGENMAD|BREAKFAST|BRUNCH/i.test(item.category)
    ).length,
    lunch: menuItems.filter(item => 
      /FROKOST|LUNCH/i.test(item.category)
    ).length,
    dinner: menuItems.filter(item => 
      /MIDDAG|DINNER|AFTEN|EVENING/i.test(item.category)
    ).length,
    cocktail: menuItems.filter(item => 
      /COCKTAIL|BAR|DRINKS/i.test(item.category)
    ).length,
    kids: menuItems.filter(item => 
      /BØRNE|BARN|KIDS|CHILD/i.test(item.category)
    ).length,
    other: menuItems.filter(item => 
      !/MORGENMAD|BREAKFAST|BRUNCH|FROKOST|LUNCH|MIDDAG|DINNER|AFTEN|EVENING|COCKTAIL|BAR|DRINKS|BØRNE|BARN|KIDS|CHILD/i.test(item.category)
    ).length
  }
}
