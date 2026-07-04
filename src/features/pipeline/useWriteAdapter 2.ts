// ===========================================
// File: src/features/pipeline/useWriteAdapter.ts
// Why: Thin adapter purpose-built for GenerateStep UI.
// ===========================================
import { useGenerateContent } from './useGenerateContent';
import type { GenerateArgs, GenerateResult } from '../shared/types';

export function useWriteAdapter() {
  const { generateAll } = useGenerateContent();

  async function generate(args: GenerateArgs): Promise<GenerateResult> {
    // Single call your UI can await
    return generateAll(args);
  }

  return { generate };
}