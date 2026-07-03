import type { MenuExtraction } from './MenuOfferingsPanel'

interface MenuItem {
  id: string
  name: string
  short_desc?: string
}

interface MenuItemRowProps {
  item: MenuItem
  itemIdx: number
  categoryIdx: number
  extraction: MenuExtraction
  editingMenuItemsMode: string | null
  editingItemId: string | null
  editingItemName: string
  editingItemDesc: string
  onStartEdit: (itemKey: string, name: string, desc: string) => void
  onUpdateName: (value: string) => void
  onUpdateDesc: (value: string) => void
  onSave: (categoryIdx: number, itemIdx: number, name: string, desc: string) => void
  onCancel: () => void
  onDelete: (categoryIdx: number, itemIdx: number) => void
}

export function MenuItemRow({
  item,
  itemIdx,
  categoryIdx,
  extraction,
  editingMenuItemsMode,
  editingItemId,
  editingItemName,
  editingItemDesc,
  onStartEdit,
  onUpdateName,
  onUpdateDesc,
  onSave,
  onCancel,
  onDelete,
}: MenuItemRowProps) {
  const itemKey = `${extraction.id}-${categoryIdx}-${itemIdx}`
  const isEditingItem = editingMenuItemsMode === extraction.id && editingItemId === itemKey

  return (
    <div 
      className={`text-sm transition-colors p-2 rounded flex items-start justify-between gap-2 group ${editingMenuItemsMode === extraction.id ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
    >
      <div className="flex-1 min-w-0">
        {isEditingItem ? (
          // Inline edit mode - directly editable
          <div className="space-y-1">
            <input
              autoFocus
              type="text"
              value={editingItemName}
              onChange={(e) => onUpdateName(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSave(categoryIdx, itemIdx, editingItemName, editingItemDesc)
                } else if (e.key === 'Escape') {
                  onCancel()
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {editingItemDesc && (
              <textarea
                value={editingItemDesc}
                onChange={(e) => onUpdateDesc(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-blue-500 rounded bg-white focus:ring-2 focus:ring-blue-500"
                placeholder="Beskrivelse..."
                rows={2}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSave(categoryIdx, itemIdx, editingItemName, editingItemDesc)
                }}
                className="text-xs px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 transition"
              >
                Gem
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCancel()
                }}
                className="text-xs px-2 py-0.5 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
              >
                Annuller
              </button>
            </div>
          </div>
        ) : (
          // View mode - click to edit
          <div
            onClick={() => {
              if (editingMenuItemsMode === extraction.id) {
                onStartEdit(itemKey, item.name, item.short_desc || '')
              }
            }}
            className={`cursor-pointer ${editingMenuItemsMode === extraction.id ? 'cursor-text' : ''}`}
          >
            <span className="font-medium">- {item.name}</span>
            {item.short_desc && (
              <p className="text-xs text-gray-600 ml-4">{item.short_desc}</p>
            )}
          </div>
        )}
      </div>
      
      {/* Delete button - only show in edit mode */}
      {editingMenuItemsMode === extraction.id && !isEditingItem && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (confirm('Slet denne menuret?')) {
              onDelete(categoryIdx, itemIdx)
            }
          }}
          className="text-xs px-1.5 py-0.5 text-red-600 hover:bg-red-50 rounded transition opacity-0 group-hover:opacity-100"
          title="Slet menuret"
        >
          🗑
        </button>
      )}
    </div>
  )
}
