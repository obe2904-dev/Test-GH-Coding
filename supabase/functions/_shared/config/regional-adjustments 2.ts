/**
 * Regional Content-Timing Adjustments
 * 
 * Modifies base archetype rules to account for cultural differences in dining times,
 * posting windows, and content consumption patterns across countries.
 * 
 * Each country can override:
 * - optimal_times: Shift posting windows (e.g., Spain dinner posts 3h later than Denmark)
 * - primary_days: Adjust day preferences (e.g., Sunday family dining in China)
 * - avoid: Add country-specific restrictions
 */

export interface RegionalContentRules {
  content_type: string
  time_shift?: number  // Hours to shift optimal_times (can be negative)
  optimal_times?: string[]  // Complete override of optimal_times
  primary_days?: string[]  // Override primary days
  secondary_days?: string[]  // Override secondary days
  avoid?: {
    days?: string[]
    times?: string[]
  }
}

export interface CountryDefinition {
  code: string
  label: string
  timezone: string
  culture_notes: string
  content_adjustments: RegionalContentRules[]
}

export const REGIONAL_ADJUSTMENTS: { [country_code: string]: CountryDefinition } = {
  
  DK: {
    code: "DK",
    label: "Denmark",
    timezone: "Europe/Copenhagen",
    culture_notes: "Early dinner culture (18:00-19:00), lunch 12:00-13:00",
    content_adjustments: [
      {
        content_type: "dinner",
        optimal_times: ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00"]  // Base rules
      },
      {
        content_type: "lunch",
        optimal_times: ["10:00", "11:00", "12:00", "13:00"]  // Base rules
      }
    ]
  },
  
  ES: {
    code: "ES",
    label: "Spain",
    timezone: "Europe/Madrid",
    culture_notes: "Late dining culture (lunch 14:00-16:00, dinner 21:00-23:00)",
    content_adjustments: [
      {
        content_type: "dinner",
        time_shift: 3,  // Shift 3 hours later: 14:00 becomes 17:00, 19:00 becomes 22:00
        optimal_times: ["17:00", "18:00", "19:00", "20:00", "21:00", "22:00"]
      },
      {
        content_type: "lunch",
        time_shift: 2,  // Shift 2 hours later: 10:00 becomes 12:00, 13:00 becomes 15:00
        optimal_times: ["12:00", "13:00", "14:00", "15:00"]
      },
      {
        content_type: "drinks",
        optimal_times: ["18:00", "19:00", "20:00", "21:00", "22:00"]  // Later than base
      },
      {
        content_type: "brunch",
        optimal_times: ["10:00", "11:00", "12:00", "13:00"]  // Later than base
      }
    ]
  },
  
  UK: {
    code: "UK",
    label: "United Kingdom",
    timezone: "Europe/London",
    culture_notes: "Pub culture, Sunday roast tradition, tea time",
    content_adjustments: [
      {
        content_type: "drinks",
        primary_days: ["Thursday", "Friday", "Saturday", "Sunday"],  // Sunday pub is big
        optimal_times: ["16:00", "17:00", "18:00", "19:00", "20:00"]
      },
      {
        content_type: "sunday_roast",  // UK-specific content type
        primary_days: ["Sunday"],
        optimal_times: ["10:00", "11:00", "12:00", "13:00"]
      },
      {
        content_type: "dinner",
        optimal_times: ["15:00", "16:00", "17:00", "18:00", "19:00"]  // Slightly earlier
      }
    ]
  },
  
  US: {
    code: "US",
    label: "United States",
    timezone: "America/New_York",  // Default to Eastern
    culture_notes: "Brunch culture strong, happy hour emphasis, earlier dinner",
    content_adjustments: [
      {
        content_type: "brunch",
        primary_days: ["Saturday", "Sunday"],
        secondary_days: ["Friday"],  // Friday brunch more common
        optimal_times: ["08:00", "09:00", "10:00", "11:00", "12:00"]
      },
      {
        content_type: "happy_hour",  // US-specific content type
        primary_days: ["Wednesday", "Thursday", "Friday"],
        optimal_times: ["14:00", "15:00", "16:00", "17:00"]
      },
      {
        content_type: "dinner",
        optimal_times: ["14:00", "15:00", "16:00", "17:00", "18:00"]  // Earlier than DK
      }
    ]
  },
  
  CN: {
    code: "CN",
    label: "China",
    timezone: "Asia/Shanghai",
    culture_notes: "Sunday family dining, hot pot culture, tea culture",
    content_adjustments: [
      {
        content_type: "dinner",
        primary_days: ["Friday", "Saturday", "Sunday"],  // Sunday family dining important
        optimal_times: ["15:00", "16:00", "17:00", "18:00", "19:00"]
      },
      {
        content_type: "family_dining",
        primary_days: ["Sunday"],  // Very strong Sunday family tradition
        optimal_times: ["11:00", "12:00", "13:00", "14:00", "15:00"]
      },
      {
        content_type: "drinks",
        primary_days: ["Friday", "Saturday"],  // Less drinks-focused culture
        optimal_times: ["18:00", "19:00", "20:00"]
      },
      {
        content_type: "tea",  // CN-specific content type
        primary_days: ["Saturday", "Sunday"],
        optimal_times: ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"]
      }
    ]
  },
  
  SE: {
    code: "SE",
    label: "Sweden",
    timezone: "Europe/Stockholm",
    culture_notes: "Early dining like Denmark, fika culture, weekend brunch",
    content_adjustments: [
      {
        content_type: "dinner",
        optimal_times: ["14:00", "15:00", "16:00", "17:00", "18:00"]  // Early like DK
      },
      {
        content_type: "fika",  // SE-specific content type
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        optimal_times: ["09:00", "10:00", "14:00", "15:00"]
      },
      {
        content_type: "brunch",
        primary_days: ["Saturday", "Sunday"],
        optimal_times: ["09:00", "10:00", "11:00", "12:00"]
      }
    ]
  },
  
  NO: {
    code: "NO",
    label: "Norway",
    timezone: "Europe/Oslo",
    culture_notes: "Similar to Denmark/Sweden, very early dinner",
    content_adjustments: [
      {
        content_type: "dinner",
        optimal_times: ["13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]  // Very early
      },
      {
        content_type: "lunch",
        optimal_times: ["09:00", "10:00", "11:00", "12:00"]  // Earlier
      }
    ]
  },
  
  FI: {
    code: "FI",
    label: "Finland",
    timezone: "Europe/Helsinki",
    culture_notes: "Early dining, coffee culture very strong",
    content_adjustments: [
      {
        content_type: "coffee",
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],  // Every day
        optimal_times: ["06:00", "07:00", "08:00", "09:00", "14:00", "15:00"]  // Morning + afternoon
      },
      {
        content_type: "dinner",
        optimal_times: ["13:00", "14:00", "15:00", "16:00", "17:00"]  // Very early
      }
    ]
  },
  
  FR: {
    code: "FR",
    label: "France",
    timezone: "Europe/Paris",
    culture_notes: "Traditional meal times, lunch is important social meal",
    content_adjustments: [
      {
        content_type: "lunch",
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        optimal_times: ["11:00", "12:00", "13:00", "14:00"]  // Lunch is sacred
      },
      {
        content_type: "dinner",
        optimal_times: ["16:00", "17:00", "18:00", "19:00", "20:00"]  // Later than Nordic
      },
      {
        content_type: "wine",
        primary_days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        optimal_times: ["15:00", "16:00", "17:00", "18:00", "19:00"]
      }
    ]
  },
  
  DE: {
    code: "DE",
    label: "Germany",
    timezone: "Europe/Berlin",
    culture_notes: "Beer culture, Sunday family tradition, hearty food",
    content_adjustments: [
      {
        content_type: "dinner",
        optimal_times: ["15:00", "16:00", "17:00", "18:00", "19:00"]  // Mid-range timing
      },
      {
        content_type: "drinks",
        primary_days: ["Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],  // Sunday beer garden
        optimal_times: ["15:00", "16:00", "17:00", "18:00", "19:00"]
      },
      {
        content_type: "family_dining",
        primary_days: ["Sunday"],  // Strong Sunday tradition
        optimal_times: ["11:00", "12:00", "13:00", "14:00"]
      }
    ]
  },
  
  IT: {
    code: "IT",
    label: "Italy",
    timezone: "Europe/Rome",
    culture_notes: "Late dining, aperitivo culture, Sunday family meals",
    content_adjustments: [
      {
        content_type: "dinner",
        time_shift: 2,  // Later than base
        optimal_times: ["16:00", "17:00", "18:00", "19:00", "20:00", "21:00"]
      },
      {
        content_type: "aperitivo",  // IT-specific content type
        primary_days: ["Wednesday", "Thursday", "Friday", "Saturday"],
        optimal_times: ["17:00", "18:00", "19:00", "20:00"]
      },
      {
        content_type: "family_dining",
        primary_days: ["Sunday"],  // Very strong tradition
        optimal_times: ["12:00", "13:00", "14:00", "15:00"]
      }
    ]
  }
}

/**
 * Apply regional adjustments to base content-type rules
 */
export function applyRegionalAdjustments(
  base_rules: {
    primary_days: string[]
    secondary_days?: string[]
    optimal_times: string[]
    avoid?: { days?: string[]; times?: string[] }
  },
  content_type: string,
  country_code: string
): typeof base_rules {
  const country = REGIONAL_ADJUSTMENTS[country_code]
  
  if (!country) {
    // No adjustments for this country, return base rules
    return base_rules
  }
  
  // Find adjustment for this content type
  const adjustment = country.content_adjustments.find(adj => adj.content_type === content_type)
  
  if (!adjustment) {
    // No specific adjustment, return base rules
    return base_rules
  }
  
  // Apply adjustments
  const adjusted = { ...base_rules }
  
  if (adjustment.optimal_times) {
    adjusted.optimal_times = adjustment.optimal_times
  } else if (adjustment.time_shift) {
    // Shift existing times by N hours
    adjusted.optimal_times = base_rules.optimal_times.map(time => {
      const [hours, minutes] = time.split(":").map(Number)
      const shifted_hours = (hours + adjustment.time_shift! + 24) % 24  // Handle wrap-around
      return `${shifted_hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
    })
  }
  
  if (adjustment.primary_days) {
    adjusted.primary_days = adjustment.primary_days
  }
  
  if (adjustment.secondary_days) {
    adjusted.secondary_days = adjustment.secondary_days
  }
  
  if (adjustment.avoid) {
    adjusted.avoid = {
      days: adjustment.avoid.days || adjusted.avoid?.days || [],
      times: adjustment.avoid.times || adjusted.avoid?.times || []
    }
  }
  
  return adjusted
}

/**
 * Get optimal posting time for content based on archetype + region
 */
export function getOptimalPostingTime(
  content_type: string,
  archetype: string,
  country_code: string,
  day_of_week: string
): string | null {
  // This will integrate with archetype-rules.ts
  // For now, return null (full integration in Phase 1 implementation)
  return null
}

/**
 * Validate if a time is appropriate for content type in this country
 */
export function isTimeAppropriate(
  time: string,  // Format: "HH:MM"
  content_type: string,
  country_code: string
): boolean {
  const country = REGIONAL_ADJUSTMENTS[country_code]
  
  if (!country) {
    // No regional rules, allow all times
    return true
  }
  
  const adjustment = country.content_adjustments.find(adj => adj.content_type === content_type)
  
  if (!adjustment) {
    // No specific rules for this content type
    return true
  }
  
  // Check if time is in avoid ranges
  if (adjustment.avoid?.times) {
    for (const avoid_range of adjustment.avoid.times) {
      const [start, end] = avoid_range.split("-")
      if (isTimeBetween(time, start, end)) {
        return false  // Time is in avoid range
      }
    }
  }
  
  // Check if time is in optimal_times (if specified)
  if (adjustment.optimal_times && adjustment.optimal_times.length > 0) {
    const time_hour = parseInt(time.split(":")[0])
    const optimal_hours = adjustment.optimal_times.map(t => parseInt(t.split(":")[0]))
    
    // Allow times within 2 hours of any optimal time
    return optimal_hours.some(opt => Math.abs(time_hour - opt) <= 2)
  }
  
  return true
}

/**
 * Helper: Check if time is between start and end
 */
function isTimeBetween(time: string, start: string, end: string): boolean {
  const [t_hour, t_min] = time.split(":").map(Number)
  const [s_hour, s_min] = start.split(":").map(Number)
  const [e_hour, e_min] = end.split(":").map(Number)
  
  const t_total = t_hour * 60 + t_min
  const s_total = s_hour * 60 + s_min
  const e_total = e_hour * 60 + e_min
  
  if (e_total >= s_total) {
    // Normal range (e.g., 09:00-17:00)
    return t_total >= s_total && t_total <= e_total
  } else {
    // Wrap-around range (e.g., 22:00-02:00)
    return t_total >= s_total || t_total <= e_total
  }
}

/**
 * Get culture-specific content types that exist in this country
 */
export function getCultureSpecificContentTypes(country_code: string): string[] {
  const country = REGIONAL_ADJUSTMENTS[country_code]
  
  if (!country) {
    return []
  }
  
  // Extract content types that are unique to this country
  const culture_specific = country.content_adjustments
    .map(adj => adj.content_type)
    .filter(ct => {
      // If this content type appears ONLY in this country, it's culture-specific
      const universal = ["drinks", "brunch", "lunch", "dinner", "coffee", "pastries", "wine"]
      return !universal.includes(ct)
    })
  
  return culture_specific
}
