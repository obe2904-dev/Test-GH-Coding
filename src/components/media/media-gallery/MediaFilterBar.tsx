/**
 * MediaFilterBar Component
 * 
 * Filter and search controls for media gallery with:
 * - Media type filter (images/videos)
 * - Post type filter
 * - Tag filter
 * - Search input
 * - Sort controls
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MediaType, PostType } from '../../../api/mediaLibrary'

interface MediaFilterBarProps {
  onFilterChange?: (filters: MediaFilterState) => void
  showAdvanced?: boolean
}

export interface MediaFilterState {
  mediaType?: MediaType
  postType?: PostType
  tags?: string[]
  searchQuery?: string
  sortBy?: 'upload_date' | 'usage_count' | 'file_size'
  sortOrder?: 'asc' | 'desc'
}

function useMediaCategories() {
  const { t } = useTranslation()
  
  return [
    { value: 'food' as PostType, label: t('media.categories.food', 'Food') },
    { value: 'drinks' as PostType, label: t('media.categories.drinks', 'Drinks') },
    { value: 'atmosphere' as PostType, label: t('media.categories.atmosphere', 'Atmosphere') },
    { value: 'other' as PostType, label: t('media.categories.other', 'Other') },
  ]
}

export function MediaFilterBar({ onFilterChange, showAdvanced = false }: MediaFilterBarProps) {
  const { t } = useTranslation()
  const categories = useMediaCategories()
  const [filters, setFilters] = useState<MediaFilterState>({
    sortBy: 'upload_date',
    sortOrder: 'desc',
  })

  const updateFilter = (key: keyof MediaFilterState, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilterChange?.(newFilters)
  }

  const clearFilters = () => {
    const clearedFilters: MediaFilterState = {
      sortBy: 'upload_date',
      sortOrder: 'desc',
    }
    setFilters(clearedFilters)
    onFilterChange?.(clearedFilters)
  }

  const hasActiveFilters = Boolean(
    filters.mediaType || filters.postType || filters.searchQuery || filters.tags?.length
  )

  return (
    <div className="bg-white border-b border-gray-200 p-4 space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by dish name, description..."
          value={filters.searchQuery || ''}
          onChange={(e) => updateFilter('searchQuery', e.target.value || undefined)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg
          className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Media Type Filter */}
        <select
          value={filters.mediaType || ''}
          onChange={(e) => updateFilter('mediaType', (e.target.value as MediaType) || undefined)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Media</option>
          <option value="image">Images Only</option>
          <option value="video">Videos Only</option>
        </select>

        {/* Category Filter */}
        {showAdvanced && (
          <select
            value={filters.postType || ''}
            onChange={(e) => updateFilter('postType', (e.target.value as PostType) || undefined)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{t('media.allCategories', 'All Categories')}</option>
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        )}

        {/* Sort Controls */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-600">Sort by:</span>
          <select
            value={filters.sortBy}
            onChange={(e) => updateFilter('sortBy', e.target.value as any)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="upload_date">Upload Date</option>
            <option value="usage_count">Most Used</option>
            <option value="file_size">File Size</option>
          </select>

          <button
            onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title={filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            {filters.sortOrder === 'asc' ? (
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
