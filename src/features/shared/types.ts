// ===========================================
// File: src/features/shared/types.ts
// Why: Minimal shared types used by the pipeline.
// ===========================================
export type Platform = 'generic' | 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'x';

export type Tone =
  | 'friendly'
  | 'professional'
  | 'playful'
  | 'bold'
  | 'informative'
  | 'empathetic';

export type Tier = 'free' | 'standardplus' | 'premium';

export interface GenerateContext {
  platform: Platform;
  tone: Tone;
  language: string;
  draftCaption: string;
  brand?: {
    brandName?: string;
    industry?: string;
    language?: string;
  };
  constraints?: {
    maxHashtags?: number;
    maxEmojis?: number;
    maxCtas?: number;
  };
  tier?: Tier;
}

export interface GenerateArgs {
  platform: Platform;
  tone: Tone;
  language: string;
  draft: string;
  brand?: GenerateContext['brand'];
  constraints?: GenerateContext['constraints'];
}

export interface GenerateResult {
  hashtags: string[];
  emojis: string[];
  ctas: string[];
}
