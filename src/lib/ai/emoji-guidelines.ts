/**
 * Functional Emoji Guidelines for AI Content Generation
 * Based on research: 1-3 emojis per post, strategic placement, platform-aware
 */

export type BusinessVoice = 'formal' | 'professional' | 'friendly' | 'casual';
export type Platform = 'instagram' | 'facebook';

interface EmojiGuidelines {
  maxCount: number;
  allowedEmojis: string;
  placement: string[];
  rules: string[];
}

/**
 * Get emoji guidelines based on business voice and platform
 */
export function getEmojiGuidelines(
  businessVoice: BusinessVoice,
  platform: Platform
): EmojiGuidelines {
  const guidelines = EMOJI_MATRIX[businessVoice][platform];
  return {
    ...guidelines,
    placement: PLACEMENT_RULES,
    rules: GENERAL_RULES
  };
}

/**
 * Generate emoji instructions for AI prompts
 */
export function buildEmojiPrompt(businessVoice: BusinessVoice, platform: Platform): string {
  const guidelines = getEmojiGuidelines(businessVoice, platform);
  
  return `
EMOJI GUIDELINES:

GOLDEN RULES:
- Use 1-3 emojis per post maximum (never more)
- Emojis ENHANCE text, NEVER replace words
- Place at natural pause points or for emphasis
- Screen reader friendly (don't use emoji for critical info)

BUSINESS VOICE: ${businessVoice}
PLATFORM: ${platform}
MAX EMOJIS: ${guidelines.maxCount}
ALLOWED EMOJIS: ${guidelines.allowedEmojis}

PLACEMENT STRATEGY:
✅ GOOD: Before CTAs (👉 Book nu, 📍 Besøg os, ⬇️ Se menu)
✅ GOOD: Key info (🕐 Åben 09-17, ☕ Fresh kaffe, 🍰 Ny dessert)
✅ GOOD: First line (makes caption pop before "more" button)
✅ GOOD: Section breaks in longer posts

❌ AVOID: Flooding post with emojis
❌ AVOID: Using 🔥💯 unless genuinely matching brand
❌ AVOID: Replacing words ("Vi ❤️ kaffe" → "Vi elsker kaffe ❤️")

HOSPITALITY EMOJI TOOLKIT:
Food/Drink: ☕🍰🍷🥐🍕🍝🥗 (use for menu items)
Practical: 📍🕐⏰📅 (location, hours, dates)
Emphasis: ✨🌟👉⬇️ (CTAs, special items)
Mood: 😊☀️🌙 (only if matches brand voice)

${getVoiceSpecificRules(businessVoice)}

EXAMPLE GOOD USAGE:
${getExamplePost(businessVoice, platform)}
`.trim();
}

function getVoiceSpecificRules(voice: BusinessVoice): string {
  switch (voice) {
    case 'formal':
      return `FORMAL VOICE:
- Use 0-1 emoji maximum, only elegant symbols (✨🌟🍷)
- Place at end of post only, if at all
- Prefer no emojis for most posts
- Never use playful or casual emojis`;

    case 'professional':
      return `PROFESSIONAL VOICE:
- Use 1-2 emojis maximum
- Focus on practical emojis (📍🕐☕)
- Avoid overly casual or playful emojis
- Keep tone refined even with emojis`;

    case 'friendly':
      return `FRIENDLY VOICE:
- Use 2-3 emojis strategically
- Mix food emojis + practical info
- Can use occasional mood emojis (😊)
- Keep it warm but not overwhelming`;

    case 'casual':
      return `CASUAL VOICE:
- Use 2-3 emojis, can be more expressive
- Can use playful emojis (🎉✨)
- Still maintain 1-3 guideline
- Match young, energetic vibe`;
  }
}

function getExamplePost(voice: BusinessVoice, platform: Platform): string {
  if (voice === 'formal') {
    return platform === 'instagram'
      ? '"Experience culinary artistry in an intimate setting ✨\n\nReservations: +45 12 34 56 78"'
      : '"Experience culinary artistry in an intimate setting.\n\nReservations: +45 12 34 56 78"';
  }

  if (voice === 'professional') {
    return platform === 'instagram'
      ? '"Join us for a carefully curated wine dinner ☕\n\n📍 Hovedgaden 42\n🕐 Opening at 17:00"'
      : '"Join us for a carefully curated wine dinner.\n\n📍 Hovedgaden 42\nOpening at 17:00"';
  }

  if (voice === 'friendly') {
    return platform === 'instagram'
      ? '"God morgen! ☕\n\nFrisk brygget kaffe og hjemmebagt kanelsnegl venter.\n\n📍 Hovedgaden 42\n🕐 Åbner kl. 08:00"'
      : '"God morgen! ☕\n\nFrisk brygget kaffe og hjemmebagt kanelsnegl venter.\n\nÅbner kl. 08:00"';
  }

  // casual
  return platform === 'instagram'
    ? '"Weekend vibes starter her 🎉\n\nCocktails, god musik og god stemning ✨\n\n📍 Se dig kl. 18:00!"'
    : '"Weekend vibes starter her! 🎉\n\nCocktails, god musik og god stemning.\n\nSe dig kl. 18:00!"';
}

// Emoji usage matrix by voice and platform
const EMOJI_MATRIX: Record<BusinessVoice, Record<Platform, { maxCount: number; allowedEmojis: string }>> = {
  formal: {
    instagram: {
      maxCount: 1,
      allowedEmojis: 'Only elegant symbols: ✨🌟🍷 (or none)'
    },
    facebook: {
      maxCount: 0,
      allowedEmojis: 'Prefer no emojis'
    }
  },
  professional: {
    instagram: {
      maxCount: 2,
      allowedEmojis: 'Practical + elegant: 📍🕐☕🍷✨🌟'
    },
    facebook: {
      maxCount: 1,
      allowedEmojis: 'Only practical: 📍🕐☕'
    }
  },
  friendly: {
    instagram: {
      maxCount: 3,
      allowedEmojis: 'Food + practical + mood: ☕🍰🥐📍🕐😊🌸'
    },
    facebook: {
      maxCount: 2,
      allowedEmojis: 'Food + practical: ☕🍰📍🕐'
    }
  },
  casual: {
    instagram: {
      maxCount: 3,
      allowedEmojis: 'Expressive + food: 🎉🍹✨💫☕🍕😊'
    },
    facebook: {
      maxCount: 2,
      allowedEmojis: 'Moderate expressive: 🎉🍹☕'
    }
  }
};

const PLACEMENT_RULES = [
  'Before CTAs to draw attention (👉 Book now)',
  'Highlight key practical info (📍 location, 🕐 hours)',
  'First line of caption (visible before "more" button)',
  'As section breaks in longer captions',
  'Never scatter randomly throughout text'
];

const GENERAL_RULES = [
  'Maximum 1-3 emojis per post (guideline, not minimum)',
  'Emojis enhance meaning, never replace words',
  'Facebook posts use fewer emojis than Instagram',
  'Hospitality favorites: ☕🍰🍷📍🕐 (food, location, time)',
  'Accessibility: Don\'t use emojis for critical information',
  'Screen readers struggle with heavy emoji use',
  'Emojis should feel natural, not forced'
];
