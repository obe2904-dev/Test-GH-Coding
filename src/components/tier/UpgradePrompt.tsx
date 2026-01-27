import { useTranslation } from 'react-i18next';

interface UpgradePromptProps {
  onUpgrade?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}

export function UpgradePrompt({ onUpgrade, onDismiss, compact = false }: UpgradePromptProps) {
  const { t } = useTranslation('tier');

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="font-semibold text-purple-900">{t('tier.upgradePrompt.title')}</h4>
            <p className="text-sm text-purple-700 mt-1">{t('tier.upgradePrompt.description')}</p>
          </div>
          <button
            onClick={onUpgrade}
            className="ml-4 px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
          >
            {t('tier.upgradeToPro')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-8">
      <div className="text-center mb-6">
        <div className="text-4xl mb-4">⭐</div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          {t('tier.upgradePrompt.title')}
        </h3>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {t('tier.upgradePrompt.description')}
        </p>
      </div>

      {/* Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="flex items-start gap-3 bg-white rounded-lg p-4">
          <span className="text-purple-600 text-xl">✓</span>
          <div>
            <div className="font-semibold text-gray-900">{t('tier.upgradePrompt.benefits.unlimitedGoals')}</div>
            <div className="text-sm text-gray-600">Opret så mange mål som du vil</div>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-white rounded-lg p-4">
          <span className="text-purple-600 text-xl">✓</span>
          <div>
            <div className="font-semibold text-gray-900">{t('tier.upgradePrompt.benefits.fullEditing')}</div>
            <div className="text-sm text-gray-600">Finjuster alle AI-genererede data</div>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-white rounded-lg p-4">
          <span className="text-purple-600 text-xl">✓</span>
          <div>
            <div className="font-semibold text-gray-900">{t('tier.upgradePrompt.benefits.advancedAnalytics')}</div>
            <div className="text-sm text-gray-600">Dybdegående indsigter og rapporter</div>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-white rounded-lg p-4">
          <span className="text-purple-600 text-xl">✓</span>
          <div>
            <div className="font-semibold text-gray-900">{t('tier.upgradePrompt.benefits.prioritySupport')}</div>
            <div className="text-sm text-gray-600">Hurtigere svar på dine spørgsmål</div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={onUpgrade}
          className="px-8 py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-lg text-lg"
        >
          {t('tier.upgradePrompt.cta')}
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="px-8 py-4 bg-white text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-300"
          >
            {t('tier.upgradePrompt.keepSmart')}
          </button>
        )}
      </div>
    </div>
  );
}
