-- Create sample audience segments for Café Faust to test v2 function
-- Based on typical Danish café operation

INSERT INTO business_audience_profile (
  business_id,
  segments,
  audience_breadth,
  business_model_type,
  created_at,
  updated_at
)
VALUES (
  'f4679fa9-3120-4a59-9506-d059b010c34a', -- Café Faust
  '[
    {
      "name": "Morning Coffee Rush",
      "program": "breakfast",
      "timing": {
        "days": [1, 2, 3, 4, 5],
        "startHour": 7,
        "endHour": 10
      },
      "priority": "primary",
      "motivation": "Quick caffeine fix before work",
      "decision": "convenience-first",
      "goal": "Get energized and get going",
      "contentAngles": [
        "Your morning ritual, perfected",
        "First coffee, best coffee",
        "Start strong with fresh brew",
        "Wake up with us"
      ],
      "requiresKitchen": false,
      "minLeadTime": 15,
      "maxActiveTime": 30
    },
    {
      "name": "Leisurely Brunch Crowd",
      "program": "brunch",
      "timing": {
        "days": [0, 6],
        "startHour": 10,
        "endHour": 14
      },
      "priority": "primary",
      "motivation": "Slow weekend morning, quality time",
      "decision": "experience-focused",
      "goal": "Relax and enjoy special breakfast",
      "contentAngles": [
        "Weekend vibes done right",
        "Brunch is a mood",
        "Slow mornings, good company",
        "This is what weekends are for"
      ],
      "requiresKitchen": true,
      "minLeadTime": 30,
      "maxActiveTime": 60
    },
    {
      "name": "Afternoon Work & Study",
      "program": "cafe",
      "timing": {
        "days": [1, 2, 3, 4, 5],
        "startHour": 14,
        "endHour": 17
      },
      "priority": "secondary",
      "motivation": "Focus time, productive environment",
      "decision": "atmosphere-focused",
      "goal": "Get work done in pleasant space",
      "contentAngles": [
        "Your workspace away from home",
        "Focus fuel: coffee + calm",
        "Productive vibes",
        "Work better here"
      ],
      "requiresKitchen": false,
      "minLeadTime": 20,
      "maxActiveTime": 45
    },
    {
      "name": "Evening Social",
      "program": "bar",
      "timing": {
        "days": [4, 5, 6],
        "startHour": 17,
        "endHour": 22
      },
      "priority": "primary",
      "motivation": "Unwind with friends, casual drinks",
      "decision": "social-driven",
      "goal": "Relax and socialize in cozy atmosphere",
      "contentAngles": [
        "End your day the right way",
        "Cheers to good times",
        "Evening drinks, easy vibes",
        "Your local after-work spot"
      ],
      "requiresKitchen": false,
      "minLeadTime": 30,
      "maxActiveTime": 60
    }
  ]'::jsonb,
  'moderate',
  'hybrid_cafe_bar',
  NOW(),
  NOW()
)
ON CONFLICT (business_id) 
DO UPDATE SET
  segments = EXCLUDED.segments,
  audience_breadth = EXCLUDED.audience_breadth,
  business_model_type = EXCLUDED.business_model_type,
  updated_at = NOW();

-- Verify insertion
SELECT 
  business_id,
  audience_breadth,
  business_model_type,
  jsonb_array_length(segments) as segment_count,
  segments
FROM business_audience_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
