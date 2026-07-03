import { useTranslation } from 'react-i18next'
import { IdeaCard } from '../shared/IdeaCard'

// Icon Components
const Wand = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/>
  </svg>
)

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 3v18m0-18l-3 3m3-3l3 3m-3 15l-3-3m3 3l3-3m6-9H3m18 0l-3-3m3 3l-3 3M3 12l3-3m-3 3l3 3"/>
  </svg>
)

interface AIIdeasModeProps {
  aiIdeas: any[]
  isGenerating: boolean
  selectedIdea: string | null
  onGenerateIdeas: () => void
  onGenerateIdeasV3?: () => void
  onSelectIdea: (idea: any) => void
}

export const AIIdeasMode: React.FC<AIIdeasModeProps> = ({
  aiIdeas,
  isGenerating,
  selectedIdea,
  onGenerateIdeas,
  onGenerateIdeasV3,
  onSelectIdea
}) => {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      {aiIdeas.length === 0 ? (
        <div className="text-center py-6">
          <div className="bg-[#F5F3FF] rounded-full p-3 w-12 h-12 mx-auto mb-2 flex items-center justify-center">
            <Wand className="w-6 h-6 text-purple-600" />
          </div>
          <p className="text-sm text-[#6B7280] mb-3">
            {t('generate.noIdeasYet', 'Click below to generate AI ideas')}
          </p>
          <div className="flex flex-col gap-2 items-center">
            <button
              onClick={onGenerateIdeas}
              disabled={isGenerating}
              className="px-4 py-2 bg-cta text-text-inverse rounded-lg hover:bg-cta-hover disabled:opacity-40 transition-all text-sm font-medium shadow-md flex items-center gap-1.5"
            >
              {isGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t('generate.generating', 'Generating...')}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('generate.generateIdeas', 'Generate 3 AI Ideas')}</span>
                </>
              )}
            </button>

            {onGenerateIdeasV3 && (
              <button
                onClick={onGenerateIdeasV3}
                disabled={isGenerating}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
              >
                {t('generate.tryNewGenerator', 'Try new generator (v3)')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Grid layout for ideas - 3 columns side by side */}
          <div className="grid grid-cols-3 gap-3">
            {aiIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                isSelected={selectedIdea === idea.id}
                onSelect={() => onSelectIdea(idea)}
                type="ai"
              />
            ))}
          </div>
          <button
            onClick={onGenerateIdeas}
            disabled={isGenerating}
            className="w-full px-3 py-1.5 bg-slate-100 text-[#1F2937] rounded-lg hover:bg-slate-200 transition-all text-sm font-medium"
          >
            {t('generate.generateMore', '🔄 Generer flere ideer')}
          </button>
        </div>
      )}
    </div>
  )
}