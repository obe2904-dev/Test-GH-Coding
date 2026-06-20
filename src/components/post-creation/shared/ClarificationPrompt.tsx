import { Sparkles } from '../../icons/PostCreationIcons'

interface ClarificationPromptProps {
  question: string
  inputValue: string
  onInputChange: (value: string) => void
  onSubmit: () => void
  onDismiss: () => void
}

export function ClarificationPrompt({
  question,
  inputValue,
  onInputChange,
  onSubmit,
  onDismiss
}: ClarificationPromptProps) {
  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSubmit()
    }
  }

  return (
    <div className="mt-2 border-l-4 border-l-gray-200 border border-gray-200 bg-gray-50 rounded-xl py-2 px-3 animate-slideDown">
      <div className="mb-2">
        <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
          AI kan gøre dit opslag endnu bedre
        </p>
      </div>
      <div className="flex items-start gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-[#1F2937] font-medium">
          {question}
        </p>
      </div>

      <input
        type="text"
        value={inputValue}
        onChange={(event) => onInputChange(event.target.value)}
        placeholder="Skriv 1-2 ord..."
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-mint mb-2"
        onKeyDown={(event) => {
          if (event.key === 'Enter' && inputValue.trim()) {
            event.preventDefault()
            handleSubmit()
          }
        }}
      />

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!inputValue.trim()}
          className="px-3 py-1.5 bg-cta text-text-inverse rounded-lg text-xs font-medium hover:bg-cta-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Opdater tekst
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 bg-white border border-slate-200 text-[#6B7280] rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
        >
          Behold teksten som den er
        </button>
      </div>
    </div>
  )
}
