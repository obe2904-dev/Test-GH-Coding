/**
 * Content-Timing Archetype Rules
 * 
 * Defines when different types of content should be posted based on business archetype.
 * Each archetype has specific rules for different content types (drinks, brunch, lunch, dinner, etc.)
 * 
 * Rules specify:
 * - primary_days: Best days for this content
 * - secondary_days: Acceptable alternative days
 * - optimal_times: Best times to post (when audience is making decisions)
 * - avoid: Days/times that should never be used
 */

export interface ContentTypeRules {
  primary_days: string[]
  secondary_days?: string[]
  optimal_times: string[]
  avoid?: {
    days?: string[]
    times?: string[]  // Format: "HH:MM-HH:MM"
  }
}

export interface ArchetypeDefinition {
  label: string
  description: string
  content_types: {
    [key: string]: ContentTypeRules
  }
  event_handling: {
    lead_time_days: number
    high_priority_events: string[]
  }
}

export const ARCHETYPE_RULES: { [key: string]: ArchetypeDefinition } = {
  
  casual_dining: {
    label: "Casual Dining",
    description: "Neighborhood restaurants, cafes, bistros",
    
    content_types: {
      drinks: {
        primary_days: ["Thursday", "Friday", "Saturday"],
        secondary_days: ["Wednesday"],
        optimal_times: ["14:00", "15:00", "16:00", "17:00", "18:00"],
        avoid: {
          days: ["Sunday", "Monday", "Tuesday"],
          times: ["00:00-13:59"]  // No drinks posts before 14:00
        }
      },
      
      brunch: {
        primary_days: ["Saturday", "Sunday"],
        optimal_times: ["07:00", "08:00", "09:00", "10:00", "11:00"],
        avoid: {
          days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          times: ["12:00-23:59"]  // Brunch posts should be morning only
        }
      },
      
      lunch: {
        primary_days: ["Tuesday", "Wednesday", "Thursday", "Friday"],
        secondary_days: ["Monday"],
        optimal_times: ["10:00", "11:00", "12:00", "13:00"],
        avoid: {
          days: ["Saturday", "Sunday"],
          times: []
        }
      },
      
      dinner: {
        primary_days: ["Wednesday", "Thursday", "Friday", "Saturday"],
        secondary_days: ["Tuesday"],
        optimal_times: ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00"],
        avoid: {
          days: ["Sunday", "Monday"],
          times: []
        }
      },
      
      coffee: {
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        optimal_times: ["07:00", "08:00", "09:00", "10:00"],
        avoid: {
          days: [],
          times: []
        }
      }
    },
    
    event_handling: {
      lead_time_days: 2,  // Post 1-2 days before events
      high_priority_events: [
        "christmas_season", "valentines_day", "mothers_day", 
        "fathers_day", "easter"
      ]
    }
  },
  
  nightlife_bar: {
    label: "Nightlife & Bars",
    description: "Cocktail bars, wine bars, nightclubs, late-night venues",
    
    content_types: {
      drinks: {
        primary_days: ["Thursday", "Friday", "Saturday"],
        secondary_days: ["Sunday", "Wednesday"],
        optimal_times: ["16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"],  // Later than casual
        avoid: {
          days: ["Monday", "Tuesday"],
          times: ["00:00-15:59"]  // No drinks posts before 16:00 for nightlife
        }
      },
      
      events: {
        primary_days: ["Wednesday", "Thursday", "Friday", "Saturday"],
        optimal_times: ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"],
        avoid: {
          days: [],
          times: []
        }
      },
      
      late_night: {
        primary_days: ["Friday", "Saturday"],
        secondary_days: ["Thursday", "Sunday"],
        optimal_times: ["17:00", "18:00", "19:00", "20:00", "21:00"],
        avoid: {
          days: ["Monday", "Tuesday", "Wednesday"],
          times: []
        }
      }
    },
    
    event_handling: {
      lead_time_days: 3,  // Longer lead time for party planning
      high_priority_events: [
        "new_years_eve", "halloween", "summer_festival", "music_events"
      ]
    }
  },
  
  brunch_specialist: {
    label: "Brunch Specialist",
    description: "Weekend-focused brunch cafes",
    
    content_types: {
      brunch: {
        primary_days: ["Saturday", "Sunday"],
        secondary_days: ["Friday"],  // Some places do Friday brunch
        optimal_times: ["07:00", "08:00", "09:00", "10:00", "11:00"],
        avoid: {
          days: ["Monday", "Tuesday", "Wednesday", "Thursday"],
          times: ["12:00-23:59"]  // Brunch posts should be morning
        }
      },
      
      coffee: {
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        optimal_times: ["07:00", "08:00", "09:00", "10:00"],
        avoid: {
          days: ["Saturday", "Sunday"],  // Weekend = brunch content, not coffee
          times: []
        }
      },
      
      pastries: {
        primary_days: ["Saturday", "Sunday"],
        secondary_days: ["Friday"],
        optimal_times: ["08:00", "09:00", "10:00"],
        avoid: {
          days: [],
          times: []
        }
      }
    },
    
    event_handling: {
      lead_time_days: 1,  // Brunch is often same-day or day-before decision
      high_priority_events: [
        "mothers_day", "fathers_day", "easter", "valentines_day"
      ]
    }
  },
  
  fine_dining: {
    label: "Fine Dining",
    description: "High-end restaurants, reservation-heavy, tasting menus",
    
    content_types: {
      dinner: {
        primary_days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        optimal_times: ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00"],  // Longer booking window
        avoid: {
          days: ["Sunday", "Monday"],
          times: []
        }
      },
      
      wine: {
        primary_days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        optimal_times: ["13:00", "14:00", "15:00", "16:00", "17:00", "18:00"],
        avoid: {
          days: ["Sunday", "Monday"],
          times: []
        }
      },
      
      tasting_menu: {
        primary_days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        optimal_times: ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"],
        avoid: {
          days: ["Sunday", "Monday"],
          times: []
        }
      },
      
      special_events: {
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        optimal_times: ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"],
        avoid: {
          days: [],
          times: []
        }
      }
    },
    
    event_handling: {
      lead_time_days: 5,  // Fine dining = longer planning window
      high_priority_events: [
        "christmas_season", "new_years_eve", "valentines_day", "michelin_guide_release"
      ]
    }
  },
  
  fast_casual: {
    label: "Fast Casual",
    description: "Quick service, high turnover, grab-and-go",
    
    content_types: {
      lunch: {
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        optimal_times: ["09:00", "10:00", "11:00", "11:30"],  // Same-day lunch decision
        avoid: {
          days: ["Saturday", "Sunday"],
          times: []
        }
      },
      
      dinner: {
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        optimal_times: ["14:00", "15:00", "16:00", "17:00"],  // Same-day evening decision
        avoid: {
          days: [],
          times: []
        }
      },
      
      quick_bites: {
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        optimal_times: ["09:00", "10:00", "11:00", "14:00", "15:00"],
        avoid: {
          days: [],
          times: []
        }
      }
    },
    
    event_handling: {
      lead_time_days: 0,  // Fast casual = same-day spontaneous visits
      high_priority_events: []  // Less event-driven
    }
  },
  
  hotel_restaurant: {
    label: "Hotel Restaurant",
    description: "Tourist-oriented, any-day operations",
    
    content_types: {
      dinner: {
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],  // Tourists any day
        optimal_times: ["13:00", "14:00", "15:00", "16:00", "17:00", "18:00"],
        avoid: {
          days: [],
          times: []
        }
      },
      
      brunch: {
        primary_days: ["Friday", "Saturday", "Sunday"],
        optimal_times: ["09:00", "10:00", "11:00", "12:00", "13:00"],
        avoid: {
          days: [],
          times: []
        }
      },
      
      drinks: {
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],  // Tourists don't follow local patterns
        optimal_times: ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00"],
        avoid: {
          days: [],
          times: []
        }
      }
    },
    
    event_handling: {
      lead_time_days: 3,  // Tourists plan 2-4 days ahead
      high_priority_events: [
        "local_festivals", "conferences", "sports_events"
      ]
    }
  },
  
  bakery_cafe: {
    label: "Bakery & Cafe",
    description: "Morning-focused, pastries, coffee",
    
    content_types: {
      pastries: {
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],  // Every day
        optimal_times: ["07:00", "08:00", "09:00"],
        avoid: {
          days: [],
          times: ["10:00-23:59"]  // Pastries should post early
        }
      },
      
      coffee: {
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        optimal_times: ["06:00", "07:00", "08:00"],
        avoid: {
          days: [],
          times: []
        }
      },
      
      lunch: {
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        optimal_times: ["10:00", "11:00", "12:00"],
        avoid: {
          days: [],
          times: []
        }
      },
      
      bread: {
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        optimal_times: ["07:00", "08:00", "09:00", "10:00"],
        avoid: {
          days: [],
          times: []
        }
      }
    },
    
    event_handling: {
      lead_time_days: 1,
      high_priority_events: [
        "christmas_season", "easter", "valentines_day"
      ]
    }
  },
  
  family_casual: {
    label: "Family Casual",
    description: "Family-friendly restaurants, kids menus",
    
    content_types: {
      family_dining: {
        primary_days: ["Saturday", "Sunday"],
        secondary_days: ["Friday"],
        optimal_times: ["11:00", "12:00", "13:00", "14:00"],
        avoid: {
          days: ["Monday", "Tuesday", "Wednesday", "Thursday"],
          times: []
        }
      },
      
      kids_menu: {
        primary_days: ["Saturday", "Sunday"],
        optimal_times: ["11:00", "12:00", "13:00"],
        avoid: {
          days: ["Monday", "Tuesday", "Wednesday", "Thursday"],
          times: []
        }
      },
      
      weekend_special: {
        primary_days: ["Saturday", "Sunday"],
        secondary_days: ["Friday"],
        optimal_times: ["10:00", "11:00", "12:00", "13:00"],
        avoid: {
          days: [],
          times: []
        }
      }
    },
    
    event_handling: {
      lead_time_days: 2,
      high_priority_events: [
        "mothers_day", "fathers_day", "easter", "school_holidays", "birthday_season"
      ]
    }
  }
}

/**
 * Hybrid Archetype Templates
 * 
 * Common combinations of multiple archetypes (e.g., cafe by day, bar by night).
 * Each hybrid maps content types to specific base archetypes.
 */
export interface HybridArchetypeDefinition {
  label: string
  description: string
  base_archetypes: string[]
  content_distribution: {
    [content_type: string]: string  // Maps content type to base archetype
  }
}

export const HYBRID_ARCHETYPES: { [key: string]: HybridArchetypeDefinition } = {
  
  cafe_bar: {
    label: "Cafe & Bar",
    description: "Daytime cafe, evening bar (like Cafe Faust)",
    base_archetypes: ["casual_dining", "nightlife_bar", "brunch_specialist"],
    content_distribution: {
      brunch: "brunch_specialist",
      coffee: "casual_dining",
      lunch: "casual_dining",
      dinner: "casual_dining",
      drinks: "nightlife_bar",  // Use nightlife rules for drinks (later timing)
      late_night: "nightlife_bar"
    }
  },
  
  brunch_and_dinner: {
    label: "Brunch & Dinner",
    description: "Weekend brunch, evening dinner (skip lunch)",
    base_archetypes: ["brunch_specialist", "casual_dining"],
    content_distribution: {
      brunch: "brunch_specialist",
      dinner: "casual_dining",
      drinks: "casual_dining"
    }
  },
  
  coffee_and_wine: {
    label: "Coffee & Wine",
    description: "Morning coffee, evening wine bar",
    base_archetypes: ["bakery_cafe", "casual_dining"],
    content_distribution: {
      coffee: "bakery_cafe",
      pastries: "bakery_cafe",
      wine: "casual_dining",
      drinks: "casual_dining"
    }
  },
  
  bistro_bar: {
    label: "Bistro & Bar",
    description: "Bistro dining with substantial bar program",
    base_archetypes: ["casual_dining", "nightlife_bar"],
    content_distribution: {
      lunch: "casual_dining",
      dinner: "casual_dining",
      drinks: "nightlife_bar",
      wine: "casual_dining"
    }
  }
}

/**
 * Content type inference keywords
 * Used to determine content type from programme name, category, or description
 */
export const CONTENT_TYPE_KEYWORDS = {
  drinks: ["cocktail", "drinks", "wine bar", "bar", "cocktails", "aperitif", "aperitivo"],
  brunch: ["brunch", "morgenmad"],
  lunch: ["lunch", "frokost", "middag"],
  dinner: ["dinner", "aftensmad", "aften", "evening menu", "supper"],
  coffee: ["coffee", "kaffe", "espresso", "cappuccino"],
  pastries: ["pastries", "croissant", "bread", "baked", "bageri", "wienerbrød"],
  wine: ["wine", "vin", "wine pairing"],
  late_night: ["late night", "after dark", "midnight"],
  family_dining: ["family", "familie"],
  kids_menu: ["kids", "children", "børne"],
  tasting_menu: ["tasting menu", "chef's table", "degustation"],
  special_events: ["special event", "celebration", "private dining"]
}

/**
 * Determine content type from programme information
 */
export function determineContentType(
  programme: { name: string; description?: string; category?: string },
  post?: { title?: string; content_category?: string }
): string {
  const combined = `${programme.name} ${programme.description || ""} ${programme.category || ""} ${post?.title || ""} ${post?.content_category || ""}`.toLowerCase()
  
  // Check each content type's keywords
  for (const [content_type, keywords] of Object.entries(CONTENT_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (combined.includes(keyword.toLowerCase())) {
        return content_type
      }
    }
  }
  
  // Fallback: infer from category if available
  if (programme.category) {
    const cat = programme.category.toLowerCase()
    if (cat.includes("drink")) return "drinks"
    if (cat.includes("lunch")) return "lunch"
    if (cat.includes("dinner")) return "dinner"
    if (cat.includes("brunch")) return "brunch"
  }
  
  // Default fallback
  return "general"
}

/**
 * Get content-type rules for a programme
 */
export function getContentTypeRules(
  archetype: string,
  content_type: string,
  country_code: string = "DK"
): ContentTypeRules | null {
  // Check if archetype is hybrid
  if (HYBRID_ARCHETYPES[archetype]) {
    const hybrid = HYBRID_ARCHETYPES[archetype]
    const mapped_archetype = hybrid.content_distribution[content_type]
    
    if (mapped_archetype) {
      // Recursively get rules from mapped archetype
      return getContentTypeRules(mapped_archetype, content_type, country_code)
    }
    
    // Fallback to first base archetype
    return getContentTypeRules(hybrid.base_archetypes[0], content_type, country_code)
  }
  
  // Regular archetype
  let archetype_def = ARCHETYPE_RULES[archetype]
  if (!archetype_def) {
    console.error(`Unknown archetype: ${archetype} - falling back to casual_dining`)
    archetype = 'casual_dining'  // Sensible fallback
    archetype_def = ARCHETYPE_RULES[archetype]
  }
  
  const rules = archetype_def.content_types[content_type]
  if (!rules) {
    console.warn(`No rules for content_type "${content_type}" in archetype "${archetype}"`)
    return null
  }
  
  // TODO: Apply regional adjustments based on country_code
  // For now, return base rules
  return rules
}
