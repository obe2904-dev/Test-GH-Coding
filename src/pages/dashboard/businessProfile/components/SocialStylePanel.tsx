import { useState } from 'react'

interface SocialStyle {
  emoji_usage: 'none' | 'minimal' | 'moderate' | 'expressive'
  emoji_examples: string[]
  hashtag_strategy: {
    branded: string[]
    category: string[]
    local: string[]
  }
}

interface SocialStylePanelProps {
  socialStyle: SocialStyle | null
  isLoading?: boolean
  onEdit?: (updated: SocialStyle) => void
}

const EMOJI_USAGE_LABELS: Record<string, { label: string; description: string }> = {
  none: { label: 'Ingen', description: 'Formelt/seriøst brand - ingen emojis' },
  minimal: { label: 'Minimal', description: '1-2 emojis per opslag' },
  moderate: { label: 'Moderat', description: '3-5 emojis per opslag' },
  expressive: { label: 'Ekspressiv', description: 'Mange emojis - ungt/trendy brand' }
}

export function SocialStylePanel({ socialStyle, isLoading, onEdit }: SocialStylePanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  // Future: const [editedStyle, setEditedStyle] = useState<SocialStyle | null>(socialStyle)

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
        </div>
      </div>
    )
  }

  if (!socialStyle) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Social Stil</h4>
            <p className="text-xs text-gray-600">
              Generer en Brand Profil for at få emoji- og hashtag-anbefalinger.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const usageInfo = EMOJI_USAGE_LABELS[socialStyle.emoji_usage] || EMOJI_USAGE_LABELS.moderate

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎨</span>
          <h3 className="text-sm font-semibold text-gray-900">Social Stil</h3>
        </div>
        {onEdit && !isEditing && (
          <button
            onClick={() => {
              // Future: setEditedStyle(socialStyle)
              setIsEditing(true)
            }}
            className="text-xs text-gray-600 hover:text-gray-900 font-medium"
          >
            Rediger
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Emoji Usage */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-700">Emoji-brug:</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              socialStyle.emoji_usage === 'none' ? 'bg-gray-100 text-gray-700' :
              socialStyle.emoji_usage === 'minimal' ? 'bg-blue-100 text-blue-700' :
              socialStyle.emoji_usage === 'moderate' ? 'bg-green-100 text-green-700' :
              'bg-purple-100 text-purple-700'
            }`}>
              {usageInfo.label}
            </span>
          </div>
          <p className="text-xs text-gray-500">{usageInfo.description}</p>
        </div>

        {/* Emoji Examples */}
        {socialStyle.emoji_examples && socialStyle.emoji_examples.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-700 mb-2">Anbefalede emojis:</div>
            <div className="flex flex-wrap gap-2">
              {socialStyle.emoji_examples.map((emoji, i) => (
                <span 
                  key={i} 
                  className="text-xl bg-gray-50 rounded-lg px-2 py-1 hover:bg-gray-100 cursor-default"
                  title="Klik for at kopiere"
                >
                  {emoji}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Hashtag Strategy */}
        {socialStyle.hashtag_strategy && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-gray-700">Hashtag-strategi:</div>
            
            {/* Branded */}
            {socialStyle.hashtag_strategy.branded?.length > 0 && (
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Brand hashtags:</div>
                <div className="flex flex-wrap gap-1">
                  {socialStyle.hashtag_strategy.branded.map((tag, i) => (
                    <span key={i} className="text-xs bg-cta-surface text-cta-text px-2 py-0.5 rounded">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Category */}
            {socialStyle.hashtag_strategy.category?.length > 0 && (
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Kategori hashtags:</div>
                <div className="flex flex-wrap gap-1">
                  {socialStyle.hashtag_strategy.category.map((tag, i) => (
                    <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Local */}
            {socialStyle.hashtag_strategy.local?.length > 0 && (
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Lokale hashtags:</div>
                <div className="flex flex-wrap gap-1">
                  {socialStyle.hashtag_strategy.local.map((tag, i) => (
                    <span key={i} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
