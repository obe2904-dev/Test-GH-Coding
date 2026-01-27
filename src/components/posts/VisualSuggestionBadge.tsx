import { useTranslation } from 'react-i18next';

interface VisualSuggestionBadgeProps {
  suggestions: {
    composition?: string;
    lighting?: string;
    subject?: string;
    color_palette?: string[];
  };
}

export function VisualSuggestionBadge({ suggestions }: VisualSuggestionBadgeProps) {
  const { t } = useTranslation('posts');

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-purple-600 text-base">📸</span>
        <h4 className="text-sm font-semibold text-purple-900">{t('posts.visualTips')}</h4>
      </div>

      {suggestions.composition && (
        <div>
          <span className="text-xs font-medium text-purple-600 block mb-1">
            {t('posts.composition')}:
          </span>
          <p className="text-sm text-purple-900">{suggestions.composition}</p>
        </div>
      )}

      {suggestions.lighting && (
        <div>
          <span className="text-xs font-medium text-purple-600 block mb-1">
            {t('posts.lighting')}:
          </span>
          <p className="text-sm text-purple-900">{suggestions.lighting}</p>
        </div>
      )}

      {suggestions.subject && (
        <div>
          <span className="text-xs font-medium text-purple-600 block mb-1">
            {t('posts.subject')}:
          </span>
          <p className="text-sm text-purple-900">{suggestions.subject}</p>
        </div>
      )}

      {suggestions.color_palette && suggestions.color_palette.length > 0 && (
        <div>
          <span className="text-xs font-medium text-purple-600 block mb-1">
            {t('posts.colors')}:
          </span>
          <div className="flex flex-wrap gap-2 mt-1">
            {suggestions.color_palette.map((color, i) => (
              <span 
                key={i} 
                className="text-xs bg-white px-2 py-1 rounded border border-purple-200 text-purple-900"
              >
                {color}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
