import { useState } from 'react'

interface VoiceExamples {
  do_say: string[]
  dont_say: string[]
  vocabulary: {
    prefer: string[]
    avoid: string[]
  }
}

interface VoiceExamplesPanelProps {
  voiceExamples: VoiceExamples | null
  isLoading?: boolean
  onEdit?: (updated: VoiceExamples) => void
}

export function VoiceExamplesPanel({ voiceExamples, isLoading, onEdit }: VoiceExamplesPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-100 rounded"></div>
        </div>
      </div>
    )
  }

  if (!voiceExamples) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Stemme & Ordvalg</h4>
            <p className="text-xs text-gray-600">
              Generer en Brand Profil for at få eksempler på hvordan dit brand kommunikerer.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <h3 className="text-sm font-semibold text-gray-900">Stemme & Ordvalg</h3>
        </div>
        {onEdit && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-gray-600 hover:text-gray-900 font-medium"
          >
            Rediger
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Do Say Section */}
        {voiceExamples.do_say && voiceExamples.do_say.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('do_say')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-xs font-medium text-gray-700">Sådan taler I</span>
                <span className="text-[10px] text-gray-400">({voiceExamples.do_say.length} eksempler)</span>
              </div>
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'do_say' ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {expandedSection === 'do_say' ? (
              <div className="pl-6 space-y-2">
                {voiceExamples.do_say.map((phrase, i) => (
                  <div 
                    key={i} 
                    className="text-xs text-gray-700 bg-green-50 border-l-2 border-green-400 pl-3 py-2 pr-2 rounded-r"
                  >
                    "{phrase}"
                  </div>
                ))}
              </div>
            ) : (
              <div className="pl-6">
                <div className="text-xs text-gray-600 bg-green-50 border-l-2 border-green-400 pl-3 py-2 pr-2 rounded-r truncate">
                  "{voiceExamples.do_say[0]}"
                </div>
              </div>
            )}
          </div>
        )}

        {/* Don't Say Section */}
        {voiceExamples.dont_say && voiceExamples.dont_say.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('dont_say')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-red-500">✗</span>
                <span className="text-xs font-medium text-gray-700">Undgå at sige</span>
                <span className="text-[10px] text-gray-400">({voiceExamples.dont_say.length} eksempler)</span>
              </div>
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'dont_say' ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {expandedSection === 'dont_say' ? (
              <div className="pl-6 space-y-2">
                {voiceExamples.dont_say.map((phrase, i) => (
                  <div 
                    key={i} 
                    className="text-xs text-gray-700 bg-red-50 border-l-2 border-red-300 pl-3 py-2 pr-2 rounded-r line-through decoration-red-300"
                  >
                    "{phrase}"
                  </div>
                ))}
              </div>
            ) : (
              <div className="pl-6">
                <div className="text-xs text-gray-600 bg-red-50 border-l-2 border-red-300 pl-3 py-2 pr-2 rounded-r truncate line-through decoration-red-300">
                  "{voiceExamples.dont_say[0]}"
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vocabulary Section */}
        {voiceExamples.vocabulary && (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-700">Ordvalg:</div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Prefer */}
              {voiceExamples.vocabulary.prefer?.length > 0 && (
                <div>
                  <div className="text-[11px] text-green-700 font-medium mb-2 flex items-center gap-1">
                    <span>👍</span> Brug gerne
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {voiceExamples.vocabulary.prefer.map((word, i) => (
                      <span 
                        key={i} 
                        className="text-[11px] bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Avoid */}
              {voiceExamples.vocabulary.avoid?.length > 0 && (
                <div>
                  <div className="text-[11px] text-red-600 font-medium mb-2 flex items-center gap-1">
                    <span>👎</span> Undgå
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {voiceExamples.vocabulary.avoid.map((word, i) => (
                      <span 
                        key={i} 
                        className="text-[11px] bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-200"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
