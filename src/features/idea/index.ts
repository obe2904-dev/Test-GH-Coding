// ===========================================
// File: src/features/idea/index.ts
// Why: Stub "feature" for unified AI Idea (offline, CTA-style).
// ===========================================
import type { GenerateContext } from '../shared/types';

type Out = {
  headline: string;
  text: string;
  emojis: string[];
  ctas: string[];
  hashtags: string[];
  photo: string;
};

class StubIdea {
  async analyze(_ctx: GenerateContext) {
    return {};
  }
  async generate(_ctx: GenerateContext): Promise<Out> {
    return {
      headline: 'Unified Headline Test',
      text: 'Unified idea text for demo purposes.',
      emojis: ['✨', '🚀', 'G'],
      ctas: ['Get started - tester', 'Try it free - testing'],
      hashtags: ['#dummyTagOne', '#dummyTagTwo', '#dummyTagThree'],
      photo: 'Photo idea: Smiling team with product.'
    };
  }
  validate(_out: Out) {
    return { ok: true as const };
  }
}

export function resolveIdeaFeature(/* tier: Tier */) {
  return new StubIdea();
}

// Direct async idea generator for external usage
export async function generateIdea(ctx: GenerateContext): Promise<Out> {
  const stub = resolveIdeaFeature();
  const result = await stub.generate(ctx);
  return result;
}
