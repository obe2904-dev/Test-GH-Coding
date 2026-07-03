-- Ensure menu_results_v2 is visible to authenticated users who can access the business,
-- and that Realtime can stream updates.
-- Idempotent: safe to run even if parts already exist.

-- Realtime publication membership (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'menu_results_v2'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_results_v2;
  END IF;
END
$$;

-- Ensure RLS is enabled
ALTER TABLE public.menu_results_v2 ENABLE ROW LEVEL SECURITY;

-- Policy: users can view jobs for businesses they can access (owner or accepted team member)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'menu_results_v2'
      AND policyname = 'Users can view their business menu results v2'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view their business menu results v2"
        ON public.menu_results_v2
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1
            FROM public.businesses b
            WHERE b.id = menu_results_v2.business_id
              AND b.owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.business_team_members btm
            WHERE btm.business_id = menu_results_v2.business_id
              AND btm.user_id = auth.uid()
              AND btm.accepted_at IS NOT NULL
          )
        );
    $policy$;
  END IF;
END
$$;

-- Ensure authenticated can read rows allowed by policy
GRANT SELECT ON TABLE public.menu_results_v2 TO authenticated;
