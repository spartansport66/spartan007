-- Allow payment users to create and manage credit notes
-- This migration updates RLS policies to include 'payment' user type

-- Update INSERT policy to allow payment users
DROP POLICY IF EXISTS "credit_notes_insert_policy" ON public.credit_notes;
CREATE POLICY "credit_notes_insert_policy" ON public.credit_notes
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE COALESCE(is_admin, false) = true 
         OR user_type IN ('admin', 'payment')
    )
  );

-- Update UPDATE policy to allow payment users
DROP POLICY IF EXISTS "credit_notes_update_policy" ON public.credit_notes;
CREATE POLICY "credit_notes_update_policy" ON public.credit_notes
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE COALESCE(is_admin, false) = true 
         OR user_type IN ('admin', 'payment')
    )
  );

-- Update DELETE policy to allow payment users
DROP POLICY IF EXISTS "credit_notes_delete_policy" ON public.credit_notes;
CREATE POLICY "credit_notes_delete_policy" ON public.credit_notes
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE COALESCE(is_admin, false) = true 
         OR user_type IN ('admin', 'payment')
    )
  );

-- Update SELECT policy to include payment users
DROP POLICY IF EXISTS "credit_notes_select_policy" ON public.credit_notes;
CREATE POLICY "credit_notes_select_policy" ON public.credit_notes
  FOR SELECT USING (
    auth.uid() = created_by 
    OR auth.uid() = approved_by 
    OR auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE COALESCE(is_admin, false) = true 
         OR user_type IN ('admin', 'payment', 'billing')
    )
  );

-- Update credit_note_items policies to match
DROP POLICY IF EXISTS "credit_note_items_select_policy" ON public.credit_note_items;
CREATE POLICY "credit_note_items_select_policy" ON public.credit_note_items
  FOR SELECT USING (
    auth.uid() IN (
      SELECT created_by FROM public.credit_notes cn WHERE cn.id = credit_note_id
    )
    OR auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE COALESCE(is_admin, false) = true 
         OR user_type IN ('admin', 'payment')
    )
  );

DROP POLICY IF EXISTS "credit_note_items_insert_policy" ON public.credit_note_items;
CREATE POLICY "credit_note_items_insert_policy" ON public.credit_note_items
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT created_by FROM public.credit_notes cn WHERE cn.id = credit_note_id
    )
    OR auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE COALESCE(is_admin, false) = true 
         OR user_type IN ('admin', 'payment')
    )
  );

DROP POLICY IF EXISTS "credit_note_items_update_policy" ON public.credit_note_items;
CREATE POLICY "credit_note_items_update_policy" ON public.credit_note_items
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT created_by FROM public.credit_notes cn WHERE cn.id = credit_note_id
    )
    OR auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE COALESCE(is_admin, false) = true 
         OR user_type IN ('admin', 'payment')
    )
  );

DROP POLICY IF EXISTS "credit_note_items_delete_policy" ON public.credit_note_items;
CREATE POLICY "credit_note_items_delete_policy" ON public.credit_note_items
  FOR DELETE USING (
    auth.uid() IN (
      SELECT created_by FROM public.credit_notes cn WHERE cn.id = credit_note_id
    )
    OR auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE COALESCE(is_admin, false) = true 
         OR user_type IN ('admin', 'payment')
    )
  );
