import { useState } from 'react'

interface BrandContextPanelProps {
  brandContext: string | null
  isGenerating: boolean
  generatedAt: string | null
  approved: boolean
  onGenerate: () => void
  onEdit: (newContext: string) => void
  onApprove: () => void
}

// Icon components for each category
const CategoryIcon = ({ type, isPrimary }: { type: string; isPrimary: boolean }) => {
  const colorClass = isPrimary ? 'text-indigo-500' : 'text-gray-400'
  const strokeWidth = 1.5
  
  const icons: Record<string, JSX.Element> = {
    essence: (
      <svg className={`w-4 h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" strokeWidth={strokeWidth} />
        <circle cx="12" cy="12" r="3" strokeWidth={strokeWidth} />
      </svg>
    ),
    tone: (
      <svg className={`w-4 h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    audience: (
      <svg className={`w-4 h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    menu: (
      <svg className={`w-4 h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
    focus: (
      <svg className={`w-4 h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    images: (
      <svg className={`w-4 h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    avoid: (
      <svg className={`w-4 h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    location: (
      <svg className={`w-4 h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    hours: (
      <svg className={`w-4 h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    goal: (
      <svg className={`w-4 h-4 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth={strokeWidth} />
        <circle cx="12" cy="12" r="6" strokeWidth={strokeWidth} />
        <circle cx="12" cy="12" r="2" strokeWidth={strokeWidth} fill="currentColor" />
      </svg>
    )
  }
  
  return icons[type] || null
}

// Category configuration with user-friendly labels and priority
// Ordered intentionally: identity → expression → content → guardrails → context → goal
const CATEGORIES = [
  // 1. Identity (Primary)
  { key: 'essence', label: 'Hvem I er', pattern: /###\s*\d+\.\s*Brand [Ee]ssence/i, primary: true },
  // 2. Expression (Primary)
  { key: 'tone', label: 'Sådan taler I', pattern: /###\s*\d+\.\s*Tone of [Vv]oice/i, primary: true },
  // 3. Audience (Primary)
  { key: 'audience', label: 'Hvem I taler til', pattern: /###\s*\d+\.\s*Target [Aa]udience/i, primary: true },
  // 4. Content - Offerings
  { key: 'menu', label: 'Det I tilbyder', pattern: /###\s*\d+\.\s*Menu\/Service [Hh]ighlights/i, primary: false },
  // 5. Content - Focus
  { key: 'focus', label: 'Hvad I typisk deler', pattern: /###\s*\d+\.\s*Content [Ff]ocus/i, primary: false },
  // 6. Content - Visual style
  { key: 'images', label: 'Billeder & stemning', pattern: /###\s*\d+\.\s*Image [Pp]references/i, primary: false },
  // 7. Guardrails
  { key: 'avoid', label: 'Undgå dette', pattern: /###\s*\d+\.\s*Things to [Aa]void/i, primary: false },
  // 8. Context - Location
  { key: 'location', label: 'Lokal forankring', pattern: /###\s*\d+\.\s*Location [Cc]ontext/i, primary: false },
  // 9. Context - Hours
  { key: 'hours', label: 'Åbningstider (kort)', pattern: /###\s*\d+\.\s*Opening [Hh]ours [Ss]ummary/i, primary: false },
  // 10. Goal (Primary)
  { key: 'goal', label: 'Formålet med jeres opslag', pattern: /###\s*\d+\.\s*Overall [Gg]oal/i, primary: true }
]

function parseBrandContext(context: string): Map<string, { summary: string; full: string }> {
  const sections = new Map<string, { summary: string; full: string }>()
  
  // Split by markdown headings (### 1., ### 2., etc.)
  const parts = context.split(/(?=###\s*\d+\.\s)/)
  
  for (const part of parts) {
    if (!part.trim()) continue
    
    // Find which category this belongs to
    for (const category of CATEGORIES) {
      if (category.pattern.test(part)) {
        // Extract content after the heading line
        const lines = part.split('\n').slice(1).filter(line => line.trim() && !line.startsWith('#'))
        
        // Clean full text - remove bullet markers and bold markdown
        const cleanedLines = lines.map(line => {
          return line
            .replace(/^[-*•]\s*\*\*/, '') // Remove "- **" or "* **" or "• **" at start
            .replace(/\*\*:/g, ':')       // Remove "**:" → ":"
            .replace(/\*\*\s/g, ' ')      // Remove "** " → " "
            .trim()
        })
        const full = cleanedLines.join('\n').trim()
        
        // Create summary - extract clean text without bullets/markdown
        let summary = ''
        
        // Find first non-bullet, non-list text
        for (const line of lines) {
          const cleanLine = line.trim()
          // Skip bullet points, dashes, asterisks at start
          if (cleanLine.startsWith('-') || cleanLine.startsWith('*') || cleanLine.startsWith('•')) {
            continue
          }
          // Skip lines that are just formatting
          if (cleanLine.startsWith('**') || cleanLine.length < 10) {
            continue
          }
          
          // Remove markdown formatting
          summary = cleanLine
            .replace(/\*\*/g, '') // Remove bold
            .replace(/\*/g, '')   // Remove italic
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links but keep text
            .trim()
          
          if (summary) break
        }
        
        // Fallback to first line if no clean text found
        if (!summary && lines.length > 0) {
          summary = lines[0].replace(/^[-*•]\s*/, '').replace(/\*\*/g, '').replace(/\*/g, '').trim()
        }
        
        // Limit to ~2 lines (about 160 chars)
        if (summary.length > 160) {
          // Try to break at a sentence or natural point
          const cutPoint = summary.substring(0, 157).lastIndexOf('.')
          if (cutPoint > 80) {
            summary = summary.substring(0, cutPoint + 1)
          } else {
            summary = summary.substring(0, 157) + '...'
          }
        }
        
        sections.set(category.key, { summary, full })
        break
      }
    }
  }
  
  return sections
}

export function BrandContextPanel({
  brandContext,
  isGenerating,
  generatedAt,
  approved,
  onGenerate,
  onEdit,
  onApprove
}: BrandContextPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContext, setEditedContext] = useState(brandContext || '')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  const handleSaveEdit = () => {
    onEdit(editedContext)
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditedContext(brandContext || '')
    setIsEditing(false)
  }

  const toggleSection = (key: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedSections(newExpanded)
  }

  // Format timestamp
  const formattedDate = generatedAt 
    ? new Date(generatedAt).toLocaleDateString('da-DK', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      })
    : null

  // Parse brand context into sections
  const sections = brandContext ? parseBrandContext(brandContext) : new Map()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI Brand Context
          </h3>
          {formattedDate && (
            <p className="text-xs text-gray-500 mt-1">
              Genereret {formattedDate}
              {approved && (
                <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Godkendt
                </span>
              )}
            </p>
          )}
        </div>

        {!brandContext && !isGenerating && (
          <button
            onClick={async () => {
              try {
                await onGenerate()
              } catch (err) {
                console.warn('Generate error caught in BrandContextPanel:', err)
              }
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generer Brand Context
          </button>
        )}
      </div>

      {isGenerating && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-full mb-3">
            <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h4 className="text-sm font-semibold text-gray-900 mb-1">
            Genererer Brand Context...
          </h4>
          <p className="text-xs text-gray-600">
            AI analyserer din forretning og skaber retningslinjer for indhold
          </p>
        </div>
      )}

      {!brandContext && !isGenerating && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Hvad er Brand Context?
              </h4>
              <p className="text-xs text-gray-600 leading-relaxed mb-3">
                Brand Context er AI's forståelse af din virksomhed. Det bruges til at skabe bedre indlæg, 
                der lyder som om de kommer fra netop din forretning - ikke en standard skabelon.
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong>Inkluderer:</strong> Tone of voice, målgruppe, menu highlights, indholdsretning, 
                billedstil, og hvad der skal undgås.
              </p>
            </div>
          </div>
        </div>
      )}

      {brandContext && !isEditing && (
        <div className="space-y-4">
          {/* Calming explanation */}
          <p className="text-sm text-gray-600">
            Dette bruges automatisk, når vi skriver opslag for dig. Du behøver ikke ændre noget.
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2">
            {!approved && (
              <button
                onClick={onApprove}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Godkend
              </button>
            )}
            <button
              onClick={() => {
                setEditedContext(brandContext)
                setIsEditing(true)
              }}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
            >
              Rediger
            </button>
            <button
              onClick={async () => {
                try {
                  await onGenerate()
                } catch (err) {
                  console.warn('Generate error caught in BrandContextPanel (regenerate):', err)
                }
              }}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
            >
              Generer igen
            </button>
          </div>

          {/* 2-column grid of category cards (1 column on mobile) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CATEGORIES.map((category) => {
              const section = sections.get(category.key)
              if (!section) return null

              const isExpanded = expandedSections.has(category.key)

              const isPrimary = category.primary

              return (
                <div 
                  key={category.key}
                  className={`rounded-lg p-4 space-y-2 ${
                    isPrimary 
                      ? 'bg-indigo-50 border-2 border-indigo-200' 
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  {/* Category title with icon badge */}
                  <h4 className={`text-sm flex items-center gap-2 ${
                    isPrimary 
                      ? 'font-bold text-gray-900' 
                      : 'font-semibold text-gray-800'
                  }`}>
                    <CategoryIcon type={category.key} isPrimary={isPrimary} />
                    {category.label}
                  </h4>

                  {/* Summary or full content */}
                  <div className="text-xs text-gray-700 leading-relaxed">
                    {isExpanded ? (
                      <div className="space-y-2">
                        {section.full.split('\n').map((line: string, i: number) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    ) : (
                      <div>{section.summary}</div>
                    )}
                  </div>

                  {/* Toggle button - light and optional */}
                  {section.full !== section.summary && (
                    <button
                      onClick={() => toggleSection(category.key)}
                      className="text-[11px] text-gray-500 hover:text-gray-700 font-normal flex items-center gap-1 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          Vis mindre
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
                          </svg>
                        </>
                      ) : (
                        <>
                          Vis mere
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isEditing && (
        <div className="bg-white border-2 border-indigo-300 rounded-lg overflow-hidden">
          <div className="p-4">
            <textarea
              value={editedContext}
              onChange={(e) => setEditedContext(e.target.value)}
              rows={20}
              className="w-full text-xs text-gray-700 font-mono border border-gray-300 rounded p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-end gap-2">
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Annuller
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Gem ændringer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
