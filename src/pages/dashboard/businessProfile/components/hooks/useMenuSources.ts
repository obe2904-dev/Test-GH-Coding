import React from 'react'
import { supabase } from '../../../../../lib/supabase'

export type MenuType = 'standard' | 'special'

export interface MenuUrlState {
  url: string
  source: 'ai' | 'manual'
  menuType: MenuType
  status: 'pending' | 'extracting' | 'extracted' | 'ignored' | 'processing' | 'error'
  itemCount?: number
  error?: string
  isEditing?: boolean
  deleteConfirm?: boolean
  fileName?: string
  isDeleting?: boolean
  deleteRestoring?: boolean
  resultId?: string  // For tracking async extraction jobs
  extractedData?: any  // For storing structured menu data
}

export interface UseMenuSourcesReturn {
  menuUrls: MenuUrlState[]
  showAddMenu: boolean
  addMenuMode: 'link' | 'pdf' | 'text' | null
  newMenuInput: string
  replaceStandardMenuId: string | null
  setShowAddMenu: (show: boolean) => void
  setAddMenuMode: (mode: 'link' | 'pdf' | 'text' | null) => void
  setNewMenuInput: (input: string) => void
  setReplaceStandardMenuId: (id: string | null) => void
  updateMenuUrl: (url: string, updates: Partial<MenuUrlState>) => void
  initiateDelete: (url: string) => void
  undoDelete: (url: string) => void
  hasStandardMenu: () => boolean
  handleMenuTypeChange: (url: string, newType: MenuType) => void
  confirmReplaceStandardMenu: () => void
  addManualMenu: (input: string, file?: File) => void
  loadMenuSources: () => Promise<void>
  saveMenuSourceToDB: (source: MenuUrlState) => Promise<void>
  extractMenuNameFromSource: (source: MenuUrlState) => string
  getStatusLabel: (status: MenuUrlState['status']) => string
  getStatusColor: (status: MenuUrlState['status']) => string
}

export function useMenuSources(businessId: string, userId?: string): UseMenuSourcesReturn {
  const [menuUrls, setMenuUrls] = React.useState<MenuUrlState[]>([])
  const [showAddMenu, setShowAddMenu] = React.useState(false)
  const [addMenuMode, setAddMenuMode] = React.useState<'link' | 'pdf' | 'text' | null>(null)
  const [newMenuInput, setNewMenuInput] = React.useState('')
  const [replaceStandardMenuId, setReplaceStandardMenuId] = React.useState<string | null>(null)

  const saveMenuSourceToDB = async (source: MenuUrlState) => {
    if (!businessId) return

    const { error } = await (supabase
      .from('menu_sources') as any)
      .upsert({
        business_id: businessId,
        source_url: source.url,
        source_type: source.fileName ? 'pdf' : 'url',
        file_name: source.fileName || null,
        menu_type: source.menuType,
        source_origin: source.source === 'ai' ? 'ai_detected' : 'manual_added',
        status: source.status,
        error_message: source.error || null,
        created_by: userId || null,
        updated_at: new Date().toISOString()
      } as any, {
        onConflict: 'business_id,source_url'
      })

    if (error) {
      console.error('Failed to save menu source:', error)
    }
  }

  const loadMenuSources = async () => {
    if (!businessId) return

    const { data, error } = await supabase
      .from('menu_sources')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to load menu sources:', error)
      return
    }

    if (data && data.length > 0) {
      const loadedUrls = data.map((row: any) => ({
        url: row.source_url,
        source: row.source_origin === 'ai_detected' ? 'ai' : 'manual',
        menuType: (row.menu_type as MenuType) || 'standard',
        status: row.status === 'error' ? 'pending' : (row.status as MenuUrlState['status']),
        error: row.error_message || undefined,
        fileName: row.file_name || undefined,
        isDeleting: false,
        deleteRestoring: false
      }))

      // Replace the entire array with loaded data to avoid duplicates
      setMenuUrls(loadedUrls as MenuUrlState[])
    } else {
      // If no data, clear the array
      setMenuUrls([])
    }
  }

  React.useEffect(() => {
    loadMenuSources()
  }, [businessId])

  const updateMenuUrl = (url: string, updates: Partial<MenuUrlState>) => {
    setMenuUrls(prev => prev.map(m => m.url === url ? { ...m, ...updates } : m))
  }

  const initiateDelete = async (url: string) => {
    // Delete from database immediately
    // First, delete related menu extractions (cascade)
    const { data: menuSource } = await supabase
      .from('menu_sources')
      .select('id')
      .eq('business_id', businessId)
      .eq('source_url', url)
      .maybeSingle()

    if (menuSource) {
      // Delete menu_extractions linked to this source
      const { error: extractionsError } = await supabase
        .from('menu_extractions')
        .delete()
        .eq('menu_source_id', menuSource.id)

      if (extractionsError) {
        console.error('Failed to delete menu extractions:', extractionsError)
      } else {
        console.log('✅ Deleted related menu extractions')
      }
    }

    // Delete the menu source
    const { error } = await supabase
      .from('menu_sources')
      .delete()
      .eq('business_id', businessId)
      .eq('source_url', url)
    
    if (error) {
      console.error('Failed to delete menu source:', error)
    } else {
      console.log('✅ Deleted menu source from database:', url)
      // Remove from local state immediately
      setMenuUrls(prev => prev.filter(m => m.url !== url))
    }
  }

  const undoDelete = (url: string) => {
    updateMenuUrl(url, { isDeleting: false, deleteRestoring: false })
  }

  const hasStandardMenu = () => {
    return menuUrls.some(m => m.menuType === 'standard' && m.status !== 'ignored')
  }

  const extractMenuNameFromSource = (source: MenuUrlState): string => {
    const fullPath = source.fileName || source.url
    const pathLower = fullPath.toLowerCase()
    
    // Extract the LAST path segment (most specific)
    const lastSegmentMatch = pathLower.match(/\/([^\/]+)\/?$/)
    const lastSegment = lastSegmentMatch?.[1] || ''
    
    // Ordered array - specific patterns BEFORE their base words
    const patterns: Array<[string, string]> = [
      // Compound/specific patterns FIRST
      ['julefrokost', 'Julefrokost'], ['aftensmad', 'Aftenmenu'], ['take-away', 'Takeaway'],
      ['a-la-carte', 'À la carte'], ['menukort', 'Menukort'], ['vinmenu', 'Vinkort'],
      // Time-based
      ['morgenmad', 'Morgenmad'], ['breakfast', 'Morgenmad'], ['brunch', 'Brunch'],
      ['frokost', 'Frokost'], ['lunch', 'Frokost'], ['middag', 'Middag'],
      ['dinner', 'Middag'], ['diner', 'Middag'], ['aften', 'Aftenmenu'], ['evening', 'Aftenmenu'],
      // Drink menus
      ['cocktails', 'Cocktails'], ['cocktail', 'Cocktails'], ['drikkevarer', 'Drikkevarer'],
      ['drinks', 'Drinks'], ['vine', 'Vinkort'], ['wine', 'Vinkort'], ['vin', 'Vinkort'],
      ['beer', 'Ølkort'], ['bar', 'Barmenu'], ['ol', 'Ølkort'],
      // Food types
      ['desserter', 'Desserter'], ['dessert', 'Desserter'], ['forretter', 'Forretter'],
      ['hovedretter', 'Hovedretter'], ['burgers', 'Burgere'], ['burger', 'Burgere'],
      ['sandwich', 'Sandwich'], ['pizza', 'Pizza'], ['sushi', 'Sushi'], ['tapas', 'Tapas'],
      // Special/seasonal
      ['takeaway', 'Takeaway'], ['catering', 'Catering'], ['selskab', 'Selskabsmenu'],
      ['christmas', 'Julemenu'], ['jul', 'Julemenu'], ['easter', 'Påskemenu'], ['påske', 'Påskemenu'],
      ['nytår', 'Nytårsmenu'], ['sommer', 'Sommermenu'], ['vinter', 'Vintermenu'],
      ['tasting', 'Smagsmenu'], ['grill', 'Grillmenu'],
      // Generic (last)
      ['menu', 'Menukort'], ['kort', 'Menukort']
    ]
    
    // First check last segment (most specific part of URL)
    for (const [pattern, name] of patterns) {
      if (lastSegment.includes(pattern)) {
        return name
      }
    }
    
    // Fallback: check full path
    for (const [pattern, name] of patterns) {
      if (pathLower.includes(`/${pattern}/`) || pathLower.includes(`/${pattern}.`)) {
        return name
      }
    }
    
    return source.menuType === 'special' ? 'Midlertidig menu' : 'Menukort'
  }

  const handleMenuTypeChange = (url: string, newType: MenuType) => {
    if (newType === 'standard' && hasStandardMenu()) {
      const existingStandard = menuUrls.find(m => m.menuType === 'standard' && m.status !== 'ignored')
      if (existingStandard && existingStandard.url !== url) {
        setReplaceStandardMenuId(url)
        return
      }
    }
    
    const updatedMenu = menuUrls.find(m => m.url === url)
    if (updatedMenu) {
      const updated = { ...updatedMenu, menuType: newType }
      updateMenuUrl(url, { menuType: newType })
      saveMenuSourceToDB(updated)
    }
  }

  const confirmReplaceStandardMenu = () => {
    if (!replaceStandardMenuId) return
    
    setMenuUrls(prev => prev.map(m => {
      if (m.menuType === 'standard' && m.url !== replaceStandardMenuId) {
        const updated = { ...m, status: 'ignored' as const }
        saveMenuSourceToDB(updated)
        return updated
      }
      return m
    }))
    
    const newStandardMenu = menuUrls.find(m => m.url === replaceStandardMenuId)
    if (newStandardMenu) {
      const updated = { ...newStandardMenu, menuType: 'standard' as const }
      updateMenuUrl(replaceStandardMenuId, { menuType: 'standard' })
      saveMenuSourceToDB(updated)
    }
    setReplaceStandardMenuId(null)
  }

  const addManualMenu = (input: string, file?: File) => {
    const trimmed = input.trim()
    if (!trimmed && !file) return
    
    let newSource: MenuUrlState
    
    if (file) {
      const url = `file://${file.name}`
      newSource = {
        url,
        source: 'manual',
        menuType: 'standard',
        status: 'pending',
        fileName: file.name
      }
    } else {
      try {
        new URL(trimmed)
        const existingUrls = menuUrls.map(m => m.url)
        if (existingUrls.includes(trimmed)) {
          throw new Error('URL already added')
        }
        newSource = {
          url: trimmed,
          source: 'manual',
          menuType: 'standard',
          status: 'pending'
        }
      } catch {
        throw new Error('Invalid URL')
      }
    }
    
    setMenuUrls(prev => [...prev, newSource])
    saveMenuSourceToDB(newSource)
    
    setNewMenuInput('')
    setShowAddMenu(false)
  }

  const getStatusLabel = (status: MenuUrlState['status']): string => {
    switch (status) {
      case 'pending':
      case 'extracting':
        return 'Afventer'
      case 'extracted':
        return 'Klar'
      case 'ignored':
        return 'Ignoreret'
      default:
        return status
    }
  }

  const getStatusColor = (status: MenuUrlState['status']): string => {
    switch (status) {
      case 'pending':
      case 'extracting':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'extracted':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'ignored':
        return 'bg-gray-50 text-gray-500 border-gray-200'
      default:
        return 'bg-gray-50 text-gray-500 border-gray-200'
    }
  }

  return {
    menuUrls,
    showAddMenu,
    addMenuMode,
    newMenuInput,
    replaceStandardMenuId,
    setShowAddMenu,
    setAddMenuMode,
    setNewMenuInput,
    setReplaceStandardMenuId,
    updateMenuUrl,
    initiateDelete,
    undoDelete,
    hasStandardMenu,
    handleMenuTypeChange,
    confirmReplaceStandardMenu,
    addManualMenu,
    loadMenuSources,
    saveMenuSourceToDB,
    extractMenuNameFromSource,
    getStatusLabel,
    getStatusColor
  }
}
