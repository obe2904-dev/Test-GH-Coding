// supabase/functions/_shared/content-planning/service-period-detector.ts
// Service period detection: determines which meal service is active (brunch/lunch/dinner)
// Based on current time and business programme configuration

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Service period types
 */
export type ServicePeriod = 'brunch' | 'lunch' | 'dinner' | 'all_day' | null

/**
 * Programme configuration from database
 */
export interface ProgrammeConfig {
  name: string  // 'brunch', 'lunch', 'dinner'
  time_windows: string[]  // ['09:00-11:00', '11:00-15:00']
}

/**
 * Service period detection result
 */
export interface ServicePeriodResult {
  currentPeriod: ServicePeriod  // Deprecated: use currentPeriods instead (kept for backward compatibility)
  currentPeriods: ServicePeriod[]  // NEW: All periods active at current time (handles overlaps)
  nextPeriod: ServicePeriod
  nextPeriodStartsAt: string | null  // HH:MM format
  allActivePeriods: ServicePeriod[]  // Deprecated: use allConfiguredPeriods instead
  allConfiguredPeriods: ServicePeriod[]  // All periods configured for this business (regardless of time)
}

/**
 * Detect current service period based on time of day
 * 
 * Uses business_programme_profiles to determine which meal service is active.
 * Falls back to heuristic detection if no programme configuration exists.
 * 
 * Note: service_periods in menu_items_normalized is a text[] array, not JSONB
 * 
 * @param supabase - Supabase client instance
 * @param businessId - Business UUID
 * @param currentTime - Current local time in 'HH:MM' format (default: server time UTC)
 * @returns Service period detection result
 * 
 * @example
 * ```ts
 * const result = await detectServicePeriod(supabase, businessId, '14:30')
 * // result.currentPeriod = 'lunch'
 * // result.nextPeriod = 'dinner'
 * // result.nextPeriodStartsAt = '17:00'
 * ```
 */
export async function detectServicePeriod(
  supabase: SupabaseClient,
  businessId: string,
  currentTime?: string
): Promise<ServicePeriodResult> {
  
  // Step 1: Get programme configuration from database
  const { data: programmes, error } = await supabase
    .from('business_programme_profiles')
    .select('programme_type, time_windows')
    .eq('business_id', businessId)
    .order('programme_type')

  if (error) {
    console.error('❌ Failed to fetch programme profiles:', error)
    // Fall back to heuristic detection
    return detectServicePeriodHeuristic(currentTime)
  }

  // Step 2: Parse current time (default to server UTC time)
  const now = currentTime || getCurrentTimeHHMM()
  const currentMinutes = timeToMinutes(now)

  // Step 3: Convert programmes to standardized format
  // programme_type is already normalized (brunch/lunch/dinner), but we normalize again for safety
  // Filter out any invalid programmes (null/undefined programme_type)
  const configs: ProgrammeConfig[] = (programmes || [])
    .filter(p => p.programme_type)  // Skip programmes with null/undefined type
    .map(p => ({
      name: normalizeProgrammeName(p.programme_type),
      time_windows: p.time_windows || []
    }))

  if (configs.length === 0) {
    console.warn('⚠️ No active programmes found, using heuristic detection')
    return detectServicePeriodHeuristic(currentTime)
  }

  // Step 4: Find ALL currently active periods and next upcoming period
  // NEW: Supports overlapping service periods (e.g., brunch 09:30-14:00, lunch 09:30-17:00)
  const currentPeriods: ServicePeriod[] = []
  let nextPeriod: ServicePeriod = null
  let nextPeriodStartsAt: string | null = null

  // Build a sorted list of all time windows across programmes
  const allWindows: Array<{ name: ServicePeriod; startMinutes: number; endMinutes: number; startTime: string }> = []
  
  for (const programme of configs) {
    for (const window of programme.time_windows) {
      // Parse time window: '09:00-11:00'
      const match = window.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/)
      if (!match) continue
      
      const [, startTime, endTime] = match
      allWindows.push({
        name: programme.name as ServicePeriod,
        startMinutes: timeToMinutes(startTime),
        endMinutes: timeToMinutes(endTime),
        startTime
      })
    }
  }

  // Sort by start time
  allWindows.sort((a, b) => a.startMinutes - b.startMinutes)

  // Find ALL windows we're currently in (handles overlapping periods)
  const activeWindowSet = new Set<ServicePeriod>()  // Deduplicate period names
  for (const window of allWindows) {
    if (currentMinutes >= window.startMinutes && currentMinutes < window.endMinutes) {
      if (window.name) {  // null-check for ServicePeriod type
        activeWindowSet.add(window.name)
      }
    }
  }
  currentPeriods.push(...Array.from(activeWindowSet))

  // Find next upcoming period (first window that starts after current time)
  for (const window of allWindows) {
    if (currentMinutes < window.startMinutes) {
      nextPeriod = window.name
      nextPeriodStartsAt = window.startTime
      break
    }
  }

  // Backward compatibility: currentPeriod is first active period (or null)
  const currentPeriod = currentPeriods[0] || null

  // Step 5: Collect all configured periods for this business
  const allConfiguredPeriods = configs.map(p => p.name as ServicePeriod)

  return {
    currentPeriod,  // Deprecated: kept for backward compatibility
    currentPeriods,  // NEW: All active periods at current time
    nextPeriod,
    nextPeriodStartsAt,
    allActivePeriods: allConfiguredPeriods,  // Deprecated alias
    allConfiguredPeriods
  }
}

/**
 * Heuristic fallback for service period detection
 * Used when no programme configuration exists in database
 * 
 * Rules:
 * - 07:00-11:00 → brunch
 * - 11:00-15:00 → lunch
 * - 15:00-22:00 → dinner
 * - 22:00-07:00 → all_day (or next day's brunch)
 */
function detectServicePeriodHeuristic(currentTime?: string): ServicePeriodResult {
  const now = currentTime || getCurrentTimeHHMM()
  const currentMinutes = timeToMinutes(now)

  let currentPeriod: ServicePeriod = null
  let currentPeriods: ServicePeriod[] = []
  let nextPeriod: ServicePeriod = null
  let nextPeriodStartsAt: string | null = null

  if (currentMinutes >= 420 && currentMinutes < 660) {  // 07:00-11:00
    currentPeriod = 'brunch'
    currentPeriods = ['brunch']
    nextPeriod = 'lunch'
    nextPeriodStartsAt = '11:00'
  } else if (currentMinutes >= 660 && currentMinutes < 900) {  // 11:00-15:00
    currentPeriod = 'lunch'
    currentPeriods = ['lunch']
    nextPeriod = 'dinner'
    nextPeriodStartsAt = '17:00'
  } else if (currentMinutes >= 900 && currentMinutes < 1320) {  // 15:00-22:00
    currentPeriod = 'dinner'
    currentPeriods = ['dinner']
    nextPeriod = 'brunch'
    nextPeriodStartsAt = '07:00'
  } else {  // 22:00-07:00 (night/early morning)
    currentPeriod = 'all_day'
    currentPeriods = ['all_day']
    nextPeriod = 'brunch'
    nextPeriodStartsAt = '07:00'
  }

  return {
    currentPeriod,
    currentPeriods,
    nextPeriod,
    nextPeriodStartsAt,
    allActivePeriods: ['brunch', 'lunch', 'dinner'],
    allConfiguredPeriods: ['brunch', 'lunch', 'dinner']
  }
}

/**
 * Get dishes available for a specific service period
 * Filters menu items by their service_periods text[] array OR service_period_name text field
 * 
 * @param supabase - Supabase client instance
 * @param businessId - Business UUID
 * @param servicePeriod - Which service period to filter by
 * @returns Array of menu item names available during this period
 */
export async function getDishesForServicePeriod(
  supabase: SupabaseClient,
  businessId: string,
  servicePeriod: ServicePeriod
): Promise<string[]> {
  
  if (!servicePeriod) {
    return []  // No period specified
  }

  // Query menu_items_normalized - check both service_periods array and service_period_name string
  const { data, error } = await supabase
    .from('menu_items_normalized')
    .select('item_name, service_periods, service_period_name')
    .eq('business_id', businessId)

  if (error) {
    console.error('❌ Failed to fetch menu items for service period:', error)
    return []
  }

  if (!data) {
    return []
  }

  // Filter items where service_periods array includes the requested period OR service_period_name matches
  const dishes = data
    .filter(item => {
      // Check service_periods array first (preferred)
      const periods = item.service_periods as string[] | null
      if (periods && periods.length > 0) {
        return periods.includes(servicePeriod)
      }
      
      // Fallback: check service_period_name string field
      const periodName = item.service_period_name as string | null
      if (periodName) {
        return periodName.toLowerCase() === servicePeriod.toLowerCase()
      }
      
      // Items without any period specification are available all day
      return servicePeriod === 'all_day'
    })
    .map(item => item.item_name)

  return dishes
}

// ── Helper Functions ──

/**
 * Convert HH:MM time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Get current server time in HH:MM format (UTC)
 */
function getCurrentTimeHHMM(): string {
  const now = new Date()
  const hours = now.getUTCHours().toString().padStart(2, '0')
  const minutes = now.getUTCMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Normalize programme names to standard format
 * Handles variations like 'Brunch', 'brunch', 'BRUNCH'
 */
export function normalizeProgrammeName(name: string | null | undefined): string {
  if (!name) return 'all_day'  // Safe fallback for null/undefined
  
  const normalized = name.toLowerCase().trim()
  
  // Map variations to standard names
  const mappings: Record<string, string> = {
    'brunch': 'brunch',
    'breakfast': 'brunch',
    'morgenmad': 'brunch',
    'lunch': 'lunch',
    'frokost': 'lunch',
    'middag': 'lunch',
    'dinner': 'dinner',
    'aften': 'dinner',
    'aftensmad': 'dinner',
    'evening': 'dinner',
    'bar': 'bar',
    'cocktails': 'bar',
    'cocktail': 'bar',
    'drinks': 'bar',
    'all_day': 'all_day',
    'hele dagen': 'all_day',
    'all day': 'all_day'
  }

  return mappings[normalized] || normalized
}
