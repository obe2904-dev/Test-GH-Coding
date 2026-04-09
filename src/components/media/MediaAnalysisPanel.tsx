import { useTranslation } from 'react-i18next'
import { useState, useEffect, useRef } from 'react'
import type { MediaAnalysis, Suggestion, HumanSuggestion } from './types'

// ─── Icon Components ──────────────────────────────────────────────────────────
const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 2l1.09 3.26L16 6.35l-2.91 1.09L12 11l-1.09-3.26L8 6.35l2.91-1.09z"/>
    <path d="M19 9l.69 2.07L22 11.76l-2.31.69L19 15l-.69-2.07L16 11.76l2.31-.69z"/>
    <path d="M5 18l.69 2.07L8 20.76l-2.31.69L5 24l-.69-2.07L2 20.76l2.31-.69z"/>
  </svg>
)

const Eraser = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M20 20H7L3.172 16.172a4 4 0 010-5.656l8-8a4 4 0 015.656 0l4 4a4 4 0 010 5.656L14 20h6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const Palette = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-1.078 1.648-2 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125 0-.926 1.082-1.648 2-1.648h1.17c3.515 0 6.367-2.853 6.367-6.367C22 7.387 17.613 2 12 2z" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="7" cy="10" r="1.5"/>
    <circle cx="12" cy="7" r="1.5"/>
    <circle cx="16.5" cy="10" r="1.5"/>
  </svg>
)

// ─── Types ────────────────────────────────────────────────────────────────────
interface MediaAnalysisPanelProps {
  analysis: MediaAnalysis
  tier: 'free' | 'standardplus' | 'premium'
  onApply?: (suggestionId: string) => void
  onApplyBatch?: (selectedIds: string[]) => void
  isProcessing?: boolean
  processingId?: string
  hasAdjustedVersion?: boolean
  mediaType?: 'image' | 'video'
  onUndo?: () => void
  canUndo?: boolean
  onEditText?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CATEGORIES: { key: Suggestion['category']; label: string; applyLabel: string }[] = [
  { key: 'cleaning', label: 'Rengøring & Fjernelse', applyLabel: 'Anvend rensning' },
  { key: 'color',    label: 'Farve & Tone',           applyLabel: 'Anvend farvekorr.' },
]

function getCategoryIcon(category: Suggestion['category'], className = 'w-4 h-4') {
  switch (category) {
    case 'cleaning': return <Eraser className={className} />
    case 'color':    return <Palette className={className} />
  }
}

function getCategoryTagColor(category: Suggestion['category']) {
  switch (category) {
    case 'cleaning': return 'bg-green-100 text-green-700'
    case 'color':    return 'bg-purple-100 text-purple-700'
  }
}

function getRatingColors(rating: string) {
  switch (rating) {
    case 'excellent': return 'bg-green-100 text-green-700'
    case 'good':      return 'bg-blue-100 text-blue-700'
    case 'fair':      return 'bg-yellow-100 text-yellow-700'
    default:          return 'bg-red-100 text-red-700'
  }
}

function getRecommendationColors(recommendation: string) {
  switch (recommendation) {
    case 'post-it':     return 'bg-green-100 text-green-700'
    case 'good-enough': return 'bg-blue-100 text-blue-700'
    case 'quick-fix':   return 'bg-yellow-100 text-yellow-700'
    default:            return 'bg-red-100 text-red-700'
  }
}

// ─── Suggestion Card ──────────────────────────────────────────────────────────
function SuggestionCard({
  suggestion,
  isSelected,
  isApplied,
  isThisProcessing,
  isProcessing,
  onToggle,
}: {
  suggestion: Suggestion
  isSelected: boolean
  isApplied: boolean
  isThisProcessing: boolean
  isProcessing: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      disabled={isProcessing || isApplied}
      className={[
        'w-full p-3 rounded-lg text-left transition-all duration-150 border',
        isApplied
          ? 'border-green-300 bg-green-50 cursor-default'
          : isSelected
          ? 'border-blue-400 bg-blue-50'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
        isProcessing && !isApplied ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div className={[
          'flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center',
          isApplied
            ? 'bg-green-500 border-green-500'
            : isSelected
            ? 'bg-blue-500 border-blue-500'
            : 'border-slate-300 bg-white',
        ].join(' ')}>
          {(isApplied || isSelected) && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
          {isThisProcessing
            ? <div className="w-3.5 h-3.5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
            : getCategoryIcon(suggestion.category, 'w-3.5 h-3.5 text-slate-600')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs font-semibold text-slate-900">{suggestion.title}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getCategoryTagColor(suggestion.category)}`}>
              {CATEGORIES.find(c => c.key === suggestion.category)?.label ?? suggestion.category}
            </span>
          </div>
          <p className="text-xs text-slate-500">{suggestion.reason}</p>
        </div>
      </div>
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MediaAnalysisPanel({
  analysis,
  tier,
  onApply,
  onApplyBatch,
  isProcessing = false,
  processingId,
  hasAdjustedVersion = false,
  mediaType,
  onUndo,
  canUndo = false,
  onEditText,
}: MediaAnalysisPanelProps) {
  const { t } = useTranslation()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [copiedRewrite, setCopiedRewrite] = useState(false)

  function getRatingLabel(rating: string) {
    return t(`createPost.photoAnalysis.ratings.${rating}`, rating)
  }

  // Reset when suggestions change (new analysis).
  // Smart (standardplus): pre-select all suggestions so the user can tap once to apply.
  // Pro (premium): no pre-selection — user curates their own list.
  const suggestionKey = analysis.suggestions.map(s => s.id).join(',')
  const [prevKey, setPrevKey] = useState(suggestionKey)
  if (suggestionKey !== prevKey) {
    setPrevKey(suggestionKey)
    setAppliedIds(new Set())
    if (tier === 'standardplus') {
      // Pre-select only objective hygiene fixes (remove_object, reduce_smudge).
      // Color and clutter are taste-dependent — user opts in manually.
      const preIds = new Set(
        [...analysis.suggestions]
          .filter(s => s.action === 'remove_object' || s.action === 'reduce_smudge')
          .slice(0, 3)
          .map(s => s.id)
      )
      setSelectedIds(preIds)
    } else {
      setSelectedIds(new Set())
    }
  }

  // Sort: color last. Pro receives up to 6 suggestions from the backend; Smart/Free receive up to 3/2.
  const suggestionCap = tier === 'premium' ? 6 : 3
  const sortedSuggestions = [...analysis.suggestions]
    .sort((a, b) =>
      a.category === 'color' && b.category !== 'color' ? 1
      : a.category !== 'color' && b.category === 'color' ? -1
      : 0
    )
    .slice(0, suggestionCap)

  // ── Smart / Pro top cards ─────────────────────────────────────────────────
  const toggleCard = (id: string) => {
    if (isProcessing || appliedIds.has(id)) return
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  // When processing finishes: lock applied suggestions, clear selection
  const prevIsProcessing = useRef(isProcessing)
  useEffect(() => {
    if (prevIsProcessing.current && !isProcessing) {
      setAppliedIds(prev => new Set([...prev, ...selectedIds]))
      setSelectedIds(new Set())
    }
    prevIsProcessing.current = isProcessing
  }, [isProcessing])

  // When the AI-enhanced version is deleted: unlock all applied suggestions
  const prevHasAdjustedVersion = useRef(hasAdjustedVersion)
  useEffect(() => {
    if (prevHasAdjustedVersion.current && !hasAdjustedVersion) {
      setAppliedIds(new Set())
    }
    prevHasAdjustedVersion.current = hasAdjustedVersion
  }, [hasAdjustedVersion])

  const handleApplyCards = () => {
    if (isProcessing || selectedIds.size === 0) return
    if (onApplyBatch) {
      onApplyBatch(Array.from(selectedIds))
    } else if (onApply) {
      for (const id of selectedIds) onApply(id)
      setSelectedIds(new Set())
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Layer 1: Assessment ──────────────────────────────────────────── */}
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
        {analysis.recommendation && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              {t('createPost.photoAnalysis.assessmentTitle', 'Vurdering')}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getRecommendationColors(analysis.recommendation)}`}>
              {t(`createPost.photoAnalysis.recommendations.${analysis.recommendation}`, analysis.recommendation)}
            </span>
          </div>
        )}
        {analysis.recommendationText && (
          <p className="text-xs font-medium text-slate-800 leading-relaxed">{analysis.recommendationText}</p>
        )}
        <p className="text-xs text-slate-600 leading-relaxed">{analysis.generalFeedback}</p>
      </div>

      {/* ── whatWorks ───────────────────────────────────────────────────── */}
      {analysis.whatWorks && analysis.whatWorks.length > 0 && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="text-xs font-semibold text-green-800 mb-2">
            ✅ {t('createPost.photoAnalysis.whatWorks', 'Hvad der virker godt')}
          </h4>
          {analysis.whatWorks.map((item, idx) => (
            <p key={idx} className="text-xs text-green-700 leading-relaxed">• {item}</p>
          ))}
        </div>
      )}

      {/* ── Layer 2: Human actions ───────────────────────────────────────── */}
      {/* Only rendered when there is something only the human can address */}
      {(
        (analysis.contentMatch && analysis.contentMatch.actionNeeded && analysis.contentMatch.actionNeeded !== 'none') ||
        // fallback for old responses without actionNeeded
        (analysis.contentMatch && !analysis.contentMatch.actionNeeded && (analysis.contentMatch.rating === 'fair' || analysis.contentMatch.rating === 'poor')) ||
        !!analysis.emojiMatch ||
        (analysis.humanSuggestions && analysis.humanSuggestions.length > 0)
      ) && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
          <h4 className="text-xs font-semibold text-amber-800">
            💡 {t('createPost.photoAnalysis.humanActionsTitle', 'Til dig')}
          </h4>

          {/* Content match action card */}
          {analysis.contentMatch && (analysis.contentMatch.actionNeeded === 'rewrite' || analysis.contentMatch.actionNeeded === 'choice' ||
            (!analysis.contentMatch.actionNeeded && (analysis.contentMatch.rating === 'fair' || analysis.contentMatch.rating === 'poor'))) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-amber-800">
                  {t('createPost.photoAnalysis.contentMatch', 'Indhold match')}
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${getRatingColors(analysis.contentMatch.rating)}`}>
                  {getRatingLabel(analysis.contentMatch.rating)}
                </span>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">{analysis.contentMatch.feedback}</p>

              {/* Rewrite path */}
              {analysis.contentMatch.rewriteSuggestion && (
                <div className="mt-1 space-y-1">
                  <p className="text-[10px] font-semibold text-amber-800">
                    {t('createPost.photoAnalysis.contentMatchActions.rewriteSuggestionLabel', 'Foreslået tekst:')}
                  </p>
                  <p className="text-xs text-amber-900 bg-amber-100 rounded p-2 leading-relaxed italic">
                    {analysis.contentMatch.rewriteSuggestion}
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(analysis.contentMatch!.rewriteSuggestion!)
                        setCopiedRewrite(true)
                        setTimeout(() => setCopiedRewrite(false), 2000)
                      }}
                      className="text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 transition-colors duration-150"
                    >
                      {copiedRewrite
                        ? t('createPost.photoAnalysis.contentMatchActions.copiedButton', 'Kopiéret!')
                        : t('createPost.photoAnalysis.contentMatchActions.copyButton', 'Kopiér')}
                    </button>
                    {onEditText && (
                      <button
                        onClick={onEditText}
                        className="text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 transition-colors duration-150"
                      >
                        ✏️ {t('createPost.photoAnalysis.contentMatchActions.rewriteButton', 'Rediger tekst')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Reshoot path — only when actionNeeded = 'choice' */}
              {analysis.contentMatch.actionNeeded === 'choice' && analysis.contentMatch.reshootGuidance && (
                <div className="mt-2 pt-2 border-t border-amber-200 space-y-1">
                  <p className="text-[10px] font-semibold text-amber-800">
                    {t('createPost.photoAnalysis.contentMatchActions.reshootLabel', 'Eller tag et nyt foto')}
                  </p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    {t('createPost.photoAnalysis.contentMatchActions.reshootGuidanceLabel', 'Hvad skal fotograferes:')} {analysis.contentMatch.reshootGuidance}
                  </p>
                </div>
              )}

              {/* Fallback edit button for old responses without rewriteSuggestion */}
              {!analysis.contentMatch.rewriteSuggestion && onEditText && (
                <button
                  onClick={onEditText}
                  className="mt-1 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 transition-colors duration-150"
                >
                  ✏️ {t('createPost.photoAnalysis.contentMatchActions.rewriteButton', 'Rediger tekst')}
                </button>
              )}
            </div>
          )}

          {analysis.emojiMatch && (
            <p className="text-xs text-amber-700 leading-relaxed">🔤 {analysis.emojiMatch}</p>
          )}
          {analysis.humanSuggestions && analysis.humanSuggestions.length > 0 && (
            analysis.humanSuggestions.map((item: HumanSuggestion, idx: number) => (
              <p key={idx} className="text-xs text-amber-700 leading-relaxed">• {item.text}</p>
            ))
          )}
        </div>
      )}

      {/* ── Layer 3: AI actions ──────────────────────────────────────────── */}
      <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Sparkles className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              {t('createPost.photoAnalysis.aiEnhancementsTitle', 'AI Forbedringer')}
            </h3>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed pl-6">
            {t('createPost.photoAnalysis.aiEnhancementsSubline', 'AI kan fjerne, justere og rette — aldrig tilføje')}
          </p>
          <p className="text-[10px] text-slate-400 leading-relaxed pl-6 mt-0.5">
            {t('createPost.photoAnalysis.aiEnhancementsHelper', 'Afprøv de forslag, der ser bedst ud — resultatet varierer fra billede til billede.')}
          </p>
        </div>

        {sortedSuggestions.length > 0 && mediaType !== 'video' ? (
          <>
            {/* FREE: bullet list */}
            {tier === 'free' && (
              <div className="space-y-2 pt-1">
                {sortedSuggestions.map((s, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-slate-400 text-xs mt-0.5 flex-shrink-0">•</span>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      <span className="font-medium text-slate-800">{s.title}</span>
                      {s.reason ? ` — ${s.reason}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* SMART + PRO: suggestion cards grouped by category */}
            {(tier === 'standardplus' || tier === 'premium') && (
              <div className="space-y-4 pt-1">
                {CATEGORIES.map(({ key, label }) => {
                  const group = sortedSuggestions.filter(s => s.category === key)
                  if (group.length === 0) return null
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        {getCategoryIcon(key, 'w-3 h-3 text-slate-400')}
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
                      </div>
                      {group.map(s => (
                        <SuggestionCard
                          key={s.id}
                          suggestion={s}
                          isSelected={selectedIds.has(s.id)}
                          isApplied={appliedIds.has(s.id)}
                          isThisProcessing={isProcessing && processingId === s.id}
                          isProcessing={isProcessing}
                          onToggle={() => toggleCard(s.id)}
                        />
                      ))}
                    </div>
                  )
                })}
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleApplyCards}
                    disabled={isProcessing}
                    className={[
                      'mt-1 w-full py-2.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors duration-150',
                      isProcessing
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer',
                    ].join(' ')}
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Anvender ændringer…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>
                          {tier === 'standardplus'
                            ? 'Anvend AI-forbedringer'
                            : `Anvend ${selectedIds.size} forbedring${selectedIds.size !== 1 ? 'er' : ''}`}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-400 italic">
            {mediaType === 'video'
              ? t('createPost.photoAnalysis.emptyState.video', 'AI-forbedringer er ikke tilgængelige for video.')
              : analysis.recommendation === 'retake'
              ? t('createPost.photoAnalysis.emptyState.retake', 'AI-redigering kan ikke løse de tekniske udfordringer der kræver et nyt foto.')
              : analysis.recommendation === 'good-enough'
              ? t('createPost.photoAnalysis.emptyState.goodEnough', 'Billedet ser godt ud. Ingen AI-justeringer ville gøre en meningsfuld forskel.')
              : t('createPost.photoAnalysis.emptyState.postIt', 'Billedet er klar til opslag — ingen AI-forbedringer nødvendige.')}
          </p>
        )}

        {/* Undo — always visible when an AI-enhanced version exists, regardless of suggestions */}
        {canUndo && onUndo && (
          <button
            onClick={onUndo}
            disabled={isProcessing}
            className="mt-1 w-full py-2 px-4 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-slate-200 transition-colors duration-150 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6M3 10l6-6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('createPost.photoAnalysis.undoEnhancement', 'Fortryd seneste AI-forbedring')}
          </button>
        )}
      </div>
    </div>
  )
}
