# Business Profile Generation Flow

Complete journey from user entering their business information to fully populated business profile in database.

---

## 📊 Overview

The Business Profile is the **foundational data layer** for all AI operations:
- Powers Brand Profile generation (AI prompts use business data)
- Enables content generation (menu items, location, hours)
- Provides context for post ideas and scheduling

**Timeline**: 30 seconds (manual) or 15-30 seconds (AI-assisted website analysis)  
**Data Sources**: Manual entry + optional website analysis  
**Storage**: Multiple tables (`businesses`, `business_profile`, `business_locations`, `opening_hours`)

---

## 🔄 Complete Flow Diagram

```
USER NAVIGATES TO "Virksomhedsprofil"
  ↓
Frontend: BusinessProfilePage.tsx
  ↓
[1] Load Existing Profile (if available)
  ├─ businesses table (name, category, website, sector)
  ├─ business_profile table (descriptions, menu_structure, URLs)
  ├─ business_locations table (address, contact info)
  ├─ opening_hours table (weekly schedule)
  └─ business_brand_profile table (brand voice, CTA preference)
  ↓
[2] USER CHOOSES ONE OF TWO PATHS:
  ├─ Path A: Manual Entry (30 sec)
  │   ├─ Fill business name, category, location
  │   ├─ Add description (kort/lang)
  │   ├─ Set opening hours
  │   └─ Click "Gem" → Save to database
  │
  └─ Path B: AI Website Analysis (15-30 sec)
      ├─ Enter website URL
      ├─ Click "Analysér website"
      ├─ Call Edge Function: analyze-website
      ├─ AI extracts data from website
      ├─ Smart merge with existing data
      └─ User confirms/edits → Click "Gem"
  ↓
[3] Save Profile Data (Transaction)
  ├─ Update businesses table
  ├─ Upsert business_profile table
  ├─ Upsert business_locations table
  ├─ Batch upsert opening_hours table (7 rows)
  └─ Update business_brand_profile table
  ↓
[4] Profile Ready for Brand Profile Generation
  └─ Data available for brand-profile-generator edge function
```

---

## 📂 Frontend Flow

### **File**: `src/pages/dashboard/BusinessProfilePage.tsx`

### **Step 1: Load Existing Profile**

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

    // 2. Load business_profile
    const { data: profileData } = await supabase
      .from('business_profile')
      .select('*')
      .eq('business_id', businessData.id)
      .maybeSingle()

    // 3. Load primary location
    const { data: locationData } = await supabase
      .from('business_locations')
      .select('*')
      .eq('business_id', businessData.id)
      .eq('is_primary', true)
      .maybeSingle()

    // 4. Load opening hours
    const { data: hoursData } = await supabase
      .from('opening_hours')
      .select('*')
      .eq('business_id', businessData.id)
      .eq('kind', 'normal')
      .order('weekday', { ascending: true })

    // 5. Load brand profile (for brand voice, CTA preference)
    const { data: brandData } = await supabase
      .from('business_brand_profile')
      .select('*')
      .eq('business_id', businessData.id)
      .maybeSingle()

    // 6. Parse and populate UI state
    const sector = guessBusinessSector(businessData.category)
    
    // Parse menu structure (JSONB)
    let loadedOfferings = defaultOfferingsForSector(sector)
    if (profileData?.menu_structure) {
      loadedOfferings = typeof profileData.menu_structure === 'string'
        ? JSON.parse(profileData.menu_structure)
        : profileData.menu_structure
    }

    // Parse opening hours
    let loadedHours = createEmptyWeekSchedule()
    if (hoursData && hoursData.length > 0) {
      hoursData.forEach(row => {
        if (row.is_closed) {
          loadedHours[row.weekday].closed = true
        } else {
          loadedHours[row.weekday] = {
            open: row.open_time || '',
            close: row.close_time || '',
            closed: false
          }
        }
      })
    }

    // Populate all form fields
    setBusinessName(businessData.name || '')
    setBusinessSector(sector)
    setBusinessCategory(businessData.category || '')
    setWebsiteUrl(businessData.website_url || '')
    setAboutText(profileData?.long_description || '')
    setPhone(locationData?.phone || '')
    setEmail(locationData?.email || '')
    setAddress(locationData?.address_line1 || '')
    setPostalCode(locationData?.postal_code || '')
    setCity(locationData?.city || '')
    setCountry(locationData?.country || 'Danmark')
    setOpeningHours(loadedHours)
    setBusinessOfferings(loadedOfferings)
    setBrandVoice(brandData?.voice_style || '')
    setCtaPreference(brandData?.cta_preference || '')
    // ... more fields

    setAnalysisComplete(Boolean(businessData.name))
    setIsLoadingProfile(false)
  }

  fetchProfile()
}, [])
```

**Loaded Data Structure**:
```typescript
interface ProfileFormState {
  // Basic Info
  businessName: string
  businessSector: BusinessSector | null  // 'hospitality' | 'beauty' | 'wellness' | 'retail'
  businessCategory: string  // 'cafe', 'restaurant', 'salon', etc.
  websiteUrl: string
  
  // Descriptions
  aboutText: string  // Long description for "Om forretningen"
  
  // Contact
  phone: string
  email: string
  address: string
  postalCode: string
  city: string
  country: string
  
  // Operating Hours
  openingHours: WeekSchedule  // { monday: { open: '09:00', close: '17:00' }, ... }
  
  // Offerings (Menu/Services)
  businessOfferings: BusinessOfferingsProfile  // { categories: [...] }
  menuDescription: string
  
  // Brand Settings
  brandVoice: string
  targetAudience: string
  bookingLink: string
  ctaPreference: string
  
  // Metadata
  keywords: string[]
  hasBookingButton: boolean
  aboutUsUrl: string
  openingHoursUrl: string
}
```

---

### **Step 2A: Manual Entry Path**

**User Actions**:
1. Fill out form fields in accordion panels:
   - Grundoplysninger (Basic Info)
   - Om forretningen (About)
   - Kontaktoplysninger (Contact)
   - Åbningstider (Opening Hours)
   - Tilbud & Menu (Offerings)

2. Click "Gem" button

**Form Validation**:
- Business name required
- Valid postal code (4 digits for Denmark)
- Valid phone/email format
- At least one time slot or "closed" for each weekday

---

### **Step 2B: AI Website Analysis Path**

**User Actions**:
1. Enter website URL in input field
2. Click "Analysér website" button
3. Wait 15-30 seconds for analysis
4. Review auto-populated fields
5. Edit/confirm data
6. Click "Gem"

**Code Path**:
```typescript
const handleWebsiteAnalysis = async () => {
  // 1. Check tier access (free tier has limited analysis)
  if (currentTier === 'free') {
    alert('Website analyse er tilgængelig fra Smart tier og opefter.')
    return
  }

  setIsAnalyzing(true)

  // 2. Get auth token
  const { data: { session } } = await supabase.auth.getSession()
  const authToken = session?.access_token

  // 3. Ensure businessId is available
  let effectiveBusinessId = businessId || undefined
  if (!effectiveBusinessId && session?.user?.id) {
    const { data: b } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', session.user.id)
      .maybeSingle()
    
    if (b?.id) {
      effectiveBusinessId = b.id
      setBusinessId(b.id)
    }
  }

  // 4. Call AI analysis service
  const { analyzeBusinessProfile } = await import('../../features/BusinessProfilerAI')
  
  const analysis = await analyzeBusinessProfile({
    url: websiteUrl,
    businessName: businessName || undefined,
    businessType: businessCategory || undefined,
    tier: currentTier,
    authToken,
    businessId: effectiveBusinessId
  })

  if (analysis.error) {
    console.error('Website analysis error:', analysis.error)
    setAnalysisComplete(true)
    setIsAnalyzing(false)
    return
  }

  // 5. Smart merge: Only populate EMPTY fields
  if (!businessName && analysis.businessName) {
    setBusinessName(analysis.businessName)
  }
  
  if (!businessCategory && analysis.businessType) {
    setBusinessCategory(analysis.businessType)
    const sector = guessBusinessSector(analysis.businessType)
    setBusinessSector(sector)
  }
  
  if (!aboutText && analysis.description) {
    setAboutText(analysis.description)
  }
  
  // Contact info
  if (analysis.contact) {
    if (!phone && analysis.contact.phone) setPhone(analysis.contact.phone)
    if (!email && analysis.contact.email) setEmail(analysis.contact.email)
    
    if (typeof analysis.contact.address === 'object') {
      if (!address && analysis.contact.address.street) {
        setAddress(analysis.contact.address.street)
      }
      if (!city && analysis.contact.address.city) {
        setCity(analysis.contact.address.city)
      }
      if (!postalCode && analysis.contact.address.postalCode) {
        setPostalCode(analysis.contact.address.postalCode)
      }
    }
  }
  
  // Opening hours (only if all days are empty)
  if (analysis.openingHours) {
    const allEmpty = Object.values(openingHours).every(
      day => !day.open && !day.close && !day.closed
    )
    
    if (allEmpty) {
      const newHours = { ...openingHours }
      Object.entries(analysis.openingHours).forEach(([day, hours]) => {
        if (hours.closed) {
          newHours[day] = { open: '', close: '', closed: true }
        } else {
          newHours[day] = {
            open: hours.open || '',
            close: hours.close || '',
            closed: false
          }
        }
      })
      setOpeningHours(newHours)
    }
  }
  
  // Business offerings (menu structure)
  if (analysis.offeringsProfile && analysis.offeringsProfile.categories.length > 0) {
    const currentHasItems = businessOfferings.categories.some(
      cat => cat.items.length > 0
    )
    
    if (!currentHasItems) {
      setBusinessOfferings(analysis.offeringsProfile)
    }
  }
  
  // Detected menu URLs (for user confirmation in "Menukort" tab)
  if (analysis.detectedMenuUrls && analysis.detectedMenuUrls.length > 0) {
    setDetectedMenuUrls(analysis.detectedMenuUrls)
  }
  
  // Mark all populated fields as having changes
  markUnsaved()
  setAnalysisComplete(true)
  setIsAnalyzing(false)
}
```

**What AI Extracts**:
- Business name (from meta title, hero text, header)
- Business type/category (cafe, restaurant, salon, etc.)
- Description (from hero section, about page)
- Contact info (phone, email, address)
- Opening hours (from structured data, dedicated page)
- Menu structure (categories + items)
- Menu URLs (for user to confirm in "Menukort" tab)
- Keywords (for SEO/content)

---

### **Step 3: Save Profile**

**Triggered by**: User clicks "Gem" button

**Code Path**:
```typescript
const handleSaveProfile = async () => {
  if (!businessId) {
    console.error('No businessId available')
    return
  }

  const profileData: ProfileData = {
    businessId,
    websiteUrl,
    businessName,
    businessSector,
    businessCategory,
    aboutText,
    brandVoice,
    targetAudience,
    bookingLink,
    ctaPreference,
    menuDescription,
    phone,
    email,
    address,
    postalCode,
    city,
    country,
    openingHours,
    keywords,
    businessOfferings,
    hasBookingButton,
    aboutUsUrl,
    openingHoursUrl
  }

  const result = await saveBusinessProfile(profileData, supabase)

  if (result.success) {
    // Update saved snapshot for change tracking
    syncSavedSnapshot(buildStateSnapshot())
    setHasUnsavedChanges(false)
    setJustSaved(true)
    
    // Clear "just saved" indicator after 3 seconds
    setTimeout(() => setJustSaved(false), 3000)
  } else {
    alert(`Fejl ved gemning: ${result.error}`)
  }
}
```

**Database Transaction** (`profileService.ts`):
```typescript
export async function saveBusinessProfile(
  data: ProfileData,
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Update businesses table
    const { error: businessError } = await supabase
      .from('businesses')
      .update({
        name: data.businessName,
        category: data.businessCategory,
        vertical: data.businessSector,
        website_url: data.websiteUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.businessId)

    if (businessError) throw businessError

    // 2. Upsert business_profile (descriptions, menu structure)
    const { error: profileError } = await supabase
      .from('business_profile')
      .upsert({
        business_id: data.businessId,
        long_description: data.aboutText,
        target_audience: data.targetAudience,
        menu_description: data.menuDescription,
        menu_structure: data.businessOfferings,  // JSONB
        about_us_url: data.aboutUsUrl,
        opening_hours_url: data.openingHoursUrl,
        updated_at: new Date().toISOString()
      }, { onConflict: 'business_id' })

    if (profileError) throw profileError

    // 3. Upsert business_locations (contact + address)
    const { error: locationError } = await supabase
      .from('business_locations')
      .upsert({
        business_id: data.businessId,
        is_primary: true,
        phone: data.phone,
        email: data.email,
        address_line1: data.address,
        postal_code: data.postalCode,
        city: data.city,
        country: data.country,
        updated_at: new Date().toISOString()
      }, { onConflict: 'business_id,is_primary' })

    if (locationError) throw locationError

    // 4. Batch upsert opening_hours (7 rows, one per weekday)
    const hoursRows = Object.entries(data.openingHours).map(([weekday, hours]) => ({
      business_id: data.businessId,
      weekday,
      kind: 'normal',
      open_time: hours.closed ? null : hours.open || null,
      close_time: hours.closed ? null : hours.close || null,
      is_closed: hours.closed || false
    }))

    const { error: hoursError } = await supabase
      .from('opening_hours')
      .upsert(hoursRows, { onConflict: 'business_id,weekday,kind' })

    if (hoursError) throw hoursError

    // 5. Upsert business_brand_profile (brand voice, CTA)
    const { error: brandError } = await supabase
      .from('business_brand_profile')
      .upsert({
        business_id: data.businessId,
        voice_style: data.brandVoice,
        cta_preference: data.ctaPreference,
        booking_link: data.bookingLink,
        updated_at: new Date().toISOString()
      }, { onConflict: 'business_id' })

    if (brandError) throw brandError

    return { success: true }
  } catch (error) {
    console.error('Save profile error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
```

---

## 🔧 Edge Function: Website Analysis

### **File**: `supabase/functions/analyze-website/index.ts`

### **Step 1: Request Handling**

```typescript
serve(async (req: Request) => {
  const { url, businessName, businessType, tier, debugMode, businessId } = await req.json()

  if (!url || typeof url !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Missing required field: url' }),
      { status: 400 }
    )
  }

  // Determine AI model based on tier
  const aiModel = getAIModel(tier)  // 'gpt-4o' for all tiers now
  
  // Tier-based analysis configuration
  const config = getTierConfig(tier)
  // free: 1 priority page, 140KB content
  // standardplus: 3 pages, 150KB, PDF parsing, AI link classification
  // premium: 5 pages, 200KB, full analysis
  
  console.log('🤖 Using AI model:', aiModel, '(tier:', tier || 'free', ')')
```

### **Step 2: Fetch & Parse Website**

```typescript
// 1. Fetch homepage
const homepageResponse = await fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 ...' }
})
const homepageHtml = await homepageResponse.text()

// 2. Parse HTML structure
const cleanText = htmlToCleanText(homepageHtml)
const metadata = extractMetadata(homepageHtml)
const structuredData = extractStructuredData(homepageHtml)

// 3. Extract links from homepage
const links = extractLinksFromHTML(homepageHtml, url)

// 4. Classify links using AI (if tier allows)
let priorityPages: PriorityPage[] = []
if (config.allowAiLinkClassification) {
  priorityPages = await classifyLinksWithAI(links, aiModel, config.maxPriorityPages)
} else {
  // Fallback: rule-based classification
  priorityPages = classifyLinksRuleBased(links, config.maxPriorityPages)
}

// 5. Fetch priority pages
for (const page of priorityPages) {
  const pageResponse = await fetch(page.url, { headers: { 'User-Agent': '...' } })
  const pageHtml = await pageResponse.text()
  page.content = htmlToCleanText(pageHtml)
}

// 6. Parse PDFs if tier allows
let pdfContent = ''
if (config.allowPdfParsing) {
  const menuPdfs = links.filter(link => 
    link.text.toLowerCase().includes('menu') && 
    link.url.endsWith('.pdf')
  )
  
  for (const pdf of menuPdfs.slice(0, 2)) {
    const pdfText = await extractTextFromPdf(pdf.url)
    pdfContent += `\n\n=== PDF: ${pdf.text} ===\n${pdfText}`
  }
}
```

### **Step 3: AI Extraction (Multiple Specialized Extractors)**

```typescript
// Run AI extractors in parallel
const [
  basicInfo,
  contactInfo,
  openingHoursInfo,
  menuInfo,
  keywordsInfo,
  venueHooks,
  experiencePillars
] = await Promise.all([
  extractBasicInfo(cleanText, metadata, aiModel),
  extractContact(cleanText, priorityPages, aiModel),
  extractOpeningHours(cleanText, priorityPages, structuredData, aiModel),
  extractMenu(cleanText, priorityPages, pdfContent, aiModel),
  extractKeywords(cleanText, metadata, aiModel),
  extractVenueHooks(cleanText, priorityPages, aiModel),
  extractExperiencePillars(cleanText, priorityPages, aiModel)
])

// Combine results
const analysis = {
  url,
  businessName: basicInfo.name || businessName,
  businessType: basicInfo.type || businessType,
  description: basicInfo.description,
  shortDescription: basicInfo.shortDescription,
  contact: contactInfo,
  openingHours: openingHoursInfo,
  offerings: {
    menuStructure: menuInfo.menuStructure,
    categories: menuInfo.categories,
    signatureItems: menuInfo.signatureItems,
    dietaryOptions: menuInfo.dietaryOptions
  },
  keywords: keywordsInfo.keywords,
  detectedMenuUrls: menuInfo.detectedUrls,
  businessSector: guessBusinessSector(basicInfo.type),
  offeringsProfile: convertToOfferingsProfile(menuInfo)
}

// 7. Save to database if businessId provided
if (businessId) {
  await supabase
    .from('website_analyses')
    .upsert({
      business_id: businessId,
      url,
      analyzed_at: new Date().toISOString(),
      analysis_result: analysis,
      // ... metadata
    }, { onConflict: 'business_id' })
}

return new Response(JSON.stringify(analysis), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
})
```

---

## 📊 AI Extractors (Specialized Prompts)

### **1. Basic Info Extractor** (`_shared/ai-extractors/basic-info-extractor.ts`)

**Prompt**:
```
Extract business name, type, and description from this website content.

CONTENT:
{cleanText}

METADATA:
Title: {metadata.title}
Description: {metadata.description}

Return JSON:
{
  "name": "Business Name",
  "type": "cafe|restaurant|salon|spa|shop|other",
  "description": "2-3 sentence description",
  "shortDescription": "1 sentence homepage about text"
}
```

### **2. Contact Extractor** (`_shared/ai-extractors/contact-extractor.ts`)

**Prompt**:
```
Extract contact information from website content.

HOMEPAGE:
{homepageText}

CONTACT PAGE:
{contactPageText}

Return JSON:
{
  "phone": "+45 12 34 56 78",
  "email": "info@business.dk",
  "address": {
    "street": "Main Street 123",
    "city": "Copenhagen",
    "postalCode": "1000",
    "country": "Denmark"
  }
}
```

### **3. Opening Hours Extractor** (`_shared/opening-hours-extractor.ts`)

**Logic**:
1. Try structured data (schema.org) first
2. Fall back to AI extraction from text
3. Parse natural language patterns ("Mon-Fri: 9-17", "Weekend: Closed")

**AI Prompt** (fallback):
```
Extract opening hours from this content.

CONTENT:
{relevantText}

Return JSON with days of week (monday-sunday):
{
  "monday": { "open": "09:00", "close": "17:00" },
  "saturday": { "closed": true },
  ...
}
```

### **4. Menu Extractor** (`_shared/ai-extractors/menu-extractor.ts`)

**Prompt**:
```
Extract menu/service offerings from this content.

HOMEPAGE:
{homepageText}

MENU PAGE:
{menuPageText}

PDF CONTENT:
{pdfContent}

Return JSON:
{
  "menuStructure": [
    {
      "name": "BRUNCH",
      "timeRange": "09:00-14:00",
      "items": ["Eggs Benedict", "Avocado Toast", ...]
    }
  ],
  "categories": ["BRUNCH", "LUNCH", "COFFEE"],
  "signatureItems": ["House Blend Coffee", "Signature Burger"],
  "dietaryOptions": ["Vegetarian", "Vegan", "Gluten-free"],
  "detectedUrls": ["https://site.com/menu.pdf"]
}
```

### **5. Keywords Extractor** (`_shared/ai-extractors/keywords-extractor.ts`)

**Prompt**:
```
Extract 5-10 keywords that describe this business.

CONTENT:
{cleanText}

METADATA:
{metadata.keywords}

Return JSON:
{
  "keywords": ["organic", "brunch", "cozy", "local", "artisan"]
}
```

---

## 🗄️ Database Schema

### **Table: businesses**
```sql
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,  -- 'cafe', 'restaurant', 'salon', etc.
  vertical text,  -- Business sector: 'hospitality', 'beauty', etc.
  website_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### **Table: business_profile**
```sql
CREATE TABLE business_profile (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  short_description text,
  long_description text,
  target_audience text,
  menu_description text,
  menu_structure jsonb,  -- BusinessOfferingsProfile
  about_us_url text,
  opening_hours_url text,
  detected_menu_urls text[],
  updated_at timestamptz DEFAULT now()
);
```

### **Table: business_locations**
```sql
CREATE TABLE business_locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  phone text,
  email text,
  address_line1 text,
  postal_code text,
  city text,
  country text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, is_primary)
);
```

### **Table: opening_hours**
```sql
CREATE TABLE opening_hours (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  weekday text NOT NULL,  -- 'monday', 'tuesday', ...
  kind text DEFAULT 'normal',  -- 'normal', 'holiday', 'special'
  open_time text,
  close_time text,
  is_closed boolean DEFAULT false,
  UNIQUE(business_id, weekday, kind)
);
```

### **Table: business_brand_profile**
```sql
CREATE TABLE business_brand_profile (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  voice_style text,
  cta_preference text,
  booking_link text,
  brand_essence text,
  tone_of_voice text,
  target_audience text,
  core_offerings text,
  content_focus text,
  -- ... all Brand Profile fields
  updated_at timestamptz DEFAULT now()
);
```

---

## 🎯 How Business Profile Powers Brand Profile

**Brand Profile Generator** uses Business Profile data as input:

```typescript
// In brand-profile-generator edge function

// 1. Gather data sources
const dataSources = await gatherDataSources(businessId, supabase)

// dataSources includes:
// - businesses.name, category, website_url
// - business_profile.long_description, menu_structure
// - business_locations.city, address
// - opening_hours (weekly schedule)
// - menu_extractions (alternative source)

// 2. Pass to AI for analysis (Prompt A)
const analysis = await runPromptA(dataSources, language)

// 3. Generate brand profile (Prompt B)
const brandProfile = await runPromptB(dataSources, analysis, language)

// 4. Save to business_brand_profile table
await saveBrandProfile(businessId, brandProfile, supabase)
```

**Data Flow**:
```
Business Profile (User Input + AI Analysis)
  ↓
Brand Profile Generator (AI Prompts)
  ↓
Brand Profile (AI-Generated Guidelines)
  ↓
Content Generation (Post Ideas, Captions)
```

---

## ⚙️ Tier-Based Features

### **Free Tier**
- **Manual Entry**: Full access
- **Website Analysis**: Homepage + 1 priority page (140KB content)
- **AI Model**: GPT-4o (upgraded for better extraction)
- **PDF Parsing**: Not available
- **AI Link Classification**: Not available

### **Smart/Standard Plus Tier**
- **Manual Entry**: Full access
- **Website Analysis**: Homepage + 3 priority pages (150KB content)
- **AI Model**: GPT-4o
- **PDF Parsing**: Menu PDFs only (up to 2)
- **AI Link Classification**: Yes (better page detection)

### **Premium Tier**
- **Manual Entry**: Full access
- **Website Analysis**: Homepage + 5 priority pages (200KB content)
- **AI Model**: GPT-4o
- **PDF Parsing**: All PDFs (up to 5)
- **AI Link Classification**: Yes
- **Advanced Extractors**: Venue hooks, experience pillars

---

## 🔧 Developer Notes

### **Adding New Profile Fields**

**1. Update Database Schema**:
```sql
ALTER TABLE business_profile
ADD COLUMN new_field TEXT;
```

**2. Update Frontend State** (`BusinessProfilePage.tsx`):
```typescript
interface ProfileFormState {
  // ... existing fields
  newField: string
}

const [newField, setNewField] = useState('')
```

**3. Update Save Function** (`profileService.ts`):
```typescript
const { error: profileError } = await supabase
  .from('business_profile')
  .upsert({
    // ... existing fields
    new_field: data.newField
  }, { onConflict: 'business_id' })
```

**4. Add UI Input** (BusinessProfilePage.tsx):
```tsx
<input
  value={newField}
  onChange={(e) => {
    setNewField(e.target.value)
    markUnsaved()
  }}
/>
```

### **Testing Website Analysis**

```bash
# Local test with curl
curl -X POST 'http://localhost:54321/functions/v1/analyze-website' \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "tier": "premium",
    "debugMode": true
  }'
```

### **Common Issues**

**Issue**: Opening hours not parsing correctly  
**Solution**: Check structured data first, then AI extraction. Add fallback patterns.

**Issue**: Menu structure empty after save  
**Solution**: Verify JSONB column accepts nested arrays. Check JSON.stringify() format.

**Issue**: City not auto-populating from postal code  
**Solution**: Ensure country is "Danmark" (exact match). Check Danish postal API response.

**Issue**: Website analysis timeout  
**Solution**: Reduce maxPriorityPages or maxContentChars. Skip PDF parsing for large sites.

---

## 📈 Performance Metrics

**Manual Entry**:
- Time: 30 seconds (minimal) to 3 minutes (complete)
- Database writes: 5 tables
- No API costs

**AI Website Analysis**:
- Time: 15-30 seconds
- API calls: 5-7 GPT-4o requests in parallel
- Cost per analysis: $0.03-0.08 (depending on tier and content size)
- Success rate: 85% (full extraction), 95% (partial extraction)

**Database Operations**:
- Read profile: ~50ms (5 tables joined)
- Save profile: ~100ms (5 table upserts)
- Website analysis save: ~150ms (includes JSONB serialization)

---

## 🚀 Future Enhancements

### **Phase 2 (Planned)**
1. **Competitor Analysis**: Compare offerings with nearby businesses
2. **Image Upload**: Allow users to upload business photos during setup
3. **Bulk Import**: CSV import for multi-location businesses
4. **Profile Completeness Score**: Gamification to encourage full profiles

### **Phase 3 (Ideas)**
1. **Google Business Profile Integration**: Auto-sync with Google My Business
2. **Social Media Import**: Pull description from Instagram/Facebook bio
3. **Multi-Language Profiles**: Support multiple language versions
4. **Historical Tracking**: Track profile changes over time

---

*Last Updated: January 13, 2026*  
*Version: business-profile v2.1*
