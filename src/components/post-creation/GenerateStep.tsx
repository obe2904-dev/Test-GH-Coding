import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { usePostCreationStore } from '../../stores/postCreationStore'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { useTierStore } from '../../stores/tierStore'
import { ProgressStepper } from '../ui/ProgressStepper'

interface GenerateStepProps {
  onNext: () => void
  onStepClick?: (step: number) => void
}

// Icon Components (compact sizes)
const Lightbulb = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M9 18h6M10 22h4M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
    <path d="M8.5 14C7 13 6 11.5 6 10a6 6 0 1 1 12 0c0 1.5-1 3-2.5 4"/>
  </svg>
)

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

const Globe = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

const Camera = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

const Type = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="4 7 4 4 20 4 20 7"/>
    <line x1="9" y1="20" x2="15" y2="20"/>
    <line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
)

const Hash = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <line x1="4" y1="9" x2="20" y2="9"/>
    <line x1="4" y1="15" x2="20" y2="15"/>
    <line x1="10" y1="3" x2="8" y2="21"/>
    <line x1="16" y1="3" x2="14" y2="21"/>
  </svg>
)

const Facebook = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const Instagram = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069L12 2.163zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
  </svg>
)

export function GenerateStep({ onNext, onStepClick }: GenerateStepProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const navigate = useNavigate()
  const { isEnabled, isConnected } = useConnectionsStore()
  const {
    selectedPlatforms,
    setSelectedPlatforms,
    aiIdeas,
    setAiIdeas,
    selectedIdea,
    setSelectedIdea,
    postContent,
    setPostContent
  } = usePostCreationStore()
  
  const {
    currentTier,
    getTierLimits,
    canUseAiIdeas,
    canUseCaptionGeneration,
    incrementAiIdeas,
    incrementCaptionGeneration,
    quotaUsage
  } = useTierStore()

  const [activeTab, setActiveTab] = useState<'ai' | 'custom'>(currentTier === 'free' ? 'custom' : 'ai')
  const [topicInput, setTopicInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [customIdea, setCustomIdea] = useState<any>(null)
  
  // Text editor state
  const [headline, setHeadline] = useState('')
  const [text, setText] = useState('')
  const [includeEmojis, setIncludeEmojis] = useState(true)
  const [includeHashtags, setIncludeHashtags] = useState(true)
  const [includeCTA, setIncludeCTA] = useState(true)
  const [isEdited, setIsEdited] = useState(false)
  const [isSpellingChecked, setIsSpellingChecked] = useState(false) // Track spelling check completion separately
  const [hashtags, setHashtags] = useState<string[]>([]) // Store all hashtags separately
  const [selectedHashtags, setSelectedHashtags] = useState<Set<string>>(new Set()) // Track which are selected
  const [originalTextWithCTA, setOriginalTextWithCTA] = useState<string>('') // Store original text with CTA
  const [originalTextWithoutCTA, setOriginalTextWithoutCTA] = useState<string>('') // Store text without CTA

  // Platform-specific editing state
  const [customizePerPlatform, setCustomizePerPlatform] = useState(false)
  const [activePlatform, setActivePlatform] = useState<string>('facebook')
  const [platformTexts, setPlatformTexts] = useState<Record<string, { headline: string; text: string }>>({
    facebook: { headline: '', text: '' },
    instagram: { headline: '', text: '' }
  })

  // Helper: Strip emojis from text
  const stripEmojis = (text: string) => {
    return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim()
  }

  // Helper: Extract hashtags from text
  const extractHashtags = (text: string): string[] => {
    const matches = text.match(/#[\wæøåÆØÅ]+/g)
    return matches || []
  }

  // Helper: Remove hashtags from text
  const removeHashtags = (text: string): string => {
    return text.replace(/#[\wæøåÆØÅ]+/g, '').trim()
  }

  // Helper: Extract CTA (improved detection - last 1-2 sentences with action words or links)
  const extractCTA = (text: string): string => {
    // Split into sentences
    const sentences = text.split(/(?<=[.!?])\s+/)
    if (sentences.length === 0) return ''
    
    // Check last 2 sentences for CTA patterns
    const lastTwo = sentences.slice(-2).join(' ')
    const lastOne = sentences[sentences.length - 1]
    
    // Patterns that indicate a CTA:
    // 1. Action verbs (Danish + English)
    // 2. URLs or "link in bio"
    // 3. Contact info patterns
    const ctaPattern = /kom|besøg|prøv|oplev|se|kik|følg|book|ring|kontakt|visit|try|check|click|call|shop|order|learn|discover|find|get|join|sign|start|link in bio|http|www\./i
    
    // Check if last sentence is a CTA
    if (ctaPattern.test(lastOne)) {
      return lastOne
    }
    
    // Check if last two sentences together form a CTA
    if (sentences.length > 1 && ctaPattern.test(lastTwo) && lastTwo.length < 100) {
      return sentences.slice(-2).join(' ')
    }
    
    return ''
  }

  // Helper: Remove CTA from text
  const removeCTA = (text: string): string => {
    const cta = extractCTA(text)
    if (cta) {
      // Remove the CTA and clean up extra whitespace/newlines
      return text.replace(cta, '').replace(/\s+$/, '').trim()
    }
    return text
  }

  // Get current text based on customization mode
  const getCurrentText = () => {
    if (customizePerPlatform) {
      return platformTexts[activePlatform] || { headline: '', text: '' }
    }
    return { headline, text }
  }

  // Update text based on customization mode
  const updateCurrentText = (field: 'headline' | 'text', value: string) => {
    setIsEdited(true) // Track manual edits
    setIsSpellingChecked(false) // Remove spelling check checkmark when text is edited
    
    // If updating text field, extract any new hashtags and remove them from text
    if (field === 'text') {
      const extractedHashtags = extractHashtags(value)
      const cleanValue = removeHashtags(value)
      
      // Add any new hashtags to the list
      if (extractedHashtags.length > 0) {
        const newHashtags = [...hashtags]
        const newSelected = new Set(selectedHashtags)
        
        extractedHashtags.forEach(tag => {
          if (!hashtags.includes(tag)) {
            newHashtags.push(tag)
            newSelected.add(tag) // Auto-select new hashtags
          }
        })
        
        setHashtags(newHashtags)
        setSelectedHashtags(newSelected)
      }
      
      // Use clean text without hashtags
      value = cleanValue
    }
    
    if (customizePerPlatform) {
      setPlatformTexts(prev => ({
        ...prev,
        [activePlatform]: {
          ...prev[activePlatform],
          [field]: value
        }
      }))
    } else {
      if (field === 'headline') setHeadline(value)
      else setText(value)
    }
  }

  // Sync unified text to all platforms when toggling customization
  const handleCustomizeToggle = (checked: boolean) => {
    if (checked) {
      // Copy current unified text to all selected platforms
      const updatedPlatforms = { ...platformTexts }
      selectedPlatforms.forEach(platform => {
        updatedPlatforms[platform] = { headline, text }
      })
      setPlatformTexts(updatedPlatforms)
    }
    setCustomizePerPlatform(checked)
  }

  // Initialize selected platforms with all enabled platforms
  useEffect(() => {
    const availablePlatforms = ['facebook', 'instagram'].filter(platform =>
      isEnabled(platform)
    )
    if (selectedPlatforms.length === 0) {
      setSelectedPlatforms(availablePlatforms)
    }
  }, [isEnabled, selectedPlatforms.length, setSelectedPlatforms])

  // Restore data from store when navigating back
  useEffect(() => {
    if (postContent) {
      // Restore headline and text
      setHeadline(postContent.headline || '')
      setText(postContent.text || '')
      
      // Restore adjustments
      setIncludeEmojis(postContent.adjustments?.includeEmojis ?? true)
      setIncludeHashtags(postContent.adjustments?.includeHashtags ?? true)
      
      // Restore hashtags if present
      if (postContent.hashtags && postContent.hashtags.length > 0) {
        const tags = postContent.hashtags.map(h => h.tag)
        const selectedTags = new Set(postContent.hashtags.filter(h => h.enabled).map(h => h.tag))
        setHashtags(tags)
        setSelectedHashtags(selectedTags)
      }
      
      // Restore platform-specific content if present
      if (postContent.platformSpecific && postContent.platformContent) {
        setCustomizePerPlatform(true)
        setPlatformTexts(
          Object.fromEntries(
            Object.entries(postContent.platformContent).map(([platform, content]) => [
              platform,
              { headline: content.headline, text: content.text }
            ])
          )
        )
      }
      
      // Also restore the selectedIdea state if we have content
      if (postContent.headline || postContent.text) {
        // Create a custom idea from the stored content
        const restoredIdea = {
          id: `restored-${Date.now()}`,
          title: 'Restored Content',
          headline: postContent.headline,
          text: postContent.text,
          type: 'custom'
        }
        setCustomIdea(restoredIdea)
        setSelectedIdea(restoredIdea.id)
      }
    }
  }, [postContent])

  const availablePlatforms = [
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'blue' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'pink' }
  ]

  const togglePlatform = (platformId: string) => {
    if (selectedPlatforms.includes(platformId)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platformId))
    } else {
      setSelectedPlatforms([...selectedPlatforms, platformId])
    }
  }

  const generateAiIdeas = async () => {
    if (!canUseAiIdeas()) {
      const limits = getTierLimits(currentTier)
      alert(t('generate.quotaExceeded', `You've reached your daily limit of ${limits.aiIdeasPerDay} AI ideas. ${currentTier === 'free' ? 'Upgrade to StandardPlus for unlimited ideas!' : 'Try again tomorrow.'}`))
      return
    }
    
    setIsGenerating(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const mockIdeas = [
      {
        id: `ai-${Date.now()}-1`,
        title: t('generate.aiIdea1Title', 'Weekend Special Offer'),
        headline: t('generate.aiIdea1Headline', '🔥 Weekend Special: 20% Off Everything!'),
        text: t('generate.aiIdea1Text', 'This weekend only! Get 20% off all our products. Perfect time to treat yourself or find that special gift. Visit us in-store or shop online. Limited time offer!') + '\n\n#WeekendSale #Shopping #Discount #SpecialOffer #LimitedTime',
        description: t('generate.aiIdea1Photo', 'Bright photo showing popular products with "20% OFF" overlay'),
        expectedEngagement: 'high',
        bestTime: '10:00 AM'
      },
      {
        id: `ai-${Date.now()}-2`,
        title: t('generate.aiIdea2Title', 'Customer Success Story'),
        headline: t('generate.aiIdea2Headline', '💬 What Our Customers Are Saying'),
        text: t('generate.aiIdea2Text', '"Absolutely love this place! The quality is outstanding and the service is exceptional. Highly recommend!" - Maria K. Thank you for your amazing support!') + '\n\n#CustomerReview #Testimonial #HappyCustomers #FiveStars',
        description: t('generate.aiIdea2Photo', 'Happy customer testimonial photo with quote overlay'),
        expectedEngagement: 'medium',
        bestTime: '2:00 PM'
      },
      {
        id: `ai-${Date.now()}-3`,
        title: t('generate.aiIdea3Title', 'Behind the Scenes'),
        headline: t('generate.aiIdea3Headline', '👀 Behind the Scenes at [Your Business]'),
        text: t('generate.aiIdea3Text', 'Ever wondered how we create our products? Take a peek behind the curtain! Our team works hard every day to bring you the best quality. Check out our process!') + '\n\n#BehindTheScenes #TeamWork #Quality #Process #MadeWithLove',
        description: t('generate.aiIdea3Photo', 'Authentic workspace photo showing team or production process'),
        expectedEngagement: 'medium',
        bestTime: '11:00 AM'
      }
    ]
    
    setAiIdeas(mockIdeas)
    incrementAiIdeas()
    setIsGenerating(false)
  }

  const generateCustomIdea = async () => {
    if (!canUseCaptionGeneration()) {
      const limits = getTierLimits(currentTier)
      alert(t('generate.quotaExceeded', `You've reached your daily limit of ${limits.captionGenerationsPerDay} caption generations.`))
      return
    }
    
    if (!topicInput.trim()) {
      alert(t('generate.enterTopic', 'Please enter a topic first'))
      return
    }
    
    setIsGenerating(true)
    
    try {
      // ✅ NEW: Call Supabase Edge Function (Direct OpenAI - 98.5% cheaper!)
      const apiUrl = import.meta.env.VITE_SUPABASE_FUNCTION_AI_GENERATE
      console.log('🔍 API URL:', apiUrl)

      if (!apiUrl) {
        alert('ERROR: VITE_SUPABASE_FUNCTION_AI_GENERATE not set in .env!')
        setIsGenerating(false)
        return
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
     topic: topicInput,
     businessType: 'cafe',
     platforms: selectedPlatforms,
     // ✅ NEW: Send user preferences
     includeEmojis: includeEmojis,
     includeHashtags: includeHashtags,
     includeCTA: includeCTA,
     tone: 'objective',
     length: 'medium'
   })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate AI content')
      }

      const data = await response.json()
      
      console.log('✅ Direct OpenAI success! Cost: ~$0.001 (was $0.0645)')
      console.log('Variations:', data.variations)
      
      if (!data.variations || data.variations.length === 0) {
        throw new Error('No variations returned')
      }
      
      const firstVariation = data.variations[0]
      
      // Extract hashtags and remove from text
      const allText = `${firstVariation.text}\n\n${firstVariation.hashtags}`
      const extractedHashtags = extractHashtags(allText)
      
      // Remove duplicates from hashtags (AI sometimes generates duplicates)
      const uniqueHashtags = Array.from(new Set(extractedHashtags))
      
      // Clean text: remove hashtags and trim any weird trailing text
      let cleanText = removeHashtags(allText)
      
      // Remove any trailing weird fragments (like "éoplevelse")
      // Keep only text that ends with proper punctuation or emojis
      cleanText = cleanText.replace(/\s+[^\s.!?]+\s*$/, '').trim()
      
      // Store both versions for CTA toggle
      const textWithCTA = cleanText
      const textWithoutCTA = removeCTA(cleanText)
      
      const newIdea = {
        id: `custom-${Date.now()}`,
        title: topicInput,
        headline: firstVariation.headline,
        text: cleanText,
        description: `AI-generated post for ${firstVariation.platform || 'social media'}`,
        type: 'custom',
        allVariations: data.variations, // All platform versions
        originalContent: firstVariation // Store original for restoring
      }
      
      setCustomIdea(newIdea)
      setSelectedIdea(newIdea.id)
      setHeadline(firstVariation.headline)
      setText(includeCTA ? textWithCTA : textWithoutCTA) // Respect initial toggle state
      setOriginalTextWithCTA(textWithCTA) // Store for toggling
      setOriginalTextWithoutCTA(textWithoutCTA) // Store for toggling
      setHashtags(uniqueHashtags)
      setSelectedHashtags(new Set(uniqueHashtags)) // All selected by default
      setIsEdited(false) // Reset edit tracking when AI generates
      setIsSpellingChecked(true) // New AI content is considered spell-checked
      incrementCaptionGeneration()
    } catch (error: any) {
      console.error('Error generating AI content:', error)
      alert(t('generate.aiError', `Failed to generate AI content: ${error.message}`))
    } finally {
      setIsGenerating(false)
    }
  }

  // Handle emoji toggle - instant text manipulation
  const handleEmojiToggle = (checked: boolean) => {
    setIncludeEmojis(checked)
    
    if (!checked) {
      // Remove emojis
      updateCurrentText('headline', stripEmojis(getCurrentText().headline))
      updateCurrentText('text', stripEmojis(getCurrentText().text))
    } else {
      // Restore from original AI content (without hashtags)
      if (customIdea?.originalContent) {
        updateCurrentText('headline', customIdea.originalContent.headline)
        const cleanText = removeHashtags(customIdea.originalContent.text)
        updateCurrentText('text', cleanText)
      }
    }
  }

  // Handle CTA toggle - instant text manipulation
  const handleCTAToggle = (checked: boolean) => {
    setIncludeCTA(checked)
    
    // Use stored versions if available (from AI generation)
    if (originalTextWithCTA && originalTextWithoutCTA) {
      if (checked) {
        updateCurrentText('text', originalTextWithCTA)
      } else {
        updateCurrentText('text', originalTextWithoutCTA)
      }
    } else {
      // Fallback: try to detect and remove CTA dynamically
      const currentText = getCurrentText().text
      if (!checked) {
        updateCurrentText('text', removeCTA(currentText))
      } else {
        // Can't restore CTA if we don't have the original
        // Just keep current text
      }
    }
  }

  // Handle spelling check for manual edits
  const handleSpellingCheck = async () => {
    if (!canUseCaptionGeneration()) {
      const limits = getTierLimits(currentTier)
      alert(t('generate.quotaExceeded', `You've reached your daily limit of ${limits.captionGenerationsPerDay} caption improvements.`))
      return
    }
    
    setIsGenerating(true)
    
    try {
      const currentContent = getCurrentText()
      
      const response = await fetch(import.meta.env.VITE_SUPABASE_FUNCTION_AI_GENERATE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          topic: `Fix spelling and grammar ONLY. Keep all content, emojis, and hashtags exactly as written: "${currentContent.headline}" - ${currentContent.text}`,
          businessType: 'cafe',
          platforms: customizePerPlatform ? [activePlatform] : selectedPlatforms,
          includeEmojis: true, // Keep whatever is there
          includeHashtags: true, // Keep whatever is there
          includeCTA: true, // Keep whatever is there
          tone: 'objective',
          length: 'medium'
        })
      })

      if (!response.ok) throw new Error('Failed to check spelling')

      const data = await response.json()
      
      if (data.variations && data.variations.length > 0) {
        const fixed = data.variations[0]
        // Remove hashtags from fixed text
        const allText = `${fixed.text}\n\n${fixed.hashtags}`
        const cleanText = removeHashtags(allText)
        
        // Update text without triggering isEdited flag
        if (customizePerPlatform) {
          setPlatformTexts(prev => ({
            ...prev,
            [activePlatform]: {
              headline: fixed.headline,
              text: cleanText
            }
          }))
        } else {
          setHeadline(fixed.headline)
          setText(cleanText)
        }
        
        setIsSpellingChecked(true) // Mark spelling as checked
      }
      
      incrementCaptionGeneration()
    } catch (error) {
      console.error('Error checking spelling:', error)
      alert(t('generate.aiError', 'Failed to check spelling.'))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleNext = () => {
    if (selectedPlatforms.length === 0 || !selectedIdea) return
    
    const currentIdea = [...aiIdeas, customIdea].find(i => i?.id === selectedIdea)
    
    // Convert hashtags to PlatformHashtag format
    const platformHashtags = hashtags.map(tag => ({
      tag,
      enabled: selectedHashtags.has(tag)
    }))
    
    if (customizePerPlatform && selectedPlatforms.length > 1) {
      // Save platform-specific content
      const platformContent: Record<string, any> = {}
      selectedPlatforms.forEach(platform => {
        const platformText = platformTexts[platform] || { headline: '', text: '' }
        platformContent[platform] = {
          headline: platformText.headline || (currentIdea?.headline ?? ''),
          text: platformText.text || (currentIdea?.text ?? ''),
          adjustments: {
            length: 'current',
            tone: 'professional',
            includeHashtags,
            includeEmojis,
            includeBookingLink: false
          },
          hashtags: platformHashtags
        }
      })
      
      setPostContent({
        headline: headline || (currentIdea?.headline ?? ''),
        text: text || (currentIdea?.text ?? ''),
        platformSpecific: true,
        platformContent,
        adjustments: {
          length: 'current',
          tone: 'professional',
          includeHashtags,
          includeEmojis,
          includeBookingLink: false
        }
      })
    } else {
      // Save unified content
      setPostContent({
        headline: headline || (currentIdea?.headline ?? ''),
        text: text || (currentIdea?.text ?? ''),
        platformSpecific: false,
        adjustments: {
          length: 'current',
          tone: 'professional',
          includeHashtags,
          includeEmojis,
          includeBookingLink: false
        },
        hashtags: platformHashtags
      })
    }
    
    onNext()
  }

  const selectIdea = (idea: any) => {
    setSelectedIdea(idea.id)
    
    // Extract hashtags and clean text
    const extractedHashtags = extractHashtags(idea.text)
    
    // Remove duplicates from hashtags
    const uniqueHashtags = Array.from(new Set(extractedHashtags))
    
    // Clean text: remove hashtags and trim weird trailing text
    let cleanText = removeHashtags(idea.text)
    cleanText = cleanText.replace(/\s+[^\s.!?]+\s*$/, '').trim()
    
    // Store both versions for CTA toggle
    const textWithCTA = cleanText
    const textWithoutCTA = removeCTA(cleanText)
    
    setHeadline(idea.headline)
    setText(includeCTA ? textWithCTA : textWithoutCTA) // Respect current toggle state
    setOriginalTextWithCTA(textWithCTA) // Store for toggling
    setOriginalTextWithoutCTA(textWithoutCTA) // Store for toggling
    setHashtags(uniqueHashtags)
    setSelectedHashtags(new Set(uniqueHashtags)) // All selected by default
    setIsEdited(false) // AI-generated content is not considered edited
    setIsSpellingChecked(true) // AI-generated content is pre-checked
    
    // Also populate platform-specific texts with the same content initially
    const initialPlatformTexts: Record<string, { headline: string; text: string }> = {}
    selectedPlatforms.forEach(platform => {
      initialPlatformTexts[platform] = {
        headline: idea.headline,
        text: includeCTA ? textWithCTA : textWithoutCTA
      }
    })
    setPlatformTexts(initialPlatformTexts)
  }

  const limits = getTierLimits(currentTier)
  // AI Ideas tab always shows AI ideas quota (0/3 for free tier)
  const aiIdeasQuota = `${quotaUsage.aiIdeasToday}/${limits.aiIdeasPerDay === -1 ? '∞' : limits.aiIdeasPerDay}`

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center mb-3">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          {t('generate.title')}
        </h1>
        <p className="text-sm text-slate-600">
          {t('generate.subtitle')}
        </p>
      </div>

      {/* Progress Stepper */}
      <ProgressStepper currentStep={1} totalSteps={3} onStepClick={onStepClick} />

      {/* Platform Selection - COMPACT */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 p-1.5 rounded-lg">
              <Globe className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800">
                {t('generate.selectPlatforms', 'Where do you want to post?')}
              </h3>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-600">
                  {t('generate.platformHint', 'Choose one or more platforms')}
                </p>
                <button 
                  onClick={() => navigate('/dashboard/profile')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  {t('generate.updatePlatforms', 'Update platforms')}
                </button>
              </div>
            </div>
          </div>
          
          {/* Platform icons moved to right corner */}
          <div className="flex gap-2">
            {availablePlatforms.map((platform) => {
              const platformEnabled = isEnabled(platform.id)
              const platformConnected = isConnected(platform.id)
              const isSelected = selectedPlatforms.includes(platform.id)
              const Icon = platform.icon
              
              // Determine status: connected (green), not connected (red), not used (gray)
              const statusDotColor = platformEnabled && platformConnected 
                ? 'bg-green-500' 
                : platformEnabled 
                  ? 'bg-red-500' 
                  : 'bg-gray-400'
              
              // Tooltip text for status
              const statusTooltip = !platformEnabled
                ? t('generate.notUsed', 'Not used')
                : platformConnected
                  ? t('generate.connected', 'Connected')
                  : t('generate.notConnected', 'Not connected')

              return (
                <button
                  key={platform.id}
                  onClick={() => platformEnabled && togglePlatform(platform.id)}
                  disabled={!platformEnabled}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all
                    ${isSelected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                    }
                    ${!platformEnabled && 'opacity-50 cursor-not-allowed'}
                  `}
                >
                  <Icon className={`w-4 h-4 ${platform.color === 'blue' ? 'text-blue-600' : 'text-pink-600'}`} />
                  <span className="text-xs font-medium text-slate-800">{platform.name}</span>
                  <div 
                    className={`w-2 h-2 rounded-full ${statusDotColor}`}
                    title={statusTooltip}
                  />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* AI/Custom Toggle - COMPACT */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 px-3 py-1.5 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-1.5
              ${activeTab === 'ai'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('generate.aiIdeas', 'AI Ideas')}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/20">
              {aiIdeasQuota}
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 px-3 py-1.5 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-1.5
              ${activeTab === 'custom'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>{t('generate.customIdea', 'Custom Idea')}</span>
          </button>
        </div>

        {/* AI Ideas Tab - COMPACT */}
        {activeTab === 'ai' && (
          <div className="space-y-3">
            {aiIdeas.length === 0 ? (
              <div className="text-center py-6">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-full p-3 w-12 h-12 mx-auto mb-2 flex items-center justify-center">
                  <Wand className="w-6 h-6 text-purple-600" />
                </div>
                <p className="text-sm text-slate-600 mb-3">
                  {t('generate.noIdeasYet', 'Click below to generate AI ideas')}
                </p>
                <button
                  onClick={generateAiIdeas}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all text-sm font-bold shadow-md flex items-center gap-1.5 mx-auto"
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
                      onSelect={() => selectIdea(idea)}
                      type="ai"
                    />
                  ))}
                </div>
                <button
                  onClick={generateAiIdeas}
                  disabled={isGenerating}
                  className="w-full px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all text-sm font-medium"
                >
                  {t('generate.generateMore', '🔄 Generer flere ideer')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Custom Tab - COMPACT */}
        {activeTab === 'custom' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder={t('generate.topicPlaceholder', 'What is your post about?')}
                className="flex-1 px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
                onKeyPress={(e) => e.key === 'Enter' && generateCustomIdea()}
              />
              <button
                onClick={generateCustomIdea}
                disabled={isGenerating || !topicInput.trim()}
                className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all text-sm font-medium shadow-md flex items-center gap-1.5"
              >
                {isGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </>
                ) : (
                  <>
                    <Wand className="w-3.5 h-3.5" />
                    <span>{t('generate.generate', 'Generate')}</span>
                  </>
                )}
              </button>
            </div>

            {customIdea && (
              <IdeaCard
                idea={customIdea}
                isSelected={true}
                onSelect={() => {}}
                type="custom"
              />
            )}

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-2">
              <p className="text-xs text-indigo-800 flex items-start gap-1.5">
                <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  {t('generate.customTip', 'Tip: Be specific about your topic. AI will help you create engaging content.')}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Text Editor Section - COMPACT with Platform Tabs */}
      {/* Only show if: AI Ideas tab + AI idea selected, OR Custom tab + custom idea exists */}
      {((activeTab === 'ai' && selectedIdea && selectedIdea.startsWith('ai-')) || 
        (activeTab === 'custom' && customIdea && selectedIdea === customIdea.id)) && (
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-indigo-100 p-1.5 rounded-lg">
              <Type className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {t('generate.writeYourPost', 'Write Your Post')}
              </h3>
              <p className="text-xs text-slate-600">
                {t('generate.editAndImprove', 'Edit the generated text or write your own')}
              </p>
            </div>
          </div>

          {/* Platform Tabs - Only show if multiple platforms selected */}
          {selectedPlatforms.length > 1 && (
            <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2">
              {availablePlatforms
                .filter(p => selectedPlatforms.includes(p.id))
                .map(platformInfo => {
                const platform = platformInfo.id
                const Icon = platformInfo.icon
                const isActive = activePlatform === platform
                
                return (
                  <button
                    key={platform}
                    onClick={() => setActivePlatform(platform)}
                    disabled={!customizePerPlatform}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-sm font-medium transition-all ${
                      customizePerPlatform
                        ? isActive
                          ? 'bg-white border-b-2 border-indigo-600 text-indigo-600'
                          : 'text-slate-600 hover:text-slate-800 cursor-pointer'
                        : 'text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{platformInfo.name}</span>
                    {isConnected(platform) && (
                      <Check className="w-3 h-3 text-emerald-600" />
                    )}
                  </button>
                )
              })}
              
              <div className="ml-auto flex items-center gap-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 px-3 py-1.5 rounded-lg border border-indigo-200">
                <input
                  type="checkbox"
                  id="customizePerPlatform"
                  checked={customizePerPlatform}
                  onChange={(e) => handleCustomizeToggle(e.target.checked)}
                  className="w-3 h-3 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="customizePerPlatform" className="text-xs font-bold text-indigo-700 cursor-pointer">
                  {t('generate.customizePerPlatform', 'Customize per platform')}
                </label>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {/* Platform indicator when customizing */}
            {customizePerPlatform && selectedPlatforms.length > 1 && (
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-2 py-1.5 rounded-lg">
                {(() => {
                  const platformInfo = availablePlatforms.find(p => p.id === activePlatform)
                  if (!platformInfo) return null
                  const Icon = platformInfo.icon
                  return (
                    <>
                      <Icon className="w-4 h-4" />
                      <span className="font-medium">{platformInfo.name} {t('generate.version', 'version')}</span>
                    </>
                  )
                })()}
              </div>
            )}

            {/* Headline Input - COMPACT */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('generate.headline', 'Headline')}
              </label>
              <input
                type="text"
                value={getCurrentText().headline}
                onChange={(e) => updateCurrentText('headline', e.target.value)}
                placeholder={t('generate.headlinePlaceholder', 'e.g., "Weekend Special 🔥"')}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base font-semibold"
              />
            </div>

            {/* Text Textarea - COMPACT */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {t('generate.postText', 'Post Text')}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {getCurrentText().text.length} {t('generate.characters', 'characters')}
                  </span>
                  {customizePerPlatform && (
                    <>
                      {activePlatform === 'instagram' && getCurrentText().text.length > 125 && (
                        <span className="text-xs text-amber-600 flex items-center gap-1">
                          ⚠️ {t('generate.longForInstagram', 'Long for Instagram')}
                        </span>
                      )}
                      {activePlatform === 'facebook' && getCurrentText().text.length > 300 && (
                        <span className="text-xs text-amber-600 flex items-center gap-1">
                          ⚠️ {t('generate.veryLong', 'Very long')}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <textarea
                value={getCurrentText().text}
                onChange={(e) => updateCurrentText('text', e.target.value)}
                placeholder={t('generate.textPlaceholder', 'Write your post here...')}
                rows={4}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base resize-none"
              />
            </div>

            {/* Edit Controls Section */}
            <div className="space-y-3">
              {/* Hashtag Chips - Moved to top */}
              {hashtags.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                <div className="flex items-center gap-1 mb-1.5">
                  <Hash className="w-3 h-3 text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-700">{t('generate.hashtags', 'Hashtags')}</span>
                  <span className="text-xs text-slate-500">
                    ({includeHashtags ? Array.from(selectedHashtags).length : 0}/{hashtags.length} selected)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((tag, idx) => {
                    // If includeHashtags is false, show all as deselected
                    const isSelected = includeHashtags && selectedHashtags.has(tag)
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          // Only allow individual toggling if includeHashtags is true
                          if (includeHashtags) {
                            const newSelected = new Set(selectedHashtags)
                            if (isSelected) {
                              newSelected.delete(tag)
                            } else {
                              newSelected.add(tag)
                            }
                            setSelectedHashtags(newSelected)
                          }
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded text-xs transition-colors ${
                          isSelected
                            ? 'bg-green-50 border-green-300 text-green-700'
                            : 'bg-red-50 border-red-300 text-red-700'
                        } ${!includeHashtags ? 'opacity-75' : 'cursor-pointer'}`}
                      >
                        {isSelected ? '✓' : '×'}
                        <span>{tag}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Edit Controls: Toggles and Spelling Check */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-slate-700">
                <button 
                  onClick={() => handleEmojiToggle(!includeEmojis)}
                  className="flex items-center gap-1 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  {includeEmojis ? '✅' : '⬜'} {t('generate.emojisIncluded', 'Emojis included')}
                </button>
                <button 
                  onClick={() => setIncludeHashtags(!includeHashtags)}
                  className="flex items-center gap-1 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  {includeHashtags ? '✅' : '⬜'} {t('generate.hashtagsIncluded', 'Hashtags included')}
                </button>
                <button 
                  onClick={() => handleCTAToggle(!includeCTA)}
                  className="flex items-center gap-1 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  {includeCTA ? '✅' : '⬜'} {t('generate.ctaIncluded', 'CTA: Call to action')}
                </button>
              </div>

              {/* Right: Spelling Check - Always visible with frame */}
              <button
                onClick={handleSpellingCheck}
                disabled={isGenerating || !isEdited}
                className={`px-3 py-1.5 rounded-lg border-2 font-semibold text-xs flex items-center gap-1.5 transition-all ${
                  isSpellingChecked && !isEdited
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 cursor-default'
                    : isGenerating
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-600 cursor-wait'
                      : 'bg-white border-indigo-500 text-indigo-600 hover:bg-indigo-50 cursor-pointer'
                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span>{t('generate.checking', 'Checking...')}</span>
                  </>
                ) : isSpellingChecked && !isEdited ? (
                  <>
                    <span className="text-base">✓</span>
                    <span>{t('generate.spellingChecked', 'Spelling checked')}</span>
                  </>
                ) : (
                  <>
                    <span className="text-base">✓</span>
                    <span>{t('generate.checkSpelling', 'Check spelling')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Bottom Row: Tone & Length (Locked for Free) */}
              <div className="flex items-center gap-3">
                {/* Tone Dropdown */}
                <div className="relative flex-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('generate.tone', 'Tone')}
                  </label>
                  <div className="relative">
                    <select
                      disabled={currentTier === 'free'}
                      defaultValue="objective"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed appearance-none pr-8"
                    >
                      <option value="objective">{t('generate.toneObjective', 'Objective & Neutral')}</option>
                      <option value="warm">{t('generate.toneWarm', 'Warm & Welcoming')}</option>
                      <option value="passionate">{t('generate.tonePassionate', 'Passionate & Enthusiastic')}</option>
                    </select>
                    {currentTier === 'free' && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-500">
                        🔒
                      </span>
                    )}
                  </div>
                </div>

                {/* Length Dropdown */}
                <div className="relative flex-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('generate.length', 'Length')}
                  </label>
                  <div className="relative">
                    <select
                      disabled={currentTier === 'free'}
                      defaultValue="medium"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed appearance-none pr-8"
                    >
                      <option value="short">{t('generate.lengthShort', 'Short')}</option>
                      <option value="medium">{t('generate.lengthMedium', 'Medium')}</option>
                      <option value="long">{t('generate.lengthLong', 'Long')}</option>
                    </select>
                    {currentTier === 'free' && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-500">
                        🔒
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Platform-specific tips */}
              {customizePerPlatform && selectedPlatforms.length > 1 && (
                <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-800 flex items-start gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      {activePlatform === 'facebook' 
                        ? t('generate.facebookTip', 'Facebook tip: Longer posts with links work well. Use 2-3 hashtags.')
                        : t('generate.instagramTip', 'Instagram tip: Shorter captions with 10-15 hashtags. Focus on visual storytelling.')
                      }
                    </span>
                  </p>
                </div>
              )}

              {/* Upgrade Message for Free Users */}
              {currentTier === 'free' && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-2">
                  <p className="text-xs text-amber-800 flex items-center gap-1.5">
                    ⭐ <span className="font-semibold">{t('generate.upgradeToStandardPlus', 'Upgrade to StandardPlus')}</span> {t('generate.upgradeMessage', 'to choose tone and length for your posts')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo Suggestion Section - Only for custom ideas */}
      {selectedIdea && activeTab === 'custom' && customIdea?.description && (
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
          <div className="flex items-start gap-2">
            <div className="bg-indigo-100 p-1.5 rounded-lg">
              <Camera className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                {t('generate.photoSuggestion', 'Foto ide')}
              </h3>
              <p className="text-sm text-slate-600">{customIdea.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Continue Button - COMPACT */}
      <div className="flex justify-between items-center pt-2 pb-4">
        <div className="text-xs text-slate-600">
          ⏱️ {t('generate.timeEstimate', 'Estimated time')}: <span className="font-semibold text-indigo-600">3 {t('generate.minutes', 'min')}</span>
        </div>
        
        <button
          onClick={handleNext}
          disabled={selectedPlatforms.length === 0 || !selectedIdea}
          className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-base shadow-md flex items-center gap-1.5"
        >
          <span>{t('generate.continue', 'Continue to Create')}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Idea Card Component - COMPACT
interface IdeaCardProps {
  idea: any
  isSelected: boolean
  onSelect: () => void
  type: 'ai' | 'custom'
}

function IdeaCard({ idea, isSelected, onSelect, type }: IdeaCardProps) {
  const { t } = useTranslation()
  
  // For custom ideas, don't render the card at all (photo suggestion moved to bottom)
  if (type === 'custom') {
    return null
  }
  
  const borderColor = type === 'ai' 
    ? (isSelected ? 'border-purple-500' : 'border-slate-200')
    : (isSelected ? 'border-indigo-500' : 'border-slate-200')
  
  const bgColor = type === 'ai'
    ? (isSelected ? 'bg-purple-50' : 'bg-white')
    : (isSelected ? 'bg-indigo-50' : 'bg-white')

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border p-3 transition-all hover:shadow-md ${borderColor} ${bgColor}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="text-sm font-bold text-slate-800 mb-0.5">{idea.title}</h4>
          <p className="text-sm text-slate-600">{idea.headline}</p>
        </div>
        
        {isSelected && (
          <div className="bg-purple-600 text-white rounded-full p-1">
            <Check className="w-3 h-3" />
          </div>
        )}
      </div>

      <p className="text-sm text-slate-700 mb-2 line-clamp-2">{idea.text}</p>

      {idea.description && (
        <div className="flex items-start gap-1.5 p-2 bg-white rounded-lg border border-slate-200">
          <Camera className="w-3 h-3 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-0.5">
              {t('generate.photoSuggestion', 'Foto ide')}:
            </p>
            <p className="text-xs text-slate-600">{idea.description}</p>
          </div>
        </div>
      )}
    </div>
  )
}
