/**
 * CaptionEditModal
 *
 * Pop-up text editor for the Design step.
 * - Smart + Pro: edit text + spell check (same state machine as Skriv Selv)
 * - Pro only: length and tone AI adjustments
 *
 * State machine (mirrors GenerateStep exactly):
 *   isEdited: false on open → true on keystroke → false after successful spell check
 *   isSpellingChecked: false on open → true after spell check → false on next keystroke
 *   Spell check button: disabled when !isEdited OR isSpellChecking
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSpellingCheck } from '../../../hooks/useSpellingCheck'

// ─── Icons ──────────────────────────────────────────────────────────────────

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const SpellCheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

const Spinner = ({ className }: { className?: string }) => (
  <div className={`rounded-full border-2 border-current border-t-transparent animate-spin ${className}`} />
)

// ─── Types ───────────────────────────────────────────────────────────────────

interface CaptionEditModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called with the final, confirmed text when the user saves. Second arg is true when owner checked "save as voice example". */
  onSave: (newText: string, saveAsExample?: boolean) => void
  initialText: string
  currentTier: string
  language: string
  /** Business ID — passed to ai-enhance so it can resolve business profile & language context. */
  businessId?: string
}

type LengthAdjust = 'shorter' | 'longer' | null
type ToneAdjust = 'looser' | 'more_serious' | null

// ─── Component ───────────────────────────────────────────────────────────────

export function CaptionEditModal({
  isOpen,
  onClose,
  onSave,
  initialText,
  currentTier,
  language,
  businessId,
}: CaptionEditModalProps) {
  const { i18n } = useTranslation()
  // Use startsWith to handle both 'da' and 'da-DK' locale variants
  const isDanish = i18n.language.startsWith('da')

  const isPro = currentTier === 'premium' || currentTier === 'standardplus'

  // ── Local text state ────────────────────────────────────────────────────────
  const [editedText, setEditedText] = useState(initialText)

  // ── Spell check state (mirrors Skriv Selv exactly) ──────────────────────────
  const [isEdited, setIsEdited] = useState(false)
  const [isSpellingChecked, setIsSpellingChecked] = useState(false)
  const { isChecking: isSpellChecking, checkSpelling } = useSpellingCheck()

  // ── Pro: length / tone adjustment state ─────────────────────────────────────
  const [lengthAdjust, setLengthAdjust] = useState<LengthAdjust>(null)
  const [toneAdjust, setToneAdjust] = useState<ToneAdjust>(null)
  const [isAIAdjusting, setIsAIAdjusting] = useState(false)

  // ── Voice example save option ────────────────────────────────────────────────
  const [saveAsVoiceExample, setSaveAsVoiceExample] = useState(false)

  // ── Reset all state when modal opens or initialText changes ─────────────────
  useEffect(() => {
    if (isOpen) {
      setEditedText(initialText)
      setIsEdited(false)
      setIsSpellingChecked(false)
      setLengthAdjust(null)
      setToneAdjust(null)
      setIsAIAdjusting(false)
      setSaveAsVoiceExample(false)
    }
  }, [isOpen, initialText])

  // ── Text change handler – exact Skriv Selv pattern ──────────────────────────
  const handleTextChange = useCallback((value: string) => {
    setEditedText(value)
    setIsEdited(true)
    setIsSpellingChecked(false)
  }, [])

  // ── Spell check ─────────────────────────────────────────────────────────────
  const handleSpellingCheck = useCallback(async () => {
    if (!isEdited || isSpellChecking) return

    const result = await checkSpelling({
      text: editedText,
      language: language.startsWith('da') ? 'da' : language.startsWith('sv') ? 'sv' : language.startsWith('de') ? 'de' : 'en',
      onError: () => {
        // useSpellingCheck already alerts on error
      },
    })

    if (result?.text) {
      // Mirror exact state machine: checked=true, edited=false
      setEditedText(result.text)
      setIsSpellingChecked(true)
      setIsEdited(false)
    }
  }, [isEdited, isSpellChecking, editedText, language, checkSpelling])

  // ── Pro: AI length / tone adjustment ────────────────────────────────────────
  const handleAIAdjust = useCallback(async () => {
    if (!isPro || isAIAdjusting) return
    if (!lengthAdjust && !toneAdjust) return
    if (!businessId) return

    setIsAIAdjusting(true)
    try {
      const response = await fetch(import.meta.env.VITE_SUPABASE_FUNCTION_ADJUST_TEXT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          businessId,
          currentText: editedText,
          toneAdjust,
          lengthAdjust,
          tier: currentTier,
        }),
      })

      if (!response.ok) {
        throw new Error('AI adjustment failed')
      }

      const data = await response.json()
      if (data?.text) {
        setEditedText(data.text)
        setIsEdited(true)
        setIsSpellingChecked(false)
        setLengthAdjust(null)
        setToneAdjust(null)
      }
    } catch (err) {
      console.error('[CaptionEditModal] AI adjustment error:', err)
      const msg = isDanish
        ? 'AI-tilpasning mislykkedes. Prøv igen.'
        : 'AI adjustment failed. Please try again.'
      alert(msg)
    } finally {
      setIsAIAdjusting(false)
    }
  }, [isPro, isAIAdjusting, lengthAdjust, toneAdjust, editedText, isDanish, currentTier, businessId])

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    onSave(editedText.trim(), saveAsVoiceExample)
    onClose()
  }, [editedText, saveAsVoiceExample, onSave, onClose])

  // ── Keyboard: Escape closes, Ctrl+Enter saves ────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose, handleSave])

  if (!isOpen) return null

  const isBusy = isSpellChecking || isAIAdjusting

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isDanish ? 'Rediger tekst' : 'Edit caption'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label={isDanish ? 'Luk' : 'Close'}
          >
            ✕
          </button>
        </div>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Textarea */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {isDanish ? 'Tekst' : 'Caption'}
            </label>
            <textarea
              value={editedText}
              onChange={(e) => handleTextChange(e.target.value)}
              disabled={isBusy}
              rows={8}
              className="w-full text-sm text-gray-900 leading-relaxed border border-gray-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-cta focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder={isDanish ? 'Skriv din tekst her…' : 'Write your caption here…'}
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {editedText.length} {isDanish ? 'tegn' : 'chars'}
            </p>
          </div>

          {/* Spell check row */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSpellingCheck}
              disabled={!isEdited || isSpellChecking || isAIAdjusting}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                isSpellingChecked
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {isSpellChecking ? (
                <Spinner className="w-3.5 h-3.5" />
              ) : isSpellingChecked ? (
                <CheckIcon className="w-3.5 h-3.5" />
              ) : (
                <SpellCheckIcon className="w-3.5 h-3.5" />
              )}
              {isSpellingChecked
                ? (isDanish ? 'Stavning tjekket' : 'Spelling checked')
                : (isDanish ? 'Tjek stavning' : 'Check spelling')}
            </button>
          </div>

          {/* Pro: length + tone adjusters */}
          {isPro && (
            <div className="border border-cta-surface rounded-xl p-4 bg-cta-surface/40 space-y-3">
              <p className="text-xs font-semibold text-cta-text uppercase tracking-wide">
                ✨ {isDanish ? 'AI-tilpasning (Pro)' : 'AI Adjustment (Pro)'}
              </p>

              {/* Length */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">
                  {isDanish ? 'Længde' : 'Length'}
                </p>
                <div className="flex gap-2">
                  {(['shorter', 'longer'] as const).map((val) => (
                    <button
                      key={val}
                      onClick={() => setLengthAdjust(lengthAdjust === val ? null : val)}
                      disabled={isBusy}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        lengthAdjust === val
                          ? 'bg-cta text-white border-cta'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-cta-surface hover:border-cta disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      {val === 'shorter'
                        ? (isDanish ? '↑ Kortere' : '↑ Shorter')
                        : (isDanish ? '↓ Længere' : '↓ Longer')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">
                  {isDanish ? 'Tone' : 'Tone'}
                </p>
                <div className="flex gap-2">
                  {(['looser', 'more_serious'] as const).map((val) => (
                    <button
                      key={val}
                      onClick={() => setToneAdjust(toneAdjust === val ? null : val)}
                      disabled={isBusy}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        toneAdjust === val
                          ? 'bg-cta text-white border-cta'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-cta-surface hover:border-cta disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      {val === 'looser'
                        ? (isDanish ? 'Mere afslappet' : 'More casual')
                        : (isDanish ? 'Mere seriøs' : 'More serious')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply AI button */}
              <button
                onClick={handleAIAdjust}
                disabled={(!lengthAdjust && !toneAdjust) || isBusy}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cta text-white rounded-lg text-xs font-semibold hover:bg-cta-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isAIAdjusting ? (
                  <>
                    <Spinner className="w-3.5 h-3.5" />
                    {isDanish ? 'Tilpasser…' : 'Adjusting…'}
                  </>
                ) : (
                  <>✨ {isDanish ? 'Tilpas med AI' : 'Adjust with AI'}</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 px-5 py-4 border-t border-gray-100">
          {/* Voice example opt-in — shown only after the user has made edits */}
          {isEdited && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveAsVoiceExample}
                onChange={(e) => setSaveAsVoiceExample(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-brand"
              />
              <span className="text-xs text-gray-600">
                {isDanish
                  ? 'Gem som stemmeeksempel (forbedrer fremtidige tekster)'
                  : 'Save as voice example (improves future captions)'}
              </span>
            </label>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              disabled={isBusy}
              className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isDanish ? 'Annuller' : 'Cancel'}
            </button>

            <button
              onClick={handleSave}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-medium text-white bg-cta rounded-lg hover:bg-cta-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckIcon className="w-3.5 h-3.5" />
              {isDanish ? 'Gem ændringer' : 'Save changes'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
