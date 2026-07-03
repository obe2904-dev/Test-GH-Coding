# Brand Profile V5 Database Mapping

**Entry point:** `brand-profile-generator-v5`  
**Used from:** `http://localhost:3000/dashboard/brand`  
**Frontend flow:** `menu-overview-summary` first, then `brand-profile-generator-v5`

## Overview

This document maps every database table and field touched by the V5 brand profile flow, including the exact JSON / array / scalar shape that is populated by the prompt-driven generator.

## Tables Written By The Flow

### 1. `business_brand_profile`

This is the main persistence table for the brand profile experience.

#### Written by `menu-overview-summary`

`menu_overview_summary`:

```json
{
  "cross_menu_summary": "string",
  "gastronomic_profile": "string | null",
  "total_items": 0,
  "total_menus": 0,
  "overall_avg_price": 0,
  "menu_breakdown": [
    {
      "service_period": "string",
      "item_count": 0,
      "avg_price": 0,
      "ai_summary": "string"
    }
  ],
  "signature_themes": ["string"],
  "generated_at": "ISO timestamp"
}
```

Fallback shapes:
- No menus found: `menu_overview_summary = null`
- Single menu only: same object shape, but `is_single_menu: true` is included in the generated object before save

`gastronomic_profile`:
- `string | null`

`signature_themes`:
- `string[]`

#### Written by `brand-profile-generator-v5`

Top-level columns written on the final upsert:

- `business_archetype`: `string`
- `brand_profile_v5`: `JSONB`
- `brand_profile_v5_generated_at`: `ISO timestamp`
- `brand_profile_v5_version`: `string`
- `enhanced_social_examples`: `JSONB array`
- `enhanced_avoid_examples`: `JSONB array`
- `social_writing_examples`: `JSONB array`
- `voice_guardrails`: `JSONB object`
- `business_identity_persona`: `string | null`
- `strategic_audience_segments`: `JSONB object | null`
- `content_strategy`: `JSONB object | null`
- `business_character`: `string | null`
- `tone_of_voice`: `null`
- `updated_at`: `ISO timestamp`
- `created_at`: `ISO timestamp`

## `brand_profile_v5` JSON Shape

The `brand_profile_v5` column is a single JSONB source of truth for V5.

```json
{
  "version": "string",
  "generated_at": "ISO timestamp",
  "generation_metadata": {
    "request_id": "string",
    "duration_ms": 0,
    "ai_models_used": {
      "layer_2": "gpt-4o-mini",
      "layer_3": "gpt-4o",
      "layer_4": "gpt-4o-mini",
      "layer_5": "gpt-4o"
    }
  },
  "layer_0_intelligence": {
    "business_type": {
      "detected_type": "string",
      "professional_domain": "string",
      "confidence": 0,
      "reasoning": "string"
    },
    "business_identity": {
      "system_persona": "string",
      "metadata": {}
    },
    "menu_overview": {
      "cross_menu_summary": "string",
      "total_items": 0,
      "total_menus": 0,
      "overall_avg_price": 0,
      "menu_breakdown": [],
      "signature_themes": [],
      "generated_at": "ISO timestamp"
    } | null,
    "city_context_ai": {
      "city": "string",
      "country": "string",
      "population": 0,
      "city_size": "string",
      "cultural_context": "string",
      "tone": "string",
      "characteristics": ["string"],
      "cached_until": "ISO timestamp",
      "ai_generated": true
    } | null,
    "geographic_context": {
      "postal_code": "string | null",
      "city": "string",
      "population_size": "string",
      "population": 0,
      "location_type": "string",
      "signature_reference": "string | null",
      "city_profile_description": {
        "tone_guidance": "string",
        "cultural_context": "string",
        "competition_level": "string",
        "characteristics": ["string"]
      },
      "location_advantages": ["string"],
      "narrative": "string"
    },
    "professional_persona": {
      "expertise_areas": ["string"],
      "content_focus": ["string"],
      "formality": "string",
      "sentence_style": "string",
      "emoji_usage": "string",
      "system_prompt_preview": "string"
    },
    "voice_archetype": {
      "archetype_id": "string",
      "base_rules": ["string"],
      "base_rules_count": 0,
      "formality_level": "string",
      "sentence_structure": "string",
      "location_context_weight": "string",
      "content_priorities": ["string"]
    }
  },
  "layer_1_programmes": [
    {
      "type": "string",
      "name": "string",
      "timeWindow": {
        "start": "HH:MM",
        "end": "HH:MM"
      },
      "daysOfWeek": ["string"],
      "confidence": "high | medium | low",
      "menuEvidence": ["string"],
      "commercialOrientation": {
        "decision_timing": "impulse | planned | mixed",
        "baseline_goal_split": {
          "drive_footfall": 0,
          "strengthen_brand": 0,
          "retain_regulars": 0
        },
        "content_type_affinity": {
          "product_showcase": 0,
          "experience_story": 0,
          "values_mission": 0
        },
        "reasoning": "string"
      },
      "audienceSegments": [
        {
          "segment_name": "string",
          "motivation": "string",
          "timing_preference": "string",
          "content_angle": "string",
          "confidence": 0
        }
      ]
    }
  ],
  "voice": {
    "tone_dna": {
      "recommended_tone": {
        "strategic_analysis": "string",
        "tone_positioning": "string",
        "confidence": 0,
        "key_factors": ["string"]
      },
      "location_driver": {
        "primary_dimension": "string",
        "score": 0,
        "strategic_importance": "critical | important | moderate",
        "tone_implications": ["string"],
        "natural_vocabulary": ["string"],
        "avoid_vocabulary": ["string"]
      },
      "culinary_character": {
        "price_positioning": "budget | value | moderate | upscale | premium",
        "culinary_identity": "string",
        "signature_themes": ["string"],
        "fusion_patterns": ["string"],
        "craft_signals": ["string"],
        "tone_implications": ["string"],
        "natural_vocabulary": ["string"],
        "formality_requirement": "string"
      },
      "owner_voice": {
        "register_level": "casual | professional | formal",
        "style_observations": ["string"],
        "sentence_structure": "string",
        "tone_implications": ["string"],
        "authenticity_note": "string"
      },
      "market_context": {
        "country": "string",
        "cultural_norms": ["string"],
        "competition_level": "low | medium | high | very_high",
        "demographic_signals": {
          "primary_demographic": "string | null",
          "score": 0,
          "tone_implications": ["string"]
        },
        "market_maturity": "string",
        "strategic_positioning_need": "string"
      },
      "strategic_summary": "string",
      "tone_do_list": ["string"],
      "tone_dont_list": ["string"],
      "generated_at": "ISO timestamp",
      "confidence_score": 0,
      "expert_reasoning": "string"
    },
    "enhanced_social_examples": [
      {
        "text": "string",
        "why_it_works": ["string"],
        "tone_elements_demonstrated": ["string"],
        "content_type": "string",
        "platform_fit": ["string"]
      }
    ],
    "enhanced_avoid_examples": [
      {
        "text": "string",
        "why_it_fails": ["string"],
        "violates_dna_elements": ["string"],
        "better_alternative": "string"
      }
    ],
    "tone_rules": ["string"],
    "structural_rules": ["string"],
    "style_rules": ["string"],
    "personality_traits": ["string"],
    "formality_level": "informal | semi-formal | formal",
    "humor_style": "dry | playful | professional | none",
    "humor_level": "none | subtle | moderate | high",
    "sentence_structure": "short_declarative | conversational | formal | varied",
    "emoji_level": "none | minimal | moderate | expressive",
    "emoji_reasoning": "string",
    "content_anchors": ["string"],
    "menu_description_examples": ["string"],
    "social_writing_examples": ["string"],
    "menu_description_metadata": {
      "origin_mention_frequency": "never | selective | frequent | always",
      "origin_mention_reasoning": "string",
      "variation_enforced": true,
      "detected_origin_keywords": ["string"]
    },
    "avoid_examples": ["string"],
    "register_guidance": "string",
    "voice_confidence": 0,
    "voice_reasoning": "string",
    "enforcement_level": "strict | moderate | flexible",
    "sentence_length_max": 0
  },
  "writing_examples": {
    "typical_openings": ["string"],
    "typical_closings": ["string"],
    "signature_phrases": ["string"],
    "do_say_examples": ["string"],
    "prefer_vocabulary": ["string"],
    "avoid_vocabulary": ["string"],
    "good_examples": ["string"],
    "bad_examples": ["string"]
  },
  "guardrails": {
    "never_say": ["string"],
    "content_exclusions": ["string"],
    "factual_constraints": ["string"],
    "seasonal_notes": ["string"],
    "avoid_patterns": {
      "strip_from_output": {
        "brochure_language": ["string"],
        "superlatives": ["string"],
        "generic_marketing": ["string"],
        "ai_tells": ["string"],
        "formulaic_wallpaper": ["string"]
      },
      "generation_constraints": {
        "compound_sentences": ["string"]
      }
    },
    "wallpaper_avoidance": {
      "max_origin_mentions_percentage": 0,
      "required_variation_patterns": ["string"],
      "forbidden_repetitions": ["string"]
    },
    "length_limits": {
      "instagram": { "sentences": "string", "characters": "string" },
      "facebook": { "sentences": "string", "characters": "string" },
      "google": { "sentences": "string", "characters": "string" },
      "story": { "sentences": "string", "characters": "string" }
    }
  },
  "audience_classification": {
    "business_model": "offer_led | occasion_led | destination_led | audience_led",
    "primary_hook": "product | location | programme | identity",
    "audience_breadth": "narrow | mixed | broad",
    "classification_reasoning": "string"
  }
}
```

## Tables Read By The Generator

### `businesses`

Read for business identity and location context:
- `id`
- `name`
- `category`
- `business_category`
- `establishment_type`
- `price_level`
- `country`
- `primary_language`
- `address`
- `local_location_reference`

### `business_profile`

Read for legacy about text:
- `long_description`

### `menu_results_v2`

Read twice by the generator:

First pass for programme detection and menu parsing:
- `id`
- `business_id`
- `ai_summary`
- `structured_data`
- `service_periods`
- `service_period_name`
- `completed_at`
- `source_url`
- `status`
- `language_code`
- `representative_dishes`

Second pass for representative menu items:
- `representative_dishes`
- `language_code`
- `service_period_name`

### `business_location_intelligence`

Read for geographic and demographic context:
- `neighborhood`
- `neighborhood_character`
- `area_type`
- `category_scores`
- `location_marketing_hooks`
- `location_type_matches`
- `tourist_context`
- `landmarks`
- `local_location_reference`

### `business_operations`

Read for operations context:
- `kitchen_close_time`
- `reservation_required`
- `accepts_walkins`
- `has_outdoor_seating`
- `has_kids_menu`
- `has_takeaway`
- `has_delivery`
- `has_wifi`

### `opening_hours`

Read for temporal programme inference:
- `weekday`
- `open_time`
- `close_time`

### `business_brand_profile` existing row

Read as legacy fallback and migration source:
- `tone_of_voice`
- `tone_keywords`
- `tone_model`
- `typical_openings`
- `things_to_avoid`
- `voice_constraints`
- `target_audience`
- `communication_goal`
- `emotional_promise`
- `brand_context`
- `recognizable_interior_identity`
- `visual_character`
- `venue_scene`
- `humor_level`
- `menu_overview_summary`
- `gastronomic_profile`
- `signature_themes`
- `strategic_audience_segments`
- `business_character`

## Tables Written But Not Owned By This Generator

These are used as inputs and may be written by other flows, but V5 depends on them:

- `menu_results_v2`
- `business_profile`
- `business_location_intelligence`
- `business_operations`
- `opening_hours`

## Frontend Data Flow

1. `/dashboard/brand` loads `business_brand_profile` and `business_programme_profiles`.
2. The regenerate button calls `menu-overview-summary`.
3. That function writes `business_brand_profile.menu_overview_summary`, `gastronomic_profile`, and `signature_themes`.
4. The frontend then calls `brand-profile-generator-v5` with `businessId`, `forceRegenerate`, and the freshly generated `menuOverviewSummary`.
5. The generator writes `business_programme_profiles` and then the final V5 payload into `business_brand_profile`.

## Important Notes

- `tone_of_voice` is explicitly nulled in the V5 save path.
- `business_character` is still written for backward compatibility, but V5 text generation prefers `business_identity_persona`.
- `menu_overview_summary`, `gastronomic_profile`, and `signature_themes` are owned by `menu-overview-summary`, not by `brand-profile-generator-v5`.
- The V5 JSONB payload is the primary source of truth for the new brand profile experience.
