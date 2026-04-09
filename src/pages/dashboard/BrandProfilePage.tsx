import { useEffect, useState } from 'react'
import { fetchBrandProfile, generateBrandProfile } from '../../services/brandProfileService'

// Debug/reasoning fields for interim review (simulate backend fields)
const DEBUG_REASONING = {
  kendt: 'AI vurderede "kendt for" ud fra menu, anmeldelser og website.',
  hvem: 'AI identificerede målgruppe baseret på sprog, billedvalg og tidligere opslag.',
  kommunikationsmaal: 'AI satte kommunikationsmål ud fra virksomhedstype og ønsket effekt.'
}
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useTierStore } from '../../stores/tierStore'
import { BrandContextPanel } from './businessProfile/components/BrandContextPanel'
import { SocialStylePanel } from './businessProfile/components/SocialStylePanel'
import { VoiceExamplesPanel } from './businessProfile/components/VoiceExamplesPanel'

// Types for the new structured data
interface SocialStyle {
  emoji_usage: 'none' | 'minimal' | 'moderate' | 'expressive'
  emoji_examples: string[]
  hashtag_strategy: {
    branded: string[]
    category: string[]
    local: string[]
  }
}

interface VoiceExamples {
  do_say: string[]
  dont_say: string[]
  vocabulary: {
    prefer: string[]
    avoid: string[]
  }
}

export default function BrandProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentTier = useTierStore((state) => state.currentTier)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [brandVoice, setBrandVoice] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [ctaPreference, setCtaPreference] = useState('')
  const [brandContext, setBrandContext] = useState<string | null>(null)
  const [brandContextGeneratedAt, setBrandContextGeneratedAt] = useState<string | null>(null)
  const [brandContextApproved, setBrandContextApproved] = useState(false)
  const [isGeneratingBrandContext, setIsGeneratingBrandContext] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  // Reasoning/debug state
  const [reasoning, setReasoning] = useState<{ [key: string]: string }>({})
  const [analysisEvidence, setAnalysisEvidence] = useState<any>({})
  const [showReasoning, setShowReasoning] = useState({
    kendt: false,
    hvem: false,
    kommunikationsmaal: false
  })

  // Helper to format evidence/debug info
  const formatEvidence = (evidence: any) => {
    if (!evidence) return null
    if (typeof evidence === 'string') return evidence
    return Object.entries(evidence)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n')
  }
  
  // New structured brand profile fields
  const [socialStyle, setSocialStyle] = useState<SocialStyle | null>(null)
  const [voiceExamples, setVoiceExamples] = useState<VoiceExamples | null>(null)

  const markUnsaved = () => setHasUnsavedChanges(true)

  // Load profile data
  useEffect(() => {
    let isActive = true
    const fetchProfile = async () => {
      try {
        setIsLoadingProfile(true)
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user
        if (!user) return
        // Get businessId
        const { data: businessData, error: businessError } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle()
        if (businessError || !businessData) return
        const businessId = businessData.id
        // Fetch brand profile (UI fields)
        const uiProfile = await fetchBrandProfile(businessId)
        if (!isActive) return
        if (uiProfile) {
          setBrandVoice(uiProfile.tone_of_voice)
          setTargetAudience(uiProfile.target_audience)
          setCtaPreference(uiProfile.cta_style)
        }
        // Fetch full reasoning/debug from last AI generation
        const genResult = await generateBrandProfile(businessId)
        if (!isActive) return
        setReasoning({
          kendt: genResult.reason || '',
          hvem: genResult.reason || '',
          kommunikationsmaal: genResult.reason || ''
        })
        setAnalysisEvidence(genResult.analysisEvidence || {})
      } finally {
        if (isActive) setIsLoadingProfile(false)
      }
    }
    fetchProfile()
    return () => { isActive = false }
  }, [])

  const handleGenerateBrandContext = async () => {
    try {
      setIsGeneratingBrandContext(true)

      // Get current business data
      const { data: authData } = await supabase.auth.getSession()
      const user = authData?.session?.user
      if (!user) {
        alert('Du skal være logget ind')
        return
      }

      // Get business_id
      const { data: businessData } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!businessData) {
        alert('Forretningsprofil ikke fundet')
        return
      }

      // Get profile and location data
      const { data: profileData } = await supabase
        .from('business_profile')
        .select('*')
        .eq('business_id', (businessData as any).id)
        .maybeSingle()

      const { data: locationData } = await supabase
        .from('business_locations')
        .select('*')
        .eq('business_id', (businessData as any).id)
        .eq('is_primary', true)
        .maybeSingle()

      const { data: hoursData } = await supabase
        .from('opening_hours')
        .select('*')
        .eq('business_id', (businessData as any).id)
        .eq('kind', 'normal')

      // Parse menu structure
      let menuStructure = null
      if ((profileData as any)?.menu_structure) {
        try {
          menuStructure = typeof (profileData as any).menu_structure === 'string'
            ? JSON.parse((profileData as any).menu_structure)
            : (profileData as any).menu_structure
        } catch (e) {
          console.error('Failed to parse menu_structure:', e)
        }
      }

      // Prepare profile data for brand context generation
      const profileDataForAI = {
        businessName: (businessData as any).name,
        businessType: (businessData as any).category,
        businessSector: (businessData as any).vertical,
        description: (profileData as any)?.long_description,
        menuStructure: menuStructure?.categories?.length > 0 ? menuStructure.categories : null,
        location: {
          address: (locationData as any)?.address_line1 || undefined,
          city: (locationData as any)?.city || undefined,
          country: (locationData as any)?.country || undefined
        },
        openingHours: hoursData?.map((row: any) => ({
          weekday: row.weekday,
          open_time: row.open_time,
          close_time: row.close_time
        })) || [],
        websiteUrl: (businessData as any).website_url || null
      }

      // Call edge function
      const { data: session } = await supabase.auth.getSession()
      const authToken = session?.session?.access_token

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-brand-context`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ profileData: profileDataForAI })
        }
      )

      if (!response.ok) {
        throw new Error('Failed to generate brand context')
      }

      // Expect reasoning/debug info in response
      const { brandContext: generatedContext, reason, analysisEvidence } = await response.json()

      // Save to database
      const { error } = await supabase
        .from('business_profile')
        .upsert({
          business_id: (businessData as any).id,
          ai_brand_context: generatedContext,
          ai_brand_context_generated_at: new Date().toISOString(),
          ai_brand_context_approved: false,
          updated_at: new Date().toISOString()
        } as any, { onConflict: 'business_id' })

      if (error) {
        console.error('Failed to save brand context:', error)
        throw error
      }

      // Update state
      setBrandContext(generatedContext)
      setBrandContextGeneratedAt(new Date().toISOString())
      setBrandContextApproved(false)
      setReasoning({
        kendt: reason || '',
        hvem: reason || '',
        kommunikationsmaal: reason || ''
      })
      setAnalysisEvidence(analysisEvidence || {})

      console.log('✅ Brand context and reasoning/debug info generated successfully')

    } catch (error) {
      console.error('Error generating brand context:', error)
      alert('Kunne ikke generere brand context. Prøv igen.')
    } finally {
      setIsGeneratingBrandContext(false)
    }
  }

  const handleEditBrandContext = async (newContext: string) => {
    try {
      const { data: authData } = await supabase.auth.getSession()
      const user = authData?.session?.user
      if (!user) return

      const { data: businessData } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle<{ id: string }>()

      if (!businessData) return

      const { error } = await supabase
        .from('business_profile')
        .update({
          ai_brand_context: newContext,
          ai_brand_context_approved: false,
          updated_at: new Date().toISOString()
        })
        .eq('business_id', businessData.id)

      if (error) throw error

      setBrandContext(newContext)
      setBrandContextApproved(false)
      console.log('✅ Brand context updated')

    } catch (error) {
      console.error('Error updating brand context:', error)
      alert('Kunne ikke gemme ændringer')
    }
  }

  const handleApproveBrandContext = async () => {
    try {
      const { data: authData } = await supabase.auth.getSession()
      const user = authData?.session?.user
      if (!user) return

      const { data: businessData } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle<{ id: string }>()

      if (!businessData) return

      const { error } = await supabase
        .from('business_profile')
        .update({
          ai_brand_context_approved: true,
          updated_at: new Date().toISOString()
        })
        .eq('business_id', businessData.id)

      if (error) throw error

      setBrandContextApproved(true)
      console.log('✅ Brand context approved')

    } catch (error) {
      console.error('Error approving brand context:', error)
    }
  }

  const handleSaveBrand = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user

      if (!user) {
        alert(t('auth.notLoggedIn'))
        return
      }

      const { data: businessData, error: businessFetchError } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (businessFetchError || !businessData) {
        console.error('Failed to find business:', businessFetchError)
        alert('Kunne ikke finde din forretning. Prøv igen.')
        return
      }

      // Update business_profile with target audience
      const { error: profileError } = await (supabase
        .from('business_profile') as any)
        .upsert({
          business_id: (businessData as any).id,
          target_audience: targetAudience.trim() || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'business_id' })

      if (profileError) {
        console.error('Failed to save profile:', profileError.message)
      }

      // Update business_brand_profile
      const { error: brandError } = await (supabase
        .from('business_brand_profile') as any)
        .upsert({
          business_id: (businessData as any).id,
          voice_style: brandVoice.trim() || null,
          cta_preference: ctaPreference.trim() || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'business_id' })

      if (brandError) {
        console.error('Failed to save brand profile:', brandError.message)
        alert(t('businessProfile.saveFailed'))
        return
      }

      setHasUnsavedChanges(false)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 3000)
      
      console.log('✅ Brand profile saved successfully')
    } catch (error) {
      console.error('Unexpected error while saving brand profile:', error)
      alert(t('businessProfile.saveFailed'))
    }
  }

  const handleDeleteBrand = () => {
    setBrandContext(null)
    setBrandContextApproved(false)
    setBrandContextGeneratedAt(null)
    setBrandVoice('')
    setTargetAudience('')
    setCtaPreference('')
    markUnsaved()
  }

  if (isLoadingProfile) {
    return (
      <div className="flex min-h-full items-center justify-center py-12">
        <div className="text-sm text-gray-500">{t('common.loading')}</div>
      </div>
    )
  }

  // Show upgrade prompt for free tier users
  if (currentTier === 'free') {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-full py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4">🔒</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Brand Profil er kun tilgængelig i betalte pakker</h1>
              <p className="text-gray-600">
                Opgrader til Smart eller Pro for at oprette en omfattende brand profil med AI-genereret brand context.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-cta-surface to-purple-50 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Med Brand Profil får du:</h3>
              <ul className="text-left space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>AI-genereret brand context baseret på din virksomhedsprofil</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Definér din brand voice og tone of voice</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Præcisér din målgruppe for bedre AI-forslag</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Indstil CTA-præferencer for dine opslag</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Bedre og mere konsistent AI-genereret indhold</span>
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
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Brand Profil</h1>
          <p className="text-sm text-gray-600">Definer din brands stemme og målgruppe</p>
        </div>

        <div className="space-y-4">
          <BrandContextPanel
            brandContext={brandContext}
            isGenerating={isGeneratingBrandContext}
            generatedAt={brandContextGeneratedAt}
            approved={brandContextApproved}
            onGenerate={handleGenerateBrandContext}
            onEdit={handleEditBrandContext}
            onApprove={handleApproveBrandContext}
          />

          {/* Interim: Show/hide full AI reasoning/debug for 3 key fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Hvad I er kendt for */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-800">Hvad I er kendt for</span>
                <button
                  className="text-xs text-cta hover:underline"
                  onClick={() => setShowReasoning(s => ({ ...s, kendt: !s.kendt }))}
                >
                  {showReasoning.kendt ? 'Skjul AI-reasoning' : 'Vis AI-reasoning'}
                </button>
              </div>
              {showReasoning.kendt && (
                <div className="text-xs text-gray-600 bg-cta-surface border border-cta-surface rounded p-2 mt-1">
                  <div><strong>Reasoning:</strong> {reasoning.kendt || 'Ingen AI forklaring.'}</div>
                  {analysisEvidence && (
                    <div className="mt-2">
                      <strong>Debug/Evidence:</strong>
                      <pre className="whitespace-pre-wrap text-xs">{formatEvidence(analysisEvidence)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Hvem I henvender jer til */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-800">Hvem I henvender jer til</span>
                <button
                  className="text-xs text-cta hover:underline"
                  onClick={() => setShowReasoning(s => ({ ...s, hvem: !s.hvem }))}
                >
                  {showReasoning.hvem ? 'Skjul AI-reasoning' : 'Vis AI-reasoning'}
                </button>
              </div>
              {showReasoning.hvem && (
                <div className="text-xs text-gray-600 bg-cta-surface border border-cta-surface rounded p-2 mt-1">
                  <div><strong>Reasoning:</strong> {reasoning.hvem || 'Ingen AI forklaring.'}</div>
                  {analysisEvidence && (
                    <div className="mt-2">
                      <strong>Debug/Evidence:</strong>
                      <pre className="whitespace-pre-wrap text-xs">{formatEvidence(analysisEvidence)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Kommunikationsmål */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-800">Jeres kommunikationsmål</span>
                <button
                  className="text-xs text-cta hover:underline"
                  onClick={() => setShowReasoning(s => ({ ...s, kommunikationsmaal: !s.kommunikationsmaal }))}
                >
                  {showReasoning.kommunikationsmaal ? 'Skjul AI-reasoning' : 'Vis AI-reasoning'}
                </button>
              </div>
              {showReasoning.kommunikationsmaal && (
                <div className="text-xs text-gray-600 bg-cta-surface border border-cta-surface rounded p-2 mt-1">
                  <div><strong>Reasoning:</strong> {reasoning.kommunikationsmaal || 'Ingen AI forklaring.'}</div>
                  {analysisEvidence && (
                    <div className="mt-2">
                      <strong>Debug/Evidence:</strong>
                      <pre className="whitespace-pre-wrap text-xs">{formatEvidence(analysisEvidence)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* New AI-Generated Panels */}
          {(socialStyle || voiceExamples) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {socialStyle && <SocialStylePanel socialStyle={socialStyle} />}
              {voiceExamples && <VoiceExamplesPanel voiceExamples={voiceExamples} />}
            </div>
          )}

          {/* Save Gate for Brand */}
          <div className="bg-white border-2 border-gray-200 shadow-md rounded-lg px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Left: Helper text and status */}
              <div className="text-sm min-h-[24px] flex items-center">
                {justSaved ? (
                  <span className="text-green-600 font-medium flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Gemt ✓
                  </span>
                ) : hasUnsavedChanges ? (
                  <span className="text-gray-600">
                    Du har ændringer, der ikke er gemt
                  </span>
                ) : (
                  <span className="text-gray-500">
                    Gem din brand profil for bedre AI-genererede opslag
                  </span>
                )}
              </div>

              {/* Right: Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteBrand}
                  className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                >
                  Nulstil
                </button>
                <button
                  onClick={handleSaveBrand}
                  disabled={!hasUnsavedChanges}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    hasUnsavedChanges
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                      : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Gem ændringer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
