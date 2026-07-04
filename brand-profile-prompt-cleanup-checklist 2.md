# Brand Profile Prompt Cleanup Checklist

Scope: clean the brand-profile prompt flow only. Do not change the database schema in this task.

## Goals
- Remove dead or non-existing prompt references from `brand-profile-generator-v5`.
- Keep live compatibility fields only if they are still consumed by the prompt flow.
- Preserve the ability to judge information flow cleanly, without DB noise.

## Step 1: Classify each field
- Mark as `dead` if the live schema does not expose the column.
- Mark as `live-but-empty` if the column exists but is usually null or empty.
- Mark as `derived` if the prompt output is synthesized from other fields.
- Mark as `compatibility` if the field is old, but still used by downstream prompt consumers.

## Step 2: Brand-profile-generator-v5 inputs
- Review the current `business_brand_profile` select list in `supabase/functions/brand-profile-generator-v5/index.ts`.
- Review the writing-example path in `supabase/functions/_shared/brand-profile/writing-examples.ts`.
- Review any legacy guardrail merging in `generate-text-from-idea/resolve-context.ts` only as a consumer check, not as a database cleanup target.

## Step 3: Remove dead prompt references
- Remove fields that do not exist in the live schema and are only present as stale prompt inputs.
- Do not keep dead fields in inventory/audit files as active prompt inputs.
- Prefer removing the reference from the prompt mapping rather than renaming it to a guess.

## Step 4: Keep or re-label live outputs
- Keep `tone_of_voice` and `tone_model` as outputs/compatibility structures if downstream consumers still use them.
- Keep `things_to_avoid`, `voice_constraints`, and `typical_openings` only if the current prompt flow still depends on them.
- Treat `signature_phrases` and `never_say` as dead references unless a live consumer or live schema source is confirmed.

## Step 5: Validate prompt flow
- Re-run the business-scoped inventory report after each cleanup pass.
- Verify that the prompt still has enough live inputs to generate a useful brand profile.
- Verify that each remaining field is either live, derived, or intentionally kept for compatibility.

## Step 6: Downstream follow-up later
- Leave downstream prompt consumers unchanged for now.
- After brand-profile cleanup is stable, repeat the same exercise downstream.
- Schedule database cleanup as a separate future task.

## Current working assumptions
- `signature_phrases` is a stale live-schema reference.
- `never_say` is a stale live-schema reference.
- `typical_closings` is generated output, not a live DB input.
- `tone_of_voice` and `tone_model` are compatibility/derived structures, not primary truth.
