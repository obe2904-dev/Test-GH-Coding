import React from 'react'
import { supabase } from '../../../../../lib/supabase'
import type { MenuExtraction } from './useMenuExtractions'
import type { MenuUrlState } from './useMenuSources'

/**
 * Detect menu name from URL - patterns ordered specific to generic
 */
function detectMenuNameFromUrl(url: string): string {
  const urlLower = url.toLowerCase()
  const pathMatch = urlLower.match(/\/([^\/]+)\/?$/)
  const path = pathMatch?.[1] || ''
  
  const patterns: Array<[string, string]> = [
    ['julefrokost', 'Julefrokost'], ['aftensmad', 'Aftenmenu'], ['take-away', 'Takeaway'],
    ['a-la-carte', 'À la carte'], ['menukort', 'Menukort'], ['vinmenu', 'Vinkort'],
    ['morgenmad', 'Morgenmad'], ['brunch', 'Brunch'], ['frokost', 'Frokost'], ['lunch', 'Frokost'],
    ['middag', 'Middag'], ['dinner', 'Middag'], ['aften', 'Aftenmenu'], ['evening', 'Aftenmenu'],
    ['cocktails', 'Cocktails'], ['cocktail', 'Cocktails'], ['drikkevarer', 'Drikkevarer'],
    ['drinks', 'Drinks'], ['vine', 'Vinkort'], ['wine', 'Vinkort'], ['vin', 'Vinkort'],
    ['beer', 'Ølkort'], ['bar', 'Barmenu'], ['ol', 'Ølkort'],
    ['desserter', 'Desserter'], ['dessert', 'Desserter'], ['forretter', 'Forretter'],
    ['hovedretter', 'Hovedretter'], ['burgers', 'Burgere'], ['burger', 'Burgere'],
    ['sandwich', 'Sandwich'], ['pizza', 'Pizza'], ['sushi', 'Sushi'], ['tapas', 'Tapas'],
    ['takeaway', 'Takeaway'], ['catering', 'Catering'], ['christmas', 'Julemenu'], ['jul', 'Julemenu'],
    ['menu', 'Menukort'], ['kort', 'Menukort']
  ]
  
  for (const [pattern, label] of patterns) {
    if (path.includes(pattern) || urlLower.includes(`/${pattern}/`)) {
      return label
    }
  }
  
  return 'Menukort'
}

export interface UseMenuHandlersReturn {
  menuUrl: string
  manualMenuText: string
  isProcessing: boolean
  processingError: string | null
  setMenuUrl: (url: string) => void
  setManualMenuText: (text: string) => void
  setIsProcessing: (processing: boolean) => void
  setProcessingError: (error: string | null) => void
  onMenuDescriptionChange: (value: string) => void
  handleFetchMenuUrl: () => Promise<void>
  handleManualMenuEntry: () => Promise<void>
  extractMenuFromUrl: (url: string) => Promise<void>
  extractAllMenus: () => Promise<void>
}

interface UseMenuHandlersProps {
  menuDescription: string
  onMenuDescriptionChangeCallback: (value: string) => void
  businessId: string
  userId?: string
  setMenuExtractions: (extractions: MenuExtraction[]) => void
  setExpandedMenus: (menus: Set<string>) => void
  menuExtractions: MenuExtraction[]
  expandedMenus: Set<string>
  loadMenuExtractions: () => Promise<void>
  updateMenuUrl: (url: string, updates: Partial<MenuUrlState>) => void
  extractMenuNameFromSource: (source: MenuUrlState) => string
  menuUrls: MenuUrlState[]
  newMenuInput: string
  setNewMenuInput: (input: string) => void
  saveMenuSourceToDB: (source: MenuUrlState) => Promise<void>
}

export function useMenuHandlers({
  menuDescription,
  onMenuDescriptionChangeCallback,
  businessId,
  userId,
  setMenuExtractions,
  setExpandedMenus,
  menuExtractions,
  expandedMenus,
  loadMenuExtractions: _loadMenuExtractions,
  updateMenuUrl,
  extractMenuNameFromSource,
  menuUrls,
  newMenuInput,
  setNewMenuInput,
  saveMenuSourceToDB
}: UseMenuHandlersProps): UseMenuHandlersReturn {
  const [menuUrl, setMenuUrl] = React.useState('')
  const [manualMenuText, setManualMenuText] = React.useState('')
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [processingError, setProcessingError] = React.useState<string | null>(null)

  void setMenuExtractions
  void setExpandedMenus
  void menuExtractions
  void expandedMenus

  const onMenuDescriptionChange = onMenuDescriptionChangeCallback

  const toExtractionCategories = (structured: any) => {
    const cats = Array.isArray(structured?.categories) ? structured.categories : []
    return cats.map((cat: any) => {
      const items = Array.isArray(cat?.items) ? cat.items : []
      return {
        id: crypto.randomUUID(),
        name: String(cat?.name || 'Kategori'),
        items: items.map((item: any) => ({
          id: crypto.randomUUID(),
          name: String(item?.name || 'Vare'),
          short_desc: item?.description ? String(item.description) : ''
        }))
      }
    })
  }

  const handleFetchMenuUrl = async () => {
    if (!menuUrl.trim()) {
      setProcessingError('Indtast venligst en URL')
      return
    }

    setIsProcessing(true)
    setProcessingError(null)

    const url = menuUrl.trim()

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!session) throw new Error('Not authenticated')

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/menu-extract-v2`

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ businessId, url })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      if (!data.resultId) throw new Error('Failed to queue menu extraction')

      let timeout: ReturnType<typeof setTimeout> | undefined
      let pollInterval: ReturnType<typeof setInterval> | undefined

      const subscription = supabase
        .channel(`menu_results_v2:${data.resultId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'menu_results_v2',
            filter: `id=eq.${data.resultId}`
          },
          async (payload: any) => {
            if (payload.new.status === 'done') {
              try {
                const structured = payload.new.structured_data
                const summary = structured?.summary || 'Menu extracted'
                const detectedName = detectMenuNameFromUrl(url)
                const separator = `\n\n--- ${detectedName} ---\n`
                const currentText = menuDescription.trim()
                const newText = currentText
                  ? `${currentText}${separator}${summary}`
                  : `${separator}${summary}`
                onMenuDescriptionChange(newText)

                try {
                  const { data: userRes } = await supabase.auth.getUser()
                  const currentUserId = userId || userRes?.user?.id
                  const extractedCategories = toExtractionCategories(structured)

                  await (supabase as any)
                    .from('menu_extractions')
                    .upsert({
                      id: payload.new.id,
                      business_id: businessId,
                      menu_source_id: null,
                      menu_name: detectedName,
                      menu_type: 'standard',
                      extracted_data: { categories: extractedCategories },
                      created_by: currentUserId || null,
                      updated_at: new Date().toISOString()
                    } as any, { onConflict: 'id' })

                  await _loadMenuExtractions()
                } catch (e) {
                  console.error('❌ Failed to persist menu_extractions from URL result:', e)
                }
              } finally {
                clearTimeout(timeout)
                if (pollInterval) clearInterval(pollInterval)
                supabase.removeChannel(subscription)
                setIsProcessing(false)
                setMenuUrl('')
              }
            } else if (payload.new.status === 'error') {
              setProcessingError(payload.new.error_message || 'Extraction failed')
              clearTimeout(timeout)
              if (pollInterval) clearInterval(pollInterval)
              supabase.removeChannel(subscription)
              setIsProcessing(false)
            }
          }
        )
        .subscribe()

      // Immediate fetch in case completion happens before subscription is live.
      let isAlreadyCompleted = false
      try {
        const { data: row, error: rowError } = await supabase
          .from('menu_results_v2')
          .select('*')
          .eq('id', data.resultId)
          .maybeSingle()

        if (rowError) console.warn('⚠️ menu_results_v2 immediate fetch error:', rowError)

        if ((row as any)?.status === 'done') {
          isAlreadyCompleted = true
          const structured = (row as any).structured_data
          const summary = structured?.summary || 'Menu extracted'
          const detectedName = detectMenuNameFromUrl(url)
          const separator = `\n\n--- ${detectedName} ---\n`
          const currentText = menuDescription.trim()
          const newText = currentText
            ? `${currentText}${separator}${summary}`
            : `${separator}${summary}`
          onMenuDescriptionChange(newText)

          try {
            const { data: userRes } = await supabase.auth.getUser()
            const currentUserId = userId || userRes?.user?.id
            const extractedCategories = toExtractionCategories(structured)

            await (supabase as any)
              .from('menu_extractions')
              .upsert({
                id: data.resultId,
                business_id: businessId,
                menu_source_id: null,
                menu_name: detectedName,
                menu_type: 'standard',
                extracted_data: { categories: extractedCategories },
                created_by: currentUserId || null,
                updated_at: new Date().toISOString(),
              } as any, { onConflict: 'id' })

            await _loadMenuExtractions()
          } catch (e) {
            console.error('❌ Failed to persist menu_extractions from URL result:', e)
          }

          supabase.removeChannel(subscription)
          setIsProcessing(false)
          setMenuUrl('')
        } else if ((row as any)?.status === 'error') {
          isAlreadyCompleted = true
          setProcessingError((row as any).error_message || 'Extraction failed')
          supabase.removeChannel(subscription)
          setIsProcessing(false)
        }
      } catch (e) {
        console.warn('⚠️ Failed to fetch immediate menu_results_v2 row:', e)
      }

      // Only set up polling if the job is not already completed
      if (isAlreadyCompleted) {
        console.log('✅ Job already completed, skipping polling')
        return
      }

      // Poll fallback (every 5s)
      pollInterval = setInterval(async () => {
        try {
          const { data: row, error: rowError } = await supabase
            .from('menu_results_v2')
            .select('*')
            .eq('id', data.resultId)
            .maybeSingle()

          if (rowError) {
            console.warn('⚠️ menu_results_v2 poll error:', rowError)
            return
          }

          if (!row) return

          if ((row as any)?.status === 'done') {
            const structured = (row as any).structured_data
            const summary = structured?.summary || 'Menu extracted'
            const detectedName = detectMenuNameFromUrl(url)
            const separator = `\n\n--- ${detectedName} ---\n`
            const currentText = menuDescription.trim()
            const newText = currentText
              ? `${currentText}${separator}${summary}`
              : `${separator}${summary}`
            onMenuDescriptionChange(newText)

            try {
              const { data: userRes } = await supabase.auth.getUser()
              const currentUserId = userId || userRes?.user?.id
              const extractedCategories = toExtractionCategories(structured)

              await (supabase as any)
                .from('menu_extractions')
                .upsert({
                  id: data.resultId,
                  business_id: businessId,
                  menu_source_id: null,
                  menu_name: detectedName,
                  menu_type: 'standard',
                  extracted_data: { categories: extractedCategories },
                  created_by: currentUserId || null,
                  updated_at: new Date().toISOString(),
                } as any, { onConflict: 'id' })

              await _loadMenuExtractions()
            } catch (e) {
              console.error('❌ Failed to persist menu_extractions from URL result (poll):', e)
            }

            clearTimeout(timeout)
            if (pollInterval) clearInterval(pollInterval)
            supabase.removeChannel(subscription)
            setIsProcessing(false)
            setMenuUrl('')
          } else if ((row as any)?.status === 'error') {
            setProcessingError((row as any).error_message || 'Extraction failed')
            clearTimeout(timeout)
            if (pollInterval) clearInterval(pollInterval)
            supabase.removeChannel(subscription)
            setIsProcessing(false)
          }
        } catch (e) {
          console.warn('⚠️ menu_results_v2 poll exception:', e)
        }
      }, 5000)

      timeout = setTimeout(() => {
        supabase.removeChannel(subscription)
        if (pollInterval) clearInterval(pollInterval)
        setProcessingError('Extraction timeout - took too long')
        setIsProcessing(false)
      }, 30 * 60 * 1000)
    } catch (error) {
      console.error('URL queue error:', error)
      setProcessingError('Kunne ikke hente/analyser menu fra URL. Tjek at linket er korrekt.')
      setIsProcessing(false)
    }
  }

  const handleManualMenuEntry = async () => {
    const textToProcess = newMenuInput.trim()
    if (!textToProcess) {
      setProcessingError('Indtast venligst en menu')
      return
    }

    if (textToProcess.length > 5000) {
      setProcessingError('Menuen er for lang (max 5000 tegn)')
      return
    }

    setIsProcessing(true)
    setProcessingError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active session')

      const parseResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-menu-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            extractedText: textToProcess,
            menuName: 'Manuelt indtastet menu',
            language: 'da'
          })
        }
      )

      if (!parseResponse.ok) {
        const parseError = await parseResponse.json().catch(() => ({}))
        console.error('❌ Parse error:', parseError)
        throw new Error('Kunne ikke analysere menuen')
      }

      const parsedMenuData = await parseResponse.json()

      if (businessId && parsedMenuData) {
        const { data: userRes } = await supabase.auth.getUser()
        const currentUserId = userId || userRes?.user?.id

        const extractedCategories = toExtractionCategories(parsedMenuData)
        const { error: saveError } = await (supabase as any)
          .from('menu_extractions')
          .insert({
            business_id: businessId,
            menu_source_id: null,
            menu_name: 'Manuelt indtastet menu',
            menu_type: 'standard',
            extracted_data: { categories: extractedCategories },
            created_by: currentUserId || null,
          })

        if (saveError) {
          console.error('❌ Failed to save menu extraction:', saveError)
          throw new Error('Kunne ikke gemme menuen')
        }

        await _loadMenuExtractions()
      }

      alert('Menu analyseret og tilføjet!')
      setNewMenuInput('')
    } catch (error) {
      console.error('❌ Manual menu entry error:', error)
      setProcessingError(error instanceof Error ? error.message : 'Kunne ikke analysere menuen')
    } finally {
      setIsProcessing(false)
    }
  }

  const extractMenuFromUrl = async (url: string) => {
    console.log('🔍 Starting extraction for:', url)
    
    // Update status if URL is in state (it might not be yet if just added)
    const menuUrlState = menuUrls.find(m => m.url === url)
    if (menuUrlState) {
      updateMenuUrl(url, { status: 'extracting', error: undefined })
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('❌ Session error:', sessionError)
        throw new Error('Could not get session')
      }
      if (!session) {
        console.error('❌ No active session')
        throw new Error('Not authenticated')
      }

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/menu-extract-v2`

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          businessId,
          url,
        })
      })

      console.log('📡 Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      if (!data.resultId) throw new Error('Failed to queue menu extraction')

      updateMenuUrl(url, { status: 'processing', resultId: data.resultId })

      let timeout: ReturnType<typeof setTimeout> | undefined
      let pollInterval: ReturnType<typeof setInterval> | undefined

      const subscription = supabase
        .channel(`menu_results_v2:${data.resultId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'menu_results_v2',
            filter: `id=eq.${data.resultId}`
          },
          async (payload: any) => {
            console.log('📡 Realtime update received:', payload.new)

            if (payload.new.status === 'done') {
              try {
                const structured = payload.new.structured_data

                updateMenuUrl(url, {
                  status: 'extracted',
                  itemCount: structured?.categories?.length || 0,
                  extractedData: structured
                })

                // Save status to database
                const updatedMenu = menuUrls.find(m => m.url === url)
                if (updatedMenu) {
                  await saveMenuSourceToDB({
                    ...updatedMenu,
                    status: 'extracted',
                    itemCount: structured?.categories?.length || 0,
                    extractedData: structured
                  })
                }

                const currentText = menuDescription.trim()
                const menuName = extractMenuNameFromSource(menuUrlState)
                const summary = structured?.summary || 'Menu extracted'
                const separator = `\n\n--- ${menuName} ---\n`
                const newText = currentText
                  ? `${currentText}${separator}${summary}`
                  : `${separator}${summary}`
                onMenuDescriptionChange(newText)

                try {
                  const { data: userRes } = await supabase.auth.getUser()
                  const currentUserId = userId || userRes?.user?.id
                  const extractedCategories = toExtractionCategories(structured)

                  const { error: upsertError } = await (supabase as any)
                    .from('menu_extractions')
                    .upsert({
                      id: payload.new.id,
                      business_id: businessId,
                      menu_source_id: null,
                      menu_name: menuName,
                      menu_type: menuUrlState.menuType,
                      extracted_data: { categories: extractedCategories },
                      created_by: currentUserId || null,
                      updated_at: new Date().toISOString()
                    } as any, { onConflict: 'id' })

                  if (upsertError) {
                    console.error('❌ Failed to upsert menu_extractions:', upsertError)
                  } else {
                    await _loadMenuExtractions()
                  }
                } catch (e) {
                  console.error('❌ Failed to persist menu_extractions from URL result:', e)
                }

                if (timeout) clearTimeout(timeout)
                if (pollInterval) clearInterval(pollInterval)
              } finally {
                supabase.removeChannel(subscription)
              }
            } else if (payload.new.status === 'error') {
              updateMenuUrl(url, {
                status: 'error',
                error: payload.new.error_message || 'Extraction failed'
              })

              // Save error status to database
              const updatedMenu = menuUrls.find(m => m.url === url)
              if (updatedMenu) {
                await saveMenuSourceToDB({
                  ...updatedMenu,
                  status: 'error',
                  error: payload.new.error_message || 'Extraction failed'
                })
              }

              if (timeout) clearTimeout(timeout)
              if (pollInterval) clearInterval(pollInterval)
              supabase.removeChannel(subscription)
            }
          }
        )
        .subscribe()

      // Immediate fetch in case completion happens before subscription is live.
      let isAlreadyCompleted = false
      try {
        const { data: row, error: rowError } = await supabase
          .from('menu_results_v2')
          .select('*')
          .eq('id', data.resultId)
          .maybeSingle()

        if (rowError) console.warn('⚠️ menu_results_v2 immediate fetch error:', rowError)
        if (!row && !rowError) console.warn('⚠️ menu_results_v2 immediate fetch returned null row (RLS/no access or not found)')

        if ((row as any)?.status === 'done') {
          isAlreadyCompleted = true
          const structured = (row as any).structured_data

          updateMenuUrl(url, {
            status: 'extracted',
            itemCount: structured?.categories?.length || 0,
            extractedData: structured
          })

          // Save status to database
          const updatedMenu = menuUrls.find(m => m.url === url)
          if (updatedMenu) {
            await saveMenuSourceToDB({
              ...updatedMenu,
              status: 'extracted',
              itemCount: structured?.categories?.length || 0,
              extractedData: structured
            })
          }

          const currentText = menuDescription.trim()
          const menuName = extractMenuNameFromSource(menuUrlState)
          const summary = structured?.summary || 'Menu extracted'
          const separator = `\n\n--- ${menuName} ---\n`
          const newText = currentText
            ? `${currentText}${separator}${summary}`
            : `${separator}${summary}`
          onMenuDescriptionChange(newText)

          try {
            const { data: userRes } = await supabase.auth.getUser()
            const currentUserId = userId || userRes?.user?.id
            const extractedCategories = toExtractionCategories(structured)

            const { error: upsertError } = await (supabase as any)
              .from('menu_extractions')
              .upsert({
                id: data.resultId,
                business_id: businessId,
                menu_source_id: null,
                menu_name: menuName,
                menu_type: menuUrlState.menuType,
                extracted_data: { categories: extractedCategories },
                created_by: currentUserId || null,
                updated_at: new Date().toISOString()
              } as any, { onConflict: 'id' })

            if (upsertError) console.error('❌ Failed to upsert menu_extractions:', upsertError)
            else await _loadMenuExtractions()
          } catch (e) {
            console.error('❌ Failed to persist menu_extractions from URL result:', e)
          }

          supabase.removeChannel(subscription)
        } else if ((row as any)?.status === 'error') {
          isAlreadyCompleted = true
          updateMenuUrl(url, {
            status: 'error',
            error: (row as any).error_message || 'Extraction failed'
          })
          supabase.removeChannel(subscription)
        }
      } catch (e) {
        console.warn('⚠️ Failed to fetch immediate menu_results_v2 row:', e)
      }

      // Only set up polling if the job is not already completed
      if (isAlreadyCompleted) {
        console.log('✅ Job already completed, skipping polling')
        return
      }

      // Poll fallback (every 5s)
      pollInterval = setInterval(async () => {
        try {
          const { data: row, error: rowError } = await supabase
            .from('menu_results_v2')
            .select('*')
            .eq('id', data.resultId)
            .maybeSingle()

          if (rowError) {
            console.warn('⚠️ menu_results_v2 poll error:', rowError)
            return
          }

          if (!row) {
            console.warn('⚠️ menu_results_v2 poll returned null row (RLS/no access or not found)')
            return
          }

          if ((row as any)?.status === 'done') {
            const structured = (row as any).structured_data
            updateMenuUrl(url, {
              status: 'extracted',
              itemCount: structured?.categories?.length || 0,
              extractedData: structured
            })

            const currentText = menuDescription.trim()
            const menuName = extractMenuNameFromSource(menuUrlState)
            const summary = structured?.summary || 'Menu extracted'
            const separator = `\n\n--- ${menuName} ---\n`
            const newText = currentText
              ? `${currentText}${separator}${summary}`
              : `${separator}${summary}`
            onMenuDescriptionChange(newText)

            try {
              const { data: userRes } = await supabase.auth.getUser()
              const currentUserId = userId || userRes?.user?.id
              const extractedCategories = toExtractionCategories(structured)

              const { error: upsertError } = await (supabase as any)
                .from('menu_extractions')
                .upsert({
                  id: data.resultId,
                  business_id: businessId,
                  menu_source_id: null,
                  menu_name: menuName,
                  menu_type: menuUrlState.menuType,
                  extracted_data: { categories: extractedCategories },
                  created_by: currentUserId || null,
                  updated_at: new Date().toISOString()
                } as any, { onConflict: 'id' })

              if (upsertError) console.error('❌ Failed to upsert menu_extractions (poll):', upsertError)
              else await _loadMenuExtractions()
            } catch (e) {
              console.error('❌ Failed to persist menu_extractions from URL result (poll):', e)
            }

            if (timeout) clearTimeout(timeout)
            if (pollInterval) clearInterval(pollInterval)
            supabase.removeChannel(subscription)
          } else if ((row as any)?.status === 'error') {
            updateMenuUrl(url, {
              status: 'error',
              error: (row as any).error_message || 'Extraction failed'
            })
            if (timeout) clearTimeout(timeout)
            if (pollInterval) clearInterval(pollInterval)
            supabase.removeChannel(subscription)
          }
        } catch (e) {
          console.warn('⚠️ menu_results_v2 poll exception:', e)
        }
      }, 5000)

      timeout = setTimeout(() => {
        supabase.removeChannel(subscription)
        if (pollInterval) clearInterval(pollInterval)
        updateMenuUrl(url, {
          status: 'error',
          error: 'Extraction timeout - took too long'
        })
      }, 30 * 60 * 1000)

      console.log('✅ Waiting for async extraction to complete...')
      console.log('⏱️ This may take 1-5 minutes for OCR processing')
    } catch (error) {
      console.error('❌ Menu extraction error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Kunne ikke hente menu'
      updateMenuUrl(url, {
        status: 'pending',
        error: errorMessage
      })
    }
  }

  /**
   * Extract menu content from all AI-detected menu URLs
   */
  const extractAllMenus = async () => {
    // Get all AI-detected URLs that haven't been extracted yet
    const urlsToExtract = menuUrls.filter(
      m => m.source === 'ai' && 
      m.status !== 'ignored' && 
      m.status !== 'extracted' &&
      m.status !== 'processing'
    )

    if (urlsToExtract.length === 0) {
      setProcessingError('Ingen menu-URL\'er at hente')
      return
    }

    setIsProcessing(true)
    setProcessingError(null)

    console.log(`🚀 Starting extraction for ${urlsToExtract.length} menu URLs`)

    // Extract each URL sequentially to avoid overwhelming the system
    for (const menuSource of urlsToExtract) {
      try {
        console.log(`📥 Extracting: ${menuSource.url}`)
        await extractMenuFromUrl(menuSource.url)
      } catch (error) {
        console.error(`❌ Failed to extract ${menuSource.url}:`, error)
        // Continue with next URL even if one fails
      }
    }

    setIsProcessing(false)
    console.log(`✅ Completed extraction for ${urlsToExtract.length} menu URLs`)
  }

  return {
    menuUrl,
    manualMenuText,
    isProcessing,
    processingError,
    setMenuUrl,
    setManualMenuText,
    setIsProcessing,
    setProcessingError,
    onMenuDescriptionChange,
    handleFetchMenuUrl,
    handleManualMenuEntry,
    extractMenuFromUrl,
    extractAllMenus
  }
}
