import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Hook to check if the current user is an approved tester
 * Used in staging/preview environments to restrict access
 */
export function useAccessControl() {
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAccess() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setIsApproved(false);
          setLoading(false);
          return;
        }

        // Check if user is in approved_testers table
        const { data, error: queryError } = await supabase
          .from('approved_testers')
          .select('active, role')
          .eq('email', user.email)
          .single();

        if (queryError) {
          console.error('Access check error:', queryError);
          setError(queryError.message);
          setIsApproved(false);
        } else if (!data) {
          setIsApproved(false);
        } else {
          setIsApproved(data.active === true);
        }
      } catch (err) {
        console.error('Unexpected error checking access:', err);
        setError('Failed to verify access permissions');
        setIsApproved(false);
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, []);

  return { isApproved, loading, error };
}
