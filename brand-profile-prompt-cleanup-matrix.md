# Brand Profile Prompt Cleanup Matrix

Scope: `brand-profile-generator-v5` only. Database cleanup is out of scope.

Legend:
- `keep` = stays in the prompt flow as a live or compatibility input
- `remove` = remove from the prompt mapping because it is a dead/non-existing live input
- `derive` = not a primary source; generated from other fields or produced later in the flow
- `review` = not enough evidence to remove yet

| Field | Decision | Why | Evidence / notes |
| --- | --- | --- | --- |
| `tone_of_voice` | `keep` | Compatibility / derived output still consumed downstream | Still referenced by `generate-text-from-idea`, `adjust-text`, `generate-weekly-plan`, and `brand-profile-generator` saves it as a compatibility field |
| `tone_keywords` | `keep` | Compatibility / downstream consumer still reads it | Used by weekly plan and other brand-profile consumers; not the primary source of truth, but still live |
| `tone_model` | `keep` | Compatibility / derived output | Still used in prompt consumers and saved as a normalized legacy structure |
| `typical_openings` | `keep` | Writing-example compatibility field | Used by `writing-examples.ts` and downstream consumers; not a dead reference |
| `typical_closings` | `derive` | Generated output, not a live DB input | No longer treated as a prompt input from `business_brand_profile`; generated in the writing-example pipeline |
| `signature_phrases` | `remove` | Missing live DB column in the representative inventory | Still selected in `brand-profile-generator-v5`, but the inventory shows it as `missing_column` |
| `never_say` | `remove` | Missing live DB column in the representative inventory | Still selected in `brand-profile-generator-v5`, but the inventory shows it as `missing_column` |
| `things_to_avoid` | `keep` | Live compatibility field and downstream consumer input | Still read in prompt consumers and used as merged guardrail content |
| `voice_constraints` | `keep` | Live compatibility field and downstream consumer input | Still read downstream; inventory shows it exists and has content |
| `target_audience` | `keep` | Live field, though mostly empty | Exists in inventory, but empty for the representative business |
| `communication_goal` | `keep` | Live field, though mostly empty | Exists in inventory, but empty for the representative business |
| `emotional_promise` | `remove` | Missing live DB column in the representative inventory | No live schema column in the representative business report |
| `brand_context` | `remove` | Missing live DB column in the representative inventory | No live schema column in the representative business report |
| `recognizable_interior_identity` | `keep` | Live field, but empty | Exists in inventory, although null-like for the representative business |
| `visual_character` | `remove` | Missing live DB column in the representative inventory | No live schema column in the representative business report |
| `venue_scene` | `remove` | Missing live DB column in the representative inventory | No live schema column in the representative business report |
| `humor_level` | `remove` | Missing live DB column in the representative inventory | No live schema column in the representative business report |
| `menu_overview_summary` | `keep` | Live output/input bridge with real content | Exists and contains useful data; key summary field |
| `gastronomic_profile` | `keep` | Live output/input bridge with real content | Exists and contains useful data; key summary field |
| `signature_themes` | `keep` | Live output/input bridge with real content | Exists and contains useful data; key summary field |
| `strategic_audience_segments` | `keep` | Live output/input bridge with real content | Exists and contains useful data; useful prompt context |
| `business_character` | `keep` | Live field with real content | Strong live input, used in guardrails / persona context |

## Recommended cleanup order
1. Remove dead prompt references: `signature_phrases`, `never_say`, `emotional_promise`, `brand_context`, `visual_character`, `venue_scene`, `humor_level`.
2. Keep compatibility fields for now: `tone_of_voice`, `tone_model`, `tone_keywords`, `things_to_avoid`, `voice_constraints`, `typical_openings`.
3. Re-run the business-scoped inventory after each pass.
4. Only after the prompt is clean, repeat the same exercise downstream.

## Key point
This matrix is intentionally about prompt cleanup only. The database may still contain legacy compatibility fields and that is a separate task.
