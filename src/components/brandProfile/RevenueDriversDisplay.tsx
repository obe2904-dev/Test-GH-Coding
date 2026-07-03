import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface RevenueMoment {
  moment_id: string;
  label: string;
  days: string[];
  time_range: string;
  service_type: string;
}

interface RevenueDrivers {
  analyzed_at?: string;
  analyzed_from?: string;
  confidence_score?: number;
  primary_revenue_moments?: RevenueMoment[];
  secondary_revenue_moments?: RevenueMoment[];
  preferred_day_pattern?: string[];
  normal_week_strategy?: {
    preferred_day_pattern?: string[];
  };
}

interface RevenueDriversDisplayProps {
  businessId: string;
}

/**
 * Revenue Drivers Display Component
 * 
 * Shows multi-primary revenue moment analysis results.
 * Displays which service periods drive business at different times,
 * and the preferred posting days derived from temporal overlap analysis.
 */
export function RevenueDriversDisplay({ businessId }: RevenueDriversDisplayProps) {
  const [revenueDrivers, setRevenueDrivers] = useState<RevenueDrivers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!businessId) return;

    const fetchRevenueDrivers = async () => {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('business_brand_profile')
          .select('revenue_drivers')
          .eq('business_id', businessId)
          .single();

        if (fetchError) throw fetchError;

        setRevenueDrivers((data?.revenue_drivers as RevenueDrivers | null) || null);
      } catch (err) {
        console.error('[RevenueDriversDisplay] Fetch error:', err);
        setError('Kunne ikke hente revenue drivers');
      } finally {
        setLoading(false);
      }
    };

    fetchRevenueDrivers();
  }, [businessId]);

  if (loading) {
    return (
      <div className="bg-surface-alt rounded-lg p-4 border border-border">
        <div className="animate-pulse">
          <div className="h-4 bg-border rounded w-1/3 mb-3"></div>
          <div className="h-3 bg-border rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error || !revenueDrivers) {
    return null; // Silently hide if no data
  }

  const primaryMoments = revenueDrivers.primary_revenue_moments || [];
  const secondaryMoments = revenueDrivers.secondary_revenue_moments || [];
  const preferredDays = revenueDrivers.preferred_day_pattern || 
                        revenueDrivers.normal_week_strategy?.preferred_day_pattern || 
                        [];

  if (primaryMoments.length === 0 && preferredDays.length === 0) {
    return null; // Nothing to show
  }

  // Get icon for service type
  const getServiceIcon = (serviceType: string): string => {
    const type = serviceType.toLowerCase();
    if (type.includes('brunch') || type.includes('breakfast')) return '🌅';
    if (type.includes('lunch')) return '🍽️';
    if (type.includes('dinner') || type.includes('aften')) return '🌆';
    if (type.includes('coffee') || type.includes('kaffe')) return '☕';
    if (type.includes('bar') || type.includes('cocktail')) return '🍸';
    return '⏰';
  };

  // Format day list (abbreviate for display)
  const formatDays = (days: string[]): string => {
    if (days.length === 7) return 'Alle dage';
    if (days.length === 5 && !days.includes('Saturday') && !days.includes('Sunday')) {
      return 'Man-Fre';
    }
    if (days.length === 2 && days.includes('Saturday') && days.includes('Sunday')) {
      return 'Lør-Søn';
    }
    
    const dayMap: Record<string, string> = {
      'Monday': 'Man', 'Tuesday': 'Tir', 'Wednesday': 'Ons',
      'Thursday': 'Tor', 'Friday': 'Fre', 'Saturday': 'Lør', 'Sunday': 'Søn'
    };
    
    return days.map(d => dayMap[d] || d).join(', ');
  };

  // Format date for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('da-DK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-text-secondary mb-1">
            📊 Revenue Drivers
          </h4>
          <p className="text-xs text-text-muted">
            AI-analyserede omsætningsmomenter der styrer indholdsfordeling
          </p>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          {showDetails ? 'Skjul detaljer' : 'Vis detaljer'}
        </button>
      </div>

      {/* Primary Revenue Moments */}
      {primaryMoments.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wide">
            Primære omsætningsmomenter ({primaryMoments.length})
          </div>
          
          <div className="grid gap-3">
            {primaryMoments.map((moment, index) => (
              <div
                key={moment.moment_id || index}
                className="bg-surface rounded-lg p-3 border border-border hover:border-accent transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl" title={moment.service_type}>
                    {getServiceIcon(moment.service_type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-text">
                        {moment.label}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-accent-surface text-accent-text rounded-full">
                        {moment.service_type}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                      <div className="flex items-center gap-1">
                        <span className="text-text-muted">📅</span>
                        <span>{formatDays(moment.days)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-text-muted">🕐</span>
                        <span>{moment.time_range}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Secondary Revenue Moments */}
      {showDetails && secondaryMoments.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wide">
            Sekundære momenter ({secondaryMoments.length})
          </div>
          
          <div className="grid gap-2">
            {secondaryMoments.map((moment, index) => (
              <div
                key={moment.moment_id || index}
                className="bg-surface-alt rounded-lg p-2 border border-border text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getServiceIcon(moment.service_type)}</span>
                  <span className="font-medium">{moment.label}</span>
                  <span className="text-xs text-text-muted">
                    • {formatDays(moment.days)} • {moment.time_range}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preferred Day Pattern */}
      {preferredDays.length > 0 && (
        <div className="bg-accent-surface/30 rounded-lg p-4 border border-accent/30">
          <div className="flex items-start gap-3">
            <div className="text-2xl">📌</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-accent-text mb-2">
                Foretrukne opslags-dage
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {preferredDays.map((day, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-accent text-accent-contrast text-sm font-medium rounded-full"
                  >
                    {formatDays([day])}
                  </span>
                ))}
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Ugeplan fordeler indhold på disse dage baseret på temporal-overlap analyse 
                af {primaryMoments.length} primære omsætningsmomenter.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metadata (shown when details expanded) */}
      {showDetails && (
        <div className="bg-surface-alt rounded-lg p-3 border border-border">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {revenueDrivers.analyzed_from && (
              <div>
                <div className="text-text-muted mb-1">Analyseret fra</div>
                <div className="text-text font-medium">
                  {revenueDrivers.analyzed_from === 'brand_profile_v5.layer_1_programmes'
                    ? 'Programmer'
                    : revenueDrivers.analyzed_from}
                </div>
              </div>
            )}
            {revenueDrivers.confidence_score !== undefined && (
              <div>
                <div className="text-text-muted mb-1">Konfidenscore</div>
                <div className="text-text font-medium">
                  {revenueDrivers.confidence_score}%
                </div>
              </div>
            )}
            {revenueDrivers.analyzed_at && (
              <div className="col-span-2">
                <div className="text-text-muted mb-1">Sidst analyseret</div>
                <div className="text-text font-medium">
                  {formatDate(revenueDrivers.analyzed_at)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analysis Method Info */}
      {showDetails && primaryMoments.length > 1 && (
        <div className="bg-info-surface/50 rounded-lg p-3 border border-info/30">
          <div className="flex items-start gap-2">
            <span className="text-info text-sm">ℹ️</span>
            <p className="text-xs text-text-secondary leading-relaxed">
              <strong>Multi-primær temporal analyse:</strong> {primaryMoments.length} service-perioder 
              identificeret som primære fordi de tjener forskellige tidspunkter uden overlap. 
              Hver får ligeværdig vægt i content-planlægning.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
