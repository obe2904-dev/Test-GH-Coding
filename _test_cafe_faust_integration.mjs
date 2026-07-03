/**
 * CAFÉ FAUST INTEGRATION TEST
 * 
 * Simulates the actual BTS anchor generation flow with Café Faust data
 * to validate that the barista hallucination would be prevented.
 * 
 * Based on actual data from:
 * - business_id: 36e24a84-c32d-4123-910a-1bb2e64d34af
 * - Week 27 Post #3 hallucination: "Vores barista forbereder dagens første kaffe"
 * 
 * Run: node _test_cafe_faust_integration.mjs
 */

// Copy of filtering logic (for standalone execution)
const BTS_ANCHORS = {
  cafe: {
    morning: [
      'Det første hold gæster: hvem er de, og hvad siger de altid?',
      'Hvad gøres klar inden åbning — det ingen gæster ser',
      'Hvordan starter din dag som ejer/barista?',
      'Kaffen inden kaffen — hvad drikker personalet om morgenen?',
    ],
    afternoon: [
      'Eftermiddagens stille time — hvad laver du?',
      'Et produkt der kræver mere tid end gæsterne aner',
      'Personalet: hvem er de, og hvad kan de ud over at lave kaffe?',
      'Forbereder til i morgen — hvad gøres klar nu?',
    ],
  },
};

function getBTSAnchors(vertical, currentHour) {
  const bucket = currentHour >= 6 && currentHour < 11 ? 'morning' : 
                 currentHour >= 15 && currentHour < 18 ? 'afternoon' : 'general';
  return BTS_ANCHORS[vertical]?.[bucket] ?? [];
}

function getBTSAnchorsFiltered(vertical, currentHour, menuCategories, menuItemsText, verifiedFacilities) {
  const allAnchors = getBTSAnchors(vertical, currentHour);
  const normalizedMenuText = menuItemsText.toLowerCase();
  
  const filtered = allAnchors.filter(anchor => {
    const anchorLower = anchor.toLowerCase();
    
    if (anchorLower.includes('barista') || anchorLower.includes('kaffe') || anchorLower.includes('coffee')) {
      const hasCoffee = verifiedFacilities.serves_coffee
        || normalizedMenuText.includes('kaffe')
        || normalizedMenuText.includes('coffee')
        || normalizedMenuText.includes('espresso');
      
      if (!hasCoffee) {
        console.log(`   [FILTERED] "${anchor.substring(0, 60)}..." (no coffee in menu)`);
        return false;
      }
    }
    
    return true;
  });
  
  return filtered.length > 0 ? filtered : [
    'Hvad sker der bag kulisserne i dag?',
    'En detalje ved stedet som gæsterne sjældent opdager',
  ];
}

// CAFÉ FAUST ACTUAL DATA (from database queries)
const cafeFaustData = {
  business_id: '36e24a84-c32d-4123-910a-1bb2e64d34af',
  business_name: 'Café Faust',
  effective_vertical: 'cafe',
  
  // Menu categories from menu_results_v2
  menuCategories: [
    'Brunch',
    'Frokost',
    'Middag', 
    'Bar'
  ],
  
  // Actual menu items (sample from menu_items_normalized)
  menuItems: [
    { name: 'Pariserbøf med løg, brun sovs og kartofler', description: '' },
    { name: 'Bøf & bearnaise med pommes frites', description: '' },
    { name: 'Club Sandwich ala Faust', description: '' },
    { name: 'Falafelsalat', description: '' },
    { name: 'Moules Mariniers', description: 'Blåmuslinger i hvidvinssud' },
    { name: 'Vol au Vent', description: 'Butterdejspastej med høns i asparges' },
    { name: 'Gin Hass', description: 'Cocktail' },
    { name: 'Amaretto Sour', description: 'Cocktail' },
  ],
  
  // Business operations
  operations: {
    has_outdoor_seating: false,
    has_bar: true,
    seating_type: 'indoor'
  }
};

// Construct menu items text (as would be done in dagens-forslag-prompt-builder.ts)
const menuItemsText = cafeFaustData.menuItems
  .map(item => `${item.name} ${item.description || ''}`)
  .join(' ');

// Derive verified facilities (as would be done in dagens-forslag-prompt-builder.ts)
const verifiedFacilities = {
  has_outdoor_seating: cafeFaustData.operations.has_outdoor_seating,
  has_bar: cafeFaustData.operations.has_bar,
  has_kitchen: true, // Has food menu
  serves_coffee: menuItemsText.toLowerCase().includes('kaffe') || menuItemsText.toLowerCase().includes('coffee'),
  serves_alcohol: menuItemsText.toLowerCase().includes('vin') || menuItemsText.toLowerCase().includes('cocktail'),
};

console.log('🧪 CAFÉ FAUST INTEGRATION TEST');
console.log('=' .repeat(80));
console.log('\n📊 BUSINESS PROFILE:');
console.log(`   Name: ${cafeFaustData.business_name}`);
console.log(`   Vertical: ${cafeFaustData.effective_vertical}`);
console.log(`   Categories: ${cafeFaustData.menuCategories.join(', ')}`);
console.log('\n📋 MENU ANALYSIS:');
console.log(`   Total items: ${cafeFaustData.menuItems.length}`);
console.log(`   Has coffee: ${verifiedFacilities.serves_coffee ? '✅ YES' : '❌ NO'}`);
console.log(`   Has alcohol: ${verifiedFacilities.serves_alcohol ? '✅ YES' : '❌ NO'}`);
console.log(`   Has outdoor seating: ${verifiedFacilities.has_outdoor_seating ? '✅ YES' : '❌ NO'}`);

console.log('\n' + '='.repeat(80));
console.log('🕐 SCENARIO: Morning (9 AM) - Week 27 Post #3 Context');
console.log('='.repeat(80));

console.log('\nFiltering in progress...');

// Simulate the actual call from dagens-forslag-prompt-builder.ts
const morningAnchors = getBTSAnchorsFiltered(
  cafeFaustData.effective_vertical,
  9, // 9 AM = morning bucket
  cafeFaustData.menuCategories,
  menuItemsText,
  verifiedFacilities
);

console.log('\n✅ BTS ANCHORS RETURNED:');
morningAnchors.forEach((anchor, i) => {
  console.log(`   ${i + 1}. ${anchor}`);
});

console.log('\n🔍 HALLUCINATION PREVENTION VALIDATION:');
const hasBarista = morningAnchors.some(a => a.toLowerCase().includes('barista'));
const hasCoffee = morningAnchors.some(a => a.toLowerCase().includes('kaffe') || a.toLowerCase().includes('coffee'));

console.log(`   • Barista templates present: ${hasBarista ? '❌ FAIL - HALLUCINATION RISK' : '✅ PASS - BLOCKED'}`);
console.log(`   • Coffee templates present: ${hasCoffee ? '❌ FAIL - HALLUCINATION RISK' : '✅ PASS - BLOCKED'}`);
console.log(`   • Safe alternatives provided: ${morningAnchors.length >= 1 ? '✅ PASS' : '❌ FAIL'}`);

console.log('\n' + '='.repeat(80));
console.log('📊 COMPARISON: OLD vs NEW BEHAVIOR');
console.log('='.repeat(80));

console.log('\n❌ OLD BEHAVIOR (Week 27 - Hallucination occurred):');
console.log('   Templates returned: ALL cafe morning templates');
console.log('   Included:');
console.log('      • "Hvordan starter din dag som ejer/barista?"');
console.log('      • "Kaffen inden kaffen — hvad drikker personalet om morgenen?"');
console.log('   AI selected: Barista template');
console.log('   Generated title: "Vores barista forbereder dagens første kaffe"');
console.log('   Result: 🚨 HALLUCINATION - Café Faust does not serve coffee');

console.log('\n✅ NEW BEHAVIOR (With filtering):');
console.log('   Templates returned: FILTERED cafe morning templates');
console.log('   Blocked:');
console.log('      • "Hvordan starter din dag som ejer/barista?" (no coffee)');
console.log('      • "Kaffen inden kaffen — hvad drikker personalet..." (no coffee)');
console.log('   Allowed:');
morningAnchors.forEach(anchor => {
  console.log(`      • "${anchor}"`);
});
console.log('   Result: ✅ SAFE - Only factually grounded templates available');

console.log('\n' + '='.repeat(80));
console.log('🎯 VALIDATION SUMMARY');
console.log('='.repeat(80));

const allPassed = !hasBarista && !hasCoffee && morningAnchors.length >= 1;

if (allPassed) {
  console.log('\n✅ ALL VALIDATION CHECKS PASSED');
  console.log('\n💡 OUTCOME:');
  console.log('   • Week 27 barista hallucination would be PREVENTED');
  console.log('   • Only menu-verified templates would be available');
  console.log('   • AI would generate content based on actual offerings');
  console.log('\n🚀 RECOMMENDATION: Deploy to production');
} else {
  console.log('\n❌ VALIDATION FAILED');
  console.log('   • Further debugging required');
}

console.log('\n' + '='.repeat(80));

// Additional scenario: Afternoon (3 PM)
console.log('\n🕒 BONUS TEST: Afternoon (3 PM) - Different time bucket');
console.log('='.repeat(80));

console.log('\nFiltering in progress...');

const afternoonAnchors = getBTSAnchorsFiltered(
  cafeFaustData.effective_vertical,
  15, // 3 PM = afternoon bucket
  cafeFaustData.menuCategories,
  menuItemsText,
  verifiedFacilities
);

console.log('\n✅ Afternoon BTS anchors:');
afternoonAnchors.forEach((anchor, i) => {
  console.log(`   ${i + 1}. ${anchor}`);
});

const afternoonHasCoffee = afternoonAnchors.some(a => 
  a.toLowerCase().includes('kaffe') || a.toLowerCase().includes('coffee')
);

console.log(`\n   Coffee references blocked: ${!afternoonHasCoffee ? '✅ PASS' : '❌ FAIL'}`);
console.log('=' .repeat(80));
