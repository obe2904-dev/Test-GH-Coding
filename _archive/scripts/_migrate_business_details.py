import re, sys

path = "/Users/olebaek/Test P2G 1/src/pages/dashboard/businessProfile/components/BusinessDetailsPanel.tsx"

with open(path, "r", encoding="utf-8") as f:
    src = f.read()

original = src

# 1. Focus rings
src = src.replace("focus:ring-mint", "focus:ring-cta")
src = src.replace("focus:border-mint", "focus:border-cta")

# 2. Gray text
src = src.replace("text-gray-900", "text-text")
src = src.replace("text-gray-700", "text-text-secondary")
src = src.replace("text-gray-600", "text-text-secondary")
src = src.replace("text-gray-500", "text-text-muted")
src = src.replace("text-gray-400", "text-text-muted")

# 3. Gray border + bg
src = src.replace("border-gray-300", "border-border")
src = src.replace("border-gray-200", "border-border")
src = src.replace("bg-gray-50", "bg-surface-alt")
src = src.replace("bg-gray-100", "bg-surface-alt")

# 4a. Slet Alt button
src = src.replace(
    'className="px-6 py-2 bg-[#FEF2F2] border border-[#FCA5A5] text-[#B91C1C] rounded-lg text-sm font-semibold hover:bg-[#FEE2E2] transition-colors"',
    'className="px-6 py-2 bg-error-surface border border-error text-error-text rounded-lg text-sm font-semibold hover:bg-error-surface transition-colors"'
)

# 4b. Keyword chips
src = src.replace(
    'className="inline-flex items-center gap-1 px-3 py-1 bg-[#F4F1FE] border border-accent text-brand rounded-full text-xs hover:bg-[#EDE8FF] hover:border-[#BFA9F4] transition-colors"',
    'className="inline-flex items-center gap-1 px-3 py-1 bg-accent-surface border border-accent text-brand rounded-full text-xs hover:bg-accent-surface transition-colors"'
)

# 4c. Booking detected box
src = src.replace(
    'className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg"',
    'className="flex items-center gap-2 p-3 bg-info-surface border border-info rounded-lg"'
)
src = src.replace(
    'className="w-5 h-5 text-blue-600"',
    'className="w-5 h-5 text-info"'
)
src = src.replace(
    'className="text-sm text-blue-900"',
    'className="text-sm text-info-text"'
)

with open(path, "w", encoding="utf-8") as f:
    f.write(src)

changes = sum(1 for a, b in zip(original.splitlines(), src.splitlines()) if a != b)
print(f"Done — {changes} lines changed")
