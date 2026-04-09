import React from 'react';
import { useTranslation } from 'react-i18next';

interface GenerationProgressProps {
  message?: string;
}

export function GenerationProgress({ message }: GenerationProgressProps) {
  const { t } = useTranslation();
  const displayMessage = message ?? t('brand.progress.defaultMessage');
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* Spinner */}
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-info rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-cta rounded-full animate-spin border-t-transparent"></div>
      </div>

      {/* Message */}
      <p className="text-lg font-medium text-text mb-2">{displayMessage}</p>
      <p className="text-sm text-text-muted">{t('brand.progress.subtitle')}</p>

      {/* Progress steps */}
      <div className="mt-8 w-full max-w-md">
        <div className="space-y-2 text-sm text-text-secondary">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-cta rounded-full mr-3 animate-pulse"></div>
            <span>{t('brand.progress.step1')}</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-cta rounded-full mr-3 animate-pulse delay-100"></div>
            <span>{t('brand.progress.step2')}</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-cta rounded-full mr-3 animate-pulse delay-200"></div>
            <span>{t('brand.progress.step3')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
