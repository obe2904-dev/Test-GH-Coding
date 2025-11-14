import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePostCreationStore, GeneratedIdea } from '../../stores/postCreationStore'

interface IdeasStepProps {
  onNext: (selectedIdea: string) => void
  selectedPlatforms: string[]
}

// Icon Components
const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 3v18m0-18l-3 3m3-3l3 3m-3 15l-3-3m3 3l3-3m6-9H3m18 0l-3-3m3 3l-3 3M3 12l3-3m-3 3l3 3"/>
  </svg>
)

const Lightbulb = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M9 18h6M10 22h4M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
    <path d="M8.5 14C7 13 6 11.5 6 10a6 6 0 1 1 12 0c0 1.5-1 3-2.5 4"/>
  </svg>
)

const Check = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

const TrendingUp = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
)

const Clock = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)

const Camera = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

const Wand = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/>
  </svg>
)

export function IdeasStep({ onNext, selectedPlatforms }: IdeasStepProps) {
  const { t } = useTranslation()
  const { 
    aiIdeas, 
    selectedIdea, 
    setIdeas, 
    setAiIdeas, 
    setSelectedIdea 
  } = usePostCreationStore()
  
  const [topicInput, setTopicInput] = useState('')
  const [userGeneratedIdeas, setUserGeneratedIdeas] = useState<GeneratedIdea[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const generateIdeas = async () => {
    if (!topicInput.trim()) return
    
    setIsGenerating(true)
    
    // Simulate AI idea generation - replace with actual AI call
    setTimeout(() => {
      const mockIdeas: GeneratedIdea[] = [
        {
          id: 'user1',
          title: `Opslag om ${topicInput}`,
          description: `Tag et billede relateret til ${topicInput} - vis produktet eller situationen i aktion.`,
          headline: `✨ ${topicInput}`,
          text: `Vi har noget spændende at dele om ${topicInput}! Kom forbi og oplev det selv.`
        }
      ]
      setUserGeneratedIdeas(mockIdeas)
      setIdeas(mockIdeas)
      setIsGenerating(false)
    }, 2000)
  }

  const generateAiIdeas = () => {
    const predefinedIdeas: GeneratedIdea[] = [
      {
        id: 'ai1',
        title: 'Ugens frokosttilbud',
        description: 'Tag et oversigtsillede af tallerkenen og et glas vand på træbord.',
        headline: 'Ugens frokosttilbud 🍽️',
        text: 'Ugens frokosttilbud er klar – kom forbi og smag. Vi glæder os til at høre, hvad du synes!'
      },
      {
        id: 'ai2',
        title: 'Spørgsmål til fællesskabet',
        description: 'Fang tre kager på række set skråt oppefra.',
        headline: 'Hjælp os med at vælge! 🤔',
        text: 'Hjælp os: Hvilken kage skal vi bage i morgen – gullerod, brownie eller citron?'
      },
      {
        id: 'ai3',
        title: 'Læringstip',
        description: 'Fotografér brød, skåret over, med krumme i fokus (macro).',
        headline: 'Vidste du det? 💡',
        text: 'Vidste du, at groft surdejsbrød mætter længere? Kom forbi og smag vores nye variant.'
      }
    ]
    setAiIdeas(predefinedIdeas)
  }

  const handleIdeaSelect = (ideaId: string) => {
    setSelectedIdea(ideaId)
  }

  const handleNext = () => {
    if (selectedIdea) {
      onNext(selectedIdea)
    } else {
      onNext('')
    }
  }

  const getEngagementLevel = (index: number) => {
    return index % 2 === 0 ? 'High' : 'Medium'
  }

  const getOptimalTime = (index: number) => {
    return `${11 + index}:00`
  }

  const IdeaCard = ({ idea, isUserGenerated = false, index = 0 }: { 
    idea: GeneratedIdea, 
    isUserGenerated?: boolean, 
    index?: number 
  }) => {
    const isSelected = selectedIdea === idea.id
    const engagement = getEngagementLevel(index)
    const time = getOptimalTime(index)
    
    const borderColor = isUserGenerated 
      ? (isSelected ? 'border-indigo-500' : 'border-slate-200') 
      : (isSelected ? 'border-purple-500' : 'border-slate-200')
    const bgColor = isUserGenerated
      ? (isSelected ? 'bg-indigo-50' : 'bg-white')
      : (isSelected ? 'bg-purple-50' : 'bg-white')

    return (
      <div
        onClick={() => handleIdeaSelect(idea.id)}
        className={`cursor-pointer rounded-lg border-2 p-6 transition-all transform hover:scale-[1.02] hover:shadow-lg ${borderColor} ${bgColor}`}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-800 mb-1">{idea.title}</h3>
            <p className="text-sm text-slate-600">{idea.headline}</p>
          </div>
          <div className="flex flex-col items-end gap-1 ml-4">
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              <span className={`font-semibold ${
                engagement === 'High' ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                {engagement}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              <span>kl. {time}</span>
            </div>
          </div>
        </div>

        {/* Main text */}
        <div className="mb-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            {idea.text}
          </p>
        </div>

        {/* Photo suggestion */}
        <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg mb-3">
          <Camera className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-1">{t('createPost.ideas.photoIdea')}:</p>
            <p className="text-xs text-slate-600">{idea.description}</p>
          </div>
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <div className={`pt-3 border-t flex items-center gap-2 ${
            isUserGenerated ? 'border-indigo-200' : 'border-purple-200'
          }`}>
            <div className={`${
              isUserGenerated ? 'bg-indigo-600' : 'bg-purple-600'
            } text-white rounded-full p-1`}>
              <Check className="w-3 h-3" />
            </div>
            <span className={`text-sm font-semibold ${
              isUserGenerated ? 'text-indigo-700' : 'text-purple-700'
            }`}>
              {t('createPost.ideas.selected')}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Custom Topic Section */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Lightbulb className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {t('createPost.ideas.whatToPost')}
            </h3>
          </div>
          <button
            onClick={generateIdeas}
            disabled={!topicInput.trim() || isGenerating}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium flex items-center gap-2 shadow-md"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{t('createPost.ideas.generating')}</span>
              </>
            ) : (
              <>
                <Wand className="w-4 h-4" />
                <span>{t('createPost.ideas.generateIdeas')}</span>
              </>
            )}
          </button>
        </div>
        
        {/* Input Area */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-lg p-4">
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && generateIdeas()}
            placeholder={t('createPost.ideas.topicPlaceholder')}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
          
          {/* Generated User Idea */}
          {userGeneratedIdeas.length > 0 && (
            <div className="mt-4">
              <IdeaCard idea={userGeneratedIdeas[0]} isUserGenerated={true} />
            </div>
          )}
        </div>
      </div>

      {/* AI Ideas Section */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {t('createPost.ideas.aiIdeas')}
            </h3>
          </div>
          {aiIdeas.length === 0 ? (
            <button
              onClick={generateAiIdeas}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all text-sm font-medium flex items-center gap-2 shadow-md"
            >
              <Wand className="w-4 h-4" />
              <span>{t('createPost.ideas.generateAiIdeas')}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {t('createPost.ideas.dailyLimit')} (2/3)
              </span>
              <button
                onClick={() => setAiIdeas([
                  ...aiIdeas,
                  {
                    id: `ai${aiIdeas.length + 1}`,
                    title: 'Ny AI idé',
                    description: 'Dette er en ekstra AI-genereret idé for premium brugere.',
                    headline: '🎯 Premium AI idé',
                    text: 'Dette er premium indhold genereret af vores avancerede AI system.\n\nKun tilgængeligt for Premium brugere! ⭐\n\n#premium #ai #exclusive'
                  }
                ])}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all text-xs font-medium shadow"
              >
                {t('createPost.ideas.generateMore')}
              </button>
            </div>
          )}
        </div>

        {aiIdeas.length === 0 ? (
          <div className="text-center py-8">
            <div className="bg-purple-50 rounded-full p-4 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-sm text-slate-600">
              {t('createPost.ideas.aiIdeasDescription')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {aiIdeas.map((idea, index) => (
              <IdeaCard key={idea.id} idea={idea} index={index} />
            ))}
          </div>
        )}
      </div>

      {/* Info Banner */}
      {selectedIdea && (
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg p-4 text-white shadow-lg">
          <div className="flex items-start gap-3">
            <div className="bg-white/20 backdrop-blur p-2 rounded-lg flex-shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">{t('createPost.ideas.ideaSelected', 'Idé valgt!')}</h4>
              <p className="text-sm text-emerald-50 leading-relaxed">
                {t('createPost.ideas.ideaSelectedDescription', 'Din valgte idé er klar. Klik på "Næste" for at tilpasse indholdet til hver platform.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="py-6">
        <div className="flex justify-end">
          <button
            onClick={handleNext}
            className="px-8 py-3 text-base font-medium text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-2"
          >
            <span>{t('createPost.ideas.next')}</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Selected Platforms Info */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
        <p className="text-xs text-slate-600 text-center">
          {t('createPost.ideas.selectedPlatforms')}: <span className="font-semibold">{selectedPlatforms.join(', ')}</span>
        </p>
      </div>
    </div>
  )
}