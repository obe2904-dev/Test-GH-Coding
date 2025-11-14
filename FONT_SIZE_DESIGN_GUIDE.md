# Font Size Design Guide - Post2Grow
**Optimized for Readability & Accessibility**

---

## 📏 Font Size Standards

### **XL Sizes - Headings & Titles**
| Size | Tailwind Class | Use Case | Example |
|------|----------------|----------|---------|
| 24px | `text-2xl` | Main page headings | "Opret Opslag" |
| 20px | `text-xl` | Section titles, Card headers | "Dine Tilsluttede Platforme" |
| 18px | `text-lg` | Sub-headings | Analytics section headers |

### **Base Sizes - Body & Navigation**
| Size | Tailwind Class | Use Case | Example |
|------|----------------|----------|---------|
| 16px | `text-base` | Body text, Primary content, Welcome messages | Main content paragraphs |
| 15px | `text-[15px]` | Large navigation items | Main sidebar navigation |
| 14px | `text-sm` | Standard navigation, Buttons, Secondary content | Settings submenu items |

### **Small Sizes - Labels & Metadata**
| Size | Tailwind Class | Use Case | Example |
|------|----------------|----------|---------|
| 13px | `text-[13px]` | Labels, Badges, Small buttons | Plan banner text |
| 12px | `text-xs` | **MINIMUM SIZE** - Metadata, Timestamps, Tiny labels | "For 2 timer siden" |

### **❌ Never Use**
- 11px or smaller - Accessibility violation
- 9px, 10px - Too small for comfortable reading

---

## 🎯 Component-Specific Guidelines

### **Sidebar Navigation**
```jsx
// Logo
className="text-2xl font-bold"                    // 24px

// Main navigation items
className="text-sm font-medium"                   // 14px

// Settings submenu
className="text-sm"                               // 14px

// Platform section label
className="text-xs font-semibold"                 // 12px

// Plan banner heading
className="text-sm font-bold"                     // 14px

// Plan banner description
className="text-xs"                               // 12px
```

### **TopBar**
```jsx
// Welcome message
className="text-base font-bold"                   // 16px

// Subtitle
className="text-sm"                               // 14px

// User name
className="text-sm font-medium"                   // 14px

// User plan badge
className="text-xs"                               // 12px

// Notification titles
className="text-sm font-medium"                   // 14px

// Notification body
className="text-xs"                               // 12px

// Notification timestamp
className="text-xs text-slate-500"                // 12px (minimum)
```

### **Main Content Area**
```jsx
// Page headings
className="text-xl font-bold"                     // 20-24px

// Body text / descriptions
className="text-base"                             // 16px

// Card headings
className="text-base font-bold"                   // 16px

// Card body text
className="text-sm"                               // 14px

// Metadata / labels
className="text-sm text-slate-600"                // 14px

// Small info text
className="text-xs"                               // 12px minimum
```

### **Buttons**
```jsx
// Primary large buttons
className="text-base font-medium"                 // 16px

// Standard buttons
className="text-sm font-medium"                   // 14px

// Small buttons
className="text-xs font-bold"                     // 12px minimum
```

### **Forms & Inputs**
```jsx
// Input labels
className="text-sm font-medium"                   // 14px

// Input text
className="text-base"                             // 16px

// Helper text
className="text-sm text-slate-500"                // 14px

// Error messages
className="text-sm text-red-600"                  // 14px
```

### **Cards & Analytics**
```jsx
// Card title
className="text-base font-bold"                   // 16px

// Metric labels
className="text-sm font-medium"                   // 14px

// Large numbers/stats
className="text-3xl font-bold"                    // 30px

// Small stats/changes
className="text-sm"                               // 14px
```

### **Platform Indicators**
```jsx
// Platform name
className="text-xs font-semibold"                 // 12px

// Status text
className="text-xs font-medium"                   // 12px
```

---

## 🎨 Icon Size Guidelines

### **Icon Sizing Chart**
| Context | Icon Size | Tailwind Class | Use With Text Size |
|---------|-----------|----------------|-------------------|
| Logo area | 24-28px | `w-6 h-6` or `w-7 h-7` | text-2xl |
| Main navigation | 20px | `w-5 h-5` | text-sm |
| Submenu items | 16px | `w-4 h-4` | text-sm |
| TopBar items | 20px | `w-5 h-5` | text-base |
| Buttons (large) | 20px | `w-5 h-5` | text-base |
| Buttons (standard) | 16px | `w-4 h-4` | text-sm |
| Inline icons | 16px | `w-4 h-4` | text-sm |
| Small indicators | 12-14px | `w-3 h-3` or `w-3.5 h-3.5` | text-xs |

### **Icon Rules**
```jsx
// ✅ GOOD - Icons match text size
<button className="flex items-center gap-2">
  <Icon className="w-5 h-5" />              // 20px icon
  <span className="text-base">Button</span>  // 16px text
</button>

// ❌ BAD - Mismatched sizes
<button className="flex items-center gap-2">
  <Icon className="w-3 h-3" />              // 12px icon - too small!
  <span className="text-base">Button</span>  // 16px text
</button>
```

---

## 📱 Spacing Guidelines (Related to Font Size)

### **Padding & Margins**
```jsx
// Small text (12px) → Small padding
className="px-2 py-1 text-xs"                    // 8px/4px padding

// Standard text (14px) → Standard padding
className="px-3 py-2 text-sm"                    // 12px/8px padding

// Large text (16px+) → Comfortable padding
className="px-4 py-3 text-base"                  // 16px/12px padding

// Extra large headings → Extra padding
className="px-6 py-4 text-2xl"                   // 24px/16px padding
```

### **Gap Between Elements**
```jsx
// Icons + text
className="gap-2"          // 8px gap for text-xs/sm
className="gap-2.5"        // 10px gap for text-base
className="gap-3"          // 12px gap for text-lg+

// List items
className="space-y-1"      // 4px for compact lists
className="space-y-1.5"    // 6px for text-sm
className="space-y-2"      // 8px for text-base
```

---

## 🔍 Quick Reference Cheat Sheet

### **Copy-Paste Ready Classes**

**Navigation:**
```
Main nav item:     text-sm font-medium gap-3 px-3 py-2.5
Submenu item:      text-sm gap-3 px-3 py-2
Badge:             text-xs font-bold px-2 py-0.5
```

**Content:**
```
Page heading:      text-xl font-bold mb-3
Section heading:   text-base font-bold mb-4
Body text:         text-base text-slate-600
Card heading:      text-base font-bold mb-2
Card body:         text-sm text-slate-600
```

**Buttons:**
```
Primary large:     px-5 py-3 text-base font-medium
Primary standard:  px-4 py-2 text-sm font-medium
Secondary:         px-3 py-2 text-sm font-medium
```

**Forms:**
```
Label:             text-sm font-medium mb-1.5
Input:             text-base px-4 py-2.5
Helper text:       text-sm text-slate-500 mt-1
```

---

## ✅ Accessibility Checklist

- [ ] No text below 12px (WCAG AA minimum)
- [ ] Body text is at least 16px
- [ ] Navigation items are 14-15px minimum
- [ ] Labels are at least 13px
- [ ] Icons match text size appropriately
- [ ] Sufficient padding around text
- [ ] Line height: 1.5 for body text, 1.2-1.3 for headings
- [ ] Color contrast ratio: 4.5:1 minimum for normal text

---

## 🎓 Font Size Hierarchy Examples

### **Example 1: Card Component**
```jsx
<div className="bg-white rounded-lg border p-5">
  {/* Heading - 16px */}
  <h3 className="text-base font-bold text-slate-800 mb-2">
    Card Title
  </h3>
  
  {/* Body - 16px */}
  <p className="text-base text-slate-600 mb-4">
    Main content goes here with comfortable reading size.
  </p>
  
  {/* Metadata - 14px */}
  <div className="flex items-center gap-2 text-sm text-slate-500">
    <Clock className="w-4 h-4" />
    <span>2 timer siden</span>
  </div>
</div>
```

### **Example 2: Navigation Item**
```jsx
<button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg">
  {/* Icon - 20px */}
  <PencilIcon className="w-5 h-5" />
  
  {/* Text - 14px */}
  <span className="text-sm font-medium">Opret Opslag</span>
  
  {/* Badge - 12px */}
  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100">
    NY
  </span>
</button>
```

### **Example 3: Platform Indicator**
```jsx
<div className="flex items-center gap-2 px-2.5 py-2 bg-blue-50 border border-blue-200 rounded-lg">
  {/* Icon - 20px */}
  <FacebookIcon className="w-5 h-5 text-blue-600" />
  
  <div className="flex flex-col">
    {/* Platform name - 12px */}
    <span className="text-xs font-semibold">Facebook</span>
    
    {/* Status - 12px */}
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full bg-blue-500" />
      <span className="text-xs font-medium">Tilsluttet</span>
    </div>
  </div>
</div>
```

---

## 💡 Pro Tips for VS Code + Copilot

### **1. Comment your font sizes**
```jsx
// text-base (16px) - body text
// text-sm (14px) - navigation
// text-xs (12px) - metadata minimum
```

### **2. Use this prompt pattern with Copilot:**
```
// Create a button with text-base (16px) font and w-5 h-5 (20px) icon
```

### **3. Create code snippets in VS Code**
File → Preferences → Configure User Snippets → javascript.jsx

```json
{
  "Nav Button": {
    "prefix": "navbtn",
    "body": [
      "className=\"flex items-center gap-3 px-3 py-2.5 text-sm font-medium\""
    ]
  },
  "Primary Button": {
    "prefix": "pbtn",
    "body": [
      "className=\"px-5 py-3 text-base font-medium\""
    ]
  }
}
```

### **4. Keep this file open in a split view**
While coding, keep this guide visible in VS Code for quick reference.

---

## 🚫 Common Mistakes to Avoid

1. **Mixing font sizes randomly**
   - ❌ `text-xs` for main content
   - ✅ `text-base` for main content

2. **Tiny icons with large text**
   - ❌ `w-3 h-3` icon with `text-base` text
   - ✅ `w-5 h-5` icon with `text-base` text

3. **Insufficient padding**
   - ❌ `px-2 py-1 text-base` (cramped)
   - ✅ `px-4 py-3 text-base` (comfortable)

4. **Inconsistent hierarchy**
   - ❌ Card title: `text-sm`, Card body: `text-base`
   - ✅ Card title: `text-base font-bold`, Card body: `text-sm`

---

## 📊 Decision Tree

```
Need to add text? Ask:

├─ Is it a page heading?
│  └─ YES → text-xl or text-2xl (20-24px)
│
├─ Is it main body content?
│  └─ YES → text-base (16px)
│
├─ Is it navigation or buttons?
│  └─ YES → text-sm (14px)
│
├─ Is it metadata or labels?
│  └─ YES → text-sm or text-xs (14-12px)
│
└─ Is it decorative or supplementary?
   └─ YES → text-xs minimum (12px)
```

---

## 🎯 Summary: The Golden Rules

1. **Body text = 16px** (text-base)
2. **Navigation = 14px** (text-sm)
3. **Minimum = 12px** (text-xs)
4. **Never go below 12px**
5. **Icons should match text size** (±4px)
6. **Headings scale up from body text**
7. **Use consistent spacing with font size**

---

**Last Updated:** November 2025  
**Version:** 1.0  
**For:** Post2Grow Application
