import { useState } from 'react';
import type { ProgrammeProfile } from '../../hooks/useProgrammeProfiles';
import { AudienceSegmentCard } from './AudienceSegmentCard';

interface ProgrammeCardProps {
  programme: ProgrammeProfile;
}

export function ProgrammeCard({ programme }: ProgrammeCardProps) {
  const [expanded, setExpanded] = useState(true);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return 'text-green-600';
    if (confidence >= 0.70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="border border-blue-300 rounded-lg overflow-hidden bg-blue-50/30">
      {/* Header - Always visible */}
      <div 
        className="bg-blue-50 p-4 cursor-pointer hover:bg-blue-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-0.5 bg-blue-500 text-white rounded">🆕 V5</span>
              <h3 className="text-lg font-bold">{programme.programme_name}</h3>
            </div>
            <p className="text-sm text-gray-600">
              {programme.time_windows && programme.time_windows.length > 0
                ? programme.time_windows.join(', ')
                : 'No time windows'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {programme.confidence !== undefined && (
              <span className={`text-sm font-medium ${getConfidenceColor(programme.confidence)}`}>
                {(programme.confidence * 100).toFixed(0)}% confidence
              </span>
            )}
            <span className="text-gray-500 text-xl">{expanded ? '▼' : '▶'}</span>
          </div>
        </div>
      </div>

      {/* Expandable content */}
      {expanded && (
        <div className="p-4 space-y-6">
          {/* Layer 1: Operating Schedule */}
          <section>
            <h4 className="text-sm font-bold uppercase text-gray-500 mb-3">📅 Operating Schedule (Layer 1)</h4>
            <div className="space-y-2 text-sm">
              {programme.operating_days && programme.operating_days.length > 0 && (
                <p>
                  <span className="font-medium">Days:</span> {programme.operating_days.join(', ')}
                </p>
              )}
              {programme.time_windows && programme.time_windows.length > 0 && (
                <p>
                  <span className="font-medium">Hours:</span> {programme.time_windows.join(', ')}
                </p>
              )}
              {programme.menu_evidence && programme.menu_evidence.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Menu Evidence:</p>
                  <div className="flex flex-wrap gap-1">
                    {programme.menu_evidence.slice(0, 10).map((item, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                        {item}
                      </span>
                    ))}
                    {programme.menu_evidence.length > 10 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        +{programme.menu_evidence.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Layer 2: Commercial Strategy */}
          <section>
            <h4 className="text-sm font-bold uppercase text-gray-500 mb-3">💼 Commercial Strategy (Layer 2)</h4>
            <div className="space-y-3">
              {programme.decision_timing && (
                <p className="text-sm">
                  <span className="font-medium">Decision Timing:</span> {programme.decision_timing}
                </p>
              )}
              
              {programme.baseline_goal_split && (
                <div>
                  <p className="text-sm font-medium mb-2">Goal Split:</p>
                  <div className="space-y-2">
                    {programme.baseline_goal_split.drive_footfall !== undefined && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Drive Footfall</span>
                          <span className="font-medium">{programme.baseline_goal_split.drive_footfall}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${programme.baseline_goal_split.drive_footfall}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {programme.baseline_goal_split.strengthen_brand !== undefined && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Strengthen Brand</span>
                          <span className="font-medium">{programme.baseline_goal_split.strengthen_brand}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${programme.baseline_goal_split.strengthen_brand}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {programme.baseline_goal_split.retain_regulars !== undefined && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Retain Regulars</span>
                          <span className="font-medium">{programme.baseline_goal_split.retain_regulars}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-500 h-2 rounded-full" 
                            style={{ width: `${programme.baseline_goal_split.retain_regulars}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {programme.content_type_affinity && Object.keys(programme.content_type_affinity).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Content Affinity:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(programme.content_type_affinity).map(([type, value]) => (
                      <div key={type} className="text-xs">
                        <div className="flex justify-between mb-1">
                          <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                          <span className="font-medium">{(value as number).toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-indigo-500 h-1.5 rounded-full" 
                            style={{ width: `${Math.min(100, value as number)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {programme.commercial_reasoning && (
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">🤖 AI Reasoning</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{programme.commercial_reasoning}</p>
                </div>
              )}
            </div>
          </section>

          {/* Layer 4: Audience Segments */}
          <section>
            <h4 className="text-sm font-bold uppercase text-gray-500 mb-3">👥 Audience Segments (Layer 4)</h4>
            
            {programme.audience_segments && programme.audience_segments.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  {programme.audience_segments.map((segment, i) => (
                    <AudienceSegmentCard key={i} segment={segment} />
                  ))}
                </div>

                {/* Segment Reasoning */}
                {programme.segment_reasoning && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-xs font-bold uppercase text-blue-900 mb-2">AI Reasoning:</p>
                    <p className="text-sm text-gray-700">{programme.segment_reasoning}</p>
                  </div>
                )}

                {/* Segment Confidence */}
                {programme.segment_confidence !== undefined && (
                  <div className="text-sm">
                    <span className="font-medium">Segment Confidence:</span>{' '}
                    <span className={getConfidenceColor(programme.segment_confidence)}>
                      {(programme.segment_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No audience segments generated yet</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
