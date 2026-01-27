/**
 * Test Location Type Matching (STEP 1)
 * Run this in browser console to test location analysis
 */

import { analyzeLocationTypes } from './src/lib/location/locationTypeMatcher';

// Test Case 1: Strøget (City Centre + Shopping + Tourist)
console.log('🧪 TEST 1: Strøget 45, København');
const test1 = analyzeLocationTypes({
  address: 'Strøget 45, København',
  neighborhood: 'Indre By',
  city: 'København',
  nearbyPOIs: {
    restaurants: 45,
    cafes: 30,
    hotels: 12,
    tourist_attractions: 8
  }
});
console.table(test1);

// Test Case 2: Nyhavn (Tourist + Waterfront)
console.log('\n🧪 TEST 2: Nyhavn 17, København');
const test2 = analyzeLocationTypes({
  address: 'Nyhavn 17, København',
  neighborhood: 'Indre By',
  city: 'København',
  waterDistance: 50,
  nearbyPOIs: {
    restaurants: 35,
    cafes: 20,
    hotels: 18,
    tourist_attractions: 15
  }
});
console.table(test2);

// Test Case 3: Residential (Østerbro)
console.log('\n🧪 TEST 3: Østerbrogade 100, København');
const test3 = analyzeLocationTypes({
  address: 'Østerbrogade 100, København',
  neighborhood: 'Østerbro',
  city: 'København',
  nearbyPOIs: {
    restaurants: 8,
    cafes: 5,
    hotels: 1,
    tourist_attractions: 0
  }
});
console.table(test3);

// Test Case 4: University (Student)
console.log('\n🧪 TEST 4: Universitetsparken 1, København');
const test4 = analyzeLocationTypes({
  address: 'Universitetsparken 1, København',
  neighborhood: 'Nørrebro',
  city: 'København',
  nearbyPOIs: {
    universities: 2,
    restaurants: 12,
    cafes: 8
  }
});
console.table(test4);

console.log('\n✅ All tests complete! Check scores above.');
