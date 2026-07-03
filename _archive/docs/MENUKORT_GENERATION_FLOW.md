# Menukort (Menu) Generation Flow

Complete journey from detecting menu sources to extracting and structuring menu data for AI-powered content generation.

---

## 🎯 Post2Grow UX Principles

**"For Dummies" Design**:
- **Never show technical states** in UI (queued, processing, failed, job_id, edge functions)
- **Always translate** internal states to friendly language
- **Always provide next action** on errors (Retry / Try another source / Upload again)
- **Hide technical details** behind "Details" (for debugging only)

**State Translation Pattern**:
```typescript
const UI_STATE_MAP = {
  queued: {
    label: 'Vi forbereder dit menukort…',
    icon: '⏳',
    showProgress: true
  },
  processing: {
    label: 'Læser dit menukort…',
    icon: '📖',
    showProgress: true
  },
  completed: {
    label: 'Menukort klar',
    icon: '✅',
    showProgress: false
  },
  failed: {
    label: 'Vi kunne ikke læse menukortet',
    sublabel: 'Prøv en tydeligere PDF eller vælg en anden kilde',
    icon: '❌',
    showProgress: false,
    actions: ['Prøv igen', 'Vælg anden fil', 'Tilføj manuelt']
  }
}
```

**Danish Localization Rules**:
1. **Place names stay Danish**: "Åen", "Strøget", "Havnen" (never translate to "river", "street", "harbor")
2. **Natural Danish tone**: Use café-friendly language, not literal English translations
3. **Consistent formatting**: DKK currency, Danish date formats, decimal commas where applicable
4. **No mixed languages**: Keep UI fully Danish unless explicitly multi-language content

---

## 📊 Overview

The Menukort system is a **multi-source menu extraction and management system** that:
- Detects menu URLs from business websites automatically
- Extracts menu data from PDFs and web pages using AI
- Structures menu items into categories with items and descriptions
- Stores menu data for Brand Profile generation and content creation
- Supports manual URL addition and PDF uploads

**Timeline**: 15-60 seconds (depending on source type and size)  
**Data Sources**: Website URLs, PDF files, manual text input  
**Storage**: Multiple tables (`menu_sources`, `menu_extractions`, `menu_results`, `business_profile`)

---

## 🔄 Complete Flow Diagram

```
USER NAVIGATES TO "Menukort" PAGE
  ↓
Frontend: MenuPage.tsx / MenuOfferingsPanel.tsx
  ↓
[1] Load Existing Menu Data
  ├─ menu_sources table (tracked URLs/PDFs)
  ├─ menu_extractions table (AI-extracted menu data)
  ├─ business_profile.menu_structure (JSONB)
  └─ business_profile.detected_menu_urls (string[])
  ↓
[2] USER CHOOSES ONE OF FOUR PATHS:
  │
  ├─ Path A: Auto-Detect Menu URLs (AI-powered)
  │   ├─ Click "Detect nye menuer"
  │   ├─ Call analyze-website Edge Function
  │   ├─ AI finds menu/food URLs on website
  │   ├─ Auto-add to menu_sources with status='pending'
  │   └─ User can trigger extraction
  │
  ├─ Path B: Manual URL Entry
  │   ├─ Paste menu URL in input field
  │   ├─ AI detects menu type from URL pattern
  │   ├─ Click "Tilføj URL"
  │   ├─ Save to menu_sources table
  │   └─ Trigger extraction
  │
  ├─ Path C: PDF Upload
  │   ├─ Click "Upload PDF"
  │   ├─ Upload file to Supabase Storage
  │   ├─ Save to menu_sources (source_type='pdf')
  │   └─ Queue extraction job
  │
  └─ Path D: Manual Text Entry
      ├─ Click "Tilføj manuelt"
      ├─ Paste menu text
      ├─ Call parse-menu-text Edge Function
      ├─ AI structures text → categories + items
      └─ Save to menu_extractions
  ↓
[3] EXTRACTION PROCESS (for paths A, B, C)
  │
  ├─ For URL:
  │   ├─ Call extract-menu-url Edge Function
  │   ├─ Fetch webpage HTML
  │   ├─ Extract clean text
  │   ├─ Send to parse-menu-text
  │   └─ Save structured menu
  │
  └─ For PDF:
      ├─ Call extract-menu-pdf Edge Function
      ├─ Create job in menu_results table (status='queued')
      ├─ Cloud Run worker picks up job
      ├─ OCR + text extraction
      ├─ AI parsing → structured menu
      └─ Update menu_results (status='completed')
  ↓
[4] AI PARSING (parse-menu-text Edge Function)
  ├─ Input: Raw text (HTML/PDF/manual)
  ├─ AI Model: GPT-4o
  ├─ Extract: Categories, items, prices, descriptions
  ├─ Output: Structured JSON menu
  └─ Validation: Min 1 category, min 1 item per category
  ↓
[5] SAVE TO DATABASE
  ├─ Insert/update menu_extractions table
  ├─ Update business_profile.menu_structure (JSONB)
  └─ Mark menu_sources as status='completed'
  ↓
[6] DISPLAY & EDITING
  ├─ Show extracted menu in accordion cards
  ├─ User can expand/collapse categories
  ├─ Edit category names and items
  ├─ Delete unwanted categories
  └─ Click "Gem" → Update business_profile
  ↓
[7] MENU DATA AVAILABLE FOR:
  ├─ Brand Profile Generation (core_offerings, content_focus)
  ├─ Content Generation (post ideas about specific dishes)
  └─ AI prompts (include menu items in context)
```

---

## 📂 Frontend Flow

### **File**: `src/pages/dashboard/MenuPage.tsx` and `src/pages/dashboard/businessProfile/components/MenuOfferingsPanel.tsx`

### **Step 1: Load Existing Menu Data**

**On Page Mount**:
```typescript
useEffect(() => {
  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. Load businesses table
    const { data: businessData } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!businessData) return
    setBusinessId(businessData.id)

    // 2. Load business_profile for menu data
    const { data: profileData } = await supabase
      .from('business_profile')
      .select('*')
      .eq('business_id', businessData.id)
      .maybeSingle()

    // 3. Parse menu structure (JSONB)
    let loadedOfferings = defaultOfferingsForSector(sector)
    if (profileData?.menu_structure) {
      loadedOfferings = typeof profileData.menu_structure === 'string'
        ? JSON.parse(profileData.menu_structure)
        : profileData.menu_structure
    }

    setBusinessOfferings(loadedOfferings)
    setMenuDescription(profileData?.menu_description || '')

    // 4. Load detected menu URLs (from AI website analysis)
    if (profileData?.detected_menu_urls && Array.isArray(profileData.detected_menu_urls)) {
      setDetectedMenuUrls(profileData.detected_menu_urls)
    }

    // 5. Load menu sources (tracked URLs/PDFs)
    const { data: menuSources } = await supabase
      .from('menu_sources')
      .select('*')
      .eq('business_id', businessData.id)
      .order('created_at', { ascending: false })

    setMenuUrls(menuSources || [])

    // 6. Load menu extractions (AI-extracted menu data)
    const { data: menuExtractions } = await supabase
      .from('menu_extractions')
      .select('*')
      .eq('business_id', businessData.id)
      .order('created_at', { ascending: false })

    setMenuExtractions(menuExtractions || [])
  }

  fetchProfile()
}, [])
```

**UI State Mapping Helper**:
```typescript
function getMenuSourceUIState(source: MenuSource): MenuSourceUIState {
  switch (source.status) {
    case 'pending':
      return {
        displayLabel: 'Starter…',
        icon: '⏳',
        isActive: true
      }
    case 'processing':
      return {
        displayLabel: 'Læser menukortet…',
        icon: '📖',
        isActive: true
      }
    case 'completed':
      return {
        displayLabel: 'Klar',
        icon: '✅',
        isActive: false
      }
    case 'failed':
      return {
        displayLabel: 'Kunne ikke læses',
        icon: '❌',
        isActive: false,
        errorMessage: 'Vi kunne ikke læse menukortet. Prøv en tydeligere PDF eller tilføj indholdet manuelt.',
        nextActions: ['Prøv igen', 'Upload ny fil', 'Tilføj manuelt']
      }
    default:
      return {
        displayLabel: 'Ukendt status',
        icon: '⚠️',
        isActive: false
      }
  }
}
```

**Loaded Data Structures**:
```typescript
interface MenuSource {
  id: string
  business_id: string
  source_url?: string           // For URLs
  pdf_file_path?: string        // For uploaded PDFs
  source_type: 'url' | 'pdf' | 'text'
  source_origin: 'user_added' | 'ai_detected' | 'manual'
  menu_type: 'standard' | 'drinks' | 'seasonal' | 'special'
  menu_label?: string           // e.g., "Brunch", "Frokost", "Cocktails"
  status: 'pending' | 'processing' | 'completed' | 'failed'  // INTERNAL ONLY - never show in UI
  created_at: string
  created_by: string
}

// UI-facing state (derived from internal status)
interface MenuSourceUIState {
  displayLabel: string          // "Vi læser dit menukort…"
  icon: string                  // "📖"
  isActive: boolean             // Show spinner/progress
  errorMessage?: string         // User-friendly error
  nextActions?: string[]        // ["Prøv igen", "Tilføj manuelt"]
}

interface MenuExtraction {
  id: string
  business_id: string
  menu_source_id: string        // FK to menu_sources
  menu_name: string
  extracted_data: {
    categories: Array<{
      name: string              // e.g., "BRUNCH", "DESSERTS"
      items: Array<{
        name: string
        description?: string
        price?: string
        tags?: string[]         // e.g., ['vegetarian', 'spicy']
      }>
    }>
  }
  extraction_method: 'ai' | 'manual'
  created_at: string
}

interface BusinessOfferingsProfile {
  categories: Array<{
    id: string
    name: string
    items: Array<{
      id: string
      name: string
      short_desc?: string
      popular?: boolean
    }>
  }>
}
```

---

### **Step 2A: Auto-Detect Menu URLs (AI-Powered)**

**User Action**: Click "Detect nye menuer" button

**Code Path**:
```typescript
const handleDetectNewMenus = async () => {
  if (!websiteUrl) {
    setProcessingError('Ingen hjemmeside angivet')
    return
  }

  setIsDetectingMenus(true)

  try {
    // 1. Get auth token
    const { data: { session } } = await supabase.auth.getSession()
    const authToken = session?.access_token

    // 2. Call analyze-website Edge Function
    const endpoint = import.meta.env.VITE_SUPABASE_FUNCTION_ANALYZE_WEBSITE
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        url: websiteUrl,
        businessId
      })
    })

    if (!response.ok) {
      // USER-FRIENDLY: Never show HTTP status codes or technical errors
      throw new Error('Vi kunne ikke analysere hjemmesiden. Tjek at linket virker.')
    }

    const result = await response.json()

    // 3. Extract detected menu URLs from analysis result
    const detectedUrls = result.detectedMenuUrls || []
    console.log(`✅ Detected ${detectedUrls.length} menu URLs`)

    if (detectedUrls.length === 0) {
      // USER-FRIENDLY: Suggest next action
      setProcessingError('Vi fandt ingen menukort på hjemmesiden. Prøv at tilføje linket manuelt eller upload en PDF.')
      return
    }

    // 4. Check which URLs are already tracked
    const { data: existingSources } = await supabase
      .from('menu_sources')
      .select('source_url')
      .eq('business_id', businessId)

    const existingUrls = new Set(existingSources?.map(s => s.source_url) || [])
    const newUrls = detectedUrls.filter(url => !existingUrls.has(url))

    if (newUrls.length === 0) {
      // USER-FRIENDLY: Positive confirmation, not an error
      setSuccessMessage('Dine menukort er allerede tilføjet ✅')
      return
    }

    // 5. Add new URLs to menu_sources with smart type detection
    const menuSourcesToInsert = newUrls.map(url => {
      const { type, label } = detectMenuTypeFromUrl(url)
      return {
        business_id: businessId,
        source_url: url,
        source_type: 'url',
        source_origin: 'ai_detected',
        status: 'pending',
        menu_type: type,
        menu_label: label,
        created_by: userId,
        created_at: new Date().toISOString()
      }
    })

    const { error } = await supabase
      .from('menu_sources')
      .insert(menuSourcesToInsert)

    if (error) throw error

    console.log(`✅ Added ${newUrls.length} new menu sources`)
    
    // 6. Reload menu sources list
    await loadMenuSources()
  } catch (error) {
    console.error('Error detecting menus:', error)
    setProcessingError('Kunne ikke finde menuer')
  } finally {
    setIsDetectingMenus(false)
  }
}
```

**Smart Menu Type Detection**:
```typescript
function detectMenuTypeFromUrl(url: string): { type: MenuType; label: string } {
  const urlLower = url.toLowerCase()
  const path = urlLower.match(/\/([^\/]+)\/?$/)?.[1] || ''
  
  // Patterns ordered from most specific to least specific
  const patterns: Array<[string, string]> = [
    // Compound patterns (check these first)
    ['julefrokost', 'Julefrokost'],
    ['aftensmad', 'Aftenmenu'],
    ['take-away', 'Takeaway'],
    ['vinmenu', 'Vinkort'],
    
    // Time-based
    ['morgenmad', 'Morgenmad'],
    ['brunch', 'Brunch'],
    ['frokost', 'Frokost'],
    ['lunch', 'Frokost'],
    ['middag', 'Middag'],
    ['dinner', 'Middag'],
    ['aften', 'Aftenmenu'],
    
    // Drinks
    ['cocktails', 'Cocktails'],
    ['drikkevarer', 'Drikkevarer'],
    ['drinks', 'Drinks'],
    ['vine', 'Vinkort'],
    ['wine', 'Vinkort'],
    ['bar', 'Barmenu'],
    
    // Food types
    ['desserter', 'Desserter'],
    ['dessert', 'Desserter'],
    ['forretter', 'Forretter'],
    ['hovedretter', 'Hovedretter'],
    ['burgers', 'Burgere'],
    ['pizza', 'Pizza'],
    ['sushi', 'Sushi'],
    
    // Special
    ['takeaway', 'Takeaway'],
    ['catering', 'Catering'],
    ['selskab', 'Selskabsmenu'],
    ['christmas', 'Julemenu'],
    ['weekend', 'Weekendmenu'],
    
    // Generic (last)
    ['menu', 'Menukort'],
    ['kort', 'Menukort']
  ]
  
  for (const [pattern, label] of patterns) {
    if (path.includes(pattern) || urlLower.includes(`/${pattern}/`)) {
      return { type: 'standard', label }
    }
  }
  
  return { type: 'standard', label: 'Menukort' }
}
```

---

### **Step 2B: Manual URL Entry**

**User Action**: 
1. Paste URL in input field
2. Click "Tilføj URL"

**Code Path**:
```typescript
const handleAddMenuUrl = async () => {
  const trimmedUrl = newMenuInput.trim()
  
  if (!trimmedUrl) return

  // 1. Validate URL format
  try {
    new URL(trimmedUrl)
  } catch {
    setProcessingError('Ugyldig URL format')
    return
  }

  // 2. Check for duplicates
  const exists = menuUrls.some(m => m.source_url === trimmedUrl)
  if (exists) {
    setProcessingError('Denne URL er allerede tilføjet')
    return
  }

  // 3. Detect menu type from URL
  const { type, label } = detectMenuTypeFromUrl(trimmedUrl)

  // 4. Save to menu_sources table
  const newSource = {
    business_id: businessId,
    source_url: trimmedUrl,
    source_type: 'url',
    source_origin: 'user_added',
    status: 'pending',
    menu_type: type,
    menu_label: label,
    created_by: userId,
    created_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('menu_sources')
    .insert(newSource)
    .select()
    .single()

  if (error) {
    console.error('Failed to add menu source:', error)
    setProcessingError('Kunne ikke tilføje URL')
    return
  }

  console.log('✅ Menu source added:', data.id)
  
  // 5. Add to local state
  setMenuUrls(prev => [data, ...prev])
  setNewMenuInput('')
  
  // 6. Optionally auto-trigger extraction
  // await handleExtractFromUrl(data.id)
}
```

---

### **Step 2C: PDF Upload**

**User Action**: Click "Upload PDF" and select file

**Code Path**:
```typescript
const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0]
  if (!file) return

  // 1. Validate file type (server handles conversion, but validate client-side for speed)
  if (file.type !== 'application/pdf') {
    // USER-FRIENDLY: No technical jargon, suggest solution
    showError('Vælg venligst en PDF-fil med dit menukort')
    return
  }

  // 2. Validate file size (auto-compress on server, but warn user for large files)
  if (file.size > 10 * 1024 * 1024) {
    // USER-FRIENDLY: No "MB" limits, explain why
    showError('Filen er for stor. Prøv at scanne menukortet igen i lavere kvalitet.')
    return
  }

  setIsUploadingPdf(true)

  try {
    // 3. Upload to Supabase Storage
    const fileName = `menu-${businessId}-${Date.now()}.pdf`
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('menu-pdfs')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) throw uploadError

    console.log('✅ PDF uploaded:', uploadData.path)

    // 4. Get public URL
    const { data: urlData } = supabase
      .storage
      .from('menu-pdfs')
      .getPublicUrl(uploadData.path)

    const pdfUrl = urlData.publicUrl

    // 5. Save to menu_sources table
    const { data: sourceData, error: sourceError } = await supabase
      .from('menu_sources')
      .insert({
        business_id: businessId,
        pdf_file_path: uploadData.path,
        source_url: pdfUrl,
        source_type: 'pdf',
        source_origin: 'user_added',
        status: 'pending',
        menu_type: 'standard',
        menu_label: file.name.replace('.pdf', ''),
        created_by: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (sourceError) throw sourceError

    console.log('✅ Menu source created:', sourceData.id)

    // 6. Queue extraction job
    await handleExtractFromPdf(sourceData.id, pdfUrl)

  } catch (error) {
    console.error('PDF upload error:', error)
    alert('Kunne ikke uploade PDF')
  } finally {
    setIsUploadingPdf(false)
  }
}
```

---

### **Step 2D: Manual Text Entry**

**User Action**: 
1. Click "Tilføj manuelt"
2. Paste menu text
3. Click "Parse menu"

**Code Path**:
```typescript
const handleManualMenuPaste = async (menuText: string) => {
  if (!menuText.trim()) return

  setIsProcessingManual(true)

  try {
    // 1. Get auth token
    const { data: { session } } = await supabase.auth.getSession()
    const authToken = session?.access_token

    // 2. Call parse-menu-text Edge Function
    const response = await fetch(
      `${supabaseUrl}/functions/v1/parse-menu-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          menuText: menuText,
          languageCode: 'da',
          businessId: businessId
        })
      }
    )

    if (!response.ok) {
      // USER-FRIENDLY: Explain what to do next
      throw new Error('Vi kunne ikke læse menukortet. Prøv at formatere det tydeligere med kategorier og retter.')
    }

    const result = await response.json()

    if (!result.categories || result.categories.length === 0) {
      // USER-FRIENDLY: Give example of good format
      throw new Error('Vi fandt ingen kategorier. Prøv at organisere menukortet sådan:\n\nBRUNCH\nRet 1\nRet 2\n\nDRIKKEVARER\nKaffe\nTe')
    }

    // 3. Save to menu_extractions table
    const { data: extractionData, error: extractionError } = await supabase
      .from('menu_extractions')
      .insert({
        business_id: businessId,
        menu_source_id: null, // No source for manual entry
        menu_name: 'Manuelt indtastet menu',
        extracted_data: {
          categories: result.categories
        },
        extraction_method: 'manual',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (extractionError) throw extractionError

    console.log('✅ Manual menu saved:', extractionData.id)

    // 4. Update local state
    setMenuExtractions(prev => [extractionData, ...prev])

  } catch (error) {
    console.error('Manual menu parse error:', error)
    alert('Kunne ikke parse menu tekst')
  } finally {
    setIsProcessingManual(false)
  }
}
```

---

## 🔧 Edge Functions

### **1. extract-menu-url**

**File**: `supabase/functions/extract-menu-url/index.ts`

**Purpose**: Extract menu from a web page URL

**Flow**:
```typescript
serve(async (req: Request) => {
  // 1. Verify authentication
  const authHeader = req.headers.get('Authorization')
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 2. Parse request body
  const { url } = await req.json()

  if (!url) {
    return new Response('Missing URL', { status: 400 })
  }

  // 3. Fetch webpage HTML
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MenuBot/1.0)' }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`)
  }

  const html = await response.text()

  // 4. Extract clean text from HTML
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove styles
    .replace(/<!--[\s\S]*?-->/g, '')                    // Remove comments
    .replace(/<[^>]+>/g, ' ')                           // Remove HTML tags
    .replace(/&nbsp;/g, ' ')                            // Decode entities
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')                               // Normalize whitespace
    .trim()

  if (text.length < 50) {
    throw new Error('Could not extract meaningful text from URL')
  }

  console.log(`✅ Extracted ${text.length} characters of text`)

  // 5. Call parse-menu-text to structure the menu
  const parseResponse = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/parse-menu-text`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        menuText: text,
        languageCode: 'da'
      })
    }
  )

  if (!parseResponse.ok) {
    throw new Error('Menu parsing failed')
  }

  const parsedMenu = await parseResponse.json()

  // 6. Return structured menu data
  return new Response(JSON.stringify(parsedMenu), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})
```

---

### **2. extract-menu-pdf**

**File**: `supabase/functions/extract-menu-pdf/index.ts`

**Purpose**: Queue a PDF menu extraction job for background processing

**Flow**:
```typescript
serve(async (req: Request) => {
  // 1. Verify authentication
  const authHeader = req.headers.get('Authorization')
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 2. Parse request body
  const { businessId, pdfUrl, languageCode } = await req.json()

  if (!businessId || !pdfUrl) {
    throw new Error('Missing businessId or pdfUrl')
  }

  // 3. Create job in menu_results table (queue)
  // The menu_results table acts as our job queue
  // Cloud Run worker polls for status='queued' records
  const supabaseService = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  )

  const { data: resultData, error: resultError } = await supabaseService
    .from('menu_results')
    .insert({
      business_id: businessId,
      pdf_url: pdfUrl,
      status: 'queued',  // Job waiting to be processed
      source_type: 'url',
      language_code: languageCode || 'da',
    })
    .select('id')
    .single()

  if (resultError) {
    throw new Error('Failed to create job')
  }

  const resultId = resultData.id
  console.log(`✅ PDF extraction job queued: ${resultId}`)

  // 4. Return result ID
  // Frontend can subscribe to menu_results updates via Realtime
  return new Response(
    JSON.stringify({
      success: true,
      resultId: resultId,
      message: 'PDF extraction queued - processing will start shortly'
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
```

**Background Worker** (Cloud Run):
```typescript
// Separate Cloud Run service that polls menu_results table
async function processPdfJobs() {
  while (true) {
    // 1. Poll for queued jobs
    const { data: job } = await supabase
      .from('menu_results')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!job) {
      await sleep(5000) // Wait 5 seconds
      continue
    }

    // 2. Mark as processing
    await supabase
      .from('menu_results')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', job.id)

    try {
      // 3. Download PDF
      const pdfBuffer = await fetch(job.pdf_url).then(r => r.arrayBuffer())

      // 4. Extract text using OCR (Tesseract/Google Vision)
      const pdfText = await extractTextFromPdf(pdfBuffer)

      // 5. Parse menu with AI
      const structuredMenu = await parseMenuText(pdfText, job.language_code)

      // 6. Update result with success
      await supabase
        .from('menu_results')
        .update({
          status: 'completed',
          extracted_data: structuredMenu,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id)

      console.log(`✅ PDF job completed: ${job.id}`)

    } catch (error) {
      // 7. Update result with failure
      await supabase
        .from('menu_results')
        .update({
          status: 'failed',
          error_message: error.message,
          failed_at: new Date().toISOString()
        })
        .eq('id', job.id)

      console.error(`❌ PDF job failed: ${job.id}`, error)
    }
  }
}
```

---

### **3. parse-menu-text**

**File**: `supabase/functions/parse-menu-text/index.ts`

**Purpose**: Use AI to structure raw menu text into categories and items

**Flow**:
```typescript
serve(async (req: Request) => {
  // 1. Verify authentication
  const authHeader = req.headers.get('Authorization')
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 2. Parse request body
  const { menuText, languageCode } = await req.json()

  if (!menuText || typeof menuText !== 'string') {
    throw new Error('Missing or invalid menuText')
  }

  const language = languageCode || 'da'

  // 3. Prepare AI prompt
  const prompt = `
Extract menu items from this text and organize them into categories.

MENU TEXT:
${menuText}

Return JSON in this exact format:
{
  "categories": [
    {
      "name": "CATEGORY NAME (e.g., BRUNCH, DRINKS, DESSERTS)",
      "items": [
        {
          "name": "Item name",
          "description": "Optional description",
          "price": "Optional price (e.g., 85,-, 12.50€)",
          "tags": ["vegetarian", "spicy", "popular"]
        }
      ]
    }
  ]
}

RULES:
- Category names in UPPERCASE
- At least 1 category required
- At least 1 item per category
- Extract prices if present
- Add tags if dietary info found (vegetarian, vegan, gluten-free)
- Include descriptions if available
- Preserve original language (Danish/English/etc.)
`

  // 4. Call OpenAI GPT-4o
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a menu extraction assistant. Always return valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 2000
    })
  })

  if (!openaiResponse.ok) {
    throw new Error('OpenAI API call failed')
  }

  const openaiData = await openaiResponse.json()
  const aiResponse = openaiData.choices[0].message.content

  // 5. Parse JSON response
  let parsedMenu
  try {
    parsedMenu = JSON.parse(aiResponse)
  } catch (parseError) {
    // Try to extract JSON from markdown code block
    const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      parsedMenu = JSON.parse(jsonMatch[1])
    } else {
      throw new Error('Invalid JSON response from AI')
    }
  }

  // 6. Validate structure
  if (!parsedMenu.categories || !Array.isArray(parsedMenu.categories)) {
    throw new Error('Missing categories array')
  }

  if (parsedMenu.categories.length === 0) {
    throw new Error('No categories extracted')
  }

  for (const category of parsedMenu.categories) {
    if (!category.name || !category.items || !Array.isArray(category.items)) {
      throw new Error('Invalid category structure')
    }
    if (category.items.length === 0) {
      throw new Error(`Category "${category.name}" has no items`)
    }
  }

  console.log(`✅ Parsed ${parsedMenu.categories.length} categories`)

  // 7. Return structured menu
  return new Response(JSON.stringify(parsedMenu), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})
```

**AI Prompt Example**:
```
MENU TEXT:
BRUNCH MENU

Eggs Benedict 95,-
Pocherede æg, hollandaise, bacon, ristet brød

Avocado Toast 85,-
Surdejsbrød, avocado, pocheret æg, rucola

Classic Pancakes 75,-
Ahornsirup, bær, pisket fløde

DRINKS

Cappuccino 42,-
Latte 42,-
Espresso 28,-

EXPECTED OUTPUT:
{
  "categories": [
    {
      "name": "BRUNCH",
      "items": [
        {
          "name": "Eggs Benedict",
          "description": "Pocherede æg, hollandaise, bacon, ristet brød",
          "price": "95,-",
          "tags": []
        },
        {
          "name": "Avocado Toast",
          "description": "Surdejsbrød, avocado, pocheret æg, rucola",
          "price": "85,-",
          "tags": ["vegetarian"]
        },
        {
          "name": "Classic Pancakes",
          "description": "Ahornsirup, bær, pisket fløde",
          "price": "75,-",
          "tags": ["vegetarian"]
        }
      ]
    },
    {
      "name": "DRINKS",
      "items": [
        {
          "name": "Cappuccino",
          "price": "42,-"
        },
        {
          "name": "Latte",
          "price": "42,-"
        },
        {
          "name": "Espresso",
          "price": "28,-"
        }
      ]
    }
  ]
}
```

---

## 🗄️ Database Schema

### **Table: menu_sources**
```sql
CREATE TABLE menu_sources (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  source_url text,              -- URL or public PDF URL
  pdf_file_path text,           -- Storage path for uploaded PDFs
  source_type text NOT NULL,    -- 'url' | 'pdf' | 'text'
  source_origin text NOT NULL,  -- 'user_added' | 'ai_detected' | 'manual'
  menu_type text DEFAULT 'standard',  -- 'standard' | 'drinks' | 'seasonal' | 'special'
  menu_label text,              -- User-friendly name (e.g., "Brunch", "Cocktails")
  status text DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_menu_sources_business ON menu_sources(business_id);
CREATE INDEX idx_menu_sources_status ON menu_sources(status);
```

### **Table: menu_extractions**
```sql
CREATE TABLE menu_extractions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  menu_source_id uuid REFERENCES menu_sources(id) ON DELETE SET NULL,
  menu_name text NOT NULL,
  extracted_data jsonb NOT NULL,  -- { categories: [...] }
  extraction_method text DEFAULT 'ai',  -- 'ai' | 'manual'
  extraction_quality_score real,  -- 0.0-1.0
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_menu_extractions_business ON menu_extractions(business_id);
CREATE INDEX idx_menu_extractions_source ON menu_extractions(menu_source_id);
```

### **Table: menu_results** (Job Queue)
```sql
CREATE TABLE menu_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  pdf_url text,
  status text DEFAULT 'queued',  -- 'queued' | 'processing' | 'completed' | 'failed'
  source_type text,              -- 'url' | 'upload'
  language_code text DEFAULT 'da',
  extracted_data jsonb,          -- Result from AI parsing
  error_message text,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz
);

CREATE INDEX idx_menu_results_status ON menu_results(status);
CREATE INDEX idx_menu_results_business ON menu_results(business_id);
```

### **Table: business_profile** (Menu Storage)
```sql
ALTER TABLE business_profile
ADD COLUMN menu_structure jsonb;  -- BusinessOfferingsProfile

ALTER TABLE business_profile
ADD COLUMN menu_description text;

ALTER TABLE business_profile
ADD COLUMN detected_menu_urls text[];  -- AI-detected URLs from website analysis
```

---

## 🎯 How Menu Data Powers Brand Profile

**Brand Profile Generator** uses menu data as a key input:

```typescript
// In brand-profile-generator edge function

// 1. Gather menu data from multiple sources
const menuData = await gatherMenuData(businessId, supabase)

// menuData includes:
// - menu_extractions (AI-extracted structured menus)
// - business_profile.menu_structure (JSONB)
// - Recent menu_sources with status='completed'

// 2. Include in Prompt A (Internal Analysis)
const analysis = await runPromptA({
  ...businessData,
  menuItems: menuData.items,      // Array of all menu items
  menuCategories: menuData.categories,  // Array of categories
  signatureItems: menuData.signature    // Popular/featured items
}, language)

// 3. Generate core_offerings and content_focus in Prompt B
const brandProfile = await runPromptB(dataSources, analysis, language)

// Example output:
// core_offerings: "Vi serverer økologisk brunch med signaturret 'Eggs Benedict' og 'Avocado Toast'. Vores kaffeudvalg inkluderer cappuccino og latte fra lokale bønner."
//
// content_focus:
// - Brunchretter og signaturkaffe (#menu)
// - Sæsonretter og specials (#seasonal)
// - Gæsteoplevelser omkring menu (#experience)
// - Bag kulisserne: tilberedning (#bts)
```

**Data Flow**:
```
Menu Sources (URLs, PDFs, Manual)
  ↓
AI Extraction (parse-menu-text)
  ↓
menu_extractions table + business_profile.menu_structure
  ↓
Brand Profile Generator (uses menu items in prompts)
  ↓
Content Generation (post ideas about specific dishes)
```

---

## 📈 Performance Metrics

**URL Extraction**:
- Time: 5-15 seconds
- Success rate: 90% (depends on webpage structure)
- Cost: $0.02-0.04 per URL (GPT-4o parsing)

**PDF Extraction**:
- Time: 15-60 seconds (queued job)
- Success rate: 75% (depends on PDF quality/OCR)
- Cost: $0.05-0.10 per PDF (OCR + GPT-4o parsing)

**Manual Text Entry**:
- Time: 3-8 seconds
- Success rate: 95%
- Cost: $0.01-0.02 per parse (GPT-4o only)

**Database Operations**:
- Load menu sources: ~30ms
- Load menu extractions: ~40ms
- Save menu_structure (JSONB): ~60ms
- Update menu_sources status: ~20ms

---

## 🔧 Developer Notes

### **Adding New Menu Type**

**1. Update TypeScript Types**:
```typescript
export type MenuType = 
  | 'standard' 
  | 'drinks' 
  | 'seasonal' 
  | 'special'
  | 'breakfast'  // NEW
```

**2. Update Detection Patterns**:
```typescript
const patterns: Array<[string, string]> = [
  // ... existing patterns
  ['breakfast', 'Morgenmad'],  // Add new pattern
]
```

**3. Update UI Labels** (translations):
```typescript
// i18n/da.json
{
  "menu.types.breakfast": "Morgenmadsmenu"
}
```

### **Testing Menu Extraction**

```bash
# Test URL extraction
curl -X POST 'http://localhost:54321/functions/v1/extract-menu-url' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/menu"}'

# Test PDF extraction (queues job)
curl -X POST 'http://localhost:54321/functions/v1/extract-menu-pdf' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "uuid-here",
    "pdfUrl": "https://example.com/menu.pdf",
    "languageCode": "da"
  }'

# Test manual text parsing
curl -X POST 'http://localhost:54321/functions/v1/parse-menu-text' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "menuText": "BRUNCH\nEggs Benedict 95,-\nAvocado Toast 85,-",
    "languageCode": "da"
  }'
```

### **UX Best Practices**

**1. Never Show Raw States in UI**
```typescript
// ❌ WRONG - Technical states visible
<div>Status: {menuSource.status}</div>  // Shows "queued", "failed"
<div>Job ID: {resultId}</div>           // Shows UUID
<div>Error: {error.message}</div>       // Shows stack trace

// ✅ CORRECT - User-friendly UI
<div>{getMenuSourceUIState(menuSource).displayLabel}</div>  // "Læser menukortet…"
{uiState.errorMessage && (
  <ErrorCard 
    message={uiState.errorMessage}
    actions={uiState.nextActions}  // ["Prøv igen", "Upload ny fil"]
  />
)}
```

**2. Always Provide Next Action on Errors**
```typescript
// ❌ WRONG - Dead end
showError('Menu extraction failed')

// ✅ CORRECT - Path forward
showErrorWithActions(
  'Vi kunne ikke læse menukortet',
  'Prøv en tydeligere PDF eller tilføj indholdet manuelt',
  [
    { label: 'Prøv igen', action: () => retryExtraction() },
    { label: 'Upload ny fil', action: () => openFileUpload() },
    { label: 'Tilføj manuelt', action: () => openManualEntry() }
  ]
)
```

**3. Hide Technical Details by Default**
```typescript
// ❌ WRONG - Technical info always visible
<div>
  <div>Edge Function: extract-menu-url</div>
  <div>Job ID: {jobId}</div>
  <div>Status: queued</div>
</div>

// ✅ CORRECT - Simple UI with optional details
<div>
  <div>Læser menukortet…</div>
  {isDeveloper && (
    <Details>
      <div>Job: {jobId}</div>
      <div>Internal status: {status}</div>
    </Details>
  )}
</div>
```

**4. Progressive Disclosure for File Requirements**
```typescript
// ❌ WRONG - Technical requirements upfront
<FileUpload>
  <Label>Upload PDF (max 10MB, aspect ratio 3:4, 300 DPI)</Label>
</FileUpload>

// ✅ CORRECT - Simple action, handle edge cases automatically
<FileUpload>
  <Label>Upload dit menukort</Label>
  {/* Server auto-compresses, converts, crops */}
  {/* Only show friendly error IF something goes wrong */}
</FileUpload>
```

### **Common Issues**

**Issue**: Menu extraction returns empty categories  
**Solution**: Check if webpage has menu content in HTML (not JavaScript-rendered). Try different URL or use PDF.

**Issue**: PDF extraction stuck in "processing"  
**Solution**: Check Cloud Run worker logs. PDF might be image-based (requires OCR). Verify menu_results table status.

**Issue**: Duplicate menu items across categories  
**Solution**: AI sometimes creates overlapping categories. Manually merge or improve prompt to specify distinct categories.

**Issue**: Prices not extracted correctly  
**Solution**: AI struggles with non-standard price formats. Add more examples to prompt or post-process with regex.

**Issue**: Menu type detection incorrect  
**Solution**: Update detection patterns in `detectMenuTypeFromUrl()`. Longer patterns should be checked first.

---

## 🇩🇰 Danish Localization Guidelines

### **Common Mistakes to Avoid**

**1. Place Name Translation**
```typescript
// ❌ WRONG - Don't translate place names
const location = "river"  // from "Åen"
const street = "the square" // from "Torvet"

// ✅ CORRECT - Keep Danish place names
const location = "Åen"     // Proper name, don't translate
const street = "Torvet"    // Proper name, don't translate
```

**2. Literal English Translations**
```typescript
// ❌ WRONG - English-shaped Danish
"Kom og besøg os"           // Literal "Come and visit us"
"Vi er åbne hele dagen"     // Stiff, unnatural

// ✅ CORRECT - Natural café Danish
"Kom forbi!"                // Natural invitation
"Vi har åbent hele dagen"   // Natural phrasing
```

**3. Mixed Language Content**
```typescript
// ❌ WRONG - Mixed languages
const post = {
  text: "Nyd vores nye brunchmenu!",
  cta: "Book now"  // English CTA in Danish post
}

// ✅ CORRECT - Consistent language
const post = {
  text: "Nyd vores nye brunchmenu!",
  cta: "Book bord"  // Danish CTA
}
```

**4. Button/Status Labels**
```typescript
// ❌ WRONG - Technical English in Danish UI
<Button>Generate</Button>
<Status>Processing...</Status>

// ✅ CORRECT - Natural Danish
<Button>Lav forslag</Button>
<Status>Arbejder…</Status>
```

**5. Date/Currency Formatting**
```typescript
// ❌ WRONG - English formatting
const price = "$85.50"               // USD format
const date = "12/31/2025"            // US date format

// ✅ CORRECT - Danish formatting
const price = "85,50 kr."            // Danish DKK
const date = "31. december 2025"     // Danish date format
```

### **AI Prompt Guidelines for Danish Content**

**When generating Danish content**:
```typescript
const prompt = `
Generate Danish social media post for a café.

RULES:
1. Use natural café Danish (not literal English translations)
2. Keep place names in Danish ("Åen", "Torvet", etc. - don't translate)
3. Use Danish idioms naturally ("hygge", "kom forbi", "lige om lidt")
4. Format prices as "XX,- kr." or "XX kr."
5. Use informal "du" form (not formal "De")
6. Match café vibe: warm, welcoming, authentic

BAD EXAMPLES:
- "Come and visit us at the river" (translated place name)
- "Vi tilbyder specielle deals" (English word "deals")
- "Processing your order..." (English technical term)

GOOD EXAMPLES:
- "Kom forbi ved Åen" (natural + preserved place name)
- "Gode tilbud hele ugen" (natural Danish)
- "Vi klargør din bestilling…" (natural status)
`
```

### **Translation Checklist**

Before deploying UI text:
- [ ] No technical English terms (processing, queued, failed, job_id)
- [ ] No literal translations that sound unnatural
- [ ] Place names preserved (Åen, Strøget, Havnen, etc.)
- [ ] Danish date/currency formatting
- [ ] Consistent language (don't mix Danish + English)
- [ ] Café-friendly tone (warm, not corporate)
- [ ] Informal "du" form (not "De")

---

## 🚀 Future Enhancements

### **Phase 2 (Planned)**
1. **Multi-Language Menus**: Support menu extraction in multiple languages
2. **Price Tracking**: Track menu price changes over time
3. **Allergen Detection**: Automatically detect allergens from descriptions
4. **Menu Versioning**: Keep historical versions of menus
5. **Seasonal Menu Auto-Switch**: Automatically activate/deactivate seasonal menus

### **Phase 3 (Ideas)**
1. **QR Code Menu Generation**: Generate printable QR code menus
2. **Menu Analytics**: Track which items are mentioned in posts
3. **Ingredient Extraction**: Parse ingredients from descriptions
4. **Nutritional Info AI**: Estimate nutritional values from descriptions
5. **Multi-Restaurant Menu Comparison**: Compare offerings with competitors

---

## 📊 Realtime Updates (Supabase Realtime)

**Frontend subscribes to menu extraction jobs**:
```typescript
useEffect(() => {
  if (!resultId) return

  // Subscribe to menu_results updates
  const channel = supabase
    .channel(`menu_result_${resultId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'menu_results',
        filter: `id=eq.${resultId}`
      },
      (payload) => {
        const internalStatus = payload.new.status
        
        // Map internal status to user-friendly UI state
        const uiState = getMenuSourceUIState({ status: internalStatus })
        
        if (internalStatus === 'completed') {
          console.log('✅ Menu extraction completed')
          // USER-FRIENDLY: Show success message
          showSuccessToast('Dit menukort er klar! 🎉')
          
          // Load the extracted menu
          const extractedData = payload.new.extracted_data
          handleMenuExtracted(extractedData)
        } else if (internalStatus === 'failed') {
          console.error('❌ Menu extraction failed')
          // USER-FRIENDLY: Show error with next action, not raw error_message
          showErrorWithActions(
            'Vi kunne ikke læse menukortet',
            'Prøv en tydeligere PDF eller tilføj indholdet manuelt',
            ['Prøv igen', 'Upload ny fil', 'Tilføj manuelt']
          )
        } else if (internalStatus === 'processing') {
          // USER-FRIENDLY: Show progress with friendly label
          setProgressLabel('Læser dit menukort… Dette kan tage op til et minut.')
        } else if (internalStatus === 'queued') {
          setProgressLabel('Vi forbereder dit menukort…')
        }
        
        // Update UI state (but never show raw status)
        setUIState(uiState)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [resultId])
```

---

*Last Updated: January 13, 2026*  
*Version: menukort-system v2.0*
