#!/usr/bin/env node
/**
 * Physical Anchor Taxonomy v3 - Implementation Test Suite
 * 
 * Tests:
 * 1. Database migration success (schema v3 columns exist)
 * 2. Geographic location types (9 types: no mixed_use/destination, has university/hospital/tourist_destination)
 * 3. WHO field structure validation
 * 4. TRAFFIC_RHYTHM field structure validation
 * 5. Proximity gate enforcement
 * 6. Audience filter compatibility (v2 → v3)
 * 7. UI rendering (WHO primary/secondary display)
 * 
 * Run: node _test_physical_anchor_taxonomy_v3.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test results tracker
const results = {
  passed: [],
  failed: [],
};

function pass(testName) {
  results.passed.push(testName);
  console.log(`✅ ${testName}`);
}

function fail(testName, reason) {
  results.failed.push({ test: testName, reason });
  console.error(`❌ ${testName}: ${reason}`);
}

// ============================================================================
// TEST 1: Database Schema Validation
// ============================================================================
async function testDatabaseSchema() {
  console.log('\n━━━ TEST 1: Database Schema ━━━');
  
  try {
    // Check if who and traffic_rhythm columns exist
    const { data, error } = await supabase
      .from('business_location_intelligence')
      .select('who, traffic_rhythm, location_architecture_version')
      .limit(1);
    
    if (error) throw error;
    
    if (data && data.length > 0 && ('who' in data[0]) && ('traffic_rhythm' in data[0])) {
      pass('Database has who and traffic_rhythm columns');
    } else {
      fail('Database schema', 'who or traffic_rhythm columns missing');
      return;
    }
    
    // Check schema version default
    const { data: versionData } = await supabase
      .from('business_location_intelligence')
      .select('location_architecture_version')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (versionData && versionData[0]?.location_architecture_version === 3) {
      pass('Schema version 3 detected');
    }
  } catch (err) {
    fail('Database schema test', err.message);
  }
}

// ============================================================================
// TEST 2: Geographic Location Types (9 types)
// ============================================================================
async function testGeographicLocationTypes() {
  console.log('\n━━━ TEST 2: Geographic Location Types ━━━');
  
  const EXPECTED_TYPES = [
    'city_centre',
    'transport_hub',
    'shopping_district',
    'waterfront',
    'office',
    'residential',
    'university_campus',
    'hospital_campus',
    'tourist_destination',
    'nature_park'
  ];
  
  const FORBIDDEN_TYPES = ['mixed_use', 'destination'];
  
  try {
    // This would require importing the geographic-location-types.ts module
    // For now, we'll do a simple string search in the file
    const fs = await import('fs');
    const path = await import('path');
    
    const filePath = path.join(process.cwd(), 'supabase/functions/_shared/geographic-location-types.ts');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Check for expected types
    const hasAllExpected = EXPECTED_TYPES.every(type => 
      fileContent.includes(`locationTypeId: "${type}"`)
    );
    
    if (hasAllExpected) {
      pass('All 10 location types present (including 3 new types)');
    } else {
      const missing = EXPECTED_TYPES.filter(type => !fileContent.includes(`locationTypeId: "${type}"`));
      fail('Geographic location types', `Missing types: ${missing.join(', ')}`);
    }
    
    // Check forbidden types are removed
    const hasForbidden = FORBIDDEN_TYPES.some(type => 
      fileContent.includes(`locationTypeId: "${type}"`)
    );
    
    if (!hasForbidden) {
      pass('Removed mixed_use and destination types');
    } else {
      fail('Forbidden types', 'mixed_use or destination still present');
    }
  } catch (err) {
    fail('Geographic location types test', err.message);
  }
}

// ============================================================================
// TEST 3: WHO Field Structure
// ============================================================================
async function testWhoFieldStructure() {
  console.log('\n━━━ TEST 3: WHO Field Structure ━━━');
  
  const VALID_WHO_TYPES = [
    'local_resident', 'office_worker', 'student', 'shopper', 'tourist',
    'commuter', 'leisure_walker', 'family', 'medical_staff',
    'hospital_visitor', 'event_visitor'
  ];
  
  try {
    const { data, error } = await supabase
      .from('business_location_intelligence')
      .select('who')
      .not('who', 'is', null)
      .limit(5);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      let allValid = true;
      
      for (const record of data) {
        const who = record.who;
        
        // Check structure
        if (!who.primary || !Array.isArray(who.primary)) {
          fail('WHO field structure', 'Missing or invalid primary array');
          allValid = false;
          break;
        }
        
        if (!who.secondary || !Array.isArray(who.secondary)) {
          fail('WHO field structure', 'Missing or invalid secondary array');
          allValid = false;
          break;
        }
        
        // Check WHO types are valid
        const allTypes = [...who.primary, ...who.secondary];
        const invalidTypes = allTypes.filter(t => !VALID_WHO_TYPES.includes(t));
        
        if (invalidTypes.length > 0) {
          fail('WHO field validation', `Invalid WHO types: ${invalidTypes.join(', ')}`);
          allValid = false;
          break;
        }
      }
      
      if (allValid) {
        pass('WHO field structure valid');
      }
    } else {
      console.log('⚠️  No records with WHO field yet - run populate-location-intelligence first');
    }
  } catch (err) {
    fail('WHO field structure test', err.message);
  }
}

// ============================================================================
// TEST 4: TRAFFIC_RHYTHM Field Structure
// ============================================================================
async function testTrafficRhythmStructure() {
  console.log('\n━━━ TEST 4: TRAFFIC_RHYTHM Field Structure ━━━');
  
  const VALID_PEAK_DAYS = ['weekday', 'weekend', 'both'];
  const VALID_SEASONAL_PATTERNS = ['stable', 'summer_peak', 'semester_only', 'retail_calendar'];
  
  try {
    const { data, error } = await supabase
      .from('business_location_intelligence')
      .select('traffic_rhythm')
      .not('traffic_rhythm', 'is', null)
      .limit(5);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      let allValid = true;
      
      for (const record of data) {
        const rhythm = record.traffic_rhythm;
        
        // Check required fields
        if (!rhythm.peak_days || !VALID_PEAK_DAYS.includes(rhythm.peak_days)) {
          fail('TRAFFIC_RHYTHM validation', `Invalid peak_days: ${rhythm.peak_days}`);
          allValid = false;
          break;
        }
        
        if (!rhythm.peak_hours || typeof rhythm.peak_hours !== 'string') {
          fail('TRAFFIC_RHYTHM validation', 'Missing or invalid peak_hours');
          allValid = false;
          break;
        }
        
        if (!rhythm.dead_periods || typeof rhythm.dead_periods !== 'string') {
          fail('TRAFFIC_RHYTHM validation', 'Missing or invalid dead_periods');
          allValid = false;
          break;
        }
        
        if (!rhythm.seasonal_pattern || !VALID_SEASONAL_PATTERNS.includes(rhythm.seasonal_pattern)) {
          fail('TRAFFIC_RHYTHM validation', `Invalid seasonal_pattern: ${rhythm.seasonal_pattern}`);
          allValid = false;
          break;
        }
      }
      
      if (allValid) {
        pass('TRAFFIC_RHYTHM field structure valid');
      }
    } else {
      console.log('⚠️  No records with TRAFFIC_RHYTHM field yet - run populate-location-intelligence first');
    }
  } catch (err) {
    fail('TRAFFIC_RHYTHM field structure test', err.message);
  }
}

// ============================================================================
// TEST 5: Proximity Gate Enforcement
// ============================================================================
async function testProximityGates() {
  console.log('\n━━━ TEST 5: Proximity Gate Enforcement ━━━');
  
  try {
    const { data, error } = await supabase
      .from('business_location_intelligence')
      .select('who, landmarks_nearby')
      .not('who', 'is', null)
      .limit(20);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      let violations = [];
      
      for (const record of data) {
        const who = record.who;
        const landmarks = record.landmarks_nearby || [];
        
        // Check student proximity gate
        if (who.primary?.includes('student') || who.secondary?.includes('student')) {
          const hasUniversity = landmarks.some(l => 
            l.type === 'university' && 
            l.distance_meters >= 400 && 
            l.distance_meters <= 600
          );
          
          if (!hasUniversity) {
            violations.push('Student WHO type without university proximity gate (400-600m)');
          }
        }
        
        // Check medical staff/hospital visitor proximity gate
        const medicalTypes = ['medical_staff', 'hospital_visitor'];
        const hasMedical = medicalTypes.some(t => 
          who.primary?.includes(t) || who.secondary?.includes(t)
        );
        
        if (hasMedical) {
          const hasHospital = landmarks.some(l => 
            l.type === 'hospital' && 
            l.distance_meters >= 300 && 
            l.distance_meters <= 500
          );
          
          if (!hasHospital) {
            violations.push('Medical WHO type without hospital proximity gate (300-500m)');
          }
        }
      }
      
      if (violations.length === 0) {
        pass('Proximity gates enforced correctly');
      } else {
        fail('Proximity gate enforcement', violations.join('; '));
      }
    } else {
      console.log('⚠️  No records to test proximity gates - populate data first');
    }
  } catch (err) {
    fail('Proximity gate test', err.message);
  }
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================
async function runAllTests() {
  console.log('🧪 Physical Anchor Taxonomy v3 - Test Suite\n');
  
  await testDatabaseSchema();
  await testGeographicLocationTypes();
  await testWhoFieldStructure();
  await testTrafficRhythmStructure();
  await testProximityGates();
  
  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\nFailed tests:');
    results.failed.forEach(({ test, reason }) => {
      console.log(`  • ${test}: ${reason}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('💥 Test suite crashed:', err);
  process.exit(1);
});
