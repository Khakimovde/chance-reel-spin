-- Add UPDATE policy for withdrawals - allow all updates (admin manages via app)
CREATE POLICY "Allow all to update withdrawals" ON public.withdrawals
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Add DELETE policy for withdrawals if needed
CREATE POLICY "Allow all to delete withdrawals" ON public.withdrawals
  FOR DELETE
  USING (true);