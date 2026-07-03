import React, { useState, useMemo, useId } from 'react';
import { RegenerateWithInstructionsModal } from './RegenerateWithInstructionsModal';

// Icon components as inline SVGs
const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

const Edit = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const RefreshCw = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

const ArrowRight = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

interface GeneratedPost {
  ideaId: number;
  text: string; // Default/shared (Instagram for backward compatibility)
  hashtags: string[]; // All hashtags
  emojis: string[];
  platforms: string[];
  ctaIntent: string;
  // Platform-specific content (Option A: Dual Generation)
  platformText?: {
    facebook?: string;
    instagram?: string;
  };
  platformHashtags?: {
    facebook?: string[];
    instagram?: string[];
  };
  suggestedMedia?: {
    type: string;
    direction?: string;
    why?: string;
    photo_count?: number;
  };
  suggestedDay?: string;
  suggestedTime?: string;
  fromTemplate?: boolean;
}

interface StrategyIdeaDisplay {
  title: string;
  rationale: string;
  contentType: string;
  ctaIntent?: string;
}

interface StrategyGeneratedDisplayProps {
  generatedPost: GeneratedPost;
  strategicIdea?: StrategyIdeaDisplay;
  onEdit: () => void;
  onRegenerate: (instructions?: string) => void;
  onGoToDesign: () => void;
  selectedPlatforms?: string[];
  onSelectPlatforms?: (platforms: string[]) => void;
  activePlatform?: 'facebook' | 'instagram'; // Which platform to display optimized content for
  onActivePlatformChange?: (platform: 'facebook' | 'instagram') => void;
  isGenerating?: boolean; // True while background generation is in progress
}

// Platform Badge Components (matching manual flow)
const PlatformBadge = ({ platform }: { platform: 'facebook' | 'instagram' }) => {
  const gradientId = useId();

  if (platform === 'facebook') {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="12" fill="#1877F2" />
        <path
          d="M13.5 12.5V18H11V12.5H9V10H11V8.5C11 6.5 12 5.5 14 5.5H16V8H14.5C13.9 8 13.5 8.4 13.5 9V10H16L15.5 12.5H13.5Z"
          fill="white"
        />
      </svg>
    );
  }

  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F58529" />
          <stop offset="50%" stopColor="#DD2A7B" />
          <stop offset="100%" stopColor="#515BD4" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="12" fill={`url(#${gradientId})`} />
      <rect x="7" y="7" width="10" height="10" rx="2.5" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="2.5" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="white" />
    </svg>
  );
};

export const StrategyGeneratedDisplay: React.FC<StrategyGeneratedDisplayProps> = ({
  generatedPost,
  strategicIdea,
  onEdit,
  onRegenerate,
  onGoToDesign,
  selectedPlatforms = ['facebook', 'instagram'],
  onSelectPlatforms,
  activePlatform = 'instagram',
  onActivePlatformChange,
  isGenerating = false,
}) => {
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);

  // Debug logging (commented out for performance)
  // console.log('[StrategyGeneratedDisplay] Props:', {
  //   ideaId: generatedPost.ideaId,
  //   activePlatform,
  //   selectedPlatforms,
  // });

  // CRITICAL DEBUG: Log the entire platformText object
  if (!generatedPost.platformText && selectedPlatforms.length > 1) {
    console.error('[StrategyGeneratedDisplay] ❌ MISSING platformText for idea:', generatedPost.ideaId, 'Full post:', generatedPost);
  }

  const handleRegenerate = (instructions?: string) => {
    onRegenerate(instructions);
  };

  // Platform-specific hashtag logic (matching manual flow)
  const hasFacebook = selectedPlatforms.includes('facebook');
  const hasInstagram = selectedPlatforms.includes('instagram');
  const bothPlatforms = hasFacebook && hasInstagram;

  // OPTION A: Use platform-specific content when available
  const displayText = useMemo(() => {
    if (bothPlatforms && generatedPost.platformText) {
      return generatedPost.platformText[activePlatform] || generatedPost.text;
    }
    return generatedPost.text;
  }, [bothPlatforms, generatedPost.platformText, generatedPost.text, activePlatform]);

  const displayHashtags = useMemo(() => {
    if (bothPlatforms && generatedPost.platformHashtags) {
      // const tags = generatedPost.platformHashtags[activePlatform] || generatedPost.hashtags;
      return generatedPost.platformHashtags[activePlatform] || generatedPost.hashtags;
    }
    if (hasFacebook && !hasInstagram) {
      return generatedPost.hashtags.slice(0, 3); // Facebook: 3 hashtags max
    }
    return generatedPost.hashtags; // Instagram: all hashtags
  }, [bothPlatforms, generatedPost.platformHashtags, generatedPost.hashtags, hasFacebook, hasInstagram, activePlatform]);

  // Split hashtags: first 3 for both/Facebook, rest for Instagram only
  const sharedHashtags = displayHashtags.slice(0, 3);
  const instagramOnlyHashtags = displayHashtags.slice(3);

  // CTA text based on platform
  const ctaText = useMemo(() => {
    if (generatedPost.ctaIntent === 'booking' || generatedPost.ctaIntent === 'website') {
      if (bothPlatforms) {
        return '📱 Facebook: Link i opslaget → Instagram: Link i bio';
      }
      if (hasFacebook) {
        return '📱 Link i opslaget';
      }
      if (hasInstagram) {
        return '📱 Link i bio';
      }
    }
    return null;
  }, [generatedPost.ctaIntent, bothPlatforms, hasFacebook, hasInstagram]);

  return (
    <div className="bg-white rounded-xl shadow-md border border-[#D1D5DB] p-5">
      {/* Header Section (matching manual flow) */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-600 to-cta text-white rounded-lg text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              AI-GENERERET
            </div>
            {generatedPost.fromTemplate && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                ⚠️ Skabelon
              </span>
            )}
          </div>

          {/* Platform Selector (matches manual flow) */}
          {onSelectPlatforms && (
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  const newPlatforms = hasFacebook
                    ? selectedPlatforms.filter(p => p !== 'facebook')
                    : [...selectedPlatforms, 'facebook'];
                  onSelectPlatforms(newPlatforms);
                  // Set active platform when enabling
                  if (!hasFacebook && onActivePlatformChange) {
                    onActivePlatformChange('facebook');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  hasFacebook
                    ? 'bg-[#1877F2] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Facebook
              </button>
              <button
                onClick={() => {
                  const newPlatforms = hasInstagram
                    ? selectedPlatforms.filter(p => p !== 'instagram')
                    : [...selectedPlatforms, 'instagram'];
                  onSelectPlatforms(newPlatforms);
                  // Set active platform when enabling
                  if (!hasInstagram && onActivePlatformChange) {
                    onActivePlatformChange('instagram');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  hasInstagram
                    ? 'bg-gradient-to-r from-[#F58529] to-[#DD2A7B] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Instagram
              </button>
            </div>
          )}
        </div>

        {/* Platform Content Toggle (when both platforms enabled) */}
        {bothPlatforms && onActivePlatformChange && (
          <div className="flex items-center justify-center gap-2 py-2 bg-gray-50 rounded-lg border border-gray-200">
            {isGenerating && !generatedPost.platformText ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Genererer platform-specifik tekst...</span>
              </div>
            ) : generatedPost.platformText ? (
              <>
                <span className="text-xs text-gray-600 font-medium">Vis tekst til:</span>
                <div className="flex gap-1 bg-white border border-gray-300 p-0.5 rounded-lg">
                  <button
                    onClick={() => {
                      // Switching platform;
                      onActivePlatformChange('facebook');
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      activePlatform === 'facebook'
                        ? 'bg-[#1877F2] text-white shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    📘 Facebook
                  </button>
                  <button
                    onClick={() => {
                      // Switching platform;
                      onActivePlatformChange('instagram');
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      activePlatform === 'instagram'
                        ? 'bg-gradient-to-r from-[#F58529] to-[#DD2A7B] text-white shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    📸 Instagram
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Strategic Context as subtitle */}
        {strategicIdea && (
          <div className="text-[11px] space-y-0.5">
            <p className="text-[#4B5563]">
              <span className="font-semibold">{strategicIdea.title}</span> • {strategicIdea.contentType}
            </p>
            {/* Rationale hidden - shown in popup instead */}
            {/* <p className="text-[#6B7280]">
              💡 {strategicIdea.rationale}
            </p> */}
          </div>
        )}
      </div>

      {/* Text Content (matching textarea style) */}
      <div className="mb-4">
        {/* Platform indicator when dual content */}
        {bothPlatforms && generatedPost.platformText && (
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide">
              {activePlatform === 'facebook' ? '📘 Facebook-optimeret' : '📸 Instagram-optimeret'}
            </span>
          </div>
        )}
        <textarea
          value={displayText}
          readOnly
          rows={5}
          className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg bg-gray-50 text-sm resize-none min-h-[120px] text-gray-900"
        />
      </div>

      {/* Hashtags Section (matching manual flow) */}
      {displayHashtags.length > 0 && (
        <div className="mb-4 rounded-xl border border-[#C7D2FE] bg-[#EEF2FF]/70 px-3 py-3 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#312E81]">
              HASHTAG FORSLAG
            </span>
            <span className="text-[10px] text-[#4C1D95]">
              ✓ {displayHashtags.length} hashtags {bothPlatforms && generatedPost.platformHashtags ? `til ${activePlatform === 'facebook' ? 'Facebook' : 'Instagram'}` : 'genereret'}
            </span>
          </div>

          {/* Platform-specific hashtag display */}
          {bothPlatforms ? (
            <div className="flex flex-wrap gap-4">
              {/* Shared hashtags */}
              {sharedHashtags.length > 0 && (
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide">
                      Delt på begge platforme
                    </span>
                    <PlatformBadge platform="facebook" />
                    <PlatformBadge platform="instagram" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sharedHashtags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#124044] border border-[#124044] text-mint"
                      >
                        <span className="text-[10px]">✓</span>
                        <span>#{tag}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Instagram-only hashtags */}
              {instagramOnlyHashtags.length > 0 && (
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide">
                      Ekstra til Instagram
                    </span>
                    <PlatformBadge platform="instagram" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {instagramOnlyHashtags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#124044] border border-[#124044] text-mint"
                      >
                        <span className="text-[10px]">✓</span>
                        <span>#{tag}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : hasFacebook ? (
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide">
                  Til Facebook
                </span>
                <PlatformBadge platform="facebook" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sharedHashtags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#124044] border border-[#124044] text-mint"
                  >
                    <span className="text-[10px]">✓</span>
                    <span>#{tag}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : hasInstagram ? (
            <div className="space-y-3">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide">
                    Til Instagram
                  </span>
                  <PlatformBadge platform="instagram" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {generatedPost.hashtags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#124044] border border-[#124044] text-mint"
                    >
                      <span className="text-[10px]">✓</span>
                      <span>#{tag}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* CTA Intent Display */}
      {ctaText && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900 font-medium">
            {ctaText}
          </p>
        </div>
      )}

      {/* Suggested Timing */}
      {(generatedPost.suggestedDay || generatedPost.suggestedTime) && (
        <div className="mb-4 p-3 bg-cta-surface rounded-lg border border-cta-surface">
          <p className="text-sm text-brand">
            📅 Anbefalet tidspunkt:{' '}
            {generatedPost.suggestedDay && (
              <span className="font-medium">
                {new Date(generatedPost.suggestedDay).toLocaleDateString('da-DK', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
            )}
            {generatedPost.suggestedTime && ` kl. ${generatedPost.suggestedTime}`}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="border-t border-slate-200 mt-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Rediger
            </button>

            <button
              onClick={() => setShowRegenerateModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerer
            </button>
          </div>

          <button
            onClick={onGoToDesign}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] transition-colors font-semibold text-sm"
          >
            Gå til Design
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Regenerate Modal */}
      <RegenerateWithInstructionsModal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        onRegenerate={handleRegenerate}
        currentText={generatedPost.text}
      />
    </div>
  );
};
