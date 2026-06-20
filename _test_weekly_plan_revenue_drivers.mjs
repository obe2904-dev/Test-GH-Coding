#!/usr/bin/env node
/**
 * Test Weekly Plan with Business Rules Engine
 * Purpose: Generate a weekly strategy and verify revenue-driven day allocation
 */

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ3VqcG4iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczMjU0MzQ1NiwiZXhwIjoyMDQ4MTE5NDU2fQ.z8ou0rgLX8VQn_9Zb9lhnzQB-eLOuqFJmqU5nJNEIuM';

const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a';

async function testWeeklyPlan(weekStartDate) {
  console.log('\n🧪 Testing Weekly Plan with Revenue Drivers');
  console.log('=' .repeat(60));
  console.log(`Week: ${weekStartDate}`);
  console.log(`Business: Cafe Faust (${CAFE_FAUST_ID})`);
  console.log('=' .repeat(60));

  try {
    console.log('\n📞 Calling get-weekly-strategy...');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-weekly-strategy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        business_id: CAFE_FAUST_ID,
        week_start_date: weekStartDate,
        force_refresh: true, // Force fresh generation
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Function call failed:', response.status, errorText);
      return;
    }

    const result = await response.json();
    console.log('\n✅ Strategy generated successfully!');
    
    // Extract post days from the result
    if (result.posts && Array.isArray(result.posts)) {
      console.log('\n📅 POST DAY ALLOCATION:');
      console.log('-' .repeat(60));
      
      const postsByDay = {};
      result.posts.forEach(post => {
        const day = new Date(post.suggested_day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        if (!postsByDay[day]) postsByDay[day] = [];
        postsByDay[day].push({
          angle: post.angle_focus,
          type: post.type,
          goal: post.goal_mode,
          slot: post.slot_id,
        });
      });

      Object.keys(postsByDay).sort((a, b) => {
        const dateA = new Date(result.posts.find(p => new Date(p.suggested_day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) === a).suggested_day);
        const dateB = new Date(result.posts.find(p => new Date(p.suggested_day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) === b).suggested_day);
        return dateA - dateB;
      }).forEach(day => {
        console.log(`\n${day}:`);
        postsByDay[day].forEach(post => {
          console.log(`  • ${post.angle} (${post.type}, ${post.goal}, Slot ${post.slot})`);
        });
      });

      // Check for revenue driver coverage
      console.log('\n🎯 REVENUE DRIVER COVERAGE CHECK:');
      console.log('-' .repeat(60));
      
      const days = result.posts.map(p => new Date(p.suggested_day).getDay());
      const hasThursday = days.includes(4);
      const hasFriday = days.includes(5);
      const hasMonday = days.includes(1);
      
      console.log(`✓ Monday (weekday_lunch driver):    ${hasMonday ? '✅ PRESENT' : '❌ MISSING'}`);
      console.log(`✓ Thursday (weekend_dinner driver): ${hasThursday ? '✅ PRESENT' : '❌ MISSING'}`);
      console.log(`✓ Friday (weekend_dinner driver):   ${hasFriday ? '✅ PRESENT' : '❌ MISSING'}`);
      
      if (hasMonday && hasThursday && hasFriday) {
        console.log('\n🎉 SUCCESS: All revenue driver days covered!');
      } else {
        console.log('\n⚠️  WARNING: Missing revenue driver coverage');
      }

      // Check for old calendar-first pattern
      const hasTuesday = days.includes(2);
      const hasWednesday = days.includes(3);
      if (hasTuesday && hasWednesday && !hasThursday && !hasFriday) {
        console.log('\n❌ FAILURE: Front-loaded calendar pattern detected (Mon-Tue-Wed)');
        console.log('   Revenue drivers NOT applied - check BusinessRulesEngine logs');
      }
      
    } else {
      console.log('\n⚠️  No posts array in result');
    }

    // Show full result for debugging
    console.log('\n📊 FULL RESULT:');
    console.log('-' .repeat(60));
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Test current week (Week 24 - contains Grundlovsdag June 5)
const week24 = '2026-06-01';

// Test next week (normal week)
const week25 = '2026-06-08';

// Choose which week to test
const testWeek = process.argv[2] || week25;

console.log('\n💡 Usage: node _test_weekly_plan_revenue_drivers.mjs [week_start_date]');
console.log(`   Current: ${testWeek}`);
console.log(`   Options: ${week24} (Grundlovsdag week), ${week25} (normal week)\n`);

testWeeklyPlan(testWeek);
