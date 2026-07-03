import type { MenuExtraction } from './MenuOfferingsPanel'
import { MenuItemRow } from './MenuItemRow'

interface MenuExtractionCardProps {
  extraction: MenuExtraction
  isExpanded: boolean
  isEditingName: boolean
  editingNameValue: string
  editingMenuItemsMode: string | null
  editingItemId: string | null
  editingItemName: string
  editingItemDesc: string
  onToggleExpand: () => void
  onStartEditName: (name: string) => void
  onUpdateName: (name: string) => void
  onEndEditName: () => void
  onToggleItemsEditMode: () => void
  onSaveItems: () => void
  onCancelItemsEdit: () => void
  onStartEditItem: (itemKey: string, name: string, desc: string) => void
  onUpdateItemName: (value: string) => void
  onUpdateItemDesc: (value: string) => void
  onSaveItem: (categoryIdx: number, itemIdx: number, name: string, desc: string) => void
  onCancelItemEdit: () => void
  onDeleteItem: (categoryIdx: number, itemIdx: number) => void
  onDeleteExtraction: (extractionId: string) => void
  onUpdateExtractionName: (extractionId: string, newName: string) => void
}

export function MenuExtractionCard({
  extraction,
  isExpanded,
  isEditingName,
  editingNameValue,
  editingMenuItemsMode,
  editingItemId,
  editingItemName,
  editingItemDesc,
  onToggleExpand,
  onStartEditName,
  onUpdateName,
  onEndEditName,
  onToggleItemsEditMode,
  onSaveItems,
  onCancelItemsEdit,
  onStartEditItem,
  onUpdateItemName,
  onUpdateItemDesc,
  onSaveItem,
  onCancelItemEdit,
  onDeleteItem,
  onDeleteExtraction,
  onUpdateExtractionName,
}: MenuExtractionCardProps) {
  const handleNameBlur = () => {
    if (editingNameValue.trim()) {
      onUpdateExtractionName(extraction.id, editingNameValue)
    }
    onEndEditName()
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header - Collapsible */}
      <div
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between gap-3 p-3 bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <span className="text-lg">{isExpanded ? '▼' : '▶'}</span>
          {isEditingName ? (
            <input
              autoFocus
              type="text"
              value={editingNameValue}
              onChange={(e) => onUpdateName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (editingNameValue.trim()) {
                    onUpdateExtractionName(extraction.id, editingNameValue)
                  }
                  onEndEditName()
                }
                if (e.key === 'Escape') onEndEditName()
              }}
              className="px-2 py-1 border border-blue-400 rounded text-sm focus:ring-2 focus:ring-blue-500 flex-1"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="font-medium text-gray-900 flex-1"
              onDoubleClick={() => {
                onStartEditName(extraction.menu_name)
              }}
            >
              {extraction.menu_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {!isEditingName && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onStartEditName(extraction.menu_name)
                }}
                className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition"
              >
                ✎ Rediger navn
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('Slet denne menu?')) {
                    onDeleteExtraction(extraction.id)
                  }
                }}
                className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded transition"
              >
                🗑 Slet
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded content - Categories and items */}
      {isExpanded && (
        <div className="p-4 bg-white border-t border-gray-200 space-y-3">
          {/* Edit Mode Toggle */}
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
            <span className="text-xs text-gray-600 font-medium">Ret stavefejl og OCR-fejl:</span>
            {editingMenuItemsMode === extraction.id ? (
              <div className="flex gap-2">
                <button
                  onClick={onSaveItems}
                  className="text-xs px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition"
                >
                  ✓ Gem ændringer
                </button>
                <button
                  onClick={onCancelItemsEdit}
                  className="text-xs px-2.5 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
                >
                  ✕ Annuller
                </button>
              </div>
            ) : (
              <button
                onClick={onToggleItemsEditMode}
                className="text-xs px-2.5 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
              >
                ✎ Rediger items
              </button>
            )}
          </div>

          {extraction.extracted_data.categories.length === 0 ? (
            <p className="text-sm text-gray-600 italic">Ingen kategorier hentet endnu</p>
          ) : (
            extraction.extracted_data.categories.map((category: { id: string; name: string; items: Array<{ id: string; name: string; short_desc?: string }> }, catIdx: number) => (
              <div key={category.id} className="space-y-2">
                <h4 className="font-medium text-gray-900 text-sm">{category.name}</h4>
                <div className="space-y-2 ml-3">
                  {category.items.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">Ingen items i denne kategori</p>
                  ) : (
                    category.items.map((item: { id: string; name: string; short_desc?: string }, itemIdx: number) => (
                      <MenuItemRow
                        key={`${catIdx}-${itemIdx}-${item.id}`}
                        item={item}
                        itemIdx={itemIdx}
                        categoryIdx={catIdx}
                        extraction={extraction}
                        editingMenuItemsMode={editingMenuItemsMode}
                        editingItemId={editingItemId}
                        editingItemName={editingItemName}
                        editingItemDesc={editingItemDesc}
                        onStartEdit={onStartEditItem}
                        onUpdateName={onUpdateItemName}
                        onUpdateDesc={onUpdateItemDesc}
                        onSave={onSaveItem}
                        onCancel={onCancelItemEdit}
                        onDelete={onDeleteItem}
                      />
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
