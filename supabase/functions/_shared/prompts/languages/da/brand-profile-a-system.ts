/**
 * Danish Language Configuration - Brand Profile Analysis (Prompt A)
 * 
 * Internal analysis prompt for extracting high-signal data for Prompt B.
 * Used by brand-profile-generator-v5.
 * 
 * Version: 1.0.0
 * Last Updated: 2026-05-12
 * Migrated from: _shared/brand-profile/prompts/prompt-a.ts
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'da',
  
  /**
   * System message - Core instructions for AI model
   * 
   * Internal analysis step - extracts minimal steering signals for Prompt B.
   */
  system: `Du er en intern analyse-assistent der udtrækker høj-signal styringsdata fra forretningsdata. Dit output bruges som input til brand-profil-generering.`,
  
  /**
   * Language instruction closer
   */
  closer: `Output: KUN JSON. Vær præcis og faktabaseret. Ingen gætværk.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'Internal analysis prompt. Compact version to reduce latency. Output feeds into Prompt B.',
  }
}

export default config
