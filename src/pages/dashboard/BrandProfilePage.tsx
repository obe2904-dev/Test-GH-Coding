import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import type { TargetAudience } from '../../features/BrandProfileExtractor'

type BrandProfile = Database['public']['Tables']['business_brand_profile']['Row']

// All possible WHO audiences
const ALL_AUDIENCES: TargetAudience[] = [
  'Locals',
  'Tourists',
  'Families',
  'Young adults',
  'Professionals',
  'Students',
  'Seniors',
  'Foodies',
  'Event guests'
]

// Explanation mapping for why each audience was detected
const getAudienceExplanation = (
  audience: TargetAudience,
  signals: {
    opensEarly?: boolean
    closesLate?: boolean
    hasAlcohol?: boolean
    dominantUsageMode?: string | null
    city?: string
    weekendFocused?: boolean
  }
): string => {
  switch (audience) {
    case 'Professionals':
      if (signals.opensEarly) return 'Åbner tidligt (morgenmad/morgenkaffe)'
      if (signals.dominantUsageMode === 'lunch') return 'Frokost-fokuseret åbningstider'
      return 'Typisk forretningsklientel'

    case 'Young adults':
      if (signals.closesLate && signals.hasAlcohol) return 'Sent åbent + alkohol (natteliv)'
      if (signals.closesLate) return 'Sent åbent (aften-orienteret)'
      if (signals.hasAlcohol) return 'Serverer alkohol'
      return 'Ung demografi'

    case 'Families':
      if (signals.weekendFocused) return 'Weekend-fokuseret'
      if (signals.dominantUsageMode === 'dinner') return 'Aften/middag timing'
      return 'Familie-venligt'

    case 'Tourists':
      if (signals.city?.toLowerCase().includes('køben')) return 'Placering: København'
      if (signals.city?.toLowerCase().includes('aarhus')) return 'Placering: Aarhus'
      return 'Stor by placering'

    case 'Students':
      if (signals.city?.toLowerCase().includes('køben')) return 'Studieby: København'
      if (signals.city?.toLowerCase().includes('aarhus')) return 'Studieby: Aarhus'
      return 'Studieby placering'

    case 'Foodies':
      return 'Restauration/gastronomi'

    case 'Locals':
      return 'Lokal forretning'

    case 'Event guests':
      if (signals.weekendFocused) return 'Weekend-fokuseret'
      return 'Event-venligt'

    case 'Seniors':
      return 'Bred målgruppe'

    default:
      return ''
  }
}

type TabType = 'WHO' | 'WHEN' | 'WHY'

export default function BrandProfilePage() {
  const { t } = useTranslation()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('WHO')

  // WHO state
  const [selectedAudiences, setSelectedAudiences] = useState<TargetAudience[]>([])

  // WHEN state
  const [bestPostingTimes, setBestPostingTimes] = useState<string[]>([])
  const [postingFrequency, setPostingFrequency] = useState<string>('3-4 times per week')

  // WHY state
  const [voiceStyle, setVoiceStyle] = useState<string>('')
  const [toneKeywords, setToneKeywords] = useState<string[]>([])
  const [values, setValues] = useState<string[]>([])
  const [certifications, setCertifications] = useState<string[]>([])
  const [doNotSay, setDoNotSay] = useState<string[]>([])

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Load brand profile data
  useEffect(() => {
    loadBrandProfile()
  }, [])

  const loadBrandProfile = async () => {
    try {
      setIsLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get business_id
      const { data: businessData } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!businessData) {
        console.warn('No business record found')
        setIsLoading(false)
        return
      }

      // Load brand profile
      const { data: profileData } = await supabase
        .from('business_brand_profile')
        .select('*')
        .eq('business_id', businessData.id)
        .maybeSingle()

      if (profileData) {
        console.log('📊 Loaded brand profile:', profileData)
        setBrandProfile(profileData)
        // Pre-select auto-detected audiences
        setSelectedAudiences((profileData.target_audiences || []) as TargetAudience[])

        // Load WHEN data
        setBestPostingTimes([]) // TODO: Add to database schema if needed
        setPostingFrequency('3-4 times per week') // Default

        // Load WHY data
        setVoiceStyle(profileData.voice_style || '')
        setToneKeywords((profileData.tone_keywords || []) as string[])
        setValues((profileData.values || []) as string[])
        setCertifications((profileData.certifications || []) as string[])
        setDoNotSay([]) // TODO: Parse from do_not_say JSONB if needed
      } else {
        console.warn('⚠️ No brand profile found - will create on first save')
      }
    } catch (error) {
      console.error('Failed to load brand profile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleAudience = (audience: TargetAudience) => {
    console.log('🔄 Toggling audience:', audience)
    setSelectedAudiences(prev => {
      const newAudiences = prev.includes(audience)
        ? prev.filter(a => a !== audience)
        : [...prev, audience]
      console.log('📋 New audiences:', newAudiences)
      return newAudiences
    })
    setHasUnsavedChanges(true)
    console.log('✏️ Has unsaved changes set to true')
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('❌ No user found')
        return
      }

      console.log('💾 Starting save for tab:', activeTab)

      // Get business_id
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (businessError) {
        console.error('❌ Error fetching business:', businessError)
        alert('Kunne ikke hente forretning. Prøv igen.')
        return
      }

      if (!businessData) {
        console.error('❌ No business found for user:', user.id)
        alert('Kunne ikke finde forretning. Prøv igen.')
        return
      }

      console.log('🏢 Business ID:', businessData.id)

      // Build upsert data based on active tab
      const updateData: Record<string, any> = {
        business_id: businessData.id,
        updated_at: new Date().toISOString()
      }

      if (activeTab === 'WHO') {
        updateData.target_audiences = selectedAudiences
        console.log('📝 Saving WHO data:', selectedAudiences)
      } else if (activeTab === 'WHEN') {
        // WHEN data (add to schema later if needed)
        // updateData.best_posting_times = bestPostingTimes
        // updateData.posting_frequency = postingFrequency
        console.log('⚠️ WHEN save not implemented - schema fields missing')
      } else if (activeTab === 'WHY') {
        updateData.voice_style = voiceStyle || null
        updateData.tone_keywords = toneKeywords
        updateData.values = values
        updateData.certifications = certifications
        // updateData.do_not_say = { words: doNotSay }
        console.log('📝 Saving WHY data:', {
          voice_style: voiceStyle,
          tone_keywords: toneKeywords,
          values: values,
          certifications: certifications
        })
      }

      console.log('💾 Upserting data:', updateData)

      // Save updated data
      const { data: savedData, error } = await supabase
        .from('business_brand_profile')
        .upsert(updateData)
        .select()

      if (error) {
        console.error('❌ Failed to save brand profile:', error)
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        alert(`Kunne ikke gemme: ${error.message}`)
        return
      }

      console.log('✅ Brand profile saved successfully:', savedData)
      setHasUnsavedChanges(false)
      console.log(`✅ Brand profile ${activeTab} saved`)
    } catch (error) {
      console.error('❌ Error saving brand profile:', error)
      alert('Der opstod en fejl. Prøv igen.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center py-12">
        <div className="text-sm text-gray-500">Indlæser...</div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-full py-6 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Brand Profil
          </h1>
          <p className="text-sm text-gray-600">
            Hjælp AI med at lave bedre opslag ved at fortælle hvem du henvender dig til
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-white rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setActiveTab('WHO')}
              className={`px-6 py-2 text-sm font-semibold rounded-md transition-colors ${
                activeTab === 'WHO'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              WHO
            </button>
            <button
              onClick={() => setActiveTab('WHEN')}
              className={`px-6 py-2 text-sm font-semibold rounded-md transition-colors ${
                activeTab === 'WHEN'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              WHEN
            </button>
            <button
              onClick={() => setActiveTab('WHY')}
              className={`px-6 py-2 text-sm font-semibold rounded-md transition-colors ${
                activeTab === 'WHY'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              WHY
            </button>
          </div>
        </div>

        {/* WHO Section */}
        {activeTab === 'WHO' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-md p-8">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                WHO - Hvem henvender du dig til?
              </h2>
              <p className="text-sm text-gray-600">
                Baseret på din forretningsprofil har vi foreslået nogle målgrupper.
                Tilpas dem så de passer til din forretning.
              </p>
            </div>

          {/* Auto-detection summary */}
          {brandProfile && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-blue-900 mb-1">
                    Auto-detekteret fra din profil
                  </h3>
                  <ul className="text-xs text-blue-800 space-y-1">
                    {brandProfile.opens_early && (
                      <li>✓ Åbner tidligt (før kl. 8)</li>
                    )}
                    {brandProfile.closes_late && (
                      <li>✓ Lukker sent (efter kl. 22)</li>
                    )}
                    {brandProfile.has_alcohol && (
                      <li>✓ Serverer alkohol</li>
                    )}
                    {brandProfile.dominant_usage_mode && (
                      <li>✓ Primær tid: {brandProfile.dominant_usage_mode}</li>
                    )}
                    {brandProfile.weekend_focused && (
                      <li>✓ Weekend-fokuseret</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Audience Checkboxes */}
          <div className="space-y-3">
            {ALL_AUDIENCES.map(audience => {
              const isSelected = selectedAudiences.includes(audience)
              const isAutoDetected = (brandProfile?.target_audiences || []).includes(audience)
              const explanation = brandProfile ? getAudienceExplanation(audience, {
                opensEarly: brandProfile.opens_early,
                closesLate: brandProfile.closes_late,
                hasAlcohol: brandProfile.has_alcohol,
                dominantUsageMode: brandProfile.dominant_usage_mode,
                weekendFocused: brandProfile.weekend_focused
              }) : ''

              return (
                <label
                  key={audience}
                  className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleAudience(audience)}
                    className="w-5 h-5 mt-0.5 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {audience}
                      </span>
                      {isAutoDetected && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                          Auto-detekteret
                        </span>
                      )}
                    </div>
                    {explanation && (
                      <p className="text-xs text-gray-600 mt-1">
                        {explanation}
                      </p>
                    )}
                  </div>
                </label>
              )
            })}
          </div>

          {/* Selection Summary */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-semibold">{selectedAudiences.length}</span> målgruppe{selectedAudiences.length !== 1 ? 'r' : ''} valgt
            </p>

            {selectedAudiences.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  ⚠️ Vælg mindst én målgruppe for at hjælpe AI med at lave bedre opslag
                </p>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={loadBrandProfile}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Nulstil til auto-detekteret
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${
                hasUnsavedChanges
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-md'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? 'Gemmer...' : hasUnsavedChanges ? 'Gem ændringer' : 'Gemt'}
            </button>
          </div>
        </div>
        )}

        {/* WHEN Section */}
        {activeTab === 'WHEN' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-md p-8">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                WHEN - Hvornår poster du?
              </h2>
              <p className="text-sm text-gray-600">
                Angiv dine præferencer for hvornår og hvor ofte du vil poste på sociale medier.
              </p>
            </div>

            {/* Posting Frequency */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Hvor ofte vil du poste?
              </label>
              <div className="space-y-2">
                {[
                  '1-2 times per week',
                  '3-4 times per week',
                  '5-7 times per week',
                  'Multiple times daily'
                ].map(frequency => (
                  <label
                    key={frequency}
                    className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      postingFrequency === frequency
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="posting_frequency"
                      checked={postingFrequency === frequency}
                      onChange={() => {
                        setPostingFrequency(frequency)
                        setHasUnsavedChanges(true)
                      }}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {frequency}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Best Posting Times */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Bedste tidspunkter at poste (valgfrit)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                AI vil foreslå optimale tidspunkter baseret på din målgruppe, men du kan også specificere præferencer her.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'Morgenmad (6-9)',
                  'Formiddag (9-12)',
                  'Frokost (12-15)',
                  'Eftermiddag (15-18)',
                  'Aften (18-21)',
                  'Sen aften (21-24)'
                ].map(timeSlot => {
                  const isSelected = bestPostingTimes.includes(timeSlot)
                  return (
                    <label
                      key={timeSlot}
                      className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setBestPostingTimes(prev =>
                            prev.includes(timeSlot)
                              ? prev.filter(t => t !== timeSlot)
                              : [...prev, timeSlot]
                          )
                          setHasUnsavedChanges(true)
                        }}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-900">
                        {timeSlot}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex items-center justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
                className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${
                  hasUnsavedChanges
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-md'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSaving ? 'Gemmer...' : hasUnsavedChanges ? 'Gem ændringer' : 'Gemt'}
              </button>
            </div>
          </div>
        )}

        {/* WHY Section */}
        {activeTab === 'WHY' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-md p-8">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                WHY - Hvad er dit brand's stemme?
              </h2>
              <p className="text-sm text-gray-600">
                Fortæl AI om din brands personlighed, værdier og tone, så opslag matcher din identitet.
              </p>
            </div>

            {/* Voice Style */}
            <div className="mb-6">
              <label htmlFor="voice_style" className="block text-sm font-semibold text-gray-900 mb-2">
                Brand stemme/tone
              </label>
              <p className="text-xs text-gray-500 mb-2">
                F.eks. "venlig og afslappet", "professionel og troværdig", "energisk og humoristisk"
              </p>
              <input
                id="voice_style"
                type="text"
                value={voiceStyle}
                onChange={(e) => {
                  setVoiceStyle(e.target.value)
                  setHasUnsavedChanges(true)
                }}
                placeholder="Beskriv din brands stemme..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Tone Keywords */}
            <div className="mb-6">
              <label htmlFor="tone_keywords" className="block text-sm font-semibold text-gray-900 mb-2">
                Tone nøgleord
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Komma-separerede ord (f.eks. "venlig, autentisk, lokal, passioneret")
              </p>
              <input
                id="tone_keywords"
                type="text"
                value={toneKeywords.join(', ')}
                onChange={(e) => {
                  setToneKeywords(e.target.value.split(',').map(k => k.trim()).filter(k => k))
                  setHasUnsavedChanges(true)
                }}
                placeholder="venlig, autentisk, lokal..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Values */}
            <div className="mb-6">
              <label htmlFor="values" className="block text-sm font-semibold text-gray-900 mb-2">
                Brand værdier
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Komma-separerede værdier (f.eks. "bæredygtighed, kvalitet, fællesskab")
              </p>
              <input
                id="values"
                type="text"
                value={values.join(', ')}
                onChange={(e) => {
                  setValues(e.target.value.split(',').map(v => v.trim()).filter(v => v))
                  setHasUnsavedChanges(true)
                }}
                placeholder="bæredygtighed, kvalitet, fællesskab..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Certifications */}
            <div className="mb-6">
              <label htmlFor="certifications" className="block text-sm font-semibold text-gray-900 mb-2">
                Certificeringer & meritter (valgfrit)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Komma-separerede (f.eks. "økologisk certificeret, Michelin-anbefalet, Fairtrade")
              </p>
              <input
                id="certifications"
                type="text"
                value={certifications.join(', ')}
                onChange={(e) => {
                  setCertifications(e.target.value.split(',').map(c => c.trim()).filter(c => c))
                  setHasUnsavedChanges(true)
                }}
                placeholder="økologisk certificeret, Michelin-anbefalet..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Do Not Say */}
            <div className="mb-6">
              <label htmlFor="do_not_say" className="block text-sm font-semibold text-gray-900 mb-2">
                Ord/fraser at undgå (valgfrit)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Komma-separerede ord som AI IKKE må bruge (f.eks. "billig, hurtig, discount")
              </p>
              <input
                id="do_not_say"
                type="text"
                value={doNotSay.join(', ')}
                onChange={(e) => {
                  setDoNotSay(e.target.value.split(',').map(w => w.trim()).filter(w => w))
                  setHasUnsavedChanges(true)
                }}
                placeholder="billig, hurtig, discount..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Save Button */}
            <div className="mt-6 flex items-center justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
                className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${
                  hasUnsavedChanges
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-md'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSaving ? 'Gemmer...' : hasUnsavedChanges ? 'Gem ændringer' : 'Gemt'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
