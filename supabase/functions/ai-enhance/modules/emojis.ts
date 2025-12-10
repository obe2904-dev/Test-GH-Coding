interface TierEmojiRule {
  allowWhenRequested: boolean
  allowedDirective: string
  blockedDirective: string
  maxAllowed?: number
}

const TIER_EMOJI_RULES: Record<string, TierEmojiRule> = {
  free: {
    allowWhenRequested: false,
    allowedDirective: 'Do not add any emojis. Deliver plain text without emoji characters.',
    blockedDirective: 'Do not add any emojis. Deliver plain text without emoji characters.'
  },
  standardplus: {
    allowWhenRequested: true,
    allowedDirective: 'Use up to two purposeful emojis inside sentences (never stacked or trailing). Only include them when they reinforce the message.',
    blockedDirective: 'Do not add any emojis. Deliver plain text without emoji characters.',
    maxAllowed: 2,
  },
  premium: {
    allowWhenRequested: true,
    allowedDirective: 'Use up to three strategic emojis woven into the copy. Each emoji must have a clear purpose and appear inline, not at the end.',
    blockedDirective: 'Do not add any emojis. Deliver plain text without emoji characters.',
    maxAllowed: 3,
  },
  default: {
    allowWhenRequested: true,
    allowedDirective: 'Use emojis sparingly and only when they amplify the message. Keep them inline with the text.',
    blockedDirective: 'Do not add any emojis. Deliver plain text without emoji characters.',
    maxAllowed: 2,
  }
}

const EMOJI_REMOVE_PATTERN = /\p{Extended_Pictographic}/gu
const EMOJI_DETECT_PATTERN = /\p{Extended_Pictographic}/u

export interface EmojiPolicyInput {
  includeEmojis: boolean
  userTier?: string | null
}

export interface EmojiPolicy {
  allow: boolean
  directive: string
  maxEmojis: number | null
}

export interface EmojiContent {
  text?: string
  headline?: string | null
  emojis_used?: boolean | null
  [key: string]: unknown
}

const sanitizeTierKey = (tier?: string | null) => tier?.toLowerCase().trim() || 'free'

const stripEmoji = (value: string): string => {
  return value
    .replace(EMOJI_REMOVE_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const containsEmoji = (value: string): boolean => EMOJI_DETECT_PATTERN.test(value)

export function resolveEmojiPolicy(input: EmojiPolicyInput): EmojiPolicy {
  const tierKey = sanitizeTierKey(input.userTier)
  const rule = TIER_EMOJI_RULES[tierKey] || TIER_EMOJI_RULES.default
  const allow = Boolean(input.includeEmojis && rule.allowWhenRequested)

  return {
    allow,
    directive: allow ? rule.allowedDirective : rule.blockedDirective,
    maxEmojis: allow ? rule.maxAllowed ?? null : 0,
  }
}

export function enforceEmojiPolicy<T extends EmojiContent>(content: T, policy: EmojiPolicy): T {
  if (!content) {
    return content
  }

  const textHasEmoji = typeof content.text === 'string' && containsEmoji(content.text)
  const headlineHasEmoji = typeof content.headline === 'string' && containsEmoji(content.headline)

  if (!policy.allow) {
    if (textHasEmoji && typeof content.text === 'string') {
      content.text = stripEmoji(content.text) as typeof content.text
    }

    if (headlineHasEmoji && typeof content.headline === 'string') {
      content.headline = stripEmoji(content.headline) as typeof content.headline
    }

    content.emojis_used = false
    return content
  }

  content.emojis_used = textHasEmoji || headlineHasEmoji || Boolean(content.emojis_used)
  return content
}
