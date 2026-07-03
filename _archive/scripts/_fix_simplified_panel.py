path = "/Users/olebaek/Test P2G 1/src/pages/dashboard/businessProfile/components/BusinessDetailsPanelSimplified.tsx"

with open(path, "r", encoding="utf-8") as f:
    src = f.read()

replacements = [
    # Spinners — bg circle
    ("bg-blue-100 rounded-full", "bg-info-surface rounded-full"),
    # Spinner icon color (section spinner on light bg)
    ("text-blue-600 animate-spin", "text-cta animate-spin"),
    # Spinner border (overlay spinner on light bg)
    ("border-blue-600 border-t-transparent", "border-cta border-t-transparent"),
    # Text
    ("text-gray-900", "text-text"),
    ("text-gray-700", "text-text-secondary"),
    ("text-gray-600", "text-text-secondary"),
    ("text-gray-500", "text-text-muted"),
    ("text-gray-400", "text-text-muted"),
    # Borders / backgrounds
    ("border-gray-300", "border-border"),
    ("border-gray-200", "border-border"),
    ("bg-gray-50", "bg-surface-alt"),
    # Focus rings
    ("focus:ring-mint", "focus:ring-cta"),
]

original = src
for old, new in replacements:
    src = src.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(src)

changes = sum(1 for a, b in zip(original.splitlines(), src.splitlines()) if a != b)
print(f"Done — {changes} lines changed")
