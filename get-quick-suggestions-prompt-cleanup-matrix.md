# Get Quick Suggestions Prompt Cleanup Matrix

Scope: `get-quick-suggestions` only. Database cleanup is out of scope.

Legend:
- `keep` = stays in the prompt flow as a live or compatibility input
- `remove` = remove from the prompt mapping because it is dead or missing in the live schema
- `derive` = not a primary source; generated from other fields or produced later in the flow
- `review` = still used, but null-heavy enough that it should not be treated as a primary signal

| Field | Decision | Why | Evidence / notes |
| --- | --- | --- | --- |
| `brand_profile_v5` | `derive` | Primary V5 wrapper, not a direct prompt field | Used as the main structured source and split into identity, voice, writing examples, and guardrails |
| `voice_guardrails` | `keep` | Live compatibility / prompt safety input | Used for `seasonal_notes` and `avoid_patterns` fallback chains |
| `business_identity_persona` | `keep` | Strong live prompt input | Preferred over legacy piecemeal assembly and includes strategic segments |
| `content_strategy` | `keep` | Live strategy signal | Used during legacy fallback assembly when persona is absent |
| `content_strategy_confirmed` | `keep` | Confirmation gate, not a content source | Used to decide whether legacy content strategy should be trusted |
| `tone_of_voice` | `keep` | Compatibility signal | Still present in the legacy select list and used as fallback context |
| `tone_keywords` | `keep` | Compatibility signal | Still present in the legacy select list and used in the broader brand context |
| `tone_model` | `keep` | Compatibility / derived structure | Still present in the legacy select list and used as a fallback structure |
| `things_to_avoid` | `keep` | Live compatibility input | Still feeds guardrail construction |
| `communication_goal` | `keep` | Fallback-only compatibility input | Used when the richer V5 programme objective path is empty |
| `identity_keywords` | `keep` | Live fallback input | Used for prompt enrichment when V5 category keywords are unavailable |
| `business_character` | `keep` | Live prompt anchor | Pulled into confirmed facts and tone/voice context |
| `target_audience` | `keep` | Fallback-only compatibility input | Used only after modern audience sources fail |
| `humor_level` | `keep` | Fallback-only legacy register | Used to modulate tone instructions when V5 humor style is missing |
| `voice_rationale` | `keep` | Live explanatory input | Used as a register guard for atmosphere / BTS ideas |
| `recognizable_interior_identity` | `keep` | Fallback-only interior context | Used only as interior / venue background context |
| `emotional_promise` | `remove` | Missing live-schema reference in the representative profile | Used only as a legacy fallback for a background-only line |
| `content_exclusions` | `remove` | Missing live-schema reference in the representative profile | No live column in `business_brand_profile` |
| `typical_openings` | `keep` | Writing-example compatibility input | Still used in downstream wording / examples |
| `location_intelligence` | `keep` | Live contextual input | Used for motivations and proximity context |
| `brand_context` | `remove` | Missing live-schema reference in the representative profile | Legacy differentiator fallback; no longer a primary live source |
| `posting_occasions` | `keep` | Live scheduling / context signal | Used as a contextual brand cue |
| `audience_segments` | `keep` | Live segmentation signal | Used for persona matching when available |
| `post_length_guidelines` | `remove` | Missing live-schema reference in the representative profile | No live column in `business_brand_profile` |
| `enhanced_social_examples` | `keep` | Live writing-example input | Present and non-empty in the representative business |
| `enhanced_avoid_examples` | `keep` | Live negative-example input | Present and non-empty in the representative business |
| `social_writing_examples` | `keep` | Fallback-only writing-example compatibility input | Present, but empty array in the representative business |
| `visual_character` | `remove` | Missing live-schema reference in the representative profile | Queried in a separate photo-analysis read that is caught and ignored on failure |
| `venue_scene` | `remove` | Missing live-schema reference in the representative profile | Queried in the same photo-analysis read as `visual_character` |
| `venue_energy` | `keep` | Live atmosphere input | Used with `venue_scene` to form the atmosphere line |
| `guest_situation_type` | `keep` | Live situational input | Used to ground guest-moment framing |
| `brand_essence` | `keep` | Primary legacy identity signal | Still used as a brand anchor in the fallback assembly |
| `voice_guardrails.seasonal_notes` | `derive` | Generated downstream guardrail output | Applied later as seasonal context, not a direct DB input |
| `business_identity_persona` fallback pieces | `derive` | Generated from multiple sources | The persona path replaces piecemeal legacy assembly when present |

## Recommended cleanup order
1. Remove dead prompt references: `emotional_promise`, `brand_context`, `visual_character`, `venue_scene`. Completed in `supabase/functions/get-quick-suggestions/index.ts`.
2. Keep the null-but-present compatibility fields for now: `tone_of_voice`, `tone_keywords`, `tone_model`, `things_to_avoid`, `identity_keywords`, `voice_rationale`, `typical_openings`, `location_intelligence`, `posting_occasions`, `audience_segments`, `communication_goal`, `target_audience`, `humor_level`, `recognizable_interior_identity`, `social_writing_examples`.
3. Keep the populated example arrays for now: `enhanced_social_examples`, `enhanced_avoid_examples`.
4. Repeat the same exercise on the downstream prompt builder after this pass is stable.

## DB verification for item 2
- `tone_of_voice`, `tone_keywords`, `tone_model`, `things_to_avoid`, `identity_keywords`, `voice_rationale`, `typical_openings`, `location_intelligence`, `posting_occasions`, `audience_segments`: present in `business_brand_profile`, but null for the representative business.
- `enhanced_social_examples`, `enhanced_avoid_examples`: present and non-empty in the representative business.
- `social_writing_examples`: present but empty array in the representative business.

## Key point
This matrix is intentionally about prompt cleanup only. The database may still contain legacy compatibility fields and that is a separate task.