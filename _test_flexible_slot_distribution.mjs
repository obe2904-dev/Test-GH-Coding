// Test script for flexible slot distribution
// Run with: deno run --allow-all _test_flexible_slot_distribution.mjs

// Test function (extracted from phase1.ts logic)
function computeSlotCounts(
  targetPostCount,
  goalBlend
) {
  const df = goalBlend.drive_footfall ?? 50;
  const bb = goalBlend.build_brand ?? 50;
  const total = df + bb;

  // Normalise weights (fall back to 50/50 if blank)
  const w = total > 0
    ? { drive_footfall: df / total, build_brand: bb / total }
    : { drive_footfall: 0.50, build_brand: 0.50 };

  // Raw floats
  const raw = {
    drive_footfall: w.drive_footfall * targetPostCount,
    build_brand:    w.build_brand    * targetPostCount,
  };

  // Floor all
  const counts = {
    drive_footfall: Math.floor(raw.drive_footfall),
    build_brand:    Math.floor(raw.build_brand),
  };

  // Calculate remainder but DON'T auto-assign it — return as flexible count
  const flexible = targetPostCount - counts.drive_footfall - counts.build_brand;

  // FLOOR RULE: minimum 1 footfall
  if (targetPostCount >= 3 && counts.drive_footfall === 0) {
    counts.drive_footfall = 1;
    counts.build_brand = Math.max(0, counts.build_brand - 1);
    console.warn('[Phase 1] Footfall floor enforced');
  }

  return { ...counts, flexible };
}

// Test cases
console.log('🧪 Testing Flexible Slot Distribution\n');
console.log('=' .repeat(60));

const testCases = [
  {
    name: 'User Example: 65/35 split',
    posts: 4,
    blend: { drive_footfall: 65, build_brand: 35 },
    expected: { drive_footfall: 2, build_brand: 1, flexible: 1 }
  },
  {
    name: 'Luxury Restaurant: 30/70 split',
    posts: 4,
    blend: { drive_footfall: 30, build_brand: 70 },
    expected: { drive_footfall: 1, build_brand: 2, flexible: 1 }
  },
  {
    name: 'High-Volume Café: 80/20 split',
    posts: 4,
    blend: { drive_footfall: 80, build_brand: 20 },
    expected: { drive_footfall: 3, build_brand: 0, flexible: 1 }
  },
  {
    name: 'Perfect Split: 50/50',
    posts: 4,
    blend: { drive_footfall: 50, build_brand: 50 },
    expected: { drive_footfall: 2, build_brand: 2, flexible: 0 }
  },
  {
    name: 'Extreme Brand: 10/90',
    posts: 4,
    blend: { drive_footfall: 10, build_brand: 90 },
    expected: { drive_footfall: 1, build_brand: 2, flexible: 1 } // Floor rule enforced, remainder stays flexible
  },
  {
    name: '3 posts: 70/30',
    posts: 3,
    blend: { drive_footfall: 70, build_brand: 30 },
    expected: { drive_footfall: 2, build_brand: 0, flexible: 1 }
  }
];

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = computeSlotCounts(test.posts, test.blend);
  const match = 
    result.drive_footfall === test.expected.drive_footfall &&
    result.build_brand === test.expected.build_brand &&
    result.flexible === test.expected.flexible;
  
  console.log(`\n${match ? '✅' : '❌'} ${test.name}`);
  console.log(`   Input: ${test.posts} posts, ${test.blend.drive_footfall}% footfall, ${test.blend.build_brand}% brand`);
  console.log(`   Expected: ${test.expected.drive_footfall} footfall, ${test.expected.build_brand} brand, ${test.expected.flexible} flexible`);
  console.log(`   Got:      ${result.drive_footfall} footfall, ${result.build_brand} brand, ${result.flexible} flexible`);
  
  if (match) {
    passed++;
  } else {
    failed++;
  }
}

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Results: ${passed}/${testCases.length} tests passed`);

if (failed === 0) {
  console.log('🎉 All tests passed! Flexible slot distribution working correctly.\n');
} else {
  console.log(`⚠️  ${failed} test(s) failed. Review implementation.\n`);
  Deno.exit(1);
}
