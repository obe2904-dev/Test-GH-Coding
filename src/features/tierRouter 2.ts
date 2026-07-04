// ===========================================
// File: src/features/tierRouter.ts
// Why: Central resolver + context builder (offline).
// ===========================================
import type { GenerateContext, Platform, Tone, Tier } from './shared/types';
import { resolveHashtagsFeature } from './hashtags';
import { resolveEmojisFeature } from './emojis';
import { resolveCtaFeature } from './cta';

export function resolveFeatures(_tier: Tier | undefined) {
  // Later: branch by tier for different models/settings
  return {
    hashtags: resolveHashtagsFeature(),
    emojis: resolveEmojisFeature(),
    cta: resolveCtaFeature(),
  };
}

export function makeBaseContext(
  args: {
    platform: Platform;
    tone: Tone;
    language: string;
    draftCaption: string;
    brand?: GenerateContext['brand'];
    constraints?: GenerateContext['constraints'];
  },
  tier: Tier | undefined
): GenerateContext {
  return { ...args, tier };
}