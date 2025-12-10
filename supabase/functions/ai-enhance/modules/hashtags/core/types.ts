export type HashtagGroups = Record<'primary' | 'local' | 'foodie' | 'extras', string[]>

export interface EnhancedContent {
	text: string
	headline?: string | null
	hashtags?: string[]
	hashtag_groups?: HashtagGroups
}
