export interface MediaAnalysis {
  contentMatch?: {
    rating: 'excellent' | 'good' | 'fair' | 'poor';
    feedback: string;
    rewriteSuggestion?: string | null;
    reshootGuidance?: string | null;
    actionNeeded?: 'none' | 'rewrite' | 'choice';
  };
  emojiMatch?: string | null;
  whatWorks?: string[];
  generalFeedback: string;
  suggestions: Suggestion[];
  humanSuggestions?: HumanSuggestion[];
  recommendation?: 'post-it' | 'good-enough' | 'quick-fix' | 'retake';
  recommendationText?: string;
}

export interface HumanSuggestion {
  text: string;
}

export interface Suggestion {
  id: string;
  category: 'cleaning' | 'color';
  title: string;
  reason: string;
  location: string; // Plain text description of where the issue is
  action: string;
}
