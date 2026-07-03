#!/usr/bin/env node
/**
 * Add missing translations to fix English/Danish parity
 */

import fs from 'fs';

const enPath = './src/lib/locales/en.json';
const daPath = './src/lib/locales/da.json';

console.log('🔧 Adding missing translations...\n');

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
const daJson = JSON.parse(fs.readFileSync(daPath, 'utf-8'));

// Add missing keys to Danish
if (!enJson.menu?.sources?.heading_plural) {
  console.error('❌ ERROR: menu.sources.heading_plural not found in source English file');
  process.exit(1);
}

// Add missing Danish translations from English where they exist
daJson.menu.sources.heading_plural = "{{count}} menusider fundet";

// Add missing createPost.planPublish keys to Danish
if (!daJson.createPost.planPublish) {
  daJson.createPost.planPublish = {};
}
daJson.createPost.planPublish.preparing = "Forbereder...";
daJson.createPost.planPublish.publishing = "Udgiver...";
daJson.createPost.planPublish.scheduling = "Planlægger...";

// Add missing createPost.publish keys to Danish (they were named differently)
if (!daJson.createPost.publish.preparing) {
  daJson.createPost.publish.preparing = "Forbereder...";
}
if (!daJson.createPost.publish.scheduleCta) {
  daJson.createPost.publish.scheduleCta = "Planlæg";
}

// Now add all the Danish-only carousel features to English
if (!enJson.createPost.carousel) {
  enJson.createPost.carousel = {};
}

enJson.createPost.carousel.activationTitle = "Create carousel?";
enJson.createPost.carousel.activationDesc = "You have {{count}} photos — turn them into a carousel for more engagement.";
enJson.createPost.carousel.activationYes = "Yes, create carousel";
enJson.createPost.carousel.activationNo = "No thanks";
enJson.createPost.carousel.setupTitle = "Carousel Setup";
enJson.createPost.carousel.themeLabel = "Theme";
enJson.createPost.carousel.goalLabel = "Goal";
enJson.createPost.carousel.themeNewItem = "New product";
enJson.createPost.carousel.themeTodaysSpecial = "Today's special";
enJson.createPost.carousel.themeBrunch = "Brunch";
enJson.createPost.carousel.themeCozy = "Cozy atmosphere";
enJson.createPost.carousel.themeTeam = "Team / behind the scenes";
enJson.createPost.carousel.goalSell = "Sell products";
enJson.createPost.carousel.goalCozyBrand = "Build brand warmth";
enJson.createPost.carousel.goalTrust = "Build trust";
enJson.createPost.carousel.goalDriveTraffic = "Drive traffic";
enJson.createPost.carousel.organiseButton = "AI Organize order";
enJson.createPost.carousel.organising = "Analyzing photos...";
enJson.createPost.carousel.organiseResultTitle = "AI-suggested order";
enJson.createPost.carousel.organiseApply = "Apply order";
enJson.createPost.carousel.organiseDismiss = "Dismiss";
enJson.createPost.carousel.slide = "Slide";
enJson.createPost.carousel.keepAnyway = "Keep anyway";
enJson.createPost.carousel.moveLeft = "Move left";
enJson.createPost.carousel.moveRight = "Move right";
enJson.createPost.carousel.setCover = "Cover";
enJson.createPost.carousel.label = "CAROUSEL";
enJson.createPost.carousel.slideCaptionLabel = "Slide text (optional)";
enJson.createPost.carousel.slideCaptionPlaceholder = "Optional text for this slide...";
enJson.createPost.carousel.carouselMode = "Carousel mode";

// Add businessProfile missing keys to English
if (!enJson.businessProfile.frame2.supportText3) {
  enJson.businessProfile.frame2.supportText3 = "or remove those you don't want right now";
}
if (!enJson.businessProfile.frame2.supportText4) {
  enJson.businessProfile.frame2.supportText4 = "You can always change it later — nothing is locked in.";
}

// Empty value fix - both already have it empty, so leave as is
// (businessProfile.aboutBusinessSuffix is intentionally empty)

// Write back to files
fs.writeFileSync(enPath, JSON.stringify(enJson, null, 2) + '\n', 'utf-8');
fs.writeFileSync(daPath, JSON.stringify(daJson, null, 2) + '\n', 'utf-8');

console.log('✅ Translations added successfully!\n');
console.log('📝 CHANGES MADE:');
console.log('   • Added menu.sources.heading_plural to Danish');
console.log('   • Added createPost.planPublish.* to Danish (3 keys)');
console.log('   • Added createPost.carousel.* to English (30 keys)');
console.log('   • Added businessProfile.frame2.* to English (2 keys)');
console.log('\n🔍 Run _check_translation_consistency.mjs again to verify');

process.exit(0);
