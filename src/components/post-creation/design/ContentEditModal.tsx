/**
 * ContentEditModal
 *
 * Unified modal for editing both text and hashtags in the Design step.
 * - Platform toggle when both Facebook and Instagram selected
 * - Text editor with spell check and AI adjustments (Pro)
 * - Hashtag editor per platform
 * - "Apply to both" for text changes only
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSpellingCheck } from '../../../hooks/useSpellingCheck'
import type { PlatformHashtag } from '../../../stores/postCreationStore'

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

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 5v14m-7-7h14" />
  </svg>
)

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ContentEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    text: Record<string, string>
    hashtags: Record<string, PlatformHashtag[]>
    applyTextToBoth: boolean
    saveAsExample?: boolean
  }) => void
  selectedPlatforms: string[]
  initialText: Record<string, string>
  initialHashtags: Record<string, PlatformHashtag[]>
  currentTier: string
  language: string
  businessId?: string
}

type LengthAdjust = 'shorter' | 'longer' | null
type ToneAdjust = 'looser' | 'more_serious' | null

// ─── Component ───────────────────────────────────────────────────────────────

export function ContentEditModal({
  isOpen,
  onClose,
  onSave,
  selectedPlatforms,
  initialText,
  initialHashtags,
  currentTier,
  language,
  businessId,
}: ContentEditModalProps) {
  const { i18n } = useTranslation()
  const isDanish = i18n.language.startsWith('da')
  const isPro = currentTier === 'premium' || currentTier === 'standardplus'

  // ── Platform state ──────────────────────────────────────────────────────────
  const [activePlatform, setActivePlatform] = useState<string>(selectedPlatforms[0] || 'facebook')

  // ── Text state ──────────────────────────────────────────────────────────────
  const [editedText, setEditedText] = useState<Record<string, string>>({})
  const [isEdited, setIsEdited] = useState(false)
  const [isSpellingChecked, setIsSpellingChecked] = useState(false)
  const { isChecking: isSpellChecking, checkSpelling } = useSpellingCheck()
  const [applyToBoth, setApplyToBoth] = useState(false)

  // ── AI adjustment state (Pro only) ──────────────────────────────────────────
  const [lengthAdjust, setLengthAdjust] = useState<LengthAdjust>(null)
  const [toneAdjust, setToneAdjust] = useState<ToneAdjust>(null)
  const [isAIAdjusting, setIsAIAdjusting] = useState(false)

  // ── Hashtag state ───────────────────────────────────────────────────────────
  const [editedHashtags, setEditedHashtags] = useState<Record<string, PlatformHashtag[]>>({})
  const [newHashtag, setNewHashtag] = useState('')

  // ── Voice example save option ───────────────────────────────────────────────
  const [saveAsVoiceExample, setSaveAsVoiceExample] = useState(false)

  // ── Reset state when modal opens ────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setEditedText(JSON.parse(JSON.stringify(initialText)))
      setEditedHashtags(JSON.parse(JSON.stringify(initialHashtags)))
      setActivePlatform(selectedPlatforms[0] || 'facebook')
      setIsEdited(false)
      setIsSpellingChecked(false)
      setLengthAdjust(null)
      setToneAdjust(null)
      setIsAIAdjusting(false)
      setSaveAsVoiceExample(false)
      setApplyToBoth(false)
      setNewHashtag('')
    }
  }, [isOpen, initialText, initialHashtags, selectedPlatforms])

  // ── Text handlers ───────────────────────────────────────────────────────────
  const handleTextChange = useCallback((value: string) => {
    setEditedText(prev => ({ ...prev, [activePlatform]: value }))
    setIsEdited(true)
    setIsSpellingChecked(false)
  }, [activePlatform])

  const handleSpellingCheck = useCallback(async () => {
    if (!isEdited || isSpellChecking) return

    const result = await checkSpelling({
      text: editedText[activePlatform] || '',
      language: language.startsWith('da') ? 'da' : language.startsWith('sv') ? 'sv' : language.startsWith('de') ? 'de' : 'en',
      onError: () => {},
    })

    if (result?.text) {
      setEditedText(prev => ({ ...prev, [activePlatform]: result.text }))
      setIsSpellingChecked(true)
      setIsEdited(false)
    }
  }, [isEdited, isSpellChecking, editedText, activePlatform, language, checkSpelling])

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
          currentText: editedText[activePlatform] || '',
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
        setEditedText(prev => ({ ...prev, [activePlatform]: data.text }))
        setIsEdited(true)
        setIsSpellingChecked(false)
        setLengthAdjust(null)
        setToneAdjust(null)
      }
    } catch (err) {
      console.error('[ContentEditModal] AI adjustment error:', err)
      const msg = isDanish
        ? 'AI-tilpasning mislykkedes. Prøv igen.'
        : 'AI adjustment failed. Please try again.'
      alert(msg)
    } finally {
      setIsAIAdjusting(false)
    }
  }, [isPro, isAIAdjusting, lengthAdjust, toneAdjust, editedText, activePlatform, isDanish, currentTier, businessId])

  // ── Hashtag handlers ────────────────────────────────────────────────────────
  const toggleHashtag = useCallback((index: number) => {
    setEditedHashtags(prev => {
      const platformTags = [...(prev[activePlatform] || [])]
      platformTags[index] = { ...platformTags[index], enabled: !platformTags[index].enabled }
      return { ...prev, [activePlatform]: platformTags }
    })
  }, [activePlatform])

  const addHashtag = useCallback(() => {
    const cleanTag = newHashtag.trim().replace(/^#+/, '')
    if (!cleanTag) return

    const formattedTag = `#${cleanTag}`
    const platformTags = editedHashtags[activePlatform] || []

    // Check if hashtag already exists for this platform
    if (platformTags.some(h => h.tag.toLowerCase() === formattedTag.toLowerCase())) {
      return
    }

    setEditedHashtags(prev => ({
      ...prev,
      [activePlatform]: [...platformTags, { tag: formattedTag, enabled: true, platforms: [activePlatform] }]
    }))
    setNewHashtag('')
  }, [newHashtag, activePlatform, editedHashtags])

  const deleteHashtag = useCallback((index: number) => {
    setEditedHashtags(prev => ({
      ...prev,
      [activePlatform]: (prev[activePlatform] || []).filter((_, i) => i !== index)
    }))
  }, [activePlatform])

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    onSave({
      text: editedText,
      hashtags: editedHashtags,
      applyTextToBoth: applyToBoth,
      saveAsExample: saveAsVoiceExample,
    })
    onClose()
  }, [editedText, editedHashtags, applyToBoth, saveAsVoiceExample, onSave, onClose])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose, handleSave])

  const handleHashtagKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newHashtag.trim()) {
      e.preventDefault()
      addHashtag()
    }
  }, [newHashtag, addHashtag])

  if (!isOpen) return null

  const isBusy = isSpellChecking || isAIAdjusting
  const currentHashtags = editedHashtags[activePlatform] || []
  const showPlatformToggle = selectedPlatforms.length > 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isDanish ? 'Rediger indhold' : 'Edit content'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label={isDanish ? 'Luk' : 'Close'}
          >
            ✕
          </button>
        </div>

        {/* Platform Toggle */}
        {showPlatformToggle && (
          <div className="px-6 pt-4 border-b border-gray-100">
            <div className="flex gap-2 pb-3">
              {selectedPlatforms.includes('facebook') && (
                <button
                  onClick={() => setActivePlatform('facebook')}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    activePlatform === 'facebook'
                      ? 'bg-cta text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Facebook
                </button>
              )}
              {selectedPlatforms.includes('instagram') && (
                <button
                  onClick={() => setActivePlatform('instagram')}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    activePlatform === 'instagram'
                      ? 'bg-cta text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Instagram
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Text Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                {isDanish ? 'Tekst' : 'Text'}
              </h3>
              {showPlatformToggle && (
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToBoth}
                    onChange={(e) => setApplyToBoth(e.target.checked)}
                    className="w-4 h-4 text-cta border-gray-300 rounded focus:ring-cta"
                  />
                  {isDanish ? 'Anvend på begge platforme' : 'Apply to both platforms'}
                </label>
              )}
            </div>

            <div>
              <textarea
                value={editedText[activePlatform] || ''}
                onChange={(e) => handleTextChange(e.target.value)}
                disabled={isBusy}
                rows={6}
                className="w-full text-sm text-gray-900 leading-relaxed border border-gray-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-cta focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder={isDanish ? 'Skriv din tekst her…' : 'Write your text here…'}
              />
              <p className="mt-1 text-right text-xs text-gray-400">
                {(editedText[activePlatform] || '').length} {isDanish ? 'tegn' : 'chars'}
              </p>
            </div>

            {/* Text Tools Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Spell Check */}
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
                {isDanish ? 'Stavecheck' : 'Spell Check'}
              </button>

              {/* Pro AI Adjustments */}
              {isPro && (
                <>
                  {/* Length buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLengthAdjust(lengthAdjust === 'shorter' ? null : 'shorter')}
                      disabled={isBusy}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        lengthAdjust === 'shorter'
                          ? 'bg-cta text-white border-cta'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 disabled:opacity-40'
                      }`}
                    >
                      {isDanish ? 'Kortere' : 'Shorter'}
                    </button>
                    <button
                      onClick={() => setLengthAdjust(lengthAdjust === 'longer' ? null : 'longer')}
                      disabled={isBusy}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        lengthAdjust === 'longer'
                          ? 'bg-cta text-white border-cta'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 disabled:opacity-40'
                      }`}
                    >
                      {isDanish ? 'Længere' : 'Longer'}
                    </button>
                  </div>

                  {/* Tone buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setToneAdjust(toneAdjust === 'looser' ? null : 'looser')}
                      disabled={isBusy}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        toneAdjust === 'looser'
                          ? 'bg-cta text-white border-cta'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 disabled:opacity-40'
                      }`}
                    >
                      {isDanish ? 'Mere løs' : 'Looser'}
                    </button>
                    <button
                      onClick={() => setToneAdjust(toneAdjust === 'more_serious' ? null : 'more_serious')}
                      disabled={isBusy}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        toneAdjust === 'more_serious'
                          ? 'bg-cta text-white border-cta'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 disabled:opacity-40'
                      }`}
                    >
                      {isDanish ? 'Mere seriøs' : 'More Serious'}
                    </button>
                  </div>

                  {/* Apply AI button */}
                  {(lengthAdjust || toneAdjust) && (
                    <button
                      onClick={handleAIAdjust}
                      disabled={isAIAdjusting}
                      className="px-4 py-2 bg-cta hover:bg-cta-hover text-white rounded-lg text-xs font-medium transition-all disabled:opacity-60"
                    >
                      {isAIAdjusting ? (
                        <span className="flex items-center gap-2">
                          <Spinner className="w-3.5 h-3.5" />
                          {isDanish ? 'Tilpasser...' : 'Adjusting...'}
                        </span>
                      ) : (
                        isDanish ? 'Anvend AI-tilpasning' : 'Apply AI Adjustment'
                      )}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Voice Example Checkbox */}
            {businessId && (
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAsVoiceExample}
                  onChange={(e) => setSaveAsVoiceExample(e.target.checked)}
                  className="w-4 h-4 text-cta border-gray-300 rounded focus:ring-cta"
                />
                {isDanish ? 'Gem som stemmeeksempel i din brandprofil' : 'Save as voice example in your brand profile'}
              </label>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Hashtags Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {isDanish ? 'Hashtags' : 'Hashtags'}
            </h3>

            {/* Add Hashtag */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value)}
                onKeyDown={handleHashtagKeyDown}
                placeholder="#eksempel"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cta focus:border-transparent"
              />
              <button
                onClick={addHashtag}
                disabled={!newHashtag.trim()}
                className="px-4 py-2 bg-cta hover:bg-cta-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                <PlusIcon className="w-4 h-4" />
                {isDanish ? 'Tilføj' : 'Add'}
              </button>
            </div>

            {/* Hashtag List */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">
                {activePlatform === 'facebook' ? 'Facebook' : 'Instagram'} hashtags
              </p>
              {currentHashtags.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-4 text-center">
                  {isDanish ? 'Ingen hashtags tilføjet endnu' : 'No hashtags added yet'}
                </p>
              ) : (
                <div className="space-y-2">
                  {currentHashtags.map((hashtag, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={hashtag.enabled}
                        onChange={() => toggleHashtag(index)}
                        className="w-4 h-4 text-cta border-gray-300 rounded focus:ring-cta cursor-pointer"
                      />
                      <span className={`flex-1 text-sm ${hashtag.enabled ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                        {hashtag.tag}
                      </span>
                      <button
                        onClick={() => deleteHashtag(index)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-all"
                        aria-label={isDanish ? 'Slet' : 'Delete'}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isDanish ? 'Annuller' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={isBusy}
            className="px-6 py-2 bg-cta hover:bg-cta-hover text-white rounded-lg text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDanish ? 'Gem' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
