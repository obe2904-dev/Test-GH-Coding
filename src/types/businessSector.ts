// src/types/businessSector.ts
// Business sector types and labels

export type BusinessSector = 'hospitality' | 'beauty' | 'wellness' | 'retail'

export const BUSINESS_SECTOR_LABELS_DA: Record<BusinessSector, string> = {
  hospitality: 'Restauration & madsteder',
  beauty: 'Skønhed & velvære',
  wellness: 'Sundhed & wellness',
  retail: 'Butik / detailhandel',
}

export const BUSINESS_SECTOR_LABELS_EN: Record<BusinessSector, string> = {
  hospitality: 'Hospitality & Food',
  beauty: 'Beauty',
  wellness: 'Health & Wellness',
  retail: 'Retail',
}

/**
 * Guess business sector from category/type text
 */
export function guessBusinessSector(categoryText: string): BusinessSector | null {
  const cat = categoryText.toLowerCase()
  
  if (cat.match(/cafe|café|restaurant|bar|bager|pizza|burger|mad|fødevare|takeaway/)) {
    return 'hospitality'
  }
  
  if (cat.match(/frisør|frisor|skønhed|neg|bryn|vipper|kosmetik|makeup|barbershop/)) {
    return 'beauty'
  }
  
  if (cat.match(/massør|massage|fysio|fysioterapi|klinik|yoga|fitness|sundhed|wellness|terapi/)) {
    return 'wellness'
  }
  
  if (cat.match(/butik|mode|tøj|smykk|interiør|design|detailhandel|shop/)) {
    return 'retail'
  }
  
  return null
}
