/**
 * PHASE 3: BUSINESS INTELLIGENCE VALIDATION
 * 
 * Validates that generated strategy properly leverages business intelligence data.
 * Ensures content variety, service period coverage, goal alignment, and location positioning.
 */

import type { PostIdea } from '../types/strategy-types.ts';
import type { BusinessIntelligence } from '../assemble-business-intelligence.ts';

export interface ValidationResult {
  passed: boolean;
  score: number;  // 0-100
  issues: ValidationIssue[];
  recommendations: string[];
}

export interface ValidationIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'service_period' | 'goal_distribution' | 'content_variety' | 'location_leverage';
  message: string;
  details?: string;
}

/**
 * Validate that generated strategy properly uses business intelligence
 */
export function validateBusinessIntelligenceUsage(
  postIdeas: PostIdea[],
  businessIntelligence: BusinessIntelligence
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const recommendations: string[] = [];
  
  // ────────────────────────────────────────────────────────────────
  // 1. CONTENT VARIETY CHECK
  // ────────────────────────────────────────────────────────────────
  const menuPosts = postIdeas.filter(p => 
    p.content_type === 'menu_item' ||
    p.content_category === 'product_menu'
  );
  const menuPostRatio = menuPosts.length / postIdeas.length;
  
  if (menuPostRatio > 0.75) {
    issues.push({
      severity: 'critical',
      category: 'content_variety',
      message: `Too many menu posts: ${menuPosts.length}/${postIdeas.length} (${Math.round(menuPostRatio * 100)}%)`,
      details: 'Target: ≤50% menu posts for better engagement. Consider adding atmosphere/location content.'
    });
    recommendations.push('Add more atmosphere, behind-scenes, or location-focused posts');
  } else if (menuPostRatio > 0.5) {
    issues.push({
      severity: 'warning',
      category: 'content_variety',
      message: `High menu post concentration: ${menuPosts.length}/${postIdeas.length} (${Math.round(menuPostRatio * 100)}%)`,
      details: 'Target: ≤50% menu posts. Current mix may reduce engagement.'
    });
  }
  
  // ────────────────────────────────────────────────────────────────
  // 2. LOCATION POSITIONING LEVERAGE
  // ────────────────────────────────────────────────────────────────
  if (businessIntelligence.locationPositioning) {
    const { scores, primaryContext } = businessIntelligence.locationPositioning;
    
    // Check if any high-scoring location attribute (≥80) is being leveraged
    const highScores = Object.entries(scores)
      .filter(([_, score]) => score && score >= 80)
      .map(([key, score]) => ({ key, score: score! }));
    
    if (highScores.length > 0) {
      // Count posts that reference location/atmosphere
      const locationPosts = postIdeas.filter(p =>
        p.content_type === 'atmosphere' ||
        p.content_category === 'behind_scenes' ||
        (p.title && /waterfront|åen|udsigt|terrasse|udeservering|ved vandet|location|stemning/i.test(p.title)) ||
        (p.rationale && /waterfront|åen|udsigt|terrasse|udeservering|ved vandet|location|stemning/i.test(p.rationale))
      );
      
      const locationPostRatio = locationPosts.length / postIdeas.length;
      
      if (locationPostRatio === 0) {
        issues.push({
          severity: 'critical',
          category: 'location_leverage',
          message: `High location score (${highScores[0].key}: ${highScores[0].score}) not leveraged in any post`,
          details: `Marketing hooks available: ${businessIntelligence.locationPositioning.marketingHooks.join(', ')}`
        });
        recommendations.push(`Add at least 1 post highlighting ${highScores[0].key} positioning`);
      } else if (locationPostRatio < 0.25) {
        issues.push({
          severity: 'warning',
          category: 'location_leverage',
          message: `Limited location leverage: ${locationPosts.length}/${postIdeas.length} posts use location positioning`,
          details: `Strong scores available: ${highScores.map(s => `${s.key}(${s.score})`).join(', ')}`
        });
      }
    }
  }
  
  // ────────────────────────────────────────────────────────────────
  // 3. SERVICE PERIOD COVERAGE
  // ────────────────────────────────────────────────────────────────
  if (businessIntelligence.servicePeriodStrategies && businessIntelligence.servicePeriodStrategies.length > 0) {
    const servicePeriods = businessIntelligence.servicePeriodStrategies.map(sp => sp.periodName);
    
    // Count how many posts target each service period (would need service_period field populated)
    // For now, check if posts have service_period metadata
    const postsWithServicePeriod = postIdeas.filter(p => p.service_period);
    
    if (postsWithServicePeriod.length === 0) {
      issues.push({
        severity: 'warning',
        category: 'service_period',
        message: 'No service period metadata in posts',
        details: `Available service periods: ${servicePeriods.join(', ')}`
      });
      recommendations.push('Add service_period field to PostIdea when selecting menu items or content angles');
    } else {
      // Check coverage
      const coverageMap = new Map<string, number>();
      postsWithServicePeriod.forEach(p => {
        const period = p.service_period!;
        coverageMap.set(period, (coverageMap.get(period) || 0) + 1);
      });
      
      const uncovered = servicePeriods.filter(sp => !coverageMap.has(sp));
      if (uncovered.length > 0) {
        issues.push({
          severity: 'warning',
          category: 'service_period',
          message: `Service periods not covered: ${uncovered.join(', ')}`,
          details: `Coverage: ${Array.from(coverageMap.entries()).map(([k, v]) => `${k}(${v})`).join(', ')}`
        });
      }
    }
  }
  
  // ────────────────────────────────────────────────────────────────
  // 4. GOAL MODE DISTRIBUTION
  // ────────────────────────────────────────────────────────────────
  const goalCounts = {
    drive_footfall: postIdeas.filter(p => p.goal_mode === 'drive_footfall').length,
    build_brand: postIdeas.filter(p => p.goal_mode === 'build_brand').length,
    retain_loyalty: postIdeas.filter(p => p.goal_mode === 'retain_loyalty').length,
    unassigned: postIdeas.filter(p => !p.goal_mode).length
  };
  
  const totalAssigned = goalCounts.drive_footfall + goalCounts.build_brand + goalCounts.retain_loyalty;
  
  if (totalAssigned === 0) {
    issues.push({
      severity: 'critical',
      category: 'goal_distribution',
      message: 'No goal modes assigned to posts',
      details: 'Every post should have a goal_mode (drive_footfall, build_brand, or retain_loyalty)'
    });
  } else {
    // Check if ALL posts have the same goal_mode
    if (goalCounts.drive_footfall === totalAssigned && totalAssigned > 1) {
      issues.push({
        severity: 'critical',
        category: 'goal_distribution',
        message: 'All posts have same goal (drive_footfall)',
        details: 'Expected: Mix of goals based on service period strategies. All footfall suggests lack of brand-building.'
      });
      recommendations.push('Include build_brand posts for awareness and retain_loyalty posts for community');
    } else if (goalCounts.build_brand === totalAssigned && totalAssigned > 1) {
      issues.push({
        severity: 'warning',
        category: 'goal_distribution',
        message: 'All posts have same goal (build_brand)',
        details: 'Expected: Mix of goals including drive_footfall for traffic'
      });
    }
    
    // Check if goal distribution roughly aligns with service period goals
    if (businessIntelligence.servicePeriodStrategies && businessIntelligence.servicePeriodStrategies.length > 0) {
      // Calculate average goal weights across all service periods
      let totalFootfall = 0;
      let totalBrand = 0;
      let totalLoyalty = 0;
      let periodCount = 0;
      
      businessIntelligence.servicePeriodStrategies.forEach(sp => {
        if (sp.goals && sp.goals.length > 0) {
          periodCount++;
          sp.goals.forEach(g => {
            if (g.goal === 'drive_footfall') totalFootfall += g.weight;
            else if (g.goal === 'strengthen_brand' || g.goal === 'build_brand') totalBrand += g.weight;
            else if (g.goal === 'retain_loyalty') totalLoyalty += g.weight;
          });
        }
      });
      
      if (periodCount > 0) {
        const avgFootfall = totalFootfall / periodCount;
        const avgBrand = totalBrand / periodCount;
        const avgLoyalty = totalLoyalty / periodCount;
        
        const actualFootfallPct = (goalCounts.drive_footfall / totalAssigned) * 100;
        const expectedFootfallPct = avgFootfall;
        
        // Allow ±20% tolerance
        if (Math.abs(actualFootfallPct - expectedFootfallPct) > 20) {
          issues.push({
            severity: 'info',
            category: 'goal_distribution',
            message: `Goal distribution differs from service period strategies`,
            details: `Actual: ${Math.round(actualFootfallPct)}% footfall. Expected: ~${Math.round(expectedFootfallPct)}% based on service periods.`
          });
        }
      }
    }
  }
  
  // ────────────────────────────────────────────────────────────────
  // 5. CALCULATE VALIDATION SCORE
  // ────────────────────────────────────────────────────────────────
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  
  // Score: 100 - (30 per critical) - (10 per warning), floor at 0
  const score = Math.max(0, 100 - (criticalCount * 30) - (warningCount * 10));
  const passed = criticalCount === 0;
  
  return {
    passed,
    score,
    issues,
    recommendations
  };
}

/**
 * Log validation results to console
 */
export function logValidationResults(result: ValidationResult): void {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 PHASE 3: BUSINESS INTELLIGENCE VALIDATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Score: ${result.score}/100`);
  console.log('');
  
  if (result.issues.length > 0) {
    console.log('Issues Found:');
    result.issues.forEach((issue, idx) => {
      const icon = issue.severity === 'critical' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`\n${idx + 1}. ${icon} [${issue.category}] ${issue.message}`);
      if (issue.details) {
        console.log(`   ${issue.details}`);
      }
    });
    console.log('');
  }
  
  if (result.recommendations.length > 0) {
    console.log('Recommendations:');
    result.recommendations.forEach((rec, idx) => {
      console.log(`${idx + 1}. ${rec}`);
    });
    console.log('');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
