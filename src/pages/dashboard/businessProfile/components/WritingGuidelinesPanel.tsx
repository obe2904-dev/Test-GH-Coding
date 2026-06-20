import { useState } from 'react'

interface WritingGuidelines {
  writing_rules: string[]
  voice_constraints: string
  typical_openings: string[]
  signature_phrases: string[]
  content_anchors: string[]
  humor_level: string
  voice_rationale?: string
}

interface WritingGuidelinesPanelProps {
  guidelines: WritingGuidelines | null
  isLoading?: boolean
  onEdit?: (updated: WritingGuidelines) => void
}

export function WritingGuidelinesPanel({ guidelines, isLoading, onEdit }: WritingGuidelinesPanelProps) {
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

  if (!guidelines) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Skriveregler & Stemme</h4>
            <p className="text-xs text-gray-600">
              Generer en Brand Profil for at se de regler der styrer hvordan dine tekster formuleres.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const humorLevelLabels: Record<string, string> = {
    none: 'Ingen humor — oprigtig og seriøs tone',
    serious: 'Ingen humor — oprigtig og seriøs tone',
    subtle: 'Let selvironisk eller tør humor',
    dry: 'Let selvironisk eller tør humor',
    low: 'Let selvironisk eller tør humor',
    moderate: 'Afbalanceret — naturlig humor når det passer',
    high: 'Legesyg tone — lette jokes og ordspil velkomne',
    playful: 'Legesyg tone — lette jokes og ordspil velkomne',
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📝</span>
          <h3 className="text-sm font-semibold text-gray-900">Skriveregler & Stemme</h3>
          <span className="text-xs text-gray-500 font-normal ml-1">(styrer hvordan tekst formuleres)</span>
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
        {/* Writing Rules - Primary Voice Controller */}
        {guidelines.writing_rules && guidelines.writing_rules.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('writing_rules')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-blue-600">✎</span>
                <span className="text-xs font-semibold text-gray-800">Skriveregler</span>
                <span className="text-[10px] text-gray-400">({guidelines.writing_rules.length} regler)</span>
              </div>
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'writing_rules' ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {expandedSection === 'writing_rules' ? (
              <div className="pl-6 space-y-2">
                <div className="text-[11px] text-blue-700 bg-blue-50 px-3 py-1.5 rounded mb-2">
                  Disse regler definerer hvordan AI formulerer dine tekster
                </div>
                {guidelines.writing_rules.map((rule, i) => (
                  <div 
                    key={i} 
                    className="text-xs text-gray-800 bg-blue-50 border-l-2 border-blue-400 pl-3 py-2.5 pr-2 rounded-r"
                  >
                    <span className="font-medium text-blue-700">{i + 1}.</span> {rule}
                  </div>
                ))}
              </div>
            ) : (
              <div className="pl-6">
                <div className="text-xs text-gray-700 bg-blue-50 border-l-2 border-blue-400 pl-3 py-2 pr-2 rounded-r truncate">
                  <span className="font-medium text-blue-700">1.</span> {guidelines.writing_rules[0]}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Voice Constraints - Behavioral Principles */}
        {guidelines.voice_constraints && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-purple-600">⚡</span>
              <span className="text-xs font-semibold text-gray-800">Stemmeprincipper</span>
            </div>
            <div className="pl-6">
              <div className="text-xs text-gray-800 bg-purple-50 border-l-2 border-purple-400 pl-3 py-2.5 pr-2 rounded-r">
                {guidelines.voice_constraints}
              </div>
            </div>
          </div>
        )}

        {/* Humor Level */}
        {guidelines.humor_level && guidelines.humor_level !== 'moderate' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-amber-600">😊</span>
              <span className="text-xs font-semibold text-gray-800">Humorregister</span>
            </div>
            <div className="pl-6">
              <div className="text-xs text-gray-800 bg-amber-50 border-l-2 border-amber-400 pl-3 py-2 pr-2 rounded-r">
                {humorLevelLabels[guidelines.humor_level.toLowerCase()] || guidelines.humor_level}
              </div>
            </div>
          </div>
        )}

        {/* Content Anchors - What the business actually offers */}
        {guidelines.content_anchors && guidelines.content_anchors.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-gray-100">
            <button
              onClick={() => toggleSection('content_anchors')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-green-600">⚓</span>
                <span className="text-xs font-medium text-gray-700">Konceptankre</span>
                <span className="text-[10px] text-gray-400">({guidelines.content_anchors.length})</span>
              </div>
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'content_anchors' ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {expandedSection === 'content_anchors' ? (
              <div className="pl-6">
                <div className="text-[11px] text-green-700 bg-green-50 px-3 py-1.5 rounded mb-2">
                  Faktiske tilbud der skal nævnes i tekster
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {guidelines.content_anchors.map((anchor, i) => (
                    <span 
                      key={i} 
                      className="text-[11px] bg-green-50 text-green-800 px-2.5 py-1 rounded border border-green-200"
                    >
                      {anchor}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pl-6">
                <div className="flex flex-wrap gap-1.5">
                  {guidelines.content_anchors.slice(0, 3).map((anchor, i) => (
                    <span 
                      key={i} 
                      className="text-[11px] bg-green-50 text-green-800 px-2.5 py-1 rounded border border-green-200"
                    >
                      {anchor}
                    </span>
                  ))}
                  {guidelines.content_anchors.length > 3 && (
                    <span className="text-[11px] text-gray-500 px-2.5 py-1">
                      +{guidelines.content_anchors.length - 3} mere
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Typical Openings - Sentence Rhythm */}
        {guidelines.typical_openings && guidelines.typical_openings.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-gray-100">
            <button
              onClick={() => toggleSection('typical_openings')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-indigo-600">🎵</span>
                <span className="text-xs font-medium text-gray-700">Åbningsregister</span>
                <span className="text-[10px] text-gray-400">(rytme og stemme)</span>
              </div>
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'typical_openings' ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {expandedSection === 'typical_openings' ? (
              <div className="pl-6 space-y-2">
                <div className="text-[11px] text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded mb-2">
                  Hvordan din brand starter tekster — lån tonen, ikke indholdet
                </div>
                {guidelines.typical_openings.map((opening, i) => (
                  <div 
                    key={i} 
                    className="text-xs text-gray-700 bg-indigo-50 border-l-2 border-indigo-400 pl-3 py-2 pr-2 rounded-r italic"
                  >
                    "{opening}"
                  </div>
                ))}
              </div>
            ) : (
              <div className="pl-6">
                <div className="text-xs text-gray-700 bg-indigo-50 border-l-2 border-indigo-400 pl-3 py-2 pr-2 rounded-r truncate italic">
                  "{guidelines.typical_openings[0]}"
                </div>
              </div>
            )}
          </div>
        )}

        {/* Signature Phrases */}
        {guidelines.signature_phrases && guidelines.signature_phrases.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-gray-100">
            <button
              onClick={() => toggleSection('signature_phrases')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-pink-600">✨</span>
                <span className="text-xs font-medium text-gray-700">Signaturfraser</span>
                <span className="text-[10px] text-gray-400">({guidelines.signature_phrases.length})</span>
              </div>
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'signature_phrases' ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {expandedSection === 'signature_phrases' ? (
              <div className="pl-6">
                <div className="text-[11px] text-pink-700 bg-pink-50 px-3 py-1.5 rounded mb-2">
                  Brand-specifikke fraser der væves naturligt ind
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {guidelines.signature_phrases.map((phrase, i) => (
                    <span 
                      key={i} 
                      className="text-[11px] bg-pink-50 text-pink-800 px-2.5 py-1 rounded border border-pink-200 italic"
                    >
                      "{phrase}"
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pl-6">
                <div className="flex flex-wrap gap-1.5">
                  {guidelines.signature_phrases.slice(0, 2).map((phrase, i) => (
                    <span 
                      key={i} 
                      className="text-[11px] bg-pink-50 text-pink-800 px-2.5 py-1 rounded border border-pink-200 italic"
                    >
                      "{phrase}"
                    </span>
                  ))}
                  {guidelines.signature_phrases.length > 2 && (
                    <span className="text-[11px] text-gray-500 px-2.5 py-1">
                      +{guidelines.signature_phrases.length - 2} mere
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Voice Rationale - Register Warnings */}
        {guidelines.voice_rationale && (
          <div className="space-y-2 pt-3 border-t border-gray-100">
            <button
              onClick={() => toggleSection('voice_rationale')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-red-600">🚫</span>
                <span className="text-xs font-medium text-gray-700">Registervagt</span>
                <span className="text-[10px] text-gray-400">(advarsler om formalitet/tone)</span>
              </div>
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'voice_rationale' ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {expandedSection === 'voice_rationale' && (
              <div className="pl-6">
                <div className="text-xs text-gray-800 bg-red-50 border-l-2 border-red-400 pl-3 py-2.5 pr-2 rounded-r">
                  {guidelines.voice_rationale}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-[11px] text-gray-600">
            Disse regler styrer <span className="font-semibold">hvordan</span> dine tekster formuleres (ordvalg, sætningsstruktur, rytme) — 
            ikke <span className="font-semibold">hvad</span> der skrives om.
          </p>
        </div>
      </div>
    </div>
  )
}
