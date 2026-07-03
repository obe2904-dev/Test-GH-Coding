-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY: Strategic Segments in Business Identity Persona
-- ═══════════════════════════════════════════════════════════════════════════
-- Run after brand profile regeneration

SELECT 
  business_id,
  
  -- Check for OLD location data
  business_identity_persona LIKE '%Studerende%' as ❌_has_students_generic,
  business_identity_persona LIKE '%score%' as ❌_has_score_format,
  
  -- Check for NEW strategic segments
  business_identity_persona LIKE '%Strategiske målgrupper%' as ✅_has_strategic_header,
  business_identity_persona LIKE '%Aftensmad ved åen%' as ✅_has_primary_segment,
  business_identity_persona LIKE '%primær%' as ✅_has_primary_label,
  business_identity_persona LIKE '%sekundær%' as ✅_has_secondary_label,
  
  -- Extract the audience section
  SUBSTRING(
    business_identity_persona 
    FROM 'Strategiske målgrupper:(.*?)(?:###|Kommunikationsstrategi|$)'
  ) as audience_section_full
  
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
