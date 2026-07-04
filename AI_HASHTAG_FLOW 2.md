# AI Hashtag Flow

This document explains how hashtags are handled in both `ai-enhance` and `generate-text-from-idea`.

## Shared strategy

Both edge functions now use the shared helper at [supabase/functions/_shared/hashtags/platform-hashtags.ts](supabase/functions/_shared/hashtags/platform-hashtags.ts).

The helper builds layered tags from the available context:
- local
- product
- category
- lifestyle
- brand
- occasion
- dietary
- campaign
- community

It then returns explicit arrays for:
- Facebook, capped at 3 hashtags
- Instagram, capped at 5 hashtags

The same source data can produce different mixes per platform, but the split is deterministic and server-side.

Source:
- [supabase/functions/_shared/hashtags/platform-hashtags.ts](supabase/functions/_shared/hashtags/platform-hashtags.ts)
- [supabase/functions/generate-text-from-idea/post-process.ts](supabase/functions/generate-text-from-idea/post-process.ts)
- [supabase/functions/ai-enhance/index.ts](supabase/functions/ai-enhance/index.ts)

## `ai-enhance`

`ai-enhance` now returns explicit platform fields in addition to a legacy combined list:
- `facebookHashtags`
- `instagramHashtags`
- `hashtags` as a merged compatibility list
- `hashtag_groups` with the same explicit split

The edge function still accepts `includeHashtags`, but hashtags are generated server-side instead of by the model prompt.

Source:
- [supabase/functions/ai-enhance/index.ts](supabase/functions/ai-enhance/index.ts)

## `generate-text-from-idea`

`generate-text-from-idea` also uses the shared helper, but it already returns explicit platform arrays in its existing response contract. The helper now drives the actual hashtag selection rules, so both flows stay aligned.

Source:
- [supabase/functions/generate-text-from-idea/post-process.ts](supabase/functions/generate-text-from-idea/post-process.ts)

## Current limits

Facebook is capped at 3 hashtags and Instagram is capped at 5 hashtags. The helper prefers local, product, category, and lifestyle signals first, then brand and occasion tags when there is room.

The frontend hook at [src/hooks/usePostCreationAI.ts](src/hooks/usePostCreationAI.ts) now prefers `facebookHashtags` and `instagramHashtags`, with fallback support for older payloads.
