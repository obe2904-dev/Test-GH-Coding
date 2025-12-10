-- Migration: Add vertical-specific data tables
-- Date: 2025-11-21
-- Purpose: Support multiple business verticals (salons, gyms, etc.) beyond just food & drink

-- =====================================================
-- SERVICE LIST (for salons, spas, gyms, professional services)
-- =====================================================
CREATE TABLE IF NOT EXISTS business_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Service details
  category TEXT, -- e.g., "Haircuts", "Coloring", "Treatments", "Classes"
  name TEXT NOT NULL,
  description TEXT,
  
  -- Pricing
  price NUMERIC,
  price_to NUMERIC, -- For price ranges (e.g., "$50-$80")
  currency TEXT DEFAULT 'DKK',
  
  -- Timing
  duration_minutes INTEGER, -- e.g., 60 for 1 hour service
  
  -- Booking
  requires_booking BOOLEAN DEFAULT true,
  available_online BOOLEAN DEFAULT true,
  
  -- Display
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_business_services_business_id ON business_services(business_id);
CREATE INDEX idx_business_services_category ON business_services(business_id, category);

-- =====================================================
-- STAFF/TEAM MEMBERS (stylists, trainers, chefs, professionals)
-- =====================================================
CREATE TABLE IF NOT EXISTS business_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Personal info
  name TEXT NOT NULL,
  role TEXT, -- e.g., "Senior Stylist", "Personal Trainer", "Head Chef"
  bio TEXT,
  
  -- Expertise
  specialties TEXT[], -- e.g., ["balayage", "curly hair"], ["strength training", "nutrition"]
  certifications TEXT[], -- Professional certifications
  years_experience INTEGER,
  
  -- Media
  photo_url TEXT,
  
  -- Availability (for booking systems)
  accepts_bookings BOOLEAN DEFAULT true,
  booking_url TEXT,
  
  -- Display
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Social
  instagram_handle TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_business_staff_business_id ON business_staff(business_id);

-- =====================================================
-- PRODUCT CATALOG (retail products sold by salons, gyms, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS business_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Product details
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT, -- e.g., "Shampoo", "Supplements", "Apparel"
  description TEXT,
  
  -- Pricing
  price NUMERIC,
  currency TEXT DEFAULT 'DKK',
  
  -- Inventory
  stock_status TEXT DEFAULT 'in-stock', -- 'in-stock', 'low-stock', 'out-of-stock'
  sku TEXT,
  
  -- Media
  image_url TEXT,
  
  -- Display
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_business_products_business_id ON business_products(business_id);
CREATE INDEX idx_business_products_category ON business_products(business_id, category);

-- =====================================================
-- CLASS SCHEDULE (for gyms, yoga studios, fitness centers)
-- =====================================================
CREATE TABLE IF NOT EXISTS business_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Class details
  name TEXT NOT NULL, -- e.g., "Morning Yoga", "HIIT", "Spin Class"
  description TEXT,
  category TEXT, -- e.g., "Yoga", "Cardio", "Strength"
  
  -- Scheduling
  day_of_week INTEGER, -- 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  
  -- Capacity
  max_capacity INTEGER,
  requires_booking BOOLEAN DEFAULT true,
  
  -- Instructor
  instructor_id UUID REFERENCES business_staff(id) ON DELETE SET NULL,
  instructor_name TEXT, -- Denormalized for quick access
  
  -- Display
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_business_classes_business_id ON business_classes(business_id);
CREATE INDEX idx_business_classes_schedule ON business_classes(business_id, day_of_week, start_time);

-- =====================================================
-- UPDATE TRIGGERS (for updated_at timestamps)
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_business_services_updated_at BEFORE UPDATE ON business_services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_staff_updated_at BEFORE UPDATE ON business_staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_products_updated_at BEFORE UPDATE ON business_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_classes_updated_at BEFORE UPDATE ON business_classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE business_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_classes ENABLE ROW LEVEL SECURITY;

-- Users can read services/staff/products of any business (public data)
CREATE POLICY "Services are viewable by everyone" ON business_services
    FOR SELECT USING (true);

CREATE POLICY "Staff are viewable by everyone" ON business_staff
    FOR SELECT USING (true);

CREATE POLICY "Products are viewable by everyone" ON business_products
    FOR SELECT USING (true);

CREATE POLICY "Classes are viewable by everyone" ON business_classes
    FOR SELECT USING (true);

-- Users can insert/update/delete their own business data
CREATE POLICY "Users can manage their business services" ON business_services
    FOR ALL USING (
        business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their business staff" ON business_staff
    FOR ALL USING (
        business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their business products" ON business_products
    FOR ALL USING (
        business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their business classes" ON business_classes
    FOR ALL USING (
        business_id IN (
            SELECT id FROM businesses WHERE owner_id = auth.uid()
        )
    );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE business_services IS 'Service offerings for salons, spas, gyms, and professional services';
COMMENT ON TABLE business_staff IS 'Team members, stylists, trainers, and professionals';
COMMENT ON TABLE business_products IS 'Retail products sold by the business';
COMMENT ON TABLE business_classes IS 'Class schedules for gyms and fitness centers';
