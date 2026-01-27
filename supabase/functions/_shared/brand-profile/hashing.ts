/**
 * Hashing utilities for Brand Profile change detection
 * 
 * Computes stable content hashes to detect when source data changes,
 * avoiding unnecessary AI regenerations.
 */

/**
 * Canonical JSON stringify with sorted keys
 * Ensures consistent hash for same content regardless of key order
 */
function canonicalStringify(obj: any): string {
  if (obj === null || obj === undefined) {
    return 'null'
  }
  
  if (typeof obj !== 'object') {
    return JSON.stringify(obj)
  }
  
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']'
  }
  
  const sortedKeys = Object.keys(obj).sort()
  const pairs = sortedKeys.map(key => {
    return JSON.stringify(key) + ':' + canonicalStringify(obj[key])
  })
  
  return '{' + pairs.join(',') + '}'
}

/**
 * Compute SHA-256 hash of any object
 */
async function computeHash(data: any): Promise<string> {
  const canonical = canonicalStringify(data)
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(canonical)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Compute content hashes for all Brand Profile sources
 */
export async function computeSourceHashes(dataSources: {
  business?: any
  website?: any
  location?: any
  images?: any
  menu?: any
}): Promise<{
  business_snapshot_hash: string | null
  profile_hash: string | null
  website_hash: string | null
  location_hash: string | null
  images_hash: string | null
  menu_hash: string | null
}> {
  
  // Business snapshot (profile columns from businesses table)
  const businessSnapshot = dataSources.business ? {
    name: dataSources.business.name,
    description: dataSources.business.description,
    venue_type: dataSources.business.venue_type,
    primary_language: dataSources.business.primary_language,
    country: dataSources.business.country
  } : null
  
  // Profile (user-written profile text)
  const profile = dataSources.business?.profile || null
  
  // Website analysis (full analysis JSON)
  const website = dataSources.website || null
  
  // Location enrichment (macro/micro context)
  const location = dataSources.location?.enrichment || null
  
  // Images (uploaded images with labels)
  const images = dataSources.images?.map((img: any) => ({
    url: img.url,
    labels: img.labels,
    description: img.description
  })) || null
  
  // Menu (items from menu_extractions)
  // Use STRUCTURAL hash - only categories and item names, not prices
  const menu = dataSources.menu ? {
    categories: dataSources.menu.map((item: any) => item.category).filter(Boolean),
    items: dataSources.menu.map((item: any) => ({
      name: item.name,
      category: item.category
    }))
  } : null
  
  return {
    business_snapshot_hash: businessSnapshot ? await computeHash(businessSnapshot) : null,
    profile_hash: profile ? await computeHash(profile) : null,
    website_hash: website ? await computeHash(website) : null,
    location_hash: location ? await computeHash(location) : null,
    images_hash: images ? await computeHash(images) : null,
    menu_hash: menu ? await computeHash(menu) : null
  }
}

/**
 * Compute combined version hash from all source hashes
 */
export async function computeVersionHash(sourceHashes: {
  business_snapshot_hash: string | null
  profile_hash: string | null
  website_hash: string | null
  location_hash: string | null
  images_hash: string | null
  menu_hash: string | null
}): Promise<string> {
  // Combine all hashes in stable order
  const combined = [
    sourceHashes.business_snapshot_hash || '',
    sourceHashes.profile_hash || '',
    sourceHashes.website_hash || '',
    sourceHashes.location_hash || '',
    sourceHashes.images_hash || '',
    sourceHashes.menu_hash || ''
  ].join('|')
  
  return await computeHash(combined)
}

/**
 * Check if Brand Profile needs regeneration
 * Returns true if any source hash has changed
 */
export async function shouldRegenerateProfile(
  supabase: any,
  businessId: string,
  newHashes: {
    business_snapshot_hash: string | null
    profile_hash: string | null
    website_hash: string | null
    location_hash: string | null
    images_hash: string | null
    menu_hash: string | null
  },
  newVersionHash: string
): Promise<{
  shouldRegenerate: boolean
  reason?: string
  changedSources: string[]
}> {
  
  // Fetch current hashes from database
  const { data: currentState, error } = await supabase
    .from('brand_profile_sources_state')
    .select('*')
    .eq('business_id', businessId)
    .single()
  
  // No existing state = first time generation
  if (error || !currentState) {
    return {
      shouldRegenerate: true,
      reason: 'First time generation (no existing hash state)',
      changedSources: []
    }
  }
  
  // Check version hash first (fast comparison)
  if (currentState.version_hash === newVersionHash) {
    return {
      shouldRegenerate: false,
      reason: 'Version hash unchanged',
      changedSources: []
    }
  }
  
  // Identify which sources changed
  const changedSources: string[] = []
  
  if (currentState.business_snapshot_hash !== newHashes.business_snapshot_hash) {
    changedSources.push('business_snapshot')
  }
  if (currentState.profile_hash !== newHashes.profile_hash) {
    changedSources.push('profile')
  }
  if (currentState.website_hash !== newHashes.website_hash) {
    changedSources.push('website')
  }
  if (currentState.location_hash !== newHashes.location_hash) {
    changedSources.push('location')
  }
  if (currentState.images_hash !== newHashes.images_hash) {
    changedSources.push('images')
  }
  if (currentState.menu_hash !== newHashes.menu_hash) {
    changedSources.push('menu')
  }
  
  return {
    shouldRegenerate: true,
    reason: `Sources changed: ${changedSources.join(', ')}`,
    changedSources
  }
}

/**
 * Save source hashes to database
 */
export async function saveSourceHashes(
  supabase: any,
  businessId: string,
  sourceHashes: {
    business_snapshot_hash: string | null
    profile_hash: string | null
    website_hash: string | null
    location_hash: string | null
    images_hash: string | null
    menu_hash: string | null
  },
  versionHash: string
): Promise<void> {
  const now = new Date().toISOString()
  
  const { error } = await supabase
    .from('brand_profile_sources_state')
    .upsert({
      business_id: businessId,
      ...sourceHashes,
      version_hash: versionHash,
      updated_at: now
    }, {
      onConflict: 'business_id'
    })
  
  if (error) {
    console.error('Failed to save source hashes:', error)
    throw new Error(`Failed to save source hashes: ${error.message}`)
  }
}
