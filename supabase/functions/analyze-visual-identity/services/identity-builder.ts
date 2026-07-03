/**
 * Identity Builder Service
 * Builds complete visual identity object from analysis
 */

import type { ColorDefinition } from './color-extractor.ts';

interface VisualIdentity {
  photography_style: {
    overall_aesthetic: string;
    lighting_preference: string;
    composition_style: string;
    color_grading: string;
  };
  platform_visuals: {
    instagram: {
      aspect_ratio: string;
      content_style: string;
    };
    facebook: {
      aspect_ratio: string;
      content_style: string;
    };
  };
  recognizable_interior_identity: string;
  venue_character: string;
  venue_scene: string;
  venue_energy: string;
  guest_situation_type: string;
  signature_visual_elements: string[];
  primary_colors: ColorDefinition[];
}

export class IdentityBuilder {
  /**
   * Build visual identity object from analysis
   */
  build(analysis: any, colors: ColorDefinition[]): VisualIdentity {
    return {
      photography_style: {
        overall_aesthetic: analysis.overall_aesthetic || 'Not analyzed',
        lighting_preference: analysis.lighting_preference || 'Natural light preferred',
        composition_style: analysis.composition_style || 'Balanced composition',
        color_grading: analysis.color_grading || 'Natural tones',
      },
      platform_visuals: {
        instagram: {
          aspect_ratio: '4:5', // Vertical works best for food/hospitality
          content_style: this.deriveInstagramStyle(analysis),
        },
        facebook: {
          aspect_ratio: '1.91:1', // Landscape for Facebook
          content_style: 'Wider shots showing context and ambiance',
        },
      },
      recognizable_interior_identity: this.buildInteriorIdentity(analysis.venue_description, analysis.recognizable_elements),
      venue_character: analysis.venue_character || '',
      venue_scene: analysis.venue_scene || '',
      venue_energy: analysis.energy_word || '',
      guest_situation_type: analysis.guest_situation_type || '',
      signature_visual_elements: analysis.recognizable_elements || [],
      primary_colors: colors,
    };
  }

  /**
   * Derive Instagram content style from analysis
   */
  private deriveInstagramStyle(analysis: any): string {
    const style = analysis.composition_style || '';
    if (style.toLowerCase().includes('close-up')) {
      return 'Close-ups with context, showing food and environment';
    }
    if (style.toLowerCase().includes('overhead')) {
      return 'Overhead flatlays showing full table setting';
    }
    return 'Mix of close-ups and environmental shots';
  }

  /**
   * Build interior identity description
   */
  private buildInteriorIdentity(venueDescription: string, elements: string[]): string {
    if (venueDescription && venueDescription.trim().length > 20) {
      return venueDescription.trim();
    }
    if (!elements || elements.length === 0) {
      return 'Not yet analyzed';
    }
    return elements.slice(0, 5).join(', ');
  }
}
