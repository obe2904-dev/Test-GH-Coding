import React from 'react';
import { BrandProfileSection } from './BrandProfileSection';

interface BrandProfile {
  brand_essence: string;
  brand_positioning: string;
  tone_of_voice: {
    primary_tone: string;
    attributes: string[];
    formality_level: string;
  };
  content_hooks: Array<{
    hook: string;
    usage: string;
  }>;
  banned_words: string[];
  target_audience: {
    primary: string;
    characteristics: string[];
  };
  competitive_positioning: {
    differentiators: string[];
    key_advantages: string[];
  };
}

interface BrandProfileDisplayProps {
  profile: BrandProfile;
  onRegenerate?: () => void;
}

export function BrandProfileDisplay({ profile, onRegenerate }: BrandProfileDisplayProps) {
  return (
    <div className="space-y-6">
      {/* Header with regenerate button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Din Brandprofil</h2>
          <p className="text-sm text-gray-500 mt-1">
            Genereret med AI baseret på din forretningsdata
          </p>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            🔄 Generer igen
          </button>
        )}
      </div>

      {/* Brand Essence - Hero section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8 border border-blue-100">
        <h3 className="text-sm font-medium text-blue-600 mb-2">BRAND ESSENCE</h3>
        <p className="text-3xl font-bold text-gray-900 mb-4">{profile.brand_essence}</p>
        <p className="text-lg text-gray-700">{profile.brand_positioning}</p>
      </div>

      {/* Tone of Voice */}
      <BrandProfileSection 
        title="Tone of Voice"
        icon={<span className="text-2xl">🗣️</span>}
      >
        <div className="space-y-3">
          <div>
            <span className="text-sm font-medium text-gray-500">Primær tone:</span>
            <p className="text-base font-medium text-gray-900">{profile.tone_of_voice.primary_tone}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Attributter:</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.tone_of_voice.attributes.map((attr, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-full"
                >
                  {attr}
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Formalitetsniveau:</span>
            <p className="text-base text-gray-900 capitalize">{profile.tone_of_voice.formality_level}</p>
          </div>
        </div>
      </BrandProfileSection>

      {/* Content Hooks */}
      <BrandProfileSection 
        title="Content Hooks"
        icon={<span className="text-2xl">🎣</span>}
      >
        <p className="text-sm text-gray-600 mb-4">
          Brug disse hooks i dine sociale medie-opslag for at skille dig ud
        </p>
        <div className="space-y-3">
          {profile.content_hooks.map((hook, index) => (
            <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
              <p className="font-medium text-gray-900">"{hook.hook}"</p>
              <p className="text-sm text-gray-500 mt-1">→ {hook.usage}</p>
            </div>
          ))}
        </div>
      </BrandProfileSection>

      {/* Banned Words */}
      <BrandProfileSection 
        title="Forbudte ord"
        icon={<span className="text-2xl">🚫</span>}
      >
        <p className="text-sm text-gray-600 mb-4">
          Undgå disse ord - de lyder uautentiske eller generiske
        </p>
        <div className="space-y-2">
          {profile.banned_words.map((word, index) => (
            <div key={index} className="flex items-start">
              <span className="text-red-500 mr-2">✕</span>
              <span className="text-gray-700">{word}</span>
            </div>
          ))}
        </div>
      </BrandProfileSection>

      {/* Target Audience */}
      <BrandProfileSection 
        title="Målgruppe"
        icon={<span className="text-2xl">🎯</span>}
      >
        <div className="space-y-3">
          <div>
            <span className="text-sm font-medium text-gray-500">Primær målgruppe:</span>
            <p className="text-base text-gray-900 mt-1">{profile.target_audience.primary}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Karakteristika:</span>
            <ul className="mt-2 space-y-1">
              {profile.target_audience.characteristics.map((char, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  <span className="text-gray-700">{char}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </BrandProfileSection>

      {/* Competitive Positioning */}
      <BrandProfileSection 
        title="Konkurrencemæssig Positionering"
        icon={<span className="text-2xl">⚡</span>}
      >
        <div className="space-y-4">
          <div>
            <span className="text-sm font-medium text-gray-500">Differentierings-faktorer:</span>
            <ul className="mt-2 space-y-1">
              {profile.competitive_positioning.differentiators.map((diff, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span className="text-gray-700">{diff}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Nøglestyrker:</span>
            <ul className="mt-2 space-y-1">
              {profile.competitive_positioning.key_advantages.map((adv, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-blue-500 mr-2">💪</span>
                  <span className="text-gray-700">{adv}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </BrandProfileSection>
    </div>
  );
}
