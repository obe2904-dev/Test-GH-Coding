// supabase/functions/_shared/content-planning/menu-rotation-queue.ts
// Menu rotation queue: returns least-recently-posted dishes for fair rotation
// Uses indexed queries on published_posts for optimal performance
//
// ROTATION PRINCIPLE: Soft prioritization, NOT strict round-robin
// - Returns priority-sorted list (never posted → oldest first)
// - Consumers use this as GUIDANCE, not mandatory sequence
// - Quick Suggestions: 3-tier soft prioritization (AI picks from preferred tier)
// - Weekly Strategy: Builds deduplication list (prevents exact duplicates)
// - This allows businesses with few dishes to reuse before exhausting all options
// - This gives businesses with many dishes natural rotation through variety
//
// UUID-FIRST TRACKING (June 2026):
// - Matches posts by menu_item_id when available (most reliable)
// - Falls back to menu_item_name for legacy posts
// - Handles dish renames, similar names, multilingual variants

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Menu item with rotation metadata
 */
export interface RotationQueueItem {
  menu_item_name: string
  menu_item_id: string | null
  item_description: string  // Full ingredient description from menu_items_normalized
  category_name: string | null  // Display category (FORRETTER, HOVEDRETTER, etc.)
  menu_language: string | null  // ISO 639-1 language code (da, en, sv, etc.)
  last_posted_at: string | null  // ISO timestamp of last post, null if never posted
  days_since_posted: number | null  // Days since last post, null if never posted
  total_posts: number  // How many times this dish has been posted
  service_period: string | null  // Primary service period for this dish
}

/**
 * Options for rotation queue query
 */
export interface RotationQueueOptions {
  businessId: string
  servicePeriod?: string | null  // Deprecated: use servicePeriods instead (single period filter)
  servicePeriods?: string[] | null  // NEW: Filter by multiple service periods (handles overlaps)
  menuLanguage?: string | null  // ISO 639-1 language code to filter by (e.g., 'da', 'en')
  lookbackDays?: number  // How far back to look for rotation history (default: 90)
  limit?: number  // Max items to return (default: 50)
}

/**
 * Get menu rotation queue: dishes sorted by least-recently-posted
 * 
 * Uses indexed query on published_posts.idx_published_posts_menu_rotation
 * Returns dishes that haven't been posted recently at the top of the queue.
 * 
 * @param supabase - Supabase client instance
 * @param options - Query options
 * @returns Array of dishes sorted by rotation priority (never posted → oldest post first)
 * 
 * @example
 * ```ts
 * const queue = await getMenuRotationQueue(supabase, {
 *   businessId: 'abc-123',
 *   servicePeriod: 'lunch',
 *   limit: 10
 * })
 * 
 * // queue[0] is the dish that should be posted next (least recently used)
 * ```
 */
export async function getMenuRotationQueue(
  supabase: SupabaseClient,
  options: RotationQueueOptions
): Promise<RotationQueueItem[]> {
  const {
    businessId,
    servicePeriod = null,  // Deprecated
    servicePeriods = null,  // NEW
    menuLanguage = null,  // NEW: Language filter
    lookbackDays = 90,
    limit = 50
  } = options

  // Backward compatibility: convert single period to array
  const periodsToFilter = servicePeriods 
    ? servicePeriods 
    : (servicePeriod ? [servicePeriod] : null)

  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - lookbackDays)

  // Step 1: Get all ACTIVE menu items from menu_items_normalized
  // This is our source of truth for what dishes exist
  // Filter by is_active = true to exclude obsolete items from previous menu versions
  // Exclude kids_menu and sides - they're not suitable for general Quick Suggestions
  // OPTIMIZED: Fetch item_description here to eliminate redundant query
  let query = supabase
    .from('menu_items_normalized')
    .select('id, item_name, item_description, category_name, menu_language, service_periods, category_type')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .not('category_type', 'in', '("kids_menu","sides")')
  
  // Filter by language if specified (ensures content matches business country)
  if (menuLanguage) {
    query = query.eq('menu_language', menuLanguage)
  }
  
  const { data: menuItems, error: menuError } = await query.order('item_name')

  if (menuError) {
    console.error('❌ Failed to fetch menu items:', menuError)
    throw new Error(`Failed to fetch menu items: ${menuError.message}`)
  }

  if (!menuItems || menuItems.length === 0) {
    console.warn('⚠️ No menu items found for business:', businessId)
    return []
  }

  // Step 2: Get posting history for these dishes
  // Uses idx_published_posts_menu_rotation (business_id, menu_item_name, posted_at DESC)
  // Include BOTH published posts (already posted) AND scheduled posts (scheduled to go out)
  // This prevents double-booking the same dish in rotation
  // NEW: Include menu_item_id for UUID-first matching (more reliable than name-only)
  const { data: postHistory, error: historyError } = await supabase
    .from('published_posts')
    .select('menu_item_id, menu_item_name, posted_at, scheduled_for, status')
    .eq('business_id', businessId)
    .not('menu_item_name', 'is', null)
    .in('status', ['published', 'scheduled'])
    .or(`posted_at.gte.${lookbackDate.toISOString()},scheduled_for.gte.${lookbackDate.toISOString()}`)
    .order('posted_at', { ascending: false })

  if (historyError) {
    console.error('❌ Failed to fetch post history:', historyError)
    throw new Error(`Failed to fetch post history: ${historyError.message}`)
  }

  // Step 3: Build rotation queue with usage statistics
  const queue: RotationQueueItem[] = []
  const now = new Date()

  for (const item of menuItems) {
    // Filter by service period if specified
    // NEW: Supports multiple periods (e.g., ['brunch', 'lunch'] for overlapping menus)
    if (periodsToFilter && periodsToFilter.length > 0) {
      const servicePeriods = item.service_periods as string[] | null
      if (!servicePeriods || servicePeriods.length === 0) {
        continue  // Skip items with no service period data
      }
      
      // Check if dish is available in ANY of the requested periods
      const hasOverlap = servicePeriods.some(dishPeriod => 
        periodsToFilter.includes(dishPeriod)
      )
      
      if (!hasOverlap) {
        continue  // Skip items not available in any requested service period
      }
    }

    // Find all posts for this dish (both published and scheduled)
    // NEW: UUID-first matching for accuracy (handles renamed dishes, similar names)
    // Falls back to name matching for legacy posts without menu_item_id
    const dishPosts = postHistory?.filter(p => {
      // Prefer UUID matching when available (most reliable)
      if (p.menu_item_id && item.id) {
        return p.menu_item_id === item.id
      }
      // Fall back to name matching for legacy posts
      return p.menu_item_name === item.item_name
    }) || []
    
    // Get the most recent occurrence (published OR scheduled)
    // For published posts, use posted_at
    // For scheduled posts, use scheduled_for
    let lastPostedAt: string | null = null
    if (dishPosts.length > 0) {
      const timestamps = dishPosts
        .map(p => {
          if (p.status === 'scheduled' && p.scheduled_for) {
            return p.scheduled_for
          }
          return p.posted_at
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())
      
      lastPostedAt = timestamps[0] || null
    }
    
    let daysSincePosted: number | null = null
    if (lastPostedAt) {
      const lastDate = new Date(lastPostedAt)
      daysSincePosted = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    }

    // Determine primary service period
    const servicePeriods = item.service_periods as string[] | null
    const primaryPeriod = servicePeriods?.[0] || null

    queue.push({
      menu_item_name: item.item_name,
      menu_item_id: item.id,  // Stable now that we use soft-delete (is_active)
      item_description: item.item_description || '',  // Full description for AI prompts
      category_name: item.category_name || null,  // Display category for AI context
      menu_language: item.menu_language || null,  // ISO 639-1 language code
      last_posted_at: lastPostedAt,
      days_since_posted: daysSincePosted,
      total_posts: dishPosts.length,
      service_period: primaryPeriod
    })
  }

  // Step 4: Sort by rotation priority
  // Never posted first, then by days since last post (oldest first)
  queue.sort((a, b) => {
    // Items never posted should be prioritized
    if (a.last_posted_at === null && b.last_posted_at !== null) return -1
    if (a.last_posted_at !== null && b.last_posted_at === null) return 1
    
    // Both never posted: sort alphabetically for consistency
    if (a.last_posted_at === null && b.last_posted_at === null) {
      return a.menu_item_name.localeCompare(b.menu_item_name)
    }
    
    // Both posted: sort by days since posted (most days first = oldest post)
    const aDays = a.days_since_posted || 0
    const bDays = b.days_since_posted || 0
    return bDays - aDays  // Descending (more days = higher priority)
  })

  // Step 5: Limit results
  return queue.slice(0, limit)
}

/**
 * Get next dish to post from rotation queue
 * Convenience wrapper that returns the single highest-priority dish
 * 
 * @param supabase - Supabase client instance
 * @param options - Query options
 * @returns The dish that should be posted next, or null if no dishes available
 */
export async function getNextDishToPost(
  supabase: SupabaseClient,
  options: RotationQueueOptions
): Promise<RotationQueueItem | null> {
  const queue = await getMenuRotationQueue(supabase, { ...options, limit: 1 })
  return queue[0] || null
}

/**
 * Check if a dish was recently posted or scheduled
 * Useful for avoiding re-posting the same dish too soon
 * 
 * @param supabase - Supabase client instance
 * @param businessId - Business UUID
 * @param dishIdentifier - Menu item UUID (preferred) or exact name (fallback)
 * @param withinDays - Consider "recent" if posted/scheduled within this many days (default: 14)
 * @returns true if dish was posted or scheduled recently, false otherwise
 */
export async function wasDishRecentlyPosted(
  supabase: SupabaseClient,
  businessId: string,
  dishIdentifier: string,
  withinDays: number = 14
): Promise<boolean> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - withinDays)

  // Check both published posts (posted_at) and scheduled posts (scheduled_for)
  // NEW: Support UUID-first matching (checks both menu_item_id and menu_item_name)
  const { data, error } = await supabase
    .from('published_posts')
    .select('id, status, posted_at, scheduled_for')
    .eq('business_id', businessId)
    .or(`menu_item_id.eq.${dishIdentifier},menu_item_name.eq.${dishIdentifier}`)
    .in('status', ['published', 'scheduled'])
    .or(`posted_at.gte.${cutoffDate.toISOString()},scheduled_for.gte.${cutoffDate.toISOString()}`)
    .limit(1)

  if (error) {
    console.error('❌ Failed to check recent posts:', error)
    return false  // Fail open: allow posting
  }

  return (data?.length || 0) > 0
}
