/**
 * Validator Service
 * Validates AI-generated brand profile
 */

import type { BrandProfileGenerated } from '../types.ts';
import { BrandProfileGenerationError } from '../utils/error-handler.ts';

export function validateBrandProfile(profile: BrandProfileGenerated): void {
  const errors: string[] = [];

  // Check required fields
  if (!profile.brand_essence || profile.brand_essence.length === 0) {
    errors.push('brand_essence is required');
  }

  if (!profile.brand_positioning || profile.brand_positioning.length === 0) {
    errors.push('brand_positioning is required');
  }

  if (!profile.tone_of_voice) {
    errors.push('tone_of_voice is required');
  } else {
    if (!profile.tone_of_voice.primary_tone) {
      errors.push('tone_of_voice.primary_tone is required');
    }
    if (!Array.isArray(profile.tone_of_voice.attributes) || profile.tone_of_voice.attributes.length === 0) {
      errors.push('tone_of_voice.attributes must be a non-empty array');
    }
    if (!profile.tone_of_voice.formality_level) {
      errors.push('tone_of_voice.formality_level is required');
    }
  }

  if (!Array.isArray(profile.content_hooks) || profile.content_hooks.length === 0) {
    errors.push('content_hooks must be a non-empty array');
  }

  if (!Array.isArray(profile.banned_words)) {
    errors.push('banned_words must be an array');
  }

  if (!profile.target_audience) {
    errors.push('target_audience is required');
  }

  if (!profile.competitive_positioning) {
    errors.push('competitive_positioning is required');
  }

  if (errors.length > 0) {
    throw new BrandProfileGenerationError(
      `Validation failed: ${errors.join(', ')}`,
      'validation',
      true,
      { errors, profile }
    );
  }
}
