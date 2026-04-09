# Typography Audit — Post2Grow

Generated: 26 November 2025

This audit summarizes places in the codebase that deviate from the project's Font Size Design Guide (minimum readable font-size 12px / `text-xs`). It contains per-file findings, suggested replacements (conservative), and optional codemod commands you can run to apply fixes automatically.

---

## Summary

Priority issues found:
- Instances of `text-[9px]`, `text-[10px]`, and `text-[11px]` across multiple components. These are below the 12px minimum and should be bumped to `text-xs` (12px) or `text-sm` (14px) depending on context.
- Very small icon/dot sizes (`w-2`, `w-2.5`, `w-1.5`) in a few places — confirm these are decorative only and not clickable targets.

Suggested conservative mapping (safe default):
- `text-[9px]`  -> `text-xs`
- `text-[10px]` -> `text-xs`
- `text-[11px]` -> `text-sm` (prefer `text-sm` for small labels; or `text-xs` if you want strictly 12px everywhere)

This mapping preserves readability and minimizes layout shifts. After applying changes, we recommend running the app and visually checking forms and compact UI areas — adjust paddings if labels wrap or spacing shifts.

---

## Per-file findings & suggestions

Note: below I show the original class snippet followed by a recommended replacement. Use these as patch suggestions.

### 1) `src/components/post-creation/GenerateStep.tsx`

Found examples:

- Before:
```tsx
className={`pointer-events-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${...}`}
```
- Suggestion (conservative):
```tsx
className={`pointer-events-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${...}`}
```

- Before:
```tsx
className="text-[11px] text-slate-500 hover:text-slate-700 underline transition-colors"
```
- Suggestion:
```tsx
className="text-sm text-slate-500 hover:text-slate-700 underline transition-colors"
```

- Several label spans like `text-[11px] font-medium text-slate-700` for labels such as `Hashtags`, `Emoji`, `Skrivestil`, etc.
- Suggestion: replace `text-[11px]` → `text-sm` (or `text-xs` if you prefer 12px).

Rationale: These are UI labels and toggles — `text-sm` (14px) improves legibility without greatly affecting layout.

---

### 2) `src/components/tier/PlanSwitcher.tsx`

- Before:
```tsx
<span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
```
- Suggestion:
```tsx
<span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
```

Rationale: badge text should be at least 12px.

---

### 3) `src/components/post-creation/PublishStep.tsx`

Multiple occurrences of very small text:

- Status icons: `className="text-[10px]"` (✓ / ⚠)
  - Suggestion: `text-xs`
- Calendar controls and form labels use `text-[10px]` and `text-[9px]` in a few places.
  - Example before: `className="text-[9px] text-red-700 font-semibold"` (error message)
  - Suggestion: `className="text-xs text-red-700 font-semibold"` or `text-sm` for important errors.
- Input fields with explicit `text-[10px]` set on the input element:
  - Before: `className="... text-[10px] bg-white"`
  - Suggestion: `className="... text-xs bg-white"`

Rationale: form labels, inputs and errors must be legible; bumping to `text-xs` reduces accessibility risk.

---

### 4) `src/components/post-creation/design/PlatformPreview.tsx`

- Decorative dot: `className={`w-1.5 h-1.5 rounded-full ${...}`}`
  - If purely decorative and non-interactive: keeping `w-1.5` is acceptable.
  - If visible indicator for status, consider `w-2.5 h-2.5` for better visibility.

---

### 5) `src/components/layout/TopBar.tsx`

- Notification dot: `w-2.5 h-2.5` — acceptable (10px). Keep or increase to `w-3.5` for clarity on dense screens.

---

### 6) `src/components/post-creation/design/PhotoUploadManager.tsx`

- Close icon size: `X className="w-2.5 h-2.5"` — usable for small overlay icons; ensure touch-targets remain large enough if clickable (use invisible larger button area).

---

## Suggested code-style codemod (safe, conservative)

If you want to apply quick conservative fixes across the repo, here is a safe set of `git` + `perl`/`sed` one-liners you can run locally. Make a commit first to allow easy rollback.

1) Create a branch and commit current state:

```bash
git checkout -b fix/typography-small-text
git add -A
git commit -m "chore: snapshot before typography codemod"
```

2) Conservative replacements (map 9/10 → `text-xs`, 11 → `text-sm`)

```bash
# 9px and 10px -> text-xs
grep -R "text-\[\(9\|10\)px\]" -l | xargs -I{} perl -pi -e "s/text-\[(?:9|10)px\]/text-xs/g" {}

# 11px -> text-sm
grep -R "text-\[11px\]" -l | xargs -I{} perl -pi -e "s/text-\[11px\]/text-sm/g" {}
```

3) Stage and review changes before committing:

```bash
git add -A
git diff --staged --name-only | sed -n '1,200p'
# Open files and visually confirm changes
git commit -m "chore(typography): bump tiny font sizes to meet accessibility"
```

Note: the `perl` command above does in-place replacements. If your shell doesn’t support `xargs` that way, run the `perl` directly with `find`.

---

## Recommendations after applying fixes

- Run the dev server and visually test the areas changed (GenerateStep, PublishStep, PlanSwitcher). Pay attention to buttons/inputs where label size increases may cause wrapping.
- Adjust paddings if labels wrap or inputs become tight. Example: increase `py` slightly on inputs: `px-2 py-1` → `px-2 py-1.5` or equivalent.
- For small icons used as action buttons, ensure the clickable area still meets minimum tappable sizes (recommended target: 40x40px on touch devices). Use padding on the button while keeping the icon visually small if needed.

---

## Next steps (pick one)
- I can run the conservative codemod across the repo now and open a branch/commit for you to review.
- I can instead prepare a set of per-file patches (not committed) for you to inspect and apply selectively.
- Or I can produce a PR that contains the conservative changes for review.

Tell me which option you prefer and I will proceed. If you want the automatic change, confirm the conservative mapping (9/10 -> `text-xs`, 11 -> `text-sm`) or adjust the rules.

---

Full grep hits used to build this audit were collected from the workspace and include many `text-[10px]`, `text-[11px]`, and a `text-[9px]` occurrence. If you'd like, I can attach a complete file-by-file list with exact line numbers as a separate artifact.