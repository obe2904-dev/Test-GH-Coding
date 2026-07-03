/**
 * WHO to demographic_proximity Converter
 * 
 * During transition period (Steps 2-6), we write BOTH who and demographic_proximity.
 * This converter synthesizes demographic_proximity from who for backward compatibility.
 * 
 * Architecture Spec Step 2: "Keep demographic_proximity populated during transition"
 */

export interface LocationWho {
  primary: string[];
  secondary: string[];
  notes?: string;
}

/**
 * Convert WHO types to demographic_proximity scores for backward compatibility.
 * 
 * Scoring logic:
 * - primary types → score 90
 * - secondary types → score 50
 * 
 * This ensures consumers reading demographic_proximity still get usable data
 * while we transition to the new who field.
 */
export function convertWhoToDemographicProximity(who: LocationWho): Record<string, number> {
  const demographics: Record<string, number> = {};
  
  // WHO type → demographic_proximity key mapping
  const whoToDemographicMap: Record<string, string> = {
    'local_resident': 'local_resident',
    'office_worker': 'office_worker',
    'student': 'student',
    'shopper': 'shopper',
    'tourist': 'tourist',
    'commuter': 'commuter',
    'leisure_walker': 'leisure_walker',
    'family': 'family',
    'medical_staff': 'medical_staff',
    'hospital_visitor': 'hospital_visitor',
    'event_visitor': 'event_visitor',
  };
  
  // Primary types get high score (90)
  for (const whoType of who.primary || []) {
    const demographicKey = whoToDemographicMap[whoType];
    if (demographicKey) {
      demographics[demographicKey] = 90;
    }
  }
  
  // Secondary types get medium score (50)
  for (const whoType of who.secondary || []) {
    const demographicKey = whoToDemographicMap[whoType];
    if (demographicKey) {
      demographics[demographicKey] = 50;
    }
  }
  
  return demographics;
}
