# Design System Standards

**Last Updated:** November 18, 2025  
**Purpose:** Unified design principles for consistent, professional UI across all dashboard pages

---

## Overview

This design system ensures visual consistency, predictable user experience, and maintainable code across the application. All new components and pages should follow these standards.

---

## 1. Typography Hierarchy

### Page Titles
- **Size:** `text-xl` (20px)
- **Weight:** `font-bold`
- **Color:** `text-slate-800`
- **Usage:** Main page headings (e.g., "Generate Ideas", "Business Profile")
- **Example:** `<h1 className="text-xl font-bold text-slate-800">`

### Section Titles
- **Size:** `text-lg` (18px)
- **Weight:** `font-medium`
- **Color:** `text-gray-900`
- **Usage:** Section headings within pages (e.g., "Basic Business Info", "Social Connections")
- **Example:** `<h2 className="text-lg font-medium text-gray-900">`

### Subsection Titles
- **Size:** `text-sm` (14px)
- **Weight:** `font-bold` or `font-semibold`
- **Color:** `text-slate-800`
- **Usage:** Minor section headings, card titles
- **Example:** `<h3 className="text-sm font-bold text-slate-800">`

### Body Text
- **Size:** `text-sm` (14px)
- **Weight:** `font-normal`
- **Color:** `text-gray-600` or `text-slate-600`
- **Usage:** Descriptions, hints, helper text
- **Example:** `<p className="text-sm text-gray-600">`

### Labels
- **Size:** `text-sm` (14px)
- **Weight:** `font-medium`
- **Color:** `text-gray-700`
- **Usage:** Form labels, input labels
- **Example:** `<label className="text-sm font-medium text-gray-700">`

### Small Text
- **Size:** `text-xs` (12px)
- **Weight:** `font-normal` or `font-medium`
- **Color:** `text-gray-500` or `text-slate-500`
- **Usage:** Badges, metadata, character counts, timestamps
- **Example:** `<span className="text-xs text-gray-500">`

---

## 2. Input Components

### Text Inputs
```tsx
<input
  type="text"
  className="w-full px-3 py-2 border border-gray-300 rounded-lg 
             focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
             text-sm"
/>
```

**Standards:**
- Padding: `px-3 py-2` (horizontal: 12px, vertical: 8px)
- Border: `border border-gray-300` (1px solid gray)
- Border radius: `rounded-lg` (8px)
- Font size: `text-sm` (14px)
- Focus state: `focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`

### Select Dropdowns
```tsx
<select
  className="w-full px-3 py-2 border border-gray-300 rounded-lg 
             focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
             text-sm"
>
  <option>Option 1</option>
</select>
```

**Standards:** Same as text inputs

### Textareas
```tsx
<textarea
  rows={4}
  className="w-full px-3 py-2 border border-gray-300 rounded-lg 
             focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
             text-sm resize-none"
/>
```

**Standards:**
- Same padding and styling as text inputs
- Add `resize-none` to prevent user resizing (unless explicitly needed)
- Use `rows` attribute for height control (default: 4 rows)

### Disabled State
```tsx
className="... disabled:bg-gray-50 disabled:text-gray-600 disabled:cursor-not-allowed"
```

---

## 3. Button Components

### Primary Button
```tsx
<button
  className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm 
             font-semibold hover:bg-indigo-700 transition-colors shadow-md"
>
  Save Changes
</button>
```

**Standards:**
- Padding: `px-6 py-2` (horizontal: 24px, vertical: 8px)
- Background: `bg-indigo-600` with `hover:bg-indigo-700`
- Text: `text-white text-sm font-semibold`
- Border radius: `rounded-lg` (8px)
- Shadow: `shadow-md` (optional, for emphasis)

### Secondary Button
```tsx
<button
  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg 
             text-sm font-medium hover:bg-gray-50 transition-colors"
>
  Cancel
</button>
```

**Standards:**
- Padding: `px-4 py-2` (horizontal: 16px, vertical: 8px)
- Border: `border border-gray-300`
- Text: `text-gray-700 text-sm font-medium`
- Hover: `hover:bg-gray-50`

### Gradient Button (Special Actions)
```tsx
<button
  className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 
             text-white rounded-lg text-sm font-medium shadow-md 
             hover:from-indigo-700 hover:to-purple-700 transition-all"
>
  Analyze Website
</button>
```

**Usage:** Use sparingly for high-impact actions (AI features, premium actions)

### Small Button
```tsx
<button
  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs 
             font-medium hover:bg-indigo-700 transition-colors"
>
  Quick Action
</button>
```

**Usage:** Compact interfaces, inline actions

---

## 4. Layout & Spacing

### Section Cards
```tsx
<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
  <div className="p-4 bg-gray-50 border-b border-gray-200">
    {/* Header */}
  </div>
  <div className="p-4">
    {/* Content */}
  </div>
</div>
```

**Standards:**
- Card padding: `p-4` (16px all sides)
- Card spacing: `space-y-6` (24px vertical gap between cards)
- Header background: `bg-gray-50` (for emphasis)
- Border: `border border-gray-200`

### Priority/Highlighted Sections
```tsx
<div className="bg-white rounded-lg border-2 border-indigo-200 shadow-lg p-4">
  {/* Important content */}
</div>
```

**Usage:** "Quick Start" sections, priority features
- Thicker border: `border-2 border-indigo-200`
- Shadow: `shadow-lg` for depth

### Spacing Standards
- **Card Gaps:** `space-y-6` (24px between major sections)
- **Internal Spacing:** `space-y-4` (16px between subsections)
- **Small Gaps:** `space-y-2` or `space-y-3` (8px-12px for related items)
- **Horizontal Gaps:** `gap-4` (16px) for grid items, `gap-2` (8px) for buttons

---

## 5. Color Palette

### Primary Colors
- **Indigo (Primary):** `indigo-600` (buttons, links, focus states)
- **Purple (Accent):** `purple-600` (gradients, premium features)
- **Slate (Text):** `slate-800`, `slate-700`, `slate-600` (headings to body)
- **Gray (Neutral):** `gray-900`, `gray-700`, `gray-600`, `gray-500` (text hierarchy)

### Status Colors
- **Success:** `green-600`, `emerald-600` (confirmations, connected states)
- **Warning:** `amber-600`, `yellow-600` (caution messages)
- **Error:** `red-600` (errors, disconnected states)
- **Info:** `blue-600` (informational messages)

### Background Colors
- **Page Background:** `bg-gradient-to-br from-slate-50 to-slate-100`
- **Card Background:** `bg-white`
- **Header Background:** `bg-gray-50`
- **Hover Background:** `hover:bg-gray-50`
- **Disabled Background:** `disabled:bg-gray-50`

### Border Colors
- **Default:** `border-gray-200`
- **Focus:** `focus:border-indigo-500`
- **Highlighted:** `border-indigo-200`
- **Error:** `border-red-300`

---

## 6. Icon Standards

### Icon Sizes
- **Large (Page Icons):** `w-6 h-6` (24px)
- **Medium (Section Icons):** `w-5 h-5` (20px)
- **Small (Inline Icons):** `w-4 h-4` (16px)
- **Tiny (Badges):** `w-3 h-3` (12px)

### Icon Colors
- **Primary:** `text-indigo-600`
- **Secondary:** `text-gray-600`
- **Success:** `text-emerald-600`
- **Warning:** `text-amber-600`
- **Error:** `text-red-600`

### Icon Containers
```tsx
<div className="bg-indigo-100 p-2 rounded-lg">
  <IconComponent className="w-5 h-5 text-indigo-600" />
</div>
```

**Usage:** Provides visual weight and color coding for section icons

---

## 7. Form Patterns

### Form Field Group
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Field Label
  </label>
  <input
    type="text"
    className="w-full px-3 py-2 border border-gray-300 rounded-lg 
               focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
               text-sm"
  />
</div>
```

**Standards:**
- Label spacing: `mb-2` (8px between label and input)
- Full width inputs: `w-full`

### Multi-column Forms
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <div>
    {/* Field 1 */}
  </div>
  <div>
    {/* Field 2 */}
  </div>
</div>
```

**Standards:**
- Gap between fields: `gap-6` (24px)
- Responsive: Stack on mobile (`grid-cols-1`), side-by-side on desktop (`md:grid-cols-2`)

---

## 8. Badge & Label Components

### Status Badges
```tsx
{/* Priority Badge */}
<div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold">
  QUICK START
</div>

{/* Optional Badge */}
<div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
  ADVANCED (Optional)
</div>

{/* Auto-detected Badge */}
<span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
  Auto
</span>
```

### Quota/Count Badges
```tsx
<span className="text-xs px-1.5 py-0.5 rounded-full bg-white/20">
  3/10
</span>
```

---

## 9. Status Messages

### Success Message
```tsx
<div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
  <div className="flex items-start space-x-3">
    <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
    <div>
      <h3 className="text-sm font-medium text-emerald-900">
        Success Message Title
      </h3>
      <p className="text-sm text-emerald-700 mt-1">
        Success message details
      </p>
    </div>
  </div>
</div>
```

### Error Message
```tsx
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
  <div className="flex items-start space-x-3">
    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
    <div>
      <h3 className="text-sm font-medium text-red-900">
        Error Message Title
      </h3>
      <p className="text-sm text-red-700 mt-1">
        Error message details
      </p>
    </div>
  </div>
</div>
```

### Info/Nudge Message
```tsx
<div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-3">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Sparkles className="w-4 h-4 text-indigo-600" />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-indigo-800">
          Message Title
        </span>
        <span className="text-xs text-indigo-600">
          Message subtitle
        </span>
      </div>
    </div>
    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
      Action
    </button>
  </div>
</div>
```

---

## 10. Responsive Design

### Breakpoints (Tailwind defaults)
- **Mobile:** Default (no prefix) - 0px+
- **Tablet:** `md:` - 768px+
- **Desktop:** `lg:` - 1024px+
- **Large Desktop:** `xl:` - 1280px+

### Common Patterns
```tsx
{/* Stack on mobile, side-by-side on desktop */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">

{/* Hide on mobile, show on desktop */}
<div className="hidden md:block">

{/* Full width on mobile, max width on desktop */}
<div className="w-full max-w-6xl mx-auto">
```

---

## 11. Animation & Transitions

### Standard Transitions
```tsx
className="transition-colors" // For color changes
className="transition-all"    // For multiple properties
```

**Duration:** Default 150ms (Tailwind default)

### Hover States
```tsx
className="hover:bg-gray-50 hover:text-indigo-600 transition-colors"
```

### Loading States
```tsx
<Loader2 className="w-5 h-5 animate-spin" />
```

---

## 12. Accessibility Standards

### Focus States
**Always include focus states for interactive elements:**
```tsx
className="focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
```

### Labels
**All inputs must have associated labels:**
```tsx
<label htmlFor="email-input" className="block text-sm font-medium text-gray-700">
  Email
</label>
<input
  id="email-input"
  type="email"
  ...
/>
```

### Disabled States
**Clearly indicate disabled elements:**
```tsx
className="disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
```

---

## 13. Implementation Checklist

When creating a new page or component, ensure:

- [ ] Page title uses `text-xl font-bold`
- [ ] Section titles use `text-lg font-medium`
- [ ] All inputs use `px-3 py-2 text-sm`
- [ ] All buttons use appropriate size (`px-6 py-2` primary, `px-4 py-2` secondary)
- [ ] Section cards use `p-4` padding
- [ ] Card gaps use `space-y-6`
- [ ] Focus states are included on all interactive elements
- [ ] Color scheme follows primary indigo palette
- [ ] Icons are sized appropriately (`w-4 h-4` inline, `w-5 h-5` section)
- [ ] Responsive breakpoints are implemented (`md:` for tablets+)
- [ ] Transitions are added for hover states
- [ ] All inputs have associated labels

---

## 14. Common Mistakes to Avoid

### ❌ Don't Do
```tsx
{/* Inconsistent padding */}
<input className="px-4 py-2.5 text-base" />

{/* Oversized titles */}
<h1 className="text-2xl" />

{/* Missing focus states */}
<input className="border rounded" />

{/* Tiny button text */}
<button className="text-xs" />

{/* Excessive section padding */}
<div className="p-6">
```

### ✅ Do This
```tsx
{/* Consistent padding */}
<input className="px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />

{/* Proper title hierarchy */}
<h1 className="text-xl font-bold" />

{/* Complete focus states */}
<input className="border rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />

{/* Readable button text */}
<button className="text-sm font-semibold" />

{/* Compact section padding */}
<div className="p-4">
```

---

## 15. Future Updates

When updating this design system:
1. Document the change with date and reason
2. Update all affected components systematically
3. Test responsive behavior across devices
4. Verify accessibility standards are maintained
5. Update this document with new patterns

**Version History:**
- **v1.0** (Nov 18, 2025) - Initial design system documentation after BusinessProfilePage and GenerateStep standardization

---

## Questions or Clarifications?

If you encounter a component or pattern not covered in this guide:
1. Follow the closest similar pattern
2. Prioritize consistency over novelty
3. Document your decision for future reference
4. Update this guide with the new pattern

**Goal:** Every UI element should feel intentional, cohesive, and professional.
