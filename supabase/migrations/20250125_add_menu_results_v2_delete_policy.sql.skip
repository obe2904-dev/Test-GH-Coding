
-- Ensure idempotency: drop if exists first
DROP POLICY IF EXISTS "Users can delete their business menu results v2" ON public.menu_results_v2;

CREATE POLICY "Users can delete their business menu results v2"
  ON public.menu_results_v2
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = menu_results_v2.business_id
        AND b.owner_id = auth.uid()
    )
  );

-- Add UPDATE policy as well (for future use)
DROP POLICY IF EXISTS "Users can update their business menu results v2" ON public.menu_results_v2;
CREATE POLICY "Users can update their business menu results v2"
  ON public.menu_results_v2
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = menu_results_v2.business_id
        AND b.owner_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can delete their business menu results v2" ON public.menu_results_v2 IS 
'Allows business owners to delete menu extraction results for their own businesses';

COMMENT ON POLICY "Users can update their business menu results v2" ON public.menu_results_v2 IS 
'Allows business owners to update menu extraction results for their own businesses (for editing extracted menus)';
