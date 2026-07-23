import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useTierStore } from '../../stores/tierStore'
import { useBrandProfile } from '../../hooks/useBrandProfile'
import { useVisualIdentityAnalyzer } from '../../hooks/useVisualIdentityAnalyzer'
import { PhotoUploader } from '../../components/visualIdentity/PhotoUploader'

export default function BrandProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentTier = useTierStore((state) => state.currentTier)
  const tierStatus = useTierStore((state) => state.tierStatus)
  
  // Use the consolidated brand profile hook
  const {
    form,
    businessId,
    isLoading,
    isGenerating,
    isSaving,
    error,
    lowConfidenceHint,
    generationSkipped,
    hasUnsavedChanges,
    justSaved,
    currentlyEditingField,
    updateField,
    save,
    generate,
    reset,
    setEditingField,
    canSave,
    canGenerate
  } = useBrandProfile()

  const { analyzing: analyzingPhotos, checkingStorage, error: photoAnalysisError, recognizableInteriorIdentity, visualCharacter, venueScene, analyze: analyzePhotos, checkAndAutoAnalyze } = useVisualIdentityAnalyzer()
  const [interiorPhotoPaths, setInteriorPhotoPaths] = useState<string[]>([])
  const [autoAnalysisAttempted, setAutoAnalysisAttempted] = useState(false)

  // Auto-populate the field when analysis succeeds
  useEffect(() => {
    if (recognizableInteriorIdentity) {
      updateField('recognizable_interior_identity', recognizableInteriorIdentity)
    }
    if (visualCharacter) {
      updateField('visual_character', visualCharacter)
    }
    if (venueScene) {
      updateField('venue_scene', venueScene)
    }
  }, [recognizableInteriorIdentity, visualCharacter, venueScene])

  // Auto-trigger: when businessId is available and the field is empty,
  // check storage once for existing photos and analyze them automatically.
  useEffect(() => {
    if (!businessId || autoAnalysisAttempted || form.recognizable_interior_identity || analyzingPhotos || checkingStorage) return
    setAutoAnalysisAttempted(true)
    checkAndAutoAnalyze(businessId)
  }, [businessId, form.recognizable_interior_identity, autoAnalysisAttempted])
  
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  
  // Helper to check if a specific field is being edited
  const isEditing = (field: keyof typeof form) => currentlyEditingField === field
  const startEditing = (field: keyof typeof form) => setEditingField(field)
  const stopEditing = () => setEditingField(null)

  // Handle generate button click
  const handleGenerateClick = async () => {
    setShowConfirmModal(false)
    try {
      await generate({ forceRegenerate: true, ignoreDifferentiationGate: true })
    } catch (err) {
      // Error already handled in generate() function with toast/setError
      console.warn('Generate error caught in handleGenerateClick:', err)
    }
  }

  // Handle delete button click
  const handleDeleteBrand = () => {
    reset()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center py-12">
        <div className="text-sm text-gray-500">{t('common.loading')}</div>
      </div>
    )
  }

  // Show upgrade prompt for free tier users only after tier hydration completes
  console.log('🔒 BrandProfilePage_NEW tier check:', { tierStatus, currentTier, isLocked: tierStatus === 'ready' && currentTier === 'free' })
  if (tierStatus === 'ready' && currentTier === 'free') {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-full py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4">🔒</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Brand Profil er kun tilgængelig i betalte pakker</h1>
              <p className="text-gray-600">
                Opgrader til Smart eller Pro for at oprette en omfattende brand profil med AI-instruktioner.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-cta-surface to-purple-50 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Med Brand Profil får du:</h3>
              <ul className="text-left space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>9 AI prompt-variabler for konsistent kommunikation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Definér din brand essence og tone of voice</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Præcisér målgruppe og core offerings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Sæt indholdfokus og CTA-stil</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Bedre og mere on-brand AI-genereret indhold</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate('/dashboard/plans')}
                className="px-6 py-3 bg-gradient-to-r from-cta to-purple-600 text-white rounded-lg hover:from-cta-hover hover:to-purple-700 transition-all font-semibold shadow-md"
              >
                Se priser og opgrader
              </button>
              <button
                onClick={() => navigate('/dashboard/profile')}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
              >
                Tilbage til Virksomhedsprofil
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-full py-6 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Brand Profil</h1>
          <p className="text-sm text-gray-600">9 AI prompt-variabler for konsistent kommunikation</p>
        </div>

        {/* AI Generate Section */}
        <div className="mb-6 bg-gradient-to-r from-purple-50 to-cta-surface rounded-lg border border-purple-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">🤖 AI-Genereret Brand Profil</h3>
              <p className="text-xs text-gray-600">
                Lad AI analysere din virksomhedsdata og generere en omfattende brand profil baseret på dit website, menuer, og virksomhedsoplysninger.
              </p>
            </div>
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={!canGenerate}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-cta rounded-lg hover:from-purple-700 hover:to-cta-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {isGenerating ? 'Genererer...' : isSaving ? 'Gemmer...' : 'Generer Brand Profil'}
            </button>
          </div>
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              ⚠️ {error}
            </div>
          )}

          {lowConfidenceHint && !error && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <div className="font-semibold mb-1">{generationSkipped ? 'Vi mangler 1–2 unikke kendetegn' : 'Manglende unikke kendetegn'}</div>
              <div>{lowConfidenceHint}</div>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Generer Brand Profil med AI?</h3>
              <p className="text-sm text-gray-600 mb-4">
                AI vil analysere dine virksomhedsdata og generere forslag til alle 9 brand variabler. 
                <strong className="text-gray-900"> Eksisterende indhold vil blive overskrevet.</strong>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Annuller
                </button>
                <button
                  onClick={handleGenerateClick}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-cta rounded-lg hover:from-purple-700 hover:to-cta-hover transition-all"
                >
                  Generer nu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Visual Identity Frame ─────────────────────────────────────── */}
        <div className="mb-6 bg-white rounded-lg border-2 border-teal-200 p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📸</span>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Fotos & atmosfære</h3>
                <p className="text-xs text-gray-500 mt-0.5">AI analyserer dine fotos og bruger atmosfærebeskrivelsen i tekster om stemning, behind-the-scenes og brand</p>
              </div>
            </div>
            <button
              onClick={() => (isEditing('recognizable_interior_identity') ? stopEditing() : startEditing('recognizable_interior_identity'))}
              className="px-3 py-1.5 text-xs font-medium text-teal-700 hover:text-white hover:bg-teal-600 border border-teal-300 rounded-md transition-colors shrink-0"
            >
              {isEditing('recognizable_interior_identity') ? 'Luk' : 'Rediger'}
            </button>
          </div>

          {/* Status / content display */}
          {(checkingStorage || analyzingPhotos) ? (
            <div className="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 rounded-lg px-3 py-2">
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              {checkingStorage ? 'Tjekker for fotos…' : 'Analyserer fotos med AI…'}
            </div>
          ) : form.recognizable_interior_identity ? (
            <div className="space-y-2">
              {form.visual_character && (
                <span className="inline-block px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-800 rounded-full">
                  {form.visual_character}
                </span>
              )}
              <p className="text-xs text-gray-700 bg-teal-50 rounded-lg px-3 py-2 leading-relaxed">
                {form.recognizable_interior_identity}
              </p>
              {form.venue_scene && (
                <p className="text-xs text-gray-600 bg-teal-50 rounded-lg px-3 py-2 leading-relaxed italic">
                  {form.venue_scene}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">
              Ikke udfyldt — upload 2–3 fotos nedenfor. AI genererer en atmosfærebeskrivelse der bruges til at skrive mere præcise og levende tekster om dit sted.
            </p>
          )}

          {/* Photo uploader — always visible */}
          <div className="mt-4 bg-teal-50 border border-teal-200 rounded-lg p-4">
            <p className="text-xs text-teal-700 mb-3">
              Upload 2–3 fotos af dit indre og ydre. AI analyserer dem og genererer en atmosfærebeskrivelse der bruges i dine tekster.
            </p>
            <PhotoUploader
              businessId={businessId ?? ''}
              onUploadComplete={setInteriorPhotoPaths}
            />
            {interiorPhotoPaths.length > 0 && (
              <button
                onClick={async () => { if (businessId) await analyzePhotos(businessId, interiorPhotoPaths) }}
                disabled={analyzingPhotos || !businessId}
                className="mt-3 w-full px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {analyzingPhotos ? '⏳ Analyserer fotos…' : `✨ Analyser ${interiorPhotoPaths.length} foto${interiorPhotoPaths.length !== 1 ? 's' : ''}`}
              </button>
            )}
            {photoAnalysisError && <p className="mt-2 text-xs text-red-600">{photoAnalysisError}</p>}
            {recognizableInteriorIdentity && <p className="mt-2 text-xs text-teal-700">✓ Atmosfærebeskrivelse udfyldt fra fotos</p>}
          </div>

          {/* Inline editor — manual text only, behind Rediger */}
          {isEditing('recognizable_interior_identity') && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Eller skriv en atmosfærebeskrivelse manuelt:</p>
                <textarea
                  value={form.recognizable_interior_identity}
                  onChange={(e) => updateField('recognizable_interior_identity', e.target.value)}
                  placeholder="Fx: 'Udendørs terrasse direkte ved åen', 'Åbent køkken', 'Ingen hvid-dug service — åben og uformel borddækning'…"
                  className="w-full h-32 text-xs border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-400 focus:border-transparent resize-none"
                />
              </div>
              <button
                onClick={() => { save(); stopEditing() }}
                disabled={isSaving}
                className="w-full px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Gemmer…' : 'Gem beskrivelse'}
              </button>
            </div>
          )}
        </div>
        {/* ─────────────────────────────────────────────────────────────── */}

        <div className="space-y-3">
          {/* 1. Brand Essence ⭐⭐⭐⭐⭐ */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Brand Essence ⭐⭐⭐⭐⭐
                </h3>
                <p className="text-xs text-gray-600">
                  {form.brand_essence || 'Kernen i dit brand - hvad gør jer unikke?'}
                </p>
              </div>
              <button
                onClick={() => (isEditing('brand_essence') ? stopEditing() : startEditing('brand_essence'))}
                className="px-3 py-1.5 text-xs font-medium text-cta hover:text-cta-text hover:bg-cta-surface rounded-md transition-colors"
              >
                {isEditing('brand_essence') ? 'Luk' : 'Rediger'}
              </button>
            </div>
            {isEditing('brand_essence') && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={form.brand_essence}
                  onChange={(e) => updateField('brand_essence', e.target.value)}
                  placeholder="Beskriv kernen i dit brand - hvad gør jer unikke, jeres mission, og jeres kernepersonlighed..."
                  className="w-full h-24 text-xs border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-cta focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500">Variabel: <code className="bg-gray-100 px-1 py-0.5 rounded">{'{{brand_essence}}'}</code></p>
              </div>
            )}
          </div>

          {/* 2. Tone of Voice ⭐⭐⭐⭐⭐ */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Tone of Voice ⭐⭐⭐⭐⭐
                </h3>
                <p className="text-xs text-gray-600">
                  {form.tone_of_voice || 'Hvordan skal AI kommunikere på vegne af jeres brand?'}
                </p>
              </div>
              <button
                onClick={() => (isEditing('tone_of_voice') ? stopEditing() : startEditing('tone_of_voice'))}
                className="px-3 py-1.5 text-xs font-medium text-cta hover:text-cta-text hover:bg-cta-surface rounded-md transition-colors"
              >
                {isEditing('tone_of_voice') ? 'Luk' : 'Rediger'}
              </button>
            </div>
            {isEditing('tone_of_voice') && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={form.tone_of_voice}
                  onChange={(e) => updateField('tone_of_voice', e.target.value)}
                  placeholder="Beskriv jeres tone - f.eks. 'venlig og professionel', 'afslappet og humoristisk', 'autoritativ og troværdig'..."
                  className="w-full h-24 text-xs border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-cta focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500">Variabel: <code className="bg-gray-100 px-1 py-0.5 rounded">{'{{tone_of_voice}}'}</code></p>
              </div>
            )}
          </div>

          {/* 3. Things to Avoid ⭐⭐⭐⭐⭐ */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Things to Avoid ⭐⭐⭐⭐⭐
                </h3>
                <p className="text-xs text-gray-600">
                  {form.things_to_avoid || 'Hvad skal AI aldrig sige eller gøre?'}
                </p>
              </div>
              <button
                onClick={() => (isEditing('things_to_avoid') ? stopEditing() : startEditing('things_to_avoid'))}
                className="px-3 py-1.5 text-xs font-medium text-cta hover:text-cta-text hover:bg-cta-surface rounded-md transition-colors"
              >
                {isEditing('things_to_avoid') ? 'Luk' : 'Rediger'}
              </button>
            </div>
            {isEditing('things_to_avoid') && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={form.things_to_avoid}
                  onChange={(e) => updateField('things_to_avoid', e.target.value)}
                  placeholder="Liste af ord, vendinger, emner eller tone som AI skal undgå - f.eks. 'ingen slang', 'undgå overdrivelser', 'aldrig nævn konkurrenter'..."
                  className="w-full h-24 text-xs border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-cta focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500">Variabel: <code className="bg-gray-100 px-1 py-0.5 rounded">{'{{things_to_avoid}}'}</code></p>
              </div>
            )}
          </div>

          {/* 4. Target Audience ⭐⭐⭐⭐☆ */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Target Audience ⭐⭐⭐⭐☆
                </h3>
                <p className="text-xs text-gray-600">
                  {form.target_audience || 'Hvem taler I til?'}
                </p>
              </div>
              <button
                onClick={() => (isEditing('target_audience') ? stopEditing() : startEditing('target_audience'))}
                className="px-3 py-1.5 text-xs font-medium text-cta hover:text-cta-text hover:bg-cta-surface rounded-md transition-colors"
              >
                {isEditing('target_audience') ? 'Luk' : 'Rediger'}
              </button>
            </div>
            {isEditing('target_audience') && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={form.target_audience}
                  onChange={(e) => updateField('target_audience', e.target.value)}
                  placeholder="Beskriv jeres primære målgruppe - demografi, interesser, behov, adfærd..."
                  className="w-full h-24 text-xs border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-cta focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500">Variabel: <code className="bg-gray-100 px-1 py-0.5 rounded">{'{{target_audience}}'}</code></p>
              </div>
            )}
          </div>

          {/* 5. Core Offerings ⭐⭐⭐⭐☆ */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Core Offerings ⭐⭐⭐⭐☆
                </h3>
                <p className="text-xs text-gray-600">
                  {form.core_offerings || 'Jeres primære produkter eller services'}
                </p>
              </div>
              <button
                onClick={() => (isEditing('core_offerings') ? stopEditing() : startEditing('core_offerings'))}
                className="px-3 py-1.5 text-xs font-medium text-cta hover:text-cta-text hover:bg-cta-surface rounded-md transition-colors"
              >
                {isEditing('core_offerings') ? 'Luk' : 'Rediger'}
              </button>
            </div>
            {isEditing('core_offerings') && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={form.core_offerings}
                  onChange={(e) => updateField('core_offerings', e.target.value)}
                  placeholder="Liste de vigtigste produkter, services eller tilbud som AI kan henvise til..."
                  className="w-full h-24 text-xs border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-cta focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500">Variabel: <code className="bg-gray-100 px-1 py-0.5 rounded">{'{{core_offerings}}'}</code></p>
              </div>
            )}
          </div>

          {/* 6. Content Focus ⭐⭐⭐⭐☆ */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Content Focus ⭐⭐⭐⭐☆
                </h3>
                <p className="text-xs text-gray-600">
                  {form.content_focus || 'Hvad skal indholdet handle om?'}
                </p>
              </div>
              <button
                onClick={() => (isEditing('content_focus') ? stopEditing() : startEditing('content_focus'))}
                className="px-3 py-1.5 text-xs font-medium text-cta hover:text-cta-text hover:bg-cta-surface rounded-md transition-colors"
              >
                {isEditing('content_focus') ? 'Luk' : 'Rediger'}
              </button>
            </div>
            {isEditing('content_focus') && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={form.content_focus}
                  onChange={(e) => updateField('content_focus', e.target.value)}
                  placeholder="Beskriv indholdsemnerne I vil fokusere på - f.eks. 'produktnyhederog tips', 'kundehistorier', 'brancheindsigter'..."
                  className="w-full h-24 text-xs border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-cta focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500">Variabel: <code className="bg-gray-100 px-1 py-0.5 rounded">{'{{content_focus}}'}</code></p>
              </div>
            )}
          </div>

          {/* 7. CTA Style field removed - property does not exist in BrandProfileForm type */}

          {/* 8. Communication Goal ⭐⭐⭐⭐☆ */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Communication Goal ⭐⭐⭐⭐☆
                </h3>
                <p className="text-xs text-gray-600">
                  {form.communication_goal || 'Hvad vil I opnå med jeres kommunikation?'}
                </p>
              </div>
              <button
                onClick={() => (isEditing('communication_goal') ? stopEditing() : startEditing('communication_goal'))}
                className="px-3 py-1.5 text-xs font-medium text-cta hover:text-cta-text hover:bg-cta-surface rounded-md transition-colors"
              >
                {isEditing('communication_goal') ? 'Luk' : 'Rediger'}
              </button>
            </div>
            {isEditing('communication_goal') && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={form.communication_goal}
                  onChange={(e) => updateField('communication_goal', e.target.value)}
                  placeholder="Beskriv jeres overordnede kommunikationsmål - f.eks. 'bygge tillid og troværdighed', 'drive salg', 'uddanne målgruppen'..."
                  className="w-full h-24 text-xs border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-cta focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500">Variabel: <code className="bg-gray-100 px-1 py-0.5 rounded">{'{{communication_goal}}'}</code></p>
              </div>
            )}
          </div>

          {/* 9. Image Preferences ⭐⭐⭐☆☆ */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Image Preferences ⭐⭐⭐☆☆
                </h3>
                <p className="text-xs text-gray-600">
                  {form.image_preferences || 'Visuel stil og billedpræferencer'}
                </p>
              </div>
              <button
                onClick={() => (isEditing('image_preferences') ? stopEditing() : startEditing('image_preferences'))}
                className="px-3 py-1.5 text-xs font-medium text-cta hover:text-cta-text hover:bg-cta-surface rounded-md transition-colors"
              >
                {isEditing('image_preferences') ? 'Luk' : 'Rediger'}
              </button>
            </div>
            {isEditing('image_preferences') && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={form.image_preferences}
                  onChange={(e) => updateField('image_preferences', e.target.value)}
                  placeholder="Beskriv jeres foretrukne billedstil - f.eks. 'autentiske fotos', 'lyse og venlige farver', 'minimalistisk design'..."
                  className="w-full h-24 text-xs border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-cta focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-500">Variabel: <code className="bg-gray-100 px-1 py-0.5 rounded">{'{{image_preferences}}'}</code></p>
              </div>
            )}
          </div>
        </div>

        {/* Save Gate */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {justSaved && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <span>✓</span>
                  <span>Gemt</span>
                </div>
              )}
              {hasUnsavedChanges && !justSaved && (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <span>●</span>
                  <span>Ugemte ændringer</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteBrand}
                disabled={!form.brand_essence && !form.tone_of_voice && !form.target_audience && !form.core_offerings && !form.content_focus && !form.image_preferences && !form.things_to_avoid && !form.communication_goal && !form.recognizable_interior_identity}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Ryd alt
              </button>
              <button
                onClick={save}
                disabled={!canSave}
                className="px-4 py-2 text-sm font-medium text-white bg-cta rounded-lg hover:bg-cta-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Gemmer...' : 'Gem ændringer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
