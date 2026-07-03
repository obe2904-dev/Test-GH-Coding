/**
 * Color Extractor Service
 * Extracts dominant colors from GPT-4 Vision analysis
 */

export interface ColorDefinition {
  color: string; // Hex code
  name: string;
  usage: string;
}

export class ColorExtractor {
  /**
   * Parse colors from AI analysis
   * AI returns colors in format like "warm brown (#8B7355)", "cream (#F5F5DC)"
   */
  parseColors(colorDescriptions: string[]): ColorDefinition[] {
    const colors: ColorDefinition[] = [];

    for (const desc of colorDescriptions) {
      // Extract hex code using regex
      const hexMatch = desc.match(/#[0-9A-Fa-f]{6}/);
      const hex = hexMatch ? hexMatch[0] : this.generateDefaultHex();

      // Extract color name (text before hex code or parenthesis)
      const nameMatch = desc.match(/^([^(#]+)/);
      const name = nameMatch ? nameMatch[1].trim() : 'Unknown';

      // Determine usage based on position
      const index = colorDescriptions.indexOf(desc);
      let usage = 'Accent';
      if (index === 0) usage = 'Primary';
      else if (index === 1) usage = 'Secondary';

      colors.push({ color: hex, name, usage });
    }

    return colors;
  }

  /**
   * Generate default hex for fallback
   */
  private generateDefaultHex(): string {
    const defaults = ['#8B7355', '#F5F5DC', '#2F5233', '#4A5568'];
    return defaults[Math.floor(Math.random() * defaults.length)];
  }

  /**
   * Validate hex code
   */
  isValidHex(hex: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(hex);
  }
}
