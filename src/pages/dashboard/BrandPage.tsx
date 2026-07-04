import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTierStore } from '../../stores/tierStore'
import { BrandSectionIcon } from '../../components/brandProfile/BrandSectionIcon'

type EmojiUsage = 'none' | 'minimal' | 'moderate' | 'frequent'

interface BrandData {
  tone_keywords: string[]
  values: string[]
  emoji_usage: EmojiUsage | null
  formality_level: number
  do_not_say: string[]
}

function BrandPage() {
  const currentTier = useTierStore((state) => state.currentTier)

  const [businessId, setBusinessId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Brand data
  const [toneKeywords, setToneKeywords] = useState<string[]>([])
  const [brandValues, setBrandValues] = useState<string[]>([])
  const [emojiUsage, setEmojiUsage] = useState<EmojiUsage | null>('moderate')
  const [formalityLevel, setFormalityLevel] = useState(3)
  const [doNotSay, setDoNotSay] = useState<string[]>([])
  
  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['voice', 'values', 'writing', 'dontsay']))
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  
  // Input fields
  const [toneInput, setToneInput] = useState('')
  const [valueInput, setValueInput] = useState('')
  const [doNotSayInput, setDoNotSayInput] = useState('')

  // Load business and brand profile
  useEffect(() => {
    let isActive = true

    const fetchData = async () => {
      try {
        setIsLoading(true)
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user
        if (!user) return

        const { data: businessData } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (!businessData) return
        if (!isActive) return

        const bizId = (businessData as any).id
        setBusinessId(bizId)

        // Load brand profile
        const { data: brandData } = await supabase
          .from('business_brand_profile')
          .select('*')
          .eq('business_id', bizId)
          .maybeSingle()

        if (brandData && isActive) {
          setToneKeywords(brandData.tone_keywords || [])
          setBrandValues(brandData.core_values || [])
          setEmojiUsage(((brandData as any).emoji_usage as EmojiUsage) || 'moderate')
          setFormalityLevel((brandData as any).formality_level || 3)
          
          // Handle do_not_say which could be JSONB
          const doNotSayData = brandData.do_not_say
          if (Array.isArray(doNotSayData)) {
            setDoNotSay(doNotSayData.filter((item): item is string => typeof item === 'string'))
          } else if (doNotSayData && typeof doNotSayData === 'object' && 'words' in doNotSayData) {
            const words = (doNotSayData as any).words
            if (Array.isArray(words)) {
              setDoNotSay(words.filter((item): item is string => typeof item === 'string'))
            }
          }
        }
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    fetchData()

    return () => {
      isActive = false
    }
  }, [])

  // Auto-save with 2 second debounce
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const timer = setTimeout(() => {
      handleAutoSave()
    }, 2000)

    return () => clearTimeout(timer)
  }, [hasUnsavedChanges, toneKeywords, brandValues, emojiUsage, formalityLevel, doNotSay])

  const handleAutoSave = async () => {
    if (!businessId) return

    try {
      setIsSaving(true)

      const brandData: Partial<BrandData> = {
        tone_keywords: toneKeywords,
        values: brandValues,
        emoji_usage: emojiUsage,
        formality_level: formalityLevel,
        do_not_say: doNotSay
      }

      // Check if record exists
      const { data: existing } = await supabase
        .from('business_brand_profile')
        .select('id')
        .eq('business_id', businessId)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('business_brand_profile')
          .update(brandData)
          .eq('id', (existing as any).id)
      } else {
        await supabase
          .from('business_brand_profile')
          .insert({
            business_id: businessId,
            ...brandData
          })
      }

      setHasUnsavedChanges(false)
      const now = new Date()
      // Use Copenhagen timezone for time display
      const timeStr = now.toLocaleTimeString('da-DK', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Europe/Copenhagen'
      })
      setLastSaved(timeStr)
    } catch (error) {
      console.error('Error saving brand profile:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const handleAddToneKeyword = () => {
    const value = toneInput.trim()
    if (value && !toneKeywords.includes(value)) {
      setToneKeywords([...toneKeywords, value])
      setToneInput('')
      setHasUnsavedChanges(true)
    }
  }

  const handleRemoveToneKeyword = (keyword: string) => {
    setToneKeywords(toneKeywords.filter(k => k !== keyword))
    setHasUnsavedChanges(true)
  }

  const handleAddValue = () => {
    const value = valueInput.trim()
    if (value && !brandValues.includes(value)) {
      setBrandValues([...brandValues, value])
      setValueInput('')
      setHasUnsavedChanges(true)
    }
  }

  const handleRemoveValue = (value: string) => {
    setBrandValues(brandValues.filter(v => v !== value))
    setHasUnsavedChanges(true)
  }

  const handleAddDoNotSay = () => {
    const value = doNotSayInput.trim()
    if (value && !doNotSay.includes(value)) {
      setDoNotSay([...doNotSay, value])
      setDoNotSayInput('')
      setHasUnsavedChanges(true)
    }
  }

  const handleRemoveDoNotSay = (phrase: string) => {
    setDoNotSay(doNotSay.filter(p => p !== phrase))
    setHasUnsavedChanges(true)
  }

  const handleEmojiUsageChange = (usage: EmojiUsage) => {
    setEmojiUsage(usage)
    setHasUnsavedChanges(true)
  }

  const handleFormalityChange = (level: number) => {
    setFormalityLevel(level)
    setHasUnsavedChanges(true)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center py-12">
        <div className="text-sm text-gray-500">Indlæser...</div>
      </div>
    )
  }

  // Free tier - upgrade prompt
  if (currentTier === 'free') {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-full py-6 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-900 mb-1">Brand Profil</h1>
            <p className="text-sm text-gray-600">Din brands personlighed og tone</p>
          </div>

          <div className="bg-gradient-to-br from-cta-surface to-purple-50 rounded-lg border border-cta-surface p-6">
            <div className="flex items-start gap-3">
              <BrandSectionIcon id="palette" className="w-8 h-8 text-text" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2 text-lg">Opgrader for brand profil</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Med Smart eller Pro kan du definere din brands personlighed, tone og værdier. 
                  AI bruger dette til at skabe autentiske opslag der passer til dit brand.
                </p>
                <button
                  onClick={() => (window.location.href = '/dashboard/plans')}
                  className="px-4 py-2 bg-gradient-to-r from-cta to-purple-600 text-white rounded font-medium text-sm"
                >
                  Se priser og opgrader
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-full py-6 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Brand Profil</h1>
          <p className="text-sm text-gray-600">Din brands personlighed og tone</p>
        </div>

        {/* Save status */}
        {(isSaving || lastSaved) && (
          <div className="text-center mb-4">
            {isSaving ? (
              <span className="text-sm text-gray-500">💾 Gemmer...</span>
            ) : (
              <span className="text-sm text-green-600">✓ Gemt kl. {lastSaved}</span>
            )}
          </div>
        )}

        <div className="space-y-3">
          {/* Voice & Tone Section */}
          <div className="bg-white rounded-lg border border-gray-200">
            <button
              onClick={() => toggleSection('voice')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
            >
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Stemme & Tone</h2>
                {!expandedSections.has('voice') && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {toneKeywords.length > 0 ? `${toneKeywords.slice(0, 3).join(', ')}${toneKeywords.length > 3 ? '...' : ''}` : 'Ingen tone beskrivelser'}
                  </p>
                )}
              </div>
              <span className="text-gray-400">{expandedSections.has('voice') ? '▲' : '▼'}</span>
            </button>

            {expandedSections.has('voice') && (
              <div className="px-4 py-3 border-t border-gray-200 space-y-4">
                {/* Tone Keywords */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tone beskrivelser
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={toneInput}
                      onChange={(e) => setToneInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddToneKeyword()}
                      placeholder="fx. autentisk, imødekommende..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cta"
                    />
                    <button
                      onClick={handleAddToneKeyword}
                      className="px-4 py-2 text-sm font-medium text-white bg-cta rounded hover:bg-cta-hover"
                    >
                      Tilføj
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {toneKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-cta-surface text-cta-text rounded-full text-sm"
                      >
                        {keyword}
                        <button
                          onClick={() => handleRemoveToneKeyword(keyword)}
                          className="hover:text-cta-text"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Brand Values Section */}
          <div className="bg-white rounded-lg border border-gray-200">
            <button
              onClick={() => toggleSection('values')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
            >
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Brand Værdier</h2>
                {!expandedSections.has('values') && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {brandValues.length > 0 ? brandValues.slice(0, 3).join(', ') + (brandValues.length > 3 ? '...' : '') : 'Ingen værdier tilføjet'}
                  </p>
                )}
              </div>
              <span className="text-gray-400">{expandedSections.has('values') ? '▲' : '▼'}</span>
            </button>

            {expandedSections.has('values') && (
              <div className="px-4 py-3 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hvad står dit brand for?
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={valueInput}
                    onChange={(e) => setValueInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddValue()}
                    placeholder="fx. bæredygtighed, lokale råvarer..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cta"
                  />
                  <button
                    onClick={handleAddValue}
                    className="px-4 py-2 text-sm font-medium text-white bg-cta rounded hover:bg-cta-hover"
                  >
                    Tilføj
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {brandValues.map((value) => (
                    <span
                      key={value}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                    >
                      {value}
                      <button
                        onClick={() => handleRemoveValue(value)}
                        className="hover:text-purple-900"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Writing Style Section */}
          <div className="bg-white rounded-lg border border-gray-200">
            <button
              onClick={() => toggleSection('writing')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
            >
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Skrivesti</h2>
                {!expandedSections.has('writing') && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {getEmojiUsageLabel(emojiUsage || 'moderate')} · {getFormalityLabel(formalityLevel)}
                  </p>
                )}
              </div>
              <span className="text-gray-400">{expandedSections.has('writing') ? '▲' : '▼'}</span>
            </button>

            {expandedSections.has('writing') && (
              <div className="px-4 py-3 border-t border-gray-200 space-y-4">
                {/* Emoji Usage */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Emoji brug
                  </label>
                  <select
                    value={emojiUsage || 'moderate'}
                    onChange={(e) => handleEmojiUsageChange(e.target.value as EmojiUsage)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cta"
                  >
                    <option value="none">Ingen emojis</option>
                    <option value="minimal">Minimal (1-2 per opslag)</option>
                    <option value="moderate">Moderat (3-5 per opslag)</option>
                    <option value="frequent">Hyppig (5+ per opslag)</option>
                  </select>
                </div>

                {/* Formality Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Formalitetsniveau: {getFormalityLabel(formalityLevel)}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={formalityLevel}
                    onChange={(e) => handleFormalityChange(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Meget uformel</span>
                    <span>Neutral</span>
                    <span>Meget formel</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Don't Say Section */}
          <div className="bg-white rounded-lg border border-gray-200">
            <button
              onClick={() => toggleSection('dontsay')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
            >
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Undgå disse fraser</h2>
                {!expandedSections.has('dontsay') && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {doNotSay.length > 0 ? `${doNotSay.length} fraser` : 'Ingen fraser tilføjet'}
                  </p>
                )}
              </div>
              <span className="text-gray-400">{expandedSections.has('dontsay') ? '▲' : '▼'}</span>
            </button>

            {expandedSections.has('dontsay') && (
              <div className="px-4 py-3 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Klichéer og fraser at undgå
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={doNotSayInput}
                    onChange={(e) => setDoNotSayInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddDoNotSay()}
                    placeholder='fx. "Velkommen til", "Vi tilbyder"...'
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    onClick={handleAddDoNotSay}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700"
                  >
                    Tilføj
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {doNotSay.map((phrase) => (
                    <span
                      key={phrase}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                    >
                      {phrase}
                      <button
                        onClick={() => handleRemoveDoNotSay(phrase)}
                        className="hover:text-red-900"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function getEmojiUsageLabel(usage: EmojiUsage): string {
  const labels: Record<EmojiUsage, string> = {
    none: 'Ingen emojis',
    minimal: 'Minimal',
    moderate: 'Moderat',
    frequent: 'Hyppig'
  }
  return labels[usage] || usage
}

function getFormalityLabel(level: number): string {
  const labels: Record<number, string> = {
    1: 'Meget uformel',
    2: 'Uformel',
    3: 'Neutral',
    4: 'Formel',
    5: 'Meget formel'
  }
  return labels[level] || 'Neutral'
}

export default BrandPage
