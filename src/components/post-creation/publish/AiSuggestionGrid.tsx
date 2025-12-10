import type { ComponentType } from 'react'
import { Sparkles } from './icons'

export interface AiSuggestion {
  id: number
  time: string
  date: Date
  reason: string
  expectedReach: string
  icon: ComponentType<{ className?: string }>
  color?: string
}

interface AiSuggestionGridProps {
  suggestions: AiSuggestion[]
  selectedId: number | null
  title: string
  onSelect: (suggestion: AiSuggestion) => void
}

export function AiSuggestionGrid({
  suggestions,
  selectedId,
  title,
  onSelect
}: AiSuggestionGridProps) {
  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-4 h-4 text-purple-600" />
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {suggestions.map((suggestion) => {
          const Icon = suggestion.icon
          const isSelected = selectedId === suggestion.id

          return (
            <button
              key={suggestion.id}
              onClick={() => onSelect(suggestion)}
              className={`p-2 rounded-lg border transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col items-center gap-1.5 text-center">
                <Icon className={`w-5 h-5 ${isSelected ? 'text-purple-600' : 'text-slate-600'}`} />
                <div>
                  <p className="text-xs font-bold text-slate-800">{suggestion.time}</p>
                  <p className="text-xs text-slate-600 leading-tight">{suggestion.reason}</p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    suggestion.expectedReach === 'High'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {suggestion.expectedReach}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
