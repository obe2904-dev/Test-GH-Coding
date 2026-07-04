/**
 * Menu Period Parser
 * 
 * Converts extracted menu data into structured menu periods with timing information.
 * Used to feed time-aware menu data into concept fit analysis and AI generation.
 */

import type { MenuPeriod } from '../location/conceptFitAnalyzer';

interface MenuCategory {
  name: string;
  timeRange?: string | null;
  items: string[];
}

/**
 * Parse menu categories into structured menu periods with timing data
 */
export function parseMenuPeriods(menuCategories: MenuCategory[]): MenuPeriod[] {
  const periods: MenuPeriod[] = [];

  for (const category of menuCategories) {
    const period = parseMenuCategory(category);
    if (period) {
      periods.push(period);
    }
  }

  return periods;
}

/**
 * Parse a single menu category into a MenuPeriod
 */
function parseMenuCategory(category: MenuCategory): MenuPeriod | null {
  const { name, timeRange, items } = category;
  
  // Try to extract time range from category name if not explicitly provided
  const timeInfo = timeRange || extractTimeFromName(name);
  
  if (!timeInfo) {
    // No time info - try to infer from category name
    return inferMenuPeriodFromName(name, items);
  }
  
  // Parse time range (e.g., "09.00-14.00", "11:30-15:00")
  const { startTime, endTime } = parseTimeRange(timeInfo);
  
  if (!startTime || !endTime) {
    return inferMenuPeriodFromName(name, items);
  }
  
  // Determine menu type from name
  const type = inferMenuType(name);
  
  return {
    name: cleanMenuName(name),
    type,
    startTime,
    endTime,
    items: items.slice(0, 5) // Sample first 5 items for AI reference
  };
}

/**
 * Extract time range from category name
 * Examples: "BRUNCH 09.00-14.00", "Lunch (11:30-15:00)", "Frokost kl. 11-15"
 */
function extractTimeFromName(name: string): string | null {
  // Pattern 1: 09.00-14.00 or 09:00-14:00
  const pattern1 = /(\d{1,2})[.:,](\d{2})\s*[-–—]\s*(\d{1,2})[.:,](\d{2})/;
  const match1 = name.match(pattern1);
  if (match1) {
    return `${match1[1]}:${match1[2]}-${match1[3]}:${match1[4]}`;
  }
  
  // Pattern 2: 9-14, 11-15, etc.
  const pattern2 = /(?:kl\.?\s*)?(\d{1,2})\s*[-–—]\s*(\d{1,2})(?!\d)/;
  const match2 = name.match(pattern2);
  if (match2) {
    return `${match2[1].padStart(2, '0')}:00-${match2[2].padStart(2, '0')}:00`;
  }
  
  return null;
}

/**
 * Parse time range string into start and end times
 */
function parseTimeRange(timeRange: string): { startTime: string | null; endTime: string | null } {
  const parts = timeRange.split('-');
  if (parts.length !== 2) {
    return { startTime: null, endTime: null };
  }
  
  const startTime = normalizeTime(parts[0].trim());
  const endTime = normalizeTime(parts[1].trim());
  
  return { startTime, endTime };
}

/**
 * Normalize time to HH:MM format
 */
function normalizeTime(time: string): string | null {
  // Already in HH:MM format
  if (/^\d{2}:\d{2}$/.test(time)) {
    return time;
  }
  
  // H:MM format
  if (/^\d{1}:\d{2}$/.test(time)) {
    return time.padStart(5, '0');
  }
  
  // HH.MM or H.MM format
  const dotMatch = time.match(/^(\d{1,2})\.(\d{2})$/);
  if (dotMatch) {
    return `${dotMatch[1].padStart(2, '0')}:${dotMatch[2]}`;
  }
  
  return null;
}

/**
 * Infer menu type from category name
 */
function inferMenuType(name: string): MenuPeriod['type'] {
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('breakfast') || nameLower.includes('morgenmad')) {
    return 'breakfast';
  }
  
  if (nameLower.includes('brunch')) {
    return 'brunch';
  }
  
  if (nameLower.includes('lunch') || nameLower.includes('frokost') || nameLower.includes('middag')) {
    return 'lunch';
  }
  
  if (nameLower.includes('afternoon') || nameLower.includes('eftermiddag') || nameLower.includes('kage')) {
    return 'afternoon';
  }
  
  if (nameLower.includes('dinner') || nameLower.includes('aften') || nameLower.includes('middag')) {
    return 'dinner';
  }
  
  if (nameLower.includes('late') || nameLower.includes('nat') || nameLower.includes('night')) {
    return 'late_night';
  }
  
  if (nameLower.includes('all day') || nameLower.includes('hele dagen') || nameLower.includes('døgn')) {
    return 'all_day';
  }
  
  return 'other';
}

/**
 * Infer menu period from name without explicit time range
 */
function inferMenuPeriodFromName(name: string, items: string[]): MenuPeriod | null {
  const type = inferMenuType(name);
  
  // Default time ranges based on type
  const defaultTimes: Record<MenuPeriod['type'], { start: string; end: string }> = {
    breakfast: { start: '07:00', end: '11:00' },
    brunch: { start: '09:00', end: '14:00' },
    lunch: { start: '11:30', end: '15:00' },
    afternoon: { start: '14:00', end: '17:00' },
    dinner: { start: '17:00', end: '22:00' },
    late_night: { start: '22:00', end: '02:00' },
    all_day: { start: '00:00', end: '23:59' },
    other: { start: '00:00', end: '23:59' }
  };
  
  const times = defaultTimes[type];
  
  return {
    name: cleanMenuName(name),
    type,
    startTime: times.start,
    endTime: times.end,
    items: items.slice(0, 5)
  };
}

/**
 * Clean menu name by removing time ranges and extra formatting
 */
function cleanMenuName(name: string): string {
  // Remove time ranges
  let cleaned = name.replace(/(\d{1,2})[.:,](\d{2})\s*[-–—]\s*(\d{1,2})[.:,](\d{2})/g, '');
  cleaned = cleaned.replace(/(?:kl\.?\s*)?(\d{1,2})\s*[-–—]\s*(\d{1,2})/g, '');
  
  // Remove parentheses
  cleaned = cleaned.replace(/[()]/g, '');
  
  // Trim and clean up whitespace
  cleaned = cleaned.trim().replace(/\s+/g, ' ');
  
  return cleaned;
}

/**
 * Find menu period for a specific time
 * @param time - Time in HH:MM format (e.g., "13:00")
 * @param periods - Available menu periods
 * @returns Matching menu period or null
 */
export function findMenuForTime(time: string, periods: MenuPeriod[]): MenuPeriod | null {
  const [hours, minutes] = time.split(':').map(Number);
  const timeMinutes = hours * 60 + minutes;
  
  for (const period of periods) {
    const [startHours, startMinutes] = period.startTime.split(':').map(Number);
    const [endHours, endMinutes] = period.endTime.split(':').map(Number);
    
    const startMinutesTotal = startHours * 60 + startMinutes;
    const endMinutesTotal = endHours * 60 + endMinutes;
    
    // Handle overnight periods (e.g., late_night 22:00-02:00)
    if (endMinutesTotal < startMinutesTotal) {
      if (timeMinutes >= startMinutesTotal || timeMinutes <= endMinutesTotal) {
        return period;
      }
    } else {
      if (timeMinutes >= startMinutesTotal && timeMinutes <= endMinutesTotal) {
        return period;
      }
    }
  }
  
  return null;
}

/**
 * Get human-readable description of menu period timing
 */
export function getMenuPeriodDescription(period: MenuPeriod): string {
  const typeNames: Record<MenuPeriod['type'], string> = {
    breakfast: 'Morgenmad',
    brunch: 'Brunch',
    lunch: 'Frokost',
    afternoon: 'Eftermiddag',
    dinner: 'Aftensmad',
    late_night: 'Natmad',
    all_day: 'Hele dagen',
    other: 'Menu'
  };
  
  const typeName = typeNames[period.type];
  return `${period.name || typeName} (${period.startTime}-${period.endTime})`;
}
