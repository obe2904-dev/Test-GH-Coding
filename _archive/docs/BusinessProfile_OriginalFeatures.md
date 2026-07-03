# Business Profile Features - Preserved from Refactoring

**Source:** Original BusinessProfilePage component before dashboard refactoring cleanup  
**Date:** November 17, 2025  
**Context:** During dashboard component extraction, the original BusinessProfilePage contained rich business information features that were simplified in the current version. This document preserves the original feature specifications for future implementation.

---

## Original Features Overview

The original BusinessProfilePage included sophisticated business analysis and management features:

### 🎯 **Priority UX Flow**
- **QUICK START** (30 seconds) - Basic business type and location  
- **ADVANCED** (Optional) - Full website analysis with auto-detection

### 📊 **Website Analysis with AI Detection**
- Automatic business name detection
- Business type identification
- Description extraction
- Opening hours analysis
- Menu/service offerings detection
- Contact information extraction

---

## Detailed Feature Specifications

### 1. **Opening Hours Management**

**Auto-Detection:** AI analyzes website to extract opening hours  
**Manual Override:** Users can edit detected hours  
**Format:** Time inputs with open/close times per day  
**Closed Days:** Special handling for days when business is closed

```
Data Structure:
{
  monday: { open: "09:00", close: "17:00" },
  tuesday: { open: "09:00", close: "17:00" },
  wednesday: { closed: true },
  // ... etc
}
```

**UI Features:**
- Visual badges showing "Auto-detected" status
- Edit mode toggle for modifications
- Time picker inputs
- "Closed" state handling

### 2. **Menu/Offerings Management**

**Three-Tab Interface:**
1. **Menu Categories** - Food/service categories (Coffee, Pastries, etc.)
2. **Signature Items** - Featured products/services (⭐ marked)
3. **Dietary Options** - Special dietary accommodations (🌱 marked)

**Auto-Detection Features:**
- Parses website for menu information
- Categorizes offerings automatically
- Identifies signature/popular items
- Detects dietary options (vegan, gluten-free, etc.)

### 3. **Contact Information Auto-Fill**

**Detected Fields:**
- **Phone Number** - With Phone icon
- **Email Address** - With Mail icon  
- **Physical Address** - With MapPin icon

**UI Features:**
- Icon-labeled inputs
- Auto-fill from website analysis
- Edit mode for manual corrections
- "Auto-detected" status badges

### 4. **Business Information Cards**

**Card-Based Layout:**
- **Basic Info Card** - Name, type, description
- **Opening Hours Card** - Weekly schedule with time inputs
- **Offerings Card** - Tabbed interface for menu items
- **Contact Card** - Phone, email, address

**Interactive Features:**
- Edit mode toggles per card
- Auto-detection status indicators
- Save/cancel actions
- Real-time validation

---

## Technical Implementation Details

### State Management
```typescript
const [editingSection, setEditingSection] = useState<string | null>(null)
const [activeTab, setActiveTab] = useState<'categories' | 'signature' | 'dietary'>('categories')
const [analysisResult, setAnalysisResult] = useState<BusinessProfileAnalysis | null>(null)
```

### Business Analysis Interface
```typescript
interface BusinessProfileAnalysis {
  businessName?: string
  businessType?: string  
  description?: string
  openingHours?: Record<string, { open?: string, close?: string, closed?: boolean }>
  offerings?: {
    categories: string[]
    signatureItems: string[]
    dietaryOptions: string[]
  }
  contact?: {
    phone?: string
    email?: string
    address?: string
  }
}
```

### Week Days Structure
```typescript
const weekDays = [
  { key: 'monday', label: t('business.openingHours.monday') },
  { key: 'tuesday', label: t('business.openingHours.tuesday') },
  { key: 'wednesday', label: t('business.openingHours.wednesday') },
  { key: 'thursday', label: t('business.openingHours.thursday') },
  { key: 'friday', label: t('business.openingHours.friday') },
  { key: 'saturday', label: t('business.openingHours.saturday') },
  { key: 'sunday', label: t('business.openingHours.sunday') }
]
```

---

## UI Components & Styling

### Visual Hierarchy
- **Gradient Background:** `bg-gradient-to-br from-slate-50 to-slate-100`
- **Card Design:** White cards with gray borders and shadow
- **Priority Badges:** 
  - QUICK START: `bg-indigo-600 text-white px-3 py-1 rounded-full`
  - ADVANCED: `bg-gray-100 text-gray-600 px-3 py-1 rounded-full`
- **Auto-Detection Badges:** `bg-emerald-100 text-emerald-700`

### Status Banners
- **Success:** Green banner with CheckCircle icon
- **Error:** Red banner with AlertCircle icon  
- **Loading:** Spinning Loader2 icon

### Edit Mode Interaction
- Edit buttons with Edit2 icon per card
- Disabled inputs with gray background when not editing
- Color-coded edit states (indigo for basic, purple for hours, etc.)

---

## Translation Keys Used

```typescript
// Navigation & Titles
t('connections.title')
t('connections.description')
t('business.basicInfo.title')
t('business.openingHours.title')
t('business.offerings.title')
t('business.contact.title')

// Form Fields
t('business.websiteUrl')
t('business.basicInfo.businessName')
t('business.basicInfo.businessType')
t('business.basicInfo.description')
t('business.contact.phone')
t('business.contact.email')
t('business.contact.address')

// Actions & Status
t('business.analyzing')
t('business.analyzeWebsite')
t('business.autoDetected')
t('business.actions.saveAll')
t('business.actions.cancel')

// Days of Week
t('business.openingHours.monday') // through sunday
t('business.openingHours.closed')

// Offerings
t('business.offerings.menuCategories')
t('business.offerings.signatureItems')
t('business.offerings.dietaryOptions')
```

---

## Future Implementation Notes

### When to Implement
- **Phase 1:** Basic opening hours input (simple time pickers)
- **Phase 2:** Menu/offerings management (tabbed interface)
- **Phase 3:** Advanced AI analysis integration
- **Phase 4:** Full contact information auto-fill

### Integration Points
- Enhance existing BusinessProfilePage component
- Integrate with AI analysis service
- Add translation keys to locale files
- Update business profile store for complex data

### Dependencies
- Enhanced `analyzeBusinessProfile` function
- Additional translation keys in `da.json` and `en.json`
- Extended business profile data model
- Time picker UI components

---

## Current vs Original Comparison

**Current (Simplified):**
- Basic social platform connections
- Simple website URL analysis
- Minimal business information form

**Original (Full Featured):**
- ✅ Social platform connections
- ✅ Intelligent website analysis with auto-detection
- ✅ Comprehensive opening hours management
- ✅ Menu/offerings categorization
- ✅ Contact information auto-fill
- ✅ Card-based editing interface
- ✅ Status banners and progress indicators

This preserved specification ensures all the rich business profile functionality can be restored and enhanced in future development cycles.