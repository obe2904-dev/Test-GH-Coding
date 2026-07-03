// ===========================================
// File: src/features/cta/index.ts
// Why: Stub "feature" for CTAs (offline).
// ===========================================
import type { GenerateContext } from '../shared/types';

type Out = { ctas: string[]; headline?: string };

class StubCta {
  async analyze(_ctx: GenerateContext) {
    return {};
  }
  async generate(ctx: GenerateContext): Promise<Out> {
    const n = Math.min(4, ctx.constraints?.maxCtas ?? 3);
    const pool = [
      'Get started - test',
      'Try it free - test',
      'Sign up today - test',
      'Join the waitlist - test',
      'Download now - test',
    ];
    return {
      ctas: pool.slice(0, n),
      headline: 'Headline Test'
    };
  }
  validate(_out: Out) {
    return { ok: true as const };
  }
}

export function resolveCtaFeature(/* tier: Tier */) {
  return new StubCta();
}

// Direct async CTA generator for external usage
export async function generateCtas(ctx: GenerateContext): Promise<string[]> {
  const stub = resolveCtaFeature();
  const result = await stub.generate(ctx);
  return result.ctas;
}

// Direct async headline generator for external usage
export async function generateHeadline(ctx: GenerateContext): Promise<string> {
  const stub = resolveCtaFeature();
  const result = await stub.generate(ctx);
  return result.headline ?? '';
}