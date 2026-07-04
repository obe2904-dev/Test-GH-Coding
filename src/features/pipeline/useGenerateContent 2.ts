// ===========================================
// File: src/features/pipeline/useGenerateContent.ts
// Why: The "pipeline" hook the UI calls. Offline only.
// ===========================================
import { resolveFeatures, makeBaseContext } from '../tierRouter';
import { useTierStore } from '../../stores/tierStore';
import type { GenerateArgs, GenerateResult } from '../shared/types';

export function useGenerateContent() {
  // Read tier safely; keep working even if store shape changes.
  const currentTier = (() => {
    try {
      return useTierStore.getState?.().currentTier ?? 'free';
    } catch {
      // If tier store is a hook, fallback to reading inside render time
      return 'free';
    }
  })();

  async function generateAll(args: GenerateArgs): Promise<GenerateResult> {
    const features = resolveFeatures(currentTier as any);
    const ctx = makeBaseContext(
      {
        platform: args.platform,
        tone: args.tone,
        language: args.language,
        draftCaption: args.draft,
        brand: args.brand,
        constraints: args.constraints,
      },
      currentTier as any
    );


    const [hO, eO, cO] = await Promise.all([
      features.hashtags.generate(ctx),
      features.emojis.generate(ctx),
      features.cta.generate(ctx),
    ]);

    // Always OK in dev stubs; keep guardrails anyway
    const hv = features.hashtags.validate(hO as any);
    const ev = features.emojis.validate(eO as any);
    const cv = features.cta.validate(cO as any);
    if ((hv as any)?.ok === false) throw new Error('Hashtags invalid');
    if ((ev as any)?.ok === false) throw new Error('Emojis invalid');
    if ((cv as any)?.ok === false) throw new Error('CTA invalid');

    return {
      hashtags: (hO as any).hashtags ?? [],
      emojis: (eO as any).emojis ?? [],
      ctas: (cO as any).ctas ?? [],
    };
  }

  return { generateAll };
}