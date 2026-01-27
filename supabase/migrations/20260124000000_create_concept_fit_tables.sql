-- Step 2: Concept Fit Analysis Tables

-- 1. Business Concept Fit Analysis Results
CREATE TABLE business_concept_fit (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Overall Fit Assessment
  overall_fit_level TEXT NOT NULL CHECK (overall_fit_level IN ('strong', 'moderate', 'challenging')),
  overall_fit_score DECIMAL(3,2) CHECK (overall_fit_score >= 0 AND overall_fit_score <= 1),
  overall_fit_confidence DECIMAL(3,2) CHECK (overall_fit_confidence >= 0 AND overall_fit_confidence <= 1),
  
  -- Factor-by-Factor Fit Levels
  customer_fit TEXT CHECK (customer_fit IN ('good', 'moderate', 'poor')),
  motivation_fit TEXT CHECK (motivation_fit IN ('good', 'moderate', 'poor')),
  pace_fit TEXT CHECK (pace_fit IN ('good', 'moderate', 'poor')),
  price_fit TEXT CHECK (price_fit IN ('good', 'moderate', 'poor')),
  winning_angles_fit TEXT CHECK (winning_angles_fit IN ('good', 'moderate', 'poor')),
  
  -- Detailed Analysis (JSONB)
  fit_reasons JSONB,
  -- ["Åbningstider passer godt til området", "Prisniveau matcher forventninger"]
  
  mismatch_reasons JSONB,
  -- ["Serveringsmodel matcher ikke tempo", "Mangler typiske vinkel-elementer"]
  
  strengths JSONB,
  -- ["Outdoor seating i boligområde", "Lokalejerskab resonerer med nabolag"]
  
  weaknesses JSONB,
  -- ["Ingen takeaway i pendlerzone", "For høje priser til studentområde"]
  
  -- Strategy Guidance
  strategy_approach TEXT NOT NULL CHECK (strategy_approach IN ('amplify', 'adapt', 'contrarian')),
  strategy_positioning TEXT,
  -- "Nabolagets hygge-destination for weekend brunch"
  
  emphasis JSONB,
  -- ["Community hub", "Weekend destination", "Family-friendly"]
  
  avoid JSONB,
  -- ["Quick service", "Grab-and-go", "Convenience"]
  
  cta_style TEXT,
  -- "friendly_invite" | "direct_action" | "community_style"
  
  -- Detected Business Motivations (AI-analyzed)
  detected_motivations JSONB,
  -- [
  --   {"motivation": "destination visit", "confidence": 0.9},
  --   {"motivation": "celebration", "confidence": 0.85}
  -- ]
  
  -- External Context Factors (for reference)
  weather_sensitivity TEXT CHECK (weather_sensitivity IN ('low', 'medium', 'high')),
  seasonality_pattern TEXT,
  seasonal_weights JSONB,
  
  -- Metadata
  analyzed_for_location_type TEXT,  -- Which location type this fit analysis is for (validated against LOCATION_EXPECTATIONS)
  analyzed_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

-- Index for faster lookups
CREATE INDEX idx_concept_fit_business ON business_concept_fit(business_id);
CREATE INDEX idx_concept_fit_level ON business_concept_fit(overall_fit_level);

-- 2. Concept Fit Per Location Type (for businesses that score high in multiple location types)
CREATE TABLE business_concept_fit_multi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_type_id TEXT NOT NULL,
  location_type_score INT,  -- From Step 1 category_scores
  
  -- Fit assessment for THIS location type
  fit_level TEXT NOT NULL CHECK (fit_level IN ('strong', 'moderate', 'challenging')),
  fit_score DECIMAL(3,2),
  
  -- Factor fits for this location type
  customer_fit TEXT,
  motivation_fit TEXT,
  pace_fit TEXT,
  price_fit TEXT,
  winning_angles_fit TEXT,
  
  -- Strategy for this location type
  strategy_approach TEXT,
  emphasis JSONB,
  avoid JSONB,
  
  -- Is this the primary strategy driver?
  is_primary_strategy BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  analyzed_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

-- Index
CREATE INDEX idx_concept_fit_multi_business ON business_concept_fit_multi(business_id);
CREATE INDEX idx_concept_fit_multi_primary ON business_concept_fit_multi(business_id, is_primary_strategy);

-- Comments
COMMENT ON TABLE business_concept_fit IS 'Primary concept fit analysis against main location type';
COMMENT ON TABLE business_concept_fit_multi IS 'Concept fit analysis for businesses scoring high in multiple location types';
COMMENT ON COLUMN business_concept_fit.strategy_approach IS 'amplify = lean into location strengths, adapt = hybrid approach, contrarian = position as exception';
COMMENT ON COLUMN business_concept_fit.analyzed_for_location_type IS 'Location type ID from LOCATION_EXPECTATIONS (e.g., city_centre, residential, student)';
