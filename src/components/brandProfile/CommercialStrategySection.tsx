/**
 * Commercial Strategy Section
 * 
 * Displays and allows editing of commercial mode configuration
 * for the weekly strategy generation system.
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// Type definitions from commercial mode system
type CommercialMode = 'booking_push' | 'footfall_push' | 'balanced';

interface TriggerConfig {
  enabled: boolean;
  mode?: CommercialMode;
  min_booking_ideas?: number;
  min_footfall_ideas?: number;
  reasoning?: string;
}

interface BusinessTriggerConfiguration {
  [triggerId: string]: TriggerConfig;
}

interface CommercialStrategyProps {
  businessId: string;
  currentBaselineMode?: CommercialMode;
  currentTriggerConfig?: BusinessTriggerConfiguration;
  commercialStrategyReasoning?: string;
  triggerUpdatedBy?: 'ai' | 'manual' | null;
  onUpdate?: () => void;
}

// Trigger catalog with descriptions
const TRIGGER_CATALOG = [
  {
    id: 'VD_WEEK',
    name: "Valentine's Day",
    description: 'Week of Feb 12-14 (booking opportunity)',
    defaultMode: 'booking_push' as CommercialMode,
    icon: '💕'
  },
  {
    id: 'MD_WEEK',
    name: "Mother's Day",
    description: 'Week before 2nd Sunday of May (booking opportunity)',
    defaultMode: 'booking_push' as CommercialMode,
    icon: '🌸'
  },
  {
    id: 'FD_WEEK',
    name: "Father's Day",
    description: 'Week before in June (booking opportunity)',
    defaultMode: 'booking_push' as CommercialMode,
    icon: '👔'
  },
  {
    id: 'FIRST_WEEKEND',
    name: 'First Weekend',
    description: 'First weekend of each month (footfall push)',
    defaultMode: 'footfall_push' as CommercialMode,
    icon: '📅'
  },
  {
    id: 'PAYDAY_PERIOD',
    name: 'Payday Period',
    description: 'Around 15th and end of month (footfall push)',
    defaultMode: 'footfall_push' as CommercialMode,
    icon: '💰'
  },
  {
    id: 'WEATHER_BREAK',
    name: 'Weather Break',
    description: 'First warm day (20°C+) in spring (footfall push)',
    defaultMode: 'footfall_push' as CommercialMode,
    icon: '☀️'
  },
  {
    id: 'LOCAL_EVENT',
    name: 'Local Event',
    description: 'High commercial weight events from calendar',
    defaultMode: 'balanced' as CommercialMode,
    icon: '🎉'
  }
];

export function CommercialStrategySection({ 
  businessId, 
  currentBaselineMode = 'balanced', 
  currentTriggerConfig = {},
  commercialStrategyReasoning,
  triggerUpdatedBy,
  onUpdate 
}: CommercialStrategyProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [baselineMode, setBaselineMode] = useState<CommercialMode>(currentBaselineMode);
  const [triggerConfig, setTriggerConfig] = useState<BusinessTriggerConfiguration>(currentTriggerConfig);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const { error } = await supabase
        .from('business_brand_profile')
        .update({
          commercial_baseline_mode: baselineMode,
          trigger_configuration: triggerConfig,
          trigger_last_updated: new Date().toISOString(),
          trigger_updated_by: 'manual',
          updated_at: new Date().toISOString()
        })
        .eq('business_id', businessId);

      if (error) throw error;

      setSaveMessage({ type: 'success', text: 'Commercial strategy saved successfully!' });
      setIsEditing(false);
      
      if (onUpdate) {
        onUpdate();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save commercial strategy:', error);
      setSaveMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setBaselineMode(currentBaselineMode);
    setTriggerConfig(currentTriggerConfig);
    setIsEditing(false);
    setSaveMessage(null);
  };

  const toggleTrigger = (triggerId: string) => {
    const trigger = TRIGGER_CATALOG.find(t => t.id === triggerId);
    const currentConfig = triggerConfig[triggerId] || {};
    
    setTriggerConfig({
      ...triggerConfig,
      [triggerId]: {
        ...currentConfig,
        enabled: !currentConfig.enabled,
        mode: currentConfig.mode || trigger?.defaultMode || 'balanced',
        min_booking_ideas: currentConfig.min_booking_ideas || (trigger?.defaultMode === 'booking_push' ? 3 : 1),
        min_footfall_ideas: currentConfig.min_footfall_ideas || (trigger?.defaultMode === 'footfall_push' ? 4 : 1)
      }
    });
  };

  const updateTriggerMode = (triggerId: string, mode: CommercialMode) => {
    const currentConfig = triggerConfig[triggerId] || { enabled: true };
    setTriggerConfig({
      ...triggerConfig,
      [triggerId]: {
        ...currentConfig,
        mode,
        min_booking_ideas: mode === 'booking_push' ? 3 : 1,
        min_footfall_ideas: mode === 'footfall_push' ? 4 : 1
      }
    });
  };

  const updateTriggerQuota = (triggerId: string, field: 'min_booking_ideas' | 'min_footfall_ideas', value: number) => {
    const currentConfig = triggerConfig[triggerId] || { enabled: true };
    setTriggerConfig({
      ...triggerConfig,
      [triggerId]: {
        ...currentConfig,
        [field]: Math.max(0, Math.min(7, value)) // Clamp 0-7
      }
    });
  };

  const getEnabledTriggersCount = () => {
    return Object.values(triggerConfig).filter(config => config.enabled).length;
  };

  const getModeColor = (mode: CommercialMode) => {
    switch (mode) {
      case 'booking_push': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'footfall_push': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'balanced': return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getModeLabel = (mode: CommercialMode) => {
    switch (mode) {
      case 'booking_push': return 'Booking Push';
      case 'footfall_push': return 'Footfall Push';
      case 'balanced': return 'Balanced';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Commercial Strategy</h2>
          <p className="text-sm text-gray-600">
            Configure how weekly content strategy prioritizes bookings vs footfall
          </p>
        </div>
        
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Edit Strategy
          </button>
        )}
      </div>

      {/* AI Reasoning Display */}
      {commercialStrategyReasoning && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-blue-900">AI-Recommended Commercial Strategy</h3>
                {triggerUpdatedBy === 'ai' && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                    AI-configured
                  </span>
                )}
                {triggerUpdatedBy === 'manual' && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                    User-edited
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                {commercialStrategyReasoning}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Save Message */}
      {saveMessage && (
        <div className={`mb-4 p-3 rounded-lg border ${
          saveMessage.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <p className="text-sm font-medium">{saveMessage.text}</p>
        </div>
      )}

      {/* Baseline Mode */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Default Commercial Mode
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Used for weeks with no active triggers
        </p>
        
        <div className="grid grid-cols-3 gap-3">
          {(['booking_push', 'footfall_push', 'balanced'] as CommercialMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => isEditing && setBaselineMode(mode)}
              disabled={!isEditing}
              className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                baselineMode === mode
                  ? getModeColor(mode) + ' border-current'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              } ${!isEditing && 'opacity-60 cursor-not-allowed'}`}
            >
              {getModeLabel(mode)}
            </button>
          ))}
        </div>
      </div>

      {/* Trigger Configuration */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Event Triggers</h3>
            <p className="text-xs text-gray-500 mt-1">
              {getEnabledTriggersCount()} of {TRIGGER_CATALOG.length} triggers enabled
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {TRIGGER_CATALOG.map(trigger => {
            const config = triggerConfig[trigger.id] || { enabled: false };
            const isEnabled = config.enabled;

            return (
              <div 
                key={trigger.id}
                className={`border rounded-lg p-4 transition-all ${
                  isEnabled 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {/* Trigger Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl">{trigger.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {trigger.name}
                        </h4>
                        {isEnabled && config.mode && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getModeColor(config.mode)}`}>
                            {getModeLabel(config.mode)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {trigger.description}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => isEditing && toggleTrigger(trigger.id)}
                      disabled={!isEditing}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
                  </label>
                </div>

                {/* Trigger Configuration (shown when enabled and editing) */}
                {isEnabled && isEditing && (
                  <div className="pl-11 space-y-3 border-t border-blue-200 pt-3">
                    {/* Mode Selection */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Commercial Mode
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['booking_push', 'footfall_push', 'balanced'] as CommercialMode[]).map(mode => (
                          <button
                            key={mode}
                            onClick={() => updateTriggerMode(trigger.id, mode)}
                            className={`px-3 py-2 rounded border text-xs font-medium transition-all ${
                              config.mode === mode
                                ? getModeColor(mode) + ' border-current'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {getModeLabel(mode)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quotas */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Min Booking Ideas
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={config.min_booking_ideas || 1}
                          onChange={(e) => updateTriggerQuota(trigger.id, 'min_booking_ideas', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Min Footfall Ideas
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={config.min_footfall_ideas || 1}
                          onChange={(e) => updateTriggerQuota(trigger.id, 'min_footfall_ideas', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Trigger Summary (shown when enabled but not editing) */}
                {isEnabled && !isEditing && (
                  <div className="pl-11 text-xs text-gray-600">
                    Min {config.min_booking_ideas || 1} booking, {config.min_footfall_ideas || 1} footfall ideas
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Actions */}
      {isEditing && (
        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
