import re

files = [
    "/Users/olebaek/Test P2G 1/src/pages/dashboard/BrandProfilePageV5.tsx",
    "/Users/olebaek/Test P2G 1/src/components/brandProfile/BrandProfileGenerator.tsx",
    "/Users/olebaek/Test P2G 1/src/components/brandProfile/GenerationProgress.tsx",
    "/Users/olebaek/Test P2G 1/src/components/brandProfile/BrandProfileDisplay.tsx",
]

replacements = [
    # Page bg
    ("bg-gradient-to-br from-slate-50 to-slate-100", "bg-surface-page"),
    ("bg-gradient-to-r from-blue-50 to-cta-surface", "bg-accent-surface"),

    # Compound blue hero banner
    ("bg-accent-surface border border-blue-100", "bg-accent-surface border border-accent"),

    # Surface & borders (multi-token first to avoid partial overlaps)
    ("bg-white", "bg-surface"),
    ("bg-gray-50 rounded-lg border border-gray-200", "bg-surface-alt rounded-lg border border-border"),
    ("bg-gray-50 rounded-lg border border-gray-100", "bg-surface-alt rounded-lg border border-border"),
    ("bg-gray-50 rounded-lg", "bg-surface-alt rounded-lg"),
    ("bg-gray-50 border border-gray-200", "bg-surface-alt border border-border"),
    ("bg-gray-50 border border-gray-100", "bg-surface-alt border border-border"),
    ("bg-gray-50", "bg-surface-alt"),
    ("bg-gray-100", "bg-surface-alt"),
    ("border-gray-200", "border-border"),
    ("border-gray-100", "border-border"),
    ("border-gray-300", "border-border"),

    # Error (red) — most specific first
    ("bg-red-50 border border-red-200", "bg-error-surface border border-error"),
    ("bg-red-50", "bg-error-surface"),
    ("border-red-200", "border-error"),
    ("text-red-900", "text-error-text"),
    ("text-red-800", "text-error-text"),
    ("text-red-700", "text-error"),
    ("text-red-600", "text-error"),

    # Success (green) — skip text-green-500 (symbol decorator, defer)
    ("bg-green-50 rounded-lg border border-green-100", "bg-success-surface rounded-lg border border-success"),
    ("bg-green-50 border border-green-200", "bg-success-surface border border-success"),
    ("bg-green-50 border border-green-100", "bg-success-surface border border-success"),
    ("bg-green-50", "bg-success-surface"),
    ("border-green-100", "border-success"),
    ("border-green-200", "border-success"),
    ("border-green-300", "border-success"),
    ("text-green-700", "text-success"),
    ("text-green-800", "text-success-text"),
    ("bg-green-400", "bg-success"),
    ("bg-green-600", "bg-cta"),

    # Warning (amber/yellow)
    ("bg-amber-50 border border-amber-200", "bg-warning-surface border border-warning"),
    ("bg-amber-50", "bg-warning-surface"),
    ("border-amber-200", "border-warning"),
    ("text-amber-600", "text-warning"),
    ("text-amber-700", "text-warning-text"),
    ("bg-yellow-50 rounded-lg border border-yellow-100", "bg-warning-surface rounded-lg border border-warning"),
    ("bg-yellow-50 border border-yellow-100", "bg-warning-surface border border-warning"),
    ("bg-yellow-50", "bg-warning-surface"),
    ("border-yellow-100", "border-warning"),
    ("text-yellow-700", "text-warning-text"),

    # Accent (purple)
    ("bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100", "bg-accent-surface text-accent-text border border-accent hover:bg-accent-surface"),
    ("bg-purple-50", "bg-accent-surface"),
    ("border-purple-200", "border-accent"),
    ("text-purple-700", "text-accent-text"),
    ("hover:bg-purple-100", "hover:bg-accent-surface"),
    ("bg-purple-400", "bg-accent"),

    # Info (blue) — link/interactive first
    ("text-blue-600 hover:text-blue-700 hover:bg-blue-50", "text-cta hover:text-cta-text hover:bg-cta-surface"),
    ("text-blue-500 hover:text-blue-700", "text-cta hover:text-cta-text"),

    # Info (blue) — spinner borders
    ("border-blue-100", "border-info"),
    ("border-blue-600", "border-cta"),
    ("border-blue-200", "border-info"),
    ("border-blue-400", "border-accent"),
    ("border-l-4 border-accent", "border-l-4 border-accent"),  # no-op to preserve pillar accent

    # Info (blue) — surfaces
    ("bg-blue-100 rounded-full", "bg-info-surface rounded-full"),
    ("bg-blue-50 rounded-lg border border-blue-100", "bg-info-surface rounded-lg border border-info"),
    ("bg-blue-50 border border-blue-100", "bg-info-surface border border-info"),
    ("bg-blue-50 border border-blue-200", "bg-info-surface border border-info"),
    ("bg-blue-50", "bg-info-surface"),

    # Info (blue) — text
    ("text-blue-900", "text-info-text"),
    ("text-blue-800", "text-info-text"),
    ("text-blue-700", "text-info"),
    ("text-blue-600", "text-cta"),
    ("text-blue-500", "text-info"),
    ("text-blue-400", "text-info"),

    # Info (blue) — background fills
    ("bg-blue-600", "bg-cta"),
    ("bg-blue-400", "bg-info"),
    ("hover:bg-blue-700", "hover:bg-cta-hover"),
    ("hover:bg-blue-100", "hover:bg-info-surface"),

    # Primary button
    ("text-white", "text-text-inverse"),
    ("disabled:bg-gray-400", "disabled:bg-surface-alt"),
    ("bg-gray-300", "bg-border"),

    # Text colors
    ("text-gray-900", "text-text"),
    ("text-gray-800", "text-text"),
    ("text-gray-700", "text-text-secondary"),
    ("text-gray-600", "text-text-secondary"),
    ("text-gray-500", "text-text-muted"),
    ("text-gray-400", "text-text-muted"),
    ("hover:text-gray-600", "hover:text-text-secondary"),
    ("hover:text-gray-700", "hover:text-text-secondary"),
    ("hover:bg-gray-50", "hover:bg-surface-alt"),
    ("hover:bg-gray-100", "hover:bg-surface-alt"),
]

for path in files:
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    changed_lines = 0
    new_lines = []
    for line in lines:
        original_line = line
        # Skip lines containing symbol characters (emoji, special chars)
        has_symbol = any(ord(c) > 127 for c in line)
        if has_symbol:
            new_lines.append(line)
            continue
        for old, new in replacements:
            line = line.replace(old, new)
        if line != original_line:
            changed_lines += 1
        new_lines.append(line)
    
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print(f"{path.split('/')[-1]}: {changed_lines} lines changed")
