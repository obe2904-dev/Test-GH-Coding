import { create } from 'zustand'

interface DashboardNavigationState {
  hoveredSidebarItem: string | null
  setHoveredSidebarItem: (itemId: string | null) => void
  clearHoveredSidebarItem: () => void
}

export const useDashboardNavigationStore = create<DashboardNavigationState>((set) => ({
  hoveredSidebarItem: null,
  setHoveredSidebarItem: (itemId) => set({ hoveredSidebarItem: itemId }),
  clearHoveredSidebarItem: () => set({ hoveredSidebarItem: null }),
}))