/**
 * Menu Period Parser for Edge Functions
 * 
 * Converts extracted menu data into structured menu periods with timing information.
 * Standalone version with inline types (no external imports).
 */

export interface MenuPeriod {
  name: string;
  type: 'breakfast' | 'brunch' | 'lunch' | 'afternoon' | 'dinner' | 'late_night' | 'all_day' | 'other';
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  daysAvailable?: string[];
  items?: string[];
}

interface MenuCategory {
  name: string;
  timeRange?: string | null;
  items?: Array<{ name: string; description?: string; price?: string }>;
}

interface BusinessHours {
  open: string; // HH:MM format
  close: string; // HH:MM format
}

/**
 * Parse menu categories into structured menu periods with timing data
 * @param menuCategories - Array of menu categories from extraction
 * @param businessHours - Optional business opening hours to constrain menu periods
 * @param menuAvailabilityTime - Optional menu-level time range (e.g., "17.30-21.30")
 */
export function parseMenuPeriods(
  menuCategories: MenuCategory[], 
  businessHours?: BusinessHours,
  menuAvailabilityTime?: string | null
): MenuPeriod[] {
  const periods: MenuPeriod[] = [];

  console.log(`🔧 parseMenuPeriods called with:`)
  console.log(`   - ${menuCategories.length} categories`)
  console.log(`   - Business hours: ${businessHours ? `${businessHours.open}-${businessHours.close}` : 'none'}`)
  console.log(`   - Menu availability: ${menuAvailabilityTime ? `"${menuAvailabilityTime}"` : 'none'}`)

  // Parse menu-level availability time if provided
  let menuTimeRange: { startTime: string | null; endTime: string | null } | null = null;
  if (menuAvailabilityTime) {
    const normalized = normalizeTimeString(menuAvailabilityTime);
    console.log(`   - Normalized: "${normalized}"`)
    menuTimeRange = parseTimeRange(normalized);
    if (menuTimeRange.startTime && menuTimeRange.endTime) {
      console.log(`📋 Menu-level availability: ${menuAvailabilityTime} → ${menuTimeRange.startTime}-${menuTimeRange.endTime}`);
    } else {
      console.log(`⚠️ Failed to parse menu availability time: ${menuAvailabilityTime}`)
    }
  }

  for (const category of menuCategories) {
    const period = parseMenuCategory(category, businessHours, menuTimeRange);
    if (period) {
      periods.push(period);
    }
  }

  return periods;
}

/**
 * Parse a single menu category into a MenuPeriod
 */
function parseMenuCategory(
  category: MenuCategory,
  businessHours?: BusinessHours,
  menuTimeRange?: { startTime: string | null; endTime: string | null } | null
): MenuPeriod | null {
  const { name, timeRange, items } = category;
  
  // Extract item names for sampling
  const itemNames = (items || []).map(item => item.name).filter(Boolean);
  
  console.log(`  📦 Category "${name}":`)
  console.log(`     - Has timeRange: ${timeRange ? `"${timeRange}"` : 'no'}`)
  console.log(`     - Menu timeRange: ${menuTimeRange?.startTime && menuTimeRange?.endTime ? `${menuTimeRange.startTime}-${menuTimeRange.endTime}` : 'no'}`)
  
  // Priority when menu-level availability exists:
  // 1. Menu-level availability (entire menu has this service period)
  // 2. Category explicit timeRange
  // 3. Extract from category name
  // 4. Infer from category type
  
  let timeInfo: string | null = null;
  
  if (menuTimeRange?.startTime && menuTimeRange?.endTime) {
    // Menu has explicit availability → all categories inherit this
    timeInfo = `${menuTimeRange.startTime}-${menuTimeRange.endTime}`;
    console.log(`     → Using menu-level time: ${timeInfo}`)
  } else {
    // No menu-level time → categories can have individual timing
    timeInfo = timeRange || extractTimeFromName(name);
    console.log(`     → Using category time: ${timeInfo || 'none, will infer'}`)
  }
  
  if (!timeInfo) {
    // No time info - try to infer from category name
    const inferred = inferMenuPeriodFromName(name, itemNames, businessHours);
    if (inferred) {
      console.log(`     → Inferred as ${inferred.type}: ${inferred.startTime}-${inferred.endTime}`)
    }
    return inferred;
  }
  
  // Parse time range (e.g., "09.00-14.00", "11:30-15:00")
  let { startTime, endTime } = parseTimeRange(timeInfo);
  
  // Handle partial times using business hours
  if (businessHours) {
    if (!startTime && endTime) {
      startTime = businessHours.open;
      console.log(`⏰ Using business opening time ${startTime} for menu ${name}`);
    }
    if (startTime && !endTime) {
      endTime = businessHours.close;
      console.log(`⏰ Using business closing time ${endTime} for menu ${name}`);
    }
  }
  
  if (!startTime || !endTime) {
    return inferMenuPeriodFromName(name, itemNames, businessHours);
  }
  
  // Constrain to business hours if provided
  if (businessHours) {
    const constrained = constrainToBusinessHours(startTime, endTime, businessHours);
    startTime = constrained.startTime;
    endTime = constrained.endTime;
  }
  
  // Determine menu type from name
  const type = inferMenuType(name);
  
  return {
    name: cleanMenuName(name),
    type,
    startTime,
    endTime,
    items: itemNames.slice(0, 5) // Sample first 5 items for AI reference
  };
}

/**
 * Extract time range from category name
 * Examples: "BRUNCH 09.00-14.00", "Lunch (11:30-15:00)", "Frokost kl. 11-15"
 */
function extractTimeFromName(name: string): string | null {
  const normalized = normalizeTimeString(name);
  
  // Pattern 1: 09.00-14.00 or 09:00-14:00
  const pattern1 = /(\d{1,2})[.:,](\d{2})\s*[-–—]\s*(\d{1,2})[.:,](\d{2})/;
  const match1 = normalized.match(pattern1);
  if (match1) {
    return `${match1[1]}:${match1[2]}-${match1[3]}:${match1[4]}`;
  }
  
  // Pattern 2: 9-14, 11-15, etc.
  const pattern2 = /(?:kl\.?\s*)?(\d{1,2})\s*[-–—]\s*(\d{1,2})(?!\d)/;
  const match2 = normalized.match(pattern2);
  if (match2) {
    return `${match2[1].padStart(2, '0')}:00-${match2[2].padStart(2, '0')}:00`;
  }
  
  return null;
}

/**
 * Normalize time string by cleaning up common formatting issues
 * Handles: "@ 17.30 – 21.30", "17.30-21.30", "17:30 - 21:30"
 */
function normalizeTimeString(str: string): string {
  // Remove @ symbol and extra spaces
  return str.replace(/@/g, '').trim();
}

/**
 * Parse time range string into start and end times
 * Handles various dash formats: "-", "–", "—" with or without spaces
 * Also handles "til kl. X" (until time) format
 */
function parseTimeRange(timeRange: string): { startTime: string | null; endTime: string | null } {
  // Handle "til kl. X" format (e.g., "til kl. 14.00 hver dag")
  const untilMatch = timeRange.match(/til\s+kl\.?\s*(\d{1,2})[.:,](\d{2})/i);
  if (untilMatch) {
    // For "until 14:00", infer start time as 09:00 (typical brunch start)
    const endHour = untilMatch[1].padStart(2, '0');
    const endMin = untilMatch[2];
    return {
      startTime: '09:00',
      endTime: `${endHour}:${endMin}`
    };
  }
  
  // Replace various dash characters with regular hyphen and normalize spaces
  const normalized = timeRange
    .replace(/[\u2013\u2014]/g, '-') // Replace en-dash (–) and em-dash (—) with hyphen
    .replace(/\s*-\s*/g, '-'); // Remove spaces around dashes
  
  const parts = normalized.split('-');
  if (parts.length !== 2) {
    return { startTime: null, endTime: null };
  }
  
  const startTime = normalizeTime(parts[0].trim());
  const endTime = normalizeTime(parts[1].trim());
  
  return { startTime, endTime };
}

/** * Constrain menu period times to business opening hours
 * Ensures menu periods don't extend beyond when business is open
 */
function constrainToBusinessHours(
  startTime: string,
  endTime: string,
  businessHours: BusinessHours
): { startTime: string; endTime: string } {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  const open = timeToMinutes(businessHours.open)
  const close = timeToMinutes(businessHours.close)
  
  let constrainedStart = start
  let constrainedEnd = end
  
  // Adjust start time if before opening
  if (start < open) {
    console.log(`⏰ Adjusting menu start from ${startTime} to ${businessHours.open} (business opens then)`)
    constrainedStart = open
  }
  
  // Adjust end time if after closing
  if (end > close) {
    console.log(`⏰ Adjusting menu end from ${endTime} to ${businessHours.close} (business closes then)`)
    constrainedEnd = close
  }
  
  return {
    startTime: minutesToTime(constrainedStart),
    endTime: minutesToTime(constrainedEnd)
  }
}

/**
 * Convert HH:MM time to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Convert minutes since midnight to HH:MM format
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/** * Normalize time to HH:MM format
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
function inferMenuPeriodFromName(
  name: string, 
  items: string[],
  businessHours?: BusinessHours
): MenuPeriod | null {
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
  
  let times = defaultTimes[type];
  
  // Constrain to business hours if provided
  if (businessHours) {
    const constrained = constrainToBusinessHours(times.start, times.end, businessHours);
    times = { start: constrained.startTime, end: constrained.endTime };
  }
  
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
