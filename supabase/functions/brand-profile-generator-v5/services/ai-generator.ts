/**
 * AI Generator Service
 * Calls OpenAI GPT-4o API to generate brand profile
 */

import type { BrandProfileGenerated } from '../types.ts';
import { BrandProfileGenerationError } from '../utils/error-handler.ts';

export async function generateBrandProfile(
  prompt: string,
  openaiApiKey: string
): Promise<BrandProfileGenerated> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a brand strategist specializing in Danish hospitality businesses. You always return valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new BrandProfileGenerationError(
        `OpenAI API error: ${errorData.error?.message || 'Unknown error'}`,
        'ai-generation',
        true,
        errorData
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new BrandProfileGenerationError(
        'No content returned from OpenAI',
        'ai-generation',
        true
      );
    }

    // Parse JSON response
    const brandProfile = JSON.parse(content);
    return brandProfile as BrandProfileGenerated;
  } catch (error) {
    if (error instanceof BrandProfileGenerationError) {
      throw error;
    }
    throw new BrandProfileGenerationError(
      'Failed to generate brand profile with AI',
      'ai-generation',
      true,
      error
    );
  }
}
