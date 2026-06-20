import { useTranslation } from 'react-i18next'
import { IdeaCard } from '../shared/IdeaCard'

// Icon Components
const Wand = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/>
  </svg>
)

const Lightbulb = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M9 18h6M10 22h4M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
    <path d="M8.5 14C7 13 6 11.5 6 10a6 6 0 1 1 12 0c0 1.5-1 3-2.5 4"/>
  </svg>
)

interface CustomIdeasModeProps {
  websiteUrl: string
  customIdea: any
  isGenerating: boolean
  selectedIdea: string | null
  onWebsiteUrlChange: (value: string) => void
  onAnalyzeWebsite: () => void
  onSelectIdea: (idea: any) => void
}

export const CustomIdeasMode: React.FC<CustomIdeasModeProps> = ({
  websiteUrl,
  customIdea,
  isGenerating,
  selectedIdea,
  onWebsiteUrlChange,
  onAnalyzeWebsite,
  onSelectIdea
}) => {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="url"
          value={websiteUrl}
          onChange={(e) => onWebsiteUrlChange(e.target.value)}
          placeholder={t('generate.urlPlaceholder', 'Enter your website URL (e.g., https://yourbusiness.com)')}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cta focus:border-cta text-sm"
          onKeyPress={(e) => e.key === 'Enter' && onAnalyzeWebsite()}
        />
        <button
          onClick={onAnalyzeWebsite}
          disabled={isGenerating || !websiteUrl.trim()}
          className="px-4 py-2 bg-cta text-text-inverse rounded-lg hover:bg-cta-hover disabled:opacity-40 transition-all text-sm font-medium shadow-md flex items-center gap-2 justify-center whitespace-nowrap"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </>
          ) : (
            <>
              <Wand className="w-4 h-4" />
              <span>{t('generate.analyze', 'Analyze')}</span>
            </>
          )}
        </button>
      </div>

      {customIdea && (
        <IdeaCard
          key={customIdea.id}
          idea={customIdea}
          isSelected={selectedIdea === customIdea.id}
          onSelect={() => onSelectIdea(customIdea)}
          type="custom"
        />
      )}

      <div className="bg-gray-50 rounded-lg border border-gray-200 p-2">
        <p className="text-xs text-[#6B7280] flex items-start gap-1.5">
          <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            {t('generate.urlTip', 'Tip: AI will analyze your website to understand your business and generate relevant post ideas. Available for all tiers.')}
          </span>
        </p>
      </div>
    </div>
  )
}