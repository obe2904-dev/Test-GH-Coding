// DISABLED: website_analysis_jobs table does not exist in database
// This feature is not implemented
/*
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Helper function to trigger brand profile generation after website analysis completes
async function triggerBrandProfileGeneration(businessId: string) {
  try {
    console.log('🤖 Auto-triggering brand profile generation for business:', businessId);
    
    const { data, error } = await supabase.functions.invoke('brand-profile-generator', {
      body: {
        businessId,
        forceRegenerate: false // Preserve user edits per lifecycle rules
      }
    });

    if (error) {
      console.error('❌ Brand profile generation failed:', error);
      return;
    }

    if (data?.error) {
      console.error('❌ Brand profile generation returned error:', data.error);
      return;
    }

    console.log('✅ Brand profile generated successfully (auto-trigger)');
  } catch (error) {
    console.error('❌ Unexpected error during brand profile generation:', error);
  }
}

interface WebsiteAnalysisJob {
  id: string;
  business_id: string;
  website_url: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  result?: {
    website_url: string;
    analysis: {
      business_name?: string;
      business_type?: string;
      short_description?: string;
      long_description?: string;
      services?: string[];
      specialties?: string[];
      contact?: {
        phone?: string;
        email?: string;
        address?: string;
      };
      keywords?: string[];
    };
    brand_profile?: any;
    metadata?: any;
  };
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export const useWebsiteAnalysis = (businessId: string) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentJob, setCurrentJob] = useState<WebsiteAnalysisJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  // Check for existing job on mount
  useEffect(() => {
    checkExistingJob();
  }, [businessId]);

  // Setup realtime subscription when we have a job
  useEffect(() => {
    if (!currentJob) {
      if (channel) {
        channel.unsubscribe();
        setChannel(null);
      }
      return;
    }

    const subscription = supabase
      .channel(`website_job:${currentJob.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'website_analysis_jobs',
          filter: `id=eq.${currentJob.id}`
        },
        (payload: RealtimePostgresChangesPayload<WebsiteAnalysisJob>) => {
          const updated = payload.new as WebsiteAnalysisJob;
          console.log('Job updated:', updated.status);
          setCurrentJob(updated);

          if (updated.status === 'done' || updated.status === 'error') {
            setIsAnalyzing(false);
            if (updated.status === 'error') {
              setError(updated.error_message || 'Analysis failed');
            } else if (updated.status === 'done') {
              // Auto-trigger brand profile generation after successful website analysis
              triggerBrandProfileGeneration(businessId);
            }
          }
        }
      )
      .subscribe();

    setChannel(subscription);

    return () => {
      subscription.unsubscribe();
    };
  }, [currentJob?.id]);

  const checkExistingJob = async () => {
    try {
      const { data, error } = await supabase
        .from('website_analysis_jobs')
        .select('*')
        .eq('business_id', businessId)
        .in('status', ['queued', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCurrentJob(data as unknown as WebsiteAnalysisJob);
        setIsAnalyzing(true);
      }
    } catch (err) {
      console.error('Error checking existing job:', err);
    }
  };

  const startAnalysis = useCallback(async (websiteUrl: string) => {
    if (!websiteUrl || isAnalyzing) {
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('queue-website-analysis', {
        body: { businessId, websiteUrl }
      });

      if (error) throw error;

      // Fetch the job details
      const { data: job, error: jobError } = await supabase
        .from('website_analysis_jobs')
        .select('*')
        .eq('id', data.jobId)
        .single();

      if (jobError) throw jobError;

      setCurrentJob(job as unknown as WebsiteAnalysisJob);
    } catch (err: any) {
      console.error('Error starting analysis:', err);
      setError(err.message || 'Failed to start website analysis');
      setIsAnalyzing(false);
    }
  }, [businessId, isAnalyzing]);

  const cancelAnalysis = useCallback(() => {
    if (channel) {
      channel.unsubscribe();
      setChannel(null);
    }
    setCurrentJob(null);
    setIsAnalyzing(false);
    setError(null);
  }, [channel]);

  return {
    isAnalyzing,
    currentJob,
    error,
    startAnalysis,
    cancelAnalysis,
  };
};
*/

// Export a disabled hook that returns dummy values
export const useWebsiteAnalysis = (_businessId: string) => {
  return {
    isAnalyzing: false,
    currentJob: null,
    error: 'Website analysis feature not implemented',
    startAnalysis: () => {},
    cancelAnalysis: () => {},
  };
};
