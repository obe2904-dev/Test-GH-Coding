import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AudienceSegment } from '../../hooks/useProgrammeProfiles';

interface AudienceSegmentCardProps {
  segment: AudienceSegment;
}

export function AudienceSegmentCard({ segment }: AudienceSegmentCardProps) {
  const { t } = useTranslation();
  const [showEvidence, setShowEvidence] = useState(false); // Default: collapsed for cleaner view

  const getBadgeColor = (size: string) => {
    switch (size) {
      case 'primary':
        return 'bg-[#E6F4F1] text-[#076B4E] border-[0.5px] border-[#88CDB9]';
      case 'secondary':
        return 'bg-[var(--color-background-secondary)] text-[#5C5650] border-[0.5px] border-[#C8C3BB]';
      case 'niche':
        return 'bg-[var(--color-background-secondary)] text-[#5C5650] border-[0.5px] border-[#C8C3BB]';
      default:
        return 'bg-[var(--color-background-secondary)] text-[#5C5650] border-[0.5px] border-[#C8C3BB]';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      {/* Segment header */}
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="font-medium text-[15px] text-[#111714]">{segment.people_type}</h4>
        <span className={`px-[10px] py-[3px] text-[11px] font-medium rounded-full ${getBadgeColor(segment.segment_size)}`}>
          {t(`brandProfileV5.${segment.segment_size}`)}
        </span>
      </div>

      {/* Timing only (motivation removed per user request) */}
      <div className="text-sm text-gray-600 space-y-1">
        {segment.timing_windows && segment.timing_windows.length > 0 && (
          <p>
            <span className="font-medium">{t('brandProfileV5.timing')}</span> {segment.timing_windows.join(', ')}
          </p>
        )}
      </div>

      {/* Decision timing */}
      <div className="text-sm text-gray-700 space-y-1">
        {segment.decision_timing && (
          <p>
            <span className="font-medium">{t('brandProfileV5.decision')}</span>{' '}
            {segment.decision_timing === 'mixed' 
              ? t('brandProfileV5.plannedAndSpontaneous')
              : t(`brandProfileV5.decisionTiming.${segment.decision_timing}`, segment.decision_timing)
            }
          </p>
        )}
      </div>

      {/* Location occasions (NEW: occasion-based approach) */}
      {segment.location_occasions && segment.location_occasions.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">{t('brandProfileV5.locationOccasions')}</p>
          <ul className="space-y-1">
            {segment.location_occasions.map((occasion, i) => (
              <li key={i} className="pl-4 -indent-4 text-[13px] text-[#5C5650] leading-[1.7]">• {occasion}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Content angles */}
      {segment.content_angles && segment.content_angles.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">{t('brandProfileV5.contentAngles')}</p>
          <ul className="space-y-1">
            {segment.content_angles.map((angle, i) => (
              <li key={i} className="pl-4 -indent-4 text-[13px] text-[#5C5650] leading-[1.7]">• {angle}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Evidence (FACT-CHECKING) ⭐ */}
      {segment.evidence && segment.evidence.length > 0 && (
        <div className="mt-3 bg-[#FEF3E6] border-[0.5px] border-[#F5C67C] rounded-lg p-3">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowEvidence(!showEvidence)}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-[#9B4E20] flex items-center gap-1">
              <span></span>
              <span>{t('brandProfileV5.evidence')}</span>
            </p>
            <span className="text-yellow-900 text-sm">{showEvidence ? '▼' : '▶'}</span>
          </div>

          {showEvidence && (
            <ul className="mt-2 space-y-1">
              {segment.evidence.map((evidence, i) => (
                <li key={i} className="text-[13px] text-[#5C5650] leading-[1.7] flex items-start gap-2">
                  <span className="text-[#5C5650] mt-0.5">•</span>
                  <span>{evidence}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
