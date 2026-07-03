-- Revenue Drivers Schema for Brand Profile V5
-- Date: 2026-06-08
-- Purpose: Enable business-first day allocation in Weekly Plan

-- ============================================================================
-- SCHEMA DESIGN: revenue_drivers JSONB structure
-- ============================================================================

/*
Structure:
{
  "primary": {
    "moment": "weekend_dinner",
    "description": "Friday-Saturday evening dining (19:00-22:00)",
    "days": ["Friday", "Saturday"],
    "service_periods": ["dinner"],
    "decision_window": {
      "type": "advance_booking",
      "starts": "Thursday 14:00",
      "ends": "Friday 17:00",
      "peak_hours": ["Thursday 16:00-18:00", "Friday 10:00-13:00"]
    },
    "post_timing": {
      "recommended_posts": [
        { "day": "Thursday", "time": "14:00", "angle": "weekend_preview" },
        { "day": "Friday", "time": "14:00", "angle": "tonight_reminder" }
      ],
      "minimum_posts": 1,
      "maximum_posts": 2
    },
    "commercial_weight": 0.45
  },
  "secondary": { ... },
  "tertiary": { ... },
  "normal_week_strategy": { ... }
}
*/

-- ============================================================================
-- MIGRATION: Add revenue_drivers to Cafe Faust
-- ============================================================================

-- Add revenue_drivers to brand_profile_v5 JSONB column in business_brand_profile table
UPDATE business_brand_profile
SET brand_profile_v5 = jsonb_set(
  COALESCE(brand_profile_v5, '{}'::jsonb),
  '{revenue_drivers}',
  '{
  "primary": {
    "moment": "weekend_dinner",
    "description": "Friday-Saturday evening dining - main revenue driver",
    "days": ["Friday", "Saturday"],
    "service_periods": ["dinner"],
    "decision_window": {
      "type": "advance_booking",
      "starts": "Thursday 14:00",
      "ends": "Friday 17:00",
      "peak_hours": ["Thursday 16:00-18:00", "Friday 10:00-13:00"],
      "reasoning": "Weekend dinner bookings peak Thursday afternoon and Friday morning as guests plan their evening out"
    },
    "post_timing": {
      "recommended_posts": [
        {
          "day": "Thursday",
          "time": "14:00",
          "angle": "weekend_preview",
          "reasoning": "Catch Thursday afternoon booking surge for weekend dining"
        },
        {
          "day": "Friday",
          "time": "14:00",
          "angle": "tonight_reminder",
          "reasoning": "Last-minute Friday morning bookings for same-night dining"
        }
      ],
      "minimum_posts": 1,
      "maximum_posts": 2
    },
    "commercial_weight": 0.45,
    "revenue_share": "45% of weekly revenue from Friday-Saturday dinner service"
  },
  "secondary": {
    "moment": "weekday_lunch",
    "description": "Monday-Friday lunch service - consistent midday traffic",
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "service_periods": ["lunch"],
    "decision_window": {
      "type": "same_day",
      "starts": "Same day 08:00",
      "ends": "Same day 11:30",
      "peak_hours": ["09:30-10:30"],
      "reasoning": "Lunch decisions made morning-of (What should we eat today?)"
    },
    "post_timing": {
      "recommended_posts": [
        {
          "day": "Monday",
          "time": "09:00",
          "angle": "week_kickoff",
          "reasoning": "Monday morning post sets tone for weekday lunch presence"
        },
        {
          "day": "Wednesday",
          "time": "09:00",
          "angle": "midweek_break",
          "reasoning": "Midweek reminder maintains lunch visibility"
        }
      ],
      "minimum_posts": 1,
      "maximum_posts": 2
    },
    "commercial_weight": 0.30,
    "revenue_share": "30% of weekly revenue from weekday lunch covers"
  },
  "tertiary": {
    "moment": "weekend_brunch",
    "description": "Saturday-Sunday morning brunch - leisure dining",
    "days": ["Saturday", "Sunday"],
    "service_periods": ["brunch"],
    "decision_window": {
      "type": "same_day",
      "starts": "Same day 08:00",
      "ends": "Same day 10:00",
      "peak_hours": ["08:30-09:30"],
      "reasoning": "Brunch is spontaneous morning-of decision (Let us go out for brunch)"
    },
    "post_timing": {
      "recommended_posts": [
        {
          "day": "Saturday",
          "time": "08:00",
          "angle": "weekend_start",
          "reasoning": "Early Saturday post captures morning brunch planners"
        }
      ],
      "minimum_posts": 0,
      "maximum_posts": 1
    },
    "commercial_weight": 0.25,
    "revenue_share": "25% of weekly revenue from weekend brunch service"
  },
  "normal_week_strategy": {
    "description": "Default posting pattern for weeks without major events",
    "minimum_coverage": {
      "weekend_driver": 1,
      "weekday_presence": 1,
      "brand_builder": 1
    },
    "preferred_day_pattern": ["Monday", "Thursday", "Friday", "Saturday"],
    "reasoning": {
      "monday": "Brand presence and weekday lunch driver",
      "thursday": "Weekend dinner booking driver (catches Thu afternoon surge)",
      "friday": "Weekend dinner reminder + same-day bookings",
      "saturday": "Weekend brunch presence OR second brand builder"
    },
    "avoid_patterns": {
      "consecutive_days": 2,
      "weekend_gap": false,
      "front_loaded_week": true
    },
    "expected_distribution_4_posts": {
      "example": ["Monday 09:00", "Thursday 14:00", "Friday 14:00", "Saturday 08:00"],
      "coverage": "Brand builder (Mon) + Weekend dinner drivers (Thu-Fri) + Brunch (Sat)"
    }
  },
  "event_week_adjustments": {
    "description": "How to modify normal pattern when events occur",
    "same_day_holiday": {
      "strategy": "Day-of post + lead-up post",
      "example": "Grundlovsdag Friday: Wed brand + Thu drive + Fri day-of",
      "reasoning": "Same-day holidays need presence ON the day, not just before"
    },
    "advance_booking_holiday": {
      "strategy": "Lead-up posts 3-5 days before",
      "example": "Valentines: Mon + Wed + Thu lead-up posts",
      "reasoning": "Reservations happen days ahead, no need for day-of post"
    },
    "multi_day_period": {
      "strategy": "Span the period with posts",
      "example": "Easter weekend: Thu before + Sat during + Mon after",
      "reasoning": "Coverage across the extended period"
    }
  }
}'::jsonb,
  true -- create_if_missing = true
)
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================

-- Test 1: Verify revenue_drivers structure
SELECT 
  business_id,
  brand_profile_v5->'revenue_drivers'->'primary'->>'moment' as primary_moment,
  brand_profile_v5->'revenue_drivers'->'primary'->'post_timing'->'recommended_posts'->0->>'day' as primary_post_day,
  brand_profile_v5->'revenue_drivers'->'secondary'->>'moment' as secondary_moment,
  brand_profile_v5->'revenue_drivers'->'normal_week_strategy'->>'preferred_day_pattern' as preferred_days
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Test 2: Extract all recommended posting days
SELECT 
  jsonb_array_elements(
    brand_profile_v5->'revenue_drivers'->'primary'->'post_timing'->'recommended_posts'
  )->>'day' as recommended_day,
  jsonb_array_elements(
    brand_profile_v5->'revenue_drivers'->'primary'->'post_timing'->'recommended_posts'
  )->>'time' as recommended_time,
  jsonb_array_elements(
    brand_profile_v5->'revenue_drivers'->'primary'->'post_timing'->'recommended_posts'
  )->>'angle' as content_angle
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Test 3: Decision window types
SELECT 
  'primary' as driver,
  brand_profile_v5->'revenue_drivers'->'primary'->'decision_window'->>'type' as decision_type,
  brand_profile_v5->'revenue_drivers'->'primary'->'decision_window'->>'starts' as window_starts
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
UNION ALL
SELECT 
  'secondary',
  brand_profile_v5->'revenue_drivers'->'secondary'->'decision_window'->>'type',
  brand_profile_v5->'revenue_drivers'->'secondary'->'decision_window'->>'starts'
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
UNION ALL
SELECT 
  'tertiary',
  brand_profile_v5->'revenue_drivers'->'tertiary'->'decision_window'->>'type',
  brand_profile_v5->'revenue_drivers'->'tertiary'->'decision_window'->>'starts'
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================

/*
Test 1 Expected Output:
- primary_moment: "weekend_dinner"
- primary_post_day: "Thursday"
- secondary_moment: "weekday_lunch"
- preferred_days: '["Monday", "Thursday", "Friday", "Saturday"]'

Test 2 Expected Output:
- Thursday | 14:00 | weekend_preview
- Friday   | 14:00 | tonight_reminder

Test 3 Expected Output:
- primary   | advance_booking | Thursday 14:00
- secondary | same_day        | Same day 08:00
- tertiary  | same_day        | Same day 08:00
*/
