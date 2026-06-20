// DISABLED: menu_extractions table does not exist in database
// Feature not implemented

export interface MenuExtraction {
  id: string
  business_id: string
  menu_source_id: string | null
  menu_name: string
  menu_type: 'food' | 'drinks' | 'special'
  extracted_data: any
  created_at: string
  updated_at: string
}

export type UseMenuExtractionsReturn = ReturnType<typeof useMenuExtractions>

export const useMenuExtractions = (_businessId: string | null, _menuSourceId: string | null) => {
  return {
    extractions: [] as MenuExtraction[],
    loading: false,
    error: null,
    refetchExtractions: () => Promise.resolve(),
    loadMenuExtractions: () => Promise.resolve(),
    menuExtractions: [] as MenuExtraction[],
    setMenuExtractions: (_val: any) => {},
    editingItemId: null,
    setEditingItemId: (_val: any) => {},
    editingItemName: '' as string,
    setEditingItemName: (_val: any) => {},
    editingItemDesc: '' as string,
    setEditingItemDesc: (_val: any) => {},
    editingMenuId: null as string | null,
    setEditingMenuId: (_val: any) => {},
    editingMenuName: '' as string,
    setEditingMenuName: (_val: any) => {},
    editingMenuItemsMode: '' as string,
    setEditingMenuItemsMode: (_val: any) => {},
    expandedMenus: new Set<string>(),
    setExpandedMenus: (_val: any) => {},
    updateMenuItem: (_id: any, _field: any, _value: any, _extractionId: any) => {},
    saveMenuItems: (_val: any, _val2: any) => Promise.resolve(),
    saveMenuItemsToDatabase: (_val: any) => Promise.resolve(),
    deleteMenuExtraction: (_id: string) => Promise.resolve(),
    updateMenuExtractionName: (_val: any) => Promise.resolve(),
  };
};

/* ORIGINAL CODE - DISABLED
import React from 'react'
import { supabase } from '../../../../../lib/supabase'
import type { MenuType } from './useMenuSources'

export interface MenuExtraction {
  id: string
  business_id: string
  menu_source_id: string | null
  menu_name: string
  menu_type: MenuType
  extracted_data: {
    categories: Array<{
      id: string
      name: string
      items: Array<{
        id: string
        name: string
        short_desc?: string
      }>
    }>
  }
  extracted_at: string
  created_at: string
  updated_at: string
}

export interface UseMenuExtractionsReturn {
  menuExtractions: MenuExtraction[]
  expandedMenus: Set<string>
  editingMenuId: string | null
  editingMenuName: string
  editingItemId: string | null
  editingItemName: string
  editingItemDesc: string
  editingMenuItemsMode: string | null
  setMenuExtractions: (extractions: MenuExtraction[]) => void
  setExpandedMenus: (menus: Set<string>) => void
  setEditingMenuId: (id: string | null) => void
  setEditingMenuName: (name: string) => void
  setEditingItemId: (id: string | null) => void
  setEditingItemName: (name: string) => void
  setEditingItemDesc: (desc: string) => void
  setEditingMenuItemsMode: (mode: string | null) => void
  loadMenuExtractions: () => Promise<void>
  saveMenuExtractionToDB: (extraction: MenuExtraction) => Promise<void>
  updateMenuExtractionName: (extractionId: string, newName: string) => void
  deleteMenuExtraction: (extractionId: string) => Promise<void>
  saveMenuItems: (extractionId: string, updatedExtraction: MenuExtraction) => Promise<void>
  saveMenuItemsToDatabase: (updatedExtraction: MenuExtraction) => Promise<void>
  updateMenuItem: (extractionId: string, categoryIndex: number, itemIndex: number, updates: Partial<{ name: string; short_desc: string }>) => void
}

export function useMenuExtractions(businessId: string, userId?: string): UseMenuExtractionsReturn {
  const [menuExtractions, setMenuExtractions] = React.useState<MenuExtraction[]>([])
  const [expandedMenus, setExpandedMenus] = React.useState<Set<string>>(new Set())
  const [editingMenuId, setEditingMenuId] = React.useState<string | null>(null)
  const [editingMenuName, setEditingMenuName] = React.useState('')
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null)
  const [editingItemName, setEditingItemName] = React.useState('')
  const [editingItemDesc, setEditingItemDesc] = React.useState('')
  const [editingMenuItemsMode, setEditingMenuItemsMode] = React.useState<string | null>(null)

  const loadMenuExtractions = async () => {
    if (!businessId) return

    console.log('🔍 loadMenuExtractions called for businessId:', businessId)
    
    const { data, error } = await supabase
      .from('menu_extractions')
      .select('*')
      .eq('business_id', businessId)
      .order('menu_type', { ascending: true })
      .order('menu_name', { ascending: true })

    if (error) {
      console.error('❌ Failed to load menu extractions:', error)
      return
    }

    if (data) {
      console.log('✅ Loaded menu extractions:', data.length, 'items')
      if (data.length > 0) {
        console.log('First extraction:', data[0])
      }
      setMenuExtractions(data as unknown as MenuExtraction[])
      
      // Keep menus collapsed by default
      setExpandedMenus(new Set())
    } else {
      console.log('⚠️ No menu extractions found')
    }
  }

  React.useEffect(() => {
    loadMenuExtractions()
  }, [businessId])

  const saveMenuExtractionToDB = async (extraction: MenuExtraction) => {
    if (!businessId) return

    const { error } = await (supabase as any)
      .from('menu_extractions')
      .upsert({
        id: extraction.id,
        business_id: businessId,
        menu_source_id: extraction.menu_source_id,
        menu_name: extraction.menu_name,
        menu_type: extraction.menu_type,
        extracted_data: extraction.extracted_data,
        created_by: userId || null,
        updated_at: new Date().toISOString()
      } as any, {
        onConflict: 'id'
      })

    if (error) {
      console.error('Failed to save menu extraction:', error)
    }
  }

  const updateMenuExtractionName = (extractionId: string, newName: string) => {
    setMenuExtractions(prev => prev.map(m => 
      m.id === extractionId ? { ...m, menu_name: newName } : m
    ))
    
    const extraction = menuExtractions.find(m => m.id === extractionId)
    if (extraction) {
      saveMenuExtractionToDB({ ...extraction, menu_name: newName })
    }
    setEditingMenuId(null)
  }

  const deleteMenuExtraction = async (extractionId: string) => {
    if (!businessId) return

    const { error } = await supabase
      .from('menu_extractions')
      .delete()
      .eq('id', extractionId)
      .eq('business_id', businessId)

    if (error) {
      console.error('Failed to delete menu extraction:', error)
      return
    }

    setMenuExtractions(prev => prev.filter(m => m.id !== extractionId))
  }

  const saveMenuItems = async (extractionId: string, updatedExtraction: MenuExtraction) => {
    if (!businessId) return

    const { error } = await (supabase
      .from('menu_extractions') as any)
      .update({ extracted_data: updatedExtraction.extracted_data } as any)
      .eq('id', extractionId)
      .eq('business_id', businessId)

    if (error) {
      console.error('Failed to save menu items:', error)
      return
    }

    setMenuExtractions(prev => prev.map(m => 
      m.id === extractionId ? updatedExtraction : m
    ))
    setEditingMenuItemsMode(null)
  }

  const saveMenuItemsToDatabase = async (updatedExtraction: MenuExtraction) => {
    if (!businessId) return

    const { error } = await (supabase
      .from('menu_extractions') as any)
      .update({ extracted_data: updatedExtraction.extracted_data } as any)
      .eq('id', updatedExtraction.id)
      .eq('business_id', businessId)

    if (error) {
      console.error('Failed to save menu items:', error)
      return
    }
  }

  const updateMenuItem = (extractionId: string, categoryIndex: number, itemIndex: number, updates: Partial<{ name: string; short_desc: string }>) => {
    const extraction = menuExtractions.find(m => m.id === extractionId)
    if (!extraction) return

    const updated = JSON.parse(JSON.stringify(extraction)) as MenuExtraction
    if (updated.extracted_data.categories[categoryIndex]?.items[itemIndex]) {
      const item = updated.extracted_data.categories[categoryIndex].items[itemIndex]
      if (updates.name !== undefined) item.name = updates.name
      if (updates.short_desc !== undefined) item.short_desc = updates.short_desc
    }

    setMenuExtractions(prev => prev.map(m => m.id === extractionId ? updated : m))
  }

  return {
    menuExtractions,
    expandedMenus,
    editingMenuId,
    editingMenuName,
    editingItemId,
    editingItemName,
    editingItemDesc,
    editingMenuItemsMode,
    setMenuExtractions,
    setExpandedMenus,
    setEditingMenuId,
    setEditingMenuName,
    setEditingItemId,
    setEditingItemName,
    setEditingItemDesc,
    setEditingMenuItemsMode,
    loadMenuExtractions,
    saveMenuExtractionToDB,
    updateMenuExtractionName,
    deleteMenuExtraction,
    saveMenuItems,
    saveMenuItemsToDatabase,
    updateMenuItem
  }
}
*/
