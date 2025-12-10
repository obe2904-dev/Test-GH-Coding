// ===========================================
// File: src/features/emojis/index.ts
// Why: Stub "feature" for emojis (offline).
// ===========================================
import type { GenerateContext } from '../shared/types';

type Out = { emojis: string[] };

class StubEmojis {
  async analyze(_ctx: GenerateContext) {
    return {};
  }
  async generate(ctx: GenerateContext): Promise<Out> {
    const n = Math.min(4, ctx.constraints?.maxEmojis ?? 4);
    const pool = ['✨', '🚀', '🎯', '📣', '📈', '🙌', '💡', '🔥'];
    return { emojis: pool.slice(0, n) };
  }
  validate(_out: Out) {
    return { ok: true as const };
  }
}

export function resolveEmojisFeature(/* tier: Tier */) {
  return new StubEmojis();
}

// Direct async emoji generator for external usage
export async function generateEmojis(ctx: GenerateContext): Promise<string[]> {
  const stub = resolveEmojisFeature();
  const result = await stub.generate(ctx);
  return result.emojis;
}