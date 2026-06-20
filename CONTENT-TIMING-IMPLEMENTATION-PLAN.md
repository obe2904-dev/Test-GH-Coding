# Content-Timing Rules Implementation Plan

**Date**: May 3, 2026  
**Purpose**: Comprehensive roadmap to implement temporal context-aware content scheduling  
**Addresses**: Drinks-on-Sunday bug, hybrid businesses, seasonal shifts, regional differences

---

## Executive Summary

### What We're Solving

**Critical Bug**: Drinks/evening content scheduled Sunday 9:00 AM instead of Friday-Saturday 14:00-18:00

**Root Causes**:
1. No content-type constraints in day assignment (Phase 2a)
2. No content-time validation layer
3. Static archetype approach can't handle hybrids (Cafe Faust = cafe + restaurant + bar + brunch + nightlife)
4. No temporal context awareness (May outdoor season ≠ November indoor season)
5. No regional/cultural timing differences (Denmark ≠ Spain ≠ UK)

### Solution Architecture

**Three-Layer System**:

1. **Programme-Level Temporal Relevance** (replaces static business archetypes)
   - Each programme defines: peak_days, peak_times, peak_months, peak_seasons, event_affinity
   - Handles hybrids: "Signature Cocktails" = nightlife rules, "Weekend Brunch" = brunch rules
   - AI auto-generates from programme description (zero owner burden)

2. **Context-Aware Priority Scoring** (replaces static programme rotation)
   - Base score (recency + frequency + revenue) × temporal multiplier
   - Temporal multiplier from: season match, month match, event affinity, weather
   - May outdoor season: cocktails get 2.0× boost, lunch gets 0.9× penalty
   - November indoor season: lunch gets 1.3× boost, cocktails get 0.7× penalty

3. **Validation Layer** (safety net)
   - Universal rules: evening content ≥ 14:00, brunch = weekends, rationale-execution coherence
   - Catches impossible combinations even if upstream logic fails
   - Regenerates with explicit constraints on validation failure

**Regional Support**:
- Archetype rules defined per country/region (DK, ES, UK, US, CN, etc.)
- Cafe Faust in Denmark: dinner posts 14:00-19:00 (dinner at 18:00)
- Same business in Spain: dinner posts 17:00-21:00 (dinner at 21:00)

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-3) - CRITICAL

**Goal**: Fix immediate bug, establish archetype framework, add validation

**Deliverables**:
1. ✅ Archetype rules configuration system
2. ✅ Programme temporal relevance data structure
3. ✅ Validation layer (blocks Sunday 9:00 drinks disasters)
4. ✅ Basic temporal scoring (no multipliers yet, just base + archetype constraints)
5. ✅ Regional timing adjustments (DK initial, add ES/UK/US later)

**Impact**: Prevents 90% of scheduling errors, fixes drinks-on-Sunday bug

**Estimated Effort**: 2-3 weeks

---

### Phase 2: Temporal Context (Weeks 4-5)

**Goal**: Enable seasonal/event-driven content emphasis shifts

**Deliverables**:
1. ✅ Enhanced week context analysis (season, events, weather)
2. ✅ Temporal multiplier calculation (season/month/event match → boost/penalty)
3. ✅ Context-aware programme priority scoring
4. ✅ AI-generated temporal relevance for programmes

**Impact**: Content mix automatically shifts (May = cocktails emphasis, November = lunch emphasis)

**Estimated Effort**: 1-2 weeks

---

### Phase 3: Hybrid Business Support (Weeks 5-6)

**Goal**: Handle multi-faceted businesses like Cafe Faust

**Deliverables**:
1. ✅ Programme-level archetype resolution (each programme can have different rules)
2. ✅ AI auto-detection of hybrid business types
3. ✅ Hybrid archetype templates (cafe_bar, brunch_and_dinner, coffee_and_wine)
4. ✅ Programme keyword matching (drinks → nightlife rules, brunch → brunch rules)

**Impact**: Cafe Faust's cocktails use nightlife timing, brunch uses weekend timing, lunch uses weekday timing

**Estimated Effort**: 1-2 weeks

---

### Phase 4: Regional Expansion (Weeks 6-8)

**Goal**: Support 10+ countries with cultural timing differences

**Deliverables**:
1. ✅ Regional adjustment configurations (ES, UK, US, CN, FR, IT, DE, SE, NO, FI)
2. ✅ Cultural timing rules (Spanish late dining, UK pub culture, Asian family Sundays)
3. ✅ Cuisine culture vs audience culture (Spanish restaurant serving Danes)
4. ✅ Multi-country business support (hotel chains)

**Impact**: Same archetype adapts globally (casual_dining in DK ≠ ES ≠ CN)

**Estimated Effort**: 2 weeks

---

### Phase 5: Owner Control & Polish (Weeks 8-10, Optional)

**Goal**: Give sophisticated owners fine-tuning ability

**Deliverables**:
1. ✅ Owner review UI for temporal relevance ("Drinks posts Thu-Sat 14:00-18:00 - correct?")
2. ✅ Override system for 5% edge cases
3. ✅ Dashboard showing temporal multipliers (transparency/debugging)
4. ✅ A/B test framework (measure engagement improvement)

**Impact**: Owner trust, handles true edge cases, measurable improvement

**Estimated Effort**: 2 weeks

---

### Phase 6: Continuous Improvement (Ongoing)

**Goal**: Learn and adapt from real-world usage

**Deliverables**:
1. ✅ Validation failure tracking (which rules fail most? → improve archetypes)
2. ✅ Engagement correlation (which temporal boosts actually increase engagement?)
3. ✅ Owner feedback loop ("Was this week's timing good?")
4. ✅ New archetype definitions (food_truck, ghost_kitchen, catering)

**Impact**: System improves automatically, new business types supported

**Estimated Effort**: Ongoing maintenance

---

## Detailed Implementation: Phase 1 (Critical Foundation)

### 1.1 Database Schema Changes

**Add to `programmes` table**:

```sql
-- Temporal relevance for each programme
ALTER TABLE programmes ADD COLUMN temporal_relevance JSONB;

-- Archetype assignment per programme
ALTER TABLE programmes ADD COLUMN programme_archetype VARCHAR(50);

-- Whether this programme is enabled
ALTER TABLE programmes ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Comment for documentation
COMMENT ON COLUMN programmes.temporal_relevance IS 
  'Defines when this programme is most relevant: peak_days, peak_times, peak_months, peak_seasons, event_affinity';

COMMENT ON COLUMN programmes.programme_archetype IS 
  'Archetype for this specific programme (overrides business-level archetype): casual_dining, nightlife_bar, brunch_specialist, etc.';
```

**Add to `brand_profile` table**:

```sql
-- Business-level archetype (primary, for programmes without specific archetype)
ALTER TABLE brand_profile ADD COLUMN business_archetype VARCHAR(50);

-- Regional/cultural context
ALTER TABLE brand_profile ADD COLUMN country_code VARCHAR(2);  -- ISO 3166-1 alpha-2
ALTER TABLE brand_profile ADD COLUMN region VARCHAR(50);  -- e.g., "nordic", "mediterranean", "north_america"

-- Cultural context for ethnic restaurants
ALTER TABLE brand_profile ADD COLUMN cuisine_culture VARCHAR(50);  -- e.g., "spanish", "italian", "chinese"
ALTER TABLE brand_profile ADD COLUMN audience_culture VARCHAR(50);  -- e.g., "danish", "mixed", "expat"

-- Owner overrides (optional, for Phase 5)
ALTER TABLE brand_profile ADD COLUMN content_timing_overrides JSONB;

-- Comment for documentation
COMMENT ON COLUMN brand_profile.business_archetype IS 
  'Primary business archetype: casual_dining, fine_dining, nightlife_bar, brunch_specialist, fast_casual, hotel_restaurant, bakery_cafe, ethnic_specialist';

COMMENT ON COLUMN brand_profile.country_code IS 
  'ISO country code for regional timing adjustments (DK, ES, UK, US, etc.)';
```

**Data migration**:

```sql
-- Set default archetype for existing businesses
UPDATE brand_profile 
SET business_archetype = 'casual_dining'  -- Conservative default
WHERE business_archetype IS NULL;

-- Infer country_code from location
UPDATE brand_profile 
SET country_code = 'DK'  -- For Cafe Faust and other Danish businesses
WHERE location LIKE '%Denmark%' OR location LIKE '%Danmark%' OR city IN ('Aarhus', 'Copenhagen', 'Aalborg', 'Odense');

-- Set temporal_relevance to empty object for existing programmes (will be AI-generated later)
UPDATE programmes 
SET temporal_relevance = '{}'::jsonb
WHERE temporal_relevance IS NULL;
```

---

### 1.2 Archetype Rules Configuration System

**Create configuration file**: `/supabase/functions/_shared/config/archetype-rules.ts`

**Structure**:

```typescript
// Core archetype definitions with content-timing rules
export const ARCHETYPE_RULES = {
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
          times: []
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
      }
    },
    
    event_handling: {
      lead_time_days: 2,  // Post 1-2 days before events
      high_priority_events: ["christmas_season", "valentines_day", "mothers_day", "fathers_day", "easter"]
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
      }
    },
    
    event_handling: {
      lead_time_days: 3,  // Longer lead time for party planning
      high_priority_events: ["new_years_eve", "halloween", "summer_festival", "music_events"]
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
      }
    },
    
    event_handling: {
      lead_time_days: 1,  // Brunch is often same-day or day-before decision
      high_priority_events: ["mothers_day", "fathers_day", "easter", "valentines_day"]
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
      
      special_events: {
        primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],  // Any day for special events
        optimal_times: ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"],
        avoid: {
          days: [],
          times: []
        },
        lead_time_days: 7  // Week-long booking window for special events
      }
    },
    
    event_handling: {
      lead_time_days: 5,  // Fine dining = longer planning window
      high_priority_events: ["christmas_season", "new_years_eve", "valentines_day", "michelin_guide_release"]
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
      high_priority_events: ["local_festivals", "conferences", "sports_events"]
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
      }
    },
    
    event_handling: {
      lead_time_days: 1,
      high_priority_events: ["christmas_season", "easter", "valentines_day"]  // Special pastries for holidays
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
      }
    },
    
    event_handling: {
      lead_time_days: 2,
      high_priority_events: ["mothers_day", "fathers_day", "easter", "school_holidays", "birthday_season"]
    }
  }
}

// Hybrid archetype templates (common combinations)
export const HYBRID_ARCHETYPES = {
  cafe_bar: {
    label: "Cafe & Bar",
    description: "Daytime cafe, evening bar (like Cafe Faust)",
    base_archetypes: ["casual_dining", "nightlife_bar", "brunch_specialist"],
    content_distribution: {
      // How to blend rules from multiple archetypes
      brunch: "brunch_specialist",
      coffee: "casual_dining",
      lunch: "casual_dining",
      dinner: "casual_dining",
      drinks: "nightlife_bar"  // Use nightlife rules for drinks (later timing)
    }
  },
  
  brunch_and_dinner: {
    label: "Brunch & Dinner",
    description: "Weekend brunch, evening dinner (skip lunch)",
    base_archetypes: ["brunch_specialist", "casual_dining"],
    content_distribution: {
      brunch: "brunch_specialist",
      dinner: "casual_dining"
    }
  },
  
  coffee_and_wine: {
    label: "Coffee & Wine",
    description: "Morning coffee, evening wine bar",
    base_archetypes: ["bakery_cafe", "casual_dining"],
    content_distribution: {
      coffee: "bakery_cafe",
      pastries: "bakery_cafe",
      wine: "casual_dining"
    }
  }
}
```

---

### 1.3 Regional Timing Adjustments

**Create configuration file**: `/supabase/functions/_shared/config/regional-adjustments.ts`

```typescript
export const REGIONAL_ADJUSTMENTS = {
  "DK": {  // Denmark
    label: "Denmark",
    timezone: "Europe/Copenhagen",
    
    timing_shifts: {
      // Danish dining culture
      lunch_time: "12:00-13:30",
      dinner_time: "18:00-20:00",
      
      // Content posting windows (when to post for these meal times)
      lunch_posting: "10:00-13:00",
      dinner_posting: "14:00-19:00"
    },
    
    archetype_adjustments: {
      casual_dining: {
        dinner: {
          optimal_times: ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00"]  // Earlier than southern Europe
        }
      },
      nightlife_bar: {
        drinks: {
          optimal_times: ["16:00", "17:00", "18:00", "19:00", "20:00"]  // Earlier than Spain/Italy
        }
      }
    },
    
    cultural_notes: {
      sunday_pattern: "low_evening_activity",  // Sunday evening dining is quiet in Denmark
      weekday_lunch: "strong",  // Strong weekday lunch culture
      late_night: "moderate"  // Moderate late-night culture (not like Spain)
    }
  },
  
  "ES": {  // Spain
    label: "Spain",
    timezone: "Europe/Madrid",
    
    timing_shifts: {
      lunch_time: "14:00-16:00",  // Much later than Nordic
      dinner_time: "21:00-23:00",  // Very late
      
      lunch_posting: "11:00-14:00",
      dinner_posting: "17:00-21:00"  // Later posting for late dining
    },
    
    archetype_adjustments: {
      casual_dining: {
        lunch: {
          optimal_times: ["11:00", "12:00", "13:00", "14:00"]  // Later than DK
        },
        dinner: {
          optimal_times: ["17:00", "18:00", "19:00", "20:00", "21:00"]  // Much later than DK
        }
      },
      nightlife_bar: {
        drinks: {
          optimal_times: ["18:00", "19:00", "20:00", "21:00", "22:00"]  // Very late
        }
      }
    },
    
    cultural_notes: {
      sunday_pattern: "strong_lunch",  // Sunday lunch is big in Spain
      weekday_lunch: "strong",
      late_night: "very_strong",  // Strong late-night culture
      siesta: true  // Some businesses close 14:00-17:00
    }
  },
  
  "UK": {  // United Kingdom
    label: "United Kingdom",
    timezone: "Europe/London",
    
    timing_shifts: {
      lunch_time: "12:00-14:00",
      dinner_time: "18:00-20:00",
      
      lunch_posting: "10:00-13:00",
      dinner_posting: "14:00-18:00"
    },
    
    archetype_adjustments: {
      casual_dining: {
        lunch: {
          optimal_times: ["10:00", "11:00", "12:00", "13:00"]
        },
        dinner: {
          optimal_times: ["14:00", "15:00", "16:00", "17:00", "18:00"]
        }
      },
      
      // UK-specific: pub culture
      pub: {  // New archetype for UK
        lunch: {
          primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          optimal_times: ["11:00", "12:00", "13:00", "14:00"]
        },
        after_work: {
          primary_days: ["Thursday", "Friday"],
          optimal_times: ["15:00", "16:00", "17:00", "18:00"]
        }
      }
    },
    
    cultural_notes: {
      sunday_pattern: "strong_lunch",  // Sunday roast tradition
      pub_culture: true,
      afternoon_tea: true
    }
  },
  
  "US": {  // United States
    label: "United States",
    timezone: "America/New_York",  // Default, but US has multiple timezones
    
    timing_shifts: {
      lunch_time: "12:00-13:00",
      dinner_time: "17:00-19:00",  // Earlier than Europe
      
      lunch_posting: "10:00-12:30",
      dinner_posting: "13:00-17:00"
    },
    
    archetype_adjustments: {
      casual_dining: {
        dinner: {
          optimal_times: ["13:00", "14:00", "15:00", "16:00", "17:00"]  // Earlier than Europe
        }
      },
      brunch_specialist: {
        brunch: {
          optimal_times: ["08:00", "09:00", "10:00", "11:00", "12:00"]  // Big brunch culture
        }
      }
    },
    
    cultural_notes: {
      sunday_pattern: "strong_brunch",  // Strong Sunday brunch culture
      brunch_culture: "very_strong",
      early_dining: true,  // Americans dine earlier than Europeans
      tipping_culture: true
    }
  },
  
  "CN": {  // China
    label: "China",
    timezone: "Asia/Shanghai",
    
    timing_shifts: {
      lunch_time: "11:30-13:00",
      dinner_time: "18:00-20:00",
      
      lunch_posting: "10:00-12:00",
      dinner_posting: "14:00-18:00"
    },
    
    archetype_adjustments: {
      casual_dining: {
        dinner: {
          primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],  // Sunday family dinners
          optimal_times: ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]
        }
      }
    },
    
    cultural_notes: {
      sunday_pattern: "strong_family_dinner",  // Sunday is family dinner day (opposite of Western "Sunday is dead")
      weekend_dining: "very_strong",
      group_dining: "strong",
      no_sunday_quiet: true  // Sunday is active, not quiet
    }
  },
  
  "SE": {  // Sweden
    label: "Sweden",
    timezone: "Europe/Stockholm",
    
    timing_shifts: {
      lunch_time: "11:30-13:00",
      dinner_time: "18:00-19:30",
      
      lunch_posting: "10:00-12:30",
      dinner_posting: "14:00-18:00"
    },
    
    archetype_adjustments: {
      casual_dining: {
        dinner: {
          optimal_times: ["14:00", "15:00", "16:00", "17:00", "18:00"]  // Similar to DK
        }
      }
    },
    
    cultural_notes: {
      sunday_pattern: "low_evening_activity",  // Similar to Denmark
      fika_culture: true,  // Coffee break culture
      early_dining: true
    }
  }
}
```

---

### 1.4 Validation Layer Implementation

**Create file**: `/supabase/functions/_shared/post-helpers/validation/content-timing-validator.ts`

**Purpose**: Catch impossible content-timing combinations before saving weekly plan

```typescript
// Validation rules (universal, no exceptions)

interface ValidationRule {
  name: string
  check: (post: WeeklyPost, context: ValidationContext) => boolean
  error_message: (post: WeeklyPost) => string
  severity: "error" | "warning"
  auto_fix?: (post: WeeklyPost, context: ValidationContext) => WeeklyPost | null
}

const VALIDATION_RULES: ValidationRule[] = [
  
  // Rule 1: Semantic content-time coherence
  {
    name: "evening_content_timing",
    check: (post, context) => {
      const evening_keywords = ["evening", "aften", "night", "nat", "drinks", "cocktails", "wine bar", "bar"]
      const title_lower = post.title.toLowerCase()
      const has_evening_content = evening_keywords.some(kw => title_lower.includes(kw))
      
      if (has_evening_content) {
        const hour = parseInt(post.suggested_time.split(":")[0])
        return hour >= 14  // Evening content must post at 14:00 or later
      }
      return true
    },
    error_message: (post) => `Evening content "${post.title}" cannot be scheduled at ${post.suggested_time} (before 14:00)`,
    severity: "error",
    auto_fix: (post, context) => {
      // Try to reschedule to 14:00 on the same day
      return { ...post, suggested_time: "14:00" }
    }
  },
  
  // Rule 2: Morning content timing
  {
    name: "morning_content_timing",
    check: (post, context) => {
      const morning_keywords = ["morning", "morgen", "breakfast", "morgenmad", "coffee", "kaffe", "pastries"]
      const title_lower = post.title.toLowerCase()
      const has_morning_content = morning_keywords.some(kw => title_lower.includes(kw))
      
      if (has_morning_content) {
        const hour = parseInt(post.suggested_time.split(":")[0])
        return hour <= 11  // Morning content should post by 11:00
      }
      return true
    },
    error_message: (post) => `Morning content "${post.title}" scheduled too late at ${post.suggested_time} (after 11:00)`,
    severity: "warning",  // Warning not error (could be intentional)
    auto_fix: (post, context) => {
      return { ...post, suggested_time: "08:00" }
    }
  },
  
  // Rule 3: Brunch timing and day
  {
    name: "brunch_timing_and_day",
    check: (post, context) => {
      const brunch_keywords = ["brunch"]
      const title_lower = post.title.toLowerCase()
      const has_brunch = brunch_keywords.some(kw => title_lower.includes(kw))
      
      if (has_brunch) {
        const day = post.suggested_day
        const hour = parseInt(post.suggested_time.split(":")[0])
        
        const is_weekend = ["Saturday", "Sunday"].includes(day)
        const is_morning = hour >= 7 && hour <= 11
        
        return is_weekend && is_morning
      }
      return true
    },
    error_message: (post) => `Brunch content "${post.title}" must be on weekend mornings (Sat-Sun 07:00-11:00), not ${post.suggested_day} ${post.suggested_time}`,
    severity: "error",
    auto_fix: (post, context) => {
      // Move to Saturday 09:00
      return { ...post, suggested_day: "Saturday", suggested_time: "09:00" }
    }
  },
  
  // Rule 4: Rationale-execution coherence
  {
    name: "rationale_execution_coherence",
    check: (post, context) => {
      const rationale_lower = post.rationale.toLowerCase()
      
      // Check for "Friday-Saturday" mentions
      if (rationale_lower.includes("friday") && rationale_lower.includes("saturday")) {
        const day_index = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].indexOf(post.suggested_day)
        const friday_index = 4
        const saturday_index = 5
        
        // Post must be on or before Saturday to drive Friday-Saturday visits
        return day_index <= saturday_index
      }
      
      // Check for "weekend" mentions
      if (rationale_lower.includes("weekend")) {
        const day = post.suggested_day
        const weekend_promo_days = ["Wednesday", "Thursday", "Friday", "Saturday"]
        return weekend_promo_days.includes(day)
      }
      
      // Check for "evening" mentions with timing
      if (rationale_lower.includes("evening") || rationale_lower.includes("aften")) {
        const hour = parseInt(post.suggested_time.split(":")[0])
        return hour >= 14
      }
      
      return true
    },
    error_message: (post) => `Rationale mentions timing that doesn't match schedule: "${post.rationale.substring(0, 100)}..." scheduled ${post.suggested_day} ${post.suggested_time}`,
    severity: "error",
    auto_fix: null  // Can't auto-fix rationale mismatch, needs regeneration
  },
  
  // Rule 5: Goal-content alignment
  {
    name: "goal_content_alignment",
    check: (post, context) => {
      if (post.goal_mode === "drive_footfall") {
        // Footfall posts need actionable timing
        const title_lower = post.title.toLowerCase()
        
        // If drinks/evening content, must be Thu-Sat afternoon
        if (title_lower.includes("drinks") || title_lower.includes("cocktails")) {
          const day = post.suggested_day
          const hour = parseInt(post.suggested_time.split(":")[0])
          const valid_days = ["Thursday", "Friday", "Saturday"]
          const valid_time = hour >= 14 && hour <= 18
          
          return valid_days.includes(day) && valid_time
        }
      }
      
      return true
    },
    error_message: (post) => `Footfall goal with drinks content requires Thu-Sat 14:00-18:00, not ${post.suggested_day} ${post.suggested_time}`,
    severity: "error",
    auto_fix: (post, context) => {
      // Move to Friday 14:00
      return { ...post, suggested_day: "Friday", suggested_time: "14:00" }
    }
  },
  
  // Rule 6: Event-timing logic
  {
    name: "event_timing_logic",
    check: (post, context) => {
      // If rationale mentions a specific event, check timing
      const events = context.week_context.events || []
      
      for (const event of events) {
        if (post.rationale.toLowerCase().includes(event.name.toLowerCase())) {
          const post_date = new Date(post.suggested_date)
          const event_date = new Date(event.date)
          
          // Post must be on or before event (can't promote after)
          if (post_date > event_date) {
            return false
          }
          
          // For footfall posts, should be 1-3 days before
          if (post.goal_mode === "drive_footfall") {
            const days_before = Math.floor((event_date.getTime() - post_date.getTime()) / (1000 * 60 * 60 * 24))
            return days_before >= 0 && days_before <= 3
          }
        }
      }
      
      return true
    },
    error_message: (post) => `Post mentions event but is scheduled after event date or too far in advance`,
    severity: "error",
    auto_fix: null  // Complex, needs regeneration
  },
  
  // Rule 7: Programme-archetype rule compliance
  {
    name: "programme_archetype_compliance",
    check: (post, context) => {
      const programme = context.programmes.find(p => p.name === post.programme_name)
      if (!programme || !programme.programme_archetype) {
        return true  // Skip if no archetype assigned
      }
      
      const archetype = ARCHETYPE_RULES[programme.programme_archetype]
      if (!archetype) {
        return true
      }
      
      // Determine content type from programme or post
      const content_type = determineContentType(programme, post)
      const rules = archetype.content_types[content_type]
      
      if (!rules) {
        return true
      }
      
      // Check day compliance
      const all_valid_days = [...(rules.primary_days || []), ...(rules.secondary_days || [])]
      if (all_valid_days.length > 0 && !all_valid_days.includes(post.suggested_day)) {
        return false
      }
      
      // Check time compliance
      const hour = post.suggested_time.substring(0, 5)  // "14:00"
      if (rules.optimal_times && !rules.optimal_times.includes(hour)) {
        return false
      }
      
      // Check avoid rules
      if (rules.avoid) {
        if (rules.avoid.days && rules.avoid.days.includes(post.suggested_day)) {
          return false
        }
        if (rules.avoid.times) {
          // Check if time falls in avoid range (e.g., "00:00-13:59")
          for (const avoid_range of rules.avoid.times) {
            if (isTimeInRange(post.suggested_time, avoid_range)) {
              return false
            }
          }
        }
      }
      
      return true
    },
    error_message: (post) => `Post violates archetype rules for programme "${post.programme_name}"`,
    severity: "error",
    auto_fix: null  // Complex, needs upstream Phase 2a fix
  }
]

// Validation execution
export function validateWeeklyPlan(
  posts: WeeklyPost[],
  context: ValidationContext
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const fixed_posts: WeeklyPost[] = []
  
  for (const post of posts) {
    for (const rule of VALIDATION_RULES) {
      const is_valid = rule.check(post, context)
      
      if (!is_valid) {
        const error_obj = {
          post_id: post.id,
          rule_name: rule.name,
          message: rule.error_message(post),
          severity: rule.severity
        }
        
        if (rule.severity === "error") {
          errors.push(error_obj)
          
          // Attempt auto-fix
          if (rule.auto_fix) {
            const fixed_post = rule.auto_fix(post, context)
            if (fixed_post) {
              fixed_posts.push(fixed_post)
              error_obj.auto_fixed = true
            }
          }
        } else {
          warnings.push(error_obj)
        }
      }
    }
  }
  
  return {
    is_valid: errors.length === 0,
    errors,
    warnings,
    fixed_posts
  }
}
```

---

### 1.5 Integration Points (Phase 1)

**Phase 1 (Strategic Brief Generation)**:

```typescript
// In phase1.ts, before generating strategic brief:

// 1. Load archetype rules for this business
const business_archetype = brand_profile.business_archetype || "casual_dining"
const country_code = brand_profile.country_code || "DK"
const archetype_rules = getArchetypeRules(business_archetype, country_code)

// 2. Include archetype rules in Phase 1 prompt context
const phase1_context = {
  ...existing_context,
  archetype_rules,  // Give AI awareness of timing constraints
  regional_culture: REGIONAL_ADJUSTMENTS[country_code]
}

// 3. Instruct AI to generate explicit timing_window based on archetype
// Example prompt addition:
`
For each strategic angle, you MUST specify timing_window based on these archetype rules:

${JSON.stringify(archetype_rules, null, 2)}

For example:
- If programme is drinks/cocktails, timing_window should be "Thu-Sat 14:00-18:00" (or later for nightlife)
- If programme is brunch, timing_window should be "Sat-Sun 07:00-11:00"
- If programme is lunch, timing_window should be "Tue-Fri 10:00-13:00"

DO NOT use vague timing_window like "any" or "midweek" unless archetype rules allow it.
`
```

**Phase 2a (Day Assignment)**:

```typescript
// In phase2a.ts, when assigning days to angles:

// 1. For each angle, load programme archetype rules
const programme = programmes.find(p => p.name === angle.programme_name)
const programme_archetype = programme?.programme_archetype || business_archetype
const content_type = determineContentType(programme, angle)
const rules = getContentTypeRules(programme_archetype, content_type, country_code)

// 2. Extract allowed days from rules
const allowed_days = [
  ...(rules.primary_days || []),
  ...(rules.secondary_days || [])
]

// 3. When picking day, filter to allowed days first
const candidate_days = available_days.filter(day => allowed_days.includes(day))

// 4. If no candidates (all allowed days taken), either:
//    - Use secondary_days
//    - Skip this post (week only gets 3 posts instead of 4)
//    - Regenerate Phase 1 with different programme

// 5. Validate day assignment against avoid rules
if (rules.avoid?.days?.includes(selected_day)) {
  // Reject, try next candidate
}
```

**Phase 2b (Time Determination)**:

```typescript
// In phase2b.ts, when determining post time:

// 1. Load archetype rules for this programme
const programme_archetype = programme?.programme_archetype || business_archetype
const content_type = determineContentType(programme, post)
const rules = getContentTypeRules(programme_archetype, content_type, country_code)

// 2. Enhanced timing cascade (4 priorities):
// Priority 1: timing_window from Phase 1 (should now be explicit)
// Priority 2: archetype optimal_times (filter to archetype-allowed times)
// Priority 3: promoted_moment (dinner/lunch/breakfast)
// Priority 4: goal_mode default

// 3. Validate time against avoid rules
if (rules.avoid?.times) {
  for (const avoid_range of rules.avoid.times) {
    if (isTimeInRange(selected_time, avoid_range)) {
      // Reject, try next time
    }
  }
}

// 4. Ensure time is in archetype optimal_times
if (rules.optimal_times && !rules.optimal_times.includes(selected_time)) {
  // Find nearest optimal_time
  selected_time = findNearestOptimalTime(selected_time, rules.optimal_times)
}
```

**Post-Generation Validation**:

```typescript
// In phase2/index.ts, after generating all posts:

import { validateWeeklyPlan } from "../validation/content-timing-validator"

// 1. Validate entire week plan
const validation_result = validateWeeklyPlan(posts, {
  week_context,
  programmes,
  brand_profile,
  archetype_rules
})

// 2. If validation fails:
if (!validation_result.is_valid) {
  console.log("Validation errors:", validation_result.errors)
  
  // 3. Attempt auto-fixes
  if (validation_result.fixed_posts.length > 0) {
    // Replace posts with fixed versions
    posts = applyFixes(posts, validation_result.fixed_posts)
    
    // Re-validate
    const revalidation = validateWeeklyPlan(posts, context)
    if (revalidation.is_valid) {
      console.log("Auto-fixes successful")
    }
  }
  
  // 4. If still invalid, regenerate problematic posts
  for (const error of validation_result.errors) {
    if (!error.auto_fixed) {
      // Regenerate this specific post with explicit constraints
      const new_post = await regeneratePost(
        error.post_id,
        {
          explicit_constraints: {
            allowed_days: rules.primary_days,
            allowed_times: rules.optimal_times,
            avoid_days: rules.avoid?.days,
            avoid_times: rules.avoid?.times
          }
        }
      )
      
      posts = replacePost(posts, error.post_id, new_post)
    }
  }
  
  // 5. Final validation
  const final_validation = validateWeeklyPlan(posts, context)
  if (!final_validation.is_valid) {
    // If still failing, skip this post
    console.error("Could not fix validation errors, removing post")
    posts = posts.filter(p => !final_validation.errors.some(e => e.post_id === p.id))
    
    // Notify owner
    await notifyOwner({
      type: "weekly_plan_validation_failure",
      message: `Week plan has ${posts.length} posts instead of 4 - one post violated timing rules and couldn't be fixed`,
      details: final_validation.errors
    })
  }
}

return posts
```

---

## Detailed Implementation: Phase 2 (Temporal Context)

### 2.1 Enhanced Week Context Analysis

**Modify**: `/supabase/functions/get-weekly-strategy/context-interpreters.ts`

**Add new function**:

```typescript
export function analyzeTemporalContext(
  week_context: WeekContext,
  brand_profile: BrandProfile
): TemporalContext {
  
  // 1. Determine season
  const month = week_context.start_date.getMonth() + 1  // 1-12
  const season = determineSeason(month, brand_profile.country_code)
  
  // 2. Identify events this week
  const events = week_context.events || []
  
  // 3. Analyze weather if available
  const weather = week_context.weather || {}
  const outdoor_suitability = determineOutdoorSuitability(weather, season, brand_profile.location)
  
  // 4. Determine special periods (Christmas season, summer season, etc.)
  const special_periods = identifySpecialPeriods(month, week_context.week_of_year)
  
  return {
    season,
    month,
    week_of_year: week_context.week_of_year,
    events,
    weather: {
      ...weather,
      outdoor_suitability
    },
    special_periods,
    is_holiday_week: events.some(e => e.commercial_weight >= 4),
    is_outdoor_season: season === "spring" || season === "summer" || outdoor_suitability === "good"
  }
}

function determineSeason(month: number, country_code: string): Season {
  // Northern hemisphere (DK, UK, US, etc.)
  if (["DK", "SE", "NO", "FI", "UK", "US", "CA", "DE", "FR"].includes(country_code)) {
    if (month >= 3 && month <= 5) return "spring"
    if (month >= 6 && month <= 8) return "summer"
    if (month >= 9 && month <= 11) return "fall"
    return "winter"
  }
  
  // Southern hemisphere (AU, NZ, ZA, etc.)
  if (["AU", "NZ", "ZA"].includes(country_code)) {
    if (month >= 9 && month <= 11) return "spring"
    if (month >= 12 || month <= 2) return "summer"
    if (month >= 3 && month <= 5) return "fall"
    return "winter"
  }
  
  // Tropical (no real seasons, but wet/dry)
  if (["TH", "VN", "ID", "MY"].includes(country_code)) {
    // Simplified: just use hot/cool
    if (month >= 11 || month <= 2) return "cool_season"
    return "hot_season"
  }
  
  // Default northern hemisphere
  if (month >= 3 && month <= 5) return "spring"
  if (month >= 6 && month <= 8) return "summer"
  if (month >= 9 && month <= 11) return "fall"
  return "winter"
}

function determineOutdoorSuitability(
  weather: Weather,
  season: Season,
  location: string
): OutdoorSuitability {
  // If no weather data, infer from season
  if (!weather.average_temp) {
    if (season === "summer" || season === "spring") return "good"
    if (season === "fall") return "moderate"
    return "poor"
  }
  
  const temp = weather.average_temp
  const conditions = weather.conditions
  
  // Temperature-based
  if (temp >= 15 && temp <= 25) {
    if (conditions === "sunny" || conditions === "partly_cloudy") return "excellent"
    if (conditions === "cloudy") return "good"
    return "moderate"
  }
  
  if (temp >= 10 && temp < 15) {
    if (conditions === "sunny") return "good"
    return "moderate"
  }
  
  if (temp < 10 || temp > 30) {
    return "poor"
  }
  
  return "moderate"
}

function identifySpecialPeriods(month: number, week_of_year: number): string[] {
  const periods: string[] = []
  
  // Christmas season (December)
  if (month === 12) {
    periods.push("christmas_season")
  }
  
  // Summer season (June-August for northern hemisphere)
  if (month >= 6 && month <= 8) {
    periods.push("summer_season")
  }
  
  // Outdoor season start (April-May for northern hemisphere)
  if (month === 4 || month === 5) {
    periods.push("outdoor_season_start")
  }
  
  // Outdoor season active (May-September)
  if (month >= 5 && month <= 9) {
    periods.push("outdoor_season_active")
  }
  
  // New Year resolution period (January-February)
  if (month === 1 || month === 2) {
    periods.push("new_year_health")
  }
  
  // Back to school (August-September)
  if (month === 8 || (month === 9 && week_of_year <= 36)) {
    periods.push("back_to_school")
  }
  
  return periods
}
```

---

### 2.2 Temporal Multiplier Calculation

**Add new function** to context-interpreters.ts:

```typescript
export function calculateTemporalRelevance(
  programme: Programme,
  temporal_context: TemporalContext
): number {
  // Default multiplier (neutral)
  let multiplier = 1.0
  
  const temp_rel = programme.temporal_relevance
  if (!temp_rel) {
    return multiplier  // No temporal data, return neutral
  }
  
  // Month match
  if (temp_rel.peak_months?.includes(temporal_context.month)) {
    multiplier += 0.3  // 30% boost
  }
  if (temp_rel.avoid_months?.includes(temporal_context.month)) {
    multiplier -= 0.3  // 30% penalty
  }
  
  // Season match
  if (temp_rel.peak_seasons) {
    for (const peak_season of temp_rel.peak_seasons) {
      if (peak_season === temporal_context.season) {
        multiplier += 0.2  // 20% boost
      }
      // Special: outdoor_season matches outdoor_season_active period
      if (peak_season === "outdoor_season" && temporal_context.special_periods.includes("outdoor_season_active")) {
        multiplier += 0.2
      }
    }
  }
  
  // Event affinity match
  if (temp_rel.event_affinity && temporal_context.events) {
    const matching_events = temporal_context.events.filter(event =>
      temp_rel.event_affinity.includes(event.name)
    )
    
    if (matching_events.length > 0) {
      // Boost based on highest commercial_weight event
      const max_weight = Math.max(...matching_events.map(e => e.commercial_weight || 3))
      multiplier += (max_weight / 5) * 0.5  // Up to 0.5 boost for weight 5 event
    }
  }
  
  // Weather boost (for outdoor-related programmes)
  if (temp_rel.peak_seasons?.includes("outdoor_season") || 
      temp_rel.peak_seasons?.includes("summer")) {
    if (temporal_context.weather.outdoor_suitability === "excellent") {
      multiplier += 0.3
    } else if (temporal_context.weather.outdoor_suitability === "good") {
      multiplier += 0.2
    } else if (temporal_context.weather.outdoor_suitability === "moderate") {
      multiplier += 0.1
    }
  }
  
  // Special period match
  if (temp_rel.event_affinity && temporal_context.special_periods) {
    const matching_periods = temporal_context.special_periods.filter(period =>
      temp_rel.event_affinity.includes(period)
    )
    if (matching_periods.length > 0) {
      multiplier += 0.2 * matching_periods.length  // 20% per matching period
    }
  }
  
  // Clamp multiplier to reasonable range (0.5 to 2.5)
  multiplier = Math.max(0.5, Math.min(2.5, multiplier))
  
  return multiplier
}
```

---

### 2.3 Context-Aware Programme Priority Scoring

**Modify existing function** in context-interpreters.ts:

```typescript
// OLD (Phase 1 - no temporal awareness):
export function calculateProgrammePriorities(
  programmes: Programme[],
  recent_posts: RecentPost[]
): Programme[] {
  programmes.forEach(programme => {
    const recency_score = calculateRecencyScore(programme, recent_posts)
    const frequency_score = calculateFrequencyScore(programme, recent_posts)
    const revenue_score = programme.revenue_weight || 0
    
    programme.priority_score = recency_score + frequency_score + revenue_score
  })
  
  return programmes.sort((a, b) => b.priority_score - a.priority_score)
}

// NEW (Phase 2 - temporal awareness):
export function calculateProgrammePriorities(
  programmes: Programme[],
  recent_posts: RecentPost[],
  temporal_context: TemporalContext  // NEW parameter
): Programme[] {
  programmes.forEach(programme => {
    // Base scoring (existing logic)
    const recency_score = calculateRecencyScore(programme, recent_posts)  // 0-50
    const frequency_score = calculateFrequencyScore(programme, recent_posts)  // 0-30
    const revenue_score = programme.revenue_weight || 0  // 0-20
    
    const base_score = recency_score + frequency_score + revenue_score  // 0-100
    
    // NEW: Temporal multiplier
    const temporal_multiplier = calculateTemporalRelevance(programme, temporal_context)
    
    // Final score = base × multiplier
    programme.priority_score = base_score * temporal_multiplier
    
    // Store components for debugging/transparency
    programme.scoring_breakdown = {
      recency: recency_score,
      frequency: frequency_score,
      revenue: revenue_score,
      base_total: base_score,
      temporal_multiplier: temporal_multiplier,
      final_score: programme.priority_score
    }
  })
  
  return programmes.sort((a, b) => b.priority_score - a.priority_score)
}
```

---

### 2.4 AI-Generated Temporal Relevance (Onboarding)

**When creating Business Profile and programmes**:

**Add AI step** in business profile creation flow:

```typescript
// For each programme, generate temporal_relevance
async function generateProgrammeTemporalRelevance(
  programme: Programme,
  brand_profile: BrandProfile
): Promise<TemporalRelevance> {
  
  const prompt = `
You are analyzing a restaurant programme to determine its temporal relevance.

Business context:
- Name: ${brand_profile.business_name}
- Type: ${brand_profile.business_archetype || "casual_dining"}
- Location: ${brand_profile.location}
- Country: ${brand_profile.country_code}
- Opening hours: ${JSON.stringify(brand_profile.opening_hours)}
- Description: ${brand_profile.business_description}

Programme:
- Name: ${programme.name}
- Description: ${programme.description || ""}
- Category: ${programme.category}

Based on this, determine:

1. peak_days: Which days of the week is this programme most relevant for customers?
   Options: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
   Example: Weekend brunch = [Saturday, Sunday], Weekday lunch = [Monday, Tuesday, Wednesday, Thursday, Friday]

2. peak_times: What hours do customers typically visit for this programme? (format: HH:00)
   Example: Brunch = [09:00, 10:00, 11:00, 12:00], Evening drinks = [17:00, 18:00, 19:00, 20:00, 21:00, 22:00]

3. peak_months: Which months of the year is this programme most relevant? (1-12)
   Example: Outdoor cocktails = [5, 6, 7, 8, 9], Holiday menu = [12]

4. avoid_months: Which months is this programme LESS relevant? (1-12)
   Example: Outdoor seating in cold climate = [1, 2, 12], Heavy comfort food in summer = [6, 7, 8]

5. peak_seasons: Which seasons emphasize this programme?
   Options: spring, summer, fall, winter, outdoor_season
   Example: Outdoor cocktails = [spring, summer, outdoor_season]

6. event_affinity: Which events/periods does this programme align with?
   Options: mothers_day, fathers_day, valentines_day, easter, christmas_season, new_years_eve, 
           outdoor_season_start, outdoor_season_active, summer_season, new_year_health, 
           school_holidays, birthday_season, halloween, summer_festival, music_events
   Example: Brunch = [mothers_day, fathers_day, easter], Cocktails = [outdoor_season_active, summer_festival]

7. revenue_weight: What percentage of annual revenue does this programme drive? (0-100)
   Estimate based on programme importance to the business.

Return JSON only, no explanation:
{
  "peak_days": [...],
  "peak_times": [...],
  "peak_months": [...],
  "avoid_months": [...],
  "peak_seasons": [...],
  "event_affinity": [...],
  "revenue_weight": number,
  "rationale": "Brief explanation why these patterns make sense"
}
`

  const response = await callAI({
    model: "gpt-4o-mini",  // Cheap model OK for this structured task
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" }
  })
  
  return JSON.parse(response.content)
}

// Execute for all programmes during onboarding
async function enrichProgrammesWithTemporalRelevance(
  programmes: Programme[],
  brand_profile: BrandProfile
): Promise<Programme[]> {
  
  for (const programme of programmes) {
    if (!programme.temporal_relevance || Object.keys(programme.temporal_relevance).length === 0) {
      console.log(`Generating temporal relevance for programme: ${programme.name}`)
      
      const temporal_rel = await generateProgrammeTemporalRelevance(programme, brand_profile)
      
      // Update database
      await supabase
        .from("programmes")
        .update({
          temporal_relevance: temporal_rel,
          revenue_weight: temporal_rel.revenue_weight
        })
        .eq("id", programme.id)
      
      programme.temporal_relevance = temporal_rel
      programme.revenue_weight = temporal_rel.revenue_weight
    }
  }
  
  return programmes
}
```

**When to run**:
1. During business profile creation (new businesses)
2. When owner adds new programme
3. Batch job for existing businesses (migration)

---

## Detailed Implementation: Phase 3 (Hybrid Business Support)

### 3.1 Programme-Level Archetype Resolution

**Modify database query** to load programme archetype:

```typescript
// When loading programmes:
const programmes = await supabase
  .from("programmes")
  .select(`
    *,
    temporal_relevance,
    programme_archetype
  `)
  .eq("business_id", business_id)
  .eq("is_active", true)
```

**Archetype resolution logic**:

```typescript
function resolveArchetypeForProgramme(
  programme: Programme,
  brand_profile: BrandProfile
): string {
  // Priority 1: Programme-specific archetype (highest priority)
  if (programme.programme_archetype) {
    return programme.programme_archetype
  }
  
  // Priority 2: Infer from programme name/description keywords
  const inferred = inferArchetypeFromProgramme(programme, brand_profile)
  if (inferred) {
    return inferred
  }
  
  // Priority 3: Fall back to business-level archetype
  return brand_profile.business_archetype || "casual_dining"
}

function inferArchetypeFromProgramme(
  programme: Programme,
  brand_profile: BrandProfile
): string | null {
  const name_lower = programme.name.toLowerCase()
  const desc_lower = (programme.description || "").toLowerCase()
  const combined = `${name_lower} ${desc_lower}`
  
  // Brunch specialist patterns
  if (combined.match(/brunch|morgenmad/)) {
    return "brunch_specialist"
  }
  
  // Nightlife/bar patterns
  if (combined.match(/cocktails?|drinks?|wine bar|bar|nightlife|after.?dark/)) {
    // Check if business is open late (indicates nightlife vs casual drinks)
    const is_late_night = isBusinessOpenLate(brand_profile.opening_hours)
    if (is_late_night) {
      return "nightlife_bar"
    }
    // Otherwise use casual_dining (normal drinks timing)
    return "casual_dining"
  }
  
  // Family patterns
  if (combined.match(/kids|children|børne|family|familie/)) {
    return "family_casual"
  }
  
  // Fine dining patterns
  if (combined.match(/tasting menu|wine pairing|chef.?table|michelin|fine dining/)) {
    return "fine_dining"
  }
  
  // Bakery patterns
  if (combined.match(/pastries|croissant|bread|baked|bakery|bageri/)) {
    return "bakery_cafe"
  }
  
  return null  // No clear match, use business-level archetype
}

function isBusinessOpenLate(opening_hours: OpeningHours): boolean {
  // Check if business is open past midnight on any day
  const weekend_hours = opening_hours.Friday || opening_hours.Saturday || opening_hours.Sunday
  if (!weekend_hours) return false
  
  const close_time = weekend_hours.close
  if (!close_time) return false
  
  // Parse hour (e.g., "02:00" or "23:30")
  const hour = parseInt(close_time.split(":")[0])
  
  // If close time is 00:00-05:00, it's actually next day (late night)
  // OR if close time is 22:00+, consider it late
  return hour >= 22 || hour <= 5
}
```

---

### 3.2 AI Auto-Detection of Hybrid Businesses

**During business profile creation**:

```typescript
async function detectBusinessArchetype(
  brand_profile: BrandProfile
): Promise<string> {
  
  const prompt = `
Analyze this business and determine the best archetype classification.

Business:
- Name: ${brand_profile.business_name}
- Description: ${brand_profile.business_description}
- Opening hours: ${JSON.stringify(brand_profile.opening_hours)}
- Location: ${brand_profile.location}
- Service periods: ${brand_profile.service_periods.join(", ")}

Available archetypes:
1. casual_dining - Neighborhood restaurants, cafes, bistros (standard hours, lunch + dinner)
2. fine_dining - High-end restaurants, reservation-heavy (longer booking windows)
3. nightlife_bar - Cocktail bars, wine bars, nightclubs (late-night focus, Thu-Sun emphasis)
4. brunch_specialist - Weekend brunch focus (Sat-Sun mornings)
5. fast_casual - Quick service, high turnover (same-day decisions)
6. hotel_restaurant - Tourist-oriented (any-day flexibility)
7. bakery_cafe - Morning-focused, pastries, coffee
8. family_casual - Family-friendly (weekends, kids menus)
9. cafe_bar (hybrid) - Daytime cafe, evening bar (like Cafe Faust)
10. brunch_and_dinner (hybrid) - Weekend brunch + evening dinner (skip lunch)
11. coffee_and_wine (hybrid) - Morning coffee + evening wine

Rules:
- If business has multiple distinct modes (e.g., cafe by day, bar by night), choose hybrid
- If business emphasizes one service period (brunch, nightlife), choose specialist
- If business is standard restaurant with lunch + dinner, choose casual_dining
- Consider opening hours (late night = nightlife/bar, early morning = bakery/cafe)

Return JSON:
{
  "archetype": "archetype_name",
  "confidence": 0-100,
  "rationale": "Brief explanation",
  "is_hybrid": true/false
}
`

  const response = await callAI({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" }
  })
  
  const result = JSON.parse(response.content)
  return result.archetype
}
```

---

### 3.3 Hybrid Archetype Content Distribution

**For hybrid archetypes**, resolve content-type rules from multiple base archetypes:

```typescript
function getContentTypeRulesForHybrid(
  hybrid_archetype: string,
  content_type: string,
  country_code: string
): ContentTypeRules {
  
  const hybrid_template = HYBRID_ARCHETYPES[hybrid_archetype]
  if (!hybrid_template) {
    throw new Error(`Unknown hybrid archetype: ${hybrid_archetype}`)
  }
  
  // Get the base archetype for this content type
  const base_archetype = hybrid_template.content_distribution[content_type]
  if (!base_archetype) {
    // No specific rule for this content type, use first base archetype
    const fallback = hybrid_template.base_archetypes[0]
    return getContentTypeRules(fallback, content_type, country_code)
  }
  
  // Load rules from the mapped base archetype
  return getContentTypeRules(base_archetype, content_type, country_code)
}

// Example usage:
// Cafe Faust = "cafe_bar" hybrid
// content_type = "drinks"
// → HYBRID_ARCHETYPES.cafe_bar.content_distribution.drinks = "nightlife_bar"
// → Load nightlife_bar archetype rules for drinks
// → drinks: Thu-Sun 16:00-22:00 (later timing than casual_dining)
```

---

## Detailed Implementation: Phase 4 (Regional Expansion)

### 4.1 Regional Adjustment Application

**When loading archetype rules**, apply regional adjustments:

```typescript
function getArchetypeRules(
  archetype: string,
  country_code: string
): ArchetypeRules {
  // Load base archetype
  const base_rules = ARCHETYPE_RULES[archetype]
  if (!base_rules) {
    throw new Error(`Unknown archetype: ${archetype}`)
  }
  
  // Load regional adjustments
  const regional = REGIONAL_ADJUSTMENTS[country_code]
  if (!regional) {
    console.warn(`No regional adjustments for country: ${country_code}, using base rules`)
    return base_rules
  }
  
  // Deep merge: regional adjustments override base rules
  const adjusted_rules = deepMerge(base_rules, regional.archetype_adjustments[archetype] || {})
  
  return adjusted_rules
}

// Example:
// getArchetypeRules("casual_dining", "DK")
// → base: casual_dining.dinner.optimal_times = [14:00, 15:00, 16:00, 17:00, 18:00, 19:00]
// → regional DK adjustment: none specified
// → result: [14:00, 15:00, 16:00, 17:00, 18:00, 19:00]

// getArchetypeRules("casual_dining", "ES")
// → base: casual_dining.dinner.optimal_times = [14:00, 15:00, 16:00, 17:00, 18:00, 19:00]
// → regional ES adjustment: [17:00, 18:00, 19:00, 20:00, 21:00] (override)
// → result: [17:00, 18:00, 19:00, 20:00, 21:00]
```

---

### 4.2 Cuisine vs Audience Culture

**For ethnic restaurants serving local audiences**:

```typescript
function resolvePostingStrategy(brand_profile: BrandProfile): PostingStrategy {
  const cuisine_culture = brand_profile.cuisine_culture  // e.g., "spanish"
  const audience_culture = brand_profile.audience_culture || brand_profile.country_code  // e.g., "danish"
  
  // Default: post when AUDIENCE makes decisions (not when they eat)
  const primary_culture = audience_culture
  
  // Exception: if audience is explicitly expat/tourist community of the cuisine culture
  if (audience_culture === "expat" || audience_culture === cuisine_culture) {
    // Spanish restaurant serving Spanish expats → use Spanish timing
    return {
      primary_culture: cuisine_culture,
      posting_timezone: REGIONAL_ADJUSTMENTS[cuisine_culture].timezone,
      timing_windows: REGIONAL_ADJUSTMENTS[cuisine_culture].timing_shifts
    }
  }
  
  // Default: Spanish restaurant serving Danes → use Danish timing
  return {
    primary_culture: audience_culture,
    posting_timezone: REGIONAL_ADJUSTMENTS[audience_culture].timezone,
    timing_windows: REGIONAL_ADJUSTMENTS[audience_culture].timing_shifts
  }
}

// Example:
// Spanish tapas bar in Copenhagen serving Danes:
// - cuisine_culture: "spanish"
// - audience_culture: "danish" (or null → defaults to country_code "DK")
// - Result: Use Danish timing (post 14:00-19:00 for dinner, even though Spanish eat at 21:00)
// - Rationale: Danes make evening dining decisions 14:00-19:00, not 17:00-21:00

// Spanish restaurant in Copenhagen serving Spanish expats:
// - cuisine_culture: "spanish"
// - audience_culture: "expat" (or "spanish")
// - Result: Use Spanish timing (post 17:00-21:00 for dinner)
// - Rationale: Spanish expats make decisions later, aligned with home culture
```

---

## Testing Strategy

### Phase 1 Testing (Foundation)

**Unit Tests**:

1. **Archetype Rules Loading**:
   - Test: Load casual_dining archetype for DK
   - Expected: drinks = Thu-Sat 14:00-18:00
   - Test: Load nightlife_bar archetype for DK
   - Expected: drinks = Thu-Sun 16:00-22:00

2. **Regional Adjustments**:
   - Test: Load casual_dining for ES
   - Expected: dinner.optimal_times = [17:00-21:00] (later than DK)
   - Test: Load casual_dining for US
   - Expected: dinner.optimal_times = [13:00-17:00] (earlier than DK)

3. **Validation Rules**:
   - Test: Evening content at 9:00 AM
   - Expected: ValidationError "Evening content cannot be before 14:00"
   - Test: Brunch on Monday
   - Expected: ValidationError "Brunch must be weekends"
   - Test: Drinks post Sunday
   - Expected: ValidationError "Drinks posts must be Thu-Sat" (for casual_dining)

**Integration Tests**:

1. **End-to-End Week Generation**:
   - Test: Generate week for Cafe Faust (May 5-11, 2026)
   - Expected: No drinks posts on Sunday
   - Expected: Cocktails post on Thu-Sat between 16:00-20:00
   - Expected: Brunch post on Sat-Sun between 07:00-11:00

2. **Validation Catches Errors**:
   - Test: Inject bad post (Sunday 9:00 drinks) into plan
   - Expected: Validation rejects, auto-fixes to Friday 14:00

3. **Regional Differences**:
   - Test: Same business in DK vs ES
   - Expected: DK dinner posts 14:00-19:00, ES dinner posts 17:00-21:00

---

### Phase 2 Testing (Temporal Context)

**Unit Tests**:

1. **Season Determination**:
   - Test: Month 5 (May) in DK
   - Expected: season = "spring"
   - Test: Month 12 in AU (southern hemisphere)
   - Expected: season = "summer"

2. **Temporal Multiplier**:
   - Test: Cocktails programme, May week, outdoor season
   - Expected: multiplier ≥ 1.5 (peak months + outdoor season + weather boost)
   - Test: Same programme, November week
   - Expected: multiplier ≤ 0.8 (avoid months + indoor season)

3. **Programme Priority Scoring**:
   - Test: Cafe Faust programmes, May week
   - Expected: Cocktails score > Lunch score (temporal boost)
   - Test: Same business, November week
   - Expected: Lunch score > Cocktails score (temporal penalty reversal)

**Integration Tests**:

1. **Seasonal Content Mix**:
   - Test: Generate 4 weeks in May for Cafe Faust
   - Expected: 40-50% of posts are cocktails/outdoor content
   - Test: Generate 4 weeks in November
   - Expected: 40-50% of posts are lunch/dinner indoor content

2. **Event-Driven Emphasis**:
   - Test: Generate Mother's Day week
   - Expected: Brunch + børnemenu posts prioritized
   - Test: Generate Christmas week
   - Expected: Special menu + party content prioritized

---

### Phase 3 Testing (Hybrids)

**Unit Tests**:

1. **Programme Archetype Resolution**:
   - Test: Programme "Signature Cocktails" for late-night business
   - Expected: Resolves to nightlife_bar archetype
   - Test: Programme "Weekend Brunch"
   - Expected: Resolves to brunch_specialist archetype

2. **Hybrid Content Distribution**:
   - Test: Cafe_bar hybrid, content_type = "drinks"
   - Expected: Uses nightlife_bar rules (16:00-22:00)
   - Test: Cafe_bar hybrid, content_type = "lunch"
   - Expected: Uses casual_dining rules (10:00-13:00)

**Integration Tests**:

1. **Cafe Faust Week Generation**:
   - Test: Generate week with mixed programmes
   - Expected: Cocktails use nightlife timing, lunch uses casual timing, brunch uses weekend timing
   - Expected: No single archetype dominates (proper hybrid behavior)

---

### Phase 4 Testing (Regional)

**Unit Tests**:

1. **Country-Specific Timing**:
   - Test: Casual dining dinner in DK
   - Expected: 18:00 dinner time, 14:00-19:00 posting
   - Test: Casual dining dinner in ES
   - Expected: 21:00 dinner time, 17:00-21:00 posting

2. **Cultural Pattern Recognition**:
   - Test: Sunday dining in DK
   - Expected: sunday_pattern = "low_evening_activity" → avoid Sunday dinner posts
   - Test: Sunday dining in CN
   - Expected: sunday_pattern = "strong_family_dinner" → allow Sunday dinner posts

**Integration Tests**:

1. **Multi-Country Business**:
   - Test: Same restaurant brand in DK and ES
   - Expected: Different timing for same content type
   - Expected: DK branch: dinner 14:00-19:00, ES branch: dinner 17:00-21:00

---

## Migration Strategy for Existing Businesses

### Step 1: Database Migration

```sql
-- Run schema changes (see Phase 1, section 1.1)
-- Add columns to programmes and brand_profile tables

-- Set defaults for existing data
UPDATE brand_profile SET business_archetype = 'casual_dining' WHERE business_archetype IS NULL;
UPDATE brand_profile SET country_code = 'DK' WHERE country_code IS NULL;  -- Adjust per deployment
UPDATE programmes SET temporal_relevance = '{}'::jsonb WHERE temporal_relevance IS NULL;
```

### Step 2: Backfill Temporal Relevance (Batch Job)

```typescript
// Run as one-time job
async function backfillTemporalRelevance() {
  const businesses = await supabase.from("brand_profile").select("*")
  
  for (const business of businesses) {
    console.log(`Processing business: ${business.business_name}`)
    
    const programmes = await supabase
      .from("programmes")
      .select("*")
      .eq("business_id", business.id)
    
    for (const programme of programmes) {
      if (!programme.temporal_relevance || Object.keys(programme.temporal_relevance).length === 0) {
        try {
          const temporal_rel = await generateProgrammeTemporalRelevance(programme, business)
          
          await supabase
            .from("programmes")
            .update({
              temporal_relevance: temporal_rel,
              revenue_weight: temporal_rel.revenue_weight,
              programme_archetype: inferArchetypeFromProgramme(programme, business)
            })
            .eq("id", programme.id)
          
          console.log(`  ✓ Updated programme: ${programme.name}`)
          
          // Rate limit (AI calls)
          await sleep(500)
        } catch (error) {
          console.error(`  ✗ Failed for programme: ${programme.name}`, error)
        }
      }
    }
  }
  
  console.log("Backfill complete")
}
```

### Step 3: Gradual Rollout

**Week 1**: Deploy Phase 1 (validation only)
- Validation runs but doesn't block (logs errors, doesn't regenerate)
- Monitor validation failure rate
- Expected: 10-20% of posts fail validation initially

**Week 2**: Enable auto-fixes
- Validation auto-fixes simple errors (time adjustments)
- Still doesn't block on complex errors
- Monitor auto-fix success rate

**Week 3**: Enable regeneration
- Validation triggers regeneration on complex errors
- Monitor regeneration success rate

**Week 4**: Full enforcement
- Validation blocks invalid posts (skips post if can't fix)
- System fully enforces content-timing rules

---

## Success Metrics

### Phase 1 Success Criteria

1. **Bug Elimination**: Zero instances of drinks posts before 14:00
2. **Validation Coverage**: 95%+ of posts pass validation without fixes
3. **Auto-Fix Rate**: 90%+ of validation errors auto-fixed
4. **Owner Complaints**: Zero complaints about "wrong timing" (vs current state)

### Phase 2 Success Criteria

1. **Seasonal Adaptation**: Cocktails posts increase 40%+ in May-September vs November-February
2. **Event Response**: Mother's Day week has 50%+ brunch/family content (vs 20% in normal weeks)
3. **Engagement Lift**: 15-25% increase in post engagement for seasonal-relevant content

### Phase 3 Success Criteria

1. **Hybrid Handling**: Cafe Faust-style businesses get correct timing for each programme type
2. **Archetype Distribution**: No single archetype dominates hybrid businesses (even 25% distribution)

### Phase 4 Success Criteria

1. **Regional Coverage**: 10+ countries supported with cultural timing differences
2. **Timing Accuracy**: Spanish restaurants post 2-3 hours later than Danish restaurants for dinner

---

## Risk Mitigation

### Risk 1: AI-Generated Temporal Relevance Is Wrong

**Mitigation**:
- Owner review UI: "Does this look right?"
- Default to conservative templates if AI confidence < 70%
- Manual override option for 100% of fields
- A/B test: AI-generated vs template-based for 4 weeks

### Risk 2: Validation Too Strict (Blocks Valid Posts)

**Mitigation**:
- Start with warnings only (log but don't block)
- Gradual rollout (auto-fix → regenerate → block)
- Owner override: "Post anyway" button
- Track false positive rate, adjust rules

### Risk 3: Temporal Multiplier Too Aggressive (Skews Content Mix)

**Mitigation**:
- Clamp multiplier to 0.5-2.5 range (max 2.5× boost or 0.5× penalty)
- Baseline A/B test: no multiplier vs multiplier for 4 weeks
- Monitor content diversity (ensure 3+ different programmes per month)

### Risk 4: Regional Adjustments Don't Match Real Culture

**Mitigation**:
- Start with 3-5 well-researched countries (DK, ES, UK, US, CN)
- Partner with local hospitality experts for validation
- Owner feedback: "Is this timing right for your country?"
- Iterate based on engagement data (which timings perform best)

---

## Summary: Implementation Timeline

| Phase | Duration | Effort | Priority | Impact |
|-------|----------|--------|----------|--------|
| **Phase 1: Foundation** | 2-3 weeks | High | CRITICAL | Fixes Sunday drinks bug, 90% coverage |
| **Phase 2: Temporal Context** | 1-2 weeks | Medium | High | Seasonal adaptation, event response |
| **Phase 3: Hybrid Support** | 1-2 weeks | Medium | High | Handles Cafe Faust-style businesses |
| **Phase 4: Regional Expansion** | 2 weeks | Medium | Medium | Global scaling |
| **Phase 5: Owner Control** | 2 weeks | Low | Low | Edge cases, trust building |
| **Phase 6: Continuous** | Ongoing | Low | Medium | Learning, improvement |

**Total: 8-11 weeks to full implementation**

**Minimum Viable Fix: Phase 1 only (2-3 weeks) solves 90% of problem**

---

## Next Steps

1. **Approve architecture** (this plan)
2. **Prioritize phases** (recommend: Phase 1 → Phase 3 → Phase 2 → Phase 4)
3. **Assign development resources**
4. **Create detailed task breakdown** for Phase 1
5. **Set up test environment** with Cafe Faust as primary test case
6. **Begin Phase 1 implementation**

The system will transform from "static archetypes producing nonsensical timing" to "dynamic, context-aware scheduling that adapts to business reality, seasons, events, and cultural differences" - all while maintaining zero owner configuration burden through AI automation.
