/**
 * Platform Intelligence Types (Global)
 */

// Algorithm factors
export interface AlgorithmFactor {
  factor: string;
  weight: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  how_to_optimize?: string;
}

// Content type performance
export interface ContentTypeSpec {
  type: string;
  algorithm_priority: 'highest' | 'high' | 'medium' | 'low';
  avg_reach_multiplier?: number;
  specifications?: {
    optimal_length?: string;
    optimal_ratio?: string;
    hook_timing?: string;
  };
}

// Posting strategy
export interface PostingStrategy {
  optimal_posting_times?: {
    weekday?: string[];
    weekend?: string[];
  };
  frequency_recommendation?: string;
  consistency_importance?: 'critical' | 'high' | 'medium';
}

// Platform-specific intelligence
export interface PlatformAlgorithmKnowledge {
  algorithm_version?: string;
  last_verified?: string;
  algorithm_factors?: AlgorithmFactor[];
  content_types?: ContentTypeSpec[];
  posting_strategy?: PostingStrategy;
  engagement_triggers?: string[];
  content_types_ranking?: string[];
  hashtag_best_practices?: Record<string, any>;
}

export interface PlatformIntelligence {
  id: number; // Always 1
  instagram_algorithm: PlatformAlgorithmKnowledge;
  facebook_algorithm: PlatformAlgorithmKnowledge;
  google_my_business: PlatformAlgorithmKnowledge;
  industry_benchmarks: Record<string, any>;
  last_updated: string;
  version: number;
}
