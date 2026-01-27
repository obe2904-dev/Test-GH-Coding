import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useTierStore } from '../../stores/tierStore'

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
  created_at: string
}

function MenuPage() {
  const { t } = useTranslation()
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
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [addMenuMode, setAddMenuMode] = useState<'link' | 'text' | null>(null)
  const [newMenuInput, setNewMenuInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  
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
        .select('*')
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
          if (result.status === 'queued' || result.status === 'claimed') status = 'extracting'
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
          created_at: source.created_at
        }
      })

      setMenuCards(cards)
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

      const endpoint = import.meta.env.VITE_SUPABASE_FUNCTION_ANALYZE_WEBSITE as string
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          url: websiteUrl,
          businessId
        })
      })

      if (!response.ok) {
        throw new Error(t('menu.error.analyzeFailed'))
      }

      const result = await response.json()
      const detectedUrls = result.detectedMenuUrls || result.allMenuUrls || []

      if (detectedUrls.length === 0) {
        setError(t('menu.error.noMenusFound'))
        return
      }

      // SMART RE-SCAN: Check for existing menus and only add new ones
      console.log('🔍 Smart re-scan: Checking for existing menus...')
      
      // Get existing menu sources
      const { data: existingSources } = await supabase
        .from('menu_sources')
        .select('source_url, status')
        .eq('business_id', businessId)
      
      const existingUrls = new Set((existingSources || []).map((s: any) => s.source_url))
      const existingUrlsArray = Array.from(existingUrls)
      
      // Filter out duplicates - only keep NEW URLs
      const newUrls = detectedUrls.filter((url: string) => !existingUrls.has(url))
      
      console.log(`📊 Found ${detectedUrls.length} total menu URLs:`)
      console.log(`   - ${existingUrlsArray.length} already exist`)
      console.log(`   - ${newUrls.length} are new`)

      // Update error/ignored menus to pending for retry
      const errorOrIgnoredSources = (existingSources || []).filter((s: any) => 
        s.status === 'error' || s.status === 'ignored'
      )
      
      if (errorOrIgnoredSources.length > 0) {
        console.log(`🔄 Resetting ${errorOrIgnoredSources.length} error/ignored menus to pending`)
        await supabase
          .from('menu_sources')
          .update({ status: 'pending' })
          .eq('business_id', businessId)
          .in('status', ['error', 'ignored'])
      }

      // Add only NEW sources
      if (newUrls.length > 0) {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData?.user?.id
        
        const sourcesToInsert = newUrls.map((url: string) => ({
          business_id: businessId,
          source_url: url,
          source_type: 'url',
          source_origin: 'ai_detected',
          status: 'pending',
          menu_type: detectMenuType(url),
          label: detectMenuLabel(url),
          created_by: userId,
          created_at: new Date().toISOString()
        }))

        await supabase.from('menu_sources').insert(sourcesToInsert)
        console.log(`✅ Added ${newUrls.length} new menu sources`)
      } else if (existingUrlsArray.length > 0) {
        console.log('ℹ️ No new menus found - all detected menus already exist')
      }

      // Show summary message
      if (newUrls.length > 0 || errorOrIgnoredSources.length > 0) {
        const parts = []
        if (newUrls.length > 0) parts.push(`${newUrls.length} nye menuer tilføjet`)
        if (errorOrIgnoredSources.length > 0) parts.push(`${errorOrIgnoredSources.length} genstartet`)
        setError(null) // Clear any previous errors
        // You could show a success toast here
      } else if (existingUrlsArray.length > 0) {
        setError(t('menu.info.noNewMenus'))
      }

      // Reload cards
      await loadMenuCards(businessId)
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
        throw new Error('Kunne ikke udtrække menu')
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
            } else if (jobResult.status === 'error' || jobResult.status === 'failed') {
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
                  error_message: jobResult?.error_message || 'Timeout'
                })
                .eq('id', cardId)

              await loadMenuCards(businessId)
            }
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
      const kidsKeywords = ['børn', 'kids', 'children', 'child', 'junior', 'lille']

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

        // Check for kids menu in categories
        data.categories.forEach((cat: any) => {
          const catName = (cat.name || '').toLowerCase()
          if (kidsKeywords.some(kw => catName.includes(kw))) {
            hasKidsMenu = true
            console.log(`👶 Kids menu detected: ${cat.name}`)
          }
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
        average_check_per_person: Math.round(averagePrice),
        price_level: priceLevel,
        currency: 'DKK',
        has_kids_menu: hasKidsMenu
      }

      const { error: upsertError } = await supabase
        .from('business_operations')
        .upsert(opsData, {
          onConflict: 'business_id',
          ignoreDuplicates: false // Update existing record
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
        created_at: new Date().toISOString()
      })

      setNewMenuInput('')
      setAddMenuMode(null)
      setShowAddMenu(false)
      
      await loadMenuCards(businessId)
    } catch (error) {
      console.error('Error adding manual URL:', error)
      setError(t('menu.error.addFailed'))
    }
  }

  const handleAddManualText = async () => {
    if (!businessId || !newMenuInput.trim()) return

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
          text: newMenuInput,
          businessId,
          sourceType: 'manual_text'
        })
      })

      if (!response.ok) {
        throw new Error(t('menu.error.analyzeMenuFailed'))
      }

      setNewMenuInput('')
      setAddMenuMode(null)
      setShowAddMenu(false)
      
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
      // Delete source
      await supabase.from('menu_sources').delete().eq('id', cardId)
      
      // Delete corresponding extraction results
      await supabase.from('menu_results_v2').delete().eq('source_url', sourceUrl)
      
      // Reload
      if (businessId) await loadMenuCards(businessId)
    } catch (error) {
      console.error('Error deleting card:', error)
    }
  }

  const handleStartEdit = (card: MenuCard) => {
    setEditingCard(card.id)
    setEditingData(JSON.parse(JSON.stringify(card.extracted_data))) // Deep clone
  }

  const handleCancelEdit = () => {
    setEditingCard(null)
    setEditingData(null)
  }

  const handleSaveEdit = async (cardId: string, sourceUrl: string) => {
    if (!editingData) return

    try {
      // Update menu_results_v2 with edited data
      await supabase
        .from('menu_results_v2')
        .update({ structured_data: editingData })
        .eq('source_url', sourceUrl)

      setEditingCard(null)
      setEditingData(null)

      // Reload cards
      if (businessId) await loadMenuCards(businessId)
    } catch (error) {
      console.error('Error saving edited menu:', error)
      alert(t('menu.error.saveEdit'))
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

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center py-12">
        <div className="text-sm text-gray-500">{t('common.loading')}</div>
      </div>
    )
  }

  // Free tier - upgrade prompt
  if (currentTier === 'free') {
    return (
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-full py-6 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-900 mb-1">{t('menu.header.title')}</h1>
            <p className="text-sm text-gray-600">{t('menu.header.subtitle')}</p>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-6">
            <div className="flex items-start gap-3">
              <div className="text-3xl">🍽️</div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2 text-lg">{t('menu.free.upgradeTitle')}</h3>
                <p className="text-sm text-gray-600 mb-4">{t('menu.free.description')}</p>
                <button
                  onClick={() => (window.location.href = '/dashboard/plans')}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded font-medium text-sm"
                >
                  {t('menu.free.cta')}
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
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold text-gray-900 mb-1">{t('menu.header.title')}</h1>
            <p className="text-sm text-gray-600">{t('menu.header.subtitle2')}</p>
          </div>

        {/* Batch extraction progress indicator */}
        {(activeExtractions.size > 0 || extractionQueue.length > 0) && (
          <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  {activeExtractions.size > 0 && t('menu.batch.extracting')}
                  {extractionQueue.length > 0 && ` ${extractionQueue.length} ${t('menu.batch.inQueue')}`}
                </p>
                <p className="text-xs text-blue-700 mt-0.5">{t('menu.batch.helper')}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {/* Detect Menus Section */}
          {websiteUrl && (
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-700">
                    {t('menu.findOn')} <span className="font-medium">{websiteUrl}</span>
                  </p>
                </div>
                <button
                  onClick={handleDetectMenus}
                  disabled={isDetectingMenus}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  {isDetectingMenus ? t('menu.detect.searching') : `🔍 ${t('menu.detect.find')}`}
                </button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Menu Cards */}
          <div className="space-y-3">
            {menuCards.map(card => {
              const isExpanded = expandedCards.has(card.id)

              return (
                <div key={card.id} className="bg-white rounded-lg border border-gray-200">
                  {/* Card Header */}
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {card.status === 'pending' && !extractionQueue.some(q => q.cardId === card.id) && <span className="text-gray-400">📋</span>}
                          {extractionQueue.some(q => q.cardId === card.id) && <span className="text-yellow-500">⏸️</span>}
                          {card.status === 'extracting' && <span className="text-blue-500">⏳</span>}
                          {card.status === 'extracted' && <span className="text-green-500">✅</span>}
                          {card.status === 'error' && <span className="text-red-500">❌</span>}
                          <h3 className="text-sm font-semibold text-gray-900">{card.label}</h3>
                          {extractionQueue.some(q => q.cardId === card.id) && (
                            <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                              I kø #{extractionQueue.findIndex(q => q.cardId === card.id) + 1}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{card.source_url}</p>
                        {card.status === 'extracted' && (
                          <>
                            {card.item_count > 0 ? (
                              <>
                                <p className="text-xs text-gray-600 mt-1">
                                  {card.item_count} items
                                  {card.average_price && !isNaN(card.average_price) && ` · Ø ${Math.round(card.average_price)} DKK`}
                                </p>
                                {/* Show menu period timing if available */}
                                {card.extracted_data?.menuPeriods && card.extracted_data.menuPeriods.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {/* Deduplicate timing badges - if all periods have same time, show once */}
                                    {(() => {
                                      const periods = card.extracted_data.menuPeriods;
                                      const uniqueTimes = new Set(periods.map((p: any) => `${p.startTime}-${p.endTime}`));
                                      
                                      if (uniqueTimes.size === 1) {
                                        // All same time - show once with count if multiple periods
                                        const firstPeriod = periods[0];
                                        return (
                                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                            🕐 {firstPeriod.startTime}-{firstPeriod.endTime}
                                            {periods.length > 1 && ` (${periods.length} categories)`}
                                          </span>
                                        );
                                      } else {
                                        // Different times - show each unique one
                                        return Array.from(uniqueTimes).map((time, idx) => (
                                          <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
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
                        {card.status === 'error' && (
                          <p className="text-xs text-red-600 mt-1">{card.error_message}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {card.status === 'pending' && (
                          <button
                            onClick={() => handleExtractMenu(card.id, card.source_url)}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700"
                          >
                            Hent
                          </button>
                        )}
                        {card.status === 'extracting' && (
                          <div className="flex items-center gap-2 text-sm text-blue-600">
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
                              className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              {isExpanded ? 'Skjul ▲' : 'Udvid ▼'}
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
                            className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                          >
                            Prøv igen
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteCard(card.id, card.source_url)}
                          disabled={activeExtractions.size > 0}
                          className={`px-2 py-1.5 text-sm rounded ${
                            activeExtractions.size > 0
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-red-600 hover:bg-red-50'
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
                      {/* Menu Title and Availability Time */}
                      {(card.extracted_data.menuTitle || card.extracted_data.availabilityTime) && (
                        <div className="pb-3 border-b border-gray-200">
                          {card.extracted_data.menuTitle && (
                            <h3 className="text-base font-bold text-gray-900 mb-1">
                              {card.extracted_data.menuTitle}
                            </h3>
                          )}
                          {card.extracted_data.availabilityTime && (
                            <p className="text-sm text-gray-600">
                              🕒 Tilgængelig: {card.extracted_data.availabilityTime}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Edit/Save buttons */}
                      <div className="flex justify-end gap-2 pb-2 border-b border-gray-200">
                        {editingCard === card.id ? (
                          <>
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              {t('common.cancel')}
                            </button>
                            <button
                              onClick={() => handleSaveEdit(card.id, card.source_url)}
                              className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700"
                            >
                              {t('common.save')}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(card)}
                            className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                          >
                            ✏️ {t('common.edit')}
                          </button>
                        )}
                      </div>

                      {/* Menu content - editable or read-only */}
                      {(editingCard === card.id ? editingData : card.extracted_data).categories.map((category: any, catIdx: number) => (
                        <div key={catIdx}>
                          <div className="flex items-baseline gap-2 mb-2">
                            <h4 className="text-sm font-semibold text-gray-900">{category.name}</h4>
                            {category.timeRange && (
                              <span className="text-xs text-gray-500 italic">({category.timeRange})</span>
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
                                        className="w-full px-2 py-1 text-sm font-medium border border-gray-300 rounded"
                                        placeholder={t('menu.item.name')}
                                      />
                                      <textarea
                                        value={item.description || item.short_desc || ''}
                                        onChange={(e) => handleItemChange(catIdx, itemIdx, 'description', e.target.value)}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                        rows={2}
                                        placeholder={t('menu.item.description')}
                                      />
                                    </>
                                  ) : (
                                    <>
                                      <p className="font-medium text-gray-900">{item.name}</p>
                                      {(item.description || item.short_desc) && (
                                        <p className="text-xs text-gray-600">{item.description || item.short_desc}</p>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="w-24">
                                  {editingCard === card.id ? (
                                    <input
                                      type="text"
                                      value={item.price || ''}
                                      onChange={(e) => handleItemChange(catIdx, itemIdx, 'price', e.target.value)}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-right"
                                      placeholder={t('menu.item.price')}
                                    />
                                  ) : (
                                    item.price && (
                                      <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                                        {item.price}
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

          {/* Add Menu Section */}
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
            {!showAddMenu && (
              <button
                onClick={() => setShowAddMenu(true)}
                className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                <span>+</span>
                <span>{t('menu.addManual')}</span>
              </button>
            )}

            {showAddMenu && !addMenuMode && (
              <div className="space-y-2">
                <button
                  onClick={() => setAddMenuMode('link')}
                  className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <span>🔗</span>
                  <span>{t('menu.add.link')}</span>
                </button>
                <button
                  onClick={() => setAddMenuMode('text')}
                  className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <span>✍️</span>
                  <span>{t('menu.add.text')}</span>
                </button>
                <button
                  onClick={() => setShowAddMenu(false)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  <span>✕</span>
                  <span>{t('common.close')}</span>
                </button>
              </div>
            )}

            {addMenuMode === 'link' && (
              <div className="space-y-2">
                <input
                  type="url"
                  value={newMenuInput}
                  onChange={(e) => setNewMenuInput(e.target.value)}
                  placeholder={t('menu.add.linkPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                    <button
                      onClick={handleAddManualUrl}
                      disabled={!newMenuInput.trim()}
                      className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:bg-gray-400"
                    >
                      {t('menu.add.add')}
                    </button>
                  <button
                    onClick={() => {
                      setAddMenuMode(null)
                      setNewMenuInput('')
                    }}
                    className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {addMenuMode === 'text' && (
              <div className="space-y-2">
                <textarea
                  value={newMenuInput}
                  onChange={(e) => setNewMenuInput(e.target.value)}
                  placeholder={t('ui.menu.placeholder.example_list')}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm min-h-[120px]"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddManualText}
                    disabled={!newMenuInput.trim()}
                    className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:bg-gray-400"
                  >
                    {t('menu.add.analyze')}
                  </button>
                  <button
                    onClick={() => {
                      setAddMenuMode(null)
                      setNewMenuInput('')
                    }}
                    className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Empty State */}
          {menuCards.length === 0 && (
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-8 text-center">
              <p className="text-sm text-gray-600 mb-3">Ingen menuer tilføjet endnu</p>
              <p className="text-xs text-gray-500">
                Klik "Find menuer" ovenfor eller tilføj manuelt nedenfor
              </p>
            </div>
          )}
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
