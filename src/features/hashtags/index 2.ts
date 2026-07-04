// ===========================================
// File: src/features/hashtags/index.ts
// Why: Stub "feature" for hashtags (offline).
// ===========================================
import type { GenerateContext } from '../shared/types';

type Out = { hashtags: string[] };
type An = { base: string };

function slug(s: string) {
  return String(s || 'tag').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14);
}

class StubHashtags {
  async analyze(ctx: GenerateContext): Promise<An> {
    return { base: slug(ctx.draftCaption) };
  }
  async generate(ctx: GenerateContext): Promise<Out> {
    // Use fixed dummy hashtags for testing
    const pool = [
      '#dummyTagOne',
      '#dummyTagTwo',
      '#dummyTagThree',
      '#dummyTagFour'
    ];
    const n = Math.min(pool.length, ctx.constraints?.maxHashtags ?? 3);
    return { hashtags: pool.slice(0, n) };
  }
  validate(_out: Out) {
    // Keep UX flowing in dev
    return { ok: true as const };
  }
}

export function resolveHashtagsFeature(/* tier: Tier */) {
  return new StubHashtags();
}

// Direct async hashtag generator for external usage
export async function generateHashtags(ctx: GenerateContext): Promise<string[]> {
  const stub = resolveHashtagsFeature();
  const result = await stub.generate(ctx);
  return result.hashtags;
}