import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useTierStore } from '../../stores/tierStore'
import { LoadingSpinner } from '../../components/ui/Feedback'
import { AnalyzeIcon } from './BusinessProfileIcons'

type MenuStatus = 'pending' | 'extracting' | 'extracted' | 'error'
type MenuType = 'standard' | 'special'

interface MenuCard {
  id: string
  source_url: string
  menu_type: MenuType
  label: string
  status: MenuStatus
  error_message?: string
  extracted_data?: {
    menuTitle?: string
    availabilityTime?: string
    availabilityDays?: string
    menuSubtitle?: string
    menuPeriods?: Array<{ startTime: string; endTime: string }>
    categories: Array<{
      name: string
      timeRange?: string | null
      items: Array<{
        name: string
        description?: string
        short_desc?: string
        price?: string | number
      }>
    }>
  }
  average_price?: number
  item_count?: number
  ai_summary?: string
  is_social_lead?: boolean
  created_at: string
  // Flat timing columns from menu_results_v2
  result_id?: string
  menu_type_extracted?: string | null
  time_start?: string | null
  time_end?: string | null
  time_source?: string | null
  time_confirmed?: boolean
}

const TIME_HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const TIME_MINUTE_OPTIONS = ['00', '15', '30', '45']

function splitTimeValue(value: string) {
  const [hour = '', minute = ''] = value.split(':')
  return { hour, minute }
}

function joinTimeValue(hour: string, minute: string) {
  if (!hour && !minute) return ''
  return `${hour || '00'}:${minute || '00'}`
}

function MenuPage() {
  const { t, i18n } = useTranslation()
  const currentTier = useTierStore((state) => state.currentTier)

  const [businessId, setBusinessId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [menuCards, setMenuCards] = useState<MenuCard[]>([])
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<any>(null)
  const [activeExtractions, setActiveExtractions] = useState<Set<string>>(new Set())
  const [extractionQueue, setExtractionQueue] = useState<Array<{cardId: string; sourceUrl: string}>>([])
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  const [isDetectingMenus, setIsDetectingMenus] = useState(false)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [showAddLink, setShowAddLink] = useState(false)
  const [showAddText, setShowAddText] = useState(false)
  const [newMenuInput, setNewMenuInput] = useState('')
  const [newTextInput, setNewTextInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [detectedUrls, setDetectedUrls] = useState<Array<{url: string; isExisting: boolean}>>([])
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())
  
  // Pricing state
  const [priceLevel, setPriceLevel] = useState<string>('')
  const [isEditingPricing, setIsEditingPricing] = useState(false)
  const [isSavingPricing, setIsSavingPricing] = useState(false)

  // Timing edit state
  const [editingTimingCardId, setEditingTimingCardId] = useState<string | null>(null)
  const [editingTimeStart, setEditingTimeStart] = useState('')
  const [editingTimeEnd, setEditingTimeEnd] = useState('')
  const [isSavingTiming, setIsSavingTiming] = useState(false)

  // Normalized item flags (is_signature toggle)
  // keyed by item_name.toLowerCase() → { id, is_signature }
  const [normalizedItems, setNormalizedItems] = useState<Map<string, { id: string; is_signature: boolean }>>(new Map())
  
  // Store polling intervals for cleanup
  const pollIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const operationsUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Queue processor - extracts one menu at a time
  useEffect(() => {
    const processQueue = async () => {
      if (isProcessingQueue || extractionQueue.length === 0) return
      
      setIsProcessingQueue(true)
      const next = extractionQueue[0]
      
      try {
        console.log(`🔄 Processing queue: ${extractionQueue.length} items remaining`)
        await extractMenuInternal(next.cardId, next.sourceUrl)
      } catch (error) {
        console.error('Queue processing error:', error)
      } finally {
        // Remove processed item from queue
        setExtractionQueue(prev => prev.slice(1))
        setIsProcessingQueue(false)
      }
    }
    
    processQueue()
  }, [extractionQueue, isProcessingQueue])

  // Cleanup all polling intervals on unmount
  useEffect(() => {
    return () => {
      pollIntervalsRef.current.forEach(interval => clearInterval(interval))
      pollIntervalsRef.current.clear()
      if (operationsUpdateTimeoutRef.current) {
        clearTimeout(operationsUpdateTimeoutRef.current)
      }
    }
  }, [])

  // Load business data
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
          .select('id, website_url')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (!businessData) return
        if (!isActive) return

        setBusinessId((businessData as any).id)
        setWebsiteUrl((businessData as any).website_url || '')

        await loadMenuCards((businessData as any).id)
        await loadPricingData((businessData as any).id)
        await loadNormalizedItems((businessData as any).id)
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    fetchData()

    return () => {
      isActive = false
    }
  }, [])

  const loadMenuCards = async (bizId: string) => {
    try {
      // Load menu sources
      const { data: sources } = await supabase
        .from('menu_sources')
        .select('*')
        .eq('business_id', bizId)
        .order('created_at', { ascending: false })

      if (!sources) {
        setMenuCards([])
        return
      }

      // Load results from menu_results_v2 (the queue system)
      const { data: results } = await supabase
        .from('menu_results_v2')
        .select('id, source_id, source_url, status, error_message, structured_data, ai_summary, menu_type, time_start, time_end, time_source, time_confirmed')
        .eq('business_id', bizId)
        .order('created_at', { ascending: false })

      // Map results by source_id (menu_sources.id) for accurate matching
      // Note: Old results without source_id will also be mapped by URL as fallback
      const resultMap = new Map(
        (results || []).map((r: any) => [r.source_id || r.source_url, r])
      )

      const cards: MenuCard[] = sources.map((source: any) => {
        // First try to find by source_id (accurate)
        let result = resultMap.get(source.id)
        
        // Only use URL fallback if result has no source_id (legacy data)
        // Don't match results that belong to other sources (different source_id)
        if (!result) {
          const urlMatch = resultMap.get(source.source_url)
          if (urlMatch && !urlMatch.source_id) {
            // Legacy result without source_id - OK to use
            result = urlMatch
          }
          // If urlMatch has a different source_id, ignore it (belongs to deleted source)
        }
        
        if (result) {
          console.log(`📍 Matched source ${source.id} (${source.source_url}) to result ${result.id} (source_id: ${result.source_id || 'legacy'})`)
        } else {
          console.log(`❌ No result found for source ${source.id} (${source.source_url})`)
        }
        
        let status: MenuStatus = 'pending'
        if (result) {
          if (result.status === 'queued' || result.status === 'processing') status = 'extracting'
          else if (result.status === 'failed') status = 'error'
          else if (result.status === 'done') status = 'extracted'
        } else if (source.status === 'extracting') {
          status = 'extracting'
        } else if (source.status === 'error') {
          status = 'error'
        }

        // Calculate average price and item count from structured_data
        let averagePrice: number | undefined
        let itemCount = 0
        const extractedData = result?.structured_data
        
        if (extractedData?.categories) {
          console.log(`📊 Source ${source.id}: ${extractedData.categories.length} categories, `, 
            extractedData.categories.map((c: any) => `${c.name} (${c.items?.length || 0} items)`).join(', '))
          
          // DEBUG: Check if menuPeriods exists
          if (extractedData.menuPeriods) {
            console.log(`  ⏰ menuPeriods found: ${extractedData.menuPeriods.length} periods`)
            extractedData.menuPeriods.forEach((p: any) => {
              console.log(`    - ${p.name}: ${p.startTime}-${p.endTime}`)
            })
          } else {
            console.log(`  ⚠️ NO menuPeriods in extracted_data`)
          }
          
          const prices: number[] = []
          extractedData.categories.forEach((cat: any) => {
            cat.items?.forEach((item: any) => {
              itemCount++
              if (item.price) {
                // Parse Danish price format: "199,-" or "95 kr" or "95,00 kr"
                let priceNum: number | undefined
                if (typeof item.price === 'number') {
                  priceNum = item.price
                } else if (typeof item.price === 'string') {
                  // Remove common Danish price characters and parse
                  const cleaned = item.price.replace(/[^0-9.,]/g, '').replace(',', '.')
                  priceNum = parseFloat(cleaned)
                }
                if (priceNum && !isNaN(priceNum) && priceNum > 0) {
                  prices.push(priceNum)
                }
              }
            })
          })
          if (prices.length > 0) {
            averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length
          }
        }

        return {
          id: source.id,
          source_url: source.source_url,
          menu_type: source.menu_type || 'standard',
          label: source.label || 'Menukort',
          status,
          error_message: result?.error_message || source.error_message,
          extracted_data: extractedData,
          average_price: averagePrice,
          item_count: itemCount,
          ai_summary: result?.ai_summary || undefined,
          is_social_lead: !!(source as any).is_social_lead,
          created_at: source.created_at,
          // Flat timing columns
          result_id: result?.id,
          menu_type_extracted: result?.menu_type || null,
          time_start: result?.time_start || null,
          time_end: result?.time_end || null,
          time_source: result?.time_source || null,
          time_confirmed: result?.time_confirmed || false,
        }
      })

      setMenuCards(cards)
      
      // Merge DB sources into detectedUrls — preserve any detected-but-not-yet-added URLs
      const dbUrlSet = new Set(sources.map((s: any) => s.source_url))
      const dbEntries = sources.map((source: any) => ({
        url: source.source_url,
        isExisting: true,
        status: source.status
      }))
      setDetectedUrls(prev => {
        // Keep entries that are NOT in the DB yet (newly detected, not yet added)
        const pendingDetected = prev.filter(item => !dbUrlSet.has(item.url))
        return [...dbEntries, ...pendingDetected]
      })
      console.log('✅ Loaded menu sources into detectedUrls:', dbEntries.length, '(+ any pending detected)')
    } catch (error) {
      console.error('Error loading menu cards:', error)
      setMenuCards([])
    }
  }

  const handleDetectMenus = async () => {
    if (!websiteUrl || !businessId) {
      setError(t('menu.error.noWebsite'))
      return
    }

    setIsDetectingMenus(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const authToken = session?.access_token

      // Normalize URL - add https:// if missing
      let normalizedUrl = websiteUrl.trim()
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`
      }

      console.log('🔍 Attempting to analyze website:', {
        originalUrl: websiteUrl,
        normalizedUrl,
        businessId
      })

      const endpoint = import.meta.env.VITE_SUPABASE_FUNCTION_ANALYZE_WEBSITE as string
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          url: normalizedUrl,
          businessId
        })
      })

      if (!response.ok) {
        // Try to get the actual error message from the response
        let errorMessage = t('menu.error.analyzeFailed')
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
            console.error('🔴 Edge function error:', errorData.error)
          }
        } catch (e) {
          console.error('🔴 Could not parse error response')
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      const detectedUrls = result.detectedMenuUrls || result.allMenuUrls || []

      if (detectedUrls.length === 0) {
        setError(t('menu.error.noMenusFound'))
        return
      }

      // Get existing menu sources to show which are already fetched
      console.log('🔍 Checking existing menus...')
      
      const { data: existingSources } = await supabase
        .from('menu_sources')
        .select('source_url, status')
        .eq('business_id', businessId)
      
      const existingUrls = new Set((existingSources || []).map((s: any) => s.source_url))
      
      console.log(`📊 Found ${detectedUrls.length} total menu URLs`)
      console.log(`   - ${existingUrls.size} already in database`)
      console.log(`   - ${detectedUrls.length - existingUrls.size} are new`)

      // Merge newly detected URLs with existing state
      // detectedUrls here is the API response (array of URL strings)
      // We need to merge with the current detectedUrls state (array of objects)
      setDetectedUrls(currentUrls => {
        const currentUrlsSet = new Set(currentUrls.map((item: { url: string }) => item.url));
        const newUrlsOnly = detectedUrls
          .filter((url: string) => !currentUrlsSet.has(url))
          .map((url: string) => ({
            url,
            isExisting: existingUrls.has(url),
            status: 'pending'
          }))
        
        if (newUrlsOnly.length > 0) {
          console.log('✅ Merging URLs. Current:', currentUrls.length, 'New:', newUrlsOnly.length)
          // Pre-select only newly detected URLs
          setSelectedUrls(new Set(newUrlsOnly.map((item: { url: string }) => item.url)))
          setError(null)
          return [...currentUrls, ...newUrlsOnly]
        } else {
          // All detected URLs are already shown in the UI — pre-select them so user can re-extract
          const existingDetected = detectedUrls.filter((url: string) => currentUrlsSet.has(url))
          if (existingDetected.length > 0) {
            setSelectedUrls(new Set(existingDetected))
            setError(null)
            console.log('ℹ️ All detected URLs already loaded — pre-selected for re-extraction')
          } else {
            setError(t('menu.noLinksFound'))
          }
          return currentUrls
        }
      })
    } catch (error) {
      console.error('Error detecting menus:', error)
      setError((error as Error).message)
    } finally {
      setIsDetectingMenus(false)
    }
  }

  const handleExtractMenu = async (cardId: string, sourceUrl: string) => {
    if (!businessId) return

    // Check if already in queue or extracting
    if (activeExtractions.has(cardId) || extractionQueue.some(item => item.cardId === cardId)) {
      console.log(`⏭️ Menu already queued or extracting: ${cardId}`)
      return
    }

    // Add to queue instead of extracting immediately
    console.log(`📥 Adding to extraction queue: ${sourceUrl}`)
    setExtractionQueue(prev => [...prev, { cardId, sourceUrl }])
  }

  // Internal extraction function (called by queue processor)
  const extractMenuInternal = async (cardId: string, sourceUrl: string) => {
    if (!businessId) return

    // Track this extraction as active
    setActiveExtractions(prev => new Set(prev).add(cardId))

    try {
      // Clear any old error state and update status to extracting
      await supabase
        .from('menu_sources')
        .update({ status: 'extracting', error_message: null })
        .eq('id', cardId)

      // Delete old extraction results for THIS specific menu source
      // Uses source_id to target only this source's results (prevents cascade deletion)
      await supabase
        .from('menu_results_v2')
        .delete()
        .eq('source_id', cardId)

      setMenuCards(prev =>
        prev.map(c => c.id === cardId ? { ...c, status: 'extracting', error_message: undefined } : c)
      )

      // Call extraction Edge Function
      const { data: { session } } = await supabase.auth.getSession()
      const authToken = session?.access_token

      const endpoint = import.meta.env.VITE_SUPABASE_FUNCTION_MENU_EXTRACT as string
      console.log('🌐 Calling menu extraction endpoint:', endpoint, 'with auth:', !!authToken)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          url: sourceUrl,
          businessId,
          sourceId: cardId
        })
      })

      if (!response.ok) {
        throw new Error(t('menu.extractFailed'))
      }

      const result = await response.json()
      console.log('✅ Extraction job created:', result)

      // Poll for completion (menu_results_v2 table)
      const resultId = result.resultId
      if (resultId) {
        let attempts = 0
        const maxAttempts = 90 // 90 seconds max (increased for multiple simultaneous extractions)
        
        const pollInterval = setInterval(async () => {
          attempts++
          
          try {
            const { data: jobResult, error: fetchError } = await supabase
              .from('menu_results_v2')
              .select('*')
              .eq('id', resultId)
              .maybeSingle() // Use maybeSingle() instead of single() - doesn't error on 0 rows

            if (fetchError) {
              console.error('Error fetching job result:', fetchError)
              // Only fail after max attempts
              if (attempts >= maxAttempts) {
                clearInterval(pollInterval)
                pollIntervalsRef.current.delete(cardId)
                setActiveExtractions(prev => {
                  const next = new Set(prev)
                  next.delete(cardId)
                  return next
                })
                await supabase.from('menu_sources').update({ status: 'error', error_message: 'Polling timeout' }).eq('id', cardId)
                await loadMenuCards(businessId)
              }
              return
            }

            // If row doesn't exist yet, keep polling (jobResult will be null)
            if (!jobResult) {
              if (attempts >= maxAttempts) {
                clearInterval(pollInterval)
                pollIntervalsRef.current.delete(cardId)
                setActiveExtractions(prev => {
                  const next = new Set(prev)
                  next.delete(cardId)
                  return next
                })
                // Don't mark as error - job might still be processing, just took too long to poll
                console.log('⏱️ Polling timeout - job may still complete. Reload page to check.')
                await loadMenuCards(businessId)
              }
              return
            }

            if (jobResult.status === 'done') {
              clearInterval(pollInterval)
              pollIntervalsRef.current.delete(cardId)
              setActiveExtractions(prev => {
                const next = new Set(prev)
                next.delete(cardId)
                return next
              })
              
              // Update menu_sources status
              await supabase
                .from('menu_sources')
                .update({ status: 'extracted' })
                .eq('id', cardId)

              // Debounce operations pricing update to prevent concurrent updates
              // When multiple menus extract simultaneously, only update once after all complete
              if (operationsUpdateTimeoutRef.current) {
                clearTimeout(operationsUpdateTimeoutRef.current)
              }
              operationsUpdateTimeoutRef.current = setTimeout(() => {
                updateOperationsPricing().catch(err => 
                  console.error('Error updating operations pricing:', err)
                )
              }, 2000) // Wait 2 seconds after last completion

              // Reload cards
              await loadMenuCards(businessId)
            } else if (jobResult.status === 'error') {
              // Extraction failed
              clearInterval(pollInterval)
              pollIntervalsRef.current.delete(cardId)
              setActiveExtractions(prev => {
                const next = new Set(prev)
                next.delete(cardId)
                return next
              })
              
              await supabase
                .from('menu_sources')
                .update({ 
                  status: 'error',
                  error_message: jobResult?.error_message || 'Extraction failed'
                })
                .eq('id', cardId)

              await loadMenuCards(businessId)
            }
            // If status is 'queued' or 'processing', keep polling (do nothing here)
          } catch (pollError) {
            console.error('Polling error:', pollError)
            // Don't stop polling on error unless max attempts reached
            if (attempts >= maxAttempts) {
              clearInterval(pollInterval)
              pollIntervalsRef.current.delete(cardId)
              setActiveExtractions(prev => {
                const next = new Set(prev)
                next.delete(cardId)
                return next
              })
            }
          }
        }, 1000) // Poll every second
        
        // Store interval reference for cleanup
        pollIntervalsRef.current.set(cardId, pollInterval)
      } else {
        // Fallback: reload after a delay
        setActiveExtractions(prev => {
          const next = new Set(prev)
          next.delete(cardId)
          return next
        })
        setTimeout(() => loadMenuCards(businessId), 3000)
      }
    } catch (error) {
      console.error('Error extracting menu:', error)
      
      // Remove from active extractions
      setActiveExtractions(prev => {
        const next = new Set(prev)
        next.delete(cardId)
        return next
      })
      
      // Update status to error
      await supabase
        .from('menu_sources')
        .update({ 
          status: 'error',
          error_message: (error as Error).message
        })
        .eq('id', cardId)

      setMenuCards(prev =>
        prev.map(c => c.id === cardId ? { 
          ...c, 
          status: 'error',
          error_message: (error as Error).message 
        } : c)
      )
    }
  }

  const updateOperationsPricing = async () => {
    if (!businessId) return

    try {
      // Load ALL menu extractions from database
      const { data: results } = await supabase
        .from('menu_results_v2')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'done')

      if (!results || results.length === 0) return

      // Keywords to identify drink menus (case-insensitive)
      const drinkKeywords = ['cocktail', 'wine', 'vin', 'øl', 'beer', 'bar', 'drikkevarer', 'drink', 'beverage']
      const kidsKeywords = ['børnemenu', 'børnemad', 'børn', 'kids', 'children', 'child', 'junior', 'lille']

      // Filter out drink menus and collect prices from food menus
      const allPrices: number[] = []
      let hasKidsMenu = false
      
      results.forEach((result: any) => {
        const data = result.structured_data
        if (!data?.categories) return

        // Check if this is a drink menu (by URL or menu title)
        const sourceUrl = (result.source_url || '').toLowerCase()
        const menuTitle = (data.menuTitle || '').toLowerCase()
        const isDrinkMenu = drinkKeywords.some(keyword => 
          sourceUrl.includes(keyword) || menuTitle.includes(keyword)
        )

        if (isDrinkMenu) {
          console.log(`🍸 Drink menu extracted but excluded from pricing: ${result.source_url}`)
          return
        }

        // Check for kids menu in category names AND item names
        data.categories.forEach((cat: any) => {
          const catName = (cat.name || '').toLowerCase()
          if (kidsKeywords.some(kw => catName.includes(kw))) {
            hasKidsMenu = true
            console.log(`👶 Kids menu detected in category: ${cat.name}`)
          }
          // Also scan item names — børnemenu often appears as a sub-item
          cat.items?.forEach((item: any) => {
            const itemName = (typeof item === 'string' ? item : (item.name || '')).toLowerCase()
            if (kidsKeywords.some(kw => itemName.includes(kw))) {
              hasKidsMenu = true
              console.log(`👶 Kids menu detected in item: ${typeof item === 'string' ? item : item.name}`)
            }
          })
        })

        // Extract prices from this food menu
        data.categories.forEach((cat: any) => {
          cat.items?.forEach((item: any) => {
            if (item.price) {
              // Parse Danish price format
              let priceNum: number | undefined
              if (typeof item.price === 'number') {
                priceNum = item.price
              } else if (typeof item.price === 'string') {
                const cleaned = item.price.replace(/[^0-9.,]/g, '').replace(',', '.')
                priceNum = parseFloat(cleaned)
              }
              if (priceNum && !isNaN(priceNum) && priceNum > 0) {
                allPrices.push(priceNum)
              }
            }
          })
        })
      })

      if (allPrices.length === 0) {
        console.log('ℹ️ No food prices yet (only drink menus extracted so far, or menus have no prices)')
        return
      }

      // Calculate weighted average
      const averagePrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length

      // Determine price level
      let priceLevel = 'moderate'
      if (averagePrice < 100) priceLevel = 'budget'
      else if (averagePrice > 200 && averagePrice <= 400) priceLevel = 'upscale'
      else if (averagePrice > 400) priceLevel = 'luxury'

      // Use upsert to avoid race conditions when multiple extractions complete simultaneously
      const opsData = {
        business_id: businessId,
        price_level: priceLevel,
        has_kids_menu: hasKidsMenu
      }

      const { error: upsertError } = await (supabase as any)
        .from('business_operations')
        .upsert(opsData, {
          onConflict: 'business_id',
        })
      
      if (upsertError) {
        console.error('Error upserting operations:', upsertError)
        throw upsertError
      }

      console.log(`✅ Auto-updated Operations from ${allPrices.length} food items: ${Math.round(averagePrice)} DKK, ${priceLevel}, kids menu: ${hasKidsMenu}`)
      console.log(`ℹ️ Note: Drink menus (cocktails, wine, beer) are extracted separately but not included in pricing`)
    } catch (error) {
      console.error('Error updating operations pricing:', error)
    }
  }

  const handleAddManualUrl = async () => {
    if (!businessId || !newMenuInput.trim()) return

    try {
      const url = newMenuInput.trim()
      
      // Check if URL already exists
      const { data: existing } = await supabase
        .from('menu_sources')
        .select('id')
        .eq('business_id', businessId)
        .eq('source_url', url)
        .maybeSingle()

      if (existing) {
        setError(t('menu.error.linkAlreadyAdded'))
        return
      }

      const { data: authData } = await supabase.auth.getUser()
      const userId = authData?.user?.id

      await supabase.from('menu_sources').insert({
        business_id: businessId,
        source_url: url,
        source_type: 'url',
        source_origin: 'manual_added',
        status: 'pending',
        menu_type: detectMenuType(url),
        label: detectMenuLabel(url),
        created_by: userId,
      })

      setNewMenuInput('')
      setShowAddLink(false)
      
      await loadMenuCards(businessId)
    } catch (error) {
      console.error('Error adding manual URL:', error)
      setError(t('menu.error.addFailed'))
    }
  }

  const handleAddManualText = async () => {
    if (!businessId || !newTextInput.trim()) return

    try {
      // Call Edge Function to process manual text
      const { data: { session } } = await supabase.auth.getSession()
      const authToken = session?.access_token

      const endpoint = import.meta.env.VITE_SUPABASE_FUNCTION_MENU_EXTRACT as string
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          text: newTextInput,
          businessId,
          sourceType: 'manual_text'
        })
      })

      if (!response.ok) {
        throw new Error(t('menu.error.analyzeMenuFailed'))
      }

      setNewTextInput('')
      setShowAddText(false)
      
      await loadMenuCards(businessId)
    } catch (error) {
      console.error('Error processing manual text:', error)
      setError(t('menu.error.analyzeMenuFailed'))
    }
  }

  const handleDeleteCard = async (cardId: string, sourceUrl: string) => {
    // Prevent deletion when ANY menu is being extracted
    if (activeExtractions.size > 0) {
      alert(t('menu.delete.inProgress'))
      return
    }

    if (!confirm(t('menu.delete.confirm'))) return

    try {
      // NOTE: is_active field not yet added to menu_items_normalized schema
      // Soft-delete normalized menu items (set is_active = false)
      // This preserves menu data for historical analysis and potential recovery
      // TODO: Uncomment when is_active column is added to database
      // const { error: normalizedError } = await supabase
      //   .from('menu_items_normalized')
      //   .update({ is_active: false })
      //   .eq('menu_url', sourceUrl)
      // 
      // if (normalizedError) {
      //   console.error('Error soft-deleting normalized items:', normalizedError)
      // }
      
      // Hard-delete extraction results (metadata no longer needed)
      await supabase
        .from('menu_results_v2')
        .delete()
        .eq('source_url', sourceUrl)
      
      // Hard-delete source (user explicitly removed this URL)
      await supabase.from('menu_sources').delete().eq('id', cardId)
      
      // Remove from selected URLs if present
      setSelectedUrls(prev => {
        const next = new Set(prev)
        next.delete(sourceUrl)
        return next
      })
      
      // Remove from detected URLs
      setDetectedUrls(prev => prev.filter(item => item.url !== sourceUrl))
      
      // Reload to ensure consistency
      if (businessId) await loadMenuCards(businessId)
    } catch (error) {
      console.error('Error deleting card:', error)
    }
  }

  const handleExtractSelected = async () => {
    if (!businessId || selectedUrls.size === 0) return

    const { data: authData } = await supabase.auth.getUser()
    const userId = authData?.user?.id

    // Find which selected URLs are NOT yet in menu_sources
    const currentMenuCardUrlSet = new Set(menuCards.map(c => c.source_url))
    const urlsToAdd = Array.from(selectedUrls).filter(url => !currentMenuCardUrlSet.has(url))

    // Insert new URLs into menu_sources
    if (urlsToAdd.length > 0) {
      await supabase.from('menu_sources').insert(
        urlsToAdd.map(url => ({
          business_id: businessId,
          source_url: url,
          source_type: 'url',
          source_origin: 'ai_detected',
          status: 'pending',
          menu_type: detectMenuType(url),
          label: detectMenuLabel(url),
          created_by: userId,
        }))
      )
    }

    // Query all menu_sources for selected URLs to get their IDs (fresh from DB)
    const { data: sources } = await supabase
      .from('menu_sources')
      .select('id, source_url')
      .eq('business_id', businessId)
      .in('source_url', Array.from(selectedUrls))

    // Reload menu cards to reflect newly inserted sources
    await loadMenuCards(businessId)

    // Trigger extraction for each selected source
    for (const source of (sources || [])) {
      handleExtractMenu(source.id, source.source_url)
    }
  }

  const handleRemoveDetectedUrl = (url: string) => {
    // Remove from detected URLs list (for items not yet in database)
    setDetectedUrls(prev => prev.filter(item => item.url !== url))
    
    // Remove from selected URLs if present
    setSelectedUrls(prev => {
      const next = new Set(prev)
      next.delete(url)
      return next
    })
  }

  const handleStartEdit = (card: MenuCard) => {
    setEditingCard(card.id)
    setEditingData(JSON.parse(JSON.stringify(card.extracted_data))) // Deep clone
  }

  const handleCancelEdit = () => {
    setEditingCard(null)
    setEditingData(null)
  }

  const handleSaveEdit = async () => {
    try {
      // Logic for saving edits
    } catch (error) {
      console.error('Error saving edit:', error);
    }
  }

  const handleItemChange = (categoryIdx: number, itemIdx: number, field: string, value: string) => {
    setEditingData((prev: any) => {
      const updated = JSON.parse(JSON.stringify(prev))
      updated.categories[categoryIdx].items[itemIdx][field] = value
      return updated
    })
  }

  const toggleExpand = (cardId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })
  }

  // Load pricing data from business_operations
  const loadPricingData = async (bizId: string) => {
    try {
      const { data } = await (supabase as any)
        .from('business_operations')
        .select('price_level')
        .eq('business_id', bizId)
        .maybeSingle()

      if (data) {
        setPriceLevel(data.price_level || '')
      }
    } catch (error) {
      console.error('Error loading pricing:', error)
    }
  }

  // Save pricing data to business_operations
  const handleSavePricing = async () => {
    if (!businessId) return

    setIsSavingPricing(true)
    try {
      const { error } = await (supabase as any)
        .from('business_operations')
        .upsert({
          business_id: businessId,
          price_level: priceLevel || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'business_id'
        })

      if (error) throw error

      setIsEditingPricing(false)
    } catch (error) {
      console.error('Error saving pricing:', error)
      alert(t('menu.savePricingFailed'))
    } finally {
      setIsSavingPricing(false)
    }
  }

  // Start editing timing for a menu card
  const handleStartEditTiming = (card: MenuCard) => {
    setEditingTimingCardId(card.result_id || null)
    setEditingTimeStart(card.time_start || '')
    setEditingTimeEnd(card.time_end || '')
  }

  const updateTimePart = (value: string, part: 'hour' | 'minute', nextValue: string) => {
    const current = splitTimeValue(value)
    const nextHour = part === 'hour' ? nextValue : current.hour
    const nextMinute = part === 'minute' ? nextValue : current.minute

    if (part === 'hour' && nextValue && !nextMinute) {
      return joinTimeValue(nextValue, '00')
    }

    if (part === 'minute' && nextValue && !nextHour) {
      return joinTimeValue('00', nextValue)
    }

    return joinTimeValue(nextHour, nextMinute)
  }

  // Cancel timing edit
  const handleCancelEditTiming = () => {
    setEditingTimingCardId(null)
    setEditingTimeStart('')
    setEditingTimeEnd('')
  }

  // Save timing changes
  const handleSaveTiming = async (resultId: string) => {
    if (!resultId) return

    // Validate HH:MM format
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    if (editingTimeStart && !timeRegex.test(editingTimeStart)) {
      alert('Starttid skal være i formatet HH:MM (f.eks. 09:00)')
      return
    }
    if (editingTimeEnd && !timeRegex.test(editingTimeEnd)) {
      alert('Sluttid skal være i formatet HH:MM (f.eks. 17:30)')
      return
    }

    setIsSavingTiming(true)
    try {
      const { error } = await supabase
        .from('menu_results_v2')
        .update({
          time_start: editingTimeStart || null,
          time_end: editingTimeEnd || null,
          time_source: 'user_edited',
          time_confirmed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', resultId)

      if (error) throw error

      // Reload menu cards to reflect changes
      if (businessId) await loadMenuCards(businessId)
      
      handleCancelEditTiming()
    } catch (error) {
      console.error('Error saving timing:', error)
      alert('Kunne ikke gemme tidspunkt')
    } finally {
      setIsSavingTiming(false)
    }
  }

  const loadNormalizedItems = async (bizId: string) => {
    try {
      const { data } = await supabase
        .from('menu_items_normalized')
        .select('id, item_name, is_signature')
        .eq('business_id', bizId)
        .eq('is_active', true) // Only load active items
      if (data) {
        const map = new Map<string, { id: string; is_signature: boolean }>()
        for (const row of data as any[]) {
          if (row.item_name) map.set(row.item_name.toLowerCase(), { id: row.id, is_signature: !!row.is_signature })
        }
        setNormalizedItems(map)
      }
    } catch (err) {
      console.error('Error loading normalized items:', err)
    }
  }

  const toggleSocialLead = async (cardId: string) => {
    const card = menuCards.find(c => c.id === cardId)
    if (!card) return
    const newVal = !card.is_social_lead
    // If setting a new social lead, clear all others first (only one at a time)
    setMenuCards(prev => prev.map(c => ({
      ...c,
      is_social_lead: c.id === cardId ? newVal : (newVal ? false : c.is_social_lead)
    })))
    if (newVal) {
      // NOTE: is_social_lead column removed from menu_sources table
      // Social lead selection is now tracked in local state only
    }
    // NOTE: is_social_lead column removed - no DB update needed
    if (false) {
      // Revert
      await loadMenuCards(businessId!)
      console.error('Failed to toggle is_social_lead (column removed)')
    }
  }

  const toggleSignature = async (itemName: string) => {
    const key = itemName.toLowerCase()
    const entry = normalizedItems.get(key)
    if (!entry) return
    const newVal = !entry.is_signature
    // Optimistic update
    setNormalizedItems(prev => {
      const next = new Map(prev)
      next.set(key, { ...entry, is_signature: newVal })
      return next
    })
    const { error: updateErr } = await supabase
      .from('menu_items_normalized')
      .update({ is_signature: newVal })
      .eq('id', entry.id)
    if (updateErr) {
      // Revert
      setNormalizedItems(prev => {
        const next = new Map(prev)
        next.set(key, entry)
        return next
      })
      console.error('Failed to toggle is_signature:', updateErr)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center py-12">
        <div className="text-center animate-fade-in">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-700 font-medium">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  // Free tier - upgrade prompt
  if (currentTier === 'free') {
    return (
      <div className="bg-surface-page min-h-full py-6 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-brand mb-1">{t('menu.header.title')}</h1>
            <p className="text-sm text-text-secondary">{t('menu.header.subtitle')}</p>
          </div>

          <div className="bg-surface-alt rounded-lg border border-border p-6">
            <h3 className="font-semibold text-brand mb-4 text-lg">{t('menu.free.upgradeTitle')}</h3>
            <button
              onClick={() => (window.location.href = '/dashboard/plans')}
              className="px-4 py-2 bg-cta text-text-inverse rounded font-medium text-sm"
            >
              {t('menu.free.cta')}
            </button>
          </div>
        </div>
      </div>
    )
  }

    return (
      <div className="bg-surface-page min-h-full py-6 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Progress indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-center gap-2 text-sm">
              <a href="/dashboard/profile" className="text-text-muted hover:text-text-secondary">{t('location.breadcrumb.profile')}</a>
              <span className="text-text-muted">→</span>
              <span className="text-brand font-semibold">{t('location.breadcrumb.menu')}</span>
              <span className="text-text-muted">→</span>
              <a href="/dashboard/location" className="text-text-muted hover:text-text-secondary">{t('location.breadcrumb.location')}</a>
              <span className="text-text-muted">→</span>
              <a href="/dashboard/brand-v5" className="text-text-muted hover:text-text-secondary">{t('location.breadcrumb.brand')}</a>
            </div>
          </div>
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold text-brand mb-1">{t('menu.header.title')}</h1>
            <p className="text-sm text-text-secondary">{t('menu.header.subtitle2')}</p>
          </div>

        {/* Batch extraction progress indicator */}
        {(activeExtractions.size > 0 || extractionQueue.length > 0) && (
          <div className="mb-3 bg-info-surface border border-info rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-info"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-info-text">
                  {activeExtractions.size > 0 && t('menu.batch.extracting')}
                  {extractionQueue.length > 0 && ` ${extractionQueue.length} ${t('menu.batch.inQueue')}`}
                </p>
                <p className="text-xs text-info-text mt-0.5">{t('menu.batch.helper')}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {/* Detect Menus Section */}
          {websiteUrl && (
            <div className="bg-surface rounded-lg border border-border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-text-secondary">
                    {t('menu.findOn')} <span className="font-medium">{websiteUrl}</span>
                  </p>
                </div>
                <button
                  onClick={handleDetectMenus}
                  disabled={isDetectingMenus}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-opacity
                    ${isDetectingMenus
                      ? 'bg-cta text-text-inverse opacity-75 cursor-wait'
                      : 'bg-cta text-text-inverse hover:bg-cta-hover disabled:bg-surface-alt disabled:text-text-muted disabled:cursor-not-allowed'
                    }`}
                >
                  <AnalyzeIcon className={isDetectingMenus ? 'w-4 h-4 animate-spin motion-reduce:animate-none text-text-inverse' : 'w-4 h-4 text-text-inverse'} />
                  <span>{isDetectingMenus ? t('menu.detect.searching') : t('menu.detect.find')}</span>
                </button>
              </div>
            </div>
          )}

          {/* URL Selection Section */}
          <div className="space-y-3">
              <div className="bg-surface rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-brand">
                      {t('menu.sources.heading', { count: detectedUrls.length })}
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {t('menu.sources.subheading')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedUrls(new Set(detectedUrls.map(item => item.url)))}
                      className="text-xs text-cta hover:text-cta-text font-medium"
                    >
                      {t('menu.sources.selectAll')}
                    </button>
                    <span className="text-text-muted">|</span>
                    <button
                      onClick={() => setSelectedUrls(new Set())}
                      className="text-xs text-text-secondary hover:text-text-secondary font-medium"
                    >
                      {t('menu.sources.deselectAll')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Individual Menu Source Cards */}
              {detectedUrls.map((item) => {
                const isSelected = selectedUrls.has(item.url)
                const menuCard = menuCards.find(card => card.source_url === item.url)
                const isExpanded = menuCard ? expandedCards.has(menuCard.id) : false

                return (
                  <div 
                    key={item.url} 
                    className={`bg-surface rounded-lg border-2 transition-colors ${
                      isSelected ? 'border-cta' : 
                      menuCard?.status === 'pending' ? 'border-orange-200 bg-orange-50/30' : 
                      'border-border'
                    }`}
                  >
                    {/* Card Header with Checkbox */}
                    <div className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const newSelected = new Set(selectedUrls)
                            if (e.target.checked) {
                              newSelected.add(item.url)
                            } else {
                              newSelected.delete(item.url)
                            }
                            setSelectedUrls(newSelected)
                          }}
                          className="mt-1 h-5 w-5 text-cta border-border rounded focus:ring-cta"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {!menuCard && <span className="text-gray-400">📋</span>}
                            {menuCard?.status === 'pending' && (
                              <>
                                <span className="text-orange-500">⏱️</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                  {t('menu.sources.statusPending')}
                                </span>
                              </>
                            )}
                            {menuCard?.status === 'extracting' && (
                              <>
                                <span className="text-info-text">⏳</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-info-surface text-info-text">
                                  {t('menu.sources.statusExtracting')}
                                </span>
                              </>
                            )}
                            {menuCard?.status === 'extracted' && <span className="text-success">✅</span>}
                            {menuCard?.status === 'error' && (
                              <>
                                <span className="text-error">❌</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-error-surface text-error-text">
                                  {t('menu.sources.statusError')}
                                </span>
                              </>
                            )}
                            <h3 className="text-sm font-semibold text-brand">
                              {menuCard?.extracted_data?.menuTitle || menuCard?.label || detectMenuLabel(item.url)}
                            </h3>
                            {menuCard?.extracted_data?.menuTitle && menuCard?.label && 
                             menuCard.extracted_data.menuTitle !== menuCard.label && (
                              <span className="text-xs text-text-muted px-2 py-0.5 bg-surface-alt rounded">
                                {t('menu.sources.fromLabel', { label: menuCard.label })}
                              </span>
                            )}
                            {menuCard?.extracted_data?.menuSubtitle && (
                              <span className="text-xs text-text-secondary italic ml-2">
                                {menuCard.extracted_data.menuSubtitle}
                              </span>
                            )}
                            
                          </div>
                          <p className="text-xs text-text-muted break-all">{item.url}</p>
                          
                          {/* Timing Editor - Inline when editing */}
                          {editingTimingCardId === menuCard?.result_id && (
                            <div className="flex items-center gap-1 mt-2 p-2 bg-surface-alt rounded border border-border">
                              <label className="text-xs text-text-secondary font-medium">Tid:</label>
                              <select
                                value={splitTimeValue(editingTimeStart).hour}
                                onChange={(e) => setEditingTimeStart(updateTimePart(editingTimeStart, 'hour', e.target.value))}
                                className="px-2 py-1 border border-border rounded text-xs w-16 bg-white"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">--</option>
                                {TIME_HOUR_OPTIONS.map((hour) => (
                                  <option key={hour} value={hour}>
                                    {hour}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={TIME_MINUTE_OPTIONS.includes(splitTimeValue(editingTimeStart).minute) ? splitTimeValue(editingTimeStart).minute : ''}
                                onChange={(e) => setEditingTimeStart(updateTimePart(editingTimeStart, 'minute', e.target.value))}
                                className="px-2 py-1 border border-border rounded text-xs w-16 bg-white"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">--</option>
                                {TIME_MINUTE_OPTIONS.map((minute) => (
                                  <option key={minute} value={minute}>
                                    {minute}
                                  </option>
                                ))}
                              </select>
                              <span className="text-xs text-text-muted">–</span>
                              <select
                                value={splitTimeValue(editingTimeEnd).hour}
                                onChange={(e) => setEditingTimeEnd(updateTimePart(editingTimeEnd, 'hour', e.target.value))}
                                className="px-2 py-1 border border-border rounded text-xs w-16 bg-white"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">--</option>
                                {TIME_HOUR_OPTIONS.map((hour) => (
                                  <option key={hour} value={hour}>
                                    {hour}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={TIME_MINUTE_OPTIONS.includes(splitTimeValue(editingTimeEnd).minute) ? splitTimeValue(editingTimeEnd).minute : ''}
                                onChange={(e) => setEditingTimeEnd(updateTimePart(editingTimeEnd, 'minute', e.target.value))}
                                className="px-2 py-1 border border-border rounded text-xs w-16 bg-white"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">--</option>
                                {TIME_MINUTE_OPTIONS.map((minute) => (
                                  <option key={minute} value={minute}>
                                    {minute}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSaveTiming(menuCard.result_id!); }}
                                disabled={isSavingTiming}
                                className="px-3 py-1 bg-cta text-text-inverse rounded text-xs font-medium hover:bg-cta-hover disabled:opacity-50"
                              >
                                {isSavingTiming ? 'Gemmer...' : 'Gem'}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCancelEditTiming(); }}
                                className="px-2 py-1 bg-surface text-text-secondary rounded text-xs hover:bg-border border border-border"
                              >
                                Annuller
                              </button>
                            </div>
                          )}
                          
                          {menuCard?.status === 'pending' && (
                            <p className="text-xs text-orange-600 mt-1">
                              {t('menu.sources.pendingHint')}
                            </p>
                          )}
                          {menuCard?.status === 'extracted' && menuCard.item_count && menuCard.item_count > 0 && (
                            <p className="text-xs text-text-secondary mt-1">
                              {menuCard.item_count} items
                              {menuCard.average_price && !isNaN(menuCard.average_price) && ` · Ø ${Math.round(menuCard.average_price)} DKK`}
                            </p>
                          )}
                          {menuCard?.status === 'extracted' && menuCard.ai_summary && (
                            <p className="text-xs text-text-muted mt-1 italic whitespace-pre-line">{menuCard.ai_summary}</p>
                          )}
                          {menuCard?.status === 'error' && (
                            <p className="text-xs text-error mt-1">{menuCard.error_message}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {menuCard?.menu_type_extracted && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              {menuCard.menu_type_extracted === 'breakfast' && '🌅 Morgenmad'}
                              {menuCard.menu_type_extracted === 'brunch' && '🥞 Brunch'}
                              {menuCard.menu_type_extracted === 'lunch' && '🍽️ Frokost'}
                              {menuCard.menu_type_extracted === 'dinner' && '🌙 Aftensmad'}
                              {menuCard.menu_type_extracted === 'cocktail' && '🍸 Cocktails'}
                              {menuCard.menu_type_extracted === 'wine' && '🍷 Vin'}
                              {menuCard.menu_type_extracted === 'beer' && '🍺 Øl'}
                              {menuCard.menu_type_extracted === 'beverage' && '🥤 Drikkevarer'}
                              {menuCard.menu_type_extracted === 'dessert' && '🍰 Dessert'}
                              {menuCard.menu_type_extracted === 'kids' && '👶 Børnemenu'}
                              {menuCard.menu_type_extracted === 'seasonal' && '🍂 Sæson'}
                              {!['breakfast', 'brunch', 'lunch', 'dinner', 'cocktail', 'wine', 'beer', 'beverage', 'dessert', 'kids', 'seasonal'].includes(menuCard.menu_type_extracted) && menuCard.menu_type_extracted}
                            </span>
                          )}
                          {menuCard?.result_id && menuCard.status === 'extracted' && (
                            <div className="flex items-center gap-1">
                              {menuCard.time_start && menuCard.time_end ? (
                                <>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    menuCard.time_source === 'user_edited' || menuCard.time_confirmed
                                      ? 'bg-success-surface text-success-text border border-success'
                                      : menuCard.time_source === 'opening_hours_fallback' || (menuCard.time_start === '00:00' && menuCard.time_end === '23:59')
                                      ? 'bg-warning-surface text-warning-text border border-warning'
                                      : 'bg-info-surface text-info-text border border-info'
                                  }`}>
                                    🕐 {menuCard.time_start}–{menuCard.time_end}
                                    {menuCard.time_source === 'opening_hours_fallback' && ' (åbningstider)'}
                                    {menuCard.time_start === '00:00' && menuCard.time_end === '23:59' && ' (hele dagen)'}
                                  </span>
                                  {editingTimingCardId !== menuCard.result_id && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleStartEditTiming(menuCard); }}
                                      className="px-1.5 py-0.5 text-xs text-cta hover:text-cta-text"
                                      title="Rediger tidspunkt"
                                    >
                                      ✏️
                                    </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-error-surface text-error-text border border-error">
                                    ⚠️ Ingen tid
                                  </span>
                                  {editingTimingCardId !== menuCard.result_id && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleStartEditTiming(menuCard); }}
                                      className="px-2 py-0.5 text-xs bg-cta text-text-inverse rounded font-medium hover:bg-cta-hover"
                                      title="Tilføj tidspunkt"
                                    >
                                      + Tilføj
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                          {menuCard?.status === 'extracted' && menuCard.extracted_data && (
                            <button
                              onClick={() => menuCard && toggleExpand(menuCard.id)}
                              className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded hover:bg-surface-alt"
                            >
                              {isExpanded ? t('menu.sources.collapse') : t('menu.sources.expand')}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (menuCard) {
                                handleDeleteCard(menuCard.id, item.url)
                              } else {
                                handleRemoveDetectedUrl(item.url)
                              }
                            }}
                            disabled={activeExtractions.size > 0}
                            className={`px-2 py-1.5 text-sm rounded ${
                              activeExtractions.size > 0
                                ? 'text-text-muted cursor-not-allowed'
                                : 'text-error hover:bg-error-surface'
                            }`}
                            title={
                              activeExtractions.size > 0 
                                ? t('menu.sources.tooltipCannotDelete')
                                : menuCard 
                                  ? t('menu.sources.tooltipDeleteSource')
                                  : t('menu.sources.tooltipRemoveFromList')
                            }
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Menu Details */}
                    {isExpanded && menuCard?.extracted_data && (
                      <div className="px-4 py-3 border-t border-border bg-surface-alt">
                        {/* Menu Metadata (subtitle and availability days only - timing now in header) */}
                        {(menuCard.extracted_data.menuSubtitle || menuCard.extracted_data.availabilityDays) && (
                          <div className="mb-4 pb-3 border-b border-border">
                            {menuCard.extracted_data.menuSubtitle && (
                              <p className="text-sm text-text-secondary mb-2 italic">
                                {menuCard.extracted_data.menuSubtitle}
                              </p>
                            )}
                            {menuCard.extracted_data.availabilityDays && (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-success-surface text-success-text">
                                📅 {menuCard.extracted_data.availabilityDays}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Categories and Items */}
                        {menuCard.extracted_data.categories && menuCard.extracted_data.categories.length > 0 ? (
                          menuCard.extracted_data.categories.map((category: any, catIdx: number) => (
                            <div key={catIdx} className="mb-4 last:mb-0">
                              <div className="mb-2">
                                <h4 className="text-sm font-semibold text-text">{category.name}</h4>
                                {category.categoryDescription && (
                                  <p className="text-xs text-text-secondary mt-0.5 italic">
                                    {category.categoryDescription}
                                  </p>
                                )}
                                {category.timeRange && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-info-surface text-info-text mt-1">
                                    🕐 {category.timeRange}
                                  </span>
                                )}
                              </div>
                              <div className="space-y-2">
                                {category.items && category.items.length > 0 ? (
                                  category.items.map((item: any, itemIdx: number) => {
                                    const normEntry = normalizedItems.get((item.name || '').toLowerCase())
                                    const isSig = normEntry?.is_signature ?? false
                                    return (
                                    <div key={itemIdx} className="flex items-start justify-between text-sm gap-2">
                                      <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                        {normEntry && (
                                          <button
                                            onClick={() => toggleSignature(item.name)}
                                            title={isSig ? 'Fjern signaturret-markering' : 'Markér som signaturret'}
                                            className={`mt-0.5 shrink-0 text-base leading-none transition-colors ${isSig ? 'text-warning' : 'text-text-muted hover:text-warning'}`}
                                          >
                                            {isSig ? '★' : '☆'}
                                          </button>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <span className={`text-text${isSig ? ' font-medium' : ''}`}>{item.name}</span>
                                          {isSig && (
                                            <span className="ml-1.5 text-xs text-warning font-normal">Signaturret</span>
                                          )}
                                          {item.description && (
                                            <p className="text-xs text-text-secondary mt-0.5">{item.description}</p>
                                          )}
                                        </div>
                                      </div>
                                      {item.price && (
                                        <span className="text-text-secondary font-medium whitespace-nowrap">
                                          {item.price}{item.currency ? ` ${item.currency}` : ''}
                                        </span>
                                      )}
                                    </div>
                                    )
                                  })
                                ) : (
                                  <p className="text-xs text-text-muted italic py-2">{t('menu.sources.emptyCategory')}</p>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6">
                            <p className="text-sm text-text-secondary mb-2">{t('menu.sources.emptyTitle')}</p>
                            <p className="text-xs text-text-muted">{t('menu.sources.emptySubtitle')}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

          {/* Extract Selected Button */}
          {selectedUrls.size > 0 && (
            <div className="flex justify-end">
              <button
                onClick={handleExtractSelected}
                disabled={activeExtractions.size > 0 || isProcessingQueue}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-cta text-text-inverse text-sm font-semibold rounded-lg hover:bg-cta-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {activeExtractions.size > 0 || isProcessingQueue
                  ? t('menu.sources.processing', { count: selectedUrls.size })
                  : t('menu.sources.fetchSelected', { count: selectedUrls.size })}
              </button>
            </div>
          )}

          {/* Pricing Section */}
          <div className="bg-surface rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-brand mb-1">{t('menu.pricing.heading')}</h3>
                {!isEditingPricing && (
                  <p className="text-sm text-text-secondary">
                    {priceLevel
                      ? t('menu.pricing.levelLabel', { level: priceLevel })
                      : t('menu.pricing.notSet')}
                  </p>
                )}
              </div>
              <button
                onClick={() => isEditingPricing ? handleSavePricing() : setIsEditingPricing(true)}
                disabled={isSavingPricing}
                className={`px-3 py-1.5 text-sm font-medium rounded disabled:opacity-50 ${
                  isEditingPricing
                    ? 'bg-cta text-text-inverse hover:bg-cta-hover'
                    : 'text-text-secondary border border-border hover:bg-surface-alt'
                }`}
              >
                {isSavingPricing ? t('menu.pricing.saving') : isEditingPricing ? t('menu.pricing.save') : t('menu.pricing.edit')}
              </button>
            </div>

            {isEditingPricing && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">{t('menu.pricing.levelFieldLabel')}</label>
                  <select
                    value={priceLevel}
                    onChange={(e) => setPriceLevel(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded text-sm"
                  >
                    <option value="">{t('menu.pricing.levelPlaceholder')}</option>
                    <option value="budget">{t('menu.pricing.budget')}</option>
                    <option value="moderate">{t('menu.pricing.moderate')}</option>
                    <option value="upscale">{t('menu.pricing.upscale')}</option>
                    <option value="fine_dining">{t('menu.pricing.fineDining')}</option>
                  </select>
                </div>

                <button
                  onClick={() => setIsEditingPricing(false)}
                  className="text-sm text-text-secondary hover:text-text"
                >
                  {t('menu.pricing.cancel')}
                </button>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-error-surface border border-error rounded-lg px-4 py-3 text-sm text-error-text">
              {error}
            </div>
          )}

          {/* Empty State - Show when no menus exist */}
          {menuCards.length === 0 && detectedUrls.length === 0 && (
            <div className="bg-surface rounded-lg border border-border px-4 py-8 text-center">
              <p className="text-sm text-text-secondary mb-3">{t('menu.sources.emptyState')}</p>
              <p className="text-xs text-text-muted">
                {t('menu.sources.emptyStateHint')}
              </p>
            </div>
          )}

          {/* Old Menu Cards - DEPRECATED - Remove after verification */}
          {false && (
          <div className="space-y-3">
            {menuCards.map(card => {
              const isExpanded = expandedCards.has(card.id)

              return (
                <div key={card.id} className="bg-surface rounded-lg border border-border">
                  {/* Card Header */}
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {card.status === 'pending' && !extractionQueue.some(q => q.cardId === card.id) && <span className="text-gray-400">📋</span>}
                          {extractionQueue.some(q => q.cardId === card.id) && <span className="text-yellow-500">⏸️</span>}
                          {card.status === 'extracting' && <span className="text-info-text">⏳</span>}
                          {card.status === 'extracted' && <span className="text-success">✅</span>}
                          {card.status === 'error' && <span className="text-error">❌</span>}
                          <h3 className="text-sm font-semibold text-brand">{card.label}</h3>
                          {extractionQueue.some(q => q.cardId === card.id) && (
                            <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                              I kø #{extractionQueue.findIndex(q => q.cardId === card.id) + 1}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted truncate">{card.source_url}</p>
                        {card.status === 'extracted' && (
                          <>
                            {card.item_count && card.item_count > 0 ? (
                              <>
                                <p className="text-xs text-text-secondary mt-1">
                                  {card.item_count} items
                                  {card.average_price && !isNaN(card.average_price) && ` · Ø ${Math.round(card.average_price)} DKK`}
                                </p>
                                {/* Show menu period timing if available */}
                                {card.extracted_data?.menuPeriods && card.extracted_data.menuPeriods.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {/* Deduplicate timing badges - if all periods have same time, show once */}
                                    {(() => {
                                      const periods = card.extracted_data.menuPeriods;
                                      // Filter out default fallback times (00:00-23:59, 00:00-00:00)
                                      const realPeriods = periods.filter((p: any) => 
                                        !(p.startTime === '00:00' && p.endTime === '23:59') &&
                                        !(p.startTime === '00:00' && p.endTime === '00:00')
                                      );
                                      
                                      if (realPeriods.length === 0) {
                                        // Only fallback times exist, show nothing or "All day"
                                        return null;
                                      }
                                      
                                      const uniqueTimes = new Set(realPeriods.map((p: any) => `${p.startTime}-${p.endTime}`));
                                      
                                      if (uniqueTimes.size === 1) {
                                        // All same time - show once with count if multiple periods
                                        const firstPeriod = realPeriods[0];
                                        return (
                                          <span className="text-xs bg-info-surface text-info-text px-2 py-0.5 rounded">
                                            🕐 {firstPeriod.startTime}-{firstPeriod.endTime}
                                            {realPeriods.length > 1 && ` (${realPeriods.length} categories)`}
                                          </span>
                                        );
                                      } else {
                                        // Different times - show each unique one
                                        return Array.from(uniqueTimes).map((time, idx) => (
                                          <span key={idx} className="text-xs bg-info-surface text-info-text px-2 py-0.5 rounded">
                                            🕐 {time}
                                          </span>
                                        ));
                                      }
                                    })()}
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-orange-600 mt-1">⚠️ Tom menu - prøv at hente igen</p>
                            )}
                          </>
                        )}
                        {card.status === 'extracted' && card.ai_summary && (
                          <p className="text-xs text-text-muted mt-1 italic whitespace-pre-line">{card.ai_summary}</p>
                        )}
                        {card.status === 'error' && (
                          <p className="text-xs text-error mt-1">{card.error_message}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {card.status === 'pending' && (
                          <button
                            onClick={() => handleExtractMenu(card.id, card.source_url)}
                            className="px-3 py-1.5 text-sm font-medium text-text-inverse bg-cta rounded hover:bg-cta-hover"
                          >
                            Hent
                          </button>
                        )}
                        {card.status === 'extracting' && (
                          <div className="flex items-center gap-2 text-sm text-info">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Henter...</span>
                          </div>
                        )}
                        {card.status === 'extracted' && (
                          <>
                            <button
                              onClick={() => toggleExpand(card.id)}
                              className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded hover:bg-surface-alt"
                            >
                              {isExpanded ? 'Skjul ▲' : 'Vis ▼'}
                            </button>
                            {/* Show retry button if extracted but empty/no data */}
                            {(!card.extracted_data || !card.extracted_data.categories || card.extracted_data.categories.length === 0) && (
                              <button
                                onClick={() => handleExtractMenu(card.id, card.source_url)}
                                className="px-3 py-1.5 text-sm text-orange-600 border border-orange-300 rounded hover:bg-orange-50"
                                title="Menu er tom - prøv at hente igen"
                              >
                                🔄 Hent igen
                              </button>
                            )}
                          </>
                        )}
                        {card.status === 'error' && (
                          <button
                            onClick={() => handleExtractMenu(card.id, card.source_url)}
                            className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded hover:bg-surface-alt"
                          >
                            Prøv igen
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteCard(card.id, card.source_url)}
                          disabled={activeExtractions.size > 0}
                          className={`px-2 py-1.5 text-sm rounded ${
                            activeExtractions.size > 0
                              ? 'text-text-muted cursor-not-allowed'
                              : 'text-error hover:bg-error-surface'
                          }`}
                          title={activeExtractions.size > 0 ? 'Kan ikke slettes mens udtrækning er i gang' : 'Slet menu'}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card Content (Expanded) */}
                  {isExpanded && card.extracted_data && (
                    <div className="px-4 py-3 space-y-3">
                      {/* Menu Title and Metadata */}
                      {(card.extracted_data.menuTitle || card.extracted_data.availabilityTime || card.extracted_data.availabilityDays) && (
                        <div className="pb-3 border-b border-border">
                          {card.extracted_data.menuTitle && (
                            <h3 className="text-base font-bold text-brand mb-1">
                              {card.extracted_data.menuTitle}
                            </h3>
                          )}
                          {card.extracted_data.menuSubtitle && (
                            <p className="text-sm text-text-secondary mb-2 italic">
                              {card.extracted_data.menuSubtitle}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 text-xs">
                            {card.extracted_data.availabilityTime && (
                              <span className="inline-flex items-center px-2 py-1 rounded bg-info-surface text-info-text">
                                🕐 {card.extracted_data.availabilityTime}
                              </span>
                            )}
                            {card.extracted_data.availabilityDays && (
                              <span className="inline-flex items-center px-2 py-1 rounded bg-success-surface text-success-text">
                                📅 {card.extracted_data.availabilityDays}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Edit/Save buttons */}
                      <div className="flex justify-end gap-2 pb-2 border-b border-border">
                        {editingCard === card.id ? (
                          <>
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded hover:bg-surface-alt"
                            >
                              {t('common.cancel')}
                            </button>
                            <button
                              onClick={() => handleSaveEdit()}
                              className="px-3 py-1.5 text-sm font-medium text-text-inverse bg-cta rounded hover:bg-cta-hover"
                            >
                              {t('common.save')}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(card)}
                            className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded hover:bg-surface-alt"
                          >
                            ✏️ {t('common.edit')}
                          </button>
                        )}
                      </div>

                      {/* Menu content - editable or read-only */}
                      {(editingCard === card.id ? editingData : card.extracted_data).categories.map((category: any, catIdx: number) => (
                        <div key={catIdx}>
                          <div className="mb-2">
                            <div className="flex items-baseline gap-2">
                              <h4 className="text-sm font-semibold text-text">{category.name}</h4>
                              {category.timeRange && (
                                <span className="text-xs text-text-muted italic">({category.timeRange})</span>
                              )}
                            </div>
                            {category.categoryDescription && (
                              <p className="text-xs text-text-secondary mt-0.5 italic">
                                {category.categoryDescription}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            {category.items.map((item: any, itemIdx: number) => (
                              <div key={itemIdx} className="flex items-start justify-between gap-3 text-sm">
                                <div className="flex-1 space-y-1">
                                  {editingCard === card.id ? (
                                    <>
                                      <input
                                        type="text"
                                        value={item.name || ''}
                                        onChange={(e) => handleItemChange(catIdx, itemIdx, 'name', e.target.value)}
                                        className="w-full px-2 py-1 text-sm font-medium border border-border rounded"
                                        placeholder={t('menu.item.name')}
                                      />
                                      <textarea
                                        value={item.description || item.short_desc || ''}
                                        onChange={(e) => handleItemChange(catIdx, itemIdx, 'description', e.target.value)}
                                        className="w-full px-2 py-1 text-xs border border-border rounded"
                                        rows={2}
                                        placeholder={t('menu.item.description')}
                                      />
                                    </>
                                  ) : (
                                    <>
                                      <p className="font-medium text-text">{item.name}</p>
                                      {(item.description || item.short_desc) && (
                                        <p className="text-xs text-text-secondary">{item.description || item.short_desc}</p>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="w-28">
                                  {editingCard === card.id ? (
                                    <input
                                      type="text"
                                      value={item.price || ''}
                                      onChange={(e) => handleItemChange(catIdx, itemIdx, 'price', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-border rounded text-right"
                                      placeholder={t('menu.item.price')}
                                    />
                                  ) : (
                                    item.price && (
                                      <span className="text-sm font-medium text-text whitespace-nowrap">
                                        {item.price}{item.currency ? ` ${item.currency}` : ''}
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          )}

          {/* Add Manual Text Section — primary path for businesses with inaccessible menus */}
          <div className="bg-surface rounded-lg border border-border px-4 py-3">
            {!showAddText && (
              <button
                onClick={() => setShowAddText(true)}
                className="flex items-center gap-2 text-sm font-medium text-cta hover:text-cta-text"
              >
                <span>+</span>
                <span>{t('menu.addManualText')}</span>
              </button>
            )}

            {showAddText && (
              <div className="space-y-2">
                <p className="text-xs text-text-secondary">Indsæt jeres menu som tekst — f.eks. kopieret fra jeres kassesystem, PDF eller eget dokument.</p>
                <textarea
                  value={newTextInput}
                  onChange={(e) => setNewTextInput(e.target.value)}
                  placeholder={t('ui.menu.placeholder.example_list')}
                  className="w-full px-3 py-2 border border-border rounded text-sm min-h-[120px]"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddManualText}
                    disabled={!newTextInput.trim()}
                    className="px-3 py-2 text-sm font-medium text-text-inverse bg-cta rounded hover:bg-cta-hover disabled:bg-surface-alt"
                  >
                    {t('menu.add.analyze')}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddText(false)
                      setNewTextInput('')
                    }}
                    className="px-3 py-2 text-sm font-medium text-text-secondary border border-border rounded hover:bg-surface-alt"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add Link Section */}
          <div className="bg-surface rounded-lg border border-border px-4 py-3">
            {!showAddLink && (
              <button
                onClick={() => setShowAddLink(true)}
                className="flex items-center gap-2 text-sm font-medium text-cta hover:text-cta-text"
              >
                <span>+</span>
                <span>{t('menu.addManual')}</span>
              </button>
            )}

            {showAddLink && (
              <div className="space-y-2">
                <input
                  type="url"
                  value={newMenuInput}
                  onChange={(e) => setNewMenuInput(e.target.value)}
                  placeholder={t('menu.add.linkPlaceholder')}
                  className="w-full px-3 py-2 border border-border rounded text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddManualUrl}
                    disabled={!newMenuInput.trim()}
                    className="px-3 py-2 text-sm font-medium text-text-inverse bg-cta rounded hover:bg-cta-hover disabled:bg-surface-alt"
                  >
                    {t('menu.add.add')}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddLink(false)
                      setNewMenuInput('')
                    }}
                    className="px-3 py-2 text-sm font-medium text-text-secondary border border-border rounded hover:bg-surface-alt"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Empty State */}
          {menuCards.length === 0 && detectedUrls.length === 0 && (
            <div className="bg-surface rounded-lg border border-border px-4 py-8 text-center">
              <p className="text-sm text-text-secondary mb-3">{t('menu.sources.emptyState2')}</p>
              <p className="text-xs text-text-muted">
                {t('menu.sources.emptyState2Hint')}
              </p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6">
            <a
              href="/dashboard/profile"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-surface-alt transition-colors"
            >
              {t('menu.backToProfile')}
            </a>
            <a
              href="/dashboard/location"
              className="inline-flex items-center gap-2 px-6 py-2 text-sm bg-cta text-text-inverse font-medium rounded-lg hover:bg-cta-hover transition-colors"
            >
              {t('menu.nextLocation')}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function detectMenuType(url: string): MenuType {
  const lower = url.toLowerCase()
  const specialPatterns = ['jul', 'christmas', 'easter', 'påsk', 'sæson', 'season', 'weekend', 'event', 'selskab']
  
  for (const pattern of specialPatterns) {
    if (lower.includes(pattern)) return 'special'
  }
  
  return 'standard'
}

function detectMenuLabel(url: string): string {
  const urlLower = url.toLowerCase()
  const pathMatch = urlLower.match(/\/([^\/]+)\/?$/)
  const path = pathMatch?.[1] || ''
  
  const patterns: Array<[string, string]> = [
    ['julefrokost', 'Julefrokost'],
    ['frokost', 'Frokost'],
    ['lunch', 'Frokost'],
    ['middag', 'Middag'],
    ['dinner', 'Middag'],
    ['aften', 'Aftenmenu'],
    ['brunch', 'Brunch'],
    ['morgenmad', 'Morgenmad'],
    ['cocktail', 'Cocktails'],
    ['drinks', 'Drikkevarer'],
    ['vin', 'Vinkort'],
    ['wine', 'Vinkort'],
    ['menu', 'Menukort']
  ]
  
  for (const [pattern, label] of patterns) {
    if (path.includes(pattern)) return label
  }
  
  return 'Menukort'
}

export default MenuPage
