#!/usr/bin/env node
/**
 * Database Usage Analysis Script
 * Analyzes which Supabase tables and columns are actually used in the codebase
 * Run: node scripts/analyze-db-usage.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const WORKSPACE_ROOT = process.cwd();

// Tables discovered from migrations
const ALL_TABLES = [
  'profiles',
  'businesses',
  'business_team_members',
  'business_profile',
  'business_brand_profile',
  'business_locations',
  'business_operations',
  'business_visual_identity',
  'business_audience_profile',
  'business_goals',
  'business_location_intelligence',
  'opening_hours',
  'social_accounts',
  'platform_intelligence',
  'menu_sources',
  'menu_extractions',
  'menu_results_v2',
  'menu_results', // older version
  'business_menu_metadata',
  'menu_item_metadata',
  'seasonal_ingredients',
  'post_ideas',
  'post_drafts',
  'suggested_posts',
  'published_posts', // found in code
  'media_assets',
  'offerings',
  'specials',
  'business_services',
  'business_staff',
  'business_products',
  'business_classes',
  'website_analyses',
  'website_analysis_jobs', // found in code
  'brand_profile_sources_state',
  'brand_profile_generation_locks', // found in code
  'third_party_evidence',
  'business_concept_fit',
  'business_concept_fit_multi',
  'weather_cache',
  'contextual_calendar',
  'business_documents',
  'business_type_defaults',
  'content_types',
  'content_distribution_rules',
  'platform_assignment_rules',
  'content_performance_log',
  'content_type_baselines',
  'opportunity_tracking',
  'weekly_content_plans', // found in code
];

const usage = {};
ALL_TABLES.forEach(table => {
  usage[table] = {
    found: false,
    locations: [],
    usageCount: 0
  };
});

function searchFile(filePath, relativePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    ALL_TABLES.forEach(table => {
      // Search for: .from('table') or .from("table")
      const patterns = [
        new RegExp(`\\.from\\(['"\`]${table}['"\`]\\)`, 'g'),
        new RegExp(`supabase\\.from\\(['"\`]${table}['"\`]\\)`, 'g'),
      ];
      
      patterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          usage[table].found = true;
          usage[table].usageCount += matches.length;
          if (!usage[table].locations.includes(relativePath)) {
            usage[table].locations.push(relativePath);
          }
        }
      });
    });
  } catch (err) {
    // Skip files that can't be read
  }
}

function walkDirectory(dir, baseDir = dir) {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    
    // Skip node_modules and other irrelevant directories
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build') {
      return;
    }
    
    if (stat.isDirectory()) {
      walkDirectory(fullPath, baseDir);
    } else if (file.match(/\.(ts|tsx|js|jsx|mjs)$/)) {
      const relativePath = fullPath.replace(baseDir + '/', '');
      searchFile(fullPath, relativePath);
    }
  });
}

console.log('🔍 Analyzing database table usage...\n');
console.log('Scanning files...');

// Scan src directory
walkDirectory(join(WORKSPACE_ROOT, 'src'));

// Scan supabase functions
walkDirectory(join(WORKSPACE_ROOT, 'supabase/functions'));

// Scan root level files
const rootFiles = readdirSync(WORKSPACE_ROOT);
rootFiles.forEach(file => {
  const fullPath = join(WORKSPACE_ROOT, file);
  if (statSync(fullPath).isFile() && file.match(/\.(ts|tsx|js|jsx|mjs)$/)) {
    searchFile(fullPath, file);
  }
});

console.log('✅ Scan complete!\n');

// Categorize tables
const used = [];
const unused = [];

ALL_TABLES.forEach(table => {
  if (usage[table].found) {
    used.push(table);
  } else {
    unused.push(table);
  }
});

// Generate report
console.log('═══════════════════════════════════════════════════════');
console.log('                 DATABASE USAGE REPORT                  ');
console.log('═══════════════════════════════════════════════════════\n');

console.log(`📊 Total Tables Analyzed: ${ALL_TABLES.length}`);
console.log(`✅ Tables Found in Code: ${used.length}`);
console.log(`❌ Tables NOT Found in Code: ${unused.length}\n`);

console.log('═══════════════════════════════════════════════════════');
console.log('                    USED TABLES                         ');
console.log('═══════════════════════════════════════════════════════\n');

used.sort((a, b) => usage[b].usageCount - usage[a].usageCount);

used.forEach(table => {
  const data = usage[table];
  console.log(`📌 ${table}`);
  console.log(`   Uses: ${data.usageCount} times`);
  console.log(`   Files: ${data.locations.length}`);
  if (data.locations.length <= 5) {
    data.locations.forEach(loc => console.log(`     - ${loc}`));
  } else {
    data.locations.slice(0, 3).forEach(loc => console.log(`     - ${loc}`));
    console.log(`     ... and ${data.locations.length - 3} more files`);
  }
  console.log('');
});

console.log('═══════════════════════════════════════════════════════');
console.log('                   UNUSED TABLES                        ');
console.log('═══════════════════════════════════════════════════════\n');

if (unused.length === 0) {
  console.log('🎉 All tables are used!\n');
} else {
  console.log('⚠️  The following tables were NOT found in the codebase:\n');
  unused.forEach(table => {
    console.log(`  ❌ ${table}`);
  });
  console.log('');
  console.log('⚠️  WARNING: These tables may be:');
  console.log('   1. Unused and safe to delete');
  console.log('   2. Used indirectly (via RPCs, triggers, or edge cases)');
  console.log('   3. Planned for future features');
  console.log('   4. Table name mismatch (check migrations vs code)');
  console.log('');
  console.log('   ALWAYS verify before deletion!\n');
}

console.log('═══════════════════════════════════════════════════════');
console.log('                  DETAILED BREAKDOWN                    ');
console.log('═══════════════════════════════════════════════════════\n');

// Generate JSON report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    total: ALL_TABLES.length,
    used: used.length,
    unused: unused.length
  },
  tables: {}
};

ALL_TABLES.forEach(table => {
  report.tables[table] = usage[table];
});

// Save to file
import { writeFileSync } from 'fs';
const reportPath = join(WORKSPACE_ROOT, 'database-usage-report.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`📄 Full report saved to: database-usage-report.json\n`);

// Generate categories
const categories = {
  'Core Business': ['profiles', 'businesses', 'business_team_members'],
  'Business Profile': ['business_profile', 'business_brand_profile', 'business_operations', 'business_visual_identity', 'business_audience_profile', 'business_goals'],
  'Location': ['business_locations', 'business_location_intelligence', 'opening_hours'],
  'Menu': ['menu_sources', 'menu_extractions', 'menu_results_v2', 'menu_results', 'business_menu_metadata', 'menu_item_metadata', 'seasonal_ingredients'],
  'Content': ['post_ideas', 'post_drafts', 'suggested_posts', 'published_posts', 'media_assets', 'weekly_content_plans'],
  'Offerings': ['offerings', 'specials', 'business_services', 'business_staff', 'business_products', 'business_classes'],
  'Analysis': ['website_analyses', 'brand_profile_sources_state', 'third_party_evidence', 'business_concept_fit', 'business_concept_fit_multi'],
  'System': ['social_accounts', 'platform_intelligence', 'weather_cache', 'contextual_calendar', 'business_documents', 'brand_profile_generation_locks'],
  'Performance': ['content_performance_log', 'content_type_baselines', 'opportunity_tracking', 'business_type_defaults', 'content_types', 'content_distribution_rules', 'platform_assignment_rules']
};

console.log('📋 USAGE BY CATEGORY:\n');
Object.entries(categories).forEach(([category, tables]) => {
  const usedInCategory = tables.filter(t => usage[t]?.found).length;
  const totalInCategory = tables.length;
  const pct = Math.round((usedInCategory / totalInCategory) * 100);
  
  console.log(`${category}: ${usedInCategory}/${totalInCategory} (${pct}%)`);
  
  const unusedInCategory = tables.filter(t => !usage[t]?.found);
  if (unusedInCategory.length > 0) {
    console.log(`  Unused: ${unusedInCategory.join(', ')}`);
  }
  console.log('');
});

console.log('═══════════════════════════════════════════════════════\n');
console.log('✨ Analysis complete! Review the report above.\n');
